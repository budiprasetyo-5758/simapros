import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ArrowLeft, Building2, User, UserCheck, Calendar, Edit2, Save, X, Send, Trash2, FileText, Users, Paperclip, ExternalLink, PlayCircle, PauseCircle, CheckCircle2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useAuth } from '@/hooks/useAuth';
import { useIsAssignedToProject } from '@/hooks/useIsAssignedToProject';
import { useProjects, useGanttTasks } from '@/hooks/useProjects';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { PhaseProgress } from '@/components/project/PhaseProgress';
import { ConfirmChangeDialog } from '@/components/project/ConfirmChangeDialog';
import { SpreadsheetGantt } from '@/components/project/SpreadsheetGantt';

import { DailyReportDialog } from '@/components/project/DailyReportDialog';
import { DailyReportsView } from '@/components/project/DailyReportsView';
import { ProgressOverrideDialog } from '@/components/project/ProgressOverrideDialog';
import { ProjectAssignmentDialog } from '@/components/project/ProjectAssignmentDialog';
import { UnitKerjaAssignmentDialog } from '@/components/project/UnitKerjaAssignmentDialog';
import { ProjectDocumentsSection } from '@/components/project/ProjectDocumentsSection';
import { ProjectMeetingsSection } from '@/components/project/ProjectMeetingsSection';

import { UserEditRequestDialog } from '@/components/project/UserEditRequestDialog';
import { useProjectUnitKerjaAssignments } from '@/hooks/useProjectUnitKerjaAssignments';
import { MonevSummarySection } from '@/components/project/MonevSummarySection';
import { KendalaSection } from '@/components/project/KendalaSection';
import { Project, ProjectStage, ProjectPriority, StageNotes, GanttTask, ProjectProgressStatus } from '@/types/project';
import { useTaskEditRequests } from '@/hooks/useTaskEditRequests';
import { Urgency, Impact, calculatePriority, urgencyOptions, impactOptions, priorityConfig as matrixPriorityConfig } from '@/lib/priorityMatrix';
import { cn } from '@/lib/utils';
import { usePicOptions } from '@/hooks/usePicOptions';

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Menunggu', className: 'bg-muted text-muted-foreground' },
  approved: { label: 'Disetujui', className: 'bg-success/10 text-success border-success/20' },
  active: { label: 'Aktif', className: 'bg-primary/10 text-primary border-primary/20' },
  rejected: { label: 'Ditolak', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  revision: { label: 'Revisi', className: 'bg-revision/10 text-revision border-revision/20' },
  pending_creation: { label: 'Menunggu Pembuatan', className: 'bg-warning/10 text-warning border-warning/20' }
};

