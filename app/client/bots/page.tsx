import { requireClientWithBots } from '@/lib/auth';
import { BUSINESS_TYPES } from '@/lib/constants';
import Link from 'next/link';
import { PageTopbar, PageHead, Pill, StatusPill } from '@/components/app/primitives';

export default async function AllBotsPage() {
  const user = await requireClientWithBots();

  return (
    <>
      <PageTopbar
        crumbs={
          <>
            <b className="text-foreground">All bots</b> · {user.allBots.length} bot
            {user.allBots.length !== 1 ? 's' : ''}
          </>
        }
        actions={
          <Pill variant="ink" href="/client/create-bot">
            + Create new bot
          </Pill>
        }
      />
      <div style={{ padding: '28px 32px 60px' }}>
        <PageHead
          title={
            <>
              Your <span className="zt-serif">bots.</span>
            </>
          }
          sub="Each bot has its own number, knowledge base, and dashboard."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {user.allBots.map((bot) => {
            const meta = BUSINESS_TYPES.find((bt) => bt.type === bot.type);
            return (
              <div
                key={bot.client_id}
                className="relative border border-[var(--line)] rounded-[18px] bg-[var(--card)] hover:-translate-y-0.5 transition"
                style={{ padding: 22 }}
              >
                <div className="absolute" style={{ top: 18, right: 18 }}>
                  <StatusPill
                    variant={bot.status === 'active' ? 'active' : bot.status === 'pending' ? 'pending' : 'ok'}
                  >
                    {bot.status === 'pending' ? '⏳ Pending' : bot.status}
                  </StatusPill>
                </div>
                <div className="text-[36px] leading-none">{meta?.icon || '🤖'}</div>
                <h4 className="text-[18px] font-bold tracking-[-0.02em] mt-2.5 mb-0.5">
                  {bot.business_name}
                </h4>
                <div className="text-[12px] text-[var(--mute)]">{meta?.label}</div>
                <div className="zt-mono text-[12.5px] text-[var(--ink-2)] mt-3.5">
                  {bot.whatsapp_number || 'No number yet'}
                </div>
                <div className="text-[11px] text-[var(--mute)] mt-1.5">
                  {bot.city} · Created {bot.created_at}
                </div>
              </div>
            );
          })}
          <Link
            href="/client/create-bot"
            className="border-2 border-dashed border-[var(--line)] rounded-[18px] flex flex-col items-center justify-center text-[var(--mute)] font-semibold hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors"
            style={{ padding: 22, minHeight: 200 }}
          >
            <div className="text-[36px] mb-1.5">+</div>
            Add another bot
          </Link>
        </div>
      </div>
    </>
  );
}
