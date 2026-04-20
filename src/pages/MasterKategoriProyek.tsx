import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useMasterProyek, MasterProyek } from '@/hooks/useMasterProyek';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function MasterKategoriProyek() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const { masterProyek, loading, refetch } = useMasterProyek();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MasterProyek | null>(null);
  const [deletingItem, setDeletingItem] = useState<MasterProyek | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && !isSuperAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isSuperAdmin, navigate]);

  const handleOpenDialog = (item?: MasterProyek) => {
    if (item) {
      setEditingItem(item);
      setFormData({ name: item.name, description: item.description || '' });
    } else {
      setEditingItem(null);
      setFormData({ name: '', description: '' });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    
    setIsSubmitting(true);
    
    if (editingItem) {
      const { error } = await supabase
        .from('master_proyek')
        .update({ name: formData.name.trim(), description: formData.description.trim() || null })
        .eq('id', editingItem.id);
      
      if (error) {
        toast({
          title: 'Error',
          description: 'Gagal mengupdate kategori proyek',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Berhasil',
          description: 'Kategori proyek berhasil diupdate',
        });
        await refetch();
      }
    } else {
      const { error } = await supabase
        .from('master_proyek')
        .insert({ name: formData.name.trim(), description: formData.description.trim() || null });
      
      if (error) {
        toast({
          title: 'Error',
          description: error.message.includes('duplicate')
            ? 'Kategori proyek dengan nama tersebut sudah ada'
            : 'Gagal menambah kategori proyek',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Berhasil',
          description: 'Kategori proyek berhasil ditambahkan',
        });
        await refetch();
      }
    }
    
    setIsSubmitting(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    
    setIsSubmitting(true);
    
    const { error } = await supabase
      .from('master_proyek')
      .delete()
      .eq('id', deletingItem.id);
    
    if (error) {
      toast({
        title: 'Error',
        description: 'Gagal menghapus kategori proyek. Mungkin masih digunakan.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Berhasil',
        description: 'Kategori proyek berhasil dihapus',
      });
      await refetch();
    }
    
    setIsSubmitting(false);
    setDeleteDialogOpen(false);
    setDeletingItem(null);
  };

  if (authLoading || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SimpleLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <FolderOpen className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Master Kategori Proyek</h1>
              <p className="text-muted-foreground">Kelola kategori/jenis proyek</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Daftar Kategori Proyek</CardTitle>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Tambah Kategori
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : masterProyek.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada data kategori proyek
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {masterProyek.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.description || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(parseISO(item.created_at), 'd MMM yyyy', { locale: localeId })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeletingItem(item);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Kategori Proyek' : 'Tambah Kategori Proyek'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Kategori *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Contoh: TDABC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Deskripsi singkat kategori proyek..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !formData.name.trim()}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Kategori Proyek</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Apakah Anda yakin ingin menghapus kategori proyek "{deletingItem?.name}"? 
            Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SimpleLayout>
  );
}
