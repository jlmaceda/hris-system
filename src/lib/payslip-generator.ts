import jsPDF from "jspdf";

export type PayslipPayrollData = {
  totalDays: number;
  totalHours: number;
  gross: number;
  allowances: number;
  deductions: number;
  net: number;
  cutoffStart?: string;
  cutoffEnd?: string;
};

type AnyEmployee = Record<string, unknown> & {
  id?: string | number | null;
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role?: string | null;
  position?: string | null;
};

function pickString(...values: Array<string | null | undefined>) {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "—";
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    // Keep output ASCII to avoid jsPDF default font/encoding issues.
    currencyDisplay: "code",
  }).format(value);

export function generatePayslip(employee: AnyEmployee, records: unknown[], payrollData: PayslipPayrollData) {
  const doc = new jsPDF();

  const employeeId = pickString(employee.id != null ? String(employee.id) : null);
  const firstName = pickString(employee.first_name, employee.firstName);
  const lastName = pickString(employee.last_name, employee.lastName);
  const position = pickString(employee.position, employee.role);

  const totalDays = payrollData.totalDays ?? records.length;
  const totalHours = toNumber(payrollData.totalHours);
  const gross = toNumber(payrollData.gross);
  const allowances = toNumber(payrollData.allowances);
  const deductions = toNumber(payrollData.deductions);
  const net = toNumber(payrollData.net);

  doc.setFontSize(16);
  doc.text("FITNESS DEPOT PAYSLIP", 20, 20);

  doc.setFontSize(12);
  doc.text(`Employee: ${firstName} ${lastName}`, 20, 40);
  doc.text(`Position: ${position}`, 20, 50);

  if (payrollData.cutoffStart && payrollData.cutoffEnd) {
    doc.text(`Cutoff: ${payrollData.cutoffStart} - ${payrollData.cutoffEnd}`, 20, 62);
  }

  doc.text(`Total Days: ${totalDays}`, 20, 74);
  const totalHoursText = String(totalHours.toLocaleString(undefined, { maximumFractionDigits: 2 }));
  doc.text(`Total Hours: ${totalHoursText}`, 20, 84);

  // jsPDF: always pass plain strings (no custom encoding/character mapping).
  const grossText = String(formatCurrency(gross));
  const allowancesText = String(formatCurrency(allowances));
  const deductionsText = String(formatCurrency(deductions));
  const netText = String(formatCurrency(net));

  doc.text(`Gross Pay: ${grossText}`, 20, 104);
  doc.text(`Allowances: ${allowancesText}`, 20, 114);
  doc.text(`Deductions: ${deductionsText}`, 20, 124);
  doc.text(`Net Pay: ${netText}`, 20, 134);

  doc.save(`payslip-${employeeId}.pdf`);
}

