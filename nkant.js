/* ==========================================================
   NKANT – ÉN SVG med 1–2 figurer
   • Sider: none | value | custom | custom+value
   • Vinkler/punkter: none | mark | mark+value | custom | custom+mark | custom+mark+value
   • Ved custom*: punktnavn vises utenfor langs vinkelhalveringen; vinkelverdi inne i sektoren
   ========================================================== */

/* ---------- DEFAULT SPECS (leses fra HTML) ---------- */
let DEFAULT_SPECS = "";

/* ---------- ADV (dine verdier) ---------- */
const ADV_CONFIG = {
  angle: {
    // radius = clamp(factor * min(|QP|,|QR|), [min,max])
    factor: 0.28,
    min: 18,
    max: 60,
    // Tekstplassering langs vinkelhalveringen:
    insideK: {
      right: 1.7,
      other: 1.7
    },
    // vinkelverdi (innsiden)
    outsideK: {
      right: 0.65,
      other: 0.65
    },
    // punktnavn (utsiden)
    outsidePad: 2,
    // Hindrer at punktnavn "flyr" for langt ut
    outsideMaxFactor: 0.90,
    // maks 90% av korteste naboside
    outsideMin: 6 // liten gulvavstand ut fra hjørnet
  },
  rightAngleMarker: {
    vertexScale: 0.68,
    vertexMin: 11,
    vertexMax: 24,
    heightScale: 0.38,
    heightMin: 11,
    heightMax: 18,
    heightMaxRatio: 0.65
  }
};

const INITIAL_SPEC_LINES = [
  "a=5, b=5, c=5, d=5, B=90",
  "Rettvinklet trekant"
];
const DEFAULT_GLOBAL_DEFAULTS = {
  sides: "value",
  angles: "custom+mark+value"
};
function createDefaultFigureState(index = 0, specText = "", defaults = DEFAULT_GLOBAL_DEFAULTS, colorSetIndex = DEFAULT_STATE.colorSetIndex) {
  const defaultSideMode = defaults && defaults.sides ? defaults.sides : DEFAULT_GLOBAL_DEFAULTS.sides;
  const defaultAngleMode = defaults && defaults.angles ? defaults.angles : DEFAULT_GLOBAL_DEFAULTS.angles;
  return {
    specText,
    colorSetIndex: sanitizeColorSetIndex(colorSetIndex),
    sides: {
      default: defaultSideMode,
      a: "inherit",
      b: "inherit",
      c: "inherit",
      d: "inherit",
      aText: "a",
      bText: "b",
      cText: "c",
      dText: "d"
    },
    angles: {
      default: defaultAngleMode,
      A: "inherit",
      B: "inherit",
      C: "inherit",
      D: "inherit",
      AText: "A",
      BText: "B",
      CText: "C",
      DText: "D"
    }
  };
}
/* ---------- STATE (UI) ---------- */
const STATE = {
  specsText: "",
  defaults: { ...DEFAULT_GLOBAL_DEFAULTS },
  textSize: "medium",
  rotateText: true,
  colorSetIndex: 1,
  figures: [],
  layout: "grid", // 2x2 matrise
  altText: "",
  altTextSource: "auto",
  labelAdjustments: {}
};
const DEFAULT_STATE = JSON.parse(JSON.stringify(STATE));

const TEXT_SIZE_PRESETS = {
  large: 24,
  medium: 20,
  small: 16
};
const LEGACY_TEXT_SIZE_ALIASES = {
  normal: "medium"
};
function sanitizeTextSize(value) {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (TEXT_SIZE_PRESETS[normalized]) return normalized;
    if (LEGACY_TEXT_SIZE_ALIASES[normalized]) return LEGACY_TEXT_SIZE_ALIASES[normalized];
    const numeric = Number.parseFloat(normalized);
    if (Number.isFinite(numeric)) {
      const match = Object.entries(TEXT_SIZE_PRESETS).find(([, size]) => Math.abs(size - numeric) < 1e-3);
      if (match) return match[0];
    }
  } else if (Number.isFinite(value)) {
    const match = Object.entries(TEXT_SIZE_PRESETS).find(([, size]) => Math.abs(size - value) < 1e-3);
    if (match) return match[0];
  }
  return "medium";
}

function getGlobalDefaults() {
  const fallback = DEFAULT_STATE && DEFAULT_STATE.defaults ? DEFAULT_STATE.defaults : DEFAULT_GLOBAL_DEFAULTS;
  const defaults = STATE && STATE.defaults ? STATE.defaults : null;
  return {
    sides: defaults && typeof defaults.sides === "string" && defaults.sides ? defaults.sides : fallback.sides,
    angles: defaults && typeof defaults.angles === "string" && defaults.angles ? defaults.angles : fallback.angles
  };
}

function shouldRotateText() {
  return STATE.rotateText !== false;
}

const NKANT_DEFAULT_SIMPLE_STATE = {
  sides: 8,
  showDiagonals: true,
  snapAngle: 15,
  radius: 160,
  altText: "",
  altTextSource: "auto"
};

const NKANT_FIVE_POINT_STAR_STATE = {
  sides: 5,
  showDiagonals: true,
  snapAngle: 18,
  radius: 150,
  altText: "",
  altTextSource: "auto"
};

