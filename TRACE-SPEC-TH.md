# TRACE — App Usage Journal

เอกสารนี้เป็นสเปกและ handoff document สำหรับนำโปรเจกต์ไปพัฒนาต่อบนเครื่องของผู้ใช้

## 1. ภาพรวมผลิตภัณฑ์

TRACE เป็นแอป Android-first สำหรับติดตามว่าในแต่ละวันผู้ใช้เปิดแอปใดบ้าง เปิดกี่ครั้ง เปิดช่วงเวลาใด และแต่ละ session ใช้เวลานานเท่าไร

หลักการสำคัญ:

- ข้อมูล usage ถูกอ่านจาก Android เครื่องนั้นโดยตรง
- ประมวลผลและเก็บข้อมูลในเครื่องเป็นหลัก
- ไม่มี cloud sync หรือ login ใน MVP
- ไม่มี Export/Import — ข้อมูลอยู่บนเครื่องเท่านั้น (ตัดออก 04/10/2026)
- ไม่อ่านเนื้อหาหน้าจอ ไม่อ่านข้อความ และไม่ติดตามการกดภายในแอปอื่น

## 2. สถานะปัจจุบัน

### ทำเสร็จแล้ว

- Expo/React Native/TypeScript project (5 tabs: วันนี้/แอป/ประวัติ/ปฏิทิน/ตั้งค่า)
- หน้าจอ Dashboard วันนี้ (เทียบเมื่อวาน, sparkline 7 วัน, หมวดหมู่, insight card)
- หน้าจอรายการแอป (ค้นหา, sort, filter หมวด, หน้า detail รายแอป)
- หน้าจอ History รวมเป็นรายชั่วโมง + session overlay
- หน้าจอ Calendar (month grid, day detail, timeline 24 ชม., top apps)
- หน้าจอ Settings (dark mode, retention, TH/EN, debug) — แจ้งเตือนรายวันตัดออก 10/10/2026
- Local storage ด้วย AsyncStorage + prune ตาม retention
- Delta sync ด้วย `lastSync` (อ่านเฉพาะ event ใหม่, upsert ตาม id)
- Android native module `UsageAccessModule`
- อ่าน `UsageStatsManager` และแปลง foreground/background events เป็น session
- Allowlist แอปที่เปิดได้จริง + blocklist launcher/system + รวม gap 30 วินาที + หักเวลาปิดจอ
- เพิ่ม permission `PACKAGE_USAGE_STATS` + launcher `<queries>`
- ปุ่มเปิด Android Usage Access Settings
- Android back gesture ถอยทีละชั้น (overlay → detail → ออก)
- Unit tests `lib/usage.test.ts` (10 tests, `pnpm test`)
- Release APK ที่ฝัง JavaScript bundle แล้ว ไม่ต้องใช้ Metro

### สิ่งที่ยังต้องทดสอบบนโทรศัพท์จริง

- การให้สิทธิ์ Usage Access บน Android รุ่นของผู้ใช้
- ความถูกต้องของ event บนผู้ผลิตแต่ละราย เช่น Samsung, Xiaomi, Oppo, Vivo
- การนับ session เมื่อมีหน้าต่าง overlay หรือ multi-window
- กรณีเครื่องพักหน้าจอหรือระบบ kill process
- การอ่าน session ที่ยังเปิดอยู่ในขณะที่ผู้ใช้กด refresh
- การติดตั้ง APK บนอุปกรณ์จริงหลาย architecture
- การแสดงผล timezone และวันปัจจุบันบนเครื่องจริง

## 3. ขอบเขต MVP

### 3.1 Dashboard วันนี้

ต้องแสดง:

- เวลาที่ใช้งานรวมวันนี้
- จำนวนแอปที่เปิด
- จำนวนครั้งที่เปิดทั้งหมด
- เวลาใช้งานเฉลี่ยต่อครั้ง
- รายการแอปเรียงตามเวลารวม
- สถานะว่า Usage Access เปิดหรือยัง
- ปุ่ม refresh เพื่ออ่านข้อมูลจริงจาก Android

ถ้ายังไม่ได้ให้สิทธิ์ Usage Access:

- ต้องไม่สร้าง mock data
- แสดงข้อมูลว่างหรือข้อความให้ไปเปิดสิทธิ์
- แสดงสถานะ `ยังไม่อนุญาต`

### 3.2 รายการแอป

แต่ละรายการต้องมี:

- ชื่อแอป
- package name ภายใน model
- จำนวนครั้งที่เปิด
- เวลารวม
- เวลาเปิดล่าสุด
- ไอคอนหรืออักษรย่อของแอป

### 3.3 รายละเอียด session

แต่ละ session มี:

- `id`
- `packageName`
- `appName`
- `startedAt` เป็น ISO 8601
- `endedAt` เป็น ISO 8601
- `durationSeconds`

### 3.4 History

- ดูข้อมูลย้อนหลังจาก local storage
- จัดกลุ่มตามวัน
- แสดงเวลาเริ่ม–สิ้นสุด
- แสดง duration ของแต่ละ session

### 3.5 Export — ตัดออกแล้ว (04/10/2026)

ไม่มีฟีเจอร์ Export ในแอปปัจจุบัน ข้อมูลอยู่บนเครื่องเท่านั้น

### 3.6 Import — ตัดออกแล้ว (04/10/2026)

ไม่มีฟีเจอร์ Import ในแอปปัจจุบัน

## 4. Android native behavior

### Permission

ต้องมี permission ใน Android manifest:

```xml
<uses-permission
    android:name="android.permission.PACKAGE_USAGE_STATS"
    tools:ignore="ProtectedPermissions" />
```

สิทธิ์นี้ผู้ใช้ต้องเปิดเองใน Settings ไม่ใช่ runtime permission แบบกล้องหรือ location

### API ที่ใช้

- `UsageStatsManager.queryEvents(startMillis, endMillis)`
- `UsageEvents.Event.ACTIVITY_RESUMED`
- `UsageEvents.Event.ACTIVITY_PAUSED`
- `UsageEvents.Event.MOVE_TO_FOREGROUND`
- `UsageEvents.Event.MOVE_TO_BACKGROUND`

### Sessionization rule ปัจจุบัน

1. เมื่อพบ foreground/resumed event ให้จำเวลาเริ่มของ package
2. เมื่อพบ background/paused event ให้ปิด session
3. ถ้าไม่มี event ปิด ให้ใช้เวลาปัจจุบันเป็นเวลาสิ้นสุดตอน refresh
4. ข้าม package ของ TRACE เอง + launcher/system blocklist
5. เก็บเฉพาะ package ที่เปิดได้จริง (`queryIntentActivities` allowlist)
6. เรียง events ตามเวลา แล้วรวม session เดิมที่ห่าง ≤ 30 วินาที
7. หักช่วงเวลาปิดจอ (`SCREEN_NON_INTERACTIVE`–`SCREEN_INTERACTIVE`) ออกจาก duration
8. ข้าม session ที่ active duration น้อยกว่า 1 วินาที
9. ส่งคืนมากสุด 2000 sessions ล่าสุด
10. ใช้ package manager อ่านชื่อแอป (มี label cache)

### Sync rule (JS)

1. จำ `lastSync` ทุกครั้งที่ refresh สำเร็จ
2. อ่าน event ตั้งแต่ `lastSync − 60 วินาที` ย้อนได้เท่า retention (ไม่จำกัด = 90 วัน, อย่างน้อย 7 วัน) ครั้งแรกที่ยังไม่มี `lastSync` ดึงทั้งช่วงนี้ ไม่ใช่แค่หลังเที่ยงคืน
3. `mergeWindow` เก็บ session นอก window + upsert ตาม id
4. `coalesceSessions` รวม gap ≤ 30 วินาที + `pruneSessions` ตาม retention ทุกครั้งที่ save

### จุดที่ต้องปรับปรุง

- รองรับ event ซ้ำและ event สลับ package เร็วมาก (single open slot ต่อ package)
- เพิ่มการบันทึก source และ confidence ของ session
- ทดสอบกับ Android API 29–36

## 5. โครงสร้างโปรเจกต์

```text
app-usage-tracker/
├── App.tsx
├── components/
│   ├── Today.tsx
│   ├── Apps.tsx
│   ├── HistoryList.tsx
│   ├── CalendarView.tsx
│   ├── Settings.tsx
│   ├── SessionOverlay.tsx
│   ├── ui.tsx
│   └── theme.ts
├── app.json
├── package.json
├── pnpm-lock.yaml
├── index.ts
├── tsconfig.json
├── lib/
│   ├── usage.ts
│   ├── usageBridge.ts
│   ├── categories.ts
│   ├── prefs.ts
│   └── usage.test.ts
├── android/
│   └── app/src/main/
│       ├── AndroidManifest.xml
│       └── java/com/anonymous/appusagetracker/
│           ├── MainApplication.kt
│           ├── UsageAccessModule.kt
│           └── UsageAccessPackage.kt
├── assets/
├── README.md
└── TRACE-SPEC-TH.md
```

