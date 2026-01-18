'use strict';

const {
  normalizeSlug,
  setFigureAsset,
  getFigureAsset,
  deleteFigureAsset,
  getStoreMode: getFigureAssetStoreMode,
  applyFigureAssetUrls,
  KvOperationError,
  KvConfigurationError,
  isKvConfigured
} = require('./figure-asset-store');
const { loadKvClient: loadRedisKvClient } = require('./kv-client');

const FIGURE_LIBRARY_UPLOAD_TOOL_ID = 'bibliotek-upload';

const FIGURE_KEY_PREFIX = 'figure:';
const FIGURE_INDEX_KEY = 'figure:__slugs__';
const CATEGORY_KEY_PREFIX = 'figure:category:';
const CATEGORY_INDEX_KEY = 'figure:__categories__';
const globalScope = typeof globalThis === 'object' && globalThis ? globalThis : global;

const figureMemoryStore = globalScope.__FIGURE_LIBRARY_MEMORY_STORE__ || new Map();
const figureMemoryIndex = globalScope.__FIGURE_LIBRARY_MEMORY_INDEX__ || new Set();
const categoryMemoryStore = globalScope.__FIGURE_LIBRARY_CATEGORY_STORE__ || new Map();
const categoryMemoryIndex = globalScope.__FIGURE_LIBRARY_CATEGORY_INDEX__ || new Set();

globalScope.__FIGURE_LIBRARY_MEMORY_STORE__ = figureMemoryStore;
globalScope.__FIGURE_LIBRARY_MEMORY_INDEX__ = figureMemoryIndex;
globalScope.__FIGURE_LIBRARY_CATEGORY_STORE__ = categoryMemoryStore;
globalScope.__FIGURE_LIBRARY_CATEGORY_INDEX__ = categoryMemoryIndex;

function clone(entry) {
  if (entry == null) return entry;
  try {
    return JSON.parse(JSON.stringify(entry));
  } catch (error) {
    return entry;
  }
}

function normalizeStoreMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
  return null;
}

function applyStorageMetadata(entry, mode) {
  if (!entry || typeof entry !== 'object') return entry;
  const resolved = normalizeStoreMode(mode) || normalizeStoreMode(entry.mode) || normalizeStoreMode(entry.storage);
  const storageMode = resolved === 'kv' ? 'kv' : 'memory';
  entry.storage = storageMode;
  entry.mode = storageMode;
  entry.storageMode = storageMode;
  entry.persistent = storageMode === 'kv';
  entry.ephemeral = storageMode !== 'kv';
  return entry;
}

function stripAssetExtension(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\.(?:svg|png)$/gi, '');
}

function normalizeFigureSlug(value) {
  const normalized = normalizeSlug(value);
  if (!normalized) return null;
  return stripAssetExtension(normalized);
}

function makeFigureKey(slug) {
  return FIGURE_KEY_PREFIX + slug;
}

function makeCategoryKey(id) {
  return CATEGORY_KEY_PREFIX + id;
}

function sanitizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function sanitizeOptionalText(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function readCategoryLabel(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function sanitizeCategoryLabel(value) {
  const text = readCategoryLabel(value);
  return text || '';
}

function normalizeCategoryId(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 128);
  return normalized || null;
}

function deriveCategoryId(label, fallback) {
  const fromLabel = normalizeCategoryId(label);
  if (fromLabel) return fromLabel;
  if (typeof fallback === 'string') {
    const normalized = normalizeCategoryId(fallback);
    if (normalized) return normalized;
  }
  return null;
}

function sanitizeTags(value) {
  return sanitizeStringArray(value);
}

function sanitizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const entries = [];
  value.forEach(entry => {
    if (typeof entry !== 'string') return;
    const trimmed = entry.trim();
    if (!trimmed) return;
    const normalized = trimmed.slice(0, 128);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    entries.push(normalized);
  });
  return entries;
}

function sanitizeApps(value) {
  return sanitizeStringArray(value);
}

function sanitizeCategoryDescription(value) {
  const optional = sanitizeOptionalText(value);
  return optional === undefined ? undefined : optional;
}

