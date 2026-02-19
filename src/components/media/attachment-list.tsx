'use client';

import { useState } from 'react';
import {
  FileIcon,
  ImageIcon,
  VideoIcon,
  Download,
  Trash2,
  Loader2,
  FileTextIcon,
  ArchiveIcon,
  MusicIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  taskId: string | null;
  messageId: string | null;
  createdAt: string;
}

interface AttachmentListProps {
  attachments: Attachment[];
  onDelete?: (id: string) => void;
  className?: string;
}

/**
 * Format bytes into a human-readable string.
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${size} ${units[i]}`;
}

/**
 * Get the appropriate icon for a mime type.
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  if (mimeType.startsWith('video/')) return VideoIcon;
  if (mimeType.startsWith('audio/')) return MusicIcon;
  if (mimeType === 'application/pdf') return FileTextIcon;
  if (
    mimeType === 'application/zip' ||
    mimeType === 'application/gzip' ||
    mimeType === 'application/x-tar'
  ) {
    return ArchiveIcon;
  }
  return FileIcon;
}

function AttachmentItem({
  attachment,
  onDelete,
}: {
  attachment: Attachment;
  onDelete?: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isImage = attachment.mimeType.startsWith('image/');
  const isVideo = attachment.mimeType.startsWith('video/');
  const isAudio = attachment.mimeType.startsWith('audio/');
  const Icon = getFileIcon(attachment.mimeType);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/attachments/${attachment.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        onDelete(attachment.id);
      } else {
        console.error('Failed to delete attachment');
      }
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="group relative rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50">
      {/* Media Preview */}
      {isImage && !imageError && (
        <div className="mb-3 overflow-hidden rounded-md bg-muted">
          <img
            src={attachment.url}
            alt={attachment.filename}
            className="h-40 w-full object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      )}

      {isVideo && (
        <div className="mb-3 overflow-hidden rounded-md bg-muted">
          <video
            src={attachment.url}
            controls
            preload="metadata"
            className="h-40 w-full object-contain"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {isAudio && (
        <div className="mb-3">
          <audio
            src={attachment.url}
            controls
            preload="metadata"
            className="w-full"
          >
            Your browser does not support the audio tag.
          </audio>
        </div>
      )}

      {/* File Info */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={attachment.filename}>
            {attachment.filename}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(attachment.size)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            asChild
          >
            <a
              href={attachment.url}
              download={attachment.filename}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </a>
          </Button>

          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AttachmentList({
  attachments,
  onDelete,
  className,
}: AttachmentListProps) {
  if (attachments.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <FileIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-2 text-sm text-muted-foreground">No attachments</p>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          attachment={attachment}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
