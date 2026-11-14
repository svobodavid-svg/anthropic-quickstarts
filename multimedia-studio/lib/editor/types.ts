export type Rotation = 0 | 90 | 180 | 270;

export interface Clip {
  id: string;
  file: File;
  name: string;
  /** Source duration in seconds. */
  duration: number;
  /** Source pixel size as displayed (before the user's rotation). */
  width: number;
  height: number;
  thumbnail: string;
  trimStart: number;
  trimEnd: number;
  speed: number;
  rotation: Rotation;
  volume: number;
  muted: boolean;
}

export type TextPosition = "top" | "center" | "bottom";

export interface TextLayer {
  id: string;
  text: string;
  align: "left" | "center" | "right";
  bold: boolean;
  italic: boolean;
  color: string;
  /** Font size as a percentage of the output height. */
  size: number;
  position: TextPosition;
  /** Visibility window on the output timeline, seconds. */
  start: number;
  end: number;
}

export interface MusicTrack {
  file: File;
  name: string;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export type AspectId = "original" | "16:9" | "9:16" | "1:1" | "4:5";
export type FitMode = "cover" | "contain";
export type TransitionId = "none" | "fade" | "dissolve" | "wipeleft" | "slideleft";
/** Short side of the output in pixels, or the source size. */
export type Resolution = "source" | 480 | 720 | 1080 | 1440 | 2160;

export interface Project {
  clips: Clip[];
  selectedClipId: string | null;
  look: string;
  effects: string[];
  texts: TextLayer[];
  music: MusicTrack | null;
  originalVolume: number;
  aspect: AspectId;
  fit: FitMode;
  resolution: Resolution;
  transition: TransitionId;
  transitionDuration: number;
}

export const emptyProject: Project = {
  clips: [],
  selectedClipId: null,
  look: "none",
  effects: [],
  texts: [],
  music: null,
  originalVolume: 1,
  aspect: "original",
  fit: "cover",
  resolution: "source",
  transition: "none",
  transitionDuration: 0.5,
};

export interface Look {
  id: string;
  name: string;
  /** Swatch shown in the picker. */
  swatch: string;
  /** Approximation used for the live preview. */
  css: string;
  /** Filter chain burned into the export. */
  ffmpeg: string;
}

export const LOOKS: Look[] = [
  { id: "none", name: "Originál", swatch: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", css: "", ffmpeg: "" },
  {
    id: "vintage",
    name: "Vintage",
    swatch: "linear-gradient(135deg, #d4a574 0%, #8b7355 100%)",
    css: "sepia(0.7) contrast(1.1) brightness(0.95)",
    ffmpeg:
      "colorchannelmixer=.5:.55:.14:0:.25:.75:.12:0:.19:.38:.5,eq=contrast=1.1:brightness=-0.03",
  },
  {
    id: "noir",
    name: "Noir",
    swatch: "linear-gradient(135deg, #434343 0%, #000000 100%)",
    css: "grayscale(1) contrast(1.2)",
    ffmpeg: "hue=s=0,eq=contrast=1.2",
  },
  {
    id: "warm",
    name: "Teplé",
    swatch: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
    css: "sepia(0.25) saturate(1.3) brightness(1.05)",
    ffmpeg: "colorbalance=rs=.12:gs=.02:bs=-.12:rm=.08:bm=-.08,eq=saturation=1.25",
  },
  {
    id: "cold",
    name: "Studené",
    swatch: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    css: "saturate(0.9) hue-rotate(12deg) brightness(1.05)",
    ffmpeg: "colorbalance=rs=-.12:bs=.14:rm=-.06:bm=.1,eq=saturation=0.9",
  },
  {
    id: "vivid",
    name: "Živé",
    swatch: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    css: "saturate(1.8) contrast(1.1)",
    ffmpeg: "eq=saturation=1.8:contrast=1.1",
  },
  {
    id: "fade",
    name: "Fade",
    swatch: "linear-gradient(135deg, #a8caba 0%, #5d4157 100%)",
    css: "contrast(0.9) brightness(1.1) saturate(0.8)",
    ffmpeg: "eq=contrast=0.9:brightness=0.06:saturation=0.8",
  },
];

export interface Effect {
  id: string;
  name: string;
  css: string;
  ffmpeg: string;
}

export const EFFECTS: Effect[] = [
  { id: "blur", name: "Rozmazání", css: "blur(3px)", ffmpeg: "gblur=sigma=5" },
  { id: "sharpen", name: "Doostření", css: "contrast(1.05)", ffmpeg: "unsharp=5:5:1.0:5:5:0.0" },
  { id: "vignette", name: "Vinětace", css: "", ffmpeg: "vignette=PI/4.5" },
  { id: "grain", name: "Zrno", css: "", ffmpeg: "noise=alls=16:allf=t" },
  { id: "rgbshift", name: "RGB posun", css: "", ffmpeg: "rgbashift=rh=-6:bh=6" },
  { id: "bright", name: "Zesvětlení", css: "brightness(1.15)", ffmpeg: "eq=brightness=0.08" },
];

export const ASPECTS: { id: AspectId; label: string; ratio: number | null }[] = [
  { id: "original", label: "Původní", ratio: null },
  { id: "16:9", label: "16:9", ratio: 16 / 9 },
  { id: "9:16", label: "9:16", ratio: 9 / 16 },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "4:5", label: "4:5", ratio: 4 / 5 },
];

export const RESOLUTIONS: { id: Resolution; label: string }[] = [
  { id: "source", label: "Jako zdroj" },
  { id: 480, label: "480p" },
  { id: 720, label: "720p" },
  { id: 1080, label: "1080p" },
  { id: 1440, label: "1440p" },
  { id: 2160, label: "4K" },
];

export const TRANSITIONS: { id: TransitionId; label: string }[] = [
  { id: "none", label: "Žádný" },
  { id: "fade", label: "Prolnutí" },
  { id: "dissolve", label: "Rozpuštění" },
  { id: "wipeleft", label: "Setření" },
  { id: "slideleft", label: "Posun" },
];

export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface Preset {
  id: string;
  label: string;
  aspect: AspectId;
  resolution: Resolution;
}

export const PRESETS: Preset[] = [
  { id: "reel", label: "Reels / TikTok / Shorts", aspect: "9:16", resolution: 1080 },
  { id: "youtube", label: "YouTube", aspect: "16:9", resolution: 1080 },
  { id: "post", label: "Instagram příspěvek", aspect: "4:5", resolution: 1080 },
  { id: "square", label: "Čtverec", aspect: "1:1", resolution: 1080 },
  { id: "draft", label: "Rychlý náhled", aspect: "original", resolution: 480 },
];

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export const formatTime = (seconds: number, withFraction = false): string => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const base = `${mins}:${secs.toString().padStart(2, "0")}`;
  return withFraction ? `${base}.${Math.floor((safe % 1) * 10)}` : base;
};
