import { ASPECTS, EFFECTS, LOOKS, type Clip, type Project } from "./types";

export class RenderCancelled extends Error {
  constructor() {
    super("Render zrušen");
  }
}

const FPS = 30;
const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
const num = (n: number) => Number(n.toFixed(3)).toString();

/** Length of a clip on the output timeline. */
export const clipLength = (clip: Clip) => Math.max(0, clip.trimEnd - clip.trimStart) / clip.speed;

/** Clip size after the user's rotation. */
const rotatedSize = (clip: Clip) =>
  clip.rotation === 90 || clip.rotation === 270
    ? { width: clip.height, height: clip.width }
    : { width: clip.width, height: clip.height };

export const outputSize = (project: Project): { width: number; height: number } => {
  const first = project.clips[0];
  if (!first) return { width: 1280, height: 720 };

  const source = rotatedSize(first);
  const ratio =
    ASPECTS.find((a) => a.id === project.aspect)?.ratio ?? source.width / Math.max(1, source.height);

  // "Resolution" is the short side, so 1080 means 1920x1080 or 1080x1920.
  const short =
    project.resolution === "source" ? Math.min(source.width, source.height) : project.resolution;

  return ratio >= 1
    ? { width: even(short * ratio), height: even(short) }
    : { width: even(short), height: even(short / ratio) };
};

/** Transition length that every clip can afford (xfade needs clips longer than the overlap). */
export const effectiveTransition = (project: Project): number => {
  if (project.transition === "none" || project.clips.length < 2) return 0;
  const shortest = Math.min(...project.clips.map(clipLength));
  return Math.max(0, Math.min(project.transitionDuration, shortest / 2 - 0.05));
};

export const totalDuration = (project: Project): number => {
  const sum = project.clips.reduce((acc, clip) => acc + clipLength(clip), 0);
  return Math.max(0, sum - effectiveTransition(project) * Math.max(0, project.clips.length - 1));
};

/** Where each clip starts on the output timeline. */
export const clipOffsets = (project: Project): number[] => {
  const overlap = effectiveTransition(project);
  let cursor = 0;
  return project.clips.map((clip, i) => {
    const start = cursor;
    cursor += clipLength(clip) - (i < project.clips.length - 1 ? overlap : 0);
    return start;
  });
};

const COPY_SAFE = /\.(mp4|m4v|mov)$/i;

/**
 * A single untouched clip can be cut without re-encoding: seconds instead of minutes,
 * no quality loss. The file keeps the frames back to the previous keyframe and hides
 * them with an MP4 edit list, so players that ignore edit lists start slightly early.
 */
export const canStreamCopy = (project: Project): boolean => {
  const [clip] = project.clips;
  return (
    project.clips.length === 1 &&
    COPY_SAFE.test(clip.name) &&
    clip.speed === 1 &&
    clip.rotation === 0 &&
    !clip.muted &&
    clip.volume === 1 &&
    project.originalVolume === 1 &&
    project.look === "none" &&
    project.effects.length === 0 &&
    project.texts.length === 0 &&
    !project.music &&
    project.aspect === "original" &&
    project.resolution === "source"
  );
};

export interface RenderInput {
  /** Name inside the FFmpeg virtual filesystem. */
  fsName: string;
  source: File | Uint8Array;
}

export interface RenderPlan {
  inputs: RenderInput[];
  args: string[];
  outputName: string;
  duration: number;
  width: number;
  height: number;
  streamCopy: boolean;
}

export interface RenderAssets {
  /** FS name for every distinct source file. */
  fileNames: Map<File, string>;
  /** Which source files carry an audio stream. */
  hasAudio: Map<File, boolean>;
  /** One transparent full-frame PNG per text layer, in project.texts order. */
  textImages: Uint8Array[];
}

const extensionOf = (name: string, fallback: string) => {
  const match = /\.([a-z0-9]{1,5})$/i.exec(name);
  return match ? match[1].toLowerCase() : fallback;
};

/** Stable FS names for the distinct files a project uses. */
export const assignFileNames = (project: Project): Map<File, string> => {
  const names = new Map<File, string>();
  project.clips.forEach((clip) => {
    if (!names.has(clip.file)) {
      names.set(clip.file, `src${names.size}.${extensionOf(clip.name, "mp4")}`);
    }
  });
  return names;
};

const ROTATE: Record<number, string> = {
  0: "",
  90: "transpose=1,",
  180: "hflip,vflip,",
  270: "transpose=2,",
};

const AUDIO_FORMAT = "aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo";

