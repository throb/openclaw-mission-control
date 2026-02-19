import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

interface ModelKeyInfo {
  apiKey: string;
  model: { id: string; provider: string; modelId: string; displayName: string };
}

/**
 * Get a decrypted API key for a given model.
 * Falls back through: specific model -> default model with key -> any model with key.
 */
export async function getApiKeyForModel(modelId?: string | null): Promise<ModelKeyInfo | null> {
  // Try the specific model first
  if (modelId) {
    const model = await prisma.aIModel.findUnique({
      where: { id: modelId },
    });
    if (model?.apiKeyEncrypted) {
      return {
        apiKey: decrypt(model.apiKeyEncrypted),
        model: {
          id: model.id,
          provider: model.provider,
          modelId: model.modelId,
          displayName: model.displayName,
        },
      };
    }
  }

  // Fallback: find any default model with a key
  const defaultModel = await prisma.aIModel.findFirst({
    where: {
      apiKeyEncrypted: { not: null },
      isDefault: true,
    },
  });

  if (defaultModel?.apiKeyEncrypted) {
    return {
      apiKey: decrypt(defaultModel.apiKeyEncrypted),
      model: {
        id: defaultModel.id,
        provider: defaultModel.provider,
        modelId: defaultModel.modelId,
        displayName: defaultModel.displayName,
      },
    };
  }

  // Last resort: any model with a key
  const anyModel = await prisma.aIModel.findFirst({
    where: {
      apiKeyEncrypted: { not: null },
    },
  });

  if (anyModel?.apiKeyEncrypted) {
    return {
      apiKey: decrypt(anyModel.apiKeyEncrypted),
      model: {
        id: anyModel.id,
        provider: anyModel.provider,
        modelId: anyModel.modelId,
        displayName: anyModel.displayName,
      },
    };
  }

  return null;
}

/**
 * Provider-specific base URLs for OpenAI-compatible APIs.
 */
const PROVIDER_BASE_URLS: Record<string, string> = {
  xai: 'https://api.x.ai/v1',
  openai: 'https://api.openai.com/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai',
};

/**
 * Call a chat completion using the appropriate provider API.
 * Anthropic uses its native SDK; all others use the OpenAI-compatible chat/completions endpoint.
 */
async function chatCompletion(
  keyInfo: ModelKeyInfo,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 4096
): Promise<string> {
  const { apiKey, model } = keyInfo;

  if (model.provider === 'anthropic') {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: model.modelId,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI model');
    }
    return textContent.text;
  }

  // OpenAI-compatible API (xAI, OpenAI, etc.)
  const baseUrl = PROVIDER_BASE_URLS[model.provider] || PROVIDER_BASE_URLS.openai;
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model.modelId,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${model.provider} API error (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('No text response from AI model');
  }
  return text;
}

/**
 * Generate agent files based on a description.
 * Returns an array of { filePath, content } objects.
 */
export async function generateAgentFiles(
  agentName: string,
  agentDescription: string,
  modelId?: string | null
): Promise<{ filePath: string; content: string }[]> {
  const keyInfo = await getApiKeyForModel(modelId);
  if (!keyInfo) {
    throw new Error('No AI model with an API key is configured. Add an API key in Settings > Models.');
  }

  const systemPrompt = `You are an expert at designing AI agent configurations for the OpenClaw agent orchestration system.
When given an agent name and description, generate a set of markdown configuration files that define the agent's behavior, personality, capabilities, and operational parameters.

Output your response as a JSON array of objects with "filePath" and "content" fields. Each file should be a well-structured markdown document.

Common files to generate:
- agent.md: Core agent definition with role, capabilities, and behavior guidelines
- SOUL.md: The agent's personality, tone, values, and communication style
- MEMORY.md: Initial memory/context the agent should have
- runbooks/main.md: Standard operating procedures

Only generate files that make sense for the described agent. Keep content practical and actionable, not boilerplate.
Respond ONLY with the JSON array, no other text.`;

  const userMessage = `Generate configuration files for an agent named "${agentName}" with the following description:\n\n${agentDescription}`;

  const responseText = await chatCompletion(keyInfo, systemPrompt, userMessage);

  // Parse the JSON response - handle potential markdown code blocks
  let jsonStr = responseText.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  const files: { filePath: string; content: string }[] = JSON.parse(jsonStr);

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('AI model returned invalid file data');
  }

  return files;
}

/**
 * Analyze an agent's files and return insights.
 */
export async function analyzeAgentFiles(
  agentName: string,
  files: { filePath: string; content: string }[],
  modelId?: string | null,
  prompt?: string
): Promise<string> {
  const keyInfo = await getApiKeyForModel(modelId);
  if (!keyInfo) {
    throw new Error('No AI model with an API key is configured. Add an API key in Settings > Models.');
  }

  const filesContext = files
    .map((f) => `### ${f.filePath}\n\`\`\`\n${f.content}\n\`\`\``)
    .join('\n\n');

  const systemPrompt = 'You are an expert AI agent architect. Analyze agent configuration files and provide actionable, specific feedback. Be concise but thorough.';

  const userMessage = prompt
    ? `${prompt}\n\nHere are the agent's files:\n\n${filesContext}`
    : `Analyze the following configuration files for the agent "${agentName}". Provide:
1. A summary of what this agent does
2. Strengths of the current configuration
3. Potential improvements or gaps
4. Suggestions for additional files or configurations
5. Any inconsistencies or issues

Here are the agent's files:

${filesContext}`;

  return chatCompletion(keyInfo, systemPrompt, userMessage);
}
