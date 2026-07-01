import React, { useCallback, useRef, useState, useEffect } from "react";
import {
  ReactFlow, Background, Controls, MiniMap, Panel,
  useNodesState, useEdgesState, addEdge,
  Handle, Position,
  useReactFlow, ReactFlowProvider,
  getBezierPath,
  type Node, type Edge, type Connection, type NodeProps, type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Save, Trash2, LayoutTemplate, Settings2,
  Droplets, Wind, Zap, Filter, Gauge, FlaskConical, HelpCircle,
  Box,
  Activity, Monitor, ToggleLeft,
} from "lucide-react";
import type { BuildingConfig, TankKind, EquipmentKind, EquipmentStatus } from "@/lib/buildings";
import {
  ScadaSvgIcon,
  getTankIconUrl,
  getEquipmentIconUrl,
} from "@/components/scada/ScadaIcons";
import { useDarkMode } from "@/hooks/use-dark-mode";

// ── Colour + label maps ───────────────────────────────────────────────────────

const TANK_COLORS: Record<TankKind, { bg: string; stroke: string; fill: string }> = {
  equalization:     { bg: "#0e4a5c", stroke: "#22d3ee", fill: "#0e7490" },
  anoxic:           { bg: "#1e3a5f", stroke: "#60a5fa", fill: "#1d4ed8" },
  aeration:         { bg: "#14532d", stroke: "#4ade80", fill: "#16a34a" },
  clarifier:        { bg: "#2e1065", stroke: "#a78bfa", fill: "#7c3aed" },
  chlorine_contact: { bg: "#7c2d12", stroke: "#fb923c", fill: "#ea580c" },
  sludge_holding:   { bg: "#1c1917", stroke: "#94a3b8", fill: "#475569" },
  custom:           { bg: "#18181b", stroke: "#e4e4e7", fill: "#52525b" },
};

const TANK_KIND_LABEL: Record<TankKind, { th: string; en: string }> = {
  equalization:     { th: "ปรับสภาพ",       en: "EQUALIZATION" },
  anoxic:           { th: "ไร้อากาศ",        en: "ANOXIC" },
  aeration:         { th: "เติมอากาศ",       en: "AERATION" },
  clarifier:        { th: "ตกตะกอน",         en: "CLARIFIER" },
  chlorine_contact: { th: "สัมผัสคลอรีน",   en: "CHLORINE CONTACT" },
  sludge_holding:   { th: "เก็บสลัดจ์",      en: "SLUDGE HOLDING" },
  custom:           { th: "กำหนดเอง",        en: "CUSTOM" },
};

