'use client';

// Outlets editor — owner-only.
//
// Lists every outlet under this chain with editable rows. Each row
// captures the operational fields the bot + dashboard need: name,
// slug, address, lat/lng, delivery radius, FSSAI, GSTIN, manager
// email, opening hours, brand colour, active toggle.
//
// Slug is the SHORT code embedded in per-outlet QR text (e.g. "@SAK").
// The server normalises slugs to uppercase + alphanumeric on save.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface OutletDraft {
  id: string;
  slug: string;
  name: string;
  address: string;
  city?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  deliveryRadiusKm?: number;
  fssaiLicenseNumber?: string;
  fssaiExpiryDate?: string;
  gstin?: string;
  managerEmail?: string;
  openingHours?: string;
  brandColor?: string;
  isActive: boolean;
  whatsappNumber?: string;
}

function emptyOutlet(): OutletDraft {
  return {
    id: '',
    slug: '',
    name: '',
    address: '',
    isActive: true,
  };
}

export function OutletsEditor({ businessName }: { businessName: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [outlets, setOutlets] = useState<OutletDraft[]>([]);
  const [multiEnabled, setMultiEnabled] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/client/restaurant/outlets');
        if (!res.ok) throw new Error(`Load failed (${res.status})`);
        const data = (await res.json()) as {
          ok: boolean;
          outlets?: OutletDraft[];
          multiOutletEnabled?: boolean;
        };
        if (data.ok) {
          setOutlets(data.outlets || []);
          setMultiEnabled(!!data.multiOutletEnabled);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load outlets');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function update(idx: number, patch: Partial<OutletDraft>) {
    const next = [...outlets];
    next[idx] = { ...next[idx], ...patch };
    setOutlets(next);
    setDirty(true);
  }

  function addOutlet() {
    setOutlets([...outlets, emptyOutlet()]);
    setDirty(true);
  }

  function archiveOutlet(idx: number) {
    // Soft-archive: mark inactive instead of deleting so the existing
    // order history for this outlet stays queryable (Phase 3D data
    // invariant: data keyed on outlet_id, never on the outlet's row
    // existence in kb.outlets).
    update(idx, { isActive: false });
    toast.message('Outlet archived', { description: 'Existing orders + table data preserved. Toggle Active back on to restore.' });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/client/restaurant/outlets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlets }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      setDirty(false);
      setMultiEnabled(outlets.length > 1);
      toast.success('Outlets saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '60px 32px' }}>
        <p className="text-sm text-muted-foreground">Loading outlets…</p>
      </div>
    );
  }

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant /{' '}
            <a href="/client/restaurant" className="hover:underline">Overview</a>
            {' '}/ <b className="text-foreground">Outlets</b>
          </>
        }
        actions={
          <Pill variant="ink" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={
            <>
              {businessName}{' '}
              <span className="zt-serif">outlets.</span>
            </>
          }
          sub={
            multiEnabled || outlets.length > 1
              ? `${outlets.length} outlet${outlets.length === 1 ? '' : 's'} configured. The bot routes orders by QR scan, customer location, or branch picker.`
              : `Single-location setup. Add a second outlet here to switch on multi-outlet mode (one WhatsApp number serves all outlets).`
          }
        />

        <div className="space-y-4">
          {outlets.map((o, idx) => (
            <Panel
              key={o.id || idx}
              title={
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{o.name || 'New outlet'}</span>
                  {o.slug && (
                    <span className="text-[10px] uppercase tracking-[.06em] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                      @{o.slug}
                    </span>
                  )}
                  {!o.isActive && (
                    <span className="text-[10px] uppercase tracking-[.06em] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                      Archived
                    </span>
                  )}
                </div>
              }
              action={
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Switch
                      checked={o.isActive}
                      onCheckedChange={(v) => update(idx, { isActive: v })}
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    onClick={() => archiveOutlet(idx)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    Archive
                  </button>
                </div>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5">
                  <Label className="text-xs">Outlet name *</Label>
                  <Input
                    placeholder="Saket"
                    value={o.name}
                    onChange={(e) => update(idx, { name: e.target.value })}
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">
                    Short code (slug) *
                    <span className="text-[10px] text-muted-foreground ml-1">— used in QR</span>
                  </Label>
                  <Input
                    placeholder="SAK"
                    value={o.slug}
                    maxLength={12}
                    onChange={(e) => update(idx, { slug: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })}
                  />
                </div>
                <div className="md:col-span-4">
                  <Label className="text-xs">Outlet manager email</Label>
                  <Input
                    type="email"
                    placeholder="rohit.saket@example.com"
                    value={o.managerEmail || ''}
                    onChange={(e) => update(idx, { managerEmail: e.target.value })}
                  />
                </div>

                <div className="md:col-span-8">
                  <Label className="text-xs">Address *</Label>
                  <Input
                    placeholder="Shop 5, Saket Mall, Saket New Delhi 110017"
                    value={o.address}
                    onChange={(e) => update(idx, { address: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">City</Label>
                  <Input
                    placeholder="New Delhi"
                    value={o.city || ''}
                    onChange={(e) => update(idx, { city: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Pincode</Label>
                  <Input
                    placeholder="110017"
                    value={o.pincode || ''}
                    maxLength={12}
                    onChange={(e) => update(idx, { pincode: e.target.value })}
                  />
                </div>

                <div className="md:col-span-3">
                  <Label className="text-xs">Latitude</Label>
                  <Input
                    type="number"
                    step="0.0000001"
                    placeholder="28.5245"
                    value={o.latitude ?? ''}
                    onChange={(e) => update(idx, { latitude: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">Longitude</Label>
                  <Input
                    type="number"
                    step="0.0000001"
                    placeholder="77.2066"
                    value={o.longitude ?? ''}
                    onChange={(e) => update(idx, { longitude: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Delivery radius (km)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="5"
                    value={o.deliveryRadiusKm ?? ''}
                    onChange={(e) => update(idx, { deliveryRadiusKm: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  />
                </div>
                <div className="md:col-span-4">
                  <Label className="text-xs">Opening hours</Label>
                  <Input
                    placeholder="11:00 - 23:00"
                    value={o.openingHours || ''}
                    onChange={(e) => update(idx, { openingHours: e.target.value })}
                  />
                </div>

                <div className="md:col-span-4">
                  <Label className="text-xs">FSSAI licence (this outlet)</Label>
                  <Input
                    placeholder="14-digit number"
                    value={o.fssaiLicenseNumber || ''}
                    maxLength={14}
                    onChange={(e) => update(idx, { fssaiLicenseNumber: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">FSSAI expiry</Label>
                  <Input
                    type="date"
                    value={o.fssaiExpiryDate || ''}
                    onChange={(e) => update(idx, { fssaiExpiryDate: e.target.value })}
                  />
                </div>
                <div className="md:col-span-3">
                  <Label className="text-xs">GSTIN (this outlet)</Label>
                  <Input
                    placeholder="29XXXXX1234X1Z5"
                    value={o.gstin || ''}
                    maxLength={15}
                    onChange={(e) => update(idx, { gstin: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Brand colour</Label>
                  <Input
                    type="color"
                    value={o.brandColor || '#111111'}
                    onChange={(e) => update(idx, { brandColor: e.target.value })}
                  />
                </div>
              </div>
            </Panel>
          ))}

          <Button type="button" variant="outline" onClick={addOutlet}>
            + Add outlet
          </Button>
        </div>

        <div className="mt-6 text-[11.5px] text-muted-foreground space-y-1">
          <p>
            <b>Tip:</b> Outlet slug is what gets embedded in the QR scan
            text (e.g. <code>@SAK</code>). Keep it short — uppercase
            letters and digits only.
          </p>
          <p>
            <b>Lat / Lng:</b> open Google Maps on the outlet, right-click
            the pin, and paste the coordinates here. The bot uses these
            to route delivery orders to the nearest outlet inside its
            delivery radius.
          </p>
          <p>
            <b>Manager email:</b> save here for display only. To actually
            give that person dashboard access, use Settings →&nbsp;
            <a href="/client/restaurant/team" className="underline">
              Team Members
            </a>{' '}
            (lets you swap or revoke access without losing any of this
            outlet&apos;s data).
          </p>
        </div>
      </div>
    </>
  );
}
