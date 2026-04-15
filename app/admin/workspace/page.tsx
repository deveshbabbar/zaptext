'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function WorkspacePage() {
  const [workspaceName, setWorkspaceName] = useState('ZapText HQ');
  const [language, setLanguage] = useState('English + Hinglish');
  const [timezone, setTimezone] = useState('Asia/Kolkata (IST)');
  const [notificationEmail, setNotificationEmail] = useState('admin@zaptext.shop');

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2">Workspace Settings</h1>
      <p className="text-muted-foreground mb-8">Configure your admin workspace</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General settings */}
        <Card>
          <CardHeader>
            <CardTitle>General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Workspace Name</Label>
              <Input
                id="ws-name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-lang">Default Language</Label>
              <Input
                id="ws-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-tz">Timezone</Label>
              <Input
                id="ws-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ws-email">Notification Email</Label>
              <Input
                id="ws-email"
                type="email"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
              />
            </div>
            <div className="pt-2">
              <Button>Save Changes</Button>
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg bg-primary/10 border border-border flex items-center justify-center text-2xl">
                  🤖
                </div>
                <Button variant="outline" size="sm">
                  Upload new logo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                PNG or SVG, 512x512 recommended
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-md border border-border"
                  style={{ backgroundColor: '#25D366' }}
                />
                <Input value="#25D366" readOnly className="max-w-[140px]" />
                <Badge variant="outline">WhatsApp Green</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Billing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-lg font-semibold mt-1">Business</p>
                <Badge className="bg-primary/10 text-primary border-primary/30 mt-2">
                  ₹4,999 / month
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Payment Method</p>
                <p className="text-lg font-semibold mt-1">Visa •••• 4242</p>
                <Button variant="outline" size="sm" className="mt-2">
                  Update payment method
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
