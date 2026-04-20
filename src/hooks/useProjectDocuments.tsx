import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProjectDocument {
  id: string;
  project_id: string;
  uploaded_by: string;
  document_name: string;
  document_url: string;
  category: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const DOCUMENT_CATEGORIES: Record<string, string> = {
  urd: 'User Requirement Document',
  mou: 'MoU',
  technical: 'Dokumen Teknis',
  support: 'Dokumen Pendukung',
  other: 'Lainnya',
};

export function useProjectDocuments(projectId: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['project-documents', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_documents' as any)
        .select('*')
        .eq('project_id', projectId)
        .order('category')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ProjectDocument[];
    },
    enabled: !!projectId,
  });

  const addDocument = useMutation({
    mutationFn: async (doc: {
      project_id: string;
      uploaded_by: string;
      document_name: string;
      document_url: string;
      category: string;
      description?: string;
    }) => {
      const { error } = await supabase.from('project_documents' as any).insert(doc);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      toast({ title: 'Dokumen berhasil ditambahkan' });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menambahkan dokumen', description: err.message, variant: 'destructive' });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_documents' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-documents', projectId] });
      toast({ title: 'Dokumen berhasil dihapus' });
    },
    onError: (err: any) => {
      toast({ title: 'Gagal menghapus dokumen', description: err.message, variant: 'destructive' });
    },
  });

  return { documents, isLoading, addDocument, deleteDocument };
}
