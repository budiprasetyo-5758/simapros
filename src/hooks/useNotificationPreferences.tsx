import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface NotificationPreferences {
  id: string;
  user_id: string;
  email_proposal_approved: boolean;
  email_proposal_rejected: boolean;
  email_proposal_revision: boolean;
  email_deadline_warning: boolean;
  email_task_overdue: boolean;
  email_edit_request_approved: boolean;
  email_edit_request_rejected: boolean;
  email_no_progress_reminder: boolean;
  email_pending_reminder: boolean;
  email_monev_summary: boolean;
  reminder_days_before_deadline: number;
  reminder_days_no_progress: number;
  created_at: string;
  updated_at: string;
}

const defaultPreferences: Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  email_proposal_approved: true,
  email_proposal_rejected: true,
  email_proposal_revision: true,
  email_deadline_warning: true,
  email_task_overdue: true,
  email_edit_request_approved: true,
  email_edit_request_rejected: true,
  email_no_progress_reminder: true,
  email_pending_reminder: true,
  email_monev_summary: true,
  reminder_days_before_deadline: 7,
  reminder_days_no_progress: 7,
};

export function useNotificationPreferences() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPreferences = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data as NotificationPreferences);
      } else {
        // Create default preferences for user
        const { data: newData, error: insertError } = await supabase
          .from('notification_preferences')
          .insert({ user_id: user.id, ...defaultPreferences })
          .select()
          .single();

        if (insertError) throw insertError;
        setPreferences(newData as NotificationPreferences);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, [user]);

  const updatePreference = async (key: keyof typeof defaultPreferences, value: boolean | number) => {
    if (!user || !preferences) return { success: false };

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: value } as any)
        .eq('user_id', user.id);

      if (error) throw error;

      setPreferences(prev => prev ? { ...prev, [key]: value } : null);
      
      toast({
        title: 'Preferensi Disimpan',
        description: 'Pengaturan notifikasi berhasil diperbarui.',
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating preference:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan preferensi notifikasi',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  const updateAllPreferences = async (updates: Partial<typeof defaultPreferences>) => {
    if (!user || !preferences) return { success: false };

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;

      setPreferences(prev => prev ? { ...prev, ...updates } : null);
      
      toast({
        title: 'Preferensi Disimpan',
        description: 'Semua pengaturan notifikasi berhasil diperbarui.',
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan preferensi notifikasi',
        variant: 'destructive',
      });
      return { success: false };
    }
  };

  return {
    preferences,
    loading,
    updatePreference,
    updateAllPreferences,
    refetch: fetchPreferences,
  };
}
