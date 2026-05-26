import { jsonResponse } from './cors.js';
import {
  ftsQuery,
  parseAuthor,
  parseLimit,
  parseOffset,
  parseQuery,
  parseSort,
  parseTag,
  parseView,
  rowToListItem,
  rowToPrompt,
} from './validate.js';

/**
 * @param {'recent'|'downloads'|'title'} sort
 * @param {string} alias
 */
function orderClause(sort, alias = 'p') {
  if (sort === 'downloads') {
    return `${alias}.import_count DESC, ${alias}.published_at DESC`;
  }
  if (sort === 'title') return `${alias}.title COLLATE NOCASE ASC`;
  return `${alias}.published_at DESC`;
}

/**
 * @param {D1Database} db
 * @param {number} popularN
 */
async function listTagsFromTable(db, popularN = 0) {
  let sql = `SELECT tag, count FROM catalog_tags ORDER BY count DESC, tag ASC`;
  if (popularN > 0) {
    sql += ` LIMIT ${Math.min(popularN, 48)}`;
  }
  const { results } = await db.prepare(sql).all();
  return (results || []).map((r) => ({ tag: r.tag, count: Number(r.count) || 0 }));
}

/**
 * Fallback when catalog_tags is empty (pre-migration).
 * @param {D1Database} db
 */
