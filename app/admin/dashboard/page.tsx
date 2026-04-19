'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BUSINESS_TYPES } from '@/lib/constants';
import { ClientRow } from '@/lib/types';
import { PageTopbar, PageHead, Kpi, Panel, Pill, StatusPill } from '@/components/app/primitives';

export default function AdminDashboard() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/welcome', { method: 'POST' }).catch(() => {});
  }, []);

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

  const activeCount = clients.filter((c) => c.status === 'active').length;
  const pendingCount = clients.filter((c) => c.status === 'pending').length;
  const pendingBots = clients.filter((c) => c.status === 'pending');

  return (
    <>
      <PageTopbar
        crumbs={<><b className="text-foreground">Admin dashboard</b> · {clients.length} clients · {pendingCount} pending</>}
        actions={
          <div className="flex items-center gap-2">
            <Pill variant="ghost" href="/admin/create-client">👤 Create client account</Pill>
            <Pill variant="ink" href="/admin/onboard">+ Onboard client</Pill>
          </div>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>Workspace <span className="zt-serif">overview.</span></>}
          sub="All clients, status, and actions — in one place."
        />

        {!loading && pendingCount > 0 && (
          <div
            className="rounded-[18px] flex items-center gap-3.5 mb-5"
            style={{
              padding: '18px 22px',
              background:
                'linear-gradient(90deg, color-mix(in oklab, #E89A1C 20%, transparent), color-mix(in oklab, #E89A1C 5%, transparent))',
              border: '1px solid color-mix(in oklab, #E89A1C 45%, transparent)',
            }}
          >
            <div className="w-11 h-11 rounded-[12px] bg-[#E89A1C] text-white grid place-items-center text-[20px]">⏳</div>
            <div className="flex-1">
              <b>{pendingCount} bot{pendingCount > 1 ? 's' : ''} waiting for approval</b>
              <div className="text-[12.5px] text-[var(--ink-2)] mt-0.5">
                {pendingBots.map((b) => b.business_name).join(', ')}
              </div>
            </div>
            <Pill
              variant="ink"
              href={pendingBots.length === 1 ? `/admin/clients/${pendingBots[0].client_id}` : '/admin/clients'}
            >
              Review now
            </Pill>
          </div>
        )}

        {!loading && clients.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi label="Total clients" value={clients.length} />
            <Kpi label="Active bots" value={activeCount} />
            <Kpi
              label="Pending approval"
              value={<span className={pendingCount > 0 ? 'text-[#E89A1C]' : ''}>{pendingCount}</span>}
            />
            <Kpi label="Total messages" value="—" trend="View per-client" />
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse h-36 bg-[var(--card)] border border-[var(--line)] rounded-[18px]" />
            ))}
          </div>
        ) : clients.length === 0 ? (
          <Panel>
            <div className="text-center py-12">
              <div className="text-[48px] mb-3">🤖</div>
              <h2 className="text-[20px] font-semibold mb-1.5">No bots yet</h2>
              <p className="text-[13px] text-[var(--mute)] mb-5">Onboard your first client.</p>
              <Pill variant="ink" href="/admin/onboard">Onboard first client</Pill>
            </div>
          </Panel>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {clients.map((client) => {
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
