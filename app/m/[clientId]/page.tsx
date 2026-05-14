// Public menu + order page for ANY restaurant customer (no QR scan needed).
// URL: /m/<clientId>?p=<customerPhone>
//
// Sister page of /m/<clientId>/<table>/<session> (the dine-in QR flow).
// This route serves customers who got a menu LINK from the bot in chat
// rather than scanning a physical table QR. Customer picks delivery /
// takeaway / dine-in (with table number) on the page itself.
//
// No auth: anyone with the URL can submit. The submit endpoint
// (/api/menu/submit) writes the order and sends a WhatsApp confirmation
// back to the phone number the customer enters (or the ?p= prefill if
// the bot included it in the link).

import { notFound } from 'next/navigation';
import { getClientById } from '@/lib/db/clients';
import { MenuPublicClient } from './menu-public-client';

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
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ p?: string }>;
}) {
  const { clientId } = await params;
  const { p: prefillPhone = '' } = await searchParams;

  const client = await getClientById(clientId).catch(() => null);
  if (!client || client.type !== 'restaurant') notFound();

  let menu: MenuCategory[] = [];
  let brandLogoUrl = '';
  let brandColor = '';
  let tagline = '';
  let deliveryAvailable = true;
  let dineInEnabled = true;
  try {
    const kb = client.knowledge_base_json
      ? (JSON.parse(client.knowledge_base_json) as Record<string, unknown>)
      : {};
    if (Array.isArray(kb.menuCategories)) menu = kb.menuCategories as MenuCategory[];
    if (typeof kb.brandLogoUrl === 'string') brandLogoUrl = kb.brandLogoUrl;
    if (typeof kb.brandColor === 'string') brandColor = kb.brandColor;
    if (typeof kb.tagline === 'string') tagline = kb.tagline;
    if (typeof kb.deliveryAvailable === 'boolean') deliveryAvailable = kb.deliveryAvailable;
    // serviceModes is a sub-config from the restaurant form; if owner
    // disabled dine_in, hide that option from the picker.
    if (Array.isArray(kb.serviceModes)) {
      dineInEnabled = (kb.serviceModes as string[]).includes('dine_in');
    }
  } catch { /* ignore */ }

  const flatItems: Array<{
    id: string;
    category: string;
    name: string;
    price: string;
    description: string;
    isVeg: boolean;
    isBestseller: boolean;
    sizes: Array<{ label: string; price: number }>;
  }> = [];
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

  return (
    <MenuPublicClient
      businessName={client.business_name}
      clientId={clientId}
      items={flatItems}
      brandLogoUrl={brandLogoUrl}
      brandColor={brandColor}
      tagline={tagline}
      prefillPhone={prefillPhone}
      deliveryAvailable={deliveryAvailable}
      dineInEnabled={dineInEnabled}
    />
  );
}
