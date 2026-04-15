import { requireClientWithBots } from '@/lib/auth';
import { BUSINESS_TYPES } from '@/lib/constants';

export default async function AllBotsPage() {
  const user = await requireClientWithBots();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-foreground">All My Bots</h1>
          <p className="text-muted-foreground text-sm mt-1">{user.allBots.length} bot{user.allBots.length !== 1 ? 's' : ''}</p>
        </div>
        <a href="/client/create-bot" className="bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-[13px] font-semibold hover:bg-primary/90 transition-colors">
          + Create New Bot
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {user.allBots.map((bot) => {
          const meta = BUSINESS_TYPES.find((bt) => bt.type === bot.type);
          return (
            <div key={bot.client_id} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center text-xl">
                    {meta?.icon || '🤖'}
                  </div>
                  <div>
                    <div className="font-bold text-[15px] text-foreground">{bot.business_name}</div>
                    <div className="text-[12px] text-muted-foreground">{meta?.label}</div>
                  </div>
                </div>
                <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${
                  bot.status === 'active' ? 'bg-primary/15 text-primary' : 'bg-yellow-500/15 text-yellow-600'
                }`}>
                  {bot.status}
                </span>
              </div>
              <div className="text-[12px] text-muted-foreground mb-3">
                {bot.whatsapp_number || 'No number yet'}
              </div>
              <div className="text-[11px] text-muted-foreground">{bot.city} · Created {bot.created_at}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
