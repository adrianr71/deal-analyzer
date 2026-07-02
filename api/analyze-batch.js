import { analyzeRows } from "../lib/analyzer1.js";
import { checkSubscriptionStatus } from "../lib/subscription-status.js";

async function logUsageEvent({
  customerId,
  subscriptionId,
  eventType,
  rowCount,
  isSubscribed,
  req,
  metadata = {},
}) {
  try {
    const supabaseUrl = String(process.env.VITE_SUPABASE_URL || "")
      .trim()
      .replace(/\/$/, "");

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) return;

    const userAgent = req.headers["user-agent"] || "";
    const forwardedFor = req.headers["x-forwarded-for"] || "";
    const ipAddress = String(forwardedFor).split(",")[0].trim();

    await fetch(`${supabaseUrl}/rest/v1/usage_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        stripe_customer_id: customerId || null,
        stripe_subscription_id: subscriptionId || null,
        event_type: eventType,
        row_count: rowCount,
        is_subscribed: isSubscribed,
        user_agent: userAgent,
        ip_hash: ipAddress || null,
        metadata,
      }),
    });
  } catch (error) {
    console.error("Usage event logging failed:", error);
  }
}

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

await logUsageEvent({
  customerId,
  subscriptionId,
  eventType: "analyze_batch",
  rowCount: rows.length,
  isSubscribed,
  req,
  metadata: {
    source: "api/analyze-batch",
  },
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