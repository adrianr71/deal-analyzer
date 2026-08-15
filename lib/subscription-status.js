export async function checkSubscriptionStatus({ customerId, subscriptionId }) {
  if (!customerId && !subscriptionId) {
    return {
      subscribed: false,
      reason: "missing_subscription_identity",
    };
  }

  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "")
    .trim()
    .replace(/\/$/, "");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase subscription environment variables");
    return {
      subscribed: false,
      reason: "missing_supabase_config",
    };
  }

  try {
    const lookupField = customerId
      ? "stripe_customer_id"
      : "stripe_subscription_id";
    const lookupValue = customerId || subscriptionId;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/subscriptions?select=status,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id,plan,max_users,max_devices_per_user&${lookupField}=eq.${encodeURIComponent(lookupValue)}&limit=1`,
      {
        method: "GET",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
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
      return {
        subscribed: false,
        reason: "subscription_not_found",
      };
    }

    const activeStatus =
      subscription.status === "active" || subscription.status === "trialing";

    const notExpired =
      !subscription.current_period_end ||
      new Date(subscription.current_period_end).getTime() > Date.now();

return {
  subscribed: activeStatus && notExpired,

  status: subscription.status,

  plan: subscription.plan || "individual",

  maxUsers: Number(subscription.max_users) || 1,

  maxDevicesPerUser:
    Number(subscription.max_devices_per_user) || 2,

  currentPeriodEnd: subscription.current_period_end,

  cancelAtPeriodEnd: subscription.cancel_at_period_end,

  reason:
    activeStatus && notExpired
      ? "active"
      : "inactive_or_expired",
};
  } catch (error) {
    console.error("Subscription status lookup failed:", error);

    return {
      subscribed: false,
      reason: "subscription_lookup_failed",
    };
  }
}