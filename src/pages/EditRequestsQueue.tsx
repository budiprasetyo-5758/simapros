import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { FileEdit, Check, X, Eye, ArrowRight, Calendar, Clock, User, ListTodo, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useProjectEditRequests, ProjectEditRequest } from '@/hooks/useProjectEditRequests';
import { useTaskEditRequests, TaskEditRequest } from '@/hooks/useTaskEditRequests';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const statusConfig = {
  pending: { label: 'Menunggu', className: 'bg-warning/10 text-warning border-warning/20' },
  approved: { label: 'Disetujui', className: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'Ditolak', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function EditRequestsQueue() {
  const navigate = useNavigate();
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const { editRequests, loading, reviewEditRequest } = useProjectEditRequests();
  const { taskEditRequests, loading: taskLoading, reviewTaskEditRequest, pendingCount: taskPendingCount } = useTaskEditRequests();
  const [selectedRequest, setSelectedRequest] = useState<ProjectEditRequest | null>(null);
  const [selectedTaskRequest, setSelectedTaskRequest] = useState<TaskEditRequest | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  // Only super admins can access edit requests queue
  if (!isSuperAdmin) {
    navigate('/');
    return null;
  }

  const pendingRequests = editRequests.filter(r => r.status === 'pending');
  const processedRequests = editRequests.filter(r => r.status !== 'pending');
  const pendingTaskRequests = taskEditRequests.filter(r => r.status === 'pending');
  const processedTaskRequests = taskEditRequests.filter(r => r.status !== 'pending');

  const sendEditRequestNotification = async (
    userId: string,
    status: 'approved' | 'rejected',
    projectId: string,
    projectTitle: string,
    taskName?: string,
    adminNote?: string
  ) => {
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          type: status === 'approved' ? 'edit_request_approved' : 'edit_request_rejected',
          userId,
          projectId,
          projectTitle,
          taskName,
          adminNote,
          sendEmail: true,
        }
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const handleReview = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest) return;
    
    setIsProcessing(true);
    const result = await reviewEditRequest(selectedRequest.id, status, adminNote, status === 'approved');
    
    if (result.success) {
      // Send notification to requester
      await sendEditRequestNotification(
        selectedRequest.requester_id,
        status,
        selectedRequest.project_id,
        selectedRequest.project_title || '',
        undefined,
        adminNote
      );
    }
    
    setIsProcessing(false);
    setSelectedRequest(null);
    setAdminNote('');
  };

  const handleTaskReview = async (status: 'approved' | 'rejected') => {
    if (!selectedTaskRequest) return;
    
    setIsProcessing(true);
    const result = await reviewTaskEditRequest(selectedTaskRequest.id, status, adminNote, status === 'approved');
    
    if (result.success) {
      // Send notification to requester
      await sendEditRequestNotification(
        selectedTaskRequest.requester_id,
        status,
        selectedTaskRequest.project_id,
        selectedTaskRequest.project_title || '',
        selectedTaskRequest.task_name || selectedTaskRequest.proposed_name || 'Task',
        adminNote
      );
    }
    
    setIsProcessing(false);
    setSelectedTaskRequest(null);
    setAdminNote('');
  };

  const renderChangeComparison = (request: ProjectEditRequest) => {
    const changes: { label: string; proposed: string | null }[] = [];
    
    if (request.proposed_title) {
      changes.push({ label: 'Judul', proposed: request.proposed_title });
    }
    if (request.proposed_description) {
      changes.push({ label: 'Deskripsi', proposed: request.proposed_description.substring(0, 200) + (request.proposed_description.length > 200 ? '...' : '') });
    }
    if (request.proposed_start_date) {
      changes.push({ label: 'Tanggal Mulai', proposed: format(parseISO(request.proposed_start_date), 'd MMMM yyyy', { locale: localeId }) });
    }
    if (request.proposed_end_date) {
      changes.push({ label: 'Tanggal Selesai', proposed: format(parseISO(request.proposed_end_date), 'd MMMM yyyy', { locale: localeId }) });
    }

    return changes;
  };

  return (
    <SimpleLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <FileEdit className="w-6 h-6" />
              Permintaan Perubahan
            </h1>
            <p className="text-muted-foreground">
              Review dan kelola permintaan perubahan project dan task
            </p>
          </div>
        </div>

        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList>
            <TabsTrigger value="projects" className="gap-2">
              <FileEdit className="w-4 h-4" />
              Project ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <ListTodo className="w-4 h-4" />
              Task ({pendingTaskRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects" className="space-y-4">
            {/* Pending Project Requests */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" />
                Menunggu Review ({pendingRequests.length})
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : pendingRequests.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">Tidak ada permintaan perubahan yang menunggu</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pendingRequests.map((request) => {
                    const changes = renderChangeComparison(request);
                    return (
                      <Card key={request.id} className="border-l-4 border-l-warning">
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{request.project_title}</CardTitle>
                              <CardDescription className="flex items-center gap-2 mt-1">
                                <User className="w-3 h-3" />
                                {request.requester_name}
                                <span className="text-muted-foreground">•</span>
                                <Calendar className="w-3 h-3" />
                                {format(parseISO(request.created_at), 'd MMM yyyy HH:mm', { locale: localeId })}
                              </CardDescription>
                            </div>
                            <Badge variant="outline" className={cn(statusConfig.pending.className)}>
                              {statusConfig.pending.label}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Perubahan yang diajukan:</p>
                            <div className="space-y-1">
                              {changes.map((change, idx) => (
                                <div key={idx} className="flex items-start gap-2 text-sm">
                                  <ArrowRight className="w-4 h-4 text-primary mt-0.5" />
                                  <span className="font-medium">{change.label}:</span>
                                  <span className="text-muted-foreground">{change.proposed}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => navigate(`/project/${request.project_id}`)}
                            >
                              <Eye className="w-4 h-4" />
                              Lihat Project
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1"
                              onClick={() => {
                                setSelectedRequest(request);
                                setAdminNote('');
                              }}
                            >
                              Review
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Processed Requests */}
            {processedRequests.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Riwayat ({processedRequests.length})</h2>
                <div className="grid gap-4">
                  {processedRequests.slice(0, 10).map((request) => (
                    <Card key={request.id} className="opacity-75">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{request.project_title}</CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              <User className="w-3 h-3" />
                              {request.requester_name}
                              <span className="text-muted-foreground">•</span>
                              {format(parseISO(request.created_at), 'd MMM yyyy', { locale: localeId })}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className={cn(statusConfig[request.status].className)}>
                            {statusConfig[request.status].label}
                          </Badge>
                        </div>
                      </CardHeader>
                      {request.admin_note && (
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Catatan:</span> {request.admin_note}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            {/* Pending Task Requests */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-warning" />
                Menunggu Review ({pendingTaskRequests.length})
              </h2>

              {taskLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : pendingTaskRequests.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">Tidak ada permintaan perubahan task yang menunggu</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {pendingTaskRequests.map((request) => (
                    <Card key={request.id} className="border-l-4 border-l-warning">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {request.is_new_task && <Plus className="w-4 h-4 text-success" />}
                              {request.is_delete_request && <Trash2 className="w-4 h-4 text-destructive" />}
                              {request.is_new_task ? 'Task Baru: ' : request.is_delete_request ? 'Hapus: ' : ''}
                              {request.task_name || request.proposed_name}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-2 mt-1">
                              Project: {request.project_title}
                              <span className="text-muted-foreground">•</span>
                              <Calendar className="w-3 h-3" />
                              {format(parseISO(request.created_at), 'd MMM yyyy HH:mm', { locale: localeId })}
                            </CardDescription>
                          </div>
                          <Badge variant="outline" className={cn(statusConfig.pending.className)}>
                            {request.is_new_task ? 'Task Baru' : request.is_delete_request ? 'Hapus Task' : 'Edit Task'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {!request.is_delete_request && (
                          <div className="space-y-1 text-sm">
                            {request.proposed_name && <p><span className="font-medium">Nama:</span> {request.proposed_name}</p>}
                            {request.proposed_phase && <p><span className="font-medium">Phase:</span> {request.proposed_phase}</p>}
                            {request.proposed_start_date && <p><span className="font-medium">Mulai:</span> {format(parseISO(request.proposed_start_date), 'd MMM yyyy', { locale: localeId })}</p>}
                            {request.proposed_end_date && <p><span className="font-medium">Selesai:</span> {format(parseISO(request.proposed_end_date), 'd MMM yyyy', { locale: localeId })}</p>}
                          </div>
                        )}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => navigate(`/project/${request.project_id}`)}
                          >
                            <Eye className="w-4 h-4" />
                            Lihat Project
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-1"
                            onClick={() => {
                              setSelectedTaskRequest(request);
                              setAdminNote('');
                            }}
                          >
                            Review
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Permintaan Perubahan</DialogTitle>
            <DialogDescription>
              Project: {selectedRequest?.project_title}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium">Perubahan yang diajukan:</p>
                {renderChangeComparison(selectedRequest).map((change, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="text-sm font-medium text-primary">{change.label}:</p>
                    <p className="text-sm text-muted-foreground bg-background p-2 rounded">
                      {change.proposed}
                    </p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-note">Catatan (Opsional)</Label>
                <Textarea
                  id="admin-note"
                  placeholder="Tambahkan catatan untuk user..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setSelectedRequest(null)}
              disabled={isProcessing}
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReview('rejected')}
              disabled={isProcessing}
              className="gap-1"
            >
              <X className="w-4 h-4" />
              Tolak
            </Button>
            <Button
              onClick={() => handleReview('approved')}
              disabled={isProcessing}
              className="gap-1"
            >
              <Check className="w-4 h-4" />
              Setujui & Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Task Review Dialog */}
      <Dialog open={!!selectedTaskRequest} onOpenChange={() => setSelectedTaskRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedTaskRequest?.is_new_task ? 'Review Task Baru' : selectedTaskRequest?.is_delete_request ? 'Review Hapus Task' : 'Review Perubahan Task'}
            </DialogTitle>
            <DialogDescription>
              Project: {selectedTaskRequest?.project_title}
            </DialogDescription>
          </DialogHeader>

          {selectedTaskRequest && (
            <div className="space-y-4 py-4">
              <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
                {selectedTaskRequest.is_delete_request ? (
                  <p className="text-sm text-destructive">Task "{selectedTaskRequest.task_name}" akan dihapus.</p>
                ) : (
                  <>
                    <p className="text-sm font-medium">Detail Task:</p>
                    {selectedTaskRequest.proposed_name && <p className="text-sm"><span className="font-medium">Nama:</span> {selectedTaskRequest.proposed_name}</p>}
                    {selectedTaskRequest.proposed_description && <p className="text-sm"><span className="font-medium">Deskripsi:</span> {selectedTaskRequest.proposed_description}</p>}
                    {selectedTaskRequest.proposed_phase && <p className="text-sm"><span className="font-medium">Phase:</span> {selectedTaskRequest.proposed_phase}</p>}
                    {selectedTaskRequest.proposed_pic && <p className="text-sm"><span className="font-medium">PIC:</span> {selectedTaskRequest.proposed_pic}</p>}
                    {selectedTaskRequest.proposed_start_date && <p className="text-sm"><span className="font-medium">Mulai:</span> {format(parseISO(selectedTaskRequest.proposed_start_date), 'd MMM yyyy', { locale: localeId })}</p>}
                    {selectedTaskRequest.proposed_end_date && <p className="text-sm"><span className="font-medium">Selesai:</span> {format(parseISO(selectedTaskRequest.proposed_end_date), 'd MMM yyyy', { locale: localeId })}</p>}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-admin-note">Catatan (Opsional)</Label>
                <Textarea
                  id="task-admin-note"
                  placeholder="Tambahkan catatan untuk user..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSelectedTaskRequest(null)} disabled={isProcessing}>Batal</Button>
            <Button variant="destructive" onClick={() => handleTaskReview('rejected')} disabled={isProcessing} className="gap-1">
              <X className="w-4 h-4" />Tolak
            </Button>
            <Button onClick={() => handleTaskReview('approved')} disabled={isProcessing} className="gap-1">
              <Check className="w-4 h-4" />Setujui & Terapkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SimpleLayout>
  );
}
