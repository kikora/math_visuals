const MODULE_NOT_FOUND_CODES = new Set(['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'ERR_REQUIRE_ESM']);

let cachedExports;

function isValidColor(value) {
  return typeof value === 'string' && value.trim().length > 0;
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

function createFallbackService() {
  const ensurePalette = fallbackEnsurePalette;
  return {
    paletteService: {
      resolveGroupPalette(options = {}) {
        const fallback = Array.isArray(options.fallback)
          ? options.fallback.filter(isValidColor)
          : [];
        const count = Number.isFinite(options.count) && options.count > 0
          ? Math.trunc(options.count)
          : fallback.length;
        return ensurePalette([], fallback, count);
      }
    },
    ensurePalette
  };
}

function resolveGlobalPaletteService() {
  const scopes = [];
  if (typeof globalThis !== 'undefined') scopes.push(globalThis);
  if (typeof window !== 'undefined' && window !== globalThis) scopes.push(window);
  if (typeof global !== 'undefined' && global !== globalThis) scopes.push(global);
  for (const scope of scopes) {
    if (!scope || typeof scope !== 'object') continue;
    const groupPalette = scope.MathVisualsGroupPalette;
    if (!groupPalette || typeof groupPalette !== 'object') continue;
    const service = groupPalette.service || groupPalette.paletteService || groupPalette;
    if (service && typeof service.resolveGroupPalette === 'function') {
      const ensurePalette = typeof groupPalette.ensurePalette === 'function'
        ? groupPalette.ensurePalette.bind(groupPalette)
        : typeof service.ensurePalette === 'function'
          ? service.ensurePalette.bind(service)
          : undefined;
      return {
        paletteService: service,
        ensurePalette: ensurePalette || fallbackEnsurePalette
      };
    }
  }
  return null;
}

function requirePaletteModule() {
  if (typeof require !== 'function') {
    return null;
  }
  try {
    return require('./palette-service.js');
  } catch (error) {
    if (!error || !MODULE_NOT_FOUND_CODES.has(error.code)) {
      throw error;
    }
  }
  return null;
}

function loadPaletteService() {
  if (cachedExports) {
    return cachedExports;
  }
  const moduleExports = requirePaletteModule();
  if (moduleExports && moduleExports.paletteService) {
    cachedExports = moduleExports;
    return cachedExports;
  }
  const globalExports = resolveGlobalPaletteService();
  if (globalExports) {
    cachedExports = globalExports;
    return cachedExports;
  }
  cachedExports = createFallbackService();
  return cachedExports;
}

module.exports = loadPaletteService();
