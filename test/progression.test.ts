import { describe, expect, it } from 'vitest';
import {
  applyEchoXp,
  applyXp,
  baseStats,
  echoCapacity,
  echoXpShare,
  encounterXp,
  ECHO_CAPACITY_CAP,
  MAX_LEVEL,
  maxFocus,
  maxHp,
  projectResolve,
  RESOLVE_CAP,
  RESOLVE_REGEN_SECONDS,
  secondsUntilNextResolve,
  spendResolve,
  xpToNext,
} from '../src/game/progression';

describe('xpToNext', () => {
  it('matches the documented curve', () => {
    expect(xpToNext(1)).toBe(80);
    expect(xpToNext(2)).toBe(226);
    expect(xpToNext(3)).toBe(416);
    expect(xpToNext(5)).toBe(894);
    expect(xpToNext(10)).toBe(2530);
  });

  it('rises monotonically', () => {
    for (let level = 1; level < MAX_LEVEL; level++) {
      expect(xpToNext(level + 1)).toBeGreaterThan(xpToNext(level));
    }
  });
});

describe('echoCapacity', () => {
  it('matches the documented table', () => {
    expect(echoCapacity(1)).toBe(4);
    expect(echoCapacity(2)).toBe(5);
    expect(echoCapacity(4)).toBe(6);
    expect(echoCapacity(6)).toBe(7);
    expect(echoCapacity(10)).toBe(9);
    expect(echoCapacity(16)).toBe(12);
  });

  it('never exceeds the cap', () => {
    expect(echoCapacity(40)).toBe(ECHO_CAPACITY_CAP);
    expect(echoCapacity(MAX_LEVEL)).toBe(ECHO_CAPACITY_CAP);
  });

  it('never falls below the starting four', () => {
    expect(echoCapacity(0)).toBe(4);
    expect(echoCapacity(-3)).toBe(4);
  });
});

describe('derived maxima', () => {
  it('starts a level one Wanderer at 85 HP and 30 Focus', () => {
    expect(maxHp(1)).toBe(85);
    expect(maxFocus(1)).toBe(30);
  });

  it('grows every level', () => {
    expect(maxHp(2)).toBe(97);
    expect(maxFocus(2)).toBe(36);
  });

  // Health has to outrun the biggest single blow by a wide margin, or turn
  // order decides the fight. The strongest skill is 62 power; against a low
  // defence that lands near 2x power before the 1.75 weakness multiplier.
  it('keeps health comfortably ahead of the hardest single hit', () => {
    expect(maxHp(1)).toBeGreaterThan(62 * 1.15 * 0.75);
  });

  it('gives every stat a positive base', () => {
    const stats = baseStats(1);
    expect(stats.atk).toBeGreaterThan(0);
    expect(stats.def).toBeGreaterThan(0);
    expect(stats.spd).toBeGreaterThan(0);
  });
});

describe('applyXp', () => {
  it('banks XP below the threshold', () => {
    expect(applyXp(1, 0, 30)).toEqual({ level: 1, xp: 30, levelsGained: 0 });
  });

  it('levels once and carries the remainder', () => {
    expect(applyXp(1, 0, 100)).toEqual({ level: 2, xp: 20, levelsGained: 1 });
  });

  it('levels exactly on the threshold', () => {
    expect(applyXp(1, 0, 80)).toEqual({ level: 2, xp: 0, levelsGained: 1 });
  });

  it('rolls through several levels at once', () => {
    const result = applyXp(1, 0, 80 + 226 + 416 + 5);
    expect(result.level).toBe(4);
    expect(result.levelsGained).toBe(3);
    expect(result.xp).toBe(5);
  });

  it('discards overflow at the level cap rather than banking it', () => {
    const result = applyXp(MAX_LEVEL, 0, 999_999);
    expect(result.level).toBe(MAX_LEVEL);
    expect(result.xp).toBe(0);
  });

  it('ignores negative awards', () => {
    expect(applyXp(3, 50, -100)).toEqual({ level: 3, xp: 50, levelsGained: 0 });
  });
});

