(function (rootScope) {
  if (!rootScope || typeof rootScope !== 'object') return;
  if (rootScope.MathVisualsPaletteEvents && rootScope.MathVisualsPaletteEvents.__isBroker) {
    return;
  }

  const broker = createPaletteEventsBroker(rootScope);
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = broker;
  }
  rootScope.MathVisualsPaletteEvents = broker;
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
    ? global
    : this
);

function createPaletteEventsBroker(rootScope) {
  const listeners = new Set();
  let lastSerializedPalette = null;

  const paletteApi = resolvePaletteApi(rootScope);
  const settingsApi = resolveSettingsApi(rootScope);

  function resolveSettingsSnapshot(source) {
    if (source && typeof source === 'object' && typeof source.getSettings === 'function') {
      try {
        const snapshot = source.getSettings();
        if (snapshot && typeof snapshot === 'object') return snapshot;
      } catch (_) {}
    }
    return source && typeof source === 'object' ? source : {};
  }

  function cloneGroupPalettes(groupPalettes) {
    const result = {};
    if (!groupPalettes || typeof groupPalettes !== 'object') return result;
    Object.keys(groupPalettes).forEach(groupId => {
      const values = Array.isArray(groupPalettes[groupId]) ? groupPalettes[groupId].slice() : [];
      result[groupId] = values;
    });
    return result;
  }

  function normalizePalette(settings) {
    const snapshot = resolveSettingsSnapshot(settings);
    if (paletteApi && typeof paletteApi.getProjectGroupPalettes === 'function') {
      const groupPalettes = paletteApi.getProjectGroupPalettes('default', { settings: snapshot });
      const defaultColors =
        typeof paletteApi.getProjectPalette === 'function'
          ? paletteApi.getProjectPalette('default', { settings: snapshot })
          : Array.isArray(snapshot.defaultColors)
          ? snapshot.defaultColors.slice()
          : [];
      return {
        groupPalettes: cloneGroupPalettes(groupPalettes),
        defaultColors: Array.isArray(defaultColors) ? defaultColors.slice() : []
      };
    }
    const fallbackGroupPalettes = snapshot.groupPalettes || null;
    const fallbackDefaultColors = Array.isArray(snapshot.defaultColors) ? snapshot.defaultColors.slice() : [];
    if (fallbackGroupPalettes && typeof fallbackGroupPalettes === 'object') {
      return {
        groupPalettes: cloneGroupPalettes(fallbackGroupPalettes),
        defaultColors: fallbackDefaultColors
      };
    }
    if (fallbackDefaultColors.length) {
      return { defaultColors: fallbackDefaultColors };
    }
    return {};
  }

  function shouldEmitPalette(nextPalette) {
    if (!nextPalette || typeof nextPalette !== 'object') return false;
    let serialized = null;
    try {
      serialized = JSON.stringify(nextPalette);
    } catch (_) {
      serialized = null;
    }
    if (serialized && serialized === lastSerializedPalette) return false;
    lastSerializedPalette = serialized || null;
    return true;
  }

  function emitPaletteChanged(nextPalette, options) {
    if (!shouldEmitPalette(nextPalette)) return;
    const opts = options && typeof options === 'object' ? options : {};
    listeners.forEach(listener => {
      try {
        listener(nextPalette);
      } catch (_) {}
    });
    if (opts.emitEvent === false) return;
    if (
      typeof rootScope.dispatchEvent === 'function' &&
      typeof CustomEvent === 'function'
    ) {
      try {
        rootScope.dispatchEvent(new CustomEvent('math-visuals:palette-changed', { detail: nextPalette }));
      } catch (_) {}
    }
  }

  function emitFromSettings(settings, options) {
    const normalized = normalizePalette(settings);
    emitPaletteChanged(normalized, options);
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') return () => {};
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }

  function connectToSettingsApi() {
    if (!settingsApi || typeof settingsApi !== 'object') return false;
    if (typeof settingsApi.subscribe === 'function') {
      try {
        settingsApi.subscribe(snapshot => {
          emitFromSettings(snapshot);
        });
      } catch (_) {}
      return true;
    }
    return false;
  }

  function connectToSettingsEvents() {
    if (typeof rootScope.addEventListener !== 'function') return;
    rootScope.addEventListener('math-visuals:settings-changed', event => {
      const snapshot = event && event.detail && event.detail.settings;
      emitFromSettings(snapshot);
    });
  }

  const connected = connectToSettingsApi();
  if (!connected) {
    connectToSettingsEvents();
  }

  return {
    __isBroker: true,
    subscribe,
    emit: emitPaletteChanged,
    emitFromSettings,
    normalize: normalizePalette
  };
}

function resolvePaletteApi(rootScope) {
  if (rootScope && rootScope.MathVisualsPalette && typeof rootScope.MathVisualsPalette === 'object') {
    return rootScope.MathVisualsPalette;
  }
  if (typeof require === 'function') {
    const palette = require('../theme/palette.js');
    if (palette && typeof palette === 'object') {
      return palette;
    }
  }
  return null;
}

function resolveSettingsApi(rootScope) {
  if (!rootScope || typeof rootScope !== 'object') return null;
  if (rootScope.MathVisualsSettings && typeof rootScope.MathVisualsSettings === 'object') {
    return rootScope.MathVisualsSettings;
  }
  const legacy = rootScope.mathVisuals && rootScope.mathVisuals.settings;
  return legacy && typeof legacy === 'object' ? legacy : null;
}
