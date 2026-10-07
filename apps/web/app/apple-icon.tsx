import { ImageResponse } from "next/og";
import { PALETTE } from "@/lib/kontoklar/chartTheme";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PALETTE.ink }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <rect width="64" height="64" fill={PALETTE.ink} />
          <path d="M20 16h8v14l12-14h10L36 32l15 16H40L28 34v14h-8z" fill={PALETTE.gold} />
        </svg>
      </div>
    ),
    size,
  );
}
