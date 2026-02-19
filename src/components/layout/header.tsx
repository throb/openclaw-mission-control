'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface HeaderProps {
  user: {
    email: string;
  };
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="h-14 border-b border-border/50 bg-background/60 backdrop-blur-sm flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {/* Breadcrumb or page title will go here */}
      </div>

      <div className="flex items-center gap-4">
        {/* User info */}
        <div className="text-sm">
          <span className="text-muted-foreground">{user.email}</span>
        </div>

        {/* Sign out */}
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-primary"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
