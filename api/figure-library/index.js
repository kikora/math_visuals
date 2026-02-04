'use strict';

const { URL } = require('url');
const {
  normalizeFigureSlug,
  getFigure,
  listFigures,
  setFigure,
  deleteFigure,
  ensureCategory,
  listCategories,
  getCategory,
  deleteCategory,
  getStoreMode,
  KvOperationError,
  KvConfigurationError
} = require('../_lib/figure-library-store');

const MEMORY_LIMITATION_NOTE = 'Denne instansen bruker midlertidig minnelagring. Figurer tilbakestilles når serveren starter på nytt.';

function normalizeStoreMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
  return null;
}

function buildModeMetadata(modeHint) {
  const resolved = normalizeStoreMode(modeHint) || normalizeStoreMode(getStoreMode()) || 'memory';
  const storage = resolved === 'kv' ? 'kv' : 'memory';
  return {
    storage,
    mode: storage,
    storageMode: storage,
    persistent: storage === 'kv',
    ephemeral: storage !== 'kv',
    limitation: storage === 'memory' ? MEMORY_LIMITATION_NOTE : undefined
  };
}

function applyStoreModeHeader(res, mode) {
  if (!res || typeof res.setHeader !== 'function') return null;
  const metadata = buildModeMetadata(mode);
  res.setHeader('X-Figure-Library-Store-Mode', metadata.mode);
  return metadata;
}

function applyStorageResultHeader(res, mode) {
  if (!res || typeof res.setHeader !== 'function') return;
  if (!mode) return;
  res.setHeader('X-Figure-Library-Storage-Result', mode);
}

function applyModeHeaders(res, mode) {
  const metadata = applyStoreModeHeader(res, mode);
  if (metadata && metadata.mode) {
    applyStorageResultHeader(res, metadata.mode);
  }
  return metadata;
}

function parseAllowedOrigins() {
  const envValue =
    process.env.FIGURE_LIBRARY_ALLOWED_ORIGINS ||
    process.env.SVG_ALLOWED_ORIGINS ||
    process.env.ALLOWED_ORIGINS ||
    process.env.EXAMPLES_ALLOWED_ORIGINS;
  if (!envValue) return ['*'];
  return envValue
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();

function resolveCorsOrigin(req) {
  if (allowedOrigins.includes('*')) return '*';
  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }
  return allowedOrigins[0] || '*';
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(Object.assign(new Error('Invalid JSON body'), { cause: error }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function buildOrigin(req) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers.host || 'localhost';
  return `${protocol}://${host}`;
}

function ensureCategoryApps(category) {
  if (!category || typeof category !== 'object') {
    return category;
  }
  const apps = Array.isArray(category.apps) ? category.apps.filter(app => typeof app === 'string') : [];
  return { ...category, apps };
}

function withCategoryApps(entry) {
  if (!entry || typeof entry !== 'object') {
    return entry;
  }
  const normalized = { ...entry };
  if (normalized.category) {
    normalized.category = ensureCategoryApps(normalized.category);
  }
  return normalized;
}

function extractSlugFromBody(body, fallback) {
  if (body && typeof body.slug === 'string') {
    const normalized = normalizeFigureSlug(body.slug);
    if (normalized) return normalized;
  }
  return fallback || null;
}

function extractCategoryIdFromBody(body) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  if (typeof body.categoryId === 'string' && body.categoryId.trim()) {
    return body.categoryId.trim();
  }
  const categoryObject = body.category && typeof body.category === 'object' ? body.category : null;
  if (categoryObject && typeof categoryObject.id === 'string' && categoryObject.id.trim()) {
    return categoryObject.id.trim();
  }
  return null;
}

function getCategoryObject(body) {
  if (!body || typeof body !== 'object') {
    return null;
  }
  return body.category && typeof body.category === 'object' ? body.category : null;
}

function isCategoryUpdateRequest(slugFromBody, body) {
  if (slugFromBody) {
    return false;
  }
  if (!body || typeof body !== 'object') {
    return false;
  }
  if (extractCategoryIdFromBody(body)) {
    return true;
  }
  const categoryObject = getCategoryObject(body);
  if (categoryObject) {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'categoryApps')) {
    return true;
  }
  if (typeof body.categoryLabel === 'string' && body.categoryLabel.trim()) {
    return true;
  }
  if (typeof body.categoryName === 'string' && body.categoryName.trim()) {
    return true;
  }
  return false;
}

