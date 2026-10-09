# PROJECT_ROADMAP_AND_STATUS

> Single Source of Truth for roadmap, feature status, and change history.
> If this file conflicts with source code, source code wins — update this file.

# Project Overview

- **Name**: TRACE — App Usage Journal (`app-usage-tracker`)
- **Type**: Android-first local mobile app (Expo / React Native / TypeScript)
- **Purpose**: Review which apps were launched each day, how often, when, and for how long.
- **Privacy stance**: All usage data is processed and stored on-device. No cloud sync, no login in MVP.
- **Data source**: Android `UsageStatsManager` via a custom native Kotlin module.
- **Platforms**: Android (primary, native required), Web (UI/preview only).
- **Package manager**: `pnpm` (`pnpm-lock.yaml` present).

# Current Status

- **Phase**: Working MVP with native Android bridge. Debug build installs and runs on a physical Android device via Metro (verified 2026-10-04). Release APK now builds (`arm64-v8a`, label "TRACE", signed with the debug keystore) and is ready to sideload; full device verification still pending.
- **Native module**: Implemented (`UsageAccessModule`) and registered.
- **Persistence**: Implemented (AsyncStorage + retention prune).
- **Export / Import / Clear**: Removed (04/10/2026) — on-device data only.
- **Not yet verified on physical device**: permission grant flow per OEM, event accuracy, multi-window/overlay, in-progress sessions, timezone display.

# Architecture

Single-tier client app. No backend, no network calls for usage data.

```text
index.ts  ->  registerRootComponent(App)
App.tsx   ->  UI + tab navigation + load/refresh/export/import/clear
lib/usage.ts       ->  model, AsyncStorage repo, merge, date/duration utils
lib/usageBridge.ts ->  JS bridge to native module (Android only)
android/.../UsageAccessModule.kt  ->  query UsageStatsManager, open settings
android/.../UsageAccessPackage.kt ->  registers native module
android/.../MainApplication.kt    ->  adds UsageAccessPackage to package list
android/.../AndroidManifest.xml   ->  declares PACKAGE_USAGE_STATS
```

Data model (`lib/usage.ts`):

```ts
type UsageSession = {
  id: string;            // "<package>-<startMillis>-<endMillis>"
  packageName: string;
  appName: string;
  startedAt: string;     // ISO 8601 (with offset, from SimpleDateFormat XXX)
  endedAt: string;       // ISO 8601
  durationSeconds: number;
};
type UsageExport = { schemaVersion: 1; exportedAt: string; sessions: UsageSession[] };
```

Storage key: `@app-usage-tracker/sessions`.

# Current Features

- **Today dashboard** — total time, app count, launch count, average per launch, app list sorted by total time, Usage Access status, manual refresh.
- **Apps tab** — app summaries with name, launches, latest open time, total time.
- **History tab** — sessions grouped by day with start–end times and durations.
- **Settings tab** — open Android Usage Access settings, dark mode, daily notification, retention, TH/EN, debug.
- **Delta sync** — `lastSync` window (60s overlap, 7-day max) + `mergeWindow` upsert by id + `coalesceSessions` + retention prune on every save.
- **Native query** — `querySessions(start, end)` reads UsageEvents, pairs foreground/background, emits sessions ≥ 1s, skips own package.
- **Web preview** — runs via `react-native-web`; native usage unavailable.
- **Calendar tab** — month grid (daily total + bar), tap day for summary + 24h timeline + top-5 apps.
- **Today extras** — yesterday +/-% badge, 7-day sparkline, category stacked bar (Social/Games/Work/Other), insight card.
- **Apps extras** — search, sort (time/count/name/recent), category filter, per-app detail (7-day trend, avg, recent sessions).
- **Session detail overlay** — exact start/end/duration + jump to app detail.
- **Settings extras** — dark mode (system/light/dark), daily 21:00 notification, retention prune, TH/EN toggle, debug screen (counts, storage KB, last query ms).
- **Display filter** — sessions whose name looks like a package (`com.*`) hidden; launcher/system packages blocked natively.

# In Progress

- Nothing actively mid-implementation. Device verification and correctness hardening are pending (see Roadmap).

