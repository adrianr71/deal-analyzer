import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const origin =
      req.headers.origin ||
      (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
      "https://www.rentaldealscreener.pro";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      automatic_tax: {
      enabled: true,
      },
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      success_url: `${origin}/agents?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/agents?checkout=cancel`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout session error:", error);
    return res.status(500).json({
      error: "Unable to create checkout session",
    });
  }
}