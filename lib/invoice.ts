// ─── GST Invoice generation for subscriptions ───
//
// Indian B2B clients demand GST invoices from day one. ZapText (the
// platform) is the seller; the bot owner who paid for the subscription
// is the buyer. This module computes the invoice details from a stored
// subscription row plus platform/buyer metadata. The actual rendering
// (HTML, PDF) lives in app/api/invoice/[subscriptionId]/route.ts which
// imports `buildInvoice` and `renderInvoiceHTML`.
//
// Tax model:
//   - SaaS sales in India = HSN 998314 (Information Technology services)
//   - GST rate = 18%
//   - Inter-state (different state from seller) → IGST 18%
//   - Intra-state (same state) → CGST 9% + SGST 9%
//   - We default to IGST when buyer state isn't known (most conservative
//     — the buyer can claim ITC the same way under either split).
//
// Numbering scheme: ZAP/YYYY-YY/<6-char-suffix>
//   YYYY-YY = financial year (Apr-Mar). E.g., a payment on 2026-08-12
//   gets year segment "2026-27"; one on 2026-02-12 gets "2025-26".
//   The suffix is the last 6 chars of the subscription UUID — collision
//   probability with sane UUIDs is negligible and avoids a separate
//   counter table.
//
// All amounts are in INR. Stored `subscription.amount` is treated as
// gross (incl GST) — base and tax components are back-computed.

import type { SubscriptionRow } from './db/schema';

export interface InvoiceSeller {
  name: string;
  gstin: string;     // 15-char Indian GSTIN, or empty if not registered
  address: string;
  state: string;     // e.g., "Maharashtra"
  email: string;
  phone: string;
  hsn: string;       // default '998314' (IT services)
}

export interface InvoiceBuyer {
  name: string;
  email: string;
  gstin?: string;    // buyer's GSTIN if they provided one (B2B claim ITC)
  state?: string;
}

export interface InvoiceAmounts {
  base: number;      // gross / 1.18, rounded to 2dp
  cgst: number;      // 0 if inter-state
  sgst: number;      // 0 if inter-state
  igst: number;      // 0 if intra-state
  total: number;     // = subscription.amount (gross)
}

export interface Invoice {
  invoiceNumber: string;
  invoiceDate: Date;
  financialYear: string;            // "2026-27"
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  lineItem: {
    description: string;            // "ZapText subscription — Growth plan"
    hsn: string;                    // '998314'
    plan: string;                   // 'starter' | 'growth' | 'pro' | etc.
    periodStart: Date;
    periodEnd: Date;
  };
  amounts: InvoiceAmounts;
  paymentRef: string;               // razorpay_payment_id
  isInterState: boolean;
}

const HSN_SAAS = '998314';
const GST_RATE = 0.18;

function roundINR(n: number): number {
  // 2-decimal rounding consistent with Razorpay paise-based amounts.
  return Math.round(n * 100) / 100;
}

function financialYear(d: Date): string {
  // Indian FY runs Apr 1 → Mar 31. Convert a calendar date to its FY label.
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0=Jan, 3=Apr
  const start = m >= 3 ? y : y - 1;
  const end = (start + 1) % 100;
  return `${start}-${end.toString().padStart(2, '0')}`;
}

