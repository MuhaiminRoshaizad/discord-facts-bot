/**
 * Balance simulator.
 *
 * Plays thousands of fights through the real engine with a competent-player
 * policy, and reports what actually happens. Tuning a turn-based game by
 * argument is how you end up with a level-one enemy that one-shots a
 * level-one player; this is the instrument that catches it.
 *
 *   npm run sim              sweep the early game
 *   npm run sim -- 5 3       one cell: level 5, depth 3
 */

import {
  allHusksDowned,
  combatant,
  living,
  startEncounter,
  takeAction,
  usableSkills,
  WANDERER_ID,
  type CombatState,
} from '../src/game/combat.ts';
import { resolveAffinity } from '../src/game/affinity.ts';
import {
  ALL_ECHO_SPECIES,
  echoSpecies,
  STARTER_ECHO_IDS,
} from '../src/game/content/echoes.ts';
import { skill as lookupSkill } from '../src/game/content/skills.ts';
import { huskLevelFor, rollEvent, WARDEN_DEPTH } from '../src/game/encounter.ts';
import { createRng } from '../src/game/rng.ts';
import { maxHp } from '../src/game/progression.ts';

interface Carried {
  rowId: string;
  speciesId: string;
  level: number;
}

/** How a competent player would act: swap for the best answer, then hit. */
function bestPlay(state: CombatState, carried: Carried[]): boolean {
  const self = combatant(state, WANDERER_ID);
  const enemies = living(state, 'husks');
  if (!self || enemies.length === 0) return false;

  if (allHusksDowned(state)) {
    return takeAction(state, { kind: 'onslaught' }).ok;
  }

  // The best multiplier a given Echo could achieve against anything standing.
  function reach(speciesId: string, level: number): number {
    const species = echoSpecies(speciesId);
    let best = 0;
    for (const entry of species.learnset) {
      if (entry.level > level) continue;
      for (const enemy of enemies) {
        const veiled = (enemy.veilRemaining ?? 0) > 0;
        best = Math.max(
          best,
          resolveAffinity(enemy.affinities, elementOf(entry.skillId), veiled).multiplier,
        );
      }
    }
    // Strike is always available, so no Echo reaches less than a neutral hit.
    return Math.max(best, resolveAffinity(enemies[0]!.affinities, 'force').multiplier);
  }

  // Would another Echo answer this better than the one summoned?
  if (!state.swappedThisTurn && carried.length > 1) {
    const active = carried.find((c) => c.rowId === state.activeEchoId);
    const current = active ? reach(active.speciesId, active.level) : 0;

    let bestEcho: Carried | null = null;
    let bestReach = current;

    for (const option of carried) {
      if (option.rowId === state.activeEchoId) continue;
      const r = reach(option.speciesId, option.level);
      if (r > bestReach) {
        bestReach = r;
        bestEcho = option;
      }
    }

    if (bestEcho) {
      const swapped = takeAction(state, {
        kind: 'swap',
        echoRowId: bestEcho.rowId,
        speciesId: bestEcho.speciesId,
        echoLevel: bestEcho.level,
      });
      if (swapped.ok) return true;
    }
  }

  // Pick the skill and target with the best expected outcome.
  let bestSkill = 'strike';
  let bestTarget = enemies[0]!.id;
  let bestScore = -1;

  for (const s of usableSkills(self)) {
    if (s.kind !== 'damage') continue;
    for (const enemy of enemies) {
      const veiled = (enemy.veilRemaining ?? 0) > 0;
      const out = resolveAffinity(enemy.affinities, s.element, veiled);
      const score = s.power * out.multiplier * (out.downs && !enemy.downed ? 3 : 1);
      if (score > bestScore) {
        bestScore = score;
        bestSkill = s.id;
        bestTarget = enemy.id;
      }
    }
  }

  return takeAction(state, { kind: 'skill', skillId: bestSkill, targetId: bestTarget }).ok;
}

