import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Edit3, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useToast } from '@/hooks/use-toast';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { validateProjectForm } from '@/lib/validations/project';

export default function EditProject() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { projects, resubmitProject, loading: projectsLoading } = useProjects();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const project = projects.find(p => p.id === id);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    unit: '',
    start_date: '',
    end_date: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (project) {
      setFormData({
        title: project.title,
        description: project.description,
        unit: project.unit,
        start_date: project.start_date || '',
        end_date: project.end_date || '',
      });
    }
  }, [project]);

  if (authLoading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!project) {
    return (
      <SimpleLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Proyek tidak ditemukan</p>
          <Button onClick={() => navigate('/')} className="mt-4">Kembali ke Dashboard</Button>
        </div>
      </SimpleLayout>
    );
  }

  if (project.status !== 'revision') {
    return (
      <SimpleLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Hanya proyek dengan status Revisi yang dapat diedit</p>
          <Button onClick={() => navigate('/')} className="mt-4">Kembali ke Dashboard</Button>
        </div>
      </SimpleLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateProjectForm(formData);
    
    if (!validation.success) {
      setErrors(validation.errors || {});
      return;
    }
    
    setErrors({});
    setIsSubmitting(true);
    
    const validatedData = validation.data!;
    const result = await resubmitProject(project.id, {
      title: validatedData.title,
      description: validatedData.description,
      unit: validatedData.unit,
      start_date: validatedData.start_date,
      end_date: validatedData.end_date,
    });
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: 'Pengajuan Kembali Berhasil',
        description: 'Inisiatif Anda telah dikirim ulang dan menunggu approval.',
      });
      navigate('/');
    } else {
      toast({
        title: 'Gagal Mengajukan',
        description: 'Terjadi kesalahan. Silakan coba lagi.',
        variant: 'destructive',
      });
    }
  };

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

        {/* Admin Note */}
        {project.admin_note && (
          <div className="bg-revision/5 border border-revision/20 rounded-2xl p-4 mb-6">
            <h3 className="font-medium text-revision mb-1">Catatan Admin (Perlu Diperhatikan)</h3>
            <p className="text-revision">{project.admin_note}</p>
          </div>
        )}

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-revision/10">
              <Edit3 className="w-6 h-6 text-revision" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-card-foreground">Edit & Ajukan Kembali</h1>
              <p className="text-muted-foreground">Perbaiki proposal sesuai catatan admin</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base">Judul Inisiatif *</Label>
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
              <Label htmlFor="unit" className="text-base">Unit/Divisi *</Label>
              <Input
                id="unit"
                placeholder="Contoh: IT Department"
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                maxLength={100}
                className={`h-12 text-base ${errors.unit ? 'border-destructive' : ''}`}
              />
              {errors.unit && <p className="text-sm text-destructive">{errors.unit}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date" className="text-base">Tanggal Mulai *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  className={`h-12 text-base ${errors.start_date ? 'border-destructive' : ''}`}
                />
                {errors.start_date && <p className="text-sm text-destructive">{errors.start_date}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date" className="text-base">Tanggal Selesai *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  className={`h-12 text-base ${errors.end_date ? 'border-destructive' : ''}`}
                />
                {errors.end_date && <p className="text-sm text-destructive">{errors.end_date}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">Deskripsi & Latar Belakang *</Label>
              <Textarea
                id="description"
                placeholder="Jelaskan tujuan, ruang lingkup, dan latar belakang masalah..."
                rows={6}
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                maxLength={5000}
                className={`text-base ${errors.description ? 'border-destructive' : ''}`}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              <p className="text-xs text-muted-foreground">{formData.description.length}/5000 karakter</p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1 h-12 text-base" disabled={isSubmitting}>
                {isSubmitting ? 'Mengirim...' : 'Ajukan Kembali'}
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
