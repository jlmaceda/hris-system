import { supabase } from "@/lib/supabaseClient";

export type EmployeeRole = "admin" | "employee";

export interface AddEmployeePayload {
  first_name: string;
  last_name: string;
  email: string;
  position: string;
  role: EmployeeRole;
  daily_rate: number;
  password: string;
}

export interface EmployeeListItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  role: EmployeeRole;
  dailyRate: number | null;
}

function mapRowToListItem(row: Record<string, unknown>): EmployeeListItem | null {
  const id = row.id != null ? String(row.id) : "";
  if (!id) return null;
  const firstName =
    (typeof row.first_name === "string" && row.first_name) ||
    (typeof row.firstName === "string" && row.firstName) ||
    "";
  const lastName =
    (typeof row.last_name === "string" && row.last_name) ||
    (typeof row.lastName === "string" && row.lastName) ||
    "";
  const email = typeof row.email === "string" ? row.email : "";
  const position = typeof row.position === "string" ? row.position : "";
  const rawRole = typeof row.role === "string" ? row.role.toLowerCase() : "";
  const role = rawRole === "admin" || rawRole === "employee" ? rawRole : "employee";
  const dailyRate =
    typeof row.daily_rate === "number"
      ? row.daily_rate
      : typeof row.daily_rate === "string" && row.daily_rate.trim()
        ? Number(row.daily_rate)
        : null;

  const safeDailyRate = Number.isFinite(dailyRate) ? dailyRate : null;
  return { id, firstName, lastName, email, position, role, dailyRate: safeDailyRate };
}

export async function addEmployee(
  payload: AddEmployeePayload
): Promise<{ data: EmployeeListItem | null; error: Error | null }> {
  const { error: authError } = await supabase.auth.signUp({
    email: payload.email,
    password: payload.password,
  });

  if (authError) {
    return { data: null, error: new Error(authError.message) };
  }

  const row = {
    first_name: payload.first_name,
    last_name: payload.last_name,
    email: payload.email,
    role: payload.role,
    position: payload.position,
    daily_rate: payload.daily_rate,
  };

  const { data, error: insertError } = await supabase.from("employees").insert(row).select("*").single();

  if (insertError) {
    return { data: null, error: new Error(insertError.message) };
  }

  const item = data ? mapRowToListItem(data as Record<string, unknown>) : null;
  return { data: item, error: null };
}

export async function getEmployees(options?: { branch?: string }): Promise<{ data: EmployeeListItem[]; error: Error | null }> {
  const branch = options?.branch?.trim() || "";

  let q = supabase.from("employees").select("*");
  if (branch) q = q.eq("branch", branch);

  const { data, error } = await q.order("created_at", { ascending: false });

  if (error) {
    return { data: [], error: new Error(error.message) };
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const items = rows.map(mapRowToListItem).filter((x): x is EmployeeListItem => x != null);
  return { data: items, error: null };
}
