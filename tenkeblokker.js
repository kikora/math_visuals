/* Tenkeblokker – grid layout */

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

const DEFAULT_FILL_COLOR_INDEX = 1;

const DEFAULT_BLOCKS = [{
  total: 1,
  n: 1,
  k: 1,
  showWhole: false,
  hideBlock: false,
  lockDenominator: true,
  lockNumerator: true,
  hideNValue: true,
  valueDisplay: 'number',
  showCustomText: false,
  customText: '',
  fillColorIndex: DEFAULT_FILL_COLOR_INDEX
}, {
  total: 1,
  n: 1,
  k: 1,
  showWhole: false,
  hideBlock: false,
  lockDenominator: true,
  lockNumerator: true,
  hideNValue: true,
  valueDisplay: 'number',
  showCustomText: false,
  customText: '',
  fillColorIndex: DEFAULT_FILL_COLOR_INDEX
}];
const DEFAULT_TENKEBLOKKER_EXAMPLES = [];
const DISPLAY_OPTIONS = ['number', 'fraction', 'percent'];
const UNION_BRACE_PATH = 'M716 0C722.627 0 728 5.37258 728 12V18C728 19.1046 727.105 20 726 20C724.895 20 724 19.1046 724 18V12C724 7.58173 720.418 4.00001 716 4H12C7.58172 4 4 7.58172 4 12V18C4 19.1046 3.10457 20 2 20C0.895431 20 0 19.1046 0 18V12C0 5.37258 5.37258 0 12 0H716Z';
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
const UNION_BRACE_BOUNDS = Object.freeze({
  left: 12,
  right: 716,
  top: 4,
  bottom: 20
});
const UNION_BRACE_INNER_WIDTH = UNION_BRACE_BOUNDS.right - UNION_BRACE_BOUNDS.left;
const UNION_BRACE_INNER_HEIGHT = UNION_BRACE_BOUNDS.bottom - UNION_BRACE_BOUNDS.top;
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
const FRACTION_FALLBACK_COLORS = Object.freeze([
  '#dbe7ff',
  '#c7d2fe',
  '#fcd34d',
  '#a7f3d0',
  '#fde68a',
  '#fbcfe8'
]);

function getSegmentTextColor(isFilled, textColor) {
  if (isFilled) {
    const activeText = typeof textColor === 'string' ? textColor.trim() : '';
    if (activeText) {
      return activeText;
    }
  }
  return '#000';
}

function hexToRgb(color) {
  if (typeof color !== 'string') return null;
  const trimmed = color.trim();
  if (!trimmed) return null;
  const hex = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (hex.length !== 3 && hex.length !== 6) return null;
  const normalized = hex.length === 3
    ? hex.split('').map(part => part + part).join('')
    : hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some(channel => Number.isNaN(channel))) return null;
  return { r, g, b };
}

function getRelativeLuminance(rgb) {
  if (!rgb || !Number.isFinite(rgb.r) || !Number.isFinite(rgb.g) || !Number.isFinite(rgb.b)) {
    return 0;
  }
  const toLinear = value => {
    const channel = value / 255;
    if (channel <= 0.03928) {
      return channel / 12.92;
    }
    return Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(rgb.r);
  const g = toLinear(rgb.g);
  const b = toLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastTextColor(color) {
  const rgb = hexToRgb(color);
  const luminance = getRelativeLuminance(rgb);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? '#000' : '#fff';
}
function sanitizeFillIndex(value, paletteLength) {
  const numeric = Number.parseInt(value, 10);
  const max = Number.isFinite(paletteLength) && paletteLength > 0 ? paletteLength : FILL_COLOR_COUNT;
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  return Math.min(numeric, max);
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
  const palette = resolveFractionPalette(targetCount);
  const fallbackPalette = resolveFractionFallbackPalette();
  const fallback =
    Array.isArray(fallbackPalette) && fallbackPalette.length ? fallbackPalette : FRACTION_FALLBACK_COLORS;
  const normalized = ensurePaletteCount(palette, fallback, targetCount);
  const fillColors = [];
  const lineColors = [];
  if (roleSlots.length) {
    roleSlots.forEach(role => {
      const fill = normalized[role.fillSlotIndex];
      const line = normalized[role.lineSlotIndex];
      fillColors.push(fill || line || FRACTION_FALLBACK_COLORS[0]);
      lineColors.push(line || fill || '#000000');
    });
  } else {
    for (let index = 0; index < targetCount; index += 3) {
      const fill = normalized[index];
      const line = normalized[index + 1];
      fillColors.push(fill || line || FRACTION_FALLBACK_COLORS[0]);
      lineColors.push(line || fill || '#000000');
    }
  }
  return { fillColors, lineColors };
}
function getBlockFillIndex(cfg, paletteLength) {
  const value = cfg && Object.prototype.hasOwnProperty.call(cfg, 'fillColorIndex') ? cfg.fillColorIndex : DEFAULT_FILL_COLOR_INDEX;
  const index = sanitizeFillIndex(value, paletteLength);
  if (cfg) cfg.fillColorIndex = index;
  return index;
}

function resolveBlockPalette(cfg, paletteOverride, linePaletteOverride) {
  const palette = Array.isArray(paletteOverride) ? paletteOverride : getFillPalette();
  const linePalette = Array.isArray(linePaletteOverride) ? linePaletteOverride : getLinePalette();
  const index = getBlockFillIndex(cfg, palette.length);
  const fill = palette[index - 1] || palette[0] || FRACTION_FALLBACK_COLORS[0];
  return {
    palette,
    index,
    fill,
    line: linePalette[index - 1] || linePalette[0] || '#000000',
    text: getContrastTextColor(fill)
  };
}

function applyBlockPalette(block, paletteData) {
  if (!block || !block.svg || !block.cfg) return null;
  const resolved = paletteData || resolveBlockPalette(block.cfg);
  block.svg.style.setProperty('--tb-fill', resolved.fill);
  block.svg.style.setProperty('--tb-line', resolved.line);
  block.svg.style.setProperty('--tb-text', resolved.text);
  return resolved;
}

function renderBlockFillPicker(block, paletteOverride, linePaletteOverride) {
  if (!block || !block.fillPicker || !colorPickerModule || typeof colorPickerModule.createColorPicker !== 'function') {
    return;
  }
  const palette = Array.isArray(paletteOverride) ? paletteOverride : getFillPalette();
  const linePalette = Array.isArray(linePaletteOverride) ? linePaletteOverride : getLinePalette();
  const slots = buildFillColorSlots(palette, linePalette);
  const renderStyle = ({ element, slot }) => {
    applyPairSwatch(element, slot.fillColor, slot.lineColor);
  };
  const onSelect = value => {
    if (!block.cfg) return;
    block.cfg.fillColorIndex = sanitizeFillIndex(value, palette.length);
    applyBlockPalette(block, resolveBlockPalette(block.cfg, palette, linePalette));
    draw(true);
  };
  const getActiveValue = () => {
    const resolved = resolveBlockPalette(block.cfg, palette, linePalette);
    return resolved.index;
  };
  if (block.fillPicker.instance) {
    block.fillPicker.instance.update({
      slots,
      renderStyle,
      onSelect,
      getActiveValue
    });
    return;
  }
  const pickerInstance = colorPickerModule.createColorPicker({
    element: block.fillPicker.element,
    slots,
    renderStyle,
    onSelect,
    getActiveValue
  });
  if (pickerInstance) {
    block.fillPicker.instance = pickerInstance;
  }
}

function createBlockFillPicker(block, fieldset) {
  if (!block || !fieldset || typeof document === 'undefined') return;
  const fillPickerRow = document.createElement('div');
  fillPickerRow.className = 'fill-color-picker';
  const fillLabel = document.createElement('span');
  fillLabel.className = 'fill-color-picker__label';
  fillLabel.textContent = 'Fyllfarge';
  const picker = document.createElement('div');
  picker.className = 'color-picker';
  const activeBtn = document.createElement('button');
  activeBtn.type = 'button';
  activeBtn.className = 'color-swatch color-swatch--active color-swatch--pair';
  activeBtn.setAttribute('aria-label', 'Velg fyllfarge');
  const optionsPanel = document.createElement('div');
  optionsPanel.className = 'color-options';
  optionsPanel.hidden = true;
  picker.appendChild(activeBtn);
  picker.appendChild(optionsPanel);
  fillPickerRow.appendChild(fillLabel);
  fillPickerRow.appendChild(picker);
  fieldset.appendChild(fillPickerRow);
  block.fillPicker = {
    root: fillPickerRow,
    element: picker,
    activeButton: activeBtn,
    optionsPanel,
    instance: null
  };
  renderBlockFillPicker(block);
}
const DEFAULT_FRACTION_SLOT_INDICES = Object.freeze([13, 14, 18, 19, 20, 48]);
let cachedPaletteConfig = null;
let paletteConfigResolved = false;

function getPaletteApi(scope) {
  const root = scope || (typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
  if (!root || typeof root !== 'object') return null;
  const api = root.MathVisualsPalette;
  return api && typeof api.getGroupPalette === 'function' ? api : null;
}

function getSettingsApi() {
  if (typeof window === 'undefined') return null;
  const api = window.MathVisualsSettings;
  return api && typeof api === 'object' ? api : null;
}

function getThemeApi() {
  if (typeof window === 'undefined') return null;
  const theme = window.MathVisualsTheme;
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


function sanitizePaletteList(values) {
  if (!Array.isArray(values)) return [];
  const sanitized = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) sanitized.push(trimmed);
  }
  return sanitized;
}

function resolvePaletteConfigFromScopes() {
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

function getPaletteConfig() {
  if (!paletteConfigResolved) {
    paletteConfigResolved = true;
    cachedPaletteConfig = resolvePaletteConfigFromScopes();
  }
  return cachedPaletteConfig;
}

function getFractionSlotIndices(config) {
  if (!config || typeof config !== 'object') {
    return DEFAULT_FRACTION_SLOT_INDICES.slice();
  }
  const indices = [];
  if (Array.isArray(config.COLOR_SLOT_GROUPS)) {
    const match = config.COLOR_SLOT_GROUPS.find(group => {
      if (!group || typeof group.groupId !== 'string') return false;
      return group.groupId.trim().toLowerCase() === SHARED_GROUP_ID;
    });
    if (match && Array.isArray(match.colorRoles) && match.colorRoles.length) {
      match.colorRoles.forEach(role => {
        if (!role || typeof role !== 'object') return;
        if (Number.isInteger(role.fillIndex) && role.fillIndex >= 0) {
          indices.push(role.fillIndex);
        }
        if (Number.isInteger(role.lineIndex) && role.lineIndex >= 0) {
          indices.push(role.lineIndex);
        }
      });
    }
  }
  if (indices.length) {
    return indices;
  }
  if (config.GROUP_SLOT_INDICES && typeof config.GROUP_SLOT_INDICES === 'object') {
    const raw = config.GROUP_SLOT_INDICES[SHARED_GROUP_ID];
    if (Array.isArray(raw)) {
      raw.forEach(index => {
        if (Number.isInteger(index) && index >= 0) {
          indices.push(index);
        }
      });
    }
  }
  if (!indices.length && Array.isArray(config.COLOR_SLOT_GROUPS)) {
    const match = config.COLOR_SLOT_GROUPS.find(group => {
      if (!group || typeof group.groupId !== 'string') return false;
      return group.groupId.trim().toLowerCase() === SHARED_GROUP_ID;
    });
    if (match && Array.isArray(match.slots)) {
      match.slots.forEach(slot => {
        const index = Number(slot && slot.index);
        if (Number.isInteger(index) && index >= 0) {
          indices.push(index);
        }
      });
    }
  }
  if (!indices.length) {
    return DEFAULT_FRACTION_SLOT_INDICES.slice();
  }
  return indices;
}

function resolveFractionFallbackPalette() {
  const config = getPaletteConfig();
  const fallbacks = config && typeof config.PROJECT_FALLBACKS === 'object' ? config.PROJECT_FALLBACKS : null;
  if (!fallbacks) {
    return [];
  }
  const defaultPalette = Array.isArray(fallbacks.default) ? fallbacks.default : null;
  const palette = defaultPalette && defaultPalette.length ? defaultPalette : null;
  if (!palette || !palette.length) {
    return [];
  }
  const sanitizedPalette = sanitizePaletteList(palette);
  if (!sanitizedPalette.length) {
    return [];
  }
  const slotIndices = getFractionSlotIndices(config);
  const result = [];
  for (let i = 0; i < 2; i += 1) {
    const slotIndex = slotIndices[i];
    let color = null;
    if (Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < palette.length) {
      const rawColor = palette[slotIndex];
      if (typeof rawColor === 'string') {
        const trimmedColor = rawColor.trim();
        if (trimmedColor) {
          color = trimmedColor;
        }
      }
    }
    if (!color) {
      color = sanitizedPalette[i % sanitizedPalette.length];
    }
    if (typeof color === 'string' && color) {
      result.push(color);
    }
  }
  return result;
}

function ensurePaletteCount(basePalette, fallbackPalette, count) {
  const base = sanitizePaletteList(basePalette);
  const fallback = sanitizePaletteList(fallbackPalette);
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
    return Array.isArray(palette) ? sanitizePaletteList(palette) : null;
  } catch (_) {
    return null;
  }
}

function resolveFractionPalette(count = 2) {
  const target = Number.isFinite(count) && count > 0 ? Math.max(2, Math.trunc(count)) : 2;
  const projectFallback = sanitizePaletteList(resolveFractionFallbackPalette());
  const fallback =
    projectFallback.length
      ? ensurePaletteCount(projectFallback, projectFallback, target)
      : ensurePaletteCount(FRACTION_FALLBACK_COLORS, FRACTION_FALLBACK_COLORS, target);
  const settings = getSettingsApi();
  const settingsSnapshot =
    settings && typeof settings.getSettings === 'function'
      ? settings.getSettings()
      : settings || undefined;
  if (settings && typeof settings.getGroupPalette === 'function') {
    let palette = tryResolvePalette(() =>
      settings.getGroupPalette(SHARED_GROUP_ID, {
        count: target || undefined
      })
    );
    if ((!palette || palette.length < target) && settings.getGroupPalette.length >= 3) {
      palette = tryResolvePalette(() => settings.getGroupPalette(SHARED_GROUP_ID, target || undefined));
    }
    if (palette && palette.length) {
      return ensurePaletteCount(palette, fallback, target);
    }
  }
  const paletteApi = getPaletteApi();
  if (paletteApi) {
    const palette = tryResolvePalette(() =>
      paletteApi.getGroupPalette(SHARED_GROUP_ID, {
        count: target || undefined,
        settings: settingsSnapshot
      })
    );
    if (palette && palette.length) {
      return ensurePaletteCount(palette, fallback, target);
    }
  }
  const servicePalette = tryResolvePalette(() =>
    paletteService.resolveGroupPalette({
      groupId: SHARED_GROUP_ID,
      count: target || undefined,
      fallback,
      settings: settingsSnapshot
    })
  );
  if (servicePalette && servicePalette.length) {
    return ensurePaletteCount(servicePalette, fallback, target);
  }
  const theme = getThemeApi();
  if (theme && typeof theme.getGroupPalette === 'function') {
    let palette = tryResolvePalette(() =>
      theme.getGroupPalette(SHARED_GROUP_ID, {
        count: target || undefined
      })
    );
    if ((!palette || palette.length < target) && theme.getGroupPalette.length >= 3) {
      palette = tryResolvePalette(() => theme.getGroupPalette(SHARED_GROUP_ID, target || undefined));
    }
    if (palette && palette.length) {
      return ensurePaletteCount(palette, fallback, target);
    }
  }
  if (theme && typeof theme.getPalette === 'function') {
    const palette = tryResolvePalette(() => theme.getPalette('fellesfarger', target || fallback.length));
    if (palette && palette.length) {
      return ensurePaletteCount(palette, fallback, target);
    }
  }
  return fallback;
}

function getPaletteTargets() {
  if (typeof document === 'undefined') return [];
  const targets = [];
  if (document.documentElement) targets.push(document.documentElement);
  if (document.body) targets.push(document.body);
  const boardEl = document.getElementById('tbBoard');
  if (boardEl) targets.push(boardEl);
  return targets.filter(target => target && target.style && typeof target.style.setProperty === 'function');
}

function applyFractionPalette(force = false) {
  if (typeof document === 'undefined') return;
  const { fillColors, lineColors } = getLineFillPalettes();
  const palette = fillColors.slice(0, FILL_COLOR_COUNT);
  const linePalette = lineColors.slice(0, FILL_COLOR_COUNT);
  BLOCKS.forEach(block => {
    if (!block || !block.cfg) return;
    const resolved = resolveBlockPalette(block.cfg, palette, linePalette);
    applyBlockPalette(block, resolved);
    renderBlockFillPicker(block, palette, linePalette);
  });
  refreshTenkeblokkerPaletteAttributes();
}
function sanitizeDisplayMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return DISPLAY_OPTIONS.includes(normalized) ? normalized : null;
}
function applyDisplayMode(cfg, mode, fallback = 'number') {
  if (!cfg) return 'number';
  const normalizedFallback = sanitizeDisplayMode(fallback) || 'number';
  const normalized = sanitizeDisplayMode(mode) || normalizedFallback;
  cfg.valueDisplay = normalized;
  cfg.showFraction = normalized === 'fraction';
  cfg.showPercent = normalized === 'percent';
  return normalized;
}
function parseGridDimension(value, fallback = 1) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const normalized = Number.parseFloat(value.replace(',', '.'));
    if (Number.isFinite(normalized) && normalized > 0) {
      return Math.round(normalized);
    }
  }
  return fallback;
}
function cloneExampleConfig(config) {
  if (!config) return config;
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(config);
    } catch (err) {
      // ignore structuredClone errors and fall back to JSON copy
    }
  }
  return JSON.parse(JSON.stringify(config));
}
function getHiddenNumber(target, key) {
  if (!target || typeof target !== 'object') return null;
  const value = target[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function setHiddenNumber(target, key, value) {
  if (!target || typeof target !== 'object') return;
  Object.defineProperty(target, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: false
  });
}
function getHiddenBoolean(target, key) {
  if (!target || typeof target !== 'object') return false;
  return target[key] === true;
}
function setHiddenFlag(target, key, value) {
  if (!target || typeof target !== 'object') return;
  Object.defineProperty(target, key, {
    value: !!value,
    writable: true,
    configurable: true,
    enumerable: false
  });
}
function hasVisibleBlockBelow(block) {
  if (!block || typeof block.row !== 'number' || typeof block.col !== 'number') return false;
  const rows = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.rows);
  if (!Number.isFinite(rows) || block.row >= rows - 1) return false;
  if (!(Array.isArray(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.blocks))) return false;
  const nextRowIndex = block.row + 1;
  if (nextRowIndex >= rows) return false;
  const nextRow = CONFIG.blocks[nextRowIndex];
  if (!Array.isArray(nextRow)) return false;
  const cfg = nextRow[block.col];
  if (!(cfg && typeof cfg === 'object')) return false;
  return cfg.hideBlock !== true;
}
function getRowSpanRatios(block, options = {}) {
  const { forLayout = false } = options;
  const baseTop = clamp(TOP_RATIO, 0, 1);
  const baseBottom = clamp(BOTTOM_RATIO, baseTop + MIN_SPAN_RATIO, 1);
  let topRatio = baseTop;
  let bottomRatio = baseBottom;
  let compactApplied = false;
  const horizontalOverlayActive = multipleBlocksActive && CONFIG.showCombinedWhole;
  let needsFullPadding;
  if (block) {
    needsFullPadding = blockNeedsFullPadding(block);
  } else {
    needsFullPadding = anyBlockNeedsFullPadding();
  }
  const allowCompact = !horizontalOverlayActive && !needsFullPadding;
  if (allowCompact) {
    const compactTop = clamp(COMPACT_TOP_RATIO, 0, 1 - MIN_SPAN_RATIO);
    const compactBottom = clamp(COMPACT_BOTTOM_RATIO, compactTop + MIN_SPAN_RATIO, 1);
    topRatio = compactTop;
    bottomRatio = compactBottom;
    compactApplied = true;
  }
  return {
    topRatio,
    bottomRatio,
    compactApplied
  };
}

