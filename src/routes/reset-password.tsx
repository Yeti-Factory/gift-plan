import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Gift } from "lucide-react";
import { toast } from "sonner";

import { BackButton } from "@/components/BackButton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/self-hosted/auth-client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Gift-Plan" },
      { name: "description", content: "Choisissez un nouveau mot de passe Gift-Plan." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("token") ?? "";
    if (params.get("error") || !resetToken) {
      setLinkError("Ce lien de réinitialisation est invalide ou expiré. Demande un nouveau lien.");
    } else {
      setToken(resetToken);
    }
    setCheckingLink(false);
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Mot de passe trop court (8 caractères minimum).");
      return;
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (error) {
      toast.error(error.message ?? "Ce lien est invalide ou expiré.");
      return;
    }
    toast.success("Mot de passe mis à jour ✅");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <div className="-mt-4 mb-2 w-full max-w-sm">
        <BackButton fallback="/auth" />
      </div>
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
          <Gift className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Nouveau mot de passe</h1>
      </div>

      <Card className="w-full max-w-sm space-y-4 p-6">
        {checkingLink ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Vérification du lien…</p>
        ) : linkError ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{linkError}</p>
            <Button className="w-full" onClick={() => navigate({ to: "/auth", replace: true })}>
              Demander un nouveau lien
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <PasswordField
              id="new-password"
              label="Nouveau mot de passe"
              value={password}
              visible={showPwd}
              onVisible={setShowPwd}
              onChange={setPassword}
            />
            <PasswordField
              id="confirm-password"
              label="Confirmer"
              value={confirm}
              visible={showConfirm}
              onVisible={setShowConfirm}
              onChange={setConfirm}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enregistrement…" : "Mettre à jour"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  visible,
  onVisible,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  visible: boolean;
  onVisible: (value: boolean) => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={8}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => onVisible(!visible)}
          aria-label={visible ? "Masquer" : "Afficher"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
