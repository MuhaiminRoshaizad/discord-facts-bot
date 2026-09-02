import { describe, expect, it } from 'vitest';
import {
  acceptOffer,
  beginRun,
  descend,
  keepsSpoils,
  MAX_DEPTH,
  retreat,
  settleCombat,
  takeDrawCard,
  type RunState,
} from '../src/game/run';
import { takeAction, living, combatant, WANDERER_ID } from '../src/game/combat';
import { dealDraw } from '../src/game/draw';
import { createRng } from '../src/game/rng';
import { echoSpecies } from '../src/game/content/echoes';

const wanderer = {
  name: 'Wanderer',
  level: 6,
  echoRowId: 'e1',
  echoSpeciesId: 'emberkin',
  echoLevel: 6,
};

function run(seed = 1234): RunState {
  return beginRun(wanderer, [], seed);
}

describe('beginRun', () => {
  it('starts at depth one with a step already resolved', () => {
    const state = run();
    expect(state.depth).toBe(1);
    expect(state.event).not.toBeNull();
    expect(['event', 'combat', 'draw', 'ended']).toContain(state.phase);
  });

  it('is reproducible from a seed', () => {
    expect(JSON.stringify(run(77))).toBe(JSON.stringify(run(77)));
  });

  it('starts at full HP and Focus', () => {
    const state = run();
    expect(state.hp).toBeGreaterThan(0);
    expect(state.focus).toBeGreaterThan(0);
  });

  it('picks a target when a fight begins', () => {
    for (let seed = 0; seed < 40; seed++) {
      const state = run(seed);
      if (state.phase !== 'combat') continue;
      expect(state.targetId).not.toBeNull();
      expect(living(state.combat!, 'husks').some((h) => h.id === state.targetId)).toBe(true);
      return;
    }
  });
});

/** Drive a run forwards until it reaches the requested phase, or gives up. */
function until(state: RunState, phase: RunState['phase'], limit = 400): RunState {
  let current = state;
  for (let i = 0; i < limit && current.phase !== phase && current.phase !== 'ended'; i++) {
    if (current.phase === 'combat') {
      const combat = current.combat!;
      if (combat.outcome !== 'ongoing') {
        current = settleCombat(current);
        continue;
      }
      const target = living(combat, 'husks')[0]?.id;
      const result = takeAction(combat, {
        kind: 'skill',
        skillId: 'strike',
        ...(target === undefined ? {} : { targetId: target }),
      });
      if (!result.ok) break;
      current.combat = result.state;
      if (result.state.outcome !== 'ongoing') current = settleCombat(current);
    } else if (current.phase === 'draw') {
      current = takeDrawCard(current, 0);
    } else {
      current = descend(current);
    }
  }
  return current;
}

describe('descending', () => {
  it('goes deeper one step at a time', () => {
    const state = run(5);
    if (state.phase !== 'event') return;
    const deeper = descend(state);
    expect(deeper.depth).toBe(2);
  });

  it('never passes the bottom', () => {
    let state = run(3);
    state.depth = MAX_DEPTH;
    state.phase = 'event';
    state = descend(state);
    expect(state.depth).toBeLessThanOrEqual(MAX_DEPTH);
    expect(state.phase).toBe('ended');
    expect(state.ending).toBe('completed');
  });

  it('reaches an end rather than running forever', () => {
    for (let seed = 0; seed < 12; seed++) {
      const finished = until(run(seed), 'ended');
      expect(finished.phase).toBe('ended');
      expect(finished.ending).not.toBeNull();
    }
  });
});

describe('carrying damage between fights', () => {
  it('does not restore HP on the next step', () => {
    let state = run(9);
    state = until(state, 'event');
    if (state.phase !== 'event') return;

    const before = state.hp;
    state.hp = Math.max(1, Math.floor(before / 2));
    const wounded = state.hp;

    const deeper = descend(state);
    if (deeper.phase !== 'combat') return;
    expect(combatant(deeper.combat!, WANDERER_ID)!.hp).toBeLessThanOrEqual(wounded);
  });
});

describe('settleCombat', () => {
  it('does nothing while the fight is still running', () => {
    const state = run(2);
    if (state.phase !== 'combat') return;
    const before = JSON.stringify(state);
    expect(JSON.stringify(settleCombat(state))).toBe(before);
  });

  // A bad run should still move you forward; only the gold is forfeit.
  it('forfeits unbanked gold on defeat but keeps XP', () => {
    const state = run(2);
    if (state.phase !== 'combat') return;
    state.pendingGold = 500;
    state.pendingXp = 300;
    state.combat!.outcome = 'lost';

    const settled = settleCombat(state);
    expect(settled.ending).toBe('defeated');
    expect(settled.pendingGold).toBe(0);
    expect(settled.pendingXp).toBe(300);
    expect(keepsSpoils(settled)).toBe(false);
  });

  it('banks spoils on a win', () => {
    let state = run(2);
    for (let seed = 2; state.phase !== 'combat' && seed < 40; seed++) state = run(seed);
    if (state.phase !== 'combat') return;

    for (const husk of living(state.combat!, 'husks')) husk.hp = 0;
    state.combat!.outcome = 'won';
    const settled = settleCombat(state);
    expect(settled.pendingXp).toBeGreaterThan(0);
    expect(settled.pendingGold).toBeGreaterThan(0);
  });

  it('offers The Draw only after a win by Onslaught', () => {
    let state = run(2);
    for (let seed = 2; state.phase !== 'combat' && seed < 40; seed++) state = run(seed);
    if (state.phase !== 'combat') return;

    for (const husk of living(state.combat!, 'husks')) husk.hp = 0;
    state.combat!.outcome = 'won';
    state.combat!.wonByOnslaught = true;
    const settled = settleCombat(state);
    expect(settled.phase).toBe('draw');
    expect(settled.draw).toHaveLength(3);
  });

  it('records a bound Husk as the Echo it yields', () => {
    let state = run(2);
    for (let seed = 2; state.phase !== 'combat' && seed < 40; seed++) state = run(seed);
    if (state.phase !== 'combat') return;

    for (const husk of living(state.combat!, 'husks')) husk.hp = 0;
    state.combat!.outcome = 'won';
    state.combat!.boundSpeciesId = 'cinderhusk';
    const settled = settleCombat(state);
    expect(settled.pendingEchoes).toContain('emberkin');
  });
});

