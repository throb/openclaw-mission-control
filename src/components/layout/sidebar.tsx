'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  Bot,
  FolderKanban,
  Clock,
  Cpu,
  Settings,
  LayoutDashboard,
  Zap,
  Calendar,
  Brain,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban },
  { name: 'Agents', href: '/dashboard/agents', icon: Bot },
  { name: 'Calendar', href: '/dashboard/calendar', icon: Calendar },
  { name: 'Memory', href: '/dashboard/memory', icon: Brain },
  { name: 'Cron Jobs', href: '/dashboard/cron', icon: Clock },
  { name: 'Skills', href: '/dashboard/skills', icon: Zap },
  { name: 'Models', href: '/dashboard/models', icon: Cpu },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 flex flex-col" style={{ background: 'hsl(var(--sidebar-bg))' }}>
      {/* Logo */}
      <div className="h-14 flex items-center px-6" style={{ borderBottom: '1px solid hsl(var(--sidebar-border))' }}>
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-gold flex items-center justify-center shadow-lg shadow-primary/15 group-hover:shadow-primary/30 transition-shadow">
            <Bot className="w-4 h-4 text-background" />
          </div>
          <span className="font-semibold text-lg text-gradient-warm">BobBot</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'sidebar-active text-ice border border-primary/15'
                  : 'text-ice/50 hover:text-ice/80 hover:bg-white/[0.03] border border-transparent'
              )}
            >
              <item.icon className={cn('w-[18px] h-[18px]', isActive ? 'text-primary' : 'text-ice/40')} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
        <div className="text-xs">
          <p className="font-medium text-gradient-gold">Mission Control v0.1.0</p>
          <p className="mt-1 text-ice/30">Port 18742</p>
        </div>
      </div>
    </aside>
  );
}
