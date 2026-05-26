# Open Prompt Database — Publish & Publisher Identity (Infrastructure Plan)

Infrastructure-only plan for **pseudonymous publishing** from Open Prompt Manager: no login, no email, no OAuth. UI/UX is a separate task; this doc covers **data model, API, Worker, D1, KV, extension plumbing, security, and rollout**.

**Related:** `plan-open-prompt-database.md` (product + design system), `schema.sql`, `src/worker.js`, `src/opd/` (extension).

**Principles**

- **Capability secret** (`publish_token`) in `chrome.storage.sync` — publisher identity across synced Chrome profiles.
- **Public handle** (`@username`) — unique, validated, chosen once (change rules = later).
- Server stores **`hash(token)` only**; never log or persist raw tokens.
- **Do not** trust client-sent `author` on write; resolve from token → publisher row.
- **Do not** add required host permissions on the catalog domain for store updates (optional API permission + `externally_connectable` for import stays as today).
- **Never** change OPM LLM API keys or provider endpoints.

---

## 1. Current state vs target

| Area | Today (shipped) | Target |
|------|-----------------|--------|
| API | `GET` only: `/v1/home`, `/v1/prompts`, `/v1/prompts/:id`, `/v1/tags`, `/v1/authors/:name` | + write paths below |
| D1 | `prompts`, `catalog_tags`, `prompt_tags`, `prompts_fts` | + `publishers`, `reports`; extend `prompts` |
| CORS | GET + localhost origins | GET/POST/DELETE + extension origin + site origin |
| KV | Not bound | Rate limits (+ optional Turnstile replay cache) |
| Turnstile | Not wired | Siteverify on register + publish |
| Extension | Import (`OPD_IMPORT_PROMPT`), optional catalog bridge | + publish token (sync), register handle, `OPD_PUBLISH_*` messages |
| Website | Read + import + report UI placeholder | Report API; no publish on web in v1 |

---

## 2. Identity model

### 2.1 Publisher secret (extension)

| Item | Detail |
|------|--------|
| Generation | `crypto.randomUUID()` or 32 random bytes → base64url on first “enable publishing” |
| Storage | `chrome.storage.sync` keys (see §6) |
| Transport | Header `X-OPD-Token: <raw>` on mutating API calls only |
| Server | `token_hash = SHA-256(raw)` (hex or base64); constant-time compare |
| Lifetime | Until user clears sync/extension data; **no recovery** in v1 |
| Cross-device | Same synced Chrome profile → same token → same publisher |

**Not used:** `chrome.identity`, email, device fingerprints, Chrome profile IDs.

### 2.2 Public handle

| Item | Detail |
|------|--------|
| Format | 3–32 chars, `[a-z0-9_-]`, normalized to lowercase |
| Display | `author` column / API field = handle (no `@` in JSON) |
| Uniqueness | `UNIQUE` on `publishers.username` |
| Reserved | Blocklist: `admin`, `api`, `www`, `opd`, `openpromptmanager`, … (maintain in `validate.js`) |
| Registration | One handle per `token_hash` in v1; optional handle change later |

### 2.3 Prompt ownership

- Each published prompt row stores `publisher_token_hash` (who may update/delete).
- `author` denormalized from publisher at write time for listings (`/u/:author` unchanged).
- Public prompt `id` = UUID (client may propose on create; server generates if missing).

### 2.4 Local extension metadata (not in catalog export)

| Key | Storage | Purpose |
|-----|---------|---------|
| `opdPublicId` | Per-prompt field in `promptStorage` (extension-only) | Maps local `uuid` → catalog `id` for re-publish / badge |
| `opdPublishedAt` | optional | Last successful publish timestamp |

---

## 3. D1 schema

### 3.1 New table: `publishers`

```sql
CREATE TABLE IF NOT EXISTS publishers (
  token_hash TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT,
  banned_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_publishers_username ON publishers(username);
```

### 3.2 Extend `prompts`