describe('The Draw', () => {
  function drawing(): RunState {
    const state = run(15);
    state.phase = 'draw';
    state.depth = 3;
    state.draw = dealDraw(3, createRng(1));
    return state;
  }

  it('applies the chosen card and clears the rest', () => {
    const state = drawing();
    const card = state.draw![0]!;
    const after = takeDrawCard(state, 0);

    expect(after.draw).toBeNull();
    if (card.kind === 'gold') expect(after.pendingGold).toBe(card.amount);
    if (card.kind === 'xp') expect(after.pendingXp).toBe(card.amount);
    if (card.kind === 'echo') expect(after.pendingEchoes).toContain(card.speciesId);
  });

  it('ignores an index that is not on the table', () => {
    const state = drawing();
    const before = JSON.stringify(state.draw);
    expect(JSON.stringify(takeDrawCard(state, 9).draw)).toBe(before);
  });

  it('ends the run when drawn at the bottom', () => {
    const state = drawing();
    state.depth = MAX_DEPTH;
    const after = takeDrawCard(state, 0);
    expect(after.phase).toBe('ended');
    expect(after.ending).toBe('completed');
  });
});

describe('negotiation', () => {
  function offering(): RunState {
    const state = run(20);
    state.phase = 'event';
    state.event = { kind: 'negotiation', offerSpeciesId: 'lumen', offerCost: 100 };
    state.pendingGold = 0;
    return state;
  }

  it('refuses when there is not enough gold anywhere', () => {
    expect(acceptOffer(offering(), 10)).toMatchObject({ ok: false });
  });

  it('spends the run gold before the purse', () => {
    const state = offering();
    state.pendingGold = 60;
    const result = acceptOffer(state, 500);
    expect(result).toMatchObject({ ok: true, fromBanked: 40 });
    expect(state.pendingGold).toBe(0);
    expect(state.pendingEchoes).toContain('lumen');
  });

  it('takes nothing from the purse when the run can cover it', () => {
    const state = offering();
    state.pendingGold = 250;
    expect(acceptOffer(state, 0)).toMatchObject({ ok: true, fromBanked: 0 });
    expect(state.pendingGold).toBe(150);
  });

  it('cannot be accepted twice', () => {
    const state = offering();
    state.pendingGold = 500;
    expect(acceptOffer(state, 0).ok).toBe(true);
    expect(acceptOffer(state, 500)).toMatchObject({ ok: false });
  });

  it('refuses when the step is not a negotiation', () => {
    const state = run(20);
    state.event = { kind: 'cache', gold: 10 };
    expect(acceptOffer(state, 1000)).toMatchObject({ ok: false });
  });

  it('only ever offers Echoes that exist', () => {
    for (let seed = 0; seed < 200; seed++) {
      const state = run(seed);
      if (state.event?.kind !== 'negotiation') continue;
      expect(() => echoSpecies(state.event!.offerSpeciesId!)).not.toThrow();
    }
  });
});

describe('retreat', () => {
  it('ends the run with everything kept', () => {
    const state = run(6);
    state.pendingGold = 400;
    const after = retreat(state);
    expect(after.ending).toBe('retreated');
    expect(after.pendingGold).toBe(400);
    expect(keepsSpoils(after)).toBe(true);
  });
});

describe('spoils', () => {
  it('are paid out on completion and retreat, and not on defeat', () => {
    const base = run(6);
    expect(keepsSpoils({ ...base, ending: 'completed' })).toBe(true);
    expect(keepsSpoils({ ...base, ending: 'retreated' })).toBe(true);
    expect(keepsSpoils({ ...base, ending: 'defeated' })).toBe(false);
    expect(keepsSpoils({ ...base, ending: null })).toBe(false);
  });
});

describe('serialisation', () => {
  // The whole run lives in one D1 column, so it has to survive a round trip.
  it('survives a JSON round trip unchanged', () => {
    const state = until(run(31), 'ended');
    const restored = JSON.parse(JSON.stringify(state)) as RunState;
    expect(restored).toEqual(state);
  });

  it('stays small enough to store comfortably', () => {
    const state = run(31);
    expect(JSON.stringify(state).length).toBeLessThan(20_000);
  });
});
