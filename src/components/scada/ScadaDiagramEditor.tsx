import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Save, Trash2, LayoutTemplate, Settings2,
  Droplets, Wind, Zap, Filter, Gauge, FlaskConical, HelpCircle,
  Box, Activity, Monitor, ToggleLeft,
  type LucideIcon,
} from "lucide-react";
import type { BuildingConfig, TankKind, EquipmentKind, EquipmentStatus } from "@/lib/buildings";
import { ScadaSvgIcon, getTankIconUrl, getEquipmentIconUrl } from "@/components/scada/ScadaIcons";
import { Scada3DScene, type Scada3DSceneHandle } from "@/components/scada/Scada3DScene";
import {
  TANK_KIND_LABEL, EQ_COLORS, EQ_LABEL,
  type TankData, type EqData, type Scada3DNode, type Scada3DEdge,
} from "@/components/scada/scadaVisuals";
import { useDarkMode } from "@/hooks/use-dark-mode";

// ── Equipment icons for palette fallback (kinds without a dedicated SVG) ─────

const EQ_ICONS: Record<EquipmentKind, LucideIcon> = {
  pump:       Droplets,
  blower:     Wind,
  aerator:    Zap,
  screen:     Filter,
  dosing:     Gauge,
  valve:      FlaskConical,
  sensor:     Activity,
  oled:       Monitor,
  flow_meter: Gauge,
  switch:     ToggleLeft,
  other:      HelpCircle,
};

// ── Palette items ─────────────────────────────────────────────────────────────

const PALETTE_TANKS: { kind: TankKind; label: string }[] = [
  { kind: "equalization",     label: "ปรับสภาพ" },
  { kind: "anoxic",           label: "ไร้อากาศ" },
  { kind: "aeration",         label: "เติมอากาศ" },
  { kind: "clarifier",        label: "ตกตะกอน" },
  { kind: "chlorine_contact", label: "สัมผัสคลอรีน" },
  { kind: "sludge_holding",   label: "เก็บสลัดจ์" },
  { kind: "custom",           label: "กำหนดเอง" },
];

const PALETTE_EQUIPMENT: { kind: EquipmentKind; label: string }[] = [
  { kind: "pump",       label: "ปั๊ม" },
  { kind: "blower",     label: "เป่าอากาศ" },
  { kind: "aerator",    label: "ตีน้ำ" },
  { kind: "screen",     label: "บาร์สกรีน" },
  { kind: "dosing",     label: "จ่ายสาร" },
  { kind: "valve",      label: "วาล์ว" },
  { kind: "sensor",     label: "เซ็นเซอร์" },
  { kind: "oled",       label: "จอ OLED" },
  { kind: "flow_meter", label: "มิเตอร์ลม" },
  { kind: "switch",     label: "สวิตช์" },
];

function PaletteItem({ type, kind, label, children }: {
  type: "tank" | "equipment";
  kind: TankKind | EquipmentKind;
  label: string;
  children: React.ReactNode;
}) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/scada-node-type", type);
    e.dataTransfer.setData("application/scada-node-kind", kind);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div draggable onDragStart={onDragStart}
      className="flex items-center gap-2 p-2 rounded-md border border-slate-700 bg-slate-800/60 hover:bg-slate-700/60 cursor-grab active:cursor-grabbing transition-colors select-none"
    >
      <div className="shrink-0">{children}</div>
      <span className="text-[10px] font-mono text-slate-300 truncate">{label}</span>
    </div>
  );
}

function MiniTankSvg({ kind }: { kind: TankKind }) {
  return <ScadaSvgIcon src={getTankIconUrl(kind)} size={22} />;
}

// ── Properties Panel ──────────────────────────────────────────────────────────

