(function attachMathVisualsAppMode(global) {
  if (!global) return;

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
    const mv = global.mathVisuals;
    if (mv && typeof mv.getAppMode === 'function') {
      try {
        const mode = mv.getAppMode();
        if (typeof mode === 'string' && mode) {
          return normalizeMode(mode);
        }
      } catch (_) {}
    }
    const body = global.document && global.document.body;
    if (body && body.dataset && typeof body.dataset.appMode === 'string') {
      const normalized = normalizeMode(body.dataset.appMode);
      if (normalized) return normalized;
    }
    try {
      if (global.location && typeof global.location.search === 'string') {
        const params = new URLSearchParams(global.location.search);
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
    const mv = global.mathVisuals;
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
    if (typeof global.dispatchEvent === 'function') {
      try {
        global.dispatchEvent(new CustomEvent('math-visuals:set-mode', { detail }));
      } catch (_) {}
    }
    if (global.document && typeof global.document.dispatchEvent === 'function') {
      try {
        global.document.dispatchEvent(new CustomEvent('math-visuals:set-mode', { detail }));
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
    if (typeof global.addEventListener === 'function') {
      global.addEventListener('math-visuals:app-mode-changed', handler);
    }
    if (opts.immediate !== false) {
      callback(resolveCurrentMode(), null);
    }
    return () => {
      if (typeof global.removeEventListener === 'function') {
        global.removeEventListener('math-visuals:app-mode-changed', handler);
      }
    };
  }

  const attachCoreBindings = () => {
    const core = global.MathVisualsTaskCore;
    if (!core) return false;
    if (typeof core.normalizeAppMode !== 'function') return false;
    global.MathVisualsAppMode = {
      normalizeMode: core.normalizeAppMode,
      setAppMode: core.setAppMode,
      onModeChanged: core.onModeChange
    };
    return true;
  };

  if (!attachCoreBindings()) {
    global.MathVisualsAppMode = {
      normalizeMode,
      setAppMode,
      onModeChanged
    };
  }

  if (typeof global.addEventListener === 'function') {
    global.addEventListener('math-visuals:task-core-ready', () => {
      attachCoreBindings();
    });
  }
})(typeof window !== 'undefined' ? window : undefined);
