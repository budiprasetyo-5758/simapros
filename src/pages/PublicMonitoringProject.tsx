import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, Building2, User, Calendar, FileText, ExternalLink, AlertTriangle, FolderKanban, PlayCircle, PauseCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { SpreadsheetGantt } from '@/components/project/SpreadsheetGantt';
import { Project, GanttTask, ProjectProgressStatus } from '@/types/project';
import { cn } from '@/lib/utils';
import logoImage from '@/assets/logo.jpeg';

type PageState = 'loading' | 'invalid' | 'not_found' | 'ready';

const progressStatusConfig: Record<ProjectProgressStatus, { label: string; className: string; icon: typeof PlayCircle }> = {
  in_progress: { label: 'Aktif', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: PlayCircle },
  on_hold: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: PauseCircle },
  completed: { label: 'Selesai', className: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
};

export default function PublicMonitoringProject() {
  const { token, projectId } = useParams<{ token: string; projectId: string }>();
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<GanttTask[]>([]);

  useEffect(() => {
    async function load() {
      if (!token || !projectId) { setPageState('invalid'); return; }
      // Validate token
      const { data: linkData } = await supabase.from('monitoring_links' as any).select('id').eq('token', token).maybeSingle();
      if (!linkData) { setPageState('invalid'); return; }
      // Fetch project
      const { data: projData } = await supabase.from('projects').select('*, master_proyek:master_proyek_id(*)').eq('id', projectId).maybeSingle();
      if (!projData) { setPageState('not_found'); return; }
      setProject(projData as any);
      // Fetch tasks
      const { data: taskData } = await supabase.from('gantt_tasks').select('*').eq('project_id', projectId).order('created_at');
      const mapped: GanttTask[] = (taskData || []).map((t: any) => ({
        id: t.id, project_id: t.project_id, name: t.name, description: t.description || '',
        pic: t.pic || '', start_date: t.start_date, end_date: t.end_date, progress: t.progress || 0,
        status: t.status || 'not_started', wbs_number: t.wbs_number || '', monev: t.monev || '',
        phase: t.phase || '', parent_task_id: t.parent_task_id || null,
        deliverable_result: t.deliverable_result || '', problem: t.problem || '',
      }));
      setTasks(mapped);
      setPageState('ready');
    }
    load();
  }, [token, projectId]);

  // Dummy handlers (read-only, never called)
  const noop = async () => ({ success: false });
  const noopDelete = async () => ({ success: false });

  if (pageState === 'loading') {
    return <Shell token={token}><div className="flex flex-col items-center py-20 gap-4"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /><p className="text-slate-500">Memuat proyek...</p></div></Shell>;
  }
  if (pageState === 'invalid') {
    return <Shell token={token}><div className="flex flex-col items-center py-16 gap-4 text-center"><div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center"><AlertTriangle className="w-8 h-8 text-red-500" /></div><h2 className="text-2xl font-bold text-slate-800">Link Tidak Valid</h2><p className="text-slate-500">Link monitoring tidak valid atau sudah kedaluwarsa.</p></div></Shell>;
  }
  if (pageState === 'not_found' || !project) {
    return <Shell token={token}><div className="flex flex-col items-center py-16 gap-4 text-center"><h2 className="text-xl font-bold text-slate-800">Proyek Tidak Ditemukan</h2><Button variant="outline" onClick={() => navigate(`/monitor/${token}`)}>Kembali ke Dashboard</Button></div></Shell>;
  }

  const ps = progressStatusConfig[project.progress_status || 'in_progress'];
  const PsIcon = ps.icon;

  return (
    <Shell token={token}>
      {/* Back + Title */}
      <div className="flex items-center gap-3 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/monitor/${token}`)} className="rounded-full bg-white border border-slate-200 shadow-sm hover:bg-slate-50">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {project.master_proyek && (
              <Badge variant="secondary" className="text-xs font-semibold">
                <FolderKanban className="w-3 h-3 mr-1" />{project.master_proyek.name}
              </Badge>
            )}
            <Badge variant="outline" className={cn('text-xs', ps.className)}>
              <PsIcon className="w-3 h-3 mr-1" />{ps.label}
            </Badge>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-800 truncate">{project.title}</h1>
        </div>
      </div>

      {/* Gantt Chart */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-6">
        {project.start_date && project.end_date ? (
          <SpreadsheetGantt
            tasks={tasks}
            projectStartDate={project.start_date}
            projectEndDate={project.end_date}
            onAddTask={noop as any}
            onUpdateTask={noop as any}
            onDeleteTask={noopDelete as any}
            readOnly={true}
            projectId={project.id}
            project={project}
            isAdmin={false}
            isProjectExecutor={false}
            isProjectOwner={false}
          />
        ) : (
          <div className="flex items-center justify-center py-12 text-slate-400">
            <p>Tanggal proyek belum ditentukan</p>
          </div>
        )}
      </div>

      {/* Project Info Below Gantt */}
      <div className="space-y-4">
        {/* Quick Info Row */}
        <div className="grid gap-3 md:grid-cols-4">
          <InfoCard icon={<Building2 className="w-5 h-5 text-blue-600" />} label="Unit Kerja" value={project.unit} />
          <InfoCard icon={<User className="w-5 h-5 text-blue-600" />} label="Pengaju" value={project.requester_name} />
          <InfoCard icon={<User className="w-5 h-5 text-blue-600" />} label="PIC" value={(project as any).pic || 'Belum ditentukan'} />
          <InfoCard icon={<Calendar className="w-5 h-5 text-blue-600" />} label="Periode" value={
            project.start_date && project.end_date
              ? `${format(parseISO(project.start_date), 'd MMM yyyy', { locale: localeId })} – ${format(parseISO(project.end_date), 'd MMM yyyy', { locale: localeId })}`
              : 'Belum ditentukan'
          } />
        </div>

        {/* Description */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" /> Deskripsi Proyek
          </h3>
          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{project.description}</p>
        </div>

        {/* Attachment */}
        {project.attachment_url && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Dokumen Proyek
            </h3>
            {isImage(project.attachment_url) ? (
              <a href={project.attachment_url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={project.attachment_url} alt="Dokumen" className="max-w-full max-h-80 rounded-lg border object-contain hover:opacity-90 transition-opacity cursor-pointer" />
              </a>
            ) : (
              <a href={project.attachment_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                <FileText className="w-4 h-4" /> Lihat File User Requirement <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        )}

        {/* Monev Summary */}
        {project.monev_summary && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" /> Rangkuman Monitoring & Evaluasi
            </h3>
            <div className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{project.monev_summary}</div>
          </div>
        )}
      </div>
    </Shell>
  );
}

// ─── Helpers ────────────────────────────────────────────────
function Shell({ children, token }: { children: React.ReactNode; token?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm"><img src={logoImage} alt="SIMAPROS" className="w-full h-full object-cover" /></div>
          <div><h1 className="font-bold text-sm text-slate-800">SIMAPROS</h1><p className="text-[10px] text-slate-500">Dashboard Monitoring Proyek</p></div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-slate-400 py-6">© {new Date().getFullYear()} SIMAPROS</footer>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-blue-50">{icon}</div>
      <div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold text-sm text-slate-800">{value}</p></div>
    </div>
  );
}

function isImage(url: string) {
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].some(ext => url.toLowerCase().includes(ext));
}
