import { Pressable, Text, View } from "react-native";
import type { Strings } from "../lib/prefs";
import { formatDuration, UsageSession } from "../lib/usage";
import { Styles } from "./theme";
import { clock, fullDate } from "./ui";

export function SessionOverlay({
  session,
  s,
  t,
  lang,
  onClose,
  onViewApp,
}: {
  session: UsageSession;
  s: Styles;
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