function PropertiesPanel({ node, onUpdate, onDelete }: {
  node: Scada3DNode | null;
  onUpdate: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [tag,    setTag]    = useState("");
  const [nameTh, setNameTh] = useState("");
  const [level,  setLevel]  = useState(60);
  const [status, setStatus] = useState<EquipmentStatus>("running");

  useEffect(() => {
    if (!node) return;
    const d = node.data as Record<string, unknown>;
    setTag((d.tag as string) || "");
    setNameTh((d.nameTh as string) || "");
    setLevel((d.level as number) || 60);
    setStatus((d.status as EquipmentStatus) || "running");
  }, [node?.id]);

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-500 p-4">
        <Settings2 className="w-7 h-7 opacity-30" />
        <p className="text-[10px] font-mono leading-relaxed">คลิกเลือกวัตถุ<br />เพื่อแก้ไขคุณสมบัติ</p>
      </div>
    );
  }

  const isTank = node.type === "tank";

  return (
    <div className="flex flex-col gap-2.5 p-2.5">
      <div className="text-[9px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-700 pb-1.5 flex items-center gap-1.5">
        {isTank ? <Box className="w-3 h-3" /> : <Settings2 className="w-3 h-3" />}
        {isTank ? "ถังบำบัด" : "อุปกรณ์"}
      </div>

      <div className="grid gap-1">
        <Label className="text-[10px] text-slate-300">Tag</Label>
        <Input value={tag} onChange={(e) => setTag(e.target.value)} className="h-6 text-[10px] font-mono bg-slate-800 border-slate-600 text-slate-100"
          onBlur={() => onUpdate(node.id, { tag })} />
      </div>
      <div className="grid gap-1">
        <Label className="text-[10px] text-slate-300">ชื่อภาษาไทย</Label>
        <Input value={nameTh} onChange={(e) => setNameTh(e.target.value)} className="h-6 text-[10px] bg-slate-800 border-slate-600 text-slate-100"
          onBlur={() => onUpdate(node.id, { nameTh })} />
      </div>
      {isTank && (
        <div className="grid gap-1">
          <Label className="text-[10px] text-slate-300">ระดับน้ำ (%)</Label>
          <input type="range" min={0} max={100} value={level}
            onChange={(e) => { setLevel(Number(e.target.value)); onUpdate(node.id, { level: Number(e.target.value) }); }}
            className="w-full accent-cyan-400 h-1.5" />
          <span className="text-[9px] font-mono text-slate-300 text-right">{level}%</span>
        </div>
      )}
      {!isTank && (
        <div className="grid gap-1">
          <Label className="text-[10px] text-slate-300">สถานะ</Label>
          <select value={status} onChange={(e) => { setStatus(e.target.value as EquipmentStatus); onUpdate(node.id, { status: e.target.value }); }}
            className="h-6 text-[10px] bg-slate-800 border border-slate-600 rounded px-1.5 text-slate-100">
            <option value="running">Running · เดินเครื่อง</option>
            <option value="stopped">Stopped · หยุด</option>
            <option value="fault">Fault · ผิดพลาด</option>
          </select>
        </div>
      )}

      <Button variant="destructive" size="sm" className="mt-1 h-6 text-[10px]" onClick={() => onDelete(node.id)}>
        <Trash2 className="w-3 h-3 mr-1" />
        ลบออก
      </Button>
    </div>
  );
}

// ── Storage helpers ───────────────────────────────────────────────────────────

// 3D schema — intentionally a new key; incompatible with the old 2D
// `scada.flow.v2.<buildingId>` format used by the original React-Flow editor.
const storageKey = (bid: string) => `scada.flow.3d.v1.${bid}`;

