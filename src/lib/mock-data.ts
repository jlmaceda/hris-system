export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  branch: string;
  dailyRate: number;
  role: "admin" | "employee";
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  branch: string;
  date: string;
  timeIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  timeOut: string | null;
  selfieUrl?: string;
}

export interface Allowance {
  id: string;
  name: string;
  amount: number;
  type: string;
}

export interface Benefit {
  id: string;
  name: string;
  description: string;
}

export interface Deduction {
  id: string;
  name: string;
  amount: number;
  type: string;
}

export const branches = ["Main Branch", "North Branch", "South Branch", "East Branch"];

export const employees: Employee[] = [
  { id: "1", firstName: "Maria", lastName: "Santos", email: "maria.santos@fitnessdepot.com", position: "Fitness Trainer", branch: "Main Branch", dailyRate: 850, role: "employee" },
  { id: "2", firstName: "Carlos", lastName: "Reyes", email: "carlos.reyes@fitnessdepot.com", position: "Branch Manager", branch: "North Branch", dailyRate: 1200, role: "admin" },
  { id: "3", firstName: "Ana", lastName: "Cruz", email: "ana.cruz@fitnessdepot.com", position: "Receptionist", branch: "Main Branch", dailyRate: 650, role: "employee" },
  { id: "4", firstName: "Miguel", lastName: "Garcia", email: "miguel.garcia@fitnessdepot.com", position: "Personal Trainer", branch: "South Branch", dailyRate: 900, role: "employee" },
  { id: "5", firstName: "Isabella", lastName: "Dela Cruz", email: "isabella.dc@fitnessdepot.com", position: "Gym Instructor", branch: "East Branch", dailyRate: 750, role: "employee" },
  { id: "6", firstName: "Rafael", lastName: "Mendoza", email: "rafael.m@fitnessdepot.com", position: "Operations Head", branch: "Main Branch", dailyRate: 1500, role: "admin" },
];

export const attendanceRecords: AttendanceRecord[] = [
  { id: "1", employeeId: "1", employeeName: "Maria Santos", branch: "Main Branch", date: "2026-03-22", timeIn: "08:02", breakStart: "12:00", breakEnd: "13:00", timeOut: "17:05" },
  { id: "2", employeeId: "2", employeeName: "Carlos Reyes", branch: "North Branch", date: "2026-03-22", timeIn: "07:55", breakStart: "12:15", breakEnd: "13:10", timeOut: "17:00" },
  { id: "3", employeeId: "3", employeeName: "Ana Cruz", branch: "Main Branch", date: "2026-03-22", timeIn: "08:30", breakStart: null, breakEnd: null, timeOut: null },
  { id: "4", employeeId: "4", employeeName: "Miguel Garcia", branch: "South Branch", date: "2026-03-22", timeIn: "08:10", breakStart: "12:00", breakEnd: "12:45", timeOut: null },
  { id: "5", employeeId: "5", employeeName: "Isabella Dela Cruz", branch: "East Branch", date: "2026-03-22", timeIn: null, breakStart: null, breakEnd: null, timeOut: null },
];

export const allowances: Allowance[] = [
  { id: "1", name: "Transportation", amount: 1500, type: "Monthly" },
  { id: "2", name: "Meal", amount: 1000, type: "Monthly" },
  { id: "3", name: "Rice Subsidy", amount: 2000, type: "Monthly" },
];

export const benefits: Benefit[] = [
  { id: "1", name: "SSS", description: "Social Security System" },
  { id: "2", name: "PhilHealth", description: "Philippine Health Insurance" },
  { id: "3", name: "Pag-IBIG", description: "Home Development Mutual Fund" },
];

export const deductions: Deduction[] = [
  { id: "1", name: "SSS Contribution", amount: 900, type: "Monthly" },
  { id: "2", name: "PhilHealth", amount: 400, type: "Monthly" },
  { id: "3", name: "Pag-IBIG", amount: 200, type: "Monthly" },
  { id: "4", name: "Tax", amount: 1250, type: "Monthly" },
];
