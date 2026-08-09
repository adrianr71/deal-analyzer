import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PLAN_CONFIG = {
  individual: {
    priceId:
      process.env.STRIPE_PRICE_INDIVIDUAL ||
      process.env.STRIPE_PRICE_ID,
    maxUsers: 1,
    maxDevicesPerUser: 2,
  },

  team_5: {
    priceId: process.env.STRIPE_PRICE_TEAM_5,
    maxUsers: 5,
    maxDevicesPerUser: 2,
  },

  team_10: {
    priceId: process.env.STRIPE_PRICE_TEAM_10,
    maxUsers: 10,
    maxDevicesPerUser: 2,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const requestedPlan = String(
      req.body?.plan || "individual"
    ).trim();

    const selectedPlan = PLAN_CONFIG[requestedPlan];

    if (!selectedPlan) {
      return res.status(400).json({
        error: "Invalid subscription plan",
      });
    }

    if (!selectedPlan.priceId) {
      console.error(
        `Missing Stripe Price ID for plan: ${requestedPlan}`
      );

      return res.status(500).json({
        error: "This subscription plan is not configured yet",
      });
    }

    const origin =
      req.headers.origin ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://www.rentaldealscreener.pro");

    const session =
      await stripe.checkout.sessions.create({
        mode: "subscription",

        payment_method_types: ["card"],

        automatic_tax: {
          enabled: true,
        },

        line_items: [
          {
            price: selectedPlan.priceId,
            quantity: 1,
          },
        ],

        billing_address_collection: "auto",

        allow_promotion_codes: true,

        metadata: {
          plan: requestedPlan,
          max_users: String(selectedPlan.maxUsers),
          max_devices_per_user: String(
            selectedPlan.maxDevicesPerUser
          ),
        },

        subscription_data: {
          metadata: {
            plan: requestedPlan,
            max_users: String(selectedPlan.maxUsers),
            max_devices_per_user: String(
              selectedPlan.maxDevicesPerUser
            ),
          },
        },

        success_url:
          `${origin}/agents` +
          "?checkout=success" +
          "&session_id={CHECKOUT_SESSION_ID}",

        cancel_url:
          `${origin}/agents?checkout=cancel`,
      });

    return res.status(200).json({
      url: session.url,
    });
  } catch (error) {
    console.error(
      "Stripe checkout session error:",
      error
    );

    return res.status(500).json({
      error: "Unable to create checkout session",
    });
  }
}