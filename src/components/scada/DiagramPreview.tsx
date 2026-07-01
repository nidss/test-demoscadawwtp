import { useMemo, useState, useEffect } from "react";
import {
  getSavedDiagram,
  getDefaultDiagram,
  NODE_DIMS,
} from "@/components/scada/ScadaDiagramEditor";
import {
  getTankIconUrl,
  getEquipmentIconUrl,
} from "@/components/scada/ScadaIcons";
import type {
  BuildingConfig,
  BuildingLive,
  TankKind,
  EquipmentKind,
  EquipmentStatus,
} from "@/lib/buildings";

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_HEIGHT = 220;       // default render height in px (compact card)
const PADDING        = 16;        // breathing room around content
const STATUS_COLOR: Record<EquipmentStatus, string> = {
  running: "#22c55e",
  stopped: "#94a3b8",
  fault:   "#ef4444",
};

// Same kind-accent palette as ScadaDiagramEditor — kept inline so the preview
// has zero coupling to editor internals and can be reasoned about on its own.
const TANK_STROKE: Record<TankKind, string> = {
  equalization:     "#22d3ee",
  anoxic:           "#4ade80",
  aeration:         "#67e8f9",
  clarifier:        "#a78bfa",
  chlorine_contact: "#fb923c",
  sludge_holding:   "#fbbf24",
  custom:           "#94a3b8",
};

const EQ_STROKE: Record<EquipmentKind, string> = {
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

// ─── Types from saved diagram nodes (kept loose; data fields vary) ───────────

type SavedNode = {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data?: {
    kind?: TankKind | EquipmentKind;
    tag?: string;
    nameTh?: string;
    level?: number;
    status?: EquipmentStatus;
  };
};

type SavedEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: { active?: boolean };
};

// ─── Component ───────────────────────────────────────────────────────────────

interface DiagramPreviewProps {
  building: BuildingConfig;
  live: BuildingLive;
  /**
   * Render height in px. Defaults to 220 — used in dashboard cards.
   * BuildingDetail page uses a larger value (e.g. 380) since the viewport
   * gives the diagram more horizontal room there.
   */
  height?: number;
}

/**
 * Renders the operator-saved Process Flow Diagram as a read-only mini-view,
 * sized to fit inside a dashboard building card. Tank fill-levels and
 * equipment statuses are pulled from live data so the preview stays in sync
 * with reality rather than the static state captured at save time.
 *
 * Returns `null` if no diagram has been saved — caller should fall back to
 * the simpler TANK LEVELS row.
 */
