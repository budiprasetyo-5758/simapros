import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type MeetingRow = Database['public']['Tables']['followup_meetings']['Row'];
type MeetingInsert = Database['public']['Tables']['followup_meetings']['Insert'];
type TaskRow = Database['public']['Tables']['followup_tasks']['Row'];
type TaskInsert = Database['public']['Tables']['followup_tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['followup_tasks']['Update'];
type FileRow = Database['public']['Tables']['followup_files']['Row'];
type FileInsert = Database['public']['Tables']['followup_files']['Insert'];

export type FollowUpMeeting = MeetingRow;
export type FollowUpTask = TaskRow;
export type FollowUpFile = FileRow;

export interface MeetingWithDetails extends FollowUpMeeting {
  tasks: FollowUpTask[];
  files: FollowUpFile[];
}

export interface TaskWithMeeting extends FollowUpTask {
  meetingTitle: string | null;
  meetingDate: string;
  meetingFiles: FollowUpFile[];
}

export interface FileWithMeta extends FollowUpFile {
  meetingTitle: string | null;
  meetingDate: string;
}

export interface CreateMeetingInput {
  category: string;
  meeting_date: string;
  title: string | null;
  created_by: string;
  tasks: { title: string; pic: string; due_date: string }[];
  notulensiFiles: File[];
  pendukungFiles: File[];
}

export function useFollowUpMeetings(category: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['followup-meetings', category],
    enabled: !!category,
    queryFn: async (): Promise<MeetingWithDetails[]> => {
      const { data: meetingsData, error } = await supabase
        .from('followup_meetings')
        .select('*')
        .eq('category', category)
        .order('meeting_date', { ascending: false });
      if (error) throw error;

      const rows = meetingsData ?? [];
      const meetingIds = rows.map((m) => m.id);
      if (meetingIds.length === 0) return [];

      const [tasksRes, filesRes] = await Promise.all([
        supabase
          .from('followup_tasks')
          .select('*')
          .in('meeting_id', meetingIds)
          .order('created_at', { ascending: true }),
        supabase
          .from('followup_files')
          .select('*')
          .in('meeting_id', meetingIds),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (filesRes.error) throw filesRes.error;

      const tasks: FollowUpTask[] = tasksRes.data ?? [];
      const files: FollowUpFile[] = filesRes.data ?? [];

      return rows.map((m): MeetingWithDetails => ({
        ...m,
        tasks: tasks.filter(t => t.meeting_id === m.id),
        files: files.filter(f => f.meeting_id === m.id),
      }));
    },
  });

  const createMeeting = useMutation({
    mutationFn: async (input: CreateMeetingInput) => {
      const meetingInsert: MeetingInsert = {
        category: input.category,
        meeting_date: input.meeting_date,
        title: input.title,
        created_by: input.created_by,
      };
      const { data: meeting, error: meetingError } = await supabase
        .from('followup_meetings')
        .insert(meetingInsert)
        .select()
        .single();
      if (meetingError) throw meetingError;
      const meetingId = meeting.id;

      for (const task of input.tasks) {
        const taskInsert: TaskInsert = {
          meeting_id: meetingId,
          title: task.title,
          pic: task.pic,
          due_date: task.due_date,
        };
        const { error: taskError } = await supabase
          .from('followup_tasks')
          .insert(taskInsert);
        if (taskError) throw taskError;
      }

      const uploadFiles = async (files: File[], fileCategory: 'notulensi' | 'pendukung') => {
        for (const file of files) {
          const path = `${input.created_by}/${meetingId}/${fileCategory}/${Date.now()}_${file.name}`;
          const { error: uploadErr } = await supabase.storage.from('followup-attachments').upload(path, file);
          if (uploadErr) throw uploadErr;
          const { data: urlData } = supabase.storage.from('followup-attachments').getPublicUrl(path);

          const fileInsert: FileInsert = {
            meeting_id: meetingId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_size: file.size,
            file_category: fileCategory,
            uploaded_by: input.created_by,
          };
          const { error: fileInsertErr } = await supabase.from('followup_files').insert(fileInsert);
          if (fileInsertErr) throw fileInsertErr;
        }
      };

      await uploadFiles(input.notulensiFiles, 'notulensi');
      await uploadFiles(input.pendukungFiles, 'pendukung');

      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-meetings', category] });
      queryClient.invalidateQueries({ queryKey: ['followup-files', category] });
      queryClient.invalidateQueries({ queryKey: ['followup-tasks', category] });
      toast({ title: 'Meeting berhasil ditambahkan' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal menambahkan meeting', description: err.message, variant: 'destructive' });
    },
  });

  const toggleTaskCompletion = useMutation({
    mutationFn: async ({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) => {
      const taskUpdate: TaskUpdate = {
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      };
      const { error } = await supabase
        .from('followup_tasks')
        .update(taskUpdate)
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-meetings', category] });
      queryClient.invalidateQueries({ queryKey: ['followup-tasks', category] });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal mengupdate task', description: err.message, variant: 'destructive' });
    },
  });

  return { meetings, isLoading, createMeeting, toggleTaskCompletion };
}

export function useFollowUpTasks(category: string) {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['followup-tasks', category],
    enabled: !!category,
    queryFn: async (): Promise<TaskWithMeeting[]> => {
      const { data: meetingsData, error: mErr } = await supabase
        .from('followup_meetings')
        .select('id, title, meeting_date')
        .eq('category', category);
      if (mErr) throw mErr;

      const rows = meetingsData ?? [];
      if (rows.length === 0) return [];
      const meetingIds = rows.map(m => m.id);

      const [tasksRes, filesRes] = await Promise.all([
        supabase
          .from('followup_tasks')
          .select('*')
          .in('meeting_id', meetingIds)
          .order('due_date', { ascending: true }),
        supabase
          .from('followup_files')
          .select('*')
          .in('meeting_id', meetingIds),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (filesRes.error) throw filesRes.error;

      const meetingMap: Record<string, { title: string | null; meeting_date: string }> = {};
      for (const m of rows) {
        meetingMap[m.id] = { title: m.title, meeting_date: m.meeting_date };
      }

      const files: FollowUpFile[] = filesRes.data ?? [];

      return (tasksRes.data ?? []).map((t): TaskWithMeeting => ({
        ...t,
        meetingTitle: meetingMap[t.meeting_id]?.title ?? null,
        meetingDate: meetingMap[t.meeting_id]?.meeting_date ?? '',
        meetingFiles: files.filter(f => f.meeting_id === t.meeting_id),
      }));
    },
  });

  return { tasks, isLoading };
}

export function useFollowUpFiles(category: string) {
  const { data: files = [], isLoading } = useQuery({
    queryKey: ['followup-files', category],
    enabled: !!category,
    queryFn: async (): Promise<FileWithMeta[]> => {
      const { data: meetingsData, error: mErr } = await supabase
        .from('followup_meetings')
        .select('id, title, meeting_date')
        .eq('category', category);
      if (mErr) throw mErr;

      const rows = meetingsData ?? [];
      if (rows.length === 0) return [];
      const meetingIds = rows.map(m => m.id);

      const { data: filesData, error: fErr } = await supabase
        .from('followup_files')
        .select('*')
        .in('meeting_id', meetingIds)
        .order('created_at', { ascending: false });
      if (fErr) throw fErr;

      const meetingMap: Record<string, { title: string | null; meeting_date: string }> = {};
      for (const m of rows) {
        meetingMap[m.id] = { title: m.title, meeting_date: m.meeting_date };
      }

      return (filesData ?? []).map((f): FileWithMeta => ({
        ...f,
        meetingTitle: meetingMap[f.meeting_id]?.title ?? null,
        meetingDate: meetingMap[f.meeting_id]?.meeting_date ?? '',
      }));
    },
  });

  return { files, isLoading };
}
