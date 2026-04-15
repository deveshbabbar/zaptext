'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BUSINESS_TYPES } from '@/lib/constants';
import { ClientRow } from '@/lib/types';

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => { setClients(data.clients || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const typeMeta = (type: string) => BUSINESS_TYPES.find((bt) => bt.type === type);

  const filtered = clients.filter((c) =>
    c.business_name.toLowerCase().includes(search.toLowerCase()) ||
    c.owner_name.toLowerCase().includes(search.toLowerCase()) ||
    c.city.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="p-8"><div className="animate-pulse h-64 bg-muted rounded-lg"></div></div>;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">All Clients</h1>
        <a href="/admin/onboard" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors font-medium">
          + Onboard Client
        </a>
      </div>

      <Input
        placeholder="Search by name, owner, or city..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 max-w-md"
      />

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No clients found</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => {
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
