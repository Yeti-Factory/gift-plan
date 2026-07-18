import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Gift as GiftIcon, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { formatPrice } from "@/lib/gift-box";
import { useGiftImageUrls } from "@/lib/gift-image";

export const Route = createFileRoute("/_authenticated/gifts-i-offer")({
  component: GiftsIOffer,
});

type Row = {
  reservation_id: string;
  gift_id: string;
  title: string;
  price: number | null;
  currency: string;
  image_url: string | null;
  image_path: string | null;
  recipient: string;
};

function GiftsIOffer() {
  const [me, setMe] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [toCancel, setToCancel] = useState<Row | null>(null);

  const load = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    setMe(user.user.id);

    const { data: res, error } = await supabase
      .from("reservations")
      .select("id, gift_id")
      .eq("buyer_id", user.user.id);
    if (error) {
      toast.error(error.message);
      setRows([]);
      return;
    }
    if (!res || res.length === 0) {
      setRows([]);
      return;
    }
    const giftIds = res.map((r) => r.gift_id);
    const { data: gifts } = await supabase
      .from("gifts")
      .select("id, title, price, currency, image_url, image_path, owner_id")
      .in("id", giftIds);

    const ownerIds = [...new Set((gifts ?? []).map((g) => g.owner_id))];
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ownerIds);
    const nameMap = new Map((profs ?? []).map((p) => [p.id, p.display_name ?? "Membre"]));

    const giftMap = new Map((gifts ?? []).map((g) => [g.id, g]));
    setRows(
      res
        .map((r) => {
          const g = giftMap.get(r.gift_id);
          if (!g) return null;
          return {
            reservation_id: r.id,
            gift_id: g.id,
            title: g.title,
            price: g.price,
            currency: g.currency,
            image_url: g.image_url,
            image_path: g.image_path,
            recipient: nameMap.get(g.owner_id) ?? "Membre",
          } as Row;
        })
        .filter(Boolean) as Row[],
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(resId: string) {
    const { error } = await supabase.from("reservations").delete().eq("id", resId);
    if (error) toast.error(error.message);
    else {
      toast.success("Réservation annulée");
      load();
    }
  }

  const total = (rows ?? []).reduce((s, r) => s + (r.price ?? 0), 0);

  const idsWithPath = (rows ?? []).filter((r) => r.image_path).map((r) => r.gift_id);
  const { data: signedUrls } = useGiftImageUrls(idsWithPath);

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Ce que j'offre</h1>
        <p className="text-sm text-muted-foreground">
          Vos réservations secrètes. Personne d'autre ne les voit.
        </p>
      </div>

      {rows === null && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      )}

      {rows?.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Vous n'avez encore rien réservé.
        </Card>
      )}

      {rows && rows.length > 0 && (
        <>
          <Card className="p-4 bg-secondary">
            <p className="text-xs text-muted-foreground">Total prévisionnel</p>
            <p className="text-2xl font-bold">{formatPrice(total, "EUR")}</p>
          </Card>

          {rows.map((r) => (
            <Card key={r.reservation_id} className="p-3 flex gap-3 items-center">
              {(() => {
                const src = r.image_path ? signedUrls?.[r.gift_id] : r.image_url;
                return src ? (
                  <img src={src} alt="" className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-xl bg-secondary flex items-center justify-center">
                    <GiftIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{r.title}</p>
                <p className="text-xs text-muted-foreground">Pour {r.recipient}</p>
                {r.price != null && (
                  <p className="text-sm font-semibold">{formatPrice(r.price, r.currency)}</p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Annuler la réservation"
                onClick={() => setToCancel(r)}
              >
                <X className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </>
      )}

      <AlertDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler cette réservation ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {toCancel?.title} » redeviendra disponible pour tout le monde. Attention à ne pas
              gâcher la surprise si tu l'as déjà acheté.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (!toCancel) return;
                const id = toCancel.reservation_id;
                setToCancel(null);
                cancel(id);
              }}
            >
              Annuler la réservation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
