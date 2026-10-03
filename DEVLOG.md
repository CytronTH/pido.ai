# 📖 PiDo.AI - Development Log

ไฟล์นี้ใช้สำหรับบันทึกความคืบหน้าของการพัฒนาโปรเจ็กต์ ปัญหาที่พบ การตัดสินใจทางเทคนิค และแผนงานต่อไป เพื่อรักษาความต่อเนื่อง (Continuity) ในการทำงาน

---

<!-- คัดลอก Template ด้านล่างนี้ไปใช้สำหรับสร้าง Entry ใหม่ โดยให้วางไว้ด้านบนสุด (ต่อจากเส้นคั่นนี้) -->
<!-- 
## [YYYY-MM-DD] - สรุปงานสั้นๆ

### 🎯 เป้าหมาย (Goals)
- [ ] 

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- 

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** 
- **เหตุผล:** 

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- 

### ⏭️ ก้าวต่อไป (Next Steps)
- 
-->

## [2026-10-04] - จัดหมวดหมู่ Available Widgets, แก้ไอคอน Video Stream และเพิ่ม Visual Range Editor สำหรับ Dynamic Colors

### 🎯 เป้าหมาย (Goals)
- [x] แก้ไอคอน Video Stream ในเมนู Available Widgets ที่แสดงผิด
- [x] แบ่ง widget ในเมนู Available Widgets เป็นหมวดหมู่
- [x] เปลี่ยนการตั้งค่า Dynamic Colors & Ranges จากช่องกรอกตัวเลข เป็นแบบ visualize

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **ไอคอน Video Stream:** label เดิมมี byte เสีย (`\xef\xbf\xbd` = U+FFFD) แทนที่ด้วย Lucide `<Video />`
- **หมวดหมู่ widget (`LiveDashboard.jsx`):** เพิ่ม `WIDGET_CATEGORIES` 5 หมวด (Media & AI Vision / Metrics & Gauges / Charts & Analytics / Data & Telemetry / Controls & Actions) และสร้าง `WIDGET_TYPES` จาก `flatMap` เพื่อให้โค้ดเดิมยังใช้ได้
- **Visual Range Editor (`WidgetSettingsModal.jsx`):**
  - แถบพรีวิวช่วงสี 0–100% แบบ live
  - Quick Presets (`PRESET_COLOR_STOPS`): Traffic Light, Cool to Hot, Battery, Pass/Alert
  - การ์ดแต่ละโซน: slider + ช่องตัวเลข + swatch สีด่วน (`QUICK_COLORS`) + color picker
  - ปุ่ม Auto-sort (`handleSortColorStops`) และ `handleAddColorStop` ที่เดาค่า limit/สีเริ่มต้นให้
- ลบ import `RadialDonutWidget` / `CapacityBarWidget` ที่ไม่ได้ใช้แล้วหลังรวมเข้า Gauge

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** คงรูปแบบ `colorStops: { limit, color }[]` เดิม
- **เหตุผล:** `GaugeWidget` / `CapacityBarWidget` sort ตาม `limit` อยู่แล้ว จึงเข้ากันได้ย้อนหลังโดยไม่ต้อง migrate config

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- warning เดิมจาก `dev`: duplicate key `unit` / `thresholdMin` ใน initial `formData` ของ `WidgetSettingsModal.jsx` (ยังไม่แก้ เพราะอยู่นอก scope)

### ⏭️ ก้าวต่อไป (Next Steps)
- ทดสอบ UI ในเบราว์เซอร์ และส่ง Code Review ก่อน merge เข้า `dev`

---

## [2026-10-04] - รวม Gauge/Radial Donut/Capacity Bar เป็น Widget เดียว และจัดระเบียบการ์ด Widget Settings ให้เป็นมาตรฐานเดียวกัน

### 🎯 เป้าหมาย (Goals)
- [x] ยุบรวม Widget Gauge, Radial Donut และ Capacity Bar ให้มาอยู่ใน `⏱️ Gauge` Widget เดียว
- [x] จัดระเบียบกล่องตั้งค่าฟีเจอร์ใน `WidgetSettingsModal.jsx` ทุกแท็บให้มีลักษณะดีไซน์สวยงามและเป็นมาตรฐานเดียวกัน (Consistent UI)
- [x] คงความเข้ากันได้ย้อนหลัง (Backward Compatibility) ให้กับ Dashboard เก่าที่มี radialDonut หรือ capacityBar

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **รวม Gauge Widget Styles:**
  - ยุบ `RadialDonut` และ `CapacityBar` มารวมไว้ใน `GaugeWidget.jsx` โดยรองรับ 4 สไตล์ผ่าน dropdown `Gauge Style`:
    1. `half-circle`: Modern Half-Circle Gauge
    2. `horseshoe`: Horseshoe with Needle
    3. `radial-donut`: Radial Donut Chart
    4. `capacity-bar`: Capacity Bar (Linear Tube ปรับได้ทั้ง Horizontal / Vertical)
  - ใน `LiveDashboard.jsx`: นำ `radialDonut` และ `capacityBar` ออกจากรายการ Add Widget และแมป render ย้อนหลังมาที่ `GaugeWidget` อัตโนมัติ
  - ใน `WidgetSettingsModal.jsx`: ปรับปรุง Preview ให้แสดงผลทุกสไตล์ได้อย่างถูกต้องแม่นยำ
- **จัดระเบียบกล่องตั้งค่า (Consistent Setting Cards):**
  - ปรับดีไซน์กล่องสวิตช์ Toggle และกล่องตั้งค่าในทุกแท็บ (General, Appearance, Limits & Alerts) ให้ใช้โครงสร้าง `p-3.5 rounded-xl border border-line-strong/60 bg-surface-2/40 hover:border-line-strong transition-colors`
  - มี Title (`text-sm font-semibold text-fg`) และคำอธิบายย่อย Subtitle (`text-xs text-fg-subtle font-normal mt-0.5`) ชัดเจนทุกกล่อง
  - เมื่อเปิดสวิตช์ ส่วนปรับแต่งย่อยจะแสดงผลต่อท้ายด้วยเส้นคั่น `pt-3 border-t border-line-strong/50` อย่างเป็นระเบียบ เรียบร้อย และกลมกลืน

---

## [2026-10-04] - เพิ่มฟีเจอร์ Trend Indicator, Compact Notation และ Card Alert Glow ให้กับ Number Widget

### 🎯 เป้าหมาย (Goals)
- [x] ฟีเจอร์ที่ 1: Trend / Delta Indicator (ลูกศรขึ้น/ลง ▲/▼ พร้อม % หรือค่าความต่างเมื่อเทียบกับค่าก่อนหน้า)
- [x] ฟีเจอร์ที่ 4: Compact Notation (ตัวย่อ K, M, B เช่น 1.5K, 2.3M, 1.2B)
- [x] ฟีเจอร์ที่ 5: Background Card Glow on Alert (แสงนีออนเรืองเตือนรอบขอบการ์ดเมื่อค่าเกินเกณฑ์/Trigger Alert)

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Trend / Delta Indicator (ฟีเจอร์ที่ 1):**
  - ใน `MetricWidget.jsx`: ใช้ `useRef` และ `useEffect` ตรวจสอบความเปลี่ยนแปลงของค่า scalar แบบเรียลไทม์ คำนวณความต่าง (`diff`) และเปอร์เซ็นต์ (`pct`)
  - รองรับการปรับ `trendMode` ทั้งแบบ Percentage (`+5.4%`) และแบบ Difference Value (`+12`)
  - รองรับการตั้งค่าสีทิศทางบวก `trendPositiveColor`: เลือกได้ว่าจะให้ลูกศรขึ้นเป็นสีเขียว (Green = Good) หรือสีแดง (Red = Alert/Bad เช่น วัดความร้อนหรือ error)
  - จัดวาง badge ร่วมกับ unit ได้ทั้งโหมด `inline` (วางไว้ใต้ตัวเลขอย่างสวยงาม) และโหมด `below` (วางเคียงข้าง unit)
  - รองรับ Mock Trend Preview ใน `WidgetSettingsModal.jsx` เมื่อเปิดใช้งาน ให้ผู้ใช้เห็นตัวอย่างผลลัพธ์ทันทีขณะตั้งค่า
- **Compact Notation (ฟีเจอร์ที่ 4):**
  - เพิ่มฟังก์ชัน `formatCompact(num, decimals)` ย่อตัวเลขขนาดใหญ่ (≥1K -> K, ≥1M -> M, ≥1B -> B) พร้อมจัดการทศนิยมและเครื่องหมายลบ
  - เพิ่ม toggle สวิตช์ในแท็บ General ของ Settings Modal
- **Background Card Glow on Alert (ฟีเจอร์ที่ 5):**
  - ออกแบบเอฟเฟกต์แสงนีออนเรือง (Neon Card Glow) เมื่อ Widget อยู่ในสถานะ Alert ด้วย `border-2 border-red-500 bg-gradient-to-b from-red-500/15 via-red-950/20 to-surface shadow-[0_0_30px_rgba(239,68,68,0.45)] animate-pulse`
  - เพิ่มตัวเลือกเปิด/ปิด Card Neon Glow ในแท็บ Limits & Alerts ของ Settings Modal

---

