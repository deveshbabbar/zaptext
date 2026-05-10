// READ-ONLY diagnostic v2: include DB clock + last 30m unique senders.
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
if (!url) {
  process.stderr.write('BLOCKED: DATABASE_URL is not set.\n');
  process.exit(2);
}

const CLIENT_ID = '847ec8f4-2e18-410e-b9cf-1ea725239060';
const sql = neon(url);

async function main() {
  const t = (await sql(`SELECT NOW() AS db_now, current_setting('TimeZone') AS tz`)) as Array<{
    db_now: string | Date;
    tz: string;
  }>;
  console.log('DB clock:', t[0]);

  const last30 = (await sql(
    `SELECT timestamp, customer_phone, direction, message_type, LEFT(message,160) AS preview
       FROM conversations
      WHERE client_id = $1
        AND timestamp >= NOW() - INTERVAL '30 minutes'
      ORDER BY timestamp DESC
      LIMIT 50`,
    [CLIENT_ID]
  )) as Array<Record<string, unknown>>;
  console.log(`\nRows in last 30 min (DB time): ${last30.length}`);
  console.table(last30);
}

main().catch((e) => {
  process.stderr.write(`Failed: ${(e as Error).stack ?? String(e)}\n`);
  process.exit(1);
});
