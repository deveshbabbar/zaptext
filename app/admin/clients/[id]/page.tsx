'use client';

import { useEffect, useState, use } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { getBusinessTypeMeta, BUSINESS_TYPES } from '@/lib/constants';
import { ClientRow, ConversationRow, AnalyticsRow, BusinessType } from '@/lib/types';

const VALID_BUSINESS_TYPES: BusinessType[] = ['restaurant', 'coaching', 'realestate', 'salon', 'd2c', 'gym', 'grocery'];
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
  const [approving, setApproving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [phoneIdDraft, setPhoneIdDraft] = useState('');
  const [savingPhoneId, setSavingPhoneId] = useState(false);
  const [pinDraft, setPinDraft] = useState('');
  const [registering, setRegistering] = useState(false);
  const [typeDraft, setTypeDraft] = useState<BusinessType | ''>('');
  const [savingType, setSavingType] = useState(false);

  const handleDeleteBot = async () => {
    const ok = window.confirm(
      'Delete this bot permanently? The client row AND all its conversation history will be removed from Google Sheets. This cannot be undone.'
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Bot deleted');
        window.location.href = '/admin/dashboard';
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setPromptDraft(d.client?.system_prompt || '');
        setPhoneIdDraft(d.client?.phone_number_id || '');
        const t = d.client?.type as BusinessType | undefined;
        setTypeDraft(t && VALID_BUSINESS_TYPES.includes(t) ? t : '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const handleSaveType = async () => {
    if (!typeDraft || !VALID_BUSINESS_TYPES.includes(typeDraft as BusinessType)) {
      toast.error('Pick a valid business type.');
      return;
    }
    setSavingType(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'type', value: typeDraft }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.message || body.error || 'Failed to save business type');
        return;
      }
      setData((prev) => {
        if (!prev) return prev;
        let kb: Record<string, unknown> = {};
        try { kb = JSON.parse(prev.client.knowledge_base_json || '{}'); } catch { kb = {}; }
        kb.type = typeDraft;
        return {
          ...prev,
          client: {
            ...prev.client,
            type: typeDraft as BusinessType,
            knowledge_base_json: JSON.stringify(kb),
          },
        };
      });
      toast.success('Business type updated. Regenerate the system prompt to refresh the bot personality.');
    } catch {
      toast.error('Failed to save business type');
    } finally {
      setSavingType(false);
    }
  };

  const handleRegisterWhatsApp = async () => {
    if (!/^[0-9]{6}$/.test(pinDraft)) {
      toast.error('PIN must be exactly 6 digits (the two-step verification PIN you set in Meta WhatsApp Manager).');
      return;
    }
    setRegistering(true);
    try {
      const res = await fetch('/api/admin/register-whatsapp-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: id, pin: pinDraft }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        toast.error(result.message || result.error || 'Registration failed');
        return;
      }
      toast.success(result.message || 'Number registered. Status will flip to Connected shortly.');
      setPinDraft('');
    } catch {
      toast.error('Registration request failed');
    } finally {
      setRegistering(false);
    }
  };

  const handleSavePhoneId = async () => {
    const trimmed = phoneIdDraft.trim();
    if (!/^[0-9]{6,20}$/.test(trimmed)) {
      toast.error('phone_number_id should be a numeric ID (typically 15 digits) from Meta WhatsApp Manager.');
      return;
    }
    setSavingPhoneId(true);
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'phone_number_id', value: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || 'Failed to save phone_number_id');
        return;
      }
      setData((prev) => prev ? { ...prev, client: { ...prev.client, phone_number_id: trimmed } } : prev);
      toast.success('phone_number_id saved. You can now approve the bot.');
    } catch {
      toast.error('Failed to save phone_number_id');
    } finally {
      setSavingPhoneId(false);
    }
  };

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
        <a href="/admin/dashboard" className="text-primary hover:underline">Back to dashboard</a>
      </div>
    );
  }

  const { client, conversations, analytics } = data;
  const meta = getBusinessTypeMeta(client.type as BusinessType);

  const handleStatusToggle = async () => {
    const newStatus = client.status === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'status', value: newStatus }),
      });
      if (!res.ok) { toast.error('Failed to update status'); return; }
      setData((prev) => prev ? { ...prev, client: { ...prev.client, status: newStatus as ClientRow['status'] } } : prev);
      toast.success(`Bot ${newStatus === 'active' ? 'activated' : 'paused'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSavePrompt = async () => {
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field: 'system_prompt', value: promptDraft }),
      });
      if (!res.ok) { toast.error('Failed to save'); return; }
      setData((prev) => prev ? { ...prev, client: { ...prev.client, system_prompt: promptDraft } } : prev);
      setEditingPrompt(false);
      toast.success('System prompt updated');
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleApproveReject = async (action: 'approve' | 'reject') => {
    setApproving(true);
    try {
      const res = await fetch('/api/admin/approve-bot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: id, action }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(result.message);
        setData((prev) => prev ? {
          ...prev,
          client: { ...prev.client, status: action === 'approve' ? 'active' : 'rejected' }
        } : prev);
      } else {
        toast.error(result.error || 'Failed');
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setApproving(false);
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

  const kb = (() => {
    try { return JSON.parse(client.knowledge_base_json || '{}'); } catch { return {}; }
  })() as Record<string, unknown>;
  const address = typeof kb.address === 'string' ? kb.address : '';
  const workingHours = typeof kb.workingHours === 'string' ? kb.workingHours : '';
  const telHref = (num: string) => `tel:${(num || '').replace(/[^+0-9]/g, '')}`;
  const waHref = (num: string) => `https://wa.me/${(num || '').replace(/[^0-9]/g, '')}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <a href="/admin/dashboard" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
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
              : client.status === 'pending'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
          }>
            {client.status}
          </Badge>
          {client.status !== 'pending' && (
            <Button variant="outline" onClick={handleStatusToggle}>
              {client.status === 'active' ? 'Pause Bot' : 'Activate Bot'}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDeleteBot}
            disabled={deleting}
            className="border-red-500/50 text-red-500 hover:bg-red-500/10"
          >
            {deleting ? 'Deleting…' : '🗑 Delete bot'}
          </Button>
        </div>
      </div>

      {/* Pending Approval Banner */}
      {client.status === 'pending' && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-2 border-amber-500/30 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="text-4xl">⏳</div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-foreground mb-1">Bot Pending Approval</h3>
              <p className="text-sm text-muted-foreground mb-1">
                This bot was created by the client and is waiting for your review.
                Review the configuration, test the bot, and approve or reject it.
              </p>
              <p className="text-xs text-muted-foreground">
                Created: {client.created_at} &middot; Owner: {client.owner_name}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                onClick={() => handleApproveReject('reject')}
                variant="outline"
                disabled={approving}
                className="border-red-500/50 text-red-500 hover:bg-red-500/10"
              >
                {approving ? '...' : '✕ Reject'}
              </Button>
              <Button
                onClick={() => handleApproveReject('approve')}
                disabled={approving}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                {approving ? '...' : '✓ Approve & Activate'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Business Type — must match the vertical the bot was created for. If
          the stored value is invalid or legacy (e.g. "clinic"), the prompt
          generator silently falls back to "restaurant", giving customers the
          wrong bot personality. Make this explicit and admin-fixable. */}
      {(() => {
        const storedType = (client.type as string) || '';
        const isValid = (VALID_BUSINESS_TYPES as ReadonlyArray<string>).includes(storedType);
        return (
          <Card className={`mb-8 border-2 ${isValid ? 'border-emerald-500/30' : 'border-red-500/50'}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span>🏷️</span> Business Type
                {isValid ? (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 ml-2">
                    {storedType}
                  </Badge>
                ) : (
                  <Badge className="bg-red-500/10 text-red-500 border-red-500/30 ml-2">
                    invalid: {storedType || '(empty)'}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isValid && (
                <p className="text-xs text-red-500 m-0">
                  This bot has an invalid or legacy business type. Until you fix it, the prompt generator
                  defaults to &ldquo;restaurant&rdquo; — so a gym/salon/etc. bot will reply with restaurant
                  language. Pick the correct type below.
                </p>
              )}
              <p className="text-xs text-muted-foreground m-0">
                Changing the type also rewrites the inner <code>type</code> field of <code>knowledge_base_json</code> atomically.
                Regenerate the system prompt afterwards so the bot personality matches the new vertical.
              </p>
              <div className="flex gap-2">
                <select
                  value={typeDraft}
                  onChange={(e) => setTypeDraft(e.target.value as BusinessType)}
                  className="flex-1 rounded-[10px] border border-[var(--line)] bg-[var(--card)] text-foreground px-3 py-2 text-sm"
                >
                  <option value="">— Select business type —</option>
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt.type} value={bt.type}>
                      {bt.icon} {bt.label} ({bt.type})
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleSaveType}
                  disabled={
                    savingType ||
                    !typeDraft ||
                    typeDraft === storedType
                  }
                >
                  {savingType ? 'Saving…' : 'Save type'}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* WhatsApp API Connection — phone_number_id is required before approval */}
      <Card className={`mb-8 border-2 ${client.phone_number_id ? 'border-emerald-500/30' : 'border-red-500/40'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>🔌</span> WhatsApp API Connection
            {client.phone_number_id ? (
              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 ml-2">connected</Badge>
            ) : (
              <Badge className="bg-red-500/10 text-red-500 border-red-500/30 ml-2">not connected</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              Phone Number ID <span className="text-red-500">*</span>
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              Get this from Meta WhatsApp Manager → Phone numbers → click your number → API Setup → copy the 15-digit
              &ldquo;Phone number ID&rdquo;. The webhook routes inbound messages by this ID — without it, the bot is silently dead.
            </p>
            <div className="flex gap-2">
              <Input
                value={phoneIdDraft}
                onChange={(e) => setPhoneIdDraft(e.target.value)}
                placeholder="e.g. 109876543210123"
                className="font-mono"
                inputMode="numeric"
              />
              <Button
                onClick={handleSavePhoneId}
                disabled={savingPhoneId || phoneIdDraft.trim() === (client.phone_number_id || '').trim()}
              >
                {savingPhoneId ? 'Saving…' : 'Save'}
              </Button>
            </div>
            {client.phone_number_id && (
              <p className="text-[11px] text-muted-foreground mt-2 font-mono">
                Current on file: <span className="text-foreground">{client.phone_number_id}</span>
              </p>
            )}
          </div>

          {client.phone_number_id && (
            <div className="border-t pt-3 mt-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Register on WhatsApp Cloud API
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                If Meta WhatsApp Manager shows status &ldquo;Pending&rdquo; for this number, register it here. First set a
                6-digit two-step verification PIN in Meta WhatsApp Manager → Phone numbers → Two-step verification, then enter
                that PIN below.
              </p>
              <div className="flex gap-2">
                <Input
                  value={pinDraft}
                  onChange={(e) => setPinDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="6-digit PIN"
                  className="font-mono"
                  inputMode="numeric"
                  maxLength={6}
                />
                <Button onClick={handleRegisterWhatsApp} disabled={registering || pinDraft.length !== 6}>
                  {registering ? 'Registering…' : 'Register on WhatsApp'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Status will flip Pending → Connected within ~30 seconds after success.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Contact Details — prominently visible for review & ongoing support */}
      <Card className="mb-8 border-2 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span>📇</span> Client Contact Details
            <Badge variant="outline" className="ml-2">{meta.label}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Owner Name</p>
            <p className="font-medium">{client.owner_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Business</p>
            <p className="font-medium">{client.business_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              📞 Contact Number <span className="text-[10px] normal-case font-normal text-muted-foreground">(call owner)</span>
            </p>
            {client.contact_number ? (
              <a
                href={telHref(client.contact_number)}
                className="font-mono text-lg font-semibold text-primary hover:underline"
              >
                {client.contact_number}
              </a>
            ) : (
              <p className="text-sm text-amber-600">Not provided</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
              💬 WhatsApp Bot Number <span className="text-[10px] normal-case font-normal text-muted-foreground">(customers message this)</span>
            </p>
            {client.whatsapp_number ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-lg font-semibold">{client.whatsapp_number}</span>
                <a
                  href={waHref(client.whatsapp_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  Open in WhatsApp →
                </a>
              </div>
            ) : (
              <p className="text-sm text-amber-600">Not provided</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Address</p>
            <p className="text-sm">
              {address || '—'}
              {client.city ? <span className="text-muted-foreground"> · {client.city}</span> : null}
            </p>
          </div>
          {workingHours && (
            <div className="sm:col-span-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Working Hours</p>
              <p className="text-sm">{workingHours}</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                            key={`${msg.timestamp}|${msg.direction}|${i}`}
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
                {(() => { try { return JSON.stringify(JSON.parse(client.knowledge_base_json || '{}'), null, 2); } catch { return client.knowledge_base_json || 'No configuration data'; } })()}
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
