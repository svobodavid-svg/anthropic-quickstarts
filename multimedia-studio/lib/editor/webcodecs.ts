import {
  ALL_FORMATS,
  AudioBufferSink,
  AudioBufferSource,
  BlobSource,
  BufferTarget,
  CanvasSource,
  Input,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  VideoSampleSink,
  canEncodeAudio,
  canEncodeVideo,
  type Rotation as MediaRotation,
  type VideoSample,
} from "mediabunny";
import { drawTextLayer } from "./media";
import {
  RenderCancelled,
  clipLength,
  clipOffsets,
  effectiveTransition,
  outputSize,
  totalDuration,
} from "./render";
import { EFFECTS, LOOKS, type Clip, type Project } from "./types";

/**
 * Export engine built on WebCodecs: frames are decoded by the browser, composited on a
 * canvas and encoded by the platform encoder (hardware where available). Several times
 * faster than FFmpeg in WebAssembly, and the picture matches the preview because both use
 * the same canvas/CSS filters.
 */

const FPS = 30;
const SAMPLE_RATE = 48000;

export interface WebCodecsSupport {
  supported: boolean;
  /** False when the browser cannot encode AAC; the audio is then encoded by FFmpeg. */
  nativeAudio: boolean;
}

export const detectWebCodecs = async (width: number, height: number): Promise<WebCodecsSupport> => {
  try {
    if (typeof VideoEncoder === "undefined" || typeof OfflineAudioContext === "undefined") {
      return { supported: false, nativeAudio: false };
    }
    // Colour filters rely on the canvas `filter` property (missing in older Safari).
    const context = document.createElement("canvas").getContext("2d");
    if (!context || !("filter" in context)) return { supported: false, nativeAudio: false };

    const video = await canEncodeVideo("avc", { width, height });
    const audio = await canEncodeAudio("aac");
    return { supported: video, nativeAudio: audio };
  } catch {
    return { supported: false, nativeAudio: false };
  }
};

export interface WebCodecsResult {
  /** MP4 with video, plus audio when the browser could encode it. */
  video: Blob;
  /** PCM mix as a WAV file when the audio still has to be encoded. */
  wav: Uint8Array | null;
}

interface RenderOptions {
  nativeAudio: boolean;
  signal: AbortSignal;
  onProgress: (percent: number) => void;
}

const makeCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas není k dispozici");
  return { canvas, ctx };
};

/** Reads frames of one clip in order; `at()` returns the frame shown at a source time. */
class FrameReader {
  private input: Input;
  private iterator: AsyncIterator<VideoSample> | null = null;
  private current: VideoSample | null = null;
  private next: VideoSample | null = null;
  private done = false;

  constructor(private clip: Clip) {
    this.input = new Input({ source: new BlobSource(clip.file), formats: ALL_FORMATS });
  }

  async at(sourceTime: number): Promise<VideoSample | null> {
    if (!this.iterator) {
      const track = await this.input.getPrimaryVideoTrack();
      if (!track) throw new Error(`Soubor ${this.clip.name} nemá video stopu`);
      this.iterator = new VideoSampleSink(track)
        .samples(this.clip.trimStart, this.clip.trimEnd)
        [Symbol.asyncIterator]();
    }

    for (;;) {
      if (!this.next && !this.done) {
        const result = await this.iterator.next();
        if (result.done) this.done = true;
        else this.next = result.value;
      }
      if (this.next && this.next.timestamp <= sourceTime + 1e-4) {
        this.current?.close();
        this.current = this.next;
        this.next = null;
        continue;
      }
      break;
    }
    // Before the first decoded frame, show that first frame.
    return this.current ?? this.next;
  }

  dispose() {
    this.current?.close();
    this.next?.close();
    this.iterator?.return?.();
    this.input.dispose();
  }
}

const encodeWav = (buffer: AudioBuffer): Uint8Array => {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const bytes = new Uint8Array(44 + frames * channels * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) =>
    value.split("").forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));

  text(0, "RIFF");
  view.setUint32(4, 36 + frames * channels * 2, true);
  text(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, frames * channels * 2, true);

  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, data[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return bytes;
};

interface AudioMixOptions {
  sampleRate?: number;
  channels?: number;
  /** Leave the music track out (used for speech recognition). */
  speechOnly?: boolean;
}

