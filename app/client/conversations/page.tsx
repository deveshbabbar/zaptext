'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageTopbar, PageHead, MonoLabel } from '@/components/app/primitives';

interface Message {
  timestamp: string;
  customer_phone: string;
  direction: string;
  message: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    fetch('/api/client/conversations')
      .then((res) => res.json())
      .then((data) => {
        setConversations(data.conversations || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const phones = useMemo(() => Object.keys(conversations), [conversations]);

  useEffect(() => {
    if (!activePhone && phones.length) setActivePhone(phones[0]);
  }, [phones, activePhone]);

  const filtered = useMemo(
    () =>
      phones.filter((p) => {
        if (!query) return true;
        const msgs = conversations[p];
        const last = msgs[msgs.length - 1]?.message || '';
        return p.toLowerCase().includes(query.toLowerCase()) || last.toLowerCase().includes(query.toLowerCase());
      }),
    [phones, query, conversations]
  );

  const thread = activePhone ? conversations[activePhone] || [] : [];
  const totalMessages = phones.reduce((s, p) => s + conversations[p].length, 0);

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">Conversations</b> · {phones.length} total · {totalMessages} messages
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
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : phones.length === 0 ? (
          <div
            className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] text-center text-[var(--mute)]"
            style={{ padding: '64px 22px' }}
          >
            No conversations yet. Share your bot number to get started.
          </div>
        ) : (
          <div
            className="grid grid-cols-[320px_1fr] border border-[var(--line)] rounded-[18px] bg-[var(--card)] overflow-hidden"
            style={{ minHeight: 'calc(100vh - 220px)' }}
          >
            <aside className="border-r border-[var(--line)] overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <div
                className="flex gap-1.5 items-center border-b border-[var(--line)] bg-[var(--card)] sticky top-0"
                style={{ padding: '14px 16px' }}
              >
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  className="flex-1 bg-[var(--bg-2)] border border-[var(--line)] rounded-[10px] px-3 py-2 text-[13px] focus:outline-none focus:border-[var(--ink)]"
                />
              </div>
              {filtered.map((phone) => {
                const msgs = conversations[phone];
                const last = msgs[msgs.length - 1];
                const isOn = phone === activePhone;
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
                      {phone.slice(-2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1.5">
                        <span className="font-semibold text-[13.5px] truncate">{phone}</span>
                        <span className="zt-mono text-[10.5px] text-[var(--mute)]">{msgs.length}</span>
                      </div>
                      <div
                        className={`text-[12.5px] truncate ${isOn ? 'text-[#0f1405aa]' : 'text-[var(--mute)]'}`}
                        style={{ maxWidth: 220 }}
                      >
                        {last?.message || '—'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </aside>

            <div className="flex flex-col min-w-0">
              {activePhone && (
                <>
                  <div className="flex items-center gap-3 border-b border-[var(--line)]" style={{ padding: '16px 22px' }}>
                    <div className="w-[42px] h-[42px] rounded-full bg-[var(--accent)] text-[var(--accent-2)] grid place-items-center font-bold">
                      {activePhone.slice(-2)}
                    </div>
                    <div>
                      <div className="font-bold text-[15px]">{activePhone}</div>
                      <div className="zt-mono text-[11.5px] text-[var(--mute)] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1FAE4F]" /> {thread.length} messages
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex-1 overflow-y-auto flex flex-col gap-2.5"
                    style={{
                      padding: 22,
                      backgroundImage:
                        'radial-gradient(circle at 25% 30%, #1413100a 1px, transparent 1.5px), radial-gradient(circle at 75% 70%, #1413100a 1px, transparent 1.5px)',
                      backgroundSize: '160px 160px',
                    }}
                  >
                    {thread.slice(-40).map((m, i) => {
                      const incoming = m.direction === 'incoming';
                      return (
                        <div
                          key={i}
                          className="max-w-[68%] rounded-[12px] text-[13.5px] leading-[1.45]"
                          style={{
                            padding: '9px 12px',
                            alignSelf: incoming ? 'flex-start' : 'flex-end',
                            background: incoming ? '#fff' : 'var(--ink)',
                            color: incoming ? 'var(--ink)' : 'var(--background)',
                            borderTopLeftRadius: incoming ? 3 : 12,
                            borderTopRightRadius: incoming ? 12 : 3,
                            boxShadow: '0 1px 1px #00000010',
                          }}
                        >
                          {!incoming && <MonoLabel className="text-[var(--accent)] opacity-100 mb-0.5">BOT</MonoLabel>}
                          <p className="whitespace-pre-wrap m-0">{m.message}</p>
                          <div
                            className="text-[10px] text-right mt-0.5"
                            style={{ color: incoming ? '#00000055' : '#ffffff66' }}
                          >
                            {m.timestamp}
                          </div>
                        </div>
                      );
                    })}
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
