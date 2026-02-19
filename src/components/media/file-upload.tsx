'use client';

import { useCallback, useState } from 'react';
import { useDropzone, type Accept } from 'react-dropzone';
import { Upload, X, FileIcon, ImageIcon, VideoIcon, Loader2 } from 'lucide-react';
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

interface FileUploadProps {
  onUpload: (attachment: Attachment) => void;
  taskId?: string;
  messageId?: string;
  accept?: Accept;
  className?: string;
}

export function FileUpload({
  onUpload,
  taskId,
  messageId,
  accept,
  className,
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      setError(null);
      setUploading(true);
      setProgress(0);

      // Show image preview immediately for image files
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreview(e.target?.result as string);
        };
        reader.readAsDataURL(file);
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (taskId) formData.append('taskId', taskId);
        if (messageId) formData.append('messageId', messageId);

        // Simulate progress since fetch doesn't have native progress for uploads
        const progressInterval = setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        const response = await fetch('/api/attachments', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }

        setProgress(100);
        const data = await response.json();
        onUpload(data.attachment);

        // Clear preview after successful upload (brief delay for UX)
        setTimeout(() => {
          setPreview(null);
          setProgress(0);
        }, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setPreview(null);
      } finally {
        setUploading(false);
      }
    },
    [onUpload, taskId, messageId]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept,
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false,
    disabled: uploading,
    onDropRejected: (rejections) => {
      const rejection = rejections[0];
      if (rejection?.errors[0]?.code === 'file-too-large') {
        setError('File is too large. Maximum size is 50MB.');
      } else if (rejection?.errors[0]?.code === 'file-invalid-type') {
        setError('File type is not accepted.');
      } else {
        setError(rejection?.errors[0]?.message || 'File rejected');
      }
    },
  });

  const clearError = () => setError(null);

  return (
    <div className={cn('w-full', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer',
          'hover:border-primary/50 hover:bg-muted/25',
          isDragActive && !isDragReject && 'border-primary bg-primary/5',
          isDragReject && 'border-destructive bg-destructive/5',
          uploading && 'pointer-events-none opacity-60',
          'border-muted-foreground/25'
        )}
      >
        <input {...getInputProps()} />

        {preview ? (
          <div className="flex flex-col items-center gap-3">
            <img
              src={preview}
              alt="Upload preview"
              className="max-h-32 max-w-full rounded-md object-contain"
            />
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading... {progress}%
              </div>
            )}
          </div>
        ) : uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Uploading... {progress}%
            </p>
            {/* Progress bar */}
            <div className="h-2 w-48 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-full bg-muted p-3">
              {isDragActive ? (
                <Upload className="h-6 w-6 text-primary" />
              ) : (
                <div className="flex gap-1">
                  <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  <VideoIcon className="h-5 w-5 text-muted-foreground" />
                  <FileIcon className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragActive
                  ? 'Drop file here'
                  : 'Drag & drop a file here, or click to browse'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Images, videos, and documents up to 50MB
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-2 flex items-center justify-between rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearError}
            className="h-auto p-1 text-destructive hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
