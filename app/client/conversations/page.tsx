'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { PageTopbar, PageHead, MonoLabel } from '@/components/app/primitives';

interface Message {
  timestamp: string;
  customer_phone: string;
  direction: string;
  message: string;
}

// Parse the timestamp shape this endpoint returns. The data layer writes
// IST display strings ("DD-MM-YYYY HH:MM:SS") for legacy reasons; ISO is
// also accepted. Failure returns null so the UI falls back gracefully.
function parseTs(raw: string): Date | null {
  if (!raw) return null;
  // ISO first
  const iso = new Date(raw);
  if (!isNaN(iso.getTime())) return iso;
  // "DD-MM-YYYY HH:MM:SS" format
  const m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const d = new Date(
      Number(m[3]), Number(m[2]) - 1, Number(m[1]),
      Number(m[4]), Number(m[5]), Number(m[6] ?? '0')
    );
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function timeAgo(d: Date): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function dayLabel(d: Date): string {
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return 'Today';
  const yesterday = new Date(today.getTime() - 86400000);
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
}

function timeOnly(d: Date): string {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function initials(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.slice(-2) || '··';
}

interface ThreadEntry {
  msg: Message;
  date: Date | null;
  showDayBreak: boolean;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  // Set of customer phones currently in "owner takeover" mode — comes
  // from /api/client/conversations on each load + flips locally on
  // toggle so the UI feels instant.
  const [pausedSet, setPausedSet] = useState<Set<string>>(new Set());
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pauseBusy, setPauseBusy] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  function reload() {
    fetch('/api/client/conversations')
      .then((res) => res.json())
      .then((data) => {
        setConversations(data.conversations || {});
        if (Array.isArray(data.paused_customers)) {
          setPausedSet(new Set(data.paused_customers as string[]));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  async function togglePause(phone: string, paused: boolean) {
    setPauseBusy(true);
    try {
      const res = await fetch('/api/client/conversations/pause-customer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_phone: phone, paused }),
      });
      const data = await res.json();
      if (res.ok) {
        setPausedSet((prev) => {
          const next = new Set(prev);
          if (data.paused) next.add(phone); else next.delete(phone);
          return next;
        });
      }
    } finally {
      setPauseBusy(false);
    }
  }

  async function sendOwnerMessage() {
    if (!activePhone || !composer.trim() || sending) return;
    setSendError(null);
    setSending(true);
    try {
      const text = composer.trim();
      const res = await fetch('/api/client/conversations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_phone: activePhone, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data?.message || data?.error || 'Send failed');
        return;
      }
      // Optimistic: append a synthetic outgoing row so the thread updates
      // instantly. Reload pulls the canonical row + timestamp from server.
      setConversations((prev) => ({
        ...prev,
        [activePhone]: [
          ...(prev[activePhone] || []),
          {
            timestamp: new Date().toISOString(),
            customer_phone: activePhone,
            direction: 'outgoing',
            message: `[owner] ${text}`,
          },
        ],
      }));
      setComposer('');
      // Pull canonical state in the background so the badge / count refresh.
      setTimeout(reload, 800);
    } catch (e) {
      setSendError(String(e));
    } finally {
      setSending(false);
    }
  }

  const phones = useMemo(() => Object.keys(conversations), [conversations]);

  // Most-recently-active first (better than insertion order)
  const sortedPhones = useMemo(() => {
    return [...phones].sort((a, b) => {
      const la = parseTs(conversations[a].at(-1)?.timestamp || '')?.getTime() ?? 0;
      const lb = parseTs(conversations[b].at(-1)?.timestamp || '')?.getTime() ?? 0;
      return lb - la;
    });
  }, [phones, conversations]);

  useEffect(() => {
    if (!activePhone && sortedPhones.length) setActivePhone(sortedPhones[0]);
  }, [sortedPhones, activePhone]);

  const filtered = useMemo(
    () =>
      sortedPhones.filter((p) => {
        if (!query) return true;
        const msgs = conversations[p];
        const last = msgs[msgs.length - 1]?.message || '';
        return (
          p.toLowerCase().includes(query.toLowerCase()) ||
          last.toLowerCase().includes(query.toLowerCase())
        );
      }),
    [sortedPhones, query, conversations]
  );

  const thread = activePhone ? conversations[activePhone] || [] : [];

  // Build thread entries with day-break flags so the UI can render
  // separators between calendar days.
  const threadEntries: ThreadEntry[] = useMemo(() => {
    const entries: ThreadEntry[] = [];
    let lastDayKey = '';
    for (const m of thread) {
      const date = parseTs(m.timestamp);
      const key = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : '';
      const showDayBreak = key !== lastDayKey;
      if (showDayBreak) lastDayKey = key;
      entries.push({ msg: m, date, showDayBreak });
    }
    return entries;
  }, [thread]);

  const totalMessages = phones.reduce((s, p) => s + conversations[p].length, 0);

  // Auto-scroll to the latest message whenever the active thread changes
  // or new messages arrive. Smooth scroll feels nicer than a snap-jump.
  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    });
  }, [activePhone, thread.length]);

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Conversations</b> · {phones.length} chat{phones.length === 1 ? '' : 's'} · {totalMessages} message{totalMessages === 1 ? '' : 's'}
          </>
        }
        actions={
          <a
            href="/api/client/conversations/export"
            download
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--line)] bg-[var(--card)] hover:border-[var(--ink)] text-[12.5px] font-semibold transition"
            style={{ padding: '7px 13px' }}
          >
            ⬇ Export
          </a>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Your <span className="zt-serif">inbox.</span>
            </>
          }
          sub="Every chat your bot handled — with timestamps and context."
        />

        {loading ? (
          <ConversationsSkeleton />
        ) : phones.length === 0 ? (
          <EmptyState />
        ) : (
          <div
            className="grid grid-cols-[320px_1fr] border border-[var(--line)] rounded-[18px] bg-[var(--card)] overflow-hidden"
            style={{ minHeight: 'calc(100vh - 220px)' }}
          >
            {/* ─── Conversation list ─── */}
            <aside
              className="border-r border-[var(--line)] overflow-y-auto"
              style={{ maxHeight: 'calc(100vh - 220px)' }}
            >
              <div
                className="flex gap-1.5 items-center border-b border-[var(--line)] bg-[var(--card)] sticky top-0 z-10"
                style={{ padding: '14px 16px' }}
              >
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by phone or message…"
                  className="flex-1 bg-[var(--bg-2)] border border-[var(--line)] rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-[var(--ink)]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="text-[var(--mute)] hover:text-foreground text-[14px]"
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              {filtered.length === 0 ? (
                <div className="text-center text-[12.5px] text-[var(--mute)] py-10 px-4">
                  No matches.
                </div>
              ) : (
                filtered.map((phone) => {
                  const msgs = conversations[phone];
                  const last = msgs[msgs.length - 1];
                  const lastDate = parseTs(last?.timestamp || '');
                  const isOn = phone === activePhone;
                  const lastIsBot = last?.direction === 'outgoing';
                  return (
                    <button
                      key={phone}
                      onClick={() => setActivePhone(phone)}
                      className={`w-full text-left flex gap-2.5 border-b border-[var(--line)] transition ${
                        isOn ? 'bg-[var(--accent)]' : 'hover:bg-[var(--bg-2)]'
                      }`}
                      style={{ padding: '14px 16px' }}
                    >
                      <div
                        className={`w-[38px] h-[38px] rounded-full grid place-items-center font-bold text-[13px] flex-shrink-0 ${
                          isOn ? 'bg-[var(--ink)] text-[var(--accent)]' : 'bg-[var(--bg-2)] text-[var(--ink)]'
                        }`}
                      >
                        {initials(phone)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-1.5">
                          <span className="font-semibold text-[13.5px] truncate">{phone}</span>
                          <span
                            className={`zt-mono text-[10.5px] flex-shrink-0 ${
                              isOn ? 'text-[#0f1405aa]' : 'text-[var(--mute)]'
                            }`}
                            title={last?.timestamp || ''}
                          >
                            {lastDate ? timeAgo(lastDate) : `${msgs.length}`}
                          </span>
                        </div>
                        <div
                          className={`text-[12.5px] truncate flex items-center gap-1 ${
                            isOn ? 'text-[#0f1405aa]' : 'text-[var(--mute)]'
                          }`}
                          style={{ maxWidth: 240 }}
                        >
                          {lastIsBot && <span aria-hidden="true">↳</span>}
                          <span className="truncate">{last?.message || '—'}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </aside>

            {/* ─── Thread view ─── */}
            <div className="flex flex-col min-w-0">
              {activePhone && (
                <>
                  <div
                    className="flex items-center gap-3 border-b border-[var(--line)] bg-[var(--card)] sticky top-0 z-10"
                    style={{ padding: '16px 22px' }}
                  >
                    <div className="w-[42px] h-[42px] rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center font-bold">
                      {initials(activePhone)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[15px] truncate">{activePhone}</div>
                      <div className="zt-mono text-[11.5px] text-[var(--mute)] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1FAE4F]" />
                        {thread.length} message{thread.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    {/* Live takeover toggle. When ON, AI stops auto-replying for this customer
                        and the owner is responsible — they type in the send box at the bottom. */}
                    <button
                      type="button"
                      onClick={() => togglePause(activePhone, !pausedSet.has(activePhone))}
                      disabled={pauseBusy}
                      className={`text-[11.5px] font-semibold rounded-full border transition disabled:opacity-50 ${
                        pausedSet.has(activePhone)
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-400'
                          : 'border-[var(--line)] text-[var(--ink)] hover:border-[var(--ink)]'
                      }`}
                      style={{ padding: '5px 11px' }}
                      title={
                        pausedSet.has(activePhone)
                          ? 'Resume AI for this customer'
                          : 'Pause AI — you reply manually from the box below'
                      }
                    >
                      {pausedSet.has(activePhone) ? '⏸ AI paused — Resume' : '🤝 Take over'}
                    </button>
                    <a
                      href={`https://wa.me/${activePhone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11.5px] font-semibold text-[var(--ink)] border border-[var(--line)] hover:border-[var(--ink)] rounded-full transition"
                      style={{ padding: '5px 11px' }}
                      title="Open this chat in WhatsApp Web / app"
                    >
                      💬 Open in WhatsApp
                    </a>
                  </div>
                  <div
                    ref={threadRef}
                    className="flex-1 overflow-y-auto flex flex-col gap-2"
                    style={{
                      padding: 22,
                      backgroundImage:
                        'radial-gradient(circle at 25% 30%, #1413100a 1px, transparent 1.5px), radial-gradient(circle at 75% 70%, #1413100a 1px, transparent 1.5px)',
                      backgroundSize: '160px 160px',
                    }}
                  >
                    {/* placeholder removed — JSX block below */}
                    {threadEntries.map((entry, i) => {
                      const incoming = entry.msg.direction === 'incoming';
                      return (
                        <div key={i} className="contents">
                          {entry.showDayBreak && entry.date && (
                            <div
                              className="self-center text-[10.5px] uppercase tracking-[.08em] font-semibold text-[var(--mute)] bg-[var(--bg-2)] border border-[var(--line)] rounded-full"
                              style={{ padding: '3px 11px', margin: '4px 0' }}
                            >
                              {dayLabel(entry.date)}
                            </div>
                          )}
                          <div
                            className="max-w-[68%] rounded-[12px] text-[13.5px] leading-[1.45] group"
                            style={{
                              padding: '9px 12px',
                              alignSelf: incoming ? 'flex-start' : 'flex-end',
                              background: incoming ? '#fff' : 'var(--ink)',
                              color: incoming ? 'var(--ink)' : 'var(--background)',
                              borderTopLeftRadius: incoming ? 3 : 12,
                              borderTopRightRadius: incoming ? 12 : 3,
                              boxShadow: '0 1px 2px #00000012',
                            }}
                            title={entry.msg.timestamp}
                          >
                            {!incoming && (
                              <MonoLabel className="text-[var(--accent)] opacity-100 mb-0.5">
                                BOT
                              </MonoLabel>
                            )}
                            <p className="whitespace-pre-wrap m-0">{entry.msg.message}</p>
                            <div
                              className="text-[10px] text-right mt-0.5"
                              style={{ color: incoming ? '#00000055' : '#ffffff66' }}
                            >
                              {entry.date ? timeOnly(entry.date) : entry.msg.timestamp}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* ─── Composer (live takeover send box) ───
                      Visible always; the server gates on the 24hr window
                      and on the live_takeover plan feature. Showing the
                      box even when the AI is on lets the owner jump in
                      mid-conversation without first toggling pause. */}
                  <div
                    className="border-t border-[var(--line)] bg-[var(--card)]"
                    style={{ padding: '12px 16px' }}
                  >
                    {sendError ? (
                      <div className="text-[11.5px] text-red-500 mb-2" style={{ wordBreak: 'break-word' }}>
                        {sendError}
                      </div>
                    ) : null}
                    <div className="flex gap-2 items-end">
                      <textarea
                        value={composer}
                        onChange={(e) => setComposer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void sendOwnerMessage();
                          }
                        }}
                        placeholder={
                          pausedSet.has(activePhone)
                            ? 'AI is paused — type your reply (Enter to send, Shift+Enter for newline)'
                            : "Jump in as the owner — your message goes from the bot's number"
                        }
                        rows={2}
                        disabled={sending}
                        className="flex-1 rounded-[10px] border border-[var(--line)] bg-[var(--bg-2)] text-[13px] focus:outline-none focus:border-[var(--ink)] resize-none disabled:opacity-50"
                        style={{ padding: '9px 12px', fontFamily: 'inherit' }}
                      />
                      <button
                        type="button"
                        onClick={() => void sendOwnerMessage()}
                        disabled={sending || !composer.trim()}
                        className="rounded-[10px] bg-[var(--ink)] text-[var(--background)] font-semibold text-[13px] disabled:opacity-50 hover:opacity-90 transition"
                        style={{ padding: '10px 16px' }}
                      >
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                    <div className="text-[11px] text-[var(--mute)] zt-mono mt-1.5">
                      Replies are sent from the bot&apos;s WhatsApp number — customer sees the same chat thread.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Helpers ───

function ConversationsSkeleton() {
  return (
    <div
      className="grid grid-cols-[320px_1fr] border border-[var(--line)] rounded-[18px] bg-[var(--card)] overflow-hidden"
      style={{ minHeight: 'calc(100vh - 220px)' }}
    >
      <aside className="border-r border-[var(--line)] flex flex-col">
        <div className="border-b border-[var(--line)]" style={{ padding: '14px 16px' }}>
          <div className="h-9 rounded-[10px] bg-[var(--bg-2)] animate-pulse" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-2.5 border-b border-[var(--line)] animate-pulse"
            style={{ padding: '14px 16px' }}
          >
            <div className="w-[38px] h-[38px] rounded-full bg-[var(--bg-2)] flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-3.5 w-2/3 rounded bg-[var(--bg-2)]" />
              <div className="h-3 w-full rounded bg-[var(--bg-2)]" />
            </div>
          </div>
        ))}
      </aside>
      <div
        className="flex flex-col"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 30%, #1413100a 1px, transparent 1.5px), radial-gradient(circle at 75% 70%, #1413100a 1px, transparent 1.5px)',
          backgroundSize: '160px 160px',
        }}
      >
        <div className="border-b border-[var(--line)] bg-[var(--card)] flex items-center gap-3 animate-pulse" style={{ padding: '16px 22px' }}>
          <div className="w-[42px] h-[42px] rounded-full bg-[var(--bg-2)]" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div className="h-4 w-32 rounded bg-[var(--bg-2)]" />
            <div className="h-3 w-20 rounded bg-[var(--bg-2)]" />
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-2 p-6">
          {[
            { incoming: true, w: '60%' },
            { incoming: false, w: '40%' },
            { incoming: true, w: '70%' },
            { incoming: false, w: '50%' },
          ].map((row, i) => (
            <div
              key={i}
              className="rounded-[12px] h-12 animate-pulse"
              style={{
                width: row.w,
                alignSelf: row.incoming ? 'flex-start' : 'flex-end',
                background: row.incoming ? '#ffffff' : 'var(--ink)',
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] flex flex-col items-center text-center gap-3"
      style={{ padding: '64px 22px' }}
    >
      <div className="w-16 h-16 rounded-[16px] bg-[var(--bg-2)] grid place-items-center text-[28px]">
        💬
      </div>
      <div className="text-[16px] font-bold text-foreground">No conversations yet</div>
      <div className="text-[13px] text-[var(--mute)] max-w-[420px]">
        Once a customer messages your bot on WhatsApp, the full chat will show up
        here — with day-by-day timestamps and bot replies inline.
      </div>
      <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.08em] mt-2">
        Tip: share your bot number on Instagram bio + Google business
      </div>
    </div>
  );
}
