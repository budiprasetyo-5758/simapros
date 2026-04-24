import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Edit3, FileText, Calendar, Building2, User, AlertCircle, Paperclip, ExternalLink, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Project, ProjectPriority } from '@/types/project';
import { PriorityMatrixSelector } from '@/components/project/PriorityMatrixSelector';
import { Urgency, Impact, calculatePriority, priorityConfig as matrixPriorityConfig } from '@/lib/priorityMatrix';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ProjectEvaluationDialogProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onApprove: (projectId: string, editedData: Partial<Project>, technicalNotes: string) => Promise<void>;
  onRevision: (projectId: string, revisionNote: string) => Promise<void>;
  onReject: (projectId: string, rejectNote: string) => Promise<void>;
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
  onApprove,
  onRevision,
  onReject,
}: ProjectEvaluationDialogProps) {
  const [activeTab, setActiveTab] = useState<'review' | 'edit' | 'action'>('review');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Edited form state
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedUnit, setEditedUnit] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [impact, setImpact] = useState<Impact>('minor');
  const [editedStartDate, setEditedStartDate] = useState('');
  const [editedEndDate, setEditedEndDate] = useState('');
  const [technicalNotes, setTechnicalNotes] = useState('');
  
  // Action notes
  const [revisionNote, setRevisionNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');

  // Track if data was edited
  const [hasEdits, setHasEdits] = useState(false);

  // Reset form when project changes
  useEffect(() => {
    if (project) {
      setEditedTitle(project.title);
      setEditedDescription(project.description);
      setEditedUnit(project.unit);
      // Parse urgency and impact from project or set defaults
      setUrgency((project as any).urgency || 'medium');
      setImpact((project as any).impact || 'minor');
      setEditedStartDate(project.start_date || '');
      setEditedEndDate(project.end_date || '');
      setEditedEndDate(project.end_date || '');
      setTechnicalNotes('');
      setRevisionNote('');
      setRejectNote('');
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
        urgency !== ((project as any).urgency || 'medium') ||
        impact !== ((project as any).impact || 'minor') ||
        editedStartDate !== (project.start_date || '') ||
        editedEndDate !== (project.end_date || '');
      setHasEdits(changed);
    }
  }, [project, editedTitle, editedDescription, editedUnit, urgency, impact, editedStartDate, editedEndDate]);

  const handleApprove = async () => {
    if (!project) return;
    setIsSubmitting(true);
    try {
      // Calculate priority from matrix
      const calculatedPriority = calculatePriority(urgency, impact);
      // Map critical to urgent for database compatibility
      const dbPriority = calculatedPriority === 'critical' ? 'urgent' : calculatedPriority;
      
      const editedData: Partial<Project> = {
        title: editedTitle,
        description: editedDescription,
        unit: editedUnit,
        priority: dbPriority as ProjectPriority,
        start_date: editedStartDate,
        end_date: editedEndDate,
      };
      await onApprove(project.id, editedData, technicalNotes);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevision = async () => {
    if (!project || !revisionNote.trim()) return;
    setIsSubmitting(true);
    try {
      await onRevision(project.id, revisionNote);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!project || !rejectNote.trim()) return;
    setIsSubmitting(true);
    try {
      await onReject(project.id, rejectNote);
      onClose();
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
                  {priorityDbConfig[project.priority].label}
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

                {/* Priority Matrix - Super Admin only */}
                <div className="md:col-span-2">
                  <Label className="mb-2 block">Penentuan Prioritas (Urgensi x Impact)</Label>
                  <PriorityMatrixSelector
                    urgency={urgency}
                    impact={impact}
                    onUrgencyChange={setUrgency}
                    onImpactChange={setImpact}
                  />
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

          {/* Action Tab - Approve/Revision/Reject */}
          <TabsContent value="action" className="mt-4 space-y-4">
            {/* Approve Section */}
            <div className="border border-success/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success" />
                <h4 className="font-semibold text-success">Setujui & Kirim ke Eksekutor</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Menyetujui pengajuan ini akan mengirimkannya ke dashboard Eksekutor untuk dieksekusi.
                {hasEdits && ' Perubahan yang Anda buat di tab "Edit Teknis" akan diterapkan.'}
              </p>
              <Button 
                onClick={handleApprove}
                disabled={isSubmitting}
                className="bg-success hover:bg-success/90 text-success-foreground w-full gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {hasEdits ? 'Setujui dengan Perubahan' : 'Setujui Pengajuan'}
              </Button>
            </div>

            <Separator />

            {/* Revision Section */}
            <div className="border border-revision/30 rounded-xl p-4 space-y-3">
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
            </div>

            <Separator />

            {/* Reject Section */}
            <div className="border border-destructive/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                <h4 className="font-semibold text-destructive">Tolak Pengajuan</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Menolak pengajuan ini secara permanen dengan alasan yang jelas.
              </p>
              <Textarea
                placeholder="Jelaskan alasan penolakan..."
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={3}
              />
              <Button 
                onClick={handleReject}
                disabled={isSubmitting || !rejectNote.trim()}
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/10 w-full gap-2"
              >
                <XCircle className="w-4 h-4" />
                Tolak Pengajuan
              </Button>
            </div>
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
