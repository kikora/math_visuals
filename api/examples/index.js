'use strict';

const { URL } = require('url');
const {
  normalizePath,
  getEntry,
  setEntry,
  deleteEntry,
  listEntries,
  KvOperationError,
  KvConfigurationError,
  getStoreMode,
  validateEntryPayload,
} = require('../_lib/examples-store');

const MEMORY_LIMITATION_NOTE = 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.';

function extractQueryParams(searchParams) {
  if (!searchParams) return {};
  const result = {};
  for (const key of searchParams.keys()) {
    const values = searchParams.getAll(key);
    result[key] = values.length > 1 ? values : values[0];
  }
  return result;
}

function logDebug(details) {
  try {
    console.log('[ExamplesDebug]', details);
  } catch (error) {
    console.log('[ExamplesDebug]', {
      message: 'Failed to log debug details',
      loggingError: error && error.message ? error.message : error,
    });
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

function augmentEntry(entry, fallbackMode) {
  if (!entry || typeof entry !== 'object') {
    return buildModeMetadata(fallbackMode);
  }
  const metadata = buildModeMetadata(entry.mode || entry.storage || fallbackMode);
  return { ...entry, ...metadata };
}

function augmentEntries(entries, fallbackMode) {
  if (!Array.isArray(entries)) return [];
  return entries.map(entry => augmentEntry(entry, fallbackMode));
}

function applyStoreModeHeader(res, mode) {
  if (!res || typeof res.setHeader !== 'function') return;
  const metadata = buildModeMetadata(mode);
  res.setHeader('X-Examples-Store-Mode', metadata.mode);
  return metadata;
}

function applyStorageResultHeader(res, mode) {
  if (!res || typeof res.setHeader !== 'function') return;
  if (!mode) return;
  res.setHeader('X-Examples-Storage-Result', mode);
}

function applyModeHeaders(res, mode) {
  const metadata = applyStoreModeHeader(res, mode);
  if (metadata && metadata.mode) {
    applyStorageResultHeader(res, metadata.mode);
  }
  return metadata;
}

function parseAllowedOrigins() {
  const envValue = process.env.EXAMPLES_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS;
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
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string' || Buffer.isBuffer(req.body)) {
        try {
          resolve(JSON.parse(req.body.toString()));
        } catch (error) {
          reject(Object.assign(new Error('Invalid JSON body'), { cause: error }));
        }
        return;
      }
      if (typeof req.body === 'object') {
        resolve(req.body);
        return;
      }
    }

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

function extractPathFromBody(body, fallback) {
  if (body && typeof body.path === 'string') {
    const normalized = normalizePath(body.path);
    if (normalized) return normalized;
  }
  return fallback || null;
}

module.exports = async function handler(req, res) {
  try {
    const corsOrigin = resolveCorsOrigin(req);
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    if (corsOrigin !== '*') {
      res.setHeader('Vary', 'Origin');
    }

    let currentMode = getStoreMode();
    const initialMetadata = applyStoreModeHeader(res, currentMode);
    if (initialMetadata && initialMetadata.mode) {
      currentMode = initialMetadata.mode;
    }

    if (req.method === 'OPTIONS') {
      logDebug({
        method: req && req.method,
        url: req && req.url,
        action: 'corsPreflight',
        statusCode: 204,
      });
      res.statusCode = 204;
      res.end();
      return;
    }

    let url;
    let queryParams = {};
    let rawQueryPath = null;
    try {
      url = new URL(req.url, buildOrigin(req));
      queryParams = extractQueryParams(url.searchParams);
      rawQueryPath = url.searchParams.get('path');
    } catch (error) {
      logDebug({
        method: req && req.method,
        url: req && req.url,
        action: 'parseUrl',
        statusCode: 400,
        message: 'Failed to parse request URL',
        error: error && error.message ? error.message : error,
      });
      sendJson(res, 400, { error: 'Invalid request URL' });
      return;
    }

    const queryPath = normalizePath(rawQueryPath);

    const baseLog = {
      method: req.method,
      url: req.url,
      normalizedPath: url.pathname,
      queryParams,
      queryPath,
      rawQueryPath,
      storeMode: currentMode,
    };

    try {
      if (req.method === 'GET') {
        try {
          if (queryPath) {
            const entry = await getEntry(rawQueryPath || queryPath, rawQueryPath);
            if (!entry) {
              const metadata = applyModeHeaders(res, currentMode);
              logDebug({ ...baseLog, action: 'getEntry', statusCode: 404, foundEntry: false });
              sendJson(res, 404, { error: 'Not Found', ...metadata });
              return;
            }
            const payload = augmentEntry(entry, currentMode);
            applyModeHeaders(res, payload.mode);
            logDebug({ ...baseLog, action: 'getEntry', statusCode: 200, foundEntry: true, mode: payload.mode });
            sendJson(res, 200, payload);
            return;
          }
          let entries = await listEntries();
          if (!Array.isArray(entries)) {
            entries = [];
          }
          const payloadEntries = augmentEntries(entries, currentMode);
          const effectiveMode = payloadEntries.length ? payloadEntries[0].mode : currentMode;
          const listMetadata = buildModeMetadata(effectiveMode);
          applyModeHeaders(res, listMetadata.mode);
          logDebug({
            ...baseLog,
            action: 'listEntries',
            statusCode: 200,
            entriesLength: entries.length,
            mode: listMetadata.mode,
          });
          sendJson(res, 200, { ...listMetadata, entries: payloadEntries });
          return;
        } catch (error) {
          if (error instanceof KvConfigurationError) {
            const fallbackMode = 'memory';
            const metadata = applyModeHeaders(res, fallbackMode);
            logDebug({
              ...baseLog,
              action: 'kvConfigurationError',
              statusCode: queryPath ? 404 : 200,
              error: error.message,
              fallbackMode,
            });
            if (queryPath) {
              sendJson(res, 404, { error: 'Not Found', ...metadata });
              return;
            }
            sendJson(res, 200, { ...metadata, entries: [] });
            return;
          }
          throw error;
        }
      }

      if (req.method === 'DELETE') {
        const target = queryPath;
        if (!target) {
          logDebug({ ...baseLog, action: 'deleteEntry', statusCode: 400, error: 'Missing path parameter' });
          sendJson(res, 400, { error: 'Missing path parameter' });
          return;
        }
        try {
          await deleteEntry(rawQueryPath || target);
          const metadata = applyModeHeaders(res, currentMode);
          logDebug({ ...baseLog, action: 'deleteEntry', statusCode: 200, deletedPath: target });
          sendJson(res, 200, { ok: true, ...metadata });
          return;
        } catch (error) {
          if (error instanceof KvConfigurationError) {
            const metadata = applyModeHeaders(res, 'memory');
            logDebug({
              ...baseLog,
              action: 'deleteEntry',
              statusCode: 404,
              error: error.message,
              fallbackMode: 'memory',
              deletedPath: target,
            });
            sendJson(res, 404, { error: 'Not Found', ...metadata });
            return;
          }
          throw error;
        }
      }

      if (req.method === 'POST' || req.method === 'PUT') {
        let body;
        try {
          body = await readJsonBody(req);
        } catch (error) {
          logDebug({
            ...baseLog,
            action: req.method === 'POST' ? 'createEntry' : 'updateEntry',
            statusCode: 400,
            error: error && error.message ? error.message : 'Invalid request body',
          });
          sendJson(res, 400, { error: error.message || 'Invalid request body' });
          return;
        }
        const rawTarget = typeof body?.path === 'string' && body.path ? body.path : rawQueryPath || queryPath;
        const target = extractPathFromBody(body, queryPath);
        if (!target) {
          logDebug({
            ...baseLog,
            action: req.method === 'POST' ? 'createEntry' : 'updateEntry',
            statusCode: 400,
            error: 'Missing path',
          });
          sendJson(res, 400, { error: 'Missing path' });
          return;
        }
        const validation = validateEntryPayload({
          examples: body.examples,
          deletedProvided: body.deletedProvided,
          updatedAt: body.updatedAt
        });
        if (!validation.ok) {
          const message = validation.reason || 'Payload must be clean JSON';
          logDebug({
            ...baseLog,
            action: req.method === 'POST' ? 'createEntry' : 'updateEntry',
            statusCode: 400,
            error: message,
            path: target,
          });
          sendJson(res, 400, { error: message });
          return;
        }
        const payload = {
          examples: Array.isArray(body.examples) ? body.examples : [],
          deletedProvided: Array.isArray(body.deletedProvided) ? body.deletedProvided : [],
          updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : undefined
        };
        try {
          const entry = await setEntry(rawTarget || target, payload);
          const responseEntry = augmentEntry(entry, currentMode);
          applyModeHeaders(res, responseEntry.mode);
          logDebug({
            ...baseLog,
            action: req.method === 'POST' ? 'createEntry' : 'updateEntry',
            statusCode: 200,
            mode: responseEntry.mode,
            path: rawTarget || target,
            examplesLength: Array.isArray(payload.examples) ? payload.examples.length : undefined,
          });
          sendJson(res, 200, responseEntry);
          return;
        } catch (error) {
          if (error instanceof KvConfigurationError) {
            const metadata = applyModeHeaders(res, 'memory');
            logDebug({
              ...baseLog,
              action: req.method === 'POST' ? 'createEntry' : 'updateEntry',
              statusCode: 404,
              error: error.message,
              fallbackMode: 'memory',
              path: target,
            });
            sendJson(res, 404, { error: 'Not Found', ...metadata });
            return;
          }
          throw error;
        }
      }

      logDebug({ ...baseLog, action: 'methodNotAllowed', statusCode: 405 });
      sendJson(res, 405, { error: 'Method Not Allowed' });
    } catch (error) {
      if (error instanceof KvConfigurationError) {
        const metadata = applyModeHeaders(res, 'memory');
        logDebug({
          ...baseLog,
          action: 'kvConfigurationError',
          statusCode: 200,
          error: error.message,
          fallbackMode: 'memory',
        });
        sendJson(res, 200, { ok: true, message: error.message, ...metadata });
        return;
      }
      if (error instanceof KvOperationError) {
        const metadata = applyModeHeaders(res, currentMode);
        logDebug({
          ...baseLog,
          action: 'kvOperationError',
          statusCode: 503,
          error: error.message,
          kvCode: error.code,
        });
        sendJson(res, 503, {
          error: 'KVUnavailable',
          message: error.message,
          ...metadata
        });
        return;
      }
      logDebug({
        ...baseLog,
        action: 'unhandledError',
        statusCode: 500,
        error: error && error.message ? error.message : 'Unknown error',
      });
      sendJson(res, 500, {
        error: 'Internal Server Error',
        message: error && error.message ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    logDebug({
      method: req && req.method,
      url: req && req.url,
      action: 'handlerFailure',
      statusCode: 500,
      error: error && error.message ? error.message : 'Unhandled handler error',
    });
    try {
      sendJson(res, 500, {
        error: 'Internal Server Error',
        message: error && error.message ? error.message : 'Unhandled handler error'
      });
    } catch (_) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }
};
