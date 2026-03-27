import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getManilaDateKey } from "@/lib/local-time";
import { diffInMinutes } from "@/lib/time-calculations";
import { getEmployees, type EmployeeListItem } from "@/lib/employees";
import { generatePayslip, type PayslipPayrollData } from "@/lib/payslip-generator";
import { exportPayrollExcel, exportToExcel } from "@/lib/export-excel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AttendanceRow = {
  id: string;
  employee_id: string;
  date: string | null;
  time_in: string | null;
  break_start: string | null;
  break_end: string | null;
  time_out: string | null;
};

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
    // If we're before the 10th, the last completed 10-25 is from previous month.
    const rangeMonthStart = day < 10 ? new Date(currentMonthStart.getTime()) : currentMonthStart;
    if (day < 10) rangeMonthStart.setUTCMonth(rangeMonthStart.getUTCMonth() - 1);

    const y = rangeMonthStart.getUTCFullYear();
    const m = rangeMonthStart.getUTCMonth() + 1;
    return { start: dateKeyFromUTC(y, m, 10), end: dateKeyFromUTC(y, m, 25) };
  }

  // "26-10" range spans from 26th to 10th (next month).
  if (cutoff === "26-10") {
    // If we're on/before the 10th, it started on 26th of previous month.
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
  // `created_at` is a timestamp (timestamptz). We filter by the cutoff dates in Manila time.
  // Attendance `date` is stored as `YYYY-MM-DD` in Asia/Manila; mirror that here for consistency.
  const start = `${createdAtDateKeyStart}T00:00:00+08:00`;
  const end = `${createdAtDateKeyEnd}T23:59:59+08:00`;
  return { start, end };
}

