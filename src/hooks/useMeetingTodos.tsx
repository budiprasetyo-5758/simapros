import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MeetingTodo {
  id: string;
  created_by: string;
  title: string;
  description: string;
  is_completed: boolean;
  completed_at: string | null;
  project_id: string | null;
  converted_meeting_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useMeetingTodos() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['meeting-todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meeting_todos' as any)
        .select('*')
        .order('is_completed', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as MeetingTodo[];
    },
  });

  const createTodo = useMutation({
    mutationFn: async (todo: { title: string; description?: string; project_id?: string | null; created_by: string }) => {
      const { error } = await supabase.from('meeting_todos' as any).insert(todo);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-todos'] });
      toast({ title: 'To-Do berhasil ditambahkan' });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menambahkan To-Do', description: err.message, variant: 'destructive' });
    },
  });

  const toggleTodo = useMutation({
    mutationFn: async ({ id, is_completed }: { id: string; is_completed: boolean }) => {
      const { error } = await supabase
        .from('meeting_todos' as any)
        .update({
          is_completed,
          completed_at: is_completed ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-todos'] });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal mengubah status', description: err.message, variant: 'destructive' });
    },
  });

  const deleteTodo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meeting_todos' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-todos'] });
      toast({ title: 'To-Do berhasil dihapus' });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menghapus To-Do', description: err.message, variant: 'destructive' });
    },
  });

  const markConverted = useMutation({
    mutationFn: async ({ todoId, meetingId }: { todoId: string; meetingId: string }) => {
      const { error } = await supabase
        .from('meeting_todos' as any)
        .update({ converted_meeting_id: meetingId, is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', todoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-todos'] });
      toast({ title: 'To-Do berhasil dikonversi ke meeting' });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal mengonversi', description: err.message, variant: 'destructive' });
    },
  });

  const updateTodo = useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description?: string }) => {
      const { error } = await supabase
        .from('meeting_todos' as any)
        .update({ title, description: description || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-todos'] });
      toast({ title: 'To-Do berhasil diperbarui' });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal memperbarui To-Do', description: err.message, variant: 'destructive' });
    },
  });

  return { todos, isLoading, createTodo, toggleTodo, deleteTodo, markConverted, updateTodo };
}
