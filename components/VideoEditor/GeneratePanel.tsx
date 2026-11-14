import { useState, useRef, useEffect } from "react";
import { ImagePlus, X, Wand2, Layers, Move, ZoomIn } from "lucide-react";
import type { EffectType } from "@/hooks/useFFmpeg";
import ProgressBar, { rangeClass } from "./ProgressBar";

interface ImageFile {
  id: string;
  file: File;
  name: string;
  url: string;
}

interface GeneratePanelProps {
  onGenerate: (
    images: File[],
    effect: EffectType,
    duration: number,
    transitionDuration: number
  ) => Promise<void>;
  isProcessing: boolean;
  progress: number;
  /** Images handed over from the studio gallery; appended whenever the array changes. */
  incomingImages?: File[];
}

const effects: { id: EffectType; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "slideshow", label: "Slideshow", icon: <Layers className="w-4 h-4" />, description: "Plynulé přechody mezi obrázky" },
  { id: "kenburns", label: "Ken Burns", icon: <ZoomIn className="w-4 h-4" />, description: "Zoom a pan animace" },
  { id: "morphing", label: "Morphing", icon: <Move className="w-4 h-4" />, description: "Prolínání mezi obrázky" },
];

const toImageFile = (file: File): ImageFile => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
  file,
  name: file.name,
  url: URL.createObjectURL(file),
});

const GeneratePanel = ({ onGenerate, isProcessing, progress, incomingImages }: GeneratePanelProps) => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedEffect, setSelectedEffect] = useState<EffectType>("slideshow");
  const [imageDuration, setImageDuration] = useState(3); // seconds per image
  const [transitionDuration, setTransitionDuration] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (incomingImages && incomingImages.length > 0) {
      setImages((prev) => [...prev, ...incomingImages.map(toImageFile)]);
    }
  }, [incomingImages]);

  // Release preview URLs when the panel goes away.
  const imagesRef = useRef(images);
  imagesRef.current = images;
  useEffect(() => () => imagesRef.current.forEach((img) => URL.revokeObjectURL(img.url)), []);

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setImages((prev) => [...prev, ...Array.from(files).map(toImageFile)]);
    e.target.value = "";
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image) URL.revokeObjectURL(image.url);
      return prev.filter((img) => img.id !== id);
    });
  };

  const handleGenerate = () => {
    if (images.length < 2) return;
    onGenerate(images.map((img) => img.file), selectedEffect, imageDuration, transitionDuration);
  };

  const totalDuration = images.length * imageDuration + transitionDuration;

  return (
    <div className="glass-panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Klip z obrázků</h3>
        {images.length >= 2 && (
          <span className="text-xs text-muted-foreground">Délka: ~{totalDuration.toFixed(1)}s</span>
        )}
      </div>

      {/* Effect selection */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Vyberte efekt</p>
        <div className="grid grid-cols-3 gap-2">
          {effects.map((effect) => (
            <button
              key={effect.id}
              onClick={() => setSelectedEffect(effect.id)}
              aria-pressed={selectedEffect === effect.id}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                selectedEffect === effect.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 hover:border-border hover:bg-muted/50"
              }`}
            >
              {effect.icon}
              <span className="text-xs font-medium">{effect.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center">
          {effects.find((e) => e.id === selectedEffect)?.description}
        </p>
      </div>

      {/* Images grid */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Přidejte obrázky ({images.length} přidáno)</p>
        <div className="grid grid-cols-4 gap-2">
          {images.map((image, index) => (
            <div key={image.id} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
              <img src={image.url} alt={image.name} className="w-full h-full object-cover rounded-lg" />
              <div className="absolute top-1 left-1 bg-background/80 text-foreground text-xs px-1.5 py-0.5 rounded">
                {index + 1}
              </div>
              <button
                onClick={() => handleRemoveImage(image.id)}
                disabled={isProcessing}
                aria-label={`Odebrat ${image.name}`}
                className="absolute top-1 right-1 p-1 rounded-full bg-destructive/80 text-destructive-foreground
                           disabled:opacity-50"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="aspect-square rounded-lg border-2 border-dashed border-border/50 hover:border-primary/50
                       hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-1
                       disabled:opacity-50"
          >
            <ImagePlus className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Přidat</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleAddImages}
          className="hidden"
        />
      </div>

      {/* Duration settings */}
      {images.length >= 2 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Doba zobrazení obrázku</span>
              <span className="text-foreground font-medium">{imageDuration}s</span>
            </div>
            <input
              type="range"
              aria-label="Doba zobrazení obrázku"
              min={1}
              max={10}
              step={0.5}
              value={imageDuration}
              onChange={(e) => setImageDuration(parseFloat(e.target.value))}
              className={rangeClass}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Délka přechodu</span>
              <span className="text-foreground font-medium">{transitionDuration}s</span>
            </div>
            <input
              type="range"
              aria-label="Délka přechodu"
              min={0.5}
              max={3}
              step={0.25}
              value={transitionDuration}
              onChange={(e) => setTransitionDuration(parseFloat(e.target.value))}
              className={rangeClass}
            />
          </div>
        </div>
      )}

      {isProcessing && <ProgressBar label="Generuji video..." progress={progress} />}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={images.length < 2 || isProcessing}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                   bg-primary text-primary-foreground font-semibold
                   hover:bg-primary/90 transition-all duration-200
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Wand2 className="w-4 h-4" />
        {isProcessing ? "Generuji..." : "Vytvořit klip na časovou osu"}
      </button>

      {images.length < 2 && (
        <p className="text-xs text-center text-muted-foreground">
          Přidejte alespoň 2 obrázky. Hotový klip (1280×720) se vloží na časovou osu.
        </p>
      )}
    </div>
  );
};

export default GeneratePanel;
