import { useCallback, useEffect, useState } from "react";
import { DownloadCloud, UploadCloud, LogOut, Trash2, UserPlus } from "lucide-react";
import { useAccess } from "@/components/AuthGate";
import {
  deleteCloudProject,
  invite,
  listCloudProjects,
  listInvitations,
  loadCloudProject,
  revokeInvitation,
  saveCloudProject,
  type CloudProjectInfo,
  type Invitation,
} from "@/lib/editor/cloud";
import type { Project } from "@/lib/editor/types";
import { toast } from "./toast";
import { heading, iconButton, panel, primaryButton, secondaryButton, textInput } from "./ui";

interface CloudPanelProps {
  project: Project;
  disabled: boolean;
  onOpen: (project: Project) => void;
}

const fail = (error: unknown) =>
  toast({
    title: "Cloud",
    description: error instanceof Error ? error.message : "Operace se nezdařila.",
    variant: "destructive",
  });

const CloudPanel = ({ project, disabled, onOpen }: CloudPanelProps) => {
  const { user, isAdmin, signOut } = useAccess();
  const [projects, setProjects] = useState<CloudProjectInfo[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");

  const refresh = useCallback(async () => {
    try {
      setProjects(await listCloudProjects());
      if (isAdmin) setInvitations(await listInvitations());
    } catch (error) {
      fail(error);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  if (!user) {
    return (
      <div className={panel}>
        <h3 className={heading}>Cloud</h3>
        <p className="text-sm text-muted-foreground">
          Cloud není nastaven. Projekt se ukládá jen v tomto prohlížeči. Pro přihlášení a cloudové projekty
          doplňte Supabase údaje do <code>.env.local</code> (viz README).
        </p>
      </div>
    );
  }

  const progress = (verb: string) => (done: number, total: number) => setBusy(`${verb} ${done}/${total}`);

  const handleSave = async (id: string | null) => {
    const label = name.trim() || projects.find((p) => p.id === id)?.name || "";
    if (!label) {
      toast({ title: "Zadejte název projektu", variant: "destructive" });
      return;
    }
    try {
      setBusy("Ukládám...");
      const savedId = await saveCloudProject(project, label, id, progress("Nahrávám soubory"));
      setCurrentId(savedId);
      setName(label);
      toast({ title: "Uloženo do cloudu", description: label });
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  };

  const handleOpen = async (info: CloudProjectInfo) => {
    if (project.clips.length > 0 && !window.confirm(`Otevřít „${info.name}“? Nahradí aktuální časovou osu.`)) return;
    try {
      setBusy("Otevírám...");
      onOpen(await loadCloudProject(info.id, progress("Stahuji soubory")));
      setCurrentId(info.id);
      setName(info.name);
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  };

  const handleDelete = async (info: CloudProjectInfo) => {
    if (!window.confirm(`Smazat „${info.name}“ z cloudu včetně souborů?`)) return;
    try {
      setBusy("Mažu...");
      await deleteCloudProject(info.id);
      if (currentId === info.id) setCurrentId(null);
      await refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy("");
    }
  };

  const handleInvite = async () => {
    try {
      await invite(inviteEmail);
      setInviteEmail("");
      await refresh();
    } catch (error) {
      fail(error);
    }
  };

  const locked = disabled || busy !== "";

  return (
    <div className={panel}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={heading}>Cloud</h3>
        <button onClick={signOut} className={`${iconButton} flex items-center gap-1.5 text-xs`} title={user.email}>
          <LogOut className="w-4 h-4" />
          Odhlásit
        </button>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Název projektu"
          aria-label="Název projektu"
          maxLength={120}
          className={textInput}
        />
        <button
          onClick={() => handleSave(currentId)}
          disabled={locked || project.clips.length === 0}
          className={primaryButton}
        >
          <UploadCloud className="w-5 h-5" />
          {busy || (currentId ? "Uložit změny do cloudu" : "Uložit do cloudu")}
        </button>
        {currentId && (
          <button onClick={() => handleSave(null)} disabled={locked} className={`${secondaryButton} w-full`}>
            Uložit jako nový projekt
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          Nahrává se časová osa i zdrojová videa. Volný tarif Supabase má 1 GB úložiště a limit 50 MB na soubor.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Uložené projekty</p>
        {projects.length === 0 && <p className="text-sm text-muted-foreground">Zatím žádné.</p>}
        {projects.map((info) => (
          <div key={info.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{info.name}</p>
              <p className="text-xs text-muted-foreground">{new Date(info.updatedAt).toLocaleString("cs-CZ")}</p>
            </div>
            <button
              onClick={() => handleOpen(info)}
              disabled={locked}
              aria-label={`Otevřít ${info.name}`}
              className={iconButton}
            >
              <DownloadCloud className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleDelete(info)}
              disabled={locked}
              aria-label={`Smazat ${info.name}`}
              className={`${iconButton} hover:text-destructive`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {isAdmin && (
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">Pozvaní uživatelé</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="e-mail"
              aria-label="E-mail pozvaného"
              className={textInput}
            />
            <button
              onClick={handleInvite}
              disabled={!/^\S+@\S+\.\S+$/.test(inviteEmail.trim())}
              aria-label="Pozvat"
              className={`${primaryButton} !w-auto px-4`}
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
          {invitations.map((entry) => (
            <div key={entry.email} className="flex items-center gap-2 text-sm">
              <span className="flex-1 min-w-0 truncate">
                {entry.email}
                {entry.isAdmin && <span className="ml-2 text-xs text-primary">správce</span>}
              </span>
              {entry.email !== user.email?.toLowerCase() && (
                <button
                  onClick={() => revokeInvitation(entry.email).then(refresh).catch(fail)}
                  aria-label={`Odebrat ${entry.email}`}
                  className={`${iconButton} hover:text-destructive`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Pozvaný si sám vytvoří účet se stejným e-mailem. Pozvánka e-mail neposílá, dejte mu vědět sami.
          </p>
        </div>
      )}
    </div>
  );
};

export default CloudPanel;
