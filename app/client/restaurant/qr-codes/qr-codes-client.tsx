'use client';

// QR codes management UI. Adds / removes tables, rotates all tokens, and
// previews each QR live. Uses router.refresh() after each mutation so the
// server-rendered preview re-renders with the new tokens.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Panel } from '@/components/app/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface TableCard {
  id: string;
  tableNumber: string;
  qrToken: string;
  qrTokenRotatedAt: string;
  seats: number;
  isActive: boolean;
  waUrl: string;
  qrDataUrl: string;
}

interface Props {
  initialTables: TableCard[];
  botPhone: string;
  initialAutoRotateEnabled?: boolean;
  initialAutoRotateIntervalHours?: number;
}

export function QrCodesClient({
  initialTables,
  botPhone,
  initialAutoRotateEnabled = false,
  initialAutoRotateIntervalHours = 24,
}: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [newTable, setNewTable] = useState('');
  const [newSeats, setNewSeats] = useState('');
  const [bulkCount, setBulkCount] = useState('');
  const [bulking, setBulking] = useState(false);
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(initialAutoRotateEnabled);
  const [autoRotateInterval, setAutoRotateInterval] = useState(String(initialAutoRotateIntervalHours));
  const [savingAutoRotate, setSavingAutoRotate] = useState(false);

  // Persist the auto-rotate toggle / interval into knowledge_base_json
  // via /api/client/settings. The settings endpoint expects bulk: { kb }
  // so we fetch current kb first, patch the two keys, and write back —
  // overwriting the whole blob keeps other restaurant config intact.
  async function saveAutoRotate(enabled: boolean, intervalHoursStr: string) {
    setSavingAutoRotate(true);
    try {
      const intervalNum = Math.max(6, Math.min(168, Number(intervalHoursStr) || 24));
      const cur = await fetch('/api/client/settings');
      const curData = (await cur.json().catch(() => ({}))) as { knowledgeBase?: string };
      const kb = curData.knowledgeBase ? JSON.parse(curData.knowledgeBase) : {};
      kb.qrAutoRotateEnabled = enabled;
      kb.qrAutoRotateIntervalHours = intervalNum;
      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: { knowledge_base_json: JSON.stringify(kb) } }),
      });
      if (!res.ok) throw new Error(`save failed (${res.status})`);
      toast.success(enabled ? `Auto-rotate ON · every ${intervalNum}h` : 'Auto-rotate OFF');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
      setAutoRotateEnabled(!enabled); // revert
    } finally {
      setSavingAutoRotate(false);
    }
  }

  async function addTable() {
    const tableNumber = newTable.trim();
    if (!tableNumber) {
      toast.error('Enter a table number first');
      return;
    }
    if (!/^[\w-]{1,16}$/.test(tableNumber)) {
      toast.error('Table number must be 1-16 letters/digits/dashes');
      return;
    }
    setAdding(true);
    try {
      const res = await fetch('/api/client/restaurant/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableNumber, seats: Number(newSeats) || 0 }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `Add failed (${res.status})`);
      setNewTable('');
      setNewSeats('');
      toast.success(`Table ${tableNumber} added`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Add failed');
    } finally {
      setAdding(false);
    }
  }

  async function removeTable(tableNumber: string) {
    if (!confirm(`Deactivate Table ${tableNumber}? The QR will stop working — you can always add it back.`)) return;
    try {
      const url = `/api/client/restaurant/tables?tableNumber=${encodeURIComponent(tableNumber)}`;
      const res = await fetch(url, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `Remove failed (${res.status})`);
      toast.success(`Table ${tableNumber} removed`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  }

  async function bulkAddTables() {
    const count = Number(bulkCount) || 0;
    if (count < 1 || count > 100) {
      toast.error('Enter a count between 1 and 100');
      return;
    }
    setBulking(true);
    try {
      const res = await fetch('/api/client/restaurant/tables/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; created?: number; skipped?: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `Bulk add failed (${res.status})`);
      toast.success(`Added ${data.created || 0} tables${data.skipped ? `, skipped ${data.skipped} duplicate${data.skipped === 1 ? '' : 's'}` : ''}`);
      setBulkCount('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk add failed');
    } finally {
      setBulking(false);
    }
  }

  async function rotateAll() {
    if (!confirm('Rotate ALL table tokens? Currently printed QRs will stop working — make sure you re-print after.')) return;
    setRotating(true);
    try {
      const res = await fetch('/api/client/restaurant/tables/rotate-all', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; rotated?: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `Rotate failed (${res.status})`);
      toast.success(`Rotated tokens for ${data.rotated || 0} tables — reprint the sheet now.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rotate failed');
    } finally {
      setRotating(false);
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Quick setup" sub="Numbered tables 1, 2, 3... Skips numbers you already have.">
        <div className="flex flex-col md:flex-row gap-2 md:items-end">
          <div style={{ width: 160 }}>
            <Label className="text-xs">How many tables?</Label>
            <Input type="number" placeholder="10" value={bulkCount} onChange={(e) => setBulkCount(e.target.value)} />
          </div>
          <Button type="button" variant="outline" onClick={bulkAddTables} disabled={bulking || !botPhone}>
            {bulking ? 'Adding…' : 'Add tables 1–N'}
          </Button>
        </div>
      </Panel>

      <Panel
        title="Auto-rotate tokens"
        sub="Daily cron rotates every QR token. Old printed/screenshot QRs stop working — reprint the sheet each morning. Run at 09:00 IST as part of the morning bucket."
      >
        <div className="flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoRotateEnabled}
              disabled={savingAutoRotate}
              onCheckedChange={(v) => {
                setAutoRotateEnabled(!!v);
                saveAutoRotate(!!v, autoRotateInterval);
              }}
            />
            <Label className="text-xs">Enable auto-rotation</Label>
          </div>
          <div style={{ width: 160 }}>
            <Label className="text-xs">Interval (hours)</Label>
            <Input
              type="number"
              min={6}
              max={168}
              placeholder="24"
              value={autoRotateInterval}
              disabled={!autoRotateEnabled || savingAutoRotate}
              onChange={(e) => setAutoRotateInterval(e.target.value)}
              onBlur={() => {
                if (autoRotateEnabled) saveAutoRotate(true, autoRotateInterval);
              }}
            />
          </div>
        </div>
      </Panel>

      <Panel title="Or add one at a time" sub="Common names: 1, 2, 3 ... or T1, T2 ... or Counter-A, Outdoor-3. Up to 16 characters.">
        <div className="flex flex-col md:flex-row gap-2 md:items-end">
          <div className="flex-1">
            <Label className="text-xs">Table number / label</Label>
            <Input placeholder="e.g. 9" value={newTable} onChange={(e) => setNewTable(e.target.value)} />
          </div>
          <div style={{ width: 120 }}>
            <Label className="text-xs">Seats (optional)</Label>
            <Input type="number" placeholder="4" value={newSeats} onChange={(e) => setNewSeats(e.target.value)} />
          </div>
          <Button type="button" onClick={addTable} disabled={adding || !botPhone}>
            {adding ? 'Adding…' : 'Add table'}
          </Button>
        </div>
      </Panel>

      {initialTables.length > 0 && (
        <Panel
          title={`${initialTables.filter((t) => t.isActive).length} active table${initialTables.filter((t) => t.isActive).length === 1 ? '' : 's'}`}
          sub={botPhone ? `QRs encode wa.me/${botPhone.replace(/\D/g, '')} with each table's rotating token.` : 'Add a WhatsApp number in Settings to enable QR generation.'}
          action={
            <Button type="button" variant="outline" size="sm" onClick={rotateAll} disabled={rotating}>
              {rotating ? 'Rotating…' : 'Rotate all tokens'}
            </Button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {initialTables.map((t) => (
              <div key={t.id} className={`border rounded-lg p-3 flex flex-col items-center ${t.isActive ? '' : 'opacity-50'}`}>
                <div className="text-sm font-semibold mb-2">Table {t.tableNumber}</div>
                {t.qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.qrDataUrl} alt={`QR for table ${t.tableNumber}`} style={{ width: 180, height: 180 }} />
                ) : (
                  <div style={{ width: 180, height: 180 }} className="flex items-center justify-center text-xs text-muted-foreground border border-dashed">
                    Configure bot phone first
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground mt-2 text-center break-all">
                  Token: {t.qrToken}
                </div>
                <div className="flex gap-2 mt-3">
                  {t.waUrl && (
                    <a href={t.waUrl} target="_blank" rel="noreferrer" className="text-xs underline text-foreground">
                      Test scan
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => removeTable(t.tableNumber)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
