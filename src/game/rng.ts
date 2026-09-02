/**
 * Seeded pseudo-random numbers.
 *
 * A run spans many HTTP requests with no process in between, so the generator
 * has to be resumable: `state()` is persisted alongside the encounter and fed
 * back in on the next button press. That also makes any run reproducible from
 * its seed, which matters the first time somebody insists the bot cheated
 * them.
 *
 * mulberry32 - 32 bits of state, one multiply-shift round. Not
 * cryptographic, and must never be used for anything that needs to be.
 */

export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** True with the given probability, clamped to [0, 1]. */
  chance(probability: number): boolean;
  /** A uniformly chosen element. Throws on an empty list. */
  pick<T>(items: readonly T[]): T;
  /** One element chosen by weight. Throws if the weights sum to zero. */
  weighted<T>(items: readonly T[], weightOf: (item: T) => number): T;
  /** A fresh array shuffled out of `items`. */
  shuffle<T>(items: readonly T[]): T[];
  /** The current cursor, for persistence. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let a = seed | 0;

  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (max < min) [min, max] = [max, min];
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    int,

    chance: (probability) => next() < Math.min(1, Math.max(0, probability)),

    pick<T>(items: readonly T[]): T {
      const chosen = items[int(0, items.length - 1)];
      if (chosen === undefined) throw new Error('pick() called with no items');
      return chosen;
    },

    weighted<T>(items: readonly T[], weightOf: (item: T) => number): T {
      let total = 0;
      for (const item of items) total += Math.max(0, weightOf(item));
      if (total <= 0) throw new Error('weighted() called with no positive weight');

      let roll = next() * total;
      for (const item of items) {
        roll -= Math.max(0, weightOf(item));
        if (roll < 0) return item;
      }
      // Only reachable through floating-point drift on the final item.
      return items[items.length - 1] as T;
    },

    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j] as T, out[i] as T];
      }
      return out;
    },

    state: () => a,
  };
}

/** Derive a 32-bit seed from a run id or any other string. */
export function seedFrom(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}
