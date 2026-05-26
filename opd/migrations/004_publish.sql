-- Pseudonymous publishers + reports (idempotent).
-- publisher_token_hash column: applied via scripts/migrate-004-publish.mjs (skips ALTER if present).

CREATE TABLE IF NOT EXISTS publishers (
  token_hash TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  banned_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_publishers_username ON publishers(username);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY NOT NULL,
  prompt_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  reporter_ip_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (prompt_id) REFERENCES prompts(id)
);

CREATE INDEX IF NOT EXISTS idx_reports_prompt ON reports(prompt_id);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prompts_publisher ON prompts(publisher_token_hash);
