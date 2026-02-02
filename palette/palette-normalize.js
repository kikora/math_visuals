(function (root, factory) {
  const result = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = result;
  }
  if (root && typeof root === 'object') {
    if (!root.MathVisualsPaletteNormalize) {
      root.MathVisualsPaletteNormalize = result;
    } else {
      const target = root.MathVisualsPaletteNormalize;
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
  /**
   * Palette normalisering: group entries kan være enten en flat liste av farger
   * (array) eller en rolle-payload med lister for fills/edges/lines/angles.
   * Funksjonene returnerer enten en slot-basert fargeliste for en gruppe
   * eller en rolle-payload (for sending/lagring).
   */
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

  function collectRoleLists(entry, options = {}) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return {};
    const normalizeKey = options.normalizeRoleKey || normalizeRoleKey;
    const sanitize = options.sanitizeColorList;
    const roles = {};
    Object.keys(entry).forEach(key => {
      const roleKey = normalizeKey(key);
      if (!roleKey) return;
      const values = typeof sanitize === 'function'
        ? sanitize(entry[key], options.maxColors)
        : Array.isArray(entry[key])
        ? entry[key].slice()
        : [];
      if (values.length) {
        roles[roleKey] = values;
      }
    });
    return roles;
  }

  function buildRolePaletteSlots(group, roleLists, fallbackList, options = {}) {
    const resolveRole = options.resolveSlotRole || resolveSlotRole;
    const slotRoles = {};
    const fallback = Array.isArray(fallbackList) ? fallbackList : [];
    return group.slots.map((slot, slotIndex) => {
      const roleKey = resolveRole(slot);
      if (roleKey && Array.isArray(roleLists[roleKey])) {
        const position = Number.isInteger(slotRoles[roleKey]) ? slotRoles[roleKey] : 0;
        const color = roleLists[roleKey][position];
        slotRoles[roleKey] = position + 1;
        if (color) return color;
      }
      return fallback[slotIndex];
    });
  }

  function resolveGroupPaletteEntry(group, entry, options = {}) {
    if (Array.isArray(entry)) return entry;
    if (entry && typeof entry === 'object') {
      const roleLists = collectRoleLists(entry, options);
      const flat = (options.extractFlatPalette || extractFlatPalette)(entry);
      if (Object.keys(roleLists).length) {
        return buildRolePaletteSlots(group, roleLists, flat, options);
      }
      if (flat && flat.length) {
        return flat;
      }
    }
    return [];
  }

  function buildRolePayloadForGroup(group, colors, options = {}) {
    const resolveRole = options.resolveSlotRole || resolveSlotRole;
    const sanitize = options.sanitizeColorList;
    const lists = {};
    let hasRoles = false;
    let hasUnmatched = false;
    group.slots.forEach((slot, slotIndex) => {
      const roleKey = resolveRole(slot);
      const color = colors[slotIndex];
      if (roleKey) {
        hasRoles = true;
        if (!lists[roleKey]) {
          lists[roleKey] = [];
        }
        lists[roleKey].push(color);
      } else if (color) {
        hasUnmatched = true;
      }
    });
    if (!hasRoles || hasUnmatched) return null;
    Object.keys(lists).forEach(key => {
      const values = typeof sanitize === 'function'
        ? sanitize(lists[key], options.maxColors)
        : Array.isArray(lists[key])
        ? lists[key].slice()
        : [];
      if (values.length) {
        lists[key] = values;
      } else {
        delete lists[key];
      }
    });
    return Object.keys(lists).length ? lists : null;
  }

  function ensureProjectPaletteShape(palette, groups, options = {}) {
    const shaped = {};
    const source = palette && typeof palette === 'object' ? palette : {};
    (Array.isArray(groups) ? groups : []).forEach(group => {
      if (!group || !group.groupId) return;
      const entry = source[group.groupId];
      shaped[group.groupId] = Array.isArray(entry)
        ? entry
        : resolveGroupPaletteEntry(group, entry, options);
    });
    return shaped;
  }

  function normalizeProjectPalette(project, palette, options = {}) {
    const normalizeProjectName = options.normalizeProjectName;
    const sanitizeProjectPalette = options.sanitizeProjectPalette;
    const convertLegacyPalette = options.convertLegacyPalette;
    const getProjectFallbackPalette = options.getProjectFallbackPalette;
    const normalized = typeof normalizeProjectName === 'function'
      ? normalizeProjectName(project)
      : project;
    if (Array.isArray(palette)) {
      if (typeof sanitizeProjectPalette === 'function') {
        const converted = typeof convertLegacyPalette === 'function'
          ? convertLegacyPalette(normalized, palette)
          : palette;
        return sanitizeProjectPalette(normalized, converted);
      }
      return palette;
    }
    if (palette && typeof palette === 'object') {
      return typeof sanitizeProjectPalette === 'function'
        ? sanitizeProjectPalette(normalized, palette)
        : palette;
    }
    if (typeof getProjectFallbackPalette === 'function') {
      return getProjectFallbackPalette(normalized);
    }
    return {};
  }

  return {
    normalizeRoleKey,
    resolveSlotRole,
    extractFlatPalette,
    collectRoleLists,
    buildRolePaletteSlots,
    resolveGroupPaletteEntry,
    buildRolePayloadForGroup,
    ensureProjectPaletteShape,
    normalizeProjectPalette
  };
});
