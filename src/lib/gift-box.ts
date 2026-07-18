import { supabase } from "@/integrations/supabase/client";

export type Priority = "indispensable" | "j_adorerais" | "me_plairait";

export const PRIORITY_LABEL: Record<Priority, string> = {
  indispensable: "Indispensable",
  j_adorerais: "J'adorerais",
  me_plairait: "Ça me plairait",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  indispensable: "bg-primary text-primary-foreground",
  j_adorerais: "bg-accent text-accent-foreground",
  me_plairait: "bg-secondary text-secondary-foreground",
};

export function formatPrice(price: number | null | undefined, currency = "EUR") {
  if (price == null) return "";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(Number(price));
  } catch {
    return `${price} ${currency}`;
  }
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

// uploadGiftImage was removed: use uploadGiftImageChecked from "@/lib/gift-image".
// It sniffs magic bytes, caps size, stores image_path (private), and display URLs
// are minted on demand via getGiftImageSignedUrls (5 min TTL).

export async function ensureProfile(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const meta = user.user_metadata || {};
  const displayName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    (user.email ? user.email.split("@")[0] : "Ami");
  const avatarUrl = (meta.avatar_url as string) || null;
  await supabase
    .from("profiles")
    .upsert(
      { id: user.id, display_name: displayName, avatar_url: avatarUrl },
      { onConflict: "id", ignoreDuplicates: false },
    );
}
