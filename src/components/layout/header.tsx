'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogOut, Shield } from 'lucide-react';

interface HeaderProps {
  user: {
    email: string;
    totpVerified: boolean;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Breadcrumb or page title will go here */}
      </div>

      <div className="flex items-center gap-4">
        {/* 2FA status indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4 text-green-500" />
          <span>2FA Active</span>
        </div>

        {/* User info */}
        <div className="text-sm">
          <span className="text-muted-foreground">{user.email}</span>
        </div>

        {/* Sign out */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
