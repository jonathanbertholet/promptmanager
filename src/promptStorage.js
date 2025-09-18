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
export const PROMPT_STORAGE_VERSION = 2;            // bump when schema changes (v2 adds folders + tags)
const STORAGE_KEY = 'prompts_storage';             // canonical
const LEGACY_KEY  = 'prompts';                     // kept in sync for old code

// Wrap browser.storage callbacks in Promises for readability
function storageGet(keys) {
  return new Promise(resolve => browser.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise(resolve => browser.storage.local.set(obj, resolve));
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
  // COMMENT: v2 fields – ensure new properties exist with safe defaults
  // - tags: array of unique string tags
  if (Array.isArray(p.tags)) {
    const seen = new Set();
    out.tags = p.tags
      .map(t => (typeof t === 'string' ? t.trim() : ''))
      .filter(t => t.length > 0 && !seen.has(t) && seen.add(t));
  } else {
    out.tags = [];
  }
  // - folderId: string or null
  out.folderId = typeof p.folderId === 'string' && p.folderId.length > 0 ? p.folderId : null;
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
      // COMMENT: v2 upgrade – add folders container and normalize new fields
      const upgraded = {
        version: PROMPT_STORAGE_VERSION,
        prompts: normaliseArray(store.prompts),
        folders: Array.isArray(store.folders) ? normaliseFolderArray(store.folders) : []
      };
      await writeStore(upgraded); // persist upgrade atomically
      return upgraded;
    }
    // Ensure folders exists in v2 store
    if (!Array.isArray(store.folders)) {
      store.folders = [];
      await writeStore({ version: PROMPT_STORAGE_VERSION, prompts: normaliseArray(store.prompts), folders: [] });
    }
    return { version: store.version, prompts: normaliseArray(store.prompts), folders: normaliseFolderArray(store.folders) };
  }
  // 2) Legacy migration – only the bare array exists
  if (Array.isArray(data[LEGACY_KEY])) {
    const migrated = {
      version: PROMPT_STORAGE_VERSION,
      prompts: normaliseArray(data[LEGACY_KEY]),
      folders: []
    };
    await writeStore(migrated); // persist new shape
    return migrated;
  }
  // 3) Nothing stored yet
  return { version: PROMPT_STORAGE_VERSION, prompts: [], folders: [] };
}

// COMMENT: Low-level writer for the full store object (prompts + folders)
async function writeStore(storeObj) {
  const normalizedStore = {
    version: PROMPT_STORAGE_VERSION,
    prompts: normaliseArray(storeObj.prompts || []),
    folders: normaliseFolderArray(storeObj.folders || [])
  };
  await storageSet({
    [STORAGE_KEY]: normalizedStore,
    [LEGACY_KEY]: normalizedStore.prompts // legacy mirror for older code paths
  });
}

// COMMENT: Back-compat writer that accepts just prompts and preserves folders
async function writeStorage(prompts) {
  const data = await storageGet([STORAGE_KEY]);
  const currentFolders = (data[STORAGE_KEY] && Array.isArray(data[STORAGE_KEY].folders)) ? data[STORAGE_KEY].folders : [];
  await writeStore({ prompts, folders: currentFolders });
}

