'use client';

// Interactive customer-directory table. Receives the full server-baked
// list via prop, then handles in-browser search filtering and a CSV
// download. Kept as a client island so the page's initial paint stays
// data-baked HTML — the interactive bits hydrate after.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CustomerSummary, CustomerSource } from '@/lib/db/customers';

interface Props {
  rows: CustomerSummary[];
}

const SOURCE_META: Record<CustomerSource, { label: string; emoji: string }> = {
  chat:     { label: 'Chat',     emoji: '💬' },
  orders:   { label: 'Orders',   emoji: '🛒' },
  bookings: { label: 'Bookings', emoji: '📅' },
  grocery:  { label: 'Grocery',  emoji: '🛍️' },
};

function formatPhone(raw: string): string {
  // Render "+91 98765 43210" if it parses as a 10-digit India number,
  // else show whatever we have. Doesn't mutate the stored value — UI
  // only.
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return raw || '—';
}

function timeAgo(iso: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function shortDate(iso: string): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '—';
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

// Excel/LibreOffice formula-injection mitigation — same logic the
// conversations export uses. Customer names + phones are recorded
// from user input, so a name like `=HYPERLINK(...)` would otherwise
// fire as a formula when the owner opens the CSV.
function csvCell(v: unknown): string {
  const s = String(v ?? '');
  const lead = s.charCodeAt(0);
  const isFormula = lead === 0x09 || lead === 0x0d || lead === 0x3d || lead === 0x2b || lead === 0x2d || lead === 0x40;
  const safe = isFormula ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function buildCsv(rows: CustomerSummary[]): string {
  const header = [
    'name', 'phone', 'sources', 'messages', 'orders', 'bookings',
    'grocery_orders', 'first_seen', 'last_seen',
  ].join(',');
  const lines = rows.map((r) =>
    [
      r.name,
      r.phone,
      r.sources.join('|'),
      r.messageCount,
      r.orderCount,
      r.bookingCount,
      r.groceryOrderCount,
      r.firstSeen,
      r.lastSeen,
    ].map(csvCell).join(',')
  );
  return [header, ...lines].join('\r\n');
}

function downloadCsv(rows: CustomerSummary[]) {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().slice(0, 10);
  a.download = `customers-${stamp}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CustomersTable({ rows }: Props) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    const needleDigits = needle.replace(/\D/g, '');
    return rows.filter((r) => {
      const name = (r.name || '').toLowerCase();
      const phone = r.phone.toLowerCase();
      return (
        name.includes(needle) ||
        phone.includes(needle) ||
        (needleDigits.length > 0 && phone.replace(/\D/g, '').includes(needleDigits))
      );
    });
  }, [rows, q]);

  return (
    <div className="rounded-[16px] border border-[var(--line)] bg-[var(--card)] overflow-hidden">
      <div className="flex items-center gap-3 flex-wrap p-3 sm:p-4 border-b border-[var(--line)]">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or phone…"
          aria-label="Search customers"
          className="flex-1 min-w-[200px] rounded-[10px] border border-[var(--line)] bg-[var(--background)] px-3.5 py-2 text-[14px] outline-none focus:border-[var(--ink)]"
        />
        <div className="text-[12.5px] text-[var(--mute)] zt-mono">
          {filtered.length === rows.length
            ? `${rows.length.toLocaleString('en-IN')} customers`
            : `${filtered.length.toLocaleString('en-IN')} of ${rows.length.toLocaleString('en-IN')}`}
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(filtered)}
          disabled={filtered.length === 0}
          className="rounded-[10px] bg-[var(--ink)] text-[var(--background)] text-[13px] font-semibold px-3.5 py-2 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-black transition"
        >
          Download CSV
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-[var(--mute)] text-[14px]">
          {rows.length === 0
            ? "No customers yet. They'll appear here the moment someone messages your bot or places an order via your menu link."
            : 'No customers match that search.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="text-left text-[var(--mute)] zt-mono text-[11px] uppercase tracking-[.08em]">
                <th className="py-2.5 px-3 sm:px-4 font-medium">Name</th>
                <th className="py-2.5 px-3 sm:px-4 font-medium">Phone</th>
                <th className="py-2.5 px-3 sm:px-4 font-medium">Activity</th>
                <th className="py-2.5 px-3 sm:px-4 font-medium">Last seen</th>
                <th className="py-2.5 px-3 sm:px-4 font-medium">First seen</th>
                <th className="py-2.5 px-3 sm:px-4 font-medium text-right">Open</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.phone}
                  className="border-t border-[var(--line)] hover:bg-[color-mix(in_oklab,var(--accent)_4%,transparent)]"
                >
                  <td className="py-3 px-3 sm:px-4">
                    <div className="font-semibold tracking-[-0.01em]">
                      {r.name || <span className="text-[var(--mute)] font-normal italic">(no name)</span>}
                    </div>
                  </td>
                  <td className="py-3 px-3 sm:px-4">
                    <a
                      href={`https://wa.me/${r.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="zt-mono text-[12.5px] text-[var(--ink-2)] hover:text-[var(--ink)] underline-offset-2 hover:underline"
                      title="Open WhatsApp"
                    >
                      {formatPhone(r.phone)}
                    </a>
                  </td>
                  <td className="py-3 px-3 sm:px-4">
                    <div className="flex flex-wrap gap-1.5 items-center">
                      {r.sources.map((s) => (
                        <SourceBadge
                          key={s}
                          source={s}
                          count={
                            s === 'chat' ? r.messageCount
                            : s === 'orders' ? r.orderCount
                            : s === 'bookings' ? r.bookingCount
                            : r.groceryOrderCount
                          }
                        />
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-3 sm:px-4 text-[var(--ink-2)] whitespace-nowrap">{timeAgo(r.lastSeen)}</td>
                  <td className="py-3 px-3 sm:px-4 text-[var(--mute)] whitespace-nowrap">{shortDate(r.firstSeen)}</td>
                  <td className="py-3 px-3 sm:px-4 text-right">
                    <Link
                      href={`/client/conversations?phone=${encodeURIComponent(r.phone)}`}
                      className="text-[12.5px] font-semibold text-[var(--ink-2)] hover:text-[var(--ink)] underline-offset-2 hover:underline"
                    >
                      Open chat →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SourceBadge({ source, count }: { source: CustomerSource; count: number }) {
  const meta = SOURCE_META[source];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-2)] border border-[var(--line)] px-2 py-[3px] text-[11.5px] zt-mono"
      title={`${meta.label}: ${count}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      <span className="text-[var(--ink-2)]">{meta.label}</span>
      {count > 0 && <span className="text-[var(--mute)] tabular-nums">{count}</span>}
    </span>
  );
}
