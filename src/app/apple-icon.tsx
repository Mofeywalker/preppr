import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};
export const contentType = "image/png";

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
          background: "#09090b",
        }}
      >
        <svg
          width="116"
          height="116"
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="10" y="10" width="9" height="44" rx="4.5" fill="#fafafa" />
          <path
            d="M22 10H42C48.0751 10 53 14.9249 53 19.5C53 20.3284 52.3284 21 51.5 21H22V10Z"
            fill="#fafafa"
          />
          <path
            d="M22 23.5H51.5C52.3284 23.5 53 24.1716 53 25C53 29.5751 48.0751 34.5 42 34.5H22V23.5Z"
            fill="#fafafa"
          />
          <circle cx="42.5" cy="22.25" r="3" fill="#10B981" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  );
}
