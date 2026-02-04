'use strict';

const {
  loadKvClient: loadRedisKvClient,
  isKvConfigured,
  getStoreMode: getRedisStoreMode,
  KvOperationError,
  KvConfigurationError
} = require('./kv-client');

const KEY_PREFIX = 'examples:';
const INDEX_KEY = 'examples:__paths__';
const TRASH_KEY = 'examples:__trash__';
const MAX_TRASH_ENTRIES = 200;

const memoryStore = new Map();
const memoryIndex = new Set();
let memoryTrashEntries = [];

const EXAMPLE_VALUE_TYPE_KEY = '__mathVisualsType__';
const EXAMPLE_VALUE_DATA_KEY = '__mathVisualsValue__';

const DESCRIPTION_FALLBACK_FIELDS = [
  'descriptionHtml',
  'descriptionHTML',
  'description_html',
  'descriptionRich',
  'description_rich',
  'descriptionRichText',
  'description_rich_text',
  'richDescription',
  'taskDescription',
  'task_description',
  'taskText',
  'task_text',
  'task',
  'oppgave',
  'oppgavetekst',
  'oppgaveTekst'
];

const TEMPORARY_EXAMPLE_FIELDS = [
  '__isTemporaryExample',
  '__openRequestId',
  '__openRequestSourcePath',
  '__openRequestCreatedAt',
  '__openRequestNoticePending',
  '__openRequestNoticeShown',
  'temporary'
];

const MAX_SVG_STORAGE_BYTES = 120000;

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function normalizeDescriptionString(value) {
  if (typeof value !== 'string') return '';
  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return normalized.trim();
}

function convertHtmlToPlainText(html) {
  if (typeof html !== 'string') return '';
  const trimmed = html.trim();
  if (!trimmed) return '';
  const sanitized = trimmed
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const replaced = sanitized
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n- ')
    .replace(/<\/(?:p|div|section|article|li|tr|thead|tbody|tfoot|table|h[1-6])\s*>/gi, '\n');
  const stripped = replaced.replace(/<[^>]+>/g, '');
  return normalizeDescriptionString(stripped);
}

function extractDescriptionFromExample(example) {
  if (!example || typeof example !== 'object') return '';
  if (typeof example.description === 'string' && example.description.trim()) {
    return normalizeDescriptionString(example.description);
  }
  for (const key of DESCRIPTION_FALLBACK_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(example, key)) continue;
    const value = example[key];
    if (typeof value !== 'string') continue;
    if (!value.trim()) continue;
    const processed = /html|rich/i.test(key) ? convertHtmlToPlainText(value) : normalizeDescriptionString(value);
    if (processed) return processed;
  }
  if (typeof example.description === 'string') {
    return normalizeDescriptionString(example.description);
  }
  return '';
}

function computeByteLength(str) {
  if (typeof str !== 'string') return 0;
  if (typeof TextEncoder === 'function') {
    try {
      return new TextEncoder().encode(str).length;
    } catch (_) {}
  }
  return str.length;
}

function sanitizeSvgForStorage(svg) {
  if (typeof svg !== 'string') return '';
  const trimmed = svg.trim();
  if (!trimmed) return '';
  if (computeByteLength(trimmed) <= MAX_SVG_STORAGE_BYTES) {
    return trimmed;
  }
  const normalized = trimmed.replace(/\s{2,}/g, ' ');
  if (computeByteLength(normalized) <= MAX_SVG_STORAGE_BYTES) {
    return normalized;
  }
  return '';
}

function stripTemporaryFields(example) {
  if (!example || typeof example !== 'object') return;
  TEMPORARY_EXAMPLE_FIELDS.forEach(field => {
    if (Object.prototype.hasOwnProperty.call(example, field)) {
      delete example[field];
    }
  });
}

