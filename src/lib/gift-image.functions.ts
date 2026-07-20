import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isProfilePageData } from "@/lib/profile-page";

const SIGNED_URL_TTL_SECONDS = 5 * 60;

function validateGiftIds(input: { giftIds: unknown }): { giftIds: string[] } {
  if (!input || !Array.isArray(input.giftIds)) throw new Error("giftIds must be an array");
  const ids: string[] = [];
  for (const g of input.giftIds) {
    if (typeof g !== "string") continue;
    if (!/^[0-9a-f-]{36}$/i.test(g)) continue;
    ids.push(g);
    if (ids.length >= 200) break;
  }
  return { giftIds: ids };
}

/**
 * Return short-lived signed URLs (5 min) for the image_path of every gift
 * the caller can SELECT via RLS. Gifts without image_path or not visible are
 * silently omitted from the result map.
 */
export const getGiftImageSignedUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateGiftIds)
  .handler(async ({ data, context }) => {
    if (data.giftIds.length === 0) return { urls: {} as Record<string, string> };

    // 1. RLS-scoped read: only visible gifts come back.
    const { data: rows, error } = await context.supabase
      .from("gifts")
      .select("id, image_path")
      .in("id", data.giftIds);
    if (error) throw new Error(error.message);

    const visible = (rows ?? []).filter(
      (r): r is { id: string; image_path: string } =>
        typeof r.image_path === "string" && r.image_path.length > 0,
    );
    if (visible.length === 0) return { urls: {} };

    // 2. Admin client to mint signed URLs (SELECT on storage.objects is owner-only).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const paths = visible.map((v) => v.image_path);
    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("gift-images")
      .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
    if (signErr) throw new Error(signErr.message);

    const byPath = new Map<string, string>();
    for (const s of signed ?? []) {
      if (s?.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
    }

    const urls: Record<string, string> = {};
    for (const v of visible) {
      const u = byPath.get(v.image_path);
      if (u) urls[v.id] = u;
    }
    return { urls };
  });

function validatePublicGiftIds(input: {
  username: unknown;
  shareToken?: unknown;
  giftIds: unknown;
}): { username: string; shareToken: string | undefined; giftIds: string[] } {
  if (typeof input?.username !== "string" || !/^[a-z0-9][a-z0-9-]{2,39}$/i.test(input.username)) {
    throw new Error("Invalid username");
  }
  const shareToken =
    typeof input.shareToken === "string" && /^[0-9a-f-]{36}$/i.test(input.shareToken)
      ? input.shareToken
      : undefined;
  return { username: input.username, shareToken, ...validateGiftIds({ giftIds: input.giftIds }) };
}

/** Mint image URLs only for gifts returned by the public, database-gated profile RPC. */
export const getPublicGiftImageSignedUrls = createServerFn({ method: "POST" })
  .inputValidator(validatePublicGiftIds)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: page, error } = await supabaseAdmin.rpc("get_profile_page", {
      _username: data.username,
      _share_token: data.shareToken,
    });
    if (error || !isProfilePageData(page)) return { urls: {} as Record<string, string> };

    const requested = new Set(data.giftIds);
    const visible = page.lists
      .flatMap((list) => list.gifts)
      .filter(
        (gift): gift is typeof gift & { image_path: string } =>
          requested.has(gift.id) &&
          typeof gift.image_path === "string" &&
          gift.image_path.length > 0,
      );
    if (visible.length === 0) return { urls: {} as Record<string, string> };

    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("gift-images")
      .createSignedUrls(
        visible.map((gift) => gift.image_path),
        SIGNED_URL_TTL_SECONDS,
      );
    if (signError) return { urls: {} as Record<string, string> };
    const byPath = new Map((signed ?? []).filter(Boolean).map((row) => [row.path, row.signedUrl]));
    return {
      urls: Object.fromEntries(
        visible
          .map((gift) => [gift.id, byPath.get(gift.image_path)] as const)
          .filter((entry): entry is readonly [string, string] => typeof entry[1] === "string"),
      ),
    };
  });