function blockAllowsWholeBrace(cfg) {
  if (!cfg || typeof cfg !== 'object') return false;
  if (cfg.showWhole !== true) return false;
  const blockHidden = cfg.hideBlock === true;
  if (multipleBlocksActive && !blockHidden) return false;
  return true;
}

function blockNeedsFullPadding(block) {
  var _block$cfg;
  if (!block) return anyBlockNeedsFullPadding();
  const cfg = (_block$cfg = block.cfg) !== null && _block$cfg !== void 0 ? _block$cfg : null;
  return blockAllowsWholeBrace(cfg);
}

function anyBlockNeedsFullPadding() {
  if (!Array.isArray(CONFIG.blocks)) return false;
  for (const row of CONFIG.blocks) {
    if (!Array.isArray(row)) continue;
    for (const cell of row) {
      if (!cell || typeof cell !== 'object') continue;
      if (blockAllowsWholeBrace(cell)) return true;
    }
  }
  return false;
}
function isMeaningfulBlockCell(cell) {
  if (cell == null) return false;
  if (typeof cell === 'object') {
    try {
      return Object.keys(cell).length > 0;
    } catch (err) {
      return true;
    }
  }
  return true;
}
function countMeaningfulColumns(row) {
  if (!Array.isArray(row)) return 0;
  for (let i = row.length - 1; i >= 0; i--) {
    if (isMeaningfulBlockCell(row[i])) return i + 1;
  }
  return 0;
}
function getDefaultBlock(index = 0) {
  const base = DEFAULT_BLOCKS[index] || DEFAULT_BLOCKS[DEFAULT_BLOCKS.length - 1];
  return {
    ...base
  };
}
const DEFAULT_ROW_GAP = 4;
const MIN_ROW_GAP = -100;
const MAX_ROW_GAP = 200;
const CONFIG = {
  minN: 1,
  maxN: 12,
  rows: 1,
  cols: 1,
  blocks: [],
  showCombinedWhole: false,
  showCombinedWholeVertical: false,
  rowLabels: [],
  rowGap: DEFAULT_ROW_GAP,
  showSum: false,
  altText: '',
  altTextSource: 'auto',
  fillColorIndex: DEFAULT_FILL_COLOR_INDEX
};
const dimensionState = {
  rowTotals: [],
  columnTotals: [],
  rowTokens: [],
  columnTokens: []
};
function isNumericLabel(label) {
  if (typeof label !== 'string') return false;
  const normalized = label.trim();
  if (!normalized) return false;
  return /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(normalized);
}

function getVariableToken(label) {
  if (typeof label !== 'string') return '';
  const normalized = label.trim();
  if (!normalized || isNumericLabel(normalized)) return '';
  return normalized;
}

function createColumnToken(index, totalValue) {
  if (Number.isFinite(totalValue)) return fmt(totalValue);
  return '';
}

function createRowToken(index, totalValue) {
  if (Number.isFinite(totalValue)) return fmt(totalValue);
  return '';
}

function computeDimensionData() {
  const rows = Math.max(0, Math.round(Number(CONFIG.rows) || 0));
  const cols = Math.max(0, Math.round(Number(CONFIG.cols) || 0));
  const rowTotals = Array.from({ length: rows }, () => 0);
  const columnTotals = Array.from({ length: cols }, () => 0);
  const columnSeen = Array.from({ length: cols }, () => false);
  if (Array.isArray(CONFIG.blocks)) {
    for (let r = 0; r < rows; r++) {
      const row = Array.isArray(CONFIG.blocks[r]) ? CONFIG.blocks[r] : [];
      for (let c = 0; c < cols; c++) {
        const cfg = row[c];
        if (!cfg) continue;
        const total = Number(cfg.total);
        if (!Number.isFinite(total)) continue;
        rowTotals[r] += total;
        if (!columnSeen[c]) {
          columnTotals[c] = total;
          columnSeen[c] = true;
        }
      }
    }
  }
  const rowTokens = rowTotals.map((total, index) => createRowToken(index, total));
  const columnTokens = columnTotals.map((total, index) => createColumnToken(index, total));
  return {
    rowTotals,
    columnTotals,
    rowTokens,
    columnTokens
  };
}

function updateDimensionState(data) {
  dimensionState.rowTotals = Array.isArray(data === null || data === void 0 ? void 0 : data.rowTotals) ? data.rowTotals.slice() : [];
  dimensionState.columnTotals = Array.isArray(data === null || data === void 0 ? void 0 : data.columnTotals) ? data.columnTotals.slice() : [];
  dimensionState.rowTokens = Array.isArray(data === null || data === void 0 ? void 0 : data.rowTokens) ? data.rowTokens.slice() : [];
  dimensionState.columnTokens = Array.isArray(data === null || data === void 0 ? void 0 : data.columnTokens) ? data.columnTokens.slice() : [];
}

function getColumnToken(index, data = dimensionState) {
  if (!data || !Array.isArray(data.columnTokens)) return '';
  const token = data.columnTokens[index];
  return typeof token === 'string' ? token : '';
}

function getRowToken(index, data = dimensionState) {
  if (!data || !Array.isArray(data.rowTokens)) return '';
  const token = data.rowTokens[index];
  return typeof token === 'string' ? token : '';
}

function formatProductLabel(rowToken, columnToken) {
  const rowVar = getVariableToken(rowToken);
  const colVar = getVariableToken(columnToken);
  if (rowVar && colVar) {
    if (rowVar === colVar) return `${rowVar}\u00B2`;
    return `${rowVar}${colVar}`;
  }
  if (colVar) return colVar;
  if (rowVar) return rowVar;
  return '';
}

function orderVerticalSumTokens(tokens) {
  if (!Array.isArray(tokens) || tokens.length <= 1) return tokens || [];
  return tokens.slice();
}

function getSumTokens(orientation, data = dimensionState) {
  if (!data) return [];
  const source = orientation === 'vertical' ? data.rowTokens : data.columnTokens;
  if (!Array.isArray(source)) return [];
  const filtered = source
    .map(token => (typeof token === 'string' ? token.trim() : ''))
    .filter(Boolean);
  if (!filtered.length) return [];
  if (orientation === 'vertical') return orderVerticalSumTokens(filtered);
  return filtered;
}

function getSumLabel(orientation, data = dimensionState) {
  const tokens = getSumTokens(orientation, data);
  if (tokens.length) {
    return tokens.join(' + ');
  }
  const total = getCombinedTotal();
  return Number.isFinite(total) ? fmt(total) : '';
}

function getBlockTotalLabel(block) {
  const columnToken = getColumnToken(block === null || block === void 0 ? void 0 : block.col);
  if (columnToken) return columnToken;
  const cfg = block === null || block === void 0 ? void 0 : block.cfg;
  const total = Number(cfg === null || cfg === void 0 ? void 0 : cfg.total);
  return Number.isFinite(total) ? fmt(total) : '';
}

const VBW = 900;
const VBH = 420;
const SIDE_MARGIN_RATIO = 0;
const TOP_RATIO = 130 / VBH;
const BOTTOM_RATIO = (VBH - 60) / VBH;
const COMPACT_TOP_RATIO = 0 / VBH;
const COMPACT_BOTTOM_RATIO = VBH / VBH;
const MIN_SPAN_RATIO = 0.05;
const BRACE_Y_RATIO = 78 / VBH;
const BRACKET_TICK_RATIO = 16 / VBH;
const LABEL_OFFSET_RATIO = 14 / VBH;
const DEFAULT_SVG_HEIGHT = 260;
const EXPORT_PADDING = 32;
const EXPORT_STYLE_RULES = `
  :root,
  svg {
    --tb-font-family: "Inter", "Segoe UI", system-ui, sans-serif;
    --tb-fill: #dbe7ff;
    --tb-line: #333333;
    --tb-text: #111;
  }

  .tb-rect {
    fill: var(--tb-fill, #dbe7ff);
  }

  .tb-frame {
    fill: none;
    stroke: var(--tb-line, #333333);
    stroke-width: 6;
  }

  .tb-sep {
    stroke: var(--tb-line, #333333);
    stroke-width: 2;
    stroke-dasharray: 8 8;
    opacity: 0.6;
  }

  .tb-brace {
    fill: none;
    stroke: var(--tb-line, #333333);
    stroke-width: 6;
    stroke-linecap: round;
  }

  .tb-brace--union {
    fill: var(--tb-line, #333333);
    stroke: none;
  }

  .tb-row-label-text {
    font-size: 32px;
    font-weight: 600;
    fill: #374151;
    letter-spacing: 0.01em;
  }

  .tb-row-label-text,
  .tb-total,
  .tb-val,
  .tb-frac text,
  .tb-frac tspan {
    font-family: var(--tb-font-family, "Inter", "Segoe UI", system-ui, sans-serif);
  }

  .tb-total {
    font-size: 34px;
    fill: var(--tb-text, #111);
    text-anchor: middle;
  }

  .tb-val {
    font-size: 34px;
    text-anchor: middle;
    dominant-baseline: middle;
  }

  .tb-val:not([data-tb-explicit-fill="true"]) {
    fill: var(--tb-text, #111);
  }

  .tb-frac {
    text-anchor: middle;
  }

  .tb-frac text {
    font-size: 28px;
    text-anchor: middle;
    font-variant-numeric: tabular-nums;
  }

  .tb-frac text:not([data-tb-explicit-fill="true"]) {
    fill: var(--tb-text, #111);
  }

  .tb-frac-line {
    stroke: var(--tb-line, #111111);
    stroke-width: 2;
    stroke-linecap: square;
  }
`;
const BASE_INNER_RATIO = BOTTOM_RATIO - TOP_RATIO;
const ROW_LABEL_GAP = 18;
const DEFAULT_FRAME_INSET = 3;
const DEFAULT_GRID_PADDING_TOP = 20;
const DEFAULT_GRID_PADDING_LEFT = 28;
const ROW_LABEL_EXTRA_LEFT_PADDING = 100;
const ROW_LABEL_EXTRA_PADDING_ROWS = 3;
const COMBINED_WHOLE_TOP_MARGIN = 12;
const BLOCKS = [];
let multipleBlocksActive = false;
let altTextManager = null;
let altTextRefreshTimer = null;
let lastAltTextSignature = null;
let pendingAltTextReason = 'auto';
const board = document.getElementById('tbBoard');
const grid = document.getElementById('tbGrid');
const addColumnBtn = document.getElementById('tbAddColumn');
const addRowBtn = document.getElementById('tbAddRow');
const removeColumnBtn = document.getElementById('tbRemoveColumn');
const removeRowBtn = document.getElementById('tbRemoveRow');
const settingsContainer = document.getElementById('tbSettings');
const ROW_LABEL_ELEMENTS = [];
let rowLabelMeasureElement = null;

function getRowLabelMeasureElement() {
  if (rowLabelMeasureElement && document.body && document.body.contains(rowLabelMeasureElement)) {
    return rowLabelMeasureElement;
  }
  const el = document.createElement('div');
  el.className = 'tb-row-label';
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'absolute';
  el.style.visibility = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.whiteSpace = 'nowrap';
  el.style.paddingRight = '0px';
  el.style.margin = '0';
  el.style.display = 'inline-flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'flex-end';
  el.style.gridColumn = 'auto';
  el.style.width = 'auto';
  el.style.minWidth = '0';
  el.style.maxWidth = 'none';
  if (document.body) document.body.appendChild(el);
  rowLabelMeasureElement = el;
  return el;
}

function measureRowLabelWidth(text) {
  if (typeof text !== 'string' || !text) return 0;
  const measureEl = getRowLabelMeasureElement();
  measureEl.textContent = text;
  const rect = measureEl.getBoundingClientRect();
  return rect && Number.isFinite(rect.width) ? rect.width : 0;
}
const globalControls = {
  fieldset: null,
  horizontal: null,
  horizontalRow: null,
  vertical: null,
  verticalRow: null,
  rowLabelInputs: [],
  rowGapInput: null,
  showSumInput: null,
  showSumRow: null
};

function sanitizeRowGap(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_ROW_GAP;
  return clamp(Math.round(numeric), MIN_ROW_GAP, MAX_ROW_GAP);
}

function getConfiguredRowGap() {
  return sanitizeRowGap(CONFIG.rowGap);
}

function getEffectiveActiveBlockCount() {
  const visible = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.visibleBlockCount);
  if (Number.isFinite(visible)) return visible;
  const active = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.activeBlocks);
  if (Number.isFinite(active)) return active;
  const rows = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.rows);
  const cols = Number(CONFIG === null || CONFIG === void 0 ? void 0 : CONFIG.cols);
  if (Number.isFinite(rows) && Number.isFinite(cols)) return rows * cols;
  return 0;
}

function formatCount(value, singular, plural) {
  const num = Math.max(0, Math.round(Number(value) || 0));
  const label = num === 1 ? singular : plural || `${singular}er`;
  return `${num === 1 ? '1' : String(num)} ${label}`;
}

