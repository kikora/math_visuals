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

(function () {
  const boxes = [];
  let taskStudentCells = null;
  let isReadOnlyPreview = false;
  let altTextManager = null;
  let altTextRefreshTimer = null;
  let lastAltTextSignature = null;
  let figurtallAiAbortController = null;
  let figurtallAiPendingSignature = null;
  let figurtallAiAppliedSignature = null;
  let pendingAltTextReason = 'auto';
  const MAX_DIM = 20;
    const MAX_COLORS = 6;
    const LABEL_MODES = ['hidden', 'count', 'custom'];
    const FIGURE_TYPES = ['square', 'square-outline', 'circle', 'circle-outline', 'star'];
    const FILL_COLOR_COUNT = 6;
    const STATE = typeof window.STATE === 'object' && window.STATE ? window.STATE : {};
    window.STATE = STATE;
    const colorPickerHelper = getColorPickerHelper();
    const colorPickerModule = getColorPickerModule();
    const fillColorPickerInstances = new WeakMap();
    let isSyncingTheme = false;
    let themeObserver = null;
    let rows = 3;
  let cols = 3;
  const colorCountInp = document.getElementById('colorCount');
  const fillColorPicker = document.querySelector('[data-fill-color-picker]');
  const colorInputs = [];
  for (let i = 1; i < 100; i++) {
    const inp = document.getElementById('color_' + i);
    if (!inp) break;
    colorInputs.push(inp);
  }
  const LEGACY_COLOR_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#E3B660', '#2C395B'];
  const SHARED_GROUP_ID = 'fellesfarger';
  const DEFAULT_GRAFTEGNER_COLOR_ROLES = [
    { fillIndex: 0, lineIndex: 1 },
    { fillIndex: 3, lineIndex: 4 },
    { fillIndex: 6, lineIndex: 7 },
    { fillIndex: 9, lineIndex: 10 },
    { fillIndex: 12, lineIndex: 13 },
    { fillIndex: 15, lineIndex: 16 }
  ];
  let activeFillColorIndex = sanitizeFillIndex(STATE.activeFillColorIndex, FILL_COLOR_COUNT);
  STATE.activeFillColorIndex = activeFillColorIndex;
  function getThemeApi() {
    const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
    return theme && typeof theme === 'object' ? theme : null;
  }
  function getSettingsApi() {
    const settings = typeof window !== 'undefined' ? window.MathVisualsSettings : null;
    return settings && typeof settings === 'object' ? settings : null;
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
  let paletteConfigResolved = false;
  let paletteConfigCache = null;
  function getPaletteConfig() {
    if (!paletteConfigResolved) {
      paletteConfigResolved = true;
      paletteConfigCache = resolvePaletteConfig();
    }
    return paletteConfigCache;
  }
  function resetPaletteConfigCache() {
    paletteConfigResolved = false;
    paletteConfigCache = null;
  }
  function applyThemeToDocument() {
    const theme = getThemeApi();
    if (theme && typeof theme.applyToDocument === 'function') {
      theme.applyToDocument(document);
    }
  }
  applyThemeToDocument();
  function normalizePaletteToCount(palette, count, fallback = []) {
    const target = Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
    const fallbackPalette = Array.isArray(fallback) ? fallback.slice() : [];
    let base = Array.isArray(palette) && palette.length ? palette.slice() : fallbackPalette.slice();
    if (target > 0 && base.length < target && fallbackPalette.length >= target) {
      base = fallbackPalette.slice();
    }
    if (target <= 0) return base.slice();
    if (!base.length) return [];
    if (base.length >= target) return base.slice(0, target);
    const result = base.slice();
    for (let i = base.length; i < target; i++) {
      result.push(base[i % base.length]);
    }
    return result;
  }
  function getPaletteFromTheme(count) {
    const settings = getSettingsApi();
    const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
    const settingsSnapshot =
      settings && typeof settings.getSettings === 'function'
        ? settings.getSettings()
        : settings || undefined;
    const resolver = getPaletteResolver();
    const palette = resolver
      ? resolver.resolveGroupPalette({
        groupId: SHARED_GROUP_ID,
        count: targetCount,
        settings: settingsSnapshot,
        fallback: LEGACY_COLOR_PALETTE,
        legacyPaletteId: 'figures'
      })
      : [];
    return normalizePaletteToCount(palette, targetCount, LEGACY_COLOR_PALETTE);
  }
  function getFillPalette() {
    const roleSlots = getGraftegnerRoleSlotPairs();
    const fillIndices = roleSlots
      .map(role => (Number.isInteger(role?.fillIndex) ? role.fillIndex : role?.fillSlotIndex))
      .filter(index => Number.isInteger(index) && index >= 0);
    const targetCount = fillIndices.length ? Math.max(...fillIndices) + 1 : FILL_COLOR_COUNT;
    const palette = getPaletteFromTheme(targetCount);
    if (!Array.isArray(palette)) return [];
    if (!fillIndices.length) {
      return palette.slice(0, FILL_COLOR_COUNT);
    }
    return fillIndices.map(index => palette[index]).filter(isValidColor).slice(0, FILL_COLOR_COUNT);
  }
  function sanitizeFillIndex(value, paletteLength) {
    const numeric = Number.parseInt(value, 10);
    const max = Number.isFinite(paletteLength) && paletteLength > 0 ? paletteLength : FILL_COLOR_COUNT;
    if (!Number.isFinite(numeric) || numeric < 1) return 1;
    return Math.min(numeric, max);
  }
  function applyPairSwatch(element, color) {
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
  }
  function getGraftegnerRoleSlotPairs() {
    const config = getPaletteConfig();
    if (colorPickerHelper && typeof colorPickerHelper.resolveRoleSlotPairs === 'function') {
      return colorPickerHelper.resolveRoleSlotPairs(config, SHARED_GROUP_ID, DEFAULT_GRAFTEGNER_COLOR_ROLES, 'fill');
    }
    const pairs = [];
    for (let index = 0; index < FILL_COLOR_COUNT; index += 1) {
      pairs.push({
        fillSlotIndex: index * 3
      });
    }
    return pairs;
  }
  function buildFillColorSlots(colors) {
    return colors.map((color, index) => ({
      value: index + 1,
      label: `Velg farge ${index + 1}`,
      color
    }));
  }
  function renderFillColorPicker() {
    if (!fillColorPicker || !colorPickerModule || typeof colorPickerModule.createColorPicker !== 'function') {
      return;
    }
    const colors = getFillPalette();
    const slots = buildFillColorSlots(colors);
    const renderStyle = ({ element, slot }) => {
      applyPairSwatch(element, slot.color);
    };
    const onSelect = value => {
      activeFillColorIndex = sanitizeFillIndex(value, colors.length);
      STATE.activeFillColorIndex = activeFillColorIndex;
    };
    const instance = fillColorPickerInstances.get(fillColorPicker);
    if (instance) {
      instance.update({
        slots,
        renderStyle,
        onSelect,
        getActiveValue: () => sanitizeFillIndex(activeFillColorIndex, colors.length)
      });
      return;
    }
    const pickerInstance = colorPickerModule.createColorPicker({
      element: fillColorPicker,
      slots,
      renderStyle,
      onSelect,
      getActiveValue: () => sanitizeFillIndex(activeFillColorIndex, colors.length)
    });
    if (pickerInstance) {
      fillColorPickerInstances.set(fillColorPicker, pickerInstance);
    }
  }
  function getDefaultColorForIndex(index) {
    if (!Number.isFinite(index) || index < 0) return LEGACY_COLOR_PALETTE[0];
    const palette = getPaletteFromTheme(index + 1);
    if (Array.isArray(palette) && palette[index]) return palette[index];
    return LEGACY_COLOR_PALETTE[index % LEGACY_COLOR_PALETTE.length];
  }
  const modifiedColorIndexes = new Set();
  if (Array.isArray(STATE.colors)) {
    STATE.colors.forEach((color, idx) => {
      if (typeof color === 'string' && color) modifiedColorIndexes.add(idx);
    });
  }
  let autoPaletteEnabled = modifiedColorIndexes.size === 0;
  function normalizeLabelMode(value) {
    if (typeof value !== 'string') return 'custom';
    const normalized = value.toLowerCase();
    if (normalized === 'numbered') return 'count';
    return LABEL_MODES.includes(normalized) ? normalized : 'custom';
  }
  function normalizeFigureType(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.toLowerCase();
    const alias = {
      square: 'square',
      squares: 'square',
      kvadrat: 'square-outline',
      kvadrater: 'square-outline',
      'filled-squares': 'square',
      'filled square': 'square',
      'filled squares': 'square',
      fylte: 'square',
      'fylte kvadrater': 'square',
      'hule kvadrater': 'square-outline',
      'outline-square': 'square-outline',
      'outline-squares': 'square-outline',
      circle: 'circle',
      circles: 'circle',
      'filled circle': 'circle',
      'filled circles': 'circle',
      'fylte sirkel': 'circle',
      'fylte sirkler': 'circle',
      sirkel: 'circle-outline',
      sirkler: 'circle-outline',
      'outline-circle': 'circle-outline',
      'outline-circles': 'circle-outline',
      line: 'square-outline',
      lines: 'square-outline',
      linje: 'square-outline',
      linjer: 'square-outline',
      star: 'star',
      stars: 'star',
      stjerne: 'star',
      stjerner: 'star'
    };
    if (FIGURE_TYPES.includes(normalized)) return normalized;
    if (alias[normalized]) return alias[normalized];
    return null;
  }
  function isCircleFigureType(value) {
    const normalized = normalizeFigureType(value);
    return normalized === 'circle' || normalized === 'circle-outline';
  }
  function figureTypeToShapeKey(value) {
    const normalized = normalizeFigureType(value);
    if (normalized === 'circle' || normalized === 'circle-outline') return 'circle';
    if (normalized === 'star') return 'star';
    return 'square';
  }
  function clampInt(value, min, max) {
    const num = parseInt(value, 10);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, num));
  }
  function normalizeCells(cells, rowCount, colCount) {
    const matrix = Array.from({
      length: rowCount
    }, () => Array(colCount).fill(0));
    if (!Array.isArray(cells)) return matrix;
    for (let r = 0; r < rowCount; r++) {
      const row = Array.isArray(cells[r]) ? cells[r] : [];
      for (let c = 0; c < colCount; c++) {
        const val = parseInt(row[c], 10);
        matrix[r][c] = Number.isFinite(val) && val > 0 ? val : 0;
      }
    }
    return matrix;
  }
  function getLastFigureIndex() {
    if (!Array.isArray(STATE.figures)) return -1;
    return STATE.figures.length - 1;
  }
  function isTaskModeActive() {
    return isReadOnlyPreview;
  }
  function isStudentFigureIndex(index) {
    return STATE.lastFigureIsAnswer && isTaskModeActive() && index === getLastFigureIndex();
  }
  function ensureTaskStudentCells(preserveExisting = true) {
    if (!STATE.lastFigureIsAnswer) {
      taskStudentCells = null;
      return null;
    }
    const rowCount = rows;
    const colCount = cols;
    const prev = Array.isArray(taskStudentCells) ? taskStudentCells : null;
    let needsReset = !prev || prev.length !== rowCount;
    if (!needsReset && prev) {
      for (let r = 0; r < rowCount; r++) {
        if (!Array.isArray(prev[r]) || prev[r].length !== colCount) {
          needsReset = true;
          break;
        }
      }
    }
    if (needsReset) {
      const next = Array.from({ length: rowCount }, () => Array(colCount).fill(0));
      if (preserveExisting && prev) {
        const minRows = Math.min(prev.length, rowCount);
        for (let r = 0; r < minRows; r++) {
          const srcRow = Array.isArray(prev[r]) ? prev[r] : [];
          const minCols = Math.min(srcRow.length, colCount);
          for (let c = 0; c < minCols; c++) {
            const val = parseInt(srcRow[c], 10);
            next[r][c] = Number.isFinite(val) && val > 0 ? val : 0;
          }
        }
      }
      taskStudentCells = next;
    }
    const matrix = taskStudentCells;
    if (!Array.isArray(matrix)) return null;
    const maxIndex = Math.max(0, Math.trunc(STATE.colorCount));
    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) {
        matrix[r] = Array(colCount).fill(0);
        continue;
      }
      for (let c = 0; c < row.length; c++) {
        const val = parseInt(row[c], 10);
        row[c] = Number.isFinite(val) && val > 0 && val <= maxIndex ? val : 0;
      }
    }
    return matrix;
  }
  function resetTaskStudentCells() {
    taskStudentCells = null;
  }
  function getSolutionCellValue(figIndex, r, c) {
    const fig = Array.isArray(STATE.figures) ? STATE.figures[figIndex] : null;
    if (!fig || !Array.isArray(fig.cells)) return 0;
    const row = Array.isArray(fig.cells[r]) ? fig.cells[r] : [];
    const val = parseInt(row[c], 10);
    return Number.isFinite(val) && val > 0 ? val : 0;
  }
  function getDisplayCellValue(figIndex, r, c) {
    if (isStudentFigureIndex(figIndex)) {
      const matrix = ensureTaskStudentCells(true);
      const row = matrix && Array.isArray(matrix[r]) ? matrix[r] : null;
      const val = row ? parseInt(row[c], 10) : 0;
      return Number.isFinite(val) && val > 0 ? val : 0;
    }
    return getSolutionCellValue(figIndex, r, c);
  }
  function ensureColors(count) {
    const required = Math.max(count, FILL_COLOR_COUNT);
    const palette = getPaletteFromTheme(required);
    if (!Array.isArray(STATE.colors)) STATE.colors = [];
    if (autoPaletteEnabled) {
      STATE.colors = palette.slice(0, required);
    }
    for (let i = 0; i < required; i++) {
      const defaultColor = palette[i] || getDefaultColorForIndex(i);
      const hasColor = typeof STATE.colors[i] === 'string' && STATE.colors[i];
      const shouldUseDefault = autoPaletteEnabled || !modifiedColorIndexes.has(i);
      if (shouldUseDefault || !hasColor) {
        STATE.colors[i] = defaultColor;
      }
      if (typeof STATE.colors[i] !== 'string' || !STATE.colors[i]) {
        STATE.colors[i] = defaultColor || LEGACY_COLOR_PALETTE[i % LEGACY_COLOR_PALETTE.length];
      }
    }
    if (STATE.colors.length > required) STATE.colors.length = required;
  }
  function createFigureState(name, rowCount, colCount, coords) {
    var _STATE$figures;
    const label = typeof name === 'string' && name.trim() ? name : `Figur ${(_STATE$figures = STATE.figures) !== null && _STATE$figures !== void 0 && _STATE$figures.length ? STATE.figures.length + 1 : 1}`;
    const cells = normalizeCells([], rowCount, colCount);
    (coords || []).forEach(coord => {
      if (!Array.isArray(coord)) return;
      const [r, c, colorIdx = 1] = coord;
      if (r >= 0 && r < rowCount && c >= 0 && c < colCount) {
        const idx = parseInt(colorIdx, 10);
        cells[r][c] = Number.isFinite(idx) && idx > 0 ? idx : 1;
      }
    });
    return {
      name: label,
      cells
    };
  }
  function sanitizeState() {
    var _STATE$rows, _STATE$cols, _STATE$colorCount;
    rows = clampInt((_STATE$rows = STATE.rows) !== null && _STATE$rows !== void 0 ? _STATE$rows : rows, 1, MAX_DIM);
    cols = clampInt((_STATE$cols = STATE.cols) !== null && _STATE$cols !== void 0 ? _STATE$cols : cols, 1, MAX_DIM);
    STATE.rows = rows;
    STATE.cols = cols;
    let figureType = normalizeFigureType(STATE.figureType);
    if (!figureType) {
      if (STATE.circleMode === true) {
        figureType = 'circle';
      } else if (STATE.circleMode === false) {
        figureType = 'square';
      } else {
        figureType = 'square';
      }
    }
    STATE.figureType = figureType;
    STATE.circleMode = isCircleFigureType(figureType);
    STATE.offset = STATE.offset !== false;
    STATE.showGrid = STATE.showGrid !== false;
    STATE.gridOnlyOnLast = STATE.gridOnlyOnLast === true;
    STATE.lastFigureIsAnswer = STATE.lastFigureIsAnswer === true;
    if (!STATE.lastFigureIsAnswer) {
      taskStudentCells = null;
    }
    const inferredMode = typeof STATE.labelMode === 'string' ? STATE.labelMode : STATE.showFigureText === false ? 'hidden' : 'custom';
    STATE.labelMode = normalizeLabelMode(inferredMode);
    STATE.showFigureText = STATE.labelMode !== 'hidden';
    STATE.colorCount = clampInt(
      (_STATE$colorCount = STATE.colorCount) !== null && _STATE$colorCount !== void 0 ? _STATE$colorCount : colorCountInp ? colorCountInp.value : FILL_COLOR_COUNT,
      1,
      FILL_COLOR_COUNT
    );
    STATE.colorCount = FILL_COLOR_COUNT;
    ensureColors(STATE.colorCount);
    if (typeof STATE.altText !== 'string') STATE.altText = '';
    STATE.altTextSource = STATE.altTextSource === 'manual' ? 'manual' : 'auto';
    if (typeof STATE.answerText === 'number') {
      STATE.answerText = Number.isFinite(STATE.answerText) ? String(STATE.answerText) : '';
    } else if (typeof STATE.answerText !== 'string') {
      STATE.answerText = '';
    }
    if (!Array.isArray(STATE.figures)) STATE.figures = [];
    if (STATE.figures.length === 0) {
      STATE.figures = [createFigureState('Figur 1', rows, cols, [[0, 1]]), createFigureState('Figur 2', rows, cols, [[0, 1], [1, 0], [1, 1]]), createFigureState('Figur 3', rows, cols, [[0, 1], [1, 0], [1, 1], [2, 0], [2, 1], [2, 2]])];
    } else {
      STATE.figures = STATE.figures.map((fig, idx) => {
        const name = typeof (fig === null || fig === void 0 ? void 0 : fig.name) === 'string' && fig.name.trim() ? fig.name : `Figur ${idx + 1}`;
        return {
          name,
          cells: normalizeCells(fig === null || fig === void 0 ? void 0 : fig.cells, rows, cols)
        };
      });
    }
    if (STATE.lastFigureIsAnswer) {
      ensureTaskStudentCells(true);
    }
    activeFillColorIndex = sanitizeFillIndex(STATE.activeFillColorIndex, FILL_COLOR_COUNT);
    STATE.activeFillColorIndex = activeFillColorIndex;
  }
  function getColors() {
    ensureColors(STATE.colorCount);
    return STATE.colors.slice(0, STATE.colorCount);
  }
  function getFigureLabel(index) {
    const mode = STATE.labelMode;
    if (mode === 'hidden') return '';
    if (mode === 'count') {
      const fig = STATE.figures[index];
      return String(getFilledCellCount(fig));
    }
    const fig = STATE.figures[index];
    if (!fig) return '';
    const name = typeof fig.name === 'string' ? fig.name.trim() : '';
    return name;
  }

  function getFilledCellCount(fig) {
    if (!fig || !Array.isArray(fig.cells)) return 0;
    return fig.cells.reduce((total, row) => {
      if (!Array.isArray(row)) return total;
      return total + row.reduce((rowTotal, val) => {
        const num = parseInt(val, 10);
        return rowTotal + (Number.isFinite(num) && num > 0 ? 1 : 0);
      }, 0);
    }, 0);
  }
  function countFilledCellsMatrix(matrix) {
    if (!Array.isArray(matrix)) return 0;
    let count = 0;
    for (let r = 0; r < matrix.length; r++) {
      const row = matrix[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = parseInt(row[c], 10);
        if (Number.isFinite(val) && val > 0) count++;
      }
    }
    return count;
  }
  function parseLocaleNumber(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
    if (!normalized) return null;
    const num = Number.parseFloat(normalized);
    return Number.isFinite(num) ? num : null;
  }
  function getAnswerExpectation() {
    const raw = typeof STATE.answerText === 'string' ? STATE.answerText.trim() : '';
    if (!raw) return null;
    const percentMatch = raw.match(/^(-?\d+(?:[.,]\d+)?)\s*%$/);
    if (percentMatch) {
      const value = parseLocaleNumber(percentMatch[1]);
      if (!Number.isFinite(value)) return null;
      const ratio = value / 100;
      if (!Number.isFinite(ratio) || ratio < 0) return null;
      return { type: 'ratio', value: ratio };
    }
    const fractionMatch = raw.match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)$/);
    if (fractionMatch) {
      const numerator = parseLocaleNumber(fractionMatch[1]);
      const denominator = parseLocaleNumber(fractionMatch[2]);
      if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
      const ratio = numerator / denominator;
      if (!Number.isFinite(ratio) || ratio < 0) return null;
      return { type: 'ratio', value: ratio };
    }
    const numberMatch = raw.match(/^(-?\d+(?:[.,]\d+)?)(?:\s*(?:stk|ruter|celler|kvadrater|brikker)?)?$/i);
    if (numberMatch) {
      const value = parseLocaleNumber(numberMatch[1]);
      if (!Number.isFinite(value)) return null;
      if (value >= 0 && value <= 1) {
        return { type: 'ratio', value };
      }
      const rounded = Math.round(value);
      if (Math.abs(value - rounded) <= 1e-4) {
        return { type: 'count', value: rounded };
      }
    }
    return null;
  }
  function evaluateStudentAnswerText(studentMatrix) {
    const expectation = getAnswerExpectation();
    if (!expectation) return null;
    const studentFilled = countFilledCellsMatrix(studentMatrix);
    if (expectation.type === 'count') {
      return studentFilled === expectation.value;
    }
    const totalCells = rows * cols;
    if (!Number.isFinite(totalCells) || totalCells <= 0) return null;
    const expectedFilled = expectation.value * totalCells;
    if (!Number.isFinite(expectedFilled)) return null;
    return Math.abs(studentFilled - expectedFilled) <= 0.5;
  }
  function lastFigureHasAuthorFill() {
    if (!STATE.lastFigureIsAnswer) return false;
    const lastIndex = getLastFigureIndex();
    if (lastIndex < 0) return false;
    const figures = Array.isArray(STATE.figures) ? STATE.figures : [];
    const fig = figures[lastIndex];
    return getFilledCellCount(fig) > 0;
  }
  function updateAnswerFieldState() {
    const shouldShow = !!STATE.lastFigureIsAnswer;
    const hasAuthorFill = shouldShow && lastFigureHasAuthorFill();
    if (answerTextContainer) {
      answerTextContainer.hidden = !shouldShow;
      answerTextContainer.classList.toggle('is-disabled', hasAuthorFill);
    }
    if (!shouldShow) return;
    const disabled = hasAuthorFill;
    if (answerTextInput) {
      answerTextInput.disabled = disabled;
      if (disabled) {
        answerTextInput.setAttribute('title', 'Feltet er deaktivert fordi siste figur er fargelagt.');
      } else {
        answerTextInput.removeAttribute('title');
      }
      const desired = typeof STATE.answerText === 'string' ? STATE.answerText : '';
      if (answerTextInput.value !== desired) {
        answerTextInput.value = desired;
      }
    }
  }
  function applyCellAppearance(cell, idx, colors) {
    const shape = normalizeFigureType(STATE.figureType) || 'square';
    const color = idx > 0 ? colors[idx - 1] || getDefaultColorForIndex(idx - 1) : '';
    const hasFill = !!color;
    cell.dataset.color = String(idx);
    cell.style.setProperty('--cell-fill', color || 'transparent');
    cell.classList.remove('circle', 'cell--square', 'cell--square-outline', 'cell--circle', 'cell--circle-outline', 'cell--star', 'cell--filled');
    cell.style.backgroundColor = '#fff';
    if (shape === 'circle') {
      cell.classList.add('cell--circle');
      if (hasFill) {
        cell.classList.add('cell--filled');
      }
    } else if (shape === 'circle-outline') {
      cell.classList.add('cell--circle-outline');
      if (hasFill) cell.classList.add('cell--filled');
    } else if (shape === 'star') {
      cell.classList.add('cell--star');
      cell.style.backgroundColor = '#fff';
      if (hasFill) cell.classList.add('cell--filled');
    } else if (shape === 'square-outline') {
      cell.classList.add('cell--square-outline');
      if (hasFill) cell.classList.add('cell--filled');
    } else {
      cell.classList.add('cell--square');
      if (hasFill) {
        cell.classList.add('cell--filled');
        cell.style.backgroundColor = color;
      } else {
        cell.style.backgroundColor = '#fff';
      }
    }
  }
  function updateCellColors() {
    const colors = getColors();
    const maxIndex = colors.length;
    if (STATE.lastFigureIsAnswer) ensureTaskStudentCells(true);
    container === null || container === void 0 || container.querySelectorAll('.cell').forEach(cell => {
      const figIndex = parseInt(cell.dataset.figIndex, 10);
      const r = parseInt(cell.dataset.row, 10);
      const c = parseInt(cell.dataset.col, 10);
      let idxVal = getDisplayCellValue(figIndex, r, c);
      if (idxVal > maxIndex) {
        idxVal = 0;
        if (isStudentFigureIndex(figIndex)) {
          const matrix = ensureTaskStudentCells(true);
          if (matrix && Array.isArray(matrix[r])) {
            matrix[r][c] = 0;
          }
        } else {
          const fig = Array.isArray(STATE.figures) ? STATE.figures[figIndex] : null;
          if (fig && Array.isArray(fig.cells) && Array.isArray(fig.cells[r])) {
            fig.cells[r][c] = 0;
          }
        }
      }
      cell.dataset.color = String(idxVal);
      applyCellAppearance(cell, idxVal, colors);
    });
    updateAnswerFieldState();
  }
  function updateColorVisibility() {
    const count = STATE.colorCount;
    ensureColors(count);
    colorInputs.forEach((inp, idx) => {
      if (idx < count) {
        inp.style.display = '';
        inp.value = STATE.colors[idx];
      } else {
        inp.style.display = 'none';
      }
    });
    updateCellColors();
  }
  function createGridForFigure(boxEl, index) {
    const fig = STATE.figures[index];
    boxEl.innerHTML = '';
    boxEl.style.setProperty('--cols', cols);
    boxEl.style.setProperty('--rows', rows);
    boxEl.style.setProperty('--aspect', cols / rows);
    boxEl.style.setProperty('--cellSize', 100 / cols + '%');
    boxEl.classList.toggle('hide-grid', !STATE.showGrid);
    for (let r = 0; r < rows; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'row';
      if (STATE.offset && r % 2 === 1) rowEl.classList.add('offset');
      for (let c = 0; c < cols; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        const idxVal = getDisplayCellValue(index, r, c);
        cell.dataset.color = String(idxVal);
        cell.dataset.figIndex = String(index);
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        cell.addEventListener('click', () => cycleCell(index, r, c, cell));
        rowEl.appendChild(cell);
      }
      boxEl.appendChild(rowEl);
    }
  }
  function createPanelForFigure(index) {
    const panel = document.createElement('div');
    panel.className = 'figurePanel';
    panel.dataset.index = String(index);
    panel.innerHTML = `
      <div class="figure"><div class="box"></div></div>
      <input class="nameInput" type="text" placeholder="Navn" />
    `;
    const nameDisplay = document.createElement('div');
    nameDisplay.className = 'nameDisplay';
    nameDisplay.setAttribute('aria-hidden', 'true');
    panel.appendChild(nameDisplay);
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'removeFigureBtn';
    removeBtn.setAttribute('data-edit-only', '');
    removeBtn.textContent = 'Fjern figur';
    panel.appendChild(removeBtn);
    return panel;
  }

  function bindFigurePanel(panel, index) {
    panel.dataset.index = String(index);
    const boxEl = panel.querySelector('.box');
    if (boxEl) {
      createGridForFigure(boxEl, index);
    }
    const nameInput = panel.querySelector('.nameInput');
    const fig = STATE.figures[index];
    const baseName = (fig === null || fig === void 0 ? void 0 : fig.name) || `Figur ${index + 1}`;
    if (nameInput) {
      if (document.activeElement !== nameInput) {
        nameInput.value = baseName;
      }
      nameInput.oninput = () => {
        STATE.figures[index].name = nameInput.value;
        scheduleAltTextRefresh('name');
      };
      if (typeof STATE.figures[index].name !== 'string' || !STATE.figures[index].name) {
        STATE.figures[index].name = nameInput.value || baseName;
      }
    }
    const removeBtn = panel.querySelector('.removeFigureBtn');
    if (removeBtn) {
      if (STATE.figures.length <= 1) {
        removeBtn.disabled = true;
        removeBtn.setAttribute('aria-disabled', 'true');
      } else {
        removeBtn.disabled = false;
        removeBtn.removeAttribute('aria-disabled');
      }
      removeBtn.setAttribute('aria-label', `Fjern figur ${index + 1}`);
      removeBtn.onclick = () => {
        removeFigure(index);
      };
    }
  }
  const container = document.getElementById('figureContainer');
  const addBtn = document.getElementById('addFigure');
  function rebuildFigurePanels() {
    if (!container) return;
    const existingPanels = Array.from(container.querySelectorAll('.figurePanel'));
    for (let i = STATE.figures.length; i < existingPanels.length; i++) {
      existingPanels[i].remove();
    }
    boxes.length = 0;
    STATE.figures.forEach((_, idx) => {
      let panel = existingPanels[idx];
      if (!panel || !container.contains(panel)) {
        panel = createPanelForFigure(idx);
        container.insertBefore(panel, addBtn);
      }
      bindFigurePanel(panel, idx);
      const boxEl = panel.querySelector('.box');
      if (boxEl) boxes.push(boxEl);
    });
    updateCellColors();
    updateGridVisibility();
    updateFigureLabelDisplay();
    updateFigureLayout();
  }
  const MIN_PANEL_WIDTH = 80;
  const MAX_PANEL_WIDTH = 260;
  function updateFigureLayout() {
    if (!container) return;
    const panelCount = container.querySelectorAll('.figurePanel').length + (addBtn ? 1 : 0);
    if (panelCount <= 0) return;
    const styles = getComputedStyle(container);
    const gapStr = styles.columnGap || styles.gap || '0';
    const gap = parseFloat(gapStr) || 0;
    const available = container.clientWidth;
    if (available <= 0) return;
    let computed = (available - gap * (panelCount - 1)) / panelCount;
    if (!Number.isFinite(computed)) return;
    if (computed > MAX_PANEL_WIDTH) computed = MAX_PANEL_WIDTH;
    if (computed < MIN_PANEL_WIDTH) computed = MIN_PANEL_WIDTH;
    container.style.setProperty('--panel-min', `${computed}px`);
  }
  window.addEventListener('resize', updateFigureLayout);
  function updateGridVisibility() {
    const showGrid = !!STATE.showGrid;
    const figures = Array.isArray(STATE.figures) ? STATE.figures : [];
    const limitToLast = showGrid && STATE.gridOnlyOnLast && figures.length > 0;
    const lastIndex = limitToLast ? figures.length - 1 : -1;
    boxes.forEach((box, idx) => {
      const shouldShow = showGrid && (!limitToLast || idx === lastIndex);
      box.classList.toggle('hide-grid', !shouldShow);
    });
  }
  function updateFigureLabelDisplay() {
    const mode = STATE.labelMode || 'custom';
    if (!container) return;
    container.querySelectorAll('.figurePanel').forEach((panel, idx) => {
      const input = panel.querySelector('.nameInput');
      const display = panel.querySelector('.nameDisplay');
      const label = getFigureLabel(idx);
      if (mode === 'hidden') {
        if (input) input.style.display = 'none';
        if (display) display.style.display = 'none';
        return;
      }
      if (mode === 'count') {
        if (input) input.style.display = 'none';
        if (display) {
          display.textContent = label || '';
          display.style.display = '';
        }
        return;
      }
      if (input) input.style.display = '';
      if (display) {
        display.textContent = label || '';
        display.style.display = 'none';
      }
    });
  }
  function cycleCell(figIndex, r, c, cell) {
    const colors = getColors();
    const targetIndex = sanitizeFillIndex(activeFillColorIndex, colors.length);
    if (isStudentFigureIndex(figIndex)) {
      const matrix = ensureTaskStudentCells(true);
      if (!matrix || !Array.isArray(matrix[r])) return;
      const row = matrix[r];
      const current = parseInt(row[c], 10) || 0;
      const next = current === targetIndex ? 0 : targetIndex;
      row[c] = next;
      cell.dataset.color = String(next);
      applyCellAppearance(cell, next, colors);
      updateFigureLabelDisplay();
      updateAnswerFieldState();
      updateTaskStatus('');
      return;
    }
    const fig = STATE.figures[figIndex];
    if (!fig || !Array.isArray(fig.cells) || !Array.isArray(fig.cells[r])) return;
    const current = parseInt(fig.cells[r][c], 10) || 0;
    const next = current === targetIndex ? 0 : targetIndex;
    fig.cells[r][c] = next;
    cell.dataset.color = String(next);
    applyCellAppearance(cell, next, colors);
    updateFigureLabelDisplay();
    updateAnswerFieldState();
    resetTaskStudentCells();
    scheduleAltTextRefresh('cells');
  }
  const rowsInput = document.getElementById('rowsInput');
  const colsInput = document.getElementById('colsInput');
  const figureTypeSelect = document.getElementById('figureTypeSelect');
  const showGridToggle = document.getElementById('showGridToggle');
  const gridLastFigureToggle = document.getElementById('gridLastFigureToggle');
  const offsetToggle = document.getElementById('offsetRowsToggle');
  const lastFigureAnswerToggle = document.getElementById('lastFigureAnswerToggle');
  const answerTextContainer = document.getElementById('answerTextContainer');
  const answerTextInput = document.getElementById('answerTextInput');
  const labelModeSelect = document.getElementById('labelModeSelect');
  const btnCheck = document.getElementById('btnCheck');
  const taskStatusEl = document.getElementById('taskStatus');
  const taskCheckHost = typeof document !== 'undefined' ? document.querySelector('[data-task-check-host]') : null;
  const taskCheckControls = [btnCheck, taskStatusEl].filter(Boolean);

  const TASK_APP_ID = 'figurtall';
  function getTaskApi() {
    if (typeof window === 'undefined') return null;
    return window.MathVisualsTaskApi || null;
  }
  function runTaskCheck() {
    if (!STATE.lastFigureIsAnswer) {
      updateTaskStatus('Ingen fasit tilgjengelig.', 'info');
      return;
    }
    const result = evaluateStudentAnswer();
    if (result == null) {
      updateTaskStatus('Ingen fasit tilgjengelig.', 'info');
      return;
    }
    updateTaskStatus(result ? 'Riktig!' : 'Prøv igjen.', result ? 'success' : 'error');
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
  function ensureTaskControlsHost() {
    if (!taskCheckHost) return;
    taskCheckControls.forEach(control => {
      if (control && control.parentElement !== taskCheckHost) {
        taskCheckHost.appendChild(control);
      }
    });
  }
  function updateTaskStatus(message, type = 'info') {
    if (!taskStatusEl) return;
    const text = typeof message === 'string' ? message : '';
    const normalizedType = type === 'success' ? 'success' : type === 'error' ? 'error' : 'info';
    taskStatusEl.textContent = text;
    taskStatusEl.className = `status status--${normalizedType}`;
    taskStatusEl.hidden = !text;
  }
  function applyReadOnlyPreviewControls() {
    if (!taskCheckHost) return;
    const shouldShow = isReadOnlyPreview && STATE.lastFigureIsAnswer;
    if (shouldShow) {
      ensureTaskControlsHost();
      taskCheckHost.hidden = false;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control === btnCheck) {
          control.hidden = false;
          if (control.dataset) delete control.dataset.prevHidden;
          return;
        }
        if (control.dataset && 'prevHidden' in control.dataset) {
          const wasHidden = control.dataset.prevHidden === '1';
          delete control.dataset.prevHidden;
          control.hidden = wasHidden;
        } else {
          control.hidden = false;
        }
      });
    } else {
      taskCheckHost.hidden = true;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control.dataset) {
          control.dataset.prevHidden = control.hidden ? '1' : '0';
        }
        control.hidden = true;
      });
      updateTaskStatus('');
    }
  }
  function evaluateStudentAnswer() {
    if (!STATE.lastFigureIsAnswer) return null;
    const lastIndex = getLastFigureIndex();
    if (lastIndex < 0) return null;
    const solutionFig = Array.isArray(STATE.figures) ? STATE.figures[lastIndex] : null;
    if (!solutionFig || !Array.isArray(solutionFig.cells)) return null;
    const solution = normalizeCells(solutionFig.cells, rows, cols);
    const student = ensureTaskStudentCells(true);
    if (!student) return null;
    let matchesSolution = true;
    for (let r = 0; r < rows; r++) {
      const studentRow = Array.isArray(student[r]) ? student[r] : [];
      const solutionRow = Array.isArray(solution[r]) ? solution[r] : [];
      for (let c = 0; c < cols; c++) {
        const studentVal = parseInt(studentRow[c], 10) || 0;
        const solutionVal = parseInt(solutionRow[c], 10) || 0;
        if (studentVal !== solutionVal) {
          matchesSolution = false;
          break;
        }
      }
      if (!matchesSolution) break;
    }
    if (matchesSolution) return true;
    const textResult = evaluateStudentAnswerText(student);
    if (textResult != null) return textResult;
    return false;
  }
  function setReadOnlyPreview(enabled) {
    const next = !!enabled;
    if (next === isReadOnlyPreview) return;
    isReadOnlyPreview = next;
    if (STATE.lastFigureIsAnswer && isReadOnlyPreview) {
      ensureTaskStudentCells(true);
    }
    if (isReadOnlyPreview) {
      render();
    } else {
      render();
      updateTaskStatus('');
    }
    applyReadOnlyPreviewControls();
  }
  function setEditMode() {
    setReadOnlyPreview(false);
  }
  function applyStateToControls() {
    if (rowsInput) rowsInput.value = String(rows);
    if (colsInput) colsInput.value = String(cols);
    if (figureTypeSelect) {
      figureTypeSelect.value = normalizeFigureType(STATE.figureType) || 'square';
    }
    if (showGridToggle) showGridToggle.checked = !!STATE.showGrid;
    if (gridLastFigureToggle) gridLastFigureToggle.checked = !!STATE.gridOnlyOnLast;
    if (offsetToggle) offsetToggle.checked = !!STATE.offset;
    if (lastFigureAnswerToggle) lastFigureAnswerToggle.checked = !!STATE.lastFigureIsAnswer;
    updateAnswerFieldState();
    if (labelModeSelect) {
      labelModeSelect.value = normalizeLabelMode(STATE.labelMode);
    }
    if (colorCountInp) {
      colorCountInp.value = String(STATE.colorCount);
      colorCountInp.min = String(FILL_COLOR_COUNT);
      colorCountInp.max = String(FILL_COLOR_COUNT);
      colorCountInp.disabled = true;
    }
    updateColorVisibility();
    renderFillColorPicker();
  }
  function setRows(next) {
    const clamped = clampInt(next, 1, MAX_DIM);
    if (clamped === rows) return;
    const previousRows = rows;
    resetTaskStudentCells();
    if (clamped > previousRows && Array.isArray(STATE.figures)) {
      const diff = clamped - previousRows;
      const columnCount = cols > 0 ? cols : 1;
      STATE.figures.forEach(fig => {
        if (!fig || typeof fig !== 'object') return;
        if (!Array.isArray(fig.cells)) fig.cells = [];
        for (let i = 0; i < diff; i++) {
          fig.cells.unshift(Array.from({ length: columnCount }, () => 0));
        }
      });
    }
    STATE.rows = clamped;
    render();
  }
  function setCols(next) {
    const clamped = clampInt(next, 1, MAX_DIM);
    if (clamped === cols) return;
    resetTaskStudentCells();
    STATE.cols = clamped;
    render();
  }
  if (rowsInput) {
    rowsInput.addEventListener('input', () => {
      if (rowsInput.value === '') return;
      setRows(rowsInput.value);
    });
    rowsInput.addEventListener('change', () => {
      setRows(rowsInput.value);
    });
    rowsInput.addEventListener('blur', () => {
      setRows(rowsInput.value);
    });
  }
  if (colsInput) {
    colsInput.addEventListener('input', () => {
      if (colsInput.value === '') return;
      setCols(colsInput.value);
    });
    colsInput.addEventListener('change', () => {
      setCols(colsInput.value);
    });
    colsInput.addEventListener('blur', () => {
      setCols(colsInput.value);
    });
  }
  if (figureTypeSelect) {
    figureTypeSelect.addEventListener('change', () => {
      const nextType = normalizeFigureType(figureTypeSelect.value) || 'square';
      STATE.figureType = nextType;
      STATE.circleMode = isCircleFigureType(nextType);
      updateCellColors();
      scheduleAltTextRefresh('shape');
    });
  }
  if (offsetToggle) {
    offsetToggle.addEventListener('change', () => {
      STATE.offset = !!offsetToggle.checked;
      render();
    });
  }
  if (showGridToggle) {
    showGridToggle.addEventListener('change', () => {
      STATE.showGrid = !!showGridToggle.checked;
      updateGridVisibility();
      scheduleAltTextRefresh('grid');
    });
  }
  if (gridLastFigureToggle) {
    gridLastFigureToggle.addEventListener('change', () => {
      STATE.gridOnlyOnLast = !!gridLastFigureToggle.checked;
      updateGridVisibility();
      scheduleAltTextRefresh('grid');
    });
  }
  if (lastFigureAnswerToggle) {
    lastFigureAnswerToggle.addEventListener('change', () => {
      const enabled = !!lastFigureAnswerToggle.checked;
      STATE.lastFigureIsAnswer = enabled;
      resetTaskStudentCells();
      if (enabled) {
        ensureTaskStudentCells(false);
      } else {
        updateTaskStatus('');
      }
      if (isTaskModeActive()) {
        render();
      } else {
        updateCellColors();
        updateGridVisibility();
      }
      updateAnswerFieldState();
      applyReadOnlyPreviewControls();
      scheduleAltTextRefresh('grid');
    });
  }
  if (answerTextInput) {
    const syncAnswerText = () => {
      if (answerTextInput.disabled) return;
      STATE.answerText = answerTextInput.value;
    };
    answerTextInput.addEventListener('input', syncAnswerText);
    answerTextInput.addEventListener('change', syncAnswerText);
    answerTextInput.addEventListener('blur', syncAnswerText);
  }
  if (labelModeSelect) {
    labelModeSelect.addEventListener('change', () => {
      STATE.labelMode = normalizeLabelMode(labelModeSelect.value);
      STATE.showFigureText = STATE.labelMode !== 'hidden';
      updateFigureLabelDisplay();
      scheduleAltTextRefresh('label-mode');
    });
  }
  colorCountInp === null || colorCountInp === void 0 || colorCountInp.addEventListener('input', () => {
    STATE.colorCount = clampInt(colorCountInp.value, 1, FILL_COLOR_COUNT);
    resetTaskStudentCells();
    render();
  });
  colorInputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      modifiedColorIndexes.add(idx);
      autoPaletteEnabled = modifiedColorIndexes.size === 0;
      ensureColors(Math.max(idx + 1, STATE.colorCount));
      STATE.colors[idx] = inp.value;
      updateCellColors();
      scheduleAltTextRefresh('colors');
    });
  });
  if (btnCheck) {
    btnCheck.addEventListener('click', () => {
      const taskApi = getTaskApi();
      if (taskApi && typeof taskApi.evaluateTask === 'function') {
        taskApi.evaluateTask(TASK_APP_ID);
      } else {
        runTaskCheck();
      }
    });
  }
  addBtn === null || addBtn === void 0 || addBtn.addEventListener('click', () => {
    STATE.figures.push(createFigureState(`Figur ${STATE.figures.length + 1}`, rows, cols, []));
    resetTaskStudentCells();
    render();
  });
  function removeFigure(index) {
    if (!Array.isArray(STATE.figures) || STATE.figures.length <= 1) return;
    STATE.figures.splice(index, 1);
    resetTaskStudentCells();
    render();
  }
  const btnSvg = document.getElementById('btnSvg');
  const btnPng = document.getElementById('btnPng');
  const resetBtn = document.getElementById('resetBtn');
  function svgToString(svgEl) {
    if (!svgEl) return '';
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
    if (!clone) return '';
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }
  function buildFigurtallExportMeta() {
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const summary = collectFigurtallAltSummary();
    if (!summary) {
      const slug = helper && typeof helper.slugify === 'function' ? helper.slugify('figurtall tom', 'figurtall') : 'figurtall';
      return {
        description: 'Figurtall uten figurer.',
        slug,
        defaultBaseName: slug,
        summary: null
      };
    }
    const figureCount = Math.max(0, Math.round(summary.figureCount || 0));
    const gridPart = Number.isFinite(summary.rows) && Number.isFinite(summary.cols)
      ? `${summary.rows}×${summary.cols} rutenett`
      : null;
    const shapeKey = summary.circleMode ? 'sirkel' : summary.figureType || 'figur';
    const descriptionParts = [
      figureCount === 1 ? 'Én figur' : `${figureCount} figurer`,
      summary.circleMode ? 'sirkelmodus' : shapeKey
    ];
    if (gridPart) descriptionParts.push(gridPart);
    const description = `Figurtall med ${descriptionParts.filter(Boolean).join(' – ')}.`;
    const slugParts = ['figurtall', `${figureCount}fig`, summary.circleMode ? 'sirkel' : shapeKey];
    if (gridPart) slugParts.push(`${summary.rows}x${summary.cols}`);
    const slugBase = slugParts.join(' ');
    const slug = helper && typeof helper.slugify === 'function' ? helper.slugify(slugBase, 'figurtall') : slugParts.join('-').toLowerCase();
    return {
      description,
      slug,
      defaultBaseName: slug || 'figurtall',
      summary
    };
  }
  async function downloadSVG(svgEl, filename) {
    const suggestedName = typeof filename === 'string' && filename ? filename : 'figurtall.svg';
    const data = svgToString(svgEl);
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const meta = buildFigurtallExportMeta();
    const htmlTarget = document.querySelector('.figure') || svgEl;
    if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
      await helper.exportGraphicWithArchiveWithFallback({
        svgElement: svgEl,
        htmlTarget,
        suggestedName,
        toolId: 'figurtall',
        svgString: data,
        description: meta.description,
        slug: meta.slug,
        defaultBaseName: meta.defaultBaseName,
        summary: meta.summary
      });
      return;
    }
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      await helper.exportSvgWithArchive(svgEl, suggestedName, 'figurtall', {
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
    const vb = svgEl.viewBox.baseVal;
    const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || cols * 40;
    const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || rows * 40;
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
  function formatCount(value, singular, plural) {
    const num = Math.max(0, Math.round(Number(value) || 0));
    const label = num === 1 ? singular : plural || singular + 'er';
    return `${num === 1 ? '1' : String(num)} ${label}`;
  }
  function joinWithOg(items) {
    const filtered = items.filter(Boolean);
    if (filtered.length === 0) return '';
    if (filtered.length === 1) return filtered[0];
    if (filtered.length === 2) return `${filtered[0]} og ${filtered[1]}`;
    return `${filtered.slice(0, -1).join(', ')} og ${filtered[filtered.length - 1]}`;
  }
  function getShapeWords(shapeKey) {
    const shapes = {
      square: { singular: 'rute', plural: 'ruter' },
      circle: { singular: 'sirkel', plural: 'sirkler' },
      star: { singular: 'stjerne', plural: 'stjerner' }
    };
    return shapes[shapeKey] || shapes.square;
  }
  function formatColumnRange(start, end) {
    const from = Number(start);
    const to = Number(end);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return '';
    const fromLabel = `kolonne ${from + 1}`;
    if (from === to) return fromLabel;
    return `${fromLabel}–${to + 1}`;
  }
  function describeRowPosition(rowIndex, totalRows) {
    const idx = Number(rowIndex);
    const rowsCount = Number(totalRows);
    if (!Number.isFinite(idx)) return 'Raden';
    if (!Number.isFinite(rowsCount) || rowsCount <= 1) return 'Raden';
    if (idx === 0) return 'Øverste rad';
    if (idx === rowsCount - 1) return 'Nederste rad';
    if (idx === 1) return 'Neste rad';
    return `Rad ${idx + 1}`;
  }
  function formatRowSegments(row) {
    if (!row || !Array.isArray(row.segments)) return '';
    const segments = row.segments
      .map(seg => formatColumnRange(seg.start, seg.end))
      .filter(Boolean);
    if (!segments.length) return '';
    return ` i ${joinWithOg(segments)}`;
  }
  function buildRowDistributionText(fig, options = {}) {
    if (!fig || !Array.isArray(fig.rowDetails)) return null;
    const totalRows = Number.isFinite(options.totalRows) ? options.totalRows : rows;
    const shapeWords = options.shapeWords || getShapeWords(options.shapeKey);
    const rowsWithMarks = fig.rowDetails.filter(row => Number(row === null || row === void 0 ? void 0 : row.count) > 0);
    if (!rowsWithMarks.length) return null;
    const rowCountText = rowsWithMarks.length === 1 ? 'én rad' : `${rowsWithMarks.length} rader`;
    const rowDescriptions = rowsWithMarks.map((row, idx) => {
      let position = describeRowPosition(row.rowIndex, totalRows);
      if (idx > 0 && typeof position === 'string' && position.length) {
        position = position.charAt(0).toLowerCase() + position.slice(1);
      }
      const countText = formatCount(row.count, shapeWords.singular, shapeWords.plural);
      const segmentText = formatRowSegments(row);
      const offsetText = row.isOffset ? ' og er forskjøvet' : '';
      return `${position} har ${countText}${segmentText}${offsetText}`;
    });
    return {
      overview: rowCountText,
      detail: joinWithOg(rowDescriptions)
    };
  }
  function collectFigurtallAltSummary() {
    const figureCount = Array.isArray(STATE.figures) ? STATE.figures.length : 0;
    const colors = getColors();
    const figures = [];
    if (Array.isArray(STATE.figures)) {
      STATE.figures.forEach((fig, idx) => {
        const name = fig && typeof fig.name === 'string' && fig.name.trim() ? fig.name.trim() : `Figur ${idx + 1}`;
        const cells = Array.isArray(fig === null || fig === void 0 ? void 0 : fig.cells) ? fig.cells : [];
        const normalized = normalizeCells(cells, rows, cols);
        const colorUsage = colors.map(() => 0);
        let filled = 0;
        const rowDetails = normalized.map((rowVals, rowIdx) => {
          let rowFilled = 0;
          const segments = [];
          let segmentStart = null;
          rowVals.forEach((value, colIdx) => {
            if (Number.isFinite(value) && value > 0) {
              filled += 1;
              rowFilled += 1;
              const colorIdx = value - 1;
              if (colorIdx >= 0 && colorIdx < colorUsage.length) {
                colorUsage[colorIdx] += 1;
              }
              if (segmentStart === null) segmentStart = colIdx;
            } else if (segmentStart !== null) {
              segments.push({
                start: segmentStart,
                end: colIdx - 1
              });
              segmentStart = null;
            }
          });
          if (segmentStart !== null) {
            segments.push({
              start: segmentStart,
              end: rowVals.length - 1
            });
          }
          return {
            rowIndex: rowIdx,
            count: rowFilled,
            segments,
            isOffset: !!(STATE.offset && rowIdx % 2 === 1)
          };
        });
        figures.push({
          index: idx,
          name,
          filled,
          colorUsage,
          grid: normalized,
          rowDetails
        });
      });
    }
    const figureType = normalizeFigureType(STATE.figureType) || (STATE.circleMode ? 'circle' : 'square');
    return {
      figureCount,
      rows,
      cols,
      circleMode: isCircleFigureType(figureType),
      figureType,
      offset: !!STATE.offset,
      showGrid: !!STATE.showGrid,
      gridOnlyOnLast: !!STATE.gridOnlyOnLast,
      figures
    };
  }
  function buildFigurtallFallbackAltText(summary) {
    const data = summary || collectFigurtallAltSummary();
    if (!data) return 'Figurtall.';
    if (data.figureCount <= 0) return 'Ingen figurer.';

    const fallbackShape = data.circleMode ? 'circle' : 'square';
    const shapeKey = figureTypeToShapeKey(data.figureType || fallbackShape);
    const shapeWords = getShapeWords(shapeKey);

    const introParts = [];
    if (Number.isFinite(data.rows) && Number.isFinite(data.cols)) {
      introParts.push(`${data.rows}×${data.cols} rutenett`);
    } else {
      introParts.push('rutenett');
    }
    if (data.offset && Number(data.rows) > 1) {
      introParts.push('annenhver rad forskjøvet');
    }
    if (data.showGrid === false) {
      introParts.push('uten synlig rutenett');
    }

    const figureIntro = data.figureCount === 1 ? 'Én figur' : `${data.figureCount} figurer`;
    const introSentence = [`${figureIntro} med ${shapeWords.plural}`, introParts.length ? `i ${joinWithOg(introParts)}` : ''].join(' ').trim();

    const sentences = [introSentence ? `${introSentence}.` : 'Figurtall.'];

    if (Array.isArray(data.figures) && data.figures.length) {
      const figureSummaries = data.figures.map(fig => {
        const name = fig && typeof fig.name === 'string' && fig.name.trim() ? fig.name.trim() : '';
        const totalShapes = fig && Number.isFinite(fig.filled) ? fig.filled : 0;
        const totalText = totalShapes > 0 ? formatCount(totalShapes, shapeWords.singular, shapeWords.plural) : `ingen ${shapeWords.plural}`;
        return name ? `${name} har ${totalText}` : totalText;
      });
      if (figureSummaries.length) {
        sentences.push(`${joinWithOg(figureSummaries)}.`);
      }
    } else {
      sentences.push('Ingen markeringer.');
    }

    if (data.gridOnlyOnLast && data.showGrid !== false) {
      sentences.push('Rutenettet vises bare i siste figur.');
    }

    return sentences.filter(Boolean).join(' ');
  }
  function buildFigurtallAltText(summary) {
    const data = summary || collectFigurtallAltSummary();
    if (!data) return 'Figurtall.';
    if (STATE.altTextSource !== 'manual') {
      maybeTriggerFigurtallAiAltText(data);
    }
    return buildFigurtallFallbackAltText(data);
  }
  function setAltTextStatusMessage(message, isError) {
    const container = document.getElementById('exportCard');
    if (!container) return;
    const status = container.querySelector('.alt-text__status');
    if (!status) return;
    status.textContent = message || '';
    if (isError) {
      status.classList.add('alt-text__status--error');
    } else {
      status.classList.remove('alt-text__status--error');
    }
  }
  function canUseFigurtallAi() {
    if (typeof fetch !== 'function') return false;
    if (typeof AbortController === 'undefined') return false;
    if (STATE.altTextSource === 'manual') return false;
    if (resolveFigurtallAltTextEndpoint()) return true;
    if (typeof window !== 'undefined' && window && window.OPENAI_API_KEY) return true;
    return false;
  }
  function cancelFigurtallAiAltText() {
    if (figurtallAiAbortController) {
      figurtallAiAbortController.abort();
      figurtallAiAbortController = null;
    }
    figurtallAiPendingSignature = null;
    figurtallAiAppliedSignature = null;
  }
  function maybeTriggerFigurtallAiAltText(summary) {
    if (!summary || STATE.altTextSource === 'manual') return;
    if (!canUseFigurtallAi()) return;
    const signatureData = {
      rows: summary.rows,
      cols: summary.cols,
      offset: !!summary.offset,
      circleMode: !!summary.circleMode,
      showGrid: !!summary.showGrid,
      figures: Array.isArray(summary.figures)
        ? summary.figures.map(fig => ({
            name: fig.name,
            grid: Array.isArray(fig.grid) ? fig.grid : []
          }))
        : []
    };
    const signature = JSON.stringify(signatureData);
    if (signature === figurtallAiAppliedSignature) return;
    if (signature === figurtallAiPendingSignature) return;
    if (figurtallAiAbortController) {
      figurtallAiAbortController.abort();
      figurtallAiAbortController = null;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
    figurtallAiAbortController = controller;
    figurtallAiPendingSignature = signature;
    setAltTextStatusMessage('Forbedrer beskrivelsen med AI …');
    performFigurtallAltTextRequest(summary, controller.signal)
      .then(text => {
        clearTimeout(timeoutId);
        if (controller.signal.aborted || figurtallAiAbortController !== controller) return;
        figurtallAiAbortController = null;
        figurtallAiPendingSignature = null;
        const trimmed = typeof text === 'string' ? text.trim() : '';
        if (!trimmed) throw new Error('Tom alt-tekst');
        if (STATE.altTextSource === 'manual') return;
        STATE.altText = trimmed;
        STATE.altTextSource = 'auto';
        figurtallAiAppliedSignature = signature;
        lastAltTextSignature = null;
        if (altTextManager && typeof altTextManager.applyCurrent === 'function') {
          altTextManager.applyCurrent();
        }
        setAltTextStatusMessage('Alternativ tekst forbedret automatisk.');
      })
      .catch(error => {
        clearTimeout(timeoutId);
        if (controller.signal.aborted) return;
        figurtallAiPendingSignature = null;
        if (figurtallAiAbortController === controller) {
          figurtallAiAbortController = null;
        }
        console.warn('Kunne ikke generere detaljert alt-tekst for figurtall', error);
        if (STATE.altTextSource !== 'manual') {
          setAltTextStatusMessage('Klarte ikke å lage detaljert tekst automatisk.', true);
        }
      });
  }
  function simplifyFigurtallSummary(summary) {
    if (!summary || typeof summary !== 'object') return null;
    const base = {
      rows: summary.rows,
      cols: summary.cols,
      circleMode: !!summary.circleMode,
      offset: !!summary.offset,
      showGrid: !!summary.showGrid,
      figureCount: summary.figureCount,
      figures: []
    };
    if (Array.isArray(summary.figures)) {
      base.figures = summary.figures.map(fig => ({
        name: fig && typeof fig.name === 'string' ? fig.name : '',
        filled: fig && Number.isFinite(fig.filled) ? fig.filled : 0,
        colorUsage: Array.isArray(fig === null || fig === void 0 ? void 0 : fig.colorUsage) ? fig.colorUsage.slice() : [],
        rowDetails: Array.isArray(fig === null || fig === void 0 ? void 0 : fig.rowDetails)
          ? fig.rowDetails.map(row => ({
              rowIndex: row && Number.isFinite(row.rowIndex) ? row.rowIndex : 0,
              count: row && Number.isFinite(row.count) ? row.count : 0,
              isOffset: !!(row && row.isOffset),
              segments: Array.isArray(row === null || row === void 0 ? void 0 : row.segments)
                ? row.segments.map(seg => ({
                    start: Number.isFinite(seg === null || seg === void 0 ? void 0 : seg.start) ? seg.start : 0,
                    end: Number.isFinite(seg === null || seg === void 0 ? void 0 : seg.end) ? seg.end : 0
                  }))
                : []
            }))
          : [],
        grid: Array.isArray(fig === null || fig === void 0 ? void 0 : fig.grid)
          ? fig.grid.map(row => (Array.isArray(row) ? row.slice() : []))
          : []
      }));
    }
    return base;
  }
  function buildFigurtallAiPrompt(summary) {
    if (!summary || typeof summary !== 'object') return '';
    const parts = [];
    if (Number.isFinite(summary.rows) && Number.isFinite(summary.cols)) {
      parts.push(`Rutenett: ${summary.rows} rader x ${summary.cols} kolonner.`);
    }
    if (summary.offset && summary.rows > 1) parts.push('Annenhver rad er forskjøvet.');
    const figureType = normalizeFigureType(summary.figureType) || (summary.circleMode ? 'circle' : 'square');
    const shapeKey = figureTypeToShapeKey(figureType);
    const isOutline = figureType === 'square-outline' || figureType === 'circle-outline';
    if (shapeKey === 'star') {
      parts.push('Markeringene vises som stjerner.');
    } else if (shapeKey === 'circle') {
      parts.push(isOutline ? 'Markeringene vises som sirkler uten fyll.' : 'Markeringene vises som fylte sirkler.');
    } else {
      parts.push(isOutline ? 'Markeringene vises som kvadrater uten fyll.' : 'Markeringene vises som fylte kvadrater.');
    }
    if (summary.showGrid === false) parts.push('Rutenettet er skjult.');
    if (Array.isArray(summary.figures)) {
      summary.figures.forEach((fig, idx) => {
        const name = fig && typeof fig.name === 'string' && fig.name.trim() ? fig.name.trim() : `Figur ${idx + 1}`;
        const filled = fig && Number.isFinite(fig.filled) ? fig.filled : 0;
        parts.push(`${name}: ${filled} markerte posisjoner totalt.`);
        if (Array.isArray(fig.rowDetails)) {
          fig.rowDetails.forEach(row => {
            if (!row || !Number.isFinite(row.count) || row.count <= 0) return;
            const rowNumber = Number.isFinite(row.rowIndex) ? row.rowIndex + 1 : null;
            const segmentParts = Array.isArray(row.segments)
              ? row.segments
                  .map(seg => formatColumnRange(seg.start, seg.end))
                  .filter(Boolean)
              : [];
            const segmentText = segmentParts.length ? `i ${joinWithOg(segmentParts)}` : 'spredt over enkelte kolonner';
            const offsetText = row.isOffset ? ' (forskjøvet rad)' : '';
            if (rowNumber !== null) {
              parts.push(`- Rad ${rowNumber}${offsetText}: ${row.count} ruter ${segmentText}.`);
            } else {
              parts.push(`- ${row.count} ruter ${segmentText}.${offsetText ? ` ${offsetText}` : ''}`.trim());
            }
          });
        }
        if (Array.isArray(fig.colorUsage)) {
          const colorParts = fig.colorUsage
            .map((count, colorIdx) => (count > 0 ? `${count} i farge ${colorIdx + 1}` : ''))
            .filter(Boolean);
          if (colorParts.length) parts.push(`- Fargebruk: ${colorParts.join(', ')}.`);
        }
      });
    }
    if (Array.isArray(summary.figures) && summary.figures.length > 1) {
      const totals = summary.figures.map((fig, idx) => {
        const name = fig && typeof fig.name === 'string' && fig.name.trim() ? fig.name.trim() : `Figur ${idx + 1}`;
        const filled = fig && Number.isFinite(fig.filled) ? fig.filled : 0;
        return `${name}: ${filled}`;
      });
      if (totals.length) parts.push(`Totalt per figur: ${totals.join(', ')}.`);
    }
    const header = 'Lag en alternativ tekst på norsk for en serie figurtall. Beskriv tydelig hvordan mønsteret utvikler seg fra figur til figur slik at en elev kan forstå sammenhengen uten å se figuren. Hold deg til 2–3 setninger, unngå punktlister og fokuser på utviklingen i antall og plassering.';
    return `${header}\n\nData:\n${parts.join('\n')}`;
  }
  async function requestFigurtallAltTextFromBackend(endpoint, prompt, summary, signal) {
    const payload = { prompt };
    const context = simplifyFigurtallSummary(summary);
    if (context) payload.context = context;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Backend error ${res.status}${text ? `: ${text}` : ''}`);
    }
    const data = await res.json().catch(() => null);
    if (!data || typeof data.text !== 'string') {
      throw new Error('Ugyldig svar fra alt-tekst-tjenesten');
    }
    const trimmed = data.text.trim();
    if (!trimmed) throw new Error('Tom alt-tekst fra tjenesten');
    return trimmed;
  }
  async function requestFigurtallAltTextDirect(prompt, signal) {
    if (typeof window === 'undefined') throw new Error('Mangler tilgang til nettleser for direktekall');
    const apiKey = window.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Mangler API-nøkkel for direktekall');
    const body = {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'Du beskriver serier av figurtall på norsk for elever. Teksten skal være 2–3 setninger, forklare mønsteret mellom figurene og hvordan antall og plassering endrer seg. Ikke bruk punktlister eller Markdown.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4
    };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body),
      signal
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const err = data && data.error ? data.error.message || JSON.stringify(data.error) : res.statusText;
      throw new Error(`OpenAI error ${res.status}${err ? `: ${err}` : ''}`);
    }
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('Ingen tekst mottatt fra OpenAI');
    return text.trim();
  }
  function resolveFigurtallAltTextEndpoint() {
    if (typeof window === 'undefined') return null;
    if (window.MATH_VISUALS_FIGURTALL_ALT_TEXT_API_URL) {
      const value = String(window.MATH_VISUALS_FIGURTALL_ALT_TEXT_API_URL).trim();
      if (value) return value;
    }
    if (window.MATH_VISUALS_ALT_TEXT_API_URL) {
      const shared = String(window.MATH_VISUALS_ALT_TEXT_API_URL).trim();
      if (shared) return shared;
    }
    var _window$location;
    const origin = (_window$location = window.location) === null || _window$location === void 0 ? void 0 : _window$location.origin;
    if (typeof origin === 'string' && /^https?:/i.test(origin)) {
      return '/api/figurtall-alt-text';
    }
    return null;
  }
  async function performFigurtallAltTextRequest(summary, signal) {
    const prompt = buildFigurtallAiPrompt(summary);
    if (!prompt) throw new Error('Mangler data for alt-tekst');
    let backendError = null;
    try {
      const endpoint = resolveFigurtallAltTextEndpoint();
      if (endpoint) {
        return await requestFigurtallAltTextFromBackend(endpoint, prompt, summary, signal);
      }
    } catch (error) {
      backendError = error;
      if (!(signal && signal.aborted)) console.warn('Alt-tekst-backend for figurtall utilgjengelig', error);
    }
    try {
      return await requestFigurtallAltTextDirect(prompt, signal);
    } catch (error) {
      if (backendError && !(signal && signal.aborted)) {
        console.warn('Direktekall for figurtall-alt-tekst feilet etter backend', error);
      }
      throw error;
    }
  }
  function getFigurtallTitle() {
    const base = typeof document !== 'undefined' && document && document.title ? document.title : 'Figurtall';
    const summary = collectFigurtallAltSummary();
    if (!summary) return base;
    if (!summary.figureCount) return base;
    const suffix = summary.figureCount === 1 ? '1 figur' : `${summary.figureCount} figurer`;
    return `${base} – ${suffix}`;
  }
  function getActiveFigurtallAltText() {
    const stored = typeof STATE.altText === 'string' ? STATE.altText.trim() : '';
    if (STATE.altTextSource === 'manual' && stored) return stored;
    return stored || buildFigurtallAltText();
  }
  function ensureAltTextAnchor() {
    let anchor = document.getElementById('figurtall-alt-anchor');
    if (!anchor) {
      anchor = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      anchor.setAttribute('id', 'figurtall-alt-anchor');
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
    const signature = JSON.stringify(collectFigurtallAltSummary());
    if (signature !== lastAltTextSignature) {
      lastAltTextSignature = signature;
      figurtallAiAppliedSignature = null;
      if (figurtallAiAbortController) {
        figurtallAiAbortController.abort();
        figurtallAiAbortController = null;
      }
      figurtallAiPendingSignature = null;
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
    }, 120);
  }
  function initAltTextManager() {
    if (typeof window === 'undefined' || !window.MathVisAltText) return;
    const container = document.getElementById('exportCard');
    if (!container) return;
    const anchor = ensureAltTextAnchor();
    altTextManager = window.MathVisAltText.create({
      svg: () => anchor,
      container,
      getTitle: getFigurtallTitle,
      getState: () => ({
        text: typeof STATE.altText === 'string' ? STATE.altText : '',
        source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
      }),
      setState: (text, source) => {
        STATE.altText = text;
        STATE.altTextSource = source === 'manual' ? 'manual' : 'auto';
        if (STATE.altTextSource === 'manual') {
          cancelFigurtallAiAltText();
        }
      },
      generate: () => buildFigurtallAltText(),
      getSignature: () => JSON.stringify(collectFigurtallAltSummary()),
      getAutoMessage: reason => (reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.'),
      getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
    });
    if (altTextManager) {
      lastAltTextSignature = null;
      altTextManager.applyCurrent();
      const figure = document.getElementById('figureContainer');
      if (figure && window.MathVisAltText) {
        const nodes = window.MathVisAltText.ensureSvgA11yNodes(anchor);
        const title = getFigurtallTitle();
        figure.setAttribute('role', 'img');
        figure.setAttribute('aria-label', title);
        if (nodes.titleEl && nodes.titleEl.id) figure.setAttribute('aria-labelledby', nodes.titleEl.id);
        if (nodes.descEl && nodes.descEl.id) figure.setAttribute('aria-describedby', nodes.descEl.id);
      }
      scheduleAltTextRefresh('init');
    }
  }
  function buildExportSvg() {
    const colors = getColors();
    const cellSize = 40;
    const figW = cols * cellSize + (STATE.offset ? cellSize / 2 : 0);
    const figH = rows * cellSize;
    const labelsVisible = STATE.labelMode !== 'hidden';
    const nameH = labelsVisible ? 24 : 0;
    const gap = 20;
    const figCount = boxes.length;
    const totalW = figCount > 0 ? figCount * figW + gap * (figCount - 1) : figW;
    const totalH = figH + nameH;
    const shapeMode = normalizeFigureType(STATE.figureType) || 'square';
    const buildStarPoints = (cx, cy, outerR) => {
      const innerR = outerR * 0.45;
      const points = [];
      const startAngle = -Math.PI / 2;
      for (let i = 0; i < 10; i++) {
        const angle = startAngle + i * Math.PI / 5;
        const radius = i % 2 === 0 ? outerR : innerR;
        const x = cx + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        points.push(`${x},${y}`);
      }
      return points.join(' ');
    };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
    svg.setAttribute('width', totalW);
    svg.setAttribute('height', totalH);
    if (window.MathVisAltText) {
      const { titleEl, descEl } = window.MathVisAltText.ensureSvgA11yNodes(svg);
      const title = getFigurtallTitle();
      if (titleEl) titleEl.textContent = title;
      const desc = getActiveFigurtallAltText();
      if (descEl) descEl.textContent = desc;
      svg.setAttribute('role', 'img');
      svg.setAttribute('aria-label', title);
      if (titleEl && titleEl.id) svg.setAttribute('aria-labelledby', titleEl.id);
      if (descEl && descEl.id) svg.setAttribute('aria-describedby', descEl.id);
    }
    let xOffset = 0;
    const lastIndex = boxes.length - 1;
    boxes.forEach((box, idx) => {
      const label = getFigureLabel(idx);
      const showLabel = labelsVisible && !!label;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${xOffset},0)`);
      box.querySelectorAll('.row').forEach((rowEl, r) => {
        rowEl.querySelectorAll('.cell').forEach((cellEl, c) => {
          const colorIdx = parseInt(cellEl.dataset.color, 10) || 0;
          const x = c * cellSize + (STATE.offset && r % 2 === 1 ? cellSize / 2 : 0);
          const yPos = r * cellSize;
          const base = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          base.setAttribute('x', x);
          base.setAttribute('y', yPos);
          base.setAttribute('width', cellSize);
          base.setAttribute('height', cellSize);
          base.setAttribute('fill', '#fff');
          const showGridForCell = STATE.showGrid && (!STATE.gridOnlyOnLast || idx === lastIndex);
          if (showGridForCell) {
            base.setAttribute('stroke', '#d1d5db');
            base.setAttribute('stroke-width', '1');
          }
          g.appendChild(base);
          if (colorIdx > 0) {
            const fillColor = colors[colorIdx - 1];
            if (shapeMode === 'circle') {
              const inset = Math.max(2, cellSize * 0.12);
              const radius = Math.max(0, cellSize / 2 - inset);
              const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
              circ.setAttribute('cx', x + cellSize / 2);
              circ.setAttribute('cy', yPos + cellSize / 2);
              circ.setAttribute('r', radius);
              circ.setAttribute('fill', fillColor);
              g.appendChild(circ);
            } else if (shapeMode === 'circle-outline') {
              const inset = Math.max(3, cellSize * 0.18);
              const strokeWidth = Math.max(2, cellSize * 0.08);
              const radius = Math.max(0, cellSize / 2 - inset);
              const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
              circ.setAttribute('cx', x + cellSize / 2);
              circ.setAttribute('cy', yPos + cellSize / 2);
              circ.setAttribute('r', radius);
              circ.setAttribute('fill', 'none');
              circ.setAttribute('stroke', fillColor);
              circ.setAttribute('stroke-width', strokeWidth);
              g.appendChild(circ);
            } else if (shapeMode === 'star') {
              const star = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
              const outerR = cellSize / 2 - 2;
              const cx = x + cellSize / 2;
              const cy = yPos + cellSize / 2;
              star.setAttribute('points', buildStarPoints(cx, cy, Math.max(outerR, 4)));
              star.setAttribute('fill', fillColor);
              g.appendChild(star);
            } else if (shapeMode === 'square-outline') {
              const inset = Math.max(3, cellSize * 0.18);
              const strokeWidth = Math.max(2, cellSize * 0.08);
              const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              const size = Math.max(0, cellSize - inset * 2);
              rect.setAttribute('x', x + inset);
              rect.setAttribute('y', yPos + inset);
              rect.setAttribute('width', size);
              rect.setAttribute('height', size);
              rect.setAttribute('fill', 'none');
              rect.setAttribute('stroke', fillColor);
              rect.setAttribute('stroke-width', strokeWidth);
              rect.setAttribute('rx', Math.min(strokeWidth * 1.5, size / 2));
              rect.setAttribute('ry', Math.min(strokeWidth * 1.5, size / 2));
              rect.setAttribute('stroke-linejoin', 'round');
              g.appendChild(rect);
            } else {
              const inset = Math.max(2, cellSize * 0.12);
              const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              rect.setAttribute('x', x + inset);
              rect.setAttribute('y', yPos + inset);
              rect.setAttribute('width', Math.max(0, cellSize - inset * 2));
              rect.setAttribute('height', Math.max(0, cellSize - inset * 2));
              rect.setAttribute('fill', fillColor);
              g.appendChild(rect);
            }
          }
        });
      });
      if (showLabel) {
        const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textNode.setAttribute('x', figW / 2);
        textNode.setAttribute('y', figH + 16);
        textNode.setAttribute('text-anchor', 'middle');
        textNode.setAttribute('font-size', '16');
        textNode.setAttribute('font-family', 'system-ui, sans-serif');
        textNode.textContent = label;
        g.appendChild(textNode);
      }
      svg.appendChild(g);
      xOffset += figW + gap;
    });
    return svg;
  }
  btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => {
    const svg = buildExportSvg();
    downloadSVG(svg, 'figurtall.svg');
  });
  btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => {
    const svg = buildExportSvg();
    downloadPNG(svg, 'figurtall.png', 2);
  });
  function resetState() {
    STATE.rows = 3;
    STATE.cols = 3;
    STATE.figureType = 'square';
    STATE.circleMode = false;
    STATE.offset = true;
    STATE.showGrid = true;
    STATE.gridOnlyOnLast = false;
    STATE.lastFigureIsAnswer = false;
    STATE.labelMode = 'custom';
    STATE.showFigureText = true;
    STATE.colorCount = 1;
    STATE.colors = [];
    modifiedColorIndexes.clear();
    autoPaletteEnabled = true;
    ensureColors(STATE.colorCount);
    STATE.figures = [];
    STATE.altText = '';
    STATE.altTextSource = 'auto';
    STATE.answerText = '';
    resetTaskStudentCells();
    updateTaskStatus('');
    lastAltTextSignature = null;
    if (figurtallAiAbortController) {
      figurtallAiAbortController.abort();
      figurtallAiAbortController = null;
    }
    figurtallAiPendingSignature = null;
    figurtallAiAppliedSignature = null;
  }
  function normalizeCleanStatePayload(payload) {
    if (payload == null) return null;
    if (typeof payload === 'string') {
      try {
        return normalizeCleanStatePayload(JSON.parse(payload));
      } catch (_) {
        return null;
      }
    }
    if (payload && typeof payload === 'object' && payload.v === 1) {
      return payload;
    }
    if (payload && typeof payload === 'object' && payload.state && payload.state.v === 1) {
      return payload.state;
    }
    return null;
  }
  function createCleanState() {
    sanitizeState();
    const figures = Array.isArray(STATE.figures)
      ? STATE.figures.map(fig => ({
          name: typeof (fig === null || fig === void 0 ? void 0 : fig.name) === 'string' ? fig.name : '',
          cells: normalizeCells(fig === null || fig === void 0 ? void 0 : fig.cells, rows, cols)
        }))
      : [];
    return {
      v: 1,
      rows,
      cols,
      figureType: normalizeFigureType(STATE.figureType) || 'square',
      offset: !!STATE.offset,
      showGrid: !!STATE.showGrid,
      gridOnlyOnLast: !!STATE.gridOnlyOnLast,
      lastFigureIsAnswer: !!STATE.lastFigureIsAnswer,
      labelMode: STATE.labelMode,
      figures,
      answerText: typeof STATE.answerText === 'string' ? STATE.answerText : '',
      altText: {
        text: typeof STATE.altText === 'string' ? STATE.altText : '',
        source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
      }
    };
  }
  function loadCleanState(rawState) {
    if (!rawState || typeof rawState !== 'object' || rawState.v !== 1) return false;

    sanitizeState();

    const nextRows = clampInt(rawState.rows != null ? rawState.rows : rows, 1, MAX_DIM);
    const nextCols = clampInt(rawState.cols != null ? rawState.cols : cols, 1, MAX_DIM);
    STATE.rows = rows = nextRows;
    STATE.cols = cols = nextCols;

    const nextType = normalizeFigureType(rawState.figureType) || (rawState.circleMode ? 'circle' : STATE.figureType);
    STATE.figureType = nextType;
    STATE.circleMode = isCircleFigureType(nextType);
    STATE.offset = rawState.offset !== false;
    STATE.showGrid = rawState.showGrid !== false;
    STATE.gridOnlyOnLast = rawState.gridOnlyOnLast === true;
    STATE.lastFigureIsAnswer = rawState.lastFigureIsAnswer === true;
    STATE.labelMode = normalizeLabelMode(rawState.labelMode);

    STATE.colorCount = FILL_COLOR_COUNT;
    modifiedColorIndexes.clear();

    const settingsApi = getSettingsApi();
    const shouldApplySnapshotPalette = !settingsApi;
    if (shouldApplySnapshotPalette) {
      const incomingColors = Array.isArray(rawState.colors) ? rawState.colors.slice(0, STATE.colorCount) : [];
      incomingColors.forEach((color, idx) => {
        if (typeof color === 'string' && color.trim()) {
          STATE.colors[idx] = color;
          modifiedColorIndexes.add(idx);
        }
      });
    }
    autoPaletteEnabled = modifiedColorIndexes.size === 0;
    ensureColors(STATE.colorCount);

    if (Array.isArray(rawState.figures)) {
      STATE.figures = rawState.figures.map((fig, idx) => ({
        name: typeof (fig === null || fig === void 0 ? void 0 : fig.name) === 'string' && fig.name.trim() ? fig.name : `Figur ${idx + 1}`,
        cells: normalizeCells(fig === null || fig === void 0 ? void 0 : fig.cells, nextRows, nextCols)
      }));
    }

    if (typeof rawState.answerText === 'number' || typeof rawState.answerText === 'string') {
      const normalized = typeof rawState.answerText === 'number' ? String(rawState.answerText) : rawState.answerText;
      STATE.answerText = typeof normalized === 'string' ? normalized : STATE.answerText;
    }

    if (rawState.altText && typeof rawState.altText === 'object') {
      const altText = typeof rawState.altText.text === 'string' ? rawState.altText.text : STATE.altText;
      const altSource = rawState.altText.source === 'manual' ? 'manual' : rawState.altText.source === 'auto' ? 'auto' : STATE.altTextSource;
      STATE.altText = altText;
      STATE.altTextSource = altSource;
    }

    render();
    return true;
  }
  function serializeCleanState(payload) {
    const normalized = normalizeCleanStatePayload(payload);
    if (!normalized) return false;
    return loadCleanState(normalized);
  }
  function render() {
    sanitizeState();
    applyStateToControls();
    rebuildFigurePanels();
    if (STATE.lastFigureIsAnswer && isTaskModeActive()) {
      ensureTaskStudentCells(true);
      updateCellColors();
    }
    applyReadOnlyPreviewControls();
    scheduleAltTextRefresh('render');
  }
  resetBtn === null || resetBtn === void 0 || resetBtn.addEventListener('click', () => {
    resetState();
    render();
  });
  initAltTextManager();
  function syncThemeAndPalette() {
    if (isSyncingTheme) return;
    isSyncingTheme = true;
    if (themeObserver) {
      themeObserver.disconnect();
    }
    try {
      applyThemeToDocument();
      ensureColors(STATE.colorCount);
      render();
    } finally {
      isSyncingTheme = false;
      if (themeObserver && document && document.documentElement) {
        themeObserver.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['data-project', 'data-mv-active-project', 'data-theme-profile']
        });
      }
    }
  }
  window.render = render;
  window.figurtallApi = {
    cleanJSON: (...args) => createCleanState(...args),
    normalize: normalizeCleanStatePayload,
    serialize: serializeCleanState,
    setReadOnlyPreview,
    setEditMode
  };
  function handleProjectProfileMessage(event) {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change' && type !== 'math-visuals:project-change') return;
    syncThemeAndPalette();
  }
  function handleProjectProfileChange(event) {
    if (!event || (event.type !== 'math-visuals:profile-change' && event.type !== 'math-visuals:project-change')) return;
    syncThemeAndPalette();
  }
  function handleThemeSettingsChanged(event) {
    if (!event || event.type !== 'math-visuals:settings-changed') return;
    resetPaletteConfigCache();
    syncThemeAndPalette();
    renderFillColorPicker();
  }
  function handlePaletteChanged(event) {
    if (!event || event.type !== 'math-visuals:palette-changed') return;
    syncThemeAndPalette();
    renderFillColorPicker();
  }
  function initProjectProfileSync() {
    if (typeof MutationObserver === 'function' && document && document.documentElement) {
      themeObserver = new MutationObserver(mutations => {
        if (!Array.isArray(mutations)) return;
        const shouldSync = mutations.some(mutation => mutation && mutation.type === 'attributes' && ['data-project', 'data-mv-active-project', 'data-theme-profile'].includes(mutation.attributeName));
        if (shouldSync) {
          syncThemeAndPalette();
        }
      });
      themeObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-project', 'data-mv-active-project', 'data-theme-profile']
      });
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('math-visuals:profile-change', handleProjectProfileChange);
      window.addEventListener('math-visuals:project-change', handleProjectProfileChange);
      window.addEventListener('message', handleProjectProfileMessage);
      window.addEventListener('math-visuals:settings-changed', handleThemeSettingsChanged);
      window.addEventListener('math-visuals:palette-changed', handlePaletteChanged);
    }
    syncThemeAndPalette();
  }
  initProjectProfileSync();
})();
