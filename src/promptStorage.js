// promptStorage.js – unified, versioned prompt storage manager
//
// Everything that needs to read/write prompts should go through this file ONLY.
// It normalises structures, performs legacy-key migration, mirrors data for
// backwards compatibility, and exposes a tiny Promise-based API.
//
// NOTE:  The extension uses MV3 so ES-modules are allowed in service-worker
//        and side-panel.  Content-scripts import this file dynamically.

import { generateUUID } from './utils.js';

// ---------------------------
// Constants & helpers
// ---------------------------
export const PROMPT_STORAGE_VERSION = 1;            // bump when schema changes
const STORAGE_KEY = 'prompts_storage';             // canonical
const LEGACY_KEY  = 'prompts';                     // kept in sync for old code

// Wrap chrome.storage callbacks in Promises for readability
function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

// Normalise a single prompt so we *always* work with the same shape
function normalisePrompt(p = {}) {
  const out = {
    // Prefer existing ids (uuid > id > generated)
    uuid: p.uuid || p.id || generateUUID(),
    title: typeof p.title === 'string' ? p.title : '',
    content: typeof p.content === 'string' ? p.content : '',
    createdAt: p.createdAt || new Date().toISOString()
  };
  if (p.updatedAt) out.updatedAt = p.updatedAt;
  return out;
}
function normaliseArray(arr) {
  return Array.isArray(arr) ? arr.map(normalisePrompt) : [];
}

// ---------------------------
// Internal read / write
// ---------------------------
async function readRawStorage() {
  const data = await storageGet([STORAGE_KEY, LEGACY_KEY]);
  // 1) Happy path – already using canonical key
  if (data[STORAGE_KEY] && Array.isArray(data[STORAGE_KEY].prompts)) {
    const store = data[STORAGE_KEY];
    // Guard against corrupt version
    if (store.version !== PROMPT_STORAGE_VERSION) {
      // Silently upgrade – future-proofing
      store.version = PROMPT_STORAGE_VERSION;
      store.prompts = normaliseArray(store.prompts);
      await writeStorage(store.prompts); // persist upgrade
    }
    return store;
  }
  // 2) Legacy migration – only the bare array exists
  if (Array.isArray(data[LEGACY_KEY])) {
    const migrated = {
      version: PROMPT_STORAGE_VERSION,
      prompts: normaliseArray(data[LEGACY_KEY])
    };
    await writeStorage(migrated.prompts); // persist in both keys
    return migrated;
  }
  // 3) Nothing stored yet
  return { version: PROMPT_STORAGE_VERSION, prompts: [] };
}

async function writeStorage(prompts) {
  const storeObj = {
    version: PROMPT_STORAGE_VERSION,
    prompts: normaliseArray(prompts)
  };
  // Write canonical + legacy mirror so older code keeps working
  await storageSet({
    [STORAGE_KEY]: storeObj,
    [LEGACY_KEY]: storeObj.prompts
  });
}

// ---------------------------
// Public API
// ---------------------------
export async function getPrompts() {
  const { prompts } = await readRawStorage();
  return prompts;
}

export async function setPrompts(prompts) {
  // Replace entire list (used in bulk operations)
  await writeStorage(prompts);
}

export async function savePrompt({ title, content, uuid }) {
  if (!title || !content) throw new Error('Title & content are required');
  const prompts = await getPrompts();
  const prompt = normalisePrompt({ uuid, title, content });
  prompts.push(prompt);
  await writeStorage(prompts);
  return { success: true, prompt };
}

export async function updatePrompt(uuid, partial) {
  const prompts = await getPrompts();
  const idx = prompts.findIndex(p => p.uuid === uuid);
  if (idx === -1) throw new Error('Prompt not found');
  prompts[idx] = normalisePrompt({ ...prompts[idx], ...partial, updatedAt: new Date().toISOString() });
  await writeStorage(prompts);
  return prompts[idx];
}

export async function deletePrompt(uuid) {
  const prompts = (await getPrompts()).filter(p => p.uuid !== uuid);
  await writeStorage(prompts);
  return true;
}

export async function mergePrompts(imported) {
  const base = await getPrompts();
  const map = new Map(base.map(p => [p.uuid, p]));
  imported.forEach(raw => {
    const p = normalisePrompt(raw);
    const existing = map.get(p.uuid);
    if (existing) {
      // keep the newer one (compare updatedAt | createdAt)
      const oldDate = new Date(existing.updatedAt || existing.createdAt);
      const newDate = new Date(p.updatedAt || p.createdAt);
      if (newDate > oldDate) map.set(p.uuid, p);
    } else {
      map.set(p.uuid, p);
    }
  });
  const merged = Array.from(map.values());
  await writeStorage(merged);
  return merged;
}

// ---------- import / export helpers ----------
export async function exportPrompts() {
  const json = JSON.stringify(await getPrompts(), null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prompts-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

export async function importPrompts(source) {
  // source can be File, Array, or raw JSON string
  let imported;
  if (Array.isArray(source)) {
    imported = source;
  } else if (source instanceof File) {
    const text = await source.text();
    imported = JSON.parse(text);
  } else if (typeof source === 'string') {
    imported = JSON.parse(source);
  } else {
    throw new Error('Unsupported import source');
  }
  if (!Array.isArray(imported)) throw new Error('Invalid JSON format – expected an array');
  return await mergePrompts(imported);
}

// Change listener convenience wrapper
export function onPromptsChanged(callback) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY] || changes[LEGACY_KEY]) {
      getPrompts().then(callback);
    }
  });
} 