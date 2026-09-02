import { describe, expect, it } from 'vitest';
import { isValidSignature } from '../src/discord/verify';

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A throwaway Ed25519 pair, so the tests exercise real signatures. */
async function keyPair() {
  const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  // exportKey is typed as ArrayBuffer | JsonWebKey; 'raw' only ever yields the former.
  const raw = (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer;
  const publicKeyHex = toHex(raw);
  return { pair, publicKeyHex };
}

async function sign(privateKey: CryptoKey, timestamp: string, body: string): Promise<string> {
  return toHex(
    await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, encoder.encode(timestamp + body)),
  );
}

describe('isValidSignature', () => {
  it('accepts a signature over timestamp + body', async () => {
    const { pair, publicKeyHex } = await keyPair();
    const timestamp = '1700000000';
    const body = '{"type":1}';
    const signature = await sign(pair.privateKey, timestamp, body);

    await expect(isValidSignature(body, signature, timestamp, publicKeyHex)).resolves.toBe(true);
  });

  it('rejects a tampered body', async () => {
    const { pair, publicKeyHex } = await keyPair();
    const timestamp = '1700000000';
    const signature = await sign(pair.privateKey, timestamp, '{"type":1}');

    await expect(isValidSignature('{"type":2}', signature, timestamp, publicKeyHex)).resolves.toBe(
      false,
    );
  });

  it('rejects a replayed signature under a different timestamp', async () => {
    const { pair, publicKeyHex } = await keyPair();
    const body = '{"type":1}';
    const signature = await sign(pair.privateKey, '1700000000', body);

    await expect(isValidSignature(body, signature, '1700000001', publicKeyHex)).resolves.toBe(
      false,
    );
  });

  it('rejects a signature made by a different key', async () => {
    const signer = await keyPair();
    const other = await keyPair();
    const timestamp = '1700000000';
    const body = '{"type":1}';
    const signature = await sign(signer.pair.privateKey, timestamp, body);

    await expect(isValidSignature(body, signature, timestamp, other.publicKeyHex)).resolves.toBe(
      false,
    );
  });

  // Discord validates a candidate endpoint by sending deliberate rubbish, so
  // every malformed shape has to fail closed rather than throw.
  it.each([
    ['a missing signature', null, '1700000000'],
    ['a missing timestamp', 'aa'.repeat(64), null],
    ['a non-hex signature', 'zz'.repeat(64), '1700000000'],
    ['an odd-length signature', 'a'.repeat(127), '1700000000'],
    ['a signature of the wrong length', 'aa'.repeat(32), '1700000000'],
  ])('rejects %s', async (_label, signature, timestamp) => {
    const { publicKeyHex } = await keyPair();
    await expect(isValidSignature('{}', signature, timestamp, publicKeyHex)).resolves.toBe(false);
  });

  it('rejects rather than throws when the public key is not hex', async () => {
    const { pair } = await keyPair();
    const timestamp = '1700000000';
    const signature = await sign(pair.privateKey, timestamp, '{}');

    await expect(isValidSignature('{}', signature, timestamp, 'not-a-key')).resolves.toBe(false);
  });
});