## [2026-10-04] - พัฒนาฟีเจอร์ Number Widget (อัปเกรดจาก Metric) บน Dashboard

### 🎯 เป้าหมาย (Goals)
- [x] เปลี่ยนชื่อ Metric Widget เป็น Number เพื่อความเข้าใจง่ายสำหรับผู้ใช้ใหม่
- [x] เพิ่มฟีเจอร์เลือกตำแหน่งของ Unit Suffix / Label (ต่อหลังตัวเลข หรือ อยู่ใต้ตัวเลข)
- [x] ปรับช่องไฟตัวอักษรของ Unit Suffix / Label ไม่ให้ติดกันเกินไป (`tracking-wider`)
- [x] ใส่เครื่องหมายจุลภาค (Comma `,`) คั่นหลักพันให้อัตโนมัติ

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **เปลี่ยนชื่อเป็น Number:** เปลี่ยน Label ใน `LiveDashboard.jsx` เป็น `🔢 Number` และอัปเดตชื่อใน Header และ Setting Modal
- **ฟีเจอร์ Unit Position:** เพิ่มตัวเลือก `unitPosition` ใน `WidgetSettingsModal.jsx` เลือกระหว่าง "ต่อหลังตัวเลข (Behind / Inline)" หรือ "อยู่ใต้ตัวเลข (Below Number)"
- **แก้ปัญหาตัวอักษร Unit ชิดกัน:** เพิ่ม `tracking-wider font-semibold ml-2.5` ให้ตัวอักษร Unit มีช่องไฟสวยงาม ชัดเจน ไม่โดน tracking-tighter ของตัวเลขดึง
- **ใส่ Comma คั่นหลักพันอัตโนมัติ:** ใช้ฟังก์ชัน `formatWithCommas` แยกส่วนหน้าจุดทศนิยมและคั่นหลักพันด้วย regex `/\B(?=(\d{3})+(?!\d))/g` สวยงามและแม่นยำ

---

## [2026-10-04] - แก้บั๊ก Dashboard Widgets (Data Source Binding N/A, Video Widget Data Path ผีหลอก, และ ROI / AI FPS Overlay หาย)

### 🎯 เป้าหมาย (Goals)
- [x] แก้ปัญหา dropdown Data Source Binding ใน Widget Settings Modal ขึ้น `[N/A]` ทั้งที่ pipeline ส่งค่าแบบเรียลไทม์
- [x] แก้ปัญหา Video Widget เล่นวิดีโอแม้ dataPath ไม่มีอยู่จริงบน pipeline (หรือถูกลบ/ไม่ได้เชื่อมต่อ)
- [x] แก้ปัญหา Video Widget ไม่วาด ROI Zone, AI FPS (มุมขวาบน) และ Bounding Box บนหน้า Dashboard
- [x] ตรวจสอบและแก้ไขการส่งค่า props ให้ Dashboard widgets ทั้งหมดบน Live Dashboard

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **บั๊ก Data Source Binding N/A:** ใน `LiveDashboard.jsx` ลืมส่ง prop `metadata={metadata}` ให้ `<WidgetSettingsModal>` ทำให้ metadata เป็น `{}` เสมอ แก้โดยส่ง metadata เข้าไป และปรับปรุง `getNestedValue` กับ `formatDisplayVal` ใน `WidgetSettingsModal.jsx`
- **บั๊ก Video เล่นแม้ไม่มี dataPath จริงบน pipeline:** 
  - เดิมที `VideoWidget.jsx` มี fallback ต่อตรงไปหา raw camera `shared_${config.camera_id}` หรือใช้ `config.stream_id` เก่าที่ค้างอยู่ใน widget config ทำให้ยังคงดึงสตรีมขึ้นมาเล่นได้แม้ node ใน pipeline ถูกลบไปแล้ว
  - แก้โดยให้ `LiveDashboard.jsx` ส่ง `dataSources` (สตรีมวิดีโอที่ pipeline expose ออกมาจริง) ให้ `VideoWidget.jsx`
  - หาก `dataPath` ไม่ได้เชื่อมต่อหรือไม่อยู่บน pipeline อีกต่อไป (`isDanglingPath`) จะตัดการเชื่อมต่อ WHEP ทันที และแสดง UI แจ้งเตือน "Data path not found on pipeline" ป้องกันการเล่นวิดีโอผีหลอก
- **บั๊ก ROI และ AI FPS ไม่แสดงบน Video Widget:**
  - ใน `App.jsx` มีการดักจับข้อความ high-frequency metadata (`ai_metadata`) แล้ว dispatch ออกไปเป็น CustomEvent ที่ระดับ window เพื่อหลีกเลี่ยงการ re-render React DOM ที่ 30fps แต่ใน `VideoWidget.jsx` ยังคงรอรับค่าจาก React prop `metadata` อย่างเดียว ทำให้ canvas loop ไม่เคยได้รับข้อมูล AI ล่าสุด
  - เพิ่ม Event Listener `ai_metadata` ใน `VideoWidget.jsx` อัปเดต `latestMetadataRef` แบบ zero-copy ไม่กระตุก React
  - แก้ไขใน `backend/ai_engine/hailo_worker.py` ให้แนบ `metadata["roi"]` เสมอเมื่อมีการเปิดใช้งาน ROI (`roi_enabled` หรือ `show_roi`)
  - วาด ROI Zone (กรอบเส้นประสีส้มพร้อมป้าย ROI ZONE), AI FPS สีเขียว/เหลือง/แดงที่มุมขวาบน และ Bounding Box บน Canvas ได้อย่างสมบูรณ์
- **บั๊ก Video Widget showTitle ปิดแล้วไม่หาย:**
  - เดิมใน `VideoWidget.jsx` แสดง icon กล้องและ title text เสมอโดยไม่ได้เช็ค `config?.showTitle`
  - ครอบด้วย `{config?.showTitle !== false && (...)}` ซ่อน title และ icon กล้องอย่างถูกต้องเมื่อผู้ใช้ปิด Show Title ใน settings
- **ปรับปรุง Data Source Dropdown สำหรับ Video:**
  - วิดีโอสตรีมไม่มีค่าตัวเลขแบบ realtime ค่า `[${displayVal}]` จึงแสดงเป็น `[N/A]` หรือค่าว่างซึ่งทำให้สับสน
  - ปรับใน `WidgetSettingsModal.jsx` ไม่ให้แสดงวงเล็บค่า realtime สำหรับ source ที่เป็น `video` แสดงเฉพาะชื่อ data path สะอาดตา
- **ปรับปรุง Title Style ของทุก Dashboard Widget ให้เป็นมาตรฐานเดียวกัน:**
  - กำหนดมาตรฐาน Header Bar ทุก Widget เป็น `bg-surface-2/80 px-3 py-2 flex items-center justify-between border-b border-line-strong shrink-0`
  - ไอคอนขนาด 16px (`shrink-0`) พร้อมสี accent ตามประเภท widget
  - ข้อความ Title ใช้ `text-xs sm:text-sm font-semibold text-fg truncate` แทน uppercase และสีจางเดิม
  - รองรับการปิด Show Title (`config.showTitle === false`) สอดคล้องกันทุกตัว (`GaugeWidget`, `MetricWidget`, `ChartWidget`, `CapacityBarWidget`, `RadialDonutWidget`, `TrafficLightWidget`, `TextWidget`, `TextFeedWidget`, `TargetTrackerWidget`, `HistoricalChartWidget`, `ActionButtonsWidget`, `AlertsFeedWidget`, `PipelineStatusWidget`, `SystemResourceWidget`, `SnapshotsWidget`, `LogWidget`, `HeatmapWidget`)
- **แก้ปัญหา Gauge Widget มี Inner Shadow ที่กรอบ:**
  - ตรวจพบว่า `GaugeWidget.jsx` มีการใส่คลาส `shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]` แบบ hardcoded บนการ์ดด้านนอก ทำให้เกิดเงามืดวงในรอบขอบกรอบ
  - แก้ไขโดยเอา inset shadow ออก แล้วเปลี่ยนมาใช้เงา `shadow-xl` และ `border-line` มาตรฐานเหมือน widget อื่นๆ
- **Widget Props อื่นๆ:** เชื่อมต่อ props `value`, `unit`, `config` ให้ `GaugeWidget`, `TrafficLightWidget`, `RadialDonutWidget`, `CapacityBarWidget`, `TargetTrackerWidget`, และ `MetricWidget` บน `LiveDashboard.jsx`
- ทดสอบ build ด้วย Vite ผ่านฉลุย 100% และ oxlint 0 errors

---

## [2026-10-04] - ยกเครื่องระบบ Theme เป็น Semantic Design Tokens (Light/Dark/System) และจัดระเบียบ Git Remote / Repository

