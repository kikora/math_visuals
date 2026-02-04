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
    const fallbacks = factory();
    if (target && typeof target === 'object' && fallbacks) {
      target.MathVisualsPaletteFallbacks = fallbacks;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  const SETTINGS_DEFAULT = [
    '#DC6A4B',
    '#6B1F0B',
    '#C14F30',
    '#528BFF',
    '#002266',
    '#155EEF',
    '#4F9566',
    '#000000',
    '#027A48',
    '#13A2B6',
    '#04343A',
    '#B8325D',
    '#DC5D85',
    '#400115',
    '#B8325D',
    '#9780C0',
    '#190A35',
    '#674D96'
  ];
  const LEGACY_SETTINGS_DEFAULT = [
    '#1F4DE2',
    '#475569',
    '#EF4444',
    '#0EA5E9',
    '#10B981',
    '#F59E0B',
    '#6366F1',
    '#D946EF',
    '#F97316',
    '#14B8A6',
    '#22C55E',
    '#EAB308',
    '#EC4899',
    '#8B5CF6',
    '#0EA5A5',
    '#2563EB',
    '#FACC15',
    '#F87171'
  ];
  const LEGACY_FRACTION_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D'];
  const TENKEBLOKKER_FRACTION_PALETTE = ['#dbe7ff', '#c7d2fe', '#fcd34d', '#a7f3d0', '#fde68a', '#fbcfe8'];
  const SORTERING_FALLBACK_PALETTE = ['#ffffff', '#000000', '#000000'];
  const GRAFTEGNER_INDEX_MAP = [2, 5, 8, 11, 14, 17];
  const GRAFTEGNER_FALLBACK_PALETTE = GRAFTEGNER_INDEX_MAP.map(index => SETTINGS_DEFAULT[index]).filter(Boolean);

  function deepFreeze(value) {
    if (!value || typeof value !== 'object') {
      return value;
    }
    Object.getOwnPropertyNames(value).forEach(key => {
      const property = value[key];
      if (property && typeof property === 'object' && !Object.isFrozen(property)) {
        deepFreeze(property);
      }
    });
    return Object.freeze(value);
  }

  return deepFreeze({
    /**
     * settingsDefault: nåværende standardpalett for innstillinger.
     * legacy: historiske paletter som fortsatt brukes for bakoverkompatibilitet.
     */
    settingsDefault: SETTINGS_DEFAULT.slice(),
    settingsDefaultDerived: {
      graftegner: GRAFTEGNER_FALLBACK_PALETTE.slice()
    },
    legacy: {
      settingsDefault: LEGACY_SETTINGS_DEFAULT.slice(),
      nkant: LEGACY_SETTINGS_DEFAULT.slice(0, 6),
      fractions: LEGACY_FRACTION_PALETTE.slice(),
      tenkeblokkerFractions: TENKEBLOKKER_FRACTION_PALETTE.slice(),
      sortering: SORTERING_FALLBACK_PALETTE.slice()
    }
  });
});
