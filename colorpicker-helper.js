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

  function resolveSlotRoleLabel(slot) {
    if (!slot || typeof slot !== 'object') return '';
    const label = typeof slot.label === 'string' ? slot.label.toLowerCase() : '';
    if (!label) return '';
    if (label.includes('fyll')) return 'fill';
    if (label.includes('linje') || label.includes('kant')) return 'line';
    return '';
  }

  function normalizeRoleType(value) {
    if (value && typeof value === 'object') {
      return normalizeRoleType(value.roleType || value.mode || value.kind);
    }
    if (typeof value !== 'string') return 'pair';
    const normalized = value.trim().toLowerCase();
    if (normalized === 'fill' || normalized === 'line') {
      return normalized;
    }
    return 'pair';
  }

  function buildSequentialRoles(roleCount, roleType) {
    const total = Number.isFinite(roleCount) && roleCount > 0 ? Math.trunc(roleCount) : 0;
    const roles = [];
    for (let index = 0; index < total; index += 1) {
      if (roleType === 'fill') {
        roles.push({ fillSlotIndex: index });
      } else if (roleType === 'line') {
        roles.push({ lineSlotIndex: index });
      } else {
        roles.push({
          fillSlotIndex: index * 2,
          lineSlotIndex: index * 2 + 1
        });
      }
    }
    return roles;
  }

  function resolveRoleSlotPairs(config, groupId, fallbackRoles = [], roleOptions = {}) {
    const normalizedGroupId = normalizeGroupId(groupId);
    const roleType = normalizeRoleType(roleOptions);
    const fallbackPairCount = Array.isArray(fallbackRoles) ? fallbackRoles.length : 0;
    const fallbackPairs = buildSequentialRoles(fallbackPairCount, roleType);
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
    let rolesToUse = roleSource;
    if (roleType === 'line') {
      const lineOnly = roleSource.filter(role => {
        if (!role || typeof role !== 'object') return false;
        const fillIndex = Number.isInteger(role.fillIndex) ? role.fillIndex : null;
        const lineIndex = Number.isInteger(role.lineIndex) ? role.lineIndex : null;
        return Number.isInteger(lineIndex) && !Number.isInteger(fillIndex);
      });
      if (lineOnly.length) {
        rolesToUse = lineOnly;
      }
    }
    const pairs = [];
    if (rolesToUse.length) {
      rolesToUse.forEach(role => {
        if (!role || typeof role !== 'object') return;
        const fillIndex = Number.isInteger(role.fillIndex) ? role.fillIndex : null;
        const lineIndex = Number.isInteger(role.lineIndex) ? role.lineIndex : null;
        const fillSlotIndex = fillIndex !== null ? slotIndexByPaletteIndex.get(fillIndex) : undefined;
        const lineSlotIndex = lineIndex !== null ? slotIndexByPaletteIndex.get(lineIndex) : undefined;
        if (roleType === 'fill') {
          if (Number.isInteger(fillSlotIndex)) {
            pairs.push({
              fillSlotIndex,
              fillIndex
            });
          }
          return;
        }
        if (roleType === 'line') {
          if (Number.isInteger(lineSlotIndex)) {
            pairs.push({
              lineSlotIndex,
              lineIndex
            });
          }
          return;
        }
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
    const labeledFills = [];
    const labeledLines = [];
    if (slots.length) {
      slots.forEach((slot, slotIndex) => {
        const role = resolveSlotRoleLabel(slot);
        if (role === 'fill') {
          labeledFills.push(slotIndex);
        } else if (role === 'line') {
          labeledLines.push(slotIndex);
        }
      });
    }
    if (roleType === 'fill' && labeledFills.length) {
      labeledFills.forEach(slotIndex => {
        pairs.push({ fillSlotIndex: slotIndex });
      });
      if (pairs.length) {
        return pairs;
      }
    }
    if (roleType === 'line' && labeledLines.length) {
      labeledLines.forEach(slotIndex => {
        pairs.push({ lineSlotIndex: slotIndex });
      });
      if (pairs.length) {
        return pairs;
      }
    }
    if (roleType === 'pair' && labeledFills.length && labeledLines.length) {
      const limit = Math.min(labeledFills.length, labeledLines.length);
      for (let index = 0; index < limit; index += 1) {
        pairs.push({
          fillSlotIndex: labeledFills[index],
          lineSlotIndex: labeledLines[index]
        });
      }
      if (pairs.length) {
        return pairs;
      }
    }
    if (roleType === 'pair' && slots.length >= 2) {
      return buildSequentialRoles(Math.floor(slots.length / 2), roleType);
    }
    if (roleType !== 'pair' && slots.length) {
      return buildSequentialRoles(slots.length, roleType);
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
