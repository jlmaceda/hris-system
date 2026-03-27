/**
 * Snapshot of the signed-in row from `employees` (loaded after auth via email).
 * Use `id` everywhere Supabase expects `employee_id` (attendance, storage, etc.).
 */
export interface AuthUser {
  id: string;
  /** Email as stored on `employees` (fallback: session email) */
  email: string;
  role: "admin" | "employee";
  name: string;
}
