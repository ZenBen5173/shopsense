import { ImageResponse } from "next/og";

export const alt = "ShopSense: your Ring camera, now a business advisor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Link preview for Devpost, WhatsApp and Slack. */
export default function OpengraphImage() {
  const bars = [8, 14, 9, 7, 10, 30, 28, 9, 8, 10, 15, 18, 14, 10];
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#111113", color: "#edeef0", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "#3e63dd", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 700 }}>S</div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>ShopSense</div>
          <div style={{ marginLeft: "auto", fontSize: 22, color: "#9eb1ff" }}>Ring Partner API · Amazon Bedrock</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1.5 }}>Your Ring camera already sees your business.</div>
          <div style={{ fontSize: 40, color: "#b0b4ba" }}>ShopSense tells you what it saw.</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 120 }}>
          {bars.map((v, i) => (
            <div key={i} style={{ flex: 1, height: `${(v / 30) * 100}%`, borderRadius: 6, background: v >= 25 ? "#ffc53d" : "#3e63dd", opacity: v >= 25 ? 1 : 0.75 }} />
          ))}
        </div>
      </div>
    ),
    size,
  );
}
