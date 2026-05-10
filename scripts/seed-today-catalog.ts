// One-shot transactional script: seed today's grocery_daily_catalog rows for
// the gym-switched client so the bot stops replying "stock empty".
//
// Hardcoded target client_id: 847ec8f4-2e18-410e-b9cf-1ea725239060
// (business: "Gym time fitness", now type='grocery')
//
// Usage:
//   npx tsx --env-file=.env.local scripts/seed-today-catalog.ts
//
// All inserts happen inside a single Neon HTTP transaction (atomic).
// Idempotent: if today's catalog rows already exist, exits as a no-op.
// Today's date is computed in IST (Asia/Kolkata) — NOT UTC.

import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

const TARGET_CLIENT_ID = '847ec8f4-2e18-410e-b9cf-1ea725239060';

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('BLOCKED: DATABASE_URL is not set in env.\n');
  process.exit(2);
}

const sql = neon(url);

const DEFAULT_PRICES: Record<string, number> = {
  tamatar: 30,
  pyaaz: 40,
  aloo: 25,
  gobhi: 35,
  palak: 15,
  methi: 15,
  bhindi: 50,
  baingan: 40,
  mirch: 60,
  dhaniya: 20,
  adrak: 100,
  lehsun: 120,
  nimbu: 5,
  kela: 40,
};

const FALLBACK_PRICE = 40;

type ProductRow = { id: string; name: string };
type CountRow = { c: number };
type CatalogJoinRow = { name: string; price_per_unit: string; in_stock: boolean };

function todayIST(): string {
  // en-CA gives YYYY-MM-DD format directly.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

async function main() {
  const today = todayIST();
  process.stdout.write(`Today (IST): ${today}\n\n`);

  // ─── Pre-flight: load all products for this client ───
  const products = (await sql(
    `SELECT id, name FROM grocery_products WHERE client_id = $1 ORDER BY name`,
    [TARGET_CLIENT_ID]
  )) as ProductRow[];

  process.stdout.write(`Pre-flight: ${products.length} grocery_products row(s) for client.\n`);

  if (products.length === 0) {
    process.stderr.write('BLOCKED: no grocery_products rows for this client. Aborting.\n');
    process.exit(1);
  }

  // ─── Pre-flight: existing catalog count for client + today ───
  const existing = (await sql(
    `SELECT COUNT(*)::int AS c
       FROM grocery_daily_catalog
      WHERE client_id = $1 AND date = $2`,
    [TARGET_CLIENT_ID, today]
  )) as CountRow[];

  const existingCount = existing[0]?.c ?? 0;
  process.stdout.write(`Pre-flight: ${existingCount} existing grocery_daily_catalog row(s) for ${today}.\n`);

  if (existingCount > 0) {
    process.stdout.write('\nDONE: already populated, no-op.\n');
    return;
  }

  // ─── Build the transaction batch ───
  const batch: Array<ReturnType<typeof sql>> = [];
  const priceLog: Array<{ name: string; price: number; mapped: boolean }> = [];

  for (const p of products) {
    const key = p.name.toLowerCase();
    const mapped = Object.prototype.hasOwnProperty.call(DEFAULT_PRICES, key);
    const price = mapped ? DEFAULT_PRICES[key]! : FALLBACK_PRICE;
    if (!mapped) {
      console.warn(
        `WARN: product "${p.name}" not in DEFAULT_PRICES map — defaulting to ₹${FALLBACK_PRICE}.`
      );
    }
    priceLog.push({ name: p.name, price, mapped });

    batch.push(
      sql(
        `INSERT INTO grocery_daily_catalog
           (id, client_id, product_id, date, price_per_unit, in_stock, stock_qty)
         VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
        [
          randomUUID(),
          TARGET_CLIENT_ID,
          p.id,
          today,
          price.toFixed(2),
          true,
        ]
      )
    );
  }

  process.stdout.write(`\nPrice plan (${priceLog.length} item(s)):\n`);
  console.table(priceLog);

  process.stdout.write(`\nExecuting transaction with ${batch.length} INSERT statement(s)...\n`);

  try {
    // neon HTTP transaction: atomic; any error rolls the whole batch back.
    // Cast: same pattern as scripts/switch-gym-to-grocery.ts:172 — runtime
    // contract is identical; types are over-narrowed.
    await sql.transaction(batch as never);
  } catch (e) {
    process.stderr.write(
      `BLOCKED: transaction failed and was rolled back: ${(e as Error).message}\n`
    );
    process.stderr.write((e as Error).stack ?? '');
    process.exit(1);
  }

  process.stdout.write('Transaction committed.\n\n');

  // ─── Post-flight: print today's full catalog joined with products ───
  const joined = (await sql(
    `SELECT p.name, c.price_per_unit, c.in_stock
       FROM grocery_daily_catalog c
       JOIN grocery_products p ON p.id = c.product_id
      WHERE c.client_id = $1 AND c.date = $2
      ORDER BY p.name`,
    [TARGET_CLIENT_ID, today]
  )) as CatalogJoinRow[];

  process.stdout.write(`Post-flight: ${joined.length} catalog row(s) for ${today}:\n`);
  console.table(joined);

  process.stdout.write(
    "\nBot now has 14 in-stock items for today. Customer messaging 'menu' or 'hi' should get the interactive list.\n"
  );
}

main().catch((e) => {
  process.stderr.write(`Failed: ${(e as Error).stack ?? String(e)}\n`);
  process.exit(1);
});
