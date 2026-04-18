'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';

type AvailBlock = { start: string; end: string };
type Availability = Record<string, AvailBlock[]>;

interface Trainer {
  trainer_id: string;
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

// ─── Availability picker ───
function AvailabilityPicker({ value, onChange }: { value: Availability; onChange: (v: Availability) => void }) {
  const toggle = (day: string) => {
    const cur = value[day] || [];
    onChange({ ...value, [day]: cur.length ? [] : [{ ...DEFAULT_BLOCK }] });
  };
  const addBlock = (day: string) =>
    onChange({ ...value, [day]: [...(value[day] || []), { ...DEFAULT_BLOCK }] });
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
              <button
                type="button"
                onClick={() => toggle(day)}
                className="relative rounded-full cursor-pointer flex-shrink-0"
                style={{ width: 38, height: 22, background: enabled ? 'var(--ink)' : 'var(--bg-2)', border: '1px solid var(--line)', transition: 'background .2s' }}
              >
                <span
                  className="absolute top-[3px] rounded-full transition-all"
                  style={{ width: 14, height: 14, left: enabled ? 20 : 3, background: enabled ? 'var(--accent)' : 'var(--card)', boxShadow: '0 1px 3px #00000022' }}
                />
              </button>
              {enabled && (
                <button type="button" onClick={() => addBlock(day)} className="text-[12px] text-[var(--ink)] border-b border-[var(--ink)]">
                  + slot
                </button>
              )}
            </div>
            {enabled && blocks.map((b, i) => (
              <div key={i} className="flex items-center gap-2 mt-1.5">
                <input type="time" value={b.start} onChange={(e) => updateBlock(day, i, 'start', e.target.value)}
                  className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] text-[12.5px]" style={{ padding: '5px 8px' }} />
                <span className="text-[var(--mute)] text-[12px]">to</span>
                <input type="time" value={b.end} onChange={(e) => updateBlock(day, i, 'end', e.target.value)}
                  className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] text-[12.5px]" style={{ padding: '5px 8px' }} />
                {blocks.length > 1 && (
                  <button type="button" onClick={() => removeBlock(day, i)} className="text-red-400 text-[12px]">✕</button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ───
export default function TrainersPage() {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    trainer_id: '', name: '', specialty: '', price: '',
    whatsapp_phone: '', bio: '', availability: emptyAvail(),
  });

  const load = async () => {
    try {
      const res = await fetch('/api/client/trainers');
      const data = await res.json();
      setTrainers(data.trainers || []);
    } catch { toast.error('Failed to load trainers'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ trainer_id: '', name: '', specialty: '', price: '', whatsapp_phone: '', bio: '', availability: emptyAvail() });
    setEditingId(null);
  };

  const startEdit = (t: Trainer) => {
    setForm({ trainer_id: t.trainer_id, name: t.name, specialty: t.specialty,
      price: t.price.toString(), whatsapp_phone: t.whatsapp_phone, bio: t.bio,
      availability: { ...emptyAvail(), ...t.availability } });
    setEditingId(t.trainer_id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveTrainer = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving('form');
    try {
      const res = await fetch('/api/client/trainers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainer_id: form.trainer_id || undefined,
          name: form.name, specialty: form.specialty,
          price: form.price ? parseFloat(form.price) : 0,
          whatsapp_phone: form.whatsapp_phone.replace(/\D/g, ''),
          bio: form.bio, availability: form.availability, is_active: true,
        }),
      });
      if (res.ok) { toast.success(editingId ? 'Trainer updated!' : 'Trainer added!'); resetForm(); await load(); }
      else toast.error('Failed to save');
    } finally { setSaving(null); }
  };

  const toggleActive = async (t: Trainer) => {
    setSaving(t.trainer_id);
    try {
      const res = await fetch('/api/client/trainers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trainer_id: t.trainer_id, name: t.name, is_active: !t.is_active }),
      });
      if (res.ok) setTrainers((prev) => prev.map((x) => x.trainer_id === t.trainer_id ? { ...x, is_active: !x.is_active } : x));
    } finally { setSaving(null); }
  };

