'use client';

import { useEffect, useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { getBusinessTypeMeta } from '@/lib/constants';
import { ClientRow, ConversationRow, AnalyticsRow, BusinessType } from '@/lib/types';
import { toast } from 'sonner';

interface ClientData {
  client: ClientRow;
  conversations: ConversationRow[];
  analytics: AnalyticsRow[];
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ClientData | null>(null);
  const [loading, setLoading] = useState(true);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testing, setTesting] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState('');

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setPromptDraft(d.client?.system_prompt || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!data?.client) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Client not found</h1>
        <a href="/" className="text-primary hover:underline">Back to dashboard</a>
      </div>
    );
  }

  const { client, conversations, analytics } = data;
  const meta = getBusinessTypeMeta(client.type as BusinessType);

  const handleStatusToggle = async () => {
    const newStatus = client.status === 'active' ? 'paused' : 'active';
    try {
      await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'status', value: newStatus }),
      });
      setData((prev) => prev ? { ...prev, client: { ...prev.client, status: newStatus as ClientRow['status'] } } : prev);
      toast.success(`Bot ${newStatus === 'active' ? 'activated' : 'paused'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSavePrompt = async () => {
    try {
      await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'system_prompt', value: promptDraft }),
      });
      setData((prev) => prev ? { ...prev, client: { ...prev.client, system_prompt: promptDraft } } : prev);
      setEditingPrompt(false);
      toast.success('System prompt updated');
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleTestBot = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResponse('');
    try {
      const res = await fetch(`/api/clients/${id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: testMessage }),
      });
      const d = await res.json();
      setTestResponse(d.response || 'No response');
    } catch {
      setTestResponse('Error generating response');
    } finally {
      setTesting(false);
    }
  };

  // Group conversations by customer
  const customerConvos = conversations.reduce<Record<string, ConversationRow[]>>((acc, msg) => {
    if (!acc[msg.customer_phone]) acc[msg.customer_phone] = [];
    acc[msg.customer_phone].push(msg);
    return acc;
  }, {});

  const totalMessages = analytics.reduce((sum, a) => sum + a.total_messages, 0);
  const totalCustomers = new Set(conversations.map((c) => c.customer_phone)).size;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <a href="/" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
        &larr; Back to dashboard
      </a>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <span className={`text-4xl w-14 h-14 rounded-xl ${meta.bgColor} flex items-center justify-center`}>
            {meta.icon}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{client.business_name}</h1>
            <p className="text-muted-foreground">{meta.label} &middot; {client.city} &middot; {client.owner_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={
            client.status === 'active'
              ? 'bg-green-500/10 text-green-400 border-green-500/30'
              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
          }>
            {client.status}
          </Badge>
          <Button variant="outline" onClick={handleStatusToggle}>
            {client.status === 'active' ? 'Pause Bot' : 'Activate Bot'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Total Messages</p>
            <p className="text-2xl font-bold">{totalMessages}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Unique Customers</p>
            <p className="text-2xl font-bold">{totalCustomers}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="text-2xl font-bold capitalize">{client.status}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">Created</p>
            <p className="text-sm font-medium">{client.created_at}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="test" className="space-y-4">
        <TabsList>
          <TabsTrigger value="test">Test Bot</TabsTrigger>
          <TabsTrigger value="conversations">Conversations ({conversations.length})</TabsTrigger>
          <TabsTrigger value="prompt">System Prompt</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Test Bot Tab */}
        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Test Your Bot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message as a customer would..."
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleTestBot()}
                />
                <Button onClick={handleTestBot} disabled={testing}>
                  {testing ? 'Thinking...' : 'Send'}
                </Button>
              </div>
              {testResponse && (
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-2">Bot Response:</p>
                  <p className="whitespace-pre-wrap">{testResponse}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <p className="text-xs text-muted-foreground w-full">Try these:</p>
                {['Hi', 'Price list dikhao', 'Timing kya hai?', 'Appointment book karna hai'].map((msg) => (
                  <button
                    key={msg}
                    type="button"
                    onClick={() => { setTestMessage(msg); }}
                    className="text-xs px-3 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                  >
                    {msg}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversations Tab */}
        <TabsContent value="conversations">
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(customerConvos).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No conversations yet</p>
              ) : (
                <div className="space-y-6">
                  {Object.entries(customerConvos).map(([phone, msgs]) => (
                    <div key={phone}>
                      <h3 className="text-sm font-medium mb-2 text-muted-foreground">
                        Customer: {phone} ({msgs.length} messages)
                      </h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {msgs.slice(-20).map((msg, i) => (
                          <div
                            key={i}
                            className={`flex ${msg.direction === 'incoming' ? 'justify-start' : 'justify-end'}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                                msg.direction === 'incoming'
                                  ? 'bg-muted'
                                  : 'bg-primary text-primary-foreground'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.message}</p>
                              <p className="text-[10px] opacity-60 mt-1">{msg.timestamp}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Separator className="mt-4" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Prompt Tab */}
        <TabsContent value="prompt">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>System Prompt</CardTitle>
                <div className="flex gap-2">
                  {editingPrompt ? (
                    <>
                      <Button variant="outline" onClick={() => { setEditingPrompt(false); setPromptDraft(client.system_prompt); }}>Cancel</Button>
                      <Button onClick={handleSavePrompt}>Save</Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => setEditingPrompt(true)}>Edit</Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editingPrompt ? (
                <Textarea
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  rows={25}
                  className="font-mono text-sm"
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm bg-muted rounded-lg p-4 max-h-[600px] overflow-y-auto">
                  {client.system_prompt}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>Bot Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap text-sm bg-muted rounded-lg p-4 max-h-[600px] overflow-y-auto">
                {JSON.stringify(JSON.parse(client.knowledge_base_json || '{}'), null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Message Analytics (Last 7 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No analytics data yet</p>
              ) : (
                <div className="space-y-2">
                  {analytics.map((a, i) => (
                    <div key={i} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                      <span className="text-sm text-muted-foreground w-28">{a.date}</span>
                      <div className="flex-1">
                        <div
                          className="bg-primary/20 rounded-full h-6 flex items-center px-3"
                          style={{ width: `${Math.min(100, (a.total_messages / Math.max(...analytics.map((x) => x.total_messages))) * 100)}%` }}
                        >
                          <span className="text-xs font-medium">{a.total_messages} msgs</span>
                        </div>
                      </div>
                      <span className="text-sm text-muted-foreground">{a.unique_customers} customers</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