function joinWithOg(items) {
  const filtered = items.filter(Boolean);
  if (filtered.length === 0) return '';
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} og ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(', ')} og ${filtered[filtered.length - 1]}`;
}

function collectTenkeblokkerAltSummary() {
  const rows = Math.max(1, Math.round(Number(CONFIG.rows) || 1));
  const cols = Math.max(1, Math.round(Number(CONFIG.cols) || 1));
  const rowLabels = Array.from({ length: rows }, (_, idx) => {
    const value = Array.isArray(CONFIG.rowLabels) && typeof CONFIG.rowLabels[idx] === 'string' ? CONFIG.rowLabels[idx].trim() : '';
    return value;
  });
  const dimensionData = computeDimensionData();
  const horizontalSum = CONFIG.showSum ? getSumLabel('horizontal', dimensionData) : '';
  const verticalSum = CONFIG.showSum ? getSumLabel('vertical', dimensionData) : '';
  const blocks = [];
  if (Array.isArray(CONFIG.blocks)) {
    for (let r = 0; r < rows; r++) {
      const row = Array.isArray(CONFIG.blocks[r]) ? CONFIG.blocks[r] : [];
      for (let c = 0; c < cols; c++) {
        const cfg = row[c];
        if (!cfg) continue;
        const total = Number(cfg.total);
        const n = Number(cfg.n);
        const k = Number(cfg.k);
        blocks.push({
          index: r * cols + c,
          row: r,
          col: c,
          visible: cfg.hideBlock !== true,
          showWhole: cfg.showWhole === true,
          rowLabel: rowLabels[r] || '',
          total: Number.isFinite(total) ? total : null,
          n: Number.isFinite(n) && n > 0 ? Math.round(n) : null,
          k: Number.isFinite(k) && k >= 0 ? Math.round(k) : 0,
          customText: cfg.showCustomText && typeof cfg.customText === 'string' ? cfg.customText.trim() : '',
          display: sanitizeDisplayMode(cfg.valueDisplay) || 'number'
        });
      }
    }
  }
  return {
    rows,
    cols,
    rowLabels,
    showSum: !!CONFIG.showSum,
    showCombinedWhole: !!CONFIG.showCombinedWhole,
    showCombinedWholeVertical: !!CONFIG.showCombinedWholeVertical,
    sumHorizontal: horizontalSum,
    sumVertical: verticalSum,
    blocks
  };
}

function describeSingleTenkeblokk(block) {
  if (!block) return '';
  const details = [];
  const hasK = Number.isFinite(block.k);
  const hasN = Number.isFinite(block.n);
  const nText = hasN ? formatCount(block.n, 'del', 'deler') : '';
  const kText = hasK ? formatCount(block.k, 'markert del', 'markerte deler') : '';
  if (kText && nText) {
    details.push(`${kText} av ${nText}`);
  } else if (nText) {
    details.push(`delt i ${nText}`);
  } else if (kText) {
    details.push(kText);
  }
  if (Number.isFinite(block.total)) {
    const totalText = fmt(block.total);
    if (block.showWhole) {
      details.push(`totalen ${totalText}`);
    } else {
      details.push(`totalverdi ${totalText}`);
    }
  }
  if (block.customText) {
    details.push(`etiketten «${block.customText}»`);
  }
  let sentence = 'Tenkeblokk';
  const detailText = joinWithOg(details);
  if (detailText) {
    sentence += ` med ${detailText}`;
  }
  if (!sentence.endsWith('.')) sentence += '.';
  return sentence;
}

function buildTenkeblokkerAltText(summary) {
  const data = summary || collectTenkeblokkerAltSummary();
  if (!data) return 'Tenkeblokker.';
  const sentences = [];
  const visibleBlocks = data.blocks.filter(block => block.visible);
  const blockCount = visibleBlocks.length;
  if (blockCount === 0) {
    sentences.push('Visualiseringen viser ingen tenkeblokker.');
    sentences.push('Ingen blokker er synlige.');
    return sentences.filter(Boolean).join(' ');
  }
  if (blockCount === 1) {
    const sentence = describeSingleTenkeblokk(visibleBlocks[0]);
    if (sentence) sentences.push(sentence);
    return sentences.filter(Boolean).join(' ');
  }
  const countText = blockCount === 0 ? 'ingen tenkeblokker' : blockCount === 1 ? 'én tenkeblokk' : `${blockCount} tenkeblokker`;
  sentences.push(`Visualiseringen viser ${countText} organisert i ${formatCount(data.rows, 'rad', 'rader')} og ${formatCount(data.cols, 'kolonne', 'kolonner')}.`);
  const labelDescriptions = data.rowLabels
    .map((label, idx) => (label ? `rad ${idx + 1} merket «${label}»` : ''))
    .filter(Boolean);
  if (labelDescriptions.length) {
    sentences.push(`Radene er merket med ${joinWithOg(labelDescriptions)}.`);
  }
  const totalParts = [];
  if (blockCount > 1 && data.showCombinedWhole) totalParts.push('en horisontal parentes som viser totalen');
  if (blockCount > 1 && data.showCombinedWholeVertical) totalParts.push('en vertikal parentes som viser totalen');
  if (totalParts.length) {
    sentences.push(`Totalverdien vises med ${joinWithOg(totalParts)}.`);
  }
  if (data.showSum) {
    const sumParts = [];
    if (typeof data.sumHorizontal === 'string' && data.sumHorizontal.trim()) {
      sumParts.push(`horisontal sum «${data.sumHorizontal.trim()}»`);
    }
    if (typeof data.sumVertical === 'string' && data.sumVertical.trim()) {
      sumParts.push(`vertikal sum «${data.sumVertical.trim()}»`);
    }
    if (sumParts.length) {
      sentences.push(`Summen vises som ${joinWithOg(sumParts)}.`);
    } else {
      sentences.push('Summen vises med en parentes.');
    }
  }
  const blockParts = visibleBlocks.map(block => {
    const rowText = block.rowLabel ? `rad ${block.row + 1} («${block.rowLabel}») ` : `rad ${block.row + 1} `;
    const base = `blokk ${block.index + 1} i ${rowText.trim()}`;
    const nText = Number.isFinite(block.n) ? formatCount(block.n, 'del', 'deler') : null;
    const kText = Number.isFinite(block.k) ? formatCount(block.k, 'markert del', 'markerte deler') : null;
    let part = base;
    if (kText && nText) {
      part += ` viser ${kText} av ${nText}`;
    } else if (nText) {
      part += ` er delt i ${nText}`;
    }
    if (Number.isFinite(block.total)) {
      const totalText = fmt(block.total);
      if (block.showWhole) {
        part += ` av totalen ${totalText}`;
      } else {
        part += ` med totalverdi ${totalText}`;
      }
    }
    if (block.customText) {
      part += `, etiketten i blokken er «${block.customText}»`;
    }
    return part;
  });
  if (blockParts.length) {
    const limit = Math.min(blockParts.length, 3);
    const listed = blockParts.slice(0, limit);
    let sentence = joinWithOg(listed);
    if (sentence) {
      sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
      sentence += '.';
    }
    if (blockParts.length > limit) {
      const remaining = blockParts.length - limit;
      sentence += ` ${remaining === 1 ? 'Én blokk til følger samme mønster.' : `${remaining} blokker til følger samme mønster.`}`;
    }
    if (sentence) sentences.push(sentence);
  } else {
    sentences.push('Ingen blokker er synlige.');
  }
  return sentences.filter(Boolean).join(' ');
}

function getTenkeblokkerTitle() {
  const base = typeof document !== 'undefined' && document && document.title ? document.title : 'Tenkeblokker';
  const summary = collectTenkeblokkerAltSummary();
  if (!summary) return base;
  const visibleBlocks = summary.blocks.filter(block => block.visible).length;
  if (!visibleBlocks) return base;
  const suffix = visibleBlocks === 1 ? '1 blokk' : `${visibleBlocks} blokker`;
  return `${base} – ${suffix}`;
}

function getActiveTenkeblokkerAltText() {
  const stored = typeof CONFIG.altText === 'string' ? CONFIG.altText.trim() : '';
  if (CONFIG.altTextSource === 'manual' && stored) return stored;
  return stored || buildTenkeblokkerAltText();
}

function ensureTenkeblokkerAltAnchor() {
  let anchor = document.getElementById('tenkeblokker-alt-anchor');
  if (!anchor) {
    anchor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    anchor.setAttribute('id', 'tenkeblokker-alt-anchor');
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

function refreshAltText(reason) {
  if (!altTextManager) return;
  const signature = JSON.stringify(collectTenkeblokkerAltSummary());
  if (signature !== lastAltTextSignature) {
    lastAltTextSignature = signature;
    altTextManager.refresh(reason || 'auto', signature);
  } else if (!reason || reason === 'init') {
    altTextManager.refresh(reason || 'auto', signature);
  } else if (typeof altTextManager.notifyFigureChange === 'function') {
    altTextManager.notifyFigureChange(signature);
  }
}

function scheduleAltTextRefresh(reason = 'auto') {
  pendingAltTextReason = reason;
  if (altTextRefreshTimer) {
    clearTimeout(altTextRefreshTimer);
  }
  altTextRefreshTimer = setTimeout(() => {
    altTextRefreshTimer = null;
    refreshAltText(pendingAltTextReason);
  }, 150);
}

function initAltTextManager() {
  if (typeof window === 'undefined' || !window.MathVisAltText) return;
  const container = document.getElementById('exportCard');
  if (!container) return;
  const anchor = ensureTenkeblokkerAltAnchor();
  altTextManager = window.MathVisAltText.create({
    svg: () => anchor,
    container,
    getTitle: getTenkeblokkerTitle,
    getState: () => ({
      text: typeof CONFIG.altText === 'string' ? CONFIG.altText : '',
      source: CONFIG.altTextSource === 'manual' ? 'manual' : 'auto'
    }),
    setState: (text, source) => {
      CONFIG.altText = text;
      CONFIG.altTextSource = source === 'manual' ? 'manual' : 'auto';
    },
    generate: () => buildTenkeblokkerAltText(),
    getSignature: () => JSON.stringify(collectTenkeblokkerAltSummary()),
    getAutoMessage: reason => (reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.'),
    getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
  });
  if (altTextManager) {
    lastAltTextSignature = null;
    altTextManager.applyCurrent();
    const figure = document.getElementById('tbGrid');
    if (figure && window.MathVisAltText) {
      const nodes = window.MathVisAltText.ensureSvgA11yNodes(anchor);
      const title = getTenkeblokkerTitle();
      figure.setAttribute('role', 'img');
      figure.setAttribute('aria-label', title);
      if (nodes.titleEl && nodes.titleEl.id) figure.setAttribute('aria-labelledby', nodes.titleEl.id);
      if (nodes.descEl && nodes.descEl.id) figure.setAttribute('aria-describedby', nodes.descEl.id);
    }
    scheduleAltTextRefresh('init');
  }
}
const btnSvg = document.getElementById('btnSvg');
const btnPng = document.getElementById('btnPng');
const combinedWholeOverlays = {
  horizontal: createCombinedWholeOverlay('horizontal'),
  vertical: createCombinedWholeOverlay('vertical')
};
function handleThemePaletteChanged() {
  applyFractionPalette(true);
}

function handleThemeProfileMessage(event) {
  const data = event && event.data;
  const type = typeof data === 'string' ? data : data && data.type;
  if (type === 'math-visuals:profile-change' || type === 'math-visuals:settings-changed') {
    handleThemePaletteChanged();
  }
}

function handleThemeProfileChangeEvent(event) {
  if (!event || event.type !== 'math-visuals:profile-change') return;
  handleThemePaletteChanged();
}

function handleThemeSettingsChanged(event) {
  if (!event || event.type !== 'math-visuals:settings-changed') return;
  handleThemePaletteChanged();
}

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => draw(true));
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('message', handleThemeProfileMessage);
    window.addEventListener('math-visuals:profile-change', handleThemeProfileChangeEvent);
    window.addEventListener('math-visuals:settings-changed', handleThemeSettingsChanged);
  }
}
applyFractionPalette(true);
addColumnBtn === null || addColumnBtn === void 0 || addColumnBtn.addEventListener('click', () => {
  const current = parseGridDimension(CONFIG.cols, 1);
  if (current >= 3) return;
  setHiddenFlag(CONFIG, '__colsDirty', true);
  CONFIG.cols = Math.min(3, current + 1);
  draw();
});
addRowBtn === null || addRowBtn === void 0 || addRowBtn.addEventListener('click', () => {
  const current = parseGridDimension(CONFIG.rows, 1);
  if (current >= 3) return;
  setHiddenFlag(CONFIG, '__rowsDirty', true);
  CONFIG.rows = Math.min(3, current + 1);
  draw();
});
removeColumnBtn === null || removeColumnBtn === void 0 || removeColumnBtn.addEventListener('click', () => {
  const current = parseGridDimension(CONFIG.cols, 1);
  if (current <= 1) return;
  const next = Math.max(1, current - 1);
  setHiddenFlag(CONFIG, '__colsDirty', true);
  CONFIG.cols = next;
  if (Array.isArray(CONFIG.blocks)) {
    for (const row of CONFIG.blocks) {
      if (Array.isArray(row) && row.length > next) {
        row.length = next;
      }
    }
  }
  draw();
});
removeRowBtn === null || removeRowBtn === void 0 || removeRowBtn.addEventListener('click', () => {
  const current = parseGridDimension(CONFIG.rows, 1);
  if (current <= 1) return;
  const next = Math.max(1, current - 1);
  setHiddenFlag(CONFIG, '__rowsDirty', true);
  CONFIG.rows = next;
  if (Array.isArray(CONFIG.blocks) && CONFIG.blocks.length > next) {
    CONFIG.blocks.length = next;
  }
  draw();
});
btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => {
  const exportSvg = getExportSvg();
  if (exportSvg) downloadSVG(exportSvg, 'tenkeblokker.svg');
});
btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => {
  const exportSvg = getExportSvg();
  if (exportSvg) downloadPNG(exportSvg, 'tenkeblokker.png', 2);
});
normalizeConfig(true);
rebuildStructure();
draw(true);
initAltTextManager();
scheduleAltTextRefresh('init');
window.CONFIG = CONFIG;
window.draw = draw;
function getSvgViewport(block) {
  var _block$panel, _block$panel$getBound, _svg$getBoundingClien;
  const svg = block === null || block === void 0 ? void 0 : block.svg;
  const panelRect = block === null || block === void 0 || (_block$panel = block.panel) === null || _block$panel === void 0 || (_block$panel$getBound = _block$panel.getBoundingClientRect) === null || _block$panel$getBound === void 0 ? void 0 : _block$panel$getBound.call(_block$panel);
  const svgRect = svg === null || svg === void 0 || (_svg$getBoundingClien = svg.getBoundingClientRect) === null || _svg$getBoundingClien === void 0 ? void 0 : _svg$getBoundingClien.call(svg);
  let width = panelRect === null || panelRect === void 0 ? void 0 : panelRect.width;
  if (!(width > 0)) width = svgRect === null || svgRect === void 0 ? void 0 : svgRect.width;
  if (!(width > 0)) width = VBW;
  let height = svgRect === null || svgRect === void 0 ? void 0 : svgRect.height;
  if (!(height > 0) && svg) {
    var _svg$ownerDocument;
    const owner = (_svg$ownerDocument = svg.ownerDocument) === null || _svg$ownerDocument === void 0 ? void 0 : _svg$ownerDocument.defaultView;
    if (owner !== null && owner !== void 0 && owner.getComputedStyle) {
      const computedHeight = owner.getComputedStyle(svg).getPropertyValue('height');
      const parsed = Number.parseFloat(String(computedHeight).replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0) height = parsed;
    }
  }
  if (!(height > 0)) height = DEFAULT_SVG_HEIGHT;
  return {
    width,
    height
  };
}
function getBlockMetrics(block) {
  const {
    width,
    height
  } = getSvgViewport(block);
  const left = width * SIDE_MARGIN_RATIO;
  const right = width - left;
  const ratios = getRowSpanRatios(block);
  const topRatio = ratios.topRatio;
  const bottomRatio = ratios.bottomRatio;
  const compactApplied = ratios.compactApplied === true;
  let top = height * topRatio;
  let bottom = height * bottomRatio;
  const bracketTick = height * BRACKET_TICK_RATIO;
  let braceY = height * BRACE_Y_RATIO;
  let labelOffsetY = height * LABEL_OFFSET_RATIO;
  if (bottom <= top) {
    bottom = Math.max(top, height);
  }
  const span = bottom - top;
  if (span > 0) {
    const desiredInner = height * BASE_INNER_RATIO;
    const innerDelta = span - desiredInner;
    if (!compactApplied && Math.abs(innerDelta) > 0.001) {
      const adjust = innerDelta / 2;
      top -= adjust;
      bottom += adjust;
    }
  }
  const frameInset = getFrameInset(block);
  const outerWidth = Math.max(0, right - left);
  const outerHeight = Math.max(0, bottom - top);
  const clampedInset = Math.min(frameInset, outerWidth / 2, outerHeight / 2);
  const frameLeft = left + clampedInset;
  const frameRight = right - clampedInset;
  const frameTop = top + clampedInset;
  const frameBottom = bottom - clampedInset;
  const innerWidth = Math.max(0, frameRight - frameLeft);
  const innerHeight = Math.max(0, frameBottom - frameTop);
  const centerX = frameLeft + innerWidth / 2;
  return {
    width,
    height,
    left: frameLeft,
    right: frameRight,
    top: frameTop,
    bottom: frameBottom,
    braceY,
    bracketTick,
    labelOffsetY,
    innerWidth,
    innerHeight,
    centerX,
    frameInset: clampedInset,
    outerLeft: left,
    outerRight: right,
    outerTop: top,
    outerBottom: bottom
  };
}
function toBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}
function normalizeBlockConfig(raw, index, existing, previous) {
  var _defaults$customText;
  const defaults = getDefaultBlock(index);
  const target = existing && typeof existing === 'object' ? existing : {
    ...defaults
  };
  const source = raw && typeof raw === 'object' ? raw : {};
  const isNew = raw == null;
  let total = Number(source.total);
  if (!Number.isFinite(total) || total < 1) {
    const prevTotal = Number(previous === null || previous === void 0 ? void 0 : previous.total);
    if (isNew && Number.isFinite(prevTotal) && prevTotal > 0) {
      total = prevTotal;
    } else {
      total = Number(defaults.total) || 1;
    }
  }
  target.total = total;
  let n = Number(source.n);
  if (!Number.isFinite(n)) n = Number(defaults.n) || 1;
  target.n = Math.round(n);
  let k = Number(source.k);
  if (!Number.isFinite(k)) k = Number(defaults.k) || 0;
  target.k = Math.round(k);
  target.showWhole = toBoolean(source.showWhole, toBoolean(defaults.showWhole, true));
  target.hideBlock = toBoolean(source.hideBlock, toBoolean(defaults.hideBlock, false));
  if (target.hideBlock) target.showWhole = true;
  target.lockDenominator = toBoolean(source.lockDenominator, toBoolean(defaults.lockDenominator, false));
  target.lockNumerator = toBoolean(source.lockNumerator, toBoolean(defaults.lockNumerator, false));
  target.hideNValue = toBoolean(source.hideNValue, toBoolean(defaults.hideNValue, false));
  target.showCustomText = toBoolean(source.showCustomText, toBoolean(defaults.showCustomText, false));
  const textSource = typeof source.customText === 'string' ? source.customText : (_defaults$customText = defaults.customText) !== null && _defaults$customText !== void 0 ? _defaults$customText : '';
  target.customText = textSource;
  const hasSourceFill = Object.prototype.hasOwnProperty.call(source, 'fillColorIndex');
  let fillIndex = Number(source.fillColorIndex);
  if (!Number.isFinite(fillIndex)) {
    const prevIndex = Number(previous === null || previous === void 0 ? void 0 : previous.fillColorIndex);
    if (isNew && Number.isFinite(prevIndex)) {
      fillIndex = prevIndex;
    } else if (!hasSourceFill && Number.isFinite(target.fillColorIndex)) {
      fillIndex = target.fillColorIndex;
    } else {
      fillIndex = Number(defaults.fillColorIndex) || DEFAULT_FILL_COLOR_INDEX;
    }
  }
  target.fillColorIndex = sanitizeFillIndex(fillIndex, FILL_COLOR_COUNT);
  let desiredDisplay = sanitizeDisplayMode(source.valueDisplay);
  if (!desiredDisplay) {
    if (toBoolean(source.showPercent)) desiredDisplay = 'percent';else if (toBoolean(source.showFraction)) desiredDisplay = 'fraction';else desiredDisplay = sanitizeDisplayMode(defaults.valueDisplay) || 'number';
  }
  applyDisplayMode(target, desiredDisplay, defaults.valueDisplay);
  return target;
}
function normalizeConfig(initial = false) {
  let structureChanged = false;
  const previousRows = getHiddenNumber(CONFIG, '__lastNormalizedRows');
  const previousCols = getHiddenNumber(CONFIG, '__lastNormalizedCols');
  const legacyFillIndex = sanitizeFillIndex(CONFIG.fillColorIndex, FILL_COLOR_COUNT);
  const hasBlockFillIndex = Array.isArray(CONFIG.blocks) && CONFIG.blocks.some(row => {
    if (Array.isArray(row)) {
      return row.some(cell => cell && typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'fillColorIndex'));
    }
    return row && typeof row === 'object' && Object.prototype.hasOwnProperty.call(row, 'fillColorIndex');
  });
  if (typeof CONFIG.minN !== 'number' || Number.isNaN(CONFIG.minN)) CONFIG.minN = 1;
  if (typeof CONFIG.maxN !== 'number' || Number.isNaN(CONFIG.maxN)) CONFIG.maxN = 12;
  CONFIG.minN = Math.max(1, Math.floor(CONFIG.minN));
  CONFIG.maxN = Math.max(CONFIG.minN, Math.floor(CONFIG.maxN));
  if (!Array.isArray(CONFIG.blocks)) {
    CONFIG.blocks = [];
    structureChanged = true;
  }
  let usedRows = 0;
  let usedCols = 0;
  if (Array.isArray(CONFIG.blocks)) {
    for (let r = 0; r < CONFIG.blocks.length; r++) {
      const colsUsed = countMeaningfulColumns(CONFIG.blocks[r]);
      if (colsUsed > 0) {
        usedRows = Math.max(usedRows, r + 1);
        usedCols = Math.max(usedCols, colsUsed);
      }
    }
  }
  usedRows = clamp(usedRows, 0, 3);
  usedCols = clamp(usedCols, 0, 3);
  const rowsDirty = getHiddenBoolean(CONFIG, '__rowsDirty');
  const colsDirty = getHiddenBoolean(CONFIG, '__colsDirty');
  const hasNested = CONFIG.blocks.some(item => Array.isArray(item));
  if (!hasNested) {
    const flat = CONFIG.blocks;
    const activeRaw = Number.isFinite(CONFIG.activeBlocks) ? Math.round(CONFIG.activeBlocks) : (flat === null || flat === void 0 ? void 0 : flat.length) || 1;
    const active = clamp(activeRaw, 1, 9);
    let rows = Number.isFinite(CONFIG.rows) ? Math.round(CONFIG.rows) : 0;
    let cols = Number.isFinite(CONFIG.cols) ? Math.round(CONFIG.cols) : 0;
    if (rows < 1) rows = active <= 3 ? 1 : Math.min(3, Math.ceil(active / 3));
    if (cols < 1) cols = Math.min(3, Math.max(1, active));
    rows = clamp(rows, 1, 3);
    cols = clamp(cols, 1, 3);
    while (rows * cols < active) {
      if (cols < 3) cols += 1;else if (rows < 3) rows += 1;else break;
    }
    const gridData = [];
    let index = 0;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const raw = (flat === null || flat === void 0 ? void 0 : flat[index]) || null;
        let previous = null;
        if (index > 0) {
          if (c > 0) previous = row[c - 1];else if (r > 0) {
            const prevRow = gridData[r - 1];
            previous = Array.isArray(prevRow) ? prevRow[cols - 1] : null;
          }
        }
        row.push(normalizeBlockConfig(raw, index, raw, previous));
        index += 1;
      }
      gridData.push(row);
    }
    CONFIG.blocks = gridData;
    CONFIG.rows = rows;
    CONFIG.cols = cols;
    structureChanged = true;
  } else {
    let rows = Number.isFinite(CONFIG.rows) ? Math.round(CONFIG.rows) : CONFIG.blocks.length || 1;
    rows = clamp(rows, 1, 3);
    if (usedRows > 0) {
      if (rows < usedRows) {
        rows = usedRows;
      } else if (!rowsDirty && rows > usedRows) {
        rows = usedRows;
      }
    }
    let cols = Number.isFinite(CONFIG.cols) ? Math.round(CONFIG.cols) : 0;
    if (!(cols >= 1)) {
      cols = usedCols > 0 ? usedCols : 1;
    }
    cols = clamp(cols, 1, 3);
    if (usedCols > 0) {
      if (cols < usedCols) {
        cols = usedCols;
      } else if (!colsDirty && cols > usedCols) {
        cols = usedCols;
      }
    }
    if (CONFIG.blocks.length !== rows) structureChanged = true;
    CONFIG.blocks.length = rows;
    for (let r = 0; r < rows; r++) {
      let row = CONFIG.blocks[r];
      if (!Array.isArray(row)) {
        row = [];
        CONFIG.blocks[r] = row;
        structureChanged = true;
      }
      if (row.length !== cols) structureChanged = true;
      row.length = cols;
      for (let c = 0; c < cols; c++) {
        const index = r * cols + c;
        const current = row[c];
        let previous = null;
        if (index > 0) {
          if (c > 0) {
            previous = row[c - 1];
          } else if (r > 0) {
            const prevRow = CONFIG.blocks[r - 1];
            previous = Array.isArray(prevRow) ? prevRow[cols - 1] : null;
          }
        }
        row[c] = normalizeBlockConfig(current, index, current, previous);
      }
    }
    CONFIG.rows = rows;
    CONFIG.cols = cols;
  }
  const rows = CONFIG.rows;
  const cols = CONFIG.cols;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cfg = CONFIG.blocks[r][c];
      cfg.n = clamp(Math.round(Number(cfg.n) || CONFIG.minN), CONFIG.minN, CONFIG.maxN);
      cfg.k = clamp(Math.round(Number(cfg.k) || 0), 0, cfg.n);
      cfg.total = Number(cfg.total);
      if (!Number.isFinite(cfg.total) || cfg.total < 1) cfg.total = 1;
      cfg.showWhole = !!cfg.showWhole;
      cfg.hideBlock = !!cfg.hideBlock;
      cfg.lockDenominator = !!cfg.lockDenominator;
      cfg.lockNumerator = !!cfg.lockNumerator;
      cfg.hideNValue = !!cfg.hideNValue;
      if (!hasBlockFillIndex && legacyFillIndex) {
        cfg.fillColorIndex = legacyFillIndex;
      }
    }
  }
  const activeVisible = CONFIG.blocks.reduce((count, row) => {
    if (!Array.isArray(row)) return count;
    return count + row.reduce((rowCount, cfg) => {
      if (!cfg || typeof cfg !== 'object') return rowCount;
      return rowCount + (cfg.hideBlock ? 0 : 1);
    }, 0);
  }, 0);
  CONFIG.visibleBlockCount = activeVisible;
  CONFIG.activeBlocks = rows * cols;
  const existingLabels = Array.isArray(CONFIG.rowLabels) ? CONFIG.rowLabels : [];
  const normalizedRowLabels = [];
  for (let i = 0; i < rows; i++) {
    const value = existingLabels[i];
    normalizedRowLabels.push(typeof value === 'string' ? value : '');
  }
  CONFIG.rowLabels = normalizedRowLabels;
  CONFIG.showCombinedWhole = toBoolean(CONFIG.showCombinedWhole, false);
  CONFIG.showCombinedWholeVertical = toBoolean(CONFIG.showCombinedWholeVertical, false);
  CONFIG.showSum = toBoolean(CONFIG.showSum, false);
  CONFIG.rowGap = sanitizeRowGap(CONFIG.rowGap);
  const rowsChanged = Number.isFinite(previousRows) && previousRows !== rows;
  const colsChanged = Number.isFinite(previousCols) && previousCols !== cols;
  if (rowsChanged || colsChanged) structureChanged = true;
  setHiddenNumber(CONFIG, '__lastNormalizedRows', rows);
  setHiddenNumber(CONFIG, '__lastNormalizedCols', cols);
  setHiddenFlag(CONFIG, '__rowsDirty', false);
  setHiddenFlag(CONFIG, '__colsDirty', false);
  if (!initial && CONFIG.stackBlocks !== undefined) {
    delete CONFIG.stackBlocks;
    structureChanged = true;
  }
  return structureChanged;
}
function rebuildStructure() {
  if (!grid) return;
  const panelsFragment = document.createDocumentFragment();
  const settingsFragment = document.createDocumentFragment();
  BLOCKS.length = 0;
  grid.innerHTML = '';
  if (settingsContainer) settingsContainer.innerHTML = '';
  ROW_LABEL_ELEMENTS.length = 0;
  buildGlobalSettings(settingsFragment);
  const rowElements = [];
  for (let r = 0; r < CONFIG.rows; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'tb-row';
    rowEl.dataset.row = String(r);
    const rowLabel = document.createElement('div');
    rowLabel.className = 'tb-row-label';
    rowLabel.dataset.row = String(r);
    rowLabel.dataset.empty = 'true';
    ROW_LABEL_ELEMENTS[r] = rowLabel;
    rowEl.appendChild(rowLabel);
    rowElements.push(rowEl);
    panelsFragment.appendChild(rowEl);
    for (let c = 0; c < CONFIG.cols; c++) {
      const cfg = CONFIG.blocks[r][c];
      const block = createBlock(r, c, cfg);
      BLOCKS.push(block);
      if (block.panel) rowEl.appendChild(block.panel);
      if (block.fieldset) settingsFragment.appendChild(block.fieldset);
    }
  }
  grid.setAttribute('data-cols', String(CONFIG.cols));
  grid.appendChild(panelsFragment);
  if (settingsContainer) settingsContainer.appendChild(settingsFragment);
  applyFractionPalette(true);
  updateAddButtons();
}

function buildGlobalSettings(targetFragment) {
  if (!targetFragment) return;
  globalControls.fieldset = null;
  globalControls.horizontal = null;
  globalControls.horizontalRow = null;
  globalControls.vertical = null;
  globalControls.verticalRow = null;
  globalControls.rowLabelInputs = [];
  globalControls.rowGapInput = null;
  globalControls.showSumInput = null;
  globalControls.showSumRow = null;
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'tb-settings-global';
  const legend = document.createElement('legend');
  legend.textContent = 'Globale innstillinger';
  fieldset.appendChild(legend);
  const rowCount = Math.max(1, Number.parseInt(CONFIG.rows, 10) || 1);
  if (rowCount > 0) {
    const labelWrapper = document.createElement('div');
    labelWrapper.className = 'tb-row-label-inputs';
    for (let i = 0; i < rowCount; i++) {
      const rowLabel = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Tekst foran rad';
      input.setAttribute('aria-label', `Tekst foran rad ${i + 1}`);
      const existingValue = Array.isArray(CONFIG.rowLabels) && typeof CONFIG.rowLabels[i] === 'string' ? CONFIG.rowLabels[i] : '';
      input.value = existingValue;
      input.addEventListener('input', () => {
        if (!Array.isArray(CONFIG.rowLabels)) CONFIG.rowLabels = [];
        CONFIG.rowLabels[i] = input.value.trim();
        draw(true);
      });
      rowLabel.appendChild(input);
      labelWrapper.appendChild(rowLabel);
      globalControls.rowLabelInputs[i] = input;
    }
    fieldset.appendChild(labelWrapper);
  }
  if (rowCount > 1) {
    const gapLabel = document.createElement('label');
    gapLabel.textContent = 'Mellomrom mellom blokker';
    const gapInput = document.createElement('input');
    gapInput.type = 'number';
    gapInput.min = String(MIN_ROW_GAP);
    gapInput.max = String(MAX_ROW_GAP);
    gapInput.step = '1';
    gapInput.value = String(getConfiguredRowGap());
    const applyGap = () => {
      const parsed = Number.parseFloat(String(gapInput.value).replace(',', '.'));
      if (!Number.isFinite(parsed)) {
        gapInput.value = String(getConfiguredRowGap());
        return;
      }
      const sanitized = sanitizeRowGap(parsed);
      CONFIG.rowGap = sanitized;
      if (gapInput.value !== String(sanitized)) {
        gapInput.value = String(sanitized);
      }
      draw(true);
    };
    gapInput.addEventListener('change', applyGap);
    gapInput.addEventListener('blur', applyGap);
    gapLabel.appendChild(gapInput);
    fieldset.appendChild(gapLabel);
    globalControls.rowGapInput = gapInput;
  }
  const showSumRow = document.createElement('div');
  showSumRow.className = 'checkbox-row';
  const showSumInput = document.createElement('input');
  showSumInput.type = 'checkbox';
  showSumInput.id = 'tb-global-show-sum';
  showSumInput.addEventListener('change', () => {
    CONFIG.showSum = !!showSumInput.checked;
    draw(true);
  });
  const showSumLabel = document.createElement('label');
  showSumLabel.setAttribute('for', showSumInput.id);
  showSumLabel.textContent = 'Vis sum';
  showSumRow.append(showSumInput, showSumLabel);
  fieldset.appendChild(showSumRow);
  globalControls.showSumInput = showSumInput;
  globalControls.showSumRow = showSumRow;
  const horizontalRow = document.createElement('div');
  horizontalRow.className = 'checkbox-row';
  const horizontalInput = document.createElement('input');
  horizontalInput.type = 'checkbox';
  horizontalInput.id = 'tb-global-combined-horizontal';
  horizontalInput.addEventListener('change', () => {
    CONFIG.showCombinedWhole = !!horizontalInput.checked;
    draw(true);
  });
  const horizontalLabel = document.createElement('label');
  horizontalLabel.setAttribute('for', horizontalInput.id);
  horizontalLabel.textContent = 'Vis horisontal markering av total';
  horizontalRow.append(horizontalInput, horizontalLabel);
  fieldset.appendChild(horizontalRow);
  const verticalRow = document.createElement('div');
  verticalRow.className = 'checkbox-row';
  const verticalInput = document.createElement('input');
  verticalInput.type = 'checkbox';
  verticalInput.id = 'tb-global-combined-vertical';
  verticalInput.addEventListener('change', () => {
    CONFIG.showCombinedWholeVertical = !!verticalInput.checked;
    draw(true);
  });
  const verticalLabel = document.createElement('label');
  verticalLabel.setAttribute('for', verticalInput.id);
  verticalLabel.textContent = 'Vis vertikal markering av total';
  verticalRow.append(verticalInput, verticalLabel);
  fieldset.appendChild(verticalRow);
  targetFragment.appendChild(fieldset);
  globalControls.fieldset = fieldset;
  globalControls.horizontal = horizontalInput;
  globalControls.horizontalRow = horizontalRow;
  globalControls.vertical = verticalInput;
  globalControls.verticalRow = verticalRow;
}
function draw(skipNormalization = false) {
  if (!skipNormalization) {
    const structureChanged = normalizeConfig();
    if (structureChanged) {
      rebuildStructure();
      draw(true);
      return;
    }
  }
  const dimensionData = computeDimensionData();
  updateDimensionState(dimensionData);
  if (grid) grid.setAttribute('data-cols', String(CONFIG.cols));
  if (settingsContainer) {
    const parsedColsForSettings = Number(CONFIG.cols);
    const parsedRowsForSettings = Number(CONFIG.rows);
    const safeCols = Number.isFinite(parsedColsForSettings) && parsedColsForSettings > 0 ? Math.floor(parsedColsForSettings) : 1;
    const safeRows = Number.isFinite(parsedRowsForSettings) && parsedRowsForSettings > 0 ? Math.floor(parsedRowsForSettings) : 1;
    settingsContainer.style.setProperty('--tb-settings-cols', String(safeCols));
    settingsContainer.style.setProperty('--tb-settings-rows', String(safeRows));
    settingsContainer.dataset.cols = String(safeCols);
    settingsContainer.dataset.rows = String(safeRows);
  }
  updateAddButtons();
  if (Array.isArray(globalControls.rowLabelInputs)) {
    globalControls.rowLabelInputs.forEach((input, index) => {
      if (!input) return;
      const value = Array.isArray(CONFIG.rowLabels) && typeof CONFIG.rowLabels[index] === 'string' ? CONFIG.rowLabels[index] : '';
      if (input.value !== value) input.value = value;
    });
  }
  if (globalControls.rowGapInput) {
    const desiredGap = String(getConfiguredRowGap());
    if (globalControls.rowGapInput.value !== desiredGap) {
      globalControls.rowGapInput.value = desiredGap;
    }
  }
  if (globalControls.showSumInput) {
    globalControls.showSumInput.checked = !!CONFIG.showSum;
  }
  let maxLabelWidth = 0;
  let needsFrontPadding = false;
  if (grid) {
    const configuredRowGap = getConfiguredRowGap();
    const positiveRowGap = Math.max(configuredRowGap, 0);
    const negativeRowGap = Math.min(configuredRowGap, 0);
    grid.style.setProperty('--tb-row-label-gap', `${ROW_LABEL_GAP}px`);
    grid.style.setProperty('--tb-row-gap', `${positiveRowGap}px`);
    grid.style.setProperty('--tb-negative-row-gap', `${negativeRowGap}px`);
    grid.style.rowGap = `${positiveRowGap}px`;
    grid.style.setProperty('--tb-label-max-width', '0px');
    grid.style.setProperty('--tb-grid-padding-left', `${DEFAULT_GRID_PADDING_LEFT}px`);
  }
  ROW_LABEL_ELEMENTS.forEach((label, index) => {
    if (!label) return;
    const text = Array.isArray(CONFIG.rowLabels) && typeof CONFIG.rowLabels[index] === 'string' ? CONFIG.rowLabels[index] : '';
    const trimmed = text.trim();
    label.textContent = trimmed;
    const hasText = trimmed.length > 0;
    label.dataset.empty = hasText ? 'false' : 'true';
    const rowEl = label.parentElement;
    if (rowEl && rowEl.classList && rowEl.classList.contains('tb-row')) {
      rowEl.dataset.hasLabel = hasText ? 'true' : 'false';
    }
    if (hasText) {
      label.style.display = 'flex';
      const measured = measureRowLabelWidth(trimmed);
      const padded = Math.ceil(Number.isFinite(measured) ? measured : 0) + ROW_LABEL_GAP;
      if (padded > maxLabelWidth) maxLabelWidth = padded;
      if (!needsFrontPadding && index < ROW_LABEL_EXTRA_PADDING_ROWS) {
        needsFrontPadding = true;
      }
    } else {
      label.style.display = 'none';
    }
  });
  if (grid) {
    const safeMax = Math.max(0, Math.ceil(maxLabelWidth));
    grid.style.setProperty('--tb-label-max-width', `${safeMax}px`);
    if (needsFrontPadding) {
      const paddingLeft = DEFAULT_GRID_PADDING_LEFT + ROW_LABEL_EXTRA_LEFT_PADDING;
      grid.style.setProperty('--tb-grid-padding-left', `${paddingLeft}px`);
    }
  }
  const rowTotals = Array.isArray(dimensionState.rowTotals) ? dimensionState.rowTotals : [];
  const visibleBlocks = [];
  let visibleBlockCount = 0;
  for (const block of BLOCKS) {
    var _CONFIG$blocks;
    const cfg = (_CONFIG$blocks = CONFIG.blocks) === null || _CONFIG$blocks === void 0 || (_CONFIG$blocks = _CONFIG$blocks[block.row]) === null || _CONFIG$blocks === void 0 ? void 0 : _CONFIG$blocks[block.col];
    if (!cfg) continue;
    block.cfg = cfg;
    block.index = block.row * CONFIG.cols + block.col;
    visibleBlocks.push(block);
    if (!cfg.hideBlock) visibleBlockCount += 1;
  }
  CONFIG.visibleBlockCount = visibleBlockCount;
  const activeCount = getEffectiveActiveBlockCount();
  const multiple = activeCount > 1;
  multipleBlocksActive = multiple;
  const parsedCols = Number(CONFIG.cols);
  const parsedRows = Number(CONFIG.rows);
  const hasMultipleCols = Number.isFinite(parsedCols) && parsedCols > 1;
  const hasMultipleRows = Number.isFinite(parsedRows) && parsedRows > 1;
  const horizontalAvailable = multiple && hasMultipleCols;
  const verticalAvailable = multiple && hasMultipleRows;
  const sumActive = CONFIG.showSum === true;
  if (globalControls.horizontal) {
    const disableHorizontal = !horizontalAvailable || sumActive;
    globalControls.horizontal.disabled = disableHorizontal;
    if (disableHorizontal) {
      if (!horizontalAvailable) {
        globalControls.horizontal.checked = false;
        CONFIG.showCombinedWhole = false;
      } else {
        globalControls.horizontal.checked = true;
      }
    } else {
      globalControls.horizontal.checked = !!CONFIG.showCombinedWhole;
    }
  }
  if (globalControls.horizontalRow) {
    globalControls.horizontalRow.classList.toggle('is-disabled', !horizontalAvailable || sumActive);
  }
  if (globalControls.vertical) {
    const disableVertical = !verticalAvailable || sumActive;
    globalControls.vertical.disabled = disableVertical;
    if (disableVertical) {
      if (!verticalAvailable) {
        globalControls.vertical.checked = false;
        CONFIG.showCombinedWholeVertical = false;
      } else {
        globalControls.vertical.checked = true;
      }
    } else {
      globalControls.vertical.checked = !!CONFIG.showCombinedWholeVertical;
    }
  }
  if (globalControls.verticalRow) {
    globalControls.verticalRow.classList.toggle('is-disabled', !verticalAvailable || sumActive);
  }
  if (globalControls.showSumRow) {
    const sumAvailable = horizontalAvailable || verticalAvailable || CONFIG.rows * CONFIG.cols > 0;
    globalControls.showSumRow.classList.toggle('is-disabled', !sumAvailable);
    if (globalControls.showSumInput) globalControls.showSumInput.disabled = !sumAvailable;
  }
  let uniformRowHeight = DEFAULT_SVG_HEIGHT;
  let maxRequiredHeight = DEFAULT_SVG_HEIGHT;
  let minTopRatio = Number.POSITIVE_INFINITY;
  let maxBottomRatio = Number.NEGATIVE_INFINITY;
  let hasVisibleRatios = false;
  for (const block of visibleBlocks) {
    const cfg = block.cfg;
    if (!cfg || cfg.hideBlock) continue;
    const ratios = getRowSpanRatios(block, { forLayout: true });
    const { topRatio, bottomRatio } = ratios;
    if (Number.isFinite(topRatio)) {
      minTopRatio = Math.min(minTopRatio, topRatio);
    }
    if (Number.isFinite(bottomRatio)) {
      maxBottomRatio = Math.max(maxBottomRatio, bottomRatio);
    }
    if (Number.isFinite(topRatio) && Number.isFinite(bottomRatio)) {
      const spanRatio = clamp(bottomRatio - topRatio, MIN_SPAN_RATIO, 1);
      if (spanRatio > 0) {
        const requiredHeight = DEFAULT_SVG_HEIGHT * BASE_INNER_RATIO / spanRatio;
        if (Number.isFinite(requiredHeight) && requiredHeight > maxRequiredHeight) {
          maxRequiredHeight = requiredHeight;
        }
      }
      hasVisibleRatios = true;
    }
  }
  if (!hasVisibleRatios) {
    const fallbackRatios = getRowSpanRatios(null, { forLayout: true });
    const fallbackSpan = clamp(fallbackRatios.bottomRatio - fallbackRatios.topRatio, MIN_SPAN_RATIO, 1);
    if (fallbackSpan > 0) {
      const fallbackHeight = DEFAULT_SVG_HEIGHT * BASE_INNER_RATIO / fallbackSpan;
      if (Number.isFinite(fallbackHeight) && fallbackHeight > maxRequiredHeight) {
        maxRequiredHeight = fallbackHeight;
      }
    }
    if (Number.isFinite(fallbackRatios.topRatio)) {
      minTopRatio = Math.min(minTopRatio, fallbackRatios.topRatio);
    }
    if (Number.isFinite(fallbackRatios.bottomRatio)) {
      maxBottomRatio = Math.max(maxBottomRatio, fallbackRatios.bottomRatio);
    }
  }
  if (Number.isFinite(minTopRatio) && Number.isFinite(maxBottomRatio)) {
    const aggregateSpan = clamp(maxBottomRatio - minTopRatio, MIN_SPAN_RATIO, 1);
    if (aggregateSpan > 0) {
      const aggregateHeight = DEFAULT_SVG_HEIGHT * BASE_INNER_RATIO / aggregateSpan;
      if (Number.isFinite(aggregateHeight) && aggregateHeight > maxRequiredHeight) {
        maxRequiredHeight = aggregateHeight;
      }
    }
  }
  uniformRowHeight = maxRequiredHeight;
  for (const block of visibleBlocks) {
    const height = uniformRowHeight;
    if (block === null || block === void 0 ? void 0 : block.panel) {
      const numericHeight = Number.isFinite(height) && height > 0 ? height : DEFAULT_SVG_HEIGHT;
      block.panel.style.setProperty('--tb-svg-height', `${numericHeight.toFixed(2)}px`);
    }
    block.metrics = null;
  }
  const maxRowTotal = rowTotals.reduce((max, value) => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= max) return max;
    return numeric;
  }, 0);
  if (grid) {
    const rowElements = grid.querySelectorAll('.tb-row');
    rowElements.forEach((rowEl, index) => {
      if (!rowEl) return;
      if (maxRowTotal > 0) {
        const total = Number(rowTotals[index]) || 0;
        const ratio = total > 0 ? total / maxRowTotal : 0;
        const clamped = Math.max(0, Math.min(ratio, 1));
        const percentValue = `${(clamped * 100).toFixed(4)}%`;
        rowEl.style.setProperty('--tb-row-width-percent', percentValue);
        rowEl.style.alignSelf = 'flex-start';
      } else {
        rowEl.style.removeProperty('--tb-row-width-percent');
        rowEl.style.alignSelf = '';
      }
    });
  }
  for (const block of visibleBlocks) {
    const rowTotal = rowTotals[block.row];
    updateBlockPanelLayout(block, rowTotal);
  }
  for (const block of visibleBlocks) {
    drawBlock(block);
  }
  drawCombinedWholeOverlay();
  refreshTenkeblokkerPaletteAttributes();
  syncLegacyConfig();
  scheduleAltTextRefresh('draw');
}
function updateAddButtons() {
  const parsedCols = Number(CONFIG.cols);
  const parsedRows = Number(CONFIG.rows);
  const cols = Number.isFinite(parsedCols) ? parsedCols : 1;
  const rows = Number.isFinite(parsedRows) ? parsedRows : 1;
  if (addColumnBtn) addColumnBtn.style.display = cols >= 3 ? 'none' : '';
  if (addRowBtn) addRowBtn.style.display = rows >= 3 ? 'none' : '';
  if (removeColumnBtn) removeColumnBtn.style.display = cols <= 1 ? 'none' : '';
  if (removeRowBtn) removeRowBtn.style.display = rows <= 1 ? 'none' : '';
}
function createBlock(row, col, cfg) {
  var _cfg$total, _cfg$n, _cfg$k;
  const block = {
    row,
    col,
    cfg,
    uid: `tb-${row}-${col}-${Math.random().toString(36).slice(2, 8)}`
  };
  const panel = document.createElement('div');
  panel.className = 'tb-panel';
  panel.dataset.row = String(row);
  panel.dataset.col = String(col);
  block.panel = panel;
  const header = document.createElement('div');
  header.className = 'tb-header';
  header.style.display = 'none';
  block.header = header;
  panel.appendChild(header);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'tb-svg');
  svg.setAttribute('viewBox', `0 0 ${VBW} ${VBH}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  block.svg = svg;
  panel.appendChild(svg);
  block.gBase = createSvgElement(svg, 'g');
  block.gFill = createSvgElement(svg, 'g');
  block.gSep = createSvgElement(svg, 'g');
  block.gVals = createSvgElement(svg, 'g');
  block.gFrame = createSvgElement(svg, 'g');
  block.gHandle = createSvgElement(svg, 'g');
  block.gBrace = createSvgElement(svg, 'g');
  block.rectEmpty = createSvgElement(block.gBase, 'rect', {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    class: 'tb-rect-empty'
  });
  block.rectFrame = createSvgElement(block.gFrame, 'rect', {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    class: 'tb-frame'
  });
  drawBracketSquare(block.gBrace, 0, 0, 0, 0);
  block.totalText = createSvgElement(block.gBrace, 'text', {
    x: 0,
    y: 0,
    class: 'tb-total'
  });
  block.handle = createSvgElement(block.gHandle, 'image', {
    href: DRAG_HANDLE_ICON,
    width: DRAG_HANDLE_SIZE,
    height: DRAG_HANDLE_SIZE,
    class: 'tb-handle',
    'data-handle-size': DRAG_HANDLE_SIZE,
    draggable: 'false',
    focusable: 'false',
    preserveAspectRatio: 'xMidYMid meet',
    tabindex: -1
  });
  setHandleIconPosition(block.handle, 0, 0);
  block.handle.addEventListener('pointerdown', event => onDragStart(block, event));
  const stepper = document.createElement('div');
  stepper.className = 'tb-stepper';
  block.stepper = stepper;
  const minus = document.createElement('button');
  minus.type = 'button';
  minus.textContent = '−';
  minus.setAttribute('aria-label', 'Færre blokker');
  block.minusBtn = minus;
  const nVal = document.createElement('span');
  block.nVal = nVal;
  const plus = document.createElement('button');
  plus.type = 'button';
  plus.textContent = '+';
  plus.setAttribute('aria-label', 'Flere blokker');
  block.plusBtn = plus;
  minus.addEventListener('click', () => {
    var _block$cfg$n, _block$cfg;
    const next = ((_block$cfg$n = (_block$cfg = block.cfg) === null || _block$cfg === void 0 ? void 0 : _block$cfg.n) !== null && _block$cfg$n !== void 0 ? _block$cfg$n : CONFIG.minN) - 1;
    setN(block, next);
  });
  plus.addEventListener('click', () => {
    var _block$cfg$n2, _block$cfg2;
    const next = ((_block$cfg$n2 = (_block$cfg2 = block.cfg) === null || _block$cfg2 === void 0 ? void 0 : _block$cfg2.n) !== null && _block$cfg$n2 !== void 0 ? _block$cfg$n2 : CONFIG.minN) + 1;
    setN(block, next);
  });
  stepper.append(minus, nVal, plus);
  panel.appendChild(stepper);
  const fieldset = document.createElement('fieldset');
  block.fieldset = fieldset;
  fieldset.dataset.row = String(row);
  fieldset.dataset.col = String(col);
  const legend = document.createElement('legend');
  block.legend = legend;
  fieldset.appendChild(legend);
  createBlockFillPicker(block, fieldset);
  const totalLabel = document.createElement('label');
  totalLabel.textContent = 'Lengde';
  const totalInput = document.createElement('input');
  totalInput.type = 'number';
  totalInput.min = '1';
  totalInput.step = '1';
  totalInput.value = String((_cfg$total = cfg === null || cfg === void 0 ? void 0 : cfg.total) !== null && _cfg$total !== void 0 ? _cfg$total : 1);
  totalInput.addEventListener('change', () => {
    const parsed = Number.parseFloat(totalInput.value.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      block.cfg.total = Math.max(parsed, 1);
      draw(true);
    }
  });
  totalLabel.appendChild(totalInput);
  fieldset.appendChild(totalLabel);
  const nLabel = document.createElement('label');
  nLabel.textContent = 'Nevner';
  const nInput = document.createElement('input');
  nInput.type = 'number';
  nInput.min = String(CONFIG.minN);
  nInput.max = String(CONFIG.maxN);
  nInput.step = '1';
  nInput.value = String((_cfg$n = cfg === null || cfg === void 0 ? void 0 : cfg.n) !== null && _cfg$n !== void 0 ? _cfg$n : CONFIG.minN);
  nInput.addEventListener('change', () => {
    const parsed = Number.parseInt(nInput.value, 10);
    if (!Number.isNaN(parsed)) setN(block, parsed);
  });
  nLabel.appendChild(nInput);
  fieldset.appendChild(nLabel);
  const kLabel = document.createElement('label');
  kLabel.textContent = 'Teller';
  const kInput = document.createElement('input');
  kInput.type = 'number';
  kInput.min = '0';
  kInput.step = '1';
  kInput.value = String((_cfg$k = cfg === null || cfg === void 0 ? void 0 : cfg.k) !== null && _cfg$k !== void 0 ? _cfg$k : 0);
  kInput.addEventListener('change', () => {
    const parsed = Number.parseInt(kInput.value, 10);
    if (!Number.isNaN(parsed)) setK(block, parsed);
  });
  kLabel.appendChild(kInput);
  fieldset.appendChild(kLabel);
  const showWholeRow = document.createElement('div');
  showWholeRow.className = 'checkbox-row';
  const showWholeInput = document.createElement('input');
  showWholeInput.type = 'checkbox';
  showWholeInput.id = `${block.uid}-show-whole`;
  showWholeInput.addEventListener('change', () => {
    block.cfg.showWhole = !!showWholeInput.checked;
    draw(true);
  });
  const showWholeLabel = document.createElement('label');
  showWholeLabel.setAttribute('for', showWholeInput.id);
  showWholeLabel.textContent = 'Vis hele';
  showWholeRow.append(showWholeInput, showWholeLabel);
  fieldset.appendChild(showWholeRow);
  const hideBlockRow = document.createElement('div');
  hideBlockRow.className = 'checkbox-row';
  const hideBlockInput = document.createElement('input');
  hideBlockInput.type = 'checkbox';
  hideBlockInput.id = `${block.uid}-hide-block`;
  hideBlockInput.addEventListener('change', () => {
    const checked = !!hideBlockInput.checked;
    block.cfg.hideBlock = checked;
    if (checked) block.cfg.showWhole = true;
    draw(true);
  });
  const hideBlockLabel = document.createElement('label');
  hideBlockLabel.setAttribute('for', hideBlockInput.id);
  hideBlockLabel.textContent = 'Skjul blokk';
  hideBlockRow.append(hideBlockInput, hideBlockLabel);
  fieldset.appendChild(hideBlockRow);
  const lockNRow = document.createElement('div');
  lockNRow.className = 'checkbox-row';
  const lockNInput = document.createElement('input');
  lockNInput.type = 'checkbox';
  lockNInput.id = `${block.uid}-lock-n`;
  lockNInput.addEventListener('change', () => {
    block.cfg.lockDenominator = !lockNInput.checked;
    draw(true);
  });
  const lockNLabel = document.createElement('label');
  lockNLabel.setAttribute('for', lockNInput.id);
  lockNLabel.textContent = 'Endre nevner';
  lockNInput.checked = !(cfg !== null && cfg !== void 0 && cfg.lockDenominator);
  lockNRow.append(lockNInput, lockNLabel);
  fieldset.appendChild(lockNRow);
  const lockKRow = document.createElement('div');
  lockKRow.className = 'checkbox-row';
  const lockKInput = document.createElement('input');
  lockKInput.type = 'checkbox';
  lockKInput.id = `${block.uid}-lock-k`;
  lockKInput.addEventListener('change', () => {
    block.cfg.lockNumerator = !lockKInput.checked;
    draw(true);
  });
  const lockKLabel = document.createElement('label');
  lockKLabel.setAttribute('for', lockKInput.id);
  lockKLabel.textContent = 'Endre teller';
  lockKInput.checked = !(cfg !== null && cfg !== void 0 && cfg.lockNumerator);
  lockKRow.append(lockKInput, lockKLabel);
  fieldset.appendChild(lockKRow);
  const hideNRow = document.createElement('div');
  hideNRow.className = 'checkbox-row';
  const hideNInput = document.createElement('input');
  hideNInput.type = 'checkbox';
  hideNInput.id = `${block.uid}-hide-n`;
  hideNInput.addEventListener('change', () => {
    block.cfg.hideNValue = !hideNInput.checked;
    draw(true);
  });
  const hideNLabel = document.createElement('label');
  hideNLabel.setAttribute('for', hideNInput.id);
  hideNLabel.textContent = 'Vis verdien til nevner';
  hideNInput.checked = !(cfg !== null && cfg !== void 0 && cfg.hideNValue);
  hideNRow.append(hideNInput, hideNLabel);
  fieldset.appendChild(hideNRow);
  const displayLabel = document.createElement('label');
  displayLabel.textContent = 'Vis som';
  const displaySelect = document.createElement('select');
  DISPLAY_OPTIONS.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option;
    opt.textContent = option === 'number' ? 'Tall' : option === 'fraction' ? 'Brøk' : 'Prosent';
    displaySelect.appendChild(opt);
  });
  displaySelect.addEventListener('change', () => {
    applyDisplayMode(block.cfg, displaySelect.value, block.cfg.valueDisplay);
    draw(true);
  });
  displayLabel.appendChild(displaySelect);
  fieldset.appendChild(displayLabel);
  const customTextToggleRow = document.createElement('div');
  customTextToggleRow.className = 'checkbox-row';
  customTextToggleRow.style.display = 'none';
  const customTextToggle = document.createElement('input');
  customTextToggle.type = 'checkbox';
  customTextToggle.id = `${block.uid}-custom-text-toggle`;
  customTextToggle.addEventListener('change', () => {
    block.cfg.showCustomText = !!customTextToggle.checked;
    draw(true);
  });
  const customTextToggleLabel = document.createElement('label');
  customTextToggleLabel.setAttribute('for', customTextToggle.id);
  customTextToggleLabel.textContent = 'Vis tekst i blokk';
  customTextToggleRow.append(customTextToggle, customTextToggleLabel);
  fieldset.appendChild(customTextToggleRow);
  block.customTextToggleRow = customTextToggleRow;
  const customTextLabel = document.createElement('label');
  customTextLabel.textContent = 'Tekst i blokk';
  customTextLabel.style.display = 'none';
  const customTextInput = document.createElement('input');
  customTextInput.type = 'text';
  customTextInput.placeholder = 'Skriv tekst';
  customTextInput.addEventListener('input', () => {
    block.cfg.customText = customTextInput.value;
    draw(true);
  });
  customTextLabel.appendChild(customTextInput);
  fieldset.appendChild(customTextLabel);
  block.customTextLabel = customTextLabel;
  block.customTextInput = customTextInput;
  block.inputs = {
    total: totalInput,
    n: nInput,
    k: kInput,
    showWhole: showWholeInput,
    lockN: lockNInput,
    lockK: lockKInput,
    hideN: hideNInput,
    display: displaySelect,
    showCustomText: customTextToggle,
    customText: customTextInput
  };
  return block;
}
function updateBlockPanelLayout(block, rowTotal) {
  if (!(block !== null && block !== void 0 && block.panel)) return;
  const cfg = block.cfg;
  const totalValue = Number(cfg === null || cfg === void 0 ? void 0 : cfg.total);
  const positiveTotal = Number.isFinite(totalValue) && totalValue > 0 ? totalValue : 0;
  const hasRowTotal = Number.isFinite(rowTotal) && rowTotal > 0;
  const stepperVisible = !(cfg !== null && cfg !== void 0 && cfg.lockDenominator);
  const hasBlockBelow = hasVisibleBlockBelow(block);
  block.hasVisibleBlockBelow = hasBlockBelow;
  const needsVerticalSpace = stepperVisible && hasBlockBelow;
  block.panel.style.flexBasis = '0px';
  block.panel.style.flexShrink = '1';
  if (hasRowTotal && positiveTotal > 0) {
    block.panel.style.flexGrow = String(positiveTotal);
  } else {
    block.panel.style.flexGrow = '1';
  }
  const panelEl = block.panel;
  const stepperEl = block.stepper;
  const stepperHeight = stepperEl && stepperEl.offsetHeight ? stepperEl.offsetHeight : 0;
  let stepperSpacing = 0;
  if (panelEl && typeof window !== 'undefined' && window.getComputedStyle) {
    try {
      const spacingValue = window.getComputedStyle(panelEl).getPropertyValue('--tb-stepper-spacing');
      const parsed = Number.parseFloat(String(spacingValue).replace(',', '.'));
      if (Number.isFinite(parsed)) stepperSpacing = parsed;
    } catch (err) {
      stepperSpacing = 0;
    }
  }
  if (panelEl) {
    const panelHeight = block !== null && block !== void 0 && block.svg ? block.svg.getBoundingClientRect().height : panelEl.getBoundingClientRect().height;
    if (needsVerticalSpace && stepperEl) {
      const shift = stepperHeight + stepperSpacing;
      panelEl.style.position = 'relative';
      panelEl.style.marginBottom = shift > 0 ? `${-shift}px` : '0px';
      panelEl.style.rowGap = '0px';
      stepperEl.style.position = 'absolute';
      stepperEl.style.left = '50%';
      stepperEl.style.transform = 'translate(-50%, -50%)';
      stepperEl.style.top = `${panelHeight}px`;
      stepperEl.style.zIndex = '2';
    } else {
      panelEl.style.position = '';
      panelEl.style.marginBottom = '0px';
      panelEl.style.rowGap = stepperVisible ? 'var(--tb-stepper-spacing, 6px)' : '0px';
      if (stepperEl) {
        stepperEl.style.position = '';
        stepperEl.style.left = '';
        stepperEl.style.transform = '';
        stepperEl.style.top = '';
        stepperEl.style.zIndex = '';
      }
    }
  }
}
function drawBlock(block) {
  var _block$rectEmpty, _block$rectEmpty2, _block$rectEmpty3, _block$rectEmpty4, _block$rectFrame, _block$rectFrame2, _block$rectFrame3, _block$rectFrame4, _block$handle;
  const cfg = block === null || block === void 0 ? void 0 : block.cfg;
  if (!block || !cfg) return;
  const paletteData = applyBlockPalette(block);
  renderBlockFillPicker(block, paletteData.palette, getLinePalette());
  const blockHidden = !!cfg.hideBlock;
  if (blockHidden && !cfg.showWhole) cfg.showWhole = true;
  const metrics = getBlockMetrics(block);
  block.metrics = metrics;
  const {
    width,
    height,
    left,
    right,
    top,
    bottom,
    braceY,
    bracketTick,
    labelOffsetY,
    innerWidth,
    innerHeight,
    centerX
  } = metrics;
  if (block.svg) {
    block.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    block.svg.setAttribute('aria-label', `Tenkeblokk ${block.index + 1}`);
    block.svg.setAttribute('preserveAspectRatio', 'none');
    block.svg.classList.toggle('tb-svg--hidden-block', blockHidden);
  }
  const hiddenDisplay = blockHidden ? 'none' : '';
  if (block.gBase) block.gBase.style.display = hiddenDisplay;
  if (block.gFill) block.gFill.style.display = hiddenDisplay;
  if (block.gSep) block.gSep.style.display = hiddenDisplay;
  if (block.gVals) block.gVals.style.display = hiddenDisplay;
  if (block.gFrame) block.gFrame.style.display = hiddenDisplay;
  if (block.handle) {
    block.handle.style.display = blockHidden ? 'none' : '';
    if (blockHidden || cfg.lockNumerator) {
      block.handle.classList.remove('is-grabbing');
    }
  }
  (_block$rectEmpty = block.rectEmpty) === null || _block$rectEmpty === void 0 || _block$rectEmpty.setAttribute('x', left);
  (_block$rectEmpty2 = block.rectEmpty) === null || _block$rectEmpty2 === void 0 || _block$rectEmpty2.setAttribute('width', innerWidth);
  (_block$rectEmpty3 = block.rectEmpty) === null || _block$rectEmpty3 === void 0 || _block$rectEmpty3.setAttribute('y', top);
  (_block$rectEmpty4 = block.rectEmpty) === null || _block$rectEmpty4 === void 0 || _block$rectEmpty4.setAttribute('height', innerHeight);
  (_block$rectFrame = block.rectFrame) === null || _block$rectFrame === void 0 || _block$rectFrame.setAttribute('x', left);
  (_block$rectFrame2 = block.rectFrame) === null || _block$rectFrame2 === void 0 || _block$rectFrame2.setAttribute('width', innerWidth);
  (_block$rectFrame3 = block.rectFrame) === null || _block$rectFrame3 === void 0 || _block$rectFrame3.setAttribute('y', top);
  (_block$rectFrame4 = block.rectFrame) === null || _block$rectFrame4 === void 0 || _block$rectFrame4.setAttribute('height', innerHeight);
  drawBracketSquare(block.gBrace, left, right, braceY, bracketTick);
  if (block.totalText) {
    block.totalText.setAttribute('x', centerX);
    block.totalText.setAttribute('y', braceY - labelOffsetY);
    block.totalText.textContent = getBlockTotalLabel(block);
  }
  if (block.legend) {
    block.legend.textContent = `Tenkeblokk ${block.index + 1}`;
  }
  const stepperVisible = !cfg.lockDenominator && !blockHidden;
  if (block.stepper) {
    block.stepper.setAttribute('aria-label', `Nevner i tenkeblokk ${block.index + 1}`);
    block.stepper.style.display = stepperVisible ? '' : 'none';
  }
  if (block.nVal) {
    block.nVal.textContent = cfg.n;
    block.nVal.style.display = cfg.hideNValue ? 'none' : '';
  }
  const customTextAvailable = cfg.n === 1;
  if (block.customTextToggleRow) {
    block.customTextToggleRow.style.display = customTextAvailable ? '' : 'none';
  }
  const customTextEnabled = customTextAvailable && cfg.showCustomText;
  if (block.customTextLabel) {
    block.customTextLabel.style.display = customTextEnabled ? '' : 'none';
  }
  if (block.minusBtn) block.minusBtn.disabled = cfg.lockDenominator || cfg.n <= CONFIG.minN;
  if (block.plusBtn) block.plusBtn.disabled = cfg.lockDenominator || cfg.n >= CONFIG.maxN;
  if (block.inputs) {
    const {
      total,
      n,
      k,
      showWhole,
      hideBlock: hideBlockInput,
      lockN,
      lockK,
      hideN,
      display,
      showCustomText,
      customText
    } = block.inputs;
    if (total) total.value = cfg.total;
    if (n) {
      n.value = cfg.n;
      n.min = String(CONFIG.minN);
      n.max = String(CONFIG.maxN);
      n.disabled = !!cfg.lockDenominator;
    }
    if (k) {
      k.value = cfg.k;
      k.max = String(cfg.n);
      k.disabled = !!cfg.lockNumerator;
    }
    if (showWhole) {
      const showWholeDisabled = blockHidden || multipleBlocksActive && !blockHidden;
      if (blockHidden && !cfg.showWhole) cfg.showWhole = true;
      showWhole.checked = !!cfg.showWhole;
      showWhole.disabled = showWholeDisabled;
      if (showWholeDisabled) {
        showWhole.setAttribute('aria-disabled', 'true');
      } else {
        showWhole.removeAttribute('aria-disabled');
      }
    }
    if (hideBlockInput) hideBlockInput.checked = !!cfg.hideBlock;
    if (lockN) lockN.checked = !cfg.lockDenominator;
    if (lockK) lockK.checked = !cfg.lockNumerator;
    if (hideN) hideN.checked = !cfg.hideNValue;
    if (display) {
      const mode = sanitizeDisplayMode(cfg.valueDisplay) || 'number';
      display.value = mode;
    }
    if (showCustomText) {
      showCustomText.checked = !!cfg.showCustomText;
      showCustomText.disabled = !customTextAvailable;
    }
    if (customText) {
      const desiredText = typeof cfg.customText === 'string' ? cfg.customText : '';
      if (customText.value !== desiredText) customText.value = desiredText;
      customText.disabled = !customTextEnabled;
    }
  }
  block.gFill.innerHTML = '';
  block.gSep.innerHTML = '';
  block.gVals.innerHTML = '';
  const denominatorValue = Number(cfg.n);
  const denominator = Number.isFinite(denominatorValue) && denominatorValue > 0 ? Math.round(denominatorValue) : 0;
  const numeratorValue = Number(cfg.k);
  let numeratorCount = Number.isFinite(numeratorValue) ? Math.round(numeratorValue) : 0;
  if (numeratorCount < 0) numeratorCount = 0;
  if (numeratorCount > denominator) numeratorCount = denominator;
  const cellW = !blockHidden && denominator ? innerWidth / denominator : 0;
  if (!blockHidden && cellW > 0) {
    const showCustomText = customTextEnabled;
    const customLabel = typeof cfg.customText === 'string' ? cfg.customText.trim() : '';
    for (let i = 0; i < numeratorCount; i++) {
      createSvgElement(block.gFill, 'rect', {
        x: left + i * cellW,
        y: top,
        width: cellW,
        height: innerHeight,
        class: 'tb-rect'
      });
    }
    for (let i = 1; i < denominator; i++) {
      const x = left + i * cellW;
      createSvgElement(block.gSep, 'line', {
        x1: x,
        y1: top,
        x2: x,
        y2: bottom,
        class: 'tb-sep'
      });
    }
    const displayMode = sanitizeDisplayMode(cfg.valueDisplay) || 'number';
    const per = denominator ? cfg.total / denominator : 0;
    const percentValue = denominator ? 100 / denominator : 0;
    const rowToken = getRowToken(block.row);
    const columnToken = getColumnToken(block.col);
    const segmentVariableLabel = formatProductLabel(rowToken, columnToken);
    const useVariableLabel = displayMode === 'number' && !!segmentVariableLabel;
    for (let i = 0; i < denominator; i++) {
      const cx = left + (i + 0.5) * cellW;
      const cy = top + innerHeight / 2;
      const isFilled = i < numeratorCount;
      const segmentTextColor = getSegmentTextColor(isFilled, paletteData === null || paletteData === void 0 ? void 0 : paletteData.text);
      if (showCustomText) {
        const text = createSvgElement(block.gVals, 'text', {
          x: cx,
          y: cy,
          class: 'tb-val',
          fill: segmentTextColor,
          'data-tb-explicit-fill': 'true'
        });
        text.textContent = customLabel;
        continue;
      }
      if (useVariableLabel) {
        const text = createSvgElement(block.gVals, 'text', {
          x: cx,
          y: cy,
          class: 'tb-val',
          fill: segmentTextColor,
          'data-tb-explicit-fill': 'true'
        });
        text.textContent = segmentVariableLabel;
        continue;
      }
      if (displayMode === 'fraction') {
        renderFractionLabel(block.gVals, cx, cy, 1, denominator, segmentTextColor);
        continue;
      }
      const text = createSvgElement(block.gVals, 'text', {
        x: cx,
        y: cy,
        class: 'tb-val',
        fill: segmentTextColor,
        'data-tb-explicit-fill': 'true'
      });
      const label = displayMode === 'percent' ? `${fmt(percentValue)} %` : fmt(per);
      text.textContent = label;
    }
  }
  const hx = cellW > 0 ? left + numeratorCount * cellW : left;
  const hy = top + innerHeight / 2;
  if (block.handle) {
    setHandleIconPosition(block.handle, hx, hy);
    block.handle.style.cursor = blockHidden || cfg.lockNumerator ? 'default' : 'grab';
  }
  if (block.gHandle) block.gHandle.style.display = blockHidden || cfg.lockNumerator ? 'none' : '';
  const showWholeAllowed = !multipleBlocksActive || blockHidden;
  if (block.gBrace) block.gBrace.style.display = showWholeAllowed && cfg.showWhole ? '' : 'none';
}
function setN(block, next) {
  if (!block) return;
  const cfg = block.cfg;
  if (!cfg) return;
  const clamped = clamp(Math.round(next), CONFIG.minN, CONFIG.maxN);
  if (cfg.n === clamped) return;
  cfg.n = clamped;
  if (cfg.k > cfg.n) cfg.k = cfg.n;
  draw(true);
}
function setK(block, next) {
  if (!block) return;
  const cfg = block.cfg;
  if (!cfg) return;
  const clamped = clamp(Math.round(next), 0, cfg.n);
  if (cfg.k === clamped) return;
  cfg.k = clamped;
  draw(true);
}
function createCombinedWholeOverlay(orientation = 'horizontal') {
  if (!board) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'tb-combined-whole');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.display = 'none';
  svg.style.width = '0';
  svg.style.height = '0';
  svg.dataset.orientation = orientation;
  board.appendChild(svg);
  const group = createSvgElement(svg, 'g', {
    class: 'tb-combined-brace'
  });
  const text = createSvgElement(group, 'text', {
    class: 'tb-total',
    'text-anchor': 'middle'
  });
  return {
    svg,
    group,
    text
  };
}
function getCombinedTotal() {
  let sum = 0;
  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      var _CONFIG$blocks2;
      const value = Number((_CONFIG$blocks2 = CONFIG.blocks) === null || _CONFIG$blocks2 === void 0 || (_CONFIG$blocks2 = _CONFIG$blocks2[r]) === null || _CONFIG$blocks2 === void 0 || (_CONFIG$blocks2 = _CONFIG$blocks2[c]) === null || _CONFIG$blocks2 === void 0 ? void 0 : _CONFIG$blocks2.total);
      if (!Number.isFinite(value)) return NaN;
      sum += value;
    }
  }
  return sum;
}
function getBlockClientMetrics(block) {
  if (!(block !== null && block !== void 0 && block.svg)) return null;
  const rect = block.svg.getBoundingClientRect();
  if (!((rect === null || rect === void 0 ? void 0 : rect.width) > 0) || !((rect === null || rect === void 0 ? void 0 : rect.height) > 0)) return null;
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom
  };
}
function drawCombinedWholeOverlay() {
  drawCombinedWholeOverlayHorizontal();
  drawCombinedWholeOverlayVertical();
}

