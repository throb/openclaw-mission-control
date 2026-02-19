import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { AgentDetailClient } from '@/components/agents/agent-detail-client';

interface AgentDetailPageProps {
  params: { id: string };
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const [agent, availableModels, discordChannels] = await Promise.all([
    prisma.agent.findUnique({
      where: { id: params.id },
      include: {
        model: {
          select: { id: true, provider: true, modelId: true, displayName: true },
        },
        discordChannel: {
          select: { id: true, channelId: true, name: true },
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
    }),
    prisma.aIModel.findMany({
      select: { id: true, provider: true, modelId: true, displayName: true },
      orderBy: [{ provider: 'asc' }, { displayName: 'asc' }],
    }),
    prisma.discordChannel.findMany({
      select: { id: true, channelId: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!agent) {
    notFound();
  }

  // Get distinct file paths with their latest versions
  const allFileVersions = await prisma.fileVersion.findMany({
    where: { agentId: params.id },
    orderBy: { createdAt: 'desc' },
  });

  // Group by filePath and get latest for each
  const fileMap = new Map<
    string,
    {
      filePath: string;
      content: string;
      latestVersionId: string;
      message: string | null;
      updatedAt: Date;
    }
  >();

  for (const fv of allFileVersions) {
    if (!fileMap.has(fv.filePath)) {
      fileMap.set(fv.filePath, {
        filePath: fv.filePath,
        content: fv.content,
        latestVersionId: fv.id,
        message: fv.message,
        updatedAt: fv.createdAt,
      });
    }
  }

  const files = Array.from(fileMap.values());

  return (
    <AgentDetailClient
      agent={{
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.status,
        modelId: agent.modelId,
        model: agent.model,
        discordChannelId: agent.discordChannelId,
        discordChannel: agent.discordChannel,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
        _count: agent._count,
      }}
      initialFiles={files.map((f) => ({
        ...f,
        updatedAt: f.updatedAt.toISOString(),
      }))}
      availableModels={availableModels}
      discordChannels={discordChannels}
    />
  );
}
