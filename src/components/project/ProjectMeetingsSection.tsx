import { useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, Clock, Download, Plus, Trash2, Users, Pencil } from 'lucide-react';
import { useMeetings } from '@/hooks/useMeetings';
import { useAuth } from '@/hooks/useAuth';
import { AddMeetingDialog } from '@/components/timeline/AddMeetingDialog';
import { MeetingDetailDialog } from '@/components/timeline/MeetingDetailDialog';
import { EditMeetingDialog } from '@/components/timeline/EditMeetingDialog';

interface ProjectMeetingsSectionProps {
  projectId: string;
  canManage: boolean;
}

export function ProjectMeetingsSection({ projectId, canManage }: ProjectMeetingsSectionProps) {
  const { isSuperAdmin } = useAuth();
  const { meetings, isLoading, deleteMeeting } = useMeetings({ projectId });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [editMeeting, setEditMeeting] = useState<any>(null);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Meeting
          </CardTitle>
          {canManage && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4" />
              Tambah Meeting
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Memuat...</p>
          ) : meetings.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada meeting</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map(meeting => (
                <div
                  key={meeting.id}
                  className="flex items-start justify-between gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedMeeting(meeting)}
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <h4 className="font-semibold text-sm">{meeting.title}</h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {format(new Date(meeting.meeting_date), 'd MMMM yyyy', { locale: localeId })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {meeting.meeting_time?.slice(0, 5)}
                      </span>
                    </div>
                    {meeting.description && (
                      <p className="text-xs text-muted-foreground mt-1">{meeting.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" title="Edit" onClick={() => setEditMeeting(meeting)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    {meeting.attachment_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={meeting.attachment_url} target="_blank" rel="noopener noreferrer" title="Download Notulensi">
                          <Download className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <Button variant="ghost" size="icon" onClick={() => deleteMeeting.mutate(meeting.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddMeetingDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        defaultDate={format(new Date(), 'yyyy-MM-dd')}
        defaultProjectId={projectId}
      />

      <MeetingDetailDialog
        open={!!selectedMeeting}
        onOpenChange={(open) => { if (!open) setSelectedMeeting(null); }}
        meeting={selectedMeeting}
        onEdit={(m) => { setSelectedMeeting(null); setEditMeeting(m); }}
      />

      <EditMeetingDialog
        open={!!editMeeting}
        onOpenChange={(open) => { if (!open) setEditMeeting(null); }}
        meeting={editMeeting}
      />
    </>
  );
}
