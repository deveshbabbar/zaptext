'use client';

// Generic flat-list catalog editor. Five of our seven verticals store their
// catalog as a flat array of records under a single knowledge-base field
// (coursesOffered, currentListings, membershipPlans, plans, products). One
// component, configured per-vertical via props, edits any of them.
//
// Salon and Restaurant use a nested {category, items: [...]} shape and have
// their own editors — same load/save flow, different UI.

import { useEffect, useState, ComponentType } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export interface FlatFieldDef {
  key: string;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number' | 'boolean';
  colSpan?: number;
}

type Row = Record<string, unknown>;

interface Props {
  businessName: string;
  crumbVertical: string;
  crumbVerticalHref: string;
  crumbLabel: string;
  field: string;
  fields: FlatFieldDef[];
  newItem: () => Row;
  emptyHint: string;
  addLabel: string;
  BulkImport: ComponentType<{ data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }>;
}

// Tailwind needs literal class names to make it into the CSS. Map colSpan
// values to known classes instead of building the string dynamically.
const COL_SPAN_CLASS: Record<number, string> = {
  1: 'md:col-span-1', 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4',
  5: 'md:col-span-5', 6: 'md:col-span-6', 7: 'md:col-span-7', 8: 'md:col-span-8',
  9: 'md:col-span-9', 10: 'md:col-span-10', 11: 'md:col-span-11', 12: 'md:col-span-12',
};

export function FlatCatalogEditor({
  businessName,
  crumbVertical,
  crumbVerticalHref,
  crumbLabel,
  field,
  fields,
  newItem,
  emptyHint,
  addLabel,
  BulkImport,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kb, setKb] = useState<Record<string, unknown>>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/client/settings');
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const data = (await res.json()) as { knowledgeBase: string };
        const parsed = data.knowledgeBase ? JSON.parse(data.knowledgeBase) : {};
        setKb(parsed);
        setRows(Array.isArray(parsed[field]) ? parsed[field] : []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load catalog');
      } finally {
        setLoading(false);
      }
    })();
  }, [field]);

  const bulkImportData: Record<string, unknown> = { [field]: rows };
  const bulkImportOnChange = (f: string, v: unknown) => {
    if (f === field && Array.isArray(v)) {
      setRows(v as Row[]);
      setDirty(true);
    }
  };

  function addRow() {
    setRows([...rows, newItem()]);
    setDirty(true);
  }
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i));
    setDirty(true);
  }
  function updateRow(i: number, key: string, value: unknown) {
    const next = [...rows];
    next[i] = { ...next[i], [key]: value };
    setRows(next);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const nextKb = { ...kb, [field]: rows };
      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: { knowledge_base_json: JSON.stringify(nextKb) } }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.message || data.error || `save failed (${res.status})`);
      setKb(nextKb);
      setDirty(false);
      toast.success(`${crumbLabel} saved`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 32px' }}>
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            {crumbVertical} / <a href={crumbVerticalHref} className="hover:underline">Overview</a> /{' '}
            <b className="text-foreground">{crumbLabel}</b>
          </>
        }
        actions={
          <>
            <BulkImport data={bulkImportData} onChange={bulkImportOnChange} />
            <Pill variant="ink" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
            </Pill>
          </>
        }
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={<>{businessName} <span className="zt-serif">{crumbLabel.toLowerCase()}.</span></>}
          sub={`${rows.length} item${rows.length === 1 ? '' : 's'}. Bulk import from photo / Excel / paste, or add one at a time.`}
        />
        <div className="space-y-3">
          {rows.length === 0 && (
            <Panel title={`No ${crumbLabel.toLowerCase()} yet`} sub={emptyHint}>
              <Button type="button" onClick={addRow}>+ {addLabel}</Button>
            </Panel>
          )}
          {rows.map((row, i) => (
            <Panel
              key={i}
              title={typeof row.name === 'string' && row.name ? row.name : <span className="text-muted-foreground">Untitled</span>}
              action={
                <button type="button" onClick={() => removeRow(i)} className="text-xs text-muted-foreground hover:text-destructive">
                  Remove
                </button>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                {fields.map((f) => (
                  <div key={f.key} className={COL_SPAN_CLASS[f.colSpan ?? 4] || 'md:col-span-4'}>
                    <Label className="text-xs">{f.label}</Label>
                    {f.type === 'boolean' ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Switch
                          checked={!!row[f.key]}
                          onCheckedChange={(v) => updateRow(i, f.key, v)}
                        />
                        <span className="text-xs">{f.label}</span>
                      </div>
                    ) : (
                      <Input
                        placeholder={f.placeholder}
                        type={f.type === 'number' ? 'number' : 'text'}
                        value={(row[f.key] as string | number | undefined) ?? ''}
                        onChange={(e) =>
                          updateRow(
                            i,
                            f.key,
                            f.type === 'number'
                              ? e.target.value === ''
                                ? undefined
                                : Number(e.target.value)
                              : e.target.value
                          )
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </Panel>
          ))}
          {rows.length > 0 && (
            <Button type="button" variant="outline" onClick={addRow}>+ {addLabel}</Button>
          )}
        </div>
      </div>
    </>
  );
}
