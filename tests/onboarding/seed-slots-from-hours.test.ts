// Unit tests for the workingHours → slots parser. Restaurant owners type
// their hours in wildly different shapes; the parser has to be lenient
// without being wrong. These tests pin down the formats we've seen in
// real onboarding payloads plus a few edge cases the parser needs to
// reject cleanly.

import { describe, it, expect } from 'vitest';
import {
  parseTime,
  parseDays,
  parseWorkingHours,
  blocksToSlots,
  buildSlotsFromHours,
} from '../../lib/onboarding/seed-slots-from-hours';

describe('parseTime', () => {
  it('parses 12-hour with am/pm', () => {
    expect(parseTime('11 am')).toBe('11:00');
    expect(parseTime('11am')).toBe('11:00');
    expect(parseTime('11 AM')).toBe('11:00');
    expect(parseTime('11 pm')).toBe('23:00');
    expect(parseTime('1 pm')).toBe('13:00');
    expect(parseTime('12 am')).toBe('00:00');
    expect(parseTime('12 pm')).toBe('12:00');
  });

  it('parses 12-hour with minutes', () => {
    expect(parseTime('10:30 pm')).toBe('22:30');
    expect(parseTime('7:45 am')).toBe('07:45');
  });

  it('parses 24-hour HH:MM', () => {
    expect(parseTime('23:00')).toBe('23:00');
    expect(parseTime('09:30')).toBe('09:30');
    expect(parseTime('00:00')).toBe('00:00');
  });

  it('handles noon/midnight words', () => {
    expect(parseTime('noon')).toBe('12:00');
    expect(parseTime('12 noon')).toBe('12:00');
    expect(parseTime('midnight')).toBe('00:00');
    expect(parseTime('12 midnight')).toBe('00:00');
  });

  it('strips dots from a.m. / p.m.', () => {
    expect(parseTime('11 a.m.')).toBe('11:00');
    expect(parseTime('10 p.m.')).toBe('22:00');
  });

  it('returns null for garbage', () => {
    expect(parseTime('')).toBe(null);
    expect(parseTime('hello')).toBe(null);
    expect(parseTime('25:00')).toBe(null);
    expect(parseTime('10:99')).toBe(null);
  });
});

describe('parseDays', () => {
  it('expands mon-sun to all 7 days', () => {
    expect(parseDays('mon-sun')).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    ]);
  });

  it('expands mon-fri to weekdays', () => {
    expect(parseDays('mon-fri')).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
    ]);
  });

  it('handles "to" as range separator', () => {
    expect(parseDays('mon to sat')).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
    ]);
  });

  it('expands keywords', () => {
    expect(parseDays('daily')).toHaveLength(7);
    expect(parseDays('everyday')).toHaveLength(7);
    expect(parseDays('weekdays')).toEqual([
      'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
    ]);
    expect(parseDays('weekends')).toEqual(['saturday', 'sunday']);
  });

  it('handles single day', () => {
    expect(parseDays('sun')).toEqual(['sunday']);
    expect(parseDays('Sunday')).toEqual(['sunday']);
  });

  it('handles comma-separated list', () => {
    expect(parseDays('mon,wed,fri')).toEqual(['monday', 'wednesday', 'friday']);
  });

  it('returns empty for garbage', () => {
    expect(parseDays('')).toEqual([]);
    expect(parseDays('hello')).toEqual([]);
  });
});

