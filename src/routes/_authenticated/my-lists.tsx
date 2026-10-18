import type { AmazonVariant } from "@/lib/amazon-variants.server";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Trash2, ImagePlus, Sparkles, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { scrapeGiftUrl } from "@/lib/gift-scrape.functions";

import { apiAction, apiQuery } from "@/lib/self-hosted/api-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpandableGiftList, ExpandableGiftRow } from "@/components/ExpandableGiftList";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIORITY_LABEL, type Priority } from "@/lib/gift-box";
import {
  removeUncommittedGiftImage,
  uploadGiftImageChecked,
  useGiftImageUrls,
} from "@/lib/gift-image";
import { GiftCategoryFilter } from "@/components/GiftCategoryFilter";
import {
  GIFT_CATEGORY_OPTIONS,
  filterGiftsByCategory,
  type GiftCategory,
  type GiftCategoryFilterValue,
} from "@/lib/gift-category";

export const Route = createFileRoute("/_authenticated/my-lists")({
  component: MyLists,
});

type Circle = { id: string; name: string };
type List = {
  id: string;
  title: string;
  occasion: string | null;
  circle_id: string | null;
  visibility: "public" | "circles" | "private";
  circle_ids: string[];
};
type Gift = {
  category: GiftCategory;
  id: string;
  list_id: string;
  title: string;
  description: string | null;
  url: string | null;
  image_url: string | null;
  image_path: string | null;
  price: number | null;
  currency: string;
  priority: Priority;
};