function buildCategoryPayload(body) {
  const categoryPayload = {};
  const bodyCategoryId = extractCategoryIdFromBody(body);
  const categoryObject = getCategoryObject(body);

  if (bodyCategoryId) {
    categoryPayload.id = bodyCategoryId;
  }
  if (categoryObject && Object.prototype.hasOwnProperty.call(categoryObject, 'id') && categoryObject.id) {
    categoryPayload.id = categoryPayload.id || categoryObject.id;
  }
  if (categoryObject && typeof categoryObject.label === 'string') {
    categoryPayload.label = categoryObject.label;
  }
  if (typeof body.categoryLabel === 'string') {
    categoryPayload.label = categoryPayload.label || body.categoryLabel;
  }
  if (typeof body.categoryName === 'string') {
    categoryPayload.label = categoryPayload.label || body.categoryName;
  }
  if (categoryObject && Object.prototype.hasOwnProperty.call(categoryObject, 'apps')) {
    categoryPayload.apps = categoryObject.apps;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'categoryApps')) {
    categoryPayload.apps = body.categoryApps;
  }
  if (categoryObject && Object.prototype.hasOwnProperty.call(categoryObject, 'description')) {
    categoryPayload.description = categoryObject.description;
  }

  return categoryPayload;
}

async function handleCategoryUpdate(body, res, currentMode) {
  const categoryPayload = buildCategoryPayload(body);

  if (!categoryPayload.id && !categoryPayload.label) {
    const metadata = applyModeHeaders(res, currentMode) || buildModeMetadata(currentMode);
    sendJson(res, 400, { error: 'categoryId or category label is required', ...metadata });
    return true;
  }

  const ensured = await ensureCategory(categoryPayload);
  if (!ensured) {
    const metadata = applyModeHeaders(res, currentMode) || buildModeMetadata(currentMode);
    sendJson(res, 400, { error: 'Unable to update category', ...metadata });
    return true;
  }

  const categories = await buildCategoriesPayload();
  const metadata = applyModeHeaders(res, ensured.mode || currentMode) ||
    buildModeMetadata(ensured.mode || currentMode);
  sendJson(res, 200, { ...metadata, category: ensureCategoryApps(ensured), categories });
  return true;
}

function normalizePngPayload(body) {
  if (!body || typeof body !== 'object') {
    return { dataUrl: null, width: null, height: null };
  }
  const source = body.png;
  let dataUrl = null;
  let width = null;
  let height = null;

  if (typeof source === 'string') {
    dataUrl = source.trim();
  } else if (source && typeof source === 'object') {
    if (typeof source.dataUrl === 'string') {
      dataUrl = source.dataUrl.trim();
    }
    if (source.width != null) {
      const parsedWidth = Number(source.width);
      if (Number.isFinite(parsedWidth)) {
        width = parsedWidth;
      }
    }
    if (source.height != null) {
      const parsedHeight = Number(source.height);
      if (Number.isFinite(parsedHeight)) {
        height = parsedHeight;
      }
    }
  }

  if (body.pngWidth != null) {
    const parsed = Number(body.pngWidth);
    if (Number.isFinite(parsed)) {
      width = parsed;
    }
  }
  if (body.pngHeight != null) {
    const parsed = Number(body.pngHeight);
    if (Number.isFinite(parsed)) {
      height = parsed;
    }
  }

  return { dataUrl, width, height };
}

async function buildCategoriesPayload() {
  try {
    const categories = await listCategories();
    if (!Array.isArray(categories)) {
      return [];
    }
    return categories.map(category => ensureCategoryApps(category));
  } catch (error) {
    return [];
  }
}

