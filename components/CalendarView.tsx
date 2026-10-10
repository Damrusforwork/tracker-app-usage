import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { CATEGORY_BAR, categoryOf, dayKey } from "../lib/categories";
import type { Strings } from "../lib/prefs";
import { formatDuration, sameDay, UsageSession } from "../lib/usage";
import type { Palette } from "./theme";
import { Styles } from "./theme";
import { AppIcon, AppSummary, Empty, Reveal, fullDate, summarize } from "./ui";

export function CalendarView({
  sessions,
  bottomInset,
  s,
  t,
  c,
  lang,
  refreshing,
  onRefresh,
  onOpenApp,
}: {
  sessions: UsageSession[];
  bottomInset: number;
  s: Styles;
  t: Strings;
  c: Palette;
  lang: "th" | "en";
  refreshing: boolean;
  onRefresh: () => void;
  onOpenApp: (summary: AppSummary) => void;
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
            {selSessions.length === 0 ? <Empty text={t.noDataDay} s={s} /> : null}
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
