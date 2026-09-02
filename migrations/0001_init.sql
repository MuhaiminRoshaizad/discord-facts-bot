-- Mooji schema, v1.
--
-- All timestamps are unix seconds. Text ids are Discord snowflakes, which
-- exceed 2^53 and so must never be stored as INTEGER.

CREATE TABLE IF NOT EXISTS players (
  user_id            TEXT    PRIMARY KEY,
  level              INTEGER NOT NULL DEFAULT 1,
  xp                 INTEGER NOT NULL DEFAULT 0,
  gold               INTEGER NOT NULL DEFAULT 0,
  -- Resolve regenerates lazily: the value below is correct as of
  -- resolve_updated_at, and readers project it forward. Nothing schedules it.
  resolve            INTEGER NOT NULL DEFAULT 5,
  resolve_updated_at INTEGER NOT NULL,
  active_echo_id     TEXT,
  created_at         INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS echoes (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  species_id TEXT    NOT NULL,
  level      INTEGER NOT NULL DEFAULT 1,
  xp         INTEGER NOT NULL DEFAULT 0,
  nickname   TEXT,
  bound_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_echoes_owner ON echoes(owner_id);

CREATE TABLE IF NOT EXISTS allies (
  user_id      TEXT    NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  ally_id      TEXT    NOT NULL,
  -- assault | support | conserve
  stance       TEXT    NOT NULL DEFAULT 'assault',
  in_party     INTEGER NOT NULL DEFAULT 0,
  recruited_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, ally_id)
);

CREATE TABLE IF NOT EXISTS runs (
  id         TEXT    PRIMARY KEY,
  user_id    TEXT    NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  guild_id   TEXT,
  seed       INTEGER NOT NULL,
  depth      INTEGER NOT NULL DEFAULT 0,
  -- The live encounter. Every button press is a read-modify-write of this.
  state_json TEXT    NOT NULL,
  -- active | won | lost | retreated
  status     TEXT    NOT NULL DEFAULT 'active',
  -- Monotonic per run. Button custom_ids carry it, so a press from a stale
  -- message is rejected instead of granting a second action.
  turn       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One active run per player. A partial unique index enforces it in the
-- database rather than trusting every call site to check first.
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_one_active
  ON runs(user_id) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS discoveries (
  user_id       TEXT    NOT NULL REFERENCES players(user_id) ON DELETE CASCADE,
  -- echo | husk
  entry_type    TEXT    NOT NULL,
  entry_id      TEXT    NOT NULL,
  -- Bitmask over the element list: bit n set means that affinity is revealed.
  flags         INTEGER NOT NULL DEFAULT 0,
  first_seen_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, entry_type, entry_id)
);

CREATE TABLE IF NOT EXISTS guild_config (
  guild_id            TEXT PRIMARY KEY,
  announce_channel_id TEXT,
  created_at          INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ladder (
  guild_id   TEXT    NOT NULL,
  user_id    TEXT    NOT NULL,
  score      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ladder_rank ON ladder(guild_id, score DESC);
