import { ImageResponse } from "next/og";
import { ORNAMENT_AREA_PATH, ORNAMENT_AXIS_Y, ORNAMENT_BALANCE_PATH, ORNAMENT_BARS, ORNAMENT_LAST } from "@/components/site/motif";
import { OG_GLYPHS } from "@/lib/og-glyphs";
import { OG_IMAGE_ALT, OG_IMAGE_SIZE } from "@/lib/metadata";

export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";
export const dynamic = "force-static";

const NAVY = "#0b1626";
const IVORY = "#f7f3ea";
const GOLD = "#c9a548";
const GOLD_LIGHT = "#d8bd72";
const NAVY_300 = "#8f9bb0";

function Glyphs({ id, height, top, bottom, colors }: { id: keyof typeof OG_GLYPHS; height: number; top: number; bottom: number; colors: string[] }) {
  const glyphs = OG_GLYPHS[id];
  const span = bottom - top;
  const width = Math.ceil((glyphs.width * height) / span);
  return (
    <svg width={width} height={height} viewBox={`0 ${top} ${glyphs.width} ${span}`} xmlns="http://www.w3.org/2000/svg">
      {glyphs.runs.map((d, index) => (
        <path key={index} d={d} fill={colors[index] ?? colors[0]} />
      ))}
    </svg>
  );
}

export default function OpenGraphImage() {
  const last = ORNAMENT_LAST;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: NAVY,
          backgroundImage: "radial-gradient(circle at 92% -10%, rgba(62,106,158,0.38) 0%, rgba(62,106,158,0) 55%)",
          color: IVORY,
        }}
      >
        <svg
          width="420"
          height="184"
          viewBox="0 30 640 280"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: "absolute", right: 64, top: 410 }}
        >
          <defs>
            <linearGradient id="og-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={GOLD_LIGHT} stopOpacity="0.55" />
              <stop offset="1" stopColor={GOLD} stopOpacity="0.12" />
            </linearGradient>
            <linearGradient id="og-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={GOLD} stopOpacity="0.16" />
              <stop offset="1" stopColor={GOLD} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="og-fade" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.45" stopColor="#fff" stopOpacity="1" />
            </linearGradient>
            <mask id="og-mask">
              <rect y="30" width="640" height="280" fill="url(#og-fade)" />
            </mask>
          </defs>
          <g mask="url(#og-mask)">
            {[40, 100, 160].map((y) => (
              <line key={y} x1="0" x2="640" y1={y} y2={y} stroke={GOLD} strokeOpacity="0.16" strokeWidth="1" strokeDasharray="2 7" />
            ))}
            <path d={ORNAMENT_AREA_PATH} fill="url(#og-area)" />
            {ORNAMENT_BARS.map((bar) =>
              bar.kind === "in" ? (
                <rect
                  key={bar.x}
                  x={bar.x - 3}
                  y={ORNAMENT_AXIS_Y - bar.height}
                  width="6"
                  height={bar.height}
                  rx="1"
                  fill="url(#og-bar)"
                  stroke={GOLD_LIGHT}
                  strokeOpacity="0.8"
                  strokeWidth="1.2"
                />
              ) : (
                <rect
                  key={bar.x}
                  x={bar.x - 3}
                  y={ORNAMENT_AXIS_Y + 3}
                  width="6"
                  height={bar.height}
                  rx="1"
                  fill={GOLD}
                  fillOpacity="0.08"
                  stroke={GOLD}
                  strokeOpacity="0.5"
                  strokeWidth="1.2"
                />
              ),
            )}
            <line x1="0" x2="640" y1={ORNAMENT_AXIS_Y} y2={ORNAMENT_AXIS_Y} stroke={GOLD} strokeOpacity="0.45" strokeWidth="1" />
            {[14, 9, 5].map((offset, index) => (
              <path
                key={offset}
                d={ORNAMENT_BALANCE_PATH}
                transform={`translate(0 ${offset})`}
                fill="none"
                stroke={GOLD}
                strokeOpacity={0.06 + index * 0.05}
                strokeWidth="1"
              />
            ))}
            <path d={ORNAMENT_BALANCE_PATH} fill="none" stroke={GOLD_LIGHT} strokeWidth="2.25" strokeLinejoin="round" />
            <line x1={last.x} x2={last.x} y1={last.balanceY + 13} y2={ORNAMENT_AXIS_Y - last.height} stroke={GOLD_LIGHT} strokeOpacity="0.45" strokeDasharray="3 5" strokeWidth="1" />
          </g>
          <circle cx={last.x} cy={last.balanceY} r="13" fill="none" stroke={GOLD_LIGHT} strokeOpacity="0.4" strokeWidth="1" />
          <circle cx={last.x} cy={last.balanceY} r="5" fill={GOLD_LIGHT} />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", padding: "60px 76px 56px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="40" height="40" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 1.75 30.25 16 16 30.25 1.75 16Z" fill="none" stroke={GOLD} strokeWidth="1.4" />
              <path d="M11.05 20V16.5M14.35 20V13.5M17.65 20V15M20.95 20V12" fill="none" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 16 }}>
              <div style={{ fontSize: 16, letterSpacing: 3.2, textTransform: "uppercase", color: IVORY }}>Mirkan Deniz Günkaya</div>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: NAVY_300, marginTop: 6 }}>
                Portfolio · Daten, KI, Finanzen
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 15, letterSpacing: 3.6, textTransform: "uppercase", color: GOLD_LIGHT }}>
              <div style={{ width: 40, height: 1, backgroundColor: GOLD, marginRight: 16 }} />
              Projekt K2 · Maschinelles Lernen
            </div>
            <div style={{ display: "flex", marginTop: 26 }}>
              <Glyphs id="title" height={150} top={-760} bottom={250} colors={[IVORY, GOLD_LIGHT]} />
            </div>
            <div style={{ display: "flex", marginTop: 14 }}>
              <Glyphs id="tagline" height={46} top={-760} bottom={250} colors={[GOLD_LIGHT]} />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", width: 540, fontSize: 19, lineHeight: 1.5, color: NAVY_300 }}>
            <div style={{ width: 56, height: 1, backgroundColor: GOLD, marginBottom: 18 }} />
            <div style={{ display: "flex" }}>Kategorien, Monatsausgaben, Abos und Inflation</div>
            <div style={{ display: "flex" }}>aus Bank-CSV-Exporten, ausgewertet im Browser.</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
