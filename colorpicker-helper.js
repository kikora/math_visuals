(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module && module.exports) {
    module.exports = factory();
  } else {
    const target =
      root ||
      (typeof globalThis !== 'undefined'
        ? globalThis
        : typeof self !== 'undefined'
        ? self
        : typeof window !== 'undefined'
        ? window
        : this);
    const helper = factory();
    if (target && typeof target === 'object' && helper) {
      target.MathVisualsColorPickerHelper = helper;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_FILL = '#ffffff';
  const DEFAULT_LINE = '#000000';

  function normalizeIndex(value, max) {
    const numeric = Number.parseInt(value, 10);
    if (!Number.isFinite(numeric) || numeric < 1) return 1;
    if (!Number.isFinite(max) || max <= 0) return numeric;
    return Math.min(numeric, max);
  }

  function resolvePaletteColor(palette, index, fallback) {
    const list = Array.isArray(palette) ? palette : [];
    const safeIndex = normalizeIndex(index, list.length);
    return list[safeIndex - 1] || list[0] || fallback || null;
  }

  function applyColorPairSwatch(element, fillColor, lineColor) {
    if (!element) return;
    if (element.classList) {
      element.classList.add('color-swatch--pair');
    }
    if (typeof fillColor === 'string' && fillColor) {
      element.style.setProperty('--swatch-fill', fillColor);
    }
    if (typeof lineColor === 'string' && lineColor) {
      element.style.setProperty('--swatch-line', lineColor);
    }
  }

  function renderColorPairSwatch(options) {
    if (!options || !options.element) return null;
    const fillColors = Array.isArray(options.fillColors) ? options.fillColors : [];
    const lineColors = Array.isArray(options.lineColors) ? options.lineColors : [];
    const fillIndex = normalizeIndex(options.fillIndex, fillColors.length);
    const lineIndex = normalizeIndex(options.lineIndex, lineColors.length);
    const fillColor = resolvePaletteColor(fillColors, fillIndex, options.fallbackFill || DEFAULT_FILL);
    const lineColor = resolvePaletteColor(lineColors, lineIndex, options.fallbackLine || DEFAULT_LINE);
    applyColorPairSwatch(options.element, fillColor, lineColor);
    return {
      fillColor,
      lineColor,
      fillIndex,
      lineIndex
    };
  }

  function normalizeGroupId(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().toLowerCase();
    return trimmed || '';
  }

  function buildSequentialPairs(pairCount) {
    const total = Number.isFinite(pairCount) && pairCount > 0 ? Math.trunc(pairCount) : 0;
    const pairs = [];
    for (let index = 0; index < total; index += 1) {
      pairs.push({
        fillSlotIndex: index * 2,
        lineSlotIndex: index * 2 + 1
      });
    }
    return pairs;
  }

  function resolveRoleSlotPairs(config, groupId, fallbackRoles = []) {
    const normalizedGroupId = normalizeGroupId(groupId);
    const fallbackPairCount = Array.isArray(fallbackRoles) ? fallbackRoles.length : 0;
    const fallbackPairs = buildSequentialPairs(fallbackPairCount);
    if (!config || !normalizedGroupId || !Array.isArray(config.COLOR_SLOT_GROUPS)) {
      return fallbackPairs;
    }
    const group = config.COLOR_SLOT_GROUPS.find(entry => {
      const entryId = normalizeGroupId(entry && entry.groupId);
      return entryId === normalizedGroupId;
    });
    if (!group || typeof group !== 'object') {
      return fallbackPairs;
    }
    const slots = Array.isArray(group.slots) ? group.slots : [];
    const slotIndexByPaletteIndex = new Map();
    slots.forEach((slot, index) => {
      if (!slot || typeof slot !== 'object') return;
      const paletteIndex = Number.isInteger(slot.index) ? slot.index : null;
      const slotIndex = Number.isInteger(slot.groupIndex) ? slot.groupIndex : index;
      if (Number.isInteger(paletteIndex) && paletteIndex >= 0) {
        slotIndexByPaletteIndex.set(paletteIndex, slotIndex);
      }
    });
    const roleSource = Array.isArray(group.colorRoles) && group.colorRoles.length
      ? group.colorRoles
      : Array.isArray(fallbackRoles)
      ? fallbackRoles
      : [];
    const pairs = [];
    if (roleSource.length) {
      roleSource.forEach(role => {
        if (!role || typeof role !== 'object') return;
        const fillIndex = Number.isInteger(role.fillIndex) ? role.fillIndex : null;
        const lineIndex = Number.isInteger(role.lineIndex) ? role.lineIndex : null;
        const fillSlotIndex = fillIndex !== null ? slotIndexByPaletteIndex.get(fillIndex) : undefined;
        const lineSlotIndex = lineIndex !== null ? slotIndexByPaletteIndex.get(lineIndex) : undefined;
        if (Number.isInteger(fillSlotIndex) && Number.isInteger(lineSlotIndex)) {
          pairs.push({
            fillSlotIndex,
            lineSlotIndex,
            fillIndex,
            lineIndex
          });
        }
      });
    }
    if (pairs.length) {
      return pairs;
    }
    if (slots.length >= 2) {
      return buildSequentialPairs(Math.floor(slots.length / 2));
    }
    return fallbackPairs;
  }

  return {
    applyColorPairSwatch,
    renderColorPairSwatch,
    resolveRoleSlotPairs,
    resolvePaletteColor,
    normalizeIndex
  };
});