function resolveCategoryRequest(payload, existing) {
  const result = { clear: false, data: null };
  const source = payload && typeof payload === 'object' ? payload : {};
  const categoryObject = source.category && typeof source.category === 'object' ? source.category : null;
  const hasCategoryIdField = Object.prototype.hasOwnProperty.call(source, 'categoryId');
  const hasCategoryLabelField = Object.prototype.hasOwnProperty.call(source, 'categoryLabel');
  const hasCategoryNameField = Object.prototype.hasOwnProperty.call(source, 'categoryName');
  const hasCategoryAppsField =
    (categoryObject && Object.prototype.hasOwnProperty.call(categoryObject, 'apps')) ||
    Object.prototype.hasOwnProperty.call(source, 'categoryApps') ||
    Object.prototype.hasOwnProperty.call(source, 'apps');

  let candidateId = null;
  if (hasCategoryIdField) {
    candidateId = source.categoryId;
  }
  if (categoryObject && Object.prototype.hasOwnProperty.call(categoryObject, 'id') && categoryObject.id != null) {
    candidateId = categoryObject.id;
  }

  let candidateLabel = null;
  if (categoryObject && Object.prototype.hasOwnProperty.call(categoryObject, 'label')) {
    candidateLabel = categoryObject.label;
  }
  if (hasCategoryLabelField) {
    candidateLabel = source.categoryLabel;
  }
  if (hasCategoryNameField) {
    candidateLabel = source.categoryName;
  }

  let candidateApps = null;
  if (categoryObject && Object.prototype.hasOwnProperty.call(categoryObject, 'apps')) {
    candidateApps = sanitizeApps(categoryObject.apps);
  } else if (Object.prototype.hasOwnProperty.call(source, 'categoryApps')) {
    candidateApps = sanitizeApps(source.categoryApps);
  } else if (Object.prototype.hasOwnProperty.call(source, 'apps')) {
    candidateApps = sanitizeApps(source.apps);
  }

  const normalizedId = normalizeCategoryId(candidateId);
  const sanitizedLabel = readCategoryLabel(candidateLabel);
  const existingCategoryId = existing && existing.categoryId ? normalizeCategoryId(existing.categoryId) : null;

  const explicitClear =
    (hasCategoryIdField && (candidateId === null || candidateId === undefined || candidateId === '')) && !sanitizedLabel;

  if (explicitClear || (categoryObject && !Object.keys(categoryObject).length && !sanitizedLabel)) {
    result.clear = true;
    return result;
  }

  if (normalizedId || sanitizedLabel) {
    result.data = {
      id: normalizedId || undefined,
      label: sanitizedLabel || undefined
    };
    if (hasCategoryAppsField) {
      result.data.apps = candidateApps || [];
    }
    return result;
  }

  if (hasCategoryAppsField && (normalizedId || existingCategoryId)) {
    result.data = {
      id: normalizedId || existingCategoryId || undefined,
      apps: candidateApps || []
    };
    return result;
  }

  if (!hasCategoryIdField && !hasCategoryLabelField && !hasCategoryNameField && !categoryObject) {
    if (existing && existing.categoryId) {
      result.data = { id: existing.categoryId };
    }
    return result;
  }

  result.clear = true;
  return result;
}

function ensureFigureEntryShape(slug, payload) {
  if (!payload || typeof payload !== 'object') return null;
  const entry = clone(payload);
  entry.slug = slug;
  if (entry.category && typeof entry.category === 'object') {
    if (!entry.categoryId && typeof entry.category.id === 'string') {
      entry.categoryId = normalizeCategoryId(entry.category.id);
    }
  }
  if (entry.categoryId) {
    entry.categoryId = normalizeCategoryId(entry.categoryId) || null;
  }
  if (!Array.isArray(entry.tags)) {
    entry.tags = sanitizeTags(entry.tags);
  } else {
    entry.tags = sanitizeTags(entry.tags);
  }
  if (!entry.name) {
    const fallbackName = sanitizeOptionalText(entry.title || entry.slug);
    if (fallbackName) {
      entry.name = fallbackName;
    }
  }
  applyFigureAssetUrls(entry);
  return entry;
}

