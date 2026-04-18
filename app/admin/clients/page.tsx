'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BUSINESS_TYPES } from '@/lib/constants';
import { ClientRow } from '@/lib/types';
import { PageTopbar, PageHead, Pill, StatusPill } from '@/components/app/primitives';

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/clients')
      .then((res) => res.json())
      .then((data) => {
        setClients(data.clients || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const typeMeta = (type: string) => BUSINESS_TYPES.find((bt) => bt.type === type);

  const filtered = clients.filter(
    (c) =>
      c.business_name.toLowerCase().includes(search.toLowerCase()) ||
      c.owner_name.toLowerCase().includes(search.toLowerCase()) ||
      c.city.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageTopbar
        crumbs={<><b className="text-foreground">All clients</b> · {clients.length} total</>}
        actions={<Pill variant="ink" href="/admin/onboard">+ Onboard client</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Client <span className="zt-serif">roster.</span></>}
          sub="Search, filter, drill in."
        />

        <input
          placeholder="Search by name, owner, or city…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-[12px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px] mb-5"
          style={{ padding: '11px 13px' }}
        />

        {loading ? (
          <div className="animate-pulse h-64 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
        ) : filtered.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--line)] rounded-[18px] text-center text-[var(--mute)] py-16">
            No clients found
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filtered.map((client) => {
              const meta = typeMeta(client.type);
              return (
                <Link
                  key={client.client_id}
                  href={`/admin/clients/${client.client_id}`}
                  className="border border-[var(--line)] rounded-[18px] bg-[var(--card)] hover:-translate-y-0.5 transition block"
                  style={{ padding: 22 }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="text-[28px] leading-none">{meta?.icon}</div>
                      <div>
                        <div className="font-bold text-[15.5px]">{client.business_name}</div>
                        <div className="text-[12px] text-[var(--mute)]">{meta?.label}</div>
                      </div>
                    </div>
                    <StatusPill
                      variant={client.status === 'active' ? 'active' : client.status === 'pending' ? 'pending' : 'ok'}
                    >
                      {client.status === 'pending' ? '⏳ pending' : client.status}
                    </StatusPill>
                  </div>
                  <div className="text-[12.5px] text-[var(--mute)]">
                    {client.city} · {client.owner_name}
                  </div>
                  <div className="text-[11px] text-[var(--mute)] mt-1.5">Created: {client.created_at}</div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
