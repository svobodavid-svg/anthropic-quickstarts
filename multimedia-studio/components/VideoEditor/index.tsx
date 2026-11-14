'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePlus2, Redo2, Undo2, Upload } from "lucide-react";
import Preview from "./Preview";
import ClipStrip from "./ClipStrip";
import ToolBar, { type ToolId } from "./ToolBar";
import ClipPanel from "./ClipPanel";
import FormatPanel from "./FormatPanel";
import LookPanel from "./LookPanel";
import TextPanel from "./TextPanel";
import MusicPanel from "./MusicPanel";
import GeneratePanel from "./GeneratePanel";
import CloudPanel from "./CloudPanel";
import ExportPanel, { type Engine, type ExportResult } from "./ExportPanel";
import { toast, EditorToaster } from "./toast";
import { iconButton } from "./ui";
import { RenderCancelled, useFFmpeg, type EffectType } from "@/hooks/useFFmpeg";
import { canSplit, useProject } from "@/hooks/useProject";
import { createClip, renderTextImage } from "@/lib/editor/media";
import {
  assignFileNames,
  buildRenderPlan,
  canStreamCopy,
  clipOffsets,
  outputSize,
  totalDuration,
} from "@/lib/editor/render";
import { clearProject, loadProject, saveProject } from "@/lib/editor/storage";
import { generateCaptions } from "@/lib/editor/captions";
import { detectWebCodecs, renderWithWebCodecs, type WebCodecsSupport } from "@/lib/editor/webcodecs";
import { useStudio } from "@/lib/store";

/** Download a remote asset (e.g. a generated video) into a File the editor can process. */
const fetchAsFile = async (url: string, name: string, fallbackType: string): Promise<File> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || fallbackType });
};

const CORS_HINT = "Server nepovolil stažení z prohlížeče. Stáhněte soubor a nahrajte ho ručně.";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);

