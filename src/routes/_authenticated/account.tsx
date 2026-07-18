import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Trash2, User as UserIcon, Mail, KeyRound, Download } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Mon compte — Gift-Plan" },
      {
        name: "description",
        content: "Gérez votre profil, votre email, votre mot de passe et votre compte Gift-Plan.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();

  // Display name
  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Email
  const [email, setEmail] = useState(user.email ?? "");
  const [savingEmail, setSavingEmail] = useState(false);

  // Password
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");
  const deleteAccountFn = useServerFn(deleteMyAccount);
  const exportDataFn = useServerFn(exportMyData);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const data = await exportDataFn();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gift-plan-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export téléchargé ✅");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export impossible");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setDisplayName(data?.display_name ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  async function saveDisplayName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed.length < 1 || trimmed.length > 60) {
      toast.error("Le nom doit contenir entre 1 et 60 caractères.");
      return;
    }
    setSavingName(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", user.id);
    setSavingName(false);
    if (error) toast.error("Impossible de mettre à jour le nom.");
    else toast.success("Nom mis à jour.");
  }

  async function saveEmail(e: React.FormEvent) {
    e.preventDefault();
    const next = email.trim();
    if (!next || next === user.email) return;
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: next });
    setSavingEmail(false);
    if (error) {
      toast.error(
        error.message.includes("already")
          ? "Cet email est déjà utilisé."
          : "Impossible de changer l'email.",
      );
      return;
    }
    toast.success("Un email de confirmation vient d'être envoyé aux deux adresses.", {
      duration: 8000,
    });
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd.length < 6) {
      toast.error("Le nouveau mot de passe doit faire 6 caractères minimum.");
      return;
    }
    if (newPwd !== confirmPwd) {
      toast.error("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!user.email) {
      toast.error("Email introuvable sur ce compte.");
      return;
    }
    setSavingPwd(true);
    // Re-auth: verify current password
    const { error: reauthErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPwd,
    });
    if (reauthErr) {
      setSavingPwd(false);
      toast.error("Mot de passe actuel incorrect.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setSavingPwd(false);
    if (error) {
      toast.error("Impossible de changer le mot de passe.");
      return;
    }
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    toast.success("Mot de passe mis à jour.");
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccountFn({ data: { password: deletePwd || undefined } });
      await supabase.auth.signOut();
      router.invalidate();
      toast.success("Compte supprimé.");
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Suppression impossible.";
      toast.error(msg);
    } finally {
      setDeleting(false);
    }
  }

  async function reauthViaSignout() {
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto max-w-md px-4 py-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon compte</h1>
        <p className="text-sm text-muted-foreground">Gérez vos informations personnelles.</p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <UserIcon className="h-4 w-4 text-primary" /> Nom affiché
        </div>
        <form onSubmit={saveDisplayName} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="display-name">Nom visible dans les cercles</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
              required
            />
          </div>
          <Button type="submit" disabled={savingName} className="w-full">
            {savingName ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </form>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="h-4 w-4 text-primary" /> Adresse email
        </div>
        <form onSubmit={saveEmail} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="account-email">Email</Label>
            <Input
              id="account-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Un lien de confirmation sera envoyé à la nouvelle adresse.
            </p>
          </div>
          <Button
            type="submit"
            disabled={savingEmail || email.trim() === user.email}
            className="w-full"
          >
            {savingEmail ? "Envoi..." : "Changer l'email"}
          </Button>
        </form>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <KeyRound className="h-4 w-4 text-primary" /> Mot de passe
        </div>
        <form onSubmit={savePassword} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="current-pwd">Mot de passe actuel</Label>
            <div className="relative">
              <Input
                id="current-pwd"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                aria-label={showCurrent ? "Masquer" : "Afficher"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="new-pwd"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                minLength={6}
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                aria-label={showNew ? "Masquer" : "Afficher"}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">6 caractères minimum.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pwd">Confirmer le nouveau mot de passe</Label>
            <Input
              id="confirm-pwd"
              type={showNew ? "text" : "password"}
              autoComplete="new-password"
              minLength={6}
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={savingPwd} className="w-full">
            {savingPwd ? "Mise à jour..." : "Changer le mot de passe"}
          </Button>
        </form>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Download className="h-4 w-4" /> Exporter mes données
        </div>
        <p className="text-sm text-muted-foreground">
          Téléchargez au format JSON toutes les données personnelles que Gift-Plan détient à votre
          sujet (profil, cercles, listes, cadeaux, réservations que vous avez posées). Les
          réservations posées par d'autres sur vos propres cadeaux sont exclues pour préserver la
          surprise.
        </p>
        <Button variant="outline" className="w-full" onClick={handleExport} disabled={exporting}>
          {exporting ? "Préparation..." : "Télécharger mon export (JSON)"}
        </Button>
      </Card>

      <Card className="p-5 space-y-3 border-destructive/40">
        <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
          <Trash2 className="h-4 w-4" /> Zone de danger
        </div>
        <p className="text-sm text-muted-foreground">
          Supprimer votre compte est <strong>définitif</strong>. Vous quitterez tous vos cercles
          (avec transfert automatique quand vous en êtes le créateur), et vos listes, cadeaux et
          réservations seront effacés.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full">
              Supprimer mon compte
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement votre compte ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Pour confirmer, saisissez votre mot de passe (ou
                reconnectez-vous si vous utilisez Google) et tapez <strong>SUPPRIMER</strong>. La
                réauthentification est valable 5 minutes.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Input
                type="password"
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                placeholder="Mot de passe actuel (facultatif si Google)"
                autoComplete="current-password"
              />
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="SUPPRIMER"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={reauthViaSignout}
                className="text-xs text-muted-foreground underline"
              >
                Se reconnecter pour rafraîchir la session
              </button>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDeleteConfirm("");
                  setDeletePwd("");
                }}
              >
                Annuler
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteConfirm !== "SUPPRIMER" || deleting}
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? "Suppression..." : "Supprimer"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}
