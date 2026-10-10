import { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { addDays, startOfDay } from "../lib/categories";
import type { Strings } from "../lib/prefs";
import { formatDuration, sameDay, UsageSession } from "../lib/usage";
import { SPARK_BAR, Styles } from "./theme";
import { groupByDayHour, HourGroupItem } from "./HistoryList";
import { AppSummary, Empty, Reveal, SectionTitle, SparkBars, Stat, summarize, UsageRow } from "./ui";

export function Apps({
  sessions,
  s,
  t,
  lang,
  onOpenApp,
}: {
  sessions: UsageSession[];
  s: Styles;
  t: Strings;
  lang: "th" | "en";
  onOpenApp: (summary: AppSummary) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<"today" | "7" | "30">("today");
  const [sort, setSort] = useState<"time" | "launches" | "name" | "recent">("time");
  const summaries = useMemo(() => {
    const now = new Date();
    const list = sessions.filter((item) => {
      if (period === "today") return sameDay(item.startedAt, now);
      const days = period === "7" ? 7 : 30;
      return new Date(item.startedAt).getTime() >= now.getTime() - days * 86400000;
    });
    return summarize(list);
  }, [sessions, period]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = summaries.filter((item) => q.length === 0 || item.appName.toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (sort === "launches") return b.launches - a.launches;
      if (sort === "name") return a.appName.localeCompare(b.appName);
      if (sort === "recent") return b.lastOpened.localeCompare(a.lastOpened);
      return b.totalSeconds - a.totalSeconds;
    });
    return list;
  }, [summaries, query, sort]);
  const visibleSummaries = showAll ? filtered : filtered.slice(0, 20);
  return (
    <>
      <Reveal>
        <View style={s.chipRow}>
          {(["today", "7", "30"] as const).map((key) => (
            <Pressable key={key} style={[s.chip, period === key && s.chipActive]} onPress={() => setPeriod(key)}>
              <Text style={[s.chipText, period === key && s.chipTextActive]}>
                {key === "today" ? t.periodToday : key === "7" ? t.period7 : t.period30}
              </Text>
            </Pressable>
          ))}
        </View>
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

export function AppDetail({
  summary,
  s,
  t,
  lang,
  onBack,
  onSelectSession,
}: {
  summary: AppSummary;
  s: Styles;
  t: Strings;
  lang: "th" | "en";
  onBack: () => void;
  onSelectSession: (session: UsageSession) => void;
}) {
  const pkgSessions = useMemo(
    () => [...summary.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [summary.sessions],
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
