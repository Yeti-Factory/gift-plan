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
import { PoweredByYetiLab } from "@/components/PoweredByYetiLab";
import { PROFILE_ACCESS_CHANGED_EVENT } from "@/lib/profile-directory";

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
  const [pendingProfileAccess, setPendingProfileAccess] = useState(0);
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
    async function loadPendingProfileAccess() {
      const { data, error } = await supabase.rpc("get_pending_profile_access_count");
      if (!error && typeof data === "number") setPendingProfileAccess(data);
    }

    loadPendingProfileAccess();
    const interval = window.setInterval(loadPendingProfileAccess, 30_000);
    window.addEventListener(PROFILE_ACCESS_CHANGED_EVENT, loadPendingProfileAccess);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PROFILE_ACCESS_CHANGED_EVENT, loadPendingProfileAccess);
    };
  }, [user.id]);

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
      <header className="sticky top-0 z-40 border-b border-white/70 bg-background/75 px-4 py-2.5 shadow-sm backdrop-blur-xl">
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

      <main className="flex-1 pb-20">
        {showBack && (
          <div className="mx-auto max-w-md px-4 pt-4">
            <BackButton fallback="/people" />
          </div>
        )}
        <Outlet />
        <div className="mx-auto flex max-w-md justify-center px-4 pt-8">
          <PoweredByYetiLab />
        </div>
      </main>

      <OnboardingGuide user={user} />

      <nav className="fixed bottom-2 inset-x-2 z-40 mx-auto max-w-md rounded-2xl border border-white/80 bg-background/90 shadow-lg backdrop-blur-xl">
        <div className="grid grid-cols-5 px-1">
          <NavItem
            to="/people"
            icon={<UserRoundSearch className="h-4 w-4" />}
            label="Communauté"
            badge={pendingProfileAccess}
          />
          <NavItem to="/my-lists" icon={<ListChecks className="h-4 w-4" />} label="Mes listes" />
          <NavItem to="/gifts-i-offer" icon={<Package className="h-4 w-4" />} label="J'offre" />
          <NavItem to="/circles" icon={<Users className="h-4 w-4" />} label="Cercles" />
          <NavItem to="/profile" icon={<UserCircle className="h-4 w-4" />} label="Mon profil" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  badge = 0,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-0.5 rounded-xl py-2 text-[10px] text-muted-foreground transition data-[status=active]:bg-primary/10 data-[status=active]:text-primary"
      activeProps={{ className: "text-primary font-medium" }}
    >
      <span className="relative">
        {icon}
        {badge > 0 && (
          <span className="absolute -right-2 -top-1.5 flex min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[8px] font-bold leading-3.5 text-primary-foreground">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      {label}
    </Link>
  );
}
