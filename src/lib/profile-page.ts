import type { Priority } from "@/lib/gift-box";
import type { GiftCategory } from "@/lib/gift-category";

export type ProfileVisibility = "public" | "private";
export type ListVisibility = "public" | "circles";

export type ProfilePageGift = {
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
  reservation: null | {
    status: "reserved" | "purchased";
    reserved_by_me: boolean;
  };
};

export type ProfilePageList = {
  id: string;
  title: string;
  occasion: string | null;
  event_date: string | null;
  visibility: ListVisibility;
  gifts: ProfilePageGift[];
};

export type ProfilePageData = {
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    visibility: ProfileVisibility;
    is_owner: boolean;
  };
  lists: ProfilePageList[];
};

export type ProfilePageResult =
  | ProfilePageData
  | { error: "PROFILE_NOT_FOUND" | "PROFILE_PRIVATE" };

export function isProfilePageData(value: unknown): value is ProfilePageData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { profile?: unknown; lists?: unknown };
  return !!candidate.profile && Array.isArray(candidate.lists);
}
