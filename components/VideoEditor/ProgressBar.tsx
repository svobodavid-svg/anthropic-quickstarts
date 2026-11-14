interface ProgressBarProps {
  label: string;
  progress: number;
}

const ProgressBar = ({ label, progress }: ProgressBarProps) => (
  <div className="space-y-2">
    <div className="flex justify-between text-xs text-muted-foreground">
      <span>{label}</span>
      <span className="text-primary">{progress}%</span>
    </div>
    <div
      className="h-2 bg-secondary rounded-full overflow-hidden"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-primary transition-all duration-300"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
);

/** Shared Tailwind classes for native range inputs inside the editor. */
export const rangeClass =
  "w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer " +
  "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 " +
  "[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full " +
  "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-pointer " +
  "[&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-primary/30 " +
  "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full " +
  "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary";

export default ProgressBar;
