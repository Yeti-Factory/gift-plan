import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/gift-box";

type SearchResult = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
};

export function PeopleSearchPage({ publicMode = false }: { publicMode?: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      toast.error("Saisissez au moins 2 caractères.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("search_public_profiles", { _query: trimmed });
    setBusy(false);
    if (error) {
      toast.error("La recherche est temporairement indisponible.");
      return;
    }
    setResults((data as SearchResult[]) ?? []);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Trouver une personne</h1>
          <p className="text-sm text-muted-foreground">
            Recherchez un profil public par nom, identifiant ou email exact si son propriétaire l'a
            autorisé.
          </p>
        </div>
        {publicMode && (
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/auth">Se connecter</Link>
          </Button>
        )}
      </div>

      <form className="flex gap-2" onSubmit={search}>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nom, @identifiant ou email"
          autoComplete="off"
        />
        <Button type="submit" disabled={busy} aria-label="Rechercher">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {results?.length === 0 && (
        <Card className="p-7 text-center text-sm text-muted-foreground">
          <UserRoundSearch className="mx-auto mb-3 h-8 w-8" />
          Aucun profil public ne correspond à cette recherche.
        </Card>
      )}

      <div className="space-y-3">
        {results?.map((profile) => {
          const name = profile.display_name?.trim() || profile.username;
          return (
            <Link key={profile.id} to="/p/$username" params={{ username: profile.username }}>
              <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-accent">
                <Avatar>
                  {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                  <AvatarFallback>{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">@{profile.username}</p>
                  {profile.bio && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{profile.bio}</p>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