function sanitizeExampleObject(example) {
  if (!example || typeof example !== 'object') return null;
  const sanitized = { ...example };
  const description = extractDescriptionFromExample(sanitized);
  sanitized.description = description;

  DESCRIPTION_FALLBACK_FIELDS.forEach(field => {
    if (field !== 'description' && Object.prototype.hasOwnProperty.call(sanitized, field)) {
      delete sanitized[field];
    }
  });

  if (Object.prototype.hasOwnProperty.call(sanitized, 'svg')) {
    sanitized.svg = sanitizeSvgForStorage(sanitized.svg);
  }

  stripTemporaryFields(sanitized);

  return sanitized;
}

function validateSerializedValue(value, path) {
  const type = typeof value;
  if (
    value == null ||
    type === 'string' ||
    type === 'boolean'
  ) {
    return null;
  }
  if (type === 'number') {
    if (!Number.isFinite(value)) {
      return `${path || 'value'} must be a finite number`;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const error = validateSerializedValue(value[i], `${path || 'value'}[${i}]`);
      if (error) return error;
    }
    return null;
  }
  if (type === 'object') {
    if (!isPlainObject(value)) {
      return `${path || 'value'} must be a plain object`;
    }
    const markerType = value[EXAMPLE_VALUE_TYPE_KEY];
    if (typeof markerType === 'string') {
      if (markerType === 'map') {
        if (!Array.isArray(value[EXAMPLE_VALUE_DATA_KEY])) {
          return `${path || 'value'}.__mathVisualsValue__ must be an array for map`;
        }
        for (let i = 0; i < value[EXAMPLE_VALUE_DATA_KEY].length; i++) {
          const entry = value[EXAMPLE_VALUE_DATA_KEY][i];
          if (!Array.isArray(entry) || entry.length < 2) {
            return `${path || 'value'} map entry ${i} must be an array with key and value`;
          }
          const keyError = validateSerializedValue(entry[0], `${path || 'value'}.__mathVisualsValue__[${i}][0]`);
          if (keyError) return keyError;
          const valueError = validateSerializedValue(entry[1], `${path || 'value'}.__mathVisualsValue__[${i}][1]`);
          if (valueError) return valueError;
        }
        return null;
      }
      if (markerType === 'set') {
        if (!Array.isArray(value[EXAMPLE_VALUE_DATA_KEY])) {
          return `${path || 'value'}.__mathVisualsValue__ must be an array for set`;
        }
        for (let i = 0; i < value[EXAMPLE_VALUE_DATA_KEY].length; i++) {
          const error = validateSerializedValue(value[EXAMPLE_VALUE_DATA_KEY][i], `${path || 'value'}.__mathVisualsValue__[${i}]`);
          if (error) return error;
        }
        return null;
      }
      if (markerType === 'date') {
        if (typeof value[EXAMPLE_VALUE_DATA_KEY] !== 'string') {
          return `${path || 'value'}.__mathVisualsValue__ must be a string for date`;
        }
        return null;
      }
      if (markerType === 'regexp') {
        if (typeof value.pattern !== 'string') {
          return `${path || 'value'}.pattern must be a string for regexp`;
        }
        if (value.flags != null && typeof value.flags !== 'string') {
          return `${path || 'value'}.flags must be a string for regexp`;
        }
        return null;
      }
      return `${path || 'value'} has unsupported __mathVisualsType__ '${markerType}'`;
    }
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const error = validateSerializedValue(value[key], `${path || 'value'}.${key}`);
      if (error) return error;
    }
    return null;
  }
  return `${path || 'value'} contains unsupported type`;
}

function validateEntryPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, reason: 'Payload must be an object' };
  }

  if ('examples' in payload && !Array.isArray(payload.examples)) {
    return { ok: false, reason: 'examples must be an array' };
  }

  if ('deletedProvided' in payload && !Array.isArray(payload.deletedProvided)) {
    return { ok: false, reason: 'deletedProvided must be an array' };
  }

  if ('updatedAt' in payload && typeof payload.updatedAt !== 'string') {
    return { ok: false, reason: 'updatedAt must be a string when provided' };
  }

  const examples = Array.isArray(payload.examples) ? payload.examples : [];
  for (let i = 0; i < examples.length; i++) {
    const error = validateSerializedValue(examples[i], `examples[${i}]`);
    if (error) return { ok: false, reason: error };
  }

  const deletedProvided = Array.isArray(payload.deletedProvided) ? payload.deletedProvided : [];
  for (let i = 0; i < deletedProvided.length; i++) {
    if (typeof deletedProvided[i] !== 'string') {
      return { ok: false, reason: `deletedProvided[${i}] must be a string` };
    }
  }

  return { ok: true };
}

function serializeExampleValue(value, seen) {
  if (value == null) return value;
  const valueType = typeof value;
  if (valueType === 'function' || valueType === 'symbol') return undefined;
  if (valueType === 'bigint') return value.toString();
  if (valueType !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const tag = Object.prototype.toString.call(value);
  if (tag === '[object Map]') {
    const entries = [];
    const marker = {
      [EXAMPLE_VALUE_TYPE_KEY]: 'map',
      [EXAMPLE_VALUE_DATA_KEY]: entries
    };
    seen.set(value, marker);
    value.forEach((entryValue, entryKey) => {
      entries.push([
        serializeExampleValue(entryKey, seen),
        serializeExampleValue(entryValue, seen)
      ]);
    });
    return marker;
  }
  if (tag === '[object Set]') {
    const items = [];
    const marker = {
      [EXAMPLE_VALUE_TYPE_KEY]: 'set',
      [EXAMPLE_VALUE_DATA_KEY]: items
    };
    seen.set(value, marker);
    value.forEach(entryValue => {
      items.push(serializeExampleValue(entryValue, seen));
    });
    return marker;
  }
  if (tag === '[object Date]') {
    return {
      [EXAMPLE_VALUE_TYPE_KEY]: 'date',
      [EXAMPLE_VALUE_DATA_KEY]: value.toISOString()
    };
  }
  if (tag === '[object RegExp]') {
    return {
      [EXAMPLE_VALUE_TYPE_KEY]: 'regexp',
      pattern: value.source,
      flags: value.flags || ''
    };
  }
  if (Array.isArray(value)) {
    const arr = [];
    seen.set(value, arr);
    for (let i = 0; i < value.length; i++) {
      arr[i] = serializeExampleValue(value[i], seen);
    }
    return arr;
  }
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, EXAMPLE_VALUE_TYPE_KEY)) {
    const clone = {};
    seen.set(value, clone);
    Object.keys(value).forEach(key => {
      const encoded = serializeExampleValue(value[key], seen);
      if (encoded !== undefined) {
        clone[key] = encoded;
      }
    });
    return clone;
  }
  const obj = {};
  seen.set(value, obj);
  Object.keys(value).forEach(key => {
    const encoded = serializeExampleValue(value[key], seen);
    if (encoded !== undefined) {
      obj[key] = encoded;
    }
  });
  return obj;
}

