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

export async function loadLastSync(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LAST_SYNC_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}
export async function saveLastSync(millis: number) { await AsyncStorage.setItem(LAST_SYNC_KEY, String(millis)); }

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
export function formatDuration(seconds: number, lang: 'th' | 'en' = 'th', precise = false) { if (seconds < 60) return lang === 'th' ? `${seconds} วินาที` : `${seconds} sec`; if (precise) { const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = seconds % 60; if (lang === 'th') return `${h > 0 ? `${h} ชม. ` : ''}${m > 0 ? `${m} นาที ` : ''}${s > 0 ? `${s} วินาที` : ''}`.trim(); return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m ` : ''}${s > 0 ? `${s}s` : ''}`.trim(); } const minutes = Math.round(seconds / 60); if (minutes < 60) return lang === 'th' ? `${minutes} นาที` : `${minutes} min`; const hours = Math.floor(minutes / 60); const remainder = minutes % 60; if (lang === 'th') return remainder ? `${hours} ชม. ${remainder} นาที` : `${hours} ชม.`; return remainder ? `${hours}h ${remainder}m` : `${hours}h`; }
export function coalesceSessions(sessions: UsageSession[], gapSeconds = 30): UsageSession[] {
  const sorted = [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const out: UsageSession[] = [];
  for (const item of sorted) {
    const last = out[out.length - 1];
    const gap = last ? (new Date(item.startedAt).getTime() - new Date(last.endedAt).getTime()) / 1000 : Infinity;
    if (last && last.packageName === item.packageName && gap <= gapSeconds) {
      if (item.endedAt > last.endedAt) last.endedAt = item.endedAt;
      last.durationSeconds = Math.max(0, Math.round((new Date(last.endedAt).getTime() - new Date(last.startedAt).getTime()) / 1000));
      last.id = `${last.packageName}-${last.startedAt}-${last.endedAt}`;
    } else out.push({ ...item });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
