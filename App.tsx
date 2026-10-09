import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Animated, BackHandler, Easing, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, Text, TextInput, useColorScheme, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  coalesceSessions,
  formatDuration,
  isDisplayable,
  loadLastSync,
  loadSessions,
  mergeWindow,
  sameDay,
  saveLastSync,
  saveSessions,
  summarizePackage,
  UsageSession,
} from "./lib/usage";
import { hasUsageAccess, openUsageAccessSettings, queryNativeSessions } from "./lib/usageBridge";
import { addDays, CATEGORY_BAR, categoryOf, dayKey, startOfDay, Category } from "./lib/categories";
import { DEFAULT_PREFS, getStrings, loadPrefs, Prefs, pruneSessions, savePrefs, Strings } from "./lib/prefs";

type Tab = "today" | "apps" | "calendar" | "history" | "settings";
type AppSummary = {
  packageName: string;
  appName: string;
  launches: number;
  totalSeconds: number;
  lastOpened: string;
  sessions: UsageSession[];
};

const lightPalette = {
  ink: "#17231f",
  muted: "#66736c",
  green: "#2f6f5e",
  pale: "#e8f1ec",
  line: "#dce6df",
  warm: "#f5efe5",
  white: "#fff",
  card: "#fff",
  input: "#fff",
};

const darkPalette = {
  ink: "#e8f1ec",
  muted: "#93a39a",
  green: "#4c9a82",
  pale: "#1e2f29",
  line: "#2a3833",
  warm: "#101714",
  white: "#1a2420",
  card: "#1a2420",
  input: "#1a2420",
};

type Palette = typeof lightPalette;

const SPARK_BAR = "#2f6f5e";

function clock(value: string, lang: "th" | "en") {
  return new Date(value).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" });
}
function dayLabel(value: string, lang: "th" | "en") {
  return new Date(value).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" });
}
function fullDate(value: string | Date, lang: "th" | "en") {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "long", year: "numeric" });
}

function Reveal({
  children,
  delay = 0,
  mode = "up",
  style,
}: {
  children: ReactNode;
  delay?: number;
  mode?: "up" | "pop";
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1,
      duration: mode === "pop" ? 260 : 340,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, delay, mode]);
  const transform =
    mode === "up"
      ? [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }]
      : [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }];
  return <Animated.View style={[{ opacity: v }, { transform }, style]}>{children}</Animated.View>;
}

