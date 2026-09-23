import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export type AppRole = 'super_admin' | 'admin' | 'project_executor' | 'user';

export interface UserWithRole {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  created_at: string;
  whatsapp?: string | null;
  gmail?: string | null;
  gmail_verified?: boolean;
}

export function useUsers() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const fetchUsers = async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }

    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          id: profile.id,
          email: profile.email || '',
          name: profile.name,
          role: (userRole?.role as AppRole) || 'user',
          created_at: profile.created_at,
          whatsapp: profile.whatsapp,
          gmail: profile.gmail,
          gmail_verified: (profile as any).gmail_verified || false,
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching users:', error);
      }
      toast({
        title: 'Error',
        description: 'Gagal memuat data pengguna',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isSuperAdmin]);

  const updateUserRole = async (userId: string, newRole: AppRole) => {
    try {
      // Check if user already has a role entry
      const { data: existingRole, error: checkError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingRole) {
        // Update existing role
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ role: newRole })
          .eq('user_id', userId);

        if (updateError) throw updateError;
      } else {
        // Insert new role
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: newRole });

        if (insertError) throw insertError;
      }

      await fetchUsers();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating user role:', error);
      }
      return { success: false };
    }
  };

  const updateUserProfile = async (
    userId: string,
    data: { name?: string; whatsapp?: string | null; gmail?: string | null }
  ) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userId);

      if (error) throw error;

      await fetchUsers();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating user profile:', error);
      }
      return { success: false };
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await fetchUsers();
      return { success: true };
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting user:', error);
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  return {
    users,
    loading,
    updateUserRole,
    updateUserProfile,
    deleteUser,
    refetch: fetchUsers,
  };
}
