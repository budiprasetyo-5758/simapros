import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Shield, User, Search, Pencil, Trash2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useUsers, UserWithRole, AppRole } from '@/hooks/useUsers';
import { useToast } from '@/hooks/use-toast';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Project Executor', // Legacy - treated same as project_executor
  project_executor: 'Project Executor',
  user: 'User Biasa',
};

const getRoleBadgeVariant = (role: AppRole): 'default' | 'secondary' | 'outline' | 'destructive' => {
  switch (role) {
    case 'super_admin':
      return 'destructive';
    case 'admin':
    case 'project_executor':
      return 'default';
    default:
      return 'outline';
  }
};

export default function UserManagement() {
  const navigate = useNavigate();
  const { user: currentUser, isAdmin, loading: authLoading } = useAuth();
  const { users, loading: usersLoading, updateUserRole, updateUserProfile, deleteUser } = useUsers();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    user: UserWithRole | null;
    newRole: AppRole | null;
  }>({ open: false, user: null, newRole: null });

  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    user: UserWithRole | null;
  }>({ open: false, user: null });

  const [editFormData, setEditFormData] = useState({
    name: '',
    whatsapp: '',
    gmail: '',
  });

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    user: UserWithRole | null;
  }>({ open: false, user: null });

  useEffect(() => {
    if (!authLoading && !currentUser) {
      navigate('/auth');
    }
    if (!authLoading && currentUser && !isAdmin) {
      navigate('/');
    }
  }, [currentUser, isAdmin, authLoading, navigate]);

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    );
  });

  const handleRoleChange = (user: UserWithRole, newRole: AppRole) => {
    if (newRole === user.role) return;
    
    // Prevent user from demoting themselves
    if (user.id === currentUser?.id && (newRole === 'user' || newRole === 'project_executor')) {
      toast({
        title: 'Tidak Diizinkan',
        description: 'Anda tidak dapat menurunkan role Anda sendiri.',
        variant: 'destructive',
      });
      return;
    }

    setConfirmDialog({ open: true, user, newRole });
  };

  const confirmRoleChange = async () => {
    if (!confirmDialog.user || !confirmDialog.newRole) return;

    const result = await updateUserRole(
      confirmDialog.user.id,
      confirmDialog.newRole
    );

    if (result.success) {
      toast({
        title: 'Berhasil',
        description: `Role ${confirmDialog.user.name} telah diubah menjadi ${ROLE_LABELS[confirmDialog.newRole]}.`,
      });
    } else {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan saat mengubah role.',
        variant: 'destructive',
      });
    }

    setConfirmDialog({ open: false, user: null, newRole: null });
  };

  const openEditDialog = (user: UserWithRole) => {
    setEditFormData({
      name: user.name,
      whatsapp: user.whatsapp || '',
      gmail: user.gmail || '',
    });
    setEditDialog({ open: true, user });
  };

  const handleEditSubmit = async () => {
    if (!editDialog.user) return;

    const result = await updateUserProfile(editDialog.user.id, {
      name: editFormData.name,
      whatsapp: editFormData.whatsapp || null,
      gmail: editFormData.gmail || null,
    });

    if (result.success) {
      toast({
        title: 'Berhasil',
        description: `Profil ${editFormData.name} telah diperbarui.`,
      });
      setEditDialog({ open: false, user: null });
    } else {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan saat memperbarui profil.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteDialog.user) return;

    // Prevent deleting self
    if (deleteDialog.user.id === currentUser?.id) {
      toast({
        title: 'Tidak Diizinkan',
        description: 'Anda tidak dapat menghapus akun Anda sendiri.',
        variant: 'destructive',
      });
      setDeleteDialog({ open: false, user: null });
      return;
    }

    const result = await deleteUser(deleteDialog.user.id);

    if (result.success) {
      toast({
        title: 'Berhasil',
        description: `Pengguna ${deleteDialog.user.name} telah dihapus.`,
      });
    } else {
      toast({
        title: 'Gagal',
        description: 'Terjadi kesalahan saat menghapus pengguna.',
        variant: 'destructive',
      });
    }

    setDeleteDialog({ open: false, user: null });
  };

  if (authLoading || usersLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const superAdminCount = users.filter((u) => u.role === 'super_admin').length;
  const executorCount = users.filter((u) => u.role === 'admin' || u.role === 'project_executor').length;
  const userCount = users.filter((u) => u.role === 'user').length;

  return (
    <SimpleLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Manajemen Pengguna</h1>
            <p className="text-muted-foreground">Kelola role dan akses pengguna sistem</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Users className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{superAdminCount}</p>
                <p className="text-sm text-muted-foreground">Super Admin</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{executorCount}</p>
                <p className="text-sm text-muted-foreground">Project Executor</p>
              </div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{userCount}</p>
                <p className="text-sm text-muted-foreground">User Biasa</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Cari berdasarkan nama atau email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pengguna</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Terdaftar</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'Tidak ada pengguna yang ditemukan' : 'Belum ada pengguna'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          {user.role === 'admin' ? (
                            <Shield className="w-4 h-4 text-primary" />
                          ) : (
                            <User className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          {user.id === currentUser?.id && (
                            <Badge variant="outline" className="text-xs">Anda</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        {user.email}
                        {user.gmail && (
                          <span className="ml-2" title={user.gmail_verified ? 'Gmail terverifikasi' : 'Gmail belum diverifikasi'}>
                            {user.gmail_verified ? (
                              <CheckCircle className="w-3.5 h-3.5 text-green-600 inline" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5 text-muted-foreground inline" />
                            )}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(user.role)}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), 'd MMM yyyy', { locale: localeId })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(value: AppRole) =>
                            handleRoleChange(user, value)
                          }
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="project_executor">Project Executor</SelectItem>
                            <SelectItem value="user">User Biasa</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(user)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteDialog({ open: true, user })}
                          disabled={user.id === currentUser?.id}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Role Change Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog({ open, user: null, newRole: null })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Perubahan Role</AlertDialogTitle>
            <AlertDialogDescription>
              Anda akan mengubah role <strong>{confirmDialog.user?.name}</strong>{' '}
              menjadi{' '}
              <strong>
                {confirmDialog.newRole ? ROLE_LABELS[confirmDialog.newRole] : ''}
              </strong>
              .
              {(confirmDialog.newRole === 'admin' || confirmDialog.newRole === 'super_admin') && (
                <span className="block mt-2 text-destructive">
                  ⚠️ {confirmDialog.newRole === 'super_admin' 
                    ? 'Super Admin memiliki akses tertinggi ke semua fitur sistem.'
                    : 'Administrator memiliki akses penuh ke approval proyek dan manajemen pengguna.'}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              Konfirmasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit User Dialog */}
      <Dialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ open, user: null })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pengguna</DialogTitle>
            <DialogDescription>
              Perbarui informasi pengguna {editDialog.user?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nama</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-whatsapp">No. WhatsApp</Label>
              <Input
                id="edit-whatsapp"
                value={editFormData.whatsapp}
                onChange={(e) => setEditFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="08xxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-gmail">Gmail</Label>
              <Input
                id="edit-gmail"
                type="email"
                value={editFormData.gmail}
                onChange={(e) => setEditFormData(prev => ({ ...prev, gmail: e.target.value }))}
                placeholder="example@gmail.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, user: null })}>
              Batal
            </Button>
            <Button onClick={handleEditSubmit}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, user: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Pengguna</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus pengguna{' '}
              <strong>{deleteDialog.user?.name}</strong>? Tindakan ini tidak dapat
              dibatalkan dan akan menghapus semua data terkait pengguna ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SimpleLayout>
  );
}