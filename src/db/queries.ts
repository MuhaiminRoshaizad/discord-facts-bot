/**
 * Every D1 access in the bot.
 *
 * Kept in one module so the SQL is auditable in a single place and the rest of
 * the code never builds a query string. Nothing here knows about Discord.
 */

import { echoCapacity, projectResolve, type ResolveState } from '../game/progression';

export interface PlayerRow {
  user_id: string;
  level: number;
  xp: number;
  gold: number;
  resolve: number;
  resolve_updated_at: number;
  active_echo_id: string | null;
  created_at: number;
}

export interface EchoRow {
  id: string;
  owner_id: string;
  species_id: string;
  level: number;
  xp: number;
  nickname: string | null;
  bound_at: number;
}

export interface AllyRow {
  user_id: string;
  ally_id: string;
  stance: string;
  in_party: number;
  recruited_at: number;
}

export interface RunRow {
  id: string;
  user_id: string;
  guild_id: string | null;
  seed: number;
  depth: number;
  state_json: string;
  status: string;
  turn: number;
  created_at: number;
  updated_at: number;
}

export interface DiscoveryRow {
  user_id: string;
  entry_type: string;
  entry_id: string;
  flags: number;
  first_seen_at: number;
}

export interface LadderRow {
  user_id: string;
  score: number;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// --- players --------------------------------------------------------------

export async function getPlayer(db: D1Database, userId: string): Promise<PlayerRow | null> {
  return db
    .prepare('SELECT * FROM players WHERE user_id = ?')
    .bind(userId)
    .first<PlayerRow>();
}

/**
 * Create a Wanderer and its single starting Echo together.
 *
 * Batched so a crash between the two cannot leave a player with no Echo and
 * no way to get one - `/awaken` refuses to run twice.
 */
export async function createPlayer(
  db: D1Database,
  userId: string,
  starterSpeciesId: string,
  now: number,
): Promise<{ player: PlayerRow; echoId: string }> {
  const echoId = newId();

  await db.batch([
    db
      .prepare(
        `INSERT INTO players (user_id, level, xp, gold, resolve, resolve_updated_at, active_echo_id, created_at)
         VALUES (?, 1, 0, 0, 5, ?, ?, ?)`,
      )
      .bind(userId, now, echoId, now),
    db
      .prepare(
        `INSERT INTO echoes (id, owner_id, species_id, level, xp, nickname, bound_at)
         VALUES (?, ?, ?, 1, 0, NULL, ?)`,
      )
      .bind(echoId, userId, starterSpeciesId, now),
  ]);

  const player = await getPlayer(db, userId);
  if (!player) throw new Error('player vanished immediately after creation');
  return { player, echoId };
}

export interface PlayerPatch {
  level?: number;
  xp?: number;
  gold?: number;
  resolve?: number;
  resolve_updated_at?: number;
  active_echo_id?: string | null;
}

export function updatePlayerStatement(
  db: D1Database,
  userId: string,
  patch: PlayerPatch,
): D1PreparedStatement | null {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return null;

  const assignments = entries.map(([column]) => `${column} = ?`).join(', ');
  const values = entries.map(([, value]) => value as string | number | null);
  return db
    .prepare(`UPDATE players SET ${assignments} WHERE user_id = ?`)
    .bind(...values, userId);
}

export async function updatePlayer(
  db: D1Database,
  userId: string,
  patch: PlayerPatch,
): Promise<void> {
  const statement = updatePlayerStatement(db, userId, patch);
  if (statement) await statement.run();
}

/**
 * Read a player with Resolve projected forward, writing the projection back
 * only when it actually moved. Regeneration is lazy by design, so this is the
 * single place it becomes visible.
 */
export async function getPlayerWithResolve(
  db: D1Database,
  userId: string,
  now: number,
): Promise<{ player: PlayerRow; resolve: ResolveState } | null> {
  const player = await getPlayer(db, userId);
  if (!player) return null;

  const resolve = projectResolve(player.resolve, player.resolve_updated_at, now);
  if (resolve.resolve !== player.resolve || resolve.updatedAt !== player.resolve_updated_at) {
    await updatePlayer(db, userId, {
      resolve: resolve.resolve,
      resolve_updated_at: resolve.updatedAt,
    });
    player.resolve = resolve.resolve;
    player.resolve_updated_at = resolve.updatedAt;
  }
  return { player, resolve };
}

// --- echoes ---------------------------------------------------------------

export async function listEchoes(db: D1Database, userId: string): Promise<EchoRow[]> {
  const result = await db
    .prepare('SELECT * FROM echoes WHERE owner_id = ? ORDER BY bound_at ASC')
    .bind(userId)
    .all<EchoRow>();
  return result.results ?? [];
}

export async function getEcho(db: D1Database, id: string): Promise<EchoRow | null> {
  return db.prepare('SELECT * FROM echoes WHERE id = ?').bind(id).first<EchoRow>();
}

export async function countEchoes(db: D1Database, userId: string): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM echoes WHERE owner_id = ?')
    .bind(userId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export function insertEchoStatement(
  db: D1Database,
  id: string,
  userId: string,
  speciesId: string,
  level: number,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO echoes (id, owner_id, species_id, level, xp, nickname, bound_at)
       VALUES (?, ?, ?, ?, 0, NULL, ?)`,
    )
    .bind(id, userId, speciesId, level, now);
}

export async function insertEcho(
  db: D1Database,
  userId: string,
  speciesId: string,
  level: number,
  now: number,
): Promise<string> {
  const id = newId();
  await insertEchoStatement(db, id, userId, speciesId, level, now).run();
  return id;
}

export function deleteEchoStatement(db: D1Database, id: string, userId: string) {
  // Scoped by owner as well as id, so a forged custom_id cannot delete
  // somebody else's Echo.
  return db.prepare('DELETE FROM echoes WHERE id = ? AND owner_id = ?').bind(id, userId);
}

/** Whether the player has room for another Echo. */
export async function hasEchoRoom(
  db: D1Database,
  userId: string,
  level: number,
): Promise<boolean> {
  return (await countEchoes(db, userId)) < echoCapacity(level);
}

export function updateEchoStatement(
  db: D1Database,
  id: string,
  level: number,
  xp: number,
): D1PreparedStatement {
  return db.prepare('UPDATE echoes SET level = ?, xp = ? WHERE id = ?').bind(level, xp, id);
}

// --- allies ---------------------------------------------------------------

export async function listAllies(db: D1Database, userId: string): Promise<AllyRow[]> {
  const result = await db
    .prepare('SELECT * FROM allies WHERE user_id = ? ORDER BY recruited_at ASC')
    .bind(userId)
    .all<AllyRow>();
  return result.results ?? [];
}

export async function recruitAlly(
  db: D1Database,
  userId: string,
  allyId: string,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO allies (user_id, ally_id, stance, in_party, recruited_at)
       VALUES (?, ?, 'assault', 0, ?)
       ON CONFLICT(user_id, ally_id) DO NOTHING`,
    )
    .bind(userId, allyId, now)
    .run();
}

export async function setAllyParty(
  db: D1Database,
  userId: string,
  allyId: string,
  inParty: boolean,
  stance: string,
): Promise<void> {
  await db
    .prepare('UPDATE allies SET in_party = ?, stance = ? WHERE user_id = ? AND ally_id = ?')
    .bind(inParty ? 1 : 0, stance, userId, allyId)
    .run();
}

// --- runs -----------------------------------------------------------------

export async function getActiveRun(db: D1Database, userId: string): Promise<RunRow | null> {
  return db
    .prepare("SELECT * FROM runs WHERE user_id = ? AND status = 'active'")
    .bind(userId)
    .first<RunRow>();
}

export async function getRun(db: D1Database, id: string): Promise<RunRow | null> {
  return db.prepare('SELECT * FROM runs WHERE id = ?').bind(id).first<RunRow>();
}

export async function insertRun(
  db: D1Database,
  run: Omit<RunRow, 'created_at' | 'updated_at'>,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO runs (id, user_id, guild_id, seed, depth, state_json, status, turn, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      run.id,
      run.user_id,
      run.guild_id,
      run.seed,
      run.depth,
      run.state_json,
      run.status,
      run.turn,
      now,
      now,
    )
    .run();
}

export function updateRunStatement(
  db: D1Database,
  id: string,
  fields: { state_json: string; status: string; turn: number; depth: number },
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      'UPDATE runs SET state_json = ?, status = ?, turn = ?, depth = ?, updated_at = ? WHERE id = ?',
    )
    .bind(fields.state_json, fields.status, fields.turn, fields.depth, now, id);
}

