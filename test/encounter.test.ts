import { describe, expect, it } from 'vitest';
import {
  huskLevelFor,
  rollEvent,
  tableAt,
  WARDEN_DEPTH,
  type RiftEventKind,
} from '../src/game/encounter';
import { dealDraw, describeCard, DRAW_CARDS, encounterGold, encounterSpoils } from '../src/game/draw';
import { previewWeave } from '../src/game/weave';
import { createRng } from '../src/game/rng';
import { echoSpecies } from '../src/game/content/echoes';
import { huskSpecies } from '../src/game/content/husks';

describe('rift tables', () => {
  it('keeps every weight positive at every reachable depth', () => {
    for (let depth = 0; depth < WARDEN_DEPTH; depth++) {
      for (const entry of tableAt(depth)) {
        expect(entry.weight, `${entry.kind} at depth ${depth}`).toBeGreaterThan(0);
      }
    }
  });

  it('thins the trash and thickens the elites with depth', () => {
    const shallow = tableAt(0);
    const deep = tableAt(9);
    const lesserOf = (t: typeof shallow) => t.find((e) => e.kind === 'lesser')!.weight;
    const greaterOf = (t: typeof shallow) => t.find((e) => e.kind === 'greater')!.weight;
    expect(lesserOf(deep)).toBeLessThan(lesserOf(shallow));
    expect(greaterOf(deep)).toBeGreaterThan(greaterOf(shallow));
  });
});

