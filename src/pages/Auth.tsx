import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User } from 'lucide-react';
import logoImage from '@/assets/logo.jpeg';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  const { signIn, signUp, signInWithGoogle, user, isEmailVerified, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && user) {
      if (isEmailVerified) {
        navigate('/');
      } else {
        navigate('/verification-pending');
      }
    }
  }, [user, loading, isEmailVerified, navigate]);

  const validateGmail = (emailValue: string) => {
    return emailValue.toLowerCase().trim().endsWith('@gmail.com');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateGmail(email)) {
      toast({
        title: 'Email tidak valid',
        description: 'Hanya akun @gmail.com yang diizinkan untuk mengakses sistem ini.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        // Check for unverified email error
        if (
          error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('email_not_confirmed')
        ) {
          sessionStorage.setItem('pendingVerificationEmail', email.trim());
          navigate('/verification-pending', { state: { email: email.trim() } });
          return;
        }
        toast({
          title: 'Gagal masuk',
          description: error.message === 'Invalid login credentials' 
            ? 'Email atau password salah.' 
            : error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: 'Error', description: 'Nama wajib diisi.', variant: 'destructive' });
      return;
    }

    if (!validateGmail(email)) {
      toast({
        title: 'Email tidak valid',
        description: 'Hanya akun @gmail.com yang diizinkan.',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 6) {
      toast({ title: 'Error', description: 'Password minimal 6 karakter.', variant: 'destructive' });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: 'Error', description: 'Password tidak cocok.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await signUp(email.trim(), password, name.trim());
      if (error) {
        toast({
          title: 'Gagal mendaftar',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        // Send welcome email
        try {
          await supabase.functions.invoke('send-welcome-email', {
            body: { email: email.trim(), name: name.trim() },
          });
        } catch (e) {
          console.error('Failed to send welcome email:', e);
        }
        sessionStorage.setItem('pendingVerificationEmail', email.trim());
        navigate('/verification-pending', { state: { email: email.trim() } });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: 'Gagal masuk',
          description: 'Terjadi kesalahan saat masuk dengan Google. Silakan coba lagi.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden">
            <img src={logoImage} alt="SIMAPROS Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">SIMAPROS</CardTitle>
            <CardDescription className="text-base mt-2">
              Sistem Manajemen Proyek Strategis
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'register')}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Masuk</TabsTrigger>
              <TabsTrigger value="register">Daftar</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="space-y-4 mt-4">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="contoh@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Gunakan alamat Gmail Anda</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    'Masuk'
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register" className="space-y-4 mt-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="register-name">Nama Lengkap</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="Nama Anda"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      required
                      maxLength={100}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="contoh@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                      maxLength={255}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Gunakan alamat Gmail Anda</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Minimal 6 karakter"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="register-confirm">Konfirmasi Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-confirm"
                      type="password"
                      placeholder="Ulangi password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    'Daftar'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">atau</span>
            </div>
          </div>

          {/* Google OAuth */}
          <Button 
            onClick={handleGoogleLogin}
            className="w-full h-12 text-base font-semibold gap-3"
            disabled={isSubmitting}
            variant="outline"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Memproses...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {activeTab === 'login' ? 'Masuk dengan Google' : 'Daftar dengan Google'}
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Dengan Google, akun akan otomatis terverifikasi tanpa perlu konfirmasi email
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
