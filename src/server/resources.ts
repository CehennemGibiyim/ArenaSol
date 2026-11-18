import { and, asc, eq, ilike, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  agencies,
  alertRules,
  botCommands,
  creators,
  libraryItems,
  liveSessions,
  opportunities,
  overlays,
  revenueEntries,
  targets,
} from "@/db/schema";
import { cleanUsername, slugify } from "@/lib/format";

type FieldType = "text" | "number" | "boolean" | "textarea" | "select";

export type ResourceConfig = {
  label: string;
  table: never;
  fields: Record<string, FieldType>;
  required: string[];
  searchField?: string;
  filterField?: string;
  beforeWrite?: (values: Record<string, unknown>) => Record<string, unknown>;
  logLabel?: (values: Record<string, unknown>) => string;
};

const configs: Record<string, ResourceConfig> = {
  creators: {
    label: "Yayıncı",
    table: creators as never,
    fields: {
      username: "text",
      displayName: "text",
      agencyId: "number",
      followers: "number",
      category: "text",
      liveStatus: "select",
      avgViewers: "number",
      diamonds: "number",
      tiktokId: "text",
      notes: "textarea",
    },
    required: ["username"],
    searchField: "username",
    filterField: "liveStatus",
    beforeWrite: (values) => ({
      ...values,
      ...(typeof values.username === "string"
        ? { username: cleanUsername(values.username), tiktokId: values.tiktokId || cleanUsername(values.username) }
        : {}),
    }),
    logLabel: (values) => `Yayıncı eklendi: @${values.username}`,
  },
  agencies: {
    label: "Ajans",
    table: agencies as never,
    fields: {
      name: "text",
      owner: "text",
      contact: "text",
      city: "text",
      commissionRate: "number",
      tier: "select",
      status: "select",
      notes: "textarea",
    },
    required: ["name"],
    searchField: "name",
    filterField: "status",
    logLabel: (values) => `Ajans eklendi: ${values.name}`,
  },
  opportunities: {
    label: "Fırsat",
    table: opportunities as never,
    fields: {
      title: "text",
      brand: "text",
      category: "select",
      budget: "number",
      currency: "select",
      deadline: "text",
      status: "select",
      commission: "number",
      requirements: "textarea",
      source: "text",
      matchScore: "number",
    },
    required: ["title"],
    searchField: "title",
    filterField: "status",
    logLabel: (values) => `Fırsat eklendi: ${values.title}`,
  },
  targets: {
    label: "Radar adayı",
    table: targets as never,
    fields: {
      username: "text",
      displayName: "text",
      followers: "number",
      category: "text",
      liveNow: "boolean",
      viewers: "number",
      diamonds: "number",
      score: "number",
      status: "select",
      notes: "textarea",
    },
    required: ["username"],
    searchField: "username",
    filterField: "status",
    beforeWrite: (values) => ({
      ...values,
      ...(typeof values.username === "string" ? { username: cleanUsername(values.username) } : {}),
    }),
    logLabel: (values) => `Radar adayı eklendi: @${values.username}`,
  },
  commands: {
    label: "Bot komutu",
    table: botCommands as never,
    fields: {
      trigger: "text",
      matchType: "select",
      response: "text",
      action: "select",
      cooldown: "number",
      enabled: "boolean",
      uses: "number",
    },
    required: ["trigger", "response"],
    searchField: "trigger",
    logLabel: (values) => `Bot komutu: ${values.trigger}`,
  },
  alerts: {
    label: "Uyarı kuralı",
    table: alertRules as never,
    fields: {
      name: "text",
      eventType: "select",
      giftName: "text",
      threshold: "number",
      action: "select",
      message: "text",
      sound: "select",
      enabled: "boolean",
      triggerCount: "number",
    },
    required: ["name", "threshold"],
    searchField: "name",
    logLabel: (values) => `Uyarı kuralı: ${values.name}`,
  },
  overlays: {
    label: "Overlay",
    table: overlays as never,
    fields: {
      name: "text",
      slug: "text",
      kind: "select",
      username: "text",
      accent: "select",
      goal: "number",
      enabled: "boolean",
    },
    required: ["name"],
    searchField: "name",
    filterField: "kind",
    beforeWrite: (values) => ({
      ...values,
      ...(values.slug ? { slug: slugify(String(values.slug)) } : { slug: slugify(String(values.name ?? "overlay")) }),
    }),
    logLabel: (values) => `Overlay kaydedildi: ${values.name}`,
  },
  revenue: {
    label: "Gelir kaydı",
    table: revenueEntries as never,
    fields: {
      creatorId: "number",
      source: "select",
      amount: "number",
      currency: "select",
      diamonds: "number",
      commission: "number",
      status: "select",
      period: "text",
      note: "text",
    },
    required: ["amount"],
    searchField: "source",
    filterField: "status",
    logLabel: (values) => `Gelir kaydı: ${values.amount}`,
  },
  library: {
    label: "Kütüphane",
    table: libraryItems as never,
    fields: {
      name: "text",
      repo: "text",
      packageName: "text",
      language: "select",
      category: "select",
      description: "textarea",
      install: "text",
      integration: "select",
      momentum: "select",
      docsUrl: "text",
    },
    required: ["name"],
    searchField: "name",
    filterField: "category",
    logLabel: (values) => `Kütüphane kaydı: ${values.name}`,
  },
  "live-sessions": {
    label: "Canlı oturum",
    table: liveSessions as never,
    fields: {
      username: "text",
      title: "text",
      mode: "select",
      status: "select",
      viewers: "number",
      diamonds: "number",
    },
    required: ["username"],
    searchField: "username",
    filterField: "status",
  },
};

