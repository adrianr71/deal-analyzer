import { analyzeRows } from "../lib/analyzer1.js";

async function checkSubscriptionOnServer(customerId, subscriptionId) {
  try {
    if (!customerId && !subscriptionId) return false;

    const query = customerId
      ? `customer_id=${encodeURIComponent(customerId)}`
      : `subscription_id=${encodeURIComponent(subscriptionId)}`;

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/get-subscription-status?${query}`);
    const data = await response.json();

    return data.subscribed === true;
  } catch (error) {
    console.error("Subscription check failed:", error);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rows, assumptions, taxOverrides, customerId, subscriptionId } = req.body || {};

    if (!Array.isArray(rows) || !assumptions) {
      return res.status(400).json({ error: "Missing rows or assumptions" });
    }

    const isSubscribed = await checkSubscriptionOnServer(customerId, subscriptionId);
    const limit = isSubscribed ? 100 : 20;

    if (rows.length > limit) {
      return res.status(403).json({ error: `Batch exceeds ${limit} properties for this plan.` });
    }

    const analyzed = analyzeRows(rows, assumptions, taxOverrides || {});

    return res.status(200).json({
      analyzed,
      isSubscribed
    });
  } catch (error) {
    console.error("Analyze batch error:", error);
    return res.status(500).json({ error: "Unable to analyze batch" });
  }
}