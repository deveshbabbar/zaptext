'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { BUSINESS_TYPES } from '@/lib/constants';

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
  const [stats, setStats] = useState<Stats>({
    totalConversations: 0,
    totalMessages: 0,
    today: 0,
    avgPerClient: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/admin/messages')
      .then((r) => r.json())
      .then((d) => {
        setConversations(d.conversations || []);
        setStats(
          d.stats || { totalConversations: 0, totalMessages: 0, today: 0, avgPerClient: 0 },
        );
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
        c.lastMessage.toLowerCase().includes(q),
    );
  }, [conversations, search]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Messages</h1>
      <p className="text-muted-foreground mb-8">View conversations across all bots</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Conversations</p>
            <p className="text-3xl font-bold">
              {stats.totalConversations.toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Messages</p>
            <p className="text-3xl font-bold">{stats.totalMessages.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Today</p>
            <p className="text-3xl font-bold">{stats.today}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Avg / Client</p>
            <p className="text-3xl font-bold">{stats.avgPerClient}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search by customer, bot name, or message..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Conversations list */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Conversations</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {conversations.length === 0
                ? 'No conversations yet — messages will appear here once customers start chatting with your bots.'
                : 'No matches'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => {
                const meta = BUSINESS_TYPES.find((bt) => bt.type === c.business_type);
                return (
                  <li
                    key={`${c.client_id}::${c.customer_phone}`}
                    onClick={() => router.push(`/admin/clients/${c.client_id}`)}
                    className="py-3 flex items-center gap-4 hover:bg-muted/40 rounded-md px-2 transition-colors cursor-pointer"
                  >
                    <div className="text-2xl">{meta?.icon || '💬'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium truncate">{c.customer_phone}</p>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {c.lastTimestamp}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {c.lastMessage}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {c.business_name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {c.messageCount} message{c.messageCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