### 🎯 เป้าหมาย (Goals)
- [x] แก้ระบบ theme ให้ light/dark ทำงานถูกต้องและสอดคล้องกันทั้ง platform
- [x] วางรากฐานให้ฟีเจอร์ใหม่ออกแบบตาม theme ได้ง่าย (single source of truth)
- [x] จัดระเบียบ remote ให้ใช้ `CytronTH/pido.ai` เป็นหลัก และแยก Model Studio ออกไป

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Bug หลักที่พบ:** Tailwind v4 `dark:` ผูกกับ `prefers-color-scheme` ของ OS (ไม่ใช่ class `.dark`) + มี gray-scale inversion ซ้อน ทำให้ผู้ใช้ที่ OS เป็น Light เห็น UI กลับด้าน/ปนกัน
- เพิ่ม `@custom-variant dark` และ semantic tokens ใน `frontend/src/index.css`: `canvas`, `surface-*`, `line-*`, `fg-*`, `primary`, status, `chart-*`, `shadow-well`
- Codemod ~3,200 class (100 ไฟล์) จาก gray/slate + `dark:` pairs → tokens พร้อมซ่อม class ที่ script `fix_*.py` เดิมทำพัง (~120 จุด)
- Accent pass: `text-X-400` → `text-X-600 dark:text-X-400`, tints `bg-X-900/40` → `bg-X-100 dark:bg-X-900/40`
- `store/useThemeStore.js` (Zustand): light/dark/system, persist, cross-tab sync, ตาม OS แบบ live; inline script ใน `index.html` กัน flash
- Recharts (`chartTheme`), ReactFlow (`colorMode`), SVG Gauge, ROI Editor inline styles → CSS variables
- ลบ `App.css`, `getAdaptiveColor`, และ `fix_*.py`/`refactor_theme.py` 13 ไฟล์
- เอกสาร: `frontend/docs/THEME_GUIDE.md` + rule `.agents/rules/08_theme_rules.md`
- **Git:** `origin` → `CytronTH/pido.ai` (เดิม `iriv-vision-studio`), ย้าย version tags 44 ตัว (`v1.0.9`–`v1.0.54`) มา pido.ai, ย้าย branch `model-studio` ไป repo ใหม่ `CytronTH/pido.ai-model-studio` (`main`)
- **Security:** ลบ PAT ที่ฝังใน remote URL, revoke token เดิม, ใช้ fine-grained PAT (เฉพาะ repo) ผ่าน `credential.helper store`

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้ semantic tokens แทน `dark:` pairs สำหรับสี neutral ทั้งหมด
- **เหตุผล:** เขียน class เดียวใช้ได้ทั้งสองโหมด ลดความผิดพลาด สลับธีมด้วย CSS variables ไม่ต้อง re-render
- **เรื่องที่ตัดสินใจ:** Codemod เลือก token จากค่า dark-mode เดิม
- **เหตุผล:** เป็นค่าที่ผ่านการทดสอบจริงมาแล้ว (ผู้พัฒนาใช้ OS dark)
- **เรื่องที่ตัดสินใจ:** Model Studio แยก repo
- **เหตุผล:** เป็นคนละโปรเจกต์ (Electron/Windows) ไม่มีประวัติ commit ร่วมกับ PiDo.AI

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- Browser subagent ใช้ไม่ได้บน ARM64 (Playwright driver 404) — ทดสอบ theme ด้วยมือแทน (ผ่าน)
- ยังไม่มี branch `dev` ก่อนหน้านี้ (สร้างในรอบนี้)

### ⏭️ ก้าวต่อไป (Next Steps)
- Code review → PR `feature/theme-tokens` → `dev`
- ลบ branch ที่ไม่ใช้: `bugfix/general-fixes`, `feature/pipeline-redesign`
- พิจารณา Archive repo `iriv-vision-studio` บน GitHub
- เก็บกวาดไฟล์ทดสอบ/ชั่วคราวที่ root (`test_*.py`, `fix_iscompact.py`, `patch_nodes.py`, `*.log`)

## [2026-09-11] - พัฒนาระบบ AI Model Registry ป้องกันการอัปโหลดไฟล์โมเดลชื่อชนกัน (Unique Storage, SHA-256 Checksum, Versioning) และยกเครื่อง UX/UI Model Upload

### 🎯 เป้าหมาย (Goals)
- [x] แก้ปัญหาไฟล์โมเดลชื่อเหมือนกัน (เช่น `best.hef` จาก YOLO) ถูกอัปโหลดทับไฟล์เดิมบนดิสก์ ส่งผลให้โปรเจ็กต์ดึงโมเดลไปรันผิดตัว
- [x] เพิ่มระบบจำแนกและระบุตัวตนของโมเดลนอกเหนือจากชื่อไฟล์: Unique Stored Path (`<model_id>_<clean_filename>`), SHA-256 Checksum, File Size, Version Tag, Description และ Original Filename
- [x] ทำ Database Migration & Reconciliation อัตโนมัติสำหรับโมเดลเดิมในระบบ และแยกไฟล์โมเดลที่เคยชนกัน (`congee1ul` vs `Gallon Detector`) ออกจากกันอย่างปลอดภัย
- [x] ปรับปรุง Pipeline Parser (`pipeline_parser.py`) และ Project Backup (`project_backup.py`) ให้รองรับ Unique File Storage
- [x] ออกแบบหน้าจอ AI Model Upload ใหม่ทั้งหมด (`ModelUploadModal.jsx`): รองรับ Drag & Drop, Smart Auto-naming, Smart Task Selector จับคู่ไลบรารี `.so` ให้อัตโนมัติ, และแสดง Class Names Preview ทันทีจาก `metadata.yaml`
- [x] ปรับปรุง UI หน้า `Settings.jsx` (AI Model Registry Cards) และ `AINode.jsx` ให้แสดง Version, SHA-256 Chip (1-Click Copy), ขนาดไฟล์ และ Class Badges อย่างชัดเจน

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Database & Migration (`backend/db/`)**:
  - `models.py`: เพิ่มฟิลด์ `original_filename`, `file_hash`, `file_size`, `version`, `description` ลงใน `AIModel`
  - `database.py`: เพิ่ม Migration Statements อัตโนมัติ และฟังก์ชัน `_reconcile_existing_models()` คำนวณ SHA-256/ขนาดไฟล์ให้โมเดลเดิม และแยกไฟล์ `model_1788861629_best.hef` ป้องกันไฟล์ชน
- **Backend APIs & Pipeline Engine (`backend/`)**:
  - `main.py`: ปรับปรุง `/api/models/upload`, `/api/upload-hef`, `/api/compile-onnx` ให้สตรีมคำนวณ SHA-256 พร้อมจัดเก็บไฟล์ด้วย Unique ID Prefix ไม่มีการเขียนทับไฟล์เดิมบนดิสก์
  - `pipeline_parser.py`: รองรับการ Resolve ไฟล์โมเดลทั้งแบบ Relative และ Absolute Path เข้าสู่ HailoRT
  - `project_backup.py`: ปรับปรุง Export Manifest และ Import Unpack ให้เก็บและรักษาข้อมูล Hash, Version และ Original Filename
  - `test_model_registry.py`: เขียน Automated Unit Tests ทดสอบ Collision Prevention, SHA-256 Verification, Pipeline Resolution ผ่าน 100%
- **Frontend Modernization (`frontend/src/`)**:
  - `ModelUploadModal.jsx`: สร้าง Component Modal อัปโหลดโมเดลใหม่พร้อม Drag & Drop Dropzone, Auto-naming, Visual Task Buttons, Client-side YAML Class Parser, และ Loading Animation
  - `Settings.jsx`: ยกเครื่องแท็บ AI Models เป็น Model Registry โฉมใหม่ แสดงการ์ดโมเดลพร้อม Version Pill, SHA-256 Monospace Badge พร้อมปุ่ม Copy, ขนาดไฟล์, และปุ่มลบพร้อมกล่องยืนยันความปลอดภัย
  - `AINode.jsx`: ตัวเลือกใน Dropdown แสดง `{model.name} ({model.version}) • [{filename}]` พร้อมการ์ดสรุปข้อมูลโมเดลแสดง SHA-256 Hash และจำนวน Class ชัดเจน

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้ Unique Storage Naming `<model_id>_<clean_filename>` บนดิสก์ ควบคู่กับการเก็บ `original_filename` ในฐานข้อมูล
- **เหตุผล:** โมเดลส่วนใหญ่ที่ผู้ใช้ส่งออกมาจาก Ultralytics YOLO จะมีชื่อตั้งต้นว่า `best.hef` เหมือนกันหมด การบันทึกด้วยชื่อเดิมทำให้เกิดการเขียนทับโดยไม่รู้ตัว การใช้ ID นำหน้าทำให้ HailoRT โหลดได้ตรงตามไฟล์เฉพาะของโมเดลนั้น 100% โดยที่ผู้ใช้ยังเห็นชื่อไฟล์ต้นฉบับได้เหมือนเดิม
- **เรื่องที่ตัดสินใจ:** เพิ่มการจับคู่ Task Type กับ Post-Process `.so` ให้อัตโนมัติในหน้า Upload
- **เหตุผล:** ผู้ใช้ทั่วไปไม่ควรต้องมานั่งจำชื่อไฟล์ไดนามิกไลบรารี Linux เช่น `libyolo_hailortpp_post.so` การทำ Smart Mapping ช่วยลด Human Error และทำให้การใช้งานลื่นไหลขึ้น

---

## [2026-09-10] - เพิ่มโหนด Forklift Safety Monitor และ Polygon Danger Zone Editor สำหรับทางแยกคลังสินค้า (Warehouse Safety)

