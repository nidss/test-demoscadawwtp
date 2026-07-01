import {
  forwardRef, Suspense, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type ElementRef,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Line, useTexture, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getEquipmentIconUrl } from "@/components/scada/ScadaIcons";
import {
  TANK_COLORS, EQ_COLORS, STATUS_COLOR, TANK_KIND_LABEL, EQ_LABEL,
  TANK_HEIGHT, TANK_RADIUS, EQ_HEIGHT, EQ_SIZE,
  ANCHOR_SIDES, anchorLocalPosition, anchorWorldPosition,
  type Scada3DNode, type Scada3DEdge, type TankData, type EqData, type AnchorSide, type AnchorFootprint,
} from "@/components/scada/scadaVisuals";

// ── Public handle: lets the DOM-level palette drag/drop (outside the R3F tree)
// convert a screen point into a ground-plane placement. ─────────────────────

export interface Scada3DSceneHandle {
  screenToGround: (clientX: number, clientY: number) => { x: number; z: number } | null;
}

// Matches the gridHelper below (size 60 / 60 divisions => 1 unit per cell),
// so dropped/dragged nodes land exactly on a grid intersection.
const GRID_CELL_SIZE = 1;
function snapToGrid(v: number): number {
  return Math.round(v / GRID_CELL_SIZE) * GRID_CELL_SIZE;
}

export interface Scada3DSceneProps {
  nodes: Scada3DNode[];
  edges: Scada3DEdge[];
  selectedNodeId: string | null;
  isDarkMode: boolean;
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, z: number) => void;
  onConnect: (sourceId: string, sourceSide: AnchorSide, targetId: string, targetSide: AnchorSide) => void;
}

interface PendingAnchor {
  nodeId: string;
  side: AnchorSide;
}

