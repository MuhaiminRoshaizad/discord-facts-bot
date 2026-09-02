/**
 * Slash command handlers.
 *
 * Each one answers within Discord's three-second window: the work is a couple
 * of D1 round trips and some pure computation, both of which sit comfortably
 * inside the free plan's 10 ms of CPU.
 */

import { ephemeral, reply } from '../discord/respond';
import { ComponentType, isAdministrator } from '../discord/types';
import {
  createPlayer,
  getActiveRun,
  getGuildConfig,
  insertRun,
  ladderRank,
  listAllies,
  listDiscoveries,
  newId,
  setAnnounceChannel,
  topLadder,
  updatePlayer,
  type EchoRow,
} from '../db/queries';
import { ALL_ALLIES, PARTY_ALLY_LIMIT } from '../game/content/allies';
import { echoSpecies, STARTER_ECHO_IDS } from '../game/content/echoes';
import { createRng, seedFrom } from '../game/rng';
import {
  DESCENT_COST,
  echoCapacity,
  RESOLVE_CAP,
  secondsUntilNextResolve,
  spendResolve,
} from '../game/progression';
import { beginRun } from '../game/run';
import {
  contextFor,
  loadPlayer,
  noCharacter,
  parseRunState,
  type Ctx,
} from './shared';
import {
  codexEmbed,
  codexPageRow,
  COLORS,
  type CodexPage,
  combatComponents,
  combatEmbed,
  drawComponents,
  drawEmbed,
  echoListEmbed,
  echoSelectRow,
  eventComponents,
  eventEmbed,
  duration,
  leaderboardEmbed,
  profileEmbed,
  resolveLine,
} from '../render/embeds';
import { allHusksDowned } from '../game/combat';

export type Handler = (ctx: Ctx) => Promise<Response>;

// --- /awaken --------------------------------------------------------------

const awaken: Handler = async (ctx) => {
  const existing = await loadPlayer(ctx);
  if (existing) {
    return ephemeral('You have already awakened. `/profile` will remind you who you are.');
  }

  // The starter is drawn from the plainest Echoes, seeded on the user so the
  // same person always gets the same one however many times they retry.
  const rng = createRng(seedFrom(ctx.userId));
  const starter = rng.pick(STARTER_ECHO_IDS);
  await createPlayer(ctx.env.DB, ctx.userId, starter, ctx.now);

  const species = echoSpecies(starter);
  return reply({
    embeds: [
      {
        title: 'You awaken',
        description: `Mooji is already waiting, which it will not explain.\n\n**${species.name}** answers first.\n*${species.lore}*`,
        color: COLORS.tide,
        fields: [
          { name: 'Suit', value: species.suit, inline: true },
          { name: 'Echoes', value: `1 / ${echoCapacity(1)}`, inline: true },
          { name: 'Resolve', value: `${RESOLVE_CAP} / ${RESOLVE_CAP}`, inline: true },
        ],
        footer: { text: 'Use /descend to enter your first Rift.' },
      },
    ],
  });
};

// --- /profile -------------------------------------------------------------

const profile: Handler = async (ctx) => {
  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  const rank = ctx.guildId ? await ladderRank(ctx.env.DB, ctx.guildId, ctx.userId) : null;
  return reply({
    embeds: [profileEmbed(ctx.displayName, loaded.player, loaded.echoes, ctx.now, rank)],
  });
};

// --- /echoes --------------------------------------------------------------

const echoes: Handler = async (ctx) => {
  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  return reply({
    embeds: [echoListEmbed(loaded.player, loaded.echoes)],
    components: [
      echoSelectRow(loaded.echoes, 'e|summon', 'Summon an Echo'),
      echoSelectRow(loaded.echoes, 'e|inspect', 'Inspect an Echo'),
      echoSelectRow(loaded.echoes, 'e|release', 'Release an Echo (permanent)'),
    ],
  });
};

// --- /weave ---------------------------------------------------------------

const weave: Handler = async (ctx) => {
  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  if (loaded.echoes.length < 2) {
    return ephemeral('Weaving consumes two Echoes, and you have only one.');
  }

  return reply({
    embeds: [
      {
        title: 'Weave',
        description:
          'Choose two. Both are consumed and something else comes back.\n\nMooji will show you what before anything is destroyed.',
        color: COLORS.blight,
      },
    ],
    components: [
      echoSelectRow(loaded.echoes, 'w|first', 'First Echo'),
      echoSelectRow(loaded.echoes, 'w|second', 'Second Echo'),
    ],
    ephemeral: true,
  });
};

