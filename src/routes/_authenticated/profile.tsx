import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Copy, Eye, Link2, Lock, Plus, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/profile")({ component: ManageProfilePage });

type OwnProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  visibility: "public" | "private";
  email_searchable: boolean;
};
type OwnList = { id: string; title: string; visibility: "public" | "circles" };
type ShareLink = {
  id: string;
  token: string;
  label: string | null;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  list_ids: string[] | null;
};

function ManageProfilePage() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<OwnProfile | null>(null);
  const [lists, setLists] = useState<OwnList[]>([]);
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [emailSearchable, setEmailSearchable] = useState(false);
  const [selectedLists, setSelectedLists] = useState<string[]>([]);
  const [linkLabel, setLinkLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data: p }, { data: ownLists }, { data: shareLinks }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, display_name, bio, visibility, email_searchable")
        .eq("id", user.id)
        .single(),
      supabase
        .from("lists")
        .select("id, title, visibility")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.rpc("list_profile_share_links"),
    ]);
    if (p) {
      setProfile(p);
      setDisplayName(p.display_name ?? "");
      setUsername(p.username);
      setBio(p.bio ?? "");
      setIsPublic(p.visibility === "public");
      setEmailSearchable(p.email_searchable);
    }
    setLists(ownLists ?? []);
    setLinks((shareLinks as ShareLink[]) ?? []);
  }, [user.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(normalizedUsername)) {
      toast.error("L'identifiant doit contenir 3 à 40 lettres minuscules, chiffres ou tirets.");
      return;
    }
    if (!displayName.trim()) {
      toast.error("Le nom affiché est obligatoire.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        username: normalizedUsername,
        bio: bio.trim() || null,
        visibility: isPublic ? "public" : "private",
        email_searchable: emailSearchable,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "23505" ? "Cet identifiant est déjà utilisé." : "Profil non enregistré.",
      );
      return;
    }
    await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });
    toast.success("Profil enregistré");
    load();
  }

  async function createShareLink() {
    if (selectedLists.length === 0) {
      toast.error("Sélectionnez au moins une liste.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_profile_share_link", {
      _list_ids: selectedLists,
      _label: linkLabel.trim() || null,
      _expires_at: null,
    });
    setBusy(false);
    if (error) {
      toast.error("Impossible de créer l'invitation.");
      return;
    }
    const created = data as { token: string };
    setSelectedLists([]);
    setLinkLabel("");
    await copyLink(created.token);
    toast.success("Invitation créée et copiée");
    load();
  }

  function shareUrl(token: string) {
    return `${window.location.origin}/p/${profile?.username}?invite=${token}`;
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(shareUrl(token));
  }

  async function revoke(id: string) {
    const { error } = await supabase.rpc("revoke_profile_share_link", { _share_id: id });
    if (error) toast.error("Impossible de révoquer ce lien.");
    else {
      toast.success("Invitation révoquée");
      load();
    }
  }

  if (!profile) return <div className="mx-auto max-w-md px-4 py-8">Chargement…</div>;

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mon profil</h1>
          <p className="text-sm text-muted-foreground">
            Votre identité publique et les personnes autorisées à consulter vos listes.
          </p>
        </div>
        <Button asChild variant="ghost" size="icon" aria-label="Paramètres du compte">
          <Link to="/account">
            <Settings className="h-5 w-5" />
          </Link>
        </Button>
      </div>

      <Card className="p-5">
        <form className="space-y-4" onSubmit={saveProfile}>
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nom affiché</Label>
            <Input
              id="profile-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-username">Identifiant public</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">@</span>
              <Input
                id="profile-username"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                maxLength={40}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-bio">Présentation</Label>
            <Textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={300}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <Label htmlFor="profile-public">Profil public</Label>
              <p className="text-xs text-muted-foreground">
                Apparaît dans la recherche et peut être consulté par tous.
              </p>
            </div>
            <Switch id="profile-public" checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <Label htmlFor="email-searchable">Recherche par email exact</Label>
              <p className="text-xs text-muted-foreground">
                Votre adresse ne sera jamais affichée.
              </p>
            </div>
            <Switch
              id="email-searchable"
              checked={emailSearchable}
              onCheckedChange={setEmailSearchable}
              disabled={!isPublic}
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1">
              Enregistrer
            </Button>
            <Button asChild type="button" variant="outline">
              <Link to="/p/$username" params={{ username: profile.username }}>
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </form>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Inviter sans rejoindre un cercle
          </h2>
          <p className="text-xs text-muted-foreground">
            Le lien ne donne accès qu'aux listes sélectionnées et peut être révoqué.
          </p>
        </div>
        <Input
          value={linkLabel}
          onChange={(e) => setLinkLabel(e.target.value)}
          placeholder="Pour Mamie, collègues… (optionnel)"
        />
        <div className="space-y-2">
          {lists.map((list) => (
            <label
              key={list.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg border p-3"
            >
              <Checkbox
                checked={selectedLists.includes(list.id)}
                onCheckedChange={(checked) =>
                  setSelectedLists((current) =>
                    checked ? [...current, list.id] : current.filter((id) => id !== list.id),
                  )
                }
              />
              <span className="flex-1 text-sm">{list.title}</span>
              <Badge variant="outline">
                {list.visibility === "public" ? "Publique" : "Cercles"}
              </Badge>
            </label>
          ))}
        </div>
        {lists.length === 0 && (
          <p className="text-sm text-muted-foreground">Créez d'abord une liste.</p>
        )}
        <Button
          onClick={createShareLink}
          disabled={busy || selectedLists.length === 0}
          className="w-full"
        >
          <Plus className="mr-1 h-4 w-4" /> Créer et copier le lien
        </Button>
      </Card>

      {links.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Invitations existantes</h2>
          {links.map((link) => {
            const active =
              !link.revoked_at && (!link.expires_at || new Date(link.expires_at) > new Date());
            return (
              <Card key={link.id} className="flex items-center gap-2 p-3">
                {active ? <Eye className="h-4 w-4 text-green-600" /> : <Lock className="h-4 w-4" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {link.label || "Invitation sans nom"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {link.list_ids?.length ?? 0} liste(s) · {active ? "active" : "révoquée"}
                  </p>
                </div>
                {active && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Copier"
                      onClick={() => copyLink(link.token)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Révoquer"
                      onClick={() => revoke(link.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
