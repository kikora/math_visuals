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
  const DEFAULT_PROJECT = 'default';
  const PROJECT_FALLBACKS = {
    default: [
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
    ]
  };
  const RAW_COLOR_SLOT_GROUPS = [
    {
      groupId: 'graftegner',
      title: 'Felles farger',
      description:
        'Farger som brukes av graftegner, diagram, brøksirkler, brøkfigurer, tallfigurer, kvikkbilder, tenkeblokker, brøkvegg og 3D-figurer.',
      colorRoles: [
        { fillIndex: 0, lineIndex: 1 },
        { fillIndex: 3, lineIndex: 4 },
        { fillIndex: 6, lineIndex: 7 },
        { fillIndex: 9, lineIndex: 10 },
        { fillIndex: 12, lineIndex: 13 },
        { fillIndex: 15, lineIndex: 16 },
        { lineIndex: 2 },
        { lineIndex: 5 },
        { lineIndex: 8 },
        { lineIndex: 11 },
        { lineIndex: 14 },
        { lineIndex: 17 }
      ],
      slots: [
        { index: 0, label: 'Fyll 1', description: 'Fyllfarge til fargesett 1.' },
        { index: 1, label: 'Kant 1', description: 'Kantfarge til fargesett 1.' },
        { index: 2, label: 'Linje 1', description: 'Linjefarge for grafer i fargesett 1.' },
        { index: 3, label: 'Fyll 2', description: 'Fyllfarge til fargesett 2.' },
        { index: 4, label: 'Kant 2', description: 'Kantfarge til fargesett 2.' },
        { index: 5, label: 'Linje 2', description: 'Linjefarge for grafer i fargesett 2.' },
        { index: 6, label: 'Fyll 3', description: 'Fyllfarge til fargesett 3.' },
        { index: 7, label: 'Kant 3', description: 'Kantfarge til fargesett 3.' },
        { index: 8, label: 'Linje 3', description: 'Linjefarge for grafer i fargesett 3.' },
        { index: 9, label: 'Fyll 4', description: 'Fyllfarge til fargesett 4.' },
        { index: 10, label: 'Kant 4', description: 'Kantfarge til fargesett 4.' },
        { index: 11, label: 'Linje 4', description: 'Linjefarge for grafer i fargesett 4.' },
        { index: 12, label: 'Fyll 5', description: 'Fyllfarge til fargesett 5.' },
        { index: 13, label: 'Kant 5', description: 'Kantfarge til fargesett 5.' },
        { index: 14, label: 'Linje 5', description: 'Linjefarge for grafer i fargesett 5.' },
        { index: 15, label: 'Fyll 6', description: 'Fyllfarge til fargesett 6.' },
        { index: 16, label: 'Kant 6', description: 'Kantfarge til fargesett 6.' },
        { index: 17, label: 'Linje 6', description: 'Linjefarge for grafer i fargesett 6.' }
      ]
    },
    {
      groupId: 'nkant',
      title: 'nKant',
      description: 'Farger for kanter, vinkler og fyll i nKant.',
      slots: [
        { index: 30, label: 'Fyll 1', description: 'Fyllfarge til fargesett 1.' },
        { index: 31, label: 'Kant 1', description: 'Kantfarge til fargesett 1.' },
        { index: 32, label: 'Vinkel 1', description: 'Vinkelfarge til fargesett 1.' },
        { index: 33, label: 'Fyll 2', description: 'Fyllfarge til fargesett 2.' },
        { index: 34, label: 'Kant 2', description: 'Kantfarge til fargesett 2.' },
        { index: 35, label: 'Vinkel 2', description: 'Vinkelfarge til fargesett 2.' },
        { index: 36, label: 'Fyll 3', description: 'Fyllfarge til fargesett 3.' },
        { index: 37, label: 'Kant 3', description: 'Kantfarge til fargesett 3.' },
        { index: 38, label: 'Vinkel 3', description: 'Vinkelfarge til fargesett 3.' }
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

  function cloneColorRoles(colorRoles) {
    if (!Array.isArray(colorRoles)) return [];
    return colorRoles
      .map(role => {
        if (!role || typeof role !== 'object') return null;
        const fillIndex = Number.isInteger(role.fillIndex) ? Number(role.fillIndex) : null;
        const lineIndex = Number.isInteger(role.lineIndex) ? Number(role.lineIndex) : null;
        if (!Number.isInteger(fillIndex) && !Number.isInteger(lineIndex)) return null;
        return {
          fillIndex: Number.isInteger(fillIndex) && fillIndex >= 0 ? fillIndex : undefined,
          lineIndex: Number.isInteger(lineIndex) && lineIndex >= 0 ? lineIndex : undefined
        };
      })
      .filter(role => role && (Number.isInteger(role.fillIndex) || Number.isInteger(role.lineIndex)));
  }

  const COLOR_SLOT_GROUPS = deepFreeze(
    RAW_COLOR_SLOT_GROUPS.map((group, groupIndex) => {
      const normalizedId =
        group && typeof group.groupId === 'string' ? group.groupId.trim().toLowerCase() : `gruppe-${groupIndex + 1}`;
      const groupId = normalizedId || `gruppe-${groupIndex + 1}`;
      const slots = cloneSlots(group && group.slots, groupId);
      const colorRoles = cloneColorRoles(group && group.colorRoles);
      return deepFreeze({
        groupId,
        title: group && group.title ? String(group.title) : '',
        description: group && group.description ? String(group.description) : '',
        slots,
        colorRoles,
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
  const DEFAULT_PROJECT_ORDER = deepFreeze(['default']);

  return deepFreeze({
    MAX_COLORS,
    DEFAULT_PROJECT,
    PROJECT_FALLBACKS: deepFreeze({
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
