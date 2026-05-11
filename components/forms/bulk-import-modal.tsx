'use client';

// Reusable bulk-import modal for ALL 8 verticals.
// Owner gives us their existing list (text, photo, Excel, CSV);
// we POST to /api/parse-catalog and render structured rows in an
// editable preview table, then merge into form state on confirm.

import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

// ─── Client-side image compression ──────────────────────────────────────
// Phone cameras and AI image generators produce 2-5 MB PNGs that are far
// larger than needed for text extraction. We shrink them to a max 1600px
// long edge and re-encode as JPEG q=0.85 — typical result is 200-600 KB,
// which avoids the Next.js dev-server body limit and the platform 4.5 MB
// cap on serverless deployments.

async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  // Already small enough — skip the canvas round-trip.
  if (file.size < 400_000) return file;
  // HEIC and other non-decodable types: send as-is.
  if (!file.type.startsWith('image/') || file.type === 'image/heic') return file;

  const url = URL.createObjectURL(file);
  try {
    const img: HTMLImageElement = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image decode failed'));
      i.src = url;
    });

    const longEdge = Math.max(img.width, img.height);
    const scale = longEdge > maxDim ? maxDim / longEdge : 1;
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob || blob.size >= file.size) return file; // never make it bigger
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file; // any decode/canvas failure → fall back to original
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Mode = 'text' | 'image' | 'pdf' | 'excel' | 'csv';

interface PreviewColumn {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'boolean';
}

interface Props {
  open: boolean;
  onClose: () => void;
  vertical: string;
  title: string;
  sectionLabel: string;
  textPlaceholder: string;
  columns: PreviewColumn[];
  onConfirm: (items: Record<string, unknown>[], mode: 'append' | 'replace') => void;
  existingCount: number;
  // Optional hooks for complex fields (e.g. an array shown as a comma string).
  // rowFromItem:    transform parsed item -> editable row (e.g. sizes[] -> "Half:200, Full:380")
  // beforeRowToForm: transform edited row -> final item shape (parses the string back to array)
  rowFromItem?: (item: Record<string, unknown>) => Record<string, unknown>;
  beforeRowToForm?: (row: Record<string, unknown>) => Record<string, unknown>;
}

