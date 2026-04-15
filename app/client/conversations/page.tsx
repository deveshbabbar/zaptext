'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface Message { timestamp: string; customer_phone: string; direction: string; message: string; }

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Record<string, Message[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/client/conversations')
      .then((res) => res.json())
      .then((data) => { setConversations(data.conversations || {}); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-muted rounded-lg"></div></div>;

  const phones = Object.keys(conversations);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Conversations</h1>
      {phones.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No conversations yet</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {phones.map((phone) => (
            <Card key={phone}>
              <CardHeader><CardTitle className="text-base">{phone} ({conversations[phone].length} messages)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {conversations[phone].slice(-20).map((msg, i) => (
                    <div key={i} className={`flex ${msg.direction === 'incoming' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.direction === 'incoming' ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                        <p className="whitespace-pre-wrap">{msg.message}</p>
                        <p className="text-[10px] opacity-60 mt-1">{msg.timestamp}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
