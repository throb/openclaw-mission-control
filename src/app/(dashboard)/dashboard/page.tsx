import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, FolderKanban, Clock, Cpu } from 'lucide-react';

const stats = [
  {
    title: 'Active Agents',
    value: '3',
    description: 'Running tasks',
    icon: Bot,
  },
  {
    title: 'Projects',
    value: '5',
    description: '12 open tasks',
    icon: FolderKanban,
  },
  {
    title: 'Cron Jobs',
    value: '8',
    description: '2 running',
    icon: Clock,
  },
  {
    title: 'Models',
    value: '4',
    description: 'Configured',
    icon: Cpu,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your agent orchestration
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Latest agent actions and task updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            Activity feed will appear here once agents start running
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
