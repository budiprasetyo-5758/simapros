import { useState } from 'react';
import { AlertCircle, ArrowRight, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Project } from '@/types/project';
import type {
  PriorityFinalDecision,
  PriorityQuadrant,
  PriorityRecommendation,
} from '@/types/priorityAssessment';
import {
  finalDecisionConfig,
  recommendationConfig,
} from '@/lib/priorityScoring';
import {
  calculatePriority,
  urgencyOptions,
  impactOptions,
  priorityConfig,
  quadrantConfig,
} from '@/lib/priorityMatrix';
import { buildPriorityAssessmentView } from '@/lib/priorityAssessmentView';
import { cn } from '@/lib/utils';

type CurrentPriorityAssessmentSnapshot = NonNullable<Project['current_priority_assessment']> & {
  revision_no?: number | null;
  method_version?: string | null;
  impact_score?: number | string | null;
  priority_index?: number | string | null;
  calculated_recommendation?: PriorityRecommendation | null;
  recommendation?: PriorityRecommendation | null;
  final_decision?: PriorityFinalDecision | null;
  final_decision_note?: string | null;
  override_reason?: string | null;
  priority_quadrant?: PriorityQuadrant | null;
  quadrant?: PriorityQuadrant | null;
  eligibility_status?: string | null;
  effort?: number | null;
  priority_note?: string | null;
  proposed_start_date?: string | null;
  proposed_end_date?: string | null;
};

interface PriorityDecisionDialogProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onDecide: (projectId: string, decision: 'accepted' | 'withdrawn') => Promise<void>;
}

const finalDecisionClassName: Record<PriorityFinalDecision, string> = {
  approved: 'border-success/30 bg-success/10 text-success',
  conditional: 'border-primary/30 bg-primary/10 text-primary',
  deferred: 'border-warning/30 bg-warning/10 text-warning',
  rejected: 'border-destructive/30 bg-destructive/10 text-destructive',
  gated: 'border-warning/30 bg-warning/10 text-warning',
};

const formatDate = (value?: string | null) =>
  value ? format(parseISO(value), 'd MMMM yyyy', { locale: localeId }) : '-';

const getCurrentAssessment = (project: Project): CurrentPriorityAssessmentSnapshot | null =>
  project.current_priority_assessment ?? null;