function LoadingScreen({ s, t }: { s: ReturnType<typeof makeStyles>; t: Strings }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 850, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [v]);
  return (
    <View style={s.loading}>
      <Animated.Text
        style={[
          s.brand,
          {
            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
            transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
          },
        ]}
      >
        TRACE
      </Animated.Text>
      <Text style={s.muted}>{t.loading}</Text>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

function Shell() {
  const insets = useSafeAreaInsets();
  const systemScheme = useColorScheme();
  const [tab, setTab] = useState<Tab>("today");
  const [sessions, setSessions] = useState<UsageSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [usageAccess, setUsageAccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [selectedApp, setSelectedApp] = useState<AppSummary | null>(null);
  const [selectedSession, setSelectedSession] = useState<UsageSession | null>(null);
  const [queryMs, setQueryMs] = useState(0);
  const [storageKB, setStorageKB] = useState(0);
  const refreshingRef = useRef(false);
  const prefsRef = useRef(DEFAULT_PREFS);
  const mountedRef = useRef(true);
  const totalRef = useRef(0);
  const today = useMemo(() => new Date(), []);
  const t = getStrings(prefs.lang);
  const dark = prefs.theme === "dark" || (prefs.theme === "system" && systemScheme === "dark");
  const colors = dark ? darkPalette : lightPalette;
  const s = useMemo(() => makeStyles(colors), [colors]);

  async function updatePrefs(patch: Partial<Prefs>) {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPrefs(next);
    await savePrefs(next);
  }

  async function persistSessions(items: UsageSession[]) {
    const pruned = coalesceSessions(pruneSessions(items, prefsRef.current.retention));
    const raw = JSON.stringify(pruned);
    setStorageKB(Math.round(raw.length / 1024));
    await saveSessions(pruned);
    setSessions(pruned);
  }

  async function refreshRealUsage() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const access = await hasUsageAccess();
      setUsageAccess(access);
      if (access) {
        const now = Date.now();
        const midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        const lastSync = await loadLastSync();
        const start = lastSync == null ? midnight.getTime() : Math.max(lastSync - 60_000, now - 7 * 86400000);
        const begin = Date.now();
        const nativeSessions = await queryNativeSessions(start, now);
        setQueryMs(Date.now() - begin);
        const current = await loadSessions();
        const updated = mergeWindow(current, nativeSessions, start);
        await persistSessions(updated);
        await saveLastSync(now);
        if (prefsRef.current.notifyDaily) await rescheduleDaily();
      }
    } catch (error) {
      if (mountedRef.current) Alert.alert(t.readFail, error instanceof Error ? error.message : t.readFailBody);
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) setRefreshing(false);
    }
  }

  async function rescheduleDaily() {
    try {
      const lang = prefsRef.current.lang;
      const tt = getStrings(lang);
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: { title: "TRACE", body: `${tt.heroLabel}: ${formatDuration(totalRef.current, lang)}` },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.CALENDAR, hour: 21, minute: 0, repeats: true },
      });
    } catch {
      // ignore
    }
  }

  async function setDailyNotify(on: boolean) {
    try {
      if (on) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(t.settingsDailySummary, t.readFailBody);
          return;
        }
        await updatePrefs({ notifyDaily: on });
        await rescheduleDaily();
      } else {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await updatePrefs({ notifyDaily: on });
      }
    } catch (error) {
      Alert.alert(t.settingsDailySummary, error instanceof Error ? error.message : t.readFailBody);
    }
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedSession) {
        setSelectedSession(null);
        return true;
      }
      if (selectedApp && tab === "apps") {
        setSelectedApp(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [selectedSession, selectedApp, tab]);

  useEffect(() => {
    const notifSub = Notifications.addNotificationResponseReceivedListener(() => {
      setSelectedApp(null);
      setTab("today");
    });
    return () => notifSub.remove();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      const p = await loadPrefs();
      if (!mountedRef.current) return;
      prefsRef.current = p;
      setPrefs(p);
      const items = await loadSessions();
      await persistSessions(items);
      if (!mountedRef.current) return;
      setLoaded(true);
      refreshRealUsage();
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const visibleSessions = useMemo(() => sessions.filter(isDisplayable), [sessions]);
  const todaySessions = useMemo(
    () => visibleSessions.filter((item) => sameDay(item.startedAt, today)),
    [visibleSessions, today],
  );
  const summaries = useMemo(() => summarize(todaySessions), [todaySessions]);
  const totalSeconds = useMemo(
    () => todaySessions.reduce((total, item) => total + item.durationSeconds, 0),
    [todaySessions],
  );
  totalRef.current = totalSeconds;

  function openApp(summary: AppSummary) {
    setSelectedApp(summary);
    setTab("apps");
  }

  function openAppByPackage(packageName: string) {
    const found =
      summaries.find((item) => item.packageName === packageName) ?? summarizePackage(visibleSessions, packageName);
    if (found) openApp(found);
    setSelectedSession(null);
  }

  if (!loaded) return <LoadingScreen s={s} t={t} />;

  const titles: Record<Tab, string> = {
    today: t.titleToday,
    apps: t.titleApps,
    calendar: t.titleCalendar,
    history: t.titleHistory,
    settings: t.titleSettings,
  };

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      <StatusBar style={dark ? "light" : "dark"} />
      <View style={s.shell}>
        <View style={[s.header, { paddingTop: 14 }]}>
          <View>
            <Text style={s.eyebrow}>{t.journal}</Text>
            <Text style={s.title}>{titles[tab]}</Text>
          </View>
          <View style={s.statusDot}>
            <View style={s.dot} />
            <Text style={s.statusText}>{t.onDevice}</Text>
          </View>
        </View>
        {tab === "history" ? (
          <HistoryList
            sessions={visibleSessions}
            bottomInset={insets.bottom}
            s={s}
            t={t}
            lang={prefs.lang}
            refreshing={refreshing}
            onRefresh={refreshRealUsage}
            onSelectSession={setSelectedSession}
          />
        ) : tab === "calendar" ? (
          <CalendarView
            sessions={visibleSessions}
            bottomInset={insets.bottom}
            s={s}
            t={t}
            c={colors}
            lang={prefs.lang}
            refreshing={refreshing}
            onRefresh={refreshRealUsage}
            onOpenApp={openApp}
            onSelectSession={setSelectedSession}
          />
        ) : (
          <ScrollView
            contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 80 }]}
            showsVerticalScrollIndicator={false}
          >
            <Reveal key={tab + prefs.lang} delay={40}>
              {tab === "today" && (
                <Today
                  totalSeconds={totalSeconds}
                  sessions={todaySessions}
                  allSessions={visibleSessions}
                  summaries={summaries}
                  usageAccess={usageAccess}
                  refreshing={refreshing}
                  onRefresh={refreshRealUsage}
                  s={s}
                  t={t}
                  lang={prefs.lang}
                />
              )}
              {tab === "apps" &&
                (selectedApp ? (
                  <AppDetail
                    summary={selectedApp}
                    allSessions={visibleSessions}
                    s={s}
                    t={t}
                    lang={prefs.lang}
                    onBack={() => setSelectedApp(null)}
                    onSelectSession={setSelectedSession}
                  />
                ) : (
                  <Apps summaries={summaries} s={s} t={t} lang={prefs.lang} onOpenApp={openApp} />
                ))}
              {tab === "settings" && (
                <Settings
                  usageAccess={usageAccess}
                  onOpenUsageAccess={async () => {
                    await openUsageAccessSettings();
                  }}
                  prefs={prefs}
                  s={s}
                  t={t}
                  stats={{ count: sessions.length, storageKB, queryMs }}
                  onTheme={(theme) => updatePrefs({ theme })}
                  onLang={(lang) => updatePrefs({ lang })}
                  onRetention={async (retention) => {
                    await updatePrefs({ retention });
                    await persistSessions(sessions);
                  }}
                  onNotify={setDailyNotify}
                />
              )}
            </Reveal>
          </ScrollView>
        )}
        <View style={[s.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {(
            [
              ["calendar", t.titleCalendar, "calendar-outline"],
              ["apps", t.titleApps, "grid-outline"],
              ["today", t.titleToday, "sunny-outline"],
              ["history", t.titleHistory, "time-outline"],
              ["settings", t.titleSettings, "settings-outline"],
            ] as [Tab, string, keyof typeof Ionicons.glyphMap][]
          ).map(([key, label, icon]) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={label}
              onPress={() => {
                if (key !== "apps") setSelectedApp(null);
                setTab(key);
              }}
              style={({ pressed }) => [s.navItem, pressed && s.navItemPressed, tab === key && s.navItemActive]}
            >
              <View style={s.navIconBox}>
                {tab === key && (
                  <Reveal mode="pop" style={StyleSheet.absoluteFill}>
                    <View style={s.navPill} />
                  </Reveal>
                )}
                <Ionicons name={icon} size={19} color={tab === key ? colors.green : colors.muted} />
              </View>
              <Text style={[s.navLabel, tab === key && s.navLabelActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {selectedSession && (
          <SessionOverlay
            session={selectedSession}
            s={s}
            t={t}
            lang={prefs.lang}
            onClose={() => setSelectedSession(null)}
            onViewApp={openAppByPackage}
          />
        )}
      </View>
    </View>
  );
}

function SparkBars({ values, s, barColor }: { values: number[]; s: ReturnType<typeof makeStyles>; barColor: string }) {
  const max = Math.max(1, ...values);
  return (
    <View style={s.sparkRow}>
      {values.map((v, i) => (
        <View key={i} style={s.sparkCol}>
          <View style={[s.sparkBar, { height: `${Math.max(4, Math.round((v / max) * 100))}%`, backgroundColor: barColor }]} />
        </View>
      ))}
    </View>
  );
}

function Today({
  totalSeconds,
  sessions,
  allSessions,
  summaries,
  usageAccess,
  refreshing,
  onRefresh,
  s,
  t,
  lang,
}: {
  totalSeconds: number;
  sessions: UsageSession[];
  allSessions: UsageSession[];
  summaries: AppSummary[];
  usageAccess: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  s: ReturnType<typeof makeStyles>;
  t: Strings;
  lang: "th" | "en";
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const ratio = Math.min(1, totalSeconds / 180);
  const visibleSummaries = showAll ? summaries : summaries.slice(0, 20);
  useEffect(() => {
    if (!barWidth) return;
    Animated.timing(progress, {
      toValue: ratio,
      duration: 750,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ratio, barWidth, progress]);

  const yesterday = useMemo(() => addDays(startOfDay(new Date()), -1), []);
  const yesterdayTotal = useMemo(
    () => allSessions.filter((item) => sameDay(item.startedAt, yesterday)).reduce((n, item) => n + item.durationSeconds, 0),
    [allSessions, yesterday],
  );
  const delta = totalSeconds - yesterdayTotal;
  const deltaPct = yesterdayTotal > 0 ? Math.round((delta / yesterdayTotal) * 100) : totalSeconds > 0 ? 100 : 0;
  const last7 = useMemo(() => {
    const base = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(base, i - 6);
      return allSessions.filter((item) => sameDay(item.startedAt, day)).reduce((n, item) => n + item.durationSeconds, 0);
    });
  }, [allSessions]);
  const catTotals = useMemo(() => {
    const totals: Record<Category, number> = { social: 0, games: 0, productivity: 0, other: 0 };
    sessions.forEach((item) => {
      totals[categoryOf(item.packageName, item.appName)] += item.durationSeconds;
    });
    return totals;
  }, [sessions]);
  const catMax = Math.max(1, catTotals.social, catTotals.games, catTotals.productivity, catTotals.other);
  const topCat: Category = (Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] as Category) ?? "other";
  const catNames: Record<Category, string> = { social: t.catSocial, games: t.catGames, productivity: t.catProductivity, other: t.catOther };

  return (
    <>
      <Reveal>
        <View style={s.hero}>
          <Text style={s.heroLabel}>{t.heroLabel}</Text>
          <Text style={s.heroNumber}>{formatDuration(totalSeconds, lang)}</Text>
          <Text style={s.heroMeta}>
            {summaries.length} {t.unitApps} · {sessions.length} {t.unitLaunches} · {usageAccess ? t.realData : t.noAccess}
          </Text>
          <Text style={s.heroDelta}>
            {delta === 0 ? t.vsYesterdaySame : `${deltaPct >= 0 ? "+" : ""}${deltaPct}% ${deltaPct >= 0 ? t.vsYesterdayUp : t.vsYesterdayDown}`}
          </Text>
          <View style={s.heroRule} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
            <Animated.View
              style={[
                s.heroFill,
                { width: barWidth || "100%" },
                {
                  transform: [
                    {
                      translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-barWidth / 2, 0] }),
                    },
                    { scaleX: progress },
                  ],
                },
              ]}
            />
          </View>
        </View>
      </Reveal>
      <SectionTitle title={t.overviewToday} s={s} />
      <Reveal delay={80}>
        <View style={s.statRow}>
          <Stat label={t.statApps} value={`${summaries.length}`} s={s} />
          <Stat label={t.statLaunches} value={`${sessions.length}`} s={s} />
          <Stat
            label={t.statAvg}
            value={sessions.length ? formatDuration(Math.round(totalSeconds / sessions.length), lang) : t.zeroMin}
            s={s}
          />
        </View>
      </Reveal>
      <SectionTitle title={t.trend7d} s={s} />
      <Reveal delay={110}>
        <View style={s.card}>
          <SparkBars values={last7} s={s} barColor={SPARK_BAR} />
        </View>
      </Reveal>
      <SectionTitle title={t.categoryTitle} s={s} />
      <Reveal delay={120}>
        <View style={s.card}>
          <View style={s.stackBar}>
            {(Object.keys(catTotals) as Category[]).map((key) =>
              catTotals[key] > 0 ? (
                <View key={key} style={{ flex: catTotals[key], backgroundColor: CATEGORY_BAR[key] }} />
              ) : null,
            )}
          </View>
          {(Object.keys(catTotals) as Category[]).map((key) => (
            <View key={key} style={s.catRow}>
              <View style={[s.catDot, { backgroundColor: CATEGORY_BAR[key] }]} />
              <Text style={s.catName}>{catNames[key]}</Text>
              <Text style={s.duration}>{formatDuration(catTotals[key], lang)}</Text>
            </View>
          ))}
        </View>
      </Reveal>
      <SectionTitle title={t.insightTitle} s={s} />
      <Reveal delay={130}>
        <View style={s.insightCard}>
          <Text style={s.insightText}>
            {catNames[topCat]} {formatDuration(catTotals[topCat], lang)}
            {delta !== 0 ? ` (${deltaPct >= 0 ? "+" : ""}${deltaPct}%)` : ""}
          </Text>
        </View>
      </Reveal>
      <SectionTitle title={t.appsUsed} action={t.showAll} s={s} />
      <Reveal delay={140}>
        <View style={s.card}>
          {summaries.length === 0 ? (
            <Empty text={t.empty} s={s} />
          ) : (
            visibleSummaries.map((item, index) => (
              <Reveal key={item.packageName} delay={180 + Math.min(index, 12) * 45}>
                <UsageRow item={item} s={s} t={t} lang={lang} />
              </Reveal>
            ))
          )}
        </View>
      </Reveal>
      {summaries.length > 20 && (
        <Pressable style={s.moreButton} onPress={() => setShowAll((prev) => !prev)}>
          <Text style={s.moreText}>{showAll ? t.collapse : `${t.showAll} ${summaries.length}`}</Text>
        </Pressable>
      )}
      <Reveal delay={200}>
        <Pressable
          style={({ pressed }) => [
            s.refreshButton,
            pressed && {
              opacity: 0.75,
              transform: [{ scale: 0.97 }],
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t.refreshIdle}
          onPress={onRefresh}
        >
          <Text style={s.refreshText}>{refreshing ? t.refreshBusy : t.refreshIdle}</Text>
        </Pressable>
      </Reveal>
      {!usageAccess && sessions.length > 0 && (
        <Reveal delay={220}>
          <View style={s.staleBanner}>
            <Text style={s.staleText}>{t.staleData}</Text>
          </View>
        </Reveal>
      )}
      {!usageAccess && <Text style={s.footnote}>{t.footnoteAccess}</Text>}
    </>
  );
}

function Apps({
  summaries,
  s,
  t,
  lang,
  onOpenApp,
}: {
  summaries: AppSummary[];
  s: ReturnType<typeof makeStyles>;
  t: Strings;
  lang: "th" | "en";
  onOpenApp: (summary: AppSummary) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"time" | "launches" | "name" | "recent">("time");
  const [cat, setCat] = useState<Category | "all">("all");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = summaries.filter(
      (item) =>
        (cat === "all" || categoryOf(item.packageName, item.appName) === cat) &&
        (q.length === 0 || item.appName.toLowerCase().includes(q)),
    );
    list = [...list].sort((a, b) => {
      if (sort === "launches") return b.launches - a.launches;
      if (sort === "name") return a.appName.localeCompare(b.appName);
      if (sort === "recent") return b.lastOpened.localeCompare(a.lastOpened);
      return b.totalSeconds - a.totalSeconds;
    });
    return list;
  }, [summaries, query, sort, cat]);
  const visibleSummaries = showAll ? filtered : filtered.slice(0, 20);
  const catNames: Record<Category | "all", string> = {
    all: t.showAll,
    social: t.catSocial,
    games: t.catGames,
    productivity: t.catProductivity,
    other: t.catOther,
  };
  return (
    <>
      <Reveal>
        <Text style={s.sectionIntro}>{t.sortedToday}</Text>
      </Reveal>
      <Reveal delay={50}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setShowAll(false);
          }}
          placeholder={t.searchApps}
          placeholderTextColor={s.muted.color as string}
        />
      </Reveal>
      <Reveal delay={60}>
        <View style={s.chipRow}>
          {(["time", "launches", "name", "recent"] as const).map((key) => (
            <Pressable key={key} style={[s.chip, sort === key && s.chipActive]} onPress={() => setSort(key)}>
              <Text style={[s.chipText, sort === key && s.chipTextActive]}>
                {key === "time" ? t.sortTime : key === "launches" ? t.sortLaunches : key === "name" ? t.sortName : t.sortRecent}
              </Text>
            </Pressable>
          ))}
        </View>
      </Reveal>
      <Reveal delay={65}>
        <View style={s.chipRow}>
          {(["all", "social", "games", "productivity", "other"] as const).map((key) => (
            <Pressable key={key} style={[s.chip, cat === key && s.chipActive]} onPress={() => setCat(key)}>
              <Text style={[s.chipText, cat === key && s.chipTextActive]}>{catNames[key]}</Text>
            </Pressable>
          ))}
        </View>
      </Reveal>
      <Reveal delay={70}>
        <View style={s.card}>
          {visibleSummaries.length === 0 ? (
            <Empty text={t.empty} s={s} />
          ) : (
            visibleSummaries.map((item, index) => (
              <Reveal key={item.packageName} delay={110 + Math.min(index, 12) * 45}>
                <UsageRow item={item} detailed s={s} t={t} lang={lang} onPress={() => onOpenApp(item)} />
              </Reveal>
            ))
          )}
        </View>
      </Reveal>
      {filtered.length > 20 && (
        <Pressable style={s.moreButton} onPress={() => setShowAll((prev) => !prev)}>
          <Text style={s.moreText}>{showAll ? t.collapse : `${t.showAll} ${filtered.length}`}</Text>
        </Pressable>
      )}
    </>
  );
}