function getCombinedFigureMetrics() {
  if (!board) return null;
  const metrics = BLOCKS.map(getBlockClientMetrics).filter(Boolean);
  if (!metrics.length) {
    return null;
  }
  const left = Math.min(...metrics.map(m => m.left));
  const right = Math.max(...metrics.map(m => m.right));
  const top = Math.min(...metrics.map(m => m.top));
  const bottom = Math.max(...metrics.map(m => m.bottom));
  const width = right - left;
  const height = bottom - top;
  if (!(width > 0) || !(height > 0)) {
    return null;
  }
  const boardRect = board.getBoundingClientRect();
  return {
    left,
    top,
    width,
    height,
    boardLeft: boardRect.left,
    boardTop: boardRect.top
  };
}

function drawCombinedWholeOverlayHorizontal() {
  const overlay = combinedWholeOverlays.horizontal;
  if (!(overlay !== null && overlay !== void 0 && overlay.svg) || !board) return;
  const activeCount = getEffectiveActiveBlockCount();
  const sumActive = CONFIG.showSum === true;
  const canShow = sumActive ? activeCount > 0 : activeCount > 1 && CONFIG.showCombinedWhole;
  if (!canShow) {
    overlay.svg.style.display = 'none';
    if (grid) grid.style.removeProperty('--tb-grid-padding-top');
    return;
  }
  let metrics = getCombinedFigureMetrics();
  if (!metrics) {
    overlay.svg.style.display = 'none';
    if (grid) grid.style.removeProperty('--tb-grid-padding-top');
    return;
  }
  let { left, top, width, height, boardLeft, boardTop } = metrics;
  const labelOffsetY = Math.max(height * LABEL_OFFSET_RATIO, 12);
  const gapToBlocks = Math.max(Math.min(height * 0.03, 24), 12);
  const textPadding = Math.max(Math.min(labelOffsetY * 0.45, 10), 5);
  const textSafeMargin = Math.max(Math.min(height * 0.012, 10), 4);
  const braceStartY = labelOffsetY + textPadding + textSafeMargin;
  const braceTick = gapToBlocks;
  const overlayTopOffset = braceStartY + braceTick;
  if (grid) {
    const desiredPaddingTop = Math.max(DEFAULT_GRID_PADDING_TOP, overlayTopOffset + COMBINED_WHOLE_TOP_MARGIN);
    const currentPaddingRaw = grid.style.getPropertyValue('--tb-grid-padding-top');
    const currentPadding = Number.parseFloat(currentPaddingRaw);
    if (!Number.isFinite(currentPadding) || Math.abs(currentPadding - desiredPaddingTop) > 0.5) {
      grid.style.setProperty('--tb-grid-padding-top', `${desiredPaddingTop}px`);
      const updatedMetrics = getCombinedFigureMetrics();
      if (updatedMetrics) {
        left = updatedMetrics.left;
        top = updatedMetrics.top;
        width = updatedMetrics.width;
        height = updatedMetrics.height;
        boardLeft = updatedMetrics.boardLeft;
        boardTop = updatedMetrics.boardTop;
      }
    }
  }
  const overlayHeight = height + overlayTopOffset;
  overlay.svg.style.display = '';
  overlay.svg.style.left = `${left - boardLeft}px`;
  overlay.svg.style.top = `${top - boardTop - overlayTopOffset}px`;
  overlay.svg.style.width = `${width}px`;
  overlay.svg.style.height = `${overlayHeight}px`;
  overlay.svg.setAttribute('width', width);
  overlay.svg.setAttribute('height', overlayHeight);
  overlay.svg.setAttribute('viewBox', `0 0 ${width} ${overlayHeight}`);
  overlay.svg.setAttribute('preserveAspectRatio', 'none');
  drawBracketSquare(overlay.group, 0, width, braceStartY, braceTick);
  if (overlay.text) {
    overlay.text.setAttribute('x', width / 2);
    overlay.text.setAttribute('y', braceStartY - labelOffsetY);
    overlay.text.setAttribute('text-anchor', 'middle');
    overlay.text.removeAttribute('dominant-baseline');
    const label = sumActive ? getSumLabel('horizontal') : (() => {
      const total = getCombinedTotal();
      return Number.isFinite(total) ? fmt(total) : '';
    })();
    overlay.text.textContent = label;
  }
}

