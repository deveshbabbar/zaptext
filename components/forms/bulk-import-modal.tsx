'use client';

// Reusable bulk-import modal for ALL 8 verticals.
// Owner gives us their existing list (text, photo, PDF, Excel, CSV);
// we POST to /api/parse-catalog and render structured rows in an
// editable preview table, then merge into form state on confirm.

import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

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
}: Props) {
  const [mode, setMode] = useState<Mode>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    if (!open) {
      setText('');
      setFile(null);
      setParsed(null);
      setError(null);
      setMode('text');
    }
  }, [open]);

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
        if (!file) {
          setError('Choose a file first.');
          setLoading(false);
          return;
        }
        form.append('file', file);
      }
      const res = await fetch('/api/parse-catalog', { method: 'POST', body: form });
      const data = (await res.json()) as {
        success: boolean;
        items?: Record<string, unknown>[];
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success) {
        setError(data.error || `Parse failed (${res.status})`);
        setLoading(false);
        return;
      }
      setParsed(data.items || []);
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
    onConfirm(parsed, action);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {sectionLabel} — paste, upload an image / PDF / Excel of your existing list. The AI parses it; you review before saving.
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
                <TabsTrigger value="pdf">PDF</TabsTrigger>
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
                <Label className="text-xs">Upload a photo of your menu / catalog</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-2"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Max 5 MB. A clear photo of a printed menu card works perfectly.</p>
              </TabsContent>

              <TabsContent value="pdf" className="mt-4">
                <Label className="text-xs">Upload a PDF (menu / brochure / price-list)</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="mt-2"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Max 10 MB. Works for multi-page brochures.</p>
              </TabsContent>

              <TabsContent value="excel" className="mt-4">
                <Label className="text-xs">Upload an Excel file (.xlsx)</Label>
                <Input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
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
              <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
              <Button onClick={handleParse} disabled={loading}>
                {loading ? 'Parsing...' : 'Parse'}
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
