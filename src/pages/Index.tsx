import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SimpleLayout } from "@/components/layout/SimpleLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useMasterProyek } from "@/hooks/useMasterProyek";
import { useEditRequestCounts } from "@/hooks/useEditRequestCounts";
import { FileText, FolderKanban, Calendar, TrendingUp, BarChart3, PlayCircle, PauseCircle, CheckCircle2, AlertTriangle, Search, ListTodo, ChevronDown, ChevronUp, Share2, Link2, Copy, Check, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { id } from "date-fns/locale";
import { ProjectProgressStatus, Project, GanttTask } from "@/types/project";
import type { PriorityFinalDecision, PriorityRecommendation } from "@/types/priorityAssessment";
import { supabase } from "@/integrations/supabase/client";
import { usePicOptions } from "@/hooks/usePicOptions";
import { PriorityDecisionDialog } from "@/components/project/PriorityDecisionDialog";
import { buildPriorityAssessmentView } from "@/lib/priorityAssessmentView";

type CurrentPriorityAssessmentSnapshot = NonNullable<Project['current_priority_assessment']> & {
  priority_index?: number | string | null;
  score_percent?: number | string | null;
  calculated_recommendation?: PriorityRecommendation | null;
  recommendation?: PriorityRecommendation | null;
  final_decision?: PriorityFinalDecision | null;
};

interface MonitoringLink {
  id: string;
  token: string;
  created_at: string;
}

interface MonitoringLinksQueryBuilder {
  select: (columns: string) => MonitoringLinksQueryBuilder;
  eq: (column: string, value: boolean) => MonitoringLinksQueryBuilder;
  order: (
    column: string,
    options: { ascending: boolean },
  ) => Promise<{ data: MonitoringLink[] | null }>;
  insert: (values: { created_by: string }) => {
    select: (columns: string) => {
      single: () => Promise<{ data: MonitoringLink | null; error: unknown }>;
    };
  };
}

const monitoringLinksTable = () =>
  (supabase.from as unknown as (table: string) => MonitoringLinksQueryBuilder)('monitoring_links');

const getCurrentAssessment = (project: Project): CurrentPriorityAssessmentSnapshot | null =>
  project.current_priority_assessment ?? null;

const hasTier2AssessmentPointer = (project: Project) =>
  Boolean(project.current_priority_assessment_id || project.current_priority_assessment);

const toFiniteNumber = (value?: number | string | null) => {
  const numberValue = typeof value === 'string' ? Number(value) : value;
  return typeof numberValue === 'number' && Number.isFinite(numberValue) ? numberValue : null;
};

const assessmentLaneRank = (project: Project) => {
  const assessment = getCurrentAssessment(project);
  if (!assessment) return null;

  // Keputusan Steering Committee "deferred" tetap dipertahankan sebagai
  // snapshot audit. Setelah pengaju menerima jadwal, status operasionalnya
  // menjadi approved dan proyek harus kembali ke lane eksekusi.
  if (project.requester_decision === 'accepted' && project.status === 'approved') return 0;

  const lane = assessment.final_decision
    ?? assessment.calculated_recommendation
    ?? assessment.recommendation;
  // Lane 0 = dieksekusi, 1 = bersyarat, 2 = tertahan/ditunda, 3 = ditutup.
  // Keluaran SOP 2026 (mandatory/queued/gated) ikut dipetakan di sini supaya
  // proyek Priority 0 selalu berada di atas proyek yang sekadar disetujui.
  const ranks: Record<PriorityFinalDecision | PriorityRecommendation, number> = {
    mandatory: -1,
    approved: 0,
    go: 0,
    queued: 0,
    conditional: 1,
    conditional_go: 1,
    gated: 2,
    deferred: 2,
    defer: 2,
    rejected: 3,
    no_go: 3,
  };
  return lane ? ranks[lane] : 4;
};

type DashboardSort = 'priority' | 'score_desc' | 'newest' | 'deadline';

export default function Index() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, isSuperAdmin, isProjectExecutor, profile } = useAuth();
  const { projects, loading: projectsLoading, respondToPriority } = useProjects();
  const { masterProyek } = useMasterProyek();
  const { picOptions } = usePicOptions();
  const { getCount } = useEditRequestCounts();
  const [masterFilter, setMasterFilter] = useState<string>("all");
  const [picFilter, setPicFilter] = useState<string>("all");
  const [progressFilter, setProgressFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<DashboardSort>("priority");
  const [overdueTasks, setOverdueTasks] = useState<(GanttTask & { project_title: string; master_proyek_id?: string })[]>([]);
  const [showAllOverdueTasks, setShowAllOverdueTasks] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityDecisionProject, setPriorityDecisionProject] = useState<Project | null>(null);
  const { toast } = useToast();

  // Share dashboard state
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [monitoringLinks, setMonitoringLinks] = useState<{ id: string; token: string; created_at: string }[]>([]);
  const [shareCopied, setShareCopied] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
    // Redirect to profile page if profile is not completed
    if (!authLoading && user && profile && !profile.profile_completed) {
      navigate("/profile");
    }
  }, [user, authLoading, profile, navigate]);

  // Fetch monitoring links for super admin
  useEffect(() => {
    if (!user || !isSuperAdmin) return;
    monitoringLinksTable().select('id, token, created_at').eq('is_active', true).order('created_at', { ascending: false }).then(({ data }) => {
      setMonitoringLinks(data ?? []);
    });
  }, [user, isSuperAdmin]);

  const handleGenerateMonitoringLink = async () => {
    setGeneratingLink(true);
    const { data, error } = await monitoringLinksTable().insert({ created_by: user!.id }).select('id, token, created_at').single();
    if (error) { toast({ title: 'Gagal', description: 'Gagal membuat link', variant: 'destructive' }); setGeneratingLink(false); return; }
    if (!data) { toast({ title: 'Gagal', description: 'Data link tidak tersedia', variant: 'destructive' }); setGeneratingLink(false); return; }
    setMonitoringLinks(prev => [data, ...prev]);
    const url = `${window.location.origin}/monitor/${data.token}`;
    navigator.clipboard.writeText(url);
    setShareCopied(data.id);
    toast({ title: 'Link dibuat & disalin!', description: 'Link monitoring berhasil dibuat dan disalin ke clipboard.' });
    setTimeout(() => setShareCopied(null), 2000);
    setGeneratingLink(false);
  };

  const handleCopyMonitoringLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/monitor/${token}`);
    setShareCopied(id);
    toast({ title: 'Link disalin!' });
    setTimeout(() => setShareCopied(null), 2000);
  };

  // Fetch overdue tasks for executor dashboard
  useEffect(() => {
    const fetchOverdueTasks = async () => {
      if (!user || !projects.length) return;

      const activeProjectIds = projects
        .filter(p => p.status === 'approved' || p.status === 'active')
        .map(p => p.id);

      if (activeProjectIds.length === 0) {
        setOverdueTasks([]);
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('gantt_tasks')
        .select('*')
        .in('project_id', activeProjectIds)
        .lt('end_date', today)
        .neq('status', 'completed');

      if (!error && data) {
        const tasksWithProject = data.map(task => {
          const project = projects.find(p => p.id === task.project_id);
          return {
            id: task.id,
            project_id: task.project_id,
            name: task.name,
            description: task.description || '',
            pic: task.pic || '',
            start_date: task.start_date,
            end_date: task.end_date,
            progress: task.progress || 0,
            status: (task.status as GanttTask['status']) || 'not_started',
            wbs_number: task.wbs_number || '',
            monev: task.monev || '',
            phase: task.phase || '',
            parent_task_id: (task as unknown as { parent_task_id?: string | null }).parent_task_id || null,
            project_title: project?.title || 'Unknown Project',
            master_proyek_id: project?.master_proyek_id,
          };
        });
        setOverdueTasks(tasksWithProject);
      }
    };

    fetchOverdueTasks();
  }, [user, projects]);

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // For project executors, only show approved/active projects
  // For super admins, show all projects
  // For regular users, show their own projects (handled by RLS)
  const displayProjects = isProjectExecutor && !isSuperAdmin
    ? projects.filter(p => p.status === 'approved' || p.status === 'active')
    : projects;

  // Apply search filter
  let filteredProjects = searchQuery.trim()
    ? displayProjects.filter(p =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.unit.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.requester_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    : displayProjects;

  // Apply master proyek filter
  filteredProjects = masterFilter === "all"
    ? filteredProjects
    : filteredProjects.filter(p => p.master_proyek_id === masterFilter);

  // Apply PIC filter
  filteredProjects = picFilter === "all"
    ? filteredProjects
    : filteredProjects.filter(p => p.pic === picFilter);

  // Apply progress status filter (only for approved/active projects)
  if (progressFilter !== "all") {
    filteredProjects = filteredProjects.filter(p =>
      (p.status === 'approved' || p.status === 'active') &&
      p.progress_status === progressFilter
    );
  }

  // Progress status labels
  const progressStatusLabels: Record<ProjectProgressStatus, string> = {
    'in_progress': 'Aktif',
    'on_hold': 'Pending',
    'completed': 'Selesai',
  };

  const progressStatusColors: Record<ProjectProgressStatus, string> = {
    'in_progress': 'text-success',
    'on_hold': 'text-warning',
    'completed': 'text-primary',
  };

  const stats = {
    // Only count approved/active projects in total â€” pending, rejected, and revision are excluded
    total: displayProjects.filter((p) => p.status === "approved" || p.status === "active").length,
    approved: displayProjects.filter((p) => p.status === "approved" || p.status === "active").length,
    pending: displayProjects.filter((p) => p.status === "pending" || p.status === "pending_creation").length,
    revision: displayProjects.filter((p) => p.status === "revision").length,
    rejected: displayProjects.filter((p) => p.status === "rejected").length,
  };

  const activeProjects = filteredProjects.filter((p) => p.status === "approved" || p.status === "active");
  const pendingProjects = filteredProjects.filter((p) => p.status === "pending" || p.status === "pending_creation");
  const revisionProjects = filteredProjects.filter((p) => p.status === "revision");
  // Keputusan "Ditunda" membutuhkan tanggapan pengaju atas jadwal tindak lanjut.
  const deprioritizedProjects = filteredProjects.filter((p) => p.status === "deprioritized");

  // Progress status counts - computed from displayProjects (NOT filteredProjects) so counts stay stable
  const approvedActiveUnfiltered = displayProjects.filter(p => p.status === 'approved' || p.status === 'active');
  const progressCounts = {
    in_progress: approvedActiveUnfiltered.filter(p => p.progress_status === 'in_progress').length,
    on_hold: approvedActiveUnfiltered.filter(p => p.progress_status === 'on_hold').length,
    completed: approvedActiveUnfiltered.filter(p => p.progress_status === 'completed').length,
  };

  // Snapshot penilaian menjadi sumber ranking resmi: lane keputusan/rekomendasi,
  // lalu Total Skor ternormalisasi (score_percent) tertinggi.
  //
  // Memakai score_percent, BUKAN impact_score mentah maupun Priority Index.
  // impact_score berskala 1-5 pada snapshot lama dan 1-10 pada snapshot SOP,
  // sehingga membandingkannya langsung akan menempatkan proyek lama di bawah
  // tanpa gejala yang terlihat. Priority Index dibuang dari ranking karena SOP
  // mengurutkan murni dari Total Skor Akhir — proyek berdampak besar bereffort
  // berat tidak boleh tergeser proyek kecil yang mudah dikerjakan.
  const compareByPriority = (a: Project, b: Project) => {
    const aAssessment = getCurrentAssessment(a);
    const bAssessment = getCurrentAssessment(b);

    if (aAssessment && bAssessment) {
      const laneDiff = (assessmentLaneRank(a) ?? 4) - (assessmentLaneRank(b) ?? 4);
      if (laneDiff !== 0) return laneDiff;

      const aScore = buildPriorityAssessmentView(aAssessment).scorePercent ?? Number.NEGATIVE_INFINITY;
      const bScore = buildPriorityAssessmentView(bAssessment).scorePercent ?? Number.NEGATIVE_INFINITY;
      const scoreDiff = bScore - aScore;
      if (scoreDiff !== 0) return scoreDiff;
    } else if (aAssessment || bAssessment) {
      return aAssessment ? -1 : 1;
    } else if (hasTier2AssessmentPointer(a) || hasTier2AssessmentPointer(b)) {
      // Pointer Tier 2 tanpa objek relasi berarti snapshot tidak berhasil dimuat
      // (misalnya karena kontrak/RLS), bukan proyek legacy yang boleh diranking
      // memakai kolom prioritas lama.
      if (hasTier2AssessmentPointer(a) !== hasTier2AssessmentPointer(b)) {
        return hasTier2AssessmentPointer(a) ? -1 : 1;
      }
    } else {
      const legacyPriorityRank = (project: Project) => (project.is_priority === false ? 1 : 0);
      const legacyPriorityDiff = legacyPriorityRank(a) - legacyPriorityRank(b);
      if (legacyPriorityDiff !== 0) return legacyPriorityDiff;
    }

    const order: Record<ProjectProgressStatus, number> = { 'in_progress': 0, 'on_hold': 1, 'completed': 2 };
    const aOrder = order[a.progress_status || 'in_progress'];
    const bOrder = order[b.progress_status || 'in_progress'];
    return aOrder - bOrder;
  };

  // "Skor Tertinggi": urutan murni Total Skor Akhir (score_percent) tanpa lane
  // keputusan. Proyek mandatory (Priority 0) tidak punya skor dan tetap teratas;
  // proyek tanpa snapshot penilaian diletakkan paling bawah.
  const compareByScore = (a: Project, b: Project) => {
    const aAssessment = getCurrentAssessment(a);
    const bAssessment = getCurrentAssessment(b);
    const aMandatory = aAssessment ? buildPriorityAssessmentView(aAssessment).isMandatory : false;
    const bMandatory = bAssessment ? buildPriorityAssessmentView(bAssessment).isMandatory : false;
    if (aMandatory !== bMandatory) return aMandatory ? -1 : 1;

    const aScore = aAssessment ? buildPriorityAssessmentView(aAssessment).scorePercent : null;
    const bScore = bAssessment ? buildPriorityAssessmentView(bAssessment).scorePercent : null;
    if (aScore === null && bScore === null) return a.title.localeCompare(b.title);
    if (aScore === null) return 1;
    if (bScore === null) return -1;
    if (aScore !== bScore) return bScore - aScore;
    return a.title.localeCompare(b.title);
  };

  const compareByNewest = (a: Project, b: Project) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  // Deadline terdekat lebih dulu; proyek tanpa end_date paling bawah.
  const compareByDeadline = (a: Project, b: Project) => {
    if (!a.end_date && !b.end_date) return a.title.localeCompare(b.title);
    if (!a.end_date) return 1;
    if (!b.end_date) return -1;
    return a.end_date.localeCompare(b.end_date) || a.title.localeCompare(b.title);
  };

  const sortedActiveProjects = [...activeProjects].sort((a, b) => {
    switch (sortBy) {
      case 'score_desc':
        return compareByScore(a, b);
      case 'newest':
        return compareByNewest(a, b);
      case 'deadline':
        return compareByDeadline(a, b);
      default:
        return compareByPriority(a, b);
    }
  });

  // Get role-specific welcome message
  const getWelcomeMessage = () => {
    if (isSuperAdmin) {
      return "Kelola approval dan review semua perubahan project.";
    } else if (isProjectExecutor) {
      return "Kelola timeline dan update project yang telah disetujui. Semua perubahan membutuhkan approval Super Admin.";
    }
    return "Pantau status proyek Anda dan ajukan proyek baru.";
  };

  // Check if user is a regular user (not admin or executor)
  const isRegularUser = !isSuperAdmin && !isProjectExecutor;

  // Keputusan pengaju atas proyek berstatus Ditunda. Transisi status dijalankan
  // lewat RPC agar pengaju tidak perlu hak UPDATE langsung ke tabel projects.
  const handlePriorityDecision = async (projectId: string, decision: 'accepted' | 'withdrawn') => {
    const result = await respondToPriority(projectId, decision);

    if (!result.success) {
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan saat menyimpan keputusan Anda.",
        variant: "destructive",
      });
      return;
    }

    // Beri tahu HTO bahwa bola sudah tidak di tangan pengaju lagi
    const project = projects.find(p => p.id === projectId);
    if (project) {
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            type: decision === 'accepted' ? 'priority_accepted' : 'priority_withdrawn',
            projectId,
            projectTitle: project.title,
            notifySuperAdmins: true,
            sendEmail: true,
          },
        });
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Error sending priority decision notification:', error);
        }
      }
    }

    toast({
      title: decision === 'accepted' ? "Jadwal Diterima" : "Pengajuan Ditarik",
      description: decision === 'accepted'
        ? "Proyek masuk antrean pengerjaan dengan jadwal yang diusulkan."
        : "Pengajuan Anda telah dibatalkan.",
    });
  };

  // Calculate executor-specific stats
  const getExecutorStats = () => {
    const today = new Date();
    const upcomingDeadlines = activeProjects.filter(p => {
      if (!p.end_date) return false;
      const endDate = new Date(p.end_date);
      return isAfter(endDate, today) && isBefore(endDate, addDays(today, 14));
    });

    const overdueProjects = activeProjects.filter(p => {
      if (!p.end_date) return false;
      return isBefore(new Date(p.end_date), today);
    });

    const projectsByMaster = masterProyek.map(mp => ({
      name: mp.name,
      count: activeProjects.filter(p => p.master_proyek_id === mp.id).length
    }));

    return { upcomingDeadlines, overdueProjects, projectsByMaster };
  };

  // Executor-specific view
  if (isProjectExecutor && !isSuperAdmin) {
    const { upcomingDeadlines, overdueProjects, projectsByMaster } = getExecutorStats();

    return (
      <SimpleLayout>
        <div className="space-y-6">
          {/* Welcome Card */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h1 className="text-2xl font-bold text-card-foreground mb-2">Selamat Datang, {profile?.name || "Eksekutor"}!</h1>
            <p className="text-muted-foreground">{getWelcomeMessage()}</p>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari proyek berdasarkan judul, deskripsi, unit, atau pengaju..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Quick Stats for Executor */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <FolderKanban className="w-4 h-4" />
                  Total Proyek Aktif
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-primary">{activeProjects.length}</div>
                <p className="text-xs text-muted-foreground mt-1">proyek yang perlu dikelola</p>
              </CardContent>
            </Card>

            <Card className={overdueProjects.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-success/20 bg-success/5"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Proyek Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${overdueProjects.length > 0 ? 'text-destructive' : 'text-success'}`}>
                  {overdueProjects.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overdueProjects.length > 0 ? "proyek melewati deadline" : "semua tepat waktu"}
                </p>
              </CardContent>
            </Card>

            <Card className={overdueTasks.length > 0 ? "border-destructive/30 bg-destructive/5" : "border-success/20 bg-success/5"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <ListTodo className="w-4 h-4" />
                  Task Overdue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${overdueTasks.length > 0 ? 'text-destructive' : 'text-success'}`}>
                  {overdueTasks.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {overdueTasks.length > 0 ? "task melewati deadline" : "semua task tepat waktu"}
                </p>
              </CardContent>
            </Card>

            <Card className={upcomingDeadlines.length > 0 ? "border-warning/30 bg-warning/5" : "border-muted"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Deadline 14 Hari
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${upcomingDeadlines.length > 0 ? 'text-warning' : 'text-muted-foreground'}`}>
                  {upcomingDeadlines.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {upcomingDeadlines.length > 0 ? "akan segera berakhir" : "tidak ada deadline dekat"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Projects by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="w-5 h-5" />
                Distribusi Proyek per Kategori
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectsByMaster.map((item) => (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">{item.count} proyek</span>
                    </div>
                    <Progress
                      value={activeProjects.length > 0 ? (item.count / activeProjects.length) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                ))}
                {projectsByMaster.length === 0 && (
                  <p className="text-muted-foreground text-sm text-center py-4">Belum ada kategori proyek</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Filter and Projects List */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Daftar Proyek Aktif
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as DashboardSort)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Urutkan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Prioritas</SelectItem>
                  <SelectItem value="score_desc">Skor Tertinggi</SelectItem>
                  <SelectItem value="newest">Terbaru</SelectItem>
                  <SelectItem value="deadline">Deadline Terdekat</SelectItem>
                </SelectContent>
              </Select>
              <Select value={progressFilter} onValueChange={setProgressFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Status Progres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="in_progress">
                    <span className="flex items-center gap-2">
                      <PlayCircle className="w-4 h-4 text-success" />
                      Aktif
                    </span>
                  </SelectItem>
                  <SelectItem value="on_hold">
                    <span className="flex items-center gap-2">
                      <PauseCircle className="w-4 h-4 text-warning" />
                      Pending
                    </span>
                  </SelectItem>
                  <SelectItem value="completed">
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      Selesai
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={masterFilter} onValueChange={setMasterFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {masterProyek.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Progress Status Summary */}
          <div className="grid grid-cols-3 gap-3">
            <Card
              className={`cursor-pointer transition-all ${progressFilter === 'in_progress' ? 'ring-2 ring-success' : ''}`}
              onClick={() => setProgressFilter(progressFilter === 'in_progress' ? 'all' : 'in_progress')}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <PlayCircle className="w-8 h-8 text-success" />
                <div>
                  <div className="text-2xl font-bold">{progressCounts.in_progress}</div>
                  <div className="text-xs text-muted-foreground">Aktif</div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${progressFilter === 'on_hold' ? 'ring-2 ring-warning' : ''}`}
              onClick={() => setProgressFilter(progressFilter === 'on_hold' ? 'all' : 'on_hold')}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <PauseCircle className="w-8 h-8 text-warning" />
                <div>
                  <div className="text-2xl font-bold">{progressCounts.on_hold}</div>
                  <div className="text-xs text-muted-foreground">Pending</div>
                </div>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${progressFilter === 'completed' ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setProgressFilter(progressFilter === 'completed' ? 'all' : 'completed')}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-primary" />
                <div>
                  <div className="text-2xl font-bold">{progressCounts.completed}</div>
                  <div className="text-xs text-muted-foreground">Selesai</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overdue Tasks Alert */}
          {(() => {
            // Apply search and category filters to overdue tasks
            let filteredOverdueTasks = overdueTasks;
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              filteredOverdueTasks = filteredOverdueTasks.filter(t =>
                t.name.toLowerCase().includes(q) ||
                t.project_title.toLowerCase().includes(q) ||
                t.pic.toLowerCase().includes(q)
              );
            }
            if (masterFilter !== "all") {
              filteredOverdueTasks = filteredOverdueTasks.filter(t => t.master_proyek_id === masterFilter);
            }

            const visibleTasks = showAllOverdueTasks ? filteredOverdueTasks : filteredOverdueTasks.slice(0, 3);
            const hasMore = filteredOverdueTasks.length > 3;

            return filteredOverdueTasks.length > 0 ? (
              <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
                <h3 className="font-semibold text-destructive flex items-center gap-2 mb-3">
                  <ListTodo className="w-5 h-5" />
                  Task Melewati Deadline ({filteredOverdueTasks.length})
                </h3>
                <div className="space-y-2">
                  {visibleTasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-background/80 border border-border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => navigate(`/project/${task.project_id}`)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{task.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          Proyek: {task.project_title}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {task.pic && (
                          <Badge variant="outline" className="text-xs">
                            PIC: {task.pic}
                          </Badge>
                        )}
                        <Badge variant="destructive" className="text-xs">
                          {format(new Date(task.end_date), "dd MMM yyyy", { locale: id })}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
                {hasMore && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllOverdueTasks(!showAllOverdueTasks)}
                    className="w-full mt-3 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {showAllOverdueTasks ? (
                      <><ChevronUp className="w-4 h-4 mr-2" /> Sembunyikan</>
                    ) : (
                      <><ChevronDown className="w-4 h-4 mr-2" /> Lihat Semua ({filteredOverdueTasks.length} task)</>)}
                  </Button>
                )}
              </div>
            ) : null;
          })()}

          {/* Overdue Projects Alert */}
          {overdueProjects.length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
              <h3 className="font-semibold text-destructive flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5" />
                Proyek Melewati Deadline ({overdueProjects.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overdueProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    compact
                    editRequestCount={getCount(project.id).total}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Deadlines */}
          {upcomingDeadlines.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
              <h3 className="font-semibold text-warning flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5" />
                Deadline Dalam 14 Hari ({upcomingDeadlines.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingDeadlines.map((project) => (
                  <div key={project.id} className="relative">
                    <ProjectCard
                      project={project}
                      compact
                      editRequestCount={getCount(project.id).total}
                    />
                    {project.end_date && (
                      <Badge variant="outline" className="absolute top-2 right-2 text-xs bg-background">
                        {format(new Date(project.end_date), "dd MMM", { locale: id })}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All Active Projects */}
          {activeProjects.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedActiveProjects
                  .filter(p => !overdueProjects.includes(p) && !upcomingDeadlines.includes(p))
                  .map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      showAdminNote={false}
                      compact
                      editRequestCount={getCount(project.id).total}
                      showObstaclesPreview
                    />
                  ))}
              </div>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-12 text-center">
              <FolderKanban className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Belum Ada Proyek Aktif</h3>
              <p className="text-muted-foreground mt-1">
                Belum ada proyek aktif yang perlu dikelola.
              </p>
            </div>
          )}
        </div>
      </SimpleLayout>
    );
  }

  // Regular user and Super Admin view
  return (
    <SimpleLayout>
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-card-foreground mb-2">Selamat Datang, {profile?.name || "User"}!</h1>
              <p className="text-muted-foreground">{getWelcomeMessage()}</p>
            </div>
            {isSuperAdmin && (
              <div className="relative">
                <Button onClick={() => setShowSharePopover(!showSharePopover)} className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md">
                  <Share2 className="w-4 h-4" /> Share Dashboard
                </Button>
                {showSharePopover && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm">Link Monitoring Proyek</h3>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSharePopover(false)}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Bagikan link ini agar atasan bisa memantau proyek tanpa login.</p>
                    <Button onClick={handleGenerateMonitoringLink} disabled={generatingLink} className="w-full mb-3 gap-2" size="sm">
                      <Link2 className="w-4 h-4" /> {generatingLink ? 'Membuat...' : 'Buat Link Baru'}
                    </Button>
                    {monitoringLinks.length > 0 && (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {monitoringLinks.map(link => (
                          <div key={link.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                            <p className="text-[10px] text-muted-foreground font-mono truncate flex-1">/monitor/{link.token.slice(0, 8)}...</p>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleCopyMonitoringLink(link.token, link.id)}>
                              {shareCopied === link.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              {shareCopied === link.id ? 'Disalin' : 'Salin'}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari proyek berdasarkan judul, deskripsi, unit, atau pengaju..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats Cards - Total + Progress Status */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <FolderKanban className="w-8 h-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Proyek</div>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${progressFilter === 'in_progress' ? 'ring-2 ring-success' : ''}`}
            onClick={() => setProgressFilter(progressFilter === 'in_progress' ? 'all' : 'in_progress')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <PlayCircle className="w-8 h-8 text-success" />
              <div>
                <div className="text-2xl font-bold">{progressCounts.in_progress}</div>
                <div className="text-xs text-muted-foreground">Aktif</div>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${progressFilter === 'on_hold' ? 'ring-2 ring-warning' : ''}`}
            onClick={() => setProgressFilter(progressFilter === 'on_hold' ? 'all' : 'on_hold')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <PauseCircle className="w-8 h-8 text-warning" />
              <div>
                <div className="text-2xl font-bold">{progressCounts.on_hold}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
            </CardContent>
          </Card>
          <Card
            className={`cursor-pointer transition-all ${progressFilter === 'completed' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setProgressFilter(progressFilter === 'completed' ? 'all' : 'completed')}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-primary" />
              <div>
                <div className="text-2xl font-bold">{progressCounts.completed}</div>
                <div className="text-xs text-muted-foreground">Selesai</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Only regular users can submit new projects */}
        {isRegularUser && (
          <Button size="lg" onClick={() => navigate("/submit")} className="gap-2">
            <FileText className="w-5 h-5" />
            Ajukan Proyek Baru
          </Button>
        )}

        {isRegularUser && revisionProjects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-revision" />
              Perlu Revisi ({revisionProjects.length})
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {revisionProjects.map((project) => (
                <div key={project.id}>
                  <ProjectCard project={project} compact editRequestCount={getCount(project.id).total} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/edit/${project.id}`)}
                    className="mt-2 w-full text-revision border-revision/30 hover:bg-revision/10"
                  >
                    Edit & Ajukan Kembali
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keputusan Ditunda: pengaju menerima jadwal tindak lanjut atau menarik pengajuan */}
        {isRegularUser && deprioritizedProjects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning" />
              Menunggu Keputusan Anda ({deprioritizedProjects.length})
            </h2>
            <p className="text-sm text-muted-foreground -mt-2">
              Steering Committee menetapkan pengajuan ini untuk ditunda. Tinjau snapshot penilaian dan
              jadwal tindak lanjut HTO, lalu terima jadwal atau tarik pengajuan.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {deprioritizedProjects.map((project) => (
                <div key={project.id}>
                  <ProjectCard project={project} compact editRequestCount={getCount(project.id).total} />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPriorityDecisionProject(project)}
                    className="mt-2 w-full text-warning border-warning/30 hover:bg-warning/10"
                  >
                    Tinjau & Putuskan
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeProjects.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Proyek Aktif ({activeProjects.length})</h2>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as DashboardSort)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="priority">Prioritas</SelectItem>
                    <SelectItem value="score_desc">Skor Tertinggi</SelectItem>
                    <SelectItem value="newest">Terbaru</SelectItem>
                    <SelectItem value="deadline">Deadline Terdekat</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={picFilter} onValueChange={setPicFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter PIC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua PIC</SelectItem>
                    {picOptions.map((mp) => (
                      <SelectItem key={mp.id} value={mp.name}>{mp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={masterFilter} onValueChange={setMasterFilter}>
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="Filter kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kategori</SelectItem>
                    {masterProyek.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sortedActiveProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  showAdminNote={false}
                  compact
                  editRequestCount={getCount(project.id).total}
                  showObstaclesPreview={isSuperAdmin}
                />
              ))}
            </div>
          </div>
        )}

        {/* Only show pending projects to users and super admins */}
        {(isSuperAdmin || isRegularUser) && pendingProjects.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Menunggu Persetujuan ({pendingProjects.length})</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {pendingProjects.map((project) => (
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
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold">Belum Ada Proyek</h3>
            <p className="text-muted-foreground mt-1">
              {isSuperAdmin
                ? "Belum ada proyek yang diajukan."
                : "Mulai ajukan inisiatif strategis pertama Anda."}
            </p>
            {isRegularUser && (
              <Button onClick={() => navigate("/submit")} className="mt-4">
                Ajukan Proyek
              </Button>
            )}
          </div>
        )}
      </div>

      <PriorityDecisionDialog
        project={priorityDecisionProject}
        open={!!priorityDecisionProject}
        onClose={() => setPriorityDecisionProject(null)}
        onDecide={handlePriorityDecision}
      />
    </SimpleLayout>
  );
}
