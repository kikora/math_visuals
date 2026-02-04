const PALETTE_PACKAGE_GLOBAL_KEYS = [
  'MathVisualsPalettePackage',
  'MathVisualsPalette'
];

function unwrapPaletteModule(value) {
  if (!value) return null;
  if (value.createPaletteService || value.ensurePalette) {
    return value;
  }
  if (value.default && (value.default.createPaletteService || value.default.ensurePalette)) {
    return Object.assign({}, value.default, value);
  }
  return value;
}

function resolveGlobalPalettePackage() {
  const candidates = [];
  if (typeof globalThis !== 'undefined') {
    candidates.push(globalThis);
  }
  if (typeof window !== 'undefined' && window !== globalThis) {
    candidates.push(window);
  }
  if (typeof global !== 'undefined') {
    candidates.push(global);
  }
  for (const scope of candidates) {
    if (!scope || typeof scope !== 'object') continue;
    for (const key of PALETTE_PACKAGE_GLOBAL_KEYS) {
      if (scope[key]) {
        return scope[key];
      }
    }
  }
  return null;
}

let cachedModule = null;

function loadPaletteModule() {
  if (cachedModule) return cachedModule;
  let paletteModule = resolveGlobalPalettePackage();
  if (!paletteModule && typeof require === 'function') {
    try {
      paletteModule = require('../packages/palette/dist/index.cjs');
    } catch (error) {
      if (!error || error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') {
        try {
          paletteModule = require('../packages/palette/src/index.js');
        } catch (innerError) {
          if (innerError && innerError.code && innerError.code !== 'MODULE_NOT_FOUND' && innerError.code !== 'ERR_MODULE_NOT_FOUND' && innerError.code !== 'ERR_REQUIRE_ESM') {
            throw innerError;
          }
        }
      } else {
        throw error;
      }
    }
  }
  cachedModule = unwrapPaletteModule(paletteModule) || {};
  return cachedModule;
}

function fallbackEnsurePalette(base, fallback, count) {
  const primary = Array.isArray(base) ? base.filter(isValidColor) : [];
  const backup = Array.isArray(fallback) ? fallback.filter(isValidColor) : [];
  if (!Number.isFinite(count) || count <= 0) {
    return primary.length ? primary.slice() : backup.slice();
  }
  const size = Math.max(1, Math.trunc(count));
  const result = primary.slice(0, size);
  const source = result.length ? result : backup;
  while (result.length < size && source.length) {
    result.push(source[result.length % source.length]);
  }
  if (!result.length && backup.length) {
    return backup.slice(0, size);
  }
  return result;
}

function isValidColor(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const paletteModule = loadPaletteModule();
const ensurePaletteExport = typeof paletteModule.ensurePalette === 'function'
  ? paletteModule.ensurePalette
  : fallbackEnsurePalette;

const paletteService = typeof paletteModule.createPaletteService === 'function'
  ? paletteModule.createPaletteService()
  : {
      resolveGroupPalette(options = {}) {
        const fallback = Array.isArray(options.fallback)
          ? options.fallback.filter(isValidColor)
          : [];
        const count = Number.isFinite(options.count) && options.count > 0
          ? Math.trunc(options.count)
          : fallback.length;
        return ensurePaletteExport([], fallback, count);
      }
    };

module.exports = {
  paletteService,
  ensurePalette: ensurePaletteExport
};
