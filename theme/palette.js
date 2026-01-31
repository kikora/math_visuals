(function (global) {
  function resolvePaletteConfig() {
    const scopes = [
      typeof global !== 'undefined' ? global : null,
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof window !== 'undefined' ? window : null
    ];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const config = scope.MathVisualsPaletteConfig;
      if (config && typeof config === 'object') {
        return config;
      }
    }
    if (typeof require === 'function') {
      try {
        const mod = require('../palette/palette-config.js');
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
        '[MathVisualsPalette] Mangler fargekonfigurasjon. Sørg for at palette/palette-config.js lastes før theme/palette.js.'
      );
    }
    return;
  }

  const MAX_COLORS = paletteConfig.MAX_COLORS;
  const FALLBACK_COLORS = Array.isArray(paletteConfig.PROJECT_FALLBACKS && paletteConfig.PROJECT_FALLBACKS.default)
    ? paletteConfig.PROJECT_FALLBACKS.default
    : [];
  const GROUP_SLOT_INDICES = paletteConfig.GROUP_SLOT_INDICES;
  const MIN_COLOR_SLOTS = Number.isInteger(paletteConfig.MIN_COLOR_SLOTS)
    ? paletteConfig.MIN_COLOR_SLOTS
    : Object.values(GROUP_SLOT_INDICES).reduce((total, indices) => total + indices.length, 0);
  const COLOR_GROUP_IDS = Array.isArray(paletteConfig.COLOR_GROUP_IDS)
    ? paletteConfig.COLOR_GROUP_IDS.map(value => (typeof value === 'string' ? value.trim().toLowerCase() : '')).filter(Boolean)
    : Object.keys(GROUP_SLOT_INDICES).map(key => (typeof key === 'string' ? key.trim().toLowerCase() : '')).filter(Boolean);
  const GROUP_SLOT_COUNTS = COLOR_GROUP_IDS.reduce((acc, groupId) => {
    const indices = Array.isArray(GROUP_SLOT_INDICES[groupId]) ? GROUP_SLOT_INDICES[groupId] : [];
    acc[groupId] = indices.length;
    return acc;
  }, {});
  const GROUPED_PALETTE_ORDER = Array.isArray(paletteConfig.DEFAULT_GROUP_ORDER)
    ? paletteConfig.DEFAULT_GROUP_ORDER.map(value => (typeof value === 'string' ? value.trim().toLowerCase() : '')).filter(Boolean)
    : COLOR_GROUP_IDS.slice();
  const COLOR_SLOT_GROUPS = Array.isArray(paletteConfig.COLOR_SLOT_GROUPS)
    ? paletteConfig.COLOR_SLOT_GROUPS.map(group => ({
        groupId: typeof group.groupId === 'string' ? group.groupId.trim().toLowerCase() : '',
        slots: Array.isArray(group.slots)
          ? group.slots.map((slot, slotIndex) => ({
              index: Number.isInteger(slot && slot.index) ? Number(slot.index) : slotIndex,
              label: slot && typeof slot.label === 'string' ? slot.label : '',
              groupId:
                slot && typeof slot.groupId === 'string'
                  ? slot.groupId.trim().toLowerCase()
                  : typeof group.groupId === 'string'
                  ? group.groupId.trim().toLowerCase()
                  : '',
              groupIndex: Number.isInteger(slot && slot.groupIndex) ? Number(slot.groupIndex) : slotIndex
            }))
          : []
      }))
    : [];
  const GROUPS_BY_ID = new Map();
  COLOR_SLOT_GROUPS.forEach(group => {
    if (group && group.groupId) {
      GROUPS_BY_ID.set(group.groupId, group);
    }
  });
  const missingGroupWarnings = new Set();

  function normalizeGroupId(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().toLowerCase();
    return trimmed || '';
  }

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
        if (out.length >= MAX_COLORS) {
          break;
        }
      }
    }
    return out;
  }

  function sanitizeGroupPalette(values, limit) {
    if (!Array.isArray(values)) return [];
    const maxSize = Number.isInteger(limit) && limit >= 0 ? limit : MAX_COLORS;
    const sanitized = [];
    for (let index = 0; index < maxSize; index += 1) {
      const clean = sanitizeColor(values[index]);
      sanitized[index] = clean || null;
    }
    return sanitized;
  }

  function normalizeRoleKey(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return '';
    if (trimmed.startsWith('fill')) return 'fills';
    if (trimmed.startsWith('line')) return 'lines';
    if (trimmed.startsWith('edge') || trimmed.startsWith('kant')) return 'edges';
    if (trimmed.startsWith('angle') || trimmed.startsWith('vinkel')) return 'angles';
    return '';
  }

  function resolveSlotRole(slot) {
    const label = slot && typeof slot.label === 'string' ? slot.label.trim().toLowerCase() : '';
    if (!label) return '';
    if (label.includes('fyll')) return 'fills';
    if (label.includes('linje')) return 'lines';
    if (label.includes('kant')) return 'edges';
    if (label.includes('vinkel')) return 'angles';
    return '';
  }

  function extractFlatPalette(entry) {
    if (!entry) return null;
    if (Array.isArray(entry)) return entry;
    if (entry && typeof entry === 'object') {
      if (Array.isArray(entry.colors)) return entry.colors;
      if (Array.isArray(entry.palette)) return entry.palette;
      if (Array.isArray(entry.values)) return entry.values;
      if (entry.default != null) {
        const nested = extractFlatPalette(entry.default);
        if (nested && nested.length) return nested;
      }
      if (entry.fallback != null) {
        const nested = extractFlatPalette(entry.fallback);
        if (nested && nested.length) return nested;
      }
    }
    return null;
  }

  function collectRoleLists(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return {};
    const roles = {};
    Object.keys(entry).forEach(key => {
      const roleKey = normalizeRoleKey(key);
      if (!roleKey) return;
      const values = sanitizeColorList(entry[key]);
      if (values.length) {
        roles[roleKey] = values;
      }
    });
    return roles;
  }

  function buildRolePaletteSlots(group, roleLists, fallbackList) {
    const slotRoles = {};
    const fallback = Array.isArray(fallbackList) ? fallbackList : [];
    const slots = group && Array.isArray(group.slots) ? group.slots : [];
    return slots.map((slot, slotIndex) => {
      const roleKey = resolveSlotRole(slot);
      if (roleKey && Array.isArray(roleLists[roleKey])) {
        const position = Number.isInteger(slotRoles[roleKey]) ? slotRoles[roleKey] : 0;
        const color = roleLists[roleKey][position];
        slotRoles[roleKey] = position + 1;
        if (color) return color;
      }
      return fallback[slotIndex];
    });
  }

  function resolveGroupPaletteEntry(group, entry) {
    if (Array.isArray(entry)) return entry;
    if (entry && typeof entry === 'object') {
      const roleLists = collectRoleLists(entry);
      const flat = extractFlatPalette(entry);
      if (Object.keys(roleLists).length) {
        return buildRolePaletteSlots(group, roleLists, flat);
      }
      if (flat && flat.length) {
        return flat;
      }
    }
    return [];
  }

  function cloneGroupPalettes(source) {
    const result = {};
    if (!source || typeof source !== 'object') {
      return result;
    }
    Object.keys(source).forEach(key => {
      const normalized = normalizeGroupId(key);
      if (!normalized || !COLOR_GROUP_IDS.includes(normalized)) return;
      if (Array.isArray(source[key])) {
        const limit = GROUP_SLOT_COUNTS[normalized] || MAX_COLORS;
        result[normalized] = sanitizeGroupPalette(source[key], limit);
      }
    });
    return result;
  }

  let fallbackGroupCache = null;

  function getFallbackGroupPalettes() {
    if (fallbackGroupCache) {
      return cloneGroupPalettes(fallbackGroupCache);
    }
    const fallbackColors = getFallbackPalette();
    const groups = {};
    let cursor = 0;
    COLOR_GROUP_IDS.forEach(groupId => {
      const limit = GROUP_SLOT_COUNTS[groupId] || 0;
      const colors = [];
      if (limit > 0) {
        for (let index = 0; index < limit; index += 1) {
          const color = fallbackColors[cursor] || fallbackColors[index % (fallbackColors.length || 1)] || fallbackColors[0];
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
      groups[groupId] = colors;
    });
    fallbackGroupCache = cloneGroupPalettes(groups);
    return cloneGroupPalettes(groups);
  }

  function applyGroupPaletteOverlay(target, source) {
    if (!target || typeof target !== 'object' || !source || typeof source !== 'object') {
      return;
    }
    COLOR_GROUP_IDS.forEach(groupId => {
      const limit = GROUP_SLOT_COUNTS[groupId] || 0;
      if (!limit) return;
      const group = GROUPS_BY_ID.get(groupId);
      const entry = resolveGroupPaletteEntry(group, source[groupId]);
      const incoming = sanitizeGroupPalette(entry, limit);
      if (!incoming.length) return;
      const existing = Array.isArray(target[groupId]) ? target[groupId].slice() : [];
      const merged = [];
      for (let index = 0; index < limit; index += 1) {
        const color = incoming[index] || existing[index];
        if (color) {
          merged.push(color);
        }
      }
    while (merged.length < limit) {
      const fallback = existing[merged.length] || existing[0] || null;
      if (fallback) {
        merged.push(fallback);
      } else {
        break;
      }
    }
    target[groupId] = merged;
  });
  }

  function distributeFlatPaletteToGroups(palette) {
    const sanitized = sanitizeColorList(palette);
    const groups = {};
    let cursor = 0;
    COLOR_GROUP_IDS.forEach(groupId => {
      const limit = GROUP_SLOT_COUNTS[groupId] || 0;
      const colors = [];
      for (let index = 0; index < limit && cursor < sanitized.length; index += 1) {
        colors.push(sanitized[cursor]);
        cursor += 1;
      }
      groups[groupId] = colors;
    });
    return groups;
  }

  function normalizeGroupPalettes(palette) {
    const base = getFallbackGroupPalettes();
    if (Array.isArray(palette)) {
      applyGroupPaletteOverlay(base, distributeFlatPaletteToGroups(palette));
      return base;
    }
    if (palette && typeof palette === 'object') {
      if (Array.isArray(palette.defaultColors)) {
        applyGroupPaletteOverlay(base, distributeFlatPaletteToGroups(palette.defaultColors));
      } else if (palette.defaultColors && typeof palette.defaultColors === 'object') {
        applyGroupPaletteOverlay(base, palette.defaultColors);
      }
      if (palette.groupPalettes && typeof palette.groupPalettes === 'object') {
        applyGroupPaletteOverlay(base, palette.groupPalettes);
      } else {
        applyGroupPaletteOverlay(base, palette);
      }
      return base;
    }
    return base;
  }

  function flattenGroupPalettes(groupPalettes) {
    const source = groupPalettes && typeof groupPalettes === 'object' ? groupPalettes : {};
    const flattened = [];
    GROUPED_PALETTE_ORDER.forEach(groupId => {
      if (flattened.length >= MAX_COLORS) return;
      const normalized = normalizeGroupId(groupId);
      if (!normalized || !COLOR_GROUP_IDS.includes(normalized)) return;
      const limit = GROUP_SLOT_COUNTS[normalized] || 0;
      if (!limit) return;
      const values = Array.isArray(source[normalized])
        ? sanitizeGroupPalette(source[normalized], limit)
        : [];
      values.forEach(color => {
        if (flattened.length < MAX_COLORS && typeof color === 'string' && color) {
          flattened.push(color);
        }
      });
    });
    return flattened;
  }

  function getFallbackPalette() {
    return FALLBACK_COLORS.slice(0, MAX_COLORS);
  }

  function resolveSettingsSource(source) {
    if (source && typeof source === 'object') {
      return source;
    }
    const scope =
      typeof global !== 'undefined' && global && global.MathVisualsSettings
        ? global
        : typeof globalThis !== 'undefined'
        ? globalThis
        : typeof window !== 'undefined'
        ? window
        : null;
    if (scope && scope.MathVisualsSettings && typeof scope.MathVisualsSettings === 'object') {
      return scope.MathVisualsSettings;
    }
    return null;
  }

  function resolveSettingsSnapshot(source) {
    if (source && typeof source === 'object' && typeof source.getSettings === 'function') {
      try {
        const snapshot = source.getSettings();
        if (snapshot && typeof snapshot === 'object') {
          return snapshot;
        }
      } catch (_) {}
    }
    return source;
  }

  function readGroupPalettesFromApi(api) {
    if (!api || typeof api !== 'object') return null;
    if (typeof api.getSettings === 'function') {
      try {
        const snapshot = api.getSettings();
        const groupPalettes = readGroupPalettesFromSettingsObject(snapshot);
        if (groupPalettes && typeof groupPalettes === 'object') {
          return groupPalettes;
        }
      } catch (_) {}
    }
    if (typeof api.getGroupPalettes === 'function') {
      try {
        const groups = api.getGroupPalettes();
        if (groups && typeof groups === 'object') {
          return groups;
        }
      } catch (_) {}
    }
    if (typeof api.getPalette === 'function') {
      try {
        const palette = api.getPalette();
        if (Array.isArray(palette) && palette.length) {
          return distributeFlatPaletteToGroups(palette.slice(0, MAX_COLORS));
        }
        if (palette && typeof palette === 'object' && palette.groupPalettes) {
          return palette.groupPalettes;
        }
      } catch (_) {}
    }
    if (typeof api.getDefaultColors === 'function') {
      try {
        const palette = api.getDefaultColors(MAX_COLORS);
        if (Array.isArray(palette) && palette.length) {
          return distributeFlatPaletteToGroups(palette.slice(0, MAX_COLORS));
        }
      } catch (_) {}
    }
    if (api.groupPalettes && typeof api.groupPalettes === 'object') {
      return api.groupPalettes;
    }
    if (Array.isArray(api.defaultColors) && api.defaultColors.length) {
      return distributeFlatPaletteToGroups(api.defaultColors.slice(0, MAX_COLORS));
    }
    return null;
  }

  function readGroupPalettesFromSettingsObject(settings) {
    const settingsObject = resolveSettingsSnapshot(settings);
    if (!settingsObject || typeof settingsObject !== 'object') return null;
    if (settingsObject.groupPalettes && typeof settingsObject.groupPalettes === 'object') {
      return settingsObject.groupPalettes;
    }
    if (Array.isArray(settingsObject.defaultColors) && settingsObject.defaultColors.length) {
      return distributeFlatPaletteToGroups(settingsObject.defaultColors.slice(0, MAX_COLORS));
    }
    return null;
  }

  function resolveGroupPalettes(source) {
    const paletteFromApi = readGroupPalettesFromApi(source);
    if (paletteFromApi && typeof paletteFromApi === 'object') {
      return normalizeGroupPalettes({ groupPalettes: paletteFromApi });
    }
    const paletteFromSettings = readGroupPalettesFromSettingsObject(source);
    if (paletteFromSettings && typeof paletteFromSettings === 'object') {
      return normalizeGroupPalettes({ groupPalettes: paletteFromSettings });
    }
    return normalizeGroupPalettes(null);
  }

  function buildPalette(source, precomputedGroupPalettes) {
    const groupPalettes =
      precomputedGroupPalettes && typeof precomputedGroupPalettes === 'object'
        ? precomputedGroupPalettes
        : resolveGroupPalettes(source);
    const fallback = getFallbackPalette();
    const flattened = flattenGroupPalettes(groupPalettes);
    const sanitized = sanitizeColorList(flattened);
    const result = [];
    const limit = MAX_COLORS;
    for (let index = 0; index < limit; index += 1) {
      if (sanitized[index]) {
        result.push(sanitized[index]);
        continue;
      }
      if (fallback[index % fallback.length]) {
        result.push(fallback[index % fallback.length]);
        continue;
      }
    }
    if (!result.length) {
      result.push(fallback[0]);
    }
    return result;
  }

  function readGroupPaletteOverrides(settings, groupId) {
    const settingsObject = resolveSettingsSnapshot(settings);
    if (!settingsObject) return [];

    const rootGroups =
      settingsObject.groupPalettes ||
      (settingsObject.palettes && settingsObject.palettes.groups) ||
      settingsObject.groups ||
      null;
    if (rootGroups && typeof rootGroups === 'object') {
      const groupEntry = rootGroups[groupId] || rootGroups.default || null;
      const group = GROUPS_BY_ID.get(groupId);
      const palette = resolveGroupPaletteEntry(group, groupEntry);
      if (palette && palette.length) {
        return sanitizeColorList(palette);
      }
    }

    return [];
  }

  function warnMissingGroupConfiguration(groupId) {
    const normalizedGroup = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    const cacheKey = normalizedGroup || '(none)';
    if (missingGroupWarnings.has(cacheKey)) {
      return;
    }
    missingGroupWarnings.add(cacheKey);
    if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
      if (!normalizedGroup) {
        console.warn('[MathVisualsPalette] Forespurt fargegruppe mangler identifikator. Bruker globale tilbakefallsfarger.');
      } else {
        console.warn(
          `[MathVisualsPalette] Fant ingen fargekonfigurasjon for gruppen "${normalizedGroup}". Bruker tilbakefallsfarger.`
        );
      }
    }
  }

  function collectGroupIndices(groupId) {
    const base = GROUP_SLOT_INDICES[groupId];
    if (Array.isArray(base)) {
      return base.slice();
    }
    warnMissingGroupConfiguration(groupId);
    return [];
  }

  function ensurePaletteSize(colors, count, fallbackPalette) {
    const palette = colors.filter(color => typeof color === 'string' && color);
    const fallback = fallbackPalette && fallbackPalette.length ? fallbackPalette : getFallbackPalette();
    if (!palette.length) {
      palette.push(fallback[0]);
    }
    if (!Number.isFinite(count) || count <= 0) {
      return palette.slice();
    }
    const size = Math.trunc(count);
    const result = [];
    for (let index = 0; index < size; index += 1) {
      const color = palette[index % palette.length] || fallback[index % fallback.length];
      result.push(color || fallback[0]);
    }
    return result;
  }

  function getGroupPalette(groupId, options) {
    const groupKey = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    const opts = options && typeof options === 'object' ? options : {};
    const source = resolveSettingsSource(opts.settings);
    const count = Number.isFinite(opts.count) && opts.count > 0 ? Math.trunc(opts.count) : undefined;
    const fallbackPalette = getFallbackPalette();

    if (!groupKey) {
      warnMissingGroupConfiguration(groupKey);
      return ensurePaletteSize([], count || 0, fallbackPalette);
    }

    const overridePalette = readGroupPaletteOverrides(source, groupKey);
    if (overridePalette.length) {
      return ensurePaletteSize(overridePalette, count || overridePalette.length, fallbackPalette);
    }

    const groupPalettes = resolveGroupPalettes(source);
    const baseGroupPalette = Array.isArray(groupPalettes[groupKey])
      ? sanitizeGroupPalette(
          groupPalettes[groupKey],
          GROUP_SLOT_COUNTS[groupKey] || MAX_COLORS
        )
      : [];
    if (baseGroupPalette.length) {
      return ensurePaletteSize(baseGroupPalette, count || baseGroupPalette.length, fallbackPalette);
    }

    const palette = buildPalette(source, groupPalettes);
    const groupIndices = collectGroupIndices(groupKey);
    const colors = [];
    if (groupIndices.length) {
      groupIndices.forEach(index => {
        const color = palette[index];
        if (typeof color === 'string' && color) {
          colors.push(color);
        } else {
          const fallback = fallbackPalette[index % fallbackPalette.length];
          colors.push(fallback);
        }
      });
    }

    if (!colors.length) {
      warnMissingGroupConfiguration(groupKey);
    }

    const targetCount = count || (colors.length ? colors.length : groupIndices.length || 1);
    return ensurePaletteSize(colors, targetCount, fallbackPalette);
  }

  function getProjectGroupPalettes(projectName, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const source = resolveSettingsSource(opts.settings);
    const groupPalettes = resolveGroupPalettes(source);
    return cloneGroupPalettes(groupPalettes);
  }

  function getProjectPalette(projectName, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const source = resolveSettingsSource(opts.settings);
    const groupPalettes = resolveGroupPalettes(source);
    return buildPalette(source, groupPalettes);
  }

  const api = {
    getGroupPalette,
    getProjectGroupPalettes,
    getProjectPalette
  };

  if (typeof global !== 'undefined' && global && typeof global === 'object') {
    global.MathVisualsPalette = api;
  }
  if (typeof window !== 'undefined' && window && typeof window === 'object') {
    window.MathVisualsPalette = api;
  }
  if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis === 'object') {
    globalThis.MathVisualsPalette = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
