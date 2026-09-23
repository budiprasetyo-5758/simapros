import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Project, StageNotes, ProjectStage, ProjectPriority } from '@/types/project';
import { SpreadsheetGantt } from './SpreadsheetGantt';
import { PhaseProgress } from './PhaseProgress';
import { ConfirmChangeDialog } from './ConfirmChangeDialog';

import { useGanttTasks } from '@/hooks/useProjects';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { finalDecisionConfig, recommendationConfig } from '@/lib/priorityScoring';
import { quadrantConfig } from '@/lib/priorityMatrix';
import { buildPriorityAssessmentView } from '@/lib/priorityAssessmentView';
import { Calendar, Building2, User, AlertTriangle, RefreshCw, Edit2, Save, X } from 'lucide-react';

interface ProjectDetailModalProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onUpdateProject?: (projectId: string, updates: Partial<Project>) => Promise<{ success: boolean }>;
  onRequestUpdate?: (projectId: string) => Promise<{ success: boolean }>;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: 'Menunggu', className: 'bg-muted text-muted-foreground' },
  approved: { label: 'Disetujui', className: 'bg-success/10 text-success border-success/20' },
  active: { label: 'Aktif', className: 'bg-primary/10 text-primary border-primary/20' },
  rejected: { label: 'Ditolak', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  revision: { label: 'Revisi', className: 'bg-revision/10 text-revision border-revision/20' },
  pending_creation: { label: 'Menunggu Pembuatan', className: 'bg-warning/10 text-warning border-warning/20' },
  deprioritized: { label: 'Menunggu Keputusan Pengaju', className: 'bg-warning/10 text-warning border-warning/20' },
  withdrawn: { label: 'Ditarik Pengaju', className: 'bg-muted text-muted-foreground border-muted-foreground/20' }
};

