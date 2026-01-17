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
    const config = factory();
    if (target && typeof target === 'object' && config) {
      target.MathVisualsPaletteConfig = config;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  const paletteModule = loadPalettePackage();
  if (paletteModule && paletteModule.PALETTE_CONFIG) {
    return paletteModule.PALETTE_CONFIG;
  }
  if (paletteModule && paletteModule.default && paletteModule.default.PALETTE_CONFIG) {
    return paletteModule.default.PALETTE_CONFIG;
  }
  if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
    console.error('[MathVisualsPaletteConfig] Klarte ikke laste palettpakken. Bruker innebygd reserve.');
  }
  return buildLegacyPaletteConfig();
});

var paletteConfigAttemptedGlobalLoad = false;

function resolveGlobalPackage() {
  if (typeof MathVisualsPalettePackage !== 'undefined' && MathVisualsPalettePackage) {
    return MathVisualsPalettePackage;
  }
  if (typeof globalThis !== 'undefined' && globalThis.MathVisualsPalettePackage) {
    return globalThis.MathVisualsPalettePackage;
  }
  if (typeof window !== 'undefined' && window.MathVisualsPalettePackage) {
    return window.MathVisualsPalettePackage;
  }
  if (typeof global !== 'undefined' && global.MathVisualsPalettePackage) {
    return global.MathVisualsPalettePackage;
  }
  return null;
}

function tryLoadGlobalBundle(currentScript) {
  if (paletteConfigAttemptedGlobalLoad) return resolveGlobalPackage();
  paletteConfigAttemptedGlobalLoad = true;
  if (typeof document === 'undefined' || typeof XMLHttpRequest === 'undefined') {
    return resolveGlobalPackage();
  }
  const scriptUrl = currentScript && currentScript.src ? currentScript.src : document.currentScript && document.currentScript.src;
  if (!scriptUrl) {
    return resolveGlobalPackage();
  }
  let bundleUrl = null;
  try {
    bundleUrl = new URL('../packages/palette/dist/index.global.js', scriptUrl).toString();
  } catch (_) {
    return resolveGlobalPackage();
  }
  try {
    const request = new XMLHttpRequest();
    request.open('GET', bundleUrl, false);
    request.send(null);
    if (request.status >= 200 && request.status < 400) {
      const source = request.responseText;
      if (typeof source === 'string' && source) {
        (0, eval)(source);
      }
    }
  } catch (_) {}
  return resolveGlobalPackage();
}

function loadPalettePackage() {
  let palettePackage = resolveGlobalPackage();
  if (!palettePackage) {
    palettePackage = tryLoadGlobalBundle(null);
  }
  if (!palettePackage && typeof require === 'function') {
    try {
      palettePackage = require('../packages/palette/dist/index.cjs');
    } catch (error) {
      if (!error || error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') {
        try {
          palettePackage = require('../packages/palette/src/index.js');
        } catch (_) {}
      } else {
        throw error;
      }
    }
  }
  return palettePackage || null;
}

