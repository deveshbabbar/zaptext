// Restaurant manager — QR codes management.
// Server-renders the current list of tables with a live preview of each
// QR. Add/remove tables and rotate all tokens via the client component.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listTables } from '@/lib/db/restaurant-dine-in';
import { isDineInEnabledForClient } from '@/lib/restaurant/dine-in-handler';
import { buildWaUrlForTable, generateQrDataUrl } from '@/lib/restaurant-qr';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';
import { QrCodesClient } from './qr-codes-client';

export default async function RestaurantQrCodesPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') redirect('/client/dashboard');

  const dineInUnlocked = await isDineInEnabledForClient(user.activeBot.client_id);
  const tables = await listTables(user.activeBot.client_id).catch(() => []);
  const botPhone = user.activeBot.whatsapp_number || '';

  const previews = await Promise.all(
    tables.map(async (t) => {
      if (!botPhone) return { ...t, waUrl: '', qrDataUrl: '' };
      const waUrl = buildWaUrlForTable({ botPhone, tableNumber: t.table_number, qrToken: t.qr_token });
      const qrDataUrl = await generateQrDataUrl(waUrl);
      return { ...t, waUrl, qrDataUrl };
    })
  );

  const phoneConfigured = !!botPhone;

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            Restaurant /{' '}
            <a href="/client/restaurant" className="hover:underline">Overview</a>{' '}
            / <b className="text-foreground">QR codes</b>
          </>
        }
        actions={
          <Pill variant="ink" href="/client/restaurant/qr-codes/print">
            Print sheet
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 80px' }}>
        <PageHead
          title={<>Table <span className="zt-serif">QR codes.</span></>}
          sub="Each table gets its own QR. Customers scan, tap Send on WhatsApp, and the bot opens their menu. Rotate tokens once per shift to keep stale photos / screenshots from working."
        />

        {!dineInUnlocked && (
          <Panel
            title="Dine-in is a Growth feature"
            sub="Unlock QR-table ordering by upgrading to Growth (₹1,499/mo) or higher."
            action={<a href="/client/subscription#upgrade" className="text-xs font-semibold underline">Upgrade →</a>}
          >
            <p className="text-sm text-muted-foreground">
              You can preview the setup below, but customer-side ordering won&apos;t fire until you upgrade. Free / Starter customers will be told to ask staff at the counter when they scan.
            </p>
          </Panel>
        )}

        {!phoneConfigured && (
          <Panel title="WhatsApp number not configured">
            <p className="text-sm text-muted-foreground">
              Add your bot&apos;s WhatsApp number in Settings before generating QR codes — the QR encodes a wa.me link to that number.
            </p>
          </Panel>
        )}

        <QrCodesClient
          initialTables={previews.map((p) => ({
            id: p.id,
            tableNumber: p.table_number,
            qrToken: p.qr_token,
            qrTokenRotatedAt: p.qr_token_rotated_at,
            seats: p.seats,
            isActive: p.is_active,
            waUrl: p.waUrl,
            qrDataUrl: p.qrDataUrl,
          }))}
          botPhone={botPhone}
        />
      </div>
    </>
  );
}
