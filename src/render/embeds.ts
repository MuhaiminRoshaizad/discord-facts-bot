/**
 * Everything the player actually sees.
 *
 * All embed and component construction lives here so the commands stay about
 * rules and persistence, and so the visual language stays consistent without
 * anyone having to remember it.
 */

import { ELEMENT_EMOJI, ELEMENT_LABEL, AFFINITY_LABEL } from '../game/affinity';
import { ALL_ECHO_SPECIES, echoSpecies } from '../game/content/echoes';
import { ALL_HUSK_SPECIES } from '../game/content/husks';
import { ALL_SKILLS, skill as lookupSkill } from '../game/content/skills';
import { SUIT_LABEL } from '../game/content/suits';
import {
  combatant,
  living,
  usableSkills,
  WANDERER_ID,
  type CombatState,
} from '../game/combat';
import { describeCard, type DrawCard } from '../game/draw';
import { EVENT_TITLE, type RiftEvent } from '../game/encounter';
import { MAX_DEPTH, type RunState } from '../game/run';
import {
  echoCapacity,
  RESOLVE_CAP,
  secondsUntilNextResolve,
  xpToNext,
} from '../game/progression';
import { ELEMENTS, type AffinityTable } from '../game/types';
import {
  ButtonStyle,
  ComponentType,
  type ActionRow,
  type ButtonComponent,
  type Embed,
  type SelectOption,
} from '../discord/types';
import type { EchoRow, PlayerRow } from '../db/queries';

/**
 * A deliberate palette rather than Discord's defaults: cold abyss blues for
 * structure, warm amber for reward, and a single red reserved for anything
 * destructive so it never reads as decoration.
 */
export const COLORS = {
  abyss: 0x1e2749,
  tide: 0x2a9d8f,
  ember: 0xe9a03c,
  blight: 0x7b5ea7,
  danger: 0xc1454b,
  success: 0x5fa65b,
  muted: 0x6b7a99,
} as const;

// --- small helpers --------------------------------------------------------

export function bar(current: number, max: number, width = 10): string {
  const safeMax = Math.max(1, max);
  const filled = Math.max(0, Math.min(width, Math.round((current / safeMax) * width)));
  return `${'█'.repeat(filled)}${'░'.repeat(width - filled)}`;
}

