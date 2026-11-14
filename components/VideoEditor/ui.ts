/** Shared Tailwind class helpers for the editor panels. */

export const panel = "glass-panel p-4 space-y-4";

export const heading = "text-sm font-semibold text-muted-foreground uppercase tracking-wide";

export const chip = (active: boolean) =>
  `px-3 py-2 rounded-lg border text-sm font-medium transition-all disabled:opacity-50 ${
    active
      ? "border-primary bg-primary/15 text-primary"
      : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
  }`;

export const iconButton =
  "p-2.5 rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground hover:bg-secondary " +
  "transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

export const primaryButton =
  "w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground " +
  "font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export const secondaryButton =
  "flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border " +
  "text-foreground hover:bg-secondary/60 transition-colors disabled:opacity-50";

export const textInput =
  "w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-foreground " +
  "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50";