function AppDetail({
  summary,
  allSessions,
  s,
  t,
  lang,
  onBack,
  onSelectSession,
}: {
  summary: AppSummary;
  allSessions: UsageSession[];
  s: ReturnType<typeof makeStyles>;
  t: Strings;
  lang: "th" | "en";
  onBack: () => void;
  onSelectSession: (session: UsageSession) => void;
}) {
  const pkgSessions = useMemo(
    () =>
      allSessions
        .filter((item) => item.packageName === summary.packageName)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [allSessions, summary.packageName],
  );
  const total = pkgSessions.reduce((n, item) => n + item.durationSeconds, 0);
  const avg = pkgSessions.length ? Math.round(total / pkgSessions.length) : 0;
  const last7 = useMemo(() => {
    const base = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(base, i - 6);
      return pkgSessions.filter((item) => sameDay(item.startedAt, day)).reduce((n, item) => n + item.durationSeconds, 0);
    });
  }, [pkgSessions]);
  const hourSections = useMemo(
    () => groupByDayHour(pkgSessions.slice(0, 60), lang),
    [pkgSessions, lang],
  );
  return (
    <>
      <Pressable style={s.moreButton} onPress={onBack}>
        <Text style={s.moreText}>‹ {t.back}</Text>
      </Pressable>
      <Reveal>
        <View style={s.hero}>
          <Text style={s.heroLabel}>{t.appDetail}</Text>
          <Text style={s.heroNumber}>{summary.appName}</Text>
          <Text style={s.heroMeta}>
            {t.totalTime} {formatDuration(total, lang)} · {pkgSessions.length} {t.unitLaunches}
          </Text>
        </View>
      </Reveal>
      <SectionTitle title={t.trend7d} s={s} />
      <Reveal delay={70}>
        <View style={s.card}>
          <SparkBars values={last7} s={s} barColor={SPARK_BAR} />
        </View>
      </Reveal>
      <SectionTitle title={t.sessionsList} s={s} />
      <Reveal delay={100}>
        <View style={s.card}>
          <View style={s.statRow}>
            <Stat label={t.avgPerLaunch} value={formatDuration(avg, lang)} s={s} />
            <Stat label={t.launches} value={`${pkgSessions.length}`} s={s} />
          </View>
        </View>
      </Reveal>
      {hourSections.map((section) => (
        <View key={section.title}>
          <Text style={s.historyDay}>{section.title}</Text>
          {section.data.map((group) => (
            <HourGroupItem
              key={`${section.title}-${group.hour}`}
              groupKey={`${section.title}-${group.hour}`}
              group={group}
              showAppName={false}
              s={s}
              t={t}
              lang={lang}
              onSelectSession={onSelectSession}
            />
          ))}
        </View>
      ))}
    </>
  );
}

