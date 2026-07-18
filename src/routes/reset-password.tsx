import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { clearPasswordRecoveryMark, markPasswordRecovery } from "@/lib/password-recovery";
import { BackButton } from "@/components/BackButton";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Gift-Plan" },
      {
        name: "description",
        content: "Choisissez un nouveau mot de passe pour votre compte Gift-Plan.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    markPasswordRecovery();

    async function prepareRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const code = params.get("code");

      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: "recovery",
          token_hash: tokenHash,
        });

        if (!alive) return;
        if (error) {
          setLinkError(
            "Ce lien de réinitialisation est invalide ou expiré. Demande un nouveau lien.",
          );
          setCheckingLink(false);
          return;
        }

        setReady(true);
        setCheckingLink(false);
        window.history.replaceState(null, "", "/reset-password");
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!alive) return;
        if (error) {
          setLinkError(
            "Ce lien de réinitialisation est invalide ou expiré. Demande un nouveau lien.",
          );
          setCheckingLink(false);
          return;
        }

        setReady(true);
        setCheckingLink(false);
        window.history.replaceState(null, "", "/reset-password");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) setReady(true);
      setCheckingLink(false);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    prepareRecoverySession();
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Mot de passe trop court (6 caractères minimum).");
      return;
    }
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mot de passe mis à jour ✅");
    clearPasswordRecoveryMark();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm mb-2 -mt-4">
        <BackButton fallback="/auth" />
      </div>
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
          <Gift className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Nouveau mot de passe</h1>
      </div>

      <Card className="w-full max-w-sm p-6 space-y-4">
        {checkingLink ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Vérification du lien de réinitialisation...
          </p>
        ) : linkError ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{linkError}</p>
            <Button
              type="button"
              className="w-full"
              onClick={() => navigate({ to: "/auth", replace: true })}
            >
              Demander un nouveau lien
            </Button>
          </div>
        ) : !ready ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Ouvre cette page depuis le lien reçu par email pour choisir un nouveau mot de passe.
            </p>
            <Button
              type="button"
              className="w-full"
              onClick={() => navigate({ to: "/auth", replace: true })}
            >
              Retour à la connexion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPwd ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Masquer" : "Afficher"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enregistrement..." : "Mettre à jour"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
