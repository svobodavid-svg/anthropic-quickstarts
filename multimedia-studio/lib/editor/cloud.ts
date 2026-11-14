import { MEDIA_BUCKET, supabase } from "@/lib/supabase";
import { emptyProject, type Clip, type MusicTrack, type Project } from "./types";

/**
 * Cloud projects: the timeline is stored as JSON in `projects`, the source media in the
 * private `editor-media` bucket under `<user id>/<project id>/`. Database policies limit
 * every row and file to its owner.
 */

export interface CloudProjectInfo {
  id: string;
  name: string;
  updatedAt: string;
}

interface FileRef {
  path: string;
  name: string;
  type: string;
}

type StoredClip = Omit<Clip, "file"> & { file: FileRef };
type StoredMusic = Omit<MusicTrack, "file"> & { file: FileRef };
type StoredProject = Omit<Project, "clips" | "music"> & { clips: StoredClip[]; music: StoredMusic | null };

const client = () => {
  if (!supabase) throw new Error("Cloud není nastaven");
  return supabase;
};

const userId = async () => {
  const { data } = await client().auth.getUser();
  if (!data.user) throw new Error("Nejste přihlášeni");
  return data.user.id;
};

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-80) || "file";

const describeUploadError = (name: string, message: string) =>
  /exceeded|too large|maximum/i.test(message)
    ? `Soubor ${name} je větší, než úložiště dovoluje (ve volném tarifu 50 MB).`
    : `Soubor ${name} se nepodařilo nahrát.`;

export const listCloudProjects = async (): Promise<CloudProjectInfo[]> => {
  const { data, error } = await client()
    .from("projects")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error("Seznam projektů se nepodařilo načíst.");
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, updatedAt: row.updated_at }));
};

/**
 * Save a project. Pass `id` to overwrite an existing cloud project. Files already uploaded
 * for that project (same name and size) are not sent again.
 */
export const saveCloudProject = async (
  project: Project,
  name: string,
  id: string | null,
  onProgress: (done: number, total: number) => void
): Promise<string> => {
  const db = client();
  const uid = await userId();
  const projectId = id ?? crypto.randomUUID();
  const folder = `${uid}/${projectId}`;

  const { data: existing } = await db.storage.from(MEDIA_BUCKET).list(folder, { limit: 1000 });
  const uploaded = new Map((existing ?? []).map((item) => [item.name, item.metadata?.size as number | undefined]));

  const files = new Map<File, FileRef>();
  const register = (file: File, label: string) => {
    if (!files.has(file)) {
      const stored = `${files.size}-${safeName(label)}`;
      files.set(file, { path: `${folder}/${stored}`, name: label, type: file.type });
    }
    return files.get(file)!;
  };
  project.clips.forEach((clip) => register(clip.file, clip.name));
  if (project.music) register(project.music.file, project.music.name);

  let done = 0;
  onProgress(done, files.size);
  for (const [file, ref] of Array.from(files)) {
    const storedName = ref.path.slice(folder.length + 1);
    if (uploaded.get(storedName) !== file.size) {
      const { error } = await db.storage
        .from(MEDIA_BUCKET)
        .upload(ref.path, file, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (error) throw new Error(describeUploadError(ref.name, error.message));
    }
    onProgress(++done, files.size);
  }

  // Drop files that are no longer part of the project.
  const keep = new Set(Array.from(files.values(), (ref) => ref.path));
  const stale = (existing ?? []).map((item) => `${folder}/${item.name}`).filter((path) => !keep.has(path));
  if (stale.length > 0) await db.storage.from(MEDIA_BUCKET).remove(stale);

  const data: StoredProject = {
    ...project,
    clips: project.clips.map((clip) => ({ ...clip, file: files.get(clip.file)! })),
    music: project.music ? { ...project.music, file: files.get(project.music.file)! } : null,
  };

  const { error } = await db
    .from("projects")
    .upsert({ id: projectId, name: name.trim().slice(0, 120), data, updated_at: new Date().toISOString() });
  if (error) throw new Error("Projekt se nepodařilo uložit.");
  return projectId;
};

export const loadCloudProject = async (
  id: string,
  onProgress: (done: number, total: number) => void
): Promise<Project> => {
  const db = client();
  const { data: row, error } = await db.from("projects").select("data").eq("id", id).single();
  if (error || !row) throw new Error("Projekt se nepodařilo otevřít.");
  const stored = row.data as StoredProject;

  const refs = new Map<string, FileRef>();
  stored.clips.forEach((clip) => refs.set(clip.file.path, clip.file));
  if (stored.music) refs.set(stored.music.file.path, stored.music.file);

  const files = new Map<string, File>();
  let done = 0;
  onProgress(done, refs.size);
  for (const ref of Array.from(refs.values())) {
    const { data: blob, error: downloadError } = await db.storage.from(MEDIA_BUCKET).download(ref.path);
    if (downloadError || !blob) throw new Error(`Soubor ${ref.name} se nepodařilo stáhnout.`);
    files.set(ref.path, new File([blob], ref.name, { type: ref.type || blob.type }));
    onProgress(++done, refs.size);
  }

  return {
    ...emptyProject,
    ...stored,
    clips: stored.clips.map((clip) => ({ ...clip, file: files.get(clip.file.path)! })),
    music: stored.music ? { ...stored.music, file: files.get(stored.music.file.path)! } : null,
  };
};

export const deleteCloudProject = async (id: string): Promise<void> => {
  const db = client();
  const folder = `${await userId()}/${id}`;
  const { data: items } = await db.storage.from(MEDIA_BUCKET).list(folder, { limit: 1000 });
  if (items && items.length > 0) {
    await db.storage.from(MEDIA_BUCKET).remove(items.map((item) => `${folder}/${item.name}`));
  }
  const { error } = await db.from("projects").delete().eq("id", id);
  if (error) throw new Error("Projekt se nepodařilo smazat.");
};

// --- Invitations (admins only; enforced by database policies) ---------------------------

export interface Invitation {
  email: string;
  isAdmin: boolean;
}

export const listInvitations = async (): Promise<Invitation[]> => {
  const { data, error } = await client().from("allowed_emails").select("email, is_admin").order("email");
  if (error) throw new Error("Seznam pozvaných se nepodařilo načíst.");
  return (data ?? []).map((row) => ({ email: row.email, isAdmin: row.is_admin }));
};

export const invite = async (email: string): Promise<void> => {
  const { error } = await client().from("allowed_emails").insert({ email: email.trim().toLowerCase() });
  if (error) throw new Error(error.code === "23505" ? "Tento e-mail už pozvaný je." : "Pozvání se nepodařilo.");
};

export const revokeInvitation = async (email: string): Promise<void> => {
  const { error } = await client().from("allowed_emails").delete().eq("email", email);
  if (error) throw new Error("Pozvánku se nepodařilo odebrat.");
};
