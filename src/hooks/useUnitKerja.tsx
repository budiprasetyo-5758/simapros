import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface UnitKerja {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useUnitKerja() {
  const [unitKerja, setUnitKerja] = useState<UnitKerja[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUnitKerja = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('unit_kerja')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching unit kerja:', error);
      toast({
        title: 'Error',
        description: 'Gagal memuat data unit kerja',
        variant: 'destructive',
      });
    } else {
      setUnitKerja(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUnitKerja();
  }, []);

  const addUnitKerja = async (name: string, description?: string) => {
    const { error } = await supabase
      .from('unit_kerja')
      .insert({ name, description });

    if (error) {
      toast({
        title: 'Error',
        description: error.message.includes('duplicate') 
          ? 'Unit kerja dengan nama tersebut sudah ada' 
          : 'Gagal menambah unit kerja',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'Unit kerja berhasil ditambahkan',
    });
    await fetchUnitKerja();
    return { success: true };
  };

  const updateUnitKerja = async (id: string, name: string, description?: string) => {
    const { error } = await supabase
      .from('unit_kerja')
      .update({ name, description })
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Gagal mengupdate unit kerja',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'Unit kerja berhasil diupdate',
    });
    await fetchUnitKerja();
    return { success: true };
  };

  const deleteUnitKerja = async (id: string) => {
    const { error } = await supabase
      .from('unit_kerja')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Gagal menghapus unit kerja. Mungkin masih digunakan.',
        variant: 'destructive',
      });
      return { success: false };
    }

    toast({
      title: 'Berhasil',
      description: 'Unit kerja berhasil dihapus',
    });
    await fetchUnitKerja();
    return { success: true };
  };

  return {
    unitKerja,
    loading,
    addUnitKerja,
    updateUnitKerja,
    deleteUnitKerja,
    refetch: fetchUnitKerja,
  };
}
