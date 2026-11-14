import { useCallback, useRef, useState } from "react";
import { emptyProject, newId, type Clip, type Project } from "@/lib/editor/types";

interface History {
  past: Project[];
  present: Project;
  future: Project[];
}

const HISTORY_LIMIT = 50;
const COALESCE_MS = 800;

type Updater = (project: Project) => Project;

/** A split needs a little footage on both sides. */
export const canSplit = (clip: Clip, sourceTime: number) =>
  sourceTime > clip.trimStart + 0.1 && sourceTime < clip.trimEnd - 0.1;

/**
 * Project state with undo/redo. Edits are non-destructive: nothing touches the source
 * files until export.
 */
export const useProject = () => {
  const [history, setHistory] = useState<History>({ past: [], present: emptyProject, future: [] });
  const lastEdit = useRef<{ key: string; at: number } | null>(null);

  /**
   * Apply an edit. Pass `coalesceKey` for continuous controls (sliders): consecutive edits
   * with the same key collapse into one undo step.
   */
  const update = useCallback((updater: Updater, coalesceKey?: string) => {
    const now = Date.now();
    const previous = lastEdit.current;
    const coalesce =
      !!coalesceKey && previous?.key === coalesceKey && now - previous.at < COALESCE_MS;
    lastEdit.current = coalesceKey ? { key: coalesceKey, at: now } : null;

    setHistory((h) => {
      const next = updater(h.present);
      if (next === h.present) return h;
      return {
        past: coalesce ? h.past : [...h.past.slice(-HISTORY_LIMIT + 1), h.present],
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    lastEdit.current = null;
    setHistory((h) =>
      h.past.length === 0
        ? h
        : {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
    );
  }, []);

  const redo = useCallback(() => {
    lastEdit.current = null;
    setHistory((h) =>
      h.future.length === 0
        ? h
        : { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
    );
  }, []);

  /** Replace the whole project (open a saved one, or start over). Clears the undo history. */
  const reset = useCallback((project: Project = emptyProject) => {
    lastEdit.current = null;
    setHistory({ past: [], present: project, future: [] });
  }, []);

  /** Selection is navigation, not an edit: it does not create an undo step. */
  const select = useCallback((id: string | null) => {
    setHistory((h) => ({ ...h, present: { ...h.present, selectedClipId: id } }));
  }, []);

  const addClips = useCallback(
    (clips: Clip[]) => {
      if (clips.length === 0) return;
      update((p) => ({
        ...p,
        clips: [...p.clips, ...clips],
        selectedClipId: p.selectedClipId ?? clips[0].id,
      }));
    },
    [update]
  );

  const updateClip = useCallback(
    (id: string, patch: Partial<Clip>, coalesceKey?: string) => {
      update(
        (p) => ({ ...p, clips: p.clips.map((c) => (c.id === id ? { ...c, ...patch } : c)) }),
        coalesceKey ? `${id}:${coalesceKey}` : undefined
      );
    },
    [update]
  );

  const removeClip = useCallback(
    (id: string) => {
      update((p) => {
        const index = p.clips.findIndex((c) => c.id === id);
        if (index < 0) return p;
        const clips = p.clips.filter((c) => c.id !== id);
        const neighbour = clips[Math.min(index, clips.length - 1)];
        return { ...p, clips, selectedClipId: neighbour?.id ?? null };
      });
    },
    [update]
  );

  const moveClip = useCallback(
    (id: string, direction: -1 | 1) => {
      update((p) => {
        const index = p.clips.findIndex((c) => c.id === id);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= p.clips.length) return p;
        const clips = [...p.clips];
        [clips[index], clips[target]] = [clips[target], clips[index]];
        return { ...p, clips };
      });
    },
    [update]
  );

  const duplicateClip = useCallback(
    (id: string) => {
      update((p) => {
        const index = p.clips.findIndex((c) => c.id === id);
        if (index < 0) return p;
        const copy = { ...p.clips[index], id: newId() };
        const clips = [...p.clips];
        clips.splice(index + 1, 0, copy);
        return { ...p, clips, selectedClipId: copy.id };
      });
    },
    [update]
  );

  /** Cut a clip in two at `sourceTime` (seconds in the source file). */
  const splitClip = useCallback(
    (id: string, sourceTime: number) => {
      update((p) => {
        const index = p.clips.findIndex((c) => c.id === id);
        const clip = p.clips[index];
        if (!clip || !canSplit(clip, sourceTime)) return p;
        const second = { ...clip, id: newId(), trimStart: sourceTime };
        const clips = [...p.clips];
        clips.splice(index, 1, { ...clip, trimEnd: sourceTime }, second);
        return { ...p, clips, selectedClipId: second.id };
      });
    },
    [update]
  );

  return {
    project: history.present,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    update,
    reset,
    undo,
    redo,
    select,
    addClips,
    updateClip,
    removeClip,
    moveClip,
    duplicateClip,
    splitClip,
  };
};

export type ProjectApi = ReturnType<typeof useProject>;
