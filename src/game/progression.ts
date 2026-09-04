/**
 * Levels, capacity, and Resolve.
 *
 * Every number here is a starting value for tuning, not a balanced one.
 * Balance comes from play.
 */

import type { HuskRank, StatBlock } from './types';

/** Beyond this the curve is academic; nothing is authored for it yet. */
export const MAX_LEVEL = 60;

export const ECHO_CAPACITY_CAP = 12;

export const RESOLVE_CAP = 5;

/** One Resolve every three hours, so a full bar refills in fifteen. */
export const RESOLVE_REGEN_SECONDS = 3 * 60 * 60;

/** A descent costs this much Resolve. */
export const DESCENT_COST = 1;

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(80 * Math.pow(Math.max(1, level), 1.5));
}

/**
 * How many Echoes may be carried at once. Deliberately tight: hitting the cap
 * forces a release or a weave, and an unbounded collection has no decisions in
 * it.
 */
export function echoCapacity(level: number): number {
  return Math.min(ECHO_CAPACITY_CAP, 4 + Math.floor(Math.max(1, level) / 2));
}

/**
 * Health has to outrun a single skill by a comfortable margin, or a fight is
 * decided by whoever moved first. At 40 a level-one Wanderer died to one
 * blow from a level-one Husk; simulation wanted roughly three times the
 * biggest hit it could take.
 */
export function maxHp(level: number): number {
  return 85 + 12 * (Math.max(1, level) - 1);
}

export function maxFocus(level: number): number {
  return 30 + 6 * (Math.max(1, level) - 1);
}

/**
 * The Wanderer's own stats, before the active Echo's modifiers. Kept
 * derived rather than allocated: a stat-point UI is a knob nobody asked to
 * turn.
 */
export function baseStats(level: number): StatBlock {
  const l = Math.max(1, level);
  return {
    atk: 8 + Math.floor(l * 1.5),
    def: 6 + Math.floor(l * 1.2),
    spd: 6 + Math.floor(l * 1.1),
  };
}

export interface LevelUpResult {
  level: number;
  xp: number;
  levelsGained: number;
}

/**
 * Apply XP, rolling over as many levels as it covers. Excess XP at MAX_LEVEL
 * is discarded rather than accumulating into a number nobody can spend.
 */
export function applyXp(level: number, xp: number, gained: number): LevelUpResult {
  let currentLevel = Math.max(1, level);
  let currentXp = Math.max(0, xp) + Math.max(0, gained);
  let levelsGained = 0;

  while (currentLevel < MAX_LEVEL) {
    const needed = xpToNext(currentLevel);
    if (currentXp < needed) break;
    currentXp -= needed;
    currentLevel++;
    levelsGained++;
  }

  if (currentLevel >= MAX_LEVEL) currentXp = 0;

  return { level: currentLevel, xp: currentXp, levelsGained };
}

const XP_PER_LEVEL_BY_RANK: Record<HuskRank, number> = {
  lesser: 12,
  greater: 40,
  rare: 200,
  warden: 150,
};

/** XP awarded for defeating one Husk. */
export function encounterXp(rank: HuskRank, huskLevel: number): number {
  return XP_PER_LEVEL_BY_RANK[rank] * Math.max(1, huskLevel);
}

/** Carried Echoes learn from a fight they were not summoned for, but slowly. */
export const CARRIED_ECHO_XP_SHARE = 0.25;

/**
 * XP an Echo receives from an encounter. An Echo may never exceed its
 * wielder's level, so once it is level-capped the award is dropped rather
 * than banked - otherwise a shelved Echo would leap several levels the moment
 * the Wanderer advanced.
 */
export function echoXpShare(
  totalXp: number,
  isActive: boolean,
  echoLevel: number,
  wandererLevel: number,
): number {
  if (echoLevel >= wandererLevel) return 0;
  return Math.floor(totalXp * (isActive ? 1 : CARRIED_ECHO_XP_SHARE));
}

/** Apply XP to an Echo, stopping dead at the wielder's level. */
export function applyEchoXp(
  level: number,
  xp: number,
  gained: number,
  wandererLevel: number,
): LevelUpResult {
  const cap = Math.max(1, Math.min(wandererLevel, MAX_LEVEL));
  let currentLevel = Math.max(1, level);
  let currentXp = Math.max(0, xp) + Math.max(0, gained);
  let levelsGained = 0;

  while (currentLevel < cap) {
    const needed = xpToNext(currentLevel);
    if (currentXp < needed) break;
    currentXp -= needed;
    currentLevel++;
    levelsGained++;
  }

  if (currentLevel >= cap) currentXp = 0;

  return { level: currentLevel, xp: currentXp, levelsGained };
}

export interface ResolveState {
  resolve: number;
  updatedAt: number;
}

/**
 * Project stored Resolve forward to `now`.
 *
 * Regeneration is computed on read rather than scheduled, so it needs no cron
 * and cannot drift when one fails to fire. The partial interval is preserved
 * by advancing `updatedAt` only by the whole intervals consumed - otherwise
 * every read would silently reset the timer and Resolve would never refill.
 */
export function projectResolve(
  stored: number,
  updatedAt: number,
  now: number,
): ResolveState {
  const current = Math.max(0, Math.min(RESOLVE_CAP, stored));
  if (current >= RESOLVE_CAP) return { resolve: RESOLVE_CAP, updatedAt: now };

  const elapsed = Math.max(0, now - updatedAt);
  const gained = Math.floor(elapsed / RESOLVE_REGEN_SECONDS);
  if (gained <= 0) return { resolve: current, updatedAt };

  const resolve = Math.min(RESOLVE_CAP, current + gained);
  return {
    resolve,
    updatedAt:
      resolve >= RESOLVE_CAP ? now : updatedAt + gained * RESOLVE_REGEN_SECONDS,
  };
}

/** Seconds until one more Resolve arrives, or null when already full. */
export function secondsUntilNextResolve(state: ResolveState, now: number): number | null {
  if (state.resolve >= RESOLVE_CAP) return null;
  const elapsedInInterval = Math.max(0, now - state.updatedAt) % RESOLVE_REGEN_SECONDS;
  return RESOLVE_REGEN_SECONDS - elapsedInInterval;
}

/** Spend Resolve, returning null when there is not enough. */
export function spendResolve(
  state: ResolveState,
  cost: number,
  now: number,
): ResolveState | null {
  if (state.resolve < cost) return null;
  const wasFull = state.resolve >= RESOLVE_CAP;
  return {
    resolve: state.resolve - cost,
    // Leaving a full bar starts the regeneration clock from this moment.
    updatedAt: wasFull ? now : state.updatedAt,
  };
}
