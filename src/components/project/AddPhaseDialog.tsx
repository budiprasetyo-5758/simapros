import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TaskStatus } from '@/types/project';

interface AddPhaseDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    phase: string;
    name: string;
    description: string;
    pic: string;
    start_date: string;
    end_date: string;
    status: TaskStatus;
    monev: string;
  }) => Promise<{ success: boolean }>;
  projectStartDate: string;
  projectEndDate: string;
  existingPhases: string[];
}

const phaseOptions = [
  { value: 'planning', label: 'Perencanaan' },
  { value: 'execution', label: 'Pelaksanaan' },
  { value: 'evaluation', label: 'Evaluasi' },
  { value: 'followup', label: 'Tindak Lanjut' },
];

export function AddPhaseDialog({
  open,
  onClose,
  onSubmit,
  projectStartDate,
  projectEndDate,
  existingPhases,
}: AddPhaseDialogProps) {
  const [formData, setFormData] = useState({
    phase: '',
    name: '',
    description: '',
    pic: '',
    start_date: projectStartDate,
    end_date: projectStartDate,
    status: 'not_started' as TaskStatus,
    monev: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out existing phases
  const availablePhases = phaseOptions.filter(p => !existingPhases.includes(p.value));

  const handleSubmit = async () => {
    if (!formData.phase || !formData.name.trim()) return;
    
    setIsSubmitting(true);
    try {
      const result = await onSubmit(formData);
      if (result.success) {
        setFormData({
          phase: '',
          name: '',
          description: '',
          pic: '',
          start_date: projectStartDate,
          end_date: projectStartDate,
          status: 'not_started',
          monev: '',
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Tambah Fase Baru</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="phase">Fase *</Label>
            <Select 
              value={formData.phase} 
              onValueChange={(v) => setFormData({ ...formData, phase: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih fase" />
              </SelectTrigger>
              <SelectContent>
                {availablePhases.length > 0 ? (
                  availablePhases.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))
                ) : (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    Semua fase sudah ada
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Nama Tugas Pertama *</Label>
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
            disabled={isSubmitting || !formData.phase || !formData.name.trim() || availablePhases.length === 0}
          >
            {isSubmitting ? 'Menyimpan...' : 'Tambah Fase'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
