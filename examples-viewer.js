// Viewer for stored examples
const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
const VIEWER_SCRIPT_FILENAME = 'examples-viewer.js';
const DESCRIPTION_RENDERER_FILENAME = 'description-renderer.js';
const DESCRIPTION_RENDERER_PROMISE_KEY = '__MATH_VISUALS_DESCRIPTION_RENDERER_PROMISE__';
const DESCRIPTION_RENDERER_URL_KEY = '__MATH_VISUALS_DESCRIPTION_RENDERER_URL__';
const DESCRIPTION_RENDERER_LOG_PREFIX = '[math-vis:viewer:description-loader]';
let descriptionRendererLoadPromise = null;
let descriptionRendererResolvedUrl = null;

function logDescriptionRendererEvent(level, message, details) {
  const loggerRoot =
    (globalScope && globalScope.console && globalScope) ||
    (typeof console !== 'undefined' && { console }) ||
    null;
  if (!loggerRoot || !loggerRoot.console) return;
  const consoleRef = loggerRoot.console;
  const method = typeof consoleRef[level] === 'function' ? consoleRef[level] : consoleRef.log;
  try {
    if (details !== undefined) {
      method.call(consoleRef, `${DESCRIPTION_RENDERER_LOG_PREFIX} ${message}`, details);
    } else {
      method.call(consoleRef, `${DESCRIPTION_RENDERER_LOG_PREFIX} ${message}`);
    }
  } catch (_) {}
}

function getDescriptionRendererGlobal() {
  if (!globalScope) return null;
  const renderer = globalScope.MathVisDescriptionRenderer;
  if (renderer && typeof renderer.renderInto === 'function') {
    return renderer;
  }
  return null;
}

