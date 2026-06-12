import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { customerId } = req.body || {};

    if (!customerId) {
      return res.status(400).json({ error: "Missing Stripe customer ID" });
    }

    const origin =
      req.headers.origin ||
      (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
      "https://www.rentaldealscreener.pro";

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/agents`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Stripe portal session error:", error);
    return res.status(500).json({
      error: "Unable to create portal session",
    });
  }
}