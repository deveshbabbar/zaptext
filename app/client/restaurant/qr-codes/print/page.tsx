// Printable QR sheet — one page per table. Manager opens this and uses
// the browser's print dialog (Ctrl+P) to print + cut + place at each table.
// We render server-side with embedded SVG QR codes so it's pixel-perfect
// at any paper size and doesn't need any client-side JS.

import { requireRestaurantViewer } from '@/lib/restaurant/viewer-context';
import { listTables } from '@/lib/db/restaurant-dine-in';
import { buildWaUrlForTable, generateQrSvg } from '@/lib/restaurant-qr';
import { getOutletsForClient, isMultiOutletEnabled } from '@/lib/db/outlets';

export default async function RestaurantQrPrintPage() {
  // Phase 3I v2 — outlet manager prints only their outlet's tables.
  // Owner prints chain-wide. Multi-outlet kitchens embed the outlet
  // slug in each QR so a scan auto-routes to the right outlet.
  const viewer = await requireRestaurantViewer();
  const activeBot = viewer.activeBot;
  const tables = (await listTables(
    activeBot.client_id,
    viewer.restrictedOutletId || undefined,
  ).catch(() => [])).filter((t) => t.is_active);
  const botPhone = activeBot.whatsapp_number || '';

  const [multiEnabled, outletsList] = await Promise.all([
    isMultiOutletEnabled(activeBot.client_id),
    getOutletsForClient(activeBot.client_id),
  ]);
  const outletSlugById = new Map(outletsList.map((o) => [o.id, o.slug]));

  const cards = await Promise.all(
    tables.map(async (t) => {
      const outletSlug = multiEnabled ? (outletSlugById.get(t.outlet_id) || '') : '';
      const waUrl = buildWaUrlForTable({
        botPhone,
        tableNumber: t.table_number,
        qrToken: t.qr_token,
        outletSlug: outletSlug || undefined,
      });
      const svg = await generateQrSvg(waUrl);
      return { tableNumber: t.table_number, svg };
    })
  );

  return (
    <>
      <style>{`
        @page { margin: 12mm; }
        body { background: #fff; }
        .qr-print-sheet { font-family: system-ui, sans-serif; }
        .qr-print-card { page-break-after: always; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 90vh; }
        .qr-print-card:last-child { page-break-after: auto; }
        .qr-print-card h1 { font-size: 48px; margin: 0 0 8px; letter-spacing: -1px; }
        .qr-print-card .biz { font-size: 18px; color: #555; margin-bottom: 24px; }
        .qr-print-card .qr-wrap { width: 320px; height: 320px; display: flex; align-items: center; justify-content: center; }
        .qr-print-card .qr-wrap svg { width: 100%; height: 100%; }
        .qr-print-card .instructions { margin-top: 24px; text-align: center; font-size: 14px; color: #333; max-width: 360px; line-height: 1.5; }
        .qr-print-card .instructions strong { display: block; margin-bottom: 6px; }
        .qr-print-card .bilingual { margin-top: 12px; font-size: 13px; color: #555; }
        .no-print { padding: 24px; max-width: 760px; margin: 0 auto; }
        @media print { .no-print { display: none; } }
      `}</style>
      <div className="no-print" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>Printable QR sheet — {activeBot.business_name}</h1>
        <p style={{ color: '#666', marginBottom: 16 }}>
          One table per page. Press <b>Ctrl+P</b> (or Cmd+P) to print, then cut and place at each table.
        </p>
        {cards.length === 0 && (
          <p style={{ color: '#900' }}>No active tables. Add tables on the QR Codes page first.</p>
        )}
      </div>
      <div className="qr-print-sheet">
        {cards.map((c) => (
          <div key={c.tableNumber} className="qr-print-card">
            <h1>Table {c.tableNumber}</h1>
            <div className="biz">{activeBot.business_name}</div>
            <div className="qr-wrap" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <div className="instructions">
              <strong>Scan to order on WhatsApp</strong>
              Open the camera, scan the QR, then tap Send.
              The menu will arrive in your chat.
              <div className="bilingual">
                <strong style={{ marginTop: 12 }}>WhatsApp se order karein</strong>
                Camera khol kar QR scan kariye, phir Send dabaiye.
                Menu chat mein aa jayega.
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
