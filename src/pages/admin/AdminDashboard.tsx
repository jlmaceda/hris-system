import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, UserCheck, Clock, Activity, Coffee } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getManilaDateKey } from "@/lib/local-time";
import { formatTime } from "@/lib/datetime-format";
import { diffInMinutes } from "@/lib/time-calculations";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type AttendanceRow = {
  date: string;
  employee_id: string;
  created_at: string;
  time_in: string | null;
  time_out: string | null;
  break_start: string | null;
  break_end: string | null;
};

function minusDays(yyyyMmDd: string, days: number): string {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  d.setDate(d.getDate() - days);
  // Return YYYY-MM-DD in local (works fine because we set midnight above)
  return d.toISOString().slice(0, 10);
}

/** First calendar day of the month for YYYY-MM-DD (used for payroll MTD range). */
function monthStart(yyyyMmDd: string): string {
  if (yyyyMmDd.length >= 7) return `${yyyyMmDd.slice(0, 7)}-01`;
  return yyyyMmDd;
}

function normalizeBranchLabel(branch: string): string {
  const trimmed = branch.replace(/\s*Branch\s*$/i, "").trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown" || trimmed === "—") return "No Branch Assigned";
  return trimmed;
}

/** Every calendar day from start through end (YYYY-MM-DD), inclusive. */
function eachDateInclusive(start: string, end: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${start}T12:00:00`);
  const endD = new Date(`${end}T12:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(endD.getTime())) return out;
  while (cur <= endD) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const HEATMAP_DAY_RANGE = 35;

