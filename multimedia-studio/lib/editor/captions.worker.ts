/// <reference lib="webworker" />
import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

/**
 * Speech recognition in a Web Worker so the editor stays responsive. The Whisper model is
 * downloaded from the Hugging Face Hub on first use and cached by the browser.
 */

export interface CaptionRequest {
  audio: Float32Array; // 16 kHz mono
  model: string;
  language: string | null; // null = detect
}

export type CaptionEvent =
  | { type: "download"; percent: number }
  | { type: "transcribing" }
  | { type: "done"; chunks: { start: number; end: number | null; text: string }[] }
  | { type: "error"; message: string };

const post = (event: CaptionEvent) => (self as DedicatedWorkerGlobalScope).postMessage(event);

let loaded: { model: string; run: AutomaticSpeechRecognitionPipeline } | null = null;

self.onmessage = async ({ data }: MessageEvent<CaptionRequest>) => {
  try {
    if (loaded?.model !== data.model) {
      const run = await pipeline("automatic-speech-recognition", data.model, {
        dtype: "q8",
        progress_callback: (info) => {
          if (info.status === "progress" && info.file.endsWith(".onnx")) {
            post({ type: "download", percent: Math.round(info.progress) });
          }
        },
      });
      loaded = { model: data.model, run };
    }

    post({ type: "transcribing" });
    const output = await loaded.run(data.audio, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      task: "transcribe",
      ...(data.language ? { language: data.language } : {}),
    });

    const result = Array.isArray(output) ? output[0] : output;
    post({
      type: "done",
      chunks: (result.chunks ?? []).map((chunk: { timestamp: [number, number | null]; text: string }) => ({
        start: chunk.timestamp[0],
        end: chunk.timestamp[1],
        text: chunk.text.trim(),
      })),
    });
  } catch (error) {
    post({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
