import { checkSubscriptionStatus } from "../lib/subscription-status.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const customerId = req.query.customer_id;
  const subscriptionId = req.query.subscription_id;

  const result = await checkSubscriptionStatus({
    customerId,
    subscriptionId,
  });

  return res.status(200).json(result);
}