// --- /party ---------------------------------------------------------------

const party: Handler = async (ctx) => {
  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  const recruited = await listAllies(ctx.env.DB, ctx.userId);
  const available = ALL_ALLIES.filter((a) => a.unlockLevel <= loaded.player.level);
  const locked = ALL_ALLIES.filter((a) => a.unlockLevel > loaded.player.level);

  const lines = available.map((a) => {
    const row = recruited.find((r) => r.ally_id === a.id);
    const inParty = row?.in_party === 1;
    return `${inParty ? '▸' : ' '} **${a.name}** · ${a.role} · ${echoSpecies(a.echoSpeciesId).name}${
      inParty ? ` · ${row?.stance}` : ''
    }\n*${a.lore}*`;
  });

  const lockedLines = locked.map((a) => `· ??? — found at level ${a.unlockLevel}`);

  return reply({
    embeds: [
      {
        title: 'Party',
        description:
          lines.join('\n\n') || 'Nobody yet. Allies find you as you go deeper.',
        color: COLORS.abyss,
        fields:
          lockedLines.length > 0
            ? [{ name: 'Not yet', value: lockedLines.join('\n'), inline: false }]
            : [],
        footer: { text: `Up to ${PARTY_ALLY_LIMIT} come with you. They act on their own.` },
      },
    ],
    components:
      available.length > 0
        ? [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.StringSelect,
                  custom_id: 'p|toggle',
                  placeholder: 'Choose who comes with you',
                  min_values: 0,
                  max_values: Math.min(PARTY_ALLY_LIMIT, available.length),
                  options: available.slice(0, 25).map((a) => ({
                    label: `${a.name} · ${a.role}`,
                    value: a.id,
                    description: echoSpecies(a.echoSpeciesId).name,
                    default: recruited.some((r) => r.ally_id === a.id && r.in_party === 1),
                  })),
                },
              ],
            },
          ]
        : [],
  });
};

// --- /codex ---------------------------------------------------------------

const codex: Handler = async (ctx) => {
  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  const option = ctx.interaction.data?.options?.find((o) => o.name === 'page');
  const page = resolveCodexPage(String(option?.value ?? ''));

  const discovered = await discoveredMap(ctx);

  return reply({
    embeds: [codexEmbed(discovered, page)],
    components: [codexPageRow(page)],
  });
};

/** Tolerant of whatever the player typed - `e`, `echoes`, `Echo`, nothing. */
export function resolveCodexPage(raw: string): CodexPage {
  const value = raw.trim().toLowerCase();
  if (value.startsWith('e')) return 'echo';
  if (value.startsWith('s')) return 'skill';
  return 'husk';
}

// --- /leaderboard ---------------------------------------------------------

const leaderboard: Handler = async (ctx) => {
  if (!ctx.guildId) return ephemeral('There is no standing to show in a direct message.');
  const rows = await topLadder(ctx.env.DB, ctx.guildId);
  return reply({ embeds: [leaderboardEmbed(rows, 'this server')] });
};

// --- /setchannel ----------------------------------------------------------

const setchannel: Handler = async (ctx) => {
  if (!ctx.guildId) return ephemeral('That only means something inside a server.');
  if (!isAdministrator(ctx.interaction)) {
    return ephemeral('That one is for administrators.');
  }
  const channelId = ctx.interaction.channel_id;
  if (!channelId) return ephemeral('Mooji cannot tell which channel this is.');

  const existing = await getGuildConfig(ctx.env.DB, ctx.guildId);
  if (existing?.announce_channel_id === channelId) {
    await setAnnounceChannel(ctx.env.DB, ctx.guildId, null, ctx.now);
    return reply({ content: 'The daily digest is off.' });
  }

  await setAnnounceChannel(ctx.env.DB, ctx.guildId, channelId, ctx.now);
  return reply({
    content: `The daily digest will post here at midnight Malaysia time. Run \`/setchannel\` again to stop it.`,
  });
};

// --- /descend -------------------------------------------------------------

/**
 * Render whichever phase a run is in. Shared by the command and the buttons.
 *
 * `discovered` is what the player already knows, so the fight can show an
 * enemy's tested affinities. Without it the codex is knowledge the player
 * cannot reach at the one moment it decides anything.
 */
