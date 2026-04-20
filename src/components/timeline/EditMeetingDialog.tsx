import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useMeetings, Meeting } from '@/hooks/useMeetings';
import { useQuery } from '@tanstack/react-query';
import { Upload } from 'lucide-react';

interface EditMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
}

export function EditMeetingDialog({ open, onOpenChange, meeting }: EditMeetingDialogProps) {
  const { user } = useAuth();
  const { updateMeeting } = useMeetings();
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('09:00');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string>('none');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (meeting) {
      setTitle(meeting.title);
      setMeetingDate(meeting.meeting_date);
      setMeetingTime(meeting.meeting_time?.slice(0, 5) || '09:00');
      setDescription(meeting.description || '');
      setProjectId(meeting.project_id || 'none');
      setFile(null);
    }
  }, [meeting]);

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
    if (!title.trim() || !user || !meeting) return;
    setUploading(true);
    try {
      let attachmentUrl = meeting.attachment_url;
      if (file) {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('meeting-attachments').upload(path, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('meeting-attachments').getPublicUrl(path);
        attachmentUrl = urlData.publicUrl;
      }
      await updateMeeting.mutateAsync({
        id: meeting.id,
        title: title.trim(),
        meeting_date: meetingDate,
        meeting_time: meetingTime,
        description: description.trim(),
        project_id: projectId === 'none' ? null : projectId,
        attachment_url: attachmentUrl,
      });
      onOpenChange(false);
    } catch {
      // error handled in hook
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Meeting</DialogTitle>
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
            <Label>File Notulensi {meeting?.attachment_url ? '(ganti file)' : ''}</Label>
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
