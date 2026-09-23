import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GanttTask, TaskStatus } from '@/types/project';
import { Loader2 } from 'lucide-react';

interface AdminTaskEditDialogProps {
  open: boolean;
  onClose: () => void;
  task: GanttTask | null;
  projectStartDate: string;
  projectEndDate: string;
  onSubmit: (taskId: string, updates: Partial<GanttTask>) => Promise<{ success: boolean }>;
}

export function AdminTaskEditDialog({
  open,
  onClose,
  task,
  projectStartDate,
  projectEndDate,
  onSubmit,
}: AdminTaskEditDialogProps) {
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
    if (open && task) {
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
    }
  }, [open, task]);

  const handleSubmit = async () => {
    if (!form.name.trim() || !task) return;
    
    setIsSubmitting(true);
    try {
      const updates: Partial<GanttTask> = {};
      if (form.name !== task.name) updates.name = form.name;
      if (form.description !== task.description) updates.description = form.description;
      if (form.pic !== task.pic) updates.pic = form.pic;
      if (form.phase !== task.phase) updates.phase = form.phase;
      if (form.start_date !== task.start_date) updates.start_date = form.start_date;
      if (form.end_date !== task.end_date) updates.end_date = form.end_date;
      if (form.progress !== task.progress) updates.progress = form.progress;
      if (form.status !== task.status) updates.status = form.status;
      if (form.monev !== task.monev) updates.monev = form.monev;
      if (form.wbs_number !== task.wbs_number) updates.wbs_number = form.wbs_number;
      if (form.deliverable_result !== (task.deliverable_result || '')) updates.deliverable_result = form.deliverable_result;
      if (form.problem !== (task.problem || '')) updates.problem = form.problem;

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      const result = await onSubmit(task.id, updates);
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
          <DialogTitle>Edit Task</DialogTitle>
          <DialogDescription>
            Edit langsung data task. Perubahan akan disimpan segera.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin_wbs">WBS Number</Label>
              <Input id="admin_wbs" value={form.wbs_number} onChange={(e) => setForm({ ...form, wbs_number: e.target.value })} placeholder="1.1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_phase">Phase</Label>
              <Select value={form.phase} onValueChange={(v) => setForm({ ...form, phase: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih phase" /></SelectTrigger>
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
            <Label htmlFor="admin_name">Nama Task *</Label>
            <Input id="admin_name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nama task" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin_desc">Deskripsi</Label>
            <Textarea id="admin_desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Deskripsi task" rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin_pic">PIC</Label>
            <Input id="admin_pic" value={form.pic} onChange={(e) => setForm({ ...form, pic: e.target.value })} placeholder="Nama PIC" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin_start">Tanggal Mulai</Label>
              <Input id="admin_start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} min={projectStartDate} max={projectEndDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_end">Tanggal Selesai</Label>
              <Input id="admin_end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} min={form.start_date || projectStartDate} max={projectEndDate} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin_progress">Progress (%)</Label>
              <Input id="admin_progress" type="number" min={0} max={100} value={form.progress} onChange={(e) => setForm({ ...form, progress: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin_status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Label htmlFor="admin_monev">Monev</Label>
            <Textarea id="admin_monev" value={form.monev} onChange={(e) => setForm({ ...form, monev: e.target.value })} placeholder="Catatan monitoring dan evaluasi" rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin_deliverable">Deliverable Result (Attachment)</Label>
            {form.deliverable_result && (
              <div className="flex items-center gap-2 mb-2">
                <a href={form.deliverable_result} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate flex-1">
                  {form.deliverable_result.split('/').pop()}
                </a>
                <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, deliverable_result: '' })} className="text-destructive h-7 px-2">Hapus</Button>
              </div>
            )}
            <Input
              id="admin_deliverable"
              type="file"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 10 * 1024 * 1024) return;
                const ext = file.name.split('.').pop();
                const filePath = `admin/${task?.id}/${Date.now()}.${ext}`;
                const { data, error } = await (await import('@/integrations/supabase/client')).supabase.storage.from('deliverable-attachments').upload(filePath, file);
                if (error) return;
                const { data: urlData } = (await import('@/integrations/supabase/client')).supabase.storage.from('deliverable-attachments').getPublicUrl(data.path);
                setForm({ ...form, deliverable_result: urlData.publicUrl });
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin_problem">Problem</Label>
            <Textarea id="admin_problem" value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} placeholder="Kendala/masalah yang dihadapi" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Batal</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.name.trim()}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
