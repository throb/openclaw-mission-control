'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Cpu,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Key,
  Star,
  X,
  Loader2,
  AlertCircle,
  Check,
} from 'lucide-react';

// ----- Types -----

interface AIModel {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  hasApiKey: boolean;
  isDefault: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

// ----- Provider config -----

const PROVIDERS: Record<
  string,
  { label: string; color: string; bgColor: string; ringColor: string }
> = {
  anthropic: {
    label: 'Anthropic',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    ringColor: 'ring-orange-500/20',
  },
  openai: {
    label: 'OpenAI',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    ringColor: 'ring-primary/20',
  },
  google: {
    label: 'Google',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    ringColor: 'ring-blue-500/20',
  },
  xai: {
    label: 'xAI',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    ringColor: 'ring-gray-500/20',
  },
};

function getProviderConfig(provider: string) {
  return (
    PROVIDERS[provider.toLowerCase()] || {
      label: provider,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      ringColor: 'ring-purple-500/20',
    }
  );
}

// ----- Form component -----

interface ModelFormData {
  provider: string;
  modelId: string;
  displayName: string;
  apiKey: string;
  isDefault: boolean;
  config: string;
}

function ModelForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  initialData?: AIModel;
  onSubmit: (data: ModelFormData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState<ModelFormData>({
    provider: initialData?.provider || '',
    modelId: initialData?.modelId || '',
    displayName: initialData?.displayName || '',
    apiKey: '',
    isDefault: initialData?.isDefault || false,
    config: initialData?.config ? JSON.stringify(initialData.config, null, 2) : '{}',
  });

  const [showApiKey, setShowApiKey] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {initialData ? 'Edit Model' : 'Add Model'}
        </CardTitle>
        <CardDescription>
          {initialData
            ? 'Update the model configuration'
            : 'Register a new AI model'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(formData);
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <select
                id="provider"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.provider}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    provider: e.target.value,
                  }))
                }
                required
              >
                <option value="">Select provider</option>
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google</option>
                <option value="xai">xAI</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="modelId">Model ID</Label>
              <Input
                id="modelId"
                placeholder="e.g. claude-opus-4-5, gpt-4o"
                value={formData.modelId}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    modelId: e.target.value,
                  }))
                }
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="e.g. Claude Opus 4.5"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    displayName: e.target.value,
                  }))
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">
                API Key{' '}
                {initialData?.hasApiKey && (
                  <span className="text-xs text-muted-foreground">
                    (leave empty to keep current)
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  id="apiKey"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={
                    initialData?.hasApiKey
                      ? 'Leave blank to keep existing key'
                      : 'sk-...'
                  }
                  value={formData.apiKey}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      apiKey: e.target.value,
                    }))
                  }
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default Model</Label>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      isDefault: !prev.isDefault,
                    }))
                  }
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    formData.isDefault ? 'bg-marmalade' : 'bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                      formData.isDefault
                        ? 'translate-x-6'
                        : 'translate-x-1'
                    )}
                  />
                </button>
                <span className="ml-2 text-sm text-muted-foreground">
                  {formData.isDefault
                    ? 'Default for provider'
                    : 'Not default'}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="config">Config (JSON, optional)</Label>
              <textarea
                id="config"
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.config}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    config: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {initialData ? 'Update' : 'Add Model'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

// ----- Model card -----

function ModelCard({
  model,
  onEdit,
  onDelete,
  onRevealKey,
  isDeleting,
  revealedKey,
  isRevealing,
}: {
  model: AIModel;
  onEdit: () => void;
  onDelete: () => void;
  onRevealKey: () => void;
  isDeleting: boolean;
  revealedKey: string | null;
  isRevealing: boolean;
}) {
  const provider = getProviderConfig(model.provider);

  return (
    <Card className="group relative card-glow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
                  provider.bgColor,
                  provider.color,
                  provider.ringColor
                )}
              >
                {provider.label}
              </span>
              {model.isDefault && (
                <span className="inline-flex items-center gap-1 rounded-md bg-marmalade/10 px-2 py-1 text-xs font-medium text-marmalade ring-1 ring-inset ring-marmalade/20">
                  <Star className="h-3 w-3" />
                  Default
                </span>
              )}
            </div>
            <CardTitle className="text-base mt-2">
              {model.displayName}
            </CardTitle>
            <CardDescription>
              <code className="text-xs font-mono">{model.modelId}</code>
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onEdit}
              title="Edit"
              className="h-8 w-8"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={isDeleting}
              title="Delete"
              className="h-8 w-8 text-destructive hover:text-destructive"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            {model.hasApiKey ? (
              <span className="inline-flex items-center gap-1 text-xs text-primary">
                <Check className="h-3 w-3" />
                Key configured
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                No API key
              </span>
            )}
          </div>
          {model.hasApiKey && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRevealKey}
              disabled={isRevealing}
              className="h-7 text-xs"
            >
              {isRevealing ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : revealedKey ? (
                <EyeOff className="mr-1 h-3 w-3" />
              ) : (
                <Eye className="mr-1 h-3 w-3" />
              )}
              {revealedKey ? 'Hide' : 'Reveal Key'}
            </Button>
          )}
        </div>
        {revealedKey && (
          <div className="mt-2 rounded-md bg-muted/50 px-3 py-2">
            <code className="text-xs font-mono text-muted-foreground">
              {revealedKey}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ----- Main page component -----

export default function ModelsPage() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    try {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      setModels(data.models);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    }
  }, []);

  useEffect(() => {
    fetchModels().finally(() => setLoading(false));
  }, [fetchModels]);

  async function handleSubmit(formData: ModelFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      // Parse config JSON
      let config: unknown = null;
      if (formData.config && formData.config.trim() !== '{}') {
        try {
          config = JSON.parse(formData.config);
        } catch {
          setError('Invalid JSON in config field');
          setIsSubmitting(false);
          return;
        }
      }

      const body: Record<string, unknown> = {
        provider: formData.provider,
        modelId: formData.modelId,
        displayName: formData.displayName,
        isDefault: formData.isDefault,
        config,
      };

      // Only include apiKey if the user typed something
      // For editing: empty field = keep current, explicitly empty with intent = would require a separate action
      if (formData.apiKey.length > 0) {
        body.apiKey = formData.apiKey;
      }

      let res: Response;
      if (editingModel) {
        res = await fetch(`/api/models/${editingModel.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save model');
      }

      setShowForm(false);
      setEditingModel(null);
      setRevealedKeys({});
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save model');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this model?')) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/models/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete model');
      setRevealedKeys((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await fetchModels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete model');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRevealKey(id: string) {
    // Toggle off if already revealed
    if (revealedKeys[id]) {
      setRevealedKeys((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setRevealingId(id);
    try {
      const res = await fetch(`/api/models/${id}/test-key`, {
        method: 'POST',
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to reveal key');
      }
      const data = await res.json();
      setRevealedKeys((prev) => ({ ...prev, [id]: data.maskedKey }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reveal key');
    } finally {
      setRevealingId(null);
    }
  }

  // Group models by provider
  const groupedModels: Record<string, AIModel[]> = {};
  const providerOrder = ['anthropic', 'openai', 'google', 'xai'];

  models.forEach((model) => {
    const key = model.provider.toLowerCase();
    if (!groupedModels[key]) groupedModels[key] = [];
    groupedModels[key].push(model);
  });

  // Add any providers not in the predefined order
  const allProviders = [
    ...providerOrder.filter((p) => groupedModels[p]),
    ...Object.keys(groupedModels).filter((p) => !providerOrder.includes(p)),
  ];

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Models</h1>
          <p className="text-muted-foreground">
            Manage model configurations and API keys
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Models</h1>
          <p className="text-muted-foreground">
            Manage model configurations and API keys
          </p>
        </div>
        {!showForm && !editingModel && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Model
          </Button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Create / Edit form */}
      {(showForm || editingModel) && (
        <ModelForm
          initialData={editingModel || undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingModel(null);
          }}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Models grouped by provider */}
      {models.length === 0 && !showForm ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium">No models configured</p>
              <p className="text-sm mt-1">
                Add your first AI model to get started
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        allProviders.map((providerKey) => {
          const providerModels = groupedModels[providerKey];
          const provider = getProviderConfig(providerKey);

          return (
            <div key={providerKey} className="space-y-4">
              <div className="flex items-center gap-2">
                <h2
                  className={cn(
                    'text-lg font-semibold',
                    provider.color
                  )}
                >
                  {provider.label}
                </h2>
                <span className="text-sm text-muted-foreground">
                  ({providerModels.length} model
                  {providerModels.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {providerModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    onEdit={() => {
                      setEditingModel(model);
                      setShowForm(false);
                    }}
                    onDelete={() => handleDelete(model.id)}
                    onRevealKey={() => handleRevealKey(model.id)}
                    isDeleting={deletingId === model.id}
                    revealedKey={revealedKeys[model.id] || null}
                    isRevealing={revealingId === model.id}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
