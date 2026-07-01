import React, { useState, useMemo, useEffect } from "react";
import {
  buildingsStore,
  useBuildingConfigs,
  type BuildingConfig,
  type BuildingTankConfig,
  type BuildingEquipmentConfig,
  type BuildingStatus,
  type TankKind,
  type EquipmentKind,
  type EquipmentStatus,
} from "@/lib/buildings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUp,
  ArrowDown,
  Edit,
  Trash2,
  Plus,
  Building2,
  Sun,
  Moon,
  Workflow,
} from "lucide-react";
import { ScadaDiagramEditor } from "@/components/scada/ScadaDiagramEditor";
import { cn } from "@/lib/utils";

// ─── SCADA Diagram Editor — standalone tool ───────────────────────────────────
//
// Extracted from the main WWTP dashboard's Settings page: this app only cares
// about defining buildings, their tanks/equipment, and the process flow
// diagram that visualizes them. No auth/roles — every action is always
// editable since this is a single-purpose configuration tool.

const TANK_KINDS: { value: TankKind; label: string }[] = [
  { value: "equalization", label: "Equalization · ปรับสภาพ" },
  { value: "anoxic", label: "Anoxic · ไร้อากาศ" },
  { value: "aeration", label: "Aeration · เติมอากาศ" },
  { value: "clarifier", label: "Clarifier · ตกตะกอน" },
  { value: "chlorine_contact", label: "Chlorine Contact · สัมผัสคลอรีน" },
  { value: "sludge_holding", label: "Sludge Holding · เก็บสลัดจ์" },
  { value: "custom", label: "Custom · กำหนดเอง" },
];

const EQUIPMENT_KINDS: { value: EquipmentKind; label: string }[] = [
  { value: "pump", label: "Pump · ปั๊ม" },
  { value: "blower", label: "Blower · เครื่องเป่าอากาศ" },
  { value: "aerator", label: "Aerator · เครื่องตีน้ำ" },
  { value: "screen", label: "Screen · บาร์สกรีน" },
  { value: "dosing", label: "Dosing · ปั๊มจ่ายสารเคมี" },
  { value: "valve", label: "Valve · วาล์ว" },
  { value: "sensor", label: "Sensor · เซ็นเซอร์" },
  { value: "oled", label: "OLED Screen · จอ OLED" },
  { value: "flow_meter", label: "Flow Meter · มิเตอร์ลม" },
  { value: "switch", label: "Switch · สวิตช์" },
  { value: "other", label: "Other · อื่นๆ" },
];

const EQ_STATUSES: { value: EquipmentStatus; label: string }[] = [
  { value: "running", label: "Running · เดินเครื่อง" },
  { value: "stopped", label: "Stopped · หยุด" },
  { value: "fault", label: "Fault · ขัดข้อง" },
];

const BUILDING_STATUSES: { value: BuildingStatus; label: string; cls: string }[] = [
  { value: "normal", label: "ปกติ · NORMAL", cls: "text-green-500" },
  { value: "warning", label: "เฝ้าระวัง · WARNING", cls: "text-amber-400" },
  { value: "critical", label: "วิกฤต · CRITICAL", cls: "text-destructive" },
  { value: "offline", label: "ออฟไลน์ · OFFLINE", cls: "text-muted-foreground" },
];

const canEdit = true;

function DarkModeToggle() {
  const [isLight, setIsLight] = useState(
    () => typeof document !== "undefined" && !document.documentElement.classList.contains("dark"),
  );

  const toggle = () => {
    setIsLight((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.remove("dark");
        try { localStorage.setItem("scada.theme", "light"); } catch { /* noop */ }
      } else {
        document.documentElement.classList.add("dark");
        try { localStorage.setItem("scada.theme", "dark"); } catch { /* noop */ }
      }
      return next;
    });
  };

  return (
    <Button variant="outline" size="icon" onClick={toggle} title="สลับโหมดสี">
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </Button>
  );
}

