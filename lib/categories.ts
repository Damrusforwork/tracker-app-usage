export type Category = 'social' | 'video' | 'shopping' | 'finance' | 'media' | 'games' | 'productivity' | 'other';

export const CATEGORY_ORDER: Category[] = ['social', 'video', 'shopping', 'finance', 'media', 'games', 'productivity', 'other'];

type Rule = { category: Category; packages: string[]; names: string[] };

// Known packages only. Name match is a whole token, so "line" does not catch "online".
const RULES: Rule[] = [
  { category: 'shopping', packages: ['com.shopee', 'com.lazada.android'], names: ['shopee', 'lazada'] },
  {
    category: 'finance',
    packages: ['com.kasikorn.retail.mbanking.wap', 'com.scb.phone', 'com.tmbbank.client.mobile', 'com.krungsri.kma', 'ktbcs.netbank', 'com.gsb.mbanking', 'th.co.truemoney.wallet'],
    names: ['kplus', 'scb', 'ttb', 'krungsri', 'krungthai', 'gsb', 'truemoney'],
  },
  {
    category: 'media',
    packages: ['com.spotify.music', 'com.google.android.apps.youtube.music', 'com.tencent.ibg.joox', 'com.sec.android.app.camera', 'com.google.android.GoogleCamera', 'com.google.android.apps.photos', 'com.sec.android.gallery3d'],
    names: ['spotify', 'joox', 'camera', 'gallery'],
  },
  { category: 'video', packages: ['com.google.android.youtube', 'com.netflix.mediaclient'], names: ['youtube', 'netflix'] },
  {
    category: 'social',
    packages: ['com.facebook', 'com.instagram', 'jp.naver.line.android', 'com.whatsapp', 'org.telegram.messenger', 'com.twitter.android', 'com.ss.android.ugc.trill', 'com.zhiliaoapp.musically', 'com.ss.android.ugc.aweme', 'com.snapchat.android'],
    names: ['facebook', 'messenger', 'instagram', 'tiktok', 'whatsapp', 'telegram', 'threads', 'line'],
  },
  { category: 'games', packages: ['com.tencent.ig', 'com.garena.game.kgth', 'com.mojang.minecraftpe'], names: ['pubg', 'roblox', 'minecraft', 'genshin', 'freefire', 'mlbb'] },
  {
    category: 'productivity',
    packages: ['com.google.android.gm', 'com.google.android.calendar', 'com.google.android.apps.docs', 'com.google.android.apps.tachyon', 'com.google.android.apps.maps', 'com.microsoft.office.outlook', 'com.microsoft.teams', 'us.zoom.videomeetings', 'notion.id'],
    names: ['gmail', 'outlook', 'notion'],
  },
];

function matches(packageName: string, appName: string, rule: Rule): boolean {
  const pkg = packageName.toLowerCase();
  if (rule.packages.some((name) => pkg === name || pkg.startsWith(`${name}.`))) return true;
  const tokens = new Set(appName.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  return rule.names.some((name) => tokens.has(name));
}

export function categoryOf(packageName: string, appName: string): Category {
  return RULES.find((rule) => matches(packageName, appName, rule))?.category ?? 'other';
}

export function emptyCategoryTotals(): Record<Category, number> {
  return { social: 0, video: 0, shopping: 0, finance: 0, media: 0, games: 0, productivity: 0, other: 0 };
}

export const CATEGORY_BAR: Record<Category, string> = {
  social: '#e74c3c',
  video: '#e67e22',
  shopping: '#16a085',
  finance: '#1f8a4c',
  media: '#d35400',
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
