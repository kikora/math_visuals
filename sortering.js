import {
  buildFigureData,
  CUSTOM_CATEGORY_ID,
  measurementFigureManifest,
  createFigurePickerHelpers,
  loadFigureLibrary as loadMeasurementFigureLibrary
} from './figure-library/all.js';

const FIGURE_LIBRARY_APP_KEY = 'sortering';

(async function () {
  const globalObj = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  const doc = globalObj && globalObj.document ? globalObj.document : null;
  if (!globalObj || !doc) return;
  const root = doc.documentElement || null;

  const SORTERING_FALLBACK_PALETTE = ['#ffffff', '#000000', '#000000'];

  let storageWarningMessage = '';
  let storageWarningEl = null;

  function normalizeStorageModeValue(value) {
    if (typeof value !== 'string') {
      return '';
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return '';
    }
    if (normalized === 'kv' || normalized === 'vercel-kv') {
      return 'kv';
    }
    if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') {
      return 'memory';
    }
    return normalized;
  }

  function resolveStorageWarningMessage(metadata) {
    const source = metadata && typeof metadata === 'object' ? metadata : {};
    const mode = normalizeStorageModeValue(source.storageMode || source.mode || source.storage);
    const limitation = typeof source.limitation === 'string' ? source.limitation.trim() : '';
    if (limitation) {
      return limitation;
    }
    const persistent = source.persistent === true;
    const ephemeral = source.ephemeral === true;
    if (persistent || mode === 'kv') {
      return '';
    }
    if (ephemeral || mode === 'memory' || !mode) {
      return 'Figurbiblioteket bruker midlertidig lagring. Endringer kan gå tapt ved omstart.';
    }
    return '';
  }

  function applySorteringPalette() {
    if (!root || !root.style) return;
    const [background, outline, text] = SORTERING_FALLBACK_PALETTE;
    root.style.setProperty('--sortering-item-background', background);
    root.style.setProperty('--sortering-item-outline', outline);
    root.style.setProperty('--sortering-item-text', text);
  }

  applySorteringPalette();

  function getDescriptionRenderer() {
    if (!globalObj || typeof globalObj !== 'object') {
      return null;
    }
    const renderer = globalObj.MathVisDescriptionRenderer;
    return renderer && typeof renderer === 'object' ? renderer : null;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STATUS_SAMPLE_COUNT = 3;
  const AUTO_LABEL_PROP = '__sorteringAutoFigureLabel';
  const AUTO_ALT_PROP = '__sorteringAutoFigureAlt';

  let statusSnapshot = null;
  const statusListeners = new Set();

  let exportCard = null;
  let altTextManager = null;
  let altTextSvg = null;

  let checkButton = null;
  let checkStatus = null;
  let taskCheckHost = null;
  let taskCheckControls = [];
  let settingsForm = null;
  let directionSelect = null;
  let gapInput = null;
  let hideOutlineInput = null;
  let addItemButton = null;
  let validationStatusEl = null;
  let saveExampleButton = null;
  let updateExampleButton = null;
  let deleteExampleButton = null;

  function ensureStringArray(list) {
    if (!Array.isArray(list)) return [];
    return list
      .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(entry => entry);
  }

  function isSorted(order, reference) {
    const a = ensureStringArray(order);
    const b = ensureStringArray(reference);
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  function firstN(order, count = STATUS_SAMPLE_COUNT) {
    const arr = ensureStringArray(order);
    const size = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : STATUS_SAMPLE_COUNT;
    const limit = Math.min(arr.length, size);
    return arr.slice(0, limit);
  }

  function lastN(order, count = STATUS_SAMPLE_COUNT) {
    const arr = ensureStringArray(order);
    const size = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : STATUS_SAMPLE_COUNT;
    if (size === 0) return [];
    const limit = Math.min(arr.length, size);
    return arr.slice(arr.length - limit);
  }

  function almost(order, reference) {
    const current = ensureStringArray(order);
    const expected = ensureStringArray(reference);
    const total = expected.length;
    const comparisons = Math.min(current.length, expected.length);
    const mismatches = [];
    let matches = 0;
    for (let i = 0; i < comparisons; i += 1) {
      const actualId = current[i];
      const expectedId = expected[i];
      if (actualId === expectedId) {
        matches += 1;
      } else {
        mismatches.push({ index: i, actual: actualId || null, expected: expectedId || null });
      }
    }
    for (let i = comparisons; i < expected.length; i += 1) {
      mismatches.push({ index: i, actual: null, expected: expected[i] || null });
    }
    for (let i = expected.length; i < current.length; i += 1) {
      mismatches.push({ index: i, actual: current[i] || null, expected: null });
    }
    const fraction = total > 0 ? matches / total : 1;
    const percent = total > 0 ? Math.round(fraction * 100) : 100;
    return {
      matches,
      total,
      fraction,
      percent,
      mismatches
    };
  }

  function cloneAlmostResult(result) {
    if (!result || typeof result !== 'object') {
      return { matches: 0, total: 0, fraction: 0, percent: 0, mismatches: [] };
    }
    const mismatches = Array.isArray(result.mismatches)
      ? result.mismatches.map(entry => ({
          index: Number.isFinite(entry.index) ? entry.index : -1,
          actual: typeof entry.actual === 'string' ? entry.actual : entry.actual == null ? null : String(entry.actual),
          expected:
            typeof entry.expected === 'string' ? entry.expected : entry.expected == null ? null : String(entry.expected)
        }))
      : [];
    return {
      matches: Number.isFinite(result.matches) ? result.matches : 0,
      total: Number.isFinite(result.total) ? result.total : 0,
      fraction: Number.isFinite(result.fraction) ? result.fraction : 0,
      percent: Number.isFinite(result.percent) ? result.percent : 0,
      mismatches
    };
  }

  function getCurrentOrder() {
    return Array.isArray(currentOrder) ? currentOrder.slice() : [];
  }

  function getBaseOrder() {
    if (!state) return [];
    const sanitized = sanitizeOrder(state.items, state.order);
    if (state && Array.isArray(state.order)) {
      const differs = sanitized.length !== state.order.length || sanitized.some((id, index) => state.order[index] !== id);
      if (differs) {
        state.order = sanitized.slice();
      }
    }
    return sanitized;
  }

  function commitCurrentOrderToState() {
    if (!state) return;
    if (!isEditorMode()) return;
    state.order = sanitizeOrder(state.items, currentOrder);
  }

  function buildExampleConfigPayload() {
    const defaults = {
    items: [],
    order: [],
    config: {
      direction: DEFAULT_STATE.retning,
      gap: DEFAULT_STATE.gap,
      hideOutline: DEFAULT_STATE.hideOutline,
      randomize: true
    }
  };
    if (!state) return defaults;
    return {
      items: state.items.map(cloneItem),
      order: sanitizeOrder(state.items, state.order),
      config: {
        direction: normalizeDirection(state.retning),
        gap: Number.isFinite(state.gap) ? state.gap : DEFAULT_STATE.gap,
        hideOutline: !!state.hideOutline,
        randomize: true
      }
    };
  }

  function stringifyExamplePayload(payload) {
    try {
      return JSON.stringify(payload);
    } catch (error) {
      if (globalObj && globalObj.console && typeof globalObj.console.warn === 'function') {
        globalObj.console.warn('mathVisSortering: failed to stringify example payload', error);
      }
      return '';
    }
  }

  function updateExampleActionPayloads(payload) {
    const targetPayload = payload || buildExampleConfigPayload();
    const json = stringifyExamplePayload(targetPayload);
    const buttons = [saveExampleButton, updateExampleButton, deleteExampleButton].filter(Boolean);
    if (!buttons.length) return;
    buttons.forEach(button => {
      if (!button.dataset) return;
      if (json) {
        button.dataset.examplePayload = json;
        button.dataset.examplePayloadType = 'sortering';
      } else {
        delete button.dataset.examplePayload;
        delete button.dataset.examplePayloadType;
      }
    });
  }

  function syncExampleBindings() {
    if (!globalObj) return;
    if (!globalObj.STATE || typeof globalObj.STATE !== 'object') {
      globalObj.STATE = {};
    }
    globalObj.STATE.sortering = state;
    if (!globalObj.CONFIG || typeof globalObj.CONFIG !== 'object') {
      globalObj.CONFIG = {};
    }
    const payload = buildExampleConfigPayload();
    globalObj.CONFIG.sortering = payload;
    updateExampleActionPayloads(payload);
  }

  function computeStatusSnapshot() {
    const order = getCurrentOrder();
    const baseOrder = getBaseOrder();
    const sorted = isSorted(order, baseOrder);
    const almostResult = cloneAlmostResult(almost(order, baseOrder));
    const firstSegment = firstN(order, STATUS_SAMPLE_COUNT);
    const lastSegment = lastN(order, STATUS_SAMPLE_COUNT);
    return {
      timestamp: Date.now(),
      order,
      baseOrder,
      sorted,
      almost: almostResult,
      firstN: firstSegment,
      lastN: lastSegment
    };
  }

  function cloneSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    return {
      timestamp: snapshot.timestamp,
      order: Array.isArray(snapshot.order) ? snapshot.order.slice() : [],
      baseOrder: Array.isArray(snapshot.baseOrder) ? snapshot.baseOrder.slice() : [],
      sorted: !!snapshot.sorted,
      almost: cloneAlmostResult(snapshot.almost),
      firstN: Array.isArray(snapshot.firstN) ? snapshot.firstN.slice() : [],
      lastN: Array.isArray(snapshot.lastN) ? snapshot.lastN.slice() : []
    };
  }

  function getItemDisplayLabel(id) {
    if (typeof id !== 'string' || !id) return '';
    const item = itemsById.get(id);
    if (!item) return id;
    const candidates = [item.label, item.alt, item.description, item.id];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return id;
  }

  function updateFigureDataset(snapshot) {
    if (!figureHost || !snapshot) return;
    figureHost.dataset.sorted = snapshot.sorted ? '1' : '0';
    figureHost.dataset.order = Array.isArray(snapshot.order) ? snapshot.order.join(',') : '';
    if (snapshot.almost && Number.isFinite(snapshot.almost.matches)) {
      figureHost.dataset.matches = String(snapshot.almost.matches);
      figureHost.dataset.total = String(snapshot.almost.total);
      figureHost.dataset.percent = String(snapshot.almost.percent);
    } else {
      delete figureHost.dataset.matches;
      delete figureHost.dataset.total;
      delete figureHost.dataset.percent;
    }
  }

  function updateTaskCheckState(snapshot) {
    if (!snapshot) return;
    if (checkButton) {
      checkButton.dataset.sorted = snapshot.sorted ? '1' : '0';
      if (snapshot.almost && Number.isFinite(snapshot.almost.matches)) {
        checkButton.dataset.matches = String(snapshot.almost.matches);
        checkButton.dataset.total = String(snapshot.almost.total);
      } else {
        delete checkButton.dataset.matches;
        delete checkButton.dataset.total;
      }
    }
    if (checkStatus) {
      checkStatus.dataset.sorted = snapshot.sorted ? '1' : '0';
    }
    if (taskCheckHost) {
      taskCheckHost.dataset.sorted = snapshot.sorted ? '1' : '0';
      taskCheckHost.dataset.order = Array.isArray(snapshot.order) ? snapshot.order.join(',') : '';
      if (snapshot.almost && Number.isFinite(snapshot.almost.matches)) {
        taskCheckHost.dataset.matches = String(snapshot.almost.matches);
        taskCheckHost.dataset.total = String(snapshot.almost.total);
        taskCheckHost.dataset.percent = String(snapshot.almost.percent);
      } else {
        delete taskCheckHost.dataset.matches;
        delete taskCheckHost.dataset.total;
        delete taskCheckHost.dataset.percent;
      }
    }
  }

  function dispatchStatusEvent(snapshot, reason) {
    if (!globalObj || typeof globalObj.dispatchEvent !== 'function' || typeof globalObj.CustomEvent !== 'function') {
      return;
    }
    const detail = cloneSnapshot(snapshot);
    if (!detail) return;
    detail.reason = reason || 'update';
    try {
      globalObj.dispatchEvent(new globalObj.CustomEvent('math-vis-sortering:update', { detail }));
    } catch (_) {}
  }

  function emitStatusToListeners(snapshot, reason) {
    if (!snapshot) return;
    const payload = cloneSnapshot(snapshot);
    if (!payload) return;
    payload.reason = reason || 'update';
    Array.from(statusListeners).forEach(listener => {
      if (typeof listener !== 'function') return;
      try {
        listener(payload);
      } catch (error) {
        if (globalObj && typeof globalObj.console !== 'undefined' && typeof globalObj.console.error === 'function') {
          globalObj.console.error('mathVisSortering listener error', error);
        }
      }
    });
  }

  function getStatusSnapshot(forceRecompute = false) {
    if (forceRecompute || !statusSnapshot) {
      statusSnapshot = computeStatusSnapshot();
    }
    return statusSnapshot;
  }

  function getStatusSnapshotClone(forceRecompute = false) {
    return cloneSnapshot(getStatusSnapshot(forceRecompute));
  }

  function notifyStatusChange(reason) {
    const snapshot = getStatusSnapshot(true);
    syncExampleBindings();
    updateFigureDataset(snapshot);
    updateTaskCheckState(snapshot);
    clearCheckStatus();
    emitStatusToListeners(snapshot, reason);
    dispatchStatusEvent(snapshot, reason);
    refreshAltText(reason, snapshot);
  }

  function registerMathVisApi() {
    if (!globalObj) return null;
    const existing = globalObj.mathVisSortering && typeof globalObj.mathVisSortering === 'object' ? globalObj.mathVisSortering : null;
    const api = existing || {};
    api.getState = () => getStatusSnapshotClone();
    api.isSorted = (order, reference) => {
      const current = Array.isArray(order) ? order : getCurrentOrder();
      const base = Array.isArray(reference) ? reference : getBaseOrder();
      return isSorted(current, base);
    };
    api.firstN = (order, count) => {
      const current = Array.isArray(order) ? order : getCurrentOrder();
      return firstN(current, count);
    };
    api.lastN = (order, count) => {
      const current = Array.isArray(order) ? order : getCurrentOrder();
      return lastN(current, count);
    };
    api.almost = (order, reference) => {
      const current = Array.isArray(order) ? order : getCurrentOrder();
      const base = Array.isArray(reference) ? reference : getBaseOrder();
      return cloneAlmostResult(almost(current, base));
    };
    api.onChange = callback => {
      if (typeof callback !== 'function') return () => {};
      statusListeners.add(callback);
      if (statusSnapshot) {
        try {
          const payload = cloneSnapshot(statusSnapshot);
          if (payload) {
            payload.reason = 'listener-init';
            callback(payload);
          }
        } catch (error) {
          if (globalObj && globalObj.console && typeof globalObj.console.error === 'function') {
            globalObj.console.error('mathVisSortering onChange init error', error);
          }
        }
      }
      return () => {
        statusListeners.delete(callback);
      };
    };
    api.offChange = callback => {
      if (typeof callback !== 'function') return;
      statusListeners.delete(callback);
    };
    api.subscribe = api.onChange;
    api.unsubscribe = api.offChange;
    globalObj.mathVisSortering = api;
    if (globalObj.mathVisuals && typeof globalObj.mathVisuals === 'object') {
      globalObj.mathVisuals.sortering = api;
    }
    return api;
  }

  function ensureAltTextSvg() {
    if (altTextSvg && altTextSvg.ownerDocument === doc) {
      return altTextSvg;
    }
    if (!figureHost) return null;
    const svg = doc.createElementNS(SVG_NS, 'svg');
    svg.classList.add('sortering__alt-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.position = 'absolute';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.overflow = 'hidden';
    figureHost.appendChild(svg);
    altTextSvg = svg;
    return svg;
  }

  function buildAltText(snapshot) {
    const stateSnapshot = snapshot || getStatusSnapshot();
    if (!stateSnapshot) return '';
    const labels = Array.isArray(stateSnapshot.order)
      ? stateSnapshot.order.map(id => getItemDisplayLabel(id)).filter(Boolean)
      : [];
    const parts = [];
    if (labels.length === 0) {
      parts.push('Ingen elementer er tilgjengelige.');
    } else {
      parts.push(stateSnapshot.sorted ? 'Elementene er sortert.' : 'Elementene er ikke sortert.');
      parts.push(`Rekkefølgen er ${labels.join(', ')}.`);
      if (stateSnapshot.almost && Number.isFinite(stateSnapshot.almost.total) && stateSnapshot.almost.total > 0) {
        parts.push(`${stateSnapshot.almost.matches} av ${stateSnapshot.almost.total} elementer står på riktig plass.`);
      }
    }
    return parts.join(' ');
  }

  function buildAltTextSignature(snapshot) {
    const stateSnapshot = snapshot || getStatusSnapshot();
    if (!stateSnapshot) return '';
    try {
      return JSON.stringify({
        order: Array.isArray(stateSnapshot.order) ? stateSnapshot.order : [],
        sorted: !!stateSnapshot.sorted,
        matches: stateSnapshot.almost ? stateSnapshot.almost.matches : 0,
        total: stateSnapshot.almost ? stateSnapshot.almost.total : 0
      });
    } catch (_) {
      return `${stateSnapshot.sorted ? '1' : '0'}:${Array.isArray(stateSnapshot.order) ? stateSnapshot.order.join('|') : ''}`;
    }
  }

  function ensureAltTextManager() {
    if (altTextManager || !globalObj || !globalObj.MathVisAltText || !exportCard) return;
    const svg = ensureAltTextSvg();
    if (!svg) return;
    altTextManager = globalObj.MathVisAltText.create({
      svg,
      container: exportCard,
      getTitle: () => (doc && doc.title ? doc.title : 'Sortering'),
      getState: () => ({
        text: state && typeof state.altText === 'string' ? state.altText : '',
        source: state && state.altTextSource === 'manual' ? 'manual' : 'auto'
      }),
      setState: (text, source) => {
        if (!state) return;
        state.altText = typeof text === 'string' ? text : '';
        state.altTextSource = source === 'manual' ? 'manual' : 'auto';
      },
      generate: () => buildAltText(),
      getSignature: () => buildAltTextSignature(),
      getAutoMessage: reason =>
        reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
      getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
    });
    if (altTextManager && typeof altTextManager.applyCurrent === 'function') {
      altTextManager.applyCurrent();
    }
  }

  function refreshAltText(reason, snapshot) {
    if (!globalObj || !globalObj.MathVisAltText) return;
    ensureAltTextManager();
    const signature = buildAltTextSignature(snapshot);
    const description = buildAltText(snapshot);
    if (altTextManager && typeof altTextManager.refresh === 'function') {
      altTextManager.refresh(reason || 'auto', signature);
    } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
      altTextManager.notifyFigureChange(signature);
    } else {
      const svg = ensureAltTextSvg();
      if (!svg) return;
      const nodes = globalObj.MathVisAltText.ensureSvgA11yNodes(svg);
      if (nodes && nodes.descEl) {
        nodes.descEl.textContent = description;
      }
      if (nodes && nodes.titleEl) {
        nodes.titleEl.textContent = doc && doc.title ? doc.title : 'Sortering';
      }
    }
  }

  function setCheckStatus(type, heading, detailLines) {
    if (!checkStatus) return;
    if (!type) {
      checkStatus.hidden = true;
      checkStatus.className = 'status';
      checkStatus.textContent = '';
      return;
    }
    checkStatus.hidden = false;
    checkStatus.className = `status status--${type}`;
    checkStatus.textContent = '';
    if (heading) {
      const strong = doc.createElement('strong');
      strong.textContent = heading;
      checkStatus.appendChild(strong);
    }
    if (Array.isArray(detailLines) && detailLines.length) {
      detailLines.forEach(line => {
        if (!line) return;
        const div = doc.createElement('div');
        div.textContent = line;
        checkStatus.appendChild(div);
      });
    }
  }

  function clearCheckStatus() {
    if (!checkStatus || checkStatus.hidden) return;
    setCheckStatus(null);
  }

  function ensureTaskControlsAppended() {
    if (!taskCheckHost) return;
    taskCheckControls.forEach(control => {
      if (control && control.parentElement !== taskCheckHost) {
        taskCheckHost.appendChild(control);
      }
    });
  }

  function applyAppModeToTaskControls(mode) {
    setCurrentAppMode(mode);
    if (!taskCheckHost) return;
    const isTaskMode = currentAppMode === 'task';
    if (isTaskMode) {
      ensureTaskControlsAppended();
      taskCheckHost.hidden = false;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control === checkButton) {
          control.hidden = false;
          if (control.dataset) delete control.dataset.prevHidden;
          return;
        }
        if (control.dataset && 'prevHidden' in control.dataset) {
          const wasHidden = control.dataset.prevHidden === '1';
          delete control.dataset.prevHidden;
          control.hidden = wasHidden;
        }
      });
    } else {
      taskCheckHost.hidden = true;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control.dataset) {
          control.dataset.prevHidden = control.hidden ? '1' : '0';
        }
        control.hidden = true;
      });
    }
  }

  function syncBodyAppMode(mode) {
    if (!doc || !doc.body || !doc.body.dataset) return;
    const normalized = isTaskLikeMode(mode) ? 'task' : typeof mode === 'string' && mode.trim() ? mode.trim() : 'default';
    if (doc.body.dataset.appMode !== normalized) {
      doc.body.dataset.appMode = normalized;
    }
  }

  function getCurrentAppMode() {
    if (typeof globalObj === 'undefined') return 'default';
    const mv = globalObj.mathVisuals;
    if (mv && typeof mv.getAppMode === 'function') {
      try {
        const mode = mv.getAppMode();
        if (typeof mode === 'string' && mode.trim()) {
          return normalizeAppMode(mode);
        }
      } catch (_) {}
    }
    try {
      const params = new URLSearchParams(globalObj.location && globalObj.location.search ? globalObj.location.search : '');
      const fromQuery = params.get('mode');
      if (typeof fromQuery === 'string' && fromQuery.trim()) {
        return isTaskLikeMode(fromQuery) ? 'task' : 'default';
      }
    } catch (_) {}
    return 'default';
  }

  function handleAppModeChanged(event) {
    if (!event || !event.detail || typeof event.detail.mode !== 'string') return;
    syncBodyAppMode(event.detail.mode);
    applyAppModeToTaskControls(event.detail.mode);
  }

  const TASK_APP_ID = 'sortering';
  function getTaskApi() {
    if (!globalObj) return null;
    return globalObj.MathVisualsTaskApi || null;
  }
  function registerTaskAdapter() {
    const taskApi = getTaskApi();
    if (!taskApi || typeof taskApi.registerTaskAdapter !== 'function') return;
    taskApi.registerTaskAdapter(TASK_APP_ID, {
      collectInputs() {
        if (typeof taskApi.evaluateDescriptionInputs === 'function') {
          taskApi.evaluateDescriptionInputs();
        }
      },
      evaluateAnswers() {
        runTaskCheck();
        return null;
      },
      resetAnswers() {
        if (typeof taskApi.resetDescriptionInputs === 'function') {
          taskApi.resetDescriptionInputs();
        }
      }
    });
  }
  registerTaskAdapter();

  function handleCheckButtonClick() {
    const taskApi = getTaskApi();
    if (taskApi && typeof taskApi.evaluateTask === 'function') {
      taskApi.evaluateTask(TASK_APP_ID);
    } else {
      runTaskCheck();
    }
  }

  function runTaskCheck() {
    const snapshot = getStatusSnapshot();
    if (!snapshot) {
      setCheckStatus('info', 'Ingen fasit er definert ennå.');
      return;
    }
    if (!Array.isArray(snapshot.baseOrder) || snapshot.baseOrder.length === 0) {
      setCheckStatus('info', 'Ingen fasit er definert ennå.');
      return;
    }
    if (snapshot.sorted) {
      setCheckStatus('success', 'Riktig rekkefølge!');
      return;
    }
    const details = [];
    if (snapshot.almost && Number.isFinite(snapshot.almost.total) && snapshot.almost.total > 0) {
      details.push(`${snapshot.almost.matches} av ${snapshot.almost.total} elementer står riktig.`);
    }
    setCheckStatus('error', 'Ikke helt riktig ennå.', details);
  }

  registerMathVisApi();

  const ITEM_TYPES = ['text', 'figure'];

  const manualTypeOverrides = new Map();

  function getManualTypeOverride(source) {
    if (!source) return null;
    let id = '';
    if (typeof source === 'string') {
      id = source.trim();
    } else if (typeof source === 'object' && typeof source.id === 'string') {
      id = source.id.trim();
    }
    if (!id) return null;
    const value = manualTypeOverrides.get(id) || null;
    if (value === 'figure' || value === 'text') {
      return value;
    }
    return null;
  }

  function setManualTypeOverride(source, value) {
    if (value !== 'figure' && value !== 'text') return;
    if (!source) return;
    let id = '';
    if (typeof source === 'string') {
      id = source.trim();
    } else if (typeof source === 'object' && typeof source.id === 'string') {
      id = source.id.trim();
    }
    if (!id) return;
    manualTypeOverrides.set(id, value);
  }

  function clearManualTypeOverride(source) {
    if (!source) return;
    let id = '';
    if (typeof source === 'string') {
      id = source.trim();
    } else if (typeof source === 'object' && typeof source.id === 'string') {
      id = source.id.trim();
    }
    if (!id) return;
    manualTypeOverrides.delete(id);
  }

  function ensureTrailingSlash(path) {
    if (typeof path !== 'string') {
      return '';
    }
    const trimmed = path.trim();
    if (!trimmed) {
      return '';
    }
    return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
  }

  const FIGURE_LIBRARY_RELATIVE_BASE_PATH = ensureTrailingSlash(
    measurementFigureManifest && typeof measurementFigureManifest.basePath === 'string'
      ? measurementFigureManifest.basePath
      : ''
  );
  const FIGURE_LIBRARY_RELATIVE_BASE_PATH_WITH_LEADING_SLASH = ensureTrailingSlash(
    FIGURE_LIBRARY_RELATIVE_BASE_PATH.startsWith('/')
      ? FIGURE_LIBRARY_RELATIVE_BASE_PATH
      : `/${FIGURE_LIBRARY_RELATIVE_BASE_PATH}`
  );
  const FIGURE_LIBRARY_RELATIVE_BASE_PATH_WITH_DOT = ensureTrailingSlash(
    FIGURE_LIBRARY_RELATIVE_BASE_PATH.startsWith('./')
      ? FIGURE_LIBRARY_RELATIVE_BASE_PATH
      : `./${FIGURE_LIBRARY_RELATIVE_BASE_PATH}`
  );

  function resolveFigureLibraryBasePath() {
    // VIKTIG: Vi hardkoder stien for å unngå problemer med
    // "doble URL-er" og ruting-feil i nettleseren.
    return '/figure-library/';
  }

  const FIGURE_LIBRARY_BASE_PATH = resolveFigureLibraryBasePath();
  const FIGURE_LIBRARY_BASE_PREFIXES = [
    FIGURE_LIBRARY_BASE_PATH,
    FIGURE_LIBRARY_RELATIVE_BASE_PATH,
    FIGURE_LIBRARY_RELATIVE_BASE_PATH_WITH_LEADING_SLASH,
    FIGURE_LIBRARY_RELATIVE_BASE_PATH_WITH_DOT
  ].filter(prefix => typeof prefix === 'string' && prefix);
  const FIGURE_LIBRARY_BASE_PREFIX_ENTRIES = FIGURE_LIBRARY_BASE_PREFIXES
    .map(prefix => (typeof prefix === 'string' ? prefix.trim() : ''))
    .filter(Boolean)
    .map(prefix => ({ raw: prefix, lower: prefix.toLowerCase() }));

  function buildFigureValueAliases(figure) {
    if (!figure || typeof figure !== 'object') {
      return [];
    }
    const seen = new Set();
    const aliases = [];

    function add(value) {
      if (typeof value !== 'string') {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed || seen.has(trimmed)) {
        return;
      }
      seen.add(trimmed);
      aliases.push(trimmed);
    }

    function addPathVariants(path) {
      if (typeof path !== 'string') {
        return;
      }
      const trimmed = path.trim();
      if (!trimmed) {
        return;
      }
      const normalized = trimmed.replace(/\\/g, '/');
      const variants = [normalized];

      if (!normalized.startsWith('../')) {
        if (normalized.startsWith('./')) {
          const withoutDot = normalized.slice(2);
          if (withoutDot) {
            variants.push(withoutDot);
          }
        } else {
          variants.push(`./${normalized}`);
        }
      }

      if (normalized.startsWith('/')) {
        const withoutLeadingSlash = normalized.slice(1);
        if (withoutLeadingSlash) {
          variants.push(withoutLeadingSlash);
          variants.push(`./${withoutLeadingSlash}`);
        }
      } else {
        variants.push(`/${normalized}`);
      }

      const normalizedLower = normalized.toLowerCase();
      FIGURE_LIBRARY_BASE_PREFIX_ENTRIES.forEach(entry => {
        if (!entry.lower) {
          return;
        }
        if (normalizedLower.startsWith(entry.lower)) {
          const remainder = normalized.slice(entry.raw.length);
          if (remainder) {
            variants.push(remainder);
            if (remainder.startsWith('/')) {
              const withoutLeading = remainder.slice(1);
              if (withoutLeading) {
                variants.push(withoutLeading);
                variants.push(`./${withoutLeading}`);
              }
            } else {
              variants.push(`/${remainder}`);
              variants.push(`./${remainder}`);
            }
          }
        }
      });

      const variantSnapshot = variants.slice();
      variantSnapshot.forEach(candidate => {
        const withoutLeading = candidate.startsWith('/') ? candidate.slice(1) : candidate;
        if (withoutLeading.startsWith('images/')) {
          const afterImages = withoutLeading.slice('images/'.length);
          if (afterImages) {
            variants.push(afterImages);
            variants.push(`./${afterImages}`);
            variants.push(`/${afterImages}`);
          }
        }
      });

      if (/^https?:\/\//i.test(normalized)) {
        try {
          const parsed = new URL(normalized, globalObj && globalObj.location ? globalObj.location.href : undefined);
          const pathname = parsed && typeof parsed.pathname === 'string' ? parsed.pathname : '';
          if (pathname) {
            variants.push(pathname);
            if (pathname.startsWith('/')) {
              const withoutLeading = pathname.slice(1);
              if (withoutLeading) {
                variants.push(withoutLeading);
                variants.push(`./${withoutLeading}`);
              }
            } else {
              variants.push(`/${pathname}`);
              variants.push(`./${pathname}`);
            }
          }
        } catch (_) {
          /* noop */
        }
      }

      variants.forEach(add);
    }

    const slug = typeof figure.slug === 'string' ? figure.slug.trim() : '';
    if (slug) {
      add(slug);
      if (!slug.toLowerCase().endsWith('.svg')) {
        add(`${slug}.svg`);
      }
    }

    const id = typeof figure.id === 'string' ? figure.id.trim() : '';
    if (id && id !== slug) {
      add(id);
      if (!id.toLowerCase().endsWith('.svg')) {
        add(`${id}.svg`);
      }
    }

    const fileName = typeof figure.fileName === 'string' ? figure.fileName.trim() : '';
    if (fileName) {
      add(fileName);
    }

    const imagePath = typeof figure.image === 'string' ? figure.image.trim() : '';
    if (imagePath) {
      addPathVariants(imagePath);
    }

    const assetPath = typeof figure.asset === 'string' ? figure.asset.trim() : '';
    if (assetPath) {
      addPathVariants(assetPath);
    }

    return aliases;
  }

  function sanitizeFigureDataForSortering(source) {
    const categories = [];
    const byId = new Map();
    const byImage = new Map();

    const addToMap = (map, key, figure) => {
      if (!map || !figure) return;
      if (typeof key === 'string' && key.trim()) {
        const trimmed = key.trim();
        if (!map.has(trimmed)) {
          map.set(trimmed, figure);
        }
      }
    };

    const collectFigureIdentifiers = figure => {
      if (!figure || typeof figure !== 'object') {
        return { identifiers: [], imageIdentifiers: [] };
      }
      const identifiers = [];
      const imageIdentifiers = [];
      const seen = new Set();
      const addIdentifier = value => {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed && !seen.has(trimmed)) {
            seen.add(trimmed);
            identifiers.push(trimmed);
          }
        } else if (Number.isFinite(value)) {
          const normalized = `${value}`;
          if (!seen.has(normalized)) {
            seen.add(normalized);
            identifiers.push(normalized);
          }
        }
      };
      const imageSeen = new Set();
      const addImage = value => {
        if (typeof value !== 'string') return;
        const trimmed = value.trim();
        if (!trimmed || imageSeen.has(trimmed)) return;
        imageSeen.add(trimmed);
        imageIdentifiers.push(trimmed);
      };

      addIdentifier(typeof figure.slug === 'string' ? figure.slug : null);
      addIdentifier(typeof figure.id === 'string' ? figure.id : Number.isFinite(figure.id) ? `${figure.id}` : null);
      addIdentifier(typeof figure.fileName === 'string' ? figure.fileName : null);
      addImage(typeof figure.image === 'string' ? figure.image : null);
      addImage(typeof figure.asset === 'string' ? figure.asset : null);

      if (!identifiers.length && imageIdentifiers.length) {
        identifiers.push(imageIdentifiers[0]);
      }

      return { identifiers, imageIdentifiers };
    };

    if (source && Array.isArray(source.categories)) {
      source.categories.forEach(category => {
        if (!category || category.id === CUSTOM_CATEGORY_ID) {
          return;
        }

        const figures = Array.isArray(category.figures) ? category.figures : [];
        const sanitizedFigures = [];

        figures.forEach(figure => {
          const { identifiers, imageIdentifiers } = collectFigureIdentifiers(figure);
          if (!identifiers.length && !imageIdentifiers.length) {
            return;
          }

          const sanitizedFigure = figure && typeof figure === 'object' ? { ...figure } : figure;
          if (sanitizedFigure && typeof sanitizedFigure === 'object') {
            if (typeof sanitizedFigure.id === 'number') {
              sanitizedFigure.id = `${sanitizedFigure.id}`;
            }
            const hasValidId = typeof sanitizedFigure.id === 'string' && sanitizedFigure.id.trim();
            if (!hasValidId && identifiers.length) {
              sanitizedFigure.id = identifiers[0];
            }
          }

          sanitizedFigures.push(sanitizedFigure);

          identifiers.forEach(identifier => {
            addToMap(byId, identifier, sanitizedFigure);
            const lower = typeof identifier === 'string' ? identifier.toLowerCase() : '';
            if (lower && lower !== identifier) {
              addToMap(byId, lower, sanitizedFigure);
            }
          });
          imageIdentifiers.forEach(imageIdentifier => {
            addToMap(byImage, imageIdentifier, sanitizedFigure);
            const lower = typeof imageIdentifier === 'string' ? imageIdentifier.toLowerCase() : '';
            if (lower && lower !== imageIdentifier) {
              addToMap(byImage, lower, sanitizedFigure);
            }
          });
        });

        const sanitizedCategory = {
          ...category,
          figures: sanitizedFigures
        };
        categories.push(sanitizedCategory);
      });
    }

    return {
      categories,
      byId,
      byImage,
      metadata: source ? source.metadata : undefined
    };
  }

  let figureData = null;
  let defaultFigureCategoryId = '';
  let figurePicker = null;

  function applyStorageWarningMetadata(metadata) {
    const message = resolveStorageWarningMessage(metadata);
    storageWarningMessage = message;
    updateStorageWarningDisplay(storageWarningMessage);
  }

  function rebuildFigureLibraryData() {
    const nextData = sanitizeFigureDataForSortering(buildFigureData({ app: FIGURE_LIBRARY_APP_KEY }));
    figureData = nextData;
    defaultFigureCategoryId = (nextData.categories[0] && nextData.categories[0].id) || '';
    figurePicker = createFigurePickerHelpers({
      doc,
      figureData: nextData,
      fallbackCategoryId: defaultFigureCategoryId || CUSTOM_CATEGORY_ID,
      getFigureValue: figure => {
        if (!figure || typeof figure !== 'object') {
          return '';
        }
        const slug = typeof figure.slug === 'string' ? figure.slug.trim() : '';
        if (slug) {
          return slug;
        }
        const id = typeof figure.id === 'string' ? figure.id.trim() : '';
        if (id) {
          return id;
        }
        const fileName = typeof figure.fileName === 'string' ? figure.fileName.trim() : '';
        if (fileName) {
          return fileName;
        }
        const imagePath = typeof figure.image === 'string' ? figure.image.trim() : '';
        if (imagePath) {
          return imagePath;
        }
        const assetPath = typeof figure.asset === 'string' ? figure.asset.trim() : '';
        if (assetPath) {
          return assetPath;
        }
        return '';
      },
      getFigureAliases: buildFigureValueAliases
    });
    applyStorageWarningMetadata(nextData ? nextData.metadata : null);
    return nextData;
  }

  rebuildFigureLibraryData();

  const figureLibraryState = {
    loaded: false,
    loading: null,
    error: false,
    errorMessage: '',
    metadata: figureData ? figureData.metadata : null
  };

  function refreshFigureInlineEditors() {
    if (!itemNodes || typeof itemNodes.forEach !== 'function') {
      return;
    }
    itemNodes.forEach((nodes, id) => {
      if (!nodes || !nodes.inlineEditor || !nodes.inlineEditor.figureList) return;
      const item = itemsById.get(id);
      if (!item || !isFigureItem(item)) return;
      renderInlineEditorFigures(item, nodes.inlineEditor);
    });
  }

  function loadFigureLibrary(options = {}) {
    const { force = false, refresh = false, skipRefresh = false, ...requestOptions } = options || {};
    if (!force && !refresh && figureLibraryState.loaded) {
      return Promise.resolve(figureLibraryState.metadata || null);
    }
    if (figureLibraryState.loading) {
      return figureLibraryState.loading;
    }
    figureLibraryState.error = false;
    figureLibraryState.errorMessage = '';
    const request = loadMeasurementFigureLibrary({
      app: FIGURE_LIBRARY_APP_KEY,
      ...requestOptions,
      force: force || undefined,
      refresh: refresh || undefined
    })
      .then(result => {
        figureLibraryState.loaded = true;
        figureLibraryState.error = false;
        rebuildFigureLibraryData();
        if (!skipRefresh) {
          applyOrder();
        }
        figureLibraryState.metadata = figureData ? figureData.metadata : figureLibraryState.metadata;
        if (!skipRefresh) {
          refreshFigureInlineEditors();
        }
        return result;
      })
      .catch(error => {
        figureLibraryState.error = true;
        figureLibraryState.loaded = false;
        const resolvedMessage = resolveFigureLibraryErrorMessage(error);
        figureLibraryState.errorMessage = resolvedMessage;
        applyStorageWarningMetadata(figureData && figureData.metadata);
        throw error;
      })
      .finally(() => {
        figureLibraryState.loading = null;
      });
    figureLibraryState.loading = request;
    return request;
  }

  function resolveFigureLibraryErrorMessage(error) {
    if (!error) return '';
    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    if (typeof error.statusText === 'string' && error.statusText.trim()) {
      return error.statusText.trim();
    }
    if (error.payload && typeof error.payload.error === 'string' && error.payload.error.trim()) {
      return error.payload.error.trim();
    }
    return '';
  }

  function figureEntryHasContent(entry) {
    if (!entry) return false;
    if (typeof entry === 'string') {
      return !!entry.trim();
    }
    if (typeof entry === 'object') {
      if (typeof entry.value === 'string' && entry.value.trim()) {
        return true;
      }
      if (typeof entry.asset === 'string' && entry.asset.trim()) {
        return true;
      }
    }
    return false;
  }

  function itemHasFigureEntries(source) {
    if (!source || typeof source !== 'object') return false;
    if (Array.isArray(source.figures) && source.figures.some(figureEntryHasContent)) {
      return true;
    }
    if (Array.isArray(source.images) && source.images.some(figureEntryHasContent)) {
      return true;
    }
    if (typeof source.asset === 'string' && source.asset.trim()) {
      return true;
    }
    return false;
  }

  function sanitizeItemType(value, source) {
    const override = getManualTypeOverride(source);
    let normalized = 'text';
    if (typeof value === 'string') {
      const lowered = value.trim().toLowerCase();
      if (ITEM_TYPES.includes(lowered)) {
        normalized = lowered;
      } else if (lowered === 'figur' || lowered === 'figure') {
        normalized = 'figure';
      }
    }
    if (override === 'figure') {
      return 'figure';
    }
    if (itemHasFigureEntries(source)) {
      return 'figure';
    }
    if (override === 'text') {
      return 'text';
    }
    return normalized;
  }

  function determineItemType(source) {
    if (!source || typeof source !== 'object') return 'text';
    if (typeof source.type === 'string') {
      return sanitizeItemType(source.type, source);
    }
    if (Array.isArray(source.figures) && source.figures.length) {
      return 'figure';
    }
    if (Array.isArray(source.images) && source.images.length) {
      return 'figure';
    }
    if (typeof source.format === 'string' && source.format.trim() === 'asset') {
      return 'figure';
    }
    if (typeof source.asset === 'string' && source.asset.trim()) {
      return 'figure';
    }
    return 'text';
  }

  function sanitizeFigureCategory(candidate, value) {
    const resolved = figurePicker.resolveCategoryId(candidate, value);
    return resolved || defaultFigureCategoryId;
  }

  function normalizeFigureEntry(raw, index = 0) {
    if (!raw) return null;
    let value = '';
    let categoryId = defaultFigureCategoryId;
    let id = '';
    if (typeof raw === 'string') {
      value = raw.trim();
    } else if (typeof raw === 'object') {
      if (typeof raw.value === 'string' && raw.value.trim()) {
        value = raw.value.trim();
      } else if (typeof raw.slug === 'string' && raw.slug.trim()) {
        value = raw.slug.trim();
      } else if (typeof raw.asset === 'string' && raw.asset.trim()) {
        value = raw.asset.trim();
      } else if (typeof raw.image === 'string' && raw.image.trim()) {
        value = raw.image.trim();
      }
      if (typeof raw.categoryId === 'string') {
        categoryId = raw.categoryId.trim();
      } else if (typeof raw.category === 'string') {
        categoryId = raw.category.trim();
      } else if (typeof raw.type === 'string') {
        categoryId = raw.type.trim();
      }
      if (typeof raw.id === 'string' && raw.id.trim()) {
        id = raw.id.trim();
      }
    }
    if (!value) return null;
    const normalizedCategory = sanitizeFigureCategory(categoryId, value);
    const figureId = id || `figure-${index + 1}`;
    return { id: figureId, categoryId: normalizedCategory, value };
  }

  function ensureFigureIds(figures, itemId) {
    if (!Array.isArray(figures)) return [];
    const seen = new Set();
    return figures
      .map((entry, index) => {
        const fallbackId = `${itemId || 'item'}-figure-${index + 1}`;
        const normalizedId = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : fallbackId;
        let uniqueId = normalizedId;
        let attempt = 1;
        while (seen.has(uniqueId)) {
          attempt += 1;
          uniqueId = `${normalizedId}-${attempt}`;
        }
        seen.add(uniqueId);
        return {
          id: uniqueId,
          categoryId: sanitizeFigureCategory(entry.categoryId, entry.value),
          value: typeof entry.value === 'string' ? entry.value.trim() : ''
        };
      })
      .filter(entry => entry && typeof entry.id === 'string' && entry.id);
  }

  function normalizeItem(raw, index) {
    const source = raw && typeof raw === 'object' ? raw : {};
    let id = typeof source.id === 'string' && source.id.trim() ? source.id.trim() : '';
    if (!id) {
      id = `item-${index + 1}`;
    }

    const labelCandidates = [source.label, source.alt, source.description, source.text, source.content, source.id];
    let label = '';
    for (const candidate of labelCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        label = candidate.trim();
        break;
      }
    }

    const altCandidates = [source.alt, label, source.description, source.text];
    let alt = '';
    for (const candidate of altCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        alt = candidate.trim();
        break;
      }
    }

    const type = determineItemType(source);
    let text = '';
    let figures = [];
    if (type === 'figure') {
      const figureSources = [];
      if (Array.isArray(source.figures)) {
        figureSources.push(...source.figures);
      }
      if (Array.isArray(source.images)) {
        figureSources.push(...source.images);
      }
      if (typeof source.asset === 'string' && source.asset.trim()) {
        figureSources.push({ value: source.asset.trim() });
      }
      if (typeof source.value === 'string' && source.value.trim()) {
        figureSources.push({ value: source.value.trim(), categoryId: source.categoryId || source.category });
      }
      figures = figureSources
        .map((entry, figureIndex) => normalizeFigureEntry(entry, figureIndex))
        .filter(Boolean);
    } else {
      const textCandidates = [source.description, source.text, source.content, source.label];
      for (const candidate of textCandidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
          text = candidate.trim();
          break;
        }
      }
    }

    return {
      id,
      type,
      text,
      label,
      alt,
      figures: ensureFigureIds(figures, id)
    };
  }

  function ensureItemShape(item, index) {
    if (!item || typeof item !== 'object') return null;
    let type = sanitizeItemType(item.type, item);
    if (type !== 'figure') {
      type = sanitizeItemType(determineItemType(item), item);
    }
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `item-${index + 1}`;
    const label = typeof item.label === 'string' ? item.label : '';
    const alt = typeof item.alt === 'string' ? item.alt : '';
    const text = type === 'text' && typeof item.text === 'string' ? item.text : type === 'text' && typeof item.description === 'string' ? item.description : '';
    const figures = type === 'figure' ? ensureFigureIds(Array.isArray(item.figures) ? item.figures : [], id) : [];
    return { id, type, text, label, alt, figures };
  }

  function buildItems(rawItems) {
    const list = Array.isArray(rawItems) ? rawItems : [];
    const seen = new Set();
    return list.map((entry, index) => {
      const normalized = ensureItemShape(normalizeItem(entry, index), index) || {
        id: `item-${index + 1}`,
        type: 'text',
        text: '',
        label: '',
        alt: '',
        figures: []
      };
      let { id } = normalized;
      if (seen.has(id)) {
        let suffix = 2;
        let candidateId = `${id}-${suffix}`;
        while (seen.has(candidateId)) {
          suffix += 1;
          candidateId = `${id}-${suffix}`;
        }
        normalized.id = candidateId;
        id = candidateId;
      }
      seen.add(id);
      normalized.figures = ensureFigureIds(normalized.figures, normalized.id);
      return normalized;
    });
  }

  function cloneItem(item) {
    if (!item || typeof item !== 'object') return item;
    return {
      id: item.id,
      type: item.type,
      text: item.text,
      label: item.label,
      alt: item.alt,
      figures: Array.isArray(item.figures)
        ? item.figures.map(figure => ({
            id: figure.id,
            categoryId: figure.categoryId,
            value: figure.value
          }))
        : []
    };
  }

  function ensureItemInPlace(item, index) {
    const normalized = ensureItemShape(item, index);
    if (!normalized) return null;
    item.id = normalized.id;
    item.type = normalized.type;
    item.text = normalized.text;
    item.label = normalized.label;
    item.alt = normalized.alt;
    item.figures = normalized.figures;
    return item;
  }

  function isFigureItem(item) {
    return item && item.type === 'figure';
  }

  function isTextItem(item) {
    return item && item.type === 'text';
  }

  function containsKatex(content) {
    if (typeof content !== 'string') return false;
    const text = content.trim();
    if (!text) return false;
    return /\\[a-zA-Z]+|\$\$?|\\\(|\\\[/.test(text);
  }

  function getFigureFromMap(map, key) {
    if (!map || typeof map.get !== 'function') {
      return null;
    }
    try {
      const direct = map.get(key);
      if (direct) {
        return direct;
      }
      if (typeof key === 'string') {
        const lowerKey = key.toLowerCase();
        if (lowerKey !== key) {
          const lowerMatch = map.get(lowerKey);
          if (lowerMatch) {
            return lowerMatch;
          }
        }
        if (typeof map.forEach === 'function') {
          let resolved = null;
          map.forEach((value, mapKey) => {
            if (resolved || typeof mapKey !== 'string') {
              return;
            }
            if (mapKey === key || mapKey.toLowerCase() === lowerKey) {
              resolved = value;
            }
          });
          if (resolved) {
            return resolved;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  function figureMatchesValue(figure, candidate, lowerCandidate) {
    if (!figure || typeof candidate !== 'string') {
      return false;
    }
    const comparisons = [];
    const id = typeof figure.id === 'string' ? figure.id.trim() : '';
    if (id) {
      comparisons.push(id);
    }
    const slug = typeof figure.slug === 'string' ? figure.slug.trim() : '';
    if (slug) {
      comparisons.push(slug);
    }
    const imagePath = typeof figure.image === 'string' ? figure.image.trim() : '';
    if (imagePath) {
      comparisons.push(imagePath);
    }
    const assetPath = typeof figure.asset === 'string' ? figure.asset.trim() : '';
    if (assetPath) {
      comparisons.push(assetPath);
    }
    const fileName = typeof figure.fileName === 'string' ? figure.fileName.trim() : '';
    if (fileName) {
      comparisons.push(fileName);
      const withoutExt = fileName.replace(/\.svg$/i, '');
      if (withoutExt && withoutExt !== fileName) {
        comparisons.push(withoutExt);
      }
    }
    for (const entry of comparisons) {
      if (typeof entry !== 'string') {
        continue;
      }
      const trimmedEntry = entry.trim();
      if (!trimmedEntry) {
        continue;
      }
      if (trimmedEntry === candidate) {
        return true;
      }
      if (lowerCandidate && trimmedEntry.toLowerCase() === lowerCandidate) {
        return true;
      }
    }
    return false;
  }

  function findFigureInData(value) {
    if (!figureData || typeof value !== 'string') {
      return null;
    }
    const lower = value.toLowerCase();
    const fromId = getFigureFromMap(figureData.byId, value);
    if (fromId) {
      return fromId;
    }
    const fromImage = getFigureFromMap(figureData.byImage, value);
    if (fromImage) {
      return fromImage;
    }
    if (Array.isArray(figureData.categories)) {
      for (const category of figureData.categories) {
        if (!category || !Array.isArray(category.figures)) {
          continue;
        }
        for (const figure of category.figures) {
          if (figureMatchesValue(figure, value, lower)) {
            return figure;
          }
        }
      }
    }
    return null;
  }

  function findFigureInManifest(value) {
    if (!measurementFigureManifest || typeof value !== 'string') {
      return null;
    }
    const lower = value.toLowerCase();
    const categories = Array.isArray(measurementFigureManifest.categories)
      ? measurementFigureManifest.categories
      : [];
    for (const category of categories) {
      if (!category || !Array.isArray(category.figures)) {
        continue;
      }
      for (const figure of category.figures) {
        if (figureMatchesValue(figure, value, lower)) {
          return figure;
        }
      }
    }
    return null;
  }

  function resolveFigureAsset(figure) {
    if (!figure || typeof figure !== 'object') {
      return { path: '', hasBasePath: false };
    }
    const imagePath = typeof figure.image === 'string' ? figure.image.trim() : '';
    if (imagePath) {
      return { path: imagePath, hasBasePath: imagePath.startsWith('/') };
    }
    const assetPath = typeof figure.asset === 'string' ? figure.asset.trim() : '';
    if (assetPath) {
      return { path: assetPath, hasBasePath: assetPath.startsWith('/') };
    }
    const fileName = typeof figure.fileName === 'string' ? figure.fileName.trim() : '';
    if (fileName) {
      const baseCandidate = typeof figure.basePath === 'string' && figure.basePath.trim()
        ? figure.basePath.trim()
        : measurementFigureManifest && typeof measurementFigureManifest.basePath === 'string'
          ? measurementFigureManifest.basePath
          : '';
      const basePath = ensureTrailingSlash(baseCandidate);
      const prefix = basePath || '';
      return { path: prefix ? encodeURI(`${prefix}${fileName}`) : encodeURI(fileName), hasBasePath: !!prefix };
    }
    return { path: '', hasBasePath: false };
  }

  function isAbsoluteAssetPath(value) {
    if (typeof value !== 'string' || !value) return false;
    return /^https?:\/\//i.test(value) || value.startsWith('//') || value.startsWith('data:') || value.startsWith('/') || /^blob:/i.test(value) || /^file:/i.test(value);
  }

  // Raw endpoint used to fetch figure assets when no absolute path is provided.
  const FIGURE_LIBRARY_RAW_ENDPOINT = '/api/figure-library/raw';

  function buildRawAssetUrl(slug) {
    const params = new URLSearchParams({ slug });
    return `${FIGURE_LIBRARY_RAW_ENDPOINT}?${params.toString()}`;
  }

  function buildFigureAssetPath(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';

    const option = figurePicker.findOptionByValue(trimmed);
    if (option && option.figure) {
      const resolved = resolveFigureAsset(option.figure);
      if (resolved.path) {
        if (isAbsoluteAssetPath(resolved.path)) {
          return resolved.path;
        }
        return buildRawAssetUrl(resolved.path);
      }
    }

    const fallbackFigure = findFigureInData(trimmed) || findFigureInManifest(trimmed);
    if (fallbackFigure) {
      const resolved = resolveFigureAsset(fallbackFigure);
      if (resolved.path) {
        if (isAbsoluteAssetPath(resolved.path)) {
          return resolved.path;
        }
        return buildRawAssetUrl(resolved.path);
      }
    }

    if (isAbsoluteAssetPath(trimmed)) {
      return trimmed;
    }

    // Use the raw endpoint when the resolved asset path is missing or not absolute.
    return buildRawAssetUrl(trimmed);
  }

  function ensureFigureArray(item) {
    if (!item) return [];
    if (!Array.isArray(item.figures)) {
      item.figures = [];
    }
    item.figures = ensureFigureIds(item.figures, item.id);
    return item.figures;
  }

  function buildFigureDisplayLabel(value, categoryId, match) {
    const option = match || figurePicker.findOptionByValue(value);
    if (option && option.figure) {
      return figurePicker.buildFigureOptionLabel(option.figure);
    }
    if (option && typeof option.label === 'string' && option.label.trim()) {
      return option.label.trim();
    }
    const category = figurePicker.getCategory(categoryId);
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (category && normalizedValue) {
      const categoryLabel = typeof category.label === 'string' && category.label ? category.label : category.id;
      return `${categoryLabel}: ${normalizedValue}`;
    }
    return normalizedValue;
  }

  function autoUpdateItemFigureLabels(item, nextLabel, snapshot = {}) {
    if (!item) return;
    const { initialLabel = '', initialAlt = '' } = snapshot;
    const targetLabel = typeof nextLabel === 'string' ? nextLabel.trim() : '';
    const currentLabel = typeof item.label === 'string' ? item.label.trim() : '';
    const currentAlt = typeof item.alt === 'string' ? item.alt.trim() : '';
    const previousAutoLabel = typeof item[AUTO_LABEL_PROP] === 'string' ? item[AUTO_LABEL_PROP] : '';
    const previousAutoAlt = typeof item[AUTO_ALT_PROP] === 'string' ? item[AUTO_ALT_PROP] : '';

    const shouldUpdateLabel = targetLabel
      ? !currentLabel || currentLabel === initialLabel || (previousAutoLabel && currentLabel === previousAutoLabel)
      : currentLabel === initialLabel || (previousAutoLabel && currentLabel === previousAutoLabel);
    const shouldUpdateAlt = targetLabel
      ? !currentAlt || currentAlt === initialAlt || (previousAutoAlt && currentAlt === previousAutoAlt)
      : currentAlt === initialAlt || (previousAutoAlt && currentAlt === previousAutoAlt);

    if (shouldUpdateLabel) {
      item.label = targetLabel;
      item[AUTO_LABEL_PROP] = targetLabel;
    }
    if (shouldUpdateAlt) {
      item.alt = targetLabel;
      item[AUTO_ALT_PROP] = targetLabel;
    }
  }

  function addFigureToItem(item, defaults = {}) {
    if (!item) return null;
    const figures = ensureFigureArray(item);
    const nextIndex = figures.length;
    const entry = {
      id: `${item.id || 'item'}-figure-${nextIndex + 1}`,
      categoryId: sanitizeFigureCategory(defaults.categoryId, defaults.value),
      value: typeof defaults.value === 'string' ? defaults.value.trim() : ''
    };
    figures.push(entry);
    item.figures = ensureFigureIds(figures, item.id);
    return item.figures[item.figures.length - 1] || null;
  }

  function removeFigureFromItem(item, figureId) {
    if (!item || !Array.isArray(item.figures)) return;
    const index = item.figures.findIndex(entry => entry && entry.id === figureId);
    if (index < 0) return;
    item.figures.splice(index, 1);
    item.figures = ensureFigureIds(item.figures, item.id);
  }

  function sanitizeOrder(items, order) {
    const idSet = new Set(items.map(item => item.id));
    const seen = new Set();
    const result = [];
    if (Array.isArray(order)) {
      order.forEach(id => {
        if (typeof id !== 'string') return;
        if (!idSet.has(id) || seen.has(id)) return;
        seen.add(id);
        result.push(id);
      });
    }
    items.forEach(item => {
      if (seen.has(item.id)) return;
      seen.add(item.id);
      result.push(item.id);
    });
    return result;
  }

  function shuffle(values) {
    const arr = Array.isArray(values) ? values.slice() : [];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function normalizeDirection(value) {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'vertikal' || normalized === 'vertical') {
        return 'vertikal';
      }
    }
    return 'horisontal';
  }

  function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim();
      if (!normalized) return NaN;
      const parsed = Number.parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
  }

  function normalizeGap(value, fallback) {
    const parsed = parseNumber(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(0, parsed);
  }

  function normalizeHideOutline(value) {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'ja' || normalized === 'yes' || normalized === 'on') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'nei' || normalized === 'no' || normalized === 'off') {
        return false;
      }
    }
    return !!value;
  }

  function buildButtonLabel(item, position) {
    if (item && typeof item.label === 'string' && item.label.trim()) {
      return item.label.trim();
    }
    if (isTextItem(item) && typeof item.text === 'string' && item.text.trim()) {
      return item.text.trim();
    }
    if (item && typeof item.alt === 'string' && item.alt.trim()) {
      return item.alt.trim();
    }
    const idx = Number.isFinite(position) ? position + 1 : 0;
    return idx > 0 ? `Element ${idx}` : 'Element';
  }

  const DEFAULT_RAW_ITEMS = [
    { id: 'item-1', type: 'text', text: '\\frac{1}{2}', label: '1/2', alt: 'En halv' },
    { id: 'item-2', type: 'text', text: '\\sqrt{16}', label: '√16', alt: 'Kvadratroten av seksten' },
    { id: 'item-3', type: 'text', text: '7', label: '7', alt: 'Sju' },
    { id: 'item-4', type: 'text', text: '🎲', label: 'Terning', alt: 'Terningillustrasjon' }
  ];

  const DEFAULT_ITEMS = buildItems(DEFAULT_RAW_ITEMS);
  const DEFAULT_STATE = {
    items: DEFAULT_ITEMS.map(cloneItem),
    order: DEFAULT_ITEMS.map(item => item.id),
    retning: 'horisontal',
    gap: 32,
    hideOutline: false,
    randomisering: true,
    altText: '',
    altTextSource: 'auto'
  };

  let state = null;
  let currentOrder = [];
  const itemNodes = new Map();
  const itemsById = new Map();
  const dirtyItemIds = new Set();

  function markItemDirty(itemOrId) {
    if (!itemOrId) return;
    let id = '';
    if (typeof itemOrId === 'string') {
      id = itemOrId.trim();
    } else if (typeof itemOrId === 'object' && typeof itemOrId.id === 'string') {
      id = itemOrId.id.trim();
    }
    if (!id) return;
    dirtyItemIds.add(id);
  }

  function clearDirtyItem(id) {
    if (typeof id !== 'string') return;
    const trimmed = id.trim();
    if (!trimmed) return;
    dirtyItemIds.delete(trimmed);
  }
  let visualList = null;
  let accessibleList = null;
  let figureHost = null;
  let keyboardActiveId = null;
  const keyboardHandlers = new Map();
  let dragState = null;
  let currentAppMode = 'default';
  let emptyStateEl = null;
  let activeInlineEditorId = null;
  let lastInlineEditorDismissId = null;
  let lastInlineEditorDismissAt = 0;

  function handleDocumentPointerDown(event) {
    if (!event) return;
    if (!isEditorMode()) return;
    const activeId = normalizeActiveInlineEditorId();
    if (!activeId) return;
    const nodes = itemNodes.get(activeId) || null;
    const target = event.target || null;
    if (!nodes) {
      deactivateInlineEditor();
      lastInlineEditorDismissId = null;
      lastInlineEditorDismissAt = 0;
      return;
    }
    const { wrapper, inlineEditor } = nodes;
    const nodeTarget = target && typeof target.nodeType === 'number' ? target : null;
    if (!nodeTarget) {
      deactivateInlineEditor();
      lastInlineEditorDismissId = null;
      lastInlineEditorDismissAt = 0;
      return;
    }

    let insideInlineEditor = false;
    if (inlineEditor) {
      const { host, panel } = inlineEditor;
      if (host && typeof host.contains === 'function' && host.contains(nodeTarget)) {
        insideInlineEditor = true;
      } else if (panel && typeof panel.contains === 'function' && panel.contains(nodeTarget)) {
        insideInlineEditor = true;
      }
    }
    if (insideInlineEditor) {
      return;
    }

    if (wrapper && typeof wrapper.contains === 'function' && wrapper.contains(nodeTarget)) {
      lastInlineEditorDismissId = activeId;
      lastInlineEditorDismissAt = typeof event.timeStamp === 'number' ? event.timeStamp : Date.now();
      deactivateInlineEditor();
      return;
    }

    deactivateInlineEditor();
    lastInlineEditorDismissId = null;
    lastInlineEditorDismissAt = 0;
  }

  function normalizeActiveInlineEditorId() {
    if (!activeInlineEditorId || !itemsById.has(activeInlineEditorId)) {
      activeInlineEditorId = null;
    }
    return activeInlineEditorId;
  }

  function isInlineEditorActive(itemId) {
    if (!isEditorMode()) return false;
    const normalizedId = normalizeActiveInlineEditorId();
    return !!normalizedId && normalizedId === itemId;
  }
  function applyItemModeClasses(item, nodes) {
    if (!nodes || !nodes.wrapper) return;
    const isTaskMode = currentAppMode === 'task';
    nodes.wrapper.classList.toggle('sortering__item--task', isTaskMode);
    nodes.wrapper.classList.toggle('sortering__item--task-text', isTaskMode && isTextItem(item));
    if (isTaskMode) {
      nodes.wrapper.style.flex = '1 1 0';
    } else {
      nodes.wrapper.style.flex = '';
    }
  }

  function updateInlineEditorVisibility(nodes, item) {
    if (!nodes) return;
    const editable = isEditorMode();
    const reorderable = canReorderItems();
    const { inlineEditor, wrapper, button, contentEl, li } = nodes;
    const itemId = wrapper && wrapper.dataset ? wrapper.dataset.itemId : null;
    if (!item && itemId && itemsById.has(itemId)) {
      item = itemsById.get(itemId);
    }
    const isActive = editable && itemId && isInlineEditorActive(itemId);

    if (inlineEditor) {
      if (inlineEditor.host) {
        inlineEditor.host.hidden = !isActive;
      }
      if (inlineEditor.panel) {
        inlineEditor.panel.hidden = !isActive;
      }
    }
    if (wrapper) {
      wrapper.classList.toggle('sortering__item--editable', !!isActive);
      wrapper.style.touchAction = currentAppMode === 'task' ? 'none' : 'auto';
      if (itemId && !itemsById.has(itemId) && activeInlineEditorId === itemId) {
        activeInlineEditorId = null;
      }
      if (item) {
        applyItemModeClasses(item, nodes);
      }
    }
    if (contentEl) {
      contentEl.hidden = false;
      if (isActive) {
        contentEl.setAttribute('aria-hidden', 'true');
      } else {
        contentEl.removeAttribute('aria-hidden');
      }
    }
    const disableReorder = !reorderable || !!isActive;
    if (button) {
      button.disabled = disableReorder;
      if (disableReorder) {
        button.setAttribute('aria-disabled', 'true');
        button.setAttribute('data-reorder-disabled', 'true');
      } else {
        button.removeAttribute('aria-disabled');
        button.removeAttribute('data-reorder-disabled');
      }
    }
    if (li) {
      if (disableReorder) {
        li.setAttribute('aria-disabled', 'true');
        li.setAttribute('data-reorder-disabled', 'true');
      } else {
        li.removeAttribute('aria-disabled');
        li.removeAttribute('data-reorder-disabled');
      }
    }
  }
  function refreshItemsById() {
    itemsById.clear();
    if (!state || !Array.isArray(state.items)) return;
    state.items.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const ensured = ensureItemInPlace(item, index);
      if (!ensured || !ensured.id) return;
      itemsById.set(ensured.id, ensured);
    });
    const validIds = new Set(itemsById.keys());
    if (manualTypeOverrides.size) {
      Array.from(manualTypeOverrides.keys()).forEach(id => {
        if (!validIds.has(id)) {
          manualTypeOverrides.delete(id);
        }
      });
    }
    if (dirtyItemIds.size) {
      Array.from(dirtyItemIds).forEach(id => {
        if (!validIds.has(id)) {
          dirtyItemIds.delete(id);
        }
      });
    }
  }

  function refreshAllInlineEditorVisibility() {
    itemNodes.forEach((nodes, id) => {
      const item = itemsById.get(id) || null;
      updateInlineEditorVisibility(nodes, item);
    });
  }

  function finalizeInlineEditor(id) {
    if (!id) return;
    const nodes = itemNodes.get(id);
    if (!nodes || !nodes.inlineEditor) return;
    const { inlineEditor } = nodes;
    if (inlineEditor.textField && doc.activeElement === inlineEditor.textField) {
      inlineEditor.textField.blur();
    }
    if (inlineEditor.textWrapper) {
      setInlineEditorTextMode(inlineEditor, 'preview');
    }
  }

  function deactivateInlineEditor(options = {}) {
    const previousId = normalizeActiveInlineEditorId();
    if (!previousId) return;
    finalizeInlineEditor(previousId);
    activeInlineEditorId = null;
    if (options && options.rebuild) {
      applyOrder({});
    } else {
      const nodes = itemNodes.get(previousId);
      const item = itemsById.get(previousId) || null;
      if (nodes) {
        updateInlineEditorVisibility(nodes, item);
      }
    }
  }

  function activateInlineEditor(id, options = {}) {
    if (!isEditorMode()) return;
    if (!id || !itemsById.has(id)) return;
    const targetId = id;
    const previousId = normalizeActiveInlineEditorId();
    if (previousId && previousId !== targetId) {
      finalizeInlineEditor(previousId);
    }
    activeInlineEditorId = targetId;
    const item = itemsById.get(targetId);
    const nodes = itemNodes.get(targetId);
    if (nodes) {
      ensureInlineEditor(item, nodes);
      updateInlineEditorView(item, nodes.inlineEditor);
    }
    if (previousId && previousId !== targetId) {
      const prevNodes = itemNodes.get(previousId);
      const prevItem = itemsById.get(previousId) || null;
      if (prevNodes) {
        updateInlineEditorVisibility(prevNodes, prevItem);
      }
    }
    if (nodes) {
      updateInlineEditorVisibility(nodes, item);
      if (nodes.inlineEditor && options && options.focusText) {
        if (isTextItem(item)) {
          setInlineEditorTextMode(nodes.inlineEditor, 'edit');
          focusInlineEditorTextField(nodes.inlineEditor);
        } else if (nodes.inlineEditor.typeSelect) {
          try {
            nodes.inlineEditor.typeSelect.focus({ preventScroll: true });
          } catch (_) {
            nodes.inlineEditor.typeSelect.focus();
          }
        }
      }
    }
  }

  function handleGlobalEnterKey(event) {
    if (!event || event.key !== 'Enter' || event.shiftKey) return;
    const activeId = normalizeActiveInlineEditorId();
    if (!activeId) return;
    const target = event.target || null;
    if (target && target.closest && target.closest('.sortering__item-editor')) {
      const tagName = target.tagName ? target.tagName.toLowerCase() : '';
      if (tagName === 'textarea') {
        return;
      }
    }
    setTimeout(() => {
      if (isInlineEditorActive(activeId)) {
        deactivateInlineEditor();
      }
    }, 0);
  }

  function generateItemId() {
    const used = new Set();
    if (state && Array.isArray(state.items)) {
      state.items.forEach(item => {
        if (item && typeof item.id === 'string') {
          used.add(item.id);
        }
      });
    }
    let index = used.size + 1;
    let candidate = `item-${index}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `item-${index}`;
    }
    return candidate;
  }

  function isTaskLikeMode(mode) {
    const normalized = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
    return (
      normalized === 'task' ||
      normalized === 'preview' ||
      normalized === 'forhandsvisning' ||
      normalized === 'forhåndsvisning'
    );
  }

  function normalizeAppMode(mode) {
    if (isTaskLikeMode(mode)) return 'task';
    if (typeof mode !== 'string') return 'default';
    const normalized = mode.trim().toLowerCase();
    return normalized || 'default';
  }

  function isEditorMode() {
    return currentAppMode !== 'task';
  }

  function canReorderItems() {
    const activeId = normalizeActiveInlineEditorId();
    if (activeId) {
      return false;
    }
    return currentAppMode === 'task' || currentAppMode === 'default';
  }

  function shouldRandomizeInCurrentMode() {
    return !!(state && state.randomisering) && currentAppMode === 'task';
  }

  function shouldAllowPointerDrag(event) {
    if (!event) return false;
    if (!canReorderItems()) {
      return false;
    }
    if (typeof event.button === 'number' && event.button !== 0) {
      return false;
    }
    const target = event.target;
    if (!target || typeof target.closest !== 'function') {
      return true;
    }
    if (target.closest('.sortering__item-editor')) {
      return false;
    }
    if (target.closest('[data-drag-ignore="true"]')) {
      return false;
    }
    if (isEditorMode()) {
      if (target.closest('button, input, textarea, select, label, a, [contenteditable="true"], [contenteditable=""]')) {
        return false;
      }
      const roleBlock = target.closest('[role="button"], [role="textbox"], [role="combobox"], [role="listbox"]');
      if (roleBlock) {
        return false;
      }
    }
    return true;
  }

  function updateFigureEditorMode() {
    const editable = isEditorMode();
    if (figureHost) {
      figureHost.dataset.editorMode = editable ? 'edit' : 'view';
    }
    if (visualList) {
      visualList.dataset.mode = currentAppMode;
    }
    if (!canReorderItems()) {
      finalizeKeyboardMode();
    }
    refreshAllInlineEditorVisibility();
  }

  function setCurrentAppMode(mode) {
    const previousMode = currentAppMode;
    currentAppMode = normalizeAppMode(mode);
    syncBodyAppMode(currentAppMode);
    if (currentAppMode === 'task') {
      deactivateInlineEditor();
    }
    updateFigureEditorMode();
    if (previousMode !== currentAppMode) {
      const options = shouldRandomizeInCurrentMode() ? { randomize: true, resetToBase: true } : { resetToBase: true };
      applyOrder(options);
    }
  }

  function ensureItemNodes(item) {
    if (!item || !item.id) return null;
    if (itemNodes.has(item.id)) {
      return itemNodes.get(item.id);
    }
    const wrapper = doc.createElement('div');
    wrapper.className = 'sortering__item';
    wrapper.dataset.itemId = item.id;

    const contentEl = doc.createElement('div');
    contentEl.className = 'sortering__item-content';
    wrapper.appendChild(contentEl);

    const li = doc.createElement('li');
    li.className = 'sortering__skia-item';
    li.dataset.itemId = item.id;

    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'sortering__skia-button';
    button.dataset.itemId = item.id;
    li.appendChild(button);

    const nodes = { wrapper, contentEl, li, button, inlineEditor: null };
    itemNodes.set(item.id, nodes);
    attachItemListeners(item.id, nodes);
    return nodes;
  }

  function focusInlineEditorTextField(inlineEditor) {
    if (!inlineEditor || !inlineEditor.textField) return;
    try {
      inlineEditor.textField.focus({ preventScroll: true });
    } catch (_) {
      inlineEditor.textField.focus();
    }
  }

  function setInlineEditorTextMode(inlineEditor, mode) {
    if (!inlineEditor || !inlineEditor.textWrapper) return;
    const normalized = mode === 'preview' ? 'preview' : 'edit';
    inlineEditor.textWrapper.dataset.mode = normalized;
    if (inlineEditor.preview) {
      const isPreview = normalized === 'preview';
      inlineEditor.preview.setAttribute('aria-hidden', isPreview ? 'false' : 'true');
      inlineEditor.preview.tabIndex = isPreview ? 0 : -1;
    }
  }

  function prepareTextForRenderer(text) {
    if (typeof text !== 'string') return '';
    const trimmed = text.trim();
    if (!trimmed) return '';
    if (/@(?:math|input|table)\s*[{[]/i.test(trimmed)) {
      return trimmed;
    }
    const hasLetter = /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(trimmed);
    const hasDigit = /\d/.test(trimmed);
    const hasOperator = /[+\-*/^_=<>]/.test(trimmed);
    const hasExplicitMath = /\\/.test(trimmed);
    const looksFractionLike = /^[-+]?\d+\s*\/\s*[-+]?\d+$/.test(trimmed);
    const onlyNumericExpression = /^[-+]?\d+(?:[\s+\-*/^_=(),.]*[-+]?\d+)*$/.test(trimmed);
    const variableWithOperators = hasLetter && (hasOperator || hasDigit);
    const simpleFunctionCall =
      hasLetter &&
      !/\s/.test(trimmed) &&
      /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9]*\([^]*\)$/.test(trimmed);
    const looksLikeMath =
      hasExplicitMath ||
      looksFractionLike ||
      onlyNumericExpression ||
      variableWithOperators ||
      simpleFunctionCall;
    if (looksLikeMath) {
      return `@math{${trimmed}}`;
    }
    return text;
  }

  function updateInlineEditorTextPreview(item, inlineEditor) {
    if (!inlineEditor || !inlineEditor.preview) return;
    const preview = inlineEditor.preview;
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    preview.innerHTML = '';
    preview.classList.toggle('sortering__item-editor-preview--empty', !text);
    preview.setAttribute('aria-label', text ? 'Klikk for å redigere tekst' : 'Klikk for å skrive tekst');
    if (!text) {
      preview.textContent = 'Klikk for å skrive tekst';
      return;
    }
    const renderer = getDescriptionRenderer();
    if (renderer && typeof renderer.renderInto === 'function') {
      renderer.renderInto(preview, prepareTextForRenderer(text));
    } else {
      preview.textContent = text;
    }
  }

  function refreshInlineEditorTextMode(item, inlineEditor) {
    updateInlineEditorTextPreview(item, inlineEditor);
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    setInlineEditorTextMode(inlineEditor, text ? 'preview' : 'edit');
  }

  async function renderInlineEditorFigures(item, inlineEditor) {
    if (!inlineEditor || !inlineEditor.figureList) return;
    const listEl = inlineEditor.figureList;
    listEl.textContent = '';

    try {
      await loadFigureLibrary();
    } catch (_) {
      /* noop */
    }

    const figures = ensureFigureArray(item);
    const hasLibraryError = !!figureLibraryState.error;
    const libraryErrorMessage = figureLibraryState.errorMessage || '';
    const initialLabel = typeof item.label === 'string' ? item.label.trim() : '';
    const initialAlt = typeof item.alt === 'string' ? item.alt.trim() : '';
    if (typeof item[AUTO_LABEL_PROP] === 'string' && item[AUTO_LABEL_PROP] && initialLabel && initialLabel !== item[AUTO_LABEL_PROP]) {
      item[AUTO_LABEL_PROP] = '';
    }
    if (typeof item[AUTO_ALT_PROP] === 'string' && item[AUTO_ALT_PROP] && initialAlt && initialAlt !== item[AUTO_ALT_PROP]) {
      item[AUTO_ALT_PROP] = '';
    }

    if (hasLibraryError) {
      const errorMessage = doc.createElement('p');
      errorMessage.className = 'sortering__item-editor-message sortering__item-editor-message--error';
      errorMessage.textContent = libraryErrorMessage
        ? `Kunne ikke laste figurbiblioteket: ${libraryErrorMessage}`
        : 'Kunne ikke laste figurbiblioteket.';
      listEl.appendChild(errorMessage);
    }
    if (!figures.length) {
      const empty = doc.createElement('p');
      empty.className = 'sortering__item-editor-empty';
      empty.textContent = 'Ingen figurer er lagt til ennå.';
      listEl.appendChild(empty);
      return;
    }
    const commitFigureChanges = () => {
      refreshItemsById();
      applyOrder({});
      updateValidationState();
    };
    let didNormalizeFigure = false;
    figures.forEach(figure => {
      if (!figure) return;
      const row = doc.createElement('div');
      row.className = 'sortering__item-editor-figure-row';
      row.dataset.figureId = figure.id;

      const initialMatch = figurePicker.findOptionByValue(figure.value);
      if (initialMatch && figure.value !== initialMatch.value) {
        figure.value = initialMatch.value;
        figure.categoryId = initialMatch.categoryId;
        didNormalizeFigure = true;
      }
      figure.categoryId = figurePicker.resolveCategoryId(figure.categoryId, figure.value);

      const categorySelect = doc.createElement('select');
      const categoryRender = figurePicker.renderCategorySelect(categorySelect, figure.categoryId);
      figure.categoryId = categoryRender.selectedId;

      let figureSelect = null;
      let lastRenderResult = null;

      const renderFigureSelectForRow = () => {
        if (!figureSelect) {
          return null;
        }
        const options = figurePicker.buildFigureOptions(figure.categoryId);
        const hasOptions = options.length > 0;
        const isLoading = !!figureLibraryState.loading && !figureLibraryState.loaded;
        const placeholderLabel = hasOptions
          ? 'Velg figur'
          : hasLibraryError
            ? 'Kunne ikke laste figurer'
            : !figureLibraryState.loaded && isLoading
              ? 'Laster figurer …'
              : figureLibraryState.loaded
                ? 'Ingen figurer'
                : 'Laster figurer …';
        const shouldDisable = isLoading || (!hasOptions && !figureLibraryState.loaded);
        const result = figurePicker.renderFigureSelect(figureSelect, figure.categoryId, figure.value, {
          placeholderLabel,
          disabled: shouldDisable,
          disableWhenEmpty: false,
          options
        });
        figure.categoryId = result.categoryId;
        if (result.match) {
          const normalizedValue = result.match.value;
          if (figure.value !== normalizedValue) {
            didNormalizeFigure = true;
          }
          figure.value = normalizedValue;
          if (categorySelect.value !== figure.categoryId) {
            categorySelect.value = figure.categoryId;
          }
        } else if (!figure.value) {
          figure.value = '';
        }
        return result;
      };

      categorySelect.addEventListener('change', () => {
        const normalizedCategory = figurePicker.resolveCategoryId(categorySelect.value, figure.value);
        if (normalizedCategory !== figure.categoryId) {
          figure.value = '';
        }
        figure.categoryId = normalizedCategory;
        if (figureSelect) {
          lastRenderResult = renderFigureSelectForRow();
        }
        item.type = 'figure';
        setManualTypeOverride(item, 'figure');
        autoUpdateItemFigureLabels(item, '', { initialLabel, initialAlt });
        markItemDirty(item);
        commitFigureChanges();
      });

      figureSelect = doc.createElement('select');
      figureSelect.className = 'sortering__item-editor-figure-select';
      figureSelect.setAttribute('aria-label', 'Figur');

      figureSelect.addEventListener('change', () => {
        const selectedValue = figurePicker.normalizeValue(figureSelect.value);
        if (!selectedValue) {
          figure.value = '';
          lastRenderResult = renderFigureSelectForRow();
          item.type = 'figure';
          setManualTypeOverride(item, 'figure');
          autoUpdateItemFigureLabels(item, '', { initialLabel, initialAlt });
          markItemDirty(item);
          commitFigureChanges();
          return;
        }
        figure.value = selectedValue;
        const selectedMatch = figurePicker.findOptionByValue(selectedValue);
        if (selectedMatch) {
          figure.categoryId = selectedMatch.categoryId;
        } else {
          figure.categoryId = figurePicker.resolveCategoryId(categorySelect.value, selectedValue);
        }
        if (categorySelect.value !== figure.categoryId) {
          categorySelect.value = figure.categoryId;
        }
        lastRenderResult = renderFigureSelectForRow();
        const autoLabel = buildFigureDisplayLabel(
          figure.value,
          figure.categoryId,
          lastRenderResult ? lastRenderResult.match : null
        );
        autoUpdateItemFigureLabels(item, autoLabel, { initialLabel, initialAlt });
        item.type = 'figure';
        setManualTypeOverride(item, 'figure');
        markItemDirty(item);
        commitFigureChanges();
      });

      row.appendChild(categorySelect);
      if (figureSelect) {
        row.appendChild(figureSelect);
        lastRenderResult = renderFigureSelectForRow();
      }
      listEl.appendChild(row);
    });
    if (didNormalizeFigure) {
      commitFigureChanges();
    }
  }

  function updateInlineEditorView(item, inlineEditor) {
    if (!inlineEditor) return;
    const type = isFigureItem(item) ? 'figure' : 'text';
    const isFigure = type === 'figure';
    if (isFigure && typeof item.text === 'string' && item.text) {
      item.text = '';
    }
    if (inlineEditor.typeSelect) {
      inlineEditor.typeSelect.value = type;
    }
    if (!inlineEditor.content) return;

    inlineEditor.content.textContent = '';
    inlineEditor.textField = null;
    inlineEditor.textWrapper = null;
    inlineEditor.preview = null;
    inlineEditor.figureList = null;

    if (type === 'text') {
      const textWrapper = doc.createElement('div');
      textWrapper.className = 'sortering__item-editor-text';
      const textarea = doc.createElement('textarea');
      textarea.className = 'sortering__item-editor-textarea';
      textarea.id = `${item.id}-inline-editor-text`;
      textarea.rows = 2;
      textarea.value = typeof item.text === 'string' ? item.text : '';
      const preview = doc.createElement('div');
      preview.className = 'sortering__item-editor-preview';
      preview.setAttribute('role', 'button');
      textWrapper.appendChild(textarea);
      textWrapper.appendChild(preview);
      inlineEditor.textWrapper = textWrapper;
      inlineEditor.textField = textarea;
      inlineEditor.preview = preview;
      inlineEditor.content.appendChild(textWrapper);

      const commitTextChange = options => {
        const normalized = typeof textarea.value === 'string' ? textarea.value : '';
        item.text = normalized;
        markItemDirty(item);
        refreshItemsById();
        if (!options || options.rebuild !== false) {
          applyOrder({});
        }
        refreshInlineEditorTextMode(item, inlineEditor);
        updateValidationState();
      };

      textarea.addEventListener('focus', () => {
        setInlineEditorTextMode(inlineEditor, 'edit');
      });

      textarea.addEventListener('input', () => {
        item.text = textarea.value;
        markItemDirty(item);
        refreshItemsById();
        updateInlineEditorTextPreview(item, inlineEditor);
        updateValidationState();
      });

      textarea.addEventListener('blur', () => {
        const trimmed = typeof textarea.value === 'string' ? textarea.value.trim() : '';
        if (textarea.value !== trimmed) {
          textarea.value = trimmed;
        }
        commitTextChange();
      });

      textarea.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          textarea.blur();
          setTimeout(() => {
            if (isInlineEditorActive(item.id)) {
              deactivateInlineEditor();
            }
          }, 0);
        }
      });

      preview.addEventListener('click', event => {
        event.preventDefault();
        setInlineEditorTextMode(inlineEditor, 'edit');
        focusInlineEditorTextField(inlineEditor);
      });

      preview.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setInlineEditorTextMode(inlineEditor, 'edit');
          focusInlineEditorTextField(inlineEditor);
        }
      });

      refreshInlineEditorTextMode(item, inlineEditor);
      return;
    }

    const figures = ensureFigureArray(item);
    if (!figures.length) {
      addFigureToItem(item);
    }

    const figureList = doc.createElement('div');
    figureList.className = 'sortering__item-editor-figure-list';
    inlineEditor.content.appendChild(figureList);
    inlineEditor.figureList = figureList;
    renderInlineEditorFigures(item, inlineEditor);
  }

  function ensureInlineEditor(item, nodes) {
    if (!item || !nodes) return;
    if (!nodes.inlineEditor) {
      const host = doc.createElement('div');
      host.className = 'sortering__item-editor';
      host.hidden = !isInlineEditorActive(item.id);

      const panelId = `${item.id}-inline-editor-panel`;
      const panel = doc.createElement('div');
      panel.className = 'sortering__item-editor-panel';
      panel.id = panelId;
      panel.hidden = !isInlineEditorActive(item.id);
      host.appendChild(panel);

      const typeWrapper = doc.createElement('div');
      typeWrapper.className = 'sortering__item-editor-type';
      const typeLabel = doc.createElement('label');
      typeLabel.className = 'sortering__item-editor-label sr-only';
      typeLabel.textContent = 'Innholdstype';
      const typeSelect = doc.createElement('select');
      typeSelect.className = 'sortering__item-editor-select';
      typeSelect.id = `${item.id}-inline-editor-type`;
      typeLabel.setAttribute('for', typeSelect.id);
      const typeOptions = [
        { value: 'text', label: 'Tekst' },
        { value: 'figure', label: 'Figur' }
      ];
      typeOptions.forEach(option => {
        const opt = doc.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        typeSelect.appendChild(opt);
      });
      typeWrapper.appendChild(typeLabel);
      typeWrapper.appendChild(typeSelect);
      panel.appendChild(typeWrapper);

      const content = doc.createElement('div');
      content.className = 'sortering__item-editor-content';
      panel.appendChild(content);

      const updateButton = doc.createElement('button');
      updateButton.type = 'button';
      updateButton.className = 'sortering__item-editor-update';
      updateButton.textContent = 'Oppdater element';
      panel.appendChild(updateButton);

      const removeButton = doc.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'sortering__item-editor-remove';
      removeButton.textContent = 'Fjern element';
      removeButton.setAttribute('aria-label', 'Fjern element');
      panel.appendChild(removeButton);

      nodes.wrapper.appendChild(host);

      nodes.inlineEditor = {
        host,
        panel,
        typeSelect,
        content,
        updateButton,
        removeButton,
        textField: null,
        textWrapper: null,
        preview: null,
        figureList: null
      };

      typeSelect.addEventListener('change', () => {
        const nextType = sanitizeItemType(typeSelect.value, item);
        item.type = nextType;
        markItemDirty(item);
        if (nextType === 'text') {
          clearManualTypeOverride(item);
          item.figures = [];
          if (Array.isArray(item.images)) {
            item.images = [];
          }
          if (item && typeof item === 'object') {
            delete item.asset;
            delete item.format;
          }
        } else if (nextType === 'figure') {
          setManualTypeOverride(item, 'figure');
          item.text = '';
          if (!Array.isArray(item.figures) || !item.figures.length) {
            addFigureToItem(item);
          }
        } else {
          clearManualTypeOverride(item);
        }
        refreshItemsById();
        applyOrder({});
        updateInlineEditorView(item, nodes.inlineEditor);
        updateValidationState();
      });

      updateButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        markItemDirty(item);
        refreshItemsById();
        applyOrder({});
        const valid = updateValidationState();
        if (!valid) {
          if (validationStatusEl && typeof validationStatusEl.focus === 'function') {
            try {
              validationStatusEl.focus({ preventScroll: true });
            } catch (_) {
              validationStatusEl.focus();
            }
          }
          return;
        }
        deactivateInlineEditor();
      });

      removeButton.addEventListener('click', () => {
        removeItem(item.id);
      });
    }

    const inlineEditor = nodes.inlineEditor;
    if (!inlineEditor) return;
    updateInlineEditorView(item, inlineEditor);
    updateInlineEditorVisibility(nodes, item);
  }

  function renderItem(item, position) {
    if (!item) return null;
    const nodes = ensureItemNodes(item);
    if (!nodes) return null;

    const { wrapper, contentEl, li, button } = nodes;
    const label = buildButtonLabel(item, position);
    const accessibleLabel = item && typeof item.alt === 'string' && item.alt.trim() ? item.alt.trim() : label;

    wrapper.dataset.itemId = item.id;
    wrapper.dataset.position = Number.isFinite(position) ? String(position + 1) : '';
    applyItemModeClasses(item, nodes);

    while (contentEl.firstChild) {
      contentEl.removeChild(contentEl.firstChild);
    }

    if (isFigureItem(item)) {
      const figures = ensureFigureArray(item);
      if (figures.length) {
        const list = doc.createElement('div');
        list.className = 'sortering__item-figure-list';
        figures.forEach(figure => {
          if (!figure || !figure.value) return;
          const img = doc.createElement('img');
          img.src = buildFigureAssetPath(figure.value);
          img.alt = accessibleLabel || label || '';
          img.loading = 'lazy';
          img.decoding = 'async';
          img.className = 'sortering__item-image';
          list.appendChild(img);
        });
        if (list.children.length > 0) {
          contentEl.appendChild(list);
        }
      }
      if (!contentEl.firstChild) {
        const placeholder = doc.createElement('p');
        placeholder.className = 'sortering__item-placeholder';
        placeholder.textContent = 'Legg til figurer i redigeringsfeltene.';
        contentEl.appendChild(placeholder);
      }
    } else {
      const descriptionRenderer = getDescriptionRenderer();
      const textContent = typeof item.text === 'string' ? item.text : '';
      if (textContent) {
        const descriptionEl = doc.createElement('div');
        descriptionEl.className = 'sortering__item-description';
        if (descriptionRenderer && typeof descriptionRenderer.renderInto === 'function') {
          descriptionRenderer.renderInto(descriptionEl, prepareTextForRenderer(textContent));
        } else {
          descriptionEl.textContent = textContent;
        }
        contentEl.appendChild(descriptionEl);
      } else if (label) {
        contentEl.textContent = label;
      }
    }

    li.dataset.itemId = item.id;
    li.dataset.position = Number.isFinite(position) ? String(position + 1) : '';

    button.dataset.itemId = item.id;
    button.dataset.position = Number.isFinite(position) ? String(position + 1) : '';
    button.textContent = label;
    if (accessibleLabel && accessibleLabel !== label) {
      button.setAttribute('aria-label', accessibleLabel);
    } else if (accessibleLabel) {
      button.setAttribute('aria-label', accessibleLabel);
    } else {
      button.removeAttribute('aria-label');
    }
    if (accessibleLabel) {
      button.title = accessibleLabel;
    } else {
      button.removeAttribute('title');
    }

    ensureInlineEditor(item, nodes);

    return nodes;
  }

  function syncVisualOrder() {
    if (!visualList) return;
    currentOrder.forEach((id, index) => {
      const nodes = itemNodes.get(id);
      if (!nodes || !nodes.wrapper) return;
      const expectedNode = visualList.children[index];
      if (expectedNode !== nodes.wrapper) {
        visualList.insertBefore(nodes.wrapper, expectedNode || null);
      }
    });
  }

  function syncAccessibleOrder() {
    if (!accessibleList) return;
    const fragment = doc.createDocumentFragment();
    currentOrder.forEach(id => {
      const nodes = itemNodes.get(id);
      if (!nodes || !nodes.li) return;
      fragment.appendChild(nodes.li);
    });
    accessibleList.appendChild(fragment);
  }

  function updateDragPlaceholderPosition(id) {
    if (!dragState || dragState.id !== id) return;
    const { placeholder } = dragState;
    if (!placeholder || !visualList) return;
    const targetIndex = currentOrder.indexOf(id);
    if (targetIndex < 0) return;

    const activeNodes = itemNodes.get(id);
    const activeWrapper = activeNodes && activeNodes.wrapper ? activeNodes.wrapper : null;

    let referenceNode = null;
    for (let i = 0; i < currentOrder.length; i += 1) {
      const candidateId = currentOrder[i];
      if (candidateId === id) continue;
      if (i < targetIndex) continue;
      const candidateNodes = itemNodes.get(candidateId);
      if (!candidateNodes || !candidateNodes.wrapper) continue;
      referenceNode = candidateNodes.wrapper;
      break;
    }

    if (referenceNode) {
      if (placeholder.parentNode !== visualList || placeholder.nextSibling !== referenceNode) {
        visualList.insertBefore(placeholder, referenceNode);
      }
      return;
    }

    if (!activeWrapper) {
      if (placeholder.parentNode !== visualList || placeholder !== visualList.lastElementChild) {
        visualList.appendChild(placeholder);
      }
      return;
    }

    if (placeholder.parentNode !== visualList || placeholder.nextSibling !== activeWrapper) {
      visualList.insertBefore(placeholder, activeWrapper);
    }
  }

  function updateItemPositions() {
    const size = currentOrder.length;
    currentOrder.forEach((id, index) => {
      const nodes = itemNodes.get(id);
      if (!nodes) return;
      const pos = index + 1;
      if (nodes.wrapper) {
        nodes.wrapper.dataset.position = String(pos);
      }
      if (nodes.li) {
        nodes.li.dataset.position = String(pos);
        nodes.li.setAttribute('aria-posinset', String(pos));
        nodes.li.setAttribute('aria-setsize', String(size));
      }
      if (nodes.button) {
        nodes.button.dataset.position = String(pos);
        nodes.button.setAttribute('aria-posinset', String(pos));
        nodes.button.setAttribute('aria-setsize', String(size));
      }
    });

    syncVisualOrder();
    syncAccessibleOrder();
  }

  function snapToSlot(targetId) {
    const ids = typeof targetId === 'string' ? [targetId] : currentOrder.slice();
    ids.forEach(id => {
      const nodes = itemNodes.get(id);
      if (!nodes || !nodes.wrapper) return;
      const { wrapper } = nodes;
      wrapper.style.transition = '';
      wrapper.style.transform = '';
      wrapper.style.width = '';
      wrapper.style.height = '';
      wrapper.style.left = '';
      wrapper.style.top = '';
      wrapper.style.position = '';
      wrapper.style.zIndex = '';
      wrapper.classList.remove('sortering__item--dragging');
    });
  }

  function finalizeKeyboardMode(options = {}) {
    const { restoreFocus = false } = options;
    if (!keyboardActiveId) return;
    const id = keyboardActiveId;
    const nodes = itemNodes.get(id);
    const handler = keyboardHandlers.get(id);
    if (nodes && handler) {
      nodes.button.removeEventListener('keydown', handler);
    }
    keyboardHandlers.delete(id);
    keyboardActiveId = null;
    if (nodes) {
      nodes.wrapper.classList.remove('sortering__item--active');
      nodes.button.classList.remove('sortering__skia-button--active');
      nodes.button.removeAttribute('aria-pressed');
      if (restoreFocus) {
        nodes.button.focus();
      }
    }
  }

  function clearVisualMarkers() {
    finalizeKeyboardMode();
    itemNodes.forEach(nodes => {
      if (nodes.wrapper) {
        nodes.wrapper.classList.remove('sortering__item--dragging');
        nodes.wrapper.classList.remove('sortering__item--active');
      }
      if (nodes.button) {
        nodes.button.classList.remove('sortering__skia-button--active');
        nodes.button.removeAttribute('aria-pressed');
      }
    });
  }

  function moveItemToIndex(id, targetIndex, options = {}) {
    if (!state || !currentOrder.length) return false;
    if (!canReorderItems()) return false;
    const { preserveTransform = false } = options;
    const currentIndex = currentOrder.indexOf(id);
    if (currentIndex < 0) return false;
    const maxIndex = currentOrder.length - 1;
    const boundedIndex = Math.max(0, Math.min(maxIndex, targetIndex));
    if (boundedIndex === currentIndex) return false;
    if (isEditorMode()) {
      deactivateInlineEditor();
    }
    currentOrder.splice(currentIndex, 1);
    currentOrder.splice(boundedIndex, 0, id);

    commitCurrentOrderToState();

    if (preserveTransform) {
      updateDragPlaceholderPosition(id);
    } else {
      updateItemPositions();
      snapToSlot(id);
    }
    notifyStatusChange('move');
    return true;
  }

  function swapWith(id, offset, options = {}) {
    if (!Number.isFinite(offset) || !offset) return false;
    const idx = currentOrder.indexOf(id);
    if (idx < 0) return false;
    return moveItemToIndex(id, idx + offset, options);
  }

  function handleKeyboardInteraction(event, id) {
    if (!state || keyboardActiveId !== id || !canReorderItems()) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const moved = swapWith(id, -1);
      if (moved) {
        snapToSlot();
      }
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const moved = swapWith(id, 1);
      if (moved) {
        snapToSlot();
      }
    } else if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      snapToSlot();
      updateItemPositions();
      finalizeKeyboardMode({ restoreFocus: event.key === 'Enter' });
    }
  }

  function activateKeyboardMode(id) {
    if (!id || !canReorderItems()) return;
    if (keyboardActiveId === id) return;
    finalizeKeyboardMode();
    const nodes = itemNodes.get(id);
    if (!nodes) return;
    keyboardActiveId = id;
    nodes.wrapper.classList.add('sortering__item--active');
    nodes.button.classList.add('sortering__skia-button--active');
    nodes.button.setAttribute('aria-pressed', 'true');
    const handler = event => handleKeyboardInteraction(event, id);
    keyboardHandlers.set(id, handler);
    nodes.button.addEventListener('keydown', handler);
  }

  function collectSwapSlots(activeId, orientation) {
    if (!currentOrder.length) return [];
    const slots = [];
    currentOrder.forEach(candidateId => {
      if (candidateId === activeId) return;
      const candidateNodes = itemNodes.get(candidateId);
      if (!candidateNodes || !candidateNodes.wrapper) return;
      const rect = candidateNodes.wrapper.getBoundingClientRect();
      const size = orientation === 'vertikal' ? rect.height : rect.width;
      const center = orientation === 'vertikal' ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
      slots.push({ id: candidateId, center, size });
    });
    return slots.sort((a, b) => a.center - b.center);
  }

  function determineDragTargetIndex(activeId, pointerCoord, orientation, slotsOverride) {
    const slots = Array.isArray(slotsOverride) ? slotsOverride : collectSwapSlots(activeId, orientation);
    if (!slots.length || !Number.isFinite(pointerCoord)) {
      return 0;
    }
    const gapValue = state && Number.isFinite(state.gap) ? Number(state.gap) : 0;
    const halfGap = gapValue / 2;
    const activeDrag = dragState && dragState.id === activeId ? dragState : null;
    const dragDirection = activeDrag && Number.isFinite(activeDrag.primaryDirection) ? activeDrag.primaryDirection : 0;

    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      const slotStart = slot.center - slot.size / 2;
      const slotEnd = slot.center + slot.size / 2;
      const baseLeft = slotStart + slot.size * 0.25;
      const baseRight = slotEnd - slot.size * 0.25;
      const leftBoundary = baseLeft - halfGap;
      const rightBoundary = baseRight + halfGap;
      const effectiveLeft = Math.min(leftBoundary, rightBoundary);
      const effectiveRight = Math.max(leftBoundary, rightBoundary);

      if (pointerCoord <= effectiveLeft) {
        return i;
      }
      if (pointerCoord <= effectiveRight) {
        if (dragDirection > 0) {
          return i + 1;
        }
        if (dragDirection < 0) {
          return i;
        }
        return pointerCoord >= slot.center ? i + 1 : i;
      }
    }
    return slots.length;
  }

  function getOrderSignature() {
    return currentOrder.join('|');
  }

  function refreshDragSlotCache(orientation) {
    if (!dragState) {
      return [];
    }
    const slots = collectSwapSlots(dragState.id, orientation);
    dragState.slotCache = slots;
    dragState.slotCacheOrientation = orientation;
    dragState.slotCacheSignature = getOrderSignature();
    dragState.slotCacheDirty = false;
    return slots;
  }

  function ensureDragSlotCache(orientation) {
    if (!dragState) {
      return [];
    }
    const signature = getOrderSignature();
    if (
      !Array.isArray(dragState.slotCache) ||
      dragState.slotCacheOrientation !== orientation ||
      dragState.slotCacheSignature !== signature ||
      dragState.slotCacheDirty
    ) {
      return refreshDragSlotCache(orientation);
    }
    return dragState.slotCache;
  }

  function cancelDragMeasurement(targetState) {
    const stateToClear = targetState || dragState;
    if (!stateToClear || stateToClear.measurementHandle == null) {
      return;
    }
    if (stateToClear.measurementHandleType === 'raf' && typeof globalObj.cancelAnimationFrame === 'function') {
      globalObj.cancelAnimationFrame(stateToClear.measurementHandle);
    } else if (stateToClear.measurementHandleType === 'timeout' && typeof globalObj.clearTimeout === 'function') {
      globalObj.clearTimeout(stateToClear.measurementHandle);
    }
    stateToClear.measurementHandle = null;
    stateToClear.measurementHandleType = null;
  }

  function performDragMeasurement() {
    if (!dragState) {
      return;
    }
    const nodes = itemNodes.get(dragState.id);
    if (!nodes || !nodes.wrapper) {
      return;
    }
    const { wrapper } = nodes;
    wrapper.style.transform = '';
    const rect = wrapper.getBoundingClientRect();
    const baseCenterX = rect.left + rect.width / 2;
    const baseCenterY = rect.top + rect.height / 2;
    dragState.baseCenterX = baseCenterX;
    dragState.baseCenterY = baseCenterY;
    const desiredCenterX = dragState.pointerX - dragState.offsetX;
    const desiredCenterY = dragState.pointerY - dragState.offsetY;
    if (!Number.isFinite(desiredCenterX) || !Number.isFinite(desiredCenterY)) {
      wrapper.style.transform = '';
      return;
    }
    const dx = desiredCenterX - baseCenterX;
    const dy = desiredCenterY - baseCenterY;
    dragState.translationX = dx;
    dragState.translationY = dy;
    wrapper.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function scheduleDragMeasurement() {
    if (!dragState || dragState.measurementHandle != null) {
      return;
    }
    const applyMeasurement = () => {
      dragState.measurementHandle = null;
      dragState.measurementHandleType = null;
      if (!dragState) {
        return;
      }
      performDragMeasurement();
    };
    if (typeof globalObj.requestAnimationFrame === 'function') {
      dragState.measurementHandleType = 'raf';
      dragState.measurementHandle = globalObj.requestAnimationFrame(applyMeasurement);
    } else if (typeof globalObj.setTimeout === 'function') {
      dragState.measurementHandleType = 'timeout';
      dragState.measurementHandle = globalObj.setTimeout(applyMeasurement, 16);
    } else {
      applyMeasurement();
    }
  }

  const DRAG_CLICK_THRESHOLD_PX = 4;

  function startPointerDrag(event, id) {
    if (!canReorderItems()) return;
    if (!visualList || dragState || !state) return;
    if (typeof event.button === 'number' && event.button !== 0) return;
    const nodes = itemNodes.get(id);
    if (!nodes || !nodes.wrapper) return;
    const orientation = normalizeDirection(state.retning);
    const wrapper = nodes.wrapper;
    const previousTransform = wrapper.style.transform;
    wrapper.style.transform = '';
    const rect = wrapper.getBoundingClientRect();
    const listRect = visualList.getBoundingClientRect();
    wrapper.style.transform = previousTransform;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const pointerX = Number.isFinite(event.clientX) ? event.clientX : centerX;
    const pointerY = Number.isFinite(event.clientY) ? event.clientY : centerY;

    let placeholder = null;
    if (doc && typeof doc.createElement === 'function') {
      placeholder = doc.createElement('div');
      placeholder.className = 'sortering__item sortering__item--placeholder';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.style.width = `${rect.width}px`;
      placeholder.style.height = `${rect.height}px`;
      if (visualList.contains(wrapper)) {
        visualList.insertBefore(placeholder, wrapper);
        visualList.appendChild(wrapper);
      }
    }

    const relativeLeft = rect.left - listRect.left + (visualList.scrollLeft || 0);
    const relativeTop = rect.top - listRect.top + (visualList.scrollTop || 0);
    wrapper.style.width = `${rect.width}px`;
    wrapper.style.height = `${rect.height}px`;
    wrapper.style.left = `${relativeLeft}px`;
    wrapper.style.top = `${relativeTop}px`;

    dragState = {
      id,
      pointerId: event.pointerId,
      orientation,
      offsetX: pointerX - centerX,
      offsetY: pointerY - centerY,
      baseCenterX: centerX,
      baseCenterY: centerY,
      pointerX,
      pointerY,
      translationX: 0,
      translationY: 0,
      primaryDirection: 0,
      lastPointerCoord: orientation === 'vertikal' ? centerY : centerX,
      lastKnownIndex: currentOrder.indexOf(id),
      measurementHandle: null,
      measurementHandleType: null,
      slotCache: null,
      slotCacheOrientation: null,
      slotCacheSignature: null,
      slotCacheDirty: true,
      placeholder,
      hasExceededDragThreshold: currentAppMode === 'task',
      suppressClick: currentAppMode === 'task'
    };
    refreshDragSlotCache(orientation);
    wrapper.classList.add('sortering__item--dragging');
    wrapper.style.transition = 'none';
    if (typeof wrapper.setPointerCapture === 'function') {
      wrapper.setPointerCapture(event.pointerId);
    }
    const selection = globalObj.getSelection ? globalObj.getSelection() : null;
    if (selection && typeof selection.removeAllRanges === 'function') {
      selection.removeAllRanges();
    }
    finalizeKeyboardMode();
    if (currentAppMode === 'task') {
      event.preventDefault();
    }
  }

  function handlePointerMove(event, id) {
    if (!dragState || dragState.id !== id) return;
    if (event.pointerId !== dragState.pointerId) return;
    const nodes = itemNodes.get(id);
    if (!nodes || !nodes.wrapper) return;
    const wrapper = nodes.wrapper;
    const orientation = dragState.orientation || normalizeDirection(state && state.retning ? state.retning : 'horisontal');

    const pointerX = Number.isFinite(event.clientX) ? event.clientX : dragState.pointerX;
    const pointerY = Number.isFinite(event.clientY) ? event.clientY : dragState.pointerY;
    dragState.pointerX = pointerX;
    dragState.pointerY = pointerY;

    const desiredCenterX = dragState.pointerX - dragState.offsetX;
    const desiredCenterY = dragState.pointerY - dragState.offsetY;
    if (!Number.isFinite(desiredCenterX) || !Number.isFinite(desiredCenterY)) {
      return;
    }

    const baseCenterX = Number.isFinite(dragState.baseCenterX) ? dragState.baseCenterX : desiredCenterX;
    const baseCenterY = Number.isFinite(dragState.baseCenterY) ? dragState.baseCenterY : desiredCenterY;
    const dx = desiredCenterX - baseCenterX;
    const dy = desiredCenterY - baseCenterY;
    dragState.translationX = dx;
    dragState.translationY = dy;

    if (!dragState.hasExceededDragThreshold) {
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq >= DRAG_CLICK_THRESHOLD_PX * DRAG_CLICK_THRESHOLD_PX) {
        dragState.hasExceededDragThreshold = true;
        dragState.suppressClick = true;
      }
    }
    wrapper.style.transform = `translate(${dx}px, ${dy}px)`;

    const pointerCoord = orientation === 'vertikal' ? desiredCenterY : desiredCenterX;
    if (!Number.isFinite(pointerCoord)) return;

    if (dragState) {
      const previousCoord = Number.isFinite(dragState.lastPointerCoord)
        ? dragState.lastPointerCoord
        : pointerCoord;
      const delta = pointerCoord - previousCoord;
      if (Number.isFinite(delta) && Math.abs(delta) > 0.5) {
        dragState.primaryDirection = delta > 0 ? 1 : -1;
      }
      dragState.lastPointerCoord = pointerCoord;
    }

    if (!canReorderItems()) {
      return;
    }

    const slots = ensureDragSlotCache(orientation);
    const targetIndex = determineDragTargetIndex(id, pointerCoord, orientation, slots);
    const currentIndex = Number.isFinite(dragState.lastKnownIndex)
      ? dragState.lastKnownIndex
      : currentOrder.indexOf(id);
    if (targetIndex === currentIndex) {
      return;
    }
    const moved = moveItemToIndex(id, targetIndex, { preserveTransform: true });
    if (moved) {
      dragState.lastKnownIndex = currentOrder.indexOf(id);
      dragState.slotCacheDirty = true;
      dragState.slotCacheSignature = null;
      scheduleDragMeasurement();
    }
  }

  function finishPointerDrag(event, id) {
    if (!dragState || dragState.id !== id) return;
    if (event.pointerId !== dragState.pointerId) return;
    const activeDrag = dragState;
    const nodes = itemNodes.get(id);
    cancelDragMeasurement(dragState);
    dragState = null;
    if (nodes && nodes.wrapper) {
      if (typeof nodes.wrapper.releasePointerCapture === 'function') {
        nodes.wrapper.releasePointerCapture(event.pointerId);
      }
      nodes.wrapper.style.transition = '';
    }
    if (activeDrag && activeDrag.placeholder && activeDrag.placeholder.parentNode === visualList) {
      visualList.removeChild(activeDrag.placeholder);
    }
    snapToSlot(id);
    updateItemPositions();
    clearVisualMarkers();
    if (
      event.type === 'pointerup' &&
      activeDrag &&
      !activeDrag.hasExceededDragThreshold &&
      !activeDrag.suppressClick &&
      isEditorMode()
    ) {
      lastInlineEditorDismissId = null;
      lastInlineEditorDismissAt = 0;
      activateInlineEditor(id, { focusText: true });
    }
    if (
      activeDrag &&
      activeDrag.suppressClick &&
      nodes &&
      nodes.wrapper &&
      nodes.wrapper.dataset
    ) {
      nodes.wrapper.dataset.suppressNextClick = 'true';
    }
  }

  function attachItemListeners(id, nodes) {
    if (!nodes || nodes.wrapper.dataset.listenersAttached === 'true') return;
    nodes.wrapper.dataset.listenersAttached = 'true';
    nodes.wrapper.dataset.suppressNextClick = 'false';
    nodes.wrapper.style.touchAction = currentAppMode === 'task' ? 'none' : 'auto';
    nodes.wrapper.addEventListener('pointerdown', event => {
      if (!canReorderItems()) return;
      if (!shouldAllowPointerDrag(event)) return;
      startPointerDrag(event, id);
    });
    nodes.wrapper.addEventListener('pointermove', event => handlePointerMove(event, id));
    nodes.wrapper.addEventListener('pointerup', event => finishPointerDrag(event, id));
    nodes.wrapper.addEventListener('pointercancel', event => finishPointerDrag(event, id));
    nodes.wrapper.addEventListener('click', event => {
      if (nodes.wrapper.dataset.suppressNextClick === 'true') {
        nodes.wrapper.dataset.suppressNextClick = 'false';
        return;
      }
      if (!isEditorMode()) return;
      if (event.target && event.target.closest('.sortering__item-editor')) {
        return;
      }
      const now = typeof event.timeStamp === 'number' ? event.timeStamp : Date.now();
      const dismissedRecently =
        lastInlineEditorDismissId === id &&
        Number.isFinite(lastInlineEditorDismissAt) &&
        now - lastInlineEditorDismissAt <= 400;
      if (dismissedRecently) {
        lastInlineEditorDismissId = null;
        lastInlineEditorDismissAt = 0;
        return;
      }
      lastInlineEditorDismissId = null;
      lastInlineEditorDismissAt = 0;
      activateInlineEditor(id, { focusText: true });
    });

    nodes.button.addEventListener('click', () => {
      if (!canReorderItems()) return;
      if (keyboardActiveId === id) {
        snapToSlot();
        updateItemPositions();
        finalizeKeyboardMode({ restoreFocus: true });
      } else {
        activateKeyboardMode(id);
      }
    });

    nodes.button.addEventListener('keydown', event => {
      if (!canReorderItems()) return;
      if (event.key === 'Enter' && keyboardActiveId !== id) {
        event.preventDefault();
        activateKeyboardMode(id);
      } else if (event.key === 'Escape' && keyboardActiveId === id) {
        event.preventDefault();
        snapToSlot();
        updateItemPositions();
        finalizeKeyboardMode({ restoreFocus: true });
      }
    });

    nodes.button.addEventListener('focus', () => {
      if (!canReorderItems()) return;
      nodes.wrapper.classList.add('sortering__item--focus');
    });

    nodes.button.addEventListener('blur', () => {
      if (!canReorderItems()) return;
      nodes.wrapper.classList.remove('sortering__item--focus');
      if (keyboardActiveId === id) {
        snapToSlot();
        updateItemPositions();
        finalizeKeyboardMode();
      }
    });

  }

  function applyOrder(options = {}) {
    if (!state) return;

    const sanitizedBase = sanitizeOrder(state.items, state.order);
    if (sanitizedBase.length !== state.order.length) {
      state.order = sanitizedBase;
    }

    let nextOrder = [];
    const randomizeRequested = !!options.randomize;
    const resetRequested = !!options.resetToBase;
    const randomizeAllowed = shouldRandomizeInCurrentMode();
    const shouldRandomize = randomizeRequested && randomizeAllowed;
    const shouldResetToBase =
      resetRequested || (!randomizeAllowed && randomizeRequested) || (!shouldRandomize && currentOrder.length === 0);

    if (shouldRandomize) {
      nextOrder = shuffle(sanitizedBase);
    } else if (shouldResetToBase) {
      nextOrder = sanitizedBase.slice();
    } else {
      nextOrder = sanitizeOrder(state.items, currentOrder);
      if (nextOrder.length !== sanitizedBase.length) {
        nextOrder = sanitizedBase.slice();
      }
    }

    currentOrder = nextOrder;
    const hasVisualList = !!visualList;
    const hasAccessibleList = !!accessibleList;
    const usedIds = new Set();

    if (hasVisualList || hasAccessibleList) {
      currentOrder.forEach((id, index) => {
        const item = itemsById.get(id);
        if (!item) return;
        const nodes = renderItem(item, index);
        if (!nodes) return;
        usedIds.add(id);
        if (hasVisualList && nodes.wrapper) {
          visualList.appendChild(nodes.wrapper);
        }
        if (hasAccessibleList && nodes.li) {
          accessibleList.appendChild(nodes.li);
        }
      });

      itemNodes.forEach((nodes, id) => {
        if (usedIds.has(id)) return;
        if (hasVisualList && nodes.wrapper && nodes.wrapper.parentNode === visualList) {
          visualList.removeChild(nodes.wrapper);
        }
        if (hasAccessibleList && nodes.li && nodes.li.parentNode === accessibleList) {
          accessibleList.removeChild(nodes.li);
        }
      });
    }

    updateItemPositions();
    snapToSlot();
    clearVisualMarkers();
    commitCurrentOrderToState();
    updateEmptyState();
    notifyStatusChange('applyOrder');
  }

  function ensureEmptyStateElement() {
    if (emptyStateEl) return emptyStateEl;
    if (!doc) return null;
    const message = doc.createElement('p');
    message.className = 'sortering__empty-state';
    message.textContent = 'Ingen elementer tilgjengelig. Bruk «+» for å legge til det første.';
    emptyStateEl = message;
    return message;
  }

  function updateEmptyState() {
    if (!visualList) return;
    const hasItems = Array.isArray(currentOrder) && currentOrder.length > 0;
    const placeholder = ensureEmptyStateElement();
    if (!placeholder) return;
    placeholder.hidden = hasItems;
    if (!hasItems && placeholder.parentNode !== visualList) {
      visualList.appendChild(placeholder);
    } else if (hasItems && placeholder.parentNode === visualList) {
      visualList.removeChild(placeholder);
    }
  }

  function updateLayout() {
    if (!visualList || !state) return;
    const direction = normalizeDirection(state.retning);
    state.retning = direction;

    visualList.style.display = 'flex';
    visualList.style.flexWrap = 'nowrap';
    visualList.style.flexDirection = direction === 'vertikal' ? 'column' : 'row';
    visualList.style.alignItems = direction === 'vertikal' ? 'flex-start' : 'stretch';
    visualList.style.gap = `${state.gap}px`;
    visualList.dataset.direction = direction;
    visualList.dataset.hideOutline = state.hideOutline ? 'true' : 'false';

    if (figureHost && !figureHost.classList.contains('sortering__figure')) {
      figureHost.classList.add('sortering__figure');
    }
    if (figureHost) {
      figureHost.dataset.hideOutline = state.hideOutline ? 'true' : 'false';
    }

    if (accessibleList) {
      accessibleList.setAttribute('aria-orientation', direction === 'vertikal' ? 'vertical' : 'horizontal');
    }
  }

  function handleGapChange(event) {
    if (!event || !event.target) return;
    const fallback = DEFAULT_STATE.gap;
    const nextValue = normalizeGap(event.target.value, state ? state.gap : fallback);
    if (!state) return;
    state.gap = Number.isFinite(nextValue) ? nextValue : fallback;
    if (gapInput && doc.activeElement !== gapInput) {
      gapInput.value = String(state.gap);
    } else {
      event.target.value = String(state.gap);
    }
    updateLayout();
    syncSettingsFormFromState();
    notifyStatusChange('settings-change');
  }

  function handleHideOutlineChange(event) {
    if (!state) return;
    const nextValue = !!(event && event.target ? event.target.checked : state.hideOutline);
    state.hideOutline = nextValue;
    if (hideOutlineInput && hideOutlineInput.checked !== nextValue) {
      hideOutlineInput.checked = nextValue;
    }
    updateLayout();
    syncSettingsFormFromState();
    notifyStatusChange('settings-change');
  }

  function syncSettingsFormFromState() {
    if (!state) return;
    const direction = normalizeDirection(state.retning);
    if (directionSelect) {
      directionSelect.value = direction;
    }
    if (gapInput && doc.activeElement !== gapInput) {
      gapInput.value = String(state.gap);
    }
    if (hideOutlineInput && doc.activeElement !== hideOutlineInput) {
      hideOutlineInput.checked = !!state.hideOutline;
    }
  }

  function handleDirectionSelectChange(event) {
    if (!state) return;
    const next = event && event.target ? event.target.value : state.retning;
    state.retning = normalizeDirection(next);
    syncSettingsFormFromState();
    updateLayout();
    notifyStatusChange('settings-change');
  }

  function validateItems() {
    const errors = [];
    const items = state && Array.isArray(state.items) ? state.items : [];
    if (items.length === 0) {
      errors.push('Legg til minst ett element.');
    }
    items.forEach((item, index) => {
      if (!item) return;
      const type = sanitizeItemType(item.type, item);
      if (type === 'figure') {
        const figures = ensureFigureArray(item);
        if (!figures.length) {
          errors.push(`Element ${index + 1} mangler figurer.`);
        }
        figures.forEach((figure, figIndex) => {
          if (!figure || !figure.value || !figure.value.trim()) {
            errors.push(`Figur ${figIndex + 1} i element ${index + 1} mangler verdi.`);
          }
        });
        const alt = typeof item.alt === 'string' ? item.alt.trim() : '';
        if (!alt) {
          errors.push(`Element ${index + 1} mangler alternativ tekst for figurene.`);
        }
      } else {
        const textValue = typeof item.text === 'string' ? item.text.trim() : '';
        if (!textValue) {
          errors.push(`Element ${index + 1} mangler tekst.`);
        }
      }
    });
    return {
      valid: errors.length === 0,
      errors
    };
  }

  function setValidationMessage(messages) {
    if (!validationStatusEl) return;
    if (!messages || (Array.isArray(messages) && messages.length === 0)) {
      validationStatusEl.hidden = true;
      validationStatusEl.textContent = '';
      return;
    }
    const text = Array.isArray(messages) ? messages.join(' ') : String(messages);
    validationStatusEl.hidden = false;
    validationStatusEl.textContent = text;
  }

  function updateValidationState() {
    const { valid, errors } = validateItems();
    setValidationMessage(valid ? null : errors);
    return valid;
  }

  function removeItem(id) {
    if (!state || !Array.isArray(state.items)) return;
    if (activeInlineEditorId === id) {
      deactivateInlineEditor();
    }
    const index = state.items.findIndex(item => item && item.id === id);
    if (index < 0) return;
    state.items.splice(index, 1);
    manualTypeOverrides.delete(id);
    clearDirtyItem(id);
    refreshItemsById();
    state.order = sanitizeOrder(state.items, state.order);
    currentOrder = sanitizeOrder(state.items, currentOrder);
    const options = state.randomisering ? { randomize: true } : { resetToBase: true };
    applyOrder(options);
    updateValidationState();
  }

  function addNewItem() {
    if (!state) return;
    if (!Array.isArray(state.items)) {
      state.items = [];
    }
    const id = generateItemId();
    const newItem = { id, type: 'text', text: '', label: '', alt: '', figures: [] };
    ensureItemInPlace(newItem, state.items.length);
    state.items.push(newItem);
    refreshItemsById();
    state.order = state.items.map(item => item.id);
    currentOrder = state.randomisering ? sanitizeOrder(state.items, currentOrder) : state.order.slice();
    const options = state.randomisering ? { randomize: true } : { resetToBase: true };
    applyOrder(options);
    updateValidationState();
    if (isEditorMode()) {
      activateInlineEditor(id, { focusText: true });
    }
  }

  function attachExampleButtonGuards() {
    saveExampleButton = doc.getElementById('btnSaveExample');
    updateExampleButton = doc.getElementById('btnUpdateExample');
    const guardedButtons = [saveExampleButton, updateExampleButton];

    guardedButtons.forEach(button => {
      if (!button) return;
      button.addEventListener(
        'click',
        event => {
          if (!updateValidationState()) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
          }
          syncExampleBindings();
        },
        true
      );
    });
    deleteExampleButton = doc.getElementById('btnDeleteExample');
    if (deleteExampleButton) {
      deleteExampleButton.addEventListener(
        'click',
        () => {
          syncExampleBindings();
        },
        true
      );
    }
    updateExampleActionPayloads();
  }

  function ensureStorageWarningElement() {
    if (storageWarningEl && storageWarningEl.ownerDocument === doc) {
      return storageWarningEl;
    }
    const form = doc.getElementById('sorteringSettings');
    if (!form) {
      return null;
    }
    const el = doc.createElement('p');
    el.className = 'sortering__storage-warning';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.hidden = true;
    el.style.margin = '0 0 12px 0';
    el.style.padding = '8px 12px';
    el.style.borderRadius = '10px';
    el.style.border = '1px solid #fcd34d';
    el.style.background = '#fef3c7';
    el.style.color = '#92400e';
    el.style.fontSize = '13px';
    el.style.lineHeight = '1.4';
    if (form.firstChild) {
      form.insertBefore(el, form.firstChild);
    } else {
      form.appendChild(el);
    }
    storageWarningEl = el;
    return el;
  }

  function updateStorageWarningDisplay(message) {
    const el = ensureStorageWarningElement();
    if (!el) {
      return;
    }
    const text = typeof message === 'string' ? message.trim() : '';
    if (text) {
      el.textContent = text;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
  }

  function setupSettingsForm() {
    settingsForm = doc.getElementById('sorteringSettings');
    directionSelect = doc.getElementById('sortering-direction');
    gapInput = doc.getElementById('sortering-gap');
    hideOutlineInput = doc.getElementById('sortering-hide-outline');
    addItemButton = doc.getElementById('btnAddSorteringItem');
    validationStatusEl = doc.getElementById('sorteringEditorStatus');

    if (directionSelect) {
      directionSelect.addEventListener('change', handleDirectionSelectChange);
    }
    if (gapInput) {
      gapInput.addEventListener('change', handleGapChange);
      gapInput.addEventListener('blur', handleGapChange);
    }
    if (hideOutlineInput) {
      hideOutlineInput.addEventListener('change', handleHideOutlineChange);
    }
    if (addItemButton) {
      addItemButton.addEventListener('click', addNewItem);
    }
    syncSettingsFormFromState();
    updateValidationState();
    updateStorageWarningDisplay(storageWarningMessage);
  }

  function createState() {
    const rootState = globalObj.STATE && typeof globalObj.STATE === 'object' ? globalObj.STATE : {};
    if (!globalObj.STATE || typeof globalObj.STATE !== 'object') {
      globalObj.STATE = rootState;
    }

    const existing = rootState.sortering && typeof rootState.sortering === 'object' ? rootState.sortering : null;
    const incomingItems = buildItems(existing && Array.isArray(existing.items) ? existing.items : []);
    const items = incomingItems.length ? incomingItems : DEFAULT_ITEMS.map(cloneItem);
    const orderSource = existing && Array.isArray(existing.order) ? existing.order : DEFAULT_STATE.order;
    const order = sanitizeOrder(items, orderSource);
    const retning = normalizeDirection(existing && existing.retning ? existing.retning : DEFAULT_STATE.retning);
    const gap = normalizeGap(existing && 'gap' in existing ? existing.gap : Number.NaN, DEFAULT_STATE.gap);
    const hideOutline = normalizeHideOutline(
      existing && 'hideOutline' in existing ? existing.hideOutline : DEFAULT_STATE.hideOutline
    );
    const randomisering = existing && 'randomisering' in existing ? !!existing.randomisering : true;
    const altText = existing && typeof existing.altText === 'string' ? existing.altText : DEFAULT_STATE.altText;
    const altTextSource = existing && existing.altTextSource === 'manual' ? 'manual' : DEFAULT_STATE.altTextSource;

    const nextState = {
      items,
      order,
      retning,
      gap,
      hideOutline,
      randomisering,
      altText,
      altTextSource
    };

    rootState.sortering = nextState;
    globalObj.STATE = rootState;
    return nextState;
  }

  function applyStateFromGlobal() {
    const preservedDirtyItems = new Map();
    if (state && dirtyItemIds.size && Array.isArray(state.items)) {
      state.items.forEach(item => {
        if (!item || !item.id) return;
        if (dirtyItemIds.has(item.id)) {
          preservedDirtyItems.set(item.id, cloneItem(item));
        }
      });
    }
    state = createState();
    if (preservedDirtyItems.size && Array.isArray(state.items)) {
      state.items = state.items.map((item, index) => {
        if (!item || !item.id) return item;
        if (!preservedDirtyItems.has(item.id)) {
          return item;
        }
        const preserved = preservedDirtyItems.get(item.id);
        const ensured = ensureItemInPlace(preserved, index);
        return ensured || preserved;
      });
    }
    refreshItemsById();
    activeInlineEditorId = null;
    currentOrder = sanitizeOrder(state.items, state.order);
    syncSettingsFormFromState();
    updateValidationState();
    updateLayout();
    const options = state.randomisering ? { randomize: true } : { resetToBase: true };
    applyOrder(options);
  }

  function createCleanState() {
    const source = state || createState();
    const items = buildItems(source && Array.isArray(source.items) ? source.items : []);
    const order = sanitizeOrder(items, source && Array.isArray(source.order) ? source.order : []);
    const direction = normalizeDirection(source && source.retning ? source.retning : DEFAULT_STATE.retning);
    const gap = normalizeGap(source && 'gap' in source ? source.gap : Number.NaN, DEFAULT_STATE.gap);
    const hideOutline = normalizeHideOutline(
      source && 'hideOutline' in source ? source.hideOutline : DEFAULT_STATE.hideOutline
    );
    const randomize = !!(source && 'randomisering' in source ? source.randomisering : DEFAULT_STATE.randomisering);
    const altText = source && typeof source.altText === 'string' ? source.altText : DEFAULT_STATE.altText;
    const altTextSource = source && source.altTextSource === 'manual' ? 'manual' : DEFAULT_STATE.altTextSource;

    return {
      v: 1,
      items: items.map(cloneItem),
      order,
      config: {
        direction,
        gap,
        hideOutline,
        randomize
      },
      altText,
      altTextSource
    };
  }

  function loadCleanState(json) {
    let payload = json;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch (error) {
        if (globalObj && globalObj.console && typeof globalObj.console.warn === 'function') {
          globalObj.console.warn('mathVisSortering: kunne ikke parse lagret tilstand', error);
        }
        return false;
      }
    }

    if (!payload || typeof payload !== 'object') return false;
    const versionValue = 'v' in payload ? payload.v : payload.version;
    const version = typeof versionValue === 'number' ? versionValue : Number.parseInt(versionValue, 10);
    if (version !== 1) return false;

    const items = buildItems(Array.isArray(payload.items) ? payload.items : []);
    if (!items.length) return false;

    const config = payload.config && typeof payload.config === 'object' ? payload.config : {};
    const direction = normalizeDirection(config.direction || payload.retning || DEFAULT_STATE.retning);
    const gap = normalizeGap(
      'gap' in config ? config.gap : payload && 'gap' in payload ? payload.gap : Number.NaN,
      DEFAULT_STATE.gap
    );
    const hideOutline = normalizeHideOutline(
      'hideOutline' in config ? config.hideOutline : payload && 'hideOutline' in payload ? payload.hideOutline : undefined
    );
    const randomize = 'randomize' in config ? !!config.randomize : DEFAULT_STATE.randomisering;
    const altText = typeof payload.altText === 'string' ? payload.altText : DEFAULT_STATE.altText;
    const altTextSource = payload.altTextSource === 'manual' ? 'manual' : DEFAULT_STATE.altTextSource;
    const orderSource = Array.isArray(payload.order) ? payload.order : [];
    const order = sanitizeOrder(items, orderSource.length ? orderSource : items.map(item => item.id));

    const rootState = globalObj.STATE && typeof globalObj.STATE === 'object' ? globalObj.STATE : {};
    globalObj.STATE = rootState;
    rootState.sortering = {
      items,
      order,
      retning: direction,
      gap,
      hideOutline,
      randomisering: randomize,
      altText,
      altTextSource
    };

    applyStateFromGlobal();
    return true;
  }

  function handleExampleLoaded() {
    applyStateFromGlobal();
  }

  if (globalObj && typeof globalObj === 'object') {
    globalObj.sorteringApi = {
      createCleanState: (...args) => createCleanState(...args),
      loadCleanState: (...args) => loadCleanState(...args),
      onExampleLoaded: handleExampleLoaded
    };
    const mv = globalObj.mathVisuals && typeof globalObj.mathVisuals === 'object' ? globalObj.mathVisuals : {};
    mv.activeTool = globalObj.sorteringApi;
    globalObj.mathVisuals = mv;
  }

  function init() {
    registerMathVisApi();
    exportCard = doc.getElementById('exportCard');
    checkButton = doc.getElementById('btnCheck');
    checkStatus = doc.getElementById('checkStatus');
    taskCheckHost = doc.querySelector('[data-task-check-host]');
    taskCheckControls = [checkButton, checkStatus].filter(Boolean);
    ensureTaskControlsAppended();
    applyAppModeToTaskControls(getCurrentAppMode() || 'task');
    if (typeof globalObj.addEventListener === 'function') {
      globalObj.addEventListener('math-visuals:app-mode-changed', handleAppModeChanged);
    }
    if (doc) {
      doc.addEventListener('keydown', handleGlobalEnterKey);
      doc.addEventListener('pointerdown', handleDocumentPointerDown);
    }
    if (checkButton) {
      checkButton.addEventListener('click', handleCheckButtonClick);
    }
    figureHost = doc.getElementById('sortFigure');
    accessibleList = doc.getElementById('sortSkia');
    if (!figureHost) {
      return;
    }

    updateFigureEditorMode();

    state = createState();
    refreshItemsById();
    activeInlineEditorId = null;

    currentOrder = sanitizeOrder(state.items, state.order);

    if (!visualList) {
      visualList = doc.createElement('div');
      visualList.className = 'sortering__items';
      visualList.dataset.mode = currentAppMode;
      figureHost.appendChild(visualList);
    }

    if (accessibleList && accessibleList.firstChild) {
      while (accessibleList.firstChild) {
        accessibleList.removeChild(accessibleList.firstChild);
      }
    }

    updateLayout();
    applyOrder({ randomize: !!state.randomisering, resetToBase: !state.randomisering });
    setupSettingsForm();
    attachExampleButtonGuards();
    loadFigureLibrary().catch(error => {
      if (globalObj && globalObj.console && typeof globalObj.console.warn === 'function') {
        globalObj.console.warn('mathVisSortering: kunne ikke laste figurbiblioteket', error);
      }
    });
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})().catch(error => {
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error('mathVisSortering: init failed', error);
  }
});
