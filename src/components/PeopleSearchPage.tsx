import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  Gift,
  Heart,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundSearch,
} from "lucide-react";
import { toast } from "sonner";

import { PublicHeader } from "@/components/PublicHeader";
import { PoweredByYetiLab } from "@/components/PoweredByYetiLab";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
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

  const searchForm = (
    <form className="flex gap-2" onSubmit={search}>
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nom, @identifiant ou email"
          aria-label="Nom, @identifiant ou email"
          autoComplete="off"
          className="h-10 rounded-xl border-white/80 bg-white/80 pl-10 shadow-sm focus-visible:ring-2"
        />
      </div>
      <Button
        type="submit"
        disabled={busy}
        aria-label="Rechercher"
        className="h-10 rounded-xl px-3 shadow-sm sm:px-4"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Rechercher</span>
      </Button>
    </form>
  );

  const resultList = (
    <div aria-live="polite" className="space-y-3">
      {results?.length === 0 && (
        <Card className="rounded-2xl border-dashed bg-white/70 p-5 text-center text-sm text-muted-foreground shadow-sm">
          <UserRoundSearch className="mx-auto mb-3 h-8 w-8 text-primary" />
          Aucun profil public ne correspond à cette recherche.
        </Card>
      )}

      {results?.map((profile) => {
        const name = profile.display_name?.trim() || profile.username;
        return (
          <Link
            key={profile.id}
            to="/p/$username"
            params={{ username: profile.username }}
            search={{ invite: undefined }}
          >
            <Card className="gp-card-lift group flex items-center gap-3 rounded-2xl border-white/80 bg-white/85 p-3 shadow-sm">
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
                <AvatarFallback className="bg-secondary font-bold text-primary">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{name}</p>
                <p className="text-xs text-muted-foreground">@{profile.username}</p>
                {profile.bio && (
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{profile.bio}</p>
                )}
              </div>
              <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:text-primary" />
            </Card>
          </Link>
        );
      })}
    </div>
  );

  if (!publicMode) {
    return (
      <div className="gp-mesh min-h-[calc(100vh-9rem)] px-4 py-7">
        <div className="mx-auto max-w-md space-y-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Découvrir</p>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-[-0.04em]">
              Trouver une personne
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Un nom, un identifiant, et la bonne idée cadeau est à portée de main.
            </p>
          </div>
          {searchForm}
          {resultList}
        </div>
      </div>
    );
  }

  return (
    <div className="gp-mesh relative min-h-screen overflow-hidden">
      <div className="gp-dots pointer-events-none absolute inset-0 opacity-50" />
      <PublicHeader />

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-9 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-28">
          <div className="gp-fade-up">
            <div className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-white/70 px-2 py-0.5 text-[10px] font-medium text-primary shadow-sm backdrop-blur">
              <Sparkles className="h-3 w-3" /> Offrir juste, sans gâcher la surprise
            </div>
            <h1 className="mt-6 max-w-2xl font-display text-5xl font-bold leading-[0.97] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              Les cadeaux justes.
              <span className="block text-primary">La surprise intacte.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Vous ne savez pas quoi offrir à votre ami, votre neveu ou votre sœur ? Cherchez une
              idée dans sa liste d'envies. Créez la vôtre et partagez-la avec les personnes de votre
              choix — sans jamais savoir qui vous offre quoi.
            </p>

            <div className="gp-glass mt-8 max-w-xl rounded-2xl p-2.5 sm:p-3">
              <p className="mb-2.5 px-1 text-sm font-medium">Qui voulez-vous gâter ?</p>
              {searchForm}
            </div>

            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-accent" /> Gratuit
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Profils publics ou privés
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-accent" /> Surprise protégée
              </span>
            </div>

            {results && <div className="mt-7 max-w-xl">{resultList}</div>}
          </div>

          <div className="relative mx-auto hidden w-full max-w-lg lg:block">
            <div className="absolute -left-10 top-10 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -right-8 bottom-5 h-44 w-44 rounded-full bg-accent/25 blur-3xl" />
            <div className="gp-glass relative rotate-[1.5deg] rounded-[2.25rem] p-5">
              <div className="rounded-[1.75rem] bg-[linear-gradient(135deg,oklch(0.92_0.08_30),oklch(0.96_0.04_75),oklch(0.9_0.08_175))] p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 text-xl font-bold text-primary shadow-sm">
                    L
                  </div>
                  <div>
                    <p className="font-display text-2xl font-bold">La liste de Léa</p>
                    <p className="text-sm text-foreground/60">Anniversaire · 12 septembre</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <PreviewGift
                  icon={<Heart className="h-7 w-7" />}
                  title="Week-end surprise"
                  price="120 €"
                  tone="bg-primary/10 text-primary"
                />
                <PreviewGift
                  icon={<Gift className="h-7 w-7" />}
                  title="Le beau livre"
                  price="42 €"
                  tone="bg-accent/15 text-accent-foreground"
                  reserved
                />
                <div className="col-span-2 flex items-center justify-between rounded-2xl bg-foreground px-4 py-3 text-background shadow-lg">
                  <div>
                    <p className="text-xs text-background/65">2 proches sont déjà passés</p>
                    <p className="font-semibold">La magie s’organise ✨</p>
                  </div>
                  <div className="flex -space-x-2">
                    {["M", "S", "+3"].map((letter) => (
                      <span
                        key={letter}
                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-foreground bg-secondary text-[10px] font-bold text-foreground"
                      >
                        {letter}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="gp-float absolute -right-8 -top-7 rounded-2xl bg-white p-3 shadow-xl">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
        </section>

        <section className="border-y border-white/70 bg-white/45 py-12 backdrop-blur-sm">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
                Simple comme un sourire
              </p>
              <h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
                Trois étapes. Zéro cadeau en double.
              </h2>
            </div>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              <FeatureCard
                number="01"
                title="Créez"
                text="Une ou plusieurs listes, publiques ou réservées à vos cercles."
              />
              <FeatureCard
                number="02"
                title="Partagez"
                text="Votre profil, une liste précise ou une invitation privée."
              />
              <FeatureCard
                number="03"
                title="Laissez la magie agir"
                text="Vos proches se coordonnent. Vous gardez la surprise."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <span>© {new Date().getFullYear()} Gift-Plan · Imaginé avec soin.</span>
          <PoweredByYetiLab />
        </div>
        <nav className="flex gap-4">
          <Link to="/legal/mentions-legales" className="hover:text-primary">
            Mentions légales
          </Link>
          <Link to="/legal/confidentialite" className="hover:text-primary">
            Confidentialité
          </Link>
          <Link to="/legal/cgu" className="hover:text-primary">
            CGU
          </Link>
        </nav>
      </footer>
    </div>
  );
}

function PreviewGift({
  icon,
  title,
  price,
  tone,
  reserved = false,
}: {
  icon: React.ReactNode;
  title: string;
  price: string;
  tone: string;
  reserved?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-3 shadow-sm ${reserved ? "opacity-60" : ""}`}>
      <div className={`flex aspect-[4/3] items-center justify-center rounded-xl ${tone}`}>
        {icon}
      </div>
      <p className="mt-3 text-sm font-bold">{title}</p>
      <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{price}</span>
        {reserved && (
          <span className="rounded-full bg-secondary px-1.5 py-0 text-[9px] leading-3.5">
            Réservé
          </span>
        )}
      </div>
    </div>
  );
}

function FeatureCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <Card className="gp-card-lift rounded-2xl border-white/80 bg-white/75 p-5 shadow-sm">
      <span className="font-display text-2xl font-bold text-primary/35">{number}</span>
      <h3 className="mt-3 font-display text-xl font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </Card>
  );
}