export function duration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${whole}s`;
}

export function stars(rarity: number): string {
  return `${'★'.repeat(rarity)}${'☆'.repeat(Math.max(0, 5 - rarity))}`;
}

/** Affinities as a compact line. Hidden entries show as a dash. */
export function affinityLine(table: AffinityTable, revealed?: number): string {
  return ELEMENTS.map((element, index) => {
    const hidden = revealed !== undefined && (revealed & (1 << index)) === 0;
    const state = table[element] ?? 'neutral';
    if (hidden) return `${ELEMENT_EMOJI[element]}?`;
    if (state === 'neutral') return `${ELEMENT_EMOJI[element]}-`;
    return `${ELEMENT_EMOJI[element]}${AFFINITY_LABEL[state]}`;
  }).join('  ');
}

export function resolveLine(player: PlayerRow, now: number): string {
  const next = secondsUntilNextResolve(
    { resolve: player.resolve, updatedAt: player.resolve_updated_at },
    now,
  );
  const dots = `${'◆'.repeat(player.resolve)}${'◇'.repeat(
    Math.max(0, RESOLVE_CAP - player.resolve),
  )}`;
  return next === null ? `${dots}  full` : `${dots}  +1 in ${duration(next)}`;
}

// --- custom ids -----------------------------------------------------------

export const CUSTOM_ID_PREFIX = 'm';

export type RunAction = 'sk' | 'sw' | 'tg' | 'on' | 'bd' | 'rt' | 'dc' | 'dr' | 'ac';

/**
 * `m|<action>|<runId>|<turn>|<arg>`.
 *
 * The turn is carried so a press from a stale message can be rejected rather
 * than granting a second action - Discord leaves old buttons live forever.
 */
export function runId(action: RunAction, run: string, turn: number, arg = ''): string {
  return `${CUSTOM_ID_PREFIX}|${action}|${run}|${turn}|${arg}`;
}

export interface ParsedCustomId {
  action: string;
  run: string;
  turn: number;
  arg: string;
}

export function parseCustomId(raw: string): ParsedCustomId | null {
  const parts = raw.split('|');
  if (parts.length < 4 || parts[0] !== CUSTOM_ID_PREFIX) return null;
  const turn = Number.parseInt(parts[3] ?? '', 10);
  if (!Number.isFinite(turn)) return null;
  return {
    action: parts[1] ?? '',
    run: parts[2] ?? '',
    turn,
    arg: parts.slice(4).join('|'),
  };
}

// --- profile --------------------------------------------------------------

export function profileEmbed(
  name: string,
  player: PlayerRow,
  echoes: EchoRow[],
  now: number,
  rank: { rank: number; score: number } | null,
): Embed {
  const active = echoes.find((e) => e.id === player.active_echo_id) ?? echoes[0];
  const species = active ? echoSpecies(active.species_id) : null;

  const fields = [
    {
      name: 'Wanderer',
      value: `Level ${player.level}\n${bar(player.xp, xpToNext(player.level))} ${player.xp} / ${xpToNext(player.level)} xp`,
      inline: true,
    },
    {
      name: 'Resolve',
      value: resolveLine(player, now),
      inline: true,
    },
    {
      name: 'Gold',
      value: `${player.gold}`,
      inline: true,
    },
    {
      name: 'Summoned',
      value: species
        ? `**${species.name}** · ${SUIT_LABEL[species.suit]} · lv ${active?.level}\n${affinityLine(species.affinities)}`
        : 'Nothing. Use `/echoes` to summon one.',
      inline: false,
    },
    {
      name: 'Echoes',
      value: `${echoes.length} / ${echoCapacity(player.level)} bound`,
      inline: true,
    },
  ];

  if (rank) {
    fields.push({ name: 'Standing', value: `#${rank.rank} · ${rank.score}`, inline: true });
  }

  return {
    title: name,
    color: COLORS.abyss,
    fields,
    footer: { text: 'Mooji keeps the Threshold' },
  };
}

// --- echoes ---------------------------------------------------------------

export function echoListEmbed(player: PlayerRow, echoes: EchoRow[]): Embed {
  if (echoes.length === 0) {
    return {
      title: 'No Echoes',
      description: 'Nothing answers. Use `/awaken` if you have not already.',
      color: COLORS.muted,
    };
  }

  const lines = echoes.map((row) => {
    const species = echoSpecies(row.species_id);
    const active = row.id === player.active_echo_id ? '▸ ' : ' ';
    return `${active}**${species.name}** · ${SUIT_LABEL[species.suit]} · lv ${row.level} · ${stars(species.rarity)}`;
  });

  return {
    title: `Bound Echoes  ${echoes.length} / ${echoCapacity(player.level)}`,
    description: lines.join('\n'),
    color: COLORS.tide,
    footer: {
      text:
        echoes.length >= echoCapacity(player.level)
          ? 'At capacity. Release or weave before binding anything new.'
          : 'Select one to summon it.',
    },
  };
}

export function echoDetailEmbed(row: EchoRow): Embed {
  const species = echoSpecies(row.species_id);
  const known = species.learnset
    .filter((entry) => entry.level <= row.level)
    .map((entry) => {
      const s = lookupSkill(entry.skillId);
      return `${ELEMENT_EMOJI[s.element]} **${s.name}** · ${s.cost} Focus — ${s.description}`;
    });

  const next = species.learnset.find((entry) => entry.level > row.level);

  return {
    title: `${species.name}`,
    description: `*${species.lore}*`,
    color: COLORS.tide,
    fields: [
      { name: 'Suit', value: SUIT_LABEL[species.suit], inline: true },
      { name: 'Rarity', value: stars(species.rarity), inline: true },
      { name: 'Level', value: `${row.level}`, inline: true },
      { name: 'Affinities', value: affinityLine(species.affinities), inline: false },
      {
        name: 'Skills',
        value: known.length > 0 ? known.join('\n') : 'None yet.',
        inline: false,
      },
      ...(next
        ? [
            {
              name: 'Next',
              value: `${lookupSkill(next.skillId).name} at level ${next.level}`,
              inline: false,
            },
          ]
        : []),
    ],
  };
}

