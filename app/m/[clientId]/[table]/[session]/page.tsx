// Public mobile menu page for dine-in customers.
// URL: /m/<clientId>/<tableNumber>/<sessionId>
//
// Lands customers who tapped the bot's menu link. Renders the restaurant's
// menuCategories from the bot's knowledge_base. Customer selects items,
// totals shown live, hits Submit — order POSTs to /api/dine-in/submit
// which writes the order and notifies the manager dashboard.
//
// No auth: anyone with a valid (clientId, tableNumber, sessionId) tuple
// can submit. The submit API revalidates that the session is still open
// for that table.

import { notFound } from 'next/navigation';
import { getClientById } from '@/lib/db/clients';
import { getSessionById, getTable } from '@/lib/db/restaurant-dine-in';
import { MenuOrderClient } from './menu-order-client';

interface MenuItem {
  name: string;
  price: string;
  description?: string;
  isVeg?: boolean;
  isBestseller?: boolean;
  sizes?: Array<{ label: string; price: number }> | null;
}
interface MenuCategory { category?: string; items?: MenuItem[] }

export default async function PublicMenuPage({
  params,
}: {
  params: Promise<{ clientId: string; table: string; session: string }>;
}) {
  const { clientId, table, session } = await params;

  const [client, sessionRow, tableRow] = await Promise.all([
    getClientById(clientId).catch(() => null),
    getSessionById(session).catch(() => null),
    getTable(clientId, table).catch(() => null),
  ]);

  if (!client || client.type !== 'restaurant' || !tableRow) {
    notFound();
  }

  const sessionValid =
    sessionRow &&
    sessionRow.client_id === clientId &&
    sessionRow.table_number === table &&
    sessionRow.status === 'open';

  let menu: MenuCategory[] = [];
  try {
    const kb = client.knowledge_base_json ? (JSON.parse(client.knowledge_base_json) as Record<string, unknown>) : {};
    if (Array.isArray(kb.menuCategories)) menu = kb.menuCategories as MenuCategory[];
  } catch { /* ignore */ }

  const flatItems: Array<{ id: string; category: string; name: string; price: string; description: string; isVeg: boolean; isBestseller: boolean; sizes: Array<{ label: string; price: number }> }> = [];
  menu.forEach((cat, ci) => {
    (cat.items || []).forEach((it, ii) => {
      const name = (it.name || '').trim();
      if (!name) return;
      const validSizes = Array.isArray(it.sizes)
        ? it.sizes
            .filter((s): s is { label: string; price: number } =>
              !!s && typeof s.label === 'string' && typeof s.price === 'number' && s.price > 0
            )
            .map((s) => ({ label: s.label, price: s.price }))
        : [];
      flatItems.push({
        id: `${ci}-${ii}`,
        category: (cat.category || 'Menu').trim() || 'Menu',
        name,
        price: it.price || '',
        description: it.description || '',
        isVeg: it.isVeg !== false,
        isBestseller: !!it.isBestseller,
        sizes: validSizes,
      });
    });
  });

  // Optional brand fields from the bot's knowledge_base. Owners can set
  // brandLogoUrl + brandColor in their bot's KB to customise the public
  // menu header; we fall back to a clean default when unset.
  let brandLogoUrl = '';
  let brandColor = '';
  let tagline = '';
  try {
    const kb = client.knowledge_base_json ? (JSON.parse(client.knowledge_base_json) as Record<string, unknown>) : {};
    if (typeof kb.brandLogoUrl === 'string') brandLogoUrl = kb.brandLogoUrl;
    if (typeof kb.brandColor === 'string') brandColor = kb.brandColor;
    if (typeof kb.tagline === 'string') tagline = kb.tagline;
  } catch { /* ignore */ }

  return (
    <MenuOrderClient
      businessName={client.business_name}
      clientId={clientId}
      tableNumber={table}
      sessionId={session}
      sessionValid={!!sessionValid}
      items={flatItems}
      brandLogoUrl={brandLogoUrl}
      brandColor={brandColor}
      tagline={tagline}
    />
  );
}
