import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface ProjectAssignment {
  id: string;
  project_id: string;
  user_id: string;
  assigned_by: string;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string | null;
  };
}

export function useProjectAssignments(projectId: string) {
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAssignments = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('project_assignments')
      .select('*')
      .eq('project_id', projectId);

    if (!error) {
      setAssignments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignments();
  }, [projectId]);

  const assignUser = async (userId: string, assignedBy: string) => {
    const { error } = await supabase
      .from('project_assignments')
      .insert({
        project_id: projectId,
        user_id: userId,
        assigned_by: assignedBy,
      });

    if (error) {
      toast({
        title: 'Error',
        description: error.message.includes('duplicate')
          ? 'User sudah di-assign ke proyek ini'
          : 'Gagal assign user ke proyek',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'User berhasil di-assign ke proyek',
    });
    await fetchAssignments();
    return { success: true };
  };

  const removeAssignment = async (assignmentId: string) => {
    const { error } = await supabase
      .from('project_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Gagal menghapus assignment',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'Assignment berhasil dihapus',
    });
    await fetchAssignments();
    return { success: true };
  };

  return {
    assignments,
    loading,
    assignUser,
    removeAssignment,
    refetch: fetchAssignments,
  };
}
