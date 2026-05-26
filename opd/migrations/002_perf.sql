-- Performance migration — run after initial schema on existing DBs

CREATE TABLE IF NOT EXISTS catalog_tags (
  tag TEXT PRIMARY KEY NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_catalog_tags_count ON catalog_tags(count DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_imports ON prompts(import_count DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS prompts_fts USING fts5(
  id UNINDEXED,
  title,
  content
);
