import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GanttTask } from '@/types/project';
import { Loader2, AlertCircle, Bot, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProgressOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: GanttTask | null;
  aiProgress?: number;
  aiReasoning?: string;
  onProgressUpdated: () => void;
}

export function ProgressOverrideDialog({
  open,
  onOpenChange,
  task,
  aiProgress,
  aiReasoning,
  onProgressUpdated
}: ProgressOverrideDialogProps) {
  const [progress, setProgress] = useState<number>(task?.progress || 0);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleOverride = async () => {
    if (!task) return;

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('gantt_tasks')
        .update({
          progress: progress,
          progress_override: progress,
          progress_override_by: user.id,
          progress_override_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Progress Diperbarui',
        description: `Progress task berhasil diubah menjadi ${progress}%`,
      });

      onOpenChange(false);
      onProgressUpdated();
    } catch (error) {
      console.error('Error overriding progress:', error);
      toast({
        title: 'Error',
        description: 'Gagal memperbarui progress',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToAI = async () => {
    if (!task || aiProgress === undefined) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('gantt_tasks')
        .update({
          progress: aiProgress,
          progress_override: null,
          progress_override_by: null,
          progress_override_at: null,
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Progress Direset',
        description: `Progress dikembalikan ke hasil AI (${aiProgress}%)`,
      });

      onOpenChange(false);
      onProgressUpdated();
    } catch (error) {
      console.error('Error resetting progress:', error);
      toast({
        title: 'Error',
        description: 'Gagal mereset progress',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!task) return null;

  const hasOverride = task.progress !== aiProgress && aiProgress !== undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Override Progress Task</DialogTitle>
          <DialogDescription>
            Modifikasi progress yang dihitung AI jika tidak sesuai kondisi sebenarnya
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Task Info */}
          <div className="p-3 bg-muted rounded-lg">
            <p className="font-medium">{task.name}</p>
            <p className="text-sm text-muted-foreground">{task.wbs_number}</p>
          </div>

          {/* AI Progress */}
          {aiProgress !== undefined && (
            <div className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="font-medium">Penilaian AI</span>
                <Badge variant="secondary">{aiProgress}%</Badge>
              </div>
              {aiReasoning && (
                <p className="text-sm text-muted-foreground">{aiReasoning}</p>
              )}
            </div>
          )}

          {/* Current Progress */}
          {hasOverride && (
            <div className="p-3 border border-yellow-500/50 rounded-lg bg-yellow-500/10">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-yellow-600" />
                <span className="font-medium text-yellow-700">Progress saat ini (Override)</span>
                <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                  {task.progress}%
                </Badge>
              </div>
            </div>
          )}

          {/* Override Input */}
          <div className="space-y-2">
            <Label>Progress Baru (%)</Label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-24"
              />
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={(e) => setProgress(parseInt(e.target.value))}
                className="flex-1"
              />
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Alasan Override (opsional)</Label>
            <Textarea
              placeholder="Jelaskan mengapa progress perlu diubah..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg text-sm">
            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
            <p className="text-yellow-700">
              Override akan mengganti progress dari AI. Anda dapat mengembalikan ke nilai AI kapan saja.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {hasOverride && aiProgress !== undefined && (
            <Button variant="outline" onClick={handleResetToAI} disabled={isSubmitting}>
              Reset ke AI ({aiProgress}%)
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleOverride} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              'Simpan Override'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
