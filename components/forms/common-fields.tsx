'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CommonFieldsProps {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}

const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Hinglish', 'Punjabi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati'];

// Strip +91 / 91 / leading 0 / spaces so only the 10-digit number shows in input
function phoneWithoutPrefix(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length > 10) return digits.slice(2, 12);
  if (digits.startsWith('0') && digits.length === 11) return digits.slice(1);
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
  const languages = (data.languages as string[]) || ['Hindi', 'English', 'Hinglish'];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Basic Information</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="businessName">Business Name *</Label>
          <Input
            id="businessName"
            placeholder="e.g., Dr. Sharma Clinic"
            value={(data.businessName as string) || ''}
            onChange={(e) => onChange('businessName', e.target.value)}
          />
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
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ <strong>Use a fresh number.</strong> This will be registered on WhatsApp Business API and <strong>cannot be used for regular WhatsApp messaging</strong> on your phone.
              </p>
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
          <Label htmlFor="address">Full Address</Label>
          <Input
            id="address"
            placeholder="e.g., A-12, Green Park Main, New Delhi 110016"
            value={(data.address as string) || ''}
            onChange={(e) => onChange('address', e.target.value)}
          />
        </div>
      </div>

      <div>
        <Label>Working Hours *</Label>
        <WorkingHoursPicker
          value={(data.workingHours as string) || ''}
          onChange={(v) => onChange('workingHours', v)}
        />
      </div>

      <div>
        <Label>Languages (select all that apply)</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => {
                const current = [...languages];
                if (current.includes(lang)) {
                  onChange('languages', current.filter((l) => l !== lang));
                } else {
                  onChange('languages', [...current, lang]);
                }
              }}
              className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                languages.includes(lang)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-secondary-foreground border-border hover:border-primary/50'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
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
        Payment (UPI){' '}
        <span className="text-sm font-normal text-muted-foreground">— optional, enables in-chat payments</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="upiId">UPI ID</Label>
          <Input
            id="upiId"
            placeholder="e.g., rohit@ybl or 98xxx@upi"
            value={(data.upiId as string) || ''}
            onChange={(e) => onChange('upiId', e.target.value.trim())}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Format: name@bank. Bot uses this to build payment links for customers.
          </p>
        </div>
        <div>
          <Label htmlFor="upiName">Payee Name</Label>
          <Input
            id="upiName"
            placeholder="e.g., Rohit's Biryani"
            value={(data.upiName as string) || ''}
            onChange={(e) => onChange('upiName', e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Shown to customer in their UPI app. Usually your business name.
          </p>
        </div>
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2 pt-4">
        Daily order export{' '}
        <span className="text-sm font-normal text-muted-foreground">— nightly email with today&apos;s orders/bookings</span>
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="existingSystem">Existing order/booking system (optional)</Label>
          <Input
            id="existingSystem"
            placeholder="e.g., Petpooja, Practo, Fresha, or 'Google Sheet'"
            value={(data.existingSystem as string) || ''}
            onChange={(e) => onChange('existingSystem', e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Just the name — we&apos;ll mention it in the email so you know where to paste/import.
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