function elementOf(skillId: string) {
  return lookupSkill(skillId).element;
}

interface Result {
  won: number;
  lost: number;
  fled: number;
  rounds: number[];
  hpLeft: number[];
  earlyDeath: number;
  deathRound: number[];
}

function simulate(level: number, depth: number, trials: number, echoCount: number): Result {
  const out: Result = { won: 0, lost: 0, fled: 0, rounds: [], hpLeft: [], earlyDeath: 0, deathRound: [] };

  for (let t = 0; t < trials; t++) {
    const rng = createRng(t * 7919 + depth * 104729 + level);
    const event = rollEvent(depth, level, rng);
    if (!event.husks || event.husks.length === 0) continue;

    // Rarity a player plausibly holds at this level. Testing the Warden
    // against four rarity-one starters measures a loadout nobody would have.
    const ceiling = Math.max(1, Math.min(5, Math.ceil(level / 3)));
    const pool =
      level <= 2
        ? STARTER_ECHO_IDS.slice()
        : ALL_ECHO_SPECIES.filter((e) => e.rarity <= ceiling).map((e) => e.id);

    const carried: Carried[] = Array.from({ length: echoCount }, (_, i) => ({
      rowId: `e${i}`,
      speciesId: pool[(t * 3 + i * 5) % pool.length]!,
      level,
    }));
    const active = carried[0]!;

    let state = startEncounter({
      wanderer: {
        name: 'sim',
        level,
        echoRowId: active.rowId,
        echoSpeciesId: active.speciesId,
        echoLevel: active.level,
      },
      allies: [],
      husks: event.husks,
      seed: rng.state(),
      ...(event.fleeAfterRound === undefined ? {} : { fleeAfterRound: event.fleeAfterRound }),
    });

    const startingHp = combatant(state, WANDERER_ID)?.hp ?? 0;
    let hpBefore = startingHp;
    let firstHit = 0;

    for (let guard = 0; guard < 300 && state.outcome === 'ongoing'; guard++) {
      const before = combatant(state, WANDERER_ID)?.hp ?? 0;
      if (!bestPlay(state, carried)) break;
      const after = combatant(state, WANDERER_ID)?.hp ?? 0;
      if (firstHit === 0 && after < before) firstHit = before - after;
      hpBefore = after;
    }

    if (state.outcome === 'won') {
      out.won++;
      out.rounds.push(state.round);
      out.hpLeft.push(hpBefore / Math.max(1, startingHp));
    } else if (state.outcome === 'lost') {
      out.lost++;
      out.deathRound.push(state.round);
      // Dying inside the first two rounds means the fight was over before the
      // player had made a second real decision.
      if (state.round <= 2) out.earlyDeath++;
    } else {
      out.fled++;
    }
  }
  return out;
}

const mean = (xs: number[]) => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const pct = (n: number, d: number) => (d === 0 ? '  - ' : `${Math.round((n / d) * 100)}%`.padStart(4));

function report(level: number, depth: number, echoes: number, trials = 600): void {
  const r = simulate(level, depth, trials, echoes);
  const total = r.won + r.lost + r.fled;
  if (total === 0) return;
  console.log(
    `  L${String(level).padStart(2)} d${String(depth).padStart(2)} ` +
      `${String(echoes)}ech │ win ${pct(r.won, total)} │ ` +
      `rounds ${mean(r.rounds).toFixed(1).padStart(4)} │ ` +
      `hp left ${(mean(r.hpLeft) * 100).toFixed(0).padStart(3)}% │ ` +
      `died by rd2 ${pct(r.earlyDeath, Math.max(1, r.lost))} of ${String(r.lost).padStart(3)} losses`,
  );
}

const args = process.argv.slice(2);

