import { useState } from 'react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useMeetings } from '@/hooks/useMeetings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Clock, Download, Trash2, FolderKanban, ExternalLink, Plus, Pencil } from 'lucide-react';
import { MeetingDetailDialog } from './MeetingDetailDialog';
import { EditMeetingDialog } from './EditMeetingDialog';
import { AddMeetingDialog } from './AddMeetingDialog';
import { MeetingTodoList } from './MeetingTodoList';

export function MeetingHistoryView() {
  const { isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [selectedMeeting, setSelectedMeeting] = useState<any>(null);
  const [editMeeting, setEditMeeting] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { meetings, isLoading, deleteMeeting } = useMeetings({
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    projectId: projectFilter === 'all' ? undefined : projectFilter,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['meeting-filter-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title')
        .in('status', ['approved', 'active'])
        .order('title');
      return data || [];
    },
  });

  return (
    <>
    <MeetingTodoList />
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Dari Tanggal</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[160px]" />
        </div>
        <div>
          <Label className="text-xs">Sampai Tanggal</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[160px]" />
        </div>
        <div>
          <Label className="text-xs">Project</Label>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Project</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="upcoming">Akan Datang</SelectItem>
              <SelectItem value="completed">Sudah Selesai</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(startDate || endDate || projectFilter !== 'all' || statusFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setStartDate(''); setEndDate(''); setProjectFilter('all'); setStatusFilter('all'); }}>
            Reset Filter
          </Button>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAddDialog(true)}>
            <Plus className="w-4 h-4" />
            Tambah Meeting
          </Button>
        </div>
      </div>

      {/* Meeting List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Memuat...</p>
      ) : meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Belum ada meeting</p>
      ) : (
        <div className="space-y-3">
          {(() => {
            const today = format(new Date(), 'yyyy-MM-dd');
            const filtered = meetings.filter(m => {
              if (statusFilter === 'all') return true;
              if (statusFilter === 'upcoming') return m.meeting_date >= today;
              return m.meeting_date < today;
            });
            if (filtered.length === 0) return (
              <p className="text-sm text-muted-foreground py-8 text-center">Tidak ada meeting yang sesuai filter</p>
            );
            return filtered.map(meeting => {
            const project = projects.find(p => p.id === meeting.project_id);
            return (
              <Card
                key={meeting.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedMeeting({ ...meeting, projectTitle: project?.title })}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-card-foreground">{meeting.title}</h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {meeting.meeting_date >= today ? (
                          <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/10 text-[10px] px-1.5 py-0">Akan Datang</Badge>
                        ) : (
                          <Badge className="bg-green-500/10 text-green-600 border-green-200 hover:bg-green-500/10 text-[10px] px-1.5 py-0">Selesai</Badge>
                        )}
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {format(new Date(meeting.meeting_date), 'd MMMM yyyy', { locale: localeId })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {meeting.meeting_time?.slice(0, 5)}
                        </span>
                        {project && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <FolderKanban className="w-3 h-3" />
                            {project.title}
                          </Badge>
                        )}
                      </div>
                      {meeting.description && (
                        <p className="text-xs text-muted-foreground mt-1">{meeting.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      {meeting.project_id && (
                        <Button variant="ghost" size="icon" title="Lihat di Project" onClick={() => navigate(`/project/${meeting.project_id}`)}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Edit Meeting" onClick={() => setEditMeeting(meeting)}>
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
                </CardContent>
              </Card>
            );
           });
          })()}
        </div>
      )}
    </div>

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

    <AddMeetingDialog
      open={showAddDialog}
      onOpenChange={setShowAddDialog}
      defaultDate={format(new Date(), 'yyyy-MM-dd')}
    />
    </>
  );
}
