import { useRef } from "react";
import { Music2, Trash2, Upload } from "lucide-react";
import type { MusicTrack } from "@/lib/editor/types";
import { rangeClass } from "./ProgressBar";
import { heading, iconButton, panel, secondaryButton } from "./ui";

interface MusicPanelProps {
  music: MusicTrack | null;
  originalVolume: number;
  onMusicChange: (music: MusicTrack | null, coalesceKey?: string) => void;
  onOriginalVolumeChange: (volume: number) => void;
}

const Slider = ({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span>{display}</span>
    </div>
    <input
      type="range"
      aria-label={label}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={rangeClass}
    />
  </div>
);

const MusicPanel = ({ music, originalVolume, onMusicChange, onOriginalVolumeChange }: MusicPanelProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={panel}>
      <h3 className={heading}>Zvuk</h3>

      <Slider
        label="Hlasitost původního zvuku"
        value={originalVolume}
        min={0}
        max={2}
        step={0.05}
        display={`${Math.round(originalVolume * 100)}%`}
        onChange={onOriginalVolumeChange}
      />

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onMusicChange({ file, name: file.name, volume: 0.6, fadeIn: 1, fadeOut: 2 });
          e.target.value = "";
        }}
      />

      {!music ? (
        <button onClick={() => inputRef.current?.click()} className={`${secondaryButton} w-full border-dashed`}>
          <Upload className="w-4 h-4" />
          Nahrát hudbu (MP3, WAV, M4A)
        </button>
      ) : (
        <div className="space-y-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary">
              <Music2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <p className="flex-1 min-w-0 text-sm font-medium truncate">{music.name}</p>
            <button
              onClick={() => onMusicChange(null)}
              aria-label="Odebrat hudbu"
              className={`${iconButton} hover:text-destructive`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <Slider
            label="Hlasitost hudby"
            value={music.volume}
            min={0}
            max={1.5}
            step={0.05}
            display={`${Math.round(music.volume * 100)}%`}
            onChange={(volume) => onMusicChange({ ...music, volume }, "music-volume")}
          />
          <Slider
            label="Náběh"
            value={music.fadeIn}
            min={0}
            max={5}
            step={0.5}
            display={`${music.fadeIn}s`}
            onChange={(fadeIn) => onMusicChange({ ...music, fadeIn }, "music-in")}
          />
          <Slider
            label="Doznění"
            value={music.fadeOut}
            min={0}
            max={5}
            step={0.5}
            display={`${music.fadeOut}s`}
            onChange={(fadeOut) => onMusicChange({ ...music, fadeOut }, "music-out")}
          />
          <p className="text-xs text-muted-foreground">
            Hudba se ořízne na délku videa; kratší skladba se opakuje. V náhledu nehraje, uslyšíte ji ve
            výsledném exportu.
          </p>
        </div>
      )}
    </div>
  );
};

export default MusicPanel;
