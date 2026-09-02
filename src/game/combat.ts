/**
 * The turn engine.
 *
 * Pure: no I/O, no Discord, no clock. A CombatState is small enough to live in
 * one D1 column, which is what lets a fight span dozens of HTTP requests with
 * no process alive in between - each button press loads the state, applies one
 * action, and writes it back.
 *
 * The rule the whole thing hangs on: hitting a weakness downs the target and
 * grants the attacker another turn, but a target that is *already* down grants
 * nothing. That is what stops Second Wind chaining forever, and it needs no
 * separate cap.
 */

import { breaksVeil, resolveAffinity } from './affinity';
import { echoSpecies, skillsAtLevel } from './content/echoes';
import { huskSpecies } from './content/husks';
import { skill as lookupSkill, STRIKE } from './content/skills';
import { createRng, type Rng } from './rng';
import { baseStats, maxFocus, maxHp } from './progression';
import {
  MAX_STAGES,
  MODIFIER_TURNS,
  STAGE_STEP,
  type AffinityTable,
  type AllyDefinition,
  type AllyStance,
  type HuskRank,
  type ModifiableStat,
  type Skill,
} from './types';

export const WANDERER_ID = 'w';

export type Side = 'party' | 'husks';

export interface Combatant {
  id: string;
  side: Side;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  focus: number;
  maxFocus: number;
  atk: number;
  def: number;
  spd: number;
  affinities: AffinityTable;
  skillIds: string[];
  /** Loses its next turn, and grants no further Second Wind while it lasts. */
  downed: boolean;
  stages: Record<ModifiableStat, number>;
  stageTurns: Record<ModifiableStat, number>;
  /** Allies only. Drives their automatic behaviour. */
  stance?: AllyStance;
  /** Husks only. */
  speciesId?: string;
  rank?: HuskRank;
  /** Wardens only. Remaining connecting hits before weaknesses apply. */
  veilRemaining?: number;
}

export type CombatOutcome = 'ongoing' | 'won' | 'lost' | 'fled' | 'retreated';

export interface CombatState {
  round: number;
  /** Combatant ids in this round's turn order. */
  order: string[];
  cursor: number;
  combatants: Combatant[];
  /** Lines for the fight embed. Trimmed to the most recent few. */
  log: string[];
  rngState: number;
  /** The Echo row currently summoned, and the species it is. */
  activeEchoId: string;
  activeSpeciesId: string;
  /** A swap is free, but only one per turn. */
  swappedThisTurn: boolean;
  /** The current actor acts again instead of passing on. */
  secondWind: boolean;
  outcome: CombatOutcome;
  /** Rare Husks leave if the fight drags. */
  fleeAfterRound: number | null;
  /** Set when the fight ends in a bind rather than a kill. */
  boundSpeciesId: string | null;
  /** True when the win came by Onslaught, which is what unlocks The Draw. */
  wonByOnslaught: boolean;
}

const LOG_LIMIT = 6;

// --- construction ---------------------------------------------------------

function emptyStages(): Record<ModifiableStat, number> {
  return { atk: 0, def: 0, spd: 0 };
}

export interface WandererSeed {
  name: string;
  level: number;
  echoRowId: string;
  echoSpeciesId: string;
  echoLevel: number;
}

export function createWanderer(seed: WandererSeed): Combatant {
  const species = echoSpecies(seed.echoSpeciesId);
  const base = baseStats(seed.level);
  return {
    id: WANDERER_ID,
    side: 'party',
    name: seed.name,
    level: seed.level,
    hp: maxHp(seed.level) + species.hpBonus,
    maxHp: maxHp(seed.level) + species.hpBonus,
    focus: maxFocus(seed.level) + species.focusBonus,
    maxFocus: maxFocus(seed.level) + species.focusBonus,
    atk: base.atk + species.stats.atk,
    def: base.def + species.stats.def,
    spd: base.spd + species.stats.spd,
    affinities: species.affinities,
    skillIds: skillsAtLevel(species, seed.echoLevel),
    downed: false,
    stages: emptyStages(),
    stageTurns: emptyStages(),
  };
}

