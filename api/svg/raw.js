'use strict';

const { URL } = require('url');
const {
  normalizeSlug,
  getSvg,
  getStoreMode
} = require('../_lib/svg-store');

const CONTENT_TYPE = 'image/svg+xml; charset=utf-8';
const SHORT_CACHE_HEADER = 'public, max-age=5, s-maxage=5, stale-while-revalidate=30';
const LONG_CACHE_HEADER = 'public, max-age=60, s-maxage=86400, stale-while-revalidate=43200';

const PNG_DATA_URL_PATTERN = /^data:image\/png;base64,/i;

function buildOrigin(req) {
  const protocol = req && req.headers ? req.headers['x-forwarded-proto'] || 'http' : 'http';
  const host = req && req.headers ? req.headers.host || 'localhost' : 'localhost';
  return `${protocol}://${host}`;
}

function stripAssetExtension(slug) {
  if (typeof slug !== 'string') return slug;
  return slug.replace(/\.(?:svg|png)$/gi, '');
}

function normalizeAssetFormat(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'png' || normalized === '.png') return 'png';
  if (normalized === 'svg' || normalized === '.svg') return 'svg';
  return null;
}

function resolveAssetDescriptor(rawSlug, queryFormat) {
  const normalized = normalizeSlug(rawSlug);
  if (!normalized) return null;
  const match = normalized.match(/^(.*?)(?:\.(svg|png))?$/i);
  const base = match && match[1] ? match[1] : normalized;
  const inferredFormat = match && match[2] ? normalizeAssetFormat(match[2]) : null;
  const normalizedFormat = normalizeAssetFormat(queryFormat);
  const format = inferredFormat || normalizedFormat || 'svg';
  const baseSlug = stripAssetExtension(base);
  if (!baseSlug) return null;
  return { baseSlug, format };
}

function applyModeHeaders(res, entryMode) {
  if (!res || typeof res.setHeader !== 'function') {
    return;
  }
  const mode = (entryMode || '').toString().trim().toLowerCase();
  const normalized = mode === 'kv' ? 'kv' : mode === 'memory' ? 'memory' : getStoreMode();
  if (normalized) {
    res.setHeader('X-Svg-Store-Mode', normalized);
  }
}

function applyCacheHeader(res, entry) {
  if (!res || typeof res.setHeader !== 'function') {
    return;
  }
  const persistent = Boolean(entry && (entry.persistent || entry.storage === 'kv' || entry.mode === 'kv'));
  const headerValue = persistent ? LONG_CACHE_HEADER : SHORT_CACHE_HEADER;
  res.setHeader('Cache-Control', headerValue);
}

function sendNotFound(res) {
  if (res.headersSent) return;
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', SHORT_CACHE_HEADER);
  res.end('Not Found');
}

function resolveRequestedAsset(req, url) {
  if (!url) {
    return null;
  }
  const queryFormat = url.searchParams.get('format') || (req && req.query && req.query.format);
  const candidates = [url.searchParams.get('path'), url.searchParams.get('slug'), url.searchParams.get('s')];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const descriptor = resolveAssetDescriptor(candidate, queryFormat);
    if (descriptor) return descriptor;
  }
  if (req && typeof req.query === 'object' && req.query) {
    if (typeof req.query.path === 'string') {
      const descriptor = resolveAssetDescriptor(req.query.path, queryFormat);
      if (descriptor) return descriptor;
    }
    if (typeof req.query.slug === 'string') {
      const descriptor = resolveAssetDescriptor(req.query.slug, queryFormat);
      if (descriptor) return descriptor;
    }
    if (typeof req.query.s === 'string') {
      const descriptor = resolveAssetDescriptor(req.query.s, queryFormat);
      if (descriptor) return descriptor;
    }
  }
  return null;
}

function decodePngDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !PNG_DATA_URL_PATTERN.test(dataUrl)) {
    return null;
  }
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return null;
  const base64 = dataUrl.slice(commaIndex + 1);
  try {
    return Buffer.from(base64, 'base64');
  } catch (error) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  let url;
  try {
    url = new URL(req.url, buildOrigin(req));
  } catch (error) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid request URL' }));
    return;
  }

  const asset = resolveRequestedAsset(req, url);
  if (!asset || !asset.baseSlug) {
    sendNotFound(res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    const entry = await getSvg(asset.baseSlug);
    if (!entry) {
      sendNotFound(res);
      return;
    }

    applyModeHeaders(res, entry.mode || entry.storageMode || entry.storage);
    applyCacheHeader(res, entry);

    const effectiveSlug = entry.slug || asset.baseSlug;
    res.setHeader('X-Svg-Slug', effectiveSlug);
    res.setHeader('X-Svg-Asset-Format', asset.format);

    if (asset.format === 'png') {
      const pngData = typeof entry.png === 'string' ? entry.png : null;
      const buffer = decodePngDataUrl(pngData);
      if (!buffer) {
        sendNotFound(res);
        return;
      }
      res.setHeader('Content-Type', 'image/png');
      if (buffer.length) {
        res.setHeader('Content-Length', buffer.length);
      }
      res.statusCode = 200;
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(buffer);
      return;
    }

    if (typeof entry.svg !== 'string' || entry.svg.length === 0) {
      sendNotFound(res);
      return;
    }

    res.setHeader('Content-Type', CONTENT_TYPE);
    res.statusCode = 200;
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(entry.svg);
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Failed to load SVG', message: error && error.message ? error.message : 'Unknown error' }));
  }
};
