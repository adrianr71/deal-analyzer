import { createClient } from "@supabase/supabase-js";
import { checkSubscriptionStatus } from "../lib/subscription-status.js";

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
  if (req.method !== "GET") {
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

    const result = await checkSubscriptionStatus({
      userId: user.id,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error(
      "Subscription status lookup failed:",
      error
    );

    return res.status(500).json({
      error: "Unable to check subscription status",
    });
  }
}