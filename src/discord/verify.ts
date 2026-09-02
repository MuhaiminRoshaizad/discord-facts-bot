/**
 * Ed25519 verification of Discord interaction signatures.
 *
 * Cloudflare's WebCrypto implements Ed25519 natively, so this needs no
 * library. Discord signs `timestamp + rawBody` and sends the signature,
 * hex-encoded, in `X-Signature-Ed25519`.
 *
 * Discord validates a candidate endpoint by sending a deliberately bad
 * signature and requiring a 401, so failing closed here is not merely
 * defensive - it is how the endpoint gets accepted in the first place.
 */

const encoder = new TextEncoder();

/** Ed25519 signatures are always 64 bytes. */
const SIGNATURE_BYTES = 64;

/**
 * Imported keys are reused across requests in the same isolate. Key import
 * does elliptic-curve work, and the free plan allows 10 ms of CPU per request.
 */
const keyCache = new Map<string, Promise<CryptoKey>>();

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0) return null;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function getKey(publicKeyHex: string): Promise<CryptoKey> {
  const cached = keyCache.get(publicKeyHex);
  if (cached) return cached;

  const bytes = hexToBytes(publicKeyHex);
  if (!bytes) {
    return Promise.reject(new Error('DISCORD_PUBLIC_KEY is not valid hex'));
  }

  const pending = crypto.subtle.importKey('raw', bytes, { name: 'Ed25519' }, false, [
    'verify',
  ]);
  // Never cache a rejection - a transient failure would poison the isolate.
  pending.catch(() => keyCache.delete(publicKeyHex));
  keyCache.set(publicKeyHex, pending);
  return pending;
}

/**
 * Whether `signatureHex` is Discord's signature over `timestamp + rawBody`.
 * Returns false rather than throwing for every malformed input, so callers
 * have exactly one failure path.
 */
export async function isValidSignature(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null,
  publicKeyHex: string,
): Promise<boolean> {
  if (!signatureHex || !timestamp) return false;

  const signature = hexToBytes(signatureHex);
  if (!signature || signature.length !== SIGNATURE_BYTES) return false;

  try {
    const key = await getKey(publicKeyHex);
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      signature,
      encoder.encode(timestamp + rawBody),
    );
  } catch {
    return false;
  }
}
