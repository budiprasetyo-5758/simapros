import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Search, FolderKanban, PlayCircle, PauseCircle, CheckCircle2, Calendar, Building2, AlertTriangle, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Project, ProjectProgressStatus, MasterProyek } from '@/types/project';
import logoImage from '@/assets/logo.jpeg';

type PageState = 'loading' | 'invalid' | 'ready';

export default function PublicMonitoring() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [projects, setProjects] = useState<Project[]>([]);
  const [masterProyek, setMasterProyek] = useState<MasterProyek[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [masterFilter, setMasterFilter] = useState('all');
  const [progressFilter, setProgressFilter] = useState('all');

  // Validate token
  useEffect(() => {
    async function validate() {
      if (!token) { setPageState('invalid'); return; }
      const { data, error } = await supabase
        .from('monitoring_links' as any).select('id').eq('token', token).maybeSingle();
      if (error || !data) { setPageState('invalid'); return; }
      await fetchData();
      setPageState('ready');
    }
    validate();
  }, [token]);

  const fetchData = async () => {
    const [projRes, mpRes] = await Promise.all([
      supabase.from('projects').select('*, master_proyek:master_proyek_id(*)').in('status', ['approved', 'active']).order('created_at', { ascending: false }),
      supabase.from('master_proyek').select('*').order('name'),
    ]);
    setProjects((projRes.data as any[]) || []);
    setMasterProyek((mpRes.data as MasterProyek[]) || []);
  };

  // Filtering
  const filtered = useMemo(() => {
    let list = projects;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.unit.toLowerCase().includes(q) || p.requester_name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (masterFilter !== 'all') list = list.filter(p => p.master_proyek_id === masterFilter);
    if (progressFilter !== 'all') list = list.filter(p => p.progress_status === progressFilter);
    return list;
  }, [projects, searchQuery, masterFilter, progressFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: projects.length,
    in_progress: projects.filter(p => p.progress_status === 'in_progress').length,
    on_hold: projects.filter(p => p.progress_status === 'on_hold').length,
    completed: projects.filter(p => p.progress_status === 'completed').length,
  }), [projects]);

  const progressStatusConfig: Record<ProjectProgressStatus, { label: string; className: string; icon: typeof PlayCircle }> = {
    in_progress: { label: 'Aktif', className: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: PlayCircle },
    on_hold: { label: 'Pending', className: 'text-amber-600 bg-amber-50 border-amber-200', icon: PauseCircle },
    completed: { label: 'Selesai', className: 'text-blue-600 bg-blue-50 border-blue-200', icon: CheckCircle2 },
  };

  if (pageState === 'loading') return <Shell><div className="flex flex-col items-center py-20 gap-4"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /><p className="text-slate-500">Memuat dashboard...</p></div></Shell>;
  if (pageState === 'invalid') return <Shell><div className="flex flex-col items-center py-16 gap-4 text-center"><div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="w-8 h-8 text-red-500" /></div><h2 className="text-2xl font-bold text-slate-800">Link Tidak Valid</h2><p className="text-slate-500 max-w-md">Link monitoring ini tidak valid atau sudah kedaluwarsa.</p></div></Shell>;

  return (
    <Shell>
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Proyek" value={stats.total} icon={<FolderKanban className="w-5 h-5" />} color="text-blue-600 bg-blue-50" />
        <StatCard label="Aktif" value={stats.in_progress} icon={<PlayCircle className="w-5 h-5" />} color="text-emerald-600 bg-emerald-50"
          active={progressFilter === 'in_progress'} onClick={() => setProgressFilter(progressFilter === 'in_progress' ? 'all' : 'in_progress')} />
        <StatCard label="Pending" value={stats.on_hold} icon={<PauseCircle className="w-5 h-5" />} color="text-amber-600 bg-amber-50"
          active={progressFilter === 'on_hold'} onClick={() => setProgressFilter(progressFilter === 'on_hold' ? 'all' : 'on_hold')} />
        <StatCard label="Selesai" value={stats.completed} icon={<CheckCircle2 className="w-5 h-5" />} color="text-blue-600 bg-blue-50"
          active={progressFilter === 'completed'} onClick={() => setProgressFilter(progressFilter === 'completed' ? 'all' : 'completed')} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Cari proyek..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-10 bg-white border-slate-200" />
        </div>
        <Select value={masterFilter} onValueChange={setMasterFilter}>
          <SelectTrigger className="w-full sm:w-[200px] h-10 bg-white border-slate-200">
            <SelectValue placeholder="Semua Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {masterProyek.map(mp => <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Project Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Tidak ada proyek yang ditemukan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(project => {
            const ps = progressStatusConfig[project.progress_status || 'in_progress'];
            const Icon = ps.icon;
            return (
              <button key={project.id}
                onClick={() => navigate(`/monitor/${token}/project/${project.id}`)}
                className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:shadow-lg hover:border-blue-200 transition-all duration-200 group">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {project.master_proyek && (
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        <FolderKanban className="w-3 h-3 mr-0.5" />{project.master_proyek.name}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${ps.className}`}>
                      <Icon className="w-3 h-3 mr-0.5" />{ps.label}
                    </Badge>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0 mt-0.5" />
                </div>
                <h3 className="font-semibold text-slate-800 mb-2 line-clamp-2 group-hover:text-blue-700 transition-colors">{project.title}</h3>
                {project.monev_summary ? (
                  <ul className="text-xs text-slate-500 mb-3 space-y-0.5">
                    {project.monev_summary.split(/\n|•/).map(s => s.trim()).filter(s => s.length > 0).slice(0, 2).map((point, i) => (
                      <li key={i} className="flex items-start gap-1.5 leading-tight">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                        <span className="line-clamp-1">{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-400 italic mb-3">Belum ada rangkuman monev</p>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{project.unit}</span>
                  {project.start_date && project.end_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(parseISO(project.start_date), 'd MMM', { locale: localeId })} – {format(parseISO(project.end_date), 'd MMM yy', { locale: localeId })}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

// ─── Helper Components ──────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm"><img src={logoImage} alt="SIMAPROS" className="w-full h-full object-cover" /></div>
          <div>
            <h1 className="font-bold text-sm text-slate-800">SIMAPROS</h1>
            <p className="text-[10px] text-slate-500">Dashboard Monitoring Proyek</p>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-slate-400 py-6">© {new Date().getFullYear()} SIMAPROS — Sistem Manajemen Proyek Strategis</footer>
    </div>
  );
}

function StatCard({ label, value, icon, color, active, onClick }: {
  label: string; value: number; icon: React.ReactNode; color: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`bg-white border rounded-xl p-4 flex items-center gap-3 transition-all ${active ? 'ring-2 ring-blue-400 border-blue-300 shadow-sm' : 'border-slate-200'} ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}>
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div className="text-left">
        <div className="text-2xl font-bold text-slate-800">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </button>
  );
}