module.exports = async function handler(req, res) {
  const corsOrigin = resolveCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  if (corsOrigin !== '*') {
    res.setHeader('Vary', 'Origin');
  }

  let currentMode = getStoreMode();
  const initialMetadata = applyStoreModeHeader(res, currentMode);
  if (initialMetadata && initialMetadata.mode) {
    currentMode = initialMetadata.mode;
  }

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let url;
  try {
    url = new URL(req.url, buildOrigin(req));
  } catch (error) {
    sendJson(res, 400, { error: 'Invalid request URL' });
    return;
  }

  const querySlug = normalizeFigureSlug(url.searchParams.get('slug'));
  const viewParam = url.searchParams.get('view');
  const normalizedView = typeof viewParam === 'string' ? viewParam.trim().toLowerCase() : '';
  const summaryView = !querySlug && normalizedView === 'summary';

  try {
    if (req.method === 'GET') {
      if (querySlug) {
        const entry = await getFigure(querySlug);
        if (!entry) {
          const metadata = applyModeHeaders(res, currentMode);
          sendJson(res, 404, { error: 'Not Found', ...metadata });
          return;
        }
        const categories = await buildCategoriesPayload();
        const metadata = applyModeHeaders(res, entry.mode || currentMode) || buildModeMetadata(entry.mode || currentMode);
        sendJson(res, 200, { ...metadata, entry: withCategoryApps(entry), categories });
        return;
      }
      const [entries, categories] = await Promise.all([
        listFigures(summaryView ? { summary: true } : undefined),
        buildCategoriesPayload()
      ]);
      const normalizedEntries = Array.isArray(entries) ? entries.map(withCategoryApps) : [];
      const effectiveMode = normalizedEntries && normalizedEntries.length ? normalizedEntries[0].mode : currentMode;
      const metadata = applyModeHeaders(res, effectiveMode) || buildModeMetadata(effectiveMode);
      sendJson(res, 200, { ...metadata, entries: normalizedEntries, categories });
      return;
    }

    if (req.method === 'POST') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Invalid request body' });
        return;
      }
      const slugFromBody = extractSlugFromBody(body, querySlug);
      if (isCategoryUpdateRequest(slugFromBody, body)) {
        await handleCategoryUpdate(body, res, currentMode);
        return;
      }

      if (!slugFromBody) {
        sendJson(res, 400, { error: 'Slug is required' });
        return;
      }
      if (typeof body.svg !== 'string' || !body.svg.trim()) {
        sendJson(res, 400, { error: 'SVG markup is required' });
        return;
      }
      const pngPayload = normalizePngPayload(body);
      const pngDataUrl = pngPayload.dataUrl;
      const hasPngField = body && Object.prototype.hasOwnProperty.call(body, 'png');
      const hasPngWidthField = body && Object.prototype.hasOwnProperty.call(body, 'pngWidth');
      const hasPngHeightField = body && Object.prototype.hasOwnProperty.call(body, 'pngHeight');
      if (pngDataUrl) {
        if (!/^data:image\/png;base64,/i.test(pngDataUrl)) {
          sendJson(res, 400, { error: 'PNG data must be a base64-encoded data URL' });
          return;
        }
        body.png = pngDataUrl;
        if (Number.isFinite(pngPayload.width)) {
          body.pngWidth = Number(pngPayload.width);
        } else if (hasPngWidthField) {
          delete body.pngWidth;
        }
        if (Number.isFinite(pngPayload.height)) {
          body.pngHeight = Number(pngPayload.height);
        } else if (hasPngHeightField) {
          delete body.pngHeight;
        }
      } else {
        if (hasPngField) {
          body.png = null;
        } else {
          delete body.png;
        }
        if (hasPngWidthField) delete body.pngWidth;
        if (hasPngHeightField) delete body.pngHeight;
      }
      const stored = await setFigure(slugFromBody, body);
      if (!stored) {
        sendJson(res, 400, { error: 'Unable to store figure entry' });
        return;
      }
      const categories = await buildCategoriesPayload();
      const metadata = applyModeHeaders(res, stored.mode || currentMode) || buildModeMetadata(stored.mode || currentMode);
      sendJson(res, 200, { ...metadata, entry: withCategoryApps(stored), categories });
      return;
    }

    if (req.method === 'PATCH') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch (error) {
        sendJson(res, 400, { error: error.message || 'Invalid request body' });
        return;
      }
      const slugFromBody = extractSlugFromBody(body, querySlug);
      if (isCategoryUpdateRequest(slugFromBody, body)) {
        await handleCategoryUpdate(body, res, currentMode);
        return;
      }
      if (!slugFromBody) {
        sendJson(res, 400, { error: 'Slug is required' });
        return;
      }
      const pngPayload = normalizePngPayload(body);
      const hasPngField = body && Object.prototype.hasOwnProperty.call(body, 'png');
      const hasPngWidthField = body && Object.prototype.hasOwnProperty.call(body, 'pngWidth');
      const hasPngHeightField = body && Object.prototype.hasOwnProperty.call(body, 'pngHeight');
      const pngDataUrl = pngPayload.dataUrl;
      if (hasPngField) {
        if (pngDataUrl) {
          if (!/^data:image\/png;base64,/i.test(pngDataUrl)) {
            sendJson(res, 400, { error: 'PNG data must be a base64-encoded data URL' });
            return;
          }
          body.png = pngDataUrl;
        } else {
          body.png = null;
        }
      } else {
        delete body.png;
      }
      if (hasPngWidthField) {
        if (Number.isFinite(pngPayload.width)) {
          body.pngWidth = Number(pngPayload.width);
        } else {
          body.pngWidth = null;
        }
      } else {
        delete body.pngWidth;
      }
      if (hasPngHeightField) {
        if (Number.isFinite(pngPayload.height)) {
          body.pngHeight = Number(pngPayload.height);
        } else {
          body.pngHeight = null;
        }
      } else {
        delete body.pngHeight;
      }
      const stored = await setFigure(slugFromBody, body);
      if (!stored) {
        const metadata = applyModeHeaders(res, currentMode);
        sendJson(res, 404, { error: 'Not Found', ...metadata });
        return;
      }
      const categories = await buildCategoriesPayload();
      const metadata = applyModeHeaders(res, stored.mode || currentMode) || buildModeMetadata(stored.mode || currentMode);
      sendJson(res, 200, { ...metadata, entry: withCategoryApps(stored), categories });
      return;
    }

    if (req.method === 'DELETE') {
      const queryCategoryId = url.searchParams.get('categoryId');
      const hasRequestBody = Boolean(
        req.headers['content-length'] && req.headers['content-length'] !== '0'
      );
      let body = null;
      if (!querySlug || hasRequestBody || (!queryCategoryId && req.headers['content-type'])) {
        try {
          body = await readJsonBody(req);
        } catch (error) {
          sendJson(res, 400, { error: error.message || 'Invalid request body' });
          return;
        }
      }
      const targetSlug = querySlug || extractSlugFromBody(body);
      const bodyCategoryId = extractCategoryIdFromBody(body);
      const targetCategoryId = queryCategoryId || bodyCategoryId;
      if (targetSlug) {
        const deleted = await deleteFigure(targetSlug);
        if (!deleted) {
          const metadata = applyModeHeaders(res, currentMode);
          sendJson(res, 404, { error: 'Not Found', ...metadata });
          return;
        }
        const categories = await buildCategoriesPayload();
        const metadata = applyModeHeaders(res, currentMode) || buildModeMetadata(currentMode);
        sendJson(res, 200, { ...metadata, deleted: { slug: targetSlug }, categories });
        return;
      }
      if (targetCategoryId) {
        const category = await getCategory(targetCategoryId);
        if (!category) {
          const metadata = applyModeHeaders(res, currentMode);
          sendJson(res, 404, { error: 'Not Found', ...metadata });
          return;
        }
        const figureSlugs = Array.isArray(category.figureSlugs) ? category.figureSlugs : [];
        const remainingFigures = figureSlugs.filter(slug => typeof slug === 'string' && slug.trim()).length;
        if (remainingFigures > 0) {
          const categories = await buildCategoriesPayload();
          const metadata = applyModeHeaders(res, category.mode || currentMode) ||
            buildModeMetadata(category.mode || currentMode);
          sendJson(res, 409, {
            ...metadata,
            error: 'Category contains figures',
            category: { id: category.id, figureCount: remainingFigures },
            categories
          });
          return;
        }
        const deleted = await deleteCategory(category.id);
        if (!deleted) {
          const metadata = applyModeHeaders(res, currentMode);
          sendJson(res, 404, { error: 'Not Found', ...metadata });
          return;
        }
        const categories = await buildCategoriesPayload();
        const metadata = applyModeHeaders(res, category.mode || currentMode) ||
          buildModeMetadata(category.mode || currentMode);
        sendJson(res, 200, {
          ...metadata,
          deleted: { categoryId: category.id },
          categories
        });
        return;
      }
      sendJson(res, 400, { error: 'Slug or categoryId is required' });
      return;
    }

    res.setHeader('Allow', 'GET,POST,PATCH,DELETE,OPTIONS');
    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (error) {
    if (error instanceof KvConfigurationError) {
      const metadata = applyModeHeaders(res, 'memory') || buildModeMetadata('memory');
      sendJson(res, 503, { error: 'KV storage not configured', ...metadata });
      return;
    }
    if (error instanceof KvOperationError) {
      const metadata = applyModeHeaders(res, currentMode) || buildModeMetadata(currentMode);
      sendJson(res, 502, { error: error.message || 'KV operation failed', ...metadata });
      return;
    }
    const metadata = applyModeHeaders(res, currentMode) || buildModeMetadata(currentMode);
    sendJson(res, 500, { error: 'Internal Server Error', ...metadata });
  }
};
