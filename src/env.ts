/** Bindings and secrets available to the Worker. */
export interface Env {
  /** D1 database. Declared in wrangler.toml. */
  DB: D1Database;
  /** Hex-encoded Ed25519 public key from the Discord developer portal. */
  DISCORD_PUBLIC_KEY: string;
  /** Discord application (client) id. */
  DISCORD_APPLICATION_ID: string;
  /** Bot token, used for REST calls Discord does not accept over interactions. */
  DISCORD_BOT_TOKEN: string;
}
