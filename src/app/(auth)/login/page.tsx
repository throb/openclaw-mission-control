'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needs2FA, setNeeds2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        totp: needs2FA ? totp : undefined,
        redirect: false,
      });

      if (result?.error) {
        if (result.error === '2FA_REQUIRED') {
          setNeeds2FA(true);
          setError('');
        } else {
          setError(result.error);
        }
      } else if (result?.ok) {
        const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
            <span className="text-2xl">🤖</span>
          </div>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Sign in to BobBot Mission Control
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!needs2FA ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="totp">2FA Code</Label>
                <Input
                  id="totp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  required
                  autoFocus
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="text-center text-2xl tracking-widest font-mono"
                />
                <p className="text-xs text-muted-foreground text-center">
                  Enter the code from your authenticator app
                </p>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive text-center bg-destructive/10 rounded-md p-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : needs2FA ? 'Verify' : 'Sign in'}
            </Button>

            {needs2FA && (
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setNeeds2FA(false);
                  setTotp('');
                }}
              >
                Back to login
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
