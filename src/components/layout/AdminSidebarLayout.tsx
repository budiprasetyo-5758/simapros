import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  FileText,
  CheckSquare,
  LogOut,
  User,
  Shield,
  UserCog,
  FileEdit,
  Settings,
  Users,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Building2,
  FolderCheck,
  UserCheck,
} from "lucide-react";
import logoImage from "@/assets/logo.jpeg";
import { cn } from "@/lib/utils";
import { useProjectEditRequests } from "@/hooks/useProjectEditRequests";
import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AdminSidebarLayoutProps {
  children: ReactNode;
}

const navItems = [
  { title: "Dashboard", icon: Home, path: "/" },
  { title: "Timeline", icon: CalendarDays, path: "/timeline" },
  { title: "Corporate Secretary", icon: FolderCheck, path: "/follow-up", superAdminOnly: true },
  { divider: true },
  { title: "Pengajuan Proyek", icon: FileText, path: "/admin-submit" },
  { title: "Antrean Approval", icon: CheckSquare, path: "/approval" },
  { title: "Permintaan Edit", icon: FileEdit, path: "/edit-requests", badgeKey: "editRequests" as const },
  { title: "Unit Kerja Request", icon: Users, path: "/unit-kerja-requests", badgeKey: "unitKerjaRequests" as const },
  { divider: true },
  { title: "Master PIC", icon: UserCheck, path: "/master-pic", superAdminOnly: true },
  { title: "Laporan Mingguan", icon: FileText, path: "/weekly-report" },
  { title: "Pengguna", icon: User, path: "/users" },
];

export function AdminSidebarLayout({ children }: AdminSidebarLayoutProps) {
  const { profile, signOut, user, isEmailVerified, isSuperAdmin, loading: authLoading } = useAuth();
  const { pendingCount } = useProjectEditRequests();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(true);
  const [unitKerjaRequestCount, setUnitKerjaRequestCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("unit_kerja_change_requests")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      setUnitKerjaRequestCount(count || 0);
    };
    fetchCount();
  }, [location.pathname]);

  useEffect(() => {
    if (!authLoading && user && !isEmailVerified) {
      navigate("/verification-pending");
    }
  }, [authLoading, user, isEmailVerified, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const badges: Record<string, number> = {
    editRequests: pendingCount,
    unitKerjaRequests: unitKerjaRequestCount,
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-primary text-primary-foreground transition-all duration-300 ease-in-out",
          collapsed ? "w-16" : "w-64",
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center gap-3 p-4 border-b border-primary-foreground/10",
            collapsed && "justify-center px-2",
          )}
        >
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0">
            <img src={logoImage} alt="SIMAPROS" className="w-full h-full object-cover" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="font-bold text-sm leading-tight">SIMAPROS</h1>
              <p className="text-[10px] opacity-70 truncate">Manajemen Proyek Strategis</p>
            </div>
          )}
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {navItems.map((item, index) => {
            if ("divider" in item && item.divider) {
              return <div key={`div-${index}`} className="my-2 border-t border-primary-foreground/10" />;
            }

            const { title, icon: Icon, path, badgeKey } = item as (typeof navItems)[0] & { badgeKey?: string };
            if (!path || !Icon) return null;

            if ("superAdminOnly" in item && item.superAdminOnly && !isSuperAdmin) return null;

            const isActive = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path!);
            const badgeCount = badgeKey ? badges[badgeKey] : 0;

            const linkContent = (
              <Link
                to={path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground shadow-sm"
                    : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{title}</span>
                    {badgeCount > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
                        {badgeCount}
                      </Badge>
                    )}
                  </>
                )}
                {collapsed && badgeCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" />
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={path} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <div className="relative">{linkContent}</div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {title}
                    {badgeCount > 0 && ` (${badgeCount})`}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={path}>{linkContent}</div>;
          })}
        </nav>

        {/* Bottom: User Info + Collapse */}
        <div className="border-t border-primary-foreground/10 p-3 space-y-2">
          {!collapsed && (
            <Link
              to="/profile"
              className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-primary-foreground/10 transition-colors"
            >
              <UserCog className="w-5 h-5 flex-shrink-0" />
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{profile?.name || "User"}</p>
                <p className="text-[10px] opacity-70">Super Admin</p>
              </div>
            </Link>
          )}
          <div className={cn("flex gap-1", collapsed ? "flex-col items-center" : "items-center")}>
            {collapsed ? (
              <>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link to="/profile" className="p-2 rounded-lg hover:bg-primary-foreground/10 transition-colors">
                      <UserCog className="w-5 h-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Profil</TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleSignOut}
                      className="p-2 rounded-lg hover:bg-primary-foreground/10 transition-colors"
                    >
                      <LogOut className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Keluar</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-1 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </Button>
            )}
          </div>
        </div>

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-primary border-2 border-background flex items-center justify-center hover:scale-110 transition-transform shadow-md"
        >
          {collapsed ? (
            <ChevronRight className="w-3 h-3 text-primary-foreground" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-primary-foreground" />
          )}
        </button>
      </aside>

      {/* Main Area */}
      <div
        className={cn("flex-1 flex flex-col transition-all duration-300 ease-in-out", collapsed ? "ml-16" : "ml-64")}
      >
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-card border-b border-border h-14 flex items-center justify-between px-6">
          <div />
          <div className="flex items-center gap-3">
            <NotificationDropdown />
            <Link
              to="/notification-settings"
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              title="Pengaturan"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