export function echoSelectRow(
  echoes: EchoRow[],
  customId: string,
  placeholder: string,
): ActionRow {
  const options: SelectOption[] = echoes.slice(0, 25).map((row) => {
    const species = echoSpecies(row.species_id);
    return {
      label: `${species.name} · lv ${row.level}`,
      value: row.id,
      description: `${SUIT_LABEL[species.suit]} · ${stars(species.rarity)}`,
    };
  });

  return {
    type: ComponentType.ActionRow,
    components: [{ type: ComponentType.StringSelect, custom_id: customId, placeholder, options }],
  };
}

// --- combat ---------------------------------------------------------------

function combatantLine(name: string, hp: number, maxHp: number, downed: boolean): string {
  return `${downed ? '↓ ' : ' '}${name.padEnd(14).slice(0, 14)} ${bar(hp, maxHp)} ${hp}/${maxHp}`;
}

export function combatEmbed(state: CombatState, depth: number): Embed {
  const party = state.combatants.filter((c) => c.side === 'party');
  const husks = state.combatants.filter((c) => c.side === 'husks');
  const self = combatant(state, WANDERER_ID);
  const species = echoSpecies(state.activeSpeciesId);

  const husksBlock = husks
    .map((h) => {
      const veil = (h.veilRemaining ?? 0) > 0 ? ` ⛨${h.veilRemaining}` : '';
      return combatantLine(h.name, h.hp, h.maxHp, h.downed) + veil;
    })
    .join('\n');

  const partyBlock = party
    .map((c) => combatantLine(c.name, c.hp, c.maxHp, c.downed))
    .join('\n');

  return {
    title: `Depth ${depth} · Round ${state.round}`,
    color: state.secondWind ? COLORS.ember : COLORS.abyss,
    fields: [
      { name: 'Husks', value: `\`\`\`\n${husksBlock}\n\`\`\``, inline: false },
      { name: 'Party', value: `\`\`\`\n${partyBlock}\n\`\`\``, inline: false },
      {
        name: 'Summoned',
        value: `**${species.name}**  ·  Focus ${self?.focus ?? 0}/${self?.maxFocus ?? 0}\n${affinityLine(species.affinities)}`,
        inline: false,
      },
      ...(state.log.length > 0
        ? [{ name: 'Log', value: state.log.map((l) => `> ${l}`).join('\n'), inline: false }]
        : []),
    ],
    footer: {
      text: state.secondWind
        ? 'Second Wind - act again.'
        : 'Hit a weakness to knock them down and act again.',
    },
  };
}

