/**
 * Register the slash commands with Discord.
 *
 * Run once after changing src/commands/definitions.ts:
 *
 *   npm run register
 *
 * Credentials are read from .dev.vars - the same gitignored file wrangler dev
 * uses - so there is one place to put them and no shell-specific way to pass
 * them. PowerShell has no inline environment-variable prefix, so telling
 * people to write `VAR=x npm run register` simply does not work on Windows.
 *
 * Set DISCORD_TEST_GUILD_ID there too while developing. Guild commands appear
 * immediately; global ones take up to an hour to propagate, which is a long
 * time to spend wondering whether the deploy worked.
 */

import { COMMANDS } from '../src/commands/definitions.ts';

try {
  process.loadEnvFile('.dev.vars');
} catch {
  // Absent is fine - the values may already be in the environment.
}

const applicationId = process.env['DISCORD_APPLICATION_ID'];
const token = process.env['DISCORD_BOT_TOKEN'];
const guildId = process.env['DISCORD_TEST_GUILD_ID'];

if (!applicationId || !token) {
  console.error(
    'Missing credentials. Create a .dev.vars file in the project root with:\n' +
      '  DISCORD_APPLICATION_ID=...\n' +
      '  DISCORD_BOT_TOKEN=...\n' +
      '  DISCORD_TEST_GUILD_ID=...   (optional, but do use it while developing)\n' +
      'It is gitignored. Both values come from the Discord developer portal.',
  );
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
