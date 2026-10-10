import AsyncStorage from '@react-native-async-storage/async-storage';

export type UsageSession = {
  id: string;
  packageName: string;
  appName: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
};

const STORAGE_KEY = '@app-usage-tracker/sessions';
const LAST_SYNC_KEY = '@app-usage-tracker/lastSync';
const BACKFILL_KEY = '@app-usage-tracker/backfillDays';

export async function loadLastSync(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}
export async function saveLastSync(millis: number) { await AsyncStorage.setItem(LAST_SYNC_KEY, String(millis)); }
export async function loadBackfillDays(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(BACKFILL_KEY);
  const value = raw == null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}
export async function saveBackfillDays(days: number) { await AsyncStorage.setItem(BACKFILL_KEY, String(days)); }

export async function loadSessions(): Promise<UsageSession[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
export async function saveSessions(sessions: UsageSession[]) { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions)); }
export function mergeSessions(existing: UsageSession[], incoming: UsageSession[]) { const map = new Map(existing.map((session) => [session.id, session])); incoming.forEach((session) => map.set(session.id, session)); return Array.from(map.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt)); }
export function mergeWindow(existing: UsageSession[], incoming: UsageSession[], windowStartMillis: number) { const kept = existing.filter((item) => new Date(item.startedAt).getTime() < windowStartMillis); return mergeSessions(kept, incoming); }
export function sameDay(value: string, date = new Date()) { const source = new Date(value); return source.getDate() === date.getDate() && source.getMonth() === date.getMonth() && source.getFullYear() === date.getFullYear(); }
export function isDisplayable(session: UsageSession) { return session.appName.length > 0 && !session.appName.includes('.'); }
export function summarizePackage(sessions: UsageSession[], packageName: string) {
  const list = sessions.filter((item) => item.packageName === packageName);
  if (list.length === 0) return null;
  return {
    packageName,
    appName: list[0].appName,
    launches: list.length,
    totalSeconds: list.reduce((n, item) => n + item.durationSeconds, 0),
    lastOpened: list.reduce((m, item) => (item.startedAt > m ? item.startedAt : m), list[0].startedAt),
    sessions: [...list].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  };
}
export function formatDuration(seconds: number, lang: 'th' | 'en' = 'th', precise = false) { if (seconds < 60) return lang === 'th' ? `${seconds} วินาที` : `${seconds} sec`; if (precise) { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; if (lang === 'th') return `${h > 0 ? `${h} ชม. ` : ''}${m > 0 ? `${m} นาที ` : ''}${s > 0 ? `${s} วินาที` : ''}`.trim(); return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m ` : ''}${s > 0 ? `${s}s` : ''}`.trim(); } const minutes = Math.floor(seconds / 60); if (minutes < 60) return lang === 'th' ? `${minutes} นาที` : `${minutes} min`; const hours = Math.floor(minutes / 60); const remainder = minutes % 60; if (lang === 'th') return remainder ? `${hours} ชม. ${remainder} นาที` : `${hours} ชม.`; return remainder ? `${hours}h ${remainder}m` : `${hours}h`; }
const DAY_MS = 86_400_000;

export function queryStartMillis(now: number, lastSync: number | null, retentionDays: number): number {
  const days = retentionDays === 0 ? 90 : Math.max(7, retentionDays);
  const earliest = now - days * DAY_MS;
  if (lastSync == null) return earliest;
  return Math.max(lastSync - 60_000, earliest);
}

export function syncStartMillis(now: number, lastSync: number | null, retentionDays: number, backfillDays: number | null): number {
  const needsFull = backfillDays !== retentionDays || lastSync == null;
  return queryStartMillis(now, needsFull ? null : lastSync, retentionDays);
}

export function dropLiveInWindow(existing: UsageSession[], windowStartMillis: number): UsageSession[] {
  return existing.filter((item) => !item.id.endsWith('-live') || new Date(item.startedAt).getTime() < windowStartMillis);
}

export function sliceSessionHours(session: UsageSession): { dayStart: number; hour: number; seconds: number }[] {
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.endedAt).getTime();
  const fallbackDay = new Date(Number.isFinite(start) ? start : Date.now());
  fallbackDay.setHours(0, 0, 0, 0);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return [{ dayStart: fallbackDay.getTime(), hour: new Date(start).getHours() || 0, seconds: session.durationSeconds }];
  }
  const parts: { dayStart: number; hour: number; ms: number }[] = [];
  let cursor = start;
  while (cursor < end) {
    const at = new Date(cursor);
    const day = new Date(at);
    day.setHours(0, 0, 0, 0);
    const nextHour = new Date(at);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(at.getHours() + 1);
    const boundary = Math.min(end, nextHour.getTime());
    parts.push({ dayStart: day.getTime(), hour: at.getHours(), ms: boundary - cursor });
    cursor = boundary;
  }
  const span = end - start;
  let used = 0;
  return parts.map((part, index) => {
    const seconds = index === parts.length - 1 ? Math.max(0, session.durationSeconds - used) : Math.round((session.durationSeconds * part.ms) / span);
    used += seconds;
    return { dayStart: part.dayStart, hour: part.hour, seconds };
  }).filter((part) => part.seconds > 0);
}

export function countedSecondsBefore(session: UsageSession, cutoffMs: number): number {
  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.endedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start >= cutoffMs) return 0;
  if (end <= cutoffMs) return session.durationSeconds;
  return Math.round(session.durationSeconds * ((cutoffMs - start) / (end - start)));
}

export function coalesceSessions(sessions: UsageSession[], gapSeconds = 30): UsageSession[] {
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const out: UsageSession[] = [];
  for (const item of sorted) {
    const last = out[out.length - 1];
    const gap = last ? (new Date(item.startedAt).getTime() - new Date(last.endedAt).getTime()) / 1000 : Infinity;
    if (last && last.packageName === item.packageName && gap <= gapSeconds) {
      if (item.endedAt > last.endedAt) last.endedAt = item.endedAt;
      const wall = Math.max(0, Math.round((new Date(last.endedAt).getTime() - new Date(last.startedAt).getTime()) / 1000));
      // Keep each piece's counted time. Cap at the open interval so overlap cannot grow past the clock.
      last.durationSeconds = Math.min(wall, last.durationSeconds + item.durationSeconds);
      last.id = `${last.packageName}-${last.startedAt}-${last.endedAt}`;
    } else out.push({ ...item });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
