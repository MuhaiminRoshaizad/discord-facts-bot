/**
 * The Echo catalogue.
 *
 * An Echo lends its wielder skills *and* its affinity table, so every entry is
 * a trade: the Echo that answers one weakness opens another. Nothing here is
 * a balanced roster yet - it is a playable one.
 */

import type { EchoSpecies } from '../types';

const list: EchoSpecies[] = [
  // --- Tide ---------------------------------------------------------------
  {
    id: 'selkra',
    name: 'Selkra',
    suit: 'tide',
    rarity: 1,
    stats: { atk: 2, def: 2, spd: 3 },
    hpBonus: 6,
    focusBonus: 4,
    affinities: { frost: 'resist', arc: 'weak' },
    learnset: [
      { level: 1, skillId: 'rime' },
      { level: 4, skillId: 'mend' },
      { level: 9, skillId: 'hoarfrost' },
    ],
    lore: 'Sheds its skin at the waterline and forgets, each time, which shape it started in.',
  },
  {
    id: 'brinemote',
    name: 'Brinemote',
    suit: 'tide',
    rarity: 1,
    stats: { atk: 1, def: 3, spd: 2 },
    hpBonus: 10,
    focusBonus: 2,
    affinities: { frost: 'resist', ember: 'resist', arc: 'weak' },
    learnset: [
      { level: 1, skillId: 'rime' },
      { level: 6, skillId: 'bulwark' },
    ],
    lore: 'A held breath with opinions.',
  },
  {
    id: 'undertow',
    name: 'Undertow',
    suit: 'tide',
    rarity: 4,
    stats: { atk: 7, def: 5, spd: 6 },
    hpBonus: 22,
    focusBonus: 14,
    affinities: { frost: 'drain', ember: 'resist', arc: 'weak', gale: 'resist' },
    learnset: [
      { level: 1, skillId: 'hoarfrost' },
      { level: 12, skillId: 'whiteout' },
      { level: 18, skillId: 'ebb' },
    ],
    lore: 'Patient. Does not pull you under so much as wait for you to stop swimming.',
  },

  // --- Ash ----------------------------------------------------------------
  {
    id: 'emberkin',
    name: 'Emberkin',
    suit: 'ash',
    rarity: 1,
    stats: { atk: 3, def: 1, spd: 2 },
    hpBonus: 4,
    focusBonus: 5,
    affinities: { ember: 'resist', frost: 'weak' },
    learnset: [
      { level: 1, skillId: 'cinder' },
      { level: 7, skillId: 'whet' },
    ],
    lore: 'What is left in the grate that still thinks of itself as the fire.',
  },
  {
    id: 'cinderfen',
    name: 'Cinderfen',
    suit: 'ash',
    rarity: 2,
    stats: { atk: 5, def: 2, spd: 3 },
    hpBonus: 8,
    focusBonus: 8,
    affinities: { ember: 'null', frost: 'weak', blight: 'resist' },
    learnset: [
      { level: 1, skillId: 'cinder' },
      { level: 8, skillId: 'pyre' },
    ],
    lore: 'Burnt ground that never cooled, and has grown territorial about it.',
  },
  {
    id: 'pyrelock',
    name: 'Pyrelock',
    suit: 'ash',
    rarity: 4,
    stats: { atk: 9, def: 3, spd: 5 },
    hpBonus: 16,
    focusBonus: 18,
    affinities: { ember: 'drain', frost: 'weak', radiance: 'resist' },
    learnset: [
      { level: 1, skillId: 'pyre' },
      { level: 14, skillId: 'conflagration' },
    ],
    lore: 'Keeps a fire the way a jailer keeps a prisoner, and with the same fondness.',
  },

  // --- Hollow -------------------------------------------------------------
  {
    id: 'gauntling',
    name: 'Gauntling',
    suit: 'hollow',
    rarity: 1,
    stats: { atk: 2, def: 2, spd: 3 },
    hpBonus: 4,
    focusBonus: 4,
    affinities: { blight: 'resist', radiance: 'weak' },
    learnset: [
      { level: 1, skillId: 'wither' },
      { level: 6, skillId: 'blunt' },
    ],
    lore: 'Thin in a way that has nothing to do with its diet.',
  },
  {
    id: 'hollowmark',
    name: 'Hollowmark',
    suit: 'hollow',
    rarity: 3,
    stats: { atk: 6, def: 3, spd: 5 },
    hpBonus: 12,
    focusBonus: 12,
    affinities: { blight: 'drain', radiance: 'weak', force: 'resist' },
    learnset: [
      { level: 1, skillId: 'wither' },
      { level: 10, skillId: 'rot' },
      { level: 16, skillId: 'blunt' },
    ],
    lore: 'A shape left behind by something that was standing there for a very long time.',
  },
  {
    id: 'nullspire',
    name: 'Nullspire',
    suit: 'hollow',
    rarity: 5,
    stats: { atk: 10, def: 8, spd: 6 },
    hpBonus: 28,
    focusBonus: 24,
    affinities: {
      blight: 'drain',
      force: 'null',
      radiance: 'weak',
      ember: 'resist',
      frost: 'resist',
    },
    learnset: [
      { level: 1, skillId: 'rot' },
      { level: 20, skillId: 'miasma' },
      { level: 26, skillId: 'fracture' },
    ],
    lore: 'Tall, quiet, and absent in a manner that is difficult to argue with.',
  },

  // --- Verdant ------------------------------------------------------------
  {
    id: 'thornlet',
    name: 'Thornlet',
    suit: 'verdant',
    rarity: 1,
    stats: { atk: 2, def: 3, spd: 2 },
    hpBonus: 8,
    focusBonus: 3,
    affinities: { gale: 'resist', ember: 'weak' },
    learnset: [
      { level: 1, skillId: 'gust' },
      { level: 6, skillId: 'mend' },
    ],
    lore: 'Small and entirely made of objections.',
  },
  {
    id: 'verdance',
    name: 'Verdance',
    suit: 'verdant',
    rarity: 2,
    stats: { atk: 3, def: 4, spd: 4 },
    hpBonus: 12,
    focusBonus: 9,
    affinities: { gale: 'null', ember: 'weak', frost: 'resist' },
    learnset: [
      { level: 1, skillId: 'gust' },
      { level: 8, skillId: 'mend' },
      { level: 13, skillId: 'squall' },
    ],
    lore: 'Growth with somewhere specific to be.',
  },
  {
    id: 'grovewarden',
    name: 'Grovewarden',
    suit: 'verdant',
    rarity: 4,
    stats: { atk: 6, def: 8, spd: 4 },
    hpBonus: 26,
    focusBonus: 16,
    affinities: { gale: 'drain', ember: 'weak', force: 'resist', blight: 'resist' },
    learnset: [
      { level: 1, skillId: 'squall' },
      { level: 14, skillId: 'restore' },
      { level: 19, skillId: 'bulwark' },
    ],
    lore: 'Has been standing here longer than the Rift has, and resents the intrusion.',
  },

  // --- Iron ---------------------------------------------------------------
  {
    id: 'rivet',
    name: 'Rivet',
    suit: 'iron',
    rarity: 1,
    stats: { atk: 3, def: 3, spd: 1 },
    hpBonus: 10,
    focusBonus: 2,
    affinities: { force: 'resist', arc: 'weak' },
    learnset: [
      { level: 1, skillId: 'cleave' },
      { level: 7, skillId: 'bulwark' },
    ],
    lore: 'Holds two things together and considers that a complete philosophy.',
  },
  {
    id: 'slagheart',
    name: 'Slagheart',
    suit: 'iron',
    rarity: 3,
    stats: { atk: 7, def: 6, spd: 2 },
    hpBonus: 20,
    focusBonus: 8,
    affinities: { force: 'null', ember: 'resist', arc: 'weak' },
    learnset: [
      { level: 1, skillId: 'cleave' },
      { level: 10, skillId: 'sunder' },
      { level: 15, skillId: 'fracture' },
    ],
    lore: 'What the forge could not use, and could not quite throw away.',
  },
  {
    id: 'aegisborn',
    name: 'Aegisborn',
    suit: 'iron',
    rarity: 5,
    stats: { atk: 9, def: 11, spd: 3 },
    hpBonus: 34,
    focusBonus: 14,
    affinities: { force: 'repel', ember: 'resist', frost: 'resist', arc: 'weak' },
    learnset: [
      { level: 1, skillId: 'sunder' },
      { level: 20, skillId: 'shatter' },
      { level: 25, skillId: 'bulwark' },
    ],
    lore: 'Was a shield first and a creature second, and has never fully agreed to the order.',
  },

  // --- Veil ---------------------------------------------------------------
  {
    id: 'shroudlet',
    name: 'Shroudlet',
    suit: 'veil',
    rarity: 1,
    stats: { atk: 2, def: 1, spd: 4 },
    hpBonus: 3,
    focusBonus: 6,
    affinities: { arc: 'resist', radiance: 'weak' },
    learnset: [
      { level: 1, skillId: 'jolt' },
      { level: 6, skillId: 'ebb' },
    ],
    lore: 'Mostly edge, very little middle.',
  },
  {
    id: 'veilwisp',
    name: 'Veilwisp',
    suit: 'veil',
    rarity: 2,
    stats: { atk: 4, def: 2, spd: 6 },
    hpBonus: 6,
    focusBonus: 11,
    affinities: { arc: 'drain', radiance: 'weak', force: 'resist' },
    learnset: [
      { level: 1, skillId: 'jolt' },
      { level: 9, skillId: 'arcflash' },
      { level: 14, skillId: 'ebb' },
    ],
    lore: 'Moves the way a rumour moves.',
  },
  {
    id: 'palewatch',
    name: 'Palewatch',
    suit: 'veil',
    rarity: 4,
    stats: { atk: 8, def: 4, spd: 9 },
    hpBonus: 14,
    focusBonus: 22,
    affinities: { arc: 'drain', gale: 'resist', radiance: 'weak', blight: 'resist' },
    learnset: [
      { level: 1, skillId: 'arcflash' },
      { level: 15, skillId: 'thunderhead' },
      { level: 21, skillId: 'quicken' },
    ],
    lore: 'Has been observing for some time and has not yet said what it is observing for.',
  },

  // --- Dawn ---------------------------------------------------------------
  {
    id: 'lumen',
    name: 'Lumen',
    suit: 'dawn',
    rarity: 1,
    stats: { atk: 2, def: 2, spd: 3 },
    hpBonus: 5,
    focusBonus: 6,
    affinities: { radiance: 'resist', blight: 'weak' },
    learnset: [
      { level: 1, skillId: 'glimmer' },
      { level: 5, skillId: 'mend' },
    ],
    lore: 'Small, warm, and unreasonably certain that things will be fine.',
  },
  {
    id: 'dawnmoth',
    name: 'Dawnmoth',
    suit: 'dawn',
    rarity: 2,
    stats: { atk: 4, def: 2, spd: 5 },
    hpBonus: 8,
    focusBonus: 12,
    affinities: { radiance: 'drain', blight: 'weak', frost: 'resist' },
    learnset: [
      { level: 1, skillId: 'glimmer' },
      { level: 9, skillId: 'sunburst' },
      { level: 14, skillId: 'restore' },
    ],
    lore: 'Arrives at the wrong hour and insists it is the right one.',
  },
  {
    id: 'sunwrack',
    name: 'Sunwrack',
    suit: 'dawn',
    rarity: 5,
    stats: { atk: 11, def: 5, spd: 7 },
    hpBonus: 20,
    focusBonus: 28,
    affinities: { radiance: 'drain', blight: 'weak', ember: 'resist', frost: 'resist' },
    learnset: [
      { level: 1, skillId: 'sunburst' },
      { level: 20, skillId: 'daybreak' },
      { level: 27, skillId: 'renewal' },
    ],
    lore: 'A morning that came in too hard and broke something on the way.',
  },

  // --- Mire ---------------------------------------------------------------
  {
    id: 'sludgemote',
    name: 'Sludgemote',
    suit: 'mire',
    rarity: 1,
    stats: { atk: 2, def: 3, spd: 1 },
    hpBonus: 9,
    focusBonus: 4,
    affinities: { blight: 'resist', radiance: 'weak', force: 'resist' },
    learnset: [
      { level: 1, skillId: 'wither' },
      { level: 7, skillId: 'ebb' },
    ],
    lore: 'Unhurried. Everything reaches it eventually.',
  },
  {
    id: 'bogwreath',
    name: 'Bogwreath',
    suit: 'mire',
    rarity: 3,
    stats: { atk: 6, def: 5, spd: 3 },
    hpBonus: 18,
    focusBonus: 12,
    affinities: { blight: 'drain', gale: 'resist', radiance: 'weak', ember: 'weak' },
    learnset: [
      { level: 1, skillId: 'rot' },
      { level: 12, skillId: 'blunt' },
      { level: 17, skillId: 'miasma' },
    ],
    lore: 'Grew around whatever it was that stopped here, and kept the shape.',
  },

  // --- Storm --------------------------------------------------------------
  {
    id: 'zephyrling',
    name: 'Zephyrling',
    suit: 'storm',
    rarity: 1,
    stats: { atk: 2, def: 1, spd: 5 },
    hpBonus: 3,
    focusBonus: 5,
    affinities: { gale: 'resist', arc: 'resist', force: 'weak' },
    learnset: [
      { level: 1, skillId: 'gust' },
      { level: 6, skillId: 'quicken' },
    ],
    lore: 'Has not stopped moving long enough to be described properly.',
  },
  {
    id: 'galecrest',
    name: 'Galecrest',
    suit: 'storm',
    rarity: 3,
    stats: { atk: 7, def: 3, spd: 8 },
    hpBonus: 12,
    focusBonus: 15,
    affinities: { gale: 'drain', arc: 'resist', force: 'weak' },
    learnset: [
      { level: 1, skillId: 'squall' },
      { level: 11, skillId: 'arcflash' },
      { level: 17, skillId: 'tempest' },
    ],
    lore: 'The part of the storm that arrives before the storm does.',
  },

  // --- Bone ---------------------------------------------------------------
  {
    id: 'marrowkin',
    name: 'Marrowkin',
    suit: 'bone',
    rarity: 1,
    stats: { atk: 3, def: 2, spd: 2 },
    hpBonus: 6,
    focusBonus: 3,
    affinities: { blight: 'resist', force: 'weak', radiance: 'weak' },
    learnset: [
      { level: 1, skillId: 'cleave' },
      { level: 7, skillId: 'wither' },
    ],
    lore: 'Rattles when it is thinking, which is often.',
  },
  {
    id: 'boneflute',
    name: 'Boneflute',
    suit: 'bone',
    rarity: 3,
    stats: { atk: 6, def: 4, spd: 6 },
    hpBonus: 14,
    focusBonus: 13,
    affinities: { blight: 'drain', gale: 'resist', force: 'weak', radiance: 'weak' },
    learnset: [
      { level: 1, skillId: 'wither' },
      { level: 11, skillId: 'ebb' },
      { level: 16, skillId: 'rot' },
    ],
    lore: 'Plays itself when the Rift draws breath. Nobody has asked it to stop twice.',
  },
];

export const ECHO_SPECIES: ReadonlyMap<string, EchoSpecies> = new Map(
  list.map((species) => [species.id, species]),
);

export const ALL_ECHO_SPECIES: readonly EchoSpecies[] = list;

export function echoSpecies(id: string): EchoSpecies {
  const found = ECHO_SPECIES.get(id);
  if (!found) throw new Error(`unknown echo species: ${id}`);
  return found;
}

/**
 * What a new Wanderer awakens with. One Echo, chosen from the plainest of
 * them - everything else in the game is earned.
 */
export const STARTER_ECHO_IDS: readonly string[] = [
  'selkra',
  'emberkin',
  'thornlet',
  'rivet',
  'lumen',
];

/** Skills an Echo knows at a given level. */
export function skillsAtLevel(species: EchoSpecies, level: number): string[] {
  return species.learnset
    .filter((entry) => entry.level <= level)
    .map((entry) => entry.skillId);
}