/** Mix clip audio, crossfades and the music track into one buffer on the output timeline. */
export const renderAudio = async (
  project: Project,
  signal: AbortSignal,
  { sampleRate = SAMPLE_RATE, channels = 2, speechOnly = false }: AudioMixOptions = {}
): Promise<AudioBuffer> => {
  const duration = totalDuration(project);
  const offsets = clipOffsets(project);
  const overlap = effectiveTransition(project);
  const context = new OfflineAudioContext(channels, Math.max(1, Math.ceil(duration * sampleRate)), sampleRate);

  for (let i = 0; i < project.clips.length; i++) {
    const clip = project.clips[i];
    // For speech recognition every clip is heard at full level, whatever the mix says.
    const level = speechOnly ? 1 : clip.muted ? 0 : clip.volume * project.originalVolume;
    if (level <= 0) continue;

    const input = new Input({ source: new BlobSource(clip.file), formats: ALL_FORMATS });
    try {
      const track = await input.getPrimaryAudioTrack();
      if (!track) continue;

      const start = offsets[i];
      const end = start + clipLength(clip);
      const gain = context.createGain();
      gain.connect(context.destination);
      // Crossfade with the neighbours inside the transition window.
      if (overlap > 0 && i > 0) {
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start + overlap);
      } else {
        gain.gain.setValueAtTime(level, 0);
      }
      if (overlap > 0 && i < project.clips.length - 1) {
        gain.gain.setValueAtTime(level, end - overlap);
        gain.gain.linearRampToValueAtTime(0, end);
      }

      for await (const { buffer, timestamp, duration: length } of new AudioBufferSink(track).buffers(
        clip.trimStart,
        clip.trimEnd
      )) {
        if (signal.aborted) throw new RenderCancelled();
        const from = Math.max(timestamp, clip.trimStart);
        const to = Math.min(timestamp + length, clip.trimEnd);
        if (to <= from) continue;
        const node = context.createBufferSource();
        node.buffer = buffer;
        node.playbackRate.value = clip.speed;
        node.connect(gain);
        node.start(start + (from - clip.trimStart) / clip.speed, from - timestamp, to - from);
      }
    } finally {
      input.dispose();
    }
  }

  if (!speechOnly && project.music && project.music.volume > 0) {
    const { music } = project;
    const decoded = await context.decodeAudioData(await music.file.arrayBuffer());
    const node = context.createBufferSource();
    node.buffer = decoded;
    node.loop = true;
    const gain = context.createGain();
    const fadeIn = Math.min(music.fadeIn, duration / 2);
    const fadeOut = Math.min(music.fadeOut, duration / 2);
    gain.gain.setValueAtTime(fadeIn > 0 ? 0 : music.volume, 0);
    if (fadeIn > 0) gain.gain.linearRampToValueAtTime(music.volume, fadeIn);
    if (fadeOut > 0) {
      gain.gain.setValueAtTime(music.volume, duration - fadeOut);
      gain.gain.linearRampToValueAtTime(0, duration);
    }
    node.connect(gain);
    gain.connect(context.destination);
    node.start(0);
    node.stop(duration);
  }

  return context.startRendering();
};

