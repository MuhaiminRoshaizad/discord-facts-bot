/**
 * The command surface, as Discord needs it registered.
 *
 * Kept as data next to the handlers so the two cannot drift: adding a command
 * without listing it here means it never reaches Discord, and listing one
 * without a handler is caught by the router's exhaustiveness.
 */

import { ApplicationCommandOptionType } from '../discord/types';

export interface CommandDefinition {
  name: string;
  description: string;
  options?: {
    name: string;
    description: string;
    type: number;
    required?: boolean;
  }[];
  /** Discord permission bitfield required to see the command at all. */
  default_member_permissions?: string;
}

const ADMINISTRATOR = (1n << 3n).toString();

export const COMMANDS: CommandDefinition[] = [
  {
    name: 'awaken',
    description: 'Become a Wanderer and receive your first Echo.',
  },
  {
    name: 'descend',
    description: 'Enter a Rift, or return to the one you left.',
  },
  {
    name: 'echoes',
    description: 'The Echoes you carry. Summon, inspect, or release one.',
  },
  {
    name: 'weave',
    description: 'Consume two Echoes to make a stronger one.',
  },
  {
    name: 'party',
    description: 'Choose which Allies come with you, and how they fight.',
  },
  {
    name: 'codex',
    description: 'Everything you have met, and what you learned about it.',
    options: [
      {
        name: 'page',
        description: 'Which half of the codex to open.',
        type: ApplicationCommandOptionType.String,
        required: false,
      },
    ],
  },
  {
    name: 'profile',
    description: 'Your level, Resolve, gold and standing.',
  },
  {
    name: 'leaderboard',
    description: 'How this server is doing in the Rifts.',
  },
  {
    name: 'setchannel',
    description: 'Choose where the daily digest is posted.',
    default_member_permissions: ADMINISTRATOR,
  },
];
