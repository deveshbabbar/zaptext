// tests/grocery/slots.test.ts
import { describe, it, expect } from 'vitest';
import { availableSlotsFor, type AvailableSlot } from '../../lib/grocery/slots';
import type { GrocerySlot } from '../../lib/grocery/types';

const s = (over: Partial<GrocerySlot>): GrocerySlot => ({
  id: 's1',
  client_id: 'c',
  label: 'Tomorrow 7-9am',
  start_time: '07:00',
  end_time: '09:00',
  cutoff_time: '21:00',
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  is_active: true,
  ...over,
});

// Fixed reference date: 2026-05-08 14:00 IST = Friday afternoon.
const refDow = 5; // Friday
const refDate = '2026-05-08';
const refTimeBefore = '14:00';
const refTimeAfter = '22:00';

describe('availableSlotsFor', () => {
  it('returns next-day slot when current time is before cutoff', () => {
    const slots = [s({ cutoff_time: '21:00' })];
    const out = availableSlotsFor(slots, refDate, refDow, refTimeBefore);
    expect(out).toHaveLength(1);
    expect(out[0].slot_date).toBe('2026-05-09'); // Saturday
  });

  it('skips next-day slot if cutoff has passed', () => {
    const slots = [s({ cutoff_time: '21:00' })];
    const out = availableSlotsFor(slots, refDate, refDow, refTimeAfter);
    // Cutoff passed for Saturday, so we look at the slot after that — Sunday.
    expect(out[0].slot_date).toBe('2026-05-10');
  });

  it('respects days_of_week — slot only on Mondays', () => {
    const slots = [s({ days_of_week: [1] })]; // Mondays only
    const out = availableSlotsFor(slots, refDate, refDow, refTimeBefore);
    expect(out[0].slot_date).toBe('2026-05-11'); // Monday
  });

  it('returns empty when slot is inactive', () => {
    const slots = [s({ is_active: false })];
    const out = availableSlotsFor(slots, refDate, refDow, refTimeBefore);
    expect(out).toEqual([]);
  });

  it('caps at 3 slots regardless of input', () => {
    const slots = [
      s({ id: 'a', start_time: '07:00', end_time: '09:00', label: 'A' }),
      s({ id: 'b', start_time: '17:00', end_time: '19:00', label: 'B' }),
      s({ id: 'c', start_time: '20:00', end_time: '22:00', label: 'C' }),
      s({ id: 'd', start_time: '06:00', end_time: '07:00', label: 'D' }),
    ];
    const out = availableSlotsFor(slots, refDate, refDow, refTimeBefore);
    expect(out.length).toBeLessThanOrEqual(3);
  });
});
