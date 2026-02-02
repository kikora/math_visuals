/* =======================
   KONFIG FRA HTML
   ======================= */
const PALETTE_CLIENT_ERROR_CODES = new Set(['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'ERR_REQUIRE_ESM']);

const paletteModule = loadPaletteServiceClient();
const { paletteService } = paletteModule;

function loadPaletteServiceClient() {
  const moduleExports = tryRequirePaletteClient();
  if (moduleExports && moduleExports.paletteService && typeof moduleExports.paletteService.resolveGroupPalette === 'function') {
    return moduleExports;
  }
  const scopes = [
    typeof globalThis !== 'undefined' ? globalThis : null,
    typeof window !== 'undefined' ? window : null,
    typeof global !== 'undefined' ? global : null
  ];
  for (const scope of scopes) {
    const client = resolvePaletteClientFromScope(scope);
    if (client) {
      return client;
    }
  }
  return createFallbackPaletteClient();
}

function tryRequirePaletteClient() {
  if (typeof require !== 'function') {
    return null;
  }
  try {
    return require('./palette/palette-service-client.js');
  } catch (error) {
    if (!error || !PALETTE_CLIENT_ERROR_CODES.has(error.code)) {
      throw error;
    }
  }
  return null;
}

function resolvePaletteClientFromScope(scope) {
  if (!scope || typeof scope !== 'object') {
    return null;
  }
  const client = scope.MathVisualsPaletteServiceClient;
  if (client && client.paletteService && typeof client.paletteService.resolveGroupPalette === 'function') {
    return client;
  }
  const group = scope.MathVisualsGroupPalette;
  if (!group || typeof group !== 'object') {
    return null;
  }
  const service = group.service && typeof group.service === 'object' ? group.service : group;
  const resolver = service.resolveGroupPalette || service.resolve || group.resolveGroupPalette || group.resolve;
  if (typeof resolver !== 'function') {
    return null;
  }
  return {
    paletteService: {
      resolveGroupPalette(options = {}) {
        return resolver.call(service, options);
      }
    }
  };
}

function createFallbackPaletteClient() {
  return {
    paletteService: {
      resolveGroupPalette(options = {}) {
        const base = Array.isArray(options.base) ? options.base.filter(isValidColor) : [];
        const fallback = Array.isArray(options.fallback) ? options.fallback.filter(isValidColor) : [];
        const source = base.length ? base : fallback;
        if (!source.length) {
          return [];
        }
        const count = Number.isFinite(options.count) && options.count > 0 ? Math.trunc(options.count) : source.length;
        const size = Math.max(1, count);
        const result = [];
        for (let index = 0; index < size; index += 1) {
          result.push(source[index % source.length]);
        }
        return result;
      }
    }
  };
}

function getColorPickerHelper() {
  const scope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (scope && scope.MathVisualsColorPickerHelper) {
    return scope.MathVisualsColorPickerHelper;
  }
  if (typeof require === 'function') {
    try {
      return require('./colorpicker-helper.js');
    } catch (_) {}
  }
  return null;
}

function getColorPickerModule() {
  const scope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (scope && scope.MathVisualsColorPicker) {
    return scope.MathVisualsColorPicker;
  }
  if (typeof require === 'function') {
    try {
      return require('./ui/colorpicker/index.js');
    } catch (_) {}
  }
  return null;
}

function isValidColor(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

const SIMPLE = {
  pizzas: [],
  ops: [],
  altText: '',
  altTextSource: 'auto',
  solution: normalizeSolution(),
  fillColorIndex: 1
};
if (typeof window !== 'undefined') window.SIMPLE = SIMPLE;
const PANEL_HTML = [];
let altTextManager = null;
const LEGACY_PIZZA_COLORS = {
  fill: '#5B2AA5',
  rim: '#333333',
  dash: '#000000',
  handle: '#e9e6f7',
  handleStroke: '#333333'
};
const SHARED_GROUP_ID = 'fellesfarger';
const FILL_COLOR_COUNT = 6;
const DEFAULT_GRAFTEGNER_COLOR_ROLES = [
  { fillIndex: 0, lineIndex: 1 },
  { fillIndex: 3, lineIndex: 4 },
  { fillIndex: 6, lineIndex: 7 },
  { fillIndex: 9, lineIndex: 10 },
  { fillIndex: 12, lineIndex: 13 },
  { fillIndex: 15, lineIndex: 16 }
];
const colorPickerHelper = getColorPickerHelper();
const colorPickerModule = getColorPickerModule();
const fillColorPickerInstances = new WeakMap();
function getFillColorPickers() {
  if (typeof document === 'undefined') return [];
  return Array.from(document.querySelectorAll('[data-fill-color-picker]'));
}
const LEGACY_PIZZA_PALETTE = [
  LEGACY_PIZZA_COLORS.fill,
  LEGACY_PIZZA_COLORS.rim,
  LEGACY_PIZZA_COLORS.dash,
  LEGACY_PIZZA_COLORS.handle,
  LEGACY_PIZZA_COLORS.handleStroke
];
function resolveDragHandleIcon() {
  if (typeof document === 'undefined') {
    return 'images/draggable.svg';
  }
  const current = document.currentScript && document.currentScript.src ? document.currentScript.src : null;
  if (current) {
    try {
      return new URL('images/draggable.svg', current).toString();
    } catch (_) {}
  }
  if (document.baseURI) {
    try {
      return new URL('images/draggable.svg', document.baseURI).toString();
    } catch (_) {}
  }
  if (typeof window !== 'undefined' && window.location && window.location.href) {
    try {
      return new URL('images/draggable.svg', window.location.href).toString();
    } catch (_) {}
  }
  return 'images/draggable.svg';
}
const DRAG_HANDLE_ICON = resolveDragHandleIcon();
const DRAG_HANDLE_SIZE = 36;
const XLINK_NS = 'http://www.w3.org/1999/xlink';
function getThemeApi() {
  const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
  return theme && typeof theme === 'object' ? theme : null;
}

function getPaletteProjectResolver() {
  const scopes = [
    typeof window !== 'undefined' ? window : null,
    typeof globalThis !== 'undefined' ? globalThis : null,
    typeof global !== 'undefined' ? global : null
  ];
  for (const scope of scopes) {
    if (!scope || typeof scope !== 'object') continue;
    const resolver = scope.MathVisualsPaletteProjectResolver;
    if (resolver && typeof resolver.resolvePaletteProject === 'function') {
      return resolver;
    }
  }
  if (typeof require === 'function') {
    try {
      const mod = require('./palette/resolve-palette-project.js');
      if (mod && typeof mod.resolvePaletteProject === 'function') {
        return mod;
      }
    } catch (_) {}
  }
  return null;
}
function getPaletteApi() {
  const scope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (!scope || typeof scope !== 'object') return null;
  const api = scope.MathVisualsPalette;
  return api && typeof api.getGroupPalette === 'function' ? api : null;
}

function resolvePaletteConfig() {
  const scopes = [
    typeof window !== 'undefined' ? window : null,
    typeof globalThis !== 'undefined' ? globalThis : null,
    typeof global !== 'undefined' ? global : null
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
      const mod = require('./palette/palette-config.js');
      if (mod && typeof mod === 'object') {
        return mod;
      }
    } catch (_) {}
  }
  return null;
}

let paletteConfigCache;
let paletteConfigResolved = false;

function getPaletteConfig() {
  if (!paletteConfigResolved) {
    paletteConfigResolved = true;
    paletteConfigCache = resolvePaletteConfig();
  }
  return paletteConfigCache;
}

function getSettingsApi() {
  if (typeof window === 'undefined') return null;
  const api = window.MathVisualsSettings;
  return api && typeof api === 'object' ? api : null;
}

function getActiveThemeProjectName(theme = getThemeApi()) {
  if (!theme || typeof theme.getActiveProfileName !== 'function') return null;
  try {
    const value = theme.getActiveProfileName();
    if (typeof value === 'string' && value.trim()) {
      return value.trim().toLowerCase();
    }
  } catch (_) {}
  return null;
}

function resolvePaletteProjectName() {
  // 1. Sjekk DOM-roten (HTML-taggen). Dette er FASITEN for visning.
  if (typeof document !== 'undefined' && document.documentElement) {
    const root = document.documentElement;

    // Sjekk alle mulige attributter rammeverket bruker
    const attr =
      root.getAttribute('data-mv-active-project') ||
      root.getAttribute('data-theme-profile') ||
      root.getAttribute('data-project');

    if (attr && typeof attr === 'string' && attr.trim()) {
      return attr.trim().toLowerCase();
    }
  }

  // 2. Sjekk Theme API hvis det er tilgjengelig (det leser ofte også fra DOM)
  const theme = getThemeApi();
  const activeThemeProject = getActiveThemeProjectName(theme);
  if (activeThemeProject) return activeThemeProject;

  // VIKTIG ENDRING: Vi returnerer NULL her.
  // Vi spør IKKE settingsApi. Det var det som forårsaket "fargesmitte".
  return null;
}

function getProjectFallbackPaletteBase(projectName) {
  const config = getPaletteConfig();
  if (!config || !config.PROJECT_FALLBACKS) {
    return [];
  }
  const normalized = typeof projectName === 'string' ? projectName.trim().toLowerCase() : '';
  const fallbacks = config.PROJECT_FALLBACKS;
  const palette = (normalized && fallbacks[normalized]) || fallbacks.default || [];
  return sanitizePalette(palette);
}

function getGroupSlotIndices(config, groupId) {
  if (!config) return [];
  const normalizedGroupId = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
  if (!normalizedGroupId) return [];
  if (Array.isArray(config.COLOR_SLOT_GROUPS)) {
    const group = config.COLOR_SLOT_GROUPS.find(entry => {
      const groupKey = typeof entry?.groupId === 'string' ? entry.groupId.trim().toLowerCase() : '';
      return groupKey === normalizedGroupId;
    });
    if (group && Array.isArray(group.colorRoles) && group.colorRoles.length) {
      const indices = [];
      group.colorRoles.forEach(role => {
        if (!role || typeof role !== 'object') return;
        if (Number.isInteger(role.fillIndex) && role.fillIndex >= 0) {
          indices.push(role.fillIndex);
        }
        if (Number.isInteger(role.lineIndex) && role.lineIndex >= 0) {
          indices.push(role.lineIndex);
        }
      });
      if (indices.length) {
        return indices;
      }
    }
  }
  const indexMap = config.GROUP_SLOT_INDICES;
  if (indexMap && typeof indexMap === 'object') {
    const indices = indexMap[normalizedGroupId];
    if (Array.isArray(indices) && indices.length) {
      return indices
        .map(value => (Number.isInteger(value) && value >= 0 ? Math.trunc(value) : null))
        .filter(index => Number.isInteger(index) && index >= 0);
    }
  }
  if (Array.isArray(config.COLOR_SLOT_GROUPS)) {
    for (const group of config.COLOR_SLOT_GROUPS) {
      if (!group || typeof group !== 'object') continue;
      const groupKey = typeof group.groupId === 'string' ? group.groupId.trim().toLowerCase() : '';
      if (groupKey !== normalizedGroupId) continue;
      if (!Array.isArray(group.slots)) break;
      return group.slots
        .map((slot, slotIndex) => {
          if (!slot || typeof slot !== 'object') return null;
          const index = Number.isInteger(slot.index) ? Math.trunc(slot.index) : slotIndex;
          return index >= 0 ? index : null;
        })
        .filter(index => Number.isInteger(index) && index >= 0);
    }
  }
  return [];
}

function getGraftegnerRoleSlotPairs() {
  const config = getPaletteConfig();
  if (colorPickerHelper && typeof colorPickerHelper.resolveRoleSlotPairs === 'function') {
    return colorPickerHelper.resolveRoleSlotPairs(config, 'fellesfarger', DEFAULT_GRAFTEGNER_COLOR_ROLES);
  }
  const pairs = [];
  for (let index = 0; index < FILL_COLOR_COUNT; index += 1) {
    pairs.push({
      fillSlotIndex: index * 3,
      lineSlotIndex: index * 3 + 1
    });
  }
  return pairs;
}

function applyPairSwatch(element, fillColor, lineColor) {
  if (!element) return;
  if (colorPickerHelper && typeof colorPickerHelper.applyColorPairSwatch === 'function') {
    colorPickerHelper.applyColorPairSwatch(element, fillColor, lineColor);
    return;
  }
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

function buildFillColorSlots(fillColors, lineColors) {
  const slots = [];
  const fallbackLine = lineColors[0] || '#000';
  const pairCount = Math.min(fillColors.length, lineColors.length);
  for (let index = 0; index < pairCount; index += 1) {
    const fillColor = fillColors[index];
    const lineColor = lineColors[index] || fallbackLine;
    slots.push({
      value: index + 1,
      label: `Velg farge ${index + 1}`,
      fillColor,
      lineColor
    });
  }
  return slots;
}

function getProjectGroupFallbackPalette(projectName, groupId, basePalette) {
  const baseCandidate = Array.isArray(basePalette) && basePalette.length ? basePalette : getProjectFallbackPaletteBase(projectName);
  const sanitizedBase = sanitizePalette(baseCandidate);
  if (!sanitizedBase.length) {
    return [];
  }
  const config = getPaletteConfig();
  if (!config) {
    return sanitizedBase.slice();
  }
  const indices = getGroupSlotIndices(config, groupId);
  if (!indices.length) {
    return sanitizedBase.slice();
  }
  const result = [];
  const baseLength = sanitizedBase.length;
  indices.forEach((index, slotIndex) => {
    if (!Number.isInteger(index) || index < 0) {
      const fallbackColor = sanitizedBase[slotIndex % baseLength] || sanitizedBase[0];
      if (typeof fallbackColor === 'string' && fallbackColor) {
        result.push(fallbackColor);
      }
      return;
    }
    const color = sanitizedBase[index % baseLength];
    if (typeof color === 'string' && color) {
      result.push(color);
      return;
    }
    const fallbackColor = sanitizedBase[slotIndex % baseLength] || sanitizedBase[0];
    if (typeof fallbackColor === 'string' && fallbackColor) {
      result.push(fallbackColor);
    }
  });
  return sanitizePalette(result);
}

function sanitizePalette(values) {
  if (!Array.isArray(values)) return [];
  const sanitized = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    sanitized.push(trimmed);
  }
  return sanitized;
}

function ensurePaletteSize(basePalette, fallbackPalette, count) {
  const base = sanitizePalette(basePalette);
  const fallback = sanitizePalette(fallbackPalette);
  const target = Number.isFinite(count) && count > 0 ? Math.trunc(count) : base.length || fallback.length || 0;
  if (target <= 0) {
    return base.length ? base.slice() : fallback.slice();
  }
  const result = [];
  for (let index = 0; index < target; index += 1) {
    const primary = base[index];
    if (typeof primary === 'string' && primary) {
      result.push(primary);
      continue;
    }
    if (fallback.length) {
      const fallbackColor = fallback[index % fallback.length];
      if (typeof fallbackColor === 'string' && fallbackColor) {
        result.push(fallbackColor);
        continue;
      }
    }
    if (base.length) {
      const cycled = base[index % base.length];
      if (typeof cycled === 'string' && cycled) {
        result.push(cycled);
      }
    }
  }
  if (!result.length && fallback.length) {
    result.push(fallback[0]);
  }
  return result;
}

function tryResolvePalette(resolver) {
  try {
    const palette = resolver();
    return Array.isArray(palette) ? sanitizePalette(palette) : null;
  } catch (_) {
    return null;
  }
}

function getFractionPalette(count) {
  const settings = getSettingsApi();
  const theme = getThemeApi();
  const project = resolvePaletteProjectName();
  const projectFallbackBase = getProjectFallbackPaletteBase(project);
  const projectFallback = getProjectGroupFallbackPalette(project, SHARED_GROUP_ID, projectFallbackBase);
  const legacyFallback = LEGACY_PIZZA_PALETTE.slice();
  const fallbackCandidates = projectFallback.length
    ? projectFallback
    : projectFallbackBase.length
    ? projectFallbackBase
    : [];
  const fallback = fallbackCandidates.length ? fallbackCandidates : legacyFallback;
  const target = Number.isFinite(count) && count > 0 ? Math.trunc(count) : fallback.length || legacyFallback.length;

  const createResult = (palette, isCustom) => ({
    palette: ensurePaletteSize(palette, fallback, target),
    isCustom
  });

  if (settings && typeof settings.getGroupPalette === 'function') {
    let palette = tryResolvePalette(() =>
      settings.getGroupPalette(SHARED_GROUP_ID, {
        project: project || undefined,
        count: target || undefined
      })
    );
    if ((!palette || palette.length < target) && settings.getGroupPalette.length >= 3) {
      palette = tryResolvePalette(() =>
        settings.getGroupPalette(
          SHARED_GROUP_ID,
          target || undefined,
          project ? { project } : undefined
        )
      );
    }
    if (palette && palette.length) {
      return createResult(palette, true);
    }
  }

  const settingsSnapshot =
    settings && typeof settings.getSettings === 'function'
      ? settings.getSettings()
      : settings || undefined;
  const paletteApi = getPaletteApi();
  if (paletteApi) {
    const palette = tryResolvePalette(() =>
      paletteApi.getGroupPalette(SHARED_GROUP_ID, {
        project: project || undefined,
        count: target || undefined,
        settings: settingsSnapshot
      })
    );
    if (palette && palette.length) {
      return createResult(palette, true);
    }
  }

  const servicePalette = tryResolvePalette(() =>
    paletteService.resolveGroupPalette({
      groupId: SHARED_GROUP_ID,
      count: target || undefined,
      project: project || undefined,
      fallback,
      settings: settingsSnapshot
    })
  );
  if (servicePalette && servicePalette.length) {
    return createResult(servicePalette, true);
  }

  if (theme && typeof theme.getGroupPalette === 'function') {
    let palette = tryResolvePalette(() =>
      theme.getGroupPalette(SHARED_GROUP_ID, {
        project: project || undefined,
        count: target || undefined
      })
    );
    if ((!palette || palette.length < target) && theme.getGroupPalette.length >= 3) {
      palette = tryResolvePalette(() =>
        theme.getGroupPalette(
          SHARED_GROUP_ID,
          target || undefined,
          project ? { project } : undefined
        )
      );
    }
    if (palette && palette.length) {
      return createResult(palette, true);
    }
  }

  if (theme && typeof theme.getPalette === 'function') {
    const palette = tryResolvePalette(() =>
      theme.getPalette('fellesfarger', target || fallback.length, {
        project: project || undefined
      })
    );
    if (palette && palette.length) {
      return createResult(palette, true);
    }
  }

  return createResult([], false);
}

SIMPLE.fillColorIndex = sanitizeFillIndex(SIMPLE.fillColorIndex, FILL_COLOR_COUNT);

function getFillPalette() {
  return getLineFillPalettes().fillColors.slice(0, FILL_COLOR_COUNT);
}

function getLinePalette() {
  return getLineFillPalettes().lineColors.slice(0, FILL_COLOR_COUNT);
}

function getLineFillPalettes() {
  const roleSlots = getGraftegnerRoleSlotPairs();
  let maxIndex = -1;
  roleSlots.forEach(role => {
    if (!role || typeof role !== 'object') return;
    if (Number.isInteger(role.fillSlotIndex)) {
      maxIndex = Math.max(maxIndex, role.fillSlotIndex);
    }
    if (Number.isInteger(role.lineSlotIndex)) {
      maxIndex = Math.max(maxIndex, role.lineSlotIndex);
    }
  });
  const targetCount = maxIndex >= 0 ? maxIndex + 1 : FILL_COLOR_COUNT * 2;
  const result = getFractionPalette(targetCount);
  const palette = Array.isArray(result.palette) ? result.palette : [];
  const lineColors = [];
  const fillColors = [];
  if (roleSlots.length) {
    roleSlots.forEach(role => {
      const fill = palette[role.fillSlotIndex];
      const line = palette[role.lineSlotIndex];
      fillColors.push(fill || line || '#fff');
      lineColors.push(line || fill || '#000');
    });
  } else {
    for (let index = 0; index < targetCount; index += 3) {
      const fill = palette[index];
      const line = palette[index + 1];
      fillColors.push(fill || line || '#fff');
      lineColors.push(line || fill || '#000');
    }
  }
  return { fillColors, lineColors };
}

function sanitizeFillIndex(value, paletteLength) {
  const numeric = Number.parseInt(value, 10);
  const max = Number.isFinite(paletteLength) && paletteLength > 0 ? paletteLength : FILL_COLOR_COUNT;
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  return Math.min(numeric, max);
}

function getPickerPizzaIndex(picker) {
  if (!picker || !picker.dataset) return 0;
  const raw = Number.parseInt(picker.dataset.pizzaIndex, 10);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

function ensurePizzaState(index) {
  if (!Array.isArray(SIMPLE.pizzas)) {
    SIMPLE.pizzas = [];
  }
  if (!SIMPLE.pizzas[index]) {
    SIMPLE.pizzas[index] = {};
  }
  return SIMPLE.pizzas[index];
}

function getPizzaFillIndex(index) {
  const pizza = Array.isArray(SIMPLE.pizzas) ? SIMPLE.pizzas[index] : null;
  const fallback = Number.isFinite(pizza?.fillColorIndex) ? pizza.fillColorIndex : SIMPLE.fillColorIndex;
  return sanitizeFillIndex(fallback, FILL_COLOR_COUNT);
}

function setPizzaFillIndex(index, value) {
  const pizza = ensurePizzaState(index);
  const safeIndex = sanitizeFillIndex(value, FILL_COLOR_COUNT);
  pizza.fillColorIndex = safeIndex;
  if (index === 0) {
    SIMPLE.fillColorIndex = safeIndex;
  }
  return safeIndex;
}

function renderFillColorPickers() {
  const pickers = getFillColorPickers();
  if (!pickers.length || !colorPickerModule || typeof colorPickerModule.createColorPicker !== 'function') {
    return;
  }
  const paletteData = getLineFillPalettes();
  const colors = paletteData.fillColors.slice(0, FILL_COLOR_COUNT);
  const lineColors = paletteData.lineColors.slice(0, colors.length);
  const slots = buildFillColorSlots(colors, lineColors);
  pickers.forEach(picker => {
    const pizzaIndex = getPickerPizzaIndex(picker);
    const renderStyle = ({ element, slot }) => {
      applyPairSwatch(element, slot.fillColor, slot.lineColor);
    };
    const onSelect = value => {
      setPizzaFillIndex(pizzaIndex, value);
      applyPizzaColors();
    };
    const instance = fillColorPickerInstances.get(picker);
    if (instance) {
      instance.update({
        slots,
        renderStyle,
        onSelect,
        getActiveValue: () => getPizzaFillIndex(pizzaIndex)
      });
      return;
    }
    const pickerInstance = colorPickerModule.createColorPicker({
      element: picker,
      slots,
      renderStyle,
      onSelect,
      getActiveValue: () => getPizzaFillIndex(pizzaIndex)
    });
    if (pickerInstance) {
      fillColorPickerInstances.set(picker, pickerInstance);
    }
  });
}

function getPizzaFillColor(index) {
  const colors = getFillPalette();
  const fillIndex = getPizzaFillIndex(index);
  return colors[fillIndex - 1] || colors[0] || LEGACY_PIZZA_COLORS.fill;
}

function getPizzaLineColor(index) {
  const colors = getLinePalette();
  const fillIndex = getPizzaFillIndex(index);
  return colors[fillIndex - 1] || colors[0] || '#000000';
}

function getPizzaColors() {
  const fillColor = getPizzaFillColor(0);
  const lineColor = getPizzaLineColor(0);
  const base = {
    fill: fillColor,
    rim: lineColor,
    dash: lineColor,
    handle: getThemeColor('pizza.handle', LEGACY_PIZZA_COLORS.handle),
    handleStroke: lineColor
  };
  return {
    fill: base.fill,
    rim: base.rim,
    dash: base.dash,
    handle: base.handle,
    handleStroke: base.handleStroke
  };
}

const PIZZA_DEFAULTS = {
  minN: 1,
  maxN: 24,
  R: 180,
  stepN: 1,
  stepK: 1,
  metaMode: "none",
  lockDenominator: false,
  lockNumerator: false,
  showDenominatorValue: true
};
const PIZZA_DOM = [{
  svgId: "pizza1",
  fracId: "frac1",
  minusId: "nMinus1",
  plusId: "nPlus1",
  valId: "nVal1",
  index: 0
}, {
  svgId: "pizza2",
  fracId: "frac2",
  minusId: "nMinus2",
  plusId: "nPlus2",
  valId: "nVal2",
  index: 1
}, {
  svgId: "pizza3",
  fracId: "frac3",
  minusId: "nMinus3",
  plusId: "nPlus3",
  valId: "nVal3",
  index: 2
}];

function applyPizzaColors() {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc || !doc.documentElement) return;
  const root = doc.documentElement;
  const style = root.style;
  const colors = getPizzaColors();
  const rootEntries = [
    ['--pizza-fill', colors.fill],
    ['--pizza-rim', colors.rim],
    ['--pizza-dash', colors.dash],
    ['--pizza-handle', colors.handle],
    ['--pizza-handle-stroke', colors.handleStroke]
  ];
  rootEntries.forEach(([cssVar, value]) => {
    if (typeof value === 'string' && value) {
      style.setProperty(cssVar, value);
    } else {
      style.removeProperty(cssVar);
    }
  });
  PIZZA_DOM.forEach((map, index) => {
    const svg = doc.getElementById(map.svgId);
    if (!svg || !svg.style) return;
    const fill = getPizzaFillColor(index);
    const line = getPizzaLineColor(index);
    if (typeof fill === 'string' && fill) {
      svg.style.setProperty('--pizza-fill', fill);
    } else {
      svg.style.removeProperty('--pizza-fill');
    }
    if (typeof line === 'string' && line) {
      svg.style.setProperty('--pizza-rim', line);
      svg.style.setProperty('--pizza-dash', line);
      svg.style.setProperty('--pizza-handle-stroke', line);
    } else {
      svg.style.removeProperty('--pizza-rim');
      svg.style.removeProperty('--pizza-dash');
      svg.style.removeProperty('--pizza-handle-stroke');
    }
  });
}

function applyThemeToDocument() {
  const theme = getThemeApi();
  if (theme && typeof theme.applyToDocument === 'function') {
    theme.applyToDocument(document);
  }
  applyPizzaColors();
  renderFillColorPickers();
}
function getThemeColor(token, fallback) {
  const theme = getThemeApi();
  if (theme && typeof theme.getColor === 'function') {
    try {
      const color = theme.getColor(token);
      if (typeof color === 'string' && color) {
        return color;
      }
    } catch (_) {}
  }
  return fallback;
}

const checkButton = typeof document !== 'undefined' ? document.getElementById('btnCheck') : null;
const checkStatus = typeof document !== 'undefined' ? document.getElementById('checkStatus') : null;

function normalizeSingleSolution(solution) {
  const data = solution && typeof solution === 'object' ? solution : {};
  const num = Number(data.numerator);
  const den = Number(data.denominator);
  return {
    numerator: Number.isFinite(num) ? num : null,
    denominator: Number.isFinite(den) && den > 0 ? den : null
  };
}

function normalizeSolution(solution) {
  const normalized = Array.from({ length: 3 }, () => ({ numerator: null, denominator: null }));
  const applyAtIndex = (idx, value) => {
    if (idx < 0 || idx >= normalized.length) return;
    normalized[idx] = normalizeSingleSolution(value);
  };
  if (Array.isArray(solution)) {
    solution.forEach((value, idx) => applyAtIndex(idx, value));
  } else if (solution && typeof solution === 'object') {
    if (Array.isArray(solution.pizzas)) {
      solution.pizzas.forEach((value, idx) => applyAtIndex(idx, value));
    } else {
      applyAtIndex(0, solution);
    }
  }
  return normalized;
}

const TASK_APP_ID = 'brøkpizza';

function getTaskApi() {
  if (typeof window === 'undefined') return null;
  return window.MathVisualsTaskApi || null;
}

function registerTaskAdapter() {
  const taskApi = getTaskApi();
  if (!taskApi || typeof taskApi.registerTaskAdapter !== 'function') return;
  taskApi.registerTaskAdapter(TASK_APP_ID, {
    evaluateAnswers() {
      runTaskCheck();
      return null;
    }
  });
}

registerTaskAdapter();

function setCheckStatus(type, heading, detailLines) {
  if (!checkStatus) return;
  if (!type) {
    checkStatus.hidden = true;
    checkStatus.className = 'status';
    checkStatus.textContent = '';
    return;
  }
  checkStatus.hidden = false;
  checkStatus.className = `status status--${type}`;
  checkStatus.textContent = '';
  if (heading) {
    const strong = document.createElement('strong');
    strong.textContent = heading;
    checkStatus.appendChild(strong);
  }
  if (Array.isArray(detailLines)) {
    detailLines.forEach(line => {
      if (!line) return;
      const div = document.createElement('div');
      div.textContent = line;
      checkStatus.appendChild(div);
    });
  }
}

function clearCheckStatus() {
  setCheckStatus(null);
}

if (checkButton) {
  checkButton.addEventListener('click', () => {
    const taskApi = getTaskApi();
    if (taskApi && typeof taskApi.evaluateTask === 'function') {
      taskApi.evaluateTask(TASK_APP_ID);
    } else {
      runTaskCheck();
    }
  });
}

function readConfigFromHtml() {
  const pizzas = [];
  for (let i = 1; i <= 3; i++) {
    var _document$getElementB, _document$getElementB2, _document$getElementB3, _document$getElementB4, _document$getElementB5, _document$getElementB6, _document$getElementB7, _document$getElementB8, _document$getElementB9, _document$getElementB0, _document$getElementB1, _document$getElementB10;
    const t = parseInt((_document$getElementB = document.getElementById(`p${i}T`)) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.value, 10);
    const n = parseInt((_document$getElementB2 = document.getElementById(`p${i}N`)) === null || _document$getElementB2 === void 0 ? void 0 : _document$getElementB2.value, 10);
    const canChangeNInput = document.getElementById(`p${i}LockN`);
    const canChangeTInput = document.getElementById(`p${i}LockT`);
    const showNValInput = document.getElementById(`p${i}HideNVal`);
    const canChangeN = canChangeNInput ? canChangeNInput.checked : true;
    const canChangeT = canChangeTInput ? canChangeTInput.checked : true;
    const text = (_document$getElementB3 = (_document$getElementB4 = document.getElementById(`p${i}Text`)) === null || _document$getElementB4 === void 0 ? void 0 : _document$getElementB4.value) !== null && _document$getElementB3 !== void 0 ? _document$getElementB3 : "none";
    const minN = parseInt((_document$getElementB5 = document.getElementById(`p${i}MinN`)) === null || _document$getElementB5 === void 0 ? void 0 : _document$getElementB5.value, 10);
    const maxN = parseInt((_document$getElementB6 = document.getElementById(`p${i}MaxN`)) === null || _document$getElementB6 === void 0 ? void 0 : _document$getElementB6.value, 10);
    const showNVal = showNValInput ? showNValInput.checked : true;
    pizzas.push({
      t: isFinite(t) ? t : 0,
      n: isFinite(n) ? n : 1,
      lockN: !canChangeN,
      lockT: !canChangeT,
      text,
      hideNVal: !showNVal,
      minN: isFinite(minN) ? minN : 1,
      maksN: isFinite(maxN) ? maxN : 24
    });
  }
  const ops = [];
  for (let i = 1; i <= 2; i++) {
    const rightPanel = document.getElementById(`panel${i + 1}`);
    const hasRightPizza = !!(rightPanel && rightPanel.style.display !== "none");
    const select = document.getElementById(`op${i}`);
    let op = "";
    if (hasRightPizza) {
      op = (select === null || select === void 0 ? void 0 : select.value) || "";
    } else if (select) {
      select.value = "";
    }
    ops.push(op);
  }
  const rawSolutions = [];
  for (let i = 1; i <= 3; i++) {
    const numInput = document.getElementById(`p${i}SolutionNumerator`);
    const denInput = document.getElementById(`p${i}SolutionDenominator`);
    rawSolutions.push({
      numerator: numInput ? parseInt(numInput.value, 10) : null,
      denominator: denInput ? parseInt(denInput.value, 10) : null
    });
  }
  return {
    pizzas,
    ops,
    solution: normalizeSolution(rawSolutions)
  };
}

/* =======================
   Grunnoppsett
   ======================= */
applyThemeToDocument();
const TAU = Math.PI * 2;
const norm = a => (a % TAU + TAU) % TAU;
const applySvgAttributes = (el, attrs = {}) => {
  if (!el || !attrs || typeof attrs !== 'object') return;
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === 'href' || key === 'xlink:href') {
      el.setAttribute('href', value);
      el.setAttributeNS(XLINK_NS, 'href', value);
      continue;
    }
    el.setAttribute(key, value);
  }
};
const mk = (n, a = {}) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', n);
  applySvgAttributes(e, a);
  return e;
};
const positionHandleIcon = (handle, cx, cy) => {
  if (!handle) return;
  const sizeAttr = handle.getAttribute('data-handle-size');
  const parsed = sizeAttr ? Number.parseFloat(sizeAttr) : NaN;
  const size = Number.isFinite(parsed) ? parsed : DRAG_HANDLE_SIZE;
  const half = size / 2;
  handle.setAttribute('x', cx - half);
  handle.setAttribute('y', cy - half);
};
const arcPath = (r, a0, a1) => {
  const raw = a1 - a0,
    span = (raw % TAU + TAU) % TAU,
    isFull = Math.abs(span) < 1e-6 && Math.abs(raw) > 1e-6;
  if (isFull) return `M ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 Z`;
  const sweep = 1,
    large = span > Math.PI ? 1 : 0,
    x0 = r * Math.cos(a0),
    y0 = r * Math.sin(a0),
    x1 = r * Math.cos(a1),
    y1 = r * Math.sin(a1);
  return `M 0 0 L ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1} Z`;
};
const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
};
const fmt = x => {
  const s = (Math.round(x * 100) / 100).toFixed(2);
  return s.replace(/\.?0+$/, "");
};

