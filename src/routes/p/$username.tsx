import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, Gift as GiftIcon, Lock, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice, initials, PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/gift-box";
import { useGiftImageUrls, usePublicGiftImageUrls } from "@/lib/gift-image";
import { isProfilePageData, type ProfilePageData } from "@/lib/profile-page";

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

  const load = useCallback(async () => {
    const [{ data: auth }, { data, error: rpcError }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc("get_profile_page", {
        _username: username,
        _share_token: invite ?? null,
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
      _share_token: invite ?? null,
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
            ? "Demandez à son propriétaire un lien d'invitation ou rejoignez l'un de ses cercles."
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-7">
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback>{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold truncate">{name}</h1>
              <Badge variant="secondary">@{profile.username}</Badge>
            </div>
            {profile.bio && <p className="mt-1 text-sm text-muted-foreground">{profile.bio}</p>}
          </div>
        </div>
        {profile.is_owner && (
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/profile">Gérer mon profil et mes invitations</Link>
          </Button>
        )}
      </Card>

      {lists.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aucune liste accessible pour le moment.
        </Card>
      )}

      {lists.map((list) => (
        <section key={list.id} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">{list.title}</h2>
              {list.occasion && <p className="text-sm text-muted-foreground">{list.occasion}</p>}
            </div>
            <Badge variant="outline">{list.visibility === "public" ? "Publique" : "Cercles"}</Badge>
          </div>

          {list.gifts.length === 0 && (
            <p className="text-sm text-muted-foreground">Cette liste est encore vide.</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {list.gifts.map((gift) => {
              const reserved = !!gift.reservation;
              const mine = gift.reservation?.reserved_by_me ?? false;
              const purchased = gift.reservation?.status === "purchased";
              const imageSrc = gift.image_path ? signedUrls?.[gift.id] : gift.image_url;
              return (
                <Card key={gift.id} className={`p-4 ${reserved ? "opacity-60" : ""}`}>
                  <div className="flex gap-3">
                    {imageSrc ? (
                      <img src={imageSrc} alt="" className="h-20 w-20 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-secondary">
                        <GiftIcon className="h-7 w-7 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-medium leading-tight">{gift.title}</h3>
                        <Badge className={PRIORITY_COLOR[gift.priority]}>
                          {PRIORITY_LABEL[gift.priority]}
                        </Badge>
                      </div>
                      {gift.price != null && (
                        <p className="mt-2 font-semibold">
                          {formatPrice(gift.price, gift.currency)}
                        </p>
                      )}
                    </div>
                  </div>
                  {gift.description && (
                    <p className="mt-3 text-sm text-muted-foreground">{gift.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    {gift.url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={gift.url} target="_blank" rel="noreferrer noopener">
                          Voir <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                    {!profile.is_owner && !reserved && (
                      <Button
                        size="sm"
                        className="ml-auto"
                        disabled={busyGift === gift.id}
                        onClick={() => reservationAction(gift.id, "reserve")}
                      >
                        <Check className="mr-1 h-4 w-4" /> J'offre
                      </Button>
                    )}
                    {!profile.is_owner && reserved && !mine && (
                      <Badge className="ml-auto" variant="secondary">
                        {purchased ? "Acheté" : "Réservé"}
                      </Badge>
                    )}
                    {!profile.is_owner && mine && (
                      <div className="ml-auto flex gap-1">
                        {!purchased && (
                          <Button size="sm" onClick={() => reservationAction(gift.id, "purchased")}>
                            <ShoppingBag className="mr-1 h-4 w-4" /> Acheté
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="outline"
                          aria-label="Annuler la réservation"
                          onClick={() => reservationAction(gift.id, "cancel")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