export default function App() {
  const buildings = useBuildingConfigs();
  const { toast } = useToast();

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(
    buildings[0]?.id ?? "",
  );

  useEffect(() => {
    if (!buildings.find((b) => b.id === selectedBuildingId)) {
      setSelectedBuildingId(buildings[0]?.id ?? "");
    }
  }, [buildings, selectedBuildingId]);

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === selectedBuildingId),
    [buildings, selectedBuildingId],
  );

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1300px] mx-auto p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 border border-primary/30">
            <Workflow className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">SCADA Diagram Editor</h1>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
              ตั้งค่าตึก / ถัง / เครื่องจักร / แผนผังกระบวนการ
            </p>
          </div>
        </div>
        <DarkModeToggle />
      </div>

      <Tabs defaultValue="buildings" className="w-full">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="buildings" data-testid="tab-buildings">
              ตึก / Buildings
            </TabsTrigger>
            <TabsTrigger value="tanks" data-testid="tab-tanks">
              ถังบำบัด / Tanks
            </TabsTrigger>
            <TabsTrigger value="equipment" data-testid="tab-equipment">
              เครื่องจักร / Equipment
            </TabsTrigger>
            <TabsTrigger value="diagram" data-testid="tab-diagram" className="gap-1.5">
              <Workflow className="w-3.5 h-3.5" />
              กระบวนการ / Diagram
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            className="text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => setResetConfirmOpen(true)}
            data-testid="button-reset"
          >
            คืนค่าเริ่มต้นทั้งหมด / Reset
          </Button>
        </div>

        <TabsContent value="buildings">
          <BuildingsTab buildings={buildings} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="tanks">
          <BuildingScopedTab
            buildings={buildings}
            selectedId={selectedBuildingId}
            onSelect={setSelectedBuildingId}
          >
            {selectedBuilding ? (
              <TanksTab building={selectedBuilding} canEdit={canEdit} />
            ) : (
              <EmptyState />
            )}
          </BuildingScopedTab>
        </TabsContent>

        <TabsContent value="equipment">
          <BuildingScopedTab
            buildings={buildings}
            selectedId={selectedBuildingId}
            onSelect={setSelectedBuildingId}
          >
            {selectedBuilding ? (
              <EquipmentTab building={selectedBuilding} canEdit={canEdit} />
            ) : (
              <EmptyState />
            )}
          </BuildingScopedTab>
        </TabsContent>

        <TabsContent value="diagram">
          <BuildingScopedTab
            buildings={buildings}
            selectedId={selectedBuildingId}
            onSelect={setSelectedBuildingId}
          >
            {selectedBuilding ? (
              <DiagramTab building={selectedBuilding} />
            ) : (
              <EmptyState />
            )}
          </BuildingScopedTab>
        </TabsContent>
      </Tabs>

      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการคืนค่า / Confirm Reset</AlertDialogTitle>
            <AlertDialogDescription>
              ระบบจะคืนค่าตึก ถังบำบัด และเครื่องจักรทั้งหมดกลับเป็นค่าเริ่มต้น 4 ตึกของศิริราช
              ข้อมูลที่คุณแก้ไขทั้งหมดจะหายไป
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก / Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                buildingsStore.resetToDefaults();
                toast({ title: "คืนค่าเริ่มต้นแล้ว" });
                setResetConfirmOpen(false);
              }}
            >
              ยืนยัน / Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster />
    </div>
  );
}

// ===== BUILDINGS TAB =====

interface BuildingsTabProps {
  buildings: BuildingConfig[];
  canEdit: boolean;
}