if (args.length >= 2) {
  report(Number(args[0]), Number(args[1]), Number(args[2] ?? 1), 2000);
} else {
  console.log('\nA fight should be won most of the time, take 3-6 rounds, and');
  console.log('almost never end in a one-shot from full health.\n');
  console.log('Early game, one Echo (as shipped):');
  for (const [l, d] of [[1, 1], [1, 2], [2, 2], [3, 3], [5, 4]] as const) report(l, d, 1);
  console.log('\nSame, with four Echoes to swap between:');
  for (const [l, d] of [[1, 1], [1, 2], [2, 2], [3, 3], [5, 4]] as const) report(l, d, 4);
  console.log('\nMid and late:');
  for (const [l, d] of [[8, 6], [12, 8], [16, WARDEN_DEPTH]] as const) report(l, d, 4);
  console.log(
    `\nFor reference: a level 1 Wanderer has ${maxHp(1)} base HP, and Husks at ` +
      `depth 1 are level ${huskLevelFor(1, 1)}.\n`,
  );
}

// --- whole descents -------------------------------------------------------

/**
 * The number that actually matters. A single fight at full health flatters
 * the game; a run is ten steps of attrition with one Warden at the bottom,
 * and that is what a player experiences.
 */
async function runSweep(): Promise<void> {
  const { beginRun, descend, settleCombat, takeDrawCard, retreat: retreatRun, MAX_DEPTH } =
    await import('../src/game/run.ts');
  const { createWanderer } = await import('../src/game/combat.ts');
  const startingHpFor = (s: { wanderer: Parameters<typeof createWanderer>[0] }) =>
    createWanderer(s.wanderer).maxHp;

  console.log('\nWhole descents - ten steps, no retreat, playing to the bottom:');

  for (const level of [1, 3, 5, 8, 12, 16]) {
    let completed = 0;
    let died = 0;
    let banked = 0;
    const reached: number[] = [];
    const trials = 400;

    for (let t = 0; t < trials; t++) {
      const ceiling = Math.max(1, Math.min(5, Math.ceil(level / 3)));
      const pool =
        level <= 2
          ? STARTER_ECHO_IDS.slice()
          : ALL_ECHO_SPECIES.filter((e) => e.rarity <= ceiling).map((e) => e.id);
      const carried: Carried[] = Array.from({ length: 4 }, (_, i) => ({
        rowId: `e${i}`,
        speciesId: pool[(t * 3 + i * 5) % pool.length]!,
        level,
      }));

      let state = beginRun(
        {
          name: 'sim',
          level,
          echoRowId: carried[0]!.rowId,
          echoSpeciesId: carried[0]!.speciesId,
          echoLevel: level,
        },
        [],
        t * 2654435761,
      );

      for (let guard = 0; guard < 900 && state.phase !== 'ended'; guard++) {
        // A sensible player banks a good run rather than dying with it. This
        // is the intended way to play, so it is the honest thing to measure.
        if (state.phase === 'event' && state.hp / startingHpFor(state) < 0.35) {
          state = retreatRun(state);
          break;
        }
        if (state.phase === 'combat' && state.combat) {
          if (state.combat.outcome !== 'ongoing') {
            state = settleCombat(state);
            continue;
          }
          const carriedForFight = carried.map((c) => ({ ...c }));
          if (!bestPlay(state.combat, carriedForFight)) break;
          if (state.combat.outcome !== 'ongoing') state = settleCombat(state);
        } else if (state.phase === 'draw') {
          state = takeDrawCard(state, 0);
        } else {
          state = descend(state);
        }
      }

      reached.push(state.depth);
      if (state.ending === 'completed') completed++;
      else if (state.ending === 'defeated') died++;
      else banked++;
    }

    console.log(
      `  L${String(level).padStart(2)} │ bottom ${pct(completed, trials)} │ ` +
        `banked ${pct(banked, trials)} │ died ${pct(died, trials)} │ ` +
        `avg depth ${mean(reached).toFixed(1)} of ${MAX_DEPTH}`,
    );
  }
  console.log('');
}

if (args.length < 2) await runSweep();