```sql
-- Migration 004_publish.sql
ALTER TABLE prompts ADD COLUMN publisher_token_hash TEXT;
-- Backfill: NULL for seeded/demo rows; new publishes always set.

CREATE INDEX IF NOT EXISTS idx_prompts_publisher ON prompts(publisher_token_hash);
```

Existing columns stay: `author` (handle), `import_count`, `deleted_at`, FTS/tag tables.

### 3.3 New table: `reports` (abuse)

```sql
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
```

### 3.4 Write-path maintenance (transactions)

On **create/update/delete** prompt:

1. Upsert `prompts` row.
2. Rebuild `prompt_tags` for that `prompt_id`.
3. Update `prompts_fts` (delete + insert).
4. Recompute affected rows in `catalog_tags` (or incremental delta — match existing seed strategy).

Use D1 batch / explicit transaction pattern in `lib/publish.js` + `lib/tags.js` (extract from seed script logic if needed).

---

## 4. API (`https://openpromptdatabase.com/v1`)

Base path already routed in `src/worker.js`. Extend `handleApi` to allow **GET, POST, DELETE, OPTIONS** (not GET-only).

### 4.1 Read (existing — keep)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/home` | Unchanged |
| GET | `/prompts` | List; `author`, `tag`, `q`, pagination |
| GET | `/prompts/:id` | Detail |
| GET | `/tags` | Tag directory |
| GET | `/authors/:handle` | Stats for `/u/:handle` |

### 4.2 Publisher (new)

| Method | Path | Auth | Body | Responses |
|--------|------|------|------|-----------|
| GET | `/handles/:handle/available` | — | — | `{ available: true }` or `{ available: false, reason?: "taken" \| "invalid" \| "reserved" }` |
| GET | `/publishers/me` | `X-OPD-Token` | — | `{ username, createdAt }` or `404` if not registered |
| POST | `/publishers` | `X-OPD-Token` + Turnstile | `{ username }` | `201 { username }`; `409` taken; `400` invalid; idempotent if same token re-registers same user |

**Availability check:** normalize handle server-side; query `publishers` + reserved list; no token required (rate-limit by IP).

**Register:** insert `publishers(token_hash, username)`; reject if token already bound to a *different* username.

### 4.3 Prompts (write)

| Method | Path | Auth | Body | Responses |
|--------|------|------|------|-----------|
| POST | `/prompts` | `X-OPD-Token` + Turnstile | `{ id?, title, content, tags[] }` | `201` create / `200` update; `{ prompt }` |
| DELETE | `/prompts/:id` | `X-OPD-Token` | — | `204` soft-delete (`deleted_at`) if owner |
| POST | `/prompts/:id/report` | Turnstile (optional v1) | `{ reason, detail? }` | `202` accepted |
| POST | `/prompts/:id/import` | — | — | `204` increment `import_count` (called by extension after successful local import; rate-limit IP) |

**POST /prompts rules**

- Require registered publisher for token.
- Set `author` from DB publisher username (ignore body `author`).
- Set `publisher_token_hash` from token.
- Update allowed only if `prompts.publisher_token_hash` matches.
- Validate title/content/tags per `validate.js` limits (32 KB content, 10 tags, etc.).
- Reject HTML/script patterns in content.

### 4.4 Error envelope

```json
{ "error": "code", "message": "human optional" }
```

Codes: `unauthorized`, `forbidden`, `not_found`, `username_taken`, `username_invalid`, `validation_failed`, `rate_limited`, `turnstile_failed`, `not_registered`, `method_not_allowed`.

### 4.5 CORS (`src/lib/cors.js`)

| Origin | Methods |
|--------|---------|
| `https://openpromptdatabase.com` | GET, POST, DELETE, OPTIONS |
| `http://localhost:8787`, `http://127.0.0.1:8787` | Same (dev) |
| `chrome-extension://gmhaghdbihgenofhnmdbglbkbplolain` | POST, OPTIONS (publish from SW) |

