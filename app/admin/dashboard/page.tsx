'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BUSINESS_TYPES } from '@/lib/constants';
import { ClientRow } from '@/lib/types';

export default function AdminDashboard() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/welcome', { method: 'POST' }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => { setClients(data.clients || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const typeMeta = (type: string) => BUSINESS_TYPES.find((bt) => bt.type === type);

  const activeCount = clients.filter((c) => c.status === 'active').length;
  const totalMessages = clients.length; // placeholder; real count comes from analytics

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage all your WhatsApp bots</p>
        </div>
        <a href="/admin/onboard" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium">
          + Onboard Client
        </a>
      </div>

      {/* Stats Summary */}
      {!loading && clients.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total Clients</p>
              <p className="text-3xl font-bold">{clients.length}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Active Bots</p>
              <p className="text-3xl font-bold">{activeCount}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm text-muted-foreground">Total Messages</p>
              <p className="text-3xl font-bold">--</p>
              <p className="text-xs text-muted-foreground">View per-client details</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader><div className="h-6 bg-muted rounded w-3/4"></div></CardHeader>
              <CardContent><div className="h-4 bg-muted rounded w-1/2 mb-2"></div><div className="h-4 bg-muted rounded w-1/3"></div></CardContent>
            </Card>
          ))}
        </div>
      ) : clients.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <div className="text-6xl mb-4">🤖</div>
            <h2 className="text-xl font-semibold mb-2">No bots yet</h2>
            <p className="text-muted-foreground mb-6">Create your first WhatsApp AI bot</p>
            <a href="/admin/onboard" className="bg-primary text-primary-foreground px-6 py-2.5 rounded-lg hover:bg-primary/90 transition-colors font-medium inline-block">
              Onboard First Client
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => {
            const meta = typeMeta(client.type);
            return (
              <a key={client.client_id} href={`/admin/clients/${client.client_id}`}>
                <Card className="hover:border-primary/50 border-2 border-transparent transition-all cursor-pointer h-full hover:shadow-md">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <span>{meta?.icon}</span>
                        {client.business_name}
                      </CardTitle>
                      <Badge className={client.status === 'active' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'}>
                        {client.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <div className={meta?.color}>{meta?.label}</div>
                      <div>{client.city} &middot; {client.owner_name}</div>
                      <div className="text-xs text-muted-foreground/60">Created: {client.created_at}</div>
                    </div>
                  </CardContent>
                </Card>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
