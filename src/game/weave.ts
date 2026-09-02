/**
 * Weaving - two Echoes consumed, one produced.
 *
 * Deliberately deterministic. The player is shown a preview and asked to
 * confirm a destructive act, so the result must be exactly what the preview
 * promised; rolling it at commit time would make the confirmation a lie.
 */

import { ALL_ECHO_SPECIES, echoSpecies, skillsAtLevel } from './content/echoes';
import { weaveSuit } from './content/suits';
import { MAX_LEVEL } from './progression';
import type { EchoSpecies } from './types';

export interface WeaveInput {
  /** The database row id, so callers know which two to consume. */
  rowId: string;
  speciesId: string;
  level: number;
}

export interface WeaveOutcome {
  speciesId: string;
  name: string;
  level: number;
  /** Skills carried over from the parents, capped at two. */
  inheritedSkillIds: string[];
  consumes: [string, string];
}

export type WeavePreview =
  | { ok: true; outcome: WeaveOutcome }
  | { ok: false; reason: string };

/** Skills a result of this species and level would know unaided. */
function nativeSkills(species: EchoSpecies, level: number): Set<string> {
  return new Set(skillsAtLevel(species, level));
}

/**
 * Pick the species that a weave lands on.
 *
 * The suit comes from the wheel; within it, the result is the species whose
 * rarity sits closest to one above the parents' average - so weaving trades
 * two ordinary Echoes for one better than either, without ever handing over
 * the rarest thing in the suit for free.
 */
function resultSpecies(a: EchoSpecies, b: EchoSpecies): EchoSpecies | undefined {
  const suit = weaveSuit(a.suit, b.suit);
  const target = Math.min(5, Math.round((a.rarity + b.rarity) / 2) + 1);

  const candidates = ALL_ECHO_SPECIES.filter((species) => species.suit === suit);
  if (candidates.length === 0) return undefined;

  return candidates.reduce((best, species) => {
    const bestGap = Math.abs(best.rarity - target);
    const gap = Math.abs(species.rarity - target);
    // Ties break towards the lower rarity, and then by id, so the result is
    // stable no matter what order the catalogue happens to be in.
    if (gap !== bestGap) return gap < bestGap ? species : best;
    if (species.rarity !== best.rarity) return species.rarity < best.rarity ? species : best;
    return species.id < best.id ? species : best;
  });
}

/**
 * What weaving these two would produce, or why it cannot be done.
 * `wandererLevel` gates the result - the rule that stops early runaway power.
 */
export function previewWeave(
  a: WeaveInput,
  b: WeaveInput,
  wandererLevel: number,
): WeavePreview {
  if (a.rowId === b.rowId) {
    return { ok: false, reason: 'An Echo cannot be woven with itself.' };
  }

  const speciesA = echoSpecies(a.speciesId);
  const speciesB = echoSpecies(b.speciesId);

  const result = resultSpecies(speciesA, speciesB);
  if (!result) return { ok: false, reason: 'Nothing answers that pairing.' };

  const level = Math.min(
    MAX_LEVEL,
    Math.floor((a.level + b.level) / 2) + 1,
  );

  if (level > wandererLevel) {
    return {
      ok: false,
      reason: `That would produce a level ${level} Echo, and you are level ${wandererLevel}. Weaving cannot outpace its weaver.`,
    };
  }

  // Only skills the result would not already have are worth inheriting.
  const native = nativeSkills(result, level);
  const inheritedSkillIds = [
    ...new Set([...skillsAtLevel(speciesA, a.level), ...skillsAtLevel(speciesB, b.level)]),
  ]
    .filter((id) => !native.has(id))
    .sort()
    .slice(0, 2);

  return {
    ok: true,
    outcome: {
      speciesId: result.id,
      name: result.name,
      level,
      inheritedSkillIds,
      consumes: [a.rowId, b.rowId],
    },
  };
}
