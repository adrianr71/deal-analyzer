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

    const { data: subscription, error: subscriptionError } =
      await supabaseAdmin
        .from("subscriptions")
        .select(
          "id, plan, max_users, max_devices_per_user, status, current_period_end"
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
        "Team subscription lookup failed:",
        subscriptionError
      );

      return res.status(500).json({
        error: "Unable to load team subscription",
      });
    }

    if (!subscription) {
      return res.status(404).json({
        error: "Active subscription not found",
      });
    }

    const { data: members, error: membersError } =
      await supabaseAdmin
        .from("team_members")
        .select(
          "id, user_id, email, role, status, created_at, updated_at"
        )
        .eq("subscription_id", subscription.id)
        .neq("status", "removed")
        .order("created_at", {
          ascending: true,
        });

    if (membersError) {
      console.error(
        "Team members lookup failed:",
        membersError
      );

      return res.status(500).json({
        error: "Unable to load team members",
      });
    }

    const maxUsers = Number(subscription.max_users) || 1;

    const usedSeats = Array.isArray(members)
      ? members.filter((member) =>
          ["invited", "active"].includes(member.status)
        ).length
      : 0;

    const remainingSeats = Math.max(
      maxUsers - usedSeats,
      0
    );

    return res.status(200).json({
      subscriptionId: subscription.id,
      plan: subscription.plan || "individual",
      maxUsers,
      maxDevicesPerUser:
        Number(subscription.max_devices_per_user) || 2,
      usedSeats,
      remainingSeats,
      members: members || [],
    });
  } catch (error) {
    console.error(
      "Get team members error:",
      error
    );

    return res.status(500).json({
      error: "Unable to load team members",
    });
  }
}