function drawCombinedWholeOverlayVertical() {
  const overlay = combinedWholeOverlays.vertical;
  if (!(overlay !== null && overlay !== void 0 && overlay.svg) || !board) return;
  const activeCount = getEffectiveActiveBlockCount();
  const sumActive = CONFIG.showSum === true;
  const canShow = sumActive ? activeCount > 0 : activeCount > 1 && CONFIG.showCombinedWholeVertical;
  if (!canShow) {
    overlay.svg.style.display = 'none';
    return;
  }
  const metrics = getCombinedFigureMetrics();
  if (!metrics) {
    overlay.svg.style.display = 'none';
    return;
  }
  const { left, top, width, height, boardLeft, boardTop } = metrics;
  let topInner = height * TOP_RATIO;
  let bottomInner = height * BOTTOM_RATIO;
  const blockBounds = BLOCKS.map(block => {
    const rect = getBlockClientMetrics(block);
    if (!rect) return null;
    const blockMetrics = block.metrics || getBlockMetrics(block);
    if (!blockMetrics) return null;
    return {
      rect,
      metrics: blockMetrics
    };
  }).filter(Boolean);
  if (blockBounds.length) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const { rect, metrics: blockMetrics } of blockBounds) {
      const offsetTop = rect.top - top;
      const outerTop = Number.isFinite(blockMetrics.outerTop) ? blockMetrics.outerTop : 0;
      const outerBottom = Number.isFinite(blockMetrics.outerBottom) ? blockMetrics.outerBottom : blockMetrics.height || 0;
      const start = offsetTop + outerTop;
      const end = offsetTop + outerBottom;
      if (start < minY) minY = start;
      if (end > maxY) maxY = end;
    }
    if (Number.isFinite(minY)) topInner = clamp(minY, 0, height);
    if (Number.isFinite(maxY)) bottomInner = clamp(maxY, topInner, height);
  }
  const gap = Math.max(width * 0.04, 20);
  const labelSpace = Math.max(width * 0.18, 60);
  const bracketX = width + gap;
  const overlayWidth = bracketX + labelSpace;
  const overlayHeight = height;
  overlay.svg.style.display = '';
  overlay.svg.style.left = `${left - boardLeft}px`;
  overlay.svg.style.top = `${top - boardTop}px`;
  overlay.svg.style.width = `${overlayWidth}px`;
  overlay.svg.style.height = `${overlayHeight}px`;
  overlay.svg.setAttribute('width', overlayWidth);
  overlay.svg.setAttribute('height', overlayHeight);
  overlay.svg.setAttribute('viewBox', `0 0 ${overlayWidth} ${overlayHeight}`);
  overlay.svg.setAttribute('preserveAspectRatio', 'none');
  const braceTick = Math.min(Math.max(width * BRACKET_TICK_RATIO, 12), Math.max(bracketX, 12));
  drawVerticalBracketSquare(overlay.group, topInner, bottomInner, bracketX, braceTick);
  if (overlay.text) {
    overlay.text.setAttribute('x', bracketX + labelSpace / 2);
    overlay.text.setAttribute('y', (topInner + bottomInner) / 2);
    overlay.text.setAttribute('text-anchor', 'middle');
    overlay.text.setAttribute('dominant-baseline', 'middle');
    const label = sumActive ? getSumLabel('vertical') : (() => {
      const total = getCombinedTotal();
      return Number.isFinite(total) ? fmt(total) : '';
    })();
    overlay.text.textContent = label;
  }
}
function onDragStart(block, event) {
  if (!(block !== null && block !== void 0 && block.handle)) return;
  const cfg = block.cfg;
  if (cfg !== null && cfg !== void 0 && cfg.lockNumerator) return;
  block.handle.classList.add('is-grabbing');
  if (typeof block.handle.setPointerCapture === 'function') {
    try {
      block.handle.setPointerCapture(event.pointerId);
    } catch (error) {}
  }
  const move = ev => {
    var _ref, _metrics$innerWidth, _metrics$left, _metrics$right;
    const currentCfg = block.cfg;
    if (!currentCfg) return;
    const p = clientToSvg(block.svg, ev.clientX, ev.clientY);
    const metrics = block.metrics || getBlockMetrics(block);
    const innerWidth = (_ref = (_metrics$innerWidth = metrics === null || metrics === void 0 ? void 0 : metrics.innerWidth) !== null && _metrics$innerWidth !== void 0 ? _metrics$innerWidth : metrics === null || metrics === void 0 ? void 0 : metrics.width) !== null && _ref !== void 0 ? _ref : VBW;
    const left = (_metrics$left = metrics === null || metrics === void 0 ? void 0 : metrics.left) !== null && _metrics$left !== void 0 ? _metrics$left : 0;
    const right = (_metrics$right = metrics === null || metrics === void 0 ? void 0 : metrics.right) !== null && _metrics$right !== void 0 ? _metrics$right : left + innerWidth;
    const denom = currentCfg.n || 1;
    const cellW = innerWidth / denom;
    if (!(cellW > 0)) return;
    const x = clamp(p.x, left, right);
    const snapK = Math.round((x - left) / cellW);
    setK(block, snapK);
  };
  const up = () => {
    if (typeof block.handle.releasePointerCapture === 'function') {
      try {
        block.handle.releasePointerCapture(event.pointerId);
      } catch (error) {}
    }
    block.handle.classList.remove('is-grabbing');
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
}
function getFrameInset(block) {
  let inset = DEFAULT_FRAME_INSET;
  if (!block) return inset;
  const rectFrame = block.rectFrame;
  if (rectFrame) {
    var _rectFrame$getAttribu;
    const attr = (_rectFrame$getAttribu = rectFrame.getAttribute) === null || _rectFrame$getAttribu === void 0 ? void 0 : _rectFrame$getAttribu.call(rectFrame, 'stroke-width');
    if (attr) {
      const parsed = Number.parseFloat(attr);
      if (Number.isFinite(parsed) && parsed >= 0) {
        inset = parsed / 2;
      }
    } else if (typeof window !== 'undefined' && window.getComputedStyle) {
      try {
        const computed = window.getComputedStyle(rectFrame).getPropertyValue('stroke-width');
        const parsed = Number.parseFloat(String(computed).replace(',', '.'));
        if (Number.isFinite(parsed) && parsed >= 0) {
          inset = parsed / 2;
        }
      } catch (err) {
        // ignore measurement errors
      }
    }
  }
  return inset;
}
function syncLegacyConfig() {
  var _CONFIG$blocks3;
  const first = (_CONFIG$blocks3 = CONFIG.blocks) === null || _CONFIG$blocks3 === void 0 || (_CONFIG$blocks3 = _CONFIG$blocks3[0]) === null || _CONFIG$blocks3 === void 0 ? void 0 : _CONFIG$blocks3[0];
  if (!first) return;
  CONFIG.total = first.total;
  CONFIG.n = first.n;
  CONFIG.k = first.k;
  CONFIG.showWhole = first.showWhole;
  CONFIG.hideBlock = first.hideBlock;
  CONFIG.lockDenominator = first.lockDenominator;
  CONFIG.lockNumerator = first.lockNumerator;
  CONFIG.hideNValue = first.hideNValue;
  CONFIG.showFraction = first.showFraction;
  CONFIG.showPercent = first.showPercent;
  CONFIG.valueDisplay = first.valueDisplay;
  CONFIG.showCustomText = first.showCustomText;
  CONFIG.customText = first.customText;
  CONFIG.fillColorIndex = Number.isFinite(first.fillColorIndex) ? first.fillColorIndex : DEFAULT_FILL_COLOR_INDEX;
  CONFIG.activeBlocks = CONFIG.rows * CONFIG.cols;
}
function createSvgElement(parent, name, attrs = {}) {
  const svgEl = parent.ownerSVGElement || parent;
  const el = document.createElementNS(svgEl.namespaceURI, name);
  applySvgAttributes(el, attrs);
  parent.appendChild(el);
  return el;
}
function applySvgAttributes(el, attrs = {}) {
  if (!el || !attrs || typeof attrs !== 'object') return;
  Object.entries(attrs).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (key === 'href' || key === 'xlink:href') {
      el.setAttribute('href', value);
      el.setAttributeNS(XLINK_NS, 'href', value);
      return;
    }
    el.setAttribute(key, value);
  });
}