export function DiagramPreview({ building, live, height = DEFAULT_HEIGHT }: DiagramPreviewProps) {
  // Bump on focus/storage so dashboard updates after the operator saves
  // a new diagram on the Settings page (different route, same localStorage).
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("scada.flow.v2.")) bump();
    };
    window.addEventListener("focus", bump);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("focus", bump);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const diagram = useMemo(
    // Saved diagram wins; otherwise we render a sensible default so every
    // building shows a process diagram even before the operator visits the
    // Settings → Diagram editor.
    () => getSavedDiagram(building.id) ?? getDefaultDiagram(building),
    // version is intentional — re-reads localStorage when bump() fires.
    [building, version],
  );

  // Merge live data into nodes so the preview stays real-time.
  const liveByTag = useMemo(() => {
    const m = new Map<string, { level?: number; status?: EquipmentStatus }>();
    live.tanks.forEach((t) => m.set(t.tag, { level: t.level }));
    building.equipment.forEach((e) => m.set(e.tag, { status: e.status }));
    return m;
  }, [live.tanks, building.equipment]);

  // Compute bounding box of all nodes so we can scale-to-fit.
  // Hook is called unconditionally; we early-return below if diagram is empty.
  const bounds = useMemo(
    () => computeBounds(diagram?.nodes ?? []),
    [diagram],
  );

  // Build a quick lookup of node centres for edge endpoints
  const nodeCenters = useMemo(() => {
    const map = new Map<string, { x: number; y: number; type?: string }>();
    (diagram?.nodes ?? []).forEach((n) => {
      const dims = n.type === "tank" ? NODE_DIMS.tank : NODE_DIMS.equipment;
      map.set(n.id, {
        x: n.position.x + dims.w / 2,
        y: n.position.y + dims.totalH / 2,
        type: n.type,
      });
    });
    return map;
  }, [diagram]);

  if (!diagram || diagram.nodes.length === 0) return null;

  // Width is determined by the parent (responsive), so we render a viewBox
  // sized to the natural content + padding and let CSS scale it.
  const vbW = bounds.w + PADDING * 2;
  const vbH = bounds.h + PADDING * 2;
  const offsetX = -bounds.minX + PADDING;
  const offsetY = -bounds.minY + PADDING;

  return (
    <div
      className="w-full overflow-hidden rounded-md bg-muted/20 border border-border/40"
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        style={{ display: "block" }}
      >
        <defs>
          <style>{`
            @keyframes diagPipe {
              from { stroke-dashoffset: 0; }
              to   { stroke-dashoffset: -28; }
            }
          `}</style>
        </defs>

        {/* ── EDGES (pipes) ── */}
        {diagram.edges.map((e: SavedEdge) => {
          const s = nodeCenters.get(e.source);
          const t = nodeCenters.get(e.target);
          if (!s || !t) return null;
          const sx = s.x + offsetX;
          const sy = s.y + offsetY;
          const tx = t.x + offsetX;
          const ty = t.y + offsetY;
          // Simple horizontal-biased bezier; visually similar to ReactFlow
          // smoothstep without recomputing port positions exactly.
          const dx = Math.abs(tx - sx) * 0.5;
          const path = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`;
          const active = e.data?.active !== false;
          return (
            <g key={e.id}>
              <path
                d={path}
                fill="none"
                stroke={active ? "#22d3ee" : "#475569"}
                strokeWidth={3}
                strokeLinecap="round"
                opacity={0.55}
              />
              {active && (
                <path
                  d={path}
                  fill="none"
                  stroke="#a5f3fc"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeDasharray="6 10"
                  style={{ animation: "diagPipe 1.4s linear infinite" }}
                />
              )}
            </g>
          );
        })}

        {/* ── NODES ── */}
        {diagram.nodes.map((n: SavedNode) => {
          const x = n.position.x + offsetX;
          const y = n.position.y + offsetY;
          const tag = n.data?.tag ?? "";
          const liveInfo = tag ? liveByTag.get(tag) : undefined;

          if (n.type === "tank") {
            const kind = (n.data?.kind ?? "custom") as TankKind;
            const level = Math.round(liveInfo?.level ?? n.data?.level ?? 0);
            const stroke = TANK_STROKE[kind] ?? TANK_STROKE.custom;
            const { w, h } = NODE_DIMS.tank;
            return (
              <g key={n.id} transform={`translate(${x},${y})`}>
                {/* tag label */}
                <text
                  x={w / 2}
                  y={2}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="monospace"
                  fontWeight={700}
                  fill={stroke}
                >
                  {tag}
                </text>
                {/* icon */}
                <image
                  href={getTankIconUrl(kind)}
                  x={0}
                  y={12}
                  width={w}
                  height={h}
                  preserveAspectRatio="xMidYMid meet"
                />
                {/* level pill */}
                <g transform={`translate(${w - 16}, ${h + 4})`}>
                  <rect
                    x={-22}
                    y={0}
                    width={44}
                    height={16}
                    rx={6}
                    fill={stroke}
                    stroke="white"
                    strokeWidth={1.2}
                  />
                  <text
                    x={0}
                    y={12}
                    textAnchor="middle"
                    fontSize={11}
                    fontFamily="monospace"
                    fontWeight={700}
                    fill="white"
                  >
                    {level}%
                  </text>
                </g>
                {/* th name */}
                <text
                  x={w / 2}
                  y={h + 32}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-muted-foreground"
                >
                  {n.data?.nameTh ?? ""}
                </text>
              </g>
            );
          }

          if (n.type === "equipment") {
            const kind = (n.data?.kind ?? "other") as EquipmentKind;
            const status = (liveInfo?.status ?? n.data?.status ?? "running") as EquipmentStatus;
            const stroke = EQ_STROKE[kind] ?? EQ_STROKE.other;
            const iconUrl = getEquipmentIconUrl(kind);
            const { w, h } = NODE_DIMS.equipment;
            return (
              <g key={n.id} transform={`translate(${x},${y})`}>
                {/* tag */}
                <text
                  x={w / 2}
                  y={2}
                  textAnchor="middle"
                  fontSize={11}
                  fontFamily="monospace"
                  fontWeight={700}
                  fill={stroke}
                >
                  {tag}
                </text>
                {/* icon */}
                {iconUrl ? (
                  <image
                    href={iconUrl}
                    x={0}
                    y={12}
                    width={w}
                    height={h}
                    preserveAspectRatio="xMidYMid meet"
                  />
                ) : (
                  <rect
                    x={w / 2 - 18}
                    y={20}
                    width={36}
                    height={36}
                    rx={6}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2}
                  />
                )}
                {/* status dot */}
                <circle
                  cx={w - 8}
                  cy={16}
                  r={5}
                  fill={STATUS_COLOR[status]}
                  stroke="white"
                  strokeWidth={1.5}
                />
                {/* th name */}
                <text
                  x={w / 2}
                  y={h + 26}
                  textAnchor="middle"
                  fontSize={10}
                  className="fill-muted-foreground"
                >
                  {n.data?.nameTh ?? ""}
                </text>
              </g>
            );
          }

          return null;
        })}
      </svg>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeBounds(nodes: SavedNode[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach((n) => {
    const dims = n.type === "tank" ? NODE_DIMS.tank : NODE_DIMS.equipment;
    const x1 = n.position.x;
    const y1 = n.position.y;
    const x2 = x1 + dims.w;
    const y2 = y1 + dims.totalH;
    if (x1 < minX) minX = x1;
    if (y1 < minY) minY = y1;
    if (x2 > maxX) maxX = x2;
    if (y2 > maxY) maxY = y2;
  });
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, w: 100, h: 100 };
  }
  return { minX, minY, w: maxX - minX, h: maxY - minY };
}
