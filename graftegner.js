/* =========================================================
   KOMBINERT:
   1) Funksjoner (m/ domene-brackets + glidere)
   2) Linje-fra-punkter (m/ fasit, brøkformat ved snap)
   Autozoom-policy:
     - Avgrenset (domene): vis hele grafen + akser.
     - Uavgrenset: bruk [-5,5] så lenge sentrale punkter (røtter,
       ekstremalpunkter, y-skjæring, horisontal asymptote) ligger inne;
       ellers utvid minimalt. Inkluder asymptoter i utsnittet.
   1:1-grid når majorX===majorY (eller lockAspect=true). Robust SVG-eksport.
   ========================================================= */

/* ======================= URL-baserte innstillinger ======================= */
if (typeof Math.log10 !== 'function') {
  Math.log10 = x => Math.log(x) / Math.LN10;
}

const params = new URLSearchParams(location.search);
const GLOBAL_SCOPE = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
let JXG_INSTANCE = GLOBAL_SCOPE && typeof GLOBAL_SCOPE.JXG === 'object' ? GLOBAL_SCOPE.JXG : null;
let jxgConfigured = false;
const jxgReadyQueue = [];
let jxgCheckScheduled = false;
let refreshFunctionColorDefaults = () => {};
const storageSchemaModule = (() => {
  try {
    if (typeof require === 'function') {
      return require('./graftegner/storage-schema.js');
    }
  } catch (_) {}
  return null;
})();
const {
  STORAGE_SCHEMA_V2 = {
    version: 2,
    defaults: {
      options: {
        grid: true,
        axisNumbers: true,
        lockAspect: true,
        axisLabels: { x: 'x', y: 'y' }
      }
    }
  },
  migrateToStorageV2,
  normalizeViewArray,
  normalizeDiffOptions
} = storageSchemaModule || {};
function getJXG() {
  if (JXG_INSTANCE && typeof JXG_INSTANCE === 'object') {
    return JXG_INSTANCE;
  }
  if (GLOBAL_SCOPE && typeof GLOBAL_SCOPE.JXG === 'object') {
    JXG_INSTANCE = GLOBAL_SCOPE.JXG;
    return JXG_INSTANCE;
  }
  return null;
}
function configureJXGOptions(jxg) {
  if (!jxg || jxgConfigured) return;
  if (jxg.Options && typeof jxg.Options === 'object') {
    try {
      jxg.Options.showCopyright = false;
      jxg.Options.showNavigation = false;
      if (jxg.Options.text) {
        jxg.Options.text.display = 'html';
      }
    } catch (_) {}
  }
  jxgConfigured = true;
}
if (JXG_INSTANCE) {
  configureJXGOptions(JXG_INSTANCE);
}
function flushJXGReadyQueue(jxg) {
  if (!jxg) return;
  configureJXGOptions(jxg);
  while (jxgReadyQueue.length) {
    const cb = jxgReadyQueue.shift();
    try {
      cb(jxg);
    } catch (_) {}
  }
}
function scheduleJXGCheck() {
  if (jxgCheckScheduled || !GLOBAL_SCOPE) return;
  jxgCheckScheduled = true;
  const poll = () => {
    jxgCheckScheduled = false;
    const jxg = getJXG();
    if (jxg) {
      flushJXGReadyQueue(jxg);
      return;
    }
    GLOBAL_SCOPE.setTimeout(poll, 16);
    jxgCheckScheduled = true;
  };
  poll();
}
function whenJXGReady(callback) {
  if (typeof callback !== 'function') return;
  const jxg = getJXG();
  if (jxg) {
    callback(jxg);
    return;
  }
  jxgReadyQueue.push(callback);
  scheduleJXGCheck();
}
const SETTINGS_STORAGE_KEY = 'mathVisuals:settings';
const GRAFTEGNER_GROUP_ID = 'graftegner';
const GRAFTEGNER_FALLBACK_PALETTE = ['#2563eb', '#f97316', '#0ea5e9', '#10b981', '#ef4444', '#f59e0b'];
const DEFAULT_LINE_THICKNESS = 3;
const AUTO_SPAN_SAFETY_MULTIPLIER = 200;
const AUTO_SPAN_RECENTER_FACTOR = 1.25;
const DEFAULT_FUNCTION_COLORS = {
  fallback: GRAFTEGNER_FALLBACK_PALETTE.slice(),
  palette: GRAFTEGNER_FALLBACK_PALETTE.slice(),
  simple: GRAFTEGNER_FALLBACK_PALETTE.slice(0, 2),
  trig: GRAFTEGNER_FALLBACK_PALETTE.slice(2, 4)
};
const DEFAULT_POINT_COLORS = {
  fallbackMarkerStroke: '#111827',
  fallbackMarkerFill: '#111827',
  fallbackDomain: '#6b7280',
  fallbackGuide: '#64748b',
  line: GRAFTEGNER_FALLBACK_PALETTE[0],
  markerStroke: GRAFTEGNER_FALLBACK_PALETTE[0],
  markerFill: GRAFTEGNER_FALLBACK_PALETTE[0],
  domainMarker: '#6b7280',
  guideStroke: '#64748b'
};
const DEFAULT_FUNCTION_EXPRESSION = 'f(x)=x^2-2';
const DEFAULT_SCREEN_BOUNDS = [-5, 5, -5, 5];

function getSettingsApi() {
  if (typeof window === 'undefined') return null;
  const api = window.MathVisualsSettings;
  return api && typeof api === 'object' ? api : null;
}
function cycleColors(source, count) {
  const base = Array.isArray(source) ? source.filter(color => typeof color === 'string' && color) : [];
  if (!base.length) return [];
  if (!Number.isFinite(count) || count <= 0) {
    return base.slice();
  }
  const target = Math.trunc(count);
  const result = [];
  for (let i = 0; i < target; i += 1) {
    result.push(base[i % base.length]);
  }
  return result;
}
function readStoredSettings() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (typeof raw !== 'string' || !raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}
function resolveSettingsSnapshot() {
  const api = getSettingsApi();
  if (api && typeof api.getSettings === 'function') {
    try {
      const snapshot = api.getSettings();
      if (snapshot && typeof snapshot === 'object') {
        return snapshot;
      }
    } catch (_) {}
  }
  return readStoredSettings();
}
function getBaseCurveColors(count) {
  const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
  const base = Array.isArray(DEFAULT_FUNCTION_COLORS.palette) && DEFAULT_FUNCTION_COLORS.palette.length
    ? DEFAULT_FUNCTION_COLORS.palette
    : DEFAULT_FUNCTION_COLORS.fallback;
  if (!targetCount) {
    return base.slice();
  }
  const fallback = DEFAULT_FUNCTION_COLORS.fallback.length ? DEFAULT_FUNCTION_COLORS.fallback : GRAFTEGNER_FALLBACK_PALETTE;
  const result = [];
  for (let i = 0; i < targetCount; i += 1) {
    const color = base[i % base.length] || fallback[i % fallback.length] || fallback[0];
    result.push(color);
  }
  return result;
}
function getDefaultCurveColor(index) {
  const palette = getBaseCurveColors(index + 1);
  if (!palette.length) {
    const fallback = DEFAULT_FUNCTION_COLORS.fallback.length ? DEFAULT_FUNCTION_COLORS.fallback : GRAFTEGNER_FALLBACK_PALETTE;
    return fallback[index % fallback.length];
  }
  return palette[index % palette.length];
}
const DEFAULT_GRAFTEGNER_SIMPLE = {
  axes: {
    xMin: -5,
    xMax: 5,
    yMin: -4,
    yMax: 6
  },
  expressions: [
    {
      id: 'expr-1',
      latex: 'y=x^2-1',
      color: DEFAULT_FUNCTION_COLORS.simple[0] || DEFAULT_FUNCTION_COLORS.fallback[0],
      visible: true
    },
    {
      id: 'expr-2',
      latex: 'y=2x+3',
      color: DEFAULT_FUNCTION_COLORS.simple[1] || DEFAULT_FUNCTION_COLORS.fallback[1] || DEFAULT_FUNCTION_COLORS.simple[0],
      visible: true
    }
  ],
  altText: '',
  altTextSource: 'auto'
};
const DEFAULT_GRAFTEGNER_TRIG_SIMPLE = {
  axes: {
    xMin: -7,
    xMax: 7,
    yMin: -2,
    yMax: 2
  },
  expressions: [
    {
      id: 'expr-1',
      latex: 'y=\\sin(x)',
      color: DEFAULT_FUNCTION_COLORS.trig[0] || DEFAULT_FUNCTION_COLORS.fallback[0],
      visible: true
    },
    {
      id: 'expr-2',
      latex: 'y=\\cos(x)',
      color: DEFAULT_FUNCTION_COLORS.trig[1] || DEFAULT_FUNCTION_COLORS.fallback[1] || DEFAULT_FUNCTION_COLORS.trig[0],
      visible: true
    }
  ],
  altText: '',
  altTextSource: 'auto'
};

const AXIS_ARROW_PIXEL_THICKNESS = 26;
const AXIS_ARROW_ASPECT_RATIO = 17 / 30;
const AXIS_LABEL_OFFSET_PX = 10;
const AXIS_LABEL_MARGIN_FRACTION = 0.005;
const AXIS_LABEL_MARGINS = { x: AXIS_LABEL_MARGIN_FRACTION, y: AXIS_LABEL_MARGIN_FRACTION };

const X_AXIS_ARROW_SVG_TEMPLATE =
  '<svg width="17" height="30" viewBox="0 0 17 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2 L15 15 L2 28" stroke="{{COLOR}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const Y_AXIS_ARROW_SVG_TEMPLATE =
  '<svg width="30" height="17" viewBox="0 0 30 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 15 L15 2 L28 15" stroke="{{COLOR}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function axisArrowSvgData(axis, color) {
  const template = axis === 'y' ? Y_AXIS_ARROW_SVG_TEMPLATE : X_AXIS_ARROW_SVG_TEMPLATE;
  const normalized = typeof color === 'string' ? color.trim() : '';
  const tint = normalized ? normalized : '#000000';
  return `data:image/svg+xml;utf8,${encodeURIComponent(template.replace(/{{COLOR}}/g, tint))}`;
}

function tagAxisArrowNode(image, axisKey) {
  if (!image) return;
  const node = image.rendNodeImage || image.rendNode || null;
  if (!node || typeof node.setAttribute !== 'function') return;
  const key = axisKey === 'y' ? 'y' : 'x';
  node.setAttribute('data-axis-arrow', key);
  node.setAttribute('preserveAspectRatio', 'none');
}

function updateAxisArrowImage(image, dataUrl, width, height) {
  if (!image) return;
  if (typeof dataUrl === 'string' && dataUrl) {
    image.url = dataUrl;
  }
  const widthValue = Number.isFinite(width) ? width : null;
  const heightValue = Number.isFinite(height) ? height : null;
  if (Array.isArray(image.size)) {
    if (widthValue != null) image.size[0] = widthValue;
    if (heightValue != null) image.size[1] = heightValue;
  }
  if (Array.isArray(image.usrSize)) {
    if (widthValue != null) image.usrSize[0] = widthValue;
    if (heightValue != null) image.usrSize[1] = heightValue;
  }
  const node = image.rendNodeImage || image.rendNode || null;
  if (node && typeof node.setAttribute === 'function') {
    if (typeof dataUrl === 'string' && dataUrl) {
      try {
        node.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
      } catch (_) {}
      try {
        node.setAttribute('href', dataUrl);
        node.setAttribute('xlink:href', dataUrl);
      } catch (_) {}
    }
    if (widthValue != null) {
      try {
        node.setAttribute('width', widthValue);
      } catch (_) {}
    }
    if (heightValue != null) {
      try {
        node.setAttribute('height', heightValue);
      } catch (_) {}
    }
  }
  if (typeof image.update === 'function') {
    image.update();
  }
}

const DEFAULT_AXIS_COLOR = '#000000';

const POINT_MARKER_SIZE = 8;
const POINT_MARKER_DARKEN_FACTOR = 0.35;

/* =================== THEME & STYLE HANDLING =================== */

function getThemeApi() {
  return (typeof window !== 'undefined' && window.MathVisualsTheme) || null;
}
function getPaletteApi() {
  return (typeof window !== 'undefined' && window.MathVisualsPalette) || null;
}
function getPaletteConfig() {
  return (typeof window !== 'undefined' && window.MathVisualsPaletteConfig) || null;
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

const DEFAULT_GRAFTEGNER_COLOR_ROLES = [
  { fillIndex: 0, lineIndex: 1 },
  { fillIndex: 2, lineIndex: 3 },
  { fillIndex: 4, lineIndex: 5 },
  { fillIndex: 6, lineIndex: 7 },
  { fillIndex: 8, lineIndex: 9 },
  { fillIndex: 10, lineIndex: 11 }
];
const colorPickerHelper = getColorPickerHelper();
const colorPickerModule = getColorPickerModule();
const functionColorPickerInstances = new WeakMap();

function getThemeColor(token, fallback) {
  const theme = getThemeApi();
  if (theme && typeof theme.getColor === 'function') {
    try {
      return theme.getColor(token, fallback);
    } catch (_) {}
  }
  return fallback;
}

function normalizeColorValue(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(trimmed);
  if (!match) return '';
  let hex = match[1].toLowerCase();
  if (hex.length === 3) {
    hex = hex.split('').map(ch => ch + ch).join('');
  }
  return `#${hex}`;
}

function darkenColorValue(color, amount = POINT_MARKER_DARKEN_FACTOR) {
  const normalized = normalizeColorValue(color);
  if (!normalized) return '';
  const factor = Number.isFinite(amount) ? Math.min(1, Math.max(0, amount)) : POINT_MARKER_DARKEN_FACTOR;
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const apply = channel => Math.max(0, Math.round(channel * (1 - factor)));
  const toHex = channel => channel.toString(16).padStart(2, '0');
  return `#${toHex(apply(r))}${toHex(apply(g))}${toHex(apply(b))}`;
}

function pointColorFromLineColor(lineColor) {
  const normalized = normalizeColorValue(lineColor);
  if (!normalized) return '';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  if (yiq < 80) {
    return normalized;
  }
  return darkenColorValue(normalized) || normalized;
}

function getReadableTextColor(color) {
  const normalized = normalizeColorValue(color) || '#111827';
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 180 ? '#111827' : '#f9fafb';
}

function refreshGraftegnerTheme(options = {}) {
  const paletteApi = getPaletteApi();
  const theme = getThemeApi();
  const requestedCount = Number.isFinite(options.count) && options.count > 0 ? Math.trunc(options.count) : null;
  const count = requestedCount || Math.max(
    DEFAULT_GRAFTEGNER_SIMPLE.expressions.length,
    DEFAULT_GRAFTEGNER_TRIG_SIMPLE.expressions.length,
    6
  );

  const request = { count };
  let groupPalette = [];

  if (paletteApi && typeof paletteApi.getGroupPalette === 'function') {
    try {
      const res = paletteApi.getGroupPalette(GRAFTEGNER_GROUP_ID, request);
      groupPalette = res && Array.isArray(res.colors) ? res.colors : (Array.isArray(res) ? res : []);
    } catch (_) {}
  }

  if ((!groupPalette || !groupPalette.length) && theme && typeof theme.getGroupPalette === 'function') {
    try {
      const res = theme.getGroupPalette(GRAFTEGNER_GROUP_ID, request);
      groupPalette = res && Array.isArray(res.colors) ? res.colors : (Array.isArray(res) ? res : []);
    } catch (_) {}
  }

  const finalPalette = ensureColorCount(groupPalette, GRAFTEGNER_FALLBACK_PALETTE, count);

  DEFAULT_FUNCTION_COLORS.palette = finalPalette.slice();
  DEFAULT_FUNCTION_COLORS.simple = finalPalette.slice(0, DEFAULT_GRAFTEGNER_SIMPLE.expressions.length);
  DEFAULT_FUNCTION_COLORS.trig = finalPalette.slice(0, DEFAULT_GRAFTEGNER_TRIG_SIMPLE.expressions.length);

  const primary = finalPalette[0];
  const secondary = finalPalette[1] || primary;

  DEFAULT_POINT_COLORS.line = secondary || primary || DEFAULT_POINT_COLORS.fallbackMarkerStroke;
  DEFAULT_POINT_COLORS.markerStroke = pointColorFromLineColor(DEFAULT_POINT_COLORS.line) || DEFAULT_POINT_COLORS.fallbackMarkerStroke;
  DEFAULT_POINT_COLORS.markerFill = DEFAULT_POINT_COLORS.markerStroke || DEFAULT_POINT_COLORS.fallbackMarkerFill;
  DEFAULT_POINT_COLORS.domainMarker = secondary;

  const axisColor = DEFAULT_AXIS_COLOR;
  if (typeof ADV !== 'undefined' && ADV && ADV.axis && ADV.axis.style) {
    ADV.axis.style.stroke = axisColor;
  }
  DEFAULT_POINT_COLORS.guideStroke = getThemeColor('dots.guide', '#64748b');

  if (typeof updateCurveColorsFromTheme === 'function') {
    updateCurveColorsFromTheme();
  }
  if (typeof updateAxisThemeStyling === 'function') {
    updateAxisThemeStyling();
  }
  if (typeof refreshFunctionColorDefaults === 'function') {
    refreshFunctionColorDefaults();
  }
  const shouldRequestRebuild = typeof requestRebuild === 'function' && !appState.isRebuilding;
  if (shouldRequestRebuild) {
    requestRebuild();
  }
}

const THEME_REFRESH_MIN_INTERVAL_MS = 100;
let lastThemeRefreshTime = 0;

function scheduleThemeRefresh() {
  const now = Date.now();
  if (now - lastThemeRefreshTime < THEME_REFRESH_MIN_INTERVAL_MS) return;
  lastThemeRefreshTime = now;

  if (scheduleThemeRefresh.pending) return;
  const execute = () => {
    scheduleThemeRefresh.pending = false;
    refreshGraftegnerTheme();
  };
  scheduleThemeRefresh.pending = true;

  if (typeof document !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Promise.resolve().then(execute), { once: true });
  } else {
    Promise.resolve().then(execute);
  }
}

function ensureColorCount(base, fallback, count) {
  const hasBase = Array.isArray(base) && base.length;
  const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
  const fallbackPalette = Array.isArray(fallback) && fallback.length ? fallback : getBaseCurveColors(targetCount);
  const effectiveCount = targetCount || (hasBase ? base.length : fallbackPalette.length);
  const result = [];
  for (let i = 0; i < effectiveCount; i += 1) {
    const candidate = hasBase && typeof base[i] === 'string' && base[i] ? base[i] : null;
    const fallbackColor = fallbackPalette[i % fallbackPalette.length] || getDefaultCurveColor(i);
    result.push(candidate || fallbackColor);
  }
  return result;
}

function applyThemeToDocument() {
  const theme = getThemeApi();
  if (theme && typeof theme.applyToDocument === 'function') {
    theme.applyToDocument(document);
  }
}

function getPaletteHelper() {
  const scope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (scope && scope.MathVisualsPalette && typeof scope.MathVisualsPalette.getGroupPalette === 'function') {
    return scope.MathVisualsPalette;
  }
  return null;
}

function resolveAxisStrokeColor() {
  return DEFAULT_AXIS_COLOR;
}

function sanitizePaletteList(values) {
  if (!Array.isArray(values)) return [];
  const sanitized = [];
  values.forEach(value => {
    const normalized = normalizeColorValue(value);
    if (normalized) {
      sanitized.push(normalized);
    }
  });
  return sanitized;
}

let graftegnerFillSlotPositions = null;
function resolveGraftegnerFillSlotPositions() {
  if (Array.isArray(graftegnerFillSlotPositions)) {
    return graftegnerFillSlotPositions.slice();
  }
  const config = getPaletteConfig();
  if (config && Array.isArray(config.COLOR_SLOT_GROUPS)) {
    const group = config.COLOR_SLOT_GROUPS.find(entry => {
      const id = entry && typeof entry.groupId === 'string' ? entry.groupId.trim().toLowerCase() : '';
      return id === GRAFTEGNER_GROUP_ID;
    });
    if (group && colorPickerHelper && typeof colorPickerHelper.resolveRoleSlotPairs === 'function') {
      const pairs = colorPickerHelper.resolveRoleSlotPairs(config, GRAFTEGNER_GROUP_ID, DEFAULT_GRAFTEGNER_COLOR_ROLES);
      if (pairs.length) {
        graftegnerFillSlotPositions = pairs.map(pair => pair.fillSlotIndex);
        return graftegnerFillSlotPositions.slice();
      }
    }
    if (group && Array.isArray(group.slots)) {
      const positions = group.slots
        .map((slot, index) => {
          const label = slot && typeof slot.label === 'string' ? slot.label.trim().toLowerCase() : '';
          return label.includes('fyll') ? index : null;
        })
        .filter(value => Number.isFinite(value));
      if (positions.length) {
        graftegnerFillSlotPositions = positions;
        return positions.slice();
      }
    }
  }
  graftegnerFillSlotPositions = [];
  return [];
}

function selectGraftegnerFillColors(palette) {
  const sanitized = sanitizePaletteList(palette);
  if (!sanitized.length) return [];
  const positions = resolveGraftegnerFillSlotPositions();
  let fillColors = [];
  if (positions.length) {
    positions.forEach(position => {
      const color = sanitized[position];
      if (color) {
        fillColors.push(color);
      }
    });
  }
  if (!fillColors.length) {
    fillColors = sanitized.filter((_, index) => index % 2 === 0);
  }
  return fillColors;
}

function tryResolveGroupPalette(resolver) {
  try {
    const result = resolver();
    return Array.isArray(result) && result.length ? result : null;
  } catch (_) {
    return null;
  }
}

function fetchGraftegnerAxisColor(provider) {
  if (!provider || typeof provider.getGroupPalette !== 'function') return '';
  const options = { count: 2 };
  let palette = null;
  try {
    palette = provider.getGroupPalette(GRAFTEGNER_GROUP_ID, options);
  } catch (_) {}
  if ((!Array.isArray(palette) || palette.length < 2) && provider.getGroupPalette.length >= 3) {
    try {
      palette = provider.getGroupPalette(GRAFTEGNER_GROUP_ID, 2);
    } catch (_) {}
  }
  if (!Array.isArray(palette) || palette.length < 2) return '';
  const axisColor = normalizeColorValue(palette[1]);
  return axisColor || '';
}

function fetchGraftegnerPalette(count) {
  const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
  const theme = getThemeApi();
  const settings = getSettingsApi();
  if (settings && typeof settings.getGroupPalette === 'function') {
    let palette = tryResolveGroupPalette(() => settings.getGroupPalette(GRAFTEGNER_GROUP_ID, { count: targetCount }));
    if (
      (!Array.isArray(palette) || (targetCount && palette.length < targetCount)) &&
      settings.getGroupPalette.length >= 3
    ) {
      palette = tryResolveGroupPalette(() => settings.getGroupPalette(GRAFTEGNER_GROUP_ID, targetCount || undefined));
    }
    if (palette) return palette;
  }
  if (theme && typeof theme.getGroupPalette === 'function') {
    let palette = tryResolveGroupPalette(() => theme.getGroupPalette(GRAFTEGNER_GROUP_ID, { count: targetCount }));
    if (
      (!Array.isArray(palette) || (targetCount && palette.length < targetCount)) &&
      theme.getGroupPalette.length >= 3
    ) {
      palette = tryResolveGroupPalette(() => theme.getGroupPalette(GRAFTEGNER_GROUP_ID, targetCount || undefined));
    }
    if (palette) return palette;
  }
  const helper = getPaletteHelper();
  if (helper && typeof helper.getGroupPalette === 'function') {
    const palette = tryResolveGroupPalette(() => helper.getGroupPalette(GRAFTEGNER_GROUP_ID, { count: targetCount }));
    if (palette) return palette;
  }
  if (theme && typeof theme.getPalette === 'function') {
    const palette = tryResolveGroupPalette(() =>
      theme.getPalette('figures', targetCount || DEFAULT_FUNCTION_COLORS.fallback.length, {
        fallbackKinds: ['fractions']
      })
    );
    if (palette) return palette;
  }
  const stored = resolveSettingsSnapshot();
  if (stored && typeof stored === 'object') {
    if (Array.isArray(stored.defaultColors)) {
      const sanitized = sanitizePaletteList(stored.defaultColors);
      if (sanitized.length) {
        return sanitized;
      }
    }
  }
  return DEFAULT_FUNCTION_COLORS.fallback.slice();
}

function applyGraftegnerPalette(palette, options = {}) {
  const sanitized = sanitizePaletteList(palette);
  const source = sanitized.length ? sanitized : DEFAULT_FUNCTION_COLORS.fallback;
  const requestedCount = Number.isFinite(options.count) && options.count > 0
    ? Math.trunc(options.count)
    : Math.max(source.length, DEFAULT_FUNCTION_COLORS.fallback.length);
  const resolved = ensureColorCount(source, DEFAULT_FUNCTION_COLORS.fallback, requestedCount);
  DEFAULT_FUNCTION_COLORS.palette = resolved.slice();
  const simpleCount = DEFAULT_GRAFTEGNER_SIMPLE.expressions.length;
  const trigCount = DEFAULT_GRAFTEGNER_TRIG_SIMPLE.expressions.length;
  const simplePalette = ensureColorCount(resolved, DEFAULT_FUNCTION_COLORS.fallback, simpleCount);
  const trigPalette = ensureColorCount(resolved, DEFAULT_FUNCTION_COLORS.fallback, trigCount);
  DEFAULT_FUNCTION_COLORS.simple = simplePalette.slice();
  DEFAULT_FUNCTION_COLORS.trig = trigPalette.slice();
  DEFAULT_GRAFTEGNER_SIMPLE.expressions.forEach((expr, idx) => {
    if (!expr || typeof expr !== 'object') return;
    expr.color = simplePalette[idx] || DEFAULT_FUNCTION_COLORS.fallback[idx % DEFAULT_FUNCTION_COLORS.fallback.length];
  });
  DEFAULT_GRAFTEGNER_TRIG_SIMPLE.expressions.forEach((expr, idx) => {
    if (!expr || typeof expr !== 'object') return;
    expr.color = trigPalette[idx] || DEFAULT_FUNCTION_COLORS.fallback[idx % DEFAULT_FUNCTION_COLORS.fallback.length];
  });
  const primary = resolved[0] || DEFAULT_FUNCTION_COLORS.fallback[0];
  const secondary = resolved[1] || resolved[0] || DEFAULT_POINT_COLORS.fallbackDomain;
  const tertiary = resolved[2] || secondary || DEFAULT_POINT_COLORS.fallbackGuide;
  DEFAULT_POINT_COLORS.line = secondary || primary || DEFAULT_POINT_COLORS.fallbackMarkerStroke;
  DEFAULT_POINT_COLORS.markerStroke = DEFAULT_POINT_COLORS.line || DEFAULT_POINT_COLORS.fallbackMarkerStroke;
  DEFAULT_POINT_COLORS.markerFill = DEFAULT_POINT_COLORS.markerStroke || DEFAULT_POINT_COLORS.fallbackMarkerFill;
  DEFAULT_POINT_COLORS.domainMarker = secondary || DEFAULT_POINT_COLORS.fallbackDomain;
  DEFAULT_POINT_COLORS.guideStroke = tertiary || DEFAULT_POINT_COLORS.fallbackGuide;
  try {
    if (ADV && typeof ADV === 'object' && ADV.domainMarkers && typeof ADV.domainMarkers === 'object') {
      ADV.domainMarkers.color = DEFAULT_POINT_COLORS.domainMarker || DEFAULT_POINT_COLORS.fallbackDomain;
    }
  } catch (_) {}
}

function ensurePaletteCapacity(count) {
  if (!Number.isFinite(count) || count <= 0) return;
  if (Array.isArray(DEFAULT_FUNCTION_COLORS.palette) && DEFAULT_FUNCTION_COLORS.palette.length >= count) {
    return;
  }
  applyGraftegnerDefaultsFromTheme({ count });
}

function applyGraftegnerDefaultsFromTheme(options = {}) {
  const desiredCount = Number.isFinite(options.count) && options.count > 0
    ? Math.trunc(options.count)
    : DEFAULT_FUNCTION_COLORS.fallback.length;
  refreshGraftegnerTheme({ count: desiredCount });
}
function resolveCurvePalette(count = undefined) {
  const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
  if (targetCount) {
    ensurePaletteCapacity(targetCount);
  }
  const basePalette = getBaseCurveColors(targetCount || DEFAULT_FUNCTION_COLORS.palette.length);
  return ensureColorCount(basePalette, DEFAULT_FUNCTION_COLORS.fallback, targetCount || basePalette.length);
}
applyThemeToDocument();
function paramStr(id, def = '') {
  const v = params.get(id);
  return v == null ? def : v;
}
function paramBool(id, fallback = false) {
  if (!params.has(id)) return !!fallback;
  const raw = params.get(id);
  if (raw == null) return !!fallback;
  const normalized = String(raw).trim().toLowerCase();
  if (!normalized) return true;
  if (['1', 'true', 'yes', 'on', 'y', 't'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'n', 'f'].includes(normalized)) return false;
  return !!fallback;
}
function paramNumber(id, def = null) {
  const v = params.get(id);
  if (v == null) return def;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : def;
}
const DEFAULT_POINT_MARKER = '.';
const DEFAULT_DOMAIN_VALUE = '-∞, ∞';
const DEFAULT_UNBOUNDED_DOMAIN_SPAN = 10;
const MULTI_FUNCTION_UNBOUNDED_DOMAIN_SPAN = 5;
function sanitizePointMarkerValue(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}
function parsePointLockList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(';')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => !/^(?:0|false|nei|off|no)$/i.test(part));
}
function formatPointLockList(values) {
  if (!Array.isArray(values) || values.length === 0) return '';
  return values.map(val => (val ? 'true' : 'false')).join('; ');
}
function parsePointMarkerList(value) {
  if (typeof value !== 'string') return [];
  return value
    .split(';')
    .map(part => sanitizePointMarkerValue(part))
    .map(part => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
function formatPointMarkerList(markers) {
  if (!Array.isArray(markers) || !markers.length) return '';
  return markers.map(marker => sanitizePointMarkerValue(marker)).filter(Boolean).join('; ');
}
function normalizePointMarkerValue(value) {
  const markers = parsePointMarkerList(value);
  if (!markers.length) return '';
  return formatPointMarkerList(markers);
}
function markerValueForIndex(markers, index) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return '';
  }
  if (index < markers.length) {
    return markers[index];
  }
  return markers[markers.length - 1];
}
function resolvePointMarkersForCount(markerValue, count, options = {}) {
  const allowEmpty = !!options.allowEmpty;
  const fallback = options.fallback || DEFAULT_POINT_MARKER;
  const markers = parsePointMarkerList(markerValue);
  const resolved = [];
  for (let i = 0; i < Math.max(0, count); i += 1) {
    const marker = markers.length ? markerValueForIndex(markers, i) : markerValue;
    if (allowEmpty && sanitizePointMarkerValue(marker) === '') {
      resolved.push('');
    } else {
      resolved.push(marker || fallback);
    }
  }
  return resolved;
}
function isDefaultPointMarker(value) {
  const markers = parsePointMarkerList(value);
  if (!markers.length) return true;
  return markers.every(marker => sanitizePointMarkerValue(marker) === DEFAULT_POINT_MARKER);
}
function resolvePointMarkerStyle(rawMarker) {
  const sanitized = sanitizePointMarkerValue(rawMarker);
  const marker = sanitized || DEFAULT_POINT_MARKER;
  if (marker === '0') {
    return { type: 'circle', size: POINT_MARKER_SIZE * 1.5, fillOpacity: 0, strokeOpacity: 1 };
  }
  if (marker === 'o' || marker === 'O') {
    return { type: 'circle', size: POINT_MARKER_SIZE * 0.5, fillOpacity: 0, strokeOpacity: 1 };
  }
  if (marker === '.') {
    return { type: 'circle', size: POINT_MARKER_SIZE * 0.4, fillOpacity: 1, strokeOpacity: 0 };
  }
  return { type: 'text', text: marker };
}
const FONT_LIMITS = {
  min: 6,
  max: 72
};
const FONT_DEFAULT = 20;
const FONT_SIZE_OPTIONS = {
  large: 24,
  medium: FONT_DEFAULT,
  small: 16
};
const LEGACY_FONT_SIZE_ALIASES = { normal: 'medium' };
const FONT_PARAM_KEYS = ['fontSize', 'font', 'axisFont', 'tickFont', 'curveFont'];
const STORAGE_OPTIONS_DEFAULTS = STORAGE_SCHEMA_V2 && STORAGE_SCHEMA_V2.defaults && STORAGE_SCHEMA_V2.defaults.options
  ? STORAGE_SCHEMA_V2.defaults.options
  : { grid: true, axisNumbers: true, lockAspect: true, axisLabels: { x: 'x', y: 'y' } };
const SHOW_CURVE_NAMES = params.has('showNames') ? paramBool('showNames') : true;
const SHOW_CURVE_EXPRESSIONS = params.has('showExpr') ? paramBool('showExpr') : false;
const SHOW_DOMAIN_MARKERS = params.has('brackets') ? paramBool('brackets') : true;
const SHOW_AXIS_NUMBERS = params.has('axisNumbers') ? paramBool('axisNumbers') : !!STORAGE_OPTIONS_DEFAULTS.axisNumbers;
const SHOW_GRID = params.has('grid') ? paramBool('grid') : !!STORAGE_OPTIONS_DEFAULTS.grid;
const STORAGE_SCHEMA_VERSION = STORAGE_SCHEMA_V2.version;
const STORAGE_V2_DEFAULTS = {
  grid: SHOW_GRID,
  axisNumbers: SHOW_AXIS_NUMBERS,
  lockAspect: params.has('lock') ? paramBool('lock') : (STORAGE_OPTIONS_DEFAULTS.lockAspect !== false),
  axisLabels: {
    x: paramStr('xName', (STORAGE_OPTIONS_DEFAULTS.axisLabels && STORAGE_OPTIONS_DEFAULTS.axisLabels.x) || 'x'),
    y: paramStr('yName', (STORAGE_OPTIONS_DEFAULTS.axisLabels && STORAGE_OPTIONS_DEFAULTS.axisLabels.y) || 'y')
  }
};
const normalizeStorageView = typeof normalizeViewArray === 'function'
  ? normalizeViewArray
  : view => {
    if (!Array.isArray(view) || view.length < 4) return null;
    const normalized = view.slice(0, 4).map(value => {
      const num = typeof value === 'number' ? value : Number.parseFloat(value);
      return Number.isFinite(num) ? num : null;
    });
    return normalized.some(entry => entry == null) ? null : normalized;
  };
const migrateStorageState = raw => {
  if (raw && typeof raw === 'object' && raw.v === STORAGE_SCHEMA_VERSION) {
    const normalizedView = normalizeStorageView(raw.view);
    if (normalizedView) {
      const options = raw.options && typeof raw.options === 'object'
        ? { ...raw.options }
        : null;
      return {
        ...raw,
        view: normalizedView,
        options
      };
    }
  }
  if (typeof migrateToStorageV2 !== 'function') return null;
  const migrated = migrateToStorageV2(raw);
  return migrated && migrated.v === STORAGE_SCHEMA_VERSION ? migrated : null;
};
const STORAGE_STATE_V2 = migrateStorageState(typeof window !== 'undefined' ? window.STATE : null)
  || migrateStorageState(typeof window !== 'undefined' ? window.ADV : null);
function buildCleanSaveOptionsSnapshot(adv, defaults = CLEAN_SAVE_DEFAULTS) {
  const diff = {};
  const resolvedDefaults = defaults || CLEAN_SAVE_DEFAULTS;

  const grid = !!(adv && adv.axis && adv.axis.grid && adv.axis.grid.show);
  const defaultGrid = !!(resolvedDefaults && resolvedDefaults.grid);
  if (grid !== defaultGrid) {
    diff.grid = grid;
  }

  const axisNumbers = !!(adv && adv.axis && adv.axis.ticks && adv.axis.ticks.showNumbers);
  const defaultAxisNumbers = !!(resolvedDefaults && resolvedDefaults.axisNumbers);
  if (axisNumbers !== defaultAxisNumbers) {
    diff.axisNumbers = axisNumbers;
  }

  const lockAspect = adv && adv.lockAspect === false ? false : true;
  const defaultLock = resolvedDefaults && resolvedDefaults.lockAspect === false ? false : true;
  if (lockAspect !== defaultLock) {
    diff.lockAspect = lockAspect;
  }

  const firstQuadrant = !!(adv && adv.firstQuadrant);
  const defaultFirstQuadrant = !!(resolvedDefaults && resolvedDefaults.firstQuadrant);
  if (firstQuadrant !== defaultFirstQuadrant) {
    diff.firstQuadrant = firstQuadrant;
  }

  const labelDefaults = resolvedDefaults && resolvedDefaults.axisLabels && typeof resolvedDefaults.axisLabels === 'object'
    ? resolvedDefaults.axisLabels
    : STORAGE_V2_DEFAULTS.axisLabels;
  const labels = adv && adv.axis && adv.axis.labels ? adv.axis.labels : {};
  const labelDiff = {};
  if (typeof labels.x === 'string' && labels.x.trim() && labels.x !== labelDefaults.x) {
    labelDiff.x = labels.x;
  }
  if (typeof labels.y === 'string' && labels.y.trim() && labels.y !== labelDefaults.y) {
    labelDiff.y = labels.y;
  }
  if (Object.keys(labelDiff).length) {
    diff.axisLabels = labelDiff;
  }

  return diff;
}
function createCleanSaveState(meta, defaults = CLEAN_SAVE_DEFAULTS) {
  syncCurveLabelStateToExample();
  const code = typeof appState === 'object'
    && appState
    && appState.simple
    && typeof appState.simple.value === 'string'
    ? appState.simple.value
    : '';
  const view = normalizeStorageView(ADV && ADV.screen);
  const options = buildCleanSaveOptionsSnapshot(ADV, defaults);
  const curveLabels = Array.isArray(EXAMPLE_STATE && EXAMPLE_STATE.curveLabels)
    ? EXAMPLE_STATE.curveLabels.map(entry => ({
      manual: !!(entry && entry.manual),
      position: entry && Array.isArray(entry.position) && entry.position.length >= 2
        ? entry.position.slice(0, 2)
        : null
    }))
    : undefined;

  const cleanState = {
    v: STORAGE_SCHEMA_VERSION,
    code,
    view,
    options,
    curveLabels
  };

  if (meta && typeof meta === 'object') {
    cleanState.meta = { ...meta };
  }

  return cleanState;
}
function clampFontSize(val) {
  if (!Number.isFinite(val)) return null;
  if (val < FONT_LIMITS.min) return FONT_LIMITS.min;
  if (val > FONT_LIMITS.max) return FONT_LIMITS.max;
  return val;
}
function sanitizeFontSize(val, fallback) {
  const clamped = clampFontSize(val);
  return clamped == null ? fallback : clamped;
}
function resolveSharedFontSize() {
  for (const key of FONT_PARAM_KEYS) {
    const candidate = clampFontSize(paramNumber(key, null));
    if (candidate != null) return candidate;
    const candidateStr = paramStr(key, null);
    if (candidateStr) {
      const resolved = resolveFontSizeFromKey(candidateStr, null);
      if (resolved != null) return resolved;
    }
  }
  return FONT_DEFAULT;
}
const FONT_SIZE_PRESET_KEYS = ['small', 'medium', 'large'];
function resolveFontSizeFromKey(key, fallback = FONT_DEFAULT) {
  const normalized = typeof key === 'string' ? key.trim().toLowerCase() : '';
  const aliased = LEGACY_FONT_SIZE_ALIASES[normalized] || normalized;
  if (Number.isFinite(Number.parseFloat(normalized))) {
    const numeric = Number.parseFloat(normalized);
    if (Number.isFinite(numeric)) {
      return sanitizeFontSize(numeric, fallback);
    }
  }
  const mapped = FONT_SIZE_OPTIONS[aliased];
  return sanitizeFontSize(mapped, fallback);
}
function getFontSizeKeyFromValue(value) {
  const size = sanitizeFontSize(value, FONT_DEFAULT);
  for (const key of FONT_SIZE_PRESET_KEYS) {
    if (Math.abs(FONT_SIZE_OPTIONS[key] - size) < 1e-9) {
      return key;
    }
  }
  return null;
}
function syncFontSizeSelect(selectEl, fontSize) {
  if (!selectEl) return;
  const presetKey = getFontSizeKeyFromValue(fontSize);
  const customOption = selectEl.querySelector('option[value="custom"]');
  if (presetKey) {
    selectEl.value = presetKey;
    if (customOption) customOption.textContent = 'Tilpasset';
    if (selectEl.dataset) delete selectEl.dataset.customSize;
    return;
  }
  selectEl.value = 'custom';
  if (selectEl.dataset) selectEl.dataset.customSize = String(fontSize);
  if (customOption) customOption.textContent = `Tilpasset (${fontSize}px)`;
}
function readFontSizeFromSelect(selectEl, fallback) {
  if (!selectEl) return fallback;
  const mapped = resolveFontSizeFromKey(selectEl.value, null);
  if (mapped != null) {
    return mapped;
  }
  const custom = selectEl.dataset && typeof selectEl.dataset.customSize === 'string'
    ? Number.parseFloat(selectEl.dataset.customSize.replace(',', '.'))
    : NaN;
  if (Number.isFinite(custom)) {
    return sanitizeFontSize(custom, fallback);
  }
  return fallback;
}
const SHARED_FONT_SIZE = resolveSharedFontSize();
let FORCE_TICKS_REQUESTED = params.has('forceTicks') ? paramBool('forceTicks') : true;
function parseScreen(str) {
  if (!str) return null;
  const cleaned = str.replace(/^[\s\[]+|[\]\s]+$/g, '');
  const parts = cleaned.split(',').map(s => +s.trim());
  return parts.length === 4 && parts.every(Number.isFinite) ? parts : null;
}

function getBoardAspectRatio() {
  if (typeof document === 'undefined') return 1;
  const board = document.getElementById('board');
  if (!board || typeof board.getBoundingClientRect !== 'function') return 1;
  const rect = board.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  if (!(width > 0 && height > 0)) return 1;
  const ratio = width / height;
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

function applyFirstQuadrantPadding(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return screen;
  let [xmin, xmax, ymin, ymax] = screen;
  if (![xmin, xmax, ymin, ymax].every(Number.isFinite)) return screen;
  let width = xmax - xmin;
  let height = ymax - ymin;
  if (!(width > 0)) width = 10;
  if (!(height > 0)) height = 10;
  const padding = 0.5;
  xmin = -padding;
  ymin = -padding;
  xmax = xmin + width;
  ymax = ymin + height;
  return [xmin, xmax, ymin, ymax];
}

function clampScreenToFirstQuadrant(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return screen;
  let [xmin, xmax, ymin, ymax] = screen;
  if (![xmin, xmax, ymin, ymax].every(Number.isFinite)) return screen;

  // Tillat -0.5 for at aksene skal synes
  const HARD_MIN = -0.5;

  const width = xmax - xmin;
  const height = ymax - ymin;

  if (xmin < HARD_MIN) {
    const w = width > 0 ? width : 10;
    xmin = HARD_MIN;
    xmax = xmin + w;
  }

  if (ymin < HARD_MIN) {
    const h = height > 0 ? height : 10;
    ymin = HARD_MIN;
    ymax = ymin + h;
  }

  return [xmin, xmax, ymin, ymax];
}

function clampScreenToWholeGrid(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return screen;
  if (!ADV || !ADV.axis || !ADV.axis.forceIntegers || !ADV.axis.grid || !ADV.axis.grid.show) {
    return screen;
  }
  const [xmin, xmax, ymin, ymax] = screen;
  if (![xmin, xmax, ymin, ymax].every(Number.isFinite)) return screen;
  const sx = Math.abs(+ADV.axis.grid.majorX) > 1e-9 ? Math.abs(+ADV.axis.grid.majorX) : 1;
  const sy = Math.abs(+ADV.axis.grid.majorY) > 1e-9 ? Math.abs(+ADV.axis.grid.majorY) : 1;
  const gridLeft = Math.ceil(xmin / sx - 1e-12) * sx;
  const gridRight = Math.floor(xmax / sx + 1e-12) * sx;
  const gridBottom = Math.ceil(ymin / sy - 1e-12) * sy;
  const gridTop = Math.floor(ymax / sy + 1e-12) * sy;
  if (gridRight - gridLeft < 1e-12 || gridTop - gridBottom < 1e-12) {
    return screen;
  }
  return [gridLeft, gridRight, gridBottom, gridTop];
}
function screensEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-9) {
      return false;
    }
  }
  return true;
}
function buildSimple() {
  const lines = [];
  let i = 1;
  while (true) {
    const key = `fun${i}`;
    const fun = paramStr(key, i === 1 ? DEFAULT_FUNCTION_EXPRESSION : '').trim();
    const dom = paramStr(`dom${i}`, '').trim();
    const colorParam = paramStr(`color${i}`, '').trim();
    const colorValue = normalizeColorValue(colorParam);
    if (i === 1 || params.has(key)) {
      if (fun) {
        const baseLine = dom ? `${fun}, x in ${dom}` : fun;
        const withColor = colorValue ? `${baseLine}, color=${colorValue}` : baseLine;
        lines.push(withColor);
      }
      i++;
    } else {
      break;
    }
  }
  const pts = paramStr('points', '0').trim();
  if (pts) {
    lines.push(`points=${pts}`);
  }
  const startx = paramStr('startx', '').trim();
  if (startx) {
    lines.push(`startx=${startx}`);
  }
  const coords = paramStr('coords', '').trim();
  if (coords) {
    lines.push(`coords=${coords}`);
  }
  const marker = normalizePointMarkerValue(paramStr('marker', ''));
  if (!isDefaultPointMarker(marker)) {
    lines.push(`marker=${marker}`);
  }
  if (params.has('lockpoint')) {
    const lockRaw = paramStr('lockpoint', '').trim();
    if (/^(?:0|false|nei|off|no)$/i.test(lockRaw)) {
      lines.push('lockpoint=false');
    }
  }
  const linepts = paramStr('linepts', '').trim();
  if (linepts) {
    lines.push(`linepts=${linepts}`);
  }
  return lines.join('\n');
}
function cancelScheduledSimpleRebuild() {
  if (appState.simple.pendingRebuild != null) {
    clearTimeout(appState.simple.pendingRebuild);
    appState.simple.pendingRebuild = null;
  }
}
function scheduleSimpleRebuild() {
  if (typeof setTimeout !== 'function') {
    return;
  }
  if (appState.simple.value === appState.simple.lastRendered) {
    cancelScheduledSimpleRebuild();
    return;
  }
  cancelScheduledSimpleRebuild();
  appState.simple.pendingRebuild = setTimeout(() => {
    appState.simple.pendingRebuild = null;
    if (appState.simple.value !== appState.simple.lastRendered) {
      requestRebuild();
    }
  }, 180);
}

function createSimpleFormChangeQueue(task, delay = 360) {
  const safeTask = typeof task === 'function' ? task : null;
  const safeDelay = Number.isFinite(delay) && delay >= 0 ? delay : 360;
  let pending = null;
  const invoke = () => {
    pending = null;
    if (safeTask) {
      safeTask();
    }
  };
  const schedule = () => {
    if (!safeTask) return;
    if (typeof setTimeout !== 'function' || safeDelay === 0) {
      invoke();
      return;
    }
    if (pending != null) {
      clearTimeout(pending);
    }
    pending = setTimeout(invoke, safeDelay);
  };
  schedule.flush = () => {
    if (!safeTask) return;
    if (pending != null) {
      clearTimeout(pending);
      pending = null;
    }
    safeTask();
  };
  return schedule;
}

const ALT_TEXT_DEFAULT_STATE = {
  text: '',
  source: 'auto'
};
const appState = {
  altText: {
    ...ALT_TEXT_DEFAULT_STATE
  },
  altTextManager: null,
  board: null,
  axes: {
    x: null,
    y: null,
    labels: { x: null, y: null },
    arrows: { x: null, y: null },
    customTicks: { x: null, y: null }
  },
  grid: {
    vertical: [],
    horizontal: []
  },
  graphs: [],
  points: {
    A: null,
    B: null,
    moving: []
  },
  simple: {
    value: '',
    parsed: null,
    lastRendered: '',
    pendingRebuild: null
  },
  isRebuilding: false,
  skipSnapshot: false
};
if (typeof window !== 'undefined' && window.GRAF_ALT_TEXT && typeof window.GRAF_ALT_TEXT === 'object') {
  const existing = window.GRAF_ALT_TEXT;
  appState.altText.text = typeof existing.text === 'string' ? existing.text : '';
  appState.altText.source = existing.source === 'manual' ? 'manual' : 'auto';
}
if (typeof window !== 'undefined') {
  window.GRAF_ALT_TEXT = appState.altText;
}

if (typeof STORAGE_STATE_V2 === 'object' && STORAGE_STATE_V2 && typeof STORAGE_STATE_V2.code === 'string') {
  if (typeof window !== 'undefined') {
    window.SIMPLE = STORAGE_STATE_V2.code;
  }
}

appState.simple.value = typeof window !== 'undefined' && typeof window.SIMPLE !== 'undefined' ? window.SIMPLE : buildSimple();
appState.simple.lastRendered = appState.simple.value;
appState.simple.parsed = parseSimple(appState.simple.value);
if (typeof window !== 'undefined') {
  window.SIMPLE = appState.simple.value;
}

/* ====================== AVANSERT KONFIG ===================== */
const INITIAL_POINT_MARKER_RAW = paramStr('marker', DEFAULT_POINT_MARKER);
const INITIAL_POINT_MARKER_NORMALIZED = normalizePointMarkerValue(INITIAL_POINT_MARKER_RAW);
const INITIAL_POINT_MARKER_LIST = parsePointMarkerList(INITIAL_POINT_MARKER_RAW);
const INITIAL_POINT_MARKER_VALUE = !INITIAL_POINT_MARKER_NORMALIZED || isDefaultPointMarker(INITIAL_POINT_MARKER_NORMALIZED)
  ? DEFAULT_POINT_MARKER
  : INITIAL_POINT_MARKER_NORMALIZED;
const PARAM_SCREEN_RAW = paramStr('screen', '');
const PARAM_SCREEN = parseScreen(PARAM_SCREEN_RAW);
const HAS_PARAM_SCREEN = params.has('screen') && Array.isArray(PARAM_SCREEN);
const DEFAULT_SCREEN = [-5, 5, -5, 5];
const INITIAL_SCREEN = HAS_PARAM_SCREEN ? PARAM_SCREEN : DEFAULT_SCREEN;
const INITIAL_SCREEN_SOURCE = 'manual';

const ADV = {
  axis: {
    labels: {
      x: paramStr('xName', 'x'),
      y: paramStr('yName', 'y'),
      fontSize: SHARED_FONT_SIZE
    },
    style: {
      stroke: resolveAxisStrokeColor(),
      width: DEFAULT_LINE_THICKNESS
    },
    ticks: {
      showNumbers: SHOW_AXIS_NUMBERS
    },
    grid: {
      show: SHOW_GRID,
      majorX: 1,
      majorY: 1,
      labelPrecision: 0,
      fontSize: SHARED_FONT_SIZE
    },
    forceIntegers: FORCE_TICKS_REQUESTED
  },
  screen: INITIAL_SCREEN,
  lockAspect: params.has('lock') ? paramBool('lock') : true,
  firstQuadrant: paramBool('q1'),
  interactions: {
    pan: {
      enabled: false,
      needShift: false
    },
    zoom: {
      enabled: false,
      wheel: false,
      needShift: false,
      factorX: 1.2,
      factorY: 1.2
    }
  },
  /* Brukes i punkts-modus og for glidere i funksjons-modus */
  points: {
    start: [[-3, 1], [1, 3]],
    // to punkt i linje-modus
    startX: [1],
    // start-X for glidere (kan overstyres i appState.simple.value)
    showCoordsOnHover: true,
    marker: INITIAL_POINT_MARKER_VALUE,
    markerList: INITIAL_POINT_MARKER_LIST,
    decimals: 2,
    guideArrows: true,
    lockExtraPoints: true,
    // bare i funksjons-modus
    snap: {
      enabled: params.has('snap') ? paramBool('snap') : true,
      mode: 'up',
      // 'drag' | 'up'
      stepX: null,
      // null => bruk axis.grid.majorX
      stepY: null // null => bruk axis.grid.majorY
    }
  },
  // Grafnavn
  curveName: {
    show: SHOW_CURVE_NAMES || SHOW_CURVE_EXPRESSIONS,
    showName: SHOW_CURVE_NAMES,
    showExpression: SHOW_CURVE_EXPRESSIONS,
    fontSize: SHARED_FONT_SIZE,
    layer: 30,
    fractions: [0.2, 0.8, 0.6, 0.4],
    gapPx: 30,
    plate: {
      paddingPx: 4,
      fill: '#fff',
      opacity: 0.6,
      radiusPx: 4
    },
    marginFracX: 0.04,
    marginFracY: 0.04
  },
  // Domenemarkører (brackets)
  domainMarkers: {
    show: SHOW_DOMAIN_MARKERS,
    barPx: 22,
    tipFrac: 0.20,
    color: DEFAULT_POINT_COLORS.domainMarker || DEFAULT_POINT_COLORS.fallbackDomain,
    width: DEFAULT_LINE_THICKNESS,
    layer: 8,
    offsetPx: 10
  },
  // Asymptoter
  asymptote: {
    detect: true,
    showVertical: true,
    hugeY: 30,
    trimY: 8
  },
  // Fasit-sjekk (linje-modus)
  check: {
    slopeTol: 1e-3,
    interTol: 1e-3
  }
};

if (STORAGE_STATE_V2) {
  const opts = STORAGE_STATE_V2.options || {};
  if (Array.isArray(STORAGE_STATE_V2.view) && STORAGE_STATE_V2.view.length === 4) {
    ADV.screen = STORAGE_STATE_V2.view.slice(0, 4);
  }
  if (opts.lockAspect !== undefined) {
    ADV.lockAspect = opts.lockAspect;
  }
  if (opts.grid !== undefined && ADV.axis && ADV.axis.grid) {
    ADV.axis.grid.show = opts.grid;
  }
  if (opts.axisNumbers !== undefined && ADV.axis && ADV.axis.ticks) {
    ADV.axis.ticks.showNumbers = opts.axisNumbers;
  }
  if (opts.axisLabels && ADV.axis && ADV.axis.labels) {
    if (typeof opts.axisLabels.x === 'string') {
      ADV.axis.labels.x = opts.axisLabels.x;
    }
    if (typeof opts.axisLabels.y === 'string') {
      ADV.axis.labels.y = opts.axisLabels.y;
    }
  }
}

if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      if (m.type === 'attributes' && m.attributeName === 'data-theme-profile') {
        scheduleThemeRefresh();
        break;
      }
    }
  });
  if (document.documentElement) {
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-profile'] });
  }
}

scheduleThemeRefresh();

const INITIAL_FIRST_QUADRANT = !!ADV.firstQuadrant;
const INITIAL_LOCK_ASPECT = ADV.lockAspect !== false;
const INITIAL_SHOW_AXIS_NUMBERS = !!(ADV.axis && ADV.axis.ticks && ADV.axis.ticks.showNumbers);
const INITIAL_SHOW_GRID = !!(ADV.axis && ADV.axis.grid && ADV.axis.grid.show);
const INITIAL_FORCE_TICKS = !!FORCE_TICKS_REQUESTED;
const INITIAL_SNAP_ENABLED = !!(ADV.points && ADV.points.snap && ADV.points.snap.enabled);
const INITIAL_SHOW_POINT_ARROWS = !!(ADV.points && ADV.points.guideArrows);
const INITIAL_SHOW_POINT_COORDS = !!(ADV.points && ADV.points.showCoordsOnHover);
const CLEAN_SAVE_DEFAULTS = {
  grid: STORAGE_V2_DEFAULTS.grid,
  axisNumbers: STORAGE_V2_DEFAULTS.axisNumbers,
  lockAspect: STORAGE_V2_DEFAULTS.lockAspect,
  firstQuadrant: INITIAL_FIRST_QUADRANT,
  axisLabels: STORAGE_V2_DEFAULTS.axisLabels
};

function buildExampleStateFromStorageV2(storageState) {
  if (!storageState || storageState.v !== STORAGE_SCHEMA_VERSION) return null;
  const opts = storageState.options || {};
  const exampleState = {};
  if (Array.isArray(storageState.view) && storageState.view.length === 4) {
    exampleState.screen = storageState.view.slice(0, 4);
    exampleState.screenSource = 'manual';
  }
  if (opts.lockAspect !== undefined) {
    exampleState.lockAspect = !!opts.lockAspect;
  }
  if (opts.grid !== undefined) {
    exampleState.showGrid = !!opts.grid;
  }
  if (opts.axisNumbers !== undefined) {
    exampleState.showAxisNumbers = !!opts.axisNumbers;
  }
  if (opts.firstQuadrant !== undefined) {
    exampleState.firstQuadrant = !!opts.firstQuadrant;
  }
  if (opts.axisLabels) {
    exampleState.axisLabels = {
      x: typeof opts.axisLabels.x === 'string' ? opts.axisLabels.x : ADV.axis.labels.x,
      y: typeof opts.axisLabels.y === 'string' ? opts.axisLabels.y : ADV.axis.labels.y,
      fontSize: ADV.axis.labels.fontSize
    };
  }
  if (Array.isArray(storageState.curveLabels)) {
    exampleState.curveLabels = storageState.curveLabels
      .filter(entry => entry && typeof entry === 'object')
      .map(entry => {
        const pos = Array.isArray(entry.position) && entry.position.length >= 2
          ? [Number.parseFloat(entry.position[0]), Number.parseFloat(entry.position[1])]
          : null;
        const normalizedPos = pos && pos.every(Number.isFinite) ? pos : null;
        return {
          manual: !!entry.manual,
          position: normalizedPos
        };
      });
  }
  return Object.keys(exampleState).length ? exampleState : null;
}

const EXAMPLE_STATE = (() => {
  const existing = buildExampleStateFromStorageV2(STORAGE_STATE_V2)
    || (typeof window !== 'undefined' && window.STATE && typeof window.STATE === 'object'
      ? window.STATE
      : {});
  if (typeof window !== 'undefined') {
    if (STORAGE_STATE_V2) {
      window.STATE_V2 = STORAGE_STATE_V2;
    }
    window.STATE = existing;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'showNames')) {
    existing.showNames = !!(ADV.curveName && ADV.curveName.showName);
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'showExpression')) {
    existing.showExpression = !!(ADV.curveName && ADV.curveName.showExpression);
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'lockAspect')) {
    existing.lockAspect = ADV.lockAspect !== false;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'firstQuadrant')) {
    existing.firstQuadrant = INITIAL_FIRST_QUADRANT;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'showAxisNumbers')) {
    existing.showAxisNumbers = INITIAL_SHOW_AXIS_NUMBERS;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'showGrid')) {
    existing.showGrid = INITIAL_SHOW_GRID;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'forceTicks')) {
    existing.forceTicks = INITIAL_FORCE_TICKS;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'snapEnabled')) {
    existing.snapEnabled = INITIAL_SNAP_ENABLED;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'showPointArrows')) {
    existing.showPointArrows = INITIAL_SHOW_POINT_ARROWS;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'showPointCoords')) {
    existing.showPointCoords = INITIAL_SHOW_POINT_COORDS;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'screen')) {
    existing.screen = Array.isArray(ADV.screen) ? ADV.screen.slice(0, 4) : null;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'screenSource')) {
    existing.screenSource = INITIAL_SCREEN_SOURCE;
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'axisLabels')) {
    existing.axisLabels = {
      x: ADV.axis.labels.x,
      y: ADV.axis.labels.y,
      fontSize: ADV.axis.labels.fontSize
    };
  }
  if (!Object.prototype.hasOwnProperty.call(existing, 'axisLabelPositions')) {
    existing.axisLabelPositions = {
      x: { manual: false, position: null },
      y: { manual: false, position: null }
    };
  }
  if (ADV.curveName) {
    const resolvedShowNames = !!existing.showNames;
    const resolvedShowExpression = !!existing.showExpression;
    ADV.curveName.showName = resolvedShowNames;
    ADV.curveName.showExpression = resolvedShowExpression;
    ADV.curveName.show = resolvedShowNames || resolvedShowExpression;
  }
  return existing;
})();

const CURVE_LABEL_STATE = [];
function hydrateCurveLabelStateFromExample() {
  CURVE_LABEL_STATE.length = 0;
  const source = EXAMPLE_STATE && Array.isArray(EXAMPLE_STATE.curveLabels)
    ? EXAMPLE_STATE.curveLabels
    : [];
  source.forEach((entry, idx) => {
    const pos = entry && Array.isArray(entry.position) && entry.position.length >= 2
      ? entry.position.slice(0, 2)
      : null;
    CURVE_LABEL_STATE[idx] = {
      manual: !!(entry && entry.manual),
      position: pos
    };
  });
}
hydrateCurveLabelStateFromExample();

function curveLabelState(index) {
  const idx = Number.isInteger(index) && index >= 0 ? index : 0;
  if (!CURVE_LABEL_STATE[idx]) {
    CURVE_LABEL_STATE[idx] = { manual: false, position: null };
  }
  return CURVE_LABEL_STATE[idx];
}

function syncCurveLabelStateToExample() {
  if (!EXAMPLE_STATE || typeof EXAMPLE_STATE !== 'object') return;
  EXAMPLE_STATE.curveLabels = CURVE_LABEL_STATE.map(entry => ({
    manual: !!(entry && entry.manual),
    position: entry && Array.isArray(entry.position) && entry.position.length >= 2
      ? entry.position.slice(0, 2)
      : null
  }));
}

function rememberCurveLabelPosition(index, pos, manualOverride) {
  const state = curveLabelState(index);
  if (!state) return;
  if (manualOverride != null) {
    state.manual = !!manualOverride;
    if (!state.manual && !pos) {
      state.position = null;
      syncCurveLabelStateToExample();
      return;
    }
  }
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
    state.position = [pos.x, pos.y];
  }
  syncCurveLabelStateToExample();
}

function manualCurveLabelPosition(index) {
  const state = curveLabelState(index);
  if (!state || !state.manual) return null;
  const pos = state.position;
  if (Array.isArray(pos) && pos.length >= 2 && Number.isFinite(pos[0]) && Number.isFinite(pos[1])) {
    return { x: pos[0], y: pos[1] };
  }
  return null;
}

const DOMAIN_MARKER_SHAPES = {
  closed: {
    offsetPx: -3,
    points: [
      [18.5, 47],
      [3, 47],
      [2.610756875, 46.9214171875],
      [2.2928949999999997, 46.7071125],
      [2.078585625, 46.3892515625],
      [2, 46],
      [2, 3],
      [2.078585625, 2.610756875],
      [2.2928949999999997, 2.2928949999999997],
      [2.610756875, 2.078585625],
      [3, 2],
      [18.5, 2]
    ]
  },
  open: {
    offsetPx: -8,
    points: [
      [2, 47.5],
      [37.6146, 25.6019],
      [37.97173125, 25.225853125],
      [38.090775, 24.75],
      [37.97173125, 24.274146875],
      [37.6146, 23.8981],
      [2, 2]
    ]
  }
};

Object.values(DOMAIN_MARKER_SHAPES).forEach(shape => {
  if (!shape || !Array.isArray(shape.points) || !shape.points.length) return;
  const xs = shape.points.map(pt => pt[0]);
  const ys = shape.points.map(pt => pt[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  shape.centerX = (minX + maxX) / 2;
  shape.centerY = (minY + maxY) / 2;
  shape.height = Math.max(1e-6, maxY - minY);
});

const DEFAULT_LINE_POINTS = ADV.points.start.map(pt => pt.slice());

// Initialize line points after defaults have been computed
applyLinePointStart(appState.simple.parsed);

function parsePointListString(str) {
  if (typeof str !== 'string') return [];
  const normalized = str
    .replace(/\)\s*,\s*(?=\()/g, ');')
    .replace(/;+/g, ';');
  return normalized.split(';').map(part => {
    const cleaned = part
      .trim()
      .replace(/^[A-Za-z\u00C0-\u024F]+\w*\s*=\s*/, '')
      .replace(/^\(|\)$/g, '');
    if (!cleaned) return null;
    const coords = cleaned.split(',').map(token => Number.parseFloat(token.trim().replace(',', '.')));
    if (coords.length !== 2) return null;
    if (!coords.every(Number.isFinite)) return null;
    return coords;
  }).filter(Boolean);
}

function extractLineRhs(expr) {
  if (typeof expr !== 'string') return '';
  const match = expr.match(/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=\s*(.+)$/i) || expr.match(/^y\s*=\s*(.+)$/i);
  return match ? match[1].trim() : expr.trim();
}

function interpretLineTemplate(rhs) {
  const base = { kind: null, anchorC: 0, slopeM: 1 };
  if (typeof rhs !== 'string') return base;
  const normalized = rhs.replace(/\s+/g, '').replace(/·/g, '*').replace(/,/g, '.').replace(/−/g, '-').toLowerCase();
  if (!normalized) return base;
  if (/^a\*?x$/.test(normalized)) {
    return {
      kind: 'anchorY',
      anchorC: 0,
      slopeM: 1
    };
  }
  if (/^a\*?x([+-])(\d+(?:\.\d+)?)$/.test(normalized)) {
    const sign = RegExp.$1 === '-' ? -1 : 1;
    const value = Number.parseFloat(RegExp.$2);
    return {
      kind: 'anchorY',
      anchorC: Number.isFinite(value) ? sign * value : 0,
      slopeM: 1
    };
  }
  if (/^([+-]?\d*(?:\.\d+)?)\*?x\+b$/.test(normalized)) {
    const raw = RegExp.$1;
    let slopeM = 1;
    if (raw === '' || raw === '+') {
      slopeM = 1;
    } else if (raw === '-') {
      slopeM = -1;
    } else {
      const parsed = Number.parseFloat(raw);
      slopeM = Number.isFinite(parsed) ? parsed : 1;
    }
    return {
      kind: 'fixedSlope',
      anchorC: 0,
      slopeM
    };
  }
  const hasA = /(^|[+\-*/(])a(?=\*?x(?![a-z]))/.test(normalized);
  const hasB = /(^|[+\-])b(?![a-z])(?!\*|x)/.test(normalized);
  if (hasA && hasB) {
    return {
      kind: 'two',
      anchorC: 0,
      slopeM: 1
    };
  }
  return base;
}

function interpretLineTemplateFromExpression(expr) {
  return interpretLineTemplate(extractLineRhs(expr));
}

function isValidPointArray(pt) {
  return Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite);
}

function resolveLineStartPoints(parsed) {
  const basePoints = DEFAULT_LINE_POINTS.map(pt => pt.slice());
  if (!parsed) {
    return basePoints;
  }
  const first = parsed.funcs && parsed.funcs[0] ? parsed.funcs[0] : null;
  const spec = interpretLineTemplate(first ? first.rhs : '');
  const needed = spec.kind === 'two' ? 2 : spec.kind ? 1 : 0;
  if (Array.isArray(parsed.linePoints)) {
    const valid = parsed.linePoints.filter(isValidPointArray);
    if (valid[0]) basePoints[0] = valid[0].slice();
    if (needed > 1 && valid[1]) basePoints[1] = valid[1].slice();
  }
  return basePoints;
}

function applyLinePointStart(parsed) {
  const resolved = resolveLineStartPoints(parsed);
  ADV.points.start = resolved.map(pt => pt.slice());
  if (parsed && typeof parsed === 'object') {
    const xValues = resolved
      .map(pt => Array.isArray(pt) && pt.length > 0 ? pt[0] : null)
      .filter(val => Number.isFinite(val));
    if (xValues.length) {
      const existingStartX = Array.isArray(parsed.startX) ? parsed.startX.filter(Number.isFinite) : [];
      if (existingStartX.length < xValues.length) {
        parsed.startX = xValues.slice();
      }
    }
  }
  return resolved;
}

/* ======================= Parser / modus ======================= */
function normalizeDomainNumericString(str) {
  if (!str) return '';
  const replacedMinus = str.replace(/−/g, '-');
  let out = '';
  for (let i = 0; i < replacedMinus.length; i++) {
    const ch = replacedMinus[i];
    const prev = i > 0 ? replacedMinus[i - 1] : '';
    const next = i < replacedMinus.length - 1 ? replacedMinus[i + 1] : '';
    if (ch === ',' && /\d/.test(prev) && /\d/.test(next)) {
      out += '.';
    } else if (!/\s/.test(ch)) {
      out += ch;
    }
  }
  return out;
}

function splitDomainParts(str) {
  if (typeof str !== 'string') return [];
  const parts = [];
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === ',') {
      const prev = i > 0 ? str[i - 1] : '';
      const next = i < str.length - 1 ? str[i + 1] : '';
      if (/\d/.test(prev) && /\d/.test(next)) {
        current += ch;
      } else {
        const trimmed = current.trim();
        if (trimmed) parts.push(trimmed);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) parts.push(trimmed);
  return parts;
}

function stripDomainEndpointMarker(part, side) {
  if (typeof part !== 'string') {
    return { text: '', marker: null };
  }
  let trimmed = part.trim();
  if (!trimmed) {
    return { text: '', marker: null };
  }
  let marker = null;
  if (side === 'left') {
    const first = trimmed[0];
    if (['[', '<', '('].includes(first)) {
      marker = first;
      trimmed = trimmed.slice(1).trim();
    }
  }
  if (side === 'right') {
    const last = trimmed[trimmed.length - 1];
    if ([']', '>', ')'].includes(last)) {
      marker = last;
      trimmed = trimmed.slice(0, -1).trim();
    }
  }
  return { text: trimmed, marker };
}

function parseDomainNumber(str) {
  if (!str) return null;
  const normalized = normalizeDomainNumericString(str);
  if (!normalized) return null;
  const infinityMatch = normalized.match(/^([+-])?(?:inf(?:inity)?|∞)$/i);
  if (infinityMatch) {
    const sign = infinityMatch[1] === '-' ? -1 : 1;
    return sign < 0 ? -Infinity : Infinity;
  }
  const num = Number.parseFloat(normalized.replace(/∞/gi, ''));
  if (Number.isFinite(num)) {
    return num;
  }
  return null;
}

function parseDomainString(dom) {
  if (!dom) return null;
  const cleaned = dom.trim();
  if (!cleaned) return null;
  if (/^r$/i.test(cleaned) || /^ℝ$/i.test(cleaned)) return null;
  const normalized = cleaned
    .replace(/[⟨〈]/g, '<')
    .replace(/[⟩〉]/g, '>')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/−/g, '-');
  const buildDomain = (leftPart, rightPart, opts = {}) => {
    const leftInfo = stripDomainEndpointMarker(leftPart, 'left');
    const rightInfo = stripDomainEndpointMarker(rightPart, 'right');
    const leftMarker = opts.leftMarker != null ? opts.leftMarker : leftInfo.marker;
    const rightMarker = opts.rightMarker != null ? opts.rightMarker : rightInfo.marker;
    const a = parseDomainNumber(leftInfo.text);
    const b = parseDomainNumber(rightInfo.text);
    if (a == null || b == null) return null;
    if (!(b >= a)) return null;
    if (!Number.isFinite(a) && !Number.isFinite(b)) return null;
    const hasExplicitLeft = leftMarker != null;
    const hasExplicitRight = rightMarker != null;
    let leftClosed = hasExplicitLeft ? leftMarker === '[' : false;
    let rightClosed = hasExplicitRight ? rightMarker === ']' : false;
    if (!Number.isFinite(a)) leftClosed = false;
    if (!Number.isFinite(b)) rightClosed = false;
    const hasMarkers =
      opts.showMarkers === undefined ? hasExplicitLeft || hasExplicitRight : !!opts.showMarkers;
    return {
      min: a,
      max: b,
      leftClosed,
      rightClosed,
      showMarkers: hasMarkers,
      showLeftMarker: hasMarkers ? hasExplicitLeft : false,
      showRightMarker: hasMarkers ? hasExplicitRight : false
    };
  };
  const start = normalized[0];
  const end = normalized[normalized.length - 1];
  const isBracketStart = ['[', '<', '('].includes(start);
  const isBracketEnd = [']', '>', ')'].includes(end);
  if (isBracketStart && isBracketEnd) {
    const inner = normalized.slice(1, -1);
    const parts = splitDomainParts(inner);
    if (parts.length === 2) {
      const bracketDomain = buildDomain(parts[0], parts[1], {
        leftMarker: start,
        rightMarker: end,
        showMarkers: true
      });
      if (bracketDomain) {
        return bracketDomain;
      }
    }
    return null;
  }
  const inequality = normalized.match(
    /^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+|∞|inf(?:inity)?))\s*(<=|<)\s*[xX]\s*(<=|<)\s*([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+|∞|inf(?:inity)?))$/i
  );
  if (inequality) {
    const a = parseDomainNumber(inequality[1]);
    const b = parseDomainNumber(inequality[4]);
    if (a != null && b != null && b >= a) {
      if (!Number.isFinite(a) && !Number.isFinite(b)) return null;
      return {
        min: a,
        max: b,
        leftClosed: inequality[2] === '<=' && Number.isFinite(a),
        rightClosed: inequality[3] === '<=' && Number.isFinite(b),
        showMarkers: true,
        showLeftMarker: true,
        showRightMarker: true
      };
    }
  }
  const parts = splitDomainParts(normalized);
  if (parts.length === 2) {
    const fallbackDomain = buildDomain(parts[0], parts[1]);
    if (fallbackDomain) {
      return fallbackDomain;
    }
  }
  return null;
}

function formatDomainNumber(value) {
  if (value === Infinity) return '∞';
  if (value === -Infinity) return '-∞';
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  const normalized = Object.is(value, -0) ? 0 : value;
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  let out = normalized
    .toFixed(6)
    .replace(/(\.\d*?)0+$/, '$1')
    .replace(/\.$/, '');
  if (out.includes('.')) {
    out = out.replace('.', ',');
  }
  return out;
}

function formatDomainForInput(domain) {
  if (!domain || typeof domain !== 'object') {
    return '';
  }
  const hasMin = Number.isFinite(domain.min);
  const hasMax = Number.isFinite(domain.max);
  if (!hasMin && !hasMax) {
    return '';
  }
  const min = hasMin ? formatDomainNumber(domain.min) : '-∞';
  const max = hasMax ? formatDomainNumber(domain.max) : '∞';
  if ((hasMin && !min) || (hasMax && !max)) {
    return '';
  }
  const showLeftMarker = domain.showLeftMarker != null ? !!domain.showLeftMarker : domain.showMarkers !== false;
  const showRightMarker = domain.showRightMarker != null ? !!domain.showRightMarker : domain.showMarkers !== false;
  if (!showLeftMarker && !showRightMarker) {
    return `${min}, ${max}`;
  }
  const left = showLeftMarker && hasMin ? (domain.leftClosed ? '[' : '<') : '';
  const right = showRightMarker && hasMax ? (domain.rightClosed ? ']' : '>') : '';
  return `${left}${min}, ${max}${right}`;
}

function normalizeDomainInputValue(value) {
  const parsed = parseDomainString(value);
  if (!parsed) return null;
  const formatted = formatDomainForInput(parsed);
  if (!formatted) return null;
  return { parsed, formatted };
}

function resolveDomainSamplingBounds(domain, span = DEFAULT_UNBOUNDED_DOMAIN_SPAN) {
  if (!domain || typeof domain !== 'object') {
    return [-5, 5];
  }
  const hasMin = Number.isFinite(domain.min);
  const hasMax = Number.isFinite(domain.max);
  if (hasMin && hasMax) {
    return [domain.min, domain.max];
  }
  if (hasMin && !hasMax) {
    const start = domain.min;
    return [start, start + span];
  }
  if (!hasMin && hasMax) {
    const end = domain.max;
    return [end - span, end];
  }
  const half = span / 2;
  return [-half, half];
}

function parseSimple(txt) {
  const lines = (txt || '').split('\n').map(s => s.trim()).filter(Boolean);
  const out = {
    funcs: [],
    pointsCount: 0,
    startX: [],
    extraPoints: [],
    pointNames: [],
    linePoints: [],
    answer: null,
    answers: [],
    rows: [],
    pointMarker: '',
    pointMarkers: [],
    markerExplicitEmpty: false,
    pointLocks: [],
    lockExtraPoints: true,
    raw: txt
  };
  const parseFunctionLine = line => {
    const eqIdx = line.indexOf('=');
    if (eqIdx < 0) return null;
    const lhsRaw = line.slice(0, eqIdx).trim();
    const rhsWithDom = line.slice(eqIdx + 1).trim();
    if (!lhsRaw || !rhsWithDom) return null;
    let name = null;
    let label = null;
    const lhsFn = lhsRaw.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)$/i);
    if (lhsFn) {
      name = lhsFn[1];
      label = `${lhsFn[1]}(x)`;
    } else {
      const lhsVar = lhsRaw.match(/^([a-zA-Z]\w*)$/i);
      if (!lhsVar) return null;
      if (lhsVar[1].toLowerCase() !== 'y') return null;
      name = lhsVar[1];
      label = lhsVar[1];
    }
    let rhs = rhsWithDom;
    let domain = null;
    let color = '';
    let colorSource = 'auto';
    let searching = true;
    while (searching) {
      searching = false;
      const colorMatch = /,?\s*color\s*=\s*([^,]+)$/i.exec(rhs);
      if (colorMatch) {
        const normalizedColor = normalizeColorValue(colorMatch[1]);
        if (normalizedColor) {
          color = normalizedColor;
          colorSource = 'manual';
        }
        rhs = rhs.slice(0, colorMatch.index).trim();
        searching = true;
        continue;
      }
      const domMatch = /,?\s*x\s*(?:in|∈)\s*(.+)$/i.exec(rhs);
      if (domMatch) {
        rhs = rhs.slice(0, domMatch.index).trim();
        domain = parseDomainString(domMatch[1]);
        searching = true;
        continue;
      }
    }
    rhs = rhs.trim();
    if (!rhs) return null;
    return {
      name,
      rhs,
      domain,
      label,
      color,
      colorSource
    };
  };
  for (const L of lines) {
    const fun = parseFunctionLine(L);
    if (fun) {
      out.funcs.push(fun);
      out.rows.push({
        type: 'function',
        funcIndex: out.funcs.length - 1
      });
      continue;
    }
    const pm = L.match(/^points\s*=\s*(\d+)/i);
    if (pm) {
      out.pointsCount = +pm[1];
      continue;
    }
    const cm = L.match(/^coords\s*=\s*(.+)$/i);
    if (cm) {
      let coordsLine = cm[1].trim();
      let coordsColor = '';
      let coordsColorSource = 'auto';
      const colorMatch = /,\s*color\s*=\s*([^,]+)$/i.exec(coordsLine);
      if (colorMatch) {
        const normalizedColor = normalizeColorValue(colorMatch[1]);
        if (normalizedColor) {
          coordsColor = normalizedColor;
          coordsColorSource = 'manual';
        }
        coordsLine = coordsLine.slice(0, colorMatch.index).trim();
      }
      const startIndex = out.extraPoints.length;
      const pts = coordsLine.split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .map(entry => {
          const nameMatch = entry.match(/^([A-Za-z\u00C0-\u024F]+\w*)\s*=/);
          const name = nameMatch ? nameMatch[1] : null;
          const coords = entry.replace(/^([A-Za-z\u00C0-\u024F]+\w*)\s*=\s*/, '').replace(/^\(|\)$/g, '')
            .split(',')
            .map(t => +t.trim())
            .filter(Number.isFinite);
          return { name, coords };
        });
      for (const { name, coords } of pts) {
        if (coords.length === 2) {
          out.extraPoints.push(coords);
          out.pointNames.push(name || null);
        }
      }
      const count = out.extraPoints.length - startIndex;
      if (count > 0) {
        out.rows.push({
          type: 'coords',
          pointStart: startIndex,
          pointCount: count,
          color: coordsColor,
          colorSource: coordsColorSource
        });
      }
      continue;
    }
    const mm = L.match(/^marker\s*=\s*(.*)$/i);
    if (mm) {
      const normalizedMarker = normalizePointMarkerValue(mm[1]);
      const sanitizedMarker = sanitizePointMarkerValue(mm[1]);
      out.pointMarkers = parsePointMarkerList(mm[1]);
      out.pointMarker = normalizedMarker || sanitizedMarker;
      if (!normalizedMarker && sanitizedMarker === '' && typeof mm[1] === 'string') {
        out.markerExplicitEmpty = true;
      }
      continue;
    }
    const lockMatch = L.match(/^lockpoint\s*=\s*(.+)$/i);
    if (lockMatch) {
      const lockList = parsePointLockList(lockMatch[1]);
      if (lockList.length) {
        out.pointLocks = lockList;
        out.lockExtraPoints = !lockList.some(val => val === false);
      } else {
        const value = lockMatch[1].trim().toLowerCase();
        out.lockExtraPoints = !/^(?:0|false|nei|off|no)$/i.test(value);
      }
      continue;
    }
    const lm = L.match(/^linepts\s*=\s*(.+)$/i);
    if (lm) {
      const pts = parsePointListString(lm[1]);
      for (const pt of pts) {
        if (pt.length === 2) out.linePoints.push(pt);
      }
      continue;
    }
    const sm = L.match(/^startx\s*=\s*(.+)$/i);
    if (sm) {
      out.startX = sm[1].split(',').map(s => +s.trim()).filter(Number.isFinite);
      continue;
    }
    const am = L.match(/^(?:riktig|fasit)(\d*)\s*:\s*(.+)$/i);
    if (am) {
      const idx = am[1] ? Math.max(1, Number.parseInt(am[1], 10)) - 1 : 0;
      const value = am[2].trim();
      if (value) {
        out.answers[idx] = value;
      }
      continue;
    }
  }
  if (!out.answer && Array.isArray(out.answers)) {
    const firstAnswer = out.answers.find(ans => typeof ans === 'string' && ans.trim());
    if (firstAnswer) {
      out.answer = firstAnswer;
    }
  }
  if (out.pointMarkers.length > out.extraPoints.length) {
    out.pointMarkers = out.pointMarkers.slice(0, out.extraPoints.length);
  }
  if (out.pointLocks.length > out.extraPoints.length) {
    out.pointLocks = out.pointLocks.slice(0, out.extraPoints.length);
  }
  if (out.pointNames.length > out.extraPoints.length) {
    out.pointNames = out.pointNames.slice(0, out.extraPoints.length);
  }
  if (!out.pointMarker && out.pointMarkers.length) {
    out.pointMarker = formatPointMarkerList(out.pointMarkers);
  }
  return out;
}
function computePaletteRequestCount() {
  const simpleCount = DEFAULT_GRAFTEGNER_SIMPLE.expressions.length;
  const trigCount = DEFAULT_GRAFTEGNER_TRIG_SIMPLE.expressions.length;
  const parsedCount = Array.isArray(appState.simple.parsed && appState.simple.parsed.funcs) ? appState.simple.parsed.funcs.length : 0;
  const manualCount = Array.isArray(appState.simple.parsed && appState.simple.parsed.extraPoints) ? appState.simple.parsed.extraPoints.length : 0;
  return Math.max(simpleCount, trigCount, parsedCount, manualCount, DEFAULT_FUNCTION_COLORS.fallback.length, 1);
}
const ALLOWED_NAMES = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lg', 'sqrt', 'exp', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'pow'];
const ALLOWED_IDENTIFIER_SET = new Set([...ALLOWED_NAMES.map(name => name.toLowerCase()), 'x', 'pi', 'e', 'tau', 'log10']);
function isExplicitRHS(rhs) {
  let s = rhs.toLowerCase();
  for (const k of ALLOWED_NAMES) s = s.replace(new RegExp(`\\b${k}\\b`, 'g'), '');
  s = s.replace(/\bpi\b/g, '').replace(/\be\b/g, '').replace(/x/g, '');
  s = s.replace(/[0-9.+\-*/^()%\s]/g, '');
  return s.length === 0;
}
function decideMode(parsed) {
  const anyPlaceholder = parsed.funcs.some(f => !isExplicitRHS(f.rhs));
  return anyPlaceholder ? 'points' : 'functions';
}
let MODE = decideMode(appState.simple.parsed);
// Deaktiverer "Tving 1, 2, 3" når mer enn 40 tall får plass på en akse.
const FORCE_TICKS_AUTO_DISABLE_LIMIT = 40;
let FORCE_TICKS_LOCKED_FALSE = false;
let START_SCREEN = null;
let LAST_COMPUTED_SCREEN = Array.isArray(ADV.screen) ? ADV.screen.slice(0, 4) : null;
let LAST_SCREEN_SOURCE = INITIAL_SCREEN_SOURCE;
let SCREEN_INPUT_IS_EDITING = false;
const VIEW_CHANGE_DEBOUNCE_MS = 80;
let PENDING_VIEW_CHANGE_HANDLE = null;
let LAST_FUNCTION_VIEW_SCREEN = null;
let IS_SETTING_BOUNDING_BOX = false;

applyGraftegnerDefaultsFromTheme({ count: computePaletteRequestCount() });

/* =============== uttrykk → funksjon ================= */
function parseFunctionSpec(spec) {
  let rhs = (spec || '').toString().trim();
  const m = rhs.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*(.+)$/);
  if (m) {
    rhs = m[2];
  }
  rhs = rhs
    .replace(/(^|[=+\-*/])\s*([+-])\s*([a-zA-Z0-9._()]+)\s*\^/g, (m, p, s, b) => p + '0' + s + '(' + b + ')^')
    .replace(/\^/g, '**')
    .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
    .replace(/([x\)])\(/g, '$1*(')
    .replace(/x(\d)/g, 'x*$1')
    .replace(/\bln\(/gi, 'log(')
    .replace(/\blg\(/gi, 'log10(')
    .replace(/\bpi\b/gi, 'PI')
    .replace(/\be\b/gi, 'E')
    .replace(/\btau\b/gi, '(2*PI)')
    .replace(/(\bPI|\bE|[\d.)x])\s+(?=[a-zA-Z(0-9)])/g, '$1*');
  const identifiers = (rhs.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).map(id => id.toLowerCase());
  const hasDisallowedIdentifier = identifiers.some(id => !ALLOWED_IDENTIFIER_SET.has(id));
  const hasDangerousSyntax = /[;{}\[\]`]|=>|new\s+function|function\s*\(/i.test(rhs);
  if (hasDisallowedIdentifier || hasDangerousSyntax) {
    return () => NaN;
  }
  let fn;
  try {
    // eslint-disable-next-line no-new-func
    fn = new Function('x', 'with(Math){return ' + rhs + ';}');
  } catch (_) {
    fn = x => NaN;
  }
  return fn;
}

/* ============ Hjelpere for brøk/format & snap (linje-modus) ======== */
function stepX() {
  return (ADV.points.snap.stepX != null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1;
}
function stepY() {
  return (ADV.points.snap.stepY != null ? ADV.points.snap.stepY : +ADV.axis.grid.majorY) || 1;
}
function nearestMultiple(val, step) {
  return Math.round(val / step) * step;
}
function isNearMultiple(val, step) {
  const eps = Math.max(1e-9, Math.abs(step) * 1e-6);
  return Math.abs(val - nearestMultiple(val, step)) <= eps;
}
function decimalsForStep(step) {
  if (!Number.isFinite(step) || step <= 0) return 0;
  if (Math.abs(step - Math.round(step)) < 1e-12) return 0;
  const s = step.toString();
  if (s.includes('e')) {
    const m = Math.abs(Math.log10(step));
    return Math.min(6, Math.ceil(m));
  }
  return Math.min(6, (s.split('.')[1] || '').length);
}
function toFixedTrim(n, d) {
  return (+n).toFixed(d).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
function fmtSmartVal(val, step) {
  if (!ADV.points.snap.enabled) {
    return toFixedTrim(val, ADV.points.decimals);
  }
  const m = nearestMultiple(val, step);
  if (isNearMultiple(val, step)) {
    const digs = decimalsForStep(step);
    return toFixedTrim(m, digs);
  } else {
    return toFixedTrim(val, ADV.points.decimals);
  }
}
function fmtCoordsStatic(P) {
  return `(${fmtSmartVal(P.X(), stepX())}, ${fmtSmartVal(P.Y(), stepY())})`;
}
function fmtCoordsDrag(P) {
  const d = ADV.points.decimals;
  return `(${toFixedTrim(P.X(), d)}, ${toFixedTrim(P.Y(), d)})`;
}

function formatScreenNumber(val) {
  if (!Number.isFinite(val)) return '';
  const abs = Math.abs(val);
  let decimals = 4;
  if (abs >= 1000) {
    decimals = 2;
  } else if (abs >= 100) {
    decimals = 3;
  }
  return toFixedTrim(val, decimals);
}

function formatScreenForInput(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return '';
  return screen.map(formatScreenNumber).join(', ');
}

function syncScreenInputFromState() {
  if (typeof document === 'undefined') return;
  const input = document.getElementById('cfgScreen');
  if (!input) return;
  if (SCREEN_INPUT_IS_EDITING && typeof document !== 'undefined' && document.activeElement === input) {
    return;
  }
  if (Array.isArray(LAST_COMPUTED_SCREEN) && LAST_COMPUTED_SCREEN.length === 4) {
    const formatted = formatScreenForInput(LAST_COMPUTED_SCREEN);
    input.value = formatted;
  } else {
    input.value = formatScreenForInput(DEFAULT_SCREEN);
  }
}

function rememberScreenState(screen, source) {
  const normalized = calculateCorrectedScreen(screen);
  LAST_COMPUTED_SCREEN = normalized;
  LAST_SCREEN_SOURCE = typeof source === 'string' && source ? source : 'manual';
  if (EXAMPLE_STATE && typeof EXAMPLE_STATE === 'object') {
    EXAMPLE_STATE.screen = normalized ? normalized.slice(0, 4) : null;
    EXAMPLE_STATE.screenSource = LAST_SCREEN_SOURCE;
  }
  syncScreenInputFromState();
}

/* ======= brøk for m & b (melding ved snap / “Riktig:”) ======= */
function rationalApprox(x, maxDen = 64) {
  let a0 = Math.floor(x),
    p0 = 1,
    q0 = 0,
    p1 = a0,
    q1 = 1,
    frac = x - a0;
  while (Math.abs(p1 / q1 - x) > 1e-12 && q1 <= maxDen && frac) {
    const a = Math.floor(1 / frac);
    const p2 = a * p1 + p0,
      q2 = a * q1 + q0;
    p0 = p1;
    q0 = q1;
    p1 = p2;
    q1 = q2;
    frac = 1 / frac - a;
  }
  return [p1, q1];
}
function fracStr(x) {
  const [n, d] = rationalApprox(x, 64);
  return d === 1 ? `${n}` : `${n}/${d}`;
}

function fracPlain(x) {
  if (!Number.isFinite(x)) return '';
  const sign = x < 0 ? '-' : '';
  const [n, d] = rationalApprox(Math.abs(x), 64);
  if (d === 1) {
    return `${sign}${n}`;
  }
  return `${sign}${n}/${d}`;
}

function fracLatex(x) {
  if (!Number.isFinite(x)) return '';
  const sign = x < 0 ? '-' : '';
  const [n, d] = rationalApprox(Math.abs(x), 64);
  if (d === 1) {
    return `${sign}${n}`;
  }
  return `${sign}\\frac{${n}}{${d}}`;
}

const LINEAR_EPSILON = 1e-9;

function isNearly(value, target) {
  return Math.abs(value - target) < LINEAR_EPSILON;
}

function isNearlyZero(value) {
  return Math.abs(value) < LINEAR_EPSILON;
}

function formatLineEquation(lhs, slope, intercept, formatter, variable = 'x') {
  const safeLhs = typeof lhs === 'string' ? lhs.trim() : '';
  const varSymbol = typeof variable === 'string' && variable ? variable : 'x';
  let rhs = '';
  if (!isNearlyZero(slope)) {
    if (isNearly(slope, 1)) {
      rhs = varSymbol;
    } else if (isNearly(slope, -1)) {
      rhs = `-${varSymbol}`;
    } else {
      const slopePart = formatter(slope);
      if (!slopePart) return '';
      rhs = `${slopePart}${varSymbol}`;
    }
  }
  if (!isNearlyZero(intercept)) {
    const interceptPart = formatter(Math.abs(intercept));
    if (!interceptPart) return '';
    if (rhs) {
      rhs += ` ${intercept >= 0 ? '+' : '-'} ${interceptPart}`;
    } else {
      rhs = intercept >= 0 ? interceptPart : `-${interceptPart}`;
    }
  }
  if (!rhs) {
    rhs = '0';
  }
  return safeLhs ? `${safeLhs} = ${rhs}` : rhs;
}
function linearStr(m, b) {
  if (ADV.points.snap.enabled) {
    if (m === 0) return `y = ${fracStr(b)}`;
    const mS = m === 1 ? 'x' : m === -1 ? '-x' : `${fracStr(m)}x`;
    const bS = b === 0 ? '' : ` ${b >= 0 ? '+' : '-'} ${fracStr(Math.abs(b))}`;
    return `y = ${mS}${bS}`;
  } else {
    const f = v => toFixedTrim(v, 3);
    if (m === 0) return `y = ${f(b)}`;
    const mS = m === 1 ? 'x' : m === -1 ? '-x' : `${f(m)}x`;
    const bS = b === 0 ? '' : ` ${b >= 0 ? '+' : '-'} ${f(Math.abs(b))}`;
    return `y = ${mS}${bS}`;
  }
}

/* ===================== Asymptoter ===================== */
function detectVerticalAsymptotes(fn, A, B, N = 1000, huge = ADV.asymptote.hugeY) {
  const xs = [],
    ys = [];
  for (let i = 0; i <= N; i++) {
    const x = A + i * (B - A) / N;
    let y;
    try {
      y = fn(x);
    } catch (_) {
      y = NaN;
    }
    xs.push(x);
    ys.push(y);
  }
  const midState = (xL, xR) => {
    const m = 0.5 * (xL + xR);
    let y;
    try {
      y = fn(m);
    } catch (_) {
      y = NaN;
    }
    const blow = !Number.isFinite(y) || Math.abs(y) > huge * 2;
    return { blow, value: y };
  };
  const cand = [];
  for (let i = 1; i < ys.length; i++) {
    const xL = xs[i - 1],
      xR = xs[i],
      y0 = ys[i - 1],
      y1 = ys[i];
    const b0 = !Number.isFinite(y0) || Math.abs(y0) > huge;
    const b1 = !Number.isFinite(y1) || Math.abs(y1) > huge;
    const opp = Number.isFinite(y0) && Number.isFinite(y1) ? Math.sign(y0) !== Math.sign(y1) : false;
    const { blow: midBad, value: midVal } = midState(xL, xR);
    if (b0 && b1 && midBad) {
      const abs0 = Math.abs(y0);
      const abs1 = Math.abs(y1);
      const diffRaw = Math.abs(y1 - y0);
      const diff = Number.isFinite(diffRaw) ? diffRaw : Infinity;
      const maxMag = Math.max(Number.isFinite(abs0) ? abs0 : huge * 10, Number.isFinite(abs1) ? abs1 : huge * 10);
      const avgMagRaw = Number.isFinite(abs0) && Number.isFinite(abs1) ? (abs0 + abs1) / 2 : Infinity;
      const relChange = avgMagRaw === 0 ? Infinity : diff / avgMagRaw;
      const midAbs = Math.abs(midVal);
      const midGrowth = !Number.isFinite(midVal) || !Number.isFinite(maxMag)
        ? true
        : midAbs > maxMag * 1.25 + huge * 0.1;
      if (opp || diff > huge || relChange > 0.3 || midGrowth) {
        cand.push(0.5 * (xL + xR));
      }
    } else if ((b0 ^ b1) && midBad) {
      cand.push(0.5 * (xL + xR));
    }
  }
  const merged = [],
    tol = (B - A) / N * 4;
  cand.sort((a, b) => a - b).forEach(x => {
    if (merged.length === 0 || Math.abs(x - merged[merged.length - 1]) > tol) merged.push(x);
  });
  return merged;
}
function detectHorizontalAsymptoteInRange(fn, a, b, winFrac = 0.12, N = 600) {
  var _ADV$asymptote$trimY;
  if (!(b > a)) return null;
  const TRIM = (_ADV$asymptote$trimY = ADV.asymptote.trimY) !== null && _ADV$asymptote$trimY !== void 0 ? _ADV$asymptote$trimY : 8;
  const win = Math.max((b - a) * winFrac, (b - a) / N * 10);
  const mean = (L, R, steps = 120) => {
    let s = 0,
      c = 0;
    for (let i = 0; i <= steps; i++) {
      const x = L + i * (R - L) / steps;
      let y;
      try {
        y = fn(x);
      } catch (_) {
        y = NaN;
      }
      if (Number.isFinite(y)) {
        y = Math.max(-TRIM, Math.min(TRIM, y));
        s += y;
        c++;
      }
    }
    return c ? s / c : NaN;
  };
  const yL = mean(a, Math.min(a + win, b));
  const yR = mean(Math.max(b - win, a), b);
  if (!Number.isFinite(yL) || !Number.isFinite(yR)) return null;
  const y = 0.5 * (yL + yR);
  const tol = 0.05 * Math.max(1, Math.abs(y));
  return Math.abs(yL - y) <= tol && Math.abs(yR - y) <= tol ? y : null;
}

/* ===================== Sample features ===================== */
function sampleFeatures(fn, a, b, opts = {}) {
  var _ADV$asymptote$trimY2, _ADV$asymptote;
  const {
    includeEndVals = false,
    includeLeftEnd = includeEndVals,
    includeRightEnd = includeEndVals,
    detectAsymptotes = true,
    N = 1000
  } = opts;
  const TRIM = (_ADV$asymptote$trimY2 = (_ADV$asymptote = ADV.asymptote) === null || _ADV$asymptote === void 0 ? void 0 : _ADV$asymptote.trimY) !== null && _ADV$asymptote$trimY2 !== void 0 ? _ADV$asymptote$trimY2 : 8;
  const xs = [],
    ysRaw = [],
    ysTrim = [],
    xsFinite = [];
  let finiteXMin = Infinity,
    finiteXMax = -Infinity;
  for (let i = 0; i <= N; i++) {
    const x = a + i * (b - a) / N;
    let y;
    try {
      y = fn(x);
    } catch (_) {
      y = NaN;
    }
    xs.push(x);
    ysRaw.push(Number.isFinite(y) ? y : NaN);
    if (Number.isFinite(y)) {
      const trimmed = Math.max(-TRIM, Math.min(TRIM, y));
      ysTrim.push(trimmed);
      finiteXMin = Math.min(finiteXMin, x);
      finiteXMax = Math.max(finiteXMax, x);
      xsFinite.push(x);
    } else {
      ysTrim.push(NaN);
    }
  }

  // røtter
  const roots = [];
  for (let i = 1; i < ysTrim.length; i++) {
    const y0 = ysTrim[i - 1],
      y1 = ysTrim[i];
    if (!Number.isFinite(y0) || !Number.isFinite(y1)) continue;
    if (y0 === 0) roots.push(xs[i - 1]);
    if (y0 * y1 < 0) {
      const t = y0 / (y0 - y1);
      roots.push(xs[i - 1] + t * (xs[i] - xs[i - 1]));
    }
  }

  // y-skjæring
  let yIntercept = null;
  if (0 >= a && 0 <= b) {
    try {
      const y0 = fn(0);
      if (Number.isFinite(y0)) yIntercept = y0;
    } catch (_) {}
  }

  // ekstremal
  const extrema = [];
  for (let i = 1; i < ysRaw.length - 1; i++) {
    const y0 = ysRaw[i - 1],
      y1 = ysRaw[i],
      y2 = ysRaw[i + 1];
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(y2)) continue;
    const d1 = y1 - y0,
      d2 = y2 - y1;
    if (d1 * d2 <= 0) {
      const x0 = xs[i - 1],
        x1 = xs[i];
      const denom = y0 - 2 * y1 + y2;
      let xv;
      if (Math.abs(denom) < 1e-12) xv = x1;else {
        const h = x1 - x0;
        xv = x1 - h * (y2 - y0) / (2 * denom);
      }
      let yv;
      try {
        yv = fn(xv);
      } catch (_) {
        yv = NaN;
      }
      if (Number.isFinite(yv)) extrema.push({
        x: xv,
        y: yv
      });
    }
  }

  // endepunkter
  let endVals = [];
  if (includeLeftEnd) {
    try {
      const ya = fn(a);
      if (Number.isFinite(ya)) endVals.push({
        x: a,
        y: ya
      });
    } catch (_) {}
  }
  if (includeRightEnd) {
    try {
      const yb = fn(b);
      if (Number.isFinite(yb)) endVals.push({
        x: b,
        y: yb
      });
    } catch (_) {}
  }

  // robuste y-grenser via kvantiler
  let yVals = ysTrim.filter(Number.isFinite);
  let ymin = -5,
    ymax = 5;
  if (yVals.length) {
    yVals.sort((u, v) => u - v);
    const lo = yVals[Math.floor(0.02 * (yVals.length - 1))];
    const hi = yVals[Math.floor(0.98 * (yVals.length - 1))];
    ymin = lo;
    ymax = hi;
  }

  // asymptoter
  const vas = detectAsymptotes && ADV.asymptote.detect && ADV.asymptote.showVertical ? detectVerticalAsymptotes(fn, a, b, 1000, ADV.asymptote.hugeY) : [];
  const haGuess = detectHorizontalAsymptoteInRange(fn, a, b);
  let xQuantileLow = null;
  let xQuantileHigh = null;
  if (xsFinite.length) {
    xsFinite.sort((u, v) => u - v);
    const loIdx = Math.floor(0.02 * (xsFinite.length - 1));
    const hiIdx = Math.floor(0.98 * (xsFinite.length - 1));
    xQuantileLow = xsFinite[loIdx];
    xQuantileHigh = xsFinite[hiIdx];
  }
  const xFiniteMin = finiteXMin < Infinity ? finiteXMin : null;
  const xFiniteMax = finiteXMax > -Infinity ? finiteXMax : null;
  return {
    roots,
    extrema,
    yIntercept,
    endVals,
    ymin,
    ymax,
    vas,
    ha: haGuess,
    xFiniteMin,
    xFiniteMax,
    xQuantileLow,
    xQuantileHigh
  };
}

/* ===================== Autozoom ===================== */
function computeAutoScreenFunctions() {
  // Kun default. Ingen analyse.
  return calculateCorrectedScreen(DEFAULT_SCREEN.slice());
}

function computeAutoScreenPoints() {
  return calculateCorrectedScreen(DEFAULT_SCREEN.slice());
}

const BOARD_ASPECT_TOLERANCE = 1e-6;
let BOARD_MEASUREMENT_CACHE = { width: null, height: null, pixelRatio: null, cycle: 0 };
let BOARD_MEASUREMENT_RESET = null;
const scheduleBoardMeasurementReset = () => {
  if (BOARD_MEASUREMENT_RESET) return;
  const scheduler = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
  BOARD_MEASUREMENT_RESET = scheduler(() => {
    BOARD_MEASUREMENT_CACHE = { width: null, height: null, pixelRatio: null, cycle: BOARD_MEASUREMENT_CACHE.cycle + 1 };
    BOARD_MEASUREMENT_RESET = null;
  });
};
function getCachedBoardMeasurement() {
  if (!BOARD_MEASUREMENT_CACHE) return null;
  const { width, height, pixelRatio } = BOARD_MEASUREMENT_CACHE;
  if (!(width > 0 && height > 0 && Number.isFinite(pixelRatio))) {
    return null;
  }
  return BOARD_MEASUREMENT_CACHE;
}
function measureBoardDimensions() {
  const cached = getCachedBoardMeasurement();
  if (cached) return cached;
  const board = typeof document !== 'undefined' ? document.getElementById('board') : null;
  const cssWidth = board ? board.clientWidth : 800;
  const cssHeight = board ? board.clientHeight : 800;
  const pixelRatio = cssWidth > 0 && cssHeight > 0 ? cssWidth / cssHeight : null;
  BOARD_MEASUREMENT_CACHE = { width: cssWidth, height: cssHeight, pixelRatio, cycle: BOARD_MEASUREMENT_CACHE.cycle };
  scheduleBoardMeasurementReset();
  return BOARD_MEASUREMENT_CACHE;
}
function ratiosMatch(a, b, tolerance = BOARD_ASPECT_TOLERANCE) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return Math.abs(a - b) <= tolerance * scale;
}

/**
 * Hovedhjernen for utsnitt.
 * Tar inn et ønsket utsnitt og korrigerer det basert på:
 * 1. Kvadrant 1-regler (C)
 * 2. Aspekt-ratio (Lås 1:1) (A, B, C)
 */
function calculateCorrectedScreen(requestedScreen) {
  // Sikre at vi har gyldige tall, ellers bruk default
  let base = Array.isArray(requestedScreen) && requestedScreen.length === 4 && requestedScreen.every(Number.isFinite)
    ? requestedScreen.slice(0, 4)
    : DEFAULT_SCREEN.slice(0, 4);

  let [xmin, xmax, ymin, ymax] = base;

  // --- REGEL C: KUN 1. KVADRANT ---
  if (ADV.firstQuadrant) {
    // Tving start til -0.5 for å vise aksene, men skjule det meste av negativ side.
    const PADDING = 0.5;
    
    // Beregn bredde/høyde før vi flytter, slik at vi beholder "zoomen" brukeren ba om
    let w = xmax - xmin;
    let h = ymax - ymin;
    
    // Hvis brukeren har skrevet inn ugyldige tall (f.eks min > max), fiks det
    if (w <= 0) w = 10;
    if (h <= 0) h = 10;

    xmin = -PADDING;
    ymin = -PADDING;
    xmax = xmin + w;
    ymax = ymin + h;
  }

  // --- REGEL A & B: LÅS AKSENE 1:1 ---
  // Dette må skje ETTER at vi har bestemt xmin/ymin (ankeret)
  if (ADV.lockAspect) { // Sjekker om "Lås aksene 1:1" er true
    const width = xmax - xmin;
    const height = ymax - ymin;
    const worldRatio = width / height;       // Matematisk forhold

    if (!(width > 0 && height > 0)) {
      return [xmin, xmax, ymin, ymax];
    }

    const cached = getCachedBoardMeasurement();
    if (cached && ratiosMatch(worldRatio, cached.pixelRatio)) {
      return [xmin, xmax, ymin, ymax];
    }

    const measurement = measureBoardDimensions();
    if (!(measurement && measurement.width > 0 && measurement.height > 0 && Number.isFinite(measurement.pixelRatio))) {
      return [xmin, xmax, ymin, ymax];
    }

    const pixRatio = measurement.pixelRatio;   // Fysisk forhold
    if (ratiosMatch(worldRatio, pixRatio)) {
      return [xmin, xmax, ymin, ymax];
    }

    // Hvis verden er "smalere" enn skjermen, må vi øke bredden (x)
    if (worldRatio < pixRatio) {
      const newWidth = height * pixRatio;
      const diff = newWidth - width;

      if (ADV.firstQuadrant) {
         // I 1. kvadrant: Utvid KUN mot høyre (endre xmax)
         xmax = xmin + newWidth;
      } else {
         // Normalt: Utvid til begge sider (sentrert)
         xmin -= diff / 2;
         xmax += diff / 2;
      }
    }
    // Hvis verden er "flatere" enn skjermen, må vi øke høyden (y)
    else if (worldRatio > pixRatio) {
      const newHeight = width / pixRatio;
      const diff = newHeight - height;

      if (ADV.firstQuadrant) {
         // I 1. kvadrant: Utvid KUN oppover (endre ymax)
         ymax = ymin + newHeight;
      } else {
         // Normalt: Utvid til begge sider (sentrert)
         ymin -= diff / 2;
         ymax += diff / 2;
      }
    }
  }

  return [xmin, xmax, ymin, ymax];
}

const toBB = scr => [scr[0], scr[3], scr[1], scr[2]];
function fromBoundingBox(bb) {
  if (!Array.isArray(bb) || bb.length !== 4) return null;
  const [xmin, ymax, xmax, ymin] = bb;
  if (![xmin, xmax, ymin, ymax].every(Number.isFinite)) {
    return null;
  }
  return [xmin, xmax, ymin, ymax];
}
function screenSupportsLockAspect(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return false;
  const [xmin, xmax, ymin, ymax] = screen;
  if (![xmin, xmax, ymin, ymax].every(Number.isFinite)) return false;
  const width = Math.max(1e-9, xmax - xmin);
  const height = Math.max(1e-9, ymax - ymin);
  if (!(width > 0 && height > 0)) return false;
  const diff = Math.abs(width - height);
  const scale = Math.max(Math.abs(width), Math.abs(height), 1);
  return diff <= 1e-6 * scale;
}
function screenSupportsFirstQuadrant(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return false;
  const xmin = screen[0];
  const ymin = screen[2];
  if (!(Number.isFinite(xmin) && Number.isFinite(ymin))) return false;
  const EPS = 1e-9;
  return xmin >= -EPS && ymin >= -EPS;
}

/* ===================== Init JSXGraph ===================== */
function initialScreen() {
  const hasStoredScreen = Array.isArray(ADV.screen) && ADV.screen.length === 4;
  const rawScreen = hasStoredScreen ? ADV.screen : DEFAULT_SCREEN;
  const normalized = calculateCorrectedScreen(rawScreen);
  rememberScreenState(normalized, 'manual');
  ADV.screen = normalized.slice(0, 4);
  return normalized;
}
function syncSimpleFromWindow() {
  if (typeof window !== 'undefined' && typeof window.SIMPLE !== 'undefined') {
    appState.simple.value = window.SIMPLE;
  } else if (typeof window !== 'undefined') {
    window.SIMPLE = appState.simple.value;
  }
}
function destroyBoard() {
  resetViewChangeScheduling();
  if (appState.board) {
    try {
      var _brd$off, _brd;
      (_brd$off = (_brd = appState.board).off) === null || _brd$off === void 0 || _brd$off.call(_brd, 'boundingbox', updateAfterViewChange);
    } catch (_) {}
    try {
      var _brd$stopResizeObser, _brd2;
      (_brd$stopResizeObser = (_brd2 = appState.board).stopResizeObserver) === null || _brd$stopResizeObser === void 0 ? void 0 : _brd$stopResizeObser.call(_brd2);
    } catch (_) {}
    try {
      if (appState.axes.customTicks.x) {
        appState.board.removeObject(appState.axes.customTicks.x);
      }
      if (appState.axes.customTicks.y) {
        appState.board.removeObject(appState.axes.customTicks.y);
      }
    } catch (_) {}
    try {
      const jxg = getJXG();
      if (jxg && jxg.JSXGraph && typeof jxg.JSXGraph.freeBoard === 'function') {
        jxg.JSXGraph.freeBoard(appState.board);
      }
    } catch (_) {}
  }
  appState.board = null;
  appState.axes.x = null;
  appState.axes.y = null;
  appState.axes.labels.x = null;
  appState.axes.labels.y = null;
  resetAxisLabelState('x');
  resetAxisLabelState('y');
  appState.axes.arrows.x = null;
  appState.axes.arrows.y = null;
  appState.axes.customTicks.x = null;
  appState.axes.customTicks.y = null;
  appState.grid.vertical = [];
  appState.grid.horizontal = [];
  appState.graphs = [];
  appState.points.A = null;
  appState.points.B = null;
  appState.points.moving = [];
  START_SCREEN = null;
}
function applyAxisStyles() {
  if (!appState.board || typeof ADV === 'undefined' || !ADV || !ADV.axis || !ADV.axis.style) return;
  const stroke = resolveAxisStrokeColor();
  if (stroke) {
    ADV.axis.style.stroke = stroke;
  }
  ['x', 'y'].forEach(ax => {
    appState.board.defaultAxes[ax].setAttribute({
      withLabel: false,
      strokeColor: ADV.axis.style.stroke,
      strokeWidth: ADV.axis.style.width,
      highlight: false,
      highlightStrokeColor: ADV.axis.style.stroke,
      highlightStrokeWidth: ADV.axis.style.width,
      firstArrow: false,
      lastArrow: false
    });
    if (typeof appState.board.defaultAxes[ax].setHighlight === 'function') {
      appState.board.defaultAxes[ax].setHighlight(false);
    }
  });
  updateAxisArrows();
}

function updateAxisThemeStyling() {
  if (typeof ADV === 'undefined' || !ADV || !ADV.axis || !ADV.axis.style) return;
  const stroke = resolveAxisStrokeColor();
  if (stroke) {
    ADV.axis.style.stroke = stroke;
  }
  applyAxisStyles();
  placeAxisNames();
  if (appState.board && typeof appState.board.update === 'function') {
    appState.board.update();
  }
}
function applyTickSettings() {
  if (!appState.axes.x || !appState.axes.y) return;
  const showNumbers = !!(ADV.axis && ADV.axis.ticks && ADV.axis.ticks.showNumbers);
  const showGrid = !!(ADV.axis && ADV.axis.grid && ADV.axis.grid.show);
  const showTicks = showNumbers || showGrid;
  if (!ADV.axis.forceIntegers) {
    if (appState.axes.customTicks.x) {
      try {
        appState.board.removeObject(appState.axes.customTicks.x);
      } catch (_) {}
      appState.axes.customTicks.x = null;
    }
    if (appState.axes.customTicks.y) {
      try {
        appState.board.removeObject(appState.axes.customTicks.y);
      } catch (_) {}
      appState.axes.customTicks.y = null;
    }
    appState.axes.x.defaultTicks.setAttribute({
      visible: showTicks,
      drawLabels: showNumbers
    });
    appState.axes.y.defaultTicks.setAttribute({
      visible: showTicks,
      drawLabels: showNumbers
    });
    return;
  }
  const tickBase = {
    drawLabels: showNumbers,
    precision: ADV.axis.grid.labelPrecision,
    visible: showTicks
  };
  const labelBase = {
    fontSize: ADV.axis.grid.fontSize,
    visible: showNumbers
  };
  const xOpts = {
    ...tickBase,
    ticksDistance: +ADV.axis.grid.majorX || 1,
    minorTicks: 0,
    strokeColor: '#666666',
    strokeOpacity: 0.25,
    label: {
      ...labelBase,
      display: 'internal',
      anchorX: 'middle',
      anchorY: 'top',
      offset: [0, -8]
    }
  };
  const yOpts = {
    ...tickBase,
    ticksDistance: +ADV.axis.grid.majorY || 1,
    minorTicks: 0,
    strokeColor: '#666666',
    strokeOpacity: 0.25,
    label: {
      ...labelBase,
      display: 'internal',
      anchorX: 'right',
      anchorY: 'middle',
      offset: [-8, 0]
    }
  };
  appState.axes.x.defaultTicks.setAttribute({
    ...tickBase,
    visible: false
  });
  appState.axes.y.defaultTicks.setAttribute({
    ...tickBase,
    visible: false
  });
  if (!appState.axes.customTicks.x || appState.axes.customTicks.x.board !== appState.board) {
    appState.axes.customTicks.x = appState.board.create('ticks', [appState.axes.x, xOpts.ticksDistance], xOpts);
  } else {
    appState.axes.customTicks.x.setAttribute(xOpts);
  }
  if (!appState.axes.customTicks.y || appState.axes.customTicks.y.board !== appState.board) {
    appState.axes.customTicks.y = appState.board.create('ticks', [appState.axes.y, yOpts.ticksDistance], yOpts);
  } else {
    appState.axes.customTicks.y.setAttribute(yOpts);
  }
  updateCustomTickSpacing();
}

const MAX_TICKS_PER_AXIS = 40;
function niceTickStep(span, maxTicks) {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / Math.max(1, maxTicks);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const pow10 = Math.pow(10, exponent);
  const fraction = raw / pow10;
  let niceFraction;
  if (fraction <= 1) {
    niceFraction = 1;
  } else if (fraction <= 2) {
    niceFraction = 2;
  } else if (fraction <= 5) {
    niceFraction = 5;
  } else {
    niceFraction = 10;
  }
  return niceFraction * pow10;
}
function computeTickSpacing(base, span) {
  const safeBase = Number.isFinite(base) && base > 1e-9 ? base : 1;
  if (!Number.isFinite(span) || span <= 0) return safeBase;
  const nice = niceTickStep(span, MAX_TICKS_PER_AXIS);
  return Math.max(safeBase, nice);
}
function shouldLockForceTicks(screen) {
  if (!Array.isArray(screen) || screen.length !== 4) return false;
  const spanX = Math.abs(screen[1] - screen[0]);
  const spanY = Math.abs(screen[3] - screen[2]);
  const stepX = Math.abs(+ADV.axis.grid.majorX) > 1e-9 ? Math.abs(+ADV.axis.grid.majorX) : 1;
  const stepY = Math.abs(+ADV.axis.grid.majorY) > 1e-9 ? Math.abs(+ADV.axis.grid.majorY) : 1;
  const ticksX = Number.isFinite(spanX) ? spanX / stepX : Infinity;
  const ticksY = Number.isFinite(spanY) ? spanY / stepY : Infinity;
  return ticksX > FORCE_TICKS_AUTO_DISABLE_LIMIT || ticksY > FORCE_TICKS_AUTO_DISABLE_LIMIT;
}
function updateCustomTickSpacing() {
  if (!appState.board) return;
  const bb = appState.board.getBoundingBox();
  if (!Array.isArray(bb) || bb.length !== 4) return;
  const [xmin, ymax, xmax, ymin] = bb;
  if (appState.axes.customTicks.x) {
    const spanX = Math.abs(xmax - xmin);
    const spacingX = computeTickSpacing(+ADV.axis.grid.majorX, spanX);
    appState.axes.customTicks.x.setAttribute({
      ticksDistance: spacingX
    });
    if (typeof appState.axes.customTicks.x.fullUpdate === 'function') {
      appState.axes.customTicks.x.fullUpdate();
    }
  }
  if (appState.axes.customTicks.y) {
    const spanY = Math.abs(ymax - ymin);
    const spacingY = computeTickSpacing(+ADV.axis.grid.majorY, spanY);
    appState.axes.customTicks.y.setAttribute({
      ticksDistance: spacingY
    });
    if (typeof appState.axes.customTicks.y.fullUpdate === 'function') {
      appState.axes.customTicks.y.fullUpdate();
    }
  }
}
function initBoard() {
  if (!START_SCREEN) {
    START_SCREEN = initialScreen();
  }
  const jxg = getJXG();
  if (!jxg || !jxg.JSXGraph || typeof jxg.JSXGraph.initBoard !== 'function') {
    appState.board = null;
    return;
  }
  appState.board = jxg.JSXGraph.initBoard('board', {
    boundingbox: toBB(START_SCREEN),
    axis: true,
    grid: ADV.axis.grid.show && !ADV.axis.forceIntegers,
    showNavigation: false,
    showCopyright: false,
    pan: {
      enabled: false, // Låst: Ingen panorering
      needShift: false
    },
    zoom: {
      enabled: false, // Låst: Ingen zoom
      wheel: false,
      needShift: false
    }
  });
  // Drag forblir aktivt slik at punkter kan flyttes; bakgrunnen er allerede låst via pan/zoom-innstillingene.
  appState.axes.x = appState.board.defaultAxes.x;
  appState.axes.y = appState.board.defaultAxes.y;
  applyAxisStyles();
  applyTickSettings();
  appState.axes.labels.x = null;
  appState.axes.labels.y = null;
  placeAxisNames();
  appState.grid.vertical = [];
  appState.grid.horizontal = [];
}

/* ---------- akser og navn ---------- */
function axisArrowLengthX() {
  if (!appState.board) return 0;
  const [xmin, , xmax] = appState.board.getBoundingBox();
  const span = xmax - xmin;
  if (!Number.isFinite(span) || span === 0) return 0;
  const px = Math.max(1, appState.board.canvasWidth || 1);
  const pixelLength = AXIS_ARROW_PIXEL_THICKNESS * AXIS_ARROW_ASPECT_RATIO;
  const len = (span / px) * pixelLength;
  return Math.max(len, span * 0.01);
}

function axisArrowHalfHeight() {
  if (!appState.board) return 0;
  const [, ymax, , ymin] = appState.board.getBoundingBox();
  const span = ymax - ymin;
  if (!Number.isFinite(span) || span === 0) return 0;
  const px = Math.max(1, appState.board.canvasHeight || 1);
  const half = (span / px) * (AXIS_ARROW_PIXEL_THICKNESS / 2);
  return Math.max(half, span * 0.01);
}

function axisArrowLengthY() {
  if (!appState.board) return 0;
  const [, ymax, , ymin] = appState.board.getBoundingBox();
  const span = ymax - ymin;
  if (!Number.isFinite(span) || span === 0) return 0;
  const px = Math.max(1, appState.board.canvasHeight || 1);
  const pixelLength = AXIS_ARROW_PIXEL_THICKNESS * AXIS_ARROW_ASPECT_RATIO;
  const len = (span / px) * pixelLength;
  return Math.max(len, span * 0.01);
}

function axisArrowHalfWidth() {
  if (!appState.board) return 0;
  const [xmin, , xmax] = appState.board.getBoundingBox();
  const span = xmax - xmin;
  if (!Number.isFinite(span) || span === 0) return 0;
  const px = Math.max(1, appState.board.canvasWidth || 1);
  const half = (span / px) * (AXIS_ARROW_PIXEL_THICKNESS / 2);
  return Math.max(half, span * 0.01);
}

function ensureAxisOverlayVisibility(image) {
  if (!image || !appState.board || !appState.board.renderer) return;
  try {
    image.setAttribute({ visible: true });
  } catch (_) {}
  const node = image.rendNodeImage || image.rendNode || null;
  const root = appState.board.renderer.svgRoot || null;
  if (node && root && node.parentNode !== root) {
    root.appendChild(node);
  }
}

function ensureAxisArrowShapes() {
  if (!appState.board) return;
  const baseOptions = {
    fixed: true,
    highlight: false,
    layer: 41,
    cssStyle: 'pointer-events:none;'
  };
  const axisColor = ADV.axis.style.stroke;
  if (!appState.axes.arrows.x) {
    appState.axes.arrows.x = appState.board.create(
      'image',
      [
        axisArrowSvgData('x', axisColor),
        [
          () => (appState.board ? appState.board.getBoundingBox()[2] - axisArrowLengthX() : 0),
          () => -axisArrowHalfHeight()
        ],
        [
          () => axisArrowLengthX(),
          () => axisArrowHalfHeight() * 2
        ]
      ],
      baseOptions
    );
    tagAxisArrowNode(appState.axes.arrows.x, 'x');
  }
  if (!appState.axes.arrows.y) {
    appState.axes.arrows.y = appState.board.create(
      'image',
      [
        axisArrowSvgData('y', axisColor),
        [
          () => -axisArrowHalfWidth(),
          () => (appState.board ? appState.board.getBoundingBox()[1] - axisArrowLengthY() : 0)
        ],
        [
          () => axisArrowHalfWidth() * 2,
          () => axisArrowLengthY()
        ]
      ],
      baseOptions
    );
    tagAxisArrowNode(appState.axes.arrows.y, 'y');
  }
}

function updateAxisArrows() {
  if (!appState.board) return;
  ensureAxisArrowShapes();
  const axisColor = ADV.axis.style.stroke;
  if (appState.axes.arrows.x) {
    updateAxisArrowImage(appState.axes.arrows.x, axisArrowSvgData('x', axisColor), axisArrowLengthX(), axisArrowHalfHeight() * 2);
    tagAxisArrowNode(appState.axes.arrows.x, 'x');
    ensureAxisOverlayVisibility(appState.axes.arrows.x);
  }
  if (appState.axes.arrows.y) {
    updateAxisArrowImage(appState.axes.arrows.y, axisArrowSvgData('y', axisColor), axisArrowHalfWidth() * 2, axisArrowLengthY());
    tagAxisArrowNode(appState.axes.arrows.y, 'y');
    ensureAxisOverlayVisibility(appState.axes.arrows.y);
  }
}

function axisLabelParts(axisKey) {
  const fallback = axisKey === 'y' ? 'y' : 'x';
  const raw = axisKey === 'x' ? ADV.axis.labels.x : ADV.axis.labels.y;
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  const label = trimmed || fallback;
  const match = label.match(/^([^()]+?)\s*\(([^)]*)\)\s*$/);
  const candidateVar = match && match[1] ? match[1].trim() : '';
  const candidateUnit = match && match[2] ? match[2].trim() : '';
  if (candidateVar && candidateUnit && candidateVar.toLowerCase() === fallback) {
    return { variable: candidateVar, unit: candidateUnit };
  }
  return { variable: label, unit: null };
}

function axisLabelText(axisKey) {
  const { variable, unit } = axisLabelParts(axisKey);
  return unit ? `${variable}, ${unit}` : variable;
}

function axisLabelLatex(axisKey) {
  const { variable, unit } = axisLabelParts(axisKey);
  const variableLatex = convertExpressionToLatex(variable) || `\\text{${escapeKatexPlainText(variable)}}`;
  const formatUnitLatex = (rawUnit) => {
    if (!rawUnit) return '';
    const latex = convertExpressionToLatex(rawUnit);
    if (!latex) {
      return `\\text{${escapeKatexPlainText(rawUnit)}}`;
    }
    const needsUprightText = /[A-Za-z\u00c6\u00d8\u00c5\u00e6\u00f8\u00e5]/.test(latex);
    return needsUprightText ? `\\mathrm{${latex}}` : latex;
  };
  const unitLatex = formatUnitLatex(unit);
  if (unitLatex) {
    return `${variableLatex},\\ ${unitLatex}`;
  }
  return variableLatex;
}

function axisLabelChip(axisKey) {
  const color = ADV.axis.style.stroke;
  const fontSizeRaw = Number.parseFloat(ADV.axis.labels.fontSize);
  const fontSize = Number.isFinite(fontSizeRaw) ? fontSizeRaw : 15;
  const styleTokens = [
    `--graf-axis-label-text:${color}`,
    `--graf-axis-label-font-size:${fontSize}px`
  ];
  const latex = axisLabelLatex(axisKey);
  const latexHtml = latex ? renderLatexToHtml(latex) : '';
  const fallbackText = axisLabelText(axisKey);
  const content = latexHtml || escapeHtml(fallbackText);
  return `<span class="graf-axis-label graf-axis-label--${axisKey}" style="${styleTokens.join(';')};">${content}</span>`;
}

function axisLabelState(axisKey) {
  if (axisKey === 'y') return AXIS_LABEL_STATE.y;
  return AXIS_LABEL_STATE.x;
}

function resetAxisLabelState(axisKey) {
  const state = axisLabelState(axisKey);
  if (!state) return;
  state.manual = false;
  state.position = null;
}

function rememberAxisLabelPosition(axisKey, pos, manualOverride) {
  const state = axisLabelState(axisKey);
  if (!state) return;
  if (manualOverride != null) {
    state.manual = !!manualOverride;
    if (!state.manual && !pos) {
      state.position = null;
      return;
    }
  }
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
    state.position = [pos.x, pos.y];
  }
  syncAxisLabelStateToExample();
}

function manualAxisLabelPosition(axisKey) {
  const state = axisLabelState(axisKey);
  if (!state || !state.manual) return null;
  const pos = state.position;
  if (!Array.isArray(pos) || pos.length < 2) return null;
  const [x, y] = pos;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function hydrateAxisLabelStateFromExample() {
  if (!EXAMPLE_STATE || typeof EXAMPLE_STATE !== 'object') return;
  const positions = EXAMPLE_STATE.axisLabelPositions && typeof EXAMPLE_STATE.axisLabelPositions === 'object'
    ? EXAMPLE_STATE.axisLabelPositions
    : null;
  if (!positions) return;
  ['x', 'y'].forEach(axisKey => {
    const source = positions[axisKey];
    if (!source || typeof source !== 'object') return;
    const state = axisLabelState(axisKey);
    if (!state) return;
    state.manual = !!source.manual;
    state.position = Array.isArray(source.position) && source.position.length >= 2
      ? source.position.slice(0, 2)
      : null;
  });
}

const AXIS_LABEL_STATE = (() => {
  const resolve = axisKey => {
    const fallback = { manual: false, position: null };
    const source = EXAMPLE_STATE && EXAMPLE_STATE.axisLabelPositions && EXAMPLE_STATE.axisLabelPositions[axisKey];
    if (!source || typeof source !== 'object') return { ...fallback };
    const pos = Array.isArray(source.position) && source.position.length >= 2
      ? source.position.slice(0, 2)
      : null;
    return {
      manual: !!source.manual,
      position: pos
    };
  };
  return {
    x: resolve('x'),
    y: resolve('y')
  };
})();

function syncAxisLabelStateToExample() {
  if (!EXAMPLE_STATE || typeof EXAMPLE_STATE !== 'object') return;
  EXAMPLE_STATE.axisLabelPositions = {
    x: {
      manual: !!(AXIS_LABEL_STATE.x && AXIS_LABEL_STATE.x.manual),
      position: AXIS_LABEL_STATE.x && Array.isArray(AXIS_LABEL_STATE.x.position)
        ? AXIS_LABEL_STATE.x.position.slice(0, 2)
        : null
    },
    y: {
      manual: !!(AXIS_LABEL_STATE.y && AXIS_LABEL_STATE.y.manual),
      position: AXIS_LABEL_STATE.y && Array.isArray(AXIS_LABEL_STATE.y.position)
        ? AXIS_LABEL_STATE.y.position.slice(0, 2)
        : null
    }
  };
}

function computeAxisLabelWorldPosition(axisKey) {
  if (!appState.board) return null;
  const manual = manualAxisLabelPosition(axisKey);
  if (manual) return manual;
  const box = appState.board.getBoundingBox();
  if (!Array.isArray(box) || box.length < 4) return null;
  const [xmin, ymax, xmax, ymin] = box;
  const rx = xmax - xmin;
  const ry = ymax - ymin;
  const canvasWidth = Math.max(1, appState.board.canvasWidth || 1);
  const canvasHeight = Math.max(1, appState.board.canvasHeight || 1);
  const offsetX = Number.isFinite(rx) ? (rx / canvasWidth) * AXIS_LABEL_OFFSET_PX : 0;
  const offsetY = Number.isFinite(ry) ? (ry / canvasHeight) * AXIS_LABEL_OFFSET_PX : 0;
  if (axisKey === 'x') {
    const arrowHalfHeight = axisArrowHalfHeight();
    const x = Number.isFinite(xmax) ? xmax : 0;
    const y = ((Number.isFinite(arrowHalfHeight) ? arrowHalfHeight : 0) + offsetY);
    const pos = { x, y };
    rememberAxisLabelPosition(axisKey, pos, false);
    return pos;
  }
  const arrowHalfWidth = axisArrowHalfWidth();
  const x = ((Number.isFinite(arrowHalfWidth) ? arrowHalfWidth : 0) + offsetX);
  const y = Number.isFinite(ymax) ? ymax : 0;
  const pos = { x, y };
  rememberAxisLabelPosition(axisKey, pos, false);
  return pos;
}

function worldToScreenPoint(worldPoint) {
  if (!worldPoint || !appState.board) return null;
  const box = appState.board.getBoundingBox();
  if (!Array.isArray(box) || box.length < 4) return null;
  const [xmin, ymax, xmax, ymin] = box;
  const rx = xmax - xmin;
  const ry = ymax - ymin;
  if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx === 0 || ry === 0) return null;
  const width = Math.max(1, appState.board.canvasWidth || 1);
  const height = Math.max(1, appState.board.canvasHeight || 1);
  const sx = ((worldPoint.x - xmin) / rx) * width;
  const sy = ((ymax - worldPoint.y) / ry) * height;
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return null;
  return { x: sx, y: sy };
}

function appendAxisLabelsToSvgClone(node) {
  if (!node || typeof node.ownerDocument === 'undefined') return;
  const doc = node.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;
  const fontSizeRaw = Number.parseFloat(ADV.axis.labels.fontSize);
  const fontSize = Number.isFinite(fontSizeRaw) ? fontSizeRaw : 15;
  const color = normalizeColorValue(ADV.axis.style && ADV.axis.style.stroke ? ADV.axis.style.stroke : '#111827') || '#111827';
  const makeTextNode = (axisKey) => {
    const label = axisLabelText(axisKey);
    if (!label) return null;
    const worldPos = computeAxisLabelWorldPosition(axisKey);
    const screenPos = worldToScreenPoint(worldPos);
    if (!screenPos) return null;
    const latex = convertExpressionToLatex(label) || label;
    const katexHtml = latex ? renderLatexToHtml(latex) : '';
    if (katexHtml && ensureKatexStyleInSvg(node)) {
      const katexNode = createKatexExportLabel(doc, katexHtml, screenPos, {
        color,
        fontSize,
        alignH: axisKey === 'x' ? 'end' : 'start',
        alignV: axisKey === 'x' ? 'after-edge' : 'before-edge'
      });
      if (katexNode) return katexNode;
    }
    const textEl = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', String(screenPos.x));
    textEl.setAttribute('y', String(screenPos.y));
    textEl.setAttribute('fill', color);
    textEl.setAttribute('font-size', `${fontSize}`);
    textEl.setAttribute('font-family', 'Inter, "Segoe UI", system-ui, sans-serif');
    textEl.setAttribute('font-style', 'italic');
    textEl.textContent = label;
    if (axisKey === 'x') {
      textEl.setAttribute('text-anchor', 'end');
      textEl.setAttribute('dominant-baseline', 'text-after-edge');
    } else {
      textEl.setAttribute('text-anchor', 'start');
      textEl.setAttribute('dominant-baseline', 'text-before-edge');
    }
    textEl.setAttribute('pointer-events', 'none');
    return textEl;
  };
  const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('data-export-axis-labels', '');
  const xLabel = makeTextNode('x');
  const yLabel = makeTextNode('y');
  if (xLabel) group.appendChild(xLabel);
  if (yLabel) group.appendChild(yLabel);
  if (group.childNodes.length) {
    node.appendChild(group);
  }
}

function curveLabelExportText(label) {
  if (!label) return '';
  const primary = typeof label._plainText === 'string' ? label._plainText : '';
  if (primary && primary.trim()) return primary.trim();
  const secondary = typeof label.plaintext === 'string' ? label.plaintext : '';
  if (secondary && secondary.trim()) return secondary.trim();
  const fallback = label.rendNodeText && label.rendNodeText.textContent ? label.rendNodeText.textContent : '';
  return fallback && fallback.trim() ? fallback.trim() : '';
}

function appendCurveLabelsToSvgClone(node) {
  if (!node || !ADV.curveName || !ADV.curveName.show) return;
  if (!Array.isArray(appState.graphs) || appState.graphs.length === 0) return;
  const doc = node.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;
  const fontSizeRaw = Number.parseFloat(ADV.curveName.fontSize);
  const fontSize = Number.isFinite(fontSizeRaw) ? fontSizeRaw : 15;
  const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.setAttribute('data-export-curve-labels', '');
  appState.graphs.forEach(g => {
    const label = g && g.labelElement;
    if (!label || label.visProp && label.visProp.visible === false) return;
    const textContent = curveLabelExportText(label);
    if (!textContent) return;
    const x = typeof label.X === 'function' ? Number(label.X()) : NaN;
    const y = typeof label.Y === 'function' ? Number(label.Y()) : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const screenPos = worldToScreenPoint({ x, y });
    if (!screenPos) return;
    const latex = convertExpressionToLatex(textContent) || formatPointLabelLatex(textContent);
    const katexHtml = latex ? renderLatexToHtml(latex) : '';
    if (katexHtml && ensureKatexStyleInSvg(node)) {
      const katexNode = createKatexExportLabel(doc, katexHtml, screenPos, {
        color: normalizeColorValue(g && g.color) || '#111827',
        fontSize,
        alignH: 'start',
        alignV: 'middle'
      });
      if (katexNode) {
        group.appendChild(katexNode);
        return;
      }
    }
    const textEl = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    textEl.setAttribute('x', String(screenPos.x));
    textEl.setAttribute('y', String(screenPos.y));
    textEl.setAttribute('fill', normalizeColorValue(g && g.color) || '#111827');
    textEl.setAttribute('font-size', `${fontSize}`);
    textEl.setAttribute('font-family', 'Inter, "Segoe UI", system-ui, sans-serif');
    textEl.setAttribute('font-style', 'italic');
    textEl.setAttribute('dominant-baseline', 'middle');
    textEl.setAttribute('text-anchor', 'start');
    textEl.setAttribute('pointer-events', 'none');
    textEl.textContent = textContent;
    group.appendChild(textEl);
  });
  if (group.childNodes.length) {
    node.appendChild(group);
  }
}

function placeAxisNames() {
  if (!appState.board) return;
  const xWorld = computeAxisLabelWorldPosition('x');
  const yWorld = computeAxisLabelWorldPosition('y');
  const xLabelPos = [Number.isFinite(xWorld === null || xWorld === void 0 ? void 0 : xWorld.x) ? xWorld.x : 0, Number.isFinite(xWorld === null || xWorld === void 0 ? void 0 : xWorld.y) ? xWorld.y : 0];
  const yLabelPos = [Number.isFinite(yWorld === null || yWorld === void 0 ? void 0 : yWorld.x) ? yWorld.x : 0, Number.isFinite(yWorld === null || yWorld === void 0 ? void 0 : yWorld.y) ? yWorld.y : 0];
  const axisLabelCss = 'user-select:none;cursor:move;touch-action:none;';
  if (!appState.axes.labels.x) {
    appState.axes.labels.x = appState.board.create('text', [...xLabelPos, () => axisLabelChip('x')], {
      display: 'html',
      anchorX: 'right',
      anchorY: 'bottom',
      fixed: true,
      layer: 40,
      highlight: false,
      cssStyle: axisLabelCss
    });
  } else {
    appState.axes.labels.x.setAttribute({
      cssStyle: axisLabelCss,
      highlight: false,
      anchorX: 'right'
    });
  }
  if (!appState.axes.labels.y) {
    appState.axes.labels.y = appState.board.create('text', [...yLabelPos, () => axisLabelChip('y')], {
      display: 'html',
      anchorX: 'left',
      anchorY: 'top',
      fixed: true,
      layer: 40,
      highlight: false,
      cssStyle: axisLabelCss
    });
  } else {
    appState.axes.labels.y.setAttribute({
      cssStyle: axisLabelCss,
      highlight: false
    });
  }
  if (appState.axes.labels.x) {
    appState.axes.labels.x.setText(() => axisLabelChip('x'));
  }
  if (appState.axes.labels.y) {
    appState.axes.labels.y.setText(() => axisLabelChip('y'));
  }
  appState.axes.labels.x.moveTo(xLabelPos);
  appState.axes.labels.y.moveTo(yLabelPos);
  clampLabelToView(appState.axes.labels.x, AXIS_LABEL_MARGINS);
  clampLabelToView(appState.axes.labels.y, AXIS_LABEL_MARGINS);
  rememberAxisLabelPosition('x', { x: appState.axes.labels.x.X(), y: appState.axes.labels.x.Y() }, !!manualAxisLabelPosition('x'));
  rememberAxisLabelPosition('y', { x: appState.axes.labels.y.X(), y: appState.axes.labels.y.Y() }, !!manualAxisLabelPosition('y'));
  makeAxisLabelDraggable('x', appState.axes.labels.x);
  makeAxisLabelDraggable('y', appState.axes.labels.y);
}

/* ====== Lås 1:1 når lockAspect===true,
   eller når lockAspect er null og majorX===majorY ====== */
function shouldLockAspect() {
  if (ADV.lockAspect === true) return true;
  if (ADV.lockAspect === false) return false;
  const sx = +ADV.axis.grid.majorX || 1;
  const sy = +ADV.axis.grid.majorY || 1;
  return Math.abs(sx - sy) < 1e-12;
}
let enforcing = false;
function enforceAspectStrict() {
  if (!appState.board || !shouldLockAspect() || enforcing) return;
  enforcing = true;
  try {
    let [xmin, ymax, xmax, ymin] = appState.board.getBoundingBox();
    const W = xmax - xmin;
    const H = ymax - ymin;

    if (!(W > 0 && H > 0)) return;

    const pixAR = appState.board.canvasWidth / appState.board.canvasHeight;
    if (!Number.isFinite(pixAR)) return;

    const worldAR = W / H;
    if (Math.abs(worldAR - pixAR) < 1e-3) return;

    let newW = W;
    let newH = H;

    if (worldAR > pixAR) {
      newH = W / pixAR;
    } else {
      newW = H * pixAR;
    }

    if (ADV && ADV.firstQuadrant) {
      appState.board.setBoundingBox([xmin, ymin + newH, xmin + newW, ymin], false);
    } else {
      const cx = (xmax + xmin) / 2;
      const cy = (ymax + ymin) / 2;
      appState.board.setBoundingBox([cx - newW / 2, cy + newH / 2, cx + newW / 2, cy - newH / 2], false);
    }
  } finally {
    enforcing = false;
  }
}

/* ---------- GRID (statisk) ---------- */
function rebuildGrid() {
  if (!appState.board) return;
  
  // Fjern gamle linjer
  for (const L of appState.grid.vertical) {
    try { appState.board.removeObject(L); } catch (_) {}
  }
  for (const L of appState.grid.horizontal) {
    try { appState.board.removeObject(L); } catch (_) {}
  }
  appState.grid.vertical = [];
  appState.grid.horizontal = [];

  if (!ADV.axis.forceIntegers || !ADV.axis.grid.show) {
    return;
  }

  enforceAspectStrict();
  
  const [xmin, ymax, xmax, ymin] = appState.board.getBoundingBox();
  const sx = +ADV.axis.grid.majorX > 1e-9 ? +ADV.axis.grid.majorX : 1;
  const sy = +ADV.axis.grid.majorY > 1e-9 ? +ADV.axis.grid.majorY : 1;

  // BEREGN START OG STOPP FOR HELE RUTER
  // Vi bruker ceil for start og floor for slutt for å "krympe" rutenettet inn til nærmeste hele tall
  const gridLeft = Math.ceil(xmin / sx) * sx;
  const gridRight = Math.floor(xmax / sx) * sx;
  const gridBottom = Math.ceil(ymin / sy) * sy;
  const gridTop = Math.floor(ymax / sy) * sy;

  const attrs = {
    straightFirst: false,
    straightLast: false,
    strokeColor: '#e5e7eb',
    strokeWidth: 1,
    fixed: true,
    layer: 0, // Ligger under aksene
    highlight: false,
    cssStyle: 'pointer-events:none;'
  };

  // Tegn VERTIKALE linjer (x endres, men y er låst til gridBottom/Top)
  for (let x = gridLeft; x <= gridRight + 1e-9; x += sx) {
    appState.grid.vertical.push(appState.board.create('line', [[x, gridBottom], [x, gridTop]], attrs));
  }

  // Tegn HORISONTALE linjer (y endres, men x er låst til gridLeft/Right)
  for (let y = gridBottom; y <= gridTop + 1e-9; y += sy) {
    appState.grid.horizontal.push(appState.board.create('line', [[gridLeft, y], [gridRight, y]], attrs));
  }
}

/* =================== Grafnavn-bakplate =================== */
function measureTextPx(label) {
  const tryBBox = node => {
    if (!node) return null;
    try {
      if (typeof node.getBBox === 'function') {
        const bb = node.getBBox();
        if (bb && Number.isFinite(bb.width) && Number.isFinite(bb.height)) {
          return {
            w: bb.width,
            h: bb.height
          };
        }
      }
    } catch (_) {}
    return null;
  };
  const tryRect = node => {
    if (!node) return null;
    try {
      if (typeof node.getBoundingClientRect === 'function') {
        const rect = node.getBoundingClientRect();
        if (rect && Number.isFinite(rect.width) && Number.isFinite(rect.height)) {
          return {
            w: rect.width,
            h: rect.height
          };
        }
      }
    } catch (_) {}
    return null;
  };
  const nodes = [label && label.rendNode, label && label.rendNodeText && label.rendNodeText.parentNode, label && label.rendNodeText, label && label.rendNode && label.rendNode.firstChild];
  for (const node of nodes) {
    const res = tryBBox(node);
    if (res) return res;
  }
  for (const node of nodes) {
    const res = tryRect(node);
    if (res) return res;
  }
  let fallback = '';
  if (label) {
    const primary = typeof label.plaintext === 'string' ? label.plaintext : null;
    const secondary = typeof label._plainText === 'string' ? label._plainText : null;
    fallback = primary && primary.trim() ? primary.trim() : secondary && secondary.trim() ? secondary.trim() : '';
  }
  const text = fallback || 'f(x)';
  const f = label && label.visProp && label.visProp.fontsize || ADV.curveName.fontSize;
  return {
    w: text.length * f * 0.6,
    h: f * 1.1
  };
}
function ensurePlateFor(label) {
  if (label._plate) return;
  const mkPt = (x, y) => appState.board.create('point', [x, y], {
    visible: false,
    fixed: true,
    layer: ADV.curveName.layer - 1
  });
  const p1 = mkPt(0, 0),
    p2 = mkPt(0, 0),
    p3 = mkPt(0, 0),
    p4 = mkPt(0, 0);
  appState.board.create('polygon', [p1, p2, p3, p4], {
    fillColor: ADV.curveName.plate.fill,
    fillOpacity: ADV.curveName.plate.opacity,
    borders: {
      visible: false
    },
    fixed: true,
    highlight: false,
    layer: ADV.curveName.layer - 1,
    cssStyle: 'pointer-events:none;stroke-linejoin:round;'
  });
  label._plate = {
    p1,
    p2,
    p3,
    p4
  };
}
function ensureLabelFront(label) {
  const node = label && label.rendNode;
  if (!node) return;
  const renderer = appState.board && appState.board.renderer;
  const htmlContainer = renderer && renderer.container;
  if (node.namespaceURI !== 'http://www.w3.org/2000/svg' && htmlContainer) {
    htmlContainer.appendChild(node);
    return;
  }
  if (node.parentNode) {
    node.parentNode.appendChild(node);
  }
}
function ensureCurveLabelVisibility(label) {
  if (!label || !appState.board || !appState.board.renderer) return;
  if (!ADV.curveName || (!ADV.curveName.showName && !ADV.curveName.showExpression)) return;
  try {
    label.setAttribute({ visible: true });
  } catch (_) {}
  ensureLabelFront(label);
  const node = label.rendNode || null;
  const root = appState.board.renderer.svgRoot || null;
  if (node && root && node.namespaceURI === 'http://www.w3.org/2000/svg' && node.parentNode !== root) {
    root.appendChild(node);
  }
}
function ensureGraphLabelsVisibility() {
  if (!Array.isArray(appState.graphs) || !appState.graphs.length) return;
  appState.graphs.forEach(g => {
    if (g && g.labelElement) {
      ensureCurveLabelVisibility(g.labelElement);
    }
  });
}
function updatePlate(label) {
  if (!label._plate) return;
  const [xmin, ymax, xmax, ymin] = appState.board.getBoundingBox();
  const ux = (xmax - xmin) / appState.board.canvasWidth,
    uy = (ymax - ymin) / appState.board.canvasHeight;
  const {
      w,
      h
    } = measureTextPx(label),
    pad = ADV.curveName.plate.paddingPx;
  const tx = label.X(),
    ty = label.Y();
  const ax = label.visProp && label.visProp.anchorx || 'left';
  const ay = label.visProp && label.visProp.anchory || 'middle';
  let L, R, T, B;
  if (ax === 'left') {
    L = tx - pad * ux;
    R = tx + (w + pad) * ux;
  } else if (ax === 'right') {
    L = tx - (w + pad) * ux;
    R = tx + pad * ux;
  } else {
    L = tx - (w / 2 + pad) * ux;
    R = tx + (w / 2 + pad) * ux;
  }
  if (ay === 'top') {
    T = ty + pad * uy;
    B = ty - (h + pad) * uy;
  } else if (ay === 'bottom') {
    T = ty + (h + pad) * uy;
    B = ty - pad * uy;
  } else {
    T = ty + (h / 2 + pad) * uy;
    B = ty - (h / 2 + pad) * uy;
  }
  const P = label._plate;
  P.p1.moveTo([L, T]);
  P.p2.moveTo([R, T]);
  P.p3.moveTo([R, B]);
  P.p4.moveTo([L, B]);
}
function clampLabelToView(label, marginFractions) {
  if (!label) return;
  const bb = appState.board.getBoundingBox();
  const xmin = bb[0],
    xmax = bb[2],
    ymin = bb[3],
    ymax = bb[1];
  const rawMarginX = marginFractions && Number.isFinite(marginFractions.x) ? marginFractions.x : ADV.curveName.marginFracX;
  const rawMarginY = marginFractions && Number.isFinite(marginFractions.y) ? marginFractions.y : ADV.curveName.marginFracY;
  const marginX = (xmax - xmin) * (Number.isFinite(rawMarginX) ? rawMarginX : 0);
  const marginY = (ymax - ymin) * (Number.isFinite(rawMarginY) ? rawMarginY : 0);
  const x = label.X(),
    y = label.Y();
  const xClamped = Math.min(xmax - marginX, Math.max(xmin + marginX, x));
  const yClamped = Math.min(ymax - marginY, Math.max(ymin + marginY, y));
  if (Math.abs(xClamped - x) > 1e-12 || Math.abs(yClamped - y) > 1e-12) {
    label.moveTo([xClamped, yClamped]);
  }
}
function makeAxisLabelDraggable(axisKey, label) {
  if (!label) return;
  const setup = () => {
    const node = label.rendNode;
    if (!node) return false;
    if (node._axisDragSetup) return true;
    node._axisDragSetup = true;
    node.style.pointerEvents = 'auto';
    node.style.cursor = 'move';
    node.style.touchAction = 'none';
    let dragging = false;
    let offset = [0, 0];
    const toCoords = ev => {
      try {
        const c = appState.board.getUsrCoordsOfMouse(ev);
        if (Array.isArray(c) && c.length >= 2) {
          return [c[0], c[1]];
        }
      } catch (_) {}
      return null;
    };
    const clampAndRemember = manual => {
      clampLabelToView(label, AXIS_LABEL_MARGINS);
      rememberAxisLabelPosition(axisKey, { x: label.X(), y: label.Y() }, manual);
    };
    const start = ev => {
      if (ev.button != null && ev.button !== 0) return;
      const coords = toCoords(ev);
      if (!coords) return;
      ev.preventDefault();
      ev.stopPropagation();
      dragging = true;
      rememberAxisLabelPosition(axisKey, { x: label.X(), y: label.Y() }, true);
      clampLabelToView(label, AXIS_LABEL_MARGINS);
      offset = [label.X() - coords[0], label.Y() - coords[1]];
      if (typeof node.setPointerCapture === 'function' && ev.pointerId != null) {
        try {
          node.setPointerCapture(ev.pointerId);
        } catch (_) {}
      }
    };
    const move = ev => {
      if (!dragging) return;
      const coords = toCoords(ev);
      if (!coords) return;
      ev.preventDefault();
      label.moveTo([coords[0] + offset[0], coords[1] + offset[1]]);
      clampAndRemember(true);
    };
    const end = ev => {
      if (!dragging) return;
      dragging = false;
      ev.preventDefault();
      ev.stopPropagation();
      clampAndRemember(true);
      if (typeof node.releasePointerCapture === 'function' && ev.pointerId != null) {
        try {
          node.releasePointerCapture(ev.pointerId);
        } catch (_) {}
      }
    };
    node.addEventListener('pointerdown', start);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('dblclick', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      resetAxisLabelState(axisKey);
      const pos = computeAxisLabelWorldPosition(axisKey);
      if (pos) {
        label.moveTo([pos.x, pos.y]);
      }
    });
    return true;
  };
  if (!setup()) setTimeout(() => setup(), 0);
}
function makeLabelDraggable(label, g, reposition) {
  if (!label) return;
  const setup = () => {
    const node = label.rendNode;
    if (!node) return false;
    if (node._dragSetup) return true;
    node._dragSetup = true;
    node.style.pointerEvents = 'auto';
    node.style.cursor = 'move';
    node.style.touchAction = 'none';
    let dragging = false;
    let offset = [0, 0];
    const labelIndex = Number.isInteger(g && g._labelIndex) && g._labelIndex >= 0 ? g._labelIndex : null;
    const toCoords = ev => {
      try {
        const c = appState.board.getUsrCoordsOfMouse(ev);
        if (Array.isArray(c) && c.length >= 2) {
          return [c[0], c[1]];
        }
      } catch (_) {}
      return null;
    };
    const start = ev => {
      if (ev.button != null && ev.button !== 0) return;
      const coords = toCoords(ev);
      if (!coords) return;
      ev.preventDefault();
      ev.stopPropagation();
      dragging = true;
      g._labelManual = true;
      ensureLabelFront(label);
      clampLabelToView(label);
      offset = [label.X() - coords[0], label.Y() - coords[1]];
      if (labelIndex != null) {
        rememberCurveLabelPosition(labelIndex, { x: label.X(), y: label.Y() }, true);
      }
      if (typeof node.setPointerCapture === 'function' && ev.pointerId != null) {
        try {
          node.setPointerCapture(ev.pointerId);
        } catch (_) {}
      }
    };
    const move = ev => {
      if (!dragging) return;
      const coords = toCoords(ev);
      if (!coords) return;
      ev.preventDefault();
      const nx = coords[0] + offset[0];
      const ny = coords[1] + offset[1];
      label.moveTo([nx, ny]);
      clampLabelToView(label);
      updatePlate(label);
      if (labelIndex != null) {
        rememberCurveLabelPosition(labelIndex, { x: label.X(), y: label.Y() }, true);
      }
    };
    const end = ev => {
      if (!dragging) return;
      dragging = false;
      ev.preventDefault();
      ev.stopPropagation();
      clampLabelToView(label);
      updatePlate(label);
      if (labelIndex != null) {
        rememberCurveLabelPosition(labelIndex, { x: label.X(), y: label.Y() }, true);
      }
      if (typeof node.releasePointerCapture === 'function' && ev.pointerId != null) {
        try {
          node.releasePointerCapture(ev.pointerId);
        } catch (_) {}
      }
    };
    node.addEventListener('pointerdown', start);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('dblclick', ev => {
      ev.preventDefault();
      ev.stopPropagation();
      g._labelManual = false;
      if (labelIndex != null) {
        rememberCurveLabelPosition(labelIndex, null, false);
      }
      reposition(true);
    });
    return true;
  };
  if (setup()) return;
  let attempts = 0;
  const retry = () => {
    if (setup()) return;
    if (attempts++ < 5) {
      setTimeout(retry, 30);
    }
  };
  setTimeout(retry, 30);
}

/* =================== FARGEPALETT =================== */
function colorFor(i) {
  const index = Number.isFinite(i) && i >= 0 ? Math.trunc(i) : 0;
  ensurePaletteCapacity(index + 1);
  const palette = getBaseCurveColors(index + 1);
  const fallback = DEFAULT_FUNCTION_COLORS.fallback.length ? DEFAULT_FUNCTION_COLORS.fallback : GRAFTEGNER_FALLBACK_PALETTE;
  if (!palette.length) {
    return fallback[index % fallback.length];
  }
  return palette[index % palette.length];
}
function lineColorForCurve(i) {
  const index = Number.isFinite(i) && i >= 0 ? Math.trunc(i) : 0;
  ensurePaletteCapacity((index + 1) * 2);
  const palette = resolveCurvePalette((index + 1) * 2);
  const pairIndex = index * 2 + 1;
  const fallback = DEFAULT_FUNCTION_COLORS.fallback.length ? DEFAULT_FUNCTION_COLORS.fallback : GRAFTEGNER_FALLBACK_PALETTE;
  const lineColor = normalizeColorValue(palette[pairIndex]) || normalizeColorValue(palette[index]);
  return lineColor
    || normalizeColorValue(DEFAULT_POINT_COLORS.line)
    || normalizeColorValue(fallback[pairIndex % fallback.length] || fallback[index % fallback.length])
    || DEFAULT_POINT_COLORS.fallbackMarkerStroke;
}
function pointColorForCurve(i) {
  const lineColor = lineColorForCurve(i);
  return pointColorFromLineColor(lineColor) || lineColor || DEFAULT_POINT_COLORS.fallbackMarkerStroke;
}
function updateCurveColorsFromTheme() {
  if (!Array.isArray(appState.graphs) || appState.graphs.length === 0) return;
  const palette = resolveCurvePalette(appState.graphs.length);
  let updated = false;
  appState.graphs.forEach((g, idx) => {
    if (!g) return;
    const nextColor = palette[idx % palette.length];
    const paletteColor = typeof nextColor === 'string' && nextColor ? nextColor : null;
    const manual = !!g.manualColor;
    if (!manual && paletteColor && g.color !== paletteColor) {
      g.color = paletteColor;
      updated = true;
    }
    const appliedColor = typeof g.color === 'string' && g.color ? g.color : paletteColor;
    if (!appliedColor) return;
    g.lineColor = lineColorForCurve(idx);
    if (Array.isArray(g.segs)) {
      g.segs.forEach(seg => {
        if (seg && typeof seg.setAttribute === 'function') {
          seg.setAttribute({ strokeColor: appliedColor });
        }
      });
    }
    if (Array.isArray(g.gliders) && g.gliders.length) {
      const appliedPointColor = pointColorForCurve(idx);
      g.gliders.forEach(point => {
        if (point && typeof point.setAttribute === 'function') {
          point.setAttribute({ strokeColor: appliedPointColor, fillColor: appliedPointColor });
        }
      });
    }
    if (Array.isArray(g.guideArrows) && g.guideArrows.length) {
      const appliedLineColor = lineColorForCurve(idx);
      g.guideArrows.forEach(arrow => {
        if (arrow && typeof arrow.setAttribute === 'function') {
          arrow.setAttribute({ strokeColor: appliedLineColor });
        }
      });
    }
    if (g.labelElement && typeof g.labelElement.setAttribute === 'function') {
      g.labelElement.setAttribute({
        color: appliedColor,
        fillColor: appliedColor,
        cssStyle: `user-select:none;cursor:move;touch-action:none;color:${appliedColor};display:inline-block;`
      });
      const node = g.labelElement.rendNode;
      if (node && node.style) {
        node.style.color = appliedColor;
      }
    }
    if (g._br && typeof g._br === 'object') {
      Object.values(g._br).forEach(list => {
        if (!Array.isArray(list)) return;
        list.forEach(seg => {
          if (seg && typeof seg.setAttribute === 'function') {
            seg.setAttribute({ strokeColor: appliedColor });
          }
        });
      });
    }

    if (typeof funcRows !== 'undefined') {
      const row = funcRows ? funcRows.querySelector(`.func-group:nth-child(${idx + 1})`) : null;
      if (row) {
        const picker = row.querySelector('[data-color-picker]');
        if (picker) {
          const hiddenInput = picker.querySelector('input[data-color]');
          if (hiddenInput && appliedColor) {
            const normalizedColor = typeof normalizeFunctionColorChoice === 'function'
              ? normalizeFunctionColorChoice(appliedColor)
              : null;
            hiddenInput.value = normalizedColor || appliedColor;
            if (typeof updateFunctionColorPicker === 'function' && typeof getFunctionColorOptions === 'function') {
              updateFunctionColorPicker(picker, hiddenInput, appliedColor, getFunctionColorOptions());
            }
          }
        }
      }
    }
  });
  if (updated && appState.board && typeof appState.board.update === 'function') {
    appState.board.update();
  }
}

/* =================== SEGMENTERT TEGNING =================== */
function removeSegments(g) {
  if (g.segs) {
    g.segs.forEach(s => appState.board.removeObject(s));
    g.segs = [];
  }
}
function rebuildFunctionSegmentsFor(g) {
  removeSegments(g);
  const bb = appState.board.getBoundingBox();
  let L = bb[0],
    R = bb[2];
  if (g.domain) {
    if (Number.isFinite(g.domain.min)) {
      L = Math.max(L, g.domain.min);
    }
    if (Number.isFinite(g.domain.max)) {
      R = Math.min(R, g.domain.max);
    }
  }
  if (!(R > L)) return;
  const vas = ADV.asymptote.detect && ADV.asymptote.showVertical ? detectVerticalAsymptotes(g.fn, L, R, 1000, ADV.asymptote.hugeY) : [];
  const xs = [L, ...vas.filter(x => x > L && x < R), R].sort((a, b) => a - b);
  const eps = (R - L) * 1e-6;
  const leftDomainOpen = !!(g.domain && !g.domain.leftClosed);
  const rightDomainOpen = !!(g.domain && !g.domain.rightClosed);
  const safe = x => {
    try {
      const y = g.fn(x);
      return Number.isFinite(y) ? y : NaN;
    } catch (_) {
      return NaN;
    }
  };
  g.segs = [];
  for (let i = 0; i < xs.length - 1; i++) {
    let a = xs[i],
      b = xs[i + 1];
    const leftOpen = i > 0 || (i === 0 && leftDomainOpen);
    const rightOpen = i < xs.length - 2 || (i === xs.length - 2 && rightDomainOpen);
    if (leftOpen) a += eps;
    if (rightOpen) b -= eps;
    if (b <= a) continue;
    const seg = appState.board.create('functiongraph', [safe, () => a, () => b], {
      strokeColor: g.color,
      strokeWidth: 4,
      fixed: true,
      highlight: false
    });
    g.segs.push(seg);
  }
}
function rebuildAllFunctionSegments() {
  appState.graphs.forEach(rebuildFunctionSegmentsFor);
}

/* =================== FUNKSJONER + BRACKETS =================== */
const SUPERSCRIPT_MAP = {
  0: '⁰',
  1: '¹',
  2: '²',
  3: '³',
  4: '⁴',
  5: '⁵',
  6: '⁶',
  7: '⁷',
  8: '⁸',
  9: '⁹',
  '+': '⁺',
  '-': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  'n': 'ⁿ',
  'i': 'ⁱ'
};
const SUBSCRIPT_MAP = {
  0: '₀',
  1: '₁',
  2: '₂',
  3: '₃',
  4: '₄',
  5: '₅',
  6: '₆',
  7: '₇',
  8: '₈',
  9: '₉',
  '+': '₊',
  '-': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎'
};
function mapScriptChars(str, map) {
  return Array.from(str).map(ch => map[ch] || ch).join('');
}
function escapeRegExpClass(str) {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}
const SUPERSCRIPT_REVERSE_MAP = Object.entries(SUPERSCRIPT_MAP).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {});
const SUBSCRIPT_REVERSE_MAP = Object.entries(SUBSCRIPT_MAP).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {});
const SUPERSCRIPT_SEQUENCE_REGEX = new RegExp(`[${escapeRegExpClass(Object.values(SUPERSCRIPT_MAP).join(''))}]+`, 'g');
const SUBSCRIPT_SEQUENCE_REGEX = new RegExp(`[${escapeRegExpClass(Object.values(SUBSCRIPT_MAP).join(''))}]+`, 'g');
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => HTML_ESCAPE_MAP[ch] || ch);
}
function decodeBasicEntities(text) {
  return String(text).replace(/&nbsp;/gi, ' ').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');
}
function collapseExpressionWhitespace(text) {
  return String(text).replace(/\u00a0/g, ' ').replace(/[\t\r\f]+/g, ' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
}
function replaceUnicodeScripts(value, regex, reverseMap, prefix) {
  return value.replace(regex, match => {
    const mapped = Array.from(match).map(ch => reverseMap[ch] != null ? reverseMap[ch] : ch).join('');
    if (!mapped) return match;
    return `${prefix}{${mapped}}`;
  });
}
function finalizeLatexFromPlain(input) {
  const collapsed = collapseExpressionWhitespace(decodeBasicEntities(input));
  if (!collapsed) return '';
  let out = replaceUnicodeScripts(collapsed, SUPERSCRIPT_SEQUENCE_REGEX, SUPERSCRIPT_REVERSE_MAP, '^');
  out = replaceUnicodeScripts(out, SUBSCRIPT_SEQUENCE_REGEX, SUBSCRIPT_REVERSE_MAP, '_');
  out = out.replace(/(^|[^\\])#/g, (_, prefix) => `${prefix}\\#`);
  return out.replace(/\n/g, '\\\\');
}
function convertExpressionToLatex(str) {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  const manualConvert = input => {
    let text = String(input);
    const replaceScript = (pattern, builder) => {
      text = text.replace(pattern, (_, inner = '') => builder(manualConvert(inner)));
    };
    text = text.replace(/<br\s*\/?>/gi, '\n');
    replaceScript(/<sup>([\s\S]*?)<\/sup>/gi, inner => `^{${inner}}`);
    replaceScript(/<sub>([\s\S]*?)<\/sub>/gi, inner => `_{${inner}}`);
    text = text.replace(/<[^>]*>/g, '');
    return text;
  };
  if (/[<&]/.test(trimmed) && typeof document !== 'undefined') {
    try {
      const tpl = document.createElement('template');
      tpl.innerHTML = trimmed;
      const TEXT_NODE = typeof Node !== 'undefined' && Node.TEXT_NODE != null ? Node.TEXT_NODE : 3;
      const ELEMENT_NODE = typeof Node !== 'undefined' && Node.ELEMENT_NODE != null ? Node.ELEMENT_NODE : 1;
      const convertNode = node => {
        if (!node) return '';
        if (node.nodeType === TEXT_NODE) {
          return node.textContent || '';
        }
        if (node.nodeType === ELEMENT_NODE) {
          const tag = node.tagName ? node.tagName.toLowerCase() : '';
          if (tag === 'sup') {
            let out = '';
            node.childNodes.forEach(child => {
              out += convertNode(child);
            });
            return `^{${out}}`;
          }
          if (tag === 'sub') {
            let out = '';
            node.childNodes.forEach(child => {
              out += convertNode(child);
            });
            return `_{${out}}`;
          }
          if (tag === 'br') {
            return '\n';
          }
          let out = '';
          node.childNodes.forEach(child => {
            out += convertNode(child);
          });
          return out;
        }
        return '';
      };
      const text = Array.from(tpl.content.childNodes).map(node => convertNode(node)).join('');
      return finalizeLatexFromPlain(text);
    } catch (_) {
      return finalizeLatexFromPlain(manualConvert(trimmed));
    }
  }
  if (/[<&]/.test(trimmed)) {
    return finalizeLatexFromPlain(manualConvert(trimmed));
  }
  return finalizeLatexFromPlain(trimmed);
}
function renderLatexToHtml(latex) {
  if (!latex) return '';
  if (typeof window === 'undefined' || !window.katex) return '';
  const { katex } = window;
  if (!katex) return '';
  if (typeof katex.renderToString === 'function') {
    try {
      return katex.renderToString(latex, {
        throwOnError: false
      });
    } catch (_) {
      return '';
    }
  }
  if (typeof katex.render === 'function' && typeof document !== 'undefined') {
    const span = document.createElement('span');
    try {
      katex.render(latex, span, {
        throwOnError: false
      });
      return span.innerHTML;
    } catch (_) {
      return '';
    }
  }
  return '';
}

function extractKatexStyles(doc) {
  if (!doc || !doc.styleSheets) return '';
  const parts = [];
  Array.from(doc.styleSheets).forEach(sheet => {
    const href = sheet && sheet.href ? String(sheet.href) : '';
    const owner = sheet && sheet.ownerNode && sheet.ownerNode.getAttribute ? sheet.ownerNode.getAttribute('id') : '';
    if (!/katex/i.test(href || owner)) return;
    try {
      const rules = sheet.cssRules || sheet.rules;
      if (!rules) return;
      Array.from(rules).forEach(rule => {
        if (rule && rule.cssText) {
          parts.push(rule.cssText);
        }
      });
    } catch (_) {}
  });
  return parts.join('\n');
}

function ensureKatexStyleInSvg(node) {
  if (!node) return false;
  const doc = node.ownerDocument || (typeof document !== 'undefined' ? document : null);
  if (!doc) return false;
  if (node.querySelector('[data-export-katex-style]')) return true;
  const cssText = extractKatexStyles(doc);
  if (!cssText) return false;
  const defs = node.querySelector('defs') || doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
  if (!defs.parentNode) {
    node.insertBefore(defs, node.firstChild);
  }
  const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.setAttribute('data-export-katex-style', '');
  style.setAttribute('type', 'text/css');
  style.textContent = cssText;
  defs.appendChild(style);
  return true;
}

function createKatexExportLabel(doc, html, screenPos, options = {}) {
  if (!doc || !html || !screenPos || typeof screenPos.x !== 'number' || typeof screenPos.y !== 'number') return null;
  if (typeof document === 'undefined' || !document.body) return null;
  const fontSizeRaw = Number.parseFloat(options.fontSize);
  const fontSize = Number.isFinite(fontSizeRaw) ? fontSizeRaw : 15;
  const temp = document.createElement('div');
  temp.style.position = 'absolute';
  temp.style.visibility = 'hidden';
  temp.style.pointerEvents = 'none';
  temp.style.fontSize = `${fontSize}px`;
  temp.style.lineHeight = '1.2';
  temp.style.color = options.color || '#111827';
  temp.innerHTML = html;
  document.body.appendChild(temp);
  const rect = temp.getBoundingClientRect();
  document.body.removeChild(temp);
  const width = Math.max(1, Math.ceil(rect.width));
  const height = Math.max(1, Math.ceil(rect.height));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  const alignH = options.alignH || 'start';
  const alignV = options.alignV || 'before-edge';
  const offsetX = alignH === 'end' ? -width : alignH === 'middle' ? -(width / 2) : 0;
  const offsetY = alignV === 'after-edge' ? -height : alignV === 'middle' ? -(height / 2) : 0;
  const fo = doc.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
  fo.setAttribute('width', `${width}`);
  fo.setAttribute('height', `${height}`);
  fo.setAttribute('x', `${screenPos.x + offsetX}`);
  fo.setAttribute('y', `${screenPos.y + offsetY}`);
  const body = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  body.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  body.style.display = 'inline-block';
  body.style.color = options.color || '#111827';
  body.style.fontSize = `${fontSize}px`;
  body.style.lineHeight = '1.2';
  body.style.fontFamily = 'KaTeX_Main, "Times New Roman", serif';
  body.innerHTML = html;
  fo.appendChild(body);
  return fo;
}
const KATEX_TEXT_ESCAPE_REGEX = /([#%&$^_{}\\])/g;
function escapeKatexPlainText(text) {
  return String(text).replace(KATEX_TEXT_ESCAPE_REGEX, '\\$1');
}
function formatPointLabelLatex(text) {
  if (typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (!trimmed) return '';
  const latex = convertExpressionToLatex(trimmed);
  if (latex) return latex;
  if (/^[A-Za-z\u00c6\u00d8\u00c5\u00e6\u00f8\u00e5]+$/.test(trimmed)) {
    return trimmed;
  }
  return `\\text{${escapeKatexPlainText(trimmed)}}`;
}
function formatPointLabelHtml(text) {
  const value = typeof text === 'function' ? text() : text;
  const latex = formatPointLabelLatex(typeof value === 'string' ? value : '');
  if (latex) {
    const html = renderLatexToHtml(latex);
    if (html) return html;
  }
  return typeof value === 'string' ? escapeHtml(value) : '';
}
function applyPointLabelStyling(label) {
  if (!label) return;
  const fontSizeRaw = Number.parseFloat(ADV && ADV.curveName ? ADV.curveName.fontSize : SHARED_FONT_SIZE);
  const fontSize = Number.isFinite(fontSizeRaw) ? fontSizeRaw : SHARED_FONT_SIZE;
  const cssTokens = [
    'user-select:none',
    'pointer-events:none',
    `font-size:${fontSize}px`
  ];
  try {
    label.setAttribute({
      display: 'html',
      fontSize,
      cssStyle: cssTokens.join(';')
    });
  } catch (_) {}
}
function setPointLabelText(point, text) {
  if (!point || !point.label || typeof point.label.setText !== 'function') return;
  applyPointLabelStyling(point.label);
  const renderer = typeof text === 'function'
    ? () => formatPointLabelHtml(text())
    : () => formatPointLabelHtml(text);
  point.label.setText(renderer);
}
function renderKatexPlainText(target, text) {
  if (!target) return;
  const str = typeof text === 'string' ? text : '';
  if (!str) {
    target.textContent = '';
    return;
  }
  const katex = typeof window !== 'undefined' ? window.katex : null;
  if (katex && typeof katex.render === 'function') {
    try {
      katex.render(`\\text{${escapeKatexPlainText(str)}}`, target, { throwOnError: false });
      return;
    } catch (_) {}
  }
  target.textContent = str;
}
function renderKatexMath(target, latex, fallbackText = '') {
  if (!target) return;
  const str = typeof latex === 'string' ? latex : '';
  const fallback = typeof fallbackText === 'string' && fallbackText ? fallbackText : str;
  if (!str) {
    target.textContent = fallback;
    return;
  }
  const katex = typeof window !== 'undefined' ? window.katex : null;
  if (katex && typeof katex.render === 'function') {
    try {
      katex.render(str, target, { throwOnError: false });
      return;
    } catch (_) {}
  }
  target.textContent = fallback || str;
}
function normalizeExpressionText(str) {
  if (typeof str !== 'string') return '';
  const trimmed = str.trim();
  if (!trimmed) return '';
  const manualNormalize = input => {
    let text = String(input);
    const replaceScript = (pattern, map) => {
      text = text.replace(pattern, (_, inner = '') => mapScriptChars(manualNormalize(inner), map));
    };
    text = text.replace(/<br\s*\/?>/gi, '\n');
    replaceScript(/<sup>([\s\S]*?)<\/sup>/gi, SUPERSCRIPT_MAP);
    replaceScript(/<sub>([\s\S]*?)<\/sub>/gi, SUBSCRIPT_MAP);
    text = text.replace(/<[^>]*>/g, '');
    return collapseExpressionWhitespace(decodeBasicEntities(text));
  };
  if (/[<&]/.test(trimmed) && typeof document !== 'undefined') {
    try {
      const tpl = document.createElement('template');
      tpl.innerHTML = trimmed;
      const TEXT_NODE = typeof Node !== 'undefined' && Node.TEXT_NODE != null ? Node.TEXT_NODE : 3;
      const ELEMENT_NODE = typeof Node !== 'undefined' && Node.ELEMENT_NODE != null ? Node.ELEMENT_NODE : 1;
      const convertNode = (node, mode) => {
        if (!node) return '';
        if (node.nodeType === TEXT_NODE) {
          const text = node.textContent || '';
          if (mode === 'sup') return mapScriptChars(text, SUPERSCRIPT_MAP);
          if (mode === 'sub') return mapScriptChars(text, SUBSCRIPT_MAP);
          return text;
        }
        if (node.nodeType === ELEMENT_NODE) {
          const tag = node.tagName ? node.tagName.toLowerCase() : '';
          if (tag === 'sup') {
            let out = '';
            node.childNodes.forEach(child => {
              out += convertNode(child, 'sup');
            });
            return out;
          }
          if (tag === 'sub') {
            let out = '';
            node.childNodes.forEach(child => {
              out += convertNode(child, 'sub');
            });
            return out;
          }
          if (tag === 'br') {
            return '\n';
          }
          let out = '';
          node.childNodes.forEach(child => {
            out += convertNode(child, mode);
          });
          return out;
        }
        return '';
      };
      const text = Array.from(tpl.content.childNodes).map(node => convertNode(node, null)).join('');
      return collapseExpressionWhitespace(text);
    } catch (_) {
      return manualNormalize(trimmed);
    }
  }
  if (/[<&]/.test(trimmed)) {
    return manualNormalize(trimmed);
  }
  return collapseExpressionWhitespace(decodeBasicEntities(trimmed));
}
const ALT_TEXT_NUMBER_FORMATTER = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3
}) : null;
function formatAltNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  const normalized = Object.is(value, -0) ? 0 : value;
  if (ALT_TEXT_NUMBER_FORMATTER) {
    try {
      return ALT_TEXT_NUMBER_FORMATTER.format(normalized);
    } catch (_) {}
  }
  const rounded = Math.round(normalized * 1000) / 1000;
  const str = String(rounded);
  return str.replace(/\.0+(?=$)/, '').replace(/(\.\d*?)0+(?=$)/, '$1');
}
function joinList(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} og ${items[1]}`;
  const head = items.slice(0, -1).join(', ');
  const tail = items[items.length - 1];
  return `${head} og ${tail}`;
}
function formatCoordinateForAlt(point) {
  if (!Array.isArray(point) || point.length < 2) return '';
  const [x, y] = point;
  const fx = formatAltNumber(x);
  const fy = formatAltNumber(y);
  if (!fx || !fy) return '';
  return `(${fx}, ${fy})`;
}
function describeDomainForAlt(domain) {
  if (!domain) return '';
  const hasMin = Number.isFinite(domain.min);
  const hasMax = Number.isFinite(domain.max);
  if (!hasMin && !hasMax) return '';
  const min = hasMin ? formatAltNumber(domain.min) : '';
  const max = hasMax ? formatAltNumber(domain.max) : '';
  if (hasMin && hasMax) {
    if (!min || !max) return '';
    if (domain.min === domain.max) {
      return `for x lik ${min}`;
    }
    if (domain.leftClosed && domain.rightClosed) {
      return `for x fra ${min} til ${max}, inkludert begge endepunkter`;
    }
    if (domain.leftClosed && !domain.rightClosed) {
      return `for x fra og med ${min} til ${max}, men ikke inkludert ${max}`;
    }
    if (!domain.leftClosed && domain.rightClosed) {
      return `for x fra ${min} til og med ${max}, men ikke inkludert ${min}`;
    }
    return `for x mellom ${min} og ${max}, uten endepunktene`;
  }
  if (!hasMin && hasMax) {
    if (!max) return '';
    return domain.rightClosed ? `for x mindre enn eller lik ${max}` : `for x mindre enn ${max}`;
  }
  if (hasMin && !hasMax) {
    if (!min) return '';
    return domain.leftClosed ? `for x større enn eller lik ${min}` : `for x større enn ${min}`;
  }
  return '';
}
function appendExtraPointsAltText(parsed, sentences) {
  if (!Array.isArray(sentences)) return;
  const points = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.extraPoints) ? parsed.extraPoints.filter(isValidPointArray) : [];
  if (!points.length) return;
  const coords = points.map(formatCoordinateForAlt).filter(Boolean);
  if (!coords.length) return;
  const locks = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.pointLocks) ? parsed.pointLocks : [];
  const locked = locks.length ? locks.every(Boolean) : !(parsed && parsed.lockExtraPoints === false);
  if (coords.length === 1) {
    sentences.push(`${locked ? 'Et fast punkt' : 'Et punkt'} er markert i ${coords[0]}.`);
  } else {
    sentences.push(`${locked ? 'Faste punkter' : 'Punkter'} er markert i ${joinList(coords)}.`);
  }
}
function describeCoordinateSystemForAlt() {
  return 'Koordinatsystemet har en horisontal x-akse og en vertikal y-akse med rutenettlinjer som markerer enheter.';
}
function parseSimpleQuadraticCoefficients(expr) {
  if (typeof expr !== 'string') return null;
  let normalized = expr.replace(/\s+/g, '').replace(/·/g, '').replace(/,/g, '.').replace(/−/g, '-');
  normalized = normalized.replace(/\*/g, '');
  normalized = normalized.replace(/X/g, 'x');
  if (!normalized) return null;
  if (!/x\^2/i.test(normalized)) return null;
  if (/[^0-9x^+\.\-]/i.test(normalized)) return null;
  const terms = [];
  let current = '';
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '+' || ch === '-') {
      if (i === 0) {
        current += ch;
      } else {
        if (current) terms.push(current);
        current = ch;
      }
    } else {
      current += ch;
    }
  }
  if (current) terms.push(current);
  if (!terms.length) terms.push(normalized);
  const parseCoeff = (str, fallback) => {
    if (str == null || str === '') {
      return fallback;
    }
    if (str === '+') {
      return fallback == null ? null : +fallback;
    }
    if (str === '-') {
      return fallback == null ? null : -fallback;
    }
    const num = Number.parseFloat(str);
    if (!Number.isFinite(num)) return null;
    return num;
  };
  let a = null;
  let b = 0;
  let c = 0;
  for (const term of terms) {
    if (!term) continue;
    if (/x\^2$/i.test(term)) {
      const coeff = parseCoeff(term.replace(/x\^2$/i, ''), 1);
      if (coeff == null) return null;
      a = coeff;
    } else if (/x$/i.test(term)) {
      const coeff = parseCoeff(term.replace(/x$/i, ''), 1);
      if (coeff == null) return null;
      b += coeff;
    } else {
      const coeff = parseCoeff(term, null);
      if (coeff == null) return null;
      c += coeff;
    }
  }
  if (a == null) return null;
  return { a, b, c };
}
function describeQuadraticShapeForAlt(fun) {
  if (!fun || typeof fun.rhs !== 'string') return [];
  const coeffs = parseSimpleQuadraticCoefficients(fun.rhs);
  if (!coeffs) return [];
  const { a, b, c } = coeffs;
  if (a === 0 || !Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) {
    return [];
  }
  const sentences = [];
  sentences.push(`Grafen er en parabel som åpner ${a > 0 ? 'oppover' : 'nedover'}.`);
  const vertexX = -b / (2 * a);
  const vertexY = a * vertexX * vertexX + b * vertexX + c;
  const vertexCoord = formatCoordinateForAlt([vertexX, vertexY]);
  if (vertexCoord) {
    sentences.push(`Toppunktet ligger i ${vertexCoord}.`);
  }
  const yInterceptCoord = formatCoordinateForAlt([0, c]);
  if (yInterceptCoord) {
    sentences.push(`Grafen skjærer y-aksen i ${yInterceptCoord}.`);
  }
  const disc = b * b - 4 * a * c;
  if (Number.isFinite(disc)) {
    const EPS = 1e-9;
    if (disc > EPS) {
      const sqrtDisc = Math.sqrt(disc);
      const root1 = (-b - sqrtDisc) / (2 * a);
      const root2 = (-b + sqrtDisc) / (2 * a);
      const coords = [formatCoordinateForAlt([root1, 0]), formatCoordinateForAlt([root2, 0])].filter(Boolean);
      if (coords.length === 2) {
        sentences.push(`Den krysser x-aksen i punktene ${joinList(coords)}.`);
      } else if (coords.length === 1) {
        sentences.push(`Den krysser x-aksen i punktet ${coords[0]}.`);
      }
    } else if (Math.abs(disc) <= EPS) {
      if (vertexCoord) {
        sentences.push(`Grafen tangerer x-aksen i ${vertexCoord}.`);
      } else {
        sentences.push('Grafen tangerer x-aksen i toppunktet.');
      }
    } else {
      sentences.push('Grafen krysser ikke x-aksen.');
    }
  }
  return sentences;
}
function buildFunctionsAltTextSummary(parsed) {
  const sentences = [];
  const coordinateSentence = describeCoordinateSystemForAlt();
  if (coordinateSentence) {
    sentences.push(coordinateSentence);
  }
  const functions = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.funcs) ? parsed.funcs.filter(fun => fun && typeof fun.rhs === 'string' && fun.rhs.trim()) : [];
  if (!functions.length) {
    sentences.push('Figuren viser et koordinatsystem uten funksjoner.');
  } else if (functions.length === 1) {
    const fun = functions[0];
    const label = normalizeExpressionText((fun === null || fun === void 0 ? void 0 : fun.label) || (fun === null || fun === void 0 ? void 0 : fun.name) || '');
    const expr = normalizeExpressionText(fun === null || fun === void 0 ? void 0 : fun.rhs);
    if (label && expr) {
      sentences.push(`Grafen viser ${label} = ${expr}.`);
    } else if (expr) {
      sentences.push(`Grafen viser funksjonen y = ${expr}.`);
    } else if (label) {
      sentences.push(`Grafen viser ${label}.`);
    } else {
      sentences.push('Grafen viser én funksjon.');
    }
    const domainText = describeDomainForAlt(fun === null || fun === void 0 ? void 0 : fun.domain);
    if (domainText) {
      sentences.push(`Funksjonen er tegnet ${domainText}.`);
    }
    const shapeSentences = describeQuadraticShapeForAlt(fun);
    if (shapeSentences.length) {
      sentences.push(...shapeSentences);
    }
  } else {
    sentences.push(`Grafen viser ${functions.length} funksjoner.`);
    functions.forEach((fun, idx) => {
      const label = normalizeExpressionText((fun === null || fun === void 0 ? void 0 : fun.label) || (fun === null || fun === void 0 ? void 0 : fun.name) || '');
      const expr = normalizeExpressionText(fun === null || fun === void 0 ? void 0 : fun.rhs);
      let sentence = '';
      if (label && expr) {
        sentence = `Funksjon ${idx + 1}: ${label} = ${expr}.`;
      } else if (expr) {
        sentence = `Funksjon ${idx + 1}: y = ${expr}.`;
      } else if (label) {
        sentence = `Funksjon ${idx + 1}: ${label}.`;
      }
      const domainText = describeDomainForAlt(fun === null || fun === void 0 ? void 0 : fun.domain);
      if (sentence) {
        if (domainText) {
          sentence += ` Den er tegnet ${domainText}.`;
        }
        sentences.push(sentence);
      } else if (domainText) {
        sentences.push(`Funksjon ${idx + 1} er tegnet ${domainText}.`);
      }
    });
  }
  const gliderCount = Number.isFinite(parsed === null || parsed === void 0 ? void 0 : parsed.pointsCount) ? parsed.pointsCount : 0;
  if (gliderCount > 0) {
    sentences.push(gliderCount === 1 ? 'Det er ett flyttbart punkt på grafen.' : `Det er ${gliderCount} flyttbare punkter på grafene.`);
    const startValues = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.startX) ? parsed.startX.filter(Number.isFinite).map(formatAltNumber).filter(Boolean) : [];
    if (startValues.length) {
      sentences.push(`Startposisjonene for x er ${joinList(startValues)}.`);
    }
  }
  appendExtraPointsAltText(parsed, sentences);
  const answerText = normalizeExpressionText(parsed === null || parsed === void 0 ? void 0 : parsed.answer);
  if (answerText) {
    sentences.push(`Fasit: ${answerText}.`);
  }
  return sentences.join(' ');
}
function buildLineAltTextSummary(parsed) {
  const sentences = ['Figuren viser en linje i et koordinatsystem.'];
  const first = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.funcs) && parsed.funcs.length ? parsed.funcs[0] : null;
  const expr = normalizeExpressionText((first === null || first === void 0 ? void 0 : first.rhs) || '');
  if (expr) {
    sentences.push(`Uttrykket er y = ${expr}.`);
  }
  const template = interpretLineTemplate(first ? first.rhs : '');
  const specifiedPoints = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.linePoints) ? parsed.linePoints.filter(isValidPointArray) : [];
  const basePoints = (specifiedPoints.length ? specifiedPoints : resolveLineStartPoints(parsed)).filter(isValidPointArray);
  if ((template === null || template === void 0 ? void 0 : template.kind) === 'anchorY') {
    const anchor = formatAltNumber(template.anchorC);
    if (anchor) {
      sentences.push(`Linjen går alltid gjennom punktet (0, ${anchor}) på y-aksen.`);
    }
    const point = basePoints[0] ? formatCoordinateForAlt(basePoints[0]) : '';
    if (point) {
      sentences.push(`${specifiedPoints.length ? 'Det angitte punktet ligger' : 'Det flyttbare punktet starter'} i ${point}.`);
    }
  } else if ((template === null || template === void 0 ? void 0 : template.kind) === 'fixedSlope') {
    const slope = formatAltNumber(template.slopeM);
    if (slope) {
      sentences.push(`Linjen har fast stigningstall ${slope}.`);
    }
    const point = basePoints[0] ? formatCoordinateForAlt(basePoints[0]) : '';
    if (point) {
      sentences.push(`${specifiedPoints.length ? 'Linjen går gjennom' : 'Det flyttbare punktet starter i'} ${point}.`);
    }
  } else {
    const coords = basePoints.slice(0, 2).map(formatCoordinateForAlt).filter(Boolean);
    if (coords.length === 2) {
      const prefix = specifiedPoints.length ? 'Linjen er definert av' : 'Linjen starter i';
      sentences.push(`${prefix} punktene ${joinList(coords)}.`);
    } else if (coords.length === 1) {
      sentences.push(`Linjen går gjennom punktet ${coords[0]}.`);
    }
  }
  appendExtraPointsAltText(parsed, sentences);
  const answerText = normalizeExpressionText(parsed === null || parsed === void 0 ? void 0 : parsed.answer);
  if (answerText) {
    sentences.push(`Fasit: ${answerText}.`);
  }
  return sentences.join(' ');
}
function getSimpleString() {
  if (typeof appState.simple.value === 'string') return appState.simple.value;
  if (appState.simple.value == null) return '';
  return String(appState.simple.value);
}
function buildGrafAltText() {
  try {
    const parsed = parseSimple(getSimpleString());
    const mode = decideMode(parsed);
    const summary = mode === 'functions' ? buildFunctionsAltTextSummary(parsed) : buildLineAltTextSummary(parsed);
    const normalized = summary.replace(/\s+/g, ' ').trim();
    return normalized || 'Figuren viser et koordinatsystem.';
  } catch (_) {
    return 'Figuren viser et koordinatsystem.';
  }
}
function resolveAltTextTitle() {
  if (typeof document === 'undefined') return 'Graftegner';
  const docTitle = typeof document.title === 'string' ? document.title.trim() : '';
  if (docTitle) return docTitle;
  const heading = document.querySelector('h1');
  if (heading && heading.textContent && heading.textContent.trim()) {
    return heading.textContent.trim();
  }
  return 'Graftegner';
}
function refreshAltText(reason) {
  const signature = buildGrafAltText();
  if (appState.altTextManager && typeof appState.altTextManager.refresh === 'function') {
    appState.altTextManager.refresh(reason || 'auto', signature);
  } else if (appState.altTextManager && typeof appState.altTextManager.notifyFigureChange === 'function') {
    appState.altTextManager.notifyFigureChange(signature);
  }
}
function applyAltTextToBoard() {
  if (appState.altTextManager) {
    appState.altTextManager.applyCurrent();
  }
}

function getCurrentAltText() {
  const text = appState.altText && typeof appState.altText.text === 'string' ? appState.altText.text.trim() : '';
  if (text) {
    return text;
  }
  const generated = buildGrafAltText();
  return typeof generated === 'string' ? generated : '';
}
function initAltTextManager() {
  if (typeof window === 'undefined' || !window.MathVisAltText) return;
  const container = document.getElementById('exportCard');
  if (!container) return;
  if (appState.altTextManager) {
    appState.altTextManager.ensureDom();
    appState.altTextManager.applyCurrent();
    return;
  }
  appState.altTextManager = window.MathVisAltText.create({
    svg: () => appState.board && appState.board.renderer && appState.board.renderer.svgRoot || null,
    container,
    getTitle: resolveAltTextTitle,
    getState: () => ({
      text: typeof appState.altText.text === 'string' ? appState.altText.text : '',
      source: appState.altText.source === 'manual' ? 'manual' : 'auto'
    }),
    setState: (text, source) => {
      appState.altText.text = typeof text === 'string' ? text : '';
      appState.altText.source = source === 'manual' ? 'manual' : 'auto';
      if (typeof window !== 'undefined') {
        window.GRAF_ALT_TEXT = appState.altText;
      }
    },
    generate: () => buildGrafAltText(),
    getSignature: () => buildGrafAltText(),
    getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
    getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
  });
  if (appState.altTextManager) {
    appState.altTextManager.applyCurrent();
    refreshAltText('init');
  }
}
function makeSmartCurveLabel(g, idx, content) {
  if (!ADV.curveName.show || !content) return;
  const renderer = (() => {
    let cached = '';
    let cachedKey = null;
    return () => {
      const latex = content.latex && content.latex.trim();
      if (latex) {
        const key = `latex:${latex}`;
        if (cachedKey === key && cached) return cached;
        const html = (content.html && content.html.trim()) || renderLatexToHtml(latex);
        if (html) {
          cachedKey = key;
          cached = `<span class="curve-label curve-label--latex">${html}</span>`;
          content.html = html;
          return cached;
        }
      }
      const plain = content.text ? escapeHtml(content.text) : '';
      const key = `text:${plain}`;
      if (cachedKey === key && cached) return cached;
      cachedKey = key;
      cached = plain ? `<span class="curve-label curve-label--text">${plain}</span>` : '';
      return cached;
    };
  })();
  const label = appState.board.create('text', [0, 0, renderer], {
    color: g.color,
    fillColor: g.color,
    fontSize: ADV.curveName.fontSize,
    fixed: true,
    highlight: false,
    layer: ADV.curveName.layer,
    anchorX: 'left',
    anchorY: 'middle',
    display: 'html',
    cssStyle: `user-select:none;cursor:move;touch-action:none;color:${g.color};display:inline-block;`
  });
  g.labelElement = label;
  label._plainText = content.text || '';
  ensurePlateFor(label);
  ensureCurveLabelVisibility(label);
  g._labelManual = false;
  g._labelIndex = Number.isInteger(idx) && idx >= 0 ? idx : 0;
  function finiteYAt(x) {
    const sample = t => {
      try {
        const val = g.fn(t);
        return Number.isFinite(val) ? val : null;
      } catch (_) {
        return null;
      }
    };
    let y = sample(x);
    if (Number.isFinite(y)) return y;
    const [xmin, ymax, xmax, ymin] = appState.board.getBoundingBox();
    const span = xmax - xmin,
      step = span / 60;
    for (let k = 1; k <= 60; k++) {
      for (const s of [+1, -1]) {
        const xs = x + s * k * step / 6;
        y = sample(xs);
        if (Number.isFinite(y)) return y;
      }
    }
    return null;
  }
  function position(force) {
    const forced = force === true;
    if (g._labelManual && !forced) {
      clampLabelToView(label);
      updatePlate(label);
      ensureLabelFront(label);
      return;
    }
    const manualPos = manualCurveLabelPosition(g._labelIndex);
    if (manualPos && !forced) {
      label.moveTo([manualPos.x, manualPos.y]);
      clampLabelToView(label);
      updatePlate(label);
      ensureLabelFront(label);
      g._labelManual = true;
      return;
    }
    const bb = appState.board.getBoundingBox(),
      xmin = bb[0],
      xmax = bb[2],
      ymin = bb[3],
      ymax = bb[1];
    const a = g.domain ? g.domain.min : xmin,
      b = g.domain ? g.domain.max : xmax;
    const L = Math.max(a, xmin),
      R = Math.min(b, xmax);
    if (!(R > L)) return;
    const fr = ADV.curveName.fractions,
      pad = 0.04 * (R - L);
    const prevPos = label && Number.isFinite(label.X()) && Number.isFinite(label.Y())
      ? [label.X(), label.Y()]
      : null;
    let best = null;
    for (const f of fr) {
      let x = L + f * (R - L);
      x = Math.min(R - pad, Math.max(L + pad, x));
      const y = finiteYAt(x);
      if (!Number.isFinite(y)) continue;
      const h = (xmax - xmin) / 600;
      let y1 = null,
        y2 = null;
      try {
        y1 = g.fn(x - h);
      } catch (_) {}
      try {
        y2 = g.fn(x + h);
      } catch (_) {}
      if (!Number.isFinite(y1) || !Number.isFinite(y2)) continue;
      const m = (y2 - y1) / (2 * h);
      if (!Number.isFinite(m)) continue;
      let nx = -m,
        ny = 1;
      const L2 = Math.hypot(nx, ny);
      if (!Number.isFinite(L2) || L2 === 0) continue;
      nx /= L2;
      ny /= L2;
      const rx = (xmax - xmin) / appState.board.canvasWidth,
        ry = (ymax - ymin) / appState.board.canvasHeight;
      const off = ADV.curveName.gapPx;
      let X = x + nx * off * rx,
        Y = y + ny * off * ry;
      const xCl = Math.min(xmax - (xmax - xmin) * ADV.curveName.marginFracX, Math.max(xmin + (xmax - xmin) * ADV.curveName.marginFracX, X));
      const yCl = Math.min(ymax - (ymax - ymin) * ADV.curveName.marginFracY, Math.max(ymin + (ymax - ymin) * ADV.curveName.marginFracY, Y));
      const pen = Math.abs(xCl - X) / rx + Math.abs(yCl - Y) / ry;
      if (!best || pen < best.pen) best = {
        pen,
        pos: [xCl, yCl],
        slope: m
      };
    }
    if (!best && prevPos) {
      best = {
        pen: Infinity,
        pos: prevPos,
        slope: label._lastSlope || 0
      };
    }
    if (!best) {
      return;
    }
    label.moveTo(best.pos);
    label.setAttribute({
      anchorX: best.slope >= 0 ? 'left' : 'right'
    });
    label._lastSlope = best.slope;
    clampLabelToView(label);
    updatePlate(label);
    ensureLabelFront(label);
    rememberCurveLabelPosition(g._labelIndex, { x: label.X(), y: label.Y() }, false);
    g._labelManual = false;
  }
  position();
  appState.board.on('boundingbox', position);
  makeLabelDraggable(label, g, position);
  g._repositionLabel = position;
}
function removeBracketAt(g, side) {
  if (!g || !g._br || !g._br[side]) return;
  const items = g._br[side];
  items.forEach(o => appState.board.removeObject(o));
  g._br[side] = null;
}

function shouldShowDomainMarker(domain, side) {
  if (!domain || domain.showMarkers === false) return false;
  const hasMin = Number.isFinite(domain.min);
  const hasMax = Number.isFinite(domain.max);
  if (side === 'left' || side === -1) {
    if (!hasMin) return false;
    if (domain.showLeftMarker != null) {
      return !!domain.showLeftMarker;
    }
    return true;
  }
  if (side === 'right' || side === 1) {
    if (!hasMax) return false;
    if (domain.showRightMarker != null) {
      return !!domain.showRightMarker;
    }
    return true;
  }
  return false;
}

function makeBracketAt(g, x0, side /* -1 = venstre (a), +1 = høyre (b) */, closed) {
  g._br = g._br || {};
  removeBracketAt(g, side);
  if (!g.domain || !shouldShowDomainMarker(g.domain, side) || !ADV.domainMarkers.show) return;
  if (!Number.isFinite(x0)) return;
  const [xmin, ymax, xmax, ymin] = appState.board.getBoundingBox();
  const rx = (xmax - xmin) / appState.board.canvasWidth;
  const ry = (ymax - ymin) / appState.board.canvasHeight;
  const baseH = Math.max((xmax - xmin) / 200, 1e-4);

  // Finn et punkt innover i domenet med finite y
  let xS = x0,
    yS = g.fn(xS),
    tries = 0,
    inward = side < 0 ? +1 : -1;
  while (!Number.isFinite(yS) && tries < 12) {
    xS = x0 + inward * (tries + 1) * baseH;
    try {
      yS = g.fn(xS);
    } catch (_) {
      yS = NaN;
    }
    tries++;
  }
  if (!Number.isFinite(yS)) return;

  // tangent rundt xS
  let m = 0;
  try {
    const y1 = g.fn(xS + baseH),
      y2 = g.fn(xS - baseH);
    if (Number.isFinite(y1) && Number.isFinite(y2)) m = (y1 - y2) / (2 * baseH);
  } catch (_) {}

  // enhets-tangent/-normal i px-rom
  let tx = 1 / rx,
    ty = m / ry;
  const tlen = Math.hypot(tx, ty) || 1;
  tx /= tlen;
  ty /= tlen;
  let nx = -ty,
    ny = tx;
  const px2world = (vx, vy, Lpx) => [vx * Lpx * rx, vy * Lpx * ry];
  const shape = closed ? DOMAIN_MARKER_SHAPES.closed : DOMAIN_MARKER_SHAPES.open;
  if (!shape || !Array.isArray(shape.points) || !shape.points.length) return;
  const LEN = ADV.domainMarkers.barPx;
  const heightPx = shape.height || 1;
  const scale = LEN / heightPx;
  const flip = closed ? -side : side;
  const strokeColor = typeof g.color === 'string' && g.color ? g.color : ADV.domainMarkers.color;
  const offsetRaw = Number.isFinite(shape.offsetPx)
    ? shape.offsetPx
    : Number.isFinite(ADV.domainMarkers.offsetPx)
      ? ADV.domainMarkers.offsetPx
      : 0;
  const parallelOffsetPx = Math.abs(offsetRaw) * (side < 0 ? 1 : -1);
  const style = {
    strokeColor,
    strokeWidth: ADV.domainMarkers.width,
    fixed: true,
    highlight: false,
    layer: ADV.domainMarkers.layer,
    lineCap: 'round',
    lineJoin: 'round'
  };
  const segments = [];
  const mapped = shape.points.map(([px, py]) => {
    const localX = (px - shape.centerX) * scale * flip;
    const localY = (py - shape.centerY) * scale;
    const [offTx, offTy] = px2world(tx, ty, localX + parallelOffsetPx);
    const [offNx, offNy] = px2world(nx, ny, localY);
    return [xS + offTx + offNx, yS + offTy + offNy];
  });
  for (let i = 0; i < mapped.length - 1; i += 1) {
    const p = mapped[i];
    const q = mapped[i + 1];
    if (!p || !q) continue;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    if (Math.hypot(dx, dy) < 1e-8) continue;
    segments.push(appState.board.create('segment', [p, q], style));
  }
  g._br[side] = segments;
}
function updateAllBrackets() {
  for (const g of appState.graphs) {
    if (!g.domain) {
      removeBracketAt(g, -1);
      removeBracketAt(g, +1);
      continue;
    }
    if (shouldShowDomainMarker(g.domain, -1)) {
      makeBracketAt(g, g.domain.min, -1, !!g.domain.leftClosed);
    } else {
      removeBracketAt(g, -1);
    }
    if (shouldShowDomainMarker(g.domain, +1)) {
      makeBracketAt(g, g.domain.max, +1, !!g.domain.rightClosed);
    } else {
      removeBracketAt(g, +1);
    }
  }
}
function buildCurveLabelContent(fun) {
  var _ADV$curveName, _ADV$curveName2;
  const showName = !!(ADV !== null && ADV !== void 0 && (_ADV$curveName = ADV.curveName) !== null && _ADV$curveName !== void 0 && _ADV$curveName.showName);
  const showExpr = !!(ADV !== null && ADV !== void 0 && (_ADV$curveName2 = ADV.curveName) !== null && _ADV$curveName2 !== void 0 && _ADV$curveName2.showExpression);
  if (!showName && !showExpr) return null;
  const labelRaw = typeof (fun === null || fun === void 0 ? void 0 : fun.label) === 'string' ? fun.label : '';
  const nameRaw = typeof (fun === null || fun === void 0 ? void 0 : fun.name) === 'string' ? fun.name : '';
  const nameTextRaw = labelRaw || nameRaw;
  const exprTextRaw = typeof (fun === null || fun === void 0 ? void 0 : fun.rhs) === 'string' ? fun.rhs : '';
  const nameText = normalizeExpressionText(nameTextRaw || nameRaw);
  const exprText = normalizeExpressionText(exprTextRaw);
  let plain = '';
  if (showName && showExpr) {
    plain = nameText && exprText ? `${nameText} = ${exprText}` : nameText || exprText || '';
  } else if (showName) {
    plain = nameText;
  } else if (showExpr) {
    plain = exprText;
  }
  const nameLatex = showName ? convertExpressionToLatex(nameTextRaw || nameText) : '';
  const exprLatex = showExpr ? convertExpressionToLatex(exprTextRaw || exprText) : '';
  let latex = '';
  if (showName && showExpr) {
    latex = nameLatex && exprLatex ? `${nameLatex} = ${exprLatex}` : nameLatex || exprLatex || '';
  } else if (showName) {
    latex = nameLatex;
  } else if (showExpr) {
    latex = exprLatex;
  }
  if (!plain && !latex) return null;
  const html = latex ? renderLatexToHtml(latex) : '';
  return {
    text: plain || '',
    latex: latex || '',
    html: html || ''
  };
}
function buildFunctions() {
  appState.graphs = [];
  const requiredCount = Math.max(1, Array.isArray(appState.simple.parsed.funcs) ? appState.simple.parsed.funcs.length : 1);
  ensurePaletteCapacity(requiredCount);
  const fallbackColor = normalizeColorValue(getDefaultCurveColor(0))
    || DEFAULT_FUNCTION_COLORS.fallback[0]
    || GRAFTEGNER_FALLBACK_PALETTE[0];
  const palette = resolveCurvePalette(requiredCount);
  appState.simple.parsed.funcs.forEach((f, i) => {
    const defaultColor = normalizeColorValue(palette[i % palette.length]) || fallbackColor;
    let manualColor = '';
    if (f) {
      if (f.colorSource === 'manual') {
        manualColor = normalizeColorValue(f.color) || '';
        if (!manualColor) {
          f.colorSource = 'auto';
          f.color = '';
        }
      } else if (f.color) {
        f.color = '';
      }
    }
    const color = manualColor || defaultColor;
    const lineColor = lineColorForCurve(i);
    const fn = parseFunctionSpec(`${f.name}(x)=${f.rhs}`);
    const labelContent = buildCurveLabelContent(f);
    const g = {
      name: f.name,
      color,
      lineColor,
      manualColor: !!manualColor,
      domain: f.domain || null,
      label: labelContent && labelContent.text || '',
      labelContent,
      expression: f.rhs,
      gliders: [],
      guideArrows: []
    };
    g.fn = x => {
      try {
        const y = fn(x);
        return Number.isFinite(y) ? y : NaN;
      } catch (_) {
        return NaN;
      }
    };
    g.segs = [];

    // usynlig "carrier" for glidere – VIKTIG: STRAMT TIL DOMENET
    const xMinCarrier = g.domain ? g.domain.min : () => appState.board.getBoundingBox()[0];
    const xMaxCarrier = g.domain ? g.domain.max : () => appState.board.getBoundingBox()[2];
    g.carrier = appState.board.create('functiongraph', [g.fn, xMinCarrier, xMaxCarrier], {
      visible: false,
      strokeOpacity: 0,
      fixed: true
    });
    appState.graphs.push(g);
    if (labelContent) {
      makeSmartCurveLabel(g, i, labelContent);
    }
  });
  rebuildAllFunctionSegments();
  updateAllBrackets();
  LAST_FUNCTION_VIEW_SCREEN = fromBoundingBox(appState.board && appState.board.getBoundingBox ? appState.board.getBoundingBox() : null);

  // glidere
  const n = appState.simple.parsed.pointsCount | 0;
  if (n > 0 && appState.graphs.length > 0) {
    const firstFunc = appState.simple.parsed.funcs && appState.simple.parsed.funcs.length ? appState.simple.parsed.funcs[0] : null;
    const gliderTemplate = interpretLineTemplate(firstFunc ? firstFunc.rhs : '');
    const shouldEmitLinePointEvents = !!(gliderTemplate && gliderTemplate.kind);
    const gliders = [];
    const emitLinePointUpdate = (options = {}) => {
      if (!shouldEmitLinePointEvents || typeof window === 'undefined' || gliders.length === 0) {
        return;
      }
      const points = [];
      for (const point of gliders) {
        if (!point) {
          return;
        }
        const x = point.X();
        const y = point.Y();
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
          return;
        }
        points.push([x, y]);
      }
      if (!points.length) {
        return;
      }
      const detail = { points };
      if (options.sync === false) {
        detail.sync = false;
      }
      if (options.markEdited === false) {
        detail.markEdited = false;
      }
      window.dispatchEvent(new CustomEvent('graf:linepoints-changed', { detail }));
    };
    const G = appState.graphs[0];
    const sxList = appState.simple.parsed.startX && appState.simple.parsed.startX.length > 0 ? appState.simple.parsed.startX : ADV.points.startX && ADV.points.startX.length > 0 ? ADV.points.startX : [0];
    function stepXg() {
      return (ADV.points.snap.stepX != null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1;
    }
    const clampToDomain = x => G.domain ? Math.min(G.domain.max, Math.max(G.domain.min, x)) : x;
    const applySnap = P => {
      const xs = clampToDomain(Math.round(P.X() / stepXg()) * stepXg());
      P.moveTo([xs, G.fn(xs)]);
    };
    for (let i = 0; i < n; i++) {
      const xi = sxList[i] != null ? clampToDomain(sxList[i]) : clampToDomain(sxList[0]);
      const baseGliderColor = G.lineColor || lineColorForCurve(0);
      const gliderColor = pointColorFromLineColor(baseGliderColor) || baseGliderColor;
      const P = appState.board.create('glider', [xi, G.fn(xi), G.carrier], {
        name: '',
        withLabel: true,
        face: 'o',
        size: POINT_MARKER_SIZE,
        strokeColor: gliderColor,
        fillColor: gliderColor,
        showInfobox: false
      });
      gliders.push(P);
      applyPointLabelStyling(P.label);

      // HARD KLAMMING TIL DOMENE UNDER DRAG
      P.on('drag', () => {
        let x = clampToDomain(P.X());
        P.moveTo([x, G.fn(x)]);
        if (ADV.points.snap.enabled && (ADV.points.snap.mode || 'up') === 'drag') applySnap(P);
        emitLinePointUpdate({ sync: false });
      });
      if (ADV.points.showCoordsOnHover) {
        applyPointLabelStyling(P.label);
        P.label.setAttribute({
          visible: false
        });
        P.on('over', () => {
          setPointLabelText(P, () => fmtCoordsStatic(P));
          P.label.setAttribute({
            visible: true
          });
        });
        P.on('drag', () => {
          setPointLabelText(P, () => fmtCoordsDrag(P));
          P.label.setAttribute({
            visible: true
          });
        });
        P.on('up', () => {
          setPointLabelText(P, () => fmtCoordsStatic(P));
        });
        P.on('out', () => P.label.setAttribute({
          visible: false
        }));
      }
      if (ADV.points.snap.enabled && (ADV.points.snap.mode || 'up') === 'up') {
        P.on('up', () => {
          applySnap(P);
          emitLinePointUpdate();
        });
      } else {
        P.on('up', () => {
          emitLinePointUpdate();
        });
      }
      if (MODE === 'functions' && ADV.points.guideArrows) {
        const arrowX = appState.board.create('arrow', [() => [P.X(), P.Y()], () => [0, P.Y()]], {
          strokeColor: G.lineColor || lineColorForCurve(0),
          strokeWidth: 2,
          dash: 2,
          lastArrow: true,
          firstArrow: false,
          fixed: true,
          layer: 10,
          highlight: false
        });
        const arrowY = appState.board.create('arrow', [() => [P.X(), P.Y()], () => [P.X(), 0]], {
          strokeColor: G.lineColor || lineColorForCurve(0),
          strokeWidth: 2,
          dash: 2,
          lastArrow: true,
          firstArrow: false,
          fixed: true,
          layer: 10,
          highlight: false
        });
        G.guideArrows.push(arrowX, arrowY);
      }
    }
    G.gliders = gliders.slice();
    emitLinePointUpdate({ sync: false, markEdited: false });
  }
}

/* =================== LINJE FRA PUNKTER =================== */
function buildPointsLine() {
  var _SIMPLE_PARSED$funcs$;
  appState.graphs = [];
  appState.points.A = null;
  appState.points.B = null;
  appState.points.moving = [];
  const fallbackColor = normalizeColorValue(DEFAULT_POINT_COLORS.line)
    || normalizeColorValue(getDefaultCurveColor(0))
    || DEFAULT_FUNCTION_COLORS.fallback[0]
    || GRAFTEGNER_FALLBACK_PALETTE[0];
  const paletteColor = normalizeColorValue(colorFor(0)) || fallbackColor;
  const first = (_SIMPLE_PARSED$funcs$ = appState.simple.parsed.funcs[0]) !== null && _SIMPLE_PARSED$funcs$ !== void 0 ? _SIMPLE_PARSED$funcs$ : {
    rhs: 'ax+b'
  };
  const manualLineColor = first && first.colorSource === 'manual' ? normalizeColorValue(first.color) : '';
  const lineColor = manualLineColor || paletteColor;
  const pointColor = pointColorFromLineColor(lineColor) || lineColorForCurve(0) || lineColor;
  const lineColorManual = !!manualLineColor;
  const template = interpretLineTemplate(first.rhs);
  const kind = template.kind || 'two';
  const anchorC = template.anchorC;
  const slopeM = template.slopeM;
  const start0 = ADV.points.start[0],
    start1 = ADV.points.start[1];
  if (kind === 'two') {
    const P0 = appState.board.create('point', start0.slice(), {
      name: '',
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: pointColor || DEFAULT_POINT_COLORS.fallbackMarkerFill,
      strokeColor: pointColor,
      withLabel: true,
      showInfobox: false
    });
    applyPointLabelStyling(P0.label);
    const P1 = appState.board.create('point', start1.slice(), {
      name: '',
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: pointColor || DEFAULT_POINT_COLORS.fallbackMarkerFill,
      strokeColor: pointColor,
      withLabel: true,
      showInfobox: false
    });
    applyPointLabelStyling(P1.label);
    appState.points.A = P0;
    appState.points.B = P1;
    appState.points.moving = [P0, P1];
  } else if (kind === 'anchorY') {
    const F = appState.board.create('point', [0, anchorC], {
      name: '',
      visible: false,
      fixed: true
    });
    const P = appState.board.create('point', start0.slice(), {
      name: '',
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: pointColor || DEFAULT_POINT_COLORS.fallbackMarkerFill,
      strokeColor: pointColor,
      withLabel: true,
      showInfobox: false
    });
    applyPointLabelStyling(P.label);
    appState.points.A = F;
    appState.points.B = P;
    appState.points.moving = [P];
  } else {
    const P = appState.board.create('point', start0.slice(), {
      name: '',
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: pointColor || DEFAULT_POINT_COLORS.fallbackMarkerFill,
      strokeColor: pointColor,
      withLabel: true,
      showInfobox: false
    });
    applyPointLabelStyling(P.label);
    const Q = appState.board.create('point', [() => P.X() + 1, () => P.Y() + slopeM], {
      name: '',
      visible: false,
      fixed: true
    });
    appState.points.A = P;
    appState.points.B = Q;
    appState.points.moving = [P];
  }
  const line = appState.board.create('line', [appState.points.A, appState.points.B], {
    strokeColor: lineColor,
    strokeWidth: 4
  });
  const labelFun = appState.simple.parsed.funcs && appState.simple.parsed.funcs.length ? appState.simple.parsed.funcs[0] : null;
  const labelContent = labelFun ? buildCurveLabelContent(labelFun) : null;
  let updateLabelWithAB = null;
  if (labelContent && labelFun) {
    const templateForLabel = interpretLineTemplate(labelFun.rhs || '');
    if (templateForLabel && templateForLabel.kind === 'two') {
      const baseText = labelContent.text || '';
      const baseLatex = labelContent.latex || '';
      const baseHtml = labelContent.html || '';
      const extractLhs = value => {
        if (typeof value !== 'string') return '';
        const eqIndex = value.indexOf('=');
        if (eqIndex === -1) return '';
        return value.slice(0, eqIndex).trim();
      };
      updateLabelWithAB = () => {
        const shouldShowExpression = !!(ADV.curveName && ADV.curveName.showExpression);
        if (!shouldShowExpression) {
          if (labelContent.text !== baseText || labelContent.latex !== baseLatex || labelContent.html !== baseHtml) {
            labelContent.text = baseText;
            labelContent.latex = baseLatex;
            labelContent.html = baseHtml;
          }
          return;
        }
        const { m, b } = currentMB();
        if (!Number.isFinite(m) || !Number.isFinite(b)) {
          if (labelContent.text !== baseText || labelContent.latex !== baseLatex || labelContent.html !== baseHtml) {
            labelContent.text = baseText;
            labelContent.latex = baseLatex;
            labelContent.html = baseHtml;
          }
          return;
        }
        const normalizedLabel = normalizeExpressionText(labelFun.label || '') || (labelFun.name || '').trim();
        const lhsText = extractLhs(baseText) || normalizedLabel || 'y';
        const latexSource = labelFun.label || labelFun.name || normalizedLabel || 'y';
        const lhsLatex = extractLhs(baseLatex) || convertExpressionToLatex(latexSource) || convertExpressionToLatex('y') || 'y';
        const nextText = formatLineEquation(lhsText, m, b, fracPlain);
        const nextLatex = formatLineEquation(lhsLatex, m, b, fracLatex);
        if (!nextText || !nextLatex) {
          if (labelContent.text !== baseText || labelContent.latex !== baseLatex || labelContent.html !== baseHtml) {
            labelContent.text = baseText;
            labelContent.latex = baseLatex;
            labelContent.html = baseHtml;
          }
          return;
        }
        if (labelContent.text !== nextText || labelContent.latex !== nextLatex) {
          labelContent.text = nextText;
          labelContent.latex = nextLatex;
          labelContent.html = renderLatexToHtml(nextLatex);
        }
      };
      updateLabelWithAB();
    }
  }
  if (labelContent) {
    const g = {
      color: lineColor,
      manualColor: lineColorManual,
      domain: null,
      label: labelContent.text || '',
      labelContent,
      expression: labelFun.rhs || '',
      gliders: Array.isArray(appState.points.moving) ? appState.points.moving.slice() : [],
      segs: [line]
    };
    g.fn = x => {
      if (!appState.points.A || !appState.points.B || typeof appState.points.A.X !== 'function' || typeof appState.points.A.Y !== 'function' || typeof appState.points.B.X !== 'function' || typeof appState.points.B.Y !== 'function') {
        return NaN;
      }
      const x1 = appState.points.A.X();
      const y1 = appState.points.A.Y();
      const x2 = appState.points.B.X();
      const y2 = appState.points.B.Y();
      if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
        return NaN;
      }
      const dx = x2 - x1;
      if (Math.abs(dx) < 1e-9) {
        return NaN;
      }
      const m = (y2 - y1) / dx;
      return y1 + m * (x - x1);
    };
    appState.graphs.push(g);
    makeSmartCurveLabel(g, 0, labelContent);
    const refreshLabelPosition = () => {
      if (g && typeof g._repositionLabel === 'function') {
        g._repositionLabel(true);
      }
    };
    if (Array.isArray(appState.points.moving)) {
      appState.points.moving.forEach(point => {
        if (!point || typeof point.on !== 'function') return;
        point.on('drag', refreshLabelPosition);
        point.on('up', refreshLabelPosition);
      });
    }
  }
  function stepXv() {
    return (ADV.points.snap.stepX != null ? ADV.points.snap.stepX : +ADV.axis.grid.majorX) || 1;
  }
  function stepYv() {
    return (ADV.points.snap.stepY != null ? ADV.points.snap.stepY : +ADV.axis.grid.majorY) || 1;
  }
  function snap(P) {
    P.moveTo([nearestMultiple(P.X(), stepXv()), nearestMultiple(P.Y(), stepYv())]);
  }
  const emitLinePointUpdate = (options = {}) => {
    if (typeof updateLabelWithAB === 'function') {
      updateLabelWithAB();
    }
    if (typeof window === 'undefined' || !Array.isArray(appState.points.moving) || appState.points.moving.length === 0) {
      return;
    }
    const sample = kind === 'two' ? appState.points.moving : appState.points.moving.slice(0, 1);
    const points = [];
    for (const point of sample) {
      if (!point) {
        continue;
      }
      const x = point.X();
      const y = point.Y();
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }
      points.push([x, y]);
    }
    if (!points.length) {
      return;
    }
    const detail = { points };
    if (options.sync === false) {
      detail.sync = false;
    }
    if (options.markEdited === false) {
      detail.markEdited = false;
    }
    window.dispatchEvent(new CustomEvent('graf:linepoints-changed', { detail }));
  };
  if (ADV.points.snap.enabled) {
    const mode = ADV.points.snap.mode || 'up';
    for (const P of appState.points.moving) {
      if (mode === 'drag') P.on('drag', () => snap(P));else P.on('up', () => {
        snap(P);
        if (P.label) setPointLabelText(P, () => fmtCoordsStatic(P));
      });
    }
  }
  if (ADV.points.showCoordsOnHover) {
    for (const P of appState.points.moving) {
      applyPointLabelStyling(P.label);
      P.label.setAttribute({
        visible: false
      });
      P.on('over', () => {
        setPointLabelText(P, () => fmtCoordsStatic(P));
        P.label.setAttribute({
          visible: true
        });
      });
      P.on('drag', () => {
        setPointLabelText(P, () => fmtCoordsDrag(P));
        P.label.setAttribute({
          visible: true
        });
      });
      P.on('up', () => {
        setPointLabelText(P, () => fmtCoordsStatic(P));
      });
      P.on('out', () => P.label.setAttribute({
        visible: false
      }));
    }
  }
  if (Array.isArray(appState.points.moving)) {
    for (const P of appState.points.moving) {
      P.on('drag', () => emitLinePointUpdate({ sync: false }));
      P.on('up', () => emitLinePointUpdate());
    }
  }
  emitLinePointUpdate({ sync: false, markEdited: false });

}

/* ====== MB fra punktene + tolke fasit-uttrykk robust ====== */
function currentMB() {
  const dx = appState.points.B.X() - appState.points.A.X();
  const m = Math.abs(dx) < 1e-12 ? NaN : (appState.points.B.Y() - appState.points.A.Y()) / dx;
  const b = Number.isFinite(m) ? appState.points.A.Y() - m * appState.points.A.X() : NaN;
  return {
    m,
    b
  };
}
function parseAnswerToMB(answerLine) {
  const rhs = String(answerLine).split('=').slice(1).join('=').trim();
  if (!rhs) return null;
  const fn = parseFunctionSpec(`f(x)=${rhs}`);
  try {
    const b = fn(0);
    const m = fn(1) - b;
    if (!Number.isFinite(m) || !Number.isFinite(b)) return null;
    return {
      m,
      b
    };
  } catch (_) {
    return null;
  }
}

function formatAnswerNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '';
  }
  return toFixedTrim(value, 6).replace('.', ',');
}

function parseNumericValue(str) {
  if (typeof str !== 'string') return null;
  const cleaned = str.trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(',', '.');
  if (/^[+-]?\d+\s*\/\s*\d+$/.test(normalized)) {
    const parts = normalized.split('/');
    const numerator = Number.parseFloat(parts[0]);
    const denominator = Number.parseFloat(parts[1]);
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
      return null;
    }
    return numerator / denominator;
  }
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseAssignmentList(answerLine) {
  if (typeof answerLine !== 'string') return null;
  const normalized = answerLine
    .replace(/&&/g, ',')
    .replace(/\b(?:og|and)\b/gi, ',');
  const parts = normalized.split(/[,;]+/).map(part => part.trim()).filter(Boolean);
  if (!parts.length) return null;
  const assignments = [];
  for (const part of parts) {
    const match = part.match(/^([a-zA-Z]\w*)\s*=\s*(.+)$/);
    if (!match) continue;
    const label = match[1];
    const value = parseNumericValue(match[2]);
    if (value == null) continue;
    assignments.push({ label, value });
  }
  if (!assignments.length) return null;
  const slope = assignments.find(item => /^(a|m)$/i.test(item.label)) || null;
  const intercept = assignments.find(item => /^(b|c)$/i.test(item.label)) || null;
  return {
    assignments,
    slope: slope ? { label: slope.label, value: slope.value } : null,
    intercept: intercept ? { label: intercept.label, value: intercept.value } : null
  };
}

function summarizeAssignments(assignments) {
  if (!Array.isArray(assignments) || !assignments.length) {
    return '';
  }
  return assignments
    .map(item => `${item.label} = ${formatAnswerNumber(item.value)}`)
    .join(', ');
}

function parseLineAnswerSpec(answerLine) {
  const trimmed = typeof answerLine === 'string' ? answerLine.trim() : '';
  if (!trimmed) return null;
  const exprSpec = parseAnswerToMB(trimmed);
  if (exprSpec) {
    const summary = normalizeExpressionText(trimmed) || linearStr(exprSpec.m, exprSpec.b);
    return {
      source: 'expression',
      summary,
      slope: { required: true, value: exprSpec.m, label: 'm' },
      intercept: { required: true, value: exprSpec.b, label: 'b' }
    };
  }
  const assignments = parseAssignmentList(trimmed);
  if (assignments) {
    const summary = summarizeAssignments(assignments.assignments);
    const spec = {
      source: 'assignments',
      summary,
      slope: assignments.slope ? { required: true, value: assignments.slope.value, label: assignments.slope.label } : null,
      intercept: assignments.intercept ? { required: true, value: assignments.intercept.value, label: assignments.intercept.label } : null
    };
    if (!spec.slope && !spec.intercept) {
      return null;
    }
    return spec;
  }
  return null;
}

function formatPointList(points) {
  if (!Array.isArray(points)) return '';
  return points.map(pt => formatPointForInput(pt)).filter(Boolean).join('; ');
}

function clampValueToDomain(x, domain) {
  if (typeof x !== 'number' || !Number.isFinite(x)) return NaN;
  if (!domain || typeof domain !== 'object') {
    return x;
  }
  let clamped = x;
  if (Number.isFinite(domain.min) && clamped < domain.min) {
    clamped = domain.min;
  }
  if (Number.isFinite(domain.max) && clamped > domain.max) {
    clamped = domain.max;
  }
  return clamped;
}

function extractGliderAnswerXValues(text) {
  if (typeof text !== 'string') return [];
  const str = text.trim();
  if (!str) return [];
  const entries = [];
  const pairRegex = /\(\s*[^()]*\)/g;
  let match;
  while ((match = pairRegex.exec(str)) !== null) {
    const inner = match[0];
    const numberRegex = /-?\d+(?:[.,]\d+)?/g;
    const numberMatch = numberRegex.exec(inner);
    if (!numberMatch) continue;
    const value = Number.parseFloat(numberMatch[0].replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    entries.push({ index: match.index + numberMatch.index, value });
  }
  const cleaned = str.replace(pairRegex, ' ');
  const numRegex = /-?\d+(?:[.,]\d+)?/g;
  while ((match = numRegex.exec(cleaned)) !== null) {
    const value = Number.parseFloat(match[0].replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    entries.push({ index: match.index, value });
  }
  entries.sort((a, b) => a.index - b.index);
  return entries.map(entry => entry.value).filter(Number.isFinite);
}

function getFunctionGliderPoints(funcIndex) {
  if (!Array.isArray(appState.graphs) || !Number.isInteger(funcIndex) || funcIndex < 0) {
    return [];
  }
  const graph = appState.graphs[funcIndex];
  if (!graph || !Array.isArray(graph.gliders)) {
    return [];
  }
  const points = [];
  for (const glider of graph.gliders) {
    if (!glider) continue;
    const x = typeof glider.X === 'function' ? glider.X() : Number.isFinite(glider.X) ? glider.X : NaN;
    const y = typeof glider.Y === 'function' ? glider.Y() : Number.isFinite(glider.Y) ? glider.Y : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      continue;
    }
    points.push([x, y]);
  }
  return points;
}

function evaluateFunctionGliderAnswer(answerText, rowSpec, index) {
  const funcIndex = rowSpec && Number.isFinite(rowSpec.funcIndex) ? rowSpec.funcIndex : index;
  const funcs = Array.isArray(appState.simple.parsed.funcs) ? appState.simple.parsed.funcs : [];
  const fun = funcs[funcIndex];
  if (!fun || !fun.rhs) {
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} kan ikke kontrolleres.`
    };
  }
  const gliderPoints = getFunctionGliderPoints(funcIndex);
  if (!gliderPoints.length) {
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} kan ikke kontrolleres.`
    };
  }
  const fnName = fun.name || 'f';
  const evaluator = parseFunctionSpec(`${fnName}(x)=${fun.rhs}`);
  if (typeof evaluator !== 'function') {
    return {
      ok: false,
      type: 'error',
      message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
    };
  }
  let xs = extractGliderAnswerXValues(answerText);
  if (!xs.length) {
    const points = parsePointListString(answerText);
    if (points.length) {
      xs = points.map(pt => (Array.isArray(pt) && Number.isFinite(pt[0])) ? pt[0] : NaN).filter(Number.isFinite);
    }
  }
  if (!xs.length) {
    return {
      ok: false,
      type: 'error',
      message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
    };
  }
  const needed = gliderPoints.length;
  if (xs.length < needed) {
    return {
      ok: false,
      type: 'error',
      message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
    };
  }
  const expectedPoints = [];
  for (let i = 0; i < needed; i++) {
    const rawX = xs[i];
    const x = clampValueToDomain(rawX, fun.domain);
    const y = evaluator(x);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        ok: false,
        type: 'error',
        message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
      };
    }
    expectedPoints.push([x, y]);
  }
  const actualPoints = gliderPoints.slice(0, needed);
  const expectedStr = formatPointList(expectedPoints);
  const actualStr = formatPointList(actualPoints);
  for (let i = 0; i < needed; i++) {
    if (!pointsRoughlyEqual(expectedPoints[i], actualPoints[i])) {
      return {
        ok: false,
        type: 'error',
        message: `Funksjon ${index + 1} stemmer ikke. Forventet ${expectedStr}. Nå: ${actualStr}.`
      };
    }
  }
  const detail = expectedStr ? `Funksjon ${index + 1}: ${expectedStr}.` : `Funksjon ${index + 1} er riktig.`;
  return {
    ok: true,
    message: detail
  };
}

function evaluateLineAnswer(spec, index) {
  if (typeof currentMB !== 'function') {
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} kan ikke kontrolleres.`
    };
  }
  const { m, b } = currentMB();
  if (!Number.isFinite(m) || !Number.isFinite(b)) {
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} kan ikke kontrolleres.`
    };
  }
  let slopeOk = true;
  if (spec.slope && spec.slope.required) {
    slopeOk = Math.abs(m - spec.slope.value) <= ADV.check.slopeTol;
  }
  let interceptOk = true;
  if (spec.intercept && spec.intercept.required) {
    interceptOk = Math.abs(b - spec.intercept.value) <= ADV.check.interTol;
  }
  if (!slopeOk || !interceptOk) {
    const expected = spec.summary || linearStr(spec.slope ? spec.slope.value : m, spec.intercept ? spec.intercept.value : b);
    return {
      ok: false,
      type: 'error',
      message: `Funksjon ${index + 1} stemmer ikke. Forventet ${expected}. Nå: ${linearStr(m, b)}.`
    };
  }
  const detail = spec.summary ? `Funksjon ${index + 1}: ${spec.summary}.` : `Funksjon ${index + 1} er riktig.`;
  return {
    ok: true,
    message: detail
  };
}

function pointsRoughlyEqual(a, b, tolerance = 1e-3) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) {
    return false;
  }
  return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance;
}

function evaluateCoordinateAnswer(expectedPoints, rowSpec, index) {
  if (!Array.isArray(expectedPoints) || !expectedPoints.length) {
    return {
      ok: false,
      type: 'error',
      message: `Punkt ${index + 1} har ingen fasit.`
    };
  }
  const start = rowSpec && Number.isFinite(rowSpec.pointStart) ? rowSpec.pointStart : 0;
  const count = rowSpec && Number.isFinite(rowSpec.pointCount) ? rowSpec.pointCount : expectedPoints.length;
  const actualSource = Array.isArray(appState.simple.parsed.extraPoints) ? appState.simple.parsed.extraPoints : [];
  const actualPoints = actualSource.slice(start, start + count);
  const expectedStr = formatPointList(expectedPoints);
  const actualStr = formatPointList(actualPoints);
  if (actualPoints.length < expectedPoints.length) {
    return {
      ok: false,
      type: 'error',
      message: `Punkt ${index + 1} stemmer ikke. Forventet ${expectedStr}. Nå: ${actualStr}.`
    };
  }
  for (let i = 0; i < expectedPoints.length; i++) {
    if (!pointsRoughlyEqual(expectedPoints[i], actualPoints[i])) {
      return {
        ok: false,
        type: 'error',
        message: `Punkt ${index + 1} stemmer ikke. Forventet ${expectedStr}. Nå: ${actualStr}.`
      };
    }
  }
  return {
    ok: true,
    message: `Punkt ${index + 1}: ${expectedStr}.`
  };
}

function evaluateAnswerForRow(answer, index) {
  const trimmed = typeof answer === 'string' ? answer.trim() : '';
  if (!trimmed) {
    return { ok: true, message: '' };
  }
  const rows = Array.isArray(appState.simple.parsed.rows) ? appState.simple.parsed.rows : [];
  const rowSpec = rows[index] || null;
  if (rowSpec && rowSpec.type === 'function') {
    if (MODE === 'points') {
      const spec = parseLineAnswerSpec(trimmed);
      if (!spec) {
        return {
          ok: false,
          type: 'error',
          message: `Kunne ikke tolke fasit for funksjon ${index + 1}.`
        };
      }
      return evaluateLineAnswer(spec, index);
    }
    return evaluateFunctionGliderAnswer(trimmed, rowSpec, index);
  }
  if (rowSpec && rowSpec.type === 'coords') {
    const expected = parsePointListString(trimmed);
    if (!expected.length) {
      return {
        ok: false,
        type: 'error',
        message: `Kunne ikke tolke fasit for punkt ${index + 1}.`
      };
    }
    return evaluateCoordinateAnswer(expected, rowSpec, index);
  }
  const fallbackPoints = parsePointListString(trimmed);
  if (fallbackPoints.length) {
    return evaluateCoordinateAnswer(fallbackPoints, rowSpec, index);
  }
  if (MODE === 'points') {
    const spec = parseLineAnswerSpec(trimmed);
    if (spec) {
      return evaluateLineAnswer(spec, index);
    }
  }
  return {
    ok: false,
    type: 'error',
    message: `Fasit for rad ${index + 1} er ikke støttet.`
  };
}

function evaluateAnswers() {
  const answers = Array.isArray(appState.simple.parsed.answers) ? appState.simple.parsed.answers : [];
  const messages = [];
  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i];
    if (!answer || !String(answer).trim()) {
      continue;
    }
    const evaluation = evaluateAnswerForRow(answer, i);
    if (!evaluation) {
      return {
        ok: false,
        type: 'error',
        message: 'Kunne ikke tolke fasit.'
      };
    }
    if (!evaluation.ok) {
      return evaluation;
    }
    if (evaluation.message) {
      messages.push(evaluation.message.trim());
    }
  }
  return {
    ok: true,
    details: messages.join(' ').trim()
  };
}

const TASK_APP_ID = 'graftegner';

function getTaskApi() {
  if (typeof window === 'undefined') return null;
  return window.MathVisualsTaskApi || null;
}

function registerTaskAdapter() {
  const taskApi = getTaskApi();
  if (!taskApi || typeof taskApi.registerTaskAdapter !== 'function') return;
  taskApi.registerTaskAdapter(TASK_APP_ID, {
    collectInputs() {
      if (typeof taskApi.evaluateDescriptionInputs === 'function') {
        taskApi.evaluateDescriptionInputs();
      }
    },
    evaluateAnswers() {
      return evaluateAnswers();
    },
    resetAnswers() {
      if (typeof taskApi.resetDescriptionInputs === 'function') {
        taskApi.resetDescriptionInputs();
      }
    }
  });
}

registerTaskAdapter();

function setupTaskCheck() {
  const answers = Array.isArray(appState.simple.parsed.answers) ? appState.simple.parsed.answers : [];
  const hasAnswers = answers.some(answer => typeof answer === 'string' && answer.trim());
  if (!hasAnswers) {
    hideCheckControls();
    return;
  }
  const controls = ensureCheckControls();
  if (!controls) return;
  const { btn, msg, setStatus } = controls;
  if (btn) {
    btn.style.display = '';
  }
  if (msg) {
    msg.style.display = '';
  }
  setStatus('info', '');
  if (btn) {
    btn.onclick = () => {
      const taskApi = getTaskApi();
      const result =
        taskApi && typeof taskApi.evaluateTask === 'function'
          ? taskApi.evaluateTask(TASK_APP_ID)
          : evaluateAnswers();
      if (!result) {
        setStatus('error', 'Kunne ikke tolke fasit.');
        return;
      }
      if (result.ok) {
        const suffix = result.details ? ` ${result.details}` : '';
        setStatus('success', `Riktig!${suffix}`);
      } else {
        const statusType = result.type === 'info' ? 'info' : 'error';
        setStatus(statusType, result.message || 'Ikke helt.');
      }
    };
  }
}
function formatPointCoordinateForInput(value, step) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (Number.isFinite(step) && step > 0) {
    return fmtSmartVal(value, step);
  }
  return toFixedTrim(value, ADV.points.decimals);
}
function formatPointForInput(pt) {
  if (!Array.isArray(pt) || pt.length < 2) return '';
  const [x, y] = pt;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return '';
  const formattedX = formatPointCoordinateForInput(x, stepX());
  const formattedY = formatPointCoordinateForInput(y, stepY());
  if (!formattedX || !formattedY) return '';
  return `(${formattedX}, ${formattedY})`;
}
function formatExtraPointsForInput(points) {
  if (!Array.isArray(points)) return '';
  return points.map(formatPointForInput).filter(Boolean).join('; ');
}
function pointLabelForIndex(index) {
  if (!Number.isInteger(index) || index < 0) return '';
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const base = alphabet.length;
  let n = index;
  let label = '';
  do {
    label = `${alphabet[n % base]}${label}`;
    n = Math.floor(n / base) - 1;
  } while (n >= 0);
  return label;
}
function updateCoordsInputFromPoints(points, options = {}) {
  if (typeof document === 'undefined') return;
  const { triggerInput = false, triggerChange = false, pointIndex = null } = options;
  const rows = Array.isArray(appState.simple.parsed && appState.simple.parsed.rows)
    ? appState.simple.parsed.rows
    : [];
  let targetRowIndex = null;
  let rowSpec = null;
  if (Number.isInteger(pointIndex) && pointIndex >= 0) {
    for (let i = 0; i < rows.length; i += 1) {
      const spec = rows[i];
      if (!spec || spec.type !== 'coords') continue;
      const start = Number.isFinite(spec.pointStart) ? spec.pointStart : 0;
      const count = Number.isFinite(spec.pointCount) ? spec.pointCount : points.length;
      const end = start + Math.max(0, count);
      if (pointIndex >= start && pointIndex < end) {
        targetRowIndex = i;
        rowSpec = spec;
        break;
      }
    }
  }
  const targetIndex = targetRowIndex != null ? targetRowIndex + 1 : 1;
  const targetGroup = funcRows ? funcRows.querySelector(`.func-group[data-index="${targetIndex}"]`) : null;
  if (!targetGroup) return;
  const input = targetGroup.querySelector('[data-fun]');
  if (!input) return;
  let pointsForInput = points;
  if (rowSpec && Array.isArray(points)) {
    const start = Number.isFinite(rowSpec.pointStart) ? rowSpec.pointStart : 0;
    const count = Number.isFinite(rowSpec.pointCount) ? rowSpec.pointCount : points.length - start;
    pointsForInput = points.slice(start, start + Math.max(0, count));
  }
  const nextValue = formatExtraPointsForInput(pointsForInput);
  let currentValue = '';
  if ('value' in input) {
    currentValue = input.value != null ? String(input.value) : '';
  } else if (typeof input.textContent === 'string') {
    currentValue = input.textContent;
  }
  if (nextValue === currentValue) {
    if (triggerInput || triggerChange) {
      if (triggerInput) {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (triggerChange) {
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    return;
  }
  const tag = input.tagName ? input.tagName.toUpperCase() : '';
  if (tag === 'MATH-FIELD' && typeof input.setValue === 'function') {
    try {
      input.setValue(nextValue, { format: 'ascii-math' });
    } catch (_) {
      if ('value' in input) {
        input.value = nextValue;
      }
    }
  } else if ('value' in input) {
    input.value = nextValue;
  } else {
    input.textContent = nextValue;
  }
  if (triggerInput) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (triggerChange) {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
}
function addFixedPoints() {
  if (!Array.isArray(appState.simple.parsed.extraPoints)) return;
  const parsedMarkerList = Array.isArray(appState.simple.parsed.pointMarkers)
    ? appState.simple.parsed.pointMarkers
    : [];
  const markerList = parsedMarkerList.length || appState.simple.parsed.markerExplicitEmpty
    ? parsedMarkerList
    : parsePointMarkerList(ADV.points.marker);
  const lockList = Array.isArray(appState.simple.parsed.pointLocks) ? appState.simple.parsed.pointLocks : [];
  const showPointNames = !!(ADV.curveName && ADV.curveName.showName);
  const pointObjects = [];
  const coordRows = Array.isArray(appState.simple.parsed.rows)
    ? appState.simple.parsed.rows.filter(row => row && row.type === 'coords')
    : [];
  const getCoordsRowColorForIndex = idx => {
    if (!Number.isInteger(idx) || idx < 0) return '';
    for (const row of coordRows) {
      const start = Number.isFinite(row.pointStart) ? row.pointStart : 0;
      const count = Number.isFinite(row.pointCount) ? row.pointCount : 0;
      if (count <= 0) continue;
      const end = start + count;
      if (idx >= start && idx < end) {
        return normalizeColorValue(row.color) || '';
      }
    }
    return '';
  };
  const polylinePointIndexes = new Set();
  coordRows.forEach(row => {
    const start = Number.isFinite(row.pointStart) ? row.pointStart : 0;
    const count = Number.isFinite(row.pointCount) ? row.pointCount : 0;
    if (count >= 2) {
      for (let i = start; i < start + count; i += 1) {
        polylinePointIndexes.add(i);
      }
    }
  });
  const hidePolylineMarkers = !!appState.simple.parsed.markerExplicitEmpty && polylinePointIndexes.size > 0;
  appState.simple.parsed.extraPoints.forEach((pt, idx) => {
    const rowColor = getCoordsRowColorForIndex(idx);
    const basePointColor = rowColor
      || DEFAULT_POINT_COLORS.line
      || DEFAULT_POINT_COLORS.fallbackMarkerFill;
    const pointColor = pointColorFromLineColor(basePointColor)
      || basePointColor
      || DEFAULT_POINT_COLORS.fallbackMarkerFill;
    const pointStroke = pointColor
      || DEFAULT_POINT_COLORS.fallbackMarkerStroke;
    const customPointName = Array.isArray(appState.simple.parsed.pointNames)
      ? appState.simple.parsed.pointNames[idx]
      : null;
    const pointLabel = showPointNames ? (customPointName || pointLabelForIndex(idx)) : '';
    const pointLocked = lockList.length ? !!lockList[Math.min(idx, lockList.length - 1)] : !!ADV.points.lockExtraPoints;
    const pointOptions = {
      name: pointLabel,
      size: POINT_MARKER_SIZE,
      face: 'o',
      fillColor: pointColor,
      strokeColor: pointStroke,
      withLabel: true,
      fixed: pointLocked,
      showInfobox: false,
      label: {
        visible: showPointNames,
        offset: [10, 10]
      }
    };
    const markerCandidate = markerValueForIndex(markerList, idx);
    const markerValue = sanitizePointMarkerValue(markerCandidate);
    const markerStyle = hidePolylineMarkers && polylinePointIndexes.has(idx)
      ? { type: 'none' }
      : resolvePointMarkerStyle(markerValue);
    if (markerStyle.type === 'circle') {
      pointOptions.face = 'o';
      pointOptions.size = markerStyle.size;
      pointOptions.fillOpacity = markerStyle.fillOpacity;
      pointOptions.strokeOpacity = markerStyle.strokeOpacity;
    } else if (markerStyle.type === 'none') {
      pointOptions.strokeOpacity = 0;
      pointOptions.fillOpacity = 0;
      pointOptions.size = 0;
      pointOptions.withLabel = false;
      pointOptions.label = { visible: false };
      pointOptions.visible = false;
    } else {
      pointOptions.strokeOpacity = 0;
      pointOptions.fillOpacity = 0;
    }
    const P = appState.board.create('point', pt.slice(), pointOptions);
    pointObjects.push(P);
    applyPointLabelStyling(P.label);
    if (markerStyle.type === 'text') {
      appState.board.create('text', [() => P.X(), () => P.Y(), markerStyle.text], {
        anchorX: 'middle',
        anchorY: 'middle',
        fontSize: 24,
        strokeColor: pointStroke,
        fixed: true,
        layer: 9
      });
    }
    const hasHoverCoords = !!ADV.points.showCoordsOnHover;
    if (P.label && showPointNames) {
      setPointLabelText(P, pointLabel);
      P.label.setAttribute({
        visible: true
      });
    }
    if (hasHoverCoords) {
      const restorePointLabel = () => {
        if (!P.label) return;
        if (showPointNames) {
          setPointLabelText(P, pointLabel);
          P.label.setAttribute({
            visible: true
          });
        } else {
          P.label.setAttribute({
            visible: false
          });
        }
      };
      if (P.label && !showPointNames) {
        P.label.setAttribute({
          visible: false
        });
      }
      P.on('over', () => {
        setPointLabelText(P, () => fmtCoordsStatic(P));
        P.label.setAttribute({
          visible: true
        });
      });
      P.on('out', restorePointLabel);
    }
    if (!pointLocked) {
      const updatePointState = commit => {
        if (!Array.isArray(appState.simple.parsed.extraPoints)) return;
        const x = typeof P.X === 'function' ? P.X() : NaN;
        const y = typeof P.Y === 'function' ? P.Y() : NaN;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        appState.simple.parsed.extraPoints[idx] = [x, y];
        updateCoordsInputFromPoints(appState.simple.parsed.extraPoints, {
          triggerInput: true,
          triggerChange: !!commit,
          pointIndex: idx
        });
      };
      const snapMode = ADV.points.snap.mode || 'up';
      const snapEnabled = !!ADV.points.snap.enabled;
      const shouldSnapOnDrag = snapEnabled && snapMode === 'drag';
      const shouldSnapOnUp = snapEnabled && snapMode !== 'drag';
      const applySnap = () => {
        const x = nearestMultiple(P.X(), stepX());
        const y = nearestMultiple(P.Y(), stepY());
        P.moveTo([x, y]);
      };
      P.on('drag', () => {
        if (shouldSnapOnDrag) {
          applySnap();
        }
        updatePointState(false);
      });
      P.on('up', () => {
        if (shouldSnapOnUp) {
          applySnap();
        }
        updatePointState(true);
      });
    }
  });
  if (pointObjects.length >= 2 && coordRows.length) {
    coordRows.forEach(row => {
      const start = Number.isFinite(row.pointStart) ? row.pointStart : 0;
      const count = Number.isFinite(row.pointCount) ? row.pointCount : 0;
      if (count < 2) return;
      const rowColor = normalizeColorValue(row.color);
      const segmentColor = rowColor
        || DEFAULT_POINT_COLORS.line
        || DEFAULT_POINT_COLORS.markerStroke
        || DEFAULT_POINT_COLORS.fallbackMarkerStroke;
      const slice = pointObjects.slice(start, start + count).filter(Boolean);
      for (let i = 1; i < slice.length; i += 1) {
        appState.board.create('segment', [slice[i - 1], slice[i]], {
          strokeColor: segmentColor,
          strokeWidth: DEFAULT_LINE_THICKNESS,
          fixed: true,
          highlight: false
        });
      }
    });
  }
}

/* ================= bygg valgt modus ================= */
function hideCheckControls() {
  const btn = document.getElementById('btnCheck');
  const msg = document.getElementById('checkMsg');
  if (btn) {
    btn.style.display = 'none';
    btn.onclick = null;
  }
  if (msg) {
    msg.style.display = 'none';
    msg.textContent = '';
    msg.className = 'status status--info';
  }
}

function resetViewChangeScheduling() {
  if (PENDING_VIEW_CHANGE_HANDLE) {
    clearTimeout(PENDING_VIEW_CHANGE_HANDLE);
    PENDING_VIEW_CHANGE_HANDLE = null;
  }
  LAST_FUNCTION_VIEW_SCREEN = null;
}

function screensDifferBeyondNoise(prev, next) {
  if (!Array.isArray(prev) || prev.length !== 4 || !Array.isArray(next) || next.length !== 4) return true;
  const prevWidth = Math.abs(prev[1] - prev[0]);
  const prevHeight = Math.abs(prev[3] - prev[2]);
  const nextWidth = Math.abs(next[1] - next[0]);
  const nextHeight = Math.abs(next[3] - next[2]);
  const normWidth = Math.max(prevWidth, nextWidth, 1e-9);
  const normHeight = Math.max(prevHeight, nextHeight, 1e-9);
  const spanDiff = Math.max(Math.abs(nextWidth - prevWidth) / normWidth, Math.abs(nextHeight - prevHeight) / normHeight);
  const prevCX = (prev[0] + prev[1]) / 2;
  const prevCY = (prev[2] + prev[3]) / 2;
  const nextCX = (next[0] + next[1]) / 2;
  const nextCY = (next[2] + next[3]) / 2;
  const centerDiff = Math.max(Math.abs(nextCX - prevCX) / normWidth, Math.abs(nextCY - prevCY) / normHeight);
  const CHANGE_THRESHOLD = 1e-3;
  return spanDiff > CHANGE_THRESHOLD || centerDiff > CHANGE_THRESHOLD;
}

function queueFunctionViewUpdate(screen) {
  if (MODE !== 'functions') return;
  if (!Array.isArray(screen) || screen.length !== 4) return;
  const screenCopy = screen.slice(0, 4);
  if (PENDING_VIEW_CHANGE_HANDLE) {
    clearTimeout(PENDING_VIEW_CHANGE_HANDLE);
  }
  PENDING_VIEW_CHANGE_HANDLE = setTimeout(() => {
    PENDING_VIEW_CHANGE_HANDLE = null;
    if (!appState.board || MODE !== 'functions') return;
    const latest = fromBoundingBox(appState.board.getBoundingBox()) || screenCopy;
    if (!Array.isArray(latest) || latest.length !== 4) return;
    if (!screensDifferBeyondNoise(LAST_FUNCTION_VIEW_SCREEN, latest)) return;
    LAST_FUNCTION_VIEW_SCREEN = latest.slice(0, 4);
    rebuildAllFunctionSegments();
    updateAllBrackets();
  }, VIEW_CHANGE_DEBOUNCE_MS);
}

/* ================= Oppdater / resize ================= */
  function updateAfterViewChange() {
    if (IS_SETTING_BOUNDING_BOX || !appState.board) return;
    const bb = appState.board.getBoundingBox();
    let currentScreen = fromBoundingBox(bb);
    if (!currentScreen) return;

    // 2. Sjekk om vi bryter 1. kvadrant-reglene
    if (ADV.firstQuadrant) {
       // Hvis vi har zoomet/panorert oss bort fra -0.5, tving oss tilbake
       // Men tillat at max-verdiene endres (zoom ut/inn)
       const PADDING = 0.5;
       let [xmin, xmax, ymin, ymax] = currentScreen;
       let changed = false;

       if (Math.abs(xmin - (-PADDING)) > 0.1) { xmin = -PADDING; changed = true; }
       if (Math.abs(ymin - (-PADDING)) > 0.1) { ymin = -PADDING; changed = true; }
       
       if (changed) {
           currentScreen = [xmin, xmax, ymin, ymax];
           IS_SETTING_BOUNDING_BOX = true;
           appState.board.setBoundingBox(toBB(currentScreen), false);
           IS_SETTING_BOUNDING_BOX = false;
       }
    }

    // 3. Oppdater input-feltet live (uten å endre fokus)
    // Dette oppfyller kravet: "Tallene skal oppdateres slik at de ALLTID stemmer"
    const input = document.getElementById('cfgScreen');
    if (input && document.activeElement !== input) {
        input.value = formatScreenForInput(currentScreen);
        input.classList.remove('is-auto');
    }

    if (Array.isArray(currentScreen) && currentScreen.length === 4 && currentScreen.every(Number.isFinite)) {
      LAST_COMPUTED_SCREEN = currentScreen.slice(0, 4);
      LAST_SCREEN_SOURCE = 'manual';
      if (EXAMPLE_STATE && typeof EXAMPLE_STATE === 'object') {
        EXAMPLE_STATE.screen = currentScreen.slice(0, 4);
        EXAMPLE_STATE.screenSource = LAST_SCREEN_SOURCE;
      }
    }

    ADV.screen = currentScreen;
    
    applyTickSettings();
    if (ADV.axis.forceIntegers) {
      rebuildGrid();
    }
    placeAxisNames();
    updateAxisArrows();
    ensureGraphLabelsVisibility();
    queueFunctionViewUpdate(currentScreen);
  }
  function rememberManualScreenFromBoard() {
  if (!appState.board) return;
  const currentBB = fromBoundingBox(appState.board.getBoundingBox());
  if (!currentBB || !currentBB.every(Number.isFinite)) return;
  const normalized = calculateCorrectedScreen(currentBB);
  if (!Array.isArray(normalized) || normalized.length !== 4 || !normalized.every(Number.isFinite)) return;
  rememberScreenState(normalized, 'manual');
  const input = document.getElementById('cfgScreen');
  if (input && document.activeElement !== input) {
    const newValue = formatScreenForInput(normalized);
    if (newValue && input.value !== newValue) {
      input.value = newValue;
    }
    if (input.dataset) delete input.dataset.autoscreen;
    input.classList.remove('is-auto');
  }
}
function prepareSimpleState() {
  syncSimpleFromWindow();
  if (typeof window !== 'undefined') {
    window.SIMPLE = appState.simple.value;
  }
  if (typeof appState.simple.value !== 'string') {
    appState.simple.value = appState.simple.value == null ? '' : String(appState.simple.value);
  }
  appState.simple.parsed = parseSimple(appState.simple.value);
  applyLinePointStart(appState.simple.parsed);
  applyGraftegnerDefaultsFromTheme({ count: computePaletteRequestCount() });
  const markerList = Array.isArray(appState.simple.parsed.pointMarkers)
    ? appState.simple.parsed.pointMarkers.map(sanitizePointMarkerValue).filter(Boolean)
    : [];
  const markerFromList = markerList.length ? formatPointMarkerList(markerList) : appState.simple.parsed.pointMarker;
  const normalizedMarker = normalizePointMarkerValue(markerFromList);
  ADV.points.markerList = markerList.slice();
  ADV.points.marker = !normalizedMarker || isDefaultPointMarker(normalizedMarker)
    ? DEFAULT_POINT_MARKER
    : normalizedMarker;
  ADV.points.lockExtraPoints = appState.simple.parsed && appState.simple.parsed.lockExtraPoints === false ? false : true;
  MODE = decideMode(appState.simple.parsed);
}
function configureBoardFromState() {
  hideCheckControls();
  destroyBoard();
  ADV.axis.forceIntegers = FORCE_TICKS_REQUESTED;
  FORCE_TICKS_LOCKED_FALSE = false;
  const plannedScreen = initialScreen();
  if (shouldLockForceTicks(plannedScreen)) {
    FORCE_TICKS_LOCKED_FALSE = true;
    ADV.axis.forceIntegers = false;
  }
  START_SCREEN = plannedScreen;
  initBoard();
}
function renderBoardContent() {
  if (!appState.board) return false;
  if (MODE === 'functions') {
    buildFunctions();
  } else {
    buildPointsLine();
  }
  return true;
}
function finalizeBoardRender() {
  if (!appState.board) return;
  addFixedPoints();
  appState.board.on('boundingbox', updateAfterViewChange);
  updateAfterViewChange();
  setupTaskCheck();
  applyAltTextToBoard();
  refreshAltText('rebuild');
  appState.simple.lastRendered = appState.simple.value;
}
function rebuildAll() {
  if (appState.isRebuilding) return;
  appState.isRebuilding = true;
  try {
    if (!appState.skipSnapshot) {
      rememberManualScreenFromBoard();
    }
    appState.skipSnapshot = false;
    prepareSimpleState();
    configureBoardFromState();
    if (!renderBoardContent()) {
      appState.simple.lastRendered = appState.simple.value;
      return;
    }
    finalizeBoardRender();
  } finally {
    appState.isRebuilding = false;
  }
}
let resizeScheduled = false;
const scheduleResize = () => {
  if (resizeScheduled) return;
  resizeScheduled = true;
  const scheduler = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
  scheduler(() => {
    resizeScheduled = false;
    const jxg = getJXG();
    const resizeBoards =
      jxg && jxg.JSXGraph && typeof jxg.JSXGraph.resizeBoards === 'function' ? jxg.JSXGraph.resizeBoards : null;
    const board = appState.board;
    if (board && typeof board.resizeContainer === 'function') {
      var _brd$containerObj, _brd$containerObj2;
      const cw = (_brd$containerObj = board.containerObj) === null || _brd$containerObj === void 0 ? void 0 : _brd$containerObj.clientWidth;
      const ch = (_brd$containerObj2 = board.containerObj) === null || _brd$containerObj2 === void 0 ? void 0 : _brd$containerObj2.clientHeight;
      if (cw && ch) {
        board.resizeContainer(cw, ch);
        board.update();
      }
    } else if (typeof resizeBoards === 'function') {
      try {
        resizeBoards();
      } catch (error) {
        if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
          console.warn('[graftegner] Ignoring resize error from JSXGraph.resizeBoards', error);
        }
      }
    }
    updateAfterViewChange();
  });
};
window.addEventListener('resize', scheduleResize, { passive: true });
function handleGraftegnerProfileChange() {
  applyThemeToDocument();
  applyGraftegnerDefaultsFromTheme({ count: computePaletteRequestCount() });
  updateCurveColorsFromTheme();
  updateAxisThemeStyling();
  refreshFunctionColorDefaults();
  requestRebuild();
}

function handleGraftegnerSettingsChange() {
  const thickness = DEFAULT_LINE_THICKNESS;
  ADV.axis.style.width = thickness;
  ADV.domainMarkers.width = thickness;
  handleGraftegnerProfileChange();
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('message', event => {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    handleGraftegnerProfileChange();
  });
  window.addEventListener('math-visuals:profile-change', () => handleGraftegnerProfileChange());
  window.addEventListener('math-visuals:settings-changed', () => handleGraftegnerSettingsChange());
}
function requestRebuild() {
  cancelScheduledSimpleRebuild();
  Promise.resolve().then(() => {
    whenJXGReady(() => {
      rebuildAll();
    });
  });
}
requestRebuild();
if (typeof window !== 'undefined') {
  window.render = requestRebuild;
}

/* ====== Sjekk-knapp + status (monteres i #checkArea i HTML) ====== */
function ensureCheckControls() {
  const host = document.getElementById('checkArea') || document.body;
  let btn = document.getElementById('btnCheck');
  let msg = document.getElementById('checkMsg');
  if (!btn) {
    btn = document.createElement('button');
    btn.id = 'btnCheck';
    btn.textContent = 'Sjekk svar';
    btn.className = 'btn btn--task-check';
    btn.type = 'button';
    host.appendChild(btn);
  }
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'checkMsg';
    msg.className = 'status status--info';
    msg.textContent = '';
    host.appendChild(msg);
  }
  applyAppModeToTaskCheckHost(getCurrentAppMode() || 'task');
  const setStatus = (type, text) => {
    let normalized = 'info';
    if (type === 'success') {
      normalized = 'success';
    } else if (type === 'error') {
      normalized = 'error';
    } else if (type === 'info') {
      normalized = 'info';
    }
    msg.className = `status status--${normalized}`;
    msg.textContent = text || '';
  };
  return {
    btn,
    msg,
    setStatus
  };
}

const taskCheckHost = typeof document !== 'undefined' ? document.querySelector('[data-task-check-host]') : null;

function ensureTaskCheckHostChildren() {
  if (!taskCheckHost) return;
  const btn = document.getElementById('btnCheck');
  const msg = document.getElementById('checkMsg');
  if (btn && btn.parentElement !== taskCheckHost) {
    taskCheckHost.appendChild(btn);
  }
  if (msg && msg.parentElement !== taskCheckHost) {
    taskCheckHost.appendChild(msg);
  }
}

function normalizeAppMode(mode) {
  const normalized = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
  if (
    normalized === 'task' ||
    normalized === 'preview' ||
    normalized === 'forhandsvisning' ||
    normalized === 'forhåndsvisning' ||
    normalized === 'task-mode' ||
    normalized === 'preview-mode'
  ) {
    return 'task';
  }
  return 'default';
}

function isTaskLikeMode(mode) {
  return normalizeAppMode(mode) === 'task';
}

function applyAppModeToTaskCheckHost(mode) {
  if (!taskCheckHost) return;
  const isTaskMode = isTaskLikeMode(mode);
  if (isTaskMode) {
    ensureTaskCheckHostChildren();
    taskCheckHost.hidden = false;
    const btn = document.getElementById('btnCheck');
    const msg = document.getElementById('checkMsg');
    if (btn) {
      btn.hidden = false;
      if (btn.dataset) delete btn.dataset.prevHidden;
    }
    if (msg) {
      if (msg.dataset && 'prevHidden' in msg.dataset) {
        const wasHidden = msg.dataset.prevHidden === '1';
        delete msg.dataset.prevHidden;
        msg.hidden = wasHidden;
      }
    }
  } else {
    taskCheckHost.hidden = true;
    const btn = document.getElementById('btnCheck');
    const msg = document.getElementById('checkMsg');
    if (btn) {
      if (btn.dataset) {
        btn.dataset.prevHidden = btn.hidden ? '1' : '0';
      }
      btn.hidden = true;
    }
    if (msg) {
      if (msg.dataset) {
        msg.dataset.prevHidden = msg.hidden ? '1' : '0';
      }
      msg.hidden = true;
    }
  }
}

function getCurrentAppMode() {
  if (typeof window === 'undefined') return 'default';
  const mv = window.mathVisuals;
  if (mv && typeof mv.getAppMode === 'function') {
    try {
      const mode = mv.getAppMode();
      if (typeof mode === 'string' && mode) {
        return normalizeAppMode(mode);
      }
    } catch (_) {
      // fall through to query parsing below
    }
  }
  try {
    const params = new URLSearchParams(window.location && window.location.search ? window.location.search : '');
    const fromQuery = params.get('mode');
    if (typeof fromQuery === 'string' && fromQuery.trim()) {
      return normalizeAppMode(fromQuery);
    }
  } catch (_) {}
  return 'default';
}

function syncBodyAppMode(mode) {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (!body || !body.dataset) return;
  const normalized = normalizeAppMode(mode);
  if (body.dataset.appMode !== normalized) {
    body.dataset.appMode = normalized;
  }
}

const initialAppMode = getCurrentAppMode() || 'task';
syncBodyAppMode(initialAppMode);
applyAppModeToTaskCheckHost(initialAppMode);

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('math-visuals:app-mode-changed', event => {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail.mode !== 'string') return;
    syncBodyAppMode(detail.mode);
    applyAppModeToTaskCheckHost(detail.mode);
  });
}
function extractInlineStyleValue(styleString, properties) {
  if (!styleString || typeof styleString !== 'string') return null;
  const normalized = Array.isArray(properties) ? properties : [properties];
  for (const property of normalized) {
    if (!property) continue;
    const pattern = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${pattern}\\s*:\\s*([^;]+)`, 'i');
    const match = styleString.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

function sanitizeSvgForeignObjects(svgNode) {
  if (!svgNode || typeof svgNode.querySelectorAll !== 'function') return;
  const doc = svgNode.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const nodes = Array.from(svgNode.querySelectorAll('foreignObject'));
  if (!doc || typeof doc.createElementNS !== 'function') {
    nodes.forEach(node => node.remove());
    return;
  }
  nodes.forEach(node => {
    const parent = node.parentNode;
    if (!parent) return;
    const textContent = (node.textContent || '').trim();
    if (!textContent) {
      parent.removeChild(node);
      return;
    }
    const replacement = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    const xAttr = node.getAttribute('x');
    const yAttr = node.getAttribute('y');
    if (xAttr != null) replacement.setAttribute('x', xAttr);
    if (yAttr != null) replacement.setAttribute('y', yAttr);
    replacement.setAttribute('dominant-baseline', 'text-before-edge');
    replacement.setAttribute('font-family', 'Inter, "Segoe UI", system-ui, sans-serif');
    const styleSources = [node.getAttribute('style') || ''];
    if (node.firstElementChild && typeof node.firstElementChild.getAttribute === 'function') {
      styleSources.push(node.firstElementChild.getAttribute('style') || '');
    }
    const colorValue = styleSources.reduce((acc, style) => acc || extractInlineStyleValue(style, ['color', '--graf-axis-label-text']), null);
    if (colorValue) {
      replacement.setAttribute('fill', colorValue);
    } else {
      replacement.setAttribute('fill', '#111827');
    }
    const fontSizeValue = styleSources.reduce((acc, style) => acc || extractInlineStyleValue(style, ['font-size', '--graf-axis-label-font-size']), null);
    if (fontSizeValue) {
      replacement.setAttribute('font-size', fontSizeValue);
    }
    replacement.textContent = textContent;
    parent.replaceChild(replacement, node);
  });
}

function cloneAxisArrowNode(axisKey, doc) {
  const axis = axisKey === 'y' ? 'y' : 'x';
  const source = axis === 'y' ? appState.axes.arrows.y : appState.axes.arrows.x;
  const sourceNode = source && (source.rendNodeImage || source.rendNode || null);
  const node = sourceNode && typeof sourceNode.cloneNode === 'function'
    ? sourceNode.cloneNode(true)
    : (doc && typeof doc.createElementNS === 'function'
      ? doc.createElementNS('http://www.w3.org/2000/svg', 'image')
      : null);
  if (!node) return null;
  const axisColor = normalizeColorValue(ADV.axis && ADV.axis.style && ADV.axis.style.stroke ? ADV.axis.style.stroke : DEFAULT_AXIS_COLOR)
    || DEFAULT_AXIS_COLOR;
  const dataUrl = axisArrowSvgData(axis, axisColor);
  try {
    node.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
  } catch (_) {}
  try {
    node.setAttribute('href', dataUrl);
    node.setAttribute('xlink:href', dataUrl);
  } catch (_) {}
  node.setAttribute('data-axis-arrow', axis);
  node.setAttribute('preserveAspectRatio', 'none');
  if (!node.getAttribute('width')) {
    const width = axis === 'y' ? axisArrowHalfWidth() * 2 : axisArrowLengthX();
    node.setAttribute('width', String(width));
  }
  if (!node.getAttribute('height')) {
    const height = axis === 'y' ? axisArrowLengthY() : axisArrowHalfHeight() * 2;
    node.setAttribute('height', String(height));
  }
  if (!node.getAttribute('x') || !node.getAttribute('y')) {
    const bb = appState.board && typeof appState.board.getBoundingBox === 'function'
      ? appState.board.getBoundingBox()
      : null;
    if (Array.isArray(bb) && bb.length === 4) {
      const [xmin, ymax, xmax, ymin] = bb;
      const xPos = axis === 'y' ? -axisArrowHalfWidth() : (Number.isFinite(xmax) ? xmax : 0) - axisArrowLengthX();
      const yPos = axis === 'y'
        ? (Number.isFinite(ymax) ? ymax : 0) - axisArrowLengthY()
        : -axisArrowHalfHeight();
      node.setAttribute('x', String(xPos));
      node.setAttribute('y', String(yPos));
    }
  }
  return node;
}

function ensureAxisArrowsInSvgClone(node) {
  if (!node || typeof node.querySelector !== 'function') return;
  const doc = node.ownerDocument || (typeof document !== 'undefined' ? document : null);
  ['x', 'y'].forEach((axisKey) => {
    const existing = node.querySelector(`[data-axis-arrow="${axisKey}"]`);
    if (existing) return;
    const clone = cloneAxisArrowNode(axisKey, doc);
    if (clone) {
      node.appendChild(clone);
    }
  });
}

const EXPORT_BASE_SIZE = 800;

function getNormalizedBoardExportDimensions(width, height) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : EXPORT_BASE_SIZE;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : EXPORT_BASE_SIZE;
  const maxDim = Math.max(safeWidth, safeHeight, 1);
  const scale = EXPORT_BASE_SIZE / maxDim;
  const normalizedWidth = safeWidth * scale;
  const normalizedHeight = safeHeight * scale;
  return {
    width: EXPORT_BASE_SIZE,
    height: EXPORT_BASE_SIZE,
    offsetX: (EXPORT_BASE_SIZE - normalizedWidth) / 2,
    offsetY: (EXPORT_BASE_SIZE - normalizedHeight) / 2,
    scale
  };
}

function normalizeFontSizesForExport(node, scale) {
  if (!node || !Number.isFinite(scale) || scale === 1) return;
  const normalizeSize = el => {
    const attr = el.getAttribute('font-size');
    let size = attr && attr.trim() ? parseFloat(attr) : NaN;
    if (!Number.isFinite(size) && typeof window !== 'undefined' && typeof getComputedStyle === 'function') {
      size = parseFloat(getComputedStyle(el).fontSize);
    }
    if (Number.isFinite(size) && size > 0) {
      el.setAttribute('font-size', `${size / scale}px`);
    }
  };
  node.querySelectorAll('text, tspan').forEach(normalizeSize);
}

function normalizeBoardSvgForExport(node, dims) {
  if (!node || !dims) return dims;
  const doc = node.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const wrapper = doc ? doc.createElementNS('http://www.w3.org/2000/svg', 'g') : null;
  if (wrapper) {
    wrapper.setAttribute('transform', `translate(${dims.offsetX} ${dims.offsetY}) scale(${dims.scale})`);
    while (node.firstChild) {
      wrapper.appendChild(node.firstChild);
    }
    node.appendChild(wrapper);
  }
  if (doc && wrapper) {
    const defs = node.querySelector('defs') || doc.createElementNS('http://www.w3.org/2000/svg', 'defs');
    if (!defs.parentNode) {
      node.appendChild(defs);
    }
    const clipId = `mv-clip-${Math.random().toString(36).slice(2, 8)}`;
    const clip = doc.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clip.setAttribute('id', clipId);
    const clipRect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    clipRect.setAttribute('x', '0');
    clipRect.setAttribute('y', '0');
    clipRect.setAttribute('width', String(dims.width));
    clipRect.setAttribute('height', String(dims.height));
    clip.appendChild(clipRect);
    defs.appendChild(clip);
    wrapper.setAttribute('clip-path', `url(#${clipId})`);
  }
  if (doc) {
    const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(dims.width));
    rect.setAttribute('height', String(dims.height));
    rect.setAttribute('fill', '#ffffff');
    node.insertBefore(rect, node.firstChild);
  }
  node.setAttribute('width', String(dims.width));
  node.setAttribute('height', String(dims.height));
  node.setAttribute('viewBox', `0 0 ${dims.width} ${dims.height}`);
  return dims;
}

function cloneBoardSvgRoot() {
  if (!appState.board || !appState.board.renderer || !appState.board.renderer.svgRoot) return null;
  const width = appState.board.canvasWidth;
  const height = appState.board.canvasHeight;
  const node = appState.board.renderer.svgRoot.cloneNode(true);
  node.removeAttribute('style');
  node.setAttribute('width', `${width}`);
  node.setAttribute('height', `${height}`);
  node.setAttribute('viewBox', `0 0 ${width} ${height}`);
  node.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  node.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  sanitizeSvgForeignObjects(node);
  appendAxisLabelsToSvgClone(node);
  appendCurveLabelsToSvgClone(node);
  ensureAxisArrowsInSvgClone(node);
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  if (helper && typeof helper.ensureSvgBackground === 'function') {
    helper.ensureSvgBackground(node, {
      bounds: { minX: 0, minY: 0, width, height }
    });
  } else if (typeof document !== 'undefined') {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(width));
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', '#ffffff');
    node.insertBefore(rect, node.firstChild);
  }
  const exportDims = getNormalizedBoardExportDimensions(width, height);
  normalizeBoardSvgForExport(node, exportDims);
  normalizeFontSizesForExport(node, exportDims.scale);
  return { node, width: exportDims.width, height: exportDims.height };
}
function serializeBoardSvg(clone) {
  if (!clone || !clone.node) return '';
  return new XMLSerializer().serializeToString(clone.node).replace(/\swidth="[^"]*"\s(?=.*width=")/, ' ').replace(/\sheight="[^"]*"\s(?=.*height=")/, ' ');
}
  function buildBoardSvgExport() {
    applyAltTextToBoard();
    const clone = cloneBoardSvgRoot();
    if (!clone) return null;
    return {
      markup: serializeBoardSvg(clone),
      width: clone.width,
      height: clone.height,
      node: clone.node,
      altText: getCurrentAltText()
    };
  }

  async function downloadBoardPNG(svgExport, filename, scale = 2, bg = '#fff') {
    if (!svgExport || !svgExport.markup) return false;
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const urlApi = typeof window !== 'undefined' ? window.URL || URL : null;
    const svgBlob = new Blob([svgExport.markup], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = urlApi ? urlApi.createObjectURL(svgBlob) : null;
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const sizing =
          helper && typeof helper.ensureMinimumPngDimensions === 'function'
            ? helper.ensureMinimumPngDimensions(
                { width: svgExport.width, height: svgExport.height },
                { scale }
              )
            : (() => {
                const minDimension = 100;
                const baseScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
                const safeWidth = Number.isFinite(svgExport.width) && svgExport.width > 0 ? svgExport.width : minDimension;
                const safeHeight = Number.isFinite(svgExport.height) && svgExport.height > 0 ? svgExport.height : minDimension;
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
        if (!ctx) {
          if (helper && typeof helper.showToast === 'function') {
            helper.showToast('Canvas 2D-kontekst er ikke tilgjengelig', 'error');
          }
          if (urlApi && url) {
            urlApi.revokeObjectURL(url);
          }
          resolve(false);
          return;
        }
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (urlApi && url) {
          urlApi.revokeObjectURL(url);
        }
        canvas.toBlob(blob => {
          if (!blob) {
            if (helper && typeof helper.showToast === 'function') {
              helper.showToast('Kunne ikke lage PNG-blob', 'error');
            }
            resolve(false);
            return;
          }
          const pngUrl = urlApi ? urlApi.createObjectURL(blob) : '';
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
          a.click();
          if (urlApi && pngUrl) {
            urlApi.revokeObjectURL(pngUrl);
          }
          resolve(true);
        }, 'image/png');
      };
      img.onerror = () => {
        if (helper && typeof helper.showToast === 'function') {
          helper.showToast('Kunne ikke laste SVG for PNG-konvertering', 'error');
        }
        if (urlApi && url) {
          urlApi.revokeObjectURL(url);
        }
        resolve(false);
      };
      img.src = url || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgExport.markup)}`;
    });
  }

  async function downloadBoardSvg(svgExport, filename) {
    if (!svgExport || !svgExport.markup) return false;
    const urlApi = typeof window !== 'undefined' ? window.URL || URL : null;
    const svgBlob = new Blob([svgExport.markup], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = urlApi ? urlApi.createObjectURL(svgBlob) : null;
    const a = document.createElement('a');
    a.href = url || `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgExport.markup)}`;
    a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    a.click();
    if (urlApi && url) {
      urlApi.revokeObjectURL(url);
    }
    return true;
  }

  async function downloadBoardPngWithHtml2Canvas(filename, scale = 2, bg = '#fff') {
    const html2canvas = typeof window !== 'undefined' ? window.html2canvas : null;
    if (typeof html2canvas !== 'function') return false;
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const target =
      document.querySelector('.figure') ||
      document.getElementById('board');
    if (!target) return false;
    const ratio = typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const renderScale = Math.max(Number.isFinite(scale) && scale > 0 ? scale : 2, ratio);
    try {
      const canvas = await html2canvas(target, {
        backgroundColor: bg,
        scale: renderScale,
        useCORS: true,
        foreignObjectRendering: true,
        logging: false
      });
      if (!canvas) return false;
      let blob = null;
      if (typeof canvas.toBlob === 'function') {
        blob = await new Promise(resolve => {
          try {
            canvas.toBlob(result => resolve(result || null), 'image/png');
          } catch (error) {
            resolve(null);
          }
        });
      }
      let dataUrl = null;
      if (!blob) {
        try {
          dataUrl = canvas.toDataURL('image/png');
        } catch (error) {
          dataUrl = null;
        }
      }
      if (!blob && !dataUrl) {
        if (helper && typeof helper.showToast === 'function') {
          helper.showToast('Kunne ikke lage PNG via html2canvas.', 'error');
        }
        return false;
      }
      const urlApi = typeof window !== 'undefined' ? window.URL || URL : null;
      if (blob && urlApi) {
        const pngUrl = urlApi.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        a.click();
        urlApi.revokeObjectURL(pngUrl);
        return true;
      }
      if (dataUrl) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        a.click();
        return true;
      }
      return false;
    } catch (error) {
      if (helper && typeof helper.showToast === 'function') {
        const message = error && error.message ? error.message : 'Ukjent feil';
        helper.showToast(`html2canvas feilet: ${message}.`, 'error');
      }
      return false;
    }
  }

  function getFilenameSanitizer(defaultName = 'figur') {
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    if (helper && typeof helper.sanitizeFilename === 'function') {
      return value => helper.sanitizeFilename(value || defaultName);
    }

    return value => {
      if (!value) return defaultName;
      const sanitized = String(value)
        .trim()
        .replace(/[\/\\:*?"<>|]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/\^/g, '')
        .slice(0, 50);

      return sanitized || defaultName;
    };
  }

  function generateSmartFilename(items, defaultName = 'Graftegning') {
    if (!Array.isArray(items) || items.length === 0) return defaultName;
    const filtered = items.map(item => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);
    if (!filtered.length) return defaultName;

    if (filtered.length > 4) {
      const funcs = filtered.filter(i => i.includes('=') && !i.includes('(')).length;
      const points = filtered.filter(i => i.includes('(') && i.includes(',')).length;
      return `Figur_med_${funcs}_funksjoner_og_${points}_punkter`;
    }

    const cleanParts = filtered.map(item => {
      let clean = item.trim();

      if (/^\(.*\)|^[A-Z]\s*=\s*\(.*\)/i.test(clean)) {
        clean = clean.replace(/^([A-Za-z\u00C0-\u024F]+\w*)\s*=\s*/, '$1_');
        clean = clean.replace(/[()]/g, '');
        clean = clean.replace(/\s*,\s*/g, '_');
        clean = clean.replace(/\./g, '-');
        clean = clean.replace(/\s/g, '');
        return `Pt_${clean}`;
      }

      clean = clean.toLowerCase();
      clean = clean.replace(/^[a-z]\(x\)=|^y=/, '');
      clean = clean.replace(/\s+/g, '').replace(/\*/g, '');
      clean = clean.replace(/x\^(\d+)/g, 'x$1');
      clean = clean.replace(/\^/g, 'p');
      clean = clean.replace(/\+/g, '_');
      clean = clean.replace(/-/g, '-');

      return clean;
    });

    const baseName = cleanParts.join('__og__');
    const maxLength = 120;
    const finalName = baseName.length > maxLength ? baseName.substring(0, maxLength) : baseName;

    return `Graf_${finalName}`;
  }

  function getSuggestedFilename() {
    const sanitize = getFilenameSanitizer('Koordinatsystem');
    const parsed = appState.simple && typeof appState.simple === 'object' ? appState.simple.parsed || {} : {};
    const funcs = Array.isArray(parsed.funcs) ? parsed.funcs : [];
    const extraPoints = Array.isArray(parsed.extraPoints) ? parsed.extraPoints : [];
    const pointNames = Array.isArray(parsed.pointNames) ? parsed.pointNames : [];
    const linePoints = Array.isArray(parsed.linePoints) ? parsed.linePoints : [];

    const items = [];

    funcs.forEach(func => {
      if (!func || typeof func !== 'object') return;
      const label = typeof func.label === 'string' && func.label.trim()
        ? func.label.trim()
        : typeof func.name === 'string' && func.name.trim()
          ? `${func.name.trim()}(x)`
          : 'f(x)';
      const rhs = typeof func.rhs === 'string'
        ? func.rhs
        : func && func.rhs != null
          ? String(func.rhs)
          : '';
      if (rhs) {
        items.push(`${label}=${rhs}`);
      }
    });

    const formatPoint = (coords, name) => {
      if (!Array.isArray(coords) || coords.length < 2) return null;
      const [x, y] = coords;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const coordStr = `(${x}, ${y})`;
      if (name && typeof name === 'string' && name.trim()) {
        return `${name.trim()}=${coordStr}`;
      }
      return coordStr;
    };

    extraPoints.forEach((pt, idx) => {
      const formatted = formatPoint(pt, pointNames[idx]);
      if (formatted) items.push(formatted);
    });

    linePoints.forEach(pt => {
      const formatted = formatPoint(pt, null);
      if (formatted) items.push(formatted);
    });

    const smartName = generateSmartFilename(items, 'Koordinatsystem');
    return sanitize(smartName);
  }
const btnSvg = document.getElementById('btnSvg');
if (btnSvg) {
  btnSvg.addEventListener('click', async () => {
    const cleanState = createCleanSaveState();
    if (typeof window !== 'undefined') {
      window.STATE_V2 = cleanState;
      window.STATE = cleanState;
    }
    const svgExport = buildBoardSvgExport();
    if (!svgExport || !svgExport.markup) return;
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const suggestedName = `${getSuggestedFilename()}.svg`;
    const htmlTarget = document.querySelector('.figure');
    if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
      helper.exportGraphicWithArchiveWithFallback({
        svgElement: svgExport.node,
        htmlTarget,
        suggestedName,
        toolId: 'graftegner',
        svgString: svgExport.markup,
        alt: svgExport.altText,
        description: svgExport.altText
      });
      return;
    }
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      helper.exportSvgWithArchive(svgExport.node, suggestedName, 'graftegner', {
        svgString: svgExport.markup,
        alt: svgExport.altText,
        description: svgExport.altText
      });
      return;
    }
    await downloadBoardSvg(svgExport, suggestedName);
    const html2CanvasDidDownload = await downloadBoardPngWithHtml2Canvas(`${getSuggestedFilename()}.png`);
    if (!html2CanvasDidDownload) {
      await downloadBoardPNG(svgExport, `${getSuggestedFilename()}.png`);
    }
  });
}
setupSettingsForm();
initAltTextManager();
function setupSettingsForm() {
  const root = document.querySelector('.settings');
  if (!root) return;
  const funcRows = document.getElementById('funcRows');
  let addBtn = document.getElementById('addFunc');
  let removeBtn = document.getElementById('removeFunc');
  if (!addBtn) {
    addBtn = document.createElement('button');
    addBtn.id = 'addFunc';
  }
  if (!removeBtn) {
    removeBtn = document.createElement('button');
    removeBtn.id = 'removeFunc';
  }
  addBtn.type = 'button';
  addBtn.textContent = '+';
  addBtn.setAttribute('aria-label', 'Legg til funksjon');
  addBtn.setAttribute('data-edit-only', '');
  addBtn.classList.remove('btn');
  addBtn.classList.add('addFigureBtn');
  removeBtn.type = 'button';
  removeBtn.textContent = '−';
  removeBtn.setAttribute('aria-label', 'Fjern funksjon');
  removeBtn.setAttribute('data-edit-only', '');
  removeBtn.classList.remove('btn');
  removeBtn.classList.add('addFigureBtn');
  const functionActions = document.querySelector('.func-actions');
  const functionsHost = functionActions || document.querySelector('.function-controls');
  if (functionsHost && addBtn.parentElement !== functionsHost) {
    functionsHost.appendChild(addBtn);
  }
  if (functionsHost && removeBtn.parentElement !== functionsHost) {
    functionsHost.appendChild(removeBtn);
  }
  const g = id => document.getElementById(id);
  const showNamesInput = g('cfgShowNames');
  const showExprInput = g('cfgShowExpr');
  const showAxisNumbersInput = g('cfgShowAxisNumbers');
  const showGridInput = g('cfgShowGrid');
  const forceTicksInput = g('cfgForceTicks');
  const q1Input = g('cfgQ1');
  const lockInput = g('cfgLock');
  const showPointArrowsInput = g('cfgShowPointArrows');
  const showPointCoordsInput = g('cfgShowPointCoords');
  const screenInput = g('cfgScreen');
  const zoomInput = g('cfgZoom');
  const panInput = g('cfgPan');
  const axisXInputElement = g('cfgAxisX');
  const axisYInputElement = g('cfgAxisY');
  const snapCheckbox = g('cfgSnap');
  const getExampleState = () => {
    const stateV2 = typeof window !== 'undefined' ? migrateStorageState(window.STATE) : null;
    const baseState = stateV2
      ? buildExampleStateFromStorageV2(stateV2)
      : typeof window !== 'undefined' && window.STATE && typeof window.STATE === 'object'
        ? window.STATE
        : EXAMPLE_STATE;
    const state = baseState || EXAMPLE_STATE;
    if (stateV2 && typeof window !== 'undefined') {
      window.STATE_V2 = stateV2;
    }
    if (state !== EXAMPLE_STATE && EXAMPLE_STATE && typeof EXAMPLE_STATE === 'object') {
      Object.keys(EXAMPLE_STATE).forEach(key => {
        if (!Object.prototype.hasOwnProperty.call(state, key)) {
          delete EXAMPLE_STATE[key];
        }
      });
      Object.assign(EXAMPLE_STATE, state);
      return EXAMPLE_STATE;
    }
    return state;
  };
  const resolveExampleStateFlag = (state, key, fallback) => (
    Object.prototype.hasOwnProperty.call(state, key)
      ? !!state[key]
      : !!fallback
  );
  let lastLoadedExampleIndex = null;
  const defaultScreenState = state => {
    if (!state || typeof state !== 'object') return false;
    const defaultScreen = DEFAULT_SCREEN.slice(0, 4);
    const hasValidScreen = Array.isArray(state.screen) && state.screen.length === 4;
    const hasExplicitScreen = hasValidScreen && state.screenSource === 'manual';

    if (hasExplicitScreen) return false;

    const needsReset = !hasValidScreen
      || state.screenSource == null
      || !screensEqual(state.screen, defaultScreen);
    if (!needsReset) return false;
    state.screen = defaultScreen;
    state.screenSource = 'default';
    return true;
  };
  const registerExampleChange = incomingIndex => {
    const normalizedIndex = Number.isInteger(incomingIndex) && incomingIndex >= 0
      ? incomingIndex
      : null;
    const exampleChanged = normalizedIndex !== null && normalizedIndex !== lastLoadedExampleIndex;
    if (exampleChanged) {
      const windowState = typeof window !== 'undefined' && window.STATE && typeof window.STATE === 'object'
        ? window.STATE
        : null;
      defaultScreenState(windowState);
      defaultScreenState(EXAMPLE_STATE);
      const defaultScreen = DEFAULT_SCREEN.slice(0, 4);
      ADV.screen = defaultScreen.slice(0, 4);
      LAST_COMPUTED_SCREEN = null;
      LAST_SCREEN_SOURCE = 'default';
      START_SCREEN = null;
      LAST_FUNCTION_VIEW_SCREEN = null;
    }
    if (normalizedIndex !== null) {
      lastLoadedExampleIndex = normalizedIndex;
    }
  };
  const applyExampleStateToControls = () => {
    const exampleState = getExampleState();
    const defaultScreen = DEFAULT_SCREEN.slice(0, 4);
    const hasScreen = exampleState && Array.isArray(exampleState.screen) && exampleState.screen.length === 4;
    if (exampleState && !hasScreen) {
      exampleState.screen = defaultScreen.slice(0, 4);
      exampleState.screenSource = 'default';
    }
    hydrateCurveLabelStateFromExample();
    hydrateAxisLabelStateFromExample();
    const axisLabelConfig = exampleState && typeof exampleState.axisLabels === 'object'
      ? exampleState.axisLabels
      : null;
    const axisXValue = axisLabelConfig && typeof axisLabelConfig.x === 'string'
      ? axisLabelConfig.x
      : ADV.axis.labels.x;
    const axisYValue = axisLabelConfig && typeof axisLabelConfig.y === 'string'
      ? axisLabelConfig.y
      : ADV.axis.labels.y;
    if (axisXInputElement && typeof axisXValue === 'string' && axisXInputElement.value !== axisXValue) {
      axisXInputElement.value = axisXValue;
    }
    if (axisYInputElement && typeof axisYValue === 'string' && axisYInputElement.value !== axisYValue) {
      axisYInputElement.value = axisYValue;
    }
    if ((ADV.axis.labels.x || '') !== axisXValue) {
      ADV.axis.labels.x = axisXValue;
    }
    if ((ADV.axis.labels.y || '') !== axisYValue) {
      ADV.axis.labels.y = axisYValue;
    }
    const nextFontSize = axisLabelConfig && Number.isFinite(axisLabelConfig.fontSize)
      ? axisLabelConfig.fontSize
      : null;
    if (Number.isFinite(nextFontSize)) {
      ADV.axis.labels.fontSize = nextFontSize;
    }
    const resolvedShowNames = resolveExampleStateFlag(exampleState, 'showNames', ADV.curveName && ADV.curveName.showName);
    const resolvedShowExpr = resolveExampleStateFlag(exampleState, 'showExpression', ADV.curveName && ADV.curveName.showExpression);
    let changed = false;
    if (showNamesInput && showNamesInput.checked !== resolvedShowNames) {
      showNamesInput.checked = resolvedShowNames;
    }
    if (showExprInput && showExprInput.checked !== resolvedShowExpr) {
      showExprInput.checked = resolvedShowExpr;
    }
    if (ADV.curveName.showName !== resolvedShowNames) {
      ADV.curveName.showName = resolvedShowNames;
      changed = true;
    }
    if (ADV.curveName.showExpression !== resolvedShowExpr) {
      ADV.curveName.showExpression = resolvedShowExpr;
      changed = true;
    }
    const showAny = resolvedShowNames || resolvedShowExpr;
    if (ADV.curveName.show !== showAny) {
      ADV.curveName.show = showAny;
      changed = true;
    }
    const resolvedLock = Object.prototype.hasOwnProperty.call(exampleState, 'lockAspect')
      ? !!exampleState.lockAspect
      : (lockInput ? !!lockInput.checked : INITIAL_LOCK_ASPECT);
    if (lockInput && lockInput.checked !== resolvedLock) {
      lockInput.checked = resolvedLock;
    }
    if (ADV.lockAspect !== resolvedLock) {
      ADV.lockAspect = resolvedLock;
      changed = true;
    }
    if (Object.prototype.hasOwnProperty.call(exampleState, 'firstQuadrant')) {
      const resolvedQ1 = resolveExampleStateFlag(exampleState, 'firstQuadrant', INITIAL_FIRST_QUADRANT);
      if (q1Input && q1Input.checked !== resolvedQ1) {
        q1Input.checked = resolvedQ1;
      }
      if (ADV.firstQuadrant !== resolvedQ1) {
        ADV.firstQuadrant = resolvedQ1;
        changed = true;
      }
    }
    const resolvedAxisNumbers = resolveExampleStateFlag(exampleState, 'showAxisNumbers', INITIAL_SHOW_AXIS_NUMBERS);
    if (showAxisNumbersInput && showAxisNumbersInput.checked !== resolvedAxisNumbers) {
      showAxisNumbersInput.checked = resolvedAxisNumbers;
    }
    if (ADV.axis.ticks.showNumbers !== resolvedAxisNumbers) {
      ADV.axis.ticks.showNumbers = resolvedAxisNumbers;
      changed = true;
    }
    const resolvedGrid = resolveExampleStateFlag(exampleState, 'showGrid', INITIAL_SHOW_GRID);
    if (showGridInput && showGridInput.checked !== resolvedGrid) {
      showGridInput.checked = resolvedGrid;
    }
    if (ADV.axis.grid.show !== resolvedGrid) {
      ADV.axis.grid.show = resolvedGrid;
      changed = true;
    }
    const resolvedForceTicks = resolveExampleStateFlag(exampleState, 'forceTicks', INITIAL_FORCE_TICKS);
    if (forceTicksInput && forceTicksInput.checked !== resolvedForceTicks && !forceTicksInput.disabled) {
      forceTicksInput.checked = resolvedForceTicks;
    }
    if (FORCE_TICKS_REQUESTED !== resolvedForceTicks && !(forceTicksInput && forceTicksInput.disabled && FORCE_TICKS_LOCKED_FALSE)) {
      FORCE_TICKS_REQUESTED = resolvedForceTicks;
      changed = true;
    }
    const resolvedSnap = resolveExampleStateFlag(exampleState, 'snapEnabled', INITIAL_SNAP_ENABLED);
    if (snapCheckbox && !snapCheckbox.disabled && snapCheckbox.checked !== resolvedSnap) {
      snapCheckbox.checked = resolvedSnap;
    }
    const effectiveSnap = resolvedSnap && !(snapCheckbox && snapCheckbox.disabled === true);
    if (ADV.points.snap.enabled !== effectiveSnap) {
      ADV.points.snap.enabled = effectiveSnap;
      changed = true;
    }
    const resolvedPointArrows = resolveExampleStateFlag(exampleState, 'showPointArrows', INITIAL_SHOW_POINT_ARROWS);
    if (showPointArrowsInput && showPointArrowsInput.checked !== resolvedPointArrows) {
      showPointArrowsInput.checked = resolvedPointArrows;
    }
    if (ADV.points.guideArrows !== resolvedPointArrows) {
      ADV.points.guideArrows = resolvedPointArrows;
      changed = true;
    }
    const resolvedPointCoords = resolveExampleStateFlag(exampleState, 'showPointCoords', INITIAL_SHOW_POINT_COORDS);
    if (showPointCoordsInput && showPointCoordsInput.checked !== resolvedPointCoords) {
      showPointCoordsInput.checked = resolvedPointCoords;
    }
    if (ADV.points.showCoordsOnHover !== resolvedPointCoords) {
      ADV.points.showCoordsOnHover = resolvedPointCoords;
      changed = true;
    }
    const exampleScreen = exampleState && Array.isArray(exampleState.screen) && exampleState.screen.length === 4
      ? exampleState.screen
      : defaultScreen;
    if (exampleScreen && exampleScreen.length === 4) {
      const normalized = calculateCorrectedScreen(exampleScreen);
      if (normalized && normalized.length === 4) {
        ADV.screen = normalized.slice(0, 4);
        LAST_COMPUTED_SCREEN = ADV.screen.slice(0, 4);
        LAST_SCREEN_SOURCE = typeof exampleState.screenSource === 'string'
          ? exampleState.screenSource
          : 'default';
        syncScreenInputFromState();
        if (appState.board && typeof appState.board.getBoundingBox === 'function') {
          const currentScreen = fromBoundingBox(appState.board.getBoundingBox());
          if (!screensEqual(currentScreen, normalized)) {
            try {
              appState.board.setBoundingBox(toBB(normalized), false);
            } catch (_) {}
          }
        }
        changed = true;
      }
    }
    return changed;
  };
  const syncExampleStateFromControls = () => {
    const exampleState = getExampleState();
    const resolvedShowNames = showNamesInput ? !!showNamesInput.checked : !!(ADV.curveName && ADV.curveName.showName);
    const resolvedShowExpr = showExprInput ? !!showExprInput.checked : !!(ADV.curveName && ADV.curveName.showExpression);
    exampleState.showNames = resolvedShowNames;
    exampleState.showExpression = resolvedShowExpr;
    const resolvedLock = lockInput ? !!lockInput.checked : ADV.lockAspect !== false;
    exampleState.lockAspect = resolvedLock;
    exampleState.firstQuadrant = q1Input ? !!q1Input.checked : !!ADV.firstQuadrant;
    exampleState.showAxisNumbers = showAxisNumbersInput ? !!showAxisNumbersInput.checked : !!(ADV.axis && ADV.axis.ticks && ADV.axis.ticks.showNumbers);
    exampleState.showGrid = showGridInput ? !!showGridInput.checked : !!(ADV.axis && ADV.axis.grid && ADV.axis.grid.show);
    exampleState.forceTicks = forceTicksInput ? !!forceTicksInput.checked : !!FORCE_TICKS_REQUESTED;
    exampleState.snapEnabled = snapCheckbox ? !!(snapCheckbox.checked && !snapCheckbox.disabled) : !!(ADV.points && ADV.points.snap && ADV.points.snap.enabled);
    exampleState.showPointArrows = showPointArrowsInput ? !!showPointArrowsInput.checked : !!(ADV.points && ADV.points.guideArrows);
    exampleState.showPointCoords = showPointCoordsInput ? !!showPointCoordsInput.checked : !!(ADV.points && ADV.points.showCoordsOnHover);
    exampleState.screen = Array.isArray(LAST_COMPUTED_SCREEN) && LAST_COMPUTED_SCREEN.length === 4
      ? LAST_COMPUTED_SCREEN.slice(0, 4)
      : null;
    exampleState.screenSource = 'manual';
    const axisLabelFontSize = Number.isFinite(ADV.axis.labels.fontSize)
      ? ADV.axis.labels.fontSize
      : null;
    exampleState.axisLabels = {
      x: axisXInputElement ? axisXInputElement.value : ADV.axis.labels.x,
      y: axisYInputElement ? axisYInputElement.value : ADV.axis.labels.y,
      fontSize: axisLabelFontSize
    };
  };
  applyExampleStateToControls();
  let gliderSection = null;
  let gliderCountInput = null;
  let gliderStartInput = null;
  let gliderStartLabel = null;
  let glidersVisible = false;
  let forcedGliderCount = null;
  let linePointSection = null;
  let linePointInputs = [];
  let linePointLabels = [];
  let linePointVisibleCount = 0;
  let linePointsEdited = false;
  let queueSimpleFormUpdate = null;
  let scheduleSimpleFormChange = () => {};
  let flushSimpleFormChange = () => {};
  const pointMarkerControls = [];
  const pointMarkerValues = new Map();
  const pointLockStates = new Map();
  let pointLockEnabled = !(appState.simple.parsed && appState.simple.parsed.lockExtraPoints === false);
  ADV.points.lockExtraPoints = pointLockEnabled;
  const functionColorControls = [];
  let answerControl = null;
  const extraAnswerControls = [];
  const pruneControlsForExistingRows = () => {
    const rows = funcRows ? Array.from(funcRows.querySelectorAll('.func-group')) : [];
    if (!rows.length) return;
    const rowSet = new Set(rows);
    const pruneList = list => {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const entry = list[i];
        const row = entry && entry.row;
        if (!row || !rowSet.has(row)) {
          list.splice(i, 1);
        }
      }
    };
    pruneList(pointMarkerControls);
    pruneList(functionColorControls);
    pruneList(extraAnswerControls);
    [pointMarkerValues, pointLockStates].forEach(store => {
      Array.from(store.keys()).forEach(row => {
        if (!row || !rowSet.has(row)) {
          store.delete(row);
        }
      });
    });
  };
  const updateFunctionActionButtons = () => {
    const rowCount = funcRows ? funcRows.querySelectorAll('.func-group').length : 0;
    if (removeBtn) {
      removeBtn.style.display = rowCount > 1 ? '' : 'none';
    }
  };
  const DEFAULT_COLOR_FALLBACK = normalizeColorValue(getDefaultCurveColor(0))
    || DEFAULT_FUNCTION_COLORS.fallback[0]
    || GRAFTEGNER_FALLBACK_PALETTE[0];
  const FUNCTION_COLOR_OPTION_COUNT = 6;
  const getRowIndex = row => {
    if (!row || !row.dataset) return 1;
    const parsed = Number.parseInt(row.dataset.index, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  };
  const computeDefaultColorForIndex = index => {
    const options = getFunctionColorOptions();
    if (!options.length) {
      return normalizeColorValue(colorFor(index - 1)) || DEFAULT_COLOR_FALLBACK;
    }
    const offset = Number.isFinite(index) && index > 0 ? Math.trunc(index - 1) : 0;
    return normalizeColorValue(options[offset % options.length]) || DEFAULT_COLOR_FALLBACK;
  };
  let functionColorOptions = [];
  const resolveFunctionColorOptions = () => {
    const palette = resolveCurvePalette(FUNCTION_COLOR_OPTION_COUNT * 2);
    const fillPalette = selectGraftegnerFillColors(palette);
    const filled = ensureColorCount(fillPalette, DEFAULT_FUNCTION_COLORS.fallback, FUNCTION_COLOR_OPTION_COUNT);
    return filled.slice(0, FUNCTION_COLOR_OPTION_COUNT);
  };
  const getFunctionColorOptions = () => {
    if (!Array.isArray(functionColorOptions) || functionColorOptions.length === 0) {
      functionColorOptions = resolveFunctionColorOptions();
    }
    if (!functionColorOptions.length) {
      functionColorOptions = ensureColorCount(
        DEFAULT_FUNCTION_COLORS.fallback,
        GRAFTEGNER_FALLBACK_PALETTE,
        FUNCTION_COLOR_OPTION_COUNT
      );
    }
    return functionColorOptions.slice(0, FUNCTION_COLOR_OPTION_COUNT);
  };
  const normalizeFunctionColorChoice = color => {
    const normalized = normalizeColorValue(color);
    const options = getFunctionColorOptions();
    if (options.includes(normalized)) return normalized;
    return options[0] || DEFAULT_COLOR_FALLBACK;
  };
  const toColorInputArray = inputs => {
    if (!inputs) return [];
    if (Array.isArray(inputs)) return inputs.filter(Boolean);
    if (typeof inputs[Symbol.iterator] === 'function') {
      return Array.from(inputs).filter(Boolean);
    }
    return [inputs].filter(Boolean);
  };
  const buildFunctionColorSlots = palette =>
    palette.slice(0, FUNCTION_COLOR_OPTION_COUNT).map((color, index) => ({
      value: index + 1,
      label: `Velg farge ${index + 1}`,
      color
    }));
  const applyFunctionSwatch = (element, color) => {
    if (!element) return;
    if (colorPickerHelper && typeof colorPickerHelper.applyColorPairSwatch === 'function') {
      colorPickerHelper.applyColorPairSwatch(element, color, color);
      return;
    }
    if (element.classList) {
      element.classList.add('color-swatch--pair');
    }
    if (typeof color === 'string' && color) {
      element.style.setProperty('--swatch-fill', color);
      element.style.setProperty('--swatch-line', color);
    }
  };
  const updateFunctionColorPicker = (picker, hiddenInput, activeColor, palette) => {
    if (!picker || !hiddenInput || !colorPickerModule || typeof colorPickerModule.createColorPicker !== 'function') {
      return;
    }
    const normalizedActive = normalizeFunctionColorChoice(activeColor) || normalizeFunctionColorChoice(palette[0]) || DEFAULT_COLOR_FALLBACK;
    const slots = buildFunctionColorSlots(palette);
    const renderStyle = ({ element, slot, isActive }) => {
      const color = isActive ? normalizedActive : slot.color;
      applyFunctionSwatch(element, color);
    };
    const onSelect = value => {
      const slot = slots.find(entry => entry.value === value);
      if (!slot) return;
      const nextColor = normalizeFunctionColorChoice(slot.color) || slot.color;
      hiddenInput.value = nextColor;
      hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
      hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const getActiveValue = () => {
      const normalized = normalizeFunctionColorChoice(normalizedActive);
      const index = palette.findIndex(color => normalizeFunctionColorChoice(color) === normalized);
      return index >= 0 ? index + 1 : null;
    };
    const existing = functionColorPickerInstances.get(picker);
    if (existing) {
      existing.update({ slots, renderStyle, onSelect, getActiveValue });
    } else {
      const instance = colorPickerModule.createColorPicker({
        element: picker,
        slots,
        renderStyle,
        onSelect,
        getActiveValue
      });
      if (instance) {
        functionColorPickerInstances.set(picker, instance);
      }
    }
  };
  const syncFunctionColorSwatches = (inputs, preferred) => {
    const swatches = toColorInputArray(inputs);
    if (!swatches.length) return;
    const options = getFunctionColorOptions();
    const target = normalizeFunctionColorChoice(preferred) || options[0] || DEFAULT_COLOR_FALLBACK;
    swatches.forEach((input, index) => {
      const compactPicker = input.type === 'hidden' || (input.closest && input.closest('.func-color-compact'));
      const nextColor = compactPicker
        ? target
        : normalizeColorValue(options[index] || options[0] || DEFAULT_COLOR_FALLBACK) || DEFAULT_COLOR_FALLBACK;
      input.value = nextColor;
      input.dataset.colorIndex = String(index);
      if (compactPicker && input.closest) {
        const picker = input.closest('[data-color-picker]');
        if (picker) {
          updateFunctionColorPicker(picker, input, nextColor, options);
        }
      }
      const swatch = input.closest('.color-option') ? input.closest('.color-option').querySelector('.color-swatch') : null;
      if (swatch) {
        swatch.style.setProperty('--swatch-color', nextColor);
      }
      if (!compactPicker) {
        input.checked = nextColor === target;
      }
    });
  };
  const refreshFunctionColorOptions = () => {
    functionColorOptions = resolveFunctionColorOptions();
    const rows = funcRows ? Array.from(funcRows.querySelectorAll('.func-group')) : [];
    rows.forEach(row => {
      const control = functionColorControls.find(entry => entry && entry.row === row);
      const desired = control && control.manual ? control.value : computeDefaultColorForIndex(getRowIndex(row));
      const swatches = row.querySelectorAll('input[data-color]');
      syncFunctionColorSwatches(swatches, desired);
      if (control) {
        control.value = normalizeFunctionColorChoice(control.manual ? control.value : desired);
        if (!control.manual) {
          syncFunctionColorSwatches(control.inputs, control.value);
        }
      }
    });
  };
  refreshFunctionColorOptions();
  const applyColorManualClass = (row, manual) => {
    if (!row || !row.classList) return;
    if (manual) {
      row.classList.add('func-group--color-manual');
    } else {
      row.classList.remove('func-group--color-manual');
    }
  };
  const registerFunctionColorControl = (row, inputs, options = {}) => {
    if (!row) return null;
    const swatches = toColorInputArray(inputs);
    if (!swatches.length) return null;
    const index = getRowIndex(row);
    const providedDefault = normalizeFunctionColorChoice(options.defaultColor);
    const manualColor = normalizeFunctionColorChoice(options.manualColor);
    const control = {
      row,
      inputs: swatches,
      defaultColor: providedDefault || computeDefaultColorForIndex(index),
      value: '',
      manual: false
    };
    if (!control.defaultColor) {
      control.defaultColor = computeDefaultColorForIndex(index);
    }
    if (options.manual && manualColor) {
      control.manual = true;
      control.value = manualColor;
    } else if (manualColor && manualColor !== control.defaultColor) {
      control.manual = true;
      control.value = manualColor;
    } else {
      control.manual = false;
      control.value = normalizeFunctionColorChoice(control.defaultColor || DEFAULT_COLOR_FALLBACK);
    }
    if (!control.value) {
      control.value = normalizeFunctionColorChoice(control.defaultColor || DEFAULT_COLOR_FALLBACK);
    }
    syncFunctionColorSwatches(control.inputs, control.value);
    applyColorManualClass(row, control.manual);
    const handleColorInput = event => {
      const target = event && event.target && swatches.includes(event.target) ? event.target : null;
      const normalized = normalizeFunctionColorChoice(target ? target.value : control.value);
      const nextValue = normalized || control.defaultColor || DEFAULT_COLOR_FALLBACK;
      if (normalized && control.defaultColor && normalized === control.defaultColor) {
        control.manual = false;
        control.value = control.defaultColor;
      } else if (normalized) {
        control.manual = true;
        control.value = normalized;
      } else {
        control.manual = false;
        control.value = control.defaultColor || DEFAULT_COLOR_FALLBACK;
      }
      syncFunctionColorSwatches(control.inputs, control.value);
      applyColorManualClass(row, control.manual);
      if (event && event.type === 'change') {
        flushSimpleFormChange();
      } else {
        scheduleSimpleFormChange();
      }
    };
    swatches.forEach(input => {
      input.addEventListener('change', handleColorInput);
      input.addEventListener('click', handleColorInput);
    });
    functionColorControls.push(control);
    return control;
  };
  const clearFunctionColorControls = () => {
    functionColorControls.length = 0;
  };
  const getFunctionColorInfoForRow = row => {
    const control = functionColorControls.find(entry => entry && entry.row === row);
    if (!control) {
      return {
        manual: false,
        value: '',
        defaultColor: computeDefaultColorForIndex(getRowIndex(row))
      };
    }
    return {
      manual: !!control.manual,
      value: control.manual ? control.value : '',
      defaultColor: control.defaultColor || computeDefaultColorForIndex(getRowIndex(row))
    };
  };
  let refreshFunctionColorDefaultsLocal = () => {
    refreshFunctionColorOptions();
    functionColorControls.forEach(control => {
      if (!control || !control.row) return;
      const nextDefault = computeDefaultColorForIndex(getRowIndex(control.row));
      control.defaultColor = normalizeFunctionColorChoice(nextDefault || control.defaultColor || DEFAULT_COLOR_FALLBACK);
      const availableColors = getFunctionColorOptions();
      if (control.manual && !availableColors.includes(control.value)) {
        control.manual = false;
      }
      if (!control.manual) {
        control.value = control.defaultColor || DEFAULT_COLOR_FALLBACK;
        syncFunctionColorSwatches(control.inputs, control.value);
      }
      applyColorManualClass(control.row, control.manual);
    });
  };
  const setPointMarkerValueForRow = (row, value, options = {}) => {
    if (!row) return;
    const allowEmpty = !!options.allowEmpty;
    const fallback = options.fallback || DEFAULT_POINT_MARKER;
    const normalized = normalizePointMarkerValue(value);
    const stored = normalized || (allowEmpty ? '' : fallback);
    const inputValue = stored === '' ? '' : stored || fallback;
    pointMarkerValues.set(row, stored);
    const control = pointMarkerControls.find(entry => entry && entry.row === row);
    if (control && control.input && options.updateInput !== false) {
      control.input.value = inputValue;
    }
  };
  const getPointMarkerValueForRow = row => {
    if (row && pointMarkerValues.has(row)) {
      return pointMarkerValues.get(row);
    }
    return pointMarkerValue;
  };
  const setPointLockValueForRow = (row, locked) => {
    if (!row) return;
    pointLockStates.set(row, !!locked);
    const control = pointMarkerControls.find(entry => entry && entry.row === row);
    if (control && control.lock && control.lock.checkbox) {
      control.lock.checkbox.checked = !!locked;
    }
  };
  const getPointLockValueForRow = row => {
    if (row && pointLockStates.has(row)) {
      return !!pointLockStates.get(row);
    }
    return pointLockEnabled;
  };
  let pointMarkerValue = DEFAULT_POINT_MARKER;
  const MATHFIELD_TAG = 'MATH-FIELD';
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  const hasTouchSupport = typeof window !== 'undefined' && (
    'ontouchstart' in window ||
    (nav && (nav.maxTouchPoints > 0 || nav.msMaxTouchPoints > 0))
  );
  const hasCoarsePointer = typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const enableVirtualKeyboard = hasTouchSupport || hasCoarsePointer;
  const mathFieldKeyboardMode = enableVirtualKeyboard ? 'onfocus' : 'off';
  const mathFieldKeyboardAttr = `virtual-keyboard-mode="${mathFieldKeyboardMode}"`;
  const COMMAND_NAME_MAP = {
    cdot: '*',
    times: '*',
    div: '/',
    pm: '+/-',
    minus: '-',
    pi: 'pi',
    tau: 'tau',
    theta: 'theta',
    alpha: 'alpha',
    beta: 'beta',
    gamma: 'gamma',
    phi: 'phi',
    degree: 'deg',
    log: 'log',
    ln: 'ln',
    sin: 'sin',
    cos: 'cos',
    tan: 'tan',
    asin: 'asin',
    acos: 'acos',
    atan: 'atan',
    sinh: 'sinh',
    cosh: 'cosh',
    tanh: 'tanh',
    exp: 'exp',
    abs: 'abs',
    max: 'max',
    min: 'min',
    floor: 'floor',
    ceil: 'ceil',
    round: 'round'
  };
  const tryGetMathFieldValue = (field, format) => {
    if (!field || typeof field.getValue !== 'function') return '';
    try {
      const value = field.getValue(format);
      return typeof value === 'string' ? value : '';
    } catch (_) {
      return '';
    }
  };
  const readGroup = (str, startIdx) => {
    if (typeof str !== 'string' || startIdx == null || startIdx < 0 || startIdx >= str.length) {
      return ['', typeof startIdx === 'number' ? startIdx : 0];
    }
    if (str[startIdx] !== '{') {
      return ['', startIdx];
    }
    let depth = 0;
    for (let i = startIdx + 1; i < str.length; i++) {
      const ch = str[i];
      if (ch === '{') {
        depth++;
        continue;
      }
      if (ch === '}') {
        if (depth === 0) {
          return [str.slice(startIdx + 1, i), i + 1];
        }
        depth--;
      }
    }
    return [str.slice(startIdx + 1), str.length];
  };
  const replaceLatexFractions = str => {
    if (typeof str !== 'string' || !str.includes('\\frac')) {
      return typeof str === 'string' ? str : '';
    }
    let out = '';
    let idx = 0;
    while (idx < str.length) {
      const start = str.indexOf('\\frac', idx);
      if (start === -1) {
        out += str.slice(idx);
        break;
      }
      out += str.slice(idx, start);
      let pos = start + 5;
      while (pos < str.length && /\s/.test(str[pos])) pos++;
      let numerator = '';
      let denominator = '';
      if (pos < str.length && str[pos] === '{') {
        const group = readGroup(str, pos);
        numerator = replaceLatexFractions(group[0]);
        pos = group[1];
      }
      while (pos < str.length && /\s/.test(str[pos])) pos++;
      if (pos < str.length && str[pos] === '{') {
        const group = readGroup(str, pos);
        denominator = replaceLatexFractions(group[0]);
        pos = group[1];
      }
      out += `(${numerator})/(${denominator})`;
      idx = pos;
    }
    return out;
  };
  const replaceLatexSqrt = str => {
    if (typeof str !== 'string' || !str.includes('\\sqrt')) {
      return typeof str === 'string' ? str : '';
    }
    let out = '';
    let idx = 0;
    while (idx < str.length) {
      const start = str.indexOf('\\sqrt', idx);
      if (start === -1) {
        out += str.slice(idx);
        break;
      }
      out += str.slice(idx, start);
      let pos = start + 5;
      while (pos < str.length && /\s/.test(str[pos])) pos++;
      let radicand = '';
      if (pos < str.length && str[pos] === '{') {
        const group = readGroup(str, pos);
        radicand = replaceLatexSqrt(replaceLatexFractions(group[0]));
        pos = group[1];
      }
      out += `sqrt(${radicand})`;
      idx = pos;
    }
    return out;
  };
  const convertLatexLikeToPlain = latex => {
    if (typeof latex !== 'string') return '';
    let str = latex;
    str = str.replace(/\\left|\\right/g, '');
    str = str.replace(/\\!/g, '');
    str = str.replace(/\\,/g, '');
    str = str.replace(/\\;/g, ' ');
    str = str.replace(/~|\\:/g, ' ');
    str = str.replace(/\\\\/g, '\n');
    str = replaceLatexFractions(str);
    str = replaceLatexSqrt(str);
    str = str.replace(/\\operatorname\{([^{}]+)\}/gi, '$1');
    str = str.replace(/\\([a-zA-Z]+)\b/g, (match, name) => {
      const key = name.toLowerCase();
      return COMMAND_NAME_MAP[key] != null ? COMMAND_NAME_MAP[key] : name;
    });
    str = str.replace(/\\([a-zA-Z]+)/g, (match, name) => {
      const key = name.toLowerCase();
      return COMMAND_NAME_MAP[key] != null ? COMMAND_NAME_MAP[key] : name;
    });
    str = str.replace(/\\([{}])/g, '$1');
    str = str.replace(/\\%/g, '%');
    str = str.replace(/\\#/g, '#');
    str = str.replace(/\\&/g, '&');
    str = str.replace(/\\_/g, '_');
    str = str.replace(/\\\^/g, '^');
    str = str.replace(/\^\{([^{}]+)\}/g, '^($1)');
    str = str.replace(/_\{([^{}]+)\}/g, '_($1)');
    str = str.replace(/\^\(([^()]+)\)/g, '^$1');
    str = str.replace(/_\(([^()]+)\)/g, '_$1');
    str = str.replace(/[{}]/g, '');
    return str;
  };
  const replaceAsciiFractions = str => {
    if (typeof str !== 'string' || !str.toLowerCase().includes('frac(')) {
      return typeof str === 'string' ? str : '';
    }
    let out = str;
    let idx = out.toLowerCase().indexOf('frac(');
    while (idx !== -1) {
      let pos = idx + 5;
      let depth = 0;
      let comma = -1;
      for (let i = pos; i < out.length; i++) {
        const ch = out[i];
        if (ch === '(') {
          depth++;
        } else if (ch === ')') {
          if (depth === 0) break;
          depth--;
        } else if (ch === ',' && depth === 0) {
          comma = i;
          break;
        }
      }
      if (comma === -1) break;
      depth = 0;
      let end = -1;
      for (let i = comma + 1; i < out.length; i++) {
        const ch = out[i];
        if (ch === '(') {
          depth++;
        } else if (ch === ')') {
          if (depth === 0) {
            end = i;
            break;
          }
          depth--;
        }
      }
      if (end === -1) break;
      const numerator = replaceAsciiFractions(out.slice(idx + 5, comma).trim());
      const denominator = replaceAsciiFractions(out.slice(comma + 1, end).trim());
      out = `${out.slice(0, idx)}(${numerator})/(${denominator})${out.slice(end + 1)}`;
      idx = out.toLowerCase().indexOf('frac(');
    }
    return out;
  };
  const convertAsciiMathLikeToPlain = ascii => {
    if (typeof ascii !== 'string') return '';
    let str = ascii;
    str = replaceAsciiFractions(str);
    str = str.replace(/·|⋅/g, '*');
    str = str.replace(/÷/g, '/');
    str = str.replace(/−/g, '-');
    // MathLive inserts invisible operators when exporting ASCIIMath
    //   U+2062 INVISIBLE TIMES is used for implicit multiplication (2⁢x → 2*x)
    //   U+2061 INVISIBLE FUNCTION APPLICATION (sin⁡(x)) should simply be removed
    //   U+2063 INVISIBLE SEPARATOR and U+2064 INVISIBLE PLUS may also appear
    str = str.replace(/\u2062/g, '*');
    str = str.replace(/[\u2061\u2063\u2064]/g, '');
    str = str.replace(/\*\*/g, '^');
    str = str.replace(/\bsqrt\s*\(/gi, 'sqrt(');
    str = str.replace(/\bpi\b/gi, 'pi');
    str = str.replace(/\btau\b/gi, 'tau');
    return str;
  };
  const normalizePlainExpression = value => {
    if (value == null) return '';
    const raw = collapseExpressionWhitespace(String(value));
    if (!raw) return '';
    if (raw.includes('\\')) {
      return collapseExpressionWhitespace(convertLatexLikeToPlain(raw));
    }
    return collapseExpressionWhitespace(convertAsciiMathLikeToPlain(raw));
  };
  const getFunctionInputValue = element => {
    if (!element) return '';
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG) {
      let plain = tryGetMathFieldValue(element, 'ascii-math');
      if (!plain) {
        plain = tryGetMathFieldValue(element, 'ASCIIMath');
      }
      if (!plain) {
        plain = tryGetMathFieldValue(element, 'latex');
        if (plain) {
          plain = convertLatexLikeToPlain(plain);
        }
      }
      if (!plain && typeof element.value === 'string') {
        plain = element.value;
      }
      return normalizePlainExpression(plain);
    }
    const val = element.value != null ? element.value : '';
    return normalizePlainExpression(val);
  };
  const updateFunctionPreview = element => {
    if (!element) return;
    const editor = element.closest ? element.closest('.func-editor') : null;
    if (!editor) return;
    const preview = editor.querySelector('[data-fun-preview]');
    if (!preview) return;
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    const previewLayout = editor ? editor.getAttribute('data-preview-layout') : '';
    const allowMathFieldPreview = tag === MATHFIELD_TAG && previewLayout === 'below';
    if (tag === MATHFIELD_TAG && isMathLiveReady() && !allowMathFieldPreview) {
      preview.innerHTML = '';
      preview.textContent = '';
      preview.classList.remove('func-preview--latex', 'func-preview--text');
      preview.classList.add('func-preview--empty');
      preview.setAttribute('data-mode', 'empty');
      updateFunctionPreviewAccessibility(editor, preview);
      return;
    }
    const value = getFunctionInputValue(element);
    const allowLatex = !preview.hasAttribute('data-preview-no-latex');
    const latex = allowLatex ? convertExpressionToLatex(value) : '';
    const html = allowLatex && latex ? renderLatexToHtml(latex) : '';
    const plain = normalizeExpressionText(value);
    preview.innerHTML = '';
    preview.textContent = '';
    preview.classList.remove('func-preview--latex', 'func-preview--text', 'func-preview--empty');
    preview.removeAttribute('data-mode');
    if (html) {
      preview.innerHTML = html;
      preview.classList.add('func-preview--latex');
      preview.setAttribute('data-mode', 'latex');
    } else if (plain) {
      preview.textContent = plain;
      preview.classList.add('func-preview--text');
      preview.setAttribute('data-mode', 'text');
    } else {
      preview.classList.add('func-preview--empty');
      preview.setAttribute('data-mode', 'empty');
    }
    updateFunctionPreviewAccessibility(editor, preview);
  };
  const updateFunctionPreviewAccessibility = (editor, preview) => {
    if (!editor || !preview) return;
    const isPreviewMode = editor.getAttribute('data-editor-mode') === 'preview';
    const isEmpty = preview.classList.contains('func-preview--empty');
    if (isPreviewMode && !isEmpty) {
      preview.setAttribute('aria-hidden', 'false');
      preview.tabIndex = 0;
    } else {
      preview.setAttribute('aria-hidden', 'true');
      preview.tabIndex = -1;
    }
  };
  const setFunctionEditorMode = (element, mode) => {
    if (!element) return;
    const editor = element.closest ? element.closest('.func-editor') : null;
    if (!editor) return;
    const preview = editor.querySelector('[data-fun-preview]');
    const desired = mode === 'preview' ? 'preview' : 'edit';
    const effective = desired === 'preview' && preview && preview.classList.contains('func-preview--empty') ? 'edit' : desired;
    editor.setAttribute('data-editor-mode', effective);
    updateFunctionPreviewAccessibility(editor, preview);
  };
  const getMathFieldConstructor = () => {
    if (typeof window === 'undefined') return null;
    if (window.customElements && typeof window.customElements.get === 'function') {
      const defined = window.customElements.get('math-field');
      if (defined) {
        return defined;
      }
    }
    if (typeof window.MathfieldElement !== 'undefined') {
      return window.MathfieldElement;
    }
    return null;
  };
  const isMathLiveReady = () => {
    const ctor = getMathFieldConstructor();
    if (!ctor || !ctor.prototype) {
      return false;
    }
    return (
      typeof ctor.prototype.getValue === 'function' &&
      typeof ctor.prototype.setValue === 'function'
    );
  };
  const MATHLIVE_READY_QUEUE = [];
  let mathLiveReadyHandled = false;
  let mathLiveReadyPromise = null;
  const getMathLiveReadyPromise = () => {
    if (mathLiveReadyPromise) {
      return mathLiveReadyPromise;
    }
    if (typeof window !== 'undefined' && window.customElements && typeof window.customElements.whenDefined === 'function') {
      mathLiveReadyPromise = window.customElements.whenDefined('math-field').catch(() => {});
    } else if (typeof Promise !== 'undefined') {
      mathLiveReadyPromise = Promise.resolve();
    }
    return mathLiveReadyPromise;
  };
  const flushMathLiveReadyQueue = () => {
    if (mathLiveReadyHandled) return;
    if (!isMathLiveReady()) {
      if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
        window.setTimeout(flushMathLiveReadyQueue, 50);
      }
      return;
    }
    mathLiveReadyHandled = true;
    while (MATHLIVE_READY_QUEUE.length) {
      const cb = MATHLIVE_READY_QUEUE.shift();
      if (typeof cb === 'function') {
        try {
          cb();
        } catch (_) {}
      }
    }
  };
  const whenMathLiveReady = callback => {
    if (typeof callback !== 'function') return;
    if (isMathLiveReady()) {
      callback();
      return;
    }
    MATHLIVE_READY_QUEUE.push(callback);
    const readyPromise = getMathLiveReadyPromise();
    if (readyPromise && typeof readyPromise.then === 'function') {
      readyPromise.then(() => {
        if (typeof window !== 'undefined' && window.setTimeout) {
          window.setTimeout(flushMathLiveReadyQueue, 0);
        } else {
          flushMathLiveReadyQueue();
        }
      }).catch(() => {});
    }
  };
  const ensureMathFieldOptions = field => {
    const apply = () => {
      if (field && typeof field.setOptions === 'function') {
        field.setOptions({
          smartMode: false,
          virtualKeyboardMode: 'off'
        });
      }
    };
    if (isMathLiveReady()) {
      apply();
      return;
    }
    whenMathLiveReady(apply);
  };
  const createFunctionFallbackInput = source => {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = source && source.className ? source.className : 'func-math-field';
    input.setAttribute('data-fun', '');
    input.autocomplete = 'off';
    input.spellcheck = false;
    if (source) {
      const placeholder = source.getAttribute('placeholder');
      const ariaLabel = source.getAttribute('aria-label');
      const existingValue = source.hasAttribute('value') ? source.getAttribute('value') : source.textContent;
      if (placeholder) {
        input.setAttribute('placeholder', placeholder);
      }
      if (ariaLabel) {
        input.setAttribute('aria-label', ariaLabel);
      }
      if (existingValue) {
        input.value = existingValue;
      }
    }
    return input;
  };
  const ensureFunctionInputElement = element => {
    if (!element) return element;
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG) {
      const fallback = createFunctionFallbackInput(element);
      element.replaceWith(fallback);
      return fallback;
    }
    return element;
  };
  const setFunctionInputValue = (element, value) => {
    if (!element) return;
    const str = value != null ? String(value) : '';
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG) {
      const applyValue = () => {
        if (!element || !element.isConnected) return;
        ensureMathFieldOptions(element);
        if (typeof element.setValue === 'function') {
          try {
            element.setValue(str, { format: 'ascii-math' });
            updateFunctionPreview(element);
            setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
            return;
          } catch (_) {
            try {
              const latexValue = convertExpressionToLatex(str);
              element.setValue(latexValue, { format: 'latex' });
              updateFunctionPreview(element);
              setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
              return;
            } catch (_) {}
          }
        }
        const latex = convertExpressionToLatex(str);
        if ('value' in element) {
          element.value = latex;
        } else {
          element.setAttribute('value', latex);
        }
        updateFunctionPreview(element);
        setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
      };
      if (!isMathLiveReady() || typeof element.setValue !== 'function') {
        const latex = convertExpressionToLatex(str);
        if ('value' in element) {
          element.value = latex;
        } else {
          element.setAttribute('value', latex);
        }
        updateFunctionPreview(element);
        whenMathLiveReady(applyValue);
        setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
        return;
      }
      applyValue();
      return;
    }
    element.value = str;
    updateFunctionPreview(element);
    setFunctionEditorMode(element, normalizePlainExpression(str) ? 'preview' : 'edit');
  };
  const isCoords = str => {
    if (typeof str !== 'string') return false;
    const points = parsePointListString(str);
    return points.length > 0;
  };
  const isExplicitFun = str => {
    const m = str.match(/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=\s*(.+)$/) || str.match(/^y\s*=\s*(.+)$/i);
    const rhs = m ? m[1] : str;
    if (!rhs || !rhs.trim()) {
      return false;
    }
    return isExplicitRHS(rhs);
  };
  const getFirstFunctionValue = () => {
    if (!funcRows) return '';
    const firstGroup = funcRows.querySelector('.func-group');
    const firstRowInput = firstGroup ? firstGroup.querySelector('[data-fun]') : null;
    return firstRowInput ? getFunctionInputValue(firstRowInput) : '';
  };
  const getPointMarkerInputValue = row => normalizePointMarkerValue(getPointMarkerValueForRow(row)) || '';
  const setPointMarkerInputValue = (value, targetRow = null) => {
    if (targetRow) {
      setPointMarkerValueForRow(targetRow, value);
      return;
    }
    const normalized = normalizePointMarkerValue(value);
    pointMarkerValue = normalized || DEFAULT_POINT_MARKER;
    pointMarkerControls.forEach(control => {
      if (!control || !control.input) return;
      if (control.row && pointMarkerValues.has(control.row)) return;
      control.input.value = normalized || DEFAULT_POINT_MARKER;
    });
  };
  const getFunctionRowIndex = row => {
    if (!row) return null;
    if (row.dataset && row.dataset.index && Number.isFinite(+row.dataset.index)) {
      return Number.parseInt(row.dataset.index, 10);
    }
    if (!funcRows) return null;
    const rows = Array.from(funcRows.querySelectorAll('.func-group'));
    const idx = rows.indexOf(row);
    return idx >= 0 ? idx + 1 : null;
  };
  const classifyFunctionLabel = value => {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    if (!trimmed) return 'function';
    if (isCoords(trimmed)) return 'point';
    if (/^y\s*=/i.test(trimmed)) return 'line';
    return 'function';
  };
  const updateFunctionLegend = row => {
    if (!row) return;
    const legend = row.querySelector('legend');
    const index = getFunctionRowIndex(row);
    if (!legend || !index) return;
    const funInput = row.querySelector('[data-fun]');
    const value = funInput ? getFunctionInputValue(funInput) : '';
    const type = classifyFunctionLabel(value);
    const prefix = type === 'point' ? 'Punkt' : type === 'line' ? 'Linje' : 'Funksjon';
    legend.textContent = `${prefix} ${index}`;
  };
  const syncPointMarkerValueFromInput = (input, row, opts = {}) => {
    if (!input) return;
    const rawValue = typeof input.value === 'string' ? input.value : '';
    const normalized = normalizePointMarkerValue(rawValue);
    const commit = !!opts.commit;
    const isExplicitEmpty = rawValue.trim() === '';
    const allowEmpty = !commit || isExplicitEmpty;
    const valueToStore = commit
      ? (isExplicitEmpty ? '' : (normalized || DEFAULT_POINT_MARKER))
      : normalized || '';
    setPointMarkerValueForRow(row, valueToStore, { allowEmpty, updateInput: commit && !isExplicitEmpty });
    if (commit) {
      if (isExplicitEmpty) {
        input.value = '';
      } else if (!normalized) {
        input.value = DEFAULT_POINT_MARKER;
      }
    }
  };
  const getPointMarkerValueForExport = row => {
    const normalized = normalizePointMarkerValue(getPointMarkerInputValue(row));
    return normalized && !isDefaultPointMarker(normalized) ? normalized : '';
  };
  const updatePointMarkerVisibility = () => {
    pointMarkerControls.forEach(control => {
      if (!control || !control.row) return;
      const funInput = control.row.querySelector('[data-fun]');
      const value = funInput ? getFunctionInputValue(funInput) : '';
      const show = !!value && isCoords(value);
      if (control.container) {
        control.container.style.display = show ? '' : 'none';
      }
      if (control.input) {
        control.input.disabled = !show;
        if (show) {
          const storedValue = getPointMarkerValueForRow(control.row);
          const markerValue = normalizePointMarkerValue(storedValue);
          const explicitEmpty = storedValue === '';
          control.input.value = explicitEmpty ? '' : (markerValue || DEFAULT_POINT_MARKER);
        }
      }
      if (control.lock && control.lock.container) {
        control.lock.container.style.display = show ? '' : 'none';
      }
      if (control.lock && control.lock.checkbox) {
        control.lock.checkbox.disabled = !show;
        if (show) {
          control.lock.checkbox.checked = getPointLockValueForRow(control.row);
        }
      }
    });
  };
  const determineForcedGliderCount = value => {
    if (!value) return null;
    const match = value.match(/^[a-zA-Z]\w*\s*\(\s*x\s*\)\s*=\s*(.+)$/) || value.match(/^y\s*=\s*(.+)$/i);
    const rhs = (match ? match[1] : value).trim();
    if (!rhs) return null;
    const normalized = rhs.replace(/\s+/g, '').toLowerCase();
    const hasA = /(^|[+\-*/(])a(?=\*?x(?![a-z]))/.test(normalized);
    const hasB = /(^|[+\-])b(?![a-z])(?!\*|x)/.test(normalized);
    if (hasA && hasB) return 2;
    if (hasA || hasB) return 1;
    return null;
  };
  const formatNumber = (val, step = null) => {
    if (typeof val !== 'number') return '';
    if (!Number.isFinite(val)) return '';
    if (Number.isFinite(step) && step > 0) {
      return fmtSmartVal(val, step);
    }
    return toFixedTrim(val, ADV.points.decimals);
  };
  const parseStartXValues = value => {
    if (!value) return [];
    const text = String(value);
    const entries = [];
    const pairRegex = /\(\s*-?\d+(?:[.,]\d+)?(?:\s*,\s*-?\d+(?:[.,]\d+)?)?\s*\)/g;
    let match;
    while ((match = pairRegex.exec(text)) !== null) {
      const inner = match[0];
      const numberRegex = /-?\d+(?:[.,]\d+)?/g;
      const numberMatch = numberRegex.exec(inner);
      if (numberMatch) {
        const num = Number.parseFloat(numberMatch[0].replace(',', '.'));
        if (Number.isFinite(num)) {
          entries.push({ index: match.index + numberMatch.index, value: num });
        }
      }
    }
    const cleaned = text.replace(pairRegex, ' ');
    const numRegex = /-?\d+(?:[.,]\d+)?/g;
    while ((match = numRegex.exec(cleaned)) !== null) {
      const num = Number.parseFloat(match[0].replace(',', '.'));
      if (Number.isFinite(num)) {
        entries.push({ index: match.index, value: num });
      }
    }
    entries.sort((a, b) => a.index - b.index);
    return entries.map(entry => entry.value);
  };
  const getPrimaryFunctionEvaluator = () => {
    const value = getFirstFunctionValue();
    if (!value || !isExplicitFun(value)) {
      return null;
    }
    let main = value;
    const domMatch = main.match(/,?\s*x\s*(?:in|∈)\s*.+$/i);
    if (domMatch) {
      main = main.slice(0, domMatch.index).trim();
    }
    const fnMatch = main.match(/^([a-zA-Z]\w*)\s*\(\s*x\s*\)\s*=\s*(.+)$/);
    let spec;
    if (fnMatch) {
      spec = `${fnMatch[1]}(x)=${fnMatch[2]}`;
    } else {
      const yMatch = main.match(/^y\s*=\s*(.+)$/i);
      if (!yMatch) return null;
      spec = `f(x)=${yMatch[1]}`;
    }
    const evaluator = parseFunctionSpec(spec);
    return typeof evaluator === 'function' ? evaluator : null;
  };
  const formatGliderStartDisplay = xValues => {
    if (!Array.isArray(xValues) || !xValues.length) return '';
    const sx = stepX();
    const parts = [];
    xValues.forEach(raw => {
      if (!Number.isFinite(raw)) return;
      const formattedX = formatNumber(raw, sx);
      if (formattedX) {
        parts.push(`x=${formattedX}`);
      }
    });
    if (!parts.length) return '';
    return parts.join(', ');
  };
  const setGliderStartInputValues = values => {
    if (!gliderStartInput) return;
    const nums = Array.isArray(values) ? values.filter(Number.isFinite) : [];
    if (nums.length) {
      const display = formatGliderStartDisplay(nums);
      if (display) {
        gliderStartInput.value = display;
        return;
      }
      gliderStartInput.value = nums.map(val => formatNumber(val, stepX())).join(', ');
      return;
    }
    gliderStartInput.value = 'x=1';
  };
  const refreshGliderStartInputDisplay = () => {
    if (!gliderStartInput) return;
    const values = parseStartXValues(gliderStartInput.value || '');
    if (!values.length) return;
    setGliderStartInputValues(values);
  };
  const applyGliderStartValues = rawValues => {
    const numbers = Array.isArray(rawValues) ? rawValues.filter(Number.isFinite) : [];
    const primary = MODE === 'functions' && Array.isArray(appState.graphs) && appState.graphs.length > 0 ? appState.graphs[0] : null;
    const domain = primary && primary.domain ? primary.domain : null;
    const clampValue = val => {
      if (!Number.isFinite(val)) return val;
      let next = val;
      if (domain) {
        if (Number.isFinite(domain.min) && next < domain.min) {
          next = domain.min;
        }
        if (Number.isFinite(domain.max) && next > domain.max) {
          next = domain.max;
        }
      }
      return next;
    };
    const clampedNumbers = numbers.map(clampValue);
    if (appState.simple.parsed && typeof appState.simple.parsed === 'object') {
      appState.simple.parsed.startX = clampedNumbers.slice();
    }
    ADV.points.startX = clampedNumbers.slice();
    if (primary && Array.isArray(primary.gliders) && primary.gliders.length > 0) {
      const gliders = primary.gliders;
      const fallback = clampedNumbers.length ? clampedNumbers[0] : null;
      let moved = false;
      for (let i = 0; i < gliders.length; i++) {
        const glider = gliders[i];
        if (!glider) continue;
        const targetX = clampedNumbers[i] != null ? clampedNumbers[i] : fallback;
        if (!Number.isFinite(targetX)) continue;
        const fnY = typeof primary.fn === 'function' ? primary.fn(targetX) : NaN;
        if (!Number.isFinite(fnY) || typeof glider.moveTo !== 'function') {
          continue;
        }
        try {
          let moveNeeded = true;
          if (typeof glider.X === 'function' && typeof glider.Y === 'function') {
            const currentX = glider.X();
            const currentY = glider.Y();
            if (Number.isFinite(currentX) && Number.isFinite(currentY)) {
              const EPS = 1e-9;
              moveNeeded = Math.abs(currentX - targetX) > EPS || Math.abs(currentY - fnY) > EPS;
            }
          }
          if (moveNeeded) {
            glider.moveTo([targetX, fnY]);
            moved = true;
            if (glider.label) {
              setPointLabelText(glider, () => fmtCoordsStatic(glider));
            }
          }
        } catch (_) {}
      }
      if (moved && appState.board && typeof appState.board.update === 'function') {
        appState.board.update();
      }
    }
    return clampedNumbers;
  };
  const handleGliderStartInputChange = () => {
    scheduleSimpleFormChange();
  };
  const handleGliderStartInputCommit = () => {
    if (!gliderStartInput) {
      flushSimpleFormChange();
      return;
    }
    const values = parseStartXValues(gliderStartInput.value || '');
    const applied = applyGliderStartValues(values);
    if (applied.length) {
      setGliderStartInputValues(applied);
    }
    flushSimpleFormChange();
  };
  const attachGliderStartInputListeners = () => {
    if (!gliderStartInput) return;
    if (gliderStartInput.__grafStartListenersAttached) return;
    gliderStartInput.addEventListener('input', handleGliderStartInputChange);
    gliderStartInput.addEventListener('change', handleGliderStartInputCommit);
    gliderStartInput.addEventListener('blur', handleGliderStartInputCommit);
    gliderStartInput.__grafStartListenersAttached = true;
  };
  const parseLinePointInput = value => {
    if (!value) return null;
    const matches = String(value).match(/-?\d+(?:[.,]\d+)?/g);
    if (!matches || matches.length < 2) return null;
    const nums = matches.slice(0, 2).map(str => Number.parseFloat(str.replace(',', '.')));
    if (!nums.every(Number.isFinite)) return null;
    return nums;
  };
  const formatPointInputValue = pt => {
    if (!Array.isArray(pt) || pt.length < 2) {
      return '';
    }
    const [x, y] = pt;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return '';
    }
    return `(${formatNumber(x, stepX())}, ${formatNumber(y, stepY())})`;
  };
  const setLinePointInputValues = points => {
    if (!Array.isArray(points)) return;
    linePointInputs.forEach((input, idx) => {
      if (!input) return;
      const pt = points[idx];
      input.value = formatPointInputValue(pt);
    });
  };
    const applyLinePointValues = (points, spec) => {
      if (!Array.isArray(points) || !points.length) {
        return false;
      }
      const clones = points
        .map(pt => (Array.isArray(pt) ? pt.slice(0, 2) : null))
        .filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite));
      if (!clones.length) {
        return false;
      }
      const xValues = clones.map(pt => pt[0]).filter(Number.isFinite);
      if (appState.simple.parsed && typeof appState.simple.parsed === 'object') {
        appState.simple.parsed.linePoints = clones.map(pt => pt.slice());
        if (xValues.length) {
          appState.simple.parsed.startX = xValues.slice();
        }
      }
      if (Array.isArray(ADV.points.start)) {
        for (let i = 0; i < clones.length && i < ADV.points.start.length; i++) {
          ADV.points.start[i] = clones[i].slice();
        }
      }
      if (xValues.length) {
        ADV.points.startX = xValues.slice();
      }
      if (MODE === 'points' && appState.board && Array.isArray(appState.points.moving) && appState.points.moving.length) {
        const resolvedSpec = spec || getLineTemplateSpec();
        const kind = resolvedSpec && resolvedSpec.kind ? resolvedSpec.kind : null;
        const moveTargets = kind === 'two' ? clones : [clones[0]];
        const limit = Math.min(moveTargets.length, appState.points.moving.length);
        for (let i = 0; i < limit; i++) {
          const point = appState.points.moving[i];
          const target = kind === 'two' ? moveTargets[i] : moveTargets[0];
          if (!point || !Array.isArray(target)) continue;
          const [tx, ty] = target;
          if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
          if (typeof point.moveTo === 'function') {
            let moveNeeded = true;
            if (typeof point.X === 'function' && typeof point.Y === 'function') {
              const currentX = point.X();
              const currentY = point.Y();
              if (Number.isFinite(currentX) && Number.isFinite(currentY)) {
                const EPS = 1e-9;
                moveNeeded = Math.abs(currentX - tx) > EPS || Math.abs(currentY - ty) > EPS;
              }
            }
            if (moveNeeded) {
              try {
                point.moveTo([tx, ty]);
                if (point.label) {
                  setPointLabelText(point, () => fmtCoordsStatic(point));
                }
              } catch (_) {
                // ignore move errors
              }
            }
          }
        }
        if (typeof appState.board.update === 'function') {
          appState.board.update();
        }
      } else if (MODE === 'functions' && Array.isArray(appState.graphs) && appState.graphs.length > 0) {
        const resolvedSpec = spec || getLineTemplateSpec();
        const targetPoints = resolvedSpec && resolvedSpec.kind === 'two' ? clones : [clones[0]];
        const primary = appState.graphs[0];
        if (primary && Array.isArray(primary.gliders) && primary.gliders.length) {
          const domain = primary.domain || null;
          const gliders = primary.gliders;
          const limit = Math.min(targetPoints.length, gliders.length);
          for (let i = 0; i < limit; i++) {
            const glider = gliders[i];
            const target = targetPoints[i];
            if (!glider || !Array.isArray(target)) continue;
            const rawX = target[0];
            if (!Number.isFinite(rawX)) continue;
            let clampedX = rawX;
            if (domain) {
              if (Number.isFinite(domain.min) && clampedX < domain.min) {
                clampedX = domain.min;
              }
              if (Number.isFinite(domain.max) && clampedX > domain.max) {
                clampedX = domain.max;
              }
            }
            const fnY = typeof primary.fn === 'function' ? primary.fn(clampedX) : NaN;
            if (!Number.isFinite(fnY) || typeof glider.moveTo !== 'function') {
              continue;
            }
            try {
              glider.moveTo([clampedX, fnY]);
              if (glider.label) {
                setPointLabelText(glider, () => fmtCoordsStatic(glider));
              }
            } catch (_) {}
          }
          if (appState.board && typeof appState.board.update === 'function') {
            appState.board.update();
          }
        }
      }
      return true;
    };
  const syncLinePointsToBoardFromInputs = () => {
    const spec = getLineTemplateSpec();
    const needed = getLinePointCount(spec);
    if (needed <= 0) {
      return false;
    }
    const values = getLinePointsFromInputs(needed);
    if (values.length !== needed) {
      return false;
    }
    return applyLinePointValues(values, spec);
  };
  const formatLinePoints = points => points.map(pt => formatPointInputValue(pt)).filter(Boolean).join('; ');
  const getLinePointsFromInputs = needed => {
    if (!Array.isArray(linePointInputs) || linePointInputs.length === 0 || needed <= 0) return [];
    const limit = Math.min(needed, linePointInputs.length);
    const pts = [];
    for (let i = 0; i < limit; i++) {
      const input = linePointInputs[i];
      if (!input) return [];
      const parsed = parseLinePointInput(input.value);
      if (!parsed) return [];
      pts.push(parsed);
    }
    return pts;
  };
  const gatherLinePointsForExport = needed => {
    if (needed <= 0) return [];
    const direct = getLinePointsFromInputs(needed);
    if (direct.length === needed) {
      return direct;
    }
    if (Array.isArray(appState.simple.parsed.linePoints) && appState.simple.parsed.linePoints.length >= needed) {
      const fallback = [];
      for (let i = 0; i < needed; i++) {
        const src = appState.simple.parsed.linePoints[i];
        if (!isValidPointArray(src)) return [];
        fallback.push([src[0], src[1]]);
      }
      return fallback;
    }
    return [];
  };
  const getLineTemplateSpec = () => interpretLineTemplateFromExpression(getFirstFunctionValue());
  const getLinePointCount = spec => spec && spec.kind ? spec.kind === 'two' ? 2 : 1 : 0;
  const getGliderCount = () => {
    if (!gliderCountInput) return 0;
    const n = Number.parseInt(gliderCountInput.value, 10);
    if (!Number.isFinite(n)) return 0;
    const clamped = Math.max(0, Math.min(2, n));
    return clamped > 0 ? clamped : 0;
  };
  const shouldEnableGliders = () => {
    const value = getFirstFunctionValue();
    if (!value) return false;
    if (isCoords(value)) return false;
    if (isExplicitFun(value)) return true;
    const forced = determineForcedGliderCount(value);
    return forced != null && forced > 0;
  };
  const shouldShowStartInput = () => {
    if (!gliderStartInput) return false;
    if (!shouldEnableGliders()) return false;
    const spec = getLineTemplateSpec();
    if (getLinePointCount(spec) !== 0) {
      return false;
    }
    return getGliderCount() > 0;
  };
  const hasConfiguredPoints = () => {
    const parsedMode = appState.simple.parsed ? decideMode(appState.simple.parsed) : 'functions';
    if (parsedMode === 'points') {
      return true;
    }
    const firstValue = getFirstFunctionValue();
    if (firstValue && isCoords(firstValue)) {
      return true;
    }
    if (shouldEnableGliders() && getGliderCount() > 0) {
      return true;
    }
    if (firstValue && !isCoords(firstValue) && !isExplicitFun(firstValue)) {
      return true;
    }
    const parsedCount = appState.simple.parsed && Number.isFinite(appState.simple.parsed.pointsCount) ? appState.simple.parsed.pointsCount : 0;
    if (parsedCount > 0) {
      return true;
    }
    const parsedExtraPoints = appState.simple.parsed && Array.isArray(appState.simple.parsed.extraPoints)
      ? appState.simple.parsed.extraPoints.length
      : 0;
    if (parsedExtraPoints > 0) {
      return true;
    }
    return false;
  };
  const updateSnapAvailability = () => {
    const hasPoints = hasConfiguredPoints();
    const updateCheckbox = input => {
      if (!input) return;
      input.disabled = !hasPoints;
      if (!hasPoints) {
        input.title = 'Aktiveres når punkter er lagt til.';
      } else {
        input.removeAttribute('title');
      }
    };
    updateCheckbox(snapCheckbox);
    updateCheckbox(showPointArrowsInput);
    updateCheckbox(showPointCoordsInput);
  };
  const updateExtraAnswerControl = control => {
    if (!control || !control.label || !control.funInput) return;
    const value = getFunctionInputValue(control.funInput);
    const allow = !!value && isCoords(value) && !getPointLockValueForRow(control.row);
    if (control.currentAllowed === allow) return;
    control.currentAllowed = allow;
    const { label, input } = control;
    if (!allow) {
      if (input) {
        input.disabled = true;
      }
      label.style.display = 'none';
      return;
    }
    if (input) {
      input.disabled = false;
    }
    label.style.display = '';
  };
  const updateAllExtraAnswerControls = () => {
    extraAnswerControls.forEach(updateExtraAnswerControl);
  };
  const registerExtraAnswerControl = (row, index, funInput, answerInput) => {
    if (!row || !answerInput || !funInput || index === 1) return null;
    const label = answerInput.closest('label.func-answer');
    if (!label) return null;
    const control = {
      row,
      index,
      label,
      funInput,
      input: answerInput,
      currentAllowed: null
    };
    extraAnswerControls.push(control);
    updateExtraAnswerControl(control);
    return control;
  };
  function placeAnswerField(position) {
    if (!answerControl || !answerControl.label) return;
    if (answerControl.currentPlacement === position) return;
    const { label } = answerControl;
    const group = label.closest('.func-group');
    let { secondaryRow, mainRow } = answerControl;
    if (!secondaryRow || !secondaryRow.isConnected) {
      secondaryRow = group ? group.querySelector('.func-row--secondary') : null;
      answerControl.secondaryRow = secondaryRow;
    }
    if (!mainRow || !mainRow.isConnected) {
      mainRow = group ? group.querySelector('.func-row--main') : null;
      answerControl.mainRow = mainRow;
    }
    let domainLabel = answerControl.domainLabel;
    if (!domainLabel || !domainLabel.parentElement) {
      domainLabel = group ? group.querySelector('label.domain') : null;
      answerControl.domainLabel = domainLabel;
    }
    let gliderRow = answerControl.gliderRow;
    if (!gliderRow || !gliderRow.parentElement) {
      gliderRow = group ? group.querySelector('.glider-row') : null;
      answerControl.gliderRow = gliderRow;
    }
    const answerInput = label.querySelector('input[data-answer]');
    if (position === 'hidden') {
      if (answerInput) {
        answerInput.disabled = true;
      }
      label.classList.remove('func-answer--inline', 'func-answer--glider');
      label.style.display = 'none';
      if (secondaryRow) {
        secondaryRow.style.display = 'none';
        secondaryRow.appendChild(label);
      } else if (mainRow) {
        mainRow.appendChild(label);
      }
      answerControl.currentPlacement = position;
      return;
    }
    if (answerInput) {
      answerInput.disabled = false;
    }
    label.style.display = '';
    const startLabel = gliderStartLabel && gliderStartLabel.isConnected ? gliderStartLabel : null;
    if (secondaryRow) {
      const shouldShowSecondary = position === 'secondary' || (startLabel && startLabel.style.display !== 'none');
      secondaryRow.style.display = shouldShowSecondary ? '' : 'none';
    }
    if (position === 'inline') {
      label.classList.add('func-answer--inline');
      label.classList.remove('func-answer--glider');
      if (domainLabel) {
        domainLabel.after(label);
      } else if (mainRow) {
        mainRow.appendChild(label);
      }
    } else if (position === 'glider') {
      label.classList.add('func-answer--glider');
      label.classList.remove('func-answer--inline');
      if (gliderRow) {
        const colorLabel = gliderRow.querySelector('.func-color');
        if (colorLabel) {
          colorLabel.before(label);
        } else {
          gliderRow.appendChild(label);
        }
      }
    } else {
      label.classList.remove('func-answer--inline', 'func-answer--glider');
      if (secondaryRow) {
        secondaryRow.appendChild(label);
      }
    }
    answerControl.currentPlacement = position;
  }
  function updateAnswerPlacement() {
    if (!answerControl || !answerControl.label) return;
    const firstValue = getFirstFunctionValue();
    const firstRow = funcRows ? funcRows.querySelector('.func-group[data-index="1"]') : null;
    if (firstValue && isCoords(firstValue) && getPointLockValueForRow(firstRow)) {
      placeAnswerField('hidden');
      return;
    }
    const gliderSectionVisible = gliderSection && gliderSection.style.display !== 'none';
    if (gliderSectionVisible && getGliderCount() <= 0) {
      placeAnswerField('hidden');
      return;
    }
    const forced = determineForcedGliderCount(firstValue);
    if (forced != null && forced > 0) {
      placeAnswerField('inline');
      return;
    }
    const glidersActive = shouldEnableGliders() && gliderSectionVisible;
    if (glidersActive) {
      placeAnswerField('glider');
    } else {
      placeAnswerField('secondary');
    }
  }
  const updateLinePointControls = (options = {}) => {
    const { silent = false } = options;
    if (!linePointSection) {
      if (!silent) updateSnapAvailability();
      return;
    }
    const spec = getLineTemplateSpec();
    const count = getLinePointCount(spec);
    const changed = count !== linePointVisibleCount;
    linePointVisibleCount = count;
    linePointSection.style.display = count > 0 ? '' : 'none';
    linePointLabels.forEach((label, idx) => {
      if (!label) return;
      label.style.display = idx < count ? '' : 'none';
    });
    linePointInputs.forEach((input, idx) => {
      if (!input) return;
      input.disabled = idx >= count;
    });
    if (count === 0 && !silent) {
      linePointsEdited = false;
    }
    if (changed && !silent) {
      syncSimpleFromForm();
      scheduleSimpleRebuild();
    }
    updateSnapAvailability();
  };
  if (snapCheckbox) {
    snapCheckbox.checked = ADV.points.snap.enabled;
  }
  const updateStartInputState = () => {
    if (!gliderStartInput) return;
    const showInput = shouldShowStartInput();
    gliderStartInput.disabled = !showInput;
    if (gliderStartLabel) {
      gliderStartLabel.style.display = showInput ? '' : 'none';
    }
    updateSnapAvailability();
  };
  const applyForcedGliderCount = show => {
    if (!gliderCountInput) {
      forcedGliderCount = null;
      return false;
    }
    const prevForced = forcedGliderCount;
    const prevValue = gliderCountInput.value;
    const value = show ? getFirstFunctionValue() : '';
    const forced = show ? determineForcedGliderCount(value) : null;
    forcedGliderCount = forced;
    if (forced != null) {
      if (gliderCountInput.value !== String(forced)) {
        gliderCountInput.value = String(forced);
      }
      gliderCountInput.disabled = true;
    } else {
      gliderCountInput.disabled = !show;
    }
    return forced !== prevForced || gliderCountInput.value !== prevValue;
  };
  const updateGliderVisibility = () => {
    if (!gliderSection) {
      updateSnapAvailability();
      return;
    }
    if (answerControl) {
      answerControl.gliderRow = gliderSection;
    }
    const show = shouldEnableGliders();
    const visibilityChanged = show !== glidersVisible;
    glidersVisible = show;
    gliderSection.style.display = show ? '' : 'none';
    const domainRow = gliderSection.closest('.func-row--domain');
    if (domainRow) {
      const domainLabel = domainRow.querySelector('label.domain');
      const domainVisible = domainLabel && domainLabel.style.display !== 'none';
      domainRow.style.display = show || domainVisible ? '' : 'none';
    }
    const forcedChanged = applyForcedGliderCount(show);
    updateStartInputState();
    if (visibilityChanged || forcedChanged) {
      syncSimpleFromForm();
      scheduleSimpleRebuild();
    }
    updateAnswerPlacement();
  };
  const buildSimpleFromForm = () => {
    var _rows$;
    const rows = funcRows ? Array.from(funcRows.querySelectorAll('.func-group')) : [];
    const firstInput = (_rows$ = rows[0]) === null || _rows$ === void 0 ? void 0 : _rows$.querySelector('[data-fun]');
    const firstVal = firstInput ? getFunctionInputValue(firstInput) : '';
    const lineSpec = interpretLineTemplateFromExpression(firstVal);
    const neededLinePoints = getLinePointCount(lineSpec);
    const lines = [];
    const answerLines = [];
    const markerExports = [];
    const lockExports = [];
    let hasPolylineCoords = false;
    let hasExplicitEmptyPolylineMarkers = false;
    rows.forEach((row, idx) => {
      const funInput = row.querySelector('[data-fun]');
      const domInput = row.querySelector('input[data-dom]');
      const answerInput = row.querySelector('input[data-answer]');
      if (!funInput) return;
      const fun = getFunctionInputValue(funInput);
      if (!fun) return;
      const isCoordsRow = isCoords(fun);
      const rowLocked = isCoordsRow ? getPointLockValueForRow(row) : false;
      const allowAnswer = isCoordsRow ? !rowLocked : true;
      const rawAnswer = allowAnswer && answerInput && !answerInput.disabled && typeof answerInput.value === 'string'
        ? answerInput.value.trim()
        : '';
      if (rawAnswer) {
        const key = idx === 0 ? 'riktig' : `riktig${idx + 1}`;
        answerLines.push(`${key}: ${rawAnswer}`);
      }
      if (isCoordsRow) {
        const parsedPoints = parsePointListString(fun)
          .filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite));
        if (parsedPoints.length) {
          if (parsedPoints.length >= 2) {
            hasPolylineCoords = true;
          }
          const coords = parsedPoints
            .map(pt => `(${formatNumber(pt[0], stepX())}, ${formatNumber(pt[1], stepY())})`)
            .filter(Boolean);
          if (coords.length) {
            const colorInfo = getFunctionColorInfoForRow(row);
            const manualColor = colorInfo.manual && colorInfo.value ? normalizeColorValue(colorInfo.value) : '';
            const coordsLine = manualColor
              ? `coords=${coords.join('; ')}, color=${manualColor}`
              : `coords=${coords.join('; ')}`;
            lines.push(coordsLine);
          }
          const storedMarkerValue = getPointMarkerValueForRow(row);
          const markerInputEmpty = storedMarkerValue === '';
          const markerValueForRow = markerInputEmpty ? '' : (getPointMarkerInputValue(row) || DEFAULT_POINT_MARKER);
          const markersForRow = resolvePointMarkersForCount(markerValueForRow, parsedPoints.length, {
            allowEmpty: markerInputEmpty
          });
          markersForRow.forEach(marker => {
            const sanitized = sanitizePointMarkerValue(marker);
            markerExports.push(markerInputEmpty ? sanitized : (sanitized || DEFAULT_POINT_MARKER));
          });
          if (markerInputEmpty && parsedPoints.length >= 2) {
            hasExplicitEmptyPolylineMarkers = true;
          }
          const lockForRow = getPointLockValueForRow(row);
          parsedPoints.forEach(() => lockExports.push(lockForRow));
        }
        return;
      }
      const domRaw = domInput ? domInput.value.trim() : '';
      const normalizedDom = domRaw ? normalizeDomainInputValue(domRaw) : null;
      const dom = normalizedDom ? normalizedDom.formatted : domRaw;
      const colorInfo = getFunctionColorInfoForRow(row);
      const manualColor = colorInfo.manual && colorInfo.value ? normalizeColorValue(colorInfo.value) : '';
      const baseLine = dom ? `${fun}, x in ${dom}` : fun;
      const withColor = manualColor ? `${baseLine}, color=${manualColor}` : baseLine;
      lines.push(withColor);
    });
    let hasCoordsLine = lines.some(L => /^\s*coords\s*=/i.test(L));
    let hasMarkerLine = lines.some(L => /^\s*marker\s*=/i.test(L));
    const hasPointsLine = lines.some(L => /^\s*points\s*=/i.test(L));
    const hasStartXLine = lines.some(L => /^\s*startx\s*=/i.test(L));
    const hasLinePtsLine = lines.some(L => /^\s*linepts\s*=/i.test(L));
    const glidersActive = shouldEnableGliders();
    const gliderCount = glidersActive ? getGliderCount() : 0;
    if (glidersActive && !hasPointsLine && gliderCount > 0) {
      lines.push(`points=${gliderCount}`);
    }
    if (glidersActive && shouldShowStartInput() && !hasStartXLine && gliderCount > 0) {
      const startValues = parseStartXValues((gliderStartInput === null || gliderStartInput === void 0 ? void 0 : gliderStartInput.value) || '');
      if (startValues.length) {
        lines.push(`startx=${startValues.map(val => formatNumber(val, stepX())).join(', ')}`);
      }
    }
    if (!hasCoordsLine && Array.isArray(appState.simple.parsed.extraPoints)) {
      const coords = appState.simple.parsed.extraPoints
        .filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite))
        .map(pt => `(${formatNumber(pt[0], stepX())}, ${formatNumber(pt[1], stepY())})`);
      if (coords.length) {
        lines.push(`coords=${coords.join('; ')}`);
        hasCoordsLine = true;
        if (Array.isArray(appState.simple.parsed.pointMarkers) && appState.simple.parsed.pointMarkers.length) {
          markerExports.push(...appState.simple.parsed.pointMarkers.map(marker => sanitizePointMarkerValue(marker) || DEFAULT_POINT_MARKER));
        }
        if (Array.isArray(appState.simple.parsed.pointLocks) && appState.simple.parsed.pointLocks.length) {
          lockExports.push(...appState.simple.parsed.pointLocks.map(val => !!val));
        }
      }
    }
    if (!hasMarkerLine && hasCoordsLine) {
      const hasCustomMarkers = markerExports.some(marker => !isDefaultPointMarker(marker));
      if (hasCustomMarkers) {
        const markerLineValue = formatPointMarkerList(markerExports.map(marker => marker || DEFAULT_POINT_MARKER));
        if (markerLineValue) {
          lines.push(`marker=${markerLineValue}`);
          hasMarkerLine = true;
        }
      } else if (hasExplicitEmptyPolylineMarkers && hasPolylineCoords) {
        lines.push('marker=');
        hasMarkerLine = true;
      }
    }
    if (!hasLinePtsLine && neededLinePoints > 0 && (linePointsEdited || Array.isArray(appState.simple.parsed.linePoints) && appState.simple.parsed.linePoints.length > 0)) {
      const exportPoints = gatherLinePointsForExport(neededLinePoints);
      if (exportPoints.length === neededLinePoints) {
        lines.push(`linepts=${formatLinePoints(exportPoints)}`);
      }
    }
    const hasLockLine = lines.some(L => /^\s*lockpoint\s*=/i.test(L));
    if (hasCoordsLine) {
      const anyUnlocked = lockExports.some(val => val === false);
      if (!hasLockLine && anyUnlocked) {
        const lockLineValue = formatPointLockList(lockExports.length ? lockExports : [false]);
        if (lockLineValue) {
          lines.push(`lockpoint=${lockLineValue}`);
        }
      } else if (!pointLockEnabled && !hasLockLine) {
        lines.push('lockpoint=false');
      }
    }
    answerLines.forEach(line => {
      if (line) {
        lines.push(line);
      }
    });
    return lines.join('\n');
  };
  const syncSimpleFromForm = () => {
    const simple = buildSimpleFromForm();
    if (simple !== appState.simple.value) {
      appState.simple.value = simple;
      if (typeof window !== 'undefined') {
        window.SIMPLE = appState.simple.value;
      }
      refreshAltText('form-change');
    }
    return simple;
  };
  queueSimpleFormUpdate = createSimpleFormChangeQueue(() => {
    syncSimpleFromForm();
    scheduleSimpleRebuild();
  }, 360);
  scheduleSimpleFormChange = () => {
    if (queueSimpleFormUpdate) {
      queueSimpleFormUpdate();
      return;
    }
    syncSimpleFromForm();
    scheduleSimpleRebuild();
  };
  flushSimpleFormChange = () => {
    if (queueSimpleFormUpdate && typeof queueSimpleFormUpdate.flush === 'function') {
      queueSimpleFormUpdate.flush();
      return;
    }
    if (queueSimpleFormUpdate) {
      queueSimpleFormUpdate();
      return;
    }
    syncSimpleFromForm();
    scheduleSimpleRebuild();
  };
  const handleExternalLinePointUpdate = event => {
    if (!linePointSection || !Array.isArray(linePointInputs) || linePointInputs.length === 0) {
      return;
    }
    if (!event || !event.detail || !Array.isArray(event.detail.points)) {
      return;
    }
    const spec = getLineTemplateSpec();
    const needed = getLinePointCount(spec);
    if (needed <= 0) {
      return;
    }
    if (event.detail.points.length < needed) {
      return;
    }
    const values = [];
    for (let i = 0; i < needed; i++) {
      const src = event.detail.points[i];
      if (!Array.isArray(src) || src.length < 2) {
        return;
      }
      const x = typeof src[0] === 'number' ? src[0] : Number.parseFloat(String(src[0]));
      const y = typeof src[1] === 'number' ? src[1] : Number.parseFloat(String(src[1]));
      if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return;
      }
      values.push([x, y]);
    }
    if (!values.length) {
      return;
    }
    setLinePointInputValues(values);
    if (!event.detail || event.detail.markEdited !== false) {
      linePointsEdited = true;
    }
    if (!event.detail || event.detail.sync !== false) {
      syncSimpleFromForm();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('graf:linepoints-changed', handleExternalLinePointUpdate);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('examples:collect', event => {
      try {
        syncSimpleFromForm();
      } catch (_) {}
      if (typeof window !== 'undefined') {
        const cleanState = createCleanSaveState(event && event.detail && event.detail.meta);
        window.STATE_V2 = cleanState;
        window.STATE = cleanState;
      }
      if (!event || !event.detail) return;
      if (event.detail.svgOverride) return;
      const clone = cloneBoardSvgRoot();
      if (clone && clone.node) {
        event.detail.svgOverride = clone.node;
      } else {
        const svgExport = buildBoardSvgExport();
        if (svgExport && svgExport.markup) {
          event.detail.svgOverride = svgExport.markup;
        }
      }
    });
  }
  const handleGliderCountInput = () => {
    updateStartInputState();
    updateAnswerPlacement();
    scheduleSimpleFormChange();
  };
  const handleGliderCountCommit = () => {
    updateStartInputState();
    updateAnswerPlacement();
    flushSimpleFormChange();
  };
  if (gliderCountInput) {
    gliderCountInput.addEventListener('input', handleGliderCountInput);
    gliderCountInput.addEventListener('change', handleGliderCountCommit);
    gliderCountInput.addEventListener('blur', handleGliderCountCommit);
  }
  if (gliderStartInput) {
    attachGliderStartInputListeners();
  }
  const toggleDomain = input => {
    const row = input.closest('.func-group');
    if (!row) return;
    const domLabel = row.querySelector('label.domain');
    const domInput = domLabel ? domLabel.querySelector('input[data-dom]') : null;
    const value = getFunctionInputValue(input);
    const showDomain = isExplicitFun(value);
    if (showDomain) {
      if (domLabel) {
        domLabel.style.display = '';
        if (domInput && !domInput.value.trim()) {
          domInput.value = DEFAULT_DOMAIN_VALUE;
        }
      }
    } else if (domLabel) {
      domLabel.style.display = 'none';
      if (domInput) domInput.value = '';
    }
    const domainRow = domLabel ? domLabel.closest('.func-row--domain') : null;
    if (domainRow && !domainRow.querySelector('.glider-row')) {
      domainRow.style.display = showDomain ? '' : 'none';
    }
    updateGliderVisibility();
    updateLinePointControls({ silent: true });
    updateAnswerPlacement();
  };
  const createRow = (index, funVal = '', domVal = '', colorVal = '', colorManual = false, answerVal = '', options = {}) => {
    const row = document.createElement('div');
    row.className = 'func-group';
    row.dataset.index = String(index);
    const titleLabel = 'Funksjon eller punkter';
    const placeholderAttr = index === 1 ? ` placeholder="${DEFAULT_FUNCTION_EXPRESSION}"` : '';
    const defaultColor = computeDefaultColorForIndex(index);
    const manualColor = normalizeFunctionColorChoice(colorVal);
    const isManualColor = !!colorManual && !!manualColor;
    const palette = getFunctionColorOptions();
    const activeColor = normalizeColorValue(colorVal)
      || normalizeColorValue(palette[(index - 1) % palette.length])
      || DEFAULT_COLOR_FALLBACK;
    let colorControlMarkup = `
    <div class="func-color-compact" data-color-picker>
      <button type="button"
              class="color-swatch color-swatch--active color-swatch--pair"
              style="--swatch-fill: ${activeColor}; --swatch-line: ${activeColor};"
              aria-label="Endre farge"
              aria-haspopup="true"
              aria-expanded="false"></button>
      <div class="color-options" hidden></div>
      <input type="hidden" data-color value="${activeColor}">
    </div>
  `;
    const gliderMarkup = index === 1 ? `
            <div class="func-row func-row--domain">
              <label class="domain">
                <span>Avgrensning</span>
                <input type="text" data-dom placeholder="[start, stopp]">
              </label>
              <div class="func-row--gliders glider-row">
                <label class="points">
                  <span>Punkter</span>
                  <select data-points>
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </label>
                <div class="linepoints-row">
                  <label class="linepoint" data-linepoint-label="0">
                    <span>Punkt 1</span>
                    <input type="text" data-linepoint="0" placeholder="(0, 0)">
                  </label>
                  <label class="linepoint" data-linepoint-label="1">
                    <span>Punkt 2</span>
                    <input type="text" data-linepoint="1" placeholder="(1, 1)">
                  </label>
                </div>
              </div>
            </div>
    ` : `
            <div class="func-row func-row--domain">
              <label class="domain">
                <span>Avgrensning</span>
                <input type="text" data-dom placeholder="[start, stopp]">
              </label>
            </div>
    `;
    const startMarkup = index === 1 ? `
            <label class="startx-label">
              <span>Start</span>
              <input type="text" data-startx value="x=1" placeholder="x=1">
            </label>
    ` : '';
    const fieldsClass = index === 1 ? 'func-fields func-fields--first' : 'func-fields';
    row.innerHTML = `
      <fieldset>
        <legend>Funksjon ${index}</legend>
        <div class="${fieldsClass}">
          <div class="func-row func-row--main">
            <div class="func-main">
              <label class="func-input">
                <span>${titleLabel}</span>
                <div class="func-editor">
                  <math-field data-fun class="func-math-field" ${mathFieldKeyboardAttr} smart-mode="false" aria-label="${titleLabel}"${placeholderAttr}></math-field>
                  <div class="func-preview" data-fun-preview aria-hidden="true"></div>
                </div>
              </label>
            </div>
            ${colorControlMarkup}
          </div>
          <div class="func-row func-row--markers point-marker-row">
            <label class="point-marker" data-point-marker-container>
              <span>Punktmarkør</span>
              <input type="text" data-point-marker placeholder="${DEFAULT_POINT_MARKER}" value="${DEFAULT_POINT_MARKER}" autocomplete="off" spellcheck="false">
            </label>
            <label class="checkbox-inline point-lock" data-point-lock-container>
              <input type="checkbox" data-point-lock checked>
              <span>Lås punkt</span>
            </label>
          </div>
          ${gliderMarkup}
          <div class="func-row func-row--secondary">
            ${startMarkup}
            <label class="func-answer">
              <span>Fasit</span>
              <input type="text" data-answer placeholder="Skriv fasit (valgfritt)" autocomplete="off" spellcheck="false">
            </label>
          </div>
        </div>
      </fieldset>
    `;
    if (funcRows) {
      funcRows.appendChild(row);
    }
    const editor = row.querySelector('.func-editor');
    const preview = editor ? editor.querySelector('[data-fun-preview]') : null;
    if (index === 1) {
      const labelSpan = row.querySelector('.func-input > span');
      if (labelSpan) {
        labelSpan.textContent = titleLabel;
      }
      if (preview) {
        preview.removeAttribute('data-preview-no-latex');
      }
    }
    const colorInputs = Array.from(row.querySelectorAll('input[data-color]'));
    if (colorInputs.length) {
      registerFunctionColorControl(row, colorInputs, {
        defaultColor,
        manualColor,
        manual: isManualColor
      });
    }
    const initialMarkerValue = normalizePointMarkerValue(options.pointMarkerValue) || pointMarkerValue || DEFAULT_POINT_MARKER;
    const initialLockValue = options.pointLockValue != null ? !!options.pointLockValue : pointLockEnabled;
    const markerLabel = row.querySelector('[data-point-marker-container]');
    const markerContainer = markerLabel ? markerLabel.closest('.point-marker-row') || markerLabel : null;
    if (markerContainer) {
      markerContainer.style.display = 'none';
    }
    const markerInput = row.querySelector('input[data-point-marker]');
    const markerControl = { row, input: markerInput, container: markerContainer, lock: null };
    if (markerInput) {
      markerInput.dataset.defaultValue = DEFAULT_POINT_MARKER;
      markerInput.value = initialMarkerValue;
      setPointMarkerValueForRow(row, initialMarkerValue);
      const handleMarkerInput = event => {
        const commit = !!(event && event.type === 'change');
        syncPointMarkerValueFromInput(markerInput, row, { commit });
        if (commit) {
          flushSimpleFormChange();
        } else {
          scheduleSimpleFormChange();
        }
      };
      markerInput.addEventListener('input', handleMarkerInput);
      markerInput.addEventListener('change', handleMarkerInput);
    }
    const lockLabel = row.querySelector('[data-point-lock-container]');
    const lockCheckbox = lockLabel ? lockLabel.querySelector('input[data-point-lock]') : null;
    if (lockLabel && lockCheckbox) {
      lockCheckbox.checked = !!initialLockValue;
      lockCheckbox.disabled = true;
      setPointLockValueForRow(row, initialLockValue);
      markerControl.lock = { container: lockLabel, checkbox: lockCheckbox };
      const handlePointLockChange = () => {
        const locked = !!lockCheckbox.checked;
        setPointLockValueForRow(row, locked);
        ADV.points.lockExtraPoints = locked;
        updateAnswerPlacement();
        updateAllExtraAnswerControls();
        syncSimpleFromForm();
        scheduleSimpleRebuild();
      };
      lockCheckbox.addEventListener('change', handlePointLockChange);
      lockCheckbox.addEventListener('input', handlePointLockChange);
    }
    if ((markerInput || lockCheckbox || markerContainer) && !pointMarkerControls.includes(markerControl)) {
      pointMarkerControls.push(markerControl);
    }
    let funInput = row.querySelector('[data-fun]');
    const answerInput = row.querySelector('input[data-answer]');
    if (answerInput) {
      answerInput.value = answerVal || '';
      const handleAnswerInput = () => {
        scheduleSimpleFormChange();
      };
      const handleAnswerBlur = () => {
        if (answerInput.value != null) {
          const trimmed = answerInput.value.trim();
          if (answerInput.value !== trimmed) {
            answerInput.value = trimmed;
          }
        }
        flushSimpleFormChange();
      };
      answerInput.addEventListener('input', handleAnswerInput);
      answerInput.addEventListener('change', handleAnswerBlur);
      answerInput.addEventListener('blur', handleAnswerBlur);
    }
    funInput = ensureFunctionInputElement(funInput);
    const domInput = row.querySelector('input[data-dom]');
    if (funInput) {
      setFunctionInputValue(funInput, funVal || '');
      const extraAnswerControl = registerExtraAnswerControl(row, index, funInput, answerInput);
      const beginEditing = () => {
        setFunctionEditorMode(funInput, 'edit');
        const focusInput = () => {
          if (typeof funInput.focus === 'function') {
            try {
              funInput.focus({ preventScroll: true });
            } catch (_) {
              funInput.focus();
            }
          }
          if (typeof funInput.setSelectionRange === 'function') {
            const value = funInput.value != null ? String(funInput.value) : '';
            try {
              funInput.setSelectionRange(value.length, value.length);
            } catch (_) {}
          }
        };
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(focusInput);
        } else if (typeof setTimeout === 'function') {
          setTimeout(focusInput, 0);
        } else {
          focusInput();
        }
      };
      if (preview) {
        preview.setAttribute('role', 'button');
        if (!preview.getAttribute('aria-label')) {
          preview.setAttribute('aria-label', `Klikk for å redigere ${titleLabel}`);
        }
        preview.addEventListener('click', event => {
          event.preventDefault();
          beginEditing();
        });
        preview.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            beginEditing();
          }
        });
      }
      const rememberCommittedValue = () => {
        funInput.dataset.lastCommittedValue = getFunctionInputValue(funInput);
      };
      const runInputSideEffects = () => {
        updateFunctionPreview(funInput);
        toggleDomain(funInput);
        updateLinePointControls();
        updatePointMarkerVisibility();
        updateFunctionLegend(row);
        if (extraAnswerControl) {
          updateExtraAnswerControl(extraAnswerControl);
        }
      };
      const commitIfChanged = () => {
        runInputSideEffects();
        const currentValue = getFunctionInputValue(funInput);
        if (currentValue) {
          setFunctionEditorMode(funInput, 'preview');
        } else {
          setFunctionEditorMode(funInput, 'edit');
        }
        if (funInput.dataset.lastCommittedValue === currentValue) {
          return;
        }
        funInput.dataset.lastCommittedValue = currentValue;
        refreshGliderStartInputDisplay();
        flushSimpleFormChange();
      };
      const scheduleRemember = typeof queueMicrotask === 'function'
        ? queueMicrotask
        : callback => setTimeout(callback, 0);
      scheduleRemember(rememberCommittedValue);
      funInput.addEventListener('input', runInputSideEffects);
      funInput.addEventListener('change', commitIfChanged);
      funInput.addEventListener('blur', commitIfChanged);
      funInput.addEventListener('focus', () => {
        setFunctionEditorMode(funInput, 'edit');
      });
      funInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitIfChanged();
          if (typeof funInput.blur === 'function') {
            funInput.blur();
          }
        }
      });
      updateFunctionLegend(row);
    }
    if (domInput) {
      domInput.value = domVal || '';
      if (domInput.value) {
        const normalized = normalizeDomainInputValue(domInput.value);
        if (normalized && normalized.formatted !== domInput.value) {
          domInput.value = normalized.formatted;
        }
      }
      const handleDomChange = event => {
        if (event && event.type !== 'input') {
          const normalized = normalizeDomainInputValue(domInput.value);
          if (normalized && normalized.formatted !== domInput.value) {
            domInput.value = normalized.formatted;
          }
        }
        if (event && (event.type === 'change' || event.type === 'blur')) {
          flushSimpleFormChange();
        } else {
          scheduleSimpleFormChange();
        }
      };
      domInput.addEventListener('input', handleDomChange);
      domInput.addEventListener('change', handleDomChange);
      domInput.addEventListener('blur', handleDomChange);
    }
    if (index === 1) {
      gliderSection = row.querySelector('.glider-row');
      if (gliderSection) {
        gliderSection.style.display = 'none';
      }
      gliderCountInput = row.querySelector('[data-points]');
      gliderStartInput = row.querySelector('input[data-startx]');
      gliderStartLabel = gliderStartInput ? gliderStartInput.closest('label') : null;
      const secondaryRow = row.querySelector('.func-row--secondary');
      const mainRow = row.querySelector('.func-row--main');
      const domainLabel = row.querySelector('.func-row--domain label.domain');
      const answerLabel = secondaryRow ? secondaryRow.querySelector('label.func-answer') : null;
      if (answerLabel) {
        answerControl = {
          label: answerLabel,
          secondaryRow,
          mainRow,
          domainLabel,
          gliderRow: gliderSection,
          currentPlacement: null
        };
      }
      if (gliderCountInput) {
        gliderCountInput.addEventListener('input', handleGliderCountInput);
        gliderCountInput.addEventListener('change', handleGliderCountCommit);
        gliderCountInput.addEventListener('blur', handleGliderCountCommit);
      }
      if (gliderStartInput) {
        attachGliderStartInputListeners();
      }
      linePointSection = row.querySelector('.linepoints-row');
      linePointInputs = linePointSection ? Array.from(linePointSection.querySelectorAll('input[data-linepoint]')) : [];
      linePointLabels = linePointSection ? Array.from(linePointSection.querySelectorAll('[data-linepoint-label]')) : [];
      linePointVisibleCount = 0;
      if (linePointSection) {
        linePointSection.style.display = 'none';
      }
      linePointInputs.forEach(input => {
        if (!input) return;
        const handleLinePointInputChange = event => {
          const parsed = parseLinePointInput(input.value);
          if (parsed) {
            input.value = formatPointInputValue(parsed);
          }
          linePointsEdited = true;
          syncLinePointsToBoardFromInputs();
          if (event && event.type === 'change') {
            flushSimpleFormChange();
          } else {
            scheduleSimpleFormChange();
          }
        };
        input.addEventListener('input', handleLinePointInputChange);
        input.addEventListener('change', handleLinePointInputChange);
      });
    }
    if (funInput) {
      toggleDomain(funInput);
      updatePointMarkerVisibility();
    }
    const picker = row.querySelector('[data-color-picker]');
    if (picker) {
      const hiddenInput = picker.querySelector('input[data-color]');
      if (hiddenInput) {
        updateFunctionColorPicker(picker, hiddenInput, hiddenInput.value, getFunctionColorOptions());
      }
    }
    if (index === 1) {
      updateAnswerPlacement();
    }
    updateFunctionActionButtons();
    return row;
  };
  const resetScreenStateForExample = () => {
    if (EXAMPLE_STATE && typeof EXAMPLE_STATE === 'object') {
      EXAMPLE_STATE.screen = DEFAULT_SCREEN.slice(0, 4);
      EXAMPLE_STATE.screenSource = 'default';
    }
    ADV.screen = DEFAULT_SCREEN.slice(0, 4);
    LAST_COMPUTED_SCREEN = DEFAULT_SCREEN.slice(0, 4);
    LAST_SCREEN_SOURCE = 'default';
    if (appState.board && typeof appState.board.setBoundingBox === 'function') {
      try {
        appState.board.setBoundingBox(toBB(DEFAULT_SCREEN), false);
        if (typeof appState.board.update === 'function') {
          appState.board.update();
        }
      } catch (_) {}
    }
    if (screenInput) {
      screenInput.value = formatScreenForInput(DEFAULT_SCREEN);
      screenInput.defaultValue = formatScreenForInput(DEFAULT_SCREEN);
      if (screenInput.dataset) delete screenInput.dataset.autoscreen;
      screenInput.classList.remove('is-auto');
    }
    const lockInput = g('cfgLock');
    if (lockInput) lockInput.checked = INITIAL_LOCK_ASPECT;
    ADV.lockAspect = INITIAL_LOCK_ASPECT;
    const q1Checkbox = g('cfgQ1');
    if (q1Checkbox) q1Checkbox.checked = INITIAL_FIRST_QUADRANT;
    ADV.firstQuadrant = INITIAL_FIRST_QUADRANT;
    if (showAxisNumbersInput) showAxisNumbersInput.checked = INITIAL_SHOW_AXIS_NUMBERS;
    ADV.axis.ticks.showNumbers = INITIAL_SHOW_AXIS_NUMBERS;
    if (showGridInput) showGridInput.checked = INITIAL_SHOW_GRID;
    ADV.axis.grid.show = INITIAL_SHOW_GRID;
    if (forceTicksInput && !forceTicksInput.disabled) forceTicksInput.checked = INITIAL_FORCE_TICKS;
    FORCE_TICKS_REQUESTED = INITIAL_FORCE_TICKS;
    const snapDefault = INITIAL_SNAP_ENABLED && !(snapCheckbox && snapCheckbox.disabled);
    if (snapCheckbox && !snapCheckbox.disabled) {
      snapCheckbox.checked = INITIAL_SNAP_ENABLED;
    }
    ADV.points.snap.enabled = snapDefault;
    if (showPointArrowsInput) {
      showPointArrowsInput.checked = INITIAL_SHOW_POINT_ARROWS;
    }
    if (showPointCoordsInput) {
      showPointCoordsInput.checked = INITIAL_SHOW_POINT_COORDS;
    }
    ADV.points.guideArrows = INITIAL_SHOW_POINT_ARROWS;
    ADV.points.showCoordsOnHover = INITIAL_SHOW_POINT_COORDS;
  };
  const applyCleanOptions = (cleanOptions, exampleState) => {
    if (!cleanOptions || typeof cleanOptions !== 'object') return;

    if (Object.prototype.hasOwnProperty.call(cleanOptions, 'grid')) {
      const showGrid = !!cleanOptions.grid;
      if (showGridInput) {
        showGridInput.checked = showGrid;
      }
      ADV.axis.grid.show = showGrid;
      if (exampleState && typeof exampleState === 'object') {
        exampleState.showGrid = showGrid;
      }
    }

    if (Object.prototype.hasOwnProperty.call(cleanOptions, 'axisNumbers')) {
      const axisNumbers = !!cleanOptions.axisNumbers;
      if (showAxisNumbersInput) {
        showAxisNumbersInput.checked = axisNumbers;
      }
      if (ADV.axis && ADV.axis.ticks) {
        ADV.axis.ticks.showNumbers = axisNumbers;
      }
      if (exampleState && typeof exampleState === 'object') {
        exampleState.showAxisNumbers = axisNumbers;
      }
    }

    if (Object.prototype.hasOwnProperty.call(cleanOptions, 'lockAspect')) {
      const lockAspect = !!cleanOptions.lockAspect;
      if (lockInput) {
        lockInput.checked = lockAspect;
      }
      ADV.lockAspect = lockAspect;
      if (exampleState && typeof exampleState === 'object') {
        exampleState.lockAspect = lockAspect;
      }
    }

    if (Object.prototype.hasOwnProperty.call(cleanOptions, 'firstQuadrant')) {
      const firstQuadrant = !!cleanOptions.firstQuadrant;
      if (q1Input) {
        q1Input.checked = firstQuadrant;
      }
      ADV.firstQuadrant = firstQuadrant;
      if (exampleState && typeof exampleState === 'object') {
        exampleState.firstQuadrant = firstQuadrant;
      }
    }

    if (cleanOptions.axisLabels && typeof cleanOptions.axisLabels === 'object') {
      const currentLabels = exampleState && exampleState.axisLabels && typeof exampleState.axisLabels === 'object'
        ? exampleState.axisLabels
        : { x: ADV.axis.labels.x, y: ADV.axis.labels.y, fontSize: ADV.axis.labels.fontSize };
      const nextLabels = {
        x: typeof cleanOptions.axisLabels.x === 'string' && cleanOptions.axisLabels.x.trim()
          ? cleanOptions.axisLabels.x
          : currentLabels.x,
        y: typeof cleanOptions.axisLabels.y === 'string' && cleanOptions.axisLabels.y.trim()
          ? cleanOptions.axisLabels.y
          : currentLabels.y,
        fontSize: currentLabels.fontSize
      };

      if (axisXInputElement) axisXInputElement.value = nextLabels.x;
      if (axisYInputElement) axisYInputElement.value = nextLabels.y;
      ADV.axis.labels.x = nextLabels.x;
      ADV.axis.labels.y = nextLabels.y;

      if (exampleState && typeof exampleState === 'object') {
        exampleState.axisLabels = {
          x: nextLabels.x,
          y: nextLabels.y,
          fontSize: ADV.axis.labels.fontSize
        };
      }
    }
  };
  const fillFormFromSimple = simple => {
    const source = typeof simple === 'string' ? simple : typeof window !== 'undefined' ? window.SIMPLE : appState.simple.value;
    const text = typeof source === 'string' ? source : '';
    if (typeof source === 'string') {
      appState.simple.value = source;
      appState.simple.parsed = parseSimple(appState.simple.value);
      applyLinePointStart(appState.simple.parsed);
      applyGraftegnerDefaultsFromTheme({ count: computePaletteRequestCount() });
    }
    linePointsEdited = Array.isArray(appState.simple.parsed.linePoints) && appState.simple.parsed.linePoints.length > 0;
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    const filteredLines = lines.filter(line => {
      if (/^\s*points\s*=/i.test(line)) return false;
      if (/^\s*startx\s*=/i.test(line)) return false;
      if (/^\s*linepts\s*=/i.test(line)) return false;
      if (/^\s*marker\s*=/i.test(line)) return false;
      if (/^\s*lockpoint\s*=/i.test(line)) return false;
      if (/^\s*(?:riktig|fasit)\d*\s*:/i.test(line)) return false;
      return true;
    });
    if (filteredLines.length === 0) {
      filteredLines.push('');
    }
    if (funcRows) {
      gliderSection = null;
      gliderCountInput = null;
      gliderStartInput = null;
      gliderStartLabel = null;
      linePointSection = null;
      linePointInputs = [];
      linePointLabels = [];
      linePointVisibleCount = 0;
      pointMarkerControls.length = 0;
      pointMarkerValues.clear();
      pointLockStates.clear();
      clearFunctionColorControls();
      pointMarkerValue = DEFAULT_POINT_MARKER;
      answerControl = null;
      extraAnswerControls.length = 0;
      funcRows.innerHTML = '';
    }
    const parsedRows = Array.isArray(appState.simple.parsed.rows) ? appState.simple.parsed.rows : [];
    const parsedMarkers = Array.isArray(appState.simple.parsed.pointMarkers) ? appState.simple.parsed.pointMarkers : [];
    const parsedLocks = Array.isArray(appState.simple.parsed.pointLocks) ? appState.simple.parsed.pointLocks : [];
    pointLockEnabled = parsedLocks.length
      ? !parsedLocks.some(val => val === false)
      : !(appState.simple.parsed && appState.simple.parsed.lockExtraPoints === false);
    ADV.points.lockExtraPoints = pointLockEnabled;
    glidersVisible = false;
    forcedGliderCount = null;
    let funcIndex = 0;
    filteredLines.forEach((line, idx) => {
      let funVal = line;
      let domVal = '';
      const coordsMatch = line.match(/^coords\s*=\s*(.+)$/i);
      if (coordsMatch) {
        funVal = coordsMatch[1].trim();
      } else {
        const domMatch = line.match(/,\s*x\s*(?:in|∈)\s*(.+)$/i);
        if (domMatch) {
          funVal = line.slice(0, domMatch.index).trim();
          domVal = domMatch[1].trim();
          if (domVal) {
            domVal = domVal.replace(/,\s*color\s*=\s*[^,]+$/i, '').trim();
          }
        }
      }
      if (typeof funVal === 'string') {
        const colorSuffix = /,\s*color\s*=\s*[^,]+$/i.exec(funVal);
        if (colorSuffix) {
          funVal = funVal.slice(0, colorSuffix.index).trim();
        }
      }
      let colorVal = '';
      let colorManualFlag = false;
      const rowSpec = parsedRows[idx] || null;
      const isFunctionLine = !coordsMatch && /=/.test(line);
      if (isFunctionLine && Array.isArray(appState.simple.parsed.funcs)) {
        const parsedFunc = appState.simple.parsed.funcs[funcIndex] || null;
        if (parsedFunc) {
          colorVal = typeof parsedFunc.color === 'string' ? parsedFunc.color : '';
          colorManualFlag = parsedFunc.colorSource === 'manual' && !!colorVal;
          if (colorVal) {
            const normalizedManual = normalizeColorValue(colorVal);
            const defaultColorForRow = normalizeColorValue(computeDefaultColorForIndex(idx + 1));
            if (normalizedManual && defaultColorForRow && normalizedManual === defaultColorForRow) {
              colorManualFlag = false;
              colorVal = '';
              parsedFunc.colorSource = 'auto';
              parsedFunc.color = '';
              const existingGraph = Array.isArray(appState.graphs) ? appState.graphs[funcIndex] || null : null;
              if (existingGraph) {
                existingGraph.manualColor = false;
              }
            }
          }
        }
        funcIndex++;
      } else if (rowSpec && rowSpec.type === 'coords') {
        colorVal = typeof rowSpec.color === 'string' ? rowSpec.color : '';
        colorManualFlag = rowSpec.colorSource === 'manual' && !!colorVal;
        if (colorVal) {
          const normalizedManual = normalizeColorValue(colorVal);
          const defaultColorForRow = normalizeColorValue(computeDefaultColorForIndex(idx + 1));
          if (normalizedManual && defaultColorForRow && normalizedManual === defaultColorForRow) {
            colorManualFlag = false;
            colorVal = '';
            rowSpec.colorSource = 'auto';
            rowSpec.color = '';
          }
        }
      }
      const answerVal = Array.isArray(appState.simple.parsed.answers) ? appState.simple.parsed.answers[idx] || '' : '';
      const pointStart = rowSpec && Number.isFinite(rowSpec.pointStart) ? rowSpec.pointStart : 0;
      const inferredCount = parsePointListString(funVal)
        .filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite)).length;
      const pointCount = rowSpec && Number.isFinite(rowSpec.pointCount) && rowSpec.pointCount > 0
        ? rowSpec.pointCount
        : inferredCount;
      const markersSlice = parsedMarkers.slice(pointStart, pointCount > 0 ? pointStart + pointCount : undefined);
      const markerValForRow = markersSlice.length
        ? formatPointMarkerList(markersSlice)
        : appState.simple.parsed.pointMarker;
      const lockValForRow = rowSpec && rowSpec.type === 'coords'
        ? (parsedLocks.length ? parsedLocks[Math.min(pointStart, Math.max(0, parsedLocks.length - 1))] : pointLockEnabled)
        : pointLockEnabled;
      createRow(idx + 1, funVal, domVal, colorVal, colorManualFlag, answerVal, {
        pointMarkerValue: markerValForRow,
        pointLockValue: lockValForRow
      });
    });
    refreshFunctionColorDefaultsLocal();
    if (gliderCountInput) {
      var _SIMPLE_PARSED;
      const count = Number.isFinite((_SIMPLE_PARSED = appState.simple.parsed) === null || _SIMPLE_PARSED === void 0 ? void 0 : _SIMPLE_PARSED.pointsCount) ? appState.simple.parsed.pointsCount : 0;
      const clamped = Math.max(0, Math.min(2, count));
      gliderCountInput.value = String(clamped);
    }
    if (gliderStartInput) {
      var _SIMPLE_PARSED2;
      const startVals = Array.isArray((_SIMPLE_PARSED2 = appState.simple.parsed) === null || _SIMPLE_PARSED2 === void 0 ? void 0 : _SIMPLE_PARSED2.startX)
        ? appState.simple.parsed.startX.filter(Number.isFinite)
        : [];
      setGliderStartInputValues(startVals);
      refreshGliderStartInputDisplay();
    }
    if (linePointInputs.length && appState.simple.parsed) {
      const resolvedPoints = resolveLineStartPoints(appState.simple.parsed);
      setLinePointInputValues(resolvedPoints);
    }
    updateGliderVisibility();
    updateLinePointControls({ silent: true });
    const parsedMarkerValueForInput = Array.isArray(appState.simple.parsed.pointMarkers) && appState.simple.parsed.pointMarkers.length
      ? formatPointMarkerList(appState.simple.parsed.pointMarkers)
      : appState.simple.parsed.pointMarker;
    const parsedMarker = normalizePointMarkerValue(parsedMarkerValueForInput);
    pointMarkerValue = parsedMarker || DEFAULT_POINT_MARKER;
    updatePointMarkerVisibility();
    updateAllExtraAnswerControls();
    applyExampleStateToControls();
    syncExampleStateFromControls();
    syncSimpleFromForm();
    updateSnapAvailability();
    updateFunctionActionButtons();
    refreshAltText('form-fill');
  };
  fillFormFromSimple(appState.simple.value);
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const index = (funcRows ? funcRows.querySelectorAll('.func-group').length : 0) + 1;
      createRow(index, '', '', '', false, '');
      syncSimpleFromForm();
      scheduleSimpleRebuild();
      updateFunctionActionButtons();
      updateSnapAvailability();
    });
  }
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      const rows = funcRows ? Array.from(funcRows.querySelectorAll('.func-group')) : [];
      if (rows.length <= 1) return;
      const lastRow = rows[rows.length - 1];
      lastRow.remove();
      pruneControlsForExistingRows();
      refreshFunctionColorDefaultsLocal();
      updateAllExtraAnswerControls();
      updateFunctionActionButtons();
      const currentSimple = syncSimpleFromForm();
      if (typeof window !== 'undefined') {
        window.SIMPLE = currentSimple;
      }
      scheduleSimpleRebuild();
      updateSnapAvailability();
    });
  }
  let scheduleExampleHydration = null;
  if (typeof window !== 'undefined') {
    const runExampleHydration = () => {
      // 1. Ta backup av utsnitt som ble lastet inn fra eksempelet
      const loadedScreen = (EXAMPLE_STATE && Array.isArray(EXAMPLE_STATE.screen)) ? EXAMPLE_STATE.screen.slice() : null;
      const loadedLock = (EXAMPLE_STATE && typeof EXAMPLE_STATE.lockAspect === 'boolean') ? EXAMPLE_STATE.lockAspect : null;
      const loadedQ1 = (EXAMPLE_STATE && typeof EXAMPLE_STATE.firstQuadrant === 'boolean') ? EXAMPLE_STATE.firstQuadrant : null;

      hydrateCurveLabelStateFromExample();
      
      // 2. Kjør reset (som nullstiller UI og globale variabler)
      resetScreenStateForExample();

      // 3. Gjenopprett utsnittet hvis det fantes i eksempelet
      if (loadedScreen) {
        if (EXAMPLE_STATE) {
          EXAMPLE_STATE.screen = loadedScreen;
          if (loadedLock !== null) EXAMPLE_STATE.lockAspect = loadedLock;
          if (loadedQ1 !== null) EXAMPLE_STATE.firstQuadrant = loadedQ1;
        }
        // Oppdater ADV (motoren) direkte også, så apply() plukker det opp
        ADV.screen = loadedScreen;
        LAST_COMPUTED_SCREEN = loadedScreen; // Hindre at den tror det er endret
        
        if (loadedLock !== null) ADV.lockAspect = loadedLock;
        if (loadedQ1 !== null) ADV.firstQuadrant = loadedQ1;

        // Oppdater UIet umiddelbart for å matche dataene
        const screenInput = document.getElementById('cfgScreen');
        if (screenInput) {
          screenInput.value = formatScreenForInput(loadedScreen);
          screenInput.classList.remove('is-auto');
          if (screenInput.dataset) delete screenInput.dataset.autoscreen;
        }
        const lockInput = document.getElementById('cfgLock');
        if (lockInput && loadedLock !== null) lockInput.checked = loadedLock;
        
        const q1Input = document.getElementById('cfgQ1');
        if (q1Input && loadedQ1 !== null) q1Input.checked = loadedQ1;
      }

      fillFormFromSimple(window.SIMPLE);
      if (screenInput && (!EXAMPLE_STATE || !Array.isArray(EXAMPLE_STATE.screen) || EXAMPLE_STATE.screen.length !== 4)) {
        const formattedDefault = formatScreenForInput(DEFAULT_SCREEN);
        if (screenInput.value !== formattedDefault) {
          screenInput.value = formattedDefault;
        }
        if (screenInput.defaultValue !== formattedDefault) {
          screenInput.defaultValue = formattedDefault;
        }
      }
      apply();
    };
    scheduleExampleHydration = event => {
      const incomingIndex = event && event.detail && Number.isInteger(event.detail.index)
        ? event.detail.index
        : null;
      registerExampleChange(incomingIndex);
      const scheduler = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : fn => setTimeout(fn, 0);
      scheduler(runExampleHydration);
    };
  }
  if (screenInput) {
    screenInput.addEventListener('input', () => {
      SCREEN_INPUT_IS_EDITING = true;
      if (screenInput.dataset) delete screenInput.dataset.autoscreen;
      screenInput.classList.remove('is-auto');
      const lockInput = g('cfgLock');
      const hasManualValue = !!(screenInput.value && screenInput.value.trim());
      if (lockInput && lockInput.checked && hasManualValue) {
        lockInput.checked = false;
        if (ADV.lockAspect !== false) {
          ADV.lockAspect = false;
        }
      }
    });
    screenInput.addEventListener('focus', () => {
      SCREEN_INPUT_IS_EDITING = true;
      if (Array.isArray(LAST_COMPUTED_SCREEN) && LAST_COMPUTED_SCREEN.length === 4) {
        screenInput.value = formatScreenForInput(LAST_COMPUTED_SCREEN);
      }
      screenInput.classList.remove('is-auto');
    });
    screenInput.addEventListener('blur', () => {
      SCREEN_INPUT_IS_EDITING = false;
      if (screenInput.dataset && screenInput.dataset.autoscreen === '1') {
        screenInput.classList.add('is-auto');
      }
    });
  }
  syncScreenInputFromState();
  g('cfgLock').checked = params.has('lock') ? paramBool('lock') : true;
  g('cfgAxisX').value = paramStr('xName', 'x');
  g('cfgAxisY').value = paramStr('yName', 'y');
  if (zoomInput) {
    zoomInput.checked = false;
    zoomInput.disabled = true;
  }
  if (panInput) {
    panInput.checked = ADV.interactions.pan.enabled;
  }
  g('cfgQ1').checked = paramBool('q1');
  if (showNamesInput) {
    showNamesInput.checked = !!ADV.curveName.showName;
  }
  if (showExprInput) {
    showExprInput.checked = !!ADV.curveName.showExpression;
  }
  if (showAxisNumbersInput) {
    showAxisNumbersInput.checked = !!(ADV.axis && ADV.axis.ticks && ADV.axis.ticks.showNumbers);
  }
  if (showGridInput) {
    showGridInput.checked = !!(ADV.axis && ADV.axis.grid && ADV.axis.grid.show);
  }
  if (showPointArrowsInput) {
    showPointArrowsInput.checked = !!(ADV.points && ADV.points.guideArrows);
  }
  if (showPointCoordsInput) {
    showPointCoordsInput.checked = !!(ADV.points && ADV.points.showCoordsOnHover);
  }
  if (forceTicksInput) {
    forceTicksInput.checked = !!ADV.axis.forceIntegers;
    forceTicksInput.disabled = FORCE_TICKS_LOCKED_FALSE;
    if (FORCE_TICKS_LOCKED_FALSE) {
      forceTicksInput.checked = false;
      forceTicksInput.title = 'Deaktivert fordi utsnittet gir for mange tall på aksene.';
    } else {
      forceTicksInput.removeAttribute('title');
    }
  }
  const fontSizeInput = g('cfgFontSize');
  if (fontSizeInput) {
    syncFontSizeSelect(fontSizeInput, sanitizeFontSize(ADV.axis.grid.fontSize, FONT_DEFAULT));
  }
  const apply = () => {
    const prevSimple = appState.simple.lastRendered;
    const currentSimple = syncSimpleFromForm();
    const simpleChanged = currentSimple !== prevSimple;
    let needsRebuild = simpleChanged;
    const lockInput = g('cfgLock');
    const q1Input = g('cfgQ1');
    const prevLock = ADV.lockAspect;
    const prevFirstQuadrant = ADV.firstQuadrant;

    // Les råverdi fra feltet før vi rører checkboxene
    const screenTrimmed = screenInput ? screenInput.value.trim() : '';
    let nextScreen = null;
    let forceRebuild = false;

    // REGEL A: Hvis forfatter sletter innholdet -> Reset til Default + Lås 1:1
    if (!screenTrimmed) {
      nextScreen = DEFAULT_SCREEN.slice(); // [-5, 5, -5, 5]

      // Oppdater UI-elementene
      ADV.lockAspect = true;
      if (lockInput) lockInput.checked = true;

      if (screenInput) {
        screenInput.classList.add('is-auto'); // Visuelt hint om at dette er default
      }
    }
    // REGEL B: Hvis forfatter skriver inn tall
    else {
      const parsed = parseScreen(screenTrimmed);
      if (parsed) {
        nextScreen = parsed;

        if (screenInput) {
          screenInput.classList.remove('is-auto');
        }

        // Bruker har oppgitt eksakte tall -> lås av aspekt før vi regner på utsnittet
        if (ADV.lockAspect) {
          ADV.lockAspect = false;
          if (lockInput) lockInput.checked = false;
        }
      }
    }

    // Oppdater interne variabler basert på checkboxer (i tilfelle bruker klikket på dem)
    const lockChecked = lockInput ? !!lockInput.checked : ADV.lockAspect;
    const q1Checked = q1Input ? !!q1Input.checked : ADV.firstQuadrant;
    const q1Changed = q1Checked !== prevFirstQuadrant;
    const lockChanged = lockChecked !== prevLock;
    ADV.lockAspect = lockChecked;
    ADV.firstQuadrant = q1Checked;

    // Hvis vi endrer «Lås aksene 1:1», sørg for at vi rekalkulerer utsnittet
    // basert på dagens skjerm før vi bygger på nytt.
    if (!nextScreen && lockChanged) {
      const currentScreen = Array.isArray(ADV.screen) && ADV.screen.length === 4
        ? ADV.screen.slice(0, 4)
        : appState.board && typeof appState.board.getBoundingBox === 'function'
          ? fromBoundingBox(appState.board.getBoundingBox())
          : null;
      if (currentScreen) {
        nextScreen = currentScreen.slice(0, 4);
      }
    }

    // --- KJØR MATTE-MOTOREN ---
    // Nå bruker vi calculateCorrectedScreen til å fikse 1:1 og 1.kvadrant
    // basert på det brukeren ba om (nextScreen) og innstillingene (ADV).
    if (nextScreen) {
       const corrected = calculateCorrectedScreen(nextScreen);
       
       // Sett den nye skjermen
       ADV.screen = corrected;
       
       // Oppdater input-feltet slik at det "ALLTID stemmer med det faktiske utsnittet"
       if (screenInput) {
         screenInput.value = formatScreenForInput(corrected);
       }

       // Oppdater boardet
       if (appState.board) {
          const current = typeof appState.board.getBoundingBox === 'function'
            ? fromBoundingBox(appState.board.getBoundingBox())
            : null;
          if (!screensEqual(current, corrected)) {
            appState.board.setBoundingBox(toBB(corrected), false); // false = ikke tving aspect i JXG, vi har allerede regnet det ut
          }
       }
       
       if (EXAMPLE_STATE && typeof EXAMPLE_STATE === 'object') {
         EXAMPLE_STATE.screen = corrected ? corrected.slice(0, 4) : null;
         EXAMPLE_STATE.screenSource = 'manual';
       }
       rememberScreenState(corrected, 'manual');
       
       forceRebuild = true;
    }

    if (forceRebuild) {
      needsRebuild = true;
    }

    if (lockChanged) {
      if (EXAMPLE_STATE && typeof EXAMPLE_STATE === 'object') {
        EXAMPLE_STATE.lockAspect = lockChecked;
      }
      needsRebuild = true;
    }
    const axisXInput = axisXInputElement || g('cfgAxisX');
    const axisYInput = axisYInputElement || g('cfgAxisY');
    const axisXValue = axisXInput ? axisXInput.value.trim() : '';
    const axisYValue = axisYInput ? axisYInput.value.trim() : '';
    if ((ADV.axis.labels.x || '') !== axisXValue) {
      ADV.axis.labels.x = axisXValue;
      needsRebuild = true;
    }
    if ((ADV.axis.labels.y || '') !== axisYValue) {
      ADV.axis.labels.y = axisYValue;
      needsRebuild = true;
    }
    const zoomChecked = false; // Alltid avslått
    if (ADV.interactions.zoom.enabled !== zoomChecked) {
      ADV.interactions.zoom.enabled = zoomChecked;
      needsRebuild = true;
    }
    const panChecked = false; // Alltid avslått
    if (ADV.interactions.pan.enabled !== panChecked) {
      ADV.interactions.pan.enabled = panChecked;
      needsRebuild = true;
    }
    if (q1Changed) {
      needsRebuild = true;
    }
    const showNamesChecked = showNamesInput ? !!showNamesInput.checked : !!(ADV.curveName && ADV.curveName.showName);
    const showExprChecked = showExprInput ? !!showExprInput.checked : !!(ADV.curveName && ADV.curveName.showExpression);
    const showBracketsChecked = !!(ADV.domainMarkers && ADV.domainMarkers.show);
    const showAxisNumbersChecked = showAxisNumbersInput ? !!showAxisNumbersInput.checked : !!(ADV.axis && ADV.axis.ticks && ADV.axis.ticks.showNumbers);
    const showGridChecked = showGridInput ? !!showGridInput.checked : !!(ADV.axis && ADV.axis.grid && ADV.axis.grid.show);
    const showPointArrowsChecked = showPointArrowsInput ? !!showPointArrowsInput.checked : !!(ADV.points && ADV.points.guideArrows);
    const showPointCoordsChecked = showPointCoordsInput ? !!showPointCoordsInput.checked : !!(ADV.points && ADV.points.showCoordsOnHover);
    if (showNamesInput && ADV.curveName.showName !== showNamesChecked) {
      ADV.curveName.showName = showNamesChecked;
      needsRebuild = true;
    }
    if (showExprInput && ADV.curveName.showExpression !== showExprChecked) {
      ADV.curveName.showExpression = showExprChecked;
      needsRebuild = true;
    }
    const showAny = showNamesChecked || showExprChecked;
    if (ADV.curveName.show !== showAny) {
      ADV.curveName.show = showAny;
      needsRebuild = true;
    }
    if (showAxisNumbersInput && ADV.axis.ticks.showNumbers !== showAxisNumbersChecked) {
      ADV.axis.ticks.showNumbers = showAxisNumbersChecked;
      needsRebuild = true;
    }
    if (showGridInput && ADV.axis.grid.show !== showGridChecked) {
      ADV.axis.grid.show = showGridChecked;
      needsRebuild = true;
    }
    if (showPointArrowsInput && ADV.points.guideArrows !== showPointArrowsChecked) {
      ADV.points.guideArrows = showPointArrowsChecked;
      needsRebuild = true;
    }
    if (showPointCoordsInput && ADV.points.showCoordsOnHover !== showPointCoordsChecked) {
      ADV.points.showCoordsOnHover = showPointCoordsChecked;
      needsRebuild = true;
    }
    syncExampleStateFromControls();
    if (forceTicksInput) {
      const requested = !!forceTicksInput.checked;
      if (!(forceTicksInput.disabled && FORCE_TICKS_LOCKED_FALSE) && FORCE_TICKS_REQUESTED !== requested) {
        FORCE_TICKS_REQUESTED = requested;
        needsRebuild = true;
      }
    }
    const snapInput = g('cfgSnap');
    const snapEnabled = !!(snapInput && snapInput.checked && !snapInput.disabled);
    if (ADV.points.snap.enabled !== snapEnabled) {
      ADV.points.snap.enabled = snapEnabled;
      needsRebuild = true;
    }
    const screenValueForParams = screenInput ? screenInput.value.trim() : '';
    const currentFontSize = sanitizeFontSize(ADV.axis.grid.fontSize, FONT_DEFAULT);
    const p = new URLSearchParams();
    const parsedMarkerListForExport = Array.isArray(appState.simple.parsed.pointMarkers) && appState.simple.parsed.pointMarkers.length
      ? formatPointMarkerList(appState.simple.parsed.pointMarkers)
      : '';
    const parsedMarkerNormalized = normalizePointMarkerValue(parsedMarkerListForExport || appState.simple.parsed.pointMarker);
    let idx = 1;
    (funcRows ? funcRows.querySelectorAll('.func-group') : []).forEach((row, rowIdx) => {
      const funInput = row.querySelector('[data-fun]');
      const fun = funInput ? getFunctionInputValue(funInput) : '';
      const dom = row.querySelector('input[data-dom]').value.trim();
      if (!fun) return;
      const colorInfo = getFunctionColorInfoForRow(row);
      const manualColor = colorInfo.manual && colorInfo.value ? normalizeColorValue(colorInfo.value) : '';
      if (rowIdx === 0 && isCoords(fun)) {
        const coordsValue = manualColor ? `${fun}, color=${manualColor}` : fun;
        p.set('coords', coordsValue);
        const markerForParams = pointMarkerControls.length
          ? getPointMarkerValueForExport(row)
          : (parsedMarkerNormalized && !isDefaultPointMarker(parsedMarkerNormalized) ? parsedMarkerNormalized : '');
        if (markerForParams) {
          p.set('marker', markerForParams);
        }
      } else {
        p.set(`fun${idx}`, fun);
        if (dom) p.set(`dom${idx}`, dom);
        if (manualColor) {
          p.set(`color${idx}`, manualColor);
        }
        idx++;
      }
    });
    if (shouldEnableGliders()) {
      const count = getGliderCount();
      if (count > 0) {
        p.set('points', String(count));
        if (shouldShowStartInput()) {
          const startVals = parseStartXValues((gliderStartInput === null || gliderStartInput === void 0 ? void 0 : gliderStartInput.value) || '');
          if (startVals.length) {
            p.set('startx', startVals.map(val => formatNumber(val, stepX())).join(', '));
          }
        }
      }
    }
    if (!p.has('coords') && Array.isArray(appState.simple.parsed.extraPoints)) {
      const exportCoords = appState.simple.parsed.extraPoints
        .filter(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite))
        .map(pt => `(${formatNumber(pt[0], stepX())}, ${formatNumber(pt[1], stepY())})`);
      if (exportCoords.length) {
        p.set('coords', exportCoords.join('; '));
        const markerFromParsed = parsedMarkerNormalized && !isDefaultPointMarker(parsedMarkerNormalized)
          ? parsedMarkerNormalized
          : '';
        if (markerFromParsed) {
          p.set('marker', markerFromParsed);
        }
      }
    }
    const applyLineSpec = interpretLineTemplateFromExpression(getFirstFunctionValue());
    const applyNeededLinePoints = getLinePointCount(applyLineSpec);
    if (applyNeededLinePoints > 0 && (linePointsEdited || Array.isArray(appState.simple.parsed.linePoints) && appState.simple.parsed.linePoints.length > 0)) {
      const exportPoints = gatherLinePointsForExport(applyNeededLinePoints);
      if (exportPoints.length === applyNeededLinePoints) {
        p.set('linepts', formatLinePoints(exportPoints));
      }
    }
    if (screenValueForParams) p.set('screen', screenValueForParams);
    if (lockChecked) p.set('lock', '1');else p.set('lock', '0');
    if (axisXValue && axisXValue !== 'x') p.set('xName', axisXValue);
    if (axisYValue && axisYValue !== 'y') p.set('yName', axisYValue);
    if (zoomInput) {
      p.set('zoom', zoomChecked ? '1' : '0');
    }
    if (panChecked) p.set('pan', '1');
    if (showNamesInput) {
      p.set('showNames', showNamesChecked ? '1' : '0');
    }
    if (showExprInput) {
      p.set('showExpr', showExprChecked ? '1' : '0');
    }
    p.set('brackets', showBracketsChecked ? '1' : '0');
    if (showAxisNumbersInput) {
      p.set('axisNumbers', showAxisNumbersChecked ? '1' : '0');
    }
    if (showGridInput) {
      p.set('grid', showGridChecked ? '1' : '0');
    }
    if (forceTicksInput) {
      if (forceTicksInput.disabled && FORCE_TICKS_LOCKED_FALSE) {
        p.set('forceTicks', FORCE_TICKS_REQUESTED ? '1' : '0');
      } else {
        p.set('forceTicks', forceTicksInput.checked ? '1' : '0');
      }
    }
    if (snapInput) {
      if (snapInput.checked) p.set('snap', '1');else p.set('snap', '0');
    }
    if (q1Checked) p.set('q1', '1');
    const keepFontParam = FONT_PARAM_KEYS.some(key => params.has(key)) || Math.abs(currentFontSize - FONT_DEFAULT) > 1e-9;
    const fontSizeInput = g('cfgFontSize');
    const nextFontSize = readFontSizeFromSelect(fontSizeInput, currentFontSize);
    if (fontSizeInput) {
      syncFontSizeSelect(fontSizeInput, nextFontSize);
    }
    if (Math.abs(nextFontSize - currentFontSize) > 1e-9 || (keepFontParam && Math.abs(nextFontSize - FONT_DEFAULT) > 1e-9)) {
      p.set('fontSize', String(nextFontSize));
    }
    if (Math.abs(nextFontSize - ADV.axis.grid.fontSize) > 1e-9 || Math.abs(nextFontSize - ADV.axis.labels.fontSize) > 1e-9 || Math.abs(nextFontSize - ADV.curveName.fontSize) > 1e-9) {
      ADV.axis.grid.fontSize = nextFontSize;
      ADV.axis.labels.fontSize = nextFontSize;
      ADV.curveName.fontSize = nextFontSize;
      needsRebuild = true;
    }
    const newSearch = p.toString();
    const currentSearch = typeof window !== 'undefined' && window.location ? window.location.search : '';
    const normalizedCurrentSearch = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch;
    if (newSearch !== normalizedCurrentSearch) {
      const hash = typeof window !== 'undefined' && window.location ? window.location.hash || '' : '';
      const basePath = typeof window !== 'undefined' && window.location ? window.location.pathname || '' : '';
      const nextSearch = newSearch ? `?${newSearch}` : '';
      const nextUrl = `${basePath}${nextSearch}${hash}`;
      if (typeof window !== 'undefined' && window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', nextUrl);
      } else if (typeof window !== 'undefined' && window.location) {
        window.location.search = newSearch;
      }
    }
    if (needsRebuild) {
      requestRebuild();
    }
  };
  const resetToDefaults = cleanState => {
    resetScreenStateForExample();
    const exampleState = getExampleState();
    const clean = cleanState && typeof cleanState === 'object'
      ? cleanState
      : typeof window !== 'undefined' && window.CLEAN && typeof window.CLEAN === 'object'
        ? window.CLEAN
        : null;

    const cleanView = clean ? normalizeStorageView(clean.view) : null;
    if (cleanView && cleanView.length === 4) {
      const normalized = calculateCorrectedScreen(cleanView) || cleanView.slice(0, 4);
      ADV.screen = normalized.slice(0, 4);
      LAST_COMPUTED_SCREEN = normalized.slice(0, 4);
      LAST_SCREEN_SOURCE = 'default';
      if (exampleState && typeof exampleState === 'object') {
        exampleState.screen = normalized.slice(0, 4);
        exampleState.screenSource = 'default';
      }
      syncScreenInputFromState();
      if (screenInput) {
        screenInput.value = formatScreenForInput(normalized);
        screenInput.classList.remove('is-auto');
        if (screenInput.dataset) delete screenInput.dataset.autoscreen;
      }
      if (appState.board && typeof appState.board.setBoundingBox === 'function') {
        try {
          appState.board.setBoundingBox(toBB(normalized), false);
          if (typeof appState.board.update === 'function') {
            appState.board.update();
          }
        } catch (_) {}
      }
    }

    applyCleanOptions(clean && clean.options, exampleState);
    const nextSimple = clean && typeof clean.code === 'string' ? clean.code : appState.simple.value;
    fillFormFromSimple(nextSimple);
    if (typeof window !== 'undefined') {
      window.SIMPLE = appState.simple.value;
    }

    const resolvedExample = getExampleState();
    if (resolvedExample && typeof resolvedExample === 'object') {
      resolvedExample.lockAspect = ADV.lockAspect !== false;
      resolvedExample.firstQuadrant = !!ADV.firstQuadrant;
      resolvedExample.showGrid = !!(ADV.axis && ADV.axis.grid && ADV.axis.grid.show);
      resolvedExample.axisLabels = {
        x: ADV.axis.labels.x,
        y: ADV.axis.labels.y,
        fontSize: ADV.axis.labels.fontSize
      };
      if (Array.isArray(ADV.screen) && ADV.screen.length === 4) {
        resolvedExample.screen = ADV.screen.slice(0, 4);
        resolvedExample.screenSource = LAST_SCREEN_SOURCE;
      }
    }

    apply();
  };
  if (typeof window !== 'undefined') {
    window.resetToDefaults = resetToDefaults;
  }
  const syncAxisLabelsFromInputs = () => {
    const axisXValue = axisXInputElement ? axisXInputElement.value.trim() : '';
    const axisYValue = axisYInputElement ? axisYInputElement.value.trim() : '';
    let changed = false;
    if ((ADV.axis.labels.x || '') !== axisXValue) {
      ADV.axis.labels.x = axisXValue;
      changed = true;
    }
    if ((ADV.axis.labels.y || '') !== axisYValue) {
      ADV.axis.labels.y = axisYValue;
      changed = true;
    }
    if (changed) {
      requestRebuild();
    }
  };
  const bindAxisInput = input => {
    if (!input) return;
    const handle = () => {
      syncAxisLabelsFromInputs();
      apply();
    };
    input.addEventListener('change', handle);
    input.addEventListener('blur', handle);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') handle();
    });
  };
  bindAxisInput(axisXInputElement);
  bindAxisInput(axisYInputElement);
  const handleCurveNameToggle = event => {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    apply();
  };
  if (showNamesInput) {
    showNamesInput.addEventListener('change', handleCurveNameToggle);
  }
  if (showExprInput) {
    showExprInput.addEventListener('change', handleCurveNameToggle);
  }
  if (screenInput) {
    screenInput.addEventListener('change', e => {
      SCREEN_INPUT_IS_EDITING = false;
      if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
      if (!screenInput.value || !screenInput.value.trim()) {
        if (screenInput.dataset) screenInput.dataset.autoscreen = '1';
        screenInput.classList.add('is-auto');
      }
      apply();
    });
    screenInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        SCREEN_INPUT_IS_EDITING = false;
        if (!screenInput.value || !screenInput.value.trim()) {
          if (screenInput.dataset) screenInput.dataset.autoscreen = '1';
          screenInput.classList.add('is-auto');
        }
        if (typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }
        apply();
      }
    });
  }
  const loadCleanSaveState = rawState => {
    const normalized = migrateStorageState(rawState)
      || migrateStorageState({ state: rawState, adv: ADV })
      || migrateStorageState({ adv: ADV });
    if (!normalized) return false;

    if (typeof window !== 'undefined') {
      window.STATE_V2 = normalized;
      window.STATE = normalized;
    }

    const nextCode = typeof normalized.code === 'string' ? normalized.code : '';
    fillFormFromSimple(nextCode);
    appState.simple.lastRendered = appState.simple.value;
    if (typeof window !== 'undefined') {
      window.SIMPLE = appState.simple.value;
    }

    const lockInput = g('cfgLock');
    const q1Input = g('cfgQ1');
    const axisXInput = axisXInputElement || g('cfgAxisX');
    const axisYInput = axisYInputElement || g('cfgAxisY');

    if (Array.isArray(normalized.view) && normalized.view.length === 4) {
      const copy = normalized.view.slice(0, 4);
      ADV.screen = copy;
      LAST_COMPUTED_SCREEN = copy.slice(0, 4);
      LAST_SCREEN_SOURCE = 'manual';
      if (screenInput) {
        screenInput.value = formatScreenForInput(copy);
        screenInput.classList.remove('is-auto');
        if (screenInput.dataset) delete screenInput.dataset.autoscreen;
      }
    }

    const opts = normalized.options || {};
    if (opts.lockAspect !== undefined) {
      ADV.lockAspect = !!opts.lockAspect;
      if (lockInput) lockInput.checked = !!opts.lockAspect;
    }
    if (opts.firstQuadrant !== undefined) {
      ADV.firstQuadrant = !!opts.firstQuadrant;
      if (q1Input) q1Input.checked = !!opts.firstQuadrant;
    }
    if (opts.grid !== undefined && ADV.axis && ADV.axis.grid) {
      ADV.axis.grid.show = !!opts.grid;
      if (showGridInput) showGridInput.checked = !!opts.grid;
    }
    if (opts.axisNumbers !== undefined && ADV.axis && ADV.axis.ticks) {
      ADV.axis.ticks.showNumbers = !!opts.axisNumbers;
      if (showAxisNumbersInput) showAxisNumbersInput.checked = !!opts.axisNumbers;
    }
    if (opts.axisLabels && ADV.axis && ADV.axis.labels) {
      if (typeof opts.axisLabels.x === 'string') {
        ADV.axis.labels.x = opts.axisLabels.x;
        if (axisXInput) axisXInput.value = opts.axisLabels.x;
      }
      if (typeof opts.axisLabels.y === 'string') {
        ADV.axis.labels.y = opts.axisLabels.y;
        if (axisYInput) axisYInput.value = opts.axisLabels.y;
      }
    }

    apply();
    return true;
  };
  if (typeof window !== 'undefined') {
    window.loadCleanSaveState = loadCleanSaveState;
    if (typeof window.createCleanState !== 'function') {
      window.createCleanState = createCleanSaveState;
    }
    if (typeof window.loadCleanState !== 'function') {
      window.loadCleanState = loadCleanSaveState;
    }
    const existingApi = window.graftegnerApi && typeof window.graftegnerApi === 'object'
      ? window.graftegnerApi
      : {};
    window.graftegnerApi = {
      ...existingApi,
      createCleanState: (...args) => createCleanSaveState(...args),
      loadCleanState: (...args) => loadCleanSaveState(...args),
      onExampleLoaded: scheduleExampleHydration
    };
    const mv = window.mathVisuals && typeof window.mathVisuals === 'object' ? window.mathVisuals : {};
    mv.activeTool = window.graftegnerApi;
    window.mathVisuals = mv;
  }
  refreshFunctionColorDefaults = refreshFunctionColorDefaultsLocal;
  root.addEventListener('change', apply);
  root.addEventListener('keydown', e => {
    if (e.key === 'Enter') apply();
  });
}
