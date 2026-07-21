import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Globe2,
  Inbox,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  UserMinus,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { initials } from "@/lib/gift-box";
import {
  PROFILE_ACCESS_CHANGED_EVENT,
  PROFILE_DIRECTORY_PAGE_SIZE,
  directoryProfileName,
  parseProfileAccessInbox,
  parseProfileDirectory,
  type DirectoryProfile,
  type ProfileAccessInbox,
  type ProfileAccessInboxEntry,
} from "@/lib/profile-directory";

const EMPTY_INBOX: ProfileAccessInbox = { pending: [], granted: [] };

function announceAccessChange() {
  window.dispatchEvent(new Event(PROFILE_ACCESS_CHANGED_EVENT));
}

export function ProfileDirectoryPage() {
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [profiles, setProfiles] = useState<DirectoryProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [inbox, setInbox] = useState<ProfileAccessInbox>(EMPTY_INBOX);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  const loadDirectory = useCallback(async (search: string, offset: number, append: boolean) => {
    const { data, error } = await supabase.rpc("list_profile_directory", {
      _query: search || undefined,
      _limit: PROFILE_DIRECTORY_PAGE_SIZE,
      _offset: offset,
    });
    const parsed = parseProfileDirectory(data);
    if (error || !parsed) return false;
    setProfiles((current) => (append ? [...current, ...parsed.profiles] : parsed.profiles));
    setTotal(parsed.total);
    return true;
  }, []);

  const loadInbox = useCallback(async () => {
    const { data, error } = await supabase.rpc("list_profile_access_inbox");
    const parsed = parseProfileAccessInbox(data);
    if (error || !parsed) return false;
    setInbox(parsed);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    const results = await Promise.all([loadDirectory(activeQuery, 0, false), loadInbox()]);
    setLoadError(results.some((result) => !result));
  }, [activeQuery, loadDirectory, loadInbox]);

  useEffect(() => {
    let active = true;
    Promise.all([loadDirectory("", 0, false), loadInbox()]).then((results) => {
      if (!active) return;
      setLoadError(results.some((result) => !result));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [loadDirectory, loadInbox]);

  const hasMore = profiles.length < total;
  const pendingIds = useMemo(
    () => new Set(inbox.pending.map((request) => request.request_id)),
    [inbox.pending],
  );

  async function searchProfiles(event: React.FormEvent) {
    event.preventDefault();
    const nextQuery = query.trim();
    setLoading(true);
    const ok = await loadDirectory(nextQuery, 0, false);
    setActiveQuery(nextQuery);
    setLoadError(!ok);
    setLoading(false);
  }

  async function loadMore() {
    setLoadingMore(true);
    const ok = await loadDirectory(activeQuery, profiles.length, true);
    setLoadingMore(false);
    if (!ok) toast.error("Les profils suivants n’ont pas pu être chargés.");
  }

  async function requestAccess(profileId: string) {
    setBusyAction(`request:${profileId}`);
    const { error } = await supabase.rpc("request_profile_access", { _profile_id: profileId });
    if (error) {
      toast.error("La demande de connexion n’a pas pu être envoyée.");
    } else {
      toast.success("Demande de connexion envoyée");
      announceAccessChange();
      await refresh();
    }
    setBusyAction(null);
  }

  async function cancelAccess(profileId: string) {
    setBusyAction(`cancel:${profileId}`);
    const { error } = await supabase.rpc("cancel_profile_access", { _profile_id: profileId });
    if (error) {
      toast.error("La connexion n’a pas pu être retirée.");
    } else {
      toast.success("Connexion retirée");
      announceAccessChange();
      await refresh();
    }
    setBusyAction(null);
  }

  async function respondToRequest(requestId: string, accept: boolean) {
    setBusyAction(`${accept ? "accept" : "decline"}:${requestId}`);
    const { error } = await supabase.rpc("respond_profile_access", {
      _request_id: requestId,
      _accept: accept,
    });
    if (error) {
      toast.error("Cette demande n’a pas pu être traitée.");
    } else {
      toast.success(accept ? "Connexion acceptée" : "Demande refusée");
      announceAccessChange();
      await refresh();
    }
    setBusyAction(null);
  }

  async function revokeAccess(requesterId: string) {
    setBusyAction(`revoke:${requesterId}`);
    const { error } = await supabase.rpc("revoke_profile_access", {
      _requester_id: requesterId,
    });
    if (error) {
      toast.error("Cet accès n’a pas pu être révoqué.");
    } else {
      toast.success("Accès à vos listes révoqué");
      announceAccessChange();
      await refresh();
    }
    setBusyAction(null);
  }

  return (
    <div className="gp-mesh min-h-[calc(100vh-9rem)] px-4 py-7">
      <div className="mx-auto max-w-3xl space-y-7">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Communauté</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.04em]">
            Profils Gift-Plan
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Tous les profils créés, classés par ordre alphabétique. Les profils publics sont
            accessibles immédiatement ; les profils privés valident chaque demande.
          </p>
        </header>

        {inbox.pending.length > 0 && (
          <section aria-labelledby="pending-title" className="space-y-3">
            <div className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-primary" />
              <h2 id="pending-title" className="font-display text-2xl font-bold">
                Demandes reçues
              </h2>
              <Badge className="rounded-full">{inbox.pending.length}</Badge>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {inbox.pending.map((request) => (
                <IncomingRequestCard
                  key={request.request_id}
                  request={request}
                  busy={
                    busyAction === `accept:${request.request_id}` ||
                    busyAction === `decline:${request.request_id}`
                  }
                  onAccept={() => respondToRequest(request.request_id, true)}
                  onDecline={() => respondToRequest(request.request_id, false)}
                />
              ))}
            </div>
          </section>
        )}

        {inbox.granted.length > 0 && (
          <section aria-labelledby="granted-title" className="space-y-3">
            <div>
              <h2 id="granted-title" className="font-display text-xl font-bold">
                Accès accordés
              </h2>
              <p className="text-xs text-muted-foreground">
                Ces personnes peuvent consulter toutes vos listes. Vous pouvez révoquer leur accès à
                tout moment.
              </p>
            </div>
            <Card className="divide-y overflow-hidden rounded-[1.5rem] border-white/80 bg-white/80 p-0 shadow-sm">
              {inbox.granted.map((request) => (
                <GrantedAccessRow
                  key={request.request_id}
                  request={request}
                  busy={busyAction === `revoke:${request.requester_id}`}
                  onRevoke={() => revokeAccess(request.requester_id)}
                />
              ))}
            </Card>
          </section>
        )}

        <section aria-labelledby="directory-title" className="space-y-4">
          <div>
            <h2 id="directory-title" className="font-display text-2xl font-bold">
              Tous les profils
            </h2>
            <p className="text-xs text-muted-foreground">
              {activeQuery
                ? `${total} résultat${total > 1 ? "s" : ""} pour « ${activeQuery} »`
                : `${total} profil${total > 1 ? "s" : ""} inscrit${total > 1 ? "s" : ""}`}
            </p>
          </div>

          <form className="flex gap-2" onSubmit={searchProfiles}>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher par nom ou @identifiant"
                aria-label="Rechercher un profil"
                autoComplete="off"
                className="h-10 rounded-xl border-white/80 bg-white/80 pl-10 shadow-sm"
              />
            </div>
            <Button type="submit" disabled={loading} className="h-10 rounded-xl px-3.5">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Rechercher</span>
            </Button>
          </form>

          {loadError && (
            <Card className="rounded-[1.5rem] border-destructive/30 bg-white/80 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                L’annuaire est temporairement indisponible.
              </p>
              <Button variant="outline" className="mt-3" onClick={refresh}>
                Réessayer
              </Button>
            </Card>
          )}

          {!loadError && loading && profiles.length === 0 && (
            <Card className="rounded-[1.5rem] bg-white/70 p-10 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Chargement des profils…</p>
            </Card>
          )}

          {!loadError && !loading && profiles.length === 0 && (
            <Card className="rounded-[1.5rem] border-dashed bg-white/70 p-8 text-center">
              <UsersRound className="mx-auto h-9 w-9 text-primary/70" />
              <p className="mt-3 font-semibold">Aucun profil ne correspond à cette recherche.</p>
            </Card>
          )}

          <div aria-live="polite" className="grid gap-3 sm:grid-cols-2">
            {profiles.map((profile) => (
              <DirectoryProfileCard
                key={profile.id}
                profile={profile}
                busy={busyAction?.endsWith(`:${profile.id}`) ?? false}
                hasPendingRequest={
                  !!profile.incoming_request_id && pendingIds.has(profile.incoming_request_id)
                }
                onRequest={() => requestAccess(profile.id)}
                onCancel={() => cancelAccess(profile.id)}
              />
            ))}
          </div>

          {hasMore && (
            <Button
              variant="outline"
              className="w-full rounded-xl bg-white/70"
              disabled={loadingMore}
              onClick={loadMore}
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              Afficher plus de profils
            </Button>
          )}
        </section>
      </div>
    </div>
  );
}

function DirectoryProfileCard({
  profile,
  busy,
  hasPendingRequest,
  onRequest,
  onCancel,
}: {
  profile: DirectoryProfile;
  busy: boolean;
  hasPendingRequest: boolean;
  onRequest: () => void;
  onCancel: () => void;
}) {
  const name = directoryProfileName(profile);
  const connected = profile.outgoing_status === "accepted";
  const pending = profile.outgoing_status === "pending";
  const canOpen = profile.can_view || profile.is_self;
  const canRequest = !profile.is_self && profile.visibility === "private" && !connected && !pending;

  let description = "Demandez une connexion pour consulter ses listes.";
  if (profile.is_self) description = "C’est votre profil.";
  else if (connected) description = "Connexion acceptée · toutes les listes sont accessibles.";
  else if (pending) description = "Votre demande est en attente de réponse.";
  else if (profile.visibility === "public") description = "Ses listes publiques sont accessibles.";
  else if (profile.can_view) description = "Ce profil est accessible via un cercle partagé.";

  return (
    <Card className="gp-card-lift flex h-full flex-col rounded-2xl border-white/80 bg-white/85 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback className="bg-secondary font-bold text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p className="truncate font-bold">{name}</p>
            {profile.is_self && <Badge variant="secondary">Vous</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">@{profile.username}</p>
        </div>
        <Badge variant="outline" className="shrink-0 rounded-full bg-white/70">
          {profile.visibility === "public" ? (
            <Globe2 className="h-2.5 w-2.5" />
          ) : (
            <Lock className="h-2.5 w-2.5" />
          )}
          {profile.visibility === "public" ? "Public" : "Privé"}
        </Badge>
      </div>

      {profile.bio && (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{profile.bio}</p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{description}</p>
      {hasPendingRequest && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
          <Inbox className="h-3.5 w-3.5" /> Cette personne vous a aussi envoyé une demande.
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {canOpen && (
          <Button asChild size="sm" className="rounded-lg">
            <Link
              to={profile.is_self ? "/profile" : "/p/$username"}
              params={profile.is_self ? undefined : { username: profile.username }}
              search={profile.is_self ? undefined : { invite: undefined }}
            >
              {profile.is_self ? "Mon profil" : "Voir les listes"}
              {!profile.is_self && <ArrowUpRight className="h-3.5 w-3.5" />}
            </Link>
          </Button>
        )}
        {canRequest && (
          <Button
            size="sm"
            variant={canOpen ? "outline" : "default"}
            disabled={busy}
            onClick={onRequest}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {profile.outgoing_status === "declined" ? "Redemander" : "Se connecter"}
          </Button>
        )}
        {pending && (
          <>
            <Badge variant="secondary" className="rounded-full">
              En attente
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              aria-label={`Annuler la demande envoyée à ${name}`}
              onClick={onCancel}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
            </Button>
          </>
        )}
        {connected && (
          <>
            <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
              <ShieldCheck className="h-2.5 w-2.5" /> Connecté
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              disabled={busy}
              aria-label={`Renoncer à l’accès au profil de ${name}`}
              onClick={onCancel}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserMinus className="h-4 w-4" />
              )}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function IncomingRequestCard({
  request,
  busy,
  onAccept,
  onDecline,
}: {
  request: ProfileAccessInboxEntry;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const name = request.display_name?.trim() || request.username;
  return (
    <Card className="rounded-[1.5rem] border-primary/15 bg-white/90 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11">
          {request.avatar_url && <AvatarImage src={request.avatar_url} />}
          <AvatarFallback className="bg-secondary font-bold text-primary">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{name}</p>
          <p className="truncate text-xs text-muted-foreground">@{request.username}</p>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Souhaite accéder à toutes vos listes. L’accès restera révocable à tout moment.
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={busy} onClick={onAccept}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Accepter
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={onDecline}>
          <X className="h-4 w-4" /> Refuser
        </Button>
      </div>
    </Card>
  );
}

function GrantedAccessRow({
  request,
  busy,
  onRevoke,
}: {
  request: ProfileAccessInboxEntry;
  busy: boolean;
  onRevoke: () => void;
}) {
  const name = request.display_name?.trim() || request.username;
  return (
    <div className="flex items-center gap-3 p-3">
      <Avatar className="h-9 w-9">
        {request.avatar_url && <AvatarImage src={request.avatar_url} />}
        <AvatarFallback className="bg-secondary text-xs font-bold text-primary">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">@{request.username}</p>
      </div>
      <Button size="sm" variant="ghost" disabled={busy} onClick={onRevoke}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
        <span className="hidden sm:inline">Révoquer</span>
      </Button>
    </div>
  );
}
