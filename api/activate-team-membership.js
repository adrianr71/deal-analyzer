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

    const email = String(user.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({
        error: "Authenticated user has no email address",
      });
    }

    const { data: invitedMemberships, error: lookupError } =
      await supabaseAdmin
        .from("team_members")
        .select(
          "id, subscription_id, user_id, email, role, status"
        )
        .eq("email", email)
        .eq("role", "member")
        .eq("status", "invited");

    if (lookupError) {
      console.error(
        "Invited membership lookup failed:",
        lookupError
      );

      return res.status(500).json({
        error: "Unable to check team invitation",
      });
    }

    if (!invitedMemberships || invitedMemberships.length === 0) {
      return res.status(404).json({
        error: "No pending team invitation found",
      });
    }

    if (invitedMemberships.length > 1) {
      return res.status(409).json({
        error: "Multiple pending team invitations found",
      });
    }

    const invitation = invitedMemberships[0];

    const {
      data: activatedMembership,
      error: activateError,
    } = await supabaseAdmin
      .from("team_members")
      .update({
        user_id: user.id,
        status: "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id)
      .eq("status", "invited")
      .select(
        "id, subscription_id, user_id, email, role, status, created_at, updated_at"
      )
      .single();

    if (activateError) {
      console.error(
        "Team membership activation failed:",
        activateError
      );

      return res.status(500).json({
        error: "Unable to activate team membership",
      });
    }

    return res.status(200).json({
      success: true,
      membership: activatedMembership,
    });
  } catch (error) {
    console.error(
      "Activate team membership error:",
      error
    );

    return res.status(500).json({
      error: "Unable to activate team membership",
    });
  }
}