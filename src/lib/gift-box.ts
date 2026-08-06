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