function deserializeExampleValue(value, seen) {
  if (value == null || typeof value !== 'object') {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }
  if (seen.has(value)) {
    return seen.get(value);
  }
  if (Array.isArray(value)) {
    const arr = [];
    seen.set(value, arr);
    for (let i = 0; i < value.length; i++) {
      arr[i] = deserializeExampleValue(value[i], seen);
    }
    return arr;
  }
  const type = value[EXAMPLE_VALUE_TYPE_KEY];
  if (type === 'map') {
    const result = new Map();
    seen.set(value, result);
    const entries = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
    entries.forEach(entry => {
      if (!Array.isArray(entry) || entry.length < 2) return;
      const key = deserializeExampleValue(entry[0], seen);
      const entryValue = deserializeExampleValue(entry[1], seen);
      try {
        result.set(key, entryValue);
      } catch (_) {}
    });
    return result;
  }
  if (type === 'set') {
    const result = new Set();
    seen.set(value, result);
    const items = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
    items.forEach(item => {
      result.add(deserializeExampleValue(item, seen));
    });
    return result;
  }
  if (type === 'date') {
    const isoValue = value[EXAMPLE_VALUE_DATA_KEY];
    return typeof isoValue === 'string' ? new Date(isoValue) : new Date(NaN);
  }
  if (type === 'regexp') {
    const pattern = typeof value.pattern === 'string' ? value.pattern : '';
    const flags = typeof value.flags === 'string' ? value.flags : '';
    try {
      return new RegExp(pattern, flags);
    } catch (_) {
      try {
        return new RegExp(pattern);
      } catch (_) {
        return new RegExp('');
      }
    }
  }
  const obj = {};
  seen.set(value, obj);
  Object.keys(value).forEach(key => {
    obj[key] = deserializeExampleValue(value[key], seen);
  });
  return obj;
}

function getStoreMode() {
  return getRedisStoreMode();
}

function normalizeStoreMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
  return null;
}

function decodeKvEntryValue(value, key) {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new KvOperationError('Failed to parse KV entry payload', { cause: error, key, code: 'KV_DECODE_FAILED' });
    }
  }
  if (typeof value === 'object') {
    return value;
  }
  throw new KvOperationError('Unsupported KV entry payload type', {
    code: 'KV_UNSUPPORTED_VALUE_TYPE',
    key
  });
}

function applyStorageMetadata(entry, mode) {
  if (!entry || typeof entry !== 'object') return entry;
  const resolved = normalizeStoreMode(mode) || normalizeStoreMode(entry.mode) || normalizeStoreMode(entry.storage) || getStoreMode();
  const storageMode = resolved === 'kv' ? 'kv' : 'memory';
  entry.storage = storageMode;
  entry.mode = storageMode;
  entry.storageMode = storageMode;
  entry.persistent = storageMode === 'kv';
  entry.ephemeral = storageMode !== 'kv';
  return entry;
}

async function loadKvClient() {
  if (!isKvConfigured()) {
    throw new KvConfigurationError(
      'Examples KV is not configured. Set REDIS_ENDPOINT (or REDIS_HOST), REDIS_PORT and REDIS_PASSWORD to enable persistent storage.'
    );
  }
  return loadRedisKvClient();
}

// Remove trailing segments that represent auto-generated example pages
// (e.g. `/diagram/eksempel-1`). These should map to the canonical path so we
// do not create a separate storage entry per example instance.
function stripTrailingExampleSegment(path) {
  if (typeof path !== 'string') return path;
  const examplePattern = /^eksempel[-_]?\d+$/i;
  let working = path;
  while (true) {
    if (!working || working === '/') {
      return working || '/';
    }
    let trimmed = working;
    while (trimmed.length > 1 && trimmed.endsWith('/')) {
      trimmed = trimmed.slice(0, -1);
    }
    if (!trimmed || trimmed === '/') {
      return trimmed || '/';
    }
    const lastSlash = trimmed.lastIndexOf('/');
    const segment = trimmed.slice(lastSlash + 1);
    if (!examplePattern.test(segment)) {
      return trimmed;
    }
    if (lastSlash <= 0) {
      working = '/';
    } else {
      working = trimmed.slice(0, lastSlash);
    }
  }
}

