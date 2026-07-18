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