export function combatComponents(
  state: CombatState,
  run: string,
  turn: number,
  echoes: EchoRow[],
  targetId: string | null,
  allDowned: boolean,
): ActionRow[] {
  const rows: ActionRow[] = [];
  const self = combatant(state, WANDERER_ID);
  const husks = living(state, 'husks');

  if (self) {
    const options: SelectOption[] = usableSkills(self)
      .slice(0, 25)
      .map((s) => ({
        label: `${s.name} · ${s.cost === 0 ? 'free' : `${s.cost} Focus`}`,
        value: s.id,
        description: `${ELEMENT_LABEL[s.element]} · ${s.description}`.slice(0, 100),
        emoji: { name: ELEMENT_EMOJI[s.element] },
      }));

    rows.push({
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.StringSelect,
          custom_id: runId('sk', run, turn),
          placeholder: 'Act',
          options,
        },
      ],
    });
  }

  const swappable = echoes.filter((row) => row.id !== state.activeEchoId).slice(0, 25);
  if (swappable.length > 0 && !state.swappedThisTurn) {
    rows.push({
      type: ComponentType.ActionRow,
      components: [
        {
          type: ComponentType.StringSelect,
          custom_id: runId('sw', run, turn),
          placeholder: 'Summon a different Echo (free)',
          options: swappable.map((row) => {
            const species = echoSpecies(row.species_id);
            return {
              label: `${species.name} · lv ${row.level}`,
              value: row.id,
              description: affinityLine(species.affinities).slice(0, 100),
            };
          }),
        },
      ],
    });
  }

  if (husks.length > 1) {
    rows.push({
      type: ComponentType.ActionRow,
      components: husks.slice(0, 5).map<ButtonComponent>((h) => ({
        type: ComponentType.Button,
        style: h.id === targetId ? ButtonStyle.Primary : ButtonStyle.Secondary,
        label: `${h.name}${h.downed ? ' (down)' : ''}`.slice(0, 80),
        custom_id: runId('tg', run, turn, h.id),
      })),
    });
  }

  const finishers: ButtonComponent[] = [];
  if (allDowned) {
    finishers.push({
      type: ComponentType.Button,
      style: ButtonStyle.Success,
      label: 'Onslaught',
      custom_id: runId('on', run, turn),
    });
    const bindTarget = targetId ?? husks[0]?.id;
    if (bindTarget) {
      finishers.push({
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: 'Bind',
        custom_id: runId('bd', run, turn, bindTarget),
      });
    }
  }
  finishers.push({
    type: ComponentType.Button,
    style: ButtonStyle.Danger,
    label: 'Retreat',
    custom_id: runId('rt', run, turn),
  });
  rows.push({ type: ComponentType.ActionRow, components: finishers });

  return rows;
}

// --- rift steps -----------------------------------------------------------

export function eventEmbed(state: RunState): Embed {
  const event = state.event;
  const title = event ? EVENT_TITLE[event.kind] : 'The Rift';

  const lines: string[] = [];
  if (state.notice) lines.push(state.notice);

  if (event?.kind === 'negotiation' && event.offerSpeciesId) {
    const species = echoSpecies(event.offerSpeciesId);
    lines.push(
      `**${species.name}** will come with you for **${event.offerCost}** gold.`,
      `*${species.lore}*`,
      affinityLine(species.affinities),
    );
  }

  return {
    title: `Depth ${state.depth} · ${title}`,
    description: lines.join('\n\n') || 'Nothing here but the way down.',
    color: COLORS.abyss,
    fields: [
      {
        name: 'Carried',
        value: `HP ${state.hp} · Focus ${state.focus}\n${state.pendingGold} gold · ${state.pendingXp} xp unbanked`,
        inline: false,
      },
    ],
    footer: { text: `Retreat banks everything. Depth ${state.depth} of ${MAX_DEPTH}.` },
  };
}

export function eventComponents(state: RunState, run: string, turn: number): ActionRow[] {
  const buttons: ButtonComponent[] = [];

  if (state.event?.kind === 'negotiation' && state.event.offerSpeciesId) {
    buttons.push({
      type: ComponentType.Button,
      style: ButtonStyle.Success,
      label: `Accept · ${state.event.offerCost} gold`,
      custom_id: runId('ac', run, turn),
    });
  }

  buttons.push({
    type: ComponentType.Button,
    style: ButtonStyle.Primary,
    label: state.depth >= MAX_DEPTH ? 'Leave the Rift' : 'Go deeper',
    custom_id: runId('dc', run, turn),
  });

  buttons.push({
    type: ComponentType.Button,
    style: ButtonStyle.Danger,
    label: 'Retreat',
    custom_id: runId('rt', run, turn),
  });

  return [{ type: ComponentType.ActionRow, components: buttons }];
}

export function drawEmbed(state: RunState): Embed {
  return {
    title: 'The Draw',
    description:
      'Three cards, face down. The Onslaught earned them; only one comes with you.',
    color: COLORS.ember,
    footer: { text: `Depth ${state.depth}` },
  };
}

