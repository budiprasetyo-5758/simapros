import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GanttTask } from '@/types/project';
import { Loader2, FileText, Calendar, Target, AlertTriangle, CheckCircle2, Paperclip, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface DailyReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: GanttTask[];
  projectId: string;
  onReportSubmitted: () => void;
}

export function DailyReportDialog({ 
  open, 
  onOpenChange, 
  tasks, 
  projectId,
  onReportSubmitted 
}: DailyReportDialogProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [description, setDescription] = useState('');
  const [achievements, setAchievements] = useState('');
  const [challenges, setChallenges] = useState('');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const selectedTask = tasks.find(t => t.id === selectedTaskId);

  const resetForm = () => {
    setSelectedTaskId('');
    setDescription('');
    setAchievements('');
    setChallenges('');
    setReportDate(format(new Date(), 'yyyy-MM-dd'));
    setAttachmentFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Max 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Error',
          description: 'Ukuran file maksimal 10MB',
          variant: 'destructive',
        });
        return;
      }
      setAttachmentFile(file);
    }
  };

  const uploadAttachment = async (userId: string): Promise<string | null> => {
    if (!attachmentFile) return null;
    
    setIsUploading(true);
    try {
      const fileExt = attachmentFile.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('daily-report-attachments')
        .upload(fileName, attachmentFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('daily-report-attachments')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const calculateAIProgress = async (taskId: string) => {
    setIsCalculating(true);
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Fetch all reports for this task
      const { data: reports, error: reportsError } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('task_id', taskId)
        .order('report_date', { ascending: true });

      if (reportsError) throw reportsError;

      // Call edge function which handles the progress update with service role
      const { data, error } = await supabase.functions.invoke('calculate-task-progress', {
        body: { 
          task,
          dailyReports: reports || []
        }
      });

      if (error) throw error;

      // Progress update is now handled by the edge function with service role
      // No need for client-side update which would fail due to RLS
      
      return data;
    } catch (error) {
      console.error('Error calculating AI progress:', error);
      throw error;
    } finally {
      setIsCalculating(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTaskId || !description.trim()) {
      toast({
        title: 'Error',
        description: 'Pilih task dan isi deskripsi laporan',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Upload attachment if exists
      let attachmentUrl: string | null = null;
      if (attachmentFile) {
        attachmentUrl = await uploadAttachment(user.id);
      }

      const { error: insertError } = await supabase
        .from('daily_reports')
        .insert({
          task_id: selectedTaskId,
          project_id: projectId,
          reporter_id: user.id,
          report_date: reportDate,
          description: description.trim(),
          achievements: achievements.trim() || null,
          challenges: challenges.trim() || null,
          attachment_url: attachmentUrl,
        });

      if (insertError) {
        if (insertError.code === '23505') {
          toast({
            title: 'Error',
            description: 'Anda sudah membuat laporan untuk task ini pada tanggal tersebut',
            variant: 'destructive',
          });
          return;
        }
        throw insertError;
      }

      const progressResult = await calculateAIProgress(selectedTaskId);

      toast({
        title: 'Laporan Berhasil Disimpan',
        description: `AI menghitung progress: ${progressResult?.progress || 0}%`,
      });

      resetForm();
      onOpenChange(false);
      onReportSubmitted();
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan laporan',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTasks = tasks.filter(t => t.status !== 'completed');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Laporan Harian
          </DialogTitle>
          <DialogDescription>
            Isi laporan progress harian untuk task yang sedang dikerjakan. AI akan menghitung progress secara otomatis.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task Selection */}
          <div className="space-y-2">
            <Label>Pilih Task *</Label>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih task yang dilaporkan" />
              </SelectTrigger>
              <SelectContent>
                {activeTasks.map(task => (
                  <SelectItem key={task.id} value={task.id}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{task.wbs_number}</span>
                      <span>{task.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Task Info */}
          {selectedTask && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedTask.name}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(selectedTask.start_date), 'd MMM', { locale: id })} - {format(new Date(selectedTask.end_date), 'd MMM yyyy', { locale: id })}
                </span>
                <span>PIC: {selectedTask.pic}</span>
                <span>Progress: {selectedTask.progress}%</span>
              </div>
            </div>
          )}

          {/* Report Date */}
          <div className="space-y-2">
            <Label>Tanggal Laporan</Label>
            <Input 
              type="date" 
              value={reportDate} 
              onChange={(e) => setReportDate(e.target.value)}
              max={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Deskripsi Pekerjaan Hari Ini *</Label>
            <Textarea
              placeholder="Jelaskan apa yang dikerjakan hari ini..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Achievements */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              Pencapaian
            </Label>
            <Textarea
              placeholder="Apa yang berhasil diselesaikan hari ini? (opsional)"
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              rows={2}
            />
          </div>

          {/* Challenges */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Kendala / Hambatan
            </Label>
            <Textarea
              placeholder="Adakah kendala yang dihadapi? (opsional)"
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              rows={2}
            />
          </div>

          {/* Attachment */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Lampiran (opsional)
            </Label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            />
            {attachmentFile ? (
              <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted">
                <Paperclip className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{attachmentFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAttachmentFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Pilih File (Maks. 10MB)
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Format: Gambar, PDF, Word, Excel
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Batal
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || isCalculating || isUploading || !selectedTaskId || !description.trim()}
          >
            {isSubmitting || isCalculating || isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isUploading ? 'Mengunggah...' : isCalculating ? 'Menghitung Progress...' : 'Menyimpan...'}
              </>
            ) : (
              'Simpan Laporan'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
