/**
 * The Husk catalogue - what lives in the Rifts.
 *
 * Ranks read as: lesser (packs of trash), greater (elites), rare (rich, and
 * flees), warden (floor boss, weaknesses sealed behind a Veil).
 */

import type { HuskSpecies } from '../types';

const list: HuskSpecies[] = [
  // --- Lesser -------------------------------------------------------------
  {
    id: 'drifter',
    name: 'Drifter',
    suit: 'tide',
    rank: 'lesser',
    stats: { atk: 6, def: 4, spd: 5 },
    hp: 34,
    affinities: { arc: 'weak', frost: 'resist' },
    skillIds: ['strike', 'rime'],
    lore: 'Goes where it is taken and objects the whole way.',
  },
  {
    id: 'cinderhusk',
    name: 'Cinderhusk',
    suit: 'ash',
    rank: 'lesser',
    stats: { atk: 8, def: 3, spd: 5 },
    hp: 30,
    affinities: { frost: 'weak', ember: 'resist' },
    skillIds: ['strike', 'cinder'],
    lore: 'Still warm. Still cross about it.',
  },
  {
    id: 'gnaw',
    name: 'Gnaw',
    suit: 'hollow',
    rank: 'lesser',
    stats: { atk: 7, def: 3, spd: 7 },
    hp: 28,
    affinities: { radiance: 'weak', blight: 'resist' },
    skillIds: ['strike', 'wither'],
    lore: 'Named for the sound rather than the shape.',
  },
  {
    id: 'bramblehusk',
    name: 'Bramblehusk',
    suit: 'verdant',
    rank: 'lesser',
    stats: { atk: 6, def: 6, spd: 3 },
    hp: 40,
    affinities: { ember: 'weak', gale: 'resist' },
    skillIds: ['strike', 'gust'],
    lore: 'Grew through something that used to be walking.',
  },
  {
    id: 'scrapjaw',
    name: 'Scrapjaw',
    suit: 'iron',
    rank: 'lesser',
    stats: { atk: 9, def: 7, spd: 2 },
    hp: 44,
    affinities: { arc: 'weak', force: 'resist' },
    skillIds: ['strike', 'cleave'],
    lore: 'Assembled from the leavings of better things.',
  },
  {
    id: 'wispgloom',
    name: 'Wispgloom',
    suit: 'veil',
    rank: 'lesser',
    stats: { atk: 7, def: 2, spd: 9 },
    hp: 24,
    affinities: { radiance: 'weak', arc: 'resist' },
    skillIds: ['strike', 'jolt'],
    lore: 'Present only in the corner of the eye, and rude about it.',
  },
  {
    id: 'glowmite',
    name: 'Glowmite',
    suit: 'dawn',
    rank: 'lesser',
    stats: { atk: 6, def: 4, spd: 6 },
    hp: 30,
    affinities: { blight: 'weak', radiance: 'resist' },
    skillIds: ['strike', 'glimmer'],
    lore: 'Too bright for its size and quite pleased about that.',
  },
  {
    id: 'sludgehusk',
    name: 'Sludgehusk',
    suit: 'mire',
    rank: 'lesser',
    stats: { atk: 6, def: 7, spd: 2 },
    hp: 46,
    affinities: { radiance: 'weak', blight: 'resist', force: 'resist' },
    skillIds: ['strike', 'wither'],
    lore: 'Arrives eventually. Leaves a mark on the floor either way.',
  },
  {
    id: 'sparkhusk',
    name: 'Sparkhusk',
    suit: 'storm',
    rank: 'lesser',
    stats: { atk: 8, def: 3, spd: 8 },
    hp: 27,
    affinities: { force: 'weak', arc: 'resist', gale: 'resist' },
    skillIds: ['strike', 'jolt'],
    lore: 'All discharge, no storm behind it.',
  },
  {
    id: 'rattlehusk',
    name: 'Rattlehusk',
    suit: 'bone',
    rank: 'lesser',
    stats: { atk: 7, def: 5, spd: 5 },
    hp: 33,
    affinities: { force: 'weak', radiance: 'weak', blight: 'resist' },
    skillIds: ['strike', 'cleave'],
    lore: 'Announces itself long before it is a problem.',
  },

  // --- Greater ------------------------------------------------------------
  {
    id: 'tidewrack',
    name: 'Tidewrack',
    suit: 'tide',
    rank: 'greater',
    stats: { atk: 13, def: 9, spd: 7 },
    hp: 110,
    affinities: { arc: 'weak', gale: 'weak', frost: 'drain', ember: 'resist' },
    skillIds: ['strike', 'hoarfrost', 'ebb'],
    lore: 'Everything the water took, wearing it all at once.',
  },
  {
    id: 'forgemaw',
    name: 'Forgemaw',
    suit: 'iron',
    rank: 'greater',
    stats: { atk: 16, def: 13, spd: 4 },
    hp: 140,
    affinities: { arc: 'weak', frost: 'weak', force: 'null', ember: 'resist' },
    skillIds: ['strike', 'sunder', 'fracture'],
    lore: 'The furnace kept working long after anyone was left to feed it.',
  },
  {
    id: 'palefather',
    name: 'Palefather',
    suit: 'veil',
    rank: 'greater',
    stats: { atk: 15, def: 7, spd: 13 },
    hp: 96,
    affinities: { radiance: 'weak', force: 'weak', arc: 'drain', blight: 'resist' },
    skillIds: ['strike', 'arcflash', 'blunt'],
    lore: 'Counts the party twice on arrival and once again on the way out.',
  },
  {
    id: 'rotcrown',
    name: 'Rotcrown',
    suit: 'mire',
    rank: 'greater',
    stats: { atk: 14, def: 11, spd: 5 },
    hp: 128,
    affinities: { radiance: 'weak', ember: 'weak', blight: 'drain', force: 'resist' },
    skillIds: ['strike', 'rot', 'miasma'],
    lore: 'Wears the bog like a title it was never granted.',
  },

  // --- Rare ---------------------------------------------------------------
  {
    id: 'gildhusk',
    name: 'Gildhusk',
    suit: 'dawn',
    rank: 'rare',
    stats: { atk: 8, def: 16, spd: 16 },
    hp: 70,
    affinities: { blight: 'weak', ember: 'resist', frost: 'resist', force: 'resist' },
    skillIds: ['strike'],
    lore: 'Heavy with something worth having, and entirely uninterested in the fight.',
  },

  // --- Warden -------------------------------------------------------------
  {
    id: 'drowned-choir',
    name: 'The Drowned Choir',
    suit: 'tide',
    rank: 'warden',
    stats: { atk: 19, def: 15, spd: 9 },
    hp: 320,
    affinities: {
      arc: 'weak',
      radiance: 'weak',
      frost: 'drain',
      ember: 'resist',
      force: 'resist',
    },
    skillIds: ['strike', 'whiteout', 'hoarfrost', 'ebb'],
    veilHits: 3,
    lore: 'Sings in the round. Every voice in it used to want something specific.',
  },
];

