import { createClient } from "@supabase/supabase-js";

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
      error: "Method not allowed.",
    });
  }

  try {
    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized.",
      });
    }

    const accessToken = authHeader.slice(7).trim();

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return res.status(401).json({
        error: "Invalid or expired session.",
      });
    }

    const memberId = String(req.body?.memberId || "").trim();

    if (!memberId) {
      return res.status(400).json({
        error: "Member ID is required.",
      });
    }

    const {
      data: subscriptions,
      error: subscriptionError,
    } = await supabaseAdmin
      .from("subscriptions")
      .select("id, plan, status, user_id")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .in("plan", ["team_5", "team_10"])
      .limit(1);

    if (subscriptionError) {
      console.error(
        "Owner subscription lookup failed:",
        subscriptionError
      );

      return res.status(500).json({
        error: "Unable to verify team subscription.",
      });
    }

    const subscription = subscriptions?.[0];

    if (!subscription) {
      return res.status(403).json({
        error: "Owner team subscription required.",
      });
    }

    const {
      data: member,
      error: memberError,
    } = await supabaseAdmin
      .from("team_members")
      .select("id, email, role, subscription_id")
      .eq("id", memberId)
      .eq("subscription_id", subscription.id)
      .maybeSingle();

    if (memberError) {
      console.error(
        "Team member lookup failed:",
        memberError
      );

      return res.status(500).json({
        error: "Unable to verify team member.",
      });
    }

    if (!member) {
      return res.status(404).json({
        error: "Team member not found.",
      });
    }

    if (member.role === "owner") {
      return res.status(400).json({
        error: "The team owner cannot be removed.",
      });
    }

    const {
      error: deleteError,
    } = await supabaseAdmin
      .from("team_members")
      .delete()
      .eq("id", member.id)
      .eq("subscription_id", subscription.id);

    if (deleteError) {
      console.error(
        "Team member removal failed:",
        deleteError
      );

      return res.status(500).json({
        error: "Unable to remove team member.",
      });
    }

    return res.status(200).json({
      removed: true,
      memberId: member.id,
      email: member.email,
    });
  } catch (error) {
    console.error(
      "Remove team member endpoint failed:",
      error
    );

    return res.status(500).json({
      error: "Unable to remove team member.",
    });
  }
}