Headers: `Content-Type`, `X-OPD-Token`, `CF-Turnstile-Response` (or body field `turnstileToken`).

---

## 5. Worker architecture

### 5.1 File layout (target)

```
opd/src/
├── worker.js                 # router: delegate to lib/*
├── lib/
│   ├── api.js                # read handlers (existing)
│   ├── publish.js            # POST/DELETE prompts, FTS/tags sync
│   ├── publishers.js         # register, availability, me
│   ├── reports.js            # POST report
│   ├── imports.js            # increment import_count
│   ├── auth.js               # hash token, resolve publisher, constant-time compare
│   ├── rateLimit.js          # KV counters
│   ├── turnstile.js          # siteverify Cloudflare
│   ├── validate.js           # extend: handle, publish body, report reason
│   ├── cors.js               # extend methods/origins
│   └── cache.js              # do not cache mutating routes
```

### 5.2 Router changes (`worker.js`)

```text
/v1/*  → handleApi()
  OPTIONS → 204 + CORS
  GET     → existing read routes + GET /handles/:h/available + GET /publishers/me
  POST    → /publishers, /prompts, /prompts/:id/report, /prompts/:id/import
  DELETE  → /prompts/:id
```

`withEdgeCache` — **read only**; never cache POST/DELETE.

### 5.3 Wrangler bindings (`wrangler.jsonc`)

```jsonc
{
  "kv_namespaces": [{ "binding": "RATE_LIMIT", "id": "<create in dashboard>" }],
  "vars": {
    "OPD_SITE_NAME": "Open Prompt Database",
    "TURNSTILE_SITE_KEY": "<public — also used by extension/widget>"
  },
  "secrets": ["TURNSTILE_SECRET_KEY", "OPD_ADMIN_TOKEN"]
}
```

| Binding | Use |
|---------|-----|
| D1 `DB` | All persistence |
| KV `RATE_LIMIT` | Per-token / per-IP sliding windows |
| Secret `TURNSTILE_SECRET_KEY` | Server siteverify |
| Secret `OPD_ADMIN_TOKEN` | Admin delete/ban routes (optional v1) |
| `ASSETS` | Static site (unchanged) |

### 5.4 Rate limits (KV)

| Key pattern | Limit | Applies to |
|-------------|-------|------------|
| `rl:ip:{ip}:read` | 120/min | GET (optional; CF already caches) |
| `rl:ip:{ip}:report` | 10/hour | POST report |
| `rl:ip:{ip}:import` | 60/hour | POST import bump |
| `rl:token:{hash}:publish` | 10/hour | POST /prompts |
| `rl:ip:{ip}:register` | 5/hour | POST /publishers |
| `rl:ip:{ip}:handle_check` | 60/hour | GET handle availability |

Return `429` + `Retry-After` when exceeded.

### 5.5 Turnstile

| Step | Detail |
|------|--------|
| Widget | Obtained in extension context (offscreen document, options tab, or publish tab — **UI task**); infra passes token to SW |
| Verify | `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with secret + token + remoteip |
| Required on | `POST /publishers`, `POST /prompts` (first publish per session optional policy) |
| Failure | `403 turnstile_failed` |

### 5.6 Admin / moderation (minimal v1)

| Method | Path | Auth | Action |
|--------|------|------|--------|
| DELETE | `/admin/prompts/:id` | `X-OPD-Admin-Token` | Hard/soft delete any prompt |
| POST | `/admin/publishers/:handle/ban` | Admin token | Set `publishers.banned_at`; hide prompts |

No admin UI in v1 — curl + secret. Website report flow stores row for manual review.

### 5.7 Import count telemetry

After successful `OPD_IMPORT_PROMPT` in extension, SW fires **non-blocking**:

`POST /v1/prompts/:id/import` (no auth; IP rate limit).

Worker: `UPDATE prompts SET import_count = import_count + 1 WHERE id = ? AND deleted_at IS NULL`.

Failure must not block local import.

---

## 6. Extension infrastructure (OPM repo)

Single build (store + dev); no separate publish manifest flavor.

### 6.1 `chrome.storage.sync` keys

| Key | Type | Written when |
|-----|------|--------------|
| `opdPublishEnabled` | boolean | User enables publishing |
| `opdPublishToken` | string (secret) | First enable; never expose to content scripts |
| `opdUsername` | string | Successful `POST /publishers` |
| `opdApiBaseUrl` | string | Default `https://openpromptdatabase.com`; dev override |

