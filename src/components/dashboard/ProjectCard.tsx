import { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Project, ProjectProgressStatus, ProjectPriority } from '@/types/project';
import { Calendar, Building2, FolderKanban, PlayCircle, PauseCircle, CheckCircle2, FileText, User, CalendarPlus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
  showAdminNote?: boolean;
  compact?: boolean;
  editRequestCount?: number;
  showObstaclesPreview?: boolean;
}

 const priorityConfig: Record<ProjectPriority, { label: string; className: string; borderColor: string }> = {
   low: { label: 'Rendah', className: 'bg-muted text-muted-foreground', borderColor: 'border-muted-foreground/30' },
   medium: { label: 'Sedang', className: 'bg-primary/10 text-primary', borderColor: 'border-primary' },
   high: { label: 'Tinggi', className: 'bg-warning/10 text-warning', borderColor: 'border-warning' },
   urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive', borderColor: 'border-destructive' },
};

const progressStatusConfig: Record<ProjectProgressStatus, { label: string; className: string; icon: typeof PlayCircle }> = {
  'in_progress': { label: 'Aktif', className: 'bg-success/10 text-success border-success/20', icon: PlayCircle },
  'on_hold': { label: 'Pending', className: 'bg-warning/10 text-warning border-warning/20', icon: PauseCircle },
  'completed': { label: 'Selesai', className: 'bg-primary/10 text-primary border-primary/20', icon: CheckCircle2 },
};

export function ProjectCard({ project, showAdminNote = true, compact = false, editRequestCount = 0, showObstaclesPreview = false }: ProjectCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (project.status === 'approved') {
      navigate(`/project/${project.id}`);
    }
  };

  return (
    <Card 
      className={cn(
         "transition-all border-l-4",
         priorityConfig[project.priority].borderColor,
        project.status === 'approved' && "cursor-pointer hover:shadow-md hover:border-primary/30",
        compact && "aspect-square flex flex-col"
      )}
      onClick={handleClick}
    >
      <CardHeader className={cn("pb-2", compact && "flex-shrink-0")}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {project.master_proyek && (
            <Badge variant="secondary" className="text-xs font-semibold">
              <FolderKanban className="w-3 h-3 mr-1" />
              {project.master_proyek.name}
            </Badge>
          )}
          <Badge variant="outline" className={cn('text-xs', priorityConfig[project.priority].className)}>
            {priorityConfig[project.priority].label}
          </Badge>
          {(project.status === 'approved' || project.status === 'active') && project.progress_status && (
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
          )}
          {project.project_obstacles?.some(o => !o.is_resolved) && (
            <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20 animate-pulse">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Kendala
            </Badge>
          )}
        </div>
        <h3 className={cn(
          "font-semibold text-card-foreground",
          compact ? "text-sm line-clamp-2" : "text-lg truncate"
        )}>
          {project.title}
        </h3>
      </CardHeader>
      <CardContent className={cn("pt-0", compact && "flex-1 flex flex-col justify-between")}>
        {project.project_obstacles && project.project_obstacles.length > 0 ? (
          <ul className={cn(
            "text-muted-foreground text-xs mb-3 space-y-0",
            compact ? "line-clamp-3" : ""
          )}>
            {project.project_obstacles
              .slice(0, compact ? 2 : 3)
              .map((obs) => (
                <li key={obs.id} className="text-muted-foreground flex items-start gap-1 leading-tight py-0.5">
                  <span className={cn(
                    "mt-1 w-1.5 h-1.5 rounded-full shrink-0",
                    obs.is_resolved ? "bg-success" : "bg-destructive animate-pulse"
                  )} />
                  <span className={cn("line-clamp-1", obs.is_resolved && "line-through opacity-70")}>{obs.note}</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className={cn(
            "text-muted-foreground text-xs mb-3 italic opacity-60",
            compact ? "line-clamp-2" : "line-clamp-1"
          )}>
            Belum ada kendala proyek
          </p>
        )}
        
        <div className={cn(
          "text-sm text-muted-foreground",
          compact ? "space-y-1" : "flex flex-wrap items-center gap-x-4 gap-y-2"
        )}>
          {/* PIC */}
          {project.pic && (
            <div className="flex items-center gap-1">
              <User className="w-4 h-4 flex-shrink-0 text-primary/70" />
              <span className="truncate font-medium">{project.pic}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <Building2 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{project.unit}</span>
          </div>
          {!compact && (
            <div className="flex items-center gap-1">
              <span>Pengaju: {project.requester_name}</span>
            </div>
          )}
          {/* Tanggal Pengajuan */}
          <div className="flex items-center gap-1">
            <CalendarPlus className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">
              {format(parseISO(project.created_at), 'd MMM yy', { locale: localeId })}
            </span>
          </div>
          {project.start_date && project.end_date && (
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                {format(parseISO(project.start_date), 'd MMM', { locale: localeId })} - 
                {format(parseISO(project.end_date), 'd MMM yy', { locale: localeId })}
              </span>
            </div>
          )}
        </div>

         {/* Obstacles Preview */}
         {showObstaclesPreview && project.project_obstacles && project.project_obstacles.length > 0 && !compact && (
           <div className="mt-4 p-3 rounded-lg text-sm bg-warning/5 border border-warning/20">
             <p className="font-medium mb-1 flex items-center gap-1 text-warning">
               <AlertTriangle className="w-4 h-4" />
               Kendala Proyek Terbaru:
             </p>
             <p className="text-muted-foreground line-clamp-2">
               {project.project_obstacles[0].note}
             </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}