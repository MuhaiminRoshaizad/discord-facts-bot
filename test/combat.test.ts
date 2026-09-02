import { describe, expect, it } from 'vitest';
import {
  advance,
  allHusksDowned,
  combatant,
  createHusk,
  createWanderer,
  effectiveStat,
  isPlayerTurn,
  living,
  startEncounter,
  takeAction,
  usableSkills,
  WANDERER_ID,
  type CombatState,
} from '../src/game/combat';
import { ally } from '../src/game/content/allies';
import type { AffinityTable } from '../src/game/types';

const wandererSeed = {
  name: 'Wanderer',
  level: 5,
  echoRowId: 'echo-1',
  echoSpeciesId: 'emberkin', // ember resist, frost weak; knows cinder
  echoLevel: 5,
};

/** A fight that is deterministic and always starts with the player. */
function encounter(overrides: Partial<Parameters<typeof startEncounter>[0]> = {}): CombatState {
  return startEncounter({
    wanderer: wandererSeed,
    allies: [],
    // cinderhusk: weak to frost, resists ember, slow enough to act after us
    husks: [{ speciesId: 'cinderhusk', level: 1 }],
    seed: 12345,
    ...overrides,
  });
}

/** Rebuild a combatant's affinities so a test can aim at a known weakness. */
function setAffinities(state: CombatState, id: string, affinities: AffinityTable): void {
  const target = combatant(state, id);
  if (!target) throw new Error(`no combatant ${id}`);
  target.affinities = affinities;
}

describe('startEncounter', () => {
  it('puts everyone in the fight', () => {
    const state = encounter();
    expect(combatant(state, WANDERER_ID)).toBeDefined();
    expect(living(state, 'husks')).toHaveLength(1);
    expect(state.outcome).toBe('ongoing');
  });

  it('brings allies along', () => {
    const state = encounter({
      allies: [{ definition: ally('rell'), level: 5, stance: 'assault' }],
    });
    expect(living(state, 'party')).toHaveLength(2);
  });

  it('is deterministic for a given seed', () => {
    const a = encounter();
    const b = encounter();
    expect(a.combatants.map((c) => c.hp)).toEqual(b.combatants.map((c) => c.hp));
    expect(a.order).toEqual(b.order);
  });

  it('orders turns by speed', () => {
    const state = encounter();
    const speeds = state.order.map((id) => effectiveStat(combatant(state, id)!, 'spd'));
    expect(speeds).toEqual([...speeds].sort((x, y) => y - x));
  });

  it('gives the Wanderer the Echo affinities and skills', () => {
    const wanderer = createWanderer(wandererSeed);
    expect(wanderer.affinities.frost).toBe('weak');
    expect(wanderer.skillIds).toContain('cinder');
  });
});

describe('takeAction guards', () => {
  it('refuses an action once the fight is over', () => {
    const state = encounter();
    state.outcome = 'won';
    expect(takeAction(state, { kind: 'skill', skillId: 'strike' })).toMatchObject({ ok: false });
  });

  it('refuses a skill the active Echo does not know', () => {
    const state = encounter();
    const result = takeAction(state, { kind: 'skill', skillId: 'hoarfrost' });
    expect(result).toMatchObject({ ok: false });
  });

  it('refuses a skill there is no Focus for', () => {
    const state = encounter();
    combatant(state, WANDERER_ID)!.focus = 0;
    expect(takeAction(state, { kind: 'skill', skillId: 'cinder' })).toMatchObject({ ok: false });
  });

  it('always allows Strike, which is why it is free', () => {
    const state = encounter();
    combatant(state, WANDERER_ID)!.focus = 0;
    expect(usableSkills(combatant(state, WANDERER_ID)!).some((s) => s.id === 'strike')).toBe(true);
  });
});

