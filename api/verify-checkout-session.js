import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const sessionId = req.query.session_id;

    if (!sessionId) {
      return res.status(400).json({ error: "Missing checkout session ID" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    const subscription = session.subscription;
    const status =
      typeof subscription === "object" && subscription
        ? subscription.status
        : "unknown";

    const subscribed =
      session.payment_status === "paid" &&
      (status === "active" || status === "trialing");

    return res.status(200).json({
      subscribed,
      status,
      customerId:
        typeof session.customer === "object" && session.customer
          ? session.customer.id
          : session.customer,
      subscriptionId:
        typeof subscription === "object" && subscription
          ? subscription.id
          : subscription,
    });
  } catch (error) {
    console.error("Verify checkout session error:", error);
    return res.status(500).json({
      error: "Unable to verify checkout session",
    });
  }
}