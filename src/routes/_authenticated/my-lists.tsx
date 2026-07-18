import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ImagePlus, Gift as GiftIcon, Sparkles, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { scrapeGiftUrl } from "@/lib/gift-scrape.functions";

import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { PRIORITY_LABEL, PRIORITY_COLOR, formatPrice, type Priority } from "@/lib/gift-box";
import { uploadGiftImageChecked, useGiftImageUrls } from "@/lib/gift-image";

export const Route = createFileRoute("/_authenticated/my-lists")({
  component: MyLists,
});

type Circle = { id: string; name: string };
type List = { id: string; title: string; occasion: string | null; circle_id: string };
type Gift = {
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

  const load = useCallback(async () => {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    setMe(user.user.id);

    const { data: cs } = await supabase.from("circles").select("id, name");
    setCircles(cs ?? []);

    const { data: ls } = await supabase
      .from("lists")
      .select("id, title, occasion, circle_id")
      .eq("owner_id", user.user.id)
      .order("created_at", { ascending: false });
    setLists(ls ?? []);

    const listIds = (ls ?? []).map((l) => l.id);
    if (listIds.length === 0) {
      setGifts([]);
      setLoading(false);
      return;
    }
    const { data: gs } = await supabase
      .from("gifts")
      .select(
        "id, list_id, title, description, url, image_url, image_path, price, currency, priority",
      )
      .in("list_id", listIds)
      .order("created_at", { ascending: false });
    setGifts((gs as Gift[]) ?? []);
    setLoading(false);
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
          <p className="text-sm text-muted-foreground">Vos envies, par cercle et occasion.</p>
        </div>
        <NewListDialog circles={circles} onCreated={load} />
      </div>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      )}

      {!loading && circles.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Rejoignez ou créez un cercle avant de commencer une liste.
        </Card>
      )}

      {!loading && lists.length === 0 && circles.length > 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Aucune liste pour l'instant. Créez-en une !
        </Card>
      )}

      {!loading &&
        lists.map((list) => {
          const items = gifts.filter((g) => g.list_id === list.id);
          const circle = circles.find((c) => c.id === list.circle_id);
          return (
            <section key={list.id} className="space-y-3">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold text-lg leading-tight">{list.title}</h2>
                  <p className="text-xs text-muted-foreground">
                    {circle?.name}
                    {list.occasion ? ` · ${list.occasion}` : ""}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <GiftFormDialog mode="create" listId={list.id} userId={me} onSaved={load} />
                  <EditListDialog list={list} circles={circles} onSaved={load} />
                  <DeleteListButton listId={list.id} onDeleted={load} />
                </div>
              </div>

              {items.length === 0 && (
                <p className="text-sm text-muted-foreground px-1">Ajoutez votre premier cadeau.</p>
              )}

              {items.map((g) => (
                <Card key={g.id} className="p-3 flex gap-3">
                  {(() => {
                    const src = g.image_path ? signedUrls?.[g.id] : g.image_url;
                    return src ? (
                      <img
                        src={src}
                        alt=""
                        className="h-16 w-16 rounded-xl object-cover bg-muted"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-xl bg-secondary flex items-center justify-center">
                        <GiftIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-tight">{g.title}</p>
                      <Badge className={PRIORITY_COLOR[g.priority]}>
                        {PRIORITY_LABEL[g.priority]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      {g.price != null && (
                        <span className="text-sm font-semibold">
                          {formatPrice(g.price, g.currency)}
                        </span>
                      )}
                      <div className="flex gap-1 ml-auto">
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
                          aria-label="Supprimer le cadeau"
                          onClick={() => setDeleteGift(g)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </section>
          );
        })}

      <AlertDialog open={!!deleteGift} onOpenChange={(o) => !o && setDeleteGift(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce cadeau ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteGift?.title} » sera retiré de la liste. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleteGift) return;
                const id = deleteGift.id;
                setDeleteGift(null);
                const { error } = await supabase.from("gifts").delete().eq("id", id);
                if (error) toast.error(error.message);
                else {
                  toast.success("Cadeau supprimé");
                  load();
                }
              }}
            >
              Supprimer
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
  const [circleId, setCircleId] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!title.trim() || !circleId) return;
    setBusy(true);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await supabase.from("lists").insert({
      title: title.trim(),
      occasion: occasion.trim() || null,
      circle_id: circleId,
      owner_id: user.user.id,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Liste créée !");
      setTitle("");
      setOccasion("");
      setCircleId("");
      setOpen(false);
      onCreated();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-xl" disabled={circles.length === 0}>
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
            <Label>Cercle</Label>
            <Select value={circleId} onValueChange={setCircleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un cercle" />
              </SelectTrigger>
              <SelectContent>
                {circles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={create} disabled={busy || !title.trim() || !circleId}>
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
  const [imageUrl, setImageUrl] = useState<string | null>(gift?.image_url ?? null);
  const [imagePath, setImagePath] = useState<string | null>(gift?.image_path ?? null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const scrape = useServerFn(scrapeGiftUrl);

  // Reset form on open (edit mode: refresh with current gift; create: clear)
  useEffect(() => {
    if (!open) return;
    setTitle(gift?.title ?? "");
    setDescription(gift?.description ?? "");
    setUrl(gift?.url ?? "");
    setPrice(gift?.price != null ? String(gift.price) : "");
    setPriority(gift?.priority ?? "j_adorerais");
    setImageUrl(gift?.image_url ?? null);
    setImagePath(gift?.image_path ?? null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function fetchFromUrl() {
    if (!url.trim()) return;
    setFetching(true);
    try {
      const res = await scrape({ data: { url: url.trim() } });
      if (!res.ok) {
        toast.error("Impossible de récupérer les infos, saisis-les à la main.");
        return;
      }
      let filled = false;
      if (res.title && !title) {
        setTitle(res.title);
        filled = true;
      }
      if (res.imageUrl && !imageUrl) {
        setImageUrl(res.imageUrl);
        filled = true;
      }
      if (res.price != null && !price) {
        setPrice(String(res.price));
        filled = true;
      }
      if (filled) toast.success("Infos récupérées !");
      else toast.message("Rien trouvé à préremplir.");
    } catch {
      toast.error("Impossible de récupérer les infos, saisis-les à la main.");
    } finally {
      setFetching(false);
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
    if (!title.trim() || !userId) return;
    setBusy(true);
    const priceNum = price ? Number(price.replace(",", ".")) : null;
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      url: url.trim() || null,
      price: priceNum,
      currency: "EUR",
      priority,
      image_url: imagePath ? null : imageUrl,
      image_path: imagePath,
    };
    const { error } =
      isEdit && gift
        ? await supabase.from("gifts").update(payload).eq("id", gift.id)
        : await supabase.from("gifts").insert({ ...payload, list_id: listId, owner_id: userId });
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
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
              />
              <Button
                type="button"
                variant="outline"
                onClick={fetchFromUrl}
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
          <Button onClick={save} disabled={busy || !title.trim()}>
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
  const [circleId, setCircleId] = useState(list.circle_id);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(list.title);
    setOccasion(list.occasion ?? "");
    setCircleId(list.circle_id);
  }, [open, list]);

  async function save() {
    if (!title.trim() || !circleId) return;
    setBusy(true);
    const { error } = await supabase
      .from("lists")
      .update({
        title: title.trim(),
        occasion: occasion.trim() || null,
        circle_id: circleId,
      })
      .eq("id", list.id);
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
            <Label>Cercle</Label>
            <Select value={circleId} onValueChange={setCircleId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {circles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={busy || !title.trim() || !circleId}>
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
    const { data: gs } = await supabase.from("gifts").select("id").eq("list_id", listId);
    if (gs && gs.length) await supabase.from("gifts").delete().eq("list_id", listId);
    const { error } = await supabase.from("lists").delete().eq("id", listId);
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
