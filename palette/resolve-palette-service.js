const MODULE_NOT_FOUND_CODES = new Set(['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'ERR_REQUIRE_ESM']);

function resolveGlobalPaletteModule() {
  const scopes = [];
  if (typeof globalThis !== 'undefined') scopes.push(globalThis);
  if (typeof window !== 'undefined' && window !== globalThis) scopes.push(window);
  if (typeof global !== 'undefined' && global !== globalThis) scopes.push(global);
  for (const scope of scopes) {
    if (!scope || typeof scope !== 'object') continue;
    const module = scope.MathVisualsGroupPalette;
    if (module && typeof module === 'object') {
      return module;
    }
  }
  return {};
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

let cachedModule;

function resolvePaletteServiceModule() {
  if (cachedModule) {
    return cachedModule;
  }
  const moduleExports = requirePaletteModule();
  if (moduleExports && typeof moduleExports === 'object') {
    cachedModule = moduleExports;
    return cachedModule;
  }
  cachedModule = resolveGlobalPaletteModule();
  return cachedModule;
}

module.exports = resolvePaletteServiceModule();
