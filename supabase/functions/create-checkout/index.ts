// ════════════════════════════════════════════════════════════════
// Stripe Checkout Edge Function
// Creates a Stripe Checkout Session for upgrading a subscription plan.
//
// Setup:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_...
//   supabase secrets set STRIPE_PRICE_STARTER=price_xxx
//   supabase secrets set STRIPE_PRICE_PRO=price_xxx
//   supabase secrets set STRIPE_PRICE_ENTERPRISE=price_xxx
//   supabase secrets set APP_URL=https://yourdomain.com
//
// Deploy:  supabase functions deploy create-checkout
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@16?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map plan names to their Stripe Price IDs (env vars)
const PRICE_MAP: Record<string, string> = {
  starter: Deno.env.get("STRIPE_PRICE_STARTER") || "",
  pro: Deno.env.get("STRIPE_PRICE_PRO") || "",
  enterprise: Deno.env.get("STRIPE_PRICE_ENTERPRISE") || "",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeSecret, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Billing service is not configured");

    const supabase = createClient(
      supabaseUrl,
      anonKey,
      { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }
    );
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // Verify the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { plan?: unknown };
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const plan = typeof body.plan === "string" ? body.plan : "";

    if (!plan || !Object.prototype.hasOwnProperty.call(PRICE_MAP, plan)) {
      return new Response(JSON.stringify({ error: "Invalid or unavailable plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return new Response(JSON.stringify({ error: "This plan is not configured for checkout" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, company_name, role, business_owner_id, plan")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) throw new Error("Could not verify billing owner");
    if (profile.role !== "owner" || profile.business_owner_id !== null) {
      return new Response(JSON.stringify({ error: "Only the business owner can start checkout" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // A second checkout for an already active subscription can create two
    // Stripe subscriptions. Require the existing subscription to be managed
    // first instead of silently double-billing the shop.
    const { data: existingSub, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status, plan")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subscriptionError) throw new Error("Could not read billing record");
    if (existingSub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(existingSub.status)) {
      return new Response(JSON.stringify({ error: "An active subscription already exists. Manage it in Stripe before changing plans." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up or create the Stripe customer. Persisting the customer ID before
    // returning the checkout URL makes retries reuse the same customer.
    let customerId = existingSub?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: profile.full_name || undefined,
        metadata: { supabase_uid: user.id, company: profile.company_name || "" },
      });
      customerId = customer.id;
    }

    const { error: customerSaveError } = await admin.from("subscriptions").upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      plan: profile.plan || "free",
      status: existingSub?.status || "active",
    }, { onConflict: "user_id" });
    if (customerSaveError) throw new Error("Could not save billing record");

    const appUrlValue = Deno.env.get("APP_URL");
    if (!appUrlValue) throw new Error("APP_URL is not configured");
    let appUrl: string;
    try {
      const parsed = new URL(appUrlValue);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
      appUrl = parsed.toString().replace(/\/+$/, "");
    } catch {
      throw new Error("APP_URL is invalid");
    }

    // Create the Checkout Session (subscription mode)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/app/subscription?status=success`,
      cancel_url: `${appUrl}/app/subscription?status=canceled`,
      client_reference_id: user.id,
      metadata: { plan, supabase_uid: user.id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
