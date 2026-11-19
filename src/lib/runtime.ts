/** Çalışma zamanı Cloudflare Workers mı? (Node betikleri ve Windows paneli değil) */
export function isCloudflareWorkers(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}
