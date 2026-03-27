import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth, useEmployeeProfile } from "@/lib/auth-context";
import {
  saveAttendance,
  type AttendancePunchType,
} from "@/lib/attendance-records";
import { supabase } from "@/lib/supabaseClient";
import { CameraCapture, type CapturedImage } from "@/components/CameraCapture";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { AttendanceSelfiePreview } from "@/components/AttendanceSelfiePreview";
import { formatDate, formatTime } from "@/lib/datetime-format";
import { calculateAttendance } from "@/lib/time-calculations";
import { getManilaDateKey } from "@/lib/local-time";
import { Camera, Coffee, CoffeeIcon, Loader2, LogOut as LogOutIcon } from "lucide-react";

const actions = [
  { label: "Time In", icon: Camera, type: "time_in" as const },
  { label: "Break Start", icon: Coffee, type: "break_start" as const },
  { label: "Break End", icon: CoffeeIcon, type: "break_end" as const },
  { label: "Time Out", icon: LogOutIcon, type: "time_out" as const },
];

type TodayAttendanceRow = {
  id?: string;
  date?: string | null;
  time_in?: string | null;
  break_start?: string | null;
  break_end?: string | null;
  time_out?: string | null;
  time_in_selfie?: string | null;
  break_start_selfie?: string | null;
  break_end_selfie?: string | null;
  time_out_selfie?: string | null;
};

function isPunchAvailable(type: AttendancePunchType, records: Record<string, string>): boolean {
  if (records[type]) return false;
  switch (type) {
    case "time_in":
      return true;
    case "break_start":
      return !!records.time_in;
    case "break_end":
      return !!records.break_start;
    case "time_out":
      return !!records.time_in;
    default:
      return false;
  }
}

function rowToPunchMap(row: TodayAttendanceRow | null): Record<string, string> {
  if (!row) return {};
  const out: Record<string, string> = {};
  for (const key of ["time_in", "break_start", "break_end", "time_out"] as const) {
    const v = row[key];
    if (v != null && String(v).trim()) {
      out[key] = String(v);
    }
  }
  return out;
}

