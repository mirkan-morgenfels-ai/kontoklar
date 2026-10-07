import { ImageResponse } from "next/og";
import { PALETTE } from "@/lib/kontoklar/chartTheme";
import { OG_IMAGE_ALT, OG_IMAGE_SIZE } from "@/lib/metadata";

export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: PALETTE.paper,
          color: PALETTE.ink,
          borderTop: `16px solid ${PALETTE.gold}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <svg width="112" height="112" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill={PALETTE.ink} />
            <path d="M20 16h8v14l12-14h10L36 32l15 16H40L28 34v14h-8z" fill={PALETTE.gold} />
          </svg>
          <div style={{ display: "flex", fontSize: 96, fontFamily: "serif" }}>KontoKlar</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 44 }}>Bankumsätze aus CSV-Exporten kategorisieren</div>
          <div style={{ display: "flex", fontSize: 30, color: PALETTE.stone }}>
            Regel-Engine im Browser · Dashboard · wiederkehrende Zahlungen · persönliche Inflation
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: PALETTE.goldDeep }}>Portfolio-Projekt von Mirkan Deniz Günkaya</div>
      </div>
    ),
    size,
  );
}
