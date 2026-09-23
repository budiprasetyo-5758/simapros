import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Mail, FileText, AlertTriangle, Calendar, CheckSquare, XCircle, RefreshCw, FileEdit, Clock, BarChart3, FolderOpen, Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useMasterProyek, MasterProyek } from '@/hooks/useMasterProyek';
import { useUnitKerja, UnitKerja } from '@/hooks/useUnitKerja';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface NotificationSettingItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

function NotificationSettingItem({ icon, title, description, checked, onCheckedChange, disabled }: NotificationSettingItemProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-muted">{icon}</div>
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export default function NotificationSettings() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const { preferences, loading, updatePreference } = useNotificationPreferences();
  const { masterProyek, loading: masterLoading, refetch: refetchMaster } = useMasterProyek();
  const { unitKerja, loading: unitLoading, addUnitKerja, updateUnitKerja, deleteUnitKerja } = useUnitKerja();
  const { toast } = useToast();

  // Kategori dialog state
  const [kategoriDialogOpen, setKategoriDialogOpen] = useState(false);
  const [kategoriDeleteOpen, setKategoriDeleteOpen] = useState(false);
  const [editingKategori, setEditingKategori] = useState<MasterProyek | null>(null);
  const [deletingKategori, setDeletingKategori] = useState<MasterProyek | null>(null);
  const [kategoriForm, setKategoriForm] = useState({ name: '', description: '' });
  const [kategoriSubmitting, setKategoriSubmitting] = useState(false);

  // Unit Kerja dialog state
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [unitDeleteOpen, setUnitDeleteOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<UnitKerja | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<UnitKerja | null>(null);
  const [unitForm, setUnitForm] = useState({ name: '', description: '' });
  const [unitSubmitting, setUnitSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  // Kategori handlers
  const openKategoriDialog = (item?: MasterProyek) => {
    if (item) {
      setEditingKategori(item);
      setKategoriForm({ name: item.name, description: item.description || '' });
    } else {
      setEditingKategori(null);
      setKategoriForm({ name: '', description: '' });
    }
    setKategoriDialogOpen(true);
  };

  const handleKategoriSubmit = async () => {
    if (!kategoriForm.name.trim()) return;
    setKategoriSubmitting(true);
    if (editingKategori) {
      const { error } = await supabase.from('master_proyek').update({ name: kategoriForm.name.trim(), description: kategoriForm.description.trim() || null }).eq('id', editingKategori.id);
      if (error) { toast({ title: 'Error', description: 'Gagal mengupdate kategori proyek', variant: 'destructive' }); }
      else { toast({ title: 'Berhasil', description: 'Kategori proyek berhasil diupdate' }); await refetchMaster(); }
    } else {
      const { error } = await supabase.from('master_proyek').insert({ name: kategoriForm.name.trim(), description: kategoriForm.description.trim() || null });
      if (error) { toast({ title: 'Error', description: error.message.includes('duplicate') ? 'Kategori sudah ada' : 'Gagal menambah kategori', variant: 'destructive' }); }
      else { toast({ title: 'Berhasil', description: 'Kategori proyek berhasil ditambahkan' }); await refetchMaster(); }
    }
    setKategoriSubmitting(false);
    setKategoriDialogOpen(false);
  };

  const handleKategoriDelete = async () => {
    if (!deletingKategori) return;
    setKategoriSubmitting(true);
    const { error } = await supabase.from('master_proyek').delete().eq('id', deletingKategori.id);
    if (error) { toast({ title: 'Error', description: 'Gagal menghapus. Mungkin masih digunakan.', variant: 'destructive' }); }
    else { toast({ title: 'Berhasil', description: 'Kategori berhasil dihapus' }); await refetchMaster(); }
    setKategoriSubmitting(false);
    setKategoriDeleteOpen(false);
    setDeletingKategori(null);
  };

  // Unit Kerja handlers
  const openUnitDialog = (item?: UnitKerja) => {
    if (item) {
      setEditingUnit(item);
      setUnitForm({ name: item.name, description: item.description || '' });
    } else {
      setEditingUnit(null);
      setUnitForm({ name: '', description: '' });
    }
    setUnitDialogOpen(true);
  };

  const handleUnitSubmit = async () => {
    if (!unitForm.name.trim()) return;
    setUnitSubmitting(true);
    if (editingUnit) {
      await updateUnitKerja(editingUnit.id, unitForm.name.trim(), unitForm.description.trim() || undefined);
    } else {
      await addUnitKerja(unitForm.name.trim(), unitForm.description.trim() || undefined);
    }
    setUnitSubmitting(false);
    setUnitDialogOpen(false);
  };

  const handleUnitDelete = async () => {
    if (!deletingUnit) return;
    setUnitSubmitting(true);
    await deleteUnitKerja(deletingUnit.id);
    setUnitSubmitting(false);
    setUnitDeleteOpen(false);
    setDeletingUnit(null);
  };

  const proposalSettings = [
    { key: 'email_proposal_approved' as const, icon: <CheckSquare className="w-5 h-5 text-success" />, title: 'Proposal Disetujui', description: 'Terima notifikasi Gmail saat proposal proyek Anda disetujui.' },
    { key: 'email_proposal_rejected' as const, icon: <XCircle className="w-5 h-5 text-destructive" />, title: 'Proposal Ditolak', description: 'Terima notifikasi Gmail saat proposal proyek Anda ditolak.' },
    { key: 'email_proposal_revision' as const, icon: <RefreshCw className="w-5 h-5 text-warning" />, title: 'Perlu Revisi', description: 'Terima notifikasi Gmail saat proposal diminta untuk direvisi.' },
  ];

  const editRequestSettings = [
    { key: 'email_edit_request_approved' as const, icon: <CheckSquare className="w-5 h-5 text-success" />, title: 'Edit Request Disetujui', description: 'Terima notifikasi Gmail saat permintaan edit disetujui.' },
    { key: 'email_edit_request_rejected' as const, icon: <XCircle className="w-5 h-5 text-destructive" />, title: 'Edit Request Ditolak', description: 'Terima notifikasi Gmail saat permintaan edit ditolak.' },
  ];

  const deadlineSettings = [
    { key: 'email_deadline_warning' as const, icon: <Calendar className="w-5 h-5 text-warning" />, title: `Peringatan Deadline (H-${preferences?.reminder_days_before_deadline ?? 7})`, description: `Terima notifikasi Gmail ${preferences?.reminder_days_before_deadline ?? 7} hari sebelum deadline task.` },
    { key: 'email_task_overdue' as const, icon: <AlertTriangle className="w-5 h-5 text-destructive" />, title: 'Task Overdue', description: 'Terima notifikasi Gmail saat ada task yang melewati deadline.' },
  ];

  const reminderSettings = [
    { key: 'email_no_progress_reminder' as const, icon: <Clock className="w-5 h-5 text-warning" />, title: `Proyek Tanpa Progress (${preferences?.reminder_days_no_progress ?? 7} hari)`, description: `Terima notifikasi Gmail jika proyek tidak ada progress selama ${preferences?.reminder_days_no_progress ?? 7} hari.` },
    { key: 'email_pending_reminder' as const, icon: <FileText className="w-5 h-5 text-muted-foreground" />, title: 'Proyek Pending Terlalu Lama', description: 'Terima notifikasi Gmail jika proyek pending melebihi batas waktu.' },
    { key: 'email_monev_summary' as const, icon: <BarChart3 className="w-5 h-5 text-primary" />, title: 'Rangkuman Monev', description: 'Terima notifikasi Gmail saat rangkuman monev proyek diperbarui.' },
  ];

  const renderSettingGroup = (settings: { key: keyof Omit<import('@/hooks/useNotificationPreferences').NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'reminder_days_before_deadline'>; icon: React.ReactNode; title: string; description: string }[]) => (
    settings.map((setting, index) => (
      <div key={setting.key}>
        {index > 0 && <Separator />}
        <NotificationSettingItem
          icon={setting.icon}
          title={setting.title}
          description={setting.description}
          checked={preferences?.[setting.key] as boolean ?? true}
          onCheckedChange={(checked) => updatePreference(setting.key, checked)}
          disabled={!preferences}
        />
      </div>
    ))
  );

  const notificationContent = (
    <div className="space-y-6">
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-start gap-3 py-4">
          <Mail className="w-5 h-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Notifikasi In-App selalu aktif</p>
            <p className="text-muted-foreground">Pengaturan di bawah hanya mengontrol notifikasi yang dikirim ke Gmail Anda.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" />Notifikasi Proposal</CardTitle>
          <CardDescription>Pengaturan Gmail untuk status proposal proyek</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">{renderSettingGroup(proposalSettings)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileEdit className="w-5 h-5" />Notifikasi Edit Request</CardTitle>
          <CardDescription>Pengaturan Gmail untuk permintaan perubahan proyek/task</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">{renderSettingGroup(editRequestSettings)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" />Notifikasi Deadline</CardTitle>
          <CardDescription>Pengaturan Gmail untuk peringatan deadline task</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-start justify-between gap-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted"><Calendar className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="font-medium text-foreground">Hari Reminder Sebelum Deadline</p>
                <p className="text-sm text-muted-foreground">Berapa hari sebelum deadline Anda ingin diingatkan via Gmail</p>
              </div>
            </div>
            <Select value={String(preferences?.reminder_days_before_deadline ?? 7)} onValueChange={(val) => updatePreference('reminder_days_before_deadline', parseInt(val))} disabled={!preferences}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 5, 7, 10, 14, 21, 30].map((d) => (<SelectItem key={d} value={String(d)}>H-{d}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          {renderSettingGroup(deadlineSettings)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />Notifikasi Reminder</CardTitle>
          <CardDescription>Pengaturan Gmail untuk reminder otomatis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="flex items-start justify-between gap-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-muted"><Clock className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="font-medium text-foreground">Hari Tanpa Progress</p>
                <p className="text-sm text-muted-foreground">Berapa hari tanpa progress sebelum Anda diingatkan via Gmail</p>
              </div>
            </div>
            <Select value={String(preferences?.reminder_days_no_progress ?? 7)} onValueChange={(val) => updatePreference('reminder_days_no_progress', parseInt(val))} disabled={!preferences}>
              <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 5, 7, 10, 14, 21, 30].map((d) => (<SelectItem key={d} value={String(d)}>{d} hari</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
          {renderSettingGroup(reminderSettings)}
        </CardContent>
      </Card>
    </div>
  );

  const kategoriContent = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daftar Kategori Proyek</CardTitle>
        <Button onClick={() => openKategoriDialog()} className="gap-2"><Plus className="w-4 h-4" />Tambah Kategori</Button>
      </CardHeader>
      <CardContent>
        {masterLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : masterProyek.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Belum ada data kategori proyek</div>
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
                  <TableCell className="text-muted-foreground">{item.description || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{format(parseISO(item.created_at), 'd MMM yyyy', { locale: localeId })}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openKategoriDialog(item)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingKategori(item); setKategoriDeleteOpen(true); }} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const unitKerjaContent = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Daftar Unit Kerja</CardTitle>
        <Button onClick={() => openUnitDialog()} className="gap-2"><Plus className="w-4 h-4" />Tambah Unit Kerja</Button>
      </CardHeader>
      <CardContent>
        {unitLoading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
        ) : unitKerja.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Belum ada data unit kerja</div>
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
              {unitKerja.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.description || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{format(parseISO(item.created_at), 'd MMM yyyy', { locale: localeId })}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openUnitDialog(item)}><Pencil className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingUnit(item); setUnitDeleteOpen(true); }} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <SimpleLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Bell className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pengaturan</h1>
            <p className="text-muted-foreground">Kelola pengaturan notifikasi dan master data</p>
          </div>
        </div>

        <Tabs defaultValue="notifikasi">
          <TabsList className="w-full">
            <TabsTrigger value="notifikasi" className="flex-1 gap-2">
              <Bell className="w-4 h-4" />
              Notifikasi
            </TabsTrigger>
            {isSuperAdmin && (
              <>
                <TabsTrigger value="kategori" className="flex-1 gap-2">
                  <FolderOpen className="w-4 h-4" />
                  Kategori Proyek
                </TabsTrigger>
                <TabsTrigger value="unit-kerja" className="flex-1 gap-2">
                  <Building2 className="w-4 h-4" />
                  Unit Kerja
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="notifikasi">{notificationContent}</TabsContent>

          {isSuperAdmin && (
            <>
              <TabsContent value="kategori">{kategoriContent}</TabsContent>
              <TabsContent value="unit-kerja">{unitKerjaContent}</TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Kategori Dialogs */}
      <Dialog open={kategoriDialogOpen} onOpenChange={setKategoriDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingKategori ? 'Edit Kategori Proyek' : 'Tambah Kategori Proyek'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Kategori *</Label>
              <Input value={kategoriForm.name} onChange={(e) => setKategoriForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: TDABC" />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={kategoriForm.description} onChange={(e) => setKategoriForm(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsi singkat..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKategoriDialogOpen(false)}>Batal</Button>
            <Button onClick={handleKategoriSubmit} disabled={kategoriSubmitting || !kategoriForm.name.trim()}>{kategoriSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={kategoriDeleteOpen} onOpenChange={setKategoriDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Kategori Proyek</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Apakah Anda yakin ingin menghapus "{deletingKategori?.name}"?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setKategoriDeleteOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleKategoriDelete} disabled={kategoriSubmitting}>{kategoriSubmitting ? 'Menghapus...' : 'Hapus'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Kerja Dialogs */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingUnit ? 'Edit Unit Kerja' : 'Tambah Unit Kerja'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Unit Kerja *</Label>
              <Input value={unitForm.name} onChange={(e) => setUnitForm(p => ({ ...p, name: e.target.value }))} placeholder="Contoh: IT Department" />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea value={unitForm.description} onChange={(e) => setUnitForm(p => ({ ...p, description: e.target.value }))} placeholder="Deskripsi singkat..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUnitSubmit} disabled={unitSubmitting || !unitForm.name.trim()}>{unitSubmitting ? 'Menyimpan...' : 'Simpan'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={unitDeleteOpen} onOpenChange={setUnitDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Hapus Unit Kerja</DialogTitle></DialogHeader>
          <p className="text-muted-foreground">Apakah Anda yakin ingin menghapus "{deletingUnit?.name}"?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnitDeleteOpen(false)}>Batal</Button>
            <Button variant="destructive" onClick={handleUnitDelete} disabled={unitSubmitting}>{unitSubmitting ? 'Menghapus...' : 'Hapus'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SimpleLayout>
  );
}
