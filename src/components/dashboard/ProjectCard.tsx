import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Project, ProjectProgressStatus, ProjectPriority } from '@/types/project';
import type { PriorityFinalDecision, PriorityQuadrant, PriorityRecommendation } from '@/types/priorityAssessment';
import { finalDecisionConfig, recommendationConfig } from '@/lib/priorityScoring';
import { quadrantConfig } from '@/lib/priorityMatrix';
import { buildPriorityAssessmentView } from '@/lib/priorityAssessmentView';
import { Calendar, Building2, FolderKanban, PlayCircle, PauseCircle, CheckCircle2, User, CalendarPlus, AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProjectCardProps {
  project: Project;
  showAdminNote?: boolean;
  compact?: boolean;
  editRequestCount?: number;
  showObstaclesPreview?: boolean;
}

type CurrentPriorityAssessmentSnapshot = NonNullable<Project['current_priority_assessment']> & {
  impact_score?: number | string | null;
  priority_index?: number | string | null;
  calculated_recommendation?: PriorityRecommendation | null;
  recommendation?: PriorityRecommendation | null;
  final_decision?: PriorityFinalDecision | null;
  priority_quadrant?: PriorityQuadrant | null;
  quadrant?: PriorityQuadrant | null;
};

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

const finalDecisionClassName: Record<PriorityFinalDecision, string> = {
  approved: 'bg-success/10 text-success border-success/20',
  conditional: 'bg-primary/10 text-primary border-primary/20',
  deferred: 'bg-warning/10 text-warning border-warning/20',
  rejected: 'bg-destructive/10 text-destructive border-destructive/20',
  gated: 'bg-warning/10 text-warning border-warning/20',
};

const finalDecisionBorderColor: Record<PriorityFinalDecision, string> = {
  approved: 'border-success',
  conditional: 'border-primary',
  deferred: 'border-warning',
  rejected: 'border-destructive',
  gated: 'border-warning',
};

const getCurrentAssessment = (project: Project): CurrentPriorityAssessmentSnapshot | null =>
  project.current_priority_assessment ?? null;

export function ProjectCard({ project, showAdminNote = true, compact = false, editRequestCount = 0, showObstaclesPreview = false }: ProjectCardProps) {
  const navigate = useNavigate();
  const assessment = getCurrentAssessment(project);
  const assessmentUnavailable = Boolean(project.current_priority_assessment_id && !assessment);
  // Skala skor dan penanganan proyek mandatory dibaca dari snapshot metodenya.
  const view = assessment ? buildPriorityAssessmentView(assessment) : null;
  const recommendation = view?.recommendation ?? null;
  const finalDecision = view?.finalDecision ?? null;
  const acceptedDeferredSchedule = Boolean(
    assessment?.final_decision === 'deferred'
      && project.requester_decision === 'accepted'
      && project.status === 'approved',
  );
  const quadrant = view?.quadrant ?? null;
  const cardBorderColor = acceptedDeferredSchedule
    ? finalDecisionBorderColor.approved
    : finalDecision
    ? finalDecisionBorderColor[finalDecision]
    : assessmentUnavailable
      ? 'border-muted-foreground/40'
    : priorityConfig[project.priority].borderColor;

  const handleClick = () => {
    if (project.status === 'approved' || project.status === 'active') {
      navigate(`/project/${project.id}`);
    }
  };

  return (
    <Card 
      className={cn(
         "transition-all border-l-4",
         cardBorderColor,
        (project.status === 'approved' || project.status === 'active') && "cursor-pointer hover:shadow-md hover:border-primary/30",
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
          {assessment ? (
            <>
              {recommendation && (
                <Badge variant="outline" className={cn('text-xs', recommendationConfig[recommendation].className)}>
                  Rekomendasi: {recommendationConfig[recommendation].label}
                </Badge>
              )}
              {finalDecision && (
                <Badge variant="outline" className={cn('text-xs', finalDecisionClassName[finalDecision])}>
                  {acceptedDeferredSchedule ? 'Keputusan awal' : 'Keputusan'}: {finalDecisionConfig[finalDecision].label}
                </Badge>
              )}
              {acceptedDeferredSchedule && (
                <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                  Jadwal diterima pengaju · Masuk portofolio
                </Badge>
              )}
              {quadrant && (
                <Badge variant="outline" className={cn('text-xs', quadrantConfig[quadrant].className)}>
                  {quadrantConfig[quadrant].label}
                </Badge>
              )}
            </>
          ) : assessmentUnavailable ? (
            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted-foreground/30">
              Snapshot Tier 2 tidak tersedia
            </Badge>
          ) : (
            <Badge variant="outline" className={cn('text-xs', priorityConfig[project.priority].className)}>
              Prioritas lama: {priorityConfig[project.priority].label}
            </Badge>
          )}
          {!assessment && !assessmentUnavailable && project.is_priority === false && (
            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted-foreground/20">
              <Clock className="w-3 h-3 mr-1" />
              Keputusan: Jadwal Ditunda
            </Badge>
          )}
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
        {view && (
          <div className="mb-3 grid grid-cols-2 gap-2 rounded-lg border border-border/70 bg-muted/30 p-2 text-xs">
            <div>
              <p className="text-muted-foreground">{view.scoreLabel}</p>
              <p className="font-semibold text-foreground">{view.scoreText}</p>
            </div>
            <div>
              <p className="text-muted-foreground">
                {view.isMandatory ? 'Jalur' : 'Priority Index'}
              </p>
              <p className="font-semibold text-foreground">
                {view.isMandatory ? 'Bypass Tahap 1' : view.priorityIndexText}
              </p>
            </div>
          </div>
        )}
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
