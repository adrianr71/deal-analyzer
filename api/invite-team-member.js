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

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        error: "Email address is required",
      });
    }

    const emailLooksValid =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!emailLooksValid) {
      return res.status(400).json({
        error: "Please enter a valid email address",
      });
    }

    if (
      user.email &&
      email === user.email.toLowerCase()
    ) {
      return res.status(400).json({
        error: "The subscription owner already occupies a team seat",
      });
    }

    const { data: subscription, error: subscriptionError } =
      await supabaseAdmin
        .from("subscriptions")
        .select(
          "id, plan, max_users, status, current_period_end"
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

    if (
      subscription.plan !== "team_5" &&
      subscription.plan !== "team_10"
    ) {
      return res.status(403).json({
        error: "Team invitations require a Team plan",
      });
    }

    const { data: ownerMembership, error: ownerError } =
      await supabaseAdmin
        .from("team_members")
        .select("id, role, status")
        .eq("subscription_id", subscription.id)
        .eq("user_id", user.id)
        .eq("role", "owner")
        .eq("status", "active")
        .maybeSingle();

    if (ownerError) {
      console.error(
        "Team owner verification failed:",
        ownerError
      );

      return res.status(500).json({
        error: "Unable to verify team owner",
      });
    }

    if (!ownerMembership) {
      return res.status(403).json({
        error: "Only the team owner can invite members",
      });
    }

    const { data: existingMember, error: existingMemberError } =
      await supabaseAdmin
        .from("team_members")
        .select("id, email, status")
        .eq("subscription_id", subscription.id)
        .eq("email", email)
        .neq("status", "removed")
        .maybeSingle();

    if (existingMemberError) {
      console.error(
        "Existing team member lookup failed:",
        existingMemberError
      );

      return res.status(500).json({
        error: "Unable to check existing team members",
      });
    }

    if (existingMember) {
      return res.status(409).json({
        error: "That email already has a team seat",
      });
    }

    const { data: currentMembers, error: membersError } =
      await supabaseAdmin
        .from("team_members")
        .select("id, status")
        .eq("subscription_id", subscription.id)
        .in("status", ["invited", "active"]);

    if (membersError) {
      console.error(
        "Team seat count failed:",
        membersError
      );

      return res.status(500).json({
        error: "Unable to check available team seats",
      });
    }

    const maxUsers = Number(subscription.max_users) || 1;
    const usedSeats = currentMembers?.length || 0;

    if (usedSeats >= maxUsers) {
      return res.status(409).json({
        error: "No team seats are available",
        maxUsers,
        usedSeats,
        remainingSeats: 0,
      });
    }

    const { data: invitedMember, error: inviteError } =
      await supabaseAdmin
        .from("team_members")
        .insert({
          subscription_id: subscription.id,
          user_id: null,
          email,
          role: "member",
          status: "invited",
          updated_at: new Date().toISOString(),
        })
        .select(
          "id, user_id, email, role, status, created_at, updated_at"
        )
        .single();

    if (inviteError) {
      console.error(
        "Team invitation save failed:",
        inviteError
      );

      return res.status(500).json({
        error: "Unable to invite team member",
      });
    }

try {
const { error: authInviteError } =
  await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo:
      "https://www.rentaldealscreener.pro/agents?team_invite=1",
  });

if (authInviteError) {
  console.error(
    "Supabase auth invitation failed:",
    authInviteError
  );

  return res.status(502).json({
    error: "Supabase invitation failed",
    details: authInviteError.message,
  });
}

    const newUsedSeats = usedSeats + 1;

    return res.status(200).json({
      success: true,
      member: invitedMember,
      maxUsers,
      usedSeats: newUsedSeats,
      remainingSeats: Math.max(
        maxUsers - newUsedSeats,
        0
      ),
    });
  } catch (error) {
    console.error(
      "Invite team member error:",
      error
    );

    return res.status(500).json({
      error: "Unable to invite team member",
    });
  }
}