async function aggregateTagsLegacy(db) {
  const { results } = await db.prepare(`SELECT tags FROM prompts WHERE deleted_at IS NULL`).all();
  const counts = new Map();
  for (const row of results || []) {
    try {
      const tags = JSON.parse(String(row.tags || '[]'));
      if (!Array.isArray(tags)) continue;
      for (const tag of tags) {
        if (typeof tag !== 'string') continue;
        const key = tag.trim().toLowerCase();
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    } catch {
      /* ignore */
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/**
 * @param {D1Database} db
 * @param {number} popularN
 */
export async function listTagsData(db, popularN = 0) {
  let items = await listTagsFromTable(db, 0);
  if (!items.length) {
    items = await aggregateTagsLegacy(db);
  }
  if (popularN > 0) {
    items = items.slice(0, Math.min(popularN, 48));
  }
  return items;
}

/**
 * @param {object} opts
 */
async function queryPromptList(db, opts) {
  const {
    q,
    tag,
    author,
    limit,
    offset,
    sort,
    view,
    includeTotal,
    useFts,
  } = opts;

  const conditions = [
    'p.deleted_at IS NULL',
    `NOT EXISTS (
      SELECT 1 FROM publishers pub
      WHERE pub.username = p.author AND pub.banned_at IS NOT NULL
    )`,
  ];
  const binds = [];
  let fromClause = 'FROM prompts p';
  let ftsMatch = '';

  if (useFts && q) {
    ftsMatch = ftsQuery(q);
    fromClause = 'FROM prompts p INNER JOIN prompts_fts fts ON fts.id = p.id';
    conditions.push('prompts_fts MATCH ?');
    binds.push(ftsMatch);
  } else if (q) {
    conditions.push('(p.title LIKE ? OR p.content LIKE ?)');
    binds.push(`%${q}%`, `%${q}%`);
  }

  if (author) {
    conditions.push('p.author = ?');
    binds.push(author);
  }
  if (tag) {
    conditions.push(
      `EXISTS (SELECT 1 FROM prompt_tags pt WHERE pt.prompt_id = p.id AND pt.tag = ?)`
    );
    binds.push(tag);
  }

  const where = conditions.join(' AND ');

  /** One aggregation query when we need COUNT and/or author import sum. */
  let total;
  let authorStats;
  if (includeTotal || author) {
    const aggParts = [];
    if (includeTotal) aggParts.push('COUNT(*) AS prompt_count');
    if (author) aggParts.push('COALESCE(SUM(p.import_count), 0) AS total_imports');
    const statsRow = await db
      .prepare(`SELECT ${aggParts.join(', ')} ${fromClause} WHERE ${where}`)
      .bind(...binds)
      .first();
    if (includeTotal) {
      total = Number(statsRow?.prompt_count) || 0;
    }
    if (author) {
      authorStats = {
        totalImports: Number(statsRow?.total_imports) || 0,
      };
    }
  }

  const fetchLimit = includeTotal ? limit : limit + 1;
  const contentCol = view === 'card' ? 'SUBSTR(p.content, 1, 220) AS content' : 'p.content';
  const sql = `
    SELECT p.id, p.title, ${contentCol}, p.tags, p.author, p.published_at, p.updated_at, p.import_count
    ${fromClause}
    WHERE ${where}
    ORDER BY ${orderClause(sort, 'p')}
    LIMIT ? OFFSET ?
  `;

  const { results } = await db.prepare(sql).bind(...binds, fetchLimit, offset).all();
  let rows = results || [];

  let hasMore = false;
  if (!includeTotal && rows.length > limit) {
    hasMore = true;
    rows = rows.slice(0, limit);
  }

  const items = rows.map((row) => rowToListItem(row, view));

  return {
    items,
    meta: {
      limit,
      offset,
      count: items.length,
      sort,
      view,
      ...(includeTotal ? { total } : { hasMore }),
      ...(authorStats ? { authorStats } : {}),
    },
  };
}

/**
 * GET /v1/prompts — search, filter, paginate, sort.
 * @param {Request} request
 * @param {D1Database} db
 */
export async function listPrompts(request, db) {
  const url = new URL(request.url);
  const q = parseQuery(url.searchParams.get('q'));
  const tag = parseTag(url.searchParams.get('tag'));
  const author = parseAuthor(url.searchParams.get('author'));
  const limit = parseLimit(url.searchParams.get('limit'), 20, 50);
  const offset = parseOffset(url.searchParams.get('offset'));
  const sort = parseSort(url.searchParams.get('sort'));
  const view = parseView(url.searchParams.get('view'));
  const includeTotal =
    url.searchParams.get('includeTotal') !== '0' &&
    (offset === 0 || url.searchParams.get('includeTotal') === '1');

  const useFts = Boolean(q);
  const baseOpts = {
    q,
    tag,
    author,
    limit,
    offset,
    sort,
    view,
    includeTotal,
  };

  if (useFts) {
    try {
      const payload = await queryPromptList(db, { ...baseOpts, useFts: true });
      return jsonResponse({ items: payload.items, nextCursor: null, meta: payload.meta }, request);
    } catch {
      /* FTS table missing or query error — fall back to LIKE */
    }
  }

  const payload = await queryPromptList(db, { ...baseOpts, useFts: false });
  return jsonResponse({ items: payload.items, nextCursor: null, meta: payload.meta }, request);
}

/**
 * GET /v1/home — popular tags + popular + recent in one response.
 * @param {Request} request
 * @param {D1Database} db
 */
export async function getHome(request, db) {
  const popularTags = await listTagsData(db, 10);

  const homeLimit = 10;
  const [popular, recent] = await Promise.all([
    queryPromptList(db, {
      q: '',
      tag: '',
      author: '',
      limit: homeLimit,
      offset: 0,
      sort: 'downloads',
      view: 'card',
      includeTotal: false,
      useFts: false,
    }),
    queryPromptList(db, {
      q: '',
      tag: '',
      author: '',
      limit: homeLimit,
      offset: 0,
      sort: 'recent',
      view: 'card',
      includeTotal: false,
      useFts: false,
    }),
  ]);

  /** Infer “see all” without expensive COUNT(*) on every home load. */
  const sectionTotal = (payload) =>
    payload.meta.hasMore ? homeLimit + 1 : payload.items.length;

  return jsonResponse(
    {
      popularTags,
      popular: popular.items,
      recent: recent.items,
      meta: {
        popularTotal: sectionTotal(popular),
        recentTotal: sectionTotal(recent),
      },
    },
    request
  );
}

/**
 * GET /v1/authors/:author — profile stats for author pages.
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} authorName
 */
export async function getAuthorStats(request, db, authorName) {
  const author = parseAuthor(authorName);
  if (!author) {
    return jsonResponse({ error: 'invalid_author' }, request, 400);
  }

  const url = new URL(request.url);
  const tag = parseTag(url.searchParams.get('tag'));
  const q = parseQuery(url.searchParams.get('q'));

  const conditions = ['p.deleted_at IS NULL', 'p.author = ?'];
  const binds = [author];
  if (q) {
    conditions.push('(p.title LIKE ? OR p.content LIKE ?)');
    binds.push(`%${q}%`, `%${q}%`);
  }
  if (tag) {
    conditions.push(
      `EXISTS (SELECT 1 FROM prompt_tags pt WHERE pt.prompt_id = p.id AND pt.tag = ?)`
    );
    binds.push(tag);
  }
  const where = conditions.join(' AND ');

  const row = await db
    .prepare(
      `SELECT COUNT(*) AS prompt_count, COALESCE(SUM(p.import_count), 0) AS total_imports
       FROM prompts p WHERE ${where}`
    )
    .bind(...binds)
    .first();

  return jsonResponse(
    {
      author,
      promptCount: Number(row?.prompt_count) || 0,
      totalImports: Number(row?.total_imports) || 0,
      filtered: Boolean(tag || q),
    },
    request
  );
}

/**
 * GET /v1/prompts/:id
 * @param {Request} request
 * @param {D1Database} db
 * @param {string} id
 */
export async function getPrompt(request, db, id) {
  const row = await db
    .prepare(
      `SELECT p.id, p.title, p.content, p.tags, p.author, p.published_at, p.updated_at, p.import_count
       FROM prompts p
       WHERE p.id = ? AND p.deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM publishers pub
         WHERE pub.username = p.author AND pub.banned_at IS NOT NULL
       )`
    )
    .bind(id)
    .first();

  if (!row) {
    return jsonResponse({ error: 'not_found' }, request, 404);
  }
  return jsonResponse({ prompt: rowToPrompt(row) }, request);
}

/**
 * GET /v1/tags — ?popular=N for mega-menu subset.
 * @param {Request} request
 * @param {D1Database} db
 */
export async function listTags(request, db) {
  const url = new URL(request.url);
  const popularN = Number.parseInt(url.searchParams.get('popular') || '', 10);
  const items = await listTagsData(
    db,
    Number.isFinite(popularN) && popularN > 0 ? popularN : 0
  );
  return jsonResponse({ items }, request);
}
