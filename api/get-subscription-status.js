export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const customerId = req.query.customer_id;
    const subscriptionId = req.query.subscription_id;

    if (!customerId && !subscriptionId) {
      return res.status(200).json({ subscribed: false });
    }

    const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");

    const lookupField = customerId ? "stripe_customer_id" : "stripe_subscription_id";
    const lookupValue = customerId || subscriptionId;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?select=status,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id&${lookupField}=eq.${encodeURIComponent(lookupValue)}&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Supabase subscription lookup failed: ${text}`);
    }

    const rows = await response.json();
    const subscription = rows?.[0];

    if (!subscription) {
      return res.status(200).json({ subscribed: false });
    }

    const activeStatus =
      subscription.status === "active" || subscription.status === "trialing";

    const notExpired =
      !subscription.current_period_end ||
      new Date(subscription.current_period_end).getTime() > Date.now();

    return res.status(200).json({
      subscribed: activeStatus && notExpired,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
  } catch (error) {
    console.error("Subscription status error:", error);
    return res.status(500).json({
      error: "Unable to check subscription status",
      message: error.message,
    });
  }
}