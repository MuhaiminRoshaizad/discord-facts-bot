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
  /** Negotiation only. */
  offerSpeciesId?: string;
  offerCost?: number;
}

/** How strong the things at this depth are. */
export function huskLevelFor(wandererLevel: number, depth: number): number {
  return Math.max(1, Math.round(wandererLevel * 0.8 + depth * 0.6));
}

interface Weighted {
  kind: Exclude<RiftEventKind, 'warden'>;
  weight: number;
}

/**
 * Table weights at a given depth. Deeper means fewer packs of trash and more
 * of everything worth stopping for.
 */
export function tableAt(depth: number): Weighted[] {
  return [
    { kind: 'lesser', weight: Math.max(15, 55 - depth * 3) },
    { kind: 'greater', weight: 20 + depth * 2 },
    { kind: 'cache', weight: 10 },
    { kind: 'rest', weight: 7 },
    { kind: 'negotiation', weight: 5 },
    { kind: 'rare', weight: 3 + depth * 0.4 },
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

  const chosen = rng.weighted(tableAt(depth), (entry) => entry.weight);

  switch (chosen.kind) {
    case 'lesser': {
      const count = rng.int(1, 3);
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
      return { kind: 'rest', focus: rng.int(15, 30) + depth * 2 };

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
