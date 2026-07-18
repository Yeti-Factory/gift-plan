import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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