const priorityConfig = {
  low: { label: 'Rendah', className: 'bg-muted text-muted-foreground' },
  medium: { label: 'Sedang', className: 'bg-primary/10 text-primary' },
  high: { label: 'Tinggi', className: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
};

export function ProjectDetailModal({ 
  project, 
  open, 
  onClose,
  onUpdateProject,
  onRequestUpdate,
}: ProjectDetailModalProps) {
  const { isSuperAdmin } = useAuth();
  const { tasks, addTask, updateTask, deleteTask } = useGanttTasks(project?.id || '');
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    unit: '',
    start_date: null as Date | null,
    end_date: null as Date | null,
  });
  
  // Confirmation dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  // Reset edit form when project changes
  useEffect(() => {
    if (project) {
      setEditForm({
        title: project.title,
        description: project.description,
        unit: project.unit,
        start_date: project.start_date ? parseISO(project.start_date) : null,
        end_date: project.end_date ? parseISO(project.end_date) : null,
      });
    }
  }, [project]);

  // Reset editing state when modal closes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  if (!project) return null;

  const priorityAssessment = project.current_priority_assessment ?? null;
  const assessmentView = priorityAssessment ? buildPriorityAssessmentView(priorityAssessment) : null;
  const hasTier2Assessment = Boolean(project.current_priority_assessment_id || priorityAssessment);

  const showConfirmation = (title: string, description: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, description, onConfirm });
  };

  const handleStartEdit = () => {
    setEditForm({
      title: project.title,
      description: project.description,
      unit: project.unit,
      start_date: project.start_date ? parseISO(project.start_date) : null,
      end_date: project.end_date ? parseISO(project.end_date) : null,
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      title: project.title,
      description: project.description,
      unit: project.unit,
      start_date: project.start_date ? parseISO(project.start_date) : null,
      end_date: project.end_date ? parseISO(project.end_date) : null,
    });
  };

  const handleSaveDetails = () => {
    // Validate
    if (!editForm.title.trim()) {
      return;
    }
    if (!editForm.description.trim()) {
      return;
    }
    if (!editForm.unit.trim()) {
      return;
    }

    showConfirmation(
      'Simpan Perubahan',
      'Apakah Anda yakin ingin menyimpan perubahan detail proyek ini?',
      async () => {
        if (onUpdateProject) {
          const updates: Partial<Project> = {
            title: editForm.title.trim(),
            description: editForm.description.trim(),
            unit: editForm.unit.trim(),
          };
          
          if (editForm.start_date) {
            updates.start_date = format(editForm.start_date, 'yyyy-MM-dd');
          }
          if (editForm.end_date) {
            updates.end_date = format(editForm.end_date, 'yyyy-MM-dd');
          }
          
          await onUpdateProject(project.id, updates);
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
        setIsEditing(false);
      }
    );
  };

  const handleUpdateStage = (stage: ProjectStage) => {
    const stageLabel = {
      planning: 'Perencanaan',
      execution: 'Pelaksanaan',
      evaluation: 'Evaluasi',
      followup: 'Tindak Lanjut',
    };
    
    showConfirmation(
      'Ubah Fase Proyek',
      `Apakah Anda yakin ingin mengubah fase proyek menjadi "${stageLabel[stage]}"?`,
      async () => {
        if (onUpdateProject) {
          await onUpdateProject(project.id, { project_stage: stage });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    );
  };

  const handleUpdateNote = (stage: ProjectStage, note: string) => {
    const stageLabel = {
      planning: 'Perencanaan',
      execution: 'Pelaksanaan',
      evaluation: 'Evaluasi',
      followup: 'Tindak Lanjut',
    };
    
    showConfirmation(
      'Simpan Catatan',
      `Apakah Anda yakin ingin menyimpan catatan untuk fase "${stageLabel[stage]}"?`,
      async () => {
        if (onUpdateProject) {
          const newStageNotes: StageNotes = {
            ...project.stage_notes,
            [stage]: note,
          };
          await onUpdateProject(project.id, { stage_notes: newStageNotes });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    );
  };

  const handleUpdatePriority = (priority: ProjectPriority) => {
    // Snapshot Tier 2 hanya boleh diganti melalui assessment revision baru.
    if (hasTier2Assessment) return;

    showConfirmation(
      'Ubah Prioritas Proyek',
      `Apakah Anda yakin ingin mengubah prioritas proyek menjadi "${priorityConfig[priority].label}"?`,
      async () => {
        if (onUpdateProject) {
          await onUpdateProject(project.id, { priority });
        }
        setConfirmDialog(prev => ({ ...prev, open: false }));
      }
    );
  };

  const handleRequestUpdate = async () => {
    if (onRequestUpdate) {
      await onRequestUpdate(project.id);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge variant="outline" className={cn('text-xs', statusConfig[project.status]?.className || 'bg-muted text-muted-foreground')}>
                  {statusConfig[project.status]?.label || project.status}
                </Badge>
                {hasTier2Assessment ? (
                  <>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        priorityAssessment
                          ? recommendationConfig[priorityAssessment.calculated_recommendation].className
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {priorityAssessment
                        ? recommendationConfig[priorityAssessment.calculated_recommendation].label
                        : 'Penilaian Tier 2 terkunci'}
                    </Badge>
                    {priorityAssessment && (
                      <Badge variant="outline" className="text-xs">
                        {project.requester_decision === 'accepted' && priorityAssessment.final_decision === 'deferred'
                          ? 'Keputusan awal'
                          : 'Keputusan'}: {finalDecisionConfig[priorityAssessment.final_decision].label}
                      </Badge>
                    )}
                    {project.requester_decision === 'accepted' && priorityAssessment?.final_decision === 'deferred' && (
                      <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                        Jadwal diterima pengaju · Masuk portofolio
                      </Badge>
                    )}
                  </>
                ) : isSuperAdmin && project.status === 'approved' ? (
                  <Select value={project.priority} onValueChange={(v) => handleUpdatePriority(v as ProjectPriority)}>
                    <SelectTrigger className="h-7 w-auto gap-1 px-2 text-xs border-dashed">
                      <span className={cn('font-medium', priorityConfig[project.priority]?.className?.replace('bg-', 'text-')?.split(' ')[1] || 'text-muted-foreground')}>
                        {priorityConfig[project.priority]?.label || project.priority || 'Tidak Ada'}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Rendah</SelectItem>
                      <SelectItem value="medium">Sedang</SelectItem>
                      <SelectItem value="high">Tinggi</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className={cn('text-xs', priorityConfig[project.priority]?.className || 'bg-muted text-muted-foreground')}>
                    {priorityConfig[project.priority]?.label || project.priority || 'Tidak Ada'}
                  </Badge>
                )}
                {project.update_requested && (
                  <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Update Diminta
                  </Badge>
                )}
              </div>
              {isEditing ? (
                <Input
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  className="text-xl font-semibold"
                  placeholder="Judul proyek"
                  maxLength={200}
                />
              ) : (
                <DialogTitle className="text-xl">{project.title}</DialogTitle>
              )}
            </div>
            <div className="flex gap-2">
              {isSuperAdmin && !isEditing && (
                <Button variant="outline" size="sm" onClick={handleStartEdit} className="gap-2">
                  <Edit2 className="w-4 h-4" />
                  Edit
                </Button>
              )}
              {isEditing && (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancelEdit} className="gap-2">
                    <X className="w-4 h-4" />
                    Batal
                  </Button>
                  <Button size="sm" onClick={handleSaveDetails} className="gap-2">
                    <Save className="w-4 h-4" />
                    Simpan
                  </Button>
                </>
              )}
              {!isSuperAdmin && project.status === 'approved' && !project.update_requested && onRequestUpdate && (
                <Button variant="outline" size="sm" onClick={handleRequestUpdate} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Minta Update
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {hasTier2Assessment && (
            <div className="rounded-lg border p-4">
              <div className="mb-4">
                <h4 className="font-medium">Ringkasan Penilaian Prioritas Tier 2</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Snapshot ini bersifat tetap; nilai tidak dihitung ulang dari prioritas legacy.
                </p>
              </div>

              {priorityAssessment ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">{assessmentView?.scoreLabel}</p>
                      <p className="font-semibold">{assessmentView?.scoreText}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Effort</p>
                      <p className="font-semibold">{assessmentView?.effortText}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">Priority Index</p>
                      <p className="font-semibold">{assessmentView?.priorityIndexText}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 p-3">
                      <p className="text-xs text-muted-foreground">
                        {assessmentView?.financialGateLabel ? 'Gate Finansial' : 'Kelayakan'}
                      </p>
                      <p className="font-semibold">
                        {assessmentView?.financialGateLabel ?? assessmentView?.eligibilityLabel}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={cn('text-xs', recommendationConfig[priorityAssessment.calculated_recommendation].className)}
                    >
                      Rekomendasi: {recommendationConfig[priorityAssessment.calculated_recommendation].label}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {project.requester_decision === 'accepted' && priorityAssessment.final_decision === 'deferred'
                        ? 'Keputusan awal Steering Committee'
                        : 'Keputusan'}: {finalDecisionConfig[priorityAssessment.final_decision].label}
                    </Badge>
                    {project.requester_decision === 'accepted' && priorityAssessment.final_decision === 'deferred' && (
                      <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                        Respons pengaju: jadwal diterima, status operasional disetujui
                      </Badge>
                    )}
                    {/* Proyek mandatory tidak punya kuadran: tanpa skor dan effort
                        tidak ada sumbu yang bisa disilangkan. */}
                    {assessmentView?.quadrant && (
                      <Badge
                        variant="outline"
                        className={cn('text-xs', quadrantConfig[assessmentView.quadrant].className)}
                      >
                        {quadrantConfig[assessmentView.quadrant].label}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      Revisi {priorityAssessment.revision_no} · {priorityAssessment.method_version}
                    </Badge>
                  </div>

                  {assessmentView && assessmentView.criterionScores.some((item) => item.score !== null) && (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                      {assessmentView.criterionScores.map(({ key, score }) => (
                        <div key={key} className="rounded-md border p-2 text-center">
                          <p className="text-xs font-medium uppercase">{key}</p>
                          <p className="font-semibold">
                            {score === null ? '-' : `${score}/${assessmentView.scaleMax}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium">Catatan keputusan Steering Committee</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {priorityAssessment.final_decision_note || 'Tidak ada catatan.'}
                    </p>
                  </div>

                  {priorityAssessment.override_reason && (
                    <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
                      <p className="text-sm font-medium">Alasan override rekomendasi</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                        {priorityAssessment.override_reason}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Proyek sudah terikat ke penilaian Tier 2, tetapi detail snapshot tidak tersedia pada sesi ini.
                  Kontrol prioritas legacy tetap dikunci.
                </p>
              )}
            </div>
          )}

          {/* Project Info */}
          {isEditing ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={editForm.unit}
                    onChange={(e) => setEditForm(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="Nama unit"
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tanggal Mulai</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !editForm.start_date && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {editForm.start_date ? format(editForm.start_date, "d MMMM yyyy", { locale: localeId }) : "Pilih tanggal"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={editForm.start_date || undefined}
                        onSelect={(date) => setEditForm(prev => ({ ...prev, start_date: date || null }))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Selesai</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !editForm.end_date && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {editForm.end_date ? format(editForm.end_date, "d MMMM yyyy", { locale: localeId }) : "Pilih tanggal"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={editForm.end_date || undefined}
                        onSelect={(date) => setEditForm(prev => ({ ...prev, end_date: date || null }))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span>Unit: {project.unit}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>Pengaju: {project.requester_name}</span>
                </div>
              </div>
              <div className="space-y-2">
                {project.start_date && project.end_date && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {format(parseISO(project.start_date), 'd MMMM yyyy', { locale: localeId })} - 
                      {format(parseISO(project.end_date), 'd MMMM yyyy', { locale: localeId })}
                    </span>
                  </div>
                )}
                <div className="text-sm text-muted-foreground">
                  Dibuat: {format(parseISO(project.created_at), 'd MMM yyyy HH:mm', { locale: localeId })}
                </div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <h4 className="font-medium mb-2">Deskripsi</h4>
            {isEditing ? (
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsi proyek"
                rows={4}
                maxLength={2000}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{project.description}</p>
            )}
          </div>

          {/* Admin Note */}
          {project.admin_note && (
            <div className={cn(
              'p-4 rounded-lg',
              project.status === 'revision' 
                ? 'bg-revision/5 border border-revision/20' 
                : 'bg-destructive/5 border border-destructive/20'
            )}>
              <h4 className={cn(
                'font-medium mb-2',
                project.status === 'revision' ? 'text-revision' : 'text-destructive'
              )}>
                Catatan Admin
              </h4>
              <p className="text-sm">{project.admin_note}</p>
            </div>
          )}

          {/* Tabs for Active Projects */}
          {project.status === 'approved' && (
            <Tabs defaultValue="tracker" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="tracker">Task Tracker & Timeline</TabsTrigger>
                <TabsTrigger value="progress">Progress Fase</TabsTrigger>
              </TabsList>
              
              <TabsContent value="tracker" className="mt-4">
                {project.start_date && project.end_date ? (
                  <SpreadsheetGantt
                    tasks={tasks}
                    projectStartDate={project.start_date}
                    projectEndDate={project.end_date}
                    onAddTask={addTask}
                    onUpdateTask={updateTask}
                    onDeleteTask={deleteTask}
                    readOnly={!isSuperAdmin}
                    projectId={project.id}
                    project={project}
                  />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Tanggal proyek belum ditentukan</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="progress" className="mt-4">
                <PhaseProgress
                  currentStage={project.project_stage}
                  stageNotes={project.stage_notes}
                  onUpdateStage={isSuperAdmin ? handleUpdateStage : undefined}
                  onUpdateNote={isSuperAdmin ? handleUpdateNote : undefined}
                  readOnly={!isSuperAdmin}
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>

      <ConfirmChangeDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
      />
    </Dialog>
  );
}
