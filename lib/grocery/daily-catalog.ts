// lib/grocery/daily-catalog.ts
//
// Orchestration layer that takes ParsedCatalogItem[] (output of catalog-parser)
// and writes to grocery_daily_catalog after matching each item to a product.
//
// Returned report tells the webhook handler what to say to the owner.

import { findProductByName, createProduct } from '../db/grocery-products';
import { upsertDailyCatalog } from '../db/grocery-daily-catalog';
import type { ParsedCatalogItem } from './types';

export interface CatalogUpdateReport {
  date: string;
  upserted: Array<{
    name: string;
    price: number;
    in_stock: boolean;
  }>;
  unknown: ParsedCatalogItem[];
  errors: Array<{ item: ParsedCatalogItem; reason: string }>;
}

export interface ApplyCatalogOpts {
  // If true, automatically create products for unknown names instead of
  // returning them as `unknown`.
  autoCreateUnknown?: boolean;
}

export async function applyCatalogUpdate(
  client_id: string,
  date: string,
  items: ParsedCatalogItem[],
  opts: ApplyCatalogOpts = {}
): Promise<CatalogUpdateReport> {
  const report: CatalogUpdateReport = {
    date,
    upserted: [],
    unknown: [],
    errors: [],
  };

  const upsertItems: Array<{
    product_id: string;
    price_per_unit: number;
    in_stock: boolean;
  }> = [];

  for (const item of items) {
    if (item.price < 0) {
      report.errors.push({ item, reason: 'negative price' });
      continue;
    }
    let product = await findProductByName(client_id, item.name);
    if (!product) {
      if (opts.autoCreateUnknown) {
        product = await createProduct({
          client_id,
          name: item.name,
          unit: item.unit,
        });
      } else {
        report.unknown.push(item);
        continue;
      }
    }
    upsertItems.push({
      product_id: product.id,
      price_per_unit: item.price,
      in_stock: item.in_stock,
    });
    report.upserted.push({
      name: product.name,
      price: item.price,
      in_stock: item.in_stock,
    });
  }

  if (upsertItems.length > 0) {
    await upsertDailyCatalog(client_id, date, upsertItems);
  }

  return report;
}

export function formatCatalogReport(report: CatalogUpdateReport): string {
  const lines: string[] = [];

  if (report.upserted.length > 0) {
    lines.push(`Aaj ki list update ho gayi (${report.date}):`);
    for (const u of report.upserted) {
      lines.push(
        u.in_stock ? `✅ ${u.name} ₹${u.price}` : `❌ ${u.name} (out of stock)`
      );
    }
  }

  if (report.unknown.length > 0) {
    lines.push('');
    lines.push('Naye items milay — add karoon?');
    for (const u of report.unknown) {
      lines.push(`• ${u.name} ₹${u.price}/${u.unit}`);
    }
    lines.push('Reply "yes add" ya "no skip"');
  }

  if (report.errors.length > 0) {
    lines.push('');
    lines.push('Errors:');
    for (const e of report.errors) {
      lines.push(`• ${e.item.name}: ${e.reason}`);
    }
  }

  return lines.join('\n');
}
