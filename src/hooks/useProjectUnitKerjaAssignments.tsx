import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface ProjectUnitKerjaAssignment {
  id: string;
  project_id: string;
  unit_kerja_id: string;
  assigned_by: string;
  created_at: string;
  unit_kerja?: {
    id: string;
    name: string;
  };
}

export function useProjectUnitKerjaAssignments(projectId: string) {
  const [assignments, setAssignments] = useState<ProjectUnitKerjaAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchAssignments = async () => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('project_unit_kerja_assignments')
      .select('*, unit_kerja:unit_kerja_id(id, name)')
      .eq('project_id', projectId);

    if (!error) {
      setAssignments(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssignments();
  }, [projectId]);

  const assignUnitKerja = async (unitKerjaId: string, assignedBy: string) => {
    const { error } = await supabase
      .from('project_unit_kerja_assignments')
      .insert({
        project_id: projectId,
        unit_kerja_id: unitKerjaId,
        assigned_by: assignedBy,
      });

    if (error) {
      toast({
        title: 'Error',
        description: error.message.includes('duplicate')
          ? 'Unit kerja sudah di-assign ke proyek ini'
          : 'Gagal assign unit kerja ke proyek',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'Unit kerja berhasil di-assign ke proyek',
    });
    await fetchAssignments();
    return { success: true };
  };

  const removeAssignment = async (assignmentId: string) => {
    const { error } = await supabase
      .from('project_unit_kerja_assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Gagal menghapus assignment unit kerja',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'Assignment unit kerja berhasil dihapus',
    });
    await fetchAssignments();
    return { success: true };
  };

  return {
    assignments,
    loading,
    assignUnitKerja,
    removeAssignment,
    refetch: fetchAssignments,
  };
}
