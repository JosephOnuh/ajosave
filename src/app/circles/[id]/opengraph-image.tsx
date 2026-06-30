import { ImageResponse } from "next/og";
import { getCircleById } from "@/server/services/circle.service";
import { getCurrencySymbol, SupportedCurrency } from "@/lib/currency";

export const alt = "Ajosave Savings Circle";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const circle = await getCircleById(params.id);

  if (!circle) {
    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0f172a",
            color: "#ffffff",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ fontSize: 64, fontWeight: "bold", color: "#ef4444" }}>
            Circle Not Found
          </div>
          <div style={{ fontSize: 24, color: "#94a3b8", marginTop: 20 }}>
            The requested savings circle does not exist or has been deleted.
          </div>
        </div>
      ),
      { ...size }
    );
  }

  const symbol = getCurrencySymbol(circle.contributionCurrency as SupportedCurrency);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b0f19",
          backgroundImage: "radial-gradient(circle at 50% 50%, #1e1b4b 0%, #0b0f19 100%)",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "60px",
          boxSizing: "border-box",
        }}
      >
        {/* Branding header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: "#3b82f6",
              boxShadow: "0 0 12px #3b82f6",
            }}
          />
          <span
            style={{
              fontSize: "20px",
              fontWeight: "600",
              color: "#3b82f6",
              letterSpacing: "3px",
              textTransform: "uppercase",
            }}
          >
            Ajosave
          </span>
        </div>

        {/* Circle Name */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "30px",
            backgroundImage: "linear-gradient(to right, #ffffff, #93c5fd)",
            color: "#ffffff",
            lineHeight: 1.2,
          }}
        >
          {circle.name}
        </div>

        {/* Details Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: "rgba(30, 41, 59, 0.5)",
            border: "1px solid rgba(148, 163, 184, 0.1)",
            borderRadius: "16px",
            padding: "24px 60px",
          }}
        >
          <div
            style={{
              fontSize: "36px",
              fontWeight: "700",
              color: "#38bdf8",
              marginBottom: "8px",
              display: "flex",
            }}
          >
            {symbol}
            {circle.contributionFiat.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: "20px",
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "1px",
              display: "flex",
            }}
          >
            Contributed {circle.cycleFrequency}
          </div>
        </div>

        {/* CTA Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "60px",
            color: "#10b981",
            fontSize: "18px",
            fontWeight: "500",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            padding: "8px 20px",
            borderRadius: "30px",
            border: "1px solid rgba(16, 185, 129, 0.2)",
          }}
        >
          <span>Powered by Stellar Blockchain</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
