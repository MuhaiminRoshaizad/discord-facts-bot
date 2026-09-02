/**
 * The skill catalogue.
 *
 * Every name here is original. The mechanics are unprotected; the naming is
 * not, so nothing borrows a syllable from anyone else's spell list.
 */

import type { Skill } from '../types';

const list: Skill[] = [
  // --- Strike -------------------------------------------------------------
  {
    id: 'strike',
    name: 'Strike',
    kind: 'damage',
    element: 'force',
    cost: 0,
    power: 22,
    description: 'A plain blow. Costs nothing, asks nothing.',
  },

  // --- Ember --------------------------------------------------------------
  {
    id: 'cinder',
    name: 'Cinder',
    kind: 'damage',
    element: 'ember',
    cost: 5,
    power: 30,
    description: 'A curl of flame at one target.',
  },
  {
    id: 'pyre',
    name: 'Pyre',
    kind: 'damage',
    element: 'ember',
    cost: 12,
    power: 52,
    description: 'Fire enough to read by.',
  },
  {
    id: 'conflagration',
    name: 'Conflagration',
    kind: 'damage',
    element: 'ember',
    cost: 20,
    power: 34,
    aoe: true,
    description: 'Fire across the whole rank.',
  },

  // --- Frost --------------------------------------------------------------
  {
    id: 'rime',
    name: 'Rime',
    kind: 'damage',
    element: 'frost',
    cost: 5,
    power: 30,
    description: 'Cold that settles before it bites.',
  },
  {
    id: 'hoarfrost',
    name: 'Hoarfrost',
    kind: 'damage',
    element: 'frost',
    cost: 12,
    power: 52,
    description: 'Cold sharp enough to split stone.',
  },
  {
    id: 'whiteout',
    name: 'Whiteout',
    kind: 'damage',
    element: 'frost',
    cost: 20,
    power: 34,
    aoe: true,
    description: 'Everything goes white, then quiet.',
  },

  // --- Arc ----------------------------------------------------------------
  {
    id: 'jolt',
    name: 'Jolt',
    kind: 'damage',
    element: 'arc',
    cost: 5,
    power: 30,
    description: 'A short, unkind spark.',
  },
  {
    id: 'arcflash',
    name: 'Arcflash',
    kind: 'damage',
    element: 'arc',
    cost: 12,
    power: 52,
    description: 'The air itself conducts.',
  },
  {
    id: 'thunderhead',
    name: 'Thunderhead',
    kind: 'damage',
    element: 'arc',
    cost: 20,
    power: 34,
    aoe: true,
    description: 'The whole rank earths through itself.',
  },

  // --- Gale ---------------------------------------------------------------
  {
    id: 'gust',
    name: 'Gust',
    kind: 'damage',
    element: 'gale',
    cost: 5,
    power: 30,
    description: 'Air with an edge on it.',
  },
  {
    id: 'squall',
    name: 'Squall',
    kind: 'damage',
    element: 'gale',
    cost: 12,
    power: 52,
    description: 'Wind that arrives all at once.',
  },
  {
    id: 'tempest',
    name: 'Tempest',
    kind: 'damage',
    element: 'gale',
    cost: 20,
    power: 34,
    aoe: true,
    description: 'Nothing in the rank stays standing willingly.',
  },

  // --- Radiance -----------------------------------------------------------
  {
    id: 'glimmer',
    name: 'Glimmer',
    kind: 'damage',
    element: 'radiance',
    cost: 6,
    power: 32,
    description: 'Light where light was not invited.',
  },
  {
    id: 'sunburst',
    name: 'Sunburst',
    kind: 'damage',
    element: 'radiance',
    cost: 14,
    power: 55,
    description: 'A small dawn, badly timed for the target.',
  },
  {
    id: 'daybreak',
    name: 'Daybreak',
    kind: 'damage',
    element: 'radiance',
    cost: 22,
    power: 36,
    aoe: true,
    description: 'Morning arrives whether the rank is ready or not.',
  },

  // --- Blight -------------------------------------------------------------
  {
    id: 'wither',
    name: 'Wither',
    kind: 'damage',
    element: 'blight',
    cost: 6,
    power: 32,
    description: 'Something goes out of the target.',
  },
  {
    id: 'rot',
    name: 'Rot',
    kind: 'damage',
    element: 'blight',
    cost: 14,
    power: 55,
    description: 'Decay, hurried along.',
  },
  {
    id: 'miasma',
    name: 'Miasma',
    kind: 'damage',
    element: 'blight',
    cost: 22,
    power: 36,
    aoe: true,
    description: 'The whole rank breathes it in.',
  },

  // --- Force --------------------------------------------------------------
  {
    id: 'cleave',
    name: 'Cleave',
    kind: 'damage',
    element: 'force',
    cost: 4,
    power: 33,
    description: 'Weight applied precisely.',
  },
  {
    id: 'sunder',
    name: 'Sunder',
    kind: 'damage',
    element: 'force',
    cost: 11,
    power: 56,
    description: 'Weight applied without precision, and rather more of it.',
  },
  {
    id: 'shatter',
    name: 'Shatter',
    kind: 'damage',
    element: 'force',
    cost: 19,
    power: 36,
    aoe: true,
    description: 'The floor takes some of it too.',
  },

  // --- Restoration --------------------------------------------------------
  {
    id: 'mend',
    name: 'Mend',
    kind: 'heal',
    element: 'radiance',
    cost: 8,
    power: 34,
    description: 'Closes what is open.',
  },
  {
    id: 'restore',
    name: 'Restore',
    kind: 'heal',
    element: 'radiance',
    cost: 16,
    power: 62,
    description: 'Closes rather more.',
  },
  {
    id: 'renewal',
    name: 'Renewal',
    kind: 'heal',
    element: 'radiance',
    cost: 26,
    power: 38,
    party: true,
    description: 'The whole party remembers how to stand.',
  },

  // --- Buffs --------------------------------------------------------------
  {
    id: 'whet',
    name: 'Whet',
    kind: 'buff',
    element: 'force',
    cost: 7,
    stat: 'atk',
    stages: 1,
    spread: true,
    description: 'The party hits harder for a while.',
  },
  {
    id: 'bulwark',
    name: 'Bulwark',
    kind: 'buff',
    element: 'force',
    cost: 7,
    stat: 'def',
    stages: 1,
    spread: true,
    description: 'The party takes less for a while.',
  },
  {
    id: 'quicken',
    name: 'Quicken',
    kind: 'buff',
    element: 'gale',
    cost: 7,
    stat: 'spd',
    stages: 1,
    spread: true,
    description: 'The party moves first more often.',
  },

  // --- Debuffs ------------------------------------------------------------
  {
    id: 'blunt',
    name: 'Blunt',
    kind: 'debuff',
    element: 'blight',
    cost: 7,
    stat: 'atk',
    stages: -1,
    spread: true,
    description: 'Their blows lose conviction.',
  },
  {
    id: 'fracture',
    name: 'Fracture',
    kind: 'debuff',
    element: 'force',
    cost: 7,
    stat: 'def',
    stages: -1,
    spread: true,
    description: 'Their guard develops opinions of its own.',
  },
  {
    id: 'ebb',
    name: 'Ebb',
    kind: 'debuff',
    element: 'frost',
    cost: 7,
    stat: 'spd',
    stages: -1,
    spread: true,
    description: 'They arrive late to their own turn.',
  },
];

export const SKILLS: ReadonlyMap<string, Skill> = new Map(list.map((s) => [s.id, s]));

export const ALL_SKILLS: readonly Skill[] = list;

export function skill(id: string): Skill {
  const found = SKILLS.get(id);
  if (!found) throw new Error(`unknown skill: ${id}`);
  return found;
}

/** The free basic attack every combatant always has. */
export const STRIKE = skill('strike');
