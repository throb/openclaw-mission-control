import { prisma } from '@/lib/db';
import { AgentListClient } from '@/components/agents/agent-list-client';

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({
    include: {
      model: {
        select: { id: true, provider: true, modelId: true, displayName: true },
      },
      _count: {
        select: {
          tasks: true,
          fileVersions: true,
          cronJobs: true,
          projects: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="space-y-6">
      <AgentListClient initialAgents={agents} />
    </div>
  );
}
