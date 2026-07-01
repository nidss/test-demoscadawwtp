import { useEffect, useState } from "react";

export type BuildingStatus = "normal" | "warning" | "critical" | "offline";

export type TankKind =
  | "equalization"
  | "anoxic"
  | "aeration"
  | "clarifier"
  | "chlorine_contact"
  | "sludge_holding"
  | "custom";

export type EquipmentKind =
  | "pump"
  | "blower"
  | "aerator"
  | "screen"
  | "dosing"
  | "valve"
  | "sensor"
  | "oled"
  | "flow_meter"
  | "switch"
  | "other";

export type EquipmentStatus = "running" | "stopped" | "fault";

export interface BuildingTankConfig {
  id: string;
  tag: string;
  nameTh: string;
  kind: TankKind;
  capacityM3: number;
  baseLevelPercent: number;
  order: number;
}

export interface BuildingEquipmentConfig {
  id: string;
  tag: string;
  nameTh: string;
  kind: EquipmentKind;
  status: EquipmentStatus;
  attachedTankId?: string;
}

export interface BuildingAlarm {
  id: string;
  tag: string;
  severity: "High" | "Warning" | "Info";
  description: string;
  ageMin: number;
}

export interface BuildingConfig {
  id: string;
  code: string;
  nameTh: string;
  nameEn: string;
  capacityM3PerDay: number;
  status: BuildingStatus;
  uptime: string;
  baseInflow: number;
  basePH: number;
  baseDO: number;
  baseTurbidity: number;
  baseCl2: number;
  baseCompliance: number;
  initialFlowToday: number;
  tanks: BuildingTankConfig[];
  equipment: BuildingEquipmentConfig[];
  alarms: BuildingAlarm[];
  order: number;
}

export type BuildingDef = Pick<
  BuildingConfig,
  "id" | "code" | "nameTh" | "nameEn" | "capacityM3PerDay"
>;

export interface BuildingTankLive {
  tag: string;
  nameTh: string;
  kind: TankKind;
  capacityM3: number;
  level: number;
}

export interface BuildingLive {
  status: BuildingStatus;
  inflowRate: number;
  totalFlowToday: number;
  effluentCompliance: number;
  uptime: string;
  pH: number;
  do: number;
  turbidity: number;
  residualCl2: number;
  tanks: BuildingTankLive[];
  equipmentRunning: number;
  equipmentTotal: number;
  activeAlarms: BuildingAlarm[];
}

