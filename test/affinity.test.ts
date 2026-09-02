import { describe, expect, it } from 'vitest';
import {
  AFFINITY_MULTIPLIER,
  affinityOf,
  breaksVeil,
  resolveAffinity,
} from '../src/game/affinity';
import { AFFINITIES, ELEMENTS, type AffinityTable } from '../src/game/types';

const table: AffinityTable = {
  ember: 'weak',
  frost: 'resist',
  arc: 'null',
  gale: 'repel',
  radiance: 'drain',
};

describe('affinityOf', () => {
  it('reads a declared affinity', () => {
    expect(affinityOf(table, 'ember')).toBe('weak');
    expect(affinityOf(table, 'arc')).toBe('null');
  });

  it('treats an undeclared element as neutral', () => {
    expect(affinityOf(table, 'blight')).toBe('neutral');
    expect(affinityOf({}, 'force')).toBe('neutral');
  });
});

describe('resolveAffinity', () => {
  it('downs the target on a weakness and multiplies damage', () => {
    const outcome = resolveAffinity(table, 'ember');
    expect(outcome.affinity).toBe('weak');
    expect(outcome.multiplier).toBe(1.75);
    expect(outcome.downs).toBe(true);
    expect(outcome.reflected).toBe(false);
    expect(outcome.absorbed).toBe(false);
  });

  it('halves damage on a resist and does not down', () => {
    const outcome = resolveAffinity(table, 'frost');
    expect(outcome.multiplier).toBe(0.5);
    expect(outcome.downs).toBe(false);
  });

  it('zeroes damage on a null without downing', () => {
    const outcome = resolveAffinity(table, 'arc');
    expect(outcome.multiplier).toBe(0);
    expect(outcome.downs).toBe(false);
  });

  it('flags a repel back at the attacker', () => {
    const outcome = resolveAffinity(table, 'gale');
    expect(outcome.reflected).toBe(true);
    expect(outcome.downs).toBe(false);
  });

  it('flags a drain as healing the target', () => {
    const outcome = resolveAffinity(table, 'radiance');
    expect(outcome.absorbed).toBe(true);
    expect(outcome.downs).toBe(false);
  });

  it('never downs on a neutral hit', () => {
    expect(resolveAffinity(table, 'blight').downs).toBe(false);
  });

  describe('a Warden behind its Veil', () => {
    it('downgrades a weakness to neutral', () => {
      const outcome = resolveAffinity(table, 'ember', true);
      expect(outcome.affinity).toBe('neutral');
      expect(outcome.multiplier).toBe(1);
      expect(outcome.downs).toBe(false);
    });

    it('leaves every other affinity untouched', () => {
      for (const element of ELEMENTS) {
        if (element === 'ember') continue;
        expect(resolveAffinity(table, element, true)).toEqual(resolveAffinity(table, element));
      }
    });
  });
});

describe('breaksVeil', () => {
  it('counts hits that actually connect', () => {
    expect(breaksVeil(resolveAffinity(table, 'blight'))).toBe(true);
    expect(breaksVeil(resolveAffinity({}, 'ember'))).toBe(true);
  });

  it('discounts resisted, nulled, repelled and drained hits', () => {
    expect(breaksVeil(resolveAffinity(table, 'frost'))).toBe(false);
    expect(breaksVeil(resolveAffinity(table, 'arc'))).toBe(false);
    expect(breaksVeil(resolveAffinity(table, 'gale'))).toBe(false);
    expect(breaksVeil(resolveAffinity(table, 'radiance'))).toBe(false);
  });
});

describe('the affinity table itself', () => {
  it('assigns a multiplier to every affinity', () => {
    for (const affinity of AFFINITIES) {
      expect(AFFINITY_MULTIPLIER[affinity]).toBeTypeOf('number');
    }
  });

  it('only ever amplifies damage on a weakness', () => {
    for (const affinity of AFFINITIES) {
      if (affinity === 'weak') continue;
      expect(AFFINITY_MULTIPLIER[affinity]).toBeLessThanOrEqual(1);
    }
  });
});
