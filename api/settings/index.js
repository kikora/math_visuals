'use strict';

const {
  getSettings,
  setSettings,
  resetSettings,
  getStoreMode,
  KvConfigurationError,
  KvOperationError
} = require('../_lib/settings-store');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
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

function applyStoreHeaders(res, mode) {
  if (!res || typeof res.setHeader !== 'function') return;
  if (mode) {
    res.setHeader('X-Settings-Storage-Mode', mode);
    res.setHeader('X-Settings-Storage-Persistent', mode === 'kv' ? '1' : '0');
  }
}

function normalizePayload(body) {
  if (body && typeof body === 'object' && body.settings && typeof body.settings === 'object') {
    return body.settings;
  }
  return body;
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin === 'null' ? '*' : origin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === 'GET') {
      const settings = await getSettings();
      const mode = getStoreMode();
      applyStoreHeaders(res, mode);
      sendJson(res, 200, { settings, storage: { mode, persistent: mode === 'kv' } });
      return;
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = await readJsonBody(req);
      const payload = normalizePayload(body);
      const updated = await setSettings(payload);
      const mode = getStoreMode();
      applyStoreHeaders(res, mode);
      sendJson(res, 200, { settings: updated, storage: { mode, persistent: mode === 'kv' } });
      return;
    }
    if (req.method === 'DELETE') {
      const reset = await resetSettings();
      const mode = getStoreMode();
      applyStoreHeaders(res, mode);
      sendJson(res, 200, { settings: reset, storage: { mode, persistent: mode === 'kv' }, reset: true });
      return;
    }
    sendJson(res, 405, { error: 'Method Not Allowed' });
  } catch (error) {
    if (error instanceof KvConfigurationError) {
      applyStoreHeaders(res, 'memory');
      const fallback = await resetSettings();
      sendJson(res, 200, { settings: fallback, storage: { mode: 'memory', persistent: false } });
      return;
    }
    if (error instanceof KvOperationError) {
      applyStoreHeaders(res, getStoreMode());
      sendJson(res, 500, { error: 'Failed to persist settings' });
      return;
    }
    applyStoreHeaders(res, getStoreMode());
    sendJson(res, 500, { error: 'Internal Server Error' });
  }
};