function ensureCategoryEntryShape(id, payload, existing) {
  const now = new Date().toISOString();
  const base = payload && typeof payload === 'object' ? payload : {};
  const resolvedId = normalizeCategoryId(base.id) || normalizeCategoryId(base.categoryId) || id;
  const existingLabel = existing && typeof existing.label === 'string' ? existing.label : '';
  const label = sanitizeCategoryLabel(base.label || base.name || base.title || existingLabel || resolvedId);
  const description = sanitizeCategoryDescription(base.description);
  const hasAppsField =
    Object.prototype.hasOwnProperty.call(base, 'apps') || Object.prototype.hasOwnProperty.call(base, 'categoryApps');
  const existingApps = existing && Array.isArray(existing.apps) ? sanitizeApps(existing.apps) : [];
  const apps = hasAppsField
    ? sanitizeApps(Object.prototype.hasOwnProperty.call(base, 'apps') ? base.apps : base.categoryApps)
    : existingApps;
  const figureSlugs = Array.isArray(base.figureSlugs) ? base.figureSlugs : existing && Array.isArray(existing.figureSlugs) ? existing.figureSlugs : [];
  const normalizedFigures = [];
  const seen = new Set();
  for (const slug of figureSlugs) {
    const normalizedSlug = normalizeFigureSlug(slug);
    if (!normalizedSlug || seen.has(normalizedSlug)) continue;
    seen.add(normalizedSlug);
    normalizedFigures.push(normalizedSlug);
  }
  normalizedFigures.sort();
  const entry = {
    id: resolvedId,
    label,
    figureSlugs: normalizedFigures,
    apps,
    createdAt: existing && existing.createdAt ? existing.createdAt : now,
    updatedAt: now
  };
  if (description !== undefined) {
    entry.description = description;
  } else if (existing && existing.description) {
    entry.description = existing.description;
  }
  return entry;
}

async function loadKvClient() {
  if (!isKvConfigured()) {
    throw new KvConfigurationError(
      'Figure library storage KV is not configured. Set REDIS_ENDPOINT (or REDIS_HOST), REDIS_PORT and REDIS_PASSWORD to enable persistent storage.'
    );
  }
  return loadRedisKvClient();
}

function getStoreMode() {
  return getFigureAssetStoreMode();
}

function writeFigureToMemory(slug, entry) {
  if (!slug) return;
  figureMemoryStore.set(makeFigureKey(slug), clone(entry));
  figureMemoryIndex.add(slug);
}

function deleteFigureFromMemory(slug) {
  if (!slug) return;
  figureMemoryStore.delete(makeFigureKey(slug));
  figureMemoryIndex.delete(slug);
}

function readFigureFromMemory(slug) {
  if (!slug) return null;
  const value = figureMemoryStore.get(makeFigureKey(slug));
  return value ? clone(value) : null;
}

function writeCategoryToMemory(id, entry) {
  if (!id) return;
  categoryMemoryStore.set(makeCategoryKey(id), clone(entry));
  categoryMemoryIndex.add(id);
}

function deleteCategoryFromMemory(id) {
  if (!id) return;
  categoryMemoryStore.delete(makeCategoryKey(id));
  categoryMemoryIndex.delete(id);
}

function readCategoryFromMemory(id) {
  if (!id) return null;
  const value = categoryMemoryStore.get(makeCategoryKey(id));
  return value ? clone(value) : null;
}

async function writeFigureToKv(slug, entry, options = {}) {
  const kv = await loadKvClient();
  const key = makeFigureKey(slug);
  try {
    await kv.set(key, entry);
    if (options.ensureIndex !== false) {
      await kv.sadd(FIGURE_INDEX_KEY, slug);
    }
  } catch (error) {
    throw new KvOperationError(`Failed to write figure entry for slug ${slug}`, { cause: error });
  }
}

async function readFigureFromKv(slug) {
  const kv = await loadKvClient();
  const key = makeFigureKey(slug);
  try {
    const stored = await kv.get(key);
    return stored ? clone(stored) : null;
  } catch (error) {
    throw new KvOperationError(`Failed to read figure entry for slug ${slug}`, { cause: error });
  }
}

async function deleteFigureFromKv(slug) {
  const kv = await loadKvClient();
  const key = makeFigureKey(slug);
  try {
    await kv.del(key);
    await kv.srem(FIGURE_INDEX_KEY, slug);
  } catch (error) {
    throw new KvOperationError(`Failed to delete figure entry for slug ${slug}`, { cause: error });
  }
}

