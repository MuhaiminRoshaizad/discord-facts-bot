/**
 * Discord REST calls for work that cannot ride on the interaction response:
 * editing a deferred reply, and posting from the cron handler where there is
 * no interaction at all.
 */

import type { ActionRow, Embed } from './types';

const API = 'https://discord.com/api/v10';

export interface RestMessage {
  content?: string;
  embeds?: Embed[];
  components?: ActionRow[];
}

/**
 * Replace the original response to a deferred interaction. The token is
 * valid for 15 minutes and needs no bot token, since it authenticates itself.
 */
export async function editOriginalResponse(
  applicationId: string,
  token: string,
  message: RestMessage,
): Promise<void> {
  const response = await fetch(`${API}/webhooks/${applicationId}/${token}/messages/@original`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error(`editOriginalResponse failed: ${response.status} ${await response.text()}`);
  }
}

/** Send an additional message on an interaction that has already responded. */
export async function createFollowUp(
  applicationId: string,
  token: string,
  message: RestMessage,
): Promise<void> {
  const response = await fetch(`${API}/webhooks/${applicationId}/${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(message),
  });
  if (!response.ok) {
    throw new Error(`createFollowUp failed: ${response.status} ${await response.text()}`);
  }
}

/**
 * Post to a channel with the bot token. Used by the scheduled handler, which
 * has no interaction to respond to.
 *
 * Returns false rather than throwing when Discord refuses: the digest posts to
 * many guilds in a loop, and one guild that revoked the bot's access must not
 * stop the rest.
 */
export async function createMessage(
  channelId: string,
  botToken: string,
  message: RestMessage,
): Promise<boolean> {
  try {
    const response = await fetch(`${API}/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bot ${botToken}`,
      },
      body: JSON.stringify(message),
    });
    return response.ok;
  } catch {
    return false;
  }
}
