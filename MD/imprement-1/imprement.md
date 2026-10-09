สร้าง plan ไห้หน่อย
---
### Today — หน้าวันนี้
**ควรเพิ่ม**
*เปรียบเทียบกับเมื่อวาน*
- +/- % เทียบเมื่อวาน, สีเขียว/แดง
- Sparkline mini chart 7 วันย้อนหลัง
*Top Category Breakdown*
- แบ่งหมวด: Social / Games / Productivity / Other
- Horizontal stacked bar
*Quick Insight Card*
- "วันนี้ใช้ Social Media 45 นาที (+22% จากเมื่อวาน)"
- เปลี่ยนทุกครั้งที่ refresh

### Apps — หน้าแอปที่ใช้
*Per-app Detail Screen*
- แตะแอป → เข้าหน้ารายละเอียด
- Sessions list, daily trend graph, average duration
- Usage limit set/notify (future)
*App Categories / Tags*
- Auto-detect จาก package name หรือ user ตั้งเอง
- Filter by category, group view
*Weekly / Monthly Trend per App*
- Mini sparkline 7 วัน
- Trend up/down badge
*Search / Filter*
- Search bar หาชื่อแอป
- Sort: time / launches / name / last opened
*App Icon Display*
- ใช้ Expo ApplicationIcon API ดึง icon จริง
- fallback เป็น initial letter (ปัจจุบัน)

### History — หน้าประวัติ
*Calendar Dashboard*
- ดูข้อมูลรายเดือนเป็นปฏิทิน
- คลิกวัน → ดูรายละเอียดแอป
- ดีไซน์ด้านล่างนี้
*Date Picker / Month Navigation*
- เลือกวัน/เดือน/ปี
- Jump to today button
*Timeline View*
- แนวนอน 24 ชม. แสดงสีแต่ละแอป
- แตะช่วง → ดู session detail
*Session Detail*
- แตะ session → แสดง app name, exact times, duration
- Link ไปหน้า app detail
*Day Summary Card*
- Total time, app count, top 3 apps ของวันนั้น

### Settings — หน้าตั้งค่า
*Dark Mode Toggle*
- ใช้ useColorScheme + Appearance API
- Toggle in settings, persist choice
*Notification Settings*
- Daily usage summary notification
- Usage limit alerts
- ใช้ expo-notifications
*Data Retention Setting*
- 7 / 30 / 90 days / unlimited
- Auto-prune old sessions
*Language / Locale*
- TH/EN toggle
*Debug Screen*
- Raw event log, session count, storage size
- สำหรับ dev / troubleshoot

---
### History — หน้าประวัติ
ฉันลองเปิดทดสอบเปิดจริงแล้ว ค้างหลังจากที่กด และมี app ที่ไม่ควรแสดงเช่น com.nothing.launcher