export function BulkImportModal({
  open,
  onClose,
  vertical,
  title,
  sectionLabel,
  textPlaceholder,
  columns,
  onConfirm,
  existingCount,
  rowFromItem,
  beforeRowToForm,
}: Props) {
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  // Image mode accepts multiple files (multi-page menus often span 2-3 photos).
  // Excel/CSV stay single-file.
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false); // client-side compression in flight
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    if (!open) {
      setText('');
      setFiles([]);
      setParsed(null);
      setError(null);
      setMode('text');
    }
  }, [open]);

  async function handleImageSelect(selected: FileList | null) {
    if (!selected || selected.length === 0) {
      setFiles([]);
      return;
    }
    setProcessing(true);
    try {
      const compressed = await Promise.all(Array.from(selected).map((f) => compressImage(f)));
      setFiles(compressed);
    } finally {
      setProcessing(false);
    }
  }

  if (!open) return null;

  async function handleParse() {
    setError(null);
    setLoading(true);
    setParsed(null);
    try {
      const form = new FormData();
      form.append('vertical', vertical);
      form.append('mode', mode);
      if (mode === 'text' || mode === 'csv') {
        if (!text.trim()) {
          setError('Paste some text first.');
          setLoading(false);
          return;
        }
        form.append('text', text);
      } else {
        if (files.length === 0) {
          setError('Choose a file first.');
          setLoading(false);
          return;
        }
        // Multiple image uploads supported. Excel uses only the first file.
        if (mode === 'image') {
          for (const f of files) form.append('files', f);
        } else {
          form.append('file', files[0]);
        }
      }
      const res = await fetch('/api/parse-catalog', { method: 'POST', body: form });
      const data = (await res.json()) as {
        success: boolean;
        items?: Record<string, unknown>[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success) {
        const main = data.error || `Parse failed (${res.status})`;
        setError(data.detail ? `${main}\n\nDetail: ${data.detail}` : main);
        setLoading(false);
        return;
      }
      const items = data.items || [];
      setParsed(rowFromItem ? items.map(rowFromItem) : items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }

  function updateCell(rowIdx: number, key: string, value: string) {
    if (!parsed) return;
    const next = [...parsed];
    const col = columns.find((c) => c.key === key);
    let casted: unknown = value;
    if (col?.type === 'number') {
      const n = parseFloat(value);
      casted = Number.isFinite(n) ? n : 0;
    } else if (col?.type === 'boolean') {
      casted = value === 'true' || value === 'yes';
    }
    next[rowIdx] = { ...next[rowIdx], [key]: casted };
    setParsed(next);
  }

  function deleteRow(rowIdx: number) {
    if (!parsed) return;
    setParsed(parsed.filter((_, i) => i !== rowIdx));
  }

  function handleConfirm(action: 'append' | 'replace') {
    if (!parsed || parsed.length === 0) return;
    const out = beforeRowToForm ? parsed.map(beforeRowToForm) : parsed;
    onConfirm(out, action);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sectionLabel} — paste, upload an image / Excel / CSV of your existing list. The AI parses it; you review before saving.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            X
          </Button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {!parsed ? (
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="text">Paste text</TabsTrigger>
                <TabsTrigger value="image">Image / Photo</TabsTrigger>
                <TabsTrigger value="excel">Excel</TabsTrigger>
                <TabsTrigger value="csv">CSV</TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="mt-4">
                <Label className="text-xs">Paste your existing list (one item per line works best)</Label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={textPlaceholder}
                  rows={12}
                  className="font-mono text-xs mt-2"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Max 8,000 characters.</p>
              </TabsContent>

              <TabsContent value="image" className="mt-4">
                <Label className="text-xs">Upload photo(s) of your menu / catalog</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  multiple
                  onChange={(e) => handleImageSelect(e.target.files)}
                  className="mt-2"
                  disabled={processing}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Up to 6 images. Large photos are auto-compressed to ~1600 px / JPEG so the upload stays fast.
                </p>
                {processing && (
                  <p className="text-[11px] text-amber-700 mt-2">Compressing images…</p>
                )}
                {files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] text-muted-foreground bg-muted/50 rounded px-2 py-1">
                        <span className="truncate">{i + 1}. {f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                        <button
                          type="button"
                          onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                          className="ml-2 hover:text-destructive"
                        >
                          X
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="excel" className="mt-4">
                <Label className="text-xs">Upload an Excel file (.xlsx)</Label>
                <Input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setFiles(e.target.files?.[0] ? [e.target.files[0]] : [])}
                  className="mt-2"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Max 5 MB. Any layout — AI figures out columns.</p>
              </TabsContent>

              <TabsContent value="csv" className="mt-4">
                <Label className="text-xs">Paste CSV content</Label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`name,price\nBasmati Rice,180\nToor Dal,140`}
                  rows={10}
                  className="font-mono text-xs mt-2"
                />
              </TabsContent>

              {error && (
                <div className="mt-4 p-3 rounded border border-red-300 bg-red-50 text-xs text-red-900">
                  {error}
                </div>
              )}
            </Tabs>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm">
                  <span className="font-semibold">{parsed.length}</span> rows parsed.
                  {existingCount > 0 && <> Currently <b>{existingCount}</b> in form.</>}
                </p>
                <Button variant="ghost" size="sm" onClick={() => { setParsed(null); setError(null); }}>
                  Try again
                </Button>
              </div>
              {parsed.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rows. Try again with cleaner formatting.</p>
              ) : (
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        {columns.map((c) => (
                          <th key={c.key} className="text-left p-2 font-medium">{c.label}</th>
                        ))}
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((row, idx) => (
                        <tr key={idx} className="border-t">
                          {columns.map((c) => {
                            const v = row[c.key];
                            const display = v == null ? '' : String(v);
                            return (
                              <td key={c.key} className="p-1">
                                <Input
                                  value={display}
                                  onChange={(e) => updateCell(idx, c.key, e.target.value)}
                                  className="h-7 text-xs"
                                />
                              </td>
                            );
                          })}
                          <td className="p-1 text-center">
                            <Button variant="ghost" size="sm" onClick={() => deleteRow(idx)} className="h-7 w-7 p-0">
                              X
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t flex items-center justify-end gap-2">
          {!parsed ? (
            <>
              <Button variant="outline" onClick={onClose} disabled={loading || processing}>Cancel</Button>
              <Button onClick={handleParse} disabled={loading || processing}>
                {loading ? 'Parsing...' : processing ? 'Compressing...' : 'Parse'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button variant="outline" onClick={() => handleConfirm('replace')} disabled={parsed.length === 0}>
                Replace all ({existingCount} -&gt; {parsed.length})
              </Button>
              <Button onClick={() => handleConfirm('append')} disabled={parsed.length === 0}>
                Append ({existingCount} + {parsed.length})
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
