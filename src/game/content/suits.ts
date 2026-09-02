/**
 * Suits and the weaving table.
 *
 * A full 10x10 matrix is 100 hand-authored cells that nobody would ever keep
 * consistent. Instead the wheel supplies the rule and a short exception list
 * supplies the character: weaving two suits yields the suit `i + j + 1` places
 * along, except where an authored pair says otherwise. Same-suit weaves stay
 * in the family.
 */

import { SUITS, type Suit } from '../types';

export const SUIT_LABEL: Record<Suit, string> = {
  tide: 'Tide',
  ash: 'Ash',
  hollow: 'Hollow',
  verdant: 'Verdant',
  iron: 'Iron',
  veil: 'Veil',
  dawn: 'Dawn',
  mire: 'Mire',
  storm: 'Storm',
  bone: 'Bone',
};

export const SUIT_BLURB: Record<Suit, string> = {
  tide: 'What the water keeps, and what it gives back changed.',
  ash: 'What is left when the fire has finished being a fire.',
  hollow: 'Absence with a shape and a grievance.',
  verdant: 'Growth that will outlast whatever it grew through.',
  iron: 'Made for a purpose and unable to forget it.',
  veil: 'The part of the room you do not look at directly.',
  dawn: 'Light arriving whether or not it was asked for.',
  mire: 'Patience mistaken for stillness.',
  storm: 'Everything at once, and then nothing.',
  bone: 'What remains after the argument is settled.',
};

function indexOf(suit: Suit): number {
  return SUITS.indexOf(suit);
}

/**
 * Authored pairs that override the wheel. Keyed on the two suits sorted
 * alphabetically, so lookup is order-independent - weaving is commutative and
 * a player must never get a different result by picking their Echoes in the
 * other order.
 */
const EXCEPTIONS: Readonly<Record<string, Suit>> = {
  'ash|tide': 'storm',
  'dawn|hollow': 'veil',
  'iron|verdant': 'bone',
  'mire|storm': 'tide',
  'bone|dawn': 'hollow',
  'ash|veil': 'ash',
  'iron|storm': 'iron',
  'mire|verdant': 'mire',
  'hollow|tide': 'veil',
  'bone|iron': 'iron',
};

function exceptionKey(a: Suit, b: Suit): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** The suit produced by weaving two Echoes together. Commutative. */
export function weaveSuit(a: Suit, b: Suit): Suit {
  if (a === b) return a;

  const authored = EXCEPTIONS[exceptionKey(a, b)];
  if (authored) return authored;

  const wheel = (indexOf(a) + indexOf(b) + 1) % SUITS.length;
  return SUITS[wheel] as Suit;
}
