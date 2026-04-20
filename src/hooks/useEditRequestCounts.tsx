import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ProjectEditCounts {
  [projectId: string]: {
    projectEditRequests: number;
    taskEditRequests: number;
    total: number;
  };
}

export function useEditRequestCounts() {
  const [counts, setCounts] = useState<ProjectEditCounts>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchCounts = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch pending project edit requests
      const { data: projectRequests, error: projectError } = await supabase
        .from('project_edit_requests')
        .select('project_id')
        .eq('status', 'pending');

      if (projectError) throw projectError;

      // Fetch pending task edit requests
      const { data: taskRequests, error: taskError } = await supabase
        .from('gantt_task_edit_requests')
        .select('project_id')
        .eq('status', 'pending');

      if (taskError) throw taskError;

      // Count by project_id
      const countMap: ProjectEditCounts = {};

      (projectRequests || []).forEach((req) => {
        if (!countMap[req.project_id]) {
          countMap[req.project_id] = { projectEditRequests: 0, taskEditRequests: 0, total: 0 };
        }
        countMap[req.project_id].projectEditRequests += 1;
        countMap[req.project_id].total += 1;
      });

      (taskRequests || []).forEach((req) => {
        if (!countMap[req.project_id]) {
          countMap[req.project_id] = { projectEditRequests: 0, taskEditRequests: 0, total: 0 };
        }
        countMap[req.project_id].taskEditRequests += 1;
        countMap[req.project_id].total += 1;
      });

      setCounts(countMap);
    } catch (error) {
      console.error('Error fetching edit request counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, [user]);

  const getCount = (projectId: string) => {
    return counts[projectId] || { projectEditRequests: 0, taskEditRequests: 0, total: 0 };
  };

  const getTotalPending = () => {
    return Object.values(counts).reduce((sum, c) => sum + c.total, 0);
  };

  return {
    counts,
    loading,
    getCount,
    getTotalPending,
    refetch: fetchCounts,
  };
}
