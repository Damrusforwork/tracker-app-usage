import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Animated, Easing, Image, Pressable, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { CATEGORY_BAR, categoryOf, Category } from "../lib/categories";
import type { Strings } from "../lib/prefs";
import { formatDuration, UsageSession } from "../lib/usage";
import { getAppIcon } from "../lib/usageBridge";
import { Styles } from "./theme";

export type AppSummary = {
  packageName: string;
  appName: string;
  launches: number;
  totalSeconds: number;
  lastOpened: string;
  sessions: UsageSession[];
};

export function clock(value: string, lang: "th" | "en") {
  return new Date(value).toLocaleTimeString(lang === "th" ? "th-TH" : "en-US", { hour: "2-digit", minute: "2-digit" });
}
export function dayLabel(value: string, lang: "th" | "en") {
  return new Date(value).toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "short" });
}
export function fullDate(value: string | Date, lang: "th" | "en") {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(lang === "th" ? "th-TH" : "en-US", { day: "numeric", month: "long", year: "numeric" });
}

export function Reveal({
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

export function LoadingScreen({ s, t }: { s: Styles; t: Strings }) {
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

export function SparkBars({ values, s, barColor }: { values: number[]; s: Styles; barColor: string }) {
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

export function summarize(items: UsageSession[]): AppSummary[] {
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

export const CATEGORY_ICON: Record<Category, keyof typeof Ionicons.glyphMap> = {
  social: "chatbubbles",
  video: "play",
  shopping: "cart",
  finance: "card",
  media: "musical-notes",
  games: "game-controller",
  productivity: "briefcase",
  other: "apps",
};

const iconCache = new Map<string, string | null>();

export function AppIcon({ item, s }: { item: AppSummary; s: Styles }) {
  const cached = iconCache.get(item.packageName);
  const [uri, setUri] = useState<string | null | undefined>(cached);
  useEffect(() => {
    if (iconCache.has(item.packageName)) {
      setUri(iconCache.get(item.packageName) ?? null);
      return;
    }
    let alive = true;
    getAppIcon(item.packageName).then((value) => {
      iconCache.set(item.packageName, value);
      if (alive) setUri(value);
    });
    return () => {
      alive = false;
    };
  }, [item.packageName]);
  if (uri) return <Image source={{ uri }} style={s.appIcon} />;
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

export function UsageRow({
  item,
  detailed = false,
  s,
  t,
  lang,
  onPress,
}: {
  item: AppSummary;
  detailed?: boolean;
  s: Styles;
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
      <Text style={s.duration}>{formatDuration(item.totalSeconds, lang)}</Text>
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

export function SectionTitle({ title, action, s }: { title: string; action?: string; s: Styles }) {
  return (
    <View style={s.sectionTitle}>
      <Text style={s.sectionHeading}>{title}</Text>
      {action && <Text style={s.action}>{action}</Text>}
    </View>
  );
}

export function Stat({ label, value, s }: { label: string; value: string; s: Styles }) {
  return (
    <View style={s.stat}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

export function Empty({ text, s }: { text: string; s: Styles }) {
  return (
    <View style={s.empty}>
      <Text style={s.muted}>{text}</Text>
    </View>
  );
}