**Quota:** token + username << 8 KB/item, well under sync limits.

### 6.2 New modules (`src/opd/`)

| Module | Responsibility |
|--------|----------------|
| `opdConstants.js` | `OPD_CATALOG_URL`, `OPM_EXTENSION_ID`, API paths (existing) |
| `opdClient.js` | `fetch` wrapper: base URL, headers, JSON errors, timeouts |
| `opdPublishToken.js` | getOrCreateToken(), hash never leaves client raw except in header |
| `opdPublisher.js` | `checkHandleAvailable()`, `registerPublisher()`, `getPublisherMe()` |
| `opdPublish.js` | Map local prompt → API body; create/update; set `opdPublicId` on prompt |
| `opdImport.js` | Existing import + call import-count endpoint |
| `opdCatalogAccess.js` | Existing optional bridge |

### 6.3 Service worker messages

| `type` | Direction | Payload | Handler |
|--------|-----------|---------|---------|
| `OPD_PUBLISH_REGISTER` | UI → SW | `{ username, turnstileToken }` | register publisher |
| `OPD_PUBLISH_PROMPT` | UI → SW | `{ localUuid, turnstileToken }` | load prompt from storage → POST /prompts |
| `OPD_PUBLISH_DELETE` | UI → SW | `{ catalogId }` | DELETE /prompts/:id |
| `OPD_PUBLISH_STATUS` | UI → SW | — | `{ enabled, username, registered, apiReachable }` |
| `OPD_HANDLE_AVAILABLE` | UI → SW | `{ handle }` | proxy GET availability |
| `OPD_IMPORT_PROMPT` | web → SW | existing | + async import count POST |

All publish HTTP from **service worker** only (token never in sidepanel/page JS).

### 6.4 Manifest / permissions

| Item | Value |
|------|--------|
| `optional_host_permissions` | `https://openpromptdatabase.com/*` (already for catalog bridge; same for API) |
| `externally_connectable` | unchanged (import from site) |
| **No** required host permission for catalog domain | Store-safe |

Request `https://openpromptdatabase.com/*` when user enables publishing (can merge with existing catalog-access prompt or single “Enable Open Prompt Database” permission).

### 6.5 `promptStorage` extension

Optional fields on normalized prompt (not exported in user backup by default):

```js
// opdPublicId: string | undefined  — catalog UUID
// opdLastPublishedAt: string | undefined
```

`mergePrompts` / export format: strip or include based on export version (document in importExport.js).

---

## 7. Security checklist

| Threat | Mitigation |
|--------|------------|
| Username squatting on register | UNIQUE + Turnstile + rate limit |
| Publish as someone else | Token required; author from DB only |
| Token leak | HTTPS only; hash at rest; short error messages; no token in logs |
| Scraping / spam | Rate limits + Turnstile |
| XSS in catalog content | Plain text validation; escape on render (existing) |
| CORS abuse | Allowlist origins; no `*` on credentialed POST |
| Replay Turnstile | Single-use optional cache in KV (token hash key, TTL 5 min) |
| Mass report | Rate limit + dedupe same ip+prompt per day |

---

## 8. Environments & deploy

