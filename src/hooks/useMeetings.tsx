import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Meeting {
  id: string;
  project_id: string | null;
  created_by: string;
  title: string;
  meeting_date: string;
  meeting_time: string;
  description: string;
  attachment_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useMeetings(filters?: { projectId?: string; startDate?: string; endDate?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings', filters],
    queryFn: async () => {
      let query = supabase.from('meetings' as any).select('*').order('meeting_date', { ascending: false });
      if (filters?.projectId) query = query.eq('project_id', filters.projectId);
      if (filters?.startDate) query = query.gte('meeting_date', filters.startDate);
      if (filters?.endDate) query = query.lte('meeting_date', filters.endDate);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Meeting[];
    },
  });

  const createMeeting = useMutation({
    mutationFn: async (meeting: {
      title: string;
      meeting_date: string;
      meeting_time: string;
      description: string;
      project_id?: string | null;
      attachment_url?: string | null;
      created_by: string;
    }) => {
      const { data, error } = await supabase.from('meetings' as any).insert(meeting).select().single();
      if (error) throw error;
      return data as unknown as Meeting;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast({ title: 'Meeting berhasil ditambahkan' });

      // Send notification to super admins
      try {
        const meeting = data as Meeting;
        await supabase.functions.invoke('send-notification', {
          body: {
            type: 'new_meeting',
            projectId: meeting.project_id,
            projectTitle: '',
            meetingTitle: meeting.title,
            meetingDate: meeting.meeting_date,
            meetingTime: meeting.meeting_time,
            notifySuperAdmins: true,
            sendEmail: true,
          },
        });
      } catch (e) {
        console.error('Failed to send meeting notification:', e);
      }
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menambahkan meeting', description: err.message, variant: 'destructive' });
    },
  });

  const updateMeeting = useMutation({
    mutationFn: async (meeting: {
      id: string;
      title: string;
      meeting_date: string;
      meeting_time: string;
      description: string;
      project_id?: string | null;
      attachment_url?: string | null;
    }) => {
      const { id, ...updates } = meeting;
      const { error } = await supabase.from('meetings' as any).update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast({ title: 'Meeting berhasil diperbarui' });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal memperbarui meeting', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMeeting = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meetings' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast({ title: 'Meeting berhasil dihapus' });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menghapus meeting', description: err.message, variant: 'destructive' });
    },
  });

  return { meetings, isLoading, createMeeting, updateMeeting, deleteMeeting };
}
