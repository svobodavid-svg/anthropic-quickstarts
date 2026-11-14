import {
  ASPECTS,
  PRESETS,
  RESOLUTIONS,
  TRANSITIONS,
  type Project,
} from "@/lib/editor/types";
import { rangeClass } from "./ProgressBar";
import { chip, heading, panel } from "./ui";

interface FormatPanelProps {
  project: Project;
  width: number;
  height: number;
  onChange: (patch: Partial<Project>, coalesceKey?: string) => void;
}

const FormatPanel = ({ project, width, height, onChange }: FormatPanelProps) => (
  <div className={panel}>
    <div className="flex items-center justify-between">
      <h3 className={heading}>Formát výstupu</h3>
      <span className="text-xs text-primary font-medium">
        {width}×{height}
      </span>
    </div>

    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Předvolby</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => onChange({ aspect: preset.aspect, resolution: preset.resolution })}
            aria-pressed={project.aspect === preset.aspect && project.resolution === preset.resolution}
            className={chip(project.aspect === preset.aspect && project.resolution === preset.resolution)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>

    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Poměr stran</p>
      <div className="flex flex-wrap gap-2">
        {ASPECTS.map((aspect) => (
          <button
            key={aspect.id}
            onClick={() => onChange({ aspect: aspect.id })}
            aria-pressed={project.aspect === aspect.id}
            className={chip(project.aspect === aspect.id)}
          >
            {aspect.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onChange({ fit: "cover" })}
          aria-pressed={project.fit === "cover"}
          className={chip(project.fit === "cover")}
        >
          Vyplnit (ořízne okraje)
        </button>
        <button
          onClick={() => onChange({ fit: "contain" })}
          aria-pressed={project.fit === "contain"}
          className={chip(project.fit === "contain")}
        >
          Vejít (černé pruhy)
        </button>
      </div>
    </div>

    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Rozlišení (kratší strana)</p>
      <div className="flex flex-wrap gap-2">
        {RESOLUTIONS.map((resolution) => (
          <button
            key={resolution.id}
            onClick={() => onChange({ resolution: resolution.id })}
            aria-pressed={project.resolution === resolution.id}
            className={chip(project.resolution === resolution.id)}
          >
            {resolution.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Vyšší rozlišení než zdroj obraz jen zvětší (lanczos), detail nepřidá. 1440p a 4K jsou v prohlížeči
        pomalé a na telefonu může dojít paměť.
      </p>
    </div>

    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Přechod mezi klipy</p>
      <div className="flex flex-wrap gap-2">
        {TRANSITIONS.map((transition) => (
          <button
            key={transition.id}
            onClick={() => onChange({ transition: transition.id })}
            aria-pressed={project.transition === transition.id}
            className={chip(project.transition === transition.id)}
          >
            {transition.label}
          </button>
        ))}
      </div>
      {project.transition !== "none" && (
        <div className="flex items-center gap-3">
          <input
            type="range"
            aria-label="Délka přechodu"
            min={0.2}
            max={2}
            step={0.1}
            value={project.transitionDuration}
            onChange={(e) => onChange({ transitionDuration: parseFloat(e.target.value) }, "transition")}
            className={`${rangeClass} flex-1`}
          />
          <span className="w-10 text-right text-xs text-muted-foreground">{project.transitionDuration}s</span>
        </div>
      )}
      {project.transition !== "none" && project.clips.length < 2 && (
        <p className="text-xs text-muted-foreground">Přechod se použije, až budou na ose aspoň dva klipy.</p>
      )}
    </div>
  </div>
);

export default FormatPanel;
