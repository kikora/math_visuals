(function (global) {
  const paletteModule = loadPalettePackage();
  const moduleExports = unwrapPaletteModule(paletteModule);
  const service = moduleExports && typeof moduleExports.createPaletteService === 'function'
    ? moduleExports.createPaletteService()
    : null;
  const ensure = moduleExports && typeof moduleExports.ensurePalette === 'function'
    ? moduleExports.ensurePalette
    : null;
  const resolver = moduleExports && typeof moduleExports.resolveGroupPalette === 'function'
    ? moduleExports.resolveGroupPalette
    : null;

  const legacy = buildLegacyGroupPalette();
  const ensureFn = ensure ? (palette, fallbackPalette, count) => ensure(palette, fallbackPalette, count) : legacy.ensure;
  const resolveFn = service
    ? options => service.resolveGroupPalette(options)
    : typeof resolver === 'function'
    ? resolver
    : legacy.resolve;

  const targetApi = {
    ensure: ensureFn,
    resolve: resolveFn,
    resolveGroupPalette: resolveFn
  };
  if (service) {
    targetApi.service = service;
  }

  if (typeof global !== 'undefined' && global && typeof global === 'object') {
    global.MathVisualsGroupPalette = targetApi;
  }
  if (typeof window !== 'undefined' && window && typeof window === 'object') {
    window.MathVisualsGroupPalette = targetApi;
  }
  if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis === 'object') {
    globalThis.MathVisualsGroupPalette = targetApi;
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = targetApi;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);

let groupPaletteAttemptedGlobalLoad = false;

function unwrapPaletteModule(value) {
  if (!value) return null;
  if (value.PALETTE_CONFIG || value.createPaletteService) {
    return value;
  }
  if (value.default) {
    return unwrapPaletteModule(value.default);
  }
  return value;
}

function resolveGlobalPackage() {
  if (typeof MathVisualsPalettePackage !== 'undefined' && MathVisualsPalettePackage) {
    return MathVisualsPalettePackage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.MathVisualsPalettePackage) {
    return globalThis.MathVisualsPalettePackage;
  }
  if (typeof window !== 'undefined' && window.MathVisualsPalettePackage) {
    return window.MathVisualsPalettePackage;
  }
  if (typeof global !== 'undefined' && global.MathVisualsPalettePackage) {
    return global.MathVisualsPalettePackage;
  }
  return null;
}

function tryLoadGlobalBundle(currentScript) {
  if (groupPaletteAttemptedGlobalLoad) return resolveGlobalPackage();
  groupPaletteAttemptedGlobalLoad = true;
  if (typeof document === 'undefined' || typeof XMLHttpRequest === 'undefined') {
    return resolveGlobalPackage();
  }
  const scriptUrl = currentScript && currentScript.src ? currentScript.src : document.currentScript && document.currentScript.src;
  if (!scriptUrl) {
    return resolveGlobalPackage();
  }
  let bundleUrl = null;
  try {
    bundleUrl = new URL('../packages/palette/dist/index.global.js', scriptUrl).toString();
  } catch (_) {
    return resolveGlobalPackage();
  }
  try {
    const request = new XMLHttpRequest();
    request.open('GET', bundleUrl, false);
    request.send(null);
    if (request.status >= 200 && request.status < 400) {
      const source = request.responseText;
      if (typeof source === 'string' && source) {
        (0, eval)(source);
      }
    }
  } catch (_) {}
  return resolveGlobalPackage();
}

function loadPalettePackage() {
  let palettePackage = resolveGlobalPackage();
  if (!palettePackage) {
    palettePackage = tryLoadGlobalBundle(null);
  }
  if (!palettePackage && typeof require === 'function') {
    try {
      palettePackage = require('../packages/palette/dist/index.cjs');
    } catch (error) {
      if (!error || error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') {
        try {
          palettePackage = require('../packages/palette/src/index.js');
        } catch (_) {}
      } else {
        throw error;
      }
    }
  }
  return palettePackage || null;
}

function buildLegacyGroupPalette() {
  function getThemeApi(scope) {
    const root =
      scope ||
      (typeof global !== 'undefined'
        ? global
        : typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
        ? globalThis
        : null);
    if (!root) return null;
    const theme = root.MathVisualsTheme;
    return theme && typeof theme === 'object' ? theme : null;
  }

  function getPaletteApi(scope) {
    const root =
      scope ||
      (typeof global !== 'undefined'
        ? global
        : typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
        ? globalThis
        : null);
    if (!root) return null;
    const api = root.MathVisualsPalette;
    return api && typeof api.getGroupPalette === 'function' ? api : null;
  }

  function sanitizeColor(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(trimmed);
    if (!match) return trimmed.startsWith('var(') ? trimmed : null;
    let hex = match[1];
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    } else if (hex.length === 4) {
      hex = hex
        .split('')
        .slice(0, 3)
        .map(ch => ch + ch)
        .join('');
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    return `#${hex.toLowerCase()}`;
  }

  function sanitizePalette(values) {
    if (!Array.isArray(values)) return [];
    const out = [];
    for (const value of values) {
      const sanitized = sanitizeColor(value);
      if (sanitized) {
        out.push(sanitized);
      }
    }
    return out;
  }

  function ensurePalette(base, fallback, count) {
    const basePalette = sanitizePalette(base);
    const fallbackPalette = sanitizePalette(fallback);
    if (!Number.isFinite(count) || count <= 0) {
      if (basePalette.length) return basePalette.slice();
      if (fallbackPalette.length) return fallbackPalette.slice();
      return basePalette.length ? basePalette.slice() : fallbackPalette.slice();
    }
    const size = Math.max(1, Math.trunc(count));
    const result = [];
    for (let index = 0; index < size; index += 1) {
      const primary = basePalette[index];
      if (typeof primary === 'string' && primary) {
        result.push(primary);
        continue;
      }
      if (fallbackPalette.length) {
        const fallbackColor = fallbackPalette[index % fallbackPalette.length];
        if (typeof fallbackColor === 'string' && fallbackColor) {
          result.push(fallbackColor);
          continue;
        }
      }
      if (basePalette.length) {
        const cycled = basePalette[index % basePalette.length];
        if (typeof cycled === 'string' && cycled) {
          result.push(cycled);
        }
      }
    }
    if (!result.length && fallbackPalette.length) {
      result.push(fallbackPalette[0]);
    }
    return result;
  }

  function resolveGroupPalette(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const groupId = typeof opts.groupId === 'string' ? opts.groupId.trim().toLowerCase() : '';
    if (!groupId) {
      return ensurePalette(opts.fallback, opts.fallback, opts.count);
    }
    const count = Number.isFinite(opts.count) && opts.count > 0 ? Math.trunc(opts.count) : undefined;
    const fallback = Array.isArray(opts.fallback) ? opts.fallback : [];
    const paletteApi = getPaletteApi();
    let palette = null;
    if (paletteApi) {
      try {
        palette = paletteApi.getGroupPalette(groupId, {
          count,
          settings: opts.settings
        });
      } catch (_) {
        palette = null;
      }
    }
    if (!Array.isArray(palette) || !palette.length) {
      const theme = getThemeApi();
      if (theme && typeof theme.getGroupPalette === 'function') {
        try {
          palette = theme.getGroupPalette(groupId, count);
        } catch (_) {
          palette = null;
        }
      }
    }
    if ((!Array.isArray(palette) || !palette.length) && opts.legacyPaletteId) {
      const theme = getThemeApi();
      if (theme && typeof theme.getPalette === 'function') {
        try {
          palette = theme.getPalette(opts.legacyPaletteId, count, {
            fallbackKinds: Array.isArray(opts.fallbackKinds) ? opts.fallbackKinds : undefined
          });
        } catch (_) {
          palette = null;
        }
      }
    }
    return ensurePalette(palette, fallback, count);
  }

  return {
    ensure: ensurePalette,
    resolve: resolveGroupPalette,
    resolveGroupPalette
  };
}
