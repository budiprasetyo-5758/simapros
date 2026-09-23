import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle, XCircle, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUnitKerja } from '@/hooks/useUnitKerja';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface ChangeRequest {
  id: string;
  user_id: string;
  current_unit_kerja_id: string | null;
  requested_unit_kerja_id: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  user_profile?: {
    name: string;
    email: string | null;
  };
}

export default function UnitKerjaRequests() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isSuperAdmin } = useAuth();
  const { unitKerja } = useUnitKerja();
  const { toast } = useToast();

  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && !isSuperAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isSuperAdmin, navigate]);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('unit_kerja_change_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch user profiles for each request
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedRequests = (data || []).map(r => ({
        ...r,
        status: r.status as 'pending' | 'approved' | 'rejected',
        user_profile: profileMap.get(r.user_id),
      }));

      setRequests(enrichedRequests);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isSuperAdmin) {
      fetchRequests();
    }
  }, [user, isSuperAdmin]);

  const handleAction = async () => {
    if (!selectedRequest || !actionType || !user) return;

    setIsSubmitting(true);
    try {
      if (actionType === 'approve') {
        // Update the request status
        const { error: requestError } = await supabase
          .from('unit_kerja_change_requests')
          .update({
            status: 'approved',
            admin_note: adminNote || null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', selectedRequest.id);

        if (requestError) throw requestError;

        // Update user's unit_kerja_id
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ unit_kerja_id: selectedRequest.requested_unit_kerja_id })
          .eq('id', selectedRequest.user_id);

        if (profileError) throw profileError;

        toast({
          title: 'Permintaan Disetujui',
          description: 'Unit Kerja pengguna telah diperbarui.',
        });
      } else {
        // Reject the request
        const { error } = await supabase
          .from('unit_kerja_change_requests')
          .update({
            status: 'rejected',
            admin_note: adminNote || null,
            reviewed_by: user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', selectedRequest.id);

        if (error) throw error;

        toast({
          title: 'Permintaan Ditolak',
          description: 'Pengguna akan mendapat notifikasi penolakan.',
        });
      }

      // Refresh and close dialog
      fetchRequests();
      setSelectedRequest(null);
      setActionType(null);
      setAdminNote('');
    } catch (error) {
      console.error('Error processing request:', error);
      toast({
        title: 'Error',
        description: 'Gagal memproses permintaan.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUnitKerjaName = (id: string | null) => {
    if (!id) return '-';
    return unitKerja.find(u => u.id === id)?.name || 'Unknown';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30"><Clock className="w-3 h-3 mr-1" />Menunggu</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30"><CheckCircle className="w-3 h-3 mr-1" />Disetujui</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" />Ditolak</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (authLoading || loading) {
    return (
      <SimpleLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </SimpleLayout>
    );
  }

  if (!isSuperAdmin) return null;

  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <SimpleLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Permintaan Perubahan Unit Kerja</h1>
            <p className="text-muted-foreground">
              Kelola permintaan perubahan unit kerja dari pengguna
            </p>
          </div>
          {pendingRequests.length > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {pendingRequests.length} Menunggu
            </Badge>
          )}
        </div>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Daftar Permintaan</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Belum ada permintaan perubahan unit kerja</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pengguna</TableHead>
                    <TableHead>Dari Unit Kerja</TableHead>
                    <TableHead>Ke Unit Kerja</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{request.user_profile?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{request.user_profile?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getUnitKerjaName(request.current_unit_kerja_id)}</TableCell>
                      <TableCell className="font-medium">{getUnitKerjaName(request.requested_unit_kerja_id)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{request.reason || '-'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(parseISO(request.created_at), 'd MMM yyyy', { locale: localeId })}
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        {request.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-success hover:bg-success/10"
                              onClick={() => {
                                setSelectedRequest(request);
                                setActionType('approve');
                              }}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setSelectedRequest(request);
                                setActionType('reject');
                              }}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {request.reviewed_at && format(parseISO(request.reviewed_at), 'd MMM yyyy', { locale: localeId })}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setAdminNote('');
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {actionType === 'approve' ? 'Setujui Permintaan' : 'Tolak Permintaan'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p><strong>Pengguna:</strong> {selectedRequest?.user_profile?.name}</p>
                <p><strong>Dari:</strong> {getUnitKerjaName(selectedRequest?.current_unit_kerja_id || null)}</p>
                <p><strong>Ke:</strong> {getUnitKerjaName(selectedRequest?.requested_unit_kerja_id || '')}</p>
                {selectedRequest?.reason && (
                  <p><strong>Alasan:</strong> {selectedRequest.reason}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Catatan Admin (Opsional)</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={actionType === 'reject' ? 'Jelaskan alasan penolakan...' : 'Tambahkan catatan jika perlu...'}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setActionType(null);
                  setAdminNote('');
                }}
              >
                Batal
              </Button>
              <Button
                onClick={handleAction}
                disabled={isSubmitting}
                className={actionType === 'approve' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'}
              >
                {isSubmitting ? 'Memproses...' : (actionType === 'approve' ? 'Setujui' : 'Tolak')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SimpleLayout>
  );
}
