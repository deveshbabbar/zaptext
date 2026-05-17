'use client';

// Approve / Decline buttons for a pending advance reservation. Mounted as an
// island inside the otherwise-server-rendered /client/restaurant/tables page.
// Only rendered for bookings in 'pending' or 'pending_approval' status —
// confirmed/cancelled rows show only their StatusPill from the parent.
//
// Decline opens a small inline modal asking for an optional reason (passed
// to the customer-facing WhatsApp message). Approve is one-click.
//
// After a successful PATCH we call router.refresh() so the next render of
// the page picks up the new status from the DB without a full reload.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface BookingActionsProps {
  bookingId: string;
}

export function BookingActions({ bookingId }: BookingActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<'approve' | 'decline' | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function send(decision: 'approved' | 'declined', reasonText?: string) {
    setBusy(decision === 'approved' ? 'approve' : 'decline');
    setError(null);
    try {
      const res = await fetch(`/api/booking/${encodeURIComponent(bookingId)}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, ...(reasonText ? { reason: reasonText } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || `Failed (${res.status})`);
        return;
      }
      setDeclineOpen(false);
      setReason('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => send('approved')}
        disabled={busy !== null}
        className="rounded-[8px] border border-[var(--accent)] text-[var(--accent)] font-semibold text-[11.5px] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]"
        style={{ padding: '5px 11px' }}
        aria-label="Approve booking"
      >
        {busy === 'approve' ? 'Approving…' : 'Approve'}
      </button>
      <button
        type="button"
        onClick={() => setDeclineOpen(true)}
        disabled={busy !== null}
        className="rounded-[8px] border border-[var(--line)] text-[var(--mute)] font-semibold text-[11.5px] disabled:opacity-50 disabled:cursor-not-allowed hover:border-red-400 hover:text-red-500"
        style={{ padding: '5px 11px' }}
        aria-label="Decline booking"
      >
        Decline
      </button>

      {declineOpen && (
        <div
          role="dialog"
          aria-label="Decline booking"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && busy === null) setDeclineOpen(false);
          }}
        >
          <div
            className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] w-full max-w-md shadow-xl"
            style={{ padding: '20px 22px' }}
          >
            <div className="text-[15px] font-bold mb-1">Decline this booking?</div>
            <div className="text-[12.5px] text-[var(--mute)] mb-3">
              The customer will get a WhatsApp message letting them know. An optional reason helps them rebook.
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 200))}
              placeholder="Reason (optional, max 200 chars) — e.g. fully booked at that hour, please try 9pm"
              rows={3}
              maxLength={200}
              disabled={busy !== null}
              className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--bg)] focus:border-[var(--ink)] focus:outline-none text-[13px] disabled:opacity-50"
              style={{ padding: '10px 12px' }}
            />
            <div className="text-[10.5px] text-[var(--mute)] zt-mono mt-1">
              {reason.length}/200
            </div>
            {error && (
              <div className="text-[12px] text-red-500 mt-2" role="alert">
                {error}
              </div>
            )}
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => {
                  setDeclineOpen(false);
                  setReason('');
                  setError(null);
                }}
                disabled={busy !== null}
                className="rounded-[8px] border border-[var(--line)] font-semibold text-[12px] disabled:opacity-50"
                style={{ padding: '7px 14px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => send('declined', reason.trim() || undefined)}
                disabled={busy !== null}
                className="rounded-[8px] bg-red-500 text-white font-semibold text-[12px] disabled:opacity-50"
                style={{ padding: '7px 14px' }}
              >
                {busy === 'decline' ? 'Declining…' : 'Decline & notify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && !declineOpen && (
        <span className="text-[11px] text-red-500 ml-2" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
