export function formatNumber(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return new Intl.NumberFormat("tr-TR").format(n);
}

export function formatMoney(value: number | null | undefined, currency = "TRY"): string {
  const n = Number(value ?? 0);
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${formatNumber(n)} ${currency}`;
  }
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return "—";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "az önce";
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return date.toLocaleDateString("tr-TR");
}

export function clockTime(value: string | Date | null | undefined): string {
  if (!value) return "--:--";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function slugify(input: string): string {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    Ç: "c",
    Ğ: "g",
    Ş: "s",
    Ö: "o",
    Ü: "u",
  };
  return input
    .split("")
    .map((char) => map[char] ?? char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function cleanUsername(input: string): string {
  return input.trim().replace(/^@+/, "").replace(/\s+/g, "");
}

export const DIAMOND_RATE_TRY = 0.021;
export const DIAMOND_RATE_USD = 0.00065;

export function diamondsToTry(diamonds: number): number {
  return Math.round(diamonds * DIAMOND_RATE_TRY);
}

export function diamondsToUsd(diamonds: number): number {
  return Math.round(diamonds * DIAMOND_RATE_USD * 100) / 100;
}
