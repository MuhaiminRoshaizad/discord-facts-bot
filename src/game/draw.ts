/**
 * The Draw, and the spoils of a fight.
 *
 * Three face-down cards, offered only after a win by Onslaught. Gating it
 * that way means the card draw rewards playing the combat system properly
 * rather than merely turning up.
 */

import { ALL_ECHO_SPECIES } from './content/echoes';
import { encounterXp } from './progression';
import type { Rng } from './rng';
import type { HuskRank } from './types';

export const DRAW_CARDS = 3;

export type DrawCard =
  | { kind: 'echo'; speciesId: string; name: string }
  | { kind: 'gold'; amount: number }
  | { kind: 'xp'; amount: number }
  | { kind: 'focus'; amount: number };

const GOLD_PER_LEVEL_BY_RANK: Record<HuskRank, number> = {
  lesser: 6,
  greater: 22,
  rare: 160,
  warden: 90,
};

/** Gold awarded for defeating one Husk. */
export function encounterGold(rank: HuskRank, huskLevel: number, rng: Rng): number {
  const base = GOLD_PER_LEVEL_BY_RANK[rank] * Math.max(1, huskLevel);
  return Math.max(1, Math.round(base * (0.85 + rng.next() * 0.3)));
}

export interface Spoils {
  xp: number;
  gold: number;
}

/** Everything a cleared encounter pays out, before The Draw. */
export function encounterSpoils(
  husks: { rank: HuskRank; level: number }[],
  rng: Rng,
): Spoils {
  let xp = 0;
  let gold = 0;
  for (const husk of husks) {
    xp += encounterXp(husk.rank, husk.level);
    gold += encounterGold(husk.rank, husk.level, rng);
  }
  return { xp, gold };
}

/**
 * Deal three cards. An Echo is the prize worth having, so it is the scarcest
 * of the four faces and its rarity is bounded by how deep the run has gone -
 * otherwise the first Onslaught of a first run could hand over the best Echo
 * in the game.
 */
export function dealDraw(depth: number, rng: Rng): DrawCard[] {
  const rarityCeiling = Math.max(1, Math.min(5, 1 + Math.floor(depth / 2)));
  const offerable = ALL_ECHO_SPECIES.filter((species) => species.rarity <= rarityCeiling);

  const faces = [
    { kind: 'echo' as const, weight: 22 },
    { kind: 'gold' as const, weight: 30 },
    { kind: 'xp' as const, weight: 28 },
    { kind: 'focus' as const, weight: 20 },
  ];

  const cards: DrawCard[] = [];
  for (let i = 0; i < DRAW_CARDS; i++) {
    const face = rng.weighted(faces, (entry) => entry.weight);
    switch (face.kind) {
      case 'echo': {
        const species = rng.pick(offerable);
        cards.push({ kind: 'echo', speciesId: species.id, name: species.name });
        break;
      }
      case 'gold':
        cards.push({ kind: 'gold', amount: rng.int(30, 90) + depth * 12 });
        break;
      case 'xp':
        cards.push({ kind: 'xp', amount: rng.int(40, 110) + depth * 20 });
        break;
      case 'focus':
        cards.push({ kind: 'focus', amount: rng.int(12, 30) + depth * 2 });
        break;
    }
  }
  return cards;
}

export function describeCard(card: DrawCard): string {
  switch (card.kind) {
    case 'echo':
      return `${card.name} joins you.`;
    case 'gold':
      return `${card.amount} gold.`;
    case 'xp':
      return `${card.amount} experience.`;
    case 'focus':
      return `${card.amount} Focus restored.`;
  }
}
