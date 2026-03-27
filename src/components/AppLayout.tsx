import { NavLink as RRNavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth-context";
import { Dumbbell, LayoutDashboard, Users, Clock, DollarSign, Gift, Network, Building2, LogOut, FileText, UserCircle, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const adminLinks = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/employees", icon: Users, label: "Employees" },
  { to: "/admin/attendance", icon: Clock, label: "Attendance" },
  { to: "/admin/payroll", icon: DollarSign, label: "Payroll" },
  { to: "/admin/reports", icon: FileText, label: "Reports" },
  { to: "/admin/compensation", icon: Gift, label: "Compensation" },
  { to: "/admin/org-chart", icon: Network, label: "Org Chart" },
  { to: "/admin/company", icon: Building2, label: "Company Profile" },
];

const employeeLinks = [
  { to: "/employee", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/employee/attendance", icon: Clock, label: "My Attendance" },
  { to: "/employee/payslip", icon: FileText, label: "Payslip" },
  { to: "/employee/profile", icon: UserCircle, label: "Profile" },
];

export default function AppLayout({ children, role }: { children: React.ReactNode; role: "admin" | "employee" }) {
  const { logout, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const location = useLocation();
  const links = role === "admin" ? adminLinks : employeeLinks;

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      // Allows us to show our own install button.
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    try {
      const choice = await installPrompt.userChoice;
      console.log("PWA install choice:", choice.outcome);
    } finally {
      // Chrome fires beforeinstallprompt only once per “eligibility window”.
      setInstallPrompt(null);
    }
  }

  return (
    <div className="min-h-screen flex bg-gray-100 text-gray-900 dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 dark:text-gray-100">
      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-foreground/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:translate-x-0 dark:bg-black",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5 flex items-center gap-3 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Dumbbell className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm text-sidebar-accent-foreground truncate">AttendTrack</p>
            <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider">Fitness Depot</p>
          </div>
          <button className="lg:hidden ml-auto text-sidebar-foreground" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
          {links.map(link => {
            const isActive = location.pathname === link.to || (link.to !== "/admin" && link.to !== "/employee" && location.pathname.startsWith(link.to));
            const exactActive = location.pathname === link.to;
            return (
              <RRNavLink
                key={link.to}
                to={link.to}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  (exactActive || isActive) ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <link.icon className="h-4 w-4 shrink-0" />
                <span>{link.label}</span>
              </RRNavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors w-full">
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-14 bg-white/80 dark:bg-gray-900/70 backdrop-blur border-b border-gray-200 dark:border-gray-700 flex items-center px-4 gap-3">
          <button className="lg:hidden p-1.5 rounded-md hover:bg-muted transition-colors" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            {installPrompt && (
              <button
                type="button"
                onClick={() => void handleInstallClick()}
                className="hidden sm:inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Install App
              </button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </Button>
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {user?.name?.charAt(0) || "U"}
            </div>
            <span className="text-sm font-medium hidden sm:block">{user?.name}</span>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
