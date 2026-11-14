import type { CaptionEvent, CaptionRequest } from "./captions.worker";
import { totalDuration } from "./render";
import { newId, type Project, type TextLayer } from "./types";
import { renderAudio } from "./webcodecs";

export const CAPTION_MODELS = [
  { id: "onnx-community/whisper-base", label: "Rychlý (≈80 MB)" },
  { id: "onnx-community/whisper-small", label: "Přesnější (≈250 MB)" },
] as const;

export const CAPTION_LANGUAGES = [
  { id: "czech", label: "Čeština" },
  { id: "slovak", label: "Slovenština" },
  { id: "english", label: "Angličtina" },
  { id: null, label: "Rozpoznat" },
] as const;

export interface CaptionProgress {
  stage: "audio" | "download" | "transcribing";
  percent?: number;
}

const MAX_CAPTION_SECONDS = 6;

/**
 * Transcribe the speech on the timeline and return one text layer per phrase. Runs
 * entirely in the browser; nothing is uploaded.
 */
export const generateCaptions = async (
  project: Project,
  model: string,
  language: string | null,
  signal: AbortSignal,
  onProgress: (progress: CaptionProgress) => void
): Promise<TextLayer[]> => {
  const duration = totalDuration(project);
  onProgress({ stage: "audio" });
  // Whisper expects 16 kHz mono. The mix follows the timeline, so timestamps line up.
  const mix = await renderAudio(project, signal, { sampleRate: 16000, channels: 1, speechOnly: true });
  const audio = mix.getChannelData(0).slice();

  const worker = new Worker(new URL("./captions.worker.ts", import.meta.url), { type: "module" });
  try {
    const chunks = await new Promise<Extract<CaptionEvent, { type: "done" }>["chunks"]>((resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("Zrušeno", "AbortError")));
      worker.onerror = (event) => reject(new Error(event.message || "Model se nepodařilo spustit"));
      worker.onmessage = ({ data }: MessageEvent<CaptionEvent>) => {
        if (data.type === "download") onProgress({ stage: "download", percent: data.percent });
        else if (data.type === "transcribing") onProgress({ stage: "transcribing" });
        else if (data.type === "done") resolve(data.chunks);
        else reject(new Error(data.message));
      };
      const request: CaptionRequest = { audio, model, language };
      worker.postMessage(request, [audio.buffer]);
    });

    return chunks
      .filter((chunk) => chunk.text.length > 0 && chunk.start < duration)
      .map((chunk) => ({
        id: newId(),
        text: chunk.text,
        align: "center" as const,
        bold: true,
        italic: false,
        color: "#ffffff",
        size: 5,
        position: "bottom" as const,
        start: chunk.start,
        end: Math.min(duration, chunk.end ?? chunk.start + MAX_CAPTION_SECONDS, chunk.start + MAX_CAPTION_SECONDS),
      }));
  } finally {
    worker.terminate();
  }
};
