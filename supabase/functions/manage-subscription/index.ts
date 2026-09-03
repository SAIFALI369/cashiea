// Owner-only subscription management. The browser never writes plan or usage
// entitlement columns directly; Stripe and the server-side SQL transaction do.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Billing service is not configured" }, 503);

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, role, business_owner_id, plan")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) return json({ error: "Could not verify account" }, 503);

    // A linked manager/accountant/staff member must not cancel or alter the
    // business owner's subscription by changing a request body user id.
    if (!profile || profile.role !== "owner" || profile.business_owner_id !== null) {
      return json({ error: "Only the business owner can manage the subscription" }, 403);
    }

    let body: { action?: string };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    if (body.action !== "downgrade_free") return json({ error: "Unsupported subscription action" }, 400);

    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id, status, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscriptionError) return json({ error: "Could not read subscription" }, 503);

    if (subscription?.stripe_subscription_id && subscription.status !== "canceled") {
      const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeSecret) return json({ error: "Payments are not configured; no change was made" }, 503);
      const stripe = new Stripe(stripeSecret, {
        apiVersion: "2024-06-20",
        httpClient: Stripe.createFetchHttpClient(),
      });
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
      } catch (error) {
        console.error("[manage-subscription] Stripe cancellation failed", error);
        return json({ error: "Stripe could not cancel the subscription; no local change was made" }, 502);
      }
    }

    const { error: entitlementError } = await admin.rpc("apply_subscription_entitlement", {
      p_user_id: user.id,
      p_plan: "free",
      p_status: "canceled",
      p_stripe_customer_id: subscription?.stripe_customer_id || null,
      p_stripe_subscription_id: subscription?.stripe_subscription_id || null,
      p_current_period_end: null,
    });
    if (entitlementError) {
      console.error("[manage-subscription] entitlement transaction failed", entitlementError);
      return json({ error: "Subscription was canceled, but local entitlement sync failed. Contact support." }, 503);
    }

    return json({ ok: true, plan: "free" });
  } catch (error) {
    console.error("[manage-subscription] unexpected error", error);
    return json({ error: "Subscription request failed" }, 500);
  }
});
