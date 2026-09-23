import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

interface ProfileData {
  whatsapp: string | null;
  gmail: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const updateProfile = async (data: ProfileData) => {
    if (!user) return { error: new Error('User not authenticated') };

    setLoading(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          whatsapp: data.whatsapp,
          gmail: data.gmail
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      toast({
        title: 'Profil Diperbarui',
        description: 'Data profil Anda berhasil diperbarui.'
      });

      return { error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Gagal memperbarui profil.',
        variant: 'destructive'
      });
      return { error };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    updateProfile,
  };
}
