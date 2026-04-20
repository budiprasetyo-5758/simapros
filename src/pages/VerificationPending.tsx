import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Mail, ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import logoImage from '@/assets/logo.jpeg';

export default function VerificationPending() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isEmailVerified, resendVerification, loading } = useAuth();
  const { toast } = useToast();
  const [isResending, setIsResending] = useState(false);
  const [emailInput, setEmailInput] = useState('');

  // Get email from navigation state, user object, or sessionStorage
  const stateEmail = (location.state as { email?: string })?.email;
  const storedEmail = sessionStorage.getItem('pendingVerificationEmail');
  const email = stateEmail || user?.email || storedEmail || '';

  // If already verified, redirect to home
  useEffect(() => {
    if (!loading && user && isEmailVerified) {
      sessionStorage.removeItem('pendingVerificationEmail');
      navigate('/');
    }
  }, [loading, user, isEmailVerified, navigate]);

  const handleResend = async () => {
    const targetEmail = email || emailInput.trim();
    if (!targetEmail) {
      toast({
        title: 'Email diperlukan',
        description: 'Masukkan email Anda untuk mengirim ulang verifikasi.',
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    try {
      const { error } = await resendVerification(targetEmail);
      if (error) {
        toast({
          title: 'Gagal mengirim ulang',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Email terkirim',
          description: 'Email verifikasi telah dikirim ulang. Periksa inbox Anda.',
        });
      }
    } finally {
      setIsResending(false);
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
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Verifikasi Email Anda</CardTitle>
            <CardDescription className="mt-2">
              {email ? (
                <>
                  Kami telah mengirim email verifikasi ke{' '}
                  <strong className="text-foreground">{email}</strong>.
                  Klik link di email tersebut untuk mengaktifkan akun Anda.
                </>
              ) : (
                'Akun Anda belum terverifikasi. Silakan periksa email atau kirim ulang verifikasi.'
              )}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground space-y-1">
            <p>📧 Periksa folder inbox dan spam di email Anda</p>
            <p>⏳ Link verifikasi berlaku selama 24 jam</p>
            <p>🔄 Setelah verifikasi, Anda bisa langsung login</p>
          </div>

          {/* Email input fallback if no email is available */}
          {!email && (
            <div className="space-y-2">
              <Label htmlFor="verify-email">Email Anda</Label>
              <Input
                id="verify-email"
                type="email"
                placeholder="contoh@gmail.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
            </div>
          )}

          <Button
            onClick={handleResend}
            variant="outline"
            className="w-full gap-2"
            disabled={isResending || (!email && !emailInput.trim())}
          >
            {isResending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Kirim Ulang Email Verifikasi
          </Button>

          <Button
            variant="ghost"
            className="w-full gap-2"
            onClick={() => {
              sessionStorage.removeItem('pendingVerificationEmail');
              navigate('/auth');
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Halaman Login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