/**
 * Close any run left active for this player.
 *
 * A partial unique index allows exactly one active run each, so an abandoned
 * one has to be cleared before a new descent rather than colliding on insert.
 */
export async function abandonActiveRuns(db: D1Database, userId: string, now: number): Promise<void> {
  await db
    .prepare("UPDATE runs SET status = 'retreated', updated_at = ? WHERE user_id = ? AND status = 'active'")
    .bind(now, userId)
    .run();
}

// --- discoveries ----------------------------------------------------------

export async function listDiscoveries(
  db: D1Database,
  userId: string,
): Promise<DiscoveryRow[]> {
  const result = await db
    .prepare('SELECT * FROM discoveries WHERE user_id = ?')
    .bind(userId)
    .all<DiscoveryRow>();
  return result.results ?? [];
}

/**
 * Record an entry, merging affinity-reveal bits into whatever is already
 * known. `flags` is a bitmask over the element list.
 */
export function discoverStatement(
  db: D1Database,
  userId: string,
  entryType: 'echo' | 'husk',
  entryId: string,
  flags: number,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO discoveries (user_id, entry_type, entry_id, flags, first_seen_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, entry_type, entry_id)
       DO UPDATE SET flags = flags | excluded.flags`,
    )
    .bind(userId, entryType, entryId, flags, now);
}

// --- guild config ---------------------------------------------------------

export async function getGuildConfig(
  db: D1Database,
  guildId: string,
): Promise<{ guild_id: string; announce_channel_id: string | null } | null> {
  return db
    .prepare('SELECT guild_id, announce_channel_id FROM guild_config WHERE guild_id = ?')
    .bind(guildId)
    .first();
}

export async function setAnnounceChannel(
  db: D1Database,
  guildId: string,
  channelId: string | null,
  now: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO guild_config (guild_id, announce_channel_id, created_at)
       VALUES (?, ?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET announce_channel_id = excluded.announce_channel_id`,
    )
    .bind(guildId, channelId, now)
    .run();
}