export function drawComponents(cards: DrawCard[], run: string, turn: number): ActionRow[] {
  return [
    {
      type: ComponentType.ActionRow,
      components: cards.map<ButtonComponent>((_card, index) => ({
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: `Card ${index + 1}`,
        custom_id: runId('dr', run, turn, `${index}`),
      })),
    },
  ];
}

export function runEndEmbed(state: RunState, banked: { xp: number; gold: number; echoes: string[] }): Embed {
  const headline: Record<string, { title: string; color: number; line: string }> = {
    completed: {
      title: 'The Rift closes behind you',
      color: COLORS.success,
      line: 'You went the whole way down and came back up.',
    },
    retreated: {
      title: 'You withdraw',
      color: COLORS.tide,
      line: 'Everything you were carrying comes with you.',
    },
    defeated: {
      title: 'You fall',
      color: COLORS.danger,
      line: 'The gold stays in the Rift. What you learned does not.',
    },
  };

  const chosen = headline[state.ending ?? 'retreated'] ?? headline.retreated!;
  const names = banked.echoes.map((id) => echoSpecies(id).name);

  return {
    title: chosen.title,
    description: chosen.line,
    color: chosen.color,
    fields: [
      { name: 'Depth reached', value: `${state.depth} of ${MAX_DEPTH}`, inline: true },
      { name: 'Experience', value: `${banked.xp}`, inline: true },
      { name: 'Gold', value: `${banked.gold}`, inline: true },
      ...(names.length > 0
        ? [{ name: 'Bound', value: names.join(', '), inline: false }]
        : []),
    ],
    footer: { text: 'Use /descend when Resolve allows.' },
  };
}

// --- codex ----------------------------------------------------------------

export type CodexPage = 'husk' | 'echo' | 'skill';

/**
 * The reference, and the collection meta-game in one.
 *
 * Every entry is listed, including ones never met - the shape of what is
 * missing is half the appeal. What is *withheld* is the specific knowledge:
 * a Husk you have not met shows as `???`, and one you have shows only the
 * affinities you have actually tested. There is no way to look a weakness up;
 * you find it by hitting the thing.
 *
 * Skills are not withheld. Knowing what Cinder costs is reference, not a
 * spoiler, and hiding it would only make the game harder to read.
 */
export function codexEmbed(discovered: Map<string, number>, page: CodexPage): Embed {
  if (page === 'skill') {
    const byElement = ELEMENTS.map((element) => {
      const entries = ALL_SKILLS.filter((s) => s.element === element);
      if (entries.length === 0) return null;
      return {
        name: `${ELEMENT_EMOJI[element]} ${ELEMENT_LABEL[element]}`,
        value: entries
          .map((s) => {
            const effect =
              s.kind === 'damage'
                ? `${s.power} power${s.aoe ? ', all' : ''}`
                : s.kind === 'heal'
                  ? `${s.power} healing${s.party ? ', party' : ''}`
                  : `${s.stages > 0 ? '+' : ''}${s.stages} ${s.stat.toUpperCase()}`;
            return `**${s.name}** · ${s.cost === 0 ? 'free' : `${s.cost} Focus`} · ${effect}\n${s.description}`;
          })
          .join('\n')
          .slice(0, 1024),
        inline: false,
      };
    }).filter((field): field is NonNullable<typeof field> => field !== null);

    return {
      title: 'Codex · Skills',
      description: `${ALL_SKILLS.length} skills. Every Echo learns its own as it levels.`,
      color: COLORS.blight,
      fields: byElement.slice(0, 25),
      footer: { text: 'Damage is scaled by ATK against the target DEF, then by affinity.' },
    };
  }

  if (page === 'echo') {
    const lines = ALL_ECHO_SPECIES.map((species) => {
      const seen = discovered.has(`echo:${species.id}`);
      if (!seen) return `\`???\` · ${SUIT_LABEL[species.suit]} · ${stars(species.rarity)}`;
      return `**${species.name}** · ${SUIT_LABEL[species.suit]} · ${stars(species.rarity)}\n${affinityLine(species.affinities)}`;
    });

    const found = ALL_ECHO_SPECIES.filter((s) => discovered.has(`echo:${s.id}`)).length;
    return {
      title: 'Codex · Echoes',
      description: lines.join('\n').slice(0, 4000),
      color: COLORS.tide,
      footer: {
        text: `${found} of ${ALL_ECHO_SPECIES.length} bound · an Echo you carry shows everything`,
      },
    };
  }

  const lines = ALL_HUSK_SPECIES.map((species) => {
    const flags = discovered.get(`husk:${species.id}`);
    if (flags === undefined) return `\`???\` · ${species.rank}`;
    return `**${species.name}** · ${species.rank} · ${SUIT_LABEL[species.suit]}\n${affinityLine(species.affinities, flags)}`;
  });

  const found = ALL_HUSK_SPECIES.filter((s) => discovered.has(`husk:${s.id}`)).length;
  return {
    title: 'Codex · Husks',
    description: lines.join('\n').slice(0, 4000),
    color: COLORS.blight,
    footer: {
      text: `${found} of ${ALL_HUSK_SPECIES.length} met · ? means untested — hit it with that element to find out`,
    },
  };
}

