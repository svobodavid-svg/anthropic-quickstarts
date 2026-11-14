import { Download, PlusSquare, X, Zap } from "lucide-react";
import { formatTime } from "@/lib/editor/types";
import ProgressBar from "./ProgressBar";
import { chip, heading, panel, primaryButton, secondaryButton } from "./ui";

export type Engine = "webcodecs" | "ffmpeg";

const ENGINE_LABEL = { webcodecs: "rychlý export", ffmpeg: "FFmpeg", copy: "bez překódování" } as const;

export interface ExportResult {
  url: string;
  filename: string;
  sizeBytes: number;
  seconds: number;
  engine: Engine | "copy";
}

interface ExportPanelProps {
  hasClips: boolean;
  duration: number;
  width: number;
  height: number;
  /** The project qualifies for a cut without re-encoding. */
  canStreamCopy: boolean;
  streamCopy: boolean;
  onStreamCopyChange: (enabled: boolean) => void;
  engine: Engine;
  webCodecsSupported: boolean;
  onEngineChange: (engine: Engine) => void;
  isProcessing: boolean;
  progress: number;
  result: ExportResult | null;
  onExport: () => void;
  onCancel: () => void;
  onUseResultAsClip: () => void;
}

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const ExportPanel = ({
  hasClips,
  duration,
  width,
  height,
  canStreamCopy,
  streamCopy,
  onStreamCopyChange,
  engine,
  webCodecsSupported,
  onEngineChange,
  isProcessing,
  progress,
  result,
  onExport,
  onCancel,
  onUseResultAsClip,
}: ExportPanelProps) => (
  <div className={panel}>
    <h3 className={heading}>Export</h3>

    <div className="grid grid-cols-2 gap-2 text-sm">
      <div className="p-3 rounded-lg bg-secondary/40">
        <p className="text-xs text-muted-foreground">Délka</p>
        <p className="font-medium">{formatTime(duration, true)}</p>
      </div>
      <div className="p-3 rounded-lg bg-secondary/40">
        <p className="text-xs text-muted-foreground">Rozlišení</p>
        <p className="font-medium">
          {width}×{height}
        </p>
      </div>
    </div>

    {canStreamCopy && (
      <label className="flex items-start gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={streamCopy}
          disabled={isProcessing}
          onChange={(e) => onStreamCopyChange(e.target.checked)}
          className="mt-0.5 accent-cyan-400"
        />
        <span className={streamCopy ? "text-primary" : "text-muted-foreground"}>
          <Zap className="inline w-3.5 h-3.5 mr-1" />
          Rychlý střih bez překódování: hotovo za pár sekund a beze ztráty kvality. Některé starší
          přehrávače mohou začít o zlomek sekundy dřív; pokud to vadí, volbu vypněte.
        </span>
      </label>
    )}
    {!(canStreamCopy && streamCopy) && (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onEngineChange("webcodecs")}
            disabled={!webCodecsSupported || isProcessing}
            aria-pressed={engine === "webcodecs" && webCodecsSupported}
            className={chip(engine === "webcodecs" && webCodecsSupported)}
          >
            Rychlý (WebCodecs)
          </button>
          <button
            onClick={() => onEngineChange("ffmpeg")}
            disabled={isProcessing}
            aria-pressed={engine === "ffmpeg" || !webCodecsSupported}
            className={chip(engine === "ffmpeg" || !webCodecsSupported)}
          >
            Kompatibilní (FFmpeg)
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {!webCodecsSupported
            ? "Tento prohlížeč rychlý export neumí, použije se FFmpeg. Nechte záložku otevřenou."
            : engine === "webcodecs"
            ? "Kóduje enkodér prohlížeče (hardwarově, kde to jde) a obraz odpovídá náhledu. Zrychlený klip má vyšší tón hlasu."
            : "Pomalejší, ale běží všude a u zrychlených klipů zachová výšku hlasu. Barvy filtrů se mírně liší od náhledu."}
        </p>
      </div>
    )}

    {isProcessing ? (
      <div className="space-y-3">
        <ProgressBar label="Renderuji..." progress={progress} />
        <button onClick={onCancel} className={`${secondaryButton} w-full`}>
          <X className="w-4 h-4" />
          Zrušit
        </button>
      </div>
    ) : (
      <button onClick={onExport} disabled={!hasClips} className={primaryButton}>
        <Download className="w-5 h-5" />
        Exportovat video
      </button>
    )}

    {result && !isProcessing && (
      <div className="space-y-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
        <video src={result.url} controls playsInline className="w-full max-h-64 rounded-lg bg-black" />
        <p className="text-xs text-muted-foreground">
          Hotovo za {result.seconds.toFixed(1)} s • {megabytes(result.sizeBytes)} • {ENGINE_LABEL[result.engine]}
        </p>
        <a href={result.url} download={result.filename} className={primaryButton}>
          <Download className="w-5 h-5" />
          Stáhnout MP4
        </a>
        <button onClick={onUseResultAsClip} className={`${secondaryButton} w-full`}>
          <PlusSquare className="w-4 h-4" />
          Vložit výsledek jako nový klip
        </button>
      </div>
    )}
  </div>
);

export default ExportPanel;