function MyLists() {
  const [me, setMe] = useState<string | null>(null);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteGift, setDeleteGift] = useState<Gift | null>(null);
  const [deletingGift, setDeletingGift] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<GiftCategoryFilterValue>("all");

  const load = useCallback(async () => {
    try {
      const data = await apiQuery<{
        userId: string;
        circles: Circle[];
        lists: List[];
        gifts: Gift[];
      }>("my-lists");
      setMe(data.userId);
      setCircles(data.circles);
      setLists(data.lists);
      setGifts(data.gifts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const giftIdsWithPath = gifts.filter((g) => g.image_path).map((g) => g.id);
  const { data: signedUrls } = useGiftImageUrls(giftIdsWithPath);

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mes listes</h1>
          <p className="text-sm text-muted-foreground">
            Vos listes personnelles, publiques ou partagées avec les cercles de votre choix.
          </p>
        </div>
        <NewListDialog circles={circles} onCreated={load} />
      </div>

      {!loading && gifts.length > 0 && (
        <GiftCategoryFilter value={categoryFilter} onValueChange={setCategoryFilter} />
      )}

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {!loading && lists.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Aucune liste pour l'instant. Créez-en une !
        </Card>
      )}

      {!loading &&
        lists.map((list) => {
          const allItems = gifts.filter((g) => g.list_id === list.id);
          const items = filterGiftsByCategory(allItems, categoryFilter);
          const circleNames = circles
            .filter((circle) => list.circle_ids.includes(circle.id))
            .map((circle) => circle.name);
          return (
            <section key={list.id} className="space-y-3">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg leading-tight">{list.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {list.visibility === "private"
                      ? "Privée — uniquement moi"
                      : list.visibility === "public"
                        ? "Publique — tout le monde"
                        : circleNames.join(", ")}
                    {list.occasion ? ` · ${list.occasion}` : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <GiftFormDialog mode="create" listId={list.id} userId={me} onSaved={load} />
                  <EditListDialog list={list} circles={circles} onSaved={load} />
                  <DeleteListButton listId={list.id} onDeleted={load} />
                </div>
              </div>

              {allItems.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">Ajoutez votre premier cadeau.</p>
              )}

              {allItems.length > 0 && items.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">
                  Aucun cadeau dans cette catégorie.
                </p>
              )}

              {items.length > 0 && (
                <ExpandableGiftList label={`Cadeaux de ${list.title}`}>
                  {items.map((g) => (
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
                      actions={
                        <>
                          <GiftFormDialog
                            mode="edit"
                            listId={g.list_id}
                            userId={me}
                            gift={g}
                            onSaved={load}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            aria-label="Supprimer le cadeau"
                            onClick={() => setDeleteGift(g)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      }
                    />
                  ))}
                </ExpandableGiftList>
              )}
            </section>
          );
        })}

      <AlertDialog
        open={!!deleteGift}
        onOpenChange={(open) => !open && !deletingGift && setDeleteGift(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce cadeau ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteGift?.title} » sera retiré de la liste. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingGift}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingGift}
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteGift) return;
                const id = deleteGift.id;
                setDeletingGift(true);
                try {
                  await apiAction("delete-gift", { id });
                  setGifts((current) => current.filter((gift) => gift.id !== id));
                  setDeleteGift(null);
                  toast.success("Cadeau supprimé");
                  await load();
                } catch {
                  toast.error("La suppression a échoué. Réessayez dans un instant.");
                } finally {
                  setDeletingGift(false);
                }
              }}
            >
              {deletingGift && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {deletingGift ? "Suppression…" : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewListDialog({ circles, onCreated }: { circles: Circle[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [occasion, setOccasion] = useState("");
  const [visibility, setVisibility] = useState<"public" | "circles" | "private">("private");
  const [circleIds, setCircleIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim() || (visibility === "circles" && circleIds.length === 0)) return;
    setBusy(true);
    try {
      await apiAction("save-list", {
        title: title.trim(),
        occasion: occasion.trim() || null,
        visibility,
        circleIds,
      });
      toast.success("Liste créée !");
      setTitle("");
      setOccasion("");
      setVisibility("private");
      setCircleIds([]);
      setOpen(false);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl">
          <Plus className="h-4 w-4 mr-1" /> Liste
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle liste</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titre</Label>
            <Input
              placeholder="Mon anniversaire"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <Label>Occasion (optionnel)</Label>
            <Input
              placeholder="Noël, anniversaire…"
              value={occasion}
              onChange={(e) => setOccasion(e.target.value)}
            />
          </div>
          <div>
            <Label>Qui peut consulter cette liste ?</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as "public" | "circles" | "private")}
            >
              <SelectTrigger aria-label="Visibilité de la liste">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Privée — uniquement moi</SelectItem>
                <SelectItem value="public">Publique — tout le monde</SelectItem>
                <SelectItem value="circles">Un ou plusieurs cercles</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              Une liste privée reste invisible aux autres, même si votre profil est public. Une
              liste publique est visible par tous ; une liste partagée est réservée aux cercles
              choisis et aux liens que vous créez.
            </p>
            {visibility === "circles" && (
              <div className="mt-2 space-y-2">
                {circles.map((circle) => (
                  <label
                    key={circle.id}
                    className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                  >
                    <Checkbox
                      checked={circleIds.includes(circle.id)}
                      onCheckedChange={(checked) =>
                        setCircleIds((current) =>
                          checked
                            ? [...current, circle.id]
                            : current.filter((id) => id !== circle.id),
                        )
                      }
                    />
                    {circle.name}
                  </label>
                ))}
                {circles.length === 0 && (
                  <p className="text-xs text-muted-foreground">Créez d'abord un cercle.</p>
                )}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={create}
            disabled={busy || !title.trim() || (visibility === "circles" && circleIds.length === 0)}
          >
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GiftFormDialog({
  mode,
  listId,
  userId,
  gift,
  onSaved,
}: {
  mode: "create" | "edit";
  listId: string;
  userId: string | null;
  gift?: Gift;
  onSaved: () => void;
}) {
  const isEdit = mode === "edit";
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(gift?.title ?? "");
  const [description, setDescription] = useState(gift?.description ?? "");
  const [url, setUrl] = useState(gift?.url ?? "");
  const [price, setPrice] = useState(gift?.price != null ? String(gift.price) : "");
  const [priority, setPriority] = useState<Priority>(gift?.priority ?? "j_adorerais");
  const [category, setCategory] = useState<GiftCategory | "">(gift?.category ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(gift?.image_url ?? null);
  const [imagePath, setImagePath] = useState<string | null>(gift?.image_path ?? null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [variants, setVariants] = useState<AmazonVariant[]>([]);
  const imported = useRef<Partial<Record<"title" | "description" | "price" | "imageUrl", string>>>(
    {},
  );
  function changeUrl(value: string) {
    fetchGeneration.current++;
    setFetching(false);
    setVariants([]);
    const current = latestForm.current;
    if (imported.current.title === current.title) setTitle("");
    if (imported.current.description === current.description) setDescription("");
    if (imported.current.price === current.price) setPrice("");
    if (imported.current.imageUrl === current.imageUrl) setImageUrl(null);
    imported.current = {};
    setUrl(value);
  }
  const scrape = useServerFn(scrapeGiftUrl);
  const fetchGeneration = useRef(0);
  const latestForm = useRef({
    open,
    title,
    description,
    url,
    price,
    imageUrl,
    imagePath,
    imagePreview,
  });
  useEffect(() => {
    latestForm.current = {
      open,
      title,
      description,
      url,
      price,
      imageUrl,
      imagePath,
      imagePreview,
    };
  }, [open, title, description, url, price, imageUrl, imagePath, imagePreview]);

  // Reset form on open (edit mode: refresh with current gift; create: clear)
  useEffect(() => {
    fetchGeneration.current += 1;
    setFetching(false);
    imported.current = {};
    setVariants([]);
    if (!open) return;
    setTitle(gift?.title ?? "");
    setDescription(gift?.description ?? "");
    setUrl(gift?.url ?? "");
    setPrice(gift?.price != null ? String(gift.price) : "");
    setPriority(gift?.priority ?? "j_adorerais");
    setCategory(gift?.category ?? "");
    setImageUrl(gift?.image_url ?? null);
    setImagePath(gift?.image_path ?? null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchFromUrl(selectedUrl?: string) {
    const requestedUrl = (selectedUrl ?? url).trim();
    if (selectedUrl) {
      setUrl(selectedUrl);
      latestForm.current.url = selectedUrl;
    }
    if (!requestedUrl) return;
    const generation = ++fetchGeneration.current;
    setFetching(true);
    try {
      const res = await scrape({ data: { url: requestedUrl } });
      const current = latestForm.current;
      if (
        generation !== fetchGeneration.current ||
        !current.open ||
        current.url.trim() !== requestedUrl
      )
        return;
      if (!res.ok) {
        toast.error(
          res.reason === "rate_limited"
            ? "Trop de demandes. Réessaie dans quelques minutes."
            : "Le site ne fournit pas de fiche produit exploitable. Aucun champ n’a été modifié ; tu peux compléter le cadeau à la main.",
        );
        return;
      }
      setVariants(res.variants ?? []);
      if (res.selectionRequired) {
        toast.message(
          "Choisis la couleur et la taille du produit pour récupérer les bonnes informations.",
        );
      }
      let filled = false;
      if (res.title && (!current.title.trim() || imported.current.title === current.title)) {
        imported.current.title = res.title;
        setTitle(res.title);
        filled = true;
      }
      if (
        res.description &&
        (!current.description.trim() || imported.current.description === current.description)
      ) {
        imported.current.description = res.description;
        setDescription(res.description);
        filled = true;
      }
      if (
        res.imageUrl &&
        (!current.imageUrl || imported.current.imageUrl === current.imageUrl) &&
        !current.imagePath &&
        !current.imagePreview
      ) {
        imported.current.imageUrl = res.imageUrl;
        setImageUrl(res.imageUrl);
        filled = true;
      }
      if (
        res.price != null &&
        (!current.price.trim() || imported.current.price === current.price)
      ) {
        if (res.currency === "EUR") {
          imported.current.price = String(res.price);
          setPrice(String(res.price));
          filled = true;
        } else {
          toast.message("Prix non repris : sa devise n’est pas indiquée ou n’est pas l’euro.");
        }
      }
      if (res.selectionRequired) return;
      if (res.variantPriceUnavailable) {
        toast.message(
          "Couleur et taille reprises. Amazon ne fournit pas le prix de cette variante : complète-le à la main.",
        );
        return;
      }
      if (filled && res.source === "url")
        toast.message(
          "Fnac bloque l’import automatique : titre provisoire déduit du lien, à vérifier. Ajoute la photo et le prix à la main.",
          { duration: 10000 },
        );
      else if (filled)
        toast.success("Informations disponibles récupérées. Vérifie-les avant d’enregistrer.");
      else toast.message("Aucun champ vide à préremplir.");
    } catch {
      if (generation === fetchGeneration.current && latestForm.current.open)
        toast.error("Impossible de récupérer les infos, saisis-les à la main.");
    } finally {
      if (generation === fetchGeneration.current) setFetching(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setBusy(true);
    try {
      const { path } = await uploadGiftImageChecked(userId, file);
      setImagePath(path);
      setImagePreview(URL.createObjectURL(file));
      setImageUrl(null); // uploaded image wins over any scraped URL
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload échoué";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!category || !title.trim() || !userId) return;
    setBusy(true);
    const priceNum = price ? Number(price.replace(",", ".")) : null;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      url: url.trim() || null,
      price: priceNum,
      currency: "EUR",
      priority,
      category,
      image_url: imagePath ? null : imageUrl,
      image_path: imagePath,
    };
    let error: Error | null = null;
    try {
      await apiAction("save-gift", {
        id: isEdit && gift ? gift.id : undefined,
        listId,
        title: payload.title,
        description: payload.description,
        url: payload.url,
        price: payload.price,
        priority: payload.priority,
        category: payload.category,
        imageUrl: payload.image_url,
        imagePath: payload.image_path,
      });
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error("Enregistrement impossible");
      if (imagePath && imagePath !== gift?.image_path) {
        await removeUncommittedGiftImage(userId, imagePath).catch(() => undefined);
      }
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(isEdit ? "Cadeau modifié" : "Cadeau ajouté !");
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setOpen(false);
      onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="icon" variant="ghost" aria-label="Modifier le cadeau">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            variant="outline"
            className="rounded-xl"
            aria-label="Ajouter un cadeau"
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le cadeau" : "Nouveau cadeau"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Catégorie (obligatoire)</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as GiftCategory)}>
              <SelectTrigger aria-label="Catégorie du cadeau" aria-required="true">
                <SelectValue placeholder="Choisir une catégorie" />
              </SelectTrigger>
              <SelectContent>
                {GIFT_CATEGORY_OPTIONS.map((option) => {
                  const CategoryIcon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon className={`h-3.5 w-3.5 ${option.iconClass}`} />{" "}
                        {option.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nom</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Livre, jeu, écharpe…"
            />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Taille, couleur, référence…"
              rows={2}
            />
          </div>
          <div>
            <Label>Lien</Label>
            <div className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => changeUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void fetchFromUrl()}
                disabled={fetching || !url.trim()}
                className="rounded-xl shrink-0"
              >
                <Sparkles className="h-4 w-4 mr-1" />
                {fetching ? "…" : "Récupérer"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Colle un lien produit puis « Récupérer » pour préremplir.
            </p>
          </div>
          {variants.length > 0 && (
            <div>
              <Label htmlFor="product-variant">Couleur et taille</Label>
              <select
                id="product-variant"
                className="w-full rounded-xl border bg-background p-3"
                disabled={fetching}
                defaultValue=""
                onChange={(event) => {
                  const selected = variants.find((variant) => variant.asin === event.target.value);
                  if (selected) {
                    changeUrl(selected.url);
                    void fetchFromUrl(selected.url);
                  }
                }}
              >
                <option value="" disabled>
                  Choisir la variante du produit
                </option>
                {variants.map((variant) => (
                  <option key={variant.asin} value={variant.asin}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Prix (€)</Label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="29.90"
              />
            </div>
            <div>
              <Label>Priorité</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Photo (optionnel)</Label>
            {imagePreview || imageUrl ? (
              <div className="mt-1 flex items-center gap-2">
                <img
                  src={imagePreview ?? imageUrl!}
                  alt=""
                  className="h-16 w-16 object-cover rounded-xl"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImageUrl(null);
                    if (userId && imagePath && imagePath !== gift?.image_path) {
                      removeUncommittedGiftImage(userId, imagePath).catch(() => undefined);
                    }
                    setImagePath(null);
                    if (imagePreview) URL.revokeObjectURL(imagePreview);
                    setImagePreview(null);
                  }}
                >
                  Retirer
                </Button>
              </div>
            ) : (
              <label className="mt-1 flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-accent">
                  <ImagePlus className="h-4 w-4" /> Ajouter une image
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={onFile} />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy || !category || !title.trim()}>
            {isEdit ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditListDialog({
  list,
  circles,
  onSaved,
}: {
  list: List;
  circles: Circle[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [occasion, setOccasion] = useState(list.occasion ?? "");
  const [visibility, setVisibility] = useState<"public" | "circles" | "private">(list.visibility);
  const [circleIds, setCircleIds] = useState<string[]>(list.circle_ids);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(list.title);
    setOccasion(list.occasion ?? "");
    setVisibility(list.visibility);
    setCircleIds(list.circle_ids);
  }, [open, list]);

  async function save() {
    if (!title.trim() || (visibility === "circles" && circleIds.length === 0)) return;
    setBusy(true);
    let error: Error | null = null;
    try {
      await apiAction("save-list", {
        id: list.id,
        title: title.trim(),
        occasion: occasion.trim() || null,
        visibility,
        circleIds,
      });
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error("Modification impossible");
    }
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Liste modifiée");
      setOpen(false);
      onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Modifier la liste">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier la liste</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Occasion (optionnel)</Label>
            <Input value={occasion} onChange={(e) => setOccasion(e.target.value)} />
          </div>
          <div>
            <Label>Qui peut consulter cette liste ?</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility(value as "public" | "circles" | "private")}
            >
              <SelectTrigger aria-label="Visibilité de la liste">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Privée — uniquement moi</SelectItem>
                <SelectItem value="public">Publique — tout le monde</SelectItem>
                <SelectItem value="circles">Un ou plusieurs cercles</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              Une liste privée reste invisible aux autres, même si votre profil est public. Une
              liste publique est visible par tous ; une liste partagée est réservée aux cercles
              choisis et aux liens que vous créez.
            </p>
            {visibility === "circles" && (
              <div className="mt-2 space-y-2">
                {circles.map((circle) => (
                  <label
                    key={circle.id}
                    className="flex items-center gap-2 rounded-lg border p-2 text-sm"
                  >
                    <Checkbox
                      checked={circleIds.includes(circle.id)}
                      onCheckedChange={(checked) =>
                        setCircleIds((current) =>
                          checked
                            ? [...current, circle.id]
                            : current.filter((id) => id !== circle.id),
                        )
                      }
                    />
                    {circle.name}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={save}
            disabled={busy || !title.trim() || (visibility === "circles" && circleIds.length === 0)}
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteListButton({ listId, onDeleted }: { listId: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doDelete() {
    setBusy(true);
    let error: Error | null = null;
    try {
      await apiAction("delete-list", { id: listId });
    } catch (caught) {
      error = caught instanceof Error ? caught : new Error("Suppression impossible");
    }
    setBusy(false);
    setOpen(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Liste supprimée");
      onDeleted();
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Supprimer la liste"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer cette liste ?</AlertDialogTitle>
          <AlertDialogDescription>
            Tous les cadeaux et réservations de cette liste seront supprimés. Cette action est
            irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(e) => {
              e.preventDefault();
              doDelete();
            }}
          >
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
