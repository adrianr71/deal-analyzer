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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
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

    const {
      data: subscription,
      error: subscriptionError,
    } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "id, stripe_customer_id, plan, status, current_period_end"
      )
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .order("current_period_end", {
        ascending: false,
        nullsFirst: false,
      })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        "Portal subscription lookup failed:",
        subscriptionError
      );

      return res.status(500).json({
        error: "Unable to find subscription",
      });
    }

    if (!subscription) {
      return res.status(403).json({
        error:
          "Only the subscription owner can manage billing",
      });
    }

    if (!subscription.stripe_customer_id) {
      return res.status(404).json({
        error: "Stripe customer account not found",
      });
    }

    const origin =
      req.headers.origin ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "https://www.rentaldealscreener.pro");

    const session =
      await stripe.billingPortal.sessions.create({
        customer: subscription.stripe_customer_id,
        return_url: `${origin}/agents`,
      });

    return res.status(200).json({
      url: session.url,
    });
  } catch (error) {
    console.error(
      "Stripe portal session error:",
      error
    );

    return res.status(500).json({
      error: "Unable to create portal session",
    });
  }
}