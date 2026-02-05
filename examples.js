(function ensureVercelRedirect() {
  if (typeof window === 'undefined') return;
  if (window.__MATH_VISUALS_REDIRECT_INITIALIZED__) return;
  const { hostname, pathname, search, hash } = window.location;
  if (!hostname || !hostname.endsWith('github.io')) return;
  window.__MATH_VISUALS_REDIRECT_INITIALIZED__ = true;

  const DEFAULT_REDIRECT_TARGET_ORIGIN = 'https://mathvisuals.no';

  const normalizeTargetOrigin = candidate => {
    if (typeof candidate !== 'string') return null;
    const trimmed = candidate.trim();
    if (!trimmed) return null;
    try {
      const url = new URL(trimmed);
      if (!/^https?:$/i.test(url.protocol)) return null;
      return url.origin;
    } catch (_) {
      return null;
    }
  };

  const resolveRedirectTargetOrigin = () => {
    const doc = window.document;
    const candidates = [];

    candidates.push(window.__MATH_VISUALS_REDIRECT_TARGET_ORIGIN__);

    if (doc && doc.currentScript && doc.currentScript.dataset) {
      candidates.push(doc.currentScript.dataset.mathVisualsRedirectTargetOrigin);
      candidates.push(doc.currentScript.dataset.redirectTargetOrigin);
    }

    if (doc && doc.documentElement) {
      candidates.push(
        doc.documentElement.getAttribute('data-math-visuals-redirect-target-origin')
      );
    }

    for (const candidate of candidates) {
      const normalized = normalizeTargetOrigin(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return DEFAULT_REDIRECT_TARGET_ORIGIN;
  };

  const targetOrigin = resolveRedirectTargetOrigin();
  const repoBasePath = '/math_visuals';
  let path = typeof pathname === 'string' && pathname ? pathname : '/';
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const normalizedRepoPath = repoBasePath.toLowerCase();
  if (normalizedRepoPath && path.toLowerCase().startsWith(normalizedRepoPath)) {
    path = path.slice(repoBasePath.length) || '/';
  }
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const destination = new URL(`${path}${search || ''}${hash || ''}`, targetOrigin).toString();
  if (destination === window.location.href) return;
  try {
    window.location.replace(destination);
  } catch (_) {
    window.location.href = destination;
  }
})();

function createDomCleanupInitializer() {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const TARGET_BUTTON_TEXT = 'gjenopprett eksempler';
  const TARGET_DESCRIPTION_TEXT = 'Forklaring til formatering av oppgavetekst';

  const isElement = node => {
    if (typeof Node === 'undefined') return !!(node && node.nodeType === 1);
    return !!(node && node.nodeType === Node.ELEMENT_NODE);
  };

  const normalizeText = value => {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim().toLowerCase();
  };

  const targetButtonTextNormalized = normalizeText(TARGET_BUTTON_TEXT);
  const targetDescriptionTextNormalized = normalizeText(TARGET_DESCRIPTION_TEXT);

  const shouldRemoveButton = button => {
    if (!button) return false;
    const text = normalizeText(button.textContent || '');
    return text === targetButtonTextNormalized;
  };

  const removeRestoreButtons = root => {
    let removed = false;
    if (!root) return removed;
    const process = element => {
      if (!element) return;
      if (shouldRemoveButton(element)) {
        element.remove();
        removed = true;
      }
    };
    if (root === document || root === document.documentElement || root === document.body) {
      const buttons = document.querySelectorAll('button');
      buttons.forEach(process);
      return removed;
    }
    if (isElement(root)) {
      if (root.tagName === 'BUTTON') {
        process(root);
      }
      root.querySelectorAll && root.querySelectorAll('button').forEach(process);
    } else if (root && typeof root.querySelectorAll === 'function') {
      root.querySelectorAll('button').forEach(process);
    }
    return removed;
  };

  const matchesDescriptionTarget = element => {
    if (!element) return false;
    const text = normalizeText(element.textContent || '');
    if (text && text.includes(targetDescriptionTextNormalized)) {
      return true;
    }
    if (element.attributes && element.attributes.length) {
      for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        if (!attr) continue;
        const value = normalizeText(attr.value || '');
        if (value && value.includes(targetDescriptionTextNormalized)) {
          return true;
        }
      }
    }
    return false;
  };

  const removeFormattingNode = element => {
    if (!element || !element.parentNode) return;
    let container = element;
    if (typeof element.closest === 'function') {
      const closest = element.closest(
        'details, [data-description-formatting], .description-formatting, .example-description-formatting'
      );
      if (closest) container = closest;
    }
    if (container.parentNode) {
      try {
        container.parentNode.removeChild(container);
      } catch (_) {}
    }
  };

  const removeFormattingNodes = root => {
    if (!root) return false;
    let removed = false;
    const visited = new WeakSet();
    const walk = node => {
      if (!node || visited.has(node)) return;
      visited.add(node);
      const nodeType = node.nodeType;
      if (nodeType === 1) {
        const element = node;
        if (matchesDescriptionTarget(element)) {
          removeFormattingNode(element);
          removed = true;
          return;
        }
        if (element.shadowRoot) {
          walk(element.shadowRoot);
        }
      } else if (nodeType !== 9 && nodeType !== 11) {
        if (node.parentNode) {
          walk(node.parentNode);
        }
        return;
      }
      if (nodeType === 11 && node.host && matchesDescriptionTarget(node.host)) {
        removeFormattingNode(node.host);
        removed = true;
        return;
      }
      const children = node.childNodes;
      if (children && children.length) {
        for (let i = 0; i < children.length; i++) {
          walk(children[i]);
        }
      }
    };
    walk(root);
    return removed;
  };

  const cleanRoot = root => {
    const buttonsRemoved = removeRestoreButtons(root);
    const formattingRemoved = removeFormattingNodes(root);
    return { buttonsRemoved, formattingRemoved };
  };

  const handleMutations = mutations => {
    let buttonsRemoved = false;
    mutations.forEach(mutation => {
      if (!mutation.addedNodes) return;
      mutation.addedNodes.forEach(node => {
        if (!node) return;
        const result = cleanRoot(node);
        if (result.buttonsRemoved) {
          buttonsRemoved = true;
        }
      });
    });
    if (buttonsRemoved) {
      removeRestoreButtons(document);
    }
  };

  let observer = null;

  return function initDomCleanup() {
    const root = document.body || document.documentElement || document;
    cleanRoot(root);
    if (observer || typeof MutationObserver !== 'function') return;
    observer = new MutationObserver(handleMutations);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  };
}

function initExamples() {
  if (typeof document === 'undefined') return;
  if (document.__MATH_VISUALS_EXAMPLES_INIT__) return;

  document.__MATH_VISUALS_EXAMPLES_INIT__ = true;
  const initDomCleanup = createDomCleanupInitializer();

  const init = () => {
    initDomCleanup();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}

const examplesGlobalScope =
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
        ? global
        : null;

if (examplesGlobalScope) {
  examplesGlobalScope.initMathVisualsExamples = initExamples;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = module.exports || {};
  module.exports.initExamples = initExamples;
}

initExamples();

(function initGlobalSettings() {
  const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (!globalScope) return;

  function resolvePaletteConfig() {
    const scopes = [globalScope, typeof globalThis !== 'undefined' ? globalThis : null];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const config = scope.MathVisualsPaletteConfig;
      if (config && typeof config === 'object') {
        return config;
      }
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./palette/palette-config.js');
        if (mod && typeof mod === 'object') {
          return mod;
        }
      } catch (_) {}
    }
    return null;
  }

  const paletteConfig = resolvePaletteConfig();
  if (!paletteConfig) {
    if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
      console.error(
        '[MathVisualsExamples] Mangler fargekonfigurasjon. Sørg for at palette/palette-config.js lastes før examples.js.'
      );
    }
    return;
  }

  function resolvePaletteNormalize() {
    const scopes = [globalScope, typeof globalThis !== 'undefined' ? globalThis : null];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const normalizer = scope.MathVisualsPaletteNormalize;
      if (normalizer && typeof normalizer === 'object') {
        return normalizer;
      }
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./palette/palette-normalize.js');
        if (mod && typeof mod === 'object') {
          return mod;
        }
      } catch (_) {}
    }
    return null;
  }

  const paletteNormalize = resolvePaletteNormalize();
  if (!paletteNormalize) {
    if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
      console.error(
        '[MathVisualsExamples] Mangler normalisering. Sørg for at palette/palette-normalize.js lastes før examples.js.'
      );
    }
    return;
  }

  function resolvePaletteFallbacks() {
    const scopes = [
      typeof window !== 'undefined' ? window : null,
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof global !== 'undefined' ? global : null
    ];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const fallbacks = scope.MathVisualsPaletteFallbacks;
      if (fallbacks && typeof fallbacks === 'object') {
        return fallbacks;
      }
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./palette/fallbacks.js');
        if (mod && typeof mod === 'object') {
          return mod;
        }
      } catch (_) {}
    }
    return null;
  }

  const MAX_COLORS = paletteConfig.MAX_COLORS;
  const paletteFallbacks = resolvePaletteFallbacks();
  const legacyFallbackColors =
    paletteFallbacks && paletteFallbacks.legacy && Array.isArray(paletteFallbacks.legacy.settingsDefault)
      ? paletteFallbacks.legacy.settingsDefault
      : null;
  const FALLBACK_COLORS = Array.isArray(legacyFallbackColors) && legacyFallbackColors.length
    ? legacyFallbackColors.slice()
    : Array.isArray(paletteConfig.PROJECT_FALLBACKS && paletteConfig.PROJECT_FALLBACKS.default)
    ? paletteConfig.PROJECT_FALLBACKS.default.slice()
    : [];
  const PROJECT_FALLBACKS = paletteConfig.PROJECT_FALLBACKS;
  const COLOR_SLOT_GROUPS = paletteConfig.COLOR_SLOT_GROUPS.map(group => ({
    groupId: group.groupId,
    slots: group.slots.map(slot => ({
      index: slot.index,
      groupId: slot.groupId,
      groupIndex: slot.groupIndex
    }))
  }));
  const DEFAULT_GRAFTEGNER_GROUP_ID = 'fellesfarger';
  const GRAFTEGNER_GROUP_ID = (() => {
    for (const group of COLOR_SLOT_GROUPS) {
      if (!group || !group.groupId) continue;
      if (group.groupId === DEFAULT_GRAFTEGNER_GROUP_ID) {
        return group.groupId;
      }
    }
    return DEFAULT_GRAFTEGNER_GROUP_ID;
  })();
  const GROUP_IDS = Array.isArray(paletteConfig.COLOR_GROUP_IDS)
    ? paletteConfig.COLOR_GROUP_IDS.slice()
    : COLOR_SLOT_GROUPS.map(group => group.groupId);
  const SLOT_META_BY_INDEX = new Map();
  COLOR_SLOT_GROUPS.forEach(group => {
    group.slots.forEach(slot => {
      if (!slot) return;
      const index = Number(slot.index);
      if (!Number.isInteger(index) || index < 0) return;
      SLOT_META_BY_INDEX.set(index, {
        groupId: group.groupId,
        groupIndex: Number(slot.groupIndex) || 0
      });
    });
  });
  const MIN_COLOR_SLOTS = Number.isInteger(paletteConfig.MIN_COLOR_SLOTS)
    ? paletteConfig.MIN_COLOR_SLOTS
    : COLOR_SLOT_GROUPS.reduce((total, group) => total + group.slots.length, 0);
  const PROJECT_FALLBACK_CACHE = new Map();
  const PROJECT_FALLBACK_GROUP_CACHE = new Map();
  const DEFAULT_PROJECT = typeof paletteConfig.DEFAULT_PROJECT === 'string'
    ? paletteConfig.DEFAULT_PROJECT
    : 'campus';
  const DEFAULT_PROJECT_ORDER = Array.isArray(paletteConfig.DEFAULT_PROJECT_ORDER)
    ? paletteConfig.DEFAULT_PROJECT_ORDER.slice()
    : ['campus', 'annet'];
  const SETTINGS_STORAGE_KEY = 'mathVisuals:settings';
  const SETTINGS_BROADCAST_KEY = 'mathVisuals:settings:snapshot';

  const listeners = new Set();
  let remoteLoadPromise = null;

  function sanitizeColor(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(trimmed);
    if (!match) return null;
    let hex = match[1].toLowerCase();
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    } else if (hex.length === 4) {
      const rgb = hex.slice(0, 3).split('');
      hex = rgb.map(ch => ch + ch).join('');
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    return `#${hex}`;
  }

  function sanitizeColorList(values) {
    if (!Array.isArray(values)) return [];
    const out = [];
    for (const value of values) {
      const sanitized = sanitizeColor(value);
      if (sanitized) {
        out.push(sanitized);
        if (out.length >= MAX_COLORS) break;
      }
    }
    return out;
  }

  const paletteNormalizeOptions = {
    sanitizeColorList,
    maxColors: MAX_COLORS
  };

  function resolveGroupPaletteEntry(group, entry) {
    return paletteNormalize.resolveGroupPaletteEntry(group, entry, paletteNormalizeOptions);
  }

  function buildRolePayloadForGroup(group, colors) {
    return paletteNormalize.buildRolePayloadForGroup(group, colors, paletteNormalizeOptions);
  }

  function normalizeProjectName(name) {
    if (typeof name !== 'string') return '';
    return name.trim().toLowerCase();
  }

  function getSanitizedFallbackBase(project) {
    const key = normalizeProjectName(project) || 'default';
    const base = PROJECT_FALLBACKS[key] || PROJECT_FALLBACKS.default || FALLBACK_COLORS;
    const sanitized = sanitizeColorList(base);
    if (!sanitized.length) {
      sanitized.push(FALLBACK_COLORS[0]);
    }
    const cached = PROJECT_FALLBACK_CACHE.get(key);
    const hasChanged =
      !cached ||
      cached.length !== sanitized.length ||
      cached.some((value, index) => value !== sanitized[index]);
    if (hasChanged) {
      PROJECT_FALLBACK_CACHE.set(key, sanitized.slice());
      if (key === 'default') {
        PROJECT_FALLBACK_GROUP_CACHE.clear();
      } else {
        PROJECT_FALLBACK_GROUP_CACHE.delete(key);
      }
    }
    return sanitized.slice();
  }

  function buildFallbackGroupsFromBase(baseColors, project) {
    const sanitizedBase = Array.isArray(baseColors) ? sanitizeColorList(baseColors) : [];
    const fallbackColors = sanitizedBase.length ? sanitizedBase : getSanitizedFallbackBase('default');
    const groups = {};
    let cursor = 0;
    COLOR_SLOT_GROUPS.forEach(group => {
      if (!group || !group.groupId) return;
      const slots = Array.isArray(group.slots) ? group.slots : [];
      const limit = slots.length;
      const colors = [];
      if (limit > 0) {
        for (let index = 0; index < limit; index += 1) {
          const color =
            fallbackColors[cursor] ||
            fallbackColors[index % (fallbackColors.length || 1)] ||
            fallbackColors[0];
          if (color) {
            colors.push(color);
          }
          if (cursor < fallbackColors.length) {
            cursor += 1;
          }
        }
        if (!colors.length && fallbackColors.length) {
          for (let index = 0; index < limit; index += 1) {
            colors.push(fallbackColors[index % fallbackColors.length]);
          }
        }
      }
      groups[group.groupId] = colors;
    });
    return groups;
  }

  function ensureProjectPaletteShape(palette) {
    return paletteNormalize.ensureProjectPaletteShape(palette, COLOR_SLOT_GROUPS, paletteNormalizeOptions);
  }

  function cloneProjectPalette(palette) {
    const shaped = ensureProjectPaletteShape(palette);
    const copy = {};
    GROUP_IDS.forEach(groupId => {
      const source = Array.isArray(shaped[groupId]) ? shaped[groupId] : [];
      copy[groupId] = source.slice(0, MAX_COLORS);
    });
    return copy;
  }

  function convertLegacyPalette(project, palette) {
    if (!Array.isArray(palette) || !palette.length) return {};
    const sanitized = sanitizeColorList(palette);
    const converted = {};
    COLOR_SLOT_GROUPS.forEach(group => {
      converted[group.groupId] = group.slots.map(slot => {
        const index = Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : 0;
        return sanitized[index] || null;
      });
    });
    return converted;
  }

  function getProjectFallbackPalette(project) {
    const key = normalizeProjectName(project) || 'default';
    if (!PROJECT_FALLBACK_GROUP_CACHE.has(key)) {
      const base = getSanitizedFallbackBase(key);
      PROJECT_FALLBACK_GROUP_CACHE.set(key, buildFallbackGroupsFromBase(base, key));
    }
    return cloneProjectPalette(PROJECT_FALLBACK_GROUP_CACHE.get(key));
  }

  function sanitizeProjectPalette(project, palette) {
    const fallback = getProjectFallbackPalette(project);
    const fallbackBase = getSanitizedFallbackBase(project);
    const shaped = ensureProjectPaletteShape(palette);
    const sanitized = {};
    COLOR_SLOT_GROUPS.forEach(group => {
      const fallbackColors = Array.isArray(fallback[group.groupId]) ? fallback[group.groupId] : [];
      const incoming = Array.isArray(shaped[group.groupId]) ? shaped[group.groupId] : [];
      sanitized[group.groupId] = group.slots.map((slot, slotIndex) => {
        const clean = sanitizeColor(incoming[slotIndex]);
        if (clean) return clean;
        if (fallbackColors[slotIndex]) return fallbackColors[slotIndex];
        if (fallbackColors[0]) return fallbackColors[0];
        if (fallbackBase.length) {
          const baseIndex = Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : slotIndex;
          return fallbackBase[baseIndex % fallbackBase.length] || fallbackBase[0];
        }
        return FALLBACK_COLORS[0];
      });
    });
    return sanitized;
  }

  function normalizeProjectPalette(project, palette) {
    return paletteNormalize.normalizeProjectPalette(project, palette, {
      normalizeProjectName,
      sanitizeProjectPalette,
      convertLegacyPalette,
      getProjectFallbackPalette
    });
  }

  function getFallbackColorForIndex(project, index) {
    const key = normalizeProjectName(project) || 'default';
    const baseColors = getSanitizedFallbackBase(key);
    if (!baseColors.length) {
      return FALLBACK_COLORS[0];
    }
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;
    const meta = SLOT_META_BY_INDEX.get(normalizedIndex);
    if (meta) {
      if (!PROJECT_FALLBACK_GROUP_CACHE.has(key)) {
        const base = getSanitizedFallbackBase(key);
        PROJECT_FALLBACK_GROUP_CACHE.set(key, buildFallbackGroupsFromBase(base, key));
      }
      const groups = PROJECT_FALLBACK_GROUP_CACHE.get(key) || {};
      const groupColors = Array.isArray(groups[meta.groupId]) ? groups[meta.groupId] : [];
      const candidate = sanitizeColor(groupColors[meta.groupIndex]);
      if (candidate) {
        return candidate;
      }
    }
    return baseColors[normalizedIndex % baseColors.length] || baseColors[0];
  }

  function flattenProjectPalette(project, palette, minimumLength = MIN_COLOR_SLOTS) {
    const normalized = normalizeProjectName(project);
    const normalizedPalette = normalizeProjectPalette(normalized, palette);
    const flattened = [];
    let highestSlotIndex = -1;
    COLOR_SLOT_GROUPS.forEach(group => {
      const colors = Array.isArray(normalizedPalette[group.groupId]) ? normalizedPalette[group.groupId] : [];
      group.slots.forEach((slot, slotIndex) => {
        const targetIndex = Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : slotIndex;
        if (targetIndex > highestSlotIndex) {
          highestSlotIndex = targetIndex;
        }
        const color = sanitizeColor(colors[slotIndex]);
        const fallback = getFallbackColorForIndex(normalized, targetIndex);
        flattened[targetIndex] = color || fallback;
      });
    });
    const min = Number.isInteger(minimumLength) && minimumLength > 0 ? minimumLength : 0;
    const targetLength = Math.min(MAX_COLORS, Math.max(min, highestSlotIndex + 1));
    for (let index = 0; index < targetLength; index += 1) {
      if (!sanitizeColor(flattened[index])) {
        flattened[index] = getFallbackColorForIndex(normalized, index);
      }
    }
    return flattened.slice(0, targetLength);
  }

  function expandPalette(projectName, basePalette, minimumLength = MIN_COLOR_SLOTS) {
    const project = projectName ? normalizeProjectName(projectName) : DEFAULT_PROJECT;
    return flattenProjectPalette(project, basePalette, minimumLength);
  }

  function ensureColorCount(base, count) {
    const palette = Array.isArray(base) && base.length ? base.slice() : FALLBACK_COLORS.slice();
    if (!Number.isFinite(count) || count <= 0) {
      return palette.slice();
    }
    const result = [];
    for (let i = 0; i < count; i += 1) {
      result.push(palette[i % palette.length]);
    }
    return result;
  }

  function resolveProjectName(name, projects) {
    const collection = projects && typeof projects === 'object' ? projects : null;
    if (typeof name === 'string') {
      const normalized = name.trim().toLowerCase();
      if (normalized && collection && collection[normalized]) {
        return normalized;
      }
    }
    if (collection && collection[DEFAULT_PROJECT]) {
      return DEFAULT_PROJECT;
    }
    if (collection) {
      const keys = Object.keys(collection);
      if (keys.length) return keys[0];
    }
    return DEFAULT_PROJECT;
  }

  function resolvePaletteColors(source) {
    if (!source || typeof source !== 'object') return null;
    const palette = source.palette && typeof source.palette === 'object' ? source.palette : null;
    if (!palette) return null;
    const colors = Array.isArray(palette.colors) ? palette.colors.slice() : null;
    if (!colors) return null;
    const rawCount = palette.colorCount;
    const count = Number.isFinite(rawCount) ? Math.trunc(rawCount) : null;
    if (count && count > 0) {
      return colors.slice(0, count);
    }
    return colors;
  }

  function normalizeSettings(value) {
    const input = value && typeof value === 'object' ? value : {};
    let groupPalettes = null;
    const paletteColors = resolvePaletteColors(input);

    if (paletteColors || input.groupPalettes != null || input.defaultColors != null) {
      const palette = normalizeProjectPalette(
        DEFAULT_PROJECT,
        paletteColors != null
          ? paletteColors
          : input.groupPalettes != null
          ? input.groupPalettes
          : input.defaultColors
      );
      groupPalettes = cloneProjectPalette(palette);
    } else if (input.projects && typeof input.projects === 'object') {
      const projectName = resolveProjectName(input.project || input.defaultProject, input.projects);
      const source = input.projects[projectName];
      const normalizedPalette = normalizeProjectPalette(
        projectName,
        source && (source.groupPalettes != null ? source.groupPalettes : source.defaultColors)
      );
      groupPalettes = cloneProjectPalette(normalizedPalette);
    }

    if (!groupPalettes) {
      groupPalettes = cloneProjectPalette(getProjectFallbackPalette());
    }

    const serializedGroupPalettes = {};
    COLOR_SLOT_GROUPS.forEach(group => {
      const colors = Array.isArray(groupPalettes[group.groupId]) ? groupPalettes[group.groupId] : [];
      const rolePayload = buildRolePayloadForGroup(group, colors);
      serializedGroupPalettes[group.groupId] = rolePayload || colors.slice(0, MAX_COLORS);
    });

    return {
      version: 1,
      groupPalettes: serializedGroupPalettes,
      defaultColors: expandPalette(DEFAULT_PROJECT, groupPalettes),
      updatedAt: new Date().toISOString()
    };
  }

  function parseUpdatedAtMs(value) {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  function isSnapshotNewer(incoming, current) {
    const incomingMs = parseUpdatedAtMs(incoming && incoming.updatedAt);
    const currentMs = parseUpdatedAtMs(current && current.updatedAt);
    if (incomingMs == null || currentMs == null) return true;
    return incomingMs > currentMs;
  }

  const DEFAULT_SETTINGS = normalizeSettings({});

  function cloneSettings(source) {
    const target = source && typeof source === 'object' ? source : settings;
    try {
      return JSON.parse(JSON.stringify(target));
    } catch (_) {
      return normalizeSettings(target);
    }
  }

  let settings = cloneSettings(DEFAULT_SETTINGS);

  function parseInlineStyle(element) {
    const map = new Map();
    if (!element || typeof element.getAttribute !== 'function') return map;
    const raw = element.getAttribute('style');
    if (!raw || typeof raw !== 'string') return map;
    raw
      .split(';')
      .map(chunk => chunk.trim())
      .filter(Boolean)
      .forEach(chunk => {
        const separatorIndex = chunk.indexOf(':');
        if (separatorIndex === -1) return;
        const prop = chunk.slice(0, separatorIndex).trim();
        const value = chunk.slice(separatorIndex + 1).trim();
        if (prop) {
          map.set(prop, value);
        }
      });
    return map;
  }

  function serializeInlineStyle(map) {
    return Array.from(map.entries())
      .map(([prop, value]) => `${prop}: ${value}`)
      .join('; ');
  }

  function applyToDocument(doc) {
    const targetDoc = doc || (typeof document !== 'undefined' ? document : null);
    if (!targetDoc || !targetDoc.documentElement) return;
    const root = targetDoc.documentElement;
    const style = root.style;
    const canUseNativeStyle = style && typeof style.setProperty === 'function' && typeof style.removeProperty === 'function';
    const inlineStyle = canUseNativeStyle ? null : parseInlineStyle(root);
    const setStyleProperty = (name, value) => {
      if (canUseNativeStyle) {
        style.setProperty(name, value);
      } else if (inlineStyle) {
        inlineStyle.set(name, value);
      }
    };
    const removeStyleProperty = name => {
      if (canUseNativeStyle) {
        style.removeProperty(name);
      } else if (inlineStyle) {
        inlineStyle.delete(name);
      }
    };
    const basePalette = Array.isArray(settings.defaultColors) && settings.defaultColors.length
      ? settings.defaultColors
      : expandPalette(DEFAULT_PROJECT, settings.groupPalettes);
    const palette = ensureColorCount(basePalette, Math.max(basePalette.length, FALLBACK_COLORS.length));
    const limit = Math.max(palette.length, FALLBACK_COLORS.length);
    for (let i = 0; i < limit; i += 1) {
      const color = palette[i % palette.length];
      if (color) {
        setStyleProperty(`--mv-default-color-${i + 1}`, color);
      } else {
        removeStyleProperty(`--mv-default-color-${i + 1}`);
      }
    }
    removeStyleProperty('--mv-default-line-thickness');
    if (!canUseNativeStyle && inlineStyle && typeof root.setAttribute === 'function') {
      const serialized = serializeInlineStyle(inlineStyle);
      if (serialized) {
        root.setAttribute('style', serialized);
      } else {
        root.removeAttribute('style');
      }
    }
  }

  function notifyChange(options) {
    applyToDocument(typeof document !== 'undefined' ? document : null);
    const snapshot = cloneSettings();
    listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (_) {}
    });
    if (!options || options.emitEvent !== false) {
      try {
        if (globalScope && typeof globalScope.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
          globalScope.dispatchEvent(new CustomEvent('math-visuals:settings-changed', { detail: { settings: snapshot } }));
        }
      } catch (_) {}
    }
  }

  function applySettingsSnapshot(snapshot, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const next = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const notify = opts.notify !== false;
    const emitEvent = opts.emitEvent !== false;
    if (!opts.force && !isSnapshotNewer(next, settings)) {
      return cloneSettings();
    }
    const result = commitSettings(next, { persist: false, notify, emitEvent });
    if (globalScope && globalScope.MathVisualsPaletteEvents) {
      const paletteEvents = globalScope.MathVisualsPaletteEvents;
      if (paletteEvents && typeof paletteEvents.emitFromSettings === 'function') {
        try {
          paletteEvents.emitFromSettings(result);
        } catch (_) {}
      } else if (
        paletteEvents &&
        typeof paletteEvents.emit === 'function' &&
        typeof paletteEvents.normalize === 'function'
      ) {
        try {
          paletteEvents.emit(paletteEvents.normalize(result));
        } catch (_) {}
      }
    }
    return result;
  }

  function buildPersistPayload(next) {
    const source = next && typeof next === 'object' ? next : {};
    const normalized = normalizeSettings(source);
    return {
      version: source.version ? source.version : normalized.version,
      groupPalettes: normalized.groupPalettes,
      defaultColors: normalized.defaultColors
    };
  }

  function resolveApiUrl() {
    if (!globalScope) return null;
    if (globalScope.MATH_VISUALS_SETTINGS_API_URL) {
      const hint = String(globalScope.MATH_VISUALS_SETTINGS_API_URL).trim();
      if (hint) return hint;
    }
    const origin = globalScope.location && globalScope.location.origin;
    if (typeof origin === 'string' && /^https?:/i.test(origin)) {
      return '/api/settings';
    }
    return null;
  }

  function normalizeApiUrl(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function shouldRefreshSettingsApi(sourceUrl) {
    const settingsApiUrl = normalizeApiUrl(resolveApiUrl());
    const normalizedSource = normalizeApiUrl(sourceUrl);
    if (!settingsApiUrl) {
      return !normalizedSource;
    }
    if (!normalizedSource) return true;
    return settingsApiUrl !== normalizedSource;
  }

  function refreshFromSource(sourceUrl, options) {
    if (!shouldRefreshSettingsApi(sourceUrl)) {
      return Promise.resolve(cloneSettings());
    }
    const opts = options && typeof options === 'object' ? options : {};
    return loadFromRemote({
      force: true,
      notify: opts.notify !== false,
      emitEvent: opts.emitEvent !== false
    });
  }

  function persistSettings(next) {
    const url = resolveApiUrl();
    if (!url || typeof globalScope.fetch !== 'function') {
      return Promise.resolve();
    }
    const payload = buildPersistPayload(next);
    return globalScope
      .fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(response => {
        if (!response || !response.ok) {
          throw new Error('Failed to persist settings');
        }
        return response
          .json()
          .catch(() => null)
          .then(data => (data && typeof data === 'object' && data.settings ? data.settings : data));
      })
      .then(remote => {
        if (!remote || typeof remote !== 'object') return;
        settings = normalizeSettings(remote);
        notifyChange({ emitEvent: true });
      })
      .catch(error => {
        console.error(error);
      });
  }

  function commitSettings(next, options) {
    settings = normalizeSettings(next);
    if (!options || options.persist !== false) {
      persistSettings(settings);
    }
    if (!options || options.notify !== false) {
      notifyChange({ emitEvent: !options || options.emitEvent !== false });
    }
    return cloneSettings();
  }

  function getDefaultColors(count, opts) {
    const size = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
    const palette = Array.isArray(settings.defaultColors) && settings.defaultColors.length
      ? settings.defaultColors
      : expandPalette(DEFAULT_PROJECT, settings.groupPalettes);
    return ensureColorCount(palette, size || palette.length);
  }

  function getSettings() {
    return cloneSettings();
  }

  function setSettings(next) {
    return commitSettings(next, { persist: true, notify: true });
  }

  function updateSettings(patch) {
    const merged = cloneSettings(settings);
    if (patch && typeof patch === 'object') {
      const paletteColors = resolvePaletteColors(patch);
      if (paletteColors || patch.groupPalettes != null || patch.defaultColors != null) {
        const normalizedPalette = normalizeProjectPalette(
          DEFAULT_PROJECT,
          paletteColors != null ? paletteColors : patch.groupPalettes != null ? patch.groupPalettes : patch.defaultColors
        );
        merged.groupPalettes = cloneProjectPalette(normalizedPalette);
        merged.defaultColors = expandPalette(DEFAULT_PROJECT, merged.groupPalettes);
      } else if (patch.projects && typeof patch.projects === 'object') {
        const projectName = resolveProjectName(patch.project || patch.defaultProject, patch.projects);
        const source = patch.projects[projectName];
        if (source && (source.groupPalettes != null || source.defaultColors != null)) {
          const normalizedPalette = normalizeProjectPalette(
            projectName,
            source.groupPalettes != null ? source.groupPalettes : source.defaultColors
          );
          merged.groupPalettes = cloneProjectPalette(normalizedPalette);
          merged.defaultColors = expandPalette(DEFAULT_PROJECT, merged.groupPalettes);
        }
      }
    }
    return commitSettings(merged, { persist: true, notify: true });
  }

  function parseSettingsBroadcastPayload(value) {
    if (!value || typeof value !== 'string') return null;
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') return null;
      if (!parsed.settings || typeof parsed.settings !== 'object') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function resetSettings() {
    return commitSettings(DEFAULT_SETTINGS, { persist: true, notify: true });
  }

  function subscribe(callback) {
    if (typeof callback !== 'function') {
      return () => {};
    }
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  }

  function loadFromRemote(options) {
    const opts = options && typeof options === 'object' ? options : {};
    if (remoteLoadPromise && !opts.force) {
      return remoteLoadPromise;
    }
    const parseStatusCode = status => {
      if (typeof status === 'number') {
        return Number.isFinite(status) ? status : null;
      }
      if (typeof status === 'string') {
        const parsed = Number.parseInt(status, 10);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };
    const isMissingEndpointStatus = status => {
      const parsed = parseStatusCode(status);
      return parsed === 404 || parsed === 410;
    };
    const isExpectedMissingEndpointError = error => {
      if (!error) return false;
      if (isMissingEndpointStatus(error.status) || isMissingEndpointStatus(error.statusCode)) {
        return true;
      }
      if (typeof error.message === 'string') {
        const normalized = error.message.toLowerCase();
        if (normalized.includes('not found') || normalized.includes('missing endpoint')) {
          return true;
        }
      }
      return false;
    };
    const url = resolveApiUrl();
    if (!url || typeof globalScope.fetch !== 'function') {
      remoteLoadPromise = Promise.resolve(cloneSettings());
      return remoteLoadPromise;
    }
    remoteLoadPromise = globalScope
      .fetch(url, { headers: { Accept: 'application/json' } })
      .then(response => {
        if (!response) {
          throw new Error('Failed to load settings');
        }
        if (isMissingEndpointStatus(response.status)) {
          return null;
        }
        if (!response.ok) {
          const error = new Error('Failed to load settings');
          error.status = response.status;
          throw error;
        }
        return response
          .json()
          .catch(() => null)
          .then(data => (data && typeof data === 'object' && data.settings ? data.settings : data));
      })
      .then(remote => {
        if (!remote || typeof remote !== 'object') return cloneSettings();
        if (!isSnapshotNewer(remote, settings)) {
          return cloneSettings();
        }
        settings = normalizeSettings(remote);
        if (opts.notify !== false) {
          notifyChange({ emitEvent: opts.emitEvent !== false });
        }
        return cloneSettings();
      })
      .catch(error => {
        if (!isExpectedMissingEndpointError(error)) {
          console.error(error);
        }
        return cloneSettings();
      })
      .finally(() => {
        remoteLoadPromise = null;
      });
    return remoteLoadPromise;
  }

  const settingsApi =
    globalScope.MathVisualsSettings && typeof globalScope.MathVisualsSettings === 'object'
      ? globalScope.MathVisualsSettings
      : {};
  const paletteHelper =
    globalScope.MathVisualsPalette && typeof globalScope.MathVisualsPalette.getGroupPalette === 'function'
      ? globalScope.MathVisualsPalette
      : typeof require === 'function'
      ? (() => {
          try {
            return require('./theme/palette.js');
          } catch (_) {
            return null;
          }
        })()
      : null;

  settingsApi.getSettings = () => getSettings();
  settingsApi.setSettings = next => setSettings(next);
  settingsApi.updateSettings = patch => updateSettings(patch);
  settingsApi.resetSettings = () => resetSettings();
  settingsApi.getDefaultColors = (count, opts) => getDefaultColors(count, opts);
  settingsApi.subscribe = callback => subscribe(callback);
  settingsApi.applyToDocument = doc => applyToDocument(doc);
  settingsApi.ensureColorCount = (base, count) => ensureColorCount(base, count);
  settingsApi.sanitizeColor = value => sanitizeColor(value);
  settingsApi.sanitizeColorList = values => sanitizeColorList(values);
  settingsApi.defaults = () => cloneSettings(DEFAULT_SETTINGS);
  settingsApi.fallbackColors = FALLBACK_COLORS.slice();
  settingsApi.STORAGE_KEY = SETTINGS_STORAGE_KEY;
  settingsApi.getGroupPalette = (groupId, countOrOptions, maybeOpts) => {
    const usingOptionsObject =
      countOrOptions && typeof countOrOptions === 'object' && !Array.isArray(countOrOptions);
    const rawCount = usingOptionsObject ? countOrOptions.count : countOrOptions;
    const size = Number.isFinite(rawCount) && rawCount > 0 ? Math.trunc(rawCount) : undefined;
    const optionSource = usingOptionsObject ? countOrOptions : maybeOpts;
    const helperOptions = {};
    if (optionSource && typeof optionSource === 'object') {
      Object.keys(optionSource).forEach(key => {
        if (key === 'project') return;
        helperOptions[key] = optionSource[key];
      });
    }
    helperOptions.count = size;
    if (!helperOptions.settings || typeof helperOptions.settings !== 'object') {
      helperOptions.settings = {
        groupPalettes: settings.groupPalettes,
        defaultColors: settings.defaultColors,
        getDefaultColors: desiredCount => getDefaultColors(desiredCount)
      };
    }
    if (paletteHelper && typeof paletteHelper.getGroupPalette === 'function') {
      return paletteHelper.getGroupPalette(groupId, helperOptions);
    }
    const basePalette = Array.isArray(settings.defaultColors) && settings.defaultColors.length
      ? settings.defaultColors
      : expandPalette(DEFAULT_PROJECT, settings.groupPalettes);
    return ensureColorCount(basePalette, size || basePalette.length);
  };
  settingsApi.refresh = options => loadFromRemote(options);
  settingsApi.refreshFromSource = (sourceUrl, options) => refreshFromSource(sourceUrl, options);
  settingsApi.getApiUrl = () => resolveApiUrl();
  settingsApi.applySettingsSnapshot = (snapshot, options) => applySettingsSnapshot(snapshot, options);

  globalScope.MathVisualsSettings = settingsApi;

  let lastBroadcastStamp = null;
  if (globalScope && typeof globalScope.addEventListener === 'function') {
    globalScope.addEventListener('storage', event => {
      if (!event || event.key !== SETTINGS_BROADCAST_KEY) return;
      const payload = parseSettingsBroadcastPayload(event.newValue);
      if (!payload) return;
      const stamp = payload.updatedAt || payload.timestamp || payload.ts || null;
      if (stamp && stamp === lastBroadcastStamp) return;
      lastBroadcastStamp = stamp || String(Date.now());
      applySettingsSnapshot(payload.settings, { notify: true, emitEvent: true });
    });
  }

  notifyChange({ emitEvent: true });
  loadFromRemote({ notify: true }).catch(() => {});
})();

(function () {
  const globalScope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  const DEFAULT_APP_MODE = 'default';
  const normalizeAppMode = mode => {
    if (typeof mode !== 'string') return DEFAULT_APP_MODE;
    const normalized = mode.trim().toLowerCase();
    if (!normalized) return DEFAULT_APP_MODE;
    if (
      normalized === 'task' ||
      normalized === 'task-mode' ||
      normalized === 'preview' ||
      normalized === 'preview-mode' ||
      normalized === 'forhandsvisning' ||
      normalized === 'forhåndsvisning'
    ) {
      return 'task';
    }
    return DEFAULT_APP_MODE;
  };
  const getTaskCore = () => (globalScope && globalScope.MathVisualsTaskCore ? globalScope.MathVisualsTaskCore : null);
  let taskCore = getTaskCore();
  const getTaskTextModule = () => {
    if (taskCore && taskCore.taskText) return taskCore.taskText;
    return globalScope && globalScope.MathVisualsTaskText ? globalScope.MathVisualsTaskText : null;
  };
  const resolveFallbackAppMode = () => {
    if (typeof document === 'undefined') return DEFAULT_APP_MODE;
    const body = document.body;
    if (body && body.dataset && body.dataset.appMode) {
      return normalizeAppMode(body.dataset.appMode);
    }
    return DEFAULT_APP_MODE;
  };
  let currentAppMode =
    taskCore && typeof taskCore.getAppMode === 'function'
      ? normalizeAppMode(taskCore.getAppMode())
      : resolveFallbackAppMode();
  let taskCoreInitAttempted = false;
  let modeListenerAttached = false;
  const attachModeListener = () => {
    if (modeListenerAttached) return;
    if (taskCore && typeof taskCore.onModeChange === 'function') {
      taskCore.onModeChange(mode => {
        currentAppMode = normalizeAppMode(mode);
      });
      modeListenerAttached = true;
      return;
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('math-visuals:app-mode-changed', event => {
        const detail = event && typeof event.detail === 'object' ? event.detail : {};
        currentAppMode = normalizeAppMode(detail.mode) || resolveFallbackAppMode();
      });
      modeListenerAttached = true;
    }
  };
  const initTaskCoreBridge = () => {
    if (taskCoreInitAttempted) return;
    taskCore = getTaskCore();
    if (!taskCore || typeof taskCore.init !== 'function') return;
    taskCoreInitAttempted = true;
    taskCore.init({
      getExamples,
      getActiveExampleIndex,
      extractDescriptionFromExample,
      normalizeDescriptionString,
      getExampleId: (example, index) => resolveExampleId(example, index)
    });
    if (typeof taskCore.attachSettings === 'function' && globalScope && globalScope.MathVisualsSettings) {
      taskCore.attachSettings(globalScope.MathVisualsSettings);
    }
    attachModeListener();
  };
  initTaskCoreBridge();
  attachModeListener();
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:task-core-ready', () => {
      initTaskCoreBridge();
    });
  }
  const STORAGE_GLOBAL_KEY = '__EXAMPLES_STORAGE__';
  function createMemoryStorage(initialData) {
    const data = new Map();
    if (initialData && typeof initialData === 'object') {
      Object.keys(initialData).forEach(key => {
        const normalized = String(key);
        const value = initialData[key];
        data.set(normalized, value == null ? 'null' : String(value));
      });
    }
    const storage = {
      get length() {
        return data.size;
      },
      key(index) {
        if (!Number.isInteger(index) || index < 0 || index >= data.size) return null;
        let i = 0;
        for (const key of data.keys()) {
          if (i === index) return key;
          i += 1;
        }
        return null;
      },
      getItem(key) {
        if (key == null) return null;
        const normalized = String(key);
        return data.has(normalized) ? data.get(normalized) : null;
      },
      setItem(key, value) {
        if (key == null) return;
        const normalized = String(key);
        data.set(normalized, value == null ? 'null' : String(value));
      },
      removeItem(key) {
        if (key == null) return;
        data.delete(String(key));
      },
      clear() {
        data.clear();
      }
    };
    try {
      Object.defineProperty(storage, '__isMemoryStorage', {
        value: true,
        configurable: true,
        enumerable: false,
        writable: true
      });
    } catch (_) {
      storage.__isMemoryStorage = true;
    }
    return storage;
  }
  let sharedMemoryStorage = null;
  function getSharedMemoryStorage() {
    if (sharedMemoryStorage && typeof sharedMemoryStorage.getItem === 'function') {
      return sharedMemoryStorage;
    }
    if (globalScope) {
      try {
        const localStore = globalScope.localStorage;
        if (
          localStore &&
          typeof localStore.getItem === 'function' &&
          typeof localStore.setItem === 'function'
        ) {
          const testKey = `${STORAGE_GLOBAL_KEY}__test__`;
          try {
            localStore.setItem(testKey, testKey);
            localStore.removeItem(testKey);
            sharedMemoryStorage = localStore;
            return sharedMemoryStorage;
          } catch (error) {
            try {
              localStore.removeItem(testKey);
            } catch (_) {}
          }
        }
      } catch (_) {}
      if (globalScope[STORAGE_GLOBAL_KEY] && typeof globalScope[STORAGE_GLOBAL_KEY].getItem === 'function') {
        sharedMemoryStorage = globalScope[STORAGE_GLOBAL_KEY];
        return sharedMemoryStorage;
      }
    }
    sharedMemoryStorage = createMemoryStorage();
    if (globalScope) {
      globalScope[STORAGE_GLOBAL_KEY] = sharedMemoryStorage;
    }
    return sharedMemoryStorage;
  }
  function storageGetItem(key) {
    if (key == null) return null;
    const store = getSharedMemoryStorage();
    if (!store || typeof store.getItem !== 'function') return null;
    try {
      return store.getItem(key);
    } catch (_) {
      return null;
    }
  }
  function storageSetItem(key, value) {
    if (key == null) return;
    const store = getSharedMemoryStorage();
    if (!store || typeof store.setItem !== 'function') return;
    try {
      store.setItem(String(key), value == null ? 'null' : String(value));
    } catch (_) {}
  }
  function storageRemoveItem(key) {
    if (key == null) return;
    const store = getSharedMemoryStorage();
    if (!store || typeof store.removeItem !== 'function') return;
    try {
      store.removeItem(String(key));
    } catch (_) {}
  }
  let updateRestoreButtonState = () => {};
  let updateActionButtonState = () => {};
  let actionButtonsBusy = false;
  let lastKnownActionButtonCount = 0;
  let setActionButtonsBusy = value => {
    actionButtonsBusy = value === true;
    if (typeof updateActionButtonState === 'function') {
      try {
        updateActionButtonState(lastKnownActionButtonCount);
      } catch (_) {}
    }
  };
  const BACKEND_FETCH_TIMEOUT_MS = 8000;

  function fetchWithTimeout(resource, options, timeoutMs) {
    if (typeof fetch !== 'function') {
      return Promise.reject(new Error('Fetch is not available'));
    }
    const opts = options && typeof options === 'object' ? { ...options } : {};
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : BACKEND_FETCH_TIMEOUT_MS;
    if (typeof AbortController !== 'function' || timeout <= 0 || opts.signal) {
      return fetch(resource, opts);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      try {
        controller.abort();
      } catch (_) {}
    }, timeout);
    opts.signal = controller.signal;
    return fetch(resource, opts).finally(() => {
      clearTimeout(timer);
    });
  }

  function resolveExamplesApiBase() {
    if (typeof window === 'undefined') return null;
    const defaultBase = '/api/examples';
    const productionBase = 'https://mathvisuals.no/api/examples';
    if (window.MATH_VISUALS_EXAMPLES_API_URL) {
      const value = String(window.MATH_VISUALS_EXAMPLES_API_URL).trim();
      if (value) return value;
    }
    const { location } = window;
    if (!location || typeof location !== 'object') return null;
    const hostname = typeof location.hostname === 'string' ? location.hostname : '';
    if (hostname && /\.vercel\.app$/i.test(hostname)) {
      return productionBase;
    }
    const origin = typeof location.origin === 'string' && location.origin ? location.origin : null;
    if (origin && /^https?:/i.test(origin)) {
      return defaultBase;
    }
    const protocol = typeof location.protocol === 'string' ? location.protocol : '';
    const host = typeof location.host === 'string' ? location.host : '';
    if (protocol && /^https?:$/i.test(protocol) && host) {
      return defaultBase;
    }
    return productionBase;
  }
  function buildExamplesApiUrl(base, path) {
    if (!base) return null;
    if (typeof window === 'undefined') {
      if (!path) return base;
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}path=${encodeURIComponent(path)}`;
    }
    try {
      const url = new URL(base, window.location && window.location.href ? window.location.href : undefined);
      if (path) {
        url.searchParams.set('path', path);
      }
      return url.toString();
    } catch (error) {
      if (!path) return base;
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}path=${encodeURIComponent(path)}`;
    }
  }
  function buildTrashApiBase(base) {
    if (!base) return null;
    const trimmed = base.replace(/\/+$/, '');
    return `${trimmed}/trash`;
  }
  function buildTrashApiUrl(base) {
    if (!base) return null;
    if (typeof window === 'undefined') {
      return base;
    }
    try {
      const url = new URL(base, window.location && window.location.href ? window.location.href : undefined);
      return url.toString();
    } catch (error) {
      return base;
    }
  }
  function extractContentType(headers) {
    if (!headers) return null;
    let value = null;
    try {
      if (typeof headers.get === 'function') {
        value = headers.get('content-type') || headers.get('Content-Type');
      }
    } catch (_) {
      value = null;
    }
    if (!value && typeof headers === 'object') {
      try {
        value = headers['content-type'] || headers['Content-Type'] || null;
      } catch (_) {
        value = null;
      }
    }
    return typeof value === 'string' ? value : null;
  }
  function isJsonContentType(value) {
    if (typeof value !== 'string') return false;
    const [first] = value.split(';', 1);
    const normalized = (first || value).trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === 'application/json') return true;
    if (normalized.endsWith('+json')) return true;
    if (/\bjson\b/.test(normalized)) return true;
    return false;
  }
  function responseLooksLikeJson(res) {
    if (!res) return false;
    const header = extractContentType(res.headers);
    return isJsonContentType(header);
  }
  function stripTrailingExampleSegment(path) {
    if (typeof path !== 'string') return path;
    const examplePattern = /^eksempel[-_]?\d+$/i;
    let working = path;
    while (true) {
      if (!working || working === '/') {
        return working || '/';
      }
      let trimmed = working;
      while (trimmed.length > 1 && trimmed.endsWith('/')) {
        trimmed = trimmed.slice(0, -1);
      }
      if (!trimmed || trimmed === '/') {
        return trimmed || '/';
      }
      const lastSlash = trimmed.lastIndexOf('/');
      const segment = trimmed.slice(lastSlash + 1);
      if (!examplePattern.test(segment)) {
        return trimmed;
      }
      if (lastSlash <= 0) {
        working = '/';
      } else {
        working = trimmed.slice(0, lastSlash);
      }
    }
  }
  // Graftegner kjører som en selvstendig side uten omdirigering til app-shell.
  function normalizePathname(pathname, options) {
    const preserveCase = !!(options && options.preserveCase);
    if (typeof pathname !== 'string') return '/';
    let path = pathname.trim();
    if (!path) return '/';
    if (!path.startsWith('/')) path = '/' + path;
    // Replace backslashes (possible in file:// URLs) and collapse duplicate slashes
    path = path.replace(/\+/g, '/');
    path = path.replace(/\/+/g, '/');
    // Remove trailing index.html or index.htm
    path = path.replace(/\/index\.html?$/i, '/');
    // Treat page.html and page.htm as the same canonical location as /page
    if (/\.html?$/i.test(path)) {
      path = path.replace(/\.html?$/i, '');
      if (!path) path = '/';
    }
    path = stripTrailingExampleSegment(path);
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    if (!path) return '/';
    let decoded = path;
    try {
      decoded = decodeURI(path);
    } catch (_) {}
    if (!preserveCase && typeof decoded === 'string') {
      decoded = decoded.toLowerCase();
    }
    let encoded = decoded;
    try {
      encoded = encodeURI(decoded);
    } catch (_) {
      if (preserveCase) {
        encoded = path;
      } else {
        encoded = typeof path === 'string' ? path.toLowerCase() : path;
      }
    }
    if (!encoded) return '/';
    const normalized = encoded.replace(/%[0-9a-f]{2}/gi, match => match.toUpperCase());
    return normalized;
  }
  const STORAGE_KEY_PREFIX = 'examples_';

  function computeLegacyStorageKeys(rawPath, canonicalPath) {
    const prefix = STORAGE_KEY_PREFIX;
    const canonicalKey = prefix + canonicalPath;
    const paths = new Set();
    const seenCandidates = new Set();
    const addCandidate = candidate => {
      if (typeof candidate !== 'string') return;
      const trimmed = candidate.trim();
      if (!trimmed) return;
      if (seenCandidates.has(trimmed)) return;
      seenCandidates.add(trimmed);
      paths.add(trimmed);
      if (trimmed.startsWith('/') && trimmed.length > 1) {
        addCandidate(trimmed.slice(1));
      } else if (!trimmed.startsWith('/')) {
        addCandidate(`/${trimmed}`);
      }
      try {
        const normalizedSlashes = trimmed.replace(/\+/g, '/').replace(/\/+/g, '/');
        if (normalizedSlashes && normalizedSlashes !== trimmed) {
          addCandidate(normalizedSlashes);
        }
      } catch (_) {}
      if (trimmed.endsWith('/')) {
        const withoutTrailing = trimmed.replace(/\/+$/, '');
        if (withoutTrailing && withoutTrailing !== trimmed) {
          addCandidate(withoutTrailing);
        }
      }
      try {
        const parts = trimmed.split('/');
        const capitalizedParts = parts.map((segment, idx) => {
          if (!segment) return segment;
          if (idx === 0 && segment === '') return segment;
          const first = segment.charAt(0);
          if (!first) return segment;
          const upper = first.toLocaleUpperCase('nb-NO');
          if (upper === first) return segment;
          return upper + segment.slice(1);
        });
        const capitalized = capitalizedParts.join('/');
        if (capitalized && capitalized !== trimmed) {
          addCandidate(capitalized);
        }
      } catch (_) {}
      const upperEncoded = trimmed.replace(/%[0-9a-fA-F]{2}/g, match => match.toUpperCase());
      if (upperEncoded && upperEncoded !== trimmed) {
        addCandidate(upperEncoded);
      }
      const lowerEncoded = trimmed.replace(/%[0-9a-fA-F]{2}/g, match => match.toLowerCase());
      if (lowerEncoded && lowerEncoded !== trimmed) {
        addCandidate(lowerEncoded);
      }
    };
    const addPath = value => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      addCandidate(trimmed);
      const attemptDecoded = decoder => {
        try {
          const decoded = decoder(trimmed);
          if (decoded && decoded !== trimmed) {
            addCandidate(decoded);
            try {
              const reencoded = encodeURI(decoded);
              if (reencoded && reencoded !== trimmed) {
                addCandidate(reencoded);
              }
            } catch (_) {}
          }
        } catch (_) {}
      };
      attemptDecoded(decodeURI);
      attemptDecoded(decodeURIComponent);
    };
    addPath(rawPath);
    if (typeof rawPath === 'string') {
      const trimmed = rawPath.trim();
      if (trimmed) {
        if (trimmed.endsWith('/')) {
          const normalized = trimmed.replace(/\+/g, '/').replace(/\/+/g, '/').replace(/\/+$/, '');
          addPath(normalized);
        } else {
          addPath(trimmed + '/');
        }
        if (/index\.html?$/i.test(trimmed)) {
          addPath(trimmed.replace(/index\.html?$/i, ''));
        } else {
          const base = trimmed.endsWith('/') ? trimmed : trimmed + '/';
          addPath(base + 'index.html');
        }
      }
    }
    addPath(canonicalPath);
    if (canonicalPath && canonicalPath !== '/' && !canonicalPath.endsWith('/')) {
      addPath(canonicalPath + '/');
    }
    if (canonicalPath && canonicalPath !== '/' && !/\.html?$/i.test(canonicalPath)) {
      addPath(`${canonicalPath}.html`);
      addPath(`${canonicalPath}.htm`);
    }
    const canonicalBase = canonicalPath.endsWith('/') ? canonicalPath : `${canonicalPath}/`;
    addPath(canonicalBase + 'index.html');
    const legacyCanonicalPath = normalizePathname(rawPath, { preserveCase: true });
    if (legacyCanonicalPath && legacyCanonicalPath !== canonicalPath) {
      addPath(legacyCanonicalPath);
      if (legacyCanonicalPath !== '/' && !legacyCanonicalPath.endsWith('/')) {
        addPath(`${legacyCanonicalPath}/`);
      }
      if (legacyCanonicalPath !== '/' && !/\.html?$/i.test(legacyCanonicalPath)) {
        addPath(`${legacyCanonicalPath}.html`);
        addPath(`${legacyCanonicalPath}.htm`);
      }
      const legacyBase = legacyCanonicalPath.endsWith('/') ? legacyCanonicalPath : `${legacyCanonicalPath}/`;
      addPath(legacyBase + 'index.html');
    }
    const keys = [];
    paths.forEach(path => {
      if (!path) return;
      const key = prefix + path;
      if (key !== canonicalKey) keys.push(key);
    });
    return keys;
  }

  function storageKeyToPath(storageKey) {
    if (typeof storageKey !== 'string') return null;
    if (!storageKey.startsWith(STORAGE_KEY_PREFIX)) return null;
    const suffix = storageKey.slice(STORAGE_KEY_PREFIX.length);
    if (!suffix) return '/';
    return suffix.startsWith('/') ? suffix : `/${suffix}`;
  }
  const rawPath =
    typeof location !== 'undefined' && location && typeof location.pathname === 'string'
      ? location.pathname
      : '/';
  const storagePath = normalizePathname(rawPath);
  const key = STORAGE_KEY_PREFIX + storagePath;
  const historyKey = key + '_history';
  const trashKey = key + '_trash';
  const trashMigratedKey = key + '_trash_migrated_v1';
  const updatedAtKey = key + '_updatedAtMs';
  const OPEN_REQUEST_STORAGE_KEY = 'archive_open_request';
  const OPEN_REQUEST_WINDOW_NAME_PREFIX = 'mathvis:archive-open-request:';
  const OPEN_REQUEST_TRANSPORT_METADATA_KEY = '__mathvisArchiveOpenTransport';
  let lastArchiveOpenRequestTransport = null;

  function attachArchiveOpenRequestTransportMetadata(target, metadata) {
    if (!target || typeof target !== 'object') return metadata || null;
    try {
      Object.defineProperty(target, OPEN_REQUEST_TRANSPORT_METADATA_KEY, {
        value: metadata || null,
        configurable: true,
        enumerable: false,
        writable: true
      });
    } catch (_) {
      try {
        target[OPEN_REQUEST_TRANSPORT_METADATA_KEY] = metadata || null;
      } catch (error) {}
    }
    return metadata || null;
  }

  function getArchiveOpenRequestTransportMetadata(target) {
    if (!target || typeof target !== 'object') return null;
    try {
      return target[OPEN_REQUEST_TRANSPORT_METADATA_KEY] || null;
    } catch (error) {
      return null;
    }
  }

  function recordArchiveOpenRequestTransport(metadata) {
    lastArchiveOpenRequestTransport = metadata || null;
  }

  function readWindowNameArchiveOpenRequest() {
    if (typeof window === 'undefined') return null;
    let windowName = '';
    try {
      windowName = typeof window.name === 'string' ? window.name : '';
    } catch (error) {
      windowName = '';
    }
    if (!windowName || typeof windowName !== 'string') return null;
    if (!windowName.startsWith(OPEN_REQUEST_WINDOW_NAME_PREFIX)) return null;
    const payload = windowName.slice(OPEN_REQUEST_WINDOW_NAME_PREFIX.length);
    if (!payload) return null;
    let parsed = null;
    try {
      parsed = JSON.parse(payload);
    } catch (error) {
      parsed = null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const metadata = {
      type: 'window-name',
      payload: windowName,
      prefix: OPEN_REQUEST_WINDOW_NAME_PREFIX
    };
    attachArchiveOpenRequestTransportMetadata(parsed, metadata);
    return { request: parsed, metadata };
  }

  function persistArchiveOpenRequestData(request) {
    const result = {
      metadata: null,
      serialized: null,
      persisted: false
    };
    if (!request || typeof request !== 'object') {
      try {
        storageRemoveItem(OPEN_REQUEST_STORAGE_KEY);
      } catch (_) {}
      recordArchiveOpenRequestTransport(null);
      return result;
    }
    let serialized = null;
    try {
      serialized = JSON.stringify(request);
    } catch (error) {
      serialized = null;
    }
    if (!serialized) {
      recordArchiveOpenRequestTransport(null);
      return result;
    }
    result.serialized = serialized;
    let store = null;
    try {
      store = getSharedMemoryStorage();
    } catch (error) {
      store = null;
    }
    let persistedViaStorage = false;
    if (store && typeof store.setItem === 'function') {
      try {
        store.setItem(OPEN_REQUEST_STORAGE_KEY, serialized);
        persistedViaStorage = store.__isMemoryStorage === true ? false : true;
        if (!persistedViaStorage && typeof store.removeItem === 'function') {
          store.removeItem(OPEN_REQUEST_STORAGE_KEY);
        }
      } catch (error) {
        if (store && typeof store.removeItem === 'function') {
          try {
            store.removeItem(OPEN_REQUEST_STORAGE_KEY);
          } catch (_) {}
        }
        persistedViaStorage = false;
      }
    }
    if (persistedViaStorage) {
      result.metadata = {
        type: 'storage',
        storageKey: OPEN_REQUEST_STORAGE_KEY
      };
      result.persisted = true;
    } else {
      result.metadata = {
        type: 'window-name',
        payload: `${OPEN_REQUEST_WINDOW_NAME_PREFIX}${serialized}`,
        prefix: OPEN_REQUEST_WINDOW_NAME_PREFIX
      };
      result.persisted = false;
    }
    attachArchiveOpenRequestTransportMetadata(request, result.metadata);
    recordArchiveOpenRequestTransport(result.metadata);
    return result;
  }
  const TEMPORARY_EXAMPLE_FLAG = '__isTemporaryExample';
  const TEMPORARY_EXAMPLE_REQUEST_ID = '__openRequestId';
  const TEMPORARY_EXAMPLE_SOURCE_PATH = '__openRequestSourcePath';
  const TEMPORARY_EXAMPLE_CREATED_AT = '__openRequestCreatedAt';
  const TEMPORARY_EXAMPLE_NOTICE_PENDING = '__openRequestNoticePending';
  const TEMPORARY_EXAMPLE_NOTICE_SHOWN = '__openRequestNoticeShown';
  const MAX_TRASH_ENTRIES = 200;
  const TRASH_QUEUE_STORAGE_KEY = 'mathvis:examples:trashQueue:v1';
  const MAX_HISTORY_ENTRIES = 10;
  let lastStoredRawValue = null;
  let historyEntriesCache = null;
  let historyEntriesLoaded = false;
  let trashMigrationAttempted = false;
  function parseUpdatedAtValue(value) {
    if (value == null) return 0;
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return 0;
  }
  function loadPersistedUpdatedAt() {
    let raw = null;
    try {
      raw = storageGetItem(updatedAtKey);
    } catch (_) {
      raw = null;
    }
    return parseUpdatedAtValue(raw);
  }
  function persistLocalUpdatedAt(value) {
    if (!Number.isFinite(value) || value <= 0) {
      try {
        storageRemoveItem(updatedAtKey);
      } catch (_) {}
      return;
    }
    try {
      storageSetItem(updatedAtKey, String(value));
    } catch (_) {}
  }
  function normalizeHistoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const raw = typeof entry.data === 'string' ? entry.data.trim() : '';
    if (!raw) return null;
    const normalized = {
      data: raw,
      reason: typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason.trim() : 'unknown',
      savedAt: typeof entry.savedAt === 'string' && entry.savedAt.trim() ? entry.savedAt.trim() : new Date().toISOString()
    };
    return normalized;
  }
  function loadHistoryEntries() {
    if (historyEntriesLoaded) return historyEntriesCache || [];
    historyEntriesLoaded = true;
    historyEntriesCache = [];
    let rawHistory = null;
    try {
      rawHistory = storageGetItem(historyKey);
    } catch (_) {
      rawHistory = null;
    }
    if (typeof rawHistory === 'string' && rawHistory.trim()) {
      try {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          const entries = [];
          parsed.forEach(item => {
            const normalized = normalizeHistoryEntry(item);
            if (normalized) entries.push(normalized);
          });
          historyEntriesCache = entries.slice(0, MAX_HISTORY_ENTRIES);
        }
      } catch (_) {
        historyEntriesCache = [];
      }
    }
    return historyEntriesCache;
  }
  function persistHistoryEntries(entries) {
    historyEntriesCache = Array.isArray(entries) ? entries.slice(0, MAX_HISTORY_ENTRIES) : [];
    historyEntriesLoaded = true;
    if (!historyEntriesCache.length) {
      try {
        storageRemoveItem(historyKey);
      } catch (_) {}
    } else {
      try {
        storageSetItem(historyKey, JSON.stringify(historyEntriesCache));
      } catch (_) {}
    }
    try {
      updateRestoreButtonState();
    } catch (_) {}
    return historyEntriesCache;
  }
  function rememberHistoryRaw(rawValue, reason) {
    if (typeof rawValue !== 'string') return;
    const trimmed = rawValue.trim();
    if (!trimmed) return;
    const existing = loadHistoryEntries();
    const entries = [];
    const seen = new Set();
    const pushEntry = (entry, defaultReason) => {
      const normalized = normalizeHistoryEntry(entry);
      if (!normalized) return;
      const key = normalized.data;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push({
        data: key,
        reason: normalized.reason || defaultReason || 'unknown',
        savedAt: normalized.savedAt
      });
    };
    pushEntry({
      data: trimmed,
      reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'unknown',
      savedAt: new Date().toISOString()
    });
    existing.forEach(entry => pushEntry(entry));
    persistHistoryEntries(entries);
  }

  function deserializeTrashEntries(raw) {
    if (typeof raw !== 'string' || !raw.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      const value = deserializeExampleValue(parsed, new WeakMap());
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function deriveExampleLabel(example) {
    if (!example || typeof example !== 'object') return '';
    if (typeof example.title === 'string' && example.title.trim()) {
      return example.title.trim();
    }
    if (typeof example.exampleNumber === 'string' && example.exampleNumber.trim()) {
      return example.exampleNumber.trim();
    }
    if (typeof example.exampleNumber === 'number' && Number.isFinite(example.exampleNumber)) {
      return String(example.exampleNumber);
    }
    if (typeof example.description === 'string' && example.description.trim()) {
      const condensed = example.description.replace(/\s+/g, ' ').trim();
      if (condensed.length <= 80) return condensed;
      return `${condensed.slice(0, 77)}…`;
    }
    return '';
  }

  function generateTrashId() {
    const rand = Math.random().toString(36).slice(2, 10);
    const timestamp = Date.now().toString(36);
    return `${timestamp}-${rand}`;
  }

  function normalizeTrashEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const normalizedExample = entry.example && typeof entry.example === 'object' ? cloneValue(entry.example) : null;
    if (!normalizedExample) return null;
    const now = new Date().toISOString();
    const label = typeof entry.label === 'string' && entry.label.trim() ? entry.label.trim() : deriveExampleLabel(normalizedExample);
    return {
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : generateTrashId(),
      example: normalizedExample,
      deletedAt: typeof entry.deletedAt === 'string' && entry.deletedAt.trim() ? entry.deletedAt.trim() : now,
      sourcePath: typeof entry.sourcePath === 'string' && entry.sourcePath.trim() ? entry.sourcePath.trim() : storagePath,
      sourceHref: typeof entry.sourceHref === 'string' && entry.sourceHref.trim() ? entry.sourceHref.trim() : rawPath,
      sourceTitle: typeof entry.sourceTitle === 'string' ? entry.sourceTitle : typeof document !== 'undefined' && document.title ? document.title : '',
      reason: typeof entry.reason === 'string' && entry.reason.trim() ? entry.reason.trim() : 'delete',
      removedAtIndex: Number.isInteger(entry.removedAtIndex) ? entry.removedAtIndex : null,
      label,
      importedFromHistory: entry.importedFromHistory === true
    };
  }

  function loadLegacyTrashEntries() {
    let raw = null;
    try {
      raw = storageGetItem(trashKey);
    } catch (_) {
      raw = null;
    }
    if (typeof raw !== 'string' || !raw.trim()) {
      return [];
    }
    const parsed = deserializeTrashEntries(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const normalized = [];
    parsed.forEach(item => {
      const normalizedEntry = normalizeTrashEntry(item);
      if (normalizedEntry) {
        normalized.push(normalizedEntry);
      }
    });
    return normalized;
  }

  function clearLegacyTrashEntries() {
    try {
      storageRemoveItem(trashKey);
    } catch (_) {}
  }

  function buildTrashPayload(entries, options) {
    const normalized = Array.isArray(entries)
      ? entries.map(normalizeTrashEntry).filter(Boolean)
      : [];
    const payload = { entries: normalized };
    if (options && options.replace === true) {
      payload.replace = true;
    }
    if (options && typeof options.mode === 'string' && options.mode.trim()) {
      payload.mode = options.mode.trim();
    }
    if (options && Number.isInteger(options.limit) && options.limit > 0) {
      payload.limit = options.limit;
    }
    return payload;
  }

  async function postTrashEntries(entries, options) {
    if (!trashApiBase) {
      return null;
    }
    if (typeof fetch !== 'function') {
      return null;
    }
    const url = buildTrashApiUrl(trashApiBase);
    if (!url) {
      return null;
    }
    const payload = buildTrashPayload(entries, options);
    if (!payload.entries.length && payload.replace !== true) {
      return null;
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Trash API responded with ${response.status}`);
      }
      return response;
    } catch (error) {
      console.error('[examples] failed to communicate with trash API', error);
      return null;
    }
  }

  function createMemoryStorage() {
    const map = new Map();
    return {
      getItem(key) {
        if (!map.has(key)) return null;
        return map.get(key);
      },
      setItem(key, value) {
        map.set(key, String(value));
      },
      removeItem(key) {
        map.delete(key);
      }
    };
  }

  function createTrashQueueManager({ storage, storageKey = TRASH_QUEUE_STORAGE_KEY, sendEntry } = {}) {
    const resolvedStorage = storage && typeof storage.getItem === 'function' ? storage : createMemoryStorage();
    let cache = null;
    let flushPromise = null;
    const listeners = new Set();

    function emit(event) {
      if (!event || typeof event !== 'object') return;
      listeners.forEach(listener => {
        if (typeof listener !== 'function') return;
        try {
          listener(event);
        } catch (_) {}
      });
    }

    function cloneEntry(entry) {
      if (!entry || typeof entry !== 'object') return null;
      try {
        return cloneValue(entry);
      } catch (_) {
        try {
          return JSON.parse(JSON.stringify(entry));
        } catch (error) {
          return { ...entry };
        }
      }
    }

    function readQueue() {
      if (Array.isArray(cache)) {
        return cache;
      }
      let raw = null;
      try {
        raw = resolvedStorage.getItem(storageKey);
      } catch (error) {
        raw = null;
      }
      if (!raw) {
        cache = [];
        return cache;
      }
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          cache = parsed.filter(item => item && typeof item === 'object');
        } else {
          cache = [];
        }
      } catch (error) {
        cache = [];
      }
      return cache;
    }

    function writeQueue(list) {
      cache = Array.isArray(list) ? list : [];
      if (!cache.length) {
        try {
          resolvedStorage.removeItem(storageKey);
        } catch (_) {}
        emit({ type: 'update', queue: [] });
        return;
      }
      try {
        resolvedStorage.setItem(storageKey, JSON.stringify(cache));
      } catch (error) {}
      emit({ type: 'update', queue: cache.map(cloneEntry).filter(Boolean) });
    }

    function normalizeMode(mode) {
      return mode === 'append' ? 'append' : 'prepend';
    }

    function normalizeEntry(entry) {
      if (!entry || typeof entry !== 'object') return null;
      const record = entry.record && typeof entry.record === 'object' ? cloneEntry(entry.record) : null;
      if (!record) return null;
      const normalized = {
        record,
        mode: normalizeMode(entry.mode),
        queuedAt:
          typeof entry.queuedAt === 'string' && entry.queuedAt.trim()
            ? entry.queuedAt.trim()
            : (() => {
                try {
                  return new Date().toISOString();
                } catch (_) {
                  return '';
                }
              })()
      };
      const limit = Number.isInteger(entry.limit) && entry.limit > 0 ? entry.limit : null;
      if (limit) {
        normalized.limit = limit;
      }
      return normalized;
    }

    function getQueueSnapshot() {
      return readQueue()
        .map(cloneEntry)
        .filter(entry => entry && typeof entry === 'object');
    }

    function enqueue(entry) {
      const normalized = normalizeEntry(entry);
      if (!normalized) return null;
      const queue = readQueue();
      queue.push(normalized);
      writeQueue(queue);
      emit({ type: 'enqueue', entry: cloneEntry(normalized), queue: getQueueSnapshot() });
      return cloneEntry(normalized);
    }

    async function flush() {
      if (flushPromise) {
        return flushPromise;
      }
      const queue = readQueue();
      if (!queue.length) {
        return { processed: 0, remaining: 0 };
      }
      if (typeof sendEntry !== 'function') {
        throw new Error('Trash queue is missing a sendEntry handler.');
      }
      let processed = 0;
      flushPromise = (async () => {
        while (queue.length) {
          const current = queue[0];
          if (!current || !current.record) {
            queue.shift();
            processed++;
            writeQueue(queue);
            continue;
          }
          try {
            await sendEntry(cloneEntry(current));
          } catch (error) {
            emit({ type: 'error', error, entry: cloneEntry(current), processed, remaining: queue.length });
            throw error;
          }
          queue.shift();
          processed++;
          writeQueue(queue);
          emit({ type: 'processed', entry: cloneEntry(current), processed, remaining: queue.length });
        }
        return { processed, remaining: queue.length };
      })();
      try {
        const result = await flushPromise;
        emit({ type: 'flushed', result, queue: getQueueSnapshot() });
        return result;
      } finally {
        flushPromise = null;
      }
    }

    function hasPending() {
      return readQueue().length > 0;
    }

    function getQueueLength() {
      return readQueue().length;
    }

    function clear() {
      writeQueue([]);
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }

    return {
      enqueue,
      flush,
      hasPending,
      getQueue: getQueueSnapshot,
      getQueueLength,
      clear,
      subscribe,
      storage: resolvedStorage,
      storageKey
    };
  }

  function getDefaultTrashQueueStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createMemoryStorage();
    }
    try {
      const storage = window.localStorage;
      const probeKey = `${TRASH_QUEUE_STORAGE_KEY}__probe`;
      storage.setItem(probeKey, '1');
      storage.removeItem(probeKey);
      return storage;
    } catch (error) {
      return createMemoryStorage();
    }
  }

  let trashToastStyleInjected = false;
  let trashToastContainer = null;

  function ensureTrashToastContainer(doc) {
    if (!doc || typeof doc.createElement !== 'function') return null;
    if (!trashToastStyleInjected) {
      const style = doc.createElement('style');
      style.type = 'text/css';
      style.textContent =
        '.examples-trash-toast-container{position:fixed;bottom:1.5rem;right:1.5rem;display:flex;flex-direction:column;gap:0.5rem;z-index:2147483000;max-width:min(28rem,calc(100vw - 2rem));}' +
        '.examples-trash-toast{background:#1c1c1f;color:#fff;padding:0.75rem 1rem;border-radius:0.75rem;box-shadow:0 0.75rem 2rem rgba(0,0,0,0.2);font-size:0.95rem;line-height:1.4;display:flex;align-items:flex-start;gap:0.75rem;transition:opacity 200ms ease,transform 200ms ease;}' +
        '.examples-trash-toast--error{background:#b3261e;color:#fff;}' +
        '.examples-trash-toast--success{background:#0b6a0b;color:#fff;}' +
        '.examples-trash-toast--info{background:#1c1c1f;color:#fff;}' +
        '.examples-trash-toast--closing{opacity:0;transform:translateY(25%);}';
      try {
        doc.head.appendChild(style);
        trashToastStyleInjected = true;
      } catch (error) {}
    }
    if (trashToastContainer && trashToastContainer.isConnected) {
      return trashToastContainer;
    }
    const container = doc.createElement('div');
    container.className = 'examples-trash-toast-container';
    try {
      doc.body.appendChild(container);
      trashToastContainer = container;
      return container;
    } catch (error) {
      return null;
    }
  }

  function showTrashToast(message, type = 'info') {
    if (typeof document === 'undefined') {
      if (type === 'error') {
        console.error(message);
      } else {
        console.log(message);
      }
      return null;
    }
    const doc = document;
    const container = ensureTrashToastContainer(doc);
    if (!container) {
      if (type === 'error') {
        console.error(message);
      } else {
        console.log(message);
      }
      return null;
    }
    const toast = doc.createElement('div');
    toast.className = `examples-trash-toast examples-trash-toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = String(message || '');
    container.appendChild(toast);
    const timeout = setTimeout(() => {
      toast.classList.add('examples-trash-toast--closing');
      const removeTimer = setTimeout(() => {
        if (toast.isConnected) {
          toast.remove();
        }
        clearTimeout(removeTimer);
      }, 220);
    }, 6000);
    toast.addEventListener('click', () => {
      toast.classList.add('examples-trash-toast--closing');
      clearTimeout(timeout);
      setTimeout(() => {
        if (toast.isConnected) {
          toast.remove();
        }
      }, 200);
    });
    return toast;
  }

  function describeTrashQueueError(error) {
    if (!error) return 'ukjent feil';
    if (typeof error === 'string') return error;
    if (error && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }
    try {
      return JSON.stringify(error);
    } catch (_) {
      return String(error);
    }
  }

  const trashQueueManager = createTrashQueueManager({
    storage: getDefaultTrashQueueStorage(),
    sendEntry: async entry => {
      if (!entry || typeof entry !== 'object' || !entry.record) {
        return null;
      }
      const mode = entry.mode === 'append' ? 'append' : 'prepend';
      const limit = Number.isInteger(entry.limit) && entry.limit > 0 ? entry.limit : MAX_TRASH_ENTRIES;
      const response = await postTrashEntries([entry.record], { mode, limit });
      if (!response) {
        throw new Error('Kunne ikke nå tjenesten for slettede figurer.');
      }
      return response;
    }
  });

  function queueTrashEntryForRetry(entry, reason) {
    const queued = trashQueueManager.enqueue(entry);
    if (!queued) {
      showTrashToast('Kunne ikke lagre slettet eksempel for opplasting senere.', 'error');
      return;
    }
    const message =
      reason === 'flush-failed'
        ? 'Kunne ikke sende slettede figurer til arkivet. Vi prøver igjen senere.'
        : 'Kunne ikke sende slettet eksempel til arkivet. Vi prøver igjen senere.';
    showTrashToast(message, 'error');
  }

  let trashQueueRetryInitialized = false;

  function flushQueuedTrashEntries({ silent = false } = {}) {
    if (!trashQueueManager.hasPending()) {
      if (!silent) {
        showTrashToast('Ingen slettede figurer venter på opplasting.', 'info');
      }
      return Promise.resolve({ processed: 0, remaining: 0 });
    }
    return trashQueueManager
      .flush()
      .then(result => {
        if (!silent) {
          showTrashToast('Ventende slettede figurer ble sendt til arkivet.', 'success');
        }
        return result;
      })
      .catch(error => {
        if (!silent) {
          const message = describeTrashQueueError(error);
          showTrashToast(`Kunne ikke sende ventende slettinger: ${message}.`, 'error');
        }
        throw error;
      });
  }

  function ensureTrashQueueRetryListeners() {
    if (trashQueueRetryInitialized) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const retry = (silentReason = true) => {
      flushQueuedTrashEntries({ silent: silentReason !== false }).catch(() => {});
    };
    window.addEventListener('focus', () => retry(true));
    window.addEventListener('online', () => retry(true));
    if (typeof document !== 'undefined' && document) {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          retry(true);
        }
      });
      if (document.readyState === 'complete') {
        retry(true);
      } else {
        document.addEventListener(
          'DOMContentLoaded',
          () => {
            retry(true);
          },
          { once: true }
        );
      }
    } else {
      retry(true);
    }
    trashQueueRetryInitialized = true;
  }

  ensureTrashQueueRetryListeners();

  if (globalScope) {
    const publicInterface = {
      enqueue(entry) {
        return trashQueueManager.enqueue(entry);
      },
      flush(options) {
        return flushQueuedTrashEntries(options || {});
      },
      flushPending(options) {
        return flushQueuedTrashEntries(options || {});
      },
      hasPending() {
        return trashQueueManager.hasPending();
      },
      getQueue() {
        return trashQueueManager.getQueue();
      },
      getQueueLength() {
        return trashQueueManager.getQueueLength();
      },
      storageKey: TRASH_QUEUE_STORAGE_KEY,
      __isMathVisTrashQueue: true
    };
    globalScope.MathVisExamplesTrashQueue = publicInterface;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = module.exports || {};
    module.exports.createTrashQueueManager = createTrashQueueManager;
    module.exports.TRASH_QUEUE_STORAGE_KEY = TRASH_QUEUE_STORAGE_KEY;
  }

  function buildExampleSignature(example) {
    if (!example || typeof example !== 'object') return '';
    try {
      const serialized = serializeExamplesForStorage([example]);
      return serialized || '';
    } catch (error) {
      try {
        return JSON.stringify(example);
      } catch (_) {
        return '';
      }
    }
  }

  async function addExampleToTrash(example, options) {
    if (!example || typeof example !== 'object') return;
    const opts = options && typeof options === 'object' ? options : {};
    const normalizedExample = opts.preNormalized === true && example && typeof example === 'object' ? cloneValue(example) : normalizeExamplesForStorage([example])[0] || {};
    let sanitizedPreview = null;
    if (opts.capturePreview === true) {
      try {
        const previewSvg = collectExampleSvgMarkup();
        sanitizedPreview = sanitizeSvgForStorage(previewSvg);
        if (sanitizedPreview) {
          normalizedExample.svg = sanitizedPreview;
        }
      } catch (error) {
        console.error('[examples] failed to capture svg preview for trash entry', error);
      }
    }
    const thumbnailSource = sanitizedPreview || (typeof normalizedExample.svg === 'string' ? normalizedExample.svg : '');
    if (thumbnailSource) {
      try {
        const thumbnail = await generateExampleThumbnail(thumbnailSource);
        if (thumbnail) {
          normalizedExample.thumbnail = thumbnail;
        }
      } catch (error) {
        console.error('[examples] failed to generate svg thumbnail for trash entry', error);
      }
    }
    const record = normalizeTrashEntry({
      id: typeof opts.id === 'string' && opts.id.trim() ? opts.id.trim() : undefined,
      example: normalizedExample,
      deletedAt: typeof opts.deletedAt === 'string' ? opts.deletedAt : undefined,
      sourcePath: typeof opts.sourcePath === 'string' ? opts.sourcePath : storagePath,
      sourceHref: typeof opts.sourceHref === 'string' ? opts.sourceHref : rawPath,
      sourceTitle: typeof opts.sourceTitle === 'string' ? opts.sourceTitle : undefined,
      reason: typeof opts.reason === 'string' ? opts.reason : 'delete',
      removedAtIndex: Number.isInteger(opts.index) ? opts.index : null,
      label: typeof opts.label === 'string' ? opts.label : undefined,
      importedFromHistory: opts.importedFromHistory === true
    });
    if (!record) return;
    const mode = opts.prepend === false ? 'append' : 'prepend';
    try {
      const response = await postTrashEntries([record], {
        mode,
        limit: MAX_TRASH_ENTRIES
      });
      if (!response) {
        throw new Error('Trash API returned et tomt svar.');
      }
    } catch (error) {
      console.error('[examples] failed to persist trash entry', error);
      queueTrashEntryForRetry({
        record,
        mode,
        limit: MAX_TRASH_ENTRIES
      });
    }
  }

  async function ensureTrashHistoryMigration() {
    if (trashMigrationAttempted) return;
    trashMigrationAttempted = true;
    let alreadyMigrated = false;
    try {
      const marker = storageGetItem(trashMigratedKey);
      if (typeof marker === 'string' && marker.trim()) {
        alreadyMigrated = true;
      }
    } catch (_) {
      alreadyMigrated = false;
    }
    const existingTrash = loadLegacyTrashEntries();
    if (alreadyMigrated && existingTrash.length === 0) {
      return;
    }
    const working = existingTrash.slice();
    const seenSignatures = new Set();
    working.forEach(entry => {
      const signature = buildExampleSignature(entry && entry.example);
      if (signature) {
        seenSignatures.add(signature);
      }
    });
    const currentExamples = getExamples();
    const normalizedCurrent = normalizeExamplesForStorage(currentExamples);
    normalizedCurrent.forEach(example => {
      const signature = buildExampleSignature(example);
      if (signature) {
        seenSignatures.add(signature);
      }
    });
    const historyEntries = loadHistoryEntries();
    historyEntries.forEach(entry => {
      if (!entry || typeof entry.data !== 'string') return;
      const parsed = parseExamplesFromRaw(entry.data);
      if (parsed.status !== 'ok' || !Array.isArray(parsed.examples)) return;
      const normalized = normalizeExamplesForStorage(parsed.examples);
      normalized.forEach((example, idx) => {
        const signature = buildExampleSignature(example);
        if (!signature || seenSignatures.has(signature)) return;
        const record = normalizeTrashEntry({
          example,
          deletedAt: typeof entry.savedAt === 'string' ? entry.savedAt : undefined,
          reason: 'history',
          removedAtIndex: idx,
          importedFromHistory: true
        });
        if (record) {
          working.push(record);
          seenSignatures.add(signature);
        }
      });
    });
    const finalEntries = working.slice(0, MAX_TRASH_ENTRIES);
    if (trashApiBase && typeof fetch === 'function') {
      const result = await postTrashEntries(finalEntries, {
        replace: true,
        limit: MAX_TRASH_ENTRIES
      });
      if (result) {
        clearLegacyTrashEntries();
      }
    }
    try {
      storageSetItem(trashMigratedKey, new Date().toISOString());
    } catch (_) {}
  }
  function parseExamplesFromRaw(rawValue) {
    if (rawValue == null) {
      return {
        status: 'empty',
        examples: []
      };
    }
    if (typeof rawValue !== 'string') {
      return {
        status: 'invalid',
        examples: []
      };
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return {
        status: 'empty',
        examples: []
      };
    }
    try {
      const parsed = deserializeExamplesFromRaw(trimmed);
      if (Array.isArray(parsed)) {
        return {
          status: 'ok',
          examples: parsed
        };
      }
      return {
        status: 'invalid',
        examples: []
      };
    } catch (error) {
      return {
        status: 'error',
        error,
        examples: []
      };
    }
  }
  function getFirstRestorableHistoryEntry() {
    const entries = loadHistoryEntries();
    for (const entry of entries) {
      if (!entry || typeof entry.data !== 'string') continue;
      const parsed = parseExamplesFromRaw(entry.data);
      if (parsed.status === 'ok' && Array.isArray(parsed.examples) && parsed.examples.length > 0) {
        return {
          raw: entry.data,
          entry,
          parsed
        };
      }
    }
    return null;
  }
  function applyRawExamples(rawValue, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const reason = typeof opts.reason === 'string' && opts.reason.trim() ? opts.reason.trim() : 'update';
    const skipHistory = opts.skipHistory === true;
    const normalizedRaw = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (!normalizedRaw) {
      if (!skipHistory && typeof lastStoredRawValue === 'string' && lastStoredRawValue.trim()) {
        rememberHistoryRaw(lastStoredRawValue, reason);
      }
      cachedExamples = [];
      cachedExamplesInitialized = true;
      try {
        storageRemoveItem(key);
      } catch (_) {}
      lastStoredRawValue = null;
      lastLocalUpdateMs = 0;
      persistLocalUpdatedAt(0);
      try {
        updateRestoreButtonState();
      } catch (_) {}
      return true;
    }
    const parsed = parseExamplesFromRaw(normalizedRaw);
    if (parsed.status !== 'ok') {
      return false;
    }
    if (!skipHistory && typeof lastStoredRawValue === 'string' && lastStoredRawValue.trim() && lastStoredRawValue.trim() !== normalizedRaw) {
      rememberHistoryRaw(lastStoredRawValue, reason);
    }
    cachedExamples = Array.isArray(parsed.examples) ? parsed.examples : [];
    cachedExamplesInitialized = true;
    try {
      storageSetItem(key, normalizedRaw);
    } catch (_) {}
    lastStoredRawValue = normalizedRaw;
    try {
      updateRestoreButtonState();
    } catch (_) {}
    return true;
  }
  function attemptHistoryRecovery(currentRawValue) {
    const entries = loadHistoryEntries();
    if (!entries || entries.length === 0) return false;
    const currentTrimmed = typeof currentRawValue === 'string' ? currentRawValue.trim() : '';
    for (const entry of entries) {
      if (!entry || typeof entry.data !== 'string') continue;
      const candidateRaw = entry.data.trim();
      if (!candidateRaw) continue;
      const parsed = parseExamplesFromRaw(candidateRaw);
      if (parsed.status !== 'ok') continue;
      if (currentTrimmed && currentTrimmed === candidateRaw) continue;
      if (currentTrimmed) {
        rememberHistoryRaw(currentTrimmed, 'auto-recovery');
      }
      const applied = applyRawExamples(candidateRaw, {
        reason: 'auto-recovery',
        skipHistory: true
      });
      if (applied) {
        cachedExamples = Array.isArray(parsed.examples) ? parsed.examples : [];
        cachedExamplesInitialized = true;
        return true;
      }
    }
    return false;
  }
  function formatHistoryTimestamp(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return trimmed;
    }
    try {
      return date.toLocaleString('nb-NO');
    } catch (_) {
      try {
        return date.toLocaleString();
      } catch (_) {}
    }
    try {
      return date.toISOString();
    } catch (_) {}
    return trimmed;
  }
  const legacyKeys = computeLegacyStorageKeys(rawPath, storagePath);
  try {
    let canonicalValue = storageGetItem(key);
    if (canonicalValue == null) {
      for (const legacyKey of legacyKeys) {
        const legacyValue = storageGetItem(legacyKey);
        if (legacyValue != null) {
          storageSetItem(key, legacyValue);
          canonicalValue = legacyValue;
          break;
        }
      }
    }
    const deletedKey = key + '_deletedProvidedExamples';
    let canonicalDeletedValue = storageGetItem(deletedKey);
    if (canonicalDeletedValue == null) {
      for (const legacyKey of legacyKeys) {
        const candidate = legacyKey + '_deletedProvidedExamples';
        const legacyValue = storageGetItem(candidate);
        if (legacyValue != null) {
          storageSetItem(deletedKey, legacyValue);
          canonicalDeletedValue = legacyValue;
          break;
        }
      }
    }
    if (typeof canonicalValue === 'string') {
      lastStoredRawValue = canonicalValue;
    }
    legacyKeys.forEach(legacyKey => {
      if (legacyKey === key) return;
      try { storageRemoveItem(legacyKey); } catch (_) {}
      const candidate = legacyKey + '_deletedProvidedExamples';
      try { storageRemoveItem(candidate); } catch (_) {}
    });
  } catch (_) {}
  if (lastStoredRawValue == null) {
    try {
      const initialRaw = storageGetItem(key);
      if (typeof initialRaw === 'string') {
        lastStoredRawValue = initialRaw;
      }
    } catch (_) {
      lastStoredRawValue = null;
    }
  }
  const examplesApiBase = resolveExamplesApiBase();
  const trashApiBase = examplesApiBase ? buildTrashApiBase(examplesApiBase) : null;

  function normalizeBackendStoreMode(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
    if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
    return null;
  }

  function readStoreModeFromHeadersLike(headers) {
    if (!headers) return null;
    try {
      if (typeof headers.get === 'function') {
        const value = headers.get('X-Examples-Store-Mode');
        const normalized = normalizeBackendStoreMode(value);
        if (normalized) return normalized;
      }
    } catch (_) {}
    try {
      const direct = headers['X-Examples-Store-Mode'] || headers['x-examples-store-mode'];
      const normalized = normalizeBackendStoreMode(direct);
      if (normalized) return normalized;
    } catch (_) {}
    return null;
  }

  function readStoreModeFromPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const direct = normalizeBackendStoreMode(
      payload.mode || payload.storage || payload.storageMode || payload.storeMode
    );
    if (direct) return direct;
    if (Array.isArray(payload.entries)) {
      for (const entry of payload.entries) {
        const entryMode = readStoreModeFromPayload(entry);
        if (entryMode) return entryMode;
      }
    }
    return null;
  }

  function resolveStoreModeFromResponse(res, payload) {
    const headerMode = readStoreModeFromHeadersLike(res && res.headers);
    if (headerMode) return headerMode;
    return readStoreModeFromPayload(payload);
  }
  const BACKEND_STORAGE_MODE_KEY = key + '_backend_store_mode';
  let persistedBackendMode = null;
  function loadPersistedBackendMode() {
    if (!examplesApiBase) return null;
    let stored = null;
    try {
      stored = storageGetItem(BACKEND_STORAGE_MODE_KEY);
    } catch (_) {
      stored = null;
    }
    return normalizeBackendStoreMode(stored);
  }
  function persistBackendMode(mode) {
    if (!examplesApiBase) return;
    const normalized = normalizeBackendStoreMode(mode);
    if (!normalized) {
      persistedBackendMode = null;
      try {
        storageRemoveItem(BACKEND_STORAGE_MODE_KEY);
      } catch (_) {}
      return;
    }
    persistedBackendMode = normalized;
    try {
      storageSetItem(BACKEND_STORAGE_MODE_KEY, normalized);
    } catch (_) {}
  }
  persistedBackendMode = examplesApiBase ? loadPersistedBackendMode() : null;
  let backendAvailable = !examplesApiBase;
  let backendStatusKnown = !examplesApiBase;
  let backendReady = !examplesApiBase;
  let backendMode = !examplesApiBase ? 'disabled' : persistedBackendMode || null;
  let backendSyncDeferred = false;
  let applyingBackendUpdate = false;
  let backendSyncTimer = null;
  let backendSyncPromise = null;
  let backendSyncRequested = false;
  let backendNoticeElement = null;
  let backendNoticeDomReadyHandler = null;
  let backendNoticeMode = null;
  let backendUnavailableReason = null;
  let backendStatusLastMessage = '';
  let backendStatusLastType = '';
  const baseHealthStatus = {
    checked: false,
    ok: false,
    mode: null,
    degraded: false,
    lastCheckedAt: null
  };
  let baseHealthFailureStreak = 0;
  const BASE_HEALTH_FAILURE_THRESHOLD = 3;

  function logBaseHealthEvent(details) {
    try {
      console.log('[ExamplesBaseHealth]', details);
    } catch (_) {}
  }

  function ensureExamplesStatusElement() {
    if (typeof document === 'undefined') return null;
    if (
      ensureExamplesStatusElement.element &&
      ensureExamplesStatusElement.element.isConnected
    ) {
      return ensureExamplesStatusElement.element;
    }
    let el = document.getElementById('examples-status');
    if (!el) {
      el = document.createElement('p');
      el.id = 'examples-status';
      el.className = 'examples-status';
      el.setAttribute('role', 'status');
      el.hidden = true;
      const host = resolveBackendNoticeHost();
      if (host && host.parentNode) {
        host.parentNode.insertBefore(el, host);
      } else if (document.body) {
        document.body.insertBefore(el, document.body.firstChild || null);
      }
    }
    ensureExamplesStatusElement.element = el;
    return el;
  }

  function setBackendStatusMessage(message, type) {
    const normalizedMessage = typeof message === 'string' ? message : '';
    const normalizedType = typeof type === 'string' ? type : '';
    if (
      normalizedMessage === backendStatusLastMessage &&
      normalizedType === backendStatusLastType
    ) {
      return;
    }
    backendStatusLastMessage = normalizedMessage;
    backendStatusLastType = normalizedType;
    const el = ensureExamplesStatusElement();
    if (!el) return;
    el.textContent = normalizedMessage;
    el.hidden = !normalizedMessage;
    if (normalizedType) {
      el.dataset.statusType = normalizedType;
    } else if (el.dataset && Object.prototype.hasOwnProperty.call(el.dataset, 'statusType')) {
      delete el.dataset.statusType;
    }
    el.classList.toggle('examples-status--error', normalizedType === 'error');
    el.classList.toggle('examples-status--warning', normalizedType === 'warning');
  }

  function clearMissingBackendState(fallbackMode) {
    if (backendUnavailableReason === 'missing') {
      backendUnavailableReason = null;
    }
    if (backendMode !== 'missing') return;
    const fallback =
      normalizeBackendStoreMode(fallbackMode) ||
      normalizeBackendStoreMode(baseHealthStatus.mode) ||
      persistedBackendMode ||
      'kv';
    backendMode = fallback;
    if (backendMode && backendMode !== 'offline' && backendMode !== 'disabled') {
      persistBackendMode(backendMode);
    }
  }

  function applyBackendStatusMessage(mode) {
    const normalizedMode =
      mode === 'missing'
        ? 'missing'
        : mode === 'memory'
        ? 'memory'
        : mode === 'kv'
        ? 'kv'
        : mode === 'offline'
        ? 'offline'
        : '';
    if (!normalizedMode) {
      setBackendStatusMessage('', '');
      return;
    }
    if (normalizedMode === 'missing') {
      setBackendStatusMessage(
        'Eksempeltjenesten er ikke tilgjengelig. Fant ikke back-end (/api/examples).',
        'error'
      );
      return;
    }
    if (normalizedMode === 'memory') {
      setBackendStatusMessage(
        'Eksempeltjenesten kjører i minnemodus. Eksempler tilbakestilles ved omstart.',
        'warning'
      );
      return;
    }
    if (normalizedMode === 'kv') {
      setBackendStatusMessage('', '');
      return;
    }
    setBackendStatusMessage(
      'Kunne ikke koble til eksempeltjenesten. Endringer lagres midlertidig.',
      'warning'
    );
  }

  function rememberBaseHealth(ok, mode, options) {
    const opts = options && typeof options === 'object' ? options : {};
    baseHealthStatus.checked = true;
    baseHealthStatus.ok = ok === true;
    baseHealthStatus.degraded = opts.degraded === true;
    baseHealthStatus.lastCheckedAt = Date.now();
    if (mode) {
      const normalized = normalizeBackendStoreMode(mode) || mode;
      baseHealthStatus.mode = normalized;
    }
    if (baseHealthStatus.ok) {
      baseHealthFailureStreak = 0;
    } else if (opts.incrementFailure) {
      baseHealthFailureStreak += 1;
    }
  }

  function resolveKnownStoreMode(candidate) {
    const normalized = normalizeBackendStoreMode(candidate);
    if (normalized) {
      rememberBaseHealth(true, normalized);
      return normalized;
    }
    if (baseHealthStatus.ok && baseHealthStatus.mode) {
      return baseHealthStatus.mode;
    }
    return null;
  }

  function handleMissingBackendResponse(res, payload) {
    const responseMode = resolveStoreModeFromResponse(res, payload);
    const normalizedMode = normalizeBackendStoreMode(responseMode);
    if (res && res.ok && normalizedMode === 'memory') {
      rememberBaseHealth(true, normalizedMode);
      clearMissingBackendState(normalizedMode);
      markBackendAvailable(normalizedMode);
      return;
    }
    const mode = resolveKnownStoreMode(responseMode);
    if (mode) {
      markBackendAvailable(mode);
      return;
    }
    markBackendUnavailable('missing');
  }

  function resolveBackendNoticeHost() {
    if (typeof document === 'undefined') return null;
    const specific = document.querySelector('.card--examples');
    if (specific instanceof HTMLElement) return specific;
    const generic = document.querySelector('.card');
    if (generic instanceof HTMLElement) return generic;
    return document.body || null;
  }

  function hideBackendNotice() {
    if (typeof document !== 'undefined' && backendNoticeDomReadyHandler) {
      try {
        document.removeEventListener('DOMContentLoaded', backendNoticeDomReadyHandler);
      } catch (_) {}
    }
    backendNoticeDomReadyHandler = null;
    const notice = backendNoticeElement;
    if (!notice) return;
    backendNoticeElement = null;
    backendNoticeMode = null;
    try {
      if (typeof notice.remove === 'function') {
        notice.remove();
      } else if (notice.parentElement) {
        notice.parentElement.removeChild(notice);
      }
    } catch (_) {}
  }

  function showBackendNotice(mode) {
    if (typeof document === 'undefined') return;
    const normalizedMode = mode === 'memory' ? 'memory' : mode === 'missing' ? 'missing' : 'offline';
    const render = () => {
      const host = resolveBackendNoticeHost();
      if (!host) return;
      let notice = backendNoticeElement;
      if (!(notice instanceof HTMLElement)) {
        notice = document.createElement('div');
        notice.className = 'example-backend-notice';
        notice.setAttribute('role', 'alert');
        const title = document.createElement('strong');
        title.className = 'example-backend-notice__title';
        title.textContent =
          normalizedMode === 'memory'
            ? 'Midlertidig lagring'
            : normalizedMode === 'missing'
            ? 'Eksempeltjenesten mangler'
            : 'Ingen backend-tilkobling';
        const message = document.createElement('span');
        message.className = 'example-backend-notice__message';
        message.textContent =
          normalizedMode === 'memory'
            ? 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.'
            : normalizedMode === 'missing'
            ? 'Fant ikke eksempeltjenesten (/api/examples). Sjekk at back-end kjører med serverless-funksjoner.'
            : 'Endringer lagres midlertidig og kan gå tapt hvis siden lastes på nytt.';
        notice.appendChild(title);
        notice.appendChild(document.createTextNode(' '));
        notice.appendChild(message);
      } else {
        const title = notice.querySelector('.example-backend-notice__title');
        if (title) {
          title.textContent =
            normalizedMode === 'memory'
              ? 'Midlertidig lagring'
              : normalizedMode === 'missing'
              ? 'Eksempeltjenesten mangler'
              : 'Ingen backend-tilkobling';
        }
        const message = notice.querySelector('.example-backend-notice__message');
        if (message) {
          message.textContent =
            normalizedMode === 'memory'
              ? 'Denne instansen bruker midlertidig minnelagring. Eksempler tilbakestilles når serveren starter på nytt.'
              : normalizedMode === 'missing'
              ? 'Fant ikke eksempeltjenesten (/api/examples). Sjekk at back-end kjører med serverless-funksjoner.'
              : 'Endringer lagres midlertidig og kan gå tapt hvis siden lastes på nytt.';
        }
      }
      notice.hidden = false;
      notice.dataset.noticeMode = normalizedMode;
      if (!notice.isConnected) {
        host.insertBefore(notice, host.firstChild);
      }
      backendNoticeElement = notice;
      backendNoticeMode = normalizedMode;
    };
    if (document.readyState === 'loading') {
      if (backendNoticeDomReadyHandler) {
        document.removeEventListener('DOMContentLoaded', backendNoticeDomReadyHandler);
        backendNoticeDomReadyHandler = null;
      }
      backendNoticeDomReadyHandler = () => {
        backendNoticeDomReadyHandler = null;
        render();
      };
      document.addEventListener('DOMContentLoaded', backendNoticeDomReadyHandler, { once: true });
      return;
    }
    render();
  }

  function updateBackendNotice() {
    if (baseHealthStatus.ok) {
      clearMissingBackendState(backendMode || baseHealthStatus.mode);
      if (!backendAvailable) {
        backendAvailable = true;
      }
      if (backendUnavailableReason === 'missing') {
        backendUnavailableReason = null;
      }
    } else {
      clearMissingBackendState(backendMode || baseHealthStatus.mode);
    }
    if (backendAvailable && backendUnavailableReason) {
      backendUnavailableReason = null;
    }
    if (!examplesApiBase) {
      hideBackendNotice();
      applyBackendStatusMessage('');
      return;
    }
    const normalizedMode =
      normalizeBackendStoreMode(backendMode) ||
      normalizeBackendStoreMode(baseHealthStatus.mode) ||
      backendMode ||
      baseHealthStatus.mode ||
      '';
    if (backendAvailable && normalizedMode && normalizedMode !== 'offline' && normalizedMode !== 'missing') {
      if (normalizedMode === 'memory') {
        if (backendNoticeMode !== 'memory' || !backendNoticeElement) {
          showBackendNotice('memory');
        }
      } else {
        hideBackendNotice();
      }
      applyBackendStatusMessage(normalizedMode);
      return;
    }
    if (!backendAvailable || normalizedMode === 'offline' || normalizedMode === 'missing') {
      const desiredMode =
        normalizedMode === 'missing' || backendUnavailableReason === 'missing' ? 'missing' : 'offline';
      if (backendNoticeMode !== desiredMode || !backendNoticeElement) {
        showBackendNotice(desiredMode);
      }
      applyBackendStatusMessage(desiredMode);
      return;
    }
    hideBackendNotice();
    applyBackendStatusMessage(normalizedMode || '');
  }

  function updateBackendUiState() {
    backendStatusKnown = true;
    try {
      const examples = getExamples();
      const count = Array.isArray(examples) ? examples.length : 0;
      updateActionButtonState(count);
    } catch (_) {
      updateActionButtonState(0);
    }
    updateBackendNotice();
  }

  function markBackendAvailable(mode) {
    backendAvailable = true;
    backendUnavailableReason = null;
    const resolved =
      normalizeBackendStoreMode(mode) || normalizeBackendStoreMode(baseHealthStatus.mode);
    clearMissingBackendState(resolved || backendMode || baseHealthStatus.mode);
    if (resolved) {
      backendMode = resolved;
      persistBackendMode(resolved);
    } else if (backendMode && backendMode !== 'offline' && backendMode !== 'disabled') {
      persistBackendMode(backendMode);
    } else if (persistedBackendMode) {
      backendMode = persistedBackendMode;
    } else {
      backendMode = 'kv';
      persistBackendMode(backendMode);
    }
    rememberBaseHealth(true, backendMode || resolved || null);
    applyBackendStatusMessage(backendMode || '');
    updateBackendUiState();
  }
  function markBackendUnavailable(reason) {
    backendAvailable = false;
    backendUnavailableReason = typeof reason === 'string' ? reason : null;
    backendMode = reason === 'missing' ? 'missing' : 'offline';
    applyBackendStatusMessage(backendMode);
    updateBackendUiState();
  }

  async function checkExamplesBaseHealth() {
    if (!examplesApiBase) return null;
    const fetchOptions = {
      headers: {
        Accept: 'application/json'
      }
    };

    const recordDegraded = (mode, reason, res, parsingError) => {
      const resolvedMode = mode || baseHealthStatus.mode || backendMode || persistedBackendMode || null;
      logBaseHealthEvent({
        status: 'degraded',
        reason: reason || 'unknown',
        statusCode: res && typeof res.status === 'number' ? res.status : null,
        contentType: res ? extractContentType(res.headers) : null,
        parsingError: parsingError ? parsingError.message || String(parsingError) : undefined
      });
      rememberBaseHealth(false, resolvedMode, {
        degraded: true,
        incrementFailure: true
      });
      const shouldMarkUnavailable =
        baseHealthFailureStreak >= BASE_HEALTH_FAILURE_THRESHOLD || (res && res.status === 404);
      if (shouldMarkUnavailable) {
        markBackendUnavailable(res && res.status === 404 ? 'missing' : 'offline');
      } else {
        markBackendAvailable(resolvedMode);
      }
    };

    let res;
    try {
      res = await fetchWithTimeout(examplesApiBase, fetchOptions, BACKEND_FETCH_TIMEOUT_MS);
    } catch (error) {
      recordDegraded(baseHealthStatus.mode, 'network-error');
      return null;
    }

    const looksLikeJson = responseLooksLikeJson(res);
    let payload = null;
    let parsingError = null;
    if (looksLikeJson) {
      try {
        payload = await res.json();
      } catch (error) {
        parsingError = error;
      }
    }

    if (parsingError) {
      recordDegraded(baseHealthStatus.mode, 'parse-error', res, parsingError);
      return { ok: baseHealthStatus.ok, mode: baseHealthStatus.mode, degraded: true };
    }

    const responseMode = resolveStoreModeFromResponse(res, payload);
    const normalizedMode = normalizeBackendStoreMode(responseMode);
    const mode = normalizedMode || resolveKnownStoreMode(responseMode);

    if (res && res.ok && looksLikeJson && payload) {
      const resolvedMode =
        normalizedMode || mode || baseHealthStatus.mode || persistedBackendMode || backendMode || null;
      rememberBaseHealth(true, resolvedMode || baseHealthStatus.mode || normalizedMode, { degraded: false });
      clearMissingBackendState(resolvedMode || baseHealthStatus.mode || normalizedMode);
      markBackendAvailable(resolvedMode || normalizedMode);
      return { ok: baseHealthStatus.ok, mode: baseHealthStatus.mode, degraded: false };
    }

    recordDegraded(mode || baseHealthStatus.mode || normalizedMode, looksLikeJson ? 'bad-status' : 'unexpected-content', res);
    return { ok: baseHealthStatus.ok, mode: baseHealthStatus.mode, degraded: true };
  }
  function schedulePostSyncReload() {
    if (!examplesApiBase) return;
    if (typeof setTimeout !== 'function') return;
    setTimeout(() => {
      try {
        const promise = loadExamplesFromBackend();
        if (promise && typeof promise.then === 'function') {
          promise.catch(() => {});
        }
      } catch (_) {}
    }, 0);
  }
  async function performBackendSync(options) {
    if (!examplesApiBase || applyingBackendUpdate) return null;
    const opts = options && typeof options === 'object' ? options : {};
    const skipStatusUpdate = opts.skipStatusUpdate === true;
    const url = buildExamplesApiUrl(examplesApiBase, storagePath);
    if (!url) return null;
    const examples = Array.isArray(cachedExamples) ? cachedExamples : [];
    const backendExamples = normalizeBackendExamples(examples);
    const deletedSet = getDeletedProvidedExamples();
    const deletedProvidedList = deletedSet ? Array.from(deletedSet).map(normalizeKey).filter(Boolean) : [];
    const hasExamples = backendExamples.length > 0;
    const hasDeleted = deletedProvidedList.length > 0;
    const result = {
      action: null,
      payload: null,
      merged: null
    };
    try {
      const initiatedByDelete = opts.initiatedBy === 'delete';
      if (!hasExamples && !hasDeleted && !initiatedByDelete) {
        const res = await fetch(url, {
          method: 'DELETE'
        });

        // NY FEILHÅNDTERING (DELETE)
        let payload = null;
        const looksLikeJson = responseLooksLikeJson(res);
        if (looksLikeJson || (res && res.ok)) {
          try {
            payload = await res.json();
          } catch (_) {}
        }

        if (!looksLikeJson && (!res || !res.ok)) {
          handleMissingBackendResponse(res);
          const missingError = new Error('Examples backend mangler');
          missingError.backendReason = 'missing';
          throw missingError;
        }

        if (res.ok || res.status === 404) {
          const mode = resolveStoreModeFromResponse(res, payload);
          markBackendAvailable(mode); // Oppdater status!
          clearLegacyExamplesStorageArtifacts();
          const merged = mergeBackendSyncPayload(payload);
          try {
            updateActionButtonState(0);
          } catch (_) {}
          result.action = 'delete';
          result.payload = payload;
          result.merged = merged;
          if (!skipStatusUpdate && pendingUserSaveReason) {
            markUserSaveSuccess(merged || payload);
          }
          return result;
        }
        const error = new Error(`Backend sync failed (${res.status})`);
        throw error;
      }

      let payloadExamples = backendExamples;
      try {
        const serializedExamples = serializeExamplesForStorage(backendExamples);
        if (typeof serializedExamples === 'string') {
          payloadExamples = JSON.parse(serializedExamples);
        }
      } catch (_) {
        payloadExamples = backendExamples;
      }
      const payload = {
        path: storagePath,
        examples: payloadExamples,
        deletedProvided: deletedProvidedList,
        updatedAt: new Date().toISOString()
      };
      const payloadMode = normalizeBackendStoreMode(backendMode) || persistedBackendMode;
      if (payloadMode) {
        payload.storage = payloadMode;
      }
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      // NY FEILHÅNDTERING (PUT)
      let responsePayload = null;
      const looksLikeJson = responseLooksLikeJson(res);
      if (looksLikeJson || (res && res.ok)) {
        try {
          responsePayload = await res.json();
        } catch (_) {}
      }

      if (!looksLikeJson && (!res || !res.ok)) {
        handleMissingBackendResponse(res);
        const missingError = new Error('Examples backend mangler');
        missingError.backendReason = 'missing';
        throw missingError;
      }

      if (!res.ok) {
        const error = new Error(`Backend sync failed (${res.status})`);
        throw error;
      }

      const mode = resolveStoreModeFromResponse(res, responsePayload);
      markBackendAvailable(mode); // Sørg for at memory-mode blir registrert her også!

      clearLegacyExamplesStorageArtifacts();
      const merged = mergeBackendSyncPayload(responsePayload || payload);
      try {
        const finalCount =
          merged && Array.isArray(merged.examples)
            ? merged.examples.length
            : backendExamples.length;
        updateActionButtonState(finalCount);
      } catch (_) {}
      result.action = 'put';
      result.payload = responsePayload;
      result.merged = merged;
      schedulePostSyncReload();
      if (!skipStatusUpdate && pendingUserSaveReason) {
        markUserSaveSuccess((merged && merged.updatedAt) || responsePayload);
      }
      return result;
    } catch (error) {
      backendSyncRequested = true;
      if (!skipStatusUpdate && pendingUserSaveReason) {
        markUserSaveError(error);
      }
      if (!(error && error.backendReason === 'missing')) {
        markBackendUnavailable();
      }
      throw error;
    }
  }
  function flushBackendSync(options) {
    if (backendSyncTimer) {
      clearTimeout(backendSyncTimer);
      backendSyncTimer = null;
    }
    if (!examplesApiBase || applyingBackendUpdate) {
      return backendSyncPromise || null;
    }
    if (!backendSyncRequested) {
      return backendSyncPromise || null;
    }
    if (backendSyncPromise) {
      return backendSyncPromise;
    }
    backendSyncRequested = false;
    backendSyncPromise = performBackendSync(options).finally(() => {
      backendSyncPromise = null;
      if (backendSyncRequested) {
        scheduleBackendSync();
      }
    });
    return backendSyncPromise;
  }
  function shouldSkipBackendSyncForEmptyState() {
    if (localChangesSinceLoad) return false;
    if (pendingUserSaveReason) return false;
    const examples = Array.isArray(cachedExamples) ? cachedExamples : [];
    if (examples.length > 0) return false;
    const storedRaw = typeof lastStoredRawValue === 'string' ? lastStoredRawValue.trim() : '';
    if (storedRaw && storedRaw !== '[]') return false;
    return true;
  }
  function scheduleBackendSync(options) {
    if (!examplesApiBase || applyingBackendUpdate) return;
    const opts = options && typeof options === 'object' ? options : {};
    const force = opts.force === true;
    if (!force && shouldSkipBackendSyncForEmptyState()) {
      backendSyncRequested = false;
      return;
    }
    backendSyncRequested = true;
    if (backendSyncPromise) return;
    if (backendSyncTimer) return;
    backendSyncTimer = setTimeout(() => {
      backendSyncTimer = null;
      flushBackendSync();
    }, 200);
  }
  function notifyBackendChange(options) {
    if (!examplesApiBase || applyingBackendUpdate) return;
    const opts = options && typeof options === 'object' ? options : {};
    const force = opts.force === true;
    scheduleBackendSync({ force });
  }
  async function applyBackendData(data) {
    applyingBackendUpdate = true;
    try {
      const existingExamples = getExamples();
      const preservedTemporaryExamples = collectTemporaryExamplesForPreservation(existingExamples);
      const previousIndex = Number.isInteger(currentExampleIndex) ? currentExampleIndex : null;
      let examples = normalizeBackendExamples(data && data.examples);
      let backendUpdatedAtMs = 0;
      if (data && data.updatedAt != null) {
        if (typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt)) {
          backendUpdatedAtMs = data.updatedAt;
        } else {
          const parsed = Date.parse(data.updatedAt);
          if (Number.isFinite(parsed)) {
            backendUpdatedAtMs = parsed;
          }
        }
      }
      const backendHasTimestamp = backendUpdatedAtMs > 0;
      const backendIsStale = backendHasTimestamp && backendUpdatedAtMs < lastLocalUpdateMs;
      if (!backendIsStale) {
        await store(examples, {
          reason: 'backend-sync'
        });
        let restoreResult = null;
        if (preservedTemporaryExamples.length > 0) {
          try {
            restoreResult = restoreTemporaryExamplesAfterSync(preservedTemporaryExamples);
          } catch (_) {
            restoreResult = null;
          }
        }
        if (initialLoadPerformed) {
          try {
            const refreshed = (restoreResult && Array.isArray(restoreResult.examples))
              ? restoreResult.examples
              : getExamples();
            if (Array.isArray(refreshed) && refreshed.length > 0) {
              let indexToLoad = Number.isInteger(previousIndex) ? previousIndex : 0;
              if (
                restoreResult &&
                restoreResult.indexMap &&
                Number.isInteger(previousIndex) &&
                restoreResult.indexMap.has(previousIndex)
              ) {
                const mapped = restoreResult.indexMap.get(previousIndex);
                if (Number.isInteger(mapped)) {
                  indexToLoad = mapped;
                }
              }
              if (indexToLoad < 0) {
                indexToLoad = 0;
              } else if (indexToLoad >= refreshed.length) {
                indexToLoad = refreshed.length - 1;
              }
              loadExample(indexToLoad);
            } else {
              currentExampleIndex = null;
              updateTabSelection();
              setDescriptionValue('');
              if (currentAppMode === 'task') {
                ensureTaskModeDescriptionRendered();
              }
            }
          } catch (_) {}
        }
        if (backendUpdatedAtMs > lastLocalUpdateMs) {
          lastLocalUpdateMs = backendUpdatedAtMs;
          persistLocalUpdatedAt(lastLocalUpdateMs);
        }
      }
      const deletedProvided = data && Array.isArray(data.deletedProvided) ? data.deletedProvided : [];
      if (!backendIsStale) {
        deletedProvidedExamples = new Set();
        deletedProvided.forEach(value => {
          const key = normalizeKey(value);
          if (key) deletedProvidedExamples.add(key);
        });
        if (deletedProvidedExamples.size > 0) {
          storageSetItem(DELETED_PROVIDED_KEY, JSON.stringify(Array.from(deletedProvidedExamples)));
        } else {
          storageRemoveItem(DELETED_PROVIDED_KEY);
        }
      }
    } catch (error) {
      deletedProvidedExamples = deletedProvidedExamples || new Set();
    } finally {
      applyingBackendUpdate = false;
    }
  }
  async function migrateLegacyBackendEntry(legacyPath, data) {
    if (!examplesApiBase) return;
    if (!legacyPath || legacyPath === storagePath) return;
    const canonicalUrl = buildExamplesApiUrl(examplesApiBase, storagePath);
    const legacyUrl = buildExamplesApiUrl(examplesApiBase, legacyPath);
    if (!canonicalUrl || !legacyUrl) return;
    const examples = normalizeBackendExamples(data && data.examples);
    const deletedRaw = Array.isArray(data && data.deletedProvided) ? data.deletedProvided : [];
    const deletedProvidedList = deletedRaw.map(normalizeKey).filter(Boolean);
    const hasExamples = examples.length > 0;
    const hasDeleted = deletedProvidedList.length > 0;
    let canonicalOk = false;
    try {
      if (!hasExamples && !hasDeleted) {
        const deleteRes = await fetch(canonicalUrl, { method: 'DELETE' });
        canonicalOk = !!deleteRes && (deleteRes.ok || deleteRes.status === 404);
      } else {
        const payload = {
          path: storagePath,
          examples,
          deletedProvided: deletedProvidedList,
          updatedAt: new Date().toISOString()
        };
        const putRes = await fetch(canonicalUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        canonicalOk = !!putRes && putRes.ok;
        if (canonicalOk) {
          clearLegacyExamplesStorageArtifacts();
        }
      }
    } catch (_) {
      canonicalOk = false;
    }
    if (!canonicalOk) return;
    try {
      const res = await fetch(legacyUrl, { method: 'DELETE' });
      if (res && (res.ok || res.status === 404)) {
        return;
      }
    } catch (_) {}
  }
  async function deleteLegacyBackendEntries(paths, skipPath) {
    if (!examplesApiBase) return;
    if (!Array.isArray(paths) || paths.length === 0) return;
    const canonicalSkips = new Set();
    const registerSkip = value => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (!trimmed) return;
      canonicalSkips.add(trimmed);
      if (!trimmed.endsWith('/')) {
        canonicalSkips.add(`${trimmed}/`);
      }
      try {
        const normalized = normalizePathname(trimmed);
        if (normalized) {
          canonicalSkips.add(normalized);
          if (!normalized.endsWith('/')) {
            canonicalSkips.add(`${normalized}/`);
          }
        }
      } catch (_) {}
    };
    const canonicalPath = typeof storagePath === 'string' ? storagePath.trim() : '';
    let normalizedStoragePath = '';
    if (canonicalPath) {
      registerSkip(canonicalPath);
      try {
        normalizedStoragePath = normalizePathname(canonicalPath);
        if (normalizedStoragePath && normalizedStoragePath !== canonicalPath) {
          registerSkip(normalizedStoragePath);
        }
      } catch (_) {
        normalizedStoragePath = '';
      }
    }
    const skipExact = typeof skipPath === 'string' ? skipPath.trim() : '';
    if (skipExact) {
      registerSkip(skipExact);
    }
    const attempted = new Set();
    const buildDeleteVariants = legacyPath => {
      const variants = [];
      const trimmed = typeof legacyPath === 'string' ? legacyPath.trim() : '';
      if (!trimmed) return variants;
      variants.push(trimmed);
      try {
        const normalized = normalizePathname(trimmed, { preserveCase: true });
        if (normalized && normalized !== trimmed) {
          variants.push(normalized);
        }
        const appendIndex = value => {
          if (!value || /\.html?$/i.test(value)) return;
          const base = value.endsWith('/') ? value : `${value}/`;
          variants.push(base + 'index.html');
        };
        appendIndex(trimmed);
        appendIndex(normalized);
      } catch (_) {}
      return variants;
    };
    for (const legacyPath of paths) {
      const candidates = buildDeleteVariants(legacyPath);
      for (const candidate of candidates) {
        if (!candidate) continue;
        const trimmedCandidate = candidate.trim();
        if (!trimmedCandidate) continue;
        if (attempted.has(trimmedCandidate)) continue;
        let normalizedCandidate = '';
        try {
          normalizedCandidate = normalizePathname(trimmedCandidate);
        } catch (_) {
          normalizedCandidate = '';
        }
        if (normalizedCandidate) {
          if (attempted.has(normalizedCandidate)) continue;
          attempted.add(normalizedCandidate);
        }
        attempted.add(trimmedCandidate);
        if (canonicalSkips.has(trimmedCandidate)) continue;
        if (normalizedCandidate && canonicalSkips.has(normalizedCandidate)) continue;
        if (normalizedStoragePath && normalizedCandidate === normalizedStoragePath) continue;
        const deleteTarget = normalizedCandidate || trimmedCandidate;
        if (!deleteTarget || canonicalSkips.has(deleteTarget)) continue;
        const legacyUrl = buildExamplesApiUrl(examplesApiBase, deleteTarget);
        if (!legacyUrl) continue;
        try {
          const res = await fetch(legacyUrl, { method: 'DELETE' });
          if (!res || (!res.ok && res.status !== 404)) {
            continue;
          }
        } catch (_) {}
      }
    }
  }
  async function migrateLegacyExamples() {
    if (!examplesApiBase) return;
    if (typeof window === 'undefined') return;
    if (hasCompletedExamplesMigration()) return;
    if (window.__EXAMPLES_MIGRATION_RUNNING__) {
      return;
    }
    window.__EXAMPLES_MIGRATION_RUNNING__ = true;
    let migrationCompleted = false;
    let shouldClearLocal = false;
    try {
      const canonicalUrl = buildExamplesApiUrl(examplesApiBase, storagePath);
      if (!canonicalUrl) {
        migrationCompleted = true;
        return;
      }
      let rawExamples = null;
      try {
        rawExamples = storageGetItem(key);
      } catch (_) {
        rawExamples = null;
      }
      let rawDeleted = null;
      try {
        rawDeleted = storageGetItem(DELETED_PROVIDED_KEY);
      } catch (_) {
        rawDeleted = null;
      }
      const parsed = parseExamplesFromRaw(rawExamples);
      const examples = parsed.status === 'ok' ? normalizeBackendExamples(parsed.examples) : [];
      const deletedProvidedList = [];
      if (typeof rawDeleted === 'string' && rawDeleted.trim()) {
        try {
          const parsedDeleted = JSON.parse(rawDeleted);
          if (Array.isArray(parsedDeleted)) {
            parsedDeleted.forEach(value => {
              const normalized = normalizeKey(value);
              if (normalized && !deletedProvidedList.includes(normalized)) {
                deletedProvidedList.push(normalized);
              }
            });
          }
        } catch (error) {
          console.warn('Examples migration: failed to parse deleted markers', error);
        }
      }
      const hasLegacyData = examples.length > 0 || deletedProvidedList.length > 0;
      if (!hasLegacyData) {
        migrationCompleted = true;
        return;
      }
      let res;
      try {
        res = await fetch(canonicalUrl, {
          headers: {
            Accept: 'application/json'
          }
        });
      } catch (error) {
        console.warn('Examples migration: failed to inspect backend state', error);
        return;
      }
      let backendEmpty = false;
      if (res && res.status === 404) {
        backendEmpty = true;
      } else if (res && res.ok) {
        try {
          const backendPayload = await res.json();
          const backendExamples = Array.isArray(backendPayload && backendPayload.examples)
            ? backendPayload.examples
            : [];
          const backendDeleted = Array.isArray(backendPayload && backendPayload.deletedProvided)
            ? backendPayload.deletedProvided
            : [];
          backendEmpty = backendExamples.length === 0 && backendDeleted.length === 0;
        } catch (error) {
          console.warn('Examples migration: failed to parse backend payload', error);
          return;
        }
        if (!backendEmpty) {
          shouldClearLocal = true;
          migrationCompleted = true;
          return;
        }
      } else {
        console.warn('Examples migration: unexpected backend response', res && res.status);
        return;
      }
      if (!backendEmpty) {
        migrationCompleted = true;
        return;
      }
      const payload = {
        path: storagePath,
        examples,
        deletedProvided: deletedProvidedList,
        updatedAt: new Date().toISOString()
      };
      let postRes;
      try {
        postRes = await fetch(examplesApiBase, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        console.warn('Examples migration: failed to migrate legacy examples', error);
        return;
      }
      if (!postRes || !postRes.ok) {
        console.warn('Examples migration: backend rejected legacy examples', postRes && postRes.status);
        return;
      }
      shouldClearLocal = true;
      migrationCompleted = true;
    } finally {
      if (shouldClearLocal) {
        clearLegacyExamplesStorageArtifacts();
      }
      if (migrationCompleted) {
        markExamplesMigrationComplete();
      }
      delete window.__EXAMPLES_MIGRATION_RUNNING__;
    }
  }
  async function loadExamplesFromBackend() {
    if (!examplesApiBase) return null;
    const canonicalUrl = buildExamplesApiUrl(examplesApiBase, storagePath);
    if (!canonicalUrl) {
      backendReady = true;
      if (backendSyncDeferred) {
        backendSyncDeferred = false;
      }
      return null;
    }
    let backendWasEmpty = false;
    try {
      const fetchOptions = {
        headers: {
          Accept: 'application/json'
        }
      };
      const legacyPaths = [];
      const seenLegacyPaths = new Set();
      for (const legacyKey of legacyKeys) {
        const candidatePath = storageKeyToPath(legacyKey);
        if (!candidatePath || candidatePath === storagePath) continue;
        if (seenLegacyPaths.has(candidatePath)) continue;
        seenLegacyPaths.add(candidatePath);
        legacyPaths.push(candidatePath);
      }
      let res;
      try {
        res = await fetchWithTimeout(canonicalUrl, fetchOptions, BACKEND_FETCH_TIMEOUT_MS);
      } catch (error) {
        markBackendUnavailable();
        return null;
      }
      let legacyPathUsed = null;
      if (res && res.status === 404 && legacyPaths.length > 0) {
        for (const legacyPath of legacyPaths) {
          const legacyUrl = buildExamplesApiUrl(examplesApiBase, legacyPath);
          if (!legacyUrl) continue;
          let legacyRes;
          try {
            legacyRes = await fetchWithTimeout(legacyUrl, fetchOptions, BACKEND_FETCH_TIMEOUT_MS);
          } catch (error) {
            markBackendUnavailable();
            return null;
          }
          if (legacyRes && legacyRes.status === 404) {
            continue;
          }
          if (legacyRes && !legacyRes.ok && legacyRes.status !== 404) {
            markBackendUnavailable();
            return null;
          }
          res = legacyRes;
          legacyPathUsed = legacyPath;
          break;
        }
        if (!legacyPathUsed && (!res || res.status === 404)) {
          const mode = resolveStoreModeFromResponse(res);
          markBackendAvailable(mode);
          backendWasEmpty = true;
          try {
            updateActionButtonState(0);
          } catch (_) {}
          return {
            path: storagePath,
            examples: [],
            deletedProvided: []
          };
        }
      } else if (res && res.status === 404) {
        const mode = resolveStoreModeFromResponse(res);
        markBackendAvailable(mode);
        backendWasEmpty = true;
        try {
          updateActionButtonState(0);
        } catch (_) {}
        return {
          path: storagePath,
          examples: [],
          deletedProvided: []
        };
      }
      let backendData = null;
      const looksLikeJson = responseLooksLikeJson(res);
      if (looksLikeJson || (res && res.ok)) {
        try {
          backendData = await res.json();
        } catch (_) {
          backendData = null;
        }
      }
      const responseMode = resolveStoreModeFromResponse(res, backendData);
      const normalizedMode = normalizeBackendStoreMode(responseMode);
      if (res && res.ok) {
        markBackendAvailable(normalizedMode || responseMode);
      } else if (res && !res.ok && res.status !== 404) {
        handleMissingBackendResponse(res, backendData);
        return null;
      } else if (!res) {
        markBackendUnavailable();
        return null;
      }
      if (res && res.status === 404) {
        markBackendAvailable(normalizedMode || responseMode);
        backendWasEmpty = true;
        try {
          updateActionButtonState(0);
        } catch (_) {}
        return {
          path: storagePath,
          examples: [],
          deletedProvided: []
        };
      }
      const normalized = backendData && typeof backendData === 'object' ? { ...backendData } : {};
      const resolvedMode =
        normalizedMode ||
        normalizeBackendStoreMode(normalized.storage || normalized.mode || normalized.storageMode || normalized.storeMode);
      if (resolvedMode) {
        normalized.storage = resolvedMode;
      } else if (Object.prototype.hasOwnProperty.call(normalized, 'storage')) {
        delete normalized.storage;
      }
      normalized.path = storagePath;
      const backendExamples = Array.isArray(normalized.examples) ? normalized.examples : [];
      const backendDeleted = Array.isArray(normalized.deletedProvided) ? normalized.deletedProvided : [];
      backendWasEmpty = backendExamples.length === 0 && backendDeleted.length === 0;
      try {
        updateActionButtonState(backendExamples.length);
      } catch (_) {}
      await applyBackendData(normalized);
      renderOptions();
      if (legacyPathUsed) {
        try {
          await migrateLegacyBackendEntry(legacyPathUsed, normalized);
        } catch (_) {}
      }
      const cleanupTargets = legacyPaths.filter(
        path => path && path !== storagePath && path !== legacyPathUsed
      );
      if (cleanupTargets.length > 0) {
        try {
          await deleteLegacyBackendEntries(cleanupTargets, legacyPathUsed);
        } catch (_) {}
      }
      return normalized;
    } finally {
      backendReady = true;
      if (backendSyncDeferred) {
        if (backendWasEmpty) {
          backendSyncDeferred = false;
          scheduleBackendSync();
        } else if (backendAvailable) {
          backendSyncDeferred = false;
          scheduleBackendSync();
        }
      }
    }
  }
  let initialLoadPerformed = false;
  let currentExampleIndex = null;
  let tabsContainer = null;
  let tabButtons = [];
  let tabWrappers = [];
  let activeDeleteTabIndex = null;
  let deleteRevealTimer = null;
  let suppressNextTabClick = false;
  let deleteDismissListenerAttached = false;
  let loadingOverlayElement = null;
  let loadingOverlayVisible = false;
  let loadingOverlayHideTimer = null;
  let loadingOverlayLastShownAt = 0;

  const DESCRIPTION_FALLBACK_FIELDS = [
    'descriptionHtml',
    'descriptionHTML',
    'description_html',
    'descriptionRich',
    'description_rich',
    'descriptionRichText',
    'description_rich_text',
    'richDescription',
    'taskDescription',
    'task_description',
    'taskText',
    'task_text',
    'task',
    'oppgave',
    'oppgavetekst',
    'oppgaveTekst'
  ];

  function normalizeDescriptionString(value) {
    if (typeof value !== 'string') return '';
    const normalized = value
      .replace(/\r\n?/g, '\n')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n');
    return normalized.trim();
  }

  function convertHtmlToPlainText(html) {
    if (typeof html !== 'string') return '';
    const trimmed = html.trim();
    if (!trimmed) return '';
    const sanitized = trimmed
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
    const replaced = sanitized
      .replace(/<\s*br\s*\/?>/gi, '\n')
      .replace(/<\s*li\b[^>]*>/gi, '\n- ')
      .replace(/<\/(?:p|div|section|article|li|tr|thead|tbody|tfoot|table|h[1-6])\s*>/gi, '\n');
    if (typeof document !== 'undefined') {
      const container = document.createElement('div');
      container.innerHTML = replaced;
      return normalizeDescriptionString(container.textContent || '');
    }
    const stripped = replaced.replace(/<[^>]+>/g, '');
    return normalizeDescriptionString(stripped);
  }

  function extractDescriptionFromExample(example) {
    if (!example || typeof example !== 'object') return '';
    if (typeof example.description === 'string' && example.description.trim()) {
      return normalizeDescriptionString(example.description);
    }
    for (const key of DESCRIPTION_FALLBACK_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(example, key)) continue;
      const value = example[key];
      if (typeof value !== 'string') continue;
      if (!value.trim()) continue;
      const processed = /html|rich/i.test(key) ? convertHtmlToPlainText(value) : normalizeDescriptionString(value);
      if (processed) return processed;
    }
    if (typeof example.description === 'string') {
      return normalizeDescriptionString(example.description);
    }
    return '';
  }

  function normalizeExampleId(value) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value));
    }
    return null;
  }

  function resolveExampleId(example, index) {
    if (example && typeof example === 'object') {
      const candidateKeys = ['exampleId', 'exampleID', 'exampleNumber', 'id'];
      for (const key of candidateKeys) {
        if (!Object.prototype.hasOwnProperty.call(example, key)) continue;
        const normalized = normalizeExampleId(example[key]);
        if (normalized) return normalized;
      }
    }
    if (Number.isInteger(index)) {
      return String(index + 1);
    }
    return null;
  }

  const MAX_SVG_STORAGE_BYTES = 120000;
  const MAX_THUMBNAIL_STORAGE_BYTES = 24000;
  const MAX_THUMBNAIL_DIMENSION = 256;
  function computeByteLength(str) {
    if (typeof str !== 'string') return 0;
    if (typeof TextEncoder === 'function') {
      try {
        return new TextEncoder().encode(str).length;
      } catch (_) {}
    }
    return str.length;
  }
  function sanitizeSvgForStorage(svg) {
    if (typeof svg !== 'string') return '';
    const trimmed = svg.trim();
    if (!trimmed) return '';
    if (computeByteLength(trimmed) <= MAX_SVG_STORAGE_BYTES) {
      return trimmed;
    }
    const normalized = trimmed.replace(/\s{2,}/g, ' ');
    if (computeByteLength(normalized) <= MAX_SVG_STORAGE_BYTES) {
      return normalized;
    }
    return '';
  }
  function normalizeExamplesForStorage(examples) {
    const list = Array.isArray(examples) ? examples : [];
    return list.map(example => {
      const copy = cloneValue(example);
      if (!copy || typeof copy !== 'object') {
        return {};
      }
      const version = typeof copy.v === 'number' ? copy.v : null;
      if (Number.isFinite(version) && version >= 1) {
        return copy;
      }
      const description = extractDescriptionFromExample(copy);
      if (typeof description === 'string') {
        copy.description = description;
      }
      if (copy.description == null) {
        copy.description = '';
      } else if (typeof copy.description === 'string') {
        copy.description = normalizeDescriptionString(copy.description);
      }
      if (copy.svg != null) {
        copy.svg = sanitizeSvgForStorage(copy.svg);
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_FLAG)) {
        delete copy[TEMPORARY_EXAMPLE_FLAG];
      }
      if (Object.prototype.hasOwnProperty.call(copy, 'temporary')) {
        delete copy.temporary;
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_REQUEST_ID)) {
        delete copy[TEMPORARY_EXAMPLE_REQUEST_ID];
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_SOURCE_PATH)) {
        delete copy[TEMPORARY_EXAMPLE_SOURCE_PATH];
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_CREATED_AT)) {
        delete copy[TEMPORARY_EXAMPLE_CREATED_AT];
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_NOTICE_PENDING)) {
        delete copy[TEMPORARY_EXAMPLE_NOTICE_PENDING];
      }
      if (Object.prototype.hasOwnProperty.call(copy, TEMPORARY_EXAMPLE_NOTICE_SHOWN)) {
        delete copy[TEMPORARY_EXAMPLE_NOTICE_SHOWN];
      }
      DESCRIPTION_FALLBACK_FIELDS.forEach(field => {
        if (field !== 'description' && Object.prototype.hasOwnProperty.call(copy, field)) {
          delete copy[field];
        }
      });
      return copy;
    });
  }

  const EXAMPLE_VALUE_TYPE_KEY = '__mathVisualsType__';
  const EXAMPLE_VALUE_DATA_KEY = '__mathVisualsValue__';

  function serializeExampleValue(value, seen) {
    if (value == null) return value;
    const valueType = typeof value;
    if (valueType === 'function' || valueType === 'symbol') return undefined;
    if (valueType === 'bigint') return value.toString();
    if (valueType !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Map]') {
      const entries = [];
      const marker = {
        [EXAMPLE_VALUE_TYPE_KEY]: 'map',
        [EXAMPLE_VALUE_DATA_KEY]: entries
      };
      seen.set(value, marker);
      value.forEach((entryValue, entryKey) => {
        entries.push([
          serializeExampleValue(entryKey, seen),
          serializeExampleValue(entryValue, seen)
        ]);
      });
      return marker;
    }
    if (tag === '[object Set]') {
      const items = [];
      const marker = {
        [EXAMPLE_VALUE_TYPE_KEY]: 'set',
        [EXAMPLE_VALUE_DATA_KEY]: items
      };
      seen.set(value, marker);
      value.forEach(entryValue => {
        items.push(serializeExampleValue(entryValue, seen));
      });
      return marker;
    }
    if (tag === '[object Date]') {
      return {
        [EXAMPLE_VALUE_TYPE_KEY]: 'date',
        [EXAMPLE_VALUE_DATA_KEY]: value.toISOString()
      };
    }
    if (tag === '[object RegExp]') {
      return {
        [EXAMPLE_VALUE_TYPE_KEY]: 'regexp',
        pattern: value.source,
        flags: value.flags || ''
      };
    }
    if (Array.isArray(value)) {
      const arr = [];
      seen.set(value, arr);
      for (let i = 0; i < value.length; i++) {
        arr[i] = serializeExampleValue(value[i], seen);
      }
      return arr;
    }
    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, EXAMPLE_VALUE_TYPE_KEY)) {
      const clone = {};
      seen.set(value, clone);
      Object.keys(value).forEach(key => {
        const encoded = serializeExampleValue(value[key], seen);
        if (encoded !== undefined) {
          clone[key] = encoded;
        }
      });
      return clone;
    }
    const obj = {};
    seen.set(value, obj);
    Object.keys(value).forEach(key => {
      const encoded = serializeExampleValue(value[key], seen);
      if (encoded !== undefined) {
        obj[key] = encoded;
      }
    });
    return obj;
  }

  function deserializeExampleValue(value, seen) {
    if (value == null || typeof value !== 'object') {
      return value;
    }
    if (seen.has(value)) {
      return seen.get(value);
    }
    if (Array.isArray(value)) {
      const arr = [];
      seen.set(value, arr);
      for (let i = 0; i < value.length; i++) {
        arr[i] = deserializeExampleValue(value[i], seen);
      }
      return arr;
    }
    const type = value[EXAMPLE_VALUE_TYPE_KEY];
    if (type === 'map') {
      const result = new Map();
      seen.set(value, result);
      const entries = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
      entries.forEach(entry => {
        if (!Array.isArray(entry) || entry.length < 2) return;
        const key = deserializeExampleValue(entry[0], seen);
        const entryValue = deserializeExampleValue(entry[1], seen);
        try {
          result.set(key, entryValue);
        } catch (_) {}
      });
      return result;
    }
    if (type === 'set') {
      const result = new Set();
      seen.set(value, result);
      const items = Array.isArray(value[EXAMPLE_VALUE_DATA_KEY]) ? value[EXAMPLE_VALUE_DATA_KEY] : [];
      items.forEach(item => {
        result.add(deserializeExampleValue(item, seen));
      });
      return result;
    }
    if (type === 'date') {
      const isoValue = value[EXAMPLE_VALUE_DATA_KEY];
      const date = typeof isoValue === 'string' ? new Date(isoValue) : new Date(NaN);
      return date;
    }
    if (type === 'regexp') {
      const pattern = typeof value.pattern === 'string' ? value.pattern : '';
      const flags = typeof value.flags === 'string' ? value.flags : '';
      try {
        return new RegExp(pattern, flags);
      } catch (_) {
        try {
          return new RegExp(pattern);
        } catch (_) {
          return new RegExp('');
        }
      }
    }
    const obj = {};
    seen.set(value, obj);
    Object.keys(value).forEach(key => {
      obj[key] = deserializeExampleValue(value[key], seen);
    });
    return obj;
  }

  function serializeExamplesForStorage(examples) {
    const seen = new WeakMap();
    return JSON.stringify(examples, (_, value) => serializeExampleValue(value, seen));
  }

  function deserializeExamplesFromRaw(raw) {
    try {
      const parsed = JSON.parse(raw);
      return deserializeExampleValue(parsed, new WeakMap());
    } catch (error) {
      throw error;
    }
  }

  function renderDescriptionPreviewFromValue(value, options) {
    const taskText = getTaskTextModule();
    if (!taskText || typeof taskText.renderDescriptionPreviewFromValue !== 'function') return null;
    return taskText.renderDescriptionPreviewFromValue(value, options);
  }

  function getDescriptionPreviewElement() {
    const taskText = getTaskTextModule();
    if (!taskText || typeof taskText.getDescriptionPreviewElement !== 'function') return null;
    return taskText.getDescriptionPreviewElement();
  }

  function getDescriptionInput() {
    const taskText = getTaskTextModule();
    if (!taskText || typeof taskText.getDescriptionInput !== 'function') return null;
    return taskText.getDescriptionInput();
  }

  function updateDescriptionEditVisibilityForMode(mode) {
    const taskText = getTaskTextModule();
    if (!taskText || typeof taskText.updateDescriptionEditVisibilityForMode !== 'function') return null;
    return taskText.updateDescriptionEditVisibilityForMode(mode);
  }

  function startTaskModeDescriptionEdit(options) {
    const taskText = getTaskTextModule();
    if (!taskText || typeof taskText.startEditing !== 'function') return null;
    return taskText.startEditing(options);
  }

  function stopTaskModeDescriptionEdit() {
    const taskText = getTaskTextModule();
    if (!taskText || typeof taskText.stopEditing !== 'function') return null;
    return taskText.stopEditing();
  }

  function ensureTaskModeDescriptionRendered() {
    const taskText = getTaskTextModule();
    if (!taskText || typeof taskText.ensureTaskModeDescriptionRendered !== 'function') return null;
    return taskText.ensureTaskModeDescriptionRendered();
  }

  function getDescriptionValue() {
    const taskText = getTaskTextModule();
    if (!taskText || typeof taskText.getTaskText !== 'function') return '';
    return taskText.getTaskText();
  }

  function getDescriptionValueForPersistence() {
    if (currentAppMode !== 'task') {
      return getDescriptionValue();
    }
    const examples = getExamples();
    const index = getActiveExampleIndex(examples);
    if (index == null) return '';
    const example = examples[index];
    return extractDescriptionFromExample(example);
  }

  function setDescriptionValue(value) {
    const taskText = getTaskTextModule();
    if (!taskText || typeof taskText.setTaskText !== 'function') return;
    taskText.setTaskText(value);
  }
  let tabsHostCard = null;
  let toolbarElement = null;
  const hasUrlOverrides = (() => {
    if (typeof URLSearchParams === 'undefined') return false;
    const currentLocation =
      typeof window !== 'undefined' && window && window.location ? window.location : null;
    const searchValue = currentLocation && typeof currentLocation.search === 'string' ? currentLocation.search : '';
    if (!searchValue) {
      return false;
    }
    const search = new URLSearchParams(searchValue);
    for (const key of search.keys()) {
      if (key === 'example') continue;
      if (/^fun\d+$/i.test(key) || /^dom\d+$/i.test(key)) return true;
      switch (key) {
        case 'coords':
        case 'points':
        case 'startx':
        case 'screen':
        case 'xName':
        case 'yName':
        case 'pan':
        case 'q1':
        case 'lock':
          return true;
        default:
          break;
      }
    }
    return false;
  })();
  if (hasUrlOverrides) {
    initialLoadPerformed = true;
  }
  let cachedExamples = [];
  let cachedExamplesInitialized = false;
  let pendingArchiveExampleNotice = null;
  let lastLocalUpdateMs = loadPersistedUpdatedAt();
  let saveStatusElement = null;
  let saveStatusTextElement = null;
  let pendingUserSaveReason = null;
  let lastSuccessfulSaveIso = null;
  let localChangesSinceLoad = false;
  function hydrateCachedExamples() {
    if (cachedExamplesInitialized) return;
    cachedExamplesInitialized = true;
    const rawValue = typeof lastStoredRawValue === 'string' ? lastStoredRawValue.trim() : '';
    if (rawValue) {
      try {
        const parsed = parseExamplesFromRaw(rawValue);
        if (parsed && parsed.status === 'ok' && Array.isArray(parsed.examples)) {
          cachedExamples = parsed.examples.slice();
          return;
        }
        if (parsed && parsed.status !== 'ok') {
          try {
            if (attemptHistoryRecovery(rawValue)) {
              return;
            }
          } catch (_) {}
        }
      } catch (_) {}
    }
    if (Array.isArray(cachedExamples)) {
      cachedExamples = cachedExamples.slice();
    } else {
      cachedExamples = [];
    }
  }
  function getExamples() {
    if (!cachedExamplesInitialized) {
      hydrateCachedExamples();
    }
    return cachedExamples;
  }
  function createTemporaryExample(example, options) {
    const examples = getExamples();
    const opts = options && typeof options === 'object' ? options : {};
    const skipNotice = opts.skipNotice === true;
    if (!example || typeof example !== 'object') return null;
    const sanitizedList = normalizeExamplesForStorage([example]);
    const sanitized = Array.isArray(sanitizedList) && sanitizedList.length > 0 ? sanitizedList[0] : null;
    const normalized = sanitized && typeof sanitized === 'object' ? { ...sanitized } : null;
    if (!normalized) return null;
    if (!normalized.config || typeof normalized.config !== 'object') {
      normalized.config = {};
    }
    const requestIdRaw = opts.requestId != null ? opts.requestId : normalized.id || null;
    const requestId = requestIdRaw != null ? String(requestIdRaw) : null;
    normalized[TEMPORARY_EXAMPLE_FLAG] = true;
    normalized.temporary = true;
    if (skipNotice) {
      if (Object.prototype.hasOwnProperty.call(normalized, TEMPORARY_EXAMPLE_NOTICE_PENDING)) {
        delete normalized[TEMPORARY_EXAMPLE_NOTICE_PENDING];
      }
      if (Object.prototype.hasOwnProperty.call(normalized, TEMPORARY_EXAMPLE_NOTICE_SHOWN)) {
        delete normalized[TEMPORARY_EXAMPLE_NOTICE_SHOWN];
      }
    } else {
      normalized[TEMPORARY_EXAMPLE_NOTICE_PENDING] = true;
      if (Object.prototype.hasOwnProperty.call(normalized, TEMPORARY_EXAMPLE_NOTICE_SHOWN)) {
        delete normalized[TEMPORARY_EXAMPLE_NOTICE_SHOWN];
      }
    }
    if (requestId) {
      normalized[TEMPORARY_EXAMPLE_REQUEST_ID] = requestId;
    }
    if (opts.sourcePath) {
      normalized[TEMPORARY_EXAMPLE_SOURCE_PATH] = String(opts.sourcePath);
    }
    if (Object.prototype.hasOwnProperty.call(opts, 'createdAt') && opts.createdAt != null) {
      normalized[TEMPORARY_EXAMPLE_CREATED_AT] = opts.createdAt;
    } else if (!Object.prototype.hasOwnProperty.call(normalized, TEMPORARY_EXAMPLE_CREATED_AT)) {
      try {
        normalized[TEMPORARY_EXAMPLE_CREATED_AT] = new Date().toISOString();
      } catch (_) {}
    }
    let targetIndex = Number.isInteger(opts.index) ? Math.max(0, Math.min(examples.length, opts.index)) : examples.length;
    if (requestId) {
      const existingIndex = examples.findIndex(item => item && item[TEMPORARY_EXAMPLE_REQUEST_ID] === requestId);
      if (existingIndex >= 0) {
        examples.splice(existingIndex, 1, normalized);
        return { index: existingIndex, example: normalized };
      }
    }
    examples.splice(targetIndex, 0, normalized);
    return { index: targetIndex, example: normalized };
  }
  function readArchiveOpenRequest() {
    let raw = null;
    try {
      raw = storageGetItem(OPEN_REQUEST_STORAGE_KEY);
    } catch (_) {
      raw = null;
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          const metadata = attachArchiveOpenRequestTransportMetadata(parsed, {
            type: 'storage',
            storageKey: OPEN_REQUEST_STORAGE_KEY
          });
          recordArchiveOpenRequestTransport(metadata);
          return parsed;
        }
      } catch (error) {}
    }
    const windowNameResult = readWindowNameArchiveOpenRequest();
    if (windowNameResult && windowNameResult.request) {
      const metadata =
        windowNameResult.metadata || getArchiveOpenRequestTransportMetadata(windowNameResult.request) || null;
      recordArchiveOpenRequestTransport(metadata);
      return windowNameResult.request;
    }
    recordArchiveOpenRequestTransport(null);
    return null;
  }
  function writeArchiveOpenRequest(payload) {
    if (!payload || typeof payload !== 'object') {
      try {
        storageRemoveItem(OPEN_REQUEST_STORAGE_KEY);
      } catch (_) {}
      recordArchiveOpenRequestTransport(null);
      return;
    }
    persistArchiveOpenRequestData(payload);
  }
  function prepareArchiveOpenRequest(rawRequest, options) {
    const request = rawRequest && typeof rawRequest === 'object' ? { ...rawRequest } : {};
    const opts = options && typeof options === 'object' ? options : {};
    const parseExample = value => {
      if (!value) return null;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
          return JSON.parse(trimmed);
        } catch (_) {
          return null;
        }
      }
      if (typeof value === 'object') {
        return value;
      }
      return null;
    };
    let exampleState =
      parseExample(opts.exampleState) ||
      parseExample(opts.example) ||
      parseExample(request.exampleState) ||
      parseExample(request.example) ||
      parseExample(request.exampleData) ||
      parseExample(request.payload);
    if (exampleState) {
      const normalizedList = normalizeExamplesForStorage([exampleState]);
      const normalizedExample = Array.isArray(normalizedList) && normalizedList.length > 0 ? normalizedList[0] : null;
      if (normalizedExample) {
        request.exampleState = normalizedExample;
        request.example = normalizedExample;
        request.exampleData = normalizedExample;
        request.payload = normalizedExample;
      }
    }
    const pathCandidates = [
      opts.canonicalPath,
      opts.targetPath,
      opts.path,
      request.canonicalPath,
      request.storagePath,
      request.path,
      request.target,
      request.href,
      request.targetUrl
    ];
    for (const candidate of pathCandidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      try {
        const normalized = normalizePathname(trimmed);
        if (normalized) {
          request.canonicalPath = normalized;
          if (!request.path) {
            request.path = normalized;
          }
          if (!request.storagePath) {
            request.storagePath = normalized;
          }
          break;
        }
      } catch (_) {}
    }
    if (!request.canonicalPath) {
      try {
        const normalizedStorage = normalizePathname(storagePath);
        if (normalizedStorage) {
          request.canonicalPath = normalizedStorage;
          if (!request.path) {
            request.path = normalizedStorage;
          }
          if (!request.storagePath) {
            request.storagePath = normalizedStorage;
          }
        }
      } catch (_) {}
    }
    const persistence = persistArchiveOpenRequestData(request);
    if (!persistence.metadata) {
      return null;
    }
    return request;
  }
  function clearArchiveOpenRequest() {
    try {
      storageRemoveItem(OPEN_REQUEST_STORAGE_KEY);
    } catch (_) {}
    const metadata = lastArchiveOpenRequestTransport;
    recordArchiveOpenRequestTransport(null);
    if (typeof window === 'undefined') {
      return;
    }
    let windowName = '';
    try {
      windowName = typeof window.name === 'string' ? window.name : '';
    } catch (error) {
      windowName = '';
    }
    if (!windowName) {
      return;
    }
    const prefixes = [];
    if (metadata && typeof metadata.prefix === 'string' && metadata.prefix) {
      prefixes.push(metadata.prefix);
    }
    prefixes.push(OPEN_REQUEST_WINDOW_NAME_PREFIX);
    for (let i = 0; i < prefixes.length; i += 1) {
      const prefix = prefixes[i];
      if (typeof prefix !== 'string' || !prefix) continue;
      if (!windowName.startsWith(prefix)) continue;
      try {
        window.name = '';
      } catch (_) {}
      break;
    }
  }
  const USER_INITIATED_REASONS = new Set(['manual-save', 'manual-update', 'delete', 'history']);
  function isUserInitiatedReason(reason) {
    return typeof reason === 'string' && USER_INITIATED_REASONS.has(reason);
  }
  function ensureSaveStatusElement() {
    if (typeof document === 'undefined') return null;
    if (saveStatusElement && saveStatusElement.isConnected) {
      if (toolbarElement && saveStatusElement.parentElement !== toolbarElement) {
        try {
          toolbarElement.appendChild(saveStatusElement);
        } catch (_) {}
      }
      return saveStatusElement;
    }
    const host = toolbarElement || document.querySelector('.toolbar') || document.body;
    if (!host || typeof host.appendChild !== 'function') {
      return null;
    }
    const status = document.createElement('div');
    status.className = 'example-save-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;
    status.dataset.status = 'idle';
    const spinner = document.createElement('span');
    spinner.className = 'example-save-status__spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.className = 'example-save-status__text';
    status.appendChild(spinner);
    status.appendChild(text);
    try {
      host.appendChild(status);
    } catch (error) {
      if (host !== document.body || !document.body) {
        return null;
      }
      document.body.appendChild(status);
    }
    saveStatusElement = status;
    saveStatusTextElement = text;
    return saveStatusElement;
  }
  function formatSaveStatusTime(value) {
    let date = null;
    if (value instanceof Date) {
      date = Number.isFinite(value.getTime()) ? value : null;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      date = new Date(value);
    } else if (typeof value === 'string' && value) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        date = new Date(parsed);
      }
    }
    if (!date) return null;
    try {
      return date.toLocaleTimeString('nb-NO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }
  function normalizeUpdatedAtIso(details) {
    if (!details) return null;
    if (typeof details === 'string' && details) {
      const parsed = Date.parse(details);
      if (Number.isFinite(parsed)) {
        return new Date(parsed).toISOString();
      }
      return details;
    }
    if (typeof details === 'number' && Number.isFinite(details)) {
      return new Date(details).toISOString();
    }
    if (typeof details === 'object') {
      if (typeof details.updatedAt === 'string' && details.updatedAt) {
        const parsed = Date.parse(details.updatedAt);
        if (Number.isFinite(parsed)) {
          return new Date(parsed).toISOString();
        }
        return details.updatedAt;
      }
      if (typeof details.updatedAt === 'number' && Number.isFinite(details.updatedAt)) {
        return new Date(details.updatedAt).toISOString();
      }
      if (typeof details.updatedAtMs === 'number' && Number.isFinite(details.updatedAtMs)) {
        return new Date(details.updatedAtMs).toISOString();
      }
    }
    return null;
  }
  function setSaveStatusState(state, details = {}) {
    if (typeof document === 'undefined') return;
    const host = ensureSaveStatusElement();
    if (!host) return;
    const normalizedState = typeof state === 'string' && state ? state : 'idle';
    host.dataset.status = normalizedState;
    host.hidden = normalizedState === 'idle';
    if (!saveStatusTextElement) return;
    let message = '';
    if (normalizedState === 'saving') {
      message = typeof details.message === 'string' && details.message ? details.message : 'Lagrer …';
      if (host.dataset.updatedAt) {
        delete host.dataset.updatedAt;
      }
    } else if (normalizedState === 'pending-sync') {
      message =
        typeof details.message === 'string' && details.message
          ? details.message
          : 'Lagret lokalt – venter på server…';
      if (host.dataset.updatedAt) {
        delete host.dataset.updatedAt;
      }
    } else if (normalizedState === 'success') {
      const iso = normalizeUpdatedAtIso(details) || lastSuccessfulSaveIso || new Date().toISOString();
      const timeText = formatSaveStatusTime(iso) || formatSaveStatusTime(Date.now());
      message =
        typeof details.message === 'string' && details.message
          ? details.message
          : timeText
          ? `Sist lagret kl. ${timeText}`
          : 'Sist lagret.';
      host.dataset.updatedAt = iso;
    } else if (normalizedState === 'error') {
      message = typeof details.message === 'string' && details.message ? details.message : 'Kunne ikke lagre endringer.';
      if (host.dataset.updatedAt) {
        delete host.dataset.updatedAt;
      }
    } else {
      message = typeof details.message === 'string' ? details.message : '';
      if (host.dataset.updatedAt) {
        delete host.dataset.updatedAt;
      }
    }
    saveStatusTextElement.textContent = message;
  }
  function beginUserSaveStatus(reason) {
    if (typeof reason === 'string' && reason) {
      pendingUserSaveReason = reason;
    } else {
      pendingUserSaveReason = 'user-action';
    }
    setSaveStatusState('saving');
  }
  function markUserSaveDeferred() {
    if (!pendingUserSaveReason) {
      pendingUserSaveReason = 'user-action';
    }
    setSaveStatusState('pending-sync');
  }
  function markUserSaveSuccess(details) {
    const iso = normalizeUpdatedAtIso(details) || lastSuccessfulSaveIso || new Date().toISOString();
    lastSuccessfulSaveIso = iso;
    pendingUserSaveReason = null;
    setSaveStatusState('success', { updatedAt: iso });
  }
  function markUserSaveError(error) {
    pendingUserSaveReason = null;
    let message = 'Kunne ikke lagre endringer.';
    if (error && typeof error === 'object') {
      if (typeof error.userMessage === 'string' && error.userMessage.trim()) {
        message = error.userMessage.trim();
      } else if (typeof error.message === 'string' && error.message.trim()) {
        message = error.message.trim();
      }
    } else if (typeof error === 'string' && error.trim()) {
      message = error.trim();
    }
    setSaveStatusState('error', { message });
  }
  function announceArchiveTemporaryExample(example) {
    if (!example || typeof example !== 'object') return;
    if (pendingUserSaveReason) return;
    try {
      const message = 'Eksemplet er åpnet fra arkivet. Trykk «Lagre» for å beholde det permanent.';
      setSaveStatusState('pending-sync', { message });
    } catch (_) {}
  }
  function maybeAnnounceTemporaryExample(index, example) {
    if (!Number.isInteger(index)) return;
    if (!example || typeof example !== 'object') return;
    if (!example[TEMPORARY_EXAMPLE_FLAG]) return;
    if (example[TEMPORARY_EXAMPLE_NOTICE_SHOWN]) return;
    const shouldAnnounce =
      example[TEMPORARY_EXAMPLE_NOTICE_PENDING] === true ||
      (pendingArchiveExampleNotice && pendingArchiveExampleNotice.index === index);
    if (!shouldAnnounce) return;
    announceArchiveTemporaryExample(example);
    example[TEMPORARY_EXAMPLE_NOTICE_SHOWN] = true;
    if (Object.prototype.hasOwnProperty.call(example, TEMPORARY_EXAMPLE_NOTICE_PENDING)) {
      delete example[TEMPORARY_EXAMPLE_NOTICE_PENDING];
    }
    if (pendingArchiveExampleNotice && pendingArchiveExampleNotice.index === index) {
      pendingArchiveExampleNotice = null;
    }
  }
  function parseBackendUpdatedAt(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value) {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }
  function collectTemporaryExamplesForPreservation(examples) {
    if (!Array.isArray(examples) || examples.length === 0) {
      return [];
    }
    const preserved = [];
    for (let index = 0; index < examples.length; index++) {
      const example = examples[index];
      if (!example || typeof example !== 'object') continue;
      if (!example[TEMPORARY_EXAMPLE_FLAG]) continue;
      let clone = null;
      try {
        clone = cloneValue(example);
      } catch (_) {
        clone = example && typeof example === 'object' ? { ...example } : null;
      }
      if (!clone || typeof clone !== 'object') continue;
      clone[TEMPORARY_EXAMPLE_FLAG] = true;
      if (clone.temporary !== true) {
        clone.temporary = true;
      }
      preserved.push({ index, example: clone });
    }
    return preserved;
  }
  function restoreTemporaryExamplesAfterSync(temporaryEntries, baseExamples) {
    if (!Array.isArray(temporaryEntries) || temporaryEntries.length === 0) {
      return null;
    }
    const sourceList = Array.isArray(baseExamples) ? baseExamples : getExamples();
    const baseList = Array.isArray(sourceList) ? sourceList.slice() : [];
    const normalizedEntries = temporaryEntries
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const preservedExample = entry.example && typeof entry.example === 'object' ? entry.example : null;
        if (!preservedExample) return null;
        if (preservedExample[TEMPORARY_EXAMPLE_FLAG] !== true) {
          preservedExample[TEMPORARY_EXAMPLE_FLAG] = true;
        }
        if (preservedExample.temporary !== true) {
          preservedExample.temporary = true;
        }
        const originalIndex = Number.isInteger(entry.index) ? entry.index : baseList.length;
        return { originalIndex, example: preservedExample };
      })
      .filter(Boolean)
      .sort((a, b) => a.originalIndex - b.originalIndex);
    if (normalizedEntries.length === 0) {
      return { examples: baseList.slice(), indexMap: new Map() };
    }
    const nextExamples = baseList.slice();
    const indexMap = new Map();
    normalizedEntries.forEach(item => {
      let targetIndex = item.originalIndex;
      if (!Number.isInteger(targetIndex)) {
        targetIndex = nextExamples.length;
      }
      if (targetIndex < 0) {
        targetIndex = 0;
      } else if (targetIndex > nextExamples.length) {
        targetIndex = nextExamples.length;
      }
      nextExamples.splice(targetIndex, 0, item.example);
      indexMap.set(item.originalIndex, targetIndex);
    });
    cachedExamples = nextExamples;
    cachedExamplesInitialized = true;
    return { examples: nextExamples, indexMap };
  }
  function mergeBackendSyncPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const existingExamples = getExamples();
    const preservedTemporaryExamples = collectTemporaryExamplesForPreservation(existingExamples);
    const examplesFromServer = Array.isArray(payload.examples) ? payload.examples : [];
    const normalizedExamples = normalizeExamplesForStorage(examplesFromServer);
    const serialized = serializeExamplesForStorage(normalizedExamples);
    if (typeof serialized === 'string') {
      applyRawExamples(serialized, {
        reason: 'backend-sync',
        skipHistory: true,
        skipBackendSync: true
      });
    }
    let restoreResult = null;
    if (preservedTemporaryExamples.length > 0) {
      try {
        restoreResult = restoreTemporaryExamplesAfterSync(preservedTemporaryExamples);
      } catch (_) {
        restoreResult = null;
      }
    }
    const deletedProvidedList = Array.isArray(payload.deletedProvided) ? payload.deletedProvided : [];
    replaceDeletedProvidedExamples(deletedProvidedList);
    let updatedAtMs = null;
    if (Object.prototype.hasOwnProperty.call(payload, 'updatedAt')) {
      updatedAtMs = parseBackendUpdatedAt(payload.updatedAt);
    }
    if (updatedAtMs == null && Object.prototype.hasOwnProperty.call(payload, 'updatedAtMs')) {
      updatedAtMs = parseBackendUpdatedAt(payload.updatedAtMs);
    }
    if (updatedAtMs != null) {
      lastLocalUpdateMs = updatedAtMs;
      persistLocalUpdatedAt(lastLocalUpdateMs);
    }
    const updatedAtIso =
      updatedAtMs != null
        ? new Date(updatedAtMs).toISOString()
        : normalizeUpdatedAtIso(payload) || null;
    const finalExamples =
      (restoreResult && Array.isArray(restoreResult.examples)) ? restoreResult.examples : getExamples();
    return {
      examples: finalExamples,
      deletedProvided: deletedProvidedList.map(normalizeKey).filter(Boolean),
      updatedAt: updatedAtIso,
      updatedAtMs
    };
  }
  const MINIMUM_EXAMPLE_WARNING_MESSAGE = 'Du må ha minst ett lagret eksempel.';

  function showMinimumExampleWarning() {
    try {
      setSaveStatusState('error', { message: MINIMUM_EXAMPLE_WARNING_MESSAGE });
    } catch (_) {}
  }

  function showTrashRestoreHelp() {
    try {
      setSaveStatusState('success', {
        message: 'Slettede eksempler ligger i eksempelarkivet. Åpne svg-arkiv.html og trykk «Vis slettede figurer».'
      });
    } catch (_) {}
  }

  async function store(examples, options) {
    const previousExamples = getExamples();
    const previousCount = Array.isArray(previousExamples) ? previousExamples.length : 0;
    const normalized = normalizeExamplesForStorage(examples);
    const nextCount = Array.isArray(normalized) ? normalized.length : 0;
    const serialized = serializeExamplesForStorage(normalized);
    const opts = options && typeof options === 'object' ? options : {};
    const reason = typeof opts.reason === 'string' ? opts.reason : '';
    if (reason === 'delete' && (previousCount <= 1 || nextCount <= 0)) {
      lastKnownActionButtonCount = previousCount;
      showMinimumExampleWarning();
      try {
        updateActionButtonState(previousCount);
      } catch (_) {}
      return {
        ok: false,
        reason: 'minimum-examples',
        examples: previousExamples
      };
    }
    const applied = applyRawExamples(serialized, opts);
    if (!applied) {
      return { ok: false, examples: getExamples() };
    }
    lastKnownActionButtonCount = Array.isArray(normalized) ? normalized.length : 0;
    const userInitiated = isUserInitiatedReason(reason);
    if (userInitiated) {
      localChangesSinceLoad = true;
    }
    if (userInitiated) {
      lastLocalUpdateMs = Date.now();
      persistLocalUpdatedAt(lastLocalUpdateMs);
      beginUserSaveStatus(reason);
    }
    const shouldSkipSync = opts.skipBackendSync === true || !backendReady;
    const shouldLockButtons = userInitiated && !shouldSkipSync;
    if (shouldSkipSync) {
      backendSyncDeferred = true;
      if (userInitiated) {
        markUserSaveDeferred();
      }
      return { ok: true, deferred: true, examples: getExamples(), updatedAt: null };
    }
    backendSyncDeferred = false;
    notifyBackendChange({ force: userInitiated });
    const syncOptions = {
      initiatedBy: userInitiated ? reason : null,
      skipStatusUpdate: userInitiated
    };
    let syncResult = null;
    let syncError = null;
    try {
      if (shouldLockButtons) {
        setActionButtonsBusy(true);
      }
      const syncPromise = flushBackendSync(syncOptions);
      if (syncPromise) {
        syncResult = await syncPromise;
      } else {
        syncResult = await performBackendSync(syncOptions);
      }
    } catch (error) {
      if (userInitiated) {
        markUserSaveError(error);
      }
      syncError = error;
    } finally {
      if (shouldLockButtons) {
        setActionButtonsBusy(false);
      }
    }
    if (syncError) {
      return {
        ok: true,
        offline: true,
        error: syncError,
        examples: getExamples(),
        updatedAt: null
      };
    }
    const updatedAtIso =
      (syncResult && syncResult.merged && syncResult.merged.updatedAt) ||
      (syncResult && syncResult.payload && normalizeUpdatedAtIso(syncResult.payload)) ||
      null;
    if (userInitiated) {
      markUserSaveSuccess(updatedAtIso);
    }
    return {
      ok: true,
      result: syncResult,
      merged: syncResult ? syncResult.merged || null : null,
      payload: syncResult ? syncResult.payload || null : null,
      examples: getExamples(),
      updatedAt: updatedAtIso
    };
  }
  const BINDING_NAMES = ['STATE', 'CFG', 'CONFIG', 'SIMPLE'];
  const DELETED_PROVIDED_KEY = key + '_deletedProvidedExamples';
  const MIGRATION_FLAG_STORAGE_KEY = key + '_backend_migrated_v1';
  let deletedProvidedExamples = null;
  function normalizeKey(value) {
    return (typeof value === 'string' ? value.trim() : '') || '';
  }

  function normalizeBackendExample(example) {
    if (!example || typeof example !== 'object') {
      return {};
    }
    const normalizedList = normalizeExamplesForStorage([example]);
    const base = Array.isArray(normalizedList) && normalizedList.length > 0 && normalizedList[0]
      ? normalizedList[0]
      : {};
    const copy = { ...base };
    const fallbackDescription = extractDescriptionFromExample(example);
    if (fallbackDescription) {
      copy.description = fallbackDescription;
    } else if (typeof copy.description === 'string') {
      copy.description = copy.description.trim();
    }
    if (!copy.description && copy.description !== '') {
      copy.description = '';
    }
    if (Object.prototype.hasOwnProperty.call(copy, '__builtinKey')) {
      const key = normalizeKey(copy.__builtinKey);
      if (key) {
        copy.__builtinKey = key;
      } else {
        delete copy.__builtinKey;
      }
    }
    return copy;
  }

  function normalizeBackendExamples(examples) {
    if (!Array.isArray(examples)) {
      return [];
    }
    return examples.map(example => normalizeBackendExample(example));
  }
  function getDeletedProvidedExamples() {
    if (deletedProvidedExamples) return deletedProvidedExamples;
    deletedProvidedExamples = new Set();
    try {
      const stored = storageGetItem(DELETED_PROVIDED_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          parsed.forEach(value => {
            const key = normalizeKey(value);
            if (key) deletedProvidedExamples.add(key);
          });
        }
      }
    } catch (error) {
      deletedProvidedExamples = new Set();
    }
    return deletedProvidedExamples;
  }
  function persistDeletedProvidedExamples() {
    if (!deletedProvidedExamples) return;
    try {
      storageSetItem(DELETED_PROVIDED_KEY, JSON.stringify(Array.from(deletedProvidedExamples)));
    } catch (error) {}
    if (deletedProvidedExamples.size > 0) {
      localChangesSinceLoad = true;
    }
    notifyBackendChange({ force: true });
  }
  function replaceDeletedProvidedExamples(list) {
    const next = new Set();
    if (Array.isArray(list)) {
      list.forEach(value => {
        const key = normalizeKey(value);
        if (key) {
          next.add(key);
        }
      });
    }
    deletedProvidedExamples = next;
    if (deletedProvidedExamples.size > 0) {
      try {
        storageSetItem(DELETED_PROVIDED_KEY, JSON.stringify(Array.from(deletedProvidedExamples)));
      } catch (_) {}
    } else {
      try {
        storageRemoveItem(DELETED_PROVIDED_KEY);
      } catch (_) {}
    }
    return deletedProvidedExamples;
  }
  function hasCompletedExamplesMigration() {
    if (typeof window === 'undefined') return true;
    if (window.__EXAMPLES_MIGRATION_DONE__ === true) {
      return true;
    }
    let stored = null;
    try {
      stored = storageGetItem(MIGRATION_FLAG_STORAGE_KEY);
    } catch (_) {
      stored = null;
    }
    if (stored === '1') {
      window.__EXAMPLES_MIGRATION_DONE__ = true;
      return true;
    }
    return false;
  }
  function markExamplesMigrationComplete() {
    if (typeof window !== 'undefined') {
      window.__EXAMPLES_MIGRATION_DONE__ = true;
    }
    try {
      storageSetItem(MIGRATION_FLAG_STORAGE_KEY, '1');
    } catch (_) {}
  }
  function clearLegacyExamplesStorageArtifacts() {
    try {
      storageRemoveItem(key);
    } catch (_) {}
    try {
      storageRemoveItem(DELETED_PROVIDED_KEY);
    } catch (_) {}
  }
  function markProvidedExampleDeleted(value) {
    const key = normalizeKey(value);
    if (!key) return;
    const set = getDeletedProvidedExamples();
    if (!set.has(key)) {
      set.add(key);
      persistDeletedProvidedExamples();
    }
  }
  function flushPendingChanges() {
    const fields = document.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      ['input', 'change'].forEach(type => {
        try {
          field.dispatchEvent(new Event(type, {
            bubbles: true
          }));
        } catch (_) {}
      });
    });
    const syncFns = ['applyCfg', 'applyConfig'];
    syncFns.forEach(name => {
      const fn = window[name];
      if (typeof fn === 'function') {
        try {
          fn();
        } catch (_) {}
      }
    });
  }
  async function generateExampleThumbnail(svgMarkup) {
    if (typeof svgMarkup !== 'string') return null;
    const sanitized = svgMarkup.trim();
    if (!sanitized) return null;
    if (typeof document === 'undefined') return null;
    if (typeof Blob !== 'function' || typeof Image !== 'function') return null;
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
    const createCanvas = () => {
      if (typeof document.createElement === 'function') {
        try {
          const canvas = document.createElement('canvas');
          if (canvas && typeof canvas.getContext === 'function') {
            return canvas;
          }
        } catch (_) {}
      }
      if (typeof OffscreenCanvas === 'function') {
        try {
          return new OffscreenCanvas(1, 1);
        } catch (_) {}
      }
      return null;
    };
    const canvas = createCanvas();
    if (!canvas) return null;
    let objectUrl = null;
    try {
      const blob = new Blob([sanitized], { type: 'image/svg+xml' });
      objectUrl = URL.createObjectURL(blob);
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        const cleanup = () => {
          img.onload = null;
          img.onerror = null;
        };
        img.onload = () => {
          cleanup();
          resolve(img);
        };
        img.onerror = () => {
          cleanup();
          reject(new Error('Failed to load SVG for thumbnail'));
        };
        img.src = objectUrl;
      });
      if (image && typeof image.decode === 'function') {
        try {
          await image.decode();
        } catch (_) {}
      }
      const naturalWidth = Number(image && (image.naturalWidth || image.width || 0));
      const naturalHeight = Number(image && (image.naturalHeight || image.height || 0));
      const fallbackSize = MAX_THUMBNAIL_DIMENSION;
      const rawWidth = Number.isFinite(naturalWidth) && naturalWidth > 0 ? naturalWidth : fallbackSize;
      const rawHeight = Number.isFinite(naturalHeight) && naturalHeight > 0 ? naturalHeight : fallbackSize;
      const longestSide = Math.max(rawWidth, rawHeight, 1);
      const scale = longestSide > MAX_THUMBNAIL_DIMENSION ? MAX_THUMBNAIL_DIMENSION / longestSide : 1;
      const width = Math.max(1, Math.round(rawWidth * scale));
      const height = Math.max(1, Math.round(rawHeight * scale));
      if (typeof canvas.width === 'number') {
        canvas.width = width;
      }
      if (typeof canvas.height === 'number') {
        canvas.height = height;
      }
      const context = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
      if (!context || typeof context.drawImage !== 'function') {
        return null;
      }
      if (typeof context.clearRect === 'function') {
        context.clearRect(0, 0, width, height);
      }
      try {
        context.drawImage(image, 0, 0, width, height);
      } catch (_) {
        return null;
      }
      let dataUrl = null;
      if (typeof canvas.toDataURL === 'function') {
        try {
          dataUrl = canvas.toDataURL('image/png');
        } catch (_) {
          dataUrl = null;
        }
      } else if (typeof canvas.convertToBlob === 'function' && typeof FileReader === 'function') {
        try {
          const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
          dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve(typeof reader.result === 'string' ? reader.result : '');
            };
            reader.onerror = () => {
              reject(new Error('Failed to read thumbnail blob'));
            };
            reader.readAsDataURL(pngBlob);
          });
        } catch (_) {
          dataUrl = null;
        }
      }
      if (typeof dataUrl !== 'string') {
        return null;
      }
      const trimmedUrl = dataUrl.trim();
      if (!trimmedUrl || !/^data:image\/png;base64,/i.test(trimmedUrl)) {
        return null;
      }
      if (computeByteLength(trimmedUrl) > MAX_THUMBNAIL_STORAGE_BYTES) {
        return null;
      }
      return trimmedUrl;
    } catch (_) {
      return null;
    } finally {
      if (objectUrl && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (_) {}
      }
    }
  }
  function collectExampleSvgMarkup(options) {
    if (typeof document === 'undefined') return '';
    const opts = options && typeof options === 'object' ? options : {};
    if (opts.flush !== false) {
      try {
        flushPendingChanges();
      } catch (_) {}
    }
    const detail = { svgOverride: null };
    const notifyActiveToolCollect = () => {
      const activeTool = getActiveToolApi();
      if (!activeTool) return false;
      const tried = new Set();
      const execute = fn => {
        if (typeof fn !== 'function' || tried.has(fn)) return false;
        tried.add(fn);
        try {
          fn(detail);
        } catch (_) {}
        return true;
      };
      const candidates = ['onExampleCollect', 'onExamplesCollect', 'handleExampleCollect', 'collectExampleState'];
      for (const name of candidates) {
        if (execute(activeTool[name])) {
          return true;
        }
      }
      return false;
    };
    notifyActiveToolCollect();
    if (typeof window !== 'undefined' && window) {
      try {
        let evt;
        if (typeof CustomEvent === 'function') {
          evt = new CustomEvent('examples:collect', {
            detail
          });
        } else {
          evt = new Event('examples:collect');
          try {
            evt.detail = detail;
          } catch (_) {}
        }
        window.dispatchEvent(evt);
      } catch (error) {
        try {
          const evt = new Event('examples:collect');
          try {
            evt.detail = detail;
          } catch (_) {}
          window.dispatchEvent(evt);
        } catch (_) {}
      }
    }
    let svgMarkup = '';
    const override = detail.svgOverride;
    if (override != null) {
      if (typeof override === 'string') {
        svgMarkup = override;
      } else if (override && typeof override.outerHTML === 'string') {
        svgMarkup = override.outerHTML;
      }
    }
    if (!svgMarkup) {
      const svg = document.querySelector('svg');
      if (svg && typeof svg.outerHTML === 'string') {
        svgMarkup = svg.outerHTML;
      }
    }
    return typeof svgMarkup === 'string' ? svgMarkup : '';
  }
  function ensureLoadingOverlayElement() {
    if (typeof document === 'undefined') return null;
    if (loadingOverlayElement && loadingOverlayElement.isConnected) {
      return loadingOverlayElement;
    }
    const existing = document.getElementById('exampleLoadingOverlay');
    if (existing && existing.classList && existing.classList.contains('example-loading-overlay')) {
      loadingOverlayElement = existing;
    } else {
      const overlay = document.createElement('div');
      overlay.id = 'exampleLoadingOverlay';
      overlay.className = 'example-loading-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      const content = document.createElement('div');
      content.className = 'example-loading-overlay__content';
      content.setAttribute('role', 'status');
      content.setAttribute('aria-live', 'polite');
      const spinner = document.createElement('div');
      spinner.className = 'example-loading-overlay__spinner';
      const text = document.createElement('div');
      text.className = 'example-loading-overlay__text';
      text.textContent = 'Laster inn eksempel …';
      content.appendChild(spinner);
      content.appendChild(text);
      overlay.appendChild(content);
      loadingOverlayElement = overlay;
    }
    const attachOverlay = () => {
      const parent = document.body || document.documentElement;
      if (!parent || !loadingOverlayElement) return false;
      if (loadingOverlayElement.parentNode === parent) return true;
      try {
        parent.appendChild(loadingOverlayElement);
        return true;
      } catch (_) {
        return false;
      }
    };
    if (!attachOverlay()) {
      const onReady = () => {
        document.removeEventListener('DOMContentLoaded', onReady);
        attachOverlay();
      };
      document.addEventListener('DOMContentLoaded', onReady);
    }
    return loadingOverlayElement;
  }
  function showLoadingOverlay() {
    if (typeof document === 'undefined') return;
    const overlay = ensureLoadingOverlayElement();
    if (!overlay) return;
    if (loadingOverlayHideTimer) {
      clearTimeout(loadingOverlayHideTimer);
      loadingOverlayHideTimer = null;
    }
    loadingOverlayVisible = true;
    loadingOverlayLastShownAt = Date.now();
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
  }
  function hideLoadingOverlay(options) {
    if (typeof document === 'undefined') return;
    const overlay = ensureLoadingOverlayElement();
    if (!overlay) return;
    const opts = options && typeof options === 'object' ? options : {};
    const immediate = opts.immediate === true;
    const finalize = () => {
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      loadingOverlayVisible = false;
      if (loadingOverlayHideTimer) {
        clearTimeout(loadingOverlayHideTimer);
        loadingOverlayHideTimer = null;
      }
    };
    if (!loadingOverlayVisible && !immediate) {
      finalize();
      return;
    }
    if (immediate) {
      finalize();
      return;
    }
    const minVisibleMs = 150;
    const elapsed = Date.now() - loadingOverlayLastShownAt;
    const delay = elapsed < minVisibleMs ? minVisibleMs - elapsed : 0;
    if (delay > 0) {
      if (loadingOverlayHideTimer) {
        clearTimeout(loadingOverlayHideTimer);
      }
      loadingOverlayHideTimer = setTimeout(finalize, delay);
    } else {
      finalize();
    }
  }
  function ensureTabStyles() {
    if (document.getElementById('exampleTabStyles')) return;
    const style = document.createElement('style');
    style.id = 'exampleTabStyles';
    style.textContent = `
.example-tabs{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;margin-bottom:0;align-items:flex-end;padding-bottom:0;}
.example-tab-wrapper{position:relative;display:inline-flex;align-items:center;}
.example-tab{appearance:none;border:1px solid #d1d5db;border-bottom:none;background:#f3f4f6;color:#374151;border-radius:10px 10px 0 0;padding:6px 14px;font-size:14px;line-height:1;cursor:pointer;transition:background-color .2s,border-color .2s,color .2s;box-shadow:0 -1px 0 rgba(15,23,42,.08) inset;margin-bottom:-1px;}
.example-tab:hover{background:#e5e7eb;}
.example-tab.is-active{background:#fff;color:#111827;border-color:var(--purple,#5B2AA5);border-bottom:1px solid #fff;box-shadow:0 -2px 0 var(--purple,#5B2AA5) inset;}
.example-tab:focus-visible{outline:2px solid var(--purple,#5B2AA5);outline-offset:2px;}
.example-tab.is-new{position:relative;}
.example-tab.is-new::after{content:'NY';margin-left:8px;font-size:11px;font-weight:700;color:#b91c1c;text-transform:uppercase;letter-spacing:.04em;}
.example-tab-delete{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:9999px;border:1px solid #b91c1c;background:#ef4444;color:#fff;font-size:14px;line-height:1;display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 10px rgba(15,23,42,.18);transition:transform .15s ease,background-color .15s ease;border-color .15s ease;}
.example-tab-delete:hover{background:#dc2626;border-color:#991b1b;transform:scale(1.05);}
.example-tab-delete:focus-visible{outline:2px solid #b91c1c;outline-offset:2px;}
.example-tab-wrapper.is-delete-visible .example-tab-delete{display:flex;}
.example-tabs-empty{font-size:13px;color:#6b7280;padding:12px 0;display:flex;flex-wrap:wrap;align-items:center;gap:10px;}
.example-tabs-empty__message{flex:0 0 auto;}
.example-tabs-empty__cta{appearance:none;border:1px solid #d1d5db;background:#fff;color:#374151;border-radius:9999px;padding:6px 16px;font-size:13px;line-height:1;cursor:pointer;transition:background-color .2s,border-color .2s,color .2s,box-shadow .2s;}
.example-tabs-empty__cta:hover{background:#f3f4f6;border-color:#cbd5f5;}
.example-tabs-empty__cta:focus-visible{outline:2px solid var(--purple,#5B2AA5);outline-offset:2px;}
.example-backend-notice{margin-top:12px;margin-bottom:12px;padding:10px 14px;border-radius:10px;background:#fee2e2;border:1px solid #f87171;color:#991b1b;font-size:14px;line-height:1.4;display:flex;flex-wrap:wrap;gap:4px;align-items:center;}
.example-backend-notice__title{font-weight:600;display:inline-flex;align-items:center;}
.example-backend-notice__message{display:inline-flex;align-items:center;}
.example-save-status{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;color:#6b7280;line-height:1.2;}
.example-save-status[data-status="success"]{color:#047857;}
.example-save-status[data-status="error"]{color:#b91c1c;}
.example-save-status__spinner{display:none;width:14px;height:14px;border-radius:50%;border:2px solid rgba(107,114,128,.35);border-top-color:var(--purple,#5B2AA5);animation:example-save-status-spin .8s linear infinite;}
.example-save-status[data-status="saving"] .example-save-status__spinner,.example-save-status[data-status="pending-sync"] .example-save-status__spinner{display:inline-flex;}
.example-save-status__text{display:inline-flex;align-items:center;}
@keyframes example-save-status-spin{to{transform:rotate(360deg);}}
.example-loading-overlay{position:fixed;z-index:2147483640;inset:0;background:rgba(255,255,255,.95);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .2s ease;}
.example-loading-overlay.is-visible{opacity:1;pointer-events:auto;}
.example-loading-overlay__content{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 32px;border-radius:16px;background:#fff;box-shadow:0 10px 40px rgba(15,23,42,.15);color:#1f2937;text-align:center;}
.example-loading-overlay__spinner{width:48px;height:48px;border-radius:50%;border:4px solid rgba(107,114,128,.25);border-top-color:var(--purple,#5B2AA5);animation:example-loading-overlay-spin .9s linear infinite;}
.example-loading-overlay__text{font-size:16px;font-weight:600;}
@keyframes example-loading-overlay-spin{to{transform:rotate(360deg);}}
.card-has-settings .example-settings{margin-top:6px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;flex-direction:column;gap:10px;}
.card-has-settings .example-settings > .example-tabs{margin-top:0;margin-bottom:0;}
.card-has-settings .example-settings > h2:first-child{margin-top:0;}
.card-has-settings .example-settings > .example-tabs + h2{margin-top:0;}
`;
    document.head.appendChild(style);
  }
  function placeTabsInsideSettings(exampleCard) {
    if (!tabsContainer || !exampleCard) return;
    const settingsWrapper = exampleCard.querySelector(':scope > .example-settings');
    if (!settingsWrapper) return;
    let firstChild = settingsWrapper.firstChild;
    if (firstChild === tabsContainer) return;
    tabsContainer.remove();
    while (firstChild && firstChild.nodeType === Node.TEXT_NODE && !firstChild.textContent.trim()) {
      const toRemove = firstChild;
      firstChild = firstChild.nextSibling;
      settingsWrapper.removeChild(toRemove);
    }
    settingsWrapper.insertBefore(tabsContainer, firstChild);
  }
  function adjustTabsSpacing() {
    if (!tabsContainer) return;
    const parent = tabsContainer.parentElement;
    if (parent && parent.classList && parent.classList.contains('example-settings')) {
      tabsContainer.style.marginTop = '0';
      tabsContainer.style.marginBottom = '0';
    } else {
      tabsContainer.style.removeProperty('margin-top');
      tabsContainer.style.removeProperty('margin-bottom');
    }
  }
  function moveDescriptionBelowTabs() {
    if (!tabsContainer) return;
    const description = document.querySelector('.example-description');
    if (!description || !description.parentElement) return;
    const settingsWrapper = tabsContainer.closest('.example-settings');
    const targetParent = settingsWrapper || tabsContainer.parentElement;
    if (!targetParent) return;
    let referenceNode = tabsContainer.nextSibling;
    while (referenceNode && referenceNode.nodeType === Node.TEXT_NODE && !referenceNode.textContent.trim()) {
      referenceNode = referenceNode.nextSibling;
    }
    if (referenceNode === description) return;
    if (description.parentElement !== targetParent) {
      if (referenceNode) {
        targetParent.insertBefore(description, referenceNode);
      } else {
        targetParent.appendChild(description);
      }
      return;
    }
    if (referenceNode) {
      targetParent.insertBefore(description, referenceNode);
    } else {
      targetParent.appendChild(description);
    }
  }
  function moveSettingsIntoExampleCard() {
    if (!toolbarElement) return;
    const exampleCard = toolbarElement.closest('.card');
    if (!exampleCard) return;
    tabsHostCard = exampleCard;
    if (!exampleCard.classList.contains('card-has-settings')) {
      let candidate = exampleCard.nextElementSibling;
      let settingsCard = null;
      while (candidate) {
        if (candidate.nodeType !== Node.ELEMENT_NODE) {
          candidate = candidate.nextElementSibling;
          continue;
        }
        if (!candidate.classList.contains('card')) {
          candidate = candidate.nextElementSibling;
          continue;
        }
        if (candidate.classList.contains('card--settings') || candidate.getAttribute('data-card') === 'settings') {
          settingsCard = candidate;
          break;
        }
        const heading = candidate.querySelector(':scope > h2');
        const text = heading ? heading.textContent.trim().toLowerCase() : '';
        if (text === 'innstillinger' || text === 'innstilling') {
          settingsCard = candidate;
          break;
        }
        candidate = candidate.nextElementSibling;
      }
      if (settingsCard) {
        const settingsWrapper = document.createElement('div');
        settingsWrapper.className = 'example-settings';
        while (settingsCard.firstChild) {
          settingsWrapper.appendChild(settingsCard.firstChild);
        }
        exampleCard.appendChild(settingsWrapper);
        settingsCard.remove();
        exampleCard.classList.add('card-has-settings');
      }
    }
    placeTabsInsideSettings(exampleCard);
    adjustTabsSpacing();
    moveDescriptionBelowTabs();
  }
  function getBinding(name) {
    if (name in window && window[name]) return window[name];
    try {
      switch (name) {
        case 'STATE':
          return typeof STATE !== 'undefined' && STATE ? STATE : undefined;
        case 'CFG':
          return typeof CFG !== 'undefined' && CFG ? CFG : undefined;
        case 'CONFIG':
          return typeof CONFIG !== 'undefined' && CONFIG ? CONFIG : undefined;
        case 'SIMPLE':
          return typeof SIMPLE !== 'undefined' && SIMPLE ? SIMPLE : undefined;
        default:
          return undefined;
      }
    } catch (error) {
      return undefined;
    }
  }
  function valueRequiresCustomClone(value, seen) {
    if (value == null || typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Map]' || tag === '[object Set]' || tag === '[object Date]' || tag === '[object RegExp]') {
      return true;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (valueRequiresCustomClone(value[i], seen)) {
          return true;
        }
      }
      return false;
    }
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (valueRequiresCustomClone(value[key], seen)) {
        return true;
      }
    }
    return false;
  }
  function cloneValue(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {}
    }
    if (!valueRequiresCustomClone(value, new WeakSet())) {
      try {
        return JSON.parse(JSON.stringify(value));
      } catch (error) {}
    }
    return cloneValueFallback(value, new WeakMap());
  }
  function cloneValueFallback(value, seen) {
    if (value == null || typeof value !== 'object') return value;
    if (seen.has(value)) return seen.get(value);
    if (Array.isArray(value)) {
      const arr = [];
      seen.set(value, arr);
      for (let i = 0; i < value.length; i++) {
        arr[i] = cloneValueFallback(value[i], seen);
      }
      return arr;
    }
    const tag = Object.prototype.toString.call(value);
    if (tag === '[object Date]') {
      return new Date(value.getTime());
    }
    if (tag === '[object RegExp]') {
      return new RegExp(value);
    }
    if (tag === '[object Map]') {
      const map = new Map();
      seen.set(value, map);
      value.forEach((v, k) => {
        map.set(cloneValueFallback(k, seen), cloneValueFallback(v, seen));
      });
      return map;
    }
    if (tag === '[object Set]') {
      const set = new Set();
      seen.set(value, set);
      value.forEach(v => {
        set.add(cloneValueFallback(v, seen));
      });
      return set;
    }
    if (tag !== '[object Object]') {
      return value;
    }
    const clone = {};
    seen.set(value, clone);
    Object.keys(value).forEach(key => {
      clone[key] = cloneValueFallback(value[key], seen);
    });
    return clone;
  }
  function replaceContents(target, source) {
    if (!target || source == null) return false;
    if (Array.isArray(target) && Array.isArray(source)) {
      target.length = 0;
      target.push(...source);
      return true;
    }
    if (typeof target === 'object' && typeof source === 'object') {
      Object.keys(target).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(source, key)) delete target[key];
      });
      Object.assign(target, source);
      return true;
    }
    return false;
  }
  function applyBinding(name, value) {
    if (value == null) return;
    const applyToTarget = target => {
      if (!target) return false;
      const cloned = cloneValue(value);
      return replaceContents(target, cloned);
    };
    const target = getBinding(name);
    const appliedToTarget = applyToTarget(target);
    if (target && window[name] !== target) {
      window[name] = target;
    }
    if (appliedToTarget) {
      return;
    }
    const winVal = name in window ? window[name] : undefined;
    if (applyToTarget(winVal)) return;
    window[name] = cloneValue(value);
  }
  if (typeof window !== 'undefined') {
    for (const name of BINDING_NAMES) {
      const binding = getBinding(name);
      if (binding != null && window[name] !== binding) {
        window[name] = binding;
      }
    }
  }
  function triggerRefresh(index, example) {
    const detail = { index, example };
    const tried = new Set();
    const activeTool = getActiveToolApi();
    const execute = fn => {
      if (typeof fn !== 'function' || tried.has(fn)) return false;
      tried.add(fn);
      try {
        fn(detail);
      } catch (_) {}
      return true;
    };
    const toolCandidates = ['onExampleLoaded', 'onExamplesLoaded', 'handleExampleLoaded'];
    if (activeTool) {
      for (const name of toolCandidates) {
        if (execute(activeTool[name])) return;
      }
    }
    const candidates = ['render', 'renderAll', 'draw', 'drawAll', 'update', 'updateAll', 'init', 'initAll', 'initFromCfg', 'initFromHtml', 'refresh', 'redraw', 'rerender', 'recalc', 'applyCfg', 'applyConfig', 'applyState', 'setup', 'rebuild'];
    for (const name of candidates) {
      if (activeTool && execute(activeTool[name])) return;
      if (execute(window[name])) return;
    }
    let dispatched = false;
    if (typeof CustomEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('examples:loaded', {
          detail
        }));
        dispatched = true;
      } catch (_) {}
    }
    if (!dispatched) {
      try {
        window.dispatchEvent(new Event('examples:loaded'));
      } catch (_) {}
    }
  }
  function getActiveToolApi() {
    if (typeof window === 'undefined') return null;
    const attempts = [
      () => {
        const mv = window.mathVisuals && typeof window.mathVisuals === 'object' ? window.mathVisuals : null;
        if (!mv) return null;
        if (typeof mv.getActiveTool === 'function') {
          try {
            return mv.getActiveTool();
          } catch (_) {}
        }
        if (mv.activeTool && typeof mv.activeTool === 'object') {
          return mv.activeTool;
        }
        return null;
      },
      () => {
        const api = window.MathVisExamples && typeof window.MathVisExamples === 'object' ? window.MathVisExamples : null;
        if (!api) return null;
        if (typeof api.getActiveTool === 'function') {
          try {
            return api.getActiveTool();
          } catch (_) {}
        }
        if (api.activeTool && typeof api.activeTool === 'object') {
          return api.activeTool;
        }
        return null;
      }
    ];
    for (const attempt of attempts) {
      const tool = attempt();
      if (tool && typeof tool === 'object') {
        return tool;
      }
    }
    return null;
  }
  function requestActiveToolCleanState() {
    if (typeof window === 'undefined') return null;
    const activeTool = getActiveToolApi();
    const createCleanStateFn = activeTool && typeof activeTool.cleanJSON === 'function'
      ? activeTool.cleanJSON
      : activeTool && typeof activeTool.createCleanState === 'function'
        ? activeTool.createCleanState
        : typeof window.cleanJSON === 'function'
          ? window.cleanJSON
          : typeof window.createCleanState === 'function'
            ? window.createCleanState
            : null;
    if (!createCleanStateFn) return null;
    try {
      const result = createCleanStateFn();
      if (result && typeof result === 'object') {
        return {
          v: 1,
          ...result
        };
      }
    } catch (error) {
      console.error('[examples] failed to collect clean state from active tool', error);
    }
    return null;
  }
  function collectCurrentConfig() {
    flushPendingChanges();
    const svgMarkup = collectExampleSvgMarkup({ flush: false });
    const cfg = {};
    let diagramState = null;
    if (typeof window !== 'undefined' && typeof window.createCleanDiagramState === 'function') {
      try {
        diagramState = window.createCleanDiagramState();
      } catch (error) {
        console.error('[examples] failed to collect clean diagram state', error);
      }
    }
    for (const name of BINDING_NAMES) {
      const binding = getBinding(name);
      if (binding != null && typeof binding !== 'function') {
        cfg[name] = cloneValue(binding);
      }
    }
    const config = { ...cfg };
    if (diagramState && typeof diagramState === 'object') {
      config.diagramState = diagramState;
    }
    return {
      config,
      svg: svgMarkup,
      description: getDescriptionValueForPersistence()
    };
  }
  function notifyParentExampleChange(index) {
    if (typeof window === 'undefined') return;
    const targetWindow = (() => {
      try {
        return window.parent;
      } catch (_) {
        return null;
      }
    })();
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : null;
    const exampleNumber = normalizedIndex != null ? normalizedIndex + 1 : null;
    const removeTrailingBareExample = path => {
      if (typeof path !== 'string') return path;
      let working = path;
      while (working.length > 1 && working.endsWith('/')) {
        working = working.slice(0, -1);
      }
      if (!working || working === '/') {
        return working || '/';
      }
      const lastSlash = working.lastIndexOf('/');
      const segment = working.slice(lastSlash + 1);
      if (/^eksempel$/i.test(segment)) {
        return lastSlash <= 0 ? '/' : working.slice(0, lastSlash);
      }
      return working;
    };
    const computeNormalizedBasePathname = () => {
      const currentPathname =
        typeof window.location.pathname === 'string' && window.location.pathname
          ? window.location.pathname
          : '/';
      let path = '/';
      try {
        path = normalizePathname(currentPathname, { preserveCase: true });
      } catch (_) {
        path = currentPathname || '/';
        if (typeof path === 'string' && !path.startsWith('/')) {
          path = `/${path}`;
        }
      }
      try {
        path = stripTrailingExampleSegment(path);
      } catch (_) {}
      path = removeTrailingBareExample(path);
      if (!path || typeof path !== 'string') {
        return '/';
      }
      if (!path.startsWith('/')) {
        path = `/${path}`;
      }
      if (path.length > 1 && path.endsWith('/')) {
        path = path.slice(0, -1);
      }
      return path || '/';
    };
    const basePathname = computeNormalizedBasePathname();
    const canonicalPath = (() => {
      if (exampleNumber == null) {
        return basePathname;
      }
      const base = basePathname === '/' ? '' : basePathname;
      const composed = `${base}/eksempel${exampleNumber}`;
      if (!composed.startsWith('/')) {
        return `/${composed}`;
      }
      return composed.replace(/\/+$/, '') || '/';
    })();
    try {
      if (typeof history !== 'undefined' && typeof history.replaceState === 'function') {
        const url = new URL(window.location.href);
        const currentPathname =
          typeof window.location.pathname === 'string' && window.location.pathname
            ? window.location.pathname
            : '/';
        const isHtmlEntry = /\.html?$/i.test(currentPathname);
        const isCanonicalExamplePath =
          exampleNumber != null &&
          new RegExp(`/eksempel${exampleNumber}(?:/)?$`, 'i').test(currentPathname);
        if (isHtmlEntry) {
          if (exampleNumber != null) {
            url.searchParams.set('example', String(exampleNumber));
          } else {
            url.searchParams.delete('example');
          }
        } else if (exampleNumber == null || isCanonicalExamplePath) {
          url.searchParams.delete('example');
        }
        history.replaceState(history.state, document.title, `${url.pathname}${url.search}${url.hash}`);
      }
    } catch (_) {}
    if (!targetWindow || targetWindow === window || typeof targetWindow.postMessage !== 'function') return;
    try {
      const canonicalHref = (() => {
        if (!canonicalPath) return null;
        try {
          return new URL(canonicalPath, window.location.href).toString();
        } catch (_) {
          return canonicalPath;
        }
      })();
      targetWindow.postMessage({
        type: 'math-visuals:example-change',
        exampleIndex: normalizedIndex,
        exampleNumber,
        path: window.location.pathname,
        href: window.location.href,
        canonicalPath,
        canonicalHref
      }, '*');
    } catch (_) {}
  }
  function loadExample(index, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const skipReloadIfActive = opts.skipBindingsIfActive === true && currentExampleIndex === index;
    const scheduleOverlayHide = immediate => {
      if (immediate) {
        hideLoadingOverlay({ immediate: true });
        return;
      }
      const raf =
        typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame
          : null;
      if (raf) {
        raf(() => {
          raf(() => hideLoadingOverlay());
        });
      } else {
        setTimeout(() => hideLoadingOverlay(), 32);
      }
    };
    showLoadingOverlay();
    const examples = getExamples();
    const ex = examples[index];
    if (!ex || typeof ex !== 'object') {
      setDescriptionValue('');
      scheduleOverlayHide(true);
      return false;
    }
    const hydrateDiagramExample = example => {
      if (typeof window === 'undefined' || typeof window.loadCleanDiagramState !== 'function') {
        return { applied: false, description: null };
      }
      const candidates = [];
      const config = example ? example.config : null;
      if (config && typeof config === 'object') {
        candidates.push(config.diagramState, config.cleanDiagramState, config.state, config);
      } else if (typeof config === 'string') {
        candidates.push(config);
      }
      if (example && typeof example.diagramState !== 'undefined') {
        candidates.push(example.diagramState);
      }
      if (example && typeof example.svg === 'string') {
        candidates.push(example.svg);
      }
      for (const candidate of candidates) {
        if (candidate == null) continue;
        const result = window.loadCleanDiagramState(candidate);
        if (result) {
          const desc =
            result && result.description && typeof result.description.text === 'string'
              ? result.description.text
              : null;
          return { applied: true, description: desc };
        }
      }
      return { applied: false, description: null };
    };
    const getActiveCleanStateLoader = () => {
      if (typeof window === 'undefined') return null;
      const activeTool = getActiveToolApi();
      if (activeTool && typeof activeTool.serialize === 'function') {
        return activeTool.serialize;
      }
      if (activeTool && typeof activeTool.loadCleanState === 'function') {
        return activeTool.loadCleanState;
      }
      const candidates = [window.graftegnerApi, window.nkantApi, window.diagramApi];
      for (const candidate of candidates) {
        if (candidate && typeof candidate.loadCleanState === 'function') {
          return candidate.loadCleanState;
        }
      }
      return null;
    };

    const extractVersionedExampleData = example => {
      if (example && typeof example.v === 'number' && example.v >= 1) {
        return example;
      }
      const cfg = example && example.config;
      if (cfg && typeof cfg === 'object' && typeof cfg.v === 'number' && cfg.v >= 1) {
        return cfg;
      }
      return null;
    };
    const versionedExampleData = extractVersionedExampleData(ex);
    const isVersionedExample = versionedExampleData != null;
    if (isVersionedExample) {
      const loader = getActiveCleanStateLoader();
      let applied = false;
      const description = (() => {
        const descSource = versionedExampleData;
        const desc = descSource && descSource.desc && typeof descSource.desc === 'object' ? descSource.desc : {};
        if (typeof desc.text === 'string' && desc.text.trim()) {
          return desc.text;
        }
        if (
          descSource &&
          typeof descSource.description === 'string' &&
          descSource.description.trim()
        ) {
          return descSource.description;
        }
        if (ex && ex !== descSource && typeof ex.description === 'string' && ex.description.trim()) {
          return ex.description;
        }
        return null;
      })();
      setDescriptionValue(description != null ? normalizeDescriptionString(description) : '');
      if (currentAppMode === 'task') {
        const taskText = getTaskTextModule();
        if (taskText && typeof taskText.applyTaskTextForExample === 'function') {
          taskText.applyTaskTextForExample(ex, index);
        }
        ensureTaskModeDescriptionRendered();
      }
      if (typeof loader === 'function') {
        try {
          applied = !!loader(cloneValue(versionedExampleData));
        } catch (error) {
          console.error('[examples] failed to load clean state', error);
          applied = false;
        }
      }
      if (applied || skipReloadIfActive) {
        currentExampleIndex = index;
        pendingRequestedIndex = null;
        initialLoadPerformed = true;
        updateTabSelection();
        if (!skipReloadIfActive) {
          triggerRefresh(index, ex);
        }
        notifyParentExampleChange(index);
        maybeAnnounceTemporaryExample(index, ex);
        scheduleOverlayHide(false);
      } else {
        scheduleOverlayHide(true);
      }
      return applied || skipReloadIfActive;
    }
    const cfg = ex.config && typeof ex.config === 'object' ? ex.config : {};
    const diagramHydration = hydrateDiagramExample(ex);
    const description =
      diagramHydration.description != null
        ? normalizeDescriptionString(diagramHydration.description)
        : extractDescriptionFromExample(ex);
    setDescriptionValue(description);
    if (currentAppMode === 'task') {
      const taskText = getTaskTextModule();
      if (taskText && typeof taskText.applyTaskTextForExample === 'function') {
        taskText.applyTaskTextForExample(ex, index);
      }
      ensureTaskModeDescriptionRendered();
    }
    let applied = false;
    const providedBindings = new Set();
    const shouldApplyBindings = !skipReloadIfActive && !diagramHydration.applied;
    if (shouldApplyBindings) {
      if (shouldApplyBindings) {
        for (const name of BINDING_NAMES) {
          const value = cfg[name];
          const normalizedValue = value != null ? value : cfg[String(name).toLowerCase()];
          if (normalizedValue != null) {
            applyBinding(name, normalizedValue);
            providedBindings.add(name);
            applied = true;
          }
        }
        if (!providedBindings.has('STATE')) {
          applyBinding('STATE', {});
        }
      }
      if (diagramHydration.applied) {
        applied = true;
        providedBindings.add('CFG');
      }
    }
    if (applied || skipReloadIfActive) {
      currentExampleIndex = index;
      pendingRequestedIndex = null;
      initialLoadPerformed = true;
      updateTabSelection();
      if (!skipReloadIfActive) {
        triggerRefresh(index, ex);
      }
      notifyParentExampleChange(index);
      maybeAnnounceTemporaryExample(index, ex);
      scheduleOverlayHide(false);
    } else {
      scheduleOverlayHide(true);
    }
    return applied || skipReloadIfActive;
  }
  function updateTabSelection() {
    if (!tabsContainer || !Array.isArray(tabButtons)) return;
    tabButtons.forEach((btn, idx) => {
      if (!btn) return;
      const isActive = idx === currentExampleIndex;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.tabIndex = isActive ? 0 : -1;
    });
  }
  function extractExampleFromOpenRequest(request) {
    if (!request || typeof request !== 'object') return null;
    const direct = request.example || request.exampleData || request.payload;
    if (direct && typeof direct === 'object') {
      return direct;
    }
    if (Array.isArray(request.examples) && request.examples.length > 0) {
      const idx = Number.isInteger(request.index) && request.index >= 0 && request.index < request.examples.length ? request.index : 0;
      const candidate = request.examples[idx];
      if (candidate && typeof candidate === 'object') {
        return candidate;
      }
    }
    return null;
  }
  function getOpenRequestTargetPath(request) {
    if (!request || typeof request !== 'object') return null;
    const candidates = [request.canonicalPath, request.path, request.target, request.href];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') continue;
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      try {
        const normalized = normalizePathname(trimmed);
        if (normalized) return normalized;
      } catch (_) {}
    }
    return null;
  }
  function handleArchiveOpenRequest(request, options) {
    if (!request || typeof request !== 'object') return null;
    const targetPath = getOpenRequestTargetPath(request);
    if (targetPath && targetPath !== storagePath) {
      return null;
    }
    const exampleData = extractExampleFromOpenRequest(request);
    const opts = options && typeof options === 'object' ? options : {};
    const deferRender = opts.deferRender === true || opts.skipRender === true;
    const deferLoad = opts.deferLoad === true || opts.skipLoad === true;
    const skipNotice = opts.skipNotice === true;
    const metadata = {
      index: Number.isInteger(request.index) ? Math.max(0, request.index) : undefined,
      requestId: request.id || request.requestId || request.referenceId || request.createdAt || opts.requestId || null,
      sourcePath: typeof request.path === 'string' ? request.path : typeof request.sourcePath === 'string' ? request.sourcePath : null,
      createdAt: request.createdAt || request.created || null
    };
    const normalizedRequestId =
      metadata.requestId != null && metadata.requestId !== '' ? String(metadata.requestId) : null;
    const normalizedSourcePath =
      typeof metadata.sourcePath === 'string' && metadata.sourcePath.trim() ? metadata.sourcePath.trim() : null;
    metadata.requestId = normalizedRequestId;
    metadata.sourcePath = normalizedSourcePath;
    if (normalizedRequestId || normalizedSourcePath) {
      const examples = getExamples();
      if (Array.isArray(examples) && examples.length > 0) {
        for (let idx = examples.length - 1; idx >= 0; idx--) {
          const candidate = examples[idx];
          if (!candidate || typeof candidate !== 'object') {
            continue;
          }
          const candidateRequestId =
            typeof candidate[TEMPORARY_EXAMPLE_REQUEST_ID] === 'string'
              ? candidate[TEMPORARY_EXAMPLE_REQUEST_ID]
              : null;
          const candidateSourcePath =
            typeof candidate[TEMPORARY_EXAMPLE_SOURCE_PATH] === 'string'
              ? candidate[TEMPORARY_EXAMPLE_SOURCE_PATH]
              : null;
          const requestMatches = normalizedRequestId && candidateRequestId === normalizedRequestId;
          const sourceMatches = normalizedSourcePath && candidateSourcePath === normalizedSourcePath;
          if (!requestMatches && !sourceMatches) {
            continue;
          }
          examples.splice(idx, 1);
          if (Number.isInteger(metadata.index) && idx <= metadata.index) {
            metadata.index = Math.max(0, metadata.index - 1);
          }
        }
      }
    }
    if (exampleData) {
      const inserted = createTemporaryExample(exampleData, { ...metadata, skipNotice });
      if (!inserted) {
        return { handled: false, type: 'archive', reason: 'insert-failed', metadata };
      }
      if (!skipNotice && Number.isInteger(inserted.index)) {
        pendingArchiveExampleNotice = {
          index: inserted.index,
          requestId:
            metadata.requestId != null
              ? String(metadata.requestId)
              : inserted.example && inserted.example[TEMPORARY_EXAMPLE_REQUEST_ID]
              ? String(inserted.example[TEMPORARY_EXAMPLE_REQUEST_ID])
              : null,
          sourcePath: metadata.sourcePath || null,
          createdAt: metadata.createdAt || null
        };
      } else if (skipNotice && pendingArchiveExampleNotice && pendingArchiveExampleNotice.index === inserted.index) {
        pendingArchiveExampleNotice = null;
      }
      if (deferRender) {
        return {
          handled: true,
          type: 'archive',
          mode: deferLoad ? 'injected' : 'queued',
          index: inserted.index,
          example: inserted.example,
          metadata
        };
      }
      currentExampleIndex = inserted.index;
      renderOptions();
      let loaded = true;
      if (!deferLoad) {
        loaded = loadExample(inserted.index);
      }
      return {
        handled: !!loaded,
        type: 'archive',
        mode: deferLoad ? 'queued' : 'loaded',
        index: inserted.index,
        example: inserted.example,
        metadata
      };
    }
    if (Number.isInteger(metadata.index)) {
      const indexToLoad = Math.max(0, metadata.index);
      if (deferRender) {
        return {
          handled: true,
          type: 'archive',
          mode: 'queued',
          index: indexToLoad,
          example: null,
          metadata
        };
      }
      if (deferLoad) {
        currentExampleIndex = indexToLoad;
        renderOptions();
        return {
          handled: true,
          type: 'archive',
          mode: 'queued',
          index: indexToLoad,
          example: null,
          metadata
        };
      }
      const loaded = loadExample(indexToLoad);
      return {
        handled: !!loaded,
        type: 'archive',
        mode: 'loaded',
        index: indexToLoad,
        example: null,
        metadata
      };
    }
    return { handled: false, type: 'archive', reason: 'no-example', metadata };
  }
  function handleLegacyOpenRequest(request) {
    if (!request || typeof request !== 'object') return false;
    const normalizedPath = typeof request.path === 'string' ? normalizePathname(request.path) : null;
    if (normalizedPath && normalizedPath !== storagePath) {
      return false;
    }
    const index = Number.isInteger(request.index) ? request.index : Number.isInteger(request.exampleIndex) ? request.exampleIndex : null;
    if (index == null || index < 0) {
      return false;
    }
    return loadExample(index);
  }
  function consumeOpenRequest(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const skipArchive = opts.skipArchive === true;
    const skipLegacy = opts.skipLegacy === true;
    const returnDetails = opts.returnDetails === true;
    let archiveResult = null;
    if (!skipArchive) {
      const archiveRequest = readArchiveOpenRequest();
      if (archiveRequest) {
        archiveResult = handleArchiveOpenRequest(archiveRequest, opts);
        if (archiveResult && archiveResult.handled) {
          clearArchiveOpenRequest();
        }
      }
    }
    let legacyHandled = false;
    if (!skipLegacy) {
      let legacyRaw = null;
      try {
        legacyRaw = storageGetItem('example_to_load');
      } catch (_) {
        legacyRaw = null;
      }
      if (legacyRaw) {
        let legacyRequest = null;
        try {
          legacyRequest = JSON.parse(legacyRaw);
        } catch (error) {
          legacyRequest = null;
        }
        legacyHandled = handleLegacyOpenRequest(legacyRequest);
        try {
          storageRemoveItem('example_to_load');
        } catch (_) {}
      }
    }
    const handled = (archiveResult && archiveResult.handled) || legacyHandled;
    if (returnDetails) {
      return {
        handled,
        archive: archiveResult,
        legacy: legacyHandled
      };
    }
    return handled;
  }
  if (typeof window !== 'undefined') {
    const existingApi = window.MathVisExamples && typeof window.MathVisExamples === 'object' ? window.MathVisExamples : {};
    const api = {
      ...existingApi,
      collectConfig: () => collectCurrentConfig(),
      collectCurrentState: () => {
        try {
          return collectCurrentExampleState();
        } catch (error) {
          return null;
        }
      },
      createTemporaryExample: (example, options) => createTemporaryExample(example, options),
      readOpenRequest: () => readArchiveOpenRequest(),
      writeOpenRequest: payload => writeArchiveOpenRequest(payload),
      prepareOpenRequest: (request, options) => {
        try {
          return prepareArchiveOpenRequest(request, options);
        } catch (error) {
          return null;
        }
      },
      clearOpenRequest: () => clearArchiveOpenRequest(),
      consumeOpenRequest: options => consumeOpenRequest(options),
      getExamples: () => getExamples().slice()
    };
    window.MathVisExamples = api;
  }
  // Load example if viewer requested (handled after initial setup)
  const createBtn = document.getElementById('btnSaveExample');
  const updateBtn = document.getElementById('btnUpdateExample');
  const deleteBtn = document.getElementById('btnDeleteExample');
  if (!createBtn && !updateBtn && !deleteBtn) return;

  function serializeValueForComparison(value) {
    const normalized = serializeExampleValue(value, new WeakMap());
    if (normalized === undefined) {
      return 'undefined';
    }
    try {
      return JSON.stringify(normalized);
    } catch (error) {
      try {
        return JSON.stringify(cloneValue(normalized));
      } catch (_) {
        return '';
      }
    }
  }

  function hasMeaningfulExampleChanges(previous, next) {
    if (!previous && next) return true;
    if (!next) return false;
    const prevConfig = previous && typeof previous === 'object' ? previous.config : undefined;
    const nextConfig = next && typeof next === 'object' ? next.config : undefined;
    if (serializeValueForComparison(prevConfig) !== serializeValueForComparison(nextConfig)) {
      return true;
    }
    const prevDescription = extractDescriptionFromExample(previous);
    const nextDescription = extractDescriptionFromExample(next);
    if (prevDescription !== nextDescription) {
      return true;
    }
    const prevSvg = sanitizeSvgForStorage(previous && previous.svg);
    const nextSvg = sanitizeSvgForStorage(next && next.svg);
    return prevSvg !== nextSvg;
  }

  function detachProvidedMetadata(example) {
    if (!example || typeof example !== 'object') return;
    if (Object.prototype.hasOwnProperty.call(example, '__builtinKey')) {
      delete example.__builtinKey;
    }
    if (Object.prototype.hasOwnProperty.call(example, 'id')) {
      delete example.id;
    }
  }
  ensureTabStyles();
  toolbarElement =
    (updateBtn === null || updateBtn === void 0 ? void 0 : updateBtn.parentElement) ||
    (createBtn === null || createBtn === void 0 ? void 0 : createBtn.parentElement) ||
    (deleteBtn === null || deleteBtn === void 0 ? void 0 : deleteBtn.parentElement) ||
    toolbarElement;
  if (toolbarElement) {
    ensureSaveStatusElement();
  }
  tabsContainer = document.createElement('div');
  tabsContainer.id = 'exampleTabs';
  tabsContainer.className = 'example-tabs';
  tabsContainer.setAttribute('role', 'tablist');
  tabsContainer.setAttribute('aria-orientation', 'horizontal');
  tabsContainer.setAttribute('aria-label', 'Lagrede eksempler');
  const toolbarParent = (toolbarElement === null || toolbarElement === void 0 ? void 0 : toolbarElement.parentElement) || toolbarElement;
  if (toolbarParent) {
    if (toolbarElement !== null && toolbarElement !== void 0 && toolbarElement.nextSibling) {
      toolbarParent.insertBefore(tabsContainer, toolbarElement.nextSibling);
    } else {
      toolbarParent.appendChild(tabsContainer);
    }
  } else {
    document.body.appendChild(tabsContainer);
  }
  if (!deleteDismissListenerAttached && typeof document !== 'undefined') {
    document.addEventListener('click', event => {
      if (!tabsContainer) return;
      if (event && event.target && tabsContainer.contains(event.target)) return;
      setActiveDeleteTabIndex(null);
    });
    deleteDismissListenerAttached = true;
  }
  if (taskCore && typeof taskCore.applyDefaultUi === 'function') {
    taskCore.applyDefaultUi(currentAppMode);
  }
  moveSettingsIntoExampleCard();
  moveDescriptionBelowTabs();
  window.addEventListener('resize', adjustTabsSpacing);
  updateActionButtonState = count => {
    const totalExamples = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    lastKnownActionButtonCount = totalExamples;
    const disableAll = actionButtonsBusy === true;
    if (deleteBtn) deleteBtn.disabled = disableAll || totalExamples <= 1;
    if (updateBtn) updateBtn.disabled = disableAll || totalExamples === 0;
    if (createBtn) createBtn.disabled = disableAll;
  };
  function setActiveDeleteTabIndex(nextIndex) {
    activeDeleteTabIndex = Number.isInteger(nextIndex) ? nextIndex : null;
    if (!Array.isArray(tabWrappers)) return;
    tabWrappers.forEach((wrapper, idx) => {
      if (!wrapper) return;
      wrapper.classList.toggle('is-delete-visible', activeDeleteTabIndex === idx);
    });
  }
  function clampExampleIndex(index, length) {
    if (!Number.isInteger(index)) return null;
    if (!Number.isInteger(length) || length <= 0) return null;
    if (index < 0) return 0;
    if (index >= length) return length - 1;
    return index;
  }
  let pendingRequestedIndex = parseInitialExampleIndex();
  if (!hasUrlOverrides) {
    try {
      const initialOpenRequest = consumeOpenRequest({
        deferRender: true,
        deferLoad: true,
        skipLegacy: true,
        returnDetails: true
      });
      const archiveDetails = initialOpenRequest && initialOpenRequest.archive;
      if (archiveDetails && archiveDetails.handled && Number.isInteger(archiveDetails.index)) {
        pendingRequestedIndex = archiveDetails.index;
      }
    } catch (_) {}
  }
  function attemptInitialLoad() {
    if (initialLoadPerformed) return;
    if (pendingRequestedIndex == null) return;
    const examples = getExamples();
    const total = Array.isArray(examples) ? examples.length : 0;
    if (total <= 0) {
      return;
    }
    const normalizedIndex = clampExampleIndex(pendingRequestedIndex, total);
    if (normalizedIndex == null) {
      pendingRequestedIndex = null;
      return;
    }
    if (normalizedIndex !== pendingRequestedIndex) {
      pendingRequestedIndex = normalizedIndex;
    }
    const loadNow = () => {
      if (initialLoadPerformed) return;
      if (loadExample(normalizedIndex)) {
        initialLoadPerformed = true;
        pendingRequestedIndex = null;
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadNow, {
      once: true
    });else setTimeout(loadNow, 0);
  }
  function renderOptions() {
    const examples = getExamples();
    const total = Array.isArray(examples) ? examples.length : 0;
    if (total === 0) {
      currentExampleIndex = null;
      hideLoadingOverlay({ immediate: true });
    } else {
      if (pendingRequestedIndex != null) {
        const normalized = clampExampleIndex(pendingRequestedIndex, total);
        pendingRequestedIndex = normalized == null ? pendingRequestedIndex : normalized;
      }
      if (currentExampleIndex == null || currentExampleIndex >= total) {
        const fallback = currentExampleIndex == null ? 0 : total - 1;
        currentExampleIndex = Math.min(total - 1, Math.max(0, fallback));
      }
    }
    if (tabsContainer) {
      tabsContainer.innerHTML = '';
      tabButtons = [];
      tabWrappers = [];
      if (total === 0) {
        setActiveDeleteTabIndex(null);
      } else if (activeDeleteTabIndex != null && activeDeleteTabIndex >= total) {
        setActiveDeleteTabIndex(null);
      }
      if (total === 0) {
        tabsContainer.setAttribute('role', 'presentation');
        tabsContainer.setAttribute('aria-label', 'Ingen lagrede eksempler');
        tabsContainer.removeAttribute('aria-orientation');
        const empty = document.createElement('div');
        empty.className = 'example-tabs-empty';
        empty.setAttribute('role', 'status');
        empty.setAttribute('aria-live', 'polite');
        const message = document.createElement('span');
        message.className = 'example-tabs-empty__message';
        message.textContent = 'Ingen lagrede eksempler ennå.';
        empty.appendChild(message);
        if (createBtn) {
          const cta = document.createElement('button');
          cta.type = 'button';
          cta.className = 'example-tabs-empty__cta';
          cta.textContent = 'Lag nytt eksempel';
          cta.addEventListener('click', () => {
            if (createBtn && typeof createBtn.click === 'function') {
              createBtn.click();
            }
          });
          empty.appendChild(cta);
        }
        tabsContainer.appendChild(empty);
      } else {
        tabsContainer.setAttribute('role', 'tablist');
        tabsContainer.setAttribute('aria-label', 'Lagrede eksempler');
        tabsContainer.setAttribute('aria-orientation', 'horizontal');
        const numericLabelPattern = /^[0-9]+$/;
        examples.forEach((ex, idx) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'example-tab-wrapper';
          wrapper.dataset.exampleIndex = String(idx);
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'example-tab';
          const defaultLabel = String(idx + 1);
          let label = defaultLabel;
          if (ex && typeof ex.exampleNumber === 'string') {
            const trimmed = ex.exampleNumber.trim();
            if (trimmed) {
              if (!numericLabelPattern.test(trimmed)) {
                label = trimmed;
              } else if (Number(trimmed) === idx + 1) {
                label = trimmed;
              }
            }
          }
          btn.textContent = label;
          btn.dataset.exampleIndex = String(idx);
          btn.setAttribute('role', 'tab');
          let ariaLabel = `Eksempel ${label}`;
          if (ex && ex[TEMPORARY_EXAMPLE_FLAG]) {
            btn.classList.add('is-new');
            btn.dataset.exampleState = 'new';
            ariaLabel = `${ariaLabel} (nytt)`;
            btn.title = `${label} – nytt eksempel`;
          }
          btn.setAttribute('aria-label', ariaLabel);
          btn.addEventListener('click', () => {
            if (suppressNextTabClick) {
              suppressNextTabClick = false;
              return;
            }
            setActiveDeleteTabIndex(null);
            loadExample(idx);
          });
          btn.addEventListener('keydown', event => {
            var _tabButtons$next;
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            event.preventDefault();
            if (!tabButtons.length) return;
            const dir = event.key === 'ArrowRight' ? 1 : -1;
            const totalButtons = tabButtons.length;
            let next = idx;
            do {
              next = (next + dir + totalButtons) % totalButtons;
            } while (next !== idx && !tabButtons[next]);
            setActiveDeleteTabIndex(null);
            loadExample(next);
            (_tabButtons$next = tabButtons[next]) === null || _tabButtons$next === void 0 || _tabButtons$next.focus();
          });
          btn.addEventListener('pointerdown', event => {
            if (event.button != null && event.button !== 0) return;
            if (deleteRevealTimer) {
              clearTimeout(deleteRevealTimer);
            }
            deleteRevealTimer = setTimeout(() => {
              deleteRevealTimer = null;
              suppressNextTabClick = true;
              setActiveDeleteTabIndex(idx);
              if (typeof navigator !== 'undefined' && navigator && typeof navigator.vibrate === 'function') {
                navigator.vibrate(10);
              }
            }, 550);
          });
          const cancelDeleteReveal = () => {
            if (!deleteRevealTimer) return;
            clearTimeout(deleteRevealTimer);
            deleteRevealTimer = null;
          };
          btn.addEventListener('pointerup', cancelDeleteReveal);
          btn.addEventListener('pointerleave', cancelDeleteReveal);
          btn.addEventListener('pointercancel', cancelDeleteReveal);
          const deleteTabButton = document.createElement('button');
          deleteTabButton.type = 'button';
          deleteTabButton.className = 'example-tab-delete';
          deleteTabButton.setAttribute('aria-label', `Slett eksempel ${label}`);
          deleteTabButton.title = `Slett eksempel ${label}`;
          deleteTabButton.textContent = '×';
          deleteTabButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            setActiveDeleteTabIndex(null);
            deleteExampleAtIndex(idx);
          });
          wrapper.appendChild(btn);
          wrapper.appendChild(deleteTabButton);
          tabsContainer.appendChild(wrapper);
          tabButtons.push(btn);
          tabWrappers.push(wrapper);
        });
        setActiveDeleteTabIndex(activeDeleteTabIndex);
        updateTabSelection();
      }
    }
    if (total > 0 && !initialLoadPerformed) {
      showLoadingOverlay();
    }
    updateActionButtonState(total);
    attemptInitialLoad();
    if (!initialLoadPerformed && pendingRequestedIndex == null && total > 0) {
      let idx = Number.isInteger(currentExampleIndex) ? currentExampleIndex : 0;
      if (idx < 0) idx = 0;
      if (idx >= total) idx = total - 1;
      if (loadExample(idx)) initialLoadPerformed = true;
    }
  }
  function collectCurrentExampleState() {
    flushPendingChanges();
    const cleanState = requestActiveToolCleanState();
    if (cleanState && typeof cleanState === 'object') {
      return cloneValue(cleanState);
    }
    let ex;
    try {
      ex = collectCurrentConfig();
    } catch (error) {
      console.error('[examples] failed to collect config for example', error);
      const fallbackConfig = {};
      for (const name of BINDING_NAMES) {
        const binding = getBinding(name);
        if (binding != null && typeof binding !== 'function') {
          fallbackConfig[name] = cloneValue(binding);
        }
      }
      ex = {
        config: fallbackConfig,
        svg: '',
        description: getDescriptionValueForPersistence()
      };
    }
    if (!ex || typeof ex !== 'object') {
      ex = {
        config: {},
        svg: '',
        description: getDescriptionValueForPersistence()
      };
    }
    return ex;
  }
  function getActiveExampleIndex(examples) {
    if (!Array.isArray(examples) || examples.length === 0) return null;
    let index = Number.isInteger(currentExampleIndex) ? currentExampleIndex : NaN;
    if (!Number.isInteger(index)) {
      var _tabsContainer;
      const activeTab = (_tabsContainer = tabsContainer) === null || _tabsContainer === void 0 ? void 0 : _tabsContainer.querySelector('.example-tab.is-active');
      const parsed = activeTab ? Number(activeTab.dataset.exampleIndex) : NaN;
      if (Number.isInteger(parsed)) index = parsed;
    }
    if (!Number.isInteger(index)) {
      index = examples.length - 1;
    }
    if (!Number.isInteger(index)) return null;
    index = Math.max(0, Math.min(examples.length - 1, index));
    return index;
  }
  async function deleteExampleAtIndex(indexOverride) {
    const examples = getExamples();
    if (examples.length <= 1) {
      showMinimumExampleWarning();
      try {
        updateActionButtonState(examples.length);
      } catch (_) {}
      return;
    }
    const activeIndex = getActiveExampleIndex(examples);
    const resolvedIndex = Number.isInteger(indexOverride) ? indexOverride : activeIndex;
    const indexToRemove = clampExampleIndex(resolvedIndex, examples.length);
    if (indexToRemove == null) {
      return;
    }
    const removedExample = examples[indexToRemove];
    if (removedExample && typeof removedExample === 'object') {
      markProvidedExampleDeleted(removedExample.__builtinKey);
    }
    const nextExamples = Array.isArray(examples)
      ? examples.map(example => (example && typeof example === 'object' ? { ...example } : example))
      : [];
    nextExamples.splice(indexToRemove, 1);
    nextExamples.forEach((ex, idx) => {
      if (!ex || typeof ex !== 'object') return;
      if (idx === 0) {
        ex.isDefault = true;
      } else if (Object.prototype.hasOwnProperty.call(ex, 'isDefault')) {
        delete ex.isDefault;
      }
    });
    try {
      const result = await store(nextExamples, {
        reason: 'delete'
      });
      if (!result || result.ok !== true) {
        return;
      }
      const useCachedExamples = !!(result && result.offline);
      const finalExamples = useCachedExamples
        ? getExamples()
        : result && Array.isArray(result.examples)
        ? result.examples
        : getExamples();
      if (removedExample && typeof removedExample === 'object' && !removedExample[TEMPORARY_EXAMPLE_FLAG]) {
        await addExampleToTrash(removedExample, {
          index: indexToRemove,
          reason: 'delete',
          capturePreview: true
        });
        showTrashRestoreHelp();
      }
      let nextIndex = activeIndex;
      if (!Array.isArray(finalExamples) || finalExamples.length === 0) {
        nextIndex = null;
      } else if (activeIndex == null || activeIndex === indexToRemove) {
        nextIndex = indexToRemove >= finalExamples.length ? finalExamples.length - 1 : indexToRemove;
      } else if (activeIndex > indexToRemove) {
        nextIndex = Math.max(0, activeIndex - 1);
      }
      currentExampleIndex = nextIndex;
      renderOptions();
      if (nextIndex != null && nextIndex >= 0 && Array.isArray(finalExamples) && finalExamples.length > 0) {
        loadExample(nextIndex, { skipBindingsIfActive: true });
      }
    } catch (error) {
      console.error('[examples] failed to delete example', error);
    }
  }
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const examples = getExamples();
      const nextExamples = Array.isArray(examples) ? examples.slice() : [];
      const ex = collectCurrentExampleState();
      nextExamples.push(ex);
      try {
        const result = await store(nextExamples, {
          reason: 'manual-save'
        });
        if (!result || result.ok !== true) {
          return;
        }
        const useCachedExamples = !!(result && result.offline);
        const finalExamples = useCachedExamples
          ? getExamples()
          : result && Array.isArray(result.examples)
          ? result.examples
          : getExamples();
        const total = Array.isArray(finalExamples) ? finalExamples.length : 0;
        currentExampleIndex = total > 0 ? total - 1 : null;
        renderOptions();
        if (currentExampleIndex != null && total > 0) {
          loadExample(currentExampleIndex, { skipBindingsIfActive: true });
        }
      } catch (error) {
        console.error('[examples] failed to save example', error);
      }
    });
  }
  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      const examples = getExamples();
      if (examples.length === 0) {
        if (createBtn && typeof createBtn.click === 'function') {
          createBtn.click();
        }
        return;
      }
      const indexToUpdate = getActiveExampleIndex(examples);
      if (indexToUpdate == null) return;
      const payload = collectCurrentExampleState();
      const existing = examples[indexToUpdate];
      const isVersionedPayload = payload && typeof payload === 'object' && Number.isFinite(payload.v) && payload.v >= 1;
      const updated = (() => {
        if (isVersionedPayload) {
          return cloneValue(payload);
        }
        const legacy = existing && typeof existing === 'object' ? { ...existing } : {};
        legacy.config = payload && typeof payload.config === 'object' ? payload.config : {};
        legacy.svg = typeof (payload === null || payload === void 0 ? void 0 : payload.svg) === 'string' ? payload.svg : '';
        if (payload && Object.prototype.hasOwnProperty.call(payload, 'description')) {
          legacy.description = typeof payload.description === 'string' ? payload.description : '';
        } else {
          legacy.description = getDescriptionValueForPersistence();
        }
        return legacy;
      })();
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_FLAG)) {
        delete updated[TEMPORARY_EXAMPLE_FLAG];
      }
      if (Object.prototype.hasOwnProperty.call(updated, 'temporary')) {
        delete updated.temporary;
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_REQUEST_ID)) {
        delete updated[TEMPORARY_EXAMPLE_REQUEST_ID];
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_SOURCE_PATH)) {
        delete updated[TEMPORARY_EXAMPLE_SOURCE_PATH];
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_CREATED_AT)) {
        delete updated[TEMPORARY_EXAMPLE_CREATED_AT];
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_NOTICE_PENDING)) {
        delete updated[TEMPORARY_EXAMPLE_NOTICE_PENDING];
      }
      if (Object.prototype.hasOwnProperty.call(updated, TEMPORARY_EXAMPLE_NOTICE_SHOWN)) {
        delete updated[TEMPORARY_EXAMPLE_NOTICE_SHOWN];
      }
      const shouldDetach = existing && typeof existing === 'object' && typeof existing.__builtinKey === 'string' && existing.__builtinKey && hasMeaningfulExampleChanges(existing, updated);
      if (shouldDetach) {
        detachProvidedMetadata(updated);
      }
      const nextExamples = Array.isArray(examples) ? examples.slice() : [];
      nextExamples[indexToUpdate] = updated;
      try {
        const result = await store(nextExamples, {
          reason: 'manual-update'
        });
        if (!result || result.ok !== true) {
          return;
        }
        const useCachedExamples = !!(result && result.offline);
        const finalExamples = useCachedExamples
          ? getExamples()
          : result && Array.isArray(result.examples)
          ? result.examples
          : getExamples();
        const total = Array.isArray(finalExamples) ? finalExamples.length : 0;
        const boundedIndex = total === 0 ? null : Math.max(0, Math.min(indexToUpdate, total - 1));
        currentExampleIndex = boundedIndex;
        renderOptions();
        if (boundedIndex != null) {
          loadExample(boundedIndex, { skipBindingsIfActive: true });
        }
      } catch (error) {
        console.error('[examples] failed to update example', error);
      }
    });
  }
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      setActiveDeleteTabIndex(null);
      await deleteExampleAtIndex(null);
    });
  }
  const trashMigrationPromise = ensureTrashHistoryMigration();
  if (trashMigrationPromise && typeof trashMigrationPromise.catch === 'function') {
    trashMigrationPromise.catch(() => {});
  }
  renderOptions();
  if (!hasUrlOverrides) {
    consumeOpenRequest();
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:app-mode-changed', () => {
      if (currentAppMode === 'task') {
        ensureTaskModeDescriptionRendered();
      }
      const examples = getExamples();
      if (!examples.length) return;
      const normalizedIndex = clampExampleIndex(currentExampleIndex, examples.length);
      const targetIndex = normalizedIndex == null ? 0 : normalizedIndex;
      if (currentAppMode === 'task') {
        const currentDescription = normalizeDescriptionString(getDescriptionValue());
        if (currentDescription) {
          const example = examples[targetIndex];
          const exampleDescription = extractDescriptionFromExample(example);
          if (!exampleDescription || currentDescription !== exampleDescription) {
            return;
          }
        }
      }
      loadExample(targetIndex);
    });
  }
  const baseHealthCheckPromise = examplesApiBase ? checkExamplesBaseHealth() : null;
  const whenBaseHealthReady = () =>
    baseHealthCheckPromise && typeof baseHealthCheckPromise.then === 'function'
      ? baseHealthCheckPromise.catch(() => {})
      : Promise.resolve();
  if (examplesApiBase) {
    const migrationPromise = migrateLegacyExamples();
    if (migrationPromise && typeof migrationPromise.then === 'function') {
      migrationPromise.catch(() => {}).then(() => {
        whenBaseHealthReady().then(() => loadExamplesFromBackend());
      });
    } else {
      whenBaseHealthReady().then(() => loadExamplesFromBackend());
    }
  }
  function parseInitialExampleIndex() {
    const parseValue = value => {
      if (value == null) return null;
      const num = Number(value);
      if (!Number.isFinite(num) || !Number.isInteger(num)) return null;
      if (num > 0) return num - 1;
      if (num === 0) return 0;
      return null;
    };
    if (typeof URLSearchParams !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const fromSearch = parseValue(search.get('example'));
      if (fromSearch != null) return fromSearch;
    }
    const hashMatch = window.location.hash && window.location.hash.match(/example=([0-9]+)/i);
    if (hashMatch) return parseValue(hashMatch[1]);
    const pathname = typeof window.location.pathname === 'string' ? window.location.pathname : '';
    if (pathname) {
      const segments = pathname.split('/').filter(Boolean);
      for (let i = segments.length - 1; i >= 0; i--) {
        const segment = segments[i];
        let decoded = segment;
        try {
          decoded = decodeURIComponent(segment);
        } catch (_) {}
        const match = decoded.match(/^eksempel[-_]?([0-9]+)$/i);
        if (match) {
          const parsed = parseValue(match[1]);
          if (parsed != null) {
            return parsed;
          }
        }
      }
    }
    return null;
  }
})();
