function getPaletteResolver() {
  const scopes = [
    typeof globalThis !== 'undefined' ? globalThis : null,
    typeof window !== 'undefined' ? window : null,
    typeof global !== 'undefined' ? global : null
  ];
  for (const scope of scopes) {
    if (!scope || typeof scope !== 'object') continue;
    const resolver = scope.MathVisualsPaletteResolver;
    if (resolver && typeof resolver.resolveGroupPalette === 'function') {
      return resolver;
    }
  }
  if (typeof require === 'function') {
    try {
      const mod = require('./palette/palette-resolver.js');
      if (mod && typeof mod.resolveGroupPalette === 'function') {
        return mod;
      }
    } catch (_) {}
  }
  return null;
}

(function (_luminanceFromHex, _luminanceFromHex2) {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TEXT_MODES = ['fraction', 'percent', 'decimal'];
  const MODE_LABELS = {
    fraction: 'brøk',
    percent: 'prosent',
    decimal: 'desimaltall'
  };
  const DEFAULT_DENOMS = [1, 2, 3, 4, 5, 6, 8, 9, 10, 12];
  const LEGACY_COLOR_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D'];
  const SHARED_GROUP_ID = 'fellesfarger';

  function sanitizePaletteList(values) {
    if (!Array.isArray(values)) return [];
    const out = [];
    values.forEach(value => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (trimmed) out.push(trimmed);
    });
    return out;
  }

  function ensurePaletteCount(primary, fallback, count) {
    const base = sanitizePaletteList(primary);
    const backup = sanitizePaletteList(fallback);
    if (!Number.isFinite(count) || count <= 0) {
      if (base.length) return base.slice();
      if (backup.length) return backup.slice();
      return base.length ? base.slice() : backup.slice();
    }
    const size = Math.max(1, Math.trunc(count));
    if (base.length >= size) return base.slice(0, size);
    const result = base.slice();
    const fallbackSource = backup.length ? backup : base;
    while (result.length < size && fallbackSource.length) {
      const next = fallbackSource[result.length % fallbackSource.length];
      if (typeof next === 'string' && next) {
        result.push(next);
      } else {
        break;
      }
    }
    if (!result.length && backup.length) {
      return backup.slice(0, size);
    }
    return result;
  }

  function getThemeApi() {
    const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
    return theme && typeof theme === 'object' ? theme : null;
  }
  function getSettingsApi() {
    const settings = typeof window !== 'undefined' ? window.MathVisualsSettings : null;
    return settings && typeof settings === 'object' ? settings : null;
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
  function applyThemeToDocument() {
    const theme = getThemeApi();
    if (theme && typeof theme.applyToDocument === 'function') {
      theme.applyToDocument(document);
    }
  }
  applyThemeToDocument();
  function getPaletteFromTheme(count) {
    const theme = getThemeApi();
    const project = getActiveThemeProjectName(theme);
    const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
    const settings = getSettingsApi();
    const settingsSnapshot =
      settings && typeof settings.getSettings === 'function'
        ? settings.getSettings()
        : settings || undefined;
    const resolver = getPaletteResolver();
    const palette = resolver
      ? resolver.resolveGroupPalette({
        groupId: SHARED_GROUP_ID,
        count: targetCount,
        project: project || undefined,
        fallback: LEGACY_COLOR_PALETTE,
        settings: settingsSnapshot
      })
      : [];
    return ensurePaletteCount(palette, LEGACY_COLOR_PALETTE, targetCount);
  }
  function getRowPalette(length) {
    const target = Math.max(length, LEGACY_COLOR_PALETTE.length);
    return getPaletteFromTheme(target);
  }
  function getPaletteColor(palette, index) {
    const colors = sanitizePaletteList(palette);
    if (!colors.length) return LEGACY_COLOR_PALETTE[0];
    const safeIndex = Number.isFinite(index) ? index : 0;
    return colors[((safeIndex % colors.length) + colors.length) % colors.length] || colors[0];
  }
  const TEXT_COLOR_DARK = '#0f172a';
  const TEXT_COLOR_LIGHT = '#ffffff';
  const TILE_AREA_WIDTH = 800;
  const LABEL_WIDTH = 140;
  const ROW_HEIGHT = 72;
  const ROW_GAP = 16;
  const MARGIN_X = 32;
  const MARGIN_Y = 32;
  const TILE_RADIUS = 14;
  const MIN_SCALE = 0.35;
  const MAX_SCALE = 1.05;
  const DEFAULT_DECIMAL_DIGITS = 3;
  const DEFAULT_PERCENT_DIGITS = 1;
  const MAX_DECIMAL_DIGITS = 4;
  const MAX_PERCENT_DIGITS = 3;
  function parseHexColor(hex) {
    if (typeof hex !== 'string') return null;
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return null;
    const value = match[1];
    return {
      r: parseInt(value.slice(0, 2), 16),
      g: parseInt(value.slice(2, 4), 16),
      b: parseInt(value.slice(4, 6), 16)
    };
  }
  function srgbToLinear(value) {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  }
  function relativeLuminance(r, g, b) {
    const R = srgbToLinear(r);
    const G = srgbToLinear(g);
    const B = srgbToLinear(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  }
  function luminanceFromHex(hex) {
    const rgb = parseHexColor(hex);
    if (!rgb) return null;
    return relativeLuminance(rgb.r, rgb.g, rgb.b);
  }
  const DARK_TEXT_LUMINANCE = (_luminanceFromHex = luminanceFromHex(TEXT_COLOR_DARK)) !== null && _luminanceFromHex !== void 0 ? _luminanceFromHex : 0;
  const LIGHT_TEXT_LUMINANCE = (_luminanceFromHex2 = luminanceFromHex(TEXT_COLOR_LIGHT)) !== null && _luminanceFromHex2 !== void 0 ? _luminanceFromHex2 : 1;
  function contrastRatio(l1, l2) {
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  }
  function pickTileTextColor(backgroundHex) {
    const bgLuminance = luminanceFromHex(backgroundHex);
    if (bgLuminance == null) return TEXT_COLOR_DARK;
    const darkContrast = contrastRatio(bgLuminance, DARK_TEXT_LUMINANCE);
    const lightContrast = contrastRatio(bgLuminance, LIGHT_TEXT_LUMINANCE);
    return darkContrast >= lightContrast ? TEXT_COLOR_DARK : TEXT_COLOR_LIGHT;
  }
  const svg = document.getElementById('fractionWallSvg');
  if (!svg) return;
  const denomInput = document.getElementById('denominatorInput');
  const showLabelsCheckbox = document.getElementById('showRowLabels');
  const textScaleRange = document.getElementById('textScale');
  const textScaleValue = document.getElementById('textScaleValue');
  const decimalDigitsInput = document.getElementById('decimalDigits');
  const percentDigitsInput = document.getElementById('percentDigits');
  const trimTrailingZerosCheckbox = document.getElementById('trimTrailingZeros');
  const presetButtons = document.querySelectorAll('[data-denom-preset]');
  const setModeButtons = document.querySelectorAll('[data-set-mode]');
  const resetModesButton = document.getElementById('resetModes');
  const downloadSvgButton = document.getElementById('btnDownloadSvg');
  const downloadPngButton = document.getElementById('btnDownloadPng');
  const svgExportHelper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const STATE = window.STATE && typeof window.STATE === 'object' ? window.STATE : {};
  window.STATE = STATE;
  let altTextManager = null;
  function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    if (value < min) return min;
    if (value > max) return max;
    return value;
  }
  function clampInt(value, min, max, fallback) {
    const num = Number.parseInt(value, 10);
    if (!Number.isFinite(num)) return clamp(fallback, min, max);
    return clamp(num, min, max);
  }
  function sanitizeDenominators(value) {
    if (Array.isArray(value)) {
      return value.map(v => Number.parseInt(v, 10)).filter(v => Number.isFinite(v) && v > 0 && v <= 48).filter((v, idx, arr) => arr.indexOf(v) === idx).sort((a, b) => a - b);
    }
    if (typeof value === 'string') {
      const parts = value.split(/[^0-9]+/);
      const numbers = [];
      for (const part of parts) {
        if (!part) continue;
        const num = Number.parseInt(part, 10);
        if (Number.isFinite(num) && num > 0 && num <= 48) numbers.push(num);
      }
      return sanitizeDenominators(numbers);
    }
    return [];
  }
  function ensureStateDefaults() {
    const denoms = sanitizeDenominators(STATE.denominators);
    STATE.denominators = denoms.length ? denoms : DEFAULT_DENOMS.slice();
    if (!STATE.tileModes || typeof STATE.tileModes !== 'object') STATE.tileModes = {};
    if (!TEXT_MODES.includes(STATE.defaultMode)) STATE.defaultMode = 'fraction';
    STATE.showLabels = typeof STATE.showLabels === 'boolean' ? STATE.showLabels : true;
    const scale = Number(STATE.textScale);
    STATE.textScale = clamp(Number.isFinite(scale) ? scale : 0.7, MIN_SCALE, MAX_SCALE);
    STATE.decimalDigits = clampInt(STATE.decimalDigits, 0, MAX_DECIMAL_DIGITS, DEFAULT_DECIMAL_DIGITS);
    STATE.percentDigits = clampInt(STATE.percentDigits, 0, MAX_PERCENT_DIGITS, DEFAULT_PERCENT_DIGITS);
    STATE.trimTrailingZeros = typeof STATE.trimTrailingZeros === 'boolean' ? STATE.trimTrailingZeros : false;
    if (typeof STATE.altText !== 'string') STATE.altText = '';
    STATE.altTextSource = STATE.altTextSource === 'manual' ? 'manual' : 'auto';
  }
  ensureStateDefaults();
  function cleanTileModes() {
    const validKeys = new Set();
    for (const den of STATE.denominators) {
      for (let i = 0; i < den; i++) {
        validKeys.add(`${den}:${i}`);
      }
    }
    Object.keys(STATE.tileModes).forEach(key => {
      const mode = STATE.tileModes[key];
      if (!validKeys.has(key) || !TEXT_MODES.includes(mode)) {
        delete STATE.tileModes[key];
      }
    });
  }
  cleanTileModes();
  function sanitizeTileModes(tileModes, denominators) {
    if (!tileModes || typeof tileModes !== 'object') return {};
    const modes = {};
    const validDens = Array.isArray(denominators) ? denominators : [];
    const validDenSet = new Set(validDens);
    Object.entries(tileModes).forEach(([key, value]) => {
      if (!TEXT_MODES.includes(value)) return;
      const match = /^([0-9]+):([0-9]+)$/.exec(key);
      if (!match) return;
      const den = Number.parseInt(match[1], 10);
      const idx = Number.parseInt(match[2], 10);
      if (!Number.isFinite(den) || !validDenSet.has(den)) return;
      if (!Number.isFinite(idx) || idx < 0 || idx >= den) return;
      modes[`${den}:${idx}`] = value;
    });
    return modes;
  }
  function createCleanState() {
    ensureStateDefaults();
    cleanTileModes();
    const denoms = Array.isArray(STATE.denominators) ? STATE.denominators.slice() : DEFAULT_DENOMS.slice();
    const tileModes = sanitizeTileModes(STATE.tileModes, denoms);
    const clean = {
      v: 1,
      denominators: denoms,
      defaultMode: TEXT_MODES.includes(STATE.defaultMode) ? STATE.defaultMode : 'fraction',
      showLabels: !!STATE.showLabels,
      textScale: clamp(Number(STATE.textScale), MIN_SCALE, MAX_SCALE),
      decimalDigits: clampInt(STATE.decimalDigits, 0, MAX_DECIMAL_DIGITS, DEFAULT_DECIMAL_DIGITS),
      percentDigits: clampInt(STATE.percentDigits, 0, MAX_PERCENT_DIGITS, DEFAULT_PERCENT_DIGITS),
      trimTrailingZeros: !!STATE.trimTrailingZeros
    };
    if (Object.keys(tileModes).length) {
      clean.tileModes = tileModes;
    }
    if (STATE.altText && typeof STATE.altText === 'string' && STATE.altText.trim()) {
      clean.altText = STATE.altText;
      clean.altTextSource = STATE.altTextSource === 'manual' ? 'manual' : 'auto';
    }
    return clean;
  }
  function loadCleanState(rawState) {
    if (!rawState || typeof rawState !== 'object') return false;
    if (rawState.v !== undefined && rawState.v !== 1) return false;
    const denominators = sanitizeDenominators(rawState.denominators);
    STATE.denominators = denominators.length ? denominators : DEFAULT_DENOMS.slice();
    STATE.defaultMode = TEXT_MODES.includes(rawState.defaultMode) ? rawState.defaultMode : 'fraction';
    STATE.showLabels = typeof rawState.showLabels === 'boolean' ? rawState.showLabels : STATE.showLabels;
    const nextScale = Number(rawState.textScale);
    STATE.textScale = clamp(Number.isFinite(nextScale) ? nextScale : STATE.textScale, MIN_SCALE, MAX_SCALE);
    STATE.decimalDigits = clampInt(rawState.decimalDigits, 0, MAX_DECIMAL_DIGITS, STATE.decimalDigits);
    STATE.percentDigits = clampInt(rawState.percentDigits, 0, MAX_PERCENT_DIGITS, STATE.percentDigits);
    STATE.trimTrailingZeros = typeof rawState.trimTrailingZeros === 'boolean'
      ? rawState.trimTrailingZeros
      : STATE.trimTrailingZeros;
    const cleanedModes = sanitizeTileModes(rawState.tileModes, STATE.denominators);
    STATE.tileModes = cleanedModes;
    STATE.altText = typeof rawState.altText === 'string' ? rawState.altText : '';
    STATE.altTextSource = rawState.altTextSource === 'manual' ? 'manual' : 'auto';
    ensureStateDefaults();
    cleanTileModes();
    updateControlsFromState();
    render();
    if (altTextManager) {
      altTextManager.applyCurrent();
      refreshAltText('load');
    }
    if (typeof window !== 'undefined') {
      window.STATE_V2 = STATE;
      window.STATE = STATE;
    }
    return true;
  }
  function updateModeButtons() {
    setModeButtons.forEach(btn => {
      if (!btn || !btn.dataset.setMode) return;
      btn.classList.toggle('is-active', btn.dataset.setMode === STATE.defaultMode);
    });
  }
  function updateTextScaleDisplay() {
    if (textScaleValue) {
      const percentage = Math.round(STATE.textScale * 100);
      textScaleValue.textContent = `${percentage}%`;
    }
  }
  function updateControlsFromState() {
    if (denomInput) {
      const joined = STATE.denominators.join(', ');
      denomInput.value = joined;
    }
    if (showLabelsCheckbox) showLabelsCheckbox.checked = !!STATE.showLabels;
    if (textScaleRange) textScaleRange.value = String(STATE.textScale);
    if (decimalDigitsInput) decimalDigitsInput.value = String(STATE.decimalDigits);
    if (percentDigitsInput) percentDigitsInput.value = String(STATE.percentDigits);
    if (trimTrailingZerosCheckbox) trimTrailingZerosCheckbox.checked = !!STATE.trimTrailingZeros;
    updateTextScaleDisplay();
    updateModeButtons();
  }
  updateControlsFromState();
  function createSvgElement(name, attrs) {
    const el = document.createElementNS(SVG_NS, name);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null) continue;
        if (key === 'textContent') el.textContent = value;else el.setAttribute(key, value);
      }
    }
    return el;
  }
  function lightenColor(hex, amount) {
    if (typeof hex !== 'string') return hex;
    const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
    if (!match) return hex;
    const base = match[1];
    const r = parseInt(base.slice(0, 2), 16);
    const g = parseInt(base.slice(2, 4), 16);
    const b = parseInt(base.slice(4, 6), 16);
    const ratio = clamp(Number(amount) || 0, 0, 1);
    const mix = channel => Math.round(channel + (255 - channel) * ratio);
    const nr = mix(r);
    const ng = mix(g);
    const nb = mix(b);
    return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
  }
  function getTileMode(den, index) {
    const key = `${den}:${index}`;
    const stored = STATE.tileModes[key];
    if (TEXT_MODES.includes(stored)) return stored;
    return STATE.defaultMode;
  }
  function setTileMode(den, index, mode) {
    const key = `${den}:${index}`;
    if (!TEXT_MODES.includes(mode)) return;
    if (mode === STATE.defaultMode) {
      delete STATE.tileModes[key];
    } else {
      STATE.tileModes[key] = mode;
    }
  }
  function cycleTileMode(den, index) {
    const current = getTileMode(den, index);
    const idx = TEXT_MODES.indexOf(current);
    const next = TEXT_MODES[(idx + 1) % TEXT_MODES.length];
    setTileMode(den, index, next);
    render();
  }
  function formatFraction(den) {
    if (den === 1) return '1';
    return `1/${den}`;
  }
  const decimalFormatterCache = new Map();
  function formatDecimal(value, digits, trimZeros) {
    const numericDigits = Number.isFinite(digits) ? digits : Number(digits);
    const normalizedDigits = Number.isFinite(numericDigits) ? Math.max(0, Math.min(Math.floor(numericDigits), 20)) : 0;
    const useTrim = !!trimZeros;
    const key = `${normalizedDigits}|${useTrim ? 'trim' : 'pad'}`;
    let formatter = decimalFormatterCache.get(key);
    if (!formatter) {
      const options = {
        maximumFractionDigits: normalizedDigits
      };
      options.minimumFractionDigits = useTrim ? 0 : normalizedDigits;
      formatter = new Intl.NumberFormat('nb-NO', options);
      decimalFormatterCache.set(key, formatter);
    }
    return formatter.format(value);
  }
  function formatValue(mode, den) {
    switch (mode) {
      case 'percent':
        return `${formatDecimal(100 / den, STATE.percentDigits, STATE.trimTrailingZeros)}%`;
      case 'decimal':
        return formatDecimal(1 / den, STATE.decimalDigits, STATE.trimTrailingZeros);
      case 'fraction':
      default:
        return formatFraction(den);
    }
  }
  function tileAriaLabel(den, index, mode) {
    const position = index + 1;
    const total = den;
    const label = MODE_LABELS[mode] || mode;
    return `Del ${position} av ${total}. Viser ${label}. Klikk for å bytte visning.`;
  }
  function getFractionWallTitle() {
    const denominators = Array.isArray(STATE.denominators) ? STATE.denominators : [];
    const count = denominators.length;
    if (!count) return 'Brøkvegg';
    return `Brøkvegg med ${count === 1 ? 'én rad' : `${count} rader`}`;
  }
  function formatModeSentence(den, startIndex, endIndex, mode) {
    const rangeStart = startIndex + 1;
    const rangeEnd = endIndex + 1;
    const rangeText = rangeStart === rangeEnd ? `Del ${rangeStart}` : `Del ${rangeStart} til ${rangeEnd}`;
    if (mode === 'fraction') {
      if (den === 1) {
        return `${rangeText} viser hele delen.`;
      }
      return `${rangeText} viser brøken ${formatFraction(den)}.`;
    }
    if (mode === 'percent') {
      return `${rangeText} viser prosentverdien ${formatValue('percent', den)}.`;
    }
    if (mode === 'decimal') {
      return `${rangeText} viser desimaltallet ${formatValue('decimal', den)}.`;
    }
    const label = MODE_LABELS[mode] || mode;
    return `${rangeText} viser ${label}.`;
  }
  function buildRowAltText(den) {
    const tileCount = den;
    const rowIntro = den === 1 ? 'Raden for hele' : `Raden for nevner ${den}`;
    const intro = `${rowIntro} har ${tileCount === 1 ? 'én del' : `${tileCount} deler`}.`;
    const segments = [];
    for (let i = 0; i < tileCount; i += 1) {
      const mode = getTileMode(den, i);
      const last = segments[segments.length - 1];
      if (last && last.mode === mode) {
        last.end = i;
      } else {
        segments.push({
          start: i,
          end: i,
          mode
        });
      }
    }
    const details = segments.map(segment => formatModeSentence(den, segment.start, segment.end, segment.mode)).join(' ');
    return `${intro} ${details}`.trim();
  }
  function buildFractionWallAltText() {
    ensureStateDefaults();
    cleanTileModes();
    const denominators = Array.isArray(STATE.denominators) ? STATE.denominators.slice() : [];
    if (!denominators.length) {
      return 'Figuren viser ingen rader i brøkveggen.';
    }
    const sentences = [];
    sentences.push(`Figuren viser en brøkvegg med ${denominators.length === 1 ? 'én rad' : `${denominators.length} rader`}.`);
    const defaultLabel = MODE_LABELS[STATE.defaultMode] || STATE.defaultMode;
    if (defaultLabel) {
      sentences.push(`Standardvisningen for nye brøkbiter er ${defaultLabel}.`);
    }
    if (!STATE.showLabels) {
      sentences.push('Radetikettene er skjult.');
    }
    denominators.forEach(den => {
      sentences.push(buildRowAltText(den));
    });
    return sentences.join(' ');
  }

  function buildFractionWallExportMeta() {
    ensureStateDefaults();
    const denominators = Array.isArray(STATE.denominators) ? STATE.denominators.slice().sort((a, b) => a - b) : [];
    const rowCount = denominators.length;
    const mode = TEXT_MODES.includes(STATE.defaultMode) ? STATE.defaultMode : 'fraction';
    const modeLabel = MODE_LABELS[mode] || mode;
    const descriptionParts = [];
    if (rowCount === 0) {
      descriptionParts.push('Brøkvegg uten rader.');
    } else if (rowCount === 1) {
      descriptionParts.push('Brøkvegg med én rad.');
    } else {
      descriptionParts.push(`Brøkvegg med ${rowCount} rader.`);
    }
    if (denominators.length) {
      const denomLabel = rowCount === 1 ? 'nevner' : 'nevnere';
      descriptionParts.push(`${denomLabel} ${denominators.join(', ')}.`);
    }
    if (!STATE.showLabels) {
      descriptionParts.push('Radetikettene er skjult.');
    }
    if (modeLabel) {
      descriptionParts.push(`Standardvisningen er ${modeLabel}.`);
    }
    const description = descriptionParts.join(' ');
    const slugSource = ['brokvegg'];
    if (rowCount) {
      slugSource.push(`${rowCount} rader`);
    }
    if (denominators.length) {
      slugSource.push(`nevner ${denominators.join('-')}`);
    }
    const fallbackBaseName = slugSource.join(' ').trim() || 'brokvegg';
    const defaultBaseName = svgExportHelper && typeof svgExportHelper.slugify === 'function'
      ? svgExportHelper.slugify(fallbackBaseName, 'brokvegg')
      : fallbackBaseName.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'brokvegg';
    const summary = {
      rowCount,
      denominators,
      defaultMode: mode,
      showLabels: Boolean(STATE.showLabels),
      decimalDigits: Number.isFinite(Number(STATE.decimalDigits)) ? Number(STATE.decimalDigits) : DEFAULT_DECIMAL_DIGITS,
      percentDigits: Number.isFinite(Number(STATE.percentDigits)) ? Number(STATE.percentDigits) : DEFAULT_PERCENT_DIGITS,
      trimTrailingZeros: Boolean(STATE.trimTrailingZeros),
      manualOverrides: STATE.tileModes ? Object.keys(STATE.tileModes).length : 0
    };
    return {
      description,
      defaultBaseName,
      summary
    };
  }
  function refreshAltText(reason) {
    if (altTextManager) {
      altTextManager.refresh(reason || 'auto');
    }
  }
  function initAltTextManager() {
    if (!window.MathVisAltText || !svg) return;
    const container = document.getElementById('exportCard');
    if (!container) return;
    if (!altTextManager) {
      altTextManager = window.MathVisAltText.create({
        svg: () => svg,
        container,
        getTitle: getFractionWallTitle,
        getState: () => ({
          text: typeof STATE.altText === 'string' ? STATE.altText : '',
          source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
        }),
        setState: (text, source) => {
          STATE.altText = text;
          STATE.altTextSource = source === 'manual' ? 'manual' : 'auto';
        },
        generate: () => buildFractionWallAltText(),
        getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
        getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
      });
    }
    if (altTextManager) {
      altTextManager.applyCurrent();
      refreshAltText('init');
    }
  }
  function createFractionGroup(den, centerX, centerY, tileWidth, textColor) {
    const group = createSvgElement('g', {
      'aria-hidden': 'true'
    });
    const numeratorText = '1';
    const denominatorText = String(den);
    const maxChars = Math.max(numeratorText.length, denominatorText.length, 1);
    const approximateDigitWidth = 0.62; // Approximate width of a digit relative to font size
    const widthPadding = 0.72; // Leave some horizontal padding on each side
    const baseFontLimit = ROW_HEIGHT * STATE.textScale;
    const widthLimit = tileWidth * widthPadding / (maxChars * approximateDigitWidth);
    let fontSize = Math.max(10, Math.min(baseFontLimit, widthLimit));
    const availableHalfHeight = ROW_HEIGHT / 2 - 4;
    let gap = Math.max(4, fontSize * 0.18);
    let attempts = 0;
    while (fontSize + gap > availableHalfHeight && attempts < 3) {
      const heightLimit = availableHalfHeight - gap;
      const nextFont = Math.max(10, heightLimit);
      if (nextFont >= fontSize) break;
      fontSize = nextFont;
      gap = Math.max(4, fontSize * 0.18);
      attempts++;
    }
    const lineOffset = fontSize / 2 + gap;
    const numerator = createSvgElement('text', {
      x: centerX,
      y: centerY - lineOffset,
      textContent: numeratorText
    });
    numerator.setAttribute('fill', textColor);
    numerator.style.fill = textColor;
    numerator.style.fontSize = `${fontSize}px`;
    const denominator = createSvgElement('text', {
      x: centerX,
      y: centerY + lineOffset,
      textContent: denominatorText
    });
    denominator.setAttribute('fill', textColor);
    denominator.style.fill = textColor;
    denominator.style.fontSize = `${fontSize}px`;
    const estimatedTextWidth = fontSize * approximateDigitWidth * maxChars;
    const lineLength = Math.min(tileWidth * widthPadding, estimatedTextWidth * 1.1);
    const line = createSvgElement('line', {
      x1: centerX - lineLength / 2,
      y1: centerY,
      x2: centerX + lineLength / 2,
      y2: centerY,
      stroke: textColor,
      'stroke-width': Math.max(2, fontSize * 0.12),
      'stroke-linecap': 'round',
      'aria-hidden': 'true'
    });
    group.appendChild(numerator);
    group.appendChild(line);
    group.appendChild(denominator);
    return group;
  }
  function render() {
    ensureStateDefaults();
    cleanTileModes();
    updateControlsFromState();
    const denominators = STATE.denominators;
    const palette = getRowPalette(denominators.length);
    const labelWidth = STATE.showLabels ? LABEL_WIDTH : 0;
    const contentHeight = denominators.length * ROW_HEIGHT + Math.max(0, denominators.length - 1) * ROW_GAP;
    const totalHeight = contentHeight + MARGIN_Y * 2;
    const totalWidth = MARGIN_X * 2 + labelWidth + TILE_AREA_WIDTH;
    svg.setAttribute('viewBox', `0 0 ${totalWidth} ${Math.max(totalHeight, 120)}`);
    const fragment = document.createDocumentFragment();
    const title = createSvgElement('title', {
      id: 'fractionWallTitle',
      textContent: 'Brøkvegg'
    });
    const descText = denominators.length ? `Viser rader for nevnerne ${denominators.join(', ')}.` : 'Ingen rader valgt.';
    const desc = createSvgElement('desc', {
      id: 'fractionWallDesc',
      textContent: descText
    });
    fragment.appendChild(title);
    fragment.appendChild(desc);
    let y = MARGIN_Y;
    denominators.forEach((den, rowIndex) => {
      const rowGroup = createSvgElement('g', {
        transform: `translate(${MARGIN_X}, ${y})`
      });
      const baseColor = getPaletteColor(palette, rowIndex);
      if (STATE.showLabels) {
        const labelGroup = createSvgElement('g');
        const rect = createSvgElement('rect', {
          class: 'rowLabelRect',
          x: 0,
          y: 0,
          width: LABEL_WIDTH,
          height: ROW_HEIGHT,
          rx: 12,
          ry: 12,
          fill: lightenColor(baseColor, 0.6),
          stroke: lightenColor(baseColor, 0.25),
          'stroke-width': 2,
          'aria-hidden': 'true'
        });
        const labelText = createSvgElement('text', {
          class: 'rowLabelText',
          x: LABEL_WIDTH / 2,
          y: ROW_HEIGHT / 2 - 6,
          'aria-hidden': 'true'
        });
        labelText.textContent = String(den);
        const subLabel = createSvgElement('text', {
          class: 'rowLabelSub',
          x: LABEL_WIDTH / 2,
          y: ROW_HEIGHT / 2 + 4,
          'aria-hidden': 'true'
        });
        subLabel.textContent = den === 1 ? 'hel' : `${den} deler`;
        labelGroup.appendChild(rect);
        labelGroup.appendChild(labelText);
        labelGroup.appendChild(subLabel);
        rowGroup.appendChild(labelGroup);
      }
      const tilesGroup = createSvgElement('g', {
        transform: `translate(${STATE.showLabels ? LABEL_WIDTH : 0}, 0)`
      });
      const tileWidth = TILE_AREA_WIDTH / den;
      const tileColor = lightenColor(baseColor, 0.12);
      const tileTextColor = pickTileTextColor(tileColor);
      for (let i = 0; i < den; i++) {
        const mode = getTileMode(den, i);
        const displayValue = formatValue(mode, den);
        const tile = createSvgElement('g', {
          class: 'tile',
          tabindex: '0',
          role: 'button',
          'data-denominator': String(den),
          'data-index': String(i),
          'aria-label': tileAriaLabel(den, i, mode)
        });
        const tileX = tileWidth * i;
        const color = tileColor;
        const textColor = tileTextColor;
        const tooltip = createSvgElement('title', {
          textContent: `${displayValue} – ${MODE_LABELS[mode] || mode}`
        });
        const cornerRadius = Math.min(TILE_RADIUS, tileWidth / 2);
        const rect = createSvgElement('rect', {
          x: tileX,
          y: 0,
          width: tileWidth,
          height: ROW_HEIGHT,
          rx: cornerRadius,
          ry: cornerRadius,
          fill: color,
          'aria-hidden': 'true'
        });
        tile.appendChild(tooltip);
        tile.appendChild(rect);
        if (mode === 'fraction' && den > 1) {
          const fractionGroup = createFractionGroup(den, tileX + tileWidth / 2, ROW_HEIGHT / 2, tileWidth, textColor);
          tile.appendChild(fractionGroup);
        } else {
          const text = createSvgElement('text', {
            x: tileX + tileWidth / 2,
            y: ROW_HEIGHT / 2
          });
          const fontSize = Math.max(10, Math.min(ROW_HEIGHT * STATE.textScale, tileWidth * 0.8));
          text.textContent = displayValue;
          text.setAttribute('fill', textColor);
          text.style.fill = textColor;
          text.style.fontSize = `${fontSize}px`;
          tile.appendChild(text);
        }
        tile.addEventListener('click', event => {
          event.preventDefault();
          cycleTileMode(den, i);
        });
        tile.addEventListener('keydown', event => {
          if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            cycleTileMode(den, i);
          }
        });
        tilesGroup.appendChild(tile);
      }
      rowGroup.appendChild(tilesGroup);
      fragment.appendChild(rowGroup);
      y += ROW_HEIGHT + ROW_GAP;
    });
    svg.replaceChildren(fragment);
    refreshAltText('render');
  }
  render();
  window.render = render;
  window.createCleanState = createCleanState;
  window.loadCleanState = loadCleanState;
  if (typeof window !== 'undefined') {
    window['brøkveggApi'] = {
      createCleanState: (...args) => createCleanState(...args),
      loadCleanState: (...args) => loadCleanState(...args),
      onExampleLoaded: event => {
        const incoming = event && event.detail && typeof event.detail === 'object' ? event.detail.state : null;
        const loaded = loadCleanState(incoming);
        if (!loaded && altTextManager) {
          altTextManager.applyCurrent();
          refreshAltText('examples');
        }
      },
      onExampleCollect: event => {
        if (!event || !event.detail) return;
        try {
          event.detail.svgOverride = svgToString(svg);
        } catch (_) {}
        try {
          event.detail.state = createCleanState();
        } catch (_) {}
      }
    };
    const mv = window.mathVisuals && typeof window.mathVisuals === 'object' ? window.mathVisuals : {};
    mv.activeTool = window['brøkveggApi'];
    window.mathVisuals = mv;
  }
  function handleThemeProfileChange(event) {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    applyThemeToDocument();
    render();
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', handleThemeProfileChange);
  }
  function setDenominatorsFromInput(raw) {
    const parsed = sanitizeDenominators(raw);
    STATE.denominators = parsed.length ? parsed : DEFAULT_DENOMS.slice();
    cleanTileModes();
    render();
  }
  denomInput === null || denomInput === void 0 || denomInput.addEventListener('change', event => {
    setDenominatorsFromInput(event.target.value);
  });
  denomInput === null || denomInput === void 0 || denomInput.addEventListener('blur', event => {
    setDenominatorsFromInput(event.target.value);
  });
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.denomPreset || '';
      setDenominatorsFromInput(preset);
    });
  });
  showLabelsCheckbox === null || showLabelsCheckbox === void 0 || showLabelsCheckbox.addEventListener('change', () => {
    STATE.showLabels = !!showLabelsCheckbox.checked;
    render();
  });
  textScaleRange === null || textScaleRange === void 0 || textScaleRange.addEventListener('input', () => {
    const value = Number(textScaleRange.value);
    STATE.textScale = clamp(value, MIN_SCALE, MAX_SCALE);
    updateTextScaleDisplay();
    render();
  });
  decimalDigitsInput === null || decimalDigitsInput === void 0 || decimalDigitsInput.addEventListener('change', () => {
    STATE.decimalDigits = clampInt(decimalDigitsInput.value, 0, MAX_DECIMAL_DIGITS, STATE.decimalDigits);
    render();
  });
  percentDigitsInput === null || percentDigitsInput === void 0 || percentDigitsInput.addEventListener('change', () => {
    STATE.percentDigits = clampInt(percentDigitsInput.value, 0, MAX_PERCENT_DIGITS, STATE.percentDigits);
    render();
  });
  trimTrailingZerosCheckbox === null || trimTrailingZerosCheckbox === void 0 || trimTrailingZerosCheckbox.addEventListener('change', () => {
    STATE.trimTrailingZeros = !!trimTrailingZerosCheckbox.checked;
    render();
  });
  setModeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.setMode;
      if (!TEXT_MODES.includes(mode)) return;
      STATE.defaultMode = mode;
      STATE.tileModes = {};
      render();
    });
  });
  resetModesButton === null || resetModesButton === void 0 || resetModesButton.addEventListener('click', () => {
    STATE.defaultMode = 'fraction';
    STATE.tileModes = {};
    render();
  });
  function svgToString(svgEl) {
    if (!svgEl) return '';
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
    if (!clone) return '';
    const styles = Array.from(document.querySelectorAll('style')).map(style => style.textContent).join('\n');
    if (styles) {
      const styleEl = document.createElement('style');
      styleEl.textContent = styles;
      const firstElement = clone.firstElementChild;
      if (
        firstElement &&
        typeof firstElement.tagName === 'string' &&
        firstElement.tagName.toLowerCase() === 'rect' &&
        firstElement.getAttribute('fill') === '#ffffff'
      ) {
        clone.insertBefore(styleEl, firstElement.nextSibling);
      } else if (clone.firstChild) {
        clone.insertBefore(styleEl, clone.firstChild);
      } else {
        clone.appendChild(styleEl);
      }
    }
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }
  function downloadSvg(svgEl, filename) {
    const data = svgToString(svgEl);
    const blob = new Blob([data], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadPng(svgEl, filename, scale = 2) {
    const data = svgToString(svgEl);
    const blob = new Blob([data], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      var _svgEl$viewBox;
      const canvas = document.createElement('canvas');
      const viewBox = (_svgEl$viewBox = svgEl.viewBox) === null || _svgEl$viewBox === void 0 ? void 0 : _svgEl$viewBox.baseVal;
      const width = viewBox ? viewBox.width : svgEl.clientWidth;
      const height = viewBox ? viewBox.height : svgEl.clientHeight;
      const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
      const sizing = helper && typeof helper.ensureMinimumPngDimensions === 'function'
        ? helper.ensureMinimumPngDimensions({ width, height }, { scale })
        : (() => {
            const minDimension = 100;
            const baseScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
            const safeWidth = Number.isFinite(width) && width > 0 ? width : minDimension;
            const safeHeight = Number.isFinite(height) && height > 0 ? height : minDimension;
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
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      }, 'image/png');
    };
    img.src = url;
  }
  downloadSvgButton === null || downloadSvgButton === void 0 || downloadSvgButton.addEventListener('click', async () => {
    const suggestedName = 'brokvegg.svg';
    const helper = svgExportHelper;
    const htmlTarget = document.querySelector('.figure') || svg;
    if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
      try {
        const svgString = svgToString(svg);
        const meta = buildFractionWallExportMeta();
        await helper.exportGraphicWithArchiveWithFallback({
          svgElement: svg,
          htmlTarget,
          suggestedName,
          toolId: 'brøkvegg',
          svgString,
          description: meta.description || buildFractionWallAltText(),
          defaultBaseName: meta.defaultBaseName,
          summary: meta.summary,
          title: getFractionWallTitle()
        });
        return;
      } catch (error) {
        console.error('Klarte ikke eksportere via arkivet.', error);
      }
    }
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      try {
        const svgString = svgToString(svg);
        const meta = buildFractionWallExportMeta();
        await helper.exportSvgWithArchive(svg, suggestedName, 'brøkvegg', {
          svgString,
          description: meta.description || buildFractionWallAltText(),
          defaultBaseName: meta.defaultBaseName,
          summary: meta.summary,
          title: getFractionWallTitle()
        });
        return;
      } catch (error) {
        console.error('Klarte ikke eksportere via arkivet.', error);
      }
    }
    downloadSvg(svg, 'brokvegg');
  });
  downloadPngButton === null || downloadPngButton === void 0 || downloadPngButton.addEventListener('click', () => {
    downloadPng(svg, 'brokvegg');
  });
  function refreshPaletteFromTheme() {
    applyThemeToDocument();
    render();
  }
  function handleThemeSettingsChanged() {
    refreshPaletteFromTheme();
  }
  function handleThemeProfileMessage(event) {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    refreshPaletteFromTheme();
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:settings-changed', handleThemeSettingsChanged);
    window.addEventListener('message', handleThemeProfileMessage);
  }
  initAltTextManager();
})();
