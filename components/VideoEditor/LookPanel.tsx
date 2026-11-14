import { EFFECTS, LOOKS } from "@/lib/editor/types";
import { chip, heading, panel } from "./ui";

interface LookPanelProps {
  look: string;
  effects: string[];
  onLookChange: (look: string) => void;
  onEffectToggle: (effect: string) => void;
}

const LookPanel = ({ look, effects, onLookChange, onEffectToggle }: LookPanelProps) => (
  <div className={panel}>
    <h3 className={heading}>Filtry</h3>
    <div className="flex gap-3 overflow-x-auto p-1 pb-2">
      {LOOKS.map((item) => (
        <button
          key={item.id}
          onClick={() => onLookChange(item.id)}
          aria-pressed={look === item.id}
          className={`flex flex-col items-center gap-2 transition-all duration-200 ${
            look === item.id ? "scale-105" : "opacity-70 hover:opacity-100"
          }`}
        >
          <div
            className={`w-14 h-14 rounded-xl ${
              look === item.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
            }`}
            style={{ background: item.swatch }}
          />
          <span className="text-xs font-medium whitespace-nowrap">{item.name}</span>
        </button>
      ))}
    </div>

    <h3 className={heading}>Efekty</h3>
    <div className="flex flex-wrap gap-2">
      {EFFECTS.map((effect) => (
        <button
          key={effect.id}
          onClick={() => onEffectToggle(effect.id)}
          aria-pressed={effects.includes(effect.id)}
          className={chip(effects.includes(effect.id))}
        >
          {effect.name}
        </button>
      ))}
    </div>

    <p className="text-xs text-muted-foreground">
      Filtry a efekty se vypalují do exportu na celé video. Náhled je přibližný; vinětace, zrno a RGB posun
      jsou vidět až ve výsledku.
    </p>
  </div>
);

export default LookPanel;
