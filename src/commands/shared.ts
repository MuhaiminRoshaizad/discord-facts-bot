/**
 * Shared plumbing for commands and component presses.
 *
 * Anything that has to happen the same way in more than one place - loading a
 * player, saving a run, paying out spoils - lives here so the two entry points
 * cannot drift apart.
 */

import type { Env } from '../env';
import { ephemeral } from '../discord/respond';
import { interactionUser, type Interaction } from '../discord/types';
import {
  addLadderScoreStatement,
  discoverStatement,
  getPlayerWithResolve,
  insertEchoStatement,
  listEchoes,
  newId,
  nowSeconds,
  updatePlayerStatement,
  updateEchoStatement,
  updateRunStatement,
  type EchoRow,
  type PlayerRow,
  type RunRow,
} from '../db/queries';
import { applyEchoXp, applyXp, echoCapacity, echoXpShare } from '../game/progression';
import { keepsSpoils, type RunState } from '../game/run';

export interface Ctx {
  env: Env;
  interaction: Interaction;
  userId: string;
  displayName: string;
  guildId: string | null;
  now: number;
}

export function contextFor(interaction: Interaction, env: Env): Ctx | null {
  const user = interactionUser(interaction);
  if (!user) return null;
  return {
    env,
    interaction,
    userId: user.id,
    displayName: user.global_name ?? user.username,
    guildId: interaction.guild_id ?? null,
    now: nowSeconds(),
  };
}

export const NO_CHARACTER =
  'You have not awakened yet. Run `/awaken` and Mooji will see to it.';

export function noCharacter(): Response {
  return ephemeral(NO_CHARACTER);
}

export interface Loaded {
  player: PlayerRow;
  echoes: EchoRow[];
}

/** Load a player and their Echoes, with Resolve already projected forward. */
export async function loadPlayer(ctx: Ctx): Promise<Loaded | null> {
  const found = await getPlayerWithResolve(ctx.env.DB, ctx.userId, ctx.now);
  if (!found) return null;
  const echoes = await listEchoes(ctx.env.DB, ctx.userId);
  return { player: found.player, echoes };
}

export function parseRunState(row: RunRow): RunState {
  return JSON.parse(row.state_json) as RunState;
}

/** Persist a run mid-descent, bumping the turn so old buttons stop working. */
export async function saveRun(
  ctx: Ctx,
  row: RunRow,
  state: RunState,
  status: string,
): Promise<number> {
  const turn = row.turn + 1;
  await updateRunStatement(
    ctx.env.DB,
    row.id,
    {
      state_json: JSON.stringify(state),
      status,
      turn,
      depth: state.depth,
    },
    ctx.now,
  ).run();
  return turn;
}

export interface Banked {
  xp: number;
  gold: number;
  echoes: string[];
  levelsGained: number;
  discarded: number;
}

/**
 * Close a run and pay out.
 *
 * Everything lands in one batch so a run cannot half-settle: it is the moment
 * XP, gold, new Echoes, codex entries and the ladder all move together.
 */
export async function finishRun(
  ctx: Ctx,
  row: RunRow,
  state: RunState,
  player: PlayerRow,
  echoes: EchoRow[],
): Promise<Banked> {
  const pays = keepsSpoils(state);
  // XP is kept whatever happened - a bad run should still move you forward.
  // Gold and anything bound are what a defeat actually costs.
  const xp = state.pendingXp;
  const gold = pays ? state.pendingGold : 0;

  const levelled = applyXp(player.level, player.xp, xp);
  const statements: D1PreparedStatement[] = [];

  // Echoes learn from the run too, the summoned one fastest.
  for (const echo of echoes) {
    const share = echoXpShare(xp, echo.id === player.active_echo_id, echo.level, levelled.level);
    if (share <= 0) continue;
    const grown = applyEchoXp(echo.level, echo.xp, share, levelled.level);
    statements.push(updateEchoStatement(ctx.env.DB, echo.id, grown.level, grown.xp));
  }

  // Anything bound beyond capacity is turned away rather than silently lost,
  // and the player is told how many.
  const capacity = echoCapacity(levelled.level);
  let room = Math.max(0, capacity - echoes.length);
  const kept: string[] = [];
  let discarded = 0;

  if (pays) {
    for (const speciesId of state.pendingEchoes) {
      if (room <= 0) {
        discarded++;
        continue;
      }
      kept.push(speciesId);
      room--;
      statements.push(
        insertEchoStatement(ctx.env.DB, newId(), ctx.userId, speciesId, 1, ctx.now),
      );
    }
  }

  const playerUpdate = updatePlayerStatement(ctx.env.DB, ctx.userId, {
    level: levelled.level,
    xp: levelled.xp,
    gold: player.gold + gold,
  });
  if (playerUpdate) statements.push(playerUpdate);

  statements.push(
    updateRunStatement(
      ctx.env.DB,
      row.id,
      {
        state_json: JSON.stringify(state),
        status: state.ending ?? 'retreated',
        turn: row.turn + 1,
        depth: state.depth,
      },
      ctx.now,
    ),
  );

  // Codex: everything met across the whole descent, with the elements actually
  // tried against each one folded into the reveal mask.
  const struck = state.struck ?? {};
  const met = new Set<string>([...state.met, ...Object.keys(struck)]);
  for (const speciesId of met) {
    statements.push(
      discoverStatement(ctx.env.DB, ctx.userId, 'husk', speciesId, struck[speciesId] ?? 0, ctx.now),
    );
  }
  for (const speciesId of kept) {
    statements.push(
      discoverStatement(ctx.env.DB, ctx.userId, 'echo', speciesId, 0xff, ctx.now),
    );
  }

  if (ctx.guildId) {
    const points = state.depth * 10 + (state.ending === 'completed' ? 100 : 0);
    statements.push(
      addLadderScoreStatement(ctx.env.DB, ctx.guildId, ctx.userId, points, ctx.now),
    );
  }

  await ctx.env.DB.batch(statements);

  return {
    xp,
    gold,
    echoes: kept,
    levelsGained: levelled.levelsGained,
    discarded,
  };
}

