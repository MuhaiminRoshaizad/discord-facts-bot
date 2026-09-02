/**
 * The daily digest.
 *
 * Runs on the cron trigger at 16:00 UTC, which is midnight in Malaysia. It is
 * the only thing the bot says without being asked, so it stays short and it
 * stays optional - `/setchannel` turns it on and off.
 *
 * Resolve regeneration deliberately does not depend on this firing.
 */

import type { Env } from './env';
import { createMessage } from './discord/rest';
import { listAnnounceChannels, setAnnounceChannel, topLadder } from './db/queries';
import { COLORS } from './render/embeds';
import { createRng } from './game/rng';
import { SUIT_BLURB, SUIT_LABEL } from './game/content/suits';
import { SUITS } from './game/types';

/**
 * The day's Rift modifier, derived from the date rather than stored, so every
 * guild sees the same one and nothing has to be written to say so.
 */
export function riftOfTheDay(day: number): { suit: string; blurb: string } {
  const rng = createRng(day);
  const suit = rng.pick(SUITS);
  return { suit: SUIT_LABEL[suit], blurb: SUIT_BLURB[suit] };
}

export async function postDigest(env: Env, now: number): Promise<void> {
  const channels = await listAnnounceChannels(env.DB);
  if (channels.length === 0) return;

  const day = Math.floor(now / 86_400);
  const rift = riftOfTheDay(day);

  for (const row of channels) {
    const leaders = await topLadder(env.DB, row.guild_id, 5);
    const standing =
      leaders.length > 0
        ? leaders
            .map((entry, index) => `**${index + 1}.** <@${entry.user_id}> — ${entry.score}`)
            .join('\n')
        : 'Nobody has descended yet.';

    const sent = await createMessage(row.announce_channel_id, env.DISCORD_BOT_TOKEN, {
      embeds: [
        {
          title: `The Rifts turn ${rift.suit}`,
          description: `*${rift.blurb}*\n\nResolve has refilled overnight. Mooji is at the Threshold.`,
          color: COLORS.abyss,
          fields: [{ name: 'Standing', value: standing, inline: false }],
          footer: { text: '/descend to go down. /setchannel here to stop these.' },
        },
      ],
    });

    // A guild that removed the bot or deleted the channel would otherwise be
    // retried every night forever. One failure is enough to stop asking.
    if (!sent) {
      await setAnnounceChannel(env.DB, row.guild_id, null, now);
      console.warn(`digest disabled for guild ${row.guild_id}: channel unreachable`);
    }
  }
}
