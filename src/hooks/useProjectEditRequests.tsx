import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface ProjectEditRequest {
  id: string;
  project_id: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'rejected';
  proposed_title: string | null;
  proposed_description: string | null;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  project_title?: string;
  requester_name?: string;
}

export function useProjectEditRequests(projectId?: string) {
  const [editRequests, setEditRequests] = useState<ProjectEditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const fetchEditRequests = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('project_edit_requests')
        .select(`
          *,
          projects:project_id(title, requester_name)
        `)
        .order('created_at', { ascending: false });

      // If projectId is provided, filter by it
      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped: ProjectEditRequest[] = (data || []).map((r: any) => ({
        id: r.id,
        project_id: r.project_id,
        requester_id: r.requester_id,
        status: r.status,
        proposed_title: r.proposed_title,
        proposed_description: r.proposed_description,
        proposed_start_date: r.proposed_start_date,
        proposed_end_date: r.proposed_end_date,
        admin_note: r.admin_note,
        reviewed_by: r.reviewed_by,
        reviewed_at: r.reviewed_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        project_title: r.projects?.title,
        requester_name: r.projects?.requester_name,
      }));

      setEditRequests(mapped);
    } catch (error) {
      console.error('Error fetching edit requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEditRequests();
  }, [user, projectId]);

  const createEditRequest = async (
    projectId: string,
    changes: {
      proposed_title?: string;
      proposed_description?: string;
      proposed_start_date?: string;
      proposed_end_date?: string;
    }
  ) => {
    if (!user) return { success: false };

    try {
      const { error } = await supabase.from('project_edit_requests').insert({
        project_id: projectId,
        requester_id: user.id,
        proposed_title: changes.proposed_title || null,
        proposed_description: changes.proposed_description || null,
        proposed_start_date: changes.proposed_start_date || null,
        proposed_end_date: changes.proposed_end_date || null,
      });

      if (error) throw error;

      toast({
        title: 'Permintaan Terkirim',
        description: 'Permintaan perubahan Anda telah dikirim dan menunggu approval admin.',
      });

      await fetchEditRequests();
      return { success: true };
    } catch (error) {
      console.error('Error creating edit request:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengirim permintaan perubahan',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  const reviewEditRequest = async (
    requestId: string,
    status: 'approved' | 'rejected',
    adminNote?: string,
    applyChanges?: boolean
  ) => {
    if (!user || !isAdmin) return { success: false };

    try {
      // First get the edit request
      const { data: request, error: fetchError } = await supabase
        .from('project_edit_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Update the request status
      const { error: updateError } = await supabase
        .from('project_edit_requests')
        .update({
          status,
          admin_note: adminNote || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // If approved and applyChanges is true, apply the changes to the project
      if (status === 'approved' && applyChanges && request) {
        const projectUpdates: Record<string, unknown> = {};
        
        if (request.proposed_title) {
          projectUpdates.title = request.proposed_title;
        }
        if (request.proposed_description) {
          projectUpdates.description = request.proposed_description;
        }
        if (request.proposed_start_date) {
          projectUpdates.start_date = request.proposed_start_date;
        }
        if (request.proposed_end_date) {
          projectUpdates.end_date = request.proposed_end_date;
        }

        if (Object.keys(projectUpdates).length > 0) {
          const { error: projectError } = await supabase
            .from('projects')
            .update(projectUpdates)
            .eq('id', request.project_id);

          if (projectError) throw projectError;
        }
      }

      toast({
        title: status === 'approved' ? 'Disetujui' : 'Ditolak',
        description: status === 'approved' 
          ? 'Permintaan perubahan telah disetujui dan diterapkan.'
          : 'Permintaan perubahan telah ditolak.',
      });

      await fetchEditRequests();
      return { success: true };
    } catch (error) {
      console.error('Error reviewing edit request:', error);
      toast({
        title: 'Error',
        description: 'Gagal memproses permintaan',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  // Check if there's a pending request for a project
  const hasPendingRequest = (projectId: string) => {
    return editRequests.some(r => r.project_id === projectId && r.status === 'pending');
  };

  // Get pending requests count (for admin badge)
  const pendingCount = editRequests.filter(r => r.status === 'pending').length;

  return {
    editRequests,
    loading,
    createEditRequest,
    reviewEditRequest,
    hasPendingRequest,
    pendingCount,
    refetch: fetchEditRequests,
  };
}
