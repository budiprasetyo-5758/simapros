import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useUnitKerja } from '@/hooks/useUnitKerja';
import { supabase } from '@/integrations/supabase/client';
import { SimpleLayout } from '@/components/layout/SimpleLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { User, Phone, Mail, Building2, AlertCircle, Clock, CheckCircle, XCircle, Lock, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExtendedProfile {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  gmail: string | null;
  unit_kerja_id: string | null;
  profile_completed: boolean;
  gmail_verified: boolean;
}

interface UnitKerjaChangeRequest {
  id: string;
  current_unit_kerja_id: string | null;
  requested_unit_kerja_id: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
}

export default function EditProfile() {
  const navigate = useNavigate();
  const { user, profile, loading: authLoading, updateEmail } = useAuth();
  const { loading: profileLoading } = useProfile();
  const { unitKerja, loading: unitLoading } = useUnitKerja();
  const { toast } = useToast();

  const [extendedProfile, setExtendedProfile] = useState<ExtendedProfile | null>(null);
  const [name, setName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [unitKerjaId, setUnitKerjaId] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Unit Kerja change request state
  const [pendingRequest, setPendingRequest] = useState<UnitKerjaChangeRequest | null>(null);
  const [showChangeRequestForm, setShowChangeRequestForm] = useState(false);
  const [newUnitKerjaId, setNewUnitKerjaId] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [showEmailChangeForm, setShowEmailChangeForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  
  // Gmail verification state
  const [gmailInput, setGmailInput] = useState('');
  const [gmailVerified, setGmailVerified] = useState(false);
  const [showGmailVerify, setShowGmailVerify] = useState(false);
  const [gmailOtp, setGmailOtp] = useState('');
  const [isSendingGmailCode, setIsSendingGmailCode] = useState(false);
  const [isVerifyingGmail, setIsVerifyingGmail] = useState(false);
  const [gmailCodeSent, setGmailCodeSent] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const fetchExtendedProfile = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name, email, whatsapp, gmail, unit_kerja_id, profile_completed, gmail_verified')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        
        setExtendedProfile(data);
        setName(data.name || '');
        setWhatsapp(data.whatsapp || '');
        setUnitKerjaId(data.unit_kerja_id || '');
        setGmailInput(data.gmail || '');
        setGmailVerified(data.gmail_verified || false);
        setIsNewUser(!data.profile_completed);
      } catch (error) {
        console.error('Error fetching extended profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchExtendedProfile();
  }, [user]);

  // Fetch pending unit kerja change request
  useEffect(() => {
    const fetchPendingRequest = async () => {
      if (!user || isNewUser) return;
      
      try {
        const { data, error } = await supabase
          .from('unit_kerja_change_requests')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .maybeSingle();

        if (error) throw error;
        if (data) {
          setPendingRequest(data as UnitKerjaChangeRequest);
        }
      } catch (error) {
        console.error('Error fetching pending request:', error);
      }
    };

    fetchPendingRequest();
  }, [user, isNewUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation for new users
    if (isNewUser && !unitKerjaId) {
      toast({
        title: 'Error',
        description: 'Unit Kerja wajib diisi untuk melanjutkan',
        variant: 'destructive',
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Nama wajib diisi',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: name.trim(),
          whatsapp: whatsapp || null,
          unit_kerja_id: unitKerjaId || null,
          profile_completed: true,
        })
        .eq('id', user!.id);

      if (error) throw error;

      toast({
        title: 'Profil Diperbarui',
        description: 'Data profil Anda berhasil diperbarui.'
      });

      // If new user completing profile, redirect to home
      if (isNewUser) {
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: 'Gagal memperbarui profil.',
        variant: 'destructive'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitChangeRequest = async () => {
    if (!newUnitKerjaId || !user) return;
    
    setIsSubmittingRequest(true);
    try {
      const { error } = await supabase
        .from('unit_kerja_change_requests')
        .insert({
          user_id: user.id,
          current_unit_kerja_id: extendedProfile?.unit_kerja_id || null,
          requested_unit_kerja_id: newUnitKerjaId,
          reason: changeReason || null,
        });

      if (error) throw error;

      toast({
        title: 'Permintaan Terkirim',
        description: 'Permintaan perubahan Unit Kerja telah dikirim dan menunggu persetujuan Super Admin.'
      });

      // Refresh pending request
      const { data: newRequest } = await supabase
        .from('unit_kerja_change_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();
      
      if (newRequest) {
        setPendingRequest(newRequest as UnitKerjaChangeRequest);
      }
      setShowChangeRequestForm(false);
      setNewUnitKerjaId('');
      setChangeReason('');
    } catch (error) {
      console.error('Error submitting change request:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengirim permintaan. Silakan coba lagi.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  const handleEmailChange = async () => {
    if (!newEmail.toLowerCase().trim().endsWith('@gmail.com')) {
      toast({
        title: 'Email tidak valid',
        description: 'Hanya akun @gmail.com yang diizinkan.',
        variant: 'destructive',
      });
      return;
    }

    setIsChangingEmail(true);
    try {
      const { error } = await updateEmail(newEmail.trim());
      if (error) {
        toast({
          title: 'Gagal mengubah email',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Verifikasi dikirim',
          description: `Link verifikasi telah dikirim ke ${newEmail.trim()}. Klik link tersebut untuk mengkonfirmasi perubahan.`,
        });
        setShowEmailChangeForm(false);
        setNewEmail('');
      }
    } finally {
      setIsChangingEmail(false);
    }
  };

  if (authLoading || loadingProfile || unitLoading) {
    return (
      <SimpleLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </SimpleLayout>
    );
  }

  // Get current unit kerja name
  const currentUnitKerja = unitKerja.find(u => u.id === unitKerjaId);
  const requestedUnitKerja = pendingRequest ? unitKerja.find(u => u.id === pendingRequest.requested_unit_kerja_id) : null;
  const hasUnitKerjaSet = !!extendedProfile?.unit_kerja_id && !isNewUser;

  return (
    <SimpleLayout>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {isNewUser ? 'Lengkapi Profil Anda' : 'Edit Profil'}
            </CardTitle>
            <CardDescription>
              {isNewUser 
                ? 'Silakan lengkapi data profil Anda sebelum melanjutkan'
                : 'Perbarui informasi profil Anda'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isNewUser && (
              <Alert className="mb-6">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Anda perlu melengkapi profil terlebih dahulu sebelum dapat menggunakan aplikasi.
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info (Read-only) */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nama
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama lengkap Anda"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Email (Akun)</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={extendedProfile?.email || ''} 
                      disabled 
                      className="bg-muted flex-1"
                    />
                    {!showEmailChangeForm && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowEmailChangeForm(true)}
                      >
                        Ubah Email
                      </Button>
                    )}
                  </div>
                  
                  {showEmailChangeForm && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30 mt-2">
                      <h4 className="font-medium text-sm">Ubah Email</h4>
                      <div className="space-y-2">
                        <Label>Email Baru</Label>
                        <Input
                          type="email"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="emailbaru@gmail.com"
                          maxLength={255}
                        />
                        <p className="text-xs text-muted-foreground">
                          Hanya akun @gmail.com yang diizinkan
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleEmailChange}
                          disabled={!newEmail || isChangingEmail}
                        >
                          {isChangingEmail ? 'Mengirim...' : 'Kirim Verifikasi'}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => { setShowEmailChangeForm(false); setNewEmail(''); }}
                        >
                          Batal
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Link verifikasi akan dikirim ke email baru. Email lama tetap aktif sampai email baru diverifikasi.
                      </p>
                    </div>
                  )}
                  
                  {!showEmailChangeForm && (
                    <p className="text-xs text-muted-foreground">
                      Klik "Ubah Email" untuk mengganti email akun Anda
                    </p>
                  )}
                </div>
              </div>

              <div className="border-t pt-6" />

              {/* Editable Fields */}
              <div className="space-y-4">
                {/* Unit Kerja */}
                <div className="space-y-2">
                  <Label htmlFor="unit_kerja" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Unit Kerja {isNewUser && <span className="text-destructive">*</span>}
                  </Label>
                  
                  {/* New user - can select unit kerja */}
                  {isNewUser ? (
                    <>
                      <Select
                        value={unitKerjaId}
                        onValueChange={setUnitKerjaId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih unit kerja" />
                        </SelectTrigger>
                        <SelectContent>
                          {unitKerja.map((unit) => (
                            <SelectItem key={unit.id} value={unit.id}>
                              {unit.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {unitKerja.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Belum ada unit kerja. Hubungi administrator.
                        </p>
                      )}
                    </>
                  ) : (
                    /* Existing user - unit kerja is locked, must request change */
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Input 
                          value={currentUnitKerja?.name || 'Belum dipilih'} 
                          disabled 
                          className="bg-muted flex-1"
                        />
                        {!pendingRequest && !showChangeRequestForm && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowChangeRequestForm(true)}
                          >
                            Ajukan Perubahan
                          </Button>
                        )}
                      </div>
                      
                      {hasUnitKerjaSet && !pendingRequest && !showChangeRequestForm && (
                        <p className="text-xs text-muted-foreground">
                          Unit Kerja hanya dapat diubah dengan persetujuan Super Admin
                        </p>
                      )}

                      {/* Pending request info */}
                      {pendingRequest && (
                        <Alert className="border-warning/50 bg-warning/10">
                          <Clock className="h-4 w-4 text-warning" />
                          <AlertDescription>
                            <div className="space-y-1">
                              <p className="font-medium text-warning">Menunggu Persetujuan</p>
                              <p className="text-sm">
                                Anda telah mengajukan perubahan ke: <strong>{requestedUnitKerja?.name}</strong>
                              </p>
                              {pendingRequest.reason && (
                                <p className="text-xs text-muted-foreground">
                                  Alasan: {pendingRequest.reason}
                                </p>
                              )}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Change request form */}
                      {showChangeRequestForm && !pendingRequest && (
                        <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
                          <h4 className="font-medium text-sm">Ajukan Perubahan Unit Kerja</h4>
                          
                          <div className="space-y-2">
                            <Label>Unit Kerja Baru</Label>
                            <Select
                              value={newUnitKerjaId}
                              onValueChange={setNewUnitKerjaId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih unit kerja baru" />
                              </SelectTrigger>
                              <SelectContent>
                                {unitKerja
                                  .filter(u => u.id !== extendedProfile?.unit_kerja_id)
                                  .map((unit) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      {unit.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Alasan Perubahan (Opsional)</Label>
                            <Textarea
                              value={changeReason}
                              onChange={(e) => setChangeReason(e.target.value)}
                              placeholder="Jelaskan alasan perubahan unit kerja..."
                              rows={3}
                            />
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={handleSubmitChangeRequest}
                              disabled={!newUnitKerjaId || isSubmittingRequest}
                              size="sm"
                            >
                              {isSubmittingRequest ? 'Mengirim...' : 'Kirim Permintaan'}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowChangeRequestForm(false);
                                setNewUnitKerjaId('');
                                setChangeReason('');
                              }}
                            >
                              Batal
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    No. WhatsApp
                  </Label>
                  <Input
                    id="whatsapp"
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gmail" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Gmail (untuk Notifikasi)
                    {gmailVerified && gmailInput && (
                      <Badge variant="default" className="gap-1 text-xs">
                        <CheckCircle className="h-3 w-3" />
                        Terverifikasi
                      </Badge>
                    )}
                    {!gmailVerified && gmailInput && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <XCircle className="h-3 w-3" />
                        Belum Terverifikasi
                      </Badge>
                    )}
                  </Label>

                  {/* Quick connect: use account email if it's @gmail.com */}
                  {!gmailVerified && extendedProfile?.email?.toLowerCase().endsWith('@gmail.com') && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full gap-2"
                      onClick={async () => {
                        const accountEmail = extendedProfile.email!;
                        setGmailInput(accountEmail);
                        try {
                          const { error } = await supabase
                            .from('profiles')
                            .update({
                              gmail: accountEmail,
                              gmail_verified: true,
                              gmail_verification_code: null,
                              gmail_verification_expires_at: null,
                            })
                            .eq('id', user!.id);
                          if (error) throw error;
                          setGmailVerified(true);
                          // Send welcome notification email
                          await supabase.functions.invoke('verify-gmail', {
                            body: { action: 'welcome', gmail: accountEmail },
                          });
                          toast({
                            title: 'Gmail Terhubung',
                            description: `${accountEmail} berhasil terhubung. Cek inbox untuk email konfirmasi.`,
                          });
                        } catch (err: any) {
                          toast({ title: 'Gagal', description: err.message, variant: 'destructive' });
                        }
                      }}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                      Hubungkan {extendedProfile.email}
                    </Button>
                  )}

                  {/* Manual Gmail input */}
                  <div className="flex items-center gap-2">
                    <Input
                      id="gmail"
                      type="email"
                      value={gmailInput}
                      onChange={(e) => {
                        setGmailInput(e.target.value);
                        if (e.target.value !== extendedProfile?.gmail) {
                          setGmailVerified(false);
                          setGmailCodeSent(false);
                          setGmailOtp('');
                        }
                      }}
                      placeholder="nama@gmail.com"
                      className="flex-1"
                    />
                    {!gmailVerified && gmailInput && gmailInput.toLowerCase().endsWith('@gmail.com') && gmailInput.toLowerCase() !== extendedProfile?.email?.toLowerCase() && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          setIsSendingGmailCode(true);
                          try {
                            const { data, error } = await supabase.functions.invoke('verify-gmail', {
                              body: { action: 'send', gmail: gmailInput.trim() },
                            });
                            if (error) throw error;
                            if (data?.error) throw new Error(data.error);
                            setGmailCodeSent(true);
                            setShowGmailVerify(true);
                            toast({
                              title: 'Kode Terkirim',
                              description: `Kode verifikasi telah dikirim ke ${gmailInput.trim()}`,
                            });
                          } catch (err: any) {
                            toast({
                              title: 'Gagal',
                              description: err.message || 'Gagal mengirim kode verifikasi',
                              variant: 'destructive',
                            });
                          } finally {
                            setIsSendingGmailCode(false);
                          }
                        }}
                        disabled={isSendingGmailCode}
                      >
                        {isSendingGmailCode ? 'Mengirim...' : (gmailCodeSent ? 'Kirim Ulang' : 'Verifikasi OTP')}
                      </Button>
                    )}
                  </div>

                  {/* OTP Input for different Gmail */}
                  {showGmailVerify && !gmailVerified && (
                    <div className="border rounded-lg p-4 space-y-3 bg-muted/30 mt-2">
                      <h4 className="font-medium text-sm">Masukkan Kode Verifikasi</h4>
                      <p className="text-xs text-muted-foreground">
                        Cek inbox Gmail Anda untuk kode 6-digit. Kode berlaku 10 menit.
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          value={gmailOtp}
                          onChange={(e) => setGmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          maxLength={6}
                          className="w-32 text-center tracking-widest font-mono text-lg"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={async () => {
                            setIsVerifyingGmail(true);
                            try {
                              const { data, error } = await supabase.functions.invoke('verify-gmail', {
                                body: { action: 'verify', code: gmailOtp },
                              });
                              if (error) throw error;
                              if (data?.error) throw new Error(data.error);
                              setGmailVerified(true);
                              setShowGmailVerify(false);
                              setGmailOtp('');
                              toast({
                                title: 'Gmail Terverifikasi',
                                description: 'Alamat Gmail Anda berhasil diverifikasi.',
                              });
                            } catch (err: any) {
                              toast({
                                title: 'Gagal',
                                description: err.message || 'Kode verifikasi salah',
                                variant: 'destructive',
                              });
                            } finally {
                              setIsVerifyingGmail(false);
                            }
                          }}
                          disabled={gmailOtp.length !== 6 || isVerifyingGmail}
                        >
                          {isVerifyingGmail ? 'Memverifikasi...' : 'Konfirmasi'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => { setShowGmailVerify(false); setGmailOtp(''); }}
                        >
                          Batal
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    {gmailVerified 
                      ? 'Gmail terverifikasi — notifikasi email akan dikirim ke alamat ini' 
                      : 'Hubungkan Gmail untuk menerima notifikasi email dari SIMAPROS'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Button 
                  type="submit" 
                  disabled={isSaving || (isNewUser && !unitKerjaId)}
                  className="flex-1"
                >
                  {isSaving ? 'Menyimpan...' : (isNewUser ? 'Lanjutkan' : 'Simpan Perubahan')}
                </Button>
                {!isNewUser && (
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => navigate(-1)}
                  >
                    Batal
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        {!isNewUser && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5" />
                Ubah Password
              </CardTitle>
              <CardDescription>
                Perbarui password akun Anda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password Baru</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      minLength={6}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi password baru"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (newPassword.length < 6) {
                      toast({ title: 'Error', description: 'Password minimal 6 karakter', variant: 'destructive' });
                      return;
                    }
                    if (newPassword !== confirmPassword) {
                      toast({ title: 'Error', description: 'Konfirmasi password tidak cocok', variant: 'destructive' });
                      return;
                    }
                    setIsChangingPassword(true);
                    try {
                      const { error } = await supabase.auth.updateUser({ password: newPassword });
                      if (error) throw error;
                      toast({ title: 'Berhasil', description: 'Password berhasil diubah.' });
                      setNewPassword('');
                      setConfirmPassword('');
                    } catch (err: any) {
                      toast({ title: 'Gagal', description: err.message || 'Gagal mengubah password', variant: 'destructive' });
                    } finally {
                      setIsChangingPassword(false);
                    }
                  }}
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                >
                  {isChangingPassword ? 'Menyimpan...' : 'Ubah Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </SimpleLayout>
  );
}
