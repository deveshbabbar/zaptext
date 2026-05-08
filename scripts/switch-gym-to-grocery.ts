// One-shot transactional script: switch ONE specific client from gym → grocery,
// then seed grocery defaults (products, slots, zone). Idempotent on the seed
// step (skips inserts if rows already exist for this client_id).
//
// Hardcoded target client_id: 847ec8f4-2e18-410e-b9cf-1ea725239060
// (business: "Gym time fitness", owner: Devesh Babbar)
//
// Usage:
//   npx tsx --env-file=.env.local scripts/switch-gym-to-grocery.ts
//
// All writes happen inside a single Neon HTTP transaction (atomic).
// If anything throws inside the transaction, the entire batch rolls back.

import { neon } from '@neondatabase/serverless';
import { randomUUID } from 'node:crypto';

const TARGET_CLIENT_ID = '847ec8f4-2e18-410e-b9cf-1ea725239060';

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('BLOCKED: DATABASE_URL is not set in env.\n');
  process.exit(2);
}

const sql = neon(url);

const DEFAULT_PRODUCTS: Array<{ name: string; aliases: string[]; unit: 'kg' | 'piece' | 'dozen' | 'bunch' }> = [
  { name: 'tamatar', aliases: ['tomato', 'tameta'], unit: 'kg' },
  { name: 'pyaaz', aliases: ['onion'], unit: 'kg' },
  { name: 'aloo', aliases: ['potato'], unit: 'kg' },
  { name: 'gobhi', aliases: ['cauliflower'], unit: 'kg' },
  { name: 'palak', aliases: ['spinach'], unit: 'bunch' },
  { name: 'methi', aliases: ['fenugreek'], unit: 'bunch' },
  { name: 'bhindi', aliases: ['okra'], unit: 'kg' },
  { name: 'baingan', aliases: ['brinjal', 'eggplant'], unit: 'kg' },
  { name: 'mirch', aliases: ['hari mirch', 'green chilli'], unit: 'kg' },
  { name: 'dhaniya', aliases: ['coriander'], unit: 'bunch' },
  { name: 'adrak', aliases: ['ginger'], unit: 'kg' },
  { name: 'lehsun', aliases: ['garlic'], unit: 'kg' },
  { name: 'nimbu', aliases: ['lemon'], unit: 'piece' },
  { name: 'kela', aliases: ['banana'], unit: 'dozen' },
];

type ClientRow = {
  client_id: string;
  type: string;
  business_name: string;
  owner_name: string;
  phone_number_id: string | null;
  status: string;
};

type CountRow = { c: number };

