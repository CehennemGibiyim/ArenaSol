/**
 * Tarayıcı durumu (global singleton). Next.js modül yeniden yüklemesinde bile
 * aynı nesne korunur, böylece dinleyiciler çift bağlanmaz.
 */

import type { RoomConnection } from "./tiktok";

export interface ListenerState {
  targetId: number;
  uniqueId: string;
  roomId: string;
  status: string;
  detail?: string;
  connectedAt: number;
  connection: RoomConnection | null;
}

export interface ScannerState {
  running: boolean;
  timer: NodeJS.Timeout | null;
  startedAt: Date | null;
  lastRunAt: Date | null;
  lastRunMs: number;
  checked: number;
  live: number;
  events: number;
  opportunities: number;
  lastError: string | null;
  log: string[];
  listeners: Map<number, ListenerState>;
  runInFlight: boolean;
  simulated: boolean;
}

const globalForScanner = globalThis as typeof globalThis & {
  __livemiraScanner?: ScannerState;
};

export function state(): ScannerState {
  if (!globalForScanner.__livemiraScanner) {
    globalForScanner.__livemiraScanner = {
      running: false,
      timer: null,
      startedAt: null,
      lastRunAt: null,
      lastRunMs: 0,
      checked: 0,
      live: 0,
      events: 0,
      opportunities: 0,
      lastError: null,
      log: [],
      listeners: new Map(),
      runInFlight: false,
      simulated: false,
    };
  }
  return globalForScanner.__livemiraScanner;
}

export function log(line: string) {
  const s = state();
  const stamp = new Date().toISOString().slice(11, 19);
  s.log.unshift(`[${stamp}] ${line}`);
  if (s.log.length > 80) s.log.pop();
}

export function closeListener(targetId: number) {
  const s = state();
  const l = s.listeners.get(targetId);
  if (l) {
    l.connection?.disconnect();
    s.listeners.delete(targetId);
  }
}

export function randomToken(len = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