export async function listAnnounceChannels(
  db: D1Database,
): Promise<{ guild_id: string; announce_channel_id: string }[]> {
  const result = await db
    .prepare(
      'SELECT guild_id, announce_channel_id FROM guild_config WHERE announce_channel_id IS NOT NULL',
    )
    .all<{ guild_id: string; announce_channel_id: string }>();
  return result.results ?? [];
}

// --- ladder ---------------------------------------------------------------

export function addLadderScoreStatement(
  db: D1Database,
  guildId: string,
  userId: string,
  points: number,
  now: number,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO ladder (guild_id, user_id, score, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET score = score + excluded.score, updated_at = excluded.updated_at`,
    )
    .bind(guildId, userId, points, now);
}

export async function topLadder(
  db: D1Database,
  guildId: string,
  limit = 10,
): Promise<LadderRow[]> {
  const result = await db
    .prepare('SELECT user_id, score FROM ladder WHERE guild_id = ? ORDER BY score DESC LIMIT ?')
    .bind(guildId, limit)
    .all<LadderRow>();
  return result.results ?? [];
}

export async function ladderRank(
  db: D1Database,
  guildId: string,
  userId: string,
): Promise<{ rank: number; score: number } | null> {
  const row = await db
    .prepare('SELECT score FROM ladder WHERE guild_id = ? AND user_id = ?')
    .bind(guildId, userId)
    .first<{ score: number }>();
  if (!row) return null;

  const above = await db
    .prepare('SELECT COUNT(*) AS n FROM ladder WHERE guild_id = ? AND score > ?')
    .bind(guildId, row.score)
    .first<{ n: number }>();

  return { rank: (above?.n ?? 0) + 1, score: row.score };
}
