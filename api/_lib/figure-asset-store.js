'use strict';

const {
  normalizeSlug,
  getStoreMode: getSvgStoreMode,
  KvOperationError,
  KvConfigurationError,
  isKvConfigured,
  __helpers
} = require('./svg-store');

const {
  clone,
  applyStorageMetadata,
  buildSvgEntry,
  stripAssetExtension,
  normalizeEntrySlug,
  loadKvClient
} = __helpers || {};

const KEY_PREFIX = 'figureAsset:';
const INDEX_KEY = 'figureAsset:__slugs__';

const globalScope = typeof globalThis === 'object' && globalThis ? globalThis : global;

const memoryStore = globalScope.__FIGURE_ASSET_MEMORY_STORE__ || new Map();
const memoryIndex = globalScope.__FIGURE_ASSET_MEMORY_INDEX__ || new Set();

globalScope.__FIGURE_ASSET_MEMORY_STORE__ = memoryStore;
globalScope.__FIGURE_ASSET_MEMORY_INDEX__ = memoryIndex;

function ensureHelper(name, helper) {
  if (typeof helper === 'function') {
    return helper;
  }
  throw new Error(`Missing svg-store helper: ${name}`);
}

const cloneHelper = ensureHelper('clone', clone);
const applyStorageMetadataHelper = ensureHelper('applyStorageMetadata', applyStorageMetadata);
const buildSvgEntryHelper = ensureHelper('buildSvgEntry', buildSvgEntry);
const stripAssetExtensionHelper = ensureHelper('stripAssetExtension', stripAssetExtension);
const normalizeEntrySlugHelper = ensureHelper('normalizeEntrySlug', normalizeEntrySlug);
const loadKvClientHelper = ensureHelper('loadKvClient', loadKvClient);

function makeKey(slug) {
  return KEY_PREFIX + slug;
}

function normalizeAssetSlug(value) {
  const normalized = normalizeEntrySlugHelper(value);
  if (!normalized) return null;
  return stripAssetExtensionHelper(normalized);
}

function buildRawAssetUrl(assetSlug) {
  if (typeof assetSlug !== 'string') return null;
  const trimmed = assetSlug.trim().replace(/^\/+/, '');
  if (!trimmed) return null;
  const params = new URLSearchParams();
  params.set('slug', trimmed);
  return `/api/figure-library/raw?${params.toString()}`;
}

function applyFigureAssetUrls(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const normalizedSlug = normalizeAssetSlug(entry.slug || entry.baseSlug || entry.svgSlug);
  const svgSlug = typeof entry.svgSlug === 'string' && entry.svgSlug
    ? entry.svgSlug
    : normalizedSlug
      ? `${normalizedSlug}.svg`
      : null;

  const hasPngData = Boolean(entry.png || (entry.files && entry.files.png));
  const pngSlug = typeof entry.pngSlug === 'string' && entry.pngSlug
    ? entry.pngSlug
    : hasPngData && normalizedSlug
      ? `${normalizedSlug}.png`
      : null;

  if (!entry.files || typeof entry.files !== 'object') {
    entry.files = {};
  }
  if (!entry.urls || typeof entry.urls !== 'object') {
    entry.urls = {};
  }

  if (svgSlug) {
    const svgUrl = buildRawAssetUrl(svgSlug);
    entry.svgSlug = svgSlug;
    if (!entry.files.svg || typeof entry.files.svg !== 'object') {
      entry.files.svg = {};
    }
    entry.files.svg.slug = svgSlug;
    if (svgUrl) {
      entry.files.svg.url = svgUrl;
      entry.urls.svg = svgUrl;
    }
  }

  if (pngSlug) {
    const pngUrl = buildRawAssetUrl(pngSlug);
    entry.pngSlug = pngSlug;
    if (!entry.files.png || typeof entry.files.png !== 'object') {
      entry.files.png = {};
    }
    entry.files.png.slug = pngSlug;
    if (pngUrl) {
      entry.files.png.url = pngUrl;
      entry.urls.png = pngUrl;
    }
  } else {
    if (entry.files && entry.files.png && typeof entry.files.png === 'object') {
      const existingSlug = typeof entry.files.png.slug === 'string' && entry.files.png.slug.trim()
        ? entry.files.png.slug.trim()
        : null;
      if (existingSlug) {
        entry.files.png.url = buildRawAssetUrl(existingSlug) || entry.files.png.url;
      } else {
        delete entry.files.png.url;
      }
    }
    if (entry.urls && entry.urls.png && !entry.png && !pngSlug) {
      delete entry.urls.png;
    }
  }

  return entry;
}

function writeToMemory(slug, entry) {
  const normalized = normalizeAssetSlug(slug);
  if (!normalized) return;
  const key = makeKey(normalized);
  memoryStore.set(key, cloneHelper(entry));
  memoryIndex.add(normalized);
}

function deleteFromMemory(slug) {
  const normalized = normalizeAssetSlug(slug);
  if (!normalized) return;
  const key = makeKey(normalized);
  memoryStore.delete(key);
  memoryIndex.delete(normalized);
}

function readFromMemory(slug) {
  const normalized = normalizeAssetSlug(slug);
  if (!normalized) return null;
  const key = makeKey(normalized);
  const value = memoryStore.get(key);
  return value ? cloneHelper(value) : null;
}