export function PriorityDecisionDialog({
  project,
  open,
  onClose,
  onDecide,
}: PriorityDecisionDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmWithdrawOpen, setConfirmWithdrawOpen] = useState(false);

  if (!project) return null;

  const assessment = getCurrentAssessment(project);
  const assessmentUnavailable = Boolean(project.current_priority_assessment_id && !assessment);
  // Skala, label skor, dan penanganan proyek mandatory dibaca dari snapshot
  // miliknya sendiri, bukan dari konstanta metode yang berlaku hari ini.
  const view = assessment ? buildPriorityAssessmentView(assessment) : null;
  // Data lama tetap didukung, tetapi proyek yang sudah memiliki snapshot Tier 2
  // tidak pernah dihitung ulang dengan matriks urgency x impact.
  const legacyCalculated = !assessment && !assessmentUnavailable && project.urgency && project.impact
    ? calculatePriority(project.urgency, project.impact)
    : null;
  const legacyPriorityInfo = legacyCalculated ? priorityConfig[legacyCalculated] : null;
  const recommendation = view?.recommendation ?? null;
  const recommendationInfo = recommendation ? recommendationConfig[recommendation] : null;
  const finalDecision = view?.finalDecision ?? null;
  const finalDecisionInfo = finalDecision ? finalDecisionConfig[finalDecision] : null;
  const quadrant = view
    ? view.quadrant
    : assessmentUnavailable ? null : project.priority_quadrant ?? null;
  const quadrantInfo = quadrant ? quadrantConfig[quadrant] : null;
  // Hanya dipakai pada jalur legacy (proyek tanpa snapshot); proyek bersnapshot
  // membaca effort dari view supaya tetap sejalan dengan metodenya.
  const legacyEffort = !assessment && !assessmentUnavailable ? project.effort ?? null : null;
  const proposedStartDate = assessment
    ? assessment.proposed_start_date ?? null
    : project.proposed_start_date;
  const proposedEndDate = assessment
    ? assessment.proposed_end_date ?? null
    : project.proposed_end_date;
  const priorityNote = assessment ? assessment.priority_note ?? null : project.priority_note;

  const urgencyLabel = !assessment && !assessmentUnavailable
    ? urgencyOptions.find((option) => option.value === project.urgency)?.label
    : null;
  const impactLabel = !assessment && !assessmentUnavailable
    ? impactOptions.find((option) => option.value === project.impact)?.label
    : null;

  const handleDecide = async (decision: 'accepted' | 'withdrawn') => {
    setIsSubmitting(true);
    try {
      await onDecide(project.id, decision);
      onClose();
    } finally {
      setIsSubmitting(false);
      setConfirmWithdrawOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Clock className="w-5 h-5 text-warning" />
              Konfirmasi Jadwal Proyek
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-warning mt-0.5 shrink-0" />
              <div className="text-sm text-warning space-y-1">
                <p>
                  Pengajuan ini <strong>belum dijadwalkan pada periode berjalan</strong>. Tinjau
                  jadwal tindak lanjut yang ditetapkan HTO, lalu pilih untuk menerima jadwal atau
                  menarik pengajuan.
                </p>
                {assessment && (
                  <p>
                    Kalkulator menghasilkan rekomendasi, sedangkan keputusan final tetap ditetapkan
                    oleh Steering Committee dan tercatat terpisah pada snapshot penilaian.
                  </p>
                )}
                {quadrantInfo && (
                  <p>
                    Kuadran: <strong>{quadrantInfo.label}</strong> ({quadrantInfo.condition}).
                  </p>
                )}
              </div>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 space-y-4">
              <h3 className="font-semibold text-lg text-foreground">{project.title}</h3>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {assessment ? 'Snapshot Penilaian Prioritas Tier 2' : 'Hasil Penilaian Prioritas Lama'}
                  </p>
                  {assessment?.method_version && (
                    <span className="text-xs text-muted-foreground">
                      {assessment.method_version}
                      {assessment.revision_no ? ` · Revisi ${assessment.revision_no}` : ''}
                    </span>
                  )}
                </div>

                {view && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">{view.scoreLabel}</p>
                      <p className="font-semibold text-foreground">{view.scoreText}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Priority Index</p>
                      <p className="font-semibold text-foreground">{view.priorityIndexText}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background p-3 col-span-2 sm:col-span-1">
                      <p className="text-xs text-muted-foreground">Effort</p>
                      <p className="font-semibold text-foreground">{view.effortText}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {assessmentUnavailable && (
                    <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-muted-foreground/30">
                      Snapshot Tier 2 tidak tersedia
                    </Badge>
                  )}
                  {recommendationInfo && (
                    <Badge variant="outline" className={cn('text-xs', recommendationInfo.className)}>
                      Rekomendasi: {recommendationInfo.label}
                    </Badge>
                  )}
                  {finalDecisionInfo && finalDecision && (
                    <Badge variant="outline" className={cn('text-xs', finalDecisionClassName[finalDecision])}>
                      Keputusan: {finalDecisionInfo.label}
                    </Badge>
                  )}
                  {quadrantInfo && (
                    <Badge variant="outline" className={cn('text-xs', quadrantInfo.className)}>
                      Kuadran: {quadrantInfo.label}
                    </Badge>
                  )}
                  {view?.financialGateLabel && (
                    <Badge variant="outline" className="text-xs">
                      Gate finansial: {view.financialGateLabel}
                    </Badge>
                  )}
                  {view && view.eligibilityLabel !== '-' && (
                    <Badge variant="outline" className="text-xs">
                      Kelayakan: {view.eligibilityLabel}
                    </Badge>
                  )}

                  {!assessment && legacyPriorityInfo && (
                    <Badge variant="outline" className={cn('text-sm font-medium', legacyPriorityInfo.className)}>
                      {legacyPriorityInfo.label}
                    </Badge>
                  )}
                  {!assessment && urgencyLabel && (
                    <Badge variant="outline" className="text-xs">Urgensi: {urgencyLabel}</Badge>
                  )}
                  {!assessment && impactLabel && (
                    <Badge variant="outline" className="text-xs">Impact: {impactLabel}</Badge>
                  )}
                  {!assessment && legacyEffort && (
                    <Badge variant="outline" className="text-xs">Effort: {legacyEffort}/5</Badge>
                  )}
                </div>
              </div>

              {assessment?.final_decision_note && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Catatan Keputusan Steering Committee
                    </p>
                    <p className="mt-1 text-foreground whitespace-pre-wrap text-sm">
                      {assessment.final_decision_note}
                    </p>
                  </div>
                </>
              )}

              {assessment?.override_reason && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Alasan Override</p>
                    <p className="mt-1 text-foreground whitespace-pre-wrap text-sm">
                      {assessment.override_reason}
                    </p>
                  </div>
                </>
              )}

              {!assessment && project.priority_rationale && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Dasar Penilaian</p>
                    <p className="mt-1 text-foreground whitespace-pre-wrap text-sm">
                      {project.priority_rationale}
                    </p>
                  </div>
                </>
              )}

              {priorityNote && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Konteks dari HTO</p>
                    <p className="mt-1 text-foreground whitespace-pre-wrap">{priorityNote}</p>
                  </div>
                </>
              )}

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Perbandingan Jadwal</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="border border-border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Jadwal yang Anda Ajukan</p>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground line-through">
                        {formatDate(project.start_date)} &ndash; {formatDate(project.end_date)}
                      </span>
                    </div>
                  </div>
                  <div className="border border-warning/30 bg-warning/5 rounded-lg p-3">
                    <p className="text-xs text-warning mb-1 flex items-center gap-1">
                      <ArrowRight className="w-3 h-3" />
                      Jadwal Tindak Lanjut HTO
                    </p>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="w-4 h-4 text-warning shrink-0" />
                      <span className="font-medium text-foreground">
                        {formatDate(proposedStartDate)} &ndash; {formatDate(proposedEndDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-success/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <h4 className="font-semibold text-success">Terima Jadwal Ini</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Proyek akan masuk antrean pengerjaan dengan jadwal tindak lanjut di atas.
              </p>
              <Button
                onClick={() => handleDecide('accepted')}
                disabled={isSubmitting}
                className="bg-success hover:bg-success/90 text-success-foreground w-full gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Terima &amp; Lanjutkan
              </Button>
            </div>

            <div className="border border-destructive/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                <h4 className="font-semibold text-destructive">Tarik Pengajuan</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Pengajuan dibatalkan dan tidak akan dikerjakan. Anda dapat mengajukan ulang di lain waktu.
              </p>
              <Button
                onClick={() => setConfirmWithdrawOpen(true)}
                disabled={isSubmitting}
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 w-full gap-2"
              >
                <XCircle className="w-4 h-4" />
                Tarik Pengajuan
              </Button>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Putuskan Nanti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmWithdrawOpen} onOpenChange={setConfirmWithdrawOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tarik pengajuan ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Pengajuan &ldquo;{project.title}&rdquo; akan dibatalkan dan tidak dapat dikembalikan.
              Anda perlu membuat pengajuan baru jika berubah pikiran.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDecide('withdrawn')}
              disabled={isSubmitting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Ya, Tarik Pengajuan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
