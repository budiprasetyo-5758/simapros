import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface PicOption {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  pic_type: string;
  created_at: string;
  updated_at: string;
}

export function usePicOptions(picType?: string | string[]) {
  const [picOptions, setPicOptions] = useState<PicOption[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPicOptions = async () => {
    setLoading(true);
    let query = supabase
      .from('pic_options')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (picType) {
      if (Array.isArray(picType)) {
        query = query.in('pic_type', picType);
      } else {
        query = query.eq('pic_type', picType);
      }
    }

    const { data, error } = await query;

    if (error) {
      // Ignore error if table doesn't exist yet to prevent crashing before migration
      if (!error.message.includes('does not exist') && !error.message.includes('column "pic_type" does not exist')) {
        console.error('Error fetching PIC options:', error);
        toast({
          title: 'Error',
          description: 'Gagal memuat data PIC',
          variant: 'destructive',
        });
      }
    } else {
      setPicOptions(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPicOptions();
  }, [JSON.stringify(picType)]);

  const activePicOptions = picOptions.filter(pic => pic.is_active);

  const addPicOption = async (name: string, isActive: boolean = true, sortOrder: number = 0, type: string = 'project') => {
    const { error } = await supabase
      .from('pic_options')
      .insert({ name, is_active: isActive, sort_order: sortOrder, pic_type: type });

    if (error) {
      toast({
        title: 'Error',
        description: error.message.includes('duplicate') 
          ? 'PIC dengan nama tersebut sudah ada' 
          : 'Gagal menambah PIC',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'PIC berhasil ditambahkan',
    });
    await fetchPicOptions();
    return { success: true };
  };

  const updatePicOption = async (id: string, name: string, isActive: boolean, sortOrder: number) => {
    const { error } = await supabase
      .from('pic_options')
      .update({ name, is_active: isActive, sort_order: sortOrder })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Gagal mengupdate PIC',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'PIC berhasil diupdate',
    });
    await fetchPicOptions();
    return { success: true };
  };

  const deletePicOption = async (id: string) => {
    const { error } = await supabase
      .from('pic_options')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Gagal menghapus PIC. Mungkin masih digunakan.',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'PIC berhasil dihapus',
    });
    await fetchPicOptions();
    return { success: true };
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('pic_options')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Gagal mengubah status PIC',
        variant: 'destructive',
      });
      return { success: false };
    }

    await fetchPicOptions();
    return { success: true };
  };

  return {
    picOptions,
    activePicOptions,
    loading,
    addPicOption,
    updatePicOption,
    deletePicOption,
    toggleActive,
    refetch: fetchPicOptions,
  };
}
