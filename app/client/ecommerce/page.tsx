import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getClientConversations } from '@/lib/db/conversations';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Pill, Kpi, Panel } from '@/components/app/primitives';
import { SubTypesChips } from '@/components/client/sub-types-chips';

export default async function EcommerceOverviewPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'ecommerce') redirect('/client/dashboard');
  const all = await getClientConversations(user.activeBot.client_id).catch(() => []);
  const todayStart = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const todays = all.filter((c) => new Date(c.timestamp).getTime() >= todayStart);
  const uniqueCustomers = new Set(todays.map((c) => c.customer_phone));

  let products: Array<Record<string, unknown>> = [];
  let kb: Record<string, unknown> = {};
  try {
    kb = user.activeBot.knowledge_base_json ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>) : {};
    if (Array.isArray(kb.products)) products = kb.products as Array<Record<string, unknown>>;
  } catch { /* ignore */ }

  const today = getISTDate();
  return (
    <>
      <PageTopbar crumbs={<>Ecommerce / <b className="text-foreground">Overview</b></>} actions={<Pill variant="ink" href="/client/ecommerce/products">Manage products</Pill>} />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead title={<>{user.activeBot.business_name} <span className="zt-serif">workspace.</span></>} sub="Products, orders, returns, and courier activity." />
        <SubTypesChips kb={kb} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Products" value={products.length} trend={products.length === 0 ? 'Start with Bulk import' : undefined} />
          <Kpi label="Customers today" value={uniqueCustomers.size} />
          <Kpi label="Messages today" value={todays.length} />
          <Kpi label="In-stock items" value={products.filter((p) => p.inStock !== false).length} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-2.5">
              <Pill variant="ghost" href="/client/ecommerce/products">📦 Products ({products.length})</Pill>
              <Pill variant="ghost" href="/client/ecommerce/orders">🛒 Orders</Pill>
              <Pill variant="ghost" href="/client/conversations">💬 Customer chats</Pill>
              <Pill variant="ghost" href="/client/settings">⚙️ Bot settings</Pill>
            </div>
          </Panel>
          <Panel title="Today's customer activity" sub={`${uniqueCustomers.size} customer${uniqueCustomers.size === 1 ? '' : 's'} active on ${today}`}>
            {uniqueCustomers.size === 0 ? (
              <div className="text-[13px] text-[var(--mute)] py-2">No chats yet today. Orders will appear as customers message via WhatsApp.</div>
            ) : (
              <p className="text-[13px] text-foreground">
                <b>{todays.length}</b> messages from <b>{uniqueCustomers.size}</b> unique numbers. Tap Orders to see them grouped by customer.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
