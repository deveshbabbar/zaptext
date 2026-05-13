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
  dineInUnlocked?: boolean;
  initialAutoRotateEnabled?: boolean;
  initialAutoRotateIntervalHours?: number;
}

export function QrCodesClient({
  initialTables,
  botPhone,
  dineInUnlocked = true,
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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string; upgradeTo?: string };
      if (!res.ok || !data.ok) {
        // Surface server's human-readable `message` first (e.g. plan-gate
        // explanation) so the user sees WHY it failed instead of an opaque
        // `PLAN_LIMIT` code.
        throw new Error(data.message || data.error || `Add failed (${res.status})`);
      }
      setNewTable('');
      setNewSeats('');
      toast.success(`Table ${tableNumber} added`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Add failed', { duration: 8000 });
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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; created?: number; skipped?: number; error?: string; message?: string; upgradeTo?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.message || data.error || `Bulk add failed (${res.status})`);
      }
      toast.success(`Added ${data.created || 0} tables${data.skipped ? `, skipped ${data.skipped} duplicate${data.skipped === 1 ? '' : 's'}` : ''}`);
      setBulkCount('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk add failed', { duration: 8000 });
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

  // Action buttons are disabled when either: (a) bot phone is missing
  // (QRs would encode an empty wa.me link), or (b) dine-in is plan-locked
  // (server-side gate will 403 anyway — surface that here so the click
  // doesn't appear to silently fail).
  const actionsDisabled = !botPhone || !dineInUnlocked;
  const disabledReason = !botPhone
    ? 'Add a WhatsApp number in Settings first.'
    : !dineInUnlocked
      ? 'Dine-in is a Growth-plan feature. Upgrade to add tables.'
      : '';

  return (
    <div className="space-y-4">
      {/* Plan-gate banner — only when dine-in is locked. Replaces silent
          "Dine-in is a Growth feature" panel from the server page with a
          prominent CTA so the owner immediately knows why their clicks
          aren't doing anything. */}
      {!dineInUnlocked && (
        <div
          className="rounded-[12px] border"
          style={{ padding: '14px 16px', borderColor: '#f59e0b', background: '#f59e0b10' }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold mb-1">⚠ Dine-in is on the Growth plan</div>
              <div className="text-[12.5px] text-[var(--mute)]">
                Adding tables, generating QRs, and accepting QR-scan orders all unlock at ₹1,499/mo.
                You can preview the layout below — the buttons stay locked until you upgrade.
              </div>
            </div>
            <a
              href="/client/subscription#upgrade"
              className="rounded-[8px] text-[12.5px] font-semibold"
              style={{ padding: '8px 14px', background: '#f59e0b', color: '#fff' }}
            >
              Upgrade to Growth →
            </a>
          </div>
        </div>
      )}

      <Panel title="Quick setup" sub="Numbered tables 1, 2, 3... Skips numbers you already have.">
        <div className="flex flex-col md:flex-row gap-2 md:items-end">
          <div style={{ width: 160 }}>
            <Label className="text-xs">How many tables?</Label>
            <Input
              type="number"
              placeholder="10"
              value={bulkCount}
              onChange={(e) => setBulkCount(e.target.value)}
              disabled={actionsDisabled}
            />
          </div>
          <Button
            type="button"
            onClick={bulkAddTables}
            disabled={bulking || actionsDisabled}
            title={actionsDisabled ? disabledReason : undefined}
          >
            {bulking ? 'Adding…' : 'Add tables 1–N'}
          </Button>
          {actionsDisabled && (
            <span className="text-[11.5px] text-[var(--mute)]">{disabledReason}</span>
          )}
        </div>
      </Panel>

      <Panel title="Or add one at a time" sub="Common names: 1, 2, 3 ... or T1, T2 ... or Counter-A, Outdoor-3. Up to 16 characters.">
        <div className="flex flex-col md:flex-row gap-2 md:items-end">
          <div className="flex-1">
            <Label className="text-xs">Table number / label</Label>
            <Input
              placeholder="e.g. 9"
              value={newTable}
              onChange={(e) => setNewTable(e.target.value)}
              disabled={actionsDisabled}
            />
          </div>
          <div style={{ width: 120 }}>
            <Label className="text-xs">Seats (optional)</Label>
            <Input
              type="number"
              placeholder="4"
              value={newSeats}
              onChange={(e) => setNewSeats(e.target.value)}
              disabled={actionsDisabled}
            />
          </div>
          <Button
            type="button"
            onClick={addTable}
            disabled={adding || actionsDisabled}
            title={actionsDisabled ? disabledReason : undefined}
          >
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
                <div className="text-[10px] text-muted-foreground mt-2 text-center">
                  Scan opens: <span className="zt-mono">Order Table {t.tableNumber}</span>
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

      {/* Auto-rotate sits at the bottom — it's an optional security feature
          (rotating tokens invalidates printed QRs). Off by default so it
          doesn't surprise the owner. Only show when dine-in is unlocked
          (no point offering this when the rest of the page is locked). */}
      {dineInUnlocked && (
        <Panel
          title="Auto-rotate tokens (optional)"
          sub="Off by default. Turn ON only if you want stale photos / screenshots of QRs to stop working — bot will then auto-rotate every table's token on schedule (default 24h). You'll have to reprint the QR sheet each rotation."
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
      )}
    </div>
  );
}