# Roadmap / Planned Features

- **Phase 1 — Device verification**: install release APK, grant Usage Access, verify app names/durations, relaunch persistence, double-refresh dedupe, screen-off exclusion.
- **Phase 2 — Data correctness**: separate display timezone from stored timestamp, foreground auto-refresh.
- **Phase 3 — UX**: done (detail screen, timeline, search/filter, hourly groups, retention, dark mode, i18n, calendar).
- **Phase 4 — Release quality**: real application ID, real app name/launcher icon, owner release keystore, versionCode/name, minify/shrink, test on ≥2 devices, privacy policy.

# Known Issues

- **Navigation mismatch**: `AGENTS.md` states Expo Router, but the app uses local `useState` tab switching in `App.tsx`. Source is truth; update AGENTS.md or migrate to Expo Router before relying on it.
- **Package-manager mismatch**: `AGENTS.md` command block references `npx`/`bunx`; actual project uses `pnpm` (`pnpm-lock.yaml`, README, TRACE-SPEC-TH).
- **README drift**: README references `pnpm start` while `package.json` defines `start: expo start` (works, but inconsistent docs).
- **Single open session per package**: the native map overwrites a start if a new start arrives before an end; out-of-order/repeated events are not fully handled.
- **Timezone**: timestamps stored with local offset; display vs. stored timezone is not separated.
- **In-progress sessions**: closed at refresh time using `min(now, endMillis)`, may shift with rapid refresh.
- **Windows build environment (local)**: Android build requires `JAVA_HOME` = JDK 17 (Android Studio's bundled JBR 25 breaks the CMake/native step), `android/local.properties` with `sdk.dir`, and `nodeLinker: hoisted` in `pnpm-workspace.yaml` (pnpm 11 ignores non-auth settings in `.npmrc`). Fabric codegen object paths still exceed Windows `MAX_PATH` (260), so it also needs: Windows `LongPathsEnabled=1` (HKLM), a long-path-aware Ninja >= 1.12.0 wired via `-DCMAKE_MAKE_PROGRAM` + `-DCMAKE_OBJECT_PATH_MAX=1024` in `android/app/build.gradle`, and `reactNativeArchitectures=arm64-v8a` to cut native build time ~4x.

# Important Decisions

- **On-device only**: no server upload of usage history by default.

- **Merge by session id**: id is derived from `package + start + end`, making it stable across refresh.
- **Usage Access (not Accessibility)**: rely on `PACKAGE_USAGE_STATS`; do not add Accessibility Service for accuracy.
- **Native via CNG-compatible Kotlin module**: registered manually in `MainApplication.kt`, not autolinked.
- **Stock UI**: tab navigation and styling are hand-rolled in `App.tsx` (no router, no UI library). Icons use `@expo/vector-icons` (Ionicons); `lucide-react` is web-only and must not be used here.

# Change History

- **2026-10-04** — Created `PROJECT_ROADMAP_AND_STATUS.md`; scanned source (App.tsx, lib/*, android/*, package.json, README, TRACE-SPEC-TH). Documented current MVP, native bridge, known issues, and phased roadmap. Also extended `AGENTS.md` with Universal Skill-First guidelines (Mandatory Skills, Ponytail, Confirm-First, Roadmap rules).
- **2026-10-04** — Fixed local Windows Android build/run: set `JAVA_HOME` to JDK 17; created `android/local.properties`; switched pnpm to `nodeLinker: hoisted` via `pnpm-workspace.yaml` (pnpm 11 no longer reads non-auth `.npmrc` settings) and reinstalled to keep paths under the 260-char Windows limit; cleaned stale `android/app/.cxx` and generated autolinking. `gradlew app:assembleDebug` now `BUILD SUCCESSFUL`; debug APK installed and launched on device with Metro (`Android Bundled ... 726 modules`).
- **2026-10-04** — UI polish in `App.tsx` only: added `Reveal` entrance animation (RN `Animated`, `useNativeDriver`, opacity/transform only), loading pulse, animated hero progress bar (`scaleX` + measured width), nav active pill, press feedback on rows/buttons, card/hero/nav shadows. No logic, state, or handler changes; no new dependencies. Installed project skill `.kilo/skills/react-native-skills/` (42 files, vercel-labs).
- **2026-10-04** — Replaced tab-bar unicode placeholder glyphs (`"w"`, `"▦"`, empty string, `"◷"`, `"⚙"`) with real icons via `@expo/vector-icons` Ionicons in `App.tsx` (`calendar-outline`, `grid-outline`, `sunny-outline`, `time-outline`, `settings-outline`); size 19, `colors.green` when the tab is active / `colors.muted` otherwise; removed the now-unused `navIcon` / `navIconActive` styles; added dependency `@expo/vector-icons@^15.1.1` via `pnpm expo install`. `pnpm exec tsc --noEmit` exits 0.
- **2026-10-04** — App row icons now match the app theme: replaced the first-letter tile (`colors.pale` + `colors.green` text) with a shared `AppIcon` component in `App.tsx` that renders an Ionicons glyph tinted by category — `CATEGORY_ICON` maps `social → chatbubbles`, `games → game-controller`, `productivity → briefcase`, `other → apps`, using the existing `CATEGORY_BAR` color as the glyph color over a `tint + "26"` (15% alpha) tile. Applied at both call sites (Today "top apps" and `UsageRow`); removed the dead `appIconText` style and the static `appIcon.backgroundColor`. No new dependencies.
- **2026-10-04** — Rebranded launcher icon to match the app theme (variant B "Pale" chosen by user): clock glyph in theme `green #2f6f5e` on `pale #e8f1ec`, replacing the default Expo blue "A". Regenerated all 6 files in `assets/` (`icon.png` 1024, `splash-icon.png` 1024, `favicon.png` 48, `android-icon-foreground.png` 512 transparent, `android-icon-background.png` 512 solid pale, `android-icon-monochrome.png` 432 black on transparent); updated `app.json` adaptive `backgroundColor` from `#E6F4FE` to `#E8F1EC`. Originals backed up to `%TEMP%\kilo\icon-draft\backup-orig\` (note: original `favicon.png` and `android-icon-background.png` were already overwritten before backup — both were Expo defaults).
- **2026-10-04** — Resolved Windows `MAX_PATH` native build failure after adding `react-native-safe-area-context` (Fabric codegen object path 378 chars): enabled HKLM `LongPathsEnabled=1` (UAC), added Ninja 1.12.1 at `%LOCALAPPDATA%\ninja` wired in `android/app/build.gradle` (`-DCMAKE_MAKE_PROGRAM`, `-DCMAKE_OBJECT_PATH_MAX=1024`), and set `reactNativeArchitectures=arm64-v8a`. `app:assembleDebug` -> `BUILD SUCCESSFUL` (~1m18s); debug APK (48 MB, arm64) installed and running on device with Metro (`Android Bundled ... 786 modules`).
- **2026-10-04** — Plan created: `plan/trace-improve/04102026-implement-optimize-plan.md` (selected scope from `MD/imprement-1/imprement.md` + freeze fix). Device freeze diagnosed: unvirtualized History rows with per-row animation, per-session `SimpleDateFormat` + `getApplicationInfo`, no launcher blocklist, no session cap.
- **2026-10-04** — Plan revised per user: drop export/import/clear entirely, hide `com.*` package-name rows from UI, fix top/bottom safe-area overlap on device (SafeAreaProvider + insets + Android edge-to-edge).
- **2026-10-04** — Phase 0 implemented: History virtualized via `SectionList` (static rows, no per-row animation), Today/Apps capped at top 20 + show-all toggle, stagger capped at 12 steps, `isDisplayable` filter (`lib/usage.ts`), native label cache + shared `SimpleDateFormat` + launcher/systemui blocklist + 2000-session cap, refresh ref-guard, memoized total, `SafeAreaProvider` + insets + `edgeToEdgeEnabled`, removed export/import/clear code, uninstalled `expo-document-picker`/`expo-file-system`/`expo-sharing`, added `react-native-safe-area-context`. `tsc` exit 0. Needs device retest.
- **2026-10-04** — Phase 1 implemented (single-file `App.tsx` + new `lib/categories.ts`, `lib/prefs.ts`): 5th tab Calendar (month grid + day detail + 24h timeline + top apps), Today extras (yesterday +/-, 7-day sparkline, category stacked bar, insight card), Apps extras (search, sort, category filter, per-app detail with trend + sessions), session detail overlay linked from History/Calendar/AppDetail, Settings extras (dark mode system/light/dark, daily notification via `expo-notifications`, retention 7/30/90/unlimited with prune, TH/EN toggle, debug screen). Theme via `makeStyles` + persisted prefs. `tsc` exit 0. Pending full device test.
- **2026-10-04** — Code review: fixed unsafe date-string parse in Calendar (manual y/m/d parse, Android-safe), verified `app.json` keys via `expo config`, re-checked Kotlin edit. `tsc` exit 0.
- **2026-10-04** — History duplicates fix: native foreground/background churn created micro-sessions, minute rounding hid them as repeated "0 นาที" rows. Added `coalesceSessions` (merge same-app gap ≤30s) applied on every save/load, sub-minute display now shows seconds (`formatDuration` + lang). `tsc` exit 0.
- **2026-10-04** — Long-term 1+2 done: native allowlist via `queryIntentActivities` (non-launchable packages excluded, launcher blocklist kept), chronological sort + 30s gap merge in Kotlin before 2000-cap; delta sync via `lastSync` (60s overlap, 7-day max window) with idempotent upsert through existing `replaceDaySessions`. `tsc` exit 0. Needs device retest + native rebuild.
- **2026-10-04** — Critical delta-sync bug fixed: `replaceDaySessions` dropped all of today's stored sessions while delta query returned only the recent window (data loss every refresh). New `mergeWindow` keeps sessions starting before the query window and upserts the rest by id. `tsc` exit 0.
- **2026-10-04** — Remaining items done: pull-to-refresh on History + Calendar (`RefreshControl`), mount-effect cancellation guard, daily notification rescheduled with fresh total on every refresh, native screen-off subtraction (`SCREEN_NON_INTERACTIVE`/`SCREEN_INTERACTIVE` intervals removed from durations). HTML analysis doc updated with Delivered status. `tsc` exit 0. Needs device retest + native rebuild.
- **2026-10-04** — History regrouped by hour: day → hour blocks (e.g. 19:00–20:00) with precise totals (hours/minutes/seconds via `formatDuration` precise mode), top app + counts per block, tap to expand sessions. `tsc` exit 0.
- **2026-10-04** — AppDetail sessions fixed with shared `HourGroupItem` (same hour-block UI as History, stats moved to own card, 60-session cap). `tsc` exit 0.
- **2026-10-04** — Audit fixes: launcher `<queries>` added to manifest (package visibility on Android 11+), allowlist skipped when empty (fail-open), dead `replaceDaySessions` removed. `tsc` exit 0.
- **2026-10-04** — Audit round 2 done: overlay view-app searches all days (`summarizePackage`), calendar Today button, notification tap deep-links to Today, stale-data banner on revoked permission, accessibility labels on nav/rows/refresh, vitest suite for `usage.ts` (10 tests pass) + `test`/`typecheck` scripts. HTML doc updated. `tsc` exit 0.
- **2026-10-04** — Android back gesture: `BackHandler` pops session overlay first, then app detail, exits only at top level. `tsc` exit 0.
- **2026-10-04** — Docs synced to code: overview HTML (5 tabs, delta sync, no export), dashboard HTML (v2.0, export items cut), `TRACE-SPEC-TH.md` (new rules/structure/phases/criteria), roadmap (removed export/import/schema lines, sleep policy done). Removed dead export helpers from `lib/usage.ts`. `tsc` 0 + tests 10/10.
- **2026-10-04** — Renamed the app from `app-usage-tracker` to **TRACE** (`app.json` `expo.name` + `android/app/src/main/res/values/strings.xml` `app_name`; verified `application-label:'TRACE'`). Built a standalone release APK: `android/app/build/outputs/apk/release/app-release.apk` (30 MB, arm64-v8a, signed with the debug keystore) and copied it to the project root as `TRACE-1.0.0.apk` for sideloading. `assembleRelease` takes ~3m20s.
