import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle, Search, AlertTriangle, Eye, Filter, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useMasterProyek } from '@/hooks/useMasterProyek';
import { useToast } from '@/hooks/use-toast';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { ProjectEvaluationDialog } from '@/components/approval/ProjectEvaluationDialog';
import { Project, ProjectStatus } from '@/types/project';
import { quadrantConfig } from '@/lib/priorityMatrix';
import type { SopAssessmentDecisionPayload } from '@/types/sopPriority2026';
import { finalDecisionConfig, recommendationConfig } from '@/lib/priorityScoring';
import { buildPriorityAssessmentView } from '@/lib/priorityAssessmentView';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export default function ApprovalQueue() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const { projects, updateProjectStatus, recordPriorityAssessment, loading: projectsLoading } = useProjects();
  const { masterProyek } = useMasterProyek();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [masterFilter, setMasterFilter] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isEvaluationOpen, setIsEvaluationOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    // Only super admins can access approval queue
    if (!authLoading && user && !isSuperAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isSuperAdmin, navigate]);

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isSuperAdmin) return null;

  const matchesFilters = (p: Project) => {
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) ||
                         p.requester_name.toLowerCase().includes(search.toLowerCase());
    const matchesMaster = masterFilter === 'all' || p.master_proyek_id === masterFilter;
    return matchesSearch && matchesMaster;
  };

  // Perlu evaluasi oleh HTO
  const pendingProjects = projects.filter(p => p.status === 'pending' && matchesFilters(p));

  // Keputusan "Ditunda" yang sedang menunggu konfirmasi jadwal dari pengaju.
  const deprioritizedProjects = projects.filter(p => p.status === 'deprioritized' && matchesFilters(p));

  const getMasterProyekName = (id?: string) => {
    if (!id) return null;
    const mp = masterProyek.find(m => m.id === id);
    return mp?.name;
  };

  const handleOpenEvaluation = (project: Project) => {
    setSelectedProject(project);
    setIsEvaluationOpen(true);
  };

  const handleCloseEvaluation = () => {
    setSelectedProject(null);
    setIsEvaluationOpen(false);
  };



  // Function to send notification
  const sendNotification = async (
    type: 'proposal_approved' | 'proposal_rejected' | 'proposal_revision' | 'priority_decision_required',
    userId: string,
    projectId: string,
    projectTitle: string,
    adminNote?: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('send-notification', {
        body: {
          type,
          userId,
          projectId,
          projectTitle,
          adminNote,
          sendEmail: true, // Always send email for proposal decisions
        },
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  };

  const handlePriorityDecision = async (
    projectId: string,
    payload: SopAssessmentDecisionPayload,
  ): Promise<boolean> => {
    const project = projects.find(p => p.id === projectId);

    const result = await recordPriorityAssessment(projectId, payload);
    if (!result.success) return false;

    // GATED sengaja TIDAK memicu notifikasi ke pengaju. Keempat tipe yang
    // tersedia di edge function semuanya menyesatkan untuk kondisi ini:
    // `proposal_approved` menjanjikan eksekusi, `priority_decision_required`
    // meminta pengaju menyetujui jadwal yang belum ada, `proposal_revision`
    // mengarahkan ke formulir revisi padahal status tetap `pending`, dan
    // `proposal_rejected` dilarang SOP 5.3. Klarifikasi finansial ditempuh
    // lewat sesi probing yang dijalankan manual di luar sistem.
    const isGated = payload.assessment.final_decision === 'gated';
    let notificationSent = true;
    if (project && !isGated) {
      const isDeferred = payload.assessment.final_decision === 'deferred';
      const isRejected = payload.assessment.final_decision === 'rejected';
      const isConditional = payload.assessment.final_decision === 'conditional';
      notificationSent = await sendNotification(
        isDeferred
          ? 'priority_decision_required'
          : isRejected
            ? 'proposal_rejected'
            : 'proposal_approved',
        project.requester_id,
        projectId,
        payload.editedData.title || project.title,
        isConditional
          ? `Disetujui bersyarat. ${payload.assessment.final_decision_note}`
          : payload.assessment.final_decision_note,
      );
    }

    const decisionLabel = finalDecisionConfig[payload.assessment.final_decision].label;
    toast({
      title: notificationSent ? 'Penilaian Prioritas Tersimpan' : 'Penilaian Tersimpan, Notifikasi Gagal',
      description: notificationSent
        ? isGated
          ? `${decisionLabel}. Proyek tetap di Antrean Approval dan masuk lane GATED di Master Queue. Pengaju TIDAK dinotifikasi — jadwalkan sesi probing untuk justifikasi biaya-manfaat.`
          : payload.assessment.final_decision === 'deferred'
            ? `${decisionLabel}. Pengaju diminta meninjau jadwal usulan.`
            : payload.assessment.final_decision === 'conditional'
              ? `${decisionLabel}. Proyek masuk portofolio dengan syarat yang tercatat pada snapshot.`
              : `${decisionLabel}. Snapshot penilaian dan keputusan telah disimpan.`
        : 'Keputusan sudah aman tersimpan, tetapi notifikasi kepada pengaju perlu dikirim ulang.',
      variant: notificationSent ? 'default' : 'destructive',
    });
    return true;
  };

  const handleRevision = async (projectId: string, revisionNote: string): Promise<boolean> => {
    const project = projects.find(p => p.id === projectId);
    const result = await updateProjectStatus(projectId, 'revision' as ProjectStatus, revisionNote);

    if (result.success) {
      // Send notification to user
      if (project) {
        await sendNotification(
          'proposal_revision',
          project.requester_id,
          projectId,
          project.title,
          revisionNote
        );
      }
      
      toast({
        title: 'Permintaan Revisi Dikirim',
        description: 'Pengaju akan menerima notifikasi untuk memperbaiki pengajuan.',
      });
      return true;
    } else {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan saat mengirim permintaan revisi.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const priorityConfig = {
    low: { label: 'Rendah', className: 'bg-muted text-muted-foreground' },
    medium: { label: 'Sedang', className: 'bg-primary/10 text-primary' },
    high: { label: 'Tinggi', className: 'bg-warning/10 text-warning' },
    urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
  };

  return (
    <SimpleLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <ClipboardList className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Antrean Approval</h1>
              <p className="text-muted-foreground">
                {pendingProjects.length} perlu evaluasi &middot; {deprioritizedProjects.length} menunggu pengaju
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari proyek atau pengaju..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-12"
              />
            </div>
            <Select value={masterFilter} onValueChange={setMasterFilter}>
              <SelectTrigger className="w-40 h-12">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter Proyek" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Proyek</SelectItem>
                {masterProyek.map((mp) => (
                  <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              <ClipboardList className="w-4 h-4" />
              Perlu Evaluasi ({pendingProjects.length})
            </TabsTrigger>
            <TabsTrigger value="deprioritized" className="gap-2">
              <Clock className="w-4 h-4" />
              Menunggu Pengaju ({deprioritizedProjects.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4 mt-0">
        {/* Project List */}
        {pendingProjects.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-card-foreground">Tidak Ada Antrean</h3>
            <p className="text-muted-foreground">Semua pengajuan telah ditinjau</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingProjects.map((project) => (
              <div key={project.id} className="bg-card border border-border rounded-2xl p-6 shadow-sm hover:border-primary/30 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getMasterProyekName(project.master_proyek_id) && (
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {getMasterProyekName(project.master_proyek_id)}
                        </Badge>
                      )}
                      <Badge variant="outline" className={cn('text-xs', priorityConfig[project.priority].className)}>
                        Prioritas intake: {priorityConfig[project.priority].label}
                      </Badge>
                      {project.update_requested && (
                        <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Update Diminta
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-card-foreground">{project.title}</h3>
                    <p className="text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-muted-foreground">
                      <span><strong>Unit:</strong> {project.unit}</span>
                      <span>•</span>
                      <span><strong>Pengaju:</strong> {project.requester_name}</span>
                      {project.pic && (
                        <>
                          <span>•</span>
                          <span><strong>PIC:</strong> {project.pic}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{format(parseISO(project.created_at), 'dd MMM yyyy', { locale: localeId })}</span>
                      {project.start_date && project.end_date && (
                        <>
                          <span>•</span>
                          <span>
                            <strong>Periode:</strong> {format(parseISO(project.start_date), 'd/M/yy')} - {format(parseISO(project.end_date), 'd/M/yy')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-row lg:flex-col gap-2">
                    <Button 
                      size="lg" 
                      className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                      onClick={() => handleOpenEvaluation(project)}
                    >
                      <Eye className="w-5 h-5" />
                      Evaluasi
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </TabsContent>

          {/* Keputusan Ditunda: read-only, HTO hanya memantau konfirmasi pengaju. */}
          <TabsContent value="deprioritized" className="space-y-4 mt-0">
            {deprioritizedProjects.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-card-foreground">Tidak Ada yang Tertahan</h3>
                <p className="text-muted-foreground">Tidak ada proyek yang menunggu keputusan pengaju</p>
              </div>
            ) : (
              <div className="space-y-4">
                {deprioritizedProjects.map((project) => (
                  <div key={project.id} className="bg-card border border-warning/30 rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {getMasterProyekName(project.master_proyek_id) && (
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {getMasterProyekName(project.master_proyek_id)}
                        </Badge>
                      )}
                      {!project.current_priority_assessment_id && !project.current_priority_assessment && (
                        <Badge variant="outline" className={cn('text-xs', priorityConfig[project.priority].className)}>
                          Prioritas lama: {priorityConfig[project.priority].label}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                        <Clock className="w-3 h-3 mr-1" />
                        Menunggu Keputusan Pengaju
                      </Badge>
                      {project.priority_quadrant && (
                        <Badge
                          variant="outline"
                          className={cn('text-xs', quadrantConfig[project.priority_quadrant].className)}
                        >
                          {quadrantConfig[project.priority_quadrant].label}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-card-foreground">{project.title}</h3>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span><strong>Unit:</strong> {project.unit}</span>
                      <span>•</span>
                      <span><strong>Pengaju:</strong> {project.requester_name}</span>
                      {project.current_priority_assessment ? (
                        <>
                          <span>•</span>
                          <span>
                            <strong>Penilaian:</strong>{' '}
                            {(() => {
                              const view = buildPriorityAssessmentView(project.current_priority_assessment);
                              return `${view.scoreText} / ${recommendationConfig[view.recommendation ?? 'queued'].label}`;
                            })()}
                          </span>
                        </>
                      ) : !project.current_priority_assessment_id && project.effort ? (
                        <>
                          <span>•</span>
                          <span><strong>Penilaian legacy:</strong> Effort {project.effort}/5</span>
                        </>
                      ) : null}
                      {project.proposed_start_date && project.proposed_end_date && (
                        <>
                          <span>•</span>
                          <span>
                            <strong>Usulan Jadwal:</strong> {format(parseISO(project.proposed_start_date), 'd/M/yy')} - {format(parseISO(project.proposed_end_date), 'd/M/yy')}
                          </span>
                        </>
                      )}
                    </div>

                    {project.current_priority_assessment?.final_decision_note && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Keputusan Steering Committee:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {finalDecisionConfig[project.current_priority_assessment.final_decision].label} —{' '}
                          {project.current_priority_assessment.final_decision_note}
                        </p>
                      </div>
                    )}

                    {!project.current_priority_assessment_id && !project.current_priority_assessment && project.priority_rationale && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Dasar Penilaian:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{project.priority_rationale}</p>
                      </div>
                    )}

                    {project.priority_note && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Konteks dari HTO:</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{project.priority_note}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Evaluation Dialog */}
      <ProjectEvaluationDialog
        project={selectedProject}
        open={isEvaluationOpen}
        onClose={handleCloseEvaluation}
        onPriorityDecision={handlePriorityDecision}
        onRevision={handleRevision}
      />
    </SimpleLayout>
  );
}
