import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebarLayout } from '@/components/layout/AdminSidebarLayout';
import { useAuth } from '@/hooks/useAuth';
import { FolderCheck, Users, UserCog, MoreHorizontal } from 'lucide-react';

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
