/**
 * A descent, from the first step to whatever ends it.
 *
 * Wraps the combat engine with everything that persists *between* fights:
 * depth, carried HP and Focus, unbanked spoils, and which phase of the step
 * the player is in. The whole thing serialises to one JSON column.
 *
 * Pure. The command layer supplies the seed and writes the result back.
 */

import {
  advance,
  createWanderer,
  living,
  startEncounter,
  type CombatState,
  type WandererSeed,
  WANDERER_ID,
  combatant,
} from './combat';
import { ally as lookupAlly } from './content/allies';
import { huskSpecies, BIND_YIELD } from './content/husks';
import { dealDraw, encounterSpoils, type DrawCard } from './draw';
import { rollEvent, WARDEN_DEPTH, type RiftEvent } from './encounter';
import { createRng } from './rng';
import type { AllyStance } from './types';

export type RunPhase = 'event' | 'combat' | 'draw' | 'ended';

export type RunEnding = 'completed' | 'retreated' | 'defeated' | null;

export interface RunAlly {
  id: string;
  level: number;
  stance: AllyStance;
}

export interface RunState {
  depth: number;
  phase: RunPhase;
  rngState: number;
  event: RiftEvent | null;
  combat: CombatState | null;
  /** Which Husk the player's next skill will hit. */
  targetId: string | null;
  draw: DrawCard[] | null;
  /** Unbanked. Forfeit on defeat, kept on retreat or completion. */
  pendingGold: number;
  pendingXp: number;
  /** Species bound during the run, granted when it ends safely. */
  pendingEchoes: string[];
  /** Carried between encounters - this is the push-your-luck. */
  hp: number;
  focus: number;
  wanderer: WandererSeed;
  allies: RunAlly[];
  ending: RunEnding;
  /** Lines shown for a non-combat step. */
  notice: string | null;
  /**
   * Everything learned this descent: Husk species id to a bitmask over
   * ELEMENTS of what has been tried against it. Accumulated across every fight
   * rather than read from the current one, or a ten-step run would only ever
   * teach you what happened in the last of them.
   */
  struck: Record<string, number>;
  /** Husk species met this descent, whether or not anything was tried. */
  met: string[];
}

export const MAX_DEPTH = WARDEN_DEPTH;

/** Health returned for clearing an encounter, as a fraction of the maximum. */
export const CLEAR_HEAL_FRACTION = 0.14;

function allyDefinitions(allies: RunAlly[]) {
  return allies.map((a) => ({
    definition: lookupAlly(a.id),
    level: a.level,
    stance: a.stance,
  }));
}

/** Start a descent and resolve its first step. */
export function beginRun(
  wanderer: WandererSeed,
  allies: RunAlly[],
  seed: number,
): RunState {
  const fresh = createWanderer(wanderer);
  const state: RunState = {
    depth: 1,
    phase: 'event',
    rngState: seed,
    event: null,
    combat: null,
    targetId: null,
    draw: null,
    pendingGold: 0,
    pendingXp: 0,
    pendingEchoes: [],
    hp: fresh.maxHp,
    focus: fresh.maxFocus,
    wanderer,
    allies,
    ending: null,
    notice: null,
    struck: {},
    met: [],
  };
  return stepInto(state);
}

/** Roll the current depth's event and set the phase it demands. */
export function stepInto(state: RunState): RunState {
  const rng = createRng(state.rngState);
  const event = rollEvent(state.depth, state.wanderer.level, rng);
  state.event = event;
  state.notice = null;
  state.draw = null;

  if (event.husks && event.husks.length > 0) {
    // The fight gets its own generator, drawn from the run's, so combat and
    // the descent cannot consume each other's sequence.
    const seed = (rng.next() * 0x1_0000_0000) | 0;
    state.rngState = rng.state();

    const combat = startEncounter({
      wanderer: state.wanderer,
      allies: allyDefinitions(state.allies),
      husks: event.husks,
      seed,
      ...(event.fleeAfterRound === undefined ? {} : { fleeAfterRound: event.fleeAfterRound }),
    });

    // HP and Focus carry across a descent; that is what makes going deeper a
    // decision rather than a formality.
    const self = combatant(combat, WANDERER_ID);
    if (self) {
      self.hp = Math.min(state.hp, self.maxHp);
      self.focus = Math.min(state.focus, self.maxFocus);
    }

    state.combat = advance(combat);
    state.targetId = living(state.combat, 'husks')[0]?.id ?? null;
    state.phase = 'combat';

    // Meeting something is enough to earn a codex entry; what it is weak to
    // still has to be found the hard way.
    for (const husk of event.husks) {
      if (!state.met.includes(husk.speciesId)) state.met.push(husk.speciesId);
    }

    // An ally can finish a weak pack before the player ever acts.
    if (state.combat.outcome !== 'ongoing') return settleCombat(state);
    return state;
  }

  state.rngState = rng.state();
  state.combat = null;
  state.phase = 'event';

  switch (event.kind) {
    case 'cache':
      state.pendingGold += event.gold ?? 0;
      state.notice = `You turn up ${event.gold} gold, unattended and unclaimed.`;
      break;
    case 'rest': {
      // Clamped to the Wanderer's own maxima, or a run could stockpile health
      // and Focus above what any fight would ever grant back.
      const ceiling = createWanderer(state.wanderer);
      const healed = Math.min(event.heal ?? 0, ceiling.maxHp - state.hp);
      const restored = Math.min(event.focus ?? 0, ceiling.maxFocus - state.focus);
      state.hp += healed;
      state.focus += restored;
      state.notice =
        healed > 0 || restored > 0
          ? `You rest. ${healed} health and ${restored} Focus return.`
          : 'You rest, though there was nothing left to recover.';
      break;
    }
    case 'negotiation':
      state.notice = null;
      break;
    default:
      state.notice = 'The passage is empty.';
  }
  return state;
}

