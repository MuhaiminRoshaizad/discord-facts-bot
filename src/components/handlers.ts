/**
 * Button and select-menu presses.
 *
 * Discord leaves old components live forever, so every run-scoped press
 * carries the turn it was rendered at and is rejected if the run has moved on.
 * That is what stops a double-click buying two actions.
 */

import type { Env } from '../env';
import { ephemeral, updateMessage, reply } from '../discord/respond';
import { ComponentType, type Interaction } from '../discord/types';
import {
  deleteEchoStatement,
  getEcho,
  getRun,
  listAllies,
  listEchoes,
  newId,
  recruitAlly,
  setAllyParty,
  updatePlayer,
  updatePlayerStatement,
  type EchoRow,
} from '../db/queries';
import { takeAction, WANDERER_ID, combatant } from '../game/combat';
import { echoSpecies } from '../game/content/echoes';
import { ALL_ALLIES, PARTY_ALLY_LIMIT } from '../game/content/allies';
import { previewWeave } from '../game/weave';
import {
  acceptOffer,
  descend as goDeeper,
  retreat as leaveRift,
  settleCombat,
  takeDrawCard,
} from '../game/run';
import {
  contextFor,
  finishRun,
  loadPlayer,
  noCharacter,
  parseRunState,
  saveRun,
  type Ctx,
} from '../commands/shared';
import { renderRun } from '../commands/handlers';
import {
  confirmRow,
  COLORS,
  echoDetailEmbed,
  parseCustomId,
  runEndEmbed,
  weavePreviewEmbed,
} from '../render/embeds';

const STALE =
  'That message has moved on. Run `/descend` to pick the Rift back up where it is now.';

// --- run components -------------------------------------------------------

async function handleRun(ctx: Ctx, raw: string): Promise<Response> {
  const parsed = parseCustomId(raw);
  if (!parsed) return ephemeral('Mooji does not recognise that button.');

  const row = await getRun(ctx.env.DB, parsed.run);
  if (!row) return ephemeral('That Rift is gone.');

  // Scoped by owner, so a copied custom_id cannot drive somebody else's run.
  if (row.user_id !== ctx.userId) {
    return ephemeral('That is not your Rift.');
  }
  if (row.status !== 'active') {
    return ephemeral('That descent is already finished.');
  }
  if (row.turn !== parsed.turn) {
    return ephemeral(STALE);
  }

  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  let state = parseRunState(row);

  switch (parsed.action) {
    case 'tg': {
      state.targetId = parsed.arg;
      break;
    }

    case 'sk':
    case 'sw':
    case 'on':
    case 'bd':
    case 'rt': {
      if (parsed.action === 'rt' && state.phase !== 'combat') {
        state = leaveRift(state);
        break;
      }

      const combat = state.combat;
      if (!combat) return ephemeral('There is nothing to fight here.');

      const selected = selectedValue(ctx.interaction) ?? parsed.arg;
      const action = toCombatAction(parsed.action, selected, state.targetId, loaded.echoes);
      if (!action) return ephemeral('Mooji could not make sense of that.');

      const result = takeAction(combat, action);
      if (!result.ok) return ephemeral(result.reason);

      state.combat = result.state;
      if (result.state.outcome !== 'ongoing') state = settleCombat(state);
      break;
    }

    case 'dc': {
      if (state.phase === 'combat') return ephemeral('Finish the fight first.');
      state = goDeeper(state);
      break;
    }

    case 'dr': {
      const index = Number.parseInt(parsed.arg, 10);
      if (!Number.isFinite(index)) return ephemeral('That card is not on the table.');
      state = takeDrawCard(state, index);
      break;
    }

    case 'ac': {
      const outcome = acceptOffer(state, loaded.player.gold);
      if (!outcome.ok) return ephemeral(outcome.reason);
      if (outcome.fromBanked > 0) {
        await updatePlayer(ctx.env.DB, ctx.userId, {
          gold: loaded.player.gold - outcome.fromBanked,
        });
      }
      break;
    }

    default:
      return ephemeral('Mooji does not recognise that button.');
  }

  if (state.phase === 'ended') {
    const banked = await finishRun(ctx, row, state, loaded.player, loaded.echoes);
    const notes: string[] = [];
    if (banked.levelsGained > 0) {
      notes.push(`You reach level ${loaded.player.level + banked.levelsGained}.`);
    }
    if (banked.discarded > 0) {
      notes.push(
        `${banked.discarded} Echo${banked.discarded === 1 ? '' : 'es'} turned away - you are at capacity.`,
      );
    }
    return updateMessage({
      ...(notes.length > 0 ? { content: notes.join(' ') } : {}),
      embeds: [runEndEmbed(state, banked)],
      components: [],
    });
  }

  const turn = await saveRun(ctx, row, state, 'active');
  return updateMessage(renderRun(state, row.id, turn, loaded.echoes));
}