describe('rollEvent', () => {
  it('is reproducible from a seed', () => {
    const a = rollEvent(3, 5, createRng(4242));
    const b = rollEvent(3, 5, createRng(4242));
    expect(a).toEqual(b);
  });

  it('always sends a Warden at the bottom', () => {
    for (let seed = 0; seed < 25; seed++) {
      const event = rollEvent(WARDEN_DEPTH, 8, createRng(seed));
      expect(event.kind).toBe('warden');
      expect(huskSpecies(event.husks![0]!.speciesId).rank).toBe('warden');
    }
  });

  it('never sends a Warden before the bottom', () => {
    const rng = createRng(1);
    for (let i = 0; i < 400; i++) {
      expect(rollEvent(rng.int(0, WARDEN_DEPTH - 1), 5, rng).kind).not.toBe('warden');
    }
  });

  it('names real Husks and gives combat events at least one', () => {
    const rng = createRng(88);
    for (let i = 0; i < 300; i++) {
      const event = rollEvent(rng.int(0, 9), 6, rng);
      if (!['lesser', 'greater', 'rare'].includes(event.kind)) continue;
      expect(event.husks!.length).toBeGreaterThan(0);
      for (const husk of event.husks!) {
        expect(() => huskSpecies(husk.speciesId)).not.toThrow();
        expect(husk.level).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('caps a Lesser pack at three', () => {
    const rng = createRng(31337);
    for (let i = 0; i < 500; i++) {
      const event = rollEvent(rng.int(0, 9), 5, rng);
      if (event.kind === 'lesser') expect(event.husks!.length).toBeLessThanOrEqual(3);
    }
  });

  it('gives Rares an escape and nothing else one', () => {
    const rng = createRng(555);
    for (let i = 0; i < 400; i++) {
      const event = rollEvent(rng.int(0, 9), 5, rng);
      if (event.kind === 'rare') expect(event.fleeAfterRound).toBeGreaterThan(0);
      else expect(event.fleeAfterRound).toBeUndefined();
    }
  });

  it('offers only plain Echoes in a negotiation, and prices them', () => {
    const rng = createRng(24);
    let seen = 0;
    for (let i = 0; i < 800; i++) {
      const event = rollEvent(rng.int(0, 9), 5, rng);
      if (event.kind !== 'negotiation') continue;
      seen++;
      expect(echoSpecies(event.offerSpeciesId!).rarity).toBeLessThanOrEqual(2);
      expect(event.offerCost).toBeGreaterThan(0);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('reaches every kind of event across a long descent', () => {
    const rng = createRng(2026);
    const seen = new Set<RiftEventKind>();
    for (let i = 0; i < 3000; i++) seen.add(rollEvent(rng.int(0, 9), 5, rng).kind);
    for (const kind of ['lesser', 'greater', 'rare', 'cache', 'rest', 'negotiation'] as const) {
      expect(seen, `never rolled ${kind}`).toContain(kind);
    }
  });
});

describe('huskLevelFor', () => {
  it('never drops below one', () => {
    expect(huskLevelFor(1, 0)).toBeGreaterThanOrEqual(1);
  });

  it('rises with both the Wanderer and the depth', () => {
    expect(huskLevelFor(10, 5)).toBeGreaterThan(huskLevelFor(10, 0));
    expect(huskLevelFor(20, 0)).toBeGreaterThan(huskLevelFor(5, 0));
  });
});

describe('spoils', () => {
  it('pays more for a Greater than a Lesser of the same level', () => {
    const rng = createRng(5);
    const lesser = encounterSpoils([{ rank: 'lesser', level: 3 }], rng);
    const greater = encounterSpoils([{ rank: 'greater', level: 3 }], createRng(5));
    expect(greater.xp).toBeGreaterThan(lesser.xp);
    expect(greater.gold).toBeGreaterThan(lesser.gold);
  });

  it('sums across a pack', () => {
    const one = encounterSpoils([{ rank: 'lesser', level: 2 }], createRng(9));
    const three = encounterSpoils(
      [
        { rank: 'lesser', level: 2 },
        { rank: 'lesser', level: 2 },
        { rank: 'lesser', level: 2 },
      ],
      createRng(9),
    );
    expect(three.xp).toBe(one.xp * 3);
  });

  it('never pays nothing', () => {
    const rng = createRng(1);
    for (let i = 0; i < 100; i++) {
      expect(encounterGold('lesser', 1, rng)).toBeGreaterThan(0);
    }
  });
});

describe('The Draw', () => {
  it('always deals three cards', () => {
    const rng = createRng(17);
    for (let i = 0; i < 50; i++) expect(dealDraw(rng.int(0, 9), rng)).toHaveLength(DRAW_CARDS);
  });

  it('is reproducible from a seed', () => {
    expect(dealDraw(4, createRng(600))).toEqual(dealDraw(4, createRng(600)));
  });

  it('only ever offers Echoes that exist', () => {
    const rng = createRng(303);
    for (let i = 0; i < 200; i++) {
      for (const card of dealDraw(rng.int(0, 9), rng)) {
        if (card.kind === 'echo') expect(() => echoSpecies(card.speciesId)).not.toThrow();
      }
    }
  });

  // The first Onslaught of a first run must not hand over the best Echo in
  // the game.
  it('bounds Echo rarity by depth', () => {
    const rng = createRng(11);
    for (let i = 0; i < 400; i++) {
      for (const card of dealDraw(0, rng)) {
        if (card.kind === 'echo') expect(echoSpecies(card.speciesId).rarity).toBe(1);
      }
    }
  });

  it('pays a positive amount on every numeric face', () => {
    const rng = createRng(2);
    for (let i = 0; i < 200; i++) {
      for (const card of dealDraw(rng.int(0, 9), rng)) {
        if (card.kind !== 'echo') expect(card.amount).toBeGreaterThan(0);
        expect(describeCard(card).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('weaving', () => {
  const emberkin = { rowId: 'r1', speciesId: 'emberkin', level: 4 };
  const thornlet = { rowId: 'r2', speciesId: 'thornlet', level: 4 };

  it('refuses an Echo woven with itself', () => {
    expect(previewWeave(emberkin, emberkin, 20)).toMatchObject({ ok: false });
  });

  it('produces a real Echo one level above the parents average', () => {
    const preview = previewWeave(emberkin, thornlet, 20);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(() => echoSpecies(preview.outcome.speciesId)).not.toThrow();
    expect(preview.outcome.level).toBe(5);
    expect(preview.outcome.consumes).toEqual(['r1', 'r2']);
  });

  // The preview is shown on a confirmation dialog for a destructive act, so
  // it has to be the literal truth.
  it('is deterministic, so the preview cannot lie', () => {
    expect(previewWeave(emberkin, thornlet, 20)).toEqual(previewWeave(emberkin, thornlet, 20));
  });

  it('is commutative', () => {
    const forward = previewWeave(emberkin, thornlet, 20);
    const back = previewWeave(thornlet, emberkin, 20);
    expect(forward.ok && back.ok).toBe(true);
    if (!forward.ok || !back.ok) return;
    expect(forward.outcome.speciesId).toBe(back.outcome.speciesId);
    expect(forward.outcome.level).toBe(back.outcome.level);
  });

  it('refuses to outpace its weaver', () => {
    const high = { rowId: 'r3', speciesId: 'emberkin', level: 20 };
    const other = { rowId: 'r4', speciesId: 'thornlet', level: 20 };
    const preview = previewWeave(high, other, 5);
    expect(preview.ok).toBe(false);
    if (preview.ok) return;
    expect(preview.reason).toMatch(/level/i);
  });

  it('inherits at most two skills, and none the result already knows', () => {
    const preview = previewWeave(
      { rowId: 'a', speciesId: 'undertow', level: 18 },
      { rowId: 'b', speciesId: 'palewatch', level: 18 },
      30,
    );
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.outcome.inheritedSkillIds.length).toBeLessThanOrEqual(2);

    const result = echoSpecies(preview.outcome.speciesId);
    const native = new Set(
      result.learnset
        .filter((entry) => entry.level <= preview.outcome.level)
        .map((entry) => entry.skillId),
    );
    for (const id of preview.outcome.inheritedSkillIds) expect(native.has(id)).toBe(false);
  });

  it('handles every pair in the catalogue without throwing', () => {
    const ids = ['emberkin', 'thornlet', 'rivet', 'lumen', 'selkra', 'veilwisp', 'marrowkin'];
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        const preview = previewWeave(
          { rowId: 'x', speciesId: a, level: 6 },
          { rowId: 'y', speciesId: b, level: 6 },
          40,
        );
        expect(preview.ok, `${a} + ${b}`).toBe(true);
      }
    }
  });
});
