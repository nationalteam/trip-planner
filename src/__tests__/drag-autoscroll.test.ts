import { calculateAutoScrollDelta } from '@/lib/drag-autoscroll';

describe('calculateAutoScrollDelta', () => {
  it('returns positive delta near bottom edge', () => {
    const delta = calculateAutoScrollDelta(790, 800);
    expect(delta).toBeGreaterThan(0);
  });

  it('returns negative delta near top edge', () => {
    const delta = calculateAutoScrollDelta(5, 800);
    expect(delta).toBeLessThan(0);
  });

  it('returns zero in middle area', () => {
    const delta = calculateAutoScrollDelta(400, 800);
    expect(delta).toBe(0);
  });

  it('returns zero for invalid input', () => {
    expect(calculateAutoScrollDelta(Number.NaN, 800)).toBe(0);
    expect(calculateAutoScrollDelta(100, Number.NaN)).toBe(0);
    expect(calculateAutoScrollDelta(100, 0)).toBe(0);
  });
});
