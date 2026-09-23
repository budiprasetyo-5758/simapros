import { useState, useEffect } from 'react';
import { CheckCircle, Edit3, FileText, Calendar, Building2, User, AlertCircle, Paperclip, ExternalLink, Send, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Project, ProjectPriority } from '@/types/project';
import { SopMandatoryGateSelector } from '@/components/project/SopMandatoryGateSelector';
import { SopPriorityScoringSelector } from '@/components/project/SopPriorityScoringSelector';
import { finalDecisionConfig, recommendationConfig } from '@/lib/priorityScoring';
import {
  SOP_SOURCE_REFERENCE,
  calculateSopAssessment,
  createEmptySopAssessmentDraft,
  getSopValidationErrors,
  mapSopRecommendationToFinalDecision,
  toSopAssessmentSubmission,
} from '@/lib/sopPriority2026';
import type { PriorityFinalDecision } from '@/types/priorityAssessment';
import type {
  SopAssessmentDecisionPayload,
  SopAssessmentDraft,
} from '@/types/sopPriority2026';
import { usePicOptions } from '@/hooks/usePicOptions';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProjectEvaluationDialogProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onPriorityDecision: (projectId: string, payload: SopAssessmentDecisionPayload) => Promise<boolean>;
  onRevision: (projectId: string, revisionNote: string) => Promise<boolean>;
}

const priorityDbConfig: Record<ProjectPriority, { label: string; className: string }> = {
  low: { label: 'Rendah', className: 'bg-muted text-muted-foreground' },
  medium: { label: 'Sedang', className: 'bg-primary/10 text-primary' },
  high: { label: 'Tinggi', className: 'bg-warning/10 text-warning' },
  urgent: { label: 'Urgent', className: 'bg-destructive/10 text-destructive' },
};

