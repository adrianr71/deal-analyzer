export async function checkSubscriptionStatus({ userId }) {
  if (!userId) {
    return {
      subscribed: false,
      reason: "missing_user_identity",
    };
  }

  const supabaseUrl = String(
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  )
    .trim()
    .replace(/\/$/, "");

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing Supabase subscription environment variables"
    );

    return {
      subscribed: false,
      reason: "missing_supabase_config",
    };
  }

  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  try {
    let subscription = null;
    let accessRole = "owner";

    const ownerResponse = await fetch(
`${supabaseUrl}/rest/v1/subscriptions?select=id,status,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id,plan,max_users,max_devices_per_user,user_id&user_id=eq.${encodeURIComponent(
  userId
)}&status=in.(active,trialing)&order=current_period_end.desc.nullslast&limit=1`
      {
        method: "GET",
        headers,
      }
    );

    if (!ownerResponse.ok) {
      const text = await ownerResponse.text();

      throw new Error(
        `Supabase owner subscription lookup failed: ${text}`
      );
    }

    const ownerRows = await ownerResponse.json();
    subscription = ownerRows?.[0] || null;

    if (!subscription) {
      const membershipResponse = await fetch(
        `${supabaseUrl}/rest/v1/team_members?select=subscription_id,role,status&user_id=eq.${encodeURIComponent(
          userId
        )}&status=eq.active&limit=1`,
        {
          method: "GET",
          headers,
        }
      );

      if (!membershipResponse.ok) {
        const text = await membershipResponse.text();

        throw new Error(
          `Supabase team membership lookup failed: ${text}`
        );
      }

      const membershipRows = await membershipResponse.json();
      const membership = membershipRows?.[0];

      if (!membership?.subscription_id) {
        return {
          subscribed: false,
          reason: "subscription_not_found",
        };
      }

      accessRole = membership.role || "member";

      const teamSubscriptionResponse = await fetch(
        `${supabaseUrl}/rest/v1/subscriptions?select=id,status,current_period_end,cancel_at_period_end,stripe_customer_id,stripe_subscription_id,plan,max_users,max_devices_per_user,user_id&id=eq.${encodeURIComponent(
          membership.subscription_id
        )}&limit=1`,
        {
          method: "GET",
          headers,
        }
      );

      if (!teamSubscriptionResponse.ok) {
        const text = await teamSubscriptionResponse.text();

        throw new Error(
          `Supabase team subscription lookup failed: ${text}`
        );
      }

      const teamSubscriptionRows =
        await teamSubscriptionResponse.json();

      subscription = teamSubscriptionRows?.[0] || null;
    }

    if (!subscription) {
      return {
        subscribed: false,
        reason: "subscription_not_found",
      };
    }

    const activeStatus =
      subscription.status === "active" ||
      subscription.status === "trialing";

    const notExpired =
      !subscription.current_period_end ||
      new Date(subscription.current_period_end).getTime() >
        Date.now();

    return {
      subscribed: activeStatus && notExpired,

      status: subscription.status,

      plan: subscription.plan || "individual",

      maxUsers: Number(subscription.max_users) || 1,

      maxDevicesPerUser:
        Number(subscription.max_devices_per_user) || 2,

      currentPeriodEnd: subscription.current_period_end,

      cancelAtPeriodEnd:
        subscription.cancel_at_period_end,

      accessRole,

      reason:
        activeStatus && notExpired
          ? "active"
          : "inactive_or_expired",
    };
  } catch (error) {
    console.error(
      "Subscription status lookup failed:",
      error
    );

    return {
      subscribed: false,
      reason: "subscription_lookup_failed",
    };
  }
}