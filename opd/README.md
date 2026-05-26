# Open Prompt Database (OPD)

Community prompt catalog for **Open Prompt Manager**. Phase 1: read-only website on Cloudflare Workers + D1 + static assets.

**Import into OPM:** “Add to Open Prompt Manager” sends `OPD_IMPORT_PROMPT` to the extension (`externally_connectable` on `https://openpromptdatabase.com` + localhost). Requires a dev or store build of Open Prompt Manager with `src/opd/opdImport.js` wired in the service worker.

**Production site:** [https://openpromptdatabase.com](https://openpromptdatabase.com)

**Publish from extension:** infrastructure is in place (API + OPM service worker messages). UI/UX to call it is a separate task. See `plan-publish-infra.md`.

## Quick start (local)

```bash
cd opd
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:8787](http://localhost:8787) (fixed port in `wrangler.jsonc`).

If you see **connection refused**, run `npm run dev` in `opd/` and use only one dev server at a time (two instances can lock the local D1 database).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Build client bundles, then `wrangler dev` |
| `npm run build:client` | Esbuild page bundles → `public/assets/dist/` |
| `npm run db:migrate` | Apply `schema.sql` + migrations (`002`–`004`) to local D1 |
| `npm run db:generate-demo` | Regenerate `data/demo-prompts.json` (~250 catalog prompts) |
| `npm run db:seed` | Build `seed.sql` (demo + legacy test prompts) and load local D1 |
| `npm run db:reset` | Wipe local D1 state, migrate, seed |
| `npm run deploy` | Deploy to Cloudflare (requires account + real D1 id in `wrangler.jsonc`) |

## API (v1)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/home` | Homepage bundle — `popularTags`, `popular`, `recent` (card snippets) |
| `GET` | `/v1/prompts` | List — `?view=card` (default), `?includeTotal=0` on page 2+, FTS when `q` is set |
| `GET` | `/v1/prompts/:id` | Single prompt |
| `GET` | `/v1/tags` | All tags; `?popular=16` for mega-menu subset |
| `GET` | `/v1/handles/:handle/available` | Username availability |
| `GET` | `/v1/publishers/me` | Current publisher (`X-OPD-Token`) |
| `POST` | `/v1/publishers` | Register handle (`X-OPD-Token`, Turnstile when configured) |
| `POST` | `/v1/prompts` | Create/update prompt (`X-OPD-Token`, Turnstile when configured) |
| `DELETE` | `/v1/prompts/:id` | Soft-delete own prompt |
| `POST` | `/v1/prompts/:id/report` | Abuse report |
| `POST` | `/v1/prompts/:id/import` | Increment import counter (after OPM import) |

**Secrets (production):** `wrangler secret put TURNSTILE_SECRET_KEY` — if unset, Turnstile is skipped (local dev). Optional: `OPD_ADMIN_TOKEN`, KV namespace `RATE_LIMIT` in `wrangler.jsonc` for rate limits.

## Routes (site)

| URL | Page |
|-----|------|
| `/` | Home — popular & recent (24 max each), See all |
| `/browse` | Full catalog (`?sort=recent\|downloads\|title`) |
| `/tags` | All tags (A–Z / `#`) |
| `/t/:tag` | Prompts in a tag (50/page, sortable) |
| `/p/:id` | Prompt detail |
| `/about` | About & trust copy |
| `/u/:author` | Author-filtered browse (legacy) |

## Deploy to Cloudflare

The site is built for **Workers + D1 + static assets** — a good fit for this catalog.

1. Log in: `npx wrangler login`
2. Create production D1 (once): `npx wrangler d1 create opd-db`
3. Copy the returned `database_id` into `wrangler.jsonc` (replace `local-opd-db`)
4. Apply schema and seed remote DB:
   ```bash
   npm run db:migrate:remote
   npm run db:seed:remote
   ```
5. Deploy: `npm run deploy`
6. Custom domain is configured in `wrangler.jsonc` (`openpromptdatabase.com`). After DNS is active, `npm run deploy` attaches it; `workers.dev` remains enabled as a fallback.

After deploy, run `npm run db:seed:remote` again whenever you regenerate the demo catalog locally.

**Favicon:** `public/favicon.png` and `apple-touch-icon.png` (Open Prompt Manager icon).

**SEO:** `/robots.txt` and `/sitemap.xml` (Worker + D1). Prompt pages set Open Graph / Twitter meta and JSON-LD client-side; share previews use `/apple-touch-icon.png`.

## Styling

Edit source styles in `public/assets/opd-base.css` and `public/assets/opd.css`, then run `npm run build:css` to emit `opd-critical.css` (above-the-fold) and `opd.bundle.css` (minified full site). HTML pages load critical CSS immediately and fetch the bundle asynchronously. The full extension `styles.css` is no longer loaded on catalog pages.

## Performance (Tier 1 + 2)

- **API:** Card list view (snippets, not full bodies), `GET /v1/home` (edge-cached 24h), `catalog_tags`, `prompt_tags` indexed filter, FTS5 search, `includeTotal=0` on later pages, edge cache on GET `/v1/*`.
- **Frontend:** Critical CSS (`opd-critical.css`) + deferred minified bundle (`opd.bundle.css` via `npm run build:css`), inline SVG icons (no Google Fonts), lazy-loaded search modal, esbuild page bundles under `public/assets/dist/`.

After pulling schema changes, run `npm run db:migrate` and `npm run db:seed` (local or remote) so `catalog_tags`, `prompts_fts`, and indexes are populated.
