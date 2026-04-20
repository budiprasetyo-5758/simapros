import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GanttTask, TaskStatus } from '@/types/project';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TaskEditRequestDialogProps {
  open: boolean;
  onClose: () => void;
  task: GanttTask | null;
  projectId: string;
  projectStartDate: string;
  projectEndDate: string;
  isNewTask?: boolean;
  onSubmit: (changes: {
    proposed_name?: string;
    proposed_description?: string;
    proposed_pic?: string;
    proposed_phase?: string;
    proposed_start_date?: string;
    proposed_end_date?: string;
    proposed_progress?: number;
    proposed_status?: string;
    proposed_monev?: string;
    proposed_wbs_number?: string;
    proposed_deliverable_result?: string;
    proposed_problem?: string;
  }) => Promise<{ success: boolean }>;
}

export function TaskEditRequestDialog({
  open,
  onClose,
  task,
  projectId,
  projectStartDate,
  projectEndDate,
  isNewTask = false,
  onSubmit,
}: TaskEditRequestDialogProps) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    pic: '',
    phase: '',
    start_date: '',
    end_date: '',
    progress: 0,
    status: 'not_started' as TaskStatus,
    monev: '',
    wbs_number: '',
    deliverable_result: '',
    problem: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (task && !isNewTask) {
        setForm({
          name: task.name,
          description: task.description,
          pic: task.pic,
          phase: task.phase,
          start_date: task.start_date,
          end_date: task.end_date,
          progress: task.progress,
          status: task.status,
          monev: task.monev,
          wbs_number: task.wbs_number,
          deliverable_result: task.deliverable_result || '',
          problem: task.problem || '',
        });
      } else {
        setForm({
          name: '',
          description: '',
          pic: '',
          phase: '',
          start_date: projectStartDate,
          end_date: projectStartDate,
          progress: 0,
          status: 'not_started',
          monev: '',
          wbs_number: '',
          deliverable_result: '',
          problem: '',
        });
      }
    }
  }, [open, task, isNewTask, projectStartDate]);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    
    setIsSubmitting(true);
    try {
      const changes: Record<string, any> = {};
      
      if (isNewTask) {
        // For new task, include all fields
        changes.proposed_name = form.name;
        changes.proposed_description = form.description;
        changes.proposed_pic = form.pic;
        changes.proposed_phase = form.phase;
        changes.proposed_start_date = form.start_date;
        changes.proposed_end_date = form.end_date;
        changes.proposed_progress = form.progress;
        changes.proposed_status = form.status;
        changes.proposed_monev = form.monev;
        changes.proposed_wbs_number = form.wbs_number;
        changes.proposed_deliverable_result = form.deliverable_result;
        changes.proposed_problem = form.problem;
      } else if (task) {
        // For edit, only include changed fields
        if (form.name !== task.name) changes.proposed_name = form.name;
        if (form.description !== task.description) changes.proposed_description = form.description;
        if (form.pic !== task.pic) changes.proposed_pic = form.pic;
        if (form.phase !== task.phase) changes.proposed_phase = form.phase;
        if (form.start_date !== task.start_date) changes.proposed_start_date = form.start_date;
        if (form.end_date !== task.end_date) changes.proposed_end_date = form.end_date;
        if (form.progress !== task.progress) changes.proposed_progress = form.progress;
        if (form.status !== task.status) changes.proposed_status = form.status;
        if (form.monev !== task.monev) changes.proposed_monev = form.monev;
        if (form.wbs_number !== task.wbs_number) changes.proposed_wbs_number = form.wbs_number;
        if (form.deliverable_result !== (task.deliverable_result || '')) changes.proposed_deliverable_result = form.deliverable_result;
        if (form.problem !== (task.problem || '')) changes.proposed_problem = form.problem;

        // If no changes, don't submit
        if (Object.keys(changes).length === 0) {
          onClose();
          return;
        }
      }

      const result = await onSubmit(changes);
      if (result.success) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNewTask ? 'Ajukan Task Baru' : 'Ajukan Perubahan Task'}
          </DialogTitle>
          <DialogDescription>
            {isNewTask
              ? 'Isi detail task baru yang ingin ditambahkan. Perubahan akan diterapkan setelah disetujui admin.'
              : 'Ubah field yang ingin diperbarui. Perubahan akan diterapkan setelah disetujui admin.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="wbs_number">WBS Number</Label>
              <Input
                id="wbs_number"
                value={form.wbs_number}
                onChange={(e) => setForm({ ...form, wbs_number: e.target.value })}
                placeholder="1.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phase">Phase</Label>
              <Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="execution">Execution</SelectItem>
                  <SelectItem value="evaluation">Evaluation</SelectItem>
                  <SelectItem value="followup">Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nama Task *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nama task"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Deskripsi task"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pic">PIC (Person In Charge)</Label>
            <Input
              id="pic"
              value={form.pic}
              onChange={(e) => setForm({ ...form, pic: e.target.value })}
              placeholder="Nama PIC"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Tanggal Mulai</Label>
              <Input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                min={projectStartDate}
                max={projectEndDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Tanggal Selesai</Label>
              <Input
                id="end_date"
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                min={form.start_date || projectStartDate}
                max={projectEndDate}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="progress">Progress (%)</Label>
              <Input
                id="progress"
                type="number"
                min={0}
                max={100}
                value={form.progress}
                onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_started">Not Started</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="monev">Monev (Monitoring & Evaluasi)</Label>
            <Textarea
              id="monev"
              value={form.monev}
              onChange={(e) => setForm({ ...form, monev: e.target.value })}
              placeholder="Catatan monitoring dan evaluasi"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deliverable_result">Deliverable Result (Attachment)</Label>
            {form.deliverable_result && (
              <div className="flex items-center gap-2 mb-2">
                <a href={form.deliverable_result} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                  {form.deliverable_result.split('/').pop()}
                </a>
                <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, deliverable_result: '' })} className="text-destructive h-7 px-2">Hapus</Button>
              </div>
            )}
            <Input
              id="deliverable_result"
              type="file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) return;
                const ext = file.name.split('.').pop();
                const filePath = `request/${task?.id || 'new'}/${Date.now()}.${ext}`;
                const { data, error } = await supabase.storage.from('deliverable-attachments').upload(filePath, file);
                if (error) return;
                const { data: urlData } = supabase.storage.from('deliverable-attachments').getPublicUrl(data.path);
                setForm({ ...form, deliverable_result: urlData.publicUrl });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="problem">Problem</Label>
            <Textarea
              id="problem"
              value={form.problem}
              onChange={(e) => setForm({ ...form, problem: e.target.value })}
              placeholder="Kendala/masalah yang dihadapi"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.name.trim()}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Kirim Permintaan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