async function writeCategoryToKv(id, entry, options = {}) {
  const kv = await loadKvClient();
  const key = makeCategoryKey(id);
  try {
    await kv.set(key, entry);
    if (options.ensureIndex !== false) {
      await kv.sadd(CATEGORY_INDEX_KEY, id);
    }
  } catch (error) {
    throw new KvOperationError(`Failed to write figure category ${id}`, { cause: error });
  }
}

async function readCategoryFromKv(id) {
  const kv = await loadKvClient();
  const key = makeCategoryKey(id);
  try {
    const stored = await kv.get(key);
    return stored ? clone(stored) : null;
  } catch (error) {
    throw new KvOperationError(`Failed to read figure category ${id}`, { cause: error });
  }
}

async function deleteCategoryFromKv(id) {
  const kv = await loadKvClient();
  const key = makeCategoryKey(id);
  try {
    await kv.del(key);
    await kv.srem(CATEGORY_INDEX_KEY, id);
  } catch (error) {
    throw new KvOperationError(`Failed to delete figure category ${id}`, { cause: error });
  }
}

async function ensureCategory(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const resolvedId = normalizeCategoryId(payload.id) || normalizeCategoryId(payload.categoryId) || deriveCategoryId(payload.label || payload.name || payload.title);
  if (!resolvedId) {
    return null;
  }
  const existing = readCategoryFromMemory(resolvedId) || (getStoreMode() === 'kv' ? await readCategoryFromKv(resolvedId).catch(() => null) : null);
  const entry = ensureCategoryEntryShape(resolvedId, payload, existing);
  const storeMode = getStoreMode();
  const annotated = applyStorageMetadata({ ...entry }, storeMode);
  if (storeMode === 'kv') {
    await writeCategoryToKv(resolvedId, annotated);
  }
  writeCategoryToMemory(resolvedId, annotated);
  return clone(annotated);
}

async function getCategory(id) {
  const normalized = normalizeCategoryId(id);
  if (!normalized) return null;
  let entry = readCategoryFromMemory(normalized);
  if (!entry && getStoreMode() === 'kv') {
    const stored = await readCategoryFromKv(normalized);
    if (stored) {
      const shaped = ensureCategoryEntryShape(normalized, stored, stored);
      applyStorageMetadata(shaped, 'kv');
      writeCategoryToMemory(normalized, shaped);
      entry = shaped;
    }
  }
  if (!entry) return null;
  const result = clone(entry);
  if (!result || typeof result !== 'object') {
    return result;
  }
  result.apps = sanitizeApps(result.apps);
  return result;
}

async function listCategories() {
  const categories = [];
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    const kv = await loadKvClient();
    let ids = [];
    try {
      const raw = await kv.smembers(CATEGORY_INDEX_KEY);
      if (Array.isArray(raw)) ids = raw;
    } catch (error) {
      throw new KvOperationError('Failed to read figure category index from KV', { cause: error });
    }
    for (const id of ids) {
      const normalized = normalizeCategoryId(id);
      if (!normalized) continue;
      const stored = await readCategoryFromKv(normalized);
      if (!stored) continue;
      const shaped = ensureCategoryEntryShape(normalized, stored, stored);
      applyStorageMetadata(shaped, 'kv');
      writeCategoryToMemory(normalized, shaped);
      const result = clone(shaped);
      result.apps = sanitizeApps(result.apps);
      categories.push(result);
    }
    return categories;
  }
  categoryMemoryIndex.forEach(id => {
    const normalized = normalizeCategoryId(id);
    if (!normalized) return;
    const stored = readCategoryFromMemory(normalized);
    if (!stored) return;
    const shaped = ensureCategoryEntryShape(normalized, stored, stored);
    applyStorageMetadata(shaped, storeMode);
    const result = clone(shaped);
    result.apps = sanitizeApps(result.apps);
    categories.push(result);
  });
  return categories;
}

