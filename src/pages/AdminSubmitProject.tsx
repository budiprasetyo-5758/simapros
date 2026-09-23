import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, ArrowLeft, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePicOptions } from '@/hooks/usePicOptions';
import { useAuth } from '@/hooks/useAuth';
import { useMasterProyek } from '@/hooks/useMasterProyek';
import { useToast } from '@/hooks/use-toast';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { validateProjectForm } from '@/lib/validations/project';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
export default function AdminSubmitProject() {
  const navigate = useNavigate();
  const {
    user,
    profile,
    isSuperAdmin,
    loading: authLoading
  } = useAuth();
  const {
    masterProyek,
    loading: masterLoading
  } = useMasterProyek();
  const {
    toast
  } = useToast();
  const {
    activePicOptions,
    loading: picLoading
  } = usePicOptions();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    unit: '',
    start_date: '',
    end_date: '',
    master_proyek_id: '',
    requester_name: '',
    pic: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && !isSuperAdmin) {
      navigate('/');
    }
  }, [user, authLoading, isSuperAdmin, navigate]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateProjectForm(formData);
    if (!validation.success) {
      setErrors(validation.errors || {});
      return;
    }
    if (!formData.master_proyek_id) {
      setErrors(prev => ({
        ...prev,
        master_proyek_id: 'Pilih proyek terlebih dahulu'
      }));
      return;
    }
    if (!formData.requester_name.trim()) {
      setErrors(prev => ({
        ...prev,
        requester_name: 'Nama pemohon wajib diisi'
      }));
      return;
    }
    if (!formData.pic) {
      setErrors(prev => ({
        ...prev,
        pic: 'PIC wajib dipilih'
      }));
      return;
    }
    setErrors({});
    setIsSubmitting(true);
    const validatedData = validation.data!;

    // Semua usulan, termasuk yang dibuat atas nama unit oleh Super Admin,
    // wajib melewati penilaian Tier 2 sebelum masuk portofolio eksekusi.
    const {
      error
    } = await supabase.from('projects').insert({
      title: validatedData.title,
      description: validatedData.description,
      unit: formData.unit || 'Unit Default',
      priority: 'medium',
      start_date: validatedData.start_date,
      end_date: validatedData.end_date,
      master_proyek_id: formData.master_proyek_id,
      requester_id: user!.id,
      requester_name: formData.requester_name,
      status: 'pending',
      project_stage: 'planning',
      pic: formData.pic
    });
    setIsSubmitting(false);
    if (!error) {
      toast({
        title: 'Usulan Proyek Berhasil Dibuat',
        description: 'Usulan masuk antrean evaluasi Tier 2 untuk dinilai dan diputuskan.'
      });
      navigate('/approval');
    } else {
      toast({
        title: 'Gagal Membuat Proyek',
        description: error.message || 'Terjadi kesalahan. Silakan coba lagi.',
        variant: 'destructive'
      });
    }
  };
  if (authLoading || masterLoading || picLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>;
  }
  return <SimpleLayout>
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Kembali ke Dashboard
        </Button>

        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-primary/10">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-card-foreground">Pengajuan Proyek (Admin)</h1>
                <Badge variant="secondary" className="text-xs">Super Admin</Badge>
              </div>
              <p className="text-muted-foreground">Catat usulan proyek atas nama unit untuk evaluasi Tier 2</p>
            </div>
          </div>

          <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 mb-6">
            <p className="text-sm text-secondary-foreground">
              <strong>Catatan:</strong> Usulan yang dibuat melalui form ini berstatus <strong>Menunggu Evaluasi</strong>. Proyek baru dapat masuk portofolio setelah scoring K1-K7, pemeriksaan gate, dan keputusan formal dicatat.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="requester_name" className="text-base">Nama Pemohon *</Label>
              <Input id="requester_name" placeholder="Nama user yang meminta proyek ini" value={formData.requester_name} onChange={e => setFormData(prev => ({
              ...prev,
              requester_name: e.target.value
            }))} className={`h-12 text-base ${errors.requester_name ? 'border-destructive' : ''}`} />
              {errors.requester_name && <p className="text-sm text-destructive">{errors.requester_name}</p>}
              <p className="text-xs text-muted-foreground">Masukkan nama user yang meminta pengajuan proyek di luar platform</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pic" className="text-base">PIC (Person In Charge) *</Label>
              <Select value={formData.pic} onValueChange={value => setFormData(prev => ({
              ...prev,
              pic: value
            }))}>
                <SelectTrigger className={`h-12 text-base ${errors.pic ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Pilih PIC" />
                </SelectTrigger>
                <SelectContent>
                  {activePicOptions.map(opt => <SelectItem key={opt.name} value={opt.name}>{opt.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.pic && <p className="text-sm text-destructive">{errors.pic}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="master_proyek" className="text-base">Kategori Proyek *</Label>
              <Select value={formData.master_proyek_id} onValueChange={value => setFormData(prev => ({
              ...prev,
              master_proyek_id: value
            }))}>
                <SelectTrigger className={`h-12 text-base ${errors.master_proyek_id ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Pilih kategori proyek" />
                </SelectTrigger>
                <SelectContent>
                  {masterProyek.map(mp => <SelectItem key={mp.id} value={mp.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{mp.name}</span>
                        {mp.description && <span className="text-xs text-muted-foreground">{mp.description}</span>}
                      </div>
                    </SelectItem>)}
                </SelectContent>
              </Select>
              {errors.master_proyek_id && <p className="text-sm text-destructive">{errors.master_proyek_id}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="title" className="text-base">Judul Proyek *</Label>
              <Input id="title" placeholder="Contoh: Digitalisasi Proses Recruitment" value={formData.title} onChange={e => setFormData(prev => ({
              ...prev,
              title: e.target.value
            }))} maxLength={200} className={`h-12 text-base ${errors.title ? 'border-destructive' : ''}`} />
              {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              <p className="text-xs text-muted-foreground">{formData.title.length}/200 karakter</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit" className="text-base">Unit/Divisi *</Label>
              <Input id="unit" placeholder="Masukkan nama unit/divisi pemohon" value={formData.unit} onChange={e => setFormData(prev => ({
              ...prev,
              unit: e.target.value
            }))} className="h-12 text-base" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date" className="text-base">Tanggal Mulai *</Label>
                <Input id="start_date" type="date" value={formData.start_date} onChange={e => setFormData(prev => ({
                ...prev,
                start_date: e.target.value
              }))} className={`h-12 text-base ${errors.start_date ? 'border-destructive' : ''}`} />
                {errors.start_date && <p className="text-sm text-destructive">{errors.start_date}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date" className="text-base">Tanggal Selesai *</Label>
                <Input id="end_date" type="date" value={formData.end_date} onChange={e => setFormData(prev => ({
                ...prev,
                end_date: e.target.value
              }))} className={`h-12 text-base ${errors.end_date ? 'border-destructive' : ''}`} />
                {errors.end_date && <p className="text-sm text-destructive">{errors.end_date}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">Deskripsi & Latar Belakang *</Label>
              <Textarea id="description" placeholder="Jelaskan tujuan, ruang lingkup, dan latar belakang masalah yang melatarbelakangi proyek ini..." rows={6} value={formData.description} onChange={e => setFormData(prev => ({
              ...prev,
              description: e.target.value
            }))} maxLength={5000} className={`text-base ${errors.description ? 'border-destructive' : ''}`} />
              {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              <p className="text-xs text-muted-foreground">{formData.description.length}/5000 karakter</p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1 h-12 text-base" disabled={isSubmitting}>
                {isSubmitting ? 'Membuat Usulan...' : 'Buat & Evaluasi Usulan'}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/')} className="h-12">
                Batal
              </Button>
            </div>
          </form>
        </div>
      </div>
    </SimpleLayout>;
}