/* ==== Senter-justering: sirklene på LINJE ==== */
let _centerRaf = 0;
function alignPanelsByCenter() {
  const panels = [...document.querySelectorAll(".pizzaPanel")].filter(p => p.offsetParent !== null);
  if (!panels.length) return;
  const items = panels.map(p => {
    const header = p.querySelector(".panelHeader");
    const svg = p.querySelector("svg.pizza");
    if (!header || !svg) return null;
    header.style.height = "auto";
    const baseHeader = header.getBoundingClientRect().height;
    const svgH = svg.getBoundingClientRect().height;
    return {
      header,
      baseHeader,
      svgH
    };
  }).filter(Boolean);
  if (!items.length) return;
  const maxCenter = Math.max(...items.map(it => it.baseHeader + it.svgH / 2));
  items.forEach(it => {
    const targetHeader = Math.max(0, maxCenter - it.svgH / 2);
    const finalHeader = Math.max(targetHeader, it.baseHeader);
    it.header.style.height = finalHeader + "px";
  });
  alignOperatorsByCenter();
}
function alignOperatorsByCenter() {
  const container = document.querySelector(".grid2");
  if (!container) return;
  const ops = [...container.querySelectorAll(".opDisplay")];
  if (!ops.length) return;
  ops.forEach(op => {
    op.style.transform = "";
  });
  const visibleOps = ops.filter(op => op.offsetParent !== null && op.style.display !== "none");
  if (!visibleOps.length) return;
  if (container.classList.contains("is-stacked")) return;
  const panels = [...container.querySelectorAll(".pizzaPanel")].filter(p => p.offsetParent !== null);
  if (panels.length < 2) return;
  const containerRect = container.getBoundingClientRect();
  const centers = panels.map(panel => {
    const svg = panel.querySelector("svg.pizza");
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return rect.top + rect.height / 2 - containerRect.top;
  });
  visibleOps.forEach((op, idx) => {
    const leftCenter = centers[idx];
    const rightCenter = centers[idx + 1];
    let targetCenter = Number.isFinite(leftCenter) && Number.isFinite(rightCenter) ? (leftCenter + rightCenter) / 2 : Number.isFinite(leftCenter) ? leftCenter : rightCenter;
    if (!Number.isFinite(targetCenter)) {
      op.style.transform = "";
      return;
    }
    const rect = op.getBoundingClientRect();
    const opCenter = rect.top + rect.height / 2 - containerRect.top;
    const delta = targetCenter - opCenter;
    op.style.transform = `translateY(${delta}px)`;
  });
}
function scheduleCenterAlign() {
  cancelAnimationFrame(_centerRaf);
  _centerRaf = requestAnimationFrame(alignPanelsByCenter);
}
window.addEventListener("resize", scheduleCenterAlign);
function fitPizzasToLine() {
  const container = document.querySelector(".grid2");
  if (!container) return;
  const panels = [...container.querySelectorAll(".pizzaPanel")].filter(p => p.style.display !== "none");
  if (!panels.length) return;
  const ops = [...container.querySelectorAll(".opDisplay")].filter(op => op.style.display !== "none");
  const addBtn = document.getElementById("addPizza");
  const extras = [...ops];
  if (addBtn && addBtn.style.display !== "none") extras.push(addBtn);
  const parent = container.parentElement;
  let availWidth = container.clientWidth;
  if (parent) {
    const parentStyles = getComputedStyle(parent);
    const padL = parseFloat(parentStyles.paddingLeft || "0") || 0;
    const padR = parseFloat(parentStyles.paddingRight || "0") || 0;
    const parentInner = (parent.clientWidth || 0) - padL - padR;
    if (Number.isFinite(parentInner) && parentInner > 0 && (!availWidth || parentInner < availWidth)) {
      availWidth = parentInner;
    }
  }
  if (!availWidth || !Number.isFinite(availWidth) || availWidth <= 0) {
    availWidth = container.getBoundingClientRect().width;
  }
  if (!availWidth || !Number.isFinite(availWidth)) return;
  const extrasWidth = extras.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
  const cs = getComputedStyle(container);
  const gap = parseFloat(cs.columnGap || cs.gap || "0");
  const totalItems = panels.length + extras.length;
  const totalGap = gap * Math.max(0, totalItems - 1);
  const MIN = 160;
  const MAX = 420;
  const minimalRequired = panels.length * MIN + extrasWidth + totalGap;
  const shouldStack = minimalRequired > availWidth;
  container.classList.toggle("is-stacked", shouldStack);
  let computed;
  if (shouldStack) {
    computed = availWidth;
  } else {
    computed = (availWidth - extrasWidth - totalGap) / panels.length;
  }
  if (!Number.isFinite(computed) || computed <= 0) computed = container.clientWidth;
  computed = Math.min(MAX, Math.max(MIN, computed));
  container.style.setProperty("--panel-min", `${computed}px`);
  panels.forEach(panel => {
    const svg = panel.querySelector("svg.pizza");
    if (svg) svg.style.width = "100%";
  });
  scheduleCenterAlign();
}
window.addEventListener("resize", fitPizzasToLine);
function hidePizzaPanel(index) {
  const panel = document.getElementById(`panel${index}`);
  if (panel) panel.style.display = "none";
  const fieldset = document.getElementById(`fieldset${index}`);
  if (fieldset) fieldset.style.display = "none";
}
function setupRemovePizzaButtons() {
  const addBtn = document.getElementById('addPizza');
  const remove2 = document.getElementById('removePizza2');
  if (remove2 && !remove2.dataset.bound) {
    remove2.dataset.bound = 'true';
    remove2.addEventListener('click', () => {
      hidePizzaPanel(3);
      hidePizzaPanel(2);
      if (addBtn) addBtn.style.display = '';
      initFromHtml();
    });
  }
  const remove3 = document.getElementById('removePizza3');
  if (remove3 && !remove3.dataset.bound) {
    remove3.dataset.bound = 'true';
    remove3.addEventListener('click', () => {
      hidePizzaPanel(3);
      if (addBtn) addBtn.style.display = '';
      initFromHtml();
    });
  }
}

