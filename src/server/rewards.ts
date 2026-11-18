import type { EnvelopeFields } from "@/server/chest";

type Obj = Record<string, unknown>;
const object = (value: unknown): Obj | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : null;
const integer = (value: unknown): number | null => {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : null;
};
const timestamp = (value: unknown): number | null => {
  const n = integer(value);
  if (!n) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  // Do not invent an opening time; reject malformed / stale dates.
  return ms > Date.now() - 60_000 && ms < Date.now() + 86_400_000 ? Math.floor(ms / 1000) : null;
};
const id = (value: unknown): string => typeof value === "string" || typeof value === "number" ? String(value) : "";

/** Only explicitly named envelope information, never room diamonds, gifts or user stats. */
export function envelopeReward(raw: unknown, roomId: string): EnvelopeFields | null {
  const record = object(raw);
  if (!record) return null;
  const info = object(record.envelopeInfo ?? record.envelope_info ?? record);
  if (!info) return null;
  const envelopeId = id(info.envelopeId ?? info.envelope_id);
  const coins = integer(info.diamondCount ?? info.diamond_count);
  const slots = integer(info.peopleCount ?? info.people_count);
  const opensAt = timestamp(info.unpackAt ?? info.unpack_at);
  if (!envelopeId || !coins || !slots || !opensAt) return null;
  return { envelopeId, diamondCount: coins, peopleCount: slots, unpackAt: opensAt,
    roomId: id(info.roomId ?? info.room_id) || roomId,
    skinId: integer(info.skinId ?? info.skin_id) ?? 1,
    businessType: integer(info.businessType ?? info.business_type) ?? 1 };
}

/** Published WebcastGoodyBagMessage schema: baseInfo.goodyBagId,
 * commonDetail.winnerHeadcount, coinDetail.totalCoin, explicit openAt. */
export function bagReward(raw: unknown, roomId: string): EnvelopeFields | null {
  const data = object(raw);
  if (!data) return null;
  const base = object(data.baseInfo ?? data.base_info);
  const common = object(base?.commonDetail ?? base?.common_detail);
  const coin = object(base?.coinDetail ?? base?.coin_detail);
  const bagId = id(base?.goodyBagId ?? base?.goody_bag_id ?? data.goodyBagId);
  const coins = integer(coin?.totalCoin ?? coin?.total_coin ?? data.totalCoins);
  const slots = integer(common?.winnerHeadcount ?? common?.winner_headcount ?? data.winnerCount);
  const opensAt = timestamp(data.openAt ?? data.open_at ?? base?.openAt ?? base?.open_at);
  // Coin bags only; fan-club/non-coin bags cannot be represented as chest coins.
  const biz = integer(base?.biz ?? data.biz);
  if (biz !== 1 || !bagId || !coins || !slots || !opensAt) return null;
  return { envelopeId: `bag:${bagId}`, roomId: id(base?.roomId ?? base?.room_id) || roomId,
    diamondCount: coins, peopleCount: slots, unpackAt: opensAt, skinId: 0, businessType: biz };
}

/** A room-info response may explicitly include a current envelope; never walk arbitrary keys. */
export function roomRewards(raw: unknown, roomId: string): EnvelopeFields[] {
  const response = object(raw);
  const data = object(response?.data) ?? response;
  if (!data) return [];
  const result: EnvelopeFields[] = [];
  for (const key of ["envelopeInfo", "envelope_info", "envelopeList", "envelope_list"]) {
    const value = data[key];
    for (const entry of Array.isArray(value) ? value.slice(0, 20) : value ? [value] : []) {
      const parsed = envelopeReward(entry, roomId);
      if (parsed) result.push(parsed);
    }
  }
  return result;
}
