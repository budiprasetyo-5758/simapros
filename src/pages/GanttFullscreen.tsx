import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useIsAssignedToProject } from '@/hooks/useIsAssignedToProject';
import { useProjects, useGanttTasks } from '@/hooks/useProjects';
import { SpreadsheetGantt } from '@/components/project/SpreadsheetGantt';
import { cn } from '@/lib/utils';

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

export default function GanttFullscreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isSuperAdmin, isProjectExecutor } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const { tasks, addTask, updateTask, deleteTask } = useGanttTasks(id || '');
  const { isAssigned, loading: assignmentLoading } = useIsAssignedToProject(id);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || projectsLoading || assignmentLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  const project = projects.find(p => p.id === id);

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Proyek tidak ditemukan</p>
        <Button variant="outline" onClick={() => window.close()}>
          Tutup Tab
        </Button>
      </div>
    );
  }

  // Check if user has access - including assigned users
  const hasAccess = isSuperAdmin || 
    (isProjectExecutor && (project.status === 'approved' || project.status === 'active')) ||
    project.requester_id === user.id ||
    isAssigned;

  if (!hasAccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">Anda tidak memiliki akses ke proyek ini</p>
        <Button variant="outline" onClick={() => window.close()}>
          Tutup Tab
        </Button>
      </div>
    );
  }

  const isExecutorViewing = isProjectExecutor && !isSuperAdmin;
  const isProjectOwner = user && project.requester_id === user.id && !isSuperAdmin && !isProjectExecutor;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-4 max-w-[100vw]">
          <div className="flex items-center gap-3 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(`/project/${id}`)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <Badge variant="outline" className={cn('text-xs shrink-0', statusConfig[project.status]?.className || 'bg-muted text-muted-foreground')}>
                  {statusConfig[project.status]?.label || project.status}
                </Badge>
                <Badge variant="outline" className={cn('text-xs shrink-0', priorityConfig[project.priority]?.className || 'bg-muted text-muted-foreground')}>
                  {priorityConfig[project.priority]?.label || project.priority || 'Tidak Ada'}
                </Badge>
              </div>
              <h1 className="text-lg font-bold text-foreground truncate">{project.title}</h1>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate(`/project/${id}`)}
            className="gap-2 shrink-0"
          >
            <ExternalLink className="w-4 h-4" />
            Detail Proyek
          </Button>
        </div>
      </div>

      {/* Gantt Chart - Full Height */}
      <div className="flex-1 overflow-hidden p-4">
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
            isFullscreen={true}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Tanggal proyek belum ditentukan</p>
          </div>
        )}
      </div>
    </div>
  );
}
