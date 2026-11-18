import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tiktok-live-connector", "qrcode", "jszip"],
  outputFileTracingIncludes: {
    "/api/windows/pack": ["./scripts/**/*", "./docs/**/*"],
    "/api/library/pack": ["./scripts/**/*", "./docs/**/*"],
  },
};

export default nextConfig;
