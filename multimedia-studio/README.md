# 🎬 Multimedia Studio

A complete multimedia creation platform powered by the Promptchan API. Generate stunning images and videos with AI, and chat with intelligent companions.

## Features

- **🖼️ Image Generation**: Create beautiful images with customizable styles, emotions, and filters
- **🎥 Video Generation**: Generate dynamic videos with async processing and status tracking
- **✂️ Video Editor**: Trim, merge and upscale videos and turn images into videos, all in the browser with FFmpeg (WebAssembly)
- **💬 AI Chat**: Engage with AI companions with customizable personalities
- **📚 Gallery**: Organized gallery for your generated content
- **⚙️ Settings**: Easy API key management and gems tracking

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Promptchan API key from [promptchan.com/settings](https://promptchan.com/settings)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## API Configuration

1. Sign up at [promptchan.com/signup](https://promptchan.com/signup)
2. Generate an API key at [promptchan.com/settings](https://promptchan.com/settings)
3. Purchase gems at [promptchan.com/gems](https://promptchan.com/gems)
4. Enter your API key in the studio settings

## Usage

### Image Generation

1. Navigate to the **Images** tab
2. Enter a detailed prompt
3. Customize style, emotion, and filter
4. Select quality level (Ultra/Extreme/Max)
5. Click **Generate Image**

### Video Generation

1. Navigate to the **Videos** tab
2. Enter a video description
3. Choose style and aspect ratio
4. Enable audio if needed
5. Click **Generate Video**
6. Video will start processing and track progress

### Chat

1. Navigate to the **Chat** tab
2. Optionally set a character name and personality
3. Start chatting with the AI companion
4. Messages are saved in the conversation history

## Project Structure

```
multimedia-studio/
├── app/
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Main studio page
├── components/
│   ├── Settings.tsx     # API key and settings
│   ├── ImageGenerator.tsx
│   ├── VideoGenerator.tsx
│   ├── ChatInterface.tsx
│   └── Gallery.tsx      # Gallery view
├── lib/
│   ├── promptchan-client.ts  # API client
│   └── store.ts              # Zustand store
├── styles/
│   └── globals.css      # Tailwind styles
└── public/
```

## Technologies

- **Next.js 14**: Full-stack React framework
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Zustand**: State management
- **Axios**: HTTP client

## API Endpoints

All requests require the `x-api-key` header with your Promptchan API key.

### Image Generation
`POST /api/external/create`

### Video Generation
- Submit: `POST /api/external/video_v4/submit`
- Status: `GET /api/external/video_v4/status_with_logs/{request_id}`
- Result: `GET /api/external/video_v4/result/{request_id}`

### Chat
`POST /api/external/chat`

## Billing

Each image/video generation costs gems:
- **Image**: 1 gem per generation (+ extra gems for Extreme/Max quality)
- **Video**: Varies by style and parameters
- **Chat**: Included in your account access

## License

MIT

## Video Editor

The **Editor** tab is a small non-linear editor. Media is processed locally in the
browser with [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm); nothing is uploaded.
Edits are non-destructive and rendered once, on export.

| Tool | What it does |
| --- | --- |
| Časová osa | Add several videos, reorder, split at the playhead, duplicate, delete |
| Klip | Trim, speed 0.5x-2x, rotate, volume / mute for the selected clip |
| Formát | Aspect ratio, fill or fit, resolution (480p-4K), presets, transitions |
| Vzhled | Colour filters and effects, burned into the export |
| Text | Text layers with position, size, colour and a time window; automatic captions from speech |
| Hudba | Music track with volume and fades; original audio volume |
| Z obrázků | Builds a clip from 2+ images and puts it on the timeline |
| Export | One render to MP4 (H.264 + AAC), cancellable, with preview and download |
| Cloud | Save and open projects in Supabase; admins manage invitations |

Shortcuts: `Space` play/pause, `S` split, `Delete` remove clip, `Ctrl+Z` / `Ctrl+Shift+Z`.

Code map: `lib/editor/render.ts` turns a project into one FFmpeg command (pure function),
`lib/editor/types.ts` holds the project model and presets, `hooks/useProject.ts` the
undo/redo state, `hooks/useFFmpeg.ts` the FFmpeg worker, `lib/editor/storage.ts` the autosave.

### Export engines

- **Rychlý (WebCodecs)**, the default where supported: frames are decoded by the browser,
  composited on a canvas and encoded by the platform encoder through
  [Mediabunny](https://mediabunny.dev). The picture matches the preview. Where the browser
  cannot encode AAC (Chrome on Linux), the audio mix is encoded by FFmpeg and muxed in.
  Speeding a clip up raises the pitch of its audio.
- **Kompatibilní (FFmpeg)**: everything in ffmpeg.wasm. Slower, runs everywhere, keeps the
  pitch of sped-up audio. Used automatically if the fast engine is unavailable or fails.
- A single clip that is only trimmed is cut without re-encoding (can be switched off).

In the test run (headless Chrome, software encoder) a 5.5 s 720x1280 project with every
effect took 22 s with WebCodecs and 56 s with FFmpeg.

### Automatic captions

"Vytvořit titulky z řeči" in the Text tool runs Whisper in the browser with
[Transformers.js](https://huggingface.co/docs/transformers.js). The model
(`onnx-community/whisper-base` or `whisper-small`) is downloaded from the Hugging Face Hub
on first use and cached; the audio never leaves the device. Each recognised phrase becomes
an editable text layer. This path could not be exercised end to end in the build
environment (the model host was unreachable), so treat it as untested until it has run once.

### Accounts and cloud projects (optional)

Copy `.env.example` to `.env.local` and fill in the Supabase URL and publishable key. The
studio then requires sign-in, and only e-mails listed in `allowed_emails` get in.
`supabase/migrations/` holds the schema: `allowed_emails`, `projects` and the private
`editor-media` bucket, all behind row-level security. Add the first administrator once:

```sql
insert into public.allowed_emails (email, is_admin) values ('you@example.com', true);
```

Administrators invite others from the Cloud tool. Invited people create their own account
with the same e-mail; no invitation e-mail is sent. Without `.env.local` the studio runs in
local mode with no accounts.

Notes and limits:

- The FFmpeg core (~32 MB) is copied from `node_modules/@ffmpeg/core` to `public/ffmpeg`
  by `scripts/copy-ffmpeg-core.mjs` on install, dev and build. It is not committed.
- The FFmpeg engine is single-threaded WebAssembly: slow on phones, and 1440p / 4K output
  can run out of memory.
- "Higher resolution than the source" is plain lanczos scaling, not AI upscaling.
- The preview is an approximation: it plays clips one after another without transitions,
  shows filters with CSS, and does not play the music track.
- The current project, including its source files, is autosaved to IndexedDB on this
  device and reopened on the next visit. It is not synced anywhere; clearing browser data
  removes it. "Nový projekt" in the editor header starts over.
- Gallery hand-off downloads the generated file in the browser. If the file host does not
  send CORS headers the editor says so; download the file and load it manually.

Not implemented yet: server-side API key, AI upscaling, password reset screen.
