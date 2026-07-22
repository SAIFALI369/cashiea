// ════════════════════════════════════════════════════════════════
// Stripe Webhook Edge Function
// Listens for Stripe events and updates the user's subscription in DB.
//
// Setup:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// Deploy:  supabase functions deploy stripe-webhook
//
// Then in Stripe Dashboard → Developers → Webhooks → add endpoint:
//   https://<project>.functions.supabase.co/stripe-webhook
// and subscribe to: checkout.session.completed, customer.subscription.*
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from "../_shared/env.ts";
import Stripe from "https://esm.sh/stripe@16?target=deno";

// Service-role client so the webhook can write to the DB
const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Map a Stripe Price ID back to a plan name
function planFromPriceId(priceId: string): string {
  const map: Record<string, string> = {
    [Deno.env.get("STRIPE_PRICE_STARTER") || "starter_price"]: "starter",
    [Deno.env.get("STRIPE_PRICE_PRO") || "pro_price"]: "pro",
    [Deno.env.get("STRIPE_PRICE_ENTERPRISE") || "enterprise_price"]: "enterprise",
  };
  return map[priceId] || "free";
}

// Mirror of PLANS usage limits in supabase/schema.sql
const USAGE_LIMITS: Record<string, number> = {
  free: 50,
  starter: 500,
  pro: 2000,
  enterprise: 10000,
};

Deno.serve(async (req) => {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY")!;
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig!, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature failed: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.supabase_uid;
        const plan = session.metadata?.plan || "free";
        const customerId = session.customer as string;

        if (userId) {
          // Update profile plan + usage limit
          await supabase.from("profiles").update({
            plan,
            api_usage_limit: USAGE_LIMITS[plan] || 50,
          }).eq("id", userId);

          // Upsert subscription record
          await supabase.from("subscriptions").upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: session.subscription as string,
            plan,
            status: "active",
            current_period_end: null,
          }, { onConflict: "user_id" });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const priceId = sub.items.data[0]?.price?.id || "";
        const plan = planFromPriceId(priceId);
        const status = sub.status === "active" || sub.status === "trialing" ? "active" : "canceled";

        // Find user by customer id
        const { data: record } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (record?.user_id) {
          await supabase.from("profiles").update({
            plan,
            api_usage_limit: USAGE_LIMITS[plan] || 50,
          }).eq("id", record.user_id);

          await supabase.from("subscriptions").update({
            plan, status,
            stripe_subscription_id: sub.id,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          }).eq("user_id", record.user_id);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: record } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();

        if (record?.user_id) {
          // Downgrade back to free
          await supabase.from("profiles").update({
            plan: "free",
            api_usage_limit: 50,
          }).eq("id", record.user_id);

          await supabase.from("subscriptions").update({
            plan: "free", status: "canceled",
          }).eq("user_id", record.user_id);
        }
        break;
      }

      default:
        // Unhandled event type — no action needed
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
