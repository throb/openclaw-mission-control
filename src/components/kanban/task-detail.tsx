'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import {
  Save,
  Trash2,
  Send,
  MessageSquare,
  Bot,
  User,
  Loader2,
} from 'lucide-react';
import type { TaskData } from './task-card';

const priorityConfig: Record<
  string,
  { label: string; className: string }
> = {
  P0: { label: 'P0 - Critical', className: 'bg-red-500/20 text-red-500 border-red-500/30' },
  P1: { label: 'P1 - High', className: 'bg-orange-500/20 text-orange-500 border-orange-500/30' },
  P2: { label: 'P2 - Medium', className: 'bg-blue-500/20 text-blue-500 border-blue-500/30' },
  P3: { label: 'P3 - Low', className: 'bg-gray-400/20 text-gray-400 border-gray-400/30' },
  P4: { label: 'P4 - Minimal', className: 'bg-gray-300/20 text-gray-300 border-gray-300/30' },
};

interface Thread {
  id: string;
  taskId: string;
  createdAt: string;
  messages: Message[];
}

interface Message {
  id: string;
  threadId: string;
  content: string;
  authorType: 'USER' | 'AGENT';
  authorId: string | null;
  createdAt: string;
}

interface TaskDetailData extends TaskData {
  assignedAgentId: string | null;
  column: {
    id: string;
    name: string;
    boardId: string;
    board: {
      id: string;
      name: string;
      projectId: string;
    };
  };
  threads: Thread[];
  parentTask: {
    id: string;
    title: string;
  } | null;
  subtasks: Array<{
    id: string;
    title: string;
    awaitingInput: boolean;
  }>;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
    url: string;
  }>;
}

interface Agent {
  id: string;
  name: string;
  status: string;
}

interface TaskDetailProps {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  onTaskUpdated: () => void;
  onTaskDeleted: () => void;
  agents?: Agent[];
}

export function TaskDetail({
  taskId,
  open,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
  agents = [],
}: TaskDetailProps) {
  const [task, setTask] = useState<TaskDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P2');
  const [assignedAgentId, setAssignedAgentId] = useState('');
  const [parentTaskId, setParentTaskId] = useState('');
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [parentTaskOptions, setParentTaskOptions] = useState<Array<{ id: string; title: string }>>([]);

  // Thread/message state
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const fetchTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (!res.ok) throw new Error('Failed to fetch task');
      const data = await res.json();
      setTask(data);
      setTitle(data.title);
      setDescription(data.description || '');
      setPriority(data.priority);
      setAssignedAgentId(data.assignedAgentId || '');
      setParentTaskId(data.parentTaskId || '');
      setAwaitingInput(Boolean(data.awaitingInput));

      const boardRes = await fetch(`/api/boards/${data.column.boardId}`);
      if (boardRes.ok) {
        const board = await boardRes.json();
        const options = (board.columns || [])
          .flatMap((c: { tasks?: Array<{ id: string; title: string }> }) => c.tasks || [])
          .filter((t: { id: string }) => t.id !== data.id)
          .map((t: { id: string; title: string }) => ({ id: t.id, title: t.title }));
        setParentTaskOptions(options);
      } else {
        setParentTaskOptions([]);
      }
    } catch (error) {
      console.error('Failed to fetch task:', error);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    if (open && taskId) {
      fetchTask();
    }
  }, [open, taskId, fetchTask]);

  const handleSave = async () => {
    if (!taskId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: description || null,
          priority,
          assignedAgentId: assignedAgentId || null,
          parentTaskId: parentTaskId || null,
          awaitingInput,
        }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      await fetchTask();
      onTaskUpdated();
    } catch (error) {
      console.error('Failed to save task:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
      onTaskDeleted();
      onClose();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!taskId || !newMessage.trim()) return;
    setSendingMessage(true);
    try {
      // If there are existing threads, add to the first one; otherwise create a new thread
      if (task?.threads && task.threads.length > 0) {
        const threadId = task.threads[0].id;
        const res = await fetch(`/api/threads/${threadId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newMessage.trim(),
            authorType: 'USER',
          }),
        });
        if (!res.ok) throw new Error('Failed to send message');
      } else {
        const res = await fetch(`/api/tasks/${taskId}/threads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: newMessage.trim(),
            authorType: 'USER',
          }),
        });
        if (!res.ok) throw new Error('Failed to create thread');
      }
      setNewMessage('');
      await fetchTask();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const allMessages = task?.threads
    ?.flatMap((thread) =>
      thread.messages.map((msg) => ({
        ...msg,
        threadId: thread.id,
      }))
    )
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ) || [];

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Task Details</DialogTitle>
          <DialogDescription>
            {task ? `Edit task and view conversation` : 'Loading task...'}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <div className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the task..."
                rows={3}
              />
            </div>

            {/* Priority & Agent */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-priority">Priority</Label>
                <Select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  {Object.entries(priorityConfig).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-agent">Assigned Agent</Label>
                <Select
                  id="task-agent"
                  value={assignedAgentId}
                  onChange={(e) => setAssignedAgentId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="task-parent">Parent Task</Label>
                <Select
                  id="task-parent"
                  value={parentTaskId}
                  onChange={(e) => setParentTaskId(e.target.value)}
                >
                  <option value="">No parent</option>
                  {parentTaskOptions.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="awaiting-input">Workflow State</Label>
                <label
                  htmlFor="awaiting-input"
                  className="h-10 rounded-md border border-input px-3 flex items-center gap-2 text-sm"
                >
                  <input
                    id="awaiting-input"
                    type="checkbox"
                    checked={awaitingInput}
                    onChange={(e) => setAwaitingInput(e.target.checked)}
                  />
                  Awaiting Input
                </label>
              </div>
            </div>

            {/* Status info */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Column: {task.column?.name}</span>
              {task.parentTask && <span>Parent: {task.parentTask.title}</span>}
              <span>Created: {formatDateTime(task.createdAt)}</span>
              <span>Updated: {formatDateTime(task.updatedAt)}</span>
            </div>

            {task.subtasks.length > 0 && (
              <div className="space-y-2 text-sm">
                <Label>Subtasks</Label>
                <div className="space-y-1 rounded-md border p-3">
                  {task.subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2">
                      <span className="truncate">{subtask.title}</span>
                      {subtask.awaitingInput && (
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-500">
                          Awaiting Input
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save & Delete */}
            <div className="flex items-center justify-between border-t pt-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save Changes
              </Button>
            </div>

            {/* Threads / Conversation */}
            <div className="border-t pt-4 space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-semibold">Conversation</h4>
                <span className="text-xs text-muted-foreground">
                  ({allMessages.length} message{allMessages.length !== 1 ? 's' : ''})
                </span>
              </div>

              {/* Messages */}
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {allMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No messages yet. Start a conversation below.
                  </p>
                ) : (
                  allMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'rounded-lg p-3 text-sm',
                        msg.authorType === 'USER'
                          ? 'bg-primary/10 ml-4'
                          : 'bg-muted mr-4'
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] px-1.5 py-0',
                            msg.authorType === 'USER'
                              ? 'border-blue-500/30 text-blue-500'
                              : 'border-purple-500/30 text-purple-500'
                          )}
                        >
                          {msg.authorType === 'USER' ? (
                            <User className="h-2.5 w-2.5 mr-1" />
                          ) : (
                            <Bot className="h-2.5 w-2.5 mr-1" />
                          )}
                          {msg.authorType}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))
                )}
              </div>

              {/* New message input */}
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !newMessage.trim()}
                >
                  {sendingMessage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Task not found.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
