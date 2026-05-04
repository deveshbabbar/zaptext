'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill, StatusPill } from '@/components/app/primitives';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Override { date: string; override_type: string; reason: string; }
interface BookingItem {
  date: string; time_slot: string; end_time: string;
  customer_name: string; service: string; status: string;
  // null = generic gym slot. Non-null = booked with this specific trainer.
  // Drives the per-trainer calendar filter below.
  staff_id: string | null;
}
interface StaffOption { staff_id: string; name: string; specialty: string; is_active: boolean; }

const STAFF_FILTER_ALL = '__all__';
const STAFF_FILTER_GENERIC = '__generic__';

export default function CalendarPage() {
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [staffFilter, setStaffFilter] = useState<string>(STAFF_FILTER_ALL);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/client/date-overrides').then((r) => r.json()),
      fetch('/api/client/bookings').then((r) => r.json()),
      fetch('/api/client/staff').then((r) => r.json()).catch(() => ({ staff: [] })),
    ])
      .then(([ovData, bkData, staffData]) => {
        setOverrides(ovData.overrides || []);
        setBookings(bkData.bookings || []);
        const list = (staffData.staff || []) as StaffOption[];
        setStaff(list.filter((s) => s.is_active));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const formatDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const isBlocked = (d: string) => overrides.some((o) => o.date === d && o.override_type === 'blocked');
  // Per-trainer scoping — STAFF_FILTER_ALL: every booking; STAFF_FILTER_GENERIC:
  // only generic gym slots (staff_id null); a specific id: only that trainer's
  // rows. Drives both the day dots on the calendar grid AND the day-detail list.
  const matchesStaffFilter = (b: BookingItem) =>
    staffFilter === STAFF_FILTER_ALL ? true
    : staffFilter === STAFF_FILTER_GENERIC ? b.staff_id == null
    : b.staff_id === staffFilter;
  const getBookingsForDay = (d: string) =>
    bookings.filter((b) => b.date === d && b.status === 'confirmed' && matchesStaffFilter(b));
  const getOverride = (d: string) => overrides.find((o) => o.date === d);
  const staffFilterLabel =
    staffFilter === STAFF_FILTER_ALL ? 'All bookings'
    : staffFilter === STAFF_FILTER_GENERIC ? 'Generic gym slots'
    : (staff.find((s) => s.staff_id === staffFilter)?.name || 'Trainer');

  const handleBlockDate = async () => {
    if (!selectedDate) return;
    try {
      await fetch('/api/client/date-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, override_type: 'blocked', reason: blockReason }),
      });
      setOverrides((prev) => [...prev, { date: selectedDate, override_type: 'blocked', reason: blockReason }]);
      setBlockReason('');
      setShowBlockForm(false);
      toast.success('Date blocked!');
    } catch {
      toast.error('Failed to block date');
    }
  };

  const selectedBookings = selectedDate ? getBookingsForDay(selectedDate) : [];
  const selectedOverride = selectedDate ? getOverride(selectedDate) : null;

  return (
    <>
      <PageTopbar
        crumbs={<><b className="text-foreground">Calendar</b> · {MONTHS[month]} {year} · <span className="text-[var(--mute)]">{staffFilterLabel}</span></>}
        actions={
          <>
            {staff.length > 0 && (
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className="rounded-full border border-[var(--line)] bg-[var(--card)] text-[12.5px] font-semibold focus:border-[var(--ink)] focus:outline-none"
                style={{ padding: '6px 10px' }}
                title="Filter by trainer / staff member"
              >
                <option value={STAFF_FILTER_ALL}>All bookings</option>
                <option value={STAFF_FILTER_GENERIC}>Generic gym slots</option>
                {staff.map((s) => (
                  <option key={s.staff_id} value={s.staff_id}>
                    {s.name}{s.specialty ? ` — ${s.specialty}` : ''}
                  </option>
                ))}
              </select>
            )}
            <Pill variant="ghost" onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}>← Prev</Pill>
            <Pill variant="ghost" onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}>Next →</Pill>
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Month at a <span className="zt-serif">glance.</span></>}
          sub="Bookings, blocked days, density — at a glance."
        />

        {loading ? (
          <div className="animate-pulse h-96 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            <div
              className="grid grid-cols-7 gap-1 bg-[var(--card)] border border-[var(--line)] rounded-[14px]"
              style={{ padding: 12 }}
            >
              {DAYS.map((d) => (
                <div key={d} className="zt-mono text-[10.5px] text-[var(--mute)] text-center py-2">
                  {d}
                </div>
              ))}
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`e-${i}`} className="aspect-square" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = formatDate(day);
                const blocked = isBlocked(dateStr);
                const dayBookings = getBookingsForDay(dateStr);
                const isToday = dateStr === today;
                const isSelected = dateStr === selectedDate;
                const isPast = dateStr < today;
                const has = dayBookings.length > 0;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`aspect-square rounded-[10px] flex flex-col justify-between text-[12px] text-left cursor-pointer transition-all border ${
                      blocked
                        ? 'bg-red-500/10 border-red-500/20'
                        : has
                        ? 'bg-[var(--accent)] text-[var(--accent-2)] font-semibold border-transparent'
                        : 'bg-[var(--bg-2)] border-transparent hover:bg-[#f5eadb]'
                    } ${isToday ? 'ring-1 ring-[var(--ink)]' : ''} ${isSelected ? 'ring-2 ring-[var(--ink)]' : ''} ${isPast ? 'opacity-60' : ''}`}
                    style={{ padding: '6px 8px' }}
                  >
                    <span className={`zt-mono font-bold ${blocked ? 'text-red-400 line-through' : ''}`}>{day}</span>
                    {blocked && <span className="text-[9.5px] text-red-400">Blocked</span>}
                    {has && !blocked && (
                      <span className="text-[9.5px] opacity-80">
                        {dayBookings.length} booking{dayBookings.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3.5">
              {selectedDate ? (
                <>
                  <Panel
                    title={new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
                      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  >
                    {selectedOverride?.override_type === 'blocked' ? (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-[10px] p-3">
                        <div className="text-[13px] font-semibold text-red-400">Day blocked</div>
                        {selectedOverride.reason && (
                          <div className="text-[12px] text-[var(--mute)] mt-1">{selectedOverride.reason}</div>
                        )}
                      </div>
                    ) : selectedBookings.length === 0 ? (
                      <p className="text-[13px] text-[var(--mute)] m-0">No bookings.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {selectedBookings.map((b, i) => (
                          <div key={i} className="border border-[var(--line)] rounded-[10px] p-2.5">
                            <div className="flex justify-between items-baseline">
                              <div className="font-semibold text-[13.5px]">{b.customer_name}</div>
                              <div className="zt-mono text-[12px] text-[var(--ink)]">
                                {b.time_slot}–{b.end_time}
                              </div>
                            </div>
                            {b.service && (
                              <div className="text-[12px] text-[var(--mute)] mt-0.5">{b.service}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>

                  {!isBlocked(selectedDate) && selectedDate >= today && (
                    <Panel>
                      {showBlockForm ? (
                        <div className="flex flex-col gap-2.5">
                          <input
                            placeholder="Reason (optional)"
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            className="rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
                            style={{ padding: '11px 13px' }}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleBlockDate}
                              className="flex-1 rounded-[12px] bg-red-500 text-white font-semibold text-[13px] py-3 hover:bg-red-600"
                            >
                              Block this day
                            </button>
                            <Pill onClick={() => setShowBlockForm(false)}>Cancel</Pill>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowBlockForm(true)}
                          className="w-full rounded-[12px] border border-red-500/30 text-red-400 font-semibold text-[13px] py-3 hover:bg-red-500/10"
                        >
                          Block this day
                        </button>
                      )}
                    </Panel>
                  )}
                </>
              ) : (
                <Panel>
                  <div className="text-center text-[var(--mute)] py-6">
                    <div className="text-[32px] mb-1">📆</div>
                    <div className="text-[13px]">Click a date to see details</div>
                  </div>
                </Panel>
              )}

              <Panel title="Upcoming blocked dates">
                {overrides.filter((o) => o.override_type === 'blocked' && o.date >= today).length === 0 ? (
                  <p className="text-[13px] text-[var(--mute)] m-0">No upcoming blocks.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {overrides
                      .filter((o) => o.override_type === 'blocked' && o.date >= today)
                      .map((o, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-[13px] py-1.5"
                          style={{ borderBottom: '1px solid var(--line)' }}
                        >
                          <div>
                            <span className="zt-mono font-semibold">{o.date}</span>
                            {o.reason && <span className="text-[var(--mute)] ml-2">— {o.reason}</span>}
                          </div>
                          <StatusPill variant="cancel">Blocked</StatusPill>
                        </div>
                      ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
