'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function ClientSettingsPage() {
  const [prompt, setPrompt] = useState('');
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/client/settings')
      .then((res) => res.json())
      .then((data) => {
        setPrompt(data.systemPrompt || '');
        setConfig(data.knowledgeBase || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSavePrompt = async () => {
    setSaving(true);
    try {
      await fetch('/api/client/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'system_prompt', value: prompt }),
      });
      toast.success('System prompt updated!');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-muted rounded-lg"></div></div>;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">System Prompt</CardTitle>
            <Button onClick={handleSavePrompt} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={20} className="font-mono text-sm" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Business Configuration</CardTitle></CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm bg-muted rounded-lg p-4 max-h-[400px] overflow-y-auto">
            {(() => { try { return JSON.stringify(JSON.parse(config), null, 2); } catch { return config; } })()}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