export default function EmployeeDashboard() {
  const employee = useEmployeeProfile();
  const { logout } = useAuth();
  const [todayRecord, setTodayRecord] = useState<TodayAttendanceRow | null>(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingType, setPendingType] = useState<AttendancePunchType | null>(null);
  const [saving, setSaving] = useState(false);

  const records = useMemo(() => rowToPunchMap(todayRecord), [todayRecord]);

  const fetchTodayRecord = useCallback(async () => {
    if (!employee?.id) {
      setTodayRecord(null);
      setLoadingToday(false);
      return;
    }

    const today = getManilaDateKey();
    setLoadingToday(true);
    try {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employee.id)
        .eq("date", today)
        .limit(1);

      if (error) {
        console.error("fetchTodayRecord:", error);
        setTodayRecord(null);
        return;
      }

      const record = Array.isArray(data) && data.length > 0 ? (data[0] as TodayAttendanceRow) : null;
      setTodayRecord(record);
    } finally {
      setLoadingToday(false);
    }
  }, [employee?.id]);

  useEffect(() => {
    void fetchTodayRecord();
  }, [fetchTodayRecord]);

  const pendingLabel = actions.find(a => a.type === pendingType)?.label ?? "Clock";

  function openPunchFlow(type: AttendancePunchType) {
    if (!employee) return;
    if (!isPunchAvailable(type, records)) return;
    setPendingType(type);
    setCameraOpen(true);
  }

  async function handleCaptured(image: CapturedImage) {
    if (!employee || !pendingType) return;

    setSaving(true);
    try {
      const { data, error } = await saveAttendance(pendingType, employee.id, image.blob);
      if (error) {
        toast.error("Attendance save failed", { description: error.message });
        return;
      }

      const queued =
        !!data && typeof data === "object" && "queued" in data && (data as { queued?: boolean }).queued === true;

      if (queued) {
        toast.success(`${pendingLabel} queued`, { description: "Will auto-sync when you’re back online." });
      } else {
        await fetchTodayRecord();
        toast.success(`${pendingLabel} saved`);
      }
      setCameraOpen(false);
      setPendingType(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      toast.error("Attendance save failed", { description: message });
    } finally {
      setSaving(false);
    }
  }

  if (!employee) {
    return (
      <div className="space-y-4 max-w-md">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">My Dashboard</h1>
        <p className="text-sm text-destructive">
          Your employee profile could not be loaded. Sign out and sign in again so your account is linked to an employee
          record in the database.
        </p>
        <Button variant="outline" onClick={() => logout()}>
          Sign out
        </Button>
      </div>
    );
  }

  const record = todayRecord;
  const calc = calculateAttendance(record);

  return (
    <div className="space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight">My Dashboard</h1>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a, i) => {
          const enabled = isPunchAvailable(a.type, records);
          return (
            <Button
              key={a.type}
              variant={records[a.type] ? "secondary" : "default"}
              className="w-full h-auto py-6 sm:py-5 flex-col gap-2 active:scale-[0.98] transition-transform"
              onClick={() => openPunchFlow(a.type)}
              disabled={!enabled || loadingToday || saving}
              style={{ animation: `fade-up 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms forwards`, opacity: 0 }}
            >
              <a.icon className="h-6 w-6" />
              <span className="text-sm sm:text-xs font-medium">{a.label}</span>
            </Button>
          );
        })}
      </div>

      <Card className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-lg hover:dark:shadow-green-500/10 transition-shadow animate-fade-up">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Today&apos;s Record</h2>
          {loadingToday && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading today&apos;s attendance…
            </p>
          )}
            <div className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-b border-gray-200 dark:border-gray-700 pb-4">
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <span className="font-medium ml-1">{!record ? "Not clocked in" : "Clocked in"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Date:</span>{" "}
                <span className="font-medium ml-1 tabular-nums">
                  {formatDate(record?.date ?? record?.time_in)}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-x-6 sm:gap-y-5">
              <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/40 p-3">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Time In</span>
                  <p className="font-medium tabular-nums text-base mt-0.5">{formatTime(record?.time_in)}</p>
                </div>
                <AttendanceSelfiePreview url={record?.time_in_selfie} width={80} />
              </div>
              <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/40 p-3">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Break Start</span>
                  <p className="font-medium tabular-nums text-base mt-0.5">{formatTime(record?.break_start)}</p>
                </div>
                <AttendanceSelfiePreview url={record?.break_start_selfie} width={80} />
              </div>
              <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/40 p-3">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Break End</span>
                  <p className="font-medium tabular-nums text-base mt-0.5">{formatTime(record?.break_end)}</p>
                </div>
                <AttendanceSelfiePreview url={record?.break_end_selfie} width={80} />
              </div>
              <div className="space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/40 p-3">
                <div>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Time Out</span>
                  <p className="font-medium tabular-nums text-base mt-0.5">{formatTime(record?.time_out)}</p>
                </div>
                <AttendanceSelfiePreview url={record?.time_out_selfie} width={80} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div>
                <span className="text-muted-foreground">Total Hours:</span>{" "}
                <span className="font-medium tabular-nums ml-1">{calc.total}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Break:</span>{" "}
                <span className="font-medium tabular-nums ml-1">{calc.break}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Net Work:</span>{" "}
                <span className="font-medium tabular-nums ml-1">{calc.net}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Late:</span>{" "}
                <span className="font-medium tabular-nums ml-1">{calc.late}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={cameraOpen}
        onOpenChange={open => {
          setCameraOpen(open);
          if (!open) {
            setPendingType(null);
            setSaving(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingLabel} — take a selfie</DialogTitle>
          </DialogHeader>
          {saving && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Getting location, uploading, saving…
            </div>
          )}
          <CameraCapture
            active={cameraOpen}
            disabled={saving}
            onCapture={image => {
              void handleCaptured(image);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
