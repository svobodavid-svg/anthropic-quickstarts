import { useState } from "react";
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Subtitles, Plus, Trash2, X } from "lucide-react";
import { CAPTION_LANGUAGES, CAPTION_MODELS } from "@/lib/editor/captions";
import { formatTime, newId, type TextLayer, type TextPosition } from "@/lib/editor/types";
import { rangeClass } from "./ProgressBar";
import { chip, heading, iconButton, panel, primaryButton, secondaryButton, textInput } from "./ui";

interface TextPanelProps {
  texts: TextLayer[];
  duration: number;
  /** Current position on the output timeline; new text starts here. */
  timelineTime: number;
  onAdd: (layer: TextLayer) => void;
  onChange: (id: string, patch: Partial<TextLayer>, coalesceKey?: string) => void;
  onRemove: (id: string) => void;
  /** Status text while captions are being generated, otherwise null. */
  captionStatus: string | null;
  onGenerateCaptions: (model: string, language: string | null) => void;
  onCancelCaptions: () => void;
}

const COLORS = ["#ffffff", "#00d4ff", "#ff6b6b", "#feca57", "#48dbfb", "#ff9ff3", "#54a0ff", "#111111"];

const POSITIONS: { id: TextPosition; label: string }[] = [
  { id: "top", label: "Nahoře" },
  { id: "center", label: "Uprostřed" },
  { id: "bottom", label: "Dole" },
];

const toggle = (active: boolean) =>
  `${iconButton} ${active ? "!bg-primary !text-primary-foreground" : ""}`;

