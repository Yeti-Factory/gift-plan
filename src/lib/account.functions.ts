import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";

const REAUTH_MAX_AGE_SECONDS = 300;

function makeScratchClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

async function assertRecentReauth(
  password: string | undefined,
  email: string | null | undefined,
  iat: number | undefined,
) {
  const now = Math.floor(Date.now() / 1000);
  const sessionAge = iat ? now - iat : Number.POSITIVE_INFINITY;

  if (password && email) {
    const scratch = makeScratchClient();
    const { error } = await scratch.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Mot de passe incorrect.");
    return;
  }

  if (sessionAge <= REAUTH_MAX_AGE_SECONDS) return;

  throw new Error(
    "Réauthentification requise : reconnectez-vous puis relancez la suppression dans les 5 minutes.",
  );
}

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
  .inputValidator((input: { password?: string } | undefined) => input ?? {})
  .handler(async ({ context, data }) => {
    const { supabase, userId, claims } = context;

    await assertRecentReauth(
      data.password?.trim() || undefined,
      (claims.email as string | undefined) ?? null,
      typeof claims.iat === "number" ? claims.iat : undefined,
    );

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
      ? await supabase
          .from("circles")
          .select("id, name, created_by, created_at")
          .in("id", circleIds)
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
