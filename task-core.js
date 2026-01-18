(function attachMathVisualsTaskCore(global) {
  if (!global) return;
  if (global.MathVisualsTaskCore) return;

  const DESCRIPTION_PREVIEW_LABEL_BASE_ID = 'example-description-label';
  const TASK_TEXT_STORAGE_PREFIX = 'math-visuals:task-text:';
  const TASK_TEXT_STORAGE_VERSION = 1;
  const DESCRIPTION_MARKERS = [
    { type: 'math', marker: '@math{', open: '{', close: '}' },
    { type: 'task', marker: '@task{', open: '{', close: '}' },
    { type: 'answerbox', marker: '@answerbox[', open: '[', close: ']' },
    { type: 'answer', marker: '@answer[', open: '[', close: ']' },
    { type: 'input', marker: '@input[', open: '[', close: ']' }
  ].map(marker => ({ ...marker, markerLower: marker.marker.toLowerCase() }));

  const state = {
    descriptionInput: null,
    descriptionContainer: null,
    descriptionPreview: null,
    descriptionRendererPromise: null,
    descriptionInputsWithListeners: new WeakSet(),
    descriptionContainersWithListeners: new WeakSet(),
    descriptionPlaceholdersWithListeners: new WeakSet(),
    descriptionPreviewLabelIdCounter: 0,
    descriptionToggle: null,
    lastDescriptionRenderToken: 0,
    lastRenderedDescriptionValue: null,
    taskModeDescriptionEditing: false,
    taskModeDescriptionRenderRetryScheduled: false,
    taskPanelPreview: null,
    taskPanelUpdateButton: null,
    taskDescriptionSyncInitialized: false,
    config: {
      getAppMode: null,
      setAppMode: null,
      normalizeAppMode: null,
      getExamples: null,
      getActiveExampleIndex: null,
      extractDescriptionFromExample: null,
      normalizeDescriptionString: null,
      getExampleId: null
    }
  };

  const descriptionRendererLogPrefix = '[math-vis:description-loader]';

  function normalizeExampleId(value) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }
    return null;
  }

  function resolveExampleIdFromExample(example, index, examples) {
    if (typeof state.config.getExampleId === 'function') {
      const resolved = state.config.getExampleId(example, index, examples);
      const normalized = normalizeExampleId(resolved);
      if (normalized) return normalized;
    }
    if (example && typeof example === 'object') {
      const candidateKeys = ['exampleId', 'exampleID', 'exampleNumber', 'id'];
      for (const key of candidateKeys) {
        if (!Object.prototype.hasOwnProperty.call(example, key)) continue;
        const normalized = normalizeExampleId(example[key]);
        if (normalized) return normalized;
      }
    }
    if (Number.isInteger(index)) {
      return String(index + 1);
    }
    return null;
  }

  function getLocalStorage() {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage || null;
    } catch (_) {
      return null;
    }
  }

  function buildTaskStorageKey(exampleId) {
    if (!exampleId) return null;
    return `${TASK_TEXT_STORAGE_PREFIX}${exampleId}`;
  }

  function normalizeTaskTextValue(value) {
    if (typeof value !== 'string') return '';
    if (typeof state.config.normalizeDescriptionString === 'function') {
      return state.config.normalizeDescriptionString(value);
    }
    return value.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').trim();
  }

  function readTaskTextFromStorage(exampleId) {
    const storage = getLocalStorage();
    const key = buildTaskStorageKey(exampleId);
    if (!storage || !key) return null;
    let raw = null;
    try {
      raw = storage.getItem(key);
    } catch (_) {
      return null;
    }
    if (!raw) return null;
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed) return null;
    if (trimmed[0] === '{') {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string') {
          const normalized = normalizeTaskTextValue(parsed.text);
          return normalized || null;
        }
      } catch (_) {
        return null;
      }
    }
    return normalizeTaskTextValue(trimmed) || null;
  }

  function writeTaskTextToStorage(exampleId, value) {
    const storage = getLocalStorage();
    const key = buildTaskStorageKey(exampleId);
    if (!storage || !key) return false;
    const normalized = normalizeTaskTextValue(value);
    try {
      if (!normalized) {
        storage.removeItem(key);
        return true;
      }
      const payload = {
        v: TASK_TEXT_STORAGE_VERSION,
        id: exampleId,
        text: normalized,
        updatedAt: new Date().toISOString()
      };
      storage.setItem(key, JSON.stringify(payload));
      return true;
    } catch (_) {
      return false;
    }
  }

  function resolveActiveExampleContext() {
    const getExamples = state.config.getExamples;
    const getActiveExampleIndex = state.config.getActiveExampleIndex;
    const examples = typeof getExamples === 'function' ? getExamples() : [];
    const index = typeof getActiveExampleIndex === 'function' ? getActiveExampleIndex(examples) : null;
    const example = Number.isInteger(index) && Array.isArray(examples) ? examples[index] : null;
    const exampleId = resolveExampleIdFromExample(example, index, examples);
    return { examples, index, example, exampleId };
  }

  function persistTaskText(value, context) {
    const normalizedMode = normalizeMode(getAppMode());
    if (normalizedMode !== 'task') return false;
    const ctx = context || resolveActiveExampleContext();
    if (!ctx || !ctx.exampleId) return false;
    return writeTaskTextToStorage(ctx.exampleId, value);
  }

  function setConfig(options) {
    if (!options || typeof options !== 'object') return;
    state.config = {
      ...state.config,
      ...options
    };
  }

  function getAppMode() {
    if (typeof state.config.getAppMode === 'function') {
      return state.config.getAppMode();
    }
    if (typeof document !== 'undefined' && document.body && document.body.dataset) {
      return document.body.dataset.appMode || 'default';
    }
    return 'default';
  }

  function normalizeMode(value) {
    if (typeof state.config.normalizeAppMode === 'function') {
      return state.config.normalizeAppMode(value);
    }
    return typeof value === 'string' ? value : null;
  }

  function logDescriptionRendererEvent(level, message, details) {
    const root =
      (typeof window !== 'undefined' && window && window.console && window) ||
      (typeof globalThis !== 'undefined' && globalThis && globalThis.console && globalThis) ||
      null;
    if (!root || !root.console) return;
    const consoleRef = root.console;
    const method = typeof consoleRef[level] === 'function' ? consoleRef[level] : consoleRef.log;
    try {
      if (details !== undefined) {
        method.call(consoleRef, `${descriptionRendererLogPrefix} ${message}`, details);
      } else {
        method.call(consoleRef, `${descriptionRendererLogPrefix} ${message}`);
      }
    } catch (_) {}
  }

  function resolveDescriptionRendererUrl() {
    if (typeof document === 'undefined') {
      return [
        {
          url: 'description-renderer.js',
          reason: 'no-document'
        }
      ];
    }
    const candidates = [];
    const seenUrls = new Set();
    const addCandidateUrl = (url, reason, priority = 1, details) => {
      if (typeof url !== 'string') return;
      const trimmed = url.trim();
      if (!trimmed) return;
      const normalized = trimmed;
      if (seenUrls.has(normalized)) return;
      seenUrls.add(normalized);
      candidates.push({ url: normalized, reason, priority, order: candidates.length, details: details || null });
    };
    const addCandidateFromBase = (base, reason, priority = 1) => {
      if (typeof base !== 'string' || !base.trim()) return;
      try {
        const resolved = new URL('description-renderer.js', base).toString();
        addCandidateUrl(resolved, reason, priority, { base });
      } catch (error) {
        logDescriptionRendererEvent('warn', 'Failed to resolve description renderer URL candidate', {
          base,
          reason,
          error: error && error.message ? error.message : String(error)
        });
      }
    };
    const { currentScript } = document;
    const scripts = typeof document.getElementsByTagName === 'function' ? document.getElementsByTagName('script') : null;

    const resolveCandidateScriptElement = () => {
      if (currentScript) return currentScript;
      if (scripts && scripts.length) {
        return scripts[scripts.length - 1];
      }
      return null;
    };

    const shouldForceRelativeDescriptionRendererUrl = () => {
      if (typeof window === 'undefined') return false;
      const { location } = window;
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
          if (
            trimmedSrc &&
            !/^[a-z][a-z\d+\-.]*:/i.test(trimmedSrc) &&
            !trimmedSrc.startsWith('//') &&
            !trimmedSrc.startsWith('/')
          ) {
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
          const resolvedFromScript = new URL('description-renderer.js', absoluteSrc).toString();
          logDescriptionRendererEvent('info', 'Using script-derived description renderer URL for static context', {
            scriptSrc: absoluteSrc,
            resolvedUrl: resolvedFromScript
          });
          return [
            {
              url: resolvedFromScript,
              reason: 'static-context-script-src',
              details: { scriptSrc: absoluteSrc }
            }
          ];
        } catch (error) {
          logDescriptionRendererEvent('warn', 'Failed to resolve script-derived description renderer URL for static context', {
            scriptSrc: absoluteSrc,
            error: error && error.message ? error.message : String(error)
          });
        }
      }
      logDescriptionRendererEvent('info', 'Using relative description renderer URL for static context');
      return [
        {
          url: 'description-renderer.js',
          reason: 'static-context'
        }
      ];
    }

    let scriptElement = currentScript && currentScript.src ? currentScript : null;
    if (!scriptElement) {
      const candidateScript = resolveCandidateScriptElement();
      if (candidateScript && candidateScript.src) {
        scriptElement = candidateScript;
      }
    }

    if (scriptElement && scriptElement.src) {
      try {
        const scriptDirectoryUrl = new URL('./description-renderer.js', scriptElement.src).toString();
        addCandidateUrl(scriptDirectoryUrl, 'script-directory', 0, { scriptSrc: scriptElement.src });
      } catch (error) {
        logDescriptionRendererEvent('warn', 'Failed to resolve script directory description renderer URL', {
          scriptSrc: scriptElement.src,
          error: error && error.message ? error.message : String(error)
        });
      }
    }

    if (typeof window !== 'undefined' && window.location) {
      const { origin, href } = window.location;
      if (typeof origin === 'string' && origin && origin !== 'null') {
        try {
          const rootRelative = new URL('/description-renderer.js', origin).toString();
          addCandidateUrl(rootRelative, 'root-relative', 1, { origin });
        } catch (error) {
          logDescriptionRendererEvent('warn', 'Failed to resolve root-relative description renderer URL', {
            origin,
            error: error && error.message ? error.message : String(error)
          });
        }
      } else if (typeof href === 'string' && href) {
        try {
          const rootRelativeFromHref = new URL('/description-renderer.js', href).toString();
          addCandidateUrl(rootRelativeFromHref, 'root-relative', 1, { href });
        } catch (error) {
          logDescriptionRendererEvent('warn', 'Failed to resolve root-relative description renderer URL from href', {
            href,
            error: error && error.message ? error.message : String(error)
          });
        }
      }
    }

    if (currentScript && currentScript.src) {
      addCandidateFromBase(currentScript.src, 'document.currentScript.src', 2);
    }
    if (scripts && scripts.length) {
      for (let i = scripts.length - 1; i >= 0; i--) {
        const script = scripts[i];
        if (!script || !script.src) continue;
        const src = script.src;
        addCandidateFromBase(src, 'script[src]', 2);
        if (/\bexamples(?:\.min)?\.js(?:\?|#|$)/.test(src)) {
          addCandidateFromBase(src, 'examples.js script[src]', 2);
          break;
        }
      }
    }
    if (typeof window !== 'undefined' && window.location) {
      const { origin, href } = window.location;
      if (typeof origin === 'string' && origin && origin !== 'null') {
        addCandidateFromBase(origin.endsWith('/') ? origin : `${origin}/`, 'window.location.origin', 3);
      }
      if (typeof href === 'string' && href) {
        addCandidateFromBase(href, 'window.location.href', 4);
      }
    }
    if (typeof document.baseURI === 'string' && document.baseURI) {
      addCandidateFromBase(document.baseURI, 'document.baseURI', 4);
    }

    addCandidateUrl('description-renderer.js', 'relative-fallback', 5);

    const orderedCandidates = candidates.slice().sort((a, b) => {
      if (a.priority === b.priority) {
        return a.order - b.order;
      }
      return a.priority - b.priority;
    });

    logDescriptionRendererEvent('debug', 'Evaluating description renderer URL candidates', orderedCandidates);

    if (!orderedCandidates.length) {
      logDescriptionRendererEvent('warn', 'No description renderer URL candidates resolved, using relative fallback');
      return [
        {
          url: 'description-renderer.js',
          reason: 'empty-candidates'
        }
      ];
    }

    return orderedCandidates.map(candidate => ({
      url: candidate.url,
      reason: candidate.reason,
      details: candidate.details || null
    }));
  }

  function loadDescriptionRenderer() {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return Promise.resolve(null);
    }
    if (window.MathVisDescriptionRenderer) {
      logDescriptionRendererEvent('debug', 'Description renderer already available on window');
      return Promise.resolve(window.MathVisDescriptionRenderer);
    }
    if (state.descriptionRendererPromise) {
      logDescriptionRendererEvent('debug', 'Reusing pending description renderer load promise');
      return state.descriptionRendererPromise;
    }
    state.descriptionRendererPromise = new Promise((resolve, reject) => {
      const candidates = resolveDescriptionRendererUrl();
      const normalizedCandidates = Array.isArray(candidates) && candidates.length
        ? candidates
        : [
            {
              url: 'description-renderer.js',
              reason: 'implicit-fallback'
            }
          ];

      const attemptLoad = index => {
        if (index >= normalizedCandidates.length) {
          state.descriptionRendererPromise = null;
          logDescriptionRendererEvent('error', 'Failed to load description renderer script after all candidates');
          reject(new Error('Failed to load description renderer from all candidate URLs.'));
          return;
        }

        const candidate = normalizedCandidates[index] || {};
        const scriptUrl = typeof candidate.url === 'string' ? candidate.url : 'description-renderer.js';
        logDescriptionRendererEvent('info', 'Loading description renderer script', {
          url: scriptUrl,
          reason: candidate.reason
        });

        const script = document.createElement('script');
        script.async = true;
        script.src = scriptUrl;
        script.setAttribute('data-mathvis-description-loader', 'true');

        const cleanup = () => {
          script.removeEventListener('load', onLoad);
          script.removeEventListener('error', onError);
          if (script.parentNode) {
            try {
              script.parentNode.removeChild(script);
            } catch (_) {}
          }
        };

        const onLoad = () => {
          if (window.MathVisDescriptionRenderer) {
            logDescriptionRendererEvent('info', 'Description renderer script loaded successfully', {
              url: scriptUrl,
              reason: candidate.reason
            });
            cleanup();
            resolve(window.MathVisDescriptionRenderer);
          } else {
            state.descriptionRendererPromise = null;
            cleanup();
            logDescriptionRendererEvent('error', 'Description renderer script loaded without exposing global', {
              url: scriptUrl,
              reason: candidate.reason
            });
            reject(new Error('Description renderer loaded without exposing the expected global.'));
          }
        };

        const onError = () => {
          cleanup();
          logDescriptionRendererEvent('warn', 'Failed to load description renderer script candidate', {
            url: scriptUrl,
            reason: candidate.reason
          });
          attemptLoad(index + 1);
        };

        script.addEventListener('load', onLoad, { once: true });
        script.addEventListener('error', onError, { once: true });
        document.head.appendChild(script);
      };

      attemptLoad(0);
    });
    return state.descriptionRendererPromise;
  }

  if (typeof window !== 'undefined') {
    loadDescriptionRenderer();
  }

  function getDescriptionContainer() {
    if (state.descriptionContainer && state.descriptionContainer.isConnected) return state.descriptionContainer;
    if (typeof document === 'undefined') return null;
    const container = document.querySelector('.example-description');
    if (container instanceof HTMLElement) {
      state.descriptionContainer = container;
      return container;
    }
    state.descriptionContainer = null;
    return null;
  }

  function findDescriptionLabelElement(input) {
    if (!input || !input.id) return null;
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return null;
    const labels = document.querySelectorAll('label');
    for (let index = 0; index < labels.length; index++) {
      const label = labels[index];
      if (!label) continue;
      const labelFor = typeof label.getAttribute === 'function' ? label.getAttribute('for') : null;
      if (labelFor === input.id) {
        return label;
      }
    }
    return null;
  }

  function ensureDescriptionLabelId(label) {
    if (!label) return null;
    if (label.id) return label.id;
    let candidate = DESCRIPTION_PREVIEW_LABEL_BASE_ID;
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
      if (document.getElementById(candidate)) {
        do {
          candidate = `${DESCRIPTION_PREVIEW_LABEL_BASE_ID}-${++state.descriptionPreviewLabelIdCounter}`;
        } while (document.getElementById(candidate));
      }
    }
    label.id = candidate;
    return label.id;
  }

  function syncDescriptionPreviewAccessibility(preview) {
    if (!preview) return;
    preview.setAttribute('role', 'region');
    const input = getDescriptionInput();
    if (!input) {
      preview.removeAttribute('aria-label');
      preview.removeAttribute('aria-labelledby');
      preview.removeAttribute('aria-describedby');
      return;
    }
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    const ariaDescribedBy = input.getAttribute('aria-describedby');
    if (ariaLabel && ariaLabel.trim()) {
      preview.setAttribute('aria-label', ariaLabel);
    } else {
      preview.removeAttribute('aria-label');
    }
    if (ariaLabelledBy && ariaLabelledBy.trim()) {
      preview.setAttribute('aria-labelledby', ariaLabelledBy);
    } else {
      preview.removeAttribute('aria-labelledby');
      const labelElement = findDescriptionLabelElement(input);
      const labelId = ensureDescriptionLabelId(labelElement);
      if (labelId) {
        preview.setAttribute('aria-labelledby', labelId);
      }
    }
    if (ariaDescribedBy && ariaDescribedBy.trim()) {
      preview.setAttribute('aria-describedby', ariaDescribedBy);
    } else {
      preview.removeAttribute('aria-describedby');
    }
  }

  function getDescriptionPreviewElement() {
    const ensurePreviewPosition = (previewElement, containerElement) => {
      if (!previewElement || !containerElement) return;
      if (typeof containerElement.querySelector !== 'function') return;
      const checkHost = containerElement.querySelector('[data-task-check-host]');
      if (checkHost && typeof containerElement.insertBefore === 'function') {
        if (checkHost.previousElementSibling !== previewElement) {
          containerElement.insertBefore(previewElement, checkHost);
        }
      } else if (previewElement.parentElement !== containerElement) {
        containerElement.appendChild(previewElement);
      }
    };

    if (state.descriptionPreview && state.descriptionPreview.isConnected) {
      ensurePreviewPosition(state.descriptionPreview, state.descriptionPreview.parentElement);
      syncDescriptionPreviewAccessibility(state.descriptionPreview);
      return state.descriptionPreview;
    }

    const container = getDescriptionContainer();
    if (!container) return null;
    let preview = container.querySelector('.example-description-preview');
    if (!(preview instanceof HTMLElement)) {
      preview = document.createElement('div');
      preview.className = 'example-description-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.setAttribute('hidden', '');
      preview.dataset.empty = 'true';
      const checkHost = container.querySelector('[data-task-check-host]');
      if (checkHost && typeof container.insertBefore === 'function') {
        container.insertBefore(preview, checkHost);
      } else {
        container.appendChild(preview);
      }
    }

    ensurePreviewPosition(preview, container);
    syncDescriptionPreviewAccessibility(preview);
    state.descriptionPreview = preview;
    return preview;
  }

  function clearDescriptionPlaceholder(preview) {
    if (!preview) return;
    delete preview.dataset.placeholder;
    preview.removeAttribute('role');
    preview.removeAttribute('tabindex');
  }

  function applyDescriptionPlaceholder(preview, label) {
    if (!preview) return;
    preview.dataset.placeholder = 'true';
    if (typeof label === 'string') {
      preview.textContent = label;
    }
    preview.removeAttribute('hidden');
    preview.setAttribute('aria-hidden', 'false');
    preview.tabIndex = 0;
    preview.setAttribute('role', 'button');

    if (!state.descriptionPlaceholdersWithListeners.has(preview)) {
      const activate = event => {
        if (event && event.type === 'keydown') {
          const key = event.key;
          if (key !== 'Enter' && key !== ' ') return;
        }
        if (preview.dataset.placeholder !== 'true') return;
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        startTaskModeDescriptionEdit({ focus: true });
      };
      preview.addEventListener('click', activate);
      preview.addEventListener('keydown', activate);
      state.descriptionPlaceholdersWithListeners.add(preview);
    }
  }

  function updateTaskCheckAvailability(preview) {
    if (!preview || typeof preview.querySelector !== 'function') return;
    const container = preview.closest('.example-description');
    if (!container) return;
    const checkHost = container.querySelector('[data-task-check-host]');
    if (!checkHost) return;
    let hasInputs = false;
    if (typeof window !== 'undefined' && window.MathVisDescriptionRenderer) {
      const renderer = window.MathVisDescriptionRenderer;
      if (renderer && typeof renderer.hasInputs === 'function') {
        try {
          hasInputs = renderer.hasInputs(preview) === true;
        } catch (_) {}
      }
    }
    if (!hasInputs) {
      hasInputs = preview.querySelector('.math-vis-answerbox__input') != null;
    }
    if (hasInputs) {
      checkHost.dataset.hasAnswerInputs = 'true';
      container.dataset.hasAnswerInputs = 'true';
    } else {
      delete checkHost.dataset.hasAnswerInputs;
      delete container.dataset.hasAnswerInputs;
    }
    if (typeof checkHost.dispatchEvent === 'function') {
      try {
        checkHost.dispatchEvent(
          new CustomEvent('math-visuals:task-check-availability', {
            detail: { hasAnswerInputs: hasInputs }
          })
        );
      } catch (_) {}
    }
  }

  function clearChildren(node) {
    if (!node) return;
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  function hasDescriptionFormatting(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (findNextDescriptionMarker(trimmed, 0)) return true;
    const lower = trimmed.toLowerCase();
    if (/@table\s*\{/.test(lower)) return true;
    return false;
  }

  function extractBalancedSegment(text, startIndex, openChar, closeChar) {
    if (typeof text !== 'string') return null;
    let depth = 1;
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      if (char === openChar) {
        depth += 1;
      } else if (char === closeChar) {
        depth -= 1;
      }
      if (depth === 0) {
        return {
          content: text.slice(startIndex, i),
          endIndex: i
        };
      }
    }
    return null;
  }

  function findNextDescriptionMarker(text, startIndex) {
    if (typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    let next = null;
    DESCRIPTION_MARKERS.forEach(marker => {
      const index = lower.indexOf(marker.markerLower, startIndex);
      if (index === -1) return;
      if (
        !next ||
        index < next.index ||
        (index === next.index && marker.marker.length > next.marker.length)
      ) {
        next = { ...marker, index };
      }
    });
    return next;
  }

  function extractOptionValue(options, keys) {
    if (typeof options !== 'string') return '';
    for (const key of keys) {
      const pattern = new RegExp(
        `(?:^|[|,])\\s*${key}\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^|"'\]]+))`,
        'i'
      );
      const match = options.match(pattern);
      if (match) {
        const value = match[2] || match[3] || match[4] || '';
        if (value) return value.trim();
      }
    }
    return '';
  }

  function stripDescriptionMarkup(text) {
    if (typeof text !== 'string' || text.indexOf('@') === -1) return text;
    let result = '';
    let index = 0;
    while (index < text.length) {
      const marker = findNextDescriptionMarker(text, index);
      if (!marker) {
        result += text.slice(index);
        break;
      }
      result += text.slice(index, marker.index);
      const offset = marker.index + marker.marker.length;
      const extraction = extractBalancedSegment(text, offset, marker.open, marker.close);
      if (!extraction) {
        result += text.slice(marker.index);
        break;
      }
      const { content, endIndex } = extraction;
      if (marker.type === 'math' || marker.type === 'task') {
        result += content;
      } else {
        const placeholder = extractOptionValue(content, ['placeholder', 'label']);
        result += placeholder || '____';
      }
      index = endIndex + 1;
    }
    return result;
  }

  function appendDescriptionText(fragment, text) {
    if (!fragment || typeof fragment.appendChild !== 'function') return;
    if (typeof text !== 'string') return;
    const stripped = stripDescriptionMarkup(text);
    const normalized = stripped.replace(/\r\n?/g, '\n');
    const paragraphs = normalized.split(/\n{2,}/);
    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) return;
      const lines = paragraph.split('\n');
      const p = document.createElement('p');
      lines.forEach((line, index) => {
        p.appendChild(document.createTextNode(line));
        if (index < lines.length - 1) {
          p.appendChild(document.createElement('br'));
        }
      });
      fragment.appendChild(p);
    });
  }

  function createDescriptionTable(content) {
    if (typeof content !== 'string') return null;
    const normalized = content.replace(/\r\n?/g, '\n').trim();
    if (!normalized) return null;
    const lines = normalized
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    if (!lines.length) return null;
    const rows = lines.map(line => line.split('|').map(cell => cell.trim()));
    const columnCount = rows.reduce((max, row) => (row.length > max ? row.length : max), 0);
    if (!columnCount) return null;
    const table = document.createElement('table');
    table.className = 'example-description-table';
    let bodyStartIndex = 0;
    if (rows.length > 1) {
      const thead = document.createElement('thead');
      const headRow = document.createElement('tr');
      for (let i = 0; i < columnCount; i++) {
        const th = document.createElement('th');
        th.textContent = rows[0][i] != null ? rows[0][i] : '';
        headRow.appendChild(th);
      }
      thead.appendChild(headRow);
      table.appendChild(thead);
      bodyStartIndex = 1;
    }
    const tbody = document.createElement('tbody');
    const appendRow = row => {
      const tr = document.createElement('tr');
      for (let i = 0; i < columnCount; i++) {
        const cell = document.createElement('td');
        const value = row && row[i] != null ? stripDescriptionMarkup(row[i]) : '';
        cell.textContent = value;
        tr.appendChild(cell);
      }
      tbody.appendChild(tr);
    };
    if (rows.length === 1) {
      appendRow(rows[0]);
    } else {
      for (let i = bodyStartIndex; i < rows.length; i++) {
        appendRow(rows[i]);
      }
    }
    table.appendChild(tbody);
    return table;
  }

  function buildDescriptionPreview(value) {
    const fragment = document.createDocumentFragment();
    if (typeof value !== 'string') return fragment;
    const normalized = value.replace(/\r\n?/g, '\n');
    const pattern = /@table\s*\{([\s\S]*?)\}/gi;
    let lastIndex = 0;
    let match = null;
    while ((match = pattern.exec(normalized)) !== null) {
      const before = normalized.slice(lastIndex, match.index);
      appendDescriptionText(fragment, before);
      const table = createDescriptionTable(match[1]);
      if (table) {
        fragment.appendChild(table);
      } else {
        appendDescriptionText(fragment, match[0]);
      }
      lastIndex = pattern.lastIndex;
    }
    const after = normalized.slice(lastIndex);
    appendDescriptionText(fragment, after);
    return fragment;
  }

  function renderDescriptionPreviewFromValue(value, options) {
    const preview = getDescriptionPreviewElement();
    if (!preview) return null;
    preview.classList.add('math-vis-description-rendered');
    const opts = options && typeof options === 'object' ? options : {};
    const force = opts.force === true;
    const bypassFormattingCheck = opts.bypassFormattingCheck === true;
    const stringValue = typeof value === 'string' ? value : '';
    if (!force && stringValue === state.lastRenderedDescriptionValue) {
      return preview.dataset.empty !== 'true';
    }
    const applyState = hasContent => {
      const emptyValue = hasContent ? 'false' : 'true';
      preview.dataset.empty = emptyValue;
      if (hasContent) {
        preview.removeAttribute('hidden');
        preview.setAttribute('aria-hidden', 'false');
      } else {
        preview.setAttribute('hidden', '');
        preview.setAttribute('aria-hidden', 'true');
      }
    };
    const markRendered = hasContent => {
      state.lastRenderedDescriptionValue = stringValue;
      return hasContent;
    };
    const trimmedValue = stringValue.trim();

    function renderPlainText() {
      const fragment = buildDescriptionPreview(stringValue);
      const hasFragmentContent = fragment && fragment.childNodes && fragment.childNodes.length > 0;
      clearChildren(preview);
      if (hasFragmentContent) {
        preview.appendChild(fragment);
      } else {
        preview.textContent = stringValue;
      }
      updateTaskCheckAvailability(preview);
      return hasFragmentContent || !!trimmedValue;
    }
    if (!trimmedValue) {
      clearChildren(preview);
      clearDescriptionPlaceholder(preview);
      const shouldShowPlaceholder =
        typeof document !== 'undefined' &&
        document.body &&
        document.body.dataset &&
        document.body.dataset.appMode === 'task';
      if (shouldShowPlaceholder) {
        applyDescriptionPlaceholder(preview, 'Klikk her for å skrive oppgavetekst…');
        preview.dataset.empty = 'false';
        return markRendered(true);
      }
      applyState(false);
      return markRendered(false);
    }
    if (!bypassFormattingCheck && !hasDescriptionFormatting(stringValue)) {
      const hasContent = renderPlainText();
      clearDescriptionPlaceholder(preview);
      applyState(hasContent);
      return markRendered(hasContent);
    }
    let placeholderRendered = false;

    function renderPlainTextPlaceholder() {
      if (placeholderRendered) return true;
      const hasContent = renderPlainText();
      preview.dataset.placeholder = 'true';
      applyState(hasContent);
      markRendered(hasContent);
      placeholderRendered = true;
      return hasContent;
    }

    function renderLegacy() {
      const hasContent = renderPlainText();
      clearDescriptionPlaceholder(preview);
      applyState(hasContent);
      updateTaskCheckAvailability(preview);
      return markRendered(hasContent);
    }

    const token = ++state.lastDescriptionRenderToken;

    function renderWith(renderer) {
      if (!renderer || token !== state.lastDescriptionRenderToken) return;
      try {
        const hasContent = !!renderer.renderInto(preview, stringValue);
        if (hasContent) {
          clearDescriptionPlaceholder(preview);
          applyState(hasContent);
          markRendered(hasContent);
        } else if (!preview.childNodes || preview.childNodes.length === 0) {
          renderPlainTextPlaceholder();
        }
        updateTaskCheckAvailability(preview);
      } catch (error) {
        if (token === state.lastDescriptionRenderToken) {
          renderLegacy();
        }
      }
    }

    if (window.MathVisDescriptionRenderer && typeof window.MathVisDescriptionRenderer.renderInto === 'function') {
      renderWith(window.MathVisDescriptionRenderer);
      return null;
    }

    const loader = loadDescriptionRenderer();
    if (!loader || typeof loader.then !== 'function') {
      renderLegacy();
      return null;
    }
    renderPlainTextPlaceholder();
    loader
      .then(renderer => {
        if (token !== state.lastDescriptionRenderToken) return;
        if (renderer && typeof renderer.renderInto === 'function') {
          renderWith(renderer);
        } else {
          renderLegacy();
        }
      })
      .catch(() => {
        if (token === state.lastDescriptionRenderToken) {
          renderLegacy();
        }
      });
    return null;
  }

  function ensureDescriptionToggle(container) {
    if (!container) return null;
    if (state.descriptionToggle && state.descriptionToggle.isConnected) {
      return state.descriptionToggle;
    }
    let toggle = container.querySelector('.example-description-toggle');
    if (!(toggle instanceof HTMLElement)) {
      toggle = document.createElement('div');
      toggle.className = 'example-description-toggle';
      const previewButton = document.createElement('button');
      previewButton.type = 'button';
      previewButton.className = 'example-description-toggle__button';
      previewButton.dataset.mode = 'preview';
      previewButton.textContent = 'Forhåndsvisning';

      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'example-description-toggle__button';
      editButton.dataset.mode = 'edit';
      editButton.textContent = 'Rediger';

      toggle.appendChild(previewButton);
      toggle.appendChild(editButton);

      const label = container.querySelector('label');
      if (label && label.parentElement === container) {
        label.insertAdjacentElement('afterend', toggle);
      } else if (container.firstChild) {
        container.insertBefore(toggle, container.firstChild);
      } else {
        container.appendChild(toggle);
      }

      toggle.addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const mode = target.dataset.mode;
        if (mode === 'edit') {
          setTaskModeDescriptionEditing(true, { focus: true });
        } else if (mode === 'preview') {
          setTaskModeDescriptionEditing(false);
        }
      });
    }
    state.descriptionToggle = toggle;
    return toggle;
  }

  function updateToggleState(toggle, isEditing, isTaskMode) {
    if (!toggle) return;
    const previewButton = toggle.querySelector('[data-mode="preview"]');
    const editButton = toggle.querySelector('[data-mode="edit"]');
    if (previewButton) {
      previewButton.setAttribute('aria-pressed', isEditing ? 'false' : 'true');
    }
    if (editButton) {
      editButton.setAttribute('aria-pressed', isEditing ? 'true' : 'false');
    }
    if (isTaskMode) {
      toggle.removeAttribute('hidden');
      toggle.setAttribute('aria-hidden', 'false');
    } else {
      toggle.setAttribute('hidden', '');
      toggle.setAttribute('aria-hidden', 'true');
    }
  }

  function updateDescriptionEditVisibilityForMode(mode) {
    const normalized = normalizeMode(mode != null ? mode : getAppMode()) || 'default';
    const isTaskMode = normalized === 'task';
    const isEditing = isTaskMode && state.taskModeDescriptionEditing;
    if (!isTaskMode && state.taskModeDescriptionEditing) {
      state.taskModeDescriptionEditing = false;
    }

    const input = getDescriptionInput();
    if (!input) return;

    renderDescriptionPreviewFromValue(input.value, { force: true });

    const container = input.closest('.example-description');
    if (container) {
      container.classList.toggle('example-description--task-mode', isTaskMode);
      container.classList.toggle('example-description--task-editing', isEditing);
      container.classList.toggle('is-editing', isEditing);
      container.removeAttribute('hidden');
      container.removeAttribute('aria-hidden');
      delete container.dataset.hiddenInEditMode;

      const toggle = ensureDescriptionToggle(container);
      updateToggleState(toggle, isEditing, isTaskMode);

      const examplesCard = container.closest('.card--examples');
      if (examplesCard) {
        if (isEditing) {
          examplesCard.dataset.descriptionEditing = 'true';
        } else {
          delete examplesCard.dataset.descriptionEditing;
        }
      }
    }

    input.hidden = false;
    input.removeAttribute('hidden');
    input.removeAttribute('aria-hidden');
  }

  function focusDescriptionInput(options) {
    const input = getDescriptionInput();
    if (!input) return;
    const opts = options && typeof options === 'object' ? options : {};
    const preventScroll = opts.preventScroll !== false;
    if (typeof input.focus === 'function') {
      try {
        input.focus({ preventScroll });
      } catch (_) {
        try {
          input.focus();
        } catch (_) {}
      }
    }
  }

  function setTaskModeDescriptionEditing(enabled, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const next = enabled === true;
    const changed = next !== state.taskModeDescriptionEditing || opts.force === true;
    state.taskModeDescriptionEditing = next;
    if (changed) {
      updateDescriptionEditVisibilityForMode(getAppMode());
    }
    if (state.taskModeDescriptionEditing && opts.focus !== false) {
      focusDescriptionInput({ preventScroll: opts.preventScroll });
    }
  }

  function startTaskModeDescriptionEdit(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const shouldSwitchMode = opts.setTaskMode !== false;
    const normalizedMode = normalizeMode(getAppMode());
    if (shouldSwitchMode && normalizedMode !== 'task' && typeof state.config.setAppMode === 'function') {
      state.config.setAppMode('task', { force: true, notifyParent: opts.notifyParent !== false });
    }
    setTaskModeDescriptionEditing(true, { focus: opts.focus !== false, preventScroll: opts.preventScroll });
  }

  function stopTaskModeDescriptionEdit() {
    setTaskModeDescriptionEditing(false);
  }

  function ensureTaskModeDescriptionRendered() {
    const input = getDescriptionInput();
    if (!input) return;
    updateDescriptionEditVisibilityForMode('task');
    let value = typeof input.value === 'string' ? input.value : '';
    let trimmed = value && typeof value.trim === 'function' ? value.trim() : '';
    const activeContext = resolveActiveExampleContext();
    if (activeContext.exampleId) {
      const stored = readTaskTextFromStorage(activeContext.exampleId);
      if (stored && stored.trim()) {
        if (stored !== value) {
          setTaskText(stored);
          value = stored;
          trimmed = stored.trim();
        }
      }
    }
    if (!trimmed) {
      try {
        const getExamples = state.config.getExamples;
        const getActiveExampleIndex = state.config.getActiveExampleIndex;
        const extractDescriptionFromExample = state.config.extractDescriptionFromExample;
        if (typeof getExamples === 'function' && typeof getActiveExampleIndex === 'function') {
          const examples = getExamples();
          const index = getActiveExampleIndex(examples);
          if (index != null && typeof extractDescriptionFromExample === 'function') {
            const example = examples[index];
            const fallback = extractDescriptionFromExample(example);
            if (fallback && typeof fallback === 'string' && fallback.trim()) {
              setTaskText(fallback);
              value = fallback;
              trimmed = fallback.trim();
            }
          }
        }
      } catch (error) {
        if (error && typeof error.message === 'string' && error.message.includes('descriptionInput')) {
          if (!state.taskModeDescriptionRenderRetryScheduled) {
            state.taskModeDescriptionRenderRetryScheduled = true;
            setTimeout(() => {
              state.taskModeDescriptionRenderRetryScheduled = false;
              try {
                ensureTaskModeDescriptionRendered();
              } catch (_) {}
            }, 0);
          }
          return;
        }
        return;
      }
      if (!trimmed) return;
    }
    const renderResult = renderDescriptionPreviewFromValue(value, { force: true, bypassFormattingCheck: true });
    if (renderResult === true) return;
    if (renderResult == null) return;
    if (renderResult !== false) return;
    const preview = getDescriptionPreviewElement();
    if (!preview) return;
    clearChildren(preview);
    preview.textContent = trimmed;
    preview.dataset.empty = 'false';
    preview.removeAttribute('hidden');
    preview.setAttribute('aria-hidden', 'false');
  }

  function updateDescriptionCollapsedState(target) {
    const input = target && target.nodeType === 1 ? target : getDescriptionInput();
    if (!input || typeof input.value !== 'string') return;
    const container = input.closest('.example-description');
    if (!container) return;
    container.classList.remove('example-description--collapsed');
  }

  function resolveAppModeForListeners() {
    const mode = getAppMode();
    if (mode) return mode;
    if (typeof document !== 'undefined' && document.body && document.body.dataset) {
      return document.body.dataset.appMode || 'default';
    }
    return 'default';
  }

  function ensureDescriptionListeners(input) {
    if (!input || state.descriptionInputsWithListeners.has(input)) return;
    state.descriptionInputsWithListeners.add(input);
    const update = () => {
      updateDescriptionCollapsedState(input);
      renderDescriptionPreviewFromValue(input.value);
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
    input.addEventListener('focus', update);
    input.addEventListener('blur', update);
    const container = input.closest('.example-description');
    if (container && !state.descriptionContainersWithListeners.has(container)) {
      const handleContainerClick = event => {
        if (!input) return;
        if (event && event.defaultPrevented) return;
        const target = event && event.target;
        const preview = container.querySelector('.example-description-preview');
        const targetIsInput = target && typeof target.closest === 'function' && target.closest('textarea') === input;
        if (targetIsInput) return;
        const targetIsTaskInput =
          target &&
          typeof target.closest === 'function' &&
          (target.closest('.math-vis-answerbox__input') || target.closest('[data-task-check-host]'));
        if (targetIsTaskInput) return;
        if (resolveAppModeForListeners() === 'task') {
          const clickedPreview = preview && preview.contains(target);
          const previewHidden = !preview || preview.hasAttribute('hidden') || preview.dataset.empty === 'true';
          if (clickedPreview || previewHidden) {
            setTaskModeDescriptionEditing(true, { focus: true });
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
          }
          return;
        }
        if (typeof input.focus === 'function' && document.activeElement !== input) {
          try {
            input.focus({ preventScroll: true });
          } catch (_) {
            try {
              input.focus();
            } catch (_) {}
          }
        }
      };
      container.addEventListener('click', handleContainerClick);
      state.descriptionContainersWithListeners.add(container);
    }
    setTimeout(update, 0);
  }

  function getDescriptionInput() {
    if (state.descriptionInput && state.descriptionInput.isConnected) return state.descriptionInput;
    state.descriptionInput = document.getElementById('exampleDescription');
    if (state.descriptionInput) ensureDescriptionListeners(state.descriptionInput);
    return state.descriptionInput || null;
  }

  function createTaskPanelElement(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const panel = document.createElement('div');
    panel.id = 'taskPanel';
    panel.className = 'card task-panel';
    panel.hidden = true;
    const title = document.createElement('h3');
    title.textContent = opts.title || 'Oppgave';
    panel.appendChild(title);
    const textarea = document.createElement('textarea');
    textarea.id = 'taskModeDescription';
    textarea.className = 'task-text-editable';
    textarea.placeholder = opts.placeholder || 'Klikk her for å skrive oppgavetekst...';
    panel.appendChild(textarea);
    return panel;
  }

  function createExampleDescriptionElement(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const container = document.createElement('div');
    container.className = 'example-description';
    if (opts.label) {
      const label = document.createElement('label');
      label.setAttribute('for', 'exampleDescription');
      label.textContent = opts.label;
      if (opts.labelStyle) {
        label.style.cssText = opts.labelStyle;
      }
      container.appendChild(label);
    }
    const textarea = document.createElement('textarea');
    textarea.id = 'exampleDescription';
    textarea.placeholder = opts.placeholder || 'Skriv oppgavetekst her';
    if (opts.ariaLabel) {
      textarea.setAttribute('aria-label', opts.ariaLabel);
    } else if (!opts.label) {
      textarea.setAttribute('aria-label', 'Oppgavetekst (valgfritt)');
    }
    container.appendChild(textarea);
    const checkHostType = opts.checkHostType || 'default';
    const checkHost = document.createElement('div');
    if (checkHostType === 'check-area') {
      checkHost.id = opts.checkHostId || 'checkArea';
      checkHost.className = opts.checkHostClass || 'checkbar';
    } else {
      checkHost.className = opts.checkHostClass || 'task-check-host';
      checkHost.hidden = opts.checkHostHidden !== false;
      const button = document.createElement('button');
      button.id = 'btnCheck';
      button.className = 'btn btn--task-check';
      button.type = 'button';
      button.textContent = opts.checkButtonLabel || 'Sjekk svar';
      checkHost.appendChild(button);
      const status = document.createElement('div');
      status.id = 'taskStatus';
      status.className = 'status';
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.hidden = true;
      checkHost.appendChild(status);
    }
    checkHost.dataset.taskCheckHost = 'true';
    container.appendChild(checkHost);
    return container;
  }

  function resolveTaskTextMountRoot(container) {
    if (!container) return document;
    if (container.nodeType === 9) return container;
    if (container.nodeType === 1) return container;
    return null;
  }

  function findMountSlot(root, attribute) {
    if (!root || typeof root.querySelector !== 'function') return null;
    if (root.nodeType === 1 && root.hasAttribute && root.hasAttribute(attribute)) return root;
    return root.querySelector(`[${attribute}]`);
  }

  function getSlotOptions(slot) {
    if (!slot || !slot.dataset) return {};
    return {
      title: slot.dataset.taskTextTitle,
      placeholder: slot.dataset.taskTextPlaceholder,
      ariaLabel: slot.dataset.taskTextAriaLabel,
      label: slot.dataset.taskTextLabel,
      labelStyle: slot.dataset.taskTextLabelStyle,
      checkHostType: slot.dataset.taskTextCheckHost,
      checkHostClass: slot.dataset.taskTextCheckHostClass,
      checkHostId: slot.dataset.taskTextCheckHostId,
      checkHostHidden:
        slot.dataset.taskTextCheckHostHidden === 'false'
          ? false
          : slot.dataset.taskTextCheckHostHidden === 'true'
            ? true
            : undefined
    };
  }

  function mountTaskText(container) {
    if (typeof document === 'undefined') return null;
    const root = resolveTaskTextMountRoot(container);
    if (!root) return null;
    const result = {};
    if (!document.getElementById('taskPanel')) {
      const panelSlot = findMountSlot(root, 'data-task-text-panel');
      if (panelSlot) {
        const panel = createTaskPanelElement(getSlotOptions(panelSlot));
        panelSlot.appendChild(panel);
        result.taskPanel = panel;
      }
    } else {
      result.taskPanel = document.getElementById('taskPanel');
    }
    if (!document.getElementById('exampleDescription')) {
      const descriptionSlot = findMountSlot(root, 'data-task-text-description');
      if (descriptionSlot) {
        const description = createExampleDescriptionElement(getSlotOptions(descriptionSlot));
        descriptionSlot.appendChild(description);
        result.description = description;
      }
    } else {
      result.description = document.querySelector('.example-description');
    }
    return result;
  }

  function initClickToEditBehavior() {
    if (typeof document === 'undefined') return;
    document.addEventListener('click', event => {
      const body = document.body;
      if (!body || body.dataset.appMode !== 'task') return;
      const preview = event.target && event.target.closest('.example-description-preview');
      if (!preview) return;
      const container = preview.closest('.example-description');
      if (!container) return;
      setTaskModeDescriptionEditing(true, { focus: true });
    });

    document.addEventListener('focusout', event => {
      const target = event && event.target;
      const body = document.body;
      if (!target || !body || body.dataset.appMode !== 'task') return;
      if (target.tagName !== 'TEXTAREA' || target.id !== 'exampleDescription') return;
      const container = target.closest('.example-description');
      if (!container) return;
      setTimeout(() => {
        if (!document.body || document.body.dataset.appMode !== 'task') return;
        const active = document.activeElement;
        if (active && container.contains(active)) return;
        setTaskModeDescriptionEditing(false, { force: true });
        renderDescriptionPreviewFromValue(target.value, { force: true });
      }, 100);
    });
  }

  function applyTaskPreviewValue(value, options) {
    if (!state.taskPanelPreview) return;
    const opts = options && typeof options === 'object' ? options : {};
    const stringValue = typeof value === 'string' ? value : '';
    const hasContent = !!stringValue.trim();
    state.taskPanelPreview.dataset.placeholder = hasContent ? 'false' : 'true';
    if (opts.skipTextUpdate) return;
    state.taskPanelPreview.textContent = hasContent ? stringValue : 'Oppgave';
  }

  function readTaskPreviewValue() {
    if (!state.taskPanelPreview) return '';
    const raw =
      typeof state.taskPanelPreview.innerText === 'string'
        ? state.taskPanelPreview.innerText
        : state.taskPanelPreview.textContent || '';
    if (state.taskPanelPreview.dataset.placeholder === 'true') {
      return '';
    }
    return raw.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  }

  function ensureTaskPanelUi(taskInput) {
    if (state.taskPanelPreview && state.taskPanelPreview.isConnected && state.taskPanelUpdateButton && state.taskPanelUpdateButton.isConnected) {
      return true;
    }
    const taskPanel = document.getElementById('taskPanel');
    if (!taskPanel || !taskInput) return false;
    let body = taskPanel.querySelector('.task-panel__body');
    if (!body) {
      body = document.createElement('div');
      body.className = 'task-panel__body';
      if (taskInput.parentElement === taskPanel) {
        taskPanel.insertBefore(body, taskInput);
      } else {
        taskPanel.appendChild(body);
      }
    }
    if (!state.taskPanelPreview) {
      state.taskPanelPreview = document.createElement('div');
      state.taskPanelPreview.className = 'task-panel__preview';
      state.taskPanelPreview.contentEditable = 'true';
      state.taskPanelPreview.setAttribute('role', 'textbox');
      state.taskPanelPreview.tabIndex = 0;
      state.taskPanelPreview.spellcheck = true;
      state.taskPanelPreview.setAttribute('aria-label', 'Oppgavetekst');
      state.taskPanelPreview.dataset.placeholder = 'true';
      body.appendChild(state.taskPanelPreview);
    }
    let actions = taskPanel.querySelector('.task-panel__actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'task-panel__actions';
      taskPanel.appendChild(actions);
    }
    state.taskPanelUpdateButton = actions.querySelector('[data-task-update]');
    if (!state.taskPanelUpdateButton) {
      state.taskPanelUpdateButton = document.createElement('button');
      state.taskPanelUpdateButton.type = 'button';
      state.taskPanelUpdateButton.className = 'btn';
      state.taskPanelUpdateButton.dataset.taskUpdate = 'true';
      state.taskPanelUpdateButton.textContent = 'Oppdater oppgavetekst';
      actions.appendChild(state.taskPanelUpdateButton);
    }
    return true;
  }

  function initTaskDescriptionSync() {
    if (state.taskDescriptionSyncInitialized) return;
    const sidebarInput = document.getElementById('exampleDescription');
    const taskInput = document.getElementById('taskModeDescription');
    if (!sidebarInput || !taskInput) return;
    state.taskDescriptionSyncInitialized = true;
    if (!ensureTaskPanelUi(taskInput)) return;

    const syncFromSidebar = () => {
      const normalizedMode = normalizeMode(getAppMode());
      if (normalizedMode === 'task') {
        const context = resolveActiveExampleContext();
        const stored = context.exampleId ? readTaskTextFromStorage(context.exampleId) : null;
        if (stored && stored.trim()) {
          taskInput.value = stored;
          sidebarInput.value = stored;
          applyTaskPreviewValue(stored);
          return;
        }
      }
      taskInput.value = sidebarInput.value;
      applyTaskPreviewValue(taskInput.value);
      persistTaskText(taskInput.value);
    };
    const syncFromTask = () => {
      sidebarInput.value = taskInput.value;
      sidebarInput.dispatchEvent(new Event('input'));
      applyTaskPreviewValue(taskInput.value);
      persistTaskText(taskInput.value);
    };
    const syncFromPreview = event => {
      const value = readTaskPreviewValue();
      taskInput.value = value;
      taskInput.dispatchEvent(new Event('input'));
      applyTaskPreviewValue(value, { skipTextUpdate: event && event.type === 'input' });
      persistTaskText(value);
    };

    sidebarInput.addEventListener('input', syncFromSidebar);
    taskInput.addEventListener('input', syncFromTask);
    if (state.taskPanelPreview) {
      state.taskPanelPreview.addEventListener('input', syncFromPreview);
      state.taskPanelPreview.addEventListener('blur', syncFromPreview);
    }

    if (state.taskPanelUpdateButton) {
      state.taskPanelUpdateButton.addEventListener('click', () => {
        const updateBtn = document.getElementById('btnUpdateExample');
        if (updateBtn && typeof updateBtn.click === 'function') {
          updateBtn.click();
        }
      });
    }

    syncFromSidebar();
    if (state.taskPanelPreview) {
      state.taskPanelPreview.textContent = sidebarInput.value || 'Oppgave';
      applyTaskPreviewValue(sidebarInput.value, { skipTextUpdate: true });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('math-visuals:app-mode-changed', syncFromSidebar);
      window.addEventListener('examples:loaded', syncFromSidebar);
    }
  }

  function getTaskText() {
    const input = getDescriptionInput();
    if (!input) return '';
    const value = input.value;
    return typeof value === 'string' ? value : '';
  }

  function setTaskText(value) {
    const input = getDescriptionInput();
    if (!input) return;
    if (typeof value === 'string') {
      input.value = value;
    } else {
      input.value = '';
    }
    updateDescriptionCollapsedState(input);
    renderDescriptionPreviewFromValue(input.value, { force: true });
    applyTaskPreviewValue(input.value);
  }

  function applyTaskTextForExample(example, index, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const normalizedMode = normalizeMode(getAppMode());
    if (normalizedMode !== 'task') return { applied: false, reason: 'mode' };
    const exampleId = resolveExampleIdFromExample(example, index, opts.examples);
    if (!exampleId) return { applied: false, reason: 'example-id' };
    const stored = readTaskTextFromStorage(exampleId);
    if (stored && stored.trim()) {
      setTaskText(stored);
      return { applied: true, source: 'storage', exampleId, text: stored };
    }
    return { applied: false, reason: 'empty' };
  }

  function setTaskTextMode(mode, options) {
    const target = typeof mode === 'string' ? mode.toLowerCase() : '';
    if (target === 'edit') {
      startTaskModeDescriptionEdit({ focus: false, ...(options || {}) });
      return;
    }
    if (target === 'preview') {
      setTaskModeDescriptionEditing(false, { force: true });
      renderDescriptionPreviewFromValue(getTaskText(), { force: true });
    }
  }

  function initTaskText(options) {
    setConfig(options);
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener(
          'DOMContentLoaded',
          () => {
            mountTaskText(document);
            initTaskDescriptionSync();
            initClickToEditBehavior();
          },
          { once: true }
        );
      } else {
        mountTaskText(document);
        initTaskDescriptionSync();
        initClickToEditBehavior();
      }
    }
  }

  const taskTextApi = {
    init: initTaskText,
    getTaskText,
    setTaskText,
    getText: getTaskText,
    setText: setTaskText,
    mount: mountTaskText,
    setMode: setTaskTextMode,
    getDescriptionInput,
    getDescriptionPreviewElement,
    renderDescriptionPreviewFromValue,
    updateDescriptionEditVisibilityForMode,
    setEditing: setTaskModeDescriptionEditing,
    isEditing: () => state.taskModeDescriptionEditing,
    startEditing: startTaskModeDescriptionEdit,
    stopEditing: stopTaskModeDescriptionEdit,
    ensureTaskModeDescriptionRendered,
    applyTaskTextForExample
  };

  const DEFAULT_APP_MODE = 'default';
  const APP_MODE_ALIASES = {
    task: 'task',
    tasks: 'task',
    oppgave: 'task',
    oppgaver: 'task',
    oppgavemodus: 'task',
    student: 'task',
    elev: 'task',
    preview: 'task',
    forhåndsvisning: 'task',
    forhandsvisning: 'task',
    default: DEFAULT_APP_MODE,
    standard: DEFAULT_APP_MODE,
    teacher: DEFAULT_APP_MODE,
    undervisning: DEFAULT_APP_MODE,
    edit: DEFAULT_APP_MODE,
    rediger: DEFAULT_APP_MODE,
    author: DEFAULT_APP_MODE,
    editor: DEFAULT_APP_MODE
  };
  const originalSplitSideWidths = new WeakMap();
  let currentAppMode = DEFAULT_APP_MODE;
  let lastAppliedAppMode = null;
  let splitterObserver = null;
  let splitterObserverStarted = false;
  let pendingAppModeForBody = null;
  let pendingAppModeApplyScheduled = false;
  let appModeInitialized = false;

  function normalizeAppMode(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return null;
    if (APP_MODE_ALIASES[trimmed]) return APP_MODE_ALIASES[trimmed];
    if (trimmed === 'preview-mode') return 'task';
    if (trimmed === 'task-mode') return 'task';
    return null;
  }

  function getAppMode() {
    return currentAppMode;
  }

  function applyExampleNavigationVisibilityForMode(mode) {
    if (typeof document === 'undefined') return;
    const normalized = normalizeAppMode(mode) || DEFAULT_APP_MODE;
    const isTaskMode = normalized === 'task';
    const nav = document.getElementById('exampleTabs');
    if (!nav) return;
    if (isTaskMode) {
      nav.setAttribute('hidden', '');
      nav.setAttribute('aria-hidden', 'true');
      nav.style.display = 'none';
    } else {
      nav.removeAttribute('hidden');
      nav.setAttribute('aria-hidden', 'false');
      nav.style.removeProperty('display');
    }
  }

  function adjustSplitLayoutForMode(isTaskMode) {
    if (typeof document === 'undefined') return;
    const grids = document.querySelectorAll('.grid');
    grids.forEach(grid => {
      if (!(grid instanceof HTMLElement)) return;
      const side = grid.querySelector('.side');
      if (!side) return;
      if (isTaskMode) {
        if (!originalSplitSideWidths.has(grid)) {
          const rect = side.getBoundingClientRect();
          if (rect && Number.isFinite(rect.width) && rect.width > 0) {
            originalSplitSideWidths.set(grid, `${Math.round(rect.width)}px`);
          } else {
            const current = grid.style.getPropertyValue('--side-width');
            originalSplitSideWidths.set(grid, current || '');
          }
        }
        grid.style.setProperty('--side-width', 'min(360px, 100%)');
      } else if (originalSplitSideWidths.has(grid)) {
        const previous = originalSplitSideWidths.get(grid);
        originalSplitSideWidths.delete(grid);
        if (previous) {
          grid.style.setProperty('--side-width', previous);
        } else {
          grid.style.removeProperty('--side-width');
        }
      } else {
        grid.style.removeProperty('--side-width');
      }
    });
  }

  function applyDefaultUiForMode(mode, options) {
    if (typeof document === 'undefined') return false;
    const normalized = normalizeAppMode(mode) || DEFAULT_APP_MODE;
    const execute = targetMode => {
      if (typeof document === 'undefined') return;
      const body = document.body;
      if (!body) return;
      if (body.dataset.appMode !== targetMode) {
        body.dataset.appMode = targetMode;
      }
      const isTaskMode = targetMode === 'task';
      adjustSplitLayoutForMode(isTaskMode);
      taskTextApi.updateDescriptionEditVisibilityForMode(targetMode);
      applyExampleNavigationVisibilityForMode(targetMode);
      if (isTaskMode) {
        const raf =
          typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
            ? window.requestAnimationFrame
            : null;
        if (raf) {
          raf(() => adjustSplitLayoutForMode(true));
        } else {
          setTimeout(() => adjustSplitLayoutForMode(true), 16);
        }
      }
      lastAppliedAppMode = targetMode;
    };
    if (!document.body) {
      pendingAppModeForBody = normalized;
      if (!pendingAppModeApplyScheduled) {
        pendingAppModeApplyScheduled = true;
        const applyWhenReady = () => {
          pendingAppModeApplyScheduled = false;
          const target = pendingAppModeForBody != null ? pendingAppModeForBody : currentAppMode;
          pendingAppModeForBody = null;
          if (document.body) {
            execute(target);
          } else if (typeof window !== 'undefined') {
            setTimeout(applyWhenReady, 16);
          }
        };
        const schedule = () => {
          if (document.body) {
            applyWhenReady();
          } else if (typeof window !== 'undefined') {
            setTimeout(schedule, 16);
          }
        };
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', schedule, { once: true });
        } else {
          schedule();
        }
      }
      return false;
    }
    execute(normalized);
    return true;
  }

  function setTaskModeDescriptionEditing(enabled, options) {
    if (!taskTextApi || typeof taskTextApi.setEditing !== 'function') return;
    taskTextApi.setEditing(enabled, options);
  }

  function getActiveToolApi() {
    if (!global) return null;
    const mv = global.mathVisuals && typeof global.mathVisuals === 'object' ? global.mathVisuals : null;
    if (mv) {
      if (typeof mv.getActiveTool === 'function') {
        try {
          const tool = mv.getActiveTool();
          if (tool && typeof tool === 'object') return tool;
        } catch (_) {}
      }
      if (mv.activeTool && typeof mv.activeTool === 'object') {
        return mv.activeTool;
      }
    }
    const examplesApi = global.MathVisExamples && typeof global.MathVisExamples === 'object' ? global.MathVisExamples : null;
    if (examplesApi) {
      if (typeof examplesApi.getActiveTool === 'function') {
        try {
          const tool = examplesApi.getActiveTool();
          if (tool && typeof tool === 'object') return tool;
        } catch (_) {}
      }
      if (examplesApi.activeTool && typeof examplesApi.activeTool === 'object') {
        return examplesApi.activeTool;
      }
    }
    return null;
  }

  function applyActiveToolPreviewState(mode) {
    const tool = getActiveToolApi();
    if (!tool) return;
    const isReadOnly = mode === 'task';
    if (typeof tool.setReadOnlyPreview === 'function') {
      tool.setReadOnlyPreview(isReadOnly);
    }
    if (typeof tool.setPreviewMode === 'function') {
      tool.setPreviewMode(isReadOnly);
    }
    if (!isReadOnly && typeof tool.setEditMode === 'function') {
      tool.setEditMode();
    }
  }

  function postParentAppMode(mode) {
    if (typeof window === 'undefined') return;
    if (!window.parent || window.parent === window) return;
    try {
      window.parent.postMessage(
        {
          type: 'math-visuals:mode-change',
          mode
        },
        '*'
      );
    } catch (error) {}
  }

  function setAppMode(mode, options) {
    const normalized = normalizeAppMode(mode) || DEFAULT_APP_MODE;
    const opts = options && typeof options === 'object' ? options : {};
    const notifyParent = opts.notifyParent !== false;
    const force = opts.force === true;
    const changed = normalized !== currentAppMode;
    currentAppMode = normalized;
    if (force || normalized !== lastAppliedAppMode) {
      applyDefaultUiForMode(normalized);
    }
    applyActiveToolPreviewState(normalized);
    if (normalized === 'task') {
      taskTextApi.ensureTaskModeDescriptionRendered();
      setTaskModeDescriptionEditing(true, { force: true, focus: false });
    } else {
      setTaskModeDescriptionEditing(false, { force: true });
    }
    if (notifyParent && (changed || opts.alwaysNotify === true)) {
      postParentAppMode(normalized);
    }
    if ((changed || force) && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(
          new CustomEvent('math-visuals:app-mode-changed', {
            detail: {
              mode: normalized
            }
          })
        );
      } catch (error) {}
    }
    return normalized;
  }

  function parseInitialAppMode() {
    if (typeof window === 'undefined') return null;
    try {
      if (typeof URLSearchParams !== 'undefined') {
        const params = new URLSearchParams(window.location && window.location.search ? window.location.search : '');
        const fromQuery = normalizeAppMode(params.get('mode'));
        if (fromQuery) return fromQuery;
      }
    } catch (error) {}
    return null;
  }

  function requestParentAppMode() {
    if (typeof window === 'undefined') return;
    if (!window.parent || window.parent === window) return;
    try {
      window.parent.postMessage(
        {
          type: 'math-visuals:request-mode'
        },
        '*'
      );
    } catch (error) {}
  }

  function handleParentMessage(event) {
    if (!event) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'math-visuals:mode-change') {
      setAppMode(data.mode, {
        notifyParent: false
      });
    }
  }

  function handleLocalModeEvent(event) {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail !== 'object') return;
    setAppMode(detail.mode, {
      notifyParent: detail.notifyParent !== false,
      force: detail.force === true
    });
  }

  function ensureSplitterObserver() {
    if (typeof document === 'undefined') return;
    if (typeof MutationObserver !== 'function') return;
    if (splitterObserver) return;
    splitterObserver = new MutationObserver(mutations => {
      if (currentAppMode !== 'task') return;
      let shouldAdjust = false;
      mutations.forEach(mutation => {
        if (shouldAdjust) return;
        if (!mutation.addedNodes) return;
        mutation.addedNodes.forEach(node => {
          if (shouldAdjust) return;
          if (node && node.nodeType === 1) {
            const element = node;
            if (element.classList && element.classList.contains('splitter')) {
              shouldAdjust = true;
              return;
            }
            if (element.querySelector && element.querySelector('.splitter')) {
              shouldAdjust = true;
            }
          }
        });
      });
      if (shouldAdjust) {
        adjustSplitLayoutForMode(true);
      }
    });
    const startObserving = () => {
      if (!document.body || !splitterObserver || splitterObserverStarted) return;
      splitterObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
      splitterObserverStarted = true;
    };
    if (!document.body) {
      const initWhenReady = () => {
        if (document.body) {
          startObserving();
        } else if (typeof window !== 'undefined') {
          setTimeout(initWhenReady, 16);
        }
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initWhenReady, { once: true });
      } else {
        initWhenReady();
      }
      return;
    }
    startObserving();
  }

  function onModeChange(callback, options) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const opts = options && typeof options === 'object' ? options : {};
    const handler = event => {
      const detail = event && typeof event.detail === 'object' ? event.detail : {};
      const nextMode = normalizeAppMode(detail.mode != null ? detail.mode : getAppMode()) || DEFAULT_APP_MODE;
      callback(nextMode, event);
    };
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('math-visuals:app-mode-changed', handler);
    }
    if (opts.immediate !== false) {
      callback(getAppMode(), null);
    }
    return () => {
      if (typeof global.removeEventListener === 'function') {
        global.removeEventListener('math-visuals:app-mode-changed', handler);
      }
    };
  }

  function ensureMathVisualsGlobal() {
    if (!global) return;
    global.mathVisuals =
      global.mathVisuals && typeof global.mathVisuals === 'object' ? global.mathVisuals : {};
    global.mathVisuals.applyAppMode = mode => applyDefaultUiForMode(mode);
    global.mathVisuals.setAppMode = (mode, options) => setAppMode(mode, options);
    global.mathVisuals.getAppMode = () => currentAppMode;
    global.mathVisuals.startTaskDescriptionEdit = options => taskTextApi.startEditing(options);
    global.mathVisuals.stopTaskDescriptionEdit = () => taskTextApi.stopEditing();
    if (!global.mathVisuals.settings && global.MathVisualsSettings) {
      global.mathVisuals.settings = global.MathVisualsSettings;
    }
    global.mathVisuals.getTaskText = taskTextApi.getTaskText;
    global.mathVisuals.setTaskText = taskTextApi.setTaskText;
  }

  function attachSettings(settingsApi) {
    if (!settingsApi || typeof settingsApi !== 'object') return;
    ensureMathVisualsGlobal();
    if (global.mathVisuals && !global.mathVisuals.settings) {
      global.mathVisuals.settings = settingsApi;
    }
  }

  function initAppMode() {
    if (appModeInitialized) return;
    appModeInitialized = true;
    ensureSplitterObserver();
    const initialAppMode = parseInitialAppMode() || DEFAULT_APP_MODE;
    setAppMode(initialAppMode, {
      notifyParent: false,
      force: true
    });
    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleParentMessage);
      window.addEventListener('math-visuals:set-mode', handleLocalModeEvent);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('math-visuals:set-mode', handleLocalModeEvent);
    }
    if (typeof window !== 'undefined') {
      if (window.parent && window.parent !== window) {
        const request = () => {
          requestParentAppMode();
        };
        if (document && (document.readyState === 'interactive' || document.readyState === 'complete')) {
          request();
        } else if (document) {
          document.addEventListener('DOMContentLoaded', request, {
            once: true
          });
        } else {
          request();
        }
      }
    }
    ensureMathVisualsGlobal();
  }

  function cleanJSON(value) {
    if (value == null) return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return null;
    }
  }

  const APP_API_CONTRACT = Object.freeze({
    figure: Object.freeze({
      render: 'render(example)',
      update: 'update(example)',
      destroy: 'destroy()'
    }),
    cleanJSON
  });

  function pickAppApi(app) {
    if (!app || typeof app !== 'object') return null;
    const figure = {};
    ['render', 'update', 'destroy'].forEach(key => {
      if (typeof app[key] === 'function') {
        figure[key] = app[key].bind(app);
      }
    });
    const cleanJSONFn = typeof app.cleanJSON === 'function' ? app.cleanJSON.bind(app) : cleanJSON;
    return {
      figure,
      cleanJSON: cleanJSONFn
    };
  }

  function init(options) {
    initTaskText({
      ...options,
      getAppMode,
      setAppMode,
      normalizeAppMode
    });
    initAppMode();
    ensureMathVisualsGlobal();
  }

  global.MathVisualsTaskCore = {
    init,
    getAppMode,
    setAppMode,
    onModeChange,
    normalizeAppMode,
    applyDefaultUi: applyDefaultUiForMode,
    taskText: taskTextApi,
    appContract: APP_API_CONTRACT,
    pickAppApi,
    cleanJSON,
    attachSettings
  };

  global.MathVisualsTaskText = taskTextApi;
  global.MathVisualsAppMode = {
    normalizeMode: normalizeAppMode,
    setAppMode,
    onModeChanged: onModeChange
  };

  initAppMode();
  if (typeof global.dispatchEvent === 'function') {
    try {
      global.dispatchEvent(new CustomEvent('math-visuals:task-core-ready'));
    } catch (_) {}
  }
})(typeof window !== 'undefined' ? window : undefined);