export function createAlly(
  definition: AllyDefinition,
  level: number,
  stance: AllyStance,
): Combatant {
  const species = echoSpecies(definition.echoSpeciesId);
  const base = baseStats(level);
  return {
    id: `a:${definition.id}`,
    side: 'party',
    name: definition.name,
    level,
    hp: maxHp(level) + species.hpBonus,
    maxHp: maxHp(level) + species.hpBonus,
    focus: maxFocus(level) + species.focusBonus,
    maxFocus: maxFocus(level) + species.focusBonus,
    atk: base.atk + species.stats.atk,
    def: base.def + species.stats.def,
    spd: base.spd + species.stats.spd,
    affinities: species.affinities,
    skillIds: skillsAtLevel(species, level),
    downed: false,
    stages: emptyStages(),
    stageTurns: emptyStages(),
    stance,
  };
}

export function createHusk(speciesId: string, level: number, index: number): Combatant {
  const species = huskSpecies(speciesId);
  const scale = 1 + (level - 1) * 0.12;
  const hp = Math.round(species.hp * scale);
  return {
    id: `h:${index}`,
    side: 'husks',
    name: species.name,
    level,
    hp,
    maxHp: hp,
    focus: 999,
    maxFocus: 999,
    atk: Math.round(species.stats.atk * scale),
    def: Math.round(species.stats.def * scale),
    spd: Math.round(species.stats.spd * scale),
    affinities: species.affinities,
    skillIds: species.skillIds,
    downed: false,
    stages: emptyStages(),
    stageTurns: emptyStages(),
    speciesId,
    rank: species.rank,
    ...(species.veilHits === undefined ? {} : { veilRemaining: species.veilHits }),
  };
}

export interface EncounterSeed {
  wanderer: WandererSeed;
  allies: { definition: AllyDefinition; level: number; stance: AllyStance }[];
  husks: { speciesId: string; level: number }[];
  seed: number;
  /** Rare Husks abandon the fight after this many rounds. */
  fleeAfterRound?: number;
}

export function startEncounter(seed: EncounterSeed): CombatState {
  const combatants: Combatant[] = [
    createWanderer(seed.wanderer),
    ...seed.allies.map((a) => createAlly(a.definition, a.level, a.stance)),
    ...seed.husks.map((h, i) => createHusk(h.speciesId, h.level, i)),
  ];

  const state: CombatState = {
    round: 0,
    order: [],
    cursor: 0,
    combatants,
    log: [],
    rngState: seed.seed,
    activeEchoId: seed.wanderer.echoRowId,
    activeSpeciesId: seed.wanderer.echoSpeciesId,
    swappedThisTurn: false,
    secondWind: false,
    outcome: 'ongoing',
    fleeAfterRound: seed.fleeAfterRound ?? null,
    boundSpeciesId: null,
    wonByOnslaught: false,
  };

  beginRound(state);
  return advance(state);
}

// --- queries --------------------------------------------------------------

export function combatant(state: CombatState, id: string): Combatant | undefined {
  return state.combatants.find((c) => c.id === id);
}

export function living(state: CombatState, side: Side): Combatant[] {
  return state.combatants.filter((c) => c.side === side && c.hp > 0);
}

export function currentActorId(state: CombatState): string | undefined {
  return state.order[state.cursor];
}

export function isPlayerTurn(state: CombatState): boolean {
  return state.outcome === 'ongoing' && currentActorId(state) === WANDERER_ID;
}

/** Every Husk still standing is down - Onslaught and Bind are both open. */
export function allHusksDowned(state: CombatState): boolean {
  const husks = living(state, 'husks');
  return husks.length > 0 && husks.every((h) => h.downed);
}

