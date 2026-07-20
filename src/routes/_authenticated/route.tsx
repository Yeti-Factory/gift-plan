import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useNavigate,
  useRouter,
  useLocation,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Package,
  ListChecks,
  LogOut,
  UserRoundSearch,
  Users,
  UserCircle,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ensureProfile } from "@/lib/gift-box";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/BackButton";
import { BrandMark } from "@/components/BrandMark";
import { OnboardingGuide } from "@/components/OnboardingGuide";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [isSuperadmin, setIsSuperadmin] = useState(false);
  const pathname = useLocation({ select: (l) => l.pathname });
  const topLevel = new Set([
    "/people",
    "/my-lists",
    "/gifts-i-offer",
    "/circles",
    "/profile",
    "/admin",
  ]);
  const showBack = !topLevel.has(pathname);

  useEffect(() => {
    ensureProfile(user).catch(() => {});
    supabase.rpc("is_superadmin").then(({ data }) => {
      setIsSuperadmin(data === true);
    });
  }, [user]);

  useEffect(() => {
    const channel = supabase
      .channel("gifts-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gifts" },
        async (payload) => {
          const row = payload.new as { owner_id: string; title: string; list_id: string };
          if (!row || row.owner_id === user.id) return;
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("id", row.owner_id)
            .maybeSingle();
          const name = profile?.display_name ?? "Un membre";
          toast(`🎁 ${name} a ajouté un cadeau`, {
            description: row.title,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  async function signOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="gp-mesh min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-background/75 px-4 py-3 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/people" aria-label="Accueil Gift-Plan">
            <BrandMark />
          </Link>
          <div className="flex items-center gap-1">
            {isSuperadmin && (
              <Button asChild variant="ghost" size="icon" aria-label="Administration">
                <Link to="/admin">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              disabled={signingOut}
              aria-label="Se déconnecter"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {showBack && (
          <div className="mx-auto max-w-md px-4 pt-4">
            <BackButton fallback="/people" />
          </div>
        )}
        <Outlet />
      </main>

      <OnboardingGuide user={user} />

      <nav className="fixed bottom-3 inset-x-3 z-40 mx-auto max-w-md rounded-[1.4rem] border border-white/80 bg-background/90 shadow-xl backdrop-blur-xl">
        <div className="grid grid-cols-5 px-1">
          <NavItem to="/people" icon={<UserRoundSearch className="h-5 w-5" />} label="Profils" />
          <NavItem to="/my-lists" icon={<ListChecks className="h-5 w-5" />} label="Mes listes" />
          <NavItem to="/gifts-i-offer" icon={<Package className="h-5 w-5" />} label="J'offre" />
          <NavItem to="/circles" icon={<Users className="h-5 w-5" />} label="Cercles" />
          <NavItem to="/profile" icon={<UserCircle className="h-5 w-5" />} label="Profil" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[11px] text-muted-foreground transition data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
      activeProps={{ className: "text-primary font-medium" }}
    >
      {icon}
      {label}
    </Link>
  );
}
