import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useProjectDocuments, DOCUMENT_CATEGORIES } from '@/hooks/useProjectDocuments';
import { Upload } from 'lucide-react';

interface AddDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function AddDocumentDialog({ open, onOpenChange, projectId }: AddDocumentDialogProps) {
  const { user } = useAuth();
  const { addDocument } = useProjectDocuments(projectId);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('other');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!file || !name.trim() || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${projectId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from('project-attachments').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('project-attachments').getPublicUrl(path);

      await addDocument.mutateAsync({
        project_id: projectId,
        uploaded_by: user.id,
        document_name: name.trim(),
        document_url: urlData.publicUrl,
        category,
        description: description.trim() || undefined,
      });
      resetForm();
      onOpenChange(false);
    } catch {
      // error handled in hook
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setCategory('other');
    setDescription('');
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Dokumen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nama Dokumen *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nama dokumen" />
          </div>
          <div>
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(DOCUMENT_CATEGORIES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Deskripsi (Opsional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Deskripsi dokumen" rows={2} />
          </div>
          <div>
            <Label>File *</Label>
            <div className="mt-1">
              <label className="flex items-center gap-2 cursor-pointer border border-dashed rounded-md p-3 hover:bg-muted/50 transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{file ? file.name : 'Pilih file...'}</span>
                <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg" />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || !file || uploading}>
            {uploading ? 'Mengupload...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