describe('damage and affinity', () => {
  it('hurts a neutral target', () => {
    const state = encounter();
    setAffinities(state, 'h:0', {});
    const before = combatant(state, 'h:0')!.hp;
    takeAction(state, { kind: 'skill', skillId: 'cinder', targetId: 'h:0' });
    expect(combatant(state, 'h:0')!.hp).toBeLessThan(before);
  });

  it('deals nothing through a null and does not down the target', () => {
    const state = encounter();
    setAffinities(state, 'h:0', { ember: 'null' });
    const before = combatant(state, 'h:0')!.hp;
    takeAction(state, { kind: 'skill', skillId: 'cinder', targetId: 'h:0' });
    const husk = combatant(state, 'h:0')!;
    expect(husk.hp).toBe(before);
    expect(husk.downed).toBe(false);
  });

  it('heals the target on a drain', () => {
    const state = encounter();
    setAffinities(state, 'h:0', { ember: 'drain' });
    const husk = combatant(state, 'h:0')!;
    husk.hp = 5;
    takeAction(state, { kind: 'skill', skillId: 'cinder', targetId: 'h:0' });
    expect(combatant(state, 'h:0')!.hp).toBeGreaterThan(5);
  });

  it('turns a repel back on the attacker', () => {
    const state = encounter();
    setAffinities(state, 'h:0', { ember: 'repel' });
    const before = combatant(state, WANDERER_ID)!.hp;
    takeAction(state, { kind: 'skill', skillId: 'cinder', targetId: 'h:0' });
    expect(combatant(state, WANDERER_ID)!.hp).toBeLessThan(before);
  });
});

