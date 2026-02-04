(function (root, factory) {
  const result = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = result;
  }
  if (root && typeof root === 'object') {
    if (!root.MathVisualsPaletteProjectResolver) {
      root.MathVisualsPaletteProjectResolver = result;
    } else {
      const target = root.MathVisualsPaletteProjectResolver;
      if (typeof target === 'object') {
        Object.keys(result).forEach(key => {
          if (!(key in target)) {
            target[key] = result[key];
          }
        });
      }
    }
  }
})(typeof globalThis !== 'undefined'
  ? globalThis
  : typeof window !== 'undefined'
  ? window
  : typeof global !== 'undefined'
  ? global
  : this, function () {
  const URL_PARAM_NAMES = [
    'palette-project',
    'palette_project',
    'paletteproject',
    'project',
    'mv-project',
    'mv_project',
    'mvproject'
  ];

  function normalizeProjectName(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    return trimmed || null;
  }

  function readAttribute(element, name) {
    if (!element || typeof element.getAttribute !== 'function') {
      return null;
    }
    try {
      const value = element.getAttribute(name);
      return normalizeProjectName(value);
    } catch (_) {
      return null;
    }
  }

  function readDataset(element, key) {
    if (!element || !element.dataset) return null;
    try {
      const value = element.dataset[key];
      return normalizeProjectName(value);
    } catch (_) {
      return null;
    }
  }

  function readProjectFromElement(element) {
    if (!element) return null;
    const directOverride = readDataset(element, 'project') || readAttribute(element, 'data-project');
    if (directOverride) return directOverride;
    const activeProject =
      readDataset(element, 'mvActiveProject') || readAttribute(element, 'data-mv-active-project');
    if (activeProject) return activeProject;
    const themeProfile = readDataset(element, 'themeProfile') || readAttribute(element, 'data-theme-profile');
    if (themeProfile) return themeProfile;
    return null;
  }

  function safeUrlSearchParams(input) {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      const normalized = trimmed.startsWith('?') || trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
      return new URLSearchParams(normalized);
    } catch (_) {
      return null;
    }
  }

  function readProjectFromParams(params) {
    if (!params) return null;
    for (const name of URL_PARAM_NAMES) {
      if (!params.has(name)) continue;
      const candidate = normalizeProjectName(params.get(name));
      if (candidate) return candidate;
    }
    for (const [name, value] of params.entries()) {
      if (typeof name !== 'string') continue;
      if (!/project$/i.test(name) && !/project/i.test(name)) continue;
      const candidate = normalizeProjectName(value);
      if (candidate) return candidate;
    }
    return null;
  }

  function readProjectFromLocation(locationLike) {
    if (!locationLike || typeof locationLike !== 'object') return null;
    let search = typeof locationLike.search === 'string' ? locationLike.search : '';
    let hash = typeof locationLike.hash === 'string' ? locationLike.hash : '';
    if ((!search || !hash) && typeof locationLike.href === 'string') {
      try {
        const url = new URL(locationLike.href);
        if (!search) search = url.search;
        if (!hash) hash = url.hash;
      } catch (_) {}
    }
    const searchParams = safeUrlSearchParams(search);
    const fromSearch = readProjectFromParams(searchParams);
    if (fromSearch) return fromSearch;
    const hashParams = safeUrlSearchParams(hash);
    const fromHash = readProjectFromParams(hashParams);
    if (fromHash) return fromHash;
    return null;
  }

  function getGlobalDocument(context) {
    if (context && context.document && typeof context.document === 'object') {
      return context.document;
    }
    if (typeof document !== 'undefined' && document) return document;
    return null;
  }

  function getDocumentRoot(doc, context) {
    if (context && context.root && typeof context.root.getAttribute === 'function') {
      return context.root;
    }
    if (doc && doc.documentElement && typeof doc.documentElement.getAttribute === 'function') {
      return doc.documentElement;
    }
    return null;
  }

  function getTheme(context) {
    if (context && context.theme && typeof context.theme === 'object') {
      return context.theme;
    }
    const scopes = [
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof window !== 'undefined' ? window : null,
      typeof global !== 'undefined' ? global : null
    ];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const theme = scope.MathVisualsTheme;
      if (theme && typeof theme === 'object') {
        return theme;
      }
    }
    return null;
  }

  function getSettings(context) {
    if (context && context.settings && typeof context.settings === 'object') {
      return context.settings;
    }
    const scopes = [
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof window !== 'undefined' ? window : null,
      typeof global !== 'undefined' ? global : null
    ];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const settings = scope.MathVisualsSettings;
      if (settings && typeof settings === 'object') {
        return settings;
      }
    }
    return null;
  }

  function readThemeProject(theme) {
    if (!theme || typeof theme.getActiveProfileName !== 'function') return null;
    try {
      const value = theme.getActiveProfileName();
      return normalizeProjectName(value);
    } catch (_) {
      return null;
    }
  }

  function readSettingsProject(settings) {
    if (!settings || typeof settings.getActiveProject !== 'function') return null;
    try {
      const value = settings.getActiveProject();
      return normalizeProjectName(value);
    } catch (_) {
      return null;
    }
  }

  function resolvePaletteProject(context) {
    return null;
  }

  return {
    resolvePaletteProject,
    normalizeProjectName
  };
});
