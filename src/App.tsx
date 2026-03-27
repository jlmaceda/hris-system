import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { SupabaseProvider } from "@/lib/supabase-provider";
import { ThemeProvider } from "@/lib/theme";
import LoginPage from "@/pages/LoginPage";
import AppLayout from "@/components/AppLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import EmployeesPage from "@/pages/admin/EmployeesPage";
import AttendancePage from "@/pages/admin/AttendancePage";
import PayrollPage from "@/pages/admin/PayrollPage";
import CompensationPage from "@/pages/admin/CompensationPage";
import OrgChartPage from "@/pages/admin/OrgChartPage";
import CompanyProfilePage from "@/pages/admin/CompanyProfilePage";
import ReportsPage from "@/pages/admin/ReportsPage";
import EmployeeDashboard from "@/pages/employee/EmployeeDashboard";
import MyAttendancePage from "@/pages/employee/MyAttendancePage";
import PayslipPage from "@/pages/employee/PayslipPage";
import ProfilePage from "@/pages/employee/ProfilePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (user.role === "admin") {
    return (
      <Routes>
        <Route path="/admin" element={<AppLayout role="admin"><AdminDashboard /></AppLayout>} />
        <Route path="/admin/employees" element={<AppLayout role="admin"><EmployeesPage /></AppLayout>} />
        <Route path="/admin/attendance" element={<AppLayout role="admin"><AttendancePage /></AppLayout>} />
        <Route path="/admin/payroll" element={<AppLayout role="admin"><PayrollPage /></AppLayout>} />
        <Route path="/admin/compensation" element={<AppLayout role="admin"><CompensationPage /></AppLayout>} />
        <Route path="/admin/org-chart" element={<AppLayout role="admin"><OrgChartPage /></AppLayout>} />
        <Route path="/admin/company" element={<AppLayout role="admin"><CompanyProfilePage /></AppLayout>} />
        <Route path="/admin/reports" element={<AppLayout role="admin"><ReportsPage /></AppLayout>} />
        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/employee" element={<AppLayout role="employee"><EmployeeDashboard /></AppLayout>} />
      <Route path="/employee/attendance" element={<AppLayout role="employee"><MyAttendancePage /></AppLayout>} />
      <Route path="/employee/payslip" element={<AppLayout role="employee"><PayslipPage /></AppLayout>} />
      <Route path="/employee/profile" element={<AppLayout role="employee"><ProfilePage /></AppLayout>} />
      <Route path="/" element={<Navigate to="/employee" replace />} />
      <Route path="*" element={<Navigate to="/employee" replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <SupabaseProvider>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </TooltipProvider>
      </SupabaseProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
