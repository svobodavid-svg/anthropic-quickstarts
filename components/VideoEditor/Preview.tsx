import { forwardRef } from "react";
import { Play, Pause } from "lucide-react";
import { EFFECTS, LOOKS, formatTime, type Clip, type Project, type TextLayer } from "@/lib/editor/types";

interface PreviewProps {
  project: Project;
  clip: Clip;
  src: string;
  /** Output frame size; the preview box takes its aspect ratio. */
  width: number;
  height: number;
  isPlaying: boolean;
  /** Position on the output timeline, seconds. */
  timelineTime: number;
  duration: number;
  onPlayPause: () => void;
  onTimeUpdate: (sourceTime: number) => void;
  onLoaded: () => void;
}

const alignClass = { left: "text-left", center: "text-center", right: "text-right" } as const;
const positionClass = { top: "top-[8%]", center: "top-1/2 -translate-y-1/2", bottom: "bottom-[8%]" } as const;

const TextOverlay = ({ layer }: { layer: TextLayer }) => (
  <div
    className={`absolute inset-x-[6%] whitespace-pre-wrap break-words leading-tight pointer-events-none
                ${alignClass[layer.align]} ${positionClass[layer.position]}`}
    style={{
      color: layer.color,
      // cqh = % of the preview box height, so the size matches the export.
      fontSize: `${layer.size}cqh`,
      fontWeight: layer.bold ? 700 : 500,
      fontStyle: layer.italic ? "italic" : "normal",
      textShadow: "0 0 0.12em #000, 0 0 0.12em #000, 0 0 0.2em #000",
    }}
  >
    {layer.text}
  </div>
);

const Preview = forwardRef<HTMLVideoElement, PreviewProps>(
  (
    { project, clip, src, width, height, isPlaying, timelineTime, duration, onPlayPause, onTimeUpdate, onLoaded },
    ref
  ) => {
    const css = [
      LOOKS.find((look) => look.id === project.look)?.css,
      ...EFFECTS.filter((effect) => project.effects.includes(effect.id)).map((e) => e.css),
    ]
      .filter(Boolean)
      .join(" ");

    const sideways = clip.rotation === 90 || clip.rotation === 270;
    const ratio = width / height;

    return (
      <div className="flex justify-center">
        <div
          className="relative overflow-hidden rounded-2xl bg-black max-h-[55vh] w-full"
          style={{ aspectRatio: `${width} / ${height}`, maxWidth: `calc(55vh * ${ratio})`, containerType: "size" }}
        >
          <video
            ref={ref}
            src={src}
            playsInline
            onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
            onLoadedMetadata={onLoaded}
            className="absolute left-1/2 top-1/2"
            style={{
              // A sideways clip is laid out with swapped box dimensions, then rotated into place.
              width: sideways ? `${100 / ratio}%` : "100%",
              height: sideways ? `${100 * ratio}%` : "100%",
              objectFit: project.fit,
              transform: `translate(-50%, -50%) rotate(${clip.rotation}deg)`,
              filter: css || undefined,
            }}
          />

          {project.texts
            .filter((layer) => timelineTime >= layer.start && timelineTime <= layer.end)
            .map((layer) => (
              <TextOverlay key={layer.id} layer={layer} />
            ))}

          <button
            onClick={onPlayPause}
            aria-label={isPlaying ? "Pozastavit" : "Přehrát"}
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200
                        ${isPlaying ? "opacity-0 hover:opacity-100" : "opacity-100"}`}
          >
            <span className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center">
              {isPlaying ? (
                <Pause className="w-6 h-6 text-primary-foreground" />
              ) : (
                <Play className="w-6 h-6 text-primary-foreground ml-0.5" />
              )}
            </span>
          </button>

          <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-full bg-card/80 text-xs font-medium pointer-events-none">
            {formatTime(timelineTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
    );
  }
);

Preview.displayName = "Preview";

export default Preview;
