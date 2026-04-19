'use client';

import { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommonFieldsForm } from '@/components/forms/common-fields';
import { TypeFieldsForm } from '@/components/forms/type-fields';
import { BUSINESS_TYPES } from '@/lib/constants';
import { BusinessType } from '@/lib/types';
import { toast } from 'sonner';

export default function OnboardTypePage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = use(params);
  const router = useRouter();
  const [formData, setFormData] = useState<Record<string, unknown>>({
    type,
    languages: ['English'],
  });
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testing, setTesting] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [scraping, setScraping] = useState(false);

  const meta = BUSINESS_TYPES.find((bt) => bt.type === type);
  if (!meta) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-2">Invalid business type</h1>
        <a href="/admin/onboard" className="text-primary hover:underline">Go back</a>
      </div>
    );
  }

  const onChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessName || !formData.ownerName || !formData.whatsappNumber) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: formData, phoneNumberId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Bot created successfully!');
        router.push(`/admin/clients/${data.clientId}`);
      } else {
        toast.error(data.message || data.error || 'Failed to create bot');
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAutoFill = async () => {
    if (!websiteUrl.trim()) {
      toast.error('Please enter a website URL');
      return;
    }
    setScraping(true);
    toast.info('AI is reading the website and extracting data...');
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: websiteUrl, businessType: type }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        // Merge extracted data into form (keep existing values if already filled)
        const extracted = data.data;
        setFormData((prev) => {
          const merged = { ...prev };
          for (const [key, value] of Object.entries(extracted)) {
            // Only fill if the field is empty or not set
            if (value && (!(key in prev) || prev[key] === '' || prev[key] === undefined || (Array.isArray(prev[key]) && (prev[key] as unknown[]).length === 0))) {
              merged[key] = value;
            }
          }
          merged.type = type; // Ensure type stays correct
          return merged;
        });
        toast.success('Data extracted successfully! Review and edit the form below.');
      } else {
        toast.error(data.error || 'Could not extract data. Please fill manually.');
      }
    } catch {
      toast.error('Failed to fetch website. Please fill manually.');
    } finally {
      setScraping(false);
    }
  };

  const handleTestBot = async () => {
    if (!testMessage.trim()) return;
    setTesting(true);
    setTestResponse('');
    try {
      // We create a temporary prompt to test
      const { generateSystemPrompt } = await import('@/lib/prompt-generator');
      const prompt = generateSystemPrompt(formData as never);
      const res = await fetch('/api/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          systemPrompt: prompt,
          message: testMessage,
        }),
      });
      const data = await res.json();
      setTestResponse(data.response || 'No response generated');
    } catch {
      setTestResponse('Error: Could not generate test response');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <a href="/admin/onboard" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          &larr; Back to business types
        </a>
        <div className="flex items-center gap-3">
          <span className={`text-4xl w-14 h-14 rounded-xl ${meta.bgColor} flex items-center justify-center`}>
            {meta.icon}
          </span>
          <div>
            <h1 className="text-2xl font-bold">{meta.label}</h1>
            <p className="text-muted-foreground">{meta.description}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Auto-Fill from Website */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              ✨ Auto-Fill from Website
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste the business website or social media link — AI will extract all details automatically
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com or Instagram/Facebook page URL"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <Button
                type="button"
                onClick={handleAutoFill}
                disabled={scraping}
                className="min-w-[140px]"
              >
                {scraping ? 'Extracting...' : '🔍 Auto-Fill'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Works with business websites, Zomato, Swiggy, Justdial, Google Maps, Instagram, etc.
              You can always edit the auto-filled data below.
            </p>
          </CardContent>
        </Card>

        <div className="relative">
          <div className="absolute inset-x-0 top-0 flex justify-center -mt-3">
            <span className="bg-background px-4 text-sm text-muted-foreground">or fill manually</span>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <CommonFieldsForm data={formData} onChange={onChange} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <TypeFieldsForm type={type as BusinessType} data={formData} onChange={onChange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">WhatsApp Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="phoneNumberId">Phone Number ID (from Meta Business)</Label>
              <Input
                id="phoneNumberId"
                placeholder="e.g., 123456789012345"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Find this in Meta Business Suite &gt; WhatsApp &gt; API Setup. You can add it later.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Your Bot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Send a test message to see how your bot would respond
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Type a test message... e.g., 'Appointment kaise book karein?'"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={handleTestBot} disabled={testing}>
                {testing ? 'Thinking...' : 'Test'}
              </Button>
            </div>
            {testResponse && (
              <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-wrap">
                <p className="text-xs text-muted-foreground mb-2">Bot Response:</p>
                {testResponse}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button
            type="submit"
            disabled={submitting}
            className="flex-1 h-12 text-lg font-semibold"
          >
            {submitting ? 'Creating Bot...' : 'Create Bot'}
          </Button>
        </div>
      </form>
    </div>
  );
}
