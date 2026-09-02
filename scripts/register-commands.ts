/**
 * Register the slash commands with Discord.
 *
 * Run once after changing src/commands/definitions.ts:
 *
 *   npm run register
 *
 * Credentials come from .env, the same gitignored file `wrangler dev` reads,
 * so there is one place to put them and no shell-specific way to pass them.
 * PowerShell has no inline environment-variable prefix, so `VAR=x npm run
 * register` simply does not work on Windows.
 *
 * Set DISCORD_TEST_GUILD_ID there too while developing. Guild commands appear
 * immediately; global ones take up to an hour to propagate, which is a long
 * time to spend wondering whether the deploy worked.
 */

import { existsSync } from 'node:fs';
import { COMMANDS } from '../src/commands/definitions.ts';

try {
  process.loadEnvFile('.env');
} catch {
  // Absent is fine - the values may already be in the environment.
}

/** A snowflake is a decimal id of 17 or more digits. */
const SNOWFLAKE = /^\d{17,}$/;

function fail(message: string): never {
  console.error(message);
  // Setting the code rather than calling process.exit() lets open sockets
  // close on their own; exiting under them makes libuv assert on Windows.
  process.exitCode = 1;
  throw new Error('__handled__');
}

async function main(): Promise<void> {
  // wrangler ignores .env entirely when a .dev.vars exists, so having both is
  // a quiet way to run as one application and register against another.
  if (existsSync('.dev.vars')) {
    console.warn(
      'Warning: both .env and .dev.vars are present. wrangler ignores .env when\n' +
        '.dev.vars exists, so `wrangler dev` and this script may be using different\n' +
        'credentials. Delete one of them - .env is the one this project uses.\n',
    );
  }

  const applicationId = process.env['DISCORD_APPLICATION_ID'];
  const token = process.env['DISCORD_BOT_TOKEN'];
  const guildId = process.env['DISCORD_TEST_GUILD_ID'];

  if (!applicationId || !token) {
    fail(
      'Missing credentials.\n\n' +
        '  cp .env.example .env\n\n' +
        'then fill in DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN from the\n' +
        'Discord developer portal. .env is gitignored; .env.example is the\n' +
        'committed template and says where each value comes from.',
    );
  }

  if (!SNOWFLAKE.test(applicationId)) {
    fail(
      `DISCORD_APPLICATION_ID is "${applicationId}", which is not a Discord id.\n` +
        'Copy it from the developer portal under General Information.',
    );
  }

  // Caught here rather than at Discord, whose error for this is a wall of JSON
  // about NUMBER_TYPE_COERCE that says nothing about which file to edit.
  if (guildId && !SNOWFLAKE.test(guildId)) {
    fail(
      `DISCORD_TEST_GUILD_ID is "${guildId}", which is not a Discord id.\n\n` +
        'Either put your real server id there, or delete the line to register\n' +
        'globally. To find it: Discord -> User Settings -> Advanced -> turn on\n' +
        'Developer Mode, then right-click your server icon -> Copy Server ID.',
    );
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
    const body = await response.text();
    if (response.status === 401) {
      fail(
        'Discord rejected the bot token (401).\n' +
          'Reset it in the developer portal under Bot, and paste the new one\n' +
          'into .env. The token is shown only once.',
      );
    }
    fail(`Discord refused the registration: ${response.status}\n${body}`);
  }

  const registered = (await response.json()) as { name: string }[];
  console.log(
    `Registered ${registered.length} command(s) ${
      guildId ? `to guild ${guildId} - they are live immediately` : 'globally - allow up to an hour'
    }:`,
  );
  for (const command of registered) console.log(`  /${command.name}`);
}

try {
  await main();
} catch (error) {
  if (!(error instanceof Error) || error.message !== '__handled__') {
    console.error('Registration failed:', error);
    process.exitCode = 1;
  }
}