function stageMultiplier(stages: number): number {
  const clamped = Math.max(-MAX_STAGES, Math.min(MAX_STAGES, stages));
  return 1 + clamped * STAGE_STEP;
}

export function effectiveStat(c: Combatant, stat: ModifiableStat): number {
  return Math.max(1, c[stat] * stageMultiplier(c.stages[stat]));
}

/**
 * Skills the combatant can currently pay for.
 *
 * Strike is included whether or not the Echo lists it: it is the free fallback
 * that stops a player with no Focus being offered nothing at all.
 */
export function usableSkills(c: Combatant): Skill[] {
  const known = c.skillIds
    .filter((id) => id !== STRIKE.id)
    .map((id) => lookupSkill(id))
    .filter((s) => s.cost <= c.focus);
  return [STRIKE, ...known];
}

// --- internals ------------------------------------------------------------

function rngFor(state: CombatState): Rng {
  return createRng(state.rngState);
}

function commitRng(state: CombatState, rng: Rng): void {
  state.rngState = rng.state();
}

function pushLog(state: CombatState, line: string): void {
  state.log.push(line);
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

function beginRound(state: CombatState): void {
  state.round++;
  const rng = rngFor(state);
  const alive = state.combatants.filter((c) => c.hp > 0);
  // Speed decides order; the RNG only breaks exact ties, so ordering stays
  // deterministic for a given seed.
  const jitter = new Map(alive.map((c) => [c.id, rng.next()]));
  state.order = alive
    .slice()
    .sort((a, b) => {
      const bySpeed = effectiveStat(b, 'spd') - effectiveStat(a, 'spd');
      if (bySpeed !== 0) return bySpeed;
      return (jitter.get(a.id) ?? 0) - (jitter.get(b.id) ?? 0);
    })
    .map((c) => c.id);
  state.cursor = 0;
  commitRng(state, rng);
}

function tickModifiers(c: Combatant): void {
  for (const stat of ['atk', 'def', 'spd'] as ModifiableStat[]) {
    if (c.stageTurns[stat] <= 0) continue;
    c.stageTurns[stat]--;
    if (c.stageTurns[stat] === 0) c.stages[stat] = 0;
  }
}

/**
 * Settle the fight if it is settled, and report the outcome. Returning it
 * rather than leaving callers to re-read `state.outcome` keeps the narrowing
 * honest: the compiler cannot see a mutation through a reference.
 */
function checkOutcome(state: CombatState): CombatOutcome {
  if (state.outcome !== 'ongoing') return state.outcome;

  const wanderer = combatant(state, WANDERER_ID);
  if (!wanderer || wanderer.hp <= 0) {
    state.outcome = 'lost';
    return state.outcome;
  }
  if (living(state, 'husks').length === 0) {
    state.outcome = 'won';
  }
  return state.outcome;
}

/**
 * Move to the next actor, resolving every automatic turn along the way, and
 * stop when the Wanderer is up or the fight is over.
 */
export function advance(state: CombatState): CombatState {
  // A bounded loop rather than recursion: a runaway state must not blow the
  // stack inside a Worker with a 10 ms CPU budget.
  for (let guard = 0; guard < 200; guard++) {
    checkOutcome(state);
    if (state.outcome !== 'ongoing') return state;

    if (state.cursor >= state.order.length) {
      if (state.fleeAfterRound !== null && state.round >= state.fleeAfterRound) {
        const husks = living(state, 'husks');
        if (husks.length > 0) {
          pushLog(state, `${husks[0]?.name ?? 'It'} slips away into the dark.`);
          state.outcome = 'fled';
          return state;
        }
      }
      beginRound(state);
      continue;
    }

    const actorId = state.order[state.cursor];
    const actor = actorId ? combatant(state, actorId) : undefined;

    if (!actor || actor.hp <= 0) {
      state.cursor++;
      continue;
    }

    if (!state.secondWind) {
      tickModifiers(actor);
      if (actor.downed) {
        // A downed actor forfeits this turn and stands up for the next.
        actor.downed = false;
        pushLog(state, `${actor.name} finds their feet again.`);
        state.cursor++;
        continue;
      }
    }

    if (actor.id === WANDERER_ID) {
      state.swappedThisTurn = false;
      return state;
    }

    autoTurn(state, actor);
    if (state.secondWind) continue;
    state.cursor++;
  }

  return state;
}

/** Hand the turn on, honouring a Second Wind if one was just earned. */
function endTurn(state: CombatState): CombatState {
  if (state.secondWind) {
    state.swappedThisTurn = false;
    return state;
  }
  state.cursor++;
  return advance(state);
}

// --- resolution -----------------------------------------------------------

interface HitReport {
  damage: number;
  downed: boolean;
  secondWind: boolean;
  line: string;
}

function applyDamage(
  state: CombatState,
  attacker: Combatant,
  target: Combatant,
  skill: Skill,
  rng: Rng,
): HitReport {
  const veiled = (target.veilRemaining ?? 0) > 0;
  const outcome = resolveAffinity(target.affinities, skill.element, veiled);

  const power = skill.kind === 'damage' ? skill.power : 0;
  const atk = effectiveStat(attacker, 'atk');
  const def = effectiveStat(target, 'def');

  const critChance = Math.max(
    0.01,
    Math.min(0.3, 0.05 + (effectiveStat(attacker, 'spd') - effectiveStat(target, 'spd')) * 0.005),
  );
  const crit = outcome.multiplier > 0 && rng.chance(critChance);

  const variance = 0.9 + rng.next() * 0.2;
  const raw = power * (atk / (atk + def)) * 2 * outcome.multiplier * (crit ? 1.5 : 1) * variance;
  const amount = outcome.multiplier === 0 ? 0 : Math.max(1, Math.round(raw));

  if (veiled && breaksVeil(outcome)) {
    target.veilRemaining = Math.max(0, (target.veilRemaining ?? 0) - 1);
    if (target.veilRemaining === 0) {
      pushLog(state, `${target.name}'s Veil breaks. Its weaknesses show.`);
    }
  }

  if (outcome.absorbed) {
    target.hp = Math.min(target.maxHp, target.hp + amount);
    return {
      damage: 0,
      downed: false,
      secondWind: false,
      line: `${target.name} drains the ${skill.name} and heals ${amount}.`,
    };
  }

  if (outcome.reflected) {
    const wasDown = attacker.downed;
    attacker.hp = Math.max(0, attacker.hp - amount);
    const selfOutcome = resolveAffinity(attacker.affinities, skill.element);
    const selfDown = selfOutcome.downs && !wasDown && attacker.hp > 0;
    if (selfDown) attacker.downed = true;
    return {
      damage: amount,
      downed: selfDown,
      secondWind: false,
      line: `${target.name} repels it. ${attacker.name} takes ${amount}.`,
    };
  }

  const wasDowned = target.downed;
  target.hp = Math.max(0, target.hp - amount);

  const knockdown = (outcome.downs || crit) && target.hp > 0;
  if (knockdown) target.downed = true;

  // The terminator: only a *fresh* knockdown pays out another turn.
  const secondWind = knockdown && !wasDowned;

  let line: string;
  if (outcome.multiplier === 0) {
    line = `${target.name} shrugs off the ${skill.name}.`;
  } else if (target.hp <= 0) {
    line = `${attacker.name} hits for ${amount}. ${target.name} falls.`;
  } else if (outcome.affinity === 'weak') {
    line = `${attacker.name} finds a weakness - ${amount}. ${target.name} goes down.`;
  } else if (crit) {
    line = `${attacker.name} lands a clean hit - ${amount}. ${target.name} goes down.`;
  } else if (outcome.affinity === 'resist') {
    line = `${target.name} resists. Only ${amount}.`;
  } else {
    line = `${attacker.name} hits ${target.name} for ${amount}.`;
  }

  return { damage: amount, downed: knockdown, secondWind, line };
}

function applyHeal(state: CombatState, healer: Combatant, target: Combatant, power: number): void {
  const amount = Math.max(1, Math.round(power * (1 + healer.level * 0.05)));
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  pushLog(state, `${healer.name} mends ${target.name} for ${target.hp - before}.`);
}

function applyModifier(
  state: CombatState,
  source: Combatant,
  targets: Combatant[],
  stat: ModifiableStat,
  stages: number,
): void {
  for (const target of targets) {
    target.stages[stat] = Math.max(
      -MAX_STAGES,
      Math.min(MAX_STAGES, target.stages[stat] + stages),
    );
    target.stageTurns[stat] = MODIFIER_TURNS;
  }
  const direction = stages > 0 ? 'raises' : 'lowers';
  const who = targets.length === 1 ? (targets[0]?.name ?? 'someone') : 'the other side';
  pushLog(state, `${source.name} ${direction} ${who}'s ${stat.toUpperCase()}.`);
}

/** Resolve one skill from `actor`. Returns true if a Second Wind was earned. */
function useSkill(
  state: CombatState,
  actor: Combatant,
  skill: Skill,
  explicitTargetId: string | undefined,
  rng: Rng,
): boolean {
  actor.focus = Math.max(0, actor.focus - skill.cost);
  const opposing: Side = actor.side === 'party' ? 'husks' : 'party';

  if (skill.kind === 'heal') {
    const allies = living(state, actor.side);
    const targets = skill.party
      ? allies
      : [
          allies
            .slice()
            .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)
            .at(0) ?? actor,
        ];
    for (const target of targets) applyHeal(state, actor, target, skill.power);
    return false;
  }

  // Checked as "not damage" rather than "buff or debuff": ModifierSkill's own
  // kind is a union, so a positive check narrows nothing away from the else.
  if (skill.kind !== 'damage') {
    const side = skill.kind === 'buff' ? actor.side : opposing;
    const candidates = living(state, side);
    const targets = skill.spread ? candidates : candidates.slice(0, 1);
    applyModifier(state, actor, targets, skill.stat, skill.stages);
    return false;
  }

  const enemies = living(state, opposing);
  if (enemies.length === 0) return false;

  const targets = skill.aoe
    ? enemies
    : [enemies.find((e) => e.id === explicitTargetId) ?? enemies[0]!];

  let earned = false;
  for (const target of targets) {
    const report = applyDamage(state, actor, target, skill, rng);
    pushLog(state, report.line);
    // An area attack pays out at most one extra turn, however many it downs.
    if (report.secondWind) earned = true;
  }
  return earned;
}

