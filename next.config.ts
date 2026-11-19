import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tiktok-live-connector", "qrcode", "jszip"],
  outputFileTracingIncludes: {
    // pg, Workers'ta pg-cloudflare soketini kullanır; Next izleme adımı yalnızca
    // varsayılan (Node) dosyasını kopyalar. Çalışma zamanı dosyalarını ekle.
    "/*": [
      "./node_modules/pg-cloudflare/dist/index.js",
      "./node_modules/pg-cloudflare/esm/index.mjs",
      "./node_modules/pg-cloudflare/dist/empty.js",
    ],
    "/api/windows/pack": ["./scripts/**/*", "./docs/**/*"],
    "/api/library/pack": ["./scripts/**/*", "./docs/**/*"],
  },
};

export default nextConfig;