function resolveDescriptionRendererUrl() {
  if (descriptionRendererResolvedUrl) return descriptionRendererResolvedUrl;
  if (globalScope) {
    const cached = globalScope[DESCRIPTION_RENDERER_URL_KEY];
    if (typeof cached === 'string' && cached.trim()) {
      descriptionRendererResolvedUrl = cached.trim();
      return descriptionRendererResolvedUrl;
    }
  }
  if (typeof document === 'undefined') {
    descriptionRendererResolvedUrl = DESCRIPTION_RENDERER_FILENAME;
    if (globalScope) {
      globalScope[DESCRIPTION_RENDERER_URL_KEY] = descriptionRendererResolvedUrl;
    }
    return descriptionRendererResolvedUrl;
  }
  const candidates = [];
  const seenBases = new Set();
  const addCandidate = (base, reason, priority = 1) => {
    if (typeof base !== 'string') return;
    const trimmed = base.trim();
    if (!trimmed) return;
    if (seenBases.has(trimmed)) return;
    seenBases.add(trimmed);
    candidates.push({ base: trimmed, reason, priority, order: candidates.length });
  };
  const currentScript = document.currentScript;
  const scripts = document.getElementsByTagName('script');

  const resolveCandidateScriptElement = () => {
    if (currentScript) return currentScript;
    if (scripts && scripts.length) {
      return scripts[scripts.length - 1];
    }
    return null;
  };

  const shouldForceRelativeDescriptionRendererUrl = () => {
    if (!globalScope) return false;
    const { location } = globalScope;
    const protocol = location && typeof location.protocol === 'string' ? location.protocol.toLowerCase() : '';
    if (!protocol || protocol === 'file:') {
      return true;
    }
    const scriptElement = resolveCandidateScriptElement();
    if (!scriptElement) {
      return false;
    }
    const getAttribute = typeof scriptElement.getAttribute === 'function' ? scriptElement.getAttribute.bind(scriptElement) : null;
    if (getAttribute) {
      const rawSrc = getAttribute('src');
      if (typeof rawSrc === 'string') {
        const trimmedSrc = rawSrc.trim();
        if (trimmedSrc && !/^[a-z][a-z\d+\-.]*:/i.test(trimmedSrc) && !trimmedSrc.startsWith('//')) {
          return true;
        }
      }
    }
    const pageOrigin = location && typeof location.origin === 'string' ? location.origin : '';
    if (!pageOrigin || pageOrigin === 'null') {
      return true;
    }
    const absoluteSrc = typeof scriptElement.src === 'string' ? scriptElement.src : '';
    if (!absoluteSrc) {
      return false;
    }
    try {
      const scriptOrigin = new URL(absoluteSrc).origin;
      if (scriptOrigin && scriptOrigin !== 'null' && scriptOrigin !== pageOrigin) {
        return true;
      }
    } catch (_) {}
    return false;
  };

  if (shouldForceRelativeDescriptionRendererUrl()) {
    const scriptElement = resolveCandidateScriptElement();
    const absoluteSrc = scriptElement && typeof scriptElement.src === 'string' ? scriptElement.src : '';
    if (absoluteSrc) {
      try {
        const resolvedFromScript = new URL(DESCRIPTION_RENDERER_FILENAME, absoluteSrc).toString();
        logDescriptionRendererEvent(
          'info',
          'Viewer using script-derived description renderer URL for static context',
          {
            scriptSrc: absoluteSrc,
            resolvedUrl: resolvedFromScript
          }
        );
        descriptionRendererResolvedUrl = resolvedFromScript;
        if (globalScope) {
          globalScope[DESCRIPTION_RENDERER_URL_KEY] = descriptionRendererResolvedUrl;
        }
        return descriptionRendererResolvedUrl;
      } catch (error) {
        logDescriptionRendererEvent('warn', 'Viewer failed to resolve script-derived description renderer URL in static context', {
          scriptSrc: absoluteSrc,
          error: error && error.message ? error.message : String(error)
        });
      }
    }
    logDescriptionRendererEvent('info', 'Viewer using relative description renderer URL for static context');
    descriptionRendererResolvedUrl = DESCRIPTION_RENDERER_FILENAME;
    if (globalScope) {
      globalScope[DESCRIPTION_RENDERER_URL_KEY] = descriptionRendererResolvedUrl;
    }
    return descriptionRendererResolvedUrl;
  }

  if (currentScript && currentScript.src) {
    addCandidate(currentScript.src, 'document.currentScript.src', 0);
  }
  for (let i = scripts.length - 1; i >= 0; i--) {
    const script = scripts[i];
    if (!script) continue;
    const srcAttr = script.getAttribute && script.getAttribute('src');
    if (typeof srcAttr !== 'string') continue;
    const src = srcAttr.trim();
    if (!src) continue;
    addCandidate(src, 'script[src]', 0);
    const normalized = src.split('#')[0].split('?')[0];
    if (!normalized.endsWith(VIEWER_SCRIPT_FILENAME)) continue;
    addCandidate(src, 'examples-viewer script[src]', 0);
    break;
  }
  if (globalScope && globalScope.location) {
    const { origin, href } = globalScope.location;
    if (typeof origin === 'string' && origin && origin !== 'null') {
      addCandidate(origin.endsWith('/') ? origin : `${origin}/`, 'window.location.origin', 2);
    }
    if (typeof href === 'string' && href) {
      addCandidate(href, 'window.location.href', 3);
    }
  }
  if (typeof document.baseURI === 'string' && document.baseURI) {
    addCandidate(document.baseURI, 'document.baseURI', 3);
  }
  const orderedCandidates = candidates.slice().sort((a, b) => {
    if (a.priority === b.priority) {
      return a.order - b.order;
    }
    return a.priority - b.priority;
  });
  logDescriptionRendererEvent('debug', 'Evaluating viewer description renderer URL candidates', orderedCandidates);
  let resolved = null;
  for (const candidate of orderedCandidates) {
    const base = candidate && candidate.base;
    if (!base) continue;
    try {
      const url = new URL(DESCRIPTION_RENDERER_FILENAME, base).toString();
      logDescriptionRendererEvent('debug', 'Resolved viewer description renderer URL candidate', {
        base,
        reason: candidate.reason,
        resolved: url
      });
      resolved = url;
      break;
    } catch (error) {
      logDescriptionRendererEvent('warn', 'Failed to resolve viewer description renderer URL candidate', {
        base,
        reason: candidate.reason,
        error: error && error.message ? error.message : String(error)
      });
    }
  }
  if (!resolved) {
    logDescriptionRendererEvent('warn', 'Viewer falling back to relative description renderer URL');
    resolved = DESCRIPTION_RENDERER_FILENAME;
  }
  descriptionRendererResolvedUrl = resolved;
  if (globalScope) {
    globalScope[DESCRIPTION_RENDERER_URL_KEY] = descriptionRendererResolvedUrl;
  }
  return descriptionRendererResolvedUrl;
}