function normalizePath(value) {
  if (typeof value !== 'string') return null;
  let path = value.trim();
  if (!path) return null;
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/[\\]+/g, '/');
  path = path.replace(/\/+/g, '/');
  path = path.replace(/\/index\.html?$/i, '/');
  if (/\.html?$/i.test(path)) {
    path = path.replace(/\.html?$/i, '');
    if (!path) path = '/';
  }
  path = stripTrailingExampleSegment(path);
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  if (!path) path = '/';
  let decoded = path;
  try {
    decoded = decodeURI(path);
  } catch (error) {}
  if (typeof decoded === 'string') {
    decoded = decoded.toLowerCase();
  } else {
    decoded = String(path).toLowerCase();
  }
  let encodedPath = null;
  try {
    encodedPath = encodeURI(decoded || '/');
  } catch (error) {
    try {
      const fallbackSource = typeof decoded === 'string' && decoded ? decoded : String(path || '/');
      encodedPath = encodeURI(fallbackSource);
    } catch (_) {
      encodedPath = typeof path === 'string' && path ? path : '/';
    }
  }
  let normalized = encodedPath;
  if (typeof normalized === 'string') {
    normalized = normalized.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
  }
  if (!normalized) normalized = '/';
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (!normalized) normalized = '/';
  if (normalized.length > 512) {
    normalized = normalized.slice(0, 512);
  }
  return normalized;
}

function makeKey(path) {
  return KEY_PREFIX + path;
}

function clone(value) {
  if (value == null) return value;
  const serialized = serializeExampleValue(value, new WeakMap());
  try {
    return JSON.parse(JSON.stringify(serialized));
  } catch (error) {
    return serialized;
  }
}

function sanitizeExamples(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const cleaned = sanitizeExampleObject(item) || {};
      return serializeExampleValue(cleaned, new WeakMap());
    });
}

function sanitizeDeleted(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  list.forEach(value => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (seen.has(trimmed)) return;
    seen.add(trimmed);
    out.push(trimmed);
  });
  return out;
}

function generateTrashId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}

function sanitizeTrashEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const serializedExample = serializeExampleValue(entry.example, new WeakMap());
  if (!serializedExample) return null;
  const now = new Date().toISOString();
  const sourcePathRaw = typeof entry.sourcePath === 'string' ? entry.sourcePath.trim() : '';
  const normalizedPath = sourcePathRaw ? normalizePath(sourcePathRaw) : null;
  const trimmedHref = typeof entry.sourceHref === 'string' ? entry.sourceHref.trim() : '';
  const trimmedTitle = typeof entry.sourceTitle === 'string' ? entry.sourceTitle : '';
  const trimmedReason = typeof entry.reason === 'string' ? entry.reason.trim() : 'delete';
  const trimmedLabel = typeof entry.label === 'string' ? entry.label : '';
  const deletedAt = typeof entry.deletedAt === 'string' && entry.deletedAt.trim() ? entry.deletedAt.trim() : now;
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateTrashId();
  const sanitized = {
    id,
    example: serializedExample,
    deletedAt,
    sourcePath: normalizedPath || null,
    sourcePathRaw: sourcePathRaw && sourcePathRaw !== (normalizedPath || '') ? sourcePathRaw : null,
    sourceHref: trimmedHref || null,
    sourceTitle: trimmedTitle || '',
    reason: trimmedReason,
    removedAtIndex: Number.isInteger(entry.removedAtIndex) ? entry.removedAtIndex : null,
    label: trimmedLabel || null,
    importedFromHistory: entry.importedFromHistory === true
  };
  if (entry.metadata && typeof entry.metadata === 'object') {
    sanitized.metadata = serializeExampleValue(entry.metadata, new WeakMap());
  }
  return sanitized;
}

function sanitizeTrashEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const sanitized = [];
  const idIndexMap = new Map();
  entries.forEach(entry => {
    const normalized = sanitizeTrashEntry(entry);
    if (!normalized) return;
    const id = normalized.id;
    if (idIndexMap.has(id)) {
      const index = idIndexMap.get(id);
      sanitized[index] = normalized;
      return;
    }
    idIndexMap.set(id, sanitized.length);
    sanitized.push(normalized);
  });
  return sanitized;
}

function cloneTrashEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.map(entry => clone(entry));
}

