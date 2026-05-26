-- Open Prompt Database — D1 schema (v1 read-only catalog)

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  author TEXT NOT NULL,
  published_at TEXT NOT NULL,
  updated_at TEXT,
  import_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_prompts_published ON prompts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_author ON prompts(author);
CREATE INDEX IF NOT EXISTS idx_prompts_deleted ON prompts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_prompts_imports ON prompts(import_count DESC);

-- Precomputed tag counts (avoids full-table scan on every /v1/tags)
CREATE TABLE IF NOT EXISTS catalog_tags (
  tag TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_catalog_tags_count ON catalog_tags(count DESC);

-- Per-prompt tags for indexed filter (see migrations/003_prompt_tags.sql on existing DBs)
CREATE TABLE IF NOT EXISTS prompt_tags (
  prompt_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (prompt_id, tag),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_tags_tag ON prompt_tags(tag);
CREATE INDEX IF NOT EXISTS idx_prompt_tags_prompt ON prompt_tags(prompt_id);

-- Pseudonymous publishers (see migrations/004_publish.sql on existing DBs)
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

-- Full-text search (replaces LIKE '%query%' on large catalogs)
CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
  id UNINDEXED,
  title,
  content
);
