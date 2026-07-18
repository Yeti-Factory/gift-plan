import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Power, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

type AdminStatus = { maintenance: boolean; message: string; is_superadmin: boolean };

function parseStatus(value: unknown): AdminStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const status = value as Record<string, unknown>;
  return {
    maintenance: status.maintenance === true,
    message: typeof status.message === "string" ? status.message : "",
    is_superadmin: status.is_superadmin === true,
  };
}

function AdminPage() {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_app_status");
    if (error) {
      toast.error("Impossible de charger le panneau d’administration.");
      return;
    }
    const next = parseStatus(data);
    setStatus(next);
    setMessage(next?.message ?? "");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(enabled: boolean) {
    setBusy(true);
    const { data, error } = await supabase.rpc("set_maintenance_mode", {
      _enabled: enabled,
      _message: message,
    });
    setBusy(false);
    if (error) {
      toast.error("La maintenance n’a pas pu être modifiée.");
      return;
    }
    const next = parseStatus(data);
    if (next) setStatus(next);
    toast.success(enabled ? "Mode maintenance activé" : "Gift-Plan est de nouveau accessible");
  }

  if (status && !status.is_superadmin) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Accès réservé</h1>
        <p className="mt-2 text-muted-foreground">Ce panneau est réservé au concepteur.</p>
        <Button asChild className="mt-5">
          <Link to="/people">Retour</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="gp-mesh min-h-[calc(100vh-8rem)] px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Superadmin</p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">
              Tour de contrôle
            </h1>
          </div>
          <BrandMark compact />
        </div>

        <Card className="gp-glass overflow-hidden rounded-[1.75rem] border-0 p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Wrench className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold">Mode maintenance</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Bloque l’application pour tous, sauf toi.
                  </p>
                </div>
                <Switch
                  checked={status?.maintenance ?? false}
                  disabled={!status || busy}
                  onCheckedChange={save}
                  aria-label="Mode maintenance"
                />
              </div>

              <div className="mt-6 space-y-2">
                <Label htmlFor="maintenance-message">Message affiché aux visiteurs</Label>
                <Textarea
                  id="maintenance-message"
                  value={message}
                  maxLength={500}
                  rows={4}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Gift-Plan revient très vite…"
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={!status || busy}
                  onClick={() => save(status?.maintenance ?? false)}
                >
                  Enregistrer le message
                </Button>
                {status?.maintenance && (
                  <Button disabled={busy} onClick={() => save(false)}>
                    <Power className="h-4 w-4" /> Rouvrir Gift-Plan
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-[1.5rem] p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <div className="flex-1">
              <p className="font-semibold">Ton accès reste toujours ouvert</p>
              <p className="text-sm text-muted-foreground">
                Connecte-toi avec ton compte Yovan pour contourner la maintenance.
              </p>
            </div>
            <Button asChild variant="ghost" size="icon">
              <a href="/" target="_blank" rel="noreferrer" aria-label="Ouvrir Gift-Plan">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