export const Scada3DScene = forwardRef<Scada3DSceneHandle, Scada3DSceneProps>(function Scada3DScene(
  { nodes, edges, selectedNodeId, isDarkMode, onSelectNode, onMoveNode, onConnect },
  ref,
) {
  const bridgeRef = useRef<{ camera: THREE.Camera; gl: THREE.WebGLRenderer } | null>(null);
  // Imperative handle to the live OrbitControls instance. A drag must disable
  // orbiting in the very same tick as the triggering pointerdown — toggling it
  // only via the reactive `enabled` prop can lose the race against
  // OrbitControls' own native listener on fast pointer sequences.
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pendingSource, setPendingSource] = useState<PendingAnchor | null>(null);
  const [cursorGround, setCursorGround] = useState<{ x: number; z: number } | null>(null);
  // Real footprint (measured from each GLB model's own bounding box) of nodes
  // whose visual body is a swapped-in 3D model, keyed by node id. Anchors for
  // everything else fall back to the generic procedural TANK_RADIUS/EQ_SIZE.
  const [footprints, setFootprints] = useState<Record<string, AnchorFootprint>>({});

  const reportFootprint = useCallback((nodeId: string, fp: AnchorFootprint) => {
    setFootprints((prev) => {
      const existing = prev[nodeId];
      if (existing && existing.halfX === fp.halfX && existing.halfZ === fp.halfZ) return prev;
      return { ...prev, [nodeId]: fp };
    });
  }, []);

  const beginDrag = useCallback((id: string) => {
    if (controlsRef.current) controlsRef.current.enabled = false;
    setDraggingId(id);
  }, []);

  const endDrag = useCallback(() => {
    setDraggingId(null);
    if (controlsRef.current) controlsRef.current.enabled = true;
  }, []);

  // R3F dispatches pointer events from its own reconciler, outside React's
  // normal event flow. Calling the parent's setState synchronously from these
  // handlers trips React's "update while rendering a different component"
  // warning; deferring by a microtask moves it safely past the current commit.
  const selectNode = useCallback((id: string | null) => { queueMicrotask(() => onSelectNode(id)); }, [onSelectNode]);
  const moveNode = useCallback((id: string, x: number, z: number) => { queueMicrotask(() => onMoveNode(id, x, z)); }, [onMoveNode]);
  const connectNodes = useCallback((s: string, sSide: AnchorSide, t: string, tSide: AnchorSide) => {
    queueMicrotask(() => onConnect(s, sSide, t, tSide));
  }, [onConnect]);

  useImperativeHandle(ref, () => ({
    screenToGround: (clientX, clientY) => {
      const bridge = bridgeRef.current;
      if (!bridge) return null;
      const rect = bridge.gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(ndc, bridge.camera);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const point = new THREE.Vector3();
      return raycaster.ray.intersectPlane(groundPlane, point)
        ? { x: snapToGrid(point.x), z: snapToGrid(point.z) }
        : null;
    },
  }), []);

  // Safety-net: end a drag even if the pointer leaves the ground plane before
  // releasing, and let Escape back out of an armed pipe connection.
  useEffect(() => {
    const onPointerUp = () => endDrag();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setPendingSource(null); };
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const handleAnchorClick = useCallback((nodeId: string, side: AnchorSide) => {
    setPendingSource((prev) => {
      if (!prev || prev.nodeId === nodeId) return { nodeId, side };
      connectNodes(prev.nodeId, prev.side, nodeId, side);
      return null;
    });
  }, [connectNodes]);

  const bg = isDarkMode ? "#020817" : "#fafbfc";
  const gridColor = isDarkMode ? "#1e293b" : "#cbd5e1";

  return (
    <Canvas
      orthographic
      // True isometric: camera offset equally on all three axes (1,1,1) gives
      // the classic ~35.264° elevation / 45° azimuth with no perspective skew.
      camera={{ position: [10, 10.5, 11], zoom: 60, near: 0.1, far: 200 }}
      onCreated={({ camera, gl }) => { bridgeRef.current = { camera, gl }; }}
      onPointerMissed={() => selectNode(null)}
    >
      <color attach="background" args={[bg]} />
      <ambientLight intensity={isDarkMode ? 0.45 : 0.75} />
      <directionalLight position={[6, 10, 4]} intensity={isDarkMode ? 0.7 : 0.9} />
      <hemisphereLight args={[isDarkMode ? "#0ea5e9" : "#ffffff", "#0f172a", 0.25]} />

      <gridHelper args={[60, 60, gridColor, gridColor]} position={[0, 0.001, 0]} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={(e) => {
          if (draggingId) moveNode(draggingId, snapToGrid(e.point.x), snapToGrid(e.point.z));
          if (pendingSource) setCursorGround({ x: e.point.x, z: e.point.z });
        }}
        onPointerUp={() => endDrag()}
        onClick={(e) => {
          e.stopPropagation();
          if (pendingSource) { setPendingSource(null); return; }
          selectNode(null);
        }}
      >
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={bg} />
      </mesh>

      {nodes.map((node) => (
        <NodeMesh
          key={node.id}
          node={node}
          selected={node.id === selectedNodeId}
          pendingSide={pendingSource?.nodeId === node.id ? pendingSource.side : null}
          footprint={footprints[node.id]}
          onSelect={() => selectNode(node.id)}
          onDragStart={() => beginDrag(node.id)}
          onAnchorClick={(side) => handleAnchorClick(node.id, side)}
          onFootprint={(fp) => reportFootprint(node.id, fp)}
        />
      ))}

      {edges.map((edge) => {
        const s = nodeById.get(edge.source);
        const t = nodeById.get(edge.target);
        if (!s || !t) return null;
        return (
          <PipeTube
            key={edge.id}
            source={s}
            target={t}
            sourceSide={edge.sourceSide ?? "east"}
            targetSide={edge.targetSide ?? "west"}
            sourceFootprint={footprints[edge.source]}
            targetFootprint={footprints[edge.target]}
            active={edge.active}
          />
        );
      })}

      {pendingSource && cursorGround && nodeById.get(pendingSource.nodeId) && (
        <PendingPipePreview
          source={nodeById.get(pendingSource.nodeId)!}
          side={pendingSource.side}
          footprint={footprints[pendingSource.nodeId]}
          cursor={cursorGround}
        />
      )}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enabled={!draggingId}
        enableDamping
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.05}
        minZoom={20}
        maxZoom={200}
        target={[0, 0.5, 1]}
      />
    </Canvas>
  );
});

// ── Node mesh (tank or equipment) + shared connector anchor ──────────────────