const DEFAULT_BUILDINGS: BuildingConfig[] = [
  {
    id: "b-si",
    code: "SI",
    nameTh: "ตึกสยามินทร์",
    nameEn: "Siamindra Building",
    capacityM3PerDay: 1800,
    status: "critical",
    uptime: "45d 12h",
    baseInflow: 75,
    basePH: 7.2,
    baseDO: 2.8,
    baseTurbidity: 3.1,
    baseCl2: 0.8,
    baseCompliance: 99.6,
    initialFlowToday: 1240,
    order: 0,
    tanks: [
      { id: "t-si-1", tag: "EQ-01", nameTh: "ปรับสภาพ", kind: "equalization", capacityM3: 500, baseLevelPercent: 65, order: 0 },
      { id: "t-si-2", tag: "AN-01", nameTh: "ไร้อากาศ", kind: "anoxic", capacityM3: 500, baseLevelPercent: 80, order: 1 },
      { id: "t-si-3", tag: "AT-01", nameTh: "เติมอากาศ", kind: "aeration", capacityM3: 1000, baseLevelPercent: 82, order: 2 },
      { id: "t-si-4", tag: "CL-01", nameTh: "ตกตะกอน", kind: "clarifier", capacityM3: 800, baseLevelPercent: 75, order: 3 },
      { id: "t-si-5", tag: "CC-01", nameTh: "สัมผัสคลอรีน", kind: "chlorine_contact", capacityM3: 250, baseLevelPercent: 60, order: 4 },
    ],
    equipment: [
      { id: "e-si-1", tag: "BS-01", nameTh: "บาร์สกรีน", kind: "screen", status: "running" },
      { id: "e-si-2", tag: "P-101", nameTh: "ปั๊มน้ำเข้า 1", kind: "pump", status: "fault", attachedTankId: "t-si-1" },
      { id: "e-si-3", tag: "P-102", nameTh: "ปั๊มน้ำเข้า 2", kind: "pump", status: "running", attachedTankId: "t-si-1" },
      { id: "e-si-4", tag: "B-201", nameTh: "เครื่องเป่าอากาศ 1", kind: "blower", status: "running", attachedTankId: "t-si-3" },
      { id: "e-si-5", tag: "B-202", nameTh: "เครื่องเป่าอากาศ 2", kind: "blower", status: "stopped", attachedTankId: "t-si-3" },
      { id: "e-si-6", tag: "MA-301", nameTh: "เครื่องตีน้ำ", kind: "aerator", status: "running", attachedTankId: "t-si-3" },
      { id: "e-si-7", tag: "P-301", nameTh: "ปั๊มสลัดจ์", kind: "pump", status: "stopped", attachedTankId: "t-si-4" },
      { id: "e-si-8", tag: "D-401", nameTh: "ปั๊มจ่ายคลอรีน", kind: "dosing", status: "running", attachedTankId: "t-si-5" },
    ],
    alarms: [
      { id: "a-si-1", tag: "P-101", severity: "High", description: "ปั๊มน้ำเข้าโอเวอร์โหลด / Motor overload", ageMin: 5 },
    ],
  },
  {
    id: "b-84y",
    code: "84Y",
    nameTh: "ตึก ๘๔ ปี",
    nameEn: "84 Years Building",
    capacityM3PerDay: 1200,
    status: "normal",
    uptime: "28d 04h",
    baseInflow: 48,
    basePH: 7.0,
    baseDO: 3.2,
    baseTurbidity: 2.4,
    baseCl2: 0.9,
    baseCompliance: 99.9,
    initialFlowToday: 850,
    order: 1,
    tanks: [
      { id: "t-84y-1", tag: "EQ-02", nameTh: "ปรับสภาพ", kind: "equalization", capacityM3: 350, baseLevelPercent: 58, order: 0 },
      { id: "t-84y-2", tag: "AT-02", nameTh: "เติมอากาศ", kind: "aeration", capacityM3: 700, baseLevelPercent: 78, order: 1 },
      { id: "t-84y-3", tag: "CL-02", nameTh: "ตกตะกอน", kind: "clarifier", capacityM3: 500, baseLevelPercent: 72, order: 2 },
      { id: "t-84y-4", tag: "CC-02", nameTh: "สัมผัสคลอรีน", kind: "chlorine_contact", capacityM3: 180, baseLevelPercent: 55, order: 3 },
    ],
    equipment: [
      { id: "e-84y-1", tag: "BS-02", nameTh: "บาร์สกรีน", kind: "screen", status: "running" },
      { id: "e-84y-2", tag: "P-201", nameTh: "ปั๊มน้ำเข้า", kind: "pump", status: "running", attachedTankId: "t-84y-1" },
      { id: "e-84y-3", tag: "B-211", nameTh: "เครื่องเป่าอากาศ", kind: "blower", status: "running", attachedTankId: "t-84y-2" },
      { id: "e-84y-4", tag: "MA-211", nameTh: "เครื่องตีน้ำ", kind: "aerator", status: "running", attachedTankId: "t-84y-2" },
      { id: "e-84y-5", tag: "P-311", nameTh: "ปั๊มสลัดจ์", kind: "pump", status: "running", attachedTankId: "t-84y-3" },
      { id: "e-84y-6", tag: "D-411", nameTh: "ปั๊มจ่ายคลอรีน", kind: "dosing", status: "running", attachedTankId: "t-84y-4" },
    ],
    alarms: [],
  },
  {
    id: "b-cm",
    code: "CMU",
    nameTh: "ตึกศูนย์การแพทย์",
    nameEn: "Medical Center",
    capacityM3PerDay: 2400,
    status: "warning",
    uptime: "62d 18h",
    baseInflow: 110,
    basePH: 7.4,
    baseDO: 2.5,
    baseTurbidity: 4.2,
    baseCl2: 0.6,
    baseCompliance: 98.4,
    initialFlowToday: 2180,
    order: 2,
    tanks: [
      { id: "t-cm-1", tag: "EQ-03", nameTh: "ปรับสภาพ", kind: "equalization", capacityM3: 800, baseLevelPercent: 88, order: 0 },
      { id: "t-cm-2", tag: "AN-03", nameTh: "ไร้อากาศ", kind: "anoxic", capacityM3: 600, baseLevelPercent: 81, order: 1 },
      { id: "t-cm-3", tag: "AT-03", nameTh: "เติมอากาศ", kind: "aeration", capacityM3: 1500, baseLevelPercent: 85, order: 2 },
      { id: "t-cm-4", tag: "CL-03", nameTh: "ตกตะกอน", kind: "clarifier", capacityM3: 1000, baseLevelPercent: 70, order: 3 },
      { id: "t-cm-5", tag: "CC-03", nameTh: "สัมผัสคลอรีน", kind: "chlorine_contact", capacityM3: 350, baseLevelPercent: 62, order: 4 },
      { id: "t-cm-6", tag: "SH-03", nameTh: "เก็บสลัดจ์", kind: "sludge_holding", capacityM3: 300, baseLevelPercent: 48, order: 5 },
    ],
    equipment: [
      { id: "e-cm-1", tag: "BS-03", nameTh: "บาร์สกรีนหยาบ", kind: "screen", status: "running" },
      { id: "e-cm-2", tag: "BS-04", nameTh: "บาร์สกรีนละเอียด", kind: "screen", status: "running" },
      { id: "e-cm-3", tag: "P-301", nameTh: "ปั๊มน้ำเข้า 1", kind: "pump", status: "running", attachedTankId: "t-cm-1" },
      { id: "e-cm-4", tag: "P-302", nameTh: "ปั๊มน้ำเข้า 2", kind: "pump", status: "running", attachedTankId: "t-cm-1" },
      { id: "e-cm-5", tag: "B-301", nameTh: "เครื่องเป่าอากาศ 1", kind: "blower", status: "running", attachedTankId: "t-cm-3" },
      { id: "e-cm-6", tag: "B-302", nameTh: "เครื่องเป่าอากาศ 2", kind: "blower", status: "running", attachedTankId: "t-cm-3" },
      { id: "e-cm-7", tag: "B-303", nameTh: "เครื่องเป่าอากาศ 3", kind: "blower", status: "stopped", attachedTankId: "t-cm-3" },
      { id: "e-cm-8", tag: "MA-303", nameTh: "เครื่องตีน้ำ", kind: "aerator", status: "running", attachedTankId: "t-cm-3" },
      { id: "e-cm-9", tag: "MIX-302", nameTh: "เครื่องกวน Anoxic", kind: "aerator", status: "running", attachedTankId: "t-cm-2" },
      { id: "e-cm-10", tag: "P-303", nameTh: "ปั๊มสลัดจ์ 1", kind: "pump", status: "running", attachedTankId: "t-cm-4" },
      { id: "e-cm-11", tag: "P-304", nameTh: "ปั๊มสลัดจ์ 2", kind: "pump", status: "running", attachedTankId: "t-cm-6" },
      { id: "e-cm-12", tag: "D-403", nameTh: "ปั๊มจ่ายคลอรีน", kind: "dosing", status: "running", attachedTankId: "t-cm-5" },
    ],
    alarms: [
      { id: "a-cm-1", tag: "AIT-303", severity: "Warning", description: "DO ต่ำในถังเติมอากาศ / Low DO", ageMin: 12 },
      { id: "a-cm-2", tag: "EQ-03", severity: "Warning", description: "ระดับน้ำสูงในถังปรับสภาพ / High level", ageMin: 3 },
    ],
  },
  {
    id: "b-ss",
    code: "SS",
    nameTh: "ตึกศรีสวรินทิรา",
    nameEn: "Srisavarindira Building",
    capacityM3PerDay: 900,
    status: "normal",
    uptime: "120d 02h",
    baseInflow: 32,
    basePH: 7.1,
    baseDO: 3.0,
    baseTurbidity: 2.0,
    baseCl2: 0.85,
    baseCompliance: 100.0,
    initialFlowToday: 540,
    order: 3,
    tanks: [
      { id: "t-ss-1", tag: "EQ-04", nameTh: "ปรับสภาพ", kind: "equalization", capacityM3: 250, baseLevelPercent: 50, order: 0 },
      { id: "t-ss-2", tag: "AT-04", nameTh: "เติมอากาศ", kind: "aeration", capacityM3: 500, baseLevelPercent: 76, order: 1 },
      { id: "t-ss-3", tag: "CL-04", nameTh: "ตกตะกอน", kind: "clarifier", capacityM3: 400, baseLevelPercent: 68, order: 2 },
      { id: "t-ss-4", tag: "CC-04", nameTh: "สัมผัสคลอรีน", kind: "chlorine_contact", capacityM3: 150, baseLevelPercent: 58, order: 3 },
    ],
    equipment: [
      { id: "e-ss-1", tag: "P-401", nameTh: "ปั๊มน้ำเข้า", kind: "pump", status: "running", attachedTankId: "t-ss-1" },
      { id: "e-ss-2", tag: "B-401", nameTh: "เครื่องเป่าอากาศ", kind: "blower", status: "running", attachedTankId: "t-ss-2" },
      { id: "e-ss-3", tag: "MA-401", nameTh: "เครื่องตีน้ำ", kind: "aerator", status: "running", attachedTankId: "t-ss-2" },
      { id: "e-ss-4", tag: "P-411", nameTh: "ปั๊มสลัดจ์", kind: "pump", status: "running", attachedTankId: "t-ss-3" },
      { id: "e-ss-5", tag: "D-401", nameTh: "ปั๊มจ่ายคลอรีน", kind: "dosing", status: "running", attachedTankId: "t-ss-4" },
    ],
    alarms: [],
  },
];

