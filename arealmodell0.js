var _CFG$SIMPLE$challenge, _CFG$SIMPLE$challenge2, _CFG$SIMPLE$challenge3, _CFG$SIMPLE$challenge4, _CFG$SIMPLE$challenge5, _CFG$SIMPLE$challenge6;
/* =========================================================
   AREALMODELL – rektangel m/ rutenett og håndtak
   ========================================================= */

const paletteService = typeof require === 'function'
  ? require('./palette/palette-service-adapter.js')
  : (() => {
    const globalScope = typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
        ? window
        : typeof global !== 'undefined'
          ? global
          : this;
    if (!globalScope || typeof globalScope !== 'object') {
      return {
        resolveGroupPalette(options = {}) {
          const fallback = Array.isArray(options.fallback)
            ? options.fallback.map(color => (typeof color === 'string' ? color.trim() : '')).filter(Boolean)
            : [];
          return fallback.slice();
        }
      };
    }
    const existingAdapter = globalScope.MathVisualsPaletteServiceAdapter;
    if (existingAdapter && typeof existingAdapter.resolveGroupPalette === 'function') {
      return existingAdapter;
    }
    const factory = globalScope.MathVisualsCreatePaletteServiceAdapter;
    if (typeof factory === 'function') {
      return factory(globalScope.MathVisualsGroupPalette || {});
    }
    const paletteModule = globalScope.MathVisualsGroupPalette || {};
    if (paletteModule && paletteModule.service && typeof paletteModule.service.resolveGroupPalette === 'function') {
      return {
        resolveGroupPalette(options) {
          return paletteModule.service.resolveGroupPalette(options);
        }
      };
    }
    if (paletteModule && typeof paletteModule.resolveGroupPalette === 'function') {
      return {
        resolveGroupPalette(options) {
          return paletteModule.resolveGroupPalette(options);
        }
      };
    }
    if (paletteModule && typeof paletteModule.ensure === 'function') {
      return {
        resolveGroupPalette(options = {}) {
          const fallback = Array.isArray(options.fallback)
            ? options.fallback.map(color => (typeof color === 'string' ? color.trim() : '')).filter(Boolean)
            : [];
          const count = Number.isFinite(options.count) && options.count > 0
            ? Math.trunc(options.count)
            : fallback.length;
          return paletteModule.ensure([], fallback, count);
        }
      };
    }
    return {
      resolveGroupPalette(options = {}) {
        const fallback = Array.isArray(options.fallback)
          ? options.fallback.map(color => (typeof color === 'string' ? color.trim() : '')).filter(Boolean)
          : [];
        return fallback.slice();
      }
    };
  })();

const DEFAULT_ADV_COLORS = {
  fill: "#5d9bbf",
  edge: "#2b3a42",
  grid: "#4a4a4a",
  text: "#222",
  handleFill: "#fff",
  handleEdge: "#666"
};

const CFG = {
  SIMPLE: {
    length: {
      cells: 1,
      max: 12,
      show: true
    },
    // x (bunn)
    height: {
      cells: 1,
      max: 12,
      show: true
    },
    // y (venstre)
    showGrid: true,
    snap: 1,
    // "areal" | "ruter" | "none" | egendefinert med ${N}
    areaLabel: "areal",
    // Oppgave-modus (tegn alle rektangler med areal N)
    challenge: {
      enabled: false,
      area: 12,
      dedupeOrderless: true,
      // to kolonner (a · b og b · a)
      autoExpandMax: true // øk max slik at N lar seg representere
    }
  },
  ADV: {
    containerId: "box",
    colors: {
      ...DEFAULT_ADV_COLORS
    },
    opacity: 0.55,
    stroke: 2,
    grid: {
      width: 1,
      dash: 2
    },
    // Marger i ruteenheter (rundt 0..max-området)
    // Økt top-marg for å gi plass til etiketter ved maksimal høyde
    margin: {
      left: 0.9,
      right: 1.2,
      top: 2.6,
      bottomBase: 0.9
    },
    labelOutside: 0.6,
    // avstand fra kant til sidekant-tall
    labelRowGap: 1.0,
    // avstand sidekant-tall ↔ “Areal: …”

    // Minimum piksel-luft (hindrer klipp ved smale vinduer)
    minPadPx: {
      left: 20,
      bottom: 40
    },
    fontSize: 18,
    responsive: true,
    keepAspect1to1: true,
    handleRadius: 14,
    keyboardShortcuts: true,
    // r=reset, s=svg
    fileName: "arealmodell.svg",
    // Lister nederst inne i rammen (i ruteenheter)
    listsInside: {
      insetX: 1.1,
      // fra høyrekant til kolonne-senter
      colGap: 3.2,
      // senter-senter
      listLineGap: 0.95,
      // radavstand
      bottomPad: 1.2 // luft under siste rad
    }
  }
};
const AREAL_GROUP_ID = "arealmodell";
const DEFAULT_RECT_COLORS = ["#e07c7c", "#f0c667", "#7fb2d6", "#8bb889"];
const CAMPUS_RECT_ORDER = [0, 5, 2, 4];

function getThemeApi() {
  const theme = typeof window !== "undefined" ? window.MathVisualsTheme : null;
  return theme && typeof theme === "object" ? theme : null;
}

function getActiveThemeProjectName(theme = getThemeApi()) {
  if (!theme || typeof theme.getActiveProfileName !== "function") return null;
  try {
    const value = theme.getActiveProfileName();
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  } catch (_) {}
  return null;
}

function applyThemeToDocument() {
  const theme = getThemeApi();
  if (theme && typeof theme.applyToDocument === "function") {
    try {
      theme.applyToDocument(document);
    } catch (_) {}
  }
}

function sanitizePaletteList(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach(value => {
    if (typeof value !== "string") return;
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
    if (typeof next === "string" && next) {
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

function reorderForProject(palette, project) {
  if (project !== "campus") return sanitizePaletteList(palette);
  const source = sanitizePaletteList(palette);
  if (!source.length) return source;
  return CAMPUS_RECT_ORDER.map(idx => source[idx % source.length] || source[0]);
}

function resolveArealPalette(count) {
  const theme = getThemeApi();
  const project = getActiveThemeProjectName(theme);
  const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : undefined;
  const servicePalette = paletteService.resolveGroupPalette({
    groupId: AREAL_GROUP_ID,
    count: targetCount,
    project: project || undefined,
    fallback: DEFAULT_RECT_COLORS,
    legacyPaletteId: "figures",
    fallbackKinds: ["fractions"]
  });
  if (Array.isArray(servicePalette) && servicePalette.length) {
    const sanitized = sanitizePaletteList(servicePalette);
    if (sanitized.length) {
      const reordered = reorderForProject(sanitized, project);
      return ensurePaletteCount(reordered, reordered, targetCount);
    }
  }
  let palette = null;
  if (theme && typeof theme.getGroupPalette === "function") {
    try {
      palette = theme.getGroupPalette(AREAL_GROUP_ID, { project, count: targetCount });
    } catch (_) {
      palette = null;
    }
    if (
      (!Array.isArray(palette) || (targetCount && palette.length < targetCount)) &&
      theme.getGroupPalette.length >= 3
    ) {
      try {
        palette = theme.getGroupPalette(
          AREAL_GROUP_ID,
          targetCount || undefined,
          project ? { project } : undefined
        );
      } catch (_) {
        palette = null;
      }
    }
    if (Array.isArray(palette) && palette.length) {
      const sanitized = sanitizePaletteList(palette);
      if (sanitized.length) {
        const reordered = reorderForProject(sanitized, project);
        return ensurePaletteCount(reordered, DEFAULT_RECT_COLORS, targetCount);
      }
    }
  }
  if (theme && typeof theme.getPalette === "function") {
    try {
      palette = theme.getPalette("figures", targetCount, { fallbackKinds: ["fractions"], project });
    } catch (_) {
      palette = null;
    }
    if (Array.isArray(palette) && palette.length) {
      const sanitized = sanitizePaletteList(palette);
      if (sanitized.length) {
        const reordered = reorderForProject(sanitized, project);
        return ensurePaletteCount(reordered, DEFAULT_RECT_COLORS, targetCount);
      }
    }
  }
  return ensurePaletteCount(DEFAULT_RECT_COLORS, DEFAULT_RECT_COLORS, targetCount);
}

function resolveAdvColors() {
  const palette = resolveArealPalette(4);
  const ensured = ensurePaletteCount(palette, DEFAULT_RECT_COLORS, 4);
  const [fill, edge, grid, text] = ensured;
  return {
    fill: fill || DEFAULT_ADV_COLORS.fill,
    edge: edge || DEFAULT_ADV_COLORS.edge,
    grid: grid || DEFAULT_ADV_COLORS.grid,
    text: text || DEFAULT_ADV_COLORS.text,
    handleFill: DEFAULT_ADV_COLORS.handleFill,
    handleEdge: edge || DEFAULT_ADV_COLORS.handleEdge
  };
}

applyThemeToDocument();
CFG.ADV.colors = resolveAdvColors();
const DEFAULT_SIMPLE_CFG = JSON.parse(JSON.stringify(CFG.SIMPLE));
function ensureSimpleDefaults() {
  const fill = (target, defaults) => {
    if (!defaults || typeof defaults !== 'object') return;
    Object.keys(defaults).forEach(key => {
      const defVal = defaults[key];
      const curVal = target[key];
      if (defVal && typeof defVal === 'object' && !Array.isArray(defVal)) {
        if (!curVal || typeof curVal !== 'object') {
          target[key] = Array.isArray(defVal) ? defVal.slice() : {
            ...defVal
          };
        }
        fill(target[key], defVal);
      } else if (!(key in target)) {
        target[key] = Array.isArray(defVal) ? defVal.slice() : defVal;
      }
    });
  };
  if (!CFG.SIMPLE || typeof CFG.SIMPLE !== 'object') CFG.SIMPLE = {};
  fill(CFG.SIMPLE, DEFAULT_SIMPLE_CFG);
}

/* ============================== State ============================== */
const S = {
  w: CFG.SIMPLE.length.cells,
  h: CFG.SIMPLE.height.cells,
  w0: CFG.SIMPLE.length.cells,
  h0: CFG.SIMPLE.height.cells,
  maxW: Math.max(CFG.SIMPLE.length.max, (_CFG$SIMPLE$challenge = CFG.SIMPLE.challenge) !== null && _CFG$SIMPLE$challenge !== void 0 && _CFG$SIMPLE$challenge.enabled && (_CFG$SIMPLE$challenge2 = CFG.SIMPLE.challenge) !== null && _CFG$SIMPLE$challenge2 !== void 0 && _CFG$SIMPLE$challenge2.autoExpandMax ? ((_CFG$SIMPLE$challenge3 = CFG.SIMPLE.challenge) === null || _CFG$SIMPLE$challenge3 === void 0 ? void 0 : _CFG$SIMPLE$challenge3.area) || 0 : 0),
  maxH: Math.max(CFG.SIMPLE.height.max, (_CFG$SIMPLE$challenge4 = CFG.SIMPLE.challenge) !== null && _CFG$SIMPLE$challenge4 !== void 0 && _CFG$SIMPLE$challenge4.enabled && (_CFG$SIMPLE$challenge5 = CFG.SIMPLE.challenge) !== null && _CFG$SIMPLE$challenge5 !== void 0 && _CFG$SIMPLE$challenge5.autoExpandMax ? ((_CFG$SIMPLE$challenge6 = CFG.SIMPLE.challenge) === null || _CFG$SIMPLE$challenge6 === void 0 ? void 0 : _CFG$SIMPLE$challenge6.area) || 0 : 0),
  board: null,
  handle: null,
  gridLines: [],
  labelArea: null,
  labelLen: null,
  labelHei: null,
  // “tabell”-tekster

  // oppgave
  ch: {
    enabled: !!(CFG.SIMPLE.challenge && CFG.SIMPLE.challenge.enabled),
    N: CFG.SIMPLE.challenge && CFG.SIMPLE.challenge.area || null,
    allPairs: [],
    oriented: new Set(),
    // "a×b" som faktisk er laget
    dedupeOrderless: !!(CFG.SIMPLE.challenge && CFG.SIMPLE.challenge.dedupeOrderless)
  },
  // UU
  kb: {
    btn: null,
    live: null,
    focused: false,
    origHandleSize: null
  }
};

/* ============================== Config fra HTML ============================== */
function readConfigFromHtml() {
  var _document$getElementB, _document$getElementB2, _document$getElementB3, _document$getElementB4, _document$getElementB5, _document$getElementB6, _document$getElementB7, _document$getElementB8, _document$getElementB9, _document$getElementB0, _document$getElementB1;
  const len = parseInt((_document$getElementB = document.getElementById("lenCells")) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.value, 10);
  if (Number.isFinite(len)) CFG.SIMPLE.length.cells = len;
  const lenMax = parseInt((_document$getElementB2 = document.getElementById("lenMax")) === null || _document$getElementB2 === void 0 ? void 0 : _document$getElementB2.value, 10);
  if (Number.isFinite(lenMax)) CFG.SIMPLE.length.max = lenMax;
  const hei = parseInt((_document$getElementB3 = document.getElementById("heiCells")) === null || _document$getElementB3 === void 0 ? void 0 : _document$getElementB3.value, 10);
  if (Number.isFinite(hei)) CFG.SIMPLE.height.cells = hei;
  const heiMax = parseInt((_document$getElementB4 = document.getElementById("heiMax")) === null || _document$getElementB4 === void 0 ? void 0 : _document$getElementB4.value, 10);
  if (Number.isFinite(heiMax)) CFG.SIMPLE.height.max = heiMax;
  CFG.SIMPLE.showGrid = (_document$getElementB5 = (_document$getElementB6 = document.getElementById("chkGrid")) === null || _document$getElementB6 === void 0 ? void 0 : _document$getElementB6.checked) !== null && _document$getElementB5 !== void 0 ? _document$getElementB5 : CFG.SIMPLE.showGrid;
  const snap = parseInt((_document$getElementB7 = document.getElementById("snap")) === null || _document$getElementB7 === void 0 ? void 0 : _document$getElementB7.value, 10);
  if (Number.isFinite(snap)) CFG.SIMPLE.snap = snap;
  const areaLabel = (_document$getElementB8 = document.getElementById("areaLabel")) === null || _document$getElementB8 === void 0 ? void 0 : _document$getElementB8.value;
  if (areaLabel != null) CFG.SIMPLE.areaLabel = areaLabel;
  if (!CFG.SIMPLE.challenge) CFG.SIMPLE.challenge = {};
  CFG.SIMPLE.challenge.enabled = (_document$getElementB9 = (_document$getElementB0 = document.getElementById("chkChallenge")) === null || _document$getElementB0 === void 0 ? void 0 : _document$getElementB0.checked) !== null && _document$getElementB9 !== void 0 ? _document$getElementB9 : false;
  const chArea = parseInt((_document$getElementB1 = document.getElementById("challengeArea")) === null || _document$getElementB1 === void 0 ? void 0 : _document$getElementB1.value, 10);
  if (Number.isFinite(chArea)) CFG.SIMPLE.challenge.area = chArea;
}
function applySimpleConfig() {
  var _CFG$SIMPLE$challenge7, _CFG$SIMPLE$challenge8, _CFG$SIMPLE$challenge9, _CFG$SIMPLE$challenge0, _CFG$SIMPLE$challenge1, _CFG$SIMPLE$challenge10;
  S.w = CFG.SIMPLE.length.cells;
  S.h = CFG.SIMPLE.height.cells;
  S.w0 = S.w;
  S.h0 = S.h;
  S.maxW = Math.max(CFG.SIMPLE.length.max, (_CFG$SIMPLE$challenge7 = CFG.SIMPLE.challenge) !== null && _CFG$SIMPLE$challenge7 !== void 0 && _CFG$SIMPLE$challenge7.enabled && (_CFG$SIMPLE$challenge8 = CFG.SIMPLE.challenge) !== null && _CFG$SIMPLE$challenge8 !== void 0 && _CFG$SIMPLE$challenge8.autoExpandMax ? ((_CFG$SIMPLE$challenge9 = CFG.SIMPLE.challenge) === null || _CFG$SIMPLE$challenge9 === void 0 ? void 0 : _CFG$SIMPLE$challenge9.area) || 0 : 0);
  S.maxH = Math.max(CFG.SIMPLE.height.max, (_CFG$SIMPLE$challenge0 = CFG.SIMPLE.challenge) !== null && _CFG$SIMPLE$challenge0 !== void 0 && _CFG$SIMPLE$challenge0.enabled && (_CFG$SIMPLE$challenge1 = CFG.SIMPLE.challenge) !== null && _CFG$SIMPLE$challenge1 !== void 0 && _CFG$SIMPLE$challenge1.autoExpandMax ? ((_CFG$SIMPLE$challenge10 = CFG.SIMPLE.challenge) === null || _CFG$SIMPLE$challenge10 === void 0 ? void 0 : _CFG$SIMPLE$challenge10.area) || 0 : 0);
  S.ch.enabled = !!(CFG.SIMPLE.challenge && CFG.SIMPLE.challenge.enabled);
  S.ch.N = CFG.SIMPLE.challenge && CFG.SIMPLE.challenge.area || null;
  S.ch.dedupeOrderless = !!(CFG.SIMPLE.challenge && CFG.SIMPLE.challenge.dedupeOrderless);
}
function syncSimpleConfigFromState() {
  CFG.SIMPLE.length.cells = S.w;
  CFG.SIMPLE.height.cells = S.h;
  S.w0 = S.w;
  S.h0 = S.h;
  const lenInput = document.getElementById("lenCells");
  if (lenInput) lenInput.value = String(S.w);
  const heiInput = document.getElementById("heiCells");
  if (heiInput) heiInput.value = String(S.h);
}
function rebuildFromConfig() {
  ensureSimpleDefaults();
  applySimpleConfig();
  if (S.board) {
    var _S$board$stopResizeOb;
    (_S$board$stopResizeOb = S.board.stopResizeObserver) === null || _S$board$stopResizeOb === void 0 ? void 0 : _S$board$stopResizeOb.call(S.board);
    JXG.JSXGraph.freeBoard(S.board);
  }
  createBoard();
}
function initFromHtml() {
  readConfigFromHtml();
  rebuildFromConfig();
}

/* ============================== Hjelpere ============================== */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const quantize = (v, step) => step <= 0 ? v : Math.round(v / step) * step;
const debounced = (fn, ms = 80) => {
  let t = null;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
};
function areaLabelText(n) {
  const m = CFG.SIMPLE.areaLabel;
  if (m == null) return "Areal: " + n;
  const s = String(m).toLowerCase();
  if (s === "none" || s === "off" || s === "hide") return null;
  if (s === "areal") return "Areal: " + n;
  if (s === "ruter" || s === "tiles" || s === "antall") return "Ruter: " + n;
  return String(m).includes("${N}") ? String(m).replace("${N}", String(n)) : String(m);
}
function factorPairsSorted(N) {
  const out = [];
  for (let a = 1; a * a <= N; a++) {
    if (N % a === 0) out.push([a, N / a]);
  }
  return out;
}

/* ============================== UU ============================== */
function injectSrOnlyCSS() {
  if (document.getElementById("sr-only-style")) return;
  const style = document.createElement("style");
  style.id = "sr-only-style";
  style.textContent = ".sr-only{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;white-space:nowrap!important;border:0!important;}";
  document.head.appendChild(style);
}
function ensureA11yControls() {
  injectSrOnlyCSS();
  const box = document.getElementById(CFG.ADV.containerId);
  if (!S.kb.btn) {
    const btn = document.createElement("button");
    btn.className = "sr-only";
    btn.type = "button";
    btn.title = "Håndtak – bruk piltaster (Shift=5). Home/End setter min/maks.";
    btn.setAttribute("aria-label", "Håndtak for rektangelet. Bruk piltaster for å endre størrelse. Hold Shift for å flytte 5 ruter. Home/End til min/maks.");
    box.insertAdjacentElement("afterend", btn);
    S.kb.btn = btn;
    btn.addEventListener("focus", () => {
      S.kb.focused = true;
      if (S.handle && S.kb.origHandleSize == null) S.kb.origHandleSize = S.handle.getAttribute("size");
      if (S.handle) S.handle.setAttribute({
        size: CFG.ADV.handleRadius * 1.25
      });
    });
    btn.addEventListener("blur", () => {
      S.kb.focused = false;
      if (S.handle && S.kb.origHandleSize != null) S.handle.setAttribute({
        size: S.kb.origHandleSize
      });
    });
    btn.addEventListener("keydown", e => {
      const stepBase = Math.max(1, CFG.SIMPLE.snap);
      const step = (e.shiftKey ? 5 : 1) * stepBase;
      let dx = 0,
        dy = 0;
      if (e.key === "ArrowRight") {
        dx = step;
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        dx = -step;
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        dy = step;
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        dy = -step;
        e.preventDefault();
      } else if (e.key === "Home") {
        if (e.ctrlKey || e.metaKey) {
          S.w = 1;
          S.h = 1;
        } else {
          S.w = 1;
        }
        moveHandleTo(S.w, S.h);
        e.preventDefault();
      } else if (e.key === "End") {
        if (e.ctrlKey || e.metaKey) {
          S.w = S.maxW;
          S.h = S.maxH;
        } else {
          S.w = S.maxW;
        }
        moveHandleTo(S.w, S.h);
        e.preventDefault();
      }
      if (dx || dy) moveHandleTo(clamp(S.w + dx, 1, S.maxW), clamp(S.h + dy, 1, S.maxH));
    });
  }
  if (!S.kb.live) {
    const live = document.createElement("div");
    live.className = "sr-only";
    live.setAttribute("aria-live", "polite");
    (S.kb.btn || box).insertAdjacentElement("afterend", live);
    S.kb.live = live;
  }
  updateLive();
}
function updateLive() {
  if (S.kb.live) S.kb.live.textContent = `Bredde ${S.w}, høyde ${S.h}, areal ${S.w * S.h}.`;
}
function moveHandleTo(nx, ny) {
  S.w = Math.round(nx);
  S.h = Math.round(ny);
  if (S.handle) S.handle.moveTo([S.w, S.h]);
  tryRegisterFound(S.w, S.h);
  drawInnerGrid();
  updateLive();
  syncSimpleConfigFromState();
  S.board.update();
}

/* ============================== Grid inni rektangelet ============================== */
/* Viktig: layer=9 -> over fyllet (fill ligger på 7) */
function clearInnerGrid() {
  for (const g of S.gridLines) {
    S.board.removeObject(g);
  }
  S.gridLines.length = 0;
}
function drawInnerGrid() {
  clearInnerGrid();
  if (!CFG.SIMPLE.showGrid) return;
  const C = CFG.ADV.colors;
  for (let j = 1; j < S.h; j++) {
    S.gridLines.push(S.board.create("segment", [[0, j], [S.w, j]], {
      strokeColor: C.grid,
      strokeWidth: CFG.ADV.grid.width,
      dash: CFG.ADV.grid.dash,
      fixed: true,
      highlight: false,
      layer: 9
    }));
  }
  for (let i = 1; i < S.w; i++) {
    S.gridLines.push(S.board.create("segment", [[i, 0], [i, S.h]], {
      strokeColor: C.grid,
      strokeWidth: CFG.ADV.grid.width,
      dash: CFG.ADV.grid.dash,
      fixed: true,
      highlight: false,
      layer: 9
    }));
  }
}

/* ============================== Lister (“tabell”) ============================== */
function getListContainers() {
  const box = document.getElementById(CFG.ADV.containerId);
  let wrap = box.querySelector('.pairs-list');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'pairs-list';
    const a = document.createElement('div');
    a.id = 'listA';
    a.className = 'col';
    const b = document.createElement('div');
    b.id = 'listB';
    b.className = 'col';
    wrap.appendChild(a);
    wrap.appendChild(b);
    box.appendChild(wrap);
  }
  return [wrap.querySelector('#listA'), wrap.querySelector('#listB')];
}
function renderInBoardLists() {
  const [colA, colB] = getListContainers();
  if (!S.ch.enabled) {
    colA.innerHTML = '';
    colB.innerHTML = '';
    adaptView();
    return;
  }
  const linesA = [],
    linesB = [];
  if (S.ch.dedupeOrderless) {
    for (const [a, b] of S.ch.allPairs) {
      if (S.ch.oriented.has(`${a}×${b}`)) linesA.push(`${a} · ${b} = ${S.ch.N}`);
      if (a !== b && S.ch.oriented.has(`${b}×${a}`)) linesB.push(`${b} · ${a} = ${S.ch.N}`);
    }
  } else {
    const items = [...S.ch.oriented].map(s => s.split('×').map(n => parseInt(n, 10))).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    for (const [a, b] of items) linesA.push(`${a} · ${b} = ${S.ch.N}`);
  }
  colA.innerHTML = linesA.map(t => `<div>${t}</div>`).join('');
  colB.innerHTML = linesB.map(t => `<div>${t}</div>`).join('');
  adaptView();
}

/* ============================== Board/tegn ============================== */
function drawAll() {
  const C = CFG.ADV.colors;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const HANDLE_R = isMobile ? Math.round(CFG.ADV.handleRadius * 1.3) : CFG.ADV.handleRadius;
  const FONT = isMobile ? Math.round(CFG.ADV.fontSize * 1.15) : CFG.ADV.fontSize;

  // Håndtak
  S.handle = S.board.create("point", [S.w, S.h], {
    name: "",
    size: HANDLE_R,
    strokeColor: C.handleEdge,
    fillColor: C.handleFill,
    face: "circle",
    fixed: false,
    showInfobox: false,
    withLabel: false,
    highlight: true,
    layer: 12
  });

  // Hjørner (usynlige og faste)
  const A = S.board.create("point", [0, 0], {
    visible: false,
    fixed: true
  });
  const B = S.board.create("point", [() => S.handle.X(), 0], {
    visible: false,
    fixed: true
  });
  const Cc = S.board.create("point", [() => S.handle.X(), () => S.handle.Y()], {
    visible: false,
    fixed: true
  });
  const D = S.board.create("point", [0, () => S.handle.Y()], {
    visible: false,
    fixed: true
  });

  // Rektangel
  const poly = S.board.create("polygon", [A, B, Cc, D], {
    withLines: true,
    fillColor: C.fill,
    fillOpacity: CFG.ADV.opacity,
    borders: {
      strokeColor: C.edge,
      strokeWidth: CFG.ADV.stroke,
      highlight: false,
      fixed: true
    },
    fixed: true,
    highlight: false,
    hasInnerPoints: false,
    layer: 7
  });
  poly.borders.forEach(b => b.setAttribute({
    layer: 8,
    highlight: false,
    fixed: true
  }));
  updateCountsFromHandle();
  drawInnerGrid();

  // Etiketter
  const out = CFG.ADV.labelOutside,
    gap = CFG.ADV.labelRowGap;
  S.labelLen = S.board.create("text", [() => S.w / 2, () => -out, () => String(S.w)], {
    anchorX: "middle",
    anchorY: "top",
    fixed: true,
    fontSize: FONT,
    strokeColor: CFG.ADV.colors.text,
    layer: 10
  });
  S.labelHei = S.board.create("text", [() => -out, () => S.h / 2, () => String(S.h)], {
    anchorX: "right",
    anchorY: "middle",
    fixed: true,
    fontSize: FONT,
    strokeColor: CFG.ADV.colors.text,
    layer: 10
  });
  S.labelArea = S.board.create("text", [() => -out, () => -(out + gap), () => {
    const t = areaLabelText(S.w * S.h);
    return t === null ? "" : t;
  }], {
    anchorX: "left",
    anchorY: "top",
    fixed: true,
    fontSize: FONT,
    strokeColor: CFG.ADV.colors.text,
    layer: 10
  });

  // Drag
  S.handle.on("drag", () => {
    snapHandleToCells();
    updateCountsFromHandle();
    drawInnerGrid();
    tryRegisterFound(S.w, S.h);
    updateLive();
    renderInBoardLists();
  });
  S.handle.on("up", () => {
    snapHandleToCells();
    updateCountsFromHandle();
    drawInnerGrid();
    tryRegisterFound(S.w, S.h);
    updateLive();
    renderInBoardLists();
  });
}
function createBoard() {
  if (S.ch.enabled && S.ch.N) S.ch.allPairs = factorPairsSorted(S.ch.N);
  S.board = JXG.JSXGraph.initBoard(CFG.ADV.containerId, {
    boundingbox: [0, 1, 1, 0],
    renderer: "svg",
    keepaspectratio: !!CFG.ADV.keepAspect1to1,
    axis: false,
    showNavigation: false,
    showCopyright: false,
    pan: {
      enabled: false
    },
    zoom: {
      enabled: false
    }
  });
  drawAll();
  ensureA11yControls();
  renderInBoardLists();
  if (CFG.ADV.responsive) {
    window.addEventListener("resize", debounced(() => {
      renderInBoardLists();
      drawInnerGrid();
      S.board.update();
    }, 100));
  }
  const btnReset = document.getElementById("btnReset");
  if (btnReset) btnReset.onclick = doReset;
  const btnSvg = document.getElementById("btnSvg");
  if (btnSvg) btnSvg.onclick = downloadSvg;
  const btnPng = document.getElementById("btnPng");
  if (btnPng) btnPng.onclick = downloadPng;
  const btnSvgInt = document.getElementById("btnSvgInteractive");
  if (btnSvgInt) btnSvgInt.onclick = downloadInteractiveSVG;
  const btnHtml = document.getElementById("btnHtml");
  if (btnHtml) btnHtml.onclick = downloadInteractiveHTML;
  if (CFG.ADV.keyboardShortcuts) {
    window.addEventListener("keydown", e => {
      if (e.key.toLowerCase() === "r") doReset();
      if (e.key.toLowerCase() === "s") downloadSvg();
    });
  }
}

/* ============================== Verdier/snap ============================== */
function snapHandleToCells() {
  const step = Math.max(1, CFG.SIMPLE.snap);
  const x = clamp(quantize(S.handle.X(), step), 1, S.maxW);
  const y = clamp(quantize(S.handle.Y(), step), 1, S.maxH);
  S.handle.moveTo([x, y]);
}
function updateCountsFromHandle() {
  S.w = Math.round(S.handle.X());
  S.h = Math.round(S.handle.Y());
  syncSimpleConfigFromState();
}

/* ============================== Bounding – alltid plass til alt ============================== */
function adaptView() {
  var _S$board$renderer$can, _S$board$renderer$can2;
  const M = CFG.ADV.margin;
  const out = CFG.ADV.labelOutside,
    gap = CFG.ADV.labelRowGap;
  const bbWanted = [-M.left, S.maxH + M.top, S.maxW + M.right, -M.bottomBase];
  S.board.setBoundingBox(bbWanted, true);
  const needL = CFG.ADV.minPadPx.left,
    needB = CFG.ADV.minPadPx.bottom;
  const Wpx = S.board.canvasWidth || ((_S$board$renderer$can = S.board.renderer.canvasRoot) === null || _S$board$renderer$can === void 0 ? void 0 : _S$board$renderer$can.clientWidth) || 0;
  const Hpx = S.board.canvasHeight || ((_S$board$renderer$can2 = S.board.renderer.canvasRoot) === null || _S$board$renderer$can2 === void 0 ? void 0 : _S$board$renderer$can2.clientHeight) || 0;
  if (Wpx > 0 && Hpx > 0) {
    let [x1, y2, x2, y1] = S.board.getBoundingBox();
    const pxPerX = Wpx / (x2 - x1);
    const pxPerY = Hpx / (y2 - y1);
    const leftGapPx = (-out - x1) * pxPerX;
    if (leftGapPx < needL) {
      x1 -= (needL - leftGapPx) / pxPerX;
    }
    const yTextTop = -(out + gap);
    const bottomGapPx = (yTextTop - y1) * pxPerY;
    if (bottomGapPx < needB) {
      y1 -= (needB - bottomGapPx) / pxPerY;
    }
    S.board.setBoundingBox([x1, y2, x2, y1], true);
  }
  S.board.update();
}

/* ============================== Oppgave/logikk ============================== */
function tryRegisterFound(a, b) {
  if (!S.ch.enabled || !S.ch.N) return;
  if (a * b !== S.ch.N) return;
  S.ch.oriented.add(`${a}×${b}`);
}

/* ============================== Reset & Eksport ============================== */
function doReset() {
  S.w = S.w0;
  S.h = S.h0;
  if (S.handle) S.handle.moveTo([S.w, S.h]);
  S.ch.oriented.clear();
  drawInnerGrid();
  updateLive();
  renderInBoardLists();
  syncSimpleConfigFromState();
}
function serializeSvgFromBoard(board) {
  var _board$renderer;
  if (board !== null && board !== void 0 && board.renderer && typeof board.renderer.dumpToSVG === "function") {
    return board.renderer.dumpToSVG();
  }
  const root = (board === null || board === void 0 || (_board$renderer = board.renderer) === null || _board$renderer === void 0 ? void 0 : _board$renderer.svgRoot) || document.querySelector(`#${board === null || board === void 0 ? void 0 : board.container} svg`);
  if (root) {
    let xml = new XMLSerializer().serializeToString(root);
    if (!xml.startsWith("<?xml")) xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
    return xml;
  }
  throw new Error("SVG-renderer ikke tilgjengelig.");
}
function downloadSvg() {
  try {
    const svgText = serializeSvgFromBoard(S.board);
    const blob = new Blob([svgText], {
      type: "image/svg+xml;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    if ("download" in HTMLAnchorElement.prototype) {
      a.href = url;
      a.download = CFG.ADV.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } else {
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  } catch (e) {
    console.error(e);
    alert("Kunne ikke eksportere SVG: " + e.message);
  }
}
function downloadPng() {
  try {
    const svgText = serializeSvgFromBoard(S.board);
    const blob = new Blob([svgText], {
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
        if ("download" in HTMLAnchorElement.prototype) {
          a.href = urlPng;
          a.download = CFG.ADV.fileName.replace(/\.svg$/i, '.png');
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(urlPng), 0);
        } else {
          window.open(urlPng, "_blank");
          setTimeout(() => URL.revokeObjectURL(urlPng), 4000);
        }
      }, 'image/png');
    };
    img.src = url;
  } catch (e) {
    console.error(e);
    alert("Kunne ikke eksportere PNG: " + e.message);
  }
}

/* ===== Interaktiv SVG – robust: ingen <link>, venter på JXG før start ===== */
function buildInnerJS(E) {
  // *** LISTE-FIKS INNARBEIDET HER ***
  return ['!function(){', 'var E=' + JSON.stringify(E) + ';', 'function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}', 'function quantize(v,s){return s<=0?v:Math.round(v/s)*s;}', 'function areaLabelText(mode,n){if(mode==null)return "Areal: "+n;var s=String(mode).toLowerCase();if(s==="none"||s==="off"||s==="hide")return "";if(s==="areal")return "Areal: "+n;if(s==="ruter"||s==="tiles"||s==="antall")return "Ruter: "+n;return String(mode).indexOf("${N}")>-1?String(mode).replace("${N}",String(n)):String(mode);}', 'var S={w:E.startW,h:E.startH,board:null,handle:null,grid:[],colA:[],colB:[]};', 'function clearGrid(){for(var i=0;i<S.grid.length;i++){S.board.removeObject(S.grid[i]);}S.grid.length=0;}', 'function drawGrid(){clearGrid();if(!E.showGrid)return;for(var j=1;j<S.h;j++){S.grid.push(S.board.create("segment",[[0,j],[S.w,j]],{strokeColor:E.colors.grid,strokeWidth:E.grid.width,dash:E.grid.dash,layer:9,fixed:true,highlight:false}));}for(var i=1;i<S.w;i++){S.grid.push(S.board.create("segment",[[i,0],[i,S.h]],{strokeColor:E.colors.grid,strokeWidth:E.grid.width,dash:E.grid.dash,layer:9,fixed:true,highlight:false}));}}', 'function ensureLine(arr,i,xFn,yFn,ax){if(!arr[i])arr[i]=S.board.create("text",[xFn,yFn,function(){return "";}],{anchorX:ax,anchorY:"top",fixed:true,fontSize:E.fontSize,strokeColor:E.colors.text,highlight:false});return arr[i];}', 'function clearExtra(arr,k){for(var i=k;i<arr.length;i++){arr[i].setText(function(){return "";});}}', 'function adaptView(rows){var M=E.margin,out=E.labelOutside,gap=E.labelRowGap,LI=E.listsInside;var yTop=-(out+gap);var yLow=rows>0?(yTop-(rows-1)*LI.listLineGap):yTop;var y1=yLow-LI.bottomPad;S.board.setBoundingBox([-M.left,E.maxH+M.top,E.maxW+M.right,y1],true);var needL=E.minPadPx.left||20,needB=E.minPadPx.bottom||40;var W=S.board.canvasWidth||S.board.renderer.canvasRoot.clientWidth||0;var H=S.board.canvasHeight||S.board.renderer.canvasRoot.clientHeight||0;if(W>0&&H>0){var bb=S.board.getBoundingBox(),x1=bb[0],y2=bb[1],x2=bb[2],yb=bb[3];var pxX=W/(x2-x1),pxY=H/(y2-yb);var leftPx=(-out - x1)*pxX;if(leftPx<needL){x1-=(needL-leftPx)/pxX;}var rowsDepth=rows>0?(rows-1)*LI.listLineGap:0;var yLow2=yTop-rowsDepth;var bottomPx=(yLow2-yb)*pxY;if(bottomPx<needB){yb-=(needB-bottomPx)/pxY;}S.board.setBoundingBox([x1,y2,x2,yb],true);}S.board.update();}', 'function renderLists(){if(!E.challenge.enabled)return;var out=E.labelOutside,gap=E.labelRowGap,LI=E.listsInside;var y0=function(){return -(out+gap);},xR=function(){return E.maxW-LI.insetX;},xL=function(){return E.maxW-LI.insetX-LI.colGap;};var A=[],B=[];for(var t=0;t<E.challenge.allPairs.length;t++){var a=E.challenge.allPairs[t][0],b=E.challenge.allPairs[t][1];if(window._oriented&&window._oriented.has(a+"x"+b))A.push(a+" · "+b+" = "+E.challenge.N);if(a!==b&&window._oriented&&window._oriented.has(b+"x"+a))B.push(b+" · "+a+" = "+E.challenge.N);}for(var i=0;i<A.length;i++){(function(k){var yF=function(){return y0()-k*LI.listLineGap;};ensureLine(S.colA,k,xL,yF,"right").setText(function(){return A[k];});})(i);}clearExtra(S.colA,A.length);for(i=0;i<B.length;i++){(function(k){var yF=function(){return y0()-k*LI.listLineGap;};ensureLine(S.colB,k,xR,yF,"right").setText(function(){return B[k];});})(i);}clearExtra(S.colB,B.length);adaptView(Math.max(A.length,B.length));}', '// === SPOR FUNN I INNEBYGD MOTOR ===', 'window._oriented=new Set();', 'function registerIfMatch(){var W=Math.round(H.X()),Hh=Math.round(H.Y());if(E.challenge&&E.challenge.enabled&&E.challenge.N&&W*Hh===E.challenge.N){window._oriented.add(W+"x"+Hh);}}', '// === Board ===', 'S.board=JXG.JSXGraph.initBoard("jxgbox",{boundingbox:[0,1,1,0],renderer:"svg",keepaspectratio:true,axis:false,showNavigation:false,showCopyright:false,pan:{enabled:false},zoom:{enabled:false}});', 'var A=S.board.create("point",[0,0],{visible:false,fixed:true});', 'var H=S.board.create("point",[E.startW,E.startH],{withLabel:false,showInfobox:false,face:"circle",size:E.handleRadius,strokeColor:E.colors.handleEdge,fillColor:E.colors.handleFill});', 'var B=S.board.create("point",[function(){return H.X();},0],{visible:false,fixed:true});', 'var C=S.board.create("point",[function(){return H.X();},function(){return H.Y();}],{visible:false,fixed:true});', 'var D=S.board.create("point",[0,function(){return H.Y();}],{visible:false,fixed:true});', 'var poly=S.board.create("polygon",[A,B,C,D],{withLines:true,fillColor:E.colors.fill,fillOpacity:E.opacity,borders:{strokeColor:E.colors.edge,strokeWidth:E.stroke,highlight:false,fixed:true},fixed:true,highlight:false,layer:7});', 'poly.borders.forEach(function(b){b.setAttribute({highlight:false,fixed:true,layer:8});});', 'var out=E.labelOutside,gap=E.labelRowGap;', 'S.board.create("text",[function(){return H.X()/2;},function(){return -out;},function(){return String(Math.round(H.X()));}],{anchorX:"middle",anchorY:"top",fixed:true,fontSize:E.fontSize,strokeColor:E.colors.text});', 'S.board.create("text",[function(){return -out;},function(){return H.Y()/2;},function(){return String(Math.round(H.Y()));}],{anchorX:"right",anchorY:"middle",fixed:true,fontSize:E.fontSize,strokeColor:E.colors.text});', 'S.board.create("text",[function(){return -out;},function(){return -(out+gap);},function(){return areaLabelText(E.areaLabelMode,Math.round(H.X())*Math.round(H.Y()));}],{anchorX:"left",anchorY:"top",fixed:true,fontSize:E.fontSize,strokeColor:E.colors.text});', 'function sync(){S.w=Math.round(H.X());S.h=Math.round(H.Y());drawGrid();registerIfMatch();renderLists();}', 'H.on("drag",function(){var x=Math.max(1,Math.min(E.maxW,quantize(H.X(),E.snap)));var y=Math.max(1,Math.min(E.maxH,quantize(H.Y(),E.snap)));H.moveTo([x,y]);S.w=Math.round(x);S.h=Math.round(y);sync();});', 'H.on("up",function(){H.fire("drag");});', 'sync();', '}();'].join("\n");
}

/* === Interaktiv SVG (ingen <link>, poller JXG før start; unngår XML-feil) === */
function downloadInteractiveSVG() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const E = {
    maxW: S.maxW,
    maxH: S.maxH,
    startW: Math.max(1, S.w || 1),
    startH: Math.max(1, S.h || 1),
    snap: Math.max(1, CFG.SIMPLE.snap),
    showGrid: CFG.SIMPLE.showGrid,
    colors: CFG.ADV.colors,
    opacity: CFG.ADV.opacity,
    stroke: CFG.ADV.stroke,
    grid: CFG.ADV.grid,
    margin: CFG.ADV.margin,
    labelOutside: CFG.ADV.labelOutside,
    labelRowGap: CFG.ADV.labelRowGap,
    listsInside: CFG.ADV.listsInside,
    fontSize: isMobile ? Math.round(CFG.ADV.fontSize * 1.15) : CFG.ADV.fontSize,
    handleRadius: isMobile ? Math.round(CFG.ADV.handleRadius * 1.3) : CFG.ADV.handleRadius,
    areaLabelMode: CFG.SIMPLE.areaLabel,
    minPadPx: CFG.ADV.minPadPx,
    challenge: {
      enabled: S.ch.enabled,
      N: S.ch.N,
      dedupeOrderless: S.ch.dedupeOrderless,
      allPairs: S.ch.allPairs
    }
  };
  const innerJS = buildInnerJS(E);
  const b64 = btoa(innerJS);
  const parts = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="750" viewBox="0 0 1100 750">');
  parts.push('<foreignObject x="0" y="0" width="100%" height="100%">');
  parts.push('<div xmlns="http://www.w3.org/1999/xhtml" style="width:100%;height:100%;position:relative">');
  parts.push('<div id="jxgbox" class="jxgbox" style="width:100%;height:100%"></div>');
  parts.push('<' + 'script src="/vendor/cdn/jsxgraph/jsxgraphcore.js">' + '</' + 'script>');
  // vent til JXG finnes, deretter eval innerJS (base64) – kun trygge ASCII-tegn i elementet
  parts.push('<' + 'script>(function(){var s="' + b64 + '";(function start(){if(window.JXG&&document.getElementById("jxgbox")){eval(atob(s));}else{setTimeout(start,50);}})();})();</' + 'script>');
  parts.push('</div></foreignObject></svg>');
  const svg = parts.join('');
  const blob = new Blob([svg], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "arealmodell_interaktiv.svg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ===== Single-file HTML – samme motor som over ===== */
function downloadInteractiveHTML() {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const E = {
    maxW: S.maxW,
    maxH: S.maxH,
    startW: S.w,
    startH: S.h,
    snap: Math.max(1, CFG.SIMPLE.snap),
    showGrid: CFG.SIMPLE.showGrid,
    colors: CFG.ADV.colors,
    opacity: CFG.ADV.opacity,
    stroke: CFG.ADV.stroke,
    grid: CFG.ADV.grid,
    margin: CFG.ADV.margin,
    labelOutside: CFG.ADV.labelOutside,
    labelRowGap: CFG.ADV.labelRowGap,
    listsInside: CFG.ADV.listsInside,
    fontSize: isMobile ? Math.round(CFG.ADV.fontSize * 1.15) : CFG.ADV.fontSize,
    handleRadius: isMobile ? Math.round(CFG.ADV.handleRadius * 1.3) : CFG.ADV.handleRadius,
    areaLabelMode: CFG.SIMPLE.areaLabel,
    minPadPx: CFG.ADV.minPadPx,
    challenge: {
      enabled: S.ch.enabled,
      N: S.ch.N,
      dedupeOrderless: S.ch.dedupeOrderless,
      allPairs: S.ch.allPairs
    }
  };
  const innerJS = buildInnerJS(E);
  const b64 = btoa(innerJS);
  const html = [];
  html.push('<!doctype html><html><head><meta charset="utf-8">');
  html.push('<meta name="viewport" content="width=device-width,initial-scale=1">');
  html.push('<title>Arealmodell interaktiv</title>');
  html.push('<style>html,body{height:100%;margin:0}#jxgbox{width:100%;height:100%}</style>');
  html.push('</head><body>');
  html.push('<div id="jxgbox" class="jxgbox"></div>');
  html.push('<' + 'script src="/vendor/cdn/jsxgraph/jsxgraphcore.js">' + '</' + 'script>');
  html.push('<' + 'script>(function(){var s="' + b64 + '";(function start(){if(window.JXG&&document.getElementById("jxgbox")){eval(atob(s));}else{setTimeout(start,50);}})();})();</' + 'script>');
  html.push('</body></html>');
  const blob = new Blob([html.join("")], {
    type: "text/html;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "arealmodell_interaktiv.html";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ============================== Init ============================== */
function refreshThemeAndRebuild() {
  applyThemeToDocument();
  CFG.ADV.colors = resolveAdvColors();
  rebuildFromConfig();
}
function handleThemeProfileMessage(event) {
  const data = event && event.data;
  const type = typeof data === 'string' ? data : data && data.type;
  if (type !== 'math-visuals:profile-change') return;
  refreshThemeAndRebuild();
}
function handleThemeSettingsChanged() {
  refreshThemeAndRebuild();
}
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('message', handleThemeProfileMessage);
  window.addEventListener('math-visuals:settings-changed', handleThemeSettingsChanged);
}
document.addEventListener("DOMContentLoaded", () => {
  initFromHtml();
  document.querySelectorAll('#settingsMenu input, #settingsMenu select').forEach(el => {
    el.addEventListener('change', initFromHtml);
    el.addEventListener('input', initFromHtml);
  });
});
function applyConfigToInputs() {
  ensureSimpleDefaults();
  const simple = (CFG === null || CFG === void 0 ? void 0 : CFG.SIMPLE) || {};
  const len = simple.length || {};
  const hei = simple.height || {};
  const challenge = simple.challenge || {};
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (el && value != null && value !== "") el.value = String(value);
  };
  const setChk = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!value;
  };
  setVal("lenCells", len.cells);
  setVal("lenMax", len.max);
  setVal("heiCells", hei.cells);
  setVal("heiMax", hei.max);
  setChk("chkGrid", simple.showGrid !== false);
  if (simple.snap != null) setVal("snap", simple.snap);
  const areaInput = document.getElementById("areaLabel");
  if (areaInput && simple.areaLabel != null) areaInput.value = String(simple.areaLabel);
  setChk("chkChallenge", !!challenge.enabled);
  if (challenge.area != null) setVal("challengeArea", challenge.area);
}
function applyExamplesConfig() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyExamplesConfig, {
      once: true
    });
    return;
  }
  ensureSimpleDefaults();
  applyConfigToInputs();
  rebuildFromConfig();
}
if (typeof window !== 'undefined') {
  window.applyConfig = applyExamplesConfig;
  window.applyState = applyExamplesConfig;
  window.render = applyExamplesConfig;
  window.rebuildFromConfig = rebuildFromConfig;
}
