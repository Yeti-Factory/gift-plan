import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Copy,
  RefreshCw,
  ChevronRight,
  Gift,
  MoreVertical,
  LogOut,
  Shield,
  ShieldOff,
  UserMinus,
  Crown,
  History,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { initials } from "@/lib/gift-box";

export const Route = createFileRoute("/_authenticated/circles/$circleId/")({
  component: CircleDetail,
});

type Member = {
  user_id: string;
  role: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  listCount: number;
};

type ActivityRow = {
  id: string;
  action: string;
  actor_name: string | null;
  target_name: string | null;
  created_at: string;
};

function describeActivity(row: ActivityRow): string {
  const actor = row.actor_name?.trim() || "Quelqu'un";
  const target = row.target_name?.trim() || "un membre";
  switch (row.action) {
    case "role_promoted":
      return `${actor} a nommé ${target} administrateur`;
    case "role_demoted":
      return `${actor} a retiré le rôle d'administrateur à ${target}`;
    case "member_removed":
      return `${actor} a retiré ${target} du cercle`;
    case "member_left":
      return `${actor} a quitté le cercle`;
    case "ownership_transferred":
      return `${actor} a transféré l'administration à ${target}`;
    case "circle_deleted_on_leave":
      return `${actor} a supprimé le cercle en le quittant`;
    default:
      return `${actor} a effectué une action`;
  }
}

function formatActivityDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function translateError(msg: string): string {
  if (msg.includes("NOT_ADMIN")) return "Seul un administrateur peut faire cela";
  if (msg.includes("FORBIDDEN_CREATOR")) return "Le créateur du cercle ne peut pas être modifié";
  if (msg.includes("NOT_MEMBER")) return "Tu ne fais pas partie de ce cercle";
  if (msg.includes("NOT_AUTHENTICATED")) return "Session expirée, reconnecte-toi";
  if (msg.includes("RATE_LIMITED")) return "Trop de tentatives, réessaie dans quelques minutes";
  if (msg.includes("BANNED")) return "Tu as été retiré de ce cercle et ne peux pas y revenir";
  if (msg.includes("CODE_INVALID")) return "Code d'invitation invalide ou expiré";
  return msg || "Erreur";
}

