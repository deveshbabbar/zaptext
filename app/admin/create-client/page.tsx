'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { PageTopbar, PageHead, Panel, Pill } from '@/components/app/primitives';
import { PLANS, DURATIONS, computePlanPrice, type PlanKey, type DurationKey } from '@/lib/plans';
import { BUSINESS_TYPES } from '@/lib/constants';
import type { BusinessType } from '@/lib/types';

interface CreateResult {
  userId: string;
  clientId: string;
  createdFresh: boolean;
  tempPassword: string | null;
  welcomeEmailSent: boolean;
  plan: PlanKey;
  months: DurationKey;
  amount: number;
  endDate: string;
  adminUrl: string;
  warnings?: string[];
}

export default function AdminCreateClientPage() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [plan, setPlan] = useState<PlanKey>('starter');
  const [months, setMonths] = useState<DurationKey>(1);
  const [businessType, setBusinessType] = useState<BusinessType>('gym');
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [sendWelcomeEmail, setSendWelcomeEmail] = useState(true);

  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);

  const submit = async () => {
    if (!email || !businessName || !whatsappNumber) {
      toast.error('Email, business name, and WhatsApp number are required');
      return;
    }
    setCreating(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          contactPhone: contactPhone.trim(),
          plan,
          months,
          businessType,
          businessName: businessName.trim(),
          ownerName: ownerName.trim(),
          whatsappNumber: whatsappNumber.trim(),
          phoneNumberId: phoneNumberId.trim(),
          city: city.trim(),
          address: address.trim(),
          sendWelcomeEmail,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setResult(data);
        toast.success(data.createdFresh ? 'Account created and handed over!' : 'Bot + subscription added to existing account');
      } else if (res.status === 409) {
        toast.error(`Duplicate bot — ${data.field} already in use`);
      } else {
        toast.error(data.error || 'Failed to create client');
      }
    } catch (e) {
      toast.error(`Error: ${String(e).slice(0, 200)}`);
    } finally {
      setCreating(false);
    }
  };

  const estimatedPrice = computePlanPrice(plan, months);

  return (
    <>
      <PageTopbar
        crumbs={<><b className="text-foreground">Admin</b> · Create client account</>}
      />
      <div style={{ padding: '28px 32px 60px' }} className="max-w-4xl mx-auto flex flex-col gap-4">
        <PageHead
          title={<>Create <span className="zt-serif">&amp; handover</span> a client account.</>}
          sub="User account + subscription + bot in one shot. Share credentials with the client; they log in ready-to-go."
        />

        <Panel title="Client login (Clerk account)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Email *" value={email} onChange={setEmail} placeholder="client@example.com" />
            <Field label="Contact phone (for calls)" value={contactPhone} onChange={setContactPhone} placeholder="+919876543210" />
            <Field label="First name" value={firstName} onChange={setFirstName} placeholder="Rahul" />
            <Field label="Last name" value={lastName} onChange={setLastName} placeholder="Sharma" />
          </div>
          <label className="flex items-center gap-2 mt-3 text-[13px] cursor-pointer">
            <input
              type="checkbox"
              checked={sendWelcomeEmail}
              onChange={(e) => setSendWelcomeEmail(e.target.checked)}
              className="accent-[var(--ink)]"
            />
            Send welcome email with dashboard link
          </label>
          <p className="text-[11.5px] text-[var(--mute)] mt-2 m-0">
            If the email already has an account, we&apos;ll add the subscription + bot to that user instead of creating a new one.
          </p>
        </Panel>

        <Panel title="Plan & duration">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {(Object.keys(PLANS) as PlanKey[]).map((p) => {
              const active = plan === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlan(p)}
                  className={`rounded-[10px] border text-[12.5px] font-semibold transition ${
                    active
                      ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                      : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--ink)]'
                  }`}
                  style={{ padding: '10px 8px' }}
                >
                  {PLANS[p].name}
                  <div className="text-[10.5px] opacity-75 mt-0.5">₹{PLANS[p].price.toLocaleString('en-IN')}/mo</div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(Object.keys(DURATIONS) as unknown as DurationKey[]).map((k) => {
              const m = Number(k) as DurationKey;
              const active = months === m;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMonths(m)}
                  className={`rounded-[10px] border text-[13px] font-semibold transition ${
                    active
                      ? 'bg-[var(--accent)] text-[var(--accent-2)] border-[var(--accent)]'
                      : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--ink)]'
                  }`}
                  style={{ padding: '10px 8px' }}
                >
                  {DURATIONS[m].label}
                  {DURATIONS[m].savingLabel && (
                    <div className="text-[10px] opacity-80 mt-0.5">{DURATIONS[m].savingLabel}</div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="text-[13px] text-[var(--ink-2)]">
            Total: <b className="text-[var(--ink)] text-[16px]">₹{estimatedPrice.toLocaleString('en-IN')}</b> · {DURATIONS[months].label}
          </div>
          <p className="text-[11.5px] text-[var(--mute)] mt-2 m-0">
            Admin-granted subscriptions are recorded with paymentId <span className="zt-mono">admin-onboard-*</span>. Do this only after receiving payment outside Razorpay.
          </p>
        </Panel>

        <Panel title="Bot details">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {BUSINESS_TYPES.map((bt) => {
              const active = businessType === bt.type;
              return (
                <button
                  key={bt.type}
                  type="button"
                  onClick={() => setBusinessType(bt.type)}
                  className={`rounded-[10px] border text-[12.5px] font-semibold transition ${
                    active
                      ? 'bg-[var(--ink)] text-[var(--background)] border-[var(--ink)]'
                      : 'bg-[var(--card)] border-[var(--line)] hover:border-[var(--ink)]'
                  }`}
                  style={{ padding: '8px 6px' }}
                >
                  <span className="text-[18px]">{bt.icon}</span>
                  <div className="text-[11px] mt-0.5 opacity-90">{bt.label}</div>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Business name *" value={businessName} onChange={setBusinessName} placeholder="Sharma Ji Ka Dhaba" />
            <Field label="Owner name (bot persona)" value={ownerName} onChange={setOwnerName} placeholder="Rahul Sharma" />
            <Field label="WhatsApp bot number *" value={whatsappNumber} onChange={setWhatsappNumber} placeholder="+919876543210" />
            <div>
              <Field label="phone_number_id (Meta) *" value={phoneNumberId} onChange={setPhoneNumberId} placeholder="1041750202362657" />
              <p className="text-[11px] text-amber-600 mt-1 m-0">Required — without this, the bot cannot receive WhatsApp messages.</p>
            </div>
            <Field label="City" value={city} onChange={setCity} placeholder="Delhi" />
            <Field label="Address" value={address} onChange={setAddress} placeholder="Connaught Place" />
          </div>
          <p className="text-[11.5px] text-[var(--mute)] mt-2 m-0">
            Client can refine the bot&apos;s full config (menu, services, pricing, etc.) from their dashboard after login.
          </p>
        </Panel>

        <div className="flex items-center justify-end gap-2">
          <Pill variant="ink" onClick={submit}>
            {creating ? 'Creating…' : 'Create & handover →'}
          </Pill>
        </div>

        {result && (
          <Panel title="Done ✓" className="border-2 border-green-500/30">
            <div className="flex flex-col gap-2 text-[13.5px]">
              <div>
                <b>User:</b> <span className="zt-mono">{result.userId}</span>
                {result.createdFresh ? ' (new account created)' : ' (existing account updated)'}
              </div>
              <div>
                <b>Bot:</b> <span className="zt-mono">{result.clientId}</span>
                &nbsp;·&nbsp;
                <a href={result.adminUrl} className="text-[var(--ink)] border-b border-[var(--ink)] font-semibold">
                  Open bot →
                </a>
              </div>
              <div>
                <b>Subscription:</b> {PLANS[result.plan].name} · {DURATIONS[result.months].label} · ₹{result.amount.toLocaleString('en-IN')}
                &nbsp;·&nbsp;valid until {new Date(result.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              {result.tempPassword && (
                <div className="rounded-[10px] bg-amber-500/10 border border-amber-500/30 mt-2" style={{ padding: '12px 14px' }}>
                  <div className="font-bold text-amber-700 mb-1">🔑 Temporary password — share with client</div>
                  <div className="zt-mono text-[14px] tracking-wide select-all">{result.tempPassword}</div>
                  <div className="text-[11.5px] text-[var(--mute)] mt-2">
                    Client should change it on first login. Not stored on our side after this page reloads.
                  </div>
                </div>
              )}
              {result.welcomeEmailSent && (
                <div className="text-[12.5px] text-[var(--mute)]">📧 Welcome email sent.</div>
              )}
              {result.warnings && result.warnings.length > 0 && (
                <div className="rounded-[10px] bg-amber-500/10 border border-amber-500/30 mt-2" style={{ padding: '10px 14px' }}>
                  <div className="font-bold text-amber-700 text-[12.5px] mb-1">⚠️ Action required</div>
                  {result.warnings.map((w, i) => (
                    <div key={i} className="text-[12.5px] text-amber-800">{w}</div>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <div className="text-[12.5px] font-semibold mb-1.5">{label}</div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[10px] border border-[var(--line)] bg-[var(--card)] focus:border-[var(--ink)] focus:outline-none text-[13.5px]"
        style={{ padding: '11px 13px' }}
      />
    </div>
  );
}