// ---------------------------
// Folder helpers (v2)
// ---------------------------
function normaliseFolder(folder = {}) {
  return {
    id: typeof folder.id === 'string' && folder.id ? folder.id : generateUUID(),
    name: typeof folder.name === 'string' ? folder.name : '',
    parentId: typeof folder.parentId === 'string' && folder.parentId ? folder.parentId : null,
    createdAt: folder.createdAt || new Date().toISOString(),
    ...(folder.updatedAt ? { updatedAt: folder.updatedAt } : {})
  };
}
function normaliseFolderArray(folders) {
  return Array.isArray(folders) ? folders.map(normaliseFolder) : [];
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

export async function savePrompt({ title, content, uuid, tags = [], folderId = null }) {
  if (!title || !content) throw new Error('Title & content are required');
  const prompts = await getPrompts();
  const prompt = normalisePrompt({ uuid, title, content, tags, folderId });
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

// ---------------------------
// Tag & Folder API (v2)
// ---------------------------

// COMMENT: Folders CRUD
export async function getFolders() {
  const { folders } = await readRawStorage();
  return folders;
}

export async function setFolders(folders) {
  const { prompts } = await readRawStorage();
  await writeStore({ version: PROMPT_STORAGE_VERSION, prompts, folders });
}

export async function saveFolder({ name, parentId = null, id }) {
  if (!name || typeof name !== 'string') throw new Error('Folder name is required');
  const folders = await getFolders();
  const folder = normaliseFolder({ id, name: name.trim(), parentId });
  folders.push(folder);
  await setFolders(folders);
  return folder;
}

export async function updateFolder(id, partial) {
  const folders = await getFolders();
  const idx = folders.findIndex(f => f.id === id);
  if (idx === -1) throw new Error('Folder not found');
  folders[idx] = normaliseFolder({ ...folders[idx], ...partial, updatedAt: new Date().toISOString() });
  await setFolders(folders);
  return folders[idx];
}

export async function deleteFolder(id) {
  const { prompts, folders } = await readRawStorage();
  const remainingFolders = folders.filter(f => f.id !== id);
  // COMMENT: Detach prompts from the deleted folder (non-destructive)
  const updatedPrompts = prompts.map(p => (p.folderId === id ? { ...p, folderId: null } : p));
  await writeStore({ version: PROMPT_STORAGE_VERSION, prompts: updatedPrompts, folders: remainingFolders });
  return true;
}

// COMMENT: Prompt <-> Folder linkage helper
export async function movePromptToFolder(promptUuid, folderId = null) {
  // Allow null to remove from any folder; if provided, ensure folder exists
  if (folderId) {
    const folders = await getFolders();
    if (!folders.find(f => f.id === folderId)) throw new Error('Target folder does not exist');
  }
  return await updatePrompt(promptUuid, { folderId });
}

// COMMENT: Prompt tags helpers
export async function addTagToPrompt(promptUuid, tag) {
  const clean = typeof tag === 'string' ? tag.trim() : '';
  if (!clean) return await getPrompts();
  const prompts = await getPrompts();
  const idx = prompts.findIndex(p => p.uuid === promptUuid);
  if (idx === -1) throw new Error('Prompt not found');
  const set = new Set(prompts[idx].tags || []);
  set.add(clean);
  return await updatePrompt(promptUuid, { tags: Array.from(set) });
}

export async function removeTagFromPrompt(promptUuid, tag) {
  const prompts = await getPrompts();
  const idx = prompts.findIndex(p => p.uuid === promptUuid);
  if (idx === -1) throw new Error('Prompt not found');
  const next = (prompts[idx].tags || []).filter(t => t !== tag);
  return await updatePrompt(promptUuid, { tags: next });
}

export async function setTagsForPrompt(promptUuid, tags = []) {
  return await updatePrompt(promptUuid, { tags });
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
  // COMMENT: Accept both legacy array and new store-object with folders
  if (Array.isArray(imported)) {
    return await mergePrompts(imported);
  }
  if (imported && typeof imported === 'object') {
    const { prompts = [], folders = [] } = imported;
    const mergedPrompts = await mergePrompts(prompts);
    // Merge folders by id
    const currentFolders = await getFolders();
    const map = new Map(currentFolders.map(f => [f.id, f]));
    normaliseFolderArray(folders).forEach(f => { map.set(f.id, f); });
    await setFolders(Array.from(map.values()));
    return mergedPrompts;
  }
  throw new Error('Invalid JSON format – expected an array or store object');
}

// Change listener convenience wrapper
export function onPromptsChanged(callback) {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY] || changes[LEGACY_KEY]) {
      getPrompts().then(callback);
    }
  });
} 