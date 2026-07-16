import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Home, Package, ListChecks, LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { ensureProfile } from "@/lib/gift-box";
import { Button } from "@/components/ui/button";

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

  useEffect(() => {
    ensureProfile(user).catch(() => {});
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
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-background/90 backdrop-blur px-4 py-3">
        <Link to="/circles" className="flex items-center gap-2 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Gift className="h-4 w-4" />
          </div>
          Gift-Plan
        </Link>
        <Button variant="ghost" size="icon" onClick={signOut} disabled={signingOut} aria-label="Se déconnecter">
          <LogOut className="h-5 w-5" />
        </Button>
      </header>

      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3">
          <NavItem to="/circles" icon={<Home className="h-5 w-5" />} label="Cercles" />
          <NavItem to="/my-lists" icon={<ListChecks className="h-5 w-5" />} label="Mes listes" />
          <NavItem to="/gifts-i-offer" icon={<Package className="h-5 w-5" />} label="J'offre" />
        </div>
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-1 py-3 text-xs text-muted-foreground data-[status=active]:text-primary"
      activeProps={{ className: "text-primary font-medium" }}
    >
      {icon}
      {label}
    </Link>
  );
}