function loadDiagram(bid: string): { nodes: Scada3DNode[]; edges: Scada3DEdge[] } | null {
  try {
    const s = localStorage.getItem(storageKey(bid));
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveDiagram(bid: string, nodes: Scada3DNode[], edges: Scada3DEdge[]) {
  localStorage.setItem(storageKey(bid), JSON.stringify({ nodes, edges }));
}

/** Loads the saved 3D Process Flow Diagram for a building, or `null` if none was saved yet. */
export function getSavedDiagram(bid: string): { nodes: Scada3DNode[]; edges: Scada3DEdge[] } | null {
  return loadDiagram(bid);
}

/** Builds a fresh 3D layout from a building's tanks + equipment config. */
export function getDefaultDiagram(building: BuildingConfig): { nodes: Scada3DNode[]; edges: Scada3DEdge[] } {
  return autoLayout(building);
}

// ── Auto-layout ───────────────────────────────────────────────────────────────

const SCALE = 1 / 40; // old px-based constants below → scene "meters"

function autoLayout(building: BuildingConfig): { nodes: Scada3DNode[]; edges: Scada3DEdge[] } {
  const tanks = [...building.tanks].sort((a, b) => a.order - b.order);

  const TANK_SLOT_W    = 140 * SCALE;  // width allotted per tank column
  const TANK_GAP       = 60 * SCALE;   // gap between tank columns
  const EQ_SLOT_W      = 100 * SCALE;  // width allotted per equipment slot
  const EQ_COL_GAP     = 12 * SCALE;
  const EQ_ROW_DEPTH   = 1.1;          // distance per equipment row, going away from the tank line
  const EQ_COLS        = 2;
  const TANK_TO_EQ_GAP = 1.4;          // distance from the tank line (z=0) to the first equipment row

  const tankNodes: Scada3DNode[] = [];
  const eqNodes: Scada3DNode[]   = [];

  let curX = 0;

  tanks.forEach((t) => {
    const attachedEq = building.equipment.filter((eq) => eq.attachedTankId === t.id);
    const eqGridW = attachedEq.length > 0
      ? Math.min(attachedEq.length, EQ_COLS) * EQ_SLOT_W + (Math.min(attachedEq.length, EQ_COLS) - 1) * EQ_COL_GAP
      : 0;
    const colW = Math.max(TANK_SLOT_W, eqGridW);

    tankNodes.push({
      id: `tank-${t.id}`,
      type: "tank",
      position: { x: curX + colW / 2, z: 0 },
      data: { kind: t.kind, tag: t.tag, nameTh: t.nameTh, level: t.baseLevelPercent } as TankData,
    });

    attachedEq.forEach((eq, j) => {
      const col = j % EQ_COLS;
      const row = Math.floor(j / EQ_COLS);
      const startX = curX + colW / 2 - eqGridW / 2;
      eqNodes.push({
        id: `eq-${eq.id}`,
        type: "equipment",
        position: {
          x: startX + col * (EQ_SLOT_W + EQ_COL_GAP) + EQ_SLOT_W / 2,
          z: TANK_TO_EQ_GAP + row * EQ_ROW_DEPTH,
        },
        data: { kind: eq.kind, tag: eq.tag, nameTh: eq.nameTh, status: eq.status } as EqData,
      });
    });

    curX += colW + TANK_GAP;
  });

  // Equipment without an attached tank — placed further back, in their own row.
  const unattached = building.equipment.filter(
    (eq) => !building.tanks.find((t) => t.id === eq.attachedTankId),
  );
  let uqX = 0;
  const unattachedZ = TANK_TO_EQ_GAP + 3 * EQ_ROW_DEPTH;
  unattached.forEach((eq) => {
    eqNodes.push({
      id: `eq-${eq.id}`,
      type: "equipment",
      position: { x: uqX, z: unattachedZ },
      data: { kind: eq.kind, tag: eq.tag, nameTh: eq.nameTh, status: eq.status } as EqData,
    });
    uqX += EQ_SLOT_W + EQ_COL_GAP;
  });

  // Pipe edges tank → next tank
  const edges: Scada3DEdge[] = tanks.slice(0, -1).map((t, i) => ({
    id: `pipe-${t.id}-${tanks[i + 1].id}`,
    source: `tank-${t.id}`,
    target: `tank-${tanks[i + 1].id}`,
    active: true,
  }));

  return { nodes: [...tankNodes, ...eqNodes], edges };
}

// ── Inner Editor ──────────────────────────────────────────────────────────────

let nodeCounter = 1;

function ScadaEditorInner({ building, onSaved }: { building: BuildingConfig; onSaved: () => void }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sceneRef   = useRef<Scada3DSceneHandle>(null);
  const isDarkMode = useDarkMode();

  const getInitial = () => loadDiagram(building.id) || autoLayout(building);

  const [nodes, setNodes] = useState<Scada3DNode[]>(() => getInitial().nodes);
  const [edges, setEdges] = useState<Scada3DEdge[]>(() => getInitial().edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const d = loadDiagram(building.id) || autoLayout(building);
    setNodes(d.nodes);
    setEdges(d.edges);
    setSelectedNodeId(null);
  }, [building.id]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const handleUpdate = useCallback((id: string, patch: Record<string, unknown>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  }, []);

  const handleMoveNode = useCallback((id: string, x: number, z: number) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, position: { x, z } } : n));
  }, []);

  const handleConnect = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setEdges((eds) => {
      const exists = eds.some(
        (e) => (e.source === sourceId && e.target === targetId) || (e.source === targetId && e.target === sourceId),
      );
      if (exists) return eds;
      return [...eds, { id: `pipe-${sourceId}-${targetId}-${nodeCounter++}`, source: sourceId, target: targetId, active: true }];
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedNodeId) handleDelete(selectedNodeId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedNodeId, handleDelete]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/scada-node-type") as "tank" | "equipment";
    const kind = e.dataTransfer.getData("application/scada-node-kind") as TankKind | EquipmentKind;
    if (!type || !kind) return;

    const ground = sceneRef.current?.screenToGround(e.clientX, e.clientY);
    if (!ground) return;

    const uid = `${type}-dropped-${nodeCounter++}`;
    if (type === "tank") {
      setNodes((nds) => [...nds, {
        id: uid, type: "tank", position: ground,
        data: { kind: kind as TankKind, tag: `${kind.toUpperCase().slice(0, 2)}-${String(nodeCounter).padStart(2, "0")}`, nameTh: TANK_KIND_LABEL[kind as TankKind]?.th ?? "", level: 70 } as TankData,
      }]);
    } else {
      setNodes((nds) => [...nds, {
        id: uid, type: "equipment", position: ground,
        data: { kind: kind as EquipmentKind, tag: `${kind.toUpperCase().slice(0, 1)}-${String(nodeCounter).padStart(3, "0")}`, nameTh: EQ_LABEL[kind as EquipmentKind] ?? "", status: "running" as EquipmentStatus } as EqData,
      }]);
    }
  }, []);

  const handleSave       = () => { saveDiagram(building.id, nodes, edges); onSaved(); };
  const handleAutoLayout = () => { const d = autoLayout(building); setNodes(d.nodes); setEdges(d.edges); setSelectedNodeId(null); };
  const handleClear      = () => { setNodes([]); setEdges([]); setSelectedNodeId(null); };

  return (
    <div className="flex h-full w-full rounded-xl overflow-hidden bg-white border border-slate-300 dark:bg-slate-950 dark:border-slate-700">

      {/* ── Left Palette ── */}
      <div className="w-[130px] shrink-0 border-r border-slate-700 bg-slate-900 flex flex-col overflow-y-auto">
        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500 px-2 pt-3 pb-1">ถัง · Tanks</div>
        <div className="flex flex-col gap-1 px-1.5 pb-2">
          {PALETTE_TANKS.map((item) => (
            <PaletteItem key={item.kind} type="tank" kind={item.kind} label={item.label}>
              <MiniTankSvg kind={item.kind} />
            </PaletteItem>
          ))}
        </div>
        <div className="text-[9px] font-mono uppercase tracking-wider text-slate-500 px-2 pt-2 pb-1 border-t border-slate-700">อุปกรณ์ · Equipment</div>
        <div className="flex flex-col gap-1 px-1.5 pb-2">
          {PALETTE_EQUIPMENT.map((item) => {
            const Icon   = EQ_ICONS[item.kind] ?? HelpCircle;
            const color  = EQ_COLORS[item.kind] ?? "#94a3b8";
            const svgUrl = getEquipmentIconUrl(item.kind);
            return (
              <PaletteItem key={item.kind} type="equipment" kind={item.kind} label={item.label}>
                <div className="w-5 h-5 flex items-center justify-center">
                  {svgUrl ? (
                    <ScadaSvgIcon src={svgUrl} size={20} />
                  ) : (
                    <Icon size={14} style={{ color }} />
                  )}
                </div>
              </PaletteItem>
            );
          })}
        </div>
        <div className="mt-auto border-t border-slate-700 p-2">
          <div className="text-[8px] font-mono text-slate-600 uppercase tracking-wider mb-1.5">คำอธิบาย</div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded-full border-2 border-cyan-400/70 bg-cyan-400/10" />
            <span className="text-[8px] font-mono text-slate-500">จุดต่อท่อ</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-1 bg-cyan-400 rounded opacity-70" />
            <span className="text-[8px] font-mono text-slate-500">ท่อน้ำ</span>
          </div>
        </div>
      </div>

      {/* ── 3D Canvas ── */}
      <div className="flex-1 min-w-0 relative" ref={wrapperRef} onDrop={onDrop} onDragOver={onDragOver}>
        <Scada3DScene
          ref={sceneRef}
          nodes={nodes}
          edges={edges}
          selectedNodeId={selectedNodeId}
          isDarkMode={isDarkMode}
          onSelectNode={setSelectedNodeId}
          onMoveNode={handleMoveNode}
          onConnect={handleConnect}
        />

        <div className="absolute top-2 right-2 flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-white border-slate-300 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={handleAutoLayout}
          >
            <LayoutTemplate className="w-3 h-3 mr-1.5" /> จัดให้อัตโนมัติ
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs bg-white border-slate-300 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-red-900/40 dark:hover:text-red-400 dark:hover:border-red-500/50"
            onClick={handleClear}
          >
            <Trash2 className="w-3 h-3 mr-1.5" /> ล้างทั้งหมด
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-cyan-600 hover:bg-cyan-500 text-white"
            onClick={handleSave}
          >
            <Save className="w-3 h-3 mr-1.5" /> บันทึก
          </Button>
        </div>

        <div className="absolute top-2 left-2 text-[9px] font-mono rounded px-2 py-1 leading-relaxed text-slate-600 bg-white/85 border border-slate-300 dark:text-slate-500 dark:bg-slate-900/80 dark:border-slate-700 max-w-[260px]">
          ลากจาก palette · ลากวัตถุเพื่อย้าย · คลิกจุดต่อสีฟ้าที่ต้นทางแล้วปลายทางเพื่อวางท่อ (Esc ยกเลิก) · Del ลบ · ลาก/scroll เพื่อหมุนกล้อง
        </div>
      </div>

      {/* ── Right Properties Panel ── */}
      <div className="w-[150px] shrink-0 border-l border-slate-700 bg-slate-900 overflow-y-auto">
        <PropertiesPanel node={selectedNode} onUpdate={handleUpdate} onDelete={handleDelete} />
      </div>
    </div>
  );
}

// ── Public Export ─────────────────────────────────────────────────────────────

export interface ScadaDiagramEditorProps {
  building: BuildingConfig;
  onSaved?: () => void;
}

export function ScadaDiagramEditor({ building, onSaved }: ScadaDiagramEditorProps) {
  return <ScadaEditorInner building={building} onSaved={onSaved ?? (() => {})} />;
}
