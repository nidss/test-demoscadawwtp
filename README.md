# SCADA Diagram Editor

แยกออกมาจาก Wastewater Monitor Dashboard (`scada-monorepo-latest/artifacts/scada-dashboard`)
เป็นเครื่องมือเดี่ยว (standalone) สำหรับตั้งค่า:

- ตึก (Buildings)
- ถังบำบัด (Tanks) ต่อตึก
- เครื่องจักร (Equipment) ต่อตึก
- แผนผังกระบวนการบำบัด (Process Flow Diagram) — ลาก-วางถัง/เครื่องจักร/เส้นท่อ

ไม่มีระบบ auth/role — ทุกอย่างแก้ไขได้เสมอ เพราะเป็นเครื่องมือภายในสำหรับตั้งค่าเท่านั้น
ข้อมูลเก็บใน `localStorage` ของเบราว์เซอร์ (คีย์เดียวกับตัว dashboard หลัก คือ
`scada.buildings.v1` และ `scada.flow.v2.<buildingId>`) เพื่อให้ diagram ที่บันทึกจากที่นี่
ใช้งานร่วมกับ dashboard หลักได้ถ้า deploy บน origin เดียวกัน

## รัน

```bash
pnpm install   # หรือ npm install
pnpm dev       # หรือ npm run dev
```

## Build

```bash
pnpm build
```

Build output จะอยู่ที่ `dist/`. ถ้าต้อง deploy ใต้ subpath (เช่น GitHub Pages) ให้ตั้ง
`BASE_PATH=/ชื่อ-repo/` ตอน build.
