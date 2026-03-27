import * as XLSX from "xlsx";

export const exportToExcel = (data: any[], fileName: string) => {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

  XLSX.writeFile(workbook, `${fileName}.xlsx`);
};

export const exportAttendanceExcel = (records: any[]) => {
  if (!records || records.length === 0) {
    alert("No data to export");
    return;
  }

  const wb = XLSX.utils.book_new();

  const wsData = [
    [
      "Employee",
      "Date",
      "Time In",
      "Time In Selfie",
      "Break Start",
      "Break Start Selfie",
      "Break End",
      "Break End Selfie",
      "Time Out",
      "Time Out Selfie",
    ],
  ];

  records.forEach((r) => {
    wsData.push([
      r.employee_name ?? r.employeeName ?? "—",
      r.date ?? "—",
      r.time_in ?? "—",
      "View Photo",
      r.break_start ?? "—",
      "View Photo",
      r.break_end ?? "—",
      "View Photo",
      r.time_out ?? "—",
      "View Photo",
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Add hyperlinks to the "View Photo" cells.
  records.forEach((r, index) => {
    const rowIndex = index + 2; // Excel rows start at 1; header is row 1

    const setLink = (col: number, url: unknown) => {
      if (!url) return;
      const urlStr = String(url).trim();
      if (!urlStr) return;

      const cell = XLSX.utils.encode_cell({ r: rowIndex - 1, c: col });
      if (!ws[cell]) return;

      ws[cell].l = { Target: urlStr };
      ws[cell].s = {
        font: { color: { rgb: "0000FF" }, underline: true },
      };
    };

    // Column indices: 0..9
    setLink(3, r.time_in_selfie);
    setLink(5, r.break_start_selfie);
    setLink(7, r.break_end_selfie);
    setLink(9, r.time_out_selfie);
  });

  // Auto column width
  ws["!cols"] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
    { wch: 12 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Attendance");
  XLSX.writeFile(wb, "attendance-report.xlsx");
};

export const exportPayrollExcel = (rows: any[]) => {
  if (!rows || rows.length === 0) {
    alert("No payroll data to export");
    return;
  }

  const wsData = [
    [
      "Employee",
      "Branch",
      "Cutoff",
      "Total Days",
      "Total Hours",
      "Gross Pay",
      "Allowances",
      "Deductions",
      "Net Pay",
    ],
  ];

  rows.forEach((r) => {
    wsData.push([
      r.employee,
      r.branch,
      r.cutoff,
      r.days,
      r.hours,
      r.gross,
      r.allowances,
      r.deductions,
      r.net,
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws["!cols"] = [
    { wch: 20 },
    { wch: 15 },
    { wch: 25 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Payroll");

  XLSX.writeFile(wb, "payroll-report.xlsx");
};

