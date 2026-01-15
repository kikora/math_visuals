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
    campus: ['#DBE3FF', '#2C395B', '#E3B660', '#C5E5E9', '#F6E5BC', '#F1D0D9'],
    annet: ['#FCEDE4', '#355070', '#F3722C', '#43AA8B', '#577590', '#F9C74F'],
    kikora: ['#FF5C5C', '#FF9F1C', '#2EC4B6', '#3A86FF', '#8338EC', '#FFE066'],
    default: ['#1F4DE2', '#475569', '#EF4444', '#0EA5E9', '#10B981', '#F59E0B']
  };
  const RAW_COLOR_SLOT_GROUPS = [
    {
      groupId: 'graftegner',
      title: 'Graftegner',
      description: 'Standardfarger for nye grafer og koordinatsystem.',
      slots: [
        { index: 0, label: 'Graf 1', description: 'Standardfarge for første graf.' },
        { index: 46, label: 'Graf 2', description: 'Standardfarge for andre graf.' },
        { index: 47, label: 'Graf 3', description: 'Standardfarge for tredje graf.' }
      ]
    },
    {
      groupId: 'nkant',
      title: 'nKant',
      description: 'Farger for linjer, vinkler og fyll i nKant.',
      slots: [
        { index: 1, label: 'Linje', description: 'Kanter, diagonaler og hjelpelinjer.' },
        { index: 2, label: 'Vinkel', description: 'Markeringer og vinkelflater.' },
        { index: 3, label: 'Fyll', description: 'Utfylling av polygonflater.' }
      ]
    },
    {
      groupId: 'diagram',
      title: 'Diagram',
      description: 'Standardfarger for stolpe- og sektordiagram.',
      slots: [
        { index: 4, label: 'En stolpe', description: 'Når et stolpediagram har én dataserie.' },
        { index: 5, label: 'Stolpe1', description: 'Første dataserie i sammenlignende stolpediagram.' },
        { index: 6, label: 'Stolpe2', description: 'Andre dataserie i sammenlignende stolpediagram.' },
        { index: 7, label: 'Sektor1', description: 'Første sektor i sektordiagram.' },
        { index: 8, label: 'Sektor2', description: 'Andre sektor i sektordiagram.' },
        { index: 9, label: 'Sektor3', description: 'Tredje sektor i sektordiagram.' },
        { index: 10, label: 'Sektor4', description: 'Fjerde sektor i sektordiagram.' },
        { index: 11, label: 'Sektor5', description: 'Femte sektor i sektordiagram.' },
        { index: 12, label: 'Sektor6', description: 'Sjette sektor i sektordiagram.' }
      ]
    },
    {
      groupId: 'fractions',
      title: 'Brøk og tenkeblokker',
      description: 'Farger for fyll i brøkmodeller og tenkeblokker.',
      slots: [
        { index: 13, label: 'Fyll 1', description: 'Fyllfarge 1 for brøker og tenkeblokker.' },
        { index: 14, label: 'Fyll 2', description: 'Fyllfarge 2 for brøker og tenkeblokker.' },
        { index: 18, label: 'Fyll 3', description: 'Fyllfarge 3 for brøker og tenkeblokker.' },
        { index: 19, label: 'Fyll 4', description: 'Fyllfarge 4 for brøker og tenkeblokker.' },
        { index: 20, label: 'Fyll 5', description: 'Fyllfarge 5 for brøker og tenkeblokker.' },
        { index: 48, label: 'Fyll 6', description: 'Fyllfarge 6 for brøker og tenkeblokker.' }
      ]
    },
    {
      groupId: 'figurtall',
      title: 'Figurtall',
      description: 'Tre standardfarger for figurer i mønstre.',
      slots: [
        { index: 15, label: 'Fyll 1', description: 'Første farge i figurtall.' },
        { index: 16, label: 'Fyll 2', description: 'Andre farge i figurtall.' },
        { index: 17, label: 'Fyll 3', description: 'Tredje farge i figurtall.' }
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
    },
    {
      groupId: 'tallinje',
      title: 'Tallinje',
      description: 'Standardfarger for tallinjen.',
      slots: [
        { index: 25, label: 'Linje', description: 'Selve tallinjen og markeringer.' },
        { index: 26, label: 'Fyll', description: 'Utfylling av områder på tallinjen.' }
      ]
    },
    {
      groupId: 'kvikkbilder',
      title: 'Kvikkbilder',
      description: 'Fyllfargen i kvikkbilder.',
      slots: [{ index: 27, label: 'Fyll', description: 'Brukes på figurer i kvikkbilder.' }]
    },
    {
      groupId: 'trefigurer',
      title: '3D-figurer',
      description: 'Standardfarger for romfigurer.',
      slots: [
        { index: 28, label: 'Linje', description: 'Kanter og hjelpelinjer i romfigurer.' },
        { index: 29, label: 'Fyll', description: 'Fyllfarge for romfigurer.' }
      ]
    },
    {
      groupId: 'brokvegg',
      title: 'Brøkvegg',
      description: 'Farger for nivåene i brøkveggen.',
      slots: [
        { index: 30, label: 'Fyll 1', description: 'Øverste nivå i brøkveggen.' },
        { index: 31, label: 'Fyll 2', description: 'Andre nivå i brøkveggen.' },
        { index: 32, label: 'Fyll 3', description: 'Tredje nivå i brøkveggen.' },
        { index: 33, label: 'Fyll 4', description: 'Fjerde nivå i brøkveggen.' },
        { index: 34, label: 'Fyll 5', description: 'Femte nivå i brøkveggen.' },
        { index: 35, label: 'Fyll 6', description: 'Sjette nivå i brøkveggen.' }
      ]
    },
    {
      groupId: 'prikktilprikk',
      title: 'Prikk til prikk',
      description: 'Farger for punkter og linjer i prikk til prikk.',
      slots: [
        { index: 36, label: 'Prikk', description: 'Standardfarge for punktene.' },
        { index: 37, label: 'Linje', description: 'Linjen som binder punktene sammen.' }
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