describe('echo levelling', () => {
  it('gives the active Echo the whole award and carried ones a quarter', () => {
    expect(echoXpShare(100, true, 1, 10)).toBe(100);
    expect(echoXpShare(100, false, 1, 10)).toBe(25);
  });

  // A shelved Echo must not bank XP, or it would leap several levels the
  // moment the Wanderer advanced.
  it('awards nothing to an Echo already at its wielder level', () => {
    expect(echoXpShare(100, true, 10, 10)).toBe(0);
    expect(echoXpShare(100, false, 11, 10)).toBe(0);
  });

  it('stops an Echo dead at the wielder level', () => {
    const result = applyEchoXp(1, 0, 999_999, 3);
    expect(result.level).toBe(3);
    expect(result.xp).toBe(0);
  });

  it('levels normally below the wielder level', () => {
    expect(applyEchoXp(1, 0, 80, 10)).toEqual({ level: 2, xp: 0, levelsGained: 1 });
  });
});

describe('encounterXp', () => {
  it('scales with rank and level', () => {
    expect(encounterXp('lesser', 1)).toBe(12);
    expect(encounterXp('greater', 3)).toBe(120);
    expect(encounterXp('warden', 10)).toBe(1500);
    expect(encounterXp('rare', 2)).toBe(400);
  });

  it('ranks a Rare above a Warden of the same level', () => {
    expect(encounterXp('rare', 5)).toBeGreaterThan(encounterXp('warden', 5));
  });
});

describe('projectResolve', () => {
  const hour = 3600;

  it('holds a full bar and refreshes the stamp', () => {
    expect(projectResolve(RESOLVE_CAP, 0, 1000)).toEqual({
      resolve: RESOLVE_CAP,
      updatedAt: 1000,
    });
  });

  it('grants nothing before a full interval elapses', () => {
    expect(projectResolve(2, 0, 2 * hour)).toEqual({ resolve: 2, updatedAt: 0 });
  });

  it('grants one Resolve per interval', () => {
    expect(projectResolve(2, 0, RESOLVE_REGEN_SECONDS).resolve).toBe(3);
    expect(projectResolve(2, 0, 2 * RESOLVE_REGEN_SECONDS).resolve).toBe(4);
  });

  // Advancing the stamp to `now` on every read would restart the timer each
  // time the player looked at their profile, and Resolve would never refill.
  it('preserves the partial interval', () => {
    const elapsed = RESOLVE_REGEN_SECONDS + hour;
    const state = projectResolve(1, 0, elapsed);
    expect(state.resolve).toBe(2);
    expect(state.updatedAt).toBe(RESOLVE_REGEN_SECONDS);
    expect(secondsUntilNextResolve(state, elapsed)).toBe(RESOLVE_REGEN_SECONDS - hour);
  });

  it('caps at the maximum however long has passed', () => {
    expect(projectResolve(0, 0, 400 * hour).resolve).toBe(RESOLVE_CAP);
  });

  it('tolerates a stamp in the future without losing Resolve', () => {
    expect(projectResolve(3, 5000, 0).resolve).toBe(3);
  });
});

describe('secondsUntilNextResolve', () => {
  it('returns null on a full bar', () => {
    expect(secondsUntilNextResolve({ resolve: RESOLVE_CAP, updatedAt: 0 }, 100)).toBeNull();
  });

  it('counts down within the interval', () => {
    expect(secondsUntilNextResolve({ resolve: 1, updatedAt: 0 }, 3600)).toBe(
      RESOLVE_REGEN_SECONDS - 3600,
    );
  });
});

describe('spendResolve', () => {
  it('refuses when there is not enough', () => {
    expect(spendResolve({ resolve: 0, updatedAt: 0 }, 1, 500)).toBeNull();
  });

  it('deducts the cost', () => {
    expect(spendResolve({ resolve: 3, updatedAt: 10 }, 1, 500)).toEqual({
      resolve: 2,
      updatedAt: 10,
    });
  });

  // Leaving a full bar is the moment regeneration should start counting.
  it('starts the clock when leaving a full bar', () => {
    expect(spendResolve({ resolve: RESOLVE_CAP, updatedAt: 10 }, 1, 500)).toEqual({
      resolve: RESOLVE_CAP - 1,
      updatedAt: 500,
    });
  });
});
