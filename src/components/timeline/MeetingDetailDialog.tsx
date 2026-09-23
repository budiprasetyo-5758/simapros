import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, Download, FolderKanban, Eye, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MeetingDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: {
    id: string;
    title: string;
    meeting_date: string;
    meeting_time: string;
    description: string;
    attachment_url: string | null;
    project_id: string | null;
    projectTitle?: string;
  } | null;
  onEdit?: (meeting: any) => void;
}

export function MeetingDetailDialog({ open, onOpenChange, meeting, onEdit }: MeetingDetailDialogProps) {
  const navigate = useNavigate();

  if (!meeting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📅 {meeting.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4" />
              {format(new Date(meeting.meeting_date), 'd MMMM yyyy', { locale: localeId })}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {meeting.meeting_time?.slice(0, 5)}
            </span>
          </div>

          {meeting.projectTitle && (
            <div className="flex items-center gap-1.5 text-sm">
              <FolderKanban className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Project:</span>
              <Badge variant="outline">{meeting.projectTitle}</Badge>
            </div>
          )}

          {meeting.description && (
            <div>
              <p className="text-sm font-medium mb-1">Deskripsi</p>
              <p className="text-sm text-muted-foreground">{meeting.description}</p>
            </div>
          )}

          {meeting.attachment_url && (
            <div>
              <p className="text-sm font-medium mb-1">Notulensi</p>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={meeting.attachment_url} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4" />
                  Download Notulensi
                </a>
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                onOpenChange(false);
                navigate('/timeline');
              }}
            >
              <Eye className="w-4 h-4" />
              Lihat di Timeline
            </Button>
            {meeting.project_id && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/project/${meeting.project_id}`);
                }}
              >
                <FolderKanban className="w-4 h-4" />
                Lihat di Project
              </Button>
            )}
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => onEdit(meeting)}
              >
                <Pencil className="w-4 h-4" />
                Edit Meeting
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