const TextPanel = ({
  texts,
  duration,
  timelineTime,
  onAdd,
  onChange,
  onRemove,
  captionStatus,
  onGenerateCaptions,
  onCancelCaptions,
}: TextPanelProps) => {
  const [model, setModel] = useState<string>(CAPTION_MODELS[0].id);
  const [language, setLanguage] = useState<string | null>(CAPTION_LANGUAGES[0].id);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = texts.find((layer) => layer.id === editingId) ?? texts[texts.length - 1] ?? null;

  const handleAdd = () => {
    const text = draft.trim();
    if (!text) return;
    const start = Math.min(timelineTime, Math.max(0, duration - 0.5));
    const layer: TextLayer = {
      id: newId(),
      text,
      align: "center",
      bold: true,
      italic: false,
      color: "#ffffff",
      size: 7,
      position: "bottom",
      start,
      end: Math.min(duration, start + 3),
    };
    onAdd(layer);
    setEditingId(layer.id);
    setDraft("");
  };

  return (
    <div className={panel}>
      <h3 className={heading}>Text</h3>

      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Zadejte text..."
          aria-label="Nový text"
          className={textInput}
        />
        <button
          onClick={handleAdd}
          disabled={!draft.trim() || duration <= 0}
          className={`${primaryButton} !w-auto px-4`}
        >
          <Plus className="w-4 h-4" />
          Přidat
        </button>
      </div>

      {texts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {texts.map((layer) => (
            <button
              key={layer.id}
              onClick={() => setEditingId(layer.id)}
              aria-pressed={editing?.id === layer.id}
              className={`${chip(editing?.id === layer.id)} max-w-[10rem] truncate`}
            >
              {layer.text}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <div className="space-y-4 p-3 rounded-xl bg-secondary/30 border border-border/50">
          <input
            type="text"
            value={editing.text}
            onChange={(e) => onChange(editing.id, { text: e.target.value }, "text")}
            aria-label="Upravit text"
            className={textInput}
          />

          <div className="flex flex-wrap items-center gap-2">
            {(["left", "center", "right"] as const).map((align) => {
              const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
              return (
                <button
                  key={align}
                  onClick={() => onChange(editing.id, { align })}
                  aria-label={`Zarovnání ${align}`}
                  aria-pressed={editing.align === align}
                  className={toggle(editing.align === align)}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
            <button
              onClick={() => onChange(editing.id, { bold: !editing.bold })}
              aria-label="Tučně"
              aria-pressed={editing.bold}
              className={toggle(editing.bold)}
            >
              <Bold className="w-4 h-4" />
            </button>
            <button
              onClick={() => onChange(editing.id, { italic: !editing.italic })}
              aria-label="Kurzíva"
              aria-pressed={editing.italic}
              className={toggle(editing.italic)}
            >
              <Italic className="w-4 h-4" />
            </button>
            <button
              onClick={() => onRemove(editing.id)}
              aria-label="Smazat text"
              className={`${iconButton} ml-auto hover:text-destructive`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {POSITIONS.map((position) => (
              <button
                key={position.id}
                onClick={() => onChange(editing.id, { position: position.id })}
                aria-pressed={editing.position === position.id}
                className={chip(editing.position === position.id)}
              >
                {position.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => onChange(editing.id, { color })}
                aria-label={`Barva ${color}`}
                aria-pressed={editing.color === color}
                className={`w-7 h-7 rounded-full border border-border transition-transform ${
                  editing.color === color ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110" : ""
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Velikost</span>
              <span>{editing.size}%</span>
            </div>
            <input
              type="range"
              aria-label="Velikost textu"
              min={3}
              max={16}
              step={0.5}
              value={editing.size}
              onChange={(e) => onChange(editing.id, { size: parseFloat(e.target.value) }, "size")}
              className={rangeClass}
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Zobrazit od</span>
              <span>{formatTime(editing.start, true)}</span>
            </div>
            <input
              type="range"
              aria-label="Text od"
              min={0}
              max={duration}
              step={0.1}
              value={Math.min(editing.start, duration)}
              onChange={(e) => {
                const start = Math.min(parseFloat(e.target.value), editing.end - 0.2);
                onChange(editing.id, { start: Math.max(0, start) }, "start");
              }}
              className={rangeClass}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Zobrazit do</span>
              <span>{formatTime(Math.min(editing.end, duration), true)}</span>
            </div>
            <input
              type="range"
              aria-label="Text do"
              min={0}
              max={duration}
              step={0.1}
              value={Math.min(editing.end, duration)}
              onChange={(e) => {
                const end = Math.max(parseFloat(e.target.value), editing.start + 0.2);
                onChange(editing.id, { end: Math.min(duration, end) }, "end");
              }}
              className={rangeClass}
            />
          </div>
        </div>
      )}

      <div className="space-y-3 pt-3 border-t border-border/50">
        <h3 className={heading}>Automatické titulky</h3>
        <div className="flex flex-wrap gap-2">
          {CAPTION_LANGUAGES.map((item) => (
            <button
              key={item.label}
              onClick={() => setLanguage(item.id)}
              disabled={captionStatus !== null}
              aria-pressed={language === item.id}
              className={chip(language === item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {CAPTION_MODELS.map((item) => (
            <button
              key={item.id}
              onClick={() => setModel(item.id)}
              disabled={captionStatus !== null}
              aria-pressed={model === item.id}
              className={chip(model === item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {captionStatus === null ? (
          <button
            onClick={() => onGenerateCaptions(model, language)}
            disabled={duration <= 0}
            className={`${secondaryButton} w-full`}
          >
            <Subtitles className="w-4 h-4" />
            Vytvořit titulky z řeči
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <p role="status" className="flex-1 text-sm text-primary">
              {captionStatus}
            </p>
            <button onClick={onCancelCaptions} aria-label="Zrušit titulky" className={iconButton}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Řeč rozpozná model Whisper přímo v prohlížeči, nic se nikam neposílá. Při prvním použití se model
          stáhne a pak zůstane v mezipaměti. Na telefonu je to pomalé; počítejte s minutami. Výsledek berte
          jako koncept a texty si projděte.
        </p>
      </div>

      {duration <= 0 && <p className="text-xs text-muted-foreground">Nejdřív přidejte video na časovou osu.</p>}
    </div>
  );
};

export default TextPanel;
