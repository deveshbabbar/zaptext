'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { validateDisplayName } from '@/lib/whatsapp-naming';

// MapLibre touches `window` — load client-side only.
const BusinessLocationPicker = dynamic(
  () => import('@/components/maps/business-location-picker').then((m) => m.BusinessLocationPicker),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 260,
          borderRadius: 10,
          border: '1px solid var(--line, #ddd)',
          background: '#f7f7f7',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: '#888',
        }}
      >
        Loading map…
      </div>
    ),
  }
);

interface CommonFieldsProps {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}


// Strip +91 / 91 / leading 0 / spaces so only the 10-digit number shows in input.
// The stored form is `+91<10 digits>`; as the user types a single digit D the
// stored value passes through `+91D`. We MUST strip the leading 91 regardless
// of total length, otherwise typing "9" displays as "919" (the bug where a
// single keystroke produces "9191919…").
function phoneWithoutPrefix(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  // Country-coded (starts with 91) — strip, clamp to at most 10 remaining digits.
  if (digits.startsWith('91')) return digits.slice(2, 12);
  // Leading-zero Indian format (e.g. 09876543210) — strip, clamp to 10.
  if (digits.startsWith('0') && digits.length >= 11) return digits.slice(1, 11);
  return digits.slice(0, 10);
}

interface DaySchedule {
  enabled: boolean;
  open: string;
  close: string;
}

const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function parseWorkingHours(str: string): Record<string, DaySchedule> {
  // Simple: if can't parse, default everyone to Mon-Sat 10-19
  const result: Record<string, DaySchedule> = {};
  DAYS_SHORT.forEach((d) => {
    result[d] = {
      enabled: d !== 'Sun',
      open: '10:00',
      close: '19:00',
    };
  });
  return result;
}

function formatWorkingHours(schedule: Record<string, DaySchedule>): string {
  const parts: string[] = [];
  DAYS_SHORT.forEach((d) => {
    const s = schedule[d];
    if (s?.enabled) {
      parts.push(`${d}: ${s.open}-${s.close}`);
    } else {
      parts.push(`${d}: Closed`);
    }
  });
  return parts.join(', ');
}

function WorkingHoursPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>(() => parseWorkingHours(value));

  const updateDay = (day: string, patch: Partial<DaySchedule>) => {
    const updated = { ...schedule, [day]: { ...schedule[day], ...patch } };
    setSchedule(updated);
    onChange(formatWorkingHours(updated));
  };

  return (
    <div className="space-y-2 mt-1 border border-border rounded-lg p-3 bg-card">
      {DAYS_SHORT.map((d) => {
        const s = schedule[d];
        return (
          <div key={d} className="flex items-center gap-3">
            <label className="flex items-center gap-2 w-24 text-sm">
              <input
                type="checkbox"
                checked={s.enabled}
                onChange={(e) => updateDay(d, { enabled: e.target.checked })}
                className="accent-primary"
              />
              {d}
            </label>
            {s.enabled ? (
              <>
                <input
                  type="time"
                  value={s.open}
                  onChange={(e) => updateDay(d, { open: e.target.value })}
                  className="px-2 py-1 text-sm border border-border rounded bg-background"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="time"
                  value={s.close}
                  onChange={(e) => updateDay(d, { close: e.target.value })}
                  className="px-2 py-1 text-sm border border-border rounded bg-background"
                />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Closed</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CommonFieldsForm({ data, onChange }: CommonFieldsProps) {
  // Live WhatsApp display-name validation. Catches Meta-rejection patterns
  // (generic-only names like "Gym Time Fitness", URLs, emojis, ALL CAPS,
  // bare locations, etc.) BEFORE the bot is submitted to Meta — a Meta
  // rejection takes days to surface, this is instant.
  const businessNameRaw = (data.businessName as string) || '';
  const nameValidation = useMemo(
    () => validateDisplayName(businessNameRaw),
    [businessNameRaw]
  );
  const showNameValidation = businessNameRaw.trim().length >= 3;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Basic Information</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="businessName">Business Name *</Label>
          <Input
            id="businessName"
            placeholder="e.g., Dr. Sharma Clinic"
            value={businessNameRaw}
            onChange={(e) => onChange('businessName', e.target.value)}
          />
          {showNameValidation && (
            <div className="mt-1.5 space-y-1 text-[12px]">
              {nameValidation.errors.map((err, i) => (
                <div key={`e-${i}`} className="text-red-500 flex gap-1">
                  <span>⛔</span><span>{err}</span>
                </div>
              ))}
              {nameValidation.warnings.map((w, i) => (
                <div key={`w-${i}`} className="text-amber-500 flex gap-1">
                  <span>⚠️</span><span>{w}</span>
                </div>
              ))}
              {nameValidation.suggestions.length > 0 && (
                <div className="text-muted-foreground">
                  <span>Try: </span>
                  {nameValidation.suggestions.map((s, i) => (
                    <button
                      key={`s-${i}`}
                      type="button"
                      onClick={() => onChange('businessName', s)}
                      className="underline hover:text-foreground mr-2"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {nameValidation.valid && nameValidation.warnings.length === 0 && (
                <div className="text-green-500 flex gap-1">
                  <span>✓</span><span>Looks good — should pass Meta&apos;s display-name review.</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="ownerName">Owner / Contact Name *</Label>
          <Input
            id="ownerName"
            placeholder="e.g., Dr. Rajesh Sharma"
            value={(data.ownerName as string) || ''}
            onChange={(e) => onChange('ownerName', e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contactNumber">Your Contact Number *</Label>
          <div className="flex mt-1">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-secondary text-sm text-muted-foreground select-none font-medium">
              +91
            </span>
            <Input
              id="contactNumber"
              placeholder="9876543210"
              className="rounded-l-none"
              value={phoneWithoutPrefix((data.contactNumber as string) || '')}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                onChange('contactNumber', digits ? `+91${digits}` : '');
              }}
              maxLength={10}
            />
          </div>
          {(() => {
            const digits = phoneWithoutPrefix((data.contactNumber as string) || '');
            if (digits && digits.length !== 10) {
              return <p className="text-xs text-red-500 mt-1">Enter 10 digits (e.g. 9876543210)</p>;
            }
            return <p className="text-xs text-muted-foreground mt-1">📞 Make sure we can reach you here — we may call or send an OTP during bot setup.</p>;
          })()}
        </div>
        <div>
          <Label htmlFor="whatsappNumber">WhatsApp Bot Number *</Label>
          <div className="flex mt-1">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-secondary text-sm text-muted-foreground select-none font-medium">
              +91
            </span>
            <Input
              id="whatsappNumber"
              placeholder="9876543210"
              className="rounded-l-none"
              value={phoneWithoutPrefix((data.whatsappNumber as string) || '')}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                onChange('whatsappNumber', digits ? `+91${digits}` : '');
              }}
              maxLength={10}
            />
          </div>
          {(() => {
            const digits = phoneWithoutPrefix((data.whatsappNumber as string) || '');
            if (digits && digits.length !== 10) {
              return <p className="text-xs text-red-500 mt-1">Enter 10 digits (e.g. 9876543210)</p>;
            }
            return (
              <div className="mt-1 space-y-1">
                <p className="text-xs text-amber-600">
                  ⚠️ <strong>Use a brand new number that has NEVER been used on WhatsApp</strong> — not even once. If it was ever registered on WhatsApp (personal or business), delete that account first from your phone before giving it to us.
                </p>
                <p className="text-xs text-muted-foreground">
                  Once we register this on WhatsApp Business API, it <strong>cannot be used for regular WhatsApp messaging</strong> on any phone.
                </p>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            placeholder="e.g., Delhi"
            value={(data.city as string) || ''}
            onChange={(e) => onChange('city', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="address">Full Address *</Label>
          <Input
            id="address"
            placeholder="e.g., A-12, Green Park Main, New Delhi 110016"
            value={(data.address as string) || ''}
            onChange={(e) => onChange('address', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Pin your exact location on the map *</Label>
        <p className="text-[11.5px] text-muted-foreground mt-1 mb-2">
          The bot uses this pin (not the typed address) to measure delivery distance,
          show the right outlet to nearby customers, and drop a maps link in chat.
        </p>
        <BusinessLocationPicker
          lat={typeof data.latitude === 'number' ? (data.latitude as number) : null}
          lng={typeof data.longitude === 'number' ? (data.longitude as number) : null}
          onChange={(lat, lng) => {
            onChange('latitude', lat);
            onChange('longitude', lng);
          }}
        />
      </div>

      <div>
        <Label>Working Hours *</Label>
        <WorkingHoursPicker
          value={(data.workingHours as string) || ''}
          onChange={(v) => onChange('workingHours', v)}
        />
      </div>

      <div>
        <Label htmlFor="welcomeMessage">Custom Welcome Message (optional)</Label>
        <Textarea
          id="welcomeMessage"
          placeholder="Leave blank for AI-generated welcome. e.g., Namaste! Dr. Sharma Clinic mein aapka swagat hai. Main aapki kaise madad kar sakta hoon?"
          value={(data.welcomeMessage as string) || ''}
          onChange={(e) => onChange('welcomeMessage', e.target.value)}
          rows={2}
        />
      </div>

      <div>
        <Label htmlFor="additionalInfo">Additional Information (optional)</Label>
        <Textarea
          id="additionalInfo"
          placeholder="Anything else the bot should know about your business..."
          value={(data.additionalInfo as string) || ''}
          onChange={(e) => onChange('additionalInfo', e.target.value)}
          rows={3}
        />
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2 pt-4">
        Payment{' '}
        <span className="text-xs font-normal uppercase tracking-wide bg-amber-100 text-amber-900 px-2 py-0.5 rounded ml-2">
          COD-only mode active
        </span>
      </h3>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 space-y-2">
        <p className="text-xs text-amber-900">
          ⚠️ <b>Cash payments only right now.</b> Your bot will refuse to share UPI links / Razorpay / payment-gateway URLs with customers regardless of what you enter below.
          Online payments (UPI / Razorpay / Cashfree / EMI partners) will roll out in a future release &mdash; the fields below are kept so you can fill them now and have them auto-activate the day the integration goes live.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
        <div>
          <Label htmlFor="upiId">
            Restaurant UPI ID <span className="text-[10px] uppercase tracking-wide text-muted-foreground ml-1">Coming soon</span>
          </Label>
          <Input
            id="upiId"
            placeholder="e.g., rohitsbiryani@ybl or 98xxx@upi"
            value={(data.upiId as string) || ''}
            onChange={(e) => onChange('upiId', e.target.value.trim())}
            disabled
          />
          <p className="text-xs text-muted-foreground mt-1">
            Stored for future use. The bot will NOT share this with customers right now (cash on delivery only).
          </p>
        </div>
        <div>
          <Label htmlFor="upiName">
            Payee Name <span className="text-[10px] uppercase tracking-wide text-muted-foreground ml-1">Coming soon</span>
          </Label>
          <Input
            id="upiName"
            placeholder="e.g., Rohit's Biryani"
            value={(data.upiName as string) || ''}
            onChange={(e) => onChange('upiName', e.target.value)}
            disabled
          />
          <p className="text-xs text-muted-foreground mt-1">
            Restaurant&apos;s registered UPI name. Will appear in the customer&apos;s UPI app once online payments go live.
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2 pt-4">
        Daily order export{' '}
        <span className="text-sm font-normal text-muted-foreground">— nightly email with today&apos;s orders/bookings</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="existingSystem">Existing POS / order system (optional)</Label>
          <Input
            id="existingSystem"
            placeholder="e.g., Petpooja, POSist, UrbanPiper, Limetray, or 'Google Sheet'"
            value={(data.existingSystem as string) || ''}
            onChange={(e) => onChange('existingSystem', e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Just the name — we&apos;ll mention it in the nightly orders email so you know where to import.
          </p>
        </div>
        <div>
          <Label>Export format</Label>
          <div className="flex gap-2 mt-1">
            {(['csv', 'json'] as const).map((fmt) => {
              const active = ((data.exportFormat as string) || 'csv') === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => onChange('exportFormat', fmt)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-colors ${
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary text-secondary-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {fmt.toUpperCase()}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            CSV works everywhere (default). JSON for Zapier / webhooks / custom scripts.
          </p>
        </div>
      </div>
    </div>
  );
}
