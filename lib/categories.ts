export type Category = 'social' | 'games' | 'productivity' | 'other';

const SOCIAL = ['line', 'facebook', 'instagram', 'tiktok', 'messenger', 'whatsapp', 'telegram', 'threads', 'twitter', 'x.com', 'shopee', 'lazada', 'youtube', 'netflix'];
const GAMES = ['game', 'pubg', 'rov', 'candy', 'crush', 'chess', 'minecraft', 'roblox', 'genshin', 'mlbb', 'freefire', 'playgames'];
const PRODUCTIVITY = ['gmail', 'calendar', 'notion', 'notes', 'docs', 'drive', 'sheets', 'slides', 'maps', 'mail', 'outlook', 'teams', 'zoom', 'meet', 'keyboard', 'calculator', 'clock', 'settings', 'files'];

export function categoryOf(packageName: string, appName: string): Category {
  const hay = `${packageName} ${appName}`.toLowerCase();
  if (SOCIAL.some((k) => hay.includes(k))) return 'social';
  if (GAMES.some((k) => hay.includes(k))) return 'games';
  if (PRODUCTIVITY.some((k) => hay.includes(k))) return 'productivity';
  return 'other';
}

export const CATEGORY_BAR: Record<Category, string> = {
  social: '#e74c3c',
  games: '#9b59b6',
  productivity: '#3498db',
  other: '#95a5a6',
};

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