function ensureStateDefaults() {
  const fill = (target, defaults) => {
    if (!defaults || typeof defaults !== "object") return;
    Object.keys(defaults).forEach(key => {
      const defVal = defaults[key];
      const curVal = target[key];
      if (defVal && typeof defVal === "object" && !Array.isArray(defVal)) {
        if (!curVal || typeof curVal !== "object") {
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
  fill(STATE, DEFAULT_STATE);
  const existingFigures = Array.isArray(STATE.figures) ? STATE.figures.slice(0, 4) : [];
  const baseSpecs = typeof STATE.specsText === "string" && STATE.specsText.trim()
    ? STATE.specsText.split(/\n+/).slice(0, 4)
    : INITIAL_SPEC_LINES.slice(0, 4);
  const fallbackDefaults = DEFAULT_STATE && DEFAULT_STATE.defaults ? DEFAULT_STATE.defaults : DEFAULT_GLOBAL_DEFAULTS;
  const deriveDefault = (value, figKey) => {
    if (value && typeof value === "string") return value;
    const firstFig = existingFigures[0];
    const figDefault = firstFig && firstFig[figKey] && typeof firstFig[figKey].default === "string"
      ? firstFig[figKey].default
      : "";
    if (figDefault) return figDefault;
    return figKey === "angles" ? fallbackDefaults.angles : fallbackDefaults.sides;
  };
  STATE.defaults = {
    sides: deriveDefault(STATE.defaults && STATE.defaults.sides, "sides"),
    angles: deriveDefault(STATE.defaults && STATE.defaults.angles, "angles")
  };
  const figures = (existingFigures.length ? existingFigures : baseSpecs).slice(0, 4);
  STATE.figures = figures.map((fig, idx) => {
    const base = createDefaultFigureState(
      idx,
      typeof fig === "string" ? fig : (fig && fig.specText) || baseSpecs[idx] || "",
      STATE.defaults,
      STATE.colorSetIndex
    );
    const target = fig && typeof fig === "object" && !Array.isArray(fig) ? { ...fig } : { specText: typeof fig === "string" ? fig : "" };
    fill(target, base);
    target.sides.default = STATE.defaults.sides;
    target.angles.default = STATE.defaults.angles;
    target.colorSetIndex = sanitizeColorSetIndex(target.colorSetIndex);
    return target;
  });
  STATE.specsText = STATE.figures.map(fig => fig && typeof fig.specText === "string" ? fig.specText : "").join("\n");
  STATE.textSize = sanitizeTextSize(STATE.textSize);
  STATE.colorSetIndex = sanitizeColorSetIndex(STATE.colorSetIndex);
  return STATE;
}
  function syncSpecsTextFromFigures() {
    if (!Array.isArray(STATE.figures)) return "";
    STATE.specsText = STATE.figures.map(fig => fig && typeof fig.specText === "string" ? fig.specText : "").join("\n");
    return STATE.specsText;
  }

  let renderQueue = null;
  function scheduleRender() {
    if (!renderQueue) {
      renderQueue = Promise.resolve().then(async () => {
        try {
          await renderCombined();
        } finally {
          renderQueue = null;
        }
      });
    }
    return renderQueue;
  }

  function updateState(mutator, options = {}) {
    const { render = true, onUpdate } = options;
    if (typeof mutator === "function") {
      mutator(STATE);
    } else if (mutator && typeof mutator === "object") {
      Object.assign(STATE, mutator);
    }
    ensureStateDefaults();
    if (typeof onUpdate === "function") {
      onUpdate();
    }
    if (render) {
      return scheduleRender();
    }
    return Promise.resolve();
  }
let altTextManager = null;
let lastRenderSummary = {
  layoutMode: STATE.layout || 'grid',
  count: 0,
  jobs: []
};
let applyFigureSpecsToUI = () => {};
let syncGlobalDefaultsToUI = () => {};
let baseTextScale = 1;
let currentTextScale = 1;
const textScaleStack = [];
let userTextScale = 1;
function pushTextScale(scale) {
  const prev = currentTextScale;
  const normalized = Number.isFinite(scale) && scale > 0 ? Math.min(Math.max(scale, 0.35), 3) : 1;
  const base = Number.isFinite(baseTextScale) && baseTextScale > 0 ? baseTextScale : 1;
  const next = normalized * base;
  textScaleStack.push(prev);
  currentTextScale = next;
  return () => {
    const restoreTo = textScaleStack.pop();
    currentTextScale = Number.isFinite(restoreTo) && restoreTo > 0 ? restoreTo : 1;
  };
}
function applyUserTextScaleToStyle() {
  STYLE.sideFS = STYLE_DEFAULTS.sideFS * userTextScale;
  STYLE.ptFS = STYLE_DEFAULTS.ptFS * userTextScale;
  STYLE.angFS = STYLE_DEFAULTS.angFS * userTextScale;
}
function applyTextSizePreference(size) {
  const key = sanitizeTextSize(size);
  const base = TEXT_SIZE_PRESETS.medium;
  const px = TEXT_SIZE_PRESETS[key] || base;
  const scale = base ? px / base : 1;
  userTextScale = scale;
  applyUserTextScaleToStyle();
  baseTextScale = 1;
  if (!textScaleStack.length) {
    currentTextScale = baseTextScale;
  }
  if (typeof document !== "undefined" && document.documentElement && document.documentElement.style) {
    document.documentElement.style.setProperty('--nkant-text-scale', String(scale));
  }
}
const LABEL_EDITOR_STATE = {
  enabled: false,
  selectedKey: null,
  drag: null
};

function getCurrentAppMode() {
  if (typeof document !== 'undefined' && document.body && document.body.dataset && document.body.dataset.appMode) {
    const mode = document.body.dataset.appMode;
    if (typeof mode === 'string' && mode.trim()) {
      return normalizeAppMode(mode);
    }
  }
  if (typeof window !== 'undefined' && window.mathVisuals && typeof window.mathVisuals.getAppMode === 'function') {
    try {
      const mode = window.mathVisuals.getAppMode();
      if (typeof mode === 'string' && mode.trim()) return normalizeAppMode(mode);
    } catch (_) {}
  }
  return 'default';
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

function syncBodyAppMode(mode) {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (!body || !body.dataset) return;
  const normalized = normalizeAppMode(mode);
  if (body.dataset.appMode !== normalized) {
    body.dataset.appMode = normalized;
  }
}

syncBodyAppMode(getCurrentAppMode() || 'default');

function isLabelEditingAllowed() {
  return getCurrentAppMode() !== 'task';
}
let renderedLabelMap = new Map();
let btnToggleLabelEdit = null;
let labelEditorSectionEl = null;
let labelEditorControlsEl = null;
let labelEditorActiveEl = null;
let labelEditorListEl = null;
let labelEditorRotationRowEl = null;
let labelRotationNumberInput = null;
let btnResetLabel = null;
let btnResetAllLabels = null;
let labelEditorSyncingRotation = false;
let rotateTextSelect = null;
let rotationHandleElements = null;
let rotationHandleDrag = null;
const nkantNumberFormatter = typeof Intl !== 'undefined' ? new Intl.NumberFormat('nb-NO', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
}) : null;
function nkantFormatNumber(value) {
  if (!Number.isFinite(value)) return String(value);
  if (nkantNumberFormatter) return nkantNumberFormatter.format(value);
  return String(Math.round(value * 100) / 100);
}
function nkantFormatList(items) {
  if (!Array.isArray(items) || items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} og ${items[1]}`;
  const head = items.slice(0, -1);
  const tail = items[items.length - 1];
  return `${head.join(', ')} og ${tail}`;
}
function cloneJobForSummary(job) {
  if (!job || typeof job !== 'object') return null;
  const cloneDimension = entry => {
    if (!entry || typeof entry !== 'object') return null;
    const label = typeof entry.label === 'string' ? entry.label : '';
    const value = Number.isFinite(entry.value) ? entry.value : null;
    const requested = Boolean(entry.requested);
    return {
      label,
      value,
      requested
    };
  };
  if (job.type === 'circle') {
    return {
      type: 'circle',
      radius: cloneDimension(job.obj && job.obj.radius),
      diameter: cloneDimension(job.obj && job.obj.diameter)
    };
  }
  if (job.type === 'polygon') {
    const summary = {
      type: 'polygon',
      sides: job.obj && Number.isFinite(job.obj.sides) ? Math.max(3, Math.round(job.obj.sides)) : null,
      side: cloneDimension(job.obj && job.obj.side)
    };
    const decorations = summarizeJobDecorations(job);
    if (decorations.length) summary.decorations = decorations;
    return summary;
  }
  if (job.type === 'polygonArc') {
    const base = job.obj && job.obj.polygon ? job.obj.polygon : null;
    return {
      type: 'polygonArc',
      polygon: base ? {
        sides: Number.isFinite(base.sides) ? Math.max(3, Math.round(base.sides)) : null,
        side: cloneDimension(base.side)
      } : null,
      side: typeof (job.obj && job.obj.side) === 'string' ? job.obj.side : '',
      radius: cloneDimension(job.obj && job.obj.radius),
      diameter: cloneDimension(job.obj && job.obj.diameter),
      decorations: summarizeJobDecorations(job)
    };
  }
  if (job.type === 'doubleTri') {
    const shared = job.obj && job.obj.shared ? job.obj.shared : null;
    const cloneValues = source => {
      const out = {};
      if (!source || typeof source !== 'object') return out;
      ['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].forEach(key => {
        const val = source[key];
        if (typeof val === 'number' && Number.isFinite(val)) {
          out[key] = val;
        }
      });
      return out;
    };
    const result = {
      type: 'doubleTri',
      shared: shared ? {
        label: typeof shared.label === 'string' ? shared.label : '',
        value: Number.isFinite(shared.value) ? shared.value : null,
        requested: Boolean(shared.requested)
      } : null,
      first: {
        values: cloneValues(job.obj && job.obj.first)
      },
      second: {
        values: cloneValues(job.obj && job.obj.second)
      }
    };
    const decorations = summarizeJobDecorations(job);
    if (decorations.length) result.decorations = decorations;
    if (job.angleMarks && typeof job.angleMarks === 'object') {
      result.angleMarks = { ...job.angleMarks };
    }
    return result;
  }
  const values = {};
  const source = job.obj && typeof job.obj === 'object' ? job.obj : {};
  ['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].forEach(key => {
    const val = source[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      values[key] = val;
    }
  });
  const decorations = summarizeJobDecorations(job);
  const result = {
    type: job.type === 'tri' ? 'tri' : 'quad',
    values
  };
  if (decorations.length) result.decorations = decorations;
  return result;
}
function summarizeJobDecorations(job) {
  if (!job || typeof job !== 'object' || !Array.isArray(job.decorations)) return [];
  const cloneDimension = entry => {
    if (!entry || typeof entry !== 'object') return null;
    const label = typeof entry.label === 'string' ? entry.label : '';
    const value = Number.isFinite(entry.value) ? entry.value : null;
    const requested = Boolean(entry.requested);
    return { label, value, requested };
  };
  const determineLetters = () => {
    if (job.type === 'tri') return ['A', 'B', 'C'];
    if (job.type === 'quad' || job.type === 'doubleTri') return ['A', 'B', 'C', 'D'];
    if (job.type === 'polygonArc') {
      const sides = job.obj && job.obj.polygon && Number.isFinite(job.obj.polygon.sides) ? Math.max(3, Math.round(job.obj.polygon.sides)) : null;
      if (Number.isFinite(sides)) {
        return Array.from({ length: sides }, (_, i) => indexToLetter(i, true));
      }
      return ['A', 'B', 'C', 'D'];
    }
    if (job.type === 'polygon') {
      const sides = job.obj && Number.isFinite(job.obj.sides) ? Math.max(3, Math.round(job.obj.sides)) : null;
      if (Number.isFinite(sides)) {
        return Array.from({ length: sides }, (_, i) => indexToLetter(i, true));
      }
      return ['A', 'B', 'C', 'D'];
    }
    return [];
  };
  const letters = determineLetters();
  if (!letters.length) return [];
  const seen = new Set();
  const out = [];
  job.decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object') return;
    if (dec.type === 'diagonal') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!letters.includes(from) || !letters.includes(to) || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `diag:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      out.push({
        type: 'diagonal',
        from: key[0],
        to: key[1]
      });
    } else if (dec.type === 'height') {
      const resolved = resolveHeightBase(dec, letters);
      if (!resolved) return;
      const tag = `height:${resolved.from}:${resolved.base}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      out.push({
        type: 'height',
        from: resolved.from,
        base: resolved.base,
        implied: Boolean(resolved.implied)
      });
    } else if (dec.type === 'semicircle') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!from || !to || from === to) return;
      if (letters.length && (!letters.includes(from) || !letters.includes(to))) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `semicircle:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      const entry = {
        type: 'semicircle',
        side: key
      };
      const radius = cloneDimension(dec.radius);
      const diameter = cloneDimension(dec.diameter);
      if (radius) entry.radius = radius;
      if (diameter) entry.diameter = diameter;
      out.push(entry);
    } else if (dec.type === 'square') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!letters.includes(from) || !letters.includes(to) || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `square:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      out.push({
        type: 'square',
        side: key
      });
    }
  });
  return out;
}
function buildAngleMarkSummary(entries) {
  if (!Array.isArray(entries)) return {};
  const out = {};
  entries.forEach(entry => {
    if (!entry || entry.length < 3) return;
    const [key, res, angleDeg] = entry;
    if (!key) return;
    const info = typeof res === 'object' && res ? res : null;
    const label = info && typeof info.pointLabel === 'string' && info.pointLabel.trim() ? info.pointLabel.trim() : key;
    out[key] = {
      marked: Boolean(info && info.mark),
      right: Boolean(info && info.mark) && Math.abs(angleDeg - 90) < 0.5,
      label
    };
  });
  return out;
}
function describeAngleMarks(angleMarks) {
  if (!angleMarks || typeof angleMarks !== 'object') return '';
  const marked = Object.values(angleMarks).filter(info => info && info.marked);
  if (!marked.length) return '';
  const rightAngles = marked.filter(info => info.right).map(info => info.label).filter(Boolean);
  const otherAngles = marked.filter(info => !info.right).map(info => info.label).filter(Boolean);
  const parts = [];
  if (rightAngles.length) {
    const list = nkantFormatList(rightAngles);
    if (rightAngles.length === 1) {
      parts.push(`Vinkel ${rightAngles[0]} er markert som rett vinkel.`);
    } else {
      parts.push(`Vinklene ${list} er markert som rette vinkler.`);
    }
  }
  if (otherAngles.length) {
    const list = nkantFormatList(otherAngles);
    if (otherAngles.length === 1) {
      parts.push(`Vinkel ${otherAngles[0]} er markert.`);
    } else {
      parts.push(`Vinklene ${list} er markert.`);
    }
  }
  return parts.join(' ');
}
function describeDecorationsSummary(decorations) {
  if (!Array.isArray(decorations) || !decorations.length) return '';
  const diagonals = [];
  const heights = [];
  const semicircles = [];
  const squares = [];
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object') return;
    if (dec.type === 'diagonal' && dec.from && dec.to) {
      diagonals.push(`${dec.from}${dec.to}`);
    } else if (dec.type === 'height' && dec.from && dec.base) {
      heights.push({
        from: dec.from,
        base: dec.base
      });
    } else if (dec.type === 'semicircle' && dec.side) {
      semicircles.push({
        side: dec.side,
        radius: dec.radius,
        diameter: dec.diameter
      });
    } else if (dec.type === 'square' && dec.side) {
      squares.push(dec.side);
    }
  });
  const parts = [];
  if (diagonals.length) {
    const list = nkantFormatList(diagonals);
    if (diagonals.length === 1) {
      parts.push(`Diagonal ${diagonals[0]} er tegnet som stiplet linje.`);
    } else {
      parts.push(`Diagonalene ${list} er tegnet som stiplede linjer.`);
    }
  }
  if (heights.length) {
    const phrases = heights.map(h => `fra ${h.from} til ${h.base}`);
    const list = nkantFormatList(phrases);
    if (heights.length === 1) {
      parts.push(`Høyden ${phrases[0]} er tegnet som stiplet linje.`);
    } else {
      parts.push(`Høydene ${list} er tegnet som stiplede linjer.`);
    }
  }
  if (semicircles.length) {
    const phrases = semicircles.map(info => {
      let base = `halvsirkel på side ${info.side}`;
      const dims = [];
      const radiusText = describeDimensionEntry(info.radius, 'radius');
      const diameterText = describeDimensionEntry(info.diameter, 'diameter');
      if (radiusText) dims.push(radiusText);
      if (diameterText) dims.push(diameterText);
      if (dims.length) {
        const dimList = nkantFormatList(dims);
        base += ` med ${dimList}`;
      }
      return base;
    });
    const list = nkantFormatList(phrases);
    if (phrases.length === 1) {
      parts.push(`Det er tegnet en ${phrases[0]}.`);
    } else {
      parts.push(`Det er tegnet ${list}.`);
    }
  }
  if (squares.length) {
    if (squares.length === 1) {
      parts.push(`Det er tegnet et kvadrat på side ${squares[0]}.`);
    } else {
      const list = nkantFormatList(squares.map(side => `side ${side}`));
      parts.push(`Det er tegnet kvadrater på ${list}.`);
    }
  }
  return parts.join(' ');
}
function describeDimensionEntry(entry, noun) {
  if (!entry || typeof entry !== 'object') return '';
  const label = typeof entry.label === 'string' ? entry.label.trim() : '';
  const numeric = Number.isFinite(entry.value) ? nkantFormatNumber(entry.value) : null;
  if (label && /^[-+]?\d+(?:[.,]\d+)?$/.test(label.replace(/,/g, '.'))) {
    return `${noun} ${label.replace('.', ',')}`;
  }
  if (label) {
    return `${noun} merket ${label}`;
  }
  if (numeric) {
    return `${noun} ${numeric}`;
  }
  return '';
}
function getNkantAltSummary() {
  const layoutMode = lastRenderSummary && typeof lastRenderSummary.layoutMode === 'string' ? lastRenderSummary.layoutMode : (STATE.layout || 'grid');
  const jobs = lastRenderSummary && Array.isArray(lastRenderSummary.jobs) ? lastRenderSummary.jobs : [];
  const count = lastRenderSummary && typeof lastRenderSummary.count === 'number' ? lastRenderSummary.count : jobs.length;
  return {
    layoutMode,
    count,
    jobs
  };
}
function buildNkantAltText(summary) {
  const data = summary || getNkantAltSummary();
  const count = data && typeof data.count === 'number' ? data.count : 0;
  if (!count) {
    return 'Ingen figurer.';
  }
  const sentences = [];
  sentences.push(`Figuren viser ${count === 1 ? 'én figur' : `${count} figurer`}.`);
  if (count > 1) {
    const placement = data.layoutMode === 'col' ? 'under hverandre' : data.layoutMode === 'grid' ? 'i rutenett' : 'ved siden av hverandre';
    sentences.push(`Figurene er plassert ${placement}.`);
  }
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  jobs.forEach((job, idx) => {
    if (!job) return;
    if (job.type === 'circle') {
      let sentence = `Figur ${idx + 1} er en sirkel.`;
      const radiusInfo = describeDimensionEntry(job.radius, 'Radius');
      if (radiusInfo) {
        sentence += ` ${radiusInfo}.`;
      }
      const diameterInfo = describeDimensionEntry(job.diameter, 'Diameter');
      if (job.diameter && diameterInfo) {
        sentence += ` ${diameterInfo}.`;
      }
      sentences.push(sentence.trim());
      return;
    }
    if (job.type === 'polygon') {
      const count = job.sides && Number.isFinite(job.sides) ? Math.max(3, Math.round(job.sides)) : 5;
      let sentence = `Figur ${idx + 1} er en mangekant med ${count} sider.`;
      const sideInfo = describeDimensionEntry(job.side, 'Side');
      if (sideInfo) {
        sentence += ` ${sideInfo}.`;
      }
      sentences.push(sentence.trim());
      return;
    }
    if (job.type === 'polygonArc') {
      const polygon = job.polygon || {};
      const count = polygon.sides && Number.isFinite(polygon.sides) ? Math.max(3, Math.round(polygon.sides)) : null;
      const sideLabel = typeof job.side === 'string' && job.side ? job.side : '';
      let sentence = `Figur ${idx + 1} er en mangekant${count ? ` med ${count} sider` : ''} med en halvsirkel på side${sideLabel ? ` ${sideLabel}` : ''}.`;
      const sideInfo = describeDimensionEntry(polygon.side, 'Side');
      if (sideInfo) {
        sentence += ` ${sideInfo}.`;
      }
      const radiusInfo = describeDimensionEntry(job.radius, 'Radius');
      if (radiusInfo) {
        sentence += ` ${radiusInfo}.`;
      }
      const diameterInfo = describeDimensionEntry(job.diameter, 'Diameter');
      if (job.diameter && diameterInfo) {
        sentence += ` ${diameterInfo}.`;
      }
      const decoSentence = describeDecorationsSummary(job.decorations);
      if (decoSentence) {
        sentence += ` ${decoSentence}`;
      }
      sentences.push(sentence.trim());
      return;
    }
    if (job.type === 'doubleTri') {
      const shared = job.shared || {};
      const sharedLabelRaw = shared && typeof shared.label === 'string' ? shared.label.trim() : '';
      const sharedLabel = sharedLabelRaw || 'AB';
      const sharedValue = shared && Number.isFinite(shared.value) ? nkantFormatNumber(shared.value) : null;
      let sentence = `Figur ${idx + 1} består av to trekanter som deler siden ${sharedLabel}.`;
      if (sharedValue) {
        sentence += ` Den delte siden ${sharedLabel} er ${sharedValue}.`;
      }
      const firstValues = job.first && job.first.values ? job.first.values : {};
      const secondValues = job.second && job.second.values ? job.second.values : {};
      const appendTriangleDescription = (values, label, angleKeys) => {
        const sideList = [];
        if (values.a != null && Number.isFinite(values.a)) sideList.push(`a=${nkantFormatNumber(values.a)}`);
        if (values.b != null && Number.isFinite(values.b)) sideList.push(`b=${nkantFormatNumber(values.b)}`);
        if (values.c != null && Number.isFinite(values.c)) sideList.push(`c=${nkantFormatNumber(values.c)}`);
        if (sideList.length) {
          sentence += ` Trekanten ${label} har sider ${nkantFormatList(sideList)}.`;
        } else {
          sentence += ` Trekanten ${label} er tegnet.`;
        }
        const angleList = angleKeys.map(key => {
          const val = values[key];
          if (val != null && Number.isFinite(val)) {
            return `${key}=${nkantFormatNumber(val)}°`;
          }
          return null;
        }).filter(Boolean);
        if (angleList.length) {
          sentence += ` Vinkler ${nkantFormatList(angleList)}.`;
        }
      };
      appendTriangleDescription(firstValues, 'ABC', ['A', 'B', 'C']);
      appendTriangleDescription(secondValues, 'ABD', ['A', 'B', 'D']);
      const markSentence = describeAngleMarks(job.angleMarks);
      if (markSentence) {
        sentence += ` ${markSentence}`;
      }
      const decoSentence = describeDecorationsSummary(job.decorations);
      if (decoSentence) {
        sentence += ` ${decoSentence}`;
      }
      sentences.push(sentence.trim());
      return;
    }
    const typeLabel = job.type === 'tri' ? 'trekant' : 'firkant';
    const sides = [];
    const angles = [];
    const values = job.values || {};
    ['a', 'b', 'c', 'd'].forEach(key => {
      if (values[key] != null && Number.isFinite(values[key])) {
        sides.push(`${key}=${nkantFormatNumber(values[key])}`);
      }
    });
    ['A', 'B', 'C', 'D'].forEach(key => {
      if (values[key] != null && Number.isFinite(values[key])) {
        angles.push(`${key}=${nkantFormatNumber(values[key])}°`);
      }
    });
    let sentence = `Figur ${idx + 1} er en ${typeLabel}`;
    if (sides.length) {
      sentence += ` med sider ${nkantFormatList(sides)}`;
    }
    sentence += '.';
    if (angles.length) {
      sentence += ` Vinkler ${nkantFormatList(angles)}.`;
    }
    const markSentence = describeAngleMarks(job.angleMarks);
    if (markSentence) {
      sentence += ` ${markSentence}`;
    }
    const decoSentence = describeDecorationsSummary(job.decorations);
    if (decoSentence) {
      sentence += ` ${decoSentence}`;
    }
    sentences.push(sentence.trim());
  });
  return sentences.join(' ');
}
function getNkantTitle() {
  const base = typeof document !== 'undefined' && document && document.title ? document.title : 'Nkant';
  const summary = getNkantAltSummary();
  const count = summary && typeof summary.count === 'number' ? summary.count : 0;
  if (!count) return base;
  const suffix = count === 1 ? '1 figur' : `${count} figurer`;
  return `${base} – ${suffix}`;
}
function getActiveNkantAltText() {
  const stored = typeof STATE.altText === 'string' ? STATE.altText.trim() : '';
  const source = STATE.altTextSource === 'manual' ? 'manual' : 'auto';
  if (source === 'manual' && stored) return stored;
  return stored || buildNkantAltText();
}
function maybeRefreshAltText(reason) {
  const summary = getNkantAltSummary();
  const signature = JSON.stringify(summary);
  if (altTextManager && typeof altTextManager.refresh === 'function') {
    altTextManager.refresh(reason || 'auto', signature);
  } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
    altTextManager.notifyFigureChange(signature);
  }
}
function initAltTextManager() {
  if (typeof window === 'undefined' || !window.MathVisAltText) return;
  const svg = document.getElementById('paper');
  const container = document.getElementById('exportCard');
  if (!svg || !container) return;
  altTextManager = window.MathVisAltText.create({
    svg,
    container,
    getTitle: getNkantTitle,
    getState: () => ({
      text: typeof STATE.altText === 'string' ? STATE.altText : '',
      source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
    }),
    setState: (text, source) => {
      STATE.altText = text;
      STATE.altTextSource = source === 'manual' ? 'manual' : 'auto';
    },
    generate: () => buildNkantAltText(),
    getSignature: () => JSON.stringify(getNkantAltSummary()),
    getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
    getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
  });
  if (altTextManager) {
    altTextManager.applyCurrent();
    maybeRefreshAltText('init');
  }
}

/* ---------- STIL ---------- */
/* =========================================================
   THEME & STYLE HANDLING (Refactored to match diagram.js)
   ========================================================= */

// Standardverdier (Fallback)
const STYLE_DEFAULTS = {
  faceFill: "#f5f7fa",
  edgeStroke: "#333",
  edgeWidth: 4,
  radiusStroke: null,
  angStroke: "#147a9c",
  angWidth: 4,
  angFill: "#147a9c22",
  textFill: "#111827",
  textHalo: null,
  textHaloW: 0,
  fontFamily: "system-ui, -apple-system, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  sideFS: 20,
  ptFS: 20,
  angFS: 20,
  constructionStroke: "#4b5563",
  constructionWidth: 3,
  constructionDash: "10 8"
};

const STYLE = { ...STYLE_DEFAULTS };
const NKANT_COLOR_SET_SIZE = 3;
const NKANT_COLOR_SET_COUNT = 3;
const NKANT_GROUP_PALETTE_SIZE = NKANT_COLOR_SET_SIZE * NKANT_COLOR_SET_COUNT;
const SETTINGS_FALLBACK_PALETTE = ["#1F4DE2", "#475569", "#ef4444", "#0ea5e9", "#10b981", "#f59e0b"];
const NKANT_FALLBACK_PALETTE = Array.from({ length: NKANT_GROUP_PALETTE_SIZE }, (_, idx) => {
  const fallback = SETTINGS_FALLBACK_PALETTE.length ? SETTINGS_FALLBACK_PALETTE : ["#111827"];
  return fallback[idx % fallback.length];
});

// Hjelpere for å finne API-er
function getThemeApi() {
  return (typeof window !== "undefined" && window.MathVisualsTheme) || null;
}
function getPaletteApi() {
  return (typeof window !== "undefined" && window.MathVisualsPalette) || null;
}
function getSettingsApi() {
  return (typeof window !== "undefined" && window.MathVisualsSettings) || null;
}

function getColorPickerModule() {
  const scope = typeof window !== "undefined" ? window : typeof globalThis !== "undefined" ? globalThis : null;
  if (scope && scope.MathVisualsColorPicker) {
    return scope.MathVisualsColorPicker;
  }
  if (typeof require === "function") {
    try {
      return require("./ui/colorpicker/index.js");
    } catch (_) {}
  }
  return null;
}

function getThemeColor(token, fallback) {
  const theme = getThemeApi();
  if (theme && typeof theme.getColor === 'function') {
    try {
      return theme.getColor(token, fallback);
    } catch (_) {}
  }
  return fallback;
}

const colorPickerModule = getColorPickerModule();
const nkantColorPickerInstances = new WeakMap();
let nkantPaletteCache = [];

function resolveNkantPalette() {
  const paletteApi = getPaletteApi();
  const settings = getSettingsApi();
  const theme = getThemeApi();
  const settingsData =
    settings && typeof settings.getSettings === 'function'
      ? settings.getSettings()
      : settings && typeof settings === 'object'
      ? settings
      : null;

  const request = {
    count: NKANT_GROUP_PALETTE_SIZE,
    settings: settingsData
  };

  let groupPalette = [];
  const resolveGroupPalette = resolver => {
    try {
      const res = resolver();
      return res && Array.isArray(res.colors) ? res.colors : (Array.isArray(res) ? res : []);
    } catch (_) {
      return [];
    }
  };

  if (paletteApi && typeof paletteApi.getGroupPalette === 'function') {
    groupPalette = resolveGroupPalette(() => paletteApi.getGroupPalette('nkant', request));
  }

  if ((!groupPalette || !groupPalette.length) && settings && typeof settings.getGroupPalette === 'function') {
    groupPalette = resolveGroupPalette(() => settings.getGroupPalette('nkant', request));
    if ((!groupPalette || !groupPalette.length) && settings.getGroupPalette.length >= 3) {
      groupPalette = resolveGroupPalette(() => settings.getGroupPalette('nkant', NKANT_GROUP_PALETTE_SIZE));
    }
  }

  if ((!groupPalette || !groupPalette.length) && theme && typeof theme.getGroupPalette === 'function') {
    groupPalette = resolveGroupPalette(() => theme.getGroupPalette('nkant', request));
    if ((!groupPalette || !groupPalette.length) && theme.getGroupPalette.length >= 3) {
      groupPalette = resolveGroupPalette(() => theme.getGroupPalette('nkant', NKANT_GROUP_PALETTE_SIZE));
    }
  }

  return ensurePalette(groupPalette, NKANT_GROUP_PALETTE_SIZE, NKANT_FALLBACK_PALETTE);
}

function getNkantPaletteColors(palette, colorSetIndex) {
  const colors = Array.isArray(palette) ? palette : resolveNkantPalette();
  const safeIndex = sanitizeColorSetIndex(colorSetIndex);
  const baseIndex = (safeIndex - 1) * NKANT_COLOR_SET_SIZE;
  return {
    colors,
    safeIndex,
    fillColor: colors[baseIndex] || STYLE_DEFAULTS.faceFill,
    lineColor: colors[baseIndex + 1] || STYLE_DEFAULTS.edgeStroke,
    angleColor: colors[baseIndex + 2] || STYLE_DEFAULTS.angStroke
  };
}

function applyNkantColorSetToStyle(colorSetIndex, palette) {
  const {
    fillColor,
    lineColor,
    angleColor
  } = getNkantPaletteColors(palette, colorSetIndex);
  const textColor = getThemeColor('ui.primary', STYLE_DEFAULTS.textFill);
  const constructionColor = getThemeColor('dots.default', STYLE_DEFAULTS.constructionStroke);

  Object.assign(STYLE, STYLE_DEFAULTS, {
    edgeStroke: lineColor,
    angStroke: angleColor,
    radiusStroke: angleColor,
    faceFill: fillColor,
    textFill: textColor,
    constructionStroke: constructionColor,
    angFill: withAlphaColor(angleColor, 0.25, 'rgba(0,0,0,0.1)')
  });
  applyUserTextScaleToStyle();
}

function applyNkantPaletteSelection(palette, options = {}) {
  const { render = true, colorSetIndex = STATE.colorSetIndex } = options;
  const finalPalette = Array.isArray(palette) ? palette : resolveNkantPalette();
  nkantPaletteCache = finalPalette.slice();
  const safeIndex = sanitizeColorSetIndex(colorSetIndex);
  STATE.colorSetIndex = safeIndex;
  applyNkantColorSetToStyle(safeIndex, finalPalette);

  if (render && typeof renderCombined === 'function') {
    if (typeof scheduleRender === 'function') {
      scheduleRender();
    } else {
      renderCombined();
    }
  }
}

function getFigureColorSetIndex(fig) {
  if (fig && Number.isFinite(fig.colorSetIndex)) {
    return sanitizeColorSetIndex(fig.colorSetIndex);
  }
  return sanitizeColorSetIndex(STATE.colorSetIndex);
}

function setTripleSwatchStyle(element, fillColor, lineColor, angleColor) {
  if (!element) return;
  element.style.setProperty('--swatch-color-1', fillColor);
  element.style.setProperty('--swatch-color-2', lineColor);
  element.style.setProperty('--swatch-color-3', angleColor);
}

function buildNkantColorSlots(colors) {
  const slots = [];
  for (let index = 0; index < NKANT_COLOR_SET_COUNT; index += 1) {
    const baseIndex = index * NKANT_COLOR_SET_SIZE;
    slots.push({
      value: index + 1,
      label: `Velg fargesett ${index + 1}`,
      fillColor: colors[baseIndex] || STYLE_DEFAULTS.faceFill,
      lineColor: colors[baseIndex + 1] || STYLE_DEFAULTS.edgeStroke,
      angleColor: colors[baseIndex + 2] || STYLE_DEFAULTS.angStroke
    });
  }
  return slots;
}

function renderNkantColorPicker(element, palette, getColorSetIndex, onSelect) {
  if (!element || !colorPickerModule || typeof colorPickerModule.createColorPicker !== 'function') return;
  const colors = Array.isArray(palette) ? palette : resolveNkantPalette();
  const slots = buildNkantColorSlots(colors);
  const renderStyle = ({ element: target, slot, isActive }) => {
    if (target.classList) {
      target.classList.add(isActive ? 'color-swatch--triple' : 'color-option-btn--triple');
    }
    setTripleSwatchStyle(target, slot.fillColor, slot.lineColor, slot.angleColor);
  };
  const onSelectValue = value => {
    const nextIndex = sanitizeColorSetIndex(value);
    if (typeof onSelect === 'function') {
      onSelect(nextIndex);
    }
  };
  const getActiveValue = () => {
    const currentIndex = typeof getColorSetIndex === 'function' ? getColorSetIndex() : STATE.colorSetIndex;
    return sanitizeColorSetIndex(currentIndex);
  };
  const existing = nkantColorPickerInstances.get(element);
  const layout = { columns: NKANT_COLOR_SET_COUNT, maxOptions: NKANT_COLOR_SET_COUNT };
  if (existing) {
    existing.update({ slots, renderStyle, onSelect: onSelectValue, getActiveValue, layout });
    return;
  }
  const instance = colorPickerModule.createColorPicker({
    element,
    slots,
    renderStyle,
    onSelect: onSelectValue,
    getActiveValue,
    layout
  });
  if (instance) {
    nkantColorPickerInstances.set(element, instance);
  }
}

// --- PATCH START: Manglende tema-funksjon ---

function refreshNkantTheme(options = {}) {
  const palette = resolveNkantPalette();
  applyNkantPaletteSelection(palette, { render: true });
  document.querySelectorAll('[data-nkant-color-picker]').forEach(element => {
    const figIndex = Number.parseInt(element.dataset.figureIndex, 10);
    const fig = Number.isFinite(figIndex) ? STATE.figures[figIndex] : null;
    const index = fig ? getFigureColorSetIndex(fig) : sanitizeColorSetIndex(element.dataset.colorSetIndex || STATE.colorSetIndex);
    element.dataset.colorSetIndex = String(index);
    const getColorSetIndex = () => (fig ? getFigureColorSetIndex(fig) : sanitizeColorSetIndex(STATE.colorSetIndex));
    const onSelect = nextIndex => {
      if (fig) {
        updateState(state => {
          if (state.figures[figIndex]) {
            state.figures[figIndex].colorSetIndex = nextIndex;
          }
          state.colorSetIndex = nextIndex;
        });
      } else {
        updateState(state => {
          state.colorSetIndex = nextIndex;
        });
      }
      element.dataset.colorSetIndex = String(nextIndex);
    };
    renderNkantColorPicker(element, palette, getColorSetIndex, onSelect);
  });
}

// Hjelpefunksjon for å unngå spamming av refresh
let themeRefreshTimer = null;
function scheduleThemeRefresh(delay = 50) {
  if (themeRefreshTimer) clearTimeout(themeRefreshTimer);
  themeRefreshTimer = setTimeout(() => {
    themeRefreshTimer = null;
    refreshNkantTheme();
  }, delay);
}
// --- PATCH SLUTT ---

  function setupNkantThemeSync() {
    const refresh = () => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => scheduleThemeRefresh());
      } else {
        setTimeout(() => scheduleThemeRefresh(), 50);
      }
    };

    if (typeof MutationObserver === 'function' && typeof document !== 'undefined' && document.documentElement) {
      const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === 'attributes') {
            refresh();
            break;
          }
        }
      });

      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme-profile']
      });
    }

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('math-visuals:settings-changed', refresh);
      window.addEventListener('math-visuals:profile-change', refresh);
      window.addEventListener('math-visuals:project-change', refresh);
      window.addEventListener('message', event => {
        const data = event && event.data;
        const type = typeof data === 'string' ? data : data && data.type;
        if (type === 'math-visuals:profile-change' || type === 'math-visuals:project-change') {
          refresh();
        }
      });
    }

    refresh();
  }


function sanitizeThemePaletteValue(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed || "";
}

function sanitizeColorSetIndex(value) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric < 1) return 1;
  return Math.min(numeric, NKANT_COLOR_SET_COUNT);
}

function remapLegacyColorSetIndex(value) {
  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric) || numeric < 1) return value;
  if (numeric <= NKANT_COLOR_SET_COUNT) return numeric;
  return ((numeric - 1) % NKANT_COLOR_SET_COUNT) + 1;
}

function ensurePalette(base, count, fallback) {
  const sanitizeList = values => {
    if (!Array.isArray(values)) return [];
    const result = [];
    for (const value of values) {
      const sanitized = sanitizeThemePaletteValue(value);
      if (sanitized) {
        result.push(sanitized);
      }
    }
    return result;
  };
  const basePalette = sanitizeList(base);
  const fallbackPalette = basePalette.length ? [] : sanitizeList(fallback);
  const source = basePalette.length ? basePalette : fallbackPalette;
  if (!source.length) {
    return [];
  }
  if (!Number.isFinite(count) || count <= 0) {
    return source.slice();
  }
  const size = Math.max(1, Math.trunc(count));
  const result = [];
  for (let index = 0; index < size; index += 1) {
    result.push(source[index % source.length]);
  }
  return result;
}

function withAlphaColor(color, alpha, fallback) {
  const normalized = typeof color === "string" ? color.trim() : "";
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    const hex = normalized.slice(1);
    const chunk = hex.length === 3
      ? hex.split("").map(c => parseInt(c + c, 16))
      : [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    if (chunk.every(v => Number.isFinite(v))) {
      return `rgba(${chunk[0]}, ${chunk[1]}, ${chunk[2]}, ${alpha})`;
    }
  }
  if (/^rgb\s*\(/i.test(normalized)) {
    const parts = normalized.replace(/rgba?\(|\)|\s+/gi, "").split(",").slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every(v => Number.isFinite(v))) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return fallback;
}

/* ---------- HJELPERE ---------- */
const deg = r => r * 180 / Math.PI;
const rad = d => d * Math.PI / 180;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const clampCos = x => clamp(x, -1, 1);
const fmt = n => (Math.round(n * 10) / 10).toString().replace(".", ",");
const specFmt = n => (Math.round(n * 10) / 10).toString();
const rand = (min, max) => min + Math.random() * (max - min);
function deepAssign(target, src) {
  if (!src) return;
  Object.entries(src).forEach(([k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  });
}
function add(parent, name, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, String(v)));
  parent.appendChild(el);
  return el;
}
const dist = (P, Q) => Math.hypot(P.x - Q.x, P.y - Q.y);
const mid = (P, Q) => ({
  x: (P.x + Q.x) / 2,
  y: (P.y + Q.y) / 2
});
function perpendicularFoot(P, U, V) {
  const dx = V.x - U.x;
  const dy = V.y - U.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return { x: U.x, y: U.y };
  const t = ((P.x - U.x) * dx + (P.y - U.y) * dy) / len2;
  return {
    x: U.x + t * dx,
    y: U.y + t * dy
  };
}
function polygonArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}
function polygonCentroid(pts) {
  let A = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i],
      q = pts[(i + 1) % pts.length];
    const c = p.x * q.y - q.x * p.y;
    A += c;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  }
  A = A / 2;
  if (Math.abs(A) < 1e-9) return mid(pts[0], pts[2] || pts[0]);
  return {
    x: cx / (6 * A),
    y: cy / (6 * A)
  };
}
function fitTransformToRect(pts, rectW, rectH, margin = 46) {
  const xs = pts.map(p => p.x),
    ys = pts.map(p => p.y);
  const minx = Math.min(...xs),
    maxx = Math.max(...xs);
  const miny = Math.min(...ys),
    maxy = Math.max(...ys);
  const cw = Math.max(1e-6, maxx - minx);
  const ch = Math.max(1e-6, maxy - miny);
  const k = Math.min((rectW - 2 * margin) / cw, (rectH - 2 * margin) / ch);
  const T = p => ({
    x: margin + k * (p.x - minx),
    y: rectH - margin - k * (p.y - miny)
  });
  return {
    T,
    k
  };
}
function angleAt(V, P, R) {
  const ux = P.x - V.x,
    uy = P.y - V.y,
    vx = R.x - V.x,
    vy = R.y - V.y;
  const du = Math.hypot(ux, uy) || 1,
    dv = Math.hypot(vx, vy) || 1;
  const c = clampCos((ux * vx + uy * vy) / (du * dv));
  return deg(Math.acos(c));
}
function unitVec(A, B) {
  const dx = B.x - A.x,
    dy = B.y - A.y,
    L = Math.hypot(dx, dy) || 1;
  return {
    x: dx / L,
    y: dy / L
  };
}
function addHaloText(parent, x, y, txt, fontSizePx, extraAttrs = {}) {
  const baseSize = typeof fontSizePx === "number" ? fontSizePx : Number(fontSizePx);
  const scale = Number.isFinite(currentTextScale) && currentTextScale > 0 ? currentTextScale : 1;
  const effectiveFontSize = Number.isFinite(baseSize) ? baseSize * scale : fontSizePx;
  const t = add(parent, "text", {
    x,
    y,
    fill: STYLE.textFill,
    "font-size": effectiveFontSize,
    "font-family": STYLE.fontFamily,
  });
  if (STYLE.textHalo && STYLE.textHaloW > 0) {
    t.setAttribute(
      "style",
      `paint-order:stroke fill;stroke:${STYLE.textHalo};stroke-width:${STYLE.textHaloW};stroke-linejoin:round;`
    );
  }
  Object.entries(extraAttrs).forEach(([k, v]) => t.setAttribute(k, String(v)));
  applyMathTextFormatting(t, txt);
  return t;
}

const MATH_UNITS = new Set([
  "cm", "mm", "dm", "m", "km", "mil",
  "g", "kg", "mg", "hg",
  "s", "ms", "min", "h",
  "l", "dl", "cl", "ml",
]);

function isVariableToken(token) {
  if (!token || typeof token !== "string") return false;
  const normalized = token
    .replace(/[₀-₉⁰-⁹]/g, "")
    .replace(/[′’']/g, "");
  if (!/^[A-Za-zÆØÅæøå]+$/.test(normalized)) return false;
  if (normalized.length > 3) return false;
  if (MATH_UNITS.has(normalized.toLowerCase())) return false;
  return true;
}

function applyMathTextFormatting(element, text) {
  if (!element) return;
  element.textContent = "";
  if (text === null || text === undefined) return;
  const str = String(text);
  const variableRe = /[A-Za-zÆØÅæøå][A-Za-zÆØÅæøå0-9₀-₉⁰-⁹′’']*/g;
  let lastIndex = 0;
  str.replace(variableRe, (match, offset) => {
    if (offset > lastIndex) {
      const plain = str.slice(lastIndex, offset);
      if (plain) element.appendChild(document.createTextNode(plain));
    }
    const italic = isVariableToken(match);
    if (italic) {
      const span = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      span.setAttribute("font-style", "italic");
      span.textContent = match;
      element.appendChild(span);
    } else {
      element.appendChild(document.createTextNode(match));
    }
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < str.length) {
    element.appendChild(document.createTextNode(str.slice(lastIndex)));
  }
}

function labelKey(labelCtx, type, id) {
  const prefix = labelCtx && typeof labelCtx.prefix === 'string' ? labelCtx.prefix : null;
  const typePart = type ? String(type) : '';
  const idPart = typeof id === 'string' || typeof id === 'number' ? id : '';
  if (!prefix) return null;
  return [prefix, typePart, idPart].filter(Boolean).join(':');
}

function resetRenderedLabelMap() {
  renderedLabelMap = new Map();
  LABEL_EDITOR_STATE.drag = null;
  rotationHandleDrag = null;
}

function getLabelAdjustment(key) {
  if (!key) return { dx: 0, dy: 0, rotation: 0 };
  const stored = STATE.labelAdjustments && STATE.labelAdjustments[key];
  if (!stored || typeof stored !== 'object') return { dx: 0, dy: 0, rotation: 0 };
  const parse = value => (Number.isFinite(value) ? value : 0);
  return {
    dx: parse(stored.dx),
    dy: parse(stored.dy),
    rotation: parse(stored.rotation)
  };
}

function getLabelFinalState(key) {
  if (!key) return null;
  const entry = renderedLabelMap.get(key);
  if (!entry) return null;
  const { baseX, baseY, baseRotation } = entry;
  const adjustment = getLabelAdjustment(key);
  const finalX = baseX + adjustment.dx;
  const finalY = baseY + adjustment.dy;
  const finalRotation = (baseRotation || 0) + adjustment.rotation;
  return { entry, adjustment, finalX, finalY, finalRotation };
}

function setLabelAdjustment(key, adjustment) {
  if (!key) return;
  const current = getLabelAdjustment(key);
  const next = {
    dx: Number.isFinite(adjustment.dx) ? adjustment.dx : current.dx,
    dy: Number.isFinite(adjustment.dy) ? adjustment.dy : current.dy,
    rotation: Number.isFinite(adjustment.rotation) ? adjustment.rotation : current.rotation
  };
  STATE.labelAdjustments = {
    ...STATE.labelAdjustments,
    [key]: next
  };
  applyLabelAdjustment(key);
}

function clearLabelAdjustment(key) {
  if (!key) return;
  if (STATE.labelAdjustments && Object.prototype.hasOwnProperty.call(STATE.labelAdjustments, key)) {
    const { [key]: _, ...rest } = STATE.labelAdjustments;
    STATE.labelAdjustments = rest;
  }
  applyLabelAdjustment(key);
}

function applyLabelAdjustment(key) {
  if (!key) return;
  const finalState = getLabelFinalState(key);
  if (!finalState) return;
  const { entry, adjustment, finalX, finalY, finalRotation } = finalState;
  const { element } = entry;
  element.setAttribute('x', finalX);
  element.setAttribute('y', finalY);
  if (finalRotation) {
    element.setAttribute('transform', `rotate(${finalRotation}, ${finalX}, ${finalY})`);
  } else {
    element.removeAttribute('transform');
  }
  if (LABEL_EDITOR_STATE.enabled) {
    element.classList.add('label-draggable');
    element.setAttribute('tabindex', '0');
    element.setAttribute('role', 'button');
  } else {
    element.classList.remove('label-draggable');
    element.classList.remove('label-selected');
    element.removeAttribute('tabindex');
    element.removeAttribute('role');
  }
  updateRotationHandle();
}

function registerRenderedLabel(key, element, baseX, baseY, baseRotation = 0) {
  if (!key) return;
  renderedLabelMap.set(key, {
    element,
    baseX,
    baseY,
    baseRotation: baseRotation || 0
  });
  element.dataset.labelKey = key;
  element.dataset.baseX = String(baseX);
  element.dataset.baseY = String(baseY);
  element.dataset.baseRotation = String(baseRotation || 0);
  if (!element.__labelEditorBound) {
    element.addEventListener('focus', () => {
      if (LABEL_EDITOR_STATE.enabled) {
        selectLabel(key);
      }
    });
    element.addEventListener('keydown', evt => handleLabelKeyDown(evt, key));
    element.__labelEditorBound = true;
  }
  applyLabelAdjustment(key);
}

function placeAdjustableLabel(parent, key, x, y, txt, fontSizePx, extraAttrs = {}, baseRotation = 0) {
  const attrs = { ...extraAttrs };
  if (key) attrs['data-label-key'] = key;
  const t = addHaloText(parent, x, y, txt, fontSizePx, attrs);
  registerRenderedLabel(key, t, x, y, baseRotation);
  return t;
}

/* ---------- LABEL EDITOR (UI) ---------- */
function getRenderedLabelEntry(key) {
  if (!key) return null;
  return renderedLabelMap.get(key) || null;
}

function updateLabelHighlights() {
  renderedLabelMap.forEach((entry, key) => {
    const isSelected = LABEL_EDITOR_STATE.enabled && key === LABEL_EDITOR_STATE.selectedKey;
    entry.element.classList.toggle('label-draggable', LABEL_EDITOR_STATE.enabled);
    entry.element.classList.toggle('label-selected', isSelected);
  });
}

function syncRotationInputs(value) {
  labelEditorSyncingRotation = true;
  if (labelRotationNumberInput) {
    labelRotationNumberInput.value = String(Math.round(Number.isFinite(value) ? value : 0));
  }
  labelEditorSyncingRotation = false;
}

function updateLabelEditorUI() {
  const labelEditingAllowed = isLabelEditingAllowed();
  if (btnToggleLabelEdit) {
    btnToggleLabelEdit.hidden = true;
  }
  if (labelEditorSectionEl) {
    labelEditorSectionEl.hidden = !labelEditingAllowed;
  }
  if (labelEditorControlsEl) {
    labelEditorControlsEl.hidden = !LABEL_EDITOR_STATE.enabled || !labelEditingAllowed;
  }
  const selectedEntry = LABEL_EDITOR_STATE.selectedKey ? getRenderedLabelEntry(LABEL_EDITOR_STATE.selectedKey) : null;
  const canEditSelected = LABEL_EDITOR_STATE.enabled && labelEditingAllowed && Boolean(selectedEntry);
  const activeLabelText = selectedEntry ? (selectedEntry.element.textContent || selectedEntry.element.getAttribute('aria-label') || 'Valgt etikett') : 'Ingen valgt';
  if (labelEditorActiveEl) {
    labelEditorActiveEl.textContent = activeLabelText.trim();
  }
  const rotation = canEditSelected ? getLabelAdjustment(LABEL_EDITOR_STATE.selectedKey).rotation : 0;
  if (labelEditorRotationRowEl) {
    labelEditorRotationRowEl.hidden = !canEditSelected;
  }
  if (labelRotationNumberInput) labelRotationNumberInput.disabled = !canEditSelected;
  if (labelEditorListEl) {
    labelEditorListEl.innerHTML = '';
    renderedLabelMap.forEach((entry, key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = (entry.element.textContent || entry.element.getAttribute('aria-label') || key).trim();
      option.selected = key === LABEL_EDITOR_STATE.selectedKey;
      labelEditorListEl.appendChild(option);
    });
    labelEditorListEl.disabled = !LABEL_EDITOR_STATE.enabled || !renderedLabelMap.size;
  }
  syncRotationInputs(rotation);
  updateLabelHighlights();
  updateRotationHandle();
}

function setLabelEditingEnabled(enabled) {
  const allowed = isLabelEditingAllowed();
  LABEL_EDITOR_STATE.enabled = Boolean(enabled) && allowed;
  LABEL_EDITOR_STATE.drag = null;
  rotationHandleDrag = null;
  renderedLabelMap.forEach((_, key) => applyLabelAdjustment(key));
  updateLabelEditorUI();
}

function syncLabelEditingAvailability() {
  const allowed = isLabelEditingAllowed();
  const shouldEnable = allowed;
  setLabelEditingEnabled(shouldEnable);
  if (!allowed) {
    selectLabel(null);
  }
}

function selectLabel(key) {
  if (!key || !renderedLabelMap.has(key)) {
    LABEL_EDITOR_STATE.selectedKey = null;
  } else {
    LABEL_EDITOR_STATE.selectedKey = key;
  }
  updateLabelEditorUI();
}

function resetSelectedLabelAdjustment() {
  if (!LABEL_EDITOR_STATE.selectedKey) return;
  clearLabelAdjustment(LABEL_EDITOR_STATE.selectedKey);
  selectLabel(LABEL_EDITOR_STATE.selectedKey);
}

function resetAllLabelAdjustments() {
  STATE.labelAdjustments = {};
  renderedLabelMap.forEach((_, key) => applyLabelAdjustment(key));
  selectLabel(null);
}

function resetAllLabelRotations() {
  rotationHandleDrag = null;
  const adjustments = STATE.labelAdjustments || {};
  const nextAdjustments = {};
  Object.entries(adjustments).forEach(([key, adjustment]) => {
    if (!adjustment || typeof adjustment !== 'object') return;
    const dx = Number.isFinite(adjustment.dx) ? adjustment.dx : undefined;
    const dy = Number.isFinite(adjustment.dy) ? adjustment.dy : undefined;
    if (dx !== undefined || dy !== undefined) {
      nextAdjustments[key] = {
        ...(dx !== undefined ? { dx } : {}),
        ...(dy !== undefined ? { dy } : {})
      };
    }
  });
  STATE.labelAdjustments = nextAdjustments;
  renderedLabelMap.forEach((_, key) => applyLabelAdjustment(key));
  selectLabel(null);
}

function pointerEventToSvgPoint(evt) {
  const svg = document.getElementById('paper');
  if (!svg || typeof svg.createSVGPoint !== 'function') return null;
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm || typeof ctm.inverse !== 'function') return null;
  const res = pt.matrixTransform(ctm.inverse());
  return { x: res.x, y: res.y };
}

function ensureRotationHandle(svg) {
  if (rotationHandleElements && rotationHandleElements.group && rotationHandleElements.group.ownerSVGElement) {
    return rotationHandleElements;
  }
  if (!svg) return null;
  const group = add(svg, 'g', { class: 'label-rotation-handle', 'data-ignore-export': 'true' });
  group.setAttribute('display', 'none');
  const line = add(group, 'line', {
    class: 'label-rotation-handle__line',
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0
  });
  const knob = add(group, 'circle', {
    class: 'label-rotation-handle__knob',
    r: 7,
    cx: 0,
    cy: 0
  });
  const hit = add(group, 'circle', {
    class: 'label-rotation-handle__hit',
    r: 16,
    cx: 0,
    cy: 0
  });
  hit.addEventListener('pointerdown', handleRotationHandlePointerDown);
  rotationHandleElements = { group, line, knob, hit };
  return rotationHandleElements;
}

function updateRotationHandle() {
  const svg = document.getElementById('paper');
  const handle = ensureRotationHandle(svg);
  if (!handle) return;
  const { group, line, knob, hit } = handle;
  if (group.parentNode && group.parentNode.lastChild !== group) {
    group.parentNode.appendChild(group);
  }
  const canShow = LABEL_EDITOR_STATE.enabled && LABEL_EDITOR_STATE.selectedKey;
  if (!canShow) {
    group.setAttribute('display', 'none');
    return;
  }
  const finalState = getLabelFinalState(LABEL_EDITOR_STATE.selectedKey);
  if (!finalState || !finalState.entry || !finalState.entry.element) {
    group.setAttribute('display', 'none');
    return;
  }
  const { entry, finalX, finalY, finalRotation } = finalState;
  const bbox = typeof entry.element.getBBox === 'function' ? entry.element.getBBox() : { width: 0, height: 0 };
  const gap = Math.max(bbox.height * 0.6, 18);
  const length = Math.max(bbox.height * 0.8, 22);
  const angleRad = (finalRotation - 90) * (Math.PI / 180);
  const startX = finalX + Math.cos(angleRad) * gap;
  const startY = finalY + Math.sin(angleRad) * gap;
  const endX = finalX + Math.cos(angleRad) * (gap + length);
  const endY = finalY + Math.sin(angleRad) * (gap + length);
  line.setAttribute('x1', startX);
  line.setAttribute('y1', startY);
  line.setAttribute('x2', endX);
  line.setAttribute('y2', endY);
  knob.setAttribute('cx', endX);
  knob.setAttribute('cy', endY);
  hit.setAttribute('cx', endX);
  hit.setAttribute('cy', endY);
  group.removeAttribute('display');
}

function handleRotationHandlePointerDown(evt) {
  if (!LABEL_EDITOR_STATE.enabled || !LABEL_EDITOR_STATE.selectedKey) return;
  const finalState = getLabelFinalState(LABEL_EDITOR_STATE.selectedKey);
  const pos = pointerEventToSvgPoint(evt);
  if (!finalState || !pos) return;
  const startAngle = Math.atan2(pos.y - finalState.finalY, pos.x - finalState.finalX) * (180 / Math.PI);
  rotationHandleDrag = {
    key: LABEL_EDITOR_STATE.selectedKey,
    pointerId: evt.pointerId,
    startAngle,
    startRotation: finalState.adjustment.rotation
  };
  selectLabel(LABEL_EDITOR_STATE.selectedKey);
  evt.preventDefault();
  if (evt.target && typeof evt.target.setPointerCapture === 'function') {
    evt.target.setPointerCapture(evt.pointerId);
  }
}

function handleRotationHandlePointerMove(evt) {
  const drag = rotationHandleDrag;
  if (!drag || drag.pointerId !== evt.pointerId) return;
  const finalState = getLabelFinalState(drag.key);
  const pos = pointerEventToSvgPoint(evt);
  if (!finalState || !pos) return;
  const angle = Math.atan2(pos.y - finalState.finalY, pos.x - finalState.finalX) * (180 / Math.PI);
  const delta = angle - drag.startAngle;
  const nextRotation = drag.startRotation + delta;
  setLabelAdjustment(drag.key, { rotation: nextRotation });
  syncRotationInputs(nextRotation);
}

function handleRotationHandlePointerUp(evt) {
  if (rotationHandleDrag && rotationHandleDrag.pointerId === evt.pointerId) {
    rotationHandleDrag = null;
  }
  if (evt.target && typeof evt.target.releasePointerCapture === 'function') {
    try {
      evt.target.releasePointerCapture(evt.pointerId);
    } catch (_) {
      /* ignore */
    }
  }
}

function handleLabelPointerDown(evt) {
  const isRotationHandle = evt.target && evt.target.closest ? evt.target.closest('.label-rotation-handle') : null;
  if (isRotationHandle) return;
  if (!LABEL_EDITOR_STATE.enabled) {
    if (LABEL_EDITOR_STATE.selectedKey) {
      selectLabel(null);
    }
    return;
  }
  const target = evt.target && evt.target.closest ? evt.target.closest('[data-label-key]') : null;
  if (!target) {
    if (LABEL_EDITOR_STATE.selectedKey) {
      selectLabel(null);
    }
    return;
  }
  const key = target.dataset.labelKey;
  const entry = getRenderedLabelEntry(key);
  if (!entry) return;
  const start = pointerEventToSvgPoint(evt);
  if (!start) return;
  evt.preventDefault();
  const adjustment = getLabelAdjustment(key);
  LABEL_EDITOR_STATE.drag = {
    key,
    pointerId: evt.pointerId,
    start,
    startDx: adjustment.dx,
    startDy: adjustment.dy
  };
  selectLabel(key);
  if (target.setPointerCapture) {
    target.setPointerCapture(evt.pointerId);
  }
}

function handleGlobalPointerDown(evt) {
  if (!LABEL_EDITOR_STATE.selectedKey) return;
  const target = evt.target;
  const closest = target && target.closest ? target.closest('.label-rotation-handle, [data-label-key], .label-editor') : null;
  if (closest) return;
  selectLabel(null);
}

function handleLabelPointerMove(evt) {
  const drag = LABEL_EDITOR_STATE.drag;
  if (!LABEL_EDITOR_STATE.enabled || !drag || drag.pointerId !== evt.pointerId) return;
  const pos = pointerEventToSvgPoint(evt);
  if (!pos) return;
  const dx = drag.startDx + (pos.x - drag.start.x);
  const dy = drag.startDy + (pos.y - drag.start.y);
  setLabelAdjustment(drag.key, { dx, dy });
  selectLabel(drag.key);
}

function handleLabelPointerUp(evt) {
  const drag = LABEL_EDITOR_STATE.drag;
  if (drag && drag.pointerId === evt.pointerId) {
    LABEL_EDITOR_STATE.drag = null;
  }
}

function getLabelKeyboardStep(evt) {
  if (evt.shiftKey) return 10;
  if (evt.altKey || evt.metaKey) return 0.5;
  return 1;
}

function handleLabelKeyDown(evt, key) {
  if (!LABEL_EDITOR_STATE.enabled || !key) return;
  if (key !== LABEL_EDITOR_STATE.selectedKey) {
    selectLabel(key);
  }
  const adjustment = getLabelAdjustment(key);
  let handled = false;
  const step = getLabelKeyboardStep(evt);
  if (evt.key === 'ArrowUp') {
    setLabelAdjustment(key, { dy: adjustment.dy - step });
    handled = true;
  } else if (evt.key === 'ArrowDown') {
    setLabelAdjustment(key, { dy: adjustment.dy + step });
    handled = true;
  } else if (evt.key === 'ArrowLeft') {
    setLabelAdjustment(key, { dx: adjustment.dx - step });
    handled = true;
  } else if (evt.key === 'ArrowRight') {
    setLabelAdjustment(key, { dx: adjustment.dx + step });
    handled = true;
  } else if (evt.key === '[' || evt.key === '-' || evt.key === '–') {
    const rotationStep = evt.shiftKey ? 10 : 2;
    setLabelAdjustment(key, { rotation: adjustment.rotation - rotationStep });
    handled = true;
  } else if (evt.key === ']' || evt.key === '+' || evt.key === '=') {
    const rotationStep = evt.shiftKey ? 10 : 2;
    setLabelAdjustment(key, { rotation: adjustment.rotation + rotationStep });
    handled = true;
  }
  if (handled) {
    evt.preventDefault();
    selectLabel(key);
  }
}

function initLabelEditorInteractions() {
  const svg = document.getElementById('paper');
  if (!svg || initLabelEditorInteractions.bound) return;
  ensureRotationHandle(svg);
  svg.addEventListener('pointerdown', handleLabelPointerDown);
  window.addEventListener('pointermove', handleLabelPointerMove);
  window.addEventListener('pointerup', handleLabelPointerUp);
  window.addEventListener('pointermove', handleRotationHandlePointerMove);
  window.addEventListener('pointerup', handleRotationHandlePointerUp);
  document.addEventListener('pointerdown', handleGlobalPointerDown, true);
  initLabelEditorInteractions.bound = true;
}

function syncLabelEditorAfterRender() {
  if (LABEL_EDITOR_STATE.selectedKey && !renderedLabelMap.has(LABEL_EDITOR_STATE.selectedKey)) {
    LABEL_EDITOR_STATE.selectedKey = null;
  }
  renderedLabelMap.forEach((_, key) => applyLabelAdjustment(key));
  updateLabelEditorUI();
}
function drawConstructionLine(g, P, Q) {
  add(g, "line", {
    x1: P.x,
    y1: P.y,
    x2: Q.x,
    y2: Q.y,
    stroke: STYLE.constructionStroke,
    "stroke-width": STYLE.constructionWidth,
    "stroke-linecap": "round",
    "stroke-dasharray": STYLE.constructionDash
  });
}
function drawRightAngleMarker(g, foot, baseDir, altDir) {
  const baseLen = Math.hypot(baseDir.x, baseDir.y) || 1;
  const altLen = Math.hypot(altDir.x, altDir.y) || 1;
  const size = rightAngleSizeFromSegments(baseLen, altLen);
  if (!(size > 0)) return;
  const b = {
    x: baseDir.x / baseLen,
    y: baseDir.y / baseLen
  };
  const a = {
    x: altDir.x / altLen,
    y: altDir.y / altLen
  };
  const p1 = {
    x: foot.x + b.x * size,
    y: foot.y + b.y * size
  };
  const p2 = {
    x: p1.x + a.x * size,
    y: p1.y + a.y * size
  };
  const p3 = {
    x: foot.x + a.x * size,
    y: foot.y + a.y * size
  };
  add(g, "polyline", {
    points: `${foot.x},${foot.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
    fill: "none",
    stroke: STYLE.constructionStroke,
    "stroke-width": STYLE.constructionWidth * 0.8,
    "stroke-linejoin": "round"
  });
}
function mapHeightSideToBase(side, letters) {
  if (!side) return null;
  const upperLetters = Array.isArray(letters) ? letters.map(l => String(l).toUpperCase()) : [];
  const set = new Set(upperLetters);
  const normalizedSide = String(side).toLowerCase();
  const has = vals => vals.every(v => set.has(v));
  if (has(['A', 'B', 'C']) && ['a', 'b', 'c'].includes(normalizedSide)) {
    if (normalizedSide === 'a') return 'BC';
    if (normalizedSide === 'b') return 'AC';
    if (normalizedSide === 'c') return 'AB';
  }
  if (has(['A', 'B', 'C', 'D']) && ['a', 'b', 'c', 'd'].includes(normalizedSide)) {
    if (normalizedSide === 'a') return 'AB';
    if (normalizedSide === 'b') return 'BC';
    if (normalizedSide === 'c') return 'CD';
    if (normalizedSide === 'd') return 'DA';
  }
  return null;
}
function resolveHeightBase(dec, availableLetters) {
  if (!dec || !dec.from) return null;
  const from = String(dec.from).toUpperCase();
  const letters = Array.isArray(availableLetters) ? availableLetters.map(l => String(l).toUpperCase()) : [];
  if (!letters.includes(from)) return null;
  let baseLetters = '';
  let explicit = false;
  if (dec.base) {
    const sanitized = String(dec.base).toUpperCase().replace(/[^A-D]/g, '');
    if (sanitized.length >= 2) {
      const first = sanitized[0];
      const second = sanitized[1];
      if (letters.includes(first) && letters.includes(second) && first !== second && first !== from && second !== from) {
        baseLetters = `${first}${second}`;
        explicit = true;
      }
    }
  }
  if (!baseLetters && dec.baseSide) {
    const mapped = mapHeightSideToBase(dec.baseSide, letters);
    if (mapped && mapped[0] !== from && mapped[1] !== from) {
      baseLetters = mapped;
      explicit = true;
    }
  }
  if (!baseLetters && letters.length === 3) {
    const others = letters.filter(l => l !== from);
    if (others.length >= 2) {
      baseLetters = `${others[0]}${others[1]}`;
    }
  }
  if (baseLetters.length !== 2) return null;
  return {
    from,
    base: baseLetters,
    implied: !explicit
  };
}
function collectHeightInfos(points, decorations) {
  if (!points || typeof points !== 'object') return [];
  if (!Array.isArray(decorations) || !decorations.length) return [];
  const letters = Object.keys(points);
  if (!letters.length) return [];
  const seen = new Set();
  const infos = [];
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object' || dec.type !== 'height') return;
    const resolved = resolveHeightBase(dec, letters);
    if (!resolved) return;
    const tag = `height:${resolved.from}:${resolved.base}`;
    if (seen.has(tag)) return;
    const from = resolved.from;
    const base = resolved.base;
    const vertex = points[from];
    const baseA = points[base[0]];
    const baseB = points[base[1]];
    if (!vertex || !baseA || !baseB) return;
    const foot = perpendicularFoot(vertex, baseA, baseB);
    if (!foot || Math.hypot(vertex.x - foot.x, vertex.y - foot.y) < 1e-6) return;
    infos.push({
      tag,
      from,
      base,
      vertex,
      basePoints: [baseA, baseB],
      foot
    });
    seen.add(tag);
  });
  return infos;
}
function centroidFromPointMap(points, order) {
  if (!points || typeof points !== 'object') return null;
  if (Array.isArray(order) && order.length >= 3) {
    const polygon = order.map(label => points[label]).filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
    if (polygon.length >= 3) {
      return polygonCentroid(polygon);
    }
  }
  const entries = Object.values(points).filter(p => p && typeof p.x === 'number' && typeof p.y === 'number');
  if (!entries.length) return null;
  let sumX = 0;
  let sumY = 0;
  entries.forEach(p => {
    sumX += p.x;
    sumY += p.y;
  });
  return {
    x: sumX / entries.length,
    y: sumY / entries.length
  };
}

function collectSemicircleExtentPoints(points, decorations, order) {
  if (!points || typeof points !== 'object') return [];
  if (!Array.isArray(decorations) || !decorations.length) return [];
  const centroid = centroidFromPointMap(points, order);
  if (!centroid) return [];
  const extras = [];
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object' || dec.type !== 'semicircle') return;
    const from = String(dec.from || '').toUpperCase();
    const to = String(dec.to || '').toUpperCase();
    const P = points[from];
    const Q = points[to];
    if (!P || !Q) return;
    const chordVec = {
      x: Q.x - P.x,
      y: Q.y - P.y
    };
    const chordLen = Math.hypot(chordVec.x, chordVec.y);
    if (!(chordLen > 1e-6)) return;
    const center = {
      x: (P.x + Q.x) / 2,
      y: (P.y + Q.y) / 2
    };
    let normal = {
      x: chordVec.y / chordLen,
      y: -chordVec.x / chordLen
    };
    const interiorSign = (Q.x - P.x) * (centroid.y - P.y) - (Q.y - P.y) * (centroid.x - P.x);
    if (interiorSign < 0) {
      normal.x *= -1;
      normal.y *= -1;
    }
    const arcRadius = chordLen / 2;
    extras.push({
      x: center.x + normal.x * arcRadius,
      y: center.y + normal.y * arcRadius
    });
  });
  return extras;
}
function collectSquareExtentPoints(points, decorations, order) {
  if (!points || typeof points !== 'object') return [];
  if (!Array.isArray(decorations) || !decorations.length) return [];
  const centroid = centroidFromPointMap(points, order);
  if (!centroid) return [];
  const extras = [];
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object' || dec.type !== 'square') return;
    const from = String(dec.from || '').toUpperCase();
    const to = String(dec.to || '').toUpperCase();
    const P = points[from];
    const Q = points[to];
    if (!P || !Q) return;
    const baseVec = {
      x: Q.x - P.x,
      y: Q.y - P.y
    };
    const baseLen = Math.hypot(baseVec.x, baseVec.y);
    if (!(baseLen > 1e-6)) return;
    let normal = {
      x: baseVec.y / baseLen,
      y: -baseVec.x / baseLen
    };
    const interiorSign = (Q.x - P.x) * (centroid.y - P.y) - (Q.y - P.y) * (centroid.x - P.x);
    if (interiorSign < 0) {
      normal.x *= -1;
      normal.y *= -1;
    }
    extras.push({
      x: Q.x + normal.x * baseLen,
      y: Q.y + normal.y * baseLen
    });
    extras.push({
      x: P.x + normal.x * baseLen,
      y: P.y + normal.y * baseLen
    });
  });
  return extras;
}
function renderDecorations(g, points, decorations, options = {}) {
  if (!Array.isArray(decorations) || !decorations.length) return;
  const letters = Object.keys(points);
  const seen = new Set();
  const skipHeights = options && options.skipHeights instanceof Set ? options.skipHeights : null;
  const pointOrder = options && Array.isArray(options.pointOrder) ? options.pointOrder : null;
  const baseCentroid = options && options.centroid ? options.centroid : centroidFromPointMap(points, pointOrder);
  const labelCtx = options && options.labelCtx;
  decorations.forEach(dec => {
    if (!dec || typeof dec !== 'object') return;
    if (dec.type === 'diagonal') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!points[from] || !points[to] || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `diag:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      drawConstructionLine(g, points[from], points[to]);
    } else if (dec.type === 'height') {
      const resolved = resolveHeightBase(dec, letters);
      if (!resolved) return;
      const from = resolved.from;
      const base = resolved.base;
      const A = base[0];
      const B = base[1];
      const P = points[from];
      const U = points[A];
      const V = points[B];
      if (!P || !U || !V) return;
      const tag = `height:${from}:${base}`;
      if (skipHeights && skipHeights.has(tag)) return;
      if (seen.has(tag)) return;
      seen.add(tag);
      const foot = perpendicularFoot(P, U, V);
      if (Math.hypot(P.x - foot.x, P.y - foot.y) < 1e-6) return;
      drawConstructionLine(g, P, foot);
      const baseDir = {
        x: V.x - U.x,
        y: V.y - U.y
      };
      const altDir = {
        x: P.x - foot.x,
        y: P.y - foot.y
      };
      if (Math.hypot(altDir.x, altDir.y) > 1e-6) {
        drawRightAngleMarker(g, foot, baseDir, altDir);
      }
    } else if (dec.type === 'semicircle') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!letters.includes(from) || !letters.includes(to) || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `semicircle:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      const P = points[from];
      const Q = points[to];
      if (!P || !Q) return;
      const chordVec = {
        x: Q.x - P.x,
        y: Q.y - P.y
      };
      const chordLen = Math.hypot(chordVec.x, chordVec.y);
      if (!(chordLen > 1e-6)) return;
      const center = {
        x: (P.x + Q.x) / 2,
        y: (P.y + Q.y) / 2
      };
      let normal = {
        x: chordVec.y / chordLen,
        y: -chordVec.x / chordLen
      };
      const reference = baseCentroid || center;
      const interiorSign = (Q.x - P.x) * (reference.y - P.y) - (Q.y - P.y) * (reference.x - P.x);
      if (interiorSign < 0) {
        normal.x *= -1;
        normal.y *= -1;
      }
      const arcRadius = chordLen / 2;
      const midArc = {
        x: center.x + normal.x * arcRadius,
        y: center.y + normal.y * arcRadius
      };
      const cross = (Q.x - P.x) * (midArc.y - P.y) - (Q.y - P.y) * (midArc.x - P.x);
      const sweep = cross < 0 ? 1 : 0;
      add(g, 'path', {
        d: `M ${P.x} ${P.y} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${Q.x} ${Q.y}`,
        fill: 'none',
        stroke: STYLE.edgeStroke,
        'stroke-width': STYLE.edgeWidth,
        'stroke-linecap': 'round'
      });
      const radiusEntry = dec.radius && typeof dec.radius === 'object' ? dec.radius : null;
      const diameterEntry = dec.diameter && typeof dec.diameter === 'object' ? dec.diameter : null;
      const showRadius = radiusEntry && radiusEntry.requested;
      if (showRadius) {
        add(g, 'line', {
          x1: center.x,
          y1: center.y,
          x2: midArc.x,
          y2: midArc.y,
          stroke: STYLE.edgeStroke,
          'stroke-width': STYLE.edgeWidth * 0.75,
          'stroke-linecap': 'round'
        });
        add(g, 'circle', {
          cx: center.x,
          cy: center.y,
          r: 6,
          fill: STYLE.edgeStroke
        });
      }
      const radiusText = showRadius ? normalizedDimensionText(radiusEntry, 'r') : '';
      if (showRadius && radiusText) {
        const labelPoint = {
          x: center.x + normal.x * arcRadius * 0.55,
          y: center.y + normal.y * arcRadius * 0.55
        };
        placeAdjustableLabel(g, labelKey(labelCtx, 'semicircle', `${key}-radius`), labelPoint.x, labelPoint.y, radiusText, STYLE.sideFS, {
          'text-anchor': 'middle',
          'dominant-baseline': 'middle'
        });
      }
      const diameterText = diameterEntry ? normalizedDimensionText(diameterEntry, 'd') : '';
      if (diameterEntry && diameterEntry.requested && diameterText) {
        const inward = {
          x: -normal.x,
          y: -normal.y
        };
        const diameterPoint = {
          x: center.x + inward.x * Math.min(arcRadius * 0.6, 40),
          y: center.y + inward.y * Math.min(arcRadius * 0.6, 40)
        };
        placeAdjustableLabel(g, labelKey(labelCtx, 'semicircle', `${key}-diameter`), diameterPoint.x, diameterPoint.y, diameterText, STYLE.sideFS, {
          'text-anchor': 'middle',
          'dominant-baseline': 'middle'
        });
      }
    } else if (dec.type === 'square') {
      const from = String(dec.from || '').toUpperCase();
      const to = String(dec.to || '').toUpperCase();
      if (!letters.includes(from) || !letters.includes(to) || from === to) return;
      const key = from < to ? `${from}${to}` : `${to}${from}`;
      const tag = `square:${key}`;
      if (seen.has(tag)) return;
      seen.add(tag);
      const P = points[from];
      const Q = points[to];
      if (!P || !Q) return;
      const baseVec = {
        x: Q.x - P.x,
        y: Q.y - P.y
      };
      const baseLen = Math.hypot(baseVec.x, baseVec.y);
      if (!(baseLen > 1e-6)) return;
      let normal = {
        x: baseVec.y / baseLen,
        y: -baseVec.x / baseLen
      };
      const reference = baseCentroid || {
        x: (P.x + Q.x) / 2,
        y: (P.y + Q.y) / 2
      };
      const interiorSign = (Q.x - P.x) * (reference.y - P.y) - (Q.y - P.y) * (reference.x - P.x);
      if (interiorSign < 0) {
        normal.x *= -1;
        normal.y *= -1;
      }
      const R = {
        x: Q.x + normal.x * baseLen,
        y: Q.y + normal.y * baseLen
      };
      const S = {
        x: P.x + normal.x * baseLen,
        y: P.y + normal.y * baseLen
      };
      add(g, 'polygon', {
        points: ptsTo([P, Q, R, S]),
        fill: 'none',
        stroke: STYLE.edgeStroke,
        'stroke-width': STYLE.edgeWidth,
        'stroke-linejoin': 'round'
      });
    }
  });
}