function buildEntry(path, payload) {
  const now = new Date().toISOString();
  const examples = sanitizeExamples(payload.examples);
  const deletedProvided = sanitizeDeleted(payload.deletedProvided);
  const entry = {
    path,
    examples,
    deletedProvided,
    updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : now
  };
  return entry;
}

function writeTrashToMemory(entries) {
  memoryTrashEntries = sanitizeTrashEntries(entries);
}

function readTrashFromMemory() {
  return cloneTrashEntries(memoryTrashEntries);
}

async function writeTrashToKv(entries) {
  const kv = await loadKvClient();
  try {
    await kv.set(TRASH_KEY, entries);
  } catch (error) {
    throw new KvOperationError('Failed to write trash entries to KV', { cause: error });
  }
  try {
    const verification = await kv.get(TRASH_KEY);
    if (verification == null) {
      throw new KvOperationError('Failed to verify trash entries in KV', {
        code: 'KV_WRITE_VERIFICATION_FAILED'
      });
    }
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError('Unable to verify trash entries in KV', {
      cause: error,
      code: 'KV_WRITE_VERIFICATION_FAILED'
    });
  }
}

async function readTrashFromKv() {
  const kv = await loadKvClient();
  try {
    const value = await kv.get(TRASH_KEY);
    if (value == null) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        throw new KvOperationError('Failed to parse trash entries from KV', { cause: error });
      }
    }
    if (typeof value === 'object' && value && Array.isArray(value.entries)) {
      return value.entries;
    }
    throw new KvOperationError('Unsupported KV payload for trash entries', {
      code: 'KV_UNSUPPORTED_VALUE_TYPE'
    });
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError('Failed to read trash entries from KV', { cause: error });
  }
}

async function writeToKv(path, entry, rawPath) {
  const kv = await loadKvClient();
  const key = makeKey(path);
  const legacyKey = rawPath && rawPath !== path ? makeKey(rawPath) : null;
  try {
    await kv.set(key, entry);
    await kv.sadd(INDEX_KEY, path);
    if (legacyKey) {
      await kv.del(legacyKey);
      await kv.srem(INDEX_KEY, rawPath);
    }
  } catch (error) {
    throw new KvOperationError(`Failed to write entry to KV for path ${path}`, { cause: error });
  }
  try {
    const verification = await kv.get(key);
    if (verification == null) {
      throw new KvOperationError(`Failed to verify KV entry after writing path ${path}`, {
        code: 'KV_WRITE_VERIFICATION_FAILED'
      });
    }
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError(`Failed to verify entry in KV for path ${path}`, {
      cause: error,
      code: 'KV_WRITE_VERIFICATION_FAILED'
    });
  }
}

async function deleteFromKv(path, rawPath) {
  const kv = await loadKvClient();
  const key = makeKey(path);
  const legacyKey = rawPath && rawPath !== path ? makeKey(rawPath) : null;
  try {
    await kv.del(key);
    await kv.srem(INDEX_KEY, path);
    if (legacyKey) {
      await kv.del(legacyKey);
      await kv.srem(INDEX_KEY, rawPath);
    }
  } catch (error) {
    throw new KvOperationError(`Failed to delete entry in KV for path ${path}`, { cause: error });
  }
}

