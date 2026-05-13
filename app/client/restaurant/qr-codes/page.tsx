// Restaurant manager — QR codes management.
// Server-renders the current list of tables with a live preview of each
// QR. Add/remove tables and rotate all tokens via the client component.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { listTables, upsertTable } from '@/lib/db/restaurant-dine-in';
import { isDineInEnabledForClient } from '@/lib/restaurant/dine-in-handler';
import { buildWaUrlForTable, generateQrDataUrl, generateQrToken } from '@/lib/restaurant-qr';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';
import { QrCodesClient } from './qr-codes-client';

export default async function RestaurantQrCodesPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'restaurant') redirect('/client/dashboard');

  const dineInUnlocked = await isDineInEnabledForClient(user.activeBot.client_id);
  let tables = await listTables(user.activeBot.client_id).catch(() => []);
  const botPhone = user.activeBot.whatsapp_number || '';

  // Auto-seed tables on first visit. If the owner declared a table count
  // during onboarding (`numberOfTables` in knowledge_base_json) and no
  // tables exist yet for this client, create them now with fresh QR
  // tokens. Only runs once — subsequent visits hit the early-return.
  // Skipped if dine-in is locked (not on Growth+ plan) so we don't
  // surprise the customer with a feature they haven't paid for.
  if (tables.length === 0 && dineInUnlocked) {
    let declaredCount = 0;
    try {
      const kb = user.activeBot.knowledge_base_json
        ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>)
        : {};
      const raw = typeof kb.numberOfTables === 'number' ? kb.numberOfTables : 0;
      // Clamp to a sane range so a typo'd 9999 doesn't spam 9999 rows.
      declaredCount = Math.max(0, Math.min(100, Math.floor(raw)));
    } catch { /* ignore parse failure */ }
    if (declaredCount > 0) {
      for (let i = 1; i <= declaredCount; i++) {
        await upsertTable({
          client_id: user.activeBot.client_id,
          table_number: String(i),
          qr_token: generateQrToken(),
          seats: 0,
        }).catch(() => undefined);
      }
      tables = await listTables(user.activeBot.client_id).catch(() => []);
    }
  }

  const previews = await Promise.all(
    tables.map(async (t) => {
      if (!botPhone) return { ...t, waUrl: '', qrDataUrl: '' };
      const waUrl = buildWaUrlForTable({ botPhone, tableNumber: t.table_number, qrToken: t.qr_token });
      const qrDataUrl = await generateQrDataUrl(waUrl);
      return { ...t, waUrl, qrDataUrl };
    })
  );

  const phoneConfigured = !!botPhone;

  // Surface the current auto-rotate setting so the client component can
  // render the toggle with the right initial state.
  let qrAutoRotateEnabled = false;
  let qrAutoRotateIntervalHours = 24;
  try {
    const kb = user.activeBot.knowledge_base_json
      ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>)
      : {};
    qrAutoRotateEnabled = kb.qrAutoRotateEnabled === true;
    if (typeof kb.qrAutoRotateIntervalHours === 'number' && kb.qrAutoRotateIntervalHours > 0) {
      qrAutoRotateIntervalHours = Math.max(6, Math.min(168, kb.qrAutoRotateIntervalHours));
    }
  } catch { /* ignore */ }

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

        {/* The client component now renders a richer plan-gate banner
            (with CTA + visible disabled-state explanation) so we don't
            need a second server-rendered panel here. */}
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
          dineInUnlocked={dineInUnlocked}
          initialAutoRotateEnabled={qrAutoRotateEnabled}
          initialAutoRotateIntervalHours={qrAutoRotateIntervalHours}
        />
      </div>
    </>
  );
}
