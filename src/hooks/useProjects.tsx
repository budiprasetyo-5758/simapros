import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Project,
  GanttTask,
  StageNotes,
  ProjectStatus,
  ProjectPriority,
  ProjectStage,
  ProjectProgressStatus,
  ProjectObstacle,
  ProjectPriorityAssessment,
  RequesterDecision,
} from '@/types/project';
import type { Urgency, Impact, EffortScore, Quadrant } from '@/lib/priorityMatrix';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { Json } from '@/integrations/supabase/types';
import type { SopAssessmentDecisionPayload } from '@/types/sopPriority2026';
import { SOP_METHOD_VERSION } from '@/lib/sopPriority2026';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProjects = useCallback(async () => {
    if (!user) return;
    
    try {
      const query = supabase
        .from('projects')
        .select('*, master_proyek:master_proyek_id(*), project_obstacles(id, note, is_resolved), current_priority_assessment:project_priority_assessments!projects_current_priority_assessment_fkey(*)')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      const mappedProjects: Project[] = (data || []).map((p) => {
        // Kolom-kolom di bawah belum ada di src/integrations/supabase/types.ts
        // (file generated itu tertinggal dari skema DB), jadi perlu dilebarkan
        // manual. Diberi TIPE, bukan `any`: salah tulis nama kolom di sini
        // gagal secara senyap tanpa error TypeScript, dan itu justru bug yang
        // paling mahal di mapping ini.
        //
        // Hapus blok ini setelah types.ts diregenerasi lewat
        //   supabase gen types typescript --project-id <id>
        const row = p as typeof p & {
          urgency?: Urgency | null;
          impact?: Impact | null;
          urgency_claimed?: Urgency | null;
          effort?: EffortScore | null;
          priority_quadrant?: Quadrant | null;
          is_priority?: boolean | null;
          priority_note?: string | null;
          priority_rationale?: string | null;
          priority_set_by?: string | null;
          priority_set_at?: string | null;
          proposed_start_date?: string | null;
          proposed_end_date?: string | null;
          requester_decision?: RequesterDecision | null;
          requester_decision_at?: string | null;
          monev_summary?: string | null;
          pic?: string | null;
          project_obstacles?: ProjectObstacle[] | null;
          current_priority_assessment_id?: string | null;
          current_priority_assessment?: ProjectPriorityAssessment | ProjectPriorityAssessment[] | null;
        };

        return {
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
          urgency: row.urgency || undefined,
          impact: row.impact || undefined,
          urgency_claimed: row.urgency_claimed || null,
          effort: row.effort ?? null,
          priority_quadrant: row.priority_quadrant || null,
          is_priority: row.is_priority ?? null,
          priority_note: row.priority_note || null,
          priority_rationale: row.priority_rationale || null,
          priority_set_by: row.priority_set_by || null,
          priority_set_at: row.priority_set_at || null,
          current_priority_assessment_id: row.current_priority_assessment_id || null,
          current_priority_assessment: Array.isArray(row.current_priority_assessment)
            ? row.current_priority_assessment[0] || null
            : row.current_priority_assessment || null,
          proposed_start_date: row.proposed_start_date || null,
          proposed_end_date: row.proposed_end_date || null,
          requester_decision: row.requester_decision || null,
          requester_decision_at: row.requester_decision_at || null,
          monev_summary: row.monev_summary || undefined,
          pic: row.pic || null,
          project_obstacles: row.project_obstacles || [],
          created_at: p.created_at,
          updated_at: p.updated_at,
        };
      });

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
  }, [toast, user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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
      const existingProject = projects.find((project) => project.id === projectId);
      if (existingProject?.current_priority_assessment_id) {
        const snapshotLinkedFields: Array<keyof Project> = [
          'priority', 'urgency', 'impact', 'effort', 'priority_quadrant', 'is_priority',
          'priority_note', 'priority_rationale', 'priority_set_by', 'priority_set_at',
          'proposed_start_date', 'proposed_end_date', 'current_priority_assessment_id',
        ];
        if (snapshotLinkedFields.some((field) => Object.prototype.hasOwnProperty.call(updates, field))) {
          toast({
            title: 'Penilaian Prioritas Terkunci',
            description: 'Buat reassessment Tier 2 untuk mengubah keputusan prioritas proyek ini.',
            variant: 'destructive',
          });
          return { success: false };
        }
      }

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
      if (updates.urgency_claimed !== undefined) dbUpdates.urgency_claimed = updates.urgency_claimed;
      if (updates.effort !== undefined) dbUpdates.effort = updates.effort;
      if (updates.priority_quadrant !== undefined) dbUpdates.priority_quadrant = updates.priority_quadrant;
      if (updates.is_priority !== undefined) dbUpdates.is_priority = updates.is_priority;
      if (updates.priority_note !== undefined) dbUpdates.priority_note = updates.priority_note;
      if (updates.priority_rationale !== undefined) dbUpdates.priority_rationale = updates.priority_rationale;
      if (updates.priority_set_by !== undefined) dbUpdates.priority_set_by = updates.priority_set_by;
      if (updates.priority_set_at !== undefined) dbUpdates.priority_set_at = updates.priority_set_at;
      if (updates.proposed_start_date !== undefined) dbUpdates.proposed_start_date = updates.proposed_start_date;
      if (updates.proposed_end_date !== undefined) dbUpdates.proposed_end_date = updates.proposed_end_date;
       if (updates.monev_summary !== undefined) dbUpdates.monev_summary = updates.monev_summary;
      if (updates.pic !== undefined) dbUpdates.pic = updates.pic;

      const { error } = await supabase
        .from('projects')
        .update(dbUpdates)
        .eq('id', projectId);

      if (error) throw error;

      await fetchProjects();
      return { success: true };
    } catch (error: unknown) {
      console.error('Error updating project:', error);
      toast({
        title: 'Gagal Memperbarui Proyek',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan saat memperbarui data proyek.',
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
      const existingProject = projects.find((project) => project.id === projectId);
      if (existingProject?.current_priority_assessment_id) {
        toast({
          title: 'Pengajuan Sudah Diputuskan',
          description: 'Proyek dengan snapshot Tier 2 tidak dapat dikirim ulang melalui alur revisi proposal.',
          variant: 'destructive',
        });
        return { success: false };
      }

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

  // Keputusan pengaju atas proyek yang ditunda ('deprioritized'):
  // 'accepted' -> menjadi approved dengan jadwal yang diusulkan HTO,
  // 'withdrawn' -> pengajuan ditarik. Dijalankan lewat RPC SECURITY DEFINER
  // supaya pengaju tidak bisa menulis status sendiri (RLS tidak membatasi
  // per kolom, sehingga policy UPDATE luas akan membuka celah).
  const respondToPriority = async (
    projectId: string,
    decision: 'accepted' | 'withdrawn'
  ) => {
    try {
      const { error } = await supabase.rpc('respond_to_priority', {
        _project_id: projectId,
        _decision: decision,
      });

      if (error) throw error;

      await fetchProjects();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error responding to priority:', error);
      }
      return { success: false };
    }
  };

  const recordPriorityAssessment = async (
    projectId: string,
    payload: SopAssessmentDecisionPayload,
  ) => {
    try {
      const { assessment, editedData, technicalNotes } = payload;
      const { error } = await supabase.rpc('record_sop2026_priority_assessment', {
        _project_id: projectId,
        _mandatory_answers: assessment.mandatory_answers as unknown as Json,
        _scores: assessment.scores as unknown as Json,
        _justifications: assessment.justifications as unknown as Json,
        _evidence: assessment.evidence as unknown as Json,
        _gates: assessment.gates as unknown as Json,
        _effort: assessment.effort,
        _probing_session: assessment.probing_session as unknown as Json,
        _eligibility_notes: assessment.eligibility_notes || null,
        _priority_note: assessment.priority_note || null,
        _proposed_start_date: assessment.proposed_start_date,
        _proposed_end_date: assessment.proposed_end_date,
        _final_decision: assessment.final_decision,
        _final_decision_note: assessment.final_decision_note,
        _override_reason: assessment.override_reason,
        _edited_project: editedData as unknown as Json,
        _technical_notes: technicalNotes || null,
        _intake_snapshot: {},
        _governance_snapshot: {},
        _method_version: SOP_METHOD_VERSION,
      });

      if (error) throw error;

      await fetchProjects();
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Terjadi kesalahan saat menyimpan penilaian.';
      if (import.meta.env.DEV) {
        console.error('Error recording priority assessment:', error);
      }
      toast({
        title: 'Gagal Menyimpan Penilaian',
        description: message,
        variant: 'destructive',
      });
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
    respondToPriority,
    recordPriorityAssessment,
    requestUpdate,
    deleteProject,
    refetch: fetchProjects,
  };
}


export function useGanttTasks(projectId: string) {
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
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
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchTasks();
    }
  }, [fetchTasks, projectId]);

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
