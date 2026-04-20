import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ClipboardList,
  CalendarDays
} from 'lucide-react';
import logoImage from '@/assets/logo.jpeg';
import { cn } from '@/lib/utils';
import { NotificationDropdown } from '@/components/notifications/NotificationDropdown';
import { AdminSidebarLayout } from './AdminSidebarLayout';

interface SimpleLayoutProps {
  children: ReactNode;
}

export function SimpleLayout({ children }: SimpleLayoutProps) {
  const { profile, isSuperAdmin, isProjectExecutor, signOut, user, isEmailVerified, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Verification gate
  useEffect(() => {
    if (!authLoading && user && !isEmailVerified) {
      navigate('/verification-pending');
    }
  }, [authLoading, user, isEmailVerified, navigate]);

  // Super Admin uses sidebar layout
  if (isSuperAdmin) {
    return <AdminSidebarLayout>{children}</AdminSidebarLayout>;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getRoleDisplay = () => {
    if (isProjectExecutor) return 'Eksekutor';
    return 'User';
  };

  const getNavItems = () => {
    if (isProjectExecutor) {
      return [
        { title: 'Kelola Proyek', icon: ClipboardList, path: '/' },
        { title: 'Ajukan Proyek', icon: FileText, path: '/submit' },
      ];
    }
    return [
      { title: 'Dashboard', icon: Home, path: '/' },
      { title: 'Ajukan Proyek', icon: FileText, path: '/submit' },
    ];
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center">
                <img src={logoImage} alt="SIMAPROS Logo" className="w-full h-full object-cover" />
              </div>
              <div>
                <h1 className="font-bold text-lg">SIMAPROS</h1>
                <p className="text-xs opacity-80">Manajemen Proyek Strategis</p>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <Link
                to="/notification-settings"
                className="p-2 rounded-lg bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
                title="Pengaturan"
              >
                <Settings className="w-5 h-5" />
              </Link>
              <Link
                to="/profile"
                className="hidden sm:flex items-center gap-2 bg-primary-foreground/10 px-4 py-2 rounded-lg hover:bg-primary-foreground/20 transition-colors"
              >
                <UserCog className="w-5 h-5" />
                <div className="text-sm">
                  <p className="font-medium">{profile?.name || 'User'}</p>
                  <p className="text-xs opacity-80">{getRoleDisplay()}</p>
                </div>
              </Link>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Keluar</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 items-center">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.title}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