async function readFromKv(path, rawPath) {
  const kv = await loadKvClient();
  const key = makeKey(path);
  const legacyKey = rawPath && rawPath !== path ? makeKey(rawPath) : null;
  try {
    let value = await kv.get(key);
    let sourceKey = key;
    if (value == null && legacyKey) {
      value = await kv.get(legacyKey);
      if (value != null) {
        sourceKey = legacyKey;
      }
    }
    if (value == null) {
      if (legacyKey) {
        await kv.srem(INDEX_KEY, rawPath);
      }
      return null;
    }
    let decoded;
    try {
      decoded = decodeKvEntryValue(value, sourceKey);
    } catch (error) {
      const isDecodeError = error instanceof KvOperationError && error.code === 'KV_DECODE_FAILED';
      if (!isDecodeError) {
        throw error;
      }
      try {
        await kv.del(sourceKey);
        await kv.srem(INDEX_KEY, sourceKey === key ? path : rawPath || path);
        if (legacyKey && legacyKey !== sourceKey) {
          await kv.del(legacyKey);
          await kv.srem(INDEX_KEY, rawPath || path);
        }
      } catch (_) {}
      return null;
    }
    if (sourceKey !== key) {
      await kv.set(key, decoded);
      await kv.sadd(INDEX_KEY, path);
      if (legacyKey) {
        await kv.del(legacyKey);
        await kv.srem(INDEX_KEY, rawPath);
      }
    } else if (legacyKey) {
      await kv.srem(INDEX_KEY, rawPath);
    }
    return decoded;
  } catch (error) {
    if (error instanceof KvOperationError) {
      throw error;
    }
    throw new KvOperationError(`Failed to read entry from KV for path ${path}`, { cause: error });
  }
}

function writeToMemory(path, entry) {
  const key = makeKey(path);
  memoryStore.set(key, clone(entry));
  memoryIndex.add(path);
}

function deleteFromMemory(path) {
  const key = makeKey(path);
  memoryStore.delete(key);
  memoryIndex.delete(path);
}

function readFromMemory(path) {
  const key = makeKey(path);
  const value = memoryStore.get(key);
  return value ? clone(value) : null;
}

async function getEntry(path, rawPath) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  const storeMode = getStoreMode();
  const useKv = storeMode === 'kv';
  if (useKv) {
    const kvValue = await readFromKv(normalized, rawPath || path);
    if (kvValue) {
      const entry = buildEntry(normalized, kvValue);
      applyStorageMetadata(entry, 'kv');
      writeToMemory(normalized, entry);
      return clone(entry);
    }
  }
  const memoryValue = readFromMemory(normalized);
  if (memoryValue) {
    const entryMode = storeMode === 'memory'
      ? 'memory'
      : memoryValue.mode || memoryValue.storage || storeMode;
    const entry = applyStorageMetadata(clone(memoryValue), entryMode);
    return entry;
  }
  return null;
}

async function setEntry(path, payload) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  const entry = buildEntry(normalized, payload || {});
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await writeToKv(normalized, entry, path);
    const annotated = applyStorageMetadata({ ...entry }, 'kv');
    writeToMemory(normalized, annotated);
    return clone(annotated);
  }
  const annotated = applyStorageMetadata(entry, storeMode);
  writeToMemory(normalized, annotated);
  return clone(annotated);
}

async function deleteEntry(path) {
  const normalized = normalizePath(path);
  if (!normalized) return false;
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await deleteFromKv(normalized, path);
  }
  deleteFromMemory(normalized);
  return true;
}

async function listEntries() {
  const entries = [];
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    const kv = await loadKvClient();
    let paths = [];
    const seenPaths = new Set();
    try {
      const raw = await kv.smembers(INDEX_KEY);
      if (Array.isArray(raw)) paths = raw;
    } catch (error) {
      throw new KvOperationError('Failed to read index from KV', { cause: error });
    }
    for (const value of paths) {
      const normalized = normalizePath(value);
      if (!normalized) continue;
      if (seenPaths.has(normalized)) {
        if (normalized !== value) {
          try { await kv.srem(INDEX_KEY, value); } catch (_) {}
        }
        continue;
      }
      const stored = await readFromKv(normalized, value);
      if (!stored) continue;
      const entry = buildEntry(normalized, stored);
      applyStorageMetadata(entry, 'kv');
      writeToMemory(normalized, entry);
      seenPaths.add(normalized);
      entries.push(clone(entry));
    }
    return entries;
  }
  memoryIndex.forEach(path => {
    const normalized = normalizePath(path);
    if (!normalized) return;
    const stored = readFromMemory(normalized);
    if (!stored) return;
    const annotated = applyStorageMetadata(stored, storeMode);
    entries.push(clone(annotated));
  });
  return entries;
}

