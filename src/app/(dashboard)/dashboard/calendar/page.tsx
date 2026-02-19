import { prisma } from '@/lib/db';
import { CalendarClient } from './calendar-client';

export default async function CalendarPage() {
  const cronJobs = await prisma.cronJob.findMany({
    include: {
      agent: {
        select: { id: true, name: true, status: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gradient-warm">
          Scheduled Tasks
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Automated routines and cron job schedules
        </p>
      </div>
      <CalendarClient
        cronJobs={cronJobs.map((j) => ({
          id: j.id,
          name: j.name,
          schedule: j.schedule,
          enabled: j.enabled,
          lastRunAt: j.lastRunAt?.toISOString() ?? null,
          nextRunAt: j.nextRunAt?.toISOString() ?? null,
          agent: j.agent ? { id: j.agent.id, name: j.agent.name } : null,
        }))}
      />
    </div>
  );
}
