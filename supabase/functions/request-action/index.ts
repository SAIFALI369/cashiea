// ════════════════════════════════════════════════════════════════
// REQUEST-ACTION — the secure gate for manager/accountant actions.
//
// A manager/accountant calls this instead of mutating directly. It:
//   1. Resolves their owner (via team_members) + their role.
//   2. Reads the OWNER's permission_config.
//   3. Resolves the mode: 'direct' (apply now) | 'approved' (queue) | 'denied'.
// Owner callers bypass and apply directly. JWT-auth.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";

function resolveMode(role: string, cap: string, cfg: any): "direct" | "approved" | "denied" {
  if (role === "owner") return "direct";
  if (role !== "manager" && role !== "accountant") return "denied";
  return (cfg?.[role]?.[cap] as "direct" | "approved" | "denied" | undefined) || "approved";
}

// Apply a trusted ('direct') action as the owner (service role).
async function applyAction(svc: any, ownerId: string, actionType: string, payload: any): Promise<string | null> {
  try {
    if (actionType === "product.add") {
      const { error } = await svc.from("products").insert({ ...(payload || {}), user_id: ownerId });
      return error?.message || null;
    }
    if (actionType === "product.delete") {
      const { error } = await svc.from("products").delete().eq("id", String(payload?.id));
      return error?.message || null;
    }
    if (actionType === "product.restock") {
      const { error } = await svc.from("products").update({ stock_quantity: Number(payload?.stock_quantity) }).eq("id", String(payload?.id));
      return error?.message || null;
    }
    return `Unsupported action: ${actionType}`;
  } catch (e) {
    return (e as Error)?.message || String(e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const { capability, action_type, target, payload, summary, money_related } = await req.json();
    if (!capability || !action_type || !summary) return json({ error: "capability, action_type, and summary are required" }, 400);

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Resolve caller profile
    const { data: me } = await svc.from("profiles").select("id, role, full_name").eq("id", user.id).maybeSingle();
    let ownerId = user.id;
    let role = (me?.role as string) || "staff";
    let requesterName = me?.full_name || user.email || "Team member";

    // Non-owners act on behalf of their owner (via team_members)
    if (role !== "owner") {
      const { data: tm } = await svc.from("team_members")
        .select("user_id, role, name").eq("member_user_id", user.id).eq("status", "active").limit(1).maybeSingle();
      if (!tm) return json({ error: "You are not an active member of any business." }, 403);
      ownerId = tm.user_id;
      role = tm.role || role;
      requesterName = tm.name || requesterName;
    }

    // Owner's permission config
    const { data: owner } = await svc.from("profiles").select("permission_config").eq("id", ownerId).maybeSingle();
    const cfg = (owner?.permission_config as any) || {};
    const mode = resolveMode(role, capability, cfg);

    if (mode === "denied") return json({ denied: true, message: "This action is turned off for your role. Ask the owner to enable it." }, 403);

    if (role === "owner" || mode === "direct") {
      const e = await applyAction(svc, ownerId, action_type, payload);
      if (e) return json({ error: e }, 500);
      return json({ applied: true });
    }

    // mode === "approved" → queue for the owner
    const { error: ie } = await svc.from("change_requests").insert({
      owner_user_id: ownerId, requester_id: user.id, requester_name: requesterName, requester_role: role,
      capability, action_type, target: target || null, payload: payload || {}, summary, money_related: !!money_related,
      status: "pending",
    });
    if (ie) return json({ error: ie.message }, 500);
    return json({ queued: true, message: "Sent to the owner for approval." });
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
