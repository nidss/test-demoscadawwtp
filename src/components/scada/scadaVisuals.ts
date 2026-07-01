import type { TankKind, EquipmentKind, EquipmentStatus } from "@/lib/buildings";

// ─── Shared node/edge data types + color/label maps ──────────────────────────
//
// Split out from ScadaDiagramEditor.tsx / Scada3DScene.tsx so both can import
// them without the two files needing to import from each other.

export type TankData = { kind: TankKind; tag: string; nameTh: string; level: number };
export type EqData   = { kind: EquipmentKind; tag: string; nameTh: string; status: EquipmentStatus };

export interface Scada3DNode {
  id: string;
  type: "tank" | "equipment";
  /** Ground-plane placement; elevation is derived per node type below — nothing floats. */
  position: { x: number; z: number };
  data: TankData | EqData;
}

export interface Scada3DEdge {
  id: string;
  source: string;
  target: string;
  active: boolean;
}

export const TANK_COLORS: Record<TankKind, { stroke: string; fill: string }> = {
  equalization:     { stroke: "#22d3ee", fill: "#0e7490" },
  anoxic:           { stroke: "#60a5fa", fill: "#1d4ed8" },
  aeration:         { stroke: "#4ade80", fill: "#16a34a" },
  clarifier:        { stroke: "#a78bfa", fill: "#7c3aed" },
  chlorine_contact: { stroke: "#fb923c", fill: "#ea580c" },
  sludge_holding:   { stroke: "#94a3b8", fill: "#475569" },
  custom:           { stroke: "#e4e4e7", fill: "#52525b" },
};

export const TANK_KIND_LABEL: Record<TankKind, { th: string; en: string }> = {
  equalization:     { th: "ปรับสภาพ",       en: "EQUALIZATION" },
  anoxic:           { th: "ไร้อากาศ",        en: "ANOXIC" },
  aeration:         { th: "เติมอากาศ",       en: "AERATION" },
  clarifier:        { th: "ตกตะกอน",         en: "CLARIFIER" },
  chlorine_contact: { th: "สัมผัสคลอรีน",   en: "CHLORINE CONTACT" },
  sludge_holding:   { th: "เก็บสลัดจ์",      en: "SLUDGE HOLDING" },
  custom:           { th: "กำหนดเอง",        en: "CUSTOM" },
};

export const EQ_COLORS: Record<EquipmentKind, string> = {
  pump:       "#22d3ee",
  blower:     "#4ade80",
  aerator:    "#60a5fa",
  screen:     "#a78bfa",
  dosing:     "#fb923c",
  valve:      "#f472b6",
  sensor:     "#facc15",
  oled:       "#38bdf8",
  flow_meter: "#34d399",
  switch:     "#e879f9",
  other:      "#94a3b8",
};

export const EQ_LABEL: Record<EquipmentKind, string> = {
  pump:       "ปั๊ม",
  blower:     "เครื่องเป่าอากาศ",
  aerator:    "เครื่องตีน้ำ",
  screen:     "บาร์สกรีน",
  dosing:     "ปั๊มจ่ายสาร",
  valve:      "วาล์ว",
  sensor:     "เซ็นเซอร์",
  oled:       "จอ OLED",
  flow_meter: "มิเตอร์ลม",
  switch:     "สวิตช์",
  other:      "อื่นๆ",
};

export const STATUS_COLOR: Record<EquipmentStatus, string> = {
  running: "#4ade80",
  stopped: "#94a3b8",
  fault:   "#ef4444",
};

// Scene scale — "meters" used by the 3D scene and by autoLayout in ScadaDiagramEditor.
export const TANK_HEIGHT = 1.6;
export const TANK_RADIUS = 0.55;
export const EQ_HEIGHT = 0.7;
export const EQ_SIZE = 0.6;

/** World-space height of a node's pipe-connector anchor, above its ground position. */
export function anchorHeight(type: "tank" | "equipment"): number {
  return (type === "tank" ? TANK_HEIGHT : EQ_HEIGHT) + 0.45;
}