function RechartsSaasTooltip({
  active,
  payload,
  label,
  labelFormatter,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: unknown;
  labelFormatter?: (label: unknown) => string;
  formatter?: (value: number, name?: string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const title = labelFormatter ? labelFormatter(label) : String(label ?? "");
  return (
    <div className="rounded-xl border border-gray-200 bg-white/95 dark:border-gray-700 dark:bg-gray-800/95 backdrop-blur px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.12)]">
      {title ? <div className="text-xs font-medium text-gray-700 dark:text-gray-200">{title}</div> : null}
      <div className="mt-1 space-y-1">
        {payload.map((p, idx) => {
          const raw = p.value;
          const num = typeof raw === "number" ? raw : Number(raw);
          const valueText = Number.isFinite(num)
            ? (formatter ? formatter(num, p.name) : num.toLocaleString())
            : String(raw ?? "—");
          return (
            <div key={`${p.name ?? "value"}-${idx}`} className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color ?? "#10b981" }} />
                <span className="text-gray-600 dark:text-gray-300 truncate">{p.name ?? "Value"}</span>
              </div>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{valueText}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EmptyStateMessage() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30 px-4 py-8 text-center">
      <span className="text-2xl leading-none" aria-hidden="true">
        📊
      </span>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">No data available for selected period</p>
    </div>
  );
}

function heatmapIntensityClass(count: number, maxPresent: number): string {
  if (count <= 0) return "bg-muted/80 text-muted-foreground";
  if (maxPresent <= 0) return "bg-emerald-100 text-emerald-900";
  const ratio = count / maxPresent;
  if (ratio <= 0.2) return "bg-emerald-100 text-emerald-900";
  if (ratio <= 0.4) return "bg-emerald-300 text-emerald-950";
  if (ratio <= 0.6) return "bg-emerald-500 text-white";
  if (ratio <= 0.8) return "bg-emerald-600 text-white";
  return "bg-emerald-800 text-white";
}

function formatPeso(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₱${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminDashboard() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartLine = "#4ade80";
  const chartBar = "#22c55e";
  const chartGrid = "#374151";
  const chartCursorFill = "rgba(74, 222, 128, 0.10)";

  const branchOptions = ["Main Branch", "CDO Branch", "Tagum Branch"] as const;

  const [branch, setBranch] = useState<"All" | (typeof branchOptions)[number]>("All");
  const [date, setDate] = useState<string>(() => getManilaDateKey());

  const [totalEmployees, setTotalEmployees] = useState<number>(0);
  const [presentToday, setPresentToday] = useState<number>(0);
  const [lateEmployees, setLateEmployees] = useState<number>(0);
  const [onBreak, setOnBreak] = useState<number>(0);
  const [workingNow, setWorkingNow] = useState<number>(0);
  const [notClockedIn, setNotClockedIn] = useState<number>(0);

  /** Present count per day for heatmap + trend line (last {HEATMAP_DAY_RANGE} days ending on selected date). */
  const [attendanceHeatmapData, setAttendanceHeatmapData] = useState<Array<{ date: string; count: number }>>([]);
  const [branchPerformanceData, setBranchPerformanceData] = useState<Array<{ branch: string; present: number }>>([]);
  const [payrollByBranchData, setPayrollByBranchData] = useState<Array<{ branch: string; payroll: number }>>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activityFeed, setActivityFeed] = useState<
    Array<{ employeeName: string; action: string; time: string; createdAt: string }>
  >([]);
  const [topLateEmployees, setTopLateEmployees] = useState<
    Array<{ name: string; lateCount: number }>
  >([]);
  /** Complete day = time_in + time_out + not late (same 8:05 AM Manila rule). Score = count in rolling window. */
  const [topPerformers, setTopPerformers] = useState<Array<{ name: string; score: number }>>([]);
  const [totalHoursToday, setTotalHoursToday] = useState<number>(0);
  const [estimatedPayrollCost, setEstimatedPayrollCost] = useState<number>(0);

  const lateCutoff = useMemo(() => {
    // Cutoff = 8:05 AM Asia/Manila
    const cutoffHour = 8;
    const cutoffMinute = 5;
    const cutoffSecond = 0;
    return { cutoffHour, cutoffMinute, cutoffSecond };
  }, []);

  const isLateInManila = useCallback(
    (timeIn: string) => {
      const d = new Date(timeIn);
      if (Number.isNaN(d.getTime())) return false;

      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).formatToParts(d);

      const get = (type: "hour" | "minute" | "second") =>
        parts.find(p => p.type === type)?.value ?? "0";

      const hours = Number(get("hour"));
      const minutes = Number(get("minute"));
      const seconds = Number(get("second"));

      return (
        hours > lateCutoff.cutoffHour ||
        (hours === lateCutoff.cutoffHour &&
          (minutes > lateCutoff.cutoffMinute ||
            (minutes === lateCutoff.cutoffMinute && seconds > lateCutoff.cutoffSecond)))
      );
    },
    [lateCutoff]
  );

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: employees,
        error: employeesError,
      } = await supabase.from("employees").select("*");

      if (employeesError) {
        console.error("Dashboard - employees fetch error:", employeesError);
      }

      const employeeIds =
        branch === "All"
          ? (employees ?? [])
              .map(e => String((e as Record<string, unknown>).id))
              .filter(id => id && id !== "undefined")
          : (employees ?? [])
              .filter(e => (e as Record<string, unknown>).branch === branch)
              .map(e => String((e as Record<string, unknown>).id))
              .filter(id => id && id !== "undefined");

      if (employeeIds.length === 0) {
        setTotalEmployees(0);
        setPresentToday(0);
        setLateEmployees(0);
        setOnBreak(0);
        setAttendanceHeatmapData([]);
        setBranchPerformanceData([]);
        setPayrollByBranchData([]);
        setActivityFeed([]);
        setTopLateEmployees([]);
        setTopPerformers([]);
        setTotalHoursToday(0);
        setEstimatedPayrollCost(0);
        return;
      }

      const { data: attendance, error: attendanceError } = await supabase
        .from("attendance")
        .select("date, employee_id, created_at, time_in, time_out, break_start, break_end")
        .eq("date", date)
        .in("employee_id", employeeIds);

      if (attendanceError) {
        console.error("Dashboard - attendance fetch error:", attendanceError);
      }

      const attendanceRows = (attendance ?? []) as AttendanceRow[];

      const employeeLookup = new Map<string, string>();
      const dailyRateByEmployeeId = new Map<string, number>();
      const branchByEmployeeId = new Map<string, string>();
      for (const e of employees ?? []) {
        const id = (e as Record<string, unknown>).id;
        const first = (e as Record<string, unknown>).first_name;
        const last = (e as Record<string, unknown>).last_name;
        const name =
          `${typeof first === "string" ? first : ""} ${typeof last === "string" ? last : ""}`
            .trim()
            .replace(/\s+/g, " ");
        if (id != null) {
          employeeLookup.set(String(id), name || String(id));
        }

        const rawBranch = (e as Record<string, unknown>).branch;
        if (id != null && typeof rawBranch === "string" && rawBranch.trim()) {
          branchByEmployeeId.set(String(id), rawBranch.trim());
        }

        const rawDailyRate =
          (e as Record<string, unknown>).daily_rate ?? (e as Record<string, unknown>).dailyRate ?? null;
        const dailyRateNum =
          typeof rawDailyRate === "number"
            ? rawDailyRate
            : typeof rawDailyRate === "string" && rawDailyRate.trim()
              ? Number(rawDailyRate)
              : 0;
        if (id != null && Number.isFinite(dailyRateNum)) {
          dailyRateByEmployeeId.set(String(id), dailyRateNum);
        }
      }

      const total = (employees ?? []).filter(e => {
        if (branch === "All") return true;
        return (e as Record<string, unknown>).branch === branch;
      }).length;

      // PRESENT TODAY
      const present = attendanceRows.filter(a => a.time_in != null).length || 0;

      // LATE DISTRIBUTION
      const lateCount = attendanceRows.filter(a => (a.time_in ? isLateInManila(a.time_in) : false))
        .length;

      // LIVE STATUS LOGIC (for the selected `date`)
      const working = attendanceRows.filter(a => a.time_in && !a.time_out && !a.break_start).length;
      const onBreakNow = attendanceRows.filter(a => a.break_start && !a.break_end).length;
      const notClockedInCount = total - attendanceRows.length;

      setTotalEmployees(total);
      setPresentToday(present);
      setLateEmployees(lateCount);
      setOnBreak(onBreakNow);
      setWorkingNow(working);
      setNotClockedIn(notClockedInCount);

      // PAYROLL SUMMARY (selected `date` only)
      // Uses the same concept as PayrollPage: net minutes = (time_in..time_out) - (break_start..break_end),
      // then regular vs overtime based on an 8-hour day using daily_rate.
      let netHoursTotal = 0;
      let payrollTotal = 0;
      for (const row of attendanceRows) {
        const totalMinutes = diffInMinutes(row.time_in, row.time_out);
        const breakMinutes = diffInMinutes(row.break_start, row.break_end);
        const netMinutes = Math.max(0, totalMinutes - breakMinutes);
        const netHours = netMinutes / 60;

        netHoursTotal += netHours;

        const employeeId = String(row.employee_id ?? "");
        const dailyRate = dailyRateByEmployeeId.get(employeeId) ?? 0;
        const hourlyRate = dailyRate / 8;

        const regularHours = Math.min(netHours, 8);
        const overtimeHours = Math.max(0, netHours - 8);

        payrollTotal += regularHours * hourlyRate + overtimeHours * hourlyRate * 1.25;
      }

      setTotalHoursToday(netHoursTotal);
      setEstimatedPayrollCost(payrollTotal);

      // ATTENDANCE HEATMAP / TREND: group by date, count present (time_in) per day over rolling window
      const heatmapStart = minusDays(date, HEATMAP_DAY_RANGE - 1);
      const { data: heatmapAttendance, error: heatmapError } = await supabase
        .from("attendance")
        .select("date, time_in")
        .gte("date", heatmapStart)
        .lte("date", date)
        .in("employee_id", employeeIds);

      if (heatmapError) {
        console.error("Dashboard - heatmap attendance fetch error:", heatmapError);
        setAttendanceHeatmapData([]);
      } else {
        const countsByDate: Record<string, number> = {};
        for (const row of heatmapAttendance ?? []) {
          const r = row as { date?: string; time_in?: string | null };
          if (!r.time_in || !r.date) continue;
          countsByDate[r.date] = (countsByDate[r.date] ?? 0) + 1;
        }
        const series = eachDateInclusive(heatmapStart, date).map(d => ({
          date: d,
          count: countsByDate[d] ?? 0,
        }));
        setAttendanceHeatmapData(series);
      }

      // BRANCH PERFORMANCE (present count per branch for selected `date`)
      const presentByBranch: Record<string, number> = {};
      for (const row of attendanceRows) {
        if (!row.time_in) continue;
        const employeeId = String(row.employee_id ?? "");
        if (!employeeId) continue;
        const b = branchByEmployeeId.get(employeeId) ?? "Unknown";
        presentByBranch[b] = (presentByBranch[b] ?? 0) + 1;
      }

      const branchPerf = Object.entries(presentByBranch)
        .map(([b, present]) => ({
          branch: normalizeBranchLabel(b),
          present,
        }))
        .sort((a, b) => b.present - a.present);

      setBranchPerformanceData(branchPerf);

      // PAYROLL BY BRANCH (month-to-date through selected date)
      // Gross = dailyRate * daysWorked + overtimeHours * (dailyRate/8) * 1.25 (same as PayrollPage)
      const payrollMtdStart = monthStart(date);
      const { data: payrollAttendance, error: payrollAttendanceError } = await supabase
        .from("attendance")
        .select("date, employee_id, time_in, time_out, break_start, break_end")
        .gte("date", payrollMtdStart)
        .lte("date", date)
        .in("employee_id", employeeIds);

      if (payrollAttendanceError) {
        console.error("Dashboard - payroll analytics fetch error:", payrollAttendanceError);
        setPayrollByBranchData([]);
      } else {
        const payrollRows = (payrollAttendance ?? []) as AttendanceRow[];
        type EmpPayrollAgg = { daysWorked: number; overtimeHours: number };
        const aggByEmployee = new Map<string, EmpPayrollAgg>();

        for (const row of payrollRows) {
          const empId = String(row.employee_id ?? "");
          if (!empId || !row.time_in) continue;

          const totalMinutes = diffInMinutes(row.time_in, row.time_out);
          const breakMinutes = diffInMinutes(row.break_start, row.break_end);
          const netMinutes = Math.max(0, totalMinutes - breakMinutes);
          const netHours = netMinutes / 60;

          let agg = aggByEmployee.get(empId);
          if (!agg) {
            agg = { daysWorked: 0, overtimeHours: 0 };
            aggByEmployee.set(empId, agg);
          }
          agg.daysWorked += 1;
          agg.overtimeHours += Math.max(0, netHours - 8);
        }

        const payrollByBranch: Record<string, number> = {};
        for (const [empId, agg] of aggByEmployee) {
          const dailyRate = dailyRateByEmployeeId.get(empId) ?? 0;
          const gross =
            dailyRate * agg.daysWorked + agg.overtimeHours * (dailyRate / 8) * 1.25;
          const rawBranch = branchByEmployeeId.get(empId) ?? "Unknown";
          const b = normalizeBranchLabel(rawBranch);
          payrollByBranch[b] = (payrollByBranch[b] ?? 0) + gross;
        }

        const payrollChart = Object.entries(payrollByBranch)
          .map(([branch, payroll]) => ({ branch, payroll }))
          .sort((a, b) => b.payroll - a.payroll);

        setPayrollByBranchData(payrollChart);
      }

      // TODAY ACTIVITY FEED (latest updates first)
      const logs: Array<{ employeeName: string; action: string; time: string; createdAt: string }> = [];
      for (const row of attendanceRows) {
        const employeeId = String(row.employee_id ?? "");
        const employeeName = employeeLookup.get(employeeId) ?? employeeId;
        const createdAt = row.created_at;

        if (row.time_in) {
          logs.push({ employeeName, action: "clocked in", time: row.time_in, createdAt });
        }
        if (row.break_start) {
          logs.push({ employeeName, action: "started break", time: row.break_start, createdAt });
        }
        if (row.break_end) {
          logs.push({ employeeName, action: "ended break", time: row.break_end, createdAt });
        }
        if (row.time_out) {
          logs.push({ employeeName, action: "timed out", time: row.time_out, createdAt });
        }
      }

      logs.sort((a, b) => {
        const at = Date.parse(a.createdAt);
        const bt = Date.parse(b.createdAt);
        return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
      });

      setActivityFeed(logs.slice(0, 50));

      // TOP LATE EMPLOYEES (top 5 by late occurrences over a rolling window)
      // "Frequent lateness" is more meaningful across multiple days.
      const lateWindowStart = minusDays(date, 30);
      const { data: lateAttendance, error: lateAttendanceError } = await supabase
        .from("attendance")
        .select("date, employee_id, time_in")
        .gte("date", lateWindowStart)
        .lte("date", date)
        .in("employee_id", employeeIds);

      if (lateAttendanceError) {
        console.error("Dashboard - late analytics fetch error:", lateAttendanceError);
        setTopLateEmployees([]);
      } else {
        const lateRows = (lateAttendance ?? []) as Array<Pick<AttendanceRow, "date" | "employee_id" | "time_in">>;
        const lateByEmployee: Record<string, number> = {};

        for (const row of lateRows) {
          if (!row.time_in) continue;
          if (!isLateInManila(row.time_in)) continue;
          const employeeId = String(row.employee_id ?? "");
          if (!employeeId) continue;
          lateByEmployee[employeeId] = (lateByEmployee[employeeId] ?? 0) + 1;
        }

        const topLate = Object.entries(lateByEmployee)
          .map(([employeeId, lateCount]) => ({
            name: employeeLookup.get(employeeId) ?? employeeId,
            lateCount,
          }))
          .sort((a, b) => b.lateCount - a.lateCount)
          .slice(0, 5);

        setTopLateEmployees(topLate);
      }

      // TOP PERFORMERS: complete attendance (time_in + time_out) and on-time (not late), last 30 days
      const performerWindowStart = minusDays(date, 30);
      const { data: performerAttendance, error: performerError } = await supabase
        .from("attendance")
        .select("employee_id, time_in, time_out")
        .gte("date", performerWindowStart)
        .lte("date", date)
        .in("employee_id", employeeIds);

      if (performerError) {
        console.error("Dashboard - top performers fetch error:", performerError);
        setTopPerformers([]);
      } else {
        const scoreByEmployee: Record<string, number> = {};
        for (const row of performerAttendance ?? []) {
          const r = row as { employee_id?: string; time_in?: string | null; time_out?: string | null };
          const empId = String(r.employee_id ?? "");
          if (!empId || !r.time_in || !r.time_out) continue;
          if (isLateInManila(r.time_in)) continue;
          scoreByEmployee[empId] = (scoreByEmployee[empId] ?? 0) + 1;
        }

        const ranked = Object.entries(scoreByEmployee)
          .map(([employeeId, score]) => ({
            name: employeeLookup.get(employeeId) ?? employeeId,
            score,
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        setTopPerformers(ranked);
      }
    } catch (err) {
      console.error("Dashboard - fetchDashboardData error:", err);
    } finally {
      setLoading(false);
    }
  }, [branch, date, isLateInManila]);

  useEffect(() => {
    void fetchDashboardData();
    const interval = window.setInterval(() => {
      void fetchDashboardData();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [fetchDashboardData]);

  const cards = [
    {
      label: "Total Employees",
      value: totalEmployees,
      icon: Users,
      iconContainerClass: "w-10 h-10 flex items-center justify-center rounded-xl bg-blue-100 text-blue-600",
    },
    {
      label: "Present Today",
      value: presentToday,
      icon: UserCheck,
      iconContainerClass: "w-10 h-10 flex items-center justify-center rounded-xl bg-green-100 text-green-600",
    },
    {
      label: "Late Employees",
      value: lateEmployees,
      icon: Clock,
      iconContainerClass: "w-10 h-10 flex items-center justify-center rounded-xl bg-red-100 text-red-600",
    },
    {
      label: "Working Now",
      value: workingNow,
      icon: Activity,
      iconContainerClass: "w-10 h-10 flex items-center justify-center rounded-xl bg-sky-100 text-sky-600",
    },
    {
      label: "On Break",
      value: onBreak,
      icon: Coffee,
      iconContainerClass: "w-10 h-10 flex items-center justify-center rounded-xl bg-amber-100 text-amber-600",
    },
    {
      label: "Not Clocked In",
      value: notClockedIn,
      icon: Clock,
      iconContainerClass: "w-10 h-10 flex items-center justify-center rounded-xl bg-gray-100 text-gray-600",
    },
    {
      label: "Total Hours Today",
      value: `${totalHoursToday.toFixed(2)} hrs`,
      icon: Activity,
      iconContainerClass: "w-10 h-10 flex items-center justify-center rounded-xl bg-indigo-100 text-indigo-600",
    },
    {
      label: "Estimated Payroll Cost",
      value: formatPeso(estimatedPayrollCost),
      icon: Users,
      iconContainerClass: "w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600",
    },
  ] as const;

  const heatmapMaxCount =
    attendanceHeatmapData.length > 0 ? Math.max(1, ...attendanceHeatmapData.map(d => d.count)) : 1;

  return (
    <div className="space-y-6">
      <div
        className="
          text-white p-4 sm:p-5 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.12)]
        "
        style={{ background: "linear-gradient(135deg, #16a34a, #22c55e)" }}
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-white/90">Welcome back, Admin</p>
        </div>
        <p className="mt-3 text-sm text-white/85">
          Real-time HR analytics for <span className="font-medium">{date}</span>
        </p>
      </div>

      <div className="flex gap-3 flex-wrap items-end">
        <div className="min-w-[220px]">
          <p className="text-xs text-muted-foreground mb-1">Branch</p>
          <Select value={branch} onValueChange={v => setBranch(v as typeof branch)}>
            <SelectTrigger>
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All</SelectItem>
              {branchOptions.map(b => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[180px]">
          <p className="text-xs text-muted-foreground mb-1">Date</p>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
        {cards.map((s, i) => (
          (() => {
            const isPresentToday = s.label === "Present Today";
            return (
          <Card
            key={s.label}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] dark:hover:shadow-green-500/10"
            style={{
              animation: `fade-up 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 80}ms forwards`,
              opacity: 0,
            }}
          >
            <CardContent className="flex items-center gap-4 p-0">
              <div className={s.iconContainerClass}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p
                  className={cn(
                    "font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-tight",
                    isPresentToday ? "text-4xl text-green-500 dark:text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.28)]" : "text-2xl",
                  )}
                >
                  {loading ? "—" : s.value}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-300">{s.label}</p>
              </div>
            </CardContent>
          </Card>
            );
          })()
        ))}
      </div>

      <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] dark:hover:shadow-green-500/10">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">Attendance Heatmap</p>
              <p className="font-medium">Present count per day (trend + calendar grid)</p>
              <p className="text-xs text-muted-foreground mt-1">
                Last {HEATMAP_DAY_RANGE} days ending <span className="font-medium tabular-nums">{date}</span>
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : attendanceHeatmapData.length === 0 ? (
            <EmptyStateMessage />
          ) : (
            <>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={attendanceHeatmapData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={v => String(v).slice(5)} />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      cursor={{ stroke: chartGrid, strokeWidth: 1 }}
                      content={
                        <RechartsSaasTooltip
                          labelFormatter={v => String(v)}
                          formatter={(value) => `${value.toLocaleString()} present`}
                        />
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke={chartLine}
                      strokeWidth={3}
                      dot={{ r: 2.5, strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                      name="Present"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Daily intensity (darker = more present)</p>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {attendanceHeatmapData.map(d => (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.count} present`}
                      className={cn(
                        "aspect-square rounded-md flex flex-col items-center justify-center p-0.5 sm:p-1 text-[9px] sm:text-[10px] font-medium tabular-nums leading-tight min-h-[2.25rem]",
                        heatmapIntensityClass(d.count, heatmapMaxCount)
                      )}
                    >
                      <span className="opacity-80">{d.date.slice(8)}</span>
                      <span className="font-bold">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] dark:hover:shadow-green-500/10">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Branch Performance</p>
              <p className="font-medium">Present employees per branch</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : branchPerformanceData.length === 0 ? (
            <EmptyStateMessage />
          ) : (
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={branchPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                  <XAxis dataKey="branch" />
                  <YAxis allowDecimals={false} />
                  <Tooltip content={<RechartsSaasTooltip labelFormatter={v => String(v)} />} cursor={{ fill: chartCursorFill }} />
                  <Bar dataKey="present" fill={chartBar} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] dark:hover:shadow-green-500/10">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Payroll Analytics</p>
              <p className="font-medium">Gross payroll cost by branch</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gross = daily rate × days worked + overtime (1.25× after 8h). Period:{" "}
                <span className="font-medium tabular-nums">
                  {monthStart(date)} → {date}
                </span>
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : payrollByBranchData.length === 0 ? (
            <EmptyStateMessage />
          ) : (
            <>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={payrollByBranchData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                    <XAxis dataKey="branch" />
                    <YAxis tickFormatter={v => `₱${Number(v).toLocaleString()}`} />
                    <Tooltip
                      content={
                        <RechartsSaasTooltip
                          labelFormatter={v => String(v)}
                          formatter={(value) => formatPeso(Number(value))}
                        />
                      }
                      cursor={{ fill: chartCursorFill }}
                    />
                    <Bar dataKey="payroll" fill={chartBar} radius={[6, 6, 0, 0]} name="Gross payroll" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {payrollByBranchData.map(row => (
                  <div
                    key={row.branch}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 bg-slate-50/60 dark:bg-gray-900/40 px-4 py-3 flex flex-col gap-0.5"
                  >
                    <p className="text-xs text-muted-foreground font-medium">{row.branch}</p>
                    <p className="text-lg font-bold tabular-nums text-emerald-700">{formatPeso(row.payroll)}</p>
                    <p className="text-[11px] text-muted-foreground">Month-to-date gross</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] dark:hover:shadow-green-500/10">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Today Activity Feed</p>
              <p className="font-medium">Latest attendance actions</p>
            </div>
          </div>

          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : activityFeed.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity found for {date}.</p>
            ) : (
              activityFeed.map((item, idx) => (
                <div
                  key={`${item.employeeName}-${item.action}-${idx}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{item.employeeName}</p>
                    <p className="text-sm text-muted-foreground capitalize">{item.action}</p>
                  </div>
                  <p className="text-sm tabular-nums text-muted-foreground shrink-0">
                    {formatTime(item.time)}
                  </p>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] dark:hover:shadow-green-500/10 border-l-4 border-l-emerald-500">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Top Performers</p>
                <p className="font-medium">Complete days, on time</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Score = days with time in &amp; out and not late (after 8:05 AM). Last 30 days to{" "}
                  <span className="font-medium tabular-nums">{date}</span>.
                </p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : topPerformers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No qualifying days in this period.</p>
            ) : (
              <div className="space-y-2">
                {topPerformers.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200/60 bg-emerald-50/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        #{idx + 1} {item.name}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums text-emerald-800 shrink-0">
                      {item.score} pts
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.10)] dark:hover:shadow-green-500/10">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Top Late Employees</p>
                <p className="font-medium">Most frequent late arrivals</p>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : topLateEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground">No late employees for {date}.</p>
            ) : (
              <div className="space-y-2">
                {topLateEmployees.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        #{idx + 1} {item.name}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums text-muted-foreground shrink-0">
                      {item.lateCount} late
                      {item.lateCount === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