/* =======================
   Pizza-klasse
   ======================= */
const REG = new Map(); // svgEl -> Pizza-instans (til eksport)
class Pizza {
  constructor(opts) {
    var _cfg$minN, _cfg$maxN, _cfg$n, _cfg$k, _cfg$R, _cfg$textMode, _this$fracBox, _this$fracBox2, _this$nMinus, _this$nMinus2, _this$nPlus;
    const cfg = {
      ...PIZZA_DEFAULTS,
      ...opts
    };
    this.cfg = cfg;
    this.index = typeof cfg.index === "number" ? cfg.index : null;
    this.minN = Math.max(1, (_cfg$minN = cfg.minN) !== null && _cfg$minN !== void 0 ? _cfg$minN : 1);
    this.maxN = Math.max(this.minN, (_cfg$maxN = cfg.maxN) !== null && _cfg$maxN !== void 0 ? _cfg$maxN : 24);
    this.n = Math.min(Math.max((_cfg$n = cfg.n) !== null && _cfg$n !== void 0 ? _cfg$n : 6, this.minN), this.maxN);
    this.k = Math.min((_cfg$k = cfg.k) !== null && _cfg$k !== void 0 ? _cfg$k : 0, this.n);
    this.R = (_cfg$R = cfg.R) !== null && _cfg$R !== void 0 ? _cfg$R : 180;
    this.theta = this.k / this.n * TAU;
    this.textMode = (_cfg$textMode = cfg.textMode) !== null && _cfg$textMode !== void 0 ? _cfg$textMode : "none"; // "none" | "frac" | "percent" | "decimal"

    this.svg = document.getElementById(cfg.svgId);
    this.nMinus = document.getElementById(cfg.minusId);
    this.nPlus = document.getElementById(cfg.plusId);
    this.nVal = document.getElementById(cfg.valId);
    this.showDenominatorValue = cfg.showDenominatorValue !== false;
    this.fracBox = document.getElementById(cfg.fracId);
    this.fracNum = ((_this$fracBox = this.fracBox) === null || _this$fracBox === void 0 ? void 0 : _this$fracBox.querySelector(".num")) || null;
    this.fracDen = ((_this$fracBox2 = this.fracBox) === null || _this$fracBox2 === void 0 ? void 0 : _this$fracBox2.querySelector(".den")) || null;
    if (!this.svg) throw new Error(`Mangler SVG med id="${cfg.svgId}"`);
    if (this.nVal && !this.showDenominatorValue) this.nVal.style.display = "none";

    // Header-slot (over SVG)
    this.header = document.createElement("div");
    this.header.className = "panelHeader";
    this.svg.parentNode.insertBefore(this.header, this.svg);
    if (this.fracBox) {
      this.header.appendChild(this.fracBox);
      this.fracBox.style.display = this.textMode === "frac" ? "" : "none";
    }
    if (this.textMode === "percent" || this.textMode === "decimal") {
      this.metaLine = document.createElement("div");
      this.metaLine.style.fontSize = "28px";
      this.metaLine.style.lineHeight = "1";
      this.metaLine.style.opacity = "0.9";
      this.metaLine.style.margin = "0 0 6px 0";
      this.header.appendChild(this.metaLine);
    }

    // Lag i SVG
    this.gFill = mk("g");
    this.gLinesBlack = mk("g");
    this.gRim = mk("g");
    this.defs = mk("defs");
    this.gLinesWhite = mk("g");
    this.gA11y = mk("g");
    this.gHandle = mk("g");
    this.gFill.setAttribute("data-role", "fill");
    this.gLinesBlack.setAttribute("data-role", "linesB");
    this.gLinesWhite.setAttribute("data-role", "linesW");
    this.svg.append(this.gFill, this.gLinesBlack, this.gRim, this.defs, this.gLinesWhite, this.gA11y, this.gHandle);
    this.gRim.appendChild(mk("circle", {
      cx: 0,
      cy: 0,
      r: this.R,
      class: "rim"
    }));
    this.clipFilledId = `${cfg.svgId}-clipFilled`;
    this.clipEmptyId = `${cfg.svgId}-clipEmpty`;
    this.clipFilled = mk("clipPath", {
      id: this.clipFilledId
    });
    this.clipEmpty = mk("clipPath", {
      id: this.clipEmptyId
    });
    this.defs.append(this.clipFilled, this.clipEmpty);
    this.gLinesWhite.setAttribute("clip-path", `url(#${this.clipFilledId})`);
    this.gLinesBlack.setAttribute("clip-path", `url(#${this.clipEmptyId})`);

    // Handle + a11y
    this.handle = mk('image', {
      href: DRAG_HANDLE_ICON,
      width: DRAG_HANDLE_SIZE,
      height: DRAG_HANDLE_SIZE,
      class: 'handle',
      tabindex: -1,
      'data-handle-size': DRAG_HANDLE_SIZE,
      draggable: 'false',
      focusable: 'false',
      preserveAspectRatio: 'xMidYMid meet'
    });
    positionHandleIcon(this.handle, 0, 0);
    this.gHandle.appendChild(this.handle);
    this.slider = mk("circle", {
      cx: 0,
      cy: 0,
      r: this.R,
      fill: "transparent",
      class: "a11y",
      tabindex: 0,
      role: "slider",
      "aria-orientation": "horizontal"
    });
    this.slider.style.pointerEvents = "none";
    this.gA11y.appendChild(this.slider);

    // <title>/<desc> for eksport og live-oppdatering
    this.titleEl = this.svg.querySelector('title');
    this.descEl = this.svg.querySelector('desc');

    // Låse-logikk
    this.fullyLocked = !!(cfg.lockDenominator && cfg.lockNumerator);
    if (this.fullyLocked) {
      this.gHandle.style.display = "none";
      this.slider.setAttribute("tabindex", "-1");
      this.slider.setAttribute("aria-disabled", "true");
    } else {
      this.slider.setAttribute("aria-disabled", cfg.lockNumerator ? "true" : "false");
      this.handle.style.cursor = cfg.lockNumerator ? 'default' : 'grab';
      if (cfg.lockNumerator) this.handle.classList.remove('is-grabbing');
    }

    // Stepper synlighet
    const stepper = (_this$nMinus = this.nMinus) === null || _this$nMinus === void 0 ? void 0 : _this$nMinus.closest(".stepper");
    if (stepper) stepper.style.display = cfg.lockDenominator ? "none" : "";

    // Interaksjon
    this._dragging = false;
    (_this$nMinus2 = this.nMinus) === null || _this$nMinus2 === void 0 || _this$nMinus2.addEventListener("click", () => {
      if (cfg.lockDenominator) return;
      this.setN(this.n - this.cfg.stepN);
    });
    (_this$nPlus = this.nPlus) === null || _this$nPlus === void 0 || _this$nPlus.addEventListener("click", () => {
      if (cfg.lockDenominator) return;
      this.setN(this.n + this.cfg.stepN);
    });
    const onHandleDragMove = e => {
      if (!this._dragging || cfg.lockNumerator || this.fullyLocked) return;
      const {
        x,
        y
      } = this._pt(e);
      const a = norm(Math.atan2(y, x));
      this._setTheta(a, true);
    };
    this.handle.addEventListener('pointerdown', e => {
      if (cfg.lockNumerator || this.fullyLocked) return;
      this._dragging = true;
      this.handle.classList.add('is-grabbing');
      if (typeof this.handle.setPointerCapture === 'function') {
        try {
          this.handle.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    });
    this.handle.addEventListener('pointerup', e => {
      if (cfg.lockNumerator || this.fullyLocked) return;
      this._dragging = false;
      this.handle.classList.remove('is-grabbing');
      if (typeof this.handle.releasePointerCapture === 'function') {
        try {
          this.handle.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    });
    this.handle.addEventListener('pointercancel', () => {
      this._dragging = false;
      this.handle.classList.remove('is-grabbing');
    });
    this.handle.addEventListener('pointermove', onHandleDragMove);
    this.svg.addEventListener("pointerleave", () => {
      this._dragging = false;
      this.handle.classList.remove('is-grabbing');
    });
    this.svg.addEventListener("pointermove", onHandleDragMove);
    this.svg.addEventListener("click", e => {
      if (e.target === this.handle) return;
      if (cfg.lockNumerator || this.fullyLocked) return;
      const {
        x,
        y
      } = this._pt(e);
      const a = norm(Math.atan2(y, x));
      this._setTheta(a, true);
    });
    this.slider.addEventListener("keydown", e => {
      if (this.fullyLocked) return;
      let used = true;
      const big = e.shiftKey ? 5 : 1;
      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          if (!cfg.lockNumerator) this.setK(this.k + this.cfg.stepK * big);else used = false;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          if (!cfg.lockNumerator) this.setK(this.k - this.cfg.stepK * big);else used = false;
          break;
        case "Home":
          if (!cfg.lockNumerator) this.setK(0);else used = false;
          break;
        case "End":
          if (!cfg.lockNumerator) this.setK(this.n);else used = false;
          break;
        case " ":
        case "Enter":
          if (!cfg.lockNumerator) this.setK(this.k + 1);else used = false;
          break;
        case "PageUp":
          if (!cfg.lockDenominator) this.setN(this.n + this.cfg.stepN * (e.shiftKey ? 5 : 1));else used = false;
          break;
        case "PageDown":
          if (!cfg.lockDenominator) this.setN(this.n - this.cfg.stepN * (e.shiftKey ? 5 : 1));else used = false;
          break;
        default:
          used = false;
      }
      if (used) e.preventDefault();
    });
    this.draw();
    this.syncSimpleConfig();
    REG.set(this.svg, this);
  }
  _pt(e) {
    const p = this.svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(this.svg.getScreenCTM().inverse());
  }
  _setTheta(a, updateK) {
    this.theta = norm(a);
    if (updateK) {
      const step = TAU / this.n;
      this.k = Math.max(0, Math.min(this.n, Math.round(this.theta / step)));
    }
    this.draw();
    if (updateK) this.syncSimpleConfig();
  }
  setN(n) {
    const nn = Math.max(this.minN, Math.min(this.maxN, Math.round(n)));
    this.n = nn;
    const step = TAU / this.n;
    this.k = Math.max(0, Math.min(this.n, Math.round(this.theta / step)));
    this.draw();
    this.syncSimpleConfig();
    refreshAltText('interaction');
  }
  setK(k) {
    const kk = Math.max(0, Math.min(this.n, Math.round(k)));
    this.k = kk;
    this.theta = this.k / this.n * TAU;
    this.draw();
    this.syncSimpleConfig();
    refreshAltText('interaction');
  }
  syncSimpleConfig() {
    if (this.index == null) return;
    const idx = this.index;
    if (Array.isArray(SIMPLE.pizzas)) {
      if (!SIMPLE.pizzas[idx]) SIMPLE.pizzas[idx] = {};
      SIMPLE.pizzas[idx].n = this.n;
      SIMPLE.pizzas[idx].t = this.k;
    }
    const field = id => document.getElementById(id);
    const base = idx + 1;
    const nField = field(`p${base}N`);
    if (nField) nField.value = String(this.n);
    const tField = field(`p${base}T`);
    if (tField) tField.value = String(this.k);
    const nVal = field(`nVal${base}`);
    if (nVal) nVal.textContent = String(this.n);
  }
  _updateTextAbove() {
    if (this.metaLine) {
      this.metaLine.textContent = this.textMode === "percent" ? fmt(this.n ? this.k / this.n * 100 : 0) + " %" : this.textMode === "decimal" ? fmt(this.n ? this.k / this.n : 0) : "";
    }
    if (this.fracBox && this.textMode === "frac") {
      if (this.fracNum) this.fracNum.textContent = this.k;
      if (this.fracDen) this.fracDen.textContent = this.n;
    }
  }
  _updateAria() {
    const g = gcd(this.k, this.n),
      dec = fmt(this.n ? this.k / this.n : 0),
      pct = fmt(this.n ? this.k / this.n * 100 : 0) + " %";
    const simp = g > 1 ? ` (${this.k / g}/${this.n / g})` : "";
    this.slider.setAttribute("aria-valuemin", "0");
    this.slider.setAttribute("aria-valuemax", String(this.n));
    this.slider.setAttribute("aria-valuenow", String(this.k));
    this.slider.setAttribute("aria-valuetext", `${this.k} av ${this.n}${simp}, ${dec} som desimal, ${pct}`);
    if (this.titleEl) this.titleEl.textContent = `Brøkpizza: ${this.k}/${this.n}`;
    if (this.descEl) this.descEl.textContent = `Viser ${this.n} sektorer totalt, ${this.k} av dem er fylt`;
  }
  draw() {
    const step = TAU / this.n,
      aEnd = this.k * step;
    if (this.nVal && this.showDenominatorValue) this.nVal.textContent = this.n;
    this.gFill.innerHTML = "";
    for (let i = 0; i < this.n; i++) {
      const a0 = i * step,
        a1 = a0 + step,
        filled = i < this.k;
      this.gFill.appendChild(mk("path", {
        d: arcPath(this.R, a0, a1),
        class: `sector ${filled ? "sector-fill" : "sector-empty"}`
      }));
    }
    this.clipFilled.innerHTML = "";
    this.clipEmpty.innerHTML = "";
    if (this.k <= 0) this.clipEmpty.appendChild(mk("circle", {
      cx: 0,
      cy: 0,
      r: this.R
    }));else if (this.k >= this.n) this.clipFilled.appendChild(mk("circle", {
      cx: 0,
      cy: 0,
      r: this.R
    }));else {
      this.clipFilled.appendChild(mk("path", {
        d: arcPath(this.R, 0, aEnd)
      }));
      this.clipEmpty.appendChild(mk("path", {
        d: arcPath(this.R, aEnd, TAU)
      }));
    }
    this.gLinesBlack.innerHTML = "";
    this.gLinesWhite.innerHTML = "";
    if (this.n > 1) {
      for (let i = 0; i < this.n; i++) {
        const a = i * step,
          x = this.R * Math.cos(a),
          y = this.R * Math.sin(a);
        const lnB = mk("line", {
          x1: 0,
          y1: 0,
          x2: x,
          y2: y,
          class: "dash"
        });
        const lnW = mk("line", {
          x1: 0,
          y1: 0,
          x2: x,
          y2: y,
          class: "dash"
        });
        this.gLinesBlack.appendChild(lnB);
        this.gLinesWhite.appendChild(lnW);
      }
    }
    if (this.fullyLocked) {
      this.gHandle.style.display = "none";
    } else {
      this.gHandle.style.display = "";
      const hx = this.R * Math.cos(this.theta);
      const hy = this.R * Math.sin(this.theta);
      positionHandleIcon(this.handle, hx, hy);
    }
    this._updateAria();
    this._updateTextAbove();
    scheduleCenterAlign();
  }
}

/* =======================
   SVG-eksport – stil
   ======================= */
function getExportSvgStyle() {
  const colors = getPizzaColors();
  return `
.rim{fill:none;stroke:${colors.rim};stroke-width:6}
.sector{stroke:#fff;stroke-width:6}
.sector-fill{fill:${colors.fill}}
.sector-empty{fill:#fff}
.dash{stroke:${colors.dash};stroke-dasharray:4 4;stroke-width:2}
.handle{cursor:grab}
.handle.is-grabbing{cursor:grabbing}
.a11y:focus{outline:none;stroke:#1e88e5;stroke-width:3}
.btn{fill:#fff;stroke:#cfcfcf;stroke-width:1;cursor:pointer}
.btnLabel{font-size:18px;dominant-baseline:middle;text-anchor:middle;pointer-events:none}
.meta, .fracNum, .fracDen{font-size:22px;text-anchor:middle}
.fracLine{stroke:${colors.dash};stroke-width:2}
`;
}
const INTERACTIVE_SVG_SCRIPT = `
/*<![CDATA[*/
(function(){
  "use strict";
  var root=document.currentScript.parentNode, TAU=Math.PI*2;
  function el(n,a){
    var e=document.createElementNS("http://www.w3.org/2000/svg",n);
    if(a) for(var k in a){var v=a[k]; if(v==null) continue; if(k==="href"||k==="xlink:href"){e.setAttributeNS("http://www.w3.org/1999/xlink","href",v); e.setAttribute("href",v);} else {e.setAttribute(k,v);} }
    return e;
  }
  function arc(r,a0,a1){var raw=a1-a0,s=((raw%TAU)+TAU)%TAU,full=Math.abs(s)<1e-6&&Math.abs(raw)>1e-6;
    if(full) return "M "+r+" 0 A "+r+" "+r+" 0 1 1 "+(-r)+" 0 A "+r+" "+r+" 0 1 1 "+r+" 0 Z";
    var sw=1,lg=s>Math.PI?1:0,x0=r*Math.cos(a0),y0=r*Math.sin(a0),x1=r*Math.cos(a1),y1=r*Math.sin(a1);
    return "M 0 0 L "+x0+" "+y0+" A "+r+" "+r+" 0 "+lg+" "+sw+" "+x1+" "+y1+" Z";
  }
  function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){var t=b;b=a%b;a=t;}return a||1;}
  function fmt(x){var s=(Math.round(x*100)/100).toFixed(2);return s.replace(/\.?0+$/,"");}

  var textMode=root.getAttribute("data-textmode")||"none";
  var nmin=+root.getAttribute("data-nmin")||1, nmax=+root.getAttribute("data-nmax")||24;
  var n=+root.getAttribute("data-n")||10, k=+root.getAttribute("data-k")||0, R=+root.getAttribute("data-r")||180;
  var showNVal=root.getAttribute("data-show-nval")!=="0";

  var HANDLE_SIZE=${DRAG_HANDLE_SIZE};
  var fill=root.querySelector('[data-role="fill"]')||root.querySelectorAll("g")[0];
  var linesB=root.querySelector('[data-role="linesB"]')||el("g",{}); if(!linesB.parentNode) root.appendChild(linesB);
  var linesW=root.querySelector('[data-role="linesW"]')||el("g",{}); if(!linesW.parentNode) root.appendChild(linesW);
  var handle=root.querySelector(".handle");
  var a11y=root.querySelector('.a11y');
  var clipFilled=root.querySelector('clipPath[id$="clipFilled"]');
  var clipEmpty=root.querySelector('clipPath[id$="clipEmpty"]');

  function setHandle(a){
    if(!handle){ handle=el("image",{href:"${DRAG_HANDLE_ICON}",width:HANDLE_SIZE,height:HANDLE_SIZE,"class":"handle","data-handle-size":HANDLE_SIZE,draggable:"false",focusable:"false",preserveAspectRatio:"xMidYMid meet"}); root.appendChild(handle); }
    var x=R*Math.cos(a), y=R*Math.sin(a), half=HANDLE_SIZE/2;
    handle.setAttribute("x",x-half); handle.setAttribute("y",y-half);
  }

  function rebuildLines(){
    while(linesB.firstChild) linesB.removeChild(linesB.firstChild);
    while(linesW.firstChild) linesW.removeChild(linesW.firstChild);
    var step=TAU/n;
    for(var i=0;i<n;i++){
      var a=i*step, x=R*Math.cos(a), y=R*Math.sin(a);
      var b=el("line",{x1:0,y1:0,x2:x,y2:y,"class":"dash"});
      var w=el("line",{x1:0,y1:0,x2:x,y2:y,"class":"dash"});
      linesB.appendChild(b); linesW.appendChild(w);
    }
  }
  function updateAria(){
    if(!a11y) return;
    var g=gcd(k,n), dec=fmt(n?k/n:0), pct=fmt(n?k/n*100:0)+" %";
    var simp=g>1?" ("+(k/g)+"/"+(n/g)+")":"";
    a11y.setAttribute("aria-valuemin","0");
    a11y.setAttribute("aria-valuemax",String(n));
    a11y.setAttribute("aria-valuenow",String(k));
    a11y.setAttribute("aria-valuetext",k+" av "+n+simp+", "+dec+" som desimal, "+pct);
    var t=root.querySelector('title');
    var d=root.querySelector('desc');
    if(t) t.textContent="Brøkpizza: "+k+"/"+n;
    if(d) d.textContent="Viser "+n+" sektorer totalt, "+k+" av dem er fylt";
  }
  function rebuildSectors(){
    while(fill.firstChild) fill.removeChild(fill.firstChild);
    var step=TAU/n;
    for(var i=0;i<n;i++){ var a0=i*step,a1=a0+step,f=i<k;
      fill.appendChild(el("path",{d:arc(R,a0,a1),"class":"sector "+(f?"sector-fill":"sector-empty")}));
    }
    if(clipFilled&&clipEmpty){
      while(clipFilled.firstChild) clipFilled.removeChild(clipFilled.firstChild);
      while(clipEmpty.firstChild)  clipEmpty.removeChild(clipEmpty.firstChild);
      var aEnd=k*step;
      if(k<=0) clipEmpty.appendChild(el("circle",{cx:0,cy:0,r:R}));
      else if(k>=n) clipFilled.appendChild(el("circle",{cx:0,cy:0,r:R}));
      else { clipFilled.appendChild(el("path",{d:arc(R,0,aEnd)})); clipEmpty.appendChild(el("path",{d:arc(R,aEnd,TAU)})); }
      setHandle(aEnd);
    }
  }

  /* ---- TEKST OVER ---- */
  var textLayer=el("g",{id:"textLayer"}); root.appendChild(textLayer);
  var yTop=-R-30; // over sirkelen
  var tMeta=null,tNum=null,tDen=null,tLine=null;
  if(textMode==="percent"||textMode==="decimal"){
    tMeta=el("text",{x:0,y:yTop,"class":"meta"}); textLayer.appendChild(tMeta);
  }else if(textMode==="frac"){
    var HALF=18;
    tNum =el("text",{x:0,y:yTop-12,"class":"fracNum"});
    tDen =el("text",{x:0,y:yTop+24,"class":"fracDen"});
    tLine=el("line",{x1:-HALF,y1:yTop,x2:HALF,y2:yTop,"class":"fracLine"});
    textLayer.appendChild(tNum); textLayer.appendChild(tLine); textLayer.appendChild(tDen);
  }
  function updateTexts(){
    if(textMode==="percent"&&tMeta){ var p=n?(k/n*100):0; tMeta.textContent=fmt(p)+" %"; }
    else if(textMode==="decimal"&&tMeta){ var d=n?(k/n):0; tMeta.textContent=fmt(d); }
    else if(textMode==="frac"&&tNum&&tDen){ tNum.textContent=String(k); tDen.textContent=String(n); }
  }

  /* ---- KNAPPER UNDER ---- */
  var controls=el("g",{id:"nControls"});
  var BW=46,BH=30,GAP=28;
  var y=R+34;
  var xMinus=-(BW+GAP), xPlus=GAP;
  var btnMinus=el("rect",{x:xMinus,y:y,width:BW,height:BH,rx:8,ry:8,"class":"btn",tabindex:0});
  var btnPlus =el("rect",{x:xPlus ,y:y,width:BW,height:BH,rx:8,ry:8,"class":"btn",tabindex:0});
  var lblMinus=el("text",{x:xMinus+BW/2,y:y+BH/2,"class":"btnLabel"}); lblMinus.textContent="−";
  var lblPlus =el("text",{x:xPlus +BW/2,y:y+BH/2,"class":"btnLabel"});  lblPlus.textContent="+";
  var nValText=el("text",{x:0,y:y+BH/2,"class":"btnLabel"}); nValText.textContent=String(n);
  if(!showNVal) nValText.setAttribute("display","none");
  controls.appendChild(btnMinus); controls.appendChild(btnPlus);
  controls.appendChild(lblMinus); controls.appendChild(lblPlus); controls.appendChild(nValText);
  root.appendChild(controls);

  function setN(nn){
    nn=Math.max(nmin,Math.min(nmax,Math.round(nn)));
    if(nn===n) return;
    n=nn; if(k>n) k=n;
    if(showNVal) nValText.textContent=String(n);
    rebuildSectors(); rebuildLines(); updateTexts(); updateAria();
  }

  var dragging=false;
  if(handle){
    handle.setAttribute("tabindex","0");
    handle.addEventListener("pointerdown",function(e){dragging=true;handle.classList.add("is-grabbing");try{handle.setPointerCapture(e.pointerId);}catch(_){}});
    handle.addEventListener("pointerup",function(e){dragging=false;handle.classList.remove("is-grabbing");try{handle.releasePointerCapture(e.pointerId);}catch(_){}});
    handle.addEventListener("pointercancel",function(){dragging=false;handle.classList.remove("is-grabbing");});
    root.addEventListener("pointerleave",function(){dragging=false;handle.classList.remove("is-grabbing");});
    root.addEventListener("pointermove",function(e){
      if(!dragging) return;
      var pt=root.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      var p=pt.matrixTransform(root.getScreenCTM().inverse());
      var ang=Math.atan2(p.y,p.x); if(ang<0) ang+=TAU;
      var step=TAU/n; k=Math.max(0,Math.min(n,Math.round(ang/step)));
      rebuildSectors(); updateTexts(); updateAria();
    });
    root.addEventListener("click",function(e){
      if(e.target===handle||e.target===btnMinus||e.target===btnPlus) return;
      var pt=root.createSVGPoint(); pt.x=e.clientX; pt.y=e.clientY;
      var p=pt.matrixTransform(root.getScreenCTM().inverse());
      var ang=Math.atan2(p.y,p.x); if(ang<0) ang+=TAU;
      var step=TAU/n; k=Math.max(0,Math.min(n,Math.round(ang/step)));
      rebuildSectors(); updateTexts(); updateAria();
    });
    handle.addEventListener("keydown",function(e){
      var used=false;
      switch(e.key){
        case "ArrowRight": case "ArrowUp":   k=Math.min(n,k+1); used=true; break;
        case "ArrowLeft":  case "ArrowDown": k=Math.max(0,k-1); used=true; break;
        case "Home": k=0; used=true; break;
        case "End":  k=n; used=true; break;
      }
      if(used){ e.preventDefault(); rebuildSectors(); updateTexts(); updateAria(); }
    });
  }
  function clickMinus(){ setN(n-1); }
  function clickPlus(){ setN(n+1); }
  btnMinus.addEventListener("click",clickMinus);
  btnPlus .addEventListener("click",clickPlus);
  btnMinus.addEventListener("keydown",function(e){
    if(e.key==="Enter"||e.key===" "||e.key==="-"||e.key==="ArrowLeft"){e.preventDefault();clickMinus();}
    if(e.key==="PageDown"){e.preventDefault();setN(n-5);}
  });
  btnPlus.addEventListener("keydown",function(e){
    if(e.key==="Enter"||e.key===" "||e.key==="+"||e.key==="ArrowRight"){e.preventDefault();clickPlus();}
    if(e.key==="PageUp"){e.preventDefault();setN(n+5);}
  });

  rebuildLines(); rebuildSectors(); updateTexts(); updateAria();
})();
/*]]>*/
`;

/* =======================
   Last ned figurer: statisk SVG
   ======================= */
function buildBropizzaExportMeta(options = {}) {
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const instances = getVisiblePizzaInstances();
  const description = buildBropizzaAltText();
  const baseName = typeof options.baseName === 'string' && options.baseName ? options.baseName : instances.length > 1 ? 'broksirkler' : 'pizza';
  const slugParts = [baseName, `${instances.length}fig`];
  if (instances.length === 1) {
    const inst = instances[0].inst;
    slugParts.push(`${inst.k || 0}-${inst.n || 1}`);
  }
  const slugBase = slugParts.join(' ');
  const slug = helper && typeof helper.slugify === 'function' ? helper.slugify(slugBase, baseName) : slugParts.join('-').toLowerCase();
  const pizzasSummary = instances.map(({ index, inst }) => ({
    index,
    numerator: inst.k,
    denominator: inst.n,
    textMode: inst.textMode,
    lockedNumerator: !!(inst.cfg && inst.cfg.lockNumerator),
    lockedDenominator: !!(inst.cfg && inst.cfg.lockDenominator)
  }));
  return {
    description,
    slug,
    defaultBaseName: slug || baseName,
    summary: {
      pizzas: pizzasSummary
    },
    instances: pizzasSummary
  };
}
function downloadSVG(svgEl, filename = "pizza.svg") {
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);

  // Fjern interaktive elementer
  clone.querySelectorAll(".handle, .a11y").forEach(el => el.remove());
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  let [minX, minY, w, h] = (clone.getAttribute("viewBox") || "-210 -210 420 420").trim().split(/\s+/).map(Number);
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);
  const bg = mk("rect", {
    x: minX,
    y: minY,
    width: w,
    height: h,
    fill: "#fff"
  });
  clone.insertBefore(bg, clone.firstChild);
  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.setAttribute("type", "text/css");
  styleEl.appendChild(document.createTextNode(getExportSvgStyle()));
  clone.insertBefore(styleEl, clone.firstChild);
  const xml = new XMLSerializer().serializeToString(clone);
  const file = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const baseName = filename.replace(/\.svg$/i, '');
  const meta = buildBropizzaExportMeta({ baseName });
  const htmlTarget = document.querySelector('.figure') || svgEl;
  if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
    helper.exportGraphicWithArchiveWithFallback({
      svgElement: clone,
      htmlTarget,
      suggestedName: filename,
      toolId: 'brokpizza',
      svgString: file,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: meta.summary
    });
    return;
  }
  if (helper && typeof helper.exportSvgWithArchive === 'function') {
    helper.exportSvgWithArchive(clone, filename, 'brokpizza', {
      svgString: file,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: meta.summary
    });
    return;
  }
  const blob = new Blob([file], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =======================
   Last ned figurer: interaktiv SVG
   – brøk OVER, +/− UNDER, pen spacing
   ======================= */
function downloadInteractiveSVG(svgEl, filename = "pizza-interaktiv.svg") {
  var _inst$minN, _inst$maxN;
  if (!svgEl) return;
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  // Utvid viewBox for topp/bunn
  let [minX, minY, w, h] = (clone.getAttribute("viewBox") || "-210 -210 420 420").trim().split(/\s+/).map(Number);
  const M_TOP = 78;
  const M_BOTTOM = 96;
  minY = minY - M_TOP;
  h = h + M_TOP + M_BOTTOM;
  clone.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);

  // Hvit bakgrunn
  const bg = mk("rect", {
    x: minX,
    y: minY,
    width: w,
    height: h,
    fill: "#fff"
  });
  clone.insertBefore(bg, clone.firstChild);

  // Innebygd stil
  const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
  styleEl.setAttribute("type", "text/css");
  styleEl.appendChild(document.createTextNode(getExportSvgStyle()));
  clone.insertBefore(styleEl, clone.firstChild);

  // State fra levende instans
  const inst = REG.get(svgEl);
  const textMode = (inst === null || inst === void 0 ? void 0 : inst.textMode) || "none";
  const nMin = (_inst$minN = inst === null || inst === void 0 ? void 0 : inst.minN) !== null && _inst$minN !== void 0 ? _inst$minN : 1;
  const nMax = (_inst$maxN = inst === null || inst === void 0 ? void 0 : inst.maxN) !== null && _inst$maxN !== void 0 ? _inst$maxN : 24;
  const showNVal = (inst === null || inst === void 0 ? void 0 : inst.showDenominatorValue) !== false;

  // n, k, R
  const n = clone.querySelectorAll(".sector").length || 1;
  const k = clone.querySelectorAll(".sector-fill").length || 0;
  const rEl = clone.querySelector("circle.rim");
  const R = rEl ? parseFloat(rEl.getAttribute("r") || "180") : 180;

  // Oppdater beskrivelses-elementer slik at eksportert SVG forklarer
  // gjeldende brøk og totalt sektortall. Dette gjør at både skjermlesere
  // og videre interaksjon via innebygd skript starter med korrekt tekst.
  const tEl = clone.querySelector('title');
  const dEl = clone.querySelector('desc');
  if (tEl) tEl.textContent = `Brøkpizza: ${k}/${n}`;
  if (dEl) dEl.textContent = `Viser ${n} sektorer totalt, ${k} av dem er fylt`;

  // Sørg for at handle vises
  const hndl = clone.querySelector(".handle");
  if (hndl && hndl.parentNode && hndl.parentNode.style) hndl.parentNode.style.display = "";

  // Data for skriptet
  clone.setAttribute("data-n", String(n));
  clone.setAttribute("data-k", String(k));
  clone.setAttribute("data-r", String(R));
  clone.setAttribute("data-textmode", textMode);
  clone.setAttribute("data-nmin", String(nMin));
  clone.setAttribute("data-nmax", String(nMax));
  clone.setAttribute("data-show-nval", showNVal ? "1" : "0");

  // Inline-skript (med rettet parentes-feil)
  const scriptEl = document.createElementNS("http://www.w3.org/2000/svg", "script");
  scriptEl.setAttribute("type", "application/ecmascript");
  scriptEl.appendChild(document.createTextNode(INTERACTIVE_SVG_SCRIPT));
  clone.appendChild(scriptEl);
  const xml = new XMLSerializer().serializeToString(clone);
  const file = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;
  const blob = new Blob([file], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function getVisiblePizzas() {
  return PIZZA_DOM.map(m => document.getElementById(m.svgId)).filter(svg => {
    var _svg$closest;
    return svg && ((_svg$closest = svg.closest(".pizzaPanel")) === null || _svg$closest === void 0 ? void 0 : _svg$closest.style.display) !== "none";
  });
}
function buildAllPizzasSvgData() {
  const svgs = getVisiblePizzas();
  if (!svgs.length) return null;
  const gap = 24,
    size = 420,
    opW = 80,
    ops = SIMPLE.ops || [];
  const opCount = ops.slice(0, svgs.length - 1).filter(o => o).length;
  const w = size * svgs.length + gap * (svgs.length - 1) + opW * opCount;
  const h = size;
  const root = mk("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`
  });
  const titleEl = mk('title', { id: 'brokpizza-alt-title' });
  titleEl.textContent = getBrokpizzaTitle();
  const descEl = mk('desc', { id: 'brokpizza-alt-desc' });
  descEl.textContent = getActiveAltText();
  const bg = mk("rect", {
    x: 0,
    y: 0,
    width: w,
    height: h,
    fill: "#fff"
  });
  root.append(titleEl, descEl, bg);
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', titleEl.textContent);
  root.setAttribute('aria-labelledby', titleEl.id);
  root.setAttribute('aria-describedby', descEl.id);
  const styleEl = mk("style", {
    type: "text/css"
  });
  styleEl.appendChild(document.createTextNode(getExportSvgStyle()));
  root.appendChild(styleEl);
  let x = 0;
  svgs.forEach((svg, i) => {
    const clone = svg.cloneNode(true);
    clone.querySelectorAll(".handle, .a11y").forEach(el => el.remove());
    clone.setAttribute("x", x);
    clone.setAttribute("y", 0);
    clone.setAttribute("width", size);
    clone.setAttribute("height", size);
    root.appendChild(clone);
    x += size;
    const sign = ops[i];
    if (i < svgs.length - 1) {
      if (sign) {
        x += opW / 2;
        const t = mk("text", {
          x: x,
          y: size / 2,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": "80"
        });
        t.textContent = sign;
        root.appendChild(t);
        x += opW / 2;
      }
      x += gap;
    }
  });
  const xml = new XMLSerializer().serializeToString(root);
  return {
    svg: root,
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n` + xml
  };
}
function buildAllPizzasSVG() {
  const data = buildAllPizzasSvgData();
  return data ? data.xml : null;
}
function downloadAllPizzasSVG(filename = "broksirkler.svg") {
  const data = buildAllPizzasSvgData();
  if (!data) return;
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const meta = buildBropizzaExportMeta({ baseName: filename.replace(/\.svg$/i, '') });
  const htmlTarget = document.querySelector('.figure') || data.svg;
  if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
    helper.exportGraphicWithArchiveWithFallback({
      svgElement: data.svg,
      htmlTarget,
      suggestedName: filename,
      toolId: 'brokpizza',
      svgString: data.xml,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: meta.summary
    });
    return;
  }
  if (helper && typeof helper.exportSvgWithArchive === 'function') {
    helper.exportSvgWithArchive(data.svg, filename, 'brokpizza', {
      svgString: data.xml,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: meta.summary
    });
    return;
  }
  const blob = new Blob([data.xml], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function downloadAllPizzasPNG(filename = "broksirkler.png") {
  const data = buildAllPizzasSvgData();
  if (!data) return;
  const blob = new Blob([data.xml], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const w = img.width;
    const h = img.height;
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const sizing = helper && typeof helper.ensureMinimumPngDimensions === 'function'
      ? helper.ensureMinimumPngDimensions({ width: w, height: h })
      : (() => {
          const minDimension = 100;
          const safeWidth = Number.isFinite(w) && w > 0 ? w : minDimension;
          const safeHeight = Number.isFinite(h) && h > 0 ? h : minDimension;
          return {
            width: Math.max(minDimension, Math.round(safeWidth)),
            height: Math.max(minDimension, Math.round(safeHeight))
          };
        })();
    const canvas = document.createElement('canvas');
    canvas.width = sizing.width;
    canvas.height = sizing.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(b => {
      const urlPng = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = urlPng;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(urlPng);
    }, 'image/png');
  };
  img.src = url;
}
function downloadAllPizzasInteractiveSVG(filename = "broksirkler-interaktiv.svg") {
  const svgs = getVisiblePizzas();
  if (!svgs.length) return;
  const gap = 24,
    size = 420,
    M_TOP = 78,
    M_BOTTOM = 96,
    opW = 80,
    ops = SIMPLE.ops || [];
  const opCount = ops.slice(0, svgs.length - 1).filter(o => o).length;
  const w = size * svgs.length + gap * (svgs.length - 1) + opW * opCount;
  const h = size + M_TOP + M_BOTTOM;
  const root = mk("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    "xmlns:xlink": "http://www.w3.org/1999/xlink",
    width: w,
    height: h,
    viewBox: `0 0 ${w} ${h}`
  });
  const titleEl = mk('title', { id: 'brokpizza-alt-title' });
  titleEl.textContent = getBrokpizzaTitle();
  const descEl = mk('desc', { id: 'brokpizza-alt-desc' });
  descEl.textContent = getActiveAltText();
  const bg = mk("rect", {
    x: 0,
    y: 0,
    width: w,
    height: h,
    fill: "#fff"
  });
  root.append(titleEl, descEl, bg);
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', titleEl.textContent);
  root.setAttribute('aria-labelledby', titleEl.id);
  root.setAttribute('aria-describedby', descEl.id);
  const styleEl = mk("style", {
    type: "text/css"
  });
  styleEl.appendChild(document.createTextNode(getExportSvgStyle()));
  root.appendChild(styleEl);
  let x = 0;
  svgs.forEach((svg, i) => {
    var _inst$minN2, _inst$maxN2;
    const clone = svg.cloneNode(true);
    const inst = REG.get(svg);
    const textMode = (inst === null || inst === void 0 ? void 0 : inst.textMode) || "none";
    const nMin = (_inst$minN2 = inst === null || inst === void 0 ? void 0 : inst.minN) !== null && _inst$minN2 !== void 0 ? _inst$minN2 : 1;
    const nMax = (_inst$maxN2 = inst === null || inst === void 0 ? void 0 : inst.maxN) !== null && _inst$maxN2 !== void 0 ? _inst$maxN2 : 24;
    const showNVal = (inst === null || inst === void 0 ? void 0 : inst.showDenominatorValue) !== false;
    const n = clone.querySelectorAll(".sector").length || 1;
    const k = clone.querySelectorAll(".sector-fill").length || 0;
    const rEl = clone.querySelector("circle.rim");
    const R = rEl ? parseFloat(rEl.getAttribute("r") || "180") : 180;
    const hndl = clone.querySelector(".handle");
    if (hndl && hndl.parentNode && hndl.parentNode.style) hndl.parentNode.style.display = "";
    // Sikre at hver eksportert SVG får oppdatert <title>/<desc>
    // slik at tilgjengelighetsbeskrivelsen matcher gjeldende brøk.
    const tEl = clone.querySelector('title');
    const dEl = clone.querySelector('desc');
    if (tEl) tEl.textContent = `Brøkpizza: ${k}/${n}`;
    if (dEl) dEl.textContent = `Viser ${n} sektorer totalt, ${k} av dem er fylt`;
    clone.setAttribute("data-n", String(n));
    clone.setAttribute("data-k", String(k));
    clone.setAttribute("data-r", String(R));
    clone.setAttribute("data-textmode", textMode);
    clone.setAttribute("data-nmin", String(nMin));
    clone.setAttribute("data-nmax", String(nMax));
    clone.setAttribute("data-show-nval", showNVal ? "1" : "0");
    clone.setAttribute("x", x);
    clone.setAttribute("y", M_TOP);
    clone.setAttribute("width", size);
    clone.setAttribute("height", size);
    const scriptEl = document.createElementNS("http://www.w3.org/2000/svg", "script");
    scriptEl.setAttribute("type", "application/ecmascript");
    scriptEl.appendChild(document.createTextNode(INTERACTIVE_SVG_SCRIPT));
    clone.appendChild(scriptEl);
    root.appendChild(clone);
    x += size;
    const sign = ops[i];
    if (i < svgs.length - 1) {
      if (sign) {
        x += opW / 2;
        const t = mk("text", {
          x: x,
          y: M_TOP + size / 2,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          "font-size": "80"
        });
        t.textContent = sign;
        root.appendChild(t);
        x += opW / 2;
      }
      x += gap;
    }
  });
  const xml = new XMLSerializer().serializeToString(root);
  const file = `<?xml version="1.0" encoding="UTF-8"?>\n` + xml;
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const meta = buildBropizzaExportMeta({ baseName: filename.replace(/\.svg$/i, '') });
  const htmlTarget = document.querySelector('.figure') || root;
  if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
    helper.exportGraphicWithArchiveWithFallback({
      svgElement: root,
      htmlTarget,
      suggestedName: filename,
      toolId: 'brokpizza',
      svgString: file,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: { ...meta.summary, interactive: true }
    });
    return;
  }
  if (helper && typeof helper.exportSvgWithArchive === 'function') {
    helper.exportSvgWithArchive(root, filename, 'brokpizza', {
      svgString: file,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: { ...meta.summary, interactive: true }
    });
    return;
  }
  const blob = new Blob([file], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function setupGlobalDownloadButtons() {
  const btnStatic = document.getElementById("btnStaticAll");
  const btnInteractive = document.getElementById("btnInteractiveAll");
  const btnPng = document.getElementById("btnPngAll");
  if (btnStatic) btnStatic.addEventListener("click", () => downloadAllPizzasSVG());
  if (btnInteractive) btnInteractive.addEventListener("click", () => downloadAllPizzasInteractiveSVG());
  if (btnPng) btnPng.addEventListener("click", () => downloadAllPizzasPNG());
}

/* =======================
   Alt-tekst
   ======================= */
function getBrokpizzaTitle() {
  return document.title || 'Brøksirkler';
}

function formatDecimal(value) {
  if (!Number.isFinite(value)) return '0';
  const str = value.toFixed(2);
  const trimmed = str.replace(/\.?0+$/, '');
  return trimmed.replace('.', ',');
}

function formatPercent(value) {
  return `${formatDecimal(value * 100)} %`;
}

function formatCount(value, singular) {
  const word = Math.abs(value) === 1 ? singular : `${singular}er`;
  return `${value} ${word}`;
}

function describeLocks(pizza) {
  if (!pizza || !pizza.cfg) return '';
  const locks = [];
  if (pizza.cfg.lockNumerator) locks.push('telleren');
  if (pizza.cfg.lockDenominator) locks.push('nevneren');
  if (!locks.length) return '';
  if (locks.length === 2) {
    return 'Både telleren og nevneren er låst.';
  }
  return `${locks[0].charAt(0).toUpperCase()}${locks[0].slice(1)} er låst.`;
}

function getVisiblePizzaInstances() {
  const instances = [];
  PIZZA_DOM.forEach((map, idx) => {
    const svgEl = document.getElementById(map.svgId);
    const inst = svgEl ? REG.get(svgEl) : null;
    const cfg = SIMPLE.pizzas[idx] || {};
    const panel = document.getElementById(`panel${idx + 1}`);
    const visible = cfg.visible !== false && panel && panel.style.display !== 'none';
    if (!visible || !inst) return;
    instances.push({ index: idx, inst, cfg });
  });
  return instances;
}

function runTaskCheck() {
  const solutions = normalizeSolution(SIMPLE.solution);
  const pizzas = getVisiblePizzaInstances();
  if (!pizzas.length || !pizzas[0] || !pizzas[0].inst) {
    setCheckStatus('info', 'Ingen brøkpizza er tilgjengelig for å sjekke.');
    return;
  }
  const target = pizzas[0];
  const solution = solutions[target.index] || solutions[0];
  if (!solution || solution.numerator == null || solution.denominator == null) {
    setCheckStatus('info', 'Ingen fasit er definert ennå.');
    return;
  }
  const { inst } = target;
  const numerator = inst.k;
  const denominator = inst.n;
  const pizzaLabel = pizzas.length > 1 || (target && target.index > 0) ? `Pizza ${target.index + 1}: ` : '';
  const details = [];
  if (numerator !== solution.numerator) {
    details.push(`${pizzaLabel}Teller skal være ${solution.numerator}, men er ${numerator}.`);
  }
  if (denominator !== solution.denominator) {
    details.push(`${pizzaLabel}Nevner skal være ${solution.denominator}, men er ${denominator}.`);
  }
  if (!details.length) {
    setCheckStatus('success', 'Brøken er riktig!');
    return;
  }
  setCheckStatus('error', 'Ikke helt riktig ennå.', details);
}

function buildBropizzaAltText() {
  const pizzas = getVisiblePizzaInstances();
  if (!pizzas.length) {
    return 'Figuren viser ingen brøksirkler.';
  }
  const ops = Array.isArray(SIMPLE.ops) ? SIMPLE.ops : [];
  if (pizzas.length === 1) {
    const { index, inst } = pizzas[0];
    const numerator = inst.k;
    const denominator = inst.n || 1;
    const locks = describeLocks(inst);
    const textMode = inst.textMode;
    const hasExtraInfo = Boolean(locks) || textMode === 'percent' || textMode === 'decimal';
    const hasOperator = Boolean(ops[index]);
    if (!hasExtraInfo && !hasOperator) {
      return `Brøksirkel med ${formatCount(numerator, 'del')} av ${formatCount(denominator, 'del')} fylt.`;
    }
  }
  const sentences = [];
  sentences.push(`Figuren viser ${pizzas.length === 1 ? 'én brøksirkel' : `${pizzas.length} brøksirkler`}.`);
  pizzas.forEach(({ index, inst }) => {
    const numerator = inst.k;
    const denominator = inst.n || 1;
    const gcdValue = gcd(numerator, denominator);
    const simplified = gcdValue > 1 ? `${numerator / gcdValue}/${denominator / gcdValue}` : null;
    let sentence = `Brøksirkel ${index + 1} viser ${formatCount(numerator, 'del')} av ${formatCount(denominator, 'del')} fylt`;
    if (simplified) {
      sentence += ` (${simplified} i enkleste form)`;
    }
    sentence += '.';
    const ratio = denominator ? numerator / denominator : 0;
    if (inst.textMode === 'percent') {
      sentence += ` Dette tilsvarer ${formatPercent(ratio)}.`;
    } else if (inst.textMode === 'decimal') {
      sentence += ` Dette tilsvarer desimaltallet ${formatDecimal(ratio)}.`;
    }
    const locks = describeLocks(inst);
    if (locks) sentence += ` ${locks}`;
    sentences.push(sentence);
  });
  pizzas.forEach((entry, idx) => {
    if (idx >= pizzas.length - 1) return;
    const op = ops[entry.index];
    if (!op) return;
    const left = entry.index + 1;
    const right = pizzas[idx + 1].index + 1;
    let name;
    switch (op) {
      case '+':
        name = 'pluss-tegn';
        break;
      case '-':
        name = 'minus-tegn';
        break;
      case '=':
        name = 'likhetstegn';
        break;
      default:
        name = `operatoren «${op}»`;
    }
    sentences.push(`Mellom brøksirkel ${left} og ${right} står ${name}.`);
  });
  return sentences.join(' ');
}

function getActiveAltText() {
  const stored = typeof SIMPLE.altText === 'string' ? SIMPLE.altText.trim() : '';
  return stored || buildBropizzaAltText();
}

function refreshAltText(reason) {
  const signature = buildBropizzaAltText();
  if (altTextManager && typeof altTextManager.refresh === 'function') {
    altTextManager.refresh(reason || 'auto', signature);
  } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
    altTextManager.notifyFigureChange(signature);
  }
}

function initAltTextManager() {
  if (!window.MathVisAltText) return;
  const container = document.getElementById('exportCard');
  if (!container) return;
  const anchor = ensureAltTextAnchor();
  altTextManager = window.MathVisAltText.create({
    svg: () => anchor,
    container,
    getTitle: getBrokpizzaTitle,
    getState: () => ({
      text: typeof SIMPLE.altText === 'string' ? SIMPLE.altText : '',
      source: SIMPLE.altTextSource === 'manual' ? 'manual' : 'auto'
    }),
    setState: (text, source) => {
      SIMPLE.altText = text;
      SIMPLE.altTextSource = source === 'manual' ? 'manual' : 'auto';
    },
    generate: () => buildBropizzaAltText(),
    getSignature: () => buildBropizzaAltText(),
    getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
    getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
  });
  const figure = document.querySelector('.grid2');
  if (figure && window.MathVisAltText) {
    const nodes = window.MathVisAltText.ensureSvgA11yNodes(anchor);
    figure.setAttribute('role', 'img');
    figure.setAttribute('aria-label', getBrokpizzaTitle());
    if (nodes.titleEl && nodes.titleEl.id) figure.setAttribute('aria-labelledby', nodes.titleEl.id);
    if (nodes.descEl && nodes.descEl.id) figure.setAttribute('aria-describedby', nodes.descEl.id);
  }
}

function ensureAltTextAnchor() {
  let anchor = document.getElementById('brokpizza-alt-anchor');
  if (!anchor) {
    anchor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    anchor.setAttribute('id', 'brokpizza-alt-anchor');
    anchor.setAttribute('width', '0');
    anchor.setAttribute('height', '0');
    anchor.style.position = 'absolute';
    anchor.style.left = '-9999px';
    anchor.style.width = '0';
    anchor.style.height = '0';
    document.body.appendChild(anchor);
  }
  return anchor;
}

/* =======================
   Init
   ======================= */
function initFromHtml() {
  const cfg = readConfigFromHtml();
  const previousPizzas = Array.isArray(SIMPLE.pizzas) ? SIMPLE.pizzas : [];
  cfg.pizzas = cfg.pizzas.map((pizza, idx) => ({
    ...pizza,
    fillColorIndex: Number.isFinite(pizza.fillColorIndex) ? pizza.fillColorIndex : previousPizzas[idx]?.fillColorIndex
  }));
  SIMPLE.pizzas = cfg.pizzas;
  SIMPLE.ops = cfg.ops;
  SIMPLE.solution = normalizeSolution(cfg.solution);
  clearCheckStatus();
  updateDenominatorValueToggles();
  let visibleCount = 0;
  REG.clear();
  PIZZA_DOM.forEach((map, i) => {
    var _document$getElementB12, _pcfg$minN, _pcfg$maksN, _map$index, _pcfg$n, _pcfg$t, _pcfg$n2, _pcfg$text;
    const panel = (_document$getElementB12 = document.getElementById(map.svgId)) === null || _document$getElementB12 === void 0 ? void 0 : _document$getElementB12.closest(".pizzaPanel");
    if (!panel) return;
    if (PANEL_HTML[i] == null) PANEL_HTML[i] = panel.innerHTML;
    panel.innerHTML = PANEL_HTML[i];
    const isVisible = panel.style.display !== "none";
    if (!SIMPLE.pizzas[i]) SIMPLE.pizzas[i] = {};
    SIMPLE.pizzas[i].visible = isVisible;
    if (!isVisible) return;
    visibleCount++;
    const pcfg = cfg.pizzas[i];
    const minN = Math.max(1, (_pcfg$minN = pcfg.minN) !== null && _pcfg$minN !== void 0 ? _pcfg$minN : 1);
    const maxN = Math.max(minN, (_pcfg$maksN = pcfg.maksN) !== null && _pcfg$maksN !== void 0 ? _pcfg$maksN : 24);
    new Pizza({
      ...map,
      index: (_map$index = map.index) !== null && _map$index !== void 0 ? _map$index : i,
      n: (_pcfg$n = pcfg.n) !== null && _pcfg$n !== void 0 ? _pcfg$n : 1,
      k: Math.min((_pcfg$t = pcfg.t) !== null && _pcfg$t !== void 0 ? _pcfg$t : 0, (_pcfg$n2 = pcfg.n) !== null && _pcfg$n2 !== void 0 ? _pcfg$n2 : 1),
      minN,
      maxN,
      textMode: (_pcfg$text = pcfg.text) !== null && _pcfg$text !== void 0 ? _pcfg$text : "none",
      lockDenominator: !!pcfg.lockN,
      lockNumerator: !!pcfg.lockT,
      showDenominatorValue: !pcfg.hideNVal
    });
  });
  cfg.ops.forEach((op, i) => {
    const displayEl = document.getElementById(`opDisplay${i + 1}`);
    const nextPanel = document.getElementById(`panel${i + 2}`);
    const wrapper = document.getElementById(`op${i + 1}Wrapper`);
    const select = document.getElementById(`op${i + 1}`);
    const hasRightPizza = !!(nextPanel && nextPanel.style.display !== "none");
    if (wrapper) wrapper.style.display = hasRightPizza ? "" : "none";
    if (!hasRightPizza && select) select.value = "";
    if (!displayEl) return;
    if (op && hasRightPizza) {
      displayEl.textContent = op;
      displayEl.style.display = "";
    } else {
      displayEl.style.display = "none";
    }
  });
  updateDenominatorValueToggles();
  scheduleCenterAlign();
  fitPizzasToLine();
  setupRemovePizzaButtons();
  if (visibleCount <= 0) {
    const firstPanel = document.getElementById('panel1');
    if (firstPanel && firstPanel.style.display !== "none") visibleCount = 1;else visibleCount = 0;
  }
  SIMPLE.visibleCount = visibleCount || 1;
  applyPizzaColors();
  renderFillColorPickers();
  refreshAltText('config');
}
window.addEventListener("load", () => {
  initFromHtml();
  setupGlobalDownloadButtons();
  initAltTextManager();
  refreshAltText('init');
  const addBtn = document.getElementById('addPizza');
  const fieldset2 = document.getElementById('fieldset2');
  const fieldset3 = document.getElementById('fieldset3');
  addBtn === null || addBtn === void 0 || addBtn.addEventListener('click', () => {
    const panel2 = document.getElementById('panel2');
    const panel3 = document.getElementById('panel3');
    if (panel2 && panel2.style.display === 'none') {
      panel2.style.display = '';
      if (fieldset2) fieldset2.style.display = '';
    } else if (panel3 && panel3.style.display === 'none') {
      panel3.style.display = '';
      if (fieldset3) fieldset3.style.display = '';
      addBtn.style.display = 'none';
    }
    initFromHtml();
  });
  document.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("input", initFromHtml);
    el.addEventListener("change", initFromHtml);
  });
});

function updateDenominatorValueToggles() {
  for (let i = 1; i <= 3; i++) {
    const canChangeCheckbox = document.getElementById(`p${i}LockN`);
    const showValueCheckbox = document.getElementById(`p${i}HideNVal`);
    const row = showValueCheckbox === null || showValueCheckbox === void 0 ? void 0 : showValueCheckbox.closest('[data-denominator-visibility]');
    const canChange = !!(canChangeCheckbox && canChangeCheckbox.checked);
    if (showValueCheckbox) showValueCheckbox.disabled = !canChange;
    if (row) row.classList.toggle('checkbox-row--disabled', !canChange);
  }
}
function applySimpleConfigToInputs() {
  const pizzas = Array.isArray(SIMPLE.pizzas) ? SIMPLE.pizzas : [];
  const ops = Array.isArray(SIMPLE.ops) ? SIMPLE.ops : [];
  const clampCount = val => {
    const num = Number(val);
    if (!Number.isFinite(num)) return null;
    return Math.min(3, Math.max(1, Math.round(num)));
  };
  let visible = clampCount(SIMPLE.visibleCount);
  if (visible == null) {
    visible = pizzas.reduce((acc, p, idx) => {
      if (idx === 0) return acc + 1;
      if (p && (p.visible || p !== null && p !== void 0 && p.lockN || p !== null && p !== void 0 && p.lockT || p !== null && p !== void 0 && p.text || p !== null && p !== void 0 && p.t || p !== null && p !== void 0 && p.n)) return acc + 1;
      return acc;
    }, 0);
    if (!visible) visible = 1;
  }
  for (let i = 1; i <= 3; i++) {
    const panel = document.getElementById(`panel${i}`);
    const fieldset = document.getElementById(`fieldset${i}`);
    const shouldShow = i <= visible;
    if (panel) panel.style.display = shouldShow ? "" : "none";
    if (fieldset) fieldset.style.display = shouldShow ? "" : "none";
    if (!SIMPLE.pizzas[i - 1]) SIMPLE.pizzas[i - 1] = {};
    SIMPLE.pizzas[i - 1].visible = shouldShow;
  }
  const addBtn = document.getElementById('addPizza');
  if (addBtn) addBtn.style.display = visible >= 3 ? 'none' : '';
  SIMPLE.visibleCount = visible;
  const ensurePizza = idx => {
    var _base$text;
    const base = pizzas[idx] || {};
    return {
      t: Number.isFinite(base.t) ? base.t : idx === 0 ? 3 : 0,
      n: Number.isFinite(base.n) ? Math.max(1, base.n) : 10,
      lockN: !!base.lockN,
      lockT: !!base.lockT,
      text: (_base$text = base.text) !== null && _base$text !== void 0 ? _base$text : 'none',
      hideNVal: !!base.hideNVal,
      minN: Number.isFinite(base.minN) ? base.minN : 1,
      maksN: Number.isFinite(base.maksN) ? base.maksN : 24
    };
  };
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el && value != null) el.value = String(value);
  };
  const setChk = (id, checked) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!checked;
  };
  for (let i = 1; i <= 3; i++) {
    const cfg = ensurePizza(i - 1);
    setVal(`p${i}T`, cfg.t);
    setVal(`p${i}N`, cfg.n);
    setChk(`p${i}LockN`, !cfg.lockN);
    setChk(`p${i}LockT`, !cfg.lockT);
    setVal(`p${i}Text`, cfg.text);
    setChk(`p${i}HideNVal`, !cfg.hideNVal);
    setVal(`p${i}MinN`, cfg.minN);
    setVal(`p${i}MaxN`, cfg.maksN);
    const textSel = document.getElementById(`p${i}Text`);
    if (textSel && cfg.text) textSel.value = cfg.text;
  }
  updateDenominatorValueToggles();
  ops.forEach((op, idx) => {
    const wrapper = document.getElementById(`op${idx + 1}Wrapper`);
    const selectId = `op${idx + 1}`;
    const select = document.getElementById(selectId);
    const rightPanel = document.getElementById(`panel${idx + 2}`);
    const shouldShow = !!(rightPanel && rightPanel.style.display !== "none");
    if (wrapper) wrapper.style.display = shouldShow ? "" : "none";
    if (shouldShow) {
      setVal(selectId, op !== null && op !== void 0 ? op : "");
    } else if (select) {
      select.value = "";
    }
  });
  const normalizedSolution = normalizeSolution(SIMPLE.solution);
  normalizedSolution.forEach((solution, idx) => {
    const numInput = document.getElementById(`p${idx + 1}SolutionNumerator`);
    if (numInput) {
      numInput.value = solution.numerator != null ? String(solution.numerator) : '';
    }
    const denInput = document.getElementById(`p${idx + 1}SolutionDenominator`);
    if (denInput) {
      denInput.value = solution.denominator != null ? String(solution.denominator) : '';
    }
  });
  SIMPLE.solution = normalizedSolution;
}
function applyExamplesConfig() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyExamplesConfig, {
      once: true
    });
    return;
  }
  applySimpleConfigToInputs();
  initFromHtml();
}

function clampVisiblePizzaCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(3, Math.max(1, Math.round(num)));
}

function sanitizeStringValue(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizePizzaState(pizza, index, visibleCount, fallbackFillIndex) {
  const base = pizza && typeof pizza === 'object' ? pizza : {};
  const minN = Number.isFinite(base.minN) && base.minN > 0 ? Math.trunc(base.minN) : 1;
  const maxNRaw = Number.isFinite(base.maksN)
    ? base.maksN
    : Number.isFinite(base.maxN)
      ? base.maxN
      : null;
  const maxN = Math.max(minN, Number.isFinite(maxNRaw) && maxNRaw > 0 ? Math.trunc(maxNRaw) : 24);
  const n = Number.isFinite(base.n) && base.n > 0 ? Math.trunc(base.n) : 1;
  const tValue = Number.isFinite(base.t) ? base.t : Number.isFinite(base.k) ? base.k : 0;
  const text = sanitizeStringValue(base.text) || 'none';
  const visible = visibleCount != null ? index < visibleCount : index === 0 || !!base.visible;
  const fillColorIndex = sanitizeFillIndex(
    Number.isFinite(base.fillColorIndex) ? base.fillColorIndex : fallbackFillIndex,
    FILL_COLOR_COUNT
  );
  return {
    t: Math.max(0, Math.trunc(tValue)),
    n,
    lockN: !!base.lockN,
    lockT: !!base.lockT,
    text,
    hideNVal: !!base.hideNVal,
    minN,
    maksN: maxN,
    visible,
    fillColorIndex
  };
}

function sanitizeOpsArray(rawOps) {
  const ops = Array.isArray(rawOps) ? rawOps : [];
  const validOps = new Set(['+', '-', '=', '']);
  return Array.from({ length: 2 }, (_, idx) => {
    const op = sanitizeStringValue(ops[idx]) || '';
    return validOps.has(op) ? op : '';
  });
}

function getPaletteThemeSelectionState() {
  if (typeof document === 'undefined' || !document.documentElement) return null;
  const root = document.documentElement;
  const project =
    sanitizeStringValue(root.getAttribute('data-project')) ||
    sanitizeStringValue(root.getAttribute('data-mv-active-project')) ||
    sanitizeStringValue(resolvePaletteProjectName());
  const themeProfile = sanitizeStringValue(root.getAttribute('data-theme-profile'));
  if (!project && !themeProfile) return null;
  return { project, themeProfile };
}

function createCleanState() {
  const fallbackFillIndex = sanitizeFillIndex(SIMPLE.fillColorIndex, FILL_COLOR_COUNT);
  const pizzas = Array.from({ length: 3 }, (_, idx) =>
    normalizePizzaState(SIMPLE.pizzas[idx], idx, clampVisiblePizzaCount(SIMPLE.visibleCount), fallbackFillIndex)
  );
  const visibleCount = clampVisiblePizzaCount(SIMPLE.visibleCount) || Math.max(1, pizzas.filter(p => p.visible).length || 0);
  const state = {
    pizzas,
    ops: sanitizeOpsArray(SIMPLE.ops),
    solution: normalizeSolution(SIMPLE.solution),
    visibleCount,
    altText: typeof SIMPLE.altText === 'string' ? SIMPLE.altText : '',
    altTextSource: SIMPLE.altTextSource === 'manual' ? 'manual' : 'auto',
    fillColorIndex: fallbackFillIndex
  };
  const palette = getPaletteThemeSelectionState();
  if (palette) {
    state.palette = palette;
  }
  return { v: 1, ...state };
}

function normalizePaletteSelection(selection) {
  if (!selection || typeof selection !== 'object') return null;
  const project = sanitizeStringValue(selection.project || selection.paletteProject);
  const themeProfile = sanitizeStringValue(selection.themeProfile || selection.profile || selection.theme);
  if (!project && !themeProfile) return null;
  return { project, themeProfile };
}

function normalizeCleanStatePayload(payload) {
  const parseCandidate = candidate => {
    if (candidate == null) return null;
    if (typeof candidate === 'string') {
      try {
        return JSON.parse(candidate);
      } catch (_) {
        return null;
      }
    }
    return candidate;
  };
  const parsed = parseCandidate(payload);
  const state = parsed && parsed.v === 1 ? parsed : parsed && parsed.state && parsed.state.v === 1 ? parsed.state : null;
  if (!state || state.v !== 1) return null;
  const visibleCount = clampVisiblePizzaCount(state.visibleCount);
  const fallbackFillIndex = sanitizeFillIndex(state.fillColorIndex, FILL_COLOR_COUNT);
  const pizzas = Array.from({ length: 3 }, (_, idx) =>
    normalizePizzaState(
      Array.isArray(state.pizzas) ? state.pizzas[idx] : null,
      idx,
      visibleCount,
      fallbackFillIndex
    )
  );
  const resolvedVisibleCount = visibleCount || Math.max(1, pizzas.filter(p => p.visible).length || 0);
  return {
    pizzas,
    ops: sanitizeOpsArray(state.ops),
    solution: normalizeSolution(state.solution),
    visibleCount: resolvedVisibleCount,
    altText: typeof state.altText === 'string' ? state.altText : '',
    altTextSource: state.altTextSource === 'manual' ? 'manual' : 'auto',
    fillColorIndex: fallbackFillIndex,
    palette: normalizePaletteSelection(state.palette)
  };
}

function applyPaletteThemeSelection(selection) {
  const palette = normalizePaletteSelection(selection);
  if (!palette) return;
  if (typeof document === 'undefined' || !document.documentElement) return;
  const root = document.documentElement;
  if (palette.project) {
    root.setAttribute('data-project', palette.project);
    root.setAttribute('data-mv-active-project', palette.project);
  }
  if (palette.themeProfile) {
    root.setAttribute('data-theme-profile', palette.themeProfile);
  }
  applyThemeToDocument();
}

function loadCleanState(payload) {
  const state = normalizeCleanStatePayload(payload);
  if (!state) return false;
  SIMPLE.pizzas = state.pizzas;
  SIMPLE.ops = state.ops;
  SIMPLE.solution = state.solution;
  SIMPLE.visibleCount = state.visibleCount;
  SIMPLE.altText = state.altText;
  SIMPLE.altTextSource = state.altTextSource;
  SIMPLE.fillColorIndex = sanitizeFillIndex(state.fillColorIndex, FILL_COLOR_COUNT);
  applyPaletteThemeSelection(state.palette);
  applyPizzaColors();
  renderFillColorPickers();
  applyExamplesConfig();
  refreshAltText('manual-load');
  return true;
}
let isReadOnlyPreview = false;
function setReadOnlyPreview(enabled) {
  isReadOnlyPreview = !!enabled;
}
function setEditMode() {
  setReadOnlyPreview(false);
}
function serializeCleanState(payload) {
  const normalized = normalizeCleanStatePayload(payload);
  if (!normalized) return false;
  return loadCleanState(normalized);
}

/* =======================
   SETUP & SYNC (ANTI-FLIMMER & DOM-OVERVÅKNING)
   ======================= */

let themeRefreshTimer = null;

function handleThemeChange() {
  // Hvis en oppdatering allerede venter, avbryt den (stopp flimring)
  if (themeRefreshTimer) {
    clearTimeout(themeRefreshTimer);
  }

  // Vent 50ms for å la alle systemer (DOM, Settings, API) bli ferdige
  themeRefreshTimer = setTimeout(() => {
    themeRefreshTimer = null;
    
    // 1. Oppdater CSS-variablene basert på gjeldende prosjekt
    applyThemeToDocument();
    
    // 2. Tegn pizzaen på nytt
    if (typeof window !== 'undefined' && typeof window.applyConfig === 'function') {
      window.applyConfig();
    } else {
      initFromHtml();
    }
  }, 50);
}

function refreshPaletteFromSettings() {
  getFractionPalette(FILL_COLOR_COUNT * 2);
  renderFillColorPickers();
  applyPizzaColors();
}

function setupThemeSync() {
  // 1. Overvåk HTML-taggen direkte. Dette er den mest pålitelige metoden.
  // Når 'data-theme-profile' endres, vet vi at prosjektet er byttet.
  if (typeof MutationObserver === 'function' && typeof document !== 'undefined' && document.documentElement) {
    const observer = new MutationObserver((mutations) => {
      let shouldRefresh = false;
      for (const mutation of mutations) {
        if (mutation.type === 'attributes') {
          shouldRefresh = true; // Attributtet er endret -> planlegg oppdatering
          break;
        }
      }
      if (shouldRefresh) {
        handleThemeChange();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-project', 'data-mv-active-project', 'data-theme-profile']
    });
  }

  // 2. Lytt på events (backup, og for fargeendringer internt i et prosjekt)
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const onEvent = () => handleThemeChange();
    const onSettingsEvent = () => {
      refreshPaletteFromSettings();
      handleThemeChange();
    };

    window.addEventListener('math-visuals:settings-changed', onSettingsEvent);
    window.addEventListener('math-visuals:profile-change', onEvent);
    window.addEventListener('math-visuals:project-change', onEvent);
    window.addEventListener('message', (event) => {
      const data = event && event.data;
      const type = typeof data === 'string' ? data : data && data.type;
      if (type === 'math-visuals:profile-change' || type === 'math-visuals:project-change') {
        onEvent();
      }
    });
  }

  // Kjør en gang ved oppstart for å sikre riktig farge
  handleThemeChange();
}

// Start oppsettet
if (typeof window !== 'undefined') {
  window.applyConfig = applyExamplesConfig;
  window.render = applyExamplesConfig;
  window.brøkpizzaApi = {
    cleanJSON: createCleanState,
    normalize: normalizeCleanStatePayload,
    serialize: serializeCleanState,
    setReadOnlyPreview,
    setEditMode
  };

  setupThemeSync();
}