const VideoEditor = () => {
  const api = useProject();
  const { project, update, select, addClips, updateClip } = api;
  const ffmpeg = useFFmpeg();
  const { loadFFmpeg, render, muxAudio, generateVideoFromImages } = ffmpeg;
  const { editorVideoUrl, editorImageUrls, clearEditorHandoff } = useStudio();

  const [activeTool, setActiveTool] = useState<ToolId>("clip");
  const [isPlaying, setIsPlaying] = useState(false);
  const [sourceTime, setSourceTime] = useState(0);
  const [incomingImages, setIncomingImages] = useState<File[]>([]);
  const [result, setResult] = useState<(ExportResult & { blob: Blob }) | null>(null);
  const [fastCut, setFastCut] = useState(true);
  const [engine, setEngine] = useState<Engine>("webcodecs");
  const [webCodecs, setWebCodecs] = useState<WebCodecsSupport>({ supported: false, nativeAudio: false });
  const [fastRender, setFastRender] = useState<{ progress: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isProcessing = ffmpeg.isProcessing || fastRender !== null;
  const progress = fastRender && !ffmpeg.isProcessing ? fastRender.progress : fastRender ? 97 : ffmpeg.progress;

  const videoRef = useRef<HTMLVideoElement>(null);
  const playingRef = useRef(false);
  playingRef.current = isPlaying;

  const clipIndex = project.clips.findIndex((clip) => clip.id === project.selectedClipId);
  const clip = clipIndex >= 0 ? project.clips[clipIndex] : null;

  const size = useMemo(() => outputSize(project), [project]);
  const duration = useMemo(() => totalDuration(project), [project]);
  const offsets = useMemo(() => clipOffsets(project), [project]);
  const timelineTime = clip
    ? Math.max(0, offsets[clipIndex] + (sourceTime - clip.trimStart) / clip.speed)
    : 0;

  useEffect(() => {
    let active = true;
    detectWebCodecs(size.width, size.height).then((support) => active && setWebCodecs(support));
    return () => {
      active = false;
    };
  }, [size.width, size.height]);

  // --- Persistence ------------------------------------------------------------------------

  // Open the project saved on this device, then keep saving edits (debounced).
  const [restored, setRestored] = useState(false);
  const { reset } = api;
  useEffect(() => {
    let active = true;
    loadProject().then((saved) => {
      if (!active) return;
      if (saved && saved.clips.length > 0) reset(saved);
      setRestored(true);
    });
    return () => {
      active = false;
    };
  }, [reset]);

  const saveWarned = useRef(false);
  useEffect(() => {
    if (!restored) return;
    const timer = setTimeout(async () => {
      const ok = await saveProject(project);
      if (!ok && !saveWarned.current) {
        saveWarned.current = true;
        toast({
          title: "Projekt se neukládá",
          description: "Prohlížeč odmítl uložení (anonymní okno nebo plné úložiště). Po zavření stránky o práci přijdete.",
          variant: "destructive",
        });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [project, restored]);

  const handleNewProject = useCallback(() => {
    if (project.clips.length > 0 && !window.confirm("Začít nový projekt? Časová osa se vymaže.")) return;
    setIsPlaying(false);
    setResult(null);
    reset();
    clearProject();
  }, [project.clips.length, reset]);

  // Warm up FFmpeg in the background; editing does not wait for it.
  useEffect(() => {
    loadFFmpeg().catch(() => undefined);
  }, [loadFFmpeg]);

  // One object URL per source file, released when the editor unmounts.
  const urls = useRef(new Map<File, string>());
  const urlFor = (file: File) => {
    let url = urls.current.get(file);
    if (!url) {
      url = URL.createObjectURL(file);
      urls.current.set(file, url);
    }
    return url;
  };
  useEffect(() => {
    const cache = urls.current;
    return () => cache.forEach((url) => URL.revokeObjectURL(url));
  }, []);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result]
  );

  const src = clip ? urlFor(clip.file) : "";

  // --- Preview playback -------------------------------------------------------------------

  const cueClip = useCallback(() => {
    const video = videoRef.current;
    if (!video || !clip) return;
    video.currentTime = clip.trimStart;
    setSourceTime(clip.trimStart);
    if (playingRef.current) video.play().catch(() => undefined);
    // Only re-cue when a different clip is selected, not on every trim change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.id]);

  useEffect(() => {
    const video = videoRef.current;
    // Same source file (e.g. after a split): the element is already loaded, cue now.
    // A new source cues from onLoadedMetadata instead.
    if (video && video.readyState >= 1) cueClip();
  }, [cueClip, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip) return;
    video.playbackRate = clip.speed;
    video.muted = clip.muted;
    video.volume = Math.max(0, Math.min(1, clip.volume * project.originalVolume));
  }, [clip, project.originalVolume]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) video.play().catch(() => setIsPlaying(false));
    else video.pause();
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (!clip) return;
      setSourceTime(time);
      if (time < clip.trimEnd - 0.03) return;

      const next = project.clips[clipIndex + 1];
      if (playingRef.current && next) {
        select(next.id); // playback continues into the next clip
      } else {
        setIsPlaying(false);
        if (videoRef.current) videoRef.current.currentTime = clip.trimStart;
      }
    },
    [clip, clipIndex, project.clips, select]
  );

  const scrub = useCallback((time: number) => {
    setIsPlaying(false);
    if (videoRef.current) videoRef.current.currentTime = time;
    setSourceTime(time);
  }, []);

  // --- Media in ---------------------------------------------------------------------------

  const addFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const results = await Promise.allSettled(files.map(createClip));
      const clips = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      addClips(clips);

      const failed = results.length - clips.length;
      if (failed > 0) {
        toast({
          title: `Nepodařilo se načíst ${failed} ${failed === 1 ? "soubor" : "souborů"}`,
          description: "Prohlížeč tento formát neumí přehrát. Zkuste MP4 (H.264).",
          variant: "destructive",
        });
      }
    },
    [addClips]
  );

  // Media handed over from the studio gallery.
  useEffect(() => {
    if (!editorVideoUrl && editorImageUrls.length === 0) return;
    const videoToLoad = editorVideoUrl;
    const imagesToLoad = editorImageUrls;
    clearEditorHandoff();

    if (videoToLoad) {
      setActiveTool("clip");
      fetchAsFile(videoToLoad, `studio-video-${Date.now()}.mp4`, "video/mp4")
        .then((file) => addFiles([file]))
        .catch(() =>
          toast({ title: "Video se nepodařilo načíst", description: CORS_HINT, variant: "destructive" })
        );
    }

    if (imagesToLoad.length > 0) {
      setActiveTool("images");
      Promise.allSettled(
        imagesToLoad.map((url, i) => fetchAsFile(url, `studio-image-${i + 1}.png`, "image/png"))
      ).then((results) => {
        const files = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
        if (files.length > 0) setIncomingImages(files);
        if (files.length < imagesToLoad.length) {
          toast({
            title: `Nepodařilo se načíst ${imagesToLoad.length - files.length} obrázků`,
            description: CORS_HINT,
            variant: "destructive",
          });
        }
      });
    }
  }, [editorVideoUrl, editorImageUrls, clearEditorHandoff, addFiles]);

  const reportFailure = useCallback((error: unknown, title: string) => {
    if (error instanceof RenderCancelled) {
      toast({ title: "Zrušeno" });
      return;
    }
    toast({
      title,
      description: "Zkuste nižší rozlišení nebo kratší video; prohlížeči mohla dojít paměť.",
      variant: "destructive",
    });
  }, []);

  const handleGenerate = useCallback(
    async (images: File[], effect: EffectType, imageDuration: number, transitionDuration: number) => {
      try {
        const blob = await generateVideoFromImages(images, effect, imageDuration, transitionDuration);
        await addFiles([new File([blob], `obrazky-${effect}-${Date.now()}.mp4`, { type: "video/mp4" })]);
        setActiveTool("clip");
        toast({ title: "Klip vytvořen", description: "Najdete ho na konci časové osy." });
      } catch (error) {
        reportFailure(error, "Klip se nepodařilo vytvořit");
      }
    },
    [generateVideoFromImages, addFiles, reportFailure]
  );

  // --- Export -----------------------------------------------------------------------------

  const renderWithFFmpeg = useCallback(() => {
    const fileNames = assignFileNames(project);
    const { width, height } = outputSize(project);
    return render(fileNames, totalDuration(project), async (hasAudio) => {
      const textImages = await Promise.all(
        project.texts.map((layer) => renderTextImage(layer, width, height))
      );
      return buildRenderPlan(project, { fileNames, hasAudio, textImages }, { allowStreamCopy: fastCut });
    });
  }, [project, render, fastCut]);

  const renderFast = useCallback(async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setFastRender({ progress: 0 });
    try {
      const { video, wav } = await renderWithWebCodecs(project, {
        nativeAudio: webCodecs.nativeAudio,
        signal: controller.signal,
        onProgress: (value) => setFastRender({ progress: value }),
      });
      // Browsers without an AAC encoder hand the audio mix to FFmpeg (audio only, quick).
      return wav ? await muxAudio(video, wav) : video;
    } finally {
      abortRef.current = null;
      setFastRender(null);
    }
  }, [project, webCodecs.nativeAudio, muxAudio]);

  const streamCopy = project.clips.length > 0 && canStreamCopy(project) && fastCut;
  const fastEngine = engine === "webcodecs" && webCodecs.supported && !streamCopy;

  const handleExport = useCallback(async () => {
    if (project.clips.length === 0) return;
    setIsPlaying(false);
    const started = performance.now();

    try {
      let blob: Blob;
      let used: Engine = fastEngine ? "webcodecs" : "ffmpeg";
      if (fastEngine) {
        try {
          blob = await renderFast();
        } catch (error) {
          if (error instanceof RenderCancelled) throw error;
          console.error("WebCodecs export failed, falling back to FFmpeg:", error);
          toast({ title: "Rychlý export selhal", description: "Zkouším kompatibilní export přes FFmpeg." });
          used = "ffmpeg";
          blob = await renderWithFFmpeg();
        }
      } else {
        blob = await renderWithFFmpeg();
      }

      setResult({
        blob,
        url: URL.createObjectURL(blob),
        filename: `studio-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.mp4`,
        sizeBytes: blob.size,
        seconds: (performance.now() - started) / 1000,
        engine: streamCopy ? "copy" : used,
      });
      toast({ title: "Export hotový", description: "Video si můžete přehrát a stáhnout." });
    } catch (error) {
      reportFailure(error, "Export se nepodařil");
    }
  }, [project.clips.length, fastEngine, streamCopy, renderFast, renderWithFFmpeg, reportFailure]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    if (ffmpeg.isProcessing) ffmpeg.cancel();
  }, [ffmpeg]);

  const useResultAsClip = useCallback(() => {
    if (!result) return;
    addFiles([new File([result.blob], result.filename, { type: "video/mp4" })]);
    setActiveTool("clip");
  }, [result, addFiles]);

  // --- Captions --------------------------------------------------------------------------

  const [captionStatus, setCaptionStatus] = useState<string | null>(null);
  const captionAbort = useRef<AbortController | null>(null);

  const handleGenerateCaptions = useCallback(
    async (model: string, language: string | null) => {
      const controller = new AbortController();
      captionAbort.current = controller;
      setCaptionStatus("Připravuji zvuk...");
      try {
        const layers = await generateCaptions(project, model, language, controller.signal, (state) =>
          setCaptionStatus(
            state.stage === "download"
              ? `Stahuji model... ${state.percent ?? 0}%`
              : state.stage === "transcribing"
              ? "Rozpoznávám řeč..."
              : "Připravuji zvuk..."
          )
        );
        if (layers.length === 0) {
          toast({ title: "Žádná řeč nenalezena", description: "V nahrávce se nepodařilo rozpoznat slova." });
        } else {
          update((p) => ({ ...p, texts: [...p.texts, ...layers] }));
          toast({ title: `Přidáno ${layers.length} titulků`, description: "Zkontrolujte a upravte je v seznamu textů." });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Captions failed:", error);
          toast({
            title: "Titulky se nepodařilo vytvořit",
            description: "Model se nestáhl nebo ho prohlížeč nespustil. Zkontrolujte připojení a zkuste menší model.",
            variant: "destructive",
          });
        }
      } finally {
        captionAbort.current = null;
        setCaptionStatus(null);
      }
    },
    [project, update]
  );

  // --- Editing shortcuts ------------------------------------------------------------------

  const splitAllowed = !!clip && canSplit(clip, sourceTime);
  const handleSplit = useCallback(() => {
    if (clip && canSplit(clip, sourceTime)) api.splitClip(clip.id, sourceTime);
  }, [api, clip, sourceTime]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The editor stays mounted while hidden behind another studio tab.
      if (isTyping(e.target) || !videoRef.current?.offsetParent) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) api.redo();
        else api.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        api.redo();
      } else if (e.key === " ") {
        e.preventDefault();
        setIsPlaying((playing) => !playing);
      } else if (e.key.toLowerCase() === "s" && !mod) {
        handleSplit();
      } else if (e.key === "Delete" && clip && !isProcessing) {
        api.removeClip(clip.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, clip, handleSplit, isProcessing]);

  // --- Render -----------------------------------------------------------------------------

  const renderPanel = () => {
    switch (activeTool) {
      case "clip":
        return clip ? (
          <ClipPanel
            clip={clip}
            onChange={(patch, key) => updateClip(clip.id, patch, key)}
            onScrub={scrub}
          />
        ) : (
          <p className="glass-panel p-4 text-sm text-muted-foreground">
            Přidejte video na časovou osu, nebo vytvořte klip z obrázků.
          </p>
        );
      case "format":
        return (
          <FormatPanel
            project={project}
            width={size.width}
            height={size.height}
            onChange={(patch, key) => update((p) => ({ ...p, ...patch }), key)}
          />
        );
      case "look":
        return (
          <LookPanel
            look={project.look}
            effects={project.effects}
            onLookChange={(look) => update((p) => ({ ...p, look }))}
            onEffectToggle={(id) =>
              update((p) => ({
                ...p,
                effects: p.effects.includes(id) ? p.effects.filter((e) => e !== id) : [...p.effects, id],
              }))
            }
          />
        );
      case "text":
        return (
          <TextPanel
            texts={project.texts}
            duration={duration}
            timelineTime={timelineTime}
            onAdd={(layer) => update((p) => ({ ...p, texts: [...p.texts, layer] }))}
            onChange={(id, patch, key) =>
              update(
                (p) => ({ ...p, texts: p.texts.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),
                key ? `text:${id}:${key}` : undefined
              )
            }
            onRemove={(id) => update((p) => ({ ...p, texts: p.texts.filter((t) => t.id !== id) }))}
            captionStatus={captionStatus}
            onGenerateCaptions={handleGenerateCaptions}
            onCancelCaptions={() => captionAbort.current?.abort()}
          />
        );
      case "music":
        return (
          <MusicPanel
            music={project.music}
            originalVolume={project.originalVolume}
            onMusicChange={(music, key) => update((p) => ({ ...p, music }), key)}
            onOriginalVolumeChange={(originalVolume) =>
              update((p) => ({ ...p, originalVolume }), "original-volume")
            }
          />
        );
      case "export":
        return (
          <ExportPanel
            hasClips={project.clips.length > 0}
            duration={duration}
            width={size.width}
            height={size.height}
            canStreamCopy={project.clips.length > 0 && canStreamCopy(project)}
            streamCopy={fastCut}
            onStreamCopyChange={setFastCut}
            engine={engine}
            webCodecsSupported={webCodecs.supported}
            onEngineChange={setEngine}
            isProcessing={isProcessing}
            progress={progress}
            result={result}
            onExport={handleExport}
            onCancel={cancel}
            onUseResultAsClip={useResultAsClip}
          />
        );
      case "cloud":
        return (
          <CloudPanel
            project={project}
            disabled={isProcessing}
            onOpen={(opened) => {
              setIsPlaying(false);
              setResult(null);
              reset(opened);
            }}
          />
        );
      default:
        return null;
    }
  };

  const uploadRef = useRef<HTMLInputElement>(null);

  return (
    <div className="video-editor rounded-2xl bg-background text-foreground p-3 sm:p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)] lg:items-start max-w-6xl mx-auto">
        {/* Left: preview and timeline */}
        <div className="flex flex-col gap-4 min-w-0">
          <header className="flex items-center justify-between px-4 py-2.5 glass-panel">
            <h2 className="text-lg font-semibold glow-text">Video Editor</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewProject}
                disabled={isProcessing || project.clips.length === 0}
                aria-label="Nový projekt"
                title="Nový projekt"
                className={iconButton}
              >
                <FilePlus2 className="w-4 h-4" />
              </button>
              <button onClick={api.undo} disabled={!api.canUndo} aria-label="Zpět" title="Zpět (Ctrl+Z)" className={iconButton}>
                <Undo2 className="w-4 h-4" />
              </button>
              <button onClick={api.redo} disabled={!api.canRedo} aria-label="Znovu" title="Znovu (Ctrl+Shift+Z)" className={iconButton}>
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
          </header>

          {clip ? (
            <Preview
              ref={videoRef}
              project={project}
              clip={clip}
              src={src}
              width={size.width}
              height={size.height}
              isPlaying={isPlaying}
              timelineTime={timelineTime}
              duration={duration}
              onPlayPause={() => setIsPlaying((playing) => !playing)}
              onTimeUpdate={handleTimeUpdate}
              onLoaded={cueClip}
            />
          ) : (
            <div className="min-h-[30vh] flex items-center justify-center">
              <input
                ref={uploadRef}
                type="file"
                accept="video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(Array.from(e.target.files ?? []));
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => uploadRef.current?.click()}
                className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-primary/10 border-2 border-dashed
                           border-primary/30 hover:border-primary/50 hover:bg-primary/20 transition-all"
              >
                <div className="p-3 rounded-full bg-primary/20">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">Nahrát video</p>
                  <p className="text-sm text-muted-foreground">Jedno nebo více, MP4 / MOV / WebM</p>
                </div>
              </button>
            </div>
          )}

          <ClipStrip
            clips={project.clips}
            selectedId={project.selectedClipId}
            totalDuration={duration}
            canSplit={splitAllowed}
            disabled={isProcessing}
            onSelect={select}
            onAddFiles={addFiles}
            onMove={(direction) => clip && api.moveClip(clip.id, direction)}
            onSplit={handleSplit}
            onDuplicate={() => clip && api.duplicateClip(clip.id)}
            onRemove={() => clip && api.removeClip(clip.id)}
          />
        </div>

        {/* Right: tools */}
        <div className="flex flex-col gap-4 min-w-0">
          <ToolBar activeTool={activeTool} onToolSelect={setActiveTool} />

          {/* The images panel stays mounted so picked images survive tool switches. */}
          <div className={activeTool === "images" ? "" : "hidden"}>
            <GeneratePanel
              onGenerate={handleGenerate}
              isProcessing={isProcessing}
              progress={progress}
              incomingImages={incomingImages}
            />
          </div>
          {renderPanel()}
        </div>
      </div>

      <EditorToaster />
    </div>
  );
};

export default VideoEditor;
