import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebarLayout } from '@/components/layout/AdminSidebarLayout';
import { useAuth } from '@/hooks/useAuth';
import { useTindakLanjutStats } from '@/hooks/useTindakLanjut';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderCheck, Users, UserCog, MoreHorizontal, CheckCircle2, CircleDashed, LayoutDashboard } from 'lucide-react';

const categories = [
  {
    key: 'rapimtas',
    title: 'Rapimtas',
    subtitle: 'Rapat Pimpinan Terbatas',
    icon: UserCog,
    color: 'bg-blue-500',
  },
  {
    key: 'rapim',
    title: 'Rapim',
    subtitle: 'Rapat Pimpinan',
    icon: Users,
    color: 'bg-emerald-500',
  },
  {
    key: 'others',
    title: 'Others',
    subtitle: 'Lainnya',
    icon: MoreHorizontal,
    color: 'bg-amber-500',
  },
];

export default function FollowUp() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { stats, isLoading: statsLoading } = useTindakLanjutStats();

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      navigate('/');
    }
  }, [authLoading, isSuperAdmin, navigate]);

  if (authLoading) return null;

  return (
    <AdminSidebarLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FolderCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-followup-title">Follow Up</h1>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center gap-4 bg-indigo-50 border-indigo-100 dark:bg-indigo-950/20 dark:border-indigo-900">
            <div className="p-3 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-full">
              <LayoutDashboard className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Tindak Lanjut</p>
              {statsLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <h3 className="text-2xl font-bold">{stats.total}</h3>}
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900">
            <div className="p-3 bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400 rounded-full">
              <CircleDashed className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status Open</p>
              {statsLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <h3 className="text-2xl font-bold">{stats.open}</h3>}
            </div>
          </Card>
          <Card className="p-4 flex items-center gap-4 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900">
            <div className="p-3 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 rounded-full">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status Closed</p>
              {statsLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <h3 className="text-2xl font-bold">{stats.closed}</h3>}
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.key}
                data-testid={`card-folder-${cat.key}`}
                onClick={() => navigate(`/follow-up/${cat.key}`)}
                className="group relative bg-card border border-border rounded-xl overflow-hidden text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-1"
              >
                <div className={`${cat.color} h-3 w-full`} />
                <div className="p-6 space-y-3">
                  <div className={`${cat.color} w-12 h-12 rounded-xl flex items-center justify-center`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{cat.title}</h3>
                    <p className="text-sm text-muted-foreground">{cat.subtitle}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </AdminSidebarLayout>
  );
}
