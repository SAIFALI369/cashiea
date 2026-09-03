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
import Stripe from "https://esm.sh/stripe@16?target=deno";

// Service-role client so the webhook can write to the DB
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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

async function applyEntitlement(
  userId: string,
  plan: string,
  status: string,
  customerId: string | null,
  subscriptionId: string | null,
  periodEnd: string | null,
) {
  const { error } = await supabase.rpc("apply_subscription_entitlement", {
    p_user_id: userId,
    p_plan: plan,
    p_status: status,
    p_stripe_customer_id: customerId,
    p_stripe_subscription_id: subscriptionId,
    p_current_period_end: periodEnd,
  });
  if (error) throw new Error(`Entitlement transaction failed: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeSecret || !webhookSecret || !sig) {
    return new Response("Webhook is not configured", { status: 503 });
  }
  const stripe = new Stripe(stripeSecret, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature failed: ${err instanceof Error ? err.message : "invalid signature"}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.supabase_uid;
        const plan = session.metadata?.plan || "free";
        const customerId = typeof session.customer === "string" ? session.customer : null;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

        if (userId) {
          // One SQL transaction updates both the subscription row and the
          // effective profile entitlement. A malformed metadata user/plan is
          // rejected by the function instead of becoming a silent partial write.
          await applyEntitlement(userId, plan, "active", customerId, subscriptionId, null);
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

        // Find user by customer id. Unknown customers are ignored; they may
        // belong to another Stripe product and must not mutate Cashiea users.
        const { data: record, error: lookupError } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (lookupError) throw lookupError;

        if (record?.user_id) {
          const periodEnd = Number.isFinite(sub.current_period_end)
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null;
          await applyEntitlement(record.user_id, plan, status, customerId, sub.id, periodEnd);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        const { data: record, error: lookupError } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_customer_id", customerId)
          .maybeSingle();
        if (lookupError) throw lookupError;

        if (record?.user_id) {
          await applyEntitlement(record.user_id, "free", "canceled", customerId, sub.id, null);
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
    console.error("[stripe-webhook] event processing failed", error);
    return new Response(JSON.stringify({ error: "Event processing failed" }), { status: 500 });
  }
});
