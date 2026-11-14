import { RotateCw, Volume2, VolumeX } from "lucide-react";
import { SPEEDS, formatTime, type Clip, type Rotation } from "@/lib/editor/types";
import { clipLength } from "@/lib/editor/render";
import { rangeClass } from "./ProgressBar";
import { chip, heading, iconButton, panel } from "./ui";

interface ClipPanelProps {
  clip: Clip;
  onChange: (patch: Partial<Clip>, coalesceKey?: string) => void;
  /** Move the preview to a source time so the user sees the frame they are cutting on. */
  onScrub: (sourceTime: number) => void;
}

const MIN_LENGTH = 0.3;

const ClipPanel = ({ clip, onChange, onScrub }: ClipPanelProps) => (
  <div className={panel}>
    <div className="flex items-center justify-between">
      <h3 className={heading}>Střih klipu</h3>
      <span className="text-xs text-primary font-medium">Délka: {formatTime(clipLength(clip), true)}</span>
    </div>

    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Začátek</span>
        <span className="text-foreground font-medium">{formatTime(clip.trimStart, true)}</span>
      </div>
      <input
        type="range"
        aria-label="Začátek střihu"
        min={0}
        max={clip.duration}
        step={0.05}
        value={clip.trimStart}
        onChange={(e) => {
          const value = Math.min(parseFloat(e.target.value), clip.trimEnd - MIN_LENGTH);
          onChange({ trimStart: Math.max(0, value) }, "trimStart");
          onScrub(Math.max(0, value));
        }}
        className={rangeClass}
      />
    </div>

    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Konec</span>
        <span className="text-foreground font-medium">{formatTime(clip.trimEnd, true)}</span>
      </div>
      <input
        type="range"
        aria-label="Konec střihu"
        min={0}
        max={clip.duration}
        step={0.05}
        value={clip.trimEnd}
        onChange={(e) => {
          const value = Math.max(parseFloat(e.target.value), clip.trimStart + MIN_LENGTH);
          onChange({ trimEnd: Math.min(clip.duration, value) }, "trimEnd");
          onScrub(Math.min(clip.duration, value));
        }}
        className={rangeClass}
      />
    </div>

    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Rychlost</p>
      <div className="flex flex-wrap gap-2">
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => onChange({ speed })}
            aria-pressed={clip.speed === speed}
            className={chip(clip.speed === speed)}
          >
            {speed}×
          </button>
        ))}
      </div>
    </div>

    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange({ rotation: ((clip.rotation + 90) % 360) as Rotation })}
        className={`${iconButton} flex items-center gap-1.5 text-xs font-medium`}
      >
        <RotateCw className="w-4 h-4" />
        Otočit ({clip.rotation}°)
      </button>

      <button
        onClick={() => onChange({ muted: !clip.muted })}
        aria-label={clip.muted ? "Zapnout zvuk klipu" : "Ztlumit klip"}
        aria-pressed={clip.muted}
        className={iconButton}
      >
        {clip.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>
      <input
        type="range"
        aria-label="Hlasitost klipu"
        min={0}
        max={2}
        step={0.05}
        value={clip.muted ? 0 : clip.volume}
        disabled={clip.muted}
        onChange={(e) => onChange({ volume: parseFloat(e.target.value) }, "volume")}
        className={`${rangeClass} flex-1 disabled:opacity-40`}
      />
      <span className="w-10 text-right text-xs text-muted-foreground">
        {clip.muted ? "0" : Math.round(clip.volume * 100)}%
      </span>
    </div>
  </div>
);

export default ClipPanel;
