/**
 * Content integrity.
 *
 * The catalogues are hand-authored data, which is exactly where a typo hides
 * until a player trips over it in a Rift. These tests are the cheap way to
 * find a dangling skill id before Discord does.
 */

import { describe, expect, it } from 'vitest';
import {
  ALL_ECHO_SPECIES,
  echoSpecies,
  skillsAtLevel,
  STARTER_ECHO_IDS,
} from '../src/game/content/echoes';
import { ALL_HUSK_SPECIES, BIND_YIELD, husksOfRank } from '../src/game/content/husks';
import { ALL_SKILLS, SKILLS, STRIKE } from '../src/game/content/skills';
import { ALL_ALLIES } from '../src/game/content/allies';
import { SUIT_BLURB, SUIT_LABEL, weaveSuit } from '../src/game/content/suits';
import { ELEMENTS, HUSK_RANKS, SUITS, MAX_STAGES } from '../src/game/types';

describe('skills', () => {
  it('has unique ids', () => {
    const ids = ALL_SKILLS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses declared elements', () => {
    for (const s of ALL_SKILLS) expect(ELEMENTS).toContain(s.element);
  });

  it('gives every skill a name and a description', () => {
    for (const s of ALL_SKILLS) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it('keeps Strike free, since it is the fallback when Focus runs out', () => {
    expect(STRIKE.cost).toBe(0);
    expect(STRIKE.kind).toBe('damage');
  });

  it('charges Focus for everything except Strike', () => {
    for (const s of ALL_SKILLS) {
      if (s.id === 'strike') continue;
      expect(s.cost).toBeGreaterThan(0);
    }
  });

  it('gives damage and heal skills positive power', () => {
    for (const s of ALL_SKILLS) {
      if (s.kind === 'damage' || s.kind === 'heal') expect(s.power).toBeGreaterThan(0);
    }
  });

  it('keeps modifier stages within the clamp and pointing the right way', () => {
    for (const s of ALL_SKILLS) {
      if (s.kind !== 'buff' && s.kind !== 'debuff') continue;
      expect(Math.abs(s.stages)).toBeLessThanOrEqual(MAX_STAGES);
      expect(s.stages).not.toBe(0);
      if (s.kind === 'buff') expect(s.stages).toBeGreaterThan(0);
      if (s.kind === 'debuff') expect(s.stages).toBeLessThan(0);
    }
  });

  // An area attack that also hit harder than the single-target option would
  // make the single-target one dead weight.
  it('prices area damage below its single-target tier', () => {
    for (const s of ALL_SKILLS) {
      if (s.kind !== 'damage' || !s.aoe) continue;
      expect(s.cost).toBeGreaterThan(0);
      expect(s.power).toBeLessThan(52);
    }
  });
});

describe('echoes', () => {
  it('has unique ids', () => {
    const ids = ALL_ECHO_SPECIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references skills that exist', () => {
    for (const species of ALL_ECHO_SPECIES) {
      for (const entry of species.learnset) {
        expect(SKILLS.has(entry.skillId), `${species.id} -> ${entry.skillId}`).toBe(true);
      }
    }
  });

  it('only uses declared suits and elements', () => {
    for (const species of ALL_ECHO_SPECIES) {
      expect(SUITS).toContain(species.suit);
      for (const element of Object.keys(species.affinities)) {
        expect(ELEMENTS).toContain(element);
      }
    }
  });

  it('rates rarity from 1 to 5', () => {
    for (const species of ALL_ECHO_SPECIES) {
      expect(species.rarity).toBeGreaterThanOrEqual(1);
      expect(species.rarity).toBeLessThanOrEqual(5);
    }
  });

  it('gives every Echo something to do at level one', () => {
    for (const species of ALL_ECHO_SPECIES) {
      expect(skillsAtLevel(species, 1).length).toBeGreaterThan(0);
    }
  });

  it('lists learnsets in ascending level order', () => {
    for (const species of ALL_ECHO_SPECIES) {
      const levels = species.learnset.map((entry) => entry.level);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
    }
  });

  // Every Echo is a trade. One with no weakness would simply be the answer to
  // everything, and the swap decision would evaporate.
  it('gives every Echo at least one weakness', () => {
    for (const species of ALL_ECHO_SPECIES) {
      const weaknesses = Object.values(species.affinities).filter((a) => a === 'weak');
      expect(weaknesses.length, `${species.id} has no weakness`).toBeGreaterThan(0);
    }
  });

  it('gives every Echo lore for the codex', () => {
    for (const species of ALL_ECHO_SPECIES) {
      expect(species.lore.length).toBeGreaterThan(0);
    }
  });

  it('covers every suit', () => {
    const covered = new Set(ALL_ECHO_SPECIES.map((e) => e.suit));
    for (const suit of SUITS) expect(covered, `no Echo of suit ${suit}`).toContain(suit);
  });

  describe('starters', () => {
    it('all exist and are the plainest of them', () => {
      for (const id of STARTER_ECHO_IDS) {
        expect(echoSpecies(id).rarity).toBe(1);
      }
    });

    it('offers more than one, so awakening is not identical for everyone', () => {
      expect(STARTER_ECHO_IDS.length).toBeGreaterThan(1);
    });
  });
});

describe('husks', () => {
  it('has unique ids', () => {
    const ids = ALL_HUSK_SPECIES.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references skills that exist', () => {
    for (const species of ALL_HUSK_SPECIES) {
      for (const id of species.skillIds) {
        expect(SKILLS.has(id), `${species.id} -> ${id}`).toBe(true);
      }
    }
  });

  it('gives every Husk something to attack with', () => {
    for (const species of ALL_HUSK_SPECIES) {
      expect(species.skillIds.length).toBeGreaterThan(0);
      expect(species.hp).toBeGreaterThan(0);
    }
  });

  it('populates every rank', () => {
    for (const rank of HUSK_RANKS) {
      expect(husksOfRank(rank).length, `no husk of rank ${rank}`).toBeGreaterThan(0);
    }
  });

  // Without a weakness there is no Second Wind, no Onslaught, and no game.
  it('gives every Husk at least one weakness', () => {
    for (const species of ALL_HUSK_SPECIES) {
      const weaknesses = Object.values(species.affinities).filter((a) => a === 'weak');
      expect(weaknesses.length, `${species.id} has no weakness`).toBeGreaterThan(0);
    }
  });

  it('gives Wardens a Veil and nothing else one', () => {
    for (const species of ALL_HUSK_SPECIES) {
      if (species.rank === 'warden') {
        expect(species.veilHits, `${species.id}`).toBeGreaterThan(0);
      } else {
        expect(species.veilHits, `${species.id}`).toBeUndefined();
      }
    }
  });

  describe('bind yields', () => {
    it('cover every Husk', () => {
      for (const species of ALL_HUSK_SPECIES) {
        expect(BIND_YIELD[species.id], `${species.id} yields nothing`).toBeDefined();
      }
    });

    it('name Echoes that exist', () => {
      for (const [huskId, echoId] of Object.entries(BIND_YIELD)) {
        expect(() => echoSpecies(echoId), `${huskId} -> ${echoId}`).not.toThrow();
      }
    });
  });
});

describe('allies', () => {
  it('has unique ids and references Echoes that exist', () => {
    const ids = ALL_ALLIES.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ALL_ALLIES) expect(() => echoSpecies(a.echoSpeciesId)).not.toThrow();
  });

  it('unlocks them above level one, so the party is earned', () => {
    for (const a of ALL_ALLIES) expect(a.unlockLevel).toBeGreaterThan(1);
  });

  it('covers every role', () => {
    const roles = new Set(ALL_ALLIES.map((a) => a.role));
    expect(roles).toContain('striker');
    expect(roles).toContain('mender');
    expect(roles).toContain('breaker');
  });
});

describe('weaving', () => {
  // A player must never get a different Echo by selecting the same two in the
  // other order.
  it('is commutative across every pair', () => {
    for (const a of SUITS) {
      for (const b of SUITS) {
        expect(weaveSuit(a, b), `${a} + ${b}`).toBe(weaveSuit(b, a));
      }
    }
  });

  it('keeps a same-suit weave in the family', () => {
    for (const suit of SUITS) expect(weaveSuit(suit, suit)).toBe(suit);
  });

  it('always yields a real suit', () => {
    for (const a of SUITS) {
      for (const b of SUITS) expect(SUITS).toContain(weaveSuit(a, b));
    }
  });

  it('reaches every suit from some pair', () => {
    const reachable = new Set(SUITS.flatMap((a) => SUITS.map((b) => weaveSuit(a, b))));
    for (const suit of SUITS) expect(reachable, `${suit} unreachable`).toContain(suit);
  });

  it('labels and describes every suit', () => {
    for (const suit of SUITS) {
      expect(SUIT_LABEL[suit].length).toBeGreaterThan(0);
      expect(SUIT_BLURB[suit].length).toBeGreaterThan(0);
    }
  });
});
