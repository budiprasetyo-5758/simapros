import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Project, GanttTask, StageNotes, ProjectStatus, ProjectPriority, ProjectStage, ProjectProgressStatus } from '@/types/project';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { Json } from '@/integrations/supabase/types';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const fetchProjects = async () => {
    if (!user) return;
    
    try {
      const query = supabase
        .from('projects')
        .select('*, master_proyek:master_proyek_id(*)')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const mappedProjects: Project[] = (data || []).map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        unit: p.unit,
        requester_id: p.requester_id,
        requester_name: p.requester_name,
        status: p.status as ProjectStatus,
        priority: p.priority as ProjectPriority,
        admin_note: p.admin_note || undefined,
        project_stage: p.project_stage as ProjectStage,
        stage_notes: (p.stage_notes as unknown as StageNotes) || { planning: '', execution: '', evaluation: '', followup: '' },
        start_date: p.start_date || undefined,
        end_date: p.end_date || undefined,
        update_requested: p.update_requested || false,
        master_proyek_id: p.master_proyek_id || undefined,
        master_proyek: p.master_proyek || undefined,
        attachment_url: p.attachment_url || undefined,
        progress_status: (p.progress_status as ProjectProgressStatus) || 'in_progress',
        urgency: (p as any).urgency || undefined,
        impact: (p as any).impact || undefined,
         monev_summary: (p as unknown as { monev_summary?: string | null }).monev_summary || undefined,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));

      setProjects(mappedProjects);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching projects:', error);
      }
      toast({
        title: 'Error',
        description: 'Gagal memuat data proyek',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [user]);

  const addProject = async (projectData: {
    title: string;
    description: string;
    unit: string;
    priority: ProjectPriority;
    start_date: string;
    end_date: string;
    master_proyek_id?: string;
  }): Promise<{ success: boolean; projectId?: string }> => {
    if (!user) return { success: false };

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single();

      const { data, error } = await supabase.from('projects').insert({
        title: projectData.title,
        description: projectData.description,
        unit: projectData.unit,
        priority: projectData.priority,
        start_date: projectData.start_date,
        end_date: projectData.end_date,
        master_proyek_id: projectData.master_proyek_id || null,
        requester_id: user.id,
        requester_name: profile?.name || user.email || 'Unknown',
        status: 'pending',
        project_stage: 'planning',
        stage_notes: { planning: '', execution: '', evaluation: '', followup: '' },
      }).select('id').single();

      if (error) throw error;

      await fetchProjects();
      return { success: true, projectId: data?.id };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error adding project:', error);
      }
      return { success: false };
    }
  };

  const sendStatusNotification = async (
    recipientEmail: string,
    recipientName: string,
    projectTitle: string,
    status: ProjectStatus,
    adminNote?: string
  ) => {
    try {
      const { error } = await supabase.functions.invoke('send-project-notification', {
        body: {
          recipientEmail,
          recipientName,
          projectTitle,
          status,
          adminNote,
        },
      });

      if (error) {
        console.error('Error sending notification:', error);
      }
    } catch (error) {
      console.error('Error invoking notification function:', error);
    }
  };

  const updateProjectStatus = async (
    projectId: string, 
    status: ProjectStatus, 
    adminNote?: string
  ) => {
    try {
      // Fetch project details for notification
      const project = projects.find(p => p.id === projectId);
      
      const updateData: Record<string, unknown> = { status };
      if (adminNote !== undefined) {
        updateData.admin_note = adminNote;
      }
      if (status === 'approved') {
        updateData.update_requested = false;
      }

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectId);

      if (error) throw error;

      // Send email notification if project exists and status changed
      if (project && (status === 'approved' || status === 'revision' || status === 'rejected')) {
        // Get requester email from profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, name')
          .eq('id', project.requester_id)
          .single();

        if (profile?.email) {
          await sendStatusNotification(
            profile.email,
            profile.name || project.requester_name,
            project.title,
            status,
            adminNote
          );
        }
      }

      await fetchProjects();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating project status:', error);
      }
      return { success: false };
    }
  };

  const updateProject = async (projectId: string, updates: Partial<Project>) => {
    try {
      const dbUpdates: Record<string, unknown> = {};
      
      if (updates.title) dbUpdates.title = updates.title;
      if (updates.description) dbUpdates.description = updates.description;
      if (updates.unit) dbUpdates.unit = updates.unit;
      if (updates.priority) dbUpdates.priority = updates.priority;
      if (updates.start_date) dbUpdates.start_date = updates.start_date;
      if (updates.end_date) dbUpdates.end_date = updates.end_date;
      if (updates.project_stage) dbUpdates.project_stage = updates.project_stage;
      if (updates.stage_notes) dbUpdates.stage_notes = updates.stage_notes as unknown as Json;
      if (updates.admin_note !== undefined) dbUpdates.admin_note = updates.admin_note;
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.update_requested !== undefined) dbUpdates.update_requested = updates.update_requested;
      if (updates.progress_status) dbUpdates.progress_status = updates.progress_status;
      if (updates.urgency !== undefined) dbUpdates.urgency = updates.urgency;
      if (updates.impact !== undefined) dbUpdates.impact = updates.impact;
       if (updates.monev_summary !== undefined) dbUpdates.monev_summary = updates.monev_summary;

      const { error } = await supabase
        .from('projects')
        .update(dbUpdates)
        .eq('id', projectId);

      if (error) throw error;

      await fetchProjects();
      return { success: true };
    } catch (error: any) {
      console.error('Error updating project:', error);
      toast({
        title: 'Gagal Memperbarui Proyek',
        description: error?.message || 'Terjadi kesalahan saat memperbarui data proyek.',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  const resubmitProject = async (projectId: string, updates: {
    title: string;
    description: string;
    unit: string;
    priority?: ProjectPriority;
    start_date: string;
    end_date: string;
  }) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          ...updates,
          status: 'pending',
          admin_note: null,
        })
        .eq('id', projectId);

      if (error) throw error;

      await fetchProjects();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error resubmitting project:', error);
      }
      return { success: false };
    }
  };

  const requestUpdate = async (projectId: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ update_requested: true })
        .eq('id', projectId);

      if (error) throw error;

      await fetchProjects();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error requesting update:', error);
      }
      return { success: false };
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      // First delete related gantt_tasks
      const { error: tasksError } = await supabase
        .from('gantt_tasks')
        .delete()
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;

      // Delete related task edit requests
      const { error: taskRequestsError } = await supabase
        .from('gantt_task_edit_requests')
        .delete()
        .eq('project_id', projectId);

      if (taskRequestsError) throw taskRequestsError;

      // Delete related project edit requests
      const { error: editRequestsError } = await supabase
        .from('project_edit_requests')
        .delete()
        .eq('project_id', projectId);

      if (editRequestsError) throw editRequestsError;

      // Finally delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Proyek berhasil dihapus',
      });

      await fetchProjects();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting project:', error);
      }
      toast({
        title: 'Error',
        description: 'Gagal menghapus proyek',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  return {
    projects,
    loading,
    addProject,
    updateProjectStatus,
    updateProject,
    resubmitProject,
    requestUpdate,
    deleteProject,
    refetch: fetchProjects,
  };
}


export function useGanttTasks(projectId: string) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('gantt_tasks')
        .select('*')
        .eq('project_id', projectId)
        .order('wbs_number', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const mappedTasks: GanttTask[] = (data || []).map(task => ({
        id: task.id,
        project_id: task.project_id,
        name: task.name,
        description: task.description || '',
        pic: task.pic || '',
        start_date: task.start_date,
        end_date: task.end_date,
        progress: task.progress || 0,
        status: (task.status as 'not_started' | 'in_progress' | 'completed' | 'pending') || 'not_started',
        wbs_number: task.wbs_number || '',
        monev: task.monev || '',
        phase: task.phase || '',
        parent_task_id: (task as unknown as { parent_task_id?: string | null }).parent_task_id || null,
        created_at: (task as unknown as { created_at?: string }).created_at,
      }));
      setTasks(mappedTasks);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching tasks:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchTasks();
    }
  }, [projectId]);

  const addTask = async (task: Omit<GanttTask, 'id'>) => {
    try {
      const { error } = await supabase.from('gantt_tasks').insert(task);
      if (error) throw error;
      await fetchTasks();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error adding task:', error);
      }
      return { success: false };
    }
  };

  const updateTask = async (taskId: string, updates: Partial<GanttTask>) => {
    try {
      const { error } = await supabase
        .from('gantt_tasks')
        .update(updates)
        .eq('id', taskId);
      if (error) throw error;
      await fetchTasks();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating task:', error);
      }
      return { success: false };
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('gantt_tasks')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
      await fetchTasks();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting task:', error);
      }
      return { success: false };
    }
  };

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks,
  };
}
