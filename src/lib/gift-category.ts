import {
  Baby,
  BookOpen,
  Dumbbell,
  Gamepad2,
  Gift,
  House,
  Laptop,
  Music2,
  Palette,
  Plane,
  Puzzle,
  Shirt,
  Utensils,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

export const GIFT_CATEGORY_OPTIONS = [
  {
    value: "culture",
    label: "Culture",
    icon: BookOpen,
    iconClass: "text-amber-600",
    surfaceClass: "bg-amber-100 text-amber-700",
  },
  {
    value: "musique",
    label: "Musique",
    icon: Music2,
    iconClass: "text-blue-600",
    surfaceClass: "bg-blue-100 text-blue-700",
  },
  {
    value: "tech_geek",
    label: "Tech & geek",
    icon: Gamepad2,
    iconClass: "text-violet-600",
    surfaceClass: "bg-violet-100 text-violet-700",
  },
  {
    value: "informatique",
    label: "Informatique",
    icon: Laptop,
    iconClass: "text-sky-600",
    surfaceClass: "bg-sky-100 text-sky-700",
  },
  {
    value: "beaute_bien_etre",
    label: "Beauté & bien-être",
    icon: WandSparkles,
    iconClass: "text-rose-600",
    surfaceClass: "bg-rose-100 text-rose-700",
  },
  {
    value: "mode",
    label: "Mode & vestimentaire",
    icon: Shirt,
    iconClass: "text-fuchsia-600",
    surfaceClass: "bg-fuchsia-100 text-fuchsia-700",
  },
  {
    value: "sport",
    label: "Sport",
    icon: Dumbbell,
    iconClass: "text-emerald-600",
    surfaceClass: "bg-emerald-100 text-emerald-700",
  },
  {
    value: "maison_deco",
    label: "Maison & déco",
    icon: House,
    iconClass: "text-orange-600",
    surfaceClass: "bg-orange-100 text-orange-700",
  },
  {
    value: "jeux_loisirs",
    label: "Jeux",
    icon: Puzzle,
    iconClass: "text-indigo-600",
    surfaceClass: "bg-indigo-100 text-indigo-700",
  },
  {
    value: "loisirs",
    label: "Loisirs",
    icon: Palette,
    iconClass: "text-lime-700",
    surfaceClass: "bg-lime-100 text-lime-700",
  },
  {
    value: "gastronomie",
    label: "Gastronomie",
    icon: Utensils,
    iconClass: "text-red-600",
    surfaceClass: "bg-red-100 text-red-700",
  },
  {
    value: "voyages_experiences",
    label: "Voyages & expériences",
    icon: Plane,
    iconClass: "text-cyan-600",
    surfaceClass: "bg-cyan-100 text-cyan-700",
  },
  {
    value: "enfants",
    label: "Enfants",
    icon: Baby,
    iconClass: "text-yellow-700",
    surfaceClass: "bg-yellow-100 text-yellow-800",
  },
  {
    value: "autre",
    label: "Autre",
    icon: Gift,
    iconClass: "text-slate-500",
    surfaceClass: "bg-slate-100 text-slate-600",
  },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  icon: LucideIcon;
  iconClass: string;
  surfaceClass: string;
}>;

export type GiftCategory = (typeof GIFT_CATEGORY_OPTIONS)[number]["value"];
export type GiftCategoryFilterValue = "all" | GiftCategory;

const GIFT_CATEGORY_VALUES = new Set<string>(GIFT_CATEGORY_OPTIONS.map((option) => option.value));

export function isGiftCategory(value: unknown): value is GiftCategory {
  return typeof value === "string" && GIFT_CATEGORY_VALUES.has(value);
}

export function normalizeGiftCategory(value: unknown): GiftCategory {
  return isGiftCategory(value) ? value : "autre";
}

export function getGiftCategoryOption(value: unknown) {
  const normalized = normalizeGiftCategory(value);
  return GIFT_CATEGORY_OPTIONS.find((option) => option.value === normalized)!;
}

export function filterGiftsByCategory<T extends { category?: string | null }>(
  gifts: T[],
  filter: GiftCategoryFilterValue,
) {
  if (filter === "all") return gifts;
  return gifts.filter((gift) => normalizeGiftCategory(gift.category) === filter);
}
