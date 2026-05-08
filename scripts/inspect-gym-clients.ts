// READ-ONLY one-shot script: inspect dbabbar's gym test client(s).
//
// Lists all `clients` rows where `type = 'gym'`, augments each with recent
// conversation activity, and recommends the safest candidate for a
// type-switch test.
//
// Usage: npx tsx --env-file=.env.local scripts/inspect-gym-clients.ts
//
// SELECT-only. No INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE.

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('BLOCKED: DATABASE_URL is not set in env.\n');
  process.exit(2);
}

const sql = neon(url);

type GymClient = {
  client_id: string;
  business_name: string;
  owner_name: string;
  owner_user_id: string;
  whatsapp_number: string;
  phone_number_id: string | null;
  created_at: string | Date | null;
  status: string;
};

type Augmented = GymClient & {
  recent_24h_msgs: number;
  unique_customers_7d: number;
};

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function fmtDate(v: string | Date | null): string {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toISOString();
}

async function main() {
  const gymRows = (await sql(
    `SELECT client_id, business_name, owner_name, owner_user_id,
            whatsapp_number, phone_number_id, created_at, status
       FROM clients
      WHERE type = 'gym'
      ORDER BY created_at DESC NULLS LAST`
  )) as GymClient[];

  if (gymRows.length === 0) {
    process.stdout.write('No clients found with type = \'gym\'.\n');
    process.stdout.write('\nRECOMMENDATION: none — no gym-typed clients exist.\n');
    return;
  }

  const augmented: Augmented[] = [];
  for (const row of gymRows) {
    const msgs24 = (await sql(
      `SELECT COUNT(*)::int AS c
         FROM conversations
        WHERE client_id = $1
          AND timestamp >= NOW() - INTERVAL '24 hours'`,
      [row.client_id]
    )) as Array<{ c: number }>;

    const cust7 = (await sql(
      `SELECT COUNT(DISTINCT customer_phone)::int AS c
         FROM conversations
        WHERE client_id = $1
          AND timestamp >= NOW() - INTERVAL '7 days'`,
      [row.client_id]
    )) as Array<{ c: number }>;

    augmented.push({
      ...row,
      recent_24h_msgs: msgs24[0]?.c ?? 0,
      unique_customers_7d: cust7[0]?.c ?? 0,
    });
  }

  const tableRows = augmented.map((r) => ({
    client_id: r.client_id,
    business_name: r.business_name,
    owner_name: r.owner_name,
    owner_user_id: truncate(r.owner_user_id ?? '', 12),
    whatsapp_number: r.whatsapp_number,
    phone_number_id: r.phone_number_id && r.phone_number_id.length > 0 ? r.phone_number_id : '(empty)',
    created_at: fmtDate(r.created_at),
    status: r.status,
    recent_24h_msgs: r.recent_24h_msgs,
    unique_customers_7d: r.unique_customers_7d,
  }));

  process.stdout.write(`Found ${augmented.length} gym-typed client(s):\n\n`);
  console.table(tableRows);

  const safe = augmented.filter((r) => r.recent_24h_msgs === 0 && r.unique_customers_7d <= 1);
  process.stdout.write('\n');

  if (safe.length === 1) {
    process.stdout.write(
      `RECOMMENDATION: client_id = ${safe[0].client_id} (${safe[0].business_name}) — recent_24h_msgs=0 AND unique_customers_7d<=1, safe for type-switch test.\n`
    );
  } else if (safe.length > 1) {
    safe.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db_ = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db_ - da;
    });
    process.stdout.write(
      `RECOMMENDATION: client_id = ${safe[0].client_id} (${safe[0].business_name}) — multiple safe candidates; picked most recently created. Other safe options: ${safe
        .slice(1)
        .map((c) => c.client_id)
        .join(', ')}\n`
    );
  } else {
    const ranked = [...augmented].sort((a, b) => {
      if (a.recent_24h_msgs !== b.recent_24h_msgs) return a.recent_24h_msgs - b.recent_24h_msgs;
      return a.unique_customers_7d - b.unique_customers_7d;
    });
    const pick = ranked[0];
    process.stdout.write(
      `⚠️  RECOMMENDATION (FLAGGED): client_id = ${pick.client_id} (${pick.business_name}) is the least-active gym client, but it does NOT meet the safe criteria (recent_24h_msgs=${pick.recent_24h_msgs}, unique_customers_7d=${pick.unique_customers_7d}). A type-switch may disrupt live conversations — confirm with owner before proceeding.\n`
    );
  }
}

main().catch((e) => {
  process.stderr.write(`Failed: ${(e as Error).stack ?? String(e)}\n`);
  process.exit(1);
});
