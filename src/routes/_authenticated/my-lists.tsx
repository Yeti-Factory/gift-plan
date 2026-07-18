import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ImagePlus, Gift as GiftIcon, Sparkles } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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

      {circles.length === 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Rejoignez ou créez un cercle avant de commencer une liste.
        </Card>
      )}

      {lists.length === 0 && circles.length > 0 && (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Aucune liste pour l'instant. Créez-en une !
        </Card>
      )}

      {lists.map((list) => {
        const items = gifts.filter((g) => g.list_id === list.id);
        const circle = circles.find((c) => c.id === list.circle_id);
        return (
          <section key={list.id} className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h2 className="font-semibold text-lg leading-tight">{list.title}</h2>
                <p className="text-xs text-muted-foreground">
                  {circle?.name}
                  {list.occasion ? ` · ${list.occasion}` : ""}
                </p>
              </div>
              <div className="flex gap-1">
                <NewGiftDialog listId={list.id} userId={me} onCreated={load} />
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
                    <img src={src} alt="" className="h-16 w-16 rounded-xl object-cover bg-muted" />
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
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        await supabase.from("gifts").delete().eq("id", g.id);
                        toast.success("Supprimé");
                        load();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </section>
        );
      })}
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

function NewGiftDialog({
  listId,
  userId,
  onCreated,
}: {
  listId: string;
  userId: string | null;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [priority, setPriority] = useState<Priority>("j_adorerais");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const scrape = useServerFn(scrapeGiftUrl);

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

  async function create() {
    if (!title.trim() || !userId) return;
    setBusy(true);
    const priceNum = price ? Number(price.replace(",", ".")) : null;
    const { error } = await supabase.from("gifts").insert({
      list_id: listId,
      owner_id: userId,
      title: title.trim(),
      description: description.trim() || null,
      url: url.trim() || null,
      price: priceNum,
      currency: "EUR",
      priority,
      image_url: imagePath ? null : imageUrl,
      image_path: imagePath,
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Cadeau ajouté !");
      setTitle("");
      setDescription("");
      setUrl("");
      setPrice("");
      setImageUrl(null);
      setImagePath(null);
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      setPriority("j_adorerais");
      setOpen(false);
      onCreated();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="rounded-xl">
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau cadeau</DialogTitle>
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
          <Button onClick={create} disabled={busy || !title.trim()}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteListButton({ listId, onDeleted }: { listId: string; onDeleted: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        if (!confirm("Supprimer cette liste et tous ses cadeaux ?")) return;
        // gifts have FK on lists; but no ON DELETE CASCADE assumed — delete gifts first
        const { data: gs } = await supabase.from("gifts").select("id").eq("list_id", listId);
        if (gs && gs.length) await supabase.from("gifts").delete().eq("list_id", listId);
        const { error } = await supabase.from("lists").delete().eq("id", listId);
        if (error) toast.error(error.message);
        else {
          toast.success("Liste supprimée");
          onDeleted();
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
