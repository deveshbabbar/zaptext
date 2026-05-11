'use client';

// Salon services editor. Same nested {category, items: [...]} shape as
// the Restaurant menu, with different per-item fields (name/price/duration
// instead of name/price/description/isVeg/isBestseller).

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill, Panel } from '@/components/app/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SalonServicesBulkImport } from '@/components/forms/bulk-import-buttons';

type ServiceItem = { name?: string; price?: string; duration?: string };
type ServiceCategory = { category?: string; items?: ServiceItem[] };

function emptyItem(): ServiceItem { return { name: '', price: '', duration: '' }; }

export function ServicesEditor({ businessName }: { businessName: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kb, setKb] = useState<Record<string, unknown>>({});
  const [services, setServices] = useState<ServiceCategory[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/client/settings');
        if (!res.ok) throw new Error(`load failed (${res.status})`);
        const data = (await res.json()) as { knowledgeBase: string };
        const parsed = data.knowledgeBase ? JSON.parse(data.knowledgeBase) : {};
        setKb(parsed);
        setServices(Array.isArray(parsed.services) ? parsed.services : []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not load services');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const bulkData = { services };
  const bulkOnChange = (f: string, v: unknown) => { if (f === 'services' && Array.isArray(v)) { setServices(v as ServiceCategory[]); setDirty(true); } };
  const addCat = () => { setServices([...services, { category: '', items: [emptyItem()] }]); setDirty(true); };
  const removeCat = (i: number) => { setServices(services.filter((_, idx) => idx !== i)); setDirty(true); };
  const updateCat = (i: number, name: string) => { const n = [...services]; n[i] = { ...n[i], category: name }; setServices(n); setDirty(true); };
  const addItem = (ci: number) => { const n = [...services]; n[ci] = { ...n[ci], items: [...(n[ci].items || []), emptyItem()] }; setServices(n); setDirty(true); };
  const removeItem = (ci: number, ii: number) => { const n = [...services]; n[ci] = { ...n[ci], items: (n[ci].items || []).filter((_, x) => x !== ii) }; setServices(n); setDirty(true); };
  const updateItem = (ci: number, ii: number, patch: Partial<ServiceItem>) => {
    const n = [...services];
    const items = [...(n[ci].items || [])];
    items[ii] = { ...items[ii], ...patch };
    n[ci] = { ...n[ci], items };
    setServices(n);
    setDirty(true);
  };

  async function handleSave() {
    setSaving(true);
    try {
      const nextKb = { ...kb, services };
      const res = await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: { knowledge_base_json: JSON.stringify(nextKb) } }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) throw new Error(data.message || data.error || `save failed (${res.status})`);
      setKb(nextKb);
      setDirty(false);
      toast.success('Services saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const totalItems = services.reduce((n, c) => n + (Array.isArray(c.items) ? c.items.length : 0), 0);

  if (loading) return <div style={{ padding: '60px 32px' }}><p className="text-sm text-muted-foreground">Loading services…</p></div>;

  return (
    <>
      <PageTopbar
        crumbs={<>Salon / <a href="/client/salon" className="hover:underline">Overview</a> / <b className="text-foreground">Services</b></>}
        actions={
          <>
            <SalonServicesBulkImport data={bulkData} onChange={bulkOnChange} />
            <Pill variant="ink" onClick={handleSave} disabled={!dirty || saving}>{saving ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</Pill>
          </>
        }
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead title={<>{businessName} <span className="zt-serif">services.</span></>} sub={`${totalItems} service${totalItems === 1 ? '' : 's'} across ${services.length} section${services.length === 1 ? '' : 's'}. Bulk import or add manually.`} />
        <div className="space-y-4">
          {services.length === 0 && (
            <Panel title="No services yet" sub="Use Bulk import to load your service list from photo / paste / Excel, or add manually.">
              <Button type="button" onClick={addCat}>+ Add section</Button>
            </Panel>
          )}
          {services.map((cat, ci) => (
            <Panel
              key={ci}
              title={<Input className="h-9 text-base font-semibold" placeholder="Section (e.g., Hair)" value={cat.category || ''} onChange={(e) => updateCat(ci, e.target.value)} />}
              action={<button type="button" onClick={() => removeCat(ci)} className="text-xs text-muted-foreground hover:text-destructive">Remove section</button>}
            >
              <div className="space-y-3">
                {(cat.items || []).map((item, ii) => (
                  <div key={ii} className="grid grid-cols-1 md:grid-cols-12 gap-2 border-b border-border pb-3 last:border-b-0">
                    <div className="md:col-span-5">
                      <Label className="text-xs">Service</Label>
                      <Input placeholder="Haircut" value={item.name || ''} onChange={(e) => updateItem(ci, ii, { name: e.target.value })} />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">Price</Label>
                      <Input placeholder="Rs.500 or Short Rs.500 / Long Rs.800" value={item.price || ''} onChange={(e) => updateItem(ci, ii, { price: e.target.value })} />
                    </div>
                    <div className="md:col-span-3">
                      <Label className="text-xs">Duration</Label>
                      <Input placeholder="45 min" value={item.duration || ''} onChange={(e) => updateItem(ci, ii, { duration: e.target.value })} />
                    </div>
                    <div className="md:col-span-1 flex items-end">
                      <button type="button" onClick={() => removeItem(ci, ii)} className="text-[11px] text-muted-foreground hover:text-destructive">Remove</button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => addItem(ci)}>+ Add service</Button>
              </div>
            </Panel>
          ))}
          {services.length > 0 && <Button type="button" variant="outline" onClick={addCat}>+ Add another section</Button>}
        </div>
      </div>
    </>
  );
}
