import { analyzeRows } from "../lib/analyzer1.js";
import { checkSubscriptionStatus } from "../lib/subscription-status.js";

const PAID_BATCH_LIMIT = 100;
const FREE_BATCH_LIMIT = 20;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { rows, assumptions, taxOverrides, customerId, subscriptionId } =
      req.body || {};

    if (!Array.isArray(rows) || !assumptions) {
      return res.status(400).json({ error: "Missing rows or assumptions" });
    }

    const subscription = await checkSubscriptionStatus({
      customerId,
      subscriptionId,
    });

    const isSubscribed = subscription.subscribed === true;
    const limit = isSubscribed ? PAID_BATCH_LIMIT : FREE_BATCH_LIMIT;

    if (rows.length > limit) {
      return res.status(403).json({
        error: `Batch exceeds ${limit} properties for this plan.`,
        isSubscribed,
        limit,
      });
    }

    const analyzed = analyzeRows(rows, assumptions, taxOverrides || {});

    return res.status(200).json({
      analyzed,
      isSubscribed,
      limit,
    });
  } catch (error) {
    console.error("Analyze batch error:", error);
    return res.status(500).json({ error: "Unable to analyze batch" });
  }
}