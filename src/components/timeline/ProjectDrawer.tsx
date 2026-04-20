import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { ExternalLink, Pencil, Save, X, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface MasterProyekOption {
  id: string;
  name: string;
}

interface ProjectDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: {
    id: string;
    title: string;
    description: string;
    status: string;
    project_stage: string;
    priority: string;
    start_date?: string | null;
    end_date?: string | null;
    master_proyek_name?: string;
    master_proyek_id?: string;
    executors?: string[];
    progress?: number;
  } | null;
  isSuperAdmin?: boolean;
  masterProyekList?: MasterProyekOption[];
}

const stageLabels: Record<string, string> = {
  planning: 'Planning',
  execution: 'Execution',
  evaluation: 'Evaluation',
  followup: 'Follow-up',
};

const stageBadgeVariant: Record<string, string> = {
  planning: 'bg-chart-5/15 text-chart-5 border-chart-5/30',
  execution: 'bg-success/15 text-success border-success/30',
  evaluation: 'bg-warning/15 text-warning border-warning/30',
  followup: 'bg-chart-4/15 text-chart-4 border-chart-4/30',
};

const priorityLabels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

interface EditForm {
  title: string;
  description: string;
  priority: string;
  project_stage: string;
  start_date: Date | null;
  end_date: Date | null;
  master_proyek_id: string;
}

export function ProjectDrawer({ open, onOpenChange, project, isSuperAdmin, masterProyekList = [] }: ProjectDrawerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    title: '',
    description: '',
    priority: 'medium',
    project_stage: 'planning',
    start_date: null,
    end_date: null,
    master_proyek_id: '',
  });

  // Reset edit mode when drawer closes or project changes
  useEffect(() => {
    if (!open) {
      setIsEditing(false);
    }
  }, [open]);

  useEffect(() => {
    if (project) {
      setEditForm({
        title: project.title,
        description: project.description,
        priority: project.priority,
        project_stage: project.project_stage,
        start_date: project.start_date ? parseISO(project.start_date) : null,
        end_date: project.end_date ? parseISO(project.end_date) : null,
        master_proyek_id: project.master_proyek_id || '',
      });
    }
  }, [project]);

  if (!project) return null;

  const handleStartEdit = () => {
    setEditForm({
      title: project.title,
      description: project.description,
      priority: project.priority,
      project_stage: project.project_stage,
      start_date: project.start_date ? parseISO(project.start_date) : null,
      end_date: project.end_date ? parseISO(project.end_date) : null,
      master_proyek_id: project.master_proyek_id || '',
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    // Validation
    if (!editForm.title.trim()) {
      toast({ title: 'Error', description: 'Judul proyek wajib diisi', variant: 'destructive' });
      return;
    }
    if (!editForm.description.trim()) {
      toast({ title: 'Error', description: 'Deskripsi proyek wajib diisi', variant: 'destructive' });
      return;
    }
    if (editForm.start_date && editForm.end_date && editForm.start_date > editForm.end_date) {
      toast({ title: 'Error', description: 'Tanggal mulai tidak boleh setelah tanggal selesai', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        priority: editForm.priority,
        project_stage: editForm.project_stage,
        master_proyek_id: editForm.master_proyek_id || null,
      };
      if (editForm.start_date) {
        updates.start_date = format(editForm.start_date, 'yyyy-MM-dd');
      }
      if (editForm.end_date) {
        updates.end_date = format(editForm.end_date, 'yyyy-MM-dd');
      }

      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', project.id);

      if (error) throw error;

      toast({ title: 'Berhasil', description: 'Proyek berhasil diperbarui' });
      setIsEditing(false);

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['timeline-projects'] });
      queryClient.invalidateQueries({ queryKey: ['timeline-project-detail', project.id] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Gagal menyimpan perubahan', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[450px] overflow-y-auto">
        <SheetHeader>
          {isEditing ? (
            <div className="space-y-2 pr-6">
              <Label htmlFor="edit-title">Judul Proyek</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Judul proyek"
                maxLength={200}
              />
            </div>
          ) : (
            <SheetTitle className="text-lg leading-tight pr-6">{project.title}</SheetTitle>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {isEditing ? (
            <>
              {/* Stage */}
              <div className="space-y-2">
                <Label>Fase Proyek</Label>
                <Select value={editForm.project_stage} onValueChange={(v) => setEditForm(prev => ({ ...prev, project_stage: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="execution">Execution</SelectItem>
                    <SelectItem value="evaluation">Evaluation</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <Label>Prioritas</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="edit-desc">Deskripsi</Label>
                <Textarea
                  id="edit-desc"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Deskripsi proyek"
                  rows={4}
                  maxLength={2000}
                />
              </div>

              {/* Kategori Proyek */}
              <div className="space-y-2">
                <Label>Kategori Proyek</Label>
                <Select value={editForm.master_proyek_id || 'none'} onValueChange={(v) => setEditForm(prev => ({ ...prev, master_proyek_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {masterProyekList.map(mp => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mulai</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal text-xs", !editForm.start_date && "text-muted-foreground")}
                      >
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        {editForm.start_date ? format(editForm.start_date, 'dd MMM yyyy', { locale: localeId }) : 'Pilih'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={editForm.start_date || undefined}
                        onSelect={(date) => setEditForm(prev => ({ ...prev, start_date: date || null }))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Selesai</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal text-xs", !editForm.end_date && "text-muted-foreground")}
                      >
                        <Calendar className="mr-1.5 h-3.5 w-3.5" />
                        {editForm.end_date ? format(editForm.end_date, 'dd MMM yyyy', { locale: localeId }) : 'Pilih'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={editForm.end_date || undefined}
                        onSelect={(date) => setEditForm(prev => ({ ...prev, end_date: date || null }))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1 gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Menyimpan...' : 'Simpan'}
                </Button>
                <Button onClick={handleCancelEdit} variant="outline" className="flex-1 gap-2">
                  <X className="w-4 h-4" />
                  Batal
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Status & Stage */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={stageBadgeVariant[project.project_stage] || ''}>
                  {stageLabels[project.project_stage] || project.project_stage}
                </Badge>
                <Badge variant="secondary">
                  {priorityLabels[project.priority] || project.priority}
                </Badge>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Deskripsi</p>
                <p className="text-sm">{project.description}</p>
              </div>

              {/* Master Proyek */}
              {project.master_proyek_name && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Kategori Proyek</p>
                  <p className="text-sm">{project.master_proyek_name}</p>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Mulai</p>
                  <p className="text-sm">
                    {project.start_date
                      ? format(new Date(project.start_date), 'dd MMM yyyy', { locale: localeId })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Selesai</p>
                  <p className="text-sm">
                    {project.end_date
                      ? format(new Date(project.end_date), 'dd MMM yyyy', { locale: localeId })
                      : '-'}
                  </p>
                </div>
              </div>

              {/* Executors */}
              {project.executors && project.executors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Penanggung Jawab</p>
                  <div className="flex flex-wrap gap-1">
                    {project.executors.map((name, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Progress */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-muted-foreground">Progress</p>
                  <p className="text-sm font-semibold">{project.progress ?? 0}%</p>
                </div>
                <Progress value={project.progress ?? 0} className="h-2" />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1 gap-2">
                  <Link to={`/project/${project.id}`}>
                    <ExternalLink className="w-4 h-4" />
                    Lihat Detail
                  </Link>
                </Button>
                {isSuperAdmin && (
                  <Button variant="outline" className="flex-1 gap-2" onClick={handleStartEdit}>
                    <Pencil className="w-4 h-4" />
                    Edit Project
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
