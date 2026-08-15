import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function getCustomerEmail(customer) {
  const customerId =
    typeof customer === "string"
      ? customer
      : customer?.id;

  if (!customerId) return null;

  if (typeof customer === "object" && customer?.email) {
    return customer.email;
  }

  try {
    const retrievedCustomer = await stripe.customers.retrieve(customerId);

    if (!retrievedCustomer || retrievedCustomer.deleted) {
      return null;
    }

    return retrievedCustomer.email || null;
  } catch (error) {
    console.error("Stripe customer email lookup failed:", error);
    return null;
  }
}

async function saveSubscription(subscription, eventId) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;

const priceId = subscription.items?.data?.[0]?.price?.id || null;
const email = await getCustomerEmail(subscription.customer);

const plan = subscription.metadata?.plan || "individual";

const maxUsers =
  Number(subscription.metadata?.max_users) || 1;

const maxDevicesPerUser =
  Number(subscription.metadata?.max_devices_per_user) || 2;

  const periodEnd =
   subscription.current_period_end ||
   subscription.items?.data?.[0]?.current_period_end ||
   subscription.cancel_at ||
   null;

  const isCancelingAtPeriodEnd =
   subscription.cancel_at_period_end === true ||
   Boolean(subscription.cancel_at);

const body = {
  email,
  stripe_customer_id: customerId,
  stripe_subscription_id: subscription.id,
  stripe_price_id: priceId,

  plan,
  max_users: maxUsers,
  max_devices_per_user: maxDevicesPerUser,

  status: subscription.status,

  current_period_end: periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : null,

  cancel_at_period_end: isCancelingAtPeriodEnd,
  last_event_id: eventId,
  updated_at: new Date().toISOString(),
};
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "").trim().replace(/\/$/, "");

  const response = await fetch(
   `${supabaseUrl}/rest/v1/subscriptions?on_conflict=stripe_subscription_id`,
    {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase subscription save failed: ${text}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const event = req.body;

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = await stripe.subscriptions.retrieve(event.data.object.id, {
        expand: ["customer", "items.data.price"],
      });

      await saveSubscription(subscription, event.id);
    }

    return res.status(200).json({ received: true });
} catch (error) {
  console.error("Stripe webhook error:", error);
  return res.status(500).json({
    error: "Webhook failed",
    message: error.message,
  });
}
}