### 🎯 เป้าหมาย (Goals)
- [x] พัฒนาโหนดเครื่องมือใหม่ `ForkliftZoneNode` สำหรับตรวจสอบรถโฟล์กลิฟต์ในทางแยกคลังสินค้า (Warehouse Intersection) และพื้นที่เสี่ยง
- [x] พัฒนาระบบ Polygon Danger Zone Visual Editor (`PolygonZoneEditorModal.jsx`) ให้ผู้ใช้สามารถคลิกวาดพื้นที่อันตรายเป็นรูปหลายเหลี่ยม (Polygon) ปรับจุด Vertices ตามมุมมองกล้องติดผนังเฉียง 45 องศาได้อิสระ
- [x] ออกแบบระบบคำนวณ Ground-Contact Footprint Anchor (จุดสัมผัสพื้นล้อ `cx, ymax`) แก้ปัญหาเสายกสูง (Mast) ของรถโฟล์กลิฟต์ทำ False Alarm
- [x] พัฒนาระบบ Co-Presence & Critical Collision Detection ตรวจจับความเสี่ยงวิกฤตเมื่อมี Forklift + คนเดินเท้า (`person`) หรือ Forklift 2 คันในจุดตัดพร้อมกัน
- [x] สร้าง Multi-Handle Output: ขั้วต่อ `is_critical` (ไซเรนฉุกเฉิน), `is_danger` (ไฟเตือนระวังสีเหลือง), ขั้วแยกรายโซนสำหรับควบคุม Relay / Digital Output แต่ละดวง และขั้ว `debug` สำหรับต่อเข้า `DebugNode`
- [x] พัฒนาระบบรองรับ `DebugNode` และ `DebugOutputNode` (Terminal Window) ให้แสดงผลสถานะความปลอดภัย, จำนวน Forklift/คน, Near-Miss และตารางสถานะของแต่ละโซนได้แบบเรียลไทม์

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Backend AI Engine & Tests (`backend/ai_engine/`)**:
  - `forklift_zone_monitor.py`: สร้างคลาส `ForkliftZoneNode` รองรับ Ray-Casting Point-in-Polygon (PIP), คำนวณพิกัดสัมผัสพื้นดิน (Ground Anchor) สำหรับมุมเฉียง 45°, ตรวจสอบ Co-Presence, Near-Miss และส่ง Telemetry แบบ Real-time ผ่าน WebSocket
  - `test_forklift_zone_monitor.py`: เขียน Automated Unit Tests ครอบคลุม 5 กรณี (Point-in-Polygon, Ground Anchor 45°, Forklift+Person Critical Alarm, Multi-Forklift Conflict, และ Normal Safe) ผ่าน 100%
  - `pipeline_parser.py`: เพิ่มการ Register `forkliftZoneNode` เข้าในระบบ Pipeline Execution
  - `pipeline_differ.py`: เพิ่ม `forkliftZoneNode` เข้าใน `ROUTER_ONLY_NODE_TYPES` รองรับการปรับแก้โซนหรือค่าคอนฟิกแบบ Hot-Reload โดยไม่ต้องรีสตาร์ต GStreamer / Hailo Pipeline
  - `message_router.py`: เพิ่มการรักษาสถานะ `zone_states`, `zone_counts`, `near_miss_count` ข้ามการอัปเดต Pipeline
- **Frontend React Flow & Visual Editor (`frontend/src/`)**:
  - `ForkliftZoneNode.jsx`: โหนด React Flow ธีมสีแดง/ชมพู/เหลือง พร้อม Live Status Banner (SAFE / CAUTION / CRITICAL SIREN), ตัวนับจำนวน Forklift/Person/Near-Miss, ขั้ว Handle สัญญาณเตือนวิกฤตและแยกรายโซน
  - `PolygonZoneEditorModal.jsx`: เครื่องมือวาดพื้นที่หลายเหลี่ยมบนภาพ Snapshot จากกล้อง ปรับจุด Vertices ได้อิสระ พร้อมพรีเซ็ตทรงเรขาคณิต (45° Perspective Trapezoid, T-Junction, Crossroad) และตัวเลือก Anchor Mode
  - `nodeTypes.js` & `Sidebar.jsx`: ลงทะเบียนโหนดใหม่และเพิ่มไอคอน `ShieldAlert` ในหมวด Nodes
  - `DebugWebSocket.jsx`: รองรับ Event `forklift_zone_update` แสดงผลข้อมูลสดบนโหนดแบบ Real-time

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้พิกัด Bottom-Center `(cx, ymax)` เป็น Ground-Contact Anchor โดยตั้งเป็นค่าเริ่มต้น
- **เหตุผล:** สำหรับกล้องที่ติดตั้งบนกำแพงทำมุมเฉียง 45 องศา โครงหลังคาและเสายก (Mast) ของรถโฟล์กลิฟต์จะทอดยาวขึ้นไปบนระนาบภาพ หากใช้จุดกึ่งกลาง BBox (Centroid) จะทำให้เกิด False Alarm จากเสารถที่ยื่นเข้าไปในโซน ทั้งที่ล้อรถยังอยู่นอกพื้นที่ การใช้จุดสัมผัสพื้นดินจึงให้ความแม่นยำสูงสุด
- **เรื่องที่ตัดสินใจ:** แยกขั้ว Output เป็น `is_critical` (เตือนภัยร้ายแรง: รถ+คน) และ `is_danger` (เตือนทั่วไป: มีรถเข้าใกล้)
- **เหตุผล:** ในคลังสินค้าจริง การเปิดไซเรนเสียงดังทุกครั้งที่รถวิ่งผ่านจะสร้าง Noise Fatigue แก่พนักงาน การแยกให้มีทั้งสัญญาณไฟเหลืองเตือนเบาๆ (Caution) และไฟไซเรนแดงพร้อมเสียงเฉพาะตอนที่มีคนเดินเท้าหรือรถชนกัน (Critical) จึงเป็นมาตรฐานความปลอดภัยสากล

---

## [2026-09-10] - เพิ่มระบบ Project Backup & Migration (Export / Import / Deploy สำหรับสำรองข้อมูลและย้ายบอร์ด)

### 🎯 เป้าหมาย (Goals)
- [x] พัฒนาระบบ Export / Download โปรเจ็กต์ออกเป็นไฟล์แพ็กเกจ `.pidoproj` (ZIP) หรือ `.json` เพื่อนำไปสำรองข้อมูล หรือนำไป Deploy บนบอร์ดเครื่องอื่นได้แบบ Out-of-the-Box
- [x] บรรจุทั้งโครงสร้าง Pipeline, เลย์เอาต์ Dashboard, เอนทิตีที่เกี่ยวข้อง, ไฟล์โมเดล AI (`.hef`), และไฟล์วิดีโอตัวอย่างไปพร้อมกัน
- [x] พัฒนาระบบ Import & Deploy Modal พร้อมระบบตรวจเช็คความพร้อม (Pre-Inspection / Dry-Run) แสดงรายการโมเดล ขนาดไฟล์ และตรวจจับ Conflict ของชื่อหรือ ID บนบอร์ด
- [x] เพิ่มปุ่ม Export / Import ในหน้า My Projects (`ProjectList.jsx`), ปุ่ม Export บน Floating Dock ของ `PipelineBuilder.jsx` และแท็บ Backups & Migration ใน `Settings.jsx`
- [x] สร้างระบบป้องกันความปลอดภัย Zip Slip Path Traversal และระบบ Atomic File Extraction

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Backend Architecture & APIs (`backend/`)**:
  - `backend/web_server/project_backup.py`: สร้างโมดูลจัดการ Backup & Migration สมบูรณ์
    - `GET /api/projects/backup/export/{project_id}`: รองรับ `bundle_type="full"|"config_only"` และ `include_videos=true|false`
    - `POST /api/projects/backup/inspect`: ตรวจสอบไฟล์อัปโหลด `.pidoproj`/`.json` ล่วงหน้าโดยไม่ต้องบันทึก เพื่อส่ง Preview ข้อมูลให้หน้าต่าง UI
    - `POST /api/projects/backup/import`: ทำการคลี่ไฟล์แพ็กเกจอย่างปลอดภัย คัดลอกโมเดล `.hef` บันทึกลงฐานข้อมูล SQLite และเลือกว่าจะเริ่มรัน Pipeline ทันทีหรือไม่
    - `GET /api/projects/backup/export-all`: ส่งออกทุกโปรเจ็กต์รวมเป็น Master Archive ชุดเดียว
    - `POST /api/projects/backup/snapshots/create` & `GET /api/projects/backup/snapshots`: จัดการ Local Snapshots บนบอร์ดที่ `/home/pi/pido-backups/projects/` พร้อมระบบ One-Click Restore
  - `backend/web_server/main.py`: รวม `project_backup.py` router เข้ากับ FastAPI อย่างไร้รอยต่อ
- **Frontend UI (`frontend/src/`)**:
  - `frontend/src/components/Home/ExportProjectModal.jsx`: หน้าต่างโมดอลเลือกโหมดการส่งออก (Full Deployment Package แนะนำ หรือ Config Only)
  - `frontend/src/components/Home/ImportProjectModal.jsx`: หน้าต่าง Drag & Drop อัปโหลดไฟล์แพ็กเกจ แสดงผลการตรวจสอบความพร้อม Badge โหนด ชนิดโมเดล และจัดการความขัดแย้งของโปรเจ็กต์
  - `frontend/src/components/Home/ProjectList.jsx`: เพิ่มปุ่ม "Import Project" ที่แถบด้านบน และปุ่ม "Export" บนการ์ดของแต่ละโปรเจ็กต์
  - `frontend/src/components/PipelineBuilder/PipelineBuilder.jsx`: เพิ่มปุ่มลัด "Export" บน Floating Dock
  - `frontend/src/components/Settings/BackupManager.jsx`: สร้างหน้าสำหรับจัดการ Master Export All, Local Snapshots, และ Restore Points
  - `frontend/src/components/Settings/Settings.jsx`: เพิ่มแท็บ **"Backups & Migration"**

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** รวมไฟล์ไบนารี `.hef` ของโมเดล AI ลงในแพ็กเกจ `.pidoproj` โดยอัตโนมัติ (Full Package)
- **เหตุผล:** หากผู้ใช้นำไฟล์โปรเจ็กต์ไปเปิดบนบอร์ดใหม่ที่ยังไม่มีโมเดลติดตั้งไว้ ระบบจะสามารถรัน Pipeline ได้ทันทีโดยไม่เกิดข้อผิดพลาด Missing Model และมีตัวเลือก Config Only สำหรับกรณีที่ต้องการไฟล์ขนาดเล็ก
- **เรื่องที่ตัดสินใจ:** เพิ่มการตรวจสอบขนาดไฟล์ก่อนคลี่ไฟล์ทับ และใช้ Atomic File Replace
- **เหตุผล:** ป้องกันปัญหาไฟล์ `.hef` ถูกเขียนทับขณะที่ HailoRT กำลังโหลดใช้งานอยู่

---

## [2026-09-09] - เพิ่มโหนด ShelfSlotMonitorNode สำหรับตรวจเช็คชั้นวางสินค้าแยกรายช่องและจัดการการบดบัง (Occlusion)

### 🎯 เป้าหมาย (Goals)
- [x] พัฒนาโหนดเครื่องมือใหม่ `ShelfSlotMonitorNode` สำหรับตรวจเช็คสินค้าบน Shelf ว่าง (Empty Shelf / Out-of-Stock) แยกตรวจสอบรายช่อง (Slot-by-Slot)
- [x] พัฒนาระบบ Person Occlusion Suppression ตรวจจับคน (`person`) ในภาพเพื่อระงับ (Freeze/Hold) การตรวจเช็คชั่วคราว ป้องกัน False Alarm ตอนลูกค้าหรือพนักงานเดินผ่านหรือหยิบสินค้า
- [x] พัฒนาระบบ Multi-Handle Output ส่งออกค่าสัญญาณ Boolean แยกตามแต่ละช่อง และขั้วรวม `Any Slot Empty` เพื่อให้ผู้ใช้ลากเส้นไปต่อเข้า `LEDNode`, `DigitalOutputNode`, หรือโหนดอื่นๆ ได้อย่างยืดหยุ่น
- [x] พัฒนาหน้าจอ Visual Editor `ShelfSlotEditorModal.jsx` สำหรับตีกรอบแบ่งช่อง (Grid/Slots) บนหน้าจอภาพจากกล้องจริง พร้อมแสดงสถานะ Live Telemetry บนตัวโหนด

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Backend AI Engine & Router (`backend/ai_engine/`)**:
  - `shelf_slot_monitor.py`: สร้างคลาส `ShelfSlotMonitorNode` ตรวจนับสินค้าในกรอบแต่ละช่อง, กรองคลาสตามกำหนด, เช็คพิกัด Point-in-ROI และ Bounding Box Overlap, ดักจับคลาส `person` พร้อมระบบ Debounce และ Cooldown Timer
  - `message_router.py`: เพิ่มการส่งข้อความแบบ Handle-Specific Routing (`(target_id, source_handle)`) เพื่อให้โหนดที่มีหลายขั้ว Output ส่งค่า Boolean เฉพาะช่องไปยังโหนดปลายทางที่ถูกต้อง และรักษาสถานะช่องวางตอน Hot Reload
  - `pipeline_parser.py`: เพิ่มการ Register `shelfSlotMonitorNode` และดึง `sourceHandle` จาก Edge React Flow
  - `pipeline_differ.py`: เพิ่ม `shelfSlotMonitorNode` ใน `ROUTER_NODE_TYPES` รองรับการปรับเปลี่ยนตั้งค่าโดยไม่ต้องรีสตาร์ต GStreamer Pipeline
- **Frontend UI (`frontend/src/`)**:
  - `ShelfSlotMonitorNode.jsx`: ตัวโหนด React Flow สี Amber สวยงาม แสดงสถานะคนบัง (🟡 Paused), สถานะช่องว่าง (🔴 Empty), และมีขั้ว Handle แยกตามแต่ละช่องตรงกับแถวข้อมูล
  - `ShelfSlotEditorModal.jsx`: ป๊อปอัปแบบ Portal ดึงภาพ Snapshot จากกล้อง พร้อม Canvas สำหรับลากตีกรอบสี่เหลี่ยมแบ่งช่อง (รองรับหลายช่องพร้อมจานสีแยกแยะชัดเจน) และปรับค่า Debounce / Person Suppression
  - `nodeTypes.js`, `Sidebar.jsx`, `DebugWebSocket.jsx`: ลงทะเบียนโหนดเข้าสู่ระบบลากวางและรับส่ง WebSocket แบบเรียลไทม์

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** เพิ่มระบบ Handle-Specific Routing ใน `MessageRouter`
- **เหตุผล:** ทำให้โหนดที่มีหลายช่อง (Multi-Slot) สามารถส่งค่า Boolean แยกตามแต่ละ Handle ไปยังโหนดปลายทาง (เช่น LED แยกแต่ละหลอด) ได้โดยตรง โดยคงความเข้ากันได้กับระบบเดิมแบบ 100%

---

## [2026-09-04] - เพิ่มฟีเจอร์ Platform Updates (ระบบอัปเดตแพลตฟอร์ม One-Click OTA และ Offline Air-Gapped)

### 🎯 เป้าหมาย (Goals)
- [x] เพิ่มระบบอัปเดตซอฟต์แวร์ PiDo Vision Studio บนอุปกรณ์ Edge (Raspberry Pi 5) ให้ผู้ใช้งานสามารถอัปเดตเป็นเวอร์ชันล่าสุดได้ง่ายที่สุดผ่าน Web UI โดยไม่ต้องใช้คำสั่ง Terminal/SSH
- [x] รองรับทั้งการอัปเดตแบบ Online One-Click (ผ่าน GitHub) และ Offline Air-Gapped (อัปโหลดไฟล์ `.tar.gz`)
- [x] สร้างระบบความปลอดภัย ป้องกันข้อมูล Database SQLite, โมเดล AI และคอนฟิกสูญหาย พร้อมระบบ Auto-Backup และ Rollback

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Backend & Updater Scripts (`backend/`)**:
  - `backend/scripts/updater.sh`: สคริปต์ตัวจัดการอัปเดตแบบ Detached Process แยกส่วนเพื่อความปลอดภัย ไม่ขาดตอนขณะรีสตาร์ต Service
    - จัดการ Auto-Backup โฟลเดอร์ `db/` และ `.env` ไปยัง `/home/pi/pido-backups/` อัตโนมัติ (เก็บย้อนหลัง 5 ชุด)
    - ป้องกัน Git Merge Conflict ด้วยการตั้ง `assume-unchanged` ให้กับไฟล์ SQLite
    - ซิงค์ Dependencies (`requirements.txt`, `npm install`) และรัน Database Migration
    - รองรับการแตกไฟล์ออฟไลน์แบบ Selective Sync (ไม่ทับฐานข้อมูลและโมเดลของผู้ใช้)
    - บันทึกความคืบหน้าแบบ Real-time ลง `/tmp/pido_update_status.json` และสั่งรีสตาร์ต `pido-vision.service`
  - `backend/web_server/main.py`: เพิ่ม API Endpoints สำหรับตรวจสอบและสั่งการอัปเดต
    - `GET /api/system/version`: อ่านเวอร์ชัน Git Tag, Commit, Branch และสเปกเครื่อง
    - `GET /api/system/update/check`: ดึงข้อมูลเปรียบเทียบกับ Remote Repository, ตรวจสอบจำนวน Commits Ahead/Behind, และดึง Changelog
    - `POST /api/system/update/apply`: สั่งรันการอัปเดตผ่าน Background Runner แบบ Non-blocking
    - `POST /api/system/update/upload`: รองรับการอัปโหลดไฟล์แพ็กเกจออฟไลน์ `.tar.gz`
    - `GET /api/system/update/status`: เช็ค Progress %, สถานะขั้นตอน และ Log ล่าสุด
    - `GET /api/system/ping`: Healthcheck สำหรับตรวจจับตอนที่เซอร์วิสรีบูตกลับมาพร้อมใช้งาน
