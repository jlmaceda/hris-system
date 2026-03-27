import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDate, formatTime } from "@/lib/datetime-format";
import { calculateAttendance } from "@/lib/time-calculations";
import { getManilaDateKey } from "@/lib/local-time";
import { supabase } from "@/lib/supabaseClient";
import { exportAttendanceExcel } from "@/lib/export-excel";
import { AttendanceSelfiePreview } from "@/components/AttendanceSelfiePreview";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";

type AttendanceRow = {
  id: string;
  employee_id: string;
  date: string | null;
  time_in: string | null;
  break_start: string | null;
  break_end: string | null;
  time_out: string | null;
  time_in_selfie: string | null;
  break_start_selfie: string | null;
  break_end_selfie: string | null;
  time_out_selfie: string | null;
};

type RowWithEmployee = AttendanceRow & {
  employeeName: string;
  branch: string;
};

function buildEmployeeLookup(
  rows: Record<string, unknown>[]
): Map<string, { name: string; branch: string }> {
  const m = new Map<string, { name: string; branch: string }>();
  for (const row of rows) {
    const id = row.id != null ? String(row.id) : "";
    if (!id) continue;
    const fn = typeof row.first_name === "string" ? row.first_name : "";
    const ln = typeof row.last_name === "string" ? row.last_name : "";
    const name = `${fn} ${ln}`.trim() || id;
    const branch =
      typeof row.branch === "string" && row.branch.trim() ? row.branch.trim() : "—";
    m.set(id, { name, branch });
  }
  return m;
}

