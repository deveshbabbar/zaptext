'use client';

import { useRouter } from 'next/navigation';
import { ClientRow, BusinessType } from '@/lib/types';

const TYPE_ICONS: Record<BusinessType, string> = {
  restaurant: '🍽️',
  coaching: '📚',
  realestate: '🏠',
  salon: '💇',
  d2c: '🛍️',
  gym: '💪',
};

const TYPE_BG: Record<BusinessType, string> = {
  restaurant: 'bg-amber-100',
  coaching: 'bg-purple-100',
  realestate: 'bg-green-100',
  salon: 'bg-pink-100',
  d2c: 'bg-teal-100',
  gym: 'bg-red-100',
};

interface Props {
  bots: ClientRow[];
  activeBotId: string | null;
}

export function BotSwitcher({ bots, activeBotId }: Props) {
  const router = useRouter();

  const switchTo = async (botId: string) => {
    if (botId === activeBotId) return;
    await fetch('/api/client/switch-bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ botId }),
    });
    router.refresh();
  };

  return (
    <div className="px-2">
      <div className="flex items-center justify-between px-2 mb-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
        <span>My Bots</span>
        <span className="bg-primary/15 text-sidebar-foreground/90 px-1.5 py-0.5 rounded-md text-[9px]">{bots.length} of {bots.length}</span>
      </div>
      <div className="bg-sidebar-accent/40 border border-sidebar-border rounded-xl p-1 mb-2">
        {bots.map((bot) => {
          const active = bot.client_id === activeBotId;
          return (
            <button
              key={bot.client_id}
              onClick={() => switchTo(bot.client_id)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                active
                  ? 'bg-primary/15 border border-primary/30'
                  : 'hover:bg-sidebar-accent'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0 ${TYPE_BG[bot.type]}`}>
                {TYPE_ICONS[bot.type]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-sidebar-foreground truncate">{bot.business_name}</div>
                <div className="text-[10px] text-sidebar-foreground/50 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'active' ? 'bg-primary shadow-[0_0_6px_var(--primary)]' : 'bg-yellow-400'}`} />
                  {bot.whatsapp_number || 'No number yet'}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <a
        href="/client/create-bot"
        className="flex items-center justify-center gap-2 p-2.5 rounded-lg border border-dashed border-primary/30 text-sidebar-foreground text-xs font-semibold hover:bg-primary/5 transition-colors"
      >
        + Add New Bot
      </a>
    </div>
  );
}
