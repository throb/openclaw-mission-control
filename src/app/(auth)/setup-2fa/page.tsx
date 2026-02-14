'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Setup2FAPage() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Generate 2FA secret on mount
    async function generateSecret() {
      try {
        const res = await fetch('/api/auth/2fa/generate', { method: 'POST' });
        const data = await res.json();
        if (data.qrCode && data.secret) {
          setQrCode(data.qrCode);
          setSecret(data.secret);
        }
      } catch (err) {
        setError('Failed to generate 2FA secret');
      }
    }
    generateSecret();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });

      const data = await res.json();

      if (data.success) {
        // Update session and redirect
        await update();
        router.push('/dashboard');
      } else {
        setError(data.error || 'Invalid verification code');
      }
    } catch (err) {
      setError('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-4">
            <span className="text-2xl">🔐</span>
          </div>
          <CardTitle>Set Up 2FA</CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            {qrCode ? (
              <div className="p-4 bg-white rounded-lg">
                <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
              </div>
            ) : (
              <div className="w-48 h-48 bg-muted rounded-lg animate-pulse" />
            )}
          </div>

          {/* Manual entry */}
          <div className="text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Or enter this code manually:
            </p>
            <code className="text-sm bg-muted px-3 py-1 rounded font-mono">
              {secret || '...'}
            </code>
          </div>

          {/* Verification form */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                placeholder="Enter 6-digit code"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                required
                maxLength={6}
                pattern="[0-9]{6}"
                className="text-center text-2xl tracking-widest font-mono"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive text-center bg-destructive/10 rounded-md p-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !secret}>
              {loading ? 'Verifying...' : 'Enable 2FA'}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            Use Google Authenticator, Authy, or any TOTP-compatible app
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