async function writeToKv(slug, entry) {
  const kv = await loadKvClientHelper();
  const normalized = normalizeAssetSlug(slug);
  if (!normalized) {
    throw new KvOperationError('Invalid slug for figure asset KV write', { code: 'INVALID_SLUG' });
  }
  const key = makeKey(normalized);
  try {
    await kv.set(key, entry);
    await kv.sadd(INDEX_KEY, normalized);
  } catch (error) {
    throw new KvOperationError(`Failed to write figure asset ${slug}`, { cause: error });
  }
}

async function readFromKv(slug) {
  const kv = await loadKvClientHelper();
  const normalized = normalizeAssetSlug(slug);
  if (!normalized) {
    throw new KvOperationError('Invalid slug for figure asset KV read', { code: 'INVALID_SLUG' });
  }
  const key = makeKey(normalized);
  try {
    const value = await kv.get(key);
    if (value == null) return null;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new KvOperationError('Failed to parse figure asset from KV', { cause: error });
      }
    }
    if (typeof value === 'object') {
      return value;
    }
    throw new KvOperationError('Unsupported KV payload type for figure asset', {
      code: 'KV_UNSUPPORTED_VALUE_TYPE'
    });
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError(`Failed to read figure asset ${slug}`, { cause: error });
  }
}

async function deleteFromKv(slug) {
  const kv = await loadKvClientHelper();
  const normalized = normalizeAssetSlug(slug);
  if (!normalized) {
    throw new KvOperationError('Invalid slug for figure asset KV delete', { code: 'INVALID_SLUG' });
  }
  const key = makeKey(normalized);
  try {
    await kv.del(key);
    await kv.srem(INDEX_KEY, normalized);
  } catch (error) {
    throw new KvOperationError(`Failed to delete figure asset ${slug}`, { cause: error });
  }
}

function ensureAssetEntry(slug, payload, existing) {
  const entry = buildSvgEntryHelper(slug, payload || {}, existing || {});
  applyFigureAssetUrls(entry);
  return entry;
}

function getStoreMode() {
  return getSvgStoreMode();
}

async function getFigureAsset(slug) {
  const normalized = normalizeAssetSlug(slug);
  if (!normalized) return null;
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    const kvValue = await readFromKv(normalized);
    if (kvValue) {
      const entry = ensureAssetEntry(normalized, kvValue, kvValue);
      applyStorageMetadataHelper(entry, 'kv');
      writeToMemory(normalized, entry);
      return cloneHelper(entry);
    }
  }
  const memoryValue = readFromMemory(normalized);
  if (memoryValue) {
    const entry = ensureAssetEntry(normalized, memoryValue, memoryValue);
    const mode = storeMode === 'kv' ? 'kv' : storeMode;
    applyStorageMetadataHelper(entry, mode);
    writeToMemory(normalized, entry);
    return cloneHelper(entry);
  }
  return null;
}

async function setFigureAsset(slug, payload = {}) {
  const normalized = normalizeAssetSlug(slug || payload.slug);
  if (!normalized) return null;
  const existing = readFromMemory(normalized);
  const entry = ensureAssetEntry(normalized, payload, existing || null);
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await writeToKv(normalized, entry);
    const annotated = applyStorageMetadataHelper({ ...entry }, 'kv');
    writeToMemory(normalized, annotated);
    return cloneHelper(annotated);
  }
  const annotated = applyStorageMetadataHelper(entry, storeMode);
  writeToMemory(normalized, annotated);
  return cloneHelper(annotated);
}

async function deleteFigureAsset(slug) {
  const normalized = normalizeAssetSlug(slug);
  if (!normalized) return false;
  if (getStoreMode() === 'kv') {
    await deleteFromKv(normalized);
  }
  deleteFromMemory(normalized);
  return true;
}

async function listFigureAssets() {
  const entries = [];
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    const kv = await loadKvClientHelper();
    let slugs = [];
    try {
      const raw = await kv.smembers(INDEX_KEY);
      if (Array.isArray(raw)) slugs = raw;
    } catch (error) {
      throw new KvOperationError('Failed to read figure asset index from KV', { cause: error });
    }
    for (const value of slugs) {
      const normalized = normalizeAssetSlug(value);
      if (!normalized) continue;
      const stored = await readFromKv(normalized);
      if (!stored) continue;
      const entry = ensureAssetEntry(normalized, stored, stored);
      applyStorageMetadataHelper(entry, 'kv');
      writeToMemory(normalized, entry);
      entries.push(cloneHelper(entry));
    }
    return entries;
  }
  memoryIndex.forEach(slug => {
    const normalized = normalizeAssetSlug(slug);
    if (!normalized) return;
    const stored = readFromMemory(normalized);
    if (!stored) return;
    const entry = ensureAssetEntry(normalized, stored, stored);
    applyStorageMetadataHelper(entry, storeMode);
    entries.push(cloneHelper(entry));
  });
  return entries;
}

module.exports = {
  normalizeSlug,
  normalizeAssetSlug,
  stripAssetExtension: stripAssetExtensionHelper,
  getFigureAsset,
  setFigureAsset,
  deleteFigureAsset,
  listFigureAssets,
  applyFigureAssetUrls,
  getStoreMode,
  isKvConfigured,
  KvOperationError,
  KvConfigurationError
};