### หน้าที่ของไฟล์หลัก

- `App.tsx`: shell, 5 tabs, navigation state, load/refresh, prefs
- `components/`: หน้าจอแต่ละแท็บ, ชิ้นส่วนร่วม (`ui.tsx`), สไตล์ (`theme.ts`)
- `lib/usage.ts`: model, local storage, merge/coalesce, lastSync, date utility, duration formatting
- `lib/usageBridge.ts`: JavaScript interface ไปยัง Android native module
- `lib/categories.ts`: หมวดแอป + day helpers
- `lib/prefs.ts`: theme/lang/retention prefs + ข้อความ TH-EN
- `lib/usage.test.ts`: unit tests (vitest)
- `UsageAccessModule.kt`: อ่าน UsageStatsManager, pairing/coalesce, allowlist, หักเวลาจอดับ, เปิด Settings
- `UsageAccessPackage.kt`: ลงทะเบียน native module
- `AndroidManifest.xml`: ประกาศ Usage Access permission + launcher queries
- `MainApplication.kt`: register package ของ native module

## 6. งานที่ต้องทำต่อ แนะนำตามลำดับ

### Phase 1 — ทดสอบ APK ปัจจุบัน

1. ติดตั้ง release APK บนโทรศัพท์
2. เปิด Usage Access
3. ใช้งาน YouTube/Chrome/LINE หรือแอปอื่นอย่างน้อย 1–3 นาที
4. กลับ TRACE และกด refresh (หรือดึง pull-to-refresh)
5. ตรวจว่าชื่อแอป เวลา และ duration ถูกต้อง (ไม่มีแถว `com.*`, ไม่มี "0 นาที" ซ้ำ)
6. ทดสอบปิด/เปิด TRACE ใหม่แล้วข้อมูลยังอยู่
7. ทดสอบ refresh ซ้ำติดกัน + ปิดจอแล้วเปิด (duration ต้องไม่รวมเวลาปิดจอ)

### Phase 2 — แก้ความถูกต้องของข้อมูล (เสร็จส่วนใหญ่)

- เพิ่ม test cases สำหรับ event sequence — เสร็จ (`usage.test.ts`, 10 tests)
- Delta sync + screen-off subtraction — เสร็จ
- แยก timezone ของการแสดงผลออกจาก timestamp ที่เก็บ — ยังไม่ทำ
- เพิ่ม auto-refresh เมื่อกลับเข้า foreground — ยังไม่ทำ

### Phase 3 — ปรับ UX (เสร็จ)

- หน้ารายละเอียดรายแอป, timeline ราย session, search/filter — เสร็จ
- กราฟรายชั่วโมง (History รวมรายชั่วโมง), retention setting — เสร็จ
- Calendar dashboard, dark mode, TH/EN — เสร็จ
- Import/replace confirmation — ไม่ทำแล้ว (ตัด Import ออก)

### Phase 4 — Release quality

- เปลี่ยน application ID จาก `com.anonymous.appusagetracker` เป็นชื่อจริง
- เปลี่ยน app name และ launcher icon
- สร้าง release keystore ของเจ้าของโปรเจกต์
- อย่าใช้ debug signing สำหรับ production
- ตั้ง versionCode/versionName
- เปิด minify/shrink หลังทดสอบแล้ว
- ทดสอบ APK บนอุปกรณ์จริงอย่างน้อย 2 รุ่น
- เตรียม privacy policy เพราะข้อมูล usage เป็นข้อมูลส่วนบุคคล

## 7. วิธีติดตั้ง APK เพื่อทดสอบ

ใช้ไฟล์ release APK ที่ส่งมาพร้อมโปรเจกต์:

```text
TRACE-app-usage-real-release.apk
```

บนโทรศัพท์:

1. ดาวน์โหลดไฟล์ APK
2. เปิดไฟล์จาก Downloads/File Manager
3. อนุญาตติดตั้งจากแหล่งที่ไม่รู้จัก หาก Android ถาม
4. ติดตั้ง
5. เปิดแอป
6. ไปที่ Settings ของ TRACE แล้วเปิด Usage Access

แนะนำให้ถอน APK debug รุ่นเก่าก่อนติดตั้ง release รุ่นใหม่ หาก Android แจ้ง package/signature conflict