export const buildRenderPlan = (
  project: Project,
  assets: RenderAssets,
  options: { allowStreamCopy?: boolean } = {}
): RenderPlan => {
  const { clips } = project;
  const duration = totalDuration(project);
  const { width, height } = outputSize(project);
  const outputName = "output.mp4";

  const inputs: RenderInput[] = Array.from(assets.fileNames, ([file, fsName]) => ({
    fsName,
    source: file,
  }));

  if (options.allowStreamCopy !== false && canStreamCopy(project)) {
    const [clip] = clips;
    return {
      inputs,
      args: [
        "-ss", num(clip.trimStart),
        "-t", num(clip.trimEnd - clip.trimStart),
        "-i", assets.fileNames.get(clip.file)!,
        "-c", "copy",
        "-movflags", "+faststart",
        "-y", outputName,
      ],
      outputName,
      duration,
      width,
      height,
      streamCopy: true,
    };
  }

  const args: string[] = [];
  const filters: string[] = [];
  let inputCount = 0;

  const fit =
    project.fit === "cover"
      ? `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`
      : `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;

  clips.forEach((clip, i) => {
    const length = clipLength(clip);
    // Input-side seek: fast, and timestamps restart near zero.
    args.push(
      "-ss", num(clip.trimStart),
      "-t", num(clip.trimEnd - clip.trimStart),
      "-i", assets.fileNames.get(clip.file)!
    );
    inputCount++;

    filters.push(
      `[${i}:v]setpts=(PTS-STARTPTS)/${num(clip.speed)},${ROTATE[clip.rotation]}${fit},setsar=1,fps=${FPS},format=yuv420p,settb=AVTB[v${i}]`
    );

    const audible = assets.hasAudio.get(clip.file) && !clip.muted && clip.volume > 0;
    filters.push(
      audible
        ? `[${i}:a]asetpts=PTS-STARTPTS,atempo=${num(clip.speed)},volume=${num(clip.volume)},${AUDIO_FORMAT},apad,atrim=0:${num(length)}[a${i}]`
        : `anullsrc=r=44100:cl=stereo,atrim=0:${num(length)},${AUDIO_FORMAT}[a${i}]`
    );
  });

  // Join the clips.
  let video = "v0";
  let audio = "a0";
  const overlap = effectiveTransition(project);

  if (clips.length > 1 && overlap > 0) {
    let joined = clipLength(clips[0]);
    for (let i = 1; i < clips.length; i++) {
      filters.push(
        `[${video}][v${i}]xfade=transition=${project.transition}:duration=${num(overlap)}:offset=${num(joined - overlap)}[xv${i}]`,
        `[${audio}][a${i}]acrossfade=d=${num(overlap)}[xa${i}]`
      );
      video = `xv${i}`;
      audio = `xa${i}`;
      joined += clipLength(clips[i]) - overlap;
    }
  } else if (clips.length > 1) {
    filters.push(
      `${clips.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${clips.length}:v=1:a=1[cv][ca]`
    );
    video = "cv";
    audio = "ca";
  }

  // Look and effects.
  const grade = [
    LOOKS.find((look) => look.id === project.look)?.ffmpeg,
    ...EFFECTS.filter((effect) => project.effects.includes(effect.id)).map((e) => e.ffmpeg),
  ].filter(Boolean);
  if (grade.length > 0) {
    filters.push(`[${video}]${grade.join(",")},format=yuv420p[gv]`);
    video = "gv";
  }

  // Text layers: pre-rendered transparent PNGs, shown inside their time window.
  project.texts.forEach((layer, i) => {
    const fsName = `text${i}.png`;
    inputs.push({ fsName, source: assets.textImages[i] });
    args.push("-i", fsName);
    const start = Math.max(0, Math.min(layer.start, duration));
    const end = Math.max(start, Math.min(layer.end, duration));
    filters.push(
      `[${video}][${inputCount}:v]overlay=0:0:enable='between(t,${num(start)},${num(end)})'[tv${i}]`
    );
    video = `tv${i}`;
    inputCount++;
  });

  // Audio mix.
  if (project.originalVolume !== 1) {
    filters.push(`[${audio}]volume=${num(project.originalVolume)}[ov]`);
    audio = "ov";
  }
  if (project.music) {
    const { music } = project;
    const fsName = `music.${extensionOf(music.name, "mp3")}`;
    inputs.push({ fsName, source: music.file });
    args.push("-stream_loop", "-1", "-i", fsName);
    const fadeIn = Math.min(music.fadeIn, duration / 2);
    const fadeOut = Math.min(music.fadeOut, duration / 2);
    const chain = [
      `atrim=0:${num(duration)}`,
      "asetpts=PTS-STARTPTS",
      `volume=${num(music.volume)}`,
      fadeIn > 0 ? `afade=t=in:st=0:d=${num(fadeIn)}` : "",
      fadeOut > 0 ? `afade=t=out:st=${num(duration - fadeOut)}:d=${num(fadeOut)}` : "",
      AUDIO_FORMAT,
    ].filter(Boolean);
    filters.push(
      `[${inputCount}:a]${chain.join(",")}[mu]`,
      `[${audio}][mu]amix=inputs=2:duration=first:normalize=0[mx]`
    );
    audio = "mx";
    inputCount++;
  }

  args.push(
    "-filter_complex", filters.join(";"),
    "-map", `[${video}]`,
    "-map", `[${audio}]`,
    "-t", num(duration),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "22",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "160k",
    "-movflags", "+faststart",
    "-y", outputName
  );

  return { inputs, args, outputName, duration, width, height, streamCopy: false };
};
