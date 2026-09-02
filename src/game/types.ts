/** Core domain vocabulary. Pure data - nothing here touches I/O or Discord. */

export const ELEMENTS = [
  'ember',
  'frost',
  'arc',
  'gale',
  'radiance',
  'blight',
  'force',
] as const;

export type Element = (typeof ELEMENTS)[number];

/** Force is the physical element every Strike uses, so nothing resists it away. */
export const STRIKE_ELEMENT: Element = 'force';

export const AFFINITIES = ['weak', 'neutral', 'resist', 'null', 'repel', 'drain'] as const;

export type Affinity = (typeof AFFINITIES)[number];

/** Elements absent from the table are neutral. */
export type AffinityTable = Partial<Record<Element, Affinity>>;

/**
 * Echo and Husk families. They drive characteristic affinities and the weaving
 * table.
 */
export const SUITS = [
  'tide',
  'ash',
  'hollow',
  'verdant',
  'iron',
  'veil',
  'dawn',
  'mire',
  'storm',
  'bone',
] as const;

export type Suit = (typeof SUITS)[number];

export const HUSK_RANKS = ['lesser', 'greater', 'rare', 'warden'] as const;

export type HuskRank = (typeof HUSK_RANKS)[number];

export const ALLY_STANCES = ['assault', 'support', 'conserve'] as const;

export type AllyStance = (typeof ALLY_STANCES)[number];

export const ALLY_ROLES = ['striker', 'mender', 'breaker'] as const;

export type AllyRole = (typeof ALLY_ROLES)[number];

/** What a skill does when it resolves. */
export type SkillKind = 'damage' | 'heal' | 'buff' | 'debuff';

/** The stats a buff or debuff can shift. */
export type ModifiableStat = 'atk' | 'def' | 'spd';

interface SkillBase {
  id: string;
  name: string;
  element: Element;
  /** Focus cost. A Strike is free. */
  cost: number;
  description: string;
}

export interface DamageSkill extends SkillBase {
  kind: 'damage';
  power: number;
  /** Hits every enemy rather than one. */
  aoe?: boolean;
}

export interface HealSkill extends SkillBase {
  kind: 'heal';
  power: number;
  /** Heals the whole party rather than one member. */
  party?: boolean;
}

export interface ModifierSkill extends SkillBase {
  kind: 'buff' | 'debuff';
  stat: ModifiableStat;
  /** Signed stages. Positive raises the stat, negative lowers it. */
  stages: number;
  /** Applies to every member of the affected side. */
  spread?: boolean;
}

export type Skill = DamageSkill | HealSkill | ModifierSkill;

/** Each stage shifts a stat by this fraction, and stages clamp to +/-2. */
export const STAGE_STEP = 0.25;
export const MAX_STAGES = 2;

/** How many of the acting side's turns a buff or debuff survives. */
export const MODIFIER_TURNS = 3;

/** Stat modifiers an Echo contributes to its wielder. */
export interface StatBlock {
  atk: number;
  def: number;
  spd: number;
}

export interface EchoSpecies {
  id: string;
  name: string;
  suit: Suit;
  /** 1-5. Drives weaving results and how impressive the entry reads. */
  rarity: number;
  /** Modifiers added to the Wanderer's base stats while this Echo is active. */
  stats: StatBlock;
  /** Bonus to the Wanderer's maxima while this Echo is active. */
  hpBonus: number;
  focusBonus: number;
  /** The Echo's affinities become the wielder's own. That is the whole game. */
  affinities: AffinityTable;
  /** Skill id keyed to the Echo level at which it is learned. */
  learnset: { level: number; skillId: string }[];
  /** Flavour text shown in the codex. */
  lore: string;
}

export interface HuskSpecies {
  id: string;
  name: string;
  suit: Suit;
  rank: HuskRank;
  stats: StatBlock;
  hp: number;
  affinities: AffinityTable;
  skillIds: string[];
  lore: string;
  /**
   * Wardens only. The Veil suppresses every weakness until it is broken by
   * landing this many unresisted hits.
   */
  veilHits?: number;
}

export interface AllyDefinition {
  id: string;
  name: string;
  role: AllyRole;
  /** Allies are bound to exactly one Echo, permanently. Only you are Unbound. */
  echoSpeciesId: string;
  /** Wanderer level at which this ally can be recruited. */
  unlockLevel: number;
  lore: string;
}