- **Frontend UI (`frontend/src/`)**:
  - `frontend/src/components/Settings/UpdateManager.jsx`: หน้าต่างบริหารจัดการการอัปเดตที่สวยงามและใช้งานง่าย
    - **System Information Cards**: แสดงเวอร์ชันปัจจุบัน, Commit, วันที่, สเปกฮาร์ดแวร์ Raspberry Pi 5 และสถานะความปลอดภัย
    - **One-Click Update Action**: ปุ่ม "Check for Updates" และการ์ด "New Update Available" พร้อมแสดงรายการ Changelog
    - **Interactive Progress Modal & Logs**: Progress Bar แสดงเปอร์เซ็นต์ พร้อม Terminal Console ดู Log การทำงานสด
    - **Reconnecting Countdown Overlay**: หน้าจอนับถอยหลังพร้อม Ping เช็คเซอร์วิสอัตโนมัติ และรีเฟรชหน้าเว็บเมื่อระบบใหม่พร้อมใช้งาน
    - **Air-Gapped Package Dropzone**: พื้นที่ Drag & Drop อัปโหลดไฟล์ `.tar.gz` สำหรับโรงงานที่ไม่มีอินเทอร์เน็ต
  - `frontend/src/components/Settings/Settings.jsx`: เพิ่มแท็บ **"Platform Updates"** พร้อมไอคอน `ArrowUpCircle`

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้ Detached Background Process (`updater.sh`) แทนการรันคำสั่งโดยตรงใน Thread ของ FastAPI
- **เหตุผล:** หากคำสั่งถูกรันภายใน Web Request ของ Uvicorn เมื่อเซอร์วิสสั่ง `sudo systemctl restart pido-vision.service` หรือโปรเซสถูกปิด ตัวสคริปต์อัปเดตจะถูกฆ่าทิ้งกลางคัน ทำให้การอัปเดตล้มเหลวหรือระบบเสียหาย การแยกโปรเซสด้วย `start_new_session=True` ช่วยให้สคริปต์ทำงานจนเสร็จสมบูรณ์และรีสตาร์ตได้อย่างราบรื่น
- **เรื่องที่ตัดสินใจ:** ตั้ง `assume-unchanged` และแบ็กอัป `vision_studio.sqlite*` ก่อน `git pull`
- **เหตุผล:** SQLite บนอุปกรณ์ Edge มีการเขียน log และ WAL file อยู่ตลอดเวลา ซึ่งทำให้ Git มองว่าไฟล์ถูกแก้ไขในเครื่อง (Dirty working tree) การไม่กันไว้ล่วงหน้าจะทำให้ `git pull` เกิด Conflict และหยุดทำงานทันที

---

## [2026-09-04] - เพิ่ม Mobile Navigation, ปรับปรุง UI Responsive และเสถียรภาพ Pipeline/Hardware

### 🎯 เป้าหมาย (Goals)
- [x] ปรับแต่ง Frontend ให้รองรับการแสดงผลบนอุปกรณ์พกพา (Mobile & Tablet)
- [x] เพิ่ม Mobile Bottom Navigation Bar ให้สลับเมนู (Projects, Dashboard, Pipeline, Logs, Wiki, Settings) ได้อย่างสะดวกรวดเร็ว
- [x] ปรับปรุงเสถียรภาพของ Hailo GStreamer Worker ในช่วงการ Restart และ Teardown
- [x] ปรับปรุง Hardware Output Node ไม่ให้ส่งสัญญาณซ้ำๆ และป้องกัน Snapshot Process ทับซ้อน

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Frontend & Mobile UI (`frontend/src/`)**:
  - เพิ่ม **Mobile Bottom Navigation Bar** ใน `App.jsx` สำหรับหน้าจอขนาดเล็ก (< md)
  - ปรับปรุง Header, Breadcrumb, และ Resource Monitor ให้มีความกะทัดรัด (Compact) และ Responsive
  - เพิ่ม Drawer / ปุ่มเปิด Sidebar "All Nodes" ใน `NodeWiki.jsx` สำหรับดูข้อมูลบนมือถือ
  - เพิ่ม Assets โลโก้แบรนด์ (`logo.png`, `logo.svg`) และอัปเดต `favicon.svg`
  - ปรับแต่ง Layout ของ `Sidebar.jsx`, `ProjectList.jsx`, และ `Settings.jsx` ให้แสดงผลได้สมบูรณ์บนทุกขนาดหน้าจอ
- **Backend AI Engine & Router (`backend/ai_engine/`)**:
  - `hailo_worker.py`: เพิ่มการถอด Probe (`_remove_probes`), ดักจับ Exception ตอนเปลี่ยนสถานะ Pipeline เป็น NULL, เพิ่มเวลารอ 0.3s ให้ฮาร์ดแวร์ VDMA และ RTSP Sockets เซ็ตตัว, และ Re-initialize `GLib.MainLoop()` เพื่อป้องกันการค้างตอนสลับ Tier คุณภาพสตรีม
  - `message_router.py`: เพิ่ม State Caching ใน `HardwareOutputNode` เพื่อสั่งงาน GPIO / PWM / Buzzer เฉพาะเมื่อค่าสถานะเปลี่ยนแปลงจริง ลดภาระ CPU และตัด Log สแปม
  - `SnapshotNode`: เพิ่มการตรวจสอบ `poll()` ของโปรเซส FFmpeg ก่อนหน้า เพื่อป้องกันการสแปมโปรเซสจับภาพซ้ำซ้อน
- **Process Management (`start.sh`)**:
  - เพิ่ม Flag `-k` และ `--kill-others-on-fail` ใน `npx concurrently` เพื่อให้ปิดทุกโปรเซสอย่างสมบูรณ์หากมีเซอร์วิสใดล้มเหลว

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** เพิ่ม State Change Filter ใน `HardwareOutputNode`
- **เหตุผล:** เดิมทีโหนดส่งคำสั่ง GPIO/PWM ทุกครั้งที่ได้รับเมสเสจจาก AI Pipeline แม้ว่าสถานะจะไม่เปลี่ยน ซึ่งสร้าง I/O Overhead บนบอร์ด Raspberry Pi โดยไม่จำเป็น การทำ State Cache ช่วยลดโหลดและทำให้ Log อ่านง่ายขึ้น

---

## [2026-09-03] - ระบบ Storage Maintenance & Auto-Pruning ป้องกันดิสก์เต็ม

### 🎯 เป้าหมาย (Goals)
- [x] เพิ่มระบบบริหารจัดการพื้นที่จัดเก็บข้อมูล (Storage Maintenance) ทั้งประวัติ Logs และไฟล์ภาพ Snapshots
- [x] ป้องกันปัญหาฐานข้อมูล SQLite ขยายตัวจนกินพื้นที่ Flash/SD card ของ Raspberry Pi / Edge Device
- [x] เพิ่มหน้า UI ให้ผู้ใช้ตั้งค่านโยบาย Retention (อายุ Log) และสั่ง Run Cleanup ได้ด้วยตนเอง

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- **Backend Database (`backend/db/database.py` & `models.py`)**:
  - เพิ่มฟังก์ชัน `purge_old_logs()` ลบ EventLog เก่าตามอายุวัน และจำกัดจำนวน Record สูงสุด โดยลบเป็น Chunk ละ 500 rows ป้องกัน SQLite lock
  - ลบไฟล์ภาพ Snapshot บน Disk อัตโนมัติตาม Log ที่ถูกล้าง
  - เพิ่มฟังก์ชัน `get_db_stats()` ดึงขนาดไฟล์ `.sqlite`, `.sqlite-wal`, จำนวน records, และขนาดโฟลเดอร์ภาพ snapshots
  - ใส่ Index บน `timestamp`, `node_id`, `event_type`, `camera_id` ในโมเดลเพื่อความเร็วในการค้นหาและล้างข้อมูล
  - กำหนด Max Queue Size (10,000) ใน log queue ป้องกัน RAM ล้น
- **API Server (`backend/web_server/main.py`)**:
  - เพิ่ม Endpoint `GET /api/database/stats` และ `POST /api/database/maintenance/cleanup`
  - ปรับ `write_entities` และ `write_projects` เป็นแบบ Smart Upsert
  - เพิ่มการสั่ง `db.stop()` ใน Application Shutdown Event
- **Frontend UI (`frontend/src/components/LogsViewer.jsx`)**:
  - เพิ่ม Storage Maintenance Modal แสดงสรุปขนาด Database และ Disk usage ของ Snapshots
  - เพิ่มตัวเลือกกำหนด Retention Policy (7, 14, 30, 60 วัน), จำนวน Record สูงสุด, และ Checkbox สั่งลบไฟล์ภาพออกจากดิสก์

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ลบ SQLite rows เป็นชุดๆ (Batch of 500) และลบไฟล์รูปภาพออกจากดิสก์ไปพร้อมกัน
- **เหตุผล:** บน Edge device อย่าง Raspberry Pi การลบข้อมูลหลักแสนแถวในคำสั่งเดียวจะทำให้ SQLite lock เป็นเวลานานและกระทบ realtime pipeline การลบเป็น chunk จึงปลอดภัยและเสถียรกว่า

---

## [2026-08-14] - เปลี่ยนสถาปัตยกรรมเป็น Entity-Based System

