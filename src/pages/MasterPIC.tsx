import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Plus, Pencil, Trash2, ArrowLeft, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { usePicOptions, PicOption } from '@/hooks/usePicOptions';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function MasterPIC() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  
  const [activeMainTab, setActiveMainTab] = useState('project');
  const [activeCorsecTab, setActiveCorsecTab] = useState('coresec_direksi');

  const currentType = activeMainTab === 'project' ? 'project' : activeCorsecTab;
  const { picOptions, loading, addPicOption, updatePicOption, deletePicOption, toggleActive } = usePicOptions(currentType);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PicOption | null>(null);
  const [deletingItem, setDeletingItem] = useState<PicOption | null>(null);
  const [formData, setFormData] = useState({ name: '', is_active: true, sort_order: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && !isSuperAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isSuperAdmin, navigate]);

  const handleOpenDialog = (item?: PicOption) => {
    if (item) {
      setEditingItem(item);
      setFormData({ name: item.name, is_active: item.is_active, sort_order: item.sort_order });
    } else {
      setEditingItem(null);
      // Determine next sort order
      const nextSort = picOptions.length > 0 ? Math.max(...picOptions.map(p => p.sort_order)) + 1 : 1;
      setFormData({ name: '', is_active: true, sort_order: nextSort });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) return;
    
    setIsSubmitting(true);
    if (editingItem) {
      await updatePicOption(editingItem.id, formData.name.trim(), formData.is_active, formData.sort_order);
    } else {
      await addPicOption(formData.name.trim(), formData.is_active, formData.sort_order, currentType);
    }
    setIsSubmitting(false);
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    
    setIsSubmitting(true);
    await deletePicOption(deletingItem.id);
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

  const getTitle = () => {
    if (activeMainTab === 'project') return 'Daftar PIC Projek';
    if (activeCorsecTab === 'coresec_direksi') return 'Daftar Direksi Corsec';
    if (activeCorsecTab === 'coresec_coresec') return 'Daftar Tim Coresec';
    return 'Daftar PIC Corsec';
  };

  return (
    <SimpleLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <UserCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Master PIC & Pihak Terkait</h1>
              <p className="text-muted-foreground">Kelola daftar pihak-pihak terkait untuk projek dan corporate secretary</p>
            </div>
          </div>
        </div>

        <Tabs value={activeMainTab} onValueChange={setActiveMainTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="project" className="gap-2">
              <Building2 className="w-4 h-4" /> PIC Projek
            </TabsTrigger>
            <TabsTrigger value="coresec" className="gap-2">
              <UserCheck className="w-4 h-4" /> Corporate Secretary
            </TabsTrigger>
          </TabsList>

          <Card>
            <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>{getTitle()}</CardTitle>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                {activeMainTab === 'coresec' && (
                  <div className="flex bg-muted p-1 rounded-md">
                    <Button 
                      variant={activeCorsecTab === 'coresec_direksi' ? 'default' : 'ghost'} 
                      size="sm" 
                      onClick={() => setActiveCorsecTab('coresec_direksi')}
                    >
                      Direksi
                    </Button>
                    <Button 
                      variant={activeCorsecTab === 'coresec_coresec' ? 'default' : 'ghost'} 
                      size="sm" 
                      onClick={() => setActiveCorsecTab('coresec_coresec')}
                    >
                      Coresec
                    </Button>
                    <Button 
                      variant={activeCorsecTab === 'coresec_pic' ? 'default' : 'ghost'} 
                      size="sm" 
                      onClick={() => setActiveCorsecTab('coresec_pic')}
                    >
                      PIC
                    </Button>
                  </div>
                )}
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Tambah
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : picOptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Belum ada data
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-center">Urutan</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dibuat</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {picOptions.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center font-medium">{item.sort_order}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant={item.is_active ? 'default' : 'secondary'} className={item.is_active ? 'bg-green-500 hover:bg-green-600' : ''}>
                            {item.is_active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(parseISO(item.created_at), 'd MMM yyyy', { locale: localeId })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-2">
                            <Switch 
                              checked={item.is_active} 
                              onCheckedChange={() => toggleActive(item.id, item.is_active)}
                              title={item.is_active ? "Nonaktifkan" : "Aktifkan"}
                            />
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
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
        </Tabs>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Edit Data' : 'Tambah Data'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Contoh: Dr Ihza"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Urutan Tampil</Label>
                <Input
                  id="sort_order"
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <div className="flex items-center space-x-2 h-10">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label htmlFor="is_active">Aktif</Label>
                </div>
              </div>
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
            <DialogTitle>Hapus Data</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Apakah Anda yakin ingin menghapus "{deletingItem?.name}"? 
            Tindakan ini tidak dapat dibatalkan. Catatan: Jika data ini sudah digunakan, lebih baik ubah statusnya menjadi <strong>Nonaktif</strong> daripada menghapusnya.
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
