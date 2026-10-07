import { Link } from "react-router-dom";
import { useRef } from "react";

export default function Tutorial() {
  const videoRef = useRef(null);

  const openFullscreen = async () => {
    const video = videoRef.current;
    if (!video) return;

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
            WATCH FULL SCREEN
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