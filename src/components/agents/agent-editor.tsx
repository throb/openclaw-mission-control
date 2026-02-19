'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  File,
  FilePlus,
  Save,
  Loader2,
  History,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Clock,
  X,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, formatDateTime } from '@/lib/utils';

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(
  () => import('@monaco-editor/react').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full bg-card">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading editor...</span>
        </div>
      </div>
    ),
  }
);

interface FileData {
  filePath: string;
  content: string;
  latestVersionId: string;
  message: string | null;
  updatedAt: string;
}

interface VersionEntry {
  id: string;
  filePath: string;
  content: string;
  contentHash: string;
  message: string | null;
  parentVersionId: string | null;
  createdAt: string;
}

interface AgentEditorProps {
  agentId: string;
  initialFiles: FileData[];
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    md: 'markdown',
    markdown: 'markdown',
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    sh: 'shell',
    bash: 'shell',
    html: 'html',
    css: 'css',
    sql: 'sql',
    toml: 'toml',
    xml: 'xml',
    txt: 'plaintext',
  };
  return langMap[ext || ''] || 'plaintext';
}

export function AgentEditor({ agentId, initialFiles }: AgentEditorProps) {
  const [files, setFiles] = useState<FileData[]>(initialFiles);
  const [selectedFile, setSelectedFile] = useState<string | null>(
    initialFiles.length > 0 ? initialFiles[0].filePath : null
  );
  const [editorContent, setEditorContent] = useState<string>(
    initialFiles.length > 0 ? initialFiles[0].content : ''
  );

  // Sync when parent passes new files (e.g. after AI generation)
  useEffect(() => {
    setFiles(initialFiles);
    if (initialFiles.length > 0 && !selectedFile) {
      setSelectedFile(initialFiles[0].filePath);
      setEditorContent(initialFiles[0].content);
      originalContentRef.current = initialFiles[0].content;
    }
  }, [initialFiles]); // eslint-disable-line react-hooks/exhaustive-deps
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showNewFileDialog, setShowNewFileDialog] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState<VersionEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const originalContentRef = useRef<string>('');

  // Track original content for dirty detection
  useEffect(() => {
    const file = files.find((f) => f.filePath === selectedFile);
    if (file) {
      originalContentRef.current = file.content;
    }
  }, [selectedFile, files]);

  const handleFileSelect = useCallback(
    (filePath: string) => {
      if (isDirty) {
        const confirm = window.confirm(
          'You have unsaved changes. Discard them?'
        );
        if (!confirm) return;
      }

      const file = files.find((f) => f.filePath === filePath);
      if (file) {
        setSelectedFile(filePath);
        setEditorContent(file.content);
        setIsDirty(false);
        setError(null);
        setSaveSuccess(false);
        // Reset history when switching files
        setVersionHistory([]);
      }
    },
    [files, isDirty]
  );

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const newContent = value || '';
      setEditorContent(newContent);
      setIsDirty(newContent !== originalContentRef.current);
      setSaveSuccess(false);
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!selectedFile || !isDirty) return;
    setShowSaveDialog(true);
  }, [selectedFile, isDirty]);

  const executeSave = useCallback(async () => {
    if (!selectedFile) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/agents/${agentId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: selectedFile,
          content: editorContent,
          message: saveMessage.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data.skipped) {
          // Content unchanged
          setIsDirty(false);
          setShowSaveDialog(false);
          setSaveMessage('');
          return;
        }
        throw new Error(data.error || 'Failed to save file');
      }

      // Update the file in our local state
      setFiles((prev) =>
        prev.map((f) =>
          f.filePath === selectedFile
            ? {
                ...f,
                content: editorContent,
                latestVersionId: data.fileVersion.id,
                message: data.fileVersion.message,
                updatedAt: data.fileVersion.createdAt,
              }
            : f
        )
      );

      originalContentRef.current = editorContent;
      setIsDirty(false);
      setShowSaveDialog(false);
      setSaveMessage('');
      setSaveSuccess(true);

      // Clear success message after a few seconds
      setTimeout(() => setSaveSuccess(false), 3000);

      // Refresh history if visible
      if (showHistory) {
        loadVersionHistory(selectedFile);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  }, [agentId, selectedFile, editorContent, saveMessage, showHistory]);

  const handleCreateFile = useCallback(async () => {
    const path = newFilePath.trim();
    if (!path) {
      setError('File path is required');
      return;
    }

    // Check if file already exists
    if (files.some((f) => f.filePath === path)) {
      setError('A file with this path already exists');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const defaultContent = getDefaultContent(path);

      const res = await fetch(`/api/agents/${agentId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: path,
          content: defaultContent,
          message: 'Initial file creation',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create file');
      }

      const { fileVersion } = await res.json();

      const newFile: FileData = {
        filePath: path,
        content: defaultContent,
        latestVersionId: fileVersion.id,
        message: fileVersion.message,
        updatedAt: fileVersion.createdAt,
      };

      setFiles((prev) => [...prev, newFile]);
      setSelectedFile(path);
      setEditorContent(defaultContent);
      originalContentRef.current = defaultContent;
      setIsDirty(false);
      setShowNewFileDialog(false);
      setNewFilePath('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create file');
    } finally {
      setSaving(false);
    }
  }, [agentId, files, newFilePath]);

  const loadVersionHistory = useCallback(
    async (filePath: string) => {
      setLoadingHistory(true);
      try {
        const encodedPath = encodeURIComponent(filePath);
        const res = await fetch(
          `/api/agents/${agentId}/files/${encodedPath}`
        );

        if (!res.ok) {
          if (res.status === 404) {
            setVersionHistory([]);
            return;
          }
          throw new Error('Failed to load history');
        }

        const data = await res.json();
        setVersionHistory(data.versions || []);
      } catch (err) {
        console.error('Failed to load version history:', err);
        setVersionHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    },
    [agentId]
  );

  const handleToggleHistory = useCallback(() => {
    if (!showHistory && selectedFile) {
      loadVersionHistory(selectedFile);
    }
    setShowHistory((prev) => !prev);
  }, [showHistory, selectedFile, loadVersionHistory]);

  const handleRevertToVersion = useCallback(
    (version: VersionEntry) => {
      setEditorContent(version.content);
      setIsDirty(version.content !== originalContentRef.current);
    },
    []
  );

  // Keyboard shortcut for save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirty && selectedFile) {
          setShowSaveDialog(true);
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDirty, selectedFile]);

  const currentFile = files.find((f) => f.filePath === selectedFile);
  const language = selectedFile ? getLanguageFromPath(selectedFile) : 'plaintext';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Files</CardTitle>
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="text-sm text-primary">Saved</span>
            )}
            {error && (
              <span className="text-sm text-destructive">{error}</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleToggleHistory}
              disabled={!selectedFile}
            >
              {showHistory ? (
                <PanelRightClose className="w-4 h-4 mr-1" />
              ) : (
                <PanelRightOpen className="w-4 h-4 mr-1" />
              )}
              History
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewFilePath('');
                setError(null);
                setShowNewFileDialog(true);
              }}
            >
              <FilePlus className="w-4 h-4 mr-1" />
              New File
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty || saving || !selectedFile}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex border-t" style={{ height: '600px' }}>
          {/* File Sidebar */}
          <div className="w-56 border-r flex flex-col overflow-hidden">
            <div className="p-2 border-b">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Files
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {files.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  <p>No files yet.</p>
                  <p className="mt-1">Create one to get started.</p>
                </div>
              ) : (
                <div className="py-1">
                  {files.map((file) => (
                    <button
                      key={file.filePath}
                      onClick={() => handleFileSelect(file.filePath)}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors',
                        selectedFile === file.filePath
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      )}
                    >
                      <File className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate font-mono text-xs">
                        {file.filePath}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {selectedFile ? (
              <>
                {/* Editor Tab Bar */}
                <div className="h-9 border-b flex items-center px-3 gap-2 bg-card">
                  <span className="text-xs font-mono text-muted-foreground">
                    {selectedFile}
                  </span>
                  {isDirty && (
                    <span className="w-2 h-2 rounded-full bg-marmalade flex-shrink-0" />
                  )}
                  {currentFile && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      Last saved: {formatDateTime(currentFile.updatedAt)}
                    </span>
                  )}
                </div>

                {/* Monaco Editor */}
                <div className="flex-1">
                  <MonacoEditor
                    height="100%"
                    language={language}
                    value={editorContent}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      fontFamily: 'var(--font-mono), JetBrains Mono, monospace',
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      wrappingStrategy: 'advanced',
                      padding: { top: 8 },
                      renderLineHighlight: 'line',
                      bracketPairColorization: { enabled: true },
                      smoothScrolling: true,
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      tabSize: 2,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <File className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">
                    {files.length === 0
                      ? 'Create a file to start editing'
                      : 'Select a file to edit'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Version History Panel */}
          {showHistory && selectedFile && (
            <div className="w-72 border-l flex flex-col overflow-hidden">
              <div className="p-2 border-b flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Version History
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setShowHistory(false)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingHistory ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : versionHistory.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No version history available.
                  </div>
                ) : (
                  <div className="py-1">
                    {versionHistory.map((version, index) => (
                      <div
                        key={version.id}
                        className="px-3 py-2 border-b border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span className="truncate">
                              {formatDateTime(version.createdAt)}
                            </span>
                          </div>
                          {index > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={() => handleRevertToVersion(version)}
                              title="Restore this version"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        {version.message && (
                          <p className="text-xs text-foreground mt-1 line-clamp-2">
                            {version.message}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">
                          {version.contentHash.substring(0, 12)}...
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save File</DialogTitle>
            <DialogDescription>
              Add a commit message to describe your changes to{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">
                {selectedFile}
              </code>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="save-message">Commit Message</Label>
              <Input
                id="save-message"
                placeholder="Describe your changes..."
                value={saveMessage}
                onChange={(e) => setSaveMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeSave();
                }}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveDialog(false);
                setError(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={executeSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={showNewFileDialog} onOpenChange={setShowNewFileDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New File</DialogTitle>
            <DialogDescription>
              Add a new file to this agent. Common files include agent.md,
              SOUL.md, config.yaml, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-file-path">File Path</Label>
              <Input
                id="new-file-path"
                placeholder="e.g., agent.md"
                value={newFilePath}
                onChange={(e) => setNewFilePath(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFile();
                }}
                autoFocus
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {['agent.md', 'SOUL.md', 'config.yaml', 'README.md'].map(
                (suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setNewFilePath(suggestion)}
                    disabled={files.some((f) => f.filePath === suggestion)}
                  >
                    {suggestion}
                  </Button>
                )
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowNewFileDialog(false);
                setError(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateFile} disabled={saving || !newFilePath.trim()}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * Generate default content based on file extension.
 */
function getDefaultContent(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const name = filePath.split('/').pop() || filePath;

  switch (ext) {
    case 'md':
    case 'markdown':
      return `# ${name.replace(/\.[^.]+$/, '')}\n\n`;
    case 'yaml':
    case 'yml':
      return `# ${name}\n# Configuration for this agent\n\n`;
    case 'json':
      return '{\n  \n}\n';
    case 'js':
    case 'ts':
      return `// ${name}\n\n`;
    default:
      return '';
  }
}