### 🎯 เป้าหมาย (Goals)
- [x] อัปเกรดระบบจัดเก็บข้อมูลให้เป็นรูปแบบ "Entity" แบบที่ใช้ในระบบ VMS (Video Management System) มืออาชีพ
- [x] สร้างฐานข้อมูลจำลอง (JSON DB) สำหรับจัดเก็บ Camera, Model, และ Integration Entities
- [x] อัปเดต Node บน UI ทั้งหมดให้ไปดึงข้อมูลจาก Entity DB แทนการพิมพ์ Path หรือ URL ตรงๆ
- [x] ทำให้ Backend สามารถประกอบ GStreamer Pipeline และทำ Logic/Action ได้แบบไดนามิกเต็มรูปแบบ

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้างไฟล์ `backend/db/entities.json` สำหรับเก็บข้อมูลเริ่มต้น
- เพิ่ม API `GET /api/entities` และ `POST /api/entities` ใน `main.py`
- อัปเดต `InputNode`, `AINode`, และ `ActionNode` ให้ Fetch ข้อมูล Entity และสร้าง Dropdown ตัวเลือกอัตโนมัติ
- แก้ไข `pipeline_parser.py` ให้ใช้ `entityId` ในการค้นหาค่า Path และ Config 
- แก้ปัญหาโปรแกรมแครชเมื่อเลือก Model ผิด ด้วยการใส่โค้ด `os.path.exists()` เช็คไฟล์ `.hef` ก่อนเริ่ม GStreamer และมี Fallback กลับไปใช้ YOLOv8s รุ่นเริ่มต้นเสมอ
- เขียน Logic สำหรับ `object_count_gt` และ `label_equals`
- เพิ่มฟังก์ชันส่ง Webhook (`urllib.request`) ทำงานแบบ Thread ไม่บล็อคการประมวลผลวิดีโอ
- **[เพิ่มใหม่]** สร้างหน้า **Settings (Entity Management)** บน Frontend เพื่อให้จัดการ Database JSON ได้ผ่าน UI โดยตรง (CRUD เต็มรูปแบบ)

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้ Entity ID ใน Pipeline Graph แทนการบันทึก URL ตรงๆ
- **เหตุผล:** หากมีการเปลี่ยน IP ของกล้อง ผู้ใช้แค่แก้ที่ส่วนกลาง (Settings) ครั้งเดียว กราฟทุกตัวที่ใช้ Entity นี้จะอัปเดตตามอัตโนมัติ และป้องกันเรื่อง Security (การโชว์ Token/Username) บนหน้า Canvas

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ยังไม่มี (ตอนนี้สามารถเพิ่มและลบ Entities ผ่านหน้า Settings ได้หมดแล้ว)

### ⏭️ ก้าวต่อไป (Next Steps)
- ทดสอบระบบภาพรวมและอาจจะพิจารณาการแสดงผล Bounding Box บน Live Dashboard จากข้อมูลที่ถูกยิงกลับมา

## [2026-08-14] - สร้าง Interactive Node Forms (UI to Backend)

### 🎯 เป้าหมาย (Goals)
- [x] อัปเดตโหนด AINode, LogicNode, ActionNode ให้มี Form ที่ใช้งานได้จริง
- [x] ผูกค่า Input ภายในโหนดเข้ากับระบบ Zustand Store
- [x] อัปเดต `pipeline_parser.py` ใน Backend ให้รับค่า Setting จาก JSON แทนการ hardcode

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- เพิ่ม `onChange` handler ใน `select` และ `input` ของทุกโหนดเพื่อเรียกใช้ `updateNodeData(id, ...)` จาก `usePipelineStore.js`
- อัปเดต Backend Parser ให้ดึงค่า `modelType`, `condition`, `value`, `actionType`, `target` ออกมาจาก Payload ของ React Flow เพื่อประกอบเป็น Dynamic Configuration
- อัปเดต `hailo_worker.py` ให้ตรวจสอบค่า logic rule โดยเช็ค `confidence_gt` แทนชื่อแบบเก่า

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้โครงสร้าง Zustand ภายใน Custom Node แทนการเก็บ State ยิบย่อย
- **เหตุผล:** ทำให้ข้อมูลของทุก Node กระจุกรวมอยู่ที่ส่วนกลาง เวลาที่ผู้ใช้กด Deploy Pipeline จะได้สามารถแพ็คข้อมูลทั้งหมดและยิง JSON ออกไปหา Backend ได้ทันทีโดยไม่ต้องไปไล่เก็บข้อมูลทีละ Node

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ยังไม่มี

### ⏭️ ก้าวต่อไป (Next Steps)
- พัฒนาระบบ Action (เช่น ส่ง Webhook แจ้งเตือน หรือคุม GPIO) และเตรียมระบบ Edge/Node Translation ให้ฉลาดขึ้น

## [2026-08-14] - สร้างระบบ Graph Translation (Backend Execution Engine)

### 🎯 เป้าหมาย (Goals)
- [x] สร้างตัวรับข้อมูลจาก UI JSON และแปลงเป็น Python Configuration
- [x] ทำให้ `HailoPipelineWorker` สามารถอัปเดต Pipeline และ Restart ตัวเองได้
- [x] นำข้อมูล Logic และ Action จากกราฟมาประยุกต์ใช้กับ Metadata แบบไดนามิก

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้าง `backend/ai_engine/pipeline_parser.py` ทำหน้าที่สกัดค่า `video_source`, `hef_path` และ กฎของ `logicNode`, `actionNode` ออกมาจาก JSON
- เพิ่มฟังก์ชัน `restart(config)` ใน `hailo_worker.py` เพื่อหยุด GStreamer ชั่วคราว, ดึง config ใหม่ไปสร้าง String แล้วสั่งรันใหม่
- แก้ไขฟังก์ชันสกัด Metadata (Pad Probe) ให้ทำงานร่วมกับ `logic_rules` หากความมั่นใจ (Confidence) ของวัตถุไม่ถึงเกณฑ์ที่ตั้งไว้ใน UI จะถูกกรองทิ้ง และหากผ่านเกณฑ์จะแสดง log ของ Action ที่ตั้งไว้

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้สถาปัตยกรรม Hybrid Execution
- **เหตุผล:** แทนที่จะแปลงเส้นเชือกใน UI ให้กลายเป็นคำสั่ง GStreamer 100% (ซึ่งซับซ้อนและเปราะบางมาก) เราเลือกให้ GStreamer จัดการเฉพาะ AI Inference (Hardware-level) แล้วผลักภาระของการเช็คเงื่อนไข (Logic) และการส่งคำสั่ง (Action) มาไว้ใน Callback ของ Python ทำให้เราสามารถเขียนเงื่อนไขแปลกๆ ได้อย่างยืดหยุ่นในอนาคต

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ปัจจุบันฟังก์ชัน Action ยังเป็นการปริ้นต์ข้อความลง Console (Logger) ต้องเชื่อมต่อกับระบบ GPIO หรือ Webhook จริงในเฟสต่อไป

### ⏭️ ก้าวต่อไป (Next Steps)
- ทำฟอร์ม Input บน Custom Node (Frontend) ให้สามารถพิมพ์ตั้งค่าต่างๆ ได้จริง (เช่น ใส่เลข 0.8 ในโหนด Logic และส่งไป Backend)

## [2026-08-14] - สร้าง No-Code Pipeline Builder UI (Phase 1)

### 🎯 เป้าหมาย (Goals)
- [x] สร้าง UI สำหรับ Pipeline Builder เพื่อให้ผู้ใช้ลากวาง Node จัดการ AI Workflow ได้
- [x] ออกแบบ Custom Nodes (Input, AI, Logic, Action) ให้ดูพรีเมียมและทันสมัย
- [x] แยกส่วนการทำงานระหว่าง Live Dashboard กับ Pipeline Builder ด้วย Tab Navigation

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- ปรับโครงสร้าง `App.jsx` ใหม่ เพิ่มระบบ Tab ด้านบนสุด เพื่อสลับหน้าไปมาได้
- สร้าง Component `PipelineBuilder.jsx` โดยใช้ไลบรารี `@xyflow/react` เป็นแกนหลัก
- สร้าง `Sidebar.jsx` พร้อมระบบ Drag-and-Drop ผ่าน HTML5 DataTransfer API
- ออกแบบ Custom Nodes 4 แบบ (`InputNode`, `AINode`, `LogicNode`, `ActionNode`) ด้วย Tailwind CSS สีสันสวยงาม (Gradients, Lucide Icons)

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** โฟกัสไปที่ Frontend UI อย่างเดียวก่อนในเฟสนี้
- **เหตุผล:** ระบบ Pipeline ของฝั่ง Backend GStreamer มีความซับซ้อนสูงมาก การแยกทำเฉพาะ UI ให้สมบูรณ์แบบก่อนจะช่วยให้เราเห็นภาพรวมของ Data Structure (JSON) ที่จะต้องส่งไปให้ Backend ประมวลผลได้ชัดเจนขึ้น

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ปัจจุบัน Node ต่างๆ ที่ลากวางและเชื่อมเส้นไว้ ยังเป็นเพียง "UI จำลอง" (Mockup) เท่านั้น ยังไม่ได้ถูกส่งไปแปลงเป็น GStreamer Pipeline จริงที่ฝั่ง Backend

### ⏭️ ก้าวต่อไป (Next Steps)
- สร้างระบบแปลงกราฟ (Graph Translation) จาก React Flow JSON ให้กลายเป็นคำสั่ง GStreamer เพื่อรันจริงๆ ใน Backend