const STORAGE_KEY = "scada.buildings.v2";
const accumulatedFlow: Record<string, number> = {};

function seedAccumulators(buildings: BuildingConfig[]) {
  buildings.forEach((b) => {
    if (!(b.id in accumulatedFlow)) accumulatedFlow[b.id] = b.initialFlowToday;
  });
}

class BuildingsStore {
  buildings: BuildingConfig[] = [];
  listeners = new Set<() => void>();

  constructor() {
    this.load();
  }

  load() {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (saved) {
      try {
        this.buildings = JSON.parse(saved);
      } catch {
        this.buildings = JSON.parse(JSON.stringify(DEFAULT_BUILDINGS));
      }
    } else {
      this.buildings = JSON.parse(JSON.stringify(DEFAULT_BUILDINGS));
    }
    this.buildings.sort((a, b) => a.order - b.order);
    seedAccumulators(this.buildings);
  }

  save() {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.buildings));
    }
    this.notify();
  }

  notify() {
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // ----- Buildings -----
  addBuilding(input: Omit<BuildingConfig, "id" | "order" | "tanks" | "equipment" | "alarms">) {
    const id = `b-${crypto.randomUUID().slice(0, 8)}`;
    const order = this.buildings.length;
    this.buildings.push({
      ...input,
      id,
      order,
      tanks: [],
      equipment: [],
      alarms: [],
    });
    accumulatedFlow[id] = input.initialFlowToday ?? 0;
    this.save();
    return id;
  }

  updateBuilding(id: string, patch: Partial<BuildingConfig>) {
    this.buildings = this.buildings.map((b) => (b.id === id ? { ...b, ...patch } : b));
    this.save();
  }

  removeBuilding(id: string) {
    this.buildings = this.buildings.filter((b) => b.id !== id);
    delete accumulatedFlow[id];
    this.buildings.forEach((b, i) => {
      b.order = i;
    });
    this.save();
  }

  moveBuilding(id: string, direction: -1 | 1) {
    const idx = this.buildings.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= this.buildings.length) return;
    const tmp = this.buildings[idx];
    this.buildings[idx] = this.buildings[newIdx];
    this.buildings[newIdx] = tmp;
    this.buildings.forEach((b, i) => {
      b.order = i;
    });
    this.save();
  }

  // ----- Tanks (per building) -----
  addTank(buildingId: string, tank: Omit<BuildingTankConfig, "id" | "order">) {
    const b = this.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    b.tanks.push({ ...tank, id: `t-${crypto.randomUUID().slice(0, 8)}`, order: b.tanks.length });
    this.save();
  }

  updateTank(buildingId: string, tankId: string, patch: Partial<BuildingTankConfig>) {
    const b = this.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    b.tanks = b.tanks.map((t) => (t.id === tankId ? { ...t, ...patch } : t));
    this.save();
  }

  removeTank(buildingId: string, tankId: string) {
    const b = this.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    b.tanks = b.tanks.filter((t) => t.id !== tankId);
    b.equipment = b.equipment.map((e) =>
      e.attachedTankId === tankId ? { ...e, attachedTankId: undefined } : e,
    );
    this.save();
  }

  moveTank(buildingId: string, tankId: string, direction: -1 | 1) {
    const b = this.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    const idx = b.tanks.findIndex((t) => t.id === tankId);
    const newIdx = idx + direction;
    if (idx === -1 || newIdx < 0 || newIdx >= b.tanks.length) return;
    const tmp = b.tanks[idx];
    b.tanks[idx] = b.tanks[newIdx];
    b.tanks[newIdx] = tmp;
    b.tanks.forEach((t, i) => {
      t.order = i;
    });
    this.save();
  }

  // ----- Equipment (per building) -----
  addEquipment(buildingId: string, eq: Omit<BuildingEquipmentConfig, "id">) {
    const b = this.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    b.equipment.push({ ...eq, id: `e-${crypto.randomUUID().slice(0, 8)}` });
    this.save();
  }

  updateEquipment(buildingId: string, eqId: string, patch: Partial<BuildingEquipmentConfig>) {
    const b = this.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    b.equipment = b.equipment.map((e) => (e.id === eqId ? { ...e, ...patch } : e));
    this.save();
  }

  removeEquipment(buildingId: string, eqId: string) {
    const b = this.buildings.find((x) => x.id === buildingId);
    if (!b) return;
    b.equipment = b.equipment.filter((e) => e.id !== eqId);
    this.save();
  }

  resetToDefaults() {
    this.buildings = JSON.parse(JSON.stringify(DEFAULT_BUILDINGS));
    Object.keys(accumulatedFlow).forEach((k) => delete accumulatedFlow[k]);
    seedAccumulators(this.buildings);
    this.save();
  }
}