export function ProjectEvaluationDialog({
  project,
  open,
  onClose,
  onPriorityDecision,
  onRevision,
}: ProjectEvaluationDialogProps) {
  const [activeTab, setActiveTab] = useState<'review' | 'edit' | 'action'>('review');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { activePicOptions } = usePicOptions();
  
  // Edited form state
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedUnit, setEditedUnit] = useState('');
  const [editedStartDate, setEditedStartDate] = useState('');
  const [editedEndDate, setEditedEndDate] = useState('');
  const [selectedPic, setSelectedPic] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState('');
  
  // Action notes
  const [revisionNote, setRevisionNote] = useState('');
  const [assessment, setAssessment] = useState<SopAssessmentDraft>(createEmptySopAssessmentDraft);
  const [finalDecision, setFinalDecision] = useState<PriorityFinalDecision | ''>('');
  const [finalDecisionNote, setFinalDecisionNote] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [priorityNote, setPriorityNote] = useState('');
  const [proposedStartDate, setProposedStartDate] = useState('');
  const [proposedEndDate, setProposedEndDate] = useState('');

  // Track if data was edited
  const [hasEdits, setHasEdits] = useState(false);

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setEditedTitle(project.title);
      setEditedDescription(project.description);
      setEditedUnit(project.unit);
      setEditedStartDate(project.start_date || '');
      setEditedEndDate(project.end_date || '');
      setSelectedPic(project.pic || '');
      setTechnicalNotes('');
      setRevisionNote('');
      setAssessment(createEmptySopAssessmentDraft());
      setFinalDecision('');
      setFinalDecisionNote('');
      setOverrideReason('');
      setPriorityNote('');
      setProposedStartDate(project.proposed_start_date || project.start_date || '');
      setProposedEndDate(project.proposed_end_date || project.end_date || '');
      setHasEdits(false);
      setActiveTab('review');
    }
  }, [project]);

  // Track changes
  useEffect(() => {
    if (project) {
      const changed =
        editedTitle !== project.title ||
        editedDescription !== project.description ||
        editedUnit !== project.unit ||
        editedStartDate !== (project.start_date || '') ||
        editedEndDate !== (project.end_date || '');
      setHasEdits(changed);
    }
  }, [project, editedTitle, editedDescription, editedUnit, editedStartDate, editedEndDate]);

  const assessmentResult = calculateSopAssessment(assessment);
  const validationErrors = getSopValidationErrors(assessment);
  const recommendedDecision = assessmentResult.recommendation
    ? mapSopRecommendationToFinalDecision(assessmentResult.recommendation)
    : null;
  const decisionOverridesRecommendation = Boolean(
    finalDecision && recommendedDecision && finalDecision !== recommendedDecision,
  );
  const needsDeferredSchedule = finalDecision === 'deferred';
  const needsExecutionPic = finalDecision === 'approved' || finalDecision === 'conditional';
  const projectDatesInvalid = Boolean(
    !editedStartDate || !editedEndDate || editedEndDate < editedStartDate,
  );
  const deferredDatesInvalid = Boolean(
    needsDeferredSchedule && (
      !proposedStartDate || !proposedEndDate || proposedEndDate < proposedStartDate
    ),
  );

  useEffect(() => {
    if (recommendedDecision) {
      setFinalDecision(recommendedDecision);
      setOverrideReason('');
    }
  }, [recommendedDecision]);

  const handlePriorityDecision = async () => {
    if (!project || !finalDecision || validationErrors.length) return;
    if (needsExecutionPic && !selectedPic) return;
    if (projectDatesInvalid || deferredDatesInvalid) return;
    if (!finalDecisionNote.trim()) return;
    if (decisionOverridesRecommendation && !overrideReason.trim()) return;
    if (needsDeferredSchedule && (!priorityNote.trim() || !proposedStartDate || !proposedEndDate)) return;

    const submission = toSopAssessmentSubmission(assessment, {
      priority_note: priorityNote.trim(),
      proposed_start_date: needsDeferredSchedule ? proposedStartDate : null,
      proposed_end_date: needsDeferredSchedule ? proposedEndDate : null,
      final_decision: finalDecision,
      final_decision_note: finalDecisionNote.trim(),
      override_reason: decisionOverridesRecommendation ? overrideReason.trim() : null,
    });
    if (!submission) return;

    setIsSubmitting(true);
    try {
      const saved = await onPriorityDecision(project.id, {
        assessment: submission,
        editedData: {
          title: editedTitle,
          description: editedDescription,
          unit: editedUnit,
          start_date: editedStartDate,
          end_date: editedEndDate,
          pic: selectedPic,
        },
        technicalNotes,
      });
      if (saved) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevision = async () => {
    if (!project || !revisionNote.trim()) return;
    setIsSubmitting(true);
    try {
      const saved = await onRevision(project.id, revisionNote);
      if (saved) onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const isImageUrl = (url: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const lowerUrl = url.toLowerCase();
    return imageExtensions.some(ext => lowerUrl.includes(ext));
  };

  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="w-5 h-5 text-primary" />
            Evaluasi Pengajuan Inisiatif
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'review' | 'edit' | 'action')}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="review" className="gap-2">
              <FileText className="w-4 h-4" />
              Review
            </TabsTrigger>
            <TabsTrigger value="edit" className="gap-2">
              <Edit3 className="w-4 h-4" />
              Edit Teknis
              {hasEdits && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">Diubah</Badge>}
            </TabsTrigger>
            <TabsTrigger value="action" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Keputusan
            </TabsTrigger>
          </TabsList>

          {/* Review Tab - Original submission */}
          <TabsContent value="review" className="mt-4 space-y-4">
            <div className="bg-muted/50 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg text-foreground">{project.title}</h3>
                <Badge className={cn('text-xs', priorityDbConfig[project.priority].className)}>
                  Prioritas intake/legacy: {priorityDbConfig[project.priority].label}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span><strong>Unit:</strong> {project.unit}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span><strong>Pengaju:</strong> {project.requester_name}</span>
                </div>
                {project.start_date && project.end_date && (
                  <div className="flex items-center gap-2 text-muted-foreground md:col-span-2">
                    <Calendar className="w-4 h-4" />
                    <span>
                      <strong>Periode:</strong> {format(parseISO(project.start_date), 'd MMMM yyyy', { locale: localeId })} - {format(parseISO(project.end_date), 'd MMMM yyyy', { locale: localeId })}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <Label className="text-sm font-medium text-muted-foreground">Deskripsi dari Pengaju</Label>
                <p className="mt-1 text-foreground whitespace-pre-wrap">{project.description}</p>
              </div>

              {/* Attachment Section */}
              {project.attachment_url && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Lampiran Dokumen
                    </Label>
                    <div className="mt-2">
                      {isImageUrl(project.attachment_url) ? (
                        <a 
                          href={project.attachment_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <div className="relative group">
                            <img 
                              src={project.attachment_url} 
                              alt="Lampiran Proyek" 
                              className="max-w-full max-h-64 rounded-lg border object-contain hover:opacity-90 transition-opacity cursor-pointer"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                              <span className="text-sm font-medium flex items-center gap-1">
                                <ExternalLink className="w-4 h-4" />
                                Buka Gambar
                              </span>
                            </div>
                          </div>
                        </a>
                      ) : (
                        <a 
                          href={project.attachment_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Lihat Dokumen Lampiran</span>
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </>
              )}

              <div className="text-xs text-muted-foreground">
                Diajukan pada {format(parseISO(project.created_at), 'd MMMM yyyy, HH:mm', { locale: localeId })}
              </div>
            </div>
          </TabsContent>

          {/* Edit Tab - Technical edits */}
          <TabsContent value="edit" className="mt-4 space-y-4">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-sm text-primary">
                Anda dapat mengedit form ini untuk menyesuaikan dengan kebutuhan teknis sebelum mengirim ke Eksekutor. 
                Perubahan ini akan menjadi versi final yang diterima oleh tim eksekusi.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="edit-title">Judul Inisiatif</Label>
                  <Input
                    id="edit-title"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-unit">Unit Kerja</Label>
                  <Input
                    id="edit-unit"
                    value={editedUnit}
                    onChange={(e) => setEditedUnit(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-pic">PIC (Person In Charge) *</Label>
                  <Select value={selectedPic} onValueChange={setSelectedPic}>
                    <SelectTrigger className={cn('mt-1', needsExecutionPic && !selectedPic && 'border-destructive')}>
                      <SelectValue placeholder="Pilih PIC" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePicOptions.map((opt) => (
                        <SelectItem key={opt.name} value={opt.name}>{opt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {needsExecutionPic && !selectedPic && (
                    <p className="text-xs text-destructive mt-1">PIC wajib dipilih untuk keputusan Disetujui/Disetujui Bersyarat</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="edit-start">Tanggal Mulai</Label>
                  <Input
                    id="edit-start"
                    type="date"
                    value={editedStartDate}
                    onChange={(e) => setEditedStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-end">Tanggal Selesai</Label>
                  <Input
                    id="edit-end"
                    type="date"
                    value={editedEndDate}
                    onChange={(e) => setEditedEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="edit-description">Deskripsi Teknis</Label>
                  <Textarea
                    id="edit-description"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    rows={5}
                    className="mt-1"
                    placeholder="Ubah deskripsi menjadi lebih teknis dan detail untuk tim eksekutor..."
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="technical-notes">Catatan Teknis untuk Eksekutor (Opsional)</Label>
                  <Textarea
                    id="technical-notes"
                    value={technicalNotes}
                    onChange={(e) => setTechnicalNotes(e.target.value)}
                    rows={3}
                    className="mt-1"
                    placeholder="Tambahkan catatan atau instruksi khusus untuk tim eksekutor..."
                  />
                </div>
              </div>

              {hasEdits && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
                  <p className="text-sm text-warning font-medium">
                    Anda telah mengubah data pengajuan. Perubahan ini akan diterapkan saat menyetujui.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Action Tab - weighted scoring, governance decision, revision */}
          <TabsContent value="action" className="mt-4 space-y-4">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h4 className="font-semibold text-primary">Penilaian Prioritas {SOP_SOURCE_REFERENCE}</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Kalkulator menghasilkan rekomendasi, bukan keputusan otomatis, dan tidak pernah menghasilkan
                    penolakan. Seluruh jawaban Tahap 1, nilai, bukti, catatan probing, keputusan final, serta
                    alasan override disimpan sebagai snapshot audit.
                  </p>
                </div>
              </div>
            </div>

            <SopMandatoryGateSelector value={assessment} onChange={setAssessment} disabled={isSubmitting} />

            {/* Tahap 2 hanya muncul bila Tahap 1 tidak menghasilkan MANDATORY.
                Menampilkannya tetap akan mengundang pengisian skor yang tidak
                pernah dipakai menghitung apa pun. */}
            {!assessmentResult.isMandatory && (
              <SopPriorityScoringSelector value={assessment} onChange={setAssessment} disabled={isSubmitting} />
            )}

            <div className="rounded-xl border border-border p-4 space-y-4">
              <div className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <h4 className="font-semibold">Keputusan Final Steering Committee</h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pilih keputusan formal secara eksplisit. Penundaan dan penolakan hanya bisa berasal dari sini,
                    tidak pernah dari kalkulator. Jika berbeda dari rekomendasi, alasan override wajib dicatat.
                  </p>
                </div>
              </div>

              {assessmentResult.recommendation && (
                <div className={cn(
                  'rounded-lg border p-3 text-sm',
                  recommendationConfig[assessmentResult.recommendation].className,
                )}>
                  <strong>Rekomendasi kalkulator:</strong>{' '}
                  {recommendationConfig[assessmentResult.recommendation].label}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {(Object.keys(finalDecisionConfig) as PriorityFinalDecision[]).map((decision) => (
                  <Button
                    key={decision}
                    type="button"
                    variant="outline"
                    disabled={isSubmitting || validationErrors.length > 0}
                    aria-pressed={finalDecision === decision}
                    onClick={() => setFinalDecision(decision)}
                    className={cn(
                      'h-auto min-h-20 items-start justify-start whitespace-normal p-3 text-left',
                      finalDecision === decision && 'border-primary bg-primary/5 ring-2 ring-primary/20',
                    )}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{finalDecisionConfig[decision].label}</span>
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        {finalDecisionConfig[decision].description}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="final-decision-note">Catatan Keputusan Final *</Label>
                <Textarea
                  id="final-decision-note"
                  value={finalDecisionNote}
                  onChange={(event) => setFinalDecisionNote(event.target.value)}
                  rows={3}
                  placeholder="Ringkas keputusan rapat, syarat yang ditetapkan, kapasitas, dependensi, atau periode pelaksanaan..."
                />
              </div>

              {decisionOverridesRecommendation && (
                <div className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <Label htmlFor="override-reason" className="text-warning">Alasan Override *</Label>
                  <Textarea
                    id="override-reason"
                    value={overrideReason}
                    onChange={(event) => setOverrideReason(event.target.value)}
                    rows={3}
                    placeholder="Jelaskan data/kondisi yang membuat Steering Committee mengambil keputusan berbeda dari rekomendasi kalkulator..."
                  />
                </div>
              )}

              {needsDeferredSchedule && (
                <div className="space-y-4 rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="proposed-start">Usulan Tanggal Mulai *</Label>
                      <Input
                        id="proposed-start"
                        type="date"
                        value={proposedStartDate}
                        onChange={(event) => setProposedStartDate(event.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="proposed-end">Usulan Tanggal Selesai *</Label>
                      <Input
                        id="proposed-end"
                        type="date"
                        value={proposedEndDate}
                        onChange={(event) => setProposedEndDate(event.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="priority-note">Konteks untuk Pengaju *</Label>
                    <Textarea
                      id="priority-note"
                      value={priorityNote}
                      onChange={(event) => setPriorityNote(event.target.value)}
                      rows={3}
                      className="mt-1"
                      placeholder="Jelaskan alasan penundaan, dependensi, syarat peninjauan ulang, dan usulan jadwal..."
                    />
                  </div>
                </div>
              )}

              {validationErrors.length > 0 && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <p className="text-sm font-semibold text-warning">Penilaian belum dapat dikirim</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {validationErrors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                </div>
              )}

              <Button
                onClick={handlePriorityDecision}
                disabled={
                  isSubmitting ||
                  validationErrors.length > 0 ||
                  !finalDecision ||
                  !finalDecisionNote.trim() ||
                  (needsExecutionPic && !selectedPic) ||
                  projectDatesInvalid ||
                  deferredDatesInvalid ||
                  (decisionOverridesRecommendation && !overrideReason.trim()) ||
                  (needsDeferredSchedule && (!priorityNote.trim() || !proposedStartDate || !proposedEndDate))
                }
                className="w-full gap-2"
              >
                <Send className="h-4 w-4" />
                Simpan Penilaian & Keputusan Final
              </Button>
              {needsExecutionPic && !selectedPic && (
                <p className="text-center text-xs text-destructive">
                  Pilih PIC di tab Edit Teknis sebelum menyimpan keputusan.
                </p>
              )}
              {projectDatesInvalid && (
                <p className="text-center text-xs text-destructive">
                  Tanggal proyek wajib lengkap dan tanggal selesai tidak boleh sebelum tanggal mulai.
                </p>
              )}
              {deferredDatesInvalid && (
                <p className="text-center text-xs text-destructive">
                  Jadwal tindak lanjut wajib lengkap dan tanggal selesai tidak boleh sebelum tanggal mulai.
                </p>
              )}
            </div>

            <Separator />

            {/* Revision Section */}
            {project.status === 'pending' && <div className="border border-revision/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-revision" />
                <h4 className="font-semibold text-revision">Minta Revisi ke Pengaju</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Kirim kembali ke pengaju dengan catatan perbaikan yang diperlukan.
              </p>
              <Textarea
                placeholder="Jelaskan apa yang perlu diperbaiki oleh pengaju..."
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                rows={3}
              />
              <Button 
                onClick={handleRevision}
                disabled={isSubmitting || !revisionNote.trim()}
                variant="outline"
                className="text-revision border-revision/30 hover:bg-revision/10 w-full gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Kirim Permintaan Revisi
              </Button>
            </div>}

          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