type HourGroup = { hour: number; sessions: UsageSession[]; total: number };
type DaySections = { title: string; data: HourGroup[] }[];

function groupByDayHour(sessions: UsageSession[], lang: "th" | "en"): DaySections {
  const byDay = new Map<string, UsageSession[]>();
  sessions.forEach((item) => {
    const key = dayLabel(item.startedAt, lang);
    const list = byDay.get(key);
    if (list) list.push(item);
    else byDay.set(key, [item]);
  });
  return [...byDay].map(([day, items]) => {
    const byHour = new Map<number, UsageSession[]>();
    items.forEach((item) => {
      const hour = new Date(item.startedAt).getHours();
      const list = byHour.get(hour);
      if (list) list.push(item);
      else byHour.set(hour, [item]);
    });
    const data = [...byHour]
      .map(([hour, list]) => ({ hour, sessions: list, total: list.reduce((n, s) => n + s.durationSeconds, 0) }))
      .sort((a, b) => b.hour - a.hour);
    return { title: day, data };
  });
}

function hourLabel(hour: number) {
  const start = String(hour).padStart(2, "0");
  const end = String((hour + 1) % 24).padStart(2, "0");
  return `${start}:00 – ${end}:00`;
}

function HourGroupItem({
  groupKey,
  group,
  showAppName,
  s,
  t,
  lang,
  onSelectSession,
}: {
  groupKey: string;
  group: HourGroup;
  showAppName: boolean;
  s: ReturnType<typeof makeStyles>;
  t: Strings;
  lang: "th" | "en";
  onSelectSession: (session: UsageSession) => void;
}) {
  const [open, setOpen] = useState(false);
  const top = group.sessions.reduce((a, b) => (b.durationSeconds > a.durationSeconds ? b : a));
  const appCount = new Set(group.sessions.map((sub) => sub.packageName)).size;
  return (
    <View>
      <Pressable
        style={s.sessionCard}
        accessibilityRole="button"
        accessibilityLabel={`${hourLabel(group.hour)} ${formatDuration(group.total, lang, true)}`}
        onPress={() => setOpen((prev) => !prev)}
      >
        <View>
          <Text style={s.appName}>
            {hourLabel(group.hour)} {open ? "▾" : "▸"}
          </Text>
          <Text style={s.muted}>
            {showAppName ? `${top.appName} · ` : ""}
            {appCount} {t.unitApps} · {group.sessions.length} {t.unitLaunches}
          </Text>
        </View>
        <Text style={s.duration}>{formatDuration(group.total, lang, true)}</Text>
      </Pressable>
      {open &&
        group.sessions.map((sub) => (
          <Pressable
            key={`${groupKey}-${sub.id}`}
            style={[s.sessionCard, s.sessionSub]}
            onPress={() => onSelectSession(sub)}
          >
            <View>
              <Text style={s.appName}>{sub.appName}</Text>
              <Text style={s.muted}>
                {clock(sub.startedAt, lang)} – {clock(sub.endedAt, lang)}
              </Text>
            </View>
            <Text style={s.duration}>{formatDuration(sub.durationSeconds, lang, true)}</Text>
          </Pressable>
        ))}
    </View>
  );
}

