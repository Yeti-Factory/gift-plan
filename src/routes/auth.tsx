import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Mail } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ensureProfile } from "@/lib/gift-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Se connecter — Gift-Box" },
      { name: "description", content: "Connectez-vous à Gift-Box pour partager vos listes de cadeaux." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        ensureProfile(data.session.user).catch(() => {});
        navigate({ to: "/circles", replace: true });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        ensureProfile(session.user).catch(() => {});
        navigate({ to: "/circles", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      setSent(true);
      toast.success("Lien envoyé — vérifiez votre boîte mail.");
    }
  }

  async function signInGoogle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    setLoading(false);
    if (result.error) toast.error("Connexion Google impossible.");
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
          <Gift className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Gift-Box</h1>
        <p className="text-center text-sm text-muted-foreground max-w-xs">
          Vos listes de cadeaux, partagées avec ceux qui comptent.
        </p>
      </div>

      <Card className="w-full max-w-sm p-6 space-y-4">
        {sent ? (
          <div className="text-center space-y-2 py-6">
            <Mail className="h-10 w-10 mx-auto text-primary" />
            <p className="font-medium">Vérifiez votre boîte mail</p>
            <p className="text-sm text-muted-foreground">
              Nous vous avons envoyé un lien de connexion à {email}.
            </p>
            <Button variant="ghost" className="mt-2" onClick={() => setSent(false)}>
              Utiliser une autre adresse
            </Button>
          </div>
        ) : (
          <>
            <form onSubmit={sendMagicLink} className="space-y-3">
              <Input
                type="email"
                required
                inputMode="email"
                autoComplete="email"
                placeholder="vous@exemple.fr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                Recevoir un lien magique
              </Button>
            </form>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={signInGoogle} disabled={loading}>
              Continuer avec Google
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}