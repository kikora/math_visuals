(function () {
  const globalScope =
    typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (!globalScope) return;

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

  function normalizeMode(value) {
    if (typeof value !== 'string') return DEFAULT_APP_MODE;
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return DEFAULT_APP_MODE;
    if (APP_MODE_ALIASES[trimmed]) return APP_MODE_ALIASES[trimmed];
    if (trimmed === 'preview-mode' || trimmed === 'task-mode') return 'task';
    return DEFAULT_APP_MODE;
  }

  function resolveCurrentMode() {
    if (!globalScope) return DEFAULT_APP_MODE;
    const mv = globalScope.mathVisuals;
    if (mv && typeof mv.getAppMode === 'function') {
      try {
        const mode = mv.getAppMode();
        if (typeof mode === 'string' && mode) {
          return normalizeMode(mode);
        }
      } catch (_) {}
    }
    const body = globalScope.document && globalScope.document.body;
    if (body && body.dataset && typeof body.dataset.appMode === 'string') {
      const normalized = normalizeMode(body.dataset.appMode);
      if (normalized) return normalized;
    }
    try {
      if (globalScope.location && typeof globalScope.location.search === 'string') {
        const params = new URLSearchParams(globalScope.location.search);
        const fromQuery = params.get('mode');
        if (typeof fromQuery === 'string' && fromQuery.trim()) {
          return normalizeMode(fromQuery);
        }
      }
    } catch (_) {}
    return DEFAULT_APP_MODE;
  }

  function setAppMode(mode, options) {
    const normalized = normalizeMode(mode);
    const mv = globalScope.mathVisuals;
    if (mv && typeof mv.setAppMode === 'function') {
      return mv.setAppMode(normalized, options);
    }
    const detail = {
      mode: normalized
    };
    if (options && typeof options === 'object') {
      if ('notifyParent' in options) {
        detail.notifyParent = options.notifyParent;
      }
      if ('force' in options) {
        detail.force = options.force === true;
      }
    }
    if (typeof globalScope.dispatchEvent === 'function') {
      try {
        globalScope.dispatchEvent(new CustomEvent('math-visuals:set-mode', { detail }));
      } catch (_) {}
    }
    if (globalScope.document && typeof globalScope.document.dispatchEvent === 'function') {
      try {
        globalScope.document.dispatchEvent(new CustomEvent('math-visuals:set-mode', { detail }));
      } catch (_) {}
    }
    return normalized;
  }

  function onModeChanged(callback, options) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    const opts = options && typeof options === 'object' ? options : {};
    const handler = event => {
      const detail = event && typeof event.detail === 'object' ? event.detail : {};
      const nextMode = normalizeMode(detail.mode != null ? detail.mode : resolveCurrentMode());
      callback(nextMode, event);
    };
    if (typeof globalScope.addEventListener === 'function') {
      globalScope.addEventListener('math-visuals:app-mode-changed', handler);
    }
    if (opts.immediate !== false) {
      callback(resolveCurrentMode(), null);
    }
    return () => {
      if (typeof globalScope.removeEventListener === 'function') {
        globalScope.removeEventListener('math-visuals:app-mode-changed', handler);
      }
    };
  }

  globalScope.MathVisualsAppMode = {
    normalizeMode,
    setAppMode,
    onModeChanged
  };
})();
