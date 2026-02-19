'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  FolderKanban,
  Save,
} from 'lucide-react';
import Link from 'next/link';

const KanbanBoard = dynamic(
  () => import('@/components/kanban/board').then((mod) => mod.KanbanBoard),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

interface Board {
  id: string;
  name: string;
  columns: Array<{
    id: string;
    name: string;
    position: number;
    _count: { tasks: number };
  }>;
}

interface ProjectAgent {
  projectId: string;
  agentId: string;
  role: string | null;
  agent: {
    id: string;
    name: string;
    description: string | null;
    status: string;
  };
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  boards: Board[];
  agents: ProjectAgent[];
}

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBoard, setActiveBoard] = useState<string>('');

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // All agents for the task agent selector
  const [allAgents, setAllAgents] = useState<Array<{ id: string; name: string; status: string }>>([]);

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      const data = await res.json();
      setProject(data);
      if (data.boards.length > 0 && !activeBoard) {
        setActiveBoard(data.boards[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch project:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, activeBoard]);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) return;
      const data = await res.json();
      setAllAgents(
        (data.agents || data).map((a: { id: string; name: string; status: string }) => ({
          id: a.id,
          name: a.name,
          status: a.status,
        }))
      );
    } catch {
      // Non-critical, agent selector will just be empty
    }
  }, []);

  useEffect(() => {
    fetchProject();
    fetchAgents();
  }, [fetchProject, fetchAgents]);

  const handleEditProject = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update project');
      setEditDialogOpen(false);
      await fetchProject();
    } catch (error) {
      console.error('Failed to update project:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete project');
      router.push('/dashboard/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
      setDeleting(false);
    }
  };

  const openEditDialog = () => {
    if (project) {
      setEditName(project.name);
      setEditDescription(project.description || '');
    }
    setEditDialogOpen(true);
  };

  // Use all agents for the task assignment dropdown
  const agentsList = allAgents;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <FolderKanban className="h-12 w-12 mb-4" />
        <p className="text-lg font-semibold">Project not found</p>
        <Link href="/dashboard/projects">
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/projects">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {project.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>

      {/* Board selector */}
      {project.boards.length > 1 ? (
        <Tabs value={activeBoard} onValueChange={setActiveBoard}>
          <TabsList>
            {project.boards.map((board) => (
              <TabsTrigger key={board.id} value={board.id}>
                {board.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {project.boards.map((board) => (
            <TabsContent key={board.id} value={board.id}>
              <KanbanBoard boardId={board.id} agents={agentsList} />
            </TabsContent>
          ))}
        </Tabs>
      ) : project.boards.length === 1 ? (
        <KanbanBoard boardId={project.boards[0].id} agents={agentsList} />
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <p>No boards found for this project.</p>
        </div>
      )}

      {/* Edit Project Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update the project name and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditProject}
              disabled={saving || !editName.trim()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This
              will permanently delete all boards, columns, tasks, and threads
              associated with this project. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
