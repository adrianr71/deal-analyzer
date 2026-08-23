import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const PLAN_CONFIG = {
  individual: {
    priceId:
      process.env.STRIPE_PRICE_INDIVIDUAL ||
      process.env.STRIPE_PRICE_ID,
    maxUsers: 1,
    maxDevicesPerUser: 2,
    rank: 1,
  },

  team_5: {
    priceId: process.env.STRIPE_PRICE_TEAM_5,
    maxUsers: 5,
    maxDevicesPerUser: 2,
    rank: 2,
  },

  team_10: {
    priceId: process.env.STRIPE_PRICE_TEAM_10,
    maxUsers: 10,
    maxDevicesPerUser: 2,
    rank: 3,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const authHeader =
      req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const accessToken =
      authHeader.slice(7).trim();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(
      accessToken
    );

    if (userError || !user) {
      return res.status(401).json({
        error: "Invalid or expired authentication",
      });
    }

    const requestedPlan = String(
      req.body?.plan || ""
    ).trim();

    const targetPlan =
      PLAN_CONFIG[requestedPlan];

    if (!targetPlan) {
      return res.status(400).json({
        error: "Invalid subscription plan",
      });
    }

    if (!targetPlan.priceId) {
      return res.status(500).json({
        error:
          "This subscription plan is not configured yet",
      });
    }

    const {
      data: savedSubscription,
      error: subscriptionError,
    } = await supabaseAdmin
      .from("subscriptions")
      .select(
  "id, stripe_subscription_id, plan, status"
)
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        "Subscription lookup failed:",
        subscriptionError
      );

      return res.status(500).json({
        error: "Unable to load subscription",
      });
    }

    if (!savedSubscription) {
      return res.status(403).json({
        error:
          "Only the subscription owner can change plans",
      });
    }

    const currentPlanName =
      savedSubscription.plan || "individual";

    const currentPlan =
      PLAN_CONFIG[currentPlanName];

    if (!currentPlan) {
      return res.status(400).json({
        error: "Current plan is not recognized",
      });
    }

    if (requestedPlan === currentPlanName) {
      return res.status(400).json({
        error: "You are already on this plan",
      });
    }

    const stripeSubscription =
  await stripe.subscriptions.retrieve(
    savedSubscription.stripe_subscription_id
  );

const subscriptionItem =
  stripeSubscription.items?.data?.[0];

if (!subscriptionItem?.id || !subscriptionItem?.price?.id) {
  return res.status(500).json({
    error:
      "Stripe subscription item could not be found",
  });
}

if (targetPlan.rank < currentPlan.rank) {
  const {
    count: usedSeats,
    error: seatCountError,
  } = await supabaseAdmin
    .from("team_members")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq(
      "subscription_id",
      savedSubscription.id
    )
    .in("status", ["active", "invited"]);

  if (seatCountError) {
    console.error(
      "Downgrade seat validation failed:",
      seatCountError
    );

    return res.status(500).json({
      error:
        "Unable to verify team seats before downgrade",
    });
  }

  if ((usedSeats || 0) > targetPlan.maxUsers) {
    return res.status(400).json({
      error:
        `This plan supports ${targetPlan.maxUsers} user${
          targetPlan.maxUsers === 1 ? "" : "s"
        }. Remove team members before scheduling this downgrade.`,
      downgrade: true,
      usedSeats: usedSeats || 0,
      maxUsers: targetPlan.maxUsers,
    });
  }

const periodEnd =
  stripeSubscription.current_period_end ||
  subscriptionItem.current_period_end;

if (!periodEnd) {
  return res.status(500).json({
    error:
      "Unable to determine the next billing date",
  });
}

let schedule;
let createdNewSchedule = false;

if (stripeSubscription.schedule) {
  const scheduleId =
    typeof stripeSubscription.schedule === "string"
      ? stripeSubscription.schedule
      : stripeSubscription.schedule.id;

  schedule =
    await stripe.subscriptionSchedules.retrieve(
      scheduleId
    );
} else {
  schedule =
    await stripe.subscriptionSchedules.create({
      from_subscription:
        savedSubscription.stripe_subscription_id,
    });

  createdNewSchedule = true;
}

  try {
    await stripe.subscriptionSchedules.update(
      schedule.id,
      {
        end_behavior: "release",

        phases: [
          {
            start_date:
              schedule.current_phase?.start_date ||
              stripeSubscription.start_date,

            end_date: periodEnd,

            items: [
              {
                price: subscriptionItem.price.id,
                quantity:
                  subscriptionItem.quantity || 1,
              },
            ],

            proration_behavior: "none",

            metadata: {
              ...stripeSubscription.metadata,
            },
          },

          {
            start_date: periodEnd,

            items: [
              {
                price: targetPlan.priceId,
                quantity: 1,
              },
            ],

            proration_behavior: "none",

            metadata: {
              ...stripeSubscription.metadata,
              user_id: user.id,
              user_email: user.email || "",
              plan: requestedPlan,
              max_users: String(
                targetPlan.maxUsers
              ),
              max_devices_per_user: String(
                targetPlan.maxDevicesPerUser
              ),
            },
          },
        ],
      }
    );

} catch (scheduleError) {
  if (createdNewSchedule) {
    try {
      await stripe.subscriptionSchedules.release(
        schedule.id
      );
    } catch (releaseError) {
      console.error(
        "Unable to release failed downgrade schedule:",
        releaseError
      );
    }
  }

  throw scheduleError;
}

  return res.status(200).json({
    changed: false,
    scheduled: true,
    plan: requestedPlan,
    effectiveAt:
      new Date(periodEnd * 1000).toISOString(),
  });
}

    const updatedSubscription =
      await stripe.subscriptions.update(
        savedSubscription.stripe_subscription_id,
        {
          items: [
            {
              id: subscriptionItem.id,
              price: targetPlan.priceId,
              quantity: 1,
            },
          ],

proration_behavior:
  "always_invoice",

payment_behavior:
  "pending_if_incomplete",

          metadata: {
            ...stripeSubscription.metadata,
            user_id: user.id,
            user_email: user.email || "",
            plan: requestedPlan,
            max_users: String(
              targetPlan.maxUsers
            ),
            max_devices_per_user: String(
              targetPlan.maxDevicesPerUser
            ),
          },
        }
      );

    return res.status(200).json({
      changed: true,
      plan: requestedPlan,
      status: updatedSubscription.status,
    });
  } catch (error) {
    console.error(
      "Change plan error:",
      error
    );

    return res.status(500).json({
      error: "Unable to change subscription plan",
    });
  }
}