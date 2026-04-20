import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';
import { GanttTask, Project } from '@/types/project';

interface FullscreenGanttDialogProps {
  children: React.ReactNode;
  projectTitle?: string;
}

export function FullscreenGanttDialog({ children, projectTitle }: FullscreenGanttDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-7">
          <Maximize2 className="w-3.5 h-3.5" />
          Fullscreen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-lg">{projectTitle || 'Gantt Chart'}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden p-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
