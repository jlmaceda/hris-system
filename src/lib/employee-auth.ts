import { supabase } from "@/lib/supabaseClient";
import type { AuthUser } from "@/lib/auth-types";

/** Normalize for case-insensitive lookup against `employees.email`. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayNameFromRow(row: Record<string, unknown>, fallbackEmail: string): string {
  const first =
    (typeof row.first_name === "string" && row.first_name) ||
    (typeof row.firstName === "string" && row.firstName) ||
    "";
  const last =
    (typeof row.last_name === "string" && row.last_name) ||
    (typeof row.lastName === "string" && row.lastName) ||
    "";
  const combined = [first, last].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  if (typeof row.name === "string" && row.name.trim()) return row.name.trim();
  return fallbackEmail.split("@")[0] || fallbackEmail;
}

export function rowToAuthUser(row: Record<string, unknown> | null, sessionEmail: string): AuthUser | null {
  if (!row) return null;
  const id = row.id != null ? String(row.id).trim() : "";
  if (!id) return null;
  const raw = row.role;
  const role = typeof raw === "string" ? raw.toLowerCase() : "";
  if (role !== "admin" && role !== "employee") return null;

  const rowEmail = typeof row.email === "string" ? row.email.trim() : "";
  const email = rowEmail || sessionEmail.trim();

  return {
    id,
    email,
    role,
    name: displayNameFromRow(row, email),
  };
}

/**
 * Load the `employees` row for the signed-in account (match by email, case-insensitive).
 * `AuthUser.id` is the primary key to use as `employee_id` in attendance and storage.
 */
export async function fetchEmployeeByEmail(
  email: string
): Promise<{ user: AuthUser | null; error: Error | null }> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { user: null, error: new Error("Email is required") };
  }

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .ilike("email", normalized)
    .maybeSingle();

  if (error) {
    return { user: null, error: new Error(error.message) };
  }

  const row = data as Record<string, unknown> | null | undefined;
  return { user: rowToAuthUser(row ?? null, email.trim()), error: null };
}

/** @deprecated Use `fetchEmployeeByEmail` */
export const fetchEmployeeAuthUser = fetchEmployeeByEmail;
