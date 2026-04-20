import { useState } from 'react';
import { Sparkles, Loader2, Plus, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { GanttTask } from '@/types/project';

interface AITaskSuggestion {
  wbs_number: string;
  name: string;
  description: string;
  phase: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  progress: number;
  status: string;
  pic: string;
  monev: string;
}

interface TaskSuggestionDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  projectDescription: string;
  startDate: string;
  endDate: string;
  masterProyekName?: string;
  onAddTasks: (tasks: Omit<GanttTask, 'id'>[]) => Promise<void>;
  isExecutor?: boolean;
}

export function TaskSuggestionDialog({
  open,
  onClose,
  projectId,
  projectTitle,
  projectDescription,
  startDate,
  endDate,
  masterProyekName,
  onAddTasks,
  isExecutor = false,
}: TaskSuggestionDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AITaskSuggestion[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  const generateSuggestions = async () => {
    setIsLoading(true);
    setSuggestions([]);
    setSelectedTasks(new Set());

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-task-suggestions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            project_title: projectTitle,
            project_description: projectDescription,
            start_date: startDate,
            end_date: endDate,
            master_proyek_name: masterProyekName,
          }),
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          toast({
            title: 'Rate Limit',
            description: 'Terlalu banyak permintaan. Silakan coba lagi nanti.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        if (response.status === 402) {
          toast({
            title: 'Kredit Habis',
            description: 'Kredit AI habis. Silakan tambah kredit.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to generate suggestions');
      }

      const data = await response.json();
      if (data.tasks && Array.isArray(data.tasks)) {
        setSuggestions(data.tasks);
        // Select all by default
        setSelectedTasks(new Set(data.tasks.map((t: AITaskSuggestion) => t.wbs_number)));
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      toast({
        title: 'Error',
        description: 'Gagal membuat saran task. Silakan coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (wbsNumber: string) => {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(wbsNumber)) {
      newSelected.delete(wbsNumber);
    } else {
      newSelected.add(wbsNumber);
    }
    setSelectedTasks(newSelected);
  };

  const toggleAll = () => {
    if (selectedTasks.size === suggestions.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(suggestions.map((t) => t.wbs_number)));
    }
  };

  const handleAddTasks = async () => {
    const tasksToAdd = suggestions
      .filter((t) => selectedTasks.has(t.wbs_number))
      .map((task) => ({
        project_id: projectId,
        wbs_number: task.wbs_number,
        name: task.name,
        description: task.description,
        phase: task.phase,
        start_date: task.start_date,
        end_date: task.end_date,
        progress: 0,
        status: 'not_started' as const,
        pic: '',
        monev: '',
      }));

    if (tasksToAdd.length === 0) {
      toast({
        title: 'Tidak Ada Task Dipilih',
        description: 'Silakan pilih minimal satu task untuk ditambahkan.',
        variant: 'destructive',
      });
      return;
    }

    setIsAdding(true);
    try {
      await onAddTasks(tasksToAdd);
      toast({
        title: isExecutor ? 'Permintaan Terkirim' : 'Task Ditambahkan',
        description: isExecutor 
          ? `${tasksToAdd.length} task telah dikirim untuk approval Super Admin.`
          : `${tasksToAdd.length} task berhasil ditambahkan ke proyek.`,
      });
      onClose();
    } catch (error) {
      console.error('Error adding tasks:', error);
      toast({
        title: 'Error',
        description: 'Gagal menambahkan task.',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const phaseColors: Record<string, string> = {
    planning: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    execution: 'bg-green-500/10 text-green-500 border-green-500/20',
    evaluation: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    followup: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  };

  const phaseLabels: Record<string, string> = {
    planning: 'Planning',
    execution: 'Execution',
    evaluation: 'Evaluation',
    followup: 'Follow-up',
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Task Suggestions
          </DialogTitle>
          <DialogDescription>
            AI akan menganalisis deskripsi proyek dan menyarankan daftar task yang terstruktur.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {suggestions.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">
                Generate Task Suggestions
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Klik tombol di bawah untuk membuat saran task berdasarkan deskripsi proyek.
              </p>
              <Button onClick={generateSuggestions} className="mt-6 gap-2">
                <Sparkles className="w-4 h-4" />
                Generate Suggestions
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Menganalisis proyek...</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={toggleAll}>
                  {selectedTasks.size === suggestions.length ? (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Batal Pilih Semua
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Pilih Semua
                    </>
                  )}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedTasks.size} dari {suggestions.length} task dipilih
                </span>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <div className="p-4 space-y-3">
                  {suggestions.map((task) => (
                    <div
                      key={task.wbs_number}
                      className={`p-4 border rounded-lg transition-colors cursor-pointer ${
                        selectedTasks.has(task.wbs_number)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => toggleTask(task.wbs_number)}
                    >
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedTasks.has(task.wbs_number)}
                          onCheckedChange={() => toggleTask(task.wbs_number)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-xs text-muted-foreground">
                              {task.wbs_number}
                            </span>
                            <Badge variant="outline" className={phaseColors[task.phase]}>
                              {phaseLabels[task.phase] || task.phase}
                            </Badge>
                          </div>
                          <h4 className="font-medium">{task.name}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>📅 {task.start_date} - {task.end_date}</span>
                            <span>⏱️ {task.duration_days} hari</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          {suggestions.length > 0 && (
            <>
              <Button variant="outline" onClick={generateSuggestions} disabled={isLoading}>
                <Sparkles className="w-4 h-4 mr-2" />
                Regenerate
              </Button>
              <Button onClick={handleAddTasks} disabled={isAdding || selectedTasks.size === 0}>
                {isAdding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menambahkan...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambahkan {selectedTasks.size} Task
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
