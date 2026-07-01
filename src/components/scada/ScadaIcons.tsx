import type { TankKind, EquipmentKind } from "@/lib/buildings";

// ─── SVG icon path maps ───────────────────────────────────────────────────────
//
// SVGs live in `public/icons/`. Using <img src> (not inline SVG injection)
// keeps animations inside the source files working (e.g. pump impeller spin,
// blower fan, status LEDs) without us having to re-implement them in React.
//
// `import.meta.env.BASE_URL` makes the paths work under any deployment base
// (e.g. GitHub Pages subpath `/Wastewater-Monitor-Dashboard/`).
// ──────────────────────────────────────────────────────────────────────────────

function iconUrl(name: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base.replace(/\/$/, "")}/icons/${name}`;
}

// Tank icons — only anoxic & sludge_holding have dedicated SVGs.
// All other tank kinds fall back to the generic `tank.svg`.
// The tank kind's accent colour is rendered as a small label overlay so
// users can still distinguish between e.g. "ปรับสภาพ" and "ตกตะกอน".
const TANK_ICON_FILE: Record<TankKind, string> = {
  equalization:     "tank.svg",
  anoxic:           "anoxic_tank.svg",
  aeration:         "tank.svg",
  clarifier:        "tank.svg",
  chlorine_contact: "tank.svg",
  sludge_holding:   "sludge_tank.svg",
  custom:           "tank.svg",
};

// Equipment icons — kinds without a dedicated SVG return null so the caller
// can fall back to the existing Lucide icon (aerator, screen, dosing, other).
const EQUIPMENT_ICON_FILE: Partial<Record<EquipmentKind, string>> = {
  pump:       "pump.svg",
  blower:     "blowers.svg",
  valve:      "valve.svg",
  sensor:     "sensor.svg",
  oled:       "oled_screen.svg",
  flow_meter: "flow_meters.svg",
  switch:     "switch.svg",
};

// ─── Public API ───────────────────────────────────────────────────────────────

export function getTankIconUrl(kind: TankKind): string {
  return iconUrl(TANK_ICON_FILE[kind] ?? "tank.svg");
}

export function getEquipmentIconUrl(kind: EquipmentKind): string | null {
  const file = EQUIPMENT_ICON_FILE[kind];
  return file ? iconUrl(file) : null;
}

// ─── React component for rendering an SCADA SVG icon ──────────────────────────

interface ScadaSvgIconProps {
  src: string;
  size?: number;
  alt?: string;
  className?: string;
  /**
   * When true, applies a subtle drop-shadow so the icon "pops" on light/dark
   * backgrounds. The shadow uses currentColor so callers can theme it.
   */
  withShadow?: boolean;
  style?: React.CSSProperties;
}

export function ScadaSvgIcon({
  src,
  size = 24,
  alt = "",
  className,
  withShadow = false,
  style,
}: ScadaSvgIconProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        pointerEvents: "none",
        userSelect: "none",
        ...(withShadow
          ? { filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.35))" }
          : null),
        ...style,
      }}
    />
  );
}
