/**
 * Rendering is not usually worth testing, but these three carry meaning the
 * player acts on: a bar that lies about whether something is alive, an enemy
 * summary that leaks an untested weakness, or an exposure line that reads as
 * the enemy's rather than yours are all bugs a screenshot would not reveal.
 */

import { describe, expect, it } from 'vitest';
import { bar, cardLabel, knownAffinities, ownAffinities } from '../src/render/embeds';
import { dealDraw } from '../src/game/draw';
import { createRng } from '../src/game/rng';
import { ELEMENTS, type AffinityTable } from '../src/game/types';

const FULL = (1 << ELEMENTS.length) - 1;
const bit = (element: (typeof ELEMENTS)[number]) => 1 << ELEMENTS.indexOf(element);

describe('bar', () => {
  it('fills completely at full health and empties at zero', () => {
    expect(bar(10, 10)).toBe('▰'.repeat(10));
    expect(bar(0, 10)).toBe('▱'.repeat(10));
  });

  it('is always ten segments wide', () => {
    for (let hp = 0; hp <= 45; hp++) expect([...bar(hp, 45)].length).toBe(10);
  });

  // An empty bar beside "1/45" reads as dead, and the difference between
  // barely alive and dead is the whole decision to retreat.
  it('keeps a sliver for anything still standing', () => {
    expect(bar(1, 999)).toContain('▰');
    expect(bar(1, 999).startsWith('▰')).toBe(true);
  });

  it('distinguishes filled from empty by shape, not shade', () => {
    expect(bar(5, 10)).toBe('▰▰▰▰▰▱▱▱▱▱');
  });

  it('tolerates nonsense input without throwing', () => {
    expect(() => bar(-5, 0)).not.toThrow();
    expect([...bar(-5, 0)].length).toBe(10);
    expect([...bar(999, 10)].length).toBe(10);
  });
});

describe('knownAffinities', () => {
  const table: AffinityTable = { ember: 'weak', frost: 'resist', arc: 'drain' };

  it('says nothing is known before anything has been tried', () => {
    expect(knownAffinities(table, 0)).toMatch(/nothing known/i);
  });

  // The whole discovery mechanic rests on this: the panel must never show an
  // affinity the player has not earned.
  it('never reveals an untried affinity', () => {
    const onlyFrost = knownAffinities(table, bit('frost'));
    expect(onlyFrost).toContain('resist');
    expect(onlyFrost).not.toContain('weak');
    expect(onlyFrost).not.toContain('drain');
  });

  it('reveals an affinity once its element has been tried', () => {
    expect(knownAffinities(table, bit('ember'))).toContain('weak');
  });

  it('lists what is still untried', () => {
    expect(knownAffinities(table, bit('ember'))).toMatch(/untried/);
    expect(knownAffinities(table, FULL)).not.toMatch(/untried/);
  });

  it('says so plainly when everything is tested and nothing is weak', () => {
    expect(knownAffinities({ frost: 'resist' }, FULL)).toContain('resist');
    expect(knownAffinities({}, FULL)).toMatch(/no weakness found/i);
  });

  it('omits neutral elements once tested, rather than listing dashes', () => {
    const all = knownAffinities(table, FULL);
    expect(all).not.toContain('-');
    expect(all).toContain('weak');
  });
});

describe('ownAffinities', () => {
  // The original panel showed a bare affinity row that every reader took for
  // the enemy's weaknesses. It has to be unambiguous whose it is.
  it('addresses the player directly', () => {
    expect(ownAffinities({ blight: 'weak' })).toMatch(/you/i);
  });

  it('names what can hurt you', () => {
    expect(ownAffinities({ blight: 'weak' })).toMatch(/hurt you/i);
  });

  it('names what cannot', () => {
    expect(ownAffinities({ radiance: 'resist' })).toMatch(/shrug off/i);
  });

  it('reports both when both apply', () => {
    const line = ownAffinities({ blight: 'weak', radiance: 'resist' });
    expect(line).toMatch(/hurt you/i);
    expect(line).toMatch(/shrug off/i);
  });

  it('says something useful when nothing stands out', () => {
    expect(ownAffinities({}).length).toBeGreaterThan(0);
  });
});

describe('The Draw, face up', () => {
  // Three identical face-down buttons is a coin flip wearing a hat. The whole
  // point of showing the faces is that there is something to reason about.
  it('names every card it is offering', () => {
    expect(cardLabel({ kind: 'gold', amount: 60 })).toContain('60');
    expect(cardLabel({ kind: 'xp', amount: 120 })).toContain('120');
    expect(cardLabel({ kind: 'focus', amount: 25 })).toContain('25');
    expect(cardLabel({ kind: 'echo', speciesId: 'lumen', name: 'Lumen' })).toBe('Lumen');
  });

  it('fits every card on a Discord button', () => {
    const rng = createRng(9);
    for (let i = 0; i < 200; i++) {
      for (const card of dealDraw(rng.int(0, 9), rng)) {
        expect(cardLabel(card).length).toBeGreaterThan(0);
        expect(cardLabel(card).length).toBeLessThanOrEqual(80);
      }
    }
  });
});
