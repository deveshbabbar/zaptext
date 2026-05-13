// app/client/coaching/page.tsx — Coaching workspace overview.

import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { getBookingsForDate, getBookingsByClient } from '@/lib/db/bookings';
import { getISTDate } from '@/lib/utils';
import { PageTopbar, PageHead, Pill, Kpi, Panel, StatusPill } from '@/components/app/primitives';
import { SubTypesChips } from '@/components/client/sub-types-chips';

export default async function CoachingOverviewPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'coaching') redirect('/client/dashboard');

  const today = getISTDate();
  const [todayBookings, pending] = await Promise.all([
    getBookingsForDate(user.activeBot.client_id, today).catch(() => []),
    getBookingsByClient(user.activeBot.client_id, 'pending_approval').catch(() => []),
  ]);

  let courses: Array<Record<string, unknown>> = [];
  let kb: Record<string, unknown> = {};
  try {
    kb = user.activeBot.knowledge_base_json
      ? (JSON.parse(user.activeBot.knowledge_base_json) as Record<string, unknown>)
      : {};
    if (Array.isArray(kb.coursesOffered)) courses = kb.coursesOffered as Array<Record<string, unknown>>;
  } catch { /* ignore */ }

  // Compliance gates — these silently change bot behaviour. Surfacing them
  // here so the owner sees the same warnings the prompt-generator enforces.
  const subs: string[] = Array.isArray(kb.subTypes)
    ? (kb.subTypes as string[])
    : typeof kb.subType === 'string'
    ? [kb.subType as string]
    : [];
  const UNDER_18_SUBTYPES = new Set([
    'school-tuition-primary', 'school-tuition-middle', 'board-prep',
    'coding-kids', 'jee-main', 'jee-advanced', 'neet-ug', 'cat-mba',
    'clat-law', 'nift-nid-ceed', 'gate-psu', 'music', 'dance',
    'art-calligraphy', 'chess', 'robotics-stem', 'abacus-vedic',
    'public-speaking',
  ]);
  const isUnder18Audience = subs.some((s) => UNDER_18_SUBTYPES.has(s));
  const minorConsentMissing = isUnder18Audience && !kb.minorConsentCollected;
  const noRankClaimUnattested = kb.noFalseRankClaim === undefined;
  const rajRegistered = kb.rajCoachingActRegistered === true;
  const rajUnknown = kb.rajCoachingActRegistered === undefined;
  const gateAlerts: Array<{ severity: 'block' | 'warn'; title: string; body: string }> = [];
  if (minorConsentMissing) {
    gateAlerts.push({
      severity: 'block',
      title: 'DPDPA §9 — minor-consent flow not configured',
      body: "Your sub-type targets students likely under 18. Bot will pause enrolment until it asks for parent's WhatsApp number on every minor enquiry. Configure parental-consent flow in Bot Settings.",
    });
  }
  if (noRankClaimUnattested) {
    gateAlerts.push({
      severity: 'warn',
      title: 'Rajasthan Coaching Bill — rank-claim attestation missing',
      body: 'Confirm in Bot Settings that your ads/posters do not promise "guaranteed selection" or "AIR 1 pakka". Bot will hard-block these phrases by default.',
    });
  }
  if (rajUnknown) {
    gateAlerts.push({
      severity: 'warn',
      title: 'Rajasthan Coaching Centres Act registration not declared',
      body: 'If you operate in Rajasthan, registration is mandatory. Add Raj Bill registration number in Bot Settings → Compliance.',
    });
  }
  if (rajRegistered && !kb.rajCoachingActRegNo) {
    gateAlerts.push({
      severity: 'warn',
      title: 'Raj Bill registration number missing',
      body: 'You marked your institute as Raj Bill registered but the registration number is empty.',
    });
  }

  return (
    <>
      <PageTopbar
        crumbs={<>Coaching / <b className="text-foreground">Overview</b></>}
        actions={<Pill variant="ink" href="/client/coaching/courses">Manage courses</Pill>}
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={<>{user.activeBot.business_name} <span className="zt-serif">workspace.</span></>}
          sub="Today's classes, fees due, and student inquiries at a glance."
        />
        <SubTypesChips kb={kb} />

        {/* Compliance gates — DPDPA §9, Rajasthan Coaching Bill. These flags
            change bot behaviour silently; surfacing them so the owner sees
            the same gate the prompt-generator enforces. */}
        {gateAlerts.length > 0 && (
          <div className="flex flex-col gap-2.5 mb-5">
            {gateAlerts.map((g, idx) => (
              <div
                key={idx}
                className="rounded-[12px] border"
                style={{
                  padding: '12px 14px',
                  borderColor: g.severity === 'block' ? '#dc2626' : '#f59e0b',
                  background: g.severity === 'block' ? '#dc262610' : '#f59e0b10',
                }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold mb-1">
                      {g.severity === 'block' ? '🚫' : '⚠'} {g.title}
                    </div>
                    <div className="text-[12.5px] text-[var(--mute)]">{g.body}</div>
                  </div>
                  <Pill variant="ink" href="/client/settings#compliance">Open settings</Pill>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <Kpi label="Courses offered" value={courses.length} trend={courses.length === 0 ? 'Start with Bulk import' : undefined} />
          <Kpi label="Today's classes" value={todayBookings.length} />
          <Kpi label="Pending approvals" value={pending.length} />
          <Kpi label="Confirmed today" value={todayBookings.filter((b) => b.status === 'confirmed').length} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <Panel title="Quick actions" sub="Jump into the most common coaching workflows.">
            <div className="grid grid-cols-2 gap-2.5">
              <Pill variant="ghost" href="/client/coaching/courses">📚 Courses ({courses.length})</Pill>
              <Pill variant="ghost" href="/client/coaching/batches">📅 Batches ({todayBookings.length})</Pill>
              <Pill variant="ghost" href="/client/conversations">💬 Inquiries</Pill>
              <Pill variant="ghost" href="/client/settings">⚙️ Bot settings</Pill>
            </div>
          </Panel>
          <Panel title="Today's batches" sub={`${todayBookings.length} scheduled for ${today}`}>
            {todayBookings.length === 0 ? (
              <div className="text-[13px] text-[var(--mute)] py-2">No classes booked for today.</div>
            ) : (
              <ul className="flex flex-col">
                {todayBookings.slice(0, 6).map((b) => (
                  <li key={b.booking_id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--line)] last:border-b-0">
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold truncate">{b.customer_name || b.customer_phone}</div>
                      <div className="text-[11.5px] text-[var(--mute)] zt-mono uppercase tracking-[.06em]">
                        {b.time_slot}{b.service ? ` · ${b.service}` : ''}
                      </div>
                    </div>
                    <StatusPill variant={b.status === 'confirmed' || b.status === 'completed' ? 'ok' : b.status === 'cancelled' || b.status === 'no_show' ? 'cancel' : 'pending'}>{b.status}</StatusPill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