/* ---------- PARSE ---------- */
const SPEC_SIDE_MAP_TRI = {
  AB: 'c',
  BA: 'c',
  BC: 'a',
  CB: 'a',
  AC: 'b',
  CA: 'b'
};
const SPEC_SIDE_MAP_QUAD = {
  AB: 'a',
  BA: 'a',
  BC: 'b',
  CB: 'b',
  CD: 'c',
  DC: 'c',
  AD: 'd',
  DA: 'd'
};
const SPEC_SHAPE_HINT = Symbol('specShapeHint');
function setSpecShapeHint(target, info) {
  if (!target || typeof target !== 'object' || !info) return target;
  Object.defineProperty(target, SPEC_SHAPE_HINT, {
    value: info,
    enumerable: false,
    configurable: true,
    writable: true
  });
  return target;
}
function getSpecShapeHint(target) {
  return target && target[SPEC_SHAPE_HINT];
}
function cloneSpecWithHint(source) {
  if (!source || typeof source !== 'object') return {};
  const clone = { ...source };
  const hint = getSpecShapeHint(source);
  if (hint) setSpecShapeHint(clone, hint);
  return clone;
}
function detectShapeHintFromPrefix(str) {
  if (!str) return null;
  const match = str.match(/^\s*(trekant|triangel|firkant|rektangel|kvadrat)\b/i);
  if (!match) return null;
  const keyword = match[1];
  const lower = keyword.toLowerCase();
  const type = lower.startsWith('trek') || lower.startsWith('tria') ? 'tri' : 'quad';
  return {
    type,
    keyword,
    match: match[0]
  };
}
function normalizeSpecKey(rawKey, shapeHint) {
  if (!rawKey) return null;
  const letters = rawKey.replace(/[^A-Za-z]/g, '');
  if (!letters) return null;
  if (letters.length === 1) {
    const single = letters;
    if (/[abcd]/.test(single)) return single.toLowerCase();
    if (/[ABCD]/.test(single)) return single.toUpperCase();
    return single;
  }
  if (letters.length === 2) {
    const up = letters.toUpperCase();
    if (shapeHint === 'quad' && SPEC_SIDE_MAP_QUAD[up]) return SPEC_SIDE_MAP_QUAD[up];
    if (shapeHint === 'tri' && SPEC_SIDE_MAP_TRI[up]) return SPEC_SIDE_MAP_TRI[up];
    if (SPEC_SIDE_MAP_QUAD[up]) return SPEC_SIDE_MAP_QUAD[up];
    if (SPEC_SIDE_MAP_TRI[up]) return SPEC_SIDE_MAP_TRI[up];
    return null;
  }
  if (letters.length === 3) {
    const mid = letters[1].toUpperCase();
    if (/[ABCD]/.test(mid)) return mid;
  }
  return null;
}
function parseSpec(str) {
  const out = {};
  if (!str) return out;
  let shapeHint = null;
  const shapeInfo = detectShapeHintFromPrefix(str);
  if (shapeInfo) {
    shapeHint = shapeInfo.type;
    str = str.slice(shapeInfo.match.length);
    str = str.replace(/^[\s:=,-]+/, '');
  }
  str = str.replace(/\bog\b/gi, ',');
  const pairRegex = /([A-Za-z]{1,3})\s*=\s*([-+]?(?:\d+[.,]\d+|\d+|\.[0-9]+))(?:\s*(?:°|[a-zA-Z]+))?/g;
  let match;
  while (match = pairRegex.exec(str)) {
    const key = normalizeSpecKey(match[1].trim(), shapeHint);
    if (!key) continue;
    const rawValue = match[2];
    const value = parseFloat(rawValue.replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    out[key] = value;
  }
  if (shapeInfo && Object.keys(out).length > 0) {
    setSpecShapeHint(out, shapeInfo);
  }
  return out;
}

function reinterpretSquareFromRightAngles(obj) {
  if (!obj || typeof obj !== "object") return null;
  const approxRight = value => typeof value === "number" && isFinite(value) && Math.abs(value - 90) < 1e-3;
  const angleKeys = ["A", "B", "C", "D"].filter(key => approxRight(obj[key]));
  if (angleKeys.length < 3) return null;
  const sideKeys = ["a", "b", "c", "d"].filter(key => typeof obj[key] === "number" && isFinite(obj[key]) && obj[key] > 0);
  if (sideKeys.length > 1) {
    const firstVal = obj[sideKeys[0]];
    const consistent = sideKeys.every(key => Math.abs(obj[key] - firstVal) < 1e-3);
    if (!consistent) return null;
  }
  const sideValue = sideKeys.length ? obj[sideKeys[0]] : 3;
  if (!(typeof sideValue === "number" && isFinite(sideValue) && sideValue > 0)) return null;
  const square = {
    a: sideValue,
    b: sideValue,
    c: sideValue,
    d: sideValue,
    A: 90,
    B: 90,
    C: 90,
    D: 90
  };
  setSpecShapeHint(square, {
    type: 'quad',
    keyword: 'kvadrat'
  });
  return {
    obj: square,
    normalized: `kvadrat a=${specFmt(sideValue)}`
  };
}
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function parseLabeledSegments(str, entries) {
  const result = {};
  if (!str || !Array.isArray(entries) || entries.length === 0) return result;
  const keywords = entries.flatMap(entry => entry.keywords || []).filter(Boolean);
  if (keywords.length === 0) return result;
  const splitter = new RegExp(`(?=\\b(?:${keywords.map(escapeRegExp).join('|')})\\b)`, 'i');
  const keywordPattern = new RegExp(`^\\s*\\b(${keywords.map(escapeRegExp).join('|')})\\b`, 'i');
  const quoteTrim = str => {
    if (!str) return str;
    const first = str[0];
    const last = str[str.length - 1];
    if ((first === '"' && last === '"') || (first === '\'' && last === '\'') || (first === '(' && last === ')') || (first === '[' && last === ']')) {
      return str.slice(1, -1).trim();
    }
    return str;
  };
  const segments = str.split(splitter);
  segments.forEach(segment => {
    const match = segment.match(keywordPattern);
    if (!match) return;
    const keyword = match[1].toLowerCase();
    const entry = entries.find(item => Array.isArray(item.keywords) && item.keywords.some(k => k.toLowerCase() === keyword));
    if (!entry || result[entry.id]) return;
    let remainder = segment.slice(match[0].length);
    let hadSeparator = false;
    const sepMatch = remainder.match(/^\s*([:=])/);
    if (sepMatch) {
      hadSeparator = true;
      remainder = remainder.slice(sepMatch[0].length);
    }
    let label = quoteTrim(remainder.trim());
    label = label.replace(/[,;|]+$/g, '').replace(/\s{2,}/g, ' ').trim();
    if (!label) {
      if (hadSeparator) {
        label = '';
      } else {
        label = typeof entry.defaultLabel === 'string' ? entry.defaultLabel : '';
      }
    }
    const numericSource = label.replace(/,/g, '.');
    const numericMatch = numericSource.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/);
    const value = numericMatch ? parseFloat(numericMatch[0]) : null;
    result[entry.id] = {
      label,
      value: Number.isFinite(value) ? value : null,
      requested: true
    };
  });
  return result;
}
function normalizedDimensionText(entry, fallback) {
  if (!entry) {
    return typeof fallback === 'string' ? fallback : '';
  }
  const label = typeof entry.label === 'string' ? entry.label.trim() : '';
  if (label) return label;
  if (Number.isFinite(entry.value)) {
    return nkantFormatNumber(entry.value);
  }
  return typeof fallback === 'string' ? fallback : '';
}
function parseArcSideTokens(text) {
  if (!text) return [];
  const matches = String(text).toUpperCase().match(/[A-Z]+/g);
  if (!matches || !matches.length) return [];
  if (matches.length >= 2) {
    return matches.slice(0, 2);
  }
  const single = matches[0];
  if (single.length >= 2) {
    return [single.slice(0, 1), single.slice(1, 2)];
  }
  return [single];
}
function parseSpecFreeform(str) {
  const out = {};
  if (!str) return out;
  const prefixHint = detectShapeHintFromPrefix(str);

  // Håndter eksplisitte nøkkel/verdi-par før vi normaliserer teksten
  const pairRegex = /([abcdABCD])\s*=\s*([0-9]+(?:[.,][0-9]+)?)/g;
  let m;
  while (m = pairRegex.exec(str)) {
    out[m[1]] = parseFloat(m[2].replace(',', '.'));
  }
  if (Object.keys(out).length > 0) return out;
  let text = str.toLowerCase();
  const angMatch = text.match(/rett\s*vinkel\s*(?:i|ved)?\s*([abcd])/);
  if (angMatch) {
    const letter = angMatch[1].toUpperCase();
    out[letter] = 90;
    text = text.replace(angMatch[0], "");
  }
  let sidePart = text;
  const mSides = text.match(/(sider?|sidelengder?)\s+(.*)/);
  if (mSides) sidePart = mSides[2];
  const nums = [];
  sidePart.split(/[^0-9.,]+/).forEach(tok => {
    if (!tok) return;
    if (/^\d+[.,]\d+$/.test(tok)) {
      nums.push(parseFloat(tok.replace(',', '.')));
    } else {
      tok.split(/,+/).forEach(n => {
        if (n) nums.push(parseFloat(n));
      });
    }
  });
  if (/kvadrat/.test(text)) {
    var _nums$;
    const s = (_nums$ = nums[0]) !== null && _nums$ !== void 0 ? _nums$ : rand(1, 5);
    Object.assign(out, {
      a: s,
      b: s,
      c: s,
      d: s,
      B: 90
    });
    const keywordMatch = str.match(/kvadrat/i);
    setSpecShapeHint(out, prefixHint && prefixHint.type === 'quad' ? prefixHint : {
      type: 'quad',
      keyword: keywordMatch ? keywordMatch[0] : 'kvadrat'
    });
    return out;
  }
  if (/firkant/.test(text)) {
    if (nums.length >= 2) {
      const w = nums[0];
      const h = nums[1];
      Object.assign(out, {
        a: w,
        c: w,
        b: h,
        d: h,
        B: 90
      });
    } else {
      var _nums$2;
      const s = (_nums$2 = nums[0]) !== null && _nums$2 !== void 0 ? _nums$2 : rand(1, 5);
      Object.assign(out, {
        a: s,
        b: s,
        c: s,
        d: s,
        B: 90
      });
    }
    const keywordMatch = str.match(/firkant/i);
    setSpecShapeHint(out, prefixHint && prefixHint.type === 'quad' ? prefixHint : {
      type: 'quad',
      keyword: keywordMatch ? keywordMatch[0] : 'firkant'
    });
    return out;
  }
  if (/rektangel/.test(text)) {
    let w, h;
    if (nums.length >= 2) {
      [w, h] = nums;
    } else if (nums.length === 1) {
      w = nums[0];
      h = rand(1, 5);
      if (Math.abs(h - w) < 1e-6) h += 1;
    } else {
      w = rand(1, 5);
      h = rand(1, 5);
      if (Math.abs(h - w) < 1e-6) h += 1;
    }
    Object.assign(out, {
      a: w,
      c: w,
      b: h,
      d: h,
      B: 90
    });
    const keywordMatch = str.match(/rektangel/i);
    setSpecShapeHint(out, prefixHint && prefixHint.type === 'quad' ? prefixHint : {
      type: 'quad',
      keyword: keywordMatch ? keywordMatch[0] : 'rektangel'
    });
    return out;
  }
  if (/parallellogram/.test(text)) {
    var _nums$3, _nums$4, _nums$5;
    const w = (_nums$3 = nums[0]) !== null && _nums$3 !== void 0 ? _nums$3 : rand(1, 5);
    const h = (_nums$4 = nums[1]) !== null && _nums$4 !== void 0 ? _nums$4 : rand(1, 5);
    let B = (_nums$5 = nums[2]) !== null && _nums$5 !== void 0 ? _nums$5 : rand(60, 120);
    if (Math.abs(B - 90) < 1e-6) B = 60;
    Object.assign(out, {
      a: w,
      c: w,
      b: h,
      d: h,
      B
    });
    const keywordMatch = str.match(/parallellogram/i);
    setSpecShapeHint(out, prefixHint && prefixHint.type === 'quad' ? prefixHint : {
      type: 'quad',
      keyword: keywordMatch ? keywordMatch[0] : 'parallellogram'
    });
    return out;
  }
  if (/rombe/.test(text)) {
    var _nums$6, _nums$7;
    const s = (_nums$6 = nums[0]) !== null && _nums$6 !== void 0 ? _nums$6 : rand(1, 5);
    let B = (_nums$7 = nums[1]) !== null && _nums$7 !== void 0 ? _nums$7 : rand(60, 120);
    if (Math.abs(B - 90) < 1e-6) B = 60;
    Object.assign(out, {
      a: s,
      b: s,
      c: s,
      d: s,
      B
    });
    const keywordMatch = str.match(/rombe/i);
    setSpecShapeHint(out, prefixHint && prefixHint.type === 'quad' ? prefixHint : {
      type: 'quad',
      keyword: keywordMatch ? keywordMatch[0] : 'rombe'
    });
    return out;
  }
  if (/likesidet/.test(text) && /trekant/.test(text)) {
    var _nums$8;
    const s = (_nums$8 = nums[0]) !== null && _nums$8 !== void 0 ? _nums$8 : 1;
    Object.assign(out, {
      a: s,
      b: s,
      c: s
    });
    const keywordMatch = str.match(/(likesidet\s+trekant|trekant)/i);
    setSpecShapeHint(out, prefixHint && prefixHint.type === 'tri' ? prefixHint : {
      type: 'tri',
      keyword: keywordMatch ? keywordMatch[0] : 'trekant'
    });
    return out;
  }
  if (/likebeint/.test(text) && /trekant/.test(text)) {
    let s, base;
    if (nums.length >= 2) {
      s = nums[0];
      base = nums[1];
    } else if (nums.length === 1) {
      s = nums[0];
      base = Math.min(2 * s - 0.1, rand(1, 2 * s - 0.1));
    } else {
      s = rand(2, 6);
      base = rand(1, 2 * s - 0.5);
    }
    if (base >= 2 * s) base = 2 * s - 0.1;
    Object.assign(out, {
      a: s,
      b: s,
      c: base
    });
    return out;
  }
  if (/rettvinkle[dt]/.test(text) && /trekant/.test(text)) {
    const rightLetter = ["A", "B", "C"].find(L => out[L] === 90) || "C";
    const legKeys = rightLetter === "A" ? ["b", "c"] : rightLetter === "B" ? ["a", "c"] : ["a", "b"];
    if (nums.length === 2) {
      const [x, y] = nums;
      out[legKeys[0]] = x;
      out[legKeys[1]] = y;
      out[rightLetter] = 90;
      return out;
    }
    if (nums.length === 0) {
      const k = rand(1, 4);
      out[legKeys[0]] = 3 * k;
      out[legKeys[1]] = 4 * k;
      out[rightLetter] = 90;
      return out;
    }
    out[rightLetter] = 90;
  }
  if (/trekant/.test(text) && nums.length === 0) {
    const a = rand(2, 6);
    const b = rand(2, 6);
    const cMin = Math.abs(a - b) + 0.5;
    const cMax = a + b - 0.5;
    const c = rand(cMin, cMax);
    Object.assign(out, {
      a,
      b,
      c
    });
    return out;
  }
  if (nums.length >= 3) {
    const sides = nums.slice(0, 3);
    const assignRemaining = (letters, values) => {
      letters.forEach((L, i) => out[L] = values[i]);
    };
    if (out.A === 90 || out.B === 90 || out.C === 90) {
      const max = Math.max(...sides);
      const idx = sides.indexOf(max);
      const others = sides.slice(0, idx).concat(sides.slice(idx + 1));
      if (out.A === 90) {
        out.a = max;
        assignRemaining(["b", "c"], others);
      } else if (out.B === 90) {
        out.b = max;
        assignRemaining(["a", "c"], others);
      } else if (out.C === 90) {
        out.c = max;
        assignRemaining(["a", "b"], others);
      }
    } else {
      assignRemaining(["a", "b", "c"], sides);
    }
  }
  return out;
}
function parseCircleSpecLine(str) {
  if (!str || !/sirkel/i.test(str)) return null;
  if (/halvsirkel/i.test(str) || /halv\s*sirkel/i.test(str)) return null;
  const dims = parseLabeledSegments(str, [{
    id: 'radius',
    keywords: ['radius', 'rad'],
    defaultLabel: 'r'
  }, {
    id: 'diameter',
    keywords: ['diameter', 'diam'],
    defaultLabel: 'd'
  }]);
  const radiusEntry = dims.radius ? { ...dims.radius } : null;
  if (radiusEntry) {
    if (!radiusEntry.label) radiusEntry.label = 'r';
    radiusEntry.requested = true;
  }
  const diameterEntry = dims.diameter ? { ...dims.diameter, requested: true } : null;
  const job = {
    type: 'circle',
    obj: {
      radius: radiusEntry,
      diameter: diameterEntry
    }
  };
  return {
    job,
    normalized: str.trim()
  };
}
const NKANT_SPELLED_NUMBERS = {
  tre: 3,
  fire: 4,
  fem: 5,
  seks: 6,
  sek: 6,
  sju: 7,
  syv: 7,
  åtte: 8,
  otte: 8,
  ni: 9,
  ti: 10,
  elleve: 11,
  tolv: 12,
  tretten: 13,
  fjorten: 14,
  femten: 15,
  seksten: 16,
  sytten: 17,
  atten: 18,
  nitten: 19,
  tjue: 20
};
function detectPolygonSidesFromText(str) {
  if (!str) return null;
  const lower = str.toLowerCase();
  const numMatch = lower.match(/\b(\d+)(?:\s*|-)?kant(?:er)?\b/);
  if (numMatch) {
    const value = parseInt(numMatch[1], 10);
    if (Number.isFinite(value)) return Math.max(3, value);
  }
  const wordMatch = lower.match(/\b([a-zæøå]+)(?:\s*|-)?kant(?:er)?\b/);
  if (wordMatch) {
    const word = wordMatch[1].replace(/[^a-zæøå]/g, '');
    if (word) {
      const mapped = NKANT_SPELLED_NUMBERS[word];
      if (Number.isFinite(mapped)) return Math.max(3, mapped);
    }
  }
  return null;
}
function parsePolygonSpecLine(str) {
  if (!str) return null;
  const lower = str.toLowerCase();
  if (/\btrekant/i.test(lower) || /\btriangel/i.test(lower)) {
    return null;
  }
  const sidesFromWord = detectPolygonSidesFromText(str);
  const hasKeyword = /mangekant/i.test(str);
  if (!hasKeyword && sidesFromWord == null) return null;
  const dims = parseLabeledSegments(str, [{
    id: 'count',
    keywords: ['sider', 'antall sider', 'kanter'],
    defaultLabel: ''
  }, {
    id: 'side',
    keywords: ['side', 'kant', 'kantlengde', 'sidekant', 'lengde'],
    defaultLabel: 'a'
  }]);
  let sides = sidesFromWord != null ? sidesFromWord : 5;
  if (dims.count) {
    if (Number.isFinite(dims.count.value)) {
      sides = Math.max(3, Math.round(dims.count.value));
    } else {
      const parsed = parseInt(dims.count.label, 10);
      if (Number.isFinite(parsed)) sides = Math.max(3, parsed);
    }
  }
  const sideEntry = dims.side ? { ...dims.side } : {
    label: 'a',
    value: null,
    requested: false
  };
  if (!sideEntry.label) sideEntry.label = 'a';
  sideEntry.requested = Boolean(dims.side);
  const job = {
    type: 'polygon',
    obj: {
      sides,
      side: sideEntry
    }
  };
  const sideText = normalizedDimensionText(sideEntry, 'a');
  const normalized = sideText ? `mangekant sider: ${sides} side: ${sideText}` : `mangekant sider: ${sides}`;
  return {
    job,
    normalized
  };
}
function parsePolygonArcSpecLine(str) {
  if (!str || !/halvsirkel/i.test(str)) return null;
  const polygonBase = parsePolygonSpecLine(str);
  const polygonObj = polygonBase ? polygonBase.job && polygonBase.job.obj : null;
  const baseSides = polygonObj && Number.isFinite(polygonObj.sides) ? Math.max(3, Math.round(polygonObj.sides)) : 5;
  const baseSideEntry = polygonObj && polygonObj.side ? {
    ...polygonObj.side
  } : {
    label: 'a',
    value: null,
    requested: false
  };
  if (!baseSideEntry.label) baseSideEntry.label = 'a';
  const dims = parseLabeledSegments(str, [{
    id: 'radius',
    keywords: ['radius', 'rad'],
    defaultLabel: 'r'
  }, {
    id: 'diameter',
    keywords: ['diameter', 'diam'],
    defaultLabel: 'd'
  }]);
  const radiusEntry = dims.radius ? {
    ...dims.radius
  } : null;
  if (radiusEntry && !radiusEntry.label) radiusEntry.label = 'r';
  if (radiusEntry) radiusEntry.requested = true;
  const diameterEntry = dims.diameter ? {
    ...dims.diameter,
    requested: true
  } : null;
  const sideSegmentMatch = str.match(/halvsirkel\s+([A-Za-z]+(?:\s*[A-Za-z]+)?)/i);
  const sideSegment = sideSegmentMatch ? sideSegmentMatch[1] : '';
  const resolvedSide = normalizeArcSideSpecifier(sideSegment, baseSides);
  const job = {
    type: 'polygonArc',
    obj: {
      polygon: {
        sides: baseSides,
        side: baseSideEntry
      },
      side: resolvedSide.label,
      radius: radiusEntry,
      diameter: diameterEntry
    }
  };
  const normalizedParts = [`halvsirkel ${resolvedSide.label}`];
  const radiusText = radiusEntry && radiusEntry.requested ? normalizedDimensionText(radiusEntry, 'r') : '';
  if (radiusText) normalizedParts.push(`radius ${radiusText}`);
  if (diameterEntry) {
    const diameterText = normalizedDimensionText(diameterEntry, 'd');
    if (diameterText) normalizedParts.push(`diameter ${diameterText}`);
  }
  if (polygonBase && polygonBase.normalized) {
    normalizedParts.push(polygonBase.normalized);
  }
  return {
    job,
    normalized: normalizedParts.join('; '),
    allowDecorations: true
  };
}