export const HUSK_SPECIES: ReadonlyMap<string, HuskSpecies> = new Map(
  list.map((species) => [species.id, species]),
);

export const ALL_HUSK_SPECIES: readonly HuskSpecies[] = list;

export function huskSpecies(id: string): HuskSpecies {
  const found = HUSK_SPECIES.get(id);
  if (!found) throw new Error(`unknown husk species: ${id}`);
  return found;
}

export function husksOfRank(rank: HuskSpecies['rank']): HuskSpecies[] {
  return list.filter((species) => species.rank === rank);
}

/**
 * Which Echo a Husk yields when bound. Husks and Echoes share the suit
 * vocabulary, so binding hands over the plainest Echo of the same suit rather
 * than requiring a hand-maintained pairing for every entry.
 */
export const BIND_YIELD: Readonly<Record<string, string>> = {
  drifter: 'brinemote',
  cinderhusk: 'emberkin',
  gnaw: 'gauntling',
  bramblehusk: 'thornlet',
  scrapjaw: 'rivet',
  wispgloom: 'shroudlet',
  glowmite: 'lumen',
  sludgehusk: 'sludgemote',
  sparkhusk: 'zephyrling',
  rattlehusk: 'marrowkin',
  tidewrack: 'undertow',
  forgemaw: 'slagheart',
  palefather: 'palewatch',
  rotcrown: 'bogwreath',
  gildhusk: 'dawnmoth',
  'drowned-choir': 'undertow',
};