export function codexPageRow(current: CodexPage): ActionRow {
  const pages: { id: CodexPage; label: string }[] = [
    { id: 'husk', label: 'Husks' },
    { id: 'echo', label: 'Echoes' },
    { id: 'skill', label: 'Skills' },
  ];

  return {
    type: ComponentType.ActionRow,
    components: pages.map<ButtonComponent>((page) => ({
      type: ComponentType.Button,
      style: page.id === current ? ButtonStyle.Primary : ButtonStyle.Secondary,
      label: page.label,
      custom_id: `c|page|${page.id}`,
    })),
  };
}

// --- weaving --------------------------------------------------------------

export function weavePreviewEmbed(
  a: EchoRow,
  b: EchoRow,
  outcome: { name: string; speciesId: string; level: number; inheritedSkillIds: string[] },
): Embed {
  const result = echoSpecies(outcome.speciesId);
  const inherited = outcome.inheritedSkillIds.map((id) => lookupSkill(id).name);

  return {
    title: 'Weave',
    description: `**${echoSpecies(a.species_id).name}** (lv ${a.level}) and **${echoSpecies(b.species_id).name}** (lv ${b.level}) become **${result.name}** at level ${outcome.level}.`,
    color: COLORS.danger,
    fields: [
      { name: 'Suit', value: SUIT_LABEL[result.suit], inline: true },
      { name: 'Rarity', value: stars(result.rarity), inline: true },
      { name: 'Affinities', value: affinityLine(result.affinities), inline: false },
      {
        name: 'Inherited',
        value: inherited.length > 0 ? inherited.join(', ') : 'Nothing the result did not already know.',
        inline: false,
      },
    ],
    footer: { text: 'Both parents are consumed. This cannot be undone.' },
  };
}

export function confirmRow(
  confirmId: string,
  cancelId: string,
  confirmLabel: string,
): ActionRow {
  return {
    type: ComponentType.ActionRow,
    components: [
      {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: confirmLabel,
        custom_id: confirmId,
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: 'Cancel',
        custom_id: cancelId,
      },
    ],
  };
}

// --- leaderboard ----------------------------------------------------------

export function leaderboardEmbed(
  rows: { user_id: string; score: number }[],
  guildName: string,
): Embed {
  const lines = rows.map((row, index) => `**${index + 1}.** <@${row.user_id}> — ${row.score}`);
  return {
    title: `Standing · ${guildName}`,
    description: lines.join('\n') || 'Nobody has descended yet.',
    color: COLORS.ember,
    footer: { text: 'Score comes from depth reached and Wardens felled.' },
  };
}