function refreshTenkeblokkerPaletteAttributes(root) {
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return;
  const scope = root && typeof root.querySelectorAll === 'function' ? root : document;
  if (!scope || typeof scope.querySelectorAll !== 'function') return;
  const targets = [
    { selector: '.tb-rect', property: 'fill', attribute: 'fill' },
    { selector: '.tb-frame', property: 'stroke', attribute: 'stroke' },
    { selector: '.tb-sep', property: 'stroke', attribute: 'stroke' },
    { selector: '.tb-brace', property: 'stroke', attribute: 'stroke' },
    { selector: '.tb-brace--union', property: 'fill', attribute: 'fill' },
    { selector: '.tb-frac-line', property: 'stroke', attribute: 'stroke' },
    { selector: '.tb-total', property: 'fill', attribute: 'fill' },
    { selector: '.tb-val', property: 'fill', attribute: 'fill' },
    { selector: '.tb-frac text', property: 'fill', attribute: 'fill' }
  ];
  targets.forEach(meta => {
    let elements;
    try {
      elements = scope.querySelectorAll(meta.selector);
    } catch (_) {
      elements = [];
    }
    elements.forEach(el => {
      if (!el) return;
      const explicitFill = meta.attribute === 'fill' && typeof el.getAttribute === 'function' && el.getAttribute('data-tb-explicit-fill') === 'true';
      if (explicitFill) {
        return;
      }
      let value = '';
      try {
        value = window.getComputedStyle(el).getPropertyValue(meta.property);
      } catch (_) {
        value = '';
      }
      const normalized = typeof value === 'string' ? value.trim() : '';
      if (!normalized || normalized === 'none') return;
      try {
        el.setAttribute(meta.attribute, normalized);
      } catch (_) {}
    });
  });
}
function setHandleIconPosition(handle, cx, cy) {
  if (!handle) return;
  const sizeAttr = handle.getAttribute('data-handle-size');
  const parsed = sizeAttr ? Number.parseFloat(sizeAttr) : NaN;
  const size = Number.isFinite(parsed) ? parsed : DRAG_HANDLE_SIZE;
  const half = size / 2;
  handle.setAttribute('x', cx - half);
  handle.setAttribute('y', cy - half);
}
function renderFractionLabel(parent, cx, cy, numerator, denominator, textColor) {
  if (!parent) return;
  const numText = typeof numerator === 'number' ? numerator.toString() : `${numerator !== null && numerator !== void 0 ? numerator : ''}`;
  const denText = typeof denominator === 'number' ? denominator.toString() : `${denominator !== null && denominator !== void 0 ? denominator : ''}`;
  if (!numText || !denText) return;
  const numeratorY = -20;
  const denominatorY = 28;
  const fallbackCenter = (numeratorY + denominatorY) / 2;
  const maxLen = Math.max(numText.length, denText.length);
  const charWidth = 20;
  const halfWidth = Math.max(16, maxLen * charWidth / 2);
  const group = createSvgElement(parent, 'g', {
    class: 'tb-frac'
  });
  const resolvedTextColor = typeof textColor === 'string' && textColor.trim() ? textColor : '#000';
  const numeratorEl = createSvgElement(group, 'text', {
    x: 0,
    y: numeratorY,
    class: 'tb-frac-num',
    'text-anchor': 'middle',
    fill: resolvedTextColor,
    'data-tb-explicit-fill': 'true'
  });
  numeratorEl.textContent = numText;
  const lineEl = createSvgElement(group, 'line', {
    x1: -halfWidth,
    x2: halfWidth,
    y1: fallbackCenter,
    y2: fallbackCenter,
    class: 'tb-frac-line'
  });
  const denominatorEl = createSvgElement(group, 'text', {
    x: 0,
    y: denominatorY,
    class: 'tb-frac-den',
    'text-anchor': 'middle',
    fill: resolvedTextColor,
    'data-tb-explicit-fill': 'true'
  });
  denominatorEl.textContent = denText;
  let appliedCenter = fallbackCenter;
  const hasBBox = typeof numeratorEl.getBBox === 'function' && typeof denominatorEl.getBBox === 'function';
  if (hasBBox) {
    try {
      const numeratorBBox = numeratorEl.getBBox();
      const denominatorBBox = denominatorEl.getBBox();
      const numeratorBottom = numeratorBBox.y + numeratorBBox.height;
      const denominatorTop = denominatorBBox.y;
      const visualLineY = (numeratorBottom + denominatorTop) / 2;
      lineEl.setAttribute('y1', visualLineY);
      lineEl.setAttribute('y2', visualLineY);
      const fractionTop = Math.min(numeratorBBox.y, denominatorBBox.y);
      const fractionBottom = Math.max(numeratorBottom, denominatorBBox.y + denominatorBBox.height);
      appliedCenter = (fractionTop + fractionBottom) / 2;
    } catch (err) {
      // ignore measurement errors
    }
  }
  group.setAttribute('transform', `translate(${cx}, ${cy - appliedCenter})`);
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function fmt(value) {
  return (Math.round(value * 100) / 100).toString().replace('.', ',');
}
function clientToSvg(svgEl, clientX, clientY) {
  var _svgEl$viewBox, _vb$width, _vb$height, _vb$x, _vb$y;
  const rect = svgEl.getBoundingClientRect();
  const vb = (_svgEl$viewBox = svgEl.viewBox) === null || _svgEl$viewBox === void 0 ? void 0 : _svgEl$viewBox.baseVal;
  const width = (_vb$width = vb === null || vb === void 0 ? void 0 : vb.width) !== null && _vb$width !== void 0 ? _vb$width : VBW;
  const height = (_vb$height = vb === null || vb === void 0 ? void 0 : vb.height) !== null && _vb$height !== void 0 ? _vb$height : VBH;
  const minX = (_vb$x = vb === null || vb === void 0 ? void 0 : vb.x) !== null && _vb$x !== void 0 ? _vb$x : 0;
  const minY = (_vb$y = vb === null || vb === void 0 ? void 0 : vb.y) !== null && _vb$y !== void 0 ? _vb$y : 0;
  if (!rect.width || !rect.height) return {
    x: minX,
    y: minY
  };
  const sx = width / rect.width;
  const sy = height / rect.height;
  return {
    x: minX + (clientX - rect.left) * sx,
    y: minY + (clientY - rect.top) * sy
  };
}
function drawBracketSquare(group, x0, x1, y, tick) {
  const path = getOrCreateBracePath(group);
  if (!path) return;
  const width = Number.isFinite(x1 - x0) ? x1 - x0 : 0;
  const clampedWidth = Math.max(0, width);
  const clampedTick = Math.max(0, Number.isFinite(tick) ? tick : 0);
  if (!(clampedWidth > 0) || !(clampedTick > 0)) {
    path.removeAttribute('d');
    path.removeAttribute('transform');
    if (path.classList) path.classList.remove('tb-brace--union');
    return;
  }
  const innerWidth = UNION_BRACE_INNER_WIDTH || 1;
  const innerHeight = UNION_BRACE_INNER_HEIGHT || 1;
  const scaleX = clampedWidth / innerWidth;
  const scaleY = clampedTick / innerHeight;
  const translateX = x0 - UNION_BRACE_BOUNDS.left * scaleX;
  const translateY = y - UNION_BRACE_BOUNDS.top * scaleY;
  path.setAttribute('d', UNION_BRACE_PATH);
  path.setAttribute('transform', `translate(${translateX} ${translateY}) scale(${scaleX} ${scaleY})`);
  if (path.classList) path.classList.add('tb-brace--union');
}
function drawVerticalBracketSquare(group, y0, y1, x, tick) {
  const path = getOrCreateBracePath(group);
  if (!path) return;
  const clampedTick = Math.max(0, Math.min(tick, x));
  const d = [`M ${x} ${y0}`, `h ${-clampedTick}`, `M ${x} ${y0}`, `V ${y1}`, `M ${x} ${y1}`, `h ${-clampedTick}`].join(' ');
  if (path.classList) path.classList.remove('tb-brace--union');
  path.removeAttribute('transform');
  path.setAttribute('d', d);
}
function getOrCreateBracePath(group) {
  var _group$ownerSVGElemen;
  if (!group) return null;
  const ns = ((_group$ownerSVGElemen = group.ownerSVGElement) === null || _group$ownerSVGElemen === void 0 ? void 0 : _group$ownerSVGElemen.namespaceURI) || 'http://www.w3.org/2000/svg';
  let path = group.querySelector('path.tb-brace');
  if (!path) {
    path = document.createElementNS(ns, 'path');
    path.setAttribute('class', 'tb-brace');
    const firstChild = group.firstChild;
    if (firstChild) group.insertBefore(path, firstChild);else group.appendChild(path);
  }
  return path;
}
function svgToString(svgEl) {
  if (!svgEl) return '';
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
  if (!clone) return '';
  const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
  const style = document.createElement('style');
  style.textContent = css;
  const firstElement = clone.firstElementChild;
  if (
    firstElement &&
    typeof firstElement.tagName === 'string' &&
    firstElement.tagName.toLowerCase() === 'rect' &&
    firstElement.getAttribute('fill') === '#ffffff'
  ) {
    clone.insertBefore(style, firstElement.nextSibling);
  } else if (clone.firstChild) {
    clone.insertBefore(style, clone.firstChild);
  } else {
    clone.appendChild(style);
  }
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clone.getAttribute('xmlns:xlink')) {
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
function buildTenkeblokkerExportMeta() {
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const summary = collectTenkeblokkerAltSummary();
  const rows = summary && Number.isFinite(summary.rows) ? Math.max(1, summary.rows) : 1;
  const cols = summary && Number.isFinite(summary.cols) ? Math.max(1, summary.cols) : 1;
  const blocks = summary && Array.isArray(summary.blocks) ? summary.blocks.filter(block => block && block.visible !== false) : [];
  const descriptionParts = [`Tenkeblokker med ${rows}×${cols} ruter`];
  descriptionParts.push(blocks.length === 1 ? '1 blokk' : `${blocks.length} blokker`);
  if (summary && summary.showCombinedWhole) descriptionParts.push('kombinert hel vises');
  const description = `${descriptionParts.join(' – ')}.`;
  const slugParts = ['tenkeblokker', `${rows}x${cols}`, `${blocks.length}blokker`];
  if (summary && summary.showCombinedWhole) slugParts.push('kombinert');
  const slugBase = slugParts.join(' ');
  const slug = helper && typeof helper.slugify === 'function' ? helper.slugify(slugBase, 'tenkeblokker') : slugParts.join('-').toLowerCase();
  return {
    description,
    slug,
    defaultBaseName: slug || 'tenkeblokker',
    summary
  };
}
async function downloadSVG(svgEl, filename) {
  const suggestedName = typeof filename === 'string' && filename ? filename : 'tenkeblokker.svg';
  const data = svgToString(svgEl);
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const meta = buildTenkeblokkerExportMeta();
  const htmlTarget = document.querySelector('.figure') || svgEl;
  if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
    await helper.exportGraphicWithArchiveWithFallback({
      svgElement: svgEl,
      htmlTarget,
      suggestedName,
      toolId: 'tenkeblokker',
      svgString: data,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: meta.summary
    });
    return;
  }
  if (helper && typeof helper.exportSvgWithArchive === 'function') {
    await helper.exportSvgWithArchive(svgEl, suggestedName, 'tenkeblokker', {
      svgString: data,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: meta.summary
    });
    return;
  }
  const blob = new Blob([data], {
    type: 'image/svg+xml;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName.endsWith('.svg') ? suggestedName : `${suggestedName}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
  var _svgEl$viewBox2;
  const vb = (_svgEl$viewBox2 = svgEl.viewBox) === null || _svgEl$viewBox2 === void 0 ? void 0 : _svgEl$viewBox2.baseVal;
  const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || 420;
  const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || 420;
  const data = svgToString(svgEl);
  const blob = new Blob([data], {
    type: 'image/svg+xml;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
  const canvas = document.createElement('canvas');
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const sizing = helper && typeof helper.ensureMinimumPngDimensions === 'function'
    ? helper.ensureMinimumPngDimensions({ width: w, height: h }, { scale })
    : (() => {
        const minDimension = 100;
        const baseScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
        const safeWidth = Number.isFinite(w) && w > 0 ? w : minDimension;
        const safeHeight = Number.isFinite(h) && h > 0 ? h : minDimension;
        const scaledWidth = safeWidth * baseScale;
        const scaledHeight = safeHeight * baseScale;
        const scaleMultiplier = Math.max(
          1,
          scaledWidth > 0 ? minDimension / scaledWidth : 1,
          scaledHeight > 0 ? minDimension / scaledHeight : 1
        );
        const finalScale = baseScale * scaleMultiplier;
        return {
          width: Math.max(minDimension, Math.round(safeWidth * finalScale)),
          height: Math.max(minDimension, Math.round(safeHeight * finalScale))
        };
      })();
  canvas.width = sizing.width;
  canvas.height = sizing.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob(blobPng => {
      if (!blobPng) return;
      const urlPng = URL.createObjectURL(blobPng);
      const a = document.createElement('a');
      a.href = urlPng;
      a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
    }, 'image/png');
  };
  img.src = url;
}
function getExportSvg() {
  var _BLOCKS$, _rowInfo$find;
  const firstSvg = (_BLOCKS$ = BLOCKS[0]) === null || _BLOCKS$ === void 0 ? void 0 : _BLOCKS$.svg;
  if (!firstSvg) return null;
  const ns = firstSvg.namespaceURI;
  const rows = CONFIG.rows;
  const rowInfo = Array.from({
    length: rows
  }, () => ({
    blocks: [],
    width: 0,
    height: 0
  }));
  for (const block of BLOCKS) {
    if (!block) continue;
    const metrics = block.metrics || getBlockMetrics(block);
    const row = rowInfo[block.row];
    if (!row) continue;
    row.blocks.push({
      block,
      metrics
    });
    const widthValue = metrics === null || metrics === void 0 ? void 0 : metrics.width;
    const heightValue = metrics === null || metrics === void 0 ? void 0 : metrics.height;
    const blockWidth = Number.isFinite(widthValue) && widthValue > 0 ? widthValue : VBW;
    const blockHeight = Number.isFinite(heightValue) && heightValue > 0 ? heightValue : DEFAULT_SVG_HEIGHT;
    row.width += blockWidth;
    if (row.height < blockHeight) row.height = blockHeight;
  }
  const figureWidth = rowInfo.reduce((max, row) => Math.max(max, row.width || 0), 0) || VBW;
  const rowLabels = Array.isArray(CONFIG.rowLabels) ? CONFIG.rowLabels : [];
  const exportRowGap = getConfiguredRowGap();
  const labelTexts = rowInfo.map((_, index) => {
    const value = rowLabels[index];
    return typeof value === 'string' ? value.trim() : '';
  });
  const labelBaseWidth = labelTexts.reduce((max, text) => {
    if (!text) return max;
    const estimated = Math.max(48, Math.min(200, text.length * 14 + 24));
    return Math.max(max, estimated);
  }, 0);
  const labelPadding = labelBaseWidth > 0 ? 12 : 0;
  const labelSpace = labelBaseWidth > 0 ? labelBaseWidth + labelPadding : 0;
  const contentHeight = rowInfo.reduce((sum, row, index) => {
    if (!row.blocks.length) return sum;
    const gap = index > 0 ? exportRowGap : 0;
    return sum + row.height + gap;
  }, 0) || DEFAULT_SVG_HEIGHT;
  const activeCount = getEffectiveActiveBlockCount();
  const sumActive = CONFIG.showSum === true;
  const exportDimension = computeDimensionData();
  const horizontalSumLabel = sumActive ? getSumLabel('horizontal', exportDimension) : '';
  const verticalSumLabel = sumActive ? getSumLabel('vertical', exportDimension) : '';
  const horizontalActive = CONFIG.showCombinedWhole && activeCount > 1 || sumActive && activeCount > 0;
  const verticalActive = CONFIG.showCombinedWholeVertical && activeCount > 1 && figureWidth > 0 || sumActive && activeCount > 0 && figureWidth > 0;
  const verticalGap = verticalActive ? Math.max(figureWidth * 0.04, 20) : 0;
  const verticalLabelSpace = verticalActive ? Math.max(figureWidth * 0.18, 60) : 0;
  const verticalExtra = verticalActive ? verticalGap + verticalLabelSpace : 0;
  const contentWidth = labelSpace + figureWidth + verticalExtra;
  const padding = Math.max(0, EXPORT_PADDING);
  const exportWidth = contentWidth + padding * 2;
  const exportHeight = contentHeight + padding * 2;
  const exportSvg = document.createElementNS(ns, 'svg');
  exportSvg.setAttribute('viewBox', `0 0 ${exportWidth} ${exportHeight}`);
  exportSvg.setAttribute('width', exportWidth);
  exportSvg.setAttribute('height', exportHeight);
  exportSvg.setAttribute('xmlns', ns);
  exportSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const root = document.documentElement;
    if (root) {
      const computed = window.getComputedStyle(root);
      const fontFamily = computed.getPropertyValue('--tb-font-family');
      if (fontFamily && fontFamily.trim()) {
        exportSvg.style.setProperty('--tb-font-family', fontFamily.trim());
      }
      const fillColor = computed.getPropertyValue('--tb-fill');
      if (fillColor && fillColor.trim()) {
        exportSvg.style.setProperty('--tb-fill', fillColor.trim());
      }
      const lineColor = computed.getPropertyValue('--tb-line');
      if (lineColor && lineColor.trim()) {
        exportSvg.style.setProperty('--tb-line', lineColor.trim());
      }
      const textColor = computed.getPropertyValue('--tb-text');
      if (textColor && textColor.trim()) {
        exportSvg.style.setProperty('--tb-text', textColor.trim());
      }
    }
  }
  const styleEl = document.createElementNS(ns, 'style');
  styleEl.setAttribute('type', 'text/css');
  styleEl.textContent = EXPORT_STYLE_RULES;
  exportSvg.appendChild(styleEl);
  if (window.MathVisAltText) {
    const { titleEl, descEl } = window.MathVisAltText.ensureSvgA11yNodes(exportSvg);
    const title = getTenkeblokkerTitle();
    if (titleEl) titleEl.textContent = title;
    const desc = getActiveTenkeblokkerAltText();
    if (descEl) descEl.textContent = desc;
    exportSvg.setAttribute('role', 'img');
    exportSvg.setAttribute('aria-label', title);
    if (titleEl && titleEl.id) exportSvg.setAttribute('aria-labelledby', titleEl.id);
    if (descEl && descEl.id) exportSvg.setAttribute('aria-describedby', descEl.id);
  }
  createSvgElement(exportSvg, 'rect', {
    x: 0,
    y: 0,
    width: exportWidth,
    height: exportHeight,
    fill: '#fff'
  });
  const contentGroup = document.createElementNS(ns, 'g');
  contentGroup.setAttribute('transform', `translate(${padding},${padding})`);
  exportSvg.appendChild(contentGroup);
  let offsetY = 0;
  rowInfo.forEach((row, rowIndex) => {
    if (!row.blocks.length) return;
    if (rowIndex > 0) offsetY += exportRowGap;
    const rowContainer = document.createElementNS(ns, 'g');
    rowContainer.setAttribute('transform', `translate(0,${offsetY})`);
    contentGroup.appendChild(rowContainer);
    const labelText = labelTexts[rowIndex];
    if (labelText) {
      const firstEntry = row.blocks[0];
      const metrics = (firstEntry === null || firstEntry === void 0 ? void 0 : firstEntry.metrics) || null;
      const baseline = metrics && Number.isFinite(metrics.top) ? metrics.top : BRACE_Y_RATIO * row.height;
      const labelY = baseline + 24;
      const labelEl = createSvgElement(rowContainer, 'text', {
        x: labelSpace > 0 ? labelSpace - 12 : 0,
        y: labelY,
        class: 'tb-row-label-text',
        'text-anchor': labelSpace > 0 ? 'end' : 'start'
      });
      labelEl.textContent = labelText;
    }
    const blocksGroup = document.createElementNS(ns, 'g');
    blocksGroup.setAttribute('transform', `translate(${labelSpace},0)`);
    rowContainer.appendChild(blocksGroup);
    let offsetX = 0;
    row.blocks.forEach(({
      block,
      metrics
    }) => {
      var _metrics$width, _block$svg$viewBox;
      if (!(block !== null && block !== void 0 && block.svg)) return;
      const g = document.createElementNS(ns, 'g');
      if (block.cfg) {
        const resolved = resolveBlockPalette(block.cfg);
        g.style.setProperty('--tb-fill', resolved.fill);
        g.style.setProperty('--tb-line', resolved.line);
        g.style.setProperty('--tb-text', resolved.text);
      }
      g.setAttribute('transform', `translate(${offsetX},0)`);
      const blockClone = block.svg.cloneNode(true);
      const exportHandleElements = blockClone.querySelectorAll('.tb-handle');
      exportHandleElements.forEach(el => el.remove());
      g.innerHTML = blockClone.innerHTML;
      blocksGroup.appendChild(g);
      const widthValue = (_metrics$width = metrics === null || metrics === void 0 ? void 0 : metrics.width) !== null && _metrics$width !== void 0 ? _metrics$width : (_block$svg$viewBox = block.svg.viewBox) === null || _block$svg$viewBox === void 0 || (_block$svg$viewBox = _block$svg$viewBox.baseVal) === null || _block$svg$viewBox === void 0 ? void 0 : _block$svg$viewBox.width;
      const blockWidth = Number.isFinite(widthValue) && widthValue > 0 ? widthValue : VBW;
      offsetX += blockWidth;
    });
    offsetY += row.height;
  });
  const referenceHeight = ((_rowInfo$find = rowInfo.find(row => row.blocks.length)) === null || _rowInfo$find === void 0 ? void 0 : _rowInfo$find.height) || DEFAULT_SVG_HEIGHT;
  const totalValue = getCombinedTotal();
  let exportTopInner = contentHeight * TOP_RATIO;
  let exportBottomInner = contentHeight * BOTTOM_RATIO;
  if (verticalActive) {
    let minY = Infinity;
    let maxY = -Infinity;
    let offsetYForRows = 0;
    rowInfo.forEach((row, rowIndex) => {
      if (!row.blocks.length) return;
      if (rowIndex > 0) offsetYForRows += exportRowGap;
      for (const { metrics } of row.blocks) {
        if (!metrics) continue;
        const outerTop = Number.isFinite(metrics.outerTop) ? metrics.outerTop : 0;
        const fallbackHeight = Number.isFinite(metrics.height) ? metrics.height : row.height || 0;
        const outerBottom = Number.isFinite(metrics.outerBottom) ? metrics.outerBottom : fallbackHeight;
        const start = offsetYForRows + outerTop;
        const end = offsetYForRows + outerBottom;
        if (start < minY) minY = start;
        if (end > maxY) maxY = end;
      }
      offsetYForRows += row.height;
    });
    if (Number.isFinite(minY)) exportTopInner = clamp(minY, 0, contentHeight);
    if (Number.isFinite(maxY)) exportBottomInner = clamp(maxY, exportTopInner, contentHeight);
  }
  if (horizontalActive) {
    const startX = labelSpace;
    const endX = labelSpace + figureWidth;
    const braceGroup = createSvgElement(contentGroup, 'g', {
      class: 'tb-combined-brace'
    });
    const braceY = BRACE_Y_RATIO * referenceHeight;
    const tick = BRACKET_TICK_RATIO * referenceHeight;
    drawBracketSquare(braceGroup, startX, endX, braceY, tick);
    const textSafeMargin = Math.max(referenceHeight * 0.02, 10);
    const totalText = createSvgElement(braceGroup, 'text', {
      x: (startX + endX) / 2,
      y: braceY - LABEL_OFFSET_RATIO * referenceHeight + textSafeMargin,
      class: 'tb-total',
      'text-anchor': 'middle'
    });
    const label = sumActive ? (horizontalSumLabel || (Number.isFinite(totalValue) ? fmt(totalValue) : '')) : Number.isFinite(totalValue) ? fmt(totalValue) : '';
    totalText.textContent = label;
  }
  if (verticalActive) {
    const braceGroup = createSvgElement(contentGroup, 'g', {
      class: 'tb-combined-brace'
    });
    const bracketX = labelSpace + figureWidth + verticalGap;
    const tick = Math.min(Math.max(figureWidth * BRACKET_TICK_RATIO, 12), Math.max(bracketX - labelSpace, 12));
    drawVerticalBracketSquare(braceGroup, exportTopInner, exportBottomInner, bracketX, tick);
    const verticalText = createSvgElement(braceGroup, 'text', {
      x: bracketX + verticalLabelSpace / 2,
      y: (exportTopInner + exportBottomInner) / 2,
      class: 'tb-total',
      'text-anchor': 'middle'
    });
    verticalText.setAttribute('dominant-baseline', 'middle');
    const verticalLabel = sumActive ? (verticalSumLabel || (Number.isFinite(totalValue) ? fmt(totalValue) : '')) : Number.isFinite(totalValue) ? fmt(totalValue) : '';
    verticalText.textContent = verticalLabel;
  }
  return exportSvg;
}

if (typeof module !== 'undefined' && module && module.exports) {
  module.exports.resolveFractionPalette = resolveFractionPalette;
  module.exports.__tenkeblokker = {
    resolveFractionFallbackPalette
  };
}
