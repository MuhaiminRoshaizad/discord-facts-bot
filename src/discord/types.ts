/**
 * The slice of Discord's interaction API that Mooji actually uses.
 *
 * Declared as const objects rather than TypeScript enums because
 * `isolatedModules` forbids `const enum`, and plain enums emit runtime code we
 * do not need.
 */

export const InteractionType = {
  Ping: 1,
  ApplicationCommand: 2,
  MessageComponent: 3,
  Autocomplete: 4,
  ModalSubmit: 5,
} as const;

export const InteractionResponseType = {
  Pong: 1,
  ChannelMessageWithSource: 4,
  DeferredChannelMessageWithSource: 5,
  DeferredUpdateMessage: 6,
  UpdateMessage: 7,
} as const;

export const MessageFlags = {
  /** Only the invoking user sees the message. */
  Ephemeral: 1 << 6,
} as const;

export const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
} as const;

export const ButtonStyle = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
  Link: 5,
} as const;

export const ApplicationCommandOptionType = {
  SubCommand: 1,
  String: 3,
  Integer: 4,
  Boolean: 5,
  User: 6,
  Channel: 7,
} as const;

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Embed {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: { text: string };
  thumbnail?: { url: string };
  timestamp?: string;
}

export interface ButtonComponent {
  type: typeof ComponentType.Button;
  style: (typeof ButtonStyle)[keyof typeof ButtonStyle];
  label: string;
  custom_id?: string;
  url?: string;
  emoji?: { name: string };
  disabled?: boolean;
}

export interface SelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: { name: string };
  default?: boolean;
}

export interface StringSelectComponent {
  type: typeof ComponentType.StringSelect;
  custom_id: string;
  placeholder?: string;
  options: SelectOption[];
  disabled?: boolean;
  min_values?: number;
  max_values?: number;
}

export interface ActionRow {
  type: typeof ComponentType.ActionRow;
  components: (ButtonComponent | StringSelectComponent)[];
}

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
}

export interface GuildMember {
  user?: DiscordUser;
  /** Bitfield string. Present on guild interactions. */
  permissions?: string;
}

export interface CommandOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: CommandOption[];
}

export interface Interaction {
  id: string;
  type: number;
  token: string;
  application_id: string;
  guild_id?: string;
  channel_id?: string;
  member?: GuildMember;
  user?: DiscordUser;
  data?: {
    /** Command name, for application commands. */
    name?: string;
    options?: CommandOption[];
    /** Component identifier, for message components. */
    custom_id?: string;
    component_type?: number;
    values?: string[];
  };
}

/**
 * The invoking user, whether the interaction came from a guild (where the user
 * sits under `member`) or a DM (where it sits at the top level).
 */
export function interactionUser(interaction: Interaction): DiscordUser | undefined {
  return interaction.member?.user ?? interaction.user;
}

/** Discord's Administrator permission bit. */
const ADMINISTRATOR = 1n << 3n;

/** Whether the invoking member holds Administrator in this guild. */
export function isAdministrator(interaction: Interaction): boolean {
  const permissions = interaction.member?.permissions;
  if (!permissions) return false;
  try {
    return (BigInt(permissions) & ADMINISTRATOR) === ADMINISTRATOR;
  } catch {
    return false;
  }
}
