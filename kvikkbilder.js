(function () {
  const cfgType = document.getElementById('cfg-type');
  const klosserConfig = document.getElementById('klosserConfig');
  const monsterConfig = document.getElementById('monsterConfig');
  const rectangleConfig = document.getElementById('rectangleConfig');
  const figuresConfig = document.getElementById('figuresConfig');
  const cfgAntallX = document.getElementById('cfg-antallX');
  const cfgAntallY = document.getElementById('cfg-antallY');
  const cfgBredde = document.getElementById('cfg-bredde');
  const cfgHoyde = document.getElementById('cfg-hoyde');
  const cfgDybde = document.getElementById('cfg-dybde');
  const cfgVisibility = document.getElementById('cfg-visibility');
  const cfgShowExpression = document.getElementById('cfg-show-expression');
  const cfgMonsterAntallX = document.getElementById('cfg-monster-antallX');
  const cfgMonsterAntallY = document.getElementById('cfg-monster-antallY');
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgMonsterCircleRadius = document.getElementById('cfg-monster-circleRadius');
  const cfgMonsterLevelScale = document.getElementById('cfg-monster-levelScale');
  const cfgMonsterPatternGap = document.getElementById('cfg-monster-patternGap');
  const cfgRectAntallX = document.getElementById('cfg-rect-antallX');
  const cfgRectAntallY = document.getElementById('cfg-rect-antallY');
  const cfgRectCols = document.getElementById('cfg-rect-cols');
  const cfgRectRows = document.getElementById('cfg-rect-rows');
  const cfgRectRadius = document.getElementById('cfg-rect-radius');
  const cfgRectSpacingX = document.getElementById('cfg-rect-spacingX');
  const cfgRectSpacingY = document.getElementById('cfg-rect-spacingY');
  const cfgRectPatternGap = document.getElementById('cfg-rect-patternGap');
  const cfgFiguresAntallX = document.getElementById('cfg-figures-antallX');
  const cfgFiguresAntallY = document.getElementById('cfg-figures-antallY');
  const cfgFiguresCategory = document.getElementById('cfg-figures-category');
  const cfgFiguresFigure = document.getElementById('cfg-figures-figure');
  const cfgFiguresPatternGap = document.getElementById('cfg-figures-patternGap');
  const brickContainer = document.getElementById('brickContainer');
  const patternContainer = document.getElementById('patternContainer');
  const rectangleContainer = document.getElementById('rectangleContainer');
  const playBtn = document.getElementById('playBtn');
  const expression = document.getElementById('expression');
  const btnSvg = document.getElementById('btnSvg');
  const btnPng = document.getElementById('btnPng');
  const cfgAntallWrapper = document.getElementById('cfg-antall-wrapper');
  const exportCard = document.getElementById('exportCard');
  const fillColorPicker = document.querySelector('[data-fill-color-picker]');
  const DEFAULT_BRICK_PALETTE = {
    stroke: '#932464',
    left: '#cf3a8f',
    right: '#d75ba2',
    top: '#df7cb4'
  };
  const FILL_COLOR_COUNT = 3;
  const LEGACY_FILL_PALETTE = ['#B25FE3', '#6C1BA2', '#534477'];
  const DOT_FALLBACKS = {
    default: '#534477',
    monster: '#534477',
    rectangles: '#534477',
    klosser: '#534477',
    blocks: '#534477'
  };
  const FIGURE_LIBRARY_APP_KEY = 'kvikkbilder';
  let figureLibraryModule = null;
  let figureData = null;
  let figurePicker = null;
  const figureLibraryState = {
    loaded: false,
    loading: null,
    error: false
  };
  let activeFillColorIndex = 1;
  function getThemeApi() {
    const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
    return theme && typeof theme === 'object' ? theme : null;
  }
  function applyThemeToDocument() {
    const theme = getThemeApi();
    if (theme && typeof theme.applyToDocument === 'function') {
      theme.applyToDocument(document);
    }
  }
  function clamp01(value) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
  }
  function normalizeHexColor(color) {
    if (typeof color !== 'string') return null;
    const trimmed = color.trim();
    const hex = trimmed.replace(/^#/, '');
    if (/^[0-9a-fA-F]{3}$/.test(hex)) {
      return '#' + hex.split('').map(ch => ch + ch).join('');
    }
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return '#' + hex;
    }
    return null;
  }
  function isValidColor(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }
  function ensurePaletteSize(palette, fallback, target) {
    const base = Array.isArray(palette) ? palette.filter(isValidColor) : [];
    const backup = Array.isArray(fallback) ? fallback.filter(isValidColor) : [];
    const source = base.length ? base : backup;
    if (!source.length) return [];
    const count = Number.isFinite(target) && target > 0 ? Math.trunc(target) : source.length;
    const result = [];
    for (let i = 0; i < count; i += 1) {
      result.push(source[i % source.length]);
    }
    return result;
  }
  function getPaletteFromTheme(count) {
    const target = Number.isFinite(count) && count > 0 ? Math.trunc(count) : LEGACY_FILL_PALETTE.length;
    const theme = getThemeApi();
    if (theme && typeof theme.getGroupPalette === 'function') {
      let palette = null;
      try {
        palette = theme.getGroupPalette('fractions', { count: target });
      } catch (_) {}
      if ((!palette || palette.length < target) && theme.getGroupPalette.length >= 2) {
        try {
          palette = theme.getGroupPalette('fractions', target);
        } catch (_) {
          palette = null;
        }
      }
      if (Array.isArray(palette) && palette.length) {
        return ensurePaletteSize(palette, LEGACY_FILL_PALETTE, target);
      }
    }
    if (theme && typeof theme.getPalette === 'function') {
      let palette = null;
      try {
        palette = theme.getPalette('fractions', target, { fallbackKinds: ['figures'] });
      } catch (_) {
        palette = null;
      }
      if (Array.isArray(palette) && palette.length) {
        return ensurePaletteSize(palette, LEGACY_FILL_PALETTE, target);
      }
    }
    return ensurePaletteSize([], LEGACY_FILL_PALETTE, target);
  }
  function getFillPalette() {
    const palette = getPaletteFromTheme(FILL_COLOR_COUNT);
    return Array.isArray(palette) ? palette.slice(0, FILL_COLOR_COUNT) : [];
  }
  function sanitizeFillIndex(value, paletteLength) {
    const numeric = Number.parseInt(value, 10);
    const max = Number.isFinite(paletteLength) && paletteLength > 0 ? paletteLength : FILL_COLOR_COUNT;
    if (!Number.isFinite(numeric) || numeric < 1) return 1;
    return Math.min(numeric, max);
  }
  function hexToHsl(hex) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return null;
    const r = parseInt(normalized.slice(1, 3), 16) / 255;
    const g = parseInt(normalized.slice(3, 5), 16) / 255;
    const b = parseInt(normalized.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (delta !== 0) {
      s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
      switch (max) {
        case r:
          h = (g - b) / delta + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / delta + 2;
          break;
        default:
          h = (r - g) / delta + 4;
      }
      h /= 6;
    }
    return {
      h: clamp01(h),
      s: clamp01(s),
      l: clamp01(l)
    };
  }
  function hslToHex(h, s, l) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hueToRgb = t => {
      const normalized = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
      if (normalized < 1 / 6) return p + (q - p) * 6 * normalized;
      if (normalized < 1 / 2) return q;
      if (normalized < 2 / 3) return p + (q - p) * (2 / 3 - normalized) * 6;
      return p;
    };
    const r = Math.round(clamp01(hueToRgb(h + 1 / 3)) * 255);
    const g = Math.round(clamp01(hueToRgb(h)) * 255);
    const b = Math.round(clamp01(hueToRgb(h - 1 / 3)) * 255);
    const toHex = value => value.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function adjustLightness(hex, delta) {
    const hsl = hexToHsl(hex);
    if (!hsl) return null;
    const l = clamp01(hsl.l + delta);
    return hslToHex(hsl.h, hsl.s, l);
  }
  function buildBrickPalette(baseColor) {
    const normalizedBase = normalizeHexColor(baseColor);
    if (!normalizedBase) return { ...DEFAULT_BRICK_PALETTE };
    const stroke = adjustLightness(normalizedBase, -0.16) || DEFAULT_BRICK_PALETTE.stroke;
    const right = adjustLightness(normalizedBase, 0.08) || DEFAULT_BRICK_PALETTE.right;
    const top = adjustLightness(normalizedBase, 0.16) || DEFAULT_BRICK_PALETTE.top;
    return {
      stroke,
      left: normalizedBase,
      right,
      top
    };
  }
  function getFigureValue(figure) {
    if (!figure || typeof figure !== 'object') {
      return '';
    }
    const candidates = [
      figure.slug,
      figure.id,
      figure.fileName,
      figure.image,
      figure.asset
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  }
  function getFigureAliases(figure) {
    const aliases = [];
    if (!figure || typeof figure !== 'object') {
      return aliases;
    }
    const candidates = [
      figure.slug,
      figure.id,
      figure.fileName,
      figure.image,
      figure.asset
    ];
    candidates.forEach(candidate => {
      if (typeof candidate === 'string' && candidate.trim()) {
        aliases.push(candidate.trim());
      }
    });
    return aliases;
  }
  function setSelectPlaceholder(selectEl, label, disabled = true) {
    if (!selectEl) return;
    selectEl.textContent = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = label;
    selectEl.appendChild(option);
    selectEl.disabled = disabled;
  }
  function rebuildFigureLibraryData() {
    if (!figureLibraryModule || !figureLibraryModule.buildFigureData || !figureLibraryModule.createFigurePickerHelpers) {
      return;
    }
    const nextData = figureLibraryModule.buildFigureData({ app: FIGURE_LIBRARY_APP_KEY });
    figureData = nextData;
    const fallbackCategoryId = (nextData.categories[0] && nextData.categories[0].id) || '';
    figurePicker = figureLibraryModule.createFigurePickerHelpers({
      doc: document,
      figureData: nextData,
      fallbackCategoryId,
      getFigureValue,
      getFigureAliases
    });
  }
  function updateFigurePickerControls() {
    if (!cfgFiguresCategory || !cfgFiguresFigure) return;
    if (!CFG.figures || typeof CFG.figures !== 'object') {
      CFG.figures = { ...DEFAULT_CFG.figures };
    }
    if (!figurePicker) {
      setSelectPlaceholder(cfgFiguresCategory, figureLibraryState.loading ? 'Laster figurer …' : 'Ingen figurer tilgjengelig', true);
      setSelectPlaceholder(cfgFiguresFigure, 'Velg figur', true);
      return;
    }
    const categoryResult = figurePicker.renderCategorySelect(cfgFiguresCategory, CFG.figures && CFG.figures.categoryId);
    CFG.figures.categoryId = categoryResult.selectedId;
    const figureResult = figurePicker.renderFigureSelect(cfgFiguresFigure, categoryResult.selectedId, CFG.figures.figureValue, {
      placeholderLabel: 'Velg figur',
      disableWhenEmpty: true
    });
    CFG.figures.figureValue = figureResult.selectedValue;
    if (figureResult.match && figureResult.match.figure) {
      CFG.figures.figureLabel =
        figurePicker.buildFigureOptionLabel(figureResult.match.figure) ||
        figureResult.match.label ||
        figureResult.match.value ||
        '';
    }
  }
  function loadFigureLibrary(options = {}) {
    if (figureLibraryState.loading) {
      return figureLibraryState.loading;
    }
    figureLibraryState.error = false;
    const request = import('./figure-library/all.js')
      .then(module => {
        figureLibraryModule = module;
        if (typeof module.loadFigureLibrary === 'function') {
          return module.loadFigureLibrary({
            app: FIGURE_LIBRARY_APP_KEY,
            force: options.force || undefined,
            refresh: options.refresh || undefined
          });
        }
        return null;
      })
      .then(() => {
        figureLibraryState.loaded = true;
        rebuildFigureLibraryData();
        updateFigurePickerControls();
        if (CFG.type === 'figurer') {
          renderView();
        }
        return figureData;
      })
      .catch(error => {
        figureLibraryState.error = true;
        console.warn('Kunne ikke laste figurbiblioteket', error);
        updateFigurePickerControls();
      })
      .finally(() => {
        figureLibraryState.loading = null;
      });
    figureLibraryState.loading = request;
    return request;
  }
  function getKvikkbilderBaseColor() {
    const fallback = DEFAULT_BRICK_PALETTE.left;
    const theme = getThemeApi();
    if (theme && typeof theme.getGroupPalette === 'function') {
      try {
        const palette = theme.getGroupPalette('kvikkbilder', { count: 1 });
        if (Array.isArray(palette) && palette.length) {
          const normalized = normalizeHexColor(palette[0]);
          if (normalized) return normalized;
        }
      } catch (_) {}
    }
    if (theme && typeof theme.getColor === 'function') {
      const color = theme.getColor('kvikkbilder.fill', fallback);
      const normalized = normalizeHexColor(color);
      if (normalized) return normalized;
    }
    return fallback;
  }
  function applyBrickPalette(svgText, palette) {
    if (typeof svgText !== 'string' || !svgText) return svgText;
    const colors = palette && typeof palette === 'object' ? palette : DEFAULT_BRICK_PALETTE;
    const replacements = [
      ['#af207a', colors.stroke || DEFAULT_BRICK_PALETTE.stroke],
      ['#cf3a8f', colors.left || DEFAULT_BRICK_PALETTE.left],
      ['#df76ae', colors.right || DEFAULT_BRICK_PALETTE.right],
      ['#eca7cb', colors.top || DEFAULT_BRICK_PALETTE.top]
    ];
    let result = svgText;
    replacements.forEach(([search, replacement]) => {
      if (typeof replacement !== 'string') return;
      const pattern = new RegExp(search.replace('#', '\\#'), 'ig');
      result = result.replace(pattern, replacement);
    });
    return result;
  }
  function getDotColor(kind) {
    const fallback = DOT_FALLBACKS[kind] || DOT_FALLBACKS.default;
    const theme = getThemeApi();
    if (theme && typeof theme.getColor === 'function') {
      const color = theme.getColor('dots.default', fallback);
      if (typeof color === 'string' && color) return color;
    }
    return fallback;
  }
  function updateFillPickerSelection(palette) {
    if (!fillColorPicker) return;
    const activeButton = fillColorPicker.querySelector('.color-swatch--active');
    const optionsPanel = fillColorPicker.querySelector('.color-options');
    const colors = Array.isArray(palette) ? palette : getFillPalette();
    if (!activeButton || !optionsPanel) return;
    const safeIndex = sanitizeFillIndex(activeFillColorIndex, colors.length);
    activeFillColorIndex = safeIndex;
    const activeColor = colors[safeIndex - 1] || colors[0] || DEFAULT_BRICK_PALETTE.left;
    activeButton.style.backgroundColor = activeColor;
    optionsPanel.querySelectorAll('.color-option-btn').forEach(btn => {
      const btnIndex = sanitizeFillIndex(btn.dataset.colorIndex, colors.length);
      btn.classList.toggle('is-selected', btnIndex === safeIndex);
    });
  }
  function syncBrickPaletteFromFill(palette) {
    const colors = Array.isArray(palette) ? palette : getFillPalette();
    const safeIndex = sanitizeFillIndex(activeFillColorIndex, colors.length);
    const baseColor = colors[safeIndex - 1] || colors[0] || DEFAULT_BRICK_PALETTE.left;
    kvikkbilderPalette = buildBrickPalette(baseColor);
    return kvikkbilderPalette;
  }
  function applyFillColorSelection(palette) {
    const updatedPalette = syncBrickPaletteFromFill(palette);
    return loadBrickAndBlockAssets(updatedPalette).then(() => {
      renderView();
      return true;
    });
  }
  function renderFillColorPicker() {
    if (!fillColorPicker) return;
    const activeButton = fillColorPicker.querySelector('.color-swatch--active');
    const optionsPanel = fillColorPicker.querySelector('.color-options');
    if (!activeButton || !optionsPanel) return;
    const colors = getFillPalette();
    optionsPanel.innerHTML = '';
    colors.forEach((color, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-option-btn';
      btn.dataset.colorIndex = String(index + 1);
      btn.dataset.colorValue = color;
      btn.style.backgroundColor = color;
      btn.setAttribute('aria-label', `Velg farge ${index + 1}`);
      btn.addEventListener('click', event => {
        event.stopPropagation();
        activeFillColorIndex = sanitizeFillIndex(index + 1, colors.length);
        CFG.fillColorIndex = activeFillColorIndex;
        updateFillPickerSelection(colors);
        optionsPanel.hidden = true;
        applyFillColorSelection(colors);
      });
      optionsPanel.appendChild(btn);
    });
    if (!fillColorPicker.dataset.bound) {
      fillColorPicker.dataset.bound = 'true';
      activeButton.addEventListener('click', event => {
        event.stopPropagation();
        optionsPanel.hidden = !optionsPanel.hidden;
      });
      document.addEventListener('click', event => {
        if (!fillColorPicker.contains(event.target)) {
          optionsPanel.hidden = true;
        }
      });
    }
    updateFillPickerSelection(colors);
  }
  applyThemeToDocument();
  let BRICK_SRC;
  let BLOCK_SRC;
  let RAW_BRICK_SVG = null;
  let RAW_BLOCK_SVG = null;
  let altTextManager = null;
  let autoAltText = '';
  const BRICK_TILE_WIDTH = 26;
  const BRICK_TILE_HEIGHT = 13;
  const BRICK_UNIT_HEIGHT = 13;
  const BRICK_IMAGE_WIDTH = 26;
  const BRICK_IMAGE_HEIGHT = 32.5;
  const BRICK_OFFSET_X = 0.5;
  const BRICK_OFFSET_Y = 25.75;
  function getBrickSrcForType(type) {
    return type === 'blocks' ? BLOCK_SRC : BRICK_SRC;
  }
  const MONSTER_POINT_RADIUS_MIN = 1;
  const MONSTER_POINT_RADIUS_MAX = 60;
  const MONSTER_POINT_SPACING_MIN = 0;
  const MONSTER_POINT_SPACING_MAX = 60;
  const RECT_POINT_RADIUS_MIN = 1;
  const RECT_POINT_RADIUS_MAX = 60;
  const RECT_POINT_SPACING_MIN = 0;
  const RECT_POINT_SPACING_MAX = 60;
  const MAX_VISIBILITY_DURATION = 10;
  const DOT = ' · ';
  function setFigureAlt(element, text) {
    if (!element) return;
    const value = typeof text === 'string' ? text.trim() : '';
    if (value) {
      element.setAttribute('role', 'img');
      element.setAttribute('aria-label', value);
    } else {
      element.removeAttribute('role');
      element.removeAttribute('aria-label');
    }
  }
  function getManualAltText() {
    if (CFG && CFG.altTextSource === 'manual') {
      const text = typeof CFG.altText === 'string' ? CFG.altText.trim() : '';
      if (text) return text;
    }
    return '';
  }
  function setAutoAltText(value) {
    autoAltText = typeof value === 'string' ? value.trim() : '';
  }
  function getEffectiveAltText() {
    const manual = getManualAltText();
    return manual || autoAltText || '';
  }
  function getActiveContainer() {
    if (!CFG) return brickContainer || patternContainer || rectangleContainer || null;
    if (CFG.type === 'monster') return patternContainer || brickContainer || rectangleContainer || null;
    if (CFG.type === 'rectangles') return rectangleContainer || brickContainer || patternContainer || null;
    return brickContainer || patternContainer || rectangleContainer || null;
  }
  function updateFigureAlt(container, reason, options) {
    const opts = options || {};
    const target = container || getActiveContainer();
    const signature = buildAltTextForType(CFG ? CFG.type : undefined);
    if (target) {
      setFigureAlt(target, getEffectiveAltText());
    }
    if (!altTextManager) return;
    if (!opts.skipRefresh && typeof altTextManager.refresh === 'function') {
      altTextManager.refresh(reason || 'config', signature);
    } else if (typeof altTextManager.notifyFigureChange === 'function') {
      altTextManager.notifyFigureChange(signature);
    }
  }
  function buildKlosserAltText(rows, cols, width, height, depth) {
    const rowsCount = Math.max(0, Math.trunc(rows));
    const colsCount = Math.max(0, Math.trunc(cols));
    const widthCount = Math.max(0, Math.trunc(width));
    const heightCount = Math.max(0, Math.trunc(height));
    const depthCount = Math.max(0, Math.trunc(depth));
    const totalFigures = rowsCount * colsCount;
    const perFigure = widthCount * heightCount * depthCount;
    if (totalFigures <= 0 || perFigure <= 0) {
      return 'Ingen klossfigurer vist.';
    }
    if (totalFigures === 1) {
      return `1 klossfigur som består av ${perFigure} klosser (${widthCount} × ${heightCount} × ${depthCount}).`;
    }
    const arrangement = describeArrangement(rowsCount, colsCount);
    const total = totalFigures * perFigure;
    return `${describePlural(totalFigures, 'klossfigur', 'klossfigurer')}. ${arrangement} Hver figur består av ${perFigure} klosser (${widthCount} × ${heightCount} × ${depthCount}), totalt ${total} klosser.`.trim();
  }
  function buildMonsterAltText(rows, cols, count, hasPattern) {
    const rowsCount = Math.max(0, Math.trunc(rows));
    const colsCount = Math.max(0, Math.trunc(cols));
    const dotsPerFigure = Math.max(0, Math.trunc(count));
    const totalFigures = rowsCount * colsCount;
    if (!hasPattern || totalFigures <= 0 || dotsPerFigure <= 0) {
      return 'Ingen numbervisual vist.';
    }
    if (totalFigures === 1) {
      return `1 numbervisual med ${dotsPerFigure} prikker.`;
    }
    const arrangement = describeArrangement(rowsCount, colsCount);
    const totalDots = totalFigures * dotsPerFigure;
    return `${describePlural(totalFigures, 'numbervisual', 'numbervisualer')}. ${arrangement} Hver figur viser ${dotsPerFigure} prikker, totalt ${totalDots} prikker.`.trim();
  }
  function buildRectanglesAltText(figRows, figCols, rowsCount, colsCount, hasPattern) {
    const outerRows = Math.max(0, Math.trunc(figRows));
    const outerCols = Math.max(0, Math.trunc(figCols));
    const innerRows = Math.max(0, Math.trunc(rowsCount));
    const innerCols = Math.max(0, Math.trunc(colsCount));
    const totalFigures = outerRows * outerCols;
    const perFigure = innerRows * innerCols;
    if (!hasPattern || totalFigures <= 0 || perFigure <= 0) {
      return 'Ingen punktrektangler vist.';
    }
    if (totalFigures === 1) {
      return `1 punktrektangel med ${innerRows} rader og ${innerCols} kolonner av prikker (${perFigure} prikker i alt).`;
    }
    const arrangement = describeArrangement(outerRows, outerCols);
    const totalDots = totalFigures * perFigure;
    return `${describePlural(totalFigures, 'punktrektangel', 'punktrektangler')}. ${arrangement} Hver figur har ${innerRows} rader og ${innerCols} kolonner av prikker (${perFigure} prikker), totalt ${totalDots} prikker.`.trim();
  }
  function buildFiguresAltText(figRows, figCols, figureLabel, hasPattern) {
    const outerRows = Math.max(0, Math.trunc(figRows));
    const outerCols = Math.max(0, Math.trunc(figCols));
    const totalFigures = outerRows * outerCols;
    if (!hasPattern || totalFigures <= 0) {
      return 'Ingen figurer vist.';
    }
    const resolvedLabel = typeof figureLabel === 'string' && figureLabel.trim()
      ? figureLabel.trim()
      : 'valgt figur';
    if (totalFigures === 1) {
      return `1 figur (${resolvedLabel}).`;
    }
    const arrangement = describeArrangement(outerRows, outerCols);
    return `${describePlural(totalFigures, 'figur', 'figurer')}. ${arrangement} Valgt figur: ${resolvedLabel}.`.trim();
  }
  function buildAltTextForType(type) {
    const normalizedType = type === 'monster' || type === 'rectangles' || type === 'figurer' ? type : 'klosser';
    if (!CFG) return '';
    if (normalizedType === 'monster') {
      const {
        antallX = 0,
        antallY = 0,
        antall = 0,
        levelScale = 1
      } = CFG.monster || {};
      const cols = Math.max(0, Math.trunc(antallX));
      const rows = Math.max(0, Math.trunc(antallY));
      const count = Math.max(0, Math.trunc(antall));
      const points = byggMonster(count, levelScale);
      const hasPattern = Array.isArray(points) && points.length > 0 && cols > 0 && rows > 0 && count > 0;
      return buildMonsterAltText(rows, cols, count, hasPattern);
    }
    if (normalizedType === 'rectangles') {
      const {
        antallX = 0,
        antallY = 0,
        cols = 0,
        rows = 0
      } = CFG.rectangles || {};
      const figCols = Math.max(0, Math.trunc(antallX));
      const figRows = Math.max(0, Math.trunc(antallY));
      const colsCount = Math.max(0, Math.trunc(cols));
      const rowsCount = Math.max(0, Math.trunc(rows));
      const hasPattern = figCols > 0 && figRows > 0 && colsCount > 0 && rowsCount > 0;
      return buildRectanglesAltText(figRows, figCols, rowsCount, colsCount, hasPattern);
    }
    if (normalizedType === 'figurer') {
      const {
        antallX = 0,
        antallY = 0,
        figureLabel = ''
      } = CFG.figures || {};
      const figCols = Math.max(0, Math.trunc(antallX));
      const figRows = Math.max(0, Math.trunc(antallY));
      const hasPattern = figCols > 0 && figRows > 0;
      return buildFiguresAltText(figRows, figCols, figureLabel, hasPattern);
    }
    const {
      antallX = 0,
      antallY = 0,
      bredde = 0,
      hoyde = 0,
      dybde = 0
    } = CFG.klosser || {};
    const cols = Math.max(0, Math.trunc(antallX));
    const rows = Math.max(0, Math.trunc(antallY));
    const width = Math.max(0, Math.trunc(bredde));
    const height = Math.max(0, Math.trunc(hoyde));
    const depth = Math.max(0, Math.trunc(dybde));
    return buildKlosserAltText(rows, cols, width, height, depth);
  }
  function getAltTextTitle() {
    const base = typeof document !== 'undefined' && document && document.title ? document.title : 'Kvikkbilder';
    if (!CFG) return base;
    const suffix = CFG.type === 'monster'
      ? 'Numbervisuals'
      : CFG.type === 'figurer'
      ? 'Figurer'
      : CFG.type === 'rectangles'
      ? 'Rektangler'
      : CFG.type === 'blocks'
      ? 'Klosser'
      : 'Klosser med knott';
    return `${base} – ${suffix}`;
  }
  function normalizeInteger(value) {
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }
  function describePlural(count, singular, plural) {
    const normalized = normalizeInteger(count);
    if (normalized === 1) {
      return `1 ${singular}`;
    }
    const pluralForm = plural || `${singular}er`;
    return `${normalized} ${pluralForm}`;
  }
  function describeArrangement(rows, cols) {
    const normalizedRows = normalizeInteger(rows);
    const normalizedCols = normalizeInteger(cols);
    if (normalizedRows <= 0 || normalizedCols <= 0) return '';
    const rowsText = describePlural(normalizedRows, 'rad', 'rader');
    const colsText = describePlural(normalizedCols, 'kolonne', 'kolonner');
    return `Ordnet i ${rowsText} og ${colsText}.`;
  }
  function normalizeBrickHeightCount(value) {
    return Math.max(1, Math.trunc(value));
  }
  const DEFAULT_CFG = {
    type: 'klosser',
    showExpression: true,
    fillColorIndex: 1,
    klosser: {
      antallX: 5,
      antallY: 2,
      bredde: 2,
      hoyde: 3,
      dybde: 2,
      duration: 3,
      showBtn: false,
      layerGap: 6
    },
    monster: {
      antallX: 2,
      antallY: 2,
      antall: 9,
      circleRadius: 10,
      dotSpacing: 3,
      levelScale: 1,
      patternGap: 18,
      duration: 3,
      showBtn: false
    },
    rectangles: {
      antallX: 2,
      antallY: 2,
      cols: 4,
      rows: 3,
      radius: 8,
      spacingX: 6,
      spacingY: 6,
      patternGap: 18,
      duration: 3,
      showBtn: false
    },
    figures: {
      antallX: 2,
      antallY: 2,
      patternGap: 18,
      categoryId: '',
      figureValue: '',
      figureLabel: '',
      duration: 3,
      showBtn: false
    }
  };
  function deepClone(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (_) {}
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }
  function createExampleCfg(overrides) {
    const base = deepClone(DEFAULT_CFG) || {};
    const normalized = overrides && typeof overrides === 'object' ? overrides : {};
    if (typeof normalized.type === 'string') {
      base.type = ['monster', 'rectangles', 'blocks', 'figurer'].includes(normalized.type) ? normalized.type : 'klosser';
    }
    if (Object.prototype.hasOwnProperty.call(normalized, 'showExpression')) {
      base.showExpression = normalized.showExpression !== false;
    }
    if (normalized.klosser && typeof normalized.klosser === 'object') {
      base.klosser = Object.assign({}, base.klosser, normalized.klosser);
      if (!Number.isFinite(base.klosser.layerGap) && Number.isFinite(base.klosser.rowGap)) {
        base.klosser.layerGap = Math.max(0, base.klosser.rowGap);
      }
      delete base.klosser.rowGap;
    }
    if (normalized.monster && typeof normalized.monster === 'object') {
      base.monster = Object.assign({}, base.monster, normalized.monster);
    }
    if (normalized.rectangles && typeof normalized.rectangles === 'object') {
      base.rectangles = Object.assign({}, base.rectangles, normalized.rectangles);
    }
    if (normalized.figures && typeof normalized.figures === 'object') {
      base.figures = Object.assign({}, base.figures, normalized.figures);
    }
    return base;
  }
  const globalCfg = typeof window.CFG === 'object' && window.CFG ? window.CFG : {};
  const CFG = window.CFG = globalCfg;
  function iso(x, y, z, tileW, tileH, unitH) {
    return {
      x: (x - y) * tileW / 2,
      y: (x + y) * tileH / 2 - z * unitH
    };
  }
  function createBrick(brickSrc, bredde, hoyde, dybde, layerGap) {
    if (!brickSrc) return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const p = (x, y, z) => iso(x, y, z, BRICK_TILE_WIDTH, BRICK_TILE_HEIGHT, BRICK_UNIT_HEIGHT);
    const widthCount = Math.max(1, Math.trunc(bredde));
    const heightCount = normalizeBrickHeightCount(hoyde);
    const depthCount = Math.max(1, Math.trunc(dybde));
    const normalizedLayerGap = Number.isFinite(layerGap) && layerGap >= 0 ? layerGap : 0;
    const bricks = [];
    for (let z = 0; z < heightCount; z++) {
      for (let y = 0; y < depthCount; y++) {
        for (let x = 0; x < widthCount; x++) {
          const isoPos = p(x, y, z);
          const pos = {
            x: isoPos.x,
            y: isoPos.y - normalizedLayerGap * z
          };
          bricks.push({
            x,
            y,
            z,
            pos
          });
        }
      }
    }
    bricks.sort((a, b) => a.x + a.y + a.z - (b.x + b.y + b.z));
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    bricks.forEach(({
      pos
    }) => {
      const x = pos.x - BRICK_OFFSET_X;
      const y = pos.y - BRICK_OFFSET_Y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + BRICK_IMAGE_WIDTH > maxX) maxX = x + BRICK_IMAGE_WIDTH;
      if (y + BRICK_IMAGE_HEIGHT > maxY) maxY = y + BRICK_IMAGE_HEIGHT;
    });
    const w = Math.max(1, maxX - minX);
    const targetHeight = Math.max(1, maxY - minY);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${targetHeight}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    const group = document.createElementNS(svg.namespaceURI, 'g');
    const translateX = -minX;
    const translateY = -minY;
    const transforms = [];
    if (translateX !== 0 || translateY !== 0) {
      transforms.push(`translate(${translateX},${translateY})`);
    }
    if (transforms.length) {
      group.setAttribute('transform', transforms.join(' '));
    }
    bricks.forEach(({
      pos
    }) => {
      const img = document.createElementNS(svg.namespaceURI, 'image');
      img.setAttributeNS('http://www.w3.org/1999/xlink', 'href', brickSrc);
      img.setAttribute('href', brickSrc);
      img.setAttribute('width', BRICK_IMAGE_WIDTH);
      img.setAttribute('height', BRICK_IMAGE_HEIGHT);
      img.setAttribute('x', pos.x - BRICK_OFFSET_X);
      img.setAttribute('y', pos.y - BRICK_OFFSET_Y);
      group.appendChild(img);
    });
    svg.appendChild(group);
    return svg;
  }
  function filterUnitFactors(factors) {
    if (!Array.isArray(factors)) return [];
    return factors.filter(value => value !== 1);
  }
  function joinFactors(factors) {
    return factors.map(value => `${value}`).join(DOT);
  }
  function formatOuterInnerExpression(outerFactors, innerFactors) {
    const filteredOuter = filterUnitFactors(outerFactors);
    const filteredInner = filterUnitFactors(innerFactors);
    if (filteredOuter.length && filteredInner.length) {
      const outerExpr = joinFactors(filteredOuter);
      const innerExpr = filteredInner.length > 1 ? `(${joinFactors(filteredInner)})` : `${filteredInner[0]}`;
      return `${outerExpr}${DOT}${innerExpr}`;
    }
    if (filteredOuter.length) {
      return joinFactors(filteredOuter);
    }
    if (filteredInner.length) {
      return filteredInner.length > 1 ? `(${joinFactors(filteredInner)})` : `${filteredInner[0]}`;
    }
    return '1';
  }
  function formatProductStep(factors) {
    const filtered = filterUnitFactors(factors);
    return {
      text: filtered.length ? joinFactors(filtered) : '',
      count: filtered.length
    };
  }
  function renderKlosser() {
    const {
      antallX = 0,
      antallY = 0,
      bredde = 0,
      hoyde = 0,
      dybde = 0
    } = CFG.klosser || {};
    const brickSrc = getBrickSrcForType(CFG.type);
    const cols = Math.max(0, Math.trunc(antallX));
    const rows = Math.max(0, Math.trunc(antallY));
    const width = Math.max(1, Math.trunc(bredde));
    const height = Math.max(1, Math.trunc(hoyde));
    const depth = Math.max(1, Math.trunc(dybde));
    brickContainer.innerHTML = '';
    brickContainer.style.gridTemplateColumns = cols > 0 ? `repeat(${cols}, minmax(0, 1fr))` : '';
    brickContainer.style.gridTemplateRows = rows > 0 ? `repeat(${rows}, minmax(0, 1fr))` : '';
    const defaultLayerGap = Number.isFinite(DEFAULT_CFG.klosser.layerGap) ? DEFAULT_CFG.klosser.layerGap : 0;
    const layerGap = Number.isFinite(CFG.klosser.layerGap) ? Math.max(0, CFG.klosser.layerGap) : defaultLayerGap;
    CFG.klosser.layerGap = layerGap;
    const perFig = width * height * depth;
    const totalFigures = cols * rows;
    const total = totalFigures * perFig;
    const firstExpression = formatOuterInnerExpression([cols, rows], [width, height, depth]);
    const productStep = formatProductStep([cols * rows, perFig]);
    const parts = [firstExpression];
    if (productStep.count >= 2) {
      parts.push(`= ${productStep.text}`);
    }
    parts.push(`= ${total}`);
    expression.textContent = parts.join(' ');
    const autoText = buildKlosserAltText(rows, cols, width, height, depth);
    setAutoAltText(autoText);
    updateFigureAlt(brickContainer, 'render-klosser');
    if (!brickSrc) return;
    for (let i = 0; i < totalFigures; i++) {
      const fig = createBrick(brickSrc, width, height, depth, layerGap);
      fig.setAttribute('aria-label', `${width}x${height}x${depth} kloss`);
      brickContainer.appendChild(fig);
    }
  }
  function primeFactors(n) {
    const factors = [];
    let num = n;
    let p = 2;
    while (num > 1 && factors.length < 6) {
      while (num % p === 0 && factors.length < 6) {
        factors.push(p);
        num /= p;
      }
      p++;
    }
    while (factors.length < 6) factors.push(1);
    return factors;
  }
  function computeKs(n, f) {
    const [f1, f2, f3, f4, f5, f6] = f;
    let k1 = (n <= 9 ? 0.5 : 1) / (f2 * f3 * f4 * f5);
    if (f3 === 2 && f4 === 2) k1 *= f5 < 3 ? 0.25 : 0.5;
    if (f4 === 2 && f5 === 2) k1 *= 0.5;
    if (f1 === 2 && f2 === 2 && f3 === 2 && f4 < 3) k1 *= 2;
    if (f1 === 2 && f2 === 2 && f3 === 2 && f4 === 2) k1 *= 2;
    if (f3 === 3) k1 *= f2 / f1;
    if (f1 === f2 && f2 === f3 && f3 === f4 && f4 === f5) k1 *= 2;
    if (n === 1) k1 = 0;
    let k2;
    if (f2 === 1) k2 = 1;else if (f1 === 2 && f2 === 2) k2 = k1;else if (f3 === 1) k2 = 1 - 1 / f2;else if (f2 === f1) k2 = k1 * f2;else if (f3 === f2 && f2 === 3) k2 = k1 * f1;else if (f3 === f2) k2 = k1 * f2;else if (f1 * f2 === 6 && f3 < 3) k2 = k1 * f3 / f1;else k2 = 1 / (f3 * f4 * f5 * f6);
    let k3;
    if (f3 === 1) k3 = 1;else {
      if (f4 === 1) k3 = 1 - k1;else {
        k3 = 1;
        if (f2 * f3 === 4 && f5 === 1) k3 *= Math.max(...f) / f1;
        if (f1 * f2 * f3 === 8 && f6 === 1) k3 *= 1 / f2;
        if (f1 === 2 && f2 === 2 && f3 === 2 && f4 === 2) k3 *= 2;
        k3 *= 1 / (f4 * f5);
      }
      k3 *= 1 / f6;
    }
    if (f1 * f2 * f3 * f4 === 16 && f5 > 2) k3 *= 2;
    let k4;
    if (f4 === 1) k4 = 1;else if (f5 === 1 && f1 * f2 === 4) k4 = 1 - k3;else if (f5 === 1) k4 = 1 - k1;else k4 = 1 / (f5 * f6);
    let k5;
    if (f5 === 1) k5 = 1;else if (f6 === 1) {
      const mul = f1 === 2 && f2 === 2 && f3 === 2 && f4 === 2 ? 0.5 : 1;
      k5 = 1 - mul * k3;
    } else {
      k5 = 1 / f6;
    }
    const k6 = f6 === 1 ? 1 : 1 - k3;
    return [k1, k2, k3, k4, k5, k6];
  }
  function rotate(points, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return points.map(p => ({
      x: p.x * cos - p.y * sin,
      y: p.x * sin + p.y * cos
    }));
  }
  function translate(points, tx, ty) {
    return points.map(p => ({
      x: p.x + tx,
      y: p.y + ty
    }));
  }
  function buildLevel(points, factor, r) {
    if (factor === 1) return points;
    const res = [];
    for (let i = 0; i < factor; i++) {
      const rotAngle = -2 * Math.PI * i / factor;
      const rotated = rotate(points, rotAngle);
      const baseAngle = 2 * Math.PI * i / factor;
      let tx, ty;
      if (factor === 2) {
        tx = r * Math.cos(baseAngle);
        ty = r * Math.sin(baseAngle);
      } else {
        tx = r * Math.sin(baseAngle);
        ty = r * Math.cos(baseAngle);
      }
      res.push(...translate(rotated, tx, ty));
    }
    return res;
  }
  function normalizeScale(value, fallback) {
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return value;
  }
  function byggMonster(n, levelScale = 1) {
    if (n <= 0) return [];
    const factors = primeFactors(n);
    const normalizedLevel = normalizeScale(levelScale, 1);
    const ks = computeKs(n, factors).map((value, index) => {
      if (!Number.isFinite(value)) return 0;
      if (index === 0) return value;
      return value * normalizedLevel;
    });
    let pts = [];
    const f1 = factors[0];
    for (let i = 0; i < f1; i++) {
      const angle = 2 * Math.PI * i / f1;
      pts.push({
        x: ks[0] * Math.sin(angle),
        y: ks[0] * Math.cos(angle)
      });
    }
    pts = buildLevel(pts, factors[1], ks[1]);
    pts = buildLevel(pts, factors[2], ks[2]);
    pts = buildLevel(pts, factors[3], ks[3]);
    pts = buildLevel(pts, factors[4], ks[4]);
    pts = buildLevel(pts, factors[5], ks[5]);
    const scale = 0.3;
    return pts.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }));
  }
  function createPatternSvg(points, options = {}) {
    if (!points.length) return null;
    const radiusRaw = options.radius;
    const spacingRaw = options.spacing;
    const radius = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : 10;
    const spacing = Number.isFinite(spacingRaw) && spacingRaw >= 0 ? spacingRaw : 3;
    const desiredCenterDistance = radius * 2 + spacing;
    const seen = new Set();
    const uniquePoints = [];
    const precision = 1e4;
    points.forEach(p => {
      const key = `${Math.round(p.x * precision)}:${Math.round(p.y * precision)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePoints.push(p);
      }
    });
    let minDist = Infinity;
    for (let i = 0; i < uniquePoints.length; i++) {
      for (let j = i + 1; j < uniquePoints.length; j++) {
        const dx = uniquePoints[i].x - uniquePoints[j].x;
        const dy = uniquePoints[i].y - uniquePoints[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < minDist) minDist = dist;
      }
    }
    if (!Number.isFinite(minDist) || minDist <= 0) minDist = desiredCenterDistance;
    let scale = desiredCenterDistance / minDist;
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;else if (scale < 1) scale = 1;
    const scaledPoints = points.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }));
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    scaledPoints.forEach(({
      x,
      y
    }) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    const pad = radius + spacing;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const baseW = contentWidth + pad * 2;
    const baseH = contentHeight + pad * 2;
    const minSize = Math.max(radius * 4, 40);
    const vbW = Math.max(baseW, minSize);
    const vbH = Math.max(baseH, minSize);
    const extraX = (vbW - baseW) / 2;
    const extraY = (vbH - baseH) / 2;
    const offsetX = pad + extraX - minX;
    const offsetY = pad + extraY - minY;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    scaledPoints.forEach(({
      x,
      y
    }) => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', x + offsetX);
      c.setAttribute('cy', y + offsetY);
      c.setAttribute('r', radius);
      c.setAttribute('fill', getDotColor('monster'));
      svg.appendChild(c);
    });
    return svg;
  }
  function createRectangleSvg(cols, rows, options = {}) {
    const colCount = Math.max(0, Math.trunc(cols));
    const rowCount = Math.max(0, Math.trunc(rows));
    if (colCount <= 0 || rowCount <= 0) return null;
    const radiusRaw = options.radius;
    const spacingXRaw = options.spacingX;
    const spacingYRaw = options.spacingY;
    const radius = Number.isFinite(radiusRaw) && radiusRaw > 0 ? Math.min(radiusRaw, RECT_POINT_RADIUS_MAX) : DEFAULT_CFG.rectangles.radius;
    const spacingX = Number.isFinite(spacingXRaw) && spacingXRaw >= 0 ? Math.min(spacingXRaw, RECT_POINT_SPACING_MAX) : DEFAULT_CFG.rectangles.spacingX;
    const spacingY = Number.isFinite(spacingYRaw) && spacingYRaw >= 0 ? Math.min(spacingYRaw, RECT_POINT_SPACING_MAX) : DEFAULT_CFG.rectangles.spacingY;
    const centerDistX = radius * 2 + spacingX;
    const centerDistY = radius * 2 + spacingY;
    const innerWidth = (colCount - 1) * centerDistX;
    const innerHeight = (rowCount - 1) * centerDistY;
    const padX = Math.max(radius, spacingX + radius * 0.5);
    const padY = Math.max(radius, spacingY + radius * 0.5);
    const vbW = innerWidth + radius * 2 + padX * 2;
    const vbH = innerHeight + radius * 2 + padY * 2;
    const startX = padX + radius;
    const startY = padY + radius;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    for (let row = 0; row < rowCount; row++) {
      for (let col = 0; col < colCount; col++) {
        const cx = startX + col * centerDistX;
        const cy = startY + row * centerDistY;
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', cx);
        circle.setAttribute('cy', cy);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', getDotColor('rectangles'));
        svg.appendChild(circle);
      }
    }
    return svg;
  }
  function renderMonster() {
    if (!patternContainer) return;
    const {
      antallX = 0,
      antallY = 0,
      antall = 0,
      circleRadius = 10,
      dotSpacing = 3,
      levelScale = 1,
      patternGap = 18
    } = CFG.monster || {};
    patternContainer.innerHTML = '';
    const cols = Math.max(0, Math.trunc(antallX));
    const rows = Math.max(0, Math.trunc(antallY));
    patternContainer.style.gridTemplateColumns = cols > 0 ? `repeat(${cols},minmax(0,1fr))` : '';
    patternContainer.style.gridTemplateRows = rows > 0 ? `repeat(${rows},minmax(0,1fr))` : '';
    const maxDimension = Math.max(cols, rows);
    const gapNumber = Number.isFinite(patternGap) ? patternGap : Number.parseFloat(patternGap);
    const allowGapOverride = !(cols <= 1 && rows <= 1);
    const gapOverride = allowGapOverride && Number.isFinite(gapNumber) && gapNumber >= 0 ? gapNumber : null;
    const gapPx = gapOverride !== null ? gapOverride : maxDimension <= 1 ? 64 : maxDimension === 2 ? 56 : maxDimension === 3 ? 44 : maxDimension === 4 ? 36 : 28;
    const itemPaddingPx = gapOverride !== null ? Math.max(0, Math.round(gapPx * 0.5)) : Math.min(72, Math.max(18, Math.round(gapPx * 0.65)));
    const containerPaddingPx = gapOverride !== null ? Math.max(0, Math.round(gapPx * 0.3)) : Math.min(48, Math.max(12, Math.round(gapPx * 0.4)));
    patternContainer.style.setProperty('--pattern-gap', `${gapPx}px`);
    patternContainer.style.setProperty('--pattern-item-padding', `${itemPaddingPx}px`);
    patternContainer.style.setProperty('--pattern-padding', `${containerPaddingPx}px`);
    const count = Math.max(0, Math.trunc(antall));
    const points = byggMonster(count, levelScale);
    const factors = primeFactors(count).filter(x => x > 1);
    const baseExpression = factors.length ? `${factors.join(DOT)} = ${count}` : `${count}`;
    const totalFigures = cols * rows;
    const hasPoints = Array.isArray(points) && points.length > 0 && cols > 0 && rows > 0;
    let svg = null;
    if (hasPoints) {
      svg = createPatternSvg(points, {
        radius: circleRadius,
        spacing: dotSpacing
      });
    }
    const hasPattern = !!svg;
    const autoText = buildMonsterAltText(rows, cols, count, hasPattern);
    setAutoAltText(autoText);
    updateFigureAlt(patternContainer, 'render-monster');
    if (!hasPattern) {
      expression.textContent = baseExpression;
      return;
    }
    svg.setAttribute('aria-label', `Numbervisual ${count}`);
    const totalDots = totalFigures * count;
    for (let i = 0; i < totalFigures; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pattern-item';
      wrapper.appendChild(svg.cloneNode(true));
      patternContainer.appendChild(wrapper);
    }
    if (totalFigures > 1) {
      const outerFactors = filterUnitFactors([cols, rows]);
      const firstExpression = outerFactors.length ? `${joinFactors(outerFactors)}${DOT}(${baseExpression})` : baseExpression;
      const productStep = formatProductStep([totalFigures, count]);
      const parts = [firstExpression];
      if (productStep.count >= 2) {
        parts.push(`= ${productStep.text}`);
      }
      parts.push(`= ${totalFigures * count}`);
      expression.textContent = parts.join(' ');
    } else {
      expression.textContent = baseExpression;
    }
  }
  function renderRectangles() {
    if (!rectangleContainer) return;
    const {
      antallX = 0,
      antallY = 0,
      cols = 0,
      rows = 0,
      radius = DEFAULT_CFG.rectangles.radius,
      spacingX = DEFAULT_CFG.rectangles.spacingX,
      spacingY = DEFAULT_CFG.rectangles.spacingY,
      patternGap = DEFAULT_CFG.rectangles.patternGap
    } = CFG.rectangles || {};
    rectangleContainer.innerHTML = '';
    const figCols = Math.max(0, Math.trunc(antallX));
    const figRows = Math.max(0, Math.trunc(antallY));
    rectangleContainer.style.gridTemplateColumns = figCols > 0 ? `repeat(${figCols},minmax(0,1fr))` : '';
    rectangleContainer.style.gridTemplateRows = figRows > 0 ? `repeat(${figRows},minmax(0,1fr))` : '';
    const allowGap = !(figCols <= 1 && figRows <= 1);
    const gapNumber = Number.isFinite(patternGap) ? patternGap : Number.parseFloat(patternGap);
    const normalizedGap = Number.isFinite(gapNumber) ? Math.max(0, gapNumber) : DEFAULT_CFG.rectangles.patternGap;
    const gapPx = allowGap ? normalizedGap : 0;
    const radiusSafe = Number.isFinite(radius) ? radius : DEFAULT_CFG.rectangles.radius;
    const spacingXSafe = Number.isFinite(spacingX) ? spacingX : DEFAULT_CFG.rectangles.spacingX;
    const spacingYSafe = Number.isFinite(spacingY) ? spacingY : DEFAULT_CFG.rectangles.spacingY;
    const itemPadding = Math.max(12, Math.round(radiusSafe + Math.max(spacingXSafe, spacingYSafe)));
    const containerPadding = allowGap ? Math.max(8, Math.round(gapPx * 0.5)) : Math.max(12, itemPadding);
    rectangleContainer.style.setProperty('--pattern-gap', `${gapPx}px`);
    rectangleContainer.style.setProperty('--pattern-item-padding', `${itemPadding}px`);
    rectangleContainer.style.setProperty('--pattern-padding', `${containerPadding}px`);
    const colsCount = Math.max(0, Math.trunc(cols));
    const rowsCount = Math.max(0, Math.trunc(rows));
    const perFigure = colsCount * rowsCount;
    const totalFigures = figCols * figRows;
    const firstExpression = formatOuterInnerExpression([figCols, figRows], [colsCount, rowsCount]);
    const productStep = formatProductStep([totalFigures, perFigure]);
    const totalDots = totalFigures * perFigure;
    let expr = firstExpression;
    if (productStep.count >= 2) {
      expr = expr ? `${expr} = ${productStep.text}` : productStep.text;
    }
    expression.textContent = expr ? `${expr} = ${totalDots}` : `${totalDots}`;
    let svg = null;
    if (totalFigures > 0 && colsCount > 0 && rowsCount > 0) {
      svg = createRectangleSvg(colsCount, rowsCount, {
        radius: radiusSafe,
        spacingX: spacingXSafe,
        spacingY: spacingYSafe
      });
    }
    const hasPattern = !!svg;
    const autoText = buildRectanglesAltText(figRows, figCols, rowsCount, colsCount, hasPattern);
    setAutoAltText(autoText);
    updateFigureAlt(rectangleContainer, 'render-rectangles');
    if (!hasPattern) {
      return;
    }
    svg.setAttribute('aria-label', `${colsCount} × ${rowsCount} prikker`);
    const total = totalFigures;
    for (let i = 0; i < total; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pattern-item';
      wrapper.appendChild(svg.cloneNode(true));
      rectangleContainer.appendChild(wrapper);
    }
  }
  function createFigurePlaceholderSvg(label) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', '4');
    rect.setAttribute('y', '4');
    rect.setAttribute('width', '112');
    rect.setAttribute('height', '112');
    rect.setAttribute('rx', '12');
    rect.setAttribute('fill', '#f3f4f6');
    rect.setAttribute('stroke', '#cbd5f5');
    rect.setAttribute('stroke-width', '2');
    svg.appendChild(rect);
    const text = document.createElementNS(svgNS, 'text');
    text.setAttribute('x', '60');
    text.setAttribute('y', '64');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', '14');
    text.setAttribute('fill', '#6b7280');
    text.textContent = label || 'Figur';
    svg.appendChild(text);
    return svg;
  }
  function createFigureSvg(imageSrc, label) {
    if (!imageSrc) {
      return createFigurePlaceholderSvg(label);
    }
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    const image = document.createElementNS(svgNS, 'image');
    image.setAttribute('href', imageSrc);
    image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', imageSrc);
    image.setAttribute('x', '0');
    image.setAttribute('y', '0');
    image.setAttribute('width', '100');
    image.setAttribute('height', '100');
    image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.appendChild(image);
    if (label) {
      svg.setAttribute('aria-label', label);
    }
    return svg;
  }
  function resolveFigureSelection() {
    if (!figurePicker) return null;
    let match = figurePicker.findOptionByValue(CFG.figures.figureValue);
    if (!match) {
      const resolvedCategory = figurePicker.resolveCategoryId(CFG.figures.categoryId, CFG.figures.figureValue);
      const options = figurePicker.buildFigureOptions(resolvedCategory);
      if (options.length) {
        match = figurePicker.findOptionByValue(options[0].value) || options[0];
      }
    }
    if (match) {
      CFG.figures.categoryId = match.categoryId || CFG.figures.categoryId;
      CFG.figures.figureValue = match.value || CFG.figures.figureValue;
      CFG.figures.figureLabel =
        (match.figure && figurePicker.buildFigureOptionLabel(match.figure)) ||
        match.label ||
        match.value ||
        CFG.figures.figureLabel ||
        '';
    }
    return match;
  }
  function renderFigures() {
    if (!patternContainer) return;
    const {
      antallX = 0,
      antallY = 0,
      patternGap = DEFAULT_CFG.figures.patternGap
    } = CFG.figures || {};
    patternContainer.innerHTML = '';
    const figCols = Math.max(0, Math.trunc(antallX));
    const figRows = Math.max(0, Math.trunc(antallY));
    patternContainer.style.gridTemplateColumns = figCols > 0 ? `repeat(${figCols},minmax(0,1fr))` : '';
    patternContainer.style.gridTemplateRows = figRows > 0 ? `repeat(${figRows},minmax(0,1fr))` : '';
    const allowGap = !(figCols <= 1 && figRows <= 1);
    const gapNumber = Number.isFinite(patternGap) ? patternGap : Number.parseFloat(patternGap);
    const normalizedGap = Number.isFinite(gapNumber) ? Math.max(0, gapNumber) : DEFAULT_CFG.figures.patternGap;
    const gapPx = allowGap ? normalizedGap : 0;
    const itemPadding = allowGap ? Math.max(12, Math.round(gapPx * 0.6)) : 16;
    const containerPadding = allowGap ? Math.max(8, Math.round(gapPx * 0.45)) : Math.max(12, itemPadding);
    patternContainer.style.setProperty('--pattern-gap', `${gapPx}px`);
    patternContainer.style.setProperty('--pattern-item-padding', `${itemPadding}px`);
    patternContainer.style.setProperty('--pattern-padding', `${containerPadding}px`);
    const totalFigures = figCols * figRows;
    const match = resolveFigureSelection();
    const figure = match && match.figure ? match.figure : null;
    const figureLabel = CFG.figures.figureLabel || (figure && (figure.name || match.label)) || '';
    const imageSrc = figure ? figure.image || figure.asset || '' : '';
    const svg = createFigureSvg(imageSrc, figureLabel);
    const hasPattern = !!svg && totalFigures > 0;
    const autoText = buildFiguresAltText(figRows, figCols, figureLabel, hasPattern);
    setAutoAltText(autoText);
    updateFigureAlt(patternContainer, 'render-figurer');
    const outerFactors = filterUnitFactors([figCols, figRows]);
    if (outerFactors.length > 1) {
      expression.textContent = `${joinFactors(outerFactors)} = ${totalFigures}`;
    } else {
      expression.textContent = `${totalFigures}`;
    }
    if (!hasPattern) {
      return;
    }
    for (let i = 0; i < totalFigures; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pattern-item pattern-item--figure';
      wrapper.appendChild(svg.cloneNode(true));
      patternContainer.appendChild(wrapper);
    }
  }
  function applyExpressionVisibility() {
    if (!expression) return;
    const enabled = CFG.showExpression !== false;
    const playVisible = playBtn.style.display !== 'none';
    expression.style.display = enabled && !playVisible ? 'block' : 'none';
  }
  function updateVisibilityKlosser() {
    var _CFG$klosser;
    patternContainer.style.display = 'none';
    if (rectangleContainer) rectangleContainer.style.display = 'none';
    if ((_CFG$klosser = CFG.klosser) !== null && _CFG$klosser !== void 0 && _CFG$klosser.showBtn) {
      playBtn.style.display = 'flex';
      brickContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      brickContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }
  function updateVisibilityMonster() {
    var _CFG$monster;
    brickContainer.style.display = 'none';
    if (rectangleContainer) rectangleContainer.style.display = 'none';
    if ((_CFG$monster = CFG.monster) !== null && _CFG$monster !== void 0 && _CFG$monster.showBtn) {
      playBtn.style.display = 'flex';
      patternContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      patternContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }
  function updateVisibilityRectangles() {
    var _CFG$rectangles;
    brickContainer.style.display = 'none';
    patternContainer.style.display = 'none';
    if ((_CFG$rectangles = CFG.rectangles) !== null && _CFG$rectangles !== void 0 && _CFG$rectangles.showBtn) {
      playBtn.style.display = 'flex';
      if (rectangleContainer) rectangleContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      if (rectangleContainer) rectangleContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }
  function updateVisibilityFigures() {
    var _CFG$figures;
    brickContainer.style.display = 'none';
    if (rectangleContainer) rectangleContainer.style.display = 'none';
    if ((_CFG$figures = CFG.figures) !== null && _CFG$figures !== void 0 && _CFG$figures.showBtn) {
      playBtn.style.display = 'flex';
      patternContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      patternContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }
  function clampInt(value, min, fallback) {
    const num = Number.parseInt(value, 10);
    if (Number.isFinite(num)) {
      const safeMin = Number.isFinite(min) ? min : -Infinity;
      return Math.max(safeMin, Math.trunc(num));
    }
    return fallback;
  }
  function clampFloat(value, min, fallback, max) {
    const num = Number.parseFloat(value);
    const safeMin = Number.isFinite(min) ? min : -Infinity;
    const safeMax = Number.isFinite(max) ? max : Infinity;
    if (Number.isFinite(num)) {
      return Math.min(safeMax, Math.max(safeMin, num));
    }
    const normalizedFallback = Number.isFinite(fallback) ? fallback : Number.isFinite(min) ? min : 0;
    return Math.min(safeMax, Math.max(safeMin, normalizedFallback));
  }
  function updateMonsterPatternGapState() {
    if (!cfgMonsterPatternGap) return;
    const disableGap = CFG.monster.antallX <= 1 && CFG.monster.antallY <= 1;
    cfgMonsterPatternGap.disabled = disableGap;
    if (disableGap) {
      cfgMonsterPatternGap.setAttribute('title', 'Figuravstand er tilgjengelig når det er flere figurer.');
    } else {
      cfgMonsterPatternGap.removeAttribute('title');
    }
  }
  function updateRectanglesPatternGapState() {
    if (!cfgRectPatternGap) return;
    const disableGap = CFG.rectangles.antallX <= 1 && CFG.rectangles.antallY <= 1;
    cfgRectPatternGap.disabled = disableGap;
    if (disableGap) {
      cfgRectPatternGap.setAttribute('title', 'Figuravstand er tilgjengelig når det er flere figurer.');
    } else {
      cfgRectPatternGap.removeAttribute('title');
    }
  }
  function updateFiguresPatternGapState() {
    if (!cfgFiguresPatternGap) return;
    const disableGap = CFG.figures.antallX <= 1 && CFG.figures.antallY <= 1;
    cfgFiguresPatternGap.disabled = disableGap;
    if (disableGap) {
      cfgFiguresPatternGap.setAttribute('title', 'Figuravstand er tilgjengelig når det er flere figurer.');
    } else {
      cfgFiguresPatternGap.removeAttribute('title');
    }
  }
  function initAltTextManager() {
    if (typeof window === 'undefined' || !window.MathVisAltText) return;
    if (altTextManager || !exportCard) return;
    altTextManager = window.MathVisAltText.create({
      svg: () => getActiveSvg(),
      container: exportCard,
      getTitle: getAltTextTitle,
      getState: () => ({
        text: typeof CFG.altText === 'string' ? CFG.altText : '',
        source: CFG.altTextSource === 'manual' ? 'manual' : 'auto'
      }),
      setState: (text, source) => {
        const cleaned = typeof text === 'string' ? text.trim() : '';
        CFG.altText = cleaned;
        CFG.altTextSource = cleaned && source === 'manual' ? 'manual' : 'auto';
        updateFigureAlt(null, source === 'manual' ? 'manual-state' : 'auto-state', { skipRefresh: true });
      },
      generate: () => buildAltTextForType(CFG.type),
      getSignature: () => buildAltTextForType(CFG.type),
      getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
      getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
    });
    if (altTextManager) {
      altTextManager.applyCurrent();
    }
  }
  function sanitizeCfg() {
    if (!['monster', 'klosser', 'rectangles', 'blocks', 'figurer'].includes(CFG.type)) {
      CFG.type = DEFAULT_CFG.type;
    }
    CFG.showExpression = CFG.showExpression !== false;
    if (typeof CFG.altText !== 'string') {
      CFG.altText = '';
    } else {
      CFG.altText = CFG.altText.trim();
    }
    if (CFG.altText && CFG.altTextSource === 'manual') {
      CFG.altTextSource = 'manual';
    } else {
      CFG.altTextSource = 'auto';
    }
    if (!CFG.klosser || typeof CFG.klosser !== 'object') CFG.klosser = {};
    if (!CFG.monster || typeof CFG.monster !== 'object') CFG.monster = {};
    if (!CFG.rectangles || typeof CFG.rectangles !== 'object') CFG.rectangles = {};
    if (!CFG.figures || typeof CFG.figures !== 'object') CFG.figures = {};
    const k = CFG.klosser;
    const dk = DEFAULT_CFG.klosser;
    k.antallX = clampInt(k.antallX, 0, dk.antallX);
    k.antallY = clampInt(k.antallY, 0, dk.antallY);
    k.bredde = clampInt(k.bredde, 1, dk.bredde);
    k.hoyde = clampInt(k.hoyde, 1, dk.hoyde);
    k.dybde = clampInt(k.dybde, 1, dk.dybde);
    if (!Number.isFinite(k.layerGap) && Number.isFinite(k.rowGap)) {
      k.layerGap = Math.max(0, k.rowGap);
    }
    k.layerGap = clampFloat(k.layerGap, 0, dk.layerGap);
    delete k.rowGap;
    k.duration = clampInt(k.duration, 0, dk.duration);
    k.showBtn = k.showBtn === true;
    if (k.showBtn) {
      const normalizedDuration = Number.isFinite(k.duration) ? k.duration : dk.duration;
      k.duration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, normalizedDuration));
    } else {
      k.duration = Math.max(0, k.duration);
    }
    const m = CFG.monster;
    const dm = DEFAULT_CFG.monster;
    m.antallX = clampInt(m.antallX, 0, dm.antallX);
    m.antallY = clampInt(m.antallY, 0, dm.antallY);
    m.antall = clampInt(m.antall, 0, dm.antall);
    m.circleRadius = clampFloat(m.circleRadius, MONSTER_POINT_RADIUS_MIN, dm.circleRadius, MONSTER_POINT_RADIUS_MAX);
    m.dotSpacing = clampFloat(m.dotSpacing, MONSTER_POINT_SPACING_MIN, dm.dotSpacing, MONSTER_POINT_SPACING_MAX);
    m.levelScale = clampFloat(m.levelScale, 0.1, dm.levelScale);
    m.patternGap = clampFloat(m.patternGap, 0, dm.patternGap);
    m.duration = clampInt(m.duration, 0, dm.duration);
    m.showBtn = m.showBtn === true;
    if (m.showBtn) {
      const normalizedDuration = Number.isFinite(m.duration) ? m.duration : dm.duration;
      m.duration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, normalizedDuration));
    } else {
      m.duration = Math.max(0, m.duration);
    }
    const r = CFG.rectangles;
    const dr = DEFAULT_CFG.rectangles;
    r.antallX = clampInt(r.antallX, 0, dr.antallX);
    r.antallY = clampInt(r.antallY, 0, dr.antallY);
    r.cols = clampInt(r.cols, 1, dr.cols);
    r.rows = clampInt(r.rows, 1, dr.rows);
    r.radius = clampFloat(r.radius, RECT_POINT_RADIUS_MIN, dr.radius, RECT_POINT_RADIUS_MAX);
    r.spacingX = clampFloat(r.spacingX, RECT_POINT_SPACING_MIN, dr.spacingX, RECT_POINT_SPACING_MAX);
    r.spacingY = clampFloat(r.spacingY, RECT_POINT_SPACING_MIN, dr.spacingY, RECT_POINT_SPACING_MAX);
    r.patternGap = clampFloat(r.patternGap, 0, dr.patternGap);
    r.duration = clampInt(r.duration, 0, dr.duration);
    r.showBtn = r.showBtn === true;
    if (r.showBtn) {
      const normalizedDuration = Number.isFinite(r.duration) ? r.duration : dr.duration;
      r.duration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, normalizedDuration));
    } else {
      r.duration = Math.max(0, r.duration);
    }
    const f = CFG.figures;
    const df = DEFAULT_CFG.figures;
    f.antallX = clampInt(f.antallX, 0, df.antallX);
    f.antallY = clampInt(f.antallY, 0, df.antallY);
    f.patternGap = clampFloat(f.patternGap, 0, df.patternGap);
    f.duration = clampInt(f.duration, 0, df.duration);
    f.showBtn = f.showBtn === true;
    if (f.showBtn) {
      const normalizedDuration = Number.isFinite(f.duration) ? f.duration : df.duration;
      f.duration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, normalizedDuration));
    } else {
      f.duration = Math.max(0, f.duration);
    }
    f.categoryId = typeof f.categoryId === 'string' ? f.categoryId.trim() : '';
    f.figureValue = typeof f.figureValue === 'string' ? f.figureValue.trim() : '';
    f.figureLabel = typeof f.figureLabel === 'string' ? f.figureLabel.trim() : '';
    activeFillColorIndex = sanitizeFillIndex(CFG.fillColorIndex, FILL_COLOR_COUNT);
    CFG.fillColorIndex = activeFillColorIndex;
    return CFG;
  }
  function resolveVisibilityValue(config) {
    if (!config || config.showBtn !== true) {
      return 'always';
    }
    const normalizedDuration = Number.isFinite(config.duration) ? config.duration : 1;
    const clampedDuration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, normalizedDuration));
    return String(clampedDuration);
  }
  function updateVisibilityControlValue() {
    if (!cfgVisibility) return;
    const activeCfg = CFG.type === 'monster'
      ? CFG.monster
      : CFG.type === 'rectangles'
      ? CFG.rectangles
      : CFG.type === 'figurer'
      ? CFG.figures
      : CFG.klosser;
    cfgVisibility.value = resolveVisibilityValue(activeCfg);
  }
  function syncControlsToCfg() {
    sanitizeCfg();
    if (cfgType) cfgType.value = CFG.type;
    if (cfgShowExpression) cfgShowExpression.checked = CFG.showExpression !== false;
    if (cfgAntallX) cfgAntallX.value = CFG.klosser.antallX;
    if (cfgAntallY) cfgAntallY.value = CFG.klosser.antallY;
    if (cfgBredde) cfgBredde.value = CFG.klosser.bredde;
    if (cfgHoyde) cfgHoyde.value = CFG.klosser.hoyde;
    if (cfgDybde) cfgDybde.value = CFG.klosser.dybde;
    if (cfgMonsterAntallX) cfgMonsterAntallX.value = CFG.monster.antallX;
    if (cfgMonsterAntallY) cfgMonsterAntallY.value = CFG.monster.antallY;
    if (cfgAntall) cfgAntall.value = CFG.monster.antall;
    if (cfgMonsterCircleRadius) cfgMonsterCircleRadius.value = CFG.monster.circleRadius;
    if (cfgMonsterLevelScale) cfgMonsterLevelScale.value = CFG.monster.levelScale;
    if (cfgMonsterPatternGap) {
      cfgMonsterPatternGap.value = CFG.monster.patternGap;
      updateMonsterPatternGapState();
    }
    if (cfgRectAntallX) cfgRectAntallX.value = CFG.rectangles.antallX;
    if (cfgRectAntallY) cfgRectAntallY.value = CFG.rectangles.antallY;
    if (cfgRectCols) cfgRectCols.value = CFG.rectangles.cols;
    if (cfgRectRows) cfgRectRows.value = CFG.rectangles.rows;
    if (cfgRectRadius) cfgRectRadius.value = CFG.rectangles.radius;
    if (cfgRectSpacingX) cfgRectSpacingX.value = CFG.rectangles.spacingX;
    if (cfgRectSpacingY) cfgRectSpacingY.value = CFG.rectangles.spacingY;
    if (cfgRectPatternGap) {
      cfgRectPatternGap.value = CFG.rectangles.patternGap;
      updateRectanglesPatternGapState();
    }
    if (cfgFiguresAntallX) cfgFiguresAntallX.value = CFG.figures.antallX;
    if (cfgFiguresAntallY) cfgFiguresAntallY.value = CFG.figures.antallY;
    if (cfgFiguresPatternGap) {
      cfgFiguresPatternGap.value = CFG.figures.patternGap;
      updateFiguresPatternGapState();
    }
    updateFigurePickerControls();
    updateVisibilityControlValue();
  }
  function renderView() {
    sanitizeCfg();
    updateVisibilityControlValue();
    if (cfgAntallWrapper) {
      cfgAntallWrapper.style.display = CFG.type === 'monster' ? 'flex' : 'none';
    }
    if (CFG.type === 'klosser' || CFG.type === 'blocks') {
      if (klosserConfig) klosserConfig.style.display = 'block';
      if (monsterConfig) monsterConfig.style.display = 'none';
      if (rectangleConfig) rectangleConfig.style.display = 'none';
      if (figuresConfig) figuresConfig.style.display = 'none';
      renderKlosser();
      updateVisibilityKlosser();
    } else if (CFG.type === 'monster') {
      if (klosserConfig) klosserConfig.style.display = 'none';
      if (monsterConfig) monsterConfig.style.display = 'block';
      if (rectangleConfig) rectangleConfig.style.display = 'none';
      if (figuresConfig) figuresConfig.style.display = 'none';
      renderMonster();
      updateVisibilityMonster();
      updateMonsterPatternGapState();
    } else if (CFG.type === 'figurer') {
      if (klosserConfig) klosserConfig.style.display = 'none';
      if (monsterConfig) monsterConfig.style.display = 'none';
      if (rectangleConfig) rectangleConfig.style.display = 'none';
      if (figuresConfig) figuresConfig.style.display = 'block';
      updateFigurePickerControls();
      renderFigures();
      updateVisibilityFigures();
      updateFiguresPatternGapState();
    } else {
      if (klosserConfig) klosserConfig.style.display = 'none';
      if (monsterConfig) monsterConfig.style.display = 'none';
      if (rectangleConfig) rectangleConfig.style.display = 'block';
      if (figuresConfig) figuresConfig.style.display = 'none';
      renderRectangles();
      updateVisibilityRectangles();
      updateRectanglesPatternGapState();
    }
  }
  function render() {
    syncControlsToCfg();
    renderFillColorPicker();
    renderView();
  }
  window.render = render;
  function handleThemeProfileChange(event) {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    applyThemeToDocument();
    render();
    applyFillColorSelection(getFillPalette());
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', handleThemeProfileChange);
  }
  function bindNumberInput(input, targetGetter, key, min = 0) {
    if (!input) return;
    input.addEventListener('input', () => {
      const target = targetGetter();
      if (!target) return;
      const num = Number.parseInt(input.value, 10);
      if (Number.isFinite(num)) {
        target[key] = Math.max(min, Math.trunc(num));
        input.value = String(target[key]);
      }
      renderView();
    });
  }
  function bindFloatInput(input, targetGetter, key, min = 0, fallback = 0, max = Infinity) {
    if (!input) return;
    input.addEventListener('input', () => {
      const target = targetGetter();
      if (!target) return;
      const raw = input.value.trim();
      if (raw === '') {
        const normalizedFallback = Number.isFinite(fallback) ? fallback : min;
        const clampedFallback = Math.min(max, Math.max(min, normalizedFallback));
        target[key] = clampedFallback;
        input.value = String(target[key]);
        renderView();
        return;
      }
      const num = Number.parseFloat(raw);
      if (Number.isFinite(num)) {
        target[key] = Math.min(max, Math.max(min, num));
        input.value = String(target[key]);
      }
      renderView();
    });
  }
  sanitizeCfg();
  bindNumberInput(cfgAntallX, () => CFG.klosser, 'antallX', 0);
  bindNumberInput(cfgAntallY, () => CFG.klosser, 'antallY', 0);
  bindNumberInput(cfgBredde, () => CFG.klosser, 'bredde', 1);
  bindNumberInput(cfgHoyde, () => CFG.klosser, 'hoyde', 1);
  bindNumberInput(cfgDybde, () => CFG.klosser, 'dybde', 1);
  bindNumberInput(cfgMonsterAntallX, () => CFG.monster, 'antallX', 0);
  bindNumberInput(cfgMonsterAntallY, () => CFG.monster, 'antallY', 0);
  bindNumberInput(cfgAntall, () => CFG.monster, 'antall', 0);
  bindFloatInput(cfgMonsterCircleRadius, () => CFG.monster, 'circleRadius', MONSTER_POINT_RADIUS_MIN, DEFAULT_CFG.monster.circleRadius, MONSTER_POINT_RADIUS_MAX);
  bindFloatInput(cfgMonsterLevelScale, () => CFG.monster, 'levelScale', 0.1, DEFAULT_CFG.monster.levelScale);
  bindFloatInput(cfgMonsterPatternGap, () => CFG.monster, 'patternGap', 0, DEFAULT_CFG.monster.patternGap);
  bindNumberInput(cfgRectAntallX, () => CFG.rectangles, 'antallX', 0);
  bindNumberInput(cfgRectAntallY, () => CFG.rectangles, 'antallY', 0);
  bindNumberInput(cfgRectCols, () => CFG.rectangles, 'cols', 1);
  bindNumberInput(cfgRectRows, () => CFG.rectangles, 'rows', 1);
  bindFloatInput(cfgRectRadius, () => CFG.rectangles, 'radius', RECT_POINT_RADIUS_MIN, DEFAULT_CFG.rectangles.radius, RECT_POINT_RADIUS_MAX);
  bindFloatInput(cfgRectSpacingX, () => CFG.rectangles, 'spacingX', RECT_POINT_SPACING_MIN, DEFAULT_CFG.rectangles.spacingX, RECT_POINT_SPACING_MAX);
  bindFloatInput(cfgRectSpacingY, () => CFG.rectangles, 'spacingY', RECT_POINT_SPACING_MIN, DEFAULT_CFG.rectangles.spacingY, RECT_POINT_SPACING_MAX);
  bindFloatInput(cfgRectPatternGap, () => CFG.rectangles, 'patternGap', 0, DEFAULT_CFG.rectangles.patternGap);
  bindNumberInput(cfgFiguresAntallX, () => CFG.figures, 'antallX', 0);
  bindNumberInput(cfgFiguresAntallY, () => CFG.figures, 'antallY', 0);
  bindFloatInput(cfgFiguresPatternGap, () => CFG.figures, 'patternGap', 0, DEFAULT_CFG.figures.patternGap);
  cfgFiguresCategory === null || cfgFiguresCategory === void 0 || cfgFiguresCategory.addEventListener('change', () => {
    if (!CFG.figures) return;
    CFG.figures.categoryId = cfgFiguresCategory.value;
    if (figurePicker) {
      const result = figurePicker.renderFigureSelect(cfgFiguresFigure, CFG.figures.categoryId, CFG.figures.figureValue, {
        placeholderLabel: 'Velg figur',
        disableWhenEmpty: true
      });
      CFG.figures.figureValue = result.selectedValue;
      if (result.match && result.match.figure) {
        CFG.figures.figureLabel =
          figurePicker.buildFigureOptionLabel(result.match.figure) ||
          result.match.label ||
          result.match.value ||
          '';
      }
    }
    renderView();
  });
  cfgFiguresFigure === null || cfgFiguresFigure === void 0 || cfgFiguresFigure.addEventListener('change', () => {
    if (!CFG.figures) return;
    CFG.figures.figureValue = cfgFiguresFigure.value;
    if (figurePicker) {
      CFG.figures.categoryId = figurePicker.resolveCategoryId(cfgFiguresCategory.value, CFG.figures.figureValue);
      const match = figurePicker.findOptionByValue(CFG.figures.figureValue);
      if (match && match.figure) {
        CFG.figures.figureLabel =
          figurePicker.buildFigureOptionLabel(match.figure) ||
          match.label ||
          match.value ||
          '';
      }
    }
    renderView();
  });
  if (cfgVisibility) {
    cfgVisibility.addEventListener('change', () => {
      const target = CFG.type === 'monster'
        ? CFG.monster
        : CFG.type === 'rectangles'
        ? CFG.rectangles
        : CFG.type === 'figurer'
        ? CFG.figures
        : CFG.klosser;
      if (!target) return;
      const value = cfgVisibility.value;
      if (value === 'always') {
        target.showBtn = false;
      } else {
        const num = Number.parseInt(value, 10);
        if (Number.isFinite(num)) {
          target.showBtn = true;
          target.duration = Math.min(MAX_VISIBILITY_DURATION, Math.max(1, num));
        } else {
          target.showBtn = false;
        }
      }
      renderView();
    });
  }
  cfgType === null || cfgType === void 0 || cfgType.addEventListener('change', () => {
    CFG.type = ['monster', 'rectangles', 'blocks', 'figurer'].includes(cfgType.value) ? cfgType.value : 'klosser';
    cfgType.value = CFG.type;
    renderView();
  });
  cfgShowExpression === null || cfgShowExpression === void 0 || cfgShowExpression.addEventListener('change', () => {
    CFG.showExpression = !!cfgShowExpression.checked;
    applyExpressionVisibility();
  });
  playBtn.addEventListener('click', () => {
    sanitizeCfg();
    if (CFG.type === 'klosser' || CFG.type === 'blocks') {
      const duration = Math.max(0, Number.isFinite(CFG.klosser.duration) ? CFG.klosser.duration : 0);
      renderKlosser();
      playBtn.style.display = 'none';
      brickContainer.style.display = 'grid';
      applyExpressionVisibility();
      setTimeout(() => {
        updateVisibilityKlosser();
      }, duration * 1000);
    } else if (CFG.type === 'monster') {
      const duration = Math.max(0, Number.isFinite(CFG.monster.duration) ? CFG.monster.duration : 0);
      renderMonster();
      playBtn.style.display = 'none';
      patternContainer.style.display = 'grid';
      applyExpressionVisibility();
      setTimeout(() => {
        updateVisibilityMonster();
      }, duration * 1000);
    } else if (CFG.type === 'figurer') {
      const duration = Math.max(0, Number.isFinite(CFG.figures.duration) ? CFG.figures.duration : 0);
      renderFigures();
      playBtn.style.display = 'none';
      patternContainer.style.display = 'grid';
      applyExpressionVisibility();
      setTimeout(() => {
        updateVisibilityFigures();
      }, duration * 1000);
    } else {
      const duration = Math.max(0, Number.isFinite(CFG.rectangles.duration) ? CFG.rectangles.duration : 0);
      renderRectangles();
      playBtn.style.display = 'none';
      if (rectangleContainer) rectangleContainer.style.display = 'grid';
      applyExpressionVisibility();
      setTimeout(() => {
        updateVisibilityRectangles();
      }, duration * 1000);
    }
  });
  function getActiveSvg() {
    if (CFG.type === 'klosser' || CFG.type === 'blocks') return brickContainer.querySelector('svg');
    if (CFG.type === 'monster') return patternContainer.querySelector('svg');
    if (CFG.type === 'figurer') return patternContainer.querySelector('svg');
    if (CFG.type === 'rectangles') return rectangleContainer ? rectangleContainer.querySelector('svg') : null;
    return brickContainer.querySelector('svg') || patternContainer.querySelector('svg') || (rectangleContainer ? rectangleContainer.querySelector('svg') : null);
  }
  btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => {
    const svg = getActiveSvg();
    if (svg) {
      const fileName = CFG.type === 'monster'
        ? 'numbervisuals.svg'
        : CFG.type === 'rectangles'
        ? 'rektangler.svg'
        : CFG.type === 'figurer'
        ? 'figurer.svg'
        : 'kvikkbilder.svg';
      downloadSVG(svg, fileName);
    }
  });
  btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => {
    const svg = getActiveSvg();
    if (svg) {
      const fileName = CFG.type === 'monster'
        ? 'numbervisuals.png'
        : CFG.type === 'rectangles'
        ? 'rektangler.png'
        : CFG.type === 'figurer'
        ? 'figurer.png'
        : 'kvikkbilder.png';
      downloadPNG(svg, fileName, 2);
    }
  });
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
  function collectKvikkbilderSummary() {
    const type = typeof CFG.type === 'string' ? CFG.type : 'klosser';
    if (type === 'monster') {
      const m = CFG.monster || {};
      return {
        type,
        antallX: Number(m.antallX),
        antallY: Number(m.antallY),
        antall: Number(m.antall)
      };
    }
    if (type === 'figurer') {
      const f = CFG.figures || {};
      return {
        type,
        antallX: Number(f.antallX),
        antallY: Number(f.antallY),
        figureValue: typeof f.figureValue === 'string' ? f.figureValue : ''
      };
    }
    if (type === 'rectangles') {
      const r = CFG.rectangles || {};
      return {
        type,
        antallX: Number(r.antallX),
        antallY: Number(r.antallY),
        figCols: Number(r.cols),
        figRows: Number(r.rows)
      };
    }
    const brickType = type === 'blocks' ? 'blocks' : 'klosser';
    const k = CFG.klosser || {};
    return {
      type: brickType,
      antallX: Number(k.antallX),
      antallY: Number(k.antallY),
      bredde: Number(k.bredde),
      hoyde: Number(k.hoyde),
      dybde: Number(k.dybde)
    };
  }
  function buildKvikkbilderExportMeta() {
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const summary = collectKvikkbilderSummary();
    const type = summary.type || 'klosser';
    const description = buildAltTextForType(type) || `Kvikkbilder (${type}).`;
    const slugParts = ['kvikkbilder', type];
    if (Number.isFinite(summary.antallX) && Number.isFinite(summary.antallY)) {
      slugParts.push(`${summary.antallX}x${summary.antallY}`);
    }
    const slugBase = slugParts.join(' ');
    const slug = helper && typeof helper.slugify === 'function' ? helper.slugify(slugBase, 'kvikkbilder') : slugParts.join('-').toLowerCase();
    return {
      description,
      slug,
      defaultBaseName: slug || 'kvikkbilder',
      summary
    };
  }
  async function downloadSVG(svgEl, filename) {
    const suggestedName = typeof filename === 'string' && filename ? filename : 'kvikkbilder.svg';
    const data = svgToString(svgEl);
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const meta = buildKvikkbilderExportMeta();
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      await helper.exportSvgWithArchive(svgEl, suggestedName, 'kvikkbilder', {
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
    a.download = suggestedName.endsWith('.svg') ? suggestedName : suggestedName + '.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
    var _svgEl$viewBox;
    const vb = (_svgEl$viewBox = svgEl.viewBox) === null || _svgEl$viewBox === void 0 ? void 0 : _svgEl$viewBox.baseVal;
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
      canvas.toBlob(blob => {
        const urlPng = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlPng;
        a.download = filename.endsWith('.png') ? filename : filename + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
      }, 'image/png');
    };
    img.src = url;
  }
  render();
  initAltTextManager();
  let kvikkbilderPalette = buildBrickPalette(getKvikkbilderBaseColor());
  kvikkbilderPalette = syncBrickPaletteFromFill(getFillPalette());
  function loadBrickAndBlockAssets(paletteOverride, assets = {}) {
    if (assets && typeof assets === 'object') {
      if (typeof assets.brickSrc === 'string') {
        BRICK_SRC = assets.brickSrc;
      }
      if (typeof assets.blockSrc === 'string') {
        BLOCK_SRC = assets.blockSrc;
      }
    }
    const activePalette = paletteOverride && typeof paletteOverride === 'object' ? paletteOverride : kvikkbilderPalette;
    const updateAssets = () => {
      if (RAW_BRICK_SVG) {
        const svg = applyBrickPalette(RAW_BRICK_SVG, activePalette);
        BRICK_SRC = `data:image/svg+xml;base64,${btoa(svg)}`;
      }
      if (RAW_BLOCK_SVG) {
        const svg = applyBrickPalette(RAW_BLOCK_SVG, activePalette);
        BLOCK_SRC = `data:image/svg+xml;base64,${btoa(svg)}`;
      }
      return true;
    };
    if (RAW_BRICK_SVG && RAW_BLOCK_SVG) {
      updateAssets();
      return Promise.resolve(true);
    }
    return Promise.allSettled([
      fetch('images/brick1.svg').then(r => r.text()).then(txt => {
        RAW_BRICK_SVG = txt;
      }),
      fetch('images/block1.svg').then(r => r.text()).then(txt => {
        RAW_BLOCK_SVG = txt;
      })
    ]).then(() => updateAssets());
  }
  function createCleanState() {
    sanitizeCfg();
    const state = {
      v: 1,
      cfg: deepClone(CFG),
      palette: deepClone(kvikkbilderPalette)
    };
    if (typeof BRICK_SRC === 'string' && BRICK_SRC) {
      state.brickSrc = BRICK_SRC;
    }
    if (typeof BLOCK_SRC === 'string' && BLOCK_SRC) {
      state.blockSrc = BLOCK_SRC;
    }
    return state;
  }
  function loadCleanState(cleanState) {
    if (!cleanState || typeof cleanState !== 'object') return false;
    if (cleanState.v && cleanState.v !== 1) return false;
    const cfgFromState = deepClone(cleanState.cfg) || {};
    const mergedCfg = createExampleCfg(cfgFromState);
    if (typeof cfgFromState.altText === 'string') {
      mergedCfg.altText = cfgFromState.altText;
    }
    if (cfgFromState.altTextSource === 'manual') {
      mergedCfg.altTextSource = 'manual';
    }
    Object.keys(CFG).forEach(key => delete CFG[key]);
    Object.assign(CFG, mergedCfg);
    sanitizeCfg();
    if (cleanState.palette && typeof cleanState.palette === 'object') {
      kvikkbilderPalette = { ...DEFAULT_BRICK_PALETTE, ...cleanState.palette };
    } else {
      kvikkbilderPalette = syncBrickPaletteFromFill(getFillPalette());
    }
    render();
    return loadBrickAndBlockAssets(kvikkbilderPalette, cleanState).then(() => {
      renderView();
      return true;
    });
  }
  window.kvikkbilderApi = {
    createCleanState,
    loadCleanState
  };
  loadFigureLibrary();
  loadBrickAndBlockAssets(kvikkbilderPalette).then(() => {
    renderView();
  });
})();