/** The value chosen from a select menu, if this press came from one. */
function selectedValue(interaction: Interaction): string | undefined {
  if (interaction.data?.component_type !== ComponentType.StringSelect) return undefined;
  return interaction.data.values?.[0];
}

function toCombatAction(
  action: string,
  selected: string,
  targetId: string | null,
  echoes: EchoRow[],
) {
  switch (action) {
    case 'sk':
      return {
        kind: 'skill' as const,
        skillId: selected,
        ...(targetId === null ? {} : { targetId }),
      };
    case 'sw': {
      const row = echoes.find((e) => e.id === selected);
      if (!row) return null;
      return {
        kind: 'swap' as const,
        echoRowId: row.id,
        speciesId: row.species_id,
        echoLevel: row.level,
      };
    }
    case 'on':
      return { kind: 'onslaught' as const };
    case 'bd':
      return { kind: 'bind' as const, targetId: selected };
    case 'rt':
      return { kind: 'retreat' as const };
    default:
      return null;
  }
}

// --- /echoes components ---------------------------------------------------

async function handleEcho(ctx: Ctx, raw: string): Promise<Response> {
  const [, action = ''] = raw.split('|');
  const selected = selectedValue(ctx.interaction);
  if (!selected) return ephemeral('Nothing selected.');

  const row = await getEcho(ctx.env.DB, selected);
  if (!row || row.owner_id !== ctx.userId) return ephemeral('That is not yours.');

  switch (action) {
    case 'summon':
      await updatePlayer(ctx.env.DB, ctx.userId, { active_echo_id: row.id });
      return reply({
        content: `**${echoSpecies(row.species_id).name}** answers. Its weaknesses are yours now.`,
        ephemeral: true,
      });

    case 'inspect':
      return reply({ embeds: [echoDetailEmbed(row)], ephemeral: true });

    case 'release': {
      const species = echoSpecies(row.species_id);
      return reply({
        embeds: [
          {
            title: `Release ${species.name}?`,
            description: `Level ${row.level}. This is permanent, and nothing comes back for it.`,
            color: COLORS.danger,
          },
        ],
        components: [confirmRow(`e|release-yes|${row.id}`, 'e|cancel', 'Release')],
        ephemeral: true,
      });
    }

    default:
      return ephemeral('Mooji does not recognise that.');
  }
}

async function handleEchoConfirm(ctx: Ctx, raw: string): Promise<Response> {
  const [, , echoId = ''] = raw.split('|');
  const row = await getEcho(ctx.env.DB, echoId);
  if (!row || row.owner_id !== ctx.userId) return ephemeral('That is not yours.');

  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();
  if (loaded.echoes.length <= 1) {
    return updateMessage({
      content: 'That is your last Echo. Mooji declines.',
      embeds: [],
      components: [],
    });
  }

  const statements = [deleteEchoStatement(ctx.env.DB, row.id, ctx.userId)];

  // Releasing the summoned Echo has to hand the slot to another one in the
  // same batch, or the player is left with no active Echo and cannot descend.
  if (loaded.player.active_echo_id === row.id) {
    const replacement = loaded.echoes.find((e) => e.id !== row.id);
    const update =
      replacement &&
      updatePlayerStatement(ctx.env.DB, ctx.userId, { active_echo_id: replacement.id });
    if (update) statements.push(update);
  }

  await ctx.env.DB.batch(statements);

  return updateMessage({
    content: `${echoSpecies(row.species_id).name} is released.`,
    embeds: [],
    components: [],
  });
}

// --- /weave components ----------------------------------------------------

async function handleWeaveSelect(ctx: Ctx, raw: string): Promise<Response> {
  const [, slot = ''] = raw.split('|');
  const selected = selectedValue(ctx.interaction);
  if (!selected) return ephemeral('Nothing selected.');

  // The two selects are independent messages to Discord, so the first choice
  // is carried in the second select's custom_id rather than stored anywhere.
  if (slot === 'first') {
    const loaded = await loadPlayer(ctx);
    if (!loaded) return noCharacter();
    const others = loaded.echoes.filter((e) => e.id !== selected);
    if (others.length === 0) return ephemeral('Nothing left to weave it with.');

    return reply({
      content: `First: **${echoSpecies(
        loaded.echoes.find((e) => e.id === selected)?.species_id ?? '',
      ).name}**. Now the second.`,
      components: [
        {
          type: ComponentType.ActionRow,
          components: [
            {
              type: ComponentType.StringSelect,
              custom_id: `w|pair|${selected}`,
              placeholder: 'Second Echo',
              options: others.slice(0, 25).map((row) => ({
                label: `${echoSpecies(row.species_id).name} · lv ${row.level}`,
                value: row.id,
              })),
            },
          ],
        },
      ],
      ephemeral: true,
    });
  }

  return ephemeral('Choose the first Echo before the second.');
}

