import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Check, X, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { apiAction, apiQuery } from "@/lib/self-hosted/api-client";
import { ExpandableGiftList, ExpandableGiftRow } from "@/components/ExpandableGiftList";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, type Priority } from "@/lib/gift-box";
import { useGiftImageUrls } from "@/lib/gift-image";
import { GiftCategoryFilter } from "@/components/GiftCategoryFilter";
import {
  filterGiftsByCategory,
  type GiftCategory,
  type GiftCategoryFilterValue,
} from "@/lib/gift-category";

export const Route = createFileRoute("/_authenticated/circles/$circleId/members/$userId")({
  component: MemberLists,
});

type Gift = {
  category: GiftCategory;
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  image_url: string | null;
  image_path: string | null;
  price: number | null;
  currency: string;
  priority: Priority;
  list_id: string;
};

type List = { id: string; title: string; occasion: string | null; event_date: string | null };
type Reservation = { gift_id: string; buyer_id: string; status: string };
type BuyerProfile = { id: string; display_name: string | null };

function MemberLists() {
  const { circleId, userId } = Route.useParams();
  const [me, setMe] = useState<string | null>(null);
  const [profile, setProfile] = useState<{
    display_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [lists, setLists] = useState<List[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [buyers, setBuyers] = useState<Record<string, BuyerProfile>>({});
  const [categoryFilter, setCategoryFilter] = useState<GiftCategoryFilterValue>("all");

  const isOwn = me === userId;

  const load = useCallback(async () => {
    const data = await apiQuery<{
      profile: { display_name: string | null; avatar_url: string | null };
      lists: List[];
      gifts: Array<
        Gift & {
          buyer_id: string | null;
          buyer_name: string | null;
          reservation_status: string | null;
        }
      >;
      viewerId: string;
    }>("circle-member", { circleId, userId });
    setMe(data.viewerId);
    setProfile(data.profile);
    setLists(data.lists);
    setGifts(data.gifts);
    setReservations(
      data.gifts.flatMap((gift) =>
        gift.buyer_id && gift.reservation_status
          ? [{ gift_id: gift.id, buyer_id: gift.buyer_id, status: gift.reservation_status }]
          : [],
      ),
    );
    setBuyers(
      Object.fromEntries(
        data.gifts.flatMap((gift) =>
          gift.buyer_id
            ? [[gift.buyer_id, { id: gift.buyer_id, display_name: gift.buyer_name }]]
            : [],
        ),
      ),
    );
  }, [circleId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(load, 15_000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function reserve(giftId: string) {
    if (!me) return;
    let error: Error | null = null;
    try {
      await apiAction("reserve", { giftId, status: "reserved" });
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error("Réservation impossible");
    }
    if (error) {
      if ((error as { code?: string }).code === "ALREADY_RESERVED") {
        toast.error("Trop tard ! Quelqu'un vient de réserver ce cadeau.");
        load();
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success("Cadeau réservé — c'est votre secret !");
      load();
    }
  }

  async function unreserve(giftId: string) {
    if (!me) return;
    let error: Error | null = null;
    try {
      await apiAction("reserve", { giftId, status: null });
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error("Annulation impossible");
    }
    if (error) toast.error(error.message);
    else {
      toast.success("Réservation annulée");
      load();
    }
  }

  async function markPurchased(giftId: string) {
    if (!me) return;
    let error: Error | null = null;
    try {
      await apiAction("reserve", { giftId, status: "purchased" });
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error("Mise à jour impossible");
    }
    if (error) toast.error(error.message);
    else {
      toast.success("Marqué comme acheté 🎁");
      load();
    }
  }

  const name = profile?.display_name ?? "Membre";

  const idsWithPath = gifts.filter((g) => g.image_path).map((g) => g.id);
  const { data: signedUrls } = useGiftImageUrls(idsWithPath);

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Avatar className="h-14 w-14">
          {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback>{initials(name)}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-xl font-bold">{isOwn ? "Vos listes" : `Idées pour ${name}`}</h1>
          {isOwn && (
            <p className="text-xs text-muted-foreground">
              Les réservations sont cachées pour préserver la surprise.
            </p>
          )}
        </div>
      </div>

      {gifts.length > 0 && (
        <GiftCategoryFilter value={categoryFilter} onValueChange={setCategoryFilter} />
      )}

      {lists.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          {isOwn
            ? "Créez votre première liste dans « Mes listes »."
            : `${name} n'a pas encore de liste ici.`}
        </Card>
      )}

      {lists.map((list) => {
        const allListGifts = gifts.filter((g) => g.list_id === list.id);
        const listGifts = filterGiftsByCategory(allListGifts, categoryFilter);
        return (
          <section key={list.id} className="space-y-3">
            <div>
              <h2 className="font-semibold text-lg">{list.title}</h2>
              {list.occasion && <p className="text-xs text-muted-foreground">{list.occasion}</p>}
            </div>
            {allListGifts.length === 0 && (
              <p className="text-sm text-muted-foreground px-1">Aucun cadeau dans cette liste.</p>
            )}
            {allListGifts.length > 0 && listGifts.length === 0 && (
              <p className="text-sm text-muted-foreground px-1">
                Aucun cadeau dans cette catégorie.
              </p>
            )}
            {listGifts.length > 0 && (
              <ExpandableGiftList label={`Cadeaux de ${list.title}`}>
                {listGifts.map((g) => {
                  const res = reservations.find((r) => r.gift_id === g.id);
                  const reservedByMe = res?.buyer_id === me;
                  const purchased = res?.status === "purchased";
                  const buyerName = res
                    ? (buyers[res.buyer_id]?.display_name ?? "Quelqu'un")
                    : null;
                  return (
                    <ExpandableGiftRow
                      key={g.id}
                      title={g.title}
                      category={g.category}
                      imageSrc={g.image_path ? signedUrls?.[g.id] : g.image_url}
                      price={g.price}
                      currency={g.currency}
                      priority={g.priority}
                      description={g.description}
                      url={g.url}
                      className={!isOwn && res ? "opacity-65" : undefined}
                      status={
                        !isOwn && res ? (
                          <Badge
                            variant="secondary"
                            className={`h-5 rounded-full px-1.5 text-[9px] ${
                              purchased ? "bg-green-600 text-white hover:bg-green-600" : ""
                            }`}
                          >
                            {purchased ? "Acheté" : "Réservé"}
                          </Badge>
                        ) : undefined
                      }
                      actions={
                        !isOwn ? (
                          <>
                            {!res && (
                              <Button
                                size="sm"
                                onClick={() => reserve(g.id)}
                                className="h-8 rounded-lg"
                              >
                                <Check className="h-4 w-4" /> J'offre
                              </Button>
                            )}
                            {res && reservedByMe && (
                              <>
                                {!purchased && (
                                  <Button
                                    size="sm"
                                    onClick={() => markPurchased(g.id)}
                                    className="h-8 rounded-lg"
                                  >
                                    <ShoppingBag className="h-4 w-4" /> Acheté
                                  </Button>
                                )}
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => unreserve(g.id)}
                                  className="h-8 w-8 rounded-lg"
                                  aria-label={`Annuler la réservation de ${g.title}`}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            {res && !reservedByMe && (
                              <span className="text-xs text-muted-foreground">
                                {purchased ? "Acheté" : "Réservé"} par {buyerName}
                              </span>
                            )}
                          </>
                        ) : undefined
                      }
                    />
                  );
                })}
              </ExpandableGiftList>
            )}
          </section>
        );
      })}
    </div>
  );
}
