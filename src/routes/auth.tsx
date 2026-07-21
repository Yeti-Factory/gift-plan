import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ensureProfile } from "@/lib/gift-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { markPasswordRecovery, redirectToResetPasswordIfNeeded } from "@/lib/password-recovery";
import { BrandMark } from "@/components/BrandMark";
import { PoweredByYetiLab } from "@/components/PoweredByYetiLab";

const RESET_PASSWORD_REDIRECT_URL = "https://gift-plan.yeti-lab.fr/reset-password";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Se connecter — Gift-Plan" },
      {
        name: "description",
        content: "Connectez-vous à Gift-Plan pour partager vos listes de cadeaux.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [showSigninPwd, setShowSigninPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);

  useEffect(() => {
    if (redirectToResetPasswordIfNeeded()) return;

    supabase.auth.getSession().then(({ data }) => {
      if (redirectToResetPasswordIfNeeded()) return;
      if (data.session) {
        ensureProfile(data.session.user).catch(() => {});
        navigate({ to: "/people", replace: true });
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecovery();
        redirectToResetPasswordIfNeeded();
        return;
      }
      if (event === "SIGNED_IN" && redirectToResetPasswordIfNeeded()) return;
      if (event === "SIGNED_IN" && session) {
        ensureProfile(session.user).catch(() => {});
        navigate({ to: "/people", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  function translateError(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("invalid login") || m.includes("invalid credentials")) {
      return "Email ou mot de passe incorrect.";
    }
    if (
      m.includes("already registered") ||
      m.includes("already exists") ||
      m.includes("user already")
    ) {
      return "Cet email est déjà utilisé.";
    }
    if (m.includes("password") && (m.includes("6") || m.includes("short") || m.includes("weak"))) {
      return "Mot de passe trop court (6 caractères minimum).";
    }
    if (m.includes("email not confirmed")) {
      return "Confirme d'abord ton adresse email (vérifie ta boîte mail).";
    }
    return msg;
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(translateError(error.message));
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Mot de passe trop court (6 caractères minimum).");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() || email.split("@")[0] },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(translateError(error.message));
      return;
    }
    if (!data.session) {
      toast.success("Vérifie ta boîte mail pour confirmer ton inscription ✉️");
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: RESET_PASSWORD_REDIRECT_URL,
      });
      if (error) throw error;
      toast.success(
        "Si un compte existe pour cet email, un lien vient d'être envoyé. Pense à vérifier tes spams / courriers indésirables.",
        { duration: 8000 },
      );
      setForgotOpen(false);
      setForgotEmail("");
    } catch {
      toast.error("Impossible d'envoyer l'email. Réessaie dans un instant.");
    } finally {
      setLoading(false);
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
    <div className="gp-mesh relative min-h-screen overflow-hidden px-6 py-10 flex flex-col items-center justify-center">
      <div className="gp-dots pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative z-10 flex flex-col items-center gap-3 mb-8">
        <BrandMark />
        <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-medium text-primary shadow-sm">
          <Sparkles className="h-3 w-3" /> La surprise commence ici
        </div>
        <h1 className="mt-2 max-w-sm text-center font-display text-4xl font-bold tracking-[-0.04em]">
          Heureux de vous revoir.
        </h1>
        <p className="text-center text-sm text-muted-foreground max-w-xs">
          Vos envies, vos proches, et toujours le plaisir de la surprise.
        </p>
      </div>

      <Card className="gp-glass relative z-10 w-full max-w-sm space-y-4 rounded-[1.75rem] border-0 p-6">
        {forgotOpen ? (
          <form onSubmit={handleForgot} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Mot de passe oublié</Label>
              <Input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                placeholder="vous@exemple.fr"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Envoi..." : "Envoyer le lien"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setForgotOpen(false)}
            >
              Retour
            </Button>
          </form>
        ) : (
          <>
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Se connecter</TabsTrigger>
                <TabsTrigger value="signup">Créer un compte</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-3 mt-4">
                <form onSubmit={handleSignIn} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="vous@exemple.fr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showSigninPwd ? "text" : "password"}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSigninPwd((v) => !v)}
                        aria-label={
                          showSigninPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"
                        }
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      >
                        {showSigninPwd ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Connexion..." : "Se connecter"}
                  </Button>
                </form>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                  }}
                  className="text-sm text-muted-foreground hover:text-primary underline w-full text-center"
                >
                  Mot de passe oublié ?
                </button>
              </TabsContent>

              <TabsContent value="signup" className="space-y-3 mt-4">
                <form onSubmit={handleSignUp} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nom</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="Marie Dupont"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="vous@exemple.fr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Mot de passe</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignupPwd ? "text" : "password"}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPwd((v) => !v)}
                        aria-label={
                          showSignupPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"
                        }
                        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                      >
                        {showSignupPwd ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">6 caractères minimum.</p>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Création..." : "Créer mon compte"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

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

      <nav className="relative z-10 mt-6 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        <Link to="/legal/mentions-legales" className="hover:text-primary">
          Mentions légales
        </Link>
        <Link to="/legal/confidentialite" className="hover:text-primary">
          Confidentialité
        </Link>
        <Link to="/legal/cgu" className="hover:text-primary">
          CGU
        </Link>
      </nav>
      <PoweredByYetiLab className="relative z-10 mt-4" />
    </div>
  );
}
