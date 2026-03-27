import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { fetchEmployeeByEmail } from "@/lib/employee-auth";
import { useSupabase } from "@/lib/supabase-provider";
import type { AuthUser } from "@/lib/auth-types";

export type { AuthUser };

interface AuthContextType {
  /** Full `employees` row fields needed for the session (`id`, `email`, `role`, …). */
  user: AuthUser | null;
  /**
   * Same as `user?.id` when logged in — the DB primary key for `employee_id`.
   * `null` only when `user` is `null`.
   */
  employeeId: string | null;
  login: (user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  employeeId: null,
  login: () => {},
  logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

/**
 * Employee routes: the signed-in `employees` row. Prefer `employee.id` for `employee_id` in attendance.
 * Returns `null` only if there is no valid profile (should not happen on `/employee` after a good login).
 */
export function useEmployeeProfile(): AuthUser | null {
  const { user } = useAuth();
  if (!user?.id?.trim()) return null;
  return user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useSupabase();
  const [user, setUser] = useState<AuthUser | null>(null);

  const login = (nextUser: AuthUser) => {
    if (!nextUser.id?.trim()) {
      return;
    }
    setUser(nextUser);
  };

  const logout = () => {
    void supabase.auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    let cancelled = false;

    async function applySession(session: Session | null) {
      const email = session?.user?.email;
      if (!email) {
        if (!cancelled) setUser(null);
        return;
      }
      const { user: authUser, error } = await fetchEmployeeByEmail(email);
      if (cancelled) return;
      if (error || !authUser) {
        await supabase.auth.signOut();
        setUser(null);
        return;
      }
      setUser(authUser);
    }

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) void applySession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) void applySession(session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <AuthContext.Provider
      value={{
        user,
        employeeId: user?.id?.trim() ? user.id.trim() : null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