function ensureDescriptionRendererLoaded() {
  const existing = getDescriptionRendererGlobal();
  if (existing) return Promise.resolve(existing);
  if (globalScope) {
    const shared = globalScope[DESCRIPTION_RENDERER_PROMISE_KEY];
    if (shared && typeof shared.then === 'function') {
      return shared.then(() => getDescriptionRendererGlobal());
    }
  }
  if (descriptionRendererLoadPromise) {
    return descriptionRendererLoadPromise.then(() => getDescriptionRendererGlobal());
  }
  if (typeof document === 'undefined') {
    return Promise.resolve(null);
  }
  const parent = document.head || document.body || document.documentElement;
  if (!parent) {
    return Promise.resolve(null);
  }
  const scriptUrl = resolveDescriptionRendererUrl();
  if (!scriptUrl) {
    return Promise.resolve(null);
  }
  const loadPromise = new Promise(resolve => {
    const script = document.createElement('script');
    if (!script) {
      resolve(null);
      return;
    }
    let settled = false;
    const cleanup = () => {
      if (descriptionRendererLoadPromise === loadPromise) {
        descriptionRendererLoadPromise = null;
      }
      if (globalScope && globalScope[DESCRIPTION_RENDERER_PROMISE_KEY] === loadPromise) {
        delete globalScope[DESCRIPTION_RENDERER_PROMISE_KEY];
      }
    };
    script.async = true;
    script.src = scriptUrl;
    script.setAttribute('data-mathvis-description-loader', 'viewer');
    logDescriptionRendererEvent('info', 'Loading description renderer script for viewer', { url: scriptUrl });
    script.onload = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const renderer = getDescriptionRendererGlobal();
      if (globalScope) {
        globalScope[DESCRIPTION_RENDERER_PROMISE_KEY] = Promise.resolve(renderer);
      }
      logDescriptionRendererEvent('info', 'Viewer description renderer script loaded', { url: scriptUrl });
      resolve(renderer);
    };
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      logDescriptionRendererEvent('error', 'Viewer failed to load description renderer script', { url: scriptUrl });
      resolve(null);
    };
    parent.appendChild(script);
  });
  descriptionRendererLoadPromise = loadPromise;
  if (globalScope) {
    globalScope[DESCRIPTION_RENDERER_PROMISE_KEY] = loadPromise;
  }
  return loadPromise.then(renderer => {
    if (!renderer && globalScope && globalScope[DESCRIPTION_RENDERER_PROMISE_KEY] === loadPromise) {
      delete globalScope[DESCRIPTION_RENDERER_PROMISE_KEY];
    }
    return renderer || null;
  });
}
function resolveExamplesApiBase() {
  if (typeof window === 'undefined') return null;
  const productionBase = 'https://mathvisuals.no/api/examples';
  if (window.MATH_VISUALS_EXAMPLES_API_URL) {
    const value = String(window.MATH_VISUALS_EXAMPLES_API_URL).trim();
    if (value) return value;
  }
  const origin = window.location && window.location.origin;
  if (typeof window.location?.hostname === 'string' && /\.vercel\.app$/i.test(window.location.hostname)) {
    return productionBase;
  }
  if (typeof origin === 'string' && /^https?:/i.test(origin)) {
    return '/api/examples';
  }
  return productionBase;
}
function buildExamplesApiUrl(base, path) {
  if (!base) return null;
  if (typeof window === 'undefined') {
    if (!path) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}path=${encodeURIComponent(path)}`;
  }
  try {
    const url = new URL(base, window.location && window.location.href ? window.location.href : undefined);
    if (path) {
      url.searchParams.set('path', path);
    }
    return url.toString();
  } catch (error) {
    if (!path) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}path=${encodeURIComponent(path)}`;
  }
}
function normalizePath(value) {
  if (typeof value !== 'string') return '';
  let path = value.trim();
  if (!path) return '';
  if (!path.startsWith('/')) path = '/' + path;
  path = path.replace(/[\\]+/g, '/');
  path = path.replace(/\/+/g, '/');
  path = path.replace(/\/index\.html?$/i, '/');
  if (/\.html?$/i.test(path)) {
    path = path.replace(/\.html?$/i, '');
    if (!path) path = '/';
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }
  return path || '/';
}
const examplesApiBase = resolveExamplesApiBase();
const backendEntriesCache = new Map();
let backendStoreMode = null;

function normalizeBackendStoreMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
  return null;
}

function readStoreModeFromHeaders(headers) {
  if (!headers) return null;
  const headerCandidates = [
    'X-Examples-Store-Mode',
    'X-Examples-Storage-Mode',
    'X-Examples-Storage-Result',
    'X-Examples-Storage'
  ];
  for (const header of headerCandidates) {
    try {
      if (typeof headers.get === 'function') {
        const value = headers.get(header);
        const normalized = normalizeBackendStoreMode(value);
        if (normalized) return normalized;
      }
    } catch (_) {}
    try {
      const direct = headers[header] || headers[header.toLowerCase()];
      const normalized = normalizeBackendStoreMode(direct);
      if (normalized) return normalized;
    } catch (_) {}
  }
  return null;
}

function readStoreModeFromPayload(payload) {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const nested = readStoreModeFromPayload(entry);
      if (nested) return nested;
    }
    return null;
  }
  if (typeof payload !== 'object') return null;
  const direct = normalizeBackendStoreMode(
    payload.mode || payload.storage || payload.storageMode || payload.storeMode
  );
  if (direct) return direct;
  const nestedCandidates = [
    payload.metadata,
    payload.meta,
    payload.result,
    payload.data
  ];
  for (const candidate of nestedCandidates) {
    const nested = readStoreModeFromPayload(candidate);
    if (nested) return nested;
  }
  if (Array.isArray(payload.entries)) {
    for (const entry of payload.entries) {
      const entryMode = readStoreModeFromPayload(entry);
      if (entryMode) return entryMode;
    }
  }
  return null;
}

function resolveStoreMode(res, payload) {
  const headerMode = readStoreModeFromHeaders(res && res.headers);
  if (headerMode) return headerMode;
  const payloadMode = readStoreModeFromPayload(payload);
  if (payloadMode) return payloadMode;
  return null;
}

const MEMORY_WARNING_TEXT = 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.';
const MISSING_API_GUIDANCE =
  'Fant ikke eksempeltjenesten (/api/examples). Sjekk at back-end kjører og at distribusjonen inkluderer serverless-funksjoner.';

function extractContentType(headers) {
  if (!headers) return null;
  let value = null;
  try {
    if (typeof headers.get === 'function') {
      value = headers.get('content-type') || headers.get('Content-Type');
    }
  } catch (_) {
    value = null;
  }
  if (!value && typeof headers === 'object') {
    try {
      value = headers['content-type'] || headers['Content-Type'] || null;
    } catch (_) {
      value = null;
    }
  }
  return typeof value === 'string' ? value : null;
}