## 8. วิธีพัฒนาต่อบนเครื่องของผู้ใช้

### ความต้องการของเครื่อง

- Node.js 22 หรือ LTS รุ่นใหม่
- pnpm
- Java 17 หรือ 21
- Android Studio หรือ Android command-line tools
- Android SDK Platform 36
- Android Build Tools 36
- Android NDK ตามที่ Expo/Gradle ระบุ
- Android device หรือ emulator

### ตั้งค่าและรันตรวจสอบ

```bash
cd app-usage-tracker
pnpm install
pnpm typecheck
pnpm test
```

### เปิด web preview สำหรับดู UI

```bash
pnpm run web
```

หมายเหตุ: web preview ใช้ทดสอบ UI และ local flow บางส่วนเท่านั้น ไม่สามารถทดสอบ UsageStatsManager ได้

### Build debug APK

```bash
cd android
./gradlew assembleDebug --no-daemon
```

ไฟล์จะอยู่ที่:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Debug APK ต้องใช้ Metro หากเปิดแบบ standalone ดังนั้นไม่ใช่ไฟล์ที่ควรส่งให้ผู้ใช้ทั่วไป

### Build release APK แบบฝัง bundle

```bash
cd android
./gradlew assembleRelease --no-daemon
```

ไฟล์จะอยู่ที่:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Release APK ปัจจุบันใช้ debug keystore ตาม starter config จึงเหมาะสำหรับการทดสอบติดตั้งเองเท่านั้น ควรเปลี่ยนเป็น keystore ของเจ้าของโปรเจกต์ก่อนเผยแพร่จริง

## 9. วิธีดาวน์โหลดโปรเจกต์จากไฟล์ ZIP

1. ดาวน์โหลดไฟล์ `TRACE-app-usage-tracker-source-latest.zip`
2. แตกไฟล์ลงโฟลเดอร์ที่ต้องการ
3. เปิด terminal ในโฟลเดอร์โปรเจกต์
4. รัน:

```bash
pnpm install
pnpm exec tsc --noEmit
```

5. อ่านเอกสารนี้และ `README.md`
6. ถ้าต้องการ build APK ให้ตรวจสอบ Android SDK ก่อน
7. สร้าง release APK ด้วยคำสั่งในหัวข้อก่อนหน้า

ZIP ไม่รวม `node_modules` และ `dist` เพื่อให้ไฟล์เล็กลงและติดตั้ง dependency ใหม่ได้สะอาด

## 10. ข้อจำกัดและความเป็นส่วนตัว

- Android อาจจำกัดหรือหน่วง UsageEvents ตามผู้ผลิตเครื่อง
- Usage Access ไม่ได้บอกทุก interaction ภายในแอป
- duration เป็นค่าประมาณจาก foreground/background events
- ไม่ควรอ้างว่าเป็น time tracking ที่แม่นยำระดับวินาทีในทุกสถานการณ์
- ข้อมูล package name และพฤติกรรมการใช้แอปเป็นข้อมูลส่วนบุคคล
- ก่อนเผยแพร่ควรเพิ่ม privacy policy และอธิบายเหตุผลของ Usage Access ให้ชัดเจน
- ไม่ควรเพิ่ม Accessibility Service เพียงเพื่อแก้ความแม่นยำ เว้นแต่มีเหตุผลและการออกแบบ permission ที่เหมาะสม

## 11. Acceptance criteria สำหรับรุ่นถัดไป

- เปิดแอปครั้งแรกแล้วไม่มี mock data
- ถ้าไม่มี Usage Access ต้องเห็นสถานะสิทธิ์ชัดเจนและข้อมูลว่าง
- เมื่อเปิด Usage Access แล้ว refresh ต้องอ่านแอปจริงอย่างน้อยหนึ่งรายการ
- ต้องแสดง package name และ app name ที่ตรงกับ Android
- session ต้องมี startedAt, endedAt และ durationSeconds ที่สมเหตุสมผล
- ปิดและเปิด TRACE ใหม่แล้วข้อมูลที่บันทึกไว้ยังคงอยู่
- refresh ซ้ำติดกันต้องไม่สร้าง session ซ้ำ (upsert ตาม id)
- ไม่มีแถวชื่อ `com.*` และไม่มี session ของ launcher/system
- เวลาปิดจอต้องไม่ถูกนับเป็นเวลาใช้แอป
- release APK ต้องเปิดได้โดยไม่ใช้ Metro
- ต้องไม่ส่ง usage history ขึ้น server โดยค่าเริ่มต้น
