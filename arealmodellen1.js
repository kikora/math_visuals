/* =========================================================
   KONFIG – SIMPLE (viktigst) + ADV (alt annet)
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

const CFG = {
  SIMPLE: {
    layout: "quad",
    height: {
      cells: 16,
      handle: 5,
      show: true,
      showHandle: true
    },
    // rader, horisontal deling (fra bunn)
    length: {
      cells: 17,
      handle: 3,
      show: true,
      showHandle: true
    }, // kolonner, vertikal deling (fra venstre)
    totalHandle: {
      show: false,
      maxCols: 30,
      maxRows: 30
    },
    variable1: "",
    variable2: "",
    showSum: false,
    challenge: {
      enabled: false,
      area: 12,
      dedupeOrderless: true,
      autoExpandMax: true
    },
    altText: "",
    altTextSource: "auto"
  },
  ADV: {
    svgId: "area",
    unit: 40,
    margins: {
      l: 140,
      r: 60,
      t: 60,
      b: 140
    },
    grid: false,
    splitLines: true,
    clickToMove: true,
    drag: {
      vertical: true,
      horizontal: true
    },
    limits: {
      minColsEachSide: 0,
      minRowsEachSide: 0
    },
    // Håndtak (piler)
    handleIcons: {
      vert: "https://test.kikora.no/img/drive/figures/UIclientObjects/arrows/moveV.svg",
      horiz: "https://test.kikora.no/img/drive/figures/UIclientObjects/arrows/moveH.svg",
      size: 84
    },
    classes: {
      outer: "outer",
      grid: "grid",
      split: "split",
      handle: "handleImg",
      labelCell: "labelCell",
      labelEdge: "labelEdge",
      cells: ["c1", "c2", "c3", "c4"]
    },
    colors: ["#e07c7c", "#f0c667", "#7fb2d6", "#8bb889"],
    fit: {
      maxVh: 100,
      maxVw: 100,
      safePad: {
        top: 8,
        right: 8,
        bottom: 64,
        left: 8
      } // ekstra plass i vinduet
    },
    labels: {
      cellMode: "factors",
      // "factors" | "area" | "both" | "none"
      edgeMode: "counts",
      // "counts" | "none"
      edgeInside: false,
      // utenfor rektangelet
      dot: " · ",
      equals: " = "
    },
    check: {
      ten: 10
    },
    export: {
      filename: "arealmodell_interaktiv.svg",
      includeGrid: false,
      includeHandlesIfHidden: true
      // valgfri – brukes hvis satt:
      // filenameHtml: "arealmodell_interaktiv.html"
    }
  }
};
const DEFAULT_RECT_COLORS = ["#e07c7c", "#f0c667", "#7fb2d6", "#8bb889"];
const AREAL_GROUP_ID = "arealmodell";
const CAMPUS_RECT_ORDER = [0, 5, 2, 4];
function getThemeApi() {
  const theme = typeof window !== "undefined" ? window.MathVisualsTheme : null;
  return theme && typeof theme === "object" ? theme : null;
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
    theme.applyToDocument(document);
  }
}
function ensureColors(base, fallback, count) {
  const baseColors = sanitizePaletteList(base);
  const fallbackColors = sanitizePaletteList(fallback);
  const safeFallback = fallbackColors.length ? fallbackColors : sanitizePaletteList(DEFAULT_RECT_COLORS);
  if (!Number.isFinite(count) || count <= 0) {
    if (baseColors.length) return baseColors.slice();
    if (safeFallback.length) return safeFallback.slice();
    return baseColors.slice();
  }
  const size = Math.max(1, Math.trunc(count));
  if (baseColors.length >= size) return baseColors.slice(0, size);
  const result = baseColors.slice();
  const fallbackSource = safeFallback.length ? safeFallback : baseColors;
  while (result.length < size && fallbackSource.length) {
    const next = fallbackSource[result.length % fallbackSource.length];
    if (typeof next === "string" && next) {
      result.push(next);
    } else {
      break;
    }
  }
  if (!result.length && safeFallback.length) {
    return safeFallback.slice(0, size);
  }
  return result;
}
function reorderPaletteForProject(palette, project) {
  if (project !== "campus") return sanitizePaletteList(palette);
  const source = sanitizePaletteList(palette);
  if (!source.length) return source;
  return CAMPUS_RECT_ORDER.map(idx => source[idx % source.length] || source[0]);
}
function resolveRectColors(count = DEFAULT_RECT_COLORS.length) {
  const theme = getThemeApi();
  const project = getActiveThemeProjectName(theme);
  const targetCount = Number.isFinite(count) && count > 0 ? Math.trunc(count) : DEFAULT_RECT_COLORS.length;
  const servicePalette = paletteService.resolveGroupPalette({
    groupId: AREAL_GROUP_ID,
    count: targetCount,
    project: project || undefined,
    fallback: DEFAULT_RECT_COLORS,
    legacyPaletteId: "figures",
    fallbackKinds: ["fractions"]
  });
  if ((!project || project !== "kikora") && Array.isArray(servicePalette) && servicePalette.length) {
    const reordered = reorderPaletteForProject(servicePalette, project);
    if (reordered.length) {
      return ensureColors(reordered, reordered, targetCount);
    }
  }
  if (theme && typeof theme.getGroupPalette === "function") {
    let palette = null;
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
    if ((!project || project !== "kikora") && Array.isArray(palette) && palette.length) {
      const reordered = reorderPaletteForProject(palette, project);
      if (reordered.length) {
        return ensureColors(reordered, DEFAULT_RECT_COLORS, targetCount);
      }
    }
  }
  if (theme && typeof theme.getPalette === "function") {
    try {
      const palette = theme.getPalette("figures", targetCount, { fallbackKinds: ["fractions"], project });
      if ((!project || project !== "kikora") && Array.isArray(palette) && palette.length) {
        const reordered = reorderPaletteForProject(palette, project);
        if (reordered.length) {
          return ensureColors(reordered, DEFAULT_RECT_COLORS, targetCount);
        }
      }
    } catch (_) {}
  }
  return ensureColors(DEFAULT_RECT_COLORS, DEFAULT_RECT_COLORS, targetCount);
}
applyThemeToDocument();
CFG.ADV.colors = resolveRectColors();
let runtimeStyleElement = null;
const DEFAULT_SIMPLE_CFG = JSON.parse(JSON.stringify(CFG.SIMPLE));
const DEFAULT_ADV_CFG = JSON.parse(JSON.stringify(CFG.ADV));
let cleanupCurrentDraw = null;
const layoutStateStore = Object.create(null);
let currentLayoutMode = null;
let lastVisibleCellMode = "factors";
const challengeRuntime = {
  enabled: false,
  active: false,
  N: null,
  dedupeOrderless: true,
  autoExpandMax: true,
  allPairs: [],
  oriented: new Set()
};
let altTextManager = null;
const arealIntFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO') : null;
const SUM_BRACE_TOP_IMAGE = "images/Union.svg";
const SUM_BRACE_LEFT_IMAGE = "images/UnionVertical.svg";
function sanitizeVariableName(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\s+/g, '').replace(/[^0-9A-Za-zÆØÅæøå]/g, '');
}
function getVariableSettings(simple = CFG.SIMPLE || {}) {
  const v1 = sanitizeVariableName(simple.variable1);
  const v2 = sanitizeVariableName(simple.variable2);
  return {
    variable1: v1,
    variable2: v2,
    hasVariables: !!(v1 || v2)
  };
}
function createAxisPart(value, variableName) {
  const numericValue = Number.isFinite(value) ? value : NaN;
  if (!Number.isFinite(value) || value <= 0) {
    return {
      value: numericValue,
      token: '',
      display: '',
      isVariable: false
    };
  }
  const cleaned = sanitizeVariableName(variableName);
  if (cleaned) {
    return {
      value: numericValue,
      token: cleaned,
      display: cleaned,
      isVariable: true
    };
  }
  const label = arealFormatInt(value);
  return {
    value: numericValue,
    token: label,
    display: label,
    isVariable: false
  };
}
function computeAxisParts(layoutState, variables) {
  const v = variables || getVariableSettings();
  return {
    columns: {
      left: createAxisPart(layoutState.leftCols, v.variable1),
      right: createAxisPart(layoutState.rightCols, v.variable2)
    },
    rows: {
      bottom: createAxisPart(layoutState.bottomRows, v.variable1),
      top: createAxisPart(layoutState.topRows, v.variable2)
    }
  };
}
function buildAlgebraProduct(rowPart, colPart) {
  if (!rowPart || !colPart) return '';
  const rowVar = rowPart.isVariable ? rowPart.token : '';
  const colVar = colPart.isVariable ? colPart.token : '';
  const rowNum = !rowPart.isVariable && Number.isFinite(rowPart.value) ? arealFormatInt(rowPart.value) : '';
  const colNum = !colPart.isVariable && Number.isFinite(colPart.value) ? arealFormatInt(colPart.value) : '';
  if (!rowVar && !colVar) return '';
  if (rowVar && colVar) {
    if (rowVar === colVar) return `${rowVar}\u00B2`;
    return `${rowVar}${colVar}`;
  }
  if (rowVar && colNum) return `${colNum}${rowVar}`;
  if (rowNum && colVar) return `${rowNum}${colVar}`;
  if (rowVar) return rowVar;
  if (colVar) return colVar;
  return '';
}
function formatCellLabelFromParts(colPart, rowPart, cellMode, dot, equals) {
  if (!colPart || !rowPart || cellMode === 'none') return '';
  const colLabel = colPart.isVariable ? colPart.token : (Number.isFinite(colPart.value) ? arealFormatInt(colPart.value) : '');
  const rowLabel = rowPart.isVariable ? rowPart.token : (Number.isFinite(rowPart.value) ? arealFormatInt(rowPart.value) : '');
  const factorLabel = colLabel && rowLabel ? `${colLabel}${dot}${rowLabel}` : (colLabel || rowLabel || '');
  const numericProduct = Number.isFinite(colPart.value) && Number.isFinite(rowPart.value) ? arealFormatInt(colPart.value * rowPart.value) : '';
  const algebraProduct = buildAlgebraProduct(rowPart, colPart);
  const hasVariables = algebraProduct !== '';
  if (cellMode === 'factors') {
    if (rowPart.isVariable && colPart.isVariable) {
      return algebraProduct || factorLabel;
    }
    if (rowPart.isVariable && Number.isFinite(colPart.value)) {
      return algebraProduct || rowPart.token;
    }
    if (colPart.isVariable && Number.isFinite(rowPart.value)) {
      return algebraProduct || colPart.token;
    }
    if (rowPart.isVariable) return rowPart.token;
    if (colPart.isVariable) return colPart.token;
    return factorLabel;
  }
  if (cellMode === 'area') {
    return hasVariables ? algebraProduct : numericProduct;
  }
  if (cellMode === 'both') {
    const right = hasVariables ? algebraProduct : numericProduct;
    if (factorLabel && right) return `${factorLabel}${equals}${right}`;
    return factorLabel || right || '';
  }
  return factorLabel;
}
function buildSumLabel(partA, partB) {
  const terms = [];
  if (partA && partA.display) terms.push(partA.display);
  if (partB && partB.display) terms.push(partB.display);
  if (!terms.length) return '';
  return terms.join('+');
}
function ensureCfgDefaults() {
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
  if (!CFG.ADV || typeof CFG.ADV !== 'object') CFG.ADV = {};
  fill(CFG.SIMPLE, DEFAULT_SIMPLE_CFG);
  fill(CFG.ADV, DEFAULT_ADV_CFG);
  if (CFG.SIMPLE && typeof CFG.SIMPLE === 'object') {
    CFG.SIMPLE.variable1 = sanitizeVariableName(CFG.SIMPLE.variable1);
    CFG.SIMPLE.variable2 = sanitizeVariableName(CFG.SIMPLE.variable2);
    CFG.SIMPLE.showSum = CFG.SIMPLE.showSum === true;
    const legacyLayout = (() => {
      if (CFG.SIMPLE.layout != null) return CFG.SIMPLE.layout;
      if (CFG.SIMPLE.layoutMode != null) return CFG.SIMPLE.layoutMode;
      if (CFG.layoutMode != null) return CFG.layoutMode;
      return null;
    })();
    if (legacyLayout != null) {
      CFG.SIMPLE.layout = normalizeLayout(legacyLayout);
    }
  }
  if (CFG.ADV.labels && typeof CFG.ADV.labels === "object" && CFG.ADV.labels.cellMode && CFG.ADV.labels.cellMode !== "none") {
    lastVisibleCellMode = CFG.ADV.labels.cellMode;
  }
}
function normalizeLayout(value) {
  if (typeof value !== "string") return "quad";
  const trimmed = value.trim();
  if (!trimmed) return "quad";
  const lower = trimmed.toLowerCase();
  const normalizedX = lower.replace(/×/g, "x");
  const collapsed = normalizedX.replace(/[\s_-]+/g, "");
  const aliasMap = {
    single: "single",
    singlerect: "single",
    singlerectangle: "single",
    singlerektangel: "single",
    singlerektangler: "single",
    singlelayout: "single",
    singlemode: "single",
    singlelayoutmode: "single",
    singlerectmode: "single",
    onerect: "single",
    onerectangle: "single",
    onerektangel: "single",
    onerektangler: "single",
    one: "single",
    "1": "single",
    "1rect": "single",
    "1rektangel": "single",
    "1rektangler": "single",
    horizontal: "horizontal",
    horizontalsplit: "horizontal",
    splitvertical: "horizontal",
    leftright: "horizontal",
    sidebyside: "horizontal",
    sidetoside: "horizontal",
    vedsidenavhverandre: "horizontal",
    vertical: "vertical",
    verticalsplit: "vertical",
    splithorizontal: "vertical",
    topbottom: "vertical",
    overunder: "vertical",
    overhverandre: "vertical",
    underhverandre: "vertical",
    stacked: "vertical",
    quad: "quad",
    quadmode: "quad",
    quadsplit: "quad",
    quadrants: "quad",
    quadrant: "quad",
    four: "quad",
    fourrectangles: "quad",
    fourrects: "quad",
    kvadrat: "quad",
    kvadrant: "quad",
    layoutquad: "quad",
    quadlayout: "quad",
    twobytwo: "quad",
    twoxtwo: "quad",
    towxtwo: "quad",
    "2x2": "quad",
    "2by2": "quad",
    "2b2": "quad"
  };
  if (aliasMap[collapsed]) return aliasMap[collapsed];
  if (normalizedX.includes("single")) return "single";
  if (normalizedX.includes("horizontal") || normalizedX.includes("leftright") || normalizedX.includes("sidebyside") || normalizedX.includes("vedsidenav")) {
    return "horizontal";
  }
  if (normalizedX.includes("vertical") || normalizedX.includes("topbottom") || normalizedX.includes("overunder") || normalizedX.includes("overhverandre") || normalizedX.includes("underhverandre") || normalizedX.includes("stack")) {
    return "vertical";
  }
  if (normalizedX.includes("quad") || normalizedX.includes("2x2") || normalizedX.includes("four") || normalizedX.includes("kvadr")) {
    return "quad";
  }
  return "quad";
}

function ensureLayoutSelectValue(value) {
  if (typeof document === "undefined") return;
  const select = document.getElementById("layoutMode");
  if (!select) return;
  const normalized = normalizeLayout(value);
  let option = Array.from(select.options).find(opt => opt.value === normalized);
  if (!option) {
    option = document.createElement("option");
    option.value = normalized;
    switch (normalized) {
      case "single":
        option.textContent = "1 rektangel";
        break;
      case "horizontal":
        option.textContent = "2 ved siden av hverandre";
        break;
      case "vertical":
        option.textContent = "2 over hverandre";
        break;
      default:
        option.textContent = "4 rektangler (2 × 2)";
        break;
    }
    option.dataset.legacyLayout = "true";
    select.appendChild(option);
  }
  if (select.value !== normalized) {
    select.value = normalized;
  }
}
function arealFormatInt(value) {
  if (!Number.isFinite(value)) return String(value);
  return arealIntFormatter ? arealIntFormatter.format(value) : String(value);
}
function arealToInt(value) {
  const num = Math.round(Number(value));
  return Number.isFinite(num) ? num : null;
}
function arealClampInt(value, min, max, fallback) {
  let candidate = arealToInt(value);
  if (candidate == null) candidate = arealToInt(fallback);
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = Number.isFinite(min) ? min : 0;
  if (candidate == null) candidate = min;
  if (candidate < min) candidate = min;
  if (candidate > max) candidate = max;
  return candidate;
}
function arealFormatCount(value, singular, pluralOverride) {
  const pluralForms = {
    kolonne: "kolonner",
    rad: "rader",
    rute: "ruter",
    del: "deler"
  };
  const plural = pluralOverride || pluralForms[singular] || `${singular}er`;
  const abs = Math.abs(value);
  const word = abs === 1 ? singular : plural;
  return `${arealFormatInt(value)} ${word}`;
}
function arealJoinList(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} og ${items[1]}`;
  const head = items.slice(0, -1);
  const tail = items[items.length - 1];
  return `${head.join(', ')} og ${tail}`;
}
function getArealmodellAltSummary() {
  ensureCfgDefaults();
  const simple = CFG.SIMPLE || {};
  const adv = CFG.ADV || {};
  const layout = normalizeLayout(simple.layout);
  const variables = getVariableSettings(simple);
  const totalCols = Math.max(1, arealClampInt(simple.length && simple.length.cells, 1, Number.MAX_SAFE_INTEGER, 1));
  const totalRows = Math.max(1, arealClampInt(simple.height && simple.height.cells, 1, Number.MAX_SAFE_INTEGER, 1));
  const defaultLeft = Math.floor(totalCols / 2);
  const defaultBottom = Math.floor(totalRows / 2);
  let leftCols = totalCols;
  let rightCols = 0;
  if (layout !== "vertical" && layout !== "single") {
    leftCols = arealClampInt(simple.length && simple.length.handle, 0, totalCols, defaultLeft);
    rightCols = Math.max(0, totalCols - leftCols);
  }
  let bottomRows = totalRows;
  let topRows = 0;
  if (layout !== "horizontal" && layout !== "single") {
    bottomRows = arealClampInt(simple.height && simple.height.handle, 0, totalRows, defaultBottom);
    topRows = Math.max(0, totalRows - bottomRows);
  }
  const labels = adv.labels || {};
  const cellMode = typeof labels.cellMode === "string" ? labels.cellMode : "factors";
  const edgeMode = typeof labels.edgeMode === "string" ? labels.edgeMode : "counts";
  const showLengthAxis = totalCols > 1 && (!simple.length || simple.length.show !== false);
  const showHeightAxis = layout !== "horizontal" && totalRows > 1 && (!simple.height || simple.height.show !== false);
  return {
    layout,
    totalCols,
    totalRows,
    leftCols,
    rightCols,
    bottomRows,
    topRows,
    showGrid: adv.grid !== false,
    cellMode,
    edgeMode,
    splitLines: adv.splitLines !== false,
    showLengthAxis,
    showHeightAxis,
    challengeActive: !!challengeRuntime.active,
    challengeGoal: challengeRuntime.N != null ? Math.round(Number(challengeRuntime.N)) : null,
    variable1: variables.variable1,
    variable2: variables.variable2,
    showSum: simple.showSum === true
  };
}
function buildArealmodellAltText(summary) {
  const data = summary || getArealmodellAltSummary();
  if (!data) return "Arealmodell.";
  const sentences = [];
  sentences.push(`Figuren viser en arealmodell med ${arealFormatCount(data.totalCols, 'kolonne')} og ${arealFormatCount(data.totalRows, 'rad')}.`);
  sentences.push(data.showGrid ? "Rutenettet er synlig." : "Rutenettet er skjult.");
  const totalArea = data.totalCols * data.totalRows;
  const hasVerticalSplit = data.leftCols > 0 && data.rightCols > 0 && data.layout !== "vertical" && data.layout !== "single";
  const hasHorizontalSplit = data.topRows > 0 && data.bottomRows > 0 && data.layout !== "horizontal" && data.layout !== "single";
  if (!hasVerticalSplit && !hasHorizontalSplit) {
    sentences.push(`Totalt areal er ${arealFormatCount(totalArea, 'rute')}.`);
  } else {
    if (hasVerticalSplit) {
      sentences.push(`Rektangelet er delt vertikalt i ${arealFormatCount(data.leftCols, 'kolonne')} til venstre og ${arealFormatCount(data.rightCols, 'kolonne')} til høyre.`);
      sentences.push(`Venstre del dekker ${arealFormatCount(data.leftCols * data.totalRows, 'rute')} (${arealFormatInt(data.leftCols)}×${arealFormatInt(data.totalRows)}).`);
      sentences.push(`Høyre del dekker ${arealFormatCount(data.rightCols * data.totalRows, 'rute')} (${arealFormatInt(data.rightCols)}×${arealFormatInt(data.totalRows)}).`);
    }
    if (hasHorizontalSplit) {
      sentences.push(`Rektangelet er delt horisontalt i ${arealFormatCount(data.bottomRows, 'rad')} nederst og ${arealFormatCount(data.topRows, 'rad')} øverst.`);
      sentences.push(`Nederste del dekker ${arealFormatCount(data.bottomRows * data.totalCols, 'rute')} (${arealFormatInt(data.totalCols)}×${arealFormatInt(data.bottomRows)}).`);
      sentences.push(`Øverste del dekker ${arealFormatCount(data.topRows * data.totalCols, 'rute')} (${arealFormatInt(data.totalCols)}×${arealFormatInt(data.topRows)}).`);
    }
    if (data.layout === "quad") {
      const quadParts = [];
      if (data.leftCols > 0 && data.topRows > 0) quadParts.push(`øverst til venstre ${arealFormatCount(data.leftCols * data.topRows, 'rute')} (${arealFormatInt(data.leftCols)}×${arealFormatInt(data.topRows)})`);
      if (data.rightCols > 0 && data.topRows > 0) quadParts.push(`øverst til høyre ${arealFormatCount(data.rightCols * data.topRows, 'rute')} (${arealFormatInt(data.rightCols)}×${arealFormatInt(data.topRows)})`);
      if (data.leftCols > 0 && data.bottomRows > 0) quadParts.push(`nederst til venstre ${arealFormatCount(data.leftCols * data.bottomRows, 'rute')} (${arealFormatInt(data.leftCols)}×${arealFormatInt(data.bottomRows)})`);
      if (data.rightCols > 0 && data.bottomRows > 0) quadParts.push(`nederst til høyre ${arealFormatCount(data.rightCols * data.bottomRows, 'rute')} (${arealFormatInt(data.rightCols)}×${arealFormatInt(data.bottomRows)})`);
      if (quadParts.length) sentences.push(`Dette gir fire delrektangler: ${arealJoinList(quadParts)}.`);
    }
  }
  if (data.variable1 || data.variable2) {
    const varParts = [];
    if (data.variable1) varParts.push(`variabel 1 = ${data.variable1}`);
    if (data.variable2) varParts.push(`variabel 2 = ${data.variable2}`);
    sentences.push(`Variabler i modellen: ${arealJoinList(varParts)}.`);
  }
  if (data.showSum) {
    sentences.push('Klammeparenteser viser summene langs topp- og venstresiden.');
  }
  switch (data.cellMode) {
    case "none":
      sentences.push("Delene er uten regnestykker.");
      break;
    case "factors":
      sentences.push("Delene er merket med faktorene for lengde og høyde.");
      break;
    case "area":
      sentences.push("Delene er merket med areal i ruter.");
      break;
    default:
      sentences.push("Delene er merket med faktorene og resultatet.");
  }
  if (data.edgeMode === "counts") {
    if (data.showLengthAxis || data.showHeightAxis) sentences.push("Tall langs kantene viser antall kolonner og rader.");
  } else if (data.showLengthAxis || data.showHeightAxis) {
    sentences.push("Kantene har ikke tallmarkeringer.");
  }
  if (!data.splitLines && (hasVerticalSplit || hasHorizontalSplit)) {
    sentences.push("Delingslinjene er skjult.");
  }
  if (data.challengeActive && data.challengeGoal) {
    sentences.push(`Oppgavevisning er aktiv for areal ${arealFormatInt(data.challengeGoal)}.`);
  }
  return sentences.filter(Boolean).join(' ');
}
function getArealmodellTitle() {
  const base = typeof document !== 'undefined' && document && document.title ? document.title : 'Arealmodell';
  const summary = getArealmodellAltSummary();
  if (!summary) return base;
  const suffix = `${arealFormatInt(summary.totalCols)}×${arealFormatInt(summary.totalRows)} ruter`;
  return `${base} – ${suffix}`;
}
function getActiveArealmodellAltText() {
  const stored = typeof CFG.SIMPLE.altText === 'string' ? CFG.SIMPLE.altText.trim() : '';
  const source = CFG.SIMPLE.altTextSource === 'manual' ? 'manual' : 'auto';
  if (source === 'manual' && stored) return stored;
  return stored || buildArealmodellAltText();
}
function buildArealmodellExportMeta() {
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const summary = getArealmodellAltSummary();
  const altText = getActiveArealmodellAltText();
  const colLabel = arealFormatInt(summary.totalCols);
  const rowLabel = arealFormatInt(summary.totalRows);
  const description = altText || `Arealmodell med ${colLabel} kolonner og ${rowLabel} rader.`;
  const baseParts = ['arealmodell'];
  if (Number.isFinite(summary.totalCols) && Number.isFinite(summary.totalRows)) {
    baseParts.push(`${summary.totalCols}x${summary.totalRows}`);
  }
  if (summary.layout && summary.layout !== 'quad') {
    baseParts.push(summary.layout);
  }
  const slugBase = baseParts.join(' ');
  const defaultBaseName = helper && typeof helper.slugify === 'function'
    ? helper.slugify(slugBase, 'arealmodell')
    : slugBase
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'arealmodell';
  return {
    description,
    defaultBaseName,
    summary: {
      layout: summary.layout,
      totalCols: summary.totalCols,
      totalRows: summary.totalRows,
      leftCols: summary.leftCols,
      rightCols: summary.rightCols,
      bottomRows: summary.bottomRows,
      topRows: summary.topRows,
      showGrid: summary.showGrid,
      cellMode: summary.cellMode,
      edgeMode: summary.edgeMode,
      splitLines: summary.splitLines,
      showLengthAxis: summary.showLengthAxis,
      showHeightAxis: summary.showHeightAxis,
      challengeActive: summary.challengeActive,
      challengeGoal: summary.challengeGoal,
      altText
    },
    title: getArealmodellTitle()
  };
}
function maybeRefreshAltText(reason) {
  const summary = getArealmodellAltSummary();
  const signature = JSON.stringify(summary);
  if (altTextManager && typeof altTextManager.refresh === 'function') {
    altTextManager.refresh(reason || 'auto', signature);
  } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
    altTextManager.notifyFigureChange(signature);
  }
}
function escapeXml(text) {
  if (text == null) return '';
  return String(text).replace(/[&<>'"]/g, ch => {
    switch (ch) {
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
        return ch;
    }
  });
}
function initAltTextManager() {
  if (typeof window === 'undefined' || !window.MathVisAltText) return;
  const svg = document.getElementById('area');
  const container = document.getElementById('exportCard');
  if (!svg || !container) return;
  altTextManager = window.MathVisAltText.create({
    svg,
    container,
    getTitle: getArealmodellTitle,
    getState: () => ({
      text: typeof CFG.SIMPLE.altText === 'string' ? CFG.SIMPLE.altText : '',
      source: CFG.SIMPLE.altTextSource === 'manual' ? 'manual' : 'auto'
    }),
    setState: (text, source) => {
      CFG.SIMPLE.altText = text;
      CFG.SIMPLE.altTextSource = source === 'manual' ? 'manual' : 'auto';
    },
    generate: () => buildArealmodellAltText(),
    getSignature: () => JSON.stringify(getArealmodellAltSummary()),
    getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
    getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
  });
  if (altTextManager) {
    altTextManager.applyCurrent();
    maybeRefreshAltText('init');
  }
}
currentLayoutMode = normalizeLayout((CFG !== null && CFG !== void 0 && CFG.SIMPLE ? CFG.SIMPLE.layout : null));
function factorPairsSorted(N) {
  const out = [];
  for (let a = 1; a * a <= N; a++) {
    if (N % a === 0) out.push([a, N / a]);
  }
  return out;
}
function renderChallengeList() {
  if (typeof document === "undefined") return;
  const wrap = document.getElementById("challengePairs");
  const colA = document.getElementById("challengeListA");
  const colB = document.getElementById("challengeListB");
  if (!wrap || !colA || !colB) return;
  if (!challengeRuntime.active || !challengeRuntime.N) {
    wrap.hidden = true;
    colA.innerHTML = "";
    colB.innerHTML = "";
    return;
  }
  const linesA = [];
  const linesB = [];
  if (challengeRuntime.dedupeOrderless) {
    for (const [a, b] of challengeRuntime.allPairs) {
      if (challengeRuntime.oriented.has(`${a}×${b}`)) {
        linesA.push(`${a} · ${b} = ${challengeRuntime.N}`);
      }
      if (a !== b && challengeRuntime.oriented.has(`${b}×${a}`)) {
        linesB.push(`${b} · ${a} = ${challengeRuntime.N}`);
      }
    }
  } else {
    const items = Array.from(challengeRuntime.oriented).map(key => key.split("×").map(v => parseInt(v, 10))).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    for (const [a, b] of items) {
      linesA.push(`${a} · ${b} = ${challengeRuntime.N}`);
    }
  }
  if (linesA.length === 0 && linesB.length === 0) {
    colA.innerHTML = "";
    colB.innerHTML = "";
    wrap.hidden = true;
    return;
  }
  colA.innerHTML = linesA.map(text => `<div>${text}</div>`).join("");
  colB.innerHTML = linesB.map(text => `<div>${text}</div>`).join("");
  wrap.hidden = false;
}
function syncChallengeState(layoutMode) {
  ensureCfgDefaults();
  if (!CFG.SIMPLE.challenge || typeof CFG.SIMPLE.challenge !== "object") {
    CFG.SIMPLE.challenge = {};
  }
  const challengeCfg = CFG.SIMPLE.challenge;
  const parsedArea = Math.round(Number(challengeCfg.area));
  const area = Number.isFinite(parsedArea) && parsedArea > 0 ? parsedArea : null;
  const enabled = !!challengeCfg.enabled && area != null;
  const dedupe = challengeCfg.dedupeOrderless !== false;
  const autoExpand = challengeCfg.autoExpandMax !== false;
  const areaChanged = area !== challengeRuntime.N;
  const enabledChanged = enabled !== challengeRuntime.enabled;
  const dedupeChanged = dedupe !== challengeRuntime.dedupeOrderless;
  const autoChanged = autoExpand !== challengeRuntime.autoExpandMax;
  if (areaChanged || enabledChanged) {
    challengeRuntime.oriented.clear();
  }
  challengeRuntime.N = area;
  challengeRuntime.enabled = enabled;
  challengeRuntime.dedupeOrderless = dedupe;
  challengeRuntime.autoExpandMax = autoExpand;
  if (enabled && area != null) {
    challengeRuntime.allPairs = factorPairsSorted(area);
  } else {
    challengeRuntime.allPairs = [];
  }
  const normalizedLayout = normalizeLayout(layoutMode != null ? layoutMode : currentLayoutMode);
  const active = enabled && normalizedLayout === "single" && area != null;
  const activeChanged = active !== challengeRuntime.active;
  challengeRuntime.active = active;
  if (!active) {
    if (activeChanged || enabledChanged || areaChanged) {
      renderChallengeList();
    }
    if (activeChanged || enabledChanged || areaChanged || dedupeChanged || autoChanged) {
      maybeRefreshAltText('config');
    }
    return;
  }
  if (activeChanged || enabledChanged || areaChanged || dedupeChanged || autoChanged) {
    renderChallengeList();
    maybeRefreshAltText('config');
  }
}
function tryRegisterChallengeHit(cols, rows) {
  if (!challengeRuntime.active || !challengeRuntime.N) return;
  if (cols * rows !== challengeRuntime.N) return;
  const key = `${cols}×${rows}`;
  if (!challengeRuntime.oriented.has(key)) {
    challengeRuntime.oriented.add(key);
    renderChallengeList();
  }
}
function snapshotSimpleState(simple) {
  if (!simple || typeof simple !== "object") return {};
  const toInt = value => {
    const num = Math.round(Number(value));
    return Number.isFinite(num) ? num : undefined;
  };
  const captureDim = dim => {
    if (!dim || typeof dim !== "object") return null;
    const cells = toInt(dim.cells);
    const handle = toInt(dim.handle);
    const state = {};
    if (cells !== undefined) state.cells = Math.max(1, cells);
    if (handle !== undefined) state.handle = Math.max(0, handle);
    state.showHandle = dim.showHandle !== false;
    return state;
  };
  const state = {};
  const lengthState = captureDim(simple.length);
  if (lengthState) state.length = lengthState;
  const heightState = captureDim(simple.height);
  if (heightState) state.height = heightState;
  if (simple.totalHandle && typeof simple.totalHandle === "object") {
    const total = {};
    if (simple.totalHandle.show != null) total.show = !!simple.totalHandle.show;
    const maxCols = toInt(simple.totalHandle.maxCols);
    if (maxCols !== undefined && maxCols > 0) total.maxCols = maxCols;
    const maxRows = toInt(simple.totalHandle.maxRows);
    if (maxRows !== undefined && maxRows > 0) total.maxRows = maxRows;
    if (Object.keys(total).length) state.totalHandle = total;
  }
  if (simple.challenge && typeof simple.challenge === "object") {
    const challengeState = {};
    if (simple.challenge.enabled != null) challengeState.enabled = !!simple.challenge.enabled;
    const area = toInt(simple.challenge.area);
    if (area !== undefined && area > 0) challengeState.area = area;
    if (simple.challenge.dedupeOrderless != null) challengeState.dedupeOrderless = !!simple.challenge.dedupeOrderless;
    if (simple.challenge.autoExpandMax != null) challengeState.autoExpandMax = !!simple.challenge.autoExpandMax;
    if (Object.keys(challengeState).length) state.challenge = challengeState;
  }
  return state;
}
function ensureLayoutState(layout) {
  const normalized = normalizeLayout(layout);
  if (!layoutStateStore[normalized]) {
    layoutStateStore[normalized] = snapshotSimpleState(CFG.SIMPLE);
  }
  return layoutStateStore[normalized];
}
function applyLayoutStateToSimple(layout) {
  ensureCfgDefaults();
  const normalized = normalizeLayout(layout);
  const state = layoutStateStore[normalized];
  if (!CFG.SIMPLE.length || typeof CFG.SIMPLE.length !== "object") CFG.SIMPLE.length = {};
  if (!CFG.SIMPLE.height || typeof CFG.SIMPLE.height !== "object") CFG.SIMPLE.height = {};
  if (!CFG.SIMPLE.totalHandle || typeof CFG.SIMPLE.totalHandle !== "object") CFG.SIMPLE.totalHandle = {};
  if (!CFG.SIMPLE.challenge || typeof CFG.SIMPLE.challenge !== "object") CFG.SIMPLE.challenge = {};
  CFG.SIMPLE.layout = normalized;
  if (!state) return;
  const applyDim = (target, dimState) => {
    if (!dimState) return;
    if (dimState.cells !== undefined && Number.isFinite(dimState.cells)) target.cells = Math.max(1, Math.round(dimState.cells));
    if (dimState.handle !== undefined && Number.isFinite(dimState.handle)) target.handle = Math.max(0, Math.round(dimState.handle));
    if (typeof dimState.showHandle === "boolean") target.showHandle = dimState.showHandle;
  };
  applyDim(CFG.SIMPLE.length, state.length);
  applyDim(CFG.SIMPLE.height, state.height);
  const totalState = state.totalHandle;
  if (totalState) {
    if (typeof totalState.show === "boolean") CFG.SIMPLE.totalHandle.show = totalState.show;
    if (totalState.maxCols !== undefined && Number.isFinite(totalState.maxCols)) CFG.SIMPLE.totalHandle.maxCols = Math.max(1, Math.round(totalState.maxCols));
    if (totalState.maxRows !== undefined && Number.isFinite(totalState.maxRows)) CFG.SIMPLE.totalHandle.maxRows = Math.max(1, Math.round(totalState.maxRows));
  }
  const challengeState = state.challenge;
  if (challengeState) {
    if (typeof challengeState.enabled === "boolean") CFG.SIMPLE.challenge.enabled = challengeState.enabled;
    if (challengeState.area !== undefined && Number.isFinite(challengeState.area)) CFG.SIMPLE.challenge.area = Math.max(1, Math.round(challengeState.area));
    if (typeof challengeState.dedupeOrderless === "boolean") CFG.SIMPLE.challenge.dedupeOrderless = challengeState.dedupeOrderless;
    if (typeof challengeState.autoExpandMax === "boolean") CFG.SIMPLE.challenge.autoExpandMax = challengeState.autoExpandMax;
  }
  enforceQuadLayoutFill(normalized);
  enforceSingleLayoutRestrictions(normalized);
}
function saveLayoutState(layout) {
  if (!layout) return;
  const normalized = normalizeLayout(layout);
  layoutStateStore[normalized] = snapshotSimpleState(CFG.SIMPLE);
}
function computeLayoutState(layout, width, height, cols, rows, sx, sy, unit) {
  const mode = normalizeLayout(layout);
  if (mode === "single") {
    return {
      mode,
      leftWidth: width,
      rightWidth: 0,
      bottomHeight: height,
      topHeight: 0,
      leftCols: cols,
      rightCols: 0,
      bottomRows: rows,
      topRows: 0,
      showTopLeft: false,
      showTopRight: false,
      showBottomLeft: true,
      showBottomRight: false
    };
  }
  const effectiveSx = mode === "vertical" ? width : sx;
  const effectiveSy = mode === "horizontal" ? 0 : sy;
  const leftWidth = Math.max(0, Math.min(width, effectiveSx));
  const rightWidth = Math.max(0, width - leftWidth);
  const bottomHeight = Math.max(0, Math.min(height, effectiveSy));
  const topHeight = Math.max(0, height - bottomHeight);
  const leftCols = Math.max(0, Math.min(cols, Math.round(leftWidth / unit)));
  const rightCols = Math.max(0, cols - leftCols);
  const bottomRows = Math.max(0, Math.min(rows, Math.round(bottomHeight / unit)));
  const topRows = Math.max(0, rows - bottomRows);
  const hasLeft = leftWidth > 0;
  const hasRight = rightWidth > 0;
  const hasTop = topHeight > 0;
  const hasBottom = bottomHeight > 0;
  return {
    mode,
    leftWidth,
    rightWidth,
    bottomHeight,
    topHeight,
    leftCols,
    rightCols,
    bottomRows,
    topRows,
    showTopLeft: hasLeft && hasTop,
    showTopRight: mode !== "vertical" && hasRight && hasTop,
    showBottomLeft: mode !== "horizontal" && hasLeft && hasBottom,
    showBottomRight: mode === "quad" && hasRight && hasBottom
  };
}
function enforceSingleLayoutRestrictions(layout) {
  if (normalizeLayout(layout) !== "single") return;
  ensureCfgDefaults();
  if (!CFG.SIMPLE.length || typeof CFG.SIMPLE.length !== "object") {
    CFG.SIMPLE.length = {};
  }
  if (!CFG.SIMPLE.height || typeof CFG.SIMPLE.height !== "object") {
    CFG.SIMPLE.height = {};
  }
  if (!CFG.SIMPLE.totalHandle || typeof CFG.SIMPLE.totalHandle !== "object") {
    CFG.SIMPLE.totalHandle = {};
  }
  CFG.SIMPLE.length.showHandle = false;
  CFG.SIMPLE.height.showHandle = false;
  CFG.SIMPLE.totalHandle.show = true;
  const lengthCellsRaw = CFG.SIMPLE.length ? CFG.SIMPLE.length.cells : null;
  const lengthCells = Number.isFinite(Number(lengthCellsRaw)) ? Math.max(0, Math.round(Number(lengthCellsRaw))) : null;
  if (lengthCells != null) {
    CFG.SIMPLE.length.handle = lengthCells;
  }
  const heightCellsRaw = CFG.SIMPLE.height ? CFG.SIMPLE.height.cells : null;
  const heightCells = Number.isFinite(Number(heightCellsRaw)) ? Math.max(0, Math.round(Number(heightCellsRaw))) : null;
  if (heightCells != null) {
    CFG.SIMPLE.height.handle = heightCells;
  }
}

function enforceQuadLayoutFill(layout) {
  if (normalizeLayout(layout) !== "quad") return;
  ensureCfgDefaults();
  if (!CFG.SIMPLE.totalHandle || typeof CFG.SIMPLE.totalHandle !== "object") {
    CFG.SIMPLE.totalHandle = {};
  }
  const toPositiveInt = value => {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  const ensureSplitHandle = (dimKey, cells) => {
    const dim = CFG.SIMPLE[dimKey];
    if (!dim || typeof dim !== "object") return;
    if (!Number.isFinite(cells) || cells <= 1) return;
    const parsedHandle = Math.round(Number(dim.handle));
    const minHandle = 1;
    const maxHandle = cells - 1;
    let nextHandle;
    if (Number.isFinite(parsedHandle) && parsedHandle >= minHandle && parsedHandle <= maxHandle) {
      nextHandle = parsedHandle;
    } else {
      nextHandle = Math.max(minHandle, Math.min(maxHandle, Math.round(cells / 2)));
    }
    dim.handle = nextHandle;
    if (dim.showHandle == null) dim.showHandle = true;
  };
  const lengthCells = toPositiveInt(CFG.SIMPLE.length && CFG.SIMPLE.length.cells);
  if (lengthCells != null) {
    CFG.SIMPLE.totalHandle.maxCols = lengthCells;
    ensureSplitHandle("length", lengthCells);
  }
  const heightCells = toPositiveInt(CFG.SIMPLE.height && CFG.SIMPLE.height.cells);
  if (heightCells != null) {
    CFG.SIMPLE.totalHandle.maxRows = heightCells;
    ensureSplitHandle("height", heightCells);
  }
}
function updateLayoutUi() {
  if (typeof document === "undefined") return;
  const layoutSelect = document.getElementById("layoutMode");
  if (!layoutSelect) return;
  const layout = normalizeLayout(layoutSelect.value);
  const isSingle = layout === "single";
  enforceSingleLayoutRestrictions(layout);
  const startWrapIds = ["lengthStartWrap", "heightStartWrap"];
  const handleWrapIds = ["lengthHandleWrap", "heightHandleWrap"];
  const maxWrapIds = ["lengthMaxWrap", "heightMaxWrap"];
  startWrapIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = isSingle;
  });
  handleWrapIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = isSingle;
  });
  maxWrapIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = !isSingle;
  });
  const singleTitle = document.getElementById("singleSettingsTitle");
  if (singleTitle) singleTitle.hidden = !isSingle;
  const splitTitle = document.getElementById("splitSettingsTitle");
  if (splitTitle) splitTitle.hidden = isSingle;
  const challengeRow = document.getElementById("challengeSettings");
  if (challengeRow) challengeRow.hidden = !isSingle;
  const challengeEnabledInput = document.getElementById("challengeEnabled");
  if (challengeEnabledInput) challengeEnabledInput.disabled = !isSingle;
  const challengeAreaInput = document.getElementById("challengeArea");
  if (challengeAreaInput) challengeAreaInput.disabled = !isSingle;
  const toggleDisabled = (id, disabled, forcedValue) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = !!disabled;
    if (disabled && typeof forcedValue === "boolean" && el.type === "checkbox") {
      el.checked = forcedValue;
    }
  };
  toggleDisabled("showLengthHandle", isSingle, false);
  toggleDisabled("showHeightHandle", isSingle, false);
  toggleDisabled("showTotalHandle", isSingle, true);
  ["lengthStart", "heightStart"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = isSingle;
  });
  syncChallengeState(layout);
}
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", updateLayoutUi, {
      once: true
    });
  } else {
    updateLayoutUi();
  }
}
function normalizeSimpleLayoutState(state) {
  if (!state || typeof state !== "object") return {};
  return snapshotSimpleState({
    length: state.length,
    height: state.height,
    totalHandle: state.totalHandle,
    challenge: state.challenge
  });
}
function createCleanState() {
  ensureCfgDefaults();
  if (typeof document !== "undefined") {
    readConfigFromHtml();
  }
  const normalizedLayout = normalizeLayout(currentLayoutMode != null ? currentLayoutMode : CFG.SIMPLE.layout);
  const advLabels = CFG.ADV.labels || {};
  const layoutState = {};
  Object.keys(layoutStateStore).forEach(key => {
    layoutState[normalizeLayout(key)] = normalizeSimpleLayoutState(layoutStateStore[key]);
  });
  if (!layoutState[normalizedLayout]) {
    layoutState[normalizedLayout] = snapshotSimpleState(CFG.SIMPLE);
  }
  const cleanState = {
    v: 1,
    layout: normalizedLayout,
    simple: snapshotSimpleState(CFG.SIMPLE),
    layoutState,
    grid: !!CFG.ADV.grid,
    splitLines: CFG.ADV.splitLines !== false,
    showExpressions: ((advLabels.cellMode) || 'factors') !== 'none',
    variable1: CFG.SIMPLE.variable1 || '',
    variable2: CFG.SIMPLE.variable2 || '',
    showSum: CFG.SIMPLE.showSum === true
  };
  if (CFG.SIMPLE.altTextSource === 'manual' && typeof CFG.SIMPLE.altText === 'string') {
    cleanState.altText = CFG.SIMPLE.altText;
    cleanState.altTextSource = 'manual';
  }
  return cleanState;
}
function loadCleanState(state) {
  if (!state || typeof state !== 'object' || state.v !== 1) return false;
  ensureCfgDefaults();
  const targetLayout = normalizeLayout(state.layout != null ? state.layout : currentLayoutMode != null ? currentLayoutMode : CFG.SIMPLE.layout);
  Object.entries(state.layoutState || {}).forEach(([key, value]) => {
    const normalizedKey = normalizeLayout(key);
    layoutStateStore[normalizedKey] = normalizeSimpleLayoutState(value);
  });
  if (state.simple && typeof state.simple === 'object') {
    layoutStateStore[targetLayout] = normalizeSimpleLayoutState(state.simple);
  } else {
    ensureLayoutState(targetLayout);
  }
  applyLayoutStateToSimple(targetLayout);
  CFG.SIMPLE.variable1 = sanitizeVariableName(state.variable1 != null ? state.variable1 : CFG.SIMPLE.variable1);
  CFG.SIMPLE.variable2 = sanitizeVariableName(state.variable2 != null ? state.variable2 : CFG.SIMPLE.variable2);
  if (state.showSum != null) CFG.SIMPLE.showSum = !!state.showSum;
  if (state.grid != null) CFG.ADV.grid = !!state.grid;
  if (state.splitLines != null) CFG.ADV.splitLines = !!state.splitLines;
  if (state.altTextSource === 'manual' && typeof state.altText === 'string') {
    CFG.SIMPLE.altTextSource = 'manual';
    CFG.SIMPLE.altText = state.altText;
  }
  const advLabels = CFG.ADV.labels || {};
  if (state.showExpressions === false) {
    advLabels.cellMode = 'none';
  } else if (state.showExpressions === true) {
    advLabels.cellMode = advLabels.cellMode === 'none' ? lastVisibleCellMode || 'factors' : advLabels.cellMode;
    if (advLabels.cellMode !== 'none') {
      lastVisibleCellMode = advLabels.cellMode;
    }
  }
  applyConfigToInputs();
  render();
  return true;
}
/* ========================================================= */

function readConfigFromHtml() {
  var _document$getElementB, _document$getElementB2, _document$getElementB3, _document$getElementB4, _document$getElementB5, _document$getElementB6, _document$getElementB7, _document$getElementB8, _document$getElementB9, _document$getElementB0, _document$getElementB1, _document$getElementB10;
  ensureCfgDefaults();
  const layoutSelect = document.getElementById("layoutMode");
  const fallbackLayout = normalizeLayout(currentLayoutMode != null ? currentLayoutMode : CFG.SIMPLE.layout);
  const selectedLayout = layoutSelect && layoutSelect.value ? normalizeLayout(layoutSelect.value) : fallbackLayout;
  if (currentLayoutMode == null) {
    currentLayoutMode = selectedLayout;
  }
  ensureLayoutState(currentLayoutMode);
  if (selectedLayout !== currentLayoutMode) {
    saveLayoutState(currentLayoutMode);
    ensureLayoutState(selectedLayout);
    currentLayoutMode = selectedLayout;
    applyLayoutStateToSimple(currentLayoutMode);
    layoutStateStore[currentLayoutMode] = snapshotSimpleState(CFG.SIMPLE);
    applyConfigToInputs();
    return;
  }
  const height = parseInt((_document$getElementB = document.getElementById("height")) === null || _document$getElementB === void 0 ? void 0 : _document$getElementB.value, 10);
  if (Number.isFinite(height)) CFG.SIMPLE.height.cells = height;
  const length = parseInt((_document$getElementB2 = document.getElementById("length")) === null || _document$getElementB2 === void 0 ? void 0 : _document$getElementB2.value, 10);
  if (Number.isFinite(length)) CFG.SIMPLE.length.cells = length;
  const hStart = parseInt((_document$getElementB3 = document.getElementById("heightStart")) === null || _document$getElementB3 === void 0 ? void 0 : _document$getElementB3.value, 10);
  if (Number.isFinite(hStart)) CFG.SIMPLE.height.handle = hStart;
  const lStart = parseInt((_document$getElementB4 = document.getElementById("lengthStart")) === null || _document$getElementB4 === void 0 ? void 0 : _document$getElementB4.value, 10);
  if (Number.isFinite(lStart)) CFG.SIMPLE.length.handle = lStart;
  CFG.SIMPLE.height.showHandle = (_document$getElementB5 = (_document$getElementB6 = document.getElementById("showHeightHandle")) === null || _document$getElementB6 === void 0 ? void 0 : _document$getElementB6.checked) !== null && _document$getElementB5 !== void 0 ? _document$getElementB5 : CFG.SIMPLE.height.showHandle;
  CFG.SIMPLE.length.showHandle = (_document$getElementB7 = (_document$getElementB8 = document.getElementById("showLengthHandle")) === null || _document$getElementB8 === void 0 ? void 0 : _document$getElementB8.checked) !== null && _document$getElementB7 !== void 0 ? _document$getElementB7 : CFG.SIMPLE.length.showHandle;
  const totalHandleInput = document.getElementById("showTotalHandle");
  if (!CFG.SIMPLE.totalHandle) CFG.SIMPLE.totalHandle = {};
  if (totalHandleInput) CFG.SIMPLE.totalHandle.show = !!totalHandleInput.checked;
  const normalizedCurrentLayout = normalizeLayout(currentLayoutMode);
  if (normalizedCurrentLayout === "quad") {
    enforceQuadLayoutFill(normalizedCurrentLayout);
  } else {
    const lengthMaxInput = document.getElementById("lengthMax");
    if (lengthMaxInput) {
      const lengthMax = Math.round(parseFloat(lengthMaxInput.value));
      if (Number.isFinite(lengthMax) && lengthMax > 0) {
        CFG.SIMPLE.totalHandle.maxCols = lengthMax;
      }
    }
    const heightMaxInput = document.getElementById("heightMax");
    if (heightMaxInput) {
      const heightMax = Math.round(parseFloat(heightMaxInput.value));
      if (Number.isFinite(heightMax) && heightMax > 0) {
        CFG.SIMPLE.totalHandle.maxRows = heightMax;
      }
    }
  }
  CFG.ADV.grid = (_document$getElementB9 = (_document$getElementB0 = document.getElementById("grid")) === null || _document$getElementB0 === void 0 ? void 0 : _document$getElementB0.checked) !== null && _document$getElementB9 !== void 0 ? _document$getElementB9 : CFG.ADV.grid;
  CFG.ADV.splitLines = (_document$getElementB1 = (_document$getElementB10 = document.getElementById("splitLines")) === null || _document$getElementB10 === void 0 ? void 0 : _document$getElementB10.checked) !== null && _document$getElementB1 !== void 0 ? _document$getElementB1 : CFG.ADV.splitLines;
  if (!CFG.SIMPLE.challenge || typeof CFG.SIMPLE.challenge !== "object") CFG.SIMPLE.challenge = {};
  const challengeEnabledInput = document.getElementById("challengeEnabled");
  if (challengeEnabledInput) CFG.SIMPLE.challenge.enabled = !!challengeEnabledInput.checked;
  const challengeAreaInput = document.getElementById("challengeArea");
  if (challengeAreaInput) {
    const areaVal = Math.round(parseFloat(challengeAreaInput.value));
    if (Number.isFinite(areaVal) && areaVal > 0) {
      CFG.SIMPLE.challenge.area = areaVal;
    }
  }
  const showExpressionsInput = document.getElementById("showExpressions");
  if (!CFG.ADV.labels || typeof CFG.ADV.labels !== "object") CFG.ADV.labels = {};
  if (showExpressionsInput) {
    const currentMode = CFG.ADV.labels.cellMode;
    if (showExpressionsInput.checked) {
      if (!currentMode || currentMode === "none") {
        CFG.ADV.labels.cellMode = lastVisibleCellMode || "factors";
      }
    } else {
      if (currentMode && currentMode !== "none") {
        lastVisibleCellMode = currentMode;
      }
      CFG.ADV.labels.cellMode = "none";
    }
  }
  const variable1Input = document.getElementById("variable1");
  CFG.SIMPLE.variable1 = sanitizeVariableName(variable1Input ? variable1Input.value : CFG.SIMPLE.variable1);
  const variable2Input = document.getElementById("variable2");
  CFG.SIMPLE.variable2 = sanitizeVariableName(variable2Input ? variable2Input.value : CFG.SIMPLE.variable2);
  const showSumInput = document.getElementById("showSum");
  CFG.SIMPLE.showSum = !!(showSumInput && showSumInput.checked);
  CFG.SIMPLE.layout = currentLayoutMode;
  updateLayoutUi();
  syncChallengeState(currentLayoutMode);
  saveLayoutState(currentLayoutMode);
}
function draw() {
  var _SV$height$cells, _SV$height, _SV$length$cells, _SV$length, _ADV$check$ten, _ADV$check, _ADV$handleIcons$size, _ADV$handleIcons, _ADV$margins$l, _ADV$margins, _ADV$margins$r, _ADV$margins2, _ADV$margins$t, _ADV$margins3, _ADV$margins$b, _ADV$margins4, _ADV$classes$outer, _ADV$classes, _ADV$classes$grid, _ADV$classes2, _ADV$classes$split, _ADV$classes3, _ADV$classes$handle, _ADV$classes4, _ADV$classes$labelCel, _ADV$classes5, _ADV$classes$labelEdg, _ADV$classes6, _ADV$classes$cells, _ADV$classes7, _SV$height2, _SV$length2, _ADV$drag, _ADV$drag2, _ADV$limits$minColsEa, _ADV$limits, _ADV$limits$minRowsEa, _ADV$limits2, _SV$length$handle, _SV$length3, _SV$height$handle, _SV$height3, _SV$height4, _SV$length4, _ADV$handleIcons$hori, _ADV$handleIcons2, _ADV$handleIcons$vert, _ADV$handleIcons3, _ADV$fit$maxVh, _ADV$fit, _ADV$labels$dot, _ADV$labels, _ADV$labels$equals, _ADV$labels2, _ADV$labels$edgeMode, _ADV$labels3, _ADV$labels$cellMode, _ADV$labels4, _SV$totalHandle;
  ensureCfgDefaults();
  CFG.ADV.colors = resolveRectColors();
  applyThemeToDocument();
  if (typeof cleanupCurrentDraw === "function") {
    cleanupCurrentDraw();
    cleanupCurrentDraw = null;
  }
  const ADV = CFG.ADV,
    SV = CFG.SIMPLE;
  const variables = getVariableSettings(SV);
  const showSum = SV.showSum === true;
  const UNIT = +ADV.unit || 40;
  let rows = Math.max(1, Math.round((_SV$height$cells = (_SV$height = SV.height) === null || _SV$height === void 0 ? void 0 : _SV$height.cells) !== null && _SV$height$cells !== void 0 ? _SV$height$cells : 16));
  let cols = Math.max(1, Math.round((_SV$length$cells = (_SV$length = SV.length) === null || _SV$length === void 0 ? void 0 : _SV$length.cells) !== null && _SV$length$cells !== void 0 ? _SV$length$cells : 17));
  const totalCfg = SV.totalHandle || {};
  const parsedMaxCols = totalCfg.maxCols != null ? parseFloat(totalCfg.maxCols) : null;
  const parsedMaxRows = totalCfg.maxRows != null ? parseFloat(totalCfg.maxRows) : null;
  const hasMaxCols = Number.isFinite(parsedMaxCols);
  const hasMaxRows = Number.isFinite(parsedMaxRows);
  let maxTotalCols = hasMaxCols ? Math.max(1, Math.round(parsedMaxCols)) : Infinity;
  let maxTotalRows = hasMaxRows ? Math.max(1, Math.round(parsedMaxRows)) : Infinity;
  const layoutMode = normalizeLayout(SV.layout);
  syncChallengeState(layoutMode);
  const challengeActive = challengeRuntime.active;
  if (challengeActive && challengeRuntime.autoExpandMax && challengeRuntime.N != null) {
    const needed = Math.max(1, Math.round(challengeRuntime.N));
    if (maxTotalCols < needed) maxTotalCols = needed;
    if (maxTotalRows < needed) maxTotalRows = needed;
  }
  if (hasMaxCols) cols = Math.min(cols, maxTotalCols);
  if (hasMaxRows) rows = Math.min(rows, maxTotalRows);
  const TEN = Math.max(1, Math.round((_ADV$check$ten = (_ADV$check = ADV.check) === null || _ADV$check === void 0 ? void 0 : _ADV$check.ten) !== null && _ADV$check$ten !== void 0 ? _ADV$check$ten : 10));

  // spacing for kant-tekst utenfor
  const EDGE_GAP = {
    x: 8,
    y: 20
  };

  // pilstørrelse + auto-margin
  const HANDLE_SIZE = Math.max(12, (_ADV$handleIcons$size = (_ADV$handleIcons = ADV.handleIcons) === null || _ADV$handleIcons === void 0 ? void 0 : _ADV$handleIcons.size) !== null && _ADV$handleIcons$size !== void 0 ? _ADV$handleIcons$size : 84);
  const HOT_ZONE = {
    x: Math.max(18, Math.round(HANDLE_SIZE * 0.45)),
    y: Math.max(18, Math.round(HANDLE_SIZE * 0.45))
  };
  const CORNER_RADIUS = Math.max(14, Math.min(28, HANDLE_SIZE * 0.35));
  const MLconf = (_ADV$margins$l = (_ADV$margins = ADV.margins) === null || _ADV$margins === void 0 ? void 0 : _ADV$margins.l) !== null && _ADV$margins$l !== void 0 ? _ADV$margins$l : 80;
  const MR = (_ADV$margins$r = (_ADV$margins2 = ADV.margins) === null || _ADV$margins2 === void 0 ? void 0 : _ADV$margins2.r) !== null && _ADV$margins$r !== void 0 ? _ADV$margins$r : 40;
  const MTconf = (_ADV$margins$t = (_ADV$margins3 = ADV.margins) === null || _ADV$margins3 === void 0 ? void 0 : _ADV$margins3.t) !== null && _ADV$margins$t !== void 0 ? _ADV$margins$t : 40;
  const MBconf = (_ADV$margins$b = (_ADV$margins4 = ADV.margins) === null || _ADV$margins4 === void 0 ? void 0 : _ADV$margins4.b) !== null && _ADV$margins$b !== void 0 ? _ADV$margins$b : 120;
  const MIN_LEFT_MARGIN_FOR_SUM = 120;
  const MIN_TOP_MARGIN_FOR_SUM = 96;
  const ML = Math.max(MLconf, HANDLE_SIZE / 2 + 18, showSum ? MIN_LEFT_MARGIN_FOR_SUM : 0);
  const MB = Math.max(MBconf, HANDLE_SIZE / 2 + EDGE_GAP.y + 18);
  const MTbase = showSum ? Math.max(MTconf, MIN_TOP_MARGIN_FOR_SUM) : MTconf;
  let MT = MTbase;
  let W = 0,
    H = 0,
    VBW = 0,
    VBH = 0,
    minColsEachSide = 0,
    minRowsEachSide = 0,
    minSX = 0,
    maxSX = 0,
    minSY = 0,
    maxSY = 0,
    minX = 0,
    maxX = 0,
    minY = 0,
    maxY = 0;
  const classes = {
    outer: (_ADV$classes$outer = (_ADV$classes = ADV.classes) === null || _ADV$classes === void 0 ? void 0 : _ADV$classes.outer) !== null && _ADV$classes$outer !== void 0 ? _ADV$classes$outer : "outer",
    grid: (_ADV$classes$grid = (_ADV$classes2 = ADV.classes) === null || _ADV$classes2 === void 0 ? void 0 : _ADV$classes2.grid) !== null && _ADV$classes$grid !== void 0 ? _ADV$classes$grid : "grid",
    split: (_ADV$classes$split = (_ADV$classes3 = ADV.classes) === null || _ADV$classes3 === void 0 ? void 0 : _ADV$classes3.split) !== null && _ADV$classes$split !== void 0 ? _ADV$classes$split : "split",
    handle: (_ADV$classes$handle = (_ADV$classes4 = ADV.classes) === null || _ADV$classes4 === void 0 ? void 0 : _ADV$classes4.handle) !== null && _ADV$classes$handle !== void 0 ? _ADV$classes$handle : "handleImg",
    labelCell: (_ADV$classes$labelCel = (_ADV$classes5 = ADV.classes) === null || _ADV$classes5 === void 0 ? void 0 : _ADV$classes5.labelCell) !== null && _ADV$classes$labelCel !== void 0 ? _ADV$classes$labelCel : "labelCell",
    labelEdge: (_ADV$classes$labelEdg = (_ADV$classes6 = ADV.classes) === null || _ADV$classes6 === void 0 ? void 0 : _ADV$classes6.labelEdge) !== null && _ADV$classes$labelEdg !== void 0 ? _ADV$classes$labelEdg : "labelEdge",
    cells: (_ADV$classes$cells = (_ADV$classes7 = ADV.classes) === null || _ADV$classes7 === void 0 ? void 0 : _ADV$classes7.cells) !== null && _ADV$classes$cells !== void 0 ? _ADV$classes$cells : ["c1", "c2", "c3", "c4"]
  };
  const showGrid = ADV.grid !== false;
  const clickToMove = ADV.clickToMove !== false;
  const showHeightAxis = layoutMode !== "horizontal" && rows > 1 && ((_SV$height2 = SV.height) === null || _SV$height2 === void 0 ? void 0 : _SV$height2.show) !== false;
  const showLengthAxis = cols > 1 && ((_SV$length2 = SV.length) === null || _SV$length2 === void 0 ? void 0 : _SV$length2.show) !== false;
  const dragVertical = layoutMode !== "single" && showHeightAxis && ((_ADV$drag = ADV.drag) === null || _ADV$drag === void 0 ? void 0 : _ADV$drag.vertical) !== false;
  const dragHorizontal = layoutMode !== "single" && showLengthAxis && ((_ADV$drag2 = ADV.drag) === null || _ADV$drag2 === void 0 ? void 0 : _ADV$drag2.horizontal) !== false;
  const splitLinesOn = ADV.splitLines !== false;
  const showHLine = layoutMode !== "single" && splitLinesOn && showHeightAxis;
  const showVLine = layoutMode !== "single" && splitLinesOn && showLengthAxis;
  const rawMinColsEachSide = (_ADV$limits$minColsEa = (_ADV$limits = ADV.limits) === null || _ADV$limits === void 0 ? void 0 : _ADV$limits.minColsEachSide) !== null && _ADV$limits$minColsEa !== void 0 ? _ADV$limits$minColsEa : 0;
  const rawMinRowsEachSide = (_ADV$limits$minRowsEa = (_ADV$limits2 = ADV.limits) === null || _ADV$limits2 === void 0 ? void 0 : _ADV$limits2.minRowsEachSide) !== null && _ADV$limits$minRowsEa !== void 0 ? _ADV$limits$minRowsEa : 0;
  function recomputeDerived() {
    W = cols * UNIT;
    H = rows * UNIT;
    const maxColsForView = hasMaxCols ? maxTotalCols : cols;
    const maxRowsForView = hasMaxRows ? maxTotalRows : rows;
    const widthForView = (hasMaxCols ? maxColsForView * UNIT : W);
    const maxHeightForView = hasMaxRows ? maxRowsForView * UNIT : H;
    if (hasMaxRows) {
      const baseBottom = MTbase + maxHeightForView;
      MT = baseBottom - H;
      VBH = baseBottom + MB;
    } else {
      MT = MTbase;
      VBH = MT + H + MB;
    }
    VBW = ML + widthForView + MR;
    minColsEachSide = Math.max(0, Math.min(Math.floor(cols / 2), Math.round(rawMinColsEachSide) || 0));
    minRowsEachSide = Math.max(0, Math.min(Math.floor(rows / 2), Math.round(rawMinRowsEachSide) || 0));
    minSX = minColsEachSide * UNIT;
    maxSX = (cols - minColsEachSide) * UNIT;
    minSY = minRowsEachSide * UNIT;
    maxSY = (rows - minRowsEachSide) * UNIT;
    minX = ML + minSX;
    maxX = ML + maxSX;
    minY = MT + minSY;
    maxY = MT + maxSY;
  }
  recomputeDerived();
  const initLeftCols = (_SV$length$handle = (_SV$length3 = SV.length) === null || _SV$length3 === void 0 ? void 0 : _SV$length3.handle) !== null && _SV$length$handle !== void 0 ? _SV$length$handle : Math.floor(cols / 2);
  const initBottomRows = (_SV$height$handle = (_SV$height3 = SV.height) === null || _SV$height3 === void 0 ? void 0 : _SV$height3.handle) !== null && _SV$height$handle !== void 0 ? _SV$height$handle : Math.floor(rows / 2);
  const showLeftHandle = layoutMode !== "single" && showHeightAxis && ((_SV$height4 = SV.height) === null || _SV$height4 === void 0 ? void 0 : _SV$height4.showHandle) !== false;
  const showBottomHandle = layoutMode !== "single" && showLengthAxis && ((_SV$length4 = SV.length) === null || _SV$length4 === void 0 ? void 0 : _SV$length4.showHandle) !== false;
  const showTotalHandle = !!((_SV$totalHandle = SV.totalHandle) !== null && _SV$totalHandle !== void 0 && _SV$totalHandle.show);

  // helpers
  const NS = "http://www.w3.org/2000/svg";
  const el = n => document.createElementNS(NS, n);
  const set = (node, n, v) => {
    if (!node) return node;
    const cacheKey = '__amAttrCache';
    const cache = node[cacheKey] || (node[cacheKey] = {});
    const strValue = v == null ? "" : String(v);
    if (cache[n] !== strValue) {
      node.setAttribute(n, strValue);
      cache[n] = strValue;
    }
    return node;
  };
  const setText = (node, value) => {
    if (!node) return;
    const strValue = value == null ? "" : String(value);
    if (node.textContent !== strValue) node.textContent = strValue;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const clampInt = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
  const snap = v => Math.round(v / UNIT) * UNIT;
  const clampWithEdges = (value, innerMin, innerMax, edgeMin, edgeMax) => {
    const EPS = 1e-6;
    if (value <= edgeMin + EPS) return edgeMin;
    if (value >= edgeMax - EPS) return edgeMax;
    const low = Math.min(Math.max(innerMin, edgeMin), edgeMax);
    const high = Math.max(Math.min(innerMax, edgeMax), edgeMin);
    if (high < low) return Math.max(edgeMin, Math.min(edgeMax, value));
    return Math.max(low, Math.min(high, value));
  };
  const clampSx = value => clampWithEdges(value, minSX, maxSX, 0, W);
  const clampSy = value => clampWithEdges(value, minSY, maxSY, 0, H);
  const clampAxisX = value => clampWithEdges(value, minX, maxX, ML, ML + W);
  const clampAxisY = value => clampWithEdges(value, minY, maxY, MT, MT + H);
  const H_ICON_URL = (_ADV$handleIcons$hori = (_ADV$handleIcons2 = ADV.handleIcons) === null || _ADV$handleIcons2 === void 0 ? void 0 : _ADV$handleIcons2.horiz) !== null && _ADV$handleIcons$hori !== void 0 ? _ADV$handleIcons$hori : "";
  const V_ICON_URL = (_ADV$handleIcons$vert = (_ADV$handleIcons3 = ADV.handleIcons) === null || _ADV$handleIcons3 === void 0 ? void 0 : _ADV$handleIcons3.vert) !== null && _ADV$handleIcons$vert !== void 0 ? _ADV$handleIcons$vert : "";

  // state
  let sx = clampInt(initLeftCols, minColsEachSide, cols - minColsEachSide) * UNIT;
  let sy = clampInt(initBottomRows, minRowsEachSide, rows - minRowsEachSide) * UNIT;
  let lastSyncedLeft = null;
  let lastSyncedBottom = null;
  let lastSyncedCols = cols;
  let lastSyncedRows = rows;
  let lastCols = cols;
  let lastRows = rows;
  let lastW = W;
  let lastH = H;
  let lastVBW = VBW;
  let lastVBH = VBH;
  function syncSimpleHandles() {
    const leftCols = Math.round(sx / UNIT);
    const bottomRows = Math.round(sy / UNIT);
    const syncLength = layoutMode !== "vertical" && layoutMode !== "single";
    const syncHeight = layoutMode !== "horizontal" && layoutMode !== "single";
    if (syncLength) {
      if (leftCols !== lastSyncedLeft) {
        lastSyncedLeft = leftCols;
        if (!CFG.SIMPLE.length) CFG.SIMPLE.length = {};
        CFG.SIMPLE.length.handle = leftCols;
        const lengthStart = document.getElementById('lengthStart');
        if (lengthStart) {
          const strValue = String(leftCols);
          lengthStart.value = strValue;
          lengthStart.setAttribute('value', strValue);
        }
        maybeRefreshAltText('interaction');
      }
    } else {
      lastSyncedLeft = null;
    }
    if (syncHeight) {
      if (bottomRows !== lastSyncedBottom) {
        lastSyncedBottom = bottomRows;
        if (!CFG.SIMPLE.height) CFG.SIMPLE.height = {};
        CFG.SIMPLE.height.handle = bottomRows;
        const heightStart = document.getElementById('heightStart');
        if (heightStart) {
          const strValue = String(bottomRows);
          heightStart.value = strValue;
          heightStart.setAttribute('value', strValue);
        }
        maybeRefreshAltText('interaction');
      }
    } else {
      lastSyncedBottom = null;
    }
  }
  function syncSimpleTotals() {
    if (cols !== lastSyncedCols) {
      lastSyncedCols = cols;
      if (!CFG.SIMPLE.length) CFG.SIMPLE.length = {};
      CFG.SIMPLE.length.cells = cols;
      const lengthInput = document.getElementById('length');
      if (lengthInput) {
        const strValue = String(cols);
        lengthInput.value = strValue;
        lengthInput.setAttribute('value', strValue);
      }
      maybeRefreshAltText('interaction');
    }
    if (rows !== lastSyncedRows) {
      lastSyncedRows = rows;
      if (!CFG.SIMPLE.height) CFG.SIMPLE.height = {};
      CFG.SIMPLE.height.cells = rows;
      const heightInput = document.getElementById('height');
      if (heightInput) {
        const strValue = String(rows);
        heightInput.value = strValue;
        heightInput.setAttribute('value', strValue);
      }
      maybeRefreshAltText('interaction');
    }
  }
  injectRuntimeStyles();

  // DOM
  const svg = document.getElementById(ADV.svgId);
  svg.innerHTML = "";
  set(svg, "viewBox", `0 0 ${VBW} ${VBH}`);
  set(svg, "preserveAspectRatio", "xMidYMid meet");
  Object.assign(svg.style, {
    maxHeight: ((_ADV$fit$maxVh = (_ADV$fit = ADV.fit) === null || _ADV$fit === void 0 ? void 0 : _ADV$fit.maxVh) !== null && _ADV$fit$maxVh !== void 0 ? _ADV$fit$maxVh : 100) + "vh",
    maxWidth: "100%",
    display: "block",
    touchAction: "none"
  });
  svg.style.userSelect = "none";
  svg.style.webkitUserSelect = "none";
  const rectOuter = el("rect");
  set(rectOuter, "x", ML);
  set(rectOuter, "y", MT);
  set(rectOuter, "width", W);
  set(rectOuter, "height", H);
  set(rectOuter, "class", classes.outer);
  svg.appendChild(rectOuter);
  const defs = el("defs");
  svg.appendChild(defs);
  const clip = el("clipPath");
  set(clip, "id", "clipR");
  const clipRect = el("rect");
  set(clipRect, "x", ML);
  set(clipRect, "y", MT);
  set(clipRect, "width", W);
  set(clipRect, "height", H);
  clip.appendChild(clipRect);
  defs.appendChild(clip);
  const rTL = el("rect"),
    rTR = el("rect"),
    rBL = el("rect"),
    rBR = el("rect");
  set(rTL, "class", classes.cells[0]);
  set(rTR, "class", classes.cells[1]);
  set(rBL, "class", classes.cells[2]);
  set(rBR, "class", classes.cells[3]);
  svg.append(rTL, rTR, rBL, rBR);
  const gridGroup = el("g");
  set(gridGroup, "class", classes.grid);
  set(gridGroup, "clip-path", "url(#clipR)");
  if (showGrid) {
    for (let x = ML + UNIT; x < ML + W; x += UNIT) {
      const ln = el("line");
      set(ln, "x1", x);
      set(ln, "y1", MT);
      set(ln, "x2", x);
      set(ln, "y2", MT + H);
      gridGroup.appendChild(ln);
    }
    for (let y = MT + UNIT; y < MT + H; y += UNIT) {
      const ln = el("line");
      set(ln, "x1", ML);
      set(ln, "y1", y);
      set(ln, "x2", ML + W);
      set(ln, "y2", y);
      gridGroup.appendChild(ln);
    }
  }
  svg.appendChild(gridGroup);

  // delingslinjer
  let vLine = null,
    hLine = null;
  if (showVLine) {
    vLine = el("line");
    set(vLine, "class", classes.split);
    svg.append(vLine);
  }
  if (showHLine) {
    hLine = el("line");
    set(hLine, "class", classes.split);
    svg.append(hLine);
  }

  // håndtak + hit-soner + tastaturoverlay
  let handleLeft = null,
    handleDown = null,
    handleCorner = null,
    hitLeft = null,
    hitDown = null,
    hitCorner = null,
    hotLeft = null,
    hotBottom = null,
    a11yLeft = null,
    a11yLeftRect = null,
    a11yDown = null,
    a11yDownRect = null,
    a11yCorner = null,
    a11yCornerRect = null;
  if (showLeftHandle) {
    handleLeft = el("image");
    set(handleLeft, "class", classes.handle);
    set(handleLeft, "width", HANDLE_SIZE);
    set(handleLeft, "height", HANDLE_SIZE);
    set(handleLeft, "href", V_ICON_URL);
    svg.append(handleLeft);
    hotLeft = el("rect");
    set(hotLeft, "class", "hot");
    set(hotLeft, "width", HOT_ZONE.x);
    set(hotLeft, "height", H);
    set(hotLeft, "aria-hidden", "true");
    svg.append(hotLeft);
    hitLeft = el("circle");
    set(hitLeft, "class", "handleHit");
    set(hitLeft, "r", HANDLE_SIZE * 0.55);
    svg.append(hitLeft);
    a11yLeft = el("g");
    set(a11yLeft, "class", "handleOverlay");
    set(a11yLeft, "tabindex", "0");
    set(a11yLeft, "role", "slider");
    set(a11yLeft, "aria-orientation", "vertical");
    set(a11yLeft, "aria-label", "Høyde");
    set(a11yLeft, "focusable", "true");
    set(a11yLeft, "aria-valuemin", 0);
    set(a11yLeft, "aria-valuemax", rows);
    a11yLeftRect = el("rect");
    set(a11yLeftRect, "width", HANDLE_SIZE);
    set(a11yLeftRect, "height", HANDLE_SIZE);
    set(a11yLeftRect, "fill", "transparent");
    set(a11yLeftRect, "stroke", "none");
    a11yLeft.appendChild(a11yLeftRect);
    svg.append(a11yLeft);
  }
  if (showBottomHandle) {
    handleDown = el("image");
    set(handleDown, "class", classes.handle);
    set(handleDown, "width", HANDLE_SIZE);
    set(handleDown, "height", HANDLE_SIZE);
    set(handleDown, "href", H_ICON_URL);
    svg.append(handleDown);
    hotBottom = el("rect");
    set(hotBottom, "class", "hot");
    set(hotBottom, "width", W);
    set(hotBottom, "height", HOT_ZONE.y);
    set(hotBottom, "aria-hidden", "true");
    svg.append(hotBottom);
    hitDown = el("circle");
    set(hitDown, "class", "handleHit");
    set(hitDown, "r", HANDLE_SIZE * 0.55);
    svg.append(hitDown);
    a11yDown = el("g");
    set(a11yDown, "class", "handleOverlay");
    set(a11yDown, "tabindex", "0");
    set(a11yDown, "role", "slider");
    set(a11yDown, "aria-orientation", "horizontal");
    set(a11yDown, "aria-label", "Lengde");
    set(a11yDown, "focusable", "true");
    set(a11yDown, "aria-valuemin", 0);
    set(a11yDown, "aria-valuemax", cols);
    a11yDownRect = el("rect");
    set(a11yDownRect, "width", HANDLE_SIZE);
    set(a11yDownRect, "height", HANDLE_SIZE);
    set(a11yDownRect, "fill", "transparent");
    set(a11yDownRect, "stroke", "none");
    a11yDown.appendChild(a11yDownRect);
    svg.append(a11yDown);
  }
  if (showTotalHandle) {
    handleCorner = el("circle");
    set(handleCorner, "class", "handleCorner");
    set(handleCorner, "r", CORNER_RADIUS);
    svg.append(handleCorner);
    hitCorner = el("circle");
    set(hitCorner, "class", "handleHit");
    set(hitCorner, "r", CORNER_RADIUS * 1.6);
    svg.append(hitCorner);
    a11yCorner = el("g");
    set(a11yCorner, "class", "handleOverlay");
    set(a11yCorner, "tabindex", "0");
    set(a11yCorner, "role", "group");
    set(a11yCorner, "aria-label", "Totalareal");
    set(a11yCorner, "focusable", "true");
    a11yCornerRect = el("rect");
    set(a11yCornerRect, "width", CORNER_RADIUS * 2);
    set(a11yCornerRect, "height", CORNER_RADIUS * 2);
    set(a11yCornerRect, "fill", "transparent");
    set(a11yCornerRect, "stroke", "none");
    a11yCorner.appendChild(a11yCornerRect);
    svg.append(a11yCorner);
  }

  // tekster
  const tTL = el("text"),
    tTR = el("text"),
    tBL = el("text"),
    tBR = el("text");
  [tTL, tTR, tBL, tBR].forEach(t => {
    set(t, "class", classes.labelCell);
    set(t, "text-anchor", "middle");
  });
  set(tTL, 'data-cell-index', '0');
  set(tTR, 'data-cell-index', '1');
  set(tBL, 'data-cell-index', '2');
  set(tBR, 'data-cell-index', '3');
  const leftTop = el("text"),
    leftBot = el("text"),
    botLeft = el("text"),
    botRight = el("text");
  set(leftTop, 'class', classes.labelEdge);
  set(leftTop, 'text-anchor', "end");
  set(leftBot, 'class', classes.labelEdge);
  set(leftBot, 'text-anchor', "end");
  set(botLeft, 'class', classes.labelEdge);
  set(botLeft, 'text-anchor', "middle");
  set(botRight, 'class', classes.labelEdge);
  set(botRight, 'text-anchor', "middle");
  let sumTopGroup = null,
    sumTopBrace = null,
    sumTopText = null,
    sumLeftGroup = null,
    sumLeftBrace = null,
    sumLeftText = null;
  if (showSum) {
    sumTopGroup = el('g');
    set(sumTopGroup, 'id', 'sumTopGroup');
    set(sumTopGroup, 'class', 'sum-brace sum-brace--top');
    sumTopBrace = el('image');
    set(sumTopBrace, 'id', 'sumTopBrace');
    set(sumTopBrace, 'href', SUM_BRACE_TOP_IMAGE);
    set(sumTopBrace, 'preserveAspectRatio', 'none');
    sumTopText = el('text');
    set(sumTopText, 'id', 'sumTopText');
    set(sumTopText, 'class', 'sum-text');
    set(sumTopText, 'text-anchor', 'middle');
    sumTopGroup.append(sumTopBrace, sumTopText);
    sumLeftGroup = el('g');
    set(sumLeftGroup, 'id', 'sumLeftGroup');
    set(sumLeftGroup, 'class', 'sum-brace sum-brace--left');
    sumLeftBrace = el('image');
    set(sumLeftBrace, 'id', 'sumLeftBrace');
    set(sumLeftBrace, 'href', SUM_BRACE_LEFT_IMAGE);
    set(sumLeftBrace, 'preserveAspectRatio', 'none');
    sumLeftText = el('text');
    set(sumLeftText, 'id', 'sumLeftText');
    set(sumLeftText, 'class', 'sum-text');
    set(sumLeftText, 'text-anchor', 'middle');
    set(sumLeftText, 'dominant-baseline', 'middle');
    sumLeftGroup.append(sumLeftBrace, sumLeftText);
  }
  svg.append(tTL, tTR, tBL, tBR, leftTop, leftBot, botLeft, botRight);
  if (sumTopGroup) svg.append(sumTopGroup);
  if (sumLeftGroup) svg.append(sumLeftGroup);
  const dot = (_ADV$labels$dot = (_ADV$labels = ADV.labels) === null || _ADV$labels === void 0 ? void 0 : _ADV$labels.dot) !== null && _ADV$labels$dot !== void 0 ? _ADV$labels$dot : " · ";
  const equals = (_ADV$labels$equals = (_ADV$labels2 = ADV.labels) === null || _ADV$labels2 === void 0 ? void 0 : _ADV$labels2.equals) !== null && _ADV$labels$equals !== void 0 ? _ADV$labels$equals : " = ";
  const edgeOn = ((_ADV$labels$edgeMode = (_ADV$labels3 = ADV.labels) === null || _ADV$labels3 === void 0 ? void 0 : _ADV$labels3.edgeMode) !== null && _ADV$labels$edgeMode !== void 0 ? _ADV$labels$edgeMode : "counts") === "counts";
  const cellMode = (_ADV$labels$cellMode = (_ADV$labels4 = ADV.labels) === null || _ADV$labels4 === void 0 ? void 0 : _ADV$labels4.cellMode) !== null && _ADV$labels$cellMode !== void 0 ? _ADV$labels$cellMode : "factors";

  // ------- Rask mapping: klient → viewBox -------
  let svgRect = svg.getBoundingClientRect();
  function clientToSvg(e) {
    const vb = svg.viewBox.baseVal;
    const sx = vb.width / svgRect.width;
    const sy = vb.height / svgRect.height;
    return {
      x: vb.x + (e.clientX - svgRect.left) * sx,
      y: vb.y + (e.clientY - svgRect.top) * sy
    };
  }
  function refreshSvgRect() {
    svgRect = svg.getBoundingClientRect();
  }

  // ------- rAF-basert redraw -------
  let rafId = 0;
  let isRedrawing = false;
  let redrawQueued = false;
  function runRedraw() {
    if (isRedrawing) {
      redrawQueued = true;
      return;
    }
    isRedrawing = true;
    do {
      redrawQueued = false;
      redraw();
    } while (redrawQueued);
    isRedrawing = false;
  }
  function scheduleRedraw(immediate = false) {
    if (immediate) {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      runRedraw();
      return;
    }
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      runRedraw();
    });
  }
  function redraw() {
    recomputeDerived();
    sx = clampSx(sx);
    sy = clampSy(sy);
    const dimsChanged = W !== lastW || H !== lastH;
    const totalsChanged = cols !== lastCols || rows !== lastRows;
    const viewBoxChanged = VBW !== lastVBW || VBH !== lastVBH;
    if (viewBoxChanged) {
      set(svg, "viewBox", `0 0 ${VBW} ${VBH}`);
      lastVBW = VBW;
      lastVBH = VBH;
      fitToViewport();
    }
    set(rectOuter, "x", ML);
    set(rectOuter, "y", MT);
    set(clipRect, "x", ML);
    set(clipRect, "y", MT);
    if (dimsChanged) {
      set(rectOuter, "width", W);
      set(rectOuter, "height", H);
      set(clipRect, "width", W);
      set(clipRect, "height", H);
    }
    if (totalsChanged || (dimsChanged && showGrid)) {
      while (gridGroup.firstChild) gridGroup.removeChild(gridGroup.firstChild);
      if (showGrid) {
        for (let x = ML + UNIT; x < ML + W; x += UNIT) {
          const ln = el("line");
          set(ln, "x1", x);
          set(ln, "y1", MT);
          set(ln, "x2", x);
          set(ln, "y2", MT + H);
          gridGroup.appendChild(ln);
        }
        for (let y = MT + UNIT; y < MT + H; y += UNIT) {
          const ln = el("line");
          set(ln, "x1", ML);
          set(ln, "y1", y);
          set(ln, "x2", ML + W);
          set(ln, "y2", y);
          gridGroup.appendChild(ln);
        }
      }
    }
    const layoutState = computeLayoutState(layoutMode, W, H, cols, rows, sx, sy, UNIT);
    const setDisplay = (node, visible) => {
      if (!node) return;
      if (visible) {
        node.removeAttribute("display");
      } else {
        node.setAttribute("display", "none");
      }
    };
    const leftWidth = layoutState.leftWidth;
    const rightWidth = layoutState.rightWidth;
    const topHeight = layoutState.topHeight;
    const bottomHeight = layoutState.bottomHeight;
    const wL = layoutState.leftCols;
    const wR = layoutState.rightCols;
    const hB = layoutState.bottomRows;
    const hT = layoutState.topRows;
    const labelCfg = ADV.labels || {};
    const dot = typeof labelCfg.dot === 'string' ? labelCfg.dot : ' · ';
    const equals = typeof labelCfg.equals === 'string' ? labelCfg.equals : ' = ';
    const cellMode = typeof labelCfg.cellMode === 'string' ? labelCfg.cellMode : 'factors';
    const edgeMode = typeof labelCfg.edgeMode === 'string' ? labelCfg.edgeMode : 'counts';
    const sumEnabled = showSum;
    const variableSettings = variables;
    const axisParts = computeAxisParts(layoutState, variableSettings);
    const columnParts = axisParts.columns;
    const rowParts = axisParts.rows;
    const leftPart = columnParts.left;
    const rightPart = columnParts.right;
    const bottomPart = rowParts.bottom;
    const topPart = rowParts.top;
    set(rTL, "x", ML);
    set(rTL, "y", MT);
    set(rTL, "width", leftWidth);
    set(rTL, "height", topHeight);
    set(rTR, "x", ML + leftWidth);
    set(rTR, "y", MT);
    set(rTR, "width", rightWidth);
    set(rTR, "height", topHeight);
    set(rBL, "x", ML);
    set(rBL, "y", MT + topHeight);
    set(rBL, "width", leftWidth);
    set(rBL, "height", bottomHeight);
    set(rBR, "x", ML + leftWidth);
    set(rBR, "y", MT + topHeight);
    set(rBR, "width", rightWidth);
    set(rBR, "height", bottomHeight);
    setDisplay(rTL, layoutState.showTopLeft);
    setDisplay(rTR, layoutState.showTopRight);
    setDisplay(rBL, layoutState.showBottomLeft);
    setDisplay(rBR, layoutState.showBottomRight);
    const hasVerticalDivision = leftWidth > 0 && rightWidth > 0;
    const hasHorizontalDivision = topHeight > 0 && bottomHeight > 0;
    const showVerticalSplit = showVLine && hasVerticalDivision;
    const showHorizontalSplit = showHLine && hasHorizontalDivision;
    if (vLine) {
      setDisplay(vLine, showVerticalSplit);
      if (showVerticalSplit) {
        set(vLine, "x1", ML + leftWidth);
        set(vLine, "y1", MT);
        set(vLine, "x2", ML + leftWidth);
        set(vLine, "y2", MT + H);
      }
    }
    if (hLine) {
      setDisplay(hLine, showHorizontalSplit);
      if (showHorizontalSplit) {
        set(hLine, "x1", ML);
        set(hLine, "y1", MT + topHeight);
        set(hLine, "x2", ML + W);
        set(hLine, "y2", MT + topHeight);
      }
    }
    const hLeftCX = ML,
      hLeftCY = MT + topHeight;
    const hDownCX = ML + leftWidth,
      hDownCY = MT + H;
    const cornerCX = ML + W,
      cornerCY = MT;
    const handleLeftVisible = showLeftHandle;
    const handleDownVisible = showBottomHandle;
    const handleCornerVisible = showTotalHandle;
    if (handleLeft) {
      set(handleLeft, "x", hLeftCX - HANDLE_SIZE / 2);
      set(handleLeft, "y", hLeftCY - HANDLE_SIZE / 2);
      setDisplay(handleLeft, handleLeftVisible);
    }
    if (handleDown) {
      set(handleDown, "x", hDownCX - HANDLE_SIZE / 2);
      set(handleDown, "y", hDownCY - HANDLE_SIZE / 2);
      setDisplay(handleDown, handleDownVisible);
    }
    if (hotLeft) {
      set(hotLeft, "x", ML - HOT_ZONE.x);
      set(hotLeft, "y", MT);
      set(hotLeft, "height", H);
      setDisplay(hotLeft, handleLeftVisible);
    }
    if (hitLeft) {
      set(hitLeft, "cx", hLeftCX);
      set(hitLeft, "cy", hLeftCY);
      setDisplay(hitLeft, handleLeftVisible);
    }
    if (hotBottom) {
      set(hotBottom, "x", ML);
      set(hotBottom, "y", MT + H);
      set(hotBottom, "width", W);
      setDisplay(hotBottom, handleDownVisible);
    }
    if (hitDown) {
      set(hitDown, "cx", hDownCX);
      set(hitDown, "cy", hDownCY);
      setDisplay(hitDown, handleDownVisible);
    }
    if (handleCorner) {
      set(handleCorner, "cx", cornerCX);
      set(handleCorner, "cy", cornerCY);
      setDisplay(handleCorner, handleCornerVisible);
    }
    if (hitCorner) {
      set(hitCorner, "cx", cornerCX);
      set(hitCorner, "cy", cornerCY);
      setDisplay(hitCorner, handleCornerVisible);
    }
    if (a11yLeftRect) {
      set(a11yLeftRect, "x", hLeftCX - HANDLE_SIZE / 2);
      set(a11yLeftRect, "y", hLeftCY - HANDLE_SIZE / 2);
    }
    if (a11yLeft) {
      set(a11yLeft, "aria-valuemax", rows);
      set(a11yLeft, "aria-valuenow", hB);
      set(a11yLeft, "aria-valuetext", `${hB} nederst, ${hT} øverst`);
      if (handleLeftVisible) {
        a11yLeft.removeAttribute("aria-hidden");
      } else {
        set(a11yLeft, "aria-hidden", "true");
      }
      setDisplay(a11yLeft, handleLeftVisible);
    }
    if (a11yDownRect) {
      set(a11yDownRect, "x", hDownCX - HANDLE_SIZE / 2);
      set(a11yDownRect, "y", hDownCY - HANDLE_SIZE / 2);
    }
    if (a11yDown) {
      set(a11yDown, "aria-valuemax", cols);
      set(a11yDown, "aria-valuenow", wL);
      set(a11yDown, "aria-valuetext", `${wL} venstre, ${wR} høyre`);
      if (handleDownVisible) {
        a11yDown.removeAttribute("aria-hidden");
      } else {
        set(a11yDown, "aria-hidden", "true");
      }
      setDisplay(a11yDown, handleDownVisible);
    }
    if (a11yCornerRect) {
      set(a11yCornerRect, "x", cornerCX - CORNER_RADIUS);
      set(a11yCornerRect, "y", cornerCY - CORNER_RADIUS);
    }
    if (a11yCorner) {
      set(a11yCorner, "aria-valuetext", `${cols} kolonner, ${rows} rader`);
      if (handleCornerVisible) {
        a11yCorner.removeAttribute("aria-hidden");
      } else {
        set(a11yCorner, "aria-hidden", "true");
      }
      setDisplay(a11yCorner, handleCornerVisible);
    }

    // cell-etiketter
    const showTLText = layoutState.showTopLeft && wL > 0 && hT > 0;
    setDisplay(tTL, showTLText);
    if (showTLText) {
      set(tTL, "x", ML + leftWidth / 2);
      set(tTL, "y", MT + topHeight / 2 + 8);
      setText(tTL, formatCellLabelFromParts(leftPart, topPart, cellMode, dot, equals));
    } else {
      setText(tTL, "");
    }
    const showTRText = layoutState.showTopRight && wR > 0 && hT > 0;
    setDisplay(tTR, showTRText);
    if (showTRText) {
      set(tTR, "x", ML + leftWidth + rightWidth / 2);
      set(tTR, "y", MT + topHeight / 2 + 8);
      setText(tTR, formatCellLabelFromParts(rightPart, topPart, cellMode, dot, equals));
    } else {
      setText(tTR, "");
    }
    const showBLText = layoutState.showBottomLeft && wL > 0 && hB > 0;
    setDisplay(tBL, showBLText);
    if (showBLText) {
      set(tBL, "x", ML + leftWidth / 2);
      set(tBL, "y", MT + topHeight + bottomHeight / 2 + 8);
      setText(tBL, formatCellLabelFromParts(leftPart, bottomPart, cellMode, dot, equals));
    } else {
      setText(tBL, "");
    }
    const showBRText = layoutState.showBottomRight && wR > 0 && hB > 0;
    setDisplay(tBR, showBRText);
    if (showBRText) {
      set(tBR, "x", ML + leftWidth + rightWidth / 2);
      set(tBR, "y", MT + topHeight + bottomHeight / 2 + 8);
      setText(tBR, formatCellLabelFromParts(rightPart, bottomPart, cellMode, dot, equals));
    } else {
      setText(tBR, "");
    }

    // kant-etiketter (utenfor, med luft)
    const leftXOutside = ML - HANDLE_SIZE / 2 - EDGE_GAP.x;
    const bottomYOutside = MT + H + HANDLE_SIZE / 2 + EDGE_GAP.y;
    if (edgeOn && showHeightAxis && !showSum) {
      set(leftTop, "x", leftXOutside);
      set(leftTop, "y", MT + topHeight / 2 + 10);
      setText(leftTop, topPart.display || "");
      set(leftBot, "x", leftXOutside);
      set(leftBot, "y", MT + topHeight + bottomHeight / 2 + 10);
      setText(leftBot, bottomPart.display || "");
    } else {
      setText(leftTop, "");
      setText(leftBot, "");
    }
    if (edgeOn && showLengthAxis && !showSum) {
      set(botLeft, "x", ML + leftWidth / 2);
      set(botLeft, "y", bottomYOutside);
      set(botRight, "x", ML + leftWidth + rightWidth / 2);
      set(botRight, "y", bottomYOutside);
      setText(botLeft, leftPart.display || "");
      setText(botRight, rightPart.display || "");
    } else {
      setText(botLeft, "");
      setText(botRight, "");
    }
    if (sumTopGroup && sumTopBrace && sumTopText) {
      const horizontalLabel = buildSumLabel(leftPart, rightPart);
      const braceHeight = Math.max(16, Math.min(32, Math.round(W * 0.06)));
      const braceGap = 24;
      const braceY = MT - braceGap - braceHeight;
      set(sumTopBrace, 'x', ML);
      set(sumTopBrace, 'y', braceY);
      set(sumTopBrace, 'width', W);
      set(sumTopBrace, 'height', braceHeight);
      set(sumTopText, 'x', ML + W / 2);
      set(sumTopText, 'y', braceY - 8);
      sumTopText.textContent = horizontalLabel;
      setDisplay(sumTopGroup, !!horizontalLabel);
    }
    if (sumLeftGroup && sumLeftBrace && sumLeftText) {
      const verticalLabel = buildSumLabel(bottomPart, topPart);
      const braceThickness = Math.max(16, Math.min(32, Math.round(H * 0.06)));
      const braceGap = 24;
      const braceX = ML - braceGap - braceThickness;
      const braceY = MT;
      set(sumLeftBrace, 'x', braceX);
      set(sumLeftBrace, 'y', braceY);
      set(sumLeftBrace, 'width', braceThickness);
      set(sumLeftBrace, 'height', H);
      sumLeftBrace.removeAttribute('transform');
      const textX = braceX - braceThickness / 2 - 12;
      const textY = MT + H / 2;
      set(sumLeftText, 'x', textX);
      set(sumLeftText, 'y', textY);
      set(sumLeftText, 'transform', `rotate(-90 ${textX} ${textY})`);
      sumLeftText.textContent = verticalLabel;
      setDisplay(sumLeftGroup, !!verticalLabel);
    }

    // “Riktig” – doble linjer når begge sider har en tier
    const okX = wL === TEN || wR === TEN;
    const okY = hB === TEN || hT === TEN;
    const on = okX && okY;
    if (vLine) vLine.setAttribute("class", classes.split + (on ? " ok" : ""));
    if (hLine) hLine.setAttribute("class", classes.split + (on ? " ok" : ""));

    // hold håndtak/hit-soner øverst
    if (handleLeft) svg.append(handleLeft);
    if (hotLeft) svg.append(hotLeft);
    if (hitLeft) svg.append(hitLeft);
    if (a11yLeft) svg.append(a11yLeft);
    if (handleDown) svg.append(handleDown);
    if (hotBottom) svg.append(hotBottom);
    if (hitDown) svg.append(hitDown);
    if (a11yDown) svg.append(a11yDown);
    if (handleCorner) svg.append(handleCorner);
    if (hitCorner) svg.append(hitCorner);
    if (a11yCorner) svg.append(a11yCorner);
    if (totalsChanged || dimsChanged) {
      lastCols = cols;
      lastRows = rows;
      lastW = W;
      lastH = H;
    }
    syncSimpleTotals();
    syncSimpleHandles();
    if (challengeActive) {
      tryRegisterChallengeHit(cols, rows);
    }
  }

  // ---- Responsiv skalering ----
  function fitToViewport() {
    var _ADV$fit2;
    const SAFE = ((_ADV$fit2 = ADV.fit) === null || _ADV$fit2 === void 0 ? void 0 : _ADV$fit2.safePad) || {
      top: 8,
      right: 8,
      bottom: 64,
      left: 8
    };
    const availW = Math.max(100, svg.parentElement.clientWidth - (SAFE.left + SAFE.right));
    const availH = Math.max(100, window.innerHeight - (SAFE.top + SAFE.bottom));
    const s = Math.min(availW / VBW, availH / VBH);
    const w = VBW * s;
    const h = VBH * s;
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.style.width = w + "px";
    svg.style.height = h + "px";
    refreshSvgRect();
  }
  redraw();
  fitToViewport();
  maybeRefreshAltText('config');
  window.addEventListener("resize", fitToViewport, {
    passive: true
  });

  // ======== DRAGGING – pointer capture + touch-lock + rAF ========
  let active = {
    axis: null,
    pointerId: null,
    captor: null,
    startCols: 0,
    startRows: 0,
    startPointerX: null,
    startPointerY: null
  };
  let justDragged = false;
  const armJustDragged = () => {
    justDragged = true;
    setTimeout(() => {
      justDragged = false;
    }, 220);
  };
  function lockTouch() {
    const docElStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    docElStyle.touchAction = "none";
    bodyStyle.touchAction = "none";
    docElStyle.overscrollBehavior = "contain";
    bodyStyle.overscrollBehavior = "contain";
    docElStyle.userSelect = "none";
    bodyStyle.userSelect = "none";
    docElStyle.webkitUserSelect = "none";
    bodyStyle.webkitUserSelect = "none";
  }
  function unlockTouch() {
    const docElStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    docElStyle.touchAction = "";
    bodyStyle.touchAction = "";
    docElStyle.overscrollBehavior = "";
    bodyStyle.overscrollBehavior = "";
    docElStyle.userSelect = "";
    bodyStyle.userSelect = "";
    docElStyle.webkitUserSelect = "";
    bodyStyle.webkitUserSelect = "";
  }
  function onMove(e) {
    if (e.pointerId !== active.pointerId) return;
    e.preventDefault();
    const p = clientToSvg(e);
    if (active.axis === "v") {
      const y = clampAxisY(p.y);
      const newSy = MT + H - y;
      if (newSy !== sy) {
        sy = newSy;
        scheduleRedraw(true);
      }
    } else if (active.axis === "h") {
      const x = clampAxisX(p.x);
      const newSx = x - ML;
      if (newSx !== sx) {
        sx = newSx;
        scheduleRedraw(true);
      }
    } else if (active.axis === "corner") {
      const deltaX = p.x - (active.startPointerX != null ? active.startPointerX : 0);
      const deltaY = (active.startPointerY != null ? active.startPointerY : 0) - p.y;
      let nextCols = Math.round(active.startCols + deltaX / UNIT);
      let nextRows = Math.round(active.startRows + deltaY / UNIT);
      if (nextCols < 1) nextCols = 1;
      if (maxTotalCols !== Infinity && nextCols > maxTotalCols) nextCols = maxTotalCols;
      if (nextRows < 1) nextRows = 1;
      if (maxTotalRows !== Infinity && nextRows > maxTotalRows) nextRows = maxTotalRows;
      if (nextCols !== cols || nextRows !== rows) {
        cols = nextCols;
        rows = nextRows;
        scheduleRedraw(true);
      }
    }
  }
  function onUp(e) {
    if (e.pointerId !== active.pointerId) return;
    e.preventDefault();
    const axis = active.axis;
    if (axis === "v") sy = snap(sy);
    if (axis === "h") sx = snap(sx);
    if (active.captor && active.captor.releasePointerCapture) {
      try {
        active.captor.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (active.captor) active.captor.classList.remove("dragging");
    if (axis === "corner" && handleCorner) handleCorner.classList.remove("dragging");
    active.axis = null;
    active.pointerId = null;
    active.captor = null;
    active.startPointerX = null;
    active.startPointerY = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    unlockTouch();
    armJustDragged();
    scheduleRedraw(true);
  }
  function startDrag(axis, e) {
    refreshSvgRect();
    active.axis = axis;
    active.pointerId = e.pointerId;
    active.captor = e.currentTarget || e.target;
    const startPoint = clientToSvg(e);
    active.startPointerX = startPoint.x;
    active.startPointerY = startPoint.y;
    if (axis === "corner") {
      active.startCols = cols;
      active.startRows = rows;
      if (handleCorner) handleCorner.classList.add("dragging");
    }
    if (active.captor && active.captor.setPointerCapture) {
      try {
        active.captor.setPointerCapture(e.pointerId);
      } catch (_) {}
    }
    if (active.captor) active.captor.classList.add("dragging");
    lockTouch();
    window.addEventListener("pointermove", onMove, {
      passive: false
    });
    window.addEventListener("pointerup", onUp, {
      passive: false
    });
    window.addEventListener("pointercancel", onUp, {
      passive: false
    });
  }
  if (dragVertical && hitLeft) {
    hitLeft.style.touchAction = "none";
    hitLeft.addEventListener("pointerdown", e => {
      e.preventDefault();
      startDrag("v", e);
    }, {
      passive: false
    });
  }
  if (dragVertical && hotLeft) {
    hotLeft.style.touchAction = "none";
    hotLeft.addEventListener("pointerdown", e => {
      e.preventDefault();
      startDrag("v", e);
    }, {
      passive: false
    });
  }
  if (dragVertical && a11yLeft) {
    a11yLeft.style.touchAction = "none";
    a11yLeft.addEventListener("pointerdown", e => {
      e.preventDefault();
      startDrag("v", e);
    }, {
      passive: false
    });
  }
  if (dragHorizontal && hitDown) {
    hitDown.style.touchAction = "none";
    hitDown.addEventListener("pointerdown", e => {
      e.preventDefault();
      startDrag("h", e);
    }, {
      passive: false
    });
  }
  if (dragHorizontal && hotBottom) {
    hotBottom.style.touchAction = "none";
    hotBottom.addEventListener("pointerdown", e => {
      e.preventDefault();
      startDrag("h", e);
    }, {
      passive: false
    });
  }
  if (dragHorizontal && a11yDown) {
    a11yDown.style.touchAction = "none";
    a11yDown.addEventListener("pointerdown", e => {
      e.preventDefault();
      startDrag("h", e);
    }, {
      passive: false
    });
  }
  const startCornerPointer = e => {
    e.preventDefault();
    startDrag("corner", e);
  };
  if (showTotalHandle && handleCorner) {
    handleCorner.style.touchAction = "none";
    handleCorner.addEventListener("pointerdown", startCornerPointer, {
      passive: false
    });
  }
  if (showTotalHandle && hitCorner) {
    hitCorner.style.touchAction = "none";
    hitCorner.addEventListener("pointerdown", startCornerPointer, {
      passive: false
    });
  }
  if (showTotalHandle && a11yCorner) {
    a11yCorner.addEventListener("pointerdown", startCornerPointer, {
      passive: false
    });
  }
  if (a11yLeft) {
    a11yLeft.addEventListener("keydown", e => {
      let handled = true;
      if (e.key === "ArrowUp") {
        sy = clampSy(sy + UNIT);
      } else if (e.key === "ArrowDown") {
        sy = clampSy(sy - UNIT);
      } else if (e.key === "Home") {
        sy = 0;
      } else if (e.key === "End") {
        sy = rows * UNIT;
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        scheduleRedraw(true);
      }
    });
  }
  if (a11yDown) {
    a11yDown.addEventListener("keydown", e => {
      let handled = true;
      if (e.key === "ArrowRight") {
        sx = clampSx(sx + UNIT);
      } else if (e.key === "ArrowLeft") {
        sx = clampSx(sx - UNIT);
      } else if (e.key === "Home") {
        sx = 0;
      } else if (e.key === "End") {
        sx = cols * UNIT;
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        scheduleRedraw(true);
      }
    });
  }
  if (a11yCorner) {
    a11yCorner.addEventListener("keydown", e => {
      let handled = true;
      if (e.key === "ArrowUp") {
        rows = rows + 1;
        if (rows < 1) rows = 1;
        if (maxTotalRows !== Infinity && rows > maxTotalRows) rows = maxTotalRows;
      } else if (e.key === "ArrowDown") {
        rows = rows - 1;
        if (rows < 1) rows = 1;
      } else if (e.key === "ArrowRight") {
        cols = cols + 1;
        if (cols < 1) cols = 1;
        if (maxTotalCols !== Infinity && cols > maxTotalCols) cols = maxTotalCols;
      } else if (e.key === "ArrowLeft") {
        cols = cols - 1;
        if (cols < 1) cols = 1;
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        scheduleRedraw(true);
      }
    });
  }
  const onSvgClick = e => {
    if (justDragged) return;
    refreshSvgRect();
    const p = clientToSvg(e);
    if (dragVertical && showHeightAxis && Math.abs(p.x - ML) < 12 && p.y >= MT && p.y <= MT + H) {
      sy = snap(MT + H - clampAxisY(p.y));
      scheduleRedraw(true);
    }
    if (dragHorizontal && showLengthAxis && Math.abs(p.y - (MT + H)) < 12 && p.x >= ML && p.x <= ML + W) {
      sx = snap(clampAxisX(p.x) - ML);
      scheduleRedraw(true);
    }
  };
  if (clickToMove) {
    svg.addEventListener("click", onSvgClick);
  }
  function buildExportOptions(overrides = {}) {
    var _ADV$export, _ADV$export2, _ADV$fit3;
    const includeHandlesDefault = showLeftHandle || showBottomHandle || ((_ADV$export = ADV.export) === null || _ADV$export === void 0 ? void 0 : _ADV$export.includeHandlesIfHidden);
    const includeHandles = overrides.includeHandles !== undefined ? !!overrides.includeHandles : includeHandlesDefault;
    const includeHandleHits = overrides.includeHandleHits !== undefined ? !!overrides.includeHandleHits : includeHandlesDefault;
    const includeHotZones = overrides.includeHotZones !== undefined ? !!overrides.includeHotZones : true;
    return {
      unit: UNIT,
      rows,
      cols,
      margins: {
        ML,
        MR,
        MT,
        MB
      },
      width: W,
      height: H,
      vbw: VBW,
      vbh: VBH,
      sx,
      sy,
      TEN,
      layout: layoutMode,
      limits: {
        minColsEachSide,
        minRowsEachSide
      },
      classes,
      includeGrid: !!((_ADV$export2 = ADV.export) !== null && _ADV$export2 !== void 0 && _ADV$export2.includeGrid),
      showHeightAxis,
      showLengthAxis,
      includeHandles,
      includeHandleHits,
      includeHotZones,
      colorsCSS: getInlineStyleDefaults(),
      handleSize: HANDLE_SIZE,
      icons: {
        horizUrl: ADV.handleIcons.horiz,
        vertUrl: ADV.handleIcons.vert
      },
      edgeGap: EDGE_GAP,
      safePad: ((_ADV$fit3 = ADV.fit) === null || _ADV$fit3 === void 0 ? void 0 : _ADV$fit3.safePad) || {
        top: 8,
        right: 8,
        bottom: 64,
        left: 8
      },
      showTotalHandle: !!(CFG.SIMPLE.totalHandle && CFG.SIMPLE.totalHandle.show),
      showSum,
      variables,
      labels: {
        dot: (ADV.labels && typeof ADV.labels.dot === 'string') ? ADV.labels.dot : ' · ',
        equals: (ADV.labels && typeof ADV.labels.equals === 'string') ? ADV.labels.equals : ' = ',
        cellMode: (ADV.labels && typeof ADV.labels.cellMode === 'string') ? ADV.labels.cellMode : 'factors',
        edgeMode: (ADV.labels && typeof ADV.labels.edgeMode === 'string') ? ADV.labels.edgeMode : 'counts'
      }
    };
  }
  const legacySvgStaticBtn = document.getElementById("btnSvgStatic");
  const btnSvgDownload = legacySvgStaticBtn || document.getElementById("btnSvg");
  if (btnSvgDownload) btnSvgDownload.onclick = () => {
    var _ADV$export3;
    const exportOptions = buildExportOptions({
      includeHandles: false,
      includeHandleHits: false,
      includeHotZones: false
    });
    const svgStr = buildBaseSvgMarkup(exportOptions, true);
    const filename = ((_ADV$export3 = ADV.export) === null || _ADV$export3 === void 0 ? void 0 : _ADV$export3.filenamePng) || "arealmodell.png";
    downloadPNGFromString(svgStr, filename);
  };
  const btnPng = document.getElementById("btnPng");
  if (btnPng) btnPng.onclick = () => {
    var _ADV$export4;
    const svgStr = buildBaseSvgMarkup(buildExportOptions({
      includeHandles: false,
      includeHandleHits: false,
      includeHotZones: false
    }), true);
    downloadPNGFromString(svgStr, ((_ADV$export4 = ADV.export) === null || _ADV$export4 === void 0 ? void 0 : _ADV$export4.filenamePng) || "arealmodell.png");
  };
  const btnSvgInteractive = document.getElementById("btnSvgInteractive") || (legacySvgStaticBtn ? document.getElementById("btnSvg") : null);
  if (btnSvgInteractive) btnSvgInteractive.onclick = async () => {
    var _ADV$export5;
    const exportOptions = buildExportOptions();
    const svgStr = buildInteractiveSvgString(exportOptions);
    const svgElement = document.getElementById("area");
    const helper = typeof window !== "undefined" ? window.MathVisSvgExport : null;
    if (svgElement && helper && typeof helper.exportGraphicWithArchive === "function") {
      maybeRefreshAltText("export");
      const meta = buildArealmodellExportMeta();
      try {
        await helper.exportGraphicWithArchive(svgElement, ((_ADV$export5 = ADV.export) === null || _ADV$export5 === void 0 ? void 0 : _ADV$export5.filename) || "arealmodell_interaktiv.svg", "arealmodell", {
          svgString: svgStr,
          description: meta.description,
          defaultBaseName: meta.defaultBaseName,
          summary: meta.summary,
          title: meta.title
        });
        return;
      } catch (error) {
        console.error("Kunne ikke eksportere via arkivet", error);
      }
    }
    downloadText(((_ADV$export5 = ADV.export) === null || _ADV$export5 === void 0 ? void 0 : _ADV$export5.filename) || "arealmodell_interaktiv.svg", svgStr, "image/svg+xml");
  };

  // ===== Eksporter interaktiv HTML =====
  const btnHtml = document.getElementById("btnHtml");
  if (btnHtml) btnHtml.onclick = () => {
    var _ADV$export6, _ADV$export7, _ADV$fit4, _ADV$export8;
    const includeHandles = showLeftHandle || showBottomHandle || ((_ADV$export6 = ADV.export) === null || _ADV$export6 === void 0 ? void 0 : _ADV$export6.includeHandlesIfHidden);
    const htmlStr = buildInteractiveHtmlString({
      unit: UNIT,
      rows,
      cols,
      margins: {
        ML,
        MR,
        MT,
        MB
      },
      width: W,
      height: H,
      vbw: VBW,
      vbh: VBH,
      sx,
      sy,
      TEN,
      limits: {
        minColsEachSide,
        minRowsEachSide
      },
      classes,
      includeGrid: !!((_ADV$export7 = ADV.export) !== null && _ADV$export7 !== void 0 && _ADV$export7.includeGrid),
      showHeightAxis,
      showLengthAxis,
      includeHandles,
      includeHandleHits: includeHandles,
      includeHotZones: true,
      colorsCSS: getInlineStyleDefaults(),
      handleSize: HANDLE_SIZE,
      icons: {
        horizUrl: ADV.handleIcons.horiz,
        vertUrl: ADV.handleIcons.vert
      },
      edgeGap: EDGE_GAP,
      safePad: ((_ADV$fit4 = ADV.fit) === null || _ADV$fit4 === void 0 ? void 0 : _ADV$fit4.safePad) || {
        top: 8,
        right: 8,
        bottom: 64,
        left: 8
      },
      showTotalHandle: !!(CFG.SIMPLE.totalHandle && CFG.SIMPLE.totalHandle.show),
      showSum,
      variables,
      labels: {
        dot: (ADV.labels && typeof ADV.labels.dot === 'string') ? ADV.labels.dot : ' · ',
        equals: (ADV.labels && typeof ADV.labels.equals === 'string') ? ADV.labels.equals : ' = ',
        cellMode: (ADV.labels && typeof ADV.labels.cellMode === 'string') ? ADV.labels.cellMode : 'factors',
        edgeMode: (ADV.labels && typeof ADV.labels.edgeMode === 'string') ? ADV.labels.edgeMode : 'counts'
      }
    });
    const fname = ((_ADV$export8 = ADV.export) === null || _ADV$export8 === void 0 ? void 0 : _ADV$export8.filenameHtml) || "arealmodell_interaktiv.html";
    downloadText(fname, htmlStr, "text/html;charset=utf-8");
  };

  cleanupCurrentDraw = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    window.removeEventListener("resize", fitToViewport);
    if (clickToMove) {
      svg.removeEventListener("click", onSvgClick);
    }
  };

  // ===== helpers =====
  function downloadText(filename, text, mime) {
    const blob = new Blob([text], {
      type: mime
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
  function downloadPNGFromString(svgStr, filename) {
    const blob = new Blob([svgStr], {
      type: 'image/svg+xml;charset=utf-8'
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
        setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
      }, 'image/png');
    };
    img.src = url;
  }

  // === FARGER/typografi ===
  function getInlineStyleDefaults() {
    const cols = ensureColors(ADV.colors, DEFAULT_RECT_COLORS, 4);
    const luminance = color => {
      if (typeof color !== 'string') return 0;
      const hexMatch = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
      let r = 0,
        g = 0,
        b = 0;
      if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) {
          hex = hex
            .split('')
            .map(ch => ch + ch)
            .join('');
        }
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      } else {
        const rgbMatch = color
          .replace(/\s+/g, '')
          .match(/^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,(0|0?\.\d+|1))?\)$/i);
        if (rgbMatch) {
          r = parseInt(rgbMatch[1], 10);
          g = parseInt(rgbMatch[2], 10);
          b = parseInt(rgbMatch[3], 10);
        }
      }
      const toLinear = v => {
        const channel = Math.max(0, Math.min(255, v)) / 255;
        return channel <= 0.03928
          ? channel / 12.92
          : Math.pow((channel + 0.055) / 1.055, 2.4);
      };
      const R = toLinear(r);
      const G = toLinear(g);
      const B = toLinear(b);
      return 0.2126 * R + 0.7152 * G + 0.0722 * B;
    };
    const pickTextColor = color => {
      const L = luminance(color);
      const contrastWhite = (1.0 + 0.05) / (L + 0.05);
      const contrastBlack = (L + 0.05) / 0.05;
      return contrastWhite >= contrastBlack ? '#fff' : '#000';
    };
    const textColors = cols.map(pickTextColor);
    return `
.outer { fill: white; stroke: #333; stroke-width: 3; pointer-events: none; }
.split { stroke: #333; stroke-width: 3; transition: stroke-width .12s ease; pointer-events: none; }
.split.ok { stroke-width: 6; }
.cell  { stroke: #333; stroke-width: 2; pointer-events: none; }

.c1 { fill: ${cols[0]}; }
.c2 { fill: ${cols[1]}; }
.c3 { fill: ${cols[2]}; }
.c4 { fill: ${cols[3]}; }

.labelCell[data-cell-index="0"] { fill: ${textColors[0]}; }
.labelCell[data-cell-index="1"] { fill: ${textColors[1]}; }
.labelCell[data-cell-index="2"] { fill: ${textColors[2]}; }
.labelCell[data-cell-index="3"] { fill: ${textColors[3]}; }


.grid line { stroke: #000; stroke-opacity: .28; stroke-width: 1; pointer-events: none; }
.labelCell { font: 600 22px system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #222; pointer-events: none; }
.labelEdge { font: 600 26px system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #333; pointer-events: none; }
svg text { user-select: none; -webkit-user-select: none; }
.sum-brace { pointer-events: none; }
.sum-brace image { pointer-events: none; opacity: 0.82; }
.sum-text { font: 600 24px system-ui, -apple-system, Segoe UI, Roboto, Arial; fill: #111827; pointer-events: none; }

.handleImg { pointer-events: none; }
.handleCorner { fill: #ecebf6; stroke: #333; stroke-width: 2; cursor: grab; pointer-events: all; user-select: none; -webkit-user-select: none; }
.handleCorner.dragging { cursor: grabbing; }
.handleOverlay { cursor: grab; pointer-events: all; }
.handleOverlay.dragging { cursor: grabbing; }
.handleHit, .hot, svg { touch-action: none; }
.handleHit { fill: rgba(0,0,0,0.004); cursor: grab; pointer-events: all; user-select: none; -webkit-user-select: none; }
.hot { fill: transparent; pointer-events: all; cursor: grab; user-select: none; -webkit-user-select: none; }
.hot.dragging { cursor: grabbing; }
`;
  }
  function injectRuntimeStyles() {
    const css = getInlineStyleDefaults();
    if (runtimeStyleElement && runtimeStyleElement.parentNode) {
      runtimeStyleElement.textContent = css;
      return;
    }
    const existing = document.getElementById("arealmodell-runtime-css");
    runtimeStyleElement = existing || document.createElement("style");
    runtimeStyleElement.id = "arealmodell-runtime-css";
    runtimeStyleElement.textContent = css;
    if (!existing) {
      document.head.appendChild(runtimeStyleElement);
    }
  }

  // -------- Base-SVG uten skript --------
  function buildBaseSvgMarkup(o, includeXmlHeader) {
    var _o$handleSize, _o$edgeGap$x, _o$edgeGap, _o$edgeGap$y, _o$edgeGap2;
    const ML = o.margins.ML,
      MT = o.margins.MT;
    const layoutState = computeLayoutState(o.layout, o.width, o.height, o.cols, o.rows, o.sx, o.sy, o.unit);
    const exportAltText = getActiveArealmodellAltText();
    const leftWidth = layoutState.leftWidth;
    const rightWidth = layoutState.rightWidth;
    const topHeight = layoutState.topHeight;
    const bottomHeight = layoutState.bottomHeight;
    const wL = layoutState.leftCols;
    const wR = layoutState.rightCols;
    const hB = layoutState.bottomRows;
    const hT = layoutState.topRows;
    const HS = (_o$handleSize = o.handleSize) !== null && _o$handleSize !== void 0 ? _o$handleSize : 84;
    const gapX = (_o$edgeGap$x = (_o$edgeGap = o.edgeGap) === null || _o$edgeGap === void 0 ? void 0 : _o$edgeGap.x) !== null && _o$edgeGap$x !== void 0 ? _o$edgeGap$x : 14,
      gapY = (_o$edgeGap$y = (_o$edgeGap2 = o.edgeGap) === null || _o$edgeGap2 === void 0 ? void 0 : _o$edgeGap2.y) !== null && _o$edgeGap$y !== void 0 ? _o$edgeGap$y : 32;
    const includeHandles = !!o.includeHandles;
    const includeHandleHits = o.includeHandleHits !== undefined ? !!o.includeHandleHits : includeHandles;
    const includeHotZones = o.includeHotZones !== undefined ? !!o.includeHotZones : true;
    const showVerticalSplit = o.showLengthAxis && leftWidth > 0 && rightWidth > 0;
    const showHorizontalSplit = o.showHeightAxis && topHeight > 0 && bottomHeight > 0;
    const displayAttr = visible => visible ? "" : ' display="none"';
    let gridStr = "";
    if (o.includeGrid) {
      let lines = [];
      for (let i = 1; i < o.cols; i++) {
        const x = ML + o.unit * i;
        lines.push('<line x1="' + x + '" y1="' + MT + '" x2="' + x + '" y2="' + (MT + o.height) + '" />');
      }
      for (let j = 1; j < o.rows; j++) {
        const y = MT + o.unit * j;
        lines.push('<line x1="' + ML + '" y1="' + y + '" x2="' + (ML + o.width) + '" y2="' + y + '" />');
      }
      gridStr = '<g class="' + o.classes.grid + '" clip-path="url(#clipR)">' + lines.join("") + '</g>';
    }
    const vLineStr = o.showLengthAxis ? '<line id="vLine" class="' + o.classes.split + '" x1="' + (ML + leftWidth) + '" y1="' + MT + '" x2="' + (ML + leftWidth) + '" y2="' + (MT + o.height) + '"' + displayAttr(showVerticalSplit) + '/>' : "";
    const hLineStr = o.showHeightAxis ? '<line id="hLine" class="' + o.classes.split + '" x1="' + ML + '" y1="' + (MT + topHeight) + '" x2="' + (ML + o.width) + '" y2="' + (MT + topHeight) + '"' + displayAttr(showHorizontalSplit) + '/>' : "";
    const hLeftImg = includeHandles && o.showHeightAxis ? '<image id="hLeft" class="' + o.classes.handle + '" href="' + (o.icons.vertUrl || '') + '" width="' + HS + '" height="' + HS + '" x="' + (ML - HS / 2) + '" y="' + (MT + topHeight - HS / 2) + '"/>' : "";
    const hDownImg = includeHandles && o.showLengthAxis ? '<image id="hDown" class="' + o.classes.handle + '" href="' + (o.icons.horizUrl || '') + '" width="' + HS + '" height="' + HS + '" x="' + (ML + leftWidth - HS / 2) + '" y="' + (MT + o.height - HS / 2) + '"/>' : "";

    // Start på riktig posisjon
    const hLeftHit = includeHandleHits && o.showHeightAxis ? '<circle id="hLeftHit" class="handleHit" r="' + HS * 0.55 + '" cx="' + ML + '" cy="' + (MT + topHeight) + '" style="cursor:grab"/>' : "";
    const hDownHit = includeHandleHits && o.showLengthAxis ? '<circle id="hDownHit" class="handleHit" r="' + HS * 0.55 + '" cx="' + (ML + leftWidth) + '" cy="' + (MT + o.height) + '" style="cursor:grab"/>' : "";
    const hotLeftStr = includeHotZones && o.showHeightAxis ? '<rect id="hotLeft" class="hot" x="' + (ML - HOT_ZONE.x) + '" y="' + MT + '" width="' + HOT_ZONE.x + '" height="' + o.height + '"/>' : "";
    const hotBottomStr = includeHotZones && o.showLengthAxis ? '<rect id="hotBottom" class="hot" x="' + ML + '" y="' + (MT + o.height) + '" width="' + o.width + '" height="' + HOT_ZONE.y + '"/>' : "";
    const parts = [];
    if (includeXmlHeader) parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + o.vbw + ' ' + o.vbh + '" width="' + o.vbw + '" height="' + o.vbh + '" tabindex="0">');
    parts.push('<title>Arealmodell – dragbare delinger</title>');
    if (exportAltText) {
      parts.push('<desc>' + escapeXml(exportAltText) + '</desc>');
    }
    parts.push('<style>' + o.colorsCSS + '</style>');
    parts.push('<defs><clipPath id="clipR"><rect x="' + ML + '" y="' + MT + '" width="' + o.width + '" height="' + o.height + '"/></clipPath></defs>');
    parts.push('<rect class="' + o.classes.outer + '" x="' + ML + '" y="' + MT + '" width="' + o.width + '" height="' + o.height + '"/>');
    parts.push('<rect id="rTL" class="cell ' + o.classes.cells[0] + '" x="' + ML + '" y="' + MT + '" width="' + leftWidth + '" height="' + topHeight + '"></rect>');
    parts.push('<rect id="rTR" class="cell ' + o.classes.cells[1] + '" x="' + (ML + leftWidth) + '" y="' + MT + '" width="' + rightWidth + '" height="' + topHeight + '"' + displayAttr(layoutState.showTopRight) + '></rect>');
    parts.push('<rect id="rBL" class="cell ' + o.classes.cells[2] + '" x="' + ML + '" y="' + (MT + topHeight) + '" width="' + leftWidth + '" height="' + bottomHeight + '"' + displayAttr(layoutState.showBottomLeft) + '></rect>');
    parts.push('<rect id="rBR" class="cell ' + o.classes.cells[3] + '" x="' + (ML + leftWidth) + '" y="' + (MT + topHeight) + '" width="' + rightWidth + '" height="' + bottomHeight + '"' + displayAttr(layoutState.showBottomRight) + '></rect>');
    parts.push(gridStr);
    parts.push(vLineStr, hLineStr, hotLeftStr, hotBottomStr, hLeftImg, hDownImg, hLeftHit, hDownHit);

    // cell-tekster
    const showTL = layoutState.showTopLeft && wL > 0 && hT > 0;
    const showTR = layoutState.showTopRight && wR > 0 && hT > 0;
    const showBL = layoutState.showBottomLeft && wL > 0 && hB > 0;
    const showBR = layoutState.showBottomRight && wR > 0 && hB > 0;
    const labelTL = showTL ? formatCellLabelFromParts(leftPart, topPart, cellMode, dot, equals) : '';
    const labelTR = showTR ? formatCellLabelFromParts(rightPart, topPart, cellMode, dot, equals) : '';
    const labelBL = showBL ? formatCellLabelFromParts(leftPart, bottomPart, cellMode, dot, equals) : '';
    const labelBR = showBR ? formatCellLabelFromParts(rightPart, bottomPart, cellMode, dot, equals) : '';
    const horizontalSumLabel = sumEnabled ? buildSumLabel(leftPart, rightPart) : '';
    const verticalSumLabel = sumEnabled ? buildSumLabel(bottomPart, topPart) : '';
    parts.push('<text id="tTL" class="labelCell" data-cell-index="0" x="' + (ML + leftWidth / 2) + '" y="' + (MT + topHeight / 2 + 8) + '" text-anchor="middle">' + labelTL + '</text>');
    parts.push('<text id="tTR" class="labelCell" data-cell-index="1" x="' + (ML + leftWidth + rightWidth / 2) + '" y="' + (MT + topHeight / 2 + 8) + '" text-anchor="middle"' + displayAttr(showTR) + '>' + (showTR ? labelTR : '') + '</text>');
    parts.push('<text id="tBL" class="labelCell" data-cell-index="2" x="' + (ML + leftWidth / 2) + '" y="' + (MT + topHeight + bottomHeight / 2 + 8) + '" text-anchor="middle"' + displayAttr(showBL) + '>' + (showBL ? labelBL : '') + '</text>');
    parts.push('<text id="tBR" class="labelCell" data-cell-index="3" x="' + (ML + leftWidth + rightWidth / 2) + '" y="' + (MT + topHeight + bottomHeight / 2 + 8) + '" text-anchor="middle"' + displayAttr(showBR) + '>' + (showBR ? labelBR : '') + '</text>');

    // kant-tekst Utenfor, med luft:
    const xL = ML - HS / 2 - gapX;
    const yB = MT + o.height + HS / 2 + gapY;
    if (o.showHeightAxis && !sumEnabled) {
      const topEdgeText = edgeMode === 'counts' ? (topPart.display || '') : '';
      const bottomEdgeText = edgeMode === 'counts' ? (bottomPart.display || '') : '';
      parts.push('<text id="leftTop" class="labelEdge" x="' + xL + '" y="' + (MT + topHeight / 2 + 10) + '" text-anchor="end">' + topEdgeText + '</text>');
      parts.push('<text id="leftBot" class="labelEdge" x="' + xL + '" y="' + (MT + topHeight + bottomHeight / 2 + 10) + '" text-anchor="end">' + bottomEdgeText + '</text>');
    }
    if (o.showLengthAxis && !sumEnabled) {
      const leftEdgeText = edgeMode === 'counts' ? (leftPart.display || '') : '';
      const rightEdgeText = edgeMode === 'counts' ? (rightPart.display || '') : '';
      parts.push('<text id="botLeft"  class="labelEdge" x="' + (ML + leftWidth / 2) + '" y="' + yB + '" text-anchor="middle">' + leftEdgeText + '</text>');
      parts.push('<text id="botRight" class="labelEdge" x="' + (ML + leftWidth + rightWidth / 2) + '" y="' + yB + '" text-anchor="middle">' + rightEdgeText + '</text>');
    }
    if (sumEnabled && horizontalSumLabel) {
      const braceHeight = Math.max(16, Math.min(32, Math.round(o.width * 0.06)));
      const braceGap = 24;
      const braceY = MT - braceGap - braceHeight;
      parts.push('<g id="sumTopGroup" class="sum-brace sum-brace--top"><image id="sumTopBrace" href="' + SUM_BRACE_TOP_IMAGE + '" x="' + ML + '" y="' + braceY + '" width="' + o.width + '" height="' + braceHeight + '" preserveAspectRatio="none"></image><text id="sumTopText" class="sum-text" text-anchor="middle" x="' + (ML + o.width / 2) + '" y="' + (braceY - 8) + '">' + horizontalSumLabel + '</text></g>');
    }
    if (sumEnabled && verticalSumLabel) {
      const braceThickness = Math.max(16, Math.min(32, Math.round(o.height * 0.06)));
      const braceGap = 24;
      const braceX = ML - braceGap - braceThickness;
      const braceY = MT;
      const textX = braceX - braceThickness / 2 - 12;
      const textY = MT + o.height / 2;
      parts.push('<g id="sumLeftGroup" class="sum-brace sum-brace--left"><image id="sumLeftBrace" href="' + SUM_BRACE_LEFT_IMAGE + '" x="' + braceX + '" y="' + braceY + '" width="' + braceThickness + '" height="' + o.height + '" preserveAspectRatio="none"></image><text id="sumLeftText" class="sum-text" text-anchor="middle" dominant-baseline="middle" x="' + textX + '" y="' + textY + '" transform="rotate(-90 ' + textX + ' ' + textY + ')">' + verticalSumLabel + '</text></g>');
    }
    parts.push("</svg>");
    return parts.join("\n");
  }

  // runtime-skript (eksportert SVG/HTML)

  function buildRuntimeScriptText(o, rootExpr) {
    var _o$handleSize2, _o$edgeGap$x2, _o$edgeGap3, _o$edgeGap$y2, _o$edgeGap4;
    const ML = o.margins.ML,
      MT = o.margins.MT;
    const layoutMode = normalizeLayout(o.layout);
    const showHeightAxis = !!o.showHeightAxis;
    const showLengthAxis = !!o.showLengthAxis;
    const includeClickToMove = ADV.clickToMove !== false && (showHeightAxis || showLengthAxis);
    const sumEnabled = !!o.showSum;
    const scriptVariables = o.variables || {};
    const scriptLabels = o.labels || {};
    const scriptDot = typeof scriptLabels.dot === 'string' ? scriptLabels.dot : ' · ';
    const scriptEquals = typeof scriptLabels.equals === 'string' ? scriptLabels.equals : ' = ';
    const scriptCellMode = typeof scriptLabels.cellMode === 'string' ? scriptLabels.cellMode : 'factors';
    const scriptEdgeMode = typeof scriptLabels.edgeMode === 'string' ? scriptLabels.edgeMode : 'counts';
    const clickParts = [];
    if (includeClickToMove) {
      if (showHeightAxis) {
        clickParts.push("if(Math.abs(p.x-ML)<12 && p.y>=MT && p.y<=MT+H){ var clampedY=clampAxisY(p.y); sy=Math.round(((MT+H)-clampedY)/UNIT)*UNIT; schedule(true); }");
      }
      if (showLengthAxis) {
        const prefix = showHeightAxis ? "else " : "";
        clickParts.push(prefix + "if(Math.abs(p.y-(MT+H))<12 && p.x>=ML && p.x<=ML+W){ var clampedX=clampAxisX(p.x); sx=Math.round((clampedX-ML)/UNIT)*UNIT; schedule(true); }");
      }
    }
    const clickHandler = includeClickToMove ? "root.addEventListener('click',function(e){ if(justDragged) return; var p=clientToSvg(e); " + clickParts.join(" ") + " });" : "";
    const gapX = (_o$edgeGap$x2 = (_o$edgeGap3 = o.edgeGap) === null || _o$edgeGap3 === void 0 ? void 0 : _o$edgeGap3.x) !== null && _o$edgeGap$x2 !== void 0 ? _o$edgeGap$x2 : 14,
      gapY = (_o$edgeGap$y2 = (_o$edgeGap4 = o.edgeGap) === null || _o$edgeGap4 === void 0 ? void 0 : _o$edgeGap4.y) !== null && _o$edgeGap$y2 !== void 0 ? _o$edgeGap$y2 : 32;
    const safePad = o.safePad || {
      top: 8,
      right: 8,
      bottom: 64,
      left: 8
    };
    const splitClass = (o.classes === null || o.classes === void 0 ? void 0 : o.classes.split) || "";
    const lines = [];
    lines.push("(function(){");
    lines.push("function sanitizeVariable(value){ if(typeof value !== 'string') return ''; var trimmed=value.trim(); if(!trimmed) return ''; return trimmed.replace(/\\s+/g,'').replace(/[^0-9A-Za-zÆØÅæøå]/g,''); }");
    lines.push(`var VAR1=sanitizeVariable(${JSON.stringify(scriptVariables.variable1 || '')});`);
    lines.push(`var VAR2=sanitizeVariable(${JSON.stringify(scriptVariables.variable2 || '')});`);
    lines.push(`var SHOW_SUM=${sumEnabled ? 'true' : 'false'};`);
    lines.push(`var DOT=${JSON.stringify(scriptDot)};`);
    lines.push(`var EQUALS=${JSON.stringify(scriptEquals)};`);
    lines.push(`var CELL_MODE=${JSON.stringify(scriptCellMode)};`);
    lines.push(`var EDGE_MODE=${JSON.stringify(scriptEdgeMode)};`);
    lines.push("var intFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO') : null;");
    lines.push("function fmtInt(value){ return Number.isFinite(value) ? (intFormatter ? intFormatter.format(value) : String(value)) : ''; }");
    lines.push("function makeAxisPart(value, variable){ var numeric = Number.isFinite(value) ? value : NaN; if(!Number.isFinite(value) || value <= 0){ return { value: numeric, token: '', display: '', isVariable: false }; } var cleaned = sanitizeVariable(variable); if(cleaned){ return { value: numeric, token: cleaned, display: cleaned, isVariable: true }; } var label = fmtInt(value); return { value: numeric, token: label, display: label, isVariable: false }; }");
    lines.push("function buildAlgebraProduct(rowPart, colPart){ if(!rowPart || !colPart) return ''; var rowVar=rowPart.isVariable?rowPart.token:''; var colVar=colPart.isVariable?colPart.token:''; var rowNum=!rowPart.isVariable && Number.isFinite(rowPart.value)?fmtInt(rowPart.value):''; var colNum=!colPart.isVariable && Number.isFinite(colPart.value)?fmtInt(colPart.value):''; if(!rowVar && !colVar) return ''; if(rowVar && colVar){ if(rowVar===colVar) return rowVar+'\\u00B2'; return rowVar+colVar; } if(rowVar && colNum) return colNum+rowVar; if(rowNum && colVar) return rowNum+colVar; if(rowVar) return rowVar; if(colVar) return colVar; return ''; }");
    lines.push("function buildSumLabel(partA, partB){ var terms=[]; if(partA && partA.display) terms.push(partA.display); if(partB && partB.display) terms.push(partB.display); return terms.length ? terms.join('+') : ''; }");
    lines.push("function formatCellLabel(colPart, rowPart){ if(!colPart || !rowPart || CELL_MODE==='none') return ''; var colLabel = colPart.isVariable ? colPart.token : fmtInt(colPart.value); var rowLabel = rowPart.isVariable ? rowPart.token : fmtInt(rowPart.value); var factorLabel = colLabel && rowLabel ? colLabel + DOT + rowLabel : (colLabel || rowLabel || ''); var numericProduct = Number.isFinite(colPart.value) && Number.isFinite(rowPart.value) ? fmtInt(colPart.value * rowPart.value) : ''; var algebraProduct = buildAlgebraProduct(rowPart, colPart); var hasVariables = algebraProduct !== ''; if (CELL_MODE==='factors'){ if(rowPart.isVariable && colPart.isVariable) return algebraProduct; if(rowPart.isVariable) return rowPart.token; if(colPart.isVariable) return colPart.token; return factorLabel; } if (CELL_MODE==='area'){ return hasVariables ? algebraProduct : numericProduct; } if (CELL_MODE==='both'){ var right = hasVariables ? algebraProduct : numericProduct; if(factorLabel && right) return factorLabel + EQUALS + right; return factorLabel || right || ''; } return factorLabel; }");
    lines.push(`var UNIT=${o.unit}, ROWS=${o.rows}, COLS=${o.cols}, TEN=${o.TEN};`);
    lines.push(`var ML=${ML}, MT=${MT}, W=${o.width}, H=${o.height};`);
    lines.push(`var layoutMode=${JSON.stringify(layoutMode)};`);
    lines.push(`var minColsEachSide=${o.limits.minColsEachSide}, minRowsEachSide=${o.limits.minRowsEachSide};`);
    lines.push("var minSX=minColsEachSide*UNIT, maxSX=(COLS-minColsEachSide)*UNIT, minSY=minRowsEachSide*UNIT, maxSY=(ROWS-minRowsEachSide)*UNIT;");
    lines.push(`var SPLIT_C=${JSON.stringify(splitClass)};`);
    lines.push(`var HS=${(_o$handleSize2 = o.handleSize) !== null && _o$handleSize2 !== void 0 ? _o$handleSize2 : 84}, GAPX=${gapX}, GAPY=${gapY};`);
    lines.push("var HOT_ZONE_X=Math.max(18, Math.round(HS * 0.45)), HOT_ZONE_Y=Math.max(18, Math.round(HS * 0.45));");
    lines.push(`var SAFE=${JSON.stringify(safePad)};`);
    lines.push(`var root=${rootExpr}; root.style.touchAction='none';`);
    lines.push("var rTL=document.getElementById('rTL'), rTR=document.getElementById('rTR'), rBL=document.getElementById('rBL'), rBR=document.getElementById('rBR');");
    lines.push("var vLine=document.getElementById('vLine'), hLine=document.getElementById('hLine');");
    lines.push("var tTL=document.getElementById('tTL'), tTR=document.getElementById('tTR'), tBL=document.getElementById('tBL'), tBR=document.getElementById('tBR');");
    lines.push("var leftTop=document.getElementById('leftTop'), leftBot=document.getElementById('leftBot'), botLeft=document.getElementById('botLeft'), botRight=document.getElementById('botRight');");
    lines.push("var sumTopGroup=document.getElementById('sumTopGroup'), sumTopBrace=document.getElementById('sumTopBrace'), sumTopText=document.getElementById('sumTopText');");
    lines.push("var sumLeftGroup=document.getElementById('sumLeftGroup'), sumLeftBrace=document.getElementById('sumLeftBrace'), sumLeftText=document.getElementById('sumLeftText');");
    lines.push("var hLeft=document.getElementById('hLeft'), hDown=document.getElementById('hDown');");
    lines.push("var hitLeft=document.getElementById('hLeftHit'), hitDown=document.getElementById('hDownHit');");
    lines.push("var hotLeft=document.getElementById('hotLeft'), hotBottom=document.getElementById('hotBottom');");
    lines.push(`var vb=root.viewBox.baseVal; var sx=${o.sx}, sy=${o.sy};`);
    lines.push("function set(node, attr, value){ if(node) node.setAttribute(attr, value); }");
    lines.push("function setDisplay(node, visible){ if(!node) return; if(visible){ node.removeAttribute('display'); } else { node.setAttribute('display','none'); }}");
    lines.push("function clamp(value, min, max){ return Math.max(min, Math.min(max, value)); }");
    lines.push("function clampEdges(value, innerMin, innerMax, edgeMin, edgeMax){ var EPS=1e-6; if(value <= edgeMin + EPS) return edgeMin; if(value >= edgeMax - EPS) return edgeMax; var low=Math.min(Math.max(innerMin, edgeMin), edgeMax); var high=Math.max(Math.min(innerMax, edgeMax), edgeMin); if(high < low) return Math.max(edgeMin, Math.min(edgeMax, value)); return Math.max(low, Math.min(high, value)); }");
    lines.push("function clampSxValue(v){ return clampEdges(v, minSX, maxSX, 0, W); }");
    lines.push("function clampSyValue(v){ return clampEdges(v, minSY, maxSY, 0, H); }");
    lines.push("function clampAxisX(v){ return clampEdges(v, ML + minSX, ML + maxSX, ML, ML + W); }");
    lines.push("function clampAxisY(v){ return clampEdges(v, MT + minSY, MT + maxSY, MT, MT + H); }");
    lines.push("function snap(value){ return Math.round(value/UNIT)*UNIT; }");
    lines.push("function normalizeLayoutValue(value){ return value==='horizontal'||value==='vertical'?value:'quad'; }");
    lines.push("function computeLayoutState(layout,width,height,cols,rows,sxVal,syVal,unit){");
    lines.push("  layout = normalizeLayoutValue(layout);");
    lines.push("  var effectiveSx = layout==='vertical' ? width : sxVal;");
    lines.push("  var effectiveSy = layout==='horizontal' ? 0 : syVal;");
    lines.push("  var leftWidth = clamp(effectiveSx, 0, width);");
    lines.push("  var rightWidth = Math.max(0, width - leftWidth);");
    lines.push("  var bottomHeight = clamp(effectiveSy, 0, height);");
    lines.push("  var topHeight = Math.max(0, height - bottomHeight);");
    lines.push("  var leftCols = clamp(Math.round(leftWidth / unit), 0, cols);");
    lines.push("  var rightCols = Math.max(0, cols - leftCols);");
    lines.push("  var bottomRows = clamp(Math.round(bottomHeight / unit), 0, rows);");
    lines.push("  var topRows = Math.max(0, rows - bottomRows);");
    lines.push("  return {");
    lines.push("    mode: layout,");
    lines.push("    leftWidth: leftWidth,");
    lines.push("    rightWidth: rightWidth,");
    lines.push("    topHeight: topHeight,");
    lines.push("    bottomHeight: bottomHeight,");
    lines.push("    leftCols: leftCols,");
    lines.push("    rightCols: rightCols,");
    lines.push("    topRows: topRows,");
    lines.push("    bottomRows: bottomRows,");
    lines.push("    showTopLeft: leftWidth > 0 && topHeight > 0,");
    lines.push("    showTopRight: layout !== 'vertical' && rightWidth > 0 && topHeight > 0,");
    lines.push("    showBottomLeft: layout !== 'horizontal' && leftWidth > 0 && bottomHeight > 0,");
    lines.push("    showBottomRight: layout === 'quad' && rightWidth > 0 && bottomHeight > 0");
    lines.push("  };");
    lines.push("}");
    lines.push("var rect=root.getBoundingClientRect(); function refreshRect(){ rect=root.getBoundingClientRect(); }");
    lines.push("function clientToSvg(e){ var sxp=vb.width/rect.width, syp=vb.height/rect.height; return { x: vb.x+(e.clientX-rect.left)*sxp, y: vb.y+(e.clientY-rect.top)*syp }; }");
    lines.push("var raf=0, redrawing=false, redrawQueued=false;");
    lines.push("function runRedraw(){ if(redrawing){ redrawQueued=true; return; } redrawing=true; do { redrawQueued=false; redraw(); } while(redrawQueued); redrawing=false; }");
    lines.push("function schedule(immediate){ if(immediate){ if(raf){ cancelAnimationFrame(raf); raf=0; } runRedraw(); return; } if(raf) return; raf=requestAnimationFrame(function(){ raf=0; runRedraw(); }); }");
    lines.push("function redraw(){");
    lines.push("  sx = clampSxValue(sx); sy = clampSyValue(sy);");
    lines.push("  var state = computeLayoutState(layoutMode, W, H, COLS, ROWS, sx, sy, UNIT);");
    lines.push("  var leftWidth = state.leftWidth, rightWidth = state.rightWidth, topHeight = state.topHeight, bottomHeight = state.bottomHeight;");
    lines.push("  var wL = state.leftCols, wR = state.rightCols, hB = state.bottomRows, hT = state.topRows;");
    lines.push("  set(rTL,'x',ML); set(rTL,'y',MT); set(rTL,'width',leftWidth); set(rTL,'height',topHeight);");
    lines.push("  set(rTR,'x',ML+leftWidth); set(rTR,'y',MT); set(rTR,'width',rightWidth); set(rTR,'height',topHeight);");
    lines.push("  set(rBL,'x',ML); set(rBL,'y',MT+topHeight); set(rBL,'width',leftWidth); set(rBL,'height',bottomHeight);");
    lines.push("  set(rBR,'x',ML+leftWidth); set(rBR,'y',MT+topHeight); set(rBR,'width',rightWidth); set(rBR,'height',bottomHeight);");
    lines.push("  setDisplay(rTL, state.showTopLeft);");
    lines.push("  setDisplay(rTR, state.showTopRight);");
    lines.push("  setDisplay(rBL, state.showBottomLeft);");
    lines.push("  setDisplay(rBR, state.showBottomRight);");
    lines.push("  var showVSplit = showLengthAxis && leftWidth > 0 && rightWidth > 0;");
    lines.push("  var showHSplit = showHeightAxis && topHeight > 0 && bottomHeight > 0;");
    lines.push("  if(vLine){ setDisplay(vLine, showVSplit); if(showVSplit){ set(vLine,'x1',ML+leftWidth); set(vLine,'y1',MT); set(vLine,'x2',ML+leftWidth); set(vLine,'y2',MT+H); } }");
    lines.push("  if(hLine){ setDisplay(hLine, showHSplit); if(showHSplit){ set(hLine,'x1',ML); set(hLine,'y1',MT+topHeight); set(hLine,'x2',ML+W); set(hLine,'y2',MT+topHeight); } }");
    lines.push("  var hLeftCX=ML, hLeftCY=MT+topHeight, hDownCX=ML+leftWidth, hDownCY=MT+H;");
    lines.push("  var handleLeftVisible = showHeightAxis && topHeight > 0 && bottomHeight > 0;");
    lines.push("  var handleDownVisible = showLengthAxis && leftWidth > 0 && rightWidth > 0;");
    lines.push("  if(hLeft){ set(hLeft,'x',hLeftCX-HS/2); set(hLeft,'y',hLeftCY-HS/2); setDisplay(hLeft, handleLeftVisible); }");
    lines.push("  if(hDown){ set(hDown,'x',hDownCX-HS/2); set(hDown,'y',hDownCY-HS/2); setDisplay(hDown, handleDownVisible); }");
    lines.push("  if(hitLeft){ set(hitLeft,'cx',hLeftCX); set(hitLeft,'cy',hLeftCY); setDisplay(hitLeft, handleLeftVisible); }");
    lines.push("  if(hitDown){ set(hitDown,'cx',hDownCX); set(hitDown,'cy',hDownCY); setDisplay(hitDown, handleDownVisible); }");
    lines.push("  if(hotLeft){ set(hotLeft,'x',ML-HOT_ZONE_X); set(hotLeft,'y',MT); set(hotLeft,'height',H); setDisplay(hotLeft, handleLeftVisible); }");
    lines.push("  if(hotBottom){ set(hotBottom,'x',ML); set(hotBottom,'y',MT+H); set(hotBottom,'width',W); setDisplay(hotBottom, handleDownVisible); }");
    lines.push("  var leftOutsideX = ML-(HS/2)-GAPX;");
    lines.push("  var bottomOutsideY = MT+H+(HS/2)+GAPY;");
    lines.push("  var colLeft = makeAxisPart(wL, VAR1);");
    lines.push("  var colRight = makeAxisPart(wR, VAR2);");
    lines.push("  var rowBottom = makeAxisPart(hB, VAR1);");
    lines.push("  var rowTop = makeAxisPart(hT, VAR2);");
    lines.push("  var showTLText = state.showTopLeft && wL > 0 && hT > 0;");
    lines.push("  var showTRText = state.showTopRight && wR > 0 && hT > 0;");
    lines.push("  var showBLText = state.showBottomLeft && wL > 0 && hB > 0;");
    lines.push("  var showBRText = state.showBottomRight && wR > 0 && hB > 0;");
    lines.push("  var horizontalSumLabel = SHOW_SUM ? buildSumLabel(colLeft, colRight) : '';");
    lines.push("  var verticalSumLabel = SHOW_SUM ? buildSumLabel(rowBottom, rowTop) : '';");
    lines.push("  if(tTL){ setDisplay(tTL, showTLText); if(showTLText){ set(tTL,'x',ML+leftWidth/2); set(tTL,'y',MT+topHeight/2+8); tTL.textContent = formatCellLabel(colLeft, rowTop); } else { tTL.textContent=''; } }");
    lines.push("  if(tTR){ setDisplay(tTR, showTRText); if(showTRText){ set(tTR,'x',ML+leftWidth+rightWidth/2); set(tTR,'y',MT+topHeight/2+8); tTR.textContent = formatCellLabel(colRight, rowTop); } else { tTR.textContent=''; } }");
    lines.push("  if(tBL){ setDisplay(tBL, showBLText); if(showBLText){ set(tBL,'x',ML+leftWidth/2); set(tBL,'y',MT+topHeight+bottomHeight/2+8); tBL.textContent = formatCellLabel(colLeft, rowBottom); } else { tBL.textContent=''; } }");
    lines.push("  if(tBR){ setDisplay(tBR, showBRText); if(showBRText){ set(tBR,'x',ML+leftWidth+rightWidth/2); set(tBR,'y',MT+topHeight+bottomHeight/2+8); tBR.textContent = formatCellLabel(colRight, rowBottom); } else { tBR.textContent=''; } }");
    lines.push("  var edgeCounts = EDGE_MODE === 'counts';");
    lines.push("  if(leftTop){ set(leftTop,'x',leftOutsideX); set(leftTop,'y',MT+topHeight/2+10); leftTop.textContent = (!SHOW_SUM && edgeCounts) ? (rowTop.display || '') : ''; }");
    lines.push("  if(leftBot){ set(leftBot,'x',leftOutsideX); set(leftBot,'y',MT+topHeight+bottomHeight/2+10); leftBot.textContent = (!SHOW_SUM && edgeCounts) ? (rowBottom.display || '') : ''; }");
    lines.push("  if(botLeft){ set(botLeft,'x',ML+leftWidth/2); set(botLeft,'y',bottomOutsideY); botLeft.textContent = (!SHOW_SUM && edgeCounts) ? (colLeft.display || '') : ''; }");
    lines.push("  if(botRight){ set(botRight,'x',ML+leftWidth+rightWidth/2); set(botRight,'y',bottomOutsideY); botRight.textContent = (!SHOW_SUM && edgeCounts) ? (colRight.display || '') : ''; }");
    lines.push("  if(sumTopGroup && sumTopBrace && sumTopText){ if(SHOW_SUM && horizontalSumLabel){ var braceHeight=Math.max(16, Math.min(32, Math.round(W*0.06))); var braceGap=24; var braceY=MT - braceGap - braceHeight; set(sumTopBrace,'x',ML); set(sumTopBrace,'y',braceY); set(sumTopBrace,'width',W); set(sumTopBrace,'height',braceHeight); set(sumTopText,'x',ML+W/2); set(sumTopText,'y',braceY-8); sumTopText.textContent = horizontalSumLabel; setDisplay(sumTopGroup,true); } else { if(sumTopText) sumTopText.textContent=''; setDisplay(sumTopGroup,false); }}");
    lines.push("  if(sumLeftGroup && sumLeftBrace && sumLeftText){ if(SHOW_SUM && verticalSumLabel){ var braceThickness=Math.max(16, Math.min(32, Math.round(H*0.06))); var braceGap=24; var braceX=ML - braceGap - braceThickness; var braceY=MT; var textX=braceX - braceThickness/2 - 12; var textY=MT + H/2; set(sumLeftBrace,'x',braceX); set(sumLeftBrace,'y',braceY); set(sumLeftBrace,'width',braceThickness); set(sumLeftBrace,'height',H); if(sumLeftBrace.removeAttribute) sumLeftBrace.removeAttribute('transform'); set(sumLeftText,'x',textX); set(sumLeftText,'y',textY); set(sumLeftText,'transform','rotate(-90 ' + textX + ' ' + textY + ')'); sumLeftText.textContent = verticalSumLabel; setDisplay(sumLeftGroup,true); } else { if(sumLeftText) sumLeftText.textContent=''; setDisplay(sumLeftGroup,false); }}");
    lines.push("  var okX = (wL === TEN || wR === TEN);");
    lines.push("  var okY = (hB === TEN || hT === TEN);");
    lines.push("  var on = okX && okY;");
    lines.push("  if(vLine){ vLine.setAttribute('class', SPLIT_C + (on ? ' ok' : '')); }");
    lines.push("  if(hLine){ hLine.setAttribute('class', SPLIT_C + (on ? ' ok' : '')); }");
    lines.push("  if(hLeft) root.append(hLeft);");
    lines.push("  if(hotLeft) root.append(hotLeft);");
    lines.push("  if(hitLeft) root.append(hitLeft);");
    lines.push("  if(hDown) root.append(hDown);");
    lines.push("  if(hotBottom) root.append(hotBottom);");
    lines.push("  if(hitDown) root.append(hitDown);");
    lines.push("}");
    lines.push("function fit(){ var availW=Math.max(100, window.innerWidth-(SAFE.left+SAFE.right)); var availH=Math.max(100, window.innerHeight-(SAFE.top+SAFE.bottom)); var s=Math.min(availW/vb.width, availH/vb.height); root.setAttribute('width', vb.width*s); root.setAttribute('height', vb.height*s); refreshRect(); }");
    lines.push("fit(); redraw(); window.addEventListener('resize', fit, {passive:true});");
    lines.push("var active={axis:null,id:null,captor:null}; var justDragged=false;");
    lines.push("function arm(){ justDragged=true; setTimeout(function(){ justDragged=false; },220); }");
    lines.push("function lock(){ document.documentElement.style.touchAction='none'; document.body.style.touchAction='none'; document.documentElement.style.overscrollBehavior='contain'; document.body.style.overscrollBehavior='contain'; document.documentElement.style.userSelect='none'; document.body.style.userSelect='none'; document.documentElement.style.webkitUserSelect='none'; document.body.style.webkitUserSelect='none'; }");
    lines.push("function unlock(){ document.documentElement.style.touchAction=''; document.body.style.touchAction=''; document.documentElement.style.overscrollBehavior=''; document.body.style.overscrollBehavior=''; document.documentElement.style.userSelect=''; document.body.style.userSelect=''; document.documentElement.style.webkitUserSelect=''; document.body.style.webkitUserSelect=''; }");
    lines.push("function onMove(e){ if(e.pointerId!==active.id) return; e.preventDefault(); var p=clientToSvg(e); if(active.axis==='v'){ var y=clampAxisY(p.y); var nextSy=clampSyValue((MT+H)-y); if(nextSy!==sy){ sy=nextSy; schedule(true); } } else if(active.axis==='h'){ var x=clampAxisX(p.x); var nextSx=clampSxValue(x-ML); if(nextSx!==sx){ sx=nextSx; schedule(true); } }}");
    lines.push("function onUp(e){ if(e.pointerId!==active.id) return; e.preventDefault(); if(active.axis==='v') sy=snap(sy); if(active.axis==='h') sx=snap(sx); if(active.captor&&active.captor.releasePointerCapture){ try{ active.captor.releasePointerCapture(e.pointerId); }catch(_){}} if(active.captor){ var cls=active.captor.getAttribute('class')||''; active.captor.setAttribute('class', cls.replace(/\bdragging\b/,'').trim()); } active.axis=null; active.id=null; active.captor=null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp); unlock(); arm(); schedule(true); }");
    lines.push("function start(axis,e){ active.axis=axis; active.id=e.pointerId; active.captor=e.currentTarget||e.target; if(active.captor&&active.captor.setPointerCapture){ try{ active.captor.setPointerCapture(e.pointerId); }catch(_){}} if(active.captor){ var cls=active.captor.getAttribute('class')||''; if(cls.indexOf('dragging')===-1){ active.captor.setAttribute('class',(cls+' dragging').trim()); }} lock(); window.addEventListener('pointermove', onMove, {passive:false}); window.addEventListener('pointerup', onUp, {passive:false}); window.addEventListener('pointercancel', onUp, {passive:false}); }");
    lines.push("if(hitLeft){ hitLeft.style.touchAction='none'; hitLeft.addEventListener('pointerdown', function(e){ e.preventDefault(); start('v',e); }, {passive:false}); }");
    lines.push("if(hotLeft){ hotLeft.style.touchAction='none'; hotLeft.addEventListener('pointerdown', function(e){ e.preventDefault(); start('v',e); }, {passive:false}); }");
    lines.push("if(hitDown){ hitDown.style.touchAction='none'; hitDown.addEventListener('pointerdown', function(e){ e.preventDefault(); start('h',e); }, {passive:false}); }");
    lines.push("if(hotBottom){ hotBottom.style.touchAction='none'; hotBottom.addEventListener('pointerdown', function(e){ e.preventDefault(); start('h',e); }, {passive:false}); }");
    if (clickHandler) {
      lines.push(clickHandler);
    }
    lines.push("})();");
    return lines.join("\n");
  }
  function buildInteractiveSvgString(o) {
    const svgNoScript = buildBaseSvgMarkup(o, true);
    const scriptText = buildRuntimeScriptText(o, "document.documentElement");
    return svgNoScript.replace("</svg>", "<script><![CDATA[\n" + scriptText + "\n]]>" + "</" + "script>\n</svg>");
  }

  // Selvstendig HTML med interaktiv SVG
  function buildInteractiveHtmlString(o) {
    let svgMarkup = buildBaseSvgMarkup(o, false).replace('<svg ', '<svg id="rootSvg" ');
    const scriptText = buildRuntimeScriptText(o, "document.getElementById('rootSvg')");
    const safeScript = "<script>" + scriptText.replace(/<\/script>/gi, "<\\/script>") + "</" + "script>";
    const resetCss = "html,body{margin:0;padding:0;height:100%;background:#fff;}" + "body{display:flex;align-items:center;justify-content:center;}";
    return ["<!DOCTYPE html>", "<html lang='no'><head><meta charset='utf-8'/>", "<meta name='viewport' content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no'/>", "<title>Arealmodell – interaktiv</title>", "<style>", resetCss, "</style>", "</head><body>", svgMarkup, safeScript, "</body></html>"].join("");
  }
}
function initFromHtml() {
  readConfigFromHtml();
  render();
}
function setSimpleConfig(o = {}) {
  ensureCfgDefaults();
  if (!CFG.SIMPLE.challenge || typeof CFG.SIMPLE.challenge !== "object") CFG.SIMPLE.challenge = {};
  if (o.height != null) CFG.SIMPLE.height.cells = Math.round(o.height);
  if (o.length != null) CFG.SIMPLE.length.cells = Math.round(o.length);
  if (o.heightStart != null) CFG.SIMPLE.height.handle = Math.round(o.heightStart);else if (o.heightHandle != null) CFG.SIMPLE.height.handle = Math.round(o.heightHandle);
  if (o.lengthStart != null) CFG.SIMPLE.length.handle = Math.round(o.lengthStart);else if (o.lengthHandle != null) CFG.SIMPLE.length.handle = Math.round(o.lengthHandle);
  if (o.showHeightHandle != null) CFG.SIMPLE.height.showHandle = !!o.showHeightHandle;
  if (o.showLengthHandle != null) CFG.SIMPLE.length.showHandle = !!o.showLengthHandle;
  if (!CFG.SIMPLE.totalHandle) CFG.SIMPLE.totalHandle = {};
  if (o.showTotalHandle != null) CFG.SIMPLE.totalHandle.show = !!o.showTotalHandle;
  if (o.totalHandleMaxCols != null) {
    const v = Math.round(parseFloat(o.totalHandleMaxCols));
    if (Number.isFinite(v) && v > 0) CFG.SIMPLE.totalHandle.maxCols = v;
  }
  if (o.totalHandleMaxRows != null) {
    const v = Math.round(parseFloat(o.totalHandleMaxRows));
    if (Number.isFinite(v) && v > 0) CFG.SIMPLE.totalHandle.maxRows = v;
  }
  if (o.totalHandle && typeof o.totalHandle === 'object') {
    const th = o.totalHandle;
    if (th.maxCols != null) {
      const v = Math.round(parseFloat(th.maxCols));
      if (Number.isFinite(v) && v > 0) CFG.SIMPLE.totalHandle.maxCols = v;
    }
    if (th.maxRows != null) {
      const v = Math.round(parseFloat(th.maxRows));
      if (Number.isFinite(v) && v > 0) CFG.SIMPLE.totalHandle.maxRows = v;
    }
  }
  if (o.challengeEnabled != null) CFG.SIMPLE.challenge.enabled = !!o.challengeEnabled;
  if (o.challengeArea != null) {
    const v = Math.round(parseFloat(o.challengeArea));
    if (Number.isFinite(v) && v > 0) CFG.SIMPLE.challenge.area = v;
  }
  if (o.challengeDedupeOrderless != null) CFG.SIMPLE.challenge.dedupeOrderless = !!o.challengeDedupeOrderless;
  if (o.challengeAutoExpandMax != null) CFG.SIMPLE.challenge.autoExpandMax = !!o.challengeAutoExpandMax;
  if (o.challenge && typeof o.challenge === 'object') {
    const ch = o.challenge;
    if (ch.enabled != null) CFG.SIMPLE.challenge.enabled = !!ch.enabled;
    if (ch.area != null) {
      const v = Math.round(parseFloat(ch.area));
      if (Number.isFinite(v) && v > 0) CFG.SIMPLE.challenge.area = v;
    }
    if (ch.dedupeOrderless != null) CFG.SIMPLE.challenge.dedupeOrderless = !!ch.dedupeOrderless;
    if (ch.autoExpandMax != null) CFG.SIMPLE.challenge.autoExpandMax = !!ch.autoExpandMax;
  }
  if (o.variable1 != null) CFG.SIMPLE.variable1 = sanitizeVariableName(o.variable1);
  if (o.variable2 != null) CFG.SIMPLE.variable2 = sanitizeVariableName(o.variable2);
  if (o.showSum != null) CFG.SIMPLE.showSum = !!o.showSum;
  if (o.layout != null) CFG.SIMPLE.layout = normalizeLayout(o.layout);else if (o.layoutMode != null) CFG.SIMPLE.layout = normalizeLayout(o.layoutMode);
  enforceQuadLayoutFill(CFG.SIMPLE.layout);
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (!el || v == null) return;
    const str = String(v);
    el.value = str;
    el.setAttribute('value', str);
  };
  const setChk = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!v;
  };
  const setSelect = (id, v) => {
    if (id === "layoutMode") {
      ensureLayoutSelectValue(v);
      return;
    }
    const el = document.getElementById(id);
    if (el && v != null) el.value = v;
  };
  setVal("length", CFG.SIMPLE.length.cells);
  setVal("lengthStart", CFG.SIMPLE.length.handle);
  setChk("showLengthHandle", CFG.SIMPLE.length.showHandle !== false);
  setVal("height", CFG.SIMPLE.height.cells);
  setVal("heightStart", CFG.SIMPLE.height.handle);
  setChk("showHeightHandle", CFG.SIMPLE.height.showHandle !== false);
  setVal("lengthMax", CFG.SIMPLE.totalHandle.maxCols);
  setVal("heightMax", CFG.SIMPLE.totalHandle.maxRows);
  setChk("showTotalHandle", !!(CFG.SIMPLE.totalHandle && CFG.SIMPLE.totalHandle.show));
  setChk("challengeEnabled", !!(CFG.SIMPLE.challenge && CFG.SIMPLE.challenge.enabled));
  setVal("challengeArea", CFG.SIMPLE.challenge && CFG.SIMPLE.challenge.area);
  setVal("variable1", CFG.SIMPLE.variable1 || '');
  setVal("variable2", CFG.SIMPLE.variable2 || '');
  setChk("showSum", CFG.SIMPLE.showSum === true);
  setSelect("layoutMode", CFG.SIMPLE.layout);
  syncChallengeState(CFG.SIMPLE.layout);
  if (typeof o.altText === 'string') {
    CFG.SIMPLE.altText = o.altText;
    CFG.SIMPLE.altTextSource = o.altText ? 'manual' : 'auto';
  }
  if (typeof o.altTextSource === 'string') {
    CFG.SIMPLE.altTextSource = o.altTextSource === 'manual' ? 'manual' : 'auto';
  }
  render();
}
window.setArealmodellBConfig = setSimpleConfig;
window.setArealmodellConfig = setSimpleConfig;
window.setArealmodellBetaConfig = setSimpleConfig;
function applyConfigToInputs() {
  var _simple$length, _simple$length2, _simple$length3, _simple$height, _simple$height2, _simple$height3;
  ensureCfgDefaults();
  const simple = CFG.SIMPLE || {};
  const adv = CFG.ADV || {};
  const normalizedLayout = normalizeLayout(simple.layout);
  if (currentLayoutMode !== normalizedLayout) {
    currentLayoutMode = normalizedLayout;
  }
  enforceQuadLayoutFill(normalizedLayout);
  layoutStateStore[currentLayoutMode] = snapshotSimpleState(simple);
  const setVal = (id, value) => {
    const el = document.getElementById(id);
    if (!el || value == null) return;
    const str = String(value);
    if (el.value !== str) {
      el.value = str;
    }
    if (el.getAttribute('value') !== str) {
      el.setAttribute('value', str);
    }
  };
  const setChk = (id, value) => {
    const el = document.getElementById(id);
    if (!el) return;
    const bool = !!value;
    if (el.checked !== bool) el.checked = bool;
  };
  const setSelect = (id, value) => {
    if (id === "layoutMode") {
      ensureLayoutSelectValue(value);
      return;
    }
    const el = document.getElementById(id);
    if (!el || value == null) return;
    const str = String(value);
    if (el.value !== str) el.value = str;
  };
  setVal('length', (_simple$length = simple.length) === null || _simple$length === void 0 ? void 0 : _simple$length.cells);
  setVal('lengthStart', (_simple$length2 = simple.length) === null || _simple$length2 === void 0 ? void 0 : _simple$length2.handle);
  setChk('showLengthHandle', ((_simple$length3 = simple.length) === null || _simple$length3 === void 0 ? void 0 : _simple$length3.showHandle) !== false);
  setVal('height', (_simple$height = simple.height) === null || _simple$height === void 0 ? void 0 : _simple$height.cells);
  setVal('heightStart', (_simple$height2 = simple.height) === null || _simple$height2 === void 0 ? void 0 : _simple$height2.handle);
  setChk('showHeightHandle', ((_simple$height3 = simple.height) === null || _simple$height3 === void 0 ? void 0 : _simple$height3.showHandle) !== false);
  setVal('lengthMax', simple.totalHandle !== null && simple.totalHandle !== void 0 ? simple.totalHandle.maxCols : undefined);
  setVal('heightMax', simple.totalHandle !== null && simple.totalHandle !== void 0 ? simple.totalHandle.maxRows : undefined);
  setChk('showTotalHandle', !!(simple.totalHandle && simple.totalHandle.show));
  const challenge = simple.challenge || {};
  setChk('challengeEnabled', !!challenge.enabled);
  setVal('challengeArea', challenge.area);
  setChk('grid', !!adv.grid);
  const advLabels = adv.labels || {};
  if (advLabels.cellMode && advLabels.cellMode !== "none") {
    lastVisibleCellMode = advLabels.cellMode;
  }
  setChk('splitLines', adv.splitLines !== false);
  setChk('showExpressions', ((advLabels.cellMode) || 'factors') !== 'none');
  setVal('variable1', simple.variable1 || '');
  setVal('variable2', simple.variable2 || '');
  setChk('showSum', simple.showSum === true);
  setSelect('layoutMode', normalizedLayout);
  updateLayoutUi();
}
function applyExamplesConfig() {
  ensureCfgDefaults();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyExamplesConfig, {
      once: true
    });
    return;
  }
  applyConfigToInputs();
  draw();
}
function render() {
  applyExamplesConfig();
}
window.addEventListener('load', () => {
  initAltTextManager();
  initFromHtml();
  document.querySelectorAll('.settings input, .settings select').forEach(el => {
    el.addEventListener('change', initFromHtml);
    el.addEventListener('input', initFromHtml);
  });
});
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener('message', event => {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    applyThemeToDocument();
    CFG.ADV.colors = resolveRectColors();
    render();
  });
  window.addEventListener('math-visuals:settings-changed', () => {
    applyThemeToDocument();
    CFG.ADV.colors = resolveRectColors();
    render();
  });
}
if (typeof window !== 'undefined') {
  window.applyConfig = applyExamplesConfig;
  window.applyState = applyExamplesConfig;
  window.render = render;
  if (typeof window.createCleanState !== 'function') {
    window.createCleanState = createCleanState;
  }
  if (typeof window.loadCleanState !== 'function') {
    window.loadCleanState = loadCleanState;
  }
  const existingApi = window.arealmodellApi && typeof window.arealmodellApi === 'object'
    ? window.arealmodellApi
    : {};
  window.arealmodellApi = {
    ...existingApi,
    createCleanState: (...args) => createCleanState(...args),
    loadCleanState: (...args) => loadCleanState(...args)
  };
}