export function buildInvoice(args: {
  sub: SubscriptionRow;
  buyer: InvoiceBuyer;
  seller?: Partial<InvoiceSeller>;
}): Invoice {
  const { sub, buyer } = args;

  // Seller (ZapText) details — driven from env so the deploy-time
  // operator can update without a code change. Sensible defaults so the
  // invoice still renders even if env vars haven't been set yet.
  const seller: InvoiceSeller = {
    name: process.env.COMPANY_NAME || 'ZapText',
    gstin: process.env.COMPANY_GSTIN || '',
    address:
      process.env.COMPANY_ADDRESS ||
      '(GSTIN/address not configured — set COMPANY_GSTIN, COMPANY_NAME, COMPANY_ADDRESS)',
    state: process.env.COMPANY_STATE || 'Maharashtra',
    email: process.env.COMPANY_EMAIL || 'zaptextofficial@gmail.com',
    phone: process.env.COMPANY_PHONE || '',
    hsn: HSN_SAAS,
    ...args.seller,
  };

  // Tax split: intra-state when both states are known and equal.
  const isInterState =
    !seller.state ||
    !buyer.state ||
    seller.state.trim().toLowerCase() !== buyer.state.trim().toLowerCase();

  const total = roundINR(Number(sub.amount));
  const base = roundINR(total / (1 + GST_RATE));
  const taxTotal = roundINR(total - base);
  const amounts: InvoiceAmounts = isInterState
    ? { base, cgst: 0, sgst: 0, igst: taxTotal, total }
    : {
        base,
        cgst: roundINR(taxTotal / 2),
        sgst: roundINR(taxTotal / 2),
        igst: 0,
        total,
      };

  // Stored timestamps come from Drizzle as JS Date objects.
  const invoiceDate = sub.created_at;
  const fy = financialYear(invoiceDate);
  const suffix = sub.id.replace(/-/g, '').slice(-6).toUpperCase();
  const invoiceNumber = `ZAP/${fy}/${suffix}`;

  return {
    invoiceNumber,
    invoiceDate,
    financialYear: fy,
    seller,
    buyer,
    lineItem: {
      description: `ZapText subscription — ${capitalize(sub.plan)} plan`,
      hsn: HSN_SAAS,
      plan: sub.plan,
      periodStart: sub.start_date,
      periodEnd: sub.end_date,
    },
    amounts,
    paymentRef: sub.razorpay_payment_id || '(payment id unavailable)',
    isInterState,
  };
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// ─── HTML rendering ─────────────────────────────────────────────────────

export function renderInvoiceHTML(inv: Invoice): string {
  const fmtINR = (n: number) =>
    `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const taxRows = inv.isInterState
    ? `<tr><td>IGST (18%)</td><td style="text-align:right">${fmtINR(inv.amounts.igst)}</td></tr>`
    : `<tr><td>CGST (9%)</td><td style="text-align:right">${fmtINR(inv.amounts.cgst)}</td></tr>
       <tr><td>SGST (9%)</td><td style="text-align:right">${fmtINR(inv.amounts.sgst)}</td></tr>`;

  const buyerGstinRow = inv.buyer.gstin
    ? `<div><b>Buyer GSTIN:</b> ${escapeHTML(inv.buyer.gstin)}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tax Invoice — ${escapeHTML(inv.invoiceNumber)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #222; margin: 0; padding: 32px; max-width: 820px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: 0.5px; }
  h2 { font-size: 14px; color: #666; font-weight: 500; margin: 0 0 24px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 24px; }
  .box { border: 1px solid #ddd; border-radius: 8px; padding: 14px 16px; }
  .box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 0 0 8px; font-weight: 600; }
  .box .name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  .box div { font-size: 13px; line-height: 1.5; color: #444; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f7f7f8; font-weight: 600; font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
  .totals { width: 50%; margin-left: auto; margin-top: 16px; }
  .totals td { border: 0; padding: 6px 12px; }
  .totals .grand { font-weight: 700; font-size: 16px; border-top: 2px solid #222; padding-top: 12px; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #888; line-height: 1.6; }
  .ref { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; }
  @media print { body { padding: 16px; } .no-print { display: none; } }
</style>
</head>
<body>

<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px">
  <div>
    <h1>TAX INVOICE</h1>
    <h2>Original for Recipient</h2>
  </div>
  <div style="text-align:right">
    <div class="ref"><b>Invoice #:</b> ${escapeHTML(inv.invoiceNumber)}</div>
    <div class="ref" style="color:#666"><b>Date:</b> ${fmtDate(inv.invoiceDate)}</div>
    <div class="ref" style="color:#666"><b>FY:</b> ${escapeHTML(inv.financialYear)}</div>
  </div>
</div>

<div class="grid">
  <div class="box">
    <h3>Seller (Supplier)</h3>
    <div class="name">${escapeHTML(inv.seller.name)}</div>
    <div>${escapeHTML(inv.seller.address)}</div>
    <div>${escapeHTML(inv.seller.state)}</div>
    ${inv.seller.gstin ? `<div><b>GSTIN:</b> ${escapeHTML(inv.seller.gstin)}</div>` : '<div style="color:#c80">GSTIN not registered</div>'}
    <div>${escapeHTML(inv.seller.email)}</div>
    ${inv.seller.phone ? `<div>${escapeHTML(inv.seller.phone)}</div>` : ''}
  </div>
  <div class="box">
    <h3>Buyer (Recipient)</h3>
    <div class="name">${escapeHTML(inv.buyer.name)}</div>
    <div>${escapeHTML(inv.buyer.email)}</div>
    ${inv.buyer.state ? `<div>${escapeHTML(inv.buyer.state)}</div>` : ''}
    ${buyerGstinRow}
  </div>
</div>

<table>
  <thead>
    <tr><th>Description</th><th>HSN</th><th>Period</th><th style="text-align:right">Amount (excl. GST)</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>${escapeHTML(inv.lineItem.description)}</td>
      <td class="ref">${escapeHTML(inv.lineItem.hsn)}</td>
      <td>${fmtDate(inv.lineItem.periodStart)} → ${fmtDate(inv.lineItem.periodEnd)}</td>
      <td style="text-align:right">${fmtINR(inv.amounts.base)}</td>
    </tr>
  </tbody>
</table>

<table class="totals">
  <tr><td>Subtotal</td><td style="text-align:right">${fmtINR(inv.amounts.base)}</td></tr>
  ${taxRows}
  <tr class="grand"><td>Total</td><td style="text-align:right">${fmtINR(inv.amounts.total)}</td></tr>
</table>

<div class="footer">
  <div><b>Payment reference:</b> <span class="ref">${escapeHTML(inv.paymentRef)}</span></div>
  <div><b>Place of supply:</b> ${inv.isInterState ? 'Inter-state (IGST applies)' : 'Intra-state (CGST + SGST apply)'}</div>
  <div style="margin-top:12px">This is a system-generated invoice. No signature required.</div>
  <div>For queries, write to ${escapeHTML(inv.seller.email)}.</div>
</div>

</body>
</html>`;
}

function escapeHTML(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
