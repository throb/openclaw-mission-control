'use client';

import { Draggable } from '@hello-pangea/dnd';
import { GripVertical, MessageSquare, Paperclip, Bot } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TaskData {
  id: string;
  title: string;
  description: string | null;
  priority: 'P0' | 'P1' | 'P2' | 'P3' | 'P4';
  position: number;
  columnId: string;
  assignedAgent: {
    id: string;
    name: string;
    status: string;
  } | null;
  _count: {
    threads: number;
    attachments: number;
  };
  createdAt: string;
  updatedAt: string;
}

const priorityConfig: Record<
  string,
  { label: string; className: string }
> = {
  P0: { label: 'P0', className: 'bg-red-500/20 text-red-500 border-red-500/30' },
  P1: { label: 'P1', className: 'bg-orange-500/20 text-orange-500 border-orange-500/30' },
  P2: { label: 'P2', className: 'bg-blue-500/20 text-blue-500 border-blue-500/30' },
  P3: { label: 'P3', className: 'bg-gray-400/20 text-gray-400 border-gray-400/30' },
  P4: { label: 'P4', className: 'bg-gray-300/20 text-gray-300 border-gray-300/30' },
};

interface TaskCardProps {
  task: TaskData;
  index: number;
  onClick: (task: TaskData) => void;
}

export function TaskCard({ task, index, onClick }: TaskCardProps) {
  const priority = priorityConfig[task.priority];

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            'group rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md cursor-pointer',
            snapshot.isDragging && 'shadow-lg ring-2 ring-primary/50 rotate-[2deg]'
          )}
          onClick={() => onClick(task)}
        >
          <div className="flex items-start gap-2">
            <div
              {...provided.dragHandleProps}
              className="mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-sm font-medium leading-snug truncate">
                {task.title}
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0', priority.className)}
                >
                  {priority.label}
                </Badge>

                {task.assignedAgent && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Bot className="h-3 w-3" />
                    <span className="truncate max-w-[80px]">
                      {task.assignedAgent.name}
                    </span>
                  </div>
                )}
              </div>

              {(task._count.threads > 0 || task._count.attachments > 0) && (
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {task._count.threads > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {task._count.threads}
                    </span>
                  )}
                  {task._count.attachments > 0 && (
                    <span className="flex items-center gap-1">
                      <Paperclip className="h-3 w-3" />
                      {task._count.attachments}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