function HistoryList({
  sessions,
  bottomInset,
  s,
  t,
  lang,
  refreshing,
  onRefresh,
  onSelectSession,
}: {
  sessions: UsageSession[];
  bottomInset: number;
  s: ReturnType<typeof makeStyles>;
  t: Strings;
  lang: "th" | "en";
  refreshing: boolean;
  onRefresh: () => void;
  onSelectSession: (session: UsageSession) => void;
}) {
  const sections = useMemo(() => groupByDayHour(sessions, lang), [sessions, lang]);
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => `h${item.hour}`}
      style={s.historyList}
      contentContainerStyle={[s.content, { paddingBottom: bottomInset + 80 }]}
      initialNumToRender={30}
      maxToRenderPerBatch={20}
      windowSize={7}
      removeClippedSubviews
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={<Empty text={t.empty} s={s} />}
      renderSectionHeader={({ section }) => (
        <View style={s.historyGroup}>
          <Text style={s.historyDay}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item, section }) => (
        <HourGroupItem
          groupKey={`${section.title}-${item.hour}`}
          group={item}
          showAppName
          s={s}
          t={t}
          lang={lang}
          onSelectSession={onSelectSession}
        />
      )}
    />
  );
}

function Timeline({
  sessions,
  dayStart,
  dayEnd,
  s,
  onSelectSession,
}: {
  sessions: UsageSession[];
  dayStart: number;
  dayEnd: number;
  s: ReturnType<typeof makeStyles>;
  onSelectSession: (session: UsageSession) => void;
}) {
  const sorted = useMemo(() => [...sessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt)), [sessions]);
  const blocks: ReactNode[] = [];
  let cursor = dayStart;
  sorted.forEach((item) => {
    const start = Math.max(dayStart, new Date(item.startedAt).getTime());
    const end = Math.min(dayEnd, new Date(item.endedAt).getTime());
    if (end <= start) return;
    if (start > cursor) blocks.push(<View key={`g${cursor}`} style={{ flex: Math.max(1, (start - cursor) / 60000) }} />);
    blocks.push(
      <Pressable
        key={item.id}
        style={{ flex: Math.max(1, (end - start) / 60000), backgroundColor: CATEGORY_BAR[categoryOf(item.packageName, item.appName)], minWidth: 3, borderRadius: 3 }}
        onPress={() => onSelectSession(item)}
      />,
    );
    cursor = end;
  });
  if (dayEnd > cursor) blocks.push(<View key="gend" style={{ flex: Math.max(1, (dayEnd - cursor) / 60000) }} />);
  return <View style={s.timeline}>{blocks}</View>;
}

