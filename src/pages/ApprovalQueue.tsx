import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle, Search, AlertTriangle, Eye, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useMasterProyek } from '@/hooks/useMasterProyek';
import { useToast } from '@/hooks/use-toast';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { ProjectEvaluationDialog } from '@/components/approval/ProjectEvaluationDialog';
import { Project, ProjectStatus } from '@/types/project';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

export default function ApprovalQueue() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const { projects, updateProjectStatus, updateProject, loading: projectsLoading } = useProjects();
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

  const pendingProjects = projects.filter(p => {
    const matchesStatus = p.status === 'pending';
    const matchesSearch = p.title.toLowerCase().includes(search.toLowerCase()) || 
                         p.requester_name.toLowerCase().includes(search.toLowerCase());
    const matchesMaster = masterFilter === 'all' || p.master_proyek_id === masterFilter;
    return matchesStatus && matchesSearch && matchesMaster;
  });

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
    type: 'proposal_approved' | 'proposal_rejected' | 'proposal_revision',
    userId: string,
    projectId: string,
    projectTitle: string,
    adminNote?: string
  ) => {
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          type,
          userId,
          projectId,
          projectTitle,
          adminNote,
          sendEmail: true, // Always send email for proposal decisions
        },
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handleApprove = async (projectId: string, editedData: Partial<Project>, technicalNotes: string) => {
    const project = projects.find(p => p.id === projectId);
    
    // First update the project with edited data
    const updateResult = await updateProject(projectId, {
      ...editedData,
      admin_note: technicalNotes || undefined,
    });

    if (!updateResult.success) {
      toast({
        title: 'Gagal',
        description: 'Gagal memperbarui data proyek.',
        variant: 'destructive',
      });
      return;
    }

    // Then update status to approved
    const statusResult = await updateProjectStatus(projectId, 'approved' as ProjectStatus);

    if (statusResult.success) {
      // Send notification to user
      if (project) {
        await sendNotification(
          'proposal_approved',
          project.requester_id,
          projectId,
          editedData.title || project.title,
          technicalNotes
        );
      }

      // Task creation is now manual - triggered by Executor via ProjectDetail page
      toast({
        title: 'Proyek Disetujui',
        description: 'Proyek telah disetujui. Eksekutor dapat menambahkan task di halaman detail proyek.',
      });
    } else {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan saat menyetujui proyek.',
        variant: 'destructive',
      });
    }
  };

  const handleRevision = async (projectId: string, revisionNote: string) => {
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
    } else {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan saat mengirim permintaan revisi.',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (projectId: string, rejectNote: string) => {
    const project = projects.find(p => p.id === projectId);
    const result = await updateProjectStatus(projectId, 'rejected' as ProjectStatus, rejectNote);

    if (result.success) {
      // Send notification to user
      if (project) {
        await sendNotification(
          'proposal_rejected',
          project.requester_id,
          projectId,
          project.title,
          rejectNote
        );
      }
      
      toast({
        title: 'Proyek Ditolak',
        description: 'Pengajuan telah ditolak dengan catatan.',
      });
    } else {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan saat menolak proyek.',
        variant: 'destructive',
      });
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
              <p className="text-muted-foreground">{pendingProjects.length} proyek menunggu evaluasi</p>
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
                        {priorityConfig[project.priority].label}
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
      </div>

      {/* Evaluation Dialog */}
      <ProjectEvaluationDialog
        project={selectedProject}
        open={isEvaluationOpen}
        onClose={handleCloseEvaluation}
        onApprove={handleApprove}
        onRevision={handleRevision}
        onReject={handleReject}
      />
    </SimpleLayout>
  );
}