function parseDoubleTriangleSpecLine(str) {
  if (!str) return null;
  const keywordPattern = /(dobbel\s*-?\s*trekant|double\s*-?\s*triangle)/i;
  if (!keywordPattern.test(str)) return null;
  if (!/trekant|triangle/i.test(str)) return null;
  let working = str.replace(keywordPattern, '').trim();
  if (!working) return null;
  const stripQuotes = value => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('\'') && trimmed.endsWith('\''))) {
      return trimmed.slice(1, -1).trim();
    }
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };
  let sharedLabel = '';
  let hadSharedLabel = false;
  const sharedPattern = /(felles|shared)?\s*side\s*(?:[:=])?\s*("[^"]+"|'[^']+'|\([^)]+\)|[A-Za-zÅÆØØåæø0-9]+)?/i;
  const sharedMatch = working.match(sharedPattern);
  if (sharedMatch) {
    const raw = stripQuotes(sharedMatch[2] || '');
    if (raw) {
      sharedLabel = raw;
      hadSharedLabel = true;
    }
    working = (working.slice(0, sharedMatch.index) + working.slice(sharedMatch.index + sharedMatch[0].length)).trim();
  }
  if (!working) return null;
  const cleanSegment = segment => {
    if (!segment) return '';
    let cleaned = segment.trim();
    cleaned = cleaned.replace(/^(?:øverste|øvre|nedre|første|andre|trekant\s*1|trekant\s*2|tri\s*1|tri\s*2|triangle\s*1|triangle\s*2|top|bottom|upper|lower|først|sist)\s*[:=-]?\s*/i, '');
    return cleaned.trim();
  };
  const separators = [/\s*\|\s*/, /\s*\/\s*/, /\s*\+\s*/, /\bog\b/i, /\s*;\s*/];
  let segments = null;
  for (const sep of separators) {
    const parts = working.split(sep).map(cleanSegment).filter(Boolean);
    if (parts.length >= 2) {
      segments = parts.slice(0, 2);
      break;
    }
  }
  if (!segments || segments.length < 2) return null;
  const parseTriangleSegment = text => {
    if (!text) return {};
    const direct = parseSpec(text);
    if (Object.keys(direct).length > 0) return direct;
    return parseSpecFreeform(text);
  };
  const first = parseTriangleSegment(segments[0]);
  const second = parseTriangleSegment(segments[1]);
  if (Object.keys(first).length === 0 || Object.keys(second).length === 0) return null;
  const sharedEntry = {
    label: sharedLabel || '',
    value: Number.isFinite(first.c) ? first.c : Number.isFinite(second.c) ? second.c : null,
    requested: hadSharedLabel
  };
  const normalizedParts = ['dobbel trekant'];
  if (sharedEntry.label) normalizedParts.push(`felles side ${sharedEntry.label}`);
  const firstText = objToSpec(first);
  const secondText = objToSpec(second);
  if (firstText) normalizedParts.push(`trekant 1: ${firstText}`);
  if (secondText) normalizedParts.push(`trekant 2: ${secondText}`);
  const job = {
    type: 'doubleTri',
    obj: {
      shared: sharedEntry,
      first,
      second
    }
  };
  return {
    job,
    normalized: normalizedParts.join(' | '),
    allowDecorations: true
  };
}
function parseShapeSpec(str) {
  const circle = parseCircleSpecLine(str);
  if (circle) return {
    ...circle,
    allowDecorations: false
  };
  const polygonWithArc = parsePolygonArcSpecLine(str);
  if (polygonWithArc) return polygonWithArc;
  const polygon = parsePolygonSpecLine(str);
  if (polygon) return polygon;
  return null;
}
function parseDecorationSegment(segment) {
  const trimmed = segment && segment.trim ? segment.trim() : '';
  if (!trimmed) {
    return {
      handled: true,
      decorations: [],
      normalized: []
    };
  }
  if (/^diagonal(?:er)?/i.test(trimmed)) {
    let rest = trimmed.replace(/^diagonal(?:er)?/i, '').trim();
    if (rest.startsWith(':') || rest.startsWith('=')) rest = rest.slice(1).trim();
    rest = rest.replace(/\bog\b/gi, ',');
    rest = rest.replace(/[-–—]/g, ' ');
    const pairs = rest.toUpperCase().match(/[A-D]{2}/g) || [];
    const seen = new Set();
    const decorations = [];
    const normalized = [];
    pairs.forEach(pair => {
      if (pair[0] === pair[1]) return;
      const sorted = pair[0] <= pair[1] ? pair : `${pair[1]}${pair[0]}`;
      if (seen.has(sorted)) return;
      seen.add(sorted);
      decorations.push({
        type: 'diagonal',
        from: pair[0],
        to: pair[1]
      });
      normalized.push(`diagonal ${pair}`);
    });
    return {
      handled: true,
      decorations,
      normalized
    };
  }
  if (/^halvsirkel/i.test(trimmed)) {
    const dims = parseLabeledSegments(trimmed, [{
      id: 'radius',
      keywords: ['radius', 'rad'],
      defaultLabel: 'r'
    }, {
      id: 'diameter',
      keywords: ['diameter', 'diam'],
      defaultLabel: 'd'
    }]);
    const radiusEntry = dims.radius ? {
      ...dims.radius,
      requested: true
    } : null;
    if (radiusEntry && !radiusEntry.label) radiusEntry.label = 'r';
    const diameterEntry = dims.diameter ? {
      ...dims.diameter,
      requested: true
    } : null;
    if (diameterEntry && !diameterEntry.label) diameterEntry.label = 'd';
    const sideMatch = trimmed.match(/halvsirkel\s+([A-Za-z]+(?:\s*[A-Za-z]+)?)/i);
    const sideSegment = sideMatch ? sideMatch[1] : '';
    const tokens = parseArcSideTokens(sideSegment);
    let first = tokens[0] || 'A';
    let second = tokens[1] || '';
    if (!second) {
      if (tokens[0] && tokens[0].length >= 2) {
        second = tokens[0].slice(1, 2);
      } else {
        second = String.fromCharCode(first.charCodeAt(0) + 1);
      }
    }
    first = first.slice(0, 1).toUpperCase();
    second = second.slice(0, 1).toUpperCase();
    if (!first) first = 'A';
    if (!second) second = first === 'Z' ? 'A' : String.fromCharCode(first.charCodeAt(0) + 1);
    if (first === second) {
      second = second === 'Z' ? 'A' : String.fromCharCode(second.charCodeAt(0) + 1);
    }
    const normalizedParts = [`halvsirkel ${first}${second}`];
    const radiusText = radiusEntry && radiusEntry.requested ? normalizedDimensionText(radiusEntry, 'r') : '';
    const diameterText = diameterEntry ? normalizedDimensionText(diameterEntry, 'd') : '';
    if (radiusEntry && radiusEntry.requested && radiusText) normalizedParts.push(`radius ${radiusText}`);
    if (diameterEntry && diameterEntry.requested && diameterText) normalizedParts.push(`diameter ${diameterText}`);
    const decoration = {
      type: 'semicircle',
      from: first,
      to: second
    };
    if (radiusEntry) decoration.radius = radiusEntry;
    if (diameterEntry) decoration.diameter = diameterEntry;
    return {
      handled: true,
      decorations: [decoration],
      normalized: normalizedParts
    };
  }
  if (/^kvadrat/i.test(trimmed)) {
    const sideMatch = trimmed.match(/kvadrat\s+([A-Za-z]+(?:\s*[A-Za-z]+)?)/i);
    const sideSegment = sideMatch ? sideMatch[1] : '';
    const tokens = parseArcSideTokens(sideSegment);
    let first = tokens[0] || 'A';
    let second = tokens[1] || '';
    if (!second) {
      if (tokens[0] && tokens[0].length >= 2) {
        second = tokens[0].slice(1, 2);
      } else {
        second = String.fromCharCode(first.charCodeAt(0) + 1);
      }
    }
    first = first.slice(0, 1).toUpperCase();
    second = second.slice(0, 1).toUpperCase();
    if (!first) first = 'A';
    if (!second) second = first === 'Z' ? 'A' : String.fromCharCode(first.charCodeAt(0) + 1);
    if (first === second) {
      second = second === 'Z' ? 'A' : String.fromCharCode(second.charCodeAt(0) + 1);
    }
    const decoration = {
      type: 'square',
      from: first,
      to: second
    };
    const normalized = [`kvadrat ${first}${second}`];
    return {
      handled: true,
      decorations: [decoration],
      normalized
    };
  }
  if (/^h(?:øy|oy)der?/i.test(trimmed)) {
    let rest = trimmed.replace(/^h(?:øy|oy)der?/i, '').trim();
    if (rest.startsWith(':') || rest.startsWith('=')) rest = rest.slice(1).trim();
    rest = rest.replace(/\bog\b/gi, ',');
    const parts = rest.split(/[,;]/).map(p => p.trim()).filter(Boolean);
    const decorations = [];
    const normalized = [];
    parts.forEach(part => {
      const spec = parseHeightSpec(part);
      if (!spec) return;
      decorations.push({
        type: 'height',
        from: spec.from,
        base: spec.base,
        baseSide: spec.baseSide,
        explicitBase: spec.explicitBase
      });
      const baseText = spec.base ? `/${spec.base}` : spec.baseSide ? `/${spec.baseSide}` : '';
      normalized.push(`høyde ${spec.from}${baseText}`);
    });
    return {
      handled: true,
      decorations,
      normalized
    };
  }
  const heightInlineMatch = trimmed.match(/^([A-D])\s+(til|på|mot)\b/i);
  if (heightInlineMatch) {
    const spec = parseHeightSpec(trimmed);
    if (spec) {
      const decorations = [{
        type: 'height',
        from: spec.from,
        base: spec.base,
        baseSide: spec.baseSide,
        explicitBase: spec.explicitBase
      }];
      const baseText = spec.base ? `/${spec.base}` : spec.baseSide ? `/${spec.baseSide}` : '';
      return {
        handled: true,
        decorations,
        normalized: [`høyde ${spec.from}${baseText}`]
      };
    }
  }
  return {
    handled: false,
    decorations: [],
    normalized: []
  };
}
function parseHeightSpec(text) {
  if (!text) return null;
  let t = text.trim();
  if (!t) return null;
  t = t.replace(/^fra\s+/i, '');
  t = t.replace(/\s+(?:til|på|mot)\s+/gi, '/');
  t = t.replace(/[→↦↠→−–—]/g, '/');
  t = t.replace(/->/g, '/');
  t = t.replace(/-/g, '/');
  t = t.replace(/\s*\/\s*/g, '/');
  t = t.replace(/\s+/g, ' ').trim();
  const sanitize = (str, maxLetters) => {
    if (!str) return '';
    const letters = (str.match(/[A-D]/gi) || []).join('').toUpperCase();
    return letters.slice(0, maxLetters);
  };
  const parts = t.split('/');
  const left = parts[0] || '';
  const basePart = parts[1] || '';
  const leftLetters = sanitize(left, 3);
  if (!leftLetters) return null;
  let from = leftLetters.slice(0, 1);
  let baseLetters = '';
  let explicitBase = false;
  let baseSide = null;
  if (parts.length >= 2) {
    baseLetters = sanitize(basePart, 2);
    if (baseLetters.length === 2) {
      explicitBase = true;
    } else {
      const sideMatch = basePart.match(/\b([abcd])\b/i);
      if (sideMatch) {
        baseSide = sideMatch[1].toLowerCase();
        explicitBase = true;
      }
    }
  } else if (leftLetters.length >= 3) {
    baseLetters = leftLetters.slice(1, 3);
    explicitBase = baseLetters.length === 2;
  }
  if (baseLetters.length !== 2) baseLetters = '';
  return {
    from,
    base: baseLetters || null,
    baseSide,
    explicitBase
  };
}
function extractDecorations(line) {
  const extras = [];
  const normalizedExtras = [];
  if (!line) {
    return {
      core: '',
      extras,
      normalizedExtras
    };
  }
  const decorationLead = /,(\s*(?:diagonal(?:er)?|h(?:øy|oy)der?|[A-D]\s+(?:til|på|mot)\b))/gi;
  const normalizedLine = String(line).replace(decorationLead, ';$1');
  const segments = normalizedLine.split(';');
  const coreSegments = [];
  segments.forEach(seg => {
    const trimmed = seg.trim();
    if (!trimmed) return;
    const parsed = parseDecorationSegment(trimmed);
    if (parsed.handled && parsed.decorations.length) {
      parsed.decorations.forEach(dec => extras.push(dec));
      parsed.normalized.forEach(norm => {
        if (norm && !normalizedExtras.includes(norm)) normalizedExtras.push(norm);
      });
    } else {
      coreSegments.push(trimmed);
    }
  });
  const core = coreSegments.join('; ').trim();
  return {
    core,
    extras,
    normalizedExtras
  };
}
function combineNormalizedText(core, extras) {
  const base = typeof core === 'string' ? core.trim() : '';
  const list = Array.isArray(extras) ? extras.filter(item => typeof item === 'string' && item.trim()) : [];
  if (!list.length) return base;
  const extrasText = list.join('; ');
  if (base) return `${base}; ${extrasText}`;
  return extrasText;
}
function objToSpec(obj) {
  if (!obj || typeof obj !== 'object') return '';
  const order = ["a", "b", "c", "d", "A", "B", "C", "D"];
  const core = order.filter(k => k in obj).map(k => `${k}=${specFmt(obj[k])}`).join(', ');
  const hint = getSpecShapeHint(obj);
  if (hint && typeof hint.keyword === 'string' && hint.keyword.trim()) {
    const keyword = hint.keyword.trim();
    return core ? `${keyword} ${core}` : keyword;
  }
  return core;
}
function resolveBackendEndpoint() {
  if (typeof window === 'undefined') return null;
  if (window.MATH_VISUALS_API_URL) {
    return window.MATH_VISUALS_API_URL;
  }
  var _window$location;
  const origin = (_window$location = window.location) === null || _window$location === void 0 ? void 0 : _window$location.origin;
  if (typeof origin === 'string' && /^https?:/i.test(origin)) {
    return '/api/nkant-parse';
  }
  return null;
}
async function requestSpecFromBackend(str) {
  const endpoint = resolveBackendEndpoint();
  if (!endpoint) return null;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: str
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Backend error ${res.status}${text ? `: ${text}` : ''}`);
  }
  return res.json();
}
async function parseSpecAI(str) {
  const direct = parseSpec(str);
  if (Object.keys(direct).length > 0) return direct;
  const quick = parseSpecFreeform(str);
  if (Object.keys(quick).length > 0) return quick;
  let data = null;
  try {
    data = await requestSpecFromBackend(str);
  } catch (error) {
    if (error) console.warn('parseSpecAI backend fallback', error);
  }
  if (!data) {
    return parseSpec(str);
  }
  try {
    var _data$choices2;
    const txt = (_data$choices2 = data.choices) === null || _data$choices2 === void 0 || (_data$choices2 = _data$choices2[0]) === null || _data$choices2 === void 0 || (_data$choices2 = _data$choices2.message) === null || _data$choices2 === void 0 ? void 0 : _data$choices2.content;
    if (!txt) throw new Error('no content');
    const parsed = JSON.parse(txt);
    const out = {};
    Object.entries(parsed).forEach(([k, v]) => {
      if (/^[abcdABCD]$/.test(k)) {
        const n = parseFloat(String(v).replace(',', '.'));
        if (isFinite(n)) out[k] = n;
      }
    });
    if (Object.keys(out).length === 0) return parseSpec(str);
    const detectedHint = detectShapeHintFromPrefix(str);
    if (detectedHint) setSpecShapeHint(out, detectedHint);
    return out;
  } catch (err) {
    console.warn('parseSpecAI parse error', err);
    return parseSpec(str);
  }
}

/* ---------- VISNINGSTEKSTER ---------- */
// Sider: none | value | custom | custom+value
function buildSideText(mode, valueStr, customText) {
  const t = (mode !== null && mode !== void 0 ? mode : "value").toString().trim();
  if (t === "none") return null;
  if (t === "value") return valueStr;
  if (t === "custom") return customText !== null && customText !== void 0 ? customText : "";
  if (t === "custom+value") return `${customText !== null && customText !== void 0 ? customText : ""}=${valueStr}`;
  return valueStr; // fallback
}

/* Vinkler/punkter:
   none | mark | mark+value | custom | custom+mark | custom+mark+value
   → { mark:bool, angleText:string|null, pointLabel:string|null } */
function parseAnglePointMode(modeStr, valueDeg, customText, fallbackPointLetter) {
  // tolerer "egenvalgt..." som synonym
  let t = (modeStr !== null && modeStr !== void 0 ? modeStr : "mark+value").toString().trim();
  t = t.replace(/^egenvalgt/i, "custom");
  if (t === "none") return {
    mark: false,
    angleText: null,
    pointLabel: null
  };
  const hasMark = t.includes("mark");
  const hasVal = t.includes("value");
  const isCustom = t.startsWith("custom");
  const angleText = hasVal ? `${Math.round(valueDeg)}°` : null;
  const pointLabel = isCustom ? customText || fallbackPointLetter || "" : null;
  return {
    mark: hasMark,
    angleText,
    pointLabel
  };
}

/* ---------- ANGLE RADIUS (smart default + ADV) ---------- */
function angleRadius(Q, P, R) {
  const f = ADV_CONFIG.angle.factor;
  const r0 = f * Math.min(dist(Q, P), dist(Q, R));
  return clamp(r0, ADV_CONFIG.angle.min, ADV_CONFIG.angle.max);
}

function rightAngleSizeFromRadius(r) {
  const cfg = ADV_CONFIG.rightAngleMarker || {};
  const scale = cfg.vertexScale != null ? cfg.vertexScale : 0.7;
  const minSize = cfg.vertexMin != null ? cfg.vertexMin : 12;
  const maxSize = cfg.vertexMax != null ? cfg.vertexMax : 24;
  return clamp(r * scale, minSize, maxSize);
}

function rightAngleSizeFromSegments(baseLen, altLen) {
  const cfg = ADV_CONFIG.rightAngleMarker || {};
  const scale = cfg.heightScale != null ? cfg.heightScale : 0.35;
  const minSize = cfg.heightMin != null ? cfg.heightMin : 12;
  const maxSize = cfg.heightMax != null ? cfg.heightMax : 18;
  const maxRatio = cfg.heightMaxRatio != null ? cfg.heightMaxRatio : 0.65;
  const base = Math.min(baseLen, altLen);
  if (!(base > 0)) return 0;
  const raw = base * scale;
  const hi = Math.max(0, Math.min(maxSize, base * maxRatio));
  if (!(hi > 0)) return 0;
  const lo = Math.min(minSize, hi);
  return clamp(raw, lo, hi);
}

/* ---------- VINKELTEGNING + PLASSERING (NY) ---------- */
function renderAngle(g, Q, P, R, r, opts) {
  opts = opts || {};
  const aDeg = angleAt(Q, P, R);
  const isRight = Math.abs(aDeg - 90) < 0.5;

  // retningsvektorer og vinkelhalvering
  const u = unitVec(Q, P),
    v = unitVec(Q, R);
  const bisLen = Math.hypot(u.x + v.x, u.y + v.y) || 1;
  const bis = {
    x: (u.x + v.x) / bisLen,
    y: (u.y + v.y) / bisLen
  }; // inn i sektoren
  const nBis = {
    x: -bis.x,
    y: -bis.y
  }; // ut av figuren

  // markering (bue/kvadrat)
  if (opts.mark) {
    if (isRight) {
      const s = rightAngleSizeFromRadius(r);
      if (s > 0) {
        const q = {
          x: Q.x,
          y: Q.y
        };
        const p1 = {
          x: Q.x + u.x * s,
          y: Q.y + u.y * s
        };
        const p2 = {
          x: Q.x + (u.x + v.x) * s,
          y: Q.y + (u.y + v.y) * s
        };
        const p3 = {
          x: Q.x + v.x * s,
          y: Q.y + v.y * s
        };
        add(g, "polygon", {
          points: `${q.x},${q.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
          fill: STYLE.angFill,
          stroke: "none"
        });
        add(g, "polyline", {
          points: `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`,
          fill: "none",
          stroke: STYLE.angStroke,
          "stroke-width": STYLE.angWidth,
          "stroke-linejoin": "round",
          "stroke-linecap": "round"
        });
      }
    } else {
      const a1 = Math.atan2(P.y - Q.y, P.x - Q.x);
      const a2 = Math.atan2(R.y - Q.y, R.x - Q.x);
      let d = a2 - a1;
      while (d <= -Math.PI) d += 2 * Math.PI;
      while (d > Math.PI) d -= 2 * Math.PI;
      const o = Math.sign((P.x - Q.x) * (R.y - Q.y) - (P.y - Q.y) * (R.x - Q.x));
      if (o > 0 && d < 0) d += 2 * Math.PI;
      if (o < 0 && d > 0) d -= 2 * Math.PI;
      const large = Math.abs(d) > Math.PI ? 1 : 0;
      const sweep = o > 0 ? 1 : 0;
      const A1 = {
        x: Q.x + r * Math.cos(a1),
        y: Q.y + r * Math.sin(a1)
      };
      const B1 = {
        x: Q.x + r * Math.cos(a1 + d),
        y: Q.y + r * Math.sin(a1 + d)
      };
      const path = `M ${Q.x} ${Q.y} L ${A1.x} ${A1.y} A ${r} ${r} 0 ${large} ${sweep} ${B1.x} ${B1.y} Z`;
      add(g, "path", {
        d: path,
        fill: STYLE.angFill,
        stroke: "none"
      });
      add(g, "path", {
        d: path.replace("Z", ""),
        fill: "none",
        stroke: STYLE.angStroke,
        "stroke-width": STYLE.angWidth
      });
    }
  }
  const cfg = ADV_CONFIG.angle;
  const insideK = isRight ? cfg.insideK.right : cfg.insideK.other;
  const outsideK = isRight ? cfg.outsideK.right : cfg.outsideK.other;

  // 90°: hvis markert, dropp verditekst
  const showAngleValue = opts.angleText && !(isRight && opts.mark);

  // vinkelverdi (inne i sektoren)
  if (showAngleValue) {
    const Ti = {
      x: Q.x + bis.x * (insideK * r),
      y: Q.y + bis.y * (insideK * r)
    };
    placeAdjustableLabel(g, opts.angleKey, Ti.x, Ti.y, opts.angleText, STYLE.angFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      fill: STYLE.angStroke
    });
  }

  // punktnavn (ute på samme linje) – med clamp
  if (opts.pointLabel) {
    var _cfg$outsideMaxFactor, _cfg$outsideMin;
    const baseLen = Math.min(dist(Q, P), dist(Q, R));
    const outTarget = outsideK * r + cfg.outsidePad;
    const outMax = ((_cfg$outsideMaxFactor = cfg.outsideMaxFactor) !== null && _cfg$outsideMaxFactor !== void 0 ? _cfg$outsideMaxFactor : 0.9) * baseLen;
    const outLen = clamp(outTarget, (_cfg$outsideMin = cfg.outsideMin) !== null && _cfg$outsideMin !== void 0 ? _cfg$outsideMin : 0, outMax);
    const To = {
      x: Q.x + nBis.x * outLen,
      y: Q.y + nBis.y * outLen
    };
    placeAdjustableLabel(g, opts.pointKey, To.x, To.y, opts.pointLabel, STYLE.ptFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      fill: STYLE.edgeStroke
    });
  }
}

