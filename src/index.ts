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
import { handleCommand } from './commands/handlers';
import { handleComponent } from './components/handlers';
import { postDigest } from './digest';

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

    try {
      switch (interaction.type) {
        case InteractionType.Ping:
          return pong();

        case InteractionType.ApplicationCommand:
          return await handleCommand(interaction, env);

        case InteractionType.MessageComponent:
          return await handleComponent(interaction, env);

        default:
          return new Response('unsupported interaction type', { status: 400 });
      }
    } catch (error) {
      // Discord shows the user a bare failure if we return an error status, so
      // an ephemeral apology reads better and keeps the internals off screen.
      console.error('interaction failed', error);
      return ephemeral(
        'Something went wrong at the Threshold. Mooji has made a note of it; try again shortly.',
      );
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // waitUntil so a slow guild cannot cut the run short partway through the
    // list; failures are handled per guild inside postDigest.
    ctx.waitUntil(postDigest(env, Math.floor(Date.now() / 1000)));
  },
} satisfies ExportedHandler<Env>;