const EQ_ICONS: Record<EquipmentKind, React.ElementType> = {
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

const EQ_COLORS: Record<EquipmentKind, string> = {
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

const EQ_LABEL: Record<EquipmentKind, string> = {
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

const STATUS_COLOR: Record<EquipmentStatus, string> = {
  running: "#4ade80",
  stopped: "#475569",
  fault:   "#ef4444",
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

// ── Node data types ───────────────────────────────────────────────────────────

type TankData      = { kind: TankKind; tag: string; nameTh: string; level: number };
type EqData        = { kind: EquipmentKind; tag: string; nameTh: string; status: EquipmentStatus };

// ── Custom Tank Node ──────────────────────────────────────────────────────────

function TankNode({ data, selected }: NodeProps) {
  const d = data as TankData;
  const c = TANK_COLORS[d.kind] ?? TANK_COLORS.custom;
  const iconUrl = getTankIconUrl(d.kind);
  const W = 96; const H = 120;
  const level = Math.max(0, Math.min(100, d.level ?? 60));
  const isDark = useDarkMode();
  const handleBorder = isDark ? "#0f172a" : "#ffffff";
  const labelClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className={cn("flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing", selected && "drop-shadow-[0_0_12px_rgba(6,182,212,0.9)]")}>
      <Handle type="target" position={Position.Left}   id="left"   style={{ background: "#22d3ee", width: 12, height: 12, border: `2px solid ${handleBorder}` }} />
      <Handle type="source" position={Position.Right}  id="right"  style={{ background: "#22d3ee", width: 12, height: 12, border: `2px solid ${handleBorder}` }} />
      <Handle type="target" position={Position.Top}    id="top"    style={{ background: "#94a3b8", width: 9,  height: 9,  border: `2px solid ${handleBorder}` }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ background: "#94a3b8", width: 9,  height: 9,  border: `2px solid ${handleBorder}` }} />

      <span className="text-[12px] font-mono font-bold" style={{ color: c.stroke }}>{d.tag}</span>
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <ScadaSvgIcon src={iconUrl} size={W} withShadow />
        {/* Water-level pill — uses tank kind's accent so each type stays distinguishable */}
        <div
          style={{
            position: "absolute",
            bottom: 2,
            right: -2,
            background: c.fill,
            color: "white",
            fontSize: 11,
            fontFamily: "monospace",
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: 7,
            border: `1.5px solid ${c.stroke}`,
            lineHeight: 1.1,
            minWidth: 36,
            textAlign: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }}
        >
          {Math.round(level)}%
        </div>
      </div>
      <span className={cn("text-[11px] font-mono max-w-[110px] text-center truncate leading-tight", labelClass)}>{d.nameTh || TANK_KIND_LABEL[d.kind]?.th}</span>
    </div>
  );
}

// ── Custom Equipment Node ─────────────────────────────────────────────────────

function EquipmentNode({ data, selected }: NodeProps) {
  const d = data as EqData;
  const color  = EQ_COLORS[d.kind]  ?? "#94a3b8";
  const statusCol = STATUS_COLOR[d.status ?? "running"];
  const Icon   = EQ_ICONS[d.kind]  ?? HelpCircle;
  const svgUrl = getEquipmentIconUrl(d.kind);
  const isDark = useDarkMode();

  const handleBorder = isDark ? "#0f172a" : "#ffffff";
  const labelClass = isDark ? "text-slate-400" : "text-slate-600";

  return (
    <div className={cn("flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing")}>
      <Handle type="target" position={Position.Left}  id="left"  style={{ background: color, width: 12, height: 12, border: `2px solid ${handleBorder}` }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: color, width: 12, height: 12, border: `2px solid ${handleBorder}` }} />

      <span className="text-[12px] font-mono font-bold" style={{ color }}>{d.tag}</span>
      <div
        style={{
          width: 80,
          height: 80,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          // Selection highlight as a soft halo (no frame)
          filter: selected ? `drop-shadow(0 0 8px ${color})` : undefined,
        }}
      >
        {svgUrl ? (
          <ScadaSvgIcon src={svgUrl} size={80} />
        ) : (
          <Icon size={56} style={{ color }} />
        )}
        {/* Status dot — top-right so it never overlaps the icon body */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: statusCol,
            border: `2px solid ${handleBorder}`,
            boxShadow: `0 0 0 1px ${statusCol}33`,
          }}
        />
      </div>
      <span className={cn("text-[11px] font-mono max-w-[100px] text-center truncate leading-tight", labelClass)}>{d.nameTh || EQ_LABEL[d.kind]}</span>
    </div>
  );
}

// ── Custom Pipe Edge ──────────────────────────────────────────────────────────

function PipeEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, data }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const active = (data as { active?: boolean })?.active !== false;
  const col = active ? "#22d3ee" : "#475569";

  return (
    <>
      <path d={path} fill="none" stroke={selected ? "#f0abfc" : col} strokeWidth={selected ? 4 : 3} strokeLinecap="round" opacity={0.7} />
      {active && (
        <path d={path} fill="none" stroke="#a5f3fc" strokeWidth={2} strokeLinecap="round"
          strokeDasharray="8 14"
          style={{ animation: "scadaFlowPipe 1.4s linear infinite" }}
        />
      )}
      <path d={path} fill="none" stroke="transparent" strokeWidth={12} id={id} />
    </>
  );
}

// ── Properties Panel ──────────────────────────────────────────────────────────

function PropertiesPanel({ node, onUpdate, onDelete }: {
  node: Node | null;
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
    setNameTh((d.nameTh as string) || (d.label as string) || "");
    setLevel((d.level as number) || 60);
    setStatus((d.status as EquipmentStatus) || "running");
  }, [node?.id]);

  if (!node) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-500 p-4">
        <Settings2 className="w-7 h-7 opacity-30" />
        <p className="text-[10px] font-mono leading-relaxed">คลิกเลือก node<br />เพื่อแก้ไขคุณสมบัติ</p>
      </div>
    );
  }

  const isTank  = node.type === "tank";

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

