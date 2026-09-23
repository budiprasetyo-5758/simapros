import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useIsAssignedToProject(projectId: string | undefined) {
  const [isAssigned, setIsAssigned] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const checkAssignment = async () => {
      if (!projectId || !user) {
        setIsAssigned(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('project_assignments')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking assignment:', error);
          setIsAssigned(false);
        } else {
          setIsAssigned(!!data);
        }
      } catch (error) {
        console.error('Error checking assignment:', error);
        setIsAssigned(false);
      } finally {
        setLoading(false);
      }
    };

    checkAssignment();
  }, [projectId, user]);

  return { isAssigned, loading };
}
