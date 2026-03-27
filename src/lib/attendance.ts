import type { AuthUser } from "@/lib/auth-types";

/**
 * `employees.id` for attendance / storage. Same as `useAuth().employeeId` and `useEmployeeProfile()?.id`.
 */
export function getEmployeeIdForAttendance(user: AuthUser | null): string | null {
  const id = user?.id?.trim();
  return id || null;
}