/* ---------- TEKST FOR SIDER ---------- */
function sideLabelText(g, P, Q, text, rotate, centroid, offset = 18, labelKey = null) {
  if (!text) return;
  const M = {
    x: (P.x + Q.x) / 2,
    y: (P.y + Q.y) / 2
  };
  const vx = Q.x - P.x,
    vy = Q.y - P.y;
  const nx = -vy,
    ny = vx;
  const dot = (centroid.x - M.x) * nx + (centroid.y - M.y) * ny;
  const sgn = dot > 0 ? -1 : 1;
  const nlen = Math.hypot(nx, ny) || 1;
  const adj = Math.max(offset, Math.min(22, dist(P, Q) * 0.18));
  const labelPad = STYLE.sideFS * 0.4;
  const dirX = sgn * nx / nlen;
  const dirY = sgn * ny / nlen;
  const extraPad = (dirY > 0.25 || dirX > 0.25) ? 5 : 0;
  const finalAdj = adj + labelPad + extraPad;
  const x = M.x + sgn * finalAdj * nx / nlen;
  const y = M.y + sgn * finalAdj * ny / nlen;
  let baseRotation = 0;
  if (rotate) {
    let theta = Math.atan2(vy, vx) * 180 / Math.PI;
    if (theta > 90) theta -= 180;
    if (theta < -90) theta += 180;
    baseRotation = theta;
  }
  const t = placeAdjustableLabel(g, labelKey, x, y, text, STYLE.sideFS, {
    "text-anchor": "middle",
    "dominant-baseline": "middle",
    fill: STYLE.edgeStroke
  }, baseRotation);
  if (rotate && baseRotation) {
    t.setAttribute("transform", `rotate(${baseRotation}, ${x}, ${y})`);
  }
}

/* ---------- TEGN FIGURER ---------- */
function ptsTo(arr) {
  return arr.map(p => `${p.x},${p.y}`).join(" ");
}
function shift(P, rect) {
  return {
    x: P.x + rect.x,
    y: P.y + rect.y
  };
}
function errorBox(g, rect, msg) {
  add(g, "rect", {
    x: rect.x + 10,
    y: rect.y + 10,
    width: rect.w - 20,
    height: 40,
    rx: 8,
    fill: "#ffecec",
    stroke: "#ffb3b3"
  });
  add(g, "text", {
    x: rect.x + 20,
    y: rect.y + 36,
    fill: "#c00",
    "font-size": 16
  }).textContent = msg;
}
function drawTriangleToGroup(g, rect, spec, adv, decorations, labelCtx) {
  var _Cs$1$y, _Cs$, _m$a, _m$b, _m$c, _m$d, _am$A, _am$B, _am$C, _am$D;
  const s = typeof spec === 'string' ? parseSpec(spec) : spec;
  const sol = solveTriangle(s);

  // y-opp konfig
  const A0 = {
    x: 0,
    y: 0
  };
  const B0 = {
    x: sol.c,
    y: 0
  };
  const Cs = circleCircle(A0, sol.b, B0, sol.a);
  if (Cs.length === 0) throw new Error("Trekant: ingen løsning fra oppgitte verdier.");
  const C0 = Cs[0].y >= ((_Cs$1$y = (_Cs$ = Cs[1]) === null || _Cs$ === void 0 ? void 0 : _Cs$.y) !== null && _Cs$1$y !== void 0 ? _Cs$1$y : -1e9) ? Cs[0] : Cs[1] || Cs[0];
  const base = [A0, B0, C0];
  const basePointsMap = {
    A: A0,
    B: B0,
    C: C0
  };
  const semicircleExtents = collectSemicircleExtentPoints(basePointsMap, decorations, ['A', 'B', 'C']);
  const squareExtents = collectSquareExtentPoints(basePointsMap, decorations, ['A', 'B', 'C']);
  const extraPts = semicircleExtents.concat(squareExtents);
  const fitPts = extraPts.length ? base.concat(extraPts) : base;
  const {
    T,
    k: renderScale
  } = fitTransformToRect(fitPts, rect.w, rect.h, 46);
  const restoreTextScale = pushTextScale(renderScale);
  try {
    const A = shift(T(A0), rect),
      B = shift(T(B0), rect),
      C = shift(T(C0), rect),
      poly = [A, B, C];
    add(g, "polygon", {
      points: ptsTo(poly),
      fill: STYLE.faceFill,
      stroke: "none"
    });
    const ctr = polygonCentroid(poly);
    const pointsMap = {
      A,
      B,
      C
    };
    const heightInfos = collectHeightInfos(pointsMap, decorations);
    const activeHeight = heightInfos.length ? heightInfos[0] : null;
    let heightPoint = null;
    let heightTag = null;
    let heightLength = null;
    let baseForAngle = null;
    let heightAngleValue = null;
    let heightAngleMode = null;
    if (activeHeight) {
      heightPoint = activeHeight.foot;
      heightTag = activeHeight.tag;
      pointsMap.D = heightPoint;
      const vertex = activeHeight.vertex;
      const pixelHeight = dist(vertex, heightPoint);
      const scale = renderScale > 0 ? renderScale : 1;
      heightLength = pixelHeight / scale;
      const [baseA, baseB] = activeHeight.basePoints;
      const distToA = dist(baseA, vertex);
      const distToB = dist(baseB, vertex);
      baseForAngle = distToA <= distToB ? baseA : baseB;
      heightAngleValue = angleAt(heightPoint, baseForAngle, vertex);
      const am = adv.angles.mode,
        at = adv.angles.text;
      heightAngleMode = parseAnglePointMode((_am$D = am.D) !== null && _am$D !== void 0 ? _am$D : am.default, heightAngleValue, at.D, "D");
      drawConstructionLine(g, vertex, heightPoint);
      if (heightAngleMode.mark) {
        const baseDir = {
          x: activeHeight.basePoints[1].x - activeHeight.basePoints[0].x,
          y: activeHeight.basePoints[1].y - activeHeight.basePoints[0].y
        };
        const altDir = {
          x: vertex.x - heightPoint.x,
          y: vertex.y - heightPoint.y
        };
        const shouldDrawMarker = !(heightAngleMode.angleText || heightAngleMode.pointLabel);
        if (shouldDrawMarker) {
          drawRightAngleMarker(g, heightPoint, baseDir, altDir);
        }
      }
    }

    // sider
    const m = adv.sides.mode,
      st = adv.sides.text;
    const rotateText = shouldRotateText();
    sideLabelText(g, B, C, buildSideText((_m$a = m.a) !== null && _m$a !== void 0 ? _m$a : m.default, fmt(sol.a), st.a), rotateText, ctr, 18, labelKey(labelCtx, 'side', 'a'));
    sideLabelText(g, C, A, buildSideText((_m$b = m.b) !== null && _m$b !== void 0 ? _m$b : m.default, fmt(sol.b), st.b), rotateText, ctr, 18, labelKey(labelCtx, 'side', 'b'));
    sideLabelText(g, A, B, buildSideText((_m$c = m.c) !== null && _m$c !== void 0 ? _m$c : m.default, fmt(sol.c), st.c), rotateText, ctr, 18, labelKey(labelCtx, 'side', 'c'));
    if (activeHeight && heightLength !== null) {
      const heightText = buildSideText((_m$d = m.d) !== null && _m$d !== void 0 ? _m$d : m.default, fmt(heightLength), st.d);
      if (heightText) {
        sideLabelText(g, activeHeight.vertex, heightPoint, heightText, rotateText, ctr, 16, labelKey(labelCtx, 'side', 'd'));
      }
    }

    // vinkler/punkter
    const am = adv.angles.mode,
      at = adv.angles.text;
    const angleAVal = angleAt(A, B, C);
    const angleBVal = angleAt(B, C, A);
    const angleCVal = angleAt(C, A, B);
    const Ares = parseAnglePointMode((_am$A = am.A) !== null && _am$A !== void 0 ? _am$A : am.default, angleAVal, at.A, "A");
    const Bres = parseAnglePointMode((_am$B = am.B) !== null && _am$B !== void 0 ? _am$B : am.default, angleBVal, at.B, "B");
    const Cres = parseAnglePointMode((_am$C = am.C) !== null && _am$C !== void 0 ? _am$C : am.default, angleCVal, at.C, "C");
    if (activeHeight && heightAngleMode && (heightAngleMode.mark || heightAngleMode.angleText || heightAngleMode.pointLabel)) {
      renderAngle(g, heightPoint, baseForAngle, activeHeight.vertex, angleRadius(heightPoint, baseForAngle, activeHeight.vertex), {
        mark: heightAngleMode.mark,
        angleText: heightAngleMode.angleText,
        pointLabel: heightAngleMode.pointLabel,
        angleKey: labelKey(labelCtx, 'angle', 'D'),
        pointKey: labelKey(labelCtx, 'point', heightTag || 'D')
      });
    }
    renderAngle(g, A, B, C, angleRadius(A, B, C), {
      mark: Ares.mark,
      angleText: Ares.angleText,
      pointLabel: Ares.pointLabel,
      angleKey: labelKey(labelCtx, 'angle', 'A'),
      pointKey: labelKey(labelCtx, 'point', 'A')
    });
    renderAngle(g, B, C, A, angleRadius(B, C, A), {
      mark: Bres.mark,
      angleText: Bres.angleText,
      pointLabel: Bres.pointLabel,
      angleKey: labelKey(labelCtx, 'angle', 'B'),
      pointKey: labelKey(labelCtx, 'point', 'B')
    });
    renderAngle(g, C, A, B, angleRadius(C, A, B), {
      mark: Cres.mark,
      angleText: Cres.angleText,
      pointLabel: Cres.pointLabel,
      angleKey: labelKey(labelCtx, 'angle', 'C'),
      pointKey: labelKey(labelCtx, 'point', 'C')
    });
    add(g, "polygon", {
      points: ptsTo(poly),
      fill: "none",
      stroke: STYLE.edgeStroke,
      "stroke-width": STYLE.edgeWidth,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    });
    const skipHeights = heightTag ? new Set([heightTag]) : null;
    renderDecorations(g, pointsMap, decorations, {
      skipHeights,
      centroid: ctr,
      pointOrder: ['A', 'B', 'C'],
      labelCtx
    });
    const summary = cloneJobForSummary({
      type: 'tri',
      obj: {
        a: sol.a,
        b: sol.b,
        c: sol.c,
        d: heightLength,
        A: angleAVal,
        B: angleBVal,
        C: angleCVal,
        D: heightAngleValue
      },
      decorations
    });
    if (summary) {
      const entries = [
        ['A', Ares, angleAVal],
        ['B', Bres, angleBVal],
        ['C', Cres, angleCVal]
      ];
      if (activeHeight && heightAngleMode) {
        entries.push(['D', heightAngleMode, heightAngleValue]);
      }
      summary.angleMarks = buildAngleMarkSummary(entries);
    }
    return summary;
  } finally {
    restoreTextScale();
  }
}

function rotateTriangleSolution(sol, rotation) {
  if (!sol || typeof sol !== "object") return null;
  const r = ((rotation % 3) + 3) % 3;
  if (r === 0) {
    return {
      a: sol.a,
      b: sol.b,
      c: sol.c,
      A: sol.A,
      B: sol.B,
      C: sol.C
    };
  }
  const sideOrder = [
    ["a", "b", "c"],
    ["b", "c", "a"],
    ["c", "a", "b"]
  ];
  const angleOrder = [
    ["A", "B", "C"],
    ["B", "C", "A"],
    ["C", "A", "B"]
  ];
  const sides = sideOrder[r];
  const angles = angleOrder[r];
  return {
    a: sol[sides[0]],
    b: sol[sides[1]],
    c: sol[sides[2]],
    A: sol[angles[0]],
    B: sol[angles[1]],
    C: sol[angles[2]]
  };
}

function inferSharedSideKey(label) {
  if (!label || typeof label !== "string") return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (/^[abc]$/i.test(trimmed)) return trimmed.toLowerCase();
  const letters = trimmed.toUpperCase().replace(/[^A-Z]/g, "");
  if (!letters) return null;
  const pair = letters.length >= 2 ? letters.slice(0, 2) : letters;
  const map = {
    AB: "c",
    BA: "c",
    BC: "a",
    CB: "a",
    AC: "b",
    CA: "b"
  };
  return map[pair] || null;
}

function pickSharedSideForDoubleTriangle(firstSol, secondSol, firstSpec, secondSpec, sharedLabel) {
  if (!firstSol || !secondSol) return null;
  const sideKeys = ["a", "b", "c"];
  const firstExplicit = new Set(sideKeys.filter(key => firstSpec && Object.prototype.hasOwnProperty.call(firstSpec, key)));
  const secondExplicit = new Set(sideKeys.filter(key => secondSpec && Object.prototype.hasOwnProperty.call(secondSpec, key)));
  const combos = [];
  sideKeys.forEach(firstKey => {
    const v1 = firstSol[firstKey];
    if (!(v1 > 0)) return;
    sideKeys.forEach(secondKey => {
      const v2 = secondSol[secondKey];
      if (!(v2 > 0)) return;
      const diff = Math.abs(v1 - v2);
      const relDiff = diff / Math.max(v1, v2, 1e-9);
      combos.push({
        firstKey,
        secondKey,
        firstValue: v1,
        secondValue: v2,
        diff,
        relDiff,
        explicitFirst: firstExplicit.has(firstKey),
        explicitSecond: secondExplicit.has(secondKey),
        sameLetter: firstKey === secondKey
      });
    });
  });
  if (!combos.length) return null;
  combos.sort((a, b) => {
    const explicitA = (a.explicitFirst ? 1 : 0) + (a.explicitSecond ? 1 : 0);
    const explicitB = (b.explicitFirst ? 1 : 0) + (b.explicitSecond ? 1 : 0);
    if (explicitA !== explicitB) return explicitB - explicitA;
    if (a.sameLetter !== b.sameLetter) return (b.sameLetter ? 1 : 0) - (a.sameLetter ? 1 : 0);
    if (a.relDiff !== b.relDiff) return a.relDiff - b.relDiff;
    if (a.diff !== b.diff) return a.diff - b.diff;
    return 0;
  });
  const REL_TOLERANCE = 0.02;
  const ABS_TOLERANCE = 1e-3;
  const withinTolerance = combo => combo.relDiff <= REL_TOLERANCE || combo.diff <= ABS_TOLERANCE;
  const preferredKey = inferSharedSideKey(sharedLabel);
  if (preferredKey) {
    const preferredCombos = combos.filter(combo => combo.firstKey === preferredKey && combo.secondKey === preferredKey);
    for (const combo of preferredCombos) {
      if (withinTolerance(combo)) {
        return combo;
      }
    }
  }
  for (const combo of combos) {
    if (withinTolerance(combo)) {
      return combo;
    }
  }
  if (preferredKey) {
    const fallbackPreferred = combos.find(combo => combo.firstKey === preferredKey && combo.secondKey === preferredKey);
    if (fallbackPreferred) {
      return fallbackPreferred;
    }
  }
  return combos[0];
}

