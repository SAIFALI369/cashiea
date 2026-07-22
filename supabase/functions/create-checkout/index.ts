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
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
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

    const supabase = createClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // Verify the user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan } = await req.json();

    if (!plan || plan === "free") {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const priceId = PRICE_MAP[plan];
    if (!priceId) throw new Error(`No Stripe price configured for plan: ${plan}`);

    // Look up or create the Stripe customer
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = existingSub?.stripe_customer_id;

    if (!customerId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, company_name")
        .eq("id", user.id)
        .single();

      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name || undefined,
        metadata: { supabase_uid: user.id, company: profile?.company_name || "" },
      });
      customerId = customer.id;
    }

    const appUrl = Deno.env.get("APP_URL") || "http://localhost:5173";

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
