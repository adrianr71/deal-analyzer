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

    const deviceId = String(req.body?.deviceId || "").trim();
    const deviceName = String(req.body?.deviceName || "")
      .trim()
      .slice(0, 120);

    if (!deviceId) {
      return res.status(400).json({
        error: "Device ID is required.",
      });
    }

    const entitlement = await checkSubscriptionStatus({
      userId: user.id,
    });

    if (!entitlement?.subscribed) {
      return res.status(403).json({
        error: "Active subscription access is required.",
      });
    }

    const maxDevices =
      Number(entitlement.maxDevicesPerUser) || 2;

    const {
      data: existingDevice,
      error: existingError,
    } = await supabaseAdmin
      .from("user_devices")
      .select("id, device_id")
      .eq("user_id", user.id)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (existingError) {
      console.error(
        "Existing device lookup failed:",
        existingError
      );

      return res.status(500).json({
        error: "Unable to verify this device.",
      });
    }

    if (existingDevice) {
      const { error: updateError } = await supabaseAdmin
        .from("user_devices")
        .update({
          device_name: deviceName || null,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existingDevice.id);

      if (updateError) {
        console.error(
          "Device last-seen update failed:",
          updateError
        );

        return res.status(500).json({
          error: "Unable to update this device.",
        });
      }

      return res.status(200).json({
        allowed: true,
        existing: true,
        maxDevices,
      });
    }

    const {
      count,
      error: countError,
    } = await supabaseAdmin
      .from("user_devices")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id);

    if (countError) {
      console.error(
        "Device count failed:",
        countError
      );

      return res.status(500).json({
        error: "Unable to verify device limit.",
      });
    }

    if ((count || 0) >= maxDevices) {
      return res.status(403).json({
        allowed: false,
        error: `This account has reached the ${maxDevices}-device limit.`,
        maxDevices,
      });
    }

    const {
      error: insertError,
    } = await supabaseAdmin
      .from("user_devices")
      .insert({
        user_id: user.id,
        device_id: deviceId,
        device_name: deviceName || null,
        last_seen_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error(
        "Device registration failed:",
        insertError
      );

      return res.status(500).json({
        error: "Unable to register this device.",
      });
    }

    return res.status(200).json({
      allowed: true,
      existing: false,
      maxDevices,
    });
  } catch (error) {
    console.error(
      "Register device endpoint failed:",
      error
    );

    return res.status(500).json({
      error: "Unable to register this device.",
    });
  }
}