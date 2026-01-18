import {
  buildFigureData,
  CUSTOM_CATEGORY_ID,
  CUSTOM_FIGURE_ID,
  createFigurePickerHelpers,
  loadFigureLibrary
} from './figure-library/measurement.js';

const FIGURE_LIBRARY_APP_KEY = 'maling';

(async function initMeasurementApp() {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) {
    return;
  }

  const board = doc.querySelector('[data-board]');
  const boardFigure = board ? board.querySelector('[data-figure-image]') : null;
  const boardScaleLabel = board ? board.querySelector('[data-scale-label]') : null;
  const ruler = board ? board.querySelector('[data-ruler]') : null;
  const rulerSvg = ruler ? ruler.querySelector('[data-ruler-svg]') : null;
  const tapeMeasure = board ? board.querySelector('[data-tape-measure]') : null;
  const tapeStrap = tapeMeasure ? tapeMeasure.querySelector('[data-tape-strap]') : null;
  const tapeStrapTrack = tapeStrap ? tapeStrap.querySelector('[data-tape-strap-track]') : null;
  const tapeStrapSvg = tapeStrapTrack ? tapeStrapTrack.querySelector('[data-tape-strap-svg]') : null;
  const tapeZeroHandle = tapeStrapTrack ? tapeStrapTrack.querySelector('[data-tape-zero-handle]') : null;
  const tapeMoveHandle = tapeStrapTrack ? tapeStrapTrack.querySelector('[data-tape-move-handle]') : null;
  const tapeZeroAnchor = tapeStrapTrack ? tapeStrapTrack.querySelector('[data-tape-zero-anchor]') : null;
  const tapeHousing = tapeMeasure ? tapeMeasure.querySelector('[data-tape-housing]') : null;
  const tapeHousingShiftHandle = tapeHousing
    ? tapeHousing.querySelector('[data-tape-housing-shift-handle]')
    : null;
  const segment = board ? board.querySelector('[data-segment]') : null;
  const segmentSvg = segment ? segment.querySelector('[data-segment-svg]') : null;
  const segmentLine = segmentSvg ? segmentSvg.querySelector('[data-segment-line]') : null;
  const segmentLabel = segment ? segment.querySelector('[data-segment-label]') : null;
  const segmentHandles = segment ? segment.querySelectorAll('[data-segment-handle]') : null;
  const tapeBetaStrapElement = segment ? segment.querySelector('[data-tape-beta-strap]') : null;
  const tapeBetaStrapSvg = tapeBetaStrapElement
    ? tapeBetaStrapElement.querySelector('[data-tape-beta-strap-svg]')
    : null;
  const tapeBetaHousingImage = segment ? segment.querySelector('[data-tape-beta-housing]') : null;
  const hasRuler = !!(ruler && rulerSvg);
  const hasTapeMeasure = !!(
    tapeMeasure &&
    tapeStrap &&
    tapeStrapTrack &&
    tapeStrapSvg &&
    tapeZeroAnchor &&
    tapeHousing
  );
  const hasSegment = !!(
    segment &&
    segmentSvg &&
    segmentLine &&
    segmentHandles &&
    segmentHandles.length >= 2
  );
  const hasTapeBeta = !!(
    hasSegment &&
    tapeBetaStrapElement &&
    tapeBetaStrapSvg &&
    tapeBetaHousingImage
  );
  const boardGridOverlay = board ? board.querySelector('[data-grid-overlay]') : null;
  if (!board || (!hasRuler && !hasTapeMeasure && !hasSegment)) {
    return;
  }

  let storageWarningMessage = '';
  let figureLibraryErrorMessage = '';
  try {
    const result = await loadFigureLibrary({ app: FIGURE_LIBRARY_APP_KEY });
    if (result && result.metadata) {
      storageWarningMessage = resolveStorageWarningMessage(result.metadata);
    }
  } catch (error) {
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('Kunne ikke laste figurbibliotek fra API-et', error);
    }
    const errorMessage = error && typeof error.message === 'string' ? error.message.trim() : '';
    figureLibraryErrorMessage = `Kunne ikke hente figurbiblioteket fra API-et${
      errorMessage ? `: ${errorMessage}` : ''
    }`;
  }

  const settingsToggleButton = doc.querySelector('[data-settings-toggle]');
  const settingsPanel = doc.querySelector('[data-settings-panel]');
  const settingsOverlay = doc.querySelector('[data-settings-overlay]');
  const mobileMediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 640px)')
      : null;
  const settingsToggleLabels = { open: '', close: '' };
  let isSettingsPanelOpen = false;

  const DEFAULT_UNIT_SPACING_PX = 100;
  const RULER_BACKGROUND_MODE = 'padded';
  const UNIT_TO_CENTIMETERS = {
    mm: 0.1,
    cm: 1,
    dm: 10,
    m: 100,
    km: 100000
  };
  const UNIT_ALIASES = {
    millimeter: 'mm',
    millimetre: 'mm',
    centimeter: 'cm',
    centimetre: 'cm',
    meter: 'm',
    metre: 'm',
    kilometer: 'km',
    kilometre: 'km'
  };
  const DEFAULT_UNIT_KEY = 'cm';
  const statusNote = doc.querySelector('[data-status-note]');
  const exportButton = doc.getElementById('btnExportSvg');
  const inputs = {
    figureCategory: doc.getElementById('cfg-figure-category'),
    figurePreset: doc.getElementById('cfg-figure-preset'),
    figureName: doc.getElementById('cfg-figure-name'),
    figureImage: doc.getElementById('cfg-figure-image'),
    figureSummary: doc.getElementById('cfg-figure-summary'),
    figureScaleLabel: doc.getElementById('cfg-figure-scale'),
    length: doc.getElementById('cfg-length'),
    subdivisions: doc.getElementById('cfg-subdivisions'),
    unitLabel: doc.getElementById('cfg-unit'),
    boardPadding: doc.getElementById('cfg-board-padding'),
    gridEnabled: doc.getElementById('cfg-grid-enabled'),
    gridSnapEnabled: doc.getElementById('cfg-grid-snap'),
    gridColumns: doc.getElementById('cfg-grid-columns'),
    gridRows: doc.getElementById('cfg-grid-rows'),
    showScaleLabel: doc.getElementById('cfg-show-scale'),
    showUnitLabel: doc.getElementById('cfg-show-unit'),
    measurementWithoutScale: doc.getElementById('cfg-measurement-without-scale'),
    panningEnabled: doc.getElementById('cfg-pan-enabled'),
    measurementTool: doc.getElementById('cfg-measurement-tool'),
    measurementDirectionLock: doc.getElementById('cfg-measurement-direction-lock'),
    measurementDirectionAngleButton: doc.getElementById('cfg-measurement-direction-set-angle'),
    segmentDecimals: doc.getElementById('cfg-segment-decimals')
  };
  const lengthFieldContainer = inputs.length ? inputs.length.closest('label') : null;
  const segmentDecimalsField = inputs.segmentDecimals
    ? inputs.segmentDecimals.closest('label')
    : null;
  const measurementFieldGrid = doc.querySelector('[data-measurement-field-grid]');
  const numberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO') : null;

  const TAPE_BETA_TOOL_KEY = 'tape-beta';
  const TAPE_BETA_HANDLE_SPECS = {
    a: {
      width: 40,
      height: 47,
      anchorX: 0,
      anchorY: 23.5,
      href: '/images/measure/måleredskaper/målebåndSluttstykkeGult.svg'
    },
    b: {
      width: 136,
      height: 72,
      anchorX: 0,
      anchorY: 36,
      href: '/images/measure/måleredskaper/målebåndhus.svg'
    }
  };

  function resolveTapeBetaAnchor(spec) {
    const anchorX = spec && Number.isFinite(spec.anchorX) ? spec.anchorX : 0;
    const fallbackHeight = spec && Number.isFinite(spec.height) ? spec.height : 0;
    const anchorY = spec && Number.isFinite(spec.anchorY) ? spec.anchorY : fallbackHeight;
    return { anchorX, anchorY };
  }
  const transformStates = {
    ruler: { x: 0, y: 0, rotation: 0 },
    segment: { x: 0, y: 0, rotation: 0 },
    [TAPE_BETA_TOOL_KEY]: { x: 0, y: 0, rotation: 0 }
  };
  let tapeAxisFallbackHousingToZero = null;
  const tapeEndpoints = {
    housing: null,
    zero: null
  };
  const defaultActiveTool =
    hasRuler ? 'ruler' : hasTapeBeta ? TAPE_BETA_TOOL_KEY : hasSegment ? 'segment' : 'ruler';
  let transformState = transformStates[defaultActiveTool];
  let suspendTransformPersistence = true;
  const BASE_BOARD_DIMENSIONS = { width: 1000, height: 700 };
  const figureImageDimensions = new Map();
  const figureImageDimensionsPending = new Set();
  const activePointers = {
    ruler: new Map(),
    tape: new Map(),
    segment: new Map(),
    tapeExtension: new Map(),
    tapeHousing: new Map()
  };
  let tapeBetaVisualState = null;
  const boardPanState = { entry: null, enabled: false };
  const boardPanTransform = { x: 0, y: 0 };
  let boardRect = board.getBoundingClientRect();
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  const activeInstrumentForSize = hasRuler ? ruler : hasTapeMeasure ? tapeMeasure : segment;
  const baseSize = {
    width: activeInstrumentForSize ? activeInstrumentForSize.offsetWidth : 0,
    height: activeInstrumentForSize ? activeInstrumentForSize.offsetHeight : 0
  };
  const RULER_SHADOW_FILTER_ID = 'rulerSvgDropShadow';
  const TAPE_STRAP_DEFAULT_HEIGHT = 47;
  const TAPE_STRAP_HANDLE_RATIO = 0.45;
  const TAPE_STRAP_HANDLE_MIN_PX = 24;
  const TAPE_HOUSING_SHIFT_VARIABLE = '--tape-housing-shift';
  const DEFAULT_TAPE_HOUSING_SHIFT_PX = 40;
  const TAPE_STRAP_END_WIDTH = 40;
  const TAPE_DIRECTION = -1;
  const TAPE_HOUSING_HANDOFF_TOLERANCE_PX = 6;
  const zeroOffset = { x: 0, y: 0 };
  const SEGMENT_LABEL_OFFSET_PX = 32;
  let figureData = null;
  let figurePickerData = null;
  let figurePicker = null;
  let figurePickerRequiresScaleLabel = true;

  function buildFigureLibraryBundle(requireScaleLabel = true) {
    const data = buildFigureData({
      app: FIGURE_LIBRARY_APP_KEY,
      extractRealWorldSizeFromText,
      requireScaleLabel
    });
    const pickerData = {
      ...data,
      categories: Array.isArray(data.categories)
        ? data.categories.filter(category => category && category.id !== CUSTOM_CATEGORY_ID)
        : []
    };
    return { data, pickerData };
  }

  function refreshFigureLibrary(requireScaleLabel) {
    let bundle = buildFigureLibraryBundle(requireScaleLabel);
    if (requireScaleLabel && (!bundle.pickerData.categories || bundle.pickerData.categories.length === 0)) {
      bundle = buildFigureLibraryBundle(false);
      requireScaleLabel = false;
    }
    figureData = bundle.data;
    figurePickerData = bundle.pickerData;
    figurePickerRequiresScaleLabel = requireScaleLabel;
    if (!storageWarningMessage) {
      storageWarningMessage = resolveStorageWarningMessage(figureData.metadata);
    }
    figurePicker = createFigurePickerHelpers({
      doc,
      figureData: figurePickerData,
      getFigureValue: figure => (figure && figure.id != null ? String(figure.id) : ''),
      fallbackCategoryId:
        figurePickerData.categories && figurePickerData.categories.length
          ? figurePickerData.categories[0].id
          : CUSTOM_CATEGORY_ID
    });
  }

  refreshFigureLibrary(true);
  function findDefaultPreset() {
    if (!figureData || !Array.isArray(figureData.categories)) {
      return null;
    }
    for (const category of figureData.categories) {
      if (!category || !Array.isArray(category.figures)) {
        continue;
      }
      for (const figure of category.figures) {
        if (figure && !figure.custom) {
          return figure;
        }
      }
    }
    return null;
  }

  const defaultPreset = findDefaultPreset();
  const defaults = {
    length: 10,
    subdivisions: 10,
    unitLabel: '1cm',
    figureName: '',
    figureImage: defaultPreset ? defaultPreset.image : '',
    measurementTarget: '',
    figureSummary: defaultPreset ? defaultPreset.summary : '',
    figureScaleLabel: defaultPreset ? defaultPreset.scaleLabel : '',
    boardPadding: 0,
    gridEnabled: false,
    gridSnapEnabled: false,
    gridColumns: 100,
    gridRows: 100,
    showScaleLabel: false,
    showUnitLabel: true,
    measurementWithoutScale: false,
    panningEnabled: false,
    rulerBackgroundMode: RULER_BACKGROUND_MODE,
    rulerTransform: null,
    boardPanTransform: { x: 0, y: 0 },
    activeTool: defaultActiveTool,
    tapeMeasureLength: 10,
    tapeMeasureTransform: null,
    measurementDirectionLock: 'none',
    measurementDirectionAngle: 0,
    segmentPoints: {
      a: { x: 0.25, y: 0.5 },
      b: { x: 0.75, y: 0.5 }
    },
    segmentDecimals: 2
  };
  const segmentState = {
    a: { x: defaults.segmentPoints.a.x, y: defaults.segmentPoints.a.y },
    b: { x: defaults.segmentPoints.b.x, y: defaults.segmentPoints.b.y }
  };
  const segmentHandlesByKey = new Map();
  if (segmentHandles) {
    segmentHandles.forEach(handle => {
      const key = handle.getAttribute('data-segment-handle');
      if (key) {
        segmentHandlesByKey.set(key, handle);
      }
    });
  }
  const appState = {
    settings: null,
    syncingInputs: false,
    measurementTargetAuto: true,
    activeTool: defaultActiveTool,
    unitLabelCache: {
      withScale: '',
      withoutScale: ''
    },
    directionLockMemory: {
      ruler: 0,
      segment: 0,
      [TAPE_BETA_TOOL_KEY]: 0
    },
    currentDirectionLockMode: 'none',
    currentDirectionLockAngle: null
  };

  function isTapeBetaActive() {
    return appState.activeTool === TAPE_BETA_TOOL_KEY;
  }
  const configContainers = resolveConfigContainers();
  let exportClipIdCounter = 0;

  function isTapeToolKey(value) {
    return value === TAPE_BETA_TOOL_KEY;
  }

  function isSegmentToolKey(value) {
    return value === 'segment' || value === TAPE_BETA_TOOL_KEY;
  }

  function refreshConfigContainers() {
    const latest = resolveConfigContainers();
    if (!latest) {
      return;
    }
    if (latest.root) {
      configContainers.root = latest.root;
    }
    if (latest.measurement) {
      configContainers.measurement = latest.measurement;
    }
    if (latest.measurementGlobal) {
      configContainers.measurementGlobal = latest.measurementGlobal;
    }
  }

  function initResponsiveSettingsPanel() {
    if (!settingsToggleButton || !settingsPanel || !mobileMediaQuery) {
      return;
    }

    const initialText = (settingsToggleButton.textContent || '').trim();
    settingsToggleLabels.open =
      (settingsToggleButton.getAttribute('data-open-label') || initialText || 'Åpne innstillinger').trim();
    settingsToggleLabels.close = (
      settingsToggleButton.getAttribute('data-close-label') || settingsToggleLabels.open
    ).trim();

    if (settingsToggleLabels.open) {
      settingsToggleButton.textContent = settingsToggleLabels.open;
    }

    syncSettingsPanelForViewport(mobileMediaQuery.matches);

    settingsToggleButton.addEventListener('click', event => {
      event.preventDefault();
      if (!mobileMediaQuery.matches) {
        return;
      }
      if (isSettingsPanelOpen) {
        closeSettingsPanel({ focusButton: true });
      } else {
        openSettingsPanel();
      }
    });

    if (settingsOverlay) {
      settingsOverlay.addEventListener('click', () => {
        if (!mobileMediaQuery.matches) {
          return;
        }
        closeSettingsPanel({ focusButton: true });
      });
    }

    doc.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || event.defaultPrevented || !mobileMediaQuery.matches || !isSettingsPanelOpen) {
        return;
      }
      event.preventDefault();
      closeSettingsPanel({ focusButton: true });
    });

    const handleMediaChange = event => {
      if (!event.matches) {
        isSettingsPanelOpen = false;
      }
      syncSettingsPanelForViewport(event.matches);
    };

    if (typeof mobileMediaQuery.addEventListener === 'function') {
      mobileMediaQuery.addEventListener('change', handleMediaChange);
    } else if (typeof mobileMediaQuery.addListener === 'function') {
      mobileMediaQuery.addListener(handleMediaChange);
    }
  }

  function openSettingsPanel() {
    if (!settingsPanel || !mobileMediaQuery || !mobileMediaQuery.matches) {
      return;
    }
    isSettingsPanelOpen = true;
    syncSettingsPanelForViewport(true);
    if (typeof settingsPanel.focus === 'function') {
      try {
        settingsPanel.focus({ preventScroll: true });
      } catch (error) {
        settingsPanel.focus();
      }
    }
  }

  function closeSettingsPanel(options = {}) {
    if (!settingsPanel) {
      return;
    }
    const focusButton = Boolean(options.focusButton);
    const wasOpen = isSettingsPanelOpen;
    isSettingsPanelOpen = false;
    syncSettingsPanelForViewport(mobileMediaQuery ? mobileMediaQuery.matches : false);
    if (wasOpen && focusButton && settingsToggleButton) {
      settingsToggleButton.focus();
    }
  }

  function syncSettingsPanelForViewport(isMobile) {
    if (!settingsPanel) {
      return;
    }
    const body = doc.body;

    if (!isMobile) {
      settingsPanel.classList.remove('side--open');
      settingsPanel.removeAttribute('aria-hidden');
      if (settingsOverlay) {
        settingsOverlay.classList.remove('mobile-settings-overlay--visible');
      }
      if (settingsToggleButton) {
        settingsToggleButton.setAttribute('aria-expanded', 'false');
        if (settingsToggleLabels.open) {
          settingsToggleButton.textContent = settingsToggleLabels.open;
        }
      }
      if (body) {
        body.classList.remove('measurement-settings-open');
      }
      return;
    }

    settingsPanel.setAttribute('aria-hidden', isSettingsPanelOpen ? 'false' : 'true');
    settingsPanel.classList.toggle('side--open', isSettingsPanelOpen);
    if (settingsOverlay) {
      settingsOverlay.classList.toggle('mobile-settings-overlay--visible', isSettingsPanelOpen);
    }
    if (settingsToggleButton) {
      settingsToggleButton.setAttribute('aria-expanded', isSettingsPanelOpen ? 'true' : 'false');
      const label = isSettingsPanelOpen ? settingsToggleLabels.close : settingsToggleLabels.open;
      if (label) {
        settingsToggleButton.textContent = label;
      }
    }
    if (body) {
      body.classList.toggle('measurement-settings-open', isSettingsPanelOpen);
    }
  }

  const TAPE_LENGTH_INFINITE = 'infinite';
  const TAPE_LENGTH_INFINITY_SYMBOL = '∞';

  const tapeLengthState = {
    visiblePx: 0,
    unitSpacing: DEFAULT_UNIT_SPACING_PX,
    minVisiblePx: 0,
    maxVisiblePx: 0,
    totalPx: 0,
    units: defaults.tapeMeasureLength,
    configuredUnits: defaults.tapeMeasureLength
  };

  function resolveTapeMeasureLengthConfig(rawValue, fallback = defaults.tapeMeasureLength) {
    if (isTapeLengthInfinite(rawValue)) {
      return { infinite: true, units: null };
    }
    if (Number.isFinite(rawValue)) {
      return { infinite: false, units: Math.max(1, Math.round(rawValue)) };
    }
    if (isTapeLengthInfinite(fallback)) {
      return { infinite: true, units: null };
    }
    return {
      infinite: false,
      units: Number.isFinite(fallback) ? Math.max(1, Math.round(fallback)) : 1
    };
  }

  function resetTapeMeasureLengthState() {
    const unitSpacing = Number.isFinite(tapeLengthState.unitSpacing) && tapeLengthState.unitSpacing > 0
      ? tapeLengthState.unitSpacing
      : DEFAULT_UNIT_SPACING_PX;
    tapeLengthState.visiblePx = unitSpacing;
    tapeLengthState.units = 1;
    tapeLengthState.maxVisiblePx = Math.max(unitSpacing, tapeLengthState.minVisiblePx);
  }

  function isValidTapeMeasureLength(value) {
    return isTapeLengthInfinite(value) || Number.isFinite(value);
  }

  function areTapeMeasureLengthsEqual(a, b) {
    if (isTapeLengthInfinite(a) || isTapeLengthInfinite(b)) {
      return isTapeLengthInfinite(a) && isTapeLengthInfinite(b);
    }
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return a === b;
    }
    return a === b;
  }

  let lastRenderedUnitSpacing = DEFAULT_UNIT_SPACING_PX;

  appState.settings = normalizeSettings();
  appState.activeTool = sanitizeActiveTool(appState.settings && appState.settings.activeTool, defaultActiveTool);
  initializeUnitLabelCache(appState.settings);
  appState.measurementTargetAuto = shouldUseAutoMeasurementTarget(appState.settings);
  applySettings(appState.settings);
  syncInputs(appState.settings);
  const initialToolKey = appState.activeTool;
  const initialTransform = sanitizeRulerTransform(
    appState.settings &&
      (isTapeToolKey(initialToolKey)
        ? appState.settings.tapeMeasureTransform
        : appState.settings.rulerTransform),
    null
  );
  if (initialTransform) {
    applyInstrumentTransform(initialTransform, { allowSnap: false, persist: false }, initialToolKey);
    suspendTransformPersistence = false;
    persistActiveInstrumentState();
  } else {
    suspendTransformPersistence = false;
    centerRuler();
  }

  attachInputListeners();
  if (exportButton) {
    exportButton.addEventListener('click', handleExport);
  }

  attachInstrumentPointerHandlers(ruler, 'ruler');
  if (tapeMoveHandle) {
    attachInstrumentPointerHandlers(tapeMoveHandle, 'tape');
  }
  attachInstrumentPointerHandlers(tapeStrap, 'tape');
  attachInstrumentPointerHandlers(tapeHousing, 'tape');
  attachTapeExtensionHandlers(tapeZeroHandle || tapeStrap);
  attachTapeHousingHandlers(tapeHousingShiftHandle);
  attachInstrumentFocusHandlers(ruler, 'ruler');
  attachInstrumentFocusHandlers(tapeMeasure, 'tape');
  if (segmentHandlesByKey.size > 0) {
    for (const handle of segmentHandlesByKey.values()) {
      handle.addEventListener('pointerdown', handleSegmentPointerDown, { passive: false });
      handle.addEventListener('pointermove', handleSegmentPointerMove);
      handle.addEventListener('pointerup', handleSegmentPointerEnd);
      handle.addEventListener('pointercancel', handleSegmentPointerEnd);
      handle.addEventListener('lostpointercapture', event => {
        if (event.pointerId == null) {
          return;
        }
        if (
          activePointers.segment.delete(event.pointerId) &&
          activePointers.segment.size === 0 &&
          isSegmentToolKey(appState.activeTool)
        ) {
          persistSegmentState();
        }
      });
    }
  }
  if (segmentLine) {
    segmentLine.addEventListener('pointerdown', handleSegmentBodyPointerDown, { passive: false });
    segmentLine.addEventListener('pointermove', handleSegmentPointerMove);
    segmentLine.addEventListener('pointerup', handleSegmentPointerEnd);
    segmentLine.addEventListener('pointercancel', handleSegmentPointerEnd);
    segmentLine.addEventListener('lostpointercapture', event => {
      if (event.pointerId == null) {
        return;
      }
      if (
        activePointers.segment.delete(event.pointerId) &&
        activePointers.segment.size === 0 &&
        isSegmentToolKey(appState.activeTool)
      ) {
        persistSegmentState();
      }
    });
  }
  if (tapeBetaStrapElement) {
    tapeBetaStrapElement.addEventListener('pointerdown', handleTapeBetaStrapPointerDown, {
      passive: false
    });
    tapeBetaStrapElement.addEventListener('pointermove', handleSegmentPointerMove);
    tapeBetaStrapElement.addEventListener('pointerup', handleSegmentPointerEnd);
    tapeBetaStrapElement.addEventListener('pointercancel', handleSegmentPointerEnd);
    tapeBetaStrapElement.addEventListener('lostpointercapture', event => {
      if (event.pointerId == null) {
        return;
      }
      if (
        activePointers.segment.delete(event.pointerId) &&
        activePointers.segment.size === 0 &&
        isSegmentToolKey(appState.activeTool)
      ) {
        persistSegmentState();
      }
    });
  }
  attachInstrumentFocusHandlers(segment, 'segment');

  board.addEventListener('dblclick', event => {
    event.preventDefault();
    if (!hasAnyActivePointers()) {
      centerRuler();
    }
  });

  board.addEventListener('pointerdown', handleBoardPointerDown, { passive: false });
  board.addEventListener('pointermove', handleBoardPointerMove, { passive: false });
  board.addEventListener('pointerup', handleBoardPointerEnd);
  board.addEventListener('pointercancel', handleBoardPointerCancel);
  board.addEventListener('lostpointercapture', handleBoardLostPointerCapture);

  window.addEventListener('resize', handleResize);

  initResponsiveSettingsPanel();

  function resolveConfigContainers() {
    const globalScope = typeof window !== 'undefined' ? window : null;
    if (!globalScope) {
      return { root: null, measurement: null, measurementGlobal: null };
    }
    let root = globalScope.CFG;
    if (!root || typeof root !== 'object') {
      root = {};
      globalScope.CFG = root;
    }
    let measurement = root.measurement;
    if (!measurement || typeof measurement !== 'object') {
      measurement = {};
      root.measurement = measurement;
    }
    let measurementGlobal = root.measurementGlobal;
    if (!measurementGlobal || typeof measurementGlobal !== 'object') {
      measurementGlobal = {};
      root.measurementGlobal = measurementGlobal;
    }
    return { root, measurement, measurementGlobal };
  }

  function applySource(target, source) {
    if (!source || typeof source !== 'object') {
      return;
    }
    if (source.length != null) target.length = source.length;
    if (source.rulerLength != null && target.length == null) target.length = source.rulerLength;
    if (source.maxValue != null && target.length == null) target.length = source.maxValue;
    if (source.subdivisions != null) target.subdivisions = source.subdivisions;
    if (source.marksBetween != null && target.subdivisions == null) target.subdivisions = source.marksBetween;
    if (source.minorTicks != null && target.subdivisions == null) target.subdivisions = source.minorTicks;
    if (typeof source.unitLabel === 'string') target.unitLabel = source.unitLabel;
    if (typeof source.figureName === 'string') target.figureName = source.figureName;
    if (typeof source.figureLabel === 'string' && target.figureName == null) target.figureName = source.figureLabel;
    if (typeof source.figureImage === 'string') target.figureImage = source.figureImage;
    if (typeof source.figureSummary === 'string') target.figureSummary = source.figureSummary;
    if (typeof source.figureScaleLabel === 'string') target.figureScaleLabel = source.figureScaleLabel;
    if (typeof source.measurementTarget === 'string') target.measurementTarget = source.measurementTarget;
    if (source.boardPadding != null) target.boardPadding = source.boardPadding;
    if (source.boardPanTransform != null) target.boardPanTransform = source.boardPanTransform;
    else if (source.boardPan != null) target.boardPanTransform = source.boardPan;
    if (source.rulerTransform != null) target.rulerTransform = source.rulerTransform;
    if (source.tapeMeasureTransform != null) target.tapeMeasureTransform = source.tapeMeasureTransform;
    if (source.tapeMeasureLength != null) target.tapeMeasureLength = source.tapeMeasureLength;
    if (Object.prototype.hasOwnProperty.call(source, 'rulerStartAtZero')) {
      delete target.rulerStartAtZero;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'gridEnabled')) target.gridEnabled = source.gridEnabled;
    if (Object.prototype.hasOwnProperty.call(source, 'gridSnapEnabled')) {
      target.gridSnapEnabled = source.gridSnapEnabled;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'gridColumns')) {
      target.gridColumns = source.gridColumns;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'gridRows')) {
      target.gridRows = source.gridRows;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'showScaleLabel')) target.showScaleLabel = source.showScaleLabel;
    if (Object.prototype.hasOwnProperty.call(source, 'showUnitLabel')) target.showUnitLabel = source.showUnitLabel;
    if (Object.prototype.hasOwnProperty.call(source, 'measurementWithoutScale')) {
      target.measurementWithoutScale = source.measurementWithoutScale;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'panningEnabled')) {
      target.panningEnabled = source.panningEnabled;
    } else if (Object.prototype.hasOwnProperty.call(source, 'panorering')) {
      target.panningEnabled = source.panorering;
    } else if (Object.prototype.hasOwnProperty.call(source, 'panEnabled')) {
      target.panningEnabled = source.panEnabled;
    } else if (Object.prototype.hasOwnProperty.call(source, 'allowPan')) {
      target.panningEnabled = source.allowPan;
    }
    if (typeof source.activeTool === 'string') {
      target.activeTool = source.activeTool;
    }
    if (typeof source.measurementDirectionLock === 'string') {
      target.measurementDirectionLock = source.measurementDirectionLock;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'measurementDirectionAngle')) {
      target.measurementDirectionAngle = source.measurementDirectionAngle;
    }
    if (source.segmentPoints != null) {
      target.segmentPoints = source.segmentPoints;
    }
    if (Object.prototype.hasOwnProperty.call(source, 'segmentDecimals')) {
      target.segmentDecimals = source.segmentDecimals;
    }
    // unit spacing is fixed and not configurable
  }

  function applySettingsToContainer(container, settings, options) {
    if (!container || typeof container !== 'object') {
      return;
    }
    const mode = options && options.mode;
    if (mode === 'global') {
      container.length = settings.length;
      container.subdivisions = settings.subdivisions;
      container.unitLabel = settings.unitLabel;
      container.boardPadding = settings.boardPadding;
      container.rulerBackgroundMode = settings.rulerBackgroundMode;
      container.gridEnabled = settings.gridEnabled;
      container.gridSnapEnabled = settings.gridSnapEnabled;
      container.gridColumns = settings.gridColumns;
      container.gridRows = settings.gridRows;
      container.showScaleLabel = settings.showScaleLabel;
      container.showUnitLabel = settings.showUnitLabel;
      container.measurementWithoutScale = !!settings.measurementWithoutScale;
      container.panningEnabled = !!settings.panningEnabled;
      container.panorering = !!settings.panningEnabled;
      container.activeTool = settings.activeTool;
      container.tapeMeasureLength = settings.tapeMeasureLength;
      container.measurementDirectionLock = settings.measurementDirectionLock;
      container.measurementDirectionAngle = settings.measurementDirectionAngle;
      container.segmentPoints = cloneSegmentPoints(settings.segmentPoints);
      container.segmentDecimals = settings.segmentDecimals;
      delete container.rulerStartAtZero;
      delete container.rulerPadding;
      delete container.unitSpacingOverride;
      delete container.figureName;
      delete container.figureImage;
      delete container.figureSummary;
      delete container.figureScaleLabel;
      delete container.measurementTarget;
      delete container.rulerTransform;
      delete container.tapeMeasureTransform;
      delete container.boardPanTransform;
      delete container.boardPan;
      return;
    }
    container.length = settings.length;
    container.subdivisions = settings.subdivisions;
    container.unitLabel = settings.unitLabel;
    container.figureName = settings.figureName;
    container.figureImage = settings.figureImage;
    container.figureSummary = settings.figureSummary || '';
    container.figureScaleLabel = settings.figureScaleLabel || '';
    container.measurementTarget = settings.measurementTarget;
    container.boardPadding = settings.boardPadding;
    container.rulerBackgroundMode = settings.rulerBackgroundMode;
    container.gridEnabled = settings.gridEnabled;
    container.gridSnapEnabled = settings.gridSnapEnabled;
    container.gridColumns = settings.gridColumns;
    container.gridRows = settings.gridRows;
    container.showScaleLabel = settings.showScaleLabel;
    container.showUnitLabel = settings.showUnitLabel;
    container.measurementWithoutScale = !!settings.measurementWithoutScale;
    container.panningEnabled = !!settings.panningEnabled;
    container.panorering = !!settings.panningEnabled;
    container.activeTool = settings.activeTool;
    container.tapeMeasureLength = settings.tapeMeasureLength;
    container.measurementDirectionLock = settings.measurementDirectionLock;
    container.measurementDirectionAngle = settings.measurementDirectionAngle;
    container.segmentPoints = cloneSegmentPoints(settings.segmentPoints);
    container.segmentDecimals = settings.segmentDecimals;
    delete container.unitSpacingOverride;
    delete container.rulerPadding;
    delete container.rulerStartAtZero;
    if (settings.rulerTransform && typeof settings.rulerTransform === 'object') {
      container.rulerTransform = { ...settings.rulerTransform };
    } else {
      delete container.rulerTransform;
    }
    if (settings.tapeMeasureTransform && typeof settings.tapeMeasureTransform === 'object') {
      container.tapeMeasureTransform = { ...settings.tapeMeasureTransform };
    } else {
      delete container.tapeMeasureTransform;
    }
    if (settings.boardPanTransform && typeof settings.boardPanTransform === 'object') {
      container.boardPanTransform = { ...settings.boardPanTransform };
    } else {
      delete container.boardPanTransform;
    }
  }

  function isTapeLengthInfinite(value) {
    return value === TAPE_LENGTH_INFINITE;
  }

  function sanitizeLength(value, fallback, { allowInfinite = false } = {}) {
    if (allowInfinite) {
      if (isTapeLengthInfinite(value)) {
        return TAPE_LENGTH_INFINITE;
      }
      if (value === Infinity || value === Number.POSITIVE_INFINITY) {
        return TAPE_LENGTH_INFINITE;
      }
      if (typeof value === 'string') {
        const normalized = value.trim();
        if (normalized === TAPE_LENGTH_INFINITY_SYMBOL) {
          return TAPE_LENGTH_INFINITE;
        }
        if (/^(inf|infinity)$/i.test(normalized)) {
          return TAPE_LENGTH_INFINITE;
        }
      }
    }

    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      const fallbackNumber = Number.isFinite(fallback)
        ? fallback
        : Number.parseFloat(fallback);
      const safeFallback = Number.isFinite(fallbackNumber) ? fallbackNumber : 1;
      return Math.max(Math.round(safeFallback), 1);
    }
    const rounded = Math.round(parsed);
    if (!Number.isFinite(rounded)) {
      const fallbackNumber = Number.isFinite(fallback)
        ? fallback
        : Number.parseFloat(fallback);
      const safeFallback = Number.isFinite(fallbackNumber) ? fallbackNumber : 1;
      return Math.max(Math.round(safeFallback), 1);
    }
    return Math.max(rounded, 1);
  }

  function sanitizeSubdivisions(value, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    const rounded = Math.round(parsed);
    if (!Number.isFinite(rounded)) {
      return fallback;
    }
    return Math.min(Math.max(rounded, 0), 20);
  }

  function collapseWhitespace(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/[\s\u00A0]+/g, ' ').trim();
  }

  function sanitizeUnitLabel(value, fallback) {
    const normalized = collapseWhitespace(value);
    if (!normalized) {
      return fallback;
    }
    return normalized.slice(0, 24);
  }

  function sanitizeFigureName(value, fallback) {
    const normalized = collapseWhitespace(value);
    if (!normalized) {
      return fallback;
    }
    return normalized.slice(0, 60);
  }

  function sanitizeFigureImage(value, fallback) {
    if (typeof value !== 'string') {
      return fallback;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return fallback;
    }
    return trimmed;
  }

  function sanitizeOptionalText(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  function sanitizeFigureScaleLabel(value, fallback) {
    if (value === undefined) {
      return fallback || '';
    }
    if (value === null) {
      return '';
    }
    const normalized = collapseWhitespace(value);
    if (!normalized) {
      return '';
    }
    return normalized.slice(0, 80);
  }

  function sanitizeBoardPadding(value, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return Math.max(0, fallback || 0);
    }
    const rounded = Math.round(parsed);
    if (!Number.isFinite(rounded)) {
      return Math.max(0, fallback || 0);
    }
    return Math.min(Math.max(rounded, 0), 200);
  }

  function sanitizeBoolean(value, fallback) {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        return false;
      }
      if (['true', '1', 'on', 'yes'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'off', 'no'].includes(normalized)) {
        return false;
      }
    }
    return fallback;
  }

  function sanitizeGridEnabled(value, fallback) {
    if (value === undefined) {
      return fallback;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) {
        return false;
      }
      if (['true', '1', 'on', 'yes'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'off', 'no'].includes(normalized)) {
        return false;
      }
    }
    return fallback;
  }

  function sanitizeGridCount(value, fallback) {
    const minimum = 1;
    const maximum = 200;
    const baseFallback = Number.isFinite(fallback) ? fallback : 100;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      return Math.min(Math.max(baseFallback, minimum), maximum);
    }
    const rounded = Math.round(parsed);
    if (!Number.isFinite(rounded)) {
      return Math.min(Math.max(baseFallback, minimum), maximum);
    }
    return Math.min(Math.max(rounded, minimum), maximum);
  }

  function buildDefaultMeasurementTarget() {
    return '';
  }

  function sanitizeMeasurementTarget(value, figureName, fallback) {
    let normalized = collapseWhitespace(value);
    if (!normalized) {
      normalized = collapseWhitespace(fallback);
    }
    if (!normalized) {
      normalized = buildDefaultMeasurementTarget(figureName);
    }
    return normalized.slice(0, 120);
  }

  function sanitizeRulerTransform(value, fallback) {
    const source = value && typeof value === 'object' ? value : fallback;
    if (!source || typeof source !== 'object') {
      return null;
    }
    const x = Number.parseFloat(source.x);
    const y = Number.parseFloat(source.y);
    const rotation = Number.parseFloat(source.rotation);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(rotation)) {
      return null;
    }
    return {
      x,
      y,
      rotation: normalizeAngle(rotation)
    };
  }

  function sanitizeSegmentPoints(value, fallback) {
    const source = value && typeof value === 'object' ? value : null;
    const reference = fallback && typeof fallback === 'object' ? fallback : defaults.segmentPoints;
    const sanitizePoint = (point, referencePoint) => {
      const px = point && typeof point === 'object' ? Number.parseFloat(point.x) : NaN;
      const py = point && typeof point === 'object' ? Number.parseFloat(point.y) : NaN;
      const fallbackPoint = referencePoint && typeof referencePoint === 'object' ? referencePoint : null;
      if (!Number.isFinite(px) || !Number.isFinite(py)) {
        if (fallbackPoint) {
          return { x: Number(fallbackPoint.x) || 0, y: Number(fallbackPoint.y) || 0 };
        }
        return null;
      }
      const clampedX = Math.min(Math.max(px, 0), 1);
      const clampedY = Math.min(Math.max(py, 0), 1);
      return { x: clampedX, y: clampedY };
    };
    const fallbackA = reference ? reference.a : null;
    const fallbackB = reference ? reference.b : null;
    const pointA = sanitizePoint(source ? source.a : null, fallbackA);
    const pointB = sanitizePoint(source ? source.b : null, fallbackB);
    if (!pointA || !pointB) {
      return null;
    }
    return { a: pointA, b: pointB };
  }

  function sanitizeSegmentDecimals(value, fallback) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) {
      const fallbackNumber = Number.isFinite(fallback)
        ? fallback
        : Number.parseFloat(fallback);
      const safeFallback = Number.isFinite(fallbackNumber) ? fallbackNumber : defaults.segmentDecimals;
      return Math.min(Math.max(Math.round(safeFallback), 0), 6);
    }
    const rounded = Math.round(parsed);
    if (!Number.isFinite(rounded)) {
      return Math.min(Math.max(defaults.segmentDecimals, 0), 6);
    }
    return Math.min(Math.max(rounded, 0), 6);
  }

  function resolveSegmentDecimals(settings) {
    if (!settings) {
      return defaults.segmentDecimals;
    }
    return sanitizeSegmentDecimals(settings.segmentDecimals, defaults.segmentDecimals);
  }

  function cloneSegmentPoints(value) {
    const sanitized = sanitizeSegmentPoints(value, defaults.segmentPoints);
    const reference = sanitized || defaults.segmentPoints;
    return {
      a: { x: reference.a.x, y: reference.a.y },
      b: { x: reference.b.x, y: reference.b.y }
    };
  }

  function areSegmentPointsEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    const ax = Number(a.a && a.a.x);
    const ay = Number(a.a && a.a.y);
    const bx = Number(b.a && b.a.x);
    const by = Number(b.a && b.a.y);
    const cx = Number(a.b && a.b.x);
    const cy = Number(a.b && a.b.y);
    const dx = Number(b.b && b.b.x);
    const dy = Number(b.b && b.b.y);
    return (
      Math.abs(ax - bx) < 0.0001 &&
      Math.abs(ay - by) < 0.0001 &&
      Math.abs(cx - dx) < 0.0001 &&
      Math.abs(cy - dy) < 0.0001
    );
  }

  function sanitizeActiveTool(value, fallback) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === TAPE_BETA_TOOL_KEY && hasTapeBeta) {
      return TAPE_BETA_TOOL_KEY;
    }
    if (normalized === 'tape' && hasTapeBeta) {
      return TAPE_BETA_TOOL_KEY;
    }
    if (normalized === 'segment' && hasSegment) {
      return 'segment';
    }
    if (normalized === 'ruler' && hasRuler) {
      return 'ruler';
    }
    const fallbackNormalized = typeof fallback === 'string' ? fallback.trim().toLowerCase() : '';
    if (fallbackNormalized === TAPE_BETA_TOOL_KEY && hasTapeBeta) {
      return TAPE_BETA_TOOL_KEY;
    }
    if (fallbackNormalized === 'tape' && hasTapeBeta) {
      return TAPE_BETA_TOOL_KEY;
    }
    if (fallbackNormalized === 'segment' && hasSegment) {
      return 'segment';
    }
    if (fallbackNormalized === 'ruler' && hasRuler) {
      return 'ruler';
    }
    if (hasTapeBeta) {
      return TAPE_BETA_TOOL_KEY;
    }
    if (hasSegment) {
      return 'segment';
    }
    if (hasRuler) {
      return 'ruler';
    }
    return fallbackNormalized || 'ruler';
  }

  function sanitizeMeasurementDirectionLock(value, fallback) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'none' || normalized === 'nei' || normalized === 'no') {
      return 'none';
    }
    if (normalized === 'horizontal' || normalized === 'horisontal') {
      return 'horizontal';
    }
    if (normalized === 'vertical' || normalized === 'vertikal' || normalized === 'verikal') {
      return 'vertical';
    }
    if (normalized === 'angle' || normalized === 'vinkel' || normalized === 'custom') {
      return 'angle';
    }
    if (typeof fallback === 'string' && fallback.trim()) {
      return sanitizeMeasurementDirectionLock(fallback, 'none');
    }
    return 'none';
  }

  function sanitizeMeasurementDirectionAngle(value, fallback) {
    const parsed = parseAngle(value);
    if (parsed != null) {
      return parsed;
    }
    const fallbackParsed = parseAngle(fallback);
    if (fallbackParsed != null) {
      return fallbackParsed;
    }
    return 0;
  }

  function parseAngle(source) {
    if (source == null) {
      return null;
    }
    if (Number.isFinite(source)) {
      return normalizeAngle(source);
    }
    if (typeof source === 'string') {
      const trimmed = source.trim();
      if (!trimmed) {
        return null;
      }
      const lower = trimmed.toLowerCase();
      let numericSource = trimmed;
      let isDegree = false;
      if (lower.endsWith('deg')) {
        numericSource = trimmed.slice(0, -3);
        isDegree = true;
      } else if (lower.endsWith('°')) {
        numericSource = trimmed.slice(0, -1);
        isDegree = true;
      }
      const normalizedNumeric = numericSource.replace(',', '.');
      const parsed = Number.parseFloat(normalizedNumeric);
      if (!Number.isFinite(parsed)) {
        return null;
      }
      const radians = isDegree ? (parsed * Math.PI) / 180 : parsed;
      return normalizeAngle(radians);
    }
    return null;
  }

  function sanitizeBoardPanTransform(value, fallback) {
    const source = value && typeof value === 'object' ? value : fallback;
    if (!source || typeof source !== 'object') {
      return { x: 0, y: 0 };
    }
    const xRaw = Number.parseFloat(source.x);
    const yRaw = Number.parseFloat(source.y);
    if (!Number.isFinite(xRaw) || !Number.isFinite(yRaw)) {
      if (fallback && fallback !== source) {
        return sanitizeBoardPanTransform(fallback, null);
      }
      return { x: 0, y: 0 };
    }
    const limits =
      boardRect && Number.isFinite(boardRect.width) && Number.isFinite(boardRect.height)
        ? boardRect
        : board
        ? board.getBoundingClientRect()
        : null;
    const maxX =
      limits && Number.isFinite(limits.width)
        ? Math.max(limits.width, BASE_BOARD_DIMENSIONS.width)
        : BASE_BOARD_DIMENSIONS.width;
    const maxY =
      limits && Number.isFinite(limits.height)
        ? Math.max(limits.height, BASE_BOARD_DIMENSIONS.height)
        : BASE_BOARD_DIMENSIONS.height;
    const clampedX = Math.min(Math.max(xRaw, -maxX), maxX);
    const clampedY = Math.min(Math.max(yRaw, -maxY), maxY);
    return { x: clampedX, y: clampedY };
  }

  function resolveBoardPaddingValue(settings) {
    if (!settings) {
      return 0;
    }
    const value = settings.boardPadding;
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.max(0, value);
  }

  function normalizeSettings(overrides) {
    refreshConfigContainers();
    const combined = { ...defaults };
    applySource(combined, configContainers.root);
    if (configContainers.measurementGlobal && configContainers.measurementGlobal !== configContainers.root) {
      applySource(combined, configContainers.measurementGlobal);
    }
    if (configContainers.measurement !== configContainers.root) {
      applySource(combined, configContainers.measurement);
    }
    if (overrides && typeof overrides === 'object') {
      Object.assign(combined, overrides);
    }

    delete combined.rulerStartAtZero;

    const length = sanitizeLength(combined.length, defaults.length);
    const subdivisions = sanitizeSubdivisions(combined.subdivisions, defaults.subdivisions);
    const unitLabel = sanitizeUnitLabel(combined.unitLabel, defaults.unitLabel);
    const figureName = sanitizeFigureName(combined.figureName, defaults.figureName);
    const figureImage = sanitizeFigureImage(combined.figureImage, defaults.figureImage);
    const figureSummary = sanitizeOptionalText(combined.figureSummary);
    const measurementTarget = sanitizeMeasurementTarget(combined.measurementTarget, figureName, defaults.measurementTarget);
    const figureScaleLabel = sanitizeFigureScaleLabel(combined.figureScaleLabel, defaults.figureScaleLabel);
    const boardPadding = sanitizeBoardPadding(combined.boardPadding, defaults.boardPadding);
    const rulerBackgroundMode = RULER_BACKGROUND_MODE;
    const gridEnabled = sanitizeGridEnabled(combined.gridEnabled, defaults.gridEnabled);
    const gridSnapEnabled = sanitizeBoolean(combined.gridSnapEnabled, gridEnabled);
    const gridColumns = sanitizeGridCount(combined.gridColumns, defaults.gridColumns);
    const gridRows = sanitizeGridCount(combined.gridRows, defaults.gridRows);
    const showScaleLabel = sanitizeGridEnabled(combined.showScaleLabel, defaults.showScaleLabel);
    const showUnitLabel = sanitizeBoolean(combined.showUnitLabel, defaults.showUnitLabel);
    const measurementWithoutScale = sanitizeBoolean(
      combined.measurementWithoutScale,
      defaults.measurementWithoutScale
    );
    const panningEnabled = sanitizeBoolean(combined.panningEnabled, defaults.panningEnabled);
    const rulerTransform = sanitizeRulerTransform(combined.rulerTransform, defaults.rulerTransform);
    const boardPanTransform = sanitizeBoardPanTransform(combined.boardPanTransform, defaults.boardPanTransform);
    const tapeMeasureTransform = sanitizeRulerTransform(
      combined.tapeMeasureTransform,
      defaults.tapeMeasureTransform
    );
    const activeTool = sanitizeActiveTool(combined.activeTool, defaults.activeTool);
    const tapeMeasureLength = sanitizeLength(
      combined.tapeMeasureLength,
      defaults.tapeMeasureLength,
      { allowInfinite: true }
    );
    const measurementDirectionLock = sanitizeMeasurementDirectionLock(
      combined.measurementDirectionLock,
      defaults.measurementDirectionLock
    );
    const measurementDirectionAngle = sanitizeMeasurementDirectionAngle(
      combined.measurementDirectionAngle,
      defaults.measurementDirectionAngle
    );
    const segmentPoints = sanitizeSegmentPoints(combined.segmentPoints, defaults.segmentPoints);
    const segmentDecimals = sanitizeSegmentDecimals(
      combined.segmentDecimals,
      defaults.segmentDecimals
    );

    const settings = {
      length,
      subdivisions,
      unitLabel,
      figureName,
      figureImage,
      figureSummary,
      figureScaleLabel,
      measurementTarget,
      boardPadding,
      rulerBackgroundMode,
      gridEnabled,
      gridSnapEnabled,
      gridColumns,
      gridRows,
      showScaleLabel,
      showUnitLabel,
      measurementWithoutScale,
      panningEnabled,
      rulerTransform,
      boardPanTransform,
      activeTool,
      tapeMeasureLength,
      tapeMeasureTransform,
      measurementDirectionLock,
      measurementDirectionAngle,
      segmentPoints: segmentPoints || cloneSegmentPoints(defaults.segmentPoints),
      segmentDecimals
    };

    applySettingsToContainer(configContainers.measurement, settings);
    if (configContainers.measurementGlobal) {
      applySettingsToContainer(configContainers.measurementGlobal, settings, { mode: 'global' });
    }
    if (
      configContainers.root &&
      configContainers.root !== configContainers.measurement &&
      configContainers.root !== configContainers.measurementGlobal
    ) {
      applySettingsToContainer(configContainers.root, settings);
    }

    return settings;
  }

  function areSettingsEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return (
      a.length === b.length &&
      a.subdivisions === b.subdivisions &&
      a.unitLabel === b.unitLabel &&
      a.figureName === b.figureName &&
      a.figureImage === b.figureImage &&
      a.figureSummary === b.figureSummary &&
      a.figureScaleLabel === b.figureScaleLabel &&
      a.measurementTarget === b.measurementTarget &&
      a.boardPadding === b.boardPadding &&
      a.rulerBackgroundMode === b.rulerBackgroundMode &&
      a.gridEnabled === b.gridEnabled &&
      a.gridSnapEnabled === b.gridSnapEnabled &&
      a.gridColumns === b.gridColumns &&
      a.gridRows === b.gridRows &&
      a.showScaleLabel === b.showScaleLabel &&
      a.showUnitLabel === b.showUnitLabel &&
      a.measurementWithoutScale === b.measurementWithoutScale &&
      a.panningEnabled === b.panningEnabled &&
      a.activeTool === b.activeTool &&
      a.tapeMeasureLength === b.tapeMeasureLength &&
      a.measurementDirectionLock === b.measurementDirectionLock &&
      areAnglesApproximatelyEqual(a.measurementDirectionAngle, b.measurementDirectionAngle) &&
      a.segmentDecimals === b.segmentDecimals &&
      areSegmentPointsEqual(a.segmentPoints, b.segmentPoints) &&
      areRulerTransformsEqual(a.rulerTransform, b.rulerTransform) &&
      areRulerTransformsEqual(a.tapeMeasureTransform, b.tapeMeasureTransform) &&
      areBoardPanTransformsEqual(a.boardPanTransform, b.boardPanTransform)
    );
  }

  function areRulerTransformsEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    const epsilon = 0.001;
    return (
      Math.abs(a.x - b.x) <= epsilon &&
      Math.abs(a.y - b.y) <= epsilon &&
      Math.abs(normalizeAngle(a.rotation) - normalizeAngle(b.rotation)) <= epsilon
    );
  }

  function areAnglesApproximatelyEqual(a, b) {
    if (a === b) {
      return true;
    }
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      return false;
    }
    const epsilon = 0.001;
    return Math.abs(normalizeAngle(a) - normalizeAngle(b)) <= epsilon;
  }

  function areBoardPanTransformsEqual(a, b) {
    if (a === b) {
      return true;
    }
    const first = sanitizeBoardPanTransform(a, defaults.boardPanTransform);
    const second = sanitizeBoardPanTransform(b, defaults.boardPanTransform);
    if (!first || !second) {
      return false;
    }
    const epsilon = 0.001;
    return Math.abs(first.x - second.x) <= epsilon && Math.abs(first.y - second.y) <= epsilon;
  }

  function getScaleDenominatorFromSettings(settings) {
    if (!settings) {
      return 1;
    }
    const info = resolveScaleInfo(settings);
    if (!info || !Number.isFinite(info.desiredDenominator) || info.desiredDenominator <= 0) {
      return 1;
    }
    return info.desiredDenominator;
  }

  function computeUnitLabelForMode(sourceLabel, settings, mode) {
    const sanitized = sanitizeUnitLabel(sourceLabel, sourceLabel);
    if (!sanitized) {
      return sanitized;
    }
    const unitInfo = resolveUnitLabelInfo(sanitized);
    if (!unitInfo || !unitInfo.unitKey || unitInfo.baseFactor == null) {
      return sanitized;
    }
    const denominator = getScaleDenominatorFromSettings(settings);
    if (!Number.isFinite(denominator) || denominator <= 0 || Math.abs(denominator - 1) <= 0.000001) {
      return sanitized;
    }
    const quantity = Number.isFinite(unitInfo.quantity) && unitInfo.quantity > 0 ? unitInfo.quantity : 1;
    let nextQuantity;
    if (mode === 'withoutScale') {
      nextQuantity = roundForDisplay(quantity * denominator);
    } else if (mode === 'withScale') {
      nextQuantity = roundForDisplay(quantity / denominator);
    } else {
      nextQuantity = quantity;
    }
    if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
      return sanitized;
    }
    const formattedQuantity = formatNumber(nextQuantity);
    if (!formattedQuantity) {
      return sanitized;
    }
    const pattern = /^([0-9]+(?:[.,][0-9]+)?)(.*)$/;
    const match = sanitized.match(pattern);
    const suffix = match ? match[2] : sanitized.includes(' ') ? ` ${unitInfo.unitKey}` : unitInfo.unitKey;
    const result = `${formattedQuantity}${suffix}`;
    return sanitizeUnitLabel(result, result);
  }

  function rememberUnitLabel(mode, value) {
    if (!appState.unitLabelCache) {
      appState.unitLabelCache = { withScale: '', withoutScale: '' };
    }
    const sanitized = sanitizeUnitLabel(value, value);
    if (typeof sanitized !== 'string') {
      return;
    }
    if (mode === 'withoutScale') {
      appState.unitLabelCache.withoutScale = sanitized;
    } else if (mode === 'withScale') {
      appState.unitLabelCache.withScale = sanitized;
    }
  }

  function initializeUnitLabelCache(settings) {
    if (!appState.unitLabelCache) {
      appState.unitLabelCache = { withScale: '', withoutScale: '' };
    }
    appState.unitLabelCache.withScale = '';
    appState.unitLabelCache.withoutScale = '';
    if (!settings) {
      return;
    }
    const activeLabel = sanitizeUnitLabel(settings.unitLabel, settings.unitLabel);
    if (!activeLabel) {
      return;
    }
    if (settings.measurementWithoutScale) {
      rememberUnitLabel('withoutScale', activeLabel);
      const withScaleLabel = computeUnitLabelForMode(activeLabel, settings, 'withScale');
      rememberUnitLabel('withScale', withScaleLabel);
    } else {
      rememberUnitLabel('withScale', activeLabel);
      const withoutScaleLabel = computeUnitLabelForMode(activeLabel, settings, 'withoutScale');
      rememberUnitLabel('withoutScale', withoutScaleLabel);
    }
  }

  function syncUnitLabelCache(settings) {
    if (!settings) {
      return;
    }
    const activeLabel = sanitizeUnitLabel(settings.unitLabel, settings.unitLabel);
    if (settings.measurementWithoutScale) {
      rememberUnitLabel('withoutScale', activeLabel);
    } else {
      rememberUnitLabel('withScale', activeLabel);
    }
  }

  function updateSettings(partial) {
    if (!appState.settings) {
      return;
    }
    const previousSettings = appState.settings;
    const nextPartial = { ...partial };
    if (Object.prototype.hasOwnProperty.call(partial, 'unitLabel')) {
      const sanitizedLabel = sanitizeUnitLabel(partial.unitLabel, partial.unitLabel);
      if (typeof sanitizedLabel === 'string') {
        const currentMode =
          appState.settings && appState.settings.measurementWithoutScale ? 'withoutScale' : 'withScale';
        rememberUnitLabel(currentMode, sanitizedLabel);
        if (currentMode === 'withoutScale') {
          const scaleContext = {
            ...appState.settings,
            ...nextPartial,
            measurementWithoutScale: true,
            unitLabel: sanitizedLabel
          };
          const derivedWithScale = computeUnitLabelForMode(sanitizedLabel, scaleContext, 'withScale');
          if (typeof derivedWithScale === 'string') {
            rememberUnitLabel('withScale', derivedWithScale);
          }
        }
      }
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'segmentPoints')) {
      const sanitizedSegment = sanitizeSegmentPoints(
        partial.segmentPoints,
        appState.settings && appState.settings.segmentPoints
      );
      if (sanitizedSegment) {
        nextPartial.segmentPoints = sanitizedSegment;
      }
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'segmentDecimals')) {
      const currentDecimals = appState.settings
        ? appState.settings.segmentDecimals
        : defaults.segmentDecimals;
      nextPartial.segmentDecimals = sanitizeSegmentDecimals(
        partial.segmentDecimals,
        currentDecimals
      );
    }
    if (Object.prototype.hasOwnProperty.call(partial, 'measurementWithoutScale')) {
      const nextWithoutScale = !!partial.measurementWithoutScale;
      const previousWithoutScale = !!appState.settings.measurementWithoutScale;
      if (nextWithoutScale !== previousWithoutScale) {
        const currentLabelSource =
          Object.prototype.hasOwnProperty.call(nextPartial, 'unitLabel') && nextPartial.unitLabel != null
            ? nextPartial.unitLabel
            : appState.settings.unitLabel;
        const sanitizedCurrentLabel = sanitizeUnitLabel(currentLabelSource, currentLabelSource);
        if (previousWithoutScale) {
          rememberUnitLabel('withoutScale', sanitizedCurrentLabel);
        } else {
          rememberUnitLabel('withScale', sanitizedCurrentLabel);
        }
        const scaleContext = { ...appState.settings, ...nextPartial, measurementWithoutScale: nextWithoutScale };
        let updatedLabel = sanitizedCurrentLabel;
        if (nextWithoutScale) {
          const baseLabel = appState.unitLabelCache.withScale || sanitizedCurrentLabel;
          updatedLabel = computeUnitLabelForMode(baseLabel, scaleContext, 'withoutScale');
          rememberUnitLabel('withoutScale', updatedLabel);
        } else {
          let baseLabel = appState.unitLabelCache.withScale;
          if (!baseLabel) {
            baseLabel = computeUnitLabelForMode(sanitizedCurrentLabel, scaleContext, 'withScale');
          }
          updatedLabel = baseLabel || sanitizedCurrentLabel;
          rememberUnitLabel('withScale', updatedLabel);
        }
        nextPartial.unitLabel = updatedLabel;
        const desiredRequireScaleLabel = !nextWithoutScale;
        if (desiredRequireScaleLabel !== figurePickerRequiresScaleLabel) {
          refreshFigureLibrary(desiredRequireScaleLabel);
        }
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(partial, 'figureName') &&
      !Object.prototype.hasOwnProperty.call(partial, 'measurementTarget') &&
      appState.measurementTargetAuto
    ) {
      nextPartial.measurementTarget = buildDefaultMeasurementTarget(partial.figureName);
    }
    const merged = { ...appState.settings, ...nextPartial };
    const normalized = normalizeSettings(merged);
    const lengthUpdated =
      Object.prototype.hasOwnProperty.call(partial, 'tapeMeasureLength') &&
      isValidTapeMeasureLength(normalized.tapeMeasureLength) &&
      (!previousSettings ||
        !areTapeMeasureLengthsEqual(normalized.tapeMeasureLength, previousSettings.tapeMeasureLength));
    if (!areSettingsEqual(normalized, appState.settings)) {
      appState.settings = normalized;
      syncUnitLabelCache(appState.settings);
      applySettings(appState.settings);
      syncInputs(appState.settings);
      if (lengthUpdated) {
        persistTapeMeasureLength(normalized.tapeMeasureLength, {
          updateSettingsState: false,
          updateAppearance: false
        });
      }
    } else if (lengthUpdated) {
      persistTapeMeasureLength(normalized.tapeMeasureLength, {
        updateSettingsState: false,
        updateAppearance: false
      });
    }
  }

  function normalizeComparisonText(value) {
    if (typeof value !== 'string') {
      return '';
    }
    return value.replace(/[\s\u00A0]+/g, ' ').trim().toLowerCase();
  }

  function shouldUseAutoMeasurementTarget(settings) {
    if (!settings) {
      return false;
    }
    const normalizedValue = normalizeComparisonText(settings.measurementTarget);
    if (!normalizedValue) {
      return true;
    }
    const defaultFromFigure = normalizeComparisonText(buildDefaultMeasurementTarget(settings.figureName));
    if (normalizedValue === defaultFromFigure) {
      return true;
    }
    const fallbackDefault = normalizeComparisonText(defaults.measurementTarget);
    if (normalizedValue === fallbackDefault) {
      return true;
    }
    return false;
  }

  function createCleanState() {
    const normalizedSettings = normalizeSettings(appState.settings);
    const safeSettings = normalizedSettings
      ? typeof structuredClone === 'function'
        ? structuredClone(normalizedSettings)
        : JSON.parse(JSON.stringify(normalizedSettings))
      : null;

    return {
      v: 1,
      measurement: {
        settings: safeSettings || {}
      }
    };
  }

  function normalizeCleanStatePayload(payload) {
    if (payload == null) {
      return null;
    }
    let candidate = payload;
    if (typeof candidate === 'string') {
      try {
        candidate = JSON.parse(candidate);
      } catch (_) {
        return null;
      }
    }
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }
    if (candidate.measurement && typeof candidate.measurement === 'object') {
      candidate = candidate.measurement;
    }
    if (candidate.settings && typeof candidate.settings === 'object') {
      candidate = candidate.settings;
    }
    if (candidate.v != null && typeof candidate === 'object') {
      const { v: _version, ...rest } = candidate;
      candidate = rest;
    }
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }
    return candidate;
  }

  function loadCleanState(rawState) {
    const normalizedPayload = normalizeCleanStatePayload(rawState);
    if (!normalizedPayload) {
      return false;
    }

    const nextSettings = normalizeSettings(normalizedPayload);
    if (!nextSettings) {
      return false;
    }

    const activeToolKey = sanitizeActiveTool(nextSettings.activeTool, defaultActiveTool);
    const initialTransform = sanitizeRulerTransform(
      isTapeToolKey(activeToolKey) ? nextSettings.tapeMeasureTransform : nextSettings.rulerTransform,
      null
    );

    appState.activeTool = activeToolKey;
    appState.settings = nextSettings;
    appState.measurementTargetAuto = shouldUseAutoMeasurementTarget(nextSettings);
    initializeUnitLabelCache(nextSettings);

    suspendTransformPersistence = true;
    try {
      applySettings(nextSettings);
      syncInputs(nextSettings);
    } finally {
      suspendTransformPersistence = false;
    }

    if (initialTransform) {
      applyInstrumentTransform(initialTransform, { allowSnap: false, persist: false }, activeToolKey);
      persistActiveInstrumentState();
    } else {
      centerRuler();
    }

    return true;
  }

  function parseScaleRatio(label) {
    if (typeof label !== 'string') {
      return null;
    }
    const normalized = label.replace(/[\s\u00A0]+/g, '').replace(',', '.');
    const match = /^([0-9]+(?:\.[0-9]+)?)\:([0-9]+(?:\.[0-9]+)?)$/.exec(normalized);
    if (!match) {
      return null;
    }
    const drawingValue = Number.parseFloat(match[1]);
    const actualValue = Number.parseFloat(match[2]);
    if (!Number.isFinite(drawingValue) || drawingValue <= 0) {
      return null;
    }
    if (!Number.isFinite(actualValue) || actualValue <= 0) {
      return null;
    }
    return drawingValue / actualValue;
  }

  function normalizeUnitKey(value) {
    if (!value) {
      return '';
    }
    const trimmed = value.trim().toLowerCase();
    if (UNIT_TO_CENTIMETERS[trimmed] != null) {
      return trimmed;
    }
    if (UNIT_ALIASES[trimmed]) {
      return UNIT_ALIASES[trimmed];
    }
    return trimmed;
  }

  function resolveUnitLabelInfo(value) {
    const collapsed = collapseWhitespace(value);
    if (!collapsed) {
      return {
        label: '',
        quantity: 1,
        unitKey: '',
        baseFactor: null
      };
    }
    const quantityPattern = /^([0-9]+(?:[.,][0-9]+)?)\s*([A-Za-zÆØÅæøå]+)$/;
    const match = collapsed.match(quantityPattern);
    let quantity = 1;
    let unitToken = collapsed;
    if (match) {
      const parsed = Number.parseFloat(match[1].replace(',', '.'));
      if (Number.isFinite(parsed) && parsed > 0) {
        quantity = parsed;
      }
      unitToken = match[2];
    }
    const unitKey = normalizeUnitKey(unitToken);
    const baseFactor = unitKey && UNIT_TO_CENTIMETERS[unitKey] != null ? UNIT_TO_CENTIMETERS[unitKey] : null;
    return {
      label: collapsed,
      quantity,
      unitKey,
      baseFactor
    };
  }

  function resolveUnitSuffix(unitLabel) {
    const info = resolveUnitLabelInfo(unitLabel);
    if (info.unitKey && UNIT_TO_CENTIMETERS[info.unitKey] != null) {
      return info.unitKey;
    }
    return info.label;
  }

  function getUnitToCentimeterFactor(unitLabel) {
    const info = resolveUnitLabelInfo(unitLabel);
    if (info.baseFactor != null) {
      const quantity = Number.isFinite(info.quantity) && info.quantity > 0 ? info.quantity : 1;
      return info.baseFactor * quantity;
    }
    return UNIT_TO_CENTIMETERS[DEFAULT_UNIT_KEY];
  }

  function convertValueToDisplayUnits(value, unitLabel) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const info = resolveUnitLabelInfo(unitLabel);
    const baseFactor = info && typeof info.baseFactor === 'number' ? info.baseFactor : null;
    if (Number.isFinite(baseFactor) && baseFactor > 0) {
      return value / baseFactor;
    }
    return value;
  }

  function convertValueToCentimeters(rawValue, unitKey) {
    if (!rawValue || !unitKey) {
      return null;
    }
    const normalized = rawValue
      .replace(/[\s\u00A0\u202F]+/g, '')
      .replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    const multiplier = UNIT_TO_CENTIMETERS[unitKey];
    if (!multiplier) {
      return null;
    }
    return parsed * multiplier;
  }

  function parseScaleDenominator(value) {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.replace(/[\s\u00A0\u202F]+/g, '');
    const match = normalized.match(/([0-9]+(?:[.,][0-9]+)?)[:\/]([0-9]+(?:[.,][0-9]+)?)/);
    if (!match) {
      return null;
    }
    const leftRaw = match[1].replace(',', '.');
    const rightRaw = match[2].replace(',', '.');
    const left = Number.parseFloat(leftRaw);
    const right = Number.parseFloat(rightRaw);
    if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
      return null;
    }
    return right / left;
  }

  function resolveScaleInfo(settings) {
    const preset = resolvePresetFromSettings(settings);
    const presetScaleDenominatorRaw = parseScaleDenominator(
      preset && preset.scaleLabel ? preset.scaleLabel : ''
    );
    const presetDenominator =
      Number.isFinite(presetScaleDenominatorRaw) && presetScaleDenominatorRaw > 0
        ? presetScaleDenominatorRaw
        : 1;
    const desiredScaleDenominatorRaw = parseScaleDenominator(settings && settings.figureScaleLabel);
    const desiredDenominator =
      Number.isFinite(desiredScaleDenominatorRaw) && desiredScaleDenominatorRaw > 0
        ? desiredScaleDenominatorRaw
        : presetDenominator;
    return {
      presetDenominator,
      desiredDenominator
    };
  }

  function resolveRulerValueMultiplier(settings, scaleMetrics) {
    const metrics = scaleMetrics || resolveScaleMetrics(settings);
    if (!metrics) {
      return UNIT_TO_CENTIMETERS[DEFAULT_UNIT_KEY];
    }
    const displayMultiplier =
      Number.isFinite(metrics.displayMultiplier) && metrics.displayMultiplier > 0
        ? metrics.displayMultiplier
        : UNIT_TO_CENTIMETERS[DEFAULT_UNIT_KEY];
    return displayMultiplier;
  }

  function getEffectiveToolLength(settings, toolKey, scaleMetrics) {
    if (!settings) {
      return 0;
    }
    const metrics = scaleMetrics || resolveScaleMetrics(settings);
    if (isSegmentToolKey(toolKey)) {
      return getSegmentLengthInDisplayUnits(settings, metrics);
    }
    const multiplier = resolveRulerValueMultiplier(settings, metrics);
    const lengthValue =
      isTapeToolKey(toolKey)
        ? getVisibleTapeMeasureUnits(settings)
        : Number.isFinite(settings.length)
        ? settings.length
        : 0;
    const rawLength = lengthValue * multiplier;
    return convertValueToDisplayUnits(rawLength, settings.unitLabel);
  }

  function getEffectiveRulerLength(settings, scaleMetrics) {
    return getEffectiveToolLength(settings, 'ruler', scaleMetrics);
  }

  function getEffectiveActiveToolLength(settings, scaleMetrics) {
    const activeToolKey = sanitizeActiveTool(
      settings && settings.activeTool,
      appState.activeTool || defaultActiveTool
    );
    return getEffectiveToolLength(settings, activeToolKey, scaleMetrics);
  }

  function getVisibleTapeMeasureUnits(settings) {
    if (Number.isFinite(tapeLengthState.units)) {
      return tapeLengthState.units;
    }
    if (
      Number.isFinite(tapeLengthState.visiblePx) &&
      Number.isFinite(tapeLengthState.unitSpacing) &&
      tapeLengthState.unitSpacing > 0
    ) {
      return tapeLengthState.visiblePx / tapeLengthState.unitSpacing;
    }
    if (Number.isFinite(tapeLengthState.configuredUnits)) {
      return tapeLengthState.configuredUnits;
    }
    if (isTapeLengthInfinite(tapeLengthState.configuredUnits)) {
      return Number.isFinite(tapeLengthState.unitSpacing) && tapeLengthState.unitSpacing > 0
        ? Math.max(1, tapeLengthState.visiblePx / tapeLengthState.unitSpacing)
        : 1;
    }
    const config = resolveTapeMeasureLengthConfig(settings && settings.tapeMeasureLength);
    if (config.infinite) {
      return 1;
    }
    return config.units;
  }

  function getVisibleTapeMeasureLength(settings, scaleMetrics) {
    const metrics = scaleMetrics || resolveScaleMetrics(settings);
    const multiplier = resolveRulerValueMultiplier(settings, metrics);
    const visibleUnits = getVisibleTapeMeasureUnits(settings);
    const rawLength = visibleUnits * multiplier;
    return convertValueToDisplayUnits(rawLength, settings.unitLabel);
  }

  function extractRealWorldSizeFromText(text) {
    if (typeof text !== 'string') {
      return null;
    }
    const cleaned = text
      .replace(/[()_\[\]]/g, ' ')
      .replace(/[×x]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned) {
      return null;
    }
    const values = [];
    const pattern = /([0-9]+(?:[ \u00A0\u202F]?[0-9]{3})*(?:[.,][0-9]+)?)(?:\s*[-–]\s*([0-9]+(?:[ \u00A0\u202F]?[0-9]{3})*(?:[.,][0-9]+)?))?\s*(mm|cm|dm|m|km)\b/gi;
    let match;
    while ((match = pattern.exec(cleaned))) {
      const unitKey = normalizeUnitKey(match[3]);
      const first = convertValueToCentimeters(match[1], unitKey);
      if (first != null) {
        values.push(first);
      }
      if (match[2]) {
        const second = convertValueToCentimeters(match[2], unitKey);
        if (second != null) {
          values.push(second);
        }
      }
    }
    const filtered = values.filter(value => Number.isFinite(value) && value > 0);
    if (filtered.length === 0) {
      return null;
    }
    const primary = Math.max(...filtered);
    if (!Number.isFinite(primary) || primary <= 0) {
      return null;
    }
    return {
      primaryCm: primary,
      valuesCm: filtered
    };
  }

  function decodeFigureImageFileName(imagePath) {
    if (typeof imagePath !== 'string') {
      return '';
    }
    const lastSlash = imagePath.lastIndexOf('/');
    const fileName = lastSlash >= 0 ? imagePath.slice(lastSlash + 1) : imagePath;
    try {
      return decodeURI(fileName);
    } catch (error) {
      return fileName;
    }
  }

  function resolveRealWorldSizeInfo(settings) {
    if (!settings) {
      return null;
    }
    const summaryInfo = extractRealWorldSizeFromText(settings.figureSummary || '');
    if (summaryInfo) {
      return summaryInfo;
    }
    const preset = resolvePresetFromSettings(settings);
    if (preset && preset.realWorldSize && Number.isFinite(preset.realWorldSize.primaryCm)) {
      return preset.realWorldSize;
    }
    const imageFileName = decodeFigureImageFileName(settings.figureImage || '');
    if (imageFileName) {
      const fromImage = extractRealWorldSizeFromText(imageFileName);
      if (fromImage) {
        return fromImage;
      }
    }
    return null;
  }

  function resolveScaleMetrics(settings) {
    // Illustrasjonene er tegnet med 100 px per centimeter i tegningen. Ved å kombinere
    // dette med valgt måleenhet får vi pikselavstanden som linjalen skal bruke per enhet.
    const baseSpacing = DEFAULT_UNIT_SPACING_PX;
    const unitInfo = resolveUnitLabelInfo(settings ? settings.unitLabel : '');
    const unitQuantity = Number.isFinite(unitInfo.quantity) && unitInfo.quantity > 0 ? unitInfo.quantity : 1;
    const rawBaseFactor =
      unitInfo.baseFactor != null && Number.isFinite(unitInfo.baseFactor) && unitInfo.baseFactor > 0
        ? unitInfo.baseFactor
        : null;
    let spacingMultiplier = rawBaseFactor != null ? unitQuantity * rawBaseFactor : Number.NaN;
    if (!Number.isFinite(spacingMultiplier) || spacingMultiplier <= 0) {
      spacingMultiplier = UNIT_TO_CENTIMETERS[DEFAULT_UNIT_KEY];
    }

    const measurementWithoutScale = !!(settings && settings.measurementWithoutScale);
    let displayMultiplier = spacingMultiplier;

    if (measurementWithoutScale) {
      const sanitizedActiveLabel = sanitizeUnitLabel(
        settings && settings.unitLabel,
        settings && settings.unitLabel
      );
      const activeInfo = resolveUnitLabelInfo(sanitizedActiveLabel);
      const activeQuantity =
        Number.isFinite(activeInfo.quantity) && activeInfo.quantity > 0 ? activeInfo.quantity : 1;
      const activeBaseFactor =
        activeInfo.baseFactor != null && Number.isFinite(activeInfo.baseFactor) && activeInfo.baseFactor > 0
          ? activeInfo.baseFactor
          : null;
      const { desiredDenominator } = resolveScaleInfo(settings);
      const scaleMultiplier =
        Number.isFinite(desiredDenominator) && desiredDenominator > 0 ? desiredDenominator : 1;
      let realWorldMultiplier =
        activeBaseFactor != null ? activeQuantity * activeBaseFactor : Number.NaN;
      if (!Number.isFinite(realWorldMultiplier) || realWorldMultiplier <= 0) {
        const cachedWithScaleLabel =
          appState && appState.unitLabelCache && appState.unitLabelCache.withScale
            ? sanitizeUnitLabel(appState.unitLabelCache.withScale, appState.unitLabelCache.withScale)
            : '';
        const referenceInfo = resolveUnitLabelInfo(cachedWithScaleLabel);
        const referenceQuantity =
          Number.isFinite(referenceInfo.quantity) && referenceInfo.quantity > 0 ? referenceInfo.quantity : 1;
        const referenceBaseFactor =
          referenceInfo.baseFactor != null && Number.isFinite(referenceInfo.baseFactor) && referenceInfo.baseFactor > 0
            ? referenceInfo.baseFactor
            : null;
        if (referenceBaseFactor != null) {
          realWorldMultiplier = referenceQuantity * referenceBaseFactor;
        }
      }
      if (!Number.isFinite(realWorldMultiplier) || realWorldMultiplier <= 0) {
        realWorldMultiplier = displayMultiplier * scaleMultiplier;
      }
      if (!Number.isFinite(realWorldMultiplier) || realWorldMultiplier <= 0) {
        realWorldMultiplier = UNIT_TO_CENTIMETERS[DEFAULT_UNIT_KEY] * scaleMultiplier;
      }
      const spacingCandidate = realWorldMultiplier / scaleMultiplier;
      if (Number.isFinite(realWorldMultiplier) && realWorldMultiplier > 0) {
        displayMultiplier = realWorldMultiplier;
      }
      if (Number.isFinite(spacingCandidate) && spacingCandidate > 0) {
        spacingMultiplier = spacingCandidate;
      } else if (Number.isFinite(displayMultiplier) && displayMultiplier > 0) {
        spacingMultiplier = displayMultiplier;
      }
    }

    return {
      unitSpacing: baseSpacing * spacingMultiplier,
      baseSpacing,
      spacingMultiplier,
      displayMultiplier
    };
  }

  function getSegmentPointsInPx() {
    if (!hasSegment) {
      return null;
    }
    if (!boardRect || !Number.isFinite(boardRect.width) || !Number.isFinite(boardRect.height)) {
      boardRect = board.getBoundingClientRect();
    }
    const width =
      boardRect && Number.isFinite(boardRect.width) && boardRect.width > 0
        ? boardRect.width
        : BASE_BOARD_DIMENSIONS.width;
    const height =
      boardRect && Number.isFinite(boardRect.height) && boardRect.height > 0
        ? boardRect.height
        : BASE_BOARD_DIMENSIONS.height;
    return {
      width,
      height,
      a: { x: segmentState.a.x * width, y: segmentState.a.y * height },
      b: { x: segmentState.b.x * width, y: segmentState.b.y * height }
    };
  }

  function setSegmentPointNormalized(key, x, y) {
    if (!segmentState[key]) {
      return;
    }
    const nextX = Number.isFinite(x) ? x : segmentState[key].x;
    const nextY = Number.isFinite(y) ? y : segmentState[key].y;
    segmentState[key].x = Math.min(Math.max(nextX, 0), 1);
    segmentState[key].y = Math.min(Math.max(nextY, 0), 1);
  }

  function setSegmentPointFromPx(key, px, py) {
    if (!hasSegment) {
      return;
    }
    if (!boardRect || !Number.isFinite(boardRect.width) || !Number.isFinite(boardRect.height)) {
      boardRect = board.getBoundingClientRect();
    }
    const width =
      boardRect && Number.isFinite(boardRect.width) && boardRect.width > 0
        ? boardRect.width
        : BASE_BOARD_DIMENSIONS.width;
    const height =
      boardRect && Number.isFinite(boardRect.height) && boardRect.height > 0
        ? boardRect.height
        : BASE_BOARD_DIMENSIONS.height;
    if (!(width > 0) || !(height > 0)) {
      return;
    }
    const normalizedX = Math.min(Math.max(px / width, 0), 1);
    const normalizedY = Math.min(Math.max(py / height, 0), 1);
    setSegmentPointNormalized(key, normalizedX, normalizedY);
  }

  function getSegmentLengthInDisplayUnits(settings, metrics, distancePxOverride) {
    if (!hasSegment) {
      return 0;
    }
    const activeSettings = settings || appState.settings;
    if (!activeSettings) {
      return 0;
    }
    const scaleMetrics = metrics || resolveScaleMetrics(activeSettings);
    if (!scaleMetrics) {
      return 0;
    }
    const effectiveUnitSpacing = Number.isFinite(lastRenderedUnitSpacing) && lastRenderedUnitSpacing > 0
      ? lastRenderedUnitSpacing
      : scaleMetrics.unitSpacing;
    if (!Number.isFinite(effectiveUnitSpacing) || effectiveUnitSpacing <= 0) {
      return 0;
    }
    let distancePx = Number.isFinite(distancePxOverride) ? distancePxOverride : null;
    if (!Number.isFinite(distancePx)) {
      const points = getSegmentPointsInPx();
      if (!points) {
        return 0;
      }
      distancePx = Math.hypot(points.b.x - points.a.x, points.b.y - points.a.y);
    }
    if (!Number.isFinite(distancePx)) {
      return 0;
    }
    const units = distancePx / effectiveUnitSpacing;
    const multiplier = resolveRulerValueMultiplier(activeSettings, scaleMetrics);
    const rawLength = units * multiplier;
    return convertValueToDisplayUnits(rawLength, activeSettings.unitLabel);
  }

  function updateSegmentLabel(pointA, pointB, settings, metrics) {
    if (!segmentLabel) {
      return;
    }
    const activeSettings = settings || appState.settings || defaults;
    const scaleMetrics = metrics || resolveScaleMetrics(activeSettings);
    const distance = Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y);
    const lengthValue = getSegmentLengthInDisplayUnits(activeSettings, scaleMetrics, distance);
    const decimals = resolveSegmentDecimals(activeSettings);
    const roundedLength = roundForDisplay(lengthValue, decimals);
    const formatted = formatNumber(roundedLength);
    const unitSuffixValue = resolveUnitSuffix(activeSettings.unitLabel);
    const unitSuffix = unitSuffixValue ? ` ${unitSuffixValue}` : '';
    segmentLabel.textContent = `${formatted}${unitSuffix}`;
    const midX = (pointA.x + pointB.x) / 2;
    const midY = (pointA.y + pointB.y) / 2;
    const dx = pointB.x - pointA.x;
    const dy = pointB.y - pointA.y;
    const length = Math.hypot(dx, dy);
    let offsetX = 0;
    let offsetY = -SEGMENT_LABEL_OFFSET_PX;
    if (length > 0.0001) {
      const nx = dx / length;
      const ny = dy / length;
      offsetX = -ny * SEGMENT_LABEL_OFFSET_PX;
      offsetY = nx * SEGMENT_LABEL_OFFSET_PX;
    }
    let labelX = midX + offsetX;
    let labelY = midY + offsetY;
    if (boardRect && Number.isFinite(boardRect.width) && Number.isFinite(boardRect.height)) {
      labelX = Math.min(Math.max(labelX, 0), boardRect.width);
      labelY = Math.min(Math.max(labelY, 0), boardRect.height);
    }
    segmentLabel.style.left = `${labelX}px`;
    segmentLabel.style.top = `${labelY}px`;
  }

  function renderSegment(settings = appState.settings, metrics) {
    if (!hasSegment) {
      return;
    }
    const points = getSegmentPointsInPx();
    if (!points) {
      return;
    }
    const { width, height, a, b } = points;
    if (segmentSvg) {
      const safeWidth = Math.max(width, 1);
      const safeHeight = Math.max(height, 1);
      segmentSvg.setAttribute('viewBox', `0 0 ${safeWidth} ${safeHeight}`);
      segmentSvg.setAttribute('width', formatSvgNumber(safeWidth));
      segmentSvg.setAttribute('height', formatSvgNumber(safeHeight));
    }
    if (segmentLine) {
      segmentLine.setAttribute('x1', formatSvgNumber(a.x));
      segmentLine.setAttribute('y1', formatSvgNumber(a.y));
      segmentLine.setAttribute('x2', formatSvgNumber(b.x));
      segmentLine.setAttribute('y2', formatSvgNumber(b.y));
    }
    const isTapeBeta = appState.activeTool === TAPE_BETA_TOOL_KEY;
    const handleA = segmentHandlesByKey.get('a');
    if (handleA) {
      if (isTapeBeta) {
        const spec = TAPE_BETA_HANDLE_SPECS.a;
        const { anchorX, anchorY } = resolveTapeBetaAnchor(spec);
        handleA.style.left = `${a.x - anchorX}px`;
        handleA.style.top = `${a.y - anchorY}px`;
        handleA.style.transformOrigin = `${anchorX}px ${anchorY}px`;
      } else {
        handleA.style.left = `${a.x}px`;
        handleA.style.top = `${a.y}px`;
        handleA.style.transform = '';
        handleA.style.transformOrigin = '';
        handleA.style.width = '';
        handleA.style.height = '';
      }
    }
    const handleB = segmentHandlesByKey.get('b');
    if (handleB) {
      if (isTapeBeta) {
        const spec = TAPE_BETA_HANDLE_SPECS.b;
        const { anchorX, anchorY } = resolveTapeBetaAnchor(spec);
        handleB.style.left = `${b.x - anchorX}px`;
        handleB.style.top = `${b.y - anchorY}px`;
        handleB.style.transformOrigin = `${anchorX}px ${anchorY}px`;
      } else {
        handleB.style.left = `${b.x}px`;
        handleB.style.top = `${b.y}px`;
        handleB.style.transform = '';
        handleB.style.transformOrigin = '';
        handleB.style.width = '';
        handleB.style.height = '';
      }
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy);
    const rotation = Math.atan2(dy, dx);
    updateSegmentLabel(a, b, settings, metrics);
    if (isTapeBeta) {
      updateTapeBetaVisuals({ a, b, distance, rotation }, settings, metrics);
    } else {
      clearTapeBetaVisuals();
    }
  }

  function enforceSegmentDirectionLockForSettings(settings) {
    if (!hasSegment || !settings) {
      return;
    }
    const mode = resolveDirectionLockMode(settings);
    if (mode === 'none') {
      return;
    }
    const angle = resolveDirectionLockAngle(settings, mode);
    if (!Number.isFinite(angle)) {
      return;
    }
    applySegmentDirectionLock(angle);
  }

  function applySegmentDirectionLock(angle) {
    if (!hasSegment || !Number.isFinite(angle)) {
      return;
    }
    const points = getSegmentPointsInPx();
    if (!points) {
      return;
    }
    const dx = points.b.x - points.a.x;
    const dy = points.b.y - points.a.y;
    const length = Math.hypot(dx, dy);
    if (!(length > 0.0001)) {
      return;
    }
    const centerX = (points.a.x + points.b.x) / 2;
    const centerY = (points.a.y + points.b.y) / 2;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    if (!Number.isFinite(dirX) || !Number.isFinite(dirY)) {
      return;
    }
    const halfLength = length / 2;
    const newAx = centerX - dirX * halfLength;
    const newAy = centerY - dirY * halfLength;
    const newBx = centerX + dirX * halfLength;
    const newBy = centerY + dirY * halfLength;
    setSegmentPointFromPx('a', newAx, newAy);
    setSegmentPointFromPx('b', newBx, newBy);
    renderSegment(appState.settings, null);
  }

  function applySegmentAppearance(settings, scaleMetrics) {
    if (!hasSegment) {
      return;
    }
    const sanitized =
      sanitizeSegmentPoints(settings && settings.segmentPoints, defaults.segmentPoints) ||
      cloneSegmentPoints(defaults.segmentPoints);
    setSegmentPointNormalized('a', sanitized.a.x, sanitized.a.y);
    setSegmentPointNormalized('b', sanitized.b.x, sanitized.b.y);
    if (settings && (!settings.segmentPoints || !areSegmentPointsEqual(settings.segmentPoints, sanitized))) {
      settings.segmentPoints = cloneSegmentPoints(sanitized);
    }
    enforceSegmentDirectionLockForSettings(settings || appState.settings);
    renderSegment(settings, scaleMetrics);
  }

  function updateTapeBetaVisuals(geometry, settings, metrics) {
    if (!geometry || !tapeBetaStrapElement || !tapeBetaStrapSvg) {
      return;
    }
    const { a, b, distance, rotation } = geometry;
    if (!Number.isFinite(distance) || distance <= 0.5) {
      clearTapeBetaVisuals();
      return;
    }
    const activeSettings = settings || appState.settings || defaults;
    const scaleMetrics = metrics || resolveScaleMetrics(activeSettings);
    let unitSpacing = Number.isFinite(lastRenderedUnitSpacing) && lastRenderedUnitSpacing > 0
      ? lastRenderedUnitSpacing
      : scaleMetrics && Number.isFinite(scaleMetrics.unitSpacing) && scaleMetrics.unitSpacing > 0
      ? scaleMetrics.unitSpacing
      : DEFAULT_UNIT_SPACING_PX;
    if (!Number.isFinite(unitSpacing) || unitSpacing <= 0) {
      unitSpacing = DEFAULT_UNIT_SPACING_PX;
    }
    const strapHeight = TAPE_STRAP_DEFAULT_HEIGHT;
    const housingShift = resolveTapeHousingShiftPx();
    const strapData = buildTapeBetaStrapMarkup({
      distance,
      unitSpacing,
      housingShift,
      strapHeight,
      settings: activeSettings,
      metrics: scaleMetrics
    });
    if (!strapData) {
      clearTapeBetaVisuals();
      return;
    }

    tapeBetaStrapSvg.setAttribute('viewBox', `0 0 ${strapData.strapLength} ${strapData.strapHeight}`);
    tapeBetaStrapSvg.setAttribute('width', formatSvgNumber(strapData.strapLength));
    tapeBetaStrapSvg.setAttribute('height', formatSvgNumber(strapData.strapHeight));
    tapeBetaStrapSvg.innerHTML = strapData.markup;

    const strapAnchorY = strapData.strapHeight / 2;
    tapeBetaStrapElement.style.left = `${a.x}px`;
    tapeBetaStrapElement.style.top = `${a.y - strapAnchorY}px`;
    tapeBetaStrapElement.style.width = `${strapData.strapLength}px`;
    tapeBetaStrapElement.style.height = `${strapData.strapHeight}px`;
    tapeBetaStrapElement.style.transformOrigin = `0px ${strapAnchorY}px`;
    tapeBetaStrapElement.style.transform = `rotate(${rotation}rad)`;
    tapeBetaStrapElement.setAttribute('data-visible', 'true');

    updateTapeBetaHandle('a', a, rotation);
    updateTapeBetaHandle('b', b, rotation);
    updateTapeBetaHousing(b, rotation);

    tapeBetaVisualState = {
      pointA: { x: a.x, y: a.y },
      pointB: { x: b.x, y: b.y },
      rotation,
      strapHeight: strapData.strapHeight,
      strapLength: strapData.strapLength
    };
  }

  function updateTapeBetaHandle(handleKey, point, rotation) {
    const handle = segmentHandlesByKey.get(handleKey);
    const spec = TAPE_BETA_HANDLE_SPECS[handleKey];
    if (!handle || !spec || !point) {
      return;
    }
    const { anchorX, anchorY } = resolveTapeBetaAnchor(spec);
    handle.style.left = `${point.x - anchorX}px`;
    handle.style.top = `${point.y - anchorY}px`;
    if (Number.isFinite(spec.width)) {
      handle.style.width = `${spec.width}px`;
    }
    if (Number.isFinite(spec.height)) {
      handle.style.height = `${spec.height}px`;
    }
    handle.style.transformOrigin = `${anchorX}px ${anchorY}px`;
    handle.style.transform = `rotate(${rotation}rad)`;
  }

  function updateTapeBetaHousing(point, rotation) {
    if (!tapeBetaHousingImage) {
      return;
    }
    const spec = TAPE_BETA_HANDLE_SPECS.b;
    const { anchorX, anchorY } = resolveTapeBetaAnchor(spec);
    tapeBetaHousingImage.style.left = `${point.x - anchorX}px`;
    tapeBetaHousingImage.style.top = `${point.y - anchorY}px`;
    tapeBetaHousingImage.style.width = `${spec.width}px`;
    tapeBetaHousingImage.style.height = `${spec.height}px`;
    tapeBetaHousingImage.style.transformOrigin = `${anchorX}px ${anchorY}px`;
    tapeBetaHousingImage.style.transform = `rotate(${rotation}rad)`;
    tapeBetaHousingImage.setAttribute('data-visible', 'true');
  }

  function clearTapeBetaVisuals() {
    if (tapeBetaStrapElement) {
      tapeBetaStrapElement.removeAttribute('data-visible');
      tapeBetaStrapElement.style.transform = '';
      tapeBetaStrapElement.style.transformOrigin = '';
    }
    if (tapeBetaHousingImage) {
      tapeBetaHousingImage.removeAttribute('data-visible');
      tapeBetaHousingImage.style.transform = '';
      tapeBetaHousingImage.style.transformOrigin = '';
    }
    const handleA = segmentHandlesByKey.get('a');
    if (handleA) {
      handleA.style.transform = '';
      handleA.style.transformOrigin = '';
      handleA.style.width = '';
      handleA.style.height = '';
    }
    const handleB = segmentHandlesByKey.get('b');
    if (handleB) {
      handleB.style.transform = '';
      handleB.style.transformOrigin = '';
      handleB.style.width = '';
      handleB.style.height = '';
    }
    tapeBetaVisualState = null;
  }

  function ensureFigureImageDimensions(imageUrl) {
    if (!imageUrl || figureImageDimensions.has(imageUrl) || figureImageDimensionsPending.has(imageUrl)) {
      return;
    }
    figureImageDimensionsPending.add(imageUrl);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      figureImageDimensionsPending.delete(imageUrl);
      const width = img.naturalWidth || img.width || 0;
      const height = img.naturalHeight || img.height || 0;
      figureImageDimensions.set(imageUrl, width > 0 && height > 0 ? { width, height } : null);
      if (appState.settings && appState.settings.figureImage === imageUrl) {
        applyFigureScale(appState.settings, resolveScaleMetrics(appState.settings));
      }
    };
    img.onerror = () => {
      figureImageDimensionsPending.delete(imageUrl);
      figureImageDimensions.set(imageUrl, null);
    };
    img.src = imageUrl;
  }

  function computeFigureScale(settings, scaleMetrics, figureDimensions) {
    if (!settings || !scaleMetrics || !boardFigure || !figureDimensions) {
      return null;
    }

    const boardScale = getBoardScale(resolveBoardPaddingValue(settings));

    const baseSpacingPx = scaleMetrics && Number.isFinite(scaleMetrics.baseSpacing) && scaleMetrics.baseSpacing > 0
      ? scaleMetrics.baseSpacing
      : DEFAULT_UNIT_SPACING_PX;
    if (!Number.isFinite(baseSpacingPx) || baseSpacingPx <= 0) {
      return null;
    }

    const spacingMultiplierRaw =
      scaleMetrics && Number.isFinite(scaleMetrics.spacingMultiplier) && scaleMetrics.spacingMultiplier > 0
        ? scaleMetrics.spacingMultiplier
        : 1;
    let unitSpacingPx = baseSpacingPx * spacingMultiplierRaw;
    if (!Number.isFinite(unitSpacingPx) || unitSpacingPx <= 0) {
      return null;
    }

    const naturalWidth = figureDimensions.width;
    const naturalHeight = figureDimensions.height;
    if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth <= 0 || naturalHeight <= 0) {
      return null;
    }

    const { presetDenominator, desiredDenominator } = resolveScaleInfo(settings);
    const baseScaleDenominator = Number.isFinite(presetDenominator) && presetDenominator > 0
      ? presetDenominator
      : 1;
    const desiredScaleDenominator = Number.isFinite(desiredDenominator) && desiredDenominator > 0
      ? desiredDenominator
      : baseScaleDenominator;

    let width = null;
    let height = null;

    const scaleAdjustmentRaw = baseScaleDenominator / desiredScaleDenominator;
    const scaleAdjustment = Number.isFinite(scaleAdjustmentRaw) && scaleAdjustmentRaw > 0 ? scaleAdjustmentRaw : 1;
    width = naturalWidth * scaleAdjustment;
    height = naturalHeight * scaleAdjustment;

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    const hasBoardScale = Number.isFinite(boardScale) && boardScale > 0 && boardScale < 1;
    if (hasBoardScale) {
      width *= boardScale;
      height *= boardScale;
      unitSpacingPx *= boardScale;
    }

    return {
      width,
      height,
      unitSpacingPx
    };
  }

  function resolveFigureDimensions(imageUrl) {
    if (!imageUrl) {
      return null;
    }

    const cachedDimensions = figureImageDimensions.get(imageUrl);
    if (cachedDimensions === undefined) {
      ensureFigureImageDimensions(imageUrl);
      return null;
    }

    if (!cachedDimensions) {
      return null;
    }

    const { width, height } = cachedDimensions;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    return cachedDimensions;
  }

  function applyFigureScale(settings, scaleMetrics) {
    if (!boardFigure) {
      return;
    }

    const baseUnitSpacing = scaleMetrics && Number.isFinite(scaleMetrics.unitSpacing)
      ? scaleMetrics.unitSpacing
      : DEFAULT_UNIT_SPACING_PX;
    const imageUrl = settings && settings.figureImage ? settings.figureImage : '';
    const figureDimensions = resolveFigureDimensions(imageUrl);

    if (figureDimensions) {
      applyBoardAspectRatio();
      const scaleResult = computeFigureScale(settings, scaleMetrics, figureDimensions);

      if (scaleResult) {
        boardFigure.style.backgroundSize = `${scaleResult.width}px ${scaleResult.height}px`;
        const effectiveUnitSpacing = Number.isFinite(scaleResult.unitSpacingPx) && scaleResult.unitSpacingPx > 0
          ? scaleResult.unitSpacingPx
          : baseUnitSpacing;
        updateRuler(settings, effectiveUnitSpacing, scaleMetrics);
        return;
      }
    } else {
      applyBoardAspectRatio();
    }

    boardFigure.style.backgroundSize = '';
    updateRuler(settings, scaleValueForBoard(baseUnitSpacing, resolveBoardPaddingValue(settings)), scaleMetrics);
  }

  function applyBoardAspectRatio() {
    if (!board) {
      return;
    }

    boardRect = board.getBoundingClientRect();
  }

  function getBoardScale(padding = 0) {
    if (!board) {
      return 1;
    }

    const rect = boardRect && Number.isFinite(boardRect.width) && Number.isFinite(boardRect.height)
      ? boardRect
      : board.getBoundingClientRect();

    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return 1;
    }

    boardRect = rect;

    const safePadding = Number.isFinite(padding) ? Math.max(0, padding) : 0;
    const widthAvailable = Math.max(rect.width - safePadding * 2, 1);
    const heightAvailable = Math.max(rect.height - safePadding * 2, 1);

    const widthRatio = widthAvailable / BASE_BOARD_DIMENSIONS.width;
    const heightRatio = heightAvailable / BASE_BOARD_DIMENSIONS.height;
    const candidates = [widthRatio, heightRatio].filter(value => Number.isFinite(value) && value > 0);
    if (candidates.length === 0) {
      return 1;
    }

    const ratio = Math.min(...candidates);
    return ratio < 1 ? ratio : 1;
  }

  function scaleValueForBoard(value, padding = 0) {
    if (!Number.isFinite(value) || value <= 0) {
      return value;
    }

    const boardScale = getBoardScale(padding);
    if (!Number.isFinite(boardScale) || boardScale <= 0 || boardScale >= 1) {
      return value;
    }

    return value * boardScale;
  }

  function updateRuler(settings, unitSpacing, scaleMetrics) {
    if (!Number.isFinite(unitSpacing) || unitSpacing <= 0) {
      unitSpacing = DEFAULT_UNIT_SPACING_PX;
    }
    lastRenderedUnitSpacing = unitSpacing;
    const metrics = scaleMetrics || resolveScaleMetrics(settings);
    renderRuler(settings, unitSpacing, metrics);
    renderTapeMeasureStrap(settings, unitSpacing, metrics);
  }

  function applyTapeMeasureAppearance(settings, scaleMetrics, options = {}) {
    if (!tapeMeasure || !tapeStrap || !tapeStrapTrack) {
      return;
    }
    const { suppressTransformUpdate = false } = options || {};
    const metrics = scaleMetrics || resolveScaleMetrics(settings);
    let unitSpacing =
      Number.isFinite(lastRenderedUnitSpacing) && lastRenderedUnitSpacing > 0
        ? lastRenderedUnitSpacing
        : Number.NaN;
    if (!Number.isFinite(unitSpacing) || unitSpacing <= 0) {
      unitSpacing =
        metrics && Number.isFinite(metrics.unitSpacing) && metrics.unitSpacing > 0
          ? metrics.unitSpacing
          : DEFAULT_UNIT_SPACING_PX;
    }
    renderTapeMeasureStrap(settings, unitSpacing, metrics);
    const { infinite, units: configuredUnits } = resolveTapeMeasureLengthConfig(
      settings && settings.tapeMeasureLength
    );
    const activeUnits = infinite
      ? Math.max(
          1,
          Number.isFinite(tapeLengthState.units) && tapeLengthState.units > 0
            ? Math.ceil(tapeLengthState.units)
            : 1
        )
      : configuredUnits;
    const visibleLength = Math.max(0, unitSpacing * activeUnits);
    const strapHeight = getTapeStrapHeight();
    const strapTrackWidth = tapeStrapTrack ? tapeStrapTrack.offsetWidth : NaN;
    const strapElementWidth = tapeStrap ? tapeStrap.offsetWidth : NaN;
    const previousTotal = Number.isFinite(tapeLengthState.totalPx) ? tapeLengthState.totalPx : NaN;
    const fallbackWidth = Math.max(visibleLength, unitSpacing);
    let strapWidth = 0;
    if (Number.isFinite(previousTotal) && previousTotal > 0) {
      strapWidth = previousTotal;
    } else if (Number.isFinite(strapTrackWidth) && strapTrackWidth > 0) {
      strapWidth = strapTrackWidth;
    } else if (Number.isFinite(strapElementWidth) && strapElementWidth > 0) {
      strapWidth = strapElementWidth;
    } else {
      strapWidth = fallbackWidth;
    }
    const handleWidth = Math.max(
      TAPE_STRAP_HANDLE_MIN_PX,
      Number.isFinite(strapHeight) && strapHeight > 0 ? strapHeight * TAPE_STRAP_HANDLE_RATIO : 0
    );
    tapeLengthState.totalPx = strapWidth;
    tapeLengthState.unitSpacing = unitSpacing;
    tapeLengthState.configuredUnits = infinite ? TAPE_LENGTH_INFINITE : activeUnits;
    tapeLengthState.minVisiblePx = Math.max(0, Math.min(handleWidth, strapWidth));
    tapeLengthState.maxVisiblePx = strapWidth;
    const clampedVisible = Math.min(
      Math.max(visibleLength, tapeLengthState.minVisiblePx),
      strapWidth
    );
    tapeLengthState.visiblePx = clampedVisible;
    if (!suppressTransformUpdate) {
      applyTapeMeasureTransform();
    }
  }

  function applyActiveToolState(settings) {
    const sanitizedRulerTransform = sanitizeRulerTransform(
      settings && settings.rulerTransform,
      null
    );
    if (sanitizedRulerTransform) {
      Object.assign(transformStates.ruler, sanitizedRulerTransform);
    } else {
      transformStates.ruler.x = 0;
      transformStates.ruler.y = 0;
      transformStates.ruler.rotation = 0;
    }
    updateFreeRotationMemoryForTool('ruler');
    const sanitizedTapeTransform = sanitizeRulerTransform(
      settings && settings.tapeMeasureTransform,
      null
    );
    if (sanitizedTapeTransform) {
      Object.assign(transformStates[TAPE_BETA_TOOL_KEY], sanitizedTapeTransform);
    } else {
      transformStates[TAPE_BETA_TOOL_KEY].x = 0;
      transformStates[TAPE_BETA_TOOL_KEY].y = 0;
      transformStates[TAPE_BETA_TOOL_KEY].rotation = 0;
    }
    updateFreeRotationMemoryForTool(TAPE_BETA_TOOL_KEY);

    const previousTool = appState.activeTool;
    const desiredTool = sanitizeActiveTool(settings && settings.activeTool, previousTool);
    if (previousTool && previousTool !== desiredTool) {
      cancelAllPointerSessions();
    }
    appState.activeTool = desiredTool;
    if (isTapeToolKey(desiredTool)) {
      resetTapeMeasureLengthState();
      const configurationRequestsInfinity =
        (settings && isTapeLengthInfinite(settings.tapeMeasureLength)) ||
        (appState.settings && isTapeLengthInfinite(appState.settings.tapeMeasureLength));
      if (configurationRequestsInfinity) {
        if (settings && !isTapeLengthInfinite(settings.tapeMeasureLength)) {
          settings.tapeMeasureLength = TAPE_LENGTH_INFINITE;
        }
        if (appState.settings && !isTapeLengthInfinite(appState.settings.tapeMeasureLength)) {
          appState.settings = { ...appState.settings, tapeMeasureLength: TAPE_LENGTH_INFINITE };
        }
      }
    }
    transformState = transformStates[desiredTool] || transformStates[defaultActiveTool];
    updateLengthFieldVisibility(desiredTool);

    if (board) {
      board.setAttribute('data-active-tool', desiredTool);
    }
    if (ruler) {
      if (desiredTool === 'ruler') {
        ruler.hidden = false;
        ruler.removeAttribute('hidden');
        ruler.setAttribute('aria-hidden', 'false');
      } else {
        ruler.hidden = true;
        ruler.setAttribute('hidden', '');
        ruler.setAttribute('aria-hidden', 'true');
      }
    }
    if (tapeMeasure) {
      if (isTapeToolKey(desiredTool)) {
        tapeMeasure.hidden = false;
        tapeMeasure.removeAttribute('hidden');
        tapeMeasure.setAttribute('aria-hidden', 'false');
      } else {
        tapeMeasure.hidden = true;
        tapeMeasure.setAttribute('hidden', '');
        tapeMeasure.setAttribute('aria-hidden', 'true');
      }
    }

    if (segment) {
      const showSegment = isSegmentToolKey(desiredTool);
      if (showSegment) {
        segment.hidden = false;
        segment.removeAttribute('hidden');
        segment.setAttribute('aria-hidden', 'false');
      } else {
        segment.hidden = true;
        segment.setAttribute('hidden', '');
        segment.setAttribute('aria-hidden', 'true');
      }
      segment.classList.toggle('segment--tape-beta', desiredTool === TAPE_BETA_TOOL_KEY);
    }

    applyToolTransform('ruler');
    applyToolTransform('segment');
    applyToolTransform(TAPE_BETA_TOOL_KEY);
    if (isTapeToolKey(desiredTool)) {
      initializeTapeEndpointsFromDom();
    }
    updateBaseSize();
  }

  function updateLengthFieldVisibility(toolKey) {
    const showLength = !isSegmentToolKey(toolKey);
    if (lengthFieldContainer) {
      if (showLength) {
        lengthFieldContainer.hidden = false;
        lengthFieldContainer.removeAttribute('hidden');
        lengthFieldContainer.removeAttribute('aria-hidden');
        if (inputs.length) {
          inputs.length.disabled = false;
        }
      } else {
        lengthFieldContainer.hidden = true;
        lengthFieldContainer.setAttribute('hidden', '');
        lengthFieldContainer.setAttribute('aria-hidden', 'true');
        if (inputs.length) {
          inputs.length.disabled = true;
        }
      }
    }
    const showSegmentDecimals = isSegmentToolKey(toolKey);
    if (segmentDecimalsField) {
      if (showSegmentDecimals) {
        segmentDecimalsField.hidden = false;
        segmentDecimalsField.removeAttribute('hidden');
        segmentDecimalsField.removeAttribute('aria-hidden');
        if (inputs.segmentDecimals) {
          inputs.segmentDecimals.disabled = false;
        }
      } else {
        segmentDecimalsField.hidden = true;
        segmentDecimalsField.setAttribute('hidden', '');
        segmentDecimalsField.setAttribute('aria-hidden', 'true');
        if (inputs.segmentDecimals) {
          inputs.segmentDecimals.disabled = true;
        }
      }
    }
    if (measurementFieldGrid) {
      const visibleExtraFields = (showLength ? 1 : 0) + (showSegmentDecimals ? 1 : 0);
      const useThreeColumns = visibleExtraFields >= 1;
      measurementFieldGrid.classList.toggle('field-grid--three', useThreeColumns);
      measurementFieldGrid.classList.toggle('field-grid--two', !useThreeColumns);
    }
  }

  function applySettings(settings) {
    const scaleMetrics = resolveScaleMetrics(settings);
    applyFigureAppearance(settings);
    applyFigureScale(settings, scaleMetrics);
    applyGridAppearance(settings);
    applyBoardPanningState(settings);
    applyScaleLabel(settings);
    applyActiveToolState(settings);
    applyDirectionLockFromSettings(settings);
    applyTapeMeasureAppearance(settings, scaleMetrics);
    applySegmentAppearance(settings, scaleMetrics);
    updateAccessibility(settings);
    appState.measurementTargetAuto = shouldUseAutoMeasurementTarget(settings);
    updateBaseSize();
    applyTransformWithSnap({ allowSnap: settings.gridSnapEnabled, persist: true });
  }

  function applyFigureAppearance(settings) {
    const label = buildFigureLabel(settings);
    if (label) {
      board.setAttribute('data-figure-label', label);
    } else if (board.hasAttribute('data-figure-label')) {
      board.removeAttribute('data-figure-label');
    }
    if (boardFigure) {
      if (settings.figureImage) {
        boardFigure.style.backgroundImage = `url(${JSON.stringify(settings.figureImage)})`;
        ensureFigureImageDimensions(settings.figureImage);
      } else {
        boardFigure.style.backgroundImage = 'none';
      }
    }
  }

  function buildFigureLabel(settings) {
    if (!settings) {
      return '';
    }
    const figureName = collapseWhitespace(settings.figureName || '');
    const measurementText = buildMeasurementLabel(settings);
    const parts = [];
    if (figureName) {
      parts.push(figureName);
    }
    if (measurementText) {
      parts.push(measurementText);
    }
    return parts.join(' – ');
  }

  function buildMeasurementLabel(settings) {
    const preset = resolvePresetFromSettings(settings);
    const sourceText = collapseWhitespace(
      (preset && preset.dimensions) ||
        (() => {
          if (!settings.figureSummary) {
            return '';
          }
          const splitMatch = settings.figureSummary.split(/\s–\s/);
          return splitMatch[0] || settings.figureSummary;
        })()
    );
    if (!sourceText) {
      return '';
    }
    const factor = computeMeasurementScaleFactor(settings);
    const transformed = transformMeasurementText(sourceText, factor);
    if (!transformed) {
      return '';
    }
    if (!settings.measurementWithoutScale) {
      return `${transformed} (på tegningen)`;
    }
    return `${transformed} (i virkeligheten)`;
  }

  function computeMeasurementScaleFactor(settings) {
    if (!settings) {
      return 1;
    }
    if (settings.measurementWithoutScale) {
      return 1;
    }
    const { desiredDenominator } = resolveScaleInfo(settings);
    const denominator =
      Number.isFinite(desiredDenominator) && desiredDenominator > 0 ? desiredDenominator : 1;
    if (!Number.isFinite(denominator) || denominator <= 0) {
      return 1;
    }
    return 1 / denominator;
  }

  function transformMeasurementText(text, factor) {
    if (!text) {
      return '';
    }
    if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.000001) {
      return text;
    }
    const numberPattern = /([0-9]+(?:[ \u00A0\u202F]?[0-9]{3})*(?:[.,][0-9]+)?)/g;
    return text.replace(numberPattern, match => {
      const normalized = match.replace(/[ \u00A0\u202F]/g, '').replace(',', '.');
      const parsed = Number.parseFloat(normalized);
      if (!Number.isFinite(parsed)) {
        return match;
      }
      const scaled = roundForDisplay(parsed * factor);
      if (!Number.isFinite(scaled)) {
        return match;
      }
      return formatNumber(scaled);
    });
  }

  function applyGridAppearance(settings) {
    const enabled = !!(settings && settings.gridEnabled);
    const columns = sanitizeGridCount(settings && settings.gridColumns, defaults.gridColumns);
    const rows = sanitizeGridCount(settings && settings.gridRows, defaults.gridRows);
    if (board) {
      board.classList.toggle('board--grid', enabled);
    }
    if (boardGridOverlay) {
      boardGridOverlay.hidden = !enabled;
      boardGridOverlay.style.setProperty('--grid-columns', String(columns));
      boardGridOverlay.style.setProperty('--grid-rows', String(rows));
    }
  }

  function applyBoardPanningState(settings) {
    const enabled = !!(settings && settings.panningEnabled);
    boardPanState.enabled = enabled;
    if (!board) {
      return;
    }
    board.classList.toggle('board--pannable', enabled);
    if (enabled) {
      board.setAttribute('data-panning-enabled', 'true');
      const storedPan = sanitizeBoardPanTransform(
        settings && settings.boardPanTransform,
        defaults.boardPanTransform
      );
      boardPanTransform.x = storedPan.x;
      boardPanTransform.y = storedPan.y;
      applyBoardPanTransform();
    } else {
      board.removeAttribute('data-panning-enabled');
      resetBoardPanTransform({ persist: true });
      endBoardPanSession();
    }
  }

  function resetBoardPanTransform(options = {}) {
    boardPanTransform.x = 0;
    boardPanTransform.y = 0;
    applyBoardPanTransform();
    if (options.persist) {
      persistBoardPanState();
    }
  }

  function applyBoardPanTransform() {
    const x = Number.isFinite(boardPanTransform.x) ? boardPanTransform.x : 0;
    const y = Number.isFinite(boardPanTransform.y) ? boardPanTransform.y : 0;
    boardPanTransform.x = x;
    boardPanTransform.y = y;
    const translate = x === 0 && y === 0 ? '' : `translate3d(${x}px, ${y}px, 0)`;
    if (boardFigure) {
      boardFigure.style.transform = translate;
    }
    if (boardGridOverlay) {
      boardGridOverlay.style.transform = translate;
    }
    if (boardScaleLabel) {
      boardScaleLabel.style.transform = translate;
    }
  }

  function getBoardPanOffset(axis) {
    if (boardGridOverlay && boardGridOverlay.style) {
      const transform = boardGridOverlay.style.transform;
      if (typeof transform === 'string' && transform.length > 0) {
        const match = transform.match(/translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px/i);
        if (match) {
          const index = axis === 'y' ? 2 : 1;
          const parsed = Number.parseFloat(match[index]);
          if (Number.isFinite(parsed)) {
            return parsed;
          }
        }
      }
    }
    if (boardPanTransform && Number.isFinite(boardPanTransform[axis])) {
      return boardPanTransform[axis];
    }
    return 0;
  }

  function applyScaleLabel(settings) {
    if (!boardScaleLabel) {
      return;
    }
    if (!settings.showScaleLabel) {
      boardScaleLabel.textContent = '';
      boardScaleLabel.removeAttribute('data-visible');
      return;
    }
    const label = collapseWhitespace(settings.figureScaleLabel);
    const text = label ? `Målestokk ${label}` : 'Målestokk ikke angitt';
    boardScaleLabel.textContent = text;
    boardScaleLabel.setAttribute('data-visible', 'true');
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, char => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
  }

  function renderRuler(settings, unitSpacing, scaleMetrics) {
    if (!rulerSvg) {
      return;
    }

    const { length, subdivisions, unitLabel } = settings;
    const backgroundMode = RULER_BACKGROUND_MODE;
    const valueMultiplier = resolveRulerValueMultiplier(settings, scaleMetrics);
    const inset = 8;
    const effectiveLength = length;
    const startIndex = 0;
    const totalTicks = effectiveLength + 1;
    const paddingLeft = 0;
    const paddingRight = 0;
    const marginValue = backgroundMode === 'padded' ? 20 : 0;
    const marginLeft = marginValue;
    const marginRight = marginValue;
    const totalHeight = 120;
    const baselineY = inset + 26;
    const majorTickLength = (totalHeight - inset - 20 - baselineY) / 2;
    const majorTickBottom = baselineY + majorTickLength;
    const minorTickBottom = baselineY + majorTickLength * 0.58;
    const labelY = majorTickBottom + 24;
    const contentWidth = unitSpacing * effectiveLength + marginLeft + marginRight;

    const baselineStartX = marginLeft;
    const baselineEndX = baselineStartX + unitSpacing * effectiveLength;

    const majorTickMarkup = Array.from({ length: totalTicks }, (_, tickIndex) => {
      const x = marginLeft + unitSpacing * tickIndex;
      return `<line x1="${x}" y1="${baselineY}" x2="${x}" y2="${majorTickBottom}" class="ruler-svg__tick ruler-svg__tick--major" />`;
    }).join('');

    let minorTickMarkup = '';
    if (subdivisions > 1) {
      const step = unitSpacing / subdivisions;
      for (let unitIndex = 0; unitIndex < effectiveLength; unitIndex += 1) {
        const unitStart = marginLeft + unitSpacing * unitIndex;
        for (let subIndex = 1; subIndex < subdivisions; subIndex += 1) {
          const x = unitStart + step * subIndex;
          minorTickMarkup += `<line x1="${x}" y1="${baselineY}" x2="${x}" y2="${minorTickBottom}" class="ruler-svg__tick ruler-svg__tick--minor" />`;
        }
      }
    }

    const unitSuffixValue = resolveUnitSuffix(unitLabel);
    const unitSuffix = unitSuffixValue ? String(unitSuffixValue).trim() : '';
    const showUnitLabel = !!(settings && settings.showUnitLabel);

    const labelMarkup = Array.from({ length: totalTicks }, (_, tickIndex) => {
      const rawLabelValue = (startIndex + tickIndex) * valueMultiplier;
      const labelValue = roundForDisplay(convertValueToDisplayUnits(rawLabelValue, unitLabel));
      const x = marginLeft + unitSpacing * tickIndex;
      const baseLabelText = formatNumber(labelValue);
      const includeUnit = showUnitLabel && unitSuffix && tickIndex === 1;
      const labelWithUnit = includeUnit ? `${baseLabelText} ${unitSuffix}` : baseLabelText;
      const safeLabelText = escapeHtml(labelWithUnit);
      return `<text x="${x}" y="${labelY}" text-anchor="middle" class="ruler-svg__label">${safeLabelText}</text>`;
    }).join('');

    const unitLabelMarkup = unitSuffix && !showUnitLabel
      ? `<text x="${baselineEndX}" y="${baselineY - 16}" text-anchor="end" class="ruler-svg__unit-label">${escapeHtml(unitSuffix)}</text>`
      : '';

    const shadowFilterId = RULER_SHADOW_FILTER_ID;
    rulerSvg.setAttribute('viewBox', `0 0 ${contentWidth} ${totalHeight}`);
    rulerSvg.innerHTML = `
      <defs>
        <filter id="${shadowFilterId}" x="-20%" y="-20%" width="140%" height="180%">
          <feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="#0f172a" flood-opacity="0.25" />
        </filter>
      </defs>
      <rect x="0" y="${inset}" width="${contentWidth}" height="${totalHeight - inset * 2}" rx="18" ry="18" filter="url(#${shadowFilterId})" class="ruler-svg__background" data-export-background="true" />
      <line x1="${baselineStartX}" y1="${baselineY}" x2="${baselineEndX}" y2="${baselineY}" class="ruler-svg__baseline" />
      ${minorTickMarkup}
      ${majorTickMarkup}
      ${labelMarkup}
      ${unitLabelMarkup}
    `;

    const zeroOffsetX = marginLeft + paddingLeft + unitSpacing * (0 - startIndex);

    ruler.style.setProperty('--ruler-width', `${contentWidth}px`);
    ruler.style.setProperty('--ruler-height', `${totalHeight}px`);
    ruler.style.setProperty('--ruler-padding-left', `${paddingLeft}px`);
    ruler.style.setProperty('--ruler-padding-right', `${paddingRight}px`);
    ruler.style.setProperty('--zero-offset-x', `${zeroOffsetX}px`);
    ruler.style.setProperty('--zero-offset-y', `${baselineY}px`);
    ruler.setAttribute('data-ruler-background-mode', backgroundMode);
    ruler.setAttribute('data-ruler-value-multiplier', String(valueMultiplier));
    zeroOffset.x = zeroOffsetX;
    zeroOffset.y = baselineY;
  }

  function getTapeStrapHeight() {
    if (!tapeStrap) {
      return TAPE_STRAP_DEFAULT_HEIGHT;
    }
    const inlineHeight = Number.isFinite(tapeStrap.offsetHeight) ? tapeStrap.offsetHeight : NaN;
    if (Number.isFinite(inlineHeight) && inlineHeight > 0) {
      return inlineHeight;
    }
    if (!doc || !doc.defaultView || typeof doc.defaultView.getComputedStyle !== 'function') {
      return TAPE_STRAP_DEFAULT_HEIGHT;
    }
    const computed = Number.parseFloat(doc.defaultView.getComputedStyle(tapeStrap).height);
    if (Number.isFinite(computed) && computed > 0) {
      return computed;
    }
    return TAPE_STRAP_DEFAULT_HEIGHT;
  }

  function resolveTapeHousingShiftPx() {
    if (!doc) {
      return DEFAULT_TAPE_HOUSING_SHIFT_PX;
    }
    const view = doc.defaultView;
    if (!view || typeof view.getComputedStyle !== 'function') {
      return DEFAULT_TAPE_HOUSING_SHIFT_PX;
    }
    const target = tapeMeasure || doc.documentElement;
    if (!target) {
      return DEFAULT_TAPE_HOUSING_SHIFT_PX;
    }
    const rawValue = view.getComputedStyle(target).getPropertyValue(TAPE_HOUSING_SHIFT_VARIABLE);
    const parsed = Number.parseFloat(rawValue);
    return Number.isFinite(parsed) ? parsed : DEFAULT_TAPE_HOUSING_SHIFT_PX;
  }

  function buildTapeBetaStrapMarkup({
    distance,
    unitSpacing,
    housingShift,
    strapHeight: desiredHeight,
    settings,
    metrics
  }) {
    if (!Number.isFinite(unitSpacing) || unitSpacing <= 0) {
      return null;
    }
    const strapHeight = Number.isFinite(desiredHeight) && desiredHeight > 0
      ? desiredHeight
      : TAPE_STRAP_DEFAULT_HEIGHT;
    const strapEndScaleValue = strapHeight / TAPE_STRAP_DEFAULT_HEIGHT;
    const strapEndWidth = TAPE_STRAP_END_WIDTH * (Number.isFinite(strapEndScaleValue) ? strapEndScaleValue : 1);
    const overlap = Number.isFinite(housingShift) ? housingShift : DEFAULT_TAPE_HOUSING_SHIFT_PX;
    const strapLength = Math.max(distance + overlap, strapEndWidth);
    if (!(strapLength > 0)) {
      return null;
    }
    const strapBackgroundWidth = Math.max(strapLength, 0);
    const subdivisions = Number.isFinite(settings && settings.subdivisions)
      ? settings.subdivisions
      : defaults.subdivisions;
    const bandInset = Math.min(Math.max(strapHeight * 0.12, 6), strapHeight / 2.2);
    const topBaselineY = bandInset;
    const bottomBaselineY = strapHeight - bandInset;
    const labelPadding = Math.max(strapHeight * 0.12, 10);
    const tickLabelGap = Math.max(strapHeight * 0.18, 12);
    const labelY = bottomBaselineY - labelPadding;
    const majorTickBottom = labelY - tickLabelGap;
    const minorTickBottom = topBaselineY + (majorTickBottom - topBaselineY) * 0.65;
    const unitLabelY = topBaselineY + Math.max(10, (majorTickBottom - topBaselineY) * 0.5);

    const strapUnitsExact = unitSpacing > 0 ? distance / unitSpacing : 0;
    const fullUnits = Math.max(Math.floor(strapUnitsExact), 0);
    const clampedFullUnits = Math.min(fullUnits, 400);
    const remainder = distance - fullUnits * unitSpacing;
    const hasRemainder = remainder > 0.001;

    const valueMultiplier = resolveRulerValueMultiplier(settings, metrics);
    const unitSuffixValue = resolveUnitSuffix(settings.unitLabel);
    const unitSuffix = unitSuffixValue ? String(unitSuffixValue).trim() : '';
    const showUnitLabel = !!(settings && settings.showUnitLabel);

    let majorTickMarkup = '';
    for (let tickIndex = 0; tickIndex <= clampedFullUnits; tickIndex += 1) {
      const x = unitSpacing * tickIndex;
      majorTickMarkup += `<line x1="${formatSvgNumber(x)}" y1="${formatSvgNumber(topBaselineY)}" x2="${formatSvgNumber(x)}" y2="${formatSvgNumber(majorTickBottom)}" class="tape-svg__tick tape-svg__tick--major" />`;
    }
    if (hasRemainder) {
      const endX = distance;
      majorTickMarkup += `<line x1="${formatSvgNumber(endX)}" y1="${formatSvgNumber(topBaselineY)}" x2="${formatSvgNumber(endX)}" y2="${formatSvgNumber(majorTickBottom)}" class="tape-svg__tick tape-svg__tick--major" />`;
    }

    let minorTickMarkup = '';
    if (subdivisions > 1) {
      const step = unitSpacing / subdivisions;
      for (let unitIndex = 0; unitIndex < clampedFullUnits; unitIndex += 1) {
        const unitStart = unitSpacing * unitIndex;
        for (let subIndex = 1; subIndex < subdivisions; subIndex += 1) {
          const x = unitStart + step * subIndex;
          minorTickMarkup += `<line x1="${formatSvgNumber(x)}" y1="${formatSvgNumber(topBaselineY)}" x2="${formatSvgNumber(x)}" y2="${formatSvgNumber(minorTickBottom)}" class="tape-svg__tick tape-svg__tick--minor" />`;
        }
      }
      if (hasRemainder) {
        const unitStart = unitSpacing * fullUnits;
        for (let subIndex = 1; subIndex < subdivisions; subIndex += 1) {
          const x = unitStart + step * subIndex;
          if (x < distance - 0.001) {
            minorTickMarkup += `<line x1="${formatSvgNumber(x)}" y1="${formatSvgNumber(topBaselineY)}" x2="${formatSvgNumber(x)}" y2="${formatSvgNumber(minorTickBottom)}" class="tape-svg__tick tape-svg__tick--minor" />`;
          }
        }
      }
    }

    let labelMarkup = '';
    for (let tickIndex = 1; tickIndex <= clampedFullUnits; tickIndex += 1) {
      const rawValue = tickIndex * valueMultiplier;
      const labelValue = roundForDisplay(convertValueToDisplayUnits(rawValue, settings.unitLabel));
      const baseLabelText = formatNumber(labelValue);
      const includeUnit = showUnitLabel && unitSuffix && tickIndex === 1;
      const labelWithUnit = includeUnit ? `${baseLabelText} ${unitSuffix}` : baseLabelText;
      const safeLabelText = escapeHtml(labelWithUnit);
      const x = unitSpacing * tickIndex;
      const anchor = tickIndex === clampedFullUnits && !hasRemainder ? 'end' : 'middle';
      const dx = anchor === 'end' ? -6 : 0;
      labelMarkup += `<text x="${formatSvgNumber(x)}" y="${formatSvgNumber(labelY)}" text-anchor="${anchor}"${dx !== 0 ? ` dx="${dx}"` : ''} class="tape-svg__label">${safeLabelText}</text>`;
    }

    const unitLabelMarkup = unitSuffix && !showUnitLabel
      ? `<text x="${formatSvgNumber(Math.max(distance, unitSpacing))}" y="${formatSvgNumber(unitLabelY)}" text-anchor="end" class="tape-svg__unit-label">${escapeHtml(unitSuffix)}</text>`
      : '';

    const strapEndHrefRaw =
      TAPE_BETA_HANDLE_SPECS.a && TAPE_BETA_HANDLE_SPECS.a.href
        ? String(TAPE_BETA_HANDLE_SPECS.a.href)
        : '';
    const strapEndHrefValue =
      strapEndHrefRaw || '/images/measure/måleredskaper/målebåndSluttstykkeGult.svg';
    const strapEndHref = escapeHtml(strapEndHrefValue);
    const strapEndScaleAttribute = `transform="scale(${formatSvgNumber(strapEndScaleValue)})"`;
    const strapEndMarkup = `<image class="tape-svg__end-cap" ${strapEndScaleAttribute} href="${strapEndHref}" xlink:href="${strapEndHref}" width="${formatSvgNumber(TAPE_STRAP_END_WIDTH)}" height="${formatSvgNumber(TAPE_STRAP_DEFAULT_HEIGHT)}" />`;

    const markup = `
      <rect x="0" y="0" width="${formatSvgNumber(strapBackgroundWidth)}" height="${formatSvgNumber(strapHeight)}" class="tape-svg__background" />
      ${strapEndMarkup}
      <line x1="0" y1="${formatSvgNumber(topBaselineY)}" x2="${formatSvgNumber(strapLength)}" y2="${formatSvgNumber(topBaselineY)}" class="tape-svg__baseline" />
      <line x1="0" y1="${formatSvgNumber(bottomBaselineY)}" x2="${formatSvgNumber(strapLength)}" y2="${formatSvgNumber(bottomBaselineY)}" class="tape-svg__baseline" />
      ${minorTickMarkup}
      ${majorTickMarkup}
      ${labelMarkup}
      ${unitLabelMarkup}
    `;

    return {
      markup,
      strapLength,
      strapHeight,
      unitSpacing,
      distance
    };
  }

  function renderTapeMeasureStrap(settings, unitSpacing, scaleMetrics) {
    if (!tapeMeasure || !tapeStrapSvg) {
      return;
    }

    if (!Number.isFinite(unitSpacing) || unitSpacing <= 0) {
      unitSpacing = DEFAULT_UNIT_SPACING_PX;
    }
    lastRenderedUnitSpacing = unitSpacing;

    const previousTotalLength =
      Number.isFinite(tapeLengthState.totalPx) && tapeLengthState.totalPx > 0
        ? tapeLengthState.totalPx
        : Number.NaN;

    const metrics = scaleMetrics || resolveScaleMetrics(settings);
    const { infinite, units: configuredUnits } = resolveTapeMeasureLengthConfig(
      settings && settings.tapeMeasureLength
    );
    const activeUnits = infinite
      ? Math.max(
          1,
          Number.isFinite(tapeLengthState.units) && tapeLengthState.units > 0
            ? Math.ceil(tapeLengthState.units)
            : 1
        )
      : configuredUnits;
    const strapUnits = Math.max(1, activeUnits);
    const renderUnits = Math.max(1, Math.min(strapUnits, 400));
    const subdivisions = Number.isFinite(settings && settings.subdivisions)
      ? settings.subdivisions
      : defaults.subdivisions;
    const strapHeight = getTapeStrapHeight();
    const strapWidth = unitSpacing * strapUnits;
    const safeWidth = strapWidth > 0 ? strapWidth : unitSpacing;
    const tapeHousingShift = resolveTapeHousingShiftPx();
    const strapLengthWithOverlap = safeWidth + tapeHousingShift;
    const wasInfinite = isTapeLengthInfinite(tapeLengthState.configuredUnits);
    const strapLengthDelta =
      Number.isFinite(previousTotalLength) && Number.isFinite(strapLengthWithOverlap)
        ? strapLengthWithOverlap - previousTotalLength
        : 0;
    const skipAdjustForInfiniteTransition = infinite && !wasInfinite;
    const drasticShrinkToSingleUnit =
      strapUnits <= 1 &&
      Number.isFinite(previousTotalLength) &&
      Number.isFinite(strapLengthWithOverlap) &&
      Number.isFinite(unitSpacing) &&
      unitSpacing > 0 &&
      previousTotalLength - strapLengthWithOverlap > unitSpacing * 1.5;
    if (!skipAdjustForInfiniteTransition && !drasticShrinkToSingleUnit && Math.abs(strapLengthDelta) >= 0.001) {
      adjustTapeTransformForLengthChange(strapLengthDelta);
    }
    const strapEndScale = Number.isFinite(strapHeight) && strapHeight > 0 ? strapHeight / TAPE_STRAP_DEFAULT_HEIGHT : 1;
    const strapEndScaleValue = Number.isFinite(strapEndScale) && strapEndScale > 0 ? strapEndScale : 1;
    const strapEndWidth = TAPE_STRAP_END_WIDTH * strapEndScaleValue;
    if (tapeMeasure) {
      if (Number.isFinite(strapEndWidth) && strapEndWidth > 0) {
        tapeMeasure.style.setProperty('--tape-zero-handle-width', `${strapEndWidth}px`);
      } else {
        tapeMeasure.style.removeProperty('--tape-zero-handle-width');
      }
    }
    const strapBackgroundWidth = Math.max(strapLengthWithOverlap, 0);
    const bandInset = Math.min(Math.max(strapHeight * 0.12, 6), strapHeight / 2.2);
    const topBaselineY = bandInset;
    const bottomBaselineY = strapHeight - bandInset;
    const labelPadding = Math.max(strapHeight * 0.12, 10);
    const tickLabelGap = Math.max(strapHeight * 0.18, 12);
    const labelY = bottomBaselineY - labelPadding;
    const majorTickBottom = labelY - tickLabelGap;
    const minorTickBottom = topBaselineY + (majorTickBottom - topBaselineY) * 0.65;
    const unitLabelY = topBaselineY + Math.max(10, (majorTickBottom - topBaselineY) * 0.5);
    const valueMultiplier = resolveRulerValueMultiplier(settings, metrics);

    const totalTicks = Math.max(Math.round(renderUnits), 0) + 1;
    const majorTickMarkup = Array.from({ length: totalTicks }, (_, tickIndex) => {
      const x = unitSpacing * tickIndex;
      return `<line x1="${x}" y1="${topBaselineY}" x2="${x}" y2="${majorTickBottom}" class="tape-svg__tick tape-svg__tick--major" />`;
    }).join('');

    let minorTickMarkup = '';
    if (subdivisions > 1) {
      const step = unitSpacing / subdivisions;
      for (let unitIndex = 0; unitIndex < renderUnits; unitIndex += 1) {
        const unitStart = unitSpacing * unitIndex;
        for (let subIndex = 1; subIndex < subdivisions; subIndex += 1) {
          const x = unitStart + step * subIndex;
          minorTickMarkup += `<line x1="${x}" y1="${topBaselineY}" x2="${x}" y2="${minorTickBottom}" class="tape-svg__tick tape-svg__tick--minor" />`;
        }
      }
    }

    const unitSuffixValue = resolveUnitSuffix(settings.unitLabel);
    const unitSuffix = unitSuffixValue ? String(unitSuffixValue).trim() : '';
    const showUnitLabel = !!(settings && settings.showUnitLabel);

    const labelMarkup = Array.from({ length: totalTicks }, (_, tickIndex) => {
      if (tickIndex === 0) {
        return '';
      }
      const rawValue = tickIndex * valueMultiplier;
      const labelValue = roundForDisplay(convertValueToDisplayUnits(rawValue, settings.unitLabel));
      const anchor = tickIndex === totalTicks - 1 ? 'end' : 'middle';
      const dx = anchor === 'end' ? -6 : 0;
      const x = unitSpacing * tickIndex;
      const baseLabelText = formatNumber(labelValue);
      const includeUnit = showUnitLabel && unitSuffix && tickIndex === 1;
      const labelWithUnit = includeUnit ? `${baseLabelText} ${unitSuffix}` : baseLabelText;
      const safeLabelText = escapeHtml(labelWithUnit);
      return `<text x="${x}" y="${labelY}" text-anchor="${anchor}"${dx !== 0 ? ` dx="${dx}"` : ''} class="tape-svg__label">${safeLabelText}</text>`;
    }).join('');

    const subdivisionStep = subdivisions > 0 ? unitSpacing / subdivisions : 0;
    const unitLabelMarkup = unitSuffix && !showUnitLabel
      ? `<text x="${safeWidth}" y="${unitLabelY}" text-anchor="end" class="tape-svg__unit-label">${escapeHtml(unitSuffix)}</text>`
      : '';

    const strapEndHrefRaw =
      TAPE_BETA_HANDLE_SPECS.a && TAPE_BETA_HANDLE_SPECS.a.href
        ? String(TAPE_BETA_HANDLE_SPECS.a.href)
        : '';
    const strapEndHref = strapEndHrefRaw ? escapeHtml(strapEndHrefRaw) : '';
    const strapEndScaleAttribute = `transform="scale(${formatSvgNumber(strapEndScaleValue)})"`;
    const strapEndMarkup = strapEndHref
      ? `<image class="tape-svg__end-cap" ${strapEndScaleAttribute} href="${strapEndHref}" xlink:href="${strapEndHref}" width="${formatSvgNumber(TAPE_STRAP_END_WIDTH)}" height="${formatSvgNumber(TAPE_STRAP_DEFAULT_HEIGHT)}" />`
      : `<g class="tape-svg__end-cap" ${strapEndScaleAttribute}>
        <path d="M0.6875 39.9463L1.66457 23.2943L0.6875 6.72093L1.47297 6.7916C1.53337 6.79694 1.84017 6.82629 2.34324 6.91029V39.7569C1.84017 39.8409 1.53337 39.8716 1.47297 39.8756L0.6875 39.9463Z" fill="#EBEBEB" />
        <path d="M2.34375 39.7568V6.91019C3.17348 7.05019 4.53908 7.34084 6.22348 7.92084L7.58335 8.42884C10.3751 9.55284 13.7761 11.4315 17.0256 14.5568H35.0636C37.6885 14.5568 39.8245 16.6782 39.8245 19.2848V27.3809C39.8245 29.9875 37.6885 32.1102 35.0636 32.1102H17.0256C13.7761 35.2355 10.3751 37.1142 7.58335 38.2382L6.22348 38.7462C4.53908 39.3262 3.17348 39.6155 2.34375 39.7568Z" fill="#EAD32A" />
        <path d="M1.41406 7.46953L2.34473 23.3349L1.41406 39.2002C1.41406 39.2002 9.55833 38.4762 16.7505 31.4309H35.0651C37.3171 31.4309 39.1453 29.6175 39.1453 27.3815V23.3349C39.1453 23.3349 39.1453 21.5229 39.1453 19.2869C39.1453 17.0509 37.3171 15.2375 35.0651 15.2375H16.7505C9.55833 8.19353 1.41406 7.46953 1.41406 7.46953Z" fill="#ACACAC" />
        <path d="M2.32913 23.5975L1.41406 39.2002C1.41406 39.2002 9.55833 38.4762 16.7505 31.4309H35.0651C37.3171 31.4309 39.1453 29.6175 39.1453 27.3815V23.5975H2.32913Z" fill="#D2D1D9" />
        <path d="M33.3827 23.3355C33.3827 25.4369 31.6771 27.1436 29.5739 27.1436C27.4714 27.1436 25.7656 25.4369 25.7656 23.3355C25.7656 21.2329 27.4714 19.5275 29.5739 19.5275C31.6771 19.5275 33.3827 21.2329 33.3827 23.3355Z" fill="#CCCCCC" />
        <path d="M31.4742 20.0529C31.7992 20.6142 31.9992 21.2569 31.9992 21.9502C31.9992 24.0542 30.2946 25.7595 28.1919 25.7595C27.4966 25.7595 26.8544 25.5595 26.293 25.2342C26.9512 26.3702 28.167 27.1436 29.5752 27.1436C31.6784 27.1436 33.384 25.4369 33.384 23.3355C33.384 21.9275 32.6107 20.7129 31.4742 20.0529Z" fill="#787878" />
        <path d="M29.8856 21.9031C29.8856 22.7511 29.1981 23.4404 28.3487 23.4404C27.4987 23.4404 26.8105 22.7511 26.8105 21.9031C26.8105 21.0538 27.4987 20.3658 28.3487 20.3658C29.1981 20.3658 29.8856 21.0538 29.8856 21.9031Z" fill="#FAFAFA" />
        <path d="M15.6351 23.3355C15.6351 25.4369 13.931 27.1436 11.8269 27.1436C9.72367 27.1436 8.01953 25.4369 8.01953 23.3355C8.01953 21.2329 9.72367 19.5275 11.8269 19.5275C13.931 19.5275 15.6351 21.2329 15.6351 23.3355Z" fill="#CCCCCC" />
        <path d="M12.1291 21.9031C12.1291 22.7511 11.4416 23.4404 10.5922 23.4404C9.74269 23.4404 9.05469 22.7511 9.05469 21.9031C9.05469 21.0538 9.74269 20.3658 10.5922 20.3658C11.4416 20.3658 12.1291 21.0538 12.1291 21.9031Z" fill="#FAFAFA" />
        <path d="M13.7658 20.0529C14.0902 20.6142 14.2903 21.2569 14.2903 21.9502C14.2903 24.0542 12.5861 25.7595 10.482 25.7595C9.78718 25.7595 9.14438 25.5595 8.58398 25.2342C9.24292 26.3702 10.4585 27.1436 11.8662 27.1436C13.9694 27.1436 15.6736 25.4369 15.6736 23.3355C15.6736 21.9275 14.9017 20.7129 13.7658 20.0529Z" fill="#787878" />
        <path d="M0.482422 46.667H2.34442V0.000328302H0.482422V46.667Z" fill="#ACACAC" />
        <path d="M0 46.667H0.482265V0.000328302H0V46.667Z" fill="#D2D1D9" />
      </g>`;

    tapeStrapSvg.setAttribute('viewBox', `0 0 ${strapLengthWithOverlap} ${strapHeight}`);
    tapeStrapSvg.setAttribute('width', formatSvgNumber(strapLengthWithOverlap));
    tapeStrapSvg.setAttribute('height', formatSvgNumber(strapHeight));
    tapeStrapSvg.innerHTML = `
      <rect x="0" y="0" width="${formatSvgNumber(strapBackgroundWidth)}" height="${strapHeight}" class="tape-svg__background" />
      ${strapEndMarkup}
      <line x1="0" y1="${topBaselineY}" x2="${strapLengthWithOverlap}" y2="${topBaselineY}" class="tape-svg__baseline" />
      <line x1="0" y1="${bottomBaselineY}" x2="${strapLengthWithOverlap}" y2="${bottomBaselineY}" class="tape-svg__baseline" />
      ${minorTickMarkup}
      ${majorTickMarkup}
      ${labelMarkup}
      ${unitLabelMarkup}
    `;

    tapeMeasure.style.setProperty('--tape-strap-length', `${strapLengthWithOverlap}px`);
    tapeMeasure.style.setProperty('--tape-strap-overlap', `${tapeHousingShift}px`);
    tapeMeasure.style.setProperty('--tape-strap-start-offset', `${subdivisionStep}px`);
    tapeLengthState.totalPx = strapLengthWithOverlap;
    tapeLengthState.maxVisiblePx = safeWidth;
  }

  function updateAccessibility(settings) {
    const { unitLabel } = settings;
    const activeToolKey = sanitizeActiveTool(settings && settings.activeTool, appState.activeTool);
    const info = getToolDisplayInfo(activeToolKey);
    const effectiveLengthRaw = isTapeToolKey(activeToolKey)
      ? getVisibleTapeMeasureLength(settings)
      : getEffectiveToolLength(settings, activeToolKey);
    const effectiveLength = roundForDisplay(effectiveLengthRaw);
    const formattedLength = formatNumber(effectiveLength);
    const unitSuffixValue = resolveUnitSuffix(unitLabel);
    const unitSuffix = unitSuffixValue ? ` ${unitSuffixValue}` : '';
    const toolElements = [
      { keys: ['ruler'], element: hasRuler ? ruler : null },
      { keys: ['segment', TAPE_BETA_TOOL_KEY], element: hasSegment ? segment : null }
    ];
    for (const entry of toolElements) {
      if (!entry.element) {
        continue;
      }
      const isActive = entry.keys.includes(activeToolKey);
      if (isActive) {
        const labelParts = [`Flyttbart ${info.label}`];
        if (isTapeToolKey(activeToolKey)) {
          const visibleUnitsRaw = tapeMeasure
            ? Number.parseFloat(tapeMeasure.getAttribute('data-visible-length'))
            : NaN;
          let strapPart = `Synlig rem: ${formattedLength}${unitSuffix}`;
          if (Number.isFinite(visibleUnitsRaw)) {
            const visibleUnits = roundForDisplay(visibleUnitsRaw);
            const visibleUnitsLabel = formatNumber(visibleUnits);
            strapPart += ` (${visibleUnitsLabel} enheter)`;
          }
          labelParts.push(strapPart);
        } else {
          labelParts.push(`Lengde: ${formattedLength}${unitSuffix}`);
        }
        entry.element.setAttribute('aria-label', labelParts.join('. '));
        entry.element.setAttribute('aria-hidden', 'false');
        entry.element.setAttribute('tabindex', '0');
      } else {
        entry.element.setAttribute('aria-hidden', 'true');
        entry.element.setAttribute('tabindex', '-1');
      }
    }
    if (statusNote) {
      const noteParts = [];
      if (figureLibraryErrorMessage) {
        noteParts.push(figureLibraryErrorMessage);
      }
      if (storageWarningMessage) {
        noteParts.push(storageWarningMessage);
      }
      const statusMessage = buildStatusMessage(settings);
      if (statusMessage) {
        noteParts.push(statusMessage);
      }
      statusNote.textContent = noteParts.join(noteParts.length > 1 ? '\n\n' : '');
    }
  }

  function normalizeStorageModeValue(value) {
    if (typeof value !== 'string') {
      return '';
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return '';
    }
    if (normalized === 'kv' || normalized === 'vercel-kv') {
      return 'kv';
    }
    if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') {
      return 'memory';
    }
    return normalized;
  }

  function resolveStorageWarningMessage(metadata) {
    const source = metadata && typeof metadata === 'object' ? metadata : {};
    const mode = normalizeStorageModeValue(source.storageMode || source.mode || source.storage);
    const limitation = typeof source.limitation === 'string' ? source.limitation.trim() : '';
    if (limitation) {
      return limitation;
    }
    const persistent = source.persistent === true;
    const ephemeral = source.ephemeral === true;
    if (persistent || mode === 'kv') {
      return '';
    }
    if (ephemeral || mode === 'memory' || !mode) {
      return 'Figurbiblioteket bruker midlertidig lagring. Endringer kan gå tapt ved omstart.';
    }
    return '';
  }

  function buildStatusMessage(settings) {
    const activeToolKey = sanitizeActiveTool(settings && settings.activeTool, appState.activeTool);
    const info = getToolDisplayInfo(activeToolKey);
    const effectiveLengthRaw = isTapeToolKey(activeToolKey)
      ? getVisibleTapeMeasureLength(settings)
      : getEffectiveToolLength(settings, activeToolKey);
    const effectiveLength = roundForDisplay(effectiveLengthRaw);
    const formattedLength = formatNumber(effectiveLength);
    const unitSuffixValue = resolveUnitSuffix(settings.unitLabel);
    const unitSuffix = unitSuffixValue ? ` ${unitSuffixValue}` : '';
    const target = collapseWhitespace(settings.measurementTarget || buildDefaultMeasurementTarget(settings.figureName));
    if (!target) {
      return '';
    }
    if (isTapeToolKey(activeToolKey)) {
      const visibleUnitsRaw = tapeMeasure
        ? Number.parseFloat(tapeMeasure.getAttribute('data-visible-length'))
        : NaN;
      const parts = [`${info.possessive} synlige rem er ${formattedLength}${unitSuffix}`];
      if (Number.isFinite(visibleUnitsRaw)) {
        const visibleUnits = roundForDisplay(visibleUnitsRaw);
        parts[0] += ` (${formatNumber(visibleUnits)} enheter)`;
      }
      parts.push(`Bruk den til å finne ${target}.`);
      return parts.join('. ');
    }
    return `${info.possessive} lengde er ${formattedLength}${unitSuffix}. Bruk den til å finne ${target}.`;
  }

  function roundForDisplay(value, decimals = 6) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    const factor = Math.pow(10, Math.max(0, decimals));
    return Math.round(value * factor) / factor;
  }

  function formatNumber(value) {
    if (numberFormatter) {
      return numberFormatter.format(value);
    }
    return String(value);
  }

  function formatAngleForDisplay(angle) {
    if (!Number.isFinite(angle)) {
      return '';
    }
    let degrees = (normalizeAngle(angle) * 180) / Math.PI;
    if (degrees < 0) {
      degrees += 360;
    }
    const difference = Math.abs(Math.round(degrees) - degrees);
    const decimals = difference <= 0.01 ? 0 : 1;
    const rounded = roundForDisplay(degrees, decimals);
    return `${formatNumber(rounded)}°`;
  }

  function rotatePoint(point, angle) {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    return {
      x: point.x * cos - point.y * sin,
      y: point.x * sin + point.y * cos
    };
  }

  function rotatePointInverse(point, angle) {
    return rotatePoint(point, -angle);
  }

  function getRectCenter(rect) {
    if (!rect) {
      return { x: 0, y: 0 };
    }
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function normalizeVector(vector) {
    if (!vector) {
      return { x: 0, y: 0 };
    }
    const length = Math.hypot(vector.x, vector.y);
    if (!Number.isFinite(length) || length === 0) {
      return { x: 0, y: 0 };
    }
    return {
      x: vector.x / length,
      y: vector.y / length
    };
  }

  function syncInputs(settings) {
    appState.syncingInputs = true;
    try {
      updateFigureSelectorsFromSettings(settings);
      if (inputs.figureName) inputs.figureName.value = settings.figureName || '';
      if (inputs.figureImage) inputs.figureImage.value = settings.figureImage || '';
      if (inputs.figureSummary) inputs.figureSummary.value = settings.figureSummary || '';
      if (inputs.figureScaleLabel) inputs.figureScaleLabel.value = settings.figureScaleLabel || '';
      const activeToolKey = sanitizeActiveTool(settings && settings.activeTool, appState.activeTool);
      const activeLength = isTapeToolKey(activeToolKey)
        ? settings.tapeMeasureLength
        : settings.length;
      if (inputs.length) {
        if (isTapeToolKey(activeToolKey) && isTapeLengthInfinite(activeLength)) {
          inputs.length.value = TAPE_LENGTH_INFINITY_SYMBOL;
        } else {
          inputs.length.value = activeLength;
        }
      }
      if (inputs.subdivisions) inputs.subdivisions.value = settings.subdivisions;
      if (inputs.segmentDecimals) {
        inputs.segmentDecimals.value = resolveSegmentDecimals(settings);
      }
      if (inputs.unitLabel) inputs.unitLabel.value = settings.unitLabel || '';
      if (inputs.boardPadding) inputs.boardPadding.value = settings.boardPadding;
      if (inputs.gridEnabled) inputs.gridEnabled.checked = !!settings.gridEnabled;
      if (inputs.gridSnapEnabled) inputs.gridSnapEnabled.checked = !!settings.gridSnapEnabled;
      if (inputs.gridColumns) inputs.gridColumns.value = settings.gridColumns;
      if (inputs.gridRows) inputs.gridRows.value = settings.gridRows;
      if (inputs.showScaleLabel) inputs.showScaleLabel.checked = !!settings.showScaleLabel;
      if (inputs.showUnitLabel) inputs.showUnitLabel.checked = !!settings.showUnitLabel;
      if (inputs.measurementWithoutScale) {
        inputs.measurementWithoutScale.checked = !!settings.measurementWithoutScale;
      }
      if (inputs.panningEnabled) inputs.panningEnabled.checked = !!settings.panningEnabled;
      if (inputs.measurementTool) {
        inputs.measurementTool.value = activeToolKey;
      }
      updateMeasurementDirectionInputs(settings);
      updateLengthFieldVisibility(activeToolKey);
      // unit spacing is fixed and no longer exposed to the UI
    } finally {
      appState.syncingInputs = false;
    }
  }

  function updateMeasurementDirectionInputs(settings) {
    const lockSelect = inputs.measurementDirectionLock;
    const setAngleButton = inputs.measurementDirectionAngleButton;
    const mode = resolveDirectionLockMode(settings);
    if (lockSelect) {
      lockSelect.value = mode;
    }
    if (setAngleButton) {
      const angle = resolveDirectionLockAngle(settings, mode);
      const hasAngle = mode === 'angle' && Number.isFinite(angle);
      const baseLabel = 'Sett vinkel';
      if (hasAngle) {
        const formatted = formatAngleForDisplay(angle);
        setAngleButton.textContent = formatted ? `${baseLabel} (${formatted})` : baseLabel;
      } else {
        setAngleButton.textContent = baseLabel;
      }
    }
  }

  function attachInputListeners() {
    if (inputs.figureCategory) {
      inputs.figureCategory.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        if (event && event.isTrusted === false) return;
        const categoryId = event.target.value;
        const { selectedId } = figurePicker.renderCategorySelect(inputs.figureCategory, categoryId);
        if (inputs.figurePreset) {
          const { options } = figurePicker.renderFigureSelect(inputs.figurePreset, selectedId, null, {
            disableWhenEmpty: false
          });
          const first = options[0];
          if (first && first.figure && !first.figure.custom) {
            applyFigurePreset(first.figure.id);
          }
        }
      });
    }
    if (inputs.figurePreset) {
      inputs.figurePreset.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        if (event && event.isTrusted === false) return;
        applyFigurePreset(event.target.value);
      });
    }
    if (inputs.figureName) {
      inputs.figureName.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ figureName: event.target.value });
      });
    }
    if (inputs.figureImage) {
      inputs.figureImage.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ figureImage: event.target.value });
      });
    }
    if (inputs.figureSummary) {
      inputs.figureSummary.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ figureSummary: event.target.value });
      });
    }
    if (inputs.figureScaleLabel) {
      inputs.figureScaleLabel.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ figureScaleLabel: event.target.value });
      });
    }
    if (inputs.length) {
      inputs.length.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        const activeToolKey = sanitizeActiveTool(
          appState.settings && appState.settings.activeTool,
          appState.activeTool
        );
        const payloadKey = isTapeToolKey(activeToolKey) ? 'tapeMeasureLength' : 'length';
        updateSettings({ [payloadKey]: event.target.value });
      });
    }
    if (inputs.subdivisions) {
      inputs.subdivisions.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ subdivisions: event.target.value });
      });
    }
    if (inputs.segmentDecimals) {
      inputs.segmentDecimals.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ segmentDecimals: event.target.value });
      });
    }
    if (inputs.unitLabel) {
      inputs.unitLabel.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ unitLabel: event.target.value });
      });
    }
    if (inputs.boardPadding) {
      inputs.boardPadding.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ boardPadding: event.target.value });
      });
    }
    if (inputs.gridEnabled) {
      inputs.gridEnabled.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ gridEnabled: event.target.checked });
      });
    }
    if (inputs.gridSnapEnabled) {
      inputs.gridSnapEnabled.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ gridSnapEnabled: event.target.checked });
      });
    }
    if (inputs.gridColumns) {
      inputs.gridColumns.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ gridColumns: event.target.value });
      });
    }
    if (inputs.gridRows) {
      inputs.gridRows.addEventListener('input', event => {
        if (appState.syncingInputs) return;
        updateSettings({ gridRows: event.target.value });
      });
    }
    if (inputs.showScaleLabel) {
      inputs.showScaleLabel.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ showScaleLabel: event.target.checked });
      });
    }
    if (inputs.showUnitLabel) {
      inputs.showUnitLabel.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ showUnitLabel: event.target.checked });
      });
    }
    if (inputs.measurementWithoutScale) {
      inputs.measurementWithoutScale.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ measurementWithoutScale: event.target.checked });
      });
    }
    if (inputs.panningEnabled) {
      inputs.panningEnabled.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        updateSettings({ panningEnabled: event.target.checked });
      });
    }
    if (inputs.measurementTool) {
      inputs.measurementTool.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        const nextTool = sanitizeActiveTool(event.target.value, appState.activeTool);
        if (event.target && event.target.value !== nextTool) {
          event.target.value = nextTool;
        }
        persistActiveInstrumentState();
        updateLengthFieldVisibility(nextTool);
        if (isTapeToolKey(nextTool)) {
          resetTapeMeasureLengthState();
          const updates = { activeTool: nextTool };
          if (isTapeLengthInfinite(appState.settings && appState.settings.tapeMeasureLength)) {
            updates.tapeMeasureLength = TAPE_LENGTH_INFINITE;
          }
          updateSettings(updates);
        } else {
          updateSettings({ activeTool: nextTool });
        }
      });
    }
    if (inputs.measurementDirectionLock) {
      inputs.measurementDirectionLock.addEventListener('change', event => {
        if (appState.syncingInputs) return;
        const selected = sanitizeMeasurementDirectionLock(
          event.target.value,
          defaults.measurementDirectionLock
        );
        if (selected === 'angle') {
          const rotation = getRotationForTool(appState.activeTool);
          updateSettings({
            measurementDirectionLock: selected,
            measurementDirectionAngle: rotation
          });
        } else {
          updateSettings({ measurementDirectionLock: selected });
        }
      });
    }
    if (inputs.measurementDirectionAngleButton) {
      inputs.measurementDirectionAngleButton.addEventListener('click', () => {
        if (appState.syncingInputs) return;
        const rotation = getRotationForTool(appState.activeTool);
        updateSettings({
          measurementDirectionLock: 'angle',
          measurementDirectionAngle: rotation
        });
      });
    }
    // unit spacing is fixed and no longer configurable
  }

  function isEventInsideRuler(event) {
    const activeElement = getActiveToolElement();
    if (!activeElement) {
      return false;
    }
    const target = event && event.target;
    if (
      target &&
      (target === activeElement ||
        (typeof activeElement.contains === 'function' && activeElement.contains(target)))
    ) {
      return true;
    }
    if (event && typeof event.composedPath === 'function') {
      const path = event.composedPath();
      if (Array.isArray(path) && path.includes(activeElement)) {
        return true;
      }
    }
    return false;
  }

  function handleBoardPointerDown(event) {
    if (!boardPanState.enabled || boardPanState.entry || !board) {
      return;
    }
    if (event.button && event.button !== 0) {
      return;
    }
    if (isEventInsideRuler(event) || hasAnyActivePointers()) {
      return;
    }
    const clientX = event.clientX;
    const clientY = event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }
    boardPanState.entry = {
      pointerId: event.pointerId,
      clientX,
      clientY,
      prevX: clientX,
      prevY: clientY
    };
    board.classList.add('board--panning');
    try {
      board.setPointerCapture(event.pointerId);
    } catch (_) {}
    event.preventDefault();
  }

  function handleBoardPointerMove(event) {
    const entry = boardPanState.entry;
    if (!entry || entry.pointerId !== event.pointerId) {
      return;
    }
    if (!boardPanState.enabled) {
      endBoardPanSession();
      return;
    }
    const clientX = event.clientX;
    const clientY = event.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return;
    }
    entry.prevX = entry.clientX;
    entry.prevY = entry.clientY;
    entry.clientX = clientX;
    entry.clientY = clientY;
    updateBoardPanFromPointer(entry);
    event.preventDefault();
  }

  function handleBoardPointerEnd(event) {
    const entry = boardPanState.entry;
    if (!entry || entry.pointerId !== event.pointerId) {
      return;
    }
    endBoardPanSession();
  }

  function handleBoardPointerCancel(event) {
    const entry = boardPanState.entry;
    if (!entry || entry.pointerId !== event.pointerId) {
      return;
    }
    endBoardPanSession();
  }

  function handleBoardLostPointerCapture(event) {
    const entry = boardPanState.entry;
    if (!entry || entry.pointerId !== event.pointerId) {
      return;
    }
    endBoardPanSession({ skipRelease: true });
  }

  function endBoardPanSession(options = {}) {
    const entry = boardPanState.entry;
    boardPanState.entry = null;
    if (board) {
      board.classList.remove('board--panning');
      if (entry && !options.skipRelease) {
        try {
          board.releasePointerCapture(entry.pointerId);
        } catch (_) {}
      }
    }
    if (entry && options.persist !== false) {
      persistBoardPanState();
      applyTransformWithSnap({ persist: true });
    }
  }

  function getToolElement(toolKey) {
    if (isTapeToolKey(toolKey)) {
      return tapeMeasure || segment;
    }
    if (isSegmentToolKey(toolKey)) {
      return segment;
    }
    return ruler;
  }

  function getActiveToolElement() {
    const element = getToolElement(appState.activeTool);
    if (element) {
      return element;
    }
    if (appState.activeTool !== defaultActiveTool) {
      return getToolElement(defaultActiveTool);
    }
    return null;
  }

  function getToolDisplayInfo(toolKey) {
    if (toolKey === TAPE_BETA_TOOL_KEY) {
      return {
        key: TAPE_BETA_TOOL_KEY,
        label: 'målebånd',
        title: 'Målebånd',
        possessive: 'Målebåndets'
      };
    }
    if (toolKey === 'segment') {
      return { key: 'segment', label: 'linjestykke', title: 'Linjestykke', possessive: 'Linjestykkets' };
    }
    return { key: 'ruler', label: 'linjal', title: 'Linjal', possessive: 'Linjalens' };
  }

  function getInstrumentPointerSession(toolKey = appState.activeTool) {
    if (isTapeToolKey(toolKey)) {
      return activePointers.tape;
    }
    if (isSegmentToolKey(toolKey)) {
      return activePointers.segment;
    }
    return activePointers.ruler;
  }

  function hasActiveInstrumentPointers() {
    const session = getInstrumentPointerSession();
    return session && session.size > 0;
  }

  function hasAnyActivePointers() {
    return (
      hasActiveInstrumentPointers() ||
      (activePointers.tapeExtension && activePointers.tapeExtension.size > 0) ||
      (activePointers.tapeHousing && activePointers.tapeHousing.size > 0) ||
      (activePointers.segment && activePointers.segment.size > 0)
    );
  }

  function cancelInstrumentPointerSessions(toolKey, { skipRelease = false } = {}) {
    const session = getInstrumentPointerSession(toolKey);
    if (!session) {
      return;
    }
    const element = isTapeToolKey(toolKey) ? tapeHousing : ruler;
    if (!skipRelease && element) {
      for (const entry of session.values()) {
        if (!entry || entry.pointerId == null) continue;
        try {
          element.releasePointerCapture(entry.pointerId);
        } catch (_) {}
      }
    }
    session.clear();
  }

  function cancelTapeExtensionSessions({ skipRelease = false } = {}) {
    const session = activePointers.tapeExtension;
    if (!session || session.size === 0) {
      return;
    }
    const hadEntries = session.size > 0;
    if (!skipRelease && tapeStrap) {
      for (const entry of session.values()) {
        if (!entry || entry.pointerId == null) continue;
        try {
          tapeStrap.releasePointerCapture(entry.pointerId);
        } catch (_) {}
      }
    }
    session.clear();
    if (hadEntries && isTapeToolKey(appState.activeTool)) {
      persistTapeMeasureState();
    }
  }

  function cancelTapeHousingSessions({ skipRelease = false } = {}) {
    const session = activePointers.tapeHousing;
    if (!session || session.size === 0) {
      return;
    }
    const hadEntries = session.size > 0;
    if (!skipRelease && tapeHousing) {
      for (const entry of session.values()) {
        if (!entry || entry.pointerId == null) continue;
        try {
          tapeHousing.releasePointerCapture(entry.pointerId);
        } catch (_) {}
      }
    }
    session.clear();
    if (hadEntries && isTapeToolKey(appState.activeTool)) {
      persistTapeMeasureState();
    }
  }

  function cancelAllPointerSessions(options = {}) {
    cancelInstrumentPointerSessions('ruler', options);
    cancelInstrumentPointerSessions('tape', options);
    cancelSegmentPointerSessions(options);
    cancelTapeExtensionSessions(options);
    cancelTapeHousingSessions(options);
  }

  function attachInstrumentPointerHandlers(element, toolKey) {
    if (!element) {
      return;
    }
    element.addEventListener(
      'pointerdown',
      event => handleInstrumentPointerDown(event, toolKey, element),
      { passive: false }
    );
    element.addEventListener('pointermove', event => handleInstrumentPointerMove(event, toolKey));
    element.addEventListener('pointerup', event => handleInstrumentPointerEnd(event, toolKey));
    element.addEventListener('pointercancel', event => handleInstrumentPointerEnd(event, toolKey));
    element.addEventListener('lostpointercapture', event => {
      if (event.pointerId != null) {
        const session = getInstrumentPointerSession(toolKey);
        session.delete(event.pointerId);
        if (session.size === 0 && appState.activeTool === toolKey) {
          applyTransformWithSnap({ allowSnap: true, persist: true });
        }
      }
    });
  }

  function attachTapeHousingHandlers(element) {
    if (!element) {
      return;
    }
    element.addEventListener(
      'pointerdown',
      event => handleTapeHousingPointerDown(event, element),
      { passive: false }
    );
    element.addEventListener('pointermove', handleTapeHousingPointerMove);
    element.addEventListener('pointerup', handleTapeHousingPointerEnd);
    element.addEventListener('pointercancel', handleTapeHousingPointerEnd);
    element.addEventListener('lostpointercapture', event => {
      if (event.pointerId != null) {
        const session = activePointers.tapeHousing;
        const wasTracked = session.delete(event.pointerId);
        if (wasTracked && session.size === 0 && isTapeToolKey(appState.activeTool)) {
          persistTapeMeasureState();
        }
      }
    });
  }

  function attachTapeExtensionHandlers(element) {
    if (!element) {
      return;
    }
    element.addEventListener(
      'pointerdown',
      event => handleTapeExtensionPointerDown(event, element),
      { passive: false }
    );
    element.addEventListener('pointermove', handleTapeExtensionPointerMove);
    element.addEventListener('pointerup', handleTapeExtensionPointerEnd);
    element.addEventListener('pointercancel', handleTapeExtensionPointerEnd);
    element.addEventListener('lostpointercapture', event => {
      if (event.pointerId != null) {
        const session = activePointers.tapeExtension;
        const wasTracked = session.delete(event.pointerId);
        if (wasTracked && session.size === 0 && isTapeToolKey(appState.activeTool)) {
          persistTapeMeasureState();
        }
      }
    });
  }

  function cancelSegmentPointerSessions({ skipRelease = false } = {}) {
    const session = activePointers.segment;
    if (!session || session.size === 0) {
      return;
    }
    const hadEntries = session.size > 0;
    if (!skipRelease) {
      for (const entry of session.values()) {
        if (!entry || entry.pointerId == null || !entry.captureTarget) continue;
        try {
          entry.captureTarget.releasePointerCapture(entry.pointerId);
        } catch (error) {}
      }
    }
    session.clear();
    if (hadEntries && isSegmentToolKey(appState.activeTool)) {
      persistSegmentState();
    }
  }

  function getSegmentHandleAnchor(handle) {
    if (!handle) {
      return null;
    }
    const rect = handle.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    if (isTapeBetaActive()) {
      const key = handle.getAttribute('data-segment-handle');
      const spec = key ? TAPE_BETA_HANDLE_SPECS[key] : null;
      if (spec) {
        const { anchorX, anchorY } = resolveTapeBetaAnchor(spec);
        const safeAnchorX = Number.isFinite(anchorX) ? anchorX : 0;
        const safeAnchorY = Number.isFinite(anchorY) ? anchorY : rect.height;
        return {
          x: rect.left + safeAnchorX,
          y: rect.top + safeAnchorY
        };
      }
      return {
        x: rect.left,
        y: rect.top + rect.height / 2
      };
    }
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function handleSegmentPointerDown(event) {
    if (!hasSegment || event.button > 0) {
      return;
    }
    if (!isSegmentToolKey(appState.activeTool)) {
      return;
    }
    const handle = event.currentTarget;
    if (!handle) {
      return;
    }
    const key = handle.getAttribute('data-segment-handle');
    if (!key) {
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    boardRect = board.getBoundingClientRect();
    const anchor = getSegmentHandleAnchor(handle);
    if (!anchor) {
      return;
    }
    const pointerOffset = {
      x: event.clientX - anchor.x,
      y: event.clientY - anchor.y
    };
    const session = activePointers.segment;
    const entry = {
      pointerId: event.pointerId,
      handleKey: key,
      pointerOffset,
      captureTarget: handle
    };
    session.set(event.pointerId, entry);
    try {
      handle.setPointerCapture(event.pointerId);
    } catch (error) {}
    event.preventDefault();
  }

  function handleSegmentBodyPointerDown(event) {
    if (!hasSegment || event.button > 0) {
      return;
    }
    if (appState.activeTool !== 'segment') {
      return;
    }
    if (!segmentLine) {
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    boardRect = board.getBoundingClientRect();
    const geometry = getSegmentPointsInPx();
    if (!geometry || !geometry.a || !geometry.b) {
      return;
    }
    const session = activePointers.segment;
    const entry = {
      pointerId: event.pointerId,
      handleKey: 'body',
      captureTarget: segmentLine,
      dragStartPointer: { x: event.clientX, y: event.clientY },
      startPoints: {
        a: { x: geometry.a.x, y: geometry.a.y },
        b: { x: geometry.b.x, y: geometry.b.y }
      }
    };
    session.set(event.pointerId, entry);
    try {
      segmentLine.setPointerCapture(event.pointerId);
    } catch (error) {}
    event.preventDefault();
  }

  function handleTapeBetaStrapPointerDown(event) {
    if (!hasSegment || event.button > 0) {
      return;
    }
    if (!isTapeBetaActive() || !isSegmentToolKey(appState.activeTool)) {
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    const strapTarget = event.currentTarget || tapeBetaStrapElement;
    if (!strapTarget) {
      return;
    }
    boardRect = board.getBoundingClientRect();
    const geometry = getSegmentPointsInPx();
    if (!geometry || !geometry.a || !geometry.b) {
      return;
    }
    const session = activePointers.segment;
    const entry = {
      pointerId: event.pointerId,
      handleKey: 'strap',
      captureTarget: strapTarget,
      strapStartPointer: { x: event.clientX, y: event.clientY },
      dragStartPointer: { x: event.clientX, y: event.clientY },
      startPoints: {
        a: { x: geometry.a.x, y: geometry.a.y },
        b: { x: geometry.b.x, y: geometry.b.y }
      }
    };
    session.set(event.pointerId, entry);
    try {
      strapTarget.setPointerCapture(event.pointerId);
    } catch (error) {}
    event.preventDefault();
  }

  function handleSegmentPointerMove(event) {
    const session = activePointers.segment;
    if (!session || session.size === 0) {
      return;
    }
    const entry = session.get(event.pointerId);
    if (!entry) {
      return;
    }
    if (!isSegmentToolKey(appState.activeTool)) {
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    boardRect = board.getBoundingClientRect();
    const pointerOffset = entry.pointerOffset || { x: 0, y: 0 };
    let targetX = event.clientX - pointerOffset.x - (boardRect ? boardRect.left : 0);
    let targetY = event.clientY - pointerOffset.y - (boardRect ? boardRect.top : 0);
    const width = boardRect && Number.isFinite(boardRect.width) ? boardRect.width : BASE_BOARD_DIMENSIONS.width;
    const height =
      boardRect && Number.isFinite(boardRect.height) ? boardRect.height : BASE_BOARD_DIMENSIONS.height;
    if (entry.handleKey === 'strap' || entry.handleKey === 'body') {
      const dragStart = entry.dragStartPointer || entry.strapStartPointer;
      const startPoints = entry.startPoints;
      if (
        !dragStart ||
        !startPoints ||
        !startPoints.a ||
        !startPoints.b ||
        !Number.isFinite(dragStart.x) ||
        !Number.isFinite(dragStart.y)
      ) {
        event.preventDefault();
        return;
      }
      const deltaX = event.clientX - dragStart.x;
      const deltaY = event.clientY - dragStart.y;
      setSegmentPointFromPx('a', startPoints.a.x + deltaX, startPoints.a.y + deltaY);
      setSegmentPointFromPx('b', startPoints.b.x + deltaX, startPoints.b.y + deltaY);
      renderSegment(appState.settings);
      event.preventDefault();
      return;
    }
    const mode = resolveDirectionLockMode(appState.settings);
    if (mode && mode !== 'none') {
      const angle = resolveDirectionLockAngle(appState.settings, mode);
      if (Number.isFinite(angle)) {
        const points = getSegmentPointsInPx();
        if (points) {
          const otherKey = entry.handleKey === 'a' ? 'b' : 'a';
          const anchor = otherKey === 'a' ? points.a : points.b;
          const dirX = Math.cos(angle);
          const dirY = Math.sin(angle);
          if (Number.isFinite(dirX) && Number.isFinite(dirY)) {
            const deltaX = targetX - anchor.x;
            const deltaY = targetY - anchor.y;
            const projection = deltaX * dirX + deltaY * dirY;
            targetX = anchor.x + dirX * projection;
            targetY = anchor.y + dirY * projection;
          }
        }
      }
    }
    if (shouldSnapSegmentHandles()) {
      const snapped = snapSegmentPointToGrid(targetX, targetY, mode);
      if (snapped) {
        targetX = snapped.x;
        targetY = snapped.y;
      }
    }
    const clampedX = Math.min(Math.max(targetX, 0), Math.max(width, 0));
    const clampedY = Math.min(Math.max(targetY, 0), Math.max(height, 0));
    setSegmentPointFromPx(entry.handleKey, clampedX, clampedY);
    renderSegment(appState.settings);
    event.preventDefault();
  }

  function shouldSnapSegmentHandles() {
    return !!(appState.settings && appState.settings.gridSnapEnabled);
  }

  function snapSegmentPointToGrid(x, y, mode) {
    const rect = boardRect;
    const width = rect && Number.isFinite(rect.width) ? rect.width : BASE_BOARD_DIMENSIONS.width;
    const height = rect && Number.isFinite(rect.height) ? rect.height : BASE_BOARD_DIMENSIONS.height;
    if (!(width > 0) || !(height > 0)) {
      return { x, y };
    }
    const columns = sanitizeGridCount(
      appState.settings && appState.settings.gridColumns,
      defaults.gridColumns
    );
    const rows = sanitizeGridCount(appState.settings && appState.settings.gridRows, defaults.gridRows);
    const stepX = width / columns;
    const stepY = height / rows;
    if (!(stepX > 0) || !(stepY > 0)) {
      return { x, y };
    }
    const panX = getBoardPanOffset('x');
    const panY = getBoardPanOffset('y');
    const snapValue = (value, step, offset) => {
      if (!Number.isFinite(value)) {
        return value;
      }
      const relative = value - offset;
      return Math.round(relative / step) * step + offset;
    };
    if (mode === 'horizontal') {
      return { x: snapValue(x, stepX, panX), y };
    }
    if (mode === 'vertical') {
      return { x, y: snapValue(y, stepY, panY) };
    }
    if (!mode || mode === 'none') {
      return { x: snapValue(x, stepX, panX), y: snapValue(y, stepY, panY) };
    }
    return { x, y };
  }

  function handleSegmentPointerEnd(event) {
    const session = activePointers.segment;
    if (!session) {
      return;
    }
    const entry = session.get(event.pointerId);
    if (!entry) {
      return;
    }
    session.delete(event.pointerId);
    if (entry.captureTarget && entry.pointerId != null) {
      try {
        entry.captureTarget.releasePointerCapture(entry.pointerId);
      } catch (error) {}
    }
    if (session.size === 0 && isSegmentToolKey(appState.activeTool)) {
      persistSegmentState();
    }
    event.preventDefault();
  }

  function shouldUseFreeTapeMovement() {
    if (!appState.settings) {
      return false;
    }
    if (resolveDirectionLockMode(appState.settings) !== 'none') {
      return false;
    }
    return !!(tapeMeasure && tapeZeroAnchor && tapeHousing);
  }

  function rememberTapeAxisFallback(axisUnitWorld) {
    if (!axisUnitWorld) {
      return;
    }
    const normalized = normalizeVector(axisUnitWorld);
    if (normalized.x === 0 && normalized.y === 0) {
      return;
    }
    tapeAxisFallbackHousingToZero = { x: normalized.x, y: normalized.y };
  }

  function getTapeAxisFallbackHousingToZero(rotation) {
    if (
      tapeAxisFallbackHousingToZero &&
      (tapeAxisFallbackHousingToZero.x !== 0 || tapeAxisFallbackHousingToZero.y !== 0)
    ) {
      return { ...tapeAxisFallbackHousingToZero };
    }
    const rotationVector = normalizeVector({ x: Math.cos(rotation), y: Math.sin(rotation) });
    if (rotationVector.x === 0 && rotationVector.y === 0) {
      return { x: 1, y: 0 };
    }
    return rotationVector;
  }

  function setTapeEndpointsState(housingWorld, zeroWorld) {
    if (
      housingWorld &&
      Number.isFinite(housingWorld.x) &&
      Number.isFinite(housingWorld.y)
    ) {
      tapeEndpoints.housing = { x: housingWorld.x, y: housingWorld.y };
    }
    if (zeroWorld && Number.isFinite(zeroWorld.x) && Number.isFinite(zeroWorld.y)) {
      tapeEndpoints.zero = { x: zeroWorld.x, y: zeroWorld.y };
    }
  }

  function getTapeEndpointState(key, fallback) {
    const value = tapeEndpoints[key];
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
      return { x: value.x, y: value.y };
    }
    if (fallback && Number.isFinite(fallback.x) && Number.isFinite(fallback.y)) {
      return { x: fallback.x, y: fallback.y };
    }
    return null;
  }

  function getTapeEndpointsVector() {
    if (!tapeEndpoints.housing || !tapeEndpoints.zero) {
      return null;
    }
    if (
      !Number.isFinite(tapeEndpoints.housing.x) ||
      !Number.isFinite(tapeEndpoints.housing.y) ||
      !Number.isFinite(tapeEndpoints.zero.x) ||
      !Number.isFinite(tapeEndpoints.zero.y)
    ) {
      return null;
    }
    return {
      x: tapeEndpoints.zero.x - tapeEndpoints.housing.x,
      y: tapeEndpoints.zero.y - tapeEndpoints.housing.y
    };
  }

  function getTapeDirectionFromEndpoints() {
    const vector = getTapeEndpointsVector();
    if (!vector) {
      return null;
    }
    return normalizeVector(vector);
  }

  function initializeTapeEndpointsFromDom() {
    if (!tapeZeroAnchor || !tapeHousing) {
      return;
    }
    const zeroRect = tapeZeroAnchor.getBoundingClientRect();
    const housingRect = tapeHousing.getBoundingClientRect();
    if (!zeroRect || !housingRect) {
      return;
    }
    setTapeEndpointsState(getRectCenter(housingRect), getRectCenter(zeroRect));
  }

  function buildTapeHandleAnchorData(handleType, captureTarget, event) {
    if (!captureTarget || !event) {
      return null;
    }
    if (!tapeMeasure || !tapeZeroAnchor || !tapeHousing) {
      return null;
    }
    const measureRect = tapeMeasure.getBoundingClientRect();
    const zeroRect = tapeZeroAnchor.getBoundingClientRect();
    const housingRect = tapeHousing.getBoundingClientRect();
    if (!measureRect || !zeroRect || !housingRect) {
      return null;
    }
    const rotation = Number.isFinite(transformStates[TAPE_BETA_TOOL_KEY].rotation)
      ? transformStates[TAPE_BETA_TOOL_KEY].rotation
      : 0;
    const center = getRectCenter(measureRect);
    const zeroWorld = getRectCenter(zeroRect);
    const housingWorld = getRectCenter(housingRect);
    const zeroLocal = rotatePointInverse(
      { x: zeroWorld.x - center.x, y: zeroWorld.y - center.y },
      rotation
    );
    const housingLocal = rotatePointInverse(
      { x: housingWorld.x - center.x, y: housingWorld.y - center.y },
      rotation
    );
    let axisUnitWorld = getTapeDirectionFromEndpoints();
    const localAxisVector = {
      x: zeroLocal.x - housingLocal.x,
      y: zeroLocal.y - housingLocal.y
    };
    if (!axisUnitWorld || (axisUnitWorld.x === 0 && axisUnitWorld.y === 0)) {
      const normalizedLocal = normalizeVector(localAxisVector);
      axisUnitWorld =
        normalizedLocal.x === 0 && normalizedLocal.y === 0
          ? getTapeAxisFallbackHousingToZero(rotation)
          : rotatePoint(normalizedLocal, rotation);
    }
    let axisUnitLocal = axisUnitWorld
      ? normalizeVector(rotatePointInverse(axisUnitWorld, rotation))
      : normalizeVector(localAxisVector);
    rememberTapeAxisFallback(axisUnitWorld);
    const pointerRect =
      typeof captureTarget.getBoundingClientRect === 'function'
        ? captureTarget.getBoundingClientRect()
        : null;
    const pointerCenter = pointerRect
      ? getRectCenter(pointerRect)
      : handleType === 'housing'
      ? housingWorld
      : zeroWorld;
    const pointerOffset = {
      x: event.clientX - pointerCenter.x,
      y: event.clientY - pointerCenter.y
    };
    const anchorWorld = handleType === 'housing' ? housingWorld : zeroWorld;
    const targetToAnchor = {
      x: anchorWorld.x - pointerCenter.x,
      y: anchorWorld.y - pointerCenter.y
    };
    setTapeEndpointsState(housingWorld, zeroWorld);
    const baseWidth =
      Number.isFinite(tapeMeasure.offsetWidth) && tapeMeasure.offsetWidth > 0
        ? tapeMeasure.offsetWidth
        : measureRect.width;
    const baseHeight =
      Number.isFinite(tapeMeasure.offsetHeight) && tapeMeasure.offsetHeight > 0
        ? tapeMeasure.offsetHeight
        : measureRect.height;
    return {
      handleType,
      pointerOffset,
      targetToAnchor,
      zeroWorld,
      housingWorld,
      zeroLocal,
      housingLocal,
      axisUnitLocal,
      axisUnitWorld,
      axisAngle: Math.atan2(axisUnitLocal.y, axisUnitLocal.x),
      baseSize: { width: baseWidth, height: baseHeight }
    };
  }

  function buildTapeFreeMovementData(handleType, captureTarget, event, anchorOverride) {
    if (!shouldUseFreeTapeMovement()) {
      return null;
    }
    const anchor = anchorOverride || buildTapeHandleAnchorData(handleType, captureTarget, event);
    if (!anchor) {
      return null;
    }
    if (!captureTarget || !event) {
      return null;
    }
    return {
      handleType,
      pointerOffset: anchor.pointerOffset,
      targetToAnchor: anchor.targetToAnchor,
      zeroWorldStart: anchor.zeroWorld,
      housingWorldStart: anchor.housingWorld,
      housingLocal: anchor.housingLocal,
      axisUnitLocal: anchor.axisUnitLocal,
      axisAngle: anchor.axisAngle,
      baseSize: anchor.baseSize
    };
  }

  function refreshActiveTapePointerAnchors() {
    const extensionSession = activePointers.tapeExtension;
    const housingSession = activePointers.tapeHousing;
    if (
      (!extensionSession || extensionSession.size === 0) &&
      (!housingSession || housingSession.size === 0)
    ) {
      return;
    }
    const allowFreeMovement = shouldUseFreeTapeMovement();
    const rotation = Number.isFinite(transformStates[TAPE_BETA_TOOL_KEY].rotation)
      ? transformStates[TAPE_BETA_TOOL_KEY].rotation
      : 0;
    const sessions = [extensionSession, housingSession];
    for (const session of sessions) {
      if (!session || session.size === 0) {
        continue;
      }
      for (const entry of session.values()) {
        if (!entry || !entry.captureTarget) {
          continue;
        }
        const { handleType } = entry;
        if (handleType !== 'zero' && handleType !== 'housing') {
          continue;
        }
        const pointerX = Number.isFinite(entry.clientX)
          ? entry.clientX
          : Number.isFinite(entry.startX)
          ? entry.startX
          : null;
        const pointerY = Number.isFinite(entry.clientY)
          ? entry.clientY
          : Number.isFinite(entry.startY)
          ? entry.startY
          : null;
        if (!Number.isFinite(pointerX) || !Number.isFinite(pointerY)) {
          continue;
        }
        const anchor = buildTapeHandleAnchorData(handleType, entry.captureTarget, {
          clientX: pointerX,
          clientY: pointerY
        });
        if (anchor) {
          entry.anchor = anchor;
        } else if (entry.anchor) {
          delete entry.anchor;
        }
        if (allowFreeMovement) {
          const data = buildTapeFreeMovementData(
            handleType,
            entry.captureTarget,
            {
              clientX: pointerX,
              clientY: pointerY
            },
            anchor
          );
          if (data) {
            entry.freeMovement = data;
            if (handleType === 'housing') {
              const axisUnitWorld =
                getTapeDirectionFromEndpoints() ||
                (anchor && anchor.axisUnitWorld) ||
                (data.axisUnitLocal ? rotatePoint(data.axisUnitLocal, rotation) : null);
              const normalizedAxis = normalizeVector(axisUnitWorld || { x: 0, y: 0 });
              if (normalizedAxis && (normalizedAxis.x !== 0 || normalizedAxis.y !== 0)) {
                entry.axisUnit = normalizedAxis;
              }
              entry.startPoint = { x: pointerX, y: pointerY };
            }
          } else if (entry.freeMovement) {
            delete entry.freeMovement;
          }
        } else if (entry.freeMovement) {
          delete entry.freeMovement;
        }
      }
    }
  }

  function resolveVisibleFromFreeMovement(entry, proposedVisible) {
    const minVisible = tapeLengthState.minVisiblePx;
    const unitSpacing =
      Number.isFinite(tapeLengthState.unitSpacing) && tapeLengthState.unitSpacing > 0
        ? tapeLengthState.unitSpacing
        : 0;
    let targetVisible = proposedVisible;
    const previousMaxVisible =
      Number.isFinite(tapeLengthState.maxVisiblePx) && tapeLengthState.maxVisiblePx > 0
        ? tapeLengthState.maxVisiblePx
        : Infinity;
    const tapeLengthIsInfinite =
      isTapeLengthInfinite(appState.settings && appState.settings.tapeMeasureLength) ||
      isTapeLengthInfinite(tapeLengthState.configuredUnits);
    if (unitSpacing > 0 && targetVisible > previousMaxVisible) {
      const proposedUnits = Math.ceil(targetVisible / unitSpacing);
      if (tapeLengthIsInfinite) {
        if (Number.isFinite(proposedUnits) && proposedUnits > 0) {
          tapeLengthState.units = proposedUnits;
          tapeLengthState.visiblePx = Math.max(targetVisible, tapeLengthState.minVisiblePx);
          const metrics = resolveScaleMetrics(appState.settings);
          applyTapeMeasureAppearance(appState.settings, metrics);
          refreshActiveTapePointerAnchors();
          targetVisible = tapeLengthState.visiblePx;
        }
      } else if (Number.isFinite(previousMaxVisible)) {
        const referenceUnits = Number.isFinite(tapeLengthState.configuredUnits)
          ? tapeLengthState.configuredUnits
          : defaults.tapeMeasureLength;
        const lastPersistedUnits = Number.isFinite(entry.lastPersistedUnits)
          ? entry.lastPersistedUnits
          : referenceUnits;
        if (Number.isFinite(proposedUnits) && proposedUnits > lastPersistedUnits) {
          persistTapeMeasureLength(proposedUnits);
          entry.lastPersistedUnits = Number.isFinite(tapeLengthState.configuredUnits)
            ? tapeLengthState.configuredUnits
            : proposedUnits;
        }
      }
    }
    const maxVisible =
      Number.isFinite(tapeLengthState.maxVisiblePx) && tapeLengthState.maxVisiblePx > 0
        ? tapeLengthState.maxVisiblePx
        : Infinity;
    let visible = targetVisible;
    if (appState.settings && appState.settings.gridSnapEnabled && unitSpacing > 0) {
      visible = Math.round(visible / unitSpacing) * unitSpacing;
    }
    visible = Math.min(Math.max(visible, minVisible), maxVisible);
    tapeLengthState.visiblePx = Number.isFinite(visible) ? visible : minVisible;
    tapeLengthState.units =
      unitSpacing > 0 ? Math.max(0, tapeLengthState.visiblePx / unitSpacing) : 0;
    return tapeLengthState.visiblePx;
  }

  function applyTapeTransformForEndpoints(housingWorld, zeroWorld, direction, data) {
    if (!data || !housingWorld || !zeroWorld) {
      return;
    }
    const vector = {
      x: zeroWorld.x - housingWorld.x,
      y: zeroWorld.y - housingWorld.y
    };
    let normalizedDirection = normalizeVector(direction);
    if (!normalizedDirection || (normalizedDirection.x === 0 && normalizedDirection.y === 0)) {
      normalizedDirection = normalizeVector(vector);
    }
    if (!normalizedDirection || (normalizedDirection.x === 0 && normalizedDirection.y === 0)) {
      const rotationFallback = Number.isFinite(transformStates[TAPE_BETA_TOOL_KEY].rotation)
        ? transformStates[TAPE_BETA_TOOL_KEY].rotation
        : 0;
      normalizedDirection = { x: Math.cos(rotationFallback), y: Math.sin(rotationFallback) };
    }
    rememberTapeAxisFallback(normalizedDirection);
    const targetAngle = Math.atan2(normalizedDirection.y, normalizedDirection.x);
    const rotation = normalizeAngle(targetAngle - data.axisAngle);
    const baseWidth = data.baseSize && Number.isFinite(data.baseSize.width) ? data.baseSize.width : 0;
    const baseHeight = data.baseSize && Number.isFinite(data.baseSize.height) ? data.baseSize.height : 0;
    const housingLocal = data.housingLocal || { x: 0, y: 0 };
    const zeroLocal = data.zeroLocal || { x: 0, y: 0 };
    const localMidpoint = {
      x: (housingLocal.x + zeroLocal.x) / 2,
      y: (housingLocal.y + zeroLocal.y) / 2
    };
    const rotatedMidpoint = rotatePoint(localMidpoint, rotation);
    const worldMidpoint = {
      x: (housingWorld.x + zeroWorld.x) / 2,
      y: (housingWorld.y + zeroWorld.y) / 2
    };
    const center = {
      x: worldMidpoint.x - rotatedMidpoint.x,
      y: worldMidpoint.y - rotatedMidpoint.y
    };
    transformStates[TAPE_BETA_TOOL_KEY].rotation = rotation;
    transformStates[TAPE_BETA_TOOL_KEY].x = center.x - baseWidth / 2;
    transformStates[TAPE_BETA_TOOL_KEY].y = center.y - baseHeight / 2;
    setTapeEndpointsState(housingWorld, zeroWorld);
  }

  function updateTapeFreeMovement(entry, desiredAnchorWorld) {
    if (!entry || !entry.freeMovement) {
      return false;
    }
    const data = entry.freeMovement;
    if (!shouldUseFreeTapeMovement()) {
      return false;
    }
    if (!desiredAnchorWorld) {
      return false;
    }
    const rotation = Number.isFinite(transformStates[TAPE_BETA_TOOL_KEY].rotation)
      ? transformStates[TAPE_BETA_TOOL_KEY].rotation
      : 0;
    const housingStart = getTapeEndpointState('housing', data.housingWorldStart);
    const zeroStart = getTapeEndpointState('zero', data.zeroWorldStart);
    if (!housingStart || !zeroStart) {
      return false;
    }
    let housingWorld = { ...housingStart };
    let zeroWorld = { ...zeroStart };
    if (data.handleType === 'zero') {
      zeroWorld = { x: desiredAnchorWorld.x, y: desiredAnchorWorld.y };
    } else if (data.handleType === 'housing') {
      housingWorld = { x: desiredAnchorWorld.x, y: desiredAnchorWorld.y };
    } else {
      return false;
    }
    const vector = {
      x: zeroWorld.x - housingWorld.x,
      y: zeroWorld.y - housingWorld.y
    };
    let direction = normalizeVector(vector);
    if (!direction || (direction.x === 0 && direction.y === 0)) {
      direction = normalizeVector(rotatePoint(data.axisUnitLocal, rotation));
    }
    const distance = Math.hypot(vector.x, vector.y);
    const visible = resolveVisibleFromFreeMovement(entry, Number.isFinite(distance) ? distance : 0);
    if (!direction || (direction.x === 0 && direction.y === 0)) {
      direction = getTapeDirectionFromEndpoints();
    }
    if (!direction || (direction.x === 0 && direction.y === 0)) {
      direction = rotatePoint({ x: 1, y: 0 }, rotation);
    }
    if (data.handleType === 'housing' && direction) {
      entry.axisUnit = direction;
    }
    if (data.handleType === 'zero') {
      zeroWorld = {
        x: housingWorld.x + direction.x * visible,
        y: housingWorld.y + direction.y * visible
      };
    } else {
      housingWorld = {
        x: zeroWorld.x - direction.x * visible,
        y: zeroWorld.y - direction.y * visible
      };
    }
    setTapeEndpointsState(housingWorld, zeroWorld);
    applyTapeTransformForEndpoints(housingWorld, zeroWorld, direction, data);
    return true;
  }

  function attachInstrumentFocusHandlers(element, toolKey) {
    if (!element) {
      return;
    }
    element.setAttribute('tabindex', '-1');
    element.addEventListener('focus', () => {
      if (
        appState.activeTool === toolKey ||
        (isSegmentToolKey(toolKey) && isSegmentToolKey(appState.activeTool))
      ) {
        return;
      }
      persistActiveInstrumentState();
      updateSettings({ activeTool: toolKey });
    });
  }

  function applyToolTransform(toolKey) {
    if (isTapeToolKey(toolKey)) {
      applyTapeMeasureTransform();
      return;
    }
    if (toolKey === 'segment' || toolKey === TAPE_BETA_TOOL_KEY) {
      applySegmentTransform();
      return;
    }
    const element = getToolElement(toolKey);
    const state = transformStates[toolKey];
    if (!element || !state) {
      return;
    }
    element.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotate(${state.rotation}rad)`;
  }

  function updateBaseSize() {
    const element = getActiveToolElement();
    if (!element) {
      baseSize.width = 0;
      baseSize.height = 0;
      return;
    }
    baseSize.width = element.offsetWidth;
    baseSize.height = element.offsetHeight;
    if (isTapeToolKey(appState.activeTool)) {
      updateTapeZeroOffset();
    }
  }

  function updateTapeZeroOffset() {
    if (!tapeMeasure) {
      return;
    }
    const measureRect = tapeMeasure.getBoundingClientRect();
    if (!measureRect) {
      return;
    }
    const defaultX = Number.isFinite(measureRect.width) ? measureRect.width / 2 : null;
    const defaultY = Number.isFinite(measureRect.height) ? measureRect.height / 2 : null;
    if (Number.isFinite(defaultX)) {
      zeroOffset.x = defaultX;
    }
    if (Number.isFinite(defaultY)) {
      zeroOffset.y = defaultY;
    }
    if (!tapeZeroAnchor) {
      return;
    }
    const anchorRect = tapeZeroAnchor.getBoundingClientRect();
    if (!anchorRect) {
      return;
    }
    const anchorX = anchorRect.left - measureRect.left + anchorRect.width / 2;
    const anchorY = anchorRect.top - measureRect.top + anchorRect.height / 2;
    if (Number.isFinite(anchorX)) {
      zeroOffset.x = anchorX;
    }
    if (Number.isFinite(anchorY)) {
      zeroOffset.y = anchorY;
    }
  }

  function isEventFromTapeZeroHandle(event) {
    if (!event || !tapeZeroHandle) {
      return false;
    }
    const target = event.target;
    if (
      target &&
      (target === tapeZeroHandle ||
        (typeof tapeZeroHandle.contains === 'function' && tapeZeroHandle.contains(target)))
    ) {
      return true;
    }
    if (typeof event.composedPath === 'function') {
      const path = event.composedPath();
      if (Array.isArray(path) && path.includes(tapeZeroHandle)) {
        return true;
      }
    }
    return false;
  }

  function consumeTapeZeroHandleEvent(event) {
    if (!event) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  function handleInstrumentPointerDown(event, toolKey, captureTarget) {
    if (event.button && event.button !== 0) {
      return;
    }
    if (appState.activeTool !== toolKey) {
      return;
    }
    const session = getInstrumentPointerSession(toolKey);
    if (!session) {
      return;
    }
    const isTapeZeroHandleEvent = isTapeToolKey(toolKey) && isEventFromTapeZeroHandle(event);
    if (session.size >= 2 && !session.has(event.pointerId)) {
      if (isTapeZeroHandleEvent) {
        consumeTapeZeroHandleEvent(event);
      }
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    if (
      isTapeToolKey(toolKey) &&
      ((activePointers.tapeExtension && activePointers.tapeExtension.size > 0) ||
        (activePointers.tapeHousing && activePointers.tapeHousing.size > 0))
    ) {
      if (isTapeZeroHandleEvent) {
        consumeTapeZeroHandleEvent(event);
      }
      return;
    }
    event.preventDefault();
    if (isTapeToolKey(toolKey)) {
      event.stopPropagation();
    }
    const entry = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      prevX: event.clientX,
      prevY: event.clientY
    };
    session.set(event.pointerId, entry);
    try {
      if (captureTarget) {
        captureTarget.setPointerCapture(event.pointerId);
      }
    } catch (_) {}
  }

  function handleInstrumentPointerMove(event, toolKey) {
    const session = getInstrumentPointerSession(toolKey);
    if (!session) {
      return;
    }
    const entry = session.get(event.pointerId);
    if (!entry) {
      return;
    }
    entry.prevX = entry.clientX;
    entry.prevY = entry.clientY;
    entry.clientX = event.clientX;
    entry.clientY = event.clientY;
    updateFromGesture(entry, toolKey);
  }

  function handleInstrumentPointerEnd(event, toolKey) {
    const session = getInstrumentPointerSession(toolKey);
    if (!session) {
      return;
    }
    const entry = session.get(event.pointerId);
    if (!entry) {
      return;
    }
    session.delete(event.pointerId);
    const element = isTapeToolKey(toolKey) ? tapeHousing : ruler;
    try {
      if (element) {
        element.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}
    if (session.size === 0 && appState.activeTool === toolKey) {
      applyTransformWithSnap({ allowSnap: true, persist: true });
    }
  }

  function beginTapeMoveSessionFromZeroHandle(event) {
    if (!event || appState.activeTool !== 'tape') {
      return;
    }
    const session = getInstrumentPointerSession('tape');
    if (!session || session.has(event.pointerId)) {
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    const entry = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      prevX: event.clientX,
      prevY: event.clientY
    };
    session.set(event.pointerId, entry);
  }

  function handleTapeHousingPointerDown(event, captureTarget) {
    if (!captureTarget || appState.activeTool !== 'tape') {
      return;
    }
    if (event.button && event.button !== 0) {
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    const moveSession = getInstrumentPointerSession('tape');
    if (moveSession && moveSession.size > 0) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const extensionSession = activePointers.tapeExtension;
    if (extensionSession && extensionSession.size > 0) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const session = activePointers.tapeHousing;
    if (session.size >= 1 && !session.has(event.pointerId)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const strapWidthCandidates = [
      Number.isFinite(tapeLengthState.totalPx) && tapeLengthState.totalPx > 0
        ? tapeLengthState.totalPx
        : null,
      tapeStrapTrack && Number.isFinite(tapeStrapTrack.offsetWidth) ? tapeStrapTrack.offsetWidth : null,
      tapeStrap && Number.isFinite(tapeStrap.offsetWidth) ? tapeStrap.offsetWidth : null
    ];
    for (const candidate of strapWidthCandidates) {
      if (Number.isFinite(candidate) && candidate > 0) {
        tapeLengthState.maxVisiblePx = candidate;
        tapeLengthState.totalPx = candidate;
        break;
      }
    }
    event.preventDefault();
    event.stopPropagation();
    const rotation = Number.isFinite(transformStates[TAPE_BETA_TOOL_KEY].rotation)
      ? transformStates[TAPE_BETA_TOOL_KEY].rotation
      : 0;
    const entry = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      prevX: event.clientX,
      prevY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startVisible: tapeLengthState.visiblePx,
      startTransformX: transformStates[TAPE_BETA_TOOL_KEY].x || 0,
      startTransformY: transformStates[TAPE_BETA_TOOL_KEY].y || 0,
      lastPersistedUnits: Number.isFinite(tapeLengthState.configuredUnits)
        ? tapeLengthState.configuredUnits
        : isTapeLengthInfinite(tapeLengthState.configuredUnits)
        ? 1
        : defaults.tapeMeasureLength,
      startPoint: { x: event.clientX, y: event.clientY },
      captureTarget,
      allowHandoff: true,
      handleType: 'housing'
    };
    const anchor = buildTapeHandleAnchorData('housing', captureTarget, event);
    if (anchor) {
      entry.anchor = anchor;
    }
    const freeMovement = buildTapeFreeMovementData('housing', captureTarget, event, anchor);
    if (freeMovement) {
      entry.freeMovement = freeMovement;
    }
    let axisUnit = getTapeDirectionFromEndpoints();
    if (!axisUnit && anchor && anchor.axisUnitWorld) {
      axisUnit = anchor.axisUnitWorld;
    }
    if (!axisUnit) {
      axisUnit = { x: Math.cos(rotation), y: Math.sin(rotation) };
    }
    const normalizedAxis = normalizeVector(axisUnit || { x: 0, y: 0 });
    if (normalizedAxis && (normalizedAxis.x !== 0 || normalizedAxis.y !== 0)) {
      entry.axisUnit = normalizedAxis;
    }
    session.set(event.pointerId, entry);
    try {
      captureTarget.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  function getTapeHousingStartPoint(entry) {
    if (!entry) {
      return null;
    }
    if (
      entry.startPoint &&
      Number.isFinite(entry.startPoint.x) &&
      Number.isFinite(entry.startPoint.y)
    ) {
      return entry.startPoint;
    }
    if (Number.isFinite(entry.startX) && Number.isFinite(entry.startY)) {
      return { x: entry.startX, y: entry.startY };
    }
    return null;
  }

  function disableTapeHousingHandoff(entry) {
    if (entry && entry.allowHandoff) {
      entry.allowHandoff = false;
    }
  }

  function performTapeHousingHandoff(event, entry) {
    if (!entry) {
      return;
    }
    disableTapeHousingHandoff(entry);
    const session = activePointers.tapeHousing;
    if (session && event.pointerId != null) {
      session.delete(event.pointerId);
    }
    const captureTarget = entry.captureTarget || tapeHousing;
    try {
      if (captureTarget && event.pointerId != null) {
        captureTarget.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}
    handleInstrumentPointerDown(event, 'tape', tapeHousing);
    const moveSession = getInstrumentPointerSession('tape');
    if (moveSession && event.pointerId != null) {
      const moveEntry = moveSession.get(event.pointerId);
      if (moveEntry) {
        const start = getTapeHousingStartPoint(entry);
        if (start) {
          moveEntry.prevX = start.x;
          moveEntry.prevY = start.y;
          moveEntry.clientX = start.x;
          moveEntry.clientY = start.y;
        }
      }
    }
    handleInstrumentPointerMove(event, 'tape');
  }

  function maybeHandoffTapeHousingPointer(event, entry) {
    if (!entry || !entry.allowHandoff) {
      return false;
    }
    const axis = entry.axisUnit;
    if (
      !axis ||
      !Number.isFinite(axis.x) ||
      !Number.isFinite(axis.y)
    ) {
      disableTapeHousingHandoff(entry);
      return false;
    }
    const start = getTapeHousingStartPoint(entry);
    if (!start) {
      disableTapeHousingHandoff(entry);
      return false;
    }
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
      return false;
    }
    const totalDistance = Math.hypot(deltaX, deltaY);
    const axial = Math.abs(deltaX * axis.x + deltaY * axis.y);
    const perpendicularSquared = Math.max(0, totalDistance * totalDistance - axial * axial);
    const perpendicular = Math.sqrt(perpendicularSquared);
    const dominanceThreshold = Math.max(axial, TAPE_HOUSING_HANDOFF_TOLERANCE_PX);
    if (perpendicular > dominanceThreshold) {
      performTapeHousingHandoff(event, entry);
      return true;
    }
    if (axial > TAPE_HOUSING_HANDOFF_TOLERANCE_PX) {
      disableTapeHousingHandoff(entry);
    }
    return false;
  }

  function handleTapeHousingPointerMove(event) {
    const session = activePointers.tapeHousing;
    const entry = session.get(event.pointerId);
    if (!entry || appState.activeTool !== 'tape') {
      return;
    }
    entry.prevX = entry.clientX;
    entry.prevY = entry.clientY;
    entry.clientX = event.clientX;
    entry.clientY = event.clientY;

    if (maybeHandoffTapeHousingPointer(event, entry)) {
      return;
    }

    if (entry.freeMovement) {
      const data = entry.freeMovement;
      const pointerCenter = {
        x: event.clientX - data.pointerOffset.x,
        y: event.clientY - data.pointerOffset.y
      };
      const anchorTarget = {
        x: pointerCenter.x + data.targetToAnchor.x,
        y: pointerCenter.y + data.targetToAnchor.y
      };
      const updated = updateTapeFreeMovement(entry, anchorTarget);
      if (updated) {
        disableTapeHousingHandoff(entry);
        applyTapeMeasureTransform();
        return;
      }
    }

    const anchor = entry.anchor;
    if (!anchor) {
      disableTapeHousingHandoff(entry);
      return;
    }

    const deltaX = entry.clientX - entry.startX;
    const deltaY = entry.clientY - entry.startY;
    const zeroStart = getTapeEndpointState('zero', anchor.zeroWorld);
    const housingStart = getTapeEndpointState('housing', anchor.housingWorld);
    if (!zeroStart || !housingStart) {
      disableTapeHousingHandoff(entry);
      applyTapeMeasureTransform();
      return;
    }
    let zeroWorld = { ...zeroStart };
    let housingWorld = {
      x: anchor.housingWorld.x + deltaX,
      y: anchor.housingWorld.y + deltaY
    };
    const vector = {
      x: zeroWorld.x - housingWorld.x,
      y: zeroWorld.y - housingWorld.y
    };
    let direction = normalizeVector(vector);
    if (!direction || (direction.x === 0 && direction.y === 0)) {
      direction = anchor.axisUnitWorld || getTapeDirectionFromEndpoints();
    }
    if (!direction || (direction.x === 0 && direction.y === 0)) {
      const rotation = Number.isFinite(transformStates[TAPE_BETA_TOOL_KEY].rotation)
        ? transformStates[TAPE_BETA_TOOL_KEY].rotation
        : 0;
      direction = { x: Math.cos(rotation), y: Math.sin(rotation) };
    }
    const distance = Math.hypot(vector.x, vector.y);
    const visible = resolveVisibleFromFreeMovement(entry, Number.isFinite(distance) ? distance : 0);
    housingWorld = {
      x: zeroWorld.x - direction.x * visible,
      y: zeroWorld.y - direction.y * visible
    };
    entry.axisUnit = direction;
    setTapeEndpointsState(housingWorld, zeroWorld);
    applyTapeTransformForEndpoints(housingWorld, zeroWorld, direction, anchor);

    disableTapeHousingHandoff(entry);
    applyTapeMeasureTransform();
  }

  function handleTapeHousingPointerEnd(event) {
    const session = activePointers.tapeHousing;
    const entry = session.get(event.pointerId);
    if (!entry) {
      return;
    }
    session.delete(event.pointerId);
    try {
      if (tapeHousing) {
        tapeHousing.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}
    if (session.size === 0 && isTapeToolKey(appState.activeTool)) {
      persistTapeMeasureState();
    }
  }

  function handleTapeExtensionPointerDown(event, captureTarget) {
    const isZeroHandleEvent =
      captureTarget === tapeZeroHandle || isEventFromTapeZeroHandle(event);
    if (!captureTarget || appState.activeTool !== 'tape') {
      return;
    }
    if (event.button && event.button !== 0) {
      return;
    }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    const moveSession = getInstrumentPointerSession('tape');
    if (isZeroHandleEvent) {
      beginTapeMoveSessionFromZeroHandle(event);
      consumeTapeZeroHandleEvent(event);
    }
    if (moveSession && moveSession.size > 0 && !moveSession.has(event.pointerId)) {
      if (isZeroHandleEvent) {
        consumeTapeZeroHandleEvent(event);
      }
      return;
    }
    const session = activePointers.tapeExtension;
    if (session.size >= 1 && !session.has(event.pointerId)) {
      if (isZeroHandleEvent) {
        consumeTapeZeroHandleEvent(event);
      }
      return;
    }
    const strapWidthCandidates = [
      Number.isFinite(tapeLengthState.totalPx) && tapeLengthState.totalPx > 0
        ? tapeLengthState.totalPx
        : null,
      tapeStrapTrack && Number.isFinite(tapeStrapTrack.offsetWidth) ? tapeStrapTrack.offsetWidth : null,
      tapeStrap && Number.isFinite(tapeStrap.offsetWidth) ? tapeStrap.offsetWidth : null
    ];
    for (const candidate of strapWidthCandidates) {
      if (Number.isFinite(candidate) && candidate > 0) {
        tapeLengthState.maxVisiblePx = candidate;
        tapeLengthState.totalPx = candidate;
        break;
      }
    }
    if (!isZeroHandleEvent) {
      event.preventDefault();
      event.stopPropagation();
    }
    const handleType = captureTarget === tapeZeroHandle ? 'zero' : 'extension';
    const entry = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      prevX: event.clientX,
      prevY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      startVisible: tapeLengthState.visiblePx,
      startTransformX: transformStates[TAPE_BETA_TOOL_KEY].x || 0,
      startTransformY: transformStates[TAPE_BETA_TOOL_KEY].y || 0,
      lastPersistedUnits: Number.isFinite(tapeLengthState.configuredUnits)
        ? tapeLengthState.configuredUnits
        : isTapeLengthInfinite(tapeLengthState.configuredUnits)
        ? 1
        : defaults.tapeMeasureLength,
      captureTarget,
      handleType
    };
    const anchor = buildTapeHandleAnchorData(handleType, captureTarget, event);
    if (anchor) {
      entry.anchor = anchor;
    }
    if (handleType === 'zero') {
      const freeMovement = buildTapeFreeMovementData(handleType, captureTarget, event, anchor);
      if (freeMovement) {
        entry.freeMovement = freeMovement;
      }
    }
    session.set(event.pointerId, entry);
    try {
      captureTarget.setPointerCapture(event.pointerId);
    } catch (_) {}
  }

  function handleTapeExtensionPointerMove(event) {
    const session = activePointers.tapeExtension;
    const entry = session.get(event.pointerId);
    if (!entry || appState.activeTool !== 'tape') {
      return;
    }
    entry.prevX = entry.clientX;
    entry.prevY = entry.clientY;
    entry.clientX = event.clientX;
    entry.clientY = event.clientY;

    if (entry.freeMovement) {
      const data = entry.freeMovement;
      const pointerCenter = {
        x: event.clientX - data.pointerOffset.x,
        y: event.clientY - data.pointerOffset.y
      };
      const anchorTarget = {
        x: pointerCenter.x + data.targetToAnchor.x,
        y: pointerCenter.y + data.targetToAnchor.y
      };
      const updated = updateTapeFreeMovement(entry, anchorTarget);
      if (updated) {
        applyTapeMeasureTransform();
        return;
      }
    }

    const anchor = entry.anchor;
    if (!anchor) {
      return;
    }

    const deltaX = entry.clientX - entry.startX;
    const deltaY = entry.clientY - entry.startY;
    const housingStart = getTapeEndpointState('housing', anchor.housingWorld);
    const zeroStart = getTapeEndpointState('zero', anchor.zeroWorld);
    if (!housingStart || !zeroStart) {
      applyTapeMeasureTransform();
      return;
    }
    let housingWorld = { ...housingStart };
    let zeroWorld = {
      x: anchor.zeroWorld.x + deltaX,
      y: anchor.zeroWorld.y + deltaY
    };
    const vector = {
      x: zeroWorld.x - housingWorld.x,
      y: zeroWorld.y - housingWorld.y
    };
    let direction = normalizeVector(vector);
    if (!direction || (direction.x === 0 && direction.y === 0)) {
      direction = anchor.axisUnitWorld || getTapeDirectionFromEndpoints();
    }
    if (!direction || (direction.x === 0 && direction.y === 0)) {
      const rotation = Number.isFinite(transformStates[TAPE_BETA_TOOL_KEY].rotation)
        ? transformStates[TAPE_BETA_TOOL_KEY].rotation
        : 0;
      direction = { x: Math.cos(rotation), y: Math.sin(rotation) };
    }
    const distance = Math.hypot(vector.x, vector.y);
    const visible = resolveVisibleFromFreeMovement(entry, Number.isFinite(distance) ? distance : 0);
    zeroWorld = {
      x: housingWorld.x + direction.x * visible,
      y: housingWorld.y + direction.y * visible
    };
    setTapeEndpointsState(housingWorld, zeroWorld);
    applyTapeTransformForEndpoints(housingWorld, zeroWorld, direction, anchor);

    applyTapeMeasureTransform();
  }

  function handleTapeExtensionPointerEnd(event) {
    const session = activePointers.tapeExtension;
    const entry = session.get(event.pointerId);
    if (!entry) {
      return;
    }
    session.delete(event.pointerId);
    try {
      if (tapeStrap) {
        tapeStrap.releasePointerCapture(event.pointerId);
      }
    } catch (_) {}
    if (session.size === 0 && isTapeToolKey(appState.activeTool)) {
      persistTapeMeasureState();
    }
  }

  function applyTransform() {
    if (isTapeToolKey(appState.activeTool)) {
      applyTapeMeasureTransform();
      return;
    }
    if (isSegmentToolKey(appState.activeTool)) {
      applySegmentTransform();
      return;
    }
    const element = getActiveToolElement();
    if (!element) {
      return;
    }
    element.style.transform = `translate3d(${transformState.x}px, ${transformState.y}px, 0) rotate(${transformState.rotation}rad)`;
  }

  function applyTransformWithSnap({ allowSnap = true, persist = false } = {}) {
    if (appState.settings) {
      if (isSegmentToolKey(appState.activeTool)) {
        enforceSegmentDirectionLockForSettings(appState.settings);
      } else {
        enforceDirectionLockForActiveTool();
      }
    }
    if (isSegmentToolKey(appState.activeTool)) {
      applySegmentTransform();
      if (persist && !suspendTransformPersistence) {
        persistSegmentState();
      }
      return;
    }
    if (allowSnap && appState.settings && appState.settings.gridSnapEnabled) {
      snapTranslationToGrid();
    }
    applyTransform();
    if (appState.settings && !isSegmentToolKey(appState.activeTool)) {
      updateFreeRotationMemoryForTool(appState.activeTool);
    }
    if (persist && !suspendTransformPersistence) {
      if (isTapeToolKey(appState.activeTool)) {
        persistTapeMeasureState();
      } else {
        persistTransformState();
      }
    }
  }

  function adjustTapeTransformForLengthChange(deltaLength) {
    if (!Number.isFinite(deltaLength) || Math.abs(deltaLength) < 0.001) {
      return;
    }
    const hasActiveExtension = activePointers.tapeExtension && activePointers.tapeExtension.size > 0;
    const hasActiveHousing = activePointers.tapeHousing && activePointers.tapeHousing.size > 0;
    if (hasActiveExtension || hasActiveHousing) {
      return;
    }
    const state = transformStates[TAPE_BETA_TOOL_KEY];
    if (!state) {
      return;
    }
    const rotation = Number.isFinite(state.rotation) ? state.rotation : 0;
    const offsetX = Number.isFinite(state.x) ? state.x : 0;
    const offsetY = Number.isFinite(state.y) ? state.y : 0;
    const shiftX = deltaLength * Math.cos(rotation);
    const shiftY = deltaLength * Math.sin(rotation);
    state.x = offsetX - shiftX;
    state.y = offsetY - shiftY;
  }

  function applyTapeMeasureTransform() {
    if (!tapeMeasure) {
      return;
    }
    const state = transformStates[TAPE_BETA_TOOL_KEY];
    if (state) {
      tapeMeasure.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) rotate(${state.rotation}rad)`;
    }
    const minVisible = Math.max(0, tapeLengthState.minVisiblePx);
    const maxVisible = tapeLengthState.maxVisiblePx > 0 ? tapeLengthState.maxVisiblePx : Infinity;
    const visible = Math.min(Math.max(tapeLengthState.visiblePx, minVisible), maxVisible);
    tapeLengthState.visiblePx = visible;
    tapeMeasure.style.setProperty('--tape-strap-visible', `${visible}px`);
    const totalWidth = Number.isFinite(tapeLengthState.totalPx) ? tapeLengthState.totalPx : 0;
    const strapOffsetBase = totalWidth > 0 ? totalWidth - visible : 0;
    const tapeHousingShift = resolveTapeHousingShiftPx();
    const strapOffset = Math.max(0, strapOffsetBase - tapeHousingShift);
    tapeMeasure.style.setProperty('--tape-strap-offset', `${strapOffset}px`);
    const effectiveUnits = Number.isFinite(tapeLengthState.unitSpacing) && tapeLengthState.unitSpacing > 0
      ? visible / tapeLengthState.unitSpacing
      : 0;
    tapeLengthState.units = effectiveUnits;
    if (tapeMeasure) {
      tapeMeasure.setAttribute('data-visible-length', String(roundForDisplay(effectiveUnits)));
    }
    if (isTapeToolKey(appState.activeTool) && appState.settings) {
      updateAccessibility(appState.settings);
    }
    if (isTapeToolKey(appState.activeTool)) {
      updateTapeZeroOffset();
    }
  }

  function applySegmentTransform(settings = appState.settings) {
    renderSegment(settings);
  }

  function persistActiveInstrumentState() {
    if (suspendTransformPersistence) {
      return;
    }
    if (isTapeToolKey(appState.activeTool)) {
      persistTapeMeasureState();
    } else if (isSegmentToolKey(appState.activeTool)) {
      persistSegmentState();
    } else {
      persistTransformState();
    }
  }

  function persistTransformState() {
    persistTransformStateForTool('ruler');
  }

  function persistTapeMeasureState() {
    persistTransformStateForTool(TAPE_BETA_TOOL_KEY);
  }

  function persistTapeMeasureLength(lengthValue, { updateSettingsState = true, updateAppearance = true } = {}) {
    if (suspendTransformPersistence) {
      return;
    }
    const sanitized = sanitizeLength(lengthValue, defaults.tapeMeasureLength, { allowInfinite: true });
    if (!isValidTapeMeasureLength(sanitized)) {
      return;
    }
    const previousConfiguredUnits = tapeLengthState.configuredUnits;
    const lengthChanged = !areTapeMeasureLengthsEqual(sanitized, previousConfiguredUnits);
    if (updateSettingsState && appState.settings) {
      if (!areTapeMeasureLengthsEqual(appState.settings.tapeMeasureLength, sanitized)) {
        appState.settings = { ...appState.settings, tapeMeasureLength: sanitized };
      }
    }
    storeTapeMeasureLength(sanitized);
    tapeLengthState.configuredUnits = sanitized;
    if (updateAppearance && appState.settings) {
      const metrics = resolveScaleMetrics(appState.settings);
      applyTapeMeasureAppearance(appState.settings, metrics);
    } else if (!updateAppearance) {
      const spacing = Number.isFinite(tapeLengthState.unitSpacing) && tapeLengthState.unitSpacing > 0
        ? tapeLengthState.unitSpacing
        : 0;
      if (spacing > 0 && !isTapeLengthInfinite(sanitized)) {
        const targetPx = sanitized * spacing;
        if (Number.isFinite(targetPx) && targetPx > 0) {
          const currentTotal = Number.isFinite(tapeLengthState.totalPx) && tapeLengthState.totalPx > 0
            ? tapeLengthState.totalPx
            : 0;
          const nextTotal = Math.max(currentTotal, targetPx);
          tapeLengthState.totalPx = nextTotal;
          tapeLengthState.maxVisiblePx = Math.max(
            Number.isFinite(tapeLengthState.maxVisiblePx) && tapeLengthState.maxVisiblePx > 0
              ? tapeLengthState.maxVisiblePx
              : 0,
            nextTotal
          );
        }
        const maxVisible = Number.isFinite(tapeLengthState.maxVisiblePx) && tapeLengthState.maxVisiblePx > 0
          ? tapeLengthState.maxVisiblePx
          : Number.isFinite(tapeLengthState.totalPx) && tapeLengthState.totalPx > 0
          ? tapeLengthState.totalPx
          : targetPx;
        const clamped = Math.min(
          Math.max(targetPx, tapeLengthState.minVisiblePx),
          maxVisible
        );
        tapeLengthState.visiblePx = clamped;
        applyTapeMeasureTransform();
      } else if (isTapeLengthInfinite(sanitized)) {
        applyTapeMeasureTransform();
      }
    }
    if (updateSettingsState && lengthChanged && !appState.syncingInputs) {
      syncInputs(appState.settings);
    }
  }

  function persistTransformStateForTool(toolKey) {
    const state = transformStates[toolKey];
    if (!state) {
      return;
    }
    const snapshot = {
      x: Number.isFinite(state.x) ? state.x : 0,
      y: Number.isFinite(state.y) ? state.y : 0,
      rotation: Number.isFinite(state.rotation) ? state.rotation : 0
    };
    const sanitized = sanitizeRulerTransform(snapshot, null);
    if (!sanitized) {
      return;
    }
    if (appState.settings) {
      const key = isTapeToolKey(toolKey) ? 'tapeMeasureTransform' : 'rulerTransform';
      if (!areRulerTransformsEqual(appState.settings[key], sanitized)) {
        appState.settings = { ...appState.settings, [key]: { ...sanitized } };
      } else if (!appState.settings[key]) {
        appState.settings[key] = { ...sanitized };
      }
    }
    if (isTapeToolKey(toolKey)) {
      storeTapeMeasureState(sanitized);
    } else {
      storeRulerTransform(sanitized);
    }
  }

  function storeRulerTransform(transform) {
    if (!transform || typeof transform !== 'object') {
      return;
    }
    refreshConfigContainers();
    if (configContainers.measurement) {
      configContainers.measurement.rulerTransform = { ...transform };
    }
    if (configContainers.root && configContainers.root !== configContainers.measurement) {
      delete configContainers.root.rulerTransform;
    }
    if (
      configContainers.measurementGlobal &&
      configContainers.measurementGlobal !== configContainers.measurement
    ) {
      delete configContainers.measurementGlobal.rulerTransform;
    }
  }

  function storeTapeMeasureState(transform) {
    if (!transform || typeof transform !== 'object') {
      return;
    }
    refreshConfigContainers();
    if (configContainers.measurement) {
      configContainers.measurement.tapeMeasureTransform = { ...transform };
    }
    if (configContainers.root && configContainers.root !== configContainers.measurement) {
      delete configContainers.root.tapeMeasureTransform;
    }
    if (
      configContainers.measurementGlobal &&
      configContainers.measurementGlobal !== configContainers.measurement
    ) {
      delete configContainers.measurementGlobal.tapeMeasureTransform;
    }
  }

  function storeTapeMeasureLength(lengthValue) {
    if (isTapeLengthInfinite(lengthValue)) {
      refreshConfigContainers();
      if (configContainers.measurement) {
        configContainers.measurement.tapeMeasureLength = TAPE_LENGTH_INFINITE;
      }
      if (configContainers.root && configContainers.root !== configContainers.measurement) {
        delete configContainers.root.tapeMeasureLength;
      }
      if (
        configContainers.measurementGlobal &&
        configContainers.measurementGlobal !== configContainers.measurement
      ) {
        delete configContainers.measurementGlobal.tapeMeasureLength;
      }
      return;
    }
    if (!Number.isFinite(lengthValue)) {
      return;
    }
    refreshConfigContainers();
    if (configContainers.measurement) {
      configContainers.measurement.tapeMeasureLength = lengthValue;
    }
    if (configContainers.root && configContainers.root !== configContainers.measurement) {
      delete configContainers.root.tapeMeasureLength;
    }
    if (
      configContainers.measurementGlobal &&
      configContainers.measurementGlobal !== configContainers.measurement
    ) {
      delete configContainers.measurementGlobal.tapeMeasureLength;
    }
  }

  function persistBoardPanState() {
    if (suspendTransformPersistence) {
      return;
    }
    const snapshot = sanitizeBoardPanTransform(boardPanTransform, defaults.boardPanTransform);
    if (!snapshot) {
      return;
    }
    if (appState.settings) {
      if (!areBoardPanTransformsEqual(appState.settings.boardPanTransform, snapshot)) {
        appState.settings = { ...appState.settings, boardPanTransform: { ...snapshot } };
      } else if (!appState.settings.boardPanTransform) {
        appState.settings.boardPanTransform = { ...snapshot };
      }
    }
    storeBoardPanTransform(snapshot);
  }

  function storeBoardPanTransform(pan) {
    if (!pan || typeof pan !== 'object') {
      return;
    }
    refreshConfigContainers();
    if (configContainers.measurement) {
      configContainers.measurement.boardPanTransform = { ...pan };
    }
    if (configContainers.root && configContainers.root !== configContainers.measurement) {
      delete configContainers.root.boardPanTransform;
      delete configContainers.root.boardPan;
    }
    if (
      configContainers.measurementGlobal &&
      configContainers.measurementGlobal !== configContainers.measurement
    ) {
      delete configContainers.measurementGlobal.boardPanTransform;
      delete configContainers.measurementGlobal.boardPan;
    }
  }

  function snapTranslationToGrid() {
    if (!boardRect) {
      return;
    }
    const gridColumns = sanitizeGridCount(
      appState.settings && appState.settings.gridColumns,
      defaults.gridColumns
    );
    const gridRows = sanitizeGridCount(
      appState.settings && appState.settings.gridRows,
      defaults.gridRows
    );
    const cellWidth = boardRect.width / gridColumns;
    const cellHeight = boardRect.height / gridRows;
    if (!Number.isFinite(cellWidth) || !Number.isFinite(cellHeight) || cellWidth <= 0 || cellHeight <= 0) {
      return;
    }

    const originX = baseSize.width / 2;
    const originY = baseSize.height / 2;
    if (!Number.isFinite(originX) || !Number.isFinite(originY)) {
      return;
    }

    const offsetX = zeroOffset.x - originX;
    const offsetY = zeroOffset.y - originY;

    const sin = Math.sin(transformState.rotation);
    const cos = Math.cos(transformState.rotation);
    const rotatedOffsetX = offsetX * cos - offsetY * sin;
    const rotatedOffsetY = offsetX * sin + offsetY * cos;

    const panX = getBoardPanOffset('x');
    const panY = getBoardPanOffset('y');

    const zeroX = transformState.x + originX + rotatedOffsetX;
    const zeroY = transformState.y + originY + rotatedOffsetY;

    const adjustedZeroX = zeroX - panX;
    const adjustedZeroY = zeroY - panY;

    const snappedZeroX = Math.round(adjustedZeroX / cellWidth) * cellWidth + panX;
    const snappedZeroY = Math.round(adjustedZeroY / cellHeight) * cellHeight + panY;

    const dx = snappedZeroX - zeroX;
    const dy = snappedZeroY - zeroY;
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      transformState.x += dx;
      transformState.y += dy;
    }
  }

  function centerRuler() {
    const element = getActiveToolElement();
    if (!element) {
      return;
    }
    boardRect = board.getBoundingClientRect();
    baseSize.width = element.offsetWidth;
    baseSize.height = element.offsetHeight;
    const offsetX = (boardRect.width - baseSize.width) / 2;
    const offsetY = Math.max(boardRect.height - baseSize.height - 32, 16);
    transformState.x = offsetX;
    transformState.y = offsetY;
    transformState.rotation = 0;
    applyTransformWithSnap({ persist: true });
  }

  function normalizeAngle(angle) {
    const twoPi = Math.PI * 2;
    let value = angle;
    while (value <= -Math.PI) value += twoPi;
    while (value > Math.PI) value -= twoPi;
    return value;
  }

  function resolveDirectionLockMode(settings) {
    if (!settings) {
      return 'none';
    }
    return sanitizeMeasurementDirectionLock(
      settings.measurementDirectionLock,
      defaults.measurementDirectionLock
    );
  }

  function resolveDirectionLockAngle(settings, mode = resolveDirectionLockMode(settings)) {
    if (!settings) {
      return null;
    }
    if (mode === 'horizontal') {
      return 0;
    }
    if (mode === 'vertical') {
      return Math.PI / 2;
    }
    if (mode === 'angle') {
      return sanitizeMeasurementDirectionAngle(
        settings.measurementDirectionAngle,
        defaults.measurementDirectionAngle
      );
    }
    return null;
  }

  function rememberFreeRotationForTools(toolKeys) {
    for (const key of toolKeys) {
      const state = transformStates[key];
      if (!state) {
        continue;
      }
      if (Number.isFinite(state.rotation)) {
        appState.directionLockMemory[key] = state.rotation;
      }
    }
  }

  function persistSegmentState() {
    if (suspendTransformPersistence || !hasSegment) {
      return;
    }
    const snapshot = cloneSegmentPoints(segmentState);
    if (appState.settings) {
      if (!areSegmentPointsEqual(appState.settings.segmentPoints, snapshot)) {
        appState.settings = { ...appState.settings, segmentPoints: cloneSegmentPoints(snapshot) };
      } else if (!appState.settings.segmentPoints) {
        appState.settings.segmentPoints = cloneSegmentPoints(snapshot);
      }
    }
    storeSegmentState(snapshot);
  }

  function storeSegmentState(points) {
    if (!points || typeof points !== 'object') {
      return;
    }
    refreshConfigContainers();
    const snapshot = cloneSegmentPoints(points);
    if (configContainers.measurement) {
      configContainers.measurement.segmentPoints = cloneSegmentPoints(snapshot);
    }
    if (configContainers.root && configContainers.root !== configContainers.measurement) {
      delete configContainers.root.segmentPoints;
    }
    if (
      configContainers.measurementGlobal &&
      configContainers.measurementGlobal !== configContainers.measurement
    ) {
      delete configContainers.measurementGlobal.segmentPoints;
    }
  }

  function restoreFreeRotationForTools(toolKeys) {
    for (const key of toolKeys) {
      const state = transformStates[key];
      if (!state) {
        continue;
      }
      const stored = appState.directionLockMemory[key];
      if (Number.isFinite(stored)) {
        state.rotation = stored;
      }
    }
  }

  function setLockedRotationForTools(toolKeys, angle) {
    if (!Number.isFinite(angle)) {
      return;
    }
    const normalized = normalizeAngle(angle);
    for (const key of toolKeys) {
      const state = transformStates[key];
      if (!state) {
        continue;
      }
      state.rotation = normalized;
    }
  }

  function applyTransformsForTools(toolKeys) {
    for (const key of toolKeys) {
      if (!key) {
        continue;
      }
      applyToolTransform(key);
    }
  }

  function applyDirectionLockFromSettings(settings) {
    const mode = resolveDirectionLockMode(settings);
    const angle = resolveDirectionLockAngle(settings, mode);
    const previousMode = appState.currentDirectionLockMode;
    const previousAngle = appState.currentDirectionLockAngle;
    const normalizedAngle = Number.isFinite(angle) ? normalizeAngle(angle) : null;
    const normalizedPrevious = Number.isFinite(previousAngle) ? normalizeAngle(previousAngle) : null;
    const tools = ['ruler', TAPE_BETA_TOOL_KEY];
    if (mode === 'none') {
      rememberFreeRotationForTools(tools);
      if (previousMode !== 'none') {
        restoreFreeRotationForTools(tools);
        applyTransformsForTools(tools);
        if (hasSegment) {
          renderSegment(appState.settings);
        }
      }
      appState.currentDirectionLockMode = 'none';
      appState.currentDirectionLockAngle = null;
      if (board) {
        board.setAttribute('data-direction-lock', 'none');
      }
      return;
    }

    if (previousMode === 'none') {
      rememberFreeRotationForTools(tools);
    }

    const angleChanged =
      normalizedAngle == null
        ? normalizedPrevious != null
        : normalizedPrevious == null || !areAnglesApproximatelyEqual(normalizedAngle, normalizedPrevious);
    if (mode !== previousMode || angleChanged) {
      if (normalizedAngle != null) {
        setLockedRotationForTools(tools, normalizedAngle);
      }
      applyTransformsForTools(tools);
      if (hasSegment) {
        if (normalizedAngle != null) {
          applySegmentDirectionLock(normalizedAngle);
        } else {
          renderSegment(appState.settings);
        }
      }
    }

    appState.currentDirectionLockMode = mode;
    appState.currentDirectionLockAngle = normalizedAngle;
    if (board) {
      board.setAttribute('data-direction-lock', mode);
    }
  }

  function enforceDirectionLockForActiveTool() {
    if (!appState.settings) {
      return;
    }
    const mode = resolveDirectionLockMode(appState.settings);
    if (mode === 'none') {
      return;
    }
    const angle = resolveDirectionLockAngle(appState.settings, mode);
    if (!Number.isFinite(angle)) {
      return;
    }
    if (isSegmentToolKey(appState.activeTool)) {
      applySegmentDirectionLock(angle);
      return;
    }
    const state = transformStates[appState.activeTool];
    if (!state) {
      return;
    }
    state.rotation = normalizeAngle(angle);
  }

  function updateFreeRotationMemoryForTool(toolKey) {
    if (!toolKey || !appState.settings) {
      return;
    }
    if (resolveDirectionLockMode(appState.settings) !== 'none') {
      return;
    }
    if (isSegmentToolKey(toolKey)) {
      return;
    }
    const state = transformStates[toolKey];
    if (!state) {
      return;
    }
    if (Number.isFinite(state.rotation)) {
      appState.directionLockMemory[toolKey] = state.rotation;
    }
  }

  function getRotationForTool(toolKey) {
    const state = transformStates[toolKey];
    if (!state) {
      return 0;
    }
    return Number.isFinite(state.rotation) ? state.rotation : 0;
  }

  function updateFromSinglePointer(pointerEntry) {
    const dx = pointerEntry.clientX - pointerEntry.prevX;
    const dy = pointerEntry.clientY - pointerEntry.prevY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return;
    }
    transformState.x += dx;
    transformState.y += dy;
    applyTransformWithSnap({ allowSnap: false, persist: false });
  }

  function updateBoardPanFromPointer(pointerEntry) {
    const dx = pointerEntry.clientX - pointerEntry.prevX;
    const dy = pointerEntry.clientY - pointerEntry.prevY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
      return;
    }
    boardPanTransform.x += dx;
    boardPanTransform.y += dy;
    applyBoardPanTransform();
  }

  function updateFromGesture(currentEntry, toolKey = appState.activeTool) {
    const session = getInstrumentPointerSession(toolKey);
    if (!session) {
      return;
    }
    const pointers = Array.from(session.values());
    if (pointers.length === 0) {
      return;
    }
    if (pointers.length === 1) {
      updateFromSinglePointer(currentEntry);
      return;
    }

    const [p1, p2] = pointers;
    const prevPoints = [
      { x: p1 === currentEntry ? currentEntry.prevX : p1.clientX, y: p1 === currentEntry ? currentEntry.prevY : p1.clientY },
      { x: p2 === currentEntry ? currentEntry.prevX : p2.clientX, y: p2 === currentEntry ? currentEntry.prevY : p2.clientY }
    ];
    const nextPoints = [
      { x: p1.clientX, y: p1.clientY },
      { x: p2.clientX, y: p2.clientY }
    ];

    const prevCenter = {
      x: (prevPoints[0].x + prevPoints[1].x) / 2,
      y: (prevPoints[0].y + prevPoints[1].y) / 2
    };
    const nextCenter = {
      x: (nextPoints[0].x + nextPoints[1].x) / 2,
      y: (nextPoints[0].y + nextPoints[1].y) / 2
    };

    const prevAngle = Math.atan2(prevPoints[1].y - prevPoints[0].y, prevPoints[1].x - prevPoints[0].x);
    const nextAngle = Math.atan2(nextPoints[1].y - nextPoints[0].y, nextPoints[1].x - nextPoints[0].x);

    transformState.x += nextCenter.x - prevCenter.x;
    transformState.y += nextCenter.y - prevCenter.y;
    const lockMode = resolveDirectionLockMode(appState.settings);
    if (lockMode === 'none') {
      transformState.rotation = normalizeAngle(
        transformState.rotation + normalizeAngle(nextAngle - prevAngle)
      );
      updateFreeRotationMemoryForTool(toolKey);
    } else {
      const lockedAngle = resolveDirectionLockAngle(appState.settings, lockMode);
      if (Number.isFinite(lockedAngle)) {
        transformState.rotation = normalizeAngle(lockedAngle);
      }
    }
    applyTransformWithSnap({ allowSnap: false, persist: false });
  }

  function handleResize() {
    const prevRect = boardRect;
    boardRect = board.getBoundingClientRect();
    const widthChanged = !prevRect || Math.abs(boardRect.width - prevRect.width) > 1;
    const heightChanged = !prevRect || Math.abs(boardRect.height - prevRect.height) > 1;
    if (appState.settings) {
      const metrics = resolveScaleMetrics(appState.settings);
      applyFigureScale(appState.settings, metrics);
      applyTapeMeasureAppearance(appState.settings, metrics);
    }
    updateBaseSize();

    if (!hasAnyActivePointers() && (widthChanged || heightChanged)) {
      if (isSegmentToolKey(appState.activeTool)) {
        renderSegment(appState.settings);
      } else {
        centerRuler();
      }
      return;
    }

    const maxX = boardRect.width;
    const maxY = boardRect.height;
    transformState.x = Math.min(Math.max(transformState.x, -maxX), maxX);
    transformState.y = Math.min(Math.max(transformState.y, -maxY), maxY);
    const allowSnap = !hasAnyActivePointers();
    applyTransformWithSnap({ allowSnap, persist: allowSnap });
    if (hasSegment) {
      renderSegment(appState.settings);
    }
  }

  function handleExamplesLoaded() {
    refreshConfigContainers();
    syncSettingsFromConfig();
  }

  function syncSettingsFromConfig() {
    refreshConfigContainers();
    const previousSettings = appState.settings;
    const nextSettings = normalizeSettings();
    if (!nextSettings) {
      return;
    }
    const activeToolKey = sanitizeActiveTool(nextSettings && nextSettings.activeTool, appState.activeTool);
    const nextTransform = sanitizeRulerTransform(
      isTapeToolKey(activeToolKey)
        ? nextSettings.tapeMeasureTransform
        : nextSettings.rulerTransform,
      null
    );
    const shouldUpdate = !previousSettings || !areSettingsEqual(nextSettings, previousSettings);
    appState.settings = nextSettings;
    appState.measurementTargetAuto = shouldUseAutoMeasurementTarget(nextSettings);
    if (!shouldUpdate) {
      return;
    }
    suspendTransformPersistence = true;
    try {
      applySettings(nextSettings);
      syncInputs(nextSettings);
    } finally {
      suspendTransformPersistence = false;
    }
    if (nextTransform) {
      applyInstrumentTransform(nextTransform, { allowSnap: false, persist: false }, activeToolKey);
      persistActiveInstrumentState();
    } else {
      centerRuler();
    }
  }

  function applyInstrumentTransform(transform, options = {}, toolKey = appState.activeTool) {
    const sanitized = sanitizeRulerTransform(transform, null);
    if (!sanitized) {
      return;
    }
    const targetState = transformStates[toolKey];
    if (!targetState) {
      return;
    }
    targetState.x = sanitized.x;
    targetState.y = sanitized.y;
    targetState.rotation = sanitized.rotation;
    updateFreeRotationMemoryForTool(toolKey);
    if (toolKey === appState.activeTool) {
      transformState = targetState;
      const allowSnap = Object.prototype.hasOwnProperty.call(options, 'allowSnap')
        ? options.allowSnap
        : false;
      const persist = Object.prototype.hasOwnProperty.call(options, 'persist')
        ? options.persist
        : false;
      applyTransformWithSnap({ allowSnap, persist });
    } else {
      applyToolTransform(toolKey);
      const shouldPersist =
        Object.prototype.hasOwnProperty.call(options, 'persist') ? options.persist : false;
      if (shouldPersist && !suspendTransformPersistence) {
        if (isTapeToolKey(toolKey)) {
          persistTapeMeasureState();
        } else if (toolKey === 'ruler') {
          persistTransformState();
        }
      }
    }
  }

  function applyRulerTransform(transform, options = {}) {
    applyInstrumentTransform(transform, options, 'ruler');
  }

  function svgToString(svgElement) {
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svgElement);
  }

  function updateFigureSelectorsFromSettings(settings) {
    if (!inputs.figureCategory || !inputs.figurePreset) {
      return;
    }
    const preset = resolvePresetFromSettings(settings);
    const desiredCategoryId = preset ? preset.categoryId : CUSTOM_CATEGORY_ID;
    const { selectedId } = figurePicker.renderCategorySelect(inputs.figureCategory, desiredCategoryId);
    figurePicker.renderFigureSelect(inputs.figurePreset, selectedId, preset ? preset.id : CUSTOM_FIGURE_ID, {
      disableWhenEmpty: false
    });
  }

  function applyFigurePreset(presetId) {
    if (!presetId) {
      return;
    }
    const preset = figureData.byId.get(presetId);
    if (!preset || preset.custom) {
      return;
    }
    updateSettings({
      figureName: preset.name,
      figureImage: preset.image,
      figureSummary: preset.summary || '',
      figureScaleLabel: preset.scaleLabel || ''
    });
  }

  function resolvePresetFromSettings(settings) {
    if (!settings) {
      return null;
    }
    if (settings.figureImage && figureData.byImage.has(settings.figureImage)) {
      return figureData.byImage.get(settings.figureImage);
    }
    const normalizedName = normalizeComparisonText(settings.figureName);
    if (!normalizedName) {
      return null;
    }
    for (const figure of figureData.byId.values()) {
      if (figure.custom) {
        continue;
      }
      if (normalizeComparisonText(figure.name) === normalizedName) {
        return figure;
      }
    }
    return null;
  }

  function buildExportMetadata(settings) {
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const figureNameRaw = typeof settings.figureName === 'string' ? settings.figureName.trim() : '';
    const figureName = figureNameRaw || 'Figur';
    const unitLabel = settings.unitLabel ? settings.unitLabel.trim() : '';
    const activeToolKey = sanitizeActiveTool(settings && settings.activeTool, appState.activeTool);
    const toolInfo = getToolDisplayInfo(activeToolKey);
    const toolTitle = toolInfo.title;
    const valueMultiplier = resolveRulerValueMultiplier(settings);
    const effectiveLengthRaw = isTapeToolKey(activeToolKey)
      ? getVisibleTapeMeasureLength(settings)
      : getEffectiveToolLength(settings, activeToolKey);
    const effectiveLength = roundForDisplay(effectiveLengthRaw);
    const slugBaseParts = [
      'måling',
      figureName,
      toolTitle,
      String(effectiveLength) + (unitLabel ? unitLabel : '')
    ];
    const slugBase = slugBaseParts.join(' ').trim() || 'måling';
    const slug = helper && typeof helper.slugify === 'function'
      ? helper.slugify(slugBase, 'maling')
      : slugBase
          .toLowerCase()
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-+|-+$/g, '') || 'maling';
    const baseName = slug || 'maling';
    const lengthText = formatNumber(effectiveLength);
    const unitSuffixValue = resolveUnitSuffix(unitLabel);
    const unitSuffix = unitSuffixValue ? ` ${unitSuffixValue}` : '';
    const target = settings.measurementTarget || buildDefaultMeasurementTarget(settings.figureName);
    const descriptionParts = [];
    const summaryText = settings.figureSummary ? settings.figureSummary.trim() : '';
    if (summaryText) {
      descriptionParts.push(summaryText);
    }
    if (target) {
      descriptionParts.push(`Oppgave: ${target}`);
    }
    const description =
      descriptionParts.join(' – ') || `${toolTitle} er ${lengthText}${unitSuffix} lang.`;
    const altText = buildStatusMessage(settings);
    const summary = {
      figureName,
      figureImage: settings.figureImage || null,
      figureSummary: summaryText || null,
      measurementTarget: target || null
    };
    summary.tool = {
      key: activeToolKey,
      title: toolTitle,
      label: toolInfo.label,
      length: effectiveLength,
      unit: unitLabel || null,
      valueMultiplier
    };
    if (isTapeToolKey(activeToolKey)) {
      const tapeUnitsRaw = getVisibleTapeMeasureUnits(settings);
      summary.tool.visibleUnits = Number.isFinite(tapeUnitsRaw)
        ? roundForDisplay(tapeUnitsRaw)
        : null;
    }
    if (hasRuler) {
      const rulerLength = roundForDisplay(getEffectiveToolLength(settings, 'ruler'));
      summary.ruler = {
        length: rulerLength,
        unit: unitLabel || null,
        subdivisions: settings.subdivisions,
        valueMultiplier,
        backgroundMode: settings.rulerBackgroundMode
      };
    }
    if (hasTapeMeasure) {
      const tapeLengthDisplay = roundForDisplay(getVisibleTapeMeasureLength(settings));
      const tapeUnitsRaw = getVisibleTapeMeasureUnits(settings);
      summary.tape = {
        length: tapeLengthDisplay,
        unit: unitLabel || null,
        visibleUnits: Number.isFinite(tapeUnitsRaw) ? roundForDisplay(tapeUnitsRaw) : null,
        valueMultiplier
      };
    }
    if (hasSegment) {
      const segmentDecimals = resolveSegmentDecimals(settings);
      const segmentLength = roundForDisplay(
        getSegmentLengthInDisplayUnits(settings),
        segmentDecimals
      );
      const segmentPoints = cloneSegmentPoints(
        sanitizeSegmentPoints(settings.segmentPoints, defaults.segmentPoints) || defaults.segmentPoints
      );
      summary.segment = {
        length: segmentLength,
        unit: unitLabel || null,
        valueMultiplier,
        points: segmentPoints,
        decimals: segmentDecimals
      };
    }
    if (settings.figureScaleLabel) {
      summary.figureScaleLabel = settings.figureScaleLabel;
    }
    summary.showScaleLabel = !!settings.showScaleLabel;
    summary.allowPanning = !!settings.panningEnabled;
    summary.measurementWithoutScale = !!settings.measurementWithoutScale;
    return {
      slug,
      baseName,
      description,
      altText,
      title: `${figureName} – ${toolTitle}`,
      summary
    };
  }

  function formatSvgNumber(value) {
    if (!Number.isFinite(value)) {
      return '0';
    }
    const rounded = Math.abs(value) < 0.000001 ? 0 : value;
    return Number(rounded.toFixed(3)).toString();
  }

  function createSvgElement(name) {
    return doc.createElementNS(SVG_NS, name);
  }

  function parseCssMatrix(transformValue) {
    if (!transformValue || transformValue === 'none') {
      return null;
    }
    const trimmed = transformValue.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith('matrix3d(')) {
      const values = trimmed
        .slice('matrix3d('.length, -1)
        .split(',')
        .map(part => Number.parseFloat(part.trim()));
      if (values.length === 16 && values.every(Number.isFinite)) {
        return {
          a: values[0],
          b: values[1],
          c: values[4],
          d: values[5],
          e: values[12],
          f: values[13]
        };
      }
      return null;
    }
    const match = trimmed.match(/matrix\(([^)]+)\)/);
    if (!match) {
      return null;
    }
    const parts = match[1]
      .split(',')
      .map(part => Number.parseFloat(part.trim()));
    if (parts.length !== 6 || !parts.every(Number.isFinite)) {
      return null;
    }
    return { a: parts[0], b: parts[1], c: parts[2], d: parts[3], e: parts[4], f: parts[5] };
  }

  function getComputedMatrix(element) {
    if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
      return null;
    }
    const computed = window.getComputedStyle(element);
    if (!computed) {
      return null;
    }
    return parseCssMatrix(computed.transform || computed.webkitTransform || computed.mozTransform || '');
  }

  function matrixToString(matrix) {
    if (!matrix) {
      return '';
    }
    const { a, b, c, d, e, f } = matrix;
    return `matrix(${formatSvgNumber(a)} ${formatSvgNumber(b)} ${formatSvgNumber(c)} ${formatSvgNumber(d)} ${formatSvgNumber(e)} ${formatSvgNumber(f)})`;
  }

  function buildExportStyle() {
    return `
      .mv-board-bg { fill: #f8fafc; }
      .mv-board-border { fill: none; stroke: rgba(15, 23, 42, 0.12); stroke-width: 2; }
      .mv-grid line { stroke: rgba(15, 23, 42, 0.16); stroke-width: 1; }
      .mv-scale-label__bg { fill: rgba(15, 23, 42, 0.6); }
      .mv-scale-label__text {
        font-family: "Inter", "Segoe UI", system-ui, sans-serif;
        font-size: 18px;
        font-weight: 600;
        fill: #ffffff;
        letter-spacing: 0.03em;
      }
      .mv-figure { image-rendering: optimizeQuality; }
      .mv-ruler .ruler-svg__background { fill: rgba(255, 255, 255, 0.5); stroke: none; }
      .mv-ruler .ruler-svg__baseline { stroke: rgba(15, 23, 42, 0.75); stroke-width: 2; stroke-linecap: round; }
      .mv-ruler .ruler-svg__tick { stroke-linecap: round; }
      .mv-ruler .ruler-svg__tick--major { stroke: rgba(15, 23, 42, 0.78); stroke-width: 2.5; }
      .mv-ruler .ruler-svg__tick--minor { stroke: rgba(15, 23, 42, 0.55); stroke-width: 1.4; }
      .mv-ruler .ruler-svg__label {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 24px;
        font-weight: 600;
        fill: #1f2937;
        letter-spacing: -0.01em;
      }
      .mv-ruler .ruler-svg__unit-label {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 18px;
        font-weight: 600;
        fill: #1e293b;
        letter-spacing: 0.02em;
      }
      .mv-tape {
        display: block;
        transform-origin: center;
      }
      .mv-tape__strap,
      .mv-tape__housing {
        pointer-events: none;
      }
      .mv-tape__strap image,
      .mv-tape__housing image {
        display: block;
        width: 100%;
        height: 100%;
        image-rendering: optimizeQuality;
      }
      .mv-segment__line {
        stroke: #0f6d8f;
        stroke-width: 6;
        stroke-linecap: round;
      }
      .mv-segment__handle-circle {
        fill: rgba(255, 255, 255, 0.7);
        stroke: rgba(15, 109, 143, 0.7);
        stroke-width: 2;
      }
      .mv-segment--tape-beta .mv-segment__handle-image {
        image-rendering: optimizeQuality;
      }
      .mv-segment__label-bg {
        fill: rgba(15, 109, 143, 0.9);
      }
      .mv-segment__label-text {
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 16px;
        font-weight: 600;
        fill: #ffffff;
        letter-spacing: 0.02em;
      }
    `;
  }

  function appendGrid(svgRoot, width, height, pan, settings) {
    if (!svgRoot) {
      return;
    }
    const group = createSvgElement('g');
    group.setAttribute('class', 'mv-grid');
    group.setAttribute('shape-rendering', 'crispEdges');
    const offsetX = pan && Number.isFinite(pan.x) ? pan.x : 0;
    const offsetY = pan && Number.isFinite(pan.y) ? pan.y : 0;
    if (offsetX !== 0 || offsetY !== 0) {
      group.setAttribute('transform', `translate(${formatSvgNumber(offsetX)} ${formatSvgNumber(offsetY)})`);
    }
    const columns = sanitizeGridCount(settings && settings.gridColumns, defaults.gridColumns);
    const rows = sanitizeGridCount(settings && settings.gridRows, defaults.gridRows);
    for (let column = 1; column < columns; column += 1) {
      const x = (width / columns) * column;
      const line = createSvgElement('line');
      line.setAttribute('x1', formatSvgNumber(x));
      line.setAttribute('y1', '0');
      line.setAttribute('x2', formatSvgNumber(x));
      line.setAttribute('y2', formatSvgNumber(height));
      group.appendChild(line);
    }
    for (let row = 1; row < rows; row += 1) {
      const y = (height / rows) * row;
      const line = createSvgElement('line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', formatSvgNumber(y));
      line.setAttribute('x2', formatSvgNumber(width));
      line.setAttribute('y2', formatSvgNumber(y));
      group.appendChild(line);
    }
    svgRoot.appendChild(group);
  }

  function appendScaleLabel(svgRoot, settings) {
    if (!svgRoot || !settings || !settings.showScaleLabel || !boardScaleLabel || !board) {
      return;
    }
    const text = collapseWhitespace(boardScaleLabel.textContent || '');
    if (!text) {
      return;
    }
    const labelRect = boardScaleLabel.getBoundingClientRect();
    const baseRect =
      boardRect && Number.isFinite(boardRect.width) && Number.isFinite(boardRect.height)
        ? boardRect
        : board.getBoundingClientRect();
    if (!labelRect || !baseRect || labelRect.width <= 0 || labelRect.height <= 0) {
      return;
    }
    const x = labelRect.left - baseRect.left;
    const y = labelRect.top - baseRect.top;
    const width = labelRect.width;
    const height = labelRect.height;
    const radius = Math.min(height / 2, 24);
    const group = createSvgElement('g');
    group.setAttribute('class', 'mv-scale-label');
    const background = createSvgElement('rect');
    background.setAttribute('class', 'mv-scale-label__bg');
    background.setAttribute('x', formatSvgNumber(x));
    background.setAttribute('y', formatSvgNumber(y));
    background.setAttribute('width', formatSvgNumber(width));
    background.setAttribute('height', formatSvgNumber(height));
    background.setAttribute('rx', formatSvgNumber(radius));
    background.setAttribute('ry', formatSvgNumber(radius));
    group.appendChild(background);
    const textElement = createSvgElement('text');
    textElement.setAttribute('class', 'mv-scale-label__text');
    textElement.setAttribute('x', formatSvgNumber(x + width / 2));
    textElement.setAttribute('y', formatSvgNumber(y + height / 2));
    textElement.setAttribute('text-anchor', 'middle');
    textElement.setAttribute('dominant-baseline', 'middle');
    textElement.textContent = text;
    group.appendChild(textElement);
    svgRoot.appendChild(group);
  }

  async function resolveImageHref(imageUrl) {
    if (typeof imageUrl !== 'string' || !imageUrl) {
      return null;
    }
    const trimmed = imageUrl.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith('data:') || typeof fetch !== 'function' || typeof FileReader !== 'function') {
      return trimmed;
    }
    try {
      const absolute = new URL(trimmed, doc.baseURI).toString();
      const response = await fetch(absolute, { mode: 'cors' });
      if (!response.ok) {
        throw new Error('failed');
      }
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : trimmed);
        reader.onerror = () => reject(reader.error || new Error('read failed'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      return trimmed;
    }
  }

  async function createFigureImageElement(settings, boardWidth, boardHeight, pan) {
    if (!settings || !settings.figureImage || !boardFigure) {
      return null;
    }
    const imageUrl = settings.figureImage;
    ensureFigureImageDimensions(imageUrl);
    const scaleMetrics = resolveScaleMetrics(settings);
    const figureDimensions = resolveFigureDimensions(imageUrl);
    let figureWidth = boardWidth;
    let figureHeight = boardHeight;
    if (figureDimensions) {
      const scaleResult = computeFigureScale(settings, scaleMetrics, figureDimensions);
      if (scaleResult) {
        figureWidth = scaleResult.width;
        figureHeight = scaleResult.height;
      }
    }
    if (!(figureWidth > 0) || !(figureHeight > 0)) {
      figureWidth = boardWidth;
      figureHeight = boardHeight;
    }
    const href = await resolveImageHref(imageUrl);
    if (!href) {
      return null;
    }
    const image = createSvgElement('image');
    image.setAttribute('class', 'mv-figure');
    const offsetX = pan && Number.isFinite(pan.x) ? pan.x : 0;
    const offsetY = pan && Number.isFinite(pan.y) ? pan.y : 0;
    const x = (boardWidth - figureWidth) / 2 + offsetX;
    const y = (boardHeight - figureHeight) / 2 + offsetY;
    image.setAttribute('x', formatSvgNumber(x));
    image.setAttribute('y', formatSvgNumber(y));
    image.setAttribute('width', formatSvgNumber(figureWidth));
    image.setAttribute('height', formatSvgNumber(figureHeight));
    image.setAttributeNS(XLINK_NS, 'xlink:href', href);
    image.setAttribute('href', href);
    return image;
  }

  function createSegmentGroupForExport() {
    if (!hasSegment || !segment || segment.hidden || segment.getAttribute('aria-hidden') === 'true') {
      return null;
    }
    const points = getSegmentPointsInPx();
    if (!points) {
      return null;
    }
    const isTapeBeta = board && board.getAttribute('data-active-tool') === TAPE_BETA_TOOL_KEY;
    const group = createSvgElement('g');
    group.setAttribute('class', isTapeBeta ? 'mv-segment mv-segment--tape-beta' : 'mv-segment');

    if (!isTapeBeta) {
      const line = createSvgElement('line');
      line.setAttribute('class', 'mv-segment__line');
      line.setAttribute('x1', formatSvgNumber(points.a.x));
      line.setAttribute('y1', formatSvgNumber(points.a.y));
      line.setAttribute('x2', formatSvgNumber(points.b.x));
      line.setAttribute('y2', formatSvgNumber(points.b.y));
      group.appendChild(line);
    }

    if (isTapeBeta) {
      let exportState = tapeBetaVisualState && Number.isFinite(tapeBetaVisualState.strapLength)
        ? tapeBetaVisualState
        : null;
      let strapClone = null;
      if (exportState && tapeBetaStrapSvg) {
        strapClone = tapeBetaStrapSvg.cloneNode(true);
      } else {
        const dx = points.b.x - points.a.x;
        const dy = points.b.y - points.a.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0.5) {
          const rotation = Math.atan2(dy, dx);
          const activeSettings = appState.settings || defaults;
          const scaleMetrics = resolveScaleMetrics(activeSettings);
          let unitSpacing = Number.isFinite(lastRenderedUnitSpacing) && lastRenderedUnitSpacing > 0
            ? lastRenderedUnitSpacing
            : scaleMetrics && Number.isFinite(scaleMetrics.unitSpacing) && scaleMetrics.unitSpacing > 0
            ? scaleMetrics.unitSpacing
            : DEFAULT_UNIT_SPACING_PX;
          if (!Number.isFinite(unitSpacing) || unitSpacing <= 0) {
            unitSpacing = DEFAULT_UNIT_SPACING_PX;
          }
          const strapHeight = TAPE_STRAP_DEFAULT_HEIGHT;
          const housingShift = resolveTapeHousingShiftPx();
          const strapData = buildTapeBetaStrapMarkup({
            distance,
            unitSpacing,
            housingShift,
            strapHeight,
            settings: activeSettings,
            metrics: scaleMetrics
          });
          if (strapData) {
            exportState = {
              pointA: { x: points.a.x, y: points.a.y },
              pointB: { x: points.b.x, y: points.b.y },
              rotation,
              strapHeight: strapData.strapHeight,
              strapLength: strapData.strapLength
            };
            const svg = createSvgElement('svg');
            svg.setAttribute('viewBox', `0 0 ${formatSvgNumber(strapData.strapLength)} ${formatSvgNumber(strapData.strapHeight)}`);
            svg.setAttribute('preserveAspectRatio', 'none');
            svg.setAttribute('width', formatSvgNumber(strapData.strapLength));
            svg.setAttribute('height', formatSvgNumber(strapData.strapHeight));
            svg.innerHTML = strapData.markup;
            strapClone = svg;
          }
        }
      }

      if (exportState && strapClone) {
        strapClone.removeAttribute('aria-hidden');
        strapClone.removeAttribute('focusable');
        strapClone.setAttribute('width', formatSvgNumber(exportState.strapLength));
        strapClone.setAttribute('height', formatSvgNumber(exportState.strapHeight));

        const strapGroup = createSvgElement('g');
        strapGroup.setAttribute('class', 'mv-tape__strap');
        const exportStrapAnchorY = exportState.strapHeight / 2;
        strapGroup.setAttribute(
          'transform',
          `translate(${formatSvgNumber(exportState.pointA.x)} ${formatSvgNumber(exportState.pointA.y)}) rotate(${formatSvgNumber(exportState.rotation)}) translate(0 ${formatSvgNumber(-exportStrapAnchorY)})`
        );
        strapGroup.appendChild(strapClone);
        group.appendChild(strapGroup);

        const housingSpec = TAPE_BETA_HANDLE_SPECS.b;
        const housingGroup = createSvgElement('g');
        housingGroup.setAttribute('class', 'mv-tape__housing');
        const housingAnchor = resolveTapeBetaAnchor(housingSpec);
        const housingAnchorX = Number.isFinite(housingAnchor.anchorX) ? housingAnchor.anchorX : 0;
        const housingAnchorY = Number.isFinite(housingAnchor.anchorY) ? housingAnchor.anchorY : housingSpec.height;
        housingGroup.setAttribute(
          'transform',
          `translate(${formatSvgNumber(exportState.pointB.x || points.b.x)} ${formatSvgNumber(exportState.pointB.y || points.b.y)}) rotate(${formatSvgNumber(exportState.rotation)}) translate(${formatSvgNumber(-housingAnchorX)} ${formatSvgNumber(-housingAnchorY)})`
        );
        const housingImage = createSvgElement('image');
        housingImage.setAttribute('x', '0');
        housingImage.setAttribute('y', '0');
        housingImage.setAttribute('width', formatSvgNumber(housingSpec.width));
        housingImage.setAttribute('height', formatSvgNumber(housingSpec.height));
        housingImage.setAttributeNS(XLINK_NS, 'xlink:href', housingSpec.href);
        housingImage.setAttribute('href', housingSpec.href);
        housingGroup.appendChild(housingImage);
        group.appendChild(housingGroup);
      }
    }

    const handleKeys = ['a', 'b'];
    for (const key of handleKeys) {
      const point = points[key];
      if (!point) {
        continue;
      }
      const handleGroup = createSvgElement('g');
      handleGroup.setAttribute('class', `mv-segment__handle mv-segment__handle--${key}`);

      if (!isTapeBeta) {
        const circle = createSvgElement('circle');
        circle.setAttribute('class', 'mv-segment__handle-circle');
        circle.setAttribute('cx', formatSvgNumber(point.x));
        circle.setAttribute('cy', formatSvgNumber(point.y));
        circle.setAttribute('r', formatSvgNumber(14));
        handleGroup.appendChild(circle);
      }

      group.appendChild(handleGroup);
    }

    if (!isTapeBeta && segmentLabel && board) {
      const labelText = collapseWhitespace(segmentLabel.textContent);
      const labelRect = segmentLabel.getBoundingClientRect();
      const boardBounds = board.getBoundingClientRect();
      if (labelText && labelRect && boardBounds && labelRect.width > 0 && labelRect.height > 0) {
        const labelGroup = createSvgElement('g');
        labelGroup.setAttribute('class', 'mv-segment__label');
        const offsetX = labelRect.left - boardBounds.left;
        const offsetY = labelRect.top - boardBounds.top;
        labelGroup.setAttribute(
          'transform',
          `translate(${formatSvgNumber(offsetX)} ${formatSvgNumber(offsetY)})`
        );

        const background = createSvgElement('rect');
        background.setAttribute('class', 'mv-segment__label-bg');
        background.setAttribute('x', '0');
        background.setAttribute('y', '0');
        background.setAttribute('width', formatSvgNumber(labelRect.width));
        background.setAttribute('height', formatSvgNumber(labelRect.height));
        const radius = labelRect.height / 2;
        background.setAttribute('rx', formatSvgNumber(radius));
        background.setAttribute('ry', formatSvgNumber(radius));
        labelGroup.appendChild(background);

        const textElement = createSvgElement('text');
        textElement.setAttribute('class', 'mv-segment__label-text');
        textElement.setAttribute('x', formatSvgNumber(labelRect.width / 2));
        textElement.setAttribute('y', formatSvgNumber(labelRect.height / 2));
        textElement.setAttribute('text-anchor', 'middle');
        textElement.setAttribute('dominant-baseline', 'middle');
        textElement.textContent = labelText;
        labelGroup.appendChild(textElement);

        group.appendChild(labelGroup);
      }
    }

    return group;
  }

  function createRulerGroupForExport(helper) {
    if (!rulerSvg) {
      return null;
    }
    if (ruler && (ruler.hidden || ruler.getAttribute('aria-hidden') === 'true')) {
      return null;
    }
    const clone = helper && typeof helper.cloneSvgForExport === 'function'
      ? helper.cloneSvgForExport(rulerSvg)
      : rulerSvg.cloneNode(true);
    if (!clone) {
      return null;
    }
    clone.removeAttribute('aria-hidden');
    clone.removeAttribute('focusable');
    const group = createSvgElement('g');
    group.setAttribute('class', 'mv-ruler');
    const matrix = getComputedMatrix(ruler);
    if (matrix) {
      group.setAttribute('transform', matrixToString(matrix));
    }
    group.appendChild(clone);
    return group;
  }

  async function createTapeMeasureGroupForExport(helper, settings) {
    if (!tapeMeasure || !tapeStrap || !tapeStrapTrack || !tapeHousing) {
      return null;
    }
    if (tapeMeasure.hidden || tapeMeasure.getAttribute('aria-hidden') === 'true') {
      return null;
    }

    const tapeClone = tapeMeasure.cloneNode(true);
    if (!tapeClone) {
      return null;
    }
    tapeClone.removeAttribute('hidden');
    tapeClone.removeAttribute('aria-hidden');

    const strapSvgSource =
      (tapeClone.querySelector('[data-tape-strap-svg]') || tapeStrapSvg) || null;
    const housingImageSource =
      (tapeClone.querySelector('[data-tape-housing] img') || tapeHousing.querySelector('img')) || null;

    if (!strapSvgSource || !housingImageSource) {
      return null;
    }

    const housingHref = await resolveImageHref(housingImageSource.getAttribute('src'));
    if (!housingHref) {
      return null;
    }

    const group = createSvgElement('g');
    group.setAttribute('class', 'mv-tape');

    const matrix = getComputedMatrix(tapeMeasure);
    if (matrix) {
      group.setAttribute('transform', matrixToString(matrix));
    }

    const containerRect = tapeMeasure.getBoundingClientRect();
    const strapRect = tapeStrap.getBoundingClientRect();
    const housingRect = tapeHousing.getBoundingClientRect();

    if (!strapRect || !housingRect) {
      return null;
    }

    const strapTrackWidth = tapeStrapTrack ? tapeStrapTrack.offsetWidth : NaN;
    const strapTrackHeight = tapeStrapTrack ? tapeStrapTrack.offsetHeight : NaN;
    const strapTotalWidthCandidates = [
      Number.isFinite(tapeLengthState.totalPx) && tapeLengthState.totalPx > 0 ? tapeLengthState.totalPx : null,
      Number.isFinite(strapTrackWidth) && strapTrackWidth > 0 ? strapTrackWidth : null,
      Number.isFinite(tapeStrap.offsetWidth) && tapeStrap.offsetWidth > 0 ? tapeStrap.offsetWidth : null,
      Number.isFinite(strapRect.width) && strapRect.width > 0 ? strapRect.width : null
    ];
    let strapTotalWidth = 0;
    for (const candidate of strapTotalWidthCandidates) {
      if (Number.isFinite(candidate) && candidate > 0) {
        strapTotalWidth = candidate;
        break;
      }
    }
    const strapHeightCandidates = [
      Number.isFinite(strapTrackHeight) && strapTrackHeight > 0 ? strapTrackHeight : null,
      Number.isFinite(tapeStrap.offsetHeight) && tapeStrap.offsetHeight > 0 ? tapeStrap.offsetHeight : null,
      Number.isFinite(strapRect.height) && strapRect.height > 0 ? strapRect.height : null
    ];
    let strapHeight = 0;
    for (const candidate of strapHeightCandidates) {
      if (Number.isFinite(candidate) && candidate > 0) {
        strapHeight = candidate;
        break;
      }
    }

    const housingWidth = Math.max(
      Number.isFinite(tapeHousing.offsetWidth) ? tapeHousing.offsetWidth : 0,
      Number.isFinite(housingRect.width) ? housingRect.width : 0
    );
    const housingHeight = Math.max(
      Number.isFinite(tapeHousing.offsetHeight) ? tapeHousing.offsetHeight : 0,
      Number.isFinite(housingRect.height) ? housingRect.height : 0
    );

    if (
      !(strapTotalWidth > 0) ||
      !(strapHeight > 0) ||
      !(housingWidth > 0) ||
      !(housingHeight > 0)
    ) {
      return null;
    }

    const strapGroup = createSvgElement('g');
    strapGroup.setAttribute('class', 'mv-tape__strap');

    const strapOffsetX = strapRect.left - containerRect.left;
    const strapOffsetY = strapRect.top - containerRect.top;
    strapGroup.setAttribute(
      'transform',
      `translate(${formatSvgNumber(strapOffsetX)} ${formatSvgNumber(strapOffsetY)})`
    );

    const strapSvgClone = helper && typeof helper.cloneSvgForExport === 'function'
      ? helper.cloneSvgForExport(strapSvgSource)
      : strapSvgSource.cloneNode(true);
    if (!strapSvgClone) {
      return null;
    }
    strapSvgClone.removeAttribute('aria-hidden');
    strapSvgClone.removeAttribute('focusable');
    strapSvgClone.setAttribute('width', formatSvgNumber(strapTotalWidth));
    strapSvgClone.setAttribute('height', formatSvgNumber(strapHeight));

    const inlineOffsetRaw = Number.parseFloat(
      tapeMeasure.style.getPropertyValue('--tape-strap-offset')
    );
    const computedOffsetRaw = doc.defaultView && typeof doc.defaultView.getComputedStyle === 'function'
      ? Number.parseFloat(
          doc.defaultView.getComputedStyle(tapeMeasure).getPropertyValue('--tape-strap-offset')
        )
      : NaN;
    const stateOffsetValue = Number.isFinite(tapeLengthState.visiblePx) && Number.isFinite(tapeLengthState.totalPx)
      ? tapeLengthState.totalPx - tapeLengthState.visiblePx
      : null;

    const strapTrackGroup = createSvgElement('g');

    const persistedUnits = sanitizeLength(
      settings && settings.tapeMeasureLength,
      defaults.tapeMeasureLength,
      { allowInfinite: true }
    );
    const spacing =
      Number.isFinite(tapeLengthState.unitSpacing) && tapeLengthState.unitSpacing > 0
        ? tapeLengthState.unitSpacing
        : null;
    const persistedVisibleWidth =
      spacing && Number.isFinite(persistedUnits)
        ? persistedUnits * spacing
        : isTapeLengthInfinite(persistedUnits) && Number.isFinite(tapeLengthState.visiblePx)
        ? tapeLengthState.visiblePx
        : null;
    const inlineVisibleRaw = Number.parseFloat(
      tapeMeasure.style.getPropertyValue('--tape-strap-visible')
    );
    const computedVisibleRaw = doc.defaultView && typeof doc.defaultView.getComputedStyle === 'function'
      ? Number.parseFloat(
          doc.defaultView.getComputedStyle(tapeMeasure).getPropertyValue('--tape-strap-visible')
        )
      : NaN;
    const candidateVisibleWidths = [
      persistedVisibleWidth,
      Number.isFinite(inlineVisibleRaw) ? inlineVisibleRaw : null,
      Number.isFinite(computedVisibleRaw) ? computedVisibleRaw : null,
      Number.isFinite(tapeLengthState.visiblePx) ? tapeLengthState.visiblePx : null,
      strapTotalWidth
    ];
    let strapVisibleWidth = strapTotalWidth;
    for (const candidate of candidateVisibleWidths) {
      if (Number.isFinite(candidate)) {
        strapVisibleWidth = candidate;
        break;
      }
    }
    strapVisibleWidth = Math.min(Math.max(strapVisibleWidth, 0), strapTotalWidth);

    const differenceOffset = Number.isFinite(strapVisibleWidth) && Number.isFinite(strapTotalWidth)
      ? strapTotalWidth - strapVisibleWidth
      : null;
    let strapOffsetValue = Number.isFinite(differenceOffset) ? differenceOffset : NaN;
    if (!Number.isFinite(strapOffsetValue)) {
      const offsetCandidates = [
        Number.isFinite(inlineOffsetRaw) ? inlineOffsetRaw : null,
        Number.isFinite(computedOffsetRaw) ? computedOffsetRaw : null,
        stateOffsetValue
      ];
      for (const candidate of offsetCandidates) {
        if (Number.isFinite(candidate)) {
          strapOffsetValue = candidate;
          break;
        }
      }
    }
    if (!Number.isFinite(strapOffsetValue)) {
      strapOffsetValue = 0;
    }
    if (Number.isFinite(differenceOffset)) {
      strapOffsetValue = Math.min(Math.max(strapOffsetValue, 0), differenceOffset);
    } else {
      strapOffsetValue = Math.max(strapOffsetValue, 0);
    }

    const strapOffsetMagnitude = Number.isFinite(strapOffsetValue) ? strapOffsetValue : 0;
    if (Math.abs(strapOffsetMagnitude) > 0.0001) {
      strapTrackGroup.setAttribute(
        'transform',
        `translate(${formatSvgNumber(strapOffsetMagnitude)} 0)`
      );
    }
    strapTrackGroup.appendChild(strapSvgClone);
    strapGroup.appendChild(strapTrackGroup);

    let clipPath = null;
    if (strapVisibleWidth < strapTotalWidth) {
      const clipId = `mvTapeClip${++exportClipIdCounter}`;
      clipPath = createSvgElement('clipPath');
      clipPath.setAttribute('id', clipId);
      clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
      const clipRect = createSvgElement('rect');
      clipRect.setAttribute('x', '0');
      clipRect.setAttribute('y', '0');
      clipRect.setAttribute('width', formatSvgNumber(strapVisibleWidth));
      clipRect.setAttribute('height', formatSvgNumber(strapHeight));
      clipPath.appendChild(clipRect);
      strapGroup.setAttribute('clip-path', `url(#${clipId})`);
    }

    group.appendChild(strapGroup);

    const housingGroup = createSvgElement('g');
    housingGroup.setAttribute('class', 'mv-tape__housing');

    const housingOffsetX = housingRect.left - containerRect.left;
    const housingOffsetY = housingRect.top - containerRect.top;
    housingGroup.setAttribute(
      'transform',
      `translate(${formatSvgNumber(housingOffsetX)} ${formatSvgNumber(housingOffsetY)})`
    );

    const housingImageElement = createSvgElement('image');
    housingImageElement.setAttribute('x', '0');
    housingImageElement.setAttribute('y', '0');
    housingImageElement.setAttribute('width', formatSvgNumber(housingWidth));
    housingImageElement.setAttribute('height', formatSvgNumber(housingHeight));
    housingImageElement.setAttributeNS(XLINK_NS, 'xlink:href', housingHref);
    housingImageElement.setAttribute('href', housingHref);
    housingGroup.appendChild(housingImageElement);
    group.appendChild(housingGroup);

    return {
      group,
      clipPath
    };
  }

  async function createMeasurementExportSvg(settings, helper) {
    if (!doc || !board) {
      return null;
    }
    const bounds = board.getBoundingClientRect();
    if (bounds && Number.isFinite(bounds.width) && Number.isFinite(bounds.height)) {
      boardRect = bounds;
    }
    const width = Math.max(
      Math.round((boardRect && Number.isFinite(boardRect.width) ? boardRect.width : BASE_BOARD_DIMENSIONS.width) || 0),
      1
    );
    const height = Math.max(
      Math.round((boardRect && Number.isFinite(boardRect.height) ? boardRect.height : BASE_BOARD_DIMENSIONS.height) || 0),
      1
    );
    const svg = createSvgElement('svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:xlink', XLINK_NS);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));

    const defs = createSvgElement('defs');
    const style = createSvgElement('style');
    style.textContent = buildExportStyle();
    defs.appendChild(style);
    svg.appendChild(defs);

    const background = createSvgElement('rect');
    background.setAttribute('class', 'mv-board-bg');
    background.setAttribute('x', '0');
    background.setAttribute('y', '0');
    background.setAttribute('width', formatSvgNumber(width));
    background.setAttribute('height', formatSvgNumber(height));
    svg.appendChild(background);

    const border = createSvgElement('rect');
    border.setAttribute('class', 'mv-board-border');
    border.setAttribute('x', formatSvgNumber(1));
    border.setAttribute('y', formatSvgNumber(1));
    border.setAttribute('width', formatSvgNumber(Math.max(width - 2, 0)));
    border.setAttribute('height', formatSvgNumber(Math.max(height - 2, 0)));
    svg.appendChild(border);

    const pan = settings && settings.panningEnabled
      ? sanitizeBoardPanTransform(settings.boardPanTransform, defaults.boardPanTransform)
      : { x: 0, y: 0 };

    const figureImage = await createFigureImageElement(settings, width, height, pan);
    if (figureImage) {
      svg.appendChild(figureImage);
    }

    if (settings && settings.gridEnabled) {
      appendGrid(svg, width, height, pan, settings);
    }

    appendScaleLabel(svg, settings);

    const sanitizedTool = sanitizeActiveTool(
      settings && settings.activeTool,
      defaultActiveTool
    );
    if (isSegmentToolKey(sanitizedTool)) {
      renderSegment(settings, resolveScaleMetrics(settings));
    }
    const instrumentOrder = [
      sanitizedTool,
      'ruler',
      TAPE_BETA_TOOL_KEY,
      'segment'
    ].filter(
      (value, index, array) => value && array.indexOf(value) === index
    );
    let instrumentAttached = false;
    for (const tool of instrumentOrder) {
      if (instrumentAttached) {
        break;
      }
      if (tool === 'ruler') {
        const rulerGroup = createRulerGroupForExport(helper);
        if (rulerGroup) {
          svg.appendChild(rulerGroup);
          instrumentAttached = true;
        }
      } else if (isTapeToolKey(tool)) {
        const tapeResult = await createTapeMeasureGroupForExport(helper, settings);
        if (tapeResult && tapeResult.group) {
          if (tapeResult.clipPath) {
            defs.appendChild(tapeResult.clipPath);
          }
          svg.appendChild(tapeResult.group);
          instrumentAttached = true;
        }
      } else if (isSegmentToolKey(tool)) {
        const segmentGroup = createSegmentGroupForExport();
        if (segmentGroup) {
          svg.appendChild(segmentGroup);
          instrumentAttached = true;
        }
      }
    }

    return svg;
  }

  async function handleExport() {
    if (!appState.settings || (!hasRuler && !hasTapeMeasure && !hasSegment)) {
      return;
    }
    const activeTool = sanitizeActiveTool(
      appState.settings && appState.settings.activeTool,
      defaultActiveTool
    );
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const exportSvgElement = await createMeasurementExportSvg(appState.settings, helper);
    if (!exportSvgElement) {
      return;
    }
    const meta = buildExportMetadata(appState.settings);
    const svgMarkup = svgToString(exportSvgElement);
    const suggestedBase = meta.baseName || 'maling';
    const suggestedName = suggestedBase.toLowerCase().endsWith('.svg') ? suggestedBase : `${suggestedBase}.svg`;

    const htmlTarget = document.querySelector('.figure') || exportSvgElement;
    if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
      try {
        const elementForHelper =
          helper && typeof helper.cloneSvgForExport === 'function'
            ? helper.cloneSvgForExport(exportSvgElement)
            : exportSvgElement.cloneNode(true);
        await helper.exportGraphicWithArchiveWithFallback({
          svgElement: elementForHelper,
          htmlTarget,
          suggestedName,
          toolId: 'maling',
          svgString: svgMarkup,
          slug: meta.slug,
          defaultBaseName: meta.baseName,
          description: meta.description,
          summary: meta.summary,
          title: meta.title,
          alt: meta.altText
        });
        return;
      } catch (error) {
        // Faller tilbake til nedlasting dersom eksporthjelper feiler.
      }
    }
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      try {
        const elementForHelper =
          helper && typeof helper.cloneSvgForExport === 'function'
            ? helper.cloneSvgForExport(exportSvgElement)
            : exportSvgElement.cloneNode(true);
        await helper.exportSvgWithArchive(elementForHelper, suggestedName, 'maling', {
          svgString: svgMarkup,
          slug: meta.slug,
          defaultBaseName: meta.baseName,
          description: meta.description,
          summary: meta.summary,
          title: meta.title,
          alt: meta.altText
        });
        return;
      } catch (error) {
        // Faller tilbake til nedlasting dersom eksporthjelper feiler.
      }
    }

    downloadSvgFallback(svgMarkup, suggestedName);
  }

  function downloadSvgFallback(svgMarkup, filename) {
    try {
      const blob = new Blob([svgMarkup], {
        type: 'image/svg+xml;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const anchor = doc.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => {
        try {
          URL.revokeObjectURL(url);
        } catch (err) {}
      }, 1000);
    } catch (error) {
      // Fallback til enkel data-URL hvis Blob ikke er tilgjengelig.
      const anchor = doc.createElement('a');
      anchor.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
      anchor.download = filename;
      doc.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    }
  }

  if (typeof window !== 'undefined') {
    window.målingApi = {
      createCleanState: (...args) => createCleanState(...args),
      loadCleanState: (...args) => loadCleanState(...args),
      onExampleLoaded: () => handleExamplesLoaded()
    };
    const mv = window.mathVisuals && typeof window.mathVisuals === 'object' ? window.mathVisuals : {};
    mv.activeTool = window.målingApi;
    window.mathVisuals = mv;
  }
})().catch(error => {
  if (typeof console !== 'undefined' && typeof console.error === 'function') {
    console.error('mathVisMåling: init failed', error);
  }
});
