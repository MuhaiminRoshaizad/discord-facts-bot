/**
 * Worker entry point.
 *
 * Discord POSTs every interaction here and expects an answer within three
 * seconds. There is no gateway connection and no long-lived process, which is
 * what lets the whole bot run on the free plan.
 */

import type { Env } from './env';
import { isValidSignature } from './discord/verify';
import { InteractionType, type Interaction } from './discord/types';
import { ephemeral, pong } from './discord/respond';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'GET') {
      return new Response('Mooji is awake.', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }

    if (request.method !== 'POST') {
      return new Response('method not allowed', { status: 405 });
    }

    const rawBody = await request.text();
    const valid = await isValidSignature(
      rawBody,
      request.headers.get('x-signature-ed25519'),
      request.headers.get('x-signature-timestamp'),
      env.DISCORD_PUBLIC_KEY,
    );
    if (!valid) {
      // Discord probes a candidate endpoint with a bad signature and requires
      // exactly this status before it will accept the URL.
      return new Response('invalid request signature', { status: 401 });
    }

    let interaction: Interaction;
    try {
      interaction = JSON.parse(rawBody) as Interaction;
    } catch {
      return new Response('malformed interaction payload', { status: 400 });
    }

    switch (interaction.type) {
      case InteractionType.Ping:
        return pong();

      case InteractionType.ApplicationCommand:
      case InteractionType.MessageComponent:
        return ephemeral('Mooji is being rebuilt. This is not wired up yet.');

      default:
        return new Response('unsupported interaction type', { status: 400 });
    }
  },

  async scheduled(): Promise<void> {
    // The daily digest arrives with the leaderboard. wrangler.toml already
    // declares the trigger, so this handler has to exist for deploys to pass.
  },
} satisfies ExportedHandler<Env>;