async function getTrashEntries() {
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    const kvEntries = await readTrashFromKv();
    const sanitized = sanitizeTrashEntries(kvEntries);
    writeTrashToMemory(sanitized);
    return cloneTrashEntries(sanitized);
  }
  const memoryEntries = readTrashFromMemory();
  const sanitized = sanitizeTrashEntries(memoryEntries);
  writeTrashToMemory(sanitized);
  return cloneTrashEntries(sanitized);
}

async function setTrashEntries(entries) {
  const sanitized = sanitizeTrashEntries(entries).slice(0, MAX_TRASH_ENTRIES);
  const storeMode = getStoreMode();
  if (storeMode === 'kv') {
    await writeTrashToKv(sanitized);
    writeTrashToMemory(sanitized);
    return cloneTrashEntries(sanitized);
  }
  writeTrashToMemory(sanitized);
  return cloneTrashEntries(sanitized);
}

async function appendTrashEntries(entries, options) {
  const sanitizedNew = sanitizeTrashEntries(entries);
  if (!sanitizedNew.length) {
    return getTrashEntries();
  }
  const mode = options && options.mode === 'append' ? 'append' : 'prepend';
  const limit = Number.isInteger(options && options.limit)
    ? Math.max(1, options.limit)
    : MAX_TRASH_ENTRIES;
  const existing = await getTrashEntries();
  const existingList = Array.isArray(existing) ? existing : [];
  const mapOrder = existingList.concat(sanitizedNew);
  const idMap = new Map();
  mapOrder.forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const id = typeof entry.id === 'string' ? entry.id : null;
    if (!id) return;
    idMap.set(id, entry);
  });
  const outputOrder = mode === 'append'
    ? existingList.concat(sanitizedNew)
    : sanitizedNew.concat(existingList);
  const deduped = [];
  const seenIds = new Set();
  outputOrder.forEach(entry => {
    if (!entry || typeof entry !== 'object') return;
    const id = typeof entry.id === 'string' ? entry.id : null;
    if (id) {
      if (seenIds.has(id)) return;
      const resolved = idMap.has(id) ? idMap.get(id) : entry;
      deduped.push(resolved);
      seenIds.add(id);
      return;
    }
    deduped.push(entry);
  });
  const truncated = mode === 'append' ? deduped.slice(-limit) : deduped.slice(0, limit);
  return setTrashEntries(truncated);
}

async function deleteTrashEntries(ids) {
  const values = Array.isArray(ids) ? ids : [ids];
  const targets = new Set();
  values.forEach(value => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (trimmed) {
      targets.add(trimmed);
    }
  });
  if (targets.size === 0) {
    const entries = await getTrashEntries();
    return { removed: 0, entries };
  }
  const existing = await getTrashEntries();
  const remaining = [];
  let removed = 0;
  existing.forEach(entry => {
    if (!entry || typeof entry.id !== 'string') {
      remaining.push(entry);
      return;
    }
    if (targets.has(entry.id)) {
      removed += 1;
      return;
    }
    remaining.push(entry);
  });
  const updated = await setTrashEntries(remaining);
  return { removed, entries: updated };
}

module.exports = {
  normalizePath,
  stripTrailingExampleSegment,
  getEntry,
  setEntry,
  deleteEntry,
  listEntries,
  getTrashEntries,
  setTrashEntries,
  appendTrashEntries,
  deleteTrashEntries,
  validateEntryPayload,
  KvOperationError,
  KvConfigurationError,
  isKvConfigured,
  getStoreMode,
  __serializeExampleValue: value => serializeExampleValue(value, new WeakMap()),
  __deserializeExampleValue: value => deserializeExampleValue(value, new WeakMap())
};
