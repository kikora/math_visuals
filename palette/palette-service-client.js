const MODULE_NOT_FOUND_CODES = new Set(['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'ERR_REQUIRE_ESM']);

(function (rootScope) {
  const exports = loadPaletteServiceClient(rootScope);
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = exports;
  }
  if (rootScope && typeof rootScope === 'object') {
    rootScope.MathVisualsPaletteServiceClient = exports;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);

function loadPaletteServiceClient(rootScope) {
  const moduleExports = tryRequirePaletteService();
  if (moduleExports && moduleExports.paletteService && typeof moduleExports.paletteService.resolveGroupPalette === 'function') {
    return moduleExports;
  }
  const globalExports = resolveGlobalPaletteService(rootScope);
  if (globalExports && globalExports.paletteService && typeof globalExports.paletteService.resolveGroupPalette === 'function') {
    return globalExports;
  }
  return createFallbackPaletteService();
}

function tryRequirePaletteService() {
  if (typeof require !== 'function') {
    return null;
  }
  try {
    return require('./get-palette-service.js');
  } catch (error) {
    if (!error || !MODULE_NOT_FOUND_CODES.has(error.code)) {
      throw error;
    }
  }
  return null;
}

function resolveGlobalPaletteService(rootScope) {
  const scopes = [
    rootScope && typeof rootScope === 'object' ? rootScope : null,
    typeof window !== 'undefined' ? window : null,
    typeof globalThis !== 'undefined' ? globalThis : null,
    typeof global !== 'undefined' ? global : null
  ];
  for (const scope of scopes) {
    if (!scope || typeof scope !== 'object') continue;
    const groupPalette = scope.MathVisualsGroupPalette;
    if (!groupPalette || typeof groupPalette !== 'object') continue;
    const serviceCandidate = groupPalette.service && typeof groupPalette.service === 'object'
      ? groupPalette.service
      : groupPalette;
    const resolver = pickResolver(groupPalette, serviceCandidate);
    if (!resolver) continue;
    const ensure = pickEnsure(groupPalette, serviceCandidate);
    const paletteService = {
      resolveGroupPalette(options = {}) {
        const scope = resolver.scope || serviceCandidate;
        return resolver.fn.call(scope, options);
      }
    };
    return {
      paletteService,
      ensurePalette: ensure || fallbackEnsurePalette
    };
  }
  return null;
}

function pickResolver(groupPalette, serviceCandidate) {
  const candidates = [
    [serviceCandidate, serviceCandidate && serviceCandidate.resolveGroupPalette],
    [serviceCandidate, serviceCandidate && serviceCandidate.resolve],
    [groupPalette, groupPalette && groupPalette.resolveGroupPalette],
    [groupPalette, groupPalette && groupPalette.resolve]
  ];
  for (const [scope, fn] of candidates) {
    if (typeof fn === 'function') {
      return { scope, fn };
    }
  }
  return null;
}

function pickEnsure(groupPalette, serviceCandidate) {
  const candidates = [
    [serviceCandidate, serviceCandidate && serviceCandidate.ensurePalette],
    [serviceCandidate, serviceCandidate && serviceCandidate.ensure],
    [groupPalette, groupPalette && groupPalette.ensurePalette],
    [groupPalette, groupPalette && groupPalette.ensure]
  ];
  for (const [scope, fn] of candidates) {
    if (typeof fn === 'function') {
      return function ensurePalette(...args) {
        return fn.apply(scope || this, args);
      };
    }
  }
  return null;
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

function fallbackEnsurePalette(base, fallback, count) {
  const basePalette = sanitizePalette(base);
  const fallbackPalette = sanitizePalette(fallback);
  const source = basePalette.length ? basePalette : fallbackPalette;
  if (!source.length) {
    return [];
  }
  if (!Number.isFinite(count) || count <= 0) {
    return source.slice();
  }
  const size = Math.max(1, Math.trunc(count));
  const result = [];
  for (let index = 0; index < size; index += 1) {
    result.push(source[index % source.length]);
  }
  return result;
}

function createFallbackPaletteService() {
  return {
    paletteService: {
      resolveGroupPalette(options = {}) {
        const base = Array.isArray(options.base) ? options.base : [];
        const fallback = Array.isArray(options.fallback) ? options.fallback : [];
        const count = Number.isFinite(options.count) ? options.count : undefined;
        return fallbackEnsurePalette(base, fallback, count);
      }
    },
    ensurePalette: fallbackEnsurePalette
  };
}
