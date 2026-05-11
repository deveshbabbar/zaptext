import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getClientConversations } from '@/lib/db/conversations';
import { PageTopbar, PageHead, Panel, StatusPill } from '@/components/app/primitives';

export default async function EcommerceOrdersPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'ecommerce') redirect('/client/dashboard');
  const all = await getClientConversations(user.activeBot.client_id).catch(() => []);
  const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const todays = all.filter((c) => new Date(c.timestamp).getTime() >= todayStart).slice(-50).reverse();
  const byCustomer = new Map<string, typeof todays>();
  for (const c of todays) {
    const list = byCustomer.get(c.customer_phone) || [];
    list.push(c);
    byCustomer.set(c.customer_phone, list);
  }
  return (
    <>
      <PageTopbar crumbs={<>Ecommerce / <a href="/client/ecommerce" className="hover:underline">Overview</a> / <b className="text-foreground">Orders</b></>} />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>Today&apos;s <span className="zt-serif">order feed.</span></>} sub={`${byCustomer.size} customer${byCustomer.size === 1 ? '' : 's'} messaged today. Structured order parsing rolls out soon; for now scan threads here.`} />
        {byCustomer.size === 0 ? (
          <Panel title="No activity today"><p className="text-sm text-muted-foreground">No customer messages yet today.</p></Panel>
        ) : (
          <div className="space-y-3">
            {[...byCustomer.entries()].map(([phone, msgs]) => {
              const lastIncoming = [...msgs].reverse().find((m) => m.direction === 'incoming');
              return (
                <Panel key={phone} title={phone} sub={`${msgs.length} message${msgs.length === 1 ? '' : 's'} today`} action={<StatusPill variant={lastIncoming ? 'pending' : 'ok'}>{lastIncoming ? 'awaiting reply' : 'closed'}</StatusPill>}>
                  <div className="space-y-1.5 text-[13px] max-h-48 overflow-y-auto">
                    {msgs.slice(-8).map((m, i) => (
                      <div key={`${m.timestamp}-${i}`} className={m.direction === 'incoming' ? 'text-foreground' : 'text-muted-foreground italic'}>
                        <span className="text-[10.5px] zt-mono uppercase tracking-[.04em] mr-2">{m.direction === 'incoming' ? 'customer' : 'bot'}</span>
                        {m.message}
                      </div>
                    ))}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
