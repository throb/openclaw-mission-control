'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { TaskCard, type TaskData } from './task-card';
import { TaskDetail } from './task-detail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { displayColumnName, isIdeasColumn } from '@/lib/kanban';
import { Plus, Loader2, LayoutGrid, Circle } from 'lucide-react';

interface ColumnData {
  id: string;
  name: string;
  position: number;
  boardId: string;
  tasks: TaskData[];
}

interface BoardData {
  id: string;
  name: string;
  columns: ColumnData[];
  project: {
    id: string;
    name: string;
  };
}

interface Agent {
  id: string;
  name: string;
  status: string;
}

const COLUMN_DOT_COLORS: Record<string, string> = {
  ideas: 'text-muted-foreground',
  backlog: 'text-muted-foreground',
  recurring: 'text-purple-400',
  'in progress': 'text-primary',
  review: 'text-gold',
  done: 'text-green-500',
  'to do': 'text-blue-400',
  todo: 'text-blue-400',
};

function getColumnDotColor(name: string): string {
  if (isIdeasColumn(name)) return COLUMN_DOT_COLORS.ideas;
  return COLUMN_DOT_COLORS[name.toLowerCase()] || 'text-muted-foreground';
}

interface KanbanBoardProps {
  boardId: string;
  agents?: Agent[];
}

interface DisplayTask {
  task: TaskData;
  depth: number;
}

function buildDisplayTasks(tasks: TaskData[]): DisplayTask[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const children = new Map<string, TaskData[]>();

  for (const task of tasks) {
    if (!task.parentTaskId || !byId.has(task.parentTaskId)) continue;
    const list = children.get(task.parentTaskId) || [];
    list.push(task);
    children.set(task.parentTaskId, list);
  }

  children.forEach((list) => {
    list.sort((a, b) => a.position - b.position);
  });

  const ordered: DisplayTask[] = [];
  const visited = new Set<string>();

  const walk = (task: TaskData, depth: number) => {
    if (visited.has(task.id)) return;
    visited.add(task.id);
    ordered.push({ task, depth });
    for (const child of children.get(task.id) || []) {
      walk(child, depth + 1);
    }
  };

  for (const task of tasks) {
    if (!task.parentTaskId || !byId.has(task.parentTaskId)) {
      walk(task, 0);
    }
  }

  for (const task of tasks) {
    walk(task, 0);
  }

  return ordered;
}

export function KanbanBoard({ boardId, agents = [] }: KanbanBoardProps) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showTaskDetail, setShowTaskDetail] = useState(false);

  // Add task state
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creatingTask, setCreatingTask] = useState(false);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) throw new Error('Failed to fetch board');
      const data = await res.json();
      setBoard(data);
    } catch (error) {
      console.error('Failed to fetch board:', error);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, source, destination } = result;

    // Dropped outside a droppable
    if (!destination) return;

    // No movement
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    if (!board) return;

    // Optimistic update
    const newColumns = [...board.columns];
    const sourceCol = newColumns.find((c) => c.id === source.droppableId);
    const destCol = newColumns.find((c) => c.id === destination.droppableId);
    if (!sourceCol || !destCol) return;

    const sourceTasks = [...sourceCol.tasks];
    const [movedTask] = sourceTasks.splice(source.index, 1);

    if (source.droppableId === destination.droppableId) {
      // Same column reorder
      sourceTasks.splice(destination.index, 0, {
        ...movedTask,
        position: destination.index,
      });
      sourceCol.tasks = sourceTasks.map((t, i) => ({ ...t, position: i }));
    } else {
      // Cross-column move
      const destTasks = [...destCol.tasks];
      destTasks.splice(destination.index, 0, {
        ...movedTask,
        columnId: destination.droppableId,
        position: destination.index,
      });
      sourceCol.tasks = sourceTasks.map((t, i) => ({ ...t, position: i }));
      destCol.tasks = destTasks.map((t, i) => ({ ...t, position: i }));
    }

    setBoard({ ...board, columns: newColumns });

    // API call
    try {
      const res = await fetch(`/api/tasks/${draggableId}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          columnId: destination.droppableId,
          position: destination.index,
        }),
      });
      if (!res.ok) {
        // Revert on failure
        await fetchBoard();
      }
    } catch {
      // Revert on error
      await fetchBoard();
    }
  };

  const handleAddTask = async (columnId: string) => {
    if (!newTaskTitle.trim()) return;
    setCreatingTask(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle.trim(),
          columnId,
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      setNewTaskTitle('');
      setAddingToColumn(null);
      await fetchBoard();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setCreatingTask(false);
    }
  };

  const handleTaskClick = (task: TaskData) => {
    setSelectedTaskId(task.id);
    setShowTaskDetail(true);
  };

  const handleTaskDetailClose = () => {
    setShowTaskDetail(false);
    setSelectedTaskId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <LayoutGrid className="h-12 w-12 mb-4" />
        <p>Board not found</p>
      </div>
    );
  }

  const awaitingInput = board.columns.flatMap((column) =>
    column.tasks
      .filter((task) => task.awaitingInput)
      .map((task) => ({ ...task, columnName: displayColumnName(column.name) }))
  );

  return (
    <>
      {awaitingInput.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <div className="text-xs font-medium text-amber-500 mb-2">
            Awaiting Input
          </div>
          <div className="flex flex-wrap gap-2">
            {awaitingInput.map((task) => (
              <button
                key={task.id}
                type="button"
                className="text-xs rounded-md border border-amber-500/40 px-2 py-1 hover:bg-amber-500/15 transition-colors"
                onClick={() => handleTaskClick(task)}
              >
                {task.title} · {task.columnName}
              </button>
            ))}
          </div>
        </div>
      )}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-280px)]">
          {board.columns.map((column) => (
            <div
              key={column.id}
              className="flex-shrink-0 w-72 flex flex-col bg-muted/50 rounded-lg"
            >
              {/* Column header */}
              <div className="flex items-center justify-between p-3 pb-2">
                <div className="flex items-center gap-2">
                  <Circle className={cn('w-2.5 h-2.5 fill-current', getColumnDotColor(column.name))} />
                  <h3 className="text-sm font-semibold">{displayColumnName(column.name)}</h3>
                  <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 font-mono">
                    {column.tasks.length}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setAddingToColumn(
                      addingToColumn === column.id ? null : column.id
                    );
                    setNewTaskTitle('');
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Add task input */}
              {addingToColumn === column.id && (
                <div className="px-3 pb-2 space-y-2">
                  <Input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Task title..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddTask(column.id);
                      } else if (e.key === 'Escape') {
                        setAddingToColumn(null);
                        setNewTaskTitle('');
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAddTask(column.id)}
                      disabled={creatingTask || !newTaskTitle.trim()}
                    >
                      {creatingTask ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-3 w-3 mr-1" />
                      )}
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAddingToColumn(null);
                        setNewTaskTitle('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Task list */}
              <Droppable droppableId={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 px-3 pb-3 space-y-2 min-h-[60px] transition-colors rounded-b-lg',
                      snapshot.isDraggingOver && 'bg-primary/5'
                    )}
                  >
                    {buildDisplayTasks(column.tasks).map(({ task, depth }, index) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        index={index}
                        depth={depth}
                        onClick={handleTaskClick}
                      />
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <TaskDetail
        taskId={selectedTaskId}
        open={showTaskDetail}
        onClose={handleTaskDetailClose}
        onTaskUpdated={fetchBoard}
        onTaskDeleted={fetchBoard}
        agents={agents}
      />
    </>
  );
}