export default function AttendancePage() {
  const branchOptions = ["Main Branch", "CDO Branch", "Tagum Branch"] as const;
  const [date, setDate] = useState(() => getManilaDateKey());
  const [branch, setBranch] = useState("all");
  const [rows, setRows] = useState<RowWithEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      let empQ = supabase.from("employees").select("*");
      if (branch !== "all") {
        empQ = empQ.eq("branch", branch);
      }

      const empRes = await empQ;
      if (empRes.error) {
        console.error("Admin employees fetch:", empRes.error);
      }

      const empRows = (empRes.data ?? []) as Record<string, unknown>[];
      const employeeIds = empRows
        .map(r => (r.id != null ? String(r.id) : ""))
        .filter(Boolean);

      const selectList = `
        id,
        employee_id,
        date,
        time_in,
        break_start,
        break_end,
        time_out,
        time_in_selfie,
        break_start_selfie,
        break_end_selfie,
        time_out_selfie
      `;

      if (employeeIds.length === 0) {
        setRows([]);
        return;
      }

      const attendanceBase = supabase
        .from("attendance")
        .select(selectList)
        .eq("date", date)
        .in("employee_id", employeeIds);

      let { data, error } = await attendanceBase.order("date", { ascending: false });

      if (error?.message?.toLowerCase().includes("date")) {
        const fallback = await supabase
          .from("attendance")
          .select(selectList)
          .eq("date", date)
          .in("employee_id", employeeIds)
          .order("created_at", { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      console.log("ADMIN DATA:", data);

      if (error) {
        console.error("Admin attendance fetch:", error);
        setRows([]);
        return;
      }

      const lookup = buildEmployeeLookup(empRows);

      const merged: RowWithEmployee[] = (data ?? []).map((raw: Record<string, unknown>) => {
        const eid = raw.employee_id != null ? String(raw.employee_id) : "";
        const emp = lookup.get(eid);
        return {
          id: String(raw.id ?? ""),
          employee_id: eid,
          date: raw.date != null ? String(raw.date) : null,
          time_in: raw.time_in != null ? String(raw.time_in) : null,
          break_start: raw.break_start != null ? String(raw.break_start) : null,
          break_end: raw.break_end != null ? String(raw.break_end) : null,
          time_out: raw.time_out != null ? String(raw.time_out) : null,
          time_in_selfie: raw.time_in_selfie != null ? String(raw.time_in_selfie) : null,
          break_start_selfie:
            raw.break_start_selfie != null ? String(raw.break_start_selfie) : null,
          break_end_selfie: raw.break_end_selfie != null ? String(raw.break_end_selfie) : null,
          time_out_selfie: raw.time_out_selfie != null ? String(raw.time_out_selfie) : null,
          employeeName: emp?.name ?? eid,
          branch: emp?.branch ?? "—",
        };
      });

      setRows(merged);
    } catch (error: unknown) {
      console.error("FETCH ERROR:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [date, branch]);

  useEffect(() => {
    void fetchAttendance();
  }, [fetchAttendance]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (branch !== "all" && r.branch !== branch) return false;
      return true;
    });
  }, [rows, branch]);

  const handleExport = useCallback(() => {
    const records = filtered.map(r => ({
      employee_name: r.employeeName,
      date: formatDate(r.date),
      time_in: formatTime(r.time_in),
      time_in_selfie: r.time_in_selfie,
      break_start: formatTime(r.break_start),
      break_start_selfie: r.break_start_selfie,
      break_end: formatTime(r.break_end),
      break_end_selfie: r.break_end_selfie,
      time_out: formatTime(r.time_out),
      time_out_selfie: r.time_out_selfie,
    }));

    exportAttendanceExcel(records);
  }, [filtered]);

  const colCount = 15;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Attendance (DTR)</h1>
      <div className="flex gap-3 flex-wrap">
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
        <Select value={branch} onValueChange={setBranch}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All branches" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {branchOptions.map(b => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card className="border-0 shadow-sm animate-fade-up">
        <CardContent className="p-0 overflow-x-auto">
          <p className="p-4 text-sm text-muted-foreground">
            Branch: {branch !== "all" ? branch : "All"} | Cutoff: {date} to {date}
          </p>
          <div className="flex justify-end px-4 pb-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={loading || filtered.length === 0}
            >
              Export to Excel
            </Button>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <Table>
              <TableHeader className="bg-gray-50 text-gray-600 text-sm font-medium">
              <TableRow>
                <TableHead className="min-w-[8rem] text-gray-600">Employee</TableHead>
                <TableHead className="min-w-[7.5rem] whitespace-nowrap text-gray-600">Date</TableHead>
                <TableHead className="hidden sm:table-cell min-w-[6rem] text-gray-600">Branch</TableHead>
                <TableHead className="whitespace-nowrap text-gray-600">Time In</TableHead>
                <TableHead className="min-w-[72px] text-gray-600">Time In Selfie</TableHead>
                <TableHead className="whitespace-nowrap text-gray-600">Break Start</TableHead>
                <TableHead className="min-w-[72px] text-gray-600">Break Start Selfie</TableHead>
                <TableHead className="whitespace-nowrap text-gray-600">Break End</TableHead>
                <TableHead className="min-w-[72px] text-gray-600">Break End Selfie</TableHead>
                <TableHead className="whitespace-nowrap text-gray-600">Time Out</TableHead>
                <TableHead className="min-w-[72px] text-gray-600">Time Out Selfie</TableHead>
                <TableHead className="whitespace-nowrap text-gray-600">Total Hours</TableHead>
                <TableHead className="whitespace-nowrap text-gray-600">Break</TableHead>
                <TableHead className="whitespace-nowrap text-gray-600">Net Work</TableHead>
                <TableHead className="whitespace-nowrap text-gray-600">Late</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                filtered.map((r, idx) => {
                  const calc = calculateAttendance(r);
                  return (
                    <TableRow
                      key={r.id}
                      className={`hover:bg-gray-50 transition ${
                        idx % 2 === 1 ? "bg-gray-50/60" : "bg-white"
                      }`}
                    >
                      <TableCell className="px-4 py-3 text-sm font-medium">{r.employeeName}</TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums whitespace-nowrap text-muted-foreground">
                        {formatDate(r.date ?? r.time_in)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm hidden sm:table-cell text-muted-foreground">
                        {r.branch}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
                        {formatTime(r.time_in)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm align-middle">
                        <AttendanceSelfiePreview url={r.time_in_selfie} width={72} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
                        {formatTime(r.break_start)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm align-middle">
                        <AttendanceSelfiePreview url={r.break_start_selfie} width={72} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
                        {formatTime(r.break_end)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm align-middle">
                        <AttendanceSelfiePreview url={r.break_end_selfie} width={72} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">
                        {formatTime(r.time_out)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm align-middle">
                        <AttendanceSelfiePreview url={r.time_out_selfie} width={72} />
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">{calc.total}</TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">{calc.break}</TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">{calc.net}</TableCell>
                      <TableCell className="px-4 py-3 text-sm tabular-nums whitespace-nowrap">{calc.late}</TableCell>
                    </TableRow>
                  );
                })}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="text-center text-gray-500 py-10"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <span className="text-2xl" aria-hidden>
                        📄
                      </span>
                      <p className="text-sm font-medium text-gray-600">No attendance records yet</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void fetchAttendance()}
                      >
                        Refresh
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
