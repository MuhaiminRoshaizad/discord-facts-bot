/**
 * Register the slash commands with Discord.
 *
 * Run once after changing src/commands/definitions.ts:
 *
 *   DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... npm run register
 *
 * Set DISCORD_TEST_GUILD_ID as well while developing. Guild commands appear
 * immediately; global ones take up to an hour to propagate, which is a long
 * time to spend wondering whether the deploy worked.
 */

import { COMMANDS } from '../src/commands/definitions.ts';

const applicationId = process.env['DISCORD_APPLICATION_ID'];
const token = process.env['DISCORD_BOT_TOKEN'];
const guildId = process.env['DISCORD_TEST_GUILD_ID'];

if (!applicationId || !token) {
  console.error('DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN must both be set.');
  process.exit(1);
}

const url = guildId
  ? `https://discord.com/api/v10/applications/${applicationId}/guilds/${guildId}/commands`
  : `https://discord.com/api/v10/applications/${applicationId}/commands`;

const response = await fetch(url, {
  method: 'PUT',
  headers: {
    'content-type': 'application/json',
    authorization: `Bot ${token}`,
  },
  body: JSON.stringify(COMMANDS),
});

if (!response.ok) {
  console.error(`Discord refused the registration: ${response.status}`);
  console.error(await response.text());
  process.exit(1);
}

const registered = (await response.json()) as { name: string }[];
console.log(
  `Registered ${registered.length} command(s) ${guildId ? `to guild ${guildId}` : 'globally'}:`,
);
for (const command of registered) console.log(`  /${command.name}`);
