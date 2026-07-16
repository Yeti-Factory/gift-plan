import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (data.session) navigate({ to: "/circles", replace: true });
      else navigate({ to: "/auth", replace: true });
      setChecking(false);
    });
    return () => {
      alive = false;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
        <Gift className="h-10 w-10" />
      </div>
      <h1 className="text-2xl font-bold">Gift-Box</h1>
      {checking && <p className="text-sm text-muted-foreground">Chargement…</p>}
    </div>
  );
}
