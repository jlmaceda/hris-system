import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getEmployees, type EmployeeListItem } from "@/lib/employees";
import { calculateAttendance } from "@/lib/time-calculations";
import { diffInMinutes } from "@/lib/time-calculations";
import { getManilaDateKey } from "@/lib/local-time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AttendanceRow = {
  employee_id: string | null;
  time_in: string | null;
  break_start: string | null;
  break_end: string | null;
  time_out: string | null;
};

type Totals = {
  totalPayroll: number; // Gross pay (base gross + allowances)
  totalNetPayroll: number;
  totalHours: number;
  totalLateMinutes: number;
  employeeCount: number;
  totalAllowances: number;
  totalDeductions: number;
};

function formatPeso(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatHours(hours: number): string {
  const safe = Number.isFinite(hours) ? hours : 0;
  return safe.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function parseLateMinutes(late: string): number {
  // calculateAttendance returns something like: "12 min"
  const parsed = Number.parseInt(String(late).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKeyFromUTC(year: number, month1to12: number, day: number): string {
  return `${year}-${pad2(month1to12)}-${pad2(day)}`;
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateKey.split("-").map(x => Number(x));
  return { year: y, month: m, day: d };
}

function getCutoffRange(cutoff: string, anchorDateKey: string): { start: string; end: string } {
  const { year, month, day } = parseDateKey(anchorDateKey);
  const currentMonthStart = new Date(Date.UTC(year, month - 1, 1));

  if (cutoff === "10-25") {
    const rangeMonthStart = day < 10 ? new Date(currentMonthStart.getTime()) : currentMonthStart;
    if (day < 10) rangeMonthStart.setUTCMonth(rangeMonthStart.getUTCMonth() - 1);

    const y = rangeMonthStart.getUTCFullYear();
    const m = rangeMonthStart.getUTCMonth() + 1;
    return { start: dateKeyFromUTC(y, m, 10), end: dateKeyFromUTC(y, m, 25) };
  }

  if (cutoff === "26-10") {
    if (day <= 10) {
      const prevMonth = new Date(currentMonthStart.getTime());
      prevMonth.setUTCMonth(prevMonth.getUTCMonth() - 1);
      const py = prevMonth.getUTCFullYear();
      const pm = prevMonth.getUTCMonth() + 1;
      return { start: dateKeyFromUTC(py, pm, 26), end: dateKeyFromUTC(year, month, 10) };
    }

    const nextMonth = new Date(currentMonthStart.getTime());
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const ny = nextMonth.getUTCFullYear();
    const nm = nextMonth.getUTCMonth() + 1;
    return { start: dateKeyFromUTC(year, month, 26), end: dateKeyFromUTC(ny, nm, 10) };
  }

  return { start: anchorDateKey, end: anchorDateKey };
}

function manilaStartEnd(createdAtDateKeyStart: string, createdAtDateKeyEnd: string) {
  const start = `${createdAtDateKeyStart}T00:00:00+08:00`;
  const end = `${createdAtDateKeyEnd}T23:59:59+08:00`;
  return { start, end };
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [cutoff, setCutoff] = useState("");
  const [branch, setBranch] = useState("all");

  const anchorDateKey = getManilaDateKey();
  const { start: startDate, end: endDate } = useMemo(() => {
    if (!cutoff) return { start: "", end: "" };
    return getCutoffRange(cutoff, anchorDateKey);
  }, [cutoff, anchorDateKey]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setTotals(null);
      try {
        if (!cutoff) {
          setTotals(null);
          setLoading(false);
          return;
        }

        const anchorDateKey = getManilaDateKey();
        const { start, end } = getCutoffRange(cutoff, anchorDateKey);
        const { start: createdAtStart, end: createdAtEnd } = manilaStartEnd(start, end);

        const empRes = await getEmployees({ branch: branch !== "all" ? branch : undefined });
        const branchEmployeeIds = empRes.data.map(e => e.id);

        if (branch !== "all" && branchEmployeeIds.length === 0) {
          setTotals({
            totalPayroll: 0,
            totalNetPayroll: 0,
            totalHours: 0,
            totalLateMinutes: 0,
            employeeCount: 0,
            totalAllowances: 0,
            totalDeductions: 0,
          });
          return;
        }

        const attendanceQuery = supabase
          .from("attendance")
          .select("employee_id, time_in, break_start, break_end, time_out")
          .gte("date", start)
          .lte("date", end);

        if (branch !== "all" && branchEmployeeIds.length === 0) {
          setTotals({
            totalPayroll: 0,
            totalNetPayroll: 0,
            totalHours: 0,
            totalLateMinutes: 0,
            employeeCount: 0,
            totalAllowances: 0,
            totalDeductions: 0,
          });
          return;
        }

        const attendanceData = branch !== "all"
          ? await attendanceQuery.in("employee_id", branchEmployeeIds)
          : await attendanceQuery;

        if (attendanceData.error) {
          toast.error(attendanceData.error.message);
          return;
        }

        const attendanceRows = (attendanceData.data ?? []) as AttendanceRow[];
        const employeeIdsPresent = new Set<string>();
        for (const r of attendanceRows) {
          const id = r.employee_id ?? "";
          if (id.trim()) employeeIdsPresent.add(id);
        }

        const employeeMap = new Map<string, EmployeeListItem>();
        for (const e of empRes.data) employeeMap.set(e.id, e);

        const employeeGroups = new Map<
          string,
          { netMinutes: number; daysWorked: number; overtimeMinutes: number; lateMinutes: number }
        >();

        let totalHours = 0;
        let totalLateMinutes = 0;

        for (const r of attendanceRows) {
          const employeeId = r.employee_id ?? "";
          if (!employeeId.trim()) continue;
          // Ensure employees without a daily rate still appear; payroll calc will treat them as 0.

          const calc = calculateAttendance({
            time_in: r.time_in,
            break_start: r.break_start,
            break_end: r.break_end,
            time_out: r.time_out,
          });
          const lateMinutes = parseLateMinutes(calc.late);

          const totalMinutes = diffInMinutes(r.time_in, r.time_out);
          const breakMinutes = diffInMinutes(r.break_start, r.break_end);
          const netMinutes = Math.max(0, totalMinutes - breakMinutes);

          const daysWorked = netMinutes > 0 ? 1 : 0;
          const overtimeMinutes = Math.max(0, netMinutes - 8 * 60);

          const current = employeeGroups.get(employeeId) ?? {
            netMinutes: 0,
            daysWorked: 0,
            overtimeMinutes: 0,
            lateMinutes: 0,
          };

          current.netMinutes += netMinutes;
          current.daysWorked += daysWorked;
          current.overtimeMinutes += overtimeMinutes;
          current.lateMinutes += lateMinutes;

          employeeGroups.set(employeeId, current);

          totalHours += netMinutes / 60;
          totalLateMinutes += lateMinutes;
        }

        const [{ data: allowancesData, error: allowancesErr }, { data: deductionsData, error: deductionsErr }] =
          await Promise.all([
            supabase
              .from("allowances")
              .select("employee_id, amount")
              .gte("created_at", createdAtStart)
              .lte("created_at", createdAtEnd),
            supabase
              .from("deductions")
              .select("employee_id, amount")
              .gte("created_at", createdAtStart)
              .lte("created_at", createdAtEnd),
          ]);

        if (allowancesErr) {
          toast.error(allowancesErr.message);
          return;
        }
        if (deductionsErr) {
          toast.error(deductionsErr.message);
          return;
        }

        const allowancesByEmployee = new Map<string, number>();
        for (const a of allowancesData ?? []) {
          const employeeId = (a as Record<string, unknown>).employee_id;
          const id = employeeId != null ? String(employeeId) : "";
          if (!id.trim()) continue;
          if (!employeeIdsPresent.has(id)) continue;
          const amount = toNumber((a as Record<string, unknown>).amount);
          allowancesByEmployee.set(id, (allowancesByEmployee.get(id) ?? 0) + amount);
        }

        const deductionsByEmployee = new Map<string, number>();
        for (const d of deductionsData ?? []) {
          const employeeId = (d as Record<string, unknown>).employee_id;
          const id = employeeId != null ? String(employeeId) : "";
          if (!id.trim()) continue;
          if (!employeeIdsPresent.has(id)) continue;
          const amount = toNumber((d as Record<string, unknown>).amount);
          deductionsByEmployee.set(id, (deductionsByEmployee.get(id) ?? 0) + amount);
        }

        let totalPayroll = 0;
        let totalNetPayroll = 0;
        let totalAllowances = 0;
        let totalDeductions = 0;

        for (const employeeId of employeeIdsPresent) {
          const group = employeeGroups.get(employeeId) ?? {
            netMinutes: 0,
            daysWorked: 0,
            overtimeMinutes: 0,
            lateMinutes: 0,
          };
          const dailyRate = employeeMap.get(employeeId)?.dailyRate ?? 0;
          const regularGross = dailyRate * group.daysWorked;
          const overtimeHours = group.overtimeMinutes / 60;
          const overtimeGross = overtimeHours * (dailyRate / 8) * 1.25;

          const baseGross = regularGross + overtimeGross;
          const allowanceTotal = allowancesByEmployee.get(employeeId) ?? 0;
          const deductionTotal = deductionsByEmployee.get(employeeId) ?? 0;

          const gross = baseGross + allowanceTotal;
          const net = gross - deductionTotal;

          totalPayroll += gross;
          totalNetPayroll += net;
          totalAllowances += allowanceTotal;
          totalDeductions += deductionTotal;
        }

        setTotals({
          totalPayroll,
          totalNetPayroll,
          totalHours,
          totalLateMinutes,
          employeeCount: employeeIdsPresent.size,
          totalAllowances,
          totalDeductions,
        });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to load reports";
        toast.error(message);
        setTotals({
          totalPayroll: 0,
          totalNetPayroll: 0,
          totalHours: 0,
          totalLateMinutes: 0,
          employeeCount: 0,
          totalAllowances: 0,
          totalDeductions: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [cutoff, branch]);

  const cards = useMemo(() => {
    const t = totals ?? {
      totalPayroll: 0,
      totalNetPayroll: 0,
      totalHours: 0,
      totalLateMinutes: 0,
      employeeCount: 0,
      totalAllowances: 0,
      totalDeductions: 0,
    };
    return [
      { title: "Total Payroll", value: formatPeso(t.totalPayroll) },
      { title: "Allowances", value: formatPeso(t.totalAllowances) },
      { title: "Deductions", value: formatPeso(t.totalDeductions) },
      { title: "Net Payroll", value: formatPeso(t.totalNetPayroll) },
      { title: "Total Hours", value: `${formatHours(t.totalHours)} hrs` },
      { title: "Total Late", value: `${t.totalLateMinutes.toLocaleString()} mins` },
      { title: "Employees", value: `${t.employeeCount}` },
    ];
  }, [totals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="space-y-1">
            <Label>Cutoff Period</Label>
            <Select value={cutoff} onValueChange={setCutoff}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select cutoff" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10-25">10–25</SelectItem>
                <SelectItem value="26-10">26–10</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Branch</Label>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All branches" />
              </SelectTrigger>
              <SelectContent>
              <SelectItem value="all">All</SelectItem>
                <SelectItem value="Main Branch">Main Branch</SelectItem>
                <SelectItem value="CDO Branch">CDO Branch</SelectItem>
                <SelectItem value="Tagum Branch">Tagum Branch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="border-0 shadow-sm animate-fade-up">
          <CardContent className="py-10">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading reports…</span>
            </div>
          </CardContent>
        </Card>
      ) : !cutoff ? (
        <Card className="border-0 shadow-sm animate-fade-up">
          <CardContent className="py-10 text-center text-muted-foreground">
            Select a cutoff period to view reports.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Branch: {branch !== "all" ? branch : "All"} | Cutoff: {startDate} to {endDate}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(c => (
            <Card key={c.title} className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-bold tabular-nums">{c.value}</div>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}

