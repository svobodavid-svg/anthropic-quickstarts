// Copies the FFmpeg WebAssembly core into public/ffmpeg so the editor loads it from the
// same origin (no CDN dependency). Runs on postinstall and before dev/build.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "@ffmpeg", "core", "dist", "umd");
const target = join(root, "public", "ffmpeg");

if (!existsSync(source)) {
  console.warn("[copy-ffmpeg-core] @ffmpeg/core is not installed yet, skipping.");
  process.exit(0);
}

mkdirSync(target, { recursive: true });
for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFileSync(join(source, file), join(target, file));
}
console.log("[copy-ffmpeg-core] FFmpeg core copied to public/ffmpeg");