function buildLegacyPaletteConfig() {
  const MAX_COLORS = 49;
  const DEFAULT_PROJECT = 'campus';
  const PROJECT_FALLBACKS = {
    campus: [
      '#DC6A4B',
      '#6B1F0B',
      '#528BFF',
      '#002266',
      '#4F9566',
      '#000000',
      '#13A2B6',
      '#04343A',
      '#DC5D85',
      '#400115',
      '#9780C0',
      '#190A35'
    ],
    annet: [
      '#DC6A4B',
      '#6B1F0B',
      '#528BFF',
      '#002266',
      '#4F9566',
      '#000000',
      '#13A2B6',
      '#04343A',
      '#DC5D85',
      '#400115',
      '#9780C0',
      '#190A35'
    ],
    kikora: [
      '#DC6A4B',
      '#6B1F0B',
      '#528BFF',
      '#002266',
      '#4F9566',
      '#000000',
      '#13A2B6',
      '#04343A',
      '#DC5D85',
      '#400115',
      '#9780C0',
      '#190A35'
    ],
    default: [
      '#DC6A4B',
      '#6B1F0B',
      '#528BFF',
      '#002266',
      '#4F9566',
      '#000000',
      '#13A2B6',
      '#04343A',
      '#DC5D85',
      '#400115',
      '#9780C0',
      '#190A35'
    ]
  };
  const RAW_COLOR_SLOT_GROUPS = [
    {
      groupId: 'graftegner',
      title: 'Felles farger',
      description:
        'Farger som brukes av graftegner, diagram, brøksirkler, brøkfigurer, tallfigurer, kvikkbilder, tenkeblokker, brøkvegg og 3D-figurer.',
      slots: [
        { index: 5, label: 'Fyll 1', description: 'Fyllfarge til linje 1.' },
        { index: 4, label: 'Linje 1', description: 'Linjefarge til fyll 1.' },
        { index: 7, label: 'Fyll 2', description: 'Fyllfarge til linje 2.' },
        { index: 6, label: 'Linje 2', description: 'Linjefarge til fyll 2.' },
        { index: 9, label: 'Fyll 3', description: 'Fyllfarge til linje 3.' },
        { index: 8, label: 'Linje 3', description: 'Linjefarge til fyll 3.' },
        { index: 10, label: 'Fyll 4', description: 'Fyllfarge til linje 4.' },
        { index: 11, label: 'Linje 4', description: 'Linjefarge til fyll 4.' },
        { index: 12, label: 'Fyll 5', description: 'Fyllfarge til linje 5.' },
        { index: 13, label: 'Linje 5', description: 'Linjefarge til fyll 5.' },
        { index: 14, label: 'Fyll 6', description: 'Fyllfarge til linje 6.' },
        { index: 15, label: 'Linje 6', description: 'Linjefarge til fyll 6.' }
      ]
    },
    {
      groupId: 'nkant',
      title: 'nKant',
      description: 'Farger for linjer, vinkler og fyll i nKant.',
      slots: [
        { index: 1, label: 'Fyll 1', description: 'Fyllfarge til fargesett 1.' },
        { index: 2, label: 'Linje 1', description: 'Linjefarge til fargesett 1.' },
        { index: 3, label: 'Vinkel 1', description: 'Vinkelfarge til fargesett 1.' },
        { index: 4, label: 'Fyll 2', description: 'Fyllfarge til fargesett 2.' },
        { index: 5, label: 'Linje 2', description: 'Linjefarge til fargesett 2.' },
        { index: 6, label: 'Vinkel 2', description: 'Vinkelfarge til fargesett 2.' },
        { index: 7, label: 'Fyll 3', description: 'Fyllfarge til fargesett 3.' },
        { index: 8, label: 'Linje 3', description: 'Linjefarge til fargesett 3.' },
        { index: 9, label: 'Vinkel 3', description: 'Vinkelfarge til fargesett 3.' },
        { index: 10, label: 'Fyll 4', description: 'Fyllfarge til fargesett 4.' },
        { index: 11, label: 'Linje 4', description: 'Linjefarge til fargesett 4.' },
        { index: 12, label: 'Vinkel 4', description: 'Vinkelfarge til fargesett 4.' },
        { index: 13, label: 'Fyll 5', description: 'Fyllfarge til fargesett 5.' },
        { index: 14, label: 'Linje 5', description: 'Linjefarge til fargesett 5.' },
        { index: 15, label: 'Vinkel 5', description: 'Vinkelfarge til fargesett 5.' },
        { index: 16, label: 'Fyll 6', description: 'Fyllfarge til fargesett 6.' },
        { index: 17, label: 'Linje 6', description: 'Linjefarge til fargesett 6.' },
        { index: 18, label: 'Vinkel 6', description: 'Vinkelfarge til fargesett 6.' }
      ]
    },
    {
      groupId: 'arealmodell',
      title: 'Arealmodell',
      description: 'Farger for rutene i arealmodellen.',
      slots: [
        { index: 21, label: 'Farge 1', description: 'Første rute i arealmodellen.' },
        { index: 22, label: 'Farge 2', description: 'Andre rute i arealmodellen.' },
        { index: 23, label: 'Farge 3', description: 'Tredje rute i arealmodellen.' },
        { index: 24, label: 'Farge 4', description: 'Fjerde rute i arealmodellen.' }
      ]
    }
  ];

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

  function cloneSlots(slots, groupId) {
    if (!Array.isArray(slots)) return [];
    return slots
      .map((slot, slotIndex) => {
        const index = Number.isInteger(slot && slot.index) ? Number(slot.index) : slotIndex;
        return {
          index: index < 0 ? slotIndex : index,
          label: slot && slot.label ? String(slot.label) : `Farge ${slotIndex + 1}`,
          description: slot && slot.description ? String(slot.description) : null,
          groupId,
          groupIndex: slotIndex
        };
      })
      .filter(slot => Number.isInteger(slot.index) && slot.index >= 0);
  }

  const COLOR_SLOT_GROUPS = deepFreeze(
    RAW_COLOR_SLOT_GROUPS.map((group, groupIndex) => {
      const normalizedId =
        group && typeof group.groupId === 'string' ? group.groupId.trim().toLowerCase() : `gruppe-${groupIndex + 1}`;
      const groupId = normalizedId || `gruppe-${groupIndex + 1}`;
      const slots = cloneSlots(group && group.slots, groupId);
      return deepFreeze({
        groupId,
        title: group && group.title ? String(group.title) : '',
        description: group && group.description ? String(group.description) : '',
        slots,
        groupIndex
      });
    })
  );

  const COLOR_GROUP_IDS = COLOR_SLOT_GROUPS.map(group => group.groupId);
  const GROUP_SLOT_INDICES = {};
  COLOR_SLOT_GROUPS.forEach(group => {
    GROUP_SLOT_INDICES[group.groupId] = group.slots.map(slot => slot.index);
  });
  const MIN_COLOR_SLOTS = COLOR_SLOT_GROUPS.reduce((total, group) => total + group.slots.length, 0);
  const DEFAULT_GROUP_ORDER = deepFreeze(COLOR_GROUP_IDS.slice());
  const DEFAULT_PROJECT_ORDER = deepFreeze(['campus', 'kikora', 'annet']);

  return deepFreeze({
    MAX_COLORS,
    DEFAULT_PROJECT,
    PROJECT_FALLBACKS: deepFreeze({
      campus: PROJECT_FALLBACKS.campus.slice(),
      annet: PROJECT_FALLBACKS.annet.slice(),
      kikora: PROJECT_FALLBACKS.kikora.slice(),
      default: PROJECT_FALLBACKS.default.slice()
    }),
    COLOR_SLOT_GROUPS,
    COLOR_GROUP_IDS,
    GROUP_SLOT_INDICES,
    MIN_COLOR_SLOTS,
    DEFAULT_GROUP_ORDER,
    DEFAULT_PROJECT_ORDER
  });
}