function NodeMesh({ node, selected, pendingSide, footprint, onSelect, onDragStart, onAnchorClick, onFootprint }: {
  node: Scada3DNode;
  selected: boolean;
  pendingSide: AnchorSide | null;
  footprint?: AnchorFootprint;
  onSelect: () => void;
  onDragStart: () => void;
  onAnchorClick: (side: AnchorSide) => void;
  onFootprint: (fp: AnchorFootprint) => void;
}) {
  return (
    <group position={[node.position.x, 0, node.position.z]}>
      {node.type === "tank" ? (
        <TankMesh data={node.data as TankData} selected={selected} onSelect={onSelect} onDragStart={onDragStart} onFootprint={onFootprint} />
      ) : (
        <EquipmentMesh data={node.data as EqData} selected={selected} onSelect={onSelect} onDragStart={onDragStart} onFootprint={onFootprint} />
      )}
      {ANCHOR_SIDES.map((side) => {
        const local = anchorLocalPosition(node.type, side, footprint);
        const isPending = pendingSide === side;
        return (
          <mesh
            key={side}
            position={[local.x, local.y, local.z]}
            onClick={(e) => { e.stopPropagation(); onAnchorClick(side); }}
          >
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshStandardMaterial
              color={isPending ? "#f0abfc" : "#22d3ee"}
              emissive={isPending ? "#f0abfc" : "#22d3ee"}
              emissiveIntensity={isPending ? 1.2 : 0.6}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ── Tank: translucent cylinder shell + rising water fill ─────────────────────

function TankMesh({ data, selected, onSelect, onDragStart, onFootprint }: {
  data: TankData; selected: boolean; onSelect: () => void; onDragStart: () => void;
  onFootprint: (fp: AnchorFootprint) => void;
}) {
  const colors = TANK_COLORS[data.kind] ?? TANK_COLORS.custom;
  const levelRef = useRef(data.level ?? 60);
  const waterRef = useRef<THREE.Mesh>(null);
  const rimRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    levelRef.current += ((data.level ?? 60) - levelRef.current) * Math.min(1, delta * 3);
    const f = Math.max(0, Math.min(100, levelRef.current)) / 100;
    if (waterRef.current) {
      waterRef.current.scale.y = Math.max(0.001, f);
      waterRef.current.position.y = (TANK_HEIGHT * f) / 2;
    }
    if (rimRef.current) {
      (rimRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = selected ? 1 : 0.5;
    }
  });

  const tankModelUrl = data.kind === "equalization" ? EQUALIZATION_MODEL_URL
    : data.kind === "anoxic" ? ANOXIC_MODEL_URL
    : data.kind === "aeration" ? AERATION_MODEL_URL
    : null;

  return (
    <group
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); onDragStart(); }}
      onClick={(e) => e.stopPropagation()}
    >
      {tankModelUrl ? (
        <Suspense fallback={null}>
          <GltfBodyWithRing
            url={tankModelUrl}
            targetHeight={TANK_HEIGHT * 0.85}
            ringRadius={TANK_RADIUS * 1.5}
            selected={selected}
            onFootprint={onFootprint}
          />
        </Suspense>
      ) : (
        <>
          {/* floor disc */}
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[TANK_RADIUS, TANK_RADIUS, 0.02, 32]} />
            <meshStandardMaterial color={colors.stroke} />
          </mesh>
          {/* water fill */}
          <mesh ref={waterRef} position={[0, TANK_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[TANK_RADIUS * 0.88, TANK_RADIUS * 0.88, TANK_HEIGHT, 24]} />
            <meshStandardMaterial color={colors.stroke} emissive={colors.stroke} emissiveIntensity={0.35} />
          </mesh>
          {/* translucent glass shell */}
          <mesh position={[0, TANK_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[TANK_RADIUS, TANK_RADIUS, TANK_HEIGHT, 32, 1, true]} />
            <meshStandardMaterial
              color={colors.fill}
              transparent
              opacity={0.32}
              side={THREE.DoubleSide}
              emissive={selected ? "#22d3ee" : "#000000"}
              emissiveIntensity={selected ? 0.4 : 0}
            />
          </mesh>
          {/* rim */}
          <mesh ref={rimRef} position={[0, TANK_HEIGHT, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[TANK_RADIUS, 0.03, 8, 32]} />
            <meshStandardMaterial color={colors.stroke} emissive={colors.stroke} emissiveIntensity={0.5} />
          </mesh>
        </>
      )}

      <Html position={[0, TANK_HEIGHT + 0.65, 0]} center zIndexRange={[10, 0]}>
        <div className="flex flex-col items-center gap-0.5 pointer-events-none select-none">
          <span className="text-[11px] font-mono font-bold" style={{ color: colors.stroke }}>{data.tag}</span>
          <span
            className="text-[10px] font-mono font-bold text-white px-1.5 py-0.5 rounded"
            style={{ background: colors.fill, border: `1.5px solid ${colors.stroke}` }}
          >
            {Math.round(data.level ?? 0)}%
          </span>
          <span className="text-[10px] font-mono text-slate-400 max-w-[100px] text-center truncate">
            {data.nameTh || TANK_KIND_LABEL[data.kind]?.th}
          </span>
        </div>
      </Html>
    </group>
  );
}

// ── Real-world GLB models, swapped in for specific kinds instead of the
// procedural shapes. Each model is recentered (bottom -> ground, XZ -> origin)
// and rescaled to roughly the same footprint as its procedural counterpart, so
// anchors/labels/pipes stay consistent regardless of kind. No animated water
// fill for tank models (level % is still shown in the label) since they have
// no separate water mesh to scale. Selection is shown as a ground ring rather
// than tinting the model's own material, since `.clone()` shares materials
// across instances of the same model.

const EQUALIZATION_MODEL_URL = "/models/ket-nuoc-inox02.glb";
const ANOXIC_MODEL_URL = "/models/water-septic-tank.glb";
const PUMP_MODEL_URL = "/models/water-pump-2.glb";
// This one is ~61MB (vs. a few hundred KB - few MB for the others above) — it
// is deliberately NOT in the preload list below, so it only starts
// downloading the first time a building that actually has an aeration tank
// is opened, rather than on every visit to the Diagram tab regardless of kind.
const AERATION_MODEL_URL = "/models/daf-tank.glb";

function useCenteredScaledGltf(url: string, targetHeight: number) {
  const { scene } = useGLTF(url);
  return useMemo(() => {
    const cloned = scene.clone(true);
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    cloned.position.x -= (box.min.x + box.max.x) / 2;
    cloned.position.z -= (box.min.z + box.max.z) / 2;
    cloned.position.y -= box.min.y;
    const scale = targetHeight / (size.y || 1);
    const footprint: AnchorFootprint = { halfX: (size.x * scale) / 2, halfZ: (size.z * scale) / 2 };
    return { object: cloned, scale, footprint };
  }, [scene, targetHeight]);
}

function GltfBodyWithRing({ url, targetHeight, ringRadius, selected, onFootprint }: {
  url: string; targetHeight: number; ringRadius: number; selected: boolean;
  onFootprint: (fp: AnchorFootprint) => void;
}) {
  const { object, scale, footprint } = useCenteredScaledGltf(url, targetHeight);

  useEffect(() => { onFootprint(footprint); }, [footprint, onFootprint]);

  return (
    <>
      <group scale={scale}>
        <primitive object={object} />
      </group>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringRadius * 0.9, ringRadius, 32]} />
        <meshBasicMaterial color={selected ? "#22d3ee" : "#334155"} transparent opacity={selected ? 0.9 : 0.3} />
      </mesh>
    </>
  );
}

useGLTF.preload(EQUALIZATION_MODEL_URL);
useGLTF.preload(ANOXIC_MODEL_URL);
useGLTF.preload(PUMP_MODEL_URL);

// ── Equipment: color-coded housing + icon decal + status beacon ──────────────

function EquipmentMesh({ data, selected, onSelect, onDragStart, onFootprint }: {
  data: EqData; selected: boolean; onSelect: () => void; onDragStart: () => void;
  onFootprint: (fp: AnchorFootprint) => void;
}) {
  const color = EQ_COLORS[data.kind] ?? EQ_COLORS.other;
  const statusColor = STATUS_COLOR[data.status ?? "running"];
  const iconUrl = getEquipmentIconUrl(data.kind);
  const statusRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const mat = statusRef.current?.material as THREE.MeshStandardMaterial | undefined;
    if (!mat) return;
    if (data.status === "fault") {
      mat.emissiveIntensity = Math.max(0.2, 0.6 + Math.sin(clock.elapsedTime * 6) * 0.4);
    } else {
      mat.emissiveIntensity = data.status === "running" ? 0.8 : 0.15;
    }
  });

  const isPump = data.kind === "pump";

  return (
    <group
      onPointerDown={(e) => { e.stopPropagation(); onSelect(); onDragStart(); }}
      onClick={(e) => e.stopPropagation()}
    >
      {isPump ? (
        <Suspense fallback={null}>
          <GltfBodyWithRing
            url={PUMP_MODEL_URL}
            targetHeight={EQ_HEIGHT * 1.1}
            ringRadius={EQ_SIZE * 0.95}
            selected={selected}
            onFootprint={onFootprint}
          />
        </Suspense>
      ) : (
        <>
          <mesh position={[0, EQ_HEIGHT / 2, 0]}>
            <boxGeometry args={[EQ_SIZE, EQ_HEIGHT, EQ_SIZE]} />
            <meshStandardMaterial
              color={color}
              emissive={selected ? "#22d3ee" : color}
              emissiveIntensity={selected ? 0.6 : 0.12}
            />
          </mesh>
          {iconUrl && (
            <Suspense fallback={null}>
              <EquipmentIconDecal url={iconUrl} y={EQ_HEIGHT / 2} z={EQ_SIZE / 2 + 0.012} />
            </Suspense>
          )}
        </>
      )}
      <mesh ref={statusRef} position={[0, EQ_HEIGHT + 0.14, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.8} />
      </mesh>

      <Html position={[0, EQ_HEIGHT + 0.55, 0]} center zIndexRange={[10, 0]}>
        <div className="flex flex-col items-center gap-0.5 pointer-events-none select-none">
          <span className="text-[11px] font-mono font-bold" style={{ color }}>{data.tag}</span>
          <span className="text-[10px] font-mono text-slate-400 max-w-[100px] text-center truncate">
            {data.nameTh || EQ_LABEL[data.kind]}
          </span>
        </div>
      </Html>
    </group>
  );
}

function EquipmentIconDecal({ url, y, z }: { url: string; y: number; z: number }) {
  const texture = useTexture(url);
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[EQ_SIZE * 0.75, EQ_SIZE * 0.75]} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  );
}

