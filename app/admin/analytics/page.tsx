'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BUSINESS_TYPES } from '@/lib/constants';
import { ClientRow } from '@/lib/types';

export default function AnalyticsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/clients')
      .then((r) => r.json())
      .then((d) => { setClients(d.clients || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const active = clients.filter((c) => c.status === 'active').length;
    const paused = clients.filter((c) => c.status === 'paused').length;
    const now = new Date();
    const createdThisMonth = clients.filter((c) => {
      const d = new Date(c.created_at);
      return !isNaN(d.getTime()) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { total: clients.length, active, paused, createdThisMonth };
  }, [clients]);

  const typeBreakdown = useMemo(() => {
    return BUSINESS_TYPES.map((bt) => ({
      ...bt,
      count: clients.filter((c) => c.type === bt.type).length,
    })).sort((a, b) => b.count - a.count);
  }, [clients]);

  const maxTypeCount = Math.max(1, ...typeBreakdown.map((t) => t.count));

  const cityBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    clients.forEach((c) => {
      const city = (c.city || 'Unknown').trim() || 'Unknown';
      map.set(city, (map.get(city) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [clients]);

  const recent = useMemo(() => {
    return [...clients]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  }, [clients]);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse h-64 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Analytics</h1>
      <p className="text-muted-foreground mb-8">Overview across all your bots</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Bots</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-3xl font-bold text-primary">{stats.active}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Paused</p>
            <p className="text-3xl font-bold">{stats.paused}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Created This Month</p>
            <p className="text-3xl font-bold">{stats.createdThisMonth}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Business Type breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Bots by Business Type</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {typeBreakdown.map((bt) => {
              const pct = (bt.count / maxTypeCount) * 100;
              return (
                <div key={bt.type}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="flex items-center gap-2">
                      <span>{bt.icon}</span>
                      <span className={bt.color}>{bt.label}</span>
                    </span>
                    <span className="font-medium">{bt.count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {clients.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No bots yet</p>
            )}
          </CardContent>
        </Card>

        {/* City breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Top Cities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cityBreakdown.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No data</p>
            )}
            {cityBreakdown.map((c) => {
              const pct = (c.count / (cityBreakdown[0]?.count || 1)) * 100;
              return (
                <div key={c.city}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span>{c.city}</span>
                    <span className="font-medium">{c.count}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No activity</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((c) => {
                const meta = BUSINESS_TYPES.find((bt) => bt.type === c.type);
                return (
                  <li key={c.client_id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">{meta?.icon || '🤖'}</div>
                      <div>
                        <p className="font-medium">{c.business_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {meta?.label} &middot; {c.city}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge
                        className={
                          c.status === 'active'
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                        }
                      >
                        {c.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{c.created_at}</span>
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
