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
      target.MathVisualsColorPickerAdapter = helper;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_LABEL_PREFIX = 'Velg farge';
  const DEFAULT_COLOR = '#000000';

  function resolveRoleMapping(roleMapping) {
    if (roleMapping && typeof roleMapping === 'object' && !Array.isArray(roleMapping)) {
      return {
        fillKey: roleMapping.fillKey || roleMapping.fill || 'fillColors',
        lineKey: roleMapping.lineKey || roleMapping.line || 'lineColors',
        labelPrefix: roleMapping.labelPrefix || roleMapping.label || DEFAULT_LABEL_PREFIX
      };
    }
    return {
      fillKey: 'fillColors',
      lineKey: 'lineColors',
      labelPrefix: DEFAULT_LABEL_PREFIX
    };
  }

  function buildSlotsFromPalette(palette, roleMapping) {
    if (!palette) return [];
    if (roleMapping && typeof roleMapping.buildSlots === 'function') {
      const customSlots = roleMapping.buildSlots(palette);
      return Array.isArray(customSlots) ? customSlots : [];
    }
    if (typeof roleMapping === 'function') {
      const customSlots = roleMapping(palette);
      return Array.isArray(customSlots) ? customSlots : [];
    }
    if (Array.isArray(palette.slots)) {
      return palette.slots;
    }
    const mapping = resolveRoleMapping(roleMapping);
    const labelPrefix = mapping.labelPrefix;
    if (Array.isArray(palette)) {
      return palette.map((color, index) => ({
        value: index + 1,
        label: `${labelPrefix} ${index + 1}`,
        color,
        fillColor: color,
        lineColor: color
      }));
    }
    const fillColors = Array.isArray(palette[mapping.fillKey]) ? palette[mapping.fillKey] : [];
    const lineColors = Array.isArray(palette[mapping.lineKey]) ? palette[mapping.lineKey] : [];
    const base = fillColors.length ? fillColors : lineColors;
    if (!base.length) return [];
    const fallbackFill = fillColors[0] || lineColors[0] || DEFAULT_COLOR;
    const fallbackLine = lineColors[0] || fillColors[0] || DEFAULT_COLOR;
    return base.map((color, index) => ({
      value: index + 1,
      label: `${labelPrefix} ${index + 1}`,
      fillColor: fillColors[index] || fallbackFill,
      lineColor: lineColors[index] || fallbackLine,
      color: fillColors[index] || lineColors[index] || fallbackFill
    }));
  }

  function syncColorPicker(config = {}) {
    const element = config.element || config.picker;
    const module = config.module;
    const instance = config.instance;
    if (!element || !module || typeof module.createColorPicker !== 'function') {
      return instance || null;
    }
    const slots = buildSlotsFromPalette(config.palette, config.roleMapping);
    const payload = {
      slots,
      renderStyle: config.renderStyle,
      onSelect: config.onSelect,
      getActiveValue: config.getActiveValue,
      layout: config.layout
    };
    if (instance && typeof instance.update === 'function') {
      instance.update(payload);
      return instance;
    }
    return module.createColorPicker({ element, ...payload }) || instance || null;
  }

  return {
    buildSlotsFromPalette,
    syncColorPicker
  };
});
