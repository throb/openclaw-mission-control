'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Brain,
  Search,
  FileText,
  Calendar,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MemoryFile {
  filename: string;
  content: string;
  modifiedAt: string;
  sizeBytes: number;
}

// Entry types parsed from markdown content
type EntryType = 'decision' | 'issue' | 'plan' | 'note';

interface JournalEntry {
  time: string;
  title: string;
  body: string;
  type: EntryType;
}

const ENTRY_TYPE_CONFIG: Record<EntryType, { color: string; dotClass: string; label: string }> = {
  decision: { color: 'text-blue-400', dotClass: 'bg-blue-500', label: 'Decision' },
  issue: { color: 'text-red-400', dotClass: 'bg-red-500', label: 'Issue' },
  plan: { color: 'text-green-400', dotClass: 'bg-green-500', label: 'Plan' },
  note: { color: 'text-muted-foreground', dotClass: 'bg-muted-foreground', label: 'Note' },
};

function detectEntryType(title: string, body: string): EntryType {
  const text = (title + ' ' + body).toLowerCase();
  if (text.includes('decision') || text.includes('decided') || text.includes('chose')) return 'decision';
  if (text.includes('issue') || text.includes('bug') || text.includes('error') || text.includes('problem')) return 'issue';
  if (text.includes('plan') || text.includes('design') || text.includes('architecture') || text.includes('strategy')) return 'plan';
  return 'note';
}

