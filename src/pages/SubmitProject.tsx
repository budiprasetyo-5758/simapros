import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useMasterProyek } from '@/hooks/useMasterProyek';
import { useUnitKerja } from '@/hooks/useUnitKerja';
import { useToast } from '@/hooks/use-toast';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { validateProjectForm } from '@/lib/validations/project';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Urgency, urgencyOptions } from '@/lib/priorityMatrix';

export default function SubmitProject() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, isProjectExecutor } = useAuth();
  const { addProject } = useProjects();
  const { masterProyek, loading: masterLoading } = useMasterProyek();
  const { unitKerja, loading: unitLoading } = useUnitKerja();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Get user's unit kerja name
  const userUnitKerja = unitKerja.find(u => u.id === profile?.unit_kerja_id);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    unit: '',
    start_date: format(new Date(), 'yyyy-MM-dd'), // Auto-fill with today
    end_date: '',
    master_proyek_id: '',
    urgency: 'medium' as Urgency,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    // Check if profile is complete (has unit_kerja_id)
    if (!authLoading && profile && !profile.unit_kerja_id) {
      navigate('/complete-profile');
    }
  }, [user, authLoading, profile, navigate]);

  // Set unit from user's unit kerja
  useEffect(() => {
    if (userUnitKerja) {
      setFormData(prev => ({ ...prev, unit: userUnitKerja.name }));
    }
  }, [userUnitKerja]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Limit to 10MB
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File Terlalu Besar',
          description: 'Ukuran file maksimal 10MB',
          variant: 'destructive',
        });
        return;
      }
      setAttachmentFile(file);
    }
  };

  const uploadAttachment = async (): Promise<string | null> => {
    if (!attachmentFile || !user) return null;

    setIsUploading(true);
    const fileExt = attachmentFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('project-attachments')
      .upload(fileName, attachmentFile);

    setIsUploading(false);

    if (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload Gagal',
        description: 'Gagal mengupload file attachment',
        variant: 'destructive',
      });
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('project-attachments')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateProjectForm(formData);

    if (!validation.success) {
      setErrors(validation.errors || {});
      return;
    }

    if (!attachmentFile) {
      setErrors(prev => ({ ...prev, attachment: 'File User Requirement wajib diupload' }));
      toast({
        title: 'File Diperlukan',
        description: 'File User Requirement wajib diupload.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.master_proyek_id) {
      setErrors(prev => ({ ...prev, master_proyek_id: 'Pilih proyek terlebih dahulu' }));
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    // Upload attachment if exists
    let attachmentUrl: string | null = null;
    if (attachmentFile) {
      attachmentUrl = await uploadAttachment();
    }

    const validatedData = validation.data!;

    // Get user profile name
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('name')
      .eq('id', user!.id)
      .single();

    // Priority will be set by Super Admin during evaluation
    const { error } = await supabase.from('projects').insert([{
      title: validatedData.title,
      description: validatedData.description,
      unit: formData.unit || 'Unit Default',
      priority: 'medium', // Default priority, will be set by Super Admin
      start_date: validatedData.start_date,
      end_date: validatedData.end_date,
      master_proyek_id: formData.master_proyek_id,
      requester_id: user!.id,
      requester_name: userProfile?.name || user!.email || 'Unknown',
      status: 'pending',
      project_stage: 'planning',
      attachment_url: attachmentUrl,
      urgency: formData.urgency,
    }]);

    setIsSubmitting(false);

    if (!error) {
      toast({
        title: 'Pengajuan Berhasil',
        description: 'Proyek Anda telah dikirim dan menunggu approval.',
      });
      navigate('/');
    } else {
      toast({
        title: 'Gagal Mengajukan',
        description: error.message || 'Terjadi kesalahan. Silakan coba lagi.',
        variant: 'destructive',
      });
    }
  };

  if (authLoading || masterLoading || unitLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <SimpleLayout>
      <div className="max-w-2xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Dashboard
        </Button>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-primary/10">
              <FileText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-card-foreground">Ajukan Proyek Baru</h1>
              <p className="text-muted-foreground">Isi formulir berikut untuk mengajukan proyek strategis</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="master_proyek" className="text-base">Kategori Proyek *</Label>
              <Select
                value={formData.master_proyek_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, master_proyek_id: value }))}
              >
                <SelectTrigger className={`h-12 text-base ${errors.master_proyek_id ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Pilih kategori proyek" />
                </SelectTrigger>
                <SelectContent>
                  {masterProyek.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{mp.name}</span>
                        {mp.description && (
                          <span className="text-xs text-muted-foreground">{mp.description}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.master_proyek_id && <p className="text-sm text-destructive">{errors.master_proyek_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-base">Judul Proyek *</Label>
              <Input
                id="title"
                placeholder="Contoh: Digitalisasi Proses Recruitment"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                maxLength={200}
                className={`h-12 text-base ${errors.title ? 'border-destructive' : ''}`}
              />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              <p className="text-xs text-muted-foreground">{formData.title.length}/200 karakter</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit" className="text-base">Unit Kerja</Label>
              <Input
                id="unit"
                value={formData.unit}
                disabled
                className="h-12 text-base bg-muted"
              />
              <p className="text-xs text-muted-foreground">Unit kerja otomatis sesuai profil Anda</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date" className="text-base">Tanggal Mulai</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  disabled
                  className="h-12 text-base bg-muted"
                />
                <p className="text-xs text-muted-foreground">Otomatis tanggal pengajuan</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date" className="text-base">Target Selesai / Deadline *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  min={formData.start_date}
                  className={`h-12 text-base ${errors.end_date ? 'border-destructive' : ''}`}
                />
                {errors.end_date && <p className="text-sm text-destructive">{errors.end_date}</p>}
              </div>
            </div>

            {/* Urgency Effort */}
            <div className="space-y-2">
              <Label htmlFor="urgency" className="text-base">Emergency Effort / Tingkat Urgensi *</Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => setFormData(prev => ({ ...prev, urgency: value as Urgency }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Pilih tingkat urgensi" />
                </SelectTrigger>
                <SelectContent>
                  {urgencyOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Seberapa mendesak proyek ini perlu ditangani</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">Deskripsi & Latar Belakang *</Label>
              <Textarea
                id="description"
                placeholder="Jelaskan tujuan, ruang lingkup, dan latar belakang masalah yang melatarbelakangi proyek ini..."
                rows={6}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                maxLength={5000}
                className={`text-base ${errors.description ? 'border-destructive' : ''}`}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              <p className="text-xs text-muted-foreground">{formData.description.length}/5000 karakter</p>
            </div>

            {/* File Attachment */}
            <div className="space-y-2">
              <Label className="text-base">File User Requirement & Dokumen Pendukung *</Label>
              <div className={`border-2 border-dashed rounded-lg p-4 ${errors.attachment ? 'border-destructive' : 'border-border'}`}>
                {attachmentFile ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      <span className="text-sm">{attachmentFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(attachmentFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setAttachmentFile(null)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center cursor-pointer">
                    <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">
                      Klik untuk upload file User Requirement (Wajib)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Maksimal 10MB (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX)
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>
              {errors.attachment && <p className="text-sm text-destructive">{errors.attachment}</p>}
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="submit"
                className="flex-1 h-12 text-base"
                disabled={isSubmitting || isUploading}
              >
                {isSubmitting ? 'Mengirim...' : 'Ajukan Proyek'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/')} className="h-12">
                Batal
              </Button>
            </div>
          </form>
        </div>
      </div>
    </SimpleLayout>
  );
}