async function handleWeavePair(ctx: Ctx, raw: string): Promise<Response> {
  const [, , firstId = ''] = raw.split('|');
  const secondId = selectedValue(ctx.interaction);
  if (!secondId) return ephemeral('Nothing selected.');

  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  const a = loaded.echoes.find((e) => e.id === firstId);
  const b = loaded.echoes.find((e) => e.id === secondId);
  if (!a || !b) return ephemeral('One of those is no longer yours.');

  const preview = previewWeave(
    { rowId: a.id, speciesId: a.species_id, level: a.level },
    { rowId: b.id, speciesId: b.species_id, level: b.level },
    loaded.player.level,
  );
  if (!preview.ok) return ephemeral(preview.reason);

  return reply({
    embeds: [weavePreviewEmbed(a, b, preview.outcome)],
    components: [confirmRow(`w|go|${a.id}|${b.id}`, 'w|cancel', 'Weave')],
    ephemeral: true,
  });
}

async function handleWeaveConfirm(ctx: Ctx, raw: string): Promise<Response> {
  const [, , firstId = '', secondId = ''] = raw.split('|');
  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  const a = loaded.echoes.find((e) => e.id === firstId);
  const b = loaded.echoes.find((e) => e.id === secondId);
  if (!a || !b) return ephemeral('One of those is no longer yours.');

  // Re-previewed at commit time rather than trusted from the button, because
  // the player's level could have moved since the confirmation was rendered.
  const preview = previewWeave(
    { rowId: a.id, speciesId: a.species_id, level: a.level },
    { rowId: b.id, speciesId: b.species_id, level: b.level },
    loaded.player.level,
  );
  if (!preview.ok) return ephemeral(preview.reason);

  const resultId = newId();
  await ctx.env.DB.batch([
    deleteEchoStatement(ctx.env.DB, a.id, ctx.userId),
    deleteEchoStatement(ctx.env.DB, b.id, ctx.userId),
    ctx.env.DB.prepare(
      `INSERT INTO echoes (id, owner_id, species_id, level, xp, nickname, bound_at)
       VALUES (?, ?, ?, ?, 0, NULL, ?)`,
    ).bind(resultId, ctx.userId, preview.outcome.speciesId, preview.outcome.level, ctx.now),
  ]);

  // The consumed Echo may have been the summoned one.
  if (loaded.player.active_echo_id === a.id || loaded.player.active_echo_id === b.id) {
    await updatePlayer(ctx.env.DB, ctx.userId, { active_echo_id: resultId });
  }

  return updateMessage({
    content: `**${preview.outcome.name}** comes back at level ${preview.outcome.level}.`,
    embeds: [],
    components: [],
  });
}

// --- /party components ----------------------------------------------------

async function handleParty(ctx: Ctx): Promise<Response> {
  const loaded = await loadPlayer(ctx);
  if (!loaded) return noCharacter();

  const chosen = new Set(ctx.interaction.data?.values ?? []);
  const available = ALL_ALLIES.filter((a) => a.unlockLevel <= loaded.player.level);

  if (chosen.size > PARTY_ALLY_LIMIT) {
    return ephemeral(`At most ${PARTY_ALLY_LIMIT} come with you.`);
  }

  const existing = await listAllies(ctx.env.DB, ctx.userId);
  for (const definition of available) {
    if (!existing.some((row) => row.ally_id === definition.id)) {
      await recruitAlly(ctx.env.DB, ctx.userId, definition.id, ctx.now);
    }
    const stance =
      existing.find((row) => row.ally_id === definition.id)?.stance ??
      (definition.role === 'mender' ? 'support' : 'assault');
    await setAllyParty(ctx.env.DB, ctx.userId, definition.id, chosen.has(definition.id), stance);
  }

  const names = available.filter((a) => chosen.has(a.id)).map((a) => a.name);
  return reply({
    content: names.length > 0 ? `${names.join(' and ')} will come with you.` : 'You go alone.',
    ephemeral: true,
  });
}

// --- routing --------------------------------------------------------------

export async function handleComponent(interaction: Interaction, env: Env): Promise<Response> {
  const ctx = contextFor(interaction, env);
  if (!ctx) return ephemeral('Mooji cannot tell who you are.');

  const raw = interaction.data?.custom_id ?? '';
  const [namespace = '', action = ''] = raw.split('|');

  switch (namespace) {
    case 'm':
      return handleRun(ctx, raw);
    case 'e':
      if (action === 'cancel') {
        return updateMessage({ content: 'Left alone.', embeds: [], components: [] });
      }
      if (action === 'release-yes') return handleEchoConfirm(ctx, raw);
      return handleEcho(ctx, raw);
    case 'w':
      if (action === 'cancel') {
        return updateMessage({ content: 'Nothing woven.', embeds: [], components: [] });
      }
      if (action === 'go') return handleWeaveConfirm(ctx, raw);
      if (action === 'pair') return handleWeavePair(ctx, raw);
      return handleWeaveSelect(ctx, raw);
    case 'p':
      return handleParty(ctx);
    default:
      return ephemeral('Mooji does not recognise that.');
  }
}

/** Re-exported so the fight embed and the run handler agree on the wanderer. */
export { WANDERER_ID, combatant };
