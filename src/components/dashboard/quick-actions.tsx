'use client';

import Link from 'next/link';
import { Plus, Bot, Clock, Cpu, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const actions = [
  {
    label: 'New Task',
    href: '/dashboard/projects',
    icon: Plus,
    primary: true,
  },
  {
    label: 'View Agents',
    href: '/dashboard/agents',
    icon: Bot,
    primary: false,
  },
  {
    label: 'Cron Jobs',
    href: '/dashboard/cron',
    icon: Clock,
    primary: false,
  },
  {
    label: 'Models',
    href: '/dashboard/models',
    icon: Cpu,
    primary: false,
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    primary: false,
  },
];

export function QuickActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className={cn(
              'inline-flex items-center gap-2 rounded-full text-sm font-medium px-4 py-2 transition-colors',
              action.primary
                ? 'bg-primary/10 text-primary hover:bg-primary/20'
                : 'bg-card hover:bg-card/80 border border-border'
            )}
          >
            <Icon className="h-4 w-4" />
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
