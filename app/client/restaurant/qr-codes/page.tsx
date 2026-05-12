// Restaurant manager — QR codes management.
// Server-renders the current list of tables with a live preview of each
// QR. Add/remove tables and rotate all tokens via the client component.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listTables } from '@/lib/db/restaurant-dine-in';
import { buildWaUrlForTable, generateQrDataUrl } from '@/lib/restaurant-qr';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';
import { QrCodesClient } from './qr-codes-client';

export default async function RestaurantQrCodesPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') redirect('/client/dashboard');

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