describe('Second Wind', () => {
  it('is granted by a fresh knockdown and keeps the turn', () => {
    const state = encounter();
    setAffinities(state, 'h:0', { ember: 'weak' });
    combatant(state, 'h:0')!.hp = 9999;
    combatant(state, 'h:0')!.maxHp = 9999;

    const result = takeAction(state, { kind: 'skill', skillId: 'cinder', targetId: 'h:0' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.secondWind).toBe(true);
    expect(combatant(result.state, 'h:0')!.downed).toBe(true);
    expect(isPlayerTurn(result.state)).toBe(true);
  });

  // The terminator. Without it, weakness chains would never end.
  it('is not granted a second time against an already-downed target', () => {
    const state = encounter();
    setAffinities(state, 'h:0', { ember: 'weak' });
    const husk = combatant(state, 'h:0')!;
    husk.hp = 9999;
    husk.maxHp = 9999;

    const first = takeAction(state, { kind: 'skill', skillId: 'cinder', targetId: 'h:0' });
    expect(first.ok && first.state.secondWind).toBe(true);
    if (!first.ok) return;

    const second = takeAction(first.state, {
      kind: 'skill',
      skillId: 'cinder',
      targetId: 'h:0',
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.state.secondWind).toBe(false);
  });

  it('does not fire when the hit kills, since a corpse cannot be downed', () => {
    const state = encounter();
    setAffinities(state, 'h:0', { ember: 'weak' });
    combatant(state, 'h:0')!.hp = 1;
    const result = takeAction(state, { kind: 'skill', skillId: 'cinder', targetId: 'h:0' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.outcome).toBe('won');
  });
});

describe('swapping Echoes', () => {
  it('is free and leaves the turn with the player', () => {
    const state = encounter();
    const result = takeAction(state, {
      kind: 'swap',
      echoRowId: 'echo-2',
      speciesId: 'brinemote',
      echoLevel: 5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isPlayerTurn(result.state)).toBe(true);
    expect(result.state.activeSpeciesId).toBe('brinemote');
  });

  // The core tension: the Echo that answers one weakness opens another.
  it('replaces the wielder affinities with the new Echo', () => {
    const state = encounter();
    expect(combatant(state, WANDERER_ID)!.affinities.frost).toBe('weak');
    const result = takeAction(state, {
      kind: 'swap',
      echoRowId: 'echo-2',
      speciesId: 'brinemote',
      echoLevel: 5,
    });
    if (!result.ok) throw new Error('swap rejected');
    expect(combatant(result.state, WANDERER_ID)!.affinities.frost).toBe('resist');
    expect(combatant(result.state, WANDERER_ID)!.affinities.arc).toBe('weak');
  });

  it('refuses a second swap in the same turn', () => {
    const state = encounter();
    const first = takeAction(state, {
      kind: 'swap',
      echoRowId: 'echo-2',
      speciesId: 'brinemote',
      echoLevel: 5,
    });
    if (!first.ok) throw new Error('swap rejected');
    expect(
      takeAction(first.state, {
        kind: 'swap',
        echoRowId: 'echo-3',
        speciesId: 'lumen',
        echoLevel: 5,
      }),
    ).toMatchObject({ ok: false });
  });

  it('refuses swapping to the Echo already summoned', () => {
    const state = encounter();
    expect(
      takeAction(state, {
        kind: 'swap',
        echoRowId: 'echo-1',
        speciesId: 'emberkin',
        echoLevel: 5,
      }),
    ).toMatchObject({ ok: false });
  });

  // HP and Focus belong to the Wanderer, so a swap must never be a free heal.
  it('neither heals nor refills, and clamps to the new ceilings', () => {
    const state = encounter();
    const wanderer = combatant(state, WANDERER_ID)!;
    wanderer.hp = 10;
    wanderer.focus = 3;
    const result = takeAction(state, {
      kind: 'swap',
      echoRowId: 'echo-2',
      speciesId: 'brinemote',
      echoLevel: 5,
    });
    if (!result.ok) throw new Error('swap rejected');
    const after = combatant(result.state, WANDERER_ID)!;
    expect(after.hp).toBe(10);
    expect(after.focus).toBe(3);
    expect(after.hp).toBeLessThanOrEqual(after.maxHp);
  });
});

describe('Onslaught', () => {
  function allDown(): CombatState {
    const state = startEncounter({
      wanderer: wandererSeed,
      allies: [],
      husks: [
        { speciesId: 'cinderhusk', level: 1 },
        { speciesId: 'gnaw', level: 1 },
      ],
      seed: 999,
    });
    for (const husk of living(state, 'husks')) {
      husk.downed = true;
      husk.hp = 9999;
      husk.maxHp = 9999;
    }
    return state;
  }

  it('is refused while anything is still standing', () => {
    const state = encounter();
    expect(takeAction(state, { kind: 'onslaught' })).toMatchObject({ ok: false });
  });

  it('opens once every Husk is down', () => {
    expect(allHusksDowned(allDown())).toBe(true);
  });

  it('hits every Husk and stands them back up', () => {
    const state = allDown();
    const result = takeAction(state, { kind: 'onslaught' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const husk of living(result.state, 'husks')) {
      expect(husk.hp).toBeLessThan(9999);
      expect(husk.downed).toBe(false);
    }
  });

  it('marks a win by Onslaught, which is what unlocks The Draw', () => {
    const state = allDown();
    for (const husk of living(state, 'husks')) {
      husk.hp = 1;
      husk.maxHp = 1;
    }
    const result = takeAction(state, { kind: 'onslaught' });
    if (!result.ok) throw new Error('onslaught rejected');
    expect(result.state.outcome).toBe('won');
    expect(result.state.wonByOnslaught).toBe(true);
  });
});

describe('binding', () => {
  function downed(): CombatState {
    const state = encounter();
    const husk = combatant(state, 'h:0')!;
    husk.downed = true;
    husk.hp = 1;
    return state;
  }

  it('is refused while anything is standing', () => {
    const state = encounter();
    expect(takeAction(state, { kind: 'bind', targetId: 'h:0' })).toMatchObject({ ok: false });
  });

  it('ends the fight and records the species when it lands', () => {
    // At 1 HP out of full the chance is near its ceiling, so this is stable.
    const state = downed();
    const result = takeAction(state, { kind: 'bind', targetId: 'h:0' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    if (result.state.outcome === 'won') {
      expect(result.state.boundSpeciesId).toBe('cinderhusk');
    } else {
      // A failure must cost the opening rather than the fight.
      expect(combatant(result.state, 'h:0')!.downed).toBe(false);
    }
  });

  it('refuses a target that is not there', () => {
    expect(takeAction(downed(), { kind: 'bind', targetId: 'h:9' })).toMatchObject({ ok: false });
  });
});

describe('the Veil', () => {
  it('suppresses a Warden weakness until enough hits connect', () => {
    const warden = createHusk('drowned-choir', 1, 0);
    expect(warden.veilRemaining).toBe(3);

    const state = startEncounter({
      wanderer: { ...wandererSeed, echoSpeciesId: 'veilwisp', echoLevel: 9 },
      allies: [],
      husks: [{ speciesId: 'drowned-choir', level: 1 }],
      seed: 4242,
    });

    // Arc is a Warden weakness, but the Veil holds for the first hits.
    const first = takeAction(state, { kind: 'skill', skillId: 'jolt', targetId: 'h:0' });
    if (!first.ok) throw new Error('rejected');
    expect(first.state.secondWind).toBe(false);
    expect(combatant(first.state, 'h:0')!.veilRemaining).toBe(2);
  });
});

describe('retreat', () => {
  it('ends the run without a loss', () => {
    const result = takeAction(encounter(), { kind: 'retreat' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.outcome).toBe('retreated');
  });
});

describe('defeat', () => {
  // The Wanderer is the run. A surviving ally does not carry it on.
  it('is declared when the Wanderer falls, whatever the allies are doing', () => {
    const state = encounter({
      allies: [{ definition: ally('ives'), level: 5, stance: 'support' }],
      // Something that comfortably survives the opening round, or the fight
      // would already be won before the Wanderer could fall.
      husks: [{ speciesId: 'forgemaw', level: 3 }],
    });
    expect(state.outcome).toBe('ongoing');
    expect(living(state, 'party')).toHaveLength(2);

    combatant(state, WANDERER_ID)!.hp = 0;
    expect(advance(state).outcome).toBe('lost');
  });
});

describe('rare Husks', () => {
  it('leave once the fight drags past their patience', () => {
    const state = startEncounter({
      wanderer: wandererSeed,
      allies: [],
      husks: [{ speciesId: 'gildhusk', level: 1 }],
      seed: 77,
      fleeAfterRound: 1,
    });
    // Burn the player's turn; the round then completes and it bolts.
    const result = takeAction(state, { kind: 'skill', skillId: 'strike', targetId: 'h:0' });
    if (!result.ok) throw new Error('rejected');
    expect(['fled', 'won']).toContain(result.state.outcome);
  });
});

describe('the engine as a whole', () => {
  it('terminates a full fight rather than looping', () => {
    let state = encounter({
      allies: [{ definition: ally('rell'), level: 5, stance: 'assault' }],
      husks: [
        { speciesId: 'cinderhusk', level: 1 },
        { speciesId: 'gnaw', level: 1 },
      ],
    });

    for (let i = 0; i < 200 && state.outcome === 'ongoing'; i++) {
      const action = allHusksDowned(state)
        ? ({ kind: 'onslaught' } as const)
        : ({ kind: 'skill', skillId: 'strike', targetId: living(state, 'husks')[0]?.id } as const);
      const result = takeAction(state, action);
      if (!result.ok) break;
      state = result.state;
    }

    expect(state.outcome).not.toBe('ongoing');
  });

  it('keeps the log bounded however long the fight runs', () => {
    let state = encounter();
    for (let i = 0; i < 40 && state.outcome === 'ongoing'; i++) {
      const result = takeAction(state, {
        kind: 'skill',
        skillId: 'strike',
        targetId: living(state, 'husks')[0]?.id,
      });
      if (!result.ok) break;
      state = result.state;
    }
    expect(state.log.length).toBeLessThanOrEqual(6);
  });

  it('never lets HP fall below zero or rise above the maximum', () => {
    let state = encounter({
      allies: [{ definition: ally('ives'), level: 5, stance: 'support' }],
    });
    for (let i = 0; i < 60 && state.outcome === 'ongoing'; i++) {
      const result = takeAction(state, {
        kind: 'skill',
        skillId: 'strike',
        targetId: living(state, 'husks')[0]?.id,
      });
      if (!result.ok) break;
      state = result.state;
      for (const c of state.combatants) {
        expect(c.hp).toBeGreaterThanOrEqual(0);
        expect(c.hp).toBeLessThanOrEqual(c.maxHp);
      }
    }
  });
});
