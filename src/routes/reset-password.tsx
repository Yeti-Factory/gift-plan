import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — Gift-Plan" },
      { name: "description", content: "Choisissez un nouveau mot de passe pour votre compte Gift-Plan." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery token from the URL hash automatically.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
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
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
          <Gift className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Nouveau mot de passe</h1>
      </div>

      <Card className="w-full max-w-sm p-6 space-y-4">
        {!ready ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Vérification du lien de réinitialisation...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmer</Label>
              <Input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
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