export function renderRun(
  state: ReturnType<typeof parseRunState>,
  runIdentifier: string,
  turn: number,
  carried: EchoRow[],
  discovered: Map<string, number>,
) {
  if (state.phase === 'combat' && state.combat) {
    return {
      embeds: [combatEmbed(state.combat, state.depth, discovered, state.targetId)],
      components: combatComponents(
        state.combat,
        runIdentifier,
        turn,
        carried,
        state.targetId,
        allHusksDowned(state.combat),
      ),
    };
  }

  if (state.phase === 'draw' && state.draw) {
    return {
      embeds: [drawEmbed(state)],
      components: drawComponents(state.draw, runIdentifier, turn),
    };
  }

  return {
    embeds: [eventEmbed(state)],
    components: eventComponents(state, runIdentifier, turn),
  };
}

const descend: Handler = async (ctx) => {
  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  // An abandoned run is resumed rather than replaced, so nobody loses a
  // descent to a closed browser tab.
  const active = await getActiveRun(ctx.env.DB, ctx.userId);
  if (active) {
    const state = parseRunState(active);
    const view = renderRun(
      state,
      active.id,
      active.turn,
      loaded.echoes,
      await discoveredMap(ctx),
    );
    return reply({ ...view, content: 'You are already in a Rift.' });
  }

  const spent = spendResolve(
    { resolve: loaded.player.resolve, updatedAt: loaded.player.resolve_updated_at },
    DESCENT_COST,
    ctx.now,
  );
  if (!spent) {
    const wait = secondsUntilNextResolve(
      { resolve: loaded.player.resolve, updatedAt: loaded.player.resolve_updated_at },
      ctx.now,
    );
    return ephemeral(
      `No Resolve left.\n${resolveLine(loaded.player, ctx.now)}${
        wait === null ? '' : `\nAnother in ${duration(wait)}.`
      }`,
    );
  }

  const activeEcho =
    loaded.echoes.find((e) => e.id === loaded.player.active_echo_id) ?? loaded.echoes[0];
  if (!activeEcho) {
    return ephemeral('You have no Echo to summon. Something has gone wrong; tell the author.');
  }

  const allies = (await listAllies(ctx.env.DB, ctx.userId))
    .filter((row) => row.in_party === 1)
    .slice(0, PARTY_ALLY_LIMIT)
    .map((row) => ({
      id: row.ally_id,
      level: loaded.player.level,
      stance: (row.stance === 'support' || row.stance === 'conserve'
        ? row.stance
        : 'assault') as 'assault' | 'support' | 'conserve',
    }));

  const identifier = newId();
  const state = beginRun(
    {
      name: ctx.displayName,
      level: loaded.player.level,
      echoRowId: activeEcho.id,
      echoSpeciesId: activeEcho.species_id,
      echoLevel: activeEcho.level,
    },
    allies,
    seedFrom(identifier),
  );

  await insertRun(
    ctx.env.DB,
    {
      id: identifier,
      user_id: ctx.userId,
      guild_id: ctx.guildId,
      seed: seedFrom(identifier),
      depth: state.depth,
      state_json: JSON.stringify(state),
      status: 'active',
      turn: 0,
    },
    ctx.now,
  );

  await updatePlayer(ctx.env.DB, ctx.userId, {
    resolve: spent.resolve,
    resolve_updated_at: spent.updatedAt,
  });

  return reply(renderRun(state, identifier, 0, loaded.echoes, await discoveredMap(ctx)));
};

/** Codex entries keyed `type:id`, for showing what is known about an enemy. */
export async function discoveredMap(ctx: Ctx): Promise<Map<string, number>> {
  const rows = await listDiscoveries(ctx.env.DB, ctx.userId);
  return new Map(rows.map((r) => [`${r.entry_type}:${r.entry_id}`, r.flags]));
}

// --- routing --------------------------------------------------------------

const HANDLERS: Record<string, Handler> = {
  awaken,
  profile,
  echoes,
  weave,
  party,
  codex,
  leaderboard,
  setchannel,
  descend,
};

export async function handleCommand(
  interaction: Parameters<typeof contextFor>[0],
  env: Parameters<typeof contextFor>[1],
): Promise<Response> {
  const ctx = contextFor(interaction, env);
  if (!ctx) return ephemeral('Mooji cannot tell who you are.');

  const handler = HANDLERS[interaction.data?.name ?? ''];
  if (!handler) return ephemeral('That command is not one Mooji knows.');

  return handler(ctx);
}
