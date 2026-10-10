import { Pressable, Text, View } from "react-native";
import type { Prefs, Strings } from "../lib/prefs";
import { Styles } from "./theme";
import { Reveal, SectionTitle } from "./ui";

export function Settings({
  usageAccess,
  onOpenUsageAccess,
  prefs,
  s,
  t,
  onTheme,
  onLang,
  onRetention,
}: {
  usageAccess: boolean;
  onOpenUsageAccess: () => void;
  prefs: Prefs;
  s: Styles;
  t: Strings;
  onTheme: (theme: Prefs["theme"]) => void;
  onLang: (lang: Prefs["lang"]) => void;
  onRetention: (retention: Prefs["retention"]) => void;
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
    </>
  );
}
