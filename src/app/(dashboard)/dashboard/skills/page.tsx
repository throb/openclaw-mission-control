'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Zap,
  Loader2,
  Plus,
  Download,
  Search,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  X,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  version: string | null;
  license: string | null;
  content: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    agents: number;
  };
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Create form
  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newContent, setNewContent] = useState('');

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skills');
      if (!res.ok) throw new Error('Failed to fetch skills');
      const data = await res.json();
      setSkills(data.skills);
    } catch {
      setError('Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  async function handleImport() {
    setImporting(true);
    setError(null);
    setImportResult(null);
    try {
      const res = await fetch('/api/skills/import', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Import failed');
      }
      const data = await res.json();
      setImportResult(
        `Imported ${data.imported} skill${data.imported !== 1 ? 's' : ''}, skipped ${data.skipped}`
      );
      fetchSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  async function handleToggleEnabled(skill: Skill) {
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !skill.enabled }),
      });
      if (res.ok) {
        const { skill: updated } = await res.json();
        setSkills((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        );
      }
    } catch {}
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this skill? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSkills((prev) => prev.filter((s) => s.id !== id));
        if (expandedSkill === id) setExpandedSkill(null);
      }
    } catch {}
  }

  async function handleCreate() {
    if (!newSlug.trim() || !newName.trim() || !newContent.trim()) {
      setError('Slug, name, and content are required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: newSlug.trim(),
          name: newName.trim(),
          description: newDescription.trim() || null,
          content: newContent,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create skill');
      }
      const { skill } = await res.json();
      setSkills((prev) => [...prev, skill].sort((a, b) => a.name.localeCompare(b.name)));
      setShowCreateDialog(false);
      setNewSlug('');
      setNewName('');
      setNewDescription('');
      setNewContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create skill');
    } finally {
      setCreating(false);
    }
  }

  const filtered = searchQuery
    ? skills.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : skills;

  const enabledCount = skills.filter((s) => s.enabled).length;
  const disabledCount = skills.filter((s) => !s.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skills</h1>
          <p className="text-muted-foreground">
            Manage agent capabilities and skill packages
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleImport} disabled={importing}>
            {importing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            {importing ? 'Importing...' : 'Import from Disk'}
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Skill
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {(error || importResult) && (
        <div
          className={`rounded-md border p-3 ${
            error
              ? 'bg-destructive/10 border-destructive/30'
              : 'bg-primary/10 border-primary/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <p
              className={`text-sm ${
                error ? 'text-destructive' : 'text-primary'
              }`}
            >
              {error || importResult}
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setError(null);
                setImportResult(null);
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Stats + Search */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{skills.length} skills</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            {enabledCount} enabled
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-wine" />
            {disabledCount} disabled
          </span>
        </div>
        <div className="flex-1 max-w-sm ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </div>

      {/* Skills List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">
              {skills.length === 0 ? 'No skills yet' : 'No matching skills'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {skills.length === 0
                ? 'Import skills from disk or create one manually.'
                : 'Try a different search term.'}
            </p>
            {skills.length === 0 && (
              <Button variant="outline" onClick={handleImport} disabled={importing}>
                <Download className="w-4 h-4 mr-2" />
                Import from Disk
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((skill) => {
            const isExpanded = expandedSkill === skill.id;
            return (
              <Card key={skill.id} className="overflow-hidden card-glow">
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() =>
                    setExpandedSkill(isExpanded ? null : skill.id)
                  }
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{skill.name}</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {skill.slug}
                      </span>
                      {skill.version && (
                        <Badge variant="outline" className="text-[10px] h-5">
                          v{skill.version}
                        </Badge>
                      )}
                    </div>
                    {skill.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {skill.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {skill._count.agents > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Bot className="w-3 h-3" />
                        {skill._count.agents}
                      </span>
                    )}
                    <Badge
                      variant="outline"
                      className={
                        skill.enabled
                          ? 'bg-primary/15 text-primary border-primary/30'
                          : 'bg-wine/15 text-wine border-wine/30'
                      }
                    >
                      {skill.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleEnabled(skill);
                      }}
                      title={skill.enabled ? 'Disable' : 'Enable'}
                    >
                      {skill.enabled ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(skill.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t bg-muted/20">
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {skill.license && (
                          <span>License: {skill.license}</span>
                        )}
                        <span>
                          Updated:{' '}
                          {new Date(skill.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="rounded-md border bg-background">
                        <pre className="p-4 text-xs font-mono whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto">
                          {skill.content}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Skill</DialogTitle>
            <DialogDescription>
              Add a new skill that agents can use. Include YAML frontmatter in
              the content for metadata.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="skill-slug">Slug</Label>
                <Input
                  id="skill-slug"
                  placeholder="e.g., my-skill"
                  value={newSlug}
                  onChange={(e) => setNewSlug(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="skill-name">Name</Label>
                <Input
                  id="skill-name"
                  placeholder="e.g., My Skill"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-desc">Description</Label>
              <Textarea
                id="skill-desc"
                placeholder="What does this skill do? When should it be used?"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="skill-content">SKILL.md Content</Label>
              <Textarea
                id="skill-content"
                placeholder={`---\nname: my-skill\ndescription: ...\nversion: 1.0.0\n---\n\n# My Skill\n\n...`}
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={12}
                className="font-mono text-xs"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setError(null);
              }}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
