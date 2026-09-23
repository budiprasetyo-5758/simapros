import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Edit2, Calendar, Send, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Project } from '@/types/project';
import { useProjectEditRequests } from '@/hooks/useProjectEditRequests';
import { cn } from '@/lib/utils';

interface UserEditRequestDialogProps {
  project: Project;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function UserEditRequestDialog({ project, open, onClose, onSuccess }: UserEditRequestDialogProps) {
  const { createEditRequest, hasPendingRequest } = useProjectEditRequests(project.id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: null as Date | null,
    end_date: null as Date | null,
  });

  const isPending = hasPendingRequest(project.id);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        title: project.title,
        description: project.description,
        start_date: project.start_date ? parseISO(project.start_date) : null,
        end_date: project.end_date ? parseISO(project.end_date) : null,
      });
    }
  }, [open, project]);

  // Check if any changes were made
  const hasChanges = () => {
    const titleChanged = formData.title !== project.title;
    const descChanged = formData.description !== project.description;
    const startChanged = formData.start_date 
      ? format(formData.start_date, 'yyyy-MM-dd') !== project.start_date
      : false;
    const endChanged = formData.end_date
      ? format(formData.end_date, 'yyyy-MM-dd') !== project.end_date
      : false;
    
    return titleChanged || descChanged || startChanged || endChanged;
  };

  const handleSubmit = async () => {
    if (!hasChanges()) return;

    setIsSubmitting(true);
    
    const changes: Record<string, string> = {};
    
    if (formData.title !== project.title) {
      changes.proposed_title = formData.title;
    }
    if (formData.description !== project.description) {
      changes.proposed_description = formData.description;
    }
    if (formData.start_date && format(formData.start_date, 'yyyy-MM-dd') !== project.start_date) {
      changes.proposed_start_date = format(formData.start_date, 'yyyy-MM-dd');
    }
    if (formData.end_date && format(formData.end_date, 'yyyy-MM-dd') !== project.end_date) {
      changes.proposed_end_date = format(formData.end_date, 'yyyy-MM-dd');
    }

    const result = await createEditRequest(project.id, changes);
    setIsSubmitting(false);

    if (result.success) {
      onSuccess?.();
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit2 className="w-5 h-5" />
            Ajukan Perubahan Project
          </DialogTitle>
          <DialogDescription>
            Perubahan yang Anda ajukan akan dikirim ke admin untuk direview terlebih dahulu.
          </DialogDescription>
        </DialogHeader>

        {isPending && (
          <Alert variant="default" className="border-warning/50 bg-warning/10">
            <AlertCircle className="w-4 h-4 text-warning" />
            <AlertDescription className="text-warning">
              Anda sudah memiliki permintaan perubahan yang sedang menunggu approval.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-title">Judul Project</Label>
            <Input
              id="edit-title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Judul project"
              maxLength={200}
              disabled={isPending}
            />
            {formData.title !== project.title && (
              <p className="text-xs text-primary">
                Sebelumnya: {project.title}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tanggal Mulai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                    disabled={isPending}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.start_date 
                      ? format(formData.start_date, "d MMM yyyy", { locale: localeId }) 
                      : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.start_date || undefined}
                    onSelect={(date) => setFormData(prev => ({ ...prev, start_date: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Tanggal Selesai</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.end_date && "text-muted-foreground"
                    )}
                    disabled={isPending}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {formData.end_date 
                      ? format(formData.end_date, "d MMM yyyy", { locale: localeId }) 
                      : "Pilih tanggal"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.end_date || undefined}
                    onSelect={(date) => setFormData(prev => ({ ...prev, end_date: date || null }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Deskripsi</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Deskripsi project"
              rows={4}
              maxLength={5000}
              disabled={isPending}
            />
            {formData.description !== project.description && (
              <p className="text-xs text-primary">Deskripsi telah diubah</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !hasChanges() || isPending}
            className="gap-2"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Mengirim...' : 'Kirim Permintaan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
