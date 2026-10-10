import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { addDays, CATEGORY_BAR, CATEGORY_ORDER, categoryOf, emptyCategoryTotals, startOfDay, Category } from "../lib/categories";
import type { Strings } from "../lib/prefs";
import { countedSecondsBefore, formatDuration, sameDay, UsageSession } from "../lib/usage";
import { SPARK_BAR, Styles } from "./theme";
import { AppSummary, Empty, Reveal, SectionTitle, SparkBars, Stat, UsageRow } from "./ui";

export function Today({
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
  s: Styles;
  t: Strings;
  lang: "th" | "en";
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleSummaries = showAll ? summaries : summaries.slice(0, 20);
  const now = new Date();
  const yesterday = addDays(startOfDay(now), -1);
  const yesterdayCutoff = new Date(yesterday);
  yesterdayCutoff.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  const yesterdayTotal = allSessions
    .filter((item) => sameDay(item.startedAt, yesterday))
    .reduce((sum, item) => sum + countedSecondsBefore(item, yesterdayCutoff.getTime()), 0);
  const delta = totalSeconds - yesterdayTotal;
  const deltaPct = yesterdayTotal > 0 ? Math.round((delta / yesterdayTotal) * 100) : 0;
  const last7 = useMemo(() => {
    const base = startOfDay(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(base, i - 6);
      return allSessions.filter((item) => sameDay(item.startedAt, day)).reduce((n, item) => n + item.durationSeconds, 0);
    });
  }, [allSessions]);
  const catTotals = useMemo(() => {
    const totals = emptyCategoryTotals();
    sessions.forEach((item) => {
      totals[categoryOf(item.packageName, item.appName)] += item.durationSeconds;
    });
    return totals;
  }, [sessions]);
  const catNames: Record<Category, string> = {
    social: t.catSocial,
    video: t.catVideo,
    shopping: t.catShopping,
    finance: t.catFinance,
    media: t.catMedia,
    games: t.catGames,
    productivity: t.catProductivity,
    other: t.catOther,
  };
  const topApp = summaries[0];

  return (
    <>
      <Reveal>
        <View style={s.hero}>
          <Text style={s.heroLabel}>{t.heroLabel}</Text>
          <Text style={s.heroNumber}>{formatDuration(totalSeconds, lang, true)}</Text>
          <Text style={s.heroMeta}>
            {summaries.length} {t.unitApps} · {sessions.length} {t.unitLaunches} · {usageAccess ? t.realData : t.noAccess}
          </Text>
          {yesterdayTotal > 0 ? (
            <Text style={s.heroDelta}>
              {delta === 0 ? t.vsYesterdaySame : `${deltaPct >= 0 ? "+" : ""}${deltaPct}% ${deltaPct >= 0 ? t.vsYesterdayUp : t.vsYesterdayDown}`}
            </Text>
          ) : null}
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
            {CATEGORY_ORDER.map((key) =>
              catTotals[key] > 0 ? (
                <View key={key} style={{ flex: catTotals[key], backgroundColor: CATEGORY_BAR[key] }} />
              ) : null,
            )}
          </View>
          {CATEGORY_ORDER.map((key) => (
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
            {topApp ? `${topApp.appName} · ${formatDuration(topApp.totalSeconds, lang, true)}` : t.empty}
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
      <Text style={s.footnote}>{t.accuracyNote}</Text>
      {Platform.OS === "web" ? <Text style={s.footnote}>{t.webNoUsage}</Text> : null}
      {!usageAccess && <Text style={s.footnote}>{t.footnoteAccess}</Text>}
    </>
  );
}
