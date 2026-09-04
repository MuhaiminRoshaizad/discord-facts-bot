/**
 * What a Rift puts in front of you.
 *
 * Each step rolls a weighted table that shifts with depth: trash thins out,
 * elites and Rares thicken, and depth 10 is always the Warden. The roll is
 * driven by the run's own RNG, so a whole descent is reproducible from its
 * seed.
 */

import { husksOfRank } from './content/husks';
import { ALL_ECHO_SPECIES } from './content/echoes';
import type { Rng } from './rng';

export const WARDEN_DEPTH = 10;

/** Rare Husks abandon the fight after this many rounds. */
export const RARE_FLEE_ROUND = 3;

export type RiftEventKind =
  | 'lesser'
  | 'greater'
  | 'rare'
  | 'warden'
  | 'cache'
  | 'rest'
  | 'negotiation';

export interface RiftHusk {
  speciesId: string;
  level: number;
}

export interface RiftEvent {
  kind: RiftEventKind;
  /** Combat events only. */
  husks?: RiftHusk[];
  fleeAfterRound?: number;
  /** Cache only. */
  gold?: number;
  /** Wanderer's Rest only. */
  focus?: number;
  heal?: number;
  /** Negotiation only. */
  offerSpeciesId?: string;
  offerCost?: number;
}

/**
 * How strong the things at this depth are.
 *
 * Never above the Wanderer. The old curve put Husks at level 19 against a
 * level 16 player at the bottom of a Rift, which combined with their scaling
 * made the Warden mathematically unbeatable.
 */
export function huskLevelFor(wandererLevel: number, depth: number): number {
  const level = Math.round(wandererLevel * 0.7 + depth * 0.35);
  return Math.max(1, Math.min(wandererLevel, level));
}

/**
 * How many Lesser Husks turn up at once.
 *
 * Three of them on the first step of a first run, against someone holding a
 * single Echo, is not a difficulty curve - it is a wall.
 */
export function packSizeAt(depth: number, rng: Rng): number {
  if (depth <= 1) return 1;
  if (depth <= 3) return rng.int(1, 2);
  return rng.int(1, 3);
}

interface Weighted {
  kind: Exclude<RiftEventKind, 'warden'>;
  weight: number;
}

/**
 * Table weights at a given depth. Deeper means fewer packs of trash and more
 * of everything worth stopping for.
 */
export function tableAt(depth: number, wandererLevel = 99): Weighted[] {
  // Rank matters more than level: a "level one" Forgemaw is still a 140-health
  // elite, so scaling alone never made one fair against a new Wanderer. Elites
  // are gated on the player as well as the depth, and simply do not appear
  // until there is something that can trade with them.
  const elites = depth >= 3 && wandererLevel >= 4;
  const rares = depth >= 4 && wandererLevel >= 6;

  return [
    { kind: 'lesser', weight: Math.max(25, 60 - depth * 3) },
    { kind: 'greater', weight: elites ? (depth - 2) * 7 : 0 },
    { kind: 'cache', weight: 10 },
    { kind: 'rest', weight: 8 },
    { kind: 'negotiation', weight: 5 },
    { kind: 'rare', weight: rares ? (depth - 3) * 1.6 : 0 },
  ];
}

function pickSpecies(rank: Parameters<typeof husksOfRank>[0], rng: Rng): string {
  const candidates = husksOfRank(rank);
  if (candidates.length === 0) throw new Error(`no husk of rank ${rank}`);
  return rng.pick(candidates).id;
}

/** Roll one step of a descent. */
export function rollEvent(depth: number, wandererLevel: number, rng: Rng): RiftEvent {
  const level = huskLevelFor(wandererLevel, depth);

  if (depth >= WARDEN_DEPTH) {
    return {
      kind: 'warden',
      husks: [{ speciesId: pickSpecies('warden', rng), level }],
    };
  }

  // The step before the Warden is always a breather. Ten steps of attrition
  // followed immediately by a boss is a wall dressed up as a climax.
  if (depth === WARDEN_DEPTH - 1) {
    return { kind: 'rest', focus: 40 + depth * 4, heal: 45 + depth * 6 };
  }

  const chosen = rng.weighted(tableAt(depth, wandererLevel), (entry) => entry.weight);

  switch (chosen.kind) {
    case 'lesser': {
      const count = packSizeAt(depth, rng);
      return {
        kind: 'lesser',
        husks: Array.from({ length: count }, () => ({
          speciesId: pickSpecies('lesser', rng),
          level,
        })),
      };
    }

    case 'greater':
      return {
        kind: 'greater',
        husks: [{ speciesId: pickSpecies('greater', rng), level }],
      };

    case 'rare':
      return {
        kind: 'rare',
        husks: [{ speciesId: pickSpecies('rare', rng), level }],
        fleeAfterRound: RARE_FLEE_ROUND,
      };

    case 'cache':
      return { kind: 'cache', gold: rng.int(20, 60) + depth * 8 };

    case 'rest':
      return {
        kind: 'rest',
        focus: rng.int(15, 30) + depth * 2,
        heal: rng.int(20, 38) + depth * 3,
      };

    case 'negotiation': {
      // Only the plainer Echoes turn up willing to be talked to.
      const offerable = ALL_ECHO_SPECIES.filter((species) => species.rarity <= 2);
      const offer = rng.pick(offerable);
      return {
        kind: 'negotiation',
        offerSpeciesId: offer.id,
        offerCost: 40 + offer.rarity * 35 + depth * 10,
      };
    }
  }
}

export const EVENT_TITLE: Record<RiftEventKind, string> = {
  lesser: 'Husks',
  greater: 'A Greater Husk',
  rare: 'Something Gilded',
  warden: 'The Warden',
  cache: 'A Cache',
  rest: "A Wanderer's Rest",
  negotiation: 'Something Willing To Talk',
};
