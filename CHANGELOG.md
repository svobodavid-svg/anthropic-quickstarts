# Changelog

## [1.5.2] - 2026-11-15

### Fixed
- Promptchan nevrací CORS hlavičky, takže prohlížeč (iPhone) volání zahodil. Všechna volání teď jdou přes vlastní relay `/api/pc/*` na serveru studia (klíč se posílá jen v požadavku, na serveru se neukládá; s Supabase jen pro pozvané).

## [1.5.1] - 2026-11-15

### Fixed
- Zůstatek gemů: když se účet nenačte, studio ukáže důvod a tlačítko „Zkusit znovu“ (dřív tiše zobrazilo 0).

## [1.5.0] - 2026-11-15

### Added
- Agent: nástroje `await_videos` (čeká na hotová videa) a `open_in_editor` (otevře výsledek ve zvoleném formátu); uložené šablony cílů; odhad gemů a potvrzení před během.
- Galerie: ukládání kopií do soukromého cloudu (volitelně automaticky u videí, odkazy se obnovují), hvězdička „nejlepší“ s filtrem Výběr, volba formátu editoru (Reels, YouTube, 4:5, 1:1).
- Dávkové generování obrázků (jeden prompt na řádek) s kontrolou odhadu gemů.
- Knihovna pojmenovaných AI postav.
- Editor: efekt „Vylepšit (odšum + ostrost)“ a předvolba „Upscale 4K + vylepšení“ (lokálně, bez gemů).

## [1.4.0] - 2026-11-15

### Added
- Záložka Agent: autonomní agent řízený Grokem (xAI). Plánuje a sám volá nástroje (účet, galerie, generování obrázků a videí přes Promptchan) s tvrdými limity na běh (počet obrázků/videí, max. 10 kroků).
- `/api/grok`: serverová proxy, klíč `XAI_API_KEY` zůstává na serveru; s Supabase pouští jen přihlášené pozvané uživatele. Model `XAI_MODEL` (výchozí `grok-4`).

## [1.3.0] - 2026-11-15

### Added
- Editor: import fotek (JPG/PNG/WebP) – foto se stane klipem (Ken Burns, 10 s, nastavitelná délka).
- AI Character: výběr uložené vygenerované osoby (`character_image_id`, v2/v3) pro nové obrázky i videa, galerie má „Použít jako postavu“.

## [1.2.0] - 2026-11-14

### Changed
- Promptchan client rewritten for API v2.1: video requests go to the video host
  (`film.aicloudnetservices.com`) and carry `video_model`; images use `model` instead of
  the deprecated `style`
- Image and video forms are built from the account's catalog (models, poses, filters,
  expressions, qualities, video options)
- Video progress is followed studio-wide and read as a 0-1 fraction

### Added
- Account plan and Gems balance, spoken video (v4-voice), animating a saved image,
  extending a finished video, saving images to the Promptchan gallery
- Czech messages for API error codes

### Fixed
- Inline (base64) images are no longer written to localStorage, which they overflowed

## [1.1.0] - 2026-11-14

### Added
- Video editor tab running FFmpeg (WebAssembly) in the browser, built around one
  non-destructive project and a single export:
  - timeline with multiple clips: add, reorder, split at the playhead, duplicate, delete
  - per-clip trim, speed (0.5x-2x), rotation, volume and mute
  - output format: aspect ratio (original, 16:9, 9:16, 1:1, 4:5), fill or fit,
    resolution from 480p to 4K, platform presets
  - transitions between clips (fade, dissolve, wipe, slide)
  - colour filters and effects burned into the export
  - text layers with position, size, colour and time window
  - music track with volume and fades, mixed with the original audio
  - clip from images (slideshow, Ken Burns, morphing) placed on the timeline
  - undo/redo, keyboard shortcuts (Space, S, Delete, Ctrl+Z, Ctrl+Shift+Z)
  - cancellable export with progress, result preview and download
  - fast cut without re-encoding when a single clip is only trimmed
- "Edit in editor" on generated videos and "Create video" on generated images
- WebCodecs export engine (Mediabunny) with automatic fallback to FFmpeg
- Automatic captions from speech (Whisper in the browser)
- Optional Supabase sign-in for invited users, cloud projects and invitations
- Project autosave to IndexedDB (timeline and source files survive a reload)
- Gallery persisted in localStorage; web app manifest and icons
- FFmpeg core served from the app itself (`public/ffmpeg`, copied on install)

### Changed
- Interface translated to Czech
- The editor stays mounted after its first visit so work survives tab switches

### Fixed
- Removed the `@shadcn/ui@^0.8.0` dependency, which does not exist on npm and made
  `npm install` fail

## [1.0.0] - 2026-07-06

### Added
- Initial release of Multimedia Studio
- Image generation with multiple styles, emotions, and filters
- Video generation with async processing and status tracking
- AI chat interface with customizable character profiles
- Gallery view for organizing generated content
- Settings panel for API key management and gems tracking
- Dark theme UI with Tailwind CSS
- TypeScript support for type safety
- Zustand store for state management
- Integration with Promptchan API for all multimedia generation
