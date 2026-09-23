import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskStatus, GanttTask } from '@/types/project';

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    wbs_number: string;
    name: string;
    description: string;
    pic: string;
    start_date: string;
    end_date: string;
    status: TaskStatus;
    monev: string;
    phase: string;
    parent_task_id?: string | null;
  }) => Promise<{ success: boolean }>;
  projectStartDate: string;
  projectEndDate: string;
  parentTask: GanttTask | null;
  siblingTasks: GanttTask[];
  phase: string;
}

export function AddTaskDialog({
  open,
  onClose,
  onSubmit,
  projectStartDate,
  projectEndDate,
  parentTask,
  siblingTasks,
  phase,
}: AddTaskDialogProps) {
  // Calculate automatic WBS number â€” local per phase
  const calculateWbsNumber = () => {
    // Sub-task: parent.{n} based on existing siblings under same parent
    if (parentTask) {
      const parentWbs = parentTask.wbs_number || '';
      if (!parentWbs) return '';
      const existingSubtaskCount = siblingTasks.filter(t => t.parent_task_id === parentTask.id).length;
      return `${parentWbs}.${existingSubtaskCount + 1}`;
    }

    // Root task in a phase: WBS is local per phase (1, 2, 3, ...)
    if (phase) {
      const rootTasksInPhase = siblingTasks.filter(
        t => !t.parent_task_id && (t.phase || '').trim().toLowerCase() === phase.trim().toLowerCase()
      );
      // Find max integer WBS already used in this phase, then +1
      const maxNum = rootTasksInPhase.reduce((max, t) => {
        const first = parseInt((t.wbs_number || '').split('.')[0], 10);
        return isNaN(first) ? max : Math.max(max, first);
      }, 0);
      return `${maxNum + 1}`;
    }

    return '';
  };

  const [formData, setFormData] = useState({
    wbs_number: '',
    name: '',
    description: '',
    pic: '',
    start_date: projectStartDate,
    end_date: projectStartDate,
    status: 'not_started' as TaskStatus,
    monev: '',
    phase: phase,
    parent_task_id: parentTask?.id || null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update WBS and phase when parent task changes
  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        wbs_number: calculateWbsNumber(),
        phase: phase,
        parent_task_id: parentTask?.id || null,
        start_date: projectStartDate,
        end_date: projectStartDate,
      }));
    }
  }, [open, parentTask, phase, projectStartDate]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    
    setIsSubmitting(true);
    try {
      const result = await onSubmit(formData);
      if (result.success) {
        setFormData({
          wbs_number: '',
          name: '',
          description: '',
          pic: '',
          start_date: projectStartDate,
          end_date: projectStartDate,
          status: 'not_started',
          monev: '',
          phase: phase,
          parent_task_id: null,
        });
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const dialogTitle = parentTask 
    ? `Tambah Sub-Task untuk "${parentTask.name}"`
    : phase
      ? `Tambah Task pada Fase "${phase}"`
      : 'Tambah Task Baru';

  const wbsAutoFilled = !!parentTask || (!!phase && !!formData.wbs_number);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="wbs_number">WBS Number</Label>
              <Input
                id="wbs_number"
                value={formData.wbs_number}
                onChange={(e) => setFormData({ ...formData, wbs_number: e.target.value })}
                placeholder={parentTask ? "Otomatis" : "1.1"}
                className="bg-muted/50"
                readOnly={wbsAutoFilled}
              />
              {wbsAutoFilled && (
                <p className="text-xs text-muted-foreground">
                  {parentTask ? 'WBS otomatis berdasarkan parent task' : 'WBS otomatis berdasarkan fase'}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Fase</Label>
              <Input
                value={phase || 'Tanpa Fase'}
                disabled
                className="bg-muted/50"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Nama Tugas *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Masukkan nama tugas"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Deskripsi tugas (opsional)"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="pic">PIC</Label>
              <Input
                id="pic"
                value={formData.pic}
                onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                placeholder="Penanggung jawab"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(v) => setFormData({ ...formData, status: v as TaskStatus })}
              >
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

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="start_date">Tanggal Mulai</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                min={projectStartDate}
                max={projectEndDate}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="end_date">Tanggal Selesai</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                min={formData.start_date}
                max={projectEndDate}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="monev">MONEV</Label>
            <Textarea
              id="monev"
              value={formData.monev}
              onChange={(e) => setFormData({ ...formData, monev: e.target.value })}
              placeholder="Catatan monitoring & evaluasi (opsional)"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !formData.name.trim()}
          >
            {isSubmitting ? 'Menyimpan...' : 'Tambah Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
