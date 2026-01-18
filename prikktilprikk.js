(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const BOARD_WIDTH = 1000;
  const BOARD_HEIGHT = 700;
  const POINT_RADIUS = 18;
  const LABEL_POINT_MARGIN = 0;
  const DOT_RADIUS = 6;
  const LABEL_OFFSET_DISTANCE = DOT_RADIUS + LABEL_POINT_MARGIN;
  const LABEL_EDGE_MARGIN = 16;
  const LABEL_LINE_AVOIDANCE_THRESHOLD = Math.PI / 8;
  const LABEL_LINE_PENALTY = 100;
  const DEFAULT_LABEL_FONT_SIZE = 18;
  const AXIS_TICK_LENGTH = 8;
  const AXIS_LABEL_OFFSET = 14;
  const AXIS_LABEL_PADDING = 6;
  const POINT_DRAG_START_DISTANCE_PX = 4;
  const POINT_DRAG_START_DISTANCE_COARSE_PX = 12;
  const MIN_LABEL_FONT_SIZE = 10;
  const MAX_LABEL_FONT_SIZE = 48;
  const GRID_BASE_STEP = 0.05;
  const GRID_MAJOR_EVERY = 4;
  const DEFAULT_ZOOM = 1;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.25;
  const PAN_STEP = 0.01;
  const STORAGE_SCHEMA_VERSION = 1;
  const VIEW_PADDING_FACTOR = 0.1;
  const VIEW_MIN_PADDING = 0.05;
  const WORLD_MIN_X = -2;
  const WORLD_MAX_X = 2;
  const WORLD_MIN_Y = -2;
  const WORLD_MAX_Y = 2;

  function deepClone(value) {
    if (value == null) return value;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (_) {}
    }
    if (Array.isArray(value)) {
      return value.map(entry => deepClone(entry));
    }
    if (typeof value === 'object') {
      const clone = {};
      Object.keys(value).forEach(key => {
        clone[key] = deepClone(value[key]);
      });
      return clone;
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_) {
      return value;
    }
  }

  const DEFAULT_STATE = {
    coordinateOrigin: 'bottom-left',
    points: [
      { id: 'p1', label: '21', x: 0.16, y: 0.32 },
      { id: 'p2', label: '28', x: 0.27, y: 0.38 },
      { id: 'p3', label: '35', x: 0.29, y: 0.52 },
      { id: 'p4', label: '42', x: 0.21, y: 0.64 },
      { id: 'p5', label: '49', x: 0.39, y: 0.68 },
      { id: 'p6', label: '56', x: 0.47, y: 0.82 },
      { id: 'p7', label: '63', x: 0.6, y: 0.74 },
      { id: 'p8', label: '7', x: 0.83, y: 0.8 },
      { id: 'p9', label: '70', x: 0.83, y: 0.46 },
      { id: 'p10', label: '14', x: 0.6, y: 0.34 }
    ],
    answerLines: [
      ['p1', 'p2'],
      ['p2', 'p3'],
      ['p3', 'p4'],
      ['p4', 'p5'],
      ['p5', 'p6'],
      ['p6', 'p7'],
      ['p7', 'p8'],
      ['p8', 'p9'],
      ['p9', 'p10'],
      ['p10', 'p5'],
      ['p10', 'p3'],
      ['p2', 'p10']
    ],
    predefinedLines: [['p3', 'p5']],
    showLabels: true,
    labelFontSize: DEFAULT_LABEL_FONT_SIZE,
    nextPointId: 11,
    showGrid: true,
    snapToGrid: false,
    view: { zoom: DEFAULT_ZOOM, panX: 0, panY: 0 }
  };

  const SHARK_STATE = {
    coordinateOrigin: 'bottom-left',
    points: [
      { id: 'p1', label: '7', x: 0.2333, y: 0.6333 },
      { id: 'p2', label: '14', x: 0.5, y: 0.6333 },
      { id: 'p3', label: '21', x: 0.6333, y: 0.9 },
      { id: 'p4', label: '28', x: 0.9, y: 0.9 },
      { id: 'p5', label: '35', x: 0.9, y: 0.7222 },
      { id: 'p6', label: '42', x: 0.7667, y: 0.4556 },
      { id: 'p7', label: '49', x: 0.5, y: 0.4556 },
      { id: 'p8', label: '56', x: 0.3667, y: 0.3667 },
      { id: 'p9', label: '63', x: 0.1, y: 0.1 },
      { id: 'p10', label: '70', x: 0.1, y: 0.3667 }
    ],
    answerLines: [
      ['p1', 'p2'],
      ['p2', 'p3'],
      ['p3', 'p4'],
      ['p4', 'p5'],
      ['p5', 'p6'],
      ['p6', 'p7'],
      ['p7', 'p8'],
      ['p8', 'p9'],
      ['p9', 'p10'],
      ['p10', 'p1']
    ],
    predefinedLines: [],
    showLabels: true,
    labelFontSize: DEFAULT_LABEL_FONT_SIZE,
    nextPointId: 11
  };

  const EXAMPLE_TWO_STATE = {
    coordinateOrigin: 'bottom-left',
    points: [
      { id: 'p1', label: '7', x: 1, y: 0.25 },
      { id: 'p2', label: '14', x: 0.4615, y: 1 },
      { id: 'p3', label: '21', x: 0.1538, y: 1 },
      { id: 'p4', label: '28', x: 0.2308, y: 0.75 },
      { id: 'p5', label: '35', x: 0.0769, y: 0.75 },
      { id: 'p6', label: '42', x: 0, y: 0.5 },
      { id: 'p7', label: '49', x: 0.3077, y: 0.25 },
      { id: 'p8', label: '56', x: 0.4615, y: 0 },
      { id: 'p9', label: '63', x: 0.4615, y: 0.25 },
      { id: 'p10', label: '70', x: 0.9231, y: 0.75 }
    ],
    answerLines: [
      ['p1', 'p2'],
      ['p2', 'p3'],
      ['p3', 'p4'],
      ['p4', 'p5'],
      ['p5', 'p6'],
      ['p6', 'p7'],
      ['p7', 'p8'],
      ['p8', 'p9'],
      ['p9', 'p10']
    ],
    predefinedLines: [],
    showLabels: true,
    labelFontSize: DEFAULT_LABEL_FONT_SIZE,
    nextPointId: 11,
    showGrid: true,
    snapToGrid: false,
    view: { zoom: DEFAULT_ZOOM, panX: 0, panY: 0 }
  };

  const board = document.getElementById('dotBoard');
  if (!board) return;

  const modeLabel = document.getElementById('modeLabel');
  const modeHint = document.getElementById('modeHint');
  const checkBtn = document.getElementById('btnCheck');
  const clearBtn = document.getElementById('btnClear');
  const statusBox = document.getElementById('statusMessage');
  const taskCheckHost = typeof document !== 'undefined' ? document.querySelector('[data-task-check-host]') : null;
  const taskCheckControls = [checkBtn, statusBox].filter(Boolean);
  const addPointBtn = document.getElementById('btnAddPoint');
  const addPointFalseBtn = document.getElementById('btnAddPointFalse');
  const pointListEl = document.getElementById('pointList');
  const falsePointListEl = document.getElementById('falsePointList');
  const labelFontSizeSelect = document.getElementById('cfg-labelFontSize');
  const answerCountEl = document.getElementById('answerCount');
  const predefCountEl = document.getElementById('predefCount');
  const predefToolEl = document.getElementById('predefTool');
  const predefToggleBtn = document.getElementById('btnTogglePredef');
  const TASK_APP_ID = 'prikktilprikk';
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
        checkSolution();
        return null;
      },
      resetAnswers() {
        if (typeof taskApi.resetDescriptionInputs === 'function') {
          taskApi.resetDescriptionInputs();
        }
      }
    });
  }
  registerTaskAdapter();
  const predefHelperTextEl = document.getElementById('predefHelperText');
  const labelLayer = document.getElementById('boardLabelsLayer');
  const showGridToggle = document.getElementById('cfg-showGrid');
  const snapToGridToggle = document.getElementById('cfg-snapToGrid');
  const zoomRange = document.getElementById('cfg-zoom');
  const panXRange = document.getElementById('cfg-panX');
  const panYRange = document.getElementById('cfg-panY');
  const zoomValueEl = document.getElementById('cfg-zoomValue');
  const panXValueEl = document.getElementById('cfg-panXValue');
  const panYValueEl = document.getElementById('cfg-panYValue');

  attachListContainerListeners(pointListEl);
  attachListContainerListeners(falsePointListEl);

  const gridGroup = document.createElementNS(SVG_NS, 'g');
  const axesGroup = document.createElementNS(SVG_NS, 'g');
  const axisLabelsGroup = document.createElementNS(SVG_NS, 'g');
  const baseGroup = document.createElementNS(SVG_NS, 'g');
  const userGroup = document.createElementNS(SVG_NS, 'g');
  const answerGroup = document.createElementNS(SVG_NS, 'g');
  const pointsGroup = document.createElementNS(SVG_NS, 'g');
  const labelsGroup = document.createElementNS(SVG_NS, 'g');
  gridGroup.classList.add('grid-group');
  gridGroup.setAttribute('aria-hidden', 'true');
  gridGroup.style.pointerEvents = 'none';
  axesGroup.classList.add('axis-group');
  axesGroup.setAttribute('aria-hidden', 'true');
  axesGroup.style.pointerEvents = 'none';
  axisLabelsGroup.classList.add('axis-labels-group');
  axisLabelsGroup.setAttribute('aria-hidden', 'true');
  axisLabelsGroup.style.pointerEvents = 'none';
  baseGroup.classList.add('line-group', 'line-group--base');
  userGroup.classList.add('line-group', 'line-group--user');
  answerGroup.classList.add('line-group', 'line-group--answer');
  answerGroup.style.pointerEvents = 'none';
  pointsGroup.classList.add('points-group');
  labelsGroup.classList.add('labels-group');
  board.append(gridGroup, axesGroup, axisLabelsGroup, baseGroup, userGroup, answerGroup, pointsGroup, labelsGroup);

  const STATE = window.STATE && typeof window.STATE === 'object' ? window.STATE : {};
  window.STATE = STATE;

  const baseLines = new Set();
  const userLines = new Set();

  const initialModeValue = (() => {
    if (typeof mode !== 'undefined') return mode;
    if (typeof window !== 'undefined' && typeof window.mode !== 'undefined') return window.mode;
    return null;
  })();

  let isEditMode = true;
  if (initialModeValue != null) {
    const normalizedInitialMode = String(initialModeValue).toLowerCase();
    isEditMode = normalizedInitialMode === 'edit';
    if (typeof window !== 'undefined') {
      window.mode = normalizedInitialMode;
    }
  }
  let isPredefDrawingMode = false;
  let selectedPointId = null;
  let predefAnchorPointId = null;

  const pointEditors = new Map();
  const pointElements = new Map();
  const labelElements = new Map();
  let labelPlacements = new Map();
  const baseLineElements = new Map();
  const userLineElements = new Map();
  const answerLineElements = new Map();

  let realPointIds = new Set();
  let currentValidPoints = null;
  let boardScaleX = 1;
  let boardScaleY = 1;
  let boardClientWidth = BOARD_WIDTH;
  let boardClientHeight = BOARD_HEIGHT;
  let boardContentWidth = BOARD_WIDTH;
  let boardContentHeight = BOARD_HEIGHT;
  let boardOffsetX = 0;
  let boardOffsetY = 0;
  let hasUserAdjustedView = false;

  const activeBoardPointers = new Map();
  let boardPanSession = null;
  let boardPinchSession = null;

  let customLabelFontSizeOption = null;

  let draggedPointId = null;
  let draggingItemEl = null;
  let draggingItemOriginalDisplay = '';
  let draggingItemHeight = 0;
  let dropTargetEl = null;
  let dropTargetPointId = null;
  let dropPositionAfter = false;
  let dragPlaceholderEl = null;

  ensureStateDefaults();

  function ensureStateDefaults() {
    if (!Array.isArray(STATE.points) || STATE.points.length === 0) {
      const baseState = deepClone(DEFAULT_STATE) || {};
      STATE.points = Array.isArray(baseState.points) ? baseState.points : [];
      STATE.answerLines = Array.isArray(baseState.answerLines) ? baseState.answerLines : [];
      STATE.predefinedLines = Array.isArray(baseState.predefinedLines) ? baseState.predefinedLines : [];
      STATE.showLabels = true;
      STATE.labelFontSize = Number.isFinite(baseState.labelFontSize) ? baseState.labelFontSize : DEFAULT_LABEL_FONT_SIZE;
      STATE.nextPointId = Number.isFinite(baseState.nextPointId) ? baseState.nextPointId : STATE.points.length + 1;
      STATE.coordinateOrigin = typeof baseState.coordinateOrigin === 'string' ? baseState.coordinateOrigin : 'bottom-left';
    }
    if (typeof STATE.coordinateOrigin !== 'string') STATE.coordinateOrigin = 'bottom-left';
    if (!Array.isArray(STATE.answerLines)) STATE.answerLines = [];
    if (!Array.isArray(STATE.predefinedLines)) STATE.predefinedLines = [];
    STATE.showLabels = true;
    STATE.labelFontSize = normalizeLabelFontSize(STATE.labelFontSize);
    if (!Number.isFinite(STATE.nextPointId)) STATE.nextPointId = STATE.points.length + 1;
    if (typeof STATE.showGrid !== 'boolean') STATE.showGrid = true;
    if (typeof STATE.snapToGrid !== 'boolean') STATE.snapToGrid = false;
    if (!STATE.view || typeof STATE.view !== 'object') {
      STATE.view = { zoom: DEFAULT_ZOOM, panX: 0, panY: 0 };
    }
    getViewSettings();
  }

  function clamp(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return Number.isFinite(num) ? num : 0;
    }
    if (min > max) return min;
    if (!Number.isFinite(num)) return min;
    if (num <= min) return min;
    if (num >= max) return max;
    return num;
  }

  function sanitizeCoordinate(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (Math.abs(num) > 1e6) return Math.sign(num) * 1e6;
    return num;
  }

  function clamp01(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return 0;
    if (num <= 0) return 0;
    if (num >= 1) return 1;
    return num;
  }

  function normalizeLabelFontSize(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_LABEL_FONT_SIZE;
    if (num <= MIN_LABEL_FONT_SIZE) return MIN_LABEL_FONT_SIZE;
    if (num >= MAX_LABEL_FONT_SIZE) return MAX_LABEL_FONT_SIZE;
    return Math.round(num);
  }

  function clampZoom(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return DEFAULT_ZOOM;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, num));
    const quantized = Math.round(clamped / ZOOM_STEP) * ZOOM_STEP;
    const bounded = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, quantized));
    return Number(bounded.toFixed(2));
  }

  function markViewAdjustedByUser() {
    hasUserAdjustedView = true;
  }

  function resetViewToDefault() {
    STATE.view = { zoom: DEFAULT_ZOOM, panX: 0, panY: 0 };
    hasUserAdjustedView = false;
  }

  function computePointBounds(points) {
    if (!Array.isArray(points) || !points.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    points.forEach(point => {
      if (!point || typeof point !== 'object') return;
      const x = sanitizeCoordinate(point.x);
      const y = sanitizeCoordinate(point.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return null;
    }
    return { minX, maxX, minY, maxY };
  }

  function padBounds(bounds) {
    if (!bounds) return null;
    const width = Number.isFinite(bounds.maxX - bounds.minX) ? bounds.maxX - bounds.minX : 0;
    const height = Number.isFinite(bounds.maxY - bounds.minY) ? bounds.maxY - bounds.minY : 0;
    const padX = Math.max(width * VIEW_PADDING_FACTOR, VIEW_MIN_PADDING);
    const padY = Math.max(height * VIEW_PADDING_FACTOR, VIEW_MIN_PADDING);
    const minX = sanitizeCoordinate(bounds.minX - padX);
    const maxX = sanitizeCoordinate(bounds.maxX + padX);
    const minY = sanitizeCoordinate(bounds.minY - padY);
    const maxY = sanitizeCoordinate(bounds.maxY + padY);
    return { minX, maxX, minY, maxY };
  }

  function viewContainsBounds(view, bounds) {
    if (!view || !bounds) return false;
    const epsilon = 1e-6;
    const left = view.panX;
    const right = view.panX + view.viewWidth;
    const bottom = view.panY;
    const top = view.panY + view.viewHeight;
    return (
      bounds.minX >= left - epsilon &&
      bounds.maxX <= right + epsilon &&
      bounds.minY >= bottom - epsilon &&
      bounds.maxY <= top + epsilon
    );
  }

  function computeFittedView(bounds) {
    if (!bounds) return null;
    const width = Number.isFinite(bounds.maxX - bounds.minX) ? bounds.maxX - bounds.minX : 0;
    const height = Number.isFinite(bounds.maxY - bounds.minY) ? bounds.maxY - bounds.minY : 0;
    const span = Math.max(width, height, VIEW_MIN_PADDING * 2);
    if (!Number.isFinite(span) || span <= 0) return null;
    const desiredZoom = 1 / span;
    const zoom = clampZoom(desiredZoom);
    const viewWidth = zoom > 0 ? 1 / zoom : span;
    const viewHeight = viewWidth;
    const centerX = sanitizeCoordinate((bounds.minX + bounds.maxX) / 2);
    const centerY = sanitizeCoordinate((bounds.minY + bounds.maxY) / 2);
    let panX = centerX - viewWidth / 2;
    let panY = centerY - viewHeight / 2;
    const candidateMinX = WORLD_MIN_X;
    const candidateMaxX = WORLD_MAX_X - viewWidth;
    const candidateMinY = WORLD_MIN_Y;
    const candidateMaxY = WORLD_MAX_Y - viewHeight;
    const panMinX = Math.min(candidateMinX, candidateMaxX);
    const panMaxX = Math.max(candidateMinX, candidateMaxX);
    const panMinY = Math.min(candidateMinY, candidateMaxY);
    const panMaxY = Math.max(candidateMinY, candidateMaxY);
    panX = clamp(panX, panMinX, panMaxX);
    panY = clamp(panY, panMinY, panMaxY);
    return { zoom, panX, panY };
  }

  function ensureViewFitsPoints(points) {
    if (hasUserAdjustedView) return;
    const bounds = computePointBounds(points);
    if (!bounds) return;
    const padded = padBounds(bounds);
    const view = getViewSettings();
    if (viewContainsBounds(view, padded)) return;
    const fitted = computeFittedView(padded);
    if (!fitted) return;
    STATE.view = fitted;
    getViewSettings();
  }

  function getViewSettings() {
    const rawView = STATE.view && typeof STATE.view === 'object' ? STATE.view : {};
    const zoom = clampZoom(rawView.zoom);
    const viewWidth = zoom > 0 ? 1 / zoom : 1;
    const viewHeight = zoom > 0 ? 1 / zoom : 1;
    const rawPanX = Number(rawView.panX);
    const rawPanY = Number(rawView.panY);
    const candidateMinX = WORLD_MIN_X;
    const candidateMaxX = WORLD_MAX_X - viewWidth;
    const candidateMinY = WORLD_MIN_Y;
    const candidateMaxY = WORLD_MAX_Y - viewHeight;
    const panMinX = Math.min(candidateMinX, candidateMaxX);
    const panMaxX = Math.max(candidateMinX, candidateMaxX);
    const panMinY = Math.min(candidateMinY, candidateMaxY);
    const panMaxY = Math.max(candidateMinY, candidateMaxY);
    const panX = clamp(rawPanX, panMinX, panMaxX);
    const panY = clamp(rawPanY, panMinY, panMaxY);
    STATE.view = { zoom, panX, panY };
    return {
      zoom,
      panX,
      panY,
      viewWidth,
      viewHeight,
      panLimitX: panMaxX - panMinX,
      panLimitY: panMaxY - panMinY,
      panMinX,
      panMaxX,
      panMinY,
      panMaxY
    };
  }

  function computePanStep(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return PAN_STEP;
    const span = Math.abs(max - min);
    if (span <= 0) return PAN_STEP;
    const candidate = span / 5;
    if (candidate <= 0) return Math.min(PAN_STEP, span) || PAN_STEP;
    return Math.max(Math.min(PAN_STEP, candidate), 0.001);
  }

  function percentString(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    const rounded = Math.round(num * 1000) / 10;
    if (!Number.isFinite(rounded)) return '0';
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  }

  function formatZoom(value) {
    if (!Number.isFinite(value)) return '×1';
    const normalized = Number(value).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
    return `×${normalized}`;
  }

  function formatPercentValue(value) {
    if (!Number.isFinite(value)) return '0 %';
    return `${percentString(value)} %`;
  }

  function coordinateString(point) {
    if (!point) return '(0, 0)';
    return `(${percentString(point.x)}, ${percentString(point.y)})`;
  }

  function getPointLabelText(point) {
    if (!point) return '';
    const raw = point.label;
    if (raw != null) {
      const str = String(raw).trim();
      if (str) return str;
    }
    return point.id != null ? String(point.id) : '';
  }

  const SIMPLE_FRACTION_REGEX = /(^|[^\w])(-?\d+(?:\.\d+)?)(?:\s*)\/(?:\s*)(-?\d+(?:\.\d+)?)(?=$|[^\w])/g;

  function convertPlainTextToLatex(input) {
    if (input == null) return '';
    const normalized = String(input).replace(/\r\n?/g, '\n');
    const trimmed = normalized.trim();
    if (!trimmed) return '';
    const hasExplicitLatex = /\\[a-zA-Z]/.test(trimmed);
    const convertLine = line =>
      line.replace(SIMPLE_FRACTION_REGEX, (match, prefix, numerator, denominator) => {
        return `${prefix}\\frac{${numerator}}{${denominator}}`;
      });
    const lines = trimmed.split('\n').map(line => (hasExplicitLatex ? line : convertLine(line)));
    return lines.join('\\\\');
  }

  function renderLatex(element, value, options) {
    if (!element) return;
    const rawValue = value != null ? String(value) : '';
    const fallbackText = rawValue.trim();
    const latex = convertPlainTextToLatex(rawValue);
    if (latex && typeof window !== 'undefined' && window.katex && typeof window.katex.render === 'function') {
      try {
        window.katex.render(latex, element, {
          throwOnError: false,
          displayMode: !!(options && options.displayMode)
        });
        return;
      } catch (_) {}
    }
    element.textContent = fallbackText;
  }

  function syncViewControls(currentView) {
    const view = currentView || getViewSettings();
    if (showGridToggle) showGridToggle.checked = !!STATE.showGrid;
    if (snapToGridToggle) snapToGridToggle.checked = !!STATE.snapToGrid;
    if (zoomRange) {
      zoomRange.min = String(MIN_ZOOM);
      zoomRange.max = String(MAX_ZOOM);
      zoomRange.step = String(ZOOM_STEP);
      zoomRange.value = String(view.zoom);
    }
    if (zoomValueEl) zoomValueEl.textContent = formatZoom(view.zoom);
    const updatePanControl = (rangeEl, valueEl, value, min, max) => {
      const safeMin = Number.isFinite(min) ? min : 0;
      const safeMax = Number.isFinite(max) ? max : safeMin;
      const clampedValue = clamp(value, safeMin, safeMax);
      const span = Math.abs(safeMax - safeMin);
      if (!rangeEl) {
        if (valueEl) valueEl.textContent = formatPercentValue(clampedValue);
        return;
      }
      const disabled = span <= 0.0001;
      rangeEl.min = String(safeMin);
      rangeEl.max = String(safeMax);
      rangeEl.step = String(computePanStep(safeMin, safeMax));
      rangeEl.value = String(clampedValue);
      rangeEl.disabled = disabled;
      if (valueEl) valueEl.textContent = formatPercentValue(clampedValue);
    };
    updatePanControl(panXRange, panXValueEl, view.panX, view.panMinX, view.panMaxX);
    updatePanControl(panYRange, panYValueEl, view.panY, view.panMinY, view.panMaxY);
  }

  function computeBoardScale() {
    if (!board) return;
    const rect = board.getBoundingClientRect();
    const width = rect.width || BOARD_WIDTH;
    const height = rect.height || BOARD_HEIGHT;
    const scale = Math.min(
      width > 0 ? width / BOARD_WIDTH : 1,
      height > 0 ? height / BOARD_HEIGHT : 1
    ) || 1;
    boardClientWidth = width;
    boardClientHeight = height;
    boardScaleX = scale;
    boardScaleY = scale;
    boardContentWidth = BOARD_WIDTH * scale;
    boardContentHeight = BOARD_HEIGHT * scale;
    boardOffsetX = (width - boardContentWidth) / 2;
    boardOffsetY = (height - boardContentHeight) / 2;
  }

  const LABEL_PLACEMENT_CANDIDATES = [
    { dx: -1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 }
  ];

  function computePlacementOffset(candidate, size, scale) {
    const fallbackCandidate = LABEL_PLACEMENT_CANDIDATES[0] || { dx: -1, dy: 1 };
    const rawDx = candidate && typeof candidate.dx === 'number' ? candidate.dx : fallbackCandidate.dx;
    const rawDy = candidate && typeof candidate.dy === 'number' ? candidate.dy : fallbackCandidate.dy;
    const dx = rawDx > 0 ? 1 : rawDx < 0 ? -1 : 0;
    const dy = rawDy > 0 ? 1 : rawDy < 0 ? -1 : 0;
    const fallbackSize = LABEL_OFFSET_DISTANCE * 2;
    const width = size && Number.isFinite(size.width) && size.width > 0 ? size.width : fallbackSize;
    const height = size && Number.isFinite(size.height) && size.height > 0 ? size.height : fallbackSize;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const scaleX = scale && Number.isFinite(scale.x) ? scale.x : 1;
    const scaleY = scale && Number.isFinite(scale.y) ? scale.y : 1;
    const marginX = LABEL_OFFSET_DISTANCE * scaleX;
    const marginY = LABEL_OFFSET_DISTANCE * scaleY;
    const offsetX = dx === 0 ? 0 : dx * (halfWidth + marginX);
    const offsetY = dy === 0 ? 0 : dy * (halfHeight + marginY);
    return { x: offsetX, y: offsetY };
  }

  function normalizeAngle(angle) {
    const tau = Math.PI * 2;
    if (!Number.isFinite(angle)) return 0;
    let normalized = angle % tau;
    if (normalized <= -Math.PI) normalized += tau;
    if (normalized > Math.PI) normalized -= tau;
    return normalized;
  }

  function angleDistance(a, b) {
    const tau = Math.PI * 2;
    if (!Number.isFinite(a) || !Number.isFinite(b)) return Math.PI;
    const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b)) % tau;
    return diff > Math.PI ? tau - diff : diff;
  }

  function selectLabelPlacement(point, pos, connections, pointMap) {
    if (!point || !pos) return LABEL_PLACEMENT_CANDIDATES[0];
    const boardWidthPx = boardContentWidth;
    const boardHeightPx = boardContentHeight;
    const neighborAngles = [];
    if (connections && connections.size) {
      connections.forEach(neighborId => {
        const neighbor = pointMap.get(neighborId);
        if (!neighbor) return;
        const neighborPos = toPixel(neighbor);
        if (!neighborPos) return;
        const angle = Math.atan2(neighborPos.y - pos.y, neighborPos.x - pos.x);
        neighborAngles.push(angle);
      });
    }

    let best = null;
    const fontSize = normalizeLabelFontSize(STATE.labelFontSize);
    const labelTextLength = point && typeof point.label === 'string' && point.label
      ? point.label.length
      : 1;
    const approxWidth = Math.max(LABEL_OFFSET_DISTANCE * 2 * boardScaleX, fontSize * (labelTextLength * 0.6 + 1.4));
    const approxHeight = Math.max(LABEL_OFFSET_DISTANCE * 2 * boardScaleY, fontSize * 1.6);
    const horizontalMargin = LABEL_EDGE_MARGIN + approxWidth / 2;
    const verticalMargin = LABEL_EDGE_MARGIN + approxHeight / 2;

    LABEL_PLACEMENT_CANDIDATES.forEach((candidate, index) => {
      const offset = computePlacementOffset(candidate, { width: approxWidth, height: approxHeight }, { x: boardScaleX, y: boardScaleY });
      const placementAngle = Math.atan2(offset.y, offset.x);
      const minAngleDiff = neighborAngles.length
        ? Math.min(...neighborAngles.map(angle => angleDistance(placementAngle, angle)))
        : Math.PI;
      const nearLine = minAngleDiff < LABEL_LINE_AVOIDANCE_THRESHOLD;
      const centerX = pos.x * boardScaleX + offset.x + boardOffsetX;
      const centerY = pos.y * boardScaleY + offset.y + boardOffsetY;
      const insideX = centerX >= boardOffsetX + horizontalMargin
        && centerX <= boardOffsetX + boardWidthPx - horizontalMargin;
      const insideY = centerY >= boardOffsetY + verticalMargin
        && centerY <= boardOffsetY + boardHeightPx - verticalMargin;
      const inside = insideX && insideY;
      const score = (inside ? 1 : 0) * 10 + minAngleDiff - (nearLine ? LABEL_LINE_PENALTY : 0) - index * 0.001;
      if (!best || score > best.score) {
        best = { candidate, score };
      }
    });
    return best ? best.candidate : LABEL_PLACEMENT_CANDIDATES[0];
  }

  function computeLabelPlacements() {
    const placements = new Map();
    const pointMap = new Map();
    STATE.points.forEach(point => {
      if (!point || !point.id) return;
      pointMap.set(point.id, point);
    });

    const connections = new Map();
    const registerConnection = (from, to) => {
      if (!from || !to) return;
      if (!pointMap.has(from) || !pointMap.has(to)) return;
      if (!connections.has(from)) connections.set(from, new Set());
      connections.get(from).add(to);
    };

    const addLines = collection => {
      if (!collection) return;
      collection.forEach(entry => {
        if (!entry) return;
        let a;
        let b;
        if (Array.isArray(entry)) {
          [a, b] = entry;
        } else if (entry && typeof entry === 'object') {
          a = entry.a;
          b = entry.b;
        }
        if (!a || !b) return;
        registerConnection(String(a), String(b));
        registerConnection(String(b), String(a));
      });
    };

    addLines(STATE.answerLines);
    addLines(STATE.predefinedLines);
    userLines.forEach(key => {
      const pair = keyToPair(key);
      if (!pair) return;
      addLines([pair]);
    });

    STATE.points.forEach(point => {
      if (!point || !point.id) return;
      const pos = toPixel(point);
      const placement = selectLabelPlacement(point, pos, connections.get(point.id), pointMap);
      placements.set(point.id, placement);
    });
    return placements;
  }

  function recomputeLabelPlacements() {
    labelPlacements = computeLabelPlacements();
  }

  function applyLabelPlacements() {
    STATE.points.forEach(point => {
      if (!point || !point.id) return;
      const label = labelElements.get(point.id);
      if (!label) return;
      const pos = toPixel(point);
      const placement = labelPlacements.get(point.id);
      label.setPosition(pos, placement);
    });
  }

  function refreshLabelPlacements() {
    computeBoardScale();
    recomputeLabelPlacements();
    applyLabelPlacements();
  }

  function positionBoardLabel(element, pos, placement) {
    if (!element || !pos) return;
    const width = element.offsetWidth || element.getBoundingClientRect().width || 0;
    const height = element.offsetHeight || element.getBoundingClientRect().height || 0;
    const anchorX = pos.x * boardScaleX + boardOffsetX;
    const anchorY = pos.y * boardScaleY + boardOffsetY;
    const offset = computePlacementOffset(
      placement,
      { width, height },
      { x: boardScaleX, y: boardScaleY }
    );
    const left = anchorX + offset.x - width / 2;
    const top = anchorY + offset.y - height / 2;
    element.style.transform = `translate(${left}px, ${top}px)`;
  }

  function createBoardLabel(point, pos) {
    if (!labelLayer) return null;
    const wrapper = document.createElement('div');
    wrapper.className = 'board-label';
    if (point && point.isFalse) wrapper.classList.add('board-label--false');
    const pointId = point && point.id ? point.id : null;
    if (pointId) wrapper.dataset.pointId = pointId;
    wrapper.setAttribute('role', 'button');
    wrapper.setAttribute('tabindex', '0');
    wrapper.setAttribute('aria-pressed', 'false');
    const accessibleLabel = getPointLabelText(point);
    if (accessibleLabel) {
      wrapper.setAttribute('aria-label', `Punkt ${accessibleLabel}`);
    }
    wrapper.addEventListener('pointerdown', event => {
      if (!pointId) return;
      if (typeof wrapper.focus === 'function') {
        try {
          wrapper.focus({ preventScroll: true });
        } catch (_) {
          wrapper.focus();
        }
      }
      handlePointPointerDown(wrapper, pointId, event);
    });
    wrapper.addEventListener('keydown', event => {
      if (!pointId) return;
      const key = event.key;
      if (key === 'Enter' || key === ' ') {
        event.preventDefault();
        handlePointSelection(pointId);
      }
    });
    if (!STATE.showLabels) wrapper.style.display = 'none';
    const content = document.createElement('span');
    content.className = 'board-label-content';
    wrapper.appendChild(content);
    const prefix = document.createElement('span');
    prefix.className = 'board-label-prefix';
    prefix.textContent = ' ';
    const text = document.createElement('span');
    text.className = 'board-label-text';
    content.append(prefix, text);
    renderLatex(text, getPointLabelText(point));
    const initialPlacement = pointId ? labelPlacements.get(pointId) : null;
    positionBoardLabel(wrapper, pos, initialPlacement);
    return {
      element: wrapper,
      contentEl: text,
      setPosition(newPos, newPlacement) {
        const placement = newPlacement != null ? newPlacement : (pointId ? labelPlacements.get(pointId) : null);
        positionBoardLabel(wrapper, newPos, placement);
      },
      setText(value) {
        renderLatex(text, value);
      },
      setVisibility(show) {
        wrapper.style.display = show ? '' : 'none';
      },
      setFalse(isFalse) {
        wrapper.classList.toggle('board-label--false', !!isFalse);
      },
      setSelected(isSelected) {
        const active = !!isSelected;
        wrapper.classList.toggle('is-selected', active);
        wrapper.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
    };
  }

  function applyLabelFontSize() {
    const fontSize = normalizeLabelFontSize(STATE.labelFontSize);
    STATE.labelFontSize = fontSize;
    if (labelLayer) {
      labelLayer.style.fontSize = `${fontSize}px`;
    }
  }

  function syncLabelFontSizeControl() {
    if (!labelFontSizeSelect) return;
    const fontSize = normalizeLabelFontSize(STATE.labelFontSize);
    STATE.labelFontSize = fontSize;
    const stringValue = String(fontSize);
    const options = Array.from(labelFontSizeSelect.options || []);
    const hasMatchingOption = options.some(option => option.value === stringValue);
    if (!hasMatchingOption) {
      if (!customLabelFontSizeOption) {
        customLabelFontSizeOption = document.createElement('option');
        customLabelFontSizeOption.dataset.customOption = 'true';
        labelFontSizeSelect.appendChild(customLabelFontSizeOption);
      }
      customLabelFontSizeOption.value = stringValue;
      customLabelFontSizeOption.textContent = `${fontSize}px`;
    } else if (customLabelFontSizeOption) {
      customLabelFontSizeOption.remove();
      customLabelFontSizeOption = null;
    }
    labelFontSizeSelect.value = stringValue;
  }

  function updateAllLabelPositions() {
    refreshLabelPlacements();
  }

  function parseCoordinateInput(value) {
    if (typeof value !== 'string') return null;
    const matches = value.match(/-?\d+(?:[.,]\d+)?/g);
    if (!matches || matches.length < 2) return null;
    const parsePart = str => {
      const normalized = str.replace(',', '.');
      const num = Number(normalized);
      if (!Number.isFinite(num)) return null;
      if (Math.abs(num) > 1) return num / 100;
      return num;
    };
    const x = parsePart(matches[0]);
    const y = parsePart(matches[1]);
    if (x == null || y == null) return null;
    return { x, y };
  }

  function snapToGridValue(value) {
    if (!Number.isFinite(value)) return 0;
    const step = GRID_BASE_STEP;
    if (!Number.isFinite(step) || step <= 0) return sanitizeCoordinate(value);
    const snapped = Math.round(value / step) * step;
    return sanitizeCoordinate(Number(snapped.toFixed(4)));
  }

  function computeAxisDecimals(step) {
    if (!Number.isFinite(step) || step <= 0) return 2;
    let decimals = 0;
    let scaled = Math.abs(step);
    while (scaled < 1 && decimals < 6) {
      scaled *= 10;
      decimals += 1;
    }
    return Math.min(decimals + 1, 6);
  }

  function formatAxisValue(value) {
    if (!Number.isFinite(value)) return '0';
    return percentString(value);
  }

  function makeLineKey(a, b) {
    const idA = String(a);
    const idB = String(b);
    if (!idA || !idB) return null;
    if (idA === idB) return null;
    return idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
  }

  function keyToPair(key) {
    const parts = String(key).split('|');
    return { a: parts[0], b: parts[1] };
  }

  function removePredefinedLineByKey(key) {
    const idx = STATE.predefinedLines.findIndex(([a, b]) => makeLineKey(a, b) === key);
    if (idx < 0) return false;
    STATE.predefinedLines.splice(idx, 1);
    return true;
  }

  function togglePredefinedLineBetween(a, b) {
    const key = makeLineKey(a, b);
    if (!key) return null;
    const existingIdx = STATE.predefinedLines.findIndex(([from, to]) => makeLineKey(from, to) === key);
    if (existingIdx >= 0) {
      STATE.predefinedLines.splice(existingIdx, 1);
      return { added: false, key };
    }
    const pair = keyToPair(key);
    STATE.predefinedLines.push([pair.a, pair.b]);
    return { added: true, key };
  }

  function updatePredefToolUI() {
    if (predefToolEl) predefToolEl.hidden = !isEditMode;
    const isActive = isEditMode && isPredefDrawingMode;
    if (predefToggleBtn) {
      predefToggleBtn.textContent = isActive ? 'Avslutt strektegning' : 'Tegn forhåndsdefinerte streker';
      predefToggleBtn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      predefToggleBtn.disabled = !isEditMode;
    }
    if (predefHelperTextEl) {
      predefHelperTextEl.textContent = isActive
        ? 'Klikk på to punkter for å legge til eller fjerne en forhåndsdefinert strek. Klikk på knappen når du er ferdig.'
        : 'Aktiver tegning for å legge til eller fjerne forhåndsdefinerte streker.';
    }
    const body = document.body;
    if (body) body.classList.toggle('is-predef-mode', isEditMode && isPredefDrawingMode);
  }

  function setPredefDrawingMode(active) {
    const next = !!active && isEditMode;
    if (next === isPredefDrawingMode) {
      updatePredefToolUI();
      return;
    }
    isPredefDrawingMode = next;
    if (!isPredefDrawingMode) {
      predefAnchorPointId = null;
      selectedPointId = null;
    }
    updatePredefToolUI();
    applySelectionHighlight();
    updateModeHint();
  }

  function handlePredefLineSelection(pointId) {
    if (!isPredefDrawingMode) return;
    if (predefAnchorPointId == null) {
      predefAnchorPointId = pointId;
    } else if (predefAnchorPointId === pointId) {
      predefAnchorPointId = null;
      selectedPointId = null;
      applySelectionHighlight();
      return;
    } else {
      const key = makeLineKey(predefAnchorPointId, pointId);
      if (key) {
        const { a, b } = keyToPair(key);
        if (realPointIds.has(a) && realPointIds.has(b)) {
          togglePredefinedLineBetween(a, b);
          clearStatus();
          predefAnchorPointId = pointId;
          selectedPointId = pointId;
          renderBoard();
          return;
        }
      }
      predefAnchorPointId = pointId;
    }
    selectedPointId = predefAnchorPointId;
    applySelectionHighlight();
  }

  function sanitizeLineList(list, validPoints) {
    if (!Array.isArray(list)) return [];
    const sanitized = [];
    const seen = new Set();
    list.forEach(entry => {
      if (!entry) return;
      let first;
      let second;
      if (Array.isArray(entry)) {
        [first, second] = entry;
      } else if (typeof entry === 'object') {
        first = entry.from != null ? entry.from : entry.a != null ? entry.a : entry[0];
        second = entry.to != null ? entry.to : entry.b != null ? entry.b : entry[1];
      } else {
        return;
      }
      const idA = first != null ? String(first) : '';
      const idB = second != null ? String(second) : '';
      if (!validPoints.has(idA) || !validPoints.has(idB)) return;
      const key = makeLineKey(idA, idB);
      if (!key || seen.has(key)) return;
      seen.add(key);
      const [a, b] = key.split('|');
      sanitized.push([a, b]);
    });
    return sanitized;
  }

  function buildSequentialAnswerLines(points) {
    if (!Array.isArray(points)) return [];
    const ordered = points.filter(point => point && !point.isFalse);
    const sequential = [];
    const usedKeys = new Set();
    let previous = null;
    ordered.forEach(point => {
      if (previous) {
        const key = makeLineKey(previous.id, point.id);
        if (key && !usedKeys.has(key)) {
          sequential.push([previous.id, point.id]);
          usedKeys.add(key);
        }
      }
      previous = point;
    });
    return sequential;
  }

  function normalizeViewSnapshot(rawView, { allowNull = false } = {}) {
    if (!rawView || typeof rawView !== 'object') {
      return allowNull ? null : { zoom: DEFAULT_ZOOM, panX: 0, panY: 0 };
    }
    const zoom = clampZoom(rawView.zoom);
    const panX = sanitizeCoordinate(rawView.panX);
    const panY = sanitizeCoordinate(rawView.panY);
    return { zoom, panX, panY };
  }

  function clonePointsForStorage(points) {
    if (!Array.isArray(points)) return [];
    const usedIds = new Set();
    const normalized = [];
    points.forEach((point, idx) => {
      if (!point || typeof point !== 'object') return;
      let id = typeof point.id === 'string' && point.id.trim() ? point.id : `p${idx + 1}`;
      while (usedIds.has(id)) {
        id = `${id}_${usedIds.size + 1}`;
      }
      usedIds.add(id);
      const label = typeof point.label === 'string' && point.label.trim() ? point.label : String(idx + 1);
      normalized.push({
        id,
        label,
        x: sanitizeCoordinate(point.x),
        y: sanitizeCoordinate(point.y),
        isFalse: !!point.isFalse
      });
    });
    return normalized;
  }

  function normalizeTaskSnapshot(rawTask) {
    if (!rawTask || typeof rawTask !== 'object') return null;
    const points = clonePointsForStorage(rawTask.points);
    const validPoints = new Set(points.map(point => point.id));
    const predefinedLines = sanitizeLineList(rawTask.predefinedLines, validPoints);
    const answerLinesInput = sanitizeLineList(rawTask.answerLines, validPoints);
    const answerLines = answerLinesInput.length ? answerLinesInput : buildSequentialAnswerLines(points);
    const labelFontSize = normalizeLabelFontSize(rawTask.labelFontSize);
    const view = normalizeViewSnapshot(rawTask.view);
    const nextPointId = Number.isFinite(rawTask.nextPointId) ? rawTask.nextPointId : points.length + 1;
    const coordinateOrigin = typeof rawTask.coordinateOrigin === 'string' && rawTask.coordinateOrigin
      ? rawTask.coordinateOrigin
      : 'bottom-left';
    return {
      coordinateOrigin,
      points,
      answerLines,
      predefinedLines,
      showLabels: rawTask.showLabels === false ? false : true,
      labelFontSize,
      nextPointId,
      showGrid: rawTask.showGrid === false ? false : true,
      snapToGrid: !!rawTask.snapToGrid,
      view
    };
  }

  function normalizeProgressSnapshot(rawProgress, validPoints) {
    const normalized = {};
    if (!rawProgress || typeof rawProgress !== 'object') return normalized;
    const progressLines = sanitizeLineList(rawProgress.lines, validPoints);
    if (progressLines.length) normalized.lines = progressLines;
    const view = normalizeViewSnapshot(rawProgress.view, { allowNull: true });
    if (view) normalized.view = view;
    return normalized;
  }

  function createCleanState() {
    const task = normalizeTaskSnapshot({ ...STATE, view: getViewSettings() });
    if (!task) return null;
    const validPoints = new Set(task.points.map(point => point.id));
    const progress = {};
    const progressLines = sanitizeLineList(Array.from(userLines).map(key => keyToPair(key)), validPoints);
    if (progressLines.length) progress.lines = progressLines;
    if (hasUserAdjustedView) {
      progress.view = normalizeViewSnapshot(getViewSettings());
    }
    return {
      v: STORAGE_SCHEMA_VERSION,
      task,
      progress,
      mode: isEditMode ? 'edit' : 'play'
    };
  }

  function loadCleanState(rawState) {
    const base = rawState && typeof rawState === 'object' ? rawState : null;
    if (!base) return false;
    const taskCandidate = base.task && typeof base.task === 'object' ? base.task : base;
    const task = normalizeTaskSnapshot(taskCandidate);
    if (!task) return false;
    const validPoints = new Set(task.points.map(point => point.id));
    const progress = normalizeProgressSnapshot(base.progress, validPoints);
    const normalizedMode = typeof base.mode === 'string' ? base.mode : null;

    STATE.coordinateOrigin = task.coordinateOrigin;
    STATE.points = task.points;
    STATE.answerLines = task.answerLines;
    STATE.predefinedLines = task.predefinedLines;
    STATE.showLabels = task.showLabels;
    STATE.labelFontSize = task.labelFontSize;
    STATE.nextPointId = task.nextPointId;
    STATE.showGrid = task.showGrid;
    STATE.snapToGrid = task.snapToGrid;
    STATE.view = task.view || { zoom: DEFAULT_ZOOM, panX: 0, panY: 0 };

    userLines.clear();
    if (progress.lines) {
      progress.lines.forEach(([a, b]) => {
        const key = makeLineKey(a, b);
        if (key) userLines.add(key);
      });
    }

    hasUserAdjustedView = !!progress.view;
    if (progress.view) {
      STATE.view = progress.view;
    }

    selectedPointId = null;
    predefAnchorPointId = null;

    rebuildAll(false);
    clearStatus();
    if (normalizedMode) applyModeChange(normalizedMode);

    if (typeof window !== 'undefined') {
      window.STATE = STATE;
      window.STATE_V2 = {
        v: STORAGE_SCHEMA_VERSION,
        task: deepClone(task),
        progress: deepClone(progress),
        mode: normalizedMode
      };
    }

    return true;
  }

  function ensureBottomLeftOrigin() {
    if (!STATE || typeof STATE !== 'object') return;
    const origin = typeof STATE.coordinateOrigin === 'string' ? STATE.coordinateOrigin : null;
    if (origin === 'bottom-left') return;
    if (Array.isArray(STATE.points)) {
      STATE.points = STATE.points.map(point => {
        if (!point || typeof point !== 'object') return point;
        const clone = { ...point };
        const rawY = Number(point.y);
        if (Number.isFinite(rawY)) clone.y = 1 - rawY;
        return clone;
      });
    }
    STATE.coordinateOrigin = 'bottom-left';
  }

  function sanitizeState() {
    ensureBottomLeftOrigin();
    if (!Array.isArray(STATE.points)) STATE.points = [];
    const sanitizedPoints = [];
    const usedIds = new Set();
    STATE.points.forEach((point, idx) => {
      if (!point || typeof point !== 'object') return;
      let id = point.id;
      if (typeof id !== 'string' || !id) id = `p${idx + 1}`;
      if (usedIds.has(id)) {
        let suffix = 1;
        let candidate = `${id}_${suffix}`;
        while (usedIds.has(candidate)) {
          suffix += 1;
          candidate = `${id}_${suffix}`;
        }
        id = candidate;
      }
      const sanitizedPoint = {
        id,
        label: typeof point.label === 'string' ? point.label : String(idx + 1),
        x: sanitizeCoordinate(point.x),
        y: sanitizeCoordinate(point.y),
        isFalse: !!point.isFalse
      };
      usedIds.add(id);
      sanitizedPoints.push(sanitizedPoint);
    });
    STATE.points = sanitizedPoints;
    const validPoints = new Set(sanitizedPoints.map(p => p.id));
    realPointIds = new Set();
    sanitizedPoints.forEach(point => {
      if (point && !point.isFalse) realPointIds.add(point.id);
    });
    STATE.predefinedLines = sanitizeLineList(STATE.predefinedLines, realPointIds);
    STATE.answerLines = buildSequentialAnswerLines(sanitizedPoints);
    let nextCandidate = 1;
    sanitizedPoints.forEach(point => {
      const match = point.id.match(/([0-9]+)$/);
      if (!match) return;
      const num = parseInt(match[1], 10);
      if (Number.isFinite(num) && num + 1 > nextCandidate) nextCandidate = num + 1;
    });
    if (!Number.isFinite(STATE.nextPointId) || STATE.nextPointId < nextCandidate) {
      STATE.nextPointId = nextCandidate;
    }
    STATE.showLabels = true;
    STATE.labelFontSize = normalizeLabelFontSize(STATE.labelFontSize);
    STATE.showGrid = !!STATE.showGrid;
    STATE.snapToGrid = !!STATE.snapToGrid;
    if (sanitizedPoints.length === 0) {
      resetViewToDefault();
    } else {
      ensureViewFitsPoints(sanitizedPoints);
    }
    getViewSettings();
    if (predefAnchorPointId != null && !validPoints.has(predefAnchorPointId)) {
      predefAnchorPointId = null;
      if (isPredefDrawingMode) selectedPointId = null;
    }
    currentValidPoints = validPoints;
    return validPoints;
  }

  function syncBaseLines(validPoints) {
    baseLines.clear();
    STATE.predefinedLines.forEach(([a, b]) => {
      const key = makeLineKey(a, b);
      if (key) baseLines.add(key);
    });
    const toDelete = [];
    userLines.forEach(key => {
      const { a, b } = keyToPair(key);
      if (!validPoints.has(a) || !validPoints.has(b) || baseLines.has(key) || !realPointIds.has(a) || !realPointIds.has(b)) {
        toDelete.push(key);
      }
    });
    toDelete.forEach(key => userLines.delete(key));
  }

  function prepareState() {
    const validPoints = sanitizeState();
    const view = getViewSettings();
    syncBaseLines(validPoints);
    document.body.classList.toggle('labels-hidden', !STATE.showLabels);
    applyLabelFontSize();
    syncLabelFontSizeControl();
    syncViewControls(view);
    return validPoints;
  }

  function toPixel(point, viewOverride) {
    const view = viewOverride && typeof viewOverride === 'object' ? viewOverride : getViewSettings();
    const normX = sanitizeCoordinate(point && point.x);
    const normY = sanitizeCoordinate(point && point.y);
    const relativeX = view.viewWidth > 0 ? (normX - view.panX) / view.viewWidth : 0;
    const relativeY = view.viewHeight > 0 ? (normY - view.panY) / view.viewHeight : 0;
    const clampedX = clamp01(relativeX);
    const clampedY = clamp01(relativeY);
    return {
      x: clampedX * BOARD_WIDTH,
      y: (1 - clampedY) * BOARD_HEIGHT
    };
  }

  function setLineAttrs(line, p1, p2) {
    const pos1 = toPixel(p1);
    const pos2 = toPixel(p2);
    line.setAttribute('x1', pos1.x);
    line.setAttribute('y1', pos1.y);
    line.setAttribute('x2', pos2.x);
    line.setAttribute('y2', pos2.y);
  }

  function clientToNormalized(clientX, clientY, viewOverride) {
    const rect = board.getBoundingClientRect();
    computeBoardScale();
    const width = boardClientWidth || rect.width || 1;
    const height = boardClientHeight || rect.height || 1;
    const contentWidth = boardContentWidth || width;
    const contentHeight = boardContentHeight || height;
    const rawX = (clientX - rect.left - boardOffsetX) / contentWidth;
    const rawY = (clientY - rect.top - boardOffsetY) / contentHeight;
    const localX = clamp01(rawX);
    const localY = clamp01(1 - rawY);
    const view = viewOverride && typeof viewOverride === 'object' ? viewOverride : getViewSettings();
    return {
      x: sanitizeCoordinate(view.panX + localX * view.viewWidth),
      y: sanitizeCoordinate(view.panY + localY * view.viewHeight)
    };
  }

  function updatePointEditorValues(pointId) {
    const editor = pointEditors.get(pointId);
    const point = STATE.points.find(p => p.id === pointId);
    if (!editor || !point) return;
    if (editor.labelInput) editor.labelInput.value = point.label;
    if (editor.coordInput) editor.coordInput.value = coordinateString(point);
  }

  function updateLinesForPoint(pointId) {
    const pointMap = new Map(STATE.points.map(p => [p.id, p]));
    const updater = collection => {
      collection.forEach(data => {
        if (data.a !== pointId && data.b !== pointId) return;
        const p1 = pointMap.get(data.a);
        const p2 = pointMap.get(data.b);
        if (!p1 || !p2) return;
        setLineAttrs(data.element, p1, p2);
      });
    };
    updater(baseLineElements);
    updater(userLineElements);
    updater(answerLineElements);
  }

  function handlePointPointerDown(element, pointId, event) {
    if (!element || !event) return false;
    event.preventDefault();
    const point = STATE.points.find(p => p && p.id === pointId);
    if (!point) return false;
    if (!isEditMode) {
      handlePointSelection(pointId);
      return true;
    }
    const pointerId = event.pointerId;
    const dragThreshold = getPointDragThreshold(event);
    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const viewOnStart = getViewSettings();
    const startNorm = clientToNormalized(startClientX, startClientY, viewOnStart);
    const offsetX = startNorm.x - point.x;
    const offsetY = startNorm.y - point.y;
    let moved = false;
    let dragging = false;
    const dragThresholdSq = dragThreshold * dragThreshold;
    const onMove = e => {
      if (!isEditMode) return;
      const dxClient = e.clientX - startClientX;
      const dyClient = e.clientY - startClientY;
      if (!dragging) {
        const distanceSq = dxClient * dxClient + dyClient * dyClient;
        if (distanceSq < dragThresholdSq) return;
        dragging = true;
      }
      moved = true;
      const { x, y } = clientToNormalized(e.clientX, e.clientY, viewOnStart);
      updatePointPosition(pointId, x - offsetX, y - offsetY);
    };
    const onEnd = () => {
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onEnd);
      element.removeEventListener('pointercancel', onEnd);
      try {
        element.releasePointerCapture(pointerId);
      } catch (_) {}
      if (!moved) handlePointSelection(pointId);
      else updatePointEditorValues(pointId);
    };
    try {
      element.setPointerCapture(pointerId);
    } catch (_) {}
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onEnd);
    element.addEventListener('pointercancel', onEnd);
    return true;
  }

  function attachPointInteraction(element, pointId) {
    element.addEventListener('pointerdown', event => {
      handlePointPointerDown(element, pointId, event);
    });
  }

  function getPointDragThreshold(event) {
    const coarsePointerThreshold = Number.isFinite(POINT_DRAG_START_DISTANCE_COARSE_PX)
      ? POINT_DRAG_START_DISTANCE_COARSE_PX
      : POINT_DRAG_START_DISTANCE_PX;
    const baseThreshold = Number.isFinite(POINT_DRAG_START_DISTANCE_PX) && POINT_DRAG_START_DISTANCE_PX > 0
      ? POINT_DRAG_START_DISTANCE_PX
      : 1;
    if (!event || typeof event !== 'object') return baseThreshold;
    const pointerType = typeof event.pointerType === 'string'
      ? event.pointerType.toLowerCase()
      : '';
    const width = Number(event.width);
    const height = Number(event.height);
    const hasCoarseDimensions = (Number.isFinite(width) && width > 1.5)
      || (Number.isFinite(height) && height > 1.5);
    const isCoarse = pointerType === 'touch'
      || pointerType === 'pen'
      || hasCoarseDimensions;
    if (isCoarse) {
      return coarsePointerThreshold > 0 ? coarsePointerThreshold : baseThreshold;
    }
    return baseThreshold;
  }

  function getPointListContainers() {
    const containers = [];
    if (pointListEl) containers.push(pointListEl);
    if (falsePointListEl) containers.push(falsePointListEl);
    return containers;
  }

  function updatePointPosition(pointId, normX, normY) {
    const point = STATE.points.find(p => p.id === pointId);
    if (!point) return;
    let newX = sanitizeCoordinate(normX);
    let newY = sanitizeCoordinate(normY);
    if (STATE.snapToGrid) {
      newX = snapToGridValue(newX);
      newY = snapToGridValue(newY);
    }
    point.x = newX;
    point.y = newY;
    const pos = toPixel(point);
    const visual = pointElements.get(pointId);
    if (visual) {
      updatePointVisualPosition(visual, point, pos);
    }
    const label = labelElements.get(pointId);
    if (label) {
      label.setText(getPointLabelText(point));
      label.setVisibility(STATE.showLabels);
      label.setFalse(!!point.isFalse);
    }
    updateLinesForPoint(pointId);
    refreshLabelPlacements();
  }

  function normalizePointLabel(value) {
    if (typeof value === 'string') return value;
    if (value == null) return '';
    return String(value);
  }

  function updatePointLabel(pointId, rawLabel) {
    const point = STATE.points.find(p => p.id === pointId);
    if (!point) return;
    const nextLabel = normalizePointLabel(rawLabel);
    if (point.label === nextLabel) return;
    point.label = nextLabel;
    STATE.answerLines = buildSequentialAnswerLines(STATE.points);
    const label = labelElements.get(pointId);
    if (label) {
      label.setText(getPointLabelText(point));
      label.setVisibility(STATE.showLabels);
      label.setFalse(!!point.isFalse);
    }
    renderBoard(currentValidPoints);
  }

  function snapAllPointsToGrid() {
    if (!STATE.snapToGrid) return false;
    let changed = false;
    STATE.points.forEach(point => {
      if (!point) return;
      const snappedX = snapToGridValue(point.x);
      const snappedY = snapToGridValue(point.y);
      if (snappedX !== point.x || snappedY !== point.y) {
        point.x = snappedX;
        point.y = snappedY;
        changed = true;
      }
    });
    return changed;
  }

  function applyZoom(rawZoom, options) {
    const view = getViewSettings();
    const nextZoom = clampZoom(rawZoom);
    const focus = options && typeof options.focus === 'object' ? options.focus : null;
    const focusX = focus && Number.isFinite(focus.x)
      ? sanitizeCoordinate(focus.x)
      : view.panX + view.viewWidth / 2;
    const focusY = focus && Number.isFinite(focus.y)
      ? sanitizeCoordinate(focus.y)
      : view.panY + view.viewHeight / 2;
    if (Math.abs(nextZoom - view.zoom) < 1e-6) {
      syncViewControls(view);
      return false;
    }
    const nextViewWidth = nextZoom > 0 ? 1 / nextZoom : 1;
    const nextViewHeight = nextZoom > 0 ? 1 / nextZoom : 1;
    const nextPanCandidateMinX = WORLD_MIN_X;
    const nextPanCandidateMaxX = WORLD_MAX_X - nextViewWidth;
    const nextPanCandidateMinY = WORLD_MIN_Y;
    const nextPanCandidateMaxY = WORLD_MAX_Y - nextViewHeight;
    const nextPanMinX = Math.min(nextPanCandidateMinX, nextPanCandidateMaxX);
    const nextPanMaxX = Math.max(nextPanCandidateMinX, nextPanCandidateMaxX);
    const nextPanMinY = Math.min(nextPanCandidateMinY, nextPanCandidateMaxY);
    const nextPanMaxY = Math.max(nextPanCandidateMinY, nextPanCandidateMaxY);
    const offsetX = view.viewWidth > 0 ? (focusX - view.panX) / view.viewWidth : 0.5;
    const offsetY = view.viewHeight > 0 ? (focusY - view.panY) / view.viewHeight : 0.5;
    let nextPanX = focusX - offsetX * nextViewWidth;
    let nextPanY = focusY - offsetY * nextViewHeight;
    nextPanX = clamp(nextPanX, nextPanMinX, nextPanMaxX);
    nextPanY = clamp(nextPanY, nextPanMinY, nextPanMaxY);
    STATE.view = { zoom: nextZoom, panX: nextPanX, panY: nextPanY };
    if (options && options.userAction) markViewAdjustedByUser();
    renderBoard(currentValidPoints);
    return true;
  }

  function updateZoom(rawZoom) {
    applyZoom(rawZoom, { userAction: true });
  }

  function updatePan(axis, rawValue) {
    const view = getViewSettings();
    let nextPanX = view.panX;
    let nextPanY = view.panY;
    if (axis === 'x') {
      nextPanX = clamp(rawValue, view.panMinX, view.panMaxX);
    } else {
      nextPanY = clamp(rawValue, view.panMinY, view.panMaxY);
    }
    if (Math.abs(nextPanX - view.panX) < 1e-6 && Math.abs(nextPanY - view.panY) < 1e-6) {
      syncViewControls(view);
      return;
    }
    STATE.view = { zoom: view.zoom, panX: nextPanX, panY: nextPanY };
    markViewAdjustedByUser();
    renderBoard(currentValidPoints);
  }

  function getBoardDimensions() {
    if (!board) {
      return { width: BOARD_WIDTH, height: BOARD_HEIGHT };
    }
    const rect = board.getBoundingClientRect();
    const width = rect.width || BOARD_WIDTH;
    const height = rect.height || BOARD_HEIGHT;
    return {
      width: width || BOARD_WIDTH,
      height: height || BOARD_HEIGHT
    };
  }

  function updateBoardInteractionState() {
    if (!board) return;
    const interacting = !!boardPanSession || !!boardPinchSession;
    board.classList.toggle('is-panning', interacting);
  }

  function resetBoardInteractionState() {
    activeBoardPointers.forEach((entry, pointerId) => {
      if (!entry || !entry.captured) return;
      try {
        board.releasePointerCapture(pointerId);
      } catch (_) {}
    });
    activeBoardPointers.clear();
    boardPanSession = null;
    boardPinchSession = null;
    updateBoardInteractionState();
  }

  function getPanCapablePointers() {
    return Array.from(activeBoardPointers.entries()).filter(([, entry]) => entry && entry.canPan);
  }

  function startBoardPanSession(pointerId, entry) {
    if (!board || !isEditMode || !entry || !entry.canPan) return;
    const view = getViewSettings();
    const { width, height } = getBoardDimensions();
    boardPanSession = {
      pointerId,
      startClientX: entry.clientX,
      startClientY: entry.clientY,
      panX: view.panX,
      panY: view.panY,
      boardWidth: width || 1,
      boardHeight: height || 1
    };
    updateBoardInteractionState();
  }

  function endBoardPanSession() {
    boardPanSession = null;
    updateBoardInteractionState();
  }

  function startBoardPanSessionFromPointer(pointerId, entry) {
    if (!entry) return;
    startBoardPanSession(pointerId, entry);
  }

  function startBoardPinchSession() {
    if (!board || !isEditMode || boardPinchSession) return;
    const panPointers = getPanCapablePointers();
    if (panPointers.length < 2) return;
    const [id1, first] = panPointers[0];
    const [id2, second] = panPointers[1];
    const centerX = (first.clientX + second.clientX) / 2;
    const centerY = (first.clientY + second.clientY) / 2;
    const dx = second.clientX - first.clientX;
    const dy = second.clientY - first.clientY;
    const distance = Math.hypot(dx, dy);
    const { width, height } = getBoardDimensions();
    boardPinchSession = {
      id1,
      id2,
      prevCenterX: centerX,
      prevCenterY: centerY,
      prevDistance: distance > 0 ? distance : 1,
      boardWidth: width || 1,
      boardHeight: height || 1
    };
    boardPanSession = null;
    updateBoardInteractionState();
  }

  function endBoardPinchSession() {
    boardPinchSession = null;
    updateBoardInteractionState();
  }

  function updateBoardPanGesture(pointerId) {
    if (!boardPanSession || boardPanSession.pointerId !== pointerId) return false;
    const entry = activeBoardPointers.get(pointerId);
    if (!entry) return false;
    const view = getViewSettings();
    const { width, height } = getBoardDimensions();
    const startWidth = width || boardPanSession.boardWidth || BOARD_WIDTH;
    const startHeight = height || boardPanSession.boardHeight || BOARD_HEIGHT;
    const dx = entry.clientX - boardPanSession.startClientX;
    const dy = entry.clientY - boardPanSession.startClientY;
    const deltaX = startWidth ? dx / startWidth : 0;
    const deltaY = startHeight ? dy / startHeight : 0;
    let nextPanX = boardPanSession.panX - deltaX * view.viewWidth;
    let nextPanY = boardPanSession.panY + deltaY * view.viewHeight;
    nextPanX = clamp(nextPanX, view.panMinX, view.panMaxX);
    nextPanY = clamp(nextPanY, view.panMinY, view.panMaxY);
    if (Math.abs(nextPanX - view.panX) < 1e-6 && Math.abs(nextPanY - view.panY) < 1e-6) {
      return false;
    }
    STATE.view = { zoom: view.zoom, panX: nextPanX, panY: nextPanY };
    markViewAdjustedByUser();
    renderBoard(currentValidPoints);
    const updatedView = getViewSettings();
    boardPanSession.panX = updatedView.panX;
    boardPanSession.panY = updatedView.panY;
    boardPanSession.startClientX = entry.clientX;
    boardPanSession.startClientY = entry.clientY;
    boardPanSession.boardWidth = startWidth;
    boardPanSession.boardHeight = startHeight;
    return true;
  }

  function updateBoardPinchGesture() {
    if (!boardPinchSession) return false;
    const first = activeBoardPointers.get(boardPinchSession.id1);
    const second = activeBoardPointers.get(boardPinchSession.id2);
    if (!first || !second) {
      endBoardPinchSession();
      return false;
    }
    const view = getViewSettings();
    const centerX = (first.clientX + second.clientX) / 2;
    const centerY = (first.clientY + second.clientY) / 2;
    const dx = second.clientX - first.clientX;
    const dy = second.clientY - first.clientY;
    const distance = Math.hypot(dx, dy);
    const prevDistance = boardPinchSession.prevDistance > 0 ? boardPinchSession.prevDistance : (distance > 0 ? distance : 1);
    let scale = 1;
    if (distance > 0 && prevDistance > 0) {
      scale = distance / prevDistance;
    }
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    const { width, height } = getBoardDimensions();
    const focus = clientToNormalized(centerX, centerY, view);
    const relX = view.viewWidth > 0 ? (focus.x - view.panX) / view.viewWidth : 0.5;
    const relY = view.viewHeight > 0 ? (focus.y - view.panY) / view.viewHeight : 0.5;
    let nextZoom = clampZoom(view.zoom * scale);
    const nextViewWidth = nextZoom > 0 ? 1 / nextZoom : 1;
    const nextViewHeight = nextZoom > 0 ? 1 / nextZoom : 1;
    let nextPanX = focus.x - relX * nextViewWidth;
    let nextPanY = focus.y - relY * nextViewHeight;
    const deltaCenterX = centerX - boardPinchSession.prevCenterX;
    const deltaCenterY = centerY - boardPinchSession.prevCenterY;
    if (width > 0) nextPanX -= (deltaCenterX / width) * nextViewWidth;
    if (height > 0) nextPanY += (deltaCenterY / height) * nextViewHeight;
    const nextPanCandidateMinX = WORLD_MIN_X;
    const nextPanCandidateMaxX = WORLD_MAX_X - nextViewWidth;
    const nextPanCandidateMinY = WORLD_MIN_Y;
    const nextPanCandidateMaxY = WORLD_MAX_Y - nextViewHeight;
    const nextPanMinX = Math.min(nextPanCandidateMinX, nextPanCandidateMaxX);
    const nextPanMaxX = Math.max(nextPanCandidateMinX, nextPanCandidateMaxX);
    const nextPanMinY = Math.min(nextPanCandidateMinY, nextPanCandidateMaxY);
    const nextPanMaxY = Math.max(nextPanCandidateMinY, nextPanCandidateMaxY);
    nextPanX = clamp(nextPanX, nextPanMinX, nextPanMaxX);
    nextPanY = clamp(nextPanY, nextPanMinY, nextPanMaxY);
    const changed = Math.abs(nextPanX - view.panX) > 1e-6 || Math.abs(nextPanY - view.panY) > 1e-6 || Math.abs(nextZoom - view.zoom) > 1e-6;
    boardPinchSession.prevCenterX = centerX;
    boardPinchSession.prevCenterY = centerY;
    if (distance > 0) boardPinchSession.prevDistance = distance;
    boardPinchSession.boardWidth = width || boardPinchSession.boardWidth;
    boardPinchSession.boardHeight = height || boardPinchSession.boardHeight;
    if (!changed) return false;
    STATE.view = { zoom: nextZoom, panX: nextPanX, panY: nextPanY };
    markViewAdjustedByUser();
    renderBoard(currentValidPoints);
    return true;
  }

  function findPointAtClientPosition(clientX, clientY) {
    let bestMatch = null;
    let bestDistance = Infinity;
    pointElements.forEach((visual, id) => {
      if (!visual) return;
      const dotRect = visual.dot && typeof visual.dot.getBoundingClientRect === 'function'
        ? visual.dot.getBoundingClientRect()
        : null;
      const decoRect = visual.decoration && typeof visual.decoration.getBoundingClientRect === 'function'
        ? visual.decoration.getBoundingClientRect()
        : null;
      const rect = dotRect || decoRect;
      if (!rect) return;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let radius = Math.max(rect.width, rect.height) / 2;
      if (decoRect) {
        const decoRadius = Math.max(decoRect.width, decoRect.height) / 2;
        if (decoRadius > radius) radius = decoRadius;
      }
      if (!(radius > 0)) return;
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance > radius || distance >= bestDistance) return;
      bestDistance = distance;
      bestMatch = { id, visual };
    });
    return bestMatch;
  }

  function maybeHandleBoardPointerDownAsPoint(event) {
    if (!event || pointElements.size === 0) return false;
    const target = event.target;
    if (target && typeof target.closest === 'function' && target.closest('.point')) return false;
    const hit = findPointAtClientPosition(event.clientX, event.clientY);
    if (!hit || !hit.visual || !hit.visual.group) return false;
    const handled = handlePointPointerDown(hit.visual.group, hit.id, event);
    if (!handled) return false;
    event.stopPropagation();
    return true;
  }

  function handleBoardPointerDown(event) {
    if (!board) return;
    if (maybeHandleBoardPointerDownAsPoint(event)) return;
    const target = event.target;
    let canPan = false;
    if (isEditMode) {
      const pointTarget = target && typeof target.closest === 'function' && target.closest('.point');
      const dataType = target && target.dataset ? target.dataset.type : null;
      canPan = !pointTarget && !dataType;
    }
    const isPrimaryButton = event.button == null || event.button === 0;
    const entry = {
      clientX: event.clientX,
      clientY: event.clientY,
      canPan: canPan && isEditMode && isPrimaryButton,
      captured: false
    };
    if (entry.canPan) {
      try {
        board.setPointerCapture(event.pointerId);
        entry.captured = true;
      } catch (_) {}
    }
    activeBoardPointers.set(event.pointerId, entry);
    if (!entry.canPan) return;
    const panPointers = getPanCapablePointers();
    if (!boardPinchSession && panPointers.length >= 2) {
      startBoardPinchSession();
    } else if (!boardPinchSession && panPointers.length === 1) {
      startBoardPanSession(event.pointerId, entry);
    }
  }

  function handleBoardPointerMove(event) {
    const entry = activeBoardPointers.get(event.pointerId);
    if (!entry) return;
    entry.clientX = event.clientX;
    entry.clientY = event.clientY;
    if (!isEditMode) return;
    let handled = false;
    if (boardPinchSession && (event.pointerId === boardPinchSession.id1 || event.pointerId === boardPinchSession.id2)) {
      handled = updateBoardPinchGesture();
    }
    if (!handled && boardPanSession && boardPanSession.pointerId === event.pointerId) {
      handled = updateBoardPanGesture(event.pointerId);
    }
    if (handled) event.preventDefault();
  }

  function handleBoardPointerEnd(event) {
    const entry = activeBoardPointers.get(event.pointerId);
    if (entry && entry.captured) {
      try {
        board.releasePointerCapture(event.pointerId);
      } catch (_) {}
    }
    activeBoardPointers.delete(event.pointerId);
    let wasPinchPointer = false;
    if (boardPinchSession && (event.pointerId === boardPinchSession.id1 || event.pointerId === boardPinchSession.id2)) {
      wasPinchPointer = true;
      endBoardPinchSession();
    }
    if (boardPanSession && boardPanSession.pointerId === event.pointerId) {
      endBoardPanSession();
    }
    if (isEditMode && wasPinchPointer) {
      const panPointers = getPanCapablePointers();
      if (panPointers.length === 1) {
        const [id, remaining] = panPointers[0];
        startBoardPanSessionFromPointer(id, remaining);
      }
    }
    updateBoardInteractionState();
  }

  function handleBoardWheel(event) {
    if (!isEditMode) return;
    event.preventDefault();
    const view = getViewSettings();
    const deltaY = Number(event.deltaY);
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    const scale = Math.exp(-deltaY / 500);
    const focus = clientToNormalized(event.clientX, event.clientY, view);
    applyZoom(view.zoom * scale, { focus, userAction: true });
  }

  function updateBoardPannableState() {
    if (!board) return;
    const canPan = isEditMode;
    board.classList.toggle('is-pannable', canPan);
    if (!canPan) {
      resetBoardInteractionState();
    }
  }

  function clearDragVisualState() {
    const containers = getPointListContainers();
    if (!containers.length) return;
    containers.forEach(container => {
      container.querySelectorAll('.point-item').forEach(el => {
        el.classList.remove('drop-before', 'drop-after');
        delete el.dataset.dropPosition;
      });
    });
    if (dragPlaceholderEl && dragPlaceholderEl.parentNode) {
      dragPlaceholderEl.parentNode.removeChild(dragPlaceholderEl);
    }
    dragPlaceholderEl = null;
    dropTargetEl = null;
    dropTargetPointId = null;
    dropPositionAfter = false;
  }

  function ensureDragPlaceholder(referenceItem) {
    if (!dragPlaceholderEl) {
      dragPlaceholderEl = document.createElement('div');
      dragPlaceholderEl.className = 'point-item point-placeholder';
      dragPlaceholderEl.setAttribute('aria-hidden', 'true');
      const label = document.createElement('div');
      label.className = 'point-placeholder-label';
      label.textContent = 'Slipp her';
      dragPlaceholderEl.appendChild(label);
      dragPlaceholderEl.addEventListener('dragover', event => {
        if (!draggedPointId) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      });
      dragPlaceholderEl.addEventListener('drop', event => {
        const container = dragPlaceholderEl ? dragPlaceholderEl.parentNode : null;
        handlePointDrop(event, null, container);
      });
    }
    const height = draggingItemHeight || (referenceItem ? referenceItem.getBoundingClientRect().height : 0);
    if (height > 0) {
      dragPlaceholderEl.style.height = `${Math.round(height)}px`;
    } else {
      dragPlaceholderEl.style.removeProperty('height');
    }
    return dragPlaceholderEl;
  }

  function updateDropPreview(pointId, item, placeAfter) {
    if (!item) return;
    const placeholder = ensureDragPlaceholder(item);
    if (!placeholder) return;
    const parent = item.parentNode;
    if (!parent) return;
    if (placeAfter) {
      if (item.nextSibling !== placeholder) {
        parent.insertBefore(placeholder, item.nextSibling);
      }
    } else if (parent !== placeholder.parentNode || placeholder.nextSibling !== item) {
      parent.insertBefore(placeholder, item);
    }
    dropTargetPointId = pointId;
    dropPositionAfter = !!placeAfter;
    placeholder.dataset.dropTargetId = pointId;
    placeholder.dataset.dropPosition = placeAfter ? 'after' : 'before';
  }

  function handlePointDragStart(event, pointId, item) {
    draggedPointId = pointId;
    draggingItemEl = item;
    draggingItemOriginalDisplay = item ? item.style.display : '';
    draggingItemHeight = item ? item.getBoundingClientRect().height : 0;
    dropTargetEl = null;
    dropTargetPointId = null;
    dropPositionAfter = false;
    const placeholder = ensureDragPlaceholder(item);
    if (placeholder && item && item.parentNode) {
      placeholder.dataset.dropTargetId = '';
      placeholder.dataset.dropPosition = '';
      item.parentNode.insertBefore(placeholder, item.nextSibling);
    }
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      try {
        event.dataTransfer.setData('text/plain', pointId);
      } catch (_) {}
    }
    requestAnimationFrame(() => {
      if (draggingItemEl) {
        draggingItemEl.classList.add('is-dragging');
        draggingItemEl.setAttribute('aria-hidden', 'true');
        draggingItemEl.style.display = 'none';
      }
    });
  }

  function handlePointDragEnd() {
    if (draggingItemEl) {
      draggingItemEl.classList.remove('is-dragging');
      draggingItemEl.removeAttribute('aria-hidden');
      draggingItemEl.style.display = draggingItemOriginalDisplay || '';
    }
    draggingItemOriginalDisplay = '';
    draggingItemHeight = 0;
    draggingItemEl = null;
    draggedPointId = null;
    clearDragVisualState();
  }

  function handlePointDragOver(event, pointId, item) {
    if (!draggedPointId || draggedPointId === pointId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (dropTargetEl && dropTargetEl !== item) {
      dropTargetEl.classList.remove('drop-before', 'drop-after');
      delete dropTargetEl.dataset.dropPosition;
    }
    dropTargetEl = item;
    const rect = item.getBoundingClientRect();
    const isAfter = event.clientY >= rect.top + rect.height / 2;
    item.classList.remove('drop-before', 'drop-after');
    item.classList.add(isAfter ? 'drop-after' : 'drop-before');
    item.dataset.dropPosition = isAfter ? 'after' : 'before';
    updateDropPreview(pointId, item, isAfter);
  }

  function handlePointDragLeave(event, item) {
    if (!draggedPointId || dropTargetEl !== item) return;
    const related = event.relatedTarget;
    if (related && (item.contains(related) || (dragPlaceholderEl && dragPlaceholderEl.contains(related)))) return;
    item.classList.remove('drop-before', 'drop-after');
    delete item.dataset.dropPosition;
    dropTargetEl = null;
  }

  function reorderPoints(sourceId, targetId, placeAfter) {
    if (sourceId === targetId) return false;
    const sourceIdx = STATE.points.findIndex(p => p.id === sourceId);
    const targetIdx = STATE.points.findIndex(p => p.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0) return false;
    const [entry] = STATE.points.splice(sourceIdx, 1);
    if (!entry) return false;
    const targetIdxAfterRemoval = targetIdx - (sourceIdx < targetIdx ? 1 : 0);
    let insertIndex = targetIdxAfterRemoval + (placeAfter ? 1 : 0);
    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > STATE.points.length) insertIndex = STATE.points.length;
    STATE.points.splice(insertIndex, 0, entry);
    return true;
  }

  function resolveListContainer(element) {
    let current = element;
    while (current) {
      if (current === pointListEl || current === falsePointListEl) return current;
      current = current.parentNode;
    }
    return null;
  }

  function findLastPointIndex(predicate) {
    for (let i = STATE.points.length - 1; i >= 0; i -= 1) {
      const point = STATE.points[i];
      if (predicate(point, i)) return i;
    }
    return -1;
  }

  function movePointToContainerEnd(pointId, container) {
    if (!container) return false;
    const sourceIdx = STATE.points.findIndex(p => p.id === pointId);
    if (sourceIdx < 0) return false;
    const [entry] = STATE.points.splice(sourceIdx, 1);
    if (!entry) return false;
    let insertIndex = STATE.points.length;
    if (container === pointListEl) {
      const lastTrueIndex = findLastPointIndex(point => point && !point.isFalse);
      insertIndex = lastTrueIndex >= 0 ? lastTrueIndex + 1 : 0;
    } else if (container === falsePointListEl) {
      const lastFalseIndex = findLastPointIndex(point => point && point.isFalse);
      insertIndex = lastFalseIndex >= 0 ? lastFalseIndex + 1 : STATE.points.length;
    }
    STATE.points.splice(insertIndex, 0, entry);
    return true;
  }

  function attachListContainerListeners(container) {
    if (!container) return;
    container.addEventListener('dragover', event => {
      if (!draggedPointId) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });
    container.addEventListener('drop', event => {
      if (!draggedPointId) return;
      let targetEl = event.target;
      while (targetEl && targetEl !== container) {
        if (targetEl.classList && targetEl.classList.contains('point-item')) return;
        targetEl = targetEl.parentNode;
      }
      handlePointDrop(event, null, container);
    });
  }

  function handlePointDrop(event, targetPointId, targetContainer) {
    if (!draggedPointId) return;
    event.preventDefault();
    event.stopPropagation();
    const sourceId = draggedPointId;
    const point = STATE.points.find(p => p.id === sourceId);
    let resolvedTarget = dropTargetPointId || targetPointId;
    if (!resolvedTarget && dragPlaceholderEl && dragPlaceholderEl.dataset.dropTargetId) {
      resolvedTarget = dragPlaceholderEl.dataset.dropTargetId;
    }
    if (!resolvedTarget && event && event.currentTarget && event.currentTarget.dataset) {
      resolvedTarget = event.currentTarget.dataset.pointId;
    }
    let placeAfter = dropTargetPointId != null ? dropPositionAfter : false;
    if (dropTargetPointId == null) {
      const datasetSource = (dropTargetEl && dropTargetEl.dataset) || (event.currentTarget && event.currentTarget.dataset) || (dragPlaceholderEl && dragPlaceholderEl.dataset) || {};
      if (datasetSource.dropPosition) placeAfter = datasetSource.dropPosition === 'after';
    }
    const dropContainer = resolveListContainer(targetContainer || (dropTargetEl ? dropTargetEl.parentNode : null) || (dragPlaceholderEl ? dragPlaceholderEl.parentNode : null) || (event.currentTarget ? event.currentTarget.parentNode : null));
    const targetPoint = resolvedTarget ? STATE.points.find(p => p.id === resolvedTarget) : null;
    let willBeFalse;
    if (dropContainer === falsePointListEl) willBeFalse = true;
    else if (dropContainer === pointListEl) willBeFalse = false;
    else if (targetPoint) willBeFalse = !!targetPoint.isFalse;
    else willBeFalse = point ? !!point.isFalse : false;
    let changed = false;
    if (resolvedTarget) {
      changed = reorderPoints(sourceId, resolvedTarget, placeAfter);
    } else {
      changed = movePointToContainerEnd(sourceId, dropContainer) || changed;
    }
    handlePointDragEnd();
    if (point && point.isFalse !== willBeFalse) {
      point.isFalse = willBeFalse;
      changed = true;
    }
    if (!changed) return;
    const validPoints = prepareState();
    renderPointList(validPoints);
    renderBoard(validPoints);
    clearStatus();
  }

  function sortPoints() {
    const collator = new Intl.Collator('nb', { numeric: true, sensitivity: 'base' });
    STATE.points.sort((a, b) => {
      const labelA = a && typeof a.label === 'string' ? a.label : '';
      const labelB = b && typeof b.label === 'string' ? b.label : '';
      const compareLabel = collator.compare(labelA, labelB);
      if (compareLabel !== 0) return compareLabel;
      const idA = a && typeof a.id === 'string' ? a.id : '';
      const idB = b && typeof b.id === 'string' ? b.id : '';
      return collator.compare(idA, idB);
    });
    const validPoints = prepareState();
    renderPointList(validPoints);
    renderBoard(validPoints);
  }

  function renderPointList(validPoints) {
    if (!pointListEl) return;
    if (!validPoints) validPoints = prepareState();
    pointEditors.clear();
    clearDragVisualState();
    pointListEl.innerHTML = '';
    if (falsePointListEl) falsePointListEl.innerHTML = '';

    const appendEmptyMessage = (container, message) => {
      if (!container) return;
      const empty = document.createElement('div');
      empty.className = 'point-list-empty';
      empty.textContent = message;
      container.appendChild(empty);
    };

    STATE.points.forEach(point => {
      const item = document.createElement('div');
      item.className = 'point-item';
      item.dataset.pointId = point.id;

      const handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'point-handle';
      handle.setAttribute('aria-label', 'Flytt punkt');
      handle.setAttribute('title', 'Dra for å endre rekkefølge');
      handle.draggable = true;
      const handleIcon = document.createElement('span');
      handleIcon.className = 'point-handle-icon';
      handleIcon.setAttribute('aria-hidden', 'true');
      handleIcon.textContent = '⠿';
      handle.appendChild(handleIcon);
      handle.addEventListener('dragstart', event => {
        handlePointDragStart(event, point.id, item);
      });
      handle.addEventListener('dragend', () => {
        handlePointDragEnd();
      });
      handle.addEventListener('click', event => {
        event.preventDefault();
      });
      item.appendChild(handle);

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'point-input point-input--label';
      labelInput.placeholder = 'Etikett';
      labelInput.setAttribute('aria-label', 'Etikett');
      labelInput.value = typeof point.label === 'string' ? point.label : '';
      const commitLabelChange = () => {
        updatePointLabel(point.id, labelInput.value);
      };
      labelInput.addEventListener('change', commitLabelChange);
      labelInput.addEventListener('blur', commitLabelChange);
      labelInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitLabelChange();
          labelInput.blur();
        }
      });
      item.appendChild(labelInput);

      const coordInput = document.createElement('input');
      coordInput.type = 'text';
      coordInput.inputMode = 'decimal';
      coordInput.className = 'point-input point-input--coord';
      coordInput.placeholder = '(50, 50)';
      coordInput.setAttribute('aria-label', 'Koordinat (x,y)');
      coordInput.value = coordinateString(point);
      const commitCoordChange = () => {
        const parsed = parseCoordinateInput(coordInput.value);
        if (!parsed) {
          coordInput.value = coordinateString(point);
          return;
        }
        updatePointPosition(point.id, parsed.x, parsed.y);
        coordInput.value = coordinateString(point);
      };
      coordInput.addEventListener('change', commitCoordChange);
      coordInput.addEventListener('blur', commitCoordChange);
      coordInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commitCoordChange();
          coordInput.blur();
        }
      });
      item.appendChild(coordInput);

      const actions = document.createElement('div');
      actions.className = 'point-actions';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn--small point-remove';
      removeBtn.textContent = 'Fjern';
      removeBtn.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        removePoint(point.id);
      });
      actions.appendChild(removeBtn);

      item.appendChild(actions);

      item.addEventListener('dragover', event => {
        handlePointDragOver(event, point.id, item);
      });
      item.addEventListener('dragleave', event => {
        handlePointDragLeave(event, item);
      });
      item.addEventListener('drop', event => {
        handlePointDrop(event, point.id, item.parentNode);
      });

      const targetList = point.isFalse && falsePointListEl ? falsePointListEl : pointListEl;
      targetList.appendChild(item);
      pointEditors.set(point.id, {
        itemEl: item,
        labelInput,
        coordInput
      });
    });

    if (pointListEl && pointListEl.children.length === 0) {
      appendEmptyMessage(pointListEl, 'Ingen punkt er definert ennå.');
    }
    if (falsePointListEl && falsePointListEl.children.length === 0) {
      appendEmptyMessage(falsePointListEl, 'Ingen falske punkter er definert ennå.');
    }

    applySelectionHighlight();
  }

  function applySelectionHighlight() {
    pointElements.forEach((visual, id) => {
      if (!visual || !visual.group) return;
      visual.group.classList.toggle('is-selected', id === selectedPointId);
    });
    pointEditors.forEach((editor, id) => {
      if (editor.itemEl) editor.itemEl.classList.toggle('is-selected', id === selectedPointId);
    });
    labelElements.forEach((label, id) => {
      if (!label || !label.setSelected) return;
      label.setSelected(id === selectedPointId);
    });
  }

  function updatePointVisualClasses(visual, point) {
    if (!visual || !visual.group) return;
    visual.group.classList.toggle('point--false', !!(point && point.isFalse));
    if (point && point.id) {
      const label = labelElements.get(point.id);
      if (label) label.setFalse(point.isFalse);
    }
  }

  function updatePointVisualPosition(visual, point, pos) {
    if (!visual || !visual.group || !visual.decoration || !visual.dot) return;
    const coords = pos || toPixel(point);
    const { x, y } = coords;
    visual.decoration.setAttribute('cx', x);
    visual.decoration.setAttribute('cy', y);
    visual.decoration.setAttribute('r', POINT_RADIUS);
    visual.dot.setAttribute('cx', x);
    visual.dot.setAttribute('cy', y);
    visual.dot.setAttribute('r', DOT_RADIUS);
  }

  function createPointVisual(point, pos) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.classList.add('point');
    group.dataset.pointId = point.id;

    const decoration = document.createElementNS(SVG_NS, 'circle');
    decoration.classList.add('point-decoration');
    group.appendChild(decoration);

    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.classList.add('point-dot');
    dot.setAttribute('r', DOT_RADIUS);
    group.appendChild(dot);

    attachPointInteraction(group, point.id);

    const visual = { group, decoration, dot };
    updatePointVisualClasses(visual, point);
    updatePointVisualPosition(visual, point, pos);
    return visual;
  }

  function updatePointEditors() {
    STATE.points.forEach((point, index) => {
      const editor = pointEditors.get(point.id);
      if (!editor) return;
      if (editor.labelInput) editor.labelInput.value = point.label;
      if (editor.coordInput) editor.coordInput.value = coordinateString(point);
      if (editor.itemEl) editor.itemEl.dataset.pointId = point.id;
    });
  }

  function renderGrid(view) {
    if (!gridGroup || !axesGroup || !axisLabelsGroup) return;
    gridGroup.innerHTML = '';
    axesGroup.innerHTML = '';
    axisLabelsGroup.innerHTML = '';
    if (!isEditMode || !STATE.showGrid) {
      gridGroup.style.display = 'none';
      axesGroup.style.display = 'none';
      axisLabelsGroup.style.display = 'none';
      return;
    }
    const currentView = view && typeof view === 'object' ? view : getViewSettings();
    gridGroup.style.display = '';
    axesGroup.style.display = '';
    axisLabelsGroup.style.display = '';
    const step = GRID_BASE_STEP;
    if (!Number.isFinite(step) || step <= 0) return;
    const minX = currentView.panX;
    const maxX = currentView.panX + currentView.viewWidth;
    const minY = currentView.panY;
    const maxY = currentView.panY + currentView.viewHeight;
    const epsilon = 1e-6;
    const decimals = computeAxisDecimals(step);
    const axisOrigin = toPixel({ x: minX, y: minY }, currentView);
    const axisPixelX = axisOrigin.x;
    const axisPixelY = axisOrigin.y;
    const addAxisLine = (x1, y1, x2, y2, className) => {
      const pos1 = toPixel({ x: x1, y: y1 }, currentView);
      const pos2 = toPixel({ x: x2, y: y2 }, currentView);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', pos1.x);
      line.setAttribute('y1', pos1.y);
      line.setAttribute('x2', pos2.x);
      line.setAttribute('y2', pos2.y);
      line.classList.add('axis-line');
      if (className) line.classList.add(className);
      axesGroup.appendChild(line);
    };
    const addAxisTick = (orientation, x, y) => {
      const tick = document.createElementNS(SVG_NS, 'line');
      if (orientation === 'x') {
        tick.setAttribute('x1', x);
        tick.setAttribute('y1', y);
        tick.setAttribute('x2', x);
        tick.setAttribute('y2', Math.max(0, y - AXIS_TICK_LENGTH));
      } else {
        tick.setAttribute('x1', x);
        tick.setAttribute('y1', y);
        tick.setAttribute('x2', Math.min(BOARD_WIDTH, x + AXIS_TICK_LENGTH));
        tick.setAttribute('y2', y);
      }
      tick.classList.add('axis-tick');
      axesGroup.appendChild(tick);
    };
    const addAxisLabel = (orientation, value, x, y) => {
      const label = document.createElementNS(SVG_NS, 'text');
      const text = formatAxisValue(value, decimals);
      if (!text) return;
      if (orientation === 'x') {
        const labelY = Math.max(AXIS_LABEL_PADDING, y - AXIS_LABEL_OFFSET);
        label.setAttribute('x', x);
        label.setAttribute('y', labelY);
        label.setAttribute('text-anchor', 'middle');
        label.classList.add('axis-label', 'axis-label--x');
      } else {
        const labelX = Math.min(BOARD_WIDTH - AXIS_LABEL_PADDING, x + AXIS_LABEL_OFFSET);
        label.setAttribute('x', labelX);
        label.setAttribute('y', y);
        label.setAttribute('text-anchor', 'start');
        label.classList.add('axis-label', 'axis-label--y');
      }
      label.textContent = text;
      axisLabelsGroup.appendChild(label);
    };
    const addLine = (x1, y1, x2, y2, isMajor) => {
      const pos1 = toPixel({ x: x1, y: y1 }, currentView);
      const pos2 = toPixel({ x: x2, y: y2 }, currentView);
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', pos1.x);
      line.setAttribute('y1', pos1.y);
      line.setAttribute('x2', pos2.x);
      line.setAttribute('y2', pos2.y);
      line.classList.add('grid-line');
      if (isMajor) line.classList.add('grid-line--major');
      gridGroup.appendChild(line);
    };
    addAxisLine(minX, minY, maxX, minY, 'axis-line--x');
    addAxisLine(minX, minY, minX, maxY, 'axis-line--y');
    const startXIndex = Math.ceil((minX - epsilon) / step);
    const endXIndex = Math.floor((maxX + epsilon) / step);
    const xLabelValues = new Set();
    const addXAxisEntry = value => {
      if (!Number.isFinite(value)) return;
      if (value < minX - epsilon || value > maxX + epsilon) return;
      const key = value.toFixed(6);
      if (xLabelValues.has(key)) return;
      xLabelValues.add(key);
      const pos = toPixel({ x: value, y: minY }, currentView);
      addAxisTick('x', pos.x, axisPixelY);
      addAxisLabel('x', value, pos.x, axisPixelY);
    };
    for (let idx = startXIndex; idx <= endXIndex; idx += 1) {
      const xValue = Number((idx * step).toFixed(6));
      const isMajor = GRID_MAJOR_EVERY > 0 && idx % GRID_MAJOR_EVERY === 0;
      addLine(xValue, minY, xValue, maxY, isMajor);
      if (isMajor) addXAxisEntry(xValue);
    }
    addXAxisEntry(minX);
    addXAxisEntry(maxX);
    const startYIndex = Math.ceil((minY - epsilon) / step);
    const endYIndex = Math.floor((maxY + epsilon) / step);
    const yLabelValues = new Set();
    const addYAxisEntry = value => {
      if (!Number.isFinite(value)) return;
      if (value < minY - epsilon || value > maxY + epsilon) return;
      const key = value.toFixed(6);
      if (yLabelValues.has(key)) return;
      yLabelValues.add(key);
      const pos = toPixel({ x: minX, y: value }, currentView);
      addAxisTick('y', axisPixelX, pos.y);
      addAxisLabel('y', value, axisPixelX, pos.y);
    };
    for (let idx = startYIndex; idx <= endYIndex; idx += 1) {
      const yValue = Number((idx * step).toFixed(6));
      const isMajor = GRID_MAJOR_EVERY > 0 && idx % GRID_MAJOR_EVERY === 0;
      addLine(minX, yValue, maxX, yValue, isMajor);
      if (isMajor) addYAxisEntry(yValue);
    }
    addYAxisEntry(minY);
    addYAxisEntry(maxY);
  }

  function renderBoard(validPoints) {
    if (!validPoints) validPoints = prepareState();
    else currentValidPoints = validPoints;
    document.body.classList.toggle('labels-hidden', !STATE.showLabels);
    applyLabelFontSize();

    const pointMap = new Map(STATE.points.map(p => [p.id, p]));

    const view = getViewSettings();
    syncViewControls(view);
    renderGrid(view);

    baseGroup.innerHTML = '';
    baseLineElements.clear();
    STATE.predefinedLines.forEach(([a, b]) => {
      const p1 = pointMap.get(a);
      const p2 = pointMap.get(b);
      if (!p1 || !p2) return;
      const line = document.createElementNS(SVG_NS, 'line');
      setLineAttrs(line, p1, p2);
      line.classList.add('line-predefined');
      const key = makeLineKey(a, b);
      if (key) {
        line.dataset.key = key;
        line.dataset.type = 'predefined';
        line.addEventListener('pointerdown', event => {
          if (!isEditMode || !isPredefDrawingMode) return;
          event.preventDefault();
          event.stopPropagation();
          if (removePredefinedLineByKey(key)) {
            predefAnchorPointId = null;
            selectedPointId = null;
            clearStatus();
            renderBoard();
          }
        });
        baseLineElements.set(key, { element: line, a, b });
      }
      baseGroup.appendChild(line);
    });

    userGroup.innerHTML = '';
    userLineElements.clear();
    const toRemove = [];
    userLines.forEach(key => {
      const { a, b } = keyToPair(key);
      const p1 = pointMap.get(a);
      const p2 = pointMap.get(b);
      if (!p1 || !p2) {
        toRemove.push(key);
        return;
      }
      const line = document.createElementNS(SVG_NS, 'line');
      setLineAttrs(line, p1, p2);
      line.classList.add('line-user');
      line.dataset.key = key;
      line.dataset.type = 'user';
      line.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (baseLines.has(key)) return;
        userLines.delete(key);
        clearStatus();
        selectedPointId = null;
        renderBoard();
      });
      userGroup.appendChild(line);
      userLineElements.set(key, { element: line, a, b });
    });
    toRemove.forEach(key => userLines.delete(key));

    answerGroup.innerHTML = '';
    answerLineElements.clear();
    if (isEditMode) {
      STATE.answerLines.forEach(([a, b]) => {
        const p1 = pointMap.get(a);
        const p2 = pointMap.get(b);
        if (!p1 || !p2) return;
        const line = document.createElementNS(SVG_NS, 'line');
        setLineAttrs(line, p1, p2);
        line.classList.add('line-answer');
        answerGroup.appendChild(line);
        const key = makeLineKey(a, b);
        if (key) answerLineElements.set(key, { element: line, a, b });
      });
    }

    computeBoardScale();
    recomputeLabelPlacements();
    pointsGroup.innerHTML = '';
    labelsGroup.innerHTML = '';
    if (labelLayer) labelLayer.innerHTML = '';
    pointElements.clear();
    labelElements.clear();
    STATE.points.forEach(point => {
      const pos = toPixel(point);
      const visual = createPointVisual(point, pos);
      pointsGroup.appendChild(visual.group);
      pointElements.set(point.id, visual);

      const label = createBoardLabel(point, pos);
      if (label && labelLayer) {
        labelLayer.appendChild(label.element);
        labelElements.set(point.id, label);
      }
    });

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(applyLabelPlacements);
    } else {
      applyLabelPlacements();
    }

    updatePointEditors();
    updateCounts();
    applySelectionHighlight();
    updateModeHint();
  }

  function updateCounts() {
    if (answerCountEl) answerCountEl.textContent = String(STATE.answerLines.length);
    if (predefCountEl) predefCountEl.textContent = String(STATE.predefinedLines.length);
  }

  function handlePointSelection(pointId) {
    if (isEditMode) {
      if (isPredefDrawingMode) {
        handlePredefLineSelection(pointId);
        return;
      }
      predefAnchorPointId = null;
      selectedPointId = selectedPointId === pointId ? null : pointId;
      applySelectionHighlight();
      return;
    }
    if (selectedPointId == null) {
      selectedPointId = pointId;
      applySelectionHighlight();
      return;
    }
    if (selectedPointId === pointId) {
      selectedPointId = null;
      applySelectionHighlight();
      return;
    }
    clearStatus();
    const key = makeLineKey(selectedPointId, pointId);
    if (!key) {
      selectedPointId = null;
      applySelectionHighlight();
      return;
    }
    const { a, b } = keyToPair(key);
    if (!realPointIds.has(a) || !realPointIds.has(b)) {
      selectedPointId = pointId;
      applySelectionHighlight();
      return;
    }
    if (baseLines.has(key)) {
      selectedPointId = pointId;
      applySelectionHighlight();
      return;
    }
    if (userLines.has(key)) {
      userLines.delete(key);
    } else {
      userLines.add(key);
    }
    selectedPointId = pointId;
    renderBoard();
    applySelectionHighlight();
  }

  function showStatus(type, heading, detailLines) {
    if (!statusBox) return;
    if (!type || !heading) {
      statusBox.className = 'status';
      statusBox.innerHTML = '';
      statusBox.hidden = true;
      return;
    }
    statusBox.className = `status status--${type}`;
    statusBox.innerHTML = '';
    statusBox.hidden = false;
    const strong = document.createElement('strong');
    strong.textContent = heading;
    statusBox.appendChild(strong);
    if (Array.isArray(detailLines)) {
      detailLines.forEach(line => {
        if (!line) return;
        const p = document.createElement('div');
        p.textContent = line;
        statusBox.appendChild(p);
      });
    }
  }

  function clearStatus() {
    showStatus(null, null);
  }

  function describeLine(key, pointMap) {
    const { a, b } = keyToPair(key);
    const p1 = pointMap.get(a);
    const p2 = pointMap.get(b);
    const labelA = p1 && typeof p1.label === 'string' && p1.label ? p1.label : a;
    const labelB = p2 && typeof p2.label === 'string' && p2.label ? p2.label : b;
    return `${labelA}–${labelB}`;
  }

  function checkSolution() {
    prepareState();
    if (!STATE.answerLines.length) {
      showStatus('info', 'Ingen fasit er definert ennå.');
      return;
    }
    const pointMap = new Map(STATE.points.map(p => [p.id, p]));
    const answerKeys = new Set(STATE.answerLines.map(([a, b]) => makeLineKey(a, b)).filter(Boolean));
    const drawnKeys = new Set([...baseLines, ...userLines]);
    const missing = [];
    answerKeys.forEach(key => {
      if (!drawnKeys.has(key)) missing.push(key);
    });
    const extras = [];
    drawnKeys.forEach(key => {
      if (!answerKeys.has(key) && !baseLines.has(key)) extras.push(key);
    });
    if (missing.length === 0 && extras.length === 0) {
      showStatus('success', 'Det er riktig!');
      return;
    }
    const details = [];
    if (missing.length) {
      details.push(`Mangler: ${missing.map(key => describeLine(key, pointMap)).join(', ')}`);
    }
    if (extras.length) {
      details.push(`Ekstra: ${extras.map(key => describeLine(key, pointMap)).join(', ')}`);
    }
    showStatus('error', 'Ikke helt riktig ennå.', details);
  }

  function updateModeHint() {
    if (!modeHint) return;
    if (isEditMode) {
      if (isPredefDrawingMode) {
        modeHint.textContent = 'Tegn forhåndsdefinerte streker ved å klikke på to punkter. Klikk på knappen under figuren når du er ferdig.';
      } else {
        modeHint.textContent = 'Fasit-strekene følger rekkefølgen på etikettene til ekte punkter. Endre etiketter eller dra punktene i lista for å justere rekkefølgen.';
      }
      return;
    }
    modeHint.textContent = 'Klikk på to punkter for å tegne en strek. Klikk på en strek for å fjerne den.';
  }

  function updateModeUI() {
    if (modeLabel) modeLabel.textContent = isEditMode ? 'Modus: Redigeringsmodus' : 'Modus: Oppgavemodus';
    if (checkBtn) checkBtn.disabled = isEditMode;
    if (clearBtn) clearBtn.disabled = isEditMode;
    document.body.classList.toggle('is-edit-mode', isEditMode);
    document.body.classList.toggle('is-play-mode', !isEditMode);
    updateBoardPannableState();
    if (!isEditMode) {
      setPredefDrawingMode(false);
    } else {
      updatePredefToolUI();
    }
    updateModeHint();
  }

  function createPointId() {
    const existing = new Set(STATE.points.map(p => String(p.id)));
    let next = Number.isFinite(STATE.nextPointId) ? Math.floor(STATE.nextPointId) : existing.size + 1;
    if (next < 1) next = existing.size + 1;
    let id;
    do {
      id = `p${next++}`;
    } while (existing.has(id));
    STATE.nextPointId = next;
    return id;
  }

  function addPoint(makeFalse = false) {
    const id = createPointId();
    const count = STATE.points.length;
    const radius = 0.3;
    const angle = count === 0 ? 0 : count * (2 * Math.PI / Math.max(count + 1, 6));
    const x = clamp01(0.5 + Math.cos(angle) * radius);
    const y = clamp01(0.5 + Math.sin(angle) * radius);
    STATE.points.push({
      id,
      label: String(count + 1),
      x,
      y,
      isFalse: !!makeFalse
    });
    selectedPointId = id;
    renderPointList();
    renderBoard();
    clearStatus();
  }

  function removePoint(pointId) {
    const idx = STATE.points.findIndex(p => p.id === pointId);
    if (idx < 0) return;
    STATE.points.splice(idx, 1);
    STATE.answerLines = STATE.answerLines.filter(([a, b]) => a !== pointId && b !== pointId);
    STATE.predefinedLines = STATE.predefinedLines.filter(([a, b]) => a !== pointId && b !== pointId);
    const toDelete = [];
    userLines.forEach(key => {
      const { a, b } = keyToPair(key);
      if (a === pointId || b === pointId) toDelete.push(key);
    });
    toDelete.forEach(key => userLines.delete(key));
    if (selectedPointId === pointId) selectedPointId = null;
    if (predefAnchorPointId === pointId) predefAnchorPointId = null;
    renderPointList();
    renderBoard();
    clearStatus();
  }

  function clearUserLines() {
    userLines.clear();
    selectedPointId = null;
    renderBoard();
  }

  function rebuildAll(resetDrawn = false) {
    if (resetDrawn) {
      userLines.clear();
      hasUserAdjustedView = false;
    }
    const validPoints = prepareState();
    renderPointList(validPoints);
    renderBoard(validPoints);
    updateModeUI();
  }

  if (addPointBtn) {
    addPointBtn.addEventListener('click', () => {
      addPoint(false);
    });
  }

  if (addPointFalseBtn) {
    addPointFalseBtn.addEventListener('click', () => {
      addPoint(true);
    });
  }

  if (checkBtn) {
    checkBtn.addEventListener('click', () => {
      const taskApi = getTaskApi();
      if (taskApi && typeof taskApi.evaluateTask === 'function') {
        taskApi.evaluateTask(TASK_APP_ID);
      } else {
        checkSolution();
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearStatus();
      clearUserLines();
    });
  }

  if (predefToggleBtn) {
    predefToggleBtn.addEventListener('click', () => {
      if (!isEditMode) return;
      setPredefDrawingMode(!isPredefDrawingMode);
    });
  }

  function applyModeChange(nextMode) {
    if (typeof nextMode !== 'string') return;
    const normalized = nextMode.toLowerCase();
    const editModes = new Set(['edit', 'default']);
    const playModes = new Set(['play', 'solve', 'student', 'view', 'task']);
    if (!editModes.has(normalized) && !playModes.has(normalized)) return;
    syncBodyAppMode(normalized);
    updateTaskControlsVisibility(normalized);
    const nextIsEditMode = editModes.has(normalized);
    if (typeof window !== 'undefined') {
      window.mode = normalized;
    }
    if (nextIsEditMode === isEditMode) {
      updateModeUI();
      return;
    }
    isEditMode = nextIsEditMode;
    selectedPointId = null;
    if (!isEditMode) predefAnchorPointId = null;
    clearStatus();
    updateModeUI();
    renderBoard();
  }

  function handleModeMessage(event) {
    if (!event) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const { type, mode: nextMode } = data;
    if (type !== 'math-visuals:mode-change') return;
    applyModeChange(nextMode);
  }

  function handleAppModeEvent(event) {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail !== 'object') return;
    applyModeChange(detail.mode);
  }

  if (showGridToggle) {
    showGridToggle.addEventListener('change', () => {
      STATE.showGrid = !!showGridToggle.checked;
      renderBoard();
    });
  }

  if (snapToGridToggle) {
    snapToGridToggle.addEventListener('change', () => {
      STATE.snapToGrid = !!snapToGridToggle.checked;
      if (STATE.snapToGrid) {
        const changed = snapAllPointsToGrid();
        if (changed) {
          const validPoints = prepareState();
          renderPointList(validPoints);
          renderBoard(validPoints);
          showStatus('info', 'Punktene ble justert til rutenettet.');
          return;
        }
      }
      renderBoard();
    });
  }

  if (zoomRange) {
    const handleZoomInput = () => {
      updateZoom(zoomRange.value);
    };
    zoomRange.addEventListener('input', handleZoomInput);
    zoomRange.addEventListener('change', handleZoomInput);
  }

  if (panXRange) {
    const handlePanX = () => {
      updatePan('x', panXRange.value);
    };
    panXRange.addEventListener('input', handlePanX);
    panXRange.addEventListener('change', handlePanX);
  }

  if (panYRange) {
    const handlePanY = () => {
      updatePan('y', panYRange.value);
    };
    panYRange.addEventListener('input', handlePanY);
    panYRange.addEventListener('change', handlePanY);
  }

  if (board) {
    board.addEventListener('pointerdown', handleBoardPointerDown);
    board.addEventListener('pointermove', handleBoardPointerMove);
    board.addEventListener('pointerup', handleBoardPointerEnd);
    board.addEventListener('pointercancel', handleBoardPointerEnd);
    board.addEventListener('wheel', handleBoardWheel, { passive: false });
  }

  if (labelFontSizeSelect) {
    labelFontSizeSelect.addEventListener('change', () => {
      STATE.labelFontSize = normalizeLabelFontSize(labelFontSizeSelect.value);
      applyLabelFontSize();
      syncLabelFontSizeControl();
      updateAllLabelPositions();
    });
  }

  window.addEventListener('message', handleModeMessage);
  window.addEventListener('math-visuals:app-mode-changed', handleAppModeEvent);

  if (typeof window !== 'undefined') {
    window.createCleanState = createCleanState;
    window.loadCleanState = loadCleanState;
    window.prikktilprikkApi = {
      createCleanState: (...args) => createCleanState(...args),
      loadCleanState: (...args) => loadCleanState(...args),
      onExampleLoaded: () => {
        rebuildAll(true);
        clearStatus();
      }
    };
    const mv = window.mathVisuals && typeof window.mathVisuals === 'object' ? window.mathVisuals : {};
    mv.activeTool = window.prikktilprikkApi;
    window.mathVisuals = mv;
  }

  function requestInitialMode() {
    if (typeof window === 'undefined') return;
    const message = { type: 'math-visuals:request-mode' };
    try {
      window.parent.postMessage(message, '*');
    } catch (_) {
      try {
        window.postMessage(message, '*');
      } catch (_) {}
    }
  }

  requestInitialMode();

  window.addEventListener('resize', () => {
    updateAllLabelPositions();
  });

  updatePredefToolUI();
  rebuildAll(true);
  clearStatus();

  window.render = () => rebuildAll(true);

  function ensureTaskControlsInHost() {
    if (!taskCheckHost) return;
    taskCheckControls.forEach(control => {
      if (control && control.parentElement !== taskCheckHost) {
        taskCheckHost.appendChild(control);
      }
    });
  }

  function normalizeAppMode(mode) {
    const normalized = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
    if (!normalized) return 'default';
    if (
      normalized === 'task' ||
      normalized === 'preview' ||
      normalized === 'forhandsvisning' ||
      normalized === 'forhåndsvisning'
    ) {
      return 'task';
    }
    return 'default';
  }

  function isTaskLikeMode(mode) {
    return normalizeAppMode(mode) === 'task';
  }

  function updateTaskControlsVisibility(mode) {
    if (!taskCheckHost) return;
    const isTaskMode = isTaskLikeMode(mode);
    if (isTaskMode) {
      ensureTaskControlsInHost();
      taskCheckHost.hidden = false;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control === checkBtn) {
          control.hidden = false;
          if (control.dataset) delete control.dataset.prevHidden;
          return;
        }
        if (control.dataset && 'prevHidden' in control.dataset) {
          const wasHidden = control.dataset.prevHidden === '1';
          delete control.dataset.prevHidden;
          control.hidden = wasHidden;
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
    }
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

  const initialAppMode = getCurrentAppMode() || 'task';
  syncBodyAppMode(initialAppMode);
  updateTaskControlsVisibility(initialAppMode);
})();
