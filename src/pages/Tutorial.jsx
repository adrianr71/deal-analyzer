import { Link } from "react-router-dom";

export default function Tutorial() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#07101f",
        color: "#ffffff",
        padding: "40px 24px 60px",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
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
            marginTop: "32px",
            marginBottom: "28px",
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
              marginBottom: "16px",
            }}
          >
            Multi-Property Rental Investment Analysis for Real Estate Agents
          </p>

          <p
            style={{
              color: "#b7c8df",
              fontSize: "17px",
              lineHeight: "1.7",
              maxWidth: "900px",
            }}
          >
            See how to import a property list, apply your investor&apos;s
            assumptions, compare multiple rental opportunities, refine
            individual properties, and create professional reports.
          </p>
        </header>

        <div
          style={{
            background: "#0b1528",
            border: "1px solid #24364f",
            borderRadius: "18px",
            padding: "16px",
            boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          }}
        >
          <video
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
            marginTop: "34px",
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