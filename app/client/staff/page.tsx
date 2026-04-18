'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';
import { STAFF_ROLE_LABELS, DEFAULT_STAFF_LABEL } from '@/lib/types';

type AvailBlock = { start: string; end: string };
type Availability = Record<string, AvailBlock[]>;

interface StaffMember {
  staff_id: string;
  name: string;
  specialty: string;
  price: number;
  whatsapp_phone: string;
  bio: string;
  is_active: boolean;
  availability: Availability;
}

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const;
const DEFAULT_BLOCK: AvailBlock = { start: '09:00', end: '18:00' };

function emptyAvail(): Availability {
  return Object.fromEntries(DAYS.map((d) => [d, []]));
}

function AvailabilityPicker({ value, onChange }: { value: Availability; onChange: (v: Availability) => void }) {
  const toggle = (day: string) => {
    const cur = value[day] || [];
    onChange({ ...value, [day]: cur.length ? [] : [{ ...DEFAULT_BLOCK }] });
  };
  const addBlock = (day: string) => onChange({ ...value, [day]: [...(value[day] || []), { ...DEFAULT_BLOCK }] });
  const removeBlock = (day: string, i: number) =>
    onChange({ ...value, [day]: (value[day] || []).filter((_, idx) => idx !== i) });
  const updateBlock = (day: string, i: number, field: 'start' | 'end', val: string) => {
    const blocks = [...(value[day] || [])];
    blocks[i] = { ...blocks[i], [field]: val };
    onChange({ ...value, [day]: blocks });
  };

  return (
    <div className="flex flex-col gap-2 mt-3">
      {DAYS.map((day) => {
        const blocks = value[day] || [];
        const enabled = blocks.length > 0;
        return (
          <div key={day} className="border border-[var(--line)] rounded-[10px] bg-[var(--bg-2)]" style={{ padding: '10px 14px' }}>
            <div className="flex items-center gap-3 mb-1">
              <div className="capitalize font-semibold text-[13.5px] w-24">{day}</div>
              <button type="button" onClick={() => toggle(day)} className="relative rounded-full cursor-pointer flex-shrink-0"
                style={{ width: 38, height: 22, background: enabled ? 'var(--ink)' : 'var(--bg-2)', border: '1px solid var(--line)', transition: 'background .2s' }}>
                <span className="absolute top-[3px] rounded-full transition-all"
                  style={{ width: 14, height: 14, left: enabled ? 20 : 3, background: enabled ? 'var(--accent)' : 'var(--card)', boxShadow: '0 1px 3px #00000022' }} />
              </button>
              {enabled && <button type="button" onClick={() => addBlock(day)} className="text-[12px] text-[var(--ink)] border-b border-[var(--ink)]">+ slot</button>}
            </div>
            {enabled && blocks.map((b, i) => (
              <div key={i} className="flex items-center gap-2 mt-1.5">
                <input type="time" value={b.start} onChange={(e) => updateBlock(day, i, 'start', e.target.value)}
                  className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] text-[12.5px]" style={{ padding: '5px 8px' }} />
                <span className="text-[var(--mute)] text-[12px]">to</span>
                <input type="time" value={b.end} onChange={(e) => updateBlock(day, i, 'end', e.target.value)}
                  className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] text-[12.5px]" style={{ padding: '5px 8px' }} />
                {blocks.length > 1 && <button type="button" onClick={() => removeBlock(day, i)} className="text-red-400 text-[12px]">✕</button>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [botType, setBotType] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ staff_id: '', name: '', specialty: '', price: '', whatsapp_phone: '', bio: '', availability: emptyAvail() });

  const labels = STAFF_ROLE_LABELS[botType] || DEFAULT_STAFF_LABEL;

  const load = async () => {
    try {
      const res = await fetch('/api/client/staff');
      const data = await res.json();
      setStaff(data.staff || []);
      setBotType(data.botType || '');
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ staff_id: '', name: '', specialty: '', price: '', whatsapp_phone: '', bio: '', availability: emptyAvail() });
    setEditingId(null);
  };

  const startEdit = (m: StaffMember) => {
    setForm({ staff_id: m.staff_id, name: m.name, specialty: m.specialty, price: m.price.toString(),
      whatsapp_phone: m.whatsapp_phone, bio: m.bio, availability: { ...emptyAvail(), ...m.availability } });
    setEditingId(m.staff_id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveMember = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving('form');
    try {
      const res = await fetch('/api/client/staff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: form.staff_id || undefined, name: form.name, specialty: form.specialty,
          price: form.price ? parseFloat(form.price) : 0, whatsapp_phone: form.whatsapp_phone.replace(/\D/g, ''),
          bio: form.bio, availability: form.availability, is_active: true }),
      });
      if (res.ok) { toast.success(editingId ? `${labels.singular} updated!` : `${labels.singular} added!`); resetForm(); await load(); }
      else toast.error('Failed to save');
    } finally { setSaving(null); }
  };

  const toggleActive = async (m: StaffMember) => {
    setSaving(m.staff_id);
    try {
      const res = await fetch('/api/client/staff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: m.staff_id, name: m.name, is_active: !m.is_active }),
      });
      if (res.ok) setStaff((prev) => prev.map((x) => x.staff_id === m.staff_id ? { ...x, is_active: !x.is_active } : x));
    } finally { setSaving(null); }
  };

  const removeMember = async (m: StaffMember) => {
    if (!window.confirm(`Remove ${m.name}?`)) return;
    setSaving(m.staff_id);
    try {
      const res = await fetch('/api/client/staff', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'delete', staff_id: m.staff_id }),
      });
      if (res.ok) { setStaff((prev) => prev.map((x) => x.staff_id === m.staff_id ? { ...x, is_active: false } : x)); toast.success(`${m.name} removed`); }
    } finally { setSaving(null); }
  };

  const formatAvail = (m: StaffMember) => {
    const days = DAYS.filter((d) => (m.availability?.[d]?.length ?? 0) > 0);
    return days.length ? days.map((d) => d.slice(0, 3).charAt(0).toUpperCase() + d.slice(1, 3)).join('/') : 'No schedule set';
  };

  const active = staff.filter((m) => m.is_active);
  const inactive = staff.filter((m) => !m.is_active);
  const fieldCls = 'w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]';
  const fStyle = { padding: '10px 12px' };

  const namePlaceholder: Record<string, string> = {
    clinic: 'Dr. Sharma', salon: 'Priya', coaching: 'Mr. Verma',
    restaurant: 'Chef Ravi', realestate: 'Mohan Pai', d2c: 'Support Rep'
  };
  const specialtyHint: Record<string, string> = {
    gym: 'e.g. Bodybuilding & Strength', clinic: 'e.g. Orthopedics',
    salon: 'e.g. Hair & Bridal', coaching: 'e.g. Physics & Maths',
    restaurant: 'e.g. Head Chef', realestate: 'e.g. Luxury Properties', d2c: 'e.g. Returns & Orders'
  };
  const priceHint: Record<string, string> = {
    gym: '₹ per session', clinic: '₹ consultation fee',
    salon: '₹ per service', coaching: '₹ per hour',
  };

  return (
    <>
      <PageTopbar crumbs={<><b className="text-foreground">{labels.icon} {labels.plural}</b> · {active.length} active</>} />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-5xl">
        <PageHead
          title={<>Your <span className="zt-serif">{labels.plural.toLowerCase()}.</span></>}
          sub={`Bot suggests available ${labels.plural.toLowerCase()} to customers. Each gets notified directly and can approve/reject via WhatsApp.`}
        />

        <Panel title={editingId ? `Editing: ${form.name}` : `Add new ${labels.singular.toLowerCase()}`} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">Name *</div>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder={namePlaceholder[botType] || 'Full name'} className={fieldCls} style={fStyle} />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">Specialty / Role</div>
              <input value={form.specialty} onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))}
                placeholder={specialtyHint[botType] || 'e.g. Specialty'} className={fieldCls} style={fStyle} />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">{priceHint[botType] || 'Price ₹ (optional)'}</div>
              <input type="number" min={0} value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="0" className={fieldCls} style={fStyle} />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">WhatsApp number (with country code)</div>
              <input value={form.whatsapp_phone} onChange={(e) => setForm((p) => ({ ...p, whatsapp_phone: e.target.value.replace(/\D/g, '') }))}
                placeholder="919876543210" className={fieldCls} style={fStyle} />
              <p className="text-[11.5px] text-[var(--mute)] mt-1 m-0">Bot messages this number. They reply APPROVE/REJECT.</p>
            </div>
            <div className="md:col-span-2">
              <div className="text-[12.5px] font-semibold mb-1.5">Bio (optional)</div>
              <textarea rows={2} value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                placeholder="Experience, certifications, specialisations..."
                className={fieldCls} style={{ ...fStyle, resize: 'vertical' }} />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[12.5px] font-semibold mb-1">Availability</div>
            <p className="text-[11.5px] text-[var(--mute)] m-0 mb-2">{labels.singular} can also update this via WhatsApp commands.</p>
            <AvailabilityPicker value={form.availability} onChange={(v) => setForm((p) => ({ ...p, availability: v }))} />
          </div>

          <div className="flex gap-2.5 mt-4">
            <Pill variant="ink" onClick={saveMember}>
              {saving === 'form' ? 'Saving…' : editingId ? `Update ${labels.singular.toLowerCase()}` : `Add ${labels.singular.toLowerCase()}`}
            </Pill>
            {editingId && <Pill onClick={resetForm}>Cancel</Pill>}
          </div>
        </Panel>

        {loading ? (
          <div className="animate-pulse h-48 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <>
            <Panel title={`Active ${labels.plural.toLowerCase()}`} sub={`${active.length} — bot will suggest these`}>
              {active.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] m-0 text-center py-4">No {labels.plural.toLowerCase()} yet. Add your first above.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {active.map((m) => (
                    <div key={m.staff_id} className="border border-[var(--line)] rounded-[12px] bg-[var(--card)]" style={{ padding: 16 }}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[15px]">{m.name}</div>
                          <div className="text-[12.5px] text-[var(--mute)] mt-0.5">{m.specialty}{m.price > 0 ? ` · ₹${m.price}` : ''}</div>
                          {m.whatsapp_phone && <div className="zt-mono text-[12px] text-[var(--ink-2)] mt-1 truncate">📱 +{m.whatsapp_phone}</div>}
                          <div className="text-[12px] text-[var(--mute)] mt-1">🗓 {formatAvail(m)}</div>
                          {m.bio && <div className="text-[12px] text-[var(--ink-2)] mt-1">{m.bio}</div>}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => startEdit(m)}
                            className="rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] font-semibold text-[11.5px]" style={{ padding: '5px 9px' }}>Edit</button>
                          <button onClick={() => toggleActive(m)} disabled={saving === m.staff_id}
                            className="rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] font-semibold text-[11.5px]" style={{ padding: '5px 9px' }}>Pause</button>
                          <button onClick={() => removeMember(m)} disabled={saving === m.staff_id}
                            className="rounded-[8px] border border-red-500/30 text-red-500 hover:bg-red-500/10 font-semibold text-[11.5px]" style={{ padding: '5px 9px' }}>Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {inactive.length > 0 && (
              <Panel title={`Inactive ${labels.plural.toLowerCase()}`} sub="Not shown to customers" className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {inactive.map((m) => (
                    <button key={m.staff_id} onClick={() => toggleActive(m)}
                      className="rounded-full border border-[var(--line)] hover:border-[var(--ink)] text-[12.5px] font-medium" style={{ padding: '6px 12px' }}>
                      {m.name} · reactivate
                    </button>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}

        <Panel className="mt-6" title={`${labels.singular} WhatsApp commands`} sub="They text the bot from their registered number">
          <div className="zt-mono text-[12.5px] bg-[var(--bg-2)] rounded-[8px] flex flex-col gap-1" style={{ padding: '12px 14px' }}>
            <div><b>approve BK_xxx</b> — confirm a customer booking</div>
            <div><b>reject BK_xxx reason</b> — decline with reason (customer notified)</div>
            <div><b>avail mon-fri 9am-6pm</b> — update weekly availability</div>
            <div><b>avail mon wed fri 8am-5pm</b> — specific days</div>
            <div><b>schedule</b> — view current availability</div>
            <div><b>help</b> — full command list</div>
          </div>
        </Panel>
      </div>
    </>
  );
}
