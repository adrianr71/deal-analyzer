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

    const deviceId = String(
      req.body?.deviceId || ""
    ).trim();

    if (!deviceId) {
      return res.status(400).json({
        error: "Device ID is required.",
      });
    }

    const { error: deleteError } = await supabaseAdmin
      .from("user_devices")
      .delete()
      .eq("user_id", user.id)
      .eq("device_id", deviceId);

    if (deleteError) {
      console.error(
        "Device release failed:",
        deleteError
      );

      return res.status(500).json({
        error: "Unable to release this device.",
      });
    }

    return res.status(200).json({
      released: true,
    });
  } catch (error) {
    console.error(
      "Release device endpoint failed:",
      error
    );

    return res.status(500).json({
      error: "Unable to release this device.",
    });
  }
}