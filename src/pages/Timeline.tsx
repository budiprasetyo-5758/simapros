import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { TimelineCalendar, ColorMode, ViewRange } from '@/components/timeline/TimelineCalendar';
import { TaskCalendarView, TaskCalendarItem } from '@/components/timeline/TaskCalendarView';
import { ProjectDrawer } from '@/components/timeline/ProjectDrawer';
import { AddMeetingDialog } from '@/components/timeline/AddMeetingDialog';
import { MeetingHistoryView } from '@/components/timeline/MeetingHistoryView';
import { MeetingDetailDialog } from '@/components/timeline/MeetingDetailDialog';
import { EditMeetingDialog } from '@/components/timeline/EditMeetingDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelectFilter } from '@/components/timeline/MultiSelectFilter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, CalendarDays, ExternalLink, ListChecks, FolderKanban, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { id as localeId } from 'date-fns/locale';
import { format } from 'date-fns';
import type { Meeting } from '@/hooks/useMeetings';

type TimelineMeeting = Pick<
  Meeting,
  'id' | 'title' | 'meeting_date' | 'meeting_time' | 'description' | 'attachment_url' | 'project_id'
> & { projectTitle?: string };

// Color palettes
const MASTER_COLORS = [
  '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

const STAGE_COLORS: Record<string, string> = {
  planning: '#3b82f6',
  execution: '#10b981',
  evaluation: '#f59e0b',
  followup: '#8b5cf6',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#9ca3af',
  medium: '#3b82f6',
  high: '#f97316',
  urgent: '#ef4444',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  'not_started': '#9ca3af',
  'in_progress': '#3b82f6',
  'completed': '#10b981',
  'delayed': '#ef4444',
  'on_hold': '#f59e0b',
};

const MEETING_COLOR = '#e11d48';

const TASK_STATUS_LABELS: Record<string, string> = {
  'not_started': 'Belum Mulai',
  'in_progress': 'Sedang Berjalan',
  'completed': 'Selesai',
  'delayed': 'Terlambat',
  'on_hold': 'Ditunda',
};

type ViewMode = 'project' | 'task' | 'meeting';

export default function Timeline() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [colorMode, setColorMode] = useState<ColorMode>('status_pdca');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [viewRange, setViewRange] = useState<ViewRange>('month');
  const [viewMode, setViewMode] = useState<ViewMode>('project');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [taskProjectFilter, setTaskProjectFilter] = useState<string[]>([]);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [meetingDefaultDate, setMeetingDefaultDate] = useState<string>('');
  const [selectedMeeting, setSelectedMeeting] = useState<TimelineMeeting | null>(null);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);

  // Redirect non-super-admin
  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      navigate('/');
    }
  }, [authLoading, isSuperAdmin, navigate]);

  // Fetch projects with master_proyek
  const { data: projects = [] } = useQuery({
    queryKey: ['timeline-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, description, start_date, end_date, project_stage, priority, status, master_proyek_id, current_priority_assessment_id, master_proyek:master_proyek_id(id, name)')
        .in('status', ['approved', 'active'])
        .not('start_date', 'is', null)
        .not('end_date', 'is', null);
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Fetch meetings for timeline integration
  const { data: meetings = [] } = useQuery({
    queryKey: ['timeline-meetings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, meeting_time, project_id, description, attachment_url')
        .order('meeting_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Fetch tasks for task view
  const { data: tasks = [] } = useQuery({
    queryKey: ['timeline-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gantt_tasks')
        .select('id, name, start_date, end_date, status, progress, project_id, phase, pic')
        .order('start_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isSuperAdmin && viewMode === 'task',
  });

  // Build project info map for tasks (name + master_proyek_name)
  const projectInfoMap = useMemo(() => {
    const map: Record<string, { name: string; masterProyekName: string }> = {};
    projects.forEach(p => {
      map[p.id] = {
        name: p.title,
        masterProyekName: p.master_proyek?.name || '',
      };
    });
    return map;
  }, [projects]);

  // Fetch master proyek for color mapping
  const { data: masterProyeks = [] } = useQuery({
    queryKey: ['master-proyek-list'],
    queryFn: async () => {
      const { data } = await supabase.from('master_proyek').select('id, name');
      return data || [];
    },
    enabled: isSuperAdmin,
  });

  // Build master color map
  const masterColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    masterProyeks.forEach((mp, i) => {
      map[mp.id] = MASTER_COLORS[i % MASTER_COLORS.length];
    });
    return map;
  }, [masterProyeks]);

  // Map projects with colors + inject meetings as single-day bars
  const coloredProjects = useMemo(() => {
    const filteredProjects = projectFilter.length === 0
      ? projects
      : projects.filter(p => projectFilter.includes(p.id));

    const projectItems = filteredProjects.map(p => {
      let color = '#6b7280';
      const masterName = p.master_proyek?.name || '';
      
      if (colorMode === 'master_proyek') {
        color = (p.master_proyek_id && masterColorMap[p.master_proyek_id]) || '#6b7280';
      } else if (colorMode === 'status_pdca') {
        color = STAGE_COLORS[p.project_stage] || '#6b7280';
      } else if (colorMode === 'urgency') {
        color = PRIORITY_COLORS[p.priority] || '#6b7280';
      }

      return {
        id: p.id,
        title: p.title,
        start_date: p.start_date!,
        end_date: p.end_date!,
        project_stage: p.project_stage,
        priority: p.priority,
        master_proyek_id: p.master_proyek_id,
        master_proyek_name: masterName,
        current_priority_assessment_id: p.current_priority_assessment_id,
        color,
        isMeeting: false,
      };
    });

    // Add meetings as single-day items
    const meetingItems = meetings.map(m => ({
      id: `meeting-${m.id}`,
      title: `📅 ${m.title}`,
      start_date: m.meeting_date,
      end_date: m.meeting_date,
      project_stage: 'meeting',
      priority: 'medium',
      master_proyek_id: null,
        master_proyek_name: m.meeting_time?.slice(0, 5) || '',
        current_priority_assessment_id: null,
      color: MEETING_COLOR,
      isMeeting: true,
    }));

    return [...projectItems, ...meetingItems];
  }, [projects, meetings, colorMode, masterColorMap, projectFilter]);

  // Map tasks to TaskCalendarItem format + inject meetings
  const calendarTasks: TaskCalendarItem[] = useMemo(() => {
    let filteredTasks = taskStatusFilter.length === 0 
      ? tasks 
      : tasks.filter(t => taskStatusFilter.includes(t.status || 'not_started'));
    
    if (taskProjectFilter.length > 0) {
      filteredTasks = filteredTasks.filter(t => taskProjectFilter.includes(t.project_id));
    }
    
    const taskItems = filteredTasks.map(t => {
      const info = projectInfoMap[t.project_id] || { name: '', masterProyekName: '' };
      const status = t.status || 'not_started';
      return {
        id: t.id,
        taskName: t.name,
        projectName: info.name,
        masterProyekName: info.masterProyekName,
        startDate: t.start_date,
        endDate: t.end_date,
        status,
        statusLabel: TASK_STATUS_LABELS[status] || status,
        statusColor: TASK_STATUS_COLORS[status] || '#6b7280',
        projectId: t.project_id,
      };
    });

    // Add meetings as single-day task items
    const meetingItems: TaskCalendarItem[] = meetings.map(m => ({
      id: `meeting-${m.id}`,
      taskName: `📅 ${m.title}`,
      projectName: m.meeting_time?.slice(0, 5) || '',
      masterProyekName: '',
      startDate: m.meeting_date,
      endDate: m.meeting_date,
      status: 'meeting',
      statusLabel: 'Meeting',
      statusColor: MEETING_COLOR,
      projectId: m.project_id || '',
    }));

    return [...taskItems, ...meetingItems];
  }, [tasks, meetings, taskStatusFilter, taskProjectFilter, projectInfoMap]);

  // Selected project detail for drawer
  const { data: selectedProject } = useQuery({
    queryKey: ['timeline-project-detail', selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      
      const [projectRes, assignmentsRes, tasksRes] = await Promise.all([
        supabase
          .from('projects')
          .select('id, title, description, project_stage, priority, start_date, end_date, master_proyek_id, current_priority_assessment_id, master_proyek:master_proyek_id(name)')
          .eq('id', selectedProjectId)
          .single(),
        supabase
          .from('project_assignments')
          .select('user_id')
          .eq('project_id', selectedProjectId),
        supabase
          .from('gantt_tasks')
          .select('progress')
          .eq('project_id', selectedProjectId),
      ]);

      const project = projectRes.data;
      if (!project) return null;

      // Fetch executor names
      let executors: string[] = [];
      if (assignmentsRes.data && assignmentsRes.data.length > 0) {
        const userIds = assignmentsRes.data.map(a => a.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('name')
          .in('id', userIds);
        executors = profiles?.map(p => p.name) || [];
      }

      // Calculate avg progress
      const projectTasks = tasksRes.data || [];
      const avgProgress = projectTasks.length > 0
        ? Math.round(projectTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / projectTasks.length)
        : 0;

      return {
        id: project.id,
        title: project.title,
        description: project.description,
        project_stage: project.project_stage,
        priority: project.priority,
        start_date: project.start_date,
        end_date: project.end_date,
        master_proyek_id: project.master_proyek_id,
        master_proyek_name: project.master_proyek?.name || '',
        current_priority_assessment_id: project.current_priority_assessment_id,
        executors,
        progress: avgProgress,
        status: '',
      };
    },
    enabled: !!selectedProjectId,
  });

  // Sync to Google Calendar
  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar');
      if (error) throw error;
      const parts = [
        `${data?.synced || 0}/${data?.total || 0} jadwal meeting berhasil disinkronkan.`,
      ];
      if (data?.cleaned > 0) {
        parts.push(`${data.cleaned} event project lama dibersihkan dari Google Calendar.`);
      }
      if (data?.syncErrors?.length > 0) {
        parts.push(`${data.syncErrors.length} meeting gagal sync.`);
      }
      toast({
        title: data?.syncErrors?.length > 0 ? 'Sync Selesai (Sebagian Gagal)' : 'Sync Berhasil',
        description: parts.join(' '),
        variant: data?.syncErrors?.length > 0 ? 'destructive' : 'default',
      });
    } catch (err: unknown) {
      toast({
        title: 'Sync Gagal',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan saat sync ke Google Calendar.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };


  // Fetch Google Calendar URL
  const { data: calendarUrl } = useQuery({
    queryKey: ['google-calendar-url'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-google-calendar', { method: 'GET' });
      if (error) throw error;
      return data?.url as string;
    },
    enabled: isSuperAdmin,
  });

  // Legend
  const legendItems = useMemo(() => {
    const meetingLegend = { label: 'Meeting', color: MEETING_COLOR };
    if (viewMode === 'task') {
      return [
        ...Object.entries(TASK_STATUS_LABELS).map(([key, label]) => ({
          label,
          color: TASK_STATUS_COLORS[key] || '#6b7280',
        })),
        meetingLegend,
      ];
    }
    if (colorMode === 'status_pdca') {
      return [
        { label: 'Planning', color: STAGE_COLORS.planning },
        { label: 'Execution', color: STAGE_COLORS.execution },
        { label: 'Evaluation', color: STAGE_COLORS.evaluation },
        { label: 'Follow-up', color: STAGE_COLORS.followup },
        meetingLegend,
      ];
    }
    if (colorMode === 'urgency') {
      return [
        { label: 'Low', color: PRIORITY_COLORS.low },
        { label: 'Medium', color: PRIORITY_COLORS.medium },
        { label: 'High', color: PRIORITY_COLORS.high },
        { label: 'Urgent', color: PRIORITY_COLORS.urgent },
        meetingLegend,
      ];
    }
    // master_proyek
    return [
      ...masterProyeks.map((mp, i) => ({
        label: mp.name,
        color: MASTER_COLORS[i % MASTER_COLORS.length],
      })),
      meetingLegend,
    ];
  }, [colorMode, masterProyeks, viewMode]);

  if (authLoading) return null;

  return (
    <SimpleLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          {/* Row 1: Title + Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <CalendarDays className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Timeline Project</h1>
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="project" className="gap-1.5">
                  <FolderKanban className="h-4 w-4" />
                  Proyek
                </TabsTrigger>
                <TabsTrigger value="task" className="gap-1.5">
                  <ListChecks className="h-4 w-4" />
                  Task
                </TabsTrigger>
                <TabsTrigger value="meeting" className="gap-1.5">
                  <Users className="h-4 w-4" />
                  Meeting
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {/* Row 2: Filters + Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className={cn(viewMode === 'meeting' && 'hidden')}>
              <Select value={viewRange} onValueChange={(v) => setViewRange(v as ViewRange)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="View..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Per Hari</SelectItem>
                  <SelectItem value="week">Per Minggu</SelectItem>
                  <SelectItem value="month">Per Bulan</SelectItem>
                  <SelectItem value="year">Per Tahun</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn('flex items-center gap-3', viewMode !== 'project' && 'hidden')}>
              <MultiSelectFilter
                options={projects.map(p => ({ value: p.id, label: p.title }))}
                selected={projectFilter}
                onChange={setProjectFilter}
                placeholder="Semua Proyek"
                className="w-[220px]"
              />
              <Select value={colorMode} onValueChange={(v) => setColorMode(v as ColorMode)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Color by..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status_pdca">By Status PDCA</SelectItem>
                  <SelectItem value="master_proyek">By Kategori Proyek</SelectItem>
                  <SelectItem value="urgency">By Urgensi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className={cn('flex items-center gap-3', viewMode !== 'task' && 'hidden')}>
              <MultiSelectFilter
                options={projects.map(p => ({ value: p.id, label: p.title }))}
                selected={taskProjectFilter}
                onChange={setTaskProjectFilter}
                placeholder="Semua Proyek"
                className="w-[220px]"
              />
              <MultiSelectFilter
                options={[
                  { value: 'not_started', label: 'Belum Mulai' },
                  { value: 'in_progress', label: 'Sedang Berjalan' },
                  { value: 'completed', label: 'Selesai' },
                  { value: 'delayed', label: 'Terlambat' },
                  { value: 'on_hold', label: 'Ditunda' },
                ]}
                selected={taskStatusFilter}
                onChange={setTaskStatusFilter}
                placeholder="Semua Status"
                className="w-[180px]"
              />
            </div>
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
              <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
              Sync Google Calendar
            </Button>
            <Button variant="outline" className="gap-2" asChild>
              <a href={calendarUrl || 'https://calendar.google.com'} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Go to Google Calendar
              </a>
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3">
          {legendItems.map(item => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Calendar */}
        {viewMode === 'project' ? (
          <TimelineCalendar
            projects={coloredProjects}
            onProjectClick={(id) => {
              if (id.startsWith('meeting-')) {
                const meetingId = id.replace('meeting-', '');
                const meeting = meetings.find(m => m.id === meetingId);
                if (meeting) {
                  const projectTitle = projects.find(p => p.id === meeting.project_id)?.title;
                  setSelectedMeeting({ ...meeting, projectTitle });
                }
              } else {
                setSelectedProjectId(id);
              }
            }}
            viewRange={viewRange}
            meetings={meetings}
            onDateClick={(date) => {
              setMeetingDefaultDate(format(date, 'yyyy-MM-dd'));
              setShowMeetingDialog(true);
            }}
          />
        ) : viewMode === 'task' ? (
          <TaskCalendarView
            tasks={calendarTasks}
            onTaskClick={(id) => {
              if (id.startsWith('meeting-')) {
                const meetingId = id.replace('meeting-', '');
                const meeting = meetings.find(m => m.id === meetingId);
                if (meeting) {
                  const projectTitle = projects.find(p => p.id === meeting.project_id)?.title;
                  setSelectedMeeting({ ...meeting, projectTitle });
                }
              } else {
                setSelectedProjectId(id);
              }
            }}
            viewRange={viewRange}
            meetings={meetings}
            onDateClick={(date) => {
              setMeetingDefaultDate(format(date, 'yyyy-MM-dd'));
              setShowMeetingDialog(true);
            }}
          />
        ) : (
          <MeetingHistoryView />
        )}

        {/* Meeting Dialog */}
        <AddMeetingDialog
          open={showMeetingDialog}
          onOpenChange={setShowMeetingDialog}
          defaultDate={meetingDefaultDate}
        />

        {/* Meeting Detail Dialog */}
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

        {/* Drawer */}
        <ProjectDrawer
          open={!!selectedProjectId}
          onOpenChange={(open) => { if (!open) setSelectedProjectId(null); }}
          project={selectedProject || null}
          isSuperAdmin={isSuperAdmin}
          masterProyekList={masterProyeks}
        />
      </div>
    </SimpleLayout>
  );
}