function BuildingsTab({ buildings, canEdit }: BuildingsTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BuildingConfig | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const open = (b?: BuildingConfig) => {
    setEditing(b ?? null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => open()} disabled={!canEdit} data-testid="button-add-building">
          <Plus className="w-4 h-4 mr-2" />
          เพิ่มตึกใหม่ / Add Building
        </Button>
      </div>

      <div className="grid gap-3">
        {buildings.map((b, i) => {
          const status = BUILDING_STATUSES.find((s) => s.value === b.status)!;
          return (
            <Card key={b.id} className="bg-card" data-testid={`building-row-${b.code}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="flex flex-col items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={!canEdit || i === 0}
                        onClick={() => buildingsStore.moveBuilding(b.id, -1)}
                      >
                        <ArrowUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={!canEdit || i === buildings.length - 1}
                        onClick={() => buildingsStore.moveBuilding(b.id, 1)}
                      >
                        <ArrowDown className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="bg-primary/15 border border-primary/30 p-2.5 rounded-md">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-lg text-foreground">
                          {b.nameTh}
                        </span>
                        <Badge variant="outline" className="font-mono text-primary">
                          {b.code}
                        </Badge>
                        <span className={cn("text-xs font-mono font-bold", status.cls)}>
                          ● {status.label}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-mono">
                        {b.nameEn}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-6 items-center text-xs font-mono text-muted-foreground flex-wrap">
                    <Stat label="CAPACITY" value={`${b.capacityM3PerDay} m³/d`} />
                    <Stat label="INFLOW" value={`${b.baseInflow} m³/h`} />
                    <Stat label="TANKS" value={String(b.tanks.length)} />
                    <Stat label="EQUIP" value={String(b.equipment.length)} />
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="icon"
                        disabled={!canEdit}
                        onClick={() => open(b)}
                        data-testid={`button-edit-building-${b.code}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        disabled={!canEdit || buildings.length <= 1}
                        onClick={() => setDeleteId(b.id)}
                        data-testid={`button-delete-building-${b.code}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {buildings.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            ยังไม่มีตึกในระบบ — กดปุ่ม "เพิ่มตึกใหม่" เพื่อเริ่มต้น
          </div>
        )}
      </div>

      <BuildingDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => setDialogOpen(false)}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบตึก</AlertDialogTitle>
            <AlertDialogDescription>
              เมื่อลบตึกจะลบถังบำบัดและเครื่องจักรทั้งหมดของตึกนี้ด้วย ไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  buildingsStore.removeBuilding(deleteId);
                  toast({ title: "ลบตึกเรียบร้อย" });
                  setDeleteId(null);
                }
              }}
            >
              ลบ / Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] uppercase">{label}</span>
      <span className="text-foreground font-bold">{value}</span>
    </div>
  );
}

// ===== BUILDING DIALOG =====

interface BuildingDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: BuildingConfig | null;
  onSaved: () => void;
}

function BuildingDialog({ open, onOpenChange, editing, onSaved }: BuildingDialogProps) {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [capacity, setCapacity] = useState(1000);
  const [status, setStatus] = useState<BuildingStatus>("normal");
  const [uptime, setUptime] = useState("0d 00h");
  const [baseInflow, setBaseInflow] = useState(40);
  const [basePH, setBasePH] = useState(7.0);
  const [baseDO, setBaseDO] = useState(3.0);
  const [baseTurb, setBaseTurb] = useState(2.5);
  const [baseCl2, setBaseCl2] = useState(0.8);
  const [baseCompliance, setBaseCompliance] = useState(99.0);
  const [initialFlow, setInitialFlow] = useState(0);

  useEffect(() => {
    if (open) {
      if (editing) {
        setCode(editing.code);
        setNameTh(editing.nameTh);
        setNameEn(editing.nameEn);
        setCapacity(editing.capacityM3PerDay);
        setStatus(editing.status);
        setUptime(editing.uptime);
        setBaseInflow(editing.baseInflow);
        setBasePH(editing.basePH);
        setBaseDO(editing.baseDO);
        setBaseTurb(editing.baseTurbidity);
        setBaseCl2(editing.baseCl2);
        setBaseCompliance(editing.baseCompliance);
        setInitialFlow(editing.initialFlowToday);
      } else {
        setCode("");
        setNameTh("");
        setNameEn("");
        setCapacity(1000);
        setStatus("normal");
        setUptime("0d 00h");
        setBaseInflow(40);
        setBasePH(7.0);
        setBaseDO(3.0);
        setBaseTurb(2.5);
        setBaseCl2(0.8);
        setBaseCompliance(99.0);
        setInitialFlow(0);
      }
    }
  }, [open, editing]);

  const save = () => {
    if (!code || !nameTh || !nameEn) {
      toast({
        title: "ข้อผิดพลาด",
        description: "กรุณากรอก รหัส, ชื่อไทย, ชื่ออังกฤษ ให้ครบ",
        variant: "destructive",
      });
      return;
    }
    const data = {
      code,
      nameTh,
      nameEn,
      capacityM3PerDay: Number(capacity),
      status,
      uptime,
      baseInflow: Number(baseInflow),
      basePH: Number(basePH),
      baseDO: Number(baseDO),
      baseTurbidity: Number(baseTurb),
      baseCl2: Number(baseCl2),
      baseCompliance: Number(baseCompliance),
      initialFlowToday: Number(initialFlow),
    };
    if (editing) {
      buildingsStore.updateBuilding(editing.id, data);
      toast({ title: `แก้ไขตึก ${nameTh} เรียบร้อย` });
    } else {
      buildingsStore.addBuilding(data);
      toast({ title: `เพิ่มตึก ${nameTh} เรียบร้อย` });
    }
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "แก้ไขตึก / Edit Building" : "เพิ่มตึกใหม่ / Add Building"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
              ข้อมูลพื้นฐาน · Basic
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>รหัส / Code</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SI"
                  maxLength={6}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>กำลังการบำบัด (m³/วัน)</Label>
                <Input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>ชื่อ (ไทย)</Label>
                <Input
                  value={nameTh}
                  onChange={(e) => setNameTh(e.target.value)}
                  placeholder="เช่น ตึกสยามินทร์"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Name (English)</Label>
                <Input
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Siamindra Building"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>สถานะ / Status</Label>
                <Select
                  value={status}
                  onValueChange={(v: BuildingStatus) => setStatus(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BUILDING_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Uptime</Label>
                <Input
                  value={uptime}
                  onChange={(e) => setUptime(e.target.value)}
                  placeholder="e.g. 45d 12h"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
              ค่าฐาน KPI · Baseline KPIs
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label>อัตราน้ำเข้า (m³/h)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={baseInflow}
                  onChange={(e) => setBaseInflow(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>น้ำสะสมวันนี้ (m³)</Label>
                <Input
                  type="number"
                  value={initialFlow}
                  onChange={(e) => setInitialFlow(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>ผ่านเกณฑ์ (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={baseCompliance}
                  onChange={(e) => setBaseCompliance(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>pH</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={basePH}
                  onChange={(e) => setBasePH(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>DO (mg/L)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={baseDO}
                  onChange={(e) => setBaseDO(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>ความขุ่น (NTU)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={baseTurb}
                  onChange={(e) => setBaseTurb(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>คลอรีนคงเหลือ (mg/L)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={baseCl2}
                  onChange={(e) => setBaseCl2(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          <Button onClick={save} data-testid="button-save-building">
            บันทึก / Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== BUILDING SELECTOR WRAPPER =====

interface BuildingScopedTabProps {
  buildings: BuildingConfig[];
  selectedId: string;
  onSelect: (id: string) => void;
  children: React.ReactNode;
}

function BuildingScopedTab({
  buildings,
  selectedId,
  onSelect,
  children,
}: BuildingScopedTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 bg-muted/30 border border-border rounded-md p-3">
        <Building2 className="h-5 w-5 text-primary shrink-0" />
        <Label className="shrink-0">เลือกตึก / Select Building:</Label>
        <Select value={selectedId} onValueChange={onSelect}>
          <SelectTrigger className="max-w-md" data-testid="select-building">
            <SelectValue placeholder="-- เลือกตึก --" />
          </SelectTrigger>
          <SelectContent>
            {buildings.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.nameTh} ({b.code}) — {b.tanks.length} ถัง · {b.equipment.length} อุปกรณ์
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-lg">
      กรุณาเลือกตึกก่อน
    </div>
  );
}

// ===== TANKS TAB =====

interface TanksTabProps {
  building: BuildingConfig;
  canEdit: boolean;
}

function TanksTab({ building, canEdit }: TanksTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BuildingTankConfig | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [tag, setTag] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [kind, setKind] = useState<TankKind>("custom");
  const [cap, setCap] = useState(100);
  const [baseLvl, setBaseLvl] = useState(70);

  const open = (t?: BuildingTankConfig) => {
    if (t) {
      setEditing(t);
      setTag(t.tag);
      setNameTh(t.nameTh);
      setKind(t.kind);
      setCap(t.capacityM3);
      setBaseLvl(t.baseLevelPercent);
    } else {
      setEditing(null);
      setTag("");
      setNameTh("");
      setKind("custom");
      setCap(100);
      setBaseLvl(70);
    }
    setDialogOpen(true);
  };

  const save = () => {
    if (!tag || !nameTh) {
      toast({
        title: "ข้อผิดพลาด",
        description: "กรุณากรอก Tag และชื่อไทย",
        variant: "destructive",
      });
      return;
    }
    const data = {
      tag,
      nameTh,
      kind,
      capacityM3: Number(cap),
      baseLevelPercent: Number(baseLvl),
    };
    if (editing) {
      buildingsStore.updateTank(building.id, editing.id, data);
      toast({ title: `แก้ไขถัง ${tag} เรียบร้อย` });
    } else {
      buildingsStore.addTank(building.id, data);
      toast({ title: `เพิ่มถัง ${tag} ในตึก ${building.nameTh}` });
    }
    setDialogOpen(false);
  };

  const sortedTanks = [...building.tanks].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          กำลังจัดการถังของ <strong className="text-foreground">{building.nameTh}</strong> —{" "}
          {sortedTanks.length} ถัง
        </div>
        <Button onClick={() => open()} disabled={!canEdit} data-testid="button-add-tank">
          <Plus className="w-4 h-4 mr-2" /> เพิ่มถังใหม่
        </Button>
      </div>

      <div className="grid gap-3">
        {sortedTanks.map((t, i) => (
          <Card key={t.id} className="bg-card">
            <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={!canEdit || i === 0}
                    onClick={() => buildingsStore.moveTank(building.id, t.id, -1)}
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    disabled={!canEdit || i === sortedTanks.length - 1}
                    onClick={() => buildingsStore.moveTank(building.id, t.id, 1)}
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                </div>
                <div>
                  <div className="font-mono text-primary font-bold text-lg">{t.tag}</div>
                  <div className="text-sm font-semibold">{t.nameTh}</div>
                </div>
              </div>
              <div className="flex gap-6 items-center text-xs font-mono text-muted-foreground flex-wrap">
                <Stat label="CAPACITY" value={`${t.capacityM3} m³`} />
                <Stat label="BASE LVL" value={`${t.baseLevelPercent}%`} />
                <Badge variant="outline">{t.kind}</Badge>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={!canEdit}
                    onClick={() => open(t)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    disabled={!canEdit}
                    onClick={() => setDeleteId(t.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {sortedTanks.length === 0 && (
          <div className="text-center text-muted-foreground py-8 border border-dashed border-border rounded-lg">
            ยังไม่มีถังในตึกนี้
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "แก้ไขถัง" : "เพิ่มถังใหม่"} — {building.nameTh}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Tag</Label>
                <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="EQ-01" />
              </div>
              <div className="grid gap-1.5">
                <Label>ชื่อ (ไทย)</Label>
                <Input
                  value={nameTh}
                  onChange={(e) => setNameTh(e.target.value)}
                  placeholder="ปรับสภาพ"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>ชนิด / Kind</Label>
              <Select value={kind} onValueChange={(v: TankKind) => setKind(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TANK_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>ความจุ (m³)</Label>
                <Input
                  type="number"
                  value={cap}
                  onChange={(e) => setCap(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>ระดับฐาน (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={baseLvl}
                  onChange={(e) => setBaseLvl(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={save}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบถัง</AlertDialogTitle>
            <AlertDialogDescription>
              อุปกรณ์ที่ผูกกับถังนี้จะถูกถอดการเชื่อมโยง
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  buildingsStore.removeTank(building.id, deleteId);
                  toast({ title: "ลบถังเรียบร้อย" });
                  setDeleteId(null);
                }
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===== EQUIPMENT TAB =====

interface EquipmentTabProps {
  building: BuildingConfig;
  canEdit: boolean;
}

function EquipmentTab({ building, canEdit }: EquipmentTabProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BuildingEquipmentConfig | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [tag, setTag] = useState("");
  const [nameTh, setNameTh] = useState("");
  const [kind, setKind] = useState<EquipmentKind>("other");
  const [status, setStatus] = useState<EquipmentStatus>("stopped");
  const [tankId, setTankId] = useState<string>("none");

  const open = (eq?: BuildingEquipmentConfig) => {
    if (eq) {
      setEditing(eq);
      setTag(eq.tag);
      setNameTh(eq.nameTh);
      setKind(eq.kind);
      setStatus(eq.status);
      setTankId(eq.attachedTankId ?? "none");
    } else {
      setEditing(null);
      setTag("");
      setNameTh("");
      setKind("other");
      setStatus("stopped");
      setTankId("none");
    }
    setDialogOpen(true);
  };

  const save = () => {
    if (!tag || !nameTh) {
      toast({
        title: "ข้อผิดพลาด",
        description: "กรุณากรอก Tag และชื่อไทย",
        variant: "destructive",
      });
      return;
    }
    const data = {
      tag,
      nameTh,
      kind,
      status,
      attachedTankId: tankId === "none" ? undefined : tankId,
    };
    if (editing) {
      buildingsStore.updateEquipment(building.id, editing.id, data);
      toast({ title: `แก้ไข ${tag} เรียบร้อย` });
    } else {
      buildingsStore.addEquipment(building.id, data);
      toast({ title: `เพิ่ม ${tag} ในตึก ${building.nameTh}` });
    }
    setDialogOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          กำลังจัดการเครื่องจักรของ{" "}
          <strong className="text-foreground">{building.nameTh}</strong> —{" "}
          {building.equipment.length} เครื่อง (
          {building.equipment.filter((e) => e.status === "running").length} เดินอยู่)
        </div>
        <Button onClick={() => open()} disabled={!canEdit} data-testid="button-add-equipment">
          <Plus className="w-4 h-4 mr-2" /> เพิ่มเครื่องจักร
        </Button>
      </div>

      <div className="grid gap-3">
        {building.equipment.map((eq) => {
          const tank = eq.attachedTankId
            ? building.tanks.find((t) => t.id === eq.attachedTankId)
            : undefined;
          return (
            <Card key={eq.id} className="bg-card">
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-primary font-bold text-lg">
                        {eq.tag}
                      </span>
                      <Select
                        value={eq.status}
                        disabled={!canEdit}
                        onValueChange={(v: EquipmentStatus) =>
                          buildingsStore.updateEquipment(building.id, eq.id, { status: v })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EQ_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="text-sm font-semibold">{eq.nameTh}</div>
                  </div>
                </div>
                <div className="flex gap-6 items-center text-xs font-mono text-muted-foreground flex-wrap">
                  <Stat label="TANK" value={tank ? tank.tag : "—"} />
                  <Badge variant="outline">{eq.kind}</Badge>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="icon"
                      disabled={!canEdit}
                      onClick={() => open(eq)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      disabled={!canEdit}
                      onClick={() => setDeleteId(eq.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {building.equipment.length === 0 && (
          <div className="text-center text-muted-foreground py-8 border border-dashed border-border rounded-lg">
            ยังไม่มีเครื่องจักรในตึกนี้
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editing ? "แก้ไขเครื่องจักร" : "เพิ่มเครื่องจักรใหม่"} — {building.nameTh}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            <div className="grid gap-1.5">
              <Label>Tag</Label>
              <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="P-101" />
            </div>
            <div className="grid gap-1.5">
              <Label>สถานะ</Label>
              <Select value={status} onValueChange={(v: EquipmentStatus) => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQ_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 col-span-2">
              <Label>ชื่อ (ไทย)</Label>
              <Input
                value={nameTh}
                onChange={(e) => setNameTh(e.target.value)}
                placeholder="เช่น ปั๊มน้ำเข้า 1"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>ชนิด / Kind</Label>
              <Select value={kind} onValueChange={(v: EquipmentKind) => setKind(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>ผูกกับถัง / Attached Tank</Label>
              <Select value={tankId} onValueChange={setTankId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ไม่ผูก —</SelectItem>
                  {building.tanks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.tag} ({t.nameTh})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              ยกเลิก
            </Button>
            <Button onClick={save}>บันทึก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบเครื่องจักร</AlertDialogTitle>
            <AlertDialogDescription>การลบไม่สามารถกู้คืนได้</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  buildingsStore.removeEquipment(building.id, deleteId);
                  toast({ title: "ลบเครื่องจักรเรียบร้อย" });
                  setDeleteId(null);
                }
              }}
            >
              ลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===== DIAGRAM TAB =====

interface DiagramTabProps {
  building: BuildingConfig;
}

function DiagramTab({ building }: DiagramTabProps) {
  const { toast } = useToast();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
        <Workflow className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm">
          <strong className="block text-foreground mb-0.5">
            {building.nameTh} — Process Flow Diagram
          </strong>
          <span className="text-muted-foreground text-xs">
            ลากถังและอุปกรณ์จาก palette ทางซ้ายลงบนฉาก 3D · ลาก/scroll เพื่อหมุน-ซูมกล้อง · คลิกจุดต่อสีฟ้าที่ต้นทางแล้วปลายทางเพื่อวางท่อ · กด "บันทึก" เพื่อบันทึก layout
          </span>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ height: 620 }}>
        <ScadaDiagramEditor
          building={building}
          onSaved={() =>
            toast({
              title: "บันทึก diagram เรียบร้อย",
              description: `Flow diagram ของ ${building.nameTh} ถูกบันทึกแล้ว`,
            })
          }
        />
      </div>
    </div>
  );
}
