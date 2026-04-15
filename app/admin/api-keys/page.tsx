'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// demo data — integration display values
const INTEGRATIONS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '✨',
    description: 'LLM powering your bot replies',
    maskedKey: 'AIza•••••b8I',
    meta: null as string | null,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Cloud API',
    icon: '💬',
    description: 'Meta Business access token',
    maskedKey: 'EAA•••••AVu',
    meta: null,
  },
  {
    id: 'sheets',
    name: 'Google Sheets',
    icon: '📊',
    description: 'Service account for analytics & bookings',
    maskedKey: 'bot-factory@wa-bot.iam.gserviceaccount.com',
    meta: null,
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    icon: '💳',
    description: 'Payment gateway',
    maskedKey: 'rzp_test_•••••Xy9',
    meta: 'Test mode',
  },
];

const WEBHOOK_URL = 'https://yourdomain.com/api/webhook';
const VERIFY_TOKEN = 'botfactory-verify-token';

export default function ApiKeysPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">API Keys</h1>
      <p className="text-muted-foreground mb-8">Manage integration credentials</p>

      {/* Integrations */}
      <h2 className="text-xl font-semibold mb-4">Integrations</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {INTEGRATIONS.map((it) => (
          <Card key={it.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-2xl">{it.icon}</span>
                  {it.name}
                </CardTitle>
                {it.meta && (
                  <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/30">
                    {it.meta}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{it.description}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm font-mono truncate">
                  {it.maskedKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(it.id, it.maskedKey)}
                >
                  {copied === it.id ? 'Copied' : 'Copy'}
                </Button>
                <Button variant="outline" size="sm">
                  Rotate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Webhooks */}
      <h2 className="text-xl font-semibold mb-4">Webhooks</h2>
      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Webhook Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <div className="flex items-center gap-2">
              <Input value={WEBHOOK_URL} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy('webhook-url', WEBHOOK_URL)}
              >
                {copied === 'webhook-url' ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Paste this into Meta Business webhook config
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Verify Token</Label>
            <div className="flex items-center gap-2">
              <Input value={VERIFY_TOKEN} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => copy('verify-token', VERIFY_TOKEN)}
              >
                {copied === 'verify-token' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
