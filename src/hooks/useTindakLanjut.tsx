import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type TindakLanjutRow = Database['public']['Tables']['followup_tindak_lanjut']['Row'];
type TindakLanjutInsert = Database['public']['Tables']['followup_tindak_lanjut']['Insert'];
type TindakLanjutUpdate = Database['public']['Tables']['followup_tindak_lanjut']['Update'];

export type FollowUpTindakLanjut = TindakLanjutRow;

export function useTindakLanjut(category: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tindakLanjutList = [], isLoading } = useQuery({
    queryKey: ['followup-tindak-lanjut', category],
    enabled: !!category,
    queryFn: async (): Promise<FollowUpTindakLanjut[]> => {
      const { data, error } = await supabase
        .from('followup_tindak_lanjut')
        .select('*')
        .eq('category', category)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data ?? [];
    },
  });

  const createTindakLanjut = useMutation({
    mutationFn: async (input: Omit<TindakLanjutInsert, 'created_by' | 'category'> & { category: string, created_by: string }) => {
      const { data, error } = await supabase
        .from('followup_tindak_lanjut')
        .insert(input)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-tindak-lanjut', category] });
      queryClient.invalidateQueries({ queryKey: ['followup-tindak-lanjut-stats'] });
      toast({ title: 'Tindak Lanjut berhasil ditambahkan' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal menambahkan Tindak Lanjut', description: err.message, variant: 'destructive' });
    },
  });

  const updateTindakLanjut = useMutation({
    mutationFn: async ({ id, ...input }: TindakLanjutUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('followup_tindak_lanjut')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-tindak-lanjut', category] });
      queryClient.invalidateQueries({ queryKey: ['followup-tindak-lanjut-stats'] });
      toast({ title: 'Tindak Lanjut berhasil diupdate' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal mengupdate Tindak Lanjut', description: err.message, variant: 'destructive' });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'open' ? 'closed' : 'open';
      const { data, error } = await supabase
        .from('followup_tindak_lanjut')
        .update({ 
          status: newStatus,
          closed_at: newStatus === 'closed' ? new Date().toISOString() : null 
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-tindak-lanjut', category] });
      queryClient.invalidateQueries({ queryKey: ['followup-tindak-lanjut-stats'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal mengubah status', description: err.message, variant: 'destructive' });
    },
  });

  const deleteTindakLanjut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('followup_tindak_lanjut')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-tindak-lanjut', category] });
      queryClient.invalidateQueries({ queryKey: ['followup-tindak-lanjut-stats'] });
      toast({ title: 'Tindak Lanjut berhasil dihapus' });
    },
    onError: (err: Error) => {
      toast({ title: 'Gagal menghapus Tindak Lanjut', description: err.message, variant: 'destructive' });
    },
  });

  return { 
    tindakLanjutList, 
    isLoading, 
    createTindakLanjut, 
    updateTindakLanjut, 
    toggleStatus, 
    deleteTindakLanjut 
  };
}

export function useTindakLanjutStats(category?: string) {
  const { data: stats = { total: 0, open: 0, closed: 0 }, isLoading } = useQuery({
    queryKey: ['followup-tindak-lanjut-stats', category],
    queryFn: async () => {
      let query = supabase.from('followup_tindak_lanjut').select('status');
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const rows = data ?? [];
      const total = rows.length;
      const open = rows.filter(r => r.status === 'open').length;
      const closed = rows.filter(r => r.status === 'closed').length;
      
      return { total, open, closed };
    }
  });

  return { stats, isLoading };
}
