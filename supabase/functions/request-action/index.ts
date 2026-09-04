// ════════════════════════════════════════════════════════════════
// REQUEST-ACTION — the server-side gate for team actions.
//
// The client supplies intent only. This function resolves the authenticated
// actor, the single active business membership, the owner's permission config,
// and a strict action/payload allowlist before it either applies the change or
// creates an auditable approval request.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import { resolveBusiness } from "../_shared/business.ts";

const PRODUCT_ACTIONS = new Set(["product.add", "product.delete", "product.restock"]);
const UUID_RE = /^[0-9a-f-]{36}$/i;

function cleanText(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max)
    : "";
}

function numberOrNull(value: unknown, min = 0, max = 1_000_000_000): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null;
}

function sanitizeProductPayload(actionType: string, payload: unknown): { value?: Record<string, unknown>; error?: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { error: "payload must be an object" };
  const source = payload as Record<string, unknown>;

  if (actionType === "product.add") {
    const name = cleanText(source.name, 200);
    if (!name) return { error: "Product name is required" };
    const price = numberOrNull(source.price);
    const cost = numberOrNull(source.cost);
    const stock = numberOrNull(source.stock_quantity);
    const threshold = numberOrNull(source.low_stock_threshold);
    if (price === null || cost === null || stock === null || threshold === null) return { error: "Product price, cost, stock, and alert level must be valid non-negative numbers" };
    const value: Record<string, unknown> = {
      name,
      description: cleanText(source.description, 2_000) || null,
      sku: cleanText(source.sku, 48) || null,
      category: cleanText(source.category, 100) || "general",
      price,
      cost,
      stock_quantity: stock,
      low_stock_threshold: threshold,
      hsn_code: cleanText(source.hsn_code, 20) || null,
      gst_rate: numberOrNull(source.gst_rate, 0, 100) ?? 0,
      units: Array.isArray(source.units) ? source.units.slice(0, 20) : null,
    };
    return { value };
  }

  const id = cleanText(source.id, 60);
  if (!UUID_RE.test(id)) return { error: "A valid product id is required" };
  if (actionType === "product.delete") return { value: { id } };

  // Restocking is an additive intent, not a client-computed target. The
  // product may be sold or restocked again before the owner approves this
  // request, so an absolute stock value would overwrite newer work.
  const addQuantity = numberOrNull(source.add_quantity, 0, 1_000_000_000);
  if (addQuantity === null || addQuantity <= 0) return { error: "A positive restock quantity is required" };
  const value: Record<string, unknown> = { id, add_quantity: addQuantity };
  if (source.price !== undefined) {
    const price = numberOrNull(source.price);
    if (price === null) return { error: "Price must be a valid non-negative number" };
    value.price = price;
  }
  if (source.cost !== undefined) {
    const cost = numberOrNull(source.cost);
    if (cost === null) return { error: "Cost must be a valid non-negative number" };
    value.cost = cost;
  }
  return { value };
}

async function applyAction(svc: any, ownerId: string, actionType: string, payload: Record<string, unknown>): Promise<string | null> {
  try {
    if (actionType === "product.add") {
      const { error } = await svc.from("products").insert({ ...payload, user_id: ownerId });
      return error?.message || null;
    }
    if (actionType === "product.delete") {
      const { data, error } = await svc.from("products").delete().eq("id", payload.id).eq("user_id", ownerId).select("id");
      if (error) return error.message;
      return data?.length === 1 ? null : "Product not found in this business";
    }
    if (actionType === "product.restock") {
      const { error } = await svc.rpc("restock_product", {
        p_product_id: payload.id,
        p_owner_id: ownerId,
        p_add_quantity: payload.add_quantity,
        p_price: payload.price ?? null,
        p_cost: payload.cost ?? null,
      });
      return error?.message || null;
    }
    return `Unsupported action: ${actionType}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization?.startsWith("Bearer ") || !url || !anonKey || !serviceKey) return json({ error: "Unauthorized" }, 401);

    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const capability = body.capability;
    const actionType = cleanText(body.action_type, 80);
    const summary = cleanText(body.summary, 500);
    const target = cleanText(body.target, 100) || null;
    if (capability !== "products:manage" || !PRODUCT_ACTIONS.has(actionType) || !summary) {
      return json({ error: "Only validated product actions are supported" }, 400);
    }

    const payloadResult = sanitizeProductPayload(actionType, body.payload);
    if (payloadResult.error || !payloadResult.value) return json({ error: payloadResult.error || "Invalid payload" }, 400);
    const payload = payloadResult.value;

    const svc = createClient(url, serviceKey, { auth: { persistSession: false } });
    const business = await resolveBusiness(svc, user.id);
    if (!business) return json({ error: "Your account is not linked to exactly one active business" }, 403);
    const { ownerId, role, isOwner } = business;
    if (!["owner", "manager", "accountant", "staff"].includes(role)) {
      return json({ error: "Your team role is not valid" }, 403);
    }

    const { data: me, error: meError } = await svc.from("profiles")
      .select("full_name")
      .eq("id", user.id).maybeSingle();
    if (meError || !me) return json({ error: "Could not verify account" }, 503);
    const requesterName = cleanText(me.full_name, 120) || user.email || "Team member";

    const { data: owner, error: ownerError } = await svc.from("profiles")
      .select("permission_config, role, business_owner_id")
      .eq("id", ownerId).maybeSingle();
    if (ownerError || !owner || owner.role !== "owner" || owner.business_owner_id !== null) {
      return json({ error: "Business owner could not be verified" }, 503);
    }
    const configured = (owner.permission_config as Record<string, any> | null) || {};
    const configuredMode = configured?.[role]?.[capability];
    const mode = role === "owner" ? "direct" : role !== "manager" && role !== "accountant"
      ? "denied" : ["direct", "approved", "denied"].includes(configuredMode) ? configuredMode : "approved";
    if (mode === "denied") return json({ denied: true, message: "This action is turned off for your role. Ask the owner to enable it." }, 403);

    // For changes against an existing product, prove that the target belongs to
    // this business before applying or queueing an approval request.
    if (actionType !== "product.add") {
      const { data: product, error: productError } = await svc.from("products")
        .select("id, user_id").eq("id", payload.id).eq("user_id", ownerId).maybeSingle();
      if (productError) return json({ error: "Could not verify product" }, 503);
      if (!product) return json({ error: "Product not found in this business" }, 404);
    }

    if (role === "owner" || mode === "direct") {
      const error = await applyAction(svc, ownerId, actionType, payload);
      if (error) return json({ error }, 500);
      return json({ applied: true });
    }

    const { error: insertError } = await svc.from("change_requests").insert({
      owner_user_id: ownerId,
      requester_id: user.id,
      requester_name: requesterName,
      requester_role: role,
      capability,
      action_type: actionType,
      target: target || "products",
      payload,
      summary,
      // Inventory changes are financially material even when no sale has been
      // made yet; the owner should see a clear warning before approving.
      money_related: true,
      status: "pending",
    });
    if (insertError) return json({ error: "Could not create approval request" }, 503);
    return json({ queued: true, message: "Sent to the owner for approval." });
  } catch (e) {
    console.error("[request-action] failed", e);
    return json({ error: "Action request failed" }, 500);
  }
});
