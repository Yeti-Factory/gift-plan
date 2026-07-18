import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Deletes the caller's account.
 *
 * Steps:
 * 1. As the user (RLS), call leave_circle for every circle membership.
 *    - Transfers ownership when the caller is the creator (existing RPC logic).
 *    - Cascades gifts/reservations/lists when the caller was the last member.
 * 2. As service role, delete the auth user (cascades profiles + any remnants).
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: memberships, error: mErr } = await supabase
      .from("circle_members")
      .select("circle_id")
      .eq("user_id", userId);
    if (mErr) throw new Error(mErr.message);

    for (const m of memberships ?? []) {
      const { error } = await supabase.rpc("leave_circle", { _circle_id: m.circle_id });
      if (error) throw new Error(`leave_circle a échoué: ${error.message}`);
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(delErr.message);

    return { ok: true as const };
  });

/**
 * Exports all personal data of the caller (RGPD art. 15 & 20).
 *
 * Everything is read as the user via RLS, so we only ever return data the caller
 * is entitled to see. Reservations placed by others on the caller's gifts are
 * intentionally excluded to preserve the surprise (matches app behavior).
 */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const [profile, memberships, lists, gifts, reservations] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("circle_members").select("circle_id, role, joined_at").eq("user_id", userId),
      supabase.from("lists").select("*").eq("owner_id", userId),
      supabase.from("gifts").select("*").eq("owner_id", userId),
      supabase.from("reservations").select("*").eq("buyer_id", userId),
    ]);

    for (const r of [profile, memberships, lists, gifts, reservations]) {
      if (r.error) throw new Error(r.error.message);
    }

    const circleIds = (memberships.data ?? []).map((m) => m.circle_id);
    const { data: circles, error: cErr } = circleIds.length
      ? await supabase.from("circles").select("id, name, created_by, created_at").in("id", circleIds)
      : { data: [], error: null };
    if (cErr) throw new Error(cErr.message);

    return {
      exported_at: new Date().toISOString(),
      notice:
        "Export RGPD (art. 15 & 20). Les réservations posées par d'autres personnes sur vos propres cadeaux sont exclues pour préserver la surprise.",
      account: {
        id: userId,
        email: claims.email ?? null,
      },
      profile: profile.data,
      circles: circles ?? [],
      circle_memberships: memberships.data ?? [],
      lists: lists.data ?? [],
      gifts: gifts.data ?? [],
      reservations_i_placed: reservations.data ?? [],
    };
  });