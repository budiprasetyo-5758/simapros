import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { GanttTask, TaskStatus } from '@/types/project';

export interface TaskEditRequest {
  id: string;
  task_id: string | null;
  project_id: string;
  requester_id: string;
  status: 'pending' | 'approved' | 'rejected';
  proposed_name: string | null;
  proposed_description: string | null;
  proposed_pic: string | null;
  proposed_phase: string | null;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  proposed_progress: number | null;
  proposed_status: string | null;
  proposed_monev: string | null;
  proposed_wbs_number: string | null;
  is_new_task: boolean;
  is_delete_request: boolean;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  task_name?: string;
  project_title?: string;
  requester_name?: string;
}

interface TaskEditRequestChanges {
  proposed_name?: string;
  proposed_description?: string;
  proposed_pic?: string;
  proposed_phase?: string;
  proposed_start_date?: string;
  proposed_end_date?: string;
  proposed_progress?: number;
  proposed_status?: string;
  proposed_monev?: string;
  proposed_wbs_number?: string;
}

export function useTaskEditRequests(projectId?: string) {
  const [taskEditRequests, setTaskEditRequests] = useState<TaskEditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const fetchTaskEditRequests = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('gantt_task_edit_requests')
        .select(`
          *,
          gantt_tasks:task_id(name),
          projects:project_id(title, requester_name)
        `)
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped: TaskEditRequest[] = (data || []).map((r: any) => ({
        id: r.id,
        task_id: r.task_id,
        project_id: r.project_id,
        requester_id: r.requester_id,
        status: r.status,
        proposed_name: r.proposed_name,
        proposed_description: r.proposed_description,
        proposed_pic: r.proposed_pic,
        proposed_phase: r.proposed_phase,
        proposed_start_date: r.proposed_start_date,
        proposed_end_date: r.proposed_end_date,
        proposed_progress: r.proposed_progress,
        proposed_status: r.proposed_status,
        proposed_monev: r.proposed_monev,
        proposed_wbs_number: r.proposed_wbs_number,
        is_new_task: r.is_new_task,
        is_delete_request: r.is_delete_request,
        admin_note: r.admin_note,
        reviewed_by: r.reviewed_by,
        reviewed_at: r.reviewed_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        task_name: r.gantt_tasks?.name || (r.is_new_task ? r.proposed_name : 'Unknown'),
        project_title: r.projects?.title,
        requester_name: r.projects?.requester_name,
      }));

      setTaskEditRequests(mapped);
    } catch (error) {
      console.error('Error fetching task edit requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaskEditRequests();
  }, [user, projectId]);

  // Create edit request for existing task
  const createTaskEditRequest = async (
    taskId: string,
    projectId: string,
    changes: TaskEditRequestChanges
  ) => {
    if (!user) return { success: false };

    try {
      const { error } = await supabase.from('gantt_task_edit_requests').insert({
        task_id: taskId,
        project_id: projectId,
        requester_id: user.id,
        ...changes,
      });

      if (error) throw error;

      toast({
        title: 'Permintaan Terkirim',
        description: 'Permintaan perubahan task telah dikirim dan menunggu approval admin.',
      });

      await fetchTaskEditRequests();
      return { success: true };
    } catch (error) {
      console.error('Error creating task edit request:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengirim permintaan perubahan task',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  // Create request to add new task
  const createNewTaskRequest = async (
    projectId: string,
    taskData: Omit<GanttTask, 'id' | 'project_id'>
  ) => {
    if (!user) return { success: false };

    try {
      const { error } = await supabase.from('gantt_task_edit_requests').insert({
        project_id: projectId,
        requester_id: user.id,
        is_new_task: true,
        proposed_name: taskData.name,
        proposed_description: taskData.description,
        proposed_pic: taskData.pic,
        proposed_phase: taskData.phase,
        proposed_start_date: taskData.start_date,
        proposed_end_date: taskData.end_date,
        proposed_progress: taskData.progress,
        proposed_status: taskData.status,
        proposed_monev: taskData.monev,
        proposed_wbs_number: taskData.wbs_number,
      });

      if (error) throw error;

      toast({
        title: 'Permintaan Terkirim',
        description: 'Permintaan penambahan task baru telah dikirim dan menunggu approval admin.',
      });

      await fetchTaskEditRequests();
      return { success: true };
    } catch (error) {
      console.error('Error creating new task request:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengirim permintaan penambahan task',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  // Create request to delete task
  const createDeleteTaskRequest = async (taskId: string, projectId: string) => {
    if (!user) return { success: false };

    try {
      const { error } = await supabase.from('gantt_task_edit_requests').insert({
        task_id: taskId,
        project_id: projectId,
        requester_id: user.id,
        is_delete_request: true,
      });

      if (error) throw error;

      toast({
        title: 'Permintaan Terkirim',
        description: 'Permintaan penghapusan task telah dikirim dan menunggu approval admin.',
      });

      await fetchTaskEditRequests();
      return { success: true };
    } catch (error) {
      console.error('Error creating delete task request:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengirim permintaan penghapusan task',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  // Admin: Review task edit request
  const reviewTaskEditRequest = async (
    requestId: string,
    status: 'approved' | 'rejected',
    adminNote?: string,
    applyChanges?: boolean
  ) => {
    if (!user || !isSuperAdmin) return { success: false };

    try {
      // Get the request first
      const { data: request, error: fetchError } = await supabase
        .from('gantt_task_edit_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (fetchError) throw fetchError;

      // Update request status
      const { error: updateError } = await supabase
        .from('gantt_task_edit_requests')
        .update({
          status,
          admin_note: adminNote || null,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (updateError) throw updateError;

      // If approved and applyChanges, apply the changes
      if (status === 'approved' && applyChanges && request) {
        if (request.is_delete_request && request.task_id) {
          // Delete the task
          const { error: deleteError } = await supabase
            .from('gantt_tasks')
            .delete()
            .eq('id', request.task_id);

          if (deleteError) throw deleteError;
        } else if (request.is_new_task) {
          // Create new task
          const { error: insertError } = await supabase
            .from('gantt_tasks')
            .insert({
              project_id: request.project_id,
              name: request.proposed_name || 'Untitled Task',
              description: request.proposed_description || '',
              pic: request.proposed_pic || '',
              phase: request.proposed_phase || '',
              start_date: request.proposed_start_date,
              end_date: request.proposed_end_date,
              progress: request.proposed_progress || 0,
              status: request.proposed_status || 'not_started',
              monev: request.proposed_monev || '',
              wbs_number: request.proposed_wbs_number || '',
            });

          if (insertError) throw insertError;
        } else if (request.task_id) {
          // Update existing task
          const taskUpdates: Record<string, unknown> = {};
          
          if (request.proposed_name !== null) taskUpdates.name = request.proposed_name;
          if (request.proposed_description !== null) taskUpdates.description = request.proposed_description;
          if (request.proposed_pic !== null) taskUpdates.pic = request.proposed_pic;
          if (request.proposed_phase !== null) taskUpdates.phase = request.proposed_phase;
          if (request.proposed_start_date !== null) taskUpdates.start_date = request.proposed_start_date;
          if (request.proposed_end_date !== null) taskUpdates.end_date = request.proposed_end_date;
          if (request.proposed_progress !== null) taskUpdates.progress = request.proposed_progress;
          if (request.proposed_status !== null) taskUpdates.status = request.proposed_status;
          if (request.proposed_monev !== null) taskUpdates.monev = request.proposed_monev;
          if (request.proposed_wbs_number !== null) taskUpdates.wbs_number = request.proposed_wbs_number;

          if (Object.keys(taskUpdates).length > 0) {
            const { error: taskError } = await supabase
              .from('gantt_tasks')
              .update(taskUpdates)
              .eq('id', request.task_id);

            if (taskError) throw taskError;
          }
        }
      }

      toast({
        title: status === 'approved' ? 'Disetujui' : 'Ditolak',
        description: status === 'approved'
          ? 'Permintaan perubahan task telah disetujui dan diterapkan.'
          : 'Permintaan perubahan task telah ditolak.',
      });

      await fetchTaskEditRequests();
      return { success: true };
    } catch (error) {
      console.error('Error reviewing task edit request:', error);
      toast({
        title: 'Error',
        description: 'Gagal memproses permintaan',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  // Check if there's a pending request for a task
  const hasPendingTaskRequest = (taskId: string) => {
    return taskEditRequests.some(r => r.task_id === taskId && r.status === 'pending');
  };

  // Get pending requests count
  const pendingCount = taskEditRequests.filter(r => r.status === 'pending').length;

  return {
    taskEditRequests,
    loading,
    createTaskEditRequest,
    createNewTaskRequest,
    createDeleteTaskRequest,
    reviewTaskEditRequest,
    hasPendingTaskRequest,
    pendingCount,
    refetch: fetchTaskEditRequests,
  };
}