function drawDoubleTriangleToGroup(g, rect, spec, adv, decorations, labelCtx) {
  const sharedSpec = spec && spec.shared ? { ...spec.shared } : { label: '', value: null, requested: false };
  const firstSpec = spec && spec.first ? spec.first : {};
  const secondSpec = spec && spec.second ? spec.second : {};
  let firstSol = solveTriangle(firstSpec);
  let secondSol = solveTriangle(secondSpec);
  const shared = pickSharedSideForDoubleTriangle(firstSol, secondSol, firstSpec, secondSpec, sharedSpec && sharedSpec.label);
  if (!shared) {
    throw new Error('Dobbel trekant: begge trekantene må ha en felles side.');
  }
  const rotationMap = { a: 1, b: 2, c: 0 };
  const firstRot = rotateTriangleSolution(firstSol, rotationMap[shared.firstKey] || 0);
  const secondRot = rotateTriangleSolution(secondSol, rotationMap[shared.secondKey] || 0);
  if (!firstRot || !secondRot) {
    throw new Error('Dobbel trekant: klarte ikke å identifisere felles side.');
  }
  firstSol = firstRot;
  secondSol = secondRot;
  const baseDiff = Math.abs(firstSol.c - secondSol.c);
  const baseTol = Math.max(1e-3, Math.max(firstSol.c, secondSol.c) * 0.02);
  if (!(firstSol.c > 0) || !(secondSol.c > 0) || baseDiff > baseTol) {
    throw new Error('Dobbel trekant: felles side må være lik i begge spesifikasjonene.');
  }
  sharedSpec.value = firstSol.c;
  secondSol = { ...secondSol, c: firstSol.c };
  const baseLength = firstSol.c;
  const A0 = { x: 0, y: 0 };
  const B0 = { x: baseLength, y: 0 };
  const topCandidates = circleCircle(A0, firstSol.b, B0, firstSol.a);
  if (!topCandidates.length) {
    throw new Error('Dobbel trekant: klarte ikke å konstruere øvre trekant.');
  }
  let C0 = topCandidates[0];
  if (topCandidates.length === 2) {
    C0 = topCandidates[0].y >= topCandidates[1].y ? topCandidates[0] : topCandidates[1];
  }
  if (C0.y < 0) C0 = { x: C0.x, y: Math.abs(C0.y) };
  if (Math.abs(C0.y) < 1e-6) {
    C0 = { x: C0.x, y: Math.max(baseLength * 0.4, 1) };
  }
  const bottomCandidates = circleCircle(A0, secondSol.b, B0, secondSol.a);
  if (!bottomCandidates.length) {
    throw new Error('Dobbel trekant: klarte ikke å konstruere nedre trekant.');
  }
  let D0 = bottomCandidates[0];
  if (bottomCandidates.length === 2) {
    D0 = bottomCandidates[0].y <= bottomCandidates[1].y ? bottomCandidates[0] : bottomCandidates[1];
  }
  if (D0.y > 0) D0 = { x: D0.x, y: -Math.abs(D0.y) };
  if (Math.abs(D0.y) < 1e-6) {
    D0 = { x: D0.x, y: -Math.max(baseLength * 0.4, 1) };
  }
  const basePointsMap = { A: A0, B: B0, C: C0, D: D0 };
  const semicircleExtents = collectSemicircleExtentPoints(basePointsMap, decorations, ['A', 'B', 'C', 'D']);
  const squareExtents = collectSquareExtentPoints(basePointsMap, decorations, ['A', 'B', 'C', 'D']);
  const basePts = [A0, B0, C0, D0];
  const extraPts = semicircleExtents.concat(squareExtents);
  const fitPts = extraPts.length ? basePts.concat(extraPts) : basePts;
  const { T, k: renderScale } = fitTransformToRect(fitPts, rect.w, rect.h, 46);
  const restoreTextScale = pushTextScale(renderScale);
  try {
    const A = shift(T(A0), rect);
    const B = shift(T(B0), rect);
    const C = shift(T(C0), rect);
    const D = shift(T(D0), rect);
    const topPoly = [A, B, C];
    const bottomPoly = [A, B, D];
    add(g, 'polygon', {
      points: ptsTo(bottomPoly),
      fill: STYLE.faceFill,
      stroke: 'none'
    });
    add(g, 'polygon', {
      points: ptsTo(topPoly),
      fill: STYLE.faceFill,
      stroke: 'none'
    });
    const edges = [
      [A, B],
      [B, C],
      [C, A],
      [B, D],
      [D, A]
    ];
    edges.forEach(([P, Q]) => {
      add(g, 'line', {
        x1: P.x,
        y1: P.y,
        x2: Q.x,
        y2: Q.y,
        stroke: STYLE.edgeStroke,
        'stroke-width': STYLE.edgeWidth,
        'stroke-linecap': 'round'
      });
    });
    const advSides = adv && adv.sides ? adv.sides : { mode: {}, text: {} };
    const advAngles = adv && adv.angles ? adv.angles : { mode: {}, text: {} };
    const centroidTop = polygonCentroid(topPoly);
    const centroidBottom = polygonCentroid(bottomPoly);
    const sharedLabel = typeof sharedSpec.label === 'string' ? sharedSpec.label.trim() : '';
    const topSideKey = key => labelKey(labelCtx, 'tri1-side', key);
    const bottomSideKey = key => labelKey(labelCtx, 'tri2-side', key);
    const sharedSideKey = key => labelKey(labelCtx, 'shared-side', key);
    const topAngleKey = key => labelKey(labelCtx, 'tri1-angle', key);
    const bottomAngleKey = key => labelKey(labelCtx, 'tri2-angle', key);
    const topPointKey = key => labelKey(labelCtx, 'tri1-point', key);
    const bottomPointKey = key => labelKey(labelCtx, 'tri2-point', key);
    const baseMode = advSides.mode && advSides.mode.c ? advSides.mode.c : advSides.mode && advSides.mode.default;
    const baseCustom = advSides.text && typeof advSides.text.c === 'string' && advSides.text.c.trim() ? advSides.text.c : (sharedLabel || 'c');
    const baseValueStr = fmt(firstSol.c);
    const baseText = buildSideText(baseMode, baseValueStr, baseCustom);
    const rotateText = shouldRotateText();
    if (baseText) {
      sideLabelText(g, A, B, baseText, rotateText, centroidTop, 24, sharedSideKey('c'));
    }
    const sideMode = key => advSides.mode && advSides.mode[key] ? advSides.mode[key] : advSides.mode && advSides.mode.default;
    const sideText = (key, fallback) => {
      const txt = advSides.text && advSides.text[key];
      if (typeof txt === 'string' && txt.trim()) return txt;
      return fallback;
    };
    const topAVal = fmt(firstSol.a);
    const topBVal = fmt(firstSol.b);
    const topAText = buildSideText(sideMode('a'), topAVal, sideText('a', 'a'));
    if (topAText) sideLabelText(g, B, C, topAText, rotateText, centroidTop, 14, topSideKey('a'));
    const topBText = buildSideText(sideMode('b'), topBVal, sideText('b', 'b'));
    if (topBText) sideLabelText(g, A, C, topBText, rotateText, centroidTop, 14, topSideKey('b'));
    const bottomAVal = fmt(secondSol.a);
    const bottomBVal = fmt(secondSol.b);
    const bottomAText = buildSideText(sideMode('d'), bottomAVal, sideText('d', 'a₂'));
    if (bottomAText) sideLabelText(g, B, D, bottomAText, rotateText, centroidBottom, 14, bottomSideKey('a'));
    const bottomBText = buildSideText(sideMode('e'), bottomBVal, sideText('e', 'b₂'));
    if (bottomBText) sideLabelText(g, A, D, bottomBText, rotateText, centroidBottom, 14, bottomSideKey('b'));
    const angleMode = key => advAngles.mode && advAngles.mode[key] ? advAngles.mode[key] : advAngles.mode && advAngles.mode.default;
    const angleText = key => advAngles.text && advAngles.text[key];
    const AresTop = parseAnglePointMode(angleMode('A'), firstSol.A, angleText('A'), 'A');
    const BresTop = parseAnglePointMode(angleMode('B'), firstSol.B, angleText('B'), 'B');
    const CresTop = parseAnglePointMode(angleMode('C'), firstSol.C, angleText('C'), 'C');
    renderAngle(g, B, A, C, angleRadius(B, A, C), {
      mark: AresTop.mark,
      angleText: AresTop.angleText,
      pointLabel: AresTop.pointLabel,
      angleKey: topAngleKey('A'),
      pointKey: topPointKey('A')
    });
    renderAngle(g, A, B, C, angleRadius(A, B, C), {
      mark: BresTop.mark,
      angleText: BresTop.angleText,
      pointLabel: BresTop.pointLabel,
      angleKey: topAngleKey('B'),
      pointKey: topPointKey('B')
    });
    renderAngle(g, A, C, B, angleRadius(A, C, B), {
      mark: CresTop.mark,
      angleText: CresTop.angleText,
      pointLabel: CresTop.pointLabel,
      angleKey: topAngleKey('C'),
      pointKey: topPointKey('C')
    });
    const AresBottom = parseAnglePointMode(angleMode('A'), secondSol.A, angleText('A'), 'A');
    const BresBottom = parseAnglePointMode(angleMode('B'), secondSol.B, angleText('B'), 'B');
    const DresBottom = parseAnglePointMode(angleMode('D'), secondSol.C, angleText('D'), 'D');
    renderAngle(g, B, A, D, angleRadius(B, A, D), {
      mark: AresBottom.mark,
      angleText: AresBottom.angleText,
      pointLabel: AresBottom.pointLabel,
      angleKey: bottomAngleKey('A'),
      pointKey: bottomPointKey('A')
    });
    renderAngle(g, A, B, D, angleRadius(A, B, D), {
      mark: BresBottom.mark,
      angleText: BresBottom.angleText,
      pointLabel: BresBottom.pointLabel,
      angleKey: bottomAngleKey('B'),
      pointKey: bottomPointKey('B')
    });
    renderAngle(g, A, D, B, angleRadius(A, D, B), {
      mark: DresBottom.mark,
      angleText: DresBottom.angleText,
      pointLabel: DresBottom.pointLabel,
      angleKey: bottomAngleKey('D'),
      pointKey: bottomPointKey('D')
    });
    const pointsMap = { A, B, C, D };
    if (decorations && decorations.length) {
      const decoCentroid = centroidFromPointMap(pointsMap, ['A', 'B', 'C', 'D']);
      renderDecorations(g, pointsMap, decorations, {
        centroid: decoCentroid,
        pointOrder: ['A', 'B', 'C', 'D'],
        labelCtx
      });
    }
    const angleMarksTop = buildAngleMarkSummary([
      ['A', AresTop, firstSol.A],
      ['B', BresTop, firstSol.B],
      ['C', CresTop, firstSol.C]
    ]);
    const angleMarksBottom = buildAngleMarkSummary([
      ['A', AresBottom, secondSol.A],
      ['B', BresBottom, secondSol.B],
      ['D', DresBottom, secondSol.C]
    ]);
    const angleMarks = { ...angleMarksTop };
    Object.entries(angleMarksBottom).forEach(([key, info]) => {
      if (!info) return;
      if (!angleMarks[key]) {
        angleMarks[key] = { ...info };
      } else {
        angleMarks[key] = {
          label: info.label || angleMarks[key].label,
          marked: Boolean((angleMarks[key] && angleMarks[key].marked) || info.marked),
          right: Boolean((angleMarks[key] && angleMarks[key].right) || info.right)
        };
        if (!angleMarks[key].label && angleMarksTop[key]) {
          angleMarks[key].label = angleMarksTop[key].label;
        }
      }
    });
    const summary = cloneJobForSummary({
      type: 'doubleTri',
      obj: {
        shared: {
          label: sharedLabel,
          value: firstSol.c,
          requested: Boolean(sharedSpec && sharedSpec.requested)
        },
        first: {
          a: firstSol.a,
          b: firstSol.b,
          c: firstSol.c,
          A: firstSol.A,
          B: firstSol.B,
          C: firstSol.C
        },
        second: {
          a: secondSol.a,
          b: secondSol.b,
          c: secondSol.c,
          A: secondSol.A,
          B: secondSol.B,
          D: secondSol.C
        }
      },
      decorations
    });
    if (summary) {
      summary.angleMarks = angleMarks;
    }
    return summary;
  } finally {
    restoreTextScale();
  }
}
function drawQuadToGroup(g, rect, spec, adv, decorations, labelCtx) {
  var _m$a2, _m$b2, _m$c2, _m$d, _am$A2, _am$B2, _am$C2, _am$D;
  const s = typeof spec === 'string' ? parseSpec(spec) : spec;
  let {
    a,
    b,
    c,
    d,
    A: AngA,
    B: AngB,
    C: AngC,
    D: AngD
  } = s;
  if (!(a > 0 && b > 0 && c > 0)) throw new Error("Firkant: må ha a, b, c > 0.");
  const angleKeys = ["A", "B", "C", "D"].filter(k => k in s);
  if (angleKeys.length === 0) throw new Error("Firkant: angi vinkel (minst én).");
  const A0 = {
      x: 0,
      y: 0
    },
    B0 = {
      x: a,
      y: 0
    };
  let C0, D0;
  const pickCCW_D = (C, D1, D2) => {
    const area1 = polygonArea([A0, B0, C, D1]);
    const area2 = polygonArea([A0, B0, C, D2]);
    if (area1 >= 0 && area2 < 0) return D1;
    if (area2 >= 0 && area1 < 0) return D2;
    return area1 >= area2 ? D1 : D2;
  };
  if (angleKeys.length === 1 && d > 0) {
    const angleKey = angleKeys[0];
    if (angleKey === "A") {
      const theta = rad(AngA);
      D0 = {
        x: A0.x + d * Math.cos(theta),
        y: A0.y + d * Math.sin(theta)
      };
      const Cs = circleCircle(B0, b, D0, c);
      if (Cs.length === 0) throw new Error("Firkant (A): ingen løsning – sjekk mål.");
      C0 = Cs.length === 1 ? Cs[0] : polygonArea([A0, B0, Cs[0], D0]) > polygonArea([A0, B0, Cs[1], D0]) ? Cs[0] : Cs[1];
    } else if (angleKey === "B") {
      const theta = Math.PI - rad(AngB);
      C0 = {
        x: B0.x + b * Math.cos(theta),
        y: B0.y + b * Math.sin(theta)
      };
      const Ds = circleCircle(A0, d, C0, c);
      if (Ds.length === 0) throw new Error("Firkant (B): ingen løsning – sjekk mål.");
      D0 = Ds.length === 1 ? Ds[0] : pickCCW_D(C0, Ds[0], Ds[1]);
    } else {
      var _Cs$1$y2, _Cs$2;
      const Cs = circleCircle(A0, b, B0, a);
      if (Cs.length === 0) throw new Error(`Firkant (${angleKey}): ingen løsning – sjekk mål.`);
      C0 = Cs[0].y >= ((_Cs$1$y2 = (_Cs$2 = Cs[1]) === null || _Cs$2 === void 0 ? void 0 : _Cs$2.y) !== null && _Cs$1$y2 !== void 0 ? _Cs$1$y2 : -1e9) ? Cs[0] : Cs[1] || Cs[0];
      const Ds = circleCircle(A0, d, C0, c);
      if (Ds.length === 0) throw new Error(`Firkant (${angleKey}): ingen løsning – sjekk mål.`);
      if (Ds.length === 1) {
        D0 = Ds[0];
      } else {
        if (angleKey === "C") {
          const cand = Ds.map(Dc => ({
            D: Dc,
            ang: angleAt(C0, B0, Dc)
          }));
          cand.sort((u, v) => Math.abs(u.ang - AngC) - Math.abs(v.ang - AngC));
          D0 = cand[0].D;
          if (polygonArea([A0, B0, C0, D0]) < 0) D0 = Ds[0] === D0 ? Ds[1] : Ds[0];
        } else if (angleKey === "D") {
          const cand = Ds.map(Dc => ({
            D: Dc,
            ang: angleAt(Dc, C0, A0)
          }));
          cand.sort((u, v) => Math.abs(u.ang - AngD) - Math.abs(v.ang - AngD));
          D0 = cand[0].D;
          if (polygonArea([A0, B0, C0, D0]) < 0) D0 = Ds[0] === D0 ? Ds[1] : Ds[0];
        } else {
          D0 = pickCCW_D(C0, Ds[0], Ds[1]);
        }
      }
    }
  } else if (angleKeys.length === 2 && !d) {
    if (angleKeys.includes("B") && angleKeys.includes("D")) {
      const thetaB = Math.PI - rad(AngB);
      C0 = {
        x: B0.x + b * Math.cos(thetaB),
        y: B0.y + b * Math.sin(thetaB)
      };
      const AC = dist(A0, C0);
      const cosD = Math.cos(rad(AngD)),
        sinD = Math.sin(rad(AngD));
      const disc = AC * AC - c * sinD * (c * sinD);
      if (disc < 0) throw new Error("Firkant (B&D): ingen løsning – sjekk mål.");
      d = c * cosD + Math.sqrt(disc);
      const Ds = circleCircle(A0, d, C0, c);
      if (Ds.length === 0) throw new Error("Firkant (B&D): ingen løsning – sjekk mål.");
      D0 = Ds.length === 1 ? Ds[0] : pickCCW_D(C0, Ds[0], Ds[1]);
    } else {
      throw new Error("Firkant: to vinkler støttes bare for B og D.");
    }
  } else {
    throw new Error("Firkant: støttes med d+1 vinkel eller to vinkler B og D.");
  }
  const base = [A0, B0, C0, D0];
  const basePointsMap = {
    A: A0,
    B: B0,
    C: C0,
    D: D0
  };
  const semicircleExtents = collectSemicircleExtentPoints(basePointsMap, decorations, ['A', 'B', 'C', 'D']);
  const squareExtents = collectSquareExtentPoints(basePointsMap, decorations, ['A', 'B', 'C', 'D']);
  const extraPts = semicircleExtents.concat(squareExtents);
  const fitPts = extraPts.length ? base.concat(extraPts) : base;
  const {
    T,
    k: renderScale
  } = fitTransformToRect(fitPts, rect.w, rect.h, 46);
  const restoreTextScale = pushTextScale(renderScale);
  try {
    const A = shift(T(A0), rect),
      B = shift(T(B0), rect),
      C = shift(T(C0), rect),
      D = shift(T(D0), rect);
    const poly = [A, B, C, D];
    add(g, "polygon", {
      points: ptsTo(poly),
      fill: STYLE.faceFill,
      stroke: "none"
    });
    const ctr = polygonCentroid(poly);

    // sider
    const m = adv.sides.mode,
      st = adv.sides.text;
    const rotateText = shouldRotateText();
    sideLabelText(g, A, B, buildSideText((_m$a2 = m.a) !== null && _m$a2 !== void 0 ? _m$a2 : m.default, fmt(a), st.a), rotateText, ctr, 18, labelKey(labelCtx, 'quad-side', 'a'));
    sideLabelText(g, B, C, buildSideText((_m$b2 = m.b) !== null && _m$b2 !== void 0 ? _m$b2 : m.default, fmt(b), st.b), rotateText, ctr, 18, labelKey(labelCtx, 'quad-side', 'b'));
    sideLabelText(g, C, D, buildSideText((_m$c2 = m.c) !== null && _m$c2 !== void 0 ? _m$c2 : m.default, fmt(c), st.c), rotateText, ctr, 18, labelKey(labelCtx, 'quad-side', 'c'));
    sideLabelText(g, D, A, buildSideText((_m$d = m.d) !== null && _m$d !== void 0 ? _m$d : m.default, fmt(d), st.d), rotateText, ctr, 18, labelKey(labelCtx, 'quad-side', 'd'));

    // vinkler/punkter
    const am = adv.angles.mode,
      at = adv.angles.text;
    const angleAVal = angleAt(A, D, B);
    const angleBVal = angleAt(B, A, C);
    const angleCVal = angleAt(C, B, D);
    const angleDVal = angleAt(D, C, A);
    const Ares = parseAnglePointMode((_am$A2 = am.A) !== null && _am$A2 !== void 0 ? _am$A2 : am.default, angleAVal, at.A, "A");
    const Bres = parseAnglePointMode((_am$B2 = am.B) !== null && _am$B2 !== void 0 ? _am$B2 : am.default, angleBVal, at.B, "B");
    const Cres = parseAnglePointMode((_am$C2 = am.C) !== null && _am$C2 !== void 0 ? _am$C2 : am.default, angleCVal, at.C, "C");
    const Dres = parseAnglePointMode((_am$D = am.D) !== null && _am$D !== void 0 ? _am$D : am.default, angleDVal, at.D, "D");
    renderAngle(g, A, D, B, angleRadius(A, D, B), {
      mark: Ares.mark,
      angleText: Ares.angleText,
      pointLabel: Ares.pointLabel,
      angleKey: labelKey(labelCtx, 'quad-angle', 'A'),
      pointKey: labelKey(labelCtx, 'quad-point', 'A')
    });
    renderAngle(g, B, A, C, angleRadius(B, A, C), {
      mark: Bres.mark,
      angleText: Bres.angleText,
      pointLabel: Bres.pointLabel,
      angleKey: labelKey(labelCtx, 'quad-angle', 'B'),
      pointKey: labelKey(labelCtx, 'quad-point', 'B')
    });
    renderAngle(g, C, B, D, angleRadius(C, B, D), {
      mark: Cres.mark,
      angleText: Cres.angleText,
      pointLabel: Cres.pointLabel,
      angleKey: labelKey(labelCtx, 'quad-angle', 'C'),
      pointKey: labelKey(labelCtx, 'quad-point', 'C')
    });
    renderAngle(g, D, C, A, angleRadius(D, C, A), {
      mark: Dres.mark,
      angleText: Dres.angleText,
      pointLabel: Dres.pointLabel,
      angleKey: labelKey(labelCtx, 'quad-angle', 'D'),
      pointKey: labelKey(labelCtx, 'quad-point', 'D')
    });
    add(g, "polygon", {
      points: ptsTo(poly),
      fill: "none",
      stroke: STYLE.edgeStroke,
      "stroke-width": STYLE.edgeWidth,
      "stroke-linejoin": "round",
      "stroke-linecap": "round"
    });
    renderDecorations(g, {
      A,
      B,
      C,
      D
    }, decorations, {
      centroid: ctr,
      pointOrder: ['A', 'B', 'C', 'D'],
      labelCtx
    });
    const summary = cloneJobForSummary({
      type: 'quad',
      obj: {
        a,
        b,
        c,
        d,
        A: angleAVal,
        B: angleBVal,
        C: angleCVal,
        D: angleDVal
      },
      decorations
    });
    if (summary) {
      summary.angleMarks = buildAngleMarkSummary([
        ['A', Ares, angleAVal],
        ['B', Bres, angleBVal],
        ['C', Cres, angleCVal],
        ['D', Dres, angleDVal]
      ]);
    }
    return summary;
  } finally {
    restoreTextScale();
  }
}
function drawCircleToGroup(g, rect, spec, labelCtx) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.max(40, Math.min(rect.w, rect.h) / 2 - 50);
  const circleRadius = radius > 0 ? radius : Math.min(rect.w, rect.h) * 0.35;
  const radiusEntry = spec && spec.radius;
  const showRadius = radiusEntry && radiusEntry.requested;
  const radiusText = showRadius ? normalizedDimensionText(radiusEntry, 'r') : '';
  const diameter = spec && spec.diameter;
  const diameterText = diameter ? normalizedDimensionText(diameter, 'd') : '';
  add(g, "circle", {
    cx,
    cy,
    r: circleRadius,
    fill: STYLE.faceFill,
    stroke: "none"
  });
  add(g, "circle", {
    cx,
    cy,
    r: circleRadius,
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth
  });
  const radiusAngle = -Math.PI / 4;
  if (showRadius) {
    const endX = cx + circleRadius * Math.cos(radiusAngle);
    const endY = cy + circleRadius * Math.sin(radiusAngle);
    add(g, "line", {
      x1: cx,
      y1: cy,
      x2: endX,
      y2: endY,
      stroke: STYLE.radiusStroke || STYLE.edgeStroke,
      "stroke-width": STYLE.edgeWidth * 0.75,
      "stroke-linecap": "round"
    });
    add(g, "circle", {
      cx,
      cy,
      r: 6,
      fill: STYLE.radiusStroke || STYLE.edgeStroke
    });
  }
  if (showRadius && radiusText) {
    const midX = cx + circleRadius * Math.cos(radiusAngle) * 0.55;
    const midY = cy + circleRadius * Math.sin(radiusAngle) * 0.55;
    const labelOffset = 16;
    const labelX = midX + Math.cos(radiusAngle + Math.PI / 2) * labelOffset;
    const labelY = midY + Math.sin(radiusAngle + Math.PI / 2) * labelOffset;
    placeAdjustableLabel(g, labelKey(labelCtx, 'circle', 'radius'), labelX, labelY, radiusText, STYLE.sideFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }
  if (diameter && diameter.requested && diameterText) {
    add(g, "line", {
      x1: cx - circleRadius,
      y1: cy,
      x2: cx + circleRadius,
      y2: cy,
      stroke: STYLE.edgeStroke,
      "stroke-width": STYLE.edgeWidth * 0.6,
      "stroke-linecap": "round",
      "stroke-dasharray": "12 10"
    });
    placeAdjustableLabel(g, labelKey(labelCtx, 'circle', 'diameter'), cx, cy - circleRadius * 0.4, diameterText, STYLE.sideFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }
}
function indexToLetter(idx, upperCase) {
  const alphabet = upperCase ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'abcdefghijklmnopqrstuvwxyz';
  const baseLen = alphabet.length;
  let n = Math.max(0, Math.floor(idx));
  let out = '';
  do {
    out = alphabet[n % baseLen] + out;
    n = Math.floor(n / baseLen) - 1;
  } while (n >= 0);
  return out;
}
function normalizeArcSideSpecifier(sideSpec, count) {
  const cappedCount = Math.max(3, Math.floor(count || 0) || 3);
  const defaultLabels = Array.from({
    length: cappedCount
  }, (_, i) => indexToLetter(i, true));
  const tokens = parseArcSideTokens(sideSpec);
  let first = tokens[0] || '';
  let second = tokens[1] || '';
  if (!first) first = defaultLabels[0];
  if (!second) second = defaultLabels[(1) % cappedCount];
  let idxA = defaultLabels.findIndex(label => label === first);
  let idxB = defaultLabels.findIndex(label => label === second);
  if (idxA === -1 && idxB === -1) {
    idxA = 0;
    idxB = 1 % cappedCount;
  } else if (idxA === -1) {
    idxA = (idxB - 1 + cappedCount) % cappedCount;
  } else if (idxB === -1) {
    idxB = (idxA + 1) % cappedCount;
  }
  if ((idxA + 1) % cappedCount === idxB) {
    return {
      startIndex: idxA,
      endIndex: idxB,
      label: `${defaultLabels[idxA]}${defaultLabels[idxB]}`
    };
  }
  if ((idxB + 1) % cappedCount === idxA) {
    return {
      startIndex: idxB,
      endIndex: idxA,
      label: `${defaultLabels[idxB]}${defaultLabels[idxA]}`
    };
  }
  const startIndex = Math.max(0, idxA);
  const endIndex = (startIndex + 1) % cappedCount;
  return {
    startIndex,
    endIndex,
    label: `${defaultLabels[startIndex]}${defaultLabels[endIndex]}`
  };
}
function deriveSequentialLabel(base, index, upperCase) {
  const fallback = indexToLetter(index, upperCase);
  if (!base) return fallback;
  const trimmed = base.trim();
  if (/^[A-Za-z]$/.test(trimmed)) {
    const offset = trimmed.toLowerCase().charCodeAt(0) - 97;
    return indexToLetter(offset + index, upperCase);
  }
  if (upperCase && !/^[A-Za-z]/.test(trimmed)) {
    return fallback;
  }
  if (index === 0) {
    return upperCase ? trimmed.toUpperCase() : trimmed;
  }
  return `${upperCase ? trimmed.toUpperCase() : trimmed}${index + 1}`;
}
function drawRegularPolygonToGroup(g, rect, spec, adv, labelCtx) {
  const countRaw = spec && Number.isFinite(spec.sides) ? spec.sides : 5;
  const count = Math.max(3, Math.round(countRaw));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.max(40, Math.min(rect.w, rect.h) / 2 - 50);
  const polyRadius = radius > 0 ? radius : Math.min(rect.w, rect.h) * 0.35;
  const pts = [];
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const theta = startAngle + i * 2 * Math.PI / count;
    pts.push({
      x: cx + polyRadius * Math.cos(theta),
      y: cy + polyRadius * Math.sin(theta)
    });
  }
  add(g, "polygon", {
    points: ptsTo(pts),
    fill: STYLE.faceFill,
    stroke: "none"
  });
  add(g, "polygon", {
    points: ptsTo(pts),
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth,
    "stroke-linejoin": "round"
  });
  const ctr = polygonCentroid(pts);
  const advSides = adv && adv.sides ? adv.sides : { mode: {}, text: {} };
  const advAngles = adv && adv.angles ? adv.angles : { mode: {}, text: {} };
  const sideValueStr = spec && spec.side && Number.isFinite(spec.side.value) ? fmt(spec.side.value) : '';
  const baseSideLabel = normalizedDimensionText(spec && spec.side, 'a');
  const rotateText = shouldRotateText();
  for (let i = 0; i < count; i++) {
    const P = pts[i];
    const Q = pts[(i + 1) % count];
    const sideKey = indexToLetter(i, false);
    const mode = advSides.mode && advSides.mode[sideKey] ? advSides.mode[sideKey] : advSides.mode && advSides.mode.default;
    const customText = advSides.text && advSides.text[sideKey] ? advSides.text[sideKey] : deriveSequentialLabel(baseSideLabel, i, false);
    let label = buildSideText(mode, sideValueStr, customText);
    if (!label && customText) {
      label = customText;
    }
    if (label) {
      sideLabelText(g, P, Q, label, rotateText, ctr, 20, labelKey(labelCtx, 'polygon-side', sideKey));
    }
  }
  for (let i = 0; i < count; i++) {
    const prev = pts[(i - 1 + count) % count];
    const cur = pts[i];
    const next = pts[(i + 1) % count];
    const angleKey = indexToLetter(i, true);
    const mode = advAngles.mode && advAngles.mode[angleKey] ? advAngles.mode[angleKey] : advAngles.mode && advAngles.mode.default;
    if (!mode || String(mode).toLowerCase() === 'none') continue;
    const customText = advAngles.text && advAngles.text[angleKey] ? advAngles.text[angleKey] : deriveSequentialLabel(baseSideLabel, i, true);
    const angleVal = angleAt(cur, prev, next);
    const parsed = parseAnglePointMode(mode, angleVal, customText, angleKey);
    renderAngle(g, cur, prev, next, angleRadius(cur, prev, next), {
      mark: parsed.mark,
      angleText: parsed.angleText,
      pointLabel: parsed.pointLabel,
      angleKey: labelKey(labelCtx, 'polygon-angle', angleKey),
      pointKey: labelKey(labelCtx, 'polygon-point', angleKey)
    });
  }
  // Previously the number of sides was annotated in the centre of the polygon
  // (e.g. "n=10"). This visual label is no longer desired, so we omit it.
}
function drawPolygonWithArcToGroup(g, rect, spec, adv, decorations, labelCtx) {
  const polygonSpec = spec && spec.polygon ? spec.polygon : {};
  const countRaw = polygonSpec && Number.isFinite(polygonSpec.sides) ? polygonSpec.sides : 5;
  const count = Math.max(3, Math.round(countRaw));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const radius = Math.max(40, Math.min(rect.w, rect.h) / 2 - 50);
  const polyRadius = radius > 0 ? radius : Math.min(rect.w, rect.h) * 0.35;
  const pts = [];
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < count; i++) {
    const theta = startAngle + i * 2 * Math.PI / count;
    pts.push({
      x: cx + polyRadius * Math.cos(theta),
      y: cy + polyRadius * Math.sin(theta)
    });
  }
  add(g, "polygon", {
    points: ptsTo(pts),
    fill: STYLE.faceFill,
    stroke: "none"
  });
  add(g, "polygon", {
    points: ptsTo(pts),
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth,
    "stroke-linejoin": "round"
  });
  const ctr = polygonCentroid(pts);
  const advSides = adv && adv.sides ? adv.sides : { mode: {}, text: {} };
  const advAngles = adv && adv.angles ? adv.angles : { mode: {}, text: {} };
  const sideValueStr = polygonSpec && polygonSpec.side && Number.isFinite(polygonSpec.side.value) ? fmt(polygonSpec.side.value) : '';
  const baseSideLabel = normalizedDimensionText(polygonSpec && polygonSpec.side, 'a');
  for (let i = 0; i < count; i++) {
    const P = pts[i];
    const Q = pts[(i + 1) % count];
    const sideKey = indexToLetter(i, false);
    const mode = advSides.mode && advSides.mode[sideKey] ? advSides.mode[sideKey] : advSides.mode && advSides.mode.default;
    const customText = advSides.text && advSides.text[sideKey] ? advSides.text[sideKey] : deriveSequentialLabel(baseSideLabel, i, false);
    let label = buildSideText(mode, sideValueStr, customText);
    if (!label && customText) {
      label = customText;
    }
    if (label) {
      sideLabelText(g, P, Q, label, rotateText, ctr, 20, labelKey(labelCtx, 'polygon-side', sideKey));
    }
  }
  for (let i = 0; i < count; i++) {
    const prev = pts[(i - 1 + count) % count];
    const cur = pts[i];
    const next = pts[(i + 1) % count];
    const angleKey = indexToLetter(i, true);
    const mode = advAngles.mode && advAngles.mode[angleKey] ? advAngles.mode[angleKey] : advAngles.mode && advAngles.mode.default;
    if (!mode || String(mode).toLowerCase() === 'none') continue;
    const customText = advAngles.text && advAngles.text[angleKey] ? advAngles.text[angleKey] : deriveSequentialLabel(baseSideLabel, i, true);
    const angleVal = angleAt(cur, prev, next);
    const parsed = parseAnglePointMode(mode, angleVal, customText, angleKey);
    renderAngle(g, cur, prev, next, angleRadius(cur, prev, next), {
      mark: parsed.mark,
      angleText: parsed.angleText,
      pointLabel: parsed.pointLabel,
      angleKey: labelKey(labelCtx, 'polygon-angle', angleKey),
      pointKey: labelKey(labelCtx, 'polygon-point', angleKey)
    });
  }
  const resolvedSide = normalizeArcSideSpecifier(spec && spec.side, count);
  const startIndex = resolvedSide.startIndex;
  const endIndex = resolvedSide.endIndex;
  const P = pts[startIndex];
  const Q = pts[endIndex];
  const chordVec = {
    x: Q.x - P.x,
    y: Q.y - P.y
  };
  const chordLen = Math.hypot(chordVec.x, chordVec.y) || 1;
  const center = {
    x: (P.x + Q.x) / 2,
    y: (P.y + Q.y) / 2
  };
  let normal = {
    x: chordVec.y / chordLen,
    y: -chordVec.x / chordLen
  };
  const interiorSign = (Q.x - P.x) * (ctr.y - P.y) - (Q.y - P.y) * (ctr.x - P.x);
  if (interiorSign < 0) {
    normal.x *= -1;
    normal.y *= -1;
  }
  const arcRadius = chordLen / 2;
  const midArc = {
    x: center.x + normal.x * arcRadius,
    y: center.y + normal.y * arcRadius
  };
  const cross = (Q.x - P.x) * (midArc.y - P.y) - (Q.y - P.y) * (midArc.x - P.x);
  const sweep = cross < 0 ? 1 : 0;
  add(g, "path", {
    d: `M ${P.x} ${P.y} A ${arcRadius} ${arcRadius} 0 0 ${sweep} ${Q.x} ${Q.y}`,
    fill: "none",
    stroke: STYLE.edgeStroke,
    "stroke-width": STYLE.edgeWidth,
    "stroke-linecap": "round"
  });
  const radiusEntry = spec && spec.radius;
  const showRadius = radiusEntry && radiusEntry.requested;
  const diameterEntry = spec && spec.diameter;
  const radiusText = showRadius ? normalizedDimensionText(radiusEntry, 'r') : '';
  const diameterText = diameterEntry ? normalizedDimensionText(diameterEntry, 'd') : '';
  if (showRadius) {
    add(g, "line", {
      x1: center.x,
      y1: center.y,
      x2: midArc.x,
      y2: midArc.y,
      stroke: STYLE.edgeStroke,
      "stroke-width": STYLE.edgeWidth * 0.75,
      "stroke-linecap": "round"
    });
    add(g, "circle", {
      cx: center.x,
      cy: center.y,
      r: 6,
      fill: STYLE.edgeStroke
    });
  }
  if (showRadius && radiusText) {
    const labelPoint = {
      x: center.x + normal.x * arcRadius * 0.55,
      y: center.y + normal.y * arcRadius * 0.55
    };
    placeAdjustableLabel(g, labelKey(labelCtx, 'polygon-arc', `${resolvedSide.label || 'arc'}-radius`), labelPoint.x, labelPoint.y, radiusText, STYLE.sideFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }
  if (diameterEntry && diameterEntry.requested && diameterText) {
    const inward = {
      x: -normal.x,
      y: -normal.y
    };
    const diameterPoint = {
      x: center.x + inward.x * Math.min(arcRadius * 0.6, 40),
      y: center.y + inward.y * Math.min(arcRadius * 0.6, 40)
    };
    placeAdjustableLabel(g, labelKey(labelCtx, 'polygon-arc', `${resolvedSide.label || 'arc'}-diameter`), diameterPoint.x, diameterPoint.y, diameterText, STYLE.sideFS, {
      "text-anchor": "middle",
      "dominant-baseline": "middle"
    });
  }
  const pointsMap = {};
  const pointOrder = [];
  for (let i = 0; i < count; i++) {
    const label = indexToLetter(i, true);
    pointOrder.push(label);
    pointsMap[label] = pts[i];
  }
  if (decorations && decorations.length) {
    renderDecorations(g, pointsMap, decorations, {
      centroid: ctr,
      pointOrder,
      labelCtx
    });
  }
}