export function getResource(name: string): ResourceConfig | null {
  return configs[name] ?? null;
}

function coerce(value: unknown, type: FieldType): unknown {
  if (value === "" || value === undefined) return type === "number" ? 0 : type === "boolean" ? false : "";
  switch (type) {
    case "number":
      return Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;
    case "boolean":
      return value === true || value === "true" || value === "on" || value === 1;
    default:
      return String(value);
  }
}

function sanitize(
  cfg: ResourceConfig,
  body: Record<string, unknown>,
  partial: boolean,
): { values: Record<string, unknown>; missing: string[] } {
  const values: Record<string, unknown> = {};
  for (const [key, type] of Object.entries(cfg.fields)) {
    if (!(key in body)) continue;
    values[key] = coerce(body[key], type);
  }
  const missing = partial ? [] : cfg.required.filter((key) => !values[key]);
  return { values: cfg.beforeWrite ? cfg.beforeWrite(values) : values, missing };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type LooseTable = Record<string, any>;

export async function listResource(
  name: string,
  query: Record<string, string>,
): Promise<{ rows: Record<string, unknown>[]; error?: string }> {
  const cfg = getResource(name);
  if (!cfg) return { rows: [], error: "Bilinmeyen kaynak" };
  const table = cfg.table as unknown as LooseTable;
  const conditions: SQL[] = [];
  const search = query.q?.trim();
  if (search && cfg.searchField && table[cfg.searchField]) {
    conditions.push(ilike(table[cfg.searchField], `%${search}%`));
  }
  if (query.status) {
    const statusCol = table.status ?? table.liveStatus;
    if (statusCol) conditions.push(eq(statusCol, query.status));
  }
  if (query.filter && cfg.filterField && table[cfg.filterField]) {
    conditions.push(eq(table[cfg.filterField], query.filter));
  }
  for (const key of ["username", "slug", "sessionId"]) {
    if (query[key] && table[key]) {
      conditions.push(eq(table[key], key === "sessionId" ? Number(query[key]) : query[key]));
    }
  }
  try {
    const builder = db.select().from(cfg.table as never) as any;
    const rows = (await builder
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(table.id))
      .limit(Math.min(Number(query.limit) || 200, 500))) as Record<string, unknown>[];
    return { rows: [...rows].reverse() };
  } catch (error) {
    return { rows: [], error: `Liste alınamadı: ${(error as Error).message}` };
  }
}

export async function createResource(name: string, body: Record<string, unknown>) {
  const cfg = getResource(name);
  if (!cfg) return { error: "Bilinmeyen kaynak", status: 404 };
  const { values, missing } = sanitize(cfg, body, false);
  if (missing.length) return { error: `Zorunlu alanlar: ${missing.join(", ")}`, status: 400 };
  const rows = (await db
    .insert(cfg.table as never)
    .values(values as never)
    .returning()) as unknown as Array<Record<string, unknown>>;
  if (cfg.logLabel) {
    await db.insert(activityLog).values({
      kind: name,
      message: cfg.logLabel(values),
      meta: { resource: name },
    });
  }
  return { row: rows[0], status: 201 };
}

export async function updateResource(name: string, id: number, body: Record<string, unknown>) {
  const cfg = getResource(name);
  if (!cfg) return { error: "Bilinmeyen kaynak", status: 404 };
  const { values } = sanitize(cfg, body, true);
  if (Object.keys(values).length === 0) return { error: "Güncellenecek alan yok", status: 400 };
  const table = cfg.table as unknown as LooseTable;
  const rows = (await db
    .update(cfg.table as never)
    .set(values as never)
    .where(eq(table.id, id))
    .returning()) as unknown as Array<Record<string, unknown>>;
  if (!rows[0]) return { error: "Kayıt bulunamadı", status: 404 };
  return { row: rows[0], status: 200 };
}

export async function deleteResource(name: string, id: number) {
  const cfg = getResource(name);
  if (!cfg) return { error: "Bilinmeyen kaynak", status: 404 };
  const table = cfg.table as unknown as LooseTable;
  const rows = (await db
    .delete(cfg.table as never)
    .where(eq(table.id, id))
    .returning()) as unknown as Array<Record<string, unknown>>;
  if (!rows[0]) return { error: "Kayıt bulunamadı", status: 404 };
  await db.insert(activityLog).values({
    kind: name,
    message: `${cfg.label} silindi (#${id}).`,
    meta: { resource: name },
  });
  return { row: rows[0], status: 200 };
}

export const resourceList = Object.entries(configs).map(([key, cfg]) => ({
  key,
  label: cfg.label,
  fields: cfg.fields,
  required: cfg.required,
}));

