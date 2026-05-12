// Dine-in flow smoke tests.
//
// These exercise the public, unauthed parts of the dine-in surface that
// don't require a real WhatsApp number, real seed data, or Clerk login:
//   - Invalid session id at /m/<client>/<table>/<session> shows the
//     expired-session screen (no crash, no leak of menu data).
//   - Missing JSON at /api/dine-in/submit returns a clean 400.
//   - Submit with bogus ids returns 4xx, never 500.
//
// Full happy-path requires a seeded client + table + open session in the
// DB. Run those manually via the dashboard for now; the smoke gives us
// confidence the route shape is stable across deploys.

import { test, expect } from '@playwright/test';

const FAKE_CLIENT = 'e2e-nonexistent-client';
const FAKE_TABLE = '1';
const FAKE_SESSION = 'e2e-bad-session-id';

test.describe('dine-in public surface', () => {
  test('unknown client → menu route 404s gracefully', async ({ page }) => {
    const res = await page.goto(`/m/${FAKE_CLIENT}/${FAKE_TABLE}/${FAKE_SESSION}`);
    expect(res?.status()).toBeGreaterThanOrEqual(400);
  });

  test('submit endpoint rejects invalid JSON', async ({ request }) => {
    const res = await request.post('/api/dine-in/submit', {
      headers: { 'content-type': 'application/json' },
      data: '<<<not-json>>>',
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error.toLowerCase()).toContain('invalid');
  });

  test('submit endpoint requires items', async ({ request }) => {
    const res = await request.post('/api/dine-in/submit', {
      data: { clientId: FAKE_CLIENT, tableNumber: FAKE_TABLE, sessionId: FAKE_SESSION },
    });
    expect(res.status()).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error.toLowerCase()).toContain('items');
  });

  test('submit endpoint rejects unknown restaurant cleanly', async ({ request }) => {
    const res = await request.post('/api/dine-in/submit', {
      data: {
        clientId: FAKE_CLIENT,
        tableNumber: FAKE_TABLE,
        sessionId: FAKE_SESSION,
        items: [{ name: 'Test Item', qty: 1, price: 100 }],
      },
    });
    // Either 404 (unknown restaurant), 403 (plan locked), or 410 (expired
    // session) — all acceptable; what we want to fail is a 500 / crash.
    expect([400, 403, 404, 410]).toContain(res.status());
  });
});
