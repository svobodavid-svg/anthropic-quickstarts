import { useState, useRef, useCallback } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { RenderCancelled, type RenderPlan } from "@/lib/editor/render";

export { RenderCancelled };

export type EffectType = "slideshow" | "kenburns" | "morphing";

/** The FFmpeg core is copied to public/ffmpeg by scripts/copy-ffmpeg-core.mjs (same origin, works offline). */
const coreUrl = (file: string) => `${window.location.origin}/ffmpeg/${file}`;

const TIME_RE = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/;

const toMp4Blob = (data: Uint8Array | string): Blob =>
  new Blob([new Uint8Array(data as Uint8Array)], { type: "video/mp4" });

const imageExt = (file: File): string => file.name.split(".").pop() || "jpg";

/** Chain xfade filters across already-normalised [v0]..[vN] streams. */
const buildXfadeChain = (
  count: number,
  transition: "fade" | "dissolve",
  imageDuration: number,
  transitionDuration: number
): string => {
  let chain = "";
  let previous = "v0";
  for (let i = 1; i < count; i++) {
    const label = i === count - 1 ? "outv" : `xf${i}`;
    chain += `[${previous}][v${i}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${i * imageDuration}[${label}]${i === count - 1 ? "" : ";"}`;
    previous = label;
  }
  return chain;
};