export const buildingsStore = new BuildingsStore();

export function useBuildingConfigs(): BuildingConfig[] {
  const [b, setB] = useState<BuildingConfig[]>(buildingsStore.buildings);
  useEffect(() => {
    const unsub = buildingsStore.subscribe(() => setB([...buildingsStore.buildings]));
    return () => {
      unsub();
    };
  }, []);
  return b;
}

function noise(base: number, variance: number) {
  return base + (Math.random() * 2 - 1) * variance;
}

function computeAll(): Record<string, BuildingLive> {
  const out: Record<string, BuildingLive> = {};
  buildingsStore.buildings.forEach((b) => {
    if (!(b.id in accumulatedFlow)) accumulatedFlow[b.id] = b.initialFlowToday;
    const inflow = noise(b.baseInflow, b.baseInflow * 0.04);
    accumulatedFlow[b.id] += (inflow / 3600) * 1.5;
    const tanks: BuildingTankLive[] = b.tanks
      .slice()
      .sort((x, y) => x.order - y.order)
      .map((t) => ({
        tag: t.tag,
        nameTh: t.nameTh,
        kind: t.kind,
        capacityM3: t.capacityM3,
        level: Number(Math.min(100, Math.max(0, noise(t.baseLevelPercent, 0.6))).toFixed(1)),
      }));
    const equipmentRunning = b.equipment.filter((e) => e.status === "running").length;
    out[b.id] = {
      status: b.status,
      inflowRate: Number(inflow.toFixed(1)),
      totalFlowToday: Math.round(accumulatedFlow[b.id]),
      effluentCompliance: Number(noise(b.baseCompliance, 0.05).toFixed(2)),
      uptime: b.uptime,
      pH: Number(noise(b.basePH, 0.04).toFixed(2)),
      do: Number(noise(b.baseDO, 0.08).toFixed(2)),
      turbidity: Number(noise(b.baseTurbidity, 0.15).toFixed(1)),
      residualCl2: Number(noise(b.baseCl2, 0.02).toFixed(2)),
      tanks,
      equipmentRunning,
      equipmentTotal: b.equipment.length,
      activeAlarms: b.alarms,
    };
  });
  return out;
}

export function useBuildingsLive(): Record<string, BuildingLive> {
  const [data, setData] = useState<Record<string, BuildingLive>>(() => computeAll());
  useEffect(() => {
    const interval = setInterval(() => setData(computeAll()), 1500);
    const unsub = buildingsStore.subscribe(() => setData(computeAll()));
    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);
  return data;
}

export function useBuildingsAggregate() {
  const live = useBuildingsLive();
  const buildings = useBuildingConfigs();
  let totalInflow = 0;
  let totalFlowToday = 0;
  let alarmCount = 0;
  let plantsOnline = 0;
  let criticalCount = 0;
  let warningCount = 0;
  Object.values(live).forEach((b) => {
    totalInflow += b.inflowRate;
    totalFlowToday += b.totalFlowToday;
    alarmCount += b.activeAlarms.length;
    if (b.status !== "offline") plantsOnline++;
    if (b.status === "critical") criticalCount++;
    if (b.status === "warning") warningCount++;
  });
  return {
    live,
    buildings,
    totalInflow: Number(totalInflow.toFixed(1)),
    totalFlowToday,
    alarmCount,
    plantsOnline,
    criticalCount,
    warningCount,
  };
}
