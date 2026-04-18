'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Tabs as ZTabs, StatusPill } from '@/components/app/primitives';

interface BookingItem {
  booking_id: string;
  customer_name: string;
  customer_phone: string;
  date: string;
  time_slot: string;
  end_time: string;
  service: string;
  status: string;
  notes: string;
}

type TabKey = 'upcoming' | 'past' | 'cancelled';

export default function ClientBookingsPage() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('upcoming');

  useEffect(() => {
    fetch('/api/client/bookings')
      .then((res) => res.json())
      .then((data) => {
        setBookings(data.bookings || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleCancel = async (bookingId: string) => {
    const reason = window.prompt(
      'Reason for cancellation? (optional — customer will see this)\n\nExamples: Out of stock, Doctor unavailable, Kitchen closed early'
    );
    if (reason === null) return; // user pressed Cancel on prompt
    setCancellingId(bookingId);
    try {
      const res = await fetch('/api/booking/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, reason: reason.trim() }),
      });
      if (res.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.booking_id === bookingId ? { ...b, status: 'cancelled' } : b))
        );
        toast.success('Cancelled — customer notified on WhatsApp');
      } else {
        toast.error('Failed to cancel booking');
      }
    } catch {
      toast.error('Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && b.date >= todayIST);
  const past = bookings.filter((b) => b.status === 'completed' || (b.status === 'confirmed' && b.date < todayIST));
  const cancelled = bookings.filter((b) => b.status === 'cancelled');

  const list = tab === 'upcoming' ? upcoming : tab === 'past' ? past : cancelled;

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Bookings</b> · {bookings.length} total · {upcoming.length} upcoming
          </>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              All your <span className="zt-serif">bookings.</span>
            </>
          }
          sub="Managed by the bot — cancel or review any time."
        />

        <ZTabs<TabKey>
          active={tab}
          onChange={setTab}
          items={[
            { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
            { id: 'past', label: 'Past', count: past.length },
            { id: 'cancelled', label: 'Cancelled', count: cancelled.length },
          ]}
        />

        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] overflow-hidden">
          {loading ? (
            <div className="p-10 animate-pulse text-[var(--mute)]">Loading…</div>
          ) : list.length === 0 ? (
            <div className="text-center text-[var(--mute)] py-16">No bookings in this tab.</div>
          ) : (
            <table className="w-full text-[13.5px]" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Date', 'Time', 'Customer', 'Service', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      className="zt-mono text-[10.5px] tracking-[.08em] uppercase text-[var(--mute)] font-medium bg-[var(--bg-2)]"
                      style={{ padding: '14px 16px', textAlign: 'left', borderBottom: '1px solid var(--line)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.booking_id} className="hover:bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]">
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                      <span className="zt-mono text-[12.5px]">{b.date}</span>
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                      <span className="zt-mono text-[12.5px]">
                        {b.time_slot}
                        {b.end_time ? `–${b.end_time}` : ''}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                      <div className="font-semibold">{b.customer_name}</div>
                      <div className="zt-mono text-[11.5px] text-[var(--mute)]">{b.customer_phone}</div>
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                      {b.service || '—'}
                      {b.notes && <div className="text-[11.5px] text-[var(--mute)] mt-0.5">{b.notes}</div>}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}>
                      <StatusPill
                        variant={b.status === 'cancelled' ? 'cancel' : b.status === 'confirmed' ? 'ok' : 'pending'}
                      >
                        {b.status}
                      </StatusPill>
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)', textAlign: 'right' }}>
                      {b.status === 'confirmed' && (
                        <button
                          onClick={() => handleCancel(b.booking_id)}
                          disabled={cancellingId === b.booking_id}
                          className="rounded-[8px] border border-[var(--line)] bg-[var(--card)] hover:border-[var(--ink)] font-semibold text-[11.5px] disabled:opacity-50"
                          style={{ padding: '6px 10px' }}
                        >
                          {cancellingId === b.booking_id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
