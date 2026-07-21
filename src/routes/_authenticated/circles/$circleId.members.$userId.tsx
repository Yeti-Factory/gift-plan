import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { ExternalLink, Check, X, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PRIORITY_LABEL,
  PRIORITY_COLOR,
  formatPrice,
  initials,
  type Priority,
} from "@/lib/gift-box";
import { useGiftImageUrls } from "@/lib/gift-image";
import { GiftCategoryFilter } from "@/components/GiftCategoryFilter";
import {
  filterGiftsByCategory,
  getGiftCategoryOption,
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
  owner_id: string;
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
    const { data: user } = await supabase.auth.getUser();
    setMe(user.user?.id ?? null);

    const { data: p } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    setProfile(p);

    const { data: accessRows } = await supabase
      .from("list_circle_access")
      .select("list_id")
      .eq("circle_id", circleId);
    const accessibleListIds = (accessRows ?? []).map((row) => row.list_id);
    const { data: ls } = accessibleListIds.length
      ? await supabase
          .from("lists")
          .select("id, title, occasion, event_date")
          .in("id", accessibleListIds)
          .eq("owner_id", userId)
          .order("created_at", { ascending: false })
      : { data: [] };
    setLists(ls ?? []);

    const listIds = (ls ?? []).map((l) => l.id);
    if (listIds.length === 0) {
      setGifts([]);
      setReservations([]);
      return;
    }
    const { data: gs } = await supabase
      .from("gifts")
      .select("*")
      .in("list_id", listIds)
      .order("created_at", { ascending: false });
    setGifts((gs as Gift[]) ?? []);

    // RLS ensures we can only see reservations when viewing SOMEONE ELSE's list.
    // For your own list this returns nothing → surprise preserved.
    const giftIds = (gs ?? []).map((g) => g.id);
    if (giftIds.length === 0) {
      setReservations([]);
      return;
    }
    const { data: rs } = await supabase
      .from("reservations")
      .select("gift_id, buyer_id, status")
      .in("gift_id", giftIds);
    setReservations(rs ?? []);

    const buyerIds = Array.from(new Set((rs ?? []).map((r) => r.buyer_id)));
    if (buyerIds.length === 0) {
      setBuyers({});
      return;
    }
    const { data: bs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", buyerIds);
    const map: Record<string, BuyerProfile> = {};
    (bs ?? []).forEach((b) => {
      map[b.id] = b;
    });
    setBuyers(map);
  }, [circleId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel(`member-${userId}-gifts`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gifts" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, userId]);

  async function reserve(giftId: string) {
    if (!me) return;
    const { error } = await supabase.rpc("set_gift_reservation", {
      _gift_id: giftId,
      _action: "reserve",
      _share_token: undefined,
    });
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        toast.error("Trop tard ! Quelqu'un vient de réserver ce cadeau.");
        load();
      } else {
        toast.error(error.message);
      }
    } else toast.success("Cadeau réservé — c'est votre secret !");
  }

  async function unreserve(giftId: string) {
    if (!me) return;
    const { error } = await supabase.rpc("set_gift_reservation", {
      _gift_id: giftId,
      _action: "cancel",
      _share_token: undefined,
    });
    if (error) toast.error(error.message);
    else toast.success("Réservation annulée");
  }

  async function markPurchased(giftId: string) {
    if (!me) return;
    const { error } = await supabase.rpc("set_gift_reservation", {
      _gift_id: giftId,
      _action: "purchased",
      _share_token: undefined,
    });
    if (error) toast.error(error.message);
    else toast.success("Marqué comme acheté 🎁");
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
            {listGifts.map((g) => {
              const res = reservations.find((r) => r.gift_id === g.id);
              const reservedByMe = res?.buyer_id === me;
              const purchased = res?.status === "purchased";
              const dimmed = !isOwn && !!res;
              const buyerName = res ? (buyers[res.buyer_id]?.display_name ?? "Quelqu'un") : null;
              const category = getGiftCategoryOption(g.category);
              const CategoryIcon = category.icon;
              const imageSrc = g.image_path ? signedUrls?.[g.id] : g.image_url;
              return (
                <Card
                  key={g.id}
                  className={`p-3 flex gap-3 transition-opacity ${dimmed ? "opacity-60" : ""}`}
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt=""
                      className="h-20 w-20 rounded-xl object-cover bg-muted"
                    />
                  ) : (
                    <div
                      className={`h-20 w-20 rounded-xl flex items-center justify-center ${category.surfaceClass}`}
                      title={category.label}
                    >
                      <CategoryIcon className="h-8 w-8 opacity-70" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex items-center gap-1.5 font-medium leading-tight">
                        {imageSrc && (
                          <span
                            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded ${category.surfaceClass}`}
                            title={category.label}
                          >
                            <CategoryIcon className="h-2.5 w-2.5" />
                            <span className="sr-only">{category.label}</span>
                          </span>
                        )}
                        <span>{g.title}</span>
                      </p>
                      <Badge className={PRIORITY_COLOR[g.priority]}>
                        {PRIORITY_LABEL[g.priority]}
                      </Badge>
                    </div>
                    {g.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{g.description}</p>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        {g.price != null && (
                          <span className="text-sm font-semibold">
                            {formatPrice(g.price, g.currency)}
                          </span>
                        )}
                        {g.url && (
                          <a
                            href={g.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-xs text-primary flex items-center gap-1 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Voir <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      {!isOwn && (
                        <>
                          {!res && (
                            <Button size="sm" onClick={() => reserve(g.id)} className="rounded-xl">
                              <Check className="h-4 w-4 mr-1" /> J'offre
                            </Button>
                          )}
                          {res && reservedByMe && (
                            <div className="flex gap-1">
                              {!purchased && (
                                <Button
                                  size="sm"
                                  onClick={() => markPurchased(g.id)}
                                  className="rounded-xl"
                                >
                                  <ShoppingBag className="h-4 w-4 mr-1" /> Acheté
                                </Button>
                              )}
                              {purchased && (
                                <Badge className="bg-green-600 hover:bg-green-600 text-white">
                                  ✓ Acheté
                                </Badge>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => unreserve(g.id)}
                                className="rounded-xl"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {res && !reservedByMe && (
                            <Badge
                              variant="secondary"
                              className={
                                purchased ? "bg-green-600 hover:bg-green-600 text-white" : ""
                              }
                            >
                              {purchased ? "✓ Acheté" : "Réservé"} par {buyerName}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