function isJsonContentType(value) {
  if (typeof value !== 'string') return false;
  const [first] = value.split(';', 1);
  const normalized = (first || value).trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'application/json') return true;
  if (normalized.endsWith('+json')) return true;
  if (/\bjson\b/.test(normalized)) return true;
  return false;
}

function responseLooksLikeJson(res) {
  if (!res) return false;
  const header = extractContentType(res.headers);
  return isJsonContentType(header);
}

function ensureStoreBannerElement() {
  if (typeof document === 'undefined') return null;
  if (ensureStoreBannerElement.element && ensureStoreBannerElement.element.isConnected) {
    return ensureStoreBannerElement.element;
  }
  let el = document.getElementById('examples-store-banner');
  if (!el) {
    el = document.createElement('div');
    if (!el) return null;
    el.id = 'examples-store-banner';
    el.className = 'examples-store-banner';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.hidden = true;
    const container = document.getElementById('examples');
    if (container && container.parentNode) {
      container.parentNode.insertBefore(el, container);
    } else if (document.body) {
      document.body.insertBefore(el, document.body.firstChild || null);
    }
  }
  ensureStoreBannerElement.element = el;
  return el;
}

function setStoreBannerMessage(message) {
  const el = ensureStoreBannerElement();
  if (!el) return;
  const normalized = typeof message === 'string' ? message.trim() : '';
  el.textContent = normalized;
  el.hidden = !normalized;
  el.classList.toggle('examples-store-banner--active', Boolean(normalized));
}

function updateBackendStoreMode(mode) {
  const normalized = normalizeBackendStoreMode(mode) || (mode ? null : 'kv');
  const resolved = normalized || backendStoreMode || 'kv';
  backendStoreMode = resolved;
  if (resolved === 'memory') {
    setStoreBannerMessage(MEMORY_WARNING_TEXT);
    if (lastStatusType !== 'error') {
      setStatusMessage(MEMORY_WARNING_TEXT, 'warning');
    }
  } else {
    setStoreBannerMessage('');
    if (lastStatusType === 'warning' && lastStatusMessage === MEMORY_WARNING_TEXT) {
      setStatusMessage('', '');
    }
  }
}

function applyStoreModeFromResponse(res, payload) {
  const mode = resolveStoreMode(res, payload);
  if (mode) {
    updateBackendStoreMode(mode);
    return mode;
  }
  if (!backendStoreMode) {
    updateBackendStoreMode('kv');
  }
  return backendStoreMode;
}
let lastStatusMessage = '';
let lastStatusType = '';

function ensureStatusElement() {
  if (typeof document === 'undefined') return null;
  if (ensureStatusElement.element && ensureStatusElement.element.isConnected) {
    return ensureStatusElement.element;
  }
  let el = document.getElementById('examples-status');
  if (!el) {
    el = document.createElement('p');
    el.id = 'examples-status';
    el.className = 'examples-status';
    el.setAttribute('role', 'status');
    el.hidden = true;
    const container = document.getElementById('examples');
    if (container && container.parentNode) {
      container.parentNode.insertBefore(el, container);
    } else if (document.body) {
      document.body.insertBefore(el, document.body.firstChild || null);
    }
  }
  ensureStatusElement.element = el;
  return el;
}

function setStatusMessage(message, type) {
  const normalizedMessage = typeof message === 'string' ? message : '';
  const normalizedType = typeof type === 'string' ? type : '';
  if (normalizedMessage === lastStatusMessage && normalizedType === lastStatusType) {
    return;
  }
  lastStatusMessage = normalizedMessage;
  lastStatusType = normalizedType;
  const el = ensureStatusElement();
  if (!el) return;
  el.textContent = normalizedMessage;
  el.hidden = !normalizedMessage;
  if (normalizedType) {
    el.dataset.statusType = normalizedType;
  } else if (el.dataset && Object.prototype.hasOwnProperty.call(el.dataset, 'statusType')) {
    delete el.dataset.statusType;
  }
  el.classList.toggle('examples-status--error', normalizedType === 'error');
  el.classList.toggle('examples-status--warning', normalizedType === 'warning');
}

