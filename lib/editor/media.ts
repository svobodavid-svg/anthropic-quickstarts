import { newId, type Clip, type TextLayer } from "./types";

/** Read duration, size and a thumbnail from a video file. Rejects if the browser cannot decode it. */
export const createClip = (file: File): Promise<Clip> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Soubor ${file.name} se nepodařilo načíst`));
    };

    video.onerror = fail;
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0 || !video.videoWidth) {
        fail();
        return;
      }
      // Seek a little in so the thumbnail is not a black first frame.
      video.currentTime = Math.min(0.2, video.duration / 2);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const scale = 160 / Math.max(video.videoWidth, video.videoHeight);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

      const clip: Clip = {
        id: newId(),
        file,
        name: file.name,
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        thumbnail: canvas.toDataURL("image/jpeg", 0.7),
        trimStart: 0,
        trimEnd: video.duration,
        speed: 1,
        rotation: 0,
        volume: 1,
        muted: false,
      };
      URL.revokeObjectURL(url);
      resolve(clip);
    };

    video.src = url;
  });

/** Font size in output pixels for a text layer. */
export const textPixelSize = (layer: TextLayer, height: number) =>
  Math.max(8, Math.round((height * layer.size) / 100));

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  text.split("\n").forEach((paragraph) => {
    let line = "";
    paragraph.split(/\s+/).forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    lines.push(line);
  });
  return lines;
};

/**
 * Draw a text layer on a transparent canvas the size of the output frame.
 * Drawing with the browser keeps diacritics and the preview font identical to the export.
 */
export const drawTextLayer = (layer: TextLayer, width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas není k dispozici");

  const size = textPixelSize(layer, height);
  ctx.font = `${layer.italic ? "italic " : ""}${layer.bold ? "700" : "500"} ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = layer.align;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";

  const margin = Math.round(width * 0.06);
  const lines = wrapLines(ctx, layer.text, width - margin * 2);
  const lineHeight = size * 1.25;
  const blockHeight = lines.length * lineHeight;

  const x = layer.align === "left" ? margin : layer.align === "right" ? width - margin : width / 2;
  const top =
    layer.position === "top"
      ? height * 0.08
      : layer.position === "bottom"
      ? height * 0.92 - blockHeight
      : (height - blockHeight) / 2;

  lines.forEach((line, i) => {
    const y = top + lineHeight * (i + 0.5);
    // Dark outline keeps the text readable on any footage.
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = Math.max(2, size / 7);
    ctx.strokeText(line, x, y);
    ctx.fillStyle = layer.color;
    ctx.fillText(line, x, y);
  });

  return canvas;
};

/** The same text layer as PNG bytes, for the FFmpeg engine. */
export const renderTextImage = async (
  layer: TextLayer,
  width: number,
  height: number
): Promise<Uint8Array> => {
  const canvas = drawTextLayer(layer, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Text se nepodařilo vykreslit");
  return new Uint8Array(await blob.arrayBuffer());
};
