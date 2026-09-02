/**
 * Allies.
 *
 * Each is bound to exactly one Echo, permanently. Only the Wanderer is
 * Unbound, and that asymmetry is what makes the player the protagonist rather
 * than one more member of the party.
 */

import type { AllyDefinition } from '../types';

const list: AllyDefinition[] = [
  {
    id: 'rell',
    name: 'Rell',
    role: 'striker',
    echoSpeciesId: 'cinderfen',
    unlockLevel: 3,
    lore: 'Went into the first Rift on a dare and has never satisfactorily explained why they went back into the second.',
  },
  {
    id: 'ives',
    name: 'Ives',
    role: 'mender',
    echoSpeciesId: 'lumen',
    unlockLevel: 5,
    lore: 'Keeps a ledger of everyone they have put back together. It is not a short ledger and they will not show it to you.',
  },
  {
    id: 'quill',
    name: 'Quill',
    role: 'breaker',
    echoSpeciesId: 'veilwisp',
    unlockLevel: 7,
    lore: 'Talks throughout. Most of it turns out afterwards to have been useful, which is the irritating part.',
  },
];

export const ALLIES: ReadonlyMap<string, AllyDefinition> = new Map(
  list.map((ally) => [ally.id, ally]),
);

export const ALL_ALLIES: readonly AllyDefinition[] = list;

export function ally(id: string): AllyDefinition {
  const found = ALLIES.get(id);
  if (!found) throw new Error(`unknown ally: ${id}`);
  return found;
}

/** How many Allies may be taken into a Rift. */
export const PARTY_ALLY_LIMIT = 2;