function reportMissingExamplesApi(status) {
  const suffix = Number.isFinite(status) ? ` (status ${status})` : '';
  setStatusMessage(`${MISSING_API_GUIDANCE}${suffix}`, 'error');
}
function getCachedEntry(path) {
  const entry = backendEntriesCache.get(path);
  if (!entry) return { path, examples: [], deletedProvided: [], updatedAt: null };
  return {
    path,
    examples: Array.isArray(entry.examples) ? entry.examples.slice() : [],
    deletedProvided: Array.isArray(entry.deletedProvided) ? entry.deletedProvided.slice() : [],
    updatedAt: entry && entry.updatedAt ? entry.updatedAt : null
  };
}
function updateBackendCache(path, entry) {
  backendEntriesCache.set(path, {
    path,
    examples: entry && Array.isArray(entry.examples) ? entry.examples.slice() : [],
    deletedProvided: entry && Array.isArray(entry.deletedProvided) ? entry.deletedProvided.slice() : [],
    updatedAt: entry && entry.updatedAt ? entry.updatedAt : null
  });
}
async function persistBackendEntry(path, entry) {
  if (!examplesApiBase) return;
  const url = buildExamplesApiUrl(examplesApiBase, path);
  if (!url) return;
  const examples = entry && Array.isArray(entry.examples) ? entry.examples : [];
  const deletedProvided = entry && Array.isArray(entry.deletedProvided) ? entry.deletedProvided.filter(value => typeof value === 'string' && value.trim()) : [];
  try {
    if (!examples.length && !deletedProvided.length) {
      const res = await fetch(url, { method: 'DELETE' });
      if (!responseLooksLikeJson(res)) {
        reportMissingExamplesApi(res && res.status);
        return;
      }
      if (res.ok || res.status === 404) {
        backendEntriesCache.delete(path);
        setStatusMessage('', '');
        applyStoreModeFromResponse(res);
      } else {
        setStatusMessage(`Kunne ikke fjerne eksempelet «${path}» fra serveren.`, 'error');
      }
      return;
    }
    const payload = {
      path,
      examples,
      deletedProvided,
      updatedAt: new Date().toISOString()
    };
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!responseLooksLikeJson(response)) {
      reportMissingExamplesApi(response && response.status);
      return;
    }
    if (!response.ok) {
      setStatusMessage(`Kunne ikke lagre endringene for «${path}» på serveren.`, 'error');
      return;
    }
    let persisted = null;
    try {
      persisted = await response.json();
    } catch (error) {
      persisted = null;
    }
    if (persisted && typeof persisted === 'object') {
      updateBackendCache(path, persisted);
    } else {
      updateBackendCache(path, payload);
    }
    setStatusMessage('', '');
    applyStoreModeFromResponse(response, persisted);
  } catch (error) {
    setStatusMessage(`Kunne ikke lagre endringene for «${path}» på serveren.`, 'error');
  }
}
function rememberExampleSelection(path, index, example) {
  if (typeof window === 'undefined') return;
  const canonicalPath = normalizePath(path);
  const request = {
    path,
    canonicalPath,
    index,
    createdAt: new Date().toISOString()
  };
  try {
    const identifier = `${canonicalPath || path || ''}#${Date.now()}_${Math.random().toString(16).slice(2)}`;
    request.requestId = identifier;
  } catch (error) {}
  if (example && typeof example === 'object') {
    let payload = null;
    try {
      payload = JSON.parse(JSON.stringify(example));
    } catch (error) {
      payload = null;
    }
    if (!payload || typeof payload !== 'object') {
      payload = {
        config: example && typeof example.config === 'object' ? example.config : {},
        description: typeof example.description === 'string' ? example.description : '',
        svg: typeof example.svg === 'string' ? example.svg : ''
      };
      if (typeof example.exampleNumber === 'string') {
        payload.exampleNumber = example.exampleNumber;
      }
    }
    request.example = payload;
  }
  try {
    window.localStorage.setItem('archive_open_request', JSON.stringify(request));
  } catch (error) {}
  try {
    window.localStorage.setItem('example_to_load', JSON.stringify({ path, index }));
  } catch (error) {}
  try {
    window.localStorage.setItem('currentPage', path);
  } catch (error) {}
}
async function fetchBackendEntries() {
  if (!examplesApiBase) {
    setStatusMessage('Lagringstjenesten for eksempler er ikke konfigurert.', 'error');
    return null;
  }
  const url = buildExamplesApiUrl(examplesApiBase);
  if (!url) {
    setStatusMessage('Fant ikke adressen til eksempellageret.', 'error');
    return null;
  }
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });
  } catch (error) {
    setStatusMessage('Kunne ikke hente eksempler fra serveren.', 'error');
    return null;
  }
  if (!responseLooksLikeJson(res)) {
    reportMissingExamplesApi(res && res.status);
    return null;
  }
  if (!res.ok) {
    if (res.status === 404) {
      reportMissingExamplesApi(res.status);
    } else {
      setStatusMessage(`Serveren svarte med ${res.status}.`, 'error');
    }
    return null;
  }
  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    setStatusMessage('Kunne ikke tolke svaret fra serveren.', 'error');
    return null;
  }
  setStatusMessage('', '');
  applyStoreModeFromResponse(res, data);
  const entries = Array.isArray(data && data.entries) ? data.entries : [];
  const normalized = [];
  entries.forEach(item => {
    if (!item || typeof item !== 'object') return;
    const path = normalizePath(item.path);
    if (!path) return;
    const examples = Array.isArray(item.examples) ? item.examples : [];
    const deletedProvided = Array.isArray(item.deletedProvided) ? item.deletedProvided.filter(value => typeof value === 'string' && value.trim()) : [];
    const entry = {
      path,
      examples,
      deletedProvided,
      updatedAt: item.updatedAt || null
    };
    updateBackendCache(path, entry);
    if (examples.length) {
      normalized.push({
        path,
        examples
      });
    }
  });
  return normalized;
}
async function renderExamples(options) {
  const container = document.getElementById('examples');
  if (!container) return;
  const skipBackend = options && options.skipBackend;
  if (!skipBackend) {
    await fetchBackendEntries();
  }
  const sections = [];
  backendEntriesCache.forEach(entry => {
    if (!entry || !Array.isArray(entry.examples) || entry.examples.length === 0) return;
    sections.push({
      path: entry.path,
      examples: entry.examples.slice()
    });
  });
  sections.sort((a, b) => a.path.localeCompare(b.path));
  container.innerHTML = '';
  let descriptionRendererPromise = null;
  let rendererLoadFailed = false;
  const ensureRendererPromise = () => {
    if (rendererLoadFailed) return null;
    if (!descriptionRendererPromise) {
      descriptionRendererPromise = ensureDescriptionRendererLoaded();
    }
    return descriptionRendererPromise;
  };
  const appendDescription = async (wrap, text, beforeNode) => {
    if (!wrap || typeof text !== 'string') return;
    const trimmed = text.trim();
    if (!trimmed) return;
    const description = document.createElement('div');
    description.className = 'example-description example-description-preview';
    description.style.margin = '0 0 8px';
    description.classList.add('math-vis-description-rendered');
    if (!rendererLoadFailed) {
      try {
        const promise = ensureRendererPromise();
        const renderer = promise ? await promise : null;
        if (renderer && typeof renderer.renderInto === 'function') {
          const hasContent = renderer.renderInto(description, text);
          if (hasContent) {
            if (beforeNode && typeof wrap.insertBefore === 'function') {
              wrap.insertBefore(description, beforeNode);
            } else {
              wrap.appendChild(description);
            }
            return;
          }
          return;
        }
        rendererLoadFailed = true;
        descriptionRendererPromise = null;
      } catch (error) {
        rendererLoadFailed = true;
        descriptionRendererPromise = null;
      }
    }
    if (!rendererLoadFailed) return;
    description.textContent = text;
    description.style.whiteSpace = 'pre-wrap';
    if (beforeNode && typeof wrap.insertBefore === 'function') {
      wrap.insertBefore(description, beforeNode);
    } else {
      wrap.appendChild(description);
    }
  };
  for (const sectionData of sections) {
    const { path, examples } = sectionData;
    if (!Array.isArray(examples) || examples.length === 0) continue;
    const section = document.createElement('section');
    const h2 = document.createElement('h2');
    h2.textContent = path;
    section.appendChild(h2);
    for (let idx = 0; idx < examples.length; idx++) {
      const ex = examples[idx];
      const wrap = document.createElement('div');
      wrap.className = 'example';
      const iframe = document.createElement('iframe');
      iframe.setAttribute('loading', 'lazy');
      iframe.title = `Eksempel ${idx + 1} – ${path}`;
      try {
        const url = new URL(path, window.location.href);
        url.searchParams.set('example', String(idx + 1));
        iframe.src = url.href;
      } catch (error) {
        const sep = path.includes('?') ? '&' : '?';
        iframe.src = `${path}${sep}example=${idx + 1}`;
      }
      wrap.appendChild(iframe);
      if (ex && typeof ex.description === 'string') {
        appendDescription(wrap, ex.description, iframe).catch(() => {});
      }
      const btns = document.createElement('div');
      btns.className = 'buttons';
      const loadBtn = document.createElement('button');
      loadBtn.textContent = 'Last inn';
      loadBtn.addEventListener('click', () => {
        rememberExampleSelection(path, idx, ex);
        try {
          const parentWindow = window.parent;
          if (!parentWindow || parentWindow === window) {
            return;
          }
          let iframeEl = null;
          try {
            iframeEl = parentWindow.document && typeof parentWindow.document.querySelector === 'function'
              ? parentWindow.document.querySelector('iframe')
              : null;
          } catch (_) {
            iframeEl = null;
          }
          if (iframeEl) {
            iframeEl.src = path;
          }
          if (typeof parentWindow.setActive === 'function') {
            parentWindow.setActive(path);
          }
        } catch (_) {}
      });
      const delBtn = document.createElement('button');
      delBtn.textContent = 'Slett';
      delBtn.addEventListener('click', async () => {
        const cached = getCachedEntry(path);
        const updated = Array.isArray(cached.examples) ? cached.examples.slice() : examples.slice();
        const removed = updated.splice(idx, 1);
        const deletedProvided = Array.isArray(cached.deletedProvided) ? cached.deletedProvided.slice() : [];
        const builtinKey = removed && removed.length ? removed[0] && removed[0].__builtinKey : null;
        if (typeof builtinKey === 'string') {
          const normalized = builtinKey.trim();
          if (normalized && !deletedProvided.includes(normalized)) {
            deletedProvided.push(normalized);
          }
        }
        if (updated.length || deletedProvided.length) {
          updateBackendCache(path, {
            path,
            examples: updated,
            deletedProvided
          });
        } else {
          backendEntriesCache.delete(path);
        }
        await persistBackendEntry(path, {
          examples: updated,
          deletedProvided
        });
        renderExamples({ skipBackend: true });
      });
      btns.appendChild(loadBtn);
      btns.appendChild(delBtn);
      wrap.appendChild(btns);
      section.appendChild(wrap);
    }
    container.appendChild(section);
  }
}
document.addEventListener('DOMContentLoaded', () => {
  setStatusMessage('', '');
  renderExamples();
});
