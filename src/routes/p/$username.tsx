import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  CircleCheck,
  ExternalLink,
  Gift as GiftIcon,
  Lock,
  Share2,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PublicHeader } from "@/components/PublicHeader";
import { formatPrice, initials, PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/gift-box";
import { useGiftImageUrls, usePublicGiftImageUrls } from "@/lib/gift-image";
import { isProfilePageData, type ProfilePageData } from "@/lib/profile-page";
import { GiftCategoryFilter } from "@/components/GiftCategoryFilter";
import {
  filterGiftsByCategory,
  getGiftCategoryOption,
  type GiftCategoryFilterValue,
} from "@/lib/gift-category";

export const Route = createFileRoute("/p/$username")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    invite:
      typeof search.invite === "string" && /^[0-9a-f-]{36}$/i.test(search.invite)
        ? search.invite
        : undefined,
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { username } = Route.useParams();
  const { invite } = Route.useSearch();
  const navigate = useNavigate();
  const [page, setPage] = useState<ProfilePageData | null>(null);
  const [error, setError] = useState<"PROFILE_NOT_FOUND" | "PROFILE_PRIVATE" | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [busyGift, setBusyGift] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<GiftCategoryFilterValue>("all");

  const load = useCallback(async () => {
    const [{ data: auth }, { data, error: rpcError }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc("get_profile_page", {
        _username: username,
        _share_token: invite ?? undefined,
      }),
    ]);
    setMe(auth.user?.id ?? null);
    if (rpcError) {
      setError("PROFILE_NOT_FOUND");
      return;
    }
    if (isProfilePageData(data)) {
      setPage(data);
      setError(null);
      return;
    }
    const code = (data as { error?: string } | null)?.error;
    setError(code === "PROFILE_PRIVATE" ? "PROFILE_PRIVATE" : "PROFILE_NOT_FOUND");
  }, [invite, username]);

  useEffect(() => {
    load();
  }, [load]);

  const imageGiftIds =
    page?.lists.flatMap((list) =>
      list.gifts.filter((gift) => gift.image_path).map((gift) => gift.id),
    ) ?? [];
  const { data: authenticatedUrls } = useGiftImageUrls(imageGiftIds, !!me);
  const { data: publicUrls } = usePublicGiftImageUrls(
    username,
    invite,
    imageGiftIds,
    !me || !!invite,
  );
  // A signed-in recipient may still arrive through a direct invitation. In that
  // case the token, rather than circle membership, authorizes the image.
  const signedUrls = invite ? publicUrls : me ? authenticatedUrls : publicUrls;

  async function reservationAction(giftId: string, action: "reserve" | "purchased" | "cancel") {
    if (!me) {
      toast.message("Connectez-vous pour offrir ce cadeau.");
      navigate({ to: "/auth" });
      return;
    }
    setBusyGift(giftId);
    const { error: actionError } = await supabase.rpc("set_gift_reservation", {
      _gift_id: giftId,
      _action: action,
      _share_token: invite ?? undefined,
    });
    setBusyGift(null);
    if (actionError) {
      toast.error("Cette réservation n'a pas pu être modifiée.");
      return;
    }
    toast.success(
      action === "reserve"
        ? "Cadeau réservé — la surprise est gardée !"
        : action === "purchased"
          ? "Cadeau marqué comme acheté"
          : "Réservation annulée",
    );
    load();
  }

  async function shareProfile() {
    const shareData = {
      title: page?.profile.display_name
        ? `La liste de ${page.profile.display_name}`
        : "Une liste Gift-Plan",
      text: "Voici une liste d’idées cadeaux — la surprise reste bien gardée !",
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(shareData.url);
      toast.success("Lien du profil copié");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      toast.error("Le lien n’a pas pu être partagé.");
    }
  }

  if (!page && !error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-xl font-bold">
          {error === "PROFILE_PRIVATE" ? "Ce profil est privé" : "Profil introuvable"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error === "PROFILE_PRIVATE"
            ? "Demandez une connexion depuis l’annuaire des profils, ou utilisez un lien d’invitation."
            : "Vérifiez l'identifiant ou recherchez la personne depuis Gift-Plan."}
        </p>
        <Button asChild className="mt-5">
          <Link to={me ? "/people" : "/discover"}>Rechercher un profil</Link>
        </Button>
      </div>
    );
  }

  const { profile, lists } = page!;
  const name = profile.display_name?.trim() || profile.username;

  const giftCount = lists.reduce((total, list) => total + list.gifts.length, 0);

  return (
    <div className="gp-mesh min-h-screen">
      <PublicHeader signedIn={!!me} />
      <main className="mx-auto max-w-6xl space-y-9 px-4 pb-24 pt-4 sm:px-6 sm:pt-8">
        <section className="gp-glass gp-fade-up relative overflow-hidden rounded-[2.25rem] p-6 sm:p-9">
          <div className="absolute inset-x-0 top-0 h-28 bg-[linear-gradient(115deg,oklch(0.89_0.1_30/0.8),oklch(0.94_0.05_75/0.75),oklch(0.88_0.09_175/0.7))]" />
          <div className="relative flex flex-col gap-5 pt-12 sm:flex-row sm:items-end sm:pt-14">
            <Avatar className="h-24 w-24 border-4 border-white shadow-xl sm:h-28 sm:w-28">
              {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
              <AvatarFallback className="bg-secondary font-display text-3xl font-bold text-primary">
                {initials(name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-display text-4xl font-bold tracking-[-0.04em] sm:text-5xl">
                  {name}
                </h1>
                <Badge className="rounded-full bg-secondary text-secondary-foreground shadow-none">
                  @{profile.username}
                </Badge>
              </div>
              {profile.bio && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {profile.bio}
                </p>
              )}
              <div className="mt-4 flex gap-4 text-xs font-medium text-muted-foreground">
                <span>
                  {lists.length} liste{lists.length > 1 ? "s" : ""}
                </span>
                <span>
                  {giftCount} idée{giftCount > 1 ? "s" : ""} cadeau
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-lg bg-white/80" onClick={shareProfile}>
                <Share2 className="h-4 w-4" /> Partager
              </Button>
              {profile.is_owner && (
                <Button asChild className="rounded-lg">
                  <Link to="/profile">Gérer mon profil</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        {lists.length === 0 && (
          <Card className="rounded-[2rem] border-dashed bg-white/65 p-12 text-center shadow-sm">
            <GiftIcon className="mx-auto h-10 w-10 text-primary/60" />
            <p className="mt-4 font-display text-2xl font-bold">La liste se prépare…</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Aucune idée cadeau n’est accessible pour le moment.
            </p>
          </Card>
        )}

        {giftCount > 0 && (
          <GiftCategoryFilter
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            className="justify-end"
          />
        )}

        {lists.map((list) => {
          const visibleGifts = filterGiftsByCategory(list.gifts, categoryFilter);
          return (
            <section key={list.id} className="space-y-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
                      {list.title}
                    </h2>
                    <Badge variant="outline" className="rounded-full bg-white/60">
                      {list.visibility === "public" ? "Publique" : "Cercles"}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    {list.occasion && <span>{list.occasion}</span>}
                    {list.event_date && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        {new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(
                          new Date(`${list.event_date}T12:00:00`),
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary" /> Les réservations restent secrètes
                </p>
              </div>

              {list.gifts.length === 0 && (
                <p className="rounded-2xl border border-dashed bg-white/50 p-6 text-sm text-muted-foreground">
                  Cette liste est encore vide.
                </p>
              )}

              {list.gifts.length > 0 && visibleGifts.length === 0 && (
                <p className="rounded-xl border border-dashed bg-white/50 p-4 text-sm text-muted-foreground">
                  Aucun cadeau dans cette catégorie.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleGifts.map((gift) => {
                  const reserved = !!gift.reservation;
                  const mine = gift.reservation?.reserved_by_me ?? false;
                  const purchased = gift.reservation?.status === "purchased";
                  const imageSrc = gift.image_path ? signedUrls?.[gift.id] : gift.image_url;
                  const category = getGiftCategoryOption(gift.category);
                  const CategoryIcon = category.icon;
                  return (
                    <Card
                      key={gift.id}
                      className={`gp-card-lift group overflow-hidden rounded-[1.75rem] border-white/80 bg-white/85 shadow-sm ${reserved ? "saturate-[0.72]" : ""}`}
                    >
                      <div className="relative aspect-[16/10] overflow-hidden bg-secondary/60">
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt=""
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div
                            className={`flex h-full items-center justify-center ${category.surfaceClass}`}
                            title={category.label}
                          >
                            <CategoryIcon
                              className={`h-12 w-12 opacity-60 ${category.iconClass}`}
                            />
                          </div>
                        )}
                        <Badge
                          className={`absolute left-3 top-3 rounded-full ${PRIORITY_COLOR[gift.priority]}`}
                        >
                          {PRIORITY_LABEL[gift.priority]}
                        </Badge>
                        {reserved && !profile.is_owner && (
                          <span className="absolute right-3 top-3 flex items-center gap-0.5 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-medium leading-3.5 shadow-sm backdrop-blur">
                            <CircleCheck className="h-3 w-3 text-accent" />
                            {purchased ? "Acheté" : "Réservé"}
                          </span>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="flex items-center gap-1.5 font-display text-xl font-bold leading-tight">
                            {imageSrc && (
                              <span
                                className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${category.surfaceClass}`}
                                title={category.label}
                              >
                                <CategoryIcon className={`h-3 w-3 ${category.iconClass}`} />
                                <span className="sr-only">{category.label}</span>
                              </span>
                            )}
                            <span>{gift.title}</span>
                          </h3>
                          {gift.price != null && (
                            <p className="shrink-0 font-bold text-primary">
                              {formatPrice(gift.price, gift.currency)}
                            </p>
                          )}
                        </div>
                        {gift.description && (
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {gift.description}
                          </p>
                        )}
                        <div className="mt-5 flex items-center gap-2">
                          {gift.url && (
                            <Button asChild size="sm" variant="outline" className="rounded-lg">
                              <a href={gift.url} target="_blank" rel="noreferrer noopener">
                                Voir <ExternalLink className="h-3 w-3" />
                              </a>
                            </Button>
                          )}
                          {!profile.is_owner && !reserved && (
                            <Button
                              size="sm"
                              className="ml-auto rounded-lg"
                              disabled={busyGift === gift.id}
                              onClick={() => reservationAction(gift.id, "reserve")}
                            >
                              <Check className="h-4 w-4" /> Je l’offre
                            </Button>
                          )}
                          {!profile.is_owner && reserved && !mine && (
                            <span className="ml-auto text-xs font-medium text-muted-foreground">
                              Quelqu’un s’en occupe ✨
                            </span>
                          )}
                          {!profile.is_owner && mine && (
                            <div className="ml-auto flex gap-1">
                              {!purchased && (
                                <Button
                                  size="sm"
                                  className="rounded-lg"
                                  onClick={() => reservationAction(gift.id, "purchased")}
                                >
                                  <ShoppingBag className="h-4 w-4" /> Acheté
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="outline"
                                className="rounded-lg"
                                aria-label="Annuler la réservation"
                                onClick={() => reservationAction(gift.id, "cancel")}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
