import { useMemo, useState } from "react";
import { Pressable, RefreshControl, SectionList, Text, TextInput, View } from "react-native";
import type { Strings } from "../lib/prefs";
import { formatDuration, sliceSessionHours, UsageSession } from "../lib/usage";
import { Styles } from "./theme";
import { clock, dayLabel, Empty } from "./ui";

export type HourSliceView = { session: UsageSession; seconds: number };
export type HourGroup = { hour: number; slices: HourSliceView[]; total: number };
export type DaySections = { title: string; total: number; data: HourGroup[] }[];

export function groupByDayHour(sessions: UsageSession[], lang: "th" | "en"): DaySections {
  const byDay = new Map<string, Map<number, HourSliceView[]>>();
  sessions.forEach((session) => {
    sliceSessionHours(session).forEach((slice) => {
      const day = dayLabel(new Date(slice.dayStart).toISOString(), lang);
      const hours = byDay.get(day) ?? new Map<number, HourSliceView[]>();
      const list = hours.get(slice.hour) ?? [];
      list.push({ session, seconds: slice.seconds });
      hours.set(slice.hour, list);
      byDay.set(day, hours);
    });
  });
  return [...byDay].map(([day, hours]) => {
    const data = [...hours]
      .map(([hour, slices]) => ({ hour, slices, total: slices.reduce((sum, slice) => sum + slice.seconds, 0) }))
      .sort((a, b) => b.hour - a.hour);
    return { title: day, total: data.reduce((sum, group) => sum + group.total, 0), data };
  });
}

export function hourLabel(hour: number) {
  const start = String(hour).padStart(2, "0");
  const end = String((hour + 1) % 24).padStart(2, "0");
  return `${start}:00 – ${end}:00`;
}

export function HourGroupItem({
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
  s: Styles;
  t: Strings;
  lang: "th" | "en";
  onSelectSession: (session: UsageSession) => void;
}) {
  const [open, setOpen] = useState(false);
  const top = group.slices.reduce((a, b) => (b.seconds > a.seconds ? b : a));
  const appCount = new Set(group.slices.map((slice) => slice.session.packageName)).size;
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
            {showAppName ? `${top.session.appName} · ` : ""}
            {appCount} {t.unitApps} · {group.slices.length} {t.unitLaunches}
          </Text>
        </View>
        <Text style={s.duration}>{formatDuration(group.total, lang, true)}</Text>
      </Pressable>
      {open &&
        group.slices.map((slice) => (
          <Pressable
            key={`${groupKey}-${slice.session.id}`}
            style={[s.sessionCard, s.sessionSub]}
            onPress={() => onSelectSession(slice.session)}
          >
            <View>
              <Text style={s.appName}>{slice.session.appName}</Text>
              <Text style={s.muted}>
                {clock(slice.session.startedAt, lang)} – {clock(slice.session.endedAt, lang)}
              </Text>
            </View>
            <Text style={s.duration}>{formatDuration(slice.seconds, lang, true)}</Text>
          </Pressable>
        ))}
    </View>
  );
}

export function HistoryList({
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
  s: Styles;
  t: Strings;
  lang: "th" | "en";
  refreshing: boolean;
  onRefresh: () => void;
  onSelectSession: (session: UsageSession) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((item) => item.appName.toLowerCase().includes(q) || item.packageName.toLowerCase().includes(q));
  }, [sessions, query]);
  const sections = useMemo(() => groupByDayHour(filtered, lang), [filtered, lang]);
  return (
    <SectionList
      sections={sections}
      ListHeaderComponent={
        <View style={{ marginBottom: 8 }}>
          <TextInput
            style={s.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder={t.searchHistory}
            placeholderTextColor={s.muted.color as string}
          />
          <Text style={s.muted}>{t.historyFilterHint}</Text>
        </View>
      }
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
          <Text style={s.historyDay}>
            {section.title} · {formatDuration(section.total, lang, true)}
          </Text>
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