async function synchronizeFigureCategory(categoryId, updater) {
  if (!categoryId || typeof updater !== 'function') {
    return;
  }
  const storeMode = getStoreMode();
  const slugsToUpdate = new Set();
  figureMemoryIndex.forEach(slug => {
    const normalizedSlug = normalizeFigureSlug(slug);
    if (!normalizedSlug) return;
    const entry = readFigureFromMemory(normalizedSlug);
    if (!entry || entry.categoryId !== categoryId) return;
    const updated = updater(clone(entry));
    if (updated) {
      writeFigureToMemory(normalizedSlug, updated);
      slugsToUpdate.add(normalizedSlug);
    }
  });
  if (storeMode === 'kv') {
    const kv = await loadKvClient();
    let slugs = [];
    try {
      const raw = await kv.smembers(FIGURE_INDEX_KEY);
      if (Array.isArray(raw)) slugs = raw;
    } catch (error) {
      throw new KvOperationError('Failed to read figure index from KV', { cause: error });
    }
    for (const slug of slugs) {
      const normalizedSlug = normalizeFigureSlug(slug);
      if (!normalizedSlug) continue;
      const stored = await readFigureFromKv(normalizedSlug);
      if (!stored || stored.categoryId !== categoryId) continue;
      const updated = updater(clone(stored));
      if (!updated) continue;
      applyStorageMetadata(updated, 'kv');
      await writeFigureToKv(normalizedSlug, updated, { ensureIndex: false });
      writeFigureToMemory(normalizedSlug, updated);
      slugsToUpdate.add(normalizedSlug);
    }
  }
  return slugsToUpdate;
}

async function deleteCategory(id, options = {}) {
  const normalized = normalizeCategoryId(id);
  if (!normalized) return false;
  const existing = readCategoryFromMemory(normalized) || (getStoreMode() === 'kv' ? await readCategoryFromKv(normalized).catch(() => null) : null);
  if (!existing) {
    return false;
  }
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await deleteCategoryFromKv(normalized);
  }
  deleteCategoryFromMemory(normalized);
  await synchronizeFigureCategory(normalized, entry => {
    entry.categoryId = null;
    if (entry.category) {
      delete entry.category;
    }
    return entry;
  });
  if (options.deleteFigures) {
    const figureSlugs = Array.isArray(existing.figureSlugs) ? existing.figureSlugs : [];
    for (const slug of figureSlugs) {
      await deleteFigure(slug);
    }
  }
  return true;
}

async function linkFigureToCategory(categoryId, slug) {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  const normalizedSlug = normalizeFigureSlug(slug);
  if (!normalizedCategoryId || !normalizedSlug) return null;
  const existing = await getCategory(normalizedCategoryId);
  const base = existing || { id: normalizedCategoryId, label: normalizedCategoryId, figureSlugs: [] };
  const figureSlugs = new Set(Array.isArray(base.figureSlugs) ? base.figureSlugs.map(normalizeFigureSlug).filter(Boolean) : []);
  figureSlugs.add(normalizedSlug);
  const entry = ensureCategoryEntryShape(normalizedCategoryId, { ...base, figureSlugs: Array.from(figureSlugs) }, base);
  const storeMode = getStoreMode();
  applyStorageMetadata(entry, storeMode);
  if (storeMode === 'kv') {
    await writeCategoryToKv(normalizedCategoryId, entry);
  }
  writeCategoryToMemory(normalizedCategoryId, entry);
  return entry;
}

async function unlinkFigureFromCategory(categoryId, slug) {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  const normalizedSlug = normalizeFigureSlug(slug);
  if (!normalizedCategoryId || !normalizedSlug) return null;
  const existing = await getCategory(normalizedCategoryId);
  if (!existing) return null;
  const figureSlugs = new Set(Array.isArray(existing.figureSlugs) ? existing.figureSlugs.map(normalizeFigureSlug).filter(Boolean) : []);
  if (!figureSlugs.has(normalizedSlug)) {
    return existing;
  }
  figureSlugs.delete(normalizedSlug);
  const entry = ensureCategoryEntryShape(normalizedCategoryId, { ...existing, figureSlugs: Array.from(figureSlugs) }, existing);
  const storeMode = getStoreMode();
  applyStorageMetadata(entry, storeMode);
  if (storeMode === 'kv') {
    await writeCategoryToKv(normalizedCategoryId, entry);
  }
  writeCategoryToMemory(normalizedCategoryId, entry);
  return entry;
}