function CircleDetail() {
  const { circleId } = Route.useParams();
  const navigate = useNavigate();
  const [circle, setCircle] = useState<{ name: string; created_by: string } | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [regenOpen, setRegenOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{ userId: string; name: string } | null>(null);

  async function load() {
    const { data: user } = await supabase.auth.getUser();
    setMe(user.user?.id ?? null);

    const { data: c } = await supabase
      .from("circles")
      .select("name, created_by")
      .eq("id", circleId)
      .maybeSingle();
    setCircle(c);

    const { data: mems } = await supabase
      .from("circle_members")
      .select("user_id, role, joined_at")
      .eq("circle_id", circleId)
      .order("joined_at", { ascending: true });

    const meId = user.user?.id;
    const admin = !!(mems ?? []).find((m) => m.user_id === meId && m.role === "admin");
    setIsAdmin(admin);

    if (admin) {
      const { data: code } = await supabase.rpc("get_invite_code", { _circle_id: circleId });
      setInviteCode(code ?? null);
    } else {
      setInviteCode(null);
    }

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
    const listCounts = new Map<string, number>();
    (lists ?? []).forEach((l) => listCounts.set(l.owner_id, (listCounts.get(l.owner_id) ?? 0) + 1));
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));

    setMembers(
      (mems ?? []).map((m) => ({
        user_id: m.user_id,
        role: m.role,
        profile: profMap.get(m.user_id)
          ? {
              display_name: profMap.get(m.user_id)!.display_name,
              avatar_url: profMap.get(m.user_id)!.avatar_url,
            }
          : null,
        listCount: listCounts.get(m.user_id) ?? 0,
      })),
    );

    const { data: acts } = await supabase
      .from("circle_activity")
      .select("id, action, actor_name, target_name, created_at")
      .eq("circle_id", circleId)
      .order("created_at", { ascending: false })
      .limit(30);
    setActivity((acts ?? []) as ActivityRow[]);
  }

  useEffect(() => {
    load();
  }, [circleId]);

  function copyCode() {
    if (!inviteCode) return;
    navigator.clipboard.writeText(inviteCode);
    toast.success("Code copié !");
  }

  async function regenerateCode() {
    setRegenBusy(true);
    const { data, error } = await supabase.rpc("regenerate_invite_code", { _circle_id: circleId });
    setRegenBusy(false);
    setRegenOpen(false);
    if (error || !data) {
      toast.error(translateError(error?.message ?? ""));
      return;
    }
    setInviteCode(data);
    toast.success("Nouveau code généré !");
  }

  async function setMemberRole(userId: string, role: "admin" | "member") {
    const { error } = await supabase.rpc("set_member_role", {
      _circle_id: circleId,
      _user_id: userId,
      _role: role,
    });
    if (error) {
      toast.error(translateError(error.message));
      return;
    }
    toast.success(
      role === "admin" ? "Membre promu administrateur" : "Rôle d'administrateur retiré",
    );
    load();
  }

  async function removeMember(userId: string) {
    const { error } = await supabase.rpc("remove_member", {
      _circle_id: circleId,
      _user_id: userId,
    });
    if (error) {
      toast.error(translateError(error.message));
      return;
    }
    toast.success("Membre retiré");
    load();
  }

  const isCreator = !!(circle && me && circle.created_by === me);
  const otherMembers = members.filter((m) => m.user_id !== me);
  const successor = otherMembers.find((m) => m.role === "admin") ?? otherMembers[0] ?? null;
  const isLastMember = otherMembers.length === 0;

  async function confirmLeave() {
    setLeaveBusy(true);
    const { data, error } = await supabase.rpc("leave_circle", { _circle_id: circleId });
    setLeaveBusy(false);
    setLeaveOpen(false);
    if (error) {
      toast.error(translateError(error.message));
      return;
    }
    const result = data as {
      circle_deleted?: boolean;
      new_owner_id?: string;
      new_owner_name?: string;
    } | null;
    const circleName = circle?.name ?? "le cercle";
    navigate({ to: "/circles" });
    if (result?.circle_deleted) {
      toast.success(`« ${circleName} » a été supprimé`, {
        description: "Toutes les listes, cadeaux et réservations associés ont été effacés.",
      });
    } else if (result?.new_owner_id) {
      const ownerName =
        result.new_owner_name?.trim() ||
        members.find((m) => m.user_id === result.new_owner_id)?.profile?.display_name ||
        "un autre membre";
      toast.success(`Tu as quitté « ${circleName} »`, {
        description: `L'administration a été transférée à ${ownerName}.`,
      });
    } else {
      toast.success(`Tu as quitté « ${circleName} »`);
    }
  }

  if (!circle) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{circle.name}</h1>
        <p className="text-sm text-muted-foreground">
          {members.length} membre{members.length > 1 ? "s" : ""}
        </p>
      </div>

      {isAdmin ? (
        <Card className="p-4 bg-secondary">
          <p className="text-xs text-muted-foreground">Code d'invitation</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-2xl font-bold tracking-widest">{inviteCode ?? "……"}</span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={copyCode} disabled={!inviteCode}>
                <Copy className="h-4 w-4 mr-1" /> Copier
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setRegenOpen(true)}
                disabled={regenBusy}
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${regenBusy ? "animate-spin" : ""}`} />{" "}
                Régénérer
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4 bg-secondary">
          <p className="text-sm text-muted-foreground">
            Seul l'administrateur du cercle peut inviter de nouveaux membres.
          </p>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
          Membres
        </h2>
        {members.map((m) => {
          const isMe = m.user_id === me;
          const name = m.profile?.display_name ?? "Membre";
          const memberIsCreator = m.user_id === circle.created_by;
          const memberIsAdmin = m.role === "admin";
          const canManage = isAdmin && !isMe && !memberIsCreator;
          return (
            <Card key={m.user_id} className="p-3 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  {m.profile?.avatar_url && <AvatarImage src={m.profile.avatar_url} />}
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">
                      {name} {isMe && <span className="text-xs text-muted-foreground">(vous)</span>}
                    </p>
                    {memberIsCreator ? (
                      <Badge variant="default" className="gap-1">
                        <Crown className="h-3 w-3" /> Créateur
                      </Badge>
                    ) : memberIsAdmin ? (
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="h-3 w-3" /> Admin
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.listCount} liste{m.listCount > 1 ? "s" : ""}
                  </p>
                </div>
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Actions">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {memberIsAdmin ? (
                        <DropdownMenuItem onClick={() => setMemberRole(m.user_id, "member")}>
                          <ShieldOff className="h-4 w-4 mr-2" /> Retirer le rôle admin
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => setMemberRole(m.user_id, "admin")}>
                          <Shield className="h-4 w-4 mr-2" /> Nommer administrateur
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setRemoveTarget({ userId: m.user_id, name })}
                      >
                        <UserMinus className="h-4 w-4 mr-2" /> Retirer du cercle
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <span className="text-xs text-muted-foreground">
                  {isMe ? "Gérer ma liste" : "Voir les cadeaux de ce membre"}
                </span>
                <Button asChild size="sm" className="shrink-0 rounded-full">
                  <Link
                    to="/circles/$circleId/members/$userId"
                    params={{ circleId, userId: m.user_id }}
                    aria-label={`${isMe ? "Gérer mes cadeaux" : `Voir les cadeaux de ${name}`}`}
                  >
                    <Gift className="h-4 w-4" />
                    {isMe ? "Gérer" : "Voir les cadeaux"}
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="pt-4">
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => setLeaveOpen(true)}
        >
          <LogOut className="h-4 w-4 mr-2" /> Quitter le cercle
        </Button>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1 flex items-center gap-2">
          <History className="h-4 w-4" /> Journal d'activité
        </h2>
        {activity.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-muted-foreground">
              Aucune activité pour le moment. Les promotions d'administrateur, les retraits et les
              départs de membres apparaîtront ici.
            </p>
          </Card>
        ) : (
          <Card className="divide-y">
            {activity.map((row) => (
              <div key={row.id} className="p-3">
                <p className="text-sm">{describeActivity(row)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatActivityDate(row.created_at)}
                </p>
              </div>
            ))}
          </Card>
        )}
      </div>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isCreator && isLastMember ? "Supprimer le cercle ?" : "Quitter le cercle ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isCreator && isLastMember
                ? "Tu es le dernier membre. Quitter ce cercle le supprimera définitivement, ainsi que toutes les listes et réservations associées. Cette action est irréversible."
                : isCreator && successor
                  ? `Tu es le créateur de ce cercle. En le quittant, l'administration sera transférée à ${successor.profile?.display_name ?? "un autre membre"}. Continuer ?`
                  : "Es-tu sûr de vouloir quitter ce cercle ?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaveBusy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={leaveBusy}
              onClick={(e) => {
                e.preventDefault();
                confirmLeave();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCreator && isLastMember ? "Supprimer" : "Quitter"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={regenOpen} onOpenChange={setRegenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Régénérer le code d'invitation ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'ancien code cessera immédiatement de fonctionner. Les membres qui ne l'ont pas
              encore utilisé devront recevoir le nouveau.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenBusy}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={regenBusy}
              onClick={(e) => {
                e.preventDefault();
                regenerateCode();
              }}
            >
              Régénérer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer {removeTarget?.name} du cercle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette personne perdra l'accès au cercle et à ses listes. Elle ne pourra plus le
              rejoindre avec le code actuel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                const target = removeTarget;
                setRemoveTarget(null);
                if (target) removeMember(target.userId);
              }}
            >
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
