import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MasterProyek {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useMasterProyek() {
  const [masterProyek, setMasterProyek] = useState<MasterProyek[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMasterProyek = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('master_proyek')
      .select('*')
      .order('name');

    if (!error && data) {
      setMasterProyek(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMasterProyek();
  }, []);

  return { masterProyek, loading, refetch: fetchMasterProyek };
}