function projectSummaryFigureEntry(entry) {
  if (!entry || typeof entry !== 'object') return entry;
  const projected = { ...entry };
  delete projected.svg;
  delete projected.png;

  if (projected.files && typeof projected.files === 'object') {
    const projectedFiles = {};
    if (projected.files.svg && typeof projected.files.svg === 'object') {
      const svgFile = { ...projected.files.svg };
      projectedFiles.svg = {};
      if (svgFile.url != null) projectedFiles.svg.url = svgFile.url;
      if (svgFile.slug != null) projectedFiles.svg.slug = svgFile.slug;
      if (svgFile.filename != null) projectedFiles.svg.filename = svgFile.filename;
      if (svgFile.contentType != null) projectedFiles.svg.contentType = svgFile.contentType;
    }
    if (projected.files.png && typeof projected.files.png === 'object') {
      const pngFile = { ...projected.files.png };
      const pngProjection = {};
      if (pngFile.url != null) pngProjection.url = pngFile.url;
      if (pngFile.width != null) pngProjection.width = pngFile.width;
      if (pngFile.height != null) pngProjection.height = pngFile.height;
      if (pngFile.slug != null) pngProjection.slug = pngFile.slug;
      if (pngFile.filename != null) pngProjection.filename = pngFile.filename;
      if (pngFile.contentType != null) pngProjection.contentType = pngFile.contentType;
      if (Object.keys(pngProjection).length > 0) {
        projectedFiles.png = pngProjection;
      }
    }
    projected.files = Object.keys(projectedFiles).length ? projectedFiles : undefined;
    if (!projected.files) {
      delete projected.files;
    }
  }

  return projected;
}

async function finalizeFigureEntry(entry, options = {}) {
  if (!entry) return null;
  const result = ensureFigureEntryShape(entry.slug, entry);
  result.tags = sanitizeTags(result.tags);
  if (result.categoryId) {
    const category = await getCategory(result.categoryId);
    if (category) {
      result.category = {
        id: category.id,
        label: category.label,
        description: category.description,
        apps: sanitizeApps(category.apps)
      };
    } else if (result.category) {
      result.category = {
        id: normalizeCategoryId(result.category.id) || result.categoryId,
        label: sanitizeCategoryLabel(result.category.label),
        apps: sanitizeApps(result.category.apps)
      };
    } else {
      result.category = {
        id: result.categoryId,
        label: '',
        apps: []
      };
    }
  } else if (result.category) {
    if (result.category && typeof result.category === 'object') {
      const normalizedId = normalizeCategoryId(result.category.id);
      if (normalizedId) {
        const category = await getCategory(normalizedId);
        if (category) {
          result.categoryId = category.id;
          result.category = {
            id: category.id,
            label: category.label,
            description: category.description,
            apps: sanitizeApps(category.apps)
          };
        }
      }
    }
  }
  if (!Array.isArray(result.tags)) {
    result.tags = [];
  }
  if (result.category && typeof result.category === 'object') {
    result.category.apps = sanitizeApps(result.category.apps);
  }
  if (options && options.summary) {
    return projectSummaryFigureEntry(result);
  }
  return result;
}

async function loadRawFigure(slug) {
  const normalized = normalizeFigureSlug(slug);
  if (!normalized) return null;
  let entry = readFigureFromMemory(normalized);
  if (!entry && getStoreMode() === 'kv') {
    const stored = await readFigureFromKv(normalized);
    if (stored) {
      const shaped = ensureFigureEntryShape(normalized, stored);
      applyStorageMetadata(shaped, 'kv');
      writeFigureToMemory(normalized, shaped);
      entry = shaped;
    }
  }
  return entry ? clone(entry) : null;
}

async function getFigure(slug) {
  const normalized = normalizeFigureSlug(slug);
  if (!normalized) return null;
  const raw = await loadRawFigure(normalized);
  if (!raw) return null;
  const finalized = await finalizeFigureEntry(raw);
  return finalized ? clone(finalized) : null;
}

