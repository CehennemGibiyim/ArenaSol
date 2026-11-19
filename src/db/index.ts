import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type ArenaDatabase = NodePgDatabase<typeof schema>;

/** Cloudflare Workers kalıcı bir TCP havuzu tutamaz; küçük havuz yeterlidir. */
const IS_WORKERS =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

const store = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsDb?: ArenaDatabase;
};

function connectionString(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : undefined;
}

/** Veritabanı tanımlı mı? Panel DATABASE_URL olmadan da açılır, veriler boş görünür. */
export function isDatabaseConfigured(): boolean {
  return Boolean(connectionString());
}

function isLocalHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function getPool(): Pool {
  if (store.__arenaNextJsPostgresqlPool) return store.__arenaNextJsPostgresqlPool;
  const url = connectionString();
  if (!url) {
    throw new Error(
      "DATABASE_URL tanımlı değil. Panel açılır ancak veritabanı gerektiren bölümler boş görünür.",
    );
  }
  const remote = !isLocalHost(url);
  const pool = new Pool({
    connectionString: url,
    max: IS_WORKERS ? 5 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
    // Yönetilen Postgres sağlayıcıları (Supabase/Neon) TLS ister. URL'de sslmode
    // varsa bağlantı dizesi kazanır.
    ssl: remote && !/[?&]sslmode=/i.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  pool.on("error", () => {
    /* Boştaki bağlantı hataları istekleri düşürmesin. */
  });
  store.__arenaNextJsPostgresqlPool = pool;
  return pool;
}

export function getDb(): ArenaDatabase {
  if (!store.__arenaNextJsDb) {
    store.__arenaNextJsDb = drizzle(getPool(), { schema });
  }
  return store.__arenaNextJsDb;
}

/**
 * Drizzle istemcisi tembel çözülür: modül yüklenirken bağlantı kurulmaz.
 * Böylece `next build` sayfa verisi toplarken ve DATABASE_URL yokken de çalışır.
 */
export const db: ArenaDatabase = new Proxy({} as ArenaDatabase, {
  get(_target, prop) {
    const instance = getDb();
    const value = Reflect.get(instance as object, prop, instance);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(instance)
      : value;
  },
});
