import { useEffect, useState } from "react";

interface ToastInput {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}

interface ToastItem extends ToastInput {
  id: number;
}

type Listener = (item: ToastItem) => void;

const listeners = new Set<Listener>();
let nextId = 1;

/** Fire a toast from anywhere inside the editor. Rendered by <EditorToaster />. */
export const toast = (input: ToastInput) => {
  const item: ToastItem = { ...input, id: nextId++ };
  listeners.forEach((listener) => listener(item));
};

const TOAST_LIFETIME_MS = 4000;

export const EditorToaster = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const listener: Listener = (item) => {
      setItems((prev) => [...prev.slice(-2), item]);
      const timer = setTimeout(() => {
        timers.delete(timer);
        setItems((prev) => prev.filter((t) => t.id !== item.id));
      }, TOAST_LIFETIME_MS);
      timers.add(timer);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          role={item.variant === "destructive" ? "alert" : "status"}
          className={`glass-panel px-4 py-3 shadow-lg animate-slide-up ${
            item.variant === "destructive" ? "border-destructive/60" : ""
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              item.variant === "destructive" ? "text-destructive" : "text-foreground"
            }`}
          >
            {item.title}
          </p>
          {item.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  );
};
