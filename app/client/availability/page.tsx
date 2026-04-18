'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Pill } from '@/components/app/primitives';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DAY_SHORT: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', wednesday: 'WED', thursday: 'THU',
  friday: 'FRI', saturday: 'SAT', sunday: 'SUN',
};

interface TimeBlock { start: string; end: string; }
interface DaySchedule { enabled: boolean; blocks: TimeBlock[]; }

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>({});
  const [slotDuration, setSlotDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/client/schedule')
      .then((res) => res.json())
      .then((data) => {
        if (data.schedule) {
          setSchedule(data.schedule);
          setSlotDuration(data.slotDuration || 30);
        } else {
          const def: Record<string, DaySchedule> = {};
          DAYS.forEach((d) => {
            def[d] = d === 'sunday'
              ? { enabled: false, blocks: [] }
              : { enabled: true, blocks: [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '17:00' }] };
          });
          setSchedule(def);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateDay = (day: string, updates: Partial<DaySchedule>) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...updates } }));
  };

  const addBlock = (day: string) => {
    const blocks = [...(schedule[day]?.blocks || []), { start: '09:00', end: '12:00' }];
    updateDay(day, { blocks });
  };

  const removeBlock = (day: string, index: number) => {
    const current = schedule[day]?.blocks || [];
    const blocks = current.filter((_, i) => i !== index);
    updateDay(day, { blocks });
  };

  const updateBlock = (day: string, index: number, field: 'start' | 'end', value: string) => {
    const current = schedule[day]?.blocks || [];
    const blocks = [...current];
    blocks[index] = { ...blocks[index], [field]: value };
    updateDay(day, { blocks });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/client/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule, slotDuration }),
      });
      if (res.ok) toast.success('Schedule saved!');
      else toast.error('Failed to save');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTopbar
        crumbs={<><b className="text-foreground">Availability</b> · weekly schedule & slots</>}
        actions={<Pill variant="ink" onClick={handleSave}>{saving ? 'Saving…' : 'Save schedule'}</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-4xl">
        <PageHead
          title={<>Your weekly <span className="zt-serif">hours.</span></>}
          sub="Bot books only inside these windows. Close a day, add a second block, tune slot length — all here."
        />

        {loading ? (
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <>
            <div
              className="flex items-center gap-4 mb-5 bg-[var(--card)] border border-[var(--line)] rounded-[14px]"
              style={{ padding: 18 }}
            >
              <label className="font-semibold text-[13px]">Slot duration</label>
              <input
                type="number"
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                min={15} max={120} step={15}
                className="w-24 rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none"
                style={{ padding: '11px 13px', fontSize: 13.5 }}
              />
              <span className="text-[var(--mute)] text-[12.5px]">minutes</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {DAYS.map((day) => {
                const raw = schedule[day] || { enabled: false, blocks: [] };
                const ds = { enabled: !!raw.enabled, blocks: Array.isArray(raw.blocks) ? raw.blocks : [] };
                return (
                  <div key={day} className="border border-[var(--line)] rounded-[14px] bg-[var(--card)]" style={{ padding: '18px 20px' }}>
                    <div className="flex items-center gap-3.5 mb-2">
                      <div className="w-[42px] h-[42px] rounded-[10px] bg-[var(--bg-2)] grid place-items-center">
                        <span className="zt-mono text-[10px] text-[var(--mute)]">{DAY_SHORT[day]}</span>
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold capitalize text-[14px]">{day}</div>
                        <div className="zt-mono text-[12.5px] text-[var(--mute)]">
                          {ds.enabled ? (ds.blocks.length ? `${ds.blocks.length} window${ds.blocks.length > 1 ? 's' : ''}` : 'Open · add windows') : 'Closed'}
                        </div>
                      </div>
                      <button
                        onClick={() => updateDay(day, { enabled: !ds.enabled })}
                        className="relative rounded-full cursor-pointer"
                        style={{
                          width: 38, height: 22,
                          background: ds.enabled ? 'var(--ink)' : 'var(--bg-2)',
                          transition: 'background .2s',
                        }}
                        aria-label="toggle"
                      >
                        <span
                          className="absolute top-[3px] rounded-full transition-all"
                          style={{
                            width: 16, height: 16,
                            left: ds.enabled ? 19 : 3,
                            background: ds.enabled ? 'var(--accent)' : 'var(--card)',
                            boxShadow: '0 1px 3px #00000022',
                          }}
                        />
                      </button>
                    </div>
                    {ds.enabled && (
                      <div className="flex flex-col gap-2 mt-3">
                        {ds.blocks.map((block, i) => (
                          <div key={i} className="flex items-center gap-2.5">
                            <input
                              type="time"
                              value={block.start}
                              onChange={(e) => updateBlock(day, i, 'start', e.target.value)}
                              className="w-[110px] rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-[13px]"
                              style={{ padding: '8px 10px' }}
                            />
                            <span className="text-[var(--mute)] text-[12px]">to</span>
                            <input
                              type="time"
                              value={block.end}
                              onChange={(e) => updateBlock(day, i, 'end', e.target.value)}
                              className="w-[110px] rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-[13px]"
                              style={{ padding: '8px 10px' }}
                            />
                            <button
                              onClick={() => removeBlock(day, i)}
                              className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] hover:border-[var(--ink)] font-semibold text-[11.5px]"
                              style={{ padding: '6px 10px' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addBlock(day)}
                          className="rounded-[10px] border border-dashed border-[var(--line)] text-[var(--mute)] font-semibold text-[12.5px] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                          style={{ padding: '10px 12px' }}
                        >
                          + Add time block
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
