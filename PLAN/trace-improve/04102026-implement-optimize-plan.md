# TRACE Implement + Optimize Plan

- Date: 04 Oct 2026. Source: `MD/imprement-1/imprement.md` (user-selected scope).
- Goal: ship selected features AND fix device freeze. Freeze fix comes first.
- Status: Phase 0 + Phase 1 implemented 2026-10-04. `tsc` exit 0. Pending device test.
- Deviations: no real app icons (`expo-application` has no icon API, initial-letter fallback kept); no `DateTimePicker` dep (calendar month nav covers date selection); category manual override UI deferred (auto keyword map only); notification body static at schedule time.

## 1. Freeze Diagnosis (Evidence)

1. History renders ALL sessions in `ScrollView`, one `Reveal` + `Animated.timing` per row (`App.tsx:401-421`). Hundreds of rows = huge view tree + hundreds of pending timers. Primary freeze cause.
2. Per-row stagger delay unbounded: `delay={groupIndex*70+90+index*40}` (`App.tsx:406`). 500 rows = 20s timer tail.
3. Native builds one `SimpleDateFormat` per session (`UsageAccessModule.kt:82`). Slow + wasteful.
4. Native calls `PackageManager.getApplicationInfo` per session (`UsageAccessModule.kt:77`). IPC per row, no cache.
5. No package blocklist. Launcher/system events (`com.nothing.launcher`, `com.android.systemui`) become sessions. Noise + volume.
6. No cap on returned sessions. Full-day query can return thousands of rows over bridge, then `JSON.stringify` + AsyncStorage write (`lib/usage.ts:20`) blocks JS.
7. `totalSeconds` recomputed every render, `summaries` re-sorted on each keystroke risk (`App.tsx:146-147`). Minor.
8. Refresh has no concurrency guard. Double-tap = two overlapping native queries + writes (`App.tsx:114-136`).

## 2. Phase 0 — Unfreeze (Do First, Blocks Device Test)

1. History: replace row-level `Reveal` with static rows when `items.length > 50`; cap stagger `Math.min(index,12)*45`.
2. History: virtualize with `FlatList` (`initialNumToRender={30}`, `windowSize={7}`, `maxToRenderPerBatch={20}`), keep group headers via `SectionList`.
3. Today/Apps: render top 20 rows + "view all" affordance; cap stagger same rule.
4. Native: hoist `SimpleDateFormat` to class-level instance; cache labels in `MutableMap<String,String>`.
5. Native: blocklist `setOf(ownPackage, "com.nothing.launcher", "com.android.systemui", "com.android.launcher3", "com.sec.android.app.launcher")`, configurable const.
6. Native: cap output at 2000 sessions (drop shortest first or oldest first, document choice).
7. Hide package-name rows: filter sessions where `appName` looks like a package (`appName.contains(".")`, e.g. `com.*`). Apply in `summarize` + History/Calendar via shared `isDisplayable(session)` in `lib/usage.ts`. System rows never reach UI.
8. Safe-area overlap (status bar covers header, gesture circle covers nav): wrap root in `SafeAreaProvider` (`react-native-safe-area-context`, `npx expo install`), replace fixed `paddingTop`/`paddingBottom` with `useSafeAreaInsets()` (+ min 12px fallback), set `StatusBar` translucency/background per theme, set Android `navigationBar` visible + `edgeToEdgeEnabled` in `app.json`, retest on Nothing phone.
9. Remove export/import/clear: delete `exportData`, `importData`, `clearData`, their Settings rows, and uninstall unused `expo-document-picker`, `expo-file-system`, `expo-sharing` if nothing else uses them.
10. JS: `refreshing` guard at top of `refreshRealUsage`; disable button while refreshing.
11. JS: memoize `totalSeconds` with `useMemo`.
12. Retest on device: open History, scroll fast, switch tabs. Accept = no ANR, 60s scroll smooth.

## 3. Phase 1 — Selected Features

### Today
1. Yesterday compare: `+/- %` badge green/red under hero number.
2. 7-day sparkline: custom `View`-bar mini chart (no new dep), data from `sessions` grouped by day.
3. Category breakdown: `categoryOf(packageName)` map (Social/Games/Productivity/Other) + horizontal stacked bar with `flex` ratios.
4. Insight card: one-line text from top category delta ("Social 45 min, +22% vs yesterday").

### Apps
1. Detail screen: tap row goes to detail (sessions list, daily trend, average duration). New `selectedApp` state, no router.
2. Categories: auto-detect via keyword map on package/app name + manual override stored in AsyncStorage.
3. Weekly trend: per-app 7-day sparkline + up/down badge.
4. Search/sort: search bar + sort mode (time/launches/name/last opened).
5. Real icon: try `expo-application` icon API, fallback initial letter (current).

### History
1. Calendar dashboard tab: month grid, day cell = total + app count + bar; tap day = detail panel (reuse HTML mockup spec).
2. Month navigation + jump-to-today.
3. Date picker: native `DateTimePicker` only when needed (new dep `@react-native-community/datetimepicker`, Android only use).
4. 24h timeline: horizontal flex-ratio bar colored per app; tap segment = session detail.
5. Session detail: bottom sheet style panel with exact times + link to app detail.
6. Day summary card: total, app count, top 3 apps.
7. No export feature: export/import/clear removed per user (see Phase 0 item 9). No per-date export.

### Settings
1. Dark mode: `useColorScheme` + theme const, toggle persisted in AsyncStorage.
2. Notifications: `expo-notifications` (new dep) daily summary + limit alerts.
3. Retention: 7/30/90/unlimited, prune on load.
4. TH/EN toggle: string table, persisted.
5. Debug screen: raw event count, session count, storage bytes, last query ms.

## 4. Verify

- `pnpm exec tsc --noEmit` (must exit 0).
- Device test checklist: cold start < 3s, History scroll no freeze, refresh twice fast, airplane mode, permission denied path.
- `PROJECT_ROADMAP_AND_STATUS.md`: update Change History per change.

## 5. Risks / Open Questions

- `expo-application` icon API coverage on Nothing OS: verify, keep fallback.
- Notification permission flow on Android 13+: request at settings toggle time.
- Dark mode doubles style QA: keep theme to one `colors` switch, no per-screen forks.
- Confirm: cap 2000 sessions acceptable? Confirm: DateTimePicker dep OK or custom month nav only?
