(function (root) {
  const resolverApi = createPaletteResolver();
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = resolverApi;
  }
  if (root && typeof root === 'object') {
    root.MathVisualsPaletteResolver = resolverApi;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);

function createPaletteResolver() {
  const paletteConfig = resolvePaletteConfig();
  const paletteGroups = paletteConfig && Array.isArray(paletteConfig.COLOR_SLOT_GROUPS)
    ? paletteConfig.COLOR_SLOT_GROUPS
    : [];

  /**
   * Resolve palette entries for a group using the following fallback order:
   * 1) window.MathVisualsSettings.getGroupPalette(groupId, options)
   * 2) window.MathVisualsPalette.getGroupPalette(groupId, options)
   * 3) palette-service-client resolveGroupPalette({ groupId, ...options })
   *
   * Count handling:
   * - Uses options.count when it is a positive number.
   * - Otherwise uses the palette config group slot count when known.
   * - Otherwise falls back to the length of options.fallback (if any).
   */
  function resolveGroupPalette(groupId, options = {}) {
    const resolvedOptions = groupId && typeof groupId === 'object' ? groupId : options;
    const resolvedGroupId = groupId && typeof groupId === 'object' ? groupId.groupId : groupId;
    const opts = resolvedOptions && typeof resolvedOptions === 'object' ? resolvedOptions : {};
    const normalizedGroupId = typeof resolvedGroupId === 'string' ? resolvedGroupId.trim().toLowerCase() : '';
    const groupMeta = resolveGroupMeta(paletteGroups, normalizedGroupId);
    const fallback = Array.isArray(opts.fallback) ? opts.fallback : [];
    const count = resolveCount(opts.count, groupMeta, fallback);
    const request = Object.assign({}, opts, {
      groupId: normalizedGroupId || resolvedGroupId,
      count
    });

    const settingsApi = resolveSettingsApi();
    const paletteApi = resolvePaletteApi();
    const paletteServiceClient = resolvePaletteServiceClient();
    let palette = null;

    if (settingsApi && typeof settingsApi.getGroupPalette === 'function') {
      palette = safeResolvePalette(() => settingsApi.getGroupPalette(request.groupId, request));
    }
    if (!palette && paletteApi && typeof paletteApi.getGroupPalette === 'function') {
      palette = safeResolvePalette(() => paletteApi.getGroupPalette(request.groupId, request));
    }
    if (!palette && paletteServiceClient && paletteServiceClient.paletteService) {
      palette = safeResolvePalette(() => paletteServiceClient.paletteService.resolveGroupPalette(request));
    }

    const normalized = normalizePaletteEntry(groupMeta, palette);
    const ensure = paletteServiceClient && typeof paletteServiceClient.ensurePalette === 'function'
      ? paletteServiceClient.ensurePalette
      : fallbackEnsurePalette;
    return ensure(normalized, fallback, count);
  }

  return {
    resolveGroupPalette
  };
}

function resolvePaletteConfig() {
  if (typeof MathVisualsPaletteConfig !== 'undefined' && MathVisualsPaletteConfig) {
    return MathVisualsPaletteConfig;
  }
  if (typeof globalThis !== 'undefined' && globalThis.MathVisualsPaletteConfig) {
    return globalThis.MathVisualsPaletteConfig;
  }
  if (typeof window !== 'undefined' && window.MathVisualsPaletteConfig) {
    return window.MathVisualsPaletteConfig;
  }
  if (typeof global !== 'undefined' && global.MathVisualsPaletteConfig) {
    return global.MathVisualsPaletteConfig;
  }
  if (typeof require === 'function') {
    try {
      return require('./palette-config.js');
    } catch (_) {}
  }
  return null;
}

function resolveSettingsApi() {
  if (typeof window !== 'undefined' && window.MathVisualsSettings) {
    return window.MathVisualsSettings;
  }
  if (typeof globalThis !== 'undefined' && globalThis.MathVisualsSettings) {
    return globalThis.MathVisualsSettings;
  }
  if (typeof global !== 'undefined' && global.MathVisualsSettings) {
    return global.MathVisualsSettings;
  }
  return null;
}

function resolvePaletteApi() {
  if (typeof window !== 'undefined' && window.MathVisualsPalette) {
    return window.MathVisualsPalette;
  }
  if (typeof globalThis !== 'undefined' && globalThis.MathVisualsPalette) {
    return globalThis.MathVisualsPalette;
  }
  if (typeof global !== 'undefined' && global.MathVisualsPalette) {
    return global.MathVisualsPalette;
  }
  return null;
}

function resolvePaletteServiceClient() {
  if (typeof MathVisualsPaletteServiceClient !== 'undefined' && MathVisualsPaletteServiceClient) {
    return MathVisualsPaletteServiceClient;
  }
  if (typeof globalThis !== 'undefined' && globalThis.MathVisualsPaletteServiceClient) {
    return globalThis.MathVisualsPaletteServiceClient;
  }
  if (typeof window !== 'undefined' && window.MathVisualsPaletteServiceClient) {
    return window.MathVisualsPaletteServiceClient;
  }
  if (typeof global !== 'undefined' && global.MathVisualsPaletteServiceClient) {
    return global.MathVisualsPaletteServiceClient;
  }
  if (typeof require === 'function') {
    try {
      return require('./palette-service-client.js');
    } catch (_) {}
  }
  return null;
}

function resolveGroupMeta(groups, groupId) {
  if (!groupId || !Array.isArray(groups)) return null;
  return groups.find(group => group && group.groupId === groupId) || null;
}

function resolveCount(countValue, groupMeta, fallback) {
  if (Number.isFinite(countValue) && countValue > 0) {
    return Math.trunc(countValue);
  }
  if (groupMeta && Array.isArray(groupMeta.slots) && groupMeta.slots.length > 0) {
    return groupMeta.slots.length;
  }
  if (Array.isArray(fallback) && fallback.length) {
    return fallback.length;
  }
  return undefined;
}

function safeResolvePalette(resolveFn) {
  try {
    const result = resolveFn();
    return result || null;
  } catch (_) {
    return null;
  }
}

function normalizePaletteEntry(groupMeta, entry) {
  return resolveGroupPaletteEntry(groupMeta, entry);
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
    hex = hex
      .split('')
      .slice(0, 3)
      .map(ch => ch + ch)
      .join('');
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
    }
  }
  return out;
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
  if (!slot || typeof slot !== 'object') return '';
  const explicitRole = normalizeRoleKey(
    slot.role || slot.roleKey || slot.roleId || slot.colorRole || slot.kind || slot.type || ''
  );
  if (explicitRole) return explicitRole;
  const label = typeof slot.label === 'string' ? slot.label.trim().toLowerCase() : '';
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
  return group.slots.map((slot, slotIndex) => {
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
    if (Object.keys(roleLists).length && group && Array.isArray(group.slots)) {
      return buildRolePaletteSlots(group, roleLists, flat);
    }
    if (flat && flat.length) {
      return flat;
    }
  }
  return [];
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