function parseJournalEntries(content: string): JournalEntry[] {
  const entries: JournalEntry[] = [];
  const lines = content.split('\n');
  let currentEntry: Partial<JournalEntry> | null = null;
  let bodyLines: string[] = [];

  for (const line of lines) {
    // Match ## headers with optional timestamps
    // Patterns: "## 05:37 AM — Title", "## Title", "### HH:MM - Title"
    const headerMatch = line.match(/^#{2,3}\s+(?:(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[—\-–]\s*)?(.+)/i);
    if (headerMatch) {
      // Save previous entry
      if (currentEntry?.title) {
        entries.push({
          time: currentEntry.time || '',
          title: currentEntry.title,
          body: bodyLines.join('\n').trim(),
          type: detectEntryType(currentEntry.title, bodyLines.join('\n')),
        });
      }
      currentEntry = {
        time: headerMatch[1] || '',
        title: headerMatch[2].trim(),
      };
      bodyLines = [];
      continue;
    }

    // Match timestamp patterns in body: "05:37 AM — Title"
    const timeMatch = line.match(/^(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[—\-–]\s*(.+)/i);
    if (timeMatch) {
      // Save previous entry
      if (currentEntry?.title) {
        entries.push({
          time: currentEntry.time || '',
          title: currentEntry.title,
          body: bodyLines.join('\n').trim(),
          type: detectEntryType(currentEntry.title, bodyLines.join('\n')),
        });
      }
      currentEntry = {
        time: timeMatch[1],
        title: timeMatch[2].trim(),
      };
      bodyLines = [];
      continue;
    }

    if (currentEntry) {
      bodyLines.push(line);
    }
  }

  // Don't forget last entry
  if (currentEntry?.title) {
    entries.push({
      time: currentEntry.time || '',
      title: currentEntry.title,
      body: bodyLines.join('\n').trim(),
      type: detectEntryType(currentEntry.title, bodyLines.join('\n')),
    });
  }

  return entries;
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function groupFilesByMonth(files: MemoryFile[]): Map<string, MemoryFile[]> {
  const groups = new Map<string, MemoryFile[]>();
  for (const file of files) {
    const date = new Date(file.modifiedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    const arr = groups.get(label) ?? [];
    arr.push(file);
    groups.set(label, arr);
  }
  return groups;
}

export function MemoryClient() {
  const [files, setFiles] = useState<MemoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<MemoryFile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/memory');
      if (!res.ok) return;
      const data = await res.json();
      setFiles(data.files || []);
      // Auto-select first file
      if (data.files?.length > 0 && !selectedFile) {
        setSelectedFile(data.files[0]);
      }
      // Auto-expand first month
      if (data.files?.length > 0) {
        const date = new Date(data.files[0].modifiedAt);
        const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        setExpandedMonths(new Set([label]));
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter(
      (f) =>
        f.filename.toLowerCase().includes(q) ||
        f.content.toLowerCase().includes(q)
    );
  }, [files, searchQuery]);

  const monthGroups = useMemo(() => groupFilesByMonth(filteredFiles), [filteredFiles]);
  const entries = useMemo(
    () => (selectedFile ? parseJournalEntries(selectedFile.content) : []),
    [selectedFile]
  );

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const toggleEntry = (idx: number) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Determine if file is a journal (has date-like name or ## headers with times)
  const isJournal = selectedFile && (
    /\d{4}-\d{2}-\d{2}/.test(selectedFile.filename) ||
    entries.length > 0
  );

  // Tags for the file
  const fileTags = useMemo(() => {
    if (!selectedFile) return [];
    const tags: string[] = [];
    const name = selectedFile.filename.toLowerCase();
    if (name.includes('journal') || /\d{4}-\d{2}-\d{2}/.test(name)) tags.push('journal');
    if (name.includes('daily')) tags.push('daily');
    if (name.includes('memory') || name.includes('long-term')) tags.push('memory');
    if (name.includes('decision')) tags.push('decisions');
    if (name.includes('plan')) tags.push('planning');
    if (tags.length === 0) tags.push('note');
    return tags;
  }, [selectedFile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gradient-warm">
          Memory &amp; Journal
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Long-term memory and daily journal entries
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left Sidebar */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* File count */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <Brain className="h-3.5 w-3.5" />
            <span>{files.length} memory files</span>
            {files.length > 0 && (
              <>
                <span className="text-border">|</span>
                <span>Updated {formatDate(files[0].modifiedAt)}</span>
              </>
            )}
          </div>

          {/* File list grouped by month */}
          <div className="space-y-1 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
            {Array.from(monthGroups.entries()).map(([month, monthFiles]) => (
              <div key={month}>
                <button
                  onClick={() => toggleMonth(month)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  {expandedMonths.has(month) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {month}
                  <span className="ml-auto text-muted-foreground/50">{monthFiles.length}</span>
                </button>
                {expandedMonths.has(month) && (
                  <div className="ml-2 space-y-0.5">
                    {monthFiles.map((file) => (
                      <button
                        key={file.filename}
                        onClick={() => {
                          setSelectedFile(file);
                          setExpandedEntries(new Set());
                        }}
                        className={cn(
                          'flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-left text-sm transition-colors',
                          selectedFile?.filename === file.filename
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'text-foreground/70 hover:bg-muted/50 hover:text-foreground'
                        )}
                      >
                        <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">
                          {file.filename.replace('.md', '')}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {filteredFiles.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No files found</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div>
          {!selectedFile ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Brain className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-lg font-semibold">Select a file</p>
                <p className="text-sm mt-1">Choose a file from the sidebar to view</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold">
                      {selectedFile.filename.replace('.md', '')}
                    </CardTitle>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="h-3 w-3" />
                        {formatDate(selectedFile.modifiedAt)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {wordCount(selectedFile.content)} words
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {fileTags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isJournal && entries.length > 0 ? (
                  /* Journal timeline view */
                  <div className="relative space-y-4 pl-4 border-l border-border">
                    {entries.map((entry, idx) => {
                      const config = ENTRY_TYPE_CONFIG[entry.type];
                      const isExpanded = expandedEntries.has(idx);
                      const isLong = entry.body.length > 200;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            'relative pl-6 entry-marker',
                            `entry-marker-${entry.type}`
                          )}
                        >
                          {/* Timeline dot */}
                          <div
                            className={cn(
                              'absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-background',
                              config.dotClass
                            )}
                          />

                          {/* Time + Type badge */}
                          <div className="flex items-center gap-2 mb-1">
                            {entry.time && (
                              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {entry.time}
                              </span>
                            )}
                            <span
                              className={cn(
                                'text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded',
                                config.color,
                                'bg-current/10'
                              )}
                              style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}
                            >
                              {config.label}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-semibold text-foreground mb-1">
                            {entry.title}
                          </h3>

                          {/* Body */}
                          {entry.body && (
                            <div className="space-y-1">
                              <p
                                className={cn(
                                  'text-sm text-muted-foreground whitespace-pre-wrap',
                                  !isExpanded && isLong && 'line-clamp-3'
                                )}
                              >
                                {entry.body}
                              </p>
                              {isLong && (
                                <button
                                  onClick={() => toggleEntry(idx)}
                                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                                >
                                  {isExpanded ? 'Show less' : 'Show more...'}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Raw markdown view */
                  <div className="prose prose-invert prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-foreground/80 font-mono leading-relaxed bg-transparent p-0 border-0">
                      {selectedFile.content}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
