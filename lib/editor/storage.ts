import { emptyProject, type Project } from "./types";

/**
 * Keeps the current project (including its source files) in IndexedDB so a reload or an
 * accidental tab close does not lose the timeline. Everything stays on this device.
 */

const DB_NAME = "multimedia-studio-editor";
const STORE = "state";
const KEY = "project";
const VERSION = 1;

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = async <T,>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

/** Returns false when the browser refused (private mode, quota), so the caller can say so. */
export const saveProject = async (project: Project): Promise<boolean> => {
  try {
    // File objects are stored by value; IndexedDB clones them.
    await run("readwrite", (store) => store.put(project, KEY));
    return true;
  } catch (error) {
    console.warn("Project could not be saved:", error);
    return false;
  }
};

export const loadProject = async (): Promise<Project | null> => {
  try {
    const stored = await run<Project | undefined>("readonly", (store) => store.get(KEY));
    if (!stored || !Array.isArray(stored.clips)) return null;
    // Merge over the defaults so projects saved by an older version still open.
    return { ...emptyProject, ...stored };
  } catch (error) {
    console.warn("Project could not be loaded:", error);
    return null;
  }
};

export const clearProject = async (): Promise<void> => {
  try {
    await run("readwrite", (store) => store.delete(KEY));
  } catch (error) {
    console.warn("Project could not be cleared:", error);
  }
};
