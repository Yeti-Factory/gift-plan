import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Users, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/circles/")({
  // Search-param based deep-link from the onboarding guide's final CTAs.
  // A validated param works even when this page is already mounted (the
  // effect below re-runs whenever `onboarding` changes), which sessionStorage
  // cannot do reliably.
  validateSearch: (
    search: Record<string, unknown>,
  ): { onboarding?: "create" | "join" } => {
    const v = search.onboarding;
    if (v === "create" || v === "join") return { onboarding: v };
    return {};
  },
  component: CirclesPage,
});

type Circle = { id: string; name: string; created_at: string };

function CirclesPage() {
  const { onboarding } = Route.useSearch();
  const navigate = useNavigate();
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [openJoin, setOpenJoin] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("circles")
      .select("id, name, created_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setCircles(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  // Onboarding deep-link: open Create or Join when the search param is set.
  // Strip the param afterwards so a reload / back navigation doesn't reopen it.
  useEffect(() => {
    if (onboarding === "create") setOpenCreate(true);
    else if (onboarding === "join") setOpenJoin(true);
    if (onboarding) {
      navigate({ to: "/circles", search: {}, replace: true });
    }
  }, [onboarding, navigate]);

  async function createCircle() {
    if (!name.trim()) return;
    setBusy(true);
    const { data: c, error } = await supabase.rpc("create_circle", { _name: name.trim() });
    if (error || !c) {
      setBusy(false);
      toast.error(error?.message ?? "Erreur");
      return;
    }
    setBusy(false);
    setName("");
    setOpenCreate(false);
    toast.success(`Cercle "${c.name}" créé !`);
    load();
  }

  async function joinCircle() {
    const invite = code.trim();
    if (!invite) return;
    setBusy(true);
    // join_circle_v2 returns a structured jsonb result and, crucially, persists
    // the attempt even on invalid codes (real rate limiting).
    const { data, error } = await supabase.rpc("join_circle_v2", { _code: invite });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Erreur");
      return;
    }
    const result = data as {
      ok: boolean;
      error?: string;
      circle_id?: string;
      circle_name?: string;
    } | null;
    if (!result || !result.ok) {
      const code = result?.error ?? "";
      if (code === "CODE_INVALID") toast.error("Code invalide");
      else if (code === "RATE_LIMITED")
        toast.error("Trop de tentatives, réessaie dans quelques minutes.");
      else if (code === "BANNED")
        toast.error("Tu as été retiré de ce cercle et ne peux pas y revenir.");
      else if (code === "NOT_AUTHENTICATED") toast.error("Session expirée, reconnectez-vous.");
      else toast.error(code || "Erreur");
      return;
    }
    setCode("");
    setOpenJoin(false);
    toast.success(`Bienvenue dans "${result.circle_name}" !`);
    load();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vos cercles</h1>
        <p className="text-sm text-muted-foreground">
          Famille, amis, collègues… Rassemblez vos proches.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Dialog open={openCreate} onOpenChange={setOpenCreate}>
          <DialogTrigger asChild>
            <Button className="h-14 rounded-2xl">
              <Plus className="mr-2 h-5 w-5" /> Créer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouveau cercle</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Nom du cercle</Label>
              <Input
                autoFocus
                placeholder="Famille Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button onClick={createCircle} disabled={busy || !name.trim()}>
                Créer le cercle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={openJoin} onOpenChange={setOpenJoin}>
          <DialogTrigger asChild>
            <Button variant="outline" className="h-14 rounded-2xl">
              <Users className="mr-2 h-5 w-5" /> Rejoindre
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rejoindre un cercle</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Label>Code d'invitation</Label>
              <Input
                autoFocus
                placeholder="ABC123"
                className="uppercase tracking-widest text-center"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </div>
            <DialogFooter>
              <Button onClick={joinCircle} disabled={busy || !code.trim()}>
                Rejoindre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {circles === null && <p className="text-sm text-muted-foreground">Chargement…</p>}
        {circles?.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Vous n'êtes membre d'aucun cercle. Créez-en un ou rejoignez-en un avec un code.
            </p>
          </Card>
        )}
        {circles?.map((c) => (
          <Link key={c.id} to="/circles/$circleId" params={{ circleId: c.id }} className="block">
            <Card className="p-4 flex items-center justify-between hover:bg-accent transition-colors">
              <div>
                <p className="font-semibold">{c.name}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
