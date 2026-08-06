import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

import { apiAction, apiQuery } from "@/lib/self-hosted/api-client";
import { ExpandableGiftList, ExpandableGiftRow } from "@/components/ExpandableGiftList";
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
import { GiftCategoryFilter } from "@/components/GiftCategoryFilter";
import {
  filterGiftsByCategory,
  type GiftCategory,
  type GiftCategoryFilterValue,
} from "@/lib/gift-category";

export const Route = createFileRoute("/_authenticated/gifts-i-offer")({
  component: GiftsIOffer,
});

type Row = {
  category: GiftCategory;
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
  const [rows, setRows] = useState<Row[] | null>(null);
  const [toCancel, setToCancel] = useState<Row | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<GiftCategoryFilterValue>("all");

  const load = useCallback(async () => {
    try {
      const data =
        await apiQuery<Array<Omit<Row, "recipient"> & { owner_name: string | null }>>("offers");
      setRows(data.map((row) => ({ ...row, recipient: row.owner_name ?? "Membre" })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(resId: string) {
    let error: Error | null = null;
    try {
      await apiAction("cancel-reservation", { id: resId });
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error("Annulation impossible");
    }
    if (error) toast.error(error.message);
    else {
      toast.success("Réservation annulée");
      load();
    }
  }

  const filteredRows = filterGiftsByCategory(rows ?? [], categoryFilter);
  const total = filteredRows.reduce((sum, row) => sum + (row.price ?? 0), 0);

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
          <GiftCategoryFilter value={categoryFilter} onValueChange={setCategoryFilter} />

          {filteredRows.length === 0 && (
            <Card className="p-5 text-center text-sm text-muted-foreground">
              Aucun cadeau réservé dans cette catégorie.
            </Card>
          )}

          {filteredRows.length > 0 && (
            <Card className="p-4 bg-secondary">
              <p className="text-xs text-muted-foreground">Total prévisionnel</p>
              <p className="text-2xl font-bold">{formatPrice(total, "EUR")}</p>
            </Card>
          )}

          {filteredRows.length > 0 && (
            <ExpandableGiftList label="Cadeaux que j'offre">
              {filteredRows.map((r) => (
                <ExpandableGiftRow
                  key={r.reservation_id}
                  title={r.title}
                  category={r.category}
                  imageSrc={r.image_path ? signedUrls?.[r.gift_id] : r.image_url}
                  price={r.price}
                  currency={r.currency}
                  meta={`Pour ${r.recipient}`}
                  actions={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg"
                      aria-label={`Annuler la réservation de ${r.title}`}
                      onClick={() => setToCancel(r)}
                    >
                      <X className="h-4 w-4" /> Annuler la réservation
                    </Button>
                  }
                />
              ))}
            </ExpandableGiftList>
          )}
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