const priorityConfig = {
  low: { label: 'Rendah', className: 'bg-muted text-muted-foreground' },
  medium: { label: 'Sedang', className: 'bg-primary/10 text-primary' },
  high: { label: 'Tinggi', className: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
};

const urgencyConfig: Record<string, { label: string; className: string }> = {
  very_low: { label: 'Sangat Rendah', className: 'bg-muted text-muted-foreground' },
  low: { label: 'Rendah', className: 'bg-success/10 text-success' },
  medium: { label: 'Sedang', className: 'bg-warning/10 text-warning' },
  high: { label: 'Tinggi', className: 'bg-destructive/10 text-destructive' },
};

const impactConfig: Record<string, { label: string; className: string }> = {
  minimal: { label: 'Minimal', className: 'bg-muted text-muted-foreground' },
  minor: { label: 'Minor', className: 'bg-success/10 text-success' },
  significant: { label: 'Signifikan', className: 'bg-warning/10 text-warning' },
  severe: { label: 'Kritis', className: 'bg-destructive/10 text-destructive' },
};

const progressStatusConfig: Record<ProjectProgressStatus, { label: string; className: string; icon: typeof PlayCircle }> = {
  'in_progress': { label: 'Aktif', className: 'bg-success/10 text-success border-success/20', icon: PlayCircle },
  'on_hold': { label: 'Pending', className: 'bg-warning/10 text-warning border-warning/20', icon: PauseCircle },
  'completed': { label: 'Selesai', className: 'bg-primary/10 text-primary border-primary/20', icon: CheckCircle2 },
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, isSuperAdmin, isProjectExecutor } = useAuth();
  const { projects, updateProject, deleteProject, loading: projectsLoading } = useProjects();
  const { tasks, addTask, updateTask, deleteTask } = useGanttTasks(id || '');
  const { isAssigned, loading: assignmentLoading } = useIsAssignedToProject(id);
  const { createNewTaskRequest } = useTaskEditRequests(id);

  const { activePicOptions } = usePicOptions();
  const [isEditing, setIsEditing] = useState(false);
  const [showEditRequestDialog, setShowEditRequestDialog] = useState(false);

  const [showDailyReportDialog, setShowDailyReportDialog] = useState(false);
  const [showProgressOverrideDialog, setShowProgressOverrideDialog] = useState(false);
  const [showAssignmentDialog, setShowAssignmentDialog] = useState(false);
  const [showUnitKerjaAssignmentDialog, setShowUnitKerjaAssignmentDialog] = useState(false);
  const { assignments: unitKerjaAssignments } = useProjectUnitKerjaAssignments(id || '');
  const [selectedTaskForOverride, setSelectedTaskForOverride] = useState<GanttTask | null>(null);
  const [dailyReportsKey, setDailyReportsKey] = useState(0);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    unit: '',
    pic: '' as string,
    start_date: null as Date | null,
    end_date: null as Date | null,
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => { } });

  const project = projects.find(p => p.id === id);

  // Check if current user is the project owner (not admin/executor)
  const isProjectOwner = user && project?.requester_id === user.id && !isAdmin && !isProjectExecutor;
  // Executor can view but cannot edit directly - must request changes
  const isExecutorViewing = isProjectExecutor && !isSuperAdmin;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (project) {
      setEditForm({
        title: project.title,
        description: project.description,
        unit: project.unit,
        pic: project.pic || '',
        start_date: project.start_date ? parseISO(project.start_date) : null,
        end_date: project.end_date ? parseISO(project.end_date) : null,
      });
    }
  }, [project]);

  if (authLoading || projectsLoading || assignmentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  if (!project) {
    return (
      <SimpleLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Proyek tidak ditemukan</p>
          <Button variant="link" onClick={() => navigate(-1)}>Kembali</Button>
        </div>
      </SimpleLayout>
    );
  }

  // Check if user has access - admins, executors (for approved projects), project owner, or assigned users
  const hasAccess = isSuperAdmin ||
    (isProjectExecutor && (project.status === 'approved' || project.status === 'active')) ||
    project.requester_id === user.id ||
    isAssigned;

  if (!hasAccess) {
    return (
      <SimpleLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Anda tidak memiliki akses ke proyek ini</p>
          <Button variant="link" onClick={() => navigate('/')}>Kembali ke Dashboard</Button>
        </div>
      </SimpleLayout>
    );
  }

  const showConfirmation = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, description, onConfirm });
  };

  const handleSaveDetails = () => {
    if (!editForm.title.trim() || !editForm.description.trim() || !editForm.unit.trim()) return;

    showConfirmation(
      'Simpan Perubahan',
      'Apakah Anda yakin ingin menyimpan perubahan detail proyek ini?',
      async () => {
        const updates: Partial<Project> = {
          title: editForm.title.trim(),
          description: editForm.description.trim(),
          unit: editForm.unit.trim(),
          pic: editForm.pic || null,
        };
        if (editForm.start_date) updates.start_date = format(editForm.start_date, 'yyyy-MM-dd');
        if (editForm.end_date) updates.end_date = format(editForm.end_date, 'yyyy-MM-dd');

        await updateProject(project.id, updates);
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsEditing(false);
      }
    );
  };

  const handleUpdateStage = (stage: ProjectStage) => {
    const stageLabel = { planning: 'Perencanaan', execution: 'Pelaksanaan', evaluation: 'Evaluasi', followup: 'Tindak Lanjut' };
    showConfirmation(
      'Ubah Fase Proyek',
      `Apakah Anda yakin ingin mengubah fase proyek menjadi "${stageLabel[stage]}"?`,
      async () => {
        await updateProject(project.id, { project_stage: stage });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    );
  };

  const handleUpdateNote = (stage: ProjectStage, note: string) => {
    const stageLabel = { planning: 'Perencanaan', execution: 'Pelaksanaan', evaluation: 'Evaluasi', followup: 'Tindak Lanjut' };
    showConfirmation(
      'Simpan Catatan',
      `Apakah Anda yakin ingin menyimpan catatan untuk fase "${stageLabel[stage]}"?`,
      async () => {
        const newStageNotes: StageNotes = { ...project.stage_notes, [stage]: note };
        await updateProject(project.id, { stage_notes: newStageNotes });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    );
  };

  const handleUpdatePriority = (priority: ProjectPriority) => {
    showConfirmation(
      'Ubah Prioritas Proyek',
      `Apakah Anda yakin ingin mengubah prioritas proyek menjadi "${priorityConfig[priority].label}"?`,
      async () => {
        await updateProject(project.id, { priority });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    );
  };

  const handleUpdateUrgency = (urgencyValue: string) => {
    const label = urgencyConfig[urgencyValue]?.label || urgencyValue;
    showConfirmation(
      'Ubah Emergency Effort',
      `Apakah Anda yakin ingin mengubah Emergency Effort menjadi "${label}"?`,
      async () => {
        // Also recalculate priority if impact exists
        const currentImpact = (project as any).impact || 'minor';
        const calculatedPriority = calculatePriority(urgencyValue as Urgency, currentImpact as Impact);
        const dbPriority = calculatedPriority === 'critical' ? 'urgent' : calculatedPriority;
        await updateProject(project.id, {
          urgency: urgencyValue,
          priority: dbPriority as ProjectPriority
        });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    );
  };

  const handleUpdateImpact = (impactValue: string) => {
    const label = impactConfig[impactValue]?.label || impactValue;
    showConfirmation(
      'Ubah Impact',
      `Apakah Anda yakin ingin mengubah Impact menjadi "${label}"?`,
      async () => {
        // Also recalculate priority if urgency exists
        const currentUrgency = (project as any).urgency || 'medium';
        const calculatedPriority = calculatePriority(currentUrgency as Urgency, impactValue as Impact);
        const dbPriority = calculatedPriority === 'critical' ? 'urgent' : calculatedPriority;
        await updateProject(project.id, {
          impact: impactValue,
          priority: dbPriority as ProjectPriority
        });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    );
  };

  const handleUpdateProgressStatus = (progressStatus: ProjectProgressStatus) => {
    showConfirmation(
      'Ubah Status Progres',
      `Apakah Anda yakin ingin mengubah status progres proyek menjadi "${progressStatusConfig[progressStatus].label}"?`,
      async () => {
        await updateProject(project.id, { progress_status: progressStatus });
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    );
  };

  const handleDeleteProject = () => {
    showConfirmation(
      'Hapus Proyek',
      `Apakah Anda yakin ingin menghapus proyek "${project.title}"? Semua task dan data terkait akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.`,
      async () => {
        const result = await deleteProject(project.id);
        setConfirmDialog(prev => ({ ...prev, open: false }));
        if (result.success) {
          navigate('/manage');
        }
      }
    );
  };

  // Only super admin can directly edit projects
  const canEdit = isSuperAdmin;

  return (
    <SimpleLayout>
      <div className="space-y-6">
        {/* Back Button & Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge variant="outline" className={cn('text-xs', statusConfig[project.status]?.className || 'bg-muted text-muted-foreground')}>
                {statusConfig[project.status]?.label || project.status}
              </Badge>
              {/* Emergency Effort - Editable by Project Executor */}
              {(project.status === 'approved' || project.status === 'active') && (
                isExecutorViewing ? (
                  <Select value={(project as any).urgency || 'medium'} onValueChange={(v) => handleUpdateUrgency(v)}>
                    <SelectTrigger className="h-6 w-auto gap-1 px-2 text-xs border-dashed">
                      <span className={cn('font-medium')}>{urgencyConfig[(project as any).urgency || 'medium']?.label || 'Sedang'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {urgencyOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (project as any).urgency ? (
                  <Badge variant="outline" className={cn('text-xs', urgencyConfig[(project as any).urgency]?.className || '')}>
                    {urgencyConfig[(project as any).urgency]?.label || (project as any).urgency}
                  </Badge>
                ) : null
              )}
              {/* Impact - Editable by Super Admin */}
              {(project.status === 'approved' || project.status === 'active') && (
                isSuperAdmin ? (
                  <Select value={(project as any).impact || 'minor'} onValueChange={(v) => handleUpdateImpact(v)}>
                    <SelectTrigger className="h-6 w-auto gap-1 px-2 text-xs border-dashed">
                      <span className={cn('font-medium')}>{impactConfig[(project as any).impact || 'minor']?.label || 'Minor'}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {impactOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (project as any).impact ? (
                  <Badge variant="outline" className={cn('text-xs', impactConfig[(project as any).impact]?.className || '')}>
                    {impactConfig[(project as any).impact]?.label || (project as any).impact}
                  </Badge>
                ) : null
              )}
              {/* Calculated Priority Badge - read only */}
              {(project.status === 'approved' || project.status === 'active') && (project as any).urgency && (project as any).impact && (
                (() => {
                  const calc = calculatePriority(
                    ((project as any).urgency || 'medium') as Urgency,
                    ((project as any).impact || 'minor') as Impact
                  );
                  const info = matrixPriorityConfig[calc];
                  return (
                    <Badge variant="outline" className={cn('text-xs', info?.className || 'bg-muted text-muted-foreground')}>
                      Prioritas: {info?.label || calc}
                    </Badge>
                  );
                })()
              )}
              {/* Fallback: show old priority if no urgency/impact set yet */}
              {(project.status !== 'approved' && project.status !== 'active') && (
                <Badge variant="outline" className={cn('text-xs', priorityConfig[project.priority]?.className || 'bg-muted text-muted-foreground')}>
                  {priorityConfig[project.priority]?.label || project.priority || 'Tidak Ada'}
                </Badge>
              )}
              {/* Progress Status Badge/Selector */}
              {(project.status === 'approved' || project.status === 'active') && (
                isSuperAdmin ? (
                  <Select value={project.progress_status || 'in_progress'} onValueChange={(v) => handleUpdateProgressStatus(v as ProjectProgressStatus)}>
                    <SelectTrigger className="h-6 w-auto gap-1 px-2 text-xs border-dashed">
                      {(() => {
                        const status = project.progress_status || 'in_progress';
                        const Icon = progressStatusConfig[status].icon;
                        return (
                          <span className={cn('font-medium flex items-center gap-1')}>
                            <Icon className="w-3 h-3" />
                            {progressStatusConfig[status].label}
                          </span>
                        );
                      })()}
                    </SelectTrigger>
                    <SelectContent>
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
                ) : project.progress_status && (
                  (() => {
                    const config = progressStatusConfig[project.progress_status];
                    const Icon = config.icon;
                    return (
                      <Badge variant="outline" className={cn('text-xs', config.className)}>
                        <Icon className="w-3 h-3 mr-1" />
                        {config.label}
                      </Badge>
                    );
                  })()
                )
              )}
            </div>
            {isEditing ? (
              <Input value={editForm.title} onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                className="text-2xl font-bold h-auto py-1" placeholder="Judul proyek" />
            ) : (
              <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
            )}
          </div>
          <div className="flex gap-2">
            {/* Super Admin: Assign Users & Unit Kerja Buttons */}
            {isSuperAdmin && project.status === 'approved' && !isEditing && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowAssignmentDialog(true)} className="gap-2">
                  <Users className="w-4 h-4" /> Assign User
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowUnitKerjaAssignmentDialog(true)} className="gap-2">
                  <Building2 className="w-4 h-4" /> Assign Unit Kerja
                </Button>
              </>
            )}
            {/* Admin Delete Button */}
            {isSuperAdmin && !isEditing && (
              <Button variant="outline" size="sm" onClick={handleDeleteProject} className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="w-4 h-4" /> Hapus
              </Button>
            )}
            {/* Admin Edit Button */}
            {canEdit && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-2">
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
            )}
            {/* User Edit Request Button - only for approved projects */}
            {isProjectOwner && project.status === 'approved' && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setShowEditRequestDialog(true)} className="gap-2">
                <Send className="w-4 h-4" /> Ajukan Perubahan
              </Button>
            )}
            {isEditing && (
              <>
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} className="gap-2">
                  <X className="w-4 h-4" /> Batal
                </Button>
                <Button size="sm" onClick={handleSaveDetails} className="gap-2">
                  <Save className="w-4 h-4" /> Simpan
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Project Info Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Building2 className="w-5 h-5 text-primary" /></div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Unit</p>
                  {isEditing ? (
                    <Input value={editForm.unit} onChange={(e) => setEditForm(prev => ({ ...prev, unit: e.target.value }))}
                      className="h-8 mt-1" />
                  ) : (
                    <p className="font-semibold">{project.unit}</p>
                  )}
                  {unitKerjaAssignments.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {unitKerjaAssignments.map(a => (
                        <Badge key={a.id} variant="outline" className="text-xs bg-primary/5">
                          <Building2 className="w-3 h-3 mr-1" />
                          {a.unit_kerja?.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><User className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Pengaju</p>
                  <p className="font-semibold">{project.requester_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><UserCheck className="w-5 h-5 text-primary" /></div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">PIC</p>
                  {isEditing ? (
                    <Select value={editForm.pic || '_none'} onValueChange={(v) => setEditForm(prev => ({ ...prev, pic: v === '_none' ? '' : v }))}>
                      <SelectTrigger className="h-8 mt-1">
                        <SelectValue placeholder="Pilih PIC" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Belum ditentukan</SelectItem>
                        {activePicOptions.map(opt => (
                          <SelectItem key={opt.name} value={opt.name}>{opt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-semibold">{project.pic || 'Belum ditentukan'}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Calendar className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Periode</p>
                  {isEditing ? (
                    <div className="flex gap-2 mt-1">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("text-xs", !editForm.start_date && "text-muted-foreground")}>
                            {editForm.start_date ? format(editForm.start_date, "d/M/yy") : "Mulai"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={editForm.start_date || undefined} onSelect={(d) => setEditForm(prev => ({ ...prev, start_date: d || null }))} /></PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("text-xs", !editForm.end_date && "text-muted-foreground")}>
                            {editForm.end_date ? format(editForm.end_date, "d/M/yy") : "Selesai"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0"><CalendarComponent mode="single" selected={editForm.end_date || undefined} onSelect={(d) => setEditForm(prev => ({ ...prev, end_date: d || null }))} /></PopoverContent>
                      </Popover>
                    </div>
                  ) : (
                    <p className="font-semibold">
                      {project.start_date && project.end_date
                        ? `${format(parseISO(project.start_date), 'd MMM yyyy', { locale: localeId })} - ${format(parseISO(project.end_date), 'd MMM yyyy', { locale: localeId })}`
                        : 'Belum ditentukan'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Description Card */}
        <Card>
          <CardHeader><CardTitle>Deskripsi Proyek</CardTitle></CardHeader>
          <CardContent>
            {isEditing ? (
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full min-h-[100px] p-3 border border-border rounded-md bg-background resize-y"
                placeholder="Deskripsi proyek..."
              />
            ) : (
              <p className="text-muted-foreground whitespace-pre-wrap">{project.description}</p>
            )}
          </CardContent>
        </Card>

        {/* Attachment Card */}
        {project.attachment_url && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="w-5 h-5" />
                File User Requirement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const isImageUrl = (url: string) => {
                  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
                  const lowerUrl = url.toLowerCase();
                  return imageExtensions.some(ext => lowerUrl.includes(ext));
                };

                if (isImageUrl(project.attachment_url)) {
                  return (
                    <a
                      href={project.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <div className="relative group">
                        <img
                          src={project.attachment_url}
                          alt="File User Requirement"
                          className="max-w-full max-h-96 rounded-lg border object-contain hover:opacity-90 transition-opacity cursor-pointer"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                          <span className="text-sm font-medium flex items-center gap-1">
                            <ExternalLink className="w-4 h-4" />
                            Buka Gambar
                          </span>
                        </div>
                      </div>
                    </a>
                  );
                } else {
                  return (
                    <a
                      href={project.attachment_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Lihat File User Requirement</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  );
                }
              })()}
            </CardContent>
          </Card>
        )}

        {/* Project Documents Section */}
        {(project.status === 'approved' || project.status === 'active') && (
          <ProjectDocumentsSection projectId={project.id} canManage={isSuperAdmin || project.requester_id === user.id} />
        )}

        {project.admin_note && (
          <Card className={cn(
            "border-l-4",
            project.status === 'rejected' && "border-l-destructive",
            project.status === 'revision' && "border-l-warning",
            project.status === 'approved' && "border-l-success"
          )}>
            <CardHeader><CardTitle className="text-base">Catatan Admin</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{project.admin_note}</p>
            </CardContent>
          </Card>
        )}

        {/* Kendala Section - Only for approved projects */}
        {project.status === 'approved' && (
          <KendalaSection
            project={project}
            isSuperAdmin={isSuperAdmin}
            isProjectExecutor={isExecutorViewing}
            onUpdate={() => {
              window.location.reload();
            }}
          />
        )}

        {/* Monev Summary Section - Only for approved projects */}
        {project.status === 'approved' && (
          <MonevSummarySection
            project={project}
            tasks={tasks}
            isSuperAdmin={isSuperAdmin}
            onUpdate={() => {
              // Force refetch projects
              window.location.reload();
            }}
          />
        )}

        {/* Pending Reminder Days - Super Admin only, for pending projects */}
        {isSuperAdmin && (project.status === 'pending' || project.status === 'pending_creation') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Pengaturan Reminder Pending
              </CardTitle>
              <CardDescription>
                Atur berapa hari setelah pengajuan sistem mengirim reminder bahwa proyek ini masih pending.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Label htmlFor="reminder-days">Kirim reminder setelah</Label>
                <Select
                  value={String((project as any).pending_reminder_days || 30)}
                  onValueChange={async (value) => {
                    const days = parseInt(value);
                    await updateProject(project.id, { pending_reminder_days: days } as any);
                  }}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 hari</SelectItem>
                    <SelectItem value="10">10 hari</SelectItem>
                    <SelectItem value="14">14 hari</SelectItem>
                    <SelectItem value="21">21 hari</SelectItem>
                    <SelectItem value="30">30 hari</SelectItem>
                    <SelectItem value="45">45 hari</SelectItem>
                    <SelectItem value="60">60 hari</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground">sejak pengajuan</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Task Tracker & Timeline - Only for approved projects */}
        {project.status === 'approved' && (
          <Tabs defaultValue="tracker" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tracker">Task Tracker</TabsTrigger>
              <TabsTrigger value="reports">Laporan Harian</TabsTrigger>
              <TabsTrigger value="meetings">Meeting</TabsTrigger>
            </TabsList>

            <TabsContent value="tracker" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                  <CardTitle>Task Tracker</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    {/* Executor: Daily Report Button */}
                    {isExecutorViewing && tasks.length > 0 && (
                      <Button onClick={() => setShowDailyReportDialog(true)} variant="default" className="gap-2">
                        <FileText className="w-4 h-4" />
                        Buat Laporan Harian
                      </Button>
                    )}

                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {project.start_date && project.end_date ? (
                    <SpreadsheetGantt
                      tasks={tasks}
                      projectStartDate={project.start_date}
                      projectEndDate={project.end_date}
                      onAddTask={addTask}
                      onUpdateTask={updateTask}
                      onDeleteTask={deleteTask}
                      projectId={project.id}
                      project={project}
                      isAdmin={isSuperAdmin}
                      isProjectExecutor={isExecutorViewing}
                      isProjectOwner={isProjectOwner || false}
                    />
                  ) : (
                    <div className="px-4 py-8 text-center text-muted-foreground">
                      <p>Tanggal proyek belum ditentukan</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Super Admin: Manual Progress Override Section */}
              {isSuperAdmin && tasks.length > 0 && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Edit2 className="w-5 h-5" />
                      Override Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Klik task untuk mengubah progress secara manual jika diperlukan.
                    </p>
                    <div className="grid gap-2">
                      {tasks.map(task => {
                        const extendedTask = task as GanttTask & { progress_override?: number };
                        const hasOverride = extendedTask.progress_override !== null && extendedTask.progress_override !== undefined;
                        return (
                          <button
                            key={task.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 text-left transition-colors"
                            onClick={() => {
                              setSelectedTaskForOverride(task);
                              setShowProgressOverrideDialog(true);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">{task.wbs_number}</span>
                              <span className="font-medium">{task.name}</span>
                            </div>
                            <Badge variant={hasOverride ? "default" : "outline"}>
                              {hasOverride ? 'Override: ' : 'Progress: '}{task.progress}%
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="reports" className="mt-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Laporan Harian</CardTitle>
                  {isExecutorViewing && tasks.length > 0 && (
                    <Button onClick={() => setShowDailyReportDialog(true)} className="gap-2">
                      <FileText className="w-4 h-4" />
                      Buat Laporan
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <DailyReportsView
                    key={dailyReportsKey}
                    projectId={project.id}
                    tasks={tasks}
                    projectTitle={project.title}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meetings" className="mt-4">
              <ProjectMeetingsSection
                projectId={project.id}
                canManage={isSuperAdmin || project.requester_id === user.id}
              />
            </TabsContent>

          </Tabs>
        )}
      </div>

      <ConfirmChangeDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
      />

      {/* User Edit Request Dialog */}
      {project && (
        <UserEditRequestDialog
          project={project}
          open={showEditRequestDialog}
          onClose={() => setShowEditRequestDialog(false)}
        />
      )}



      {/* Daily Report Dialog for Executor */}
      {project && (
        <DailyReportDialog
          open={showDailyReportDialog}
          onOpenChange={setShowDailyReportDialog}
          tasks={tasks}
          projectId={project.id}
          onReportSubmitted={() => {
            setDailyReportsKey(prev => prev + 1);
          }}
        />
      )}

      {/* Progress Override Dialog for Super Admin */}
      {selectedTaskForOverride && (
        <ProgressOverrideDialog
          open={showProgressOverrideDialog}
          onOpenChange={setShowProgressOverrideDialog}
          task={selectedTaskForOverride}
          onProgressUpdated={() => {
            setShowProgressOverrideDialog(false);
            setSelectedTaskForOverride(null);
          }}
        />
      )}

      {/* Assignment Dialog for Super Admin */}
      {project && (
        <ProjectAssignmentDialog
          projectId={project.id}
          projectTitle={project.title}
          open={showAssignmentDialog}
          onClose={() => setShowAssignmentDialog(false)}
        />
      )}

      {/* Unit Kerja Assignment Dialog for Super Admin */}
      {project && (
        <UnitKerjaAssignmentDialog
          projectId={project.id}
          projectTitle={project.title}
          open={showUnitKerjaAssignmentDialog}
          onClose={() => setShowUnitKerjaAssignmentDialog(false)}
        />
      )}
    </SimpleLayout>
  );
}
