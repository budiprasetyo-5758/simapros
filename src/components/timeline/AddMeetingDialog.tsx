import { useState } from 'react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMeetings } from '@/hooks/useMeetings';
import { useQuery } from '@tanstack/react-query';
import { Upload } from 'lucide-react';

interface AddMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: string;
  defaultProjectId?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  onCreated?: (meetingId: string) => void;
}

export function AddMeetingDialog({ open, onOpenChange, defaultDate, defaultProjectId, defaultTitle, defaultDescription, onCreated }: AddMeetingDialogProps) {
  const { user } = useAuth();
  const { createMeeting } = useMeetings();
  const [title, setTitle] = useState(defaultTitle || '');
  const [meetingDate, setMeetingDate] = useState(defaultDate || format(new Date(), 'yyyy-MM-dd'));
  const [meetingTime, setMeetingTime] = useState('09:00');
  const [description, setDescription] = useState(defaultDescription || '');
  const [projectId, setProjectId] = useState<string>(defaultProjectId || 'none');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['meeting-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title')
        .in('status', ['approved', 'active'])
        .order('title');
      return data || [];
    },
    enabled: open,
  });

  const handleSubmit = async () => {
    if (!title.trim() || !user) return;
    setUploading(true);
    try {
      let attachmentUrl: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('meeting-attachments').upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('meeting-attachments').getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
      }
      const result = await createMeeting.mutateAsync({
        title: title.trim(),
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        description: description.trim(),
        project_id: projectId === 'none' ? null : projectId,
        attachment_url: attachmentUrl,
        created_by: user.id,
      });
      onCreated?.((result as any)?.id);
      resetForm();
      onOpenChange(false);
    } catch {
      // error handled in hook
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setTitle(defaultTitle || '');
    setDescription(defaultDescription || '');
    setProjectId(defaultProjectId || 'none');
    setFile(null);
    setMeetingTime('09:00');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Judul Meeting *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Judul meeting" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tanggal</Label>
              <Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
            </div>
            <div>
              <Label>Waktu</Label>
              <Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Project (Opsional)</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Pilih project..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tanpa Project</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Deskripsi singkat meeting" rows={3} />
          </div>
          <div>
            <Label>File Notulensi</Label>
            <div className="mt-1">
              <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-md p-3 hover:bg-muted/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{file ? file.name : 'Pilih file notulensi...'}</span>
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || uploading}>
            {uploading ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
