'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BUSINESS_TYPES } from '@/lib/constants';
import { PageTopbar, PageHead, Kpi, Panel } from '@/components/app/primitives';

interface ConversationItem {
  client_id: string;
  customer_phone: string;
  lastMessage: string;
  lastTimestamp: string;
  messageCount: number;
  lastDirection: string;
  business_name: string;
  business_type: string;
}
interface Stats {
  totalConversations: number;
  totalMessages: number;
  today: number;
  avgPerClient: number;
}

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [stats, setStats] = useState<Stats>({ totalConversations: 0, totalMessages: 0, today: 0, avgPerClient: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/messages')
      .then((r) => r.json())
      .then((d) => {
        setConversations(d.conversations || []);
        setStats(d.stats || { totalConversations: 0, totalMessages: 0, today: 0, avgPerClient: 0 });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.customer_phone.toLowerCase().includes(q) ||
        c.business_name.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q)
    );
  }, [conversations, search]);

  return (
    <>
      <PageTopbar
        crumbs={<><b className="text-foreground">Messages</b> · {stats.totalConversations.toLocaleString('en-IN')} conversations · {stats.today} today</>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Every <span className="zt-serif">conversation.</span></>}
          sub="Read-only inbox across all bots."
        />

        {loading ? (
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
              <Kpi label="Conversations" value={stats.totalConversations.toLocaleString('en-IN')} />
              <Kpi label="Messages" value={stats.totalMessages.toLocaleString('en-IN')} />
              <Kpi label="Today" value={stats.today} />
              <Kpi label="Avg / client" value={stats.avgPerClient} />
            </div>

            <input
              placeholder="Search by customer, bot, or message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full max-w-md rounded-[12px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px] mb-4"
              style={{ padding: '11px 13px' }}
            />

            <Panel title="Recent conversations">
              {filtered.length === 0 ? (
                <p className="text-[13px] text-[var(--mute)] text-center py-6 m-0">
                  {conversations.length === 0
                    ? 'No conversations yet — messages will appear once customers chat with your bots.'
                    : 'No matches'}
                </p>
              ) : (
                <div className="flex flex-col">
                  {filtered.map((c, i) => {
                    const meta = BUSINESS_TYPES.find((bt) => bt.type === c.business_type);
                    return (
                      <button
                        key={`${c.client_id}::${c.customer_phone}`}
                        onClick={() => router.push(`/admin/clients/${c.client_id}`)}
                        className="flex items-center gap-3.5 py-3 text-left hover:bg-[var(--bg-2)] rounded-[8px]"
                        style={{
                          borderBottom: i < filtered.length - 1 ? '1px solid var(--line)' : 'none',
                          padding: '11px 8px',
                        }}
                      >
                        <div className="text-[24px]">{meta?.icon || '💬'}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-[14px] truncate">{c.customer_phone}</div>
                            <div className="zt-mono text-[11.5px] text-[var(--mute)] shrink-0">{c.lastTimestamp}</div>
                          </div>
                          <div className="text-[13px] text-[var(--mute)] truncate">{c.lastMessage}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="zt-mono text-[10.5px] border border-[var(--line)] rounded-full"
                              style={{ padding: '2px 7px' }}
                            >
                              {c.business_name}
                            </span>
                            <span className="text-[11px] text-[var(--mute)]">
                              {c.messageCount} message{c.messageCount === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