const makeGrain = () => {
  const { canvas, ctx } = makeCanvas(256, 256);
  const image = ctx.createImageData(256, 256);
  for (let i = 0; i < image.data.length; i += 4) {
    const value = Math.random() * 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

export const renderWithWebCodecs = async (
  project: Project,
  { nativeAudio, signal, onProgress }: RenderOptions
): Promise<WebCodecsResult> => {
  const { width, height } = outputSize(project);
  const duration = totalDuration(project);
  const offsets = clipOffsets(project);
  const overlap = effectiveTransition(project);
  const frameCount = Math.max(1, Math.round(duration * FPS));

  const main = makeCanvas(width, height);
  const stage = makeCanvas(width, height);
  const layerA = makeCanvas(width, height);
  const layerB = makeCanvas(width, height);
  const tint = makeCanvas(width, height);

  const active = new Set(project.effects);
  const cssFilter = [
    LOOKS.find((look) => look.id === project.look)?.css,
    ...EFFECTS.filter((effect) => active.has(effect.id)).map((effect) => effect.css),
  ]
    .filter(Boolean)
    .join(" ");
  const grain = active.has("grain") ? makeGrain() : null;
  const texts = project.texts.map((layer) => ({ layer, canvas: drawTextLayer(layer, width, height) }));

  const readers = project.clips.map((clip) => new FrameReader(clip));

  const drawClip = async (index: number, time: number, target: typeof layerA) => {
    const clip = project.clips[index];
    const sourceTime = clip.trimStart + Math.max(0, time - offsets[index]) * clip.speed;
    const sample = await readers[index].at(Math.min(sourceTime, clip.trimEnd));
    target.ctx.fillStyle = "#000";
    target.ctx.fillRect(0, 0, width, height);
    if (!sample) return;
    sample.drawWithFit(target.ctx, {
      fit: project.fit,
      rotation: ((sample.rotation + clip.rotation) % 360) as MediaRotation,
    });
  };

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const videoSource = new CanvasSource(main.canvas, { codec: "avc", bitrate: QUALITY_HIGH, keyFrameInterval: 2 });
  output.addVideoTrack(videoSource, { frameRate: FPS });
  const audioSource = nativeAudio ? new AudioBufferSource({ codec: "aac", bitrate: QUALITY_HIGH }) : null;
  if (audioSource) output.addAudioTrack(audioSource);

  try {
    await output.start();

    // The audio mix is quick; do it first so a decode problem fails early.
    const mix = await renderAudio(project, signal);
    if (audioSource) await audioSource.add(mix);

    let index = 0;
    for (let frame = 0; frame < frameCount; frame++) {
      if (signal.aborted) throw new RenderCancelled();
      const time = frame / FPS;

      while (index < project.clips.length - 1 && time >= offsets[index + 1] + overlap) {
        readers[index].dispose();
        index++;
      }

      // Compose the clip (and the incoming clip during a transition) on the stage.
      await drawClip(index, time, layerA);
      stage.ctx.globalAlpha = 1;
      const incoming = index + 1;
      const inTransition =
        overlap > 0 && incoming < project.clips.length && time >= offsets[incoming];
      if (inTransition) {
        await drawClip(incoming, time, layerB);
        const progress = Math.min(1, (time - offsets[incoming]) / overlap);
        if (project.transition === "slideleft") {
          stage.ctx.drawImage(layerA.canvas, -width * progress, 0);
          stage.ctx.drawImage(layerB.canvas, width * (1 - progress), 0);
        } else if (project.transition === "wipeleft") {
          const edge = Math.round(width * (1 - progress));
          stage.ctx.drawImage(layerA.canvas, 0, 0);
          stage.ctx.drawImage(layerB.canvas, edge, 0, width - edge, height, edge, 0, width - edge, height);
        } else {
          stage.ctx.drawImage(layerA.canvas, 0, 0);
          stage.ctx.globalAlpha = progress;
          stage.ctx.drawImage(layerB.canvas, 0, 0);
          stage.ctx.globalAlpha = 1;
        }
      } else {
        stage.ctx.drawImage(layerA.canvas, 0, 0);
      }

      // Grade.
      const { ctx } = main;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = cssFilter || "none";
      if (active.has("rgbshift")) {
        // Offset the red and blue channels in opposite directions.
        const shift = Math.max(2, Math.round(width / 160));
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = "lighter";
        ([["#f00", -shift], ["#0f0", 0], ["#00f", shift]] as const).forEach(([colour, dx]) => {
          tint.ctx.globalCompositeOperation = "source-over";
          tint.ctx.drawImage(stage.canvas, 0, 0);
          tint.ctx.globalCompositeOperation = "multiply";
          tint.ctx.fillStyle = colour;
          tint.ctx.fillRect(0, 0, width, height);
          ctx.drawImage(tint.canvas, dx, 0);
        });
        ctx.globalCompositeOperation = "source-over";
      } else {
        ctx.drawImage(stage.canvas, 0, 0);
      }
      ctx.filter = "none";

      if (active.has("vignette")) {
        const radius = Math.hypot(width, height) / 2;
        const gradient = ctx.createRadialGradient(width / 2, height / 2, radius * 0.45, width / 2, height / 2, radius);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(1, "rgba(0,0,0,0.7)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }
      if (grain) {
        ctx.globalAlpha = 0.14;
        ctx.globalCompositeOperation = "overlay";
        const dx = -Math.floor(Math.random() * 256);
        const dy = -Math.floor(Math.random() * 256);
        for (let x = dx; x < width; x += 256) {
          for (let y = dy; y < height; y += 256) ctx.drawImage(grain, x, y);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }

      texts.forEach(({ layer, canvas }) => {
        if (time >= layer.start && time <= Math.min(layer.end, duration)) ctx.drawImage(canvas, 0, 0);
      });

      await videoSource.add(time, 1 / FPS);
      if (frame % 5 === 0) onProgress(Math.min(95, Math.round((frame / frameCount) * 95)));
    }

    await output.finalize();
    const buffer = output.target.buffer;
    if (!buffer) throw new Error("Export nevytvořil žádná data");
    return {
      video: new Blob([buffer], { type: "video/mp4" }),
      wav: nativeAudio ? null : encodeWav(mix),
    };
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw signal.aborted ? new RenderCancelled() : error;
  } finally {
    readers.forEach((reader) => reader.dispose());
  }
};
