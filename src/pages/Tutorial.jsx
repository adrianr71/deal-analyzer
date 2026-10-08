import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

function getOrCreateId(storage, key) {
  let id = storage.getItem(key);

  if (!id) {
    id = crypto.randomUUID();
    storage.setItem(key, id);
  }

  return id;
}

export default function Tutorial() {
  const videoRef = useRef(null);

  const visitorIdRef = useRef(null);
  const sessionIdRef = useRef(null);

  const startedRef = useRef(false);
  const fiftyRef = useRef(false);
  const ninetyRef = useRef(false);
  const completedRef = useRef(false);

const trackEvent = async (eventName, metadata = {}) => {
  try {
    if (!visitorIdRef.current || !sessionIdRef.current) return false;

    const { error } = await supabase
      .from("tutorial_analytics")
      .insert({
        event_name: eventName,
        visitor_id: visitorIdRef.current,
        session_id: sessionIdRef.current,
        page_path: "/tutorial",
        metadata,
      });

    if (error) {
      console.warn(
        "Tutorial analytics event not recorded:",
        error.message
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Tutorial analytics unavailable:", error);
    return false;
  }
};

useEffect(() => {
  const recordPageView = async () => {
    try {
      visitorIdRef.current = getOrCreateId(
        localStorage,
        "rds_tutorial_visitor_id"
      );

      sessionIdRef.current = getOrCreateId(
        sessionStorage,
        "rds_tutorial_session_id"
      );

      const recorded =
        sessionStorage.getItem("rds_tutorial_page_view_recorded");

      const pending =
        sessionStorage.getItem("rds_tutorial_page_view_pending");

      if (recorded || pending) return;

      // Prevent React development mode from starting the same insert twice.
      sessionStorage.setItem(
        "rds_tutorial_page_view_pending",
        "true"
      );

      const success = await trackEvent("page_view");

      sessionStorage.removeItem(
        "rds_tutorial_page_view_pending"
      );

      // Only mark it recorded after Supabase confirms the insert.
      if (success) {
        sessionStorage.setItem(
          "rds_tutorial_page_view_recorded",
          "true"
        );
      }
    } catch (error) {
      sessionStorage.removeItem(
        "rds_tutorial_page_view_pending"
      );

      console.warn(
        "Tutorial visitor tracking unavailable:",
        error
      );
    }
  };

  recordPageView();
}, []);

  const handlePlay = () => {
    if (startedRef.current) return;

    startedRef.current = true;
    trackEvent("video_started");
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;

    if (!video || !video.duration) return;

    const progress = video.currentTime / video.duration;

    if (progress >= 0.5 && !fiftyRef.current) {
      fiftyRef.current = true;

      trackEvent("video_50_percent", {
        current_time: Math.round(video.currentTime),
      });
    }

    if (progress >= 0.9 && !ninetyRef.current) {
      ninetyRef.current = true;

      trackEvent("video_90_percent", {
        current_time: Math.round(video.currentTime),
      });
    }
  };

  const handleEnded = () => {
    if (completedRef.current) return;

    completedRef.current = true;
    trackEvent("video_completed");
  };

  const openFullscreen = async () => {
    const video = videoRef.current;

    if (!video) return;

    trackEvent("fullscreen_clicked");

    try {
      if (video.requestFullscreen) {
        await video.requestFullscreen();
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen request failed:", error);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#07101f",
        color: "#ffffff",
        padding: "28px 20px 50px",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <Link
          to="/agents"
          style={{
            color: "#22d3ee",
            textDecoration: "none",
            fontSize: "15px",
          }}
        >
          ← Back to Rental Deal Screener Pro
        </Link>

        <header
          style={{
            marginTop: "24px",
            marginBottom: "22px",
          }}
        >
          <h1
            style={{
              fontSize: "38px",
              marginBottom: "12px",
            }}
          >
            How to Use Rental Deal Screener Pro
          </h1>

          <p
            style={{
              color: "#22d3ee",
              fontSize: "20px",
              marginBottom: "14px",
            }}
          >
            Multi-Property Rental Investment Analysis for Real Estate Agents
          </p>

          <p
            style={{
              color: "#b7c8df",
              fontSize: "17px",
              lineHeight: "1.6",
              maxWidth: "950px",
              marginBottom: "8px",
            }}
          >
            See how to import a property list, apply your investor&apos;s
            assumptions, compare multiple rental opportunities, refine
            individual properties, and create professional reports.
          </p>

          <p
            style={{
              color: "#d7e3f4",
              fontSize: "15px",
              marginTop: "10px",
            }}
          >
            For the clearest view of the property analysis and reports, watch in
            full screen.
          </p>
        </header>

        <div
          style={{
            marginBottom: "14px",
          }}
        >
          <button
            onClick={openFullscreen}
            style={{
              background: "#0891b2",
              color: "#ffffff",
              border: "none",
              padding: "12px 20px",
              borderRadius: "10px",
              fontWeight: "600",
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            Watch Full Screen
          </button>
        </div>

        <div
          style={{
            background: "#0b1528",
            border: "1px solid #2b4668",
            borderRadius: "18px",
            padding: "12px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.28)",
          }}
        >
          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            onPlay={handlePlay}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            style={{
              display: "block",
              width: "100%",
              borderRadius: "12px",
              background: "#000000",
            }}
          >
            <source
              src="/Videos/rental-deal-screener-pro-tutorial.mp4"
              type="video/mp4"
            />
            Your browser does not support video playback.
          </video>
        </div>

        <div
          style={{
            textAlign: "center",
            marginTop: "28px",
          }}
        >
          <Link
            to="/agents"
            style={{
              display: "inline-block",
              background: "#0891b2",
              color: "#ffffff",
              padding: "13px 24px",
              borderRadius: "10px",
              fontWeight: "600",
              textDecoration: "none",
            }}
          >
            Start Analyzing Properties
          </Link>
        </div>
      </div>
    </main>
  );
}