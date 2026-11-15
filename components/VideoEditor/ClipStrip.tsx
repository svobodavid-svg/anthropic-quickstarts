import { useRef } from "react";
import { ChevronLeft, ChevronRight, Copy, Plus, Scissors, Trash2 } from "lucide-react";
import { clipLength } from "@/lib/editor/render";
import { formatTime, type Clip } from "@/lib/editor/types";
import { iconButton } from "./ui";

interface ClipStripProps {
  clips: Clip[];
  selectedId: string | null;
  totalDuration: number;
  canSplit: boolean;
  disabled: boolean;
  onSelect: (id: string) => void;
  onAddFiles: (files: File[]) => void;
  onMove: (direction: -1 | 1) => void;
  onSplit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}

const ClipStrip = ({
  clips,
  selectedId,
  totalDuration,
  canSplit,
  disabled,
  onSelect,
  onAddFiles,
  onMove,
  onSplit,
  onDuplicate,
  onRemove,
}: ClipStripProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const index = clips.findIndex((clip) => clip.id === selectedId);
  const hasSelection = index >= 0;

  return (
    <div className="glass-panel p-3 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide">Časová osa</span>
        <span>
          {clips.length} {clips.length === 1 ? "klip" : clips.length < 5 ? "klipy" : "klipů"} •{" "}
          {formatTime(totalDuration, true)}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto p-1">
        {clips.map((clip, i) => (
          <button
            key={clip.id}
            onClick={() => onSelect(clip.id)}
            aria-label={`Klip ${i + 1}: ${clip.name}`}
            aria-pressed={clip.id === selectedId}
            className={`relative shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-secondary bg-cover bg-center
                        transition-all ${
                          clip.id === selectedId
                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                            : "opacity-70 hover:opacity-100"
                        }`}
            style={{ backgroundImage: `url(${clip.thumbnail})` }}
          >
            <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-background/80 text-[11px] font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <span className="absolute bottom-1 right-1 px-1.5 rounded bg-background/80 text-[11px]">
              {formatTime(clipLength(clip), true)}
            </span>
          </button>
        ))}

        <input
          ref={inputRef}
          type="file"
          accept="video/*,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="shrink-0 w-24 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary/60
                     text-muted-foreground hover:text-foreground flex flex-col items-center justify-center gap-0.5
                     transition-colors disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          <span className="text-[11px]">Přidat</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onMove(-1)}
          disabled={disabled || index <= 0}
          aria-label="Posunout klip doleva"
          className={iconButton}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={disabled || !hasSelection || index >= clips.length - 1}
          aria-label="Posunout klip doprava"
          className={iconButton}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={onSplit}
          disabled={disabled || !canSplit}
          title="Rozdělit klip v místě přehrávání (S)"
          className={`${iconButton} flex items-center gap-1.5 text-xs font-medium`}
        >
          <Scissors className="w-4 h-4" />
          Rozdělit
        </button>
        <button
          onClick={onDuplicate}
          disabled={disabled || !hasSelection}
          aria-label="Duplikovat klip"
          className={iconButton}
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          onClick={onRemove}
          disabled={disabled || !hasSelection}
          aria-label="Smazat klip"
          className={`${iconButton} ml-auto hover:text-destructive`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ClipStrip;