/* ---------- ORKESTRERING ---------- */
const BASE_W = 900,
  BASE_H = 560,
  GAP = 60,
  TIGHT_VIEWBOX_MARGIN = 24;
async function collectJobsFromSpecs(specInput) {
  const lines = Array.isArray(specInput)
    ? specInput.map(line => (line == null ? "" : String(line)))
    : String(specInput || "").split(/\n/);
  const jobs = [];
  const jobFigureIndexes = [];
  const newLines = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const raw = lines[idx];
    const line = raw.trim();
    if (!line) {
      newLines.push("");
      continue;
    }
    const { core, extras, normalizedExtras } = extractDecorations(line);
    const baseLine = core || '';
    const doubleTri = parseDoubleTriangleSpecLine(baseLine);
    if (doubleTri) {
      const job = doubleTri.job ? { ...doubleTri.job } : null;
      if (job && doubleTri.allowDecorations && extras.length) {
        job.decorations = extras.map(dec => ({ ...dec }));
      } else if (job) {
        job.decorations = doubleTri.allowDecorations ? extras.map(dec => ({ ...dec })) : [];
      }
      if (job) {
        jobs.push(job);
        jobFigureIndexes.push(idx);
      }
      const normalized = combineNormalizedText(doubleTri.normalized || baseLine, normalizedExtras);
      newLines.push(normalized || (doubleTri.normalized || line));
      continue;
    }
    const special = parseShapeSpec(baseLine);
    if (special) {
      const job = special.job ? { ...special.job } : null;
      if (job && special.allowDecorations && extras.length) {
        job.decorations = extras.map(dec => ({ ...dec }));
      }
      if (job) {
        jobs.push(job);
        jobFigureIndexes.push(idx);
      }
      const normalized = combineNormalizedText(special.normalized || baseLine, normalizedExtras);
      newLines.push(normalized || (special.normalized || line));
      continue;
    }
    const obj = await parseSpecAI(baseLine);
    if (Object.keys(obj).length === 0) {
      newLines.push(line);
      continue;
    }
    const squareOverride = reinterpretSquareFromRightAngles(obj);
    if (squareOverride) {
      const normalizedBase = squareOverride.normalized || objToSpec(squareOverride.obj);
      const normalized = combineNormalizedText(normalizedBase, normalizedExtras);
      jobs.push({
        type: "quad",
        obj: squareOverride.obj,
        decorations: extras
      });
      newLines.push(normalized || normalizedBase);
      continue;
    }
    const hint = getSpecShapeHint(obj);
    const isQuadFromHint = hint && hint.type === 'quad';
    const isQuad = isQuadFromHint || "d" in obj || "D" in obj;
    let finalObj = obj;
    if (isQuad) {
      const working = cloneSpecWithHint(finalObj);
      if (isQuadFromHint) {
        const syncOpposites = (keyA, keyB) => {
          const valA = Number.isFinite(working[keyA]) ? working[keyA] : null;
          const valB = Number.isFinite(working[keyB]) ? working[keyB] : null;
          if (valA != null && valB == null) {
            working[keyB] = valA;
          } else if (valB != null && valA == null) {
            working[keyA] = valB;
          }
        };
        syncOpposites('a', 'c');
        syncOpposites('b', 'd');
      }
      finalObj = working;
      const hasAngle = ["A", "B", "C", "D"].some(key => Number.isFinite(finalObj[key]));
      if (!hasAngle) {
        const augmented = cloneSpecWithHint(finalObj);
        augmented.A = 90;
        finalObj = augmented;
      }
    }
    let normalizedBase = objToSpec(finalObj);
    jobs.push({
      type: isQuad ? "quad" : "tri",
      obj: finalObj,
      decorations: extras
    });
    jobFigureIndexes.push(idx);
    const normalized = combineNormalizedText(normalizedBase, normalizedExtras);
    newLines.push(normalized || normalizedBase);
  }
  return { jobs, normalizedSpecs: newLines, figureIndexes: jobFigureIndexes };
}
function adjustSvgViewBoxToContent(svg, margin = TIGHT_VIEWBOX_MARGIN) {
  if (!svg || typeof svg.querySelectorAll !== 'function') return;
  const elements = Array.from(svg.querySelectorAll('*')).filter(el => el.tagName !== 'defs' && typeof el.getBBox === 'function');
  if (elements.length === 0) return;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    try {
      const bbox = el.getBBox();
      if (!bbox) continue;
      const { x, y, width, height } = bbox;
      if (![x, y, width, height].every(Number.isFinite)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    } catch (err) {
      // Ignorer elementer som ikke kan gi bounding box (for eksempel definisjoner).
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return;
  }
  const maxStroke = Math.max(
    Number.isFinite(STYLE.edgeWidth) ? STYLE.edgeWidth : 0,
    Number.isFinite(STYLE.angWidth) ? STYLE.angWidth : 0,
    Number.isFinite(STYLE.constructionWidth) ? STYLE.constructionWidth : 0
  );
  const pad = Math.max(0, margin) + maxStroke / 2;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const finalWidth = width + pad * 2;
  const finalHeight = height + pad * 2;
  const finalX = minX - pad;
  const finalY = minY - pad;
  svg.setAttribute('viewBox', `${finalX} ${finalY} ${finalWidth} ${finalHeight}`);
}

/* ---------- FIGURE RESIZE HELPERS ---------- */
let pendingFigureSizeUpdate = false;
function scheduleResponsiveFigureSizeUpdate() {
  if (pendingFigureSizeUpdate || typeof window === "undefined") return;
  pendingFigureSizeUpdate = true;
  window.requestAnimationFrame(() => {
    pendingFigureSizeUpdate = false;
    updateResponsiveFigureSize();
  });
}
function updateResponsiveFigureSize() {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  const figure = document.querySelector(".card .figure");
  if (!root || !figure) return;
  const card = figure.closest(".card");
  const figureRect = figure.getBoundingClientRect();
  const figureStyles = window.getComputedStyle(figure);
  const figurePaddingX = (parseFloat(figureStyles.paddingLeft) || 0) + (parseFloat(figureStyles.paddingRight) || 0);
  const figurePaddingY = (parseFloat(figureStyles.paddingTop) || 0) + (parseFloat(figureStyles.paddingBottom) || 0);
  const bodyStyles = window.getComputedStyle(document.body);
  const bodyPaddingBottom = parseFloat(bodyStyles.paddingBottom) || 0;
  const cardStyles = card ? window.getComputedStyle(card) : null;
  const cardPaddingBottom = cardStyles ? parseFloat(cardStyles.paddingBottom) || 0 : 0;
  const extraSpacing = bodyPaddingBottom + cardPaddingBottom + 16;
  const availableHeight = Math.max(0, window.innerHeight - figureRect.top - extraSpacing - figurePaddingY);
  const availableWidth = Math.max(
    0,
    Math.min(figureRect.width, window.innerWidth - figureRect.left) - figurePaddingX
  );
  root.style.setProperty("--figure-available-height", `${availableHeight}px`);
  root.style.setProperty("--figure-available-width", `${availableWidth}px`);
}
function initResponsiveFigureSizing() {
  if (typeof window === "undefined") return;
  const figure = document.querySelector(".card .figure");
  if (!figure) return;
  if (!initResponsiveFigureSizing.boundResize) {
    window.addEventListener("resize", scheduleResponsiveFigureSizeUpdate, {
      passive: true
    });
    window.addEventListener("orientationchange", scheduleResponsiveFigureSizeUpdate, {
      passive: true
    });
    initResponsiveFigureSizing.boundResize = true;
  }
  if (typeof ResizeObserver !== "undefined") {
    if (initResponsiveFigureSizing.observer) {
      initResponsiveFigureSizing.observer.disconnect();
    }
    const observer = new ResizeObserver(() => scheduleResponsiveFigureSizeUpdate());
    observer.observe(figure);
    const card = figure.closest(".card");
    if (card) observer.observe(card);
    const layout = figure.closest(".layout--sidebar");
    if (layout) observer.observe(layout);
    const side = document.querySelector(".layout--sidebar .side");
    if (side) observer.observe(side);
    if (document.body) observer.observe(document.body);
    initResponsiveFigureSizing.observer = observer;
  }
  scheduleResponsiveFigureSizeUpdate();
}

const EXPORT_BASE_SIZE = 800;

function getNormalizedExportDimensions(svgEl) {
  const vb = svgEl && svgEl.viewBox ? svgEl.viewBox.baseVal : null;
  const width = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || EXPORT_BASE_SIZE;
  const height = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || EXPORT_BASE_SIZE;
  const maxDim = Math.max(width, height, 1);
  const scale = EXPORT_BASE_SIZE / maxDim;
  const normalizedWidth = width * scale;
  const normalizedHeight = height * scale;
  return {
    width: EXPORT_BASE_SIZE,
    height: EXPORT_BASE_SIZE,
    offsetX: (EXPORT_BASE_SIZE - normalizedWidth) / 2,
    offsetY: (EXPORT_BASE_SIZE - normalizedHeight) / 2,
    scale
  };
}

function normalizeFontSizesForExport(clone, scale) {
  if (!clone || !Number.isFinite(scale) || scale === 1) return;
  const normalizeSize = node => {
    const attr = node.getAttribute('font-size');
    let size = attr && attr.trim() ? parseFloat(attr) : NaN;
    if (!Number.isFinite(size) && typeof window !== 'undefined' && typeof getComputedStyle === 'function') {
      size = parseFloat(getComputedStyle(node).fontSize);
    }
    if (Number.isFinite(size) && size > 0) {
      node.setAttribute('font-size', `${size / scale}px`);
    }
  };
  clone.querySelectorAll('text, tspan').forEach(normalizeSize);
}

function normalizeSvgForExport(clone, dims) {
  if (!clone || !dims) return;
  const doc = clone.ownerDocument || (typeof document !== 'undefined' ? document : null);
  const wrapper = doc ? doc.createElementNS('http://www.w3.org/2000/svg', 'g') : null;
  if (wrapper) {
    wrapper.setAttribute('transform', `translate(${dims.offsetX} ${dims.offsetY}) scale(${dims.scale})`);
    while (clone.firstChild) {
      wrapper.appendChild(clone.firstChild);
    }
    clone.appendChild(wrapper);
  }
  if (doc) {
    const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', String(dims.width));
    rect.setAttribute('height', String(dims.height));
    rect.setAttribute('fill', '#ffffff');
    clone.insertBefore(rect, clone.firstChild);
  }
  clone.setAttribute('width', String(dims.width));
  clone.setAttribute('height', String(dims.height));
  clone.setAttribute('viewBox', `0 0 ${dims.width} ${dims.height}`);
}
function svgToString(svgEl) {
  if (!svgEl) return '';
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
  if (!clone) return '';
  const exportDims = getNormalizedExportDimensions(svgEl);
  const removeSelector = '[data-ignore-export="true"], .label-rotation-handle';
  const removable = clone.querySelectorAll(removeSelector);
  removable.forEach(el => el.remove());
  const selectedLabels = clone.querySelectorAll('.label-selected');
  selectedLabels.forEach(el => el.classList.remove('label-selected'));
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
  normalizeSvgForExport(clone, exportDims);
  normalizeFontSizesForExport(clone, exportDims.scale);
  if (!clone.getAttribute('xmlns')) {
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  }
  if (!clone.getAttribute('xmlns:xlink')) {
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}
function formatNkantCount(count, singular, plural) {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}
function buildNkantExportMeta(summary) {
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  if (!summary || !Array.isArray(summary.jobs) || summary.jobs.length === 0) {
    const slug = helper && typeof helper.slugify === 'function' ? helper.slugify('nkant tom', 'nkant') : 'nkant-tom';
    return {
      description: 'N-kant uten figurer.',
      slug,
      defaultBaseName: 'nkant'
    };
  }
  const counts = summary.jobs.reduce((acc, job) => {
    const type = job && typeof job.type === 'string' ? job.type : 'figur';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const typeLabels = {
    tri: ['trekant', 'trekanter'],
    quad: ['firkant', 'firkanter'],
    doubleTri: ['dobbelt-trekant', 'dobbelt-trekanter'],
    polygon: ['polygon', 'polygoner'],
    polygonArc: ['polygon med bue', 'polygoner med bue'],
    circle: ['sirkel', 'sirkler'],
    figur: ['figur', 'figurer']
  };
  const parts = Object.entries(counts).map(([type, count]) => {
    const labels = typeLabels[type] || typeLabels.figur;
    return formatNkantCount(count, labels[0], labels[1]);
  });
  const layoutText = summary.layoutMode === 'col' ? 'kolonner' : summary.layoutMode === 'grid' ? 'rutenett' : 'rader';
  const description = `N-kant med ${parts.join(', ')} i ${layoutText}.`;
  const slugBaseParts = ['nkant', summary.layoutMode === 'col' ? 'kol' : summary.layoutMode === 'grid' ? 'grid' : 'rad'];
  Object.entries(counts).forEach(([type, count]) => {
    slugBaseParts.push(`${count}${type}`);
  });
  const slugBase = slugBaseParts.join(' ');
  const slug = helper && typeof helper.slugify === 'function' ? helper.slugify(slugBase, 'nkant') : slugBaseParts.join('-').toLowerCase();
  return {
    description,
    slug,
    defaultBaseName: slug || 'nkant'
  };
}

function createCleanNKantSaveState() {
  ensureStateDefaults();
  const defaults = getGlobalDefaults();
  const baseDefaults = (DEFAULT_STATE && DEFAULT_STATE.defaults) || DEFAULT_GLOBAL_DEFAULTS;
  const opt = {};

  const normalizedTextSize = sanitizeTextSize(STATE.textSize);
  const defaultTextSize = sanitizeTextSize(DEFAULT_STATE && DEFAULT_STATE.textSize);
  if (normalizedTextSize !== defaultTextSize) {
    opt.textSize = normalizedTextSize;
  }

  const rotateText = shouldRotateText();
  const defaultRotate = DEFAULT_STATE && DEFAULT_STATE.rotateText === false ? false : true;
  if (rotateText !== defaultRotate) {
    opt.rotateText = rotateText;
  }

  const normalizedColorSetIndex = sanitizeColorSetIndex(STATE.colorSetIndex);
  const defaultColorSetIndex = sanitizeColorSetIndex(DEFAULT_STATE && DEFAULT_STATE.colorSetIndex);
  if (normalizedColorSetIndex !== defaultColorSetIndex) {
    opt.colorSet = normalizedColorSetIndex;
  }

  const defaultsDiff = {};
  if (defaults.sides && defaults.sides !== baseDefaults.sides) {
    defaultsDiff.sides = defaults.sides;
  }
  if (defaults.angles && defaults.angles !== baseDefaults.angles) {
    defaultsDiff.angles = defaults.angles;
  }
  if (Object.keys(defaultsDiff).length) {
    opt.defaults = defaultsDiff;
  }

  if (STATE.layout && STATE.layout !== DEFAULT_STATE.layout) {
    opt.layout = STATE.layout;
  }

  const cleanedLabelAdjustments = {};
  if (STATE.labelAdjustments && typeof STATE.labelAdjustments === 'object') {
    Object.entries(STATE.labelAdjustments).forEach(([key, adjustment]) => {
      if (!adjustment || typeof adjustment !== 'object') return;
      const dx = Number.isFinite(adjustment.dx) ? adjustment.dx : undefined;
      const dy = Number.isFinite(adjustment.dy) ? adjustment.dy : undefined;
      const rotation = Number.isFinite(adjustment.rotation) ? adjustment.rotation : undefined;
      const cleaned = {};
      if (dx !== undefined) cleaned.dx = dx;
      if (dy !== undefined) cleaned.dy = dy;
      if (rotation !== undefined) cleaned.rotation = rotation;
      if (Object.keys(cleaned).length) {
        cleanedLabelAdjustments[key] = cleaned;
      }
    });
    if (Object.keys(cleanedLabelAdjustments).length) {
      opt.labels = cleanedLabelAdjustments;
    }
  }

  const figureCount = Array.isArray(STATE.figures) ? STATE.figures.length : 0;
  const figures = Array.isArray(STATE.figures) ? STATE.figures.map((fig, idx) => {
    const baseFig = createDefaultFigureState(idx, '', defaults, STATE.colorSetIndex);
    const entry = {
      spec: fig && typeof fig.specText === 'string' ? fig.specText : ''
    };

    if (fig && typeof fig.color === 'string' && fig.color.trim()) {
      entry.color = fig.color.trim();
    }
    const figColorSetIndex = getFigureColorSetIndex(fig);
    if (figColorSetIndex !== sanitizeColorSetIndex(baseFig.colorSetIndex)) {
      entry.colorSet = figColorSetIndex;
    }

    const labelOverrides = {};
    const sideModeDiff = {};
    const sideTextDiff = {};
    if (fig && fig.sides) {
      ['a', 'b', 'c', 'd'].forEach(key => {
        const mode = fig.sides[key];
        const baseMode = baseFig.sides[key];
        if (mode && mode !== baseMode) {
          sideModeDiff[key] = mode;
        }
        const textKey = `${key}Text`;
        const text = fig.sides[textKey];
        const baseText = baseFig.sides[textKey];
        if (typeof text === 'string' && text !== baseText) {
          sideTextDiff[textKey] = text;
        }
      });
    }
    if (Object.keys(sideModeDiff).length || Object.keys(sideTextDiff).length) {
      labelOverrides.sides = {};
      if (Object.keys(sideModeDiff).length) {
        labelOverrides.sides.mode = sideModeDiff;
      }
      if (Object.keys(sideTextDiff).length) {
        labelOverrides.sides.text = sideTextDiff;
      }
    }

    const angleModeDiff = {};
    const angleTextDiff = {};
    if (fig && fig.angles) {
      ['A', 'B', 'C', 'D'].forEach(key => {
        const mode = fig.angles[key];
        const baseMode = baseFig.angles[key];
        if (mode && mode !== baseMode) {
          angleModeDiff[key] = mode;
        }
        const textKey = `${key}Text`;
        const text = fig.angles[textKey];
        const baseText = baseFig.angles[textKey];
        if (typeof text === 'string' && text !== baseText) {
          angleTextDiff[textKey] = text;
        }
      });
    }
    if (Object.keys(angleModeDiff).length || Object.keys(angleTextDiff).length) {
      labelOverrides.angles = {};
      if (Object.keys(angleModeDiff).length) {
        labelOverrides.angles.mode = angleModeDiff;
      }
      if (Object.keys(angleTextDiff).length) {
        labelOverrides.angles.text = angleTextDiff;
      }
    }

    if (Object.keys(labelOverrides).length) {
      entry.labels = labelOverrides;
    }

    const anchor = fig && (fig.anchor != null ? fig.anchor : fig.position);
    if (anchor != null) {
      entry.anchor = anchor;
    } else {
      const layout = STATE.layout || DEFAULT_STATE.layout || 'grid';
      if (layout === 'row') {
        entry.anchor = { row: 0, col: idx };
      } else if (layout === 'col') {
        entry.anchor = { row: idx, col: 0 };
      } else {
        const columns = Math.min(2, Math.max(1, figureCount === 1 ? 1 : 2));
        const col = idx % columns;
        const row = Math.floor(idx / columns);
        entry.anchor = { row, col };
      }
    }

    return entry;
  }) : [];

  const view = getNkantAltSummary();
  const desc = {
    text: getActiveNkantAltText(),
    source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
  };

  return {
    v: 1,
    view,
    opt,
    figures,
    desc
  };
}

function loadCleanNKantState(rawState) {
  if (!rawState || typeof rawState !== "object") return false;

  const isV1Schema = rawState.v === 1;
  const looksLikeLegacyState = !rawState.v && (rawState.figures || rawState.specsText);

  if (!isV1Schema && !looksLikeLegacyState) {
    return false;
  }

  const nextState = JSON.parse(JSON.stringify(DEFAULT_STATE));

  if (isV1Schema) {
    const opt = rawState.opt && typeof rawState.opt === "object" ? rawState.opt : {};
    nextState.textSize = sanitizeTextSize(opt.textSize);
    if (typeof opt.rotateText === "boolean") {
      nextState.rotateText = opt.rotateText;
    }
    if (opt.colorSet != null) {
      nextState.colorSetIndex = sanitizeColorSetIndex(remapLegacyColorSetIndex(opt.colorSet));
    }
    if (opt.defaults && typeof opt.defaults === "object") {
      nextState.defaults = {
        ...nextState.defaults,
        ...opt.defaults
      };
    }
    if (opt.layout && typeof opt.layout === "string") {
      nextState.layout = opt.layout;
    }
    if (opt.labels && typeof opt.labels === "object") {
      nextState.labelAdjustments = { ...opt.labels };
    }

    const defaults = getGlobalDefaults();
    const figures = Array.isArray(rawState.figures) ? rawState.figures.slice(0, 4) : [];
    nextState.figures = figures.map((entry, idx) => {
      const base = createDefaultFigureState(idx, "", defaults, nextState.colorSetIndex);
      const fig = { ...base };
      const spec = entry && typeof entry.spec === "string" ? entry.spec : "";
      fig.specText = spec;

      if (entry && typeof entry.color === "string" && entry.color.trim()) {
        fig.color = entry.color.trim();
      }
      if (entry && entry.colorSet != null) {
        fig.colorSetIndex = sanitizeColorSetIndex(remapLegacyColorSetIndex(entry.colorSet));
      }

      const labels = entry && entry.labels && typeof entry.labels === "object" ? entry.labels : null;
      if (labels && labels.sides && typeof labels.sides === "object") {
        const { mode, text } = labels.sides;
        if (mode && typeof mode === "object") {
          ["a", "b", "c", "d"].forEach(key => {
            if (typeof mode[key] === "string") {
              fig.sides[key] = mode[key];
            }
          });
        }
        if (text && typeof text === "object") {
          ["a", "b", "c", "d"].forEach(key => {
            const tKey = `${key}Text`;
            if (typeof text[tKey] === "string") {
              fig.sides[tKey] = text[tKey];
            }
          });
        }
      }

      if (labels && labels.angles && typeof labels.angles === "object") {
        const { mode, text } = labels.angles;
        if (mode && typeof mode === "object") {
          ["A", "B", "C", "D"].forEach(key => {
            if (typeof mode[key] === "string") {
              fig.angles[key] = mode[key];
            }
          });
        }
        if (text && typeof text === "object") {
          ["A", "B", "C", "D"].forEach(key => {
            const tKey = `${key}Text`;
            if (typeof text[tKey] === "string") {
              fig.angles[tKey] = text[tKey];
            }
          });
        }
      }

      if (entry && entry.anchor != null) {
        fig.anchor = entry.anchor;
      }

      return fig;
    });

    const desc = rawState.desc && typeof rawState.desc === "object" ? rawState.desc : {};
    if (typeof desc.text === "string") {
      nextState.altText = desc.text;
      nextState.altTextSource = desc.source === "manual" ? "manual" : "auto";
    }

    nextState.specsText = nextState.figures.map(fig => fig && typeof fig.specText === "string" ? fig.specText : "").join("\n");
  } else if (looksLikeLegacyState) {
    Object.assign(nextState, rawState);
  }

  Object.assign(STATE, nextState);
  ensureStateDefaults();
  return true;
}
async function downloadSVG(svgEl, filename) {
  const suggestedName = typeof filename === 'string' && filename ? filename : 'nkant.svg';
  const data = svgToString(svgEl);
  const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
  const meta = buildNkantExportMeta(lastRenderSummary);
  const htmlTarget = document.querySelector('.card .figure') || document.querySelector('.figure') || svgEl;
  if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
    await helper.exportGraphicWithArchiveWithFallback({
      svgElement: svgEl,
      htmlTarget,
      suggestedName,
      toolId: 'nkant',
      svgString: data,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: lastRenderSummary
    });
    return;
  }
  if (helper && typeof helper.exportSvgWithArchive === 'function') {
    await helper.exportSvgWithArchive(svgEl, suggestedName, 'nkant', {
      svgString: data,
      description: meta.description,
      slug: meta.slug,
      defaultBaseName: meta.defaultBaseName,
      summary: lastRenderSummary
    });
    return;
  }
  const blob = new Blob([data], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedName.endsWith(".svg") ? suggestedName : suggestedName + ".svg";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- PNG-EKSPORT ---------- */
async function waitForDocumentFonts(doc) {
  if (!doc) return;
  const fontSet = doc.fonts;
  if (fontSet) {
    if (fontSet.ready && typeof fontSet.ready.then === "function") {
      try {
        await fontSet.ready;
        return;
      } catch (error) {}
    }
    if (typeof fontSet.load === "function") {
      const fontFamilies = ["Inter", "Segoe UI", "system-ui", "sans-serif"];
      const fontSpecs = [];
      fontFamilies.forEach(family => {
        const quoted = family.includes(" ") ? `"${family}"` : family;
        fontSpecs.push(`16px ${quoted}`);
        fontSpecs.push(`600 28px ${quoted}`);
        fontSpecs.push(`700 34px ${quoted}`);
      });
      const requests = fontSpecs.map(spec => {
        try {
          return fontSet.load(spec);
        } catch (error) {
          return Promise.resolve();
        }
      });
      try {
        await Promise.all(requests.map(promise => Promise.resolve(promise).catch(() => null)));
        return;
      } catch (error) {}
    }
  }
  await new Promise(resolve => setTimeout(resolve, 50));
}

async function downloadPNG(svgEl, filename, scale = 2, bg = "#fff") {
  // hent dimensjoner fra viewBox
  const exportDims = getNormalizedExportDimensions(svgEl);
  const w = exportDims.width;
  const h = exportDims.height;

  // gjør SVG om til data-URL
  const svgData = svgToString(svgEl);
  const blob = new Blob([svgData], {
    type: "image/svg+xml;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = "async";
  if ("crossOrigin" in img) {
    img.crossOrigin = "anonymous";
  }
  const doc = svgEl && svgEl.ownerDocument ? svgEl.ownerDocument : typeof document !== "undefined" ? document : null;
  await waitForDocumentFonts(doc);
  try {
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Kunne ikke laste SVG for PNG-eksport"));
      img.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  const canvas = document.createElement("canvas");
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
  const ctx = canvas.getContext("2d");
  // hvit bakgrunn
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // tegn svg inn
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  canvas.toBlob(pngBlob => {
    if (!pngBlob) return;
    const urlPng = URL.createObjectURL(pngBlob);
    const a = document.createElement("a");
    a.href = urlPng;
    a.download = filename.endsWith(".png") ? filename : filename + ".png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
  }, "image/png");
}

/* bygg adv fra STATE (sider + vinkler/punkter) */
function buildAdvForFig(figState) {
  const defaults = getGlobalDefaults();
  const sidesMode = {
    default: figState.sides.default || defaults.sides
  };
  ["a", "b", "c", "d"].forEach(k => {
    const mode = figState.sides[k];
    if (mode && mode !== "inherit") sidesMode[k] = mode;
  });
  const sidesText = {
    a: figState.sides.aText,
    b: figState.sides.bText,
    c: figState.sides.cText,
    d: figState.sides.dText
  };
  const angMode = {
    default: figState.angles.default || defaults.angles
  };
  ["A", "B", "C", "D"].forEach(k => {
    const mode = figState.angles[k];
    if (mode && mode !== "inherit") angMode[k] = mode;
  });
  const angText = {
    A: figState.angles.AText,
    B: figState.angles.BText,
    C: figState.angles.CText,
    D: figState.angles.DText
  };
  return {
    sides: {
      mode: sidesMode,
      text: sidesText
    },
    angles: {
      mode: angMode,
      text: angText
    }
  };
}
async function renderCombined() {
  applyTextSizePreference(STATE.textSize);
  const palette = nkantPaletteCache.length ? nkantPaletteCache : resolveNkantPalette();
  applyNkantColorSetToStyle(STATE.colorSetIndex, palette);
  const svg = document.getElementById("paper");
  svg.innerHTML = "";
  resetRenderedLabelMap();
  const specList = Array.isArray(STATE.figures) ? STATE.figures.map(fig => (fig && fig.specText) || "") : [];
  const { jobs, normalizedSpecs, figureIndexes } = await collectJobsFromSpecs(specList);
  if (Array.isArray(normalizedSpecs) && normalizedSpecs.length) {
    normalizedSpecs.forEach((val, idx) => {
      if (STATE.figures[idx]) {
        STATE.figures[idx].specText = val;
      }
    });
    syncSpecsTextFromFigures();
    applyFigureSpecsToUI();
  }
  const jobEntries = jobs.map((job, idx) => ({
    job,
    figureIndex: Array.isArray(figureIndexes) && Number.isInteger(figureIndexes[idx]) ? figureIndexes[idx] : idx
  }));
  const n = jobEntries.length;
  if (n === 0) {
    svg.setAttribute("viewBox", `0 0 ${BASE_W} ${BASE_H}`);
    add(svg, "text", {
      x: 20,
      y: 40,
      fill: "#6b7280",
      "font-size": 18
    }).textContent = "Skriv én linje per figur for å tegne.";
    svg.setAttribute("aria-label", "");
    lastRenderSummary = {
      layoutMode: STATE.layout || 'row',
      count: 0,
      jobs: []
    };
    syncLabelEditorAfterRender();
    maybeRefreshAltText('config');
    scheduleResponsiveFigureSizeUpdate();
    return;
  }
  const cols = Math.min(2, Math.max(1, n === 1 ? 1 : 2));
  const rows = Math.max(1, Math.ceil(n / cols));
  const totalW = cols * BASE_W + Math.max(0, cols - 1) * GAP;
  const totalH = rows * BASE_H + Math.max(0, rows - 1) * GAP;
  svg.setAttribute("viewBox", `0 0 ${totalW} ${totalH}`);
  const groups = Array.from({
    length: n
  }, () => add(svg, "g", {}));
  const rects = groups.map((_, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    return {
      x: col * (BASE_W + GAP),
      y: row * (BASE_H + GAP),
      w: BASE_W,
      h: BASE_H
    };
  });
  const summaries = [];
  for (let i = 0; i < n; i++) {
    const {
      type,
      obj
    } = jobEntries[i].job;
    const figState = STATE.figures[jobEntries[i].figureIndex]
      || createDefaultFigureState(jobEntries[i].figureIndex, "", STATE.defaults, STATE.colorSetIndex);
    applyNkantColorSetToStyle(getFigureColorSetIndex(figState), palette);
    const adv = buildAdvForFig(figState);
    const labelCtx = { prefix: `fig${i + 1}` };
    let summaryEntry = null;
    try {
      if (type === "tri") {
        summaryEntry = drawTriangleToGroup(groups[i], rects[i], obj, adv, jobEntries[i].job.decorations, labelCtx);
      } else if (type === "quad") {
        summaryEntry = drawQuadToGroup(groups[i], rects[i], obj, adv, jobEntries[i].job.decorations, labelCtx);
      } else if (type === "doubleTri") {
        summaryEntry = drawDoubleTriangleToGroup(groups[i], rects[i], obj, adv, jobEntries[i].job.decorations, labelCtx);
      } else if (type === "circle") {
        drawCircleToGroup(groups[i], rects[i], obj, labelCtx);
      } else if (type === "polygon") {
        drawRegularPolygonToGroup(groups[i], rects[i], obj, adv, labelCtx);
      } else if (type === "polygonArc") {
        drawPolygonWithArcToGroup(groups[i], rects[i], obj, adv, jobEntries[i].job.decorations, labelCtx);
      } else {
        throw new Error(`Ukjent figurtype: ${type}`);
      }
    } catch (e) {
      errorBox(groups[i], rects[i], String(e.message || e));
    }
    if (!summaryEntry) summaryEntry = cloneJobForSummary(jobEntries[i].job);
    if (summaryEntry) summaries.push(summaryEntry);
  }
  lastRenderSummary = {
    layoutMode: 'grid',
    count: n,
    jobs: summaries
  };
  applyNkantColorSetToStyle(STATE.colorSetIndex, palette);
  syncLabelEditorAfterRender();
  maybeRefreshAltText('config');
  adjustSvgViewBoxToContent(svg);
  svg.setAttribute("aria-label", n === 1 ? "Én figur" : `${n} figurer i et 2x2-rutenett`);
  scheduleResponsiveFigureSizeUpdate();
}

/* ---------- UI BIND ---------- */
function bindUI() {
  ensureStateDefaults();
  const $ = sel => document.querySelector(sel);
  const textSizeSelect = $("#textSizeSelect");
  const btnSvg = $("#btnSvg");
  const btnPng = $("#btnPng");
  const btnDraw = $("#btnDraw");
  const addFigureBtn = $("#btnAddFigure");
  const figureListEl = $("#figureList");
  const globalDefaultSidesWrap = $("#globalDefaultSidesWrap");
  const globalDefaultAnglesWrap = $("#globalDefaultAnglesWrap");
  rotateTextSelect = $("#rotateTextSelect");
  btnToggleLabelEdit = $("#btnToggleLabelEdit");
  labelEditorSectionEl = document.querySelector('.label-editor');
  labelEditorControlsEl = $("#labelEditorControls");
  labelEditorActiveEl = $("#labelEditorActive");
  labelEditorListEl = $("#labelEditorList");
  labelEditorRotationRowEl = document.querySelector('.label-editor__rotation');
  labelRotationNumberInput = $("#labelRotationNumber");
  btnResetLabel = $("#btnResetLabelPosition");
  btnResetAllLabels = $("#btnResetAllLabels");

  const sideDefaults = [
    { value: "value", label: "Tall" },
    { value: "none", label: "Ingen" },
    { value: "custom", label: "Egenvalgt" }
  ];
  const sideOptions = [
    { value: "inherit", label: "Arver" },
    { value: "none", label: "Ingen" },
    { value: "value", label: "Tall" },
    { value: "custom", label: "Egenvalgt" }
  ];
  const angleDefaults = [
    { value: "custom+mark+value", label: "Egenvalgt + markering + tall" },
    { value: "custom+mark", label: "Egenvalgt + markering" },
    { value: "custom", label: "Egenvalgt" },
    { value: "mark+value", label: "Markering + tall" },
    { value: "mark", label: "Markering" },
    { value: "none", label: "Ingen" }
  ];
  const angleOptions = [
    { value: "inherit", label: "Arver" },
    { value: "none", label: "Ingen" },
    { value: "mark", label: "Markering" },
    { value: "mark+value", label: "Markering + tall" },
    { value: "custom", label: "Egenvalgt" },
    { value: "custom+mark", label: "Egenvalgt + markering" },
    { value: "custom+mark+value", label: "Egenvalgt + markering + tall" }
  ];

  function createSelect(options, value, ariaLabel) {
    const sel = document.createElement("select");
    if (ariaLabel) sel.setAttribute("aria-label", ariaLabel);
    options.forEach(opt => {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      sel.appendChild(optionEl);
    });
    sel.value = value;
    return sel;
  }

  const getDefaultSidesMode = () => getGlobalDefaults().sides;
  const getDefaultAnglesMode = () => getGlobalDefaults().angles;

  let globalSideDefaultSel = null;
  let globalAngleDefaultSel = null;
  function renderGlobalDefaults() {
    if (!globalDefaultSidesWrap || !globalDefaultAnglesWrap) return;
    globalDefaultSidesWrap.innerHTML = "";
    globalDefaultAnglesWrap.innerHTML = "";
    const defaults = getGlobalDefaults();

    const sideLabel = document.createElement("label");
    sideLabel.setAttribute("for", "globalDefaultSides");
    sideLabel.textContent = "Standard sider";
      globalSideDefaultSel = createSelect(sideDefaults, defaults.sides, "Standard sider for alle figurer");
      globalSideDefaultSel.id = "globalDefaultSides";
      globalSideDefaultSel.addEventListener("change", () => {
        updateState(state => {
          state.defaults.sides = globalSideDefaultSel.value;
          state.figures.forEach(fig => {
            if (fig && fig.sides) {
              fig.sides.default = state.defaults.sides;
            }
          });
        }, { onUpdate: renderFigureForms });
      });
      globalDefaultSidesWrap.appendChild(sideLabel);
      globalDefaultSidesWrap.appendChild(globalSideDefaultSel);

    const angleLabel = document.createElement("label");
    angleLabel.setAttribute("for", "globalDefaultAngles");
    angleLabel.textContent = "Standard vinkler/markeringer";
      globalAngleDefaultSel = createSelect(angleDefaults, defaults.angles, "Standard vinkler/markeringer for alle figurer");
      globalAngleDefaultSel.id = "globalDefaultAngles";
      globalAngleDefaultSel.addEventListener("change", () => {
        updateState(state => {
          state.defaults.angles = globalAngleDefaultSel.value;
          state.figures.forEach(fig => {
            if (fig && fig.angles) {
              fig.angles.default = state.defaults.angles;
            }
          });
        }, { onUpdate: renderFigureForms });
      });
      globalDefaultAnglesWrap.appendChild(angleLabel);
      globalDefaultAnglesWrap.appendChild(globalAngleDefaultSel);
  }

  function syncGlobalDefaultsUI() {
    if (globalSideDefaultSel) {
      globalSideDefaultSel.value = getDefaultSidesMode();
    }
    if (globalAngleDefaultSel) {
      globalAngleDefaultSel.value = getDefaultAnglesMode();
    }
  }

  function renderFigureForms() {
    if (!figureListEl) return;
    figureListEl.innerHTML = "";
    STATE.figures.forEach((fig, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = "figure-config";
      const header = document.createElement("div");
      header.className = "figure-config__header";
      const legend = document.createElement("div");
      legend.className = "legend";
      legend.textContent = `Figur ${idx + 1}`;
      header.appendChild(legend);
        if (idx > 0) {
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "btn btn--ghost figure-config__remove";
          removeBtn.textContent = "Fjern";
          removeBtn.addEventListener("click", () => {
            updateState(state => {
              state.figures.splice(idx, 1);
              syncSpecsTextFromFigures();
            }, { onUpdate: renderFigureForms });
          });
          header.appendChild(removeBtn);
        }
      wrapper.appendChild(header);

      const specLabel = document.createElement("label");
      specLabel.textContent = "Skriv spesifikasjon eller fritekst";
      wrapper.appendChild(specLabel);

      const specRow = document.createElement("div");
      specRow.className = "specs-row";
      const specInput = document.createElement("input");
      specInput.type = "text";
      specInput.spellcheck = false;
      specInput.value = fig.specText || "";
      specInput.addEventListener("input", () => {
        fig.specText = specInput.value;
        syncSpecsTextFromFigures();
      });
      specInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          updateState(() => {
            fig.specText = specInput.value;
            syncSpecsTextFromFigures();
          });
        }
      });
      specInput.addEventListener("blur", () => {
        updateState(() => {
          fig.specText = specInput.value;
          syncSpecsTextFromFigures();
        });
      });
      specRow.appendChild(specInput);
      wrapper.appendChild(specRow);

      const colorRow = document.createElement("div");
      colorRow.className = "figure-config__colors";
      const colorLabel = document.createElement("label");
      colorLabel.textContent = "Farger (Fyll, linje og vinkel)";
      colorRow.appendChild(colorLabel);

      const colorPicker = document.createElement("div");
      colorPicker.className = "fill-color-picker";
      colorPicker.dataset.nkantColorPicker = "figure";
      colorPicker.dataset.figureIndex = String(idx);
      const swatchBtn = document.createElement("button");
      swatchBtn.type = "button";
      swatchBtn.className = "color-swatch color-swatch--active color-swatch--triple";
      swatchBtn.setAttribute("aria-label", `Velg fargesett for figur ${idx + 1}`);
      swatchBtn.setAttribute("aria-haspopup", "true");
      swatchBtn.setAttribute("aria-expanded", "false");
      const optionsPanel = document.createElement("div");
      optionsPanel.className = "color-options";
      optionsPanel.hidden = true;
      colorPicker.appendChild(swatchBtn);
      colorPicker.appendChild(optionsPanel);
      colorRow.appendChild(colorPicker);

      const palette = nkantPaletteCache.length ? nkantPaletteCache : resolveNkantPalette();
      const colorSetIndex = getFigureColorSetIndex(fig);
      colorPicker.dataset.colorSetIndex = String(colorSetIndex);
      renderNkantColorPicker(
        colorPicker,
        palette,
        () => getFigureColorSetIndex(fig),
        nextIndex => {
          updateState(state => {
            if (state.figures[idx]) {
              state.figures[idx].colorSetIndex = nextIndex;
            }
            state.colorSetIndex = nextIndex;
          });
          colorPicker.dataset.colorSetIndex = String(nextIndex);
        }
      );
      wrapper.appendChild(colorRow);

      const rows = document.createElement("div");
      rows.className = "form-row";
      ["a", "b", "c", "d"].forEach(letter => {
        const row = document.createElement("div");
        row.className = "grid-3";
        const txt = document.createElement("input");
        txt.className = "tight";
        txt.type = "text";
        txt.placeholder = letter;
        txt.value = fig.sides[`${letter}Text`] || letter;
        const sel = createSelect(sideOptions, fig.sides[letter] || "inherit", `Standard for side ${letter.toUpperCase()}`);
        const toggle = () => {
          const fallback = getDefaultSidesMode();
          const mode = sel.value === "inherit" ? fallback : sel.value;
          txt.disabled = !String(mode).includes("custom");
        };
        toggle();
        sel.addEventListener("change", () => {
          toggle();
          updateState(() => {
            fig.sides[letter] = sel.value;
          });
        });
        txt.addEventListener("input", () => {
          updateState(() => {
            fig.sides[`${letter}Text`] = txt.value;
          });
        });
        row.appendChild(txt);
        row.appendChild(sel);
        rows.appendChild(row);
      });
      wrapper.appendChild(rows);

      const angleRows = document.createElement("div");
      angleRows.className = "form-row";
      ["A", "B", "C", "D"].forEach(letter => {
        const row = document.createElement("div");
        row.className = "grid-3";
        const txt = document.createElement("input");
        txt.className = "tight";
        txt.type = "text";
        txt.placeholder = letter;
        txt.value = fig.angles[`${letter}Text`] || letter;
        const sel = createSelect(angleOptions, fig.angles[letter] || "inherit", `Standard for markering ${letter}`);
        const toggle = () => {
          const fallback = getDefaultAnglesMode();
          const raw = sel.value === "inherit" ? fallback : sel.value;
          const normalized = String(raw);
          txt.disabled = !(normalized.startsWith("custom") || normalized.startsWith("egenvalgt"));
        };
        toggle();
        sel.addEventListener("change", () => {
          toggle();
          updateState(() => {
            fig.angles[letter] = sel.value;
          });
        });
        txt.addEventListener("input", () => {
          updateState(() => {
            fig.angles[`${letter}Text`] = txt.value;
          });
        });
        row.appendChild(txt);
        row.appendChild(sel);
        angleRows.appendChild(row);
      });
      wrapper.appendChild(angleRows);
      figureListEl.appendChild(wrapper);
    });
    if (addFigureBtn) {
      addFigureBtn.disabled = STATE.figures.length >= 4;
    }
  }

  renderGlobalDefaults();
  syncGlobalDefaultsUI();
  syncGlobalDefaultsToUI = syncGlobalDefaultsUI;
  applyFigureSpecsToUI = renderFigureForms;
    renderFigureForms();
    if (textSizeSelect) {
      const normalized = sanitizeTextSize(STATE.textSize);
      STATE.textSize = normalized;
      textSizeSelect.value = normalized;
      textSizeSelect.addEventListener('change', () => {
        const nextSize = sanitizeTextSize(textSizeSelect.value);
        textSizeSelect.value = nextSize;
        updateState(state => {
          state.textSize = nextSize;
        }, { onUpdate: () => applyTextSizePreference(nextSize) });
      });
    }

    if (rotateTextSelect) {
      rotateTextSelect.value = STATE.rotateText === false ? 'no-rotate' : 'rotate';
      rotateTextSelect.addEventListener('change', () => {
        updateState(state => {
          state.rotateText = rotateTextSelect.value === 'rotate';
        });
      });
    }

    if (addFigureBtn) {
      addFigureBtn.addEventListener("click", () => {
        if (STATE.figures.length >= 4) return;
        updateState(state => {
          const newFig = createDefaultFigureState(state.figures.length, "", state.defaults, state.colorSetIndex);
          state.figures.push(newFig);
          syncSpecsTextFromFigures();
        }, { onUpdate: renderFigureForms });
      });
    }
    if (btnDraw) {
      btnDraw.addEventListener("click", async () => {
        resetAllLabelRotations();
        await renderCombined();
      });
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

    function getSuggestedFilename() {
      const sanitize = getFilenameSanitizer('Geometri');
      const specs = typeof STATE.specsText === 'string' ? STATE.specsText : '';
      const lines = specs.split('\n').filter(l => l.trim());

      if (lines.length > 0) {
        const firstLine = lines[0];
        const typeMatch = firstLine.match(/([a-zA-ZæøåÆØÅ]+)/);
        const type = typeMatch ? typeMatch[1] : 'Figur';
        const numbers = firstLine.match(/(\d+)/g);
        const nums = numbers ? numbers.slice(0, 3).join('-') : '';
        const base = nums ? `${type}_${nums}` : type;

        return sanitize(base);
      }

      return sanitize('Geometri');
    }

    const handleAppModeChange = event => {
      const mode = event && event.detail && typeof event.detail.mode === 'string' ? event.detail.mode : getCurrentAppMode();
      syncBodyAppMode(mode);
      syncLabelEditingAvailability();
    };
    window.addEventListener('math-visuals:app-mode-changed', handleAppModeChange);
    if (btnSvg) {
      btnSvg.addEventListener("click", async () => {
        await renderCombined();
        const svg = document.getElementById("paper");
        const filename = `${getSuggestedFilename()}.svg`;
        downloadSVG(svg, filename);
      });
    }
    if (btnPng) {
      btnPng.addEventListener("click", async () => {
        await renderCombined();
        const svg = document.getElementById("paper");
        const filename = `${getSuggestedFilename()}.png`;
        await downloadPNG(svg, filename, 2); // 2× oppløsning
      });
    }
  const handleRotationChange = value => {
    if (labelEditorSyncingRotation) return;
    if (!LABEL_EDITOR_STATE.enabled || !LABEL_EDITOR_STATE.selectedKey) return;
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    setLabelAdjustment(LABEL_EDITOR_STATE.selectedKey, { rotation: num });
    syncRotationInputs(num);
  };
  if (btnToggleLabelEdit) {
    btnToggleLabelEdit.addEventListener("click", () => {
      setLabelEditingEnabled(!LABEL_EDITOR_STATE.enabled);
    });
  }
  if (labelEditorListEl) {
    labelEditorListEl.addEventListener('change', () => {
      const key = labelEditorListEl.value;
      if (key) {
        selectLabel(key);
        const entry = getRenderedLabelEntry(key);
        if (entry && entry.element && typeof entry.element.focus === 'function') {
          entry.element.focus();
        }
      }
    });
    labelEditorListEl.addEventListener('keydown', evt => {
      if (evt.key === 'Tab' && LABEL_EDITOR_STATE.enabled && renderedLabelMap.size) {
        const keys = Array.from(renderedLabelMap.keys());
        const currentIndex = keys.indexOf(LABEL_EDITOR_STATE.selectedKey);
        const delta = evt.shiftKey ? -1 : 1;
        const nextIndex = ((currentIndex >= 0 ? currentIndex : 0) + delta + keys.length) % keys.length;
        const nextKey = keys[nextIndex];
        selectLabel(nextKey);
        labelEditorListEl.value = nextKey;
        evt.preventDefault();
      }
    });
  }
  if (labelRotationNumberInput) {
    labelRotationNumberInput.addEventListener("input", () => handleRotationChange(labelRotationNumberInput.value));
  }
  if (btnResetLabel) {
    btnResetLabel.addEventListener("click", resetSelectedLabelAdjustment);
  }
  if (btnResetAllLabels) {
    btnResetAllLabels.addEventListener("click", resetAllLabelAdjustments);
  }
  initLabelEditorInteractions();
  updateLabelEditorUI();
}

/* ---------- INIT ---------- */
  window.addEventListener("DOMContentLoaded", async () => {
    bindUI();
    initResponsiveFigureSizing();
    initAltTextManager();
    applyTextSizePreference(STATE.textSize);
  syncLabelEditingAvailability();
  setupNkantThemeSync();
});

  const handleExamplesLoaded = event => {
    const candidateState = event && event.detail && typeof event.detail === "object" && event.detail.state
      ? event.detail.state
      : (typeof STATE_V2 !== "undefined" && STATE_V2 ? STATE_V2 : STATE);
    if (candidateState) {
      if (typeof window !== "undefined") {
        window.STATE_V2 = candidateState;
        window.STATE = candidateState;
      }
    }
    applyExamplesConfig();
    if (!altTextManager) {
      initAltTextManager();
    }
    if (altTextManager) {
      altTextManager.applyCurrent();
      maybeRefreshAltText("examples");
    }
  };

  const handleExamplesCollect = event => {
    const cleanState = createCleanNKantSaveState();
    if (event && event.detail && typeof event.detail === 'object') {
      event.detail.state = cleanState;
    }
    if (typeof window !== 'undefined') {
      window.STATE_V2 = cleanState;
      window.STATE = cleanState;
    }
    if (altTextManager) {
      altTextManager.applyCurrent();
    }
  };
function applyStateToUI() {
  ensureStateDefaults();
  const textSizeSelect = document.querySelector('#textSizeSelect');
  if (textSizeSelect) {
    const normalized = sanitizeTextSize(STATE.textSize);
    STATE.textSize = normalized;
    textSizeSelect.value = normalized;
  }
  applyTextSizePreference(STATE.textSize);
  if (rotateTextSelect) {
    rotateTextSelect.value = STATE.rotateText === false ? 'no-rotate' : 'rotate';
  }
  if (typeof syncGlobalDefaultsToUI === 'function') {
    syncGlobalDefaultsToUI();
  }
  if (typeof applyFigureSpecsToUI === 'function') {
    applyFigureSpecsToUI();
  }
  const palette = nkantPaletteCache.length ? nkantPaletteCache : resolveNkantPalette();
  document.querySelectorAll('[data-nkant-color-picker]').forEach(element => {
    const figIndex = Number.parseInt(element.dataset.figureIndex, 10);
    const fig = Number.isFinite(figIndex) ? STATE.figures[figIndex] : null;
    const index = fig ? getFigureColorSetIndex(fig) : sanitizeColorSetIndex(element.dataset.colorSetIndex || STATE.colorSetIndex);
    element.dataset.colorSetIndex = String(index);
    updateNkantColorPickerSelection(element, palette, index);
  });
  updateLabelEditorUI();
}
function applyExamplesConfig() {
  if (!loadCleanNKantState(typeof STATE_V2 !== "undefined" && STATE_V2 ? STATE_V2 : STATE)) {
    ensureStateDefaults();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyExamplesConfig, {
      once: true
    });
    return;
  }
  applyStateToUI();
  renderCombined();
}
/* ---------- GEOMETRI ---------- */
function buildRightAngleVariants(input) {
  const EPS = 1e-6;
  const isPos = v => typeof v === "number" && isFinite(v) && v > 0;
  const isRight = ang => typeof ang === "number" && isFinite(ang) && Math.abs(ang - 90) < 1e-3;
  const variants = [];
  const push = mut => {
    const clone = {
      ...input
    };
    mut(clone);
    variants.push(clone);
  };
  const handle = (angVal, oppKey, legKey1, legKey2) => {
    if (!isRight(angVal)) return;
    const oppVal = input[oppKey];
    const leg1 = input[legKey1];
    const leg2 = input[legKey2];
    const suspicious = isPos(oppVal) && (isPos(leg1) && oppVal <= leg1 + EPS || isPos(leg2) && oppVal <= leg2 + EPS);
    if (suspicious) {
      push(clone => {
        delete clone[oppKey];
      });
    }
    if (isPos(oppVal)) {
      if (!isPos(leg1)) {
        push(clone => {
          clone[legKey1] = oppVal;
          delete clone[oppKey];
        });
      }
      if (!isPos(leg2)) {
        push(clone => {
          clone[legKey2] = oppVal;
          delete clone[oppKey];
        });
      }
    }
  };
  handle(input.A, "a", "b", "c");
  handle(input.B, "b", "c", "a");
  handle(input.C, "c", "a", "b");
  return variants;
}
function solveTriangle(g) {
  const lawCosSide = (ang, s1, s2) => Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - 2 * s1 * s2 * Math.cos(rad(ang))));
  const lawCosAng = (opp, s1, s2) => deg(Math.acos(clampCos((s1 * s1 + s2 * s2 - opp * opp) / (2 * s1 * s2))));
  const lawSinAng = (A0, a0, sx) => deg(Math.asin(clamp(sx * Math.sin(rad(A0)) / a0, -1, 1)));
  const lawSinSide = (A0, a0, Ax) => a0 * Math.sin(rad(Ax)) / Math.sin(rad(A0));
  const attempt = spec => {
    let {
      a,
      b,
      c,
      A,
      B,
      C
    } = spec;
    if (A && B && !C) C = 180 - A - B;
    if (A && C && !B) B = 180 - A - C;
    if (B && C && !A) A = 180 - B - C;
    if (A && b && c && !a) {
      a = lawCosSide(A, b, c);
    }
    if (B && a && c && !b) {
      b = lawCosSide(B, a, c);
    }
    if (C && a && b && !c) {
      c = lawCosSide(C, a, b);
    }
    if (a && b && c) {
      if (!A) A = lawCosAng(a, b, c);
      if (!B) B = lawCosAng(b, a, c);
      if (!C) C = 180 - A - B;
    }
    const fillBySines = () => {
      if (A && B && a && (!b || !c)) {
        b = b || lawSinSide(A, a, B);
        c = c || lawSinSide(A, a, 180 - A - B);
      }
      if (A && C && a && (!b || !c)) {
        b = b || lawSinSide(A, a, 180 - A - C);
        c = c || lawSinSide(A, a, C);
      }
      if (B && C && b && (!a || !c)) {
        a = a || lawSinSide(B, b, 180 - B - C);
        c = c || lawSinSide(B, b, C);
      }
      if (A && B && c && (!a || !b)) {
        a = a || lawSinSide(180 - A - B, c, A);
        b = b || lawSinSide(180 - A - B, c, B);
      }
    };
    fillBySines();
    const solveSSA = () => {
      if (A && a && b && !B) {
        const B1 = lawSinAng(A, a, b);
        if (isFinite(B1)) {
          B = B || B1;
          C = C || 180 - A - B;
          c = c || lawSinSide(A, a, C);
        }
      }
      if (A && a && c && !C) {
        const C1 = lawSinAng(A, a, c);
        if (isFinite(C1)) {
          C = C || C1;
          B = B || 180 - A - C;
          b = b || lawSinSide(A, a, B);
        }
      }
      if (B && b && a && !A) {
        const A1 = lawSinAng(B, b, a);
        if (isFinite(A1)) {
          A = A || A1;
          C = C || 180 - A - B;
          c = c || lawSinSide(B, b, C);
        }
      }
      if (B && b && c && !C) {
        const C1 = lawSinAng(B, b, c);
        if (isFinite(C1)) {
          C = C || C1;
          A = A || 180 - B - C;
          a = a || lawSinSide(B, b, A);
        }
      }
      if (C && c && a && !A) {
        const A1 = lawSinAng(C, c, a);
        if (isFinite(A1)) {
          A = A || A1;
          B = B || 180 - A - C;
          b = b || lawSinSide(C, c, B);
        }
      }
      if (C && c && b && !B) {
        const B1 = lawSinAng(C, c, b);
        if (isFinite(B1)) {
          B = B || B1;
          A = A || 180 - B - C;
          a = a || lawSinSide(C, c, A);
        }
      }
    };
    solveSSA();
    if (a > 0 && b > 0 && c > 0 && A > 0 && B > 0 && C > 0) return {
      a,
      b,
      c,
      A,
      B,
      C
    };
    return null;
  };
  const direct = attempt(g);
  if (direct) return direct;
  const variants = buildRightAngleVariants(g);
  for (const variant of variants) {
    const solved = attempt(variant);
    if (solved) return solved;
  }
  throw new Error("Trekant-spesifikasjonen er ikke tilstrekkelig eller er ugyldig.");
}
function circleCircle(A, r, B, s) {
  const dx = B.x - A.x,
    dy = B.y - A.y,
    d = Math.hypot(dx, dy);
  if (d === 0 || d > r + s || d < Math.abs(r - s)) return [];
  const a = (r * r - s * s + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r * r - a * a));
  const xm = A.x + a * dx / d,
    ym = A.y + a * dy / d;
  const rx = -dy * (h / d),
    ry = dx * (h / d);
  return [{
    x: xm + rx,
    y: ym + ry
  }, {
    x: xm - rx,
    y: ym - ry
  }];
}

// --- PATCH START: Clean JSON API ---
if (typeof window !== "undefined") {
  window.applyConfig = applyExamplesConfig;
  window.applyState = applyExamplesConfig;
  window.render = applyExamplesConfig;
  window.renderCombined = renderCombined;
  window.createCleanNKantSaveState = createCleanNKantSaveState;
  window.loadCleanNKantState = loadCleanNKantState;

  // Eksponer API for examples.js
  window.nkantApi = {
    // LAGRE: Lag en ren tilstands-objekt
    createCleanState: () => {
      return createCleanNKantSaveState();
    },

    // LASTE: Ta imot clean state og gjenopprett
    loadCleanState: (json) => {
      const success = loadCleanNKantState(json);
      if (success && typeof renderCombined === 'function') {
        renderCombined();
      }
      return success;
    },

    // Hooks for events
    onExampleLoaded: (detail) => {
      if (typeof handleExamplesLoaded === 'function') {
        handleExamplesLoaded({ detail });
      }
    },
    onExampleCollect: (detail) => {
      if (typeof handleExamplesCollect === 'function') {
        handleExamplesCollect({ detail });
      } else if (detail && !detail.state) {
        detail.state = createCleanNKantSaveState();
      }
    }
  };

  // Registrer som aktivt verktøy for mathVisuals rammeverket
  if (!window.mathVisuals) window.mathVisuals = {};
  window.mathVisuals.activeTool = window.nkantApi;
}
// --- PATCH SLUTT ---
