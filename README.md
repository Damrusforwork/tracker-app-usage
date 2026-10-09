# TRACE — App Usage Journal

Android-first local app for reviewing app launches, sessions and time spent. The current prototype includes:

- Today dashboard, app summaries and history
- Local persistence with AsyncStorage
- JSON Export via system share sheet
- JSON Import with merge-by-session-id behavior
- Delete-all local data
- Demo data to preview the experience before Android Usage Access is connected

## Current limitation

The Sandbox does not have Android SDK, ADB or Gradle. The UI and local data flows can be developed and checked here, but an installable APK requires an Android build environment. The next native phase should add a Kotlin/Android bridge around `UsageStatsManager`, request `PACKAGE_USAGE_STATS`, and replace the demo repository with real UsageEvents.

## Run

```bash
pnpm start
pnpm run web
```

## Android native phase

Use a custom development/release build (not Expo Go) after adding the native module. Required behavior:

- Read foreground/background events from `UsageStatsManager`
- Convert events into sessions with sensible handling for device sleep and missing events
- Send normalized sessions to the React Native repository
- Open Android Usage Access settings from the Settings screen
- Test on a physical Android device
