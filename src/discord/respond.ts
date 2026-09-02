/**
 * Helpers that build the immediate HTTP response to an interaction.
 *
 * Discord invalidates the interaction token if nothing arrives within three
 * seconds, so every handler returns one of these synchronously. Anything
 * slower defers and finishes through `rest.ts`.
 */

import {
  InteractionResponseType,
  MessageFlags,
  type ActionRow,
  type Embed,
} from './types';

export interface MessagePayload {
  content?: string;
  embeds?: Embed[];
  components?: ActionRow[];
  /** Show the message only to the invoking user. */
  ephemeral?: boolean;
}

function body(payload: MessagePayload): Record<string, unknown> {
  const { ephemeral, ...rest } = payload;
  return ephemeral ? { ...rest, flags: MessageFlags.Ephemeral } : rest;
}

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/** Answer Discord's liveness check. */
export function pong(): Response {
  return json({ type: InteractionResponseType.Pong });
}

/** Post a new message in response to the interaction. */
export function reply(payload: MessagePayload): Response {
  return json({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: body(payload),
  });
}

/** Replace the message the component was attached to. */
export function updateMessage(payload: MessagePayload): Response {
  return json({
    type: InteractionResponseType.UpdateMessage,
    data: body(payload),
  });
}

/** Claim the interaction now and send the real content within 15 minutes. */
export function deferReply(ephemeral = false): Response {
  return json({
    type: InteractionResponseType.DeferredChannelMessageWithSource,
    data: ephemeral ? { flags: MessageFlags.Ephemeral } : {},
  });
}

/** Acknowledge a component press without changing the message yet. */
export function deferUpdate(): Response {
  return json({ type: InteractionResponseType.DeferredUpdateMessage });
}

/**
 * A private message the user can act on. Used for every refusal - unknown
 * command, someone else's buttons, an exhausted resource - so that failures
 * never clutter a shared channel.
 */
export function ephemeral(content: string): Response {
  return reply({ content, ephemeral: true });
}
