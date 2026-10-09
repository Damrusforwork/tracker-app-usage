import AsyncStorage from '@react-native-async-storage/async-storage';
import { UsageSession } from './usage';

export type Lang = 'th' | 'en';
export type ThemeChoice = 'system' | 'light' | 'dark';
export type RetentionDays = 7 | 30 | 90 | 0;

export type Prefs = {
  theme: ThemeChoice;
  lang: Lang;
  retention: RetentionDays;
  notifyDaily: boolean;
};

export const DEFAULT_PREFS: Prefs = { theme: 'system', lang: 'th', retention: 30, notifyDaily: false };
const PREFS_KEY = '@app-usage-tracker/prefs';

export async function loadPrefs(): Promise<Prefs> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch { return DEFAULT_PREFS; }
}

export async function savePrefs(prefs: Prefs) {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export function pruneSessions(sessions: UsageSession[], retention: RetentionDays, now = new Date()): UsageSession[] {
  if (retention === 0) return sessions;
  const cutoff = now.getTime() - retention * 86400000;
  return sessions.filter((s) => new Date(s.startedAt).getTime() >= cutoff);
}

const th = {
  journal: 'APP USAGE JOURNAL',
  titleToday: 'วันนี้ของคุณ',
  titleApps: 'แอปที่ใช้',
  titleHistory: 'ประวัติ',
  titleSettings: 'ตั้งค่า',
  titleCalendar: 'ปฏิทิน',
  onDevice: 'บนเครื่อง',
  loading: 'กำลังโหลดข้อมูลจากเครื่อง…',
  heroLabel: 'เวลาที่ใช้ทั้งหมด',
  unitApps: 'แอป',
  unitLaunches: 'ครั้งที่เปิด',
  realData: 'ข้อมูลจริง',
  noAccess: 'ยังไม่อนุญาต',
  overviewToday: 'ภาพรวมวันนี้',
  statApps: 'แอปที่เปิด',
  statLaunches: 'ครั้งที่เปิด',
  statAvg: 'เฉลี่ยต่อครั้ง',
  zeroMin: '0 นาที',
  appsUsed: 'แอปที่ใช้งาน',
  sortedToday: 'เรียงตามเวลาที่ใช้วันนี้',
  refreshBusy: 'กำลังอ่านข้อมูลจริง…',
  refreshIdle: 'รีเฟรชข้อมูลจาก Android',
  footnoteAccess: 'ไปที่ ตั้งค่า → เปิด Usage Access เพื่ออ่านข้อมูลจริงจากโทรศัพท์',
  empty: 'ยังไม่มีข้อมูลการใช้งาน',
  showAll: 'ดูทั้งหมด',
  collapse: 'ย่อลง',
  vsYesterdayUp: 'มากกว่าเมื่อวาน',
  vsYesterdayDown: 'น้อยกว่าเมื่อวาน',
  vsYesterdaySame: 'เท่าเมื่อวาน',
  trend7d: 'แนวโน้ม 7 วัน',
  categoryTitle: 'หมวดหมู่',
  catSocial: 'โซเชียล',
  catGames: 'เกม',
  catProductivity: 'งาน',
  catOther: 'อื่นๆ',
  insightTitle: 'สรุปวันนี้',
  searchApps: 'ค้นหาแอป…',
  sortTime: 'เวลา',
  sortLaunches: 'ครั้ง',
  sortName: 'ชื่อ',
  sortRecent: 'ล่าสุด',
  appDetail: 'รายละเอียดแอป',
  sessionsList: 'เซสชันล่าสุด',
  avgPerLaunch: 'เฉลี่ยต่อครั้ง',
  totalTime: 'เวลารวม',
  launches: 'ครั้งที่เปิด',
  back: 'ย้อนกลับ',
  lastOpened: 'ล่าสุด',
  sessionDetail: 'รายละเอียดเซสชัน',
  startedAt: 'เริ่ม',
  endedAt: 'จบ',
  duration: 'ระยะเวลา',
  viewApp: 'ดูแอปนี้',
  close: 'ปิด',
  daySummary: 'สรุปวันนี้',
  topApps: 'แอปที่ใช้มากสุด',
  timeline24h: 'ไทม์ไลน์ 24 ชม.',
  noDataDay: 'วันนี้ไม่มีข้อมูล',
  settingsAppearance: 'การแสดงผล',
  settingsDark: 'โหมดมืด',
  settingsSystem: 'ตามระบบ',
  settingsLight: 'สว่าง',
  settingsDarkMode: 'มืด',
  settingsNotify: 'การแจ้งเตือน',
  settingsDailySummary: 'สรุปยอดรายวัน',
  settingsDailySummaryDetail: 'แจ้งเตือนเวลารวมทุกวัน 21:00',
  settingsData: 'ข้อมูล',
  settingsRetention: 'เก็บข้อมูลย้อนหลัง',
  settingsRetentionDetail: 'ลบเซสชันเก่าอัตโนมัติ',
  retentionUnlimited: 'ไม่จำกัด',
  retentionDays: 'วัน',
  settingsLang: 'ภาษา',
  settingsLangDetail: 'Thai / English',
  settingsPrivacy: 'ความเป็นส่วนตัว',
  privacyBody: 'ข้อมูลการใช้งานจะถูกประมวลผลและเก็บไว้บนอุปกรณ์นี้เท่านั้น TRACE จะไม่ส่งประวัติการใช้แอปขึ้น server โดยอัตโนมัติ',
  settingsDebug: 'ดีบัก',
  debugSessions: 'เซสชันทั้งหมด',
  debugStorage: 'ขนาดข้อมูล',
  debugQuery: 'เวลาอ่านล่าสุด',
  permTitleOn: 'Usage Access เปิดอยู่',
  permTitleOff: 'เชื่อมต่อ Usage Access',
  permBody: 'อนุญาตให้ TRACE อ่าน event การเปิด–ปิดแอป เพื่อคำนวณ session บนอุปกรณ์',
  permButton: 'เปิดการตั้งค่า Android',
  readFail: 'อ่านข้อมูลไม่สำเร็จ',
  readFailBody: 'ไม่สามารถอ่าน Android Usage Access ได้',
  jumpToday: 'วันนี้',
  staleData: 'ข้อมูลอาจไม่อัปเดต — สิทธิ์ Usage Access ถูกปิด',
};

export type Strings = typeof th;

const en: Strings = {
  journal: 'APP USAGE JOURNAL',
  titleToday: 'Your Today',
  titleApps: 'Apps',
  titleHistory: 'History',
  titleSettings: 'Settings',
  titleCalendar: 'Calendar',
  onDevice: 'On-device',
  loading: 'Loading data from device…',
  heroLabel: 'Total screen time',
  unitApps: 'apps',
  unitLaunches: 'launches',
  realData: 'real data',
  noAccess: 'not granted',
  overviewToday: "Today's overview",
  statApps: 'Apps opened',
  statLaunches: 'Launches',
  statAvg: 'Avg per launch',
  zeroMin: '0 min',
  appsUsed: 'Apps used',
  sortedToday: 'Sorted by time used today',
  refreshBusy: 'Reading real data…',
  refreshIdle: 'Refresh from Android',
  footnoteAccess: 'Go to Settings → enable Usage Access to read real phone data',
  empty: 'No usage data yet',
  showAll: 'Show all',
  collapse: 'Collapse',
  vsYesterdayUp: 'more than yesterday',
  vsYesterdayDown: 'less than yesterday',
  vsYesterdaySame: 'same as yesterday',
  trend7d: '7-day trend',
  categoryTitle: 'Categories',
  catSocial: 'Social',
  catGames: 'Games',
  catProductivity: 'Work',
  catOther: 'Other',
  insightTitle: "Today's insight",
  searchApps: 'Search apps…',
  sortTime: 'Time',
  sortLaunches: 'Count',
  sortName: 'Name',
  sortRecent: 'Recent',
  appDetail: 'App details',
  sessionsList: 'Recent sessions',
  avgPerLaunch: 'Avg per launch',
  totalTime: 'Total time',
  launches: 'Launches',
  back: 'Back',
  lastOpened: 'Last',
  sessionDetail: 'Session details',
  startedAt: 'Start',
  endedAt: 'End',
  duration: 'Duration',
  viewApp: 'View app',
  close: 'Close',
  daySummary: 'Day summary',
  topApps: 'Top apps',
  timeline24h: '24h timeline',
  noDataDay: 'No data this day',
  settingsAppearance: 'Appearance',
  settingsDark: 'Dark mode',
  settingsSystem: 'System',
  settingsLight: 'Light',
  settingsDarkMode: 'Dark',
  settingsNotify: 'Notifications',
  settingsDailySummary: 'Daily summary',
  settingsDailySummaryDetail: 'Notify total time daily at 21:00',
  settingsData: 'Data',
  settingsRetention: 'Keep history',
  settingsRetentionDetail: 'Auto-delete old sessions',
  retentionUnlimited: 'Unlimited',
  retentionDays: 'days',
  settingsLang: 'Language',
  settingsLangDetail: 'Thai / English',
  settingsPrivacy: 'Privacy',
  privacyBody: 'Usage data is processed and stored on this device only. TRACE never uploads app history to any server automatically.',
  settingsDebug: 'Debug',
  debugSessions: 'Total sessions',
  debugStorage: 'Storage size',
  debugQuery: 'Last query time',
  permTitleOn: 'Usage Access is on',
  permTitleOff: 'Connect Usage Access',
  permBody: 'Allow TRACE to read app open–close events to compute sessions on-device',
  permButton: 'Open Android settings',
  readFail: 'Read failed',
  readFailBody: 'Cannot read Android Usage Access',
  jumpToday: 'Today',
  staleData: 'Data may be stale — Usage Access permission is off',
};

export function getStrings(lang: Lang): Strings {
  return lang === 'en' ? en : th;
}