async function main() {
  // ─── Pre-flight: confirm target client exists and is currently gym-typed ───
  const rows = (await sql(
    `SELECT client_id, type, business_name, owner_name, phone_number_id, status
       FROM clients
      WHERE client_id = $1`,
    [TARGET_CLIENT_ID]
  )) as ClientRow[];

  if (rows.length === 0) {
    process.stderr.write(`BLOCKED: client_id ${TARGET_CLIENT_ID} not found in clients table.\n`);
    process.exit(1);
  }

  const before = rows[0];
  process.stdout.write('Pre-flight client state:\n');
  console.table([before]);

  if (before.type === 'grocery') {
    process.stdout.write('\nDONE: client.type is already "grocery". No-op (already switched).\n');
    return;
  }

  if (before.type !== 'gym') {
    process.stderr.write(
      `BLOCKED: client_id ${TARGET_CLIENT_ID} has type="${before.type}", expected "gym". Aborting.\n`
    );
    process.exit(1);
  }

  // ─── Pre-flight idempotency counts ───
  const productsCountRows = (await sql(
    `SELECT COUNT(*)::int AS c FROM grocery_products WHERE client_id = $1`,
    [TARGET_CLIENT_ID]
  )) as CountRow[];
  const slotsCountRows = (await sql(
    `SELECT COUNT(*)::int AS c FROM grocery_slots WHERE client_id = $1`,
    [TARGET_CLIENT_ID]
  )) as CountRow[];
  const zonesCountRows = (await sql(
    `SELECT COUNT(*)::int AS c FROM grocery_zones WHERE client_id = $1`,
    [TARGET_CLIENT_ID]
  )) as CountRow[];

  const existingProducts = productsCountRows[0]?.c ?? 0;
  const existingSlots = slotsCountRows[0]?.c ?? 0;
  const existingZones = zonesCountRows[0]?.c ?? 0;

  process.stdout.write(
    `Pre-flight grocery_* counts for this client: products=${existingProducts}, slots=${existingSlots}, zones=${existingZones}\n`
  );

  // ─── Build the transaction batch ───
  // sql.transaction([...]) on the neon HTTP driver runs all queries in a single
  // BEGIN/COMMIT, atomically. Any rejection rolls the whole batch back.
  const batch: Array<ReturnType<typeof sql>> = [];

  // 1. Switch type. Belt-and-suspenders: WHERE includes client_id AND current type.
  batch.push(
    sql(
      `UPDATE clients SET type = 'grocery'
         WHERE client_id = $1 AND type = 'gym'`,
      [TARGET_CLIENT_ID]
    )
  );

  // 2. Seed products (if none exist for this client).
  if (existingProducts === 0) {
    for (const p of DEFAULT_PRODUCTS) {
      batch.push(
        sql(
          `INSERT INTO grocery_products
             (id, client_id, name, name_aliases, unit, image_url, created_at)
           VALUES ($1, $2, $3, $4, $5, NULL, NOW())`,
          [randomUUID(), TARGET_CLIENT_ID, p.name.toLowerCase(), JSON.stringify(p.aliases), p.unit]
        )
      );
    }
  }

  // 3. Seed slots (if none exist).
  if (existingSlots === 0) {
    const allDays = JSON.stringify([0, 1, 2, 3, 4, 5, 6]);
    batch.push(
      sql(
        `INSERT INTO grocery_slots
           (id, client_id, label, start_time, end_time, cutoff_time, days_of_week, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [randomUUID(), TARGET_CLIENT_ID, 'Tomorrow 7-9am', '07:00', '09:00', '21:00', allDays, true]
      )
    );
    batch.push(
      sql(
        `INSERT INTO grocery_slots
           (id, client_id, label, start_time, end_time, cutoff_time, days_of_week, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [randomUUID(), TARGET_CLIENT_ID, 'Today 5-8pm', '17:00', '20:00', '15:00', allDays, true]
      )
    );
  }

  // 4. Seed default zone (if none exist).
  if (existingZones === 0) {
    batch.push(
      sql(
        `INSERT INTO grocery_zones
           (id, client_id, label, pincode, area_keywords, delivery_fee, min_order_for_free_delivery, min_order)
         VALUES ($1, $2, $3, NULL, '[]', $4, $5, $6)`,
        [randomUUID(), TARGET_CLIENT_ID, 'Default zone', '20.00', '300.00', '100.00']
      )
    );
  }

  process.stdout.write(`\nExecuting transaction with ${batch.length} statement(s)...\n`);

  try {
    // neon HTTP transaction: atomic; rolls back on any error.
    // Cast: neon-serverless types narrow `transaction` arg to specific generic
    // params, but the SQL-tag template returns a wider union. The runtime
    // contract is identical; this script ran successfully on first invocation.
    await sql.transaction(batch as never);
  } catch (e) {
    process.stderr.write(`BLOCKED: transaction failed and was rolled back: ${(e as Error).message}\n`);
    process.stderr.write((e as Error).stack ?? '');
    process.exit(1);
  }

  process.stdout.write('Transaction committed.\n\n');

  // ─── Post-flight verification ───
  const afterClient = (await sql(
    `SELECT client_id, type, business_name, owner_name, phone_number_id, status
       FROM clients
      WHERE client_id = $1`,
    [TARGET_CLIENT_ID]
  )) as ClientRow[];

  const afterProducts = (await sql(
    `SELECT COUNT(*)::int AS c FROM grocery_products WHERE client_id = $1`,
    [TARGET_CLIENT_ID]
  )) as CountRow[];
  const afterSlots = (await sql(
    `SELECT COUNT(*)::int AS c FROM grocery_slots WHERE client_id = $1`,
    [TARGET_CLIENT_ID]
  )) as CountRow[];
  const afterZones = (await sql(
    `SELECT COUNT(*)::int AS c FROM grocery_zones WHERE client_id = $1`,
    [TARGET_CLIENT_ID]
  )) as CountRow[];

  process.stdout.write('Post-flight client state:\n');
  console.table(afterClient);
  process.stdout.write(
    `Post-flight grocery_* counts: products=${afterProducts[0]?.c ?? 0}, slots=${afterSlots[0]?.c ?? 0}, zones=${afterZones[0]?.c ?? 0}\n`
  );

  const ok =
    afterClient[0]?.type === 'grocery' &&
    (afterProducts[0]?.c ?? 0) === 14 &&
    (afterSlots[0]?.c ?? 0) === 2 &&
    (afterZones[0]?.c ?? 0) === 1;

  if (ok) {
    process.stdout.write('\nDONE: switch + seed verified successfully.\n');
  } else {
    process.stdout.write(
      '\nDONE_WITH_CONCERNS: counts do not match expected (14 products / 2 slots / 1 zone). See post-flight output above.\n'
    );
  }
}

main().catch((e) => {
  process.stderr.write(`Failed: ${(e as Error).stack ?? String(e)}\n`);
  process.exit(1);
});
