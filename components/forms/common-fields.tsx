'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CommonFieldsProps {
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}

const LANGUAGE_OPTIONS = ['Hindi', 'English', 'Hinglish', 'Punjabi', 'Tamil', 'Telugu', 'Bengali', 'Marathi', 'Gujarati'];

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
          <Label htmlFor="whatsappNumber">WhatsApp Business Number *</Label>
          <Input
            id="whatsappNumber"
            placeholder="+919876543210"
            value={(data.whatsappNumber as string) || ''}
            onChange={(e) => onChange('whatsappNumber', e.target.value)}
          />
          <p className="text-xs text-muted-foreground mt-1">Include country code (+91)</p>
        </div>
        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            placeholder="e.g., Delhi"
            value={(data.city as string) || ''}
            onChange={(e) => onChange('city', e.target.value)}
          />
        </div>
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

      <div>
        <Label htmlFor="workingHours">Working Hours *</Label>
        <Input
          id="workingHours"
          placeholder="e.g., Mon-Sat: 9 AM - 7 PM, Sunday: Closed"
          value={(data.workingHours as string) || ''}
          onChange={(e) => onChange('workingHours', e.target.value)}
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
    </div>
  );
}