// ── Palette item ──────────────────────────────────────────────────────────────

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

// ── Node + Edge type maps ─────────────────────────────────────────────────────

const NODE_TYPES = { tank: TankNode, equipment: EquipmentNode };
const EDGE_TYPES = { pipe: PipeEdge };

// ── Storage helpers ───────────────────────────────────────────────────────────

// v2 — removed group container nodes; old v1 diagrams will fall back to autoLayout
const storageKey = (bid: string) => `scada.flow.v2.${bid}`;

/**
 * Approximate visual sizes of nodes as they render in the editor.
 * Used by both the live editor layout and the static dashboard preview
 * (DiagramPreview) so geometry stays consistent.
 */
export const NODE_DIMS = {
  tank: { w: 96, h: 120, totalH: 168 },     // icon w/h + tag + label
  equipment: { w: 80, h: 80, totalH: 124 }, // icon + tag + label
};

function loadDiagram(bid: string): { nodes: Node[]; edges: Edge[] } | null {
  try {
    const s = localStorage.getItem(storageKey(bid));
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

function saveDiagram(bid: string, nodes: Node[], edges: Edge[]) {
  localStorage.setItem(storageKey(bid), JSON.stringify({ nodes, edges }));
}

/**
 * Loads the saved Process Flow Diagram for the given building so other parts
 * of the app (e.g. dashboard cards) can render a read-only preview.
 *
 * Returns `null` if the operator has not yet saved a diagram for this
 * building — callers should fall back to a default view in that case.
 */
export function getSavedDiagram(bid: string): { nodes: Node[]; edges: Edge[] } | null {
  return loadDiagram(bid);
}

/**
 * Builds a fresh diagram layout from a building's tanks + equipment config.
 *
 * Exposed so DiagramPreview can render a sensible default for buildings that
 * the operator hasn't manually arranged yet — the same shape the editor would
 * propose when you click "จัดให้อัตโนมัติ".
 */
export function getDefaultDiagram(building: BuildingConfig): { nodes: Node[]; edges: Edge[] } {
  return autoLayout(building);
}

// ── Auto-layout ───────────────────────────────────────────────────────────────

function autoLayout(building: BuildingConfig): { nodes: Node[]; edges: Edge[] } {
  const tanks = [...building.tanks].sort((a, b) => a.order - b.order);

  // Sizes must roughly match the actual node visual sizes so layout looks tight.
  // TankNode renders ~96px wide + label (~110px text width); allow ~140px slot.
  // EquipmentNode renders 80px wide; allow ~96px slot.
  const TANK_SLOT_W = 140;       // horizontal space allocated per tank column
  const TANK_TOP_Y  = 40;        // Y position of tanks (their top edge)
  const TANK_BLOCK_H = 168;      // total visual height incl. tag + icon + label
  const EQ_SLOT_W   = 100;       // horizontal slot per equipment
  const EQ_BLOCK_H  = 124;       // total visual height of an equipment node
  const EQ_ROW_GAP  = 16;
  const EQ_COL_GAP  = 12;
  const EQ_COLS     = 2;
  const TANK_GAP    = 60;        // horizontal gap between tank columns
  const EQ_OFFSET_Y = TANK_TOP_Y + TANK_BLOCK_H + 24; // where equipment rows start (Y)

  const tankNodes: Node[] = [];
  const eqNodes: Node[]   = [];

  let curX = 30;

  tanks.forEach((t) => {
    const attachedEq = building.equipment.filter((eq) => eq.attachedTankId === t.id);
    const eqRows = Math.ceil(attachedEq.length / EQ_COLS);
    // Column width is the wider of: tank slot, or equipment grid width.
    const eqGridW = attachedEq.length > 0
      ? Math.min(attachedEq.length, EQ_COLS) * EQ_SLOT_W + (Math.min(attachedEq.length, EQ_COLS) - 1) * EQ_COL_GAP
      : 0;
    const colW = Math.max(TANK_SLOT_W, eqGridW);

    // Tank centred at top of column
    tankNodes.push({
      id: `tank-${t.id}`,
      type: "tank",
      position: { x: curX + colW / 2 - TANK_SLOT_W / 2, y: TANK_TOP_Y },
      data: { kind: t.kind, tag: t.tag, nameTh: t.nameTh, level: t.baseLevelPercent } as TankData,
    });

    // Equipment arranged in rows below the tank
    attachedEq.forEach((eq, j) => {
      const col = j % EQ_COLS;
      const row = Math.floor(j / EQ_COLS);
      const startX = curX + (colW - eqGridW) / 2;
      eqNodes.push({
        id: `eq-${eq.id}`,
        type: "equipment",
        position: {
          x: startX + col * (EQ_SLOT_W + EQ_COL_GAP),
          y: EQ_OFFSET_Y + row * (EQ_BLOCK_H + EQ_ROW_GAP),
        },
        data: { kind: eq.kind, tag: eq.tag, nameTh: eq.nameTh, status: eq.status } as EqData,
      });
    });

    curX += colW + TANK_GAP;
  });

  // Equipment without an attached tank — placed below all columns
  const unattached = building.equipment.filter(
    (eq) => !building.tanks.find((t) => t.id === eq.attachedTankId),
  );
  let uqX = 30;
  const unattachedY = EQ_OFFSET_Y + 3 * (EQ_BLOCK_H + EQ_ROW_GAP);
  unattached.forEach((eq) => {
    eqNodes.push({
      id: `eq-${eq.id}`,
      type: "equipment",
      position: { x: uqX, y: unattachedY },
      data: { kind: eq.kind, tag: eq.tag, nameTh: eq.nameTh, status: eq.status } as EqData,
    });
    uqX += EQ_SLOT_W + EQ_COL_GAP;
  });

  // Pipe edges tank → next tank
  const edges: Edge[] = tanks.slice(0, -1).map((t, i) => ({
    id: `pipe-${t.id}-${tanks[i + 1].id}`,
    source: `tank-${t.id}`,
    sourceHandle: "right",
    target: `tank-${tanks[i + 1].id}`,
    targetHandle: "left",
    type: "pipe",
    data: { active: true },
  }));

  return { nodes: [...tankNodes, ...eqNodes], edges };
}

// ── Inner Editor ──────────────────────────────────────────────────────────────

let nodeCounter = 1;

function ScadaEditorInner({ building, onSaved }: { building: BuildingConfig; onSaved: () => void }) {
  const reactFlowWrapper  = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const isDarkMode = useDarkMode();

  const getInitial = () => loadDiagram(building.id) || autoLayout(building);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(getInitial().nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(getInitial().edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const d = loadDiagram(building.id) || autoLayout(building);
    setNodes(d.nodes);
    setEdges(d.edges);
    setSelectedNodeId(null);
  }, [building.id]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, type: "pipe", data: { active: true } }, eds)),
    [setEdges],
  );

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/scada-node-type") as "tank" | "equipment";
    const kind = e.dataTransfer.getData("application/scada-node-kind") as TankKind | EquipmentKind;
    if (!type || !kind) return;

    const pos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const uid = `${type}-dropped-${nodeCounter++}`;

    if (type === "tank") {
      setNodes((nds) => [...nds, {
        id: uid, type: "tank", position: pos,
        data: { kind: kind as TankKind, tag: `${kind.toUpperCase().slice(0, 2)}-${String(nodeCounter).padStart(2, "0")}`, nameTh: TANK_KIND_LABEL[kind as TankKind]?.th ?? "", level: 70 } as TankData,
      }]);
    } else {
      setNodes((nds) => [...nds, {
        id: uid, type: "equipment", position: pos,
        data: { kind: kind as EquipmentKind, tag: `${kind.toUpperCase().slice(0, 1)}-${String(nodeCounter).padStart(3, "0")}`, nameTh: EQ_LABEL[kind as EquipmentKind] ?? "", status: "running" as EquipmentStatus } as EqData,
      }]);
    }
  }, [screenToFlowPosition, setNodes]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const onNodeClick  = useCallback((_: React.MouseEvent, node: Node) => setSelectedNodeId(node.id), []);
  const onPaneClick  = useCallback(() => setSelectedNodeId(null), []);

  const handleUpdate = useCallback((id: string, patch: Record<string, unknown>) => {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  }, [setNodes]);

  const handleDelete = useCallback((id: string) => {
    setNodes((nds) => {
      const childIds = nds.filter((n) => n.parentId === id).map((n) => n.id);
      return nds.filter((n) => n.id !== id && !childIds.includes(n.id));
    });
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  }, [setNodes, setEdges]);

  const handleSave        = () => { saveDiagram(building.id, nodes, edges); onSaved(); };
  const handleAutoLayout  = () => { const d = autoLayout(building); setNodes(d.nodes); setEdges(d.edges); setSelectedNodeId(null); };
  const handleClear       = () => { setNodes([]); setEdges([]); setSelectedNodeId(null); };

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
        {/* Legend */}
        <div className="mt-auto border-t border-slate-700 p-2">
          <div className="text-[8px] font-mono text-slate-600 uppercase tracking-wider mb-1.5">คำอธิบาย</div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-4 rounded border-2 border-dashed border-slate-500 bg-slate-500/10" />
            <span className="text-[8px] font-mono text-slate-500">กลุ่มถัง</span>
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4 h-1 bg-cyan-400 rounded opacity-70" />
            <span className="text-[8px] font-mono text-slate-500">ท่อน้ำ</span>
          </div>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="flex-1 relative scada-canvas-wrap" ref={reactFlowWrapper}>
        <style>{`
          @keyframes scadaFlowPipe {
            from { stroke-dashoffset: 0; }
            to   { stroke-dashoffset: -44; }
          }

          /* Light mode (default) — soft white canvas with faint grid */
          .scada-canvas-wrap .react-flow,
          .scada-canvas-wrap .react-flow__background        { background: #fafbfc !important; }
          .scada-canvas-wrap .react-flow__controls button   { background: #ffffff !important; border-color: #e2e8f0 !important; color: #475569 !important; }
          .scada-canvas-wrap .react-flow__controls button:hover { background: #f1f5f9 !important; }
          .scada-canvas-wrap .react-flow__minimap           { background: #ffffff !important; border: 1px solid #e2e8f0 !important; }
          .scada-canvas-wrap .react-flow__node-group        { z-index: 0 !important; }

          /* Dark mode — original SCADA navy */
          .dark .scada-canvas-wrap .react-flow,
          .dark .scada-canvas-wrap .react-flow__background      { background: #020817 !important; }
          .dark .scada-canvas-wrap .react-flow__controls button { background: #1e293b !important; border-color: #334155 !important; color: #94a3b8 !important; }
          .dark .scada-canvas-wrap .react-flow__controls button:hover { background: #334155 !important; }
          .dark .scada-canvas-wrap .react-flow__minimap         { background: #0f172a !important; border: 1px solid #334155 !important; }
        `}</style>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          fitView
          fitViewOptions={{ padding: 0.25 }}
          deleteKeyCode="Delete"
          multiSelectionKeyCode="Shift"
        >
          <Background
            color={isDarkMode ? "#1e293b" : "#cbd5e1"}
            bgColor={isDarkMode ? "#020817" : "#fafbfc"}
            gap={24}
            size={1}
          />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === "tank")      return TANK_COLORS[(n.data as TankData).kind]?.stroke ?? "#94a3b8";
              if (n.type === "equipment") return EQ_COLORS[(n.data as EqData).kind] ?? "#94a3b8";
              return "#94a3b8";
            }}
            maskColor={isDarkMode ? "rgba(2,8,23,0.72)" : "rgba(241,245,249,0.72)"}
          />

          <Panel position="top-right">
            <div className="flex items-center gap-2">
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
          </Panel>

          <Panel position="top-left">
            <div className="text-[9px] font-mono rounded px-2 py-1 leading-relaxed text-slate-600 bg-white/85 border border-slate-300 dark:text-slate-500 dark:bg-slate-900/80 dark:border-slate-700">
              ลากจาก palette · ลาก handle เพื่อวางท่อ · ลากกรอบเพื่อย้ายกลุ่ม · Del ลบ
            </div>
          </Panel>
        </ReactFlow>
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
  return (
    <ReactFlowProvider>
      <ScadaEditorInner building={building} onSaved={onSaved ?? (() => {})} />
    </ReactFlowProvider>
  );
}