/**
 * Fold a finished fight back into the run: bank the spoils, remember anything
 * bound, and decide whether the descent continues.
 */
export function settleCombat(state: RunState): RunState {
  const combat = state.combat;
  if (!combat || combat.outcome === 'ongoing') return state;

  const self = combatant(combat, WANDERER_ID);
  if (self) {
    state.hp = self.hp;
    state.focus = self.focus;
  }

  // Fold this fight's findings into the run's, before the CombatState is
  // replaced by the next encounter and takes its knowledge with it.
  for (const [speciesId, mask] of Object.entries(combat.struck)) {
    state.struck[speciesId] = (state.struck[speciesId] ?? 0) | mask;
  }

  if (combat.outcome === 'lost') {
    state.phase = 'ended';
    state.ending = 'defeated';
    // Unbanked gold is forfeit. XP and anything already bound are kept, so a
    // bad run still moves you forward.
    state.pendingGold = 0;
    return state;
  }

  if (combat.outcome === 'retreated') {
    state.phase = 'ended';
    state.ending = 'retreated';
    return state;
  }

  if (combat.outcome === 'won' || combat.outcome === 'fled') {
    const rng = createRng(state.rngState);

    /**
     * Clearing a step returns a little health.
     *
     * Without it a descent is pure attrition: every individual fight was
     * winnable at better than four in five, and yet whole runs reached the
     * bottom under one time in ten, because nothing ever gave any of it back.
     * Deliberately a fraction rather than a fixed amount, so it keeps pace
     * with the Wanderer instead of trivialising the early game.
     */
    if (combat.outcome === 'won') {
      const ceiling = createWanderer(state.wanderer);
      const mended = Math.round(ceiling.maxHp * CLEAR_HEAL_FRACTION);
      state.hp = Math.min(ceiling.maxHp, state.hp + mended);
    }

    if (combat.outcome === 'won' && state.event?.husks) {
      const spoils = encounterSpoils(
        state.event.husks.map((h) => ({
          rank: huskSpecies(h.speciesId).rank,
          level: h.level,
        })),
        rng,
      );
      state.pendingXp += spoils.xp;
      state.pendingGold += spoils.gold;
    }

    if (combat.boundSpeciesId) {
      const yielded = BIND_YIELD[combat.boundSpeciesId];
      if (yielded) state.pendingEchoes.push(yielded);
    }

    if (combat.wonByOnslaught) {
      state.draw = dealDraw(state.depth, rng);
      state.phase = 'draw';
    } else {
      state.phase = 'event';
    }
    state.rngState = rng.state();

    if (state.depth >= MAX_DEPTH && state.phase !== 'draw') {
      state.phase = 'ended';
      state.ending = 'completed';
    }
    return state;
  }

  return state;
}

/** Take one of the three cards. */
export function takeDrawCard(state: RunState, index: number): RunState {
  const card = state.draw?.[index];
  if (!card) return state;

  switch (card.kind) {
    case 'echo':
      state.pendingEchoes.push(card.speciesId);
      state.notice = `${card.name} joins you.`;
      break;
    case 'gold':
      state.pendingGold += card.amount;
      state.notice = `${card.amount} gold.`;
      break;
    case 'xp':
      state.pendingXp += card.amount;
      state.notice = `${card.amount} experience.`;
      break;
    case 'focus':
      state.focus += card.amount;
      state.notice = `${card.amount} Focus restored.`;
      break;
  }

  state.draw = null;
  state.phase = state.depth >= MAX_DEPTH ? 'ended' : 'event';
  if (state.phase === 'ended') state.ending = 'completed';
  return state;
}

export type OfferResult =
  | { ok: true; fromBanked: number }
  | { ok: false; reason: string };

/**
 * Accept a negotiation offer.
 *
 * Unbanked gold from this run is spent first; whatever is still owed comes
 * from the player's purse, and `fromBanked` tells the caller how much to
 * deduct there. Splitting it this way keeps the run state from going
 * negative and leaves one obvious place for the second write.
 */
export function acceptOffer(state: RunState, bankedGold: number): OfferResult {
  const event = state.event;
  if (event?.kind !== 'negotiation' || !event.offerSpeciesId) {
    return { ok: false, reason: 'There is nothing on offer here.' };
  }

  const cost = event.offerCost ?? 0;
  if (bankedGold + state.pendingGold < cost) {
    return { ok: false, reason: `You are short. It wants ${cost} gold.` };
  }

  const fromPending = Math.min(state.pendingGold, cost);
  const fromBanked = cost - fromPending;

  state.pendingGold -= fromPending;
  state.pendingEchoes.push(event.offerSpeciesId);
  state.notice = 'It agrees, on terms it considers generous.';
  // The offer is spent; the step becomes an ordinary empty passage.
  state.event = { kind: 'negotiation' };
  return { ok: true, fromBanked };
}

/** Move one step deeper. */
export function descend(state: RunState): RunState {
  if (state.phase === 'ended') return state;
  if (state.depth >= MAX_DEPTH) {
    state.phase = 'ended';
    state.ending = 'completed';
    return state;
  }
  state.depth++;
  return stepInto(state);
}

/** Leave with everything banked. */
export function retreat(state: RunState): RunState {
  state.phase = 'ended';
  state.ending = 'retreated';
  return state;
}

/** Whether the run's rewards should actually be paid out. */
export function keepsSpoils(state: RunState): boolean {
  return state.ending === 'completed' || state.ending === 'retreated';
}