  const removeTrainer = async (t: Trainer) => {
    if (!window.confirm(`Remove ${t.name}?`)) return;
    setSaving(t.trainer_id);
    try {
      const res = await fetch('/api/client/trainers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ _action: 'delete', trainer_id: t.trainer_id }),
      });
      if (res.ok) { setTrainers((prev) => prev.map((x) => x.trainer_id === t.trainer_id ? { ...x, is_active: false } : x)); toast.success(`${t.name} removed`); }
    } finally { setSaving(null); }
  };

  const formatAvail = (t: Trainer) => {
    const days = DAYS.filter((d) => (t.availability?.[d]?.length ?? 0) > 0);
    if (!days.length) return 'No schedule set';
    return days.map((d) => d.slice(0, 3).charAt(0).toUpperCase() + d.slice(1, 3)).join('/');
  };

  const active = trainers.filter((t) => t.is_active);
  const inactive = trainers.filter((t) => !t.is_active);

  const fieldCls = 'w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]';
  const fieldStyle = { padding: '10px 12px' };

  return (
    <>
      <PageTopbar crumbs={<><b className="text-foreground">Trainers</b> · {active.length} active</>} />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-5xl">
        <PageHead
          title={<>Your <span className="zt-serif">team.</span></>}
          sub="Bot suggests available trainers. Each gets notified directly and can approve/reject via WhatsApp."
        />

        <Panel title={editingId ? `Editing: ${form.name}` : 'Add new trainer'} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">Name *</div>
              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Rahul Sharma" className={fieldCls} style={fieldStyle} />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">Specialty</div>
              <input value={form.specialty} onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))}
                placeholder="Bodybuilding & Strength" className={fieldCls} style={fieldStyle} />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">Price per session ₹</div>
              <input type="number" min={0} value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                placeholder="2000" className={fieldCls} style={fieldStyle} />
            </div>
            <div>
              <div className="text-[12.5px] font-semibold mb-1.5">WhatsApp number (with country code)</div>
              <input value={form.whatsapp_phone} onChange={(e) => setForm((p) => ({ ...p, whatsapp_phone: e.target.value.replace(/\D/g, '') }))}
                placeholder="919876543210" className={fieldCls} style={fieldStyle} />
              <p className="text-[11.5px] text-[var(--mute)] mt-1 m-0">Bot texts this number for booking notifications. Trainer replies APPROVE/REJECT.</p>
            </div>
            <div className="md:col-span-2">
              <div className="text-[12.5px] font-semibold mb-1.5">Bio (optional)</div>
              <textarea rows={2} value={form.bio} onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
                placeholder="5 years experience, NSCA certified..." className={fieldCls} style={{ ...fieldStyle, resize: 'vertical' }} />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[12.5px] font-semibold mb-1">Availability</div>
            <p className="text-[11.5px] text-[var(--mute)] m-0 mb-2">Toggle days, set time slots. Trainer can also update themselves via WhatsApp commands.</p>
            <AvailabilityPicker value={form.availability} onChange={(v) => setForm((p) => ({ ...p, availability: v }))} />
          </div>

          <div className="flex gap-2.5 mt-4">
            <Pill variant="ink" onClick={saveTrainer}>
              {saving === 'form' ? 'Saving…' : editingId ? 'Update trainer' : 'Add trainer'}
            </Pill>
            {editingId && <Pill onClick={resetForm}>Cancel</Pill>}
          </div>
        </Panel>

        {loading ? (
          <div className="animate-pulse h-48 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <>
            <Panel title="Active trainers" sub={`${active.length} trainer${active.length !== 1 ? 's' : ''} — bot will suggest these`}>
              {active.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] m-0 text-center py-4">No trainers yet. Add your first above.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {active.map((t) => (
                    <div key={t.trainer_id} className="border border-[var(--line)] rounded-[12px] bg-[var(--card)]" style={{ padding: 16 }}>
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[15px]">{t.name}</div>
                          <div className="text-[12.5px] text-[var(--mute)] mt-0.5">
                            {t.specialty}{t.price > 0 ? ` · ₹${t.price}/session` : ''}
                          </div>
                          {t.whatsapp_phone && (
                            <div className="zt-mono text-[12px] text-[var(--ink-2)] mt-1 truncate">
                              📱 +{t.whatsapp_phone} — gets booking notifications
                            </div>
                          )}
                          <div className="text-[12px] text-[var(--mute)] mt-1">🗓 {formatAvail(t)}</div>
                          {t.bio && <div className="text-[12px] text-[var(--ink-2)] mt-1">{t.bio}</div>}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => startEdit(t)}
                            className="rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] font-semibold text-[11.5px]" style={{ padding: '5px 9px' }}>
                            Edit
                          </button>
                          <button onClick={() => toggleActive(t)} disabled={saving === t.trainer_id}
                            className="rounded-[8px] border border-[var(--line)] hover:border-[var(--ink)] font-semibold text-[11.5px]" style={{ padding: '5px 9px' }}>
                            Pause
                          </button>
                          <button onClick={() => removeTrainer(t)} disabled={saving === t.trainer_id}
                            className="rounded-[8px] border border-red-500/30 text-red-500 hover:bg-red-500/10 font-semibold text-[11.5px]" style={{ padding: '5px 9px' }}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {inactive.length > 0 && (
              <Panel title="Inactive trainers" sub="Not shown to customers" className="mt-4">
                <div className="flex flex-wrap gap-2">
                  {inactive.map((t) => (
                    <button key={t.trainer_id} onClick={() => toggleActive(t)}
                      className="rounded-full border border-[var(--line)] hover:border-[var(--ink)] text-[12.5px] font-medium" style={{ padding: '6px 12px' }}>
                      {t.name} · reactivate
                    </button>
                  ))}
                </div>
              </Panel>
            )}
          </>
        )}

        <Panel className="mt-6" title="Trainer WhatsApp commands" sub="Trainers text the bot from their own number">
          <div className="zt-mono text-[12.5px] bg-[var(--bg-2)] rounded-[8px] flex flex-col gap-1" style={{ padding: '12px 14px' }}>
            <div><b>avail mon-fri 9am-6pm</b> — update weekly availability</div>
            <div><b>avail mon wed fri 8am-5pm</b> — specific days</div>
            <div><b>off today</b> — mark today as unavailable</div>
            <div><b>schedule</b> — view current availability</div>
            <div><b>approve BK_xxx</b> — approve a customer booking</div>
            <div><b>reject BK_xxx reason</b> — reject with reason</div>
          </div>
        </Panel>
      </div>
    </>
  );
}
