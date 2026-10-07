import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 75% 15%, #16273f 0%, #0b1626 70%)",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <path d="M32 5 59 32 32 59 5 32Z" fill="none" stroke="#c9a548" strokeWidth="2" />
          <path
            d="M23.1 39.2V32.9M29 39.2V27.5M34.9 39.2V30.2M40.8 39.2V24.8"
            fill="none"
            stroke="#d8bd72"
            strokeWidth="3.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