function CalendarView({
  sessions,
  bottomInset,
  s,
  t,
  c,
  lang,
  refreshing,
  onRefresh,
  onOpenApp,
  onSelectSession,
}: {
  sessions: UsageSession[];
  bottomInset: number;
  s: ReturnType<typeof makeStyles>;
  t: Strings;
  c: Palette;
  lang: "th" | "en";
  refreshing: boolean;
  onRefresh: () => void;
  onOpenApp: (summary: AppSummary) => void;
  onSelectSession: (session: UsageSession) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selKey, setSelKey] = useState<string | null>(() => dayKey(now));
  const byDay = useMemo(() => {
    const map = new Map<string, UsageSession[]>();
    sessions.forEach((item) => {
      const key = dayKey(new Date(item.startedAt));
      const list = map.get(key);
      if (list) list.push(item);
      else map.set(key, [item]);
    });
    return map;
  }, [sessions]);
  const monthDays = useMemo(() => {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1).getDay();
    const count = new Date(y, m + 1, 0).getDate();
    return { first, count, y, m };
  }, [cursor]);
  const maxTotal = useMemo(() => {
    let max = 1;
    byDay.forEach((items) => {
      const total = items.reduce((n, item) => n + item.durationSeconds, 0);
      if (total > max) max = total;
    });
    return max;
  }, [byDay]);
  const selSessions = selKey ? (byDay.get(selKey) ?? []) : [];
  const selDate = useMemo(() => {
    if (!selKey) return null;
    const [y, m, d] = selKey.split("-").map(Number);
    return new Date(y, m, d);
  }, [selKey]);
  const selTotal = selSessions.reduce((n, item) => n + item.durationSeconds, 0);
  const selSummaries = useMemo(() => summarize(selSessions), [selSessions]);
  const selTop = selSummaries.slice(0, 5);
  const selTopMax = Math.max(1, ...selTop.map((item) => item.totalSeconds));
  const dayStart = selDate ? startOfDay(selDate).getTime() : 0;
  const sameToday = selDate ? sameDay(selDate.toISOString(), now) : false;
  const dayEnd = selDate ? (sameToday ? Date.now() : dayStart + 86400000) : 0;
  const monthName = cursor.toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { month: "long", year: "numeric" });
  const weekNames = lang === "th" ? ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"] : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  function shiftMonth(delta: number) {
    setCursor(new Date(monthDays.y, monthDays.m + delta, 1));
    setSelKey(null);
  }

  function goToday() {
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelKey(dayKey(now));
  }

  return (
    <ScrollView
      contentContainerStyle={[s.content, { paddingBottom: bottomInset + 80 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Reveal>
        <View style={s.calNav}>
          <Pressable style={s.calNavButton} onPress={() => shiftMonth(-1)}>
            <Text style={s.calNavText}>‹</Text>
          </Pressable>
          <Text style={s.calTitle}>{monthName}</Text>
          <Pressable style={s.calTodayButton} onPress={goToday}>
            <Text style={s.moreText}>{t.jumpToday}</Text>
          </Pressable>
          <Pressable style={s.calNavButton} onPress={() => shiftMonth(1)}>
            <Text style={s.calNavText}>›</Text>
          </Pressable>
        </View>
      </Reveal>
      <Reveal delay={60}>
        <View style={s.card}>
          <View style={s.calGrid}>
            {weekNames.map((name) => (
              <Text key={name} style={s.calWeek}>
                {name}
              </Text>
            ))}
            {Array.from({ length: monthDays.first }, (_, i) => (
              <View key={`b${i}`} style={s.calCellEmpty} />
            ))}
            {Array.from({ length: monthDays.count }, (_, i) => {
              const day = i + 1;
              const key = `${monthDays.y}-${monthDays.m}-${day}`;
              const items = byDay.get(key) ?? [];
              const total = items.reduce((n, item) => n + item.durationSeconds, 0);
              const active = selKey === key;
              const isToday = sameDay(new Date(monthDays.y, monthDays.m, day).toISOString(), now);
              return (
                <Pressable
                  key={key}
                  style={[s.calCell, active && s.calCellActive, isToday && s.calCellToday]}
                  onPress={() => setSelKey(key)}
                >
                  <Text style={[s.calNum, active && s.calNumActive]}>{day}</Text>
                  {total > 0 ? (
                    <>
                      <Text style={[s.calTotal, active && s.calNumActive]}>{formatDuration(total, lang)}</Text>
                      <View style={s.dayBar}>
                        <View style={{ flex: Math.max(2, Math.round((total / maxTotal) * 100)), backgroundColor: active ? c.white : c.green }} />
                        <View style={{ flex: Math.max(0, 100 - Math.round((total / maxTotal) * 100)) }} />
                      </View>
                    </>
                  ) : (
                    <Text style={s.calEmpty}>·</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Reveal>
      {selDate && (
        <Reveal key={selKey} delay={40}>
          <View style={s.card}>
            <Text style={s.sectionHeading}>
              {fullDate(selDate, lang)} · {formatDuration(selTotal, lang)} · {selSessions.length} {t.unitLaunches}
            </Text>
            <Text style={s.sectionIntro}>{t.timeline24h}</Text>
            {selSessions.length > 0 ? (
              <Timeline sessions={selSessions} dayStart={dayStart} dayEnd={dayEnd} s={s} onSelectSession={onSelectSession} />
            ) : (
              <Empty text={t.noDataDay} s={s} />
            )}
            <Text style={s.sectionIntro}>{t.topApps}</Text>
            {selTop.map((item) => (
              <Pressable key={item.packageName} style={s.pressRow} onPress={() => onOpenApp(item)}>
                <AppIcon item={item} s={s} />
                <View style={s.rowMain}>
                  <Text style={s.appName}>{item.appName}</Text>
                  <Text style={s.muted}>
                    {item.launches} {t.unitLaunches}
                  </Text>
                  <View style={s.appBarWrap}>
                    <View style={{ flex: Math.max(2, Math.round((item.totalSeconds / selTopMax) * 100)), backgroundColor: CATEGORY_BAR[categoryOf(item.packageName, item.appName)] }} />
                    <View style={{ flex: Math.max(0, 100 - Math.round((item.totalSeconds / selTopMax) * 100)) }} />
                  </View>
                </View>
                <Text style={s.duration}>{formatDuration(item.totalSeconds, lang)}</Text>
              </Pressable>
            ))}
          </View>
        </Reveal>
      )}
    </ScrollView>
  );
}

function SessionOverlay({
  session,
  s,
  t,
  lang,
  onClose,
  onViewApp,
}: {
  session: UsageSession;
  s: ReturnType<typeof makeStyles>;
  t: Strings;
  lang: "th" | "en";
  onClose: () => void;
  onViewApp: (packageName: string) => void;
}) {
  return (
    <View style={s.overlay}>
      <Pressable style={s.overlayBackdrop} onPress={onClose} />
      <View style={s.overlayCard}>
        <Text style={s.sectionHeading}>{t.sessionDetail}</Text>
        <Text style={s.overlayApp}>{session.appName}</Text>
        <Text style={s.muted}>{session.packageName}</Text>
        <View style={s.overlayRow}>
          <Text style={s.muted}>{t.startedAt}</Text>
          <Text style={s.appName}>
            {fullDate(session.startedAt, lang)} {clock(session.startedAt, lang)}
          </Text>
        </View>
        <View style={s.overlayRow}>
          <Text style={s.muted}>{t.endedAt}</Text>
          <Text style={s.appName}>
            {fullDate(session.endedAt, lang)} {clock(session.endedAt, lang)}
          </Text>
        </View>
        <View style={s.overlayRow}>
          <Text style={s.muted}>{t.duration}</Text>
          <Text style={s.duration}>{formatDuration(session.durationSeconds, lang)}</Text>
        </View>
        <View style={s.overlayButtons}>
          <Pressable style={s.primaryButton} onPress={() => onViewApp(session.packageName)}>
            <Text style={s.primaryText}>{t.viewApp}</Text>
          </Pressable>
          <Pressable style={s.moreButton} onPress={onClose}>
            <Text style={s.moreText}>{t.close}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function Settings({
  usageAccess,
  onOpenUsageAccess,
  prefs,
  s,
  t,
  stats,
  onTheme,
  onLang,
  onRetention,
  onNotify,
}: {
  usageAccess: boolean;
  onOpenUsageAccess: () => void;
  prefs: Prefs;
  s: ReturnType<typeof makeStyles>;
  t: Strings;
  stats: { count: number; storageKB: number; queryMs: number };
  onTheme: (theme: Prefs["theme"]) => void;
  onLang: (lang: Prefs["lang"]) => void;
  onRetention: (retention: Prefs["retention"]) => void;
  onNotify: (on: boolean) => void;
}) {
  const themes: Prefs["theme"][] = ["system", "light", "dark"];
  const themeNames = { system: t.settingsSystem, light: t.settingsLight, dark: t.settingsDarkMode };
  const retentions: Prefs["retention"][] = [7, 30, 90, 0];
  return (
    <>
      <Reveal>
        <View style={s.permission}>
          <Text style={s.permissionTitle}>{usageAccess ? t.permTitleOn : t.permTitleOff}</Text>
          <Text style={s.muted}>{t.permBody}</Text>
          <Pressable
            style={({ pressed }) => [s.primaryButton, pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] }]}
            onPress={onOpenUsageAccess}
          >
            <Text style={s.primaryText}>{t.permButton}</Text>
          </Pressable>
        </View>
      </Reveal>
      <SectionTitle title={t.settingsAppearance} s={s} />
      <Reveal delay={60}>
        <View style={s.card}>
          <Text style={s.muted}>{t.settingsDark}</Text>
          <View style={s.chipRow}>
            {themes.map((key) => (
              <Pressable key={key} style={[s.chip, prefs.theme === key && s.chipActive]} onPress={() => onTheme(key)}>
                <Text style={[s.chipText, prefs.theme === key && s.chipTextActive]}>{themeNames[key]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.muted}>{t.settingsLang}</Text>
          <View style={s.chipRow}>
            {(["th", "en"] as const).map((key) => (
              <Pressable key={key} style={[s.chip, prefs.lang === key && s.chipActive]} onPress={() => onLang(key)}>
                <Text style={[s.chipText, prefs.lang === key && s.chipTextActive]}>{key === "th" ? "ไทย" : "English"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Reveal>
      <SectionTitle title={t.settingsNotify} s={s} />
      <Reveal delay={90}>
        <View style={s.card}>
          <Pressable style={s.pressRow} onPress={() => onNotify(!prefs.notifyDaily)}>
            <View>
              <Text style={s.appName}>{t.settingsDailySummary}</Text>
              <Text style={s.muted}>{t.settingsDailySummaryDetail}</Text>
            </View>
            <View style={[s.toggle, prefs.notifyDaily && s.toggleOn]}>
              <View style={[s.toggleDot, prefs.notifyDaily && s.toggleDotOn]} />
            </View>
          </Pressable>
        </View>
      </Reveal>
      <SectionTitle title={t.settingsData} s={s} />
      <Reveal delay={110}>
        <View style={s.card}>
          <Text style={s.muted}>{t.settingsRetention}</Text>
          <Text style={s.muted}>{t.settingsRetentionDetail}</Text>
          <View style={s.chipRow}>
            {retentions.map((key) => (
              <Pressable key={key} style={[s.chip, prefs.retention === key && s.chipActive]} onPress={() => onRetention(key)}>
                <Text style={[s.chipText, prefs.retention === key && s.chipTextActive]}>
                  {key === 0 ? t.retentionUnlimited : `${key} ${t.retentionDays}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Reveal>
      <SectionTitle title={t.settingsPrivacy} s={s} />
      <Reveal delay={130}>
        <Text style={s.body}>{t.privacyBody}</Text>
      </Reveal>
      <SectionTitle title={t.settingsDebug} s={s} />
      <Reveal delay={140}>
        <View style={s.card}>
          <View style={s.overlayRow}>
            <Text style={s.muted}>{t.debugSessions}</Text>
            <Text style={s.duration}>{stats.count}</Text>
          </View>
          <View style={s.overlayRow}>
            <Text style={s.muted}>{t.debugStorage}</Text>
            <Text style={s.duration}>{stats.storageKB} KB</Text>
          </View>
          <View style={s.overlayRow}>
            <Text style={s.muted}>{t.debugQuery}</Text>
            <Text style={s.duration}>{stats.queryMs} ms</Text>
          </View>
        </View>
      </Reveal>
    </>
  );
}

function summarize(items: UsageSession[]): AppSummary[] {
  const map = new Map<string, AppSummary>();
  items.forEach((item) => {
    const current = map.get(item.packageName) ?? {
      packageName: item.packageName,
      appName: item.appName,
      launches: 0,
      totalSeconds: 0,
      lastOpened: item.startedAt,
      sessions: [],
    };
    current.launches += 1;
    current.totalSeconds += item.durationSeconds;
    current.lastOpened = current.lastOpened > item.startedAt ? current.lastOpened : item.startedAt;
    current.sessions.push(item);
    map.set(item.packageName, current);
  });
  return Array.from(map.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
}

const CATEGORY_ICON: Record<Category, keyof typeof Ionicons.glyphMap> = {
  social: "chatbubbles",
  games: "game-controller",
  productivity: "briefcase",
  other: "apps",
};

function AppIcon({ item, s }: { item: AppSummary; s: ReturnType<typeof makeStyles> }) {
  const tint = CATEGORY_BAR[categoryOf(item.packageName, item.appName)];
  return (
    <View style={[s.appIcon, { backgroundColor: `${tint}26` }]}>
      <Ionicons
        name={CATEGORY_ICON[categoryOf(item.packageName, item.appName)]}
        size={19}
        color={tint}
      />
    </View>
  );
}

function UsageRow({
  item,
  detailed = false,
  s,
  t,
  lang,
  onPress,
}: {
  item: AppSummary;
  detailed?: boolean;
  s: ReturnType<typeof makeStyles>;
  t: Strings;
  lang: "th" | "en";
  onPress?: () => void;
}) {
  const body = (
    <>
      <AppIcon item={item} s={s} />
      <View style={s.rowMain}>
        <Text style={s.appName}>{item.appName}</Text>
        <Text style={s.muted}>
          {item.launches} {t.unitLaunches} {detailed ? `· ${t.lastOpened} ${clock(item.lastOpened, lang)}` : ""}
        </Text>
      </View>
      <Text style={s.duration}>{formatDuration(item.totalSeconds)}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        style={({ pressed }) => [s.usageRow, pressed && { opacity: 0.55 }]}
        accessibilityRole="button"
        accessibilityLabel={item.appName}
        onPress={onPress}
      >
        {body}
      </Pressable>
    );
  }
  return <View style={s.usageRow}>{body}</View>;
}

function SectionTitle({ title, action, s }: { title: string; action?: string; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.sectionTitle}>
      <Text style={s.sectionHeading}>{title}</Text>
      {action && <Text style={s.action}>{action}</Text>}
    </View>
  );
}

function Stat({ label, value, s }: { label: string; value: string; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function Empty({ text, s }: { text: string; s: ReturnType<typeof makeStyles> }) {
  return (
    <View style={s.empty}>
      <Text style={s.muted}>{text}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.warm },
    shell: { flex: 1, maxWidth: 720, width: "100%", alignSelf: "center" },
    loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.warm },
    brand: { color: colors.green, fontSize: 30, fontWeight: "800", letterSpacing: 4 },
    header: {
      paddingHorizontal: 24,
      paddingTop: 22,
      paddingBottom: 14,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    eyebrow: { color: colors.green, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
    title: { color: colors.ink, fontSize: 30, lineHeight: 38, fontWeight: "800", marginTop: 5 },
    statusDot: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 3 },
    dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: "#79a887" },
    statusText: { color: colors.muted, fontSize: 11 },
    content: { padding: 24, paddingTop: 8, paddingBottom: 100 },
    hero: {
      backgroundColor: "#2f6f5e",
      borderRadius: 26,
      padding: 24,
      marginBottom: 26,
      shadowColor: "#1c4a3e",
      shadowOpacity: 0.3,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 8,
    },
    heroLabel: { color: "#b9d1c4", fontSize: 13 },
    heroNumber: { color: "#fff", fontSize: 38, fontWeight: "800", marginTop: 6 },
    heroMeta: { color: "#d8e8de", marginTop: 5 },
    heroDelta: { color: "#ffd98a", marginTop: 4, fontSize: 13, fontWeight: "700" },
    heroRule: { height: 5, borderRadius: 5, backgroundColor: "#548779", marginTop: 24, overflow: "hidden" },
    heroFill: { height: "100%", backgroundColor: "#d8eadc", borderRadius: 5 },
    sectionTitle: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
      marginTop: 4,
    },
    sectionHeading: { fontSize: 17, fontWeight: "800", color: colors.ink },
    action: { color: colors.green, fontSize: 13, fontWeight: "700" },
    statRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
    stat: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 15,
      flex: 1,
      borderWidth: 1,
      borderColor: colors.line,
      shadowColor: "#0f1f18",
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 2,
    },
    statValue: { color: colors.ink, fontSize: 20, fontWeight: "800" },
    statLabel: { color: colors.muted, fontSize: 11, marginTop: 5 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: colors.line,
      marginBottom: 25,
      shadowColor: "#0f1f18",
      shadowOpacity: 0.07,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 7 },
      elevation: 3,
    },
    usageRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: "#e9f0eb",
    },
    pressRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
    },
    appIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    rowMain: { flex: 1 },
    appName: { color: colors.ink, fontSize: 15, fontWeight: "700" },
    muted: { color: colors.muted, fontSize: 12, marginTop: 4 },
    duration: { color: colors.ink, fontSize: 13, fontWeight: "800" },
    refreshButton: {
      backgroundColor: "#2f6f5e",
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
      marginBottom: 12,
      shadowColor: "#1c4a3e",
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    refreshText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    footnote: { color: colors.muted, fontSize: 11, lineHeight: 17, textAlign: "center", marginTop: -10 },
    sectionIntro: { color: colors.muted, marginBottom: 16 },
    historyGroup: { marginBottom: 4, marginTop: 18 },
    historyDay: { color: colors.green, fontWeight: "800", fontSize: 15, marginBottom: 10 },
    historyList: { flex: 1 },
    sessionCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.line,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    sessionSub: { marginLeft: 20 },
    permission: {
      backgroundColor: colors.pale,
      borderRadius: 22,
      padding: 22,
      marginBottom: 28,
      shadowColor: "#1c4a3e",
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    permissionTitle: { color: colors.green, fontWeight: "800", fontSize: 18, marginBottom: 8 },
    primaryButton: {
      backgroundColor: "#2f6f5e",
      paddingVertical: 13,
      paddingHorizontal: 18,
      borderRadius: 14,
      alignSelf: "flex-start",
      marginTop: 16,
      shadowColor: "#1c4a3e",
      shadowOpacity: 0.22,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 3,
    },
    primaryText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    body: { color: colors.muted, lineHeight: 21, fontSize: 14, paddingHorizontal: 2 },
    nav: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      flexDirection: "row",
      paddingTop: 9,
      paddingBottom: 10,
      shadowColor: "#0f1f18",
      shadowOpacity: 0.1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: -6 },
      elevation: 14,
    },
    navItem: { flex: 1, alignItems: "center", gap: 3 },
    navItemActive: {},
    navItemPressed: { opacity: 0.55 },
    navIconBox: {
      width: 52,
      height: 30,
      alignItems: "center",
      justifyContent: "center",
    },
    navPill: {
      flex: 1,
      borderRadius: 15,
      backgroundColor: colors.pale,
    },
    navLabel: { color: colors.muted, fontSize: 10 },
    navLabelActive: { color: colors.green, fontWeight: "800" },
    empty: { paddingVertical: 30, alignItems: "center" },
    moreButton: {
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 25,
      borderRadius: 12,
      backgroundColor: colors.pale,
    },
    moreText: { color: colors.green, fontWeight: "800", fontSize: 13 },
    searchInput: {
      backgroundColor: colors.input,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.ink,
      marginBottom: 12,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    chip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
    },
    chipActive: { backgroundColor: colors.green, borderColor: colors.green },
    chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: "#fff" },
    sparkRow: { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 8, paddingVertical: 8 },
    sparkCol: { flex: 1, height: "100%", justifyContent: "flex-end" },
    sparkBar: { borderRadius: 5, minHeight: 4 },
    stackBar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", marginVertical: 10 },
    catRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
    catDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    catName: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: "700" },
    insightCard: {
      backgroundColor: colors.pale,
      borderRadius: 16,
      padding: 18,
      marginBottom: 25,
    },
    staleBanner: {
      backgroundColor: "#fde8e8",
      borderRadius: 14,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#f5c2c2",
    },
    staleText: { color: "#b91c1c", fontSize: 13, fontWeight: "700", textAlign: "center" },
    insightText: { color: colors.green, fontSize: 15, fontWeight: "800" },
    calNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    calTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
    calNavButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 12,
      width: 44,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    calTodayButton: {
      backgroundColor: colors.pale,
      borderRadius: 12,
      paddingHorizontal: 16,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    calNavText: { color: colors.green, fontSize: 22, fontWeight: "800" },
    calGrid: { flexDirection: "row", flexWrap: "wrap", paddingVertical: 8 },
    calWeek: { width: "14.28%", textAlign: "center", color: colors.muted, fontSize: 11, fontWeight: "800", paddingVertical: 6 },
    calCellEmpty: { width: "14.28%", padding: 2 },
    calCell: {
      width: "14.28%",
      padding: 2,
    },
    calNum: { color: colors.ink, fontSize: 13, fontWeight: "800", textAlign: "center" },
    calNumActive: { color: "#fff" },
    calTotal: { color: colors.green, fontSize: 9, fontWeight: "700", textAlign: "center" },
    calEmpty: { color: colors.line, fontSize: 12, textAlign: "center" },
    calCellActive: { backgroundColor: colors.green, borderRadius: 10 },
    calCellToday: { borderWidth: 1, borderColor: colors.green, borderRadius: 10 },
    dayBar: { flexDirection: "row", height: 4, borderRadius: 2, marginTop: 3, overflow: "hidden" },
    timeline: { flexDirection: "row", height: 26, borderRadius: 8, overflow: "hidden", backgroundColor: colors.pale, marginVertical: 10 },
    appBarWrap: { flexDirection: "row", height: 6, borderRadius: 3, marginTop: 6, overflow: "hidden", backgroundColor: colors.pale },
    overlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, justifyContent: "flex-end" },
    overlayBackdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)" },
    overlayCard: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.line,
    },
    overlayApp: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: 8 },
    overlayRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
    overlayButtons: { flexDirection: "row", gap: 10, marginTop: 8 },
    toggle: {
      width: 50,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.line,
      justifyContent: "center",
      paddingHorizontal: 3,
    },
    toggleOn: { backgroundColor: colors.green, alignItems: "flex-end" },
    toggleDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff" },
    toggleDotOn: {},
  });
