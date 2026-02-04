(function (globalScope) {
  function sanitizePalette(values) {
    if (!Array.isArray(values)) return [];
    return values
      .map(color => (typeof color === 'string' ? color.trim() : ''))
      .filter(Boolean);
  }

  function createAdapterFromModule(paletteModule) {
    if (!paletteModule || typeof paletteModule !== 'object') {
      paletteModule = {};
    }

    const service = paletteModule.service && typeof paletteModule.service === 'object'
      ? paletteModule.service
      : null;

    const ensureFn = typeof paletteModule.ensure === 'function'
      ? paletteModule.ensure.bind(paletteModule)
      : null;

    function resolveWithEnsure(options = {}) {
      const fallback = sanitizePalette(options.fallback);
      const count = Number.isFinite(options.count) && options.count > 0
        ? Math.trunc(options.count)
        : fallback.length;
      return ensureFn([], fallback, count);
    }

    function resolveWithFallback(options = {}) {
      return sanitizePalette(options.fallback);
    }

    const resolver = service && typeof service.resolveGroupPalette === 'function'
      ? options => service.resolveGroupPalette(options)
      : typeof paletteModule.resolveGroupPalette === 'function'
        ? options => paletteModule.resolveGroupPalette(options)
        : ensureFn
          ? resolveWithEnsure
          : resolveWithFallback;

    return {
      resolveGroupPalette(options) {
        return resolver(options);
      }
    };
  }

  const paletteModule = typeof require === 'function'
    ? require('./resolve-palette-service.js')
    : ((globalScope && typeof globalScope.MathVisualsGroupPalette === 'object')
      ? globalScope.MathVisualsGroupPalette
      : {});

  const adapter = createAdapterFromModule(paletteModule);

  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = adapter;
    module.exports.createPaletteServiceAdapter = createAdapterFromModule;
  }

  if (globalScope && typeof globalScope === 'object') {
    globalScope.MathVisualsPaletteServiceAdapter = adapter;
    if (!globalScope.MathVisualsCreatePaletteServiceAdapter) {
      globalScope.MathVisualsCreatePaletteServiceAdapter = createAdapterFromModule;
    }
  }
})(typeof globalThis !== 'undefined'
  ? globalThis
  : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
      ? global
      : this);