export const useFFmpeg = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const loadPromiseRef = useRef<Promise<FFmpeg> | null>(null);
  const logRef = useRef<string[]>([]);
  const expectedDurationRef = useRef(0);
  const cancelledRef = useRef(false);

  const loadFFmpeg = useCallback((): Promise<FFmpeg> => {
    // One shared load: React strict mode mounts effects twice in development.
    if (loadPromiseRef.current) return loadPromiseRef.current;

    const load = async () => {
      const ffmpeg = new FFmpeg();

      ffmpeg.on("log", ({ message }) => {
        logRef.current.push(message);
        if (logRef.current.length > 400) logRef.current.shift();

        // Progress from the encoder's own clock; the built-in progress event is unreliable
        // with several inputs.
        const match = TIME_RE.exec(message);
        if (match && expectedDurationRef.current > 0) {
          const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
          const percent = Math.round((seconds / expectedDurationRef.current) * 100);
          setProgress(Math.max(0, Math.min(99, percent)));
        }
      });

      await ffmpeg.load({
        coreURL: coreUrl("ffmpeg-core.js"),
        wasmURL: coreUrl("ffmpeg-core.wasm"),
      });

      ffmpegRef.current = ffmpeg;
      return ffmpeg;
    };

    loadPromiseRef.current = load().catch((error) => {
      console.error("Failed to load FFmpeg:", error);
      loadPromiseRef.current = null; // allow a retry
      throw error;
    });
    return loadPromiseRef.current;
  }, []);

  /** Run one job with shared bookkeeping: busy flag, progress, cancellation. */
  const runJob = useCallback(
    async <T,>(expectedDuration: number, job: (ffmpeg: FFmpeg) => Promise<T>): Promise<T> => {
      const ffmpeg = await loadFFmpeg();
      cancelledRef.current = false;
      expectedDurationRef.current = expectedDuration;
      logRef.current = [];
      setIsProcessing(true);
      setProgress(0);
      try {
        return await job(ffmpeg);
      } catch (error) {
        if (cancelledRef.current) throw new RenderCancelled();
        console.error("FFmpeg job failed:", error, logRef.current.slice(-15).join("\n"));
        throw error;
      } finally {
        expectedDurationRef.current = 0;
        setIsProcessing(false);
        setProgress(0);
      }
    },
    [loadFFmpeg]
  );

  /** Stop the running job. The worker is torn down; the next job reloads it. */
  const cancel = useCallback(() => {
    if (!ffmpegRef.current) return;
    cancelledRef.current = true;
    ffmpegRef.current.terminate();
    ffmpegRef.current = null;
    loadPromiseRef.current = null;
  }, []);

  const exec = async (ffmpeg: FFmpeg, args: string[]) => {
    const code = await ffmpeg.exec(args);
    if (code !== 0) throw new Error(`FFmpeg skončil s kódem ${code}`);
  };

  /** Detect which of the given files (already in the FS) carry audio. */
  const probeAudio = async (ffmpeg: FFmpeg, fsName: string): Promise<boolean> => {
    const from = logRef.current.length;
    // "-i" without an output exits non-zero by design; only the stream listing matters.
    await ffmpeg.exec(["-hide_banner", "-i", fsName]);
    return logRef.current.slice(from).some((line) => /Stream #.*Audio:/.test(line));
  };

  /**
   * Render a project. `prepare` receives the audio map (needed to build the filter graph)
   * and returns the final plan.
   */
  const render = useCallback(
    (
      files: Map<File, string>,
      expectedDuration: number,
      prepare: (hasAudio: Map<File, boolean>) => Promise<RenderPlan>
    ): Promise<Blob> =>
      runJob(expectedDuration, async (ffmpeg) => {
        const written: string[] = [];
        try {
          const hasAudio = new Map<File, boolean>();
          for (const [file, fsName] of Array.from(files)) {
            await ffmpeg.writeFile(fsName, await fetchFile(file));
            written.push(fsName);
            hasAudio.set(file, await probeAudio(ffmpeg, fsName));
          }

          const plan = await prepare(hasAudio);
          for (const input of plan.inputs) {
            if (written.includes(input.fsName)) continue;
            await ffmpeg.writeFile(
              input.fsName,
              input.source instanceof File ? await fetchFile(input.source) : input.source
            );
            written.push(input.fsName);
          }

          await exec(ffmpeg, plan.args);
          written.push(plan.outputName);
          const blob = toMp4Blob(await ffmpeg.readFile(plan.outputName));
          setProgress(100);
          return blob;
        } finally {
          if (!cancelledRef.current) {
            for (const name of written) {
              await ffmpeg.deleteFile(name).catch(() => undefined);
            }
          }
        }
      }),
    [runJob]
  );

  const generateVideoFromImages = useCallback(
    (images: File[], effect: EffectType, imageDuration: number, transitionDuration: number): Promise<Blob> => {
      const count = images.length;
      const clipLength = imageDuration + transitionDuration;

      return runJob(count * imageDuration + transitionDuration, async (ffmpeg) => {
        const names = images.map((image, i) => `img${i}.${imageExt(image)}`);
        const outputName = "slideshow.mp4";
        try {
          const inputs: string[] = [];
          for (let i = 0; i < count; i++) {
            await ffmpeg.writeFile(names[i], await fetchFile(images[i]));
            if (effect === "kenburns") {
              // zoompan emits `d` frames per input frame, so feed it a single still.
              inputs.push("-i", names[i]);
            } else {
              inputs.push("-loop", "1", "-t", String(clipLength), "-i", names[i]);
            }
          }

          let filterComplex = "";
          for (let i = 0; i < count; i++) {
            if (effect === "kenburns") {
              // Alternate between zoom-in and zoom-out.
              const zoom = i % 2 === 0 ? "zoom+0.001" : "if(lte(zoom,1.0),1.5,max(1.001,zoom-0.001))";
              // Pre-scale to 2x the output (cover + crop to 16:9): enough headroom for a smooth
              // zoom without the huge frames that stall single-threaded WebAssembly.
              filterComplex += `[${i}:v]scale=2560:1440:force_original_aspect_ratio=increase,crop=2560:1440,zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${Math.round(clipLength * 30)}:s=1280x720:fps=30,setsar=1[v${i}];`;
            } else {
              filterComplex += `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}];`;
            }
          }
          filterComplex += buildXfadeChain(
            count,
            effect === "morphing" ? "dissolve" : "fade",
            imageDuration,
            transitionDuration
          );

          await exec(ffmpeg, [
            ...inputs,
            "-filter_complex", filterComplex,
            "-map", "[outv]",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-y", outputName,
          ]);

          return toMp4Blob(await ffmpeg.readFile(outputName));
        } finally {
          if (!cancelledRef.current) {
            for (const name of [...names, outputName]) {
              await ffmpeg.deleteFile(name).catch(() => undefined);
            }
          }
        }
      });
    },
    [runJob]
  );

  /** Encode a PCM mix to AAC and attach it to an already encoded video (no video re-encode). */
  const muxAudio = useCallback(
    (video: Blob, wav: Uint8Array): Promise<Blob> =>
      runJob(0, async (ffmpeg) => {
        const names = ["video.mp4", "mix.wav", "muxed.mp4"];
        try {
          await ffmpeg.writeFile(names[0], await fetchFile(video));
          await ffmpeg.writeFile(names[1], wav);
          await exec(ffmpeg, [
            "-i", names[0],
            "-i", names[1],
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "160k",
            "-shortest",
            "-movflags", "+faststart",
            "-y", names[2],
          ]);
          return toMp4Blob(await ffmpeg.readFile(names[2]));
        } finally {
          if (!cancelledRef.current) {
            for (const name of names) await ffmpeg.deleteFile(name).catch(() => undefined);
          }
        }
      }),
    [runJob]
  );

  return { isProcessing, progress, loadFFmpeg, render, muxAudio, generateVideoFromImages, cancel };
};