// ── Pipe: tube along a bowed curve between two anchors, with flow animation ──

function PipeTube({ source, target, sourceSide, targetSide, sourceFootprint, targetFootprint, active }: {
  source: Scada3DNode; target: Scada3DNode; sourceSide: AnchorSide; targetSide: AnchorSide;
  sourceFootprint?: AnchorFootprint; targetFootprint?: AnchorFootprint; active: boolean;
}) {
  const texture = useMemo(() => createStripeTexture(), []);

  const geometry = useMemo(() => {
    const s = anchorWorldPosition(source, sourceSide, sourceFootprint);
    const t = anchorWorldPosition(target, targetSide, targetFootprint);
    const start = new THREE.Vector3(s.x, s.y, s.z);
    const end = new THREE.Vector3(t.x, t.y, t.z);
    const dist = start.distanceTo(end);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    mid.y += 0.4 + dist * 0.08;
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
    return new THREE.TubeGeometry(curve, 32, 0.045, 8, false);
  }, [
    source.position.x, source.position.z, source.type, sourceSide, sourceFootprint,
    target.position.x, target.position.z, target.type, targetSide, targetFootprint,
  ]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    if (active) texture.offset.x -= delta * 0.6;
  });

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        map={active ? texture : undefined}
        color={active ? "#0e7490" : "#334155"}
        emissive={active ? "#22d3ee" : "#000000"}
        emissiveIntensity={active ? 0.5 : 0}
      />
    </mesh>
  );
}

function createStripeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 8;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#0e7490";
  ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = "#a5f3fc";
  for (let i = 0; i < 64; i += 16) ctx.fillRect(i, 0, 8, 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 1);
  return texture;
}

// ── Temporary preview line while a pipe connection is being armed ────────────

function PendingPipePreview({ source, side, footprint, cursor }: {
  source: Scada3DNode; side: AnchorSide; footprint?: AnchorFootprint; cursor: { x: number; z: number };
}) {
  const points = useMemo(() => {
    const s = anchorWorldPosition(source, side, footprint);
    return [
      new THREE.Vector3(s.x, s.y, s.z),
      new THREE.Vector3(cursor.x, 0.3, cursor.z),
    ];
  }, [source.position.x, source.position.z, source.type, side, footprint, cursor.x, cursor.z]);

  return <Line points={points} color="#f0abfc" dashed dashSize={0.15} gapSize={0.1} lineWidth={2} />;
}
