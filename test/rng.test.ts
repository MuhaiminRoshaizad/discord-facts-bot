import { describe, expect, it } from 'vitest';
import { createRng, seedFrom } from '../src/game/rng';

describe('createRng', () => {
  it('produces the same sequence from the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const left = Array.from({ length: 50 }, () => a.next());
    const right = Array.from({ length: 50 }, () => b.next());
    expect(left).toEqual(right);
  });

  it('produces different sequences from different seeds', () => {
    const a = Array.from({ length: 20 }, createRng(1).next);
    const b = Array.from({ length: 20 }, createRng(2).next);
    expect(a).not.toEqual(b);
  });

  // A run spans many requests, so the cursor has to survive being persisted
  // and reloaded between button presses.
  it('resumes an identical sequence from a persisted state', () => {
    const original = createRng(999);
    for (let i = 0; i < 7; i++) original.next();

    const resumed = createRng(original.state());
    const expected = Array.from({ length: 10 }, () => original.next());
    const actual = Array.from({ length: 10 }, () => resumed.next());
    expect(actual).toEqual(expected);
  });

  it('stays within [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  describe('int', () => {
    it('covers the range inclusively at both ends', () => {
      const rng = createRng(42);
      const seen = new Set<number>();
      for (let i = 0; i < 500; i++) seen.add(rng.int(1, 6));
      expect([...seen].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('handles a single-value range', () => {
      const rng = createRng(3);
      expect(rng.int(4, 4)).toBe(4);
    });

    it('tolerates a reversed range', () => {
      const rng = createRng(3);
      const value = rng.int(9, 2);
      expect(value).toBeGreaterThanOrEqual(2);
      expect(value).toBeLessThanOrEqual(9);
    });
  });

  describe('chance', () => {
    it('never fires at 0 and always fires at 1', () => {
      const rng = createRng(11);
      for (let i = 0; i < 100; i++) {
        expect(rng.chance(0)).toBe(false);
        expect(rng.chance(1)).toBe(true);
      }
    });

    it('clamps probabilities outside [0, 1]', () => {
      const rng = createRng(11);
      expect(rng.chance(-5)).toBe(false);
      expect(rng.chance(5)).toBe(true);
    });

    it('lands near the requested rate', () => {
      const rng = createRng(2024);
      let hits = 0;
      for (let i = 0; i < 10000; i++) if (rng.chance(0.3)) hits++;
      expect(hits / 10000).toBeGreaterThan(0.27);
      expect(hits / 10000).toBeLessThan(0.33);
    });
  });

  describe('pick', () => {
    it('only ever returns a member of the list', () => {
      const rng = createRng(5);
      const items = ['a', 'b', 'c'] as const;
      for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items));
    });

    it('throws on an empty list rather than returning undefined', () => {
      expect(() => createRng(5).pick([])).toThrow();
    });
  });

  describe('weighted', () => {
    it('respects the weights', () => {
      const rng = createRng(77);
      const items = [
        { id: 'common', weight: 90 },
        { id: 'rare', weight: 10 },
      ];
      let rare = 0;
      for (let i = 0; i < 5000; i++) {
        if (rng.weighted(items, (item) => item.weight).id === 'rare') rare++;
      }
      expect(rare / 5000).toBeGreaterThan(0.07);
      expect(rare / 5000).toBeLessThan(0.13);
    });

    it('never returns a zero-weight item', () => {
      const rng = createRng(8);
      const items = [
        { id: 'off', weight: 0 },
        { id: 'on', weight: 1 },
      ];
      for (let i = 0; i < 200; i++) {
        expect(rng.weighted(items, (item) => item.weight).id).toBe('on');
      }
    });

    it('throws when nothing has positive weight', () => {
      const rng = createRng(8);
      expect(() => rng.weighted([{ w: 0 }], (item) => item.w)).toThrow();
    });
  });

  describe('shuffle', () => {
    it('preserves every member and leaves the input alone', () => {
      const rng = createRng(31);
      const input = [1, 2, 3, 4, 5];
      const output = rng.shuffle(input);
      expect(output.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
      expect(input).toEqual([1, 2, 3, 4, 5]);
    });
  });
});

describe('seedFrom', () => {
  it('is stable for the same text', () => {
    expect(seedFrom('run-abc')).toBe(seedFrom('run-abc'));
  });

  it('separates similar texts', () => {
    expect(seedFrom('run-abc')).not.toBe(seedFrom('run-abd'));
  });

  it('returns a 32-bit integer', () => {
    const seed = seedFrom('anything at all');
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(-(2 ** 31));
    expect(seed).toBeLessThan(2 ** 31);
  });
});
