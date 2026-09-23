import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Search, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useMasterProyek } from '@/hooks/useMasterProyek';
import { useEditRequestCounts } from '@/hooks/useEditRequestCounts';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { ProjectCard } from '@/components/dashboard/ProjectCard';
import { ProjectStatus } from '@/types/project';

export default function ManageProjects() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSuperAdmin, isProjectExecutor } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { masterProyek } = useMasterProyek();
  const { getCount } = useEditRequestCounts();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [masterFilter, setMasterFilter] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    // Only project executors and super admins can access
    if (!authLoading && user && !isProjectExecutor && !isSuperAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isProjectExecutor, isSuperAdmin, navigate]);

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (!isProjectExecutor && !isSuperAdmin)) return null;

  // For executors, only show approved/active projects
  const baseProjects = isProjectExecutor && !isSuperAdmin 
    ? projects.filter(p => p.status === 'approved' || p.status === 'active')
    : projects;

  const filteredProjects = baseProjects.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || 
                         p.requester_name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesMaster = masterFilter === 'all' || p.master_proyek_id === masterFilter;
    return matchesSearch && matchesStatus && matchesMaster;
  });

  const getMasterProyekName = (id?: string) => {
    if (!id) return null;
    const mp = masterProyek.find(m => m.id === id);
    return mp?.name;
  };

  // Group projects by master_proyek
  const groupedProjects = masterProyek.reduce((acc, mp) => {
    const projectsInGroup = filteredProjects.filter(p => p.master_proyek_id === mp.id);
    if (projectsInGroup.length > 0) {
      acc[mp.id] = { name: mp.name, projects: projectsInGroup };
    }
    return acc;
  }, {} as Record<string, { name: string; projects: typeof filteredProjects }>);

  // Projects without master_proyek
  const uncategorizedProjects = filteredProjects.filter(p => !p.master_proyek_id);

  return (
    <SimpleLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <Settings className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Kelola Proyek</h1>
              <p className="text-muted-foreground">Manajemen timeline dan fase proyek aktif</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 md:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari proyek..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            <Select value={masterFilter} onValueChange={setMasterFilter}>
              <SelectTrigger className="w-36 h-12">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Proyek</SelectItem>
                {masterProyek.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProjectStatus | 'all')}>
              <SelectTrigger className="w-36 h-12">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="approved">Aktif</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="revision">Revisi</SelectItem>
                <SelectItem value="rejected">Ditolak</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Grouped Projects by Master Proyek */}
        {Object.entries(groupedProjects).map(([id, group]) => (
          <div key={id} className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-sm font-semibold px-3 py-1">
                {group.name}
              </Badge>
              <span className="text-muted-foreground text-sm">({group.projects.length} proyek)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {group.projects.map((project) => (
                <ProjectCard 
                  key={project.id} 
                  project={project} 
                  showAdminNote={false}
                  compact
                  editRequestCount={getCount(project.id).total}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Uncategorized Projects */}
        {uncategorizedProjects.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm font-semibold px-3 py-1">
                Tanpa Kategori
              </Badge>
              <span className="text-muted-foreground text-sm">({uncategorizedProjects.length} proyek)</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {uncategorizedProjects.map((project) => (
                <ProjectCard 
                  key={project.id} 
                  project={project}
                  showAdminNote={false}
                  compact
                  editRequestCount={getCount(project.id).total}
                />
              ))}
            </div>
          </div>
        )}

        {filteredProjects.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <p className="text-muted-foreground">Tidak ada proyek ditemukan</p>
          </div>
        )}
      </div>
    </SimpleLayout>
  );
}