function formatHours(hours: number): string {
  const safe = Number.isFinite(hours) ? hours : 0;
  return safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPeso(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PayrollPage() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [cutoff, setCutoff] = useState("");
  const [branch, setBranch] = useState("all");

  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [payroll, setPayroll] = useState<PayslipPayrollData | null>(null);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [exportingAll, setExportingAll] = useState(false);

  const selectedEmployee = useMemo(
    () => employees.find(e => e.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const anchorDateKey = getManilaDateKey();
  const { start: startDate, end: endDate } = useMemo(() => {
    if (!cutoff) return { start: "", end: "" };
    return getCutoffRange(cutoff, anchorDateKey);
  }, [cutoff, anchorDateKey]);

  const handleExportPayroll = useCallback(() => {
    if (!selectedEmployee || !payroll) return;

    const data = [
      {
        Employee: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`.trim(),
        Branch: branch !== "all" ? branch : "All",
        Cutoff: cutoff ? `${startDate} - ${endDate}` : "—",
        TotalDays: payroll.totalDays,
        TotalHours: payroll.totalHours,
        Gross: formatPeso(payroll.gross),
        Allowances: formatPeso(payroll.allowances),
        Deductions: formatPeso(payroll.deductions),
        Net: formatPeso(payroll.net),
      },
    ];

    exportToExcel(data, "payroll-report");
  }, [selectedEmployee, payroll, branch, cutoff, startDate, endDate]);

  const handleExportAll = useCallback(async () => {
    if (!employees || employees.length === 0) return;
    if (!cutoff) return;
    if (!startDate || !endDate) return;

    setExportingAll(true);
    try {
      const { start: createdAtStart, end: createdAtEnd } = manilaStartEnd(startDate, endDate);

      const rows: Array<{
        employee: string;
        branch: string;
        cutoff: string;
        days: number;
        hours: number;
        gross: number;
        allowances: number;
        deductions: number;
        net: number;
      }> = [];

      // Sequential fetch for correctness; can be optimized later if needed.
      for (const emp of employees) {
        const employeeId = emp.id;
        const dailyRate = emp.dailyRate ?? 0;

        const selectList = `
          id,
          employee_id,
          date,
          time_in,
          break_start,
          break_end,
          time_out
        `;

        const { data: attendanceData, error: attendanceErr } = await supabase
          .from("attendance")
          .select(selectList)
          .eq("employee_id", employeeId)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true });

        if (attendanceErr) {
          toast.error(`Failed to load attendance for ${emp.firstName} ${emp.lastName}.`);
          continue;
        }

        const attendanceRows = (attendanceData ?? []).map(raw => {
          const r = raw as Record<string, unknown>;
          return {
            id: String(r.id ?? ""),
            employee_id: String(r.employee_id ?? employeeId),
            date: r.date != null ? String(r.date) : null,
            time_in: r.time_in != null ? String(r.time_in) : null,
            break_start: r.break_start != null ? String(r.break_start) : null,
            break_end: r.break_end != null ? String(r.break_end) : null,
            time_out: r.time_out != null ? String(r.time_out) : null,
          } satisfies AttendanceRow;
        });

        const [{ data: allowancesData, error: allowancesErr }, { data: deductionsData, error: deductionsErr }] =
          await Promise.all([
            supabase
              .from("allowances")
              .select("*")
              .eq("employee_id", employeeId)
              .gte("created_at", createdAtStart)
              .lte("created_at", createdAtEnd),
            supabase
              .from("deductions")
              .select("*")
              .eq("employee_id", employeeId)
              .gte("created_at", createdAtStart)
              .lte("created_at", createdAtEnd),
          ]);

        if (allowancesErr) {
          toast.error(`Failed to load allowances for ${emp.firstName} ${emp.lastName}.`);
          continue;
        }
        if (deductionsErr) {
          toast.error(`Failed to load deductions for ${emp.firstName} ${emp.lastName}.`);
          continue;
        }

        const totalAllowances = (allowancesData ?? []).reduce((sum, a) => {
          const amount = typeof a?.amount === "number" ? a.amount : Number(a?.amount);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

        const totalDeductions = (deductionsData ?? []).reduce((sum, d) => {
          const amount = typeof d?.amount === "number" ? d.amount : Number(d?.amount);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

        let netMinutesTotal = 0;
        let daysWorked = 0;
        let overtimeHours = 0;

        for (const r of attendanceRows) {
          const totalMinutes = diffInMinutes(r.time_in, r.time_out);
          const breakMinutes = diffInMinutes(r.break_start, r.break_end);
          const netMinutes = Math.max(0, totalMinutes - breakMinutes);
          if (netMinutes > 0) daysWorked += 1;

          netMinutesTotal += netMinutes;
          const netHours = netMinutes / 60;
          overtimeHours += Math.max(0, netHours - 8);
        }

        const totalHours = netMinutesTotal / 60;
        const regularGross = dailyRate * daysWorked;
        const overtimeGross = overtimeHours * (dailyRate / 8) * 1.25;
        const baseGross = regularGross + overtimeGross;
        const gross = baseGross + totalAllowances;
        const net = gross - totalDeductions;

        rows.push({
          employee: `${emp.firstName} ${emp.lastName}`.trim(),
          branch: branch !== "all" ? branch : "All",
          cutoff: `${startDate} - ${endDate}`,
          days: daysWorked,
          hours: totalHours,
          gross,
          allowances: totalAllowances,
          deductions: totalDeductions,
          net,
        });
      }

      exportPayrollExcel(rows);
      toast.success("Exported all payroll to Excel.");
    } finally {
      setExportingAll(false);
    }
  }, [employees, cutoff, startDate, endDate, branch]);

  const refreshEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const { data, error } = await getEmployees({ branch: branch !== "all" ? branch : undefined });
      if (error) {
        toast.error(error.message);
        setEmployees([]);
        return;
      }
      setEmployees(data);
    } catch (error: unknown) {
      console.error("FETCH ERROR:", error);
      toast.error("Failed to load employees.");
      setEmployees([]);
    } finally {
      setLoadingEmployees(false);
    }
  }, [branch]);

  useEffect(() => {
    void refreshEmployees();
  }, [refreshEmployees]);

  useEffect(() => {
    if (!employeeId) return;
    const stillExists = employees.some(e => e.id === employeeId);
    if (!stillExists) setEmployeeId("");
  }, [employees, employeeId]);

  useEffect(() => {
    if (!selectedEmployee || !cutoff) return;

    const run = async () => {
      setLoadingRecords(true);
      setPayroll(null);
      try {
        const anchorDateKey = getManilaDateKey();
        const { start, end } = getCutoffRange(cutoff, anchorDateKey);
        const { start: createdAtStart, end: createdAtEnd } = manilaStartEnd(start, end);

        const selectList = `
          id,
          employee_id,
          date,
          time_in,
          break_start,
          break_end,
          time_out
        `;

        const { data, error } = await supabase
          .from("attendance")
          .select(selectList)
          .eq("employee_id", employeeId)
          .gte("date", start)
          .lte("date", end)
          .order("date", { ascending: true });

        if (error) {
          toast.error(error.message);
          setRecords([]);
          return;
        }

        const rows = (data ?? []).map(raw => {
          const r = raw as Record<string, unknown>;
          return {
            id: String(r.id ?? ""),
            employee_id: String(r.employee_id ?? employeeId),
            date: r.date != null ? String(r.date) : null,
            time_in: r.time_in != null ? String(r.time_in) : null,
            break_start: r.break_start != null ? String(r.break_start) : null,
            break_end: r.break_end != null ? String(r.break_end) : null,
            time_out: r.time_out != null ? String(r.time_out) : null,
          } satisfies AttendanceRow;
        });

        setRecords(rows);

        const [{ data: allowancesData, error: allowancesErr }, { data: deductionsData, error: deductionsErr }] =
          await Promise.all([
            supabase
              .from("allowances")
              .select("*")
              .eq("employee_id", selectedEmployee.id)
              .gte("created_at", createdAtStart)
              .lte("created_at", createdAtEnd),
            supabase
              .from("deductions")
              .select("*")
              .eq("employee_id", selectedEmployee.id)
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

        const totalAllowances = (allowancesData ?? []).reduce((sum, a) => {
          const amount = typeof a?.amount === "number" ? a.amount : Number(a?.amount);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

        const totalDeductions = (deductionsData ?? []).reduce((sum, d) => {
          const amount = typeof d?.amount === "number" ? d.amount : Number(d?.amount);
          return sum + (Number.isFinite(amount) ? amount : 0);
        }, 0);

        const dailyRate = selectedEmployee.dailyRate ?? 0;

        let netMinutesTotal = 0;
        let daysWorked = 0;
        let overtimeHours = 0;

        for (const r of rows) {
          const totalMinutes = diffInMinutes(r.time_in, r.time_out);
          const breakMinutes = diffInMinutes(r.break_start, r.break_end);
          const netMinutes = Math.max(0, totalMinutes - breakMinutes);
          if (netMinutes > 0) daysWorked += 1;

          netMinutesTotal += netMinutes;
          const netHours = netMinutes / 60;
          overtimeHours += Math.max(0, netHours - 8);
        }

        const totalHours = netMinutesTotal / 60;
        const regularGross = dailyRate * daysWorked;
        const overtimeGross = overtimeHours * (dailyRate / 8) * 1.25;
        const baseGross = regularGross + overtimeGross;
        const gross = baseGross + totalAllowances;
        const net = gross - totalDeductions;

        setPayroll({
          totalDays: daysWorked,
          totalHours,
          gross,
          allowances: totalAllowances,
          deductions: totalDeductions,
          net,
          cutoffStart: start,
          cutoffEnd: end,
        });
      } catch (error: unknown) {
        console.error("FETCH ERROR:", error);
        toast.error("Failed to load payroll data.");
        setRecords([]);
        setPayroll(null);
      } finally {
        setLoadingRecords(false);
      }
    };

    void run();
  }, [cutoff, employeeId, selectedEmployee]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1">
          <Label>Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder={loadingEmployees ? "Loading..." : "Select employee"} />
            </SelectTrigger>
            <SelectContent>
              {employees.map(e => (
                <SelectItem key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </SelectItem>
              ))}
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

        <div className="space-y-1">
          <Label>Cutoff Period</Label>
          <Select value={cutoff} onValueChange={setCutoff}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select cutoff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10-25">10th – 25th</SelectItem>
              <SelectItem value="26-10">26th – 10th</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {cutoff && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAll}
            disabled={exportingAll || employees.length === 0}
          >
            {exportingAll ? "Exporting..." : "Export All Payroll"}
          </Button>
        </div>
      )}
      {selectedEmployee && cutoff && (
        <Card className="border-0 shadow-sm animate-fade-up max-w-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Payslip Summary</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Branch: {branch !== "all" ? branch : "All"} | Cutoff: {startDate} to {endDate}
            </p>

            <Row label="Employee" value={`${selectedEmployee.firstName} ${selectedEmployee.lastName}`} />
            <Row
              label="Daily Rate"
              value={formatPeso(selectedEmployee.dailyRate ?? 0)}
            />

            {loadingRecords && (
              <div className="flex items-center justify-center gap-2 text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading payslip…
              </div>
            )}

            {!loadingRecords && payroll && (
              <>
                {payroll.cutoffStart && payroll.cutoffEnd && (
                  <Row label="Cutoff" value={`${payroll.cutoffStart} - ${payroll.cutoffEnd}`} />
                )}

                <Row label="Total Days" value={String(payroll.totalDays)} />
                <Row label="Total Hours" value={`${formatHours(payroll.totalHours)} hrs`} />

                <div className="border-t pt-3" />
                <Row label="Allowances" value={formatPeso(payroll.allowances)} />
                <Row label="Deductions" value={formatPeso(payroll.deductions)} />
                <Row label="Gross Pay" value={formatPeso(payroll.gross)} />

                <div className="border-t pt-3" />
                <div className="flex justify-between font-bold text-lg">
                  <span>Net Pay</span>
                  <span className="text-primary tabular-nums">{formatPeso(payroll.net)}</span>
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
            <Button
              className="w-full mt-4 active:scale-[0.97] transition-transform"
              disabled={!payroll || loadingRecords}
              onClick={() => {
                if (!payroll) return;
                generatePayslip(selectedEmployee, records, payroll);
                toast.success("Payslip generated successfully (PDF downloaded).");
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Generate Payslip
            </Button>
            </div>

            <div className="flex justify-end -mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPayroll}
                disabled={!payroll || loadingRecords}
              >
                Export Payroll
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