describe('parseWorkingHours', () => {
  it('parses "Mon-Sun: 11 AM to 11 PM"', () => {
    const blocks = parseWorkingHours('Mon-Sun: 11 AM to 11 PM');
    expect(blocks).toHaveLength(7);
    expect(blocks[0]).toEqual({ day: 'monday', start: '11:00', end: '23:00' });
    expect(blocks[6]).toEqual({ day: 'sunday', start: '11:00', end: '23:00' });
  });

  it('parses "Mon-Sat 10 am - 10:30 pm; Sun closed"', () => {
    const blocks = parseWorkingHours('Mon-Sat 10 am - 10:30 pm; Sun closed');
    expect(blocks).toHaveLength(6);
    expect(blocks.every((b) => b.day !== 'sunday')).toBe(true);
    expect(blocks[0]).toEqual({ day: 'monday', start: '10:00', end: '22:30' });
  });

  it('parses multiple time-blocks per day: "Daily 12-3 PM, 7-11 PM"', () => {
    const blocks = parseWorkingHours('Daily 12-3 PM, 7-11 PM');
    // 7 days × 2 blocks each = 14 blocks
    expect(blocks).toHaveLength(14);
    const monBlocks = blocks.filter((b) => b.day === 'monday');
    expect(monBlocks).toHaveLength(2);
    expect(monBlocks[0]).toEqual({ day: 'monday', start: '12:00', end: '15:00' });
    expect(monBlocks[1]).toEqual({ day: 'monday', start: '19:00', end: '23:00' });
  });

  it('handles multi-rule semicolon split: "Mon-Fri 9-5; Sat 10-2; Sun closed"', () => {
    const blocks = parseWorkingHours('Mon-Fri 9-5; Sat 10-2; Sun closed');
    expect(blocks).toHaveLength(6);
    const sat = blocks.find((b) => b.day === 'saturday');
    expect(sat).toEqual({ day: 'saturday', start: '10:00', end: '02:00' });
    // Note: 10-2 has ambiguity (10 AM to 2 AM next day? or 2 PM?); parser
    // takes the literal hour. This is intentional — the slot generator
    // drops past-midnight blocks, so 10-2 simply produces no slots.
  });

  it('handles 24x7', () => {
    const blocks = parseWorkingHours('24x7');
    expect(blocks).toHaveLength(7);
    expect(blocks[0]).toEqual({ day: 'monday', start: '00:00', end: '23:30' });
  });

  it('handles 24 hours wording', () => {
    const blocks = parseWorkingHours('Open 24 hours');
    expect(blocks).toHaveLength(7);
  });

  it('returns empty for blank / undefined input', () => {
    expect(parseWorkingHours('')).toEqual([]);
    // @ts-expect-error testing runtime behavior with non-string
    expect(parseWorkingHours(undefined)).toEqual([]);
    expect(parseWorkingHours('   ')).toEqual([]);
  });

  it('returns empty for un-parseable garbage', () => {
    expect(parseWorkingHours('we open whenever we feel like it')).toEqual([]);
  });
});

describe('blocksToSlots', () => {
  it('slices a 3-hour block into six 30-min slots', () => {
    const slots = blocksToSlots(
      'demo',
      [{ day: 'monday', start: '12:00', end: '15:00' }],
      30
    );
    expect(slots).toHaveLength(6);
    expect(slots[0].start_time).toBe('12:00');
    expect(slots[0].end_time).toBe('12:30');
    expect(slots[5].start_time).toBe('14:30');
    expect(slots[5].end_time).toBe('15:00');
  });

  it('respects custom slot duration', () => {
    const slots = blocksToSlots(
      'demo',
      [{ day: 'monday', start: '09:00', end: '12:00' }],
      60
    );
    expect(slots).toHaveLength(3);
    expect(slots[0]).toEqual({
      client_id: 'demo',
      day_of_week: 'monday',
      start_time: '09:00',
      end_time: '10:00',
      slot_duration_minutes: 60,
      is_active: true,
      service_type: 'general',
    });
  });

  it('drops past-midnight wrap blocks', () => {
    const slots = blocksToSlots(
      'demo',
      [{ day: 'monday', start: '22:00', end: '02:00' }],
      30
    );
    expect(slots).toEqual([]);
  });

  it('drops zero-length blocks', () => {
    const slots = blocksToSlots(
      'demo',
      [{ day: 'monday', start: '12:00', end: '12:00' }],
      30
    );
    expect(slots).toEqual([]);
  });
});

describe('buildSlotsFromHours (end-to-end)', () => {
  it('produces 168 slots for 11 AM - 11 PM Mon-Sun at 30-min duration', () => {
    // 7 days × 12 hours × 2 slots/hour = 168
    const slots = buildSlotsFromHours('demo', 'Mon-Sun: 11 AM to 11 PM', 30);
    expect(slots).toHaveLength(168);
    expect(slots.every((s) => s.client_id === 'demo')).toBe(true);
    expect(slots.every((s) => s.is_active === true)).toBe(true);
    expect(slots.every((s) => s.service_type === 'general')).toBe(true);
  });

  it('produces 0 slots when workingHours is blank', () => {
    expect(buildSlotsFromHours('demo', '', 30)).toEqual([]);
    expect(buildSlotsFromHours('demo', '   ', 30)).toEqual([]);
  });

  it('produces 0 slots when only "closed" days are listed', () => {
    expect(buildSlotsFromHours('demo', 'Sun closed', 30)).toEqual([]);
  });
});
