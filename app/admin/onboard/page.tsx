'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BUSINESS_TYPES } from '@/lib/constants';

export default function AdminOnboardPage() {
  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-3xl font-bold mb-2">Onboard New Client</h1>
      <p className="text-muted-foreground text-lg mb-8">Select the business type</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {BUSINESS_TYPES.map((bt) => (
          <a key={bt.type} href={`/admin/onboard/${bt.type}`}>
            <Card className="hover:border-primary/30 border-2 border-transparent transition-all cursor-pointer h-full hover:scale-[1.02]">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-3">
                  <span className={`text-3xl w-12 h-12 rounded-xl ${bt.bgColor} flex items-center justify-center`}>{bt.icon}</span>
                  <span className={bt.color}>{bt.label}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{bt.description}</p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
