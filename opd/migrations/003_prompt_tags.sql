-- Indexed tag filter (replaces JSON LIKE on prompts.tags)

CREATE TABLE IF NOT EXISTS prompt_tags (
  prompt_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (prompt_id, tag),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id)
);

CREATE INDEX IF NOT EXISTS idx_prompt_tags_tag ON prompt_tags(tag);
CREATE INDEX IF NOT EXISTS idx_prompt_tags_prompt ON prompt_tags(prompt_id);

-- Backfill from existing prompts.tags JSON arrays
DELETE FROM prompt_tags;

INSERT OR IGNORE INTO prompt_tags (prompt_id, tag)
SELECT p.id, lower(trim(j.value))
FROM prompts p,
     json_each(p.tags) AS j
WHERE p.deleted_at IS NULL
  AND j.value IS NOT NULL
  AND trim(j.value) != '';