## [2026-08-13] - แก้บั๊ก GStreamer & การตั้งค่าเครือข่ายจนระบบสมบูรณ์

### 🎯 เป้าหมาย (Goals)
- [x] แก้ปัญหาเชื่อมต่อ MediaMTX ไม่สำเร็จ
- [x] แก้ปัญหา `asyncio` Event Loop ของ Python Thread 
- [x] แก้ปัญหาหน้าเว็บ Vite ไม่เปิดรับการเชื่อมต่อจากภายนอก (LAN)

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- แก้ไข `hailo_worker.py`: ลบ `rtph264pay` ที่ซ้ำซ้อน และเพิ่ม `h264parse config-interval=1` เพื่อให้ `rtspclientsink` จับคู่สัญญาณกับ MediaMTX ได้สำเร็จตั้งแต่เฟรมแรก
- แก้ไข `web_server/main.py`: ปรับให้ตัวรับ Metadata จาก AI ดึง Event Loop หลักของ FastAPI มาใช้ ป้องกันแอปพลิเคชันพังจากการรันใน `Dummy-2` Thread
- แก้ไข `package.json` ฝั่ง Frontend: เพิ่ม flag `--host` ลงในคำสั่ง `npm run dev` เพื่อให้คอมพิวเตอร์อื่นในวงแลนเข้าถึง UI ได้
- ค้นพบและแก้ไขปัญหา Zombie Process ค้างในระบบด้วยการรัน `pkill -f uvicorn` และรีสตาร์ท MediaMTX ใหม่

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** เพิ่ม `config-interval=1` ลงใน H.264 parser
- **เหตุผล:** ระบบ Edge AI ที่รันบนกล้องจริง (IMX708) มักจะใช้เวลาเริ่มต้น (preroll) นาน การใช้คำสั่งนี้เป็นการบังคับให้ GStreamer พ่น Header วิดีโอ (SPS/PPS) ออกมาต่อเนื่อง ทำให้ระบบ WebRTC ของ MediaMTX มองเห็นสตรีมวิดีโอทันที ไม่ต้องรอนานจน Time out

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- 

### ⏭️ ก้าวต่อไป (Next Steps)
- ทำหน้า Pipeline Builder สำหรับลากวางตรรกะแบบ No-Code

## [2026-08-13] - ติดตั้งและเชื่อมต่อ Video Stream (MediaMTX)

### 🎯 เป้าหมาย (Goals)
- [x] ติดตั้งเซิร์ฟเวอร์ MediaMTX 
- [x] แก้ไข GStreamer Pipeline ให้สามารถส่งวิดีโอคู่ขนาน (Tee) ไปยัง AI Engine และ WebRTC ได้
- [x] ฝังวิดีโอสตรีมลงในหน้า React Dashboard

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- ดาวน์โหลดและติดตั้ง `mediamtx_v1.20.0` ไว้ที่โฟลเดอร์ `backend/mediamtx`
- แก้ไข `backend/ai_engine/hailo_worker.py` โดยเพิ่ม GStreamer `tee` เพื่อแยกภาพออกเป็น 2 กิ่ง กิ่งแรกส่งเข้า Hailo NPU และอีกกิ่งแปลงเป็น H.264 (x264enc) ส่งไปที่ MediaMTX ผ่าน RTSP (`rtsp://localhost:8554/cam`)
- แก้ไข `App.jsx` ให้ฝัง iframe ของ MediaMTX WebRTC (`http://localhost:8889/cam`) แทนที่ช่องว่างเดิม

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้ `x264enc` (Software Encoding) แทน Hardware Encoder
- **เหตุผล:** บอร์ด Raspberry Pi 5 ถูกตัดฟีเจอร์ Hardware H.264 Encoder ออกไป การใช้ `x264enc` (ตั้งค่า ultrafast) จึงเป็นวิธีมาตรฐานที่สามารถทำงานได้

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ต้องเปิด MediaMTX ทิ้งไว้ตลอดเวลาเพื่อให้ Backend ส่งภาพเข้ามารับได้

### ⏭️ ก้าวต่อไป (Next Steps)
- ทำหน้า Pipeline Builder สำหรับลากวางตรรกะแบบ No-Code
## [2026-08-13] - สร้าง Frontend Dashboard (React + Vite)

### 🎯 เป้าหมาย (Goals)
- [x] ขึ้นโครงโปรเจกต์ React (Vite) สำหรับหน้า Dashboard
- [x] เขียนโค้ดเชื่อมต่อ WebSocket กับ Backend
- [x] สร้างระบบ Client-Side Canvas Overlay สำหรับวาด Bounding Box (Zero-Copy)

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้างโปรเจกต์ Vite React ในโฟลเดอร์ `frontend/`
- เขียนไฟล์ `App.jsx` ที่เชื่อมต่อ `ws://localhost:8000/ws/metadata`
- ใช้ HTML5 Canvas เพื่อวาดสี่เหลี่ยมพิกัด Bounding Box ทับลงบนพื้นที่เล่นวิดีโอ ช่วยลดภาระของ Edge Server

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้ Tailwind CSS v4 สำหรับโครงสร้าง UI เพื่อให้แอปพลิเคชันสวยงาม (Rich Aesthetics)
- **เรื่องที่ตัดสินใจ:** ส่งพิกัด AI Metadata จาก Backend ในรูปแบบ Normalized Array แล้วมาคูณด้วยความกว้าง/ความสูงจริงของ Canvas ที่ฝั่ง Frontend เพื่อป้องกันสัดส่วนภาพผิดเพี้ยน

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ตอนนี้ช่องวิดีโอยังเป็นแค่ Placeholder ต้องรอเชื่อมต่อระบบ WebRTC / RTSP จาก MediaMTX เข้ามาจริงๆ

### ⏭️ ก้าวต่อไป (Next Steps)
- ทำหน้า Pipeline Builder สำหรับลากวางตรรกะแบบ No-Code
## [2026-08-13] - วางโครงสร้าง Backend Core (FastAPI)

### 🎯 เป้าหมาย (Goals)
- [x] สร้างโครงสร้างไฟล์สำหรับ `web_server` และจัดการ WebSocket
- [x] เตรียมไฟล์ Requirement เบื้องต้น

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้างไฟล์ `backend/requirements.txt`
- สร้างระบบ `websocket_manager.py` สำหรับเตรียมกระจาย JSON Metadata
- สร้าง Virtual Environment (`venv`) แบบ `--system-site-packages` พร้อมติดตั้ง requirements
- ร่างคลาส `HailoPipelineWorker` (`hailo_worker.py`) ที่ควบคุม GStreamer Pipeline และดึง Metadata แบบ Zero-Copy
- อัปเดต `main.py` โดยเชื่อมต่อ `HailoPipelineWorker` ผ่านระบบ Lifecycle Events (`lifespan`) และส่ง Metadata ข้าม Thread เข้าสู่ WebSocket Manager อย่างสมบูรณ์

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** ใช้โครงสร้างแบบ Asynchronous เต็มรูปแบบ
- **เหตุผล:** เพื่อรองรับการรับส่ง WebSocket ข้อมูล AI ที่มีความถี่สูงได้โดยไม่บล็อกการทำงาน (Non-blocking I/O) ตามที่ระบุไว้ในกฎ `.agents/rules/02_backend_rules.md`

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ยังไม่สามารถทดสอบระบบเชื่อมต่อได้จนกว่าจะมีการทำ AI Engine ส่งข้อมูลเข้ามา

### ⏭️ ก้าวต่อไป (Next Steps)
- ตั้งค่า Python Virtual Environment (`venv`) และพัฒนาส่วน `ai_engine` เพื่อเชื่อมต่อกล้องและ NPU ผ่าน Hailo GStreamer

## [2026-08-13] - เริ่มต้นระบบ Devlog

### 🎯 เป้าหมาย (Goals)
- [x] สร้างระบบบันทึกการพัฒนา (Devlog) สำหรับโปรเจ็กต์ `pido-ai`

### 🛠️ สิ่งที่ทำเสร็จแล้ว (Accomplished)
- สร้างไฟล์ `DEVLOG.md` เป็นไฟล์หลักในการบันทึก
- สร้าง AI Rule ที่ `.agents/rules/devlog.md` เพื่อให้ AI (Antigravity) อ่านและช่วยเขียน Devlog โดยอัตโนมัติ

### 🧠 การตัดสินใจทางเทคนิค (Decisions & Context)
- **เรื่องที่ตัดสินใจ:** เลือกใช้ไฟล์ `DEVLOG.md` ไฟล์เดียวที่ root directory และเรียงลำดับจากใหม่ไปเก่า (Reverse Chronological)
- **เหตุผล:** เพื่อให้ง่ายต่อการค้นหา อ่าน และให้ AI ประมวลผลบริบทล่าสุดได้อย่างรวดเร็ว

### 🚧 ปัญหาที่พบ/ยังไม่แก้ (Blockers / Known Issues)
- ยังไม่มี

### ⏭️ ก้าวต่อไป (Next Steps)
- เริ่มบันทึกความคืบหน้าของการพัฒนาฟีเจอร์ต่างๆ ใน `pido-ai` ลงในไฟล์นี้ในเซสชั่นถัดไป
