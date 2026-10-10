import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Apps, AppDetail } from "./components/Apps";
import { CalendarView } from "./components/CalendarView";
import { HistoryList } from "./components/HistoryList";
import { SessionOverlay } from "./components/SessionOverlay";
import { Settings } from "./components/Settings";
import { Today } from "./components/Today";
import { darkPalette, lightPalette, makeStyles } from "./components/theme";
import { AppSummary, LoadingScreen, Reveal, summarize } from "./components/ui";
import {
  coalesceSessions,
  isDisplayable,
  loadBackfillDays,
  loadLastSync,
  loadSessions,
  dropLiveInWindow,
  mergeWindow,
  sameDay,
  saveBackfillDays,
  saveLastSync,
  saveSessions,
  syncStartMillis,
  summarizePackage,
  UsageSession,
} from "./lib/usage";
import { openUsageAccessSettings, queryNativeSessions, hasUsageAccess } from "./lib/usageBridge";
import { DEFAULT_PREFS, getStrings, loadPrefs, Prefs, pruneSessions, savePrefs } from "./lib/prefs";

type Tab = "today" | "apps" | "calendar" | "history" | "settings";

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
  const refreshingRef = useRef(false);
  const prefsRef = useRef(DEFAULT_PREFS);
  const mountedRef = useRef(true);
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
        const retention = prefsRef.current.retention;
        const lastSync = await loadLastSync();
        const backfill = await loadBackfillDays();
        const start = syncStartMillis(now, lastSync, retention, backfill);
        const nativeSessions = await queryNativeSessions(start, now);
        const current = await loadSessions();
        const updated = mergeWindow(dropLiveInWindow(current, start), nativeSessions, start);
        await persistSessions(updated);
        await saveLastSync(now);
        if (backfill !== retention) await saveBackfillDays(retention);
      }
    } catch (error) {
      if (mountedRef.current) Alert.alert(t.readFail, error instanceof Error ? error.message : t.readFailBody);
    } finally {
      refreshingRef.current = false;
      if (mountedRef.current) setRefreshing(false);
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

  const refreshRef = useRef(refreshRealUsage);
  refreshRef.current = refreshRealUsage;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") refreshRef.current();
    });
    return () => sub.remove();
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
                    s={s}
                    t={t}
                    lang={prefs.lang}
                    onBack={() => setSelectedApp(null)}
                    onSelectSession={setSelectedSession}
                  />
                ) : (
                  <Apps sessions={visibleSessions} s={s} t={t} lang={prefs.lang} onOpenApp={openApp} />
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
                  onTheme={(theme) => updatePrefs({ theme })}
                  onLang={(lang) => updatePrefs({ lang })}
                  onRetention={async (retention) => {
                    await updatePrefs({ retention });
                    await persistSessions(sessions);
                  }}
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
