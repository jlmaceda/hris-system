import { useEffect, useState, useCallback } from "react";
import { useEmployeeProfile } from "@/lib/auth-context";
import { supabase } from "@/lib/supabaseClient";
import { AttendanceSelfiePreview } from "@/components/AttendanceSelfiePreview";
import { formatDate, formatTime } from "@/lib/datetime-format";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AttendanceRow = {
  id: string;
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

export default function MyAttendancePage() {
  const employee = useEmployeeProfile();
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttendance = useCallback(async () => {
    if (!employee?.id) return;

    setLoading(true);
    try {
      console.log("EMPLOYEE ID:", employee.id);

      let { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", employee.id)
        .order("date", { ascending: false });

      if (error?.message?.toLowerCase().includes("date")) {
        const fallback = await supabase
          .from("attendance")
          .select("*")
          .eq("employee_id", employee.id)
          .order("created_at", { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }

      console.log("ATTENDANCE DATA:", data);

      if (error) {
        console.error("Attendance fetch error:", error);
        setRecords([]);
        return;
      }

      setRecords((data as AttendanceRow[]) || []);
    } finally {
      setLoading(false);
    }
  }, [employee?.id]);

  useEffect(() => {
    void fetchAttendance();
  }, [fetchAttendance]);

  if (!employee?.id) {
    return (
      <div className="space-y-4 max-w-md">
        <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
        <p className="text-sm text-muted-foreground">Sign in as an employee to view your attendance.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">My Attendance</h1>
      <Card className="border-0 shadow-sm animate-fade-up">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[7.5rem]">Date</TableHead>
                <TableHead>Time In</TableHead>
                <TableHead>Time In Selfie</TableHead>
                <TableHead>Break Start</TableHead>
                <TableHead>Break Start Selfie</TableHead>
                <TableHead>Break End</TableHead>
                <TableHead>Break End Selfie</TableHead>
                <TableHead>Time Out</TableHead>
                <TableHead>Time Out Selfie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {formatDate(record.date ?? record.time_in)}
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">{formatTime(record.time_in)}</TableCell>
                    <TableCell className="align-top py-3">
                      <AttendanceSelfiePreview url={record.time_in_selfie} width={60} />
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">{formatTime(record.break_start)}</TableCell>
                    <TableCell className="align-top py-3">
                      <AttendanceSelfiePreview url={record.break_start_selfie} width={60} />
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">{formatTime(record.break_end)}</TableCell>
                    <TableCell className="align-top py-3">
                      <AttendanceSelfiePreview url={record.break_end_selfie} width={60} />
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">{formatTime(record.time_out)}</TableCell>
                    <TableCell className="align-top py-3">
                      <AttendanceSelfiePreview url={record.time_out_selfie} width={60} />
                    </TableCell>
                  </TableRow>
                ))}
              {!loading && records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No records
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
