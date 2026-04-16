'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CommonFieldsForm } from '@/components/forms/common-fields';
import { TypeFieldsForm } from '@/components/forms/type-fields';
import { BUSINESS_TYPES } from '@/lib/constants';
import { BusinessType } from '@/lib/types';
import { toast } from 'sonner';

export default function CreateBotPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<BusinessType | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({ languages: ['Hindi', 'English', 'Hinglish'] });
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasActivePlan, setHasActivePlan] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/client/subscription')
      .then((r) => r.json())
      .then((d) => {
        if (!d.current) {
          setHasActivePlan(false);
        } else {
          setHasActivePlan(true);
        }
      })
      .catch(() => setHasActivePlan(true));
  }, []);

  const onChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const selectType = (t: BusinessType) => {
    setSelectedType(t);
    setFormData((prev) => ({ ...prev, type: t }));
  };

  const goToStep2 = () => {
    if (!selectedType) { toast.error('Please select a business type'); return; }
    setStep(2);
  };

  const handleAutoFill = async () => {
    if (!websiteUrl.trim()) { toast.error('Enter a URL'); return; }
    setScraping(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl, businessType: selectedType }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setFormData((prev) => {
          const merged: Record<string, unknown> = { ...prev };
          for (const [key, value] of Object.entries(data.data)) {
            if (value && (!(key in prev) || prev[key] === '' || prev[key] === undefined)) merged[key] = value;
          }
          merged.type = selectedType;
          return merged;
        });
        toast.success('Data extracted! Review below.');
      } else {
        toast.error(data.error || 'Could not extract');
      }
    } catch {
      toast.error('Failed to fetch');
    } finally {
      setScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName || !formData.ownerName || !formData.whatsappNumber) {
      toast.error('Fill Business Name, Owner Name, and WhatsApp Number');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: formData, phoneNumberId: '' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('🎉 Bot request submitted! Our team will review and activate your bot within 48 hours.');
        router.push('/client/dashboard?activated=pending');
      } else if (data.error === 'NO_PLAN') {
        toast.error('Please purchase a plan first!');
        router.push('/client/subscription');
      } else if (data.error === 'BOT_LIMIT') {
        toast.error(data.message || 'Bot limit reached. Please upgrade your plan.');
        router.push('/client/subscription');
      } else {
        toast.error(data.error || 'Failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeMeta = selectedType ? BUSINESS_TYPES.find((bt) => bt.type === selectedType) : null;

  // Show blocker if no active plan
  if (hasActivePlan === false) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center">
        <div className="bg-card border border-border rounded-2xl p-8">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Plan Required</h1>
          <p className="text-muted-foreground mb-6">
            You need an active subscription to create a WhatsApp bot. Choose a plan to get started!
          </p>
          <Button
            onClick={() => router.push('/client/subscription')}
            className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 text-base"
          >
            Choose a Plan →
          </Button>
        </div>
      </div>
    );
  }

  // Loading state while checking plan
  if (hasActivePlan === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <StepCircle num={1} state={step > 1 ? 'done' : 'active'} />
          <div className={`flex-1 h-0.5 ${step > 1 ? 'bg-accent' : 'bg-border'}`} />
          <StepCircle num={2} state={step === 2 ? 'active' : 'pending'} />
          <div className="flex-1 h-0.5 bg-border" />
          <StepCircle num={3} state="pending" />
        </div>
        <div className="flex justify-between px-[14px] text-[11px] text-muted-foreground">
          <span>Type</span>
          <span>Details</span>
          <span>Go Live</span>
        </div>
      </div>

      {step === 1 && (
        <>
          <h1 className="text-[26px] font-bold tracking-tight mb-1.5 text-foreground">What kind of business?</h1>
          <p className="text-sm text-muted-foreground mb-6">We&apos;ll tailor the bot&apos;s personality to match.</p>

          <div className="grid grid-cols-2 gap-2.5 mb-6">
            {BUSINESS_TYPES.map((bt) => {
              const active = selectedType === bt.type;
              return (
                <button
                  key={bt.type}
                  type="button"
                  onClick={() => selectType(bt.type)}
                  className={`text-left rounded-xl p-3.5 border-2 transition-all ${
                    active
                      ? 'border-primary bg-gradient-to-br from-accent/10 to-secondary'
                      : 'border-border bg-secondary hover:border-primary/60 hover:-translate-y-0.5'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-lg">
                      {bt.icon}
                    </div>
                    {active && <span className="text-accent font-bold">✓</span>}
                  </div>
                  <div className="font-semibold text-sm text-foreground">{bt.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{bt.description}</div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <Button onClick={goToStep2} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Continue →
            </Button>
          </div>
        </>
      )}

      {step === 2 && selectedType && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight mb-1.5 text-foreground">
              Tell us about {activeMeta?.icon} {activeMeta?.label}
            </h1>
            <p className="text-sm text-muted-foreground">The AI learns from this to answer customers.</p>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-dashed border-accent/50 bg-gradient-to-br from-accent/10 to-background p-5">
            <div className="text-sm font-bold flex items-center gap-1.5 mb-1 text-foreground">✨ Auto-fill with AI</div>
            <p className="text-xs text-muted-foreground mb-3">Paste your Zomato/Swiggy/Instagram link — we&apos;ll extract everything</p>
            <div className="flex gap-2">
              <Input
                placeholder="https://zomato.com/your-restaurant"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <Button type="button" onClick={handleAutoFill} disabled={scraping} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {scraping ? 'Extracting...' : '🔍 Extract'}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground uppercase tracking-widest">or fill manually</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Card>
            <CardContent className="pt-6">
              <CommonFieldsForm data={formData} onChange={onChange} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <TypeFieldsForm type={selectedType} data={formData} onChange={onChange} />
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>← Back</Button>
            <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {submitting ? 'Creating...' : 'Create My Bot 🚀'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function StepCircle({ num, state }: { num: number; state: 'active' | 'done' | 'pending' }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
        state === 'active'
          ? 'bg-primary text-primary-foreground'
          : state === 'done'
          ? 'bg-accent text-accent-foreground'
          : 'bg-secondary text-muted-foreground'
      }`}
    >
      {state === 'done' ? '✓' : num}
    </div>
  );
}