async function setFigure(slug, payload = {}) {
  const normalized = normalizeFigureSlug(slug || (payload && payload.slug));
  if (!normalized) return null;

  const existing = await loadRawFigure(normalized);

  const categoryResolution = resolveCategoryRequest(payload, existing);
  let resolvedCategory = null;
  let nextCategoryId = existing ? existing.categoryId : null;

  if (categoryResolution.clear) {
    nextCategoryId = null;
  } else if (categoryResolution.data) {
    const ensured = await ensureCategory(categoryResolution.data);
    if (ensured) {
      resolvedCategory = ensured;
      nextCategoryId = ensured.id;
    } else if (categoryResolution.data.id) {
      nextCategoryId = normalizeCategoryId(categoryResolution.data.id);
    }
  }

  const tagsProvided = payload && Object.prototype.hasOwnProperty.call(payload, 'tags');
  const resolvedTags = tagsProvided ? sanitizeTags(payload.tags) : sanitizeTags(existing && existing.tags);

  const assetPayload = { ...payload, slug: normalized };
  if (!assetPayload.tool && existing && existing.tool) {
    assetPayload.tool = existing.tool;
  }
  if (!assetPayload.title && existing && existing.title) {
    assetPayload.title = existing.title;
  }
  const assetEntry = await setFigureAsset(normalized, assetPayload);
  if (!assetEntry) {
    return null;
  }

  const figureEntry = {
    ...assetEntry,
    slug: normalized,
    categoryId: nextCategoryId || null,
    tags: resolvedTags
  };
  applyFigureAssetUrls(figureEntry);
  applyStorageMetadata(figureEntry, assetEntry.mode || getStoreMode());

  const previousCategoryId = existing ? existing.categoryId : null;
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await writeFigureToKv(normalized, figureEntry);
  }
  writeFigureToMemory(normalized, figureEntry);

  if (previousCategoryId && previousCategoryId !== nextCategoryId) {
    await unlinkFigureFromCategory(previousCategoryId, normalized);
  }
  if (nextCategoryId) {
    await linkFigureToCategory(nextCategoryId, normalized);
  }

  const finalized = await finalizeFigureEntry(figureEntry);
  return finalized ? clone(finalized) : null;
}

async function listFigures(options = {}) {
  const entries = [];
  const storeMode = getStoreMode();
  const finalizeOptions = options && typeof options === 'object' ? options : {};
  if (storeMode === 'kv') {
    const kv = await loadKvClient();
    let slugs = [];
    try {
      const raw = await kv.smembers(FIGURE_INDEX_KEY);
      if (Array.isArray(raw)) slugs = raw;
    } catch (error) {
      throw new KvOperationError('Failed to read figure index from KV', { cause: error });
    }
    for (const slug of slugs) {
      const normalized = normalizeFigureSlug(slug);
      if (!normalized) continue;
      const stored = await readFigureFromKv(normalized);
      if (!stored) continue;
      const shaped = ensureFigureEntryShape(normalized, stored);
      applyStorageMetadata(shaped, 'kv');
      writeFigureToMemory(normalized, shaped);
      const finalized = await finalizeFigureEntry(shaped, finalizeOptions);
      if (finalized) {
        entries.push(clone(finalized));
      }
    }
    return entries;
  }
  for (const slug of figureMemoryIndex) {
    const normalized = normalizeFigureSlug(slug);
    if (!normalized) continue;
    const stored = readFigureFromMemory(normalized);
    if (!stored) continue;
    const shaped = ensureFigureEntryShape(normalized, stored);
    applyStorageMetadata(shaped, storeMode);
    const finalized = await finalizeFigureEntry(shaped, finalizeOptions);
    if (finalized) {
      entries.push(clone(finalized));
    }
  }
  return entries;
}

async function deleteFigure(slug) {
  const normalized = normalizeFigureSlug(slug);
  if (!normalized) return null;
  const existing = await getFigure(normalized);
  if (!existing) {
    return null;
  }
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await deleteFigureFromKv(normalized);
  }
  deleteFigureFromMemory(normalized);
  if (existing.categoryId) {
    await unlinkFigureFromCategory(existing.categoryId, normalized);
  }
  await deleteFigureAsset(normalized);
  return existing;
}

async function refreshCategory(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const ensured = await ensureCategory(payload);
  if (!ensured) return null;
  await synchronizeFigureCategory(ensured.id, entry => {
    entry.categoryId = ensured.id;
    return entry;
  });
  return ensured;
}

async function getFigureAssets(slug) {
  return getFigureAsset(slug);
}

module.exports = {
  FIGURE_LIBRARY_UPLOAD_TOOL_ID,
  normalizeFigureSlug,
  getFigure,
  listFigures,
  setFigure,
  deleteFigure,
  ensureCategory,
  getCategory,
  listCategories,
  deleteCategory,
  refreshCategory,
  linkFigureToCategory,
  unlinkFigureFromCategory,
  getFigureAssets,
  getStoreMode,
  KvOperationError,
  KvConfigurationError
};
