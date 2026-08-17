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
    if (
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error("Missing server-side Supabase environment variables");

      return res.status(500).json({
        error: "Server authentication is not configured",
      });
    }

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const accessToken = authHeader.slice(7).trim();

    if (!accessToken) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      console.error(
        "Supabase user verification failed:",
        userError
      );

      return res.status(401).json({
        error: "Invalid or expired authentication",
      });
    }

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

    const userEmail = user.email || "";

    const session = await stripe.checkout.sessions.create({
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
        user_id: user.id,
        user_email: userEmail,
        plan: requestedPlan,
        max_users: String(selectedPlan.maxUsers),
        max_devices_per_user: String(
          selectedPlan.maxDevicesPerUser
        ),
      },

      subscription_data: {
        metadata: {
          user_id: user.id,
          user_email: userEmail,
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