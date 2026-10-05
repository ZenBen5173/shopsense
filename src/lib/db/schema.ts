/** ShopSense schema, applied on boot. Plain Postgres: Supabase, Neon, RDS, or embedded PGlite. */
export const SCHEMA_SQL = /* sql */ `
-- ShopSense schema. Plain Postgres: runs on Supabase, Neon, RDS, or the
-- embedded PGlite used for the zero-setup demo.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS cameras (
  id          TEXT PRIMARY KEY,           -- Ring device id
  name        TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'ignore' CHECK (role IN ('front', 'back', 'ignore')),
  source      TEXT NOT NULL DEFAULT 'ring' CHECK (source IN ('ring', 'sim')),
  cursor_ms   BIGINT NOT NULL DEFAULT 0,  -- newest event start already ingested
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id             TEXT PRIMARY KEY,        -- Ring history-event id: de-duplicates
  camera_id      TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
  occurred_at    TIMESTAMPTZ NOT NULL,
  ended_at       TIMESTAMPTZ,
  event_type     TEXT,
  sub_type       TEXT,
  snapshot_url   TEXT,
  vision_result  JSONB,
  vision_provider TEXT,
  raw            JSONB,                   -- simulator ground truth, or the Ring payload
  processed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS events_occurred_idx ON events (occurred_at);
CREATE INDEX IF NOT EXISTS events_camera_idx ON events (camera_id, occurred_at);

-- Back-door snapshots only: kept as proof of delivery. Front-door images are
-- never stored; only the counts the vision step read from them.
CREATE TABLE IF NOT EXISTS snapshots (
  event_id    TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  data        BYTEA NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id           SERIAL PRIMARY KEY,
  date         DATE NOT NULL UNIQUE,
  sales_total  NUMERIC(12, 2) NOT NULL,
  buyer_count  INTEGER NOT NULL,
  source       TEXT NOT NULL DEFAULT 'owner'
);

CREATE TABLE IF NOT EXISTS deliveries_expected (
  id                    SERIAL PRIMARY KEY,
  supplier_name         TEXT NOT NULL,
  expected_day          SMALLINT NOT NULL CHECK (expected_day BETWEEN 0 AND 6),
  expected_window_start SMALLINT NOT NULL,  -- minutes after local midnight
  expected_window_end   SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries_log (
  id                SERIAL PRIMARY KEY,
  date              DATE NOT NULL,
  expected_id       INTEGER REFERENCES deliveries_expected(id) ON DELETE SET NULL,
  event_id          TEXT REFERENCES events(id) ON DELETE SET NULL,
  supplier_detected TEXT,
  arrived_at        TIMESTAMPTZ,
  duration          INTEGER,
  status            TEXT NOT NULL CHECK (status IN ('on_time', 'late', 'missing', 'pending', 'unexpected'))
);
CREATE INDEX IF NOT EXISTS deliveries_log_date_idx ON deliveries_log (date);

CREATE TABLE IF NOT EXISTS advice_cache (
  facts_hash  TEXT NOT NULL,
  lang        TEXT NOT NULL,
  body        TEXT NOT NULL,
  provider    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (facts_hash, lang)
);

CREATE TABLE IF NOT EXISTS oauth_state (
  state       TEXT PRIMARY KEY,
  verifier    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
