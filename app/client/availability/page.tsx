'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

interface TimeBlock {
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  blocks: TimeBlock[];
}

export default function AvailabilityPage() {
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>({});
  const [slotDuration, setSlotDuration] = useState(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/client/schedule')
      .then((res) => res.json())
      .then((data) => {
        if (data.schedule) {
          setSchedule(data.schedule);
          setSlotDuration(data.slotDuration || 30);
        } else {
          // Default schedule
          const def: Record<string, DaySchedule> = {};
          DAYS.forEach((d) => {
            def[d] = d === 'sunday'
              ? { enabled: false, blocks: [] }
              : { enabled: true, blocks: [{ start: '10:00', end: '13:00' }, { start: '14:00', end: '17:00' }] };
          });
          setSchedule(def);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const updateDay = (day: string, updates: Partial<DaySchedule>) => {
    setSchedule((prev) => ({ ...prev, [day]: { ...prev[day], ...updates } }));
  };

  const addBlock = (day: string) => {
    const blocks = [...(schedule[day]?.blocks || []), { start: '09:00', end: '12:00' }];
    updateDay(day, { blocks });
  };

  const removeBlock = (day: string, index: number) => {
    const blocks = schedule[day].blocks.filter((_, i) => i !== index);
    updateDay(day, { blocks });
  };

  const updateBlock = (day: string, index: number, field: 'start' | 'end', value: string) => {
    const blocks = [...schedule[day].blocks];
    blocks[index] = { ...blocks[index], [field]: value };
    updateDay(day, { blocks });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/client/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule, slotDuration }),
      });
      if (res.ok) toast.success('Schedule saved!');
      else toast.error('Failed to save');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8"><div className="animate-pulse h-64 bg-muted rounded-lg"></div></div>;

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Weekly Availability</h1>
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Schedule'}</Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <Label>Slot Duration (minutes):</Label>
            <Input type="number" value={slotDuration} onChange={(e) => setSlotDuration(Number(e.target.value))} className="w-24" min={15} max={120} step={15} />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {DAYS.map((day) => {
          const daySchedule = schedule[day] || { enabled: false, blocks: [] };
          return (
            <Card key={day}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base capitalize">{day}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{daySchedule.enabled ? 'Open' : 'Closed'}</span>
                    <Switch checked={daySchedule.enabled} onCheckedChange={(v) => updateDay(day, { enabled: v })} />
                  </div>
                </div>
              </CardHeader>
              {daySchedule.enabled && (
                <CardContent className="space-y-2">
                  {daySchedule.blocks.map((block, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Input type="time" value={block.start} onChange={(e) => updateBlock(day, i, 'start', e.target.value)} className="w-32" />
                      <span className="text-muted-foreground">to</span>
                      <Input type="time" value={block.end} onChange={(e) => updateBlock(day, i, 'end', e.target.value)} className="w-32" />
                      <Button variant="outline" size="sm" onClick={() => removeBlock(day, i)}>Remove</Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addBlock(day)} className="border-dashed w-full">
                    + Add Time Block
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
