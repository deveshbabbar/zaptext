// Unit tests for the conversation-priority classifier (Work Item 7).
// Covers: tier precedence, English + Hinglish keywords, normalisation,
// boundary cases, falsy inputs.

import { describe, it, expect } from 'vitest';
import { classifyPriority } from '../lib/conversation-priority';

describe('classifyPriority — falsy inputs', () => {
  it('returns normal for empty / whitespace / nullish', () => {
    expect(classifyPriority('').level).toBe('normal');
    expect(classifyPriority('   ').level).toBe('normal');
    expect(classifyPriority(null).level).toBe('normal');
    expect(classifyPriority(undefined).level).toBe('normal');
  });
});

describe('classifyPriority — urgent tier', () => {
  it('flags food poisoning (English)', () => {
    const r = classifyPriority('I got food poisoning from the biryani last night');
    expect(r.level).toBe('urgent');
    expect(r.matched).toContain('food poisoning');
  });

  it('flags hospital / admitted', () => {
    expect(classifyPriority('My friend is admitted in the hospital after eating').level).toBe('urgent');
    expect(classifyPriority('Aspatal le jana pada').level).toBe('urgent');
  });

  it('flags Hinglish illness', () => {
    expect(classifyPriority('Mujhe khaakar bimaar feel ho raha hai').level).toBe('urgent');
    expect(classifyPriority('Ulti ho rahi hai').level).toBe('urgent');
    expect(classifyPriority('Pet kharab ho gaya order ke baad').level).toBe('urgent');
  });

  it('flags legal threats', () => {
    expect(classifyPriority('I will send a legal notice').level).toBe('urgent');
    expect(classifyPriority('I am going to consumer court').level).toBe('urgent');
    expect(classifyPriority('FSSAI ko complaint karunga').level).toBe('urgent');
    expect(classifyPriority('Police complaint daalna padega').level).toBe('urgent');
  });

  it('is case-insensitive and tolerates punctuation', () => {
    expect(classifyPriority('FOOD POISONING!!! refund now').level).toBe('urgent');
    expect(classifyPriority('Lawyer.').level).toBe('urgent');
  });

  it('beats attention when both present', () => {
    // "refund" is attention; "food poisoning" is urgent. Urgent wins.
    const r = classifyPriority('Give me a refund — I got food poisoning');
    expect(r.level).toBe('urgent');
  });
});

describe('classifyPriority — attention tier', () => {
  it('flags refund mentions', () => {
    expect(classifyPriority('I want a refund please').level).toBe('attention');
    expect(classifyPriority('Paisa wapas chahiye').level).toBe('attention');
    expect(classifyPriority('My money back').level).toBe('attention');
  });

  it('flags wrong / missing order (Hinglish)', () => {
    expect(classifyPriority('Aapne galat order bhej diya').level).toBe('attention');
    expect(classifyPriority('Kuch nahi aaya delivery mein').level).toBe('attention');
    expect(classifyPriority('Wrong order delivered').level).toBe('attention');
  });

  it('flags cold / spoiled food', () => {
    expect(classifyPriority('Khana thanda aaya').level).toBe('attention');
    expect(classifyPriority('The food is rotten').level).toBe('attention');
    expect(classifyPriority('Biryani baasi thi').level).toBe('attention');
  });

  it('flags aggregator review threats', () => {
    expect(classifyPriority('I will leave a 1 star review on Zomato').level).toBe('attention');
    expect(classifyPriority('Swiggy par bad review daalunga').level).toBe('attention');
  });

  it('flags "speak to manager" / shikayat', () => {
    expect(classifyPriority('Let me speak to the manager').level).toBe('attention');
    expect(classifyPriority('Mujhe owner se baat karni hai').level).toBe('attention');
    expect(classifyPriority('Yeh meri shikayat hai').level).toBe('attention');
  });

  it('flags emotional escalation words', () => {
    expect(classifyPriority('This is pathetic service').level).toBe('attention');
    expect(classifyPriority('Bahut ghatiya khana hai').level).toBe('attention');
  });
});

describe('classifyPriority — normal', () => {
  it('returns normal for routine orders / queries', () => {
    expect(classifyPriority('Hi, what time do you open?').level).toBe('normal');
    expect(classifyPriority('Ek butter chicken aur do naan bhejo').level).toBe('normal');
    expect(classifyPriority('Menu dikhana').level).toBe('normal');
    expect(classifyPriority('Table for 4 at 8pm').level).toBe('normal');
  });

  it('does not false-positive on partial-word matches', () => {
    // 'sue' is urgent but should NOT trigger inside 'tissues'
    expect(classifyPriority('Do you have tissues at the table?').level).toBe('normal');
    // 'fir' is urgent (legal) but should NOT match inside 'firstly'
    expect(classifyPriority('Firstly, what time do you close?').level).toBe('normal');
  });
});

describe('classifyPriority — matched keywords', () => {
  it('returns the matched keywords for debug visibility', () => {
    const r = classifyPriority('hospital aur lawyer dono ko bula raha hoon');
    expect(r.level).toBe('urgent');
    expect(r.matched.length).toBeGreaterThanOrEqual(2);
    expect(r.matched).toEqual(expect.arrayContaining(['hospital', 'lawyer']));
  });

  it('returns empty matched for normal', () => {
    expect(classifyPriority('Hi').matched).toEqual([]);
  });
});