// --- automatic turns ------------------------------------------------------

function bestDamageSkill(actor: Combatant, enemies: Combatant[]): Skill {
  const affordable = usableSkills(actor).filter((s) => s.kind === 'damage');
  if (affordable.length === 0) return STRIKE;

  let best = STRIKE;
  let bestScore = -1;
  for (const candidate of affordable) {
    if (candidate.kind !== 'damage') continue;
    for (const enemy of enemies) {
      const veiled = (enemy.veilRemaining ?? 0) > 0;
      const outcome = resolveAffinity(enemy.affinities, candidate.element, veiled);
      // Downing an enemy is worth far more than raw damage, because it is what
      // opens Onslaught.
      const score =
        candidate.power * outcome.multiplier * (outcome.downs && !enemy.downed ? 3 : 1);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
  }
  return best;
}

function preferredTarget(actor: Combatant, enemies: Combatant[], skill: Skill): Combatant {
  let best = enemies[0]!;
  let bestScore = -1;
  for (const enemy of enemies) {
    const veiled = (enemy.veilRemaining ?? 0) > 0;
    const outcome = resolveAffinity(enemy.affinities, skill.element, veiled);
    const fragility = 1 - enemy.hp / enemy.maxHp;
    const score = outcome.multiplier * 2 + fragility + (outcome.downs && !enemy.downed ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = enemy;
    }
  }
  return best;
}

function autoTurn(state: CombatState, actor: Combatant): void {
  const rng = rngFor(state);
  const opposing: Side = actor.side === 'party' ? 'husks' : 'party';
  const enemies = living(state, opposing);

  if (enemies.length === 0) {
    commitRng(state, rng);
    return;
  }

  let chosen: Skill = STRIKE;
  const allies = living(state, actor.side);
  const hurt = allies.filter((a) => a.hp / a.maxHp < 0.5);
  const stance = actor.stance;

  if (stance === 'conserve') {
    chosen = STRIKE;
  } else if (stance === 'support') {
    const heal = usableSkills(actor).find((s) => s.kind === 'heal');
    const buff = usableSkills(actor).find((s) => s.kind === 'buff' || s.kind === 'debuff');
    chosen = (hurt.length > 0 && heal) || buff || bestDamageSkill(actor, enemies);
  } else {
    // Assault allies and every Husk share the same instinct: hunt weaknesses.
    const support =
      actor.side === 'husks' && hurt.length === 0 && rng.chance(0.2)
        ? usableSkills(actor).find((s) => s.kind === 'debuff')
        : undefined;
    chosen = support ?? bestDamageSkill(actor, enemies);
  }

  const target =
    chosen.kind === 'damage' ? preferredTarget(actor, enemies, chosen) : enemies[0]!;

  const earned = useSkill(state, actor, chosen, target.id, rng);
  state.secondWind = earned;
  commitRng(state, rng);
  checkOutcome(state);
}

// --- player actions -------------------------------------------------------

export type CombatAction =
  | { kind: 'skill'; skillId: string; targetId?: string }
  | { kind: 'swap'; echoRowId: string; speciesId: string; echoLevel: number }
  | { kind: 'onslaught' }
  | { kind: 'bind'; targetId: string }
  | { kind: 'retreat' };

export interface ActionRejection {
  ok: false;
  reason: string;
}

export interface ActionAccepted {
  ok: true;
  state: CombatState;
}

export type ActionResult = ActionAccepted | ActionRejection;

/**
 * Apply the Wanderer's chosen action, then run every automatic turn until
 * control returns or the fight ends.
 */
export function takeAction(state: CombatState, action: CombatAction): ActionResult {
  if (state.outcome !== 'ongoing') {
    return { ok: false, reason: 'This fight is already over.' };
  }
  if (!isPlayerTurn(state)) {
    return { ok: false, reason: 'It is not your turn.' };
  }

  const wanderer = combatant(state, WANDERER_ID);
  if (!wanderer) return { ok: false, reason: 'You are not in this fight.' };

  switch (action.kind) {
    case 'retreat': {
      state.outcome = 'retreated';
      pushLog(state, 'You withdraw, and the Rift lets you.');
      return { ok: true, state };
    }

    case 'swap': {
      if (state.swappedThisTurn) {
        return { ok: false, reason: 'You have already swapped this turn.' };
      }
      if (action.echoRowId === state.activeEchoId) {
        return { ok: false, reason: 'That Echo is already summoned.' };
      }

      const species = echoSpecies(action.speciesId);
      const base = baseStats(wanderer.level);
      const newMaxHp = maxHp(wanderer.level) + species.hpBonus;
      const newMaxFocus = maxFocus(wanderer.level) + species.focusBonus;

      // HP and Focus belong to the Wanderer, not the Echo, so swapping neither
      // heals nor refills - only the ceilings move, and current values clamp.
      wanderer.maxHp = newMaxHp;
      wanderer.maxFocus = newMaxFocus;
      wanderer.hp = Math.min(wanderer.hp, newMaxHp);
      wanderer.focus = Math.min(wanderer.focus, newMaxFocus);
      wanderer.atk = base.atk + species.stats.atk;
      wanderer.def = base.def + species.stats.def;
      wanderer.spd = base.spd + species.stats.spd;
      wanderer.affinities = species.affinities;
      wanderer.skillIds = skillsAtLevel(species, action.echoLevel);

      state.activeEchoId = action.echoRowId;
      state.activeSpeciesId = action.speciesId;
      state.swappedThisTurn = true;
      pushLog(state, `You summon ${species.name}.`);
      // A swap is free. The turn is still yours.
      return { ok: true, state };
    }

    case 'onslaught': {
      if (!allHusksDowned(state)) {
        return { ok: false, reason: 'Every Husk must be down first.' };
      }
      const rng = rngFor(state);
      const party = living(state, 'party');
      const husks = living(state, 'husks');
      const aggregate = party.reduce((sum, c) => sum + effectiveStat(c, 'atk'), 0);

      for (const husk of husks) {
        const def = effectiveStat(husk, 'def');
        // Onslaught ignores Resist but not Null, so a nulled element is still
        // the wrong answer even here.
        const nulled = resolveAffinity(husk.affinities, 'force').multiplier === 0;
        const raw = nulled ? 0 : aggregate * 2.5 * (0.9 + rng.next() * 0.2) * (30 / (30 + def));
        const amount = Math.max(nulled ? 0 : 1, Math.round(raw));
        husk.hp = Math.max(0, husk.hp - amount);
        husk.downed = false;
      }
      pushLog(state, `The party converges. ${husks.length} caught in it.`);
      commitRng(state, rng);
      if (checkOutcome(state) === 'won') {
        state.wonByOnslaught = true;
        return { ok: true, state };
      }
      state.secondWind = false;
      return { ok: true, state: endTurn(state) };
    }

    case 'bind': {
      if (!allHusksDowned(state)) {
        return { ok: false, reason: 'Every Husk must be down first.' };
      }
      const target = living(state, 'husks').find((h) => h.id === action.targetId);
      if (!target) return { ok: false, reason: 'That Husk is no longer standing.' };

      const rng = rngFor(state);
      const hpFraction = target.hp / target.maxHp;
      const chance = Math.max(
        0.05,
        Math.min(
          0.9,
          0.35 + (1 - hpFraction) * 0.4 - Math.max(0, target.level - wanderer.level) * 0.08,
        ),
      );

      if (rng.chance(chance)) {
        state.boundSpeciesId = target.speciesId ?? null;
        pushLog(state, `${target.name} yields. It is yours.`);
        state.outcome = 'won';
        commitRng(state, rng);
        return { ok: true, state };
      }

      // A failed bind costs the opening: everything stands back up.
      for (const husk of living(state, 'husks')) husk.downed = false;
      pushLog(state, `${target.name} refuses, and the others recover.`);
      commitRng(state, rng);
      state.secondWind = false;
      return { ok: true, state: endTurn(state) };
    }

    case 'skill': {
      const chosen = lookupSkill(action.skillId);
      if (action.skillId !== 'strike' && !wanderer.skillIds.includes(action.skillId)) {
        return { ok: false, reason: 'Your active Echo does not know that.' };
      }
      if (chosen.cost > wanderer.focus) {
        return { ok: false, reason: 'Not enough Focus.' };
      }

      const rng = rngFor(state);
      const earned = useSkill(state, wanderer, chosen, action.targetId, rng);
      commitRng(state, rng);
      state.secondWind = earned;
      if (earned) pushLog(state, 'Second Wind - act again.');
      if (checkOutcome(state) !== 'ongoing') return { ok: true, state };
      return { ok: true, state: endTurn(state) };
    }
  }
}
