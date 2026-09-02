/**
 * Element versus affinity.
 *
 * This is the pivot the whole game turns on. Your active Echo supplies your
 * skills *and* your affinity table, so swapping to exploit an enemy's weakness
 * hands them one of yours. Weakness-hunting is never free.
 */

import type { Affinity, AffinityTable, Element } from './types';

export const AFFINITY_MULTIPLIER: Record<Affinity, number> = {
  weak: 1.75,
  neutral: 1,
  resist: 0.5,
  null: 0,
  repel: 1,
  drain: 1,
};

export interface AffinityOutcome {
  affinity: Affinity;
  /** Applied to raw damage before rounding. */
  multiplier: number;
  /** Damage lands on the attacker instead, resolved against its own table. */
  reflected: boolean;
  /** Damage heals the target instead of hurting it. */
  absorbed: boolean;
  /**
   * The hit knocks the target down. Only a *fresh* knockdown grants Second
   * Wind - combat.ts owns that check, because it is the rule that stops
   * chains running forever.
   */
  downs: boolean;
}

/** An element absent from the table is neutral. */
export function affinityOf(table: AffinityTable, element: Element): Affinity {
  return table[element] ?? 'neutral';
}

/**
 * How an attack of `element` lands against `table`.
 *
 * `veiled` suppresses weaknesses without touching anything else, which is how
 * a Warden holds its guard until the Veil breaks: a weakness is downgraded to
 * neutral rather than the whole table being replaced.
 */
export function resolveAffinity(
  table: AffinityTable,
  element: Element,
  veiled = false,
): AffinityOutcome {
  const raw = affinityOf(table, element);
  const affinity: Affinity = veiled && raw === 'weak' ? 'neutral' : raw;

  return {
    affinity,
    multiplier: AFFINITY_MULTIPLIER[affinity],
    reflected: affinity === 'repel',
    absorbed: affinity === 'drain',
    downs: affinity === 'weak',
  };
}

/**
 * Whether the hit counts towards breaking a Warden's Veil. Resisted, nulled,
 * repelled and drained hits do not - the Veil only yields to attacks that
 * actually connect.
 */
export function breaksVeil(outcome: AffinityOutcome): boolean {
  return outcome.affinity === 'neutral' || outcome.affinity === 'weak';
}

/** Symbols used in combat logs and the codex. */
export const AFFINITY_LABEL: Record<Affinity, string> = {
  weak: 'Weak',
  neutral: '-',
  resist: 'Resist',
  null: 'Null',
  repel: 'Repel',
  drain: 'Drain',
};

export const ELEMENT_LABEL: Record<Element, string> = {
  ember: 'Ember',
  frost: 'Frost',
  arc: 'Arc',
  gale: 'Gale',
  radiance: 'Radiance',
  blight: 'Blight',
  force: 'Force',
};

export const ELEMENT_EMOJI: Record<Element, string> = {
  ember: '\u{1F525}',
  frost: '\u{2744}',
  arc: '\u{26A1}',
  gale: '\u{1F32C}',
  radiance: '\u{2600}',
  blight: '\u{2620}',
  force: '\u{1F44A}',
};
