import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, RefreshCw, ChevronRight, Gift } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/gift-box";
export const Route = createFileRoute("/_authenticated/circles/$circleId")({
    component: CircleDetail,
});
function CircleDetail() {
    const { circleId } = Route.useParams();
    const [circle, setCircle] = useState(null);
    const [members, setMembers] = useState([]);
    const [me, setMe] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [regenBusy, setRegenBusy] = useState(false);
    async function load() {
        const { data: user } = await supabase.auth.getUser();
        setMe(user.user?.id ?? null);
        const { data: c } = await supabase
            .from("circles")
            .select("name, invite_code")
            .eq("id", circleId)
            .maybeSingle();
        setCircle(c);
        const { data: mems } = await supabase
            .from("circle_members")
            .select("user_id, role")
            .eq("circle_id", circleId);
        const meId = user.user?.id;
        setIsAdmin(!!(mems ?? []).find((m) => m.user_id === meId && m.role === "admin"));
        const userIds = (mems ?? []).map((m) => m.user_id);
        if (userIds.length === 0) {
            setMembers([]);
            return;
        }
        const { data: profs } = await supabase
            .from("profiles")
            .select("id, display_name, avatar_url")
            .in("id", userIds);
        const { data: lists } = await supabase
            .from("lists")
            .select("owner_id")
            .eq("circle_id", circleId);
        const listCounts = new Map();
        (lists ?? []).forEach((l) => listCounts.set(l.owner_id, (listCounts.get(l.owner_id) ?? 0) + 1));
        const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
        setMembers((mems ?? []).map((m) => ({
            user_id: m.user_id,
            role: m.role,
            profile: profMap.get(m.user_id)
                ? {
                    display_name: profMap.get(m.user_id).display_name,
                    avatar_url: profMap.get(m.user_id).avatar_url,
                }
                : null,
            listCount: listCounts.get(m.user_id) ?? 0,
        })));
    }
    useEffect(() => {
        load();
    }, [circleId]);
    function copyCode() {
        if (!circle)
            return;
        navigator.clipboard.writeText(circle.invite_code);
        toast.success("Code copié !");
    }
    async function regenerateCode() {
        if (!confirm("Générer un nouveau code ? L'ancien ne fonctionnera plus."))
            return;
        setRegenBusy(true);
        const { data, error } = await supabase.rpc("regenerate_invite_code", { _circle_id: circleId });
        setRegenBusy(false);
        if (error || !data) {
            const msg = error?.message ?? "";
            if (msg.includes("NOT_ADMIN"))
                toast.error("Seul un administrateur peut régénérer le code.");
            else
                toast.error(msg || "Erreur");
            return;
        }
        setCircle((c) => (c ? { ...c, invite_code: data } : c));
        toast.success("Nouveau code généré !");
    }
    if (!circle)
        return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
    return (<div className="mx-auto max-w-md px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{circle.name}</h1>
        <p className="text-sm text-muted-foreground">{members.length} membre{members.length > 1 ? "s" : ""}</p>
      </div>

      <Card className="p-4 bg-secondary">
        <p className="text-xs text-muted-foreground">Code d'invitation</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-2xl font-bold tracking-widest">{circle.invite_code}</span>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={copyCode}>
              <Copy className="h-4 w-4 mr-1"/> Copier
            </Button>
            {isAdmin && (<Button size="sm" variant="ghost" onClick={regenerateCode} disabled={regenBusy}>
                <RefreshCw className={`h-4 w-4 mr-1 ${regenBusy ? "animate-spin" : ""}`}/> Régénérer
              </Button>)}
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
          Membres
        </h2>
        {members.map((m) => {
            const isMe = m.user_id === me;
            const name = m.profile?.display_name ?? "Membre";
            return (<Link key={m.user_id} to="/circles/$circleId/members/$userId" params={{ circleId, userId: m.user_id }} className="block group">
              <Card className="p-3 flex flex-col gap-3 hover:bg-accent transition-colors">
                <div className="flex items-center gap-3">
                  <Avatar>
                    {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url}/>}
                    <AvatarFallback>{initials(name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {name} {isMe && <span className="text-xs text-muted-foreground">(vous)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.listCount} liste{m.listCount > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-xs text-muted-foreground">
                    {isMe ? "Gérer ma liste" : "Voir les cadeaux de ce membre"}
                  </span>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground group-hover:opacity-90 transition-opacity">
                    <Gift className="h-4 w-4"/>
                    {isMe ? "Gérer" : "Voir les cadeaux"}
                    <ChevronRight className="h-4 w-4"/>
                  </div>
                </div>
              </Card>
            </Link>);
        })}
      </div>
    </div>);
}