| Env | API base | D1 | Notes |
|-----|----------|-----|-------|
| Local | `http://localhost:8787` | `wrangler dev` local D1 | `npm run db:migrate` + seed |
| Staging | `workers.dev` or staging subdomain | Separate D1 id in wrangler env | Extension `opdApiBaseUrl` override |
| Production | `https://openpromptdatabase.com` | `opd-db` remote | `npm run deploy` |

**Migrations:** `opd/migrations/004_publish.sql` + `npm run db:migrate:remote` when ready.

**Secrets:** set via `wrangler secret put` per environment.

---

## 9. Phased implementation (infra only)

### Phase A — Foundation (1–2 days)

- [ ] Migration `004_publish.sql` (publishers, reports, `publisher_token_hash`)
- [ ] `lib/auth.js`, `lib/publishers.js`, extend `validate.js` (handle + body)
- [ ] `GET /handles/:handle/available`, `POST /publishers`, `GET /publishers/me`
- [ ] KV binding + `lib/rateLimit.js`
- [ ] Extend `cors.js` + `worker.js` router for POST/OPTIONS
- [ ] Unit-style tests: validate functions (node script) if desired

### Phase B — Publish prompts (2–3 days)

- [ ] `lib/publish.js` + FTS/tags/catalog_tags maintenance
- [ ] `POST /prompts`, `DELETE /prompts/:id`
- [ ] Turnstile `lib/turnstile.js` + secrets
- [ ] Extension: `opdPublishToken.js`, `opdClient.js`, `opdPublisher.js`, sync storage
- [ ] SW handlers: `OPD_PUBLISH_REGISTER`, `OPD_HANDLE_AVAILABLE`, `OPD_PUBLISH_STATUS`

### Phase C — Extension publish loop (1–2 days)

- [ ] `opdPublish.js` + `OPD_PUBLISH_PROMPT` + `opdPublicId` on local prompt
- [ ] `POST /prompts/:id/import` + extension fire-and-forget after import
- [ ] Staging E2E: register → publish → GET on site → import back

### Phase D — Trust & ops (1–2 days)

- [ ] `POST /prompts/:id/report` + `reports` table
- [ ] Admin routes + `OPD_ADMIN_TOKEN`
- [ ] Ban publisher → filter prompts in list/detail queries (`publishers.banned_at IS NULL`)
- [ ] Changelog / privacy copy inputs (content task, not layout)

### Phase E — Later (out of infra v1)

- OAuth / magic link accounts
- Handle rename, transfer, recovery
- Website-side publish (WebCrypto key pair)
- Edit history, drafts, duplicate detection
- Full admin dashboard

---

## 10. Observability

| Signal | Tool |
|--------|------|
| API 4xx/5xx rates | Cloudflare Workers analytics |
| D1 latency | Wrangler / dashboard |
| Rate-limit hits | KV key sample or structured log |
| Publish volume | D1 `COUNT` by day on `prompts.published_at` |

Log **never:** raw `X-OPD-Token`, Turnstile secrets, full prompt content.

---

## 11. Explicitly out of scope (this plan)

- Side panel / settings **layouts**, copy, banners, wizards (separate UI/UX task)
- Turnstile **where** to render in extension (offscreen vs tab) — UI task; infra only requires token on POST
- Chrome Web Store listing text
- Changing OPM provider URLs, API keys, or core prompt editor behaviour

---

## 12. Open decisions (defaults recommended)

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Store raw token in D1? | **Never** — SHA-256 only |
| 2 | Sync vs local for token? | **`chrome.storage.sync`** per product decision |
| 3 | Client-supplied prompt `id` on create? | **Yes** — UUID from extension; server validates uniqueness |
| 4 | Update prompt if same `id` + same token? | **Yes** — upsert |
| 5 | Delete prompts on publisher ban? | **Soft-hide** in reads; optional admin purge later |
| 6 | Turnstile on every publish? | **Yes** on register + publish in v1 |
| 7 | Website publish? | **No** in v1 — extension only |

---

*Last updated: May 2026 — infra draft for pseudonymous publish system.*
