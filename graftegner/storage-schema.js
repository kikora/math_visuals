'use strict';

const STORAGE_SCHEMA_V2 = {
  version: 2,
  defaults: {
    options: {
      grid: true,
      axisNumbers: true,
      showNames: true,
      showExpression: false,
      lockAspect: true,
      axisLabels: {
        x: 'x',
        y: 'y'
      }
    }
  }
};
const CANVAS_HEIGHT_LIMITS = { min: 240, max: 800 };

function normalizeNumber(value) {
  const num = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeCanvasHeight(value) {
  const num = normalizeNumber(value);
  if (num == null) return null;
  const clamped = Math.min(CANVAS_HEIGHT_LIMITS.max, Math.max(CANVAS_HEIGHT_LIMITS.min, num));
  return Math.round(clamped);
}

function normalizeViewArray(view) {
  if (!Array.isArray(view) || view.length < 4) return null;
  const values = view.slice(0, 4).map(normalizeNumber);
  if (values.some(entry => entry == null)) return null;
  return values;
}

function normalizeAxisLabels(labels = {}, defaults) {
  if (!labels || typeof labels !== 'object') return null;
  const base = defaults && defaults.axisLabels && typeof defaults.axisLabels === 'object'
    ? defaults.axisLabels
    : STORAGE_SCHEMA_V2.defaults.options.axisLabels;
  const normalized = {};
  if (typeof labels.x === 'string' && labels.x.trim() && labels.x !== base.x) {
    normalized.x = labels.x;
  }
  if (typeof labels.y === 'string' && labels.y.trim() && labels.y !== base.y) {
    normalized.y = labels.y;
  }
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeDiffOptions(adv, defaults = STORAGE_SCHEMA_V2.defaults.options) {
  const diff = {};
  const currentGrid = !!(adv && adv.axis && adv.axis.grid && adv.axis.grid.show);
  const defaultGrid = !!(defaults && defaults.grid);
  if (currentGrid !== defaultGrid) {
    diff.grid = currentGrid;
  }

  const currentNumbers = !!(adv && adv.axis && adv.axis.ticks && adv.axis.ticks.showNumbers);
  const defaultNumbers = !!(defaults && defaults.axisNumbers);
  if (currentNumbers !== defaultNumbers) {
    diff.axisNumbers = currentNumbers;
  }

  const currentShowNames = !!(adv && adv.curveName && adv.curveName.showName);
  const defaultShowNames = !!(defaults && defaults.showNames);
  if (currentShowNames !== defaultShowNames) {
    diff.showNames = currentShowNames;
  }

  const currentShowExpression = !!(adv && adv.curveName && adv.curveName.showExpression);
  const defaultShowExpression = !!(defaults && defaults.showExpression);
  if (currentShowExpression !== defaultShowExpression) {
    diff.showExpression = currentShowExpression;
  }

  const currentLock = adv && adv.lockAspect === false ? false : true;
  const defaultLock = defaults && defaults.lockAspect === false ? false : true;
  if (currentLock !== defaultLock) {
    diff.lockAspect = currentLock;
  }

  const labelsDiff = normalizeAxisLabels(adv && adv.axis && adv.axis.labels, defaults);
  if (labelsDiff) {
    diff.axisLabels = labelsDiff;
  }

  return diff;
}

function migrateToStorageV2(snapshot = {}) {
  const state = snapshot && typeof snapshot === 'object' ? snapshot.state || snapshot.STATE || {} : {};
  const adv = snapshot.adv || snapshot.ADV || {};
  const defaults = snapshot.defaults || STORAGE_SCHEMA_V2.defaults.options;
  const codeCandidates = [
    snapshot.code,
    snapshot.appState && snapshot.appState.simple && snapshot.appState.simple.value,
    state && state.code
  ];
  const code = codeCandidates.find(value => typeof value === 'string') || '';
  const view = normalizeViewArray(adv && adv.screen || snapshot.view || state.view) || null;
  const options = normalizeDiffOptions(adv, defaults);
  const meta = snapshot.meta && typeof snapshot.meta === 'object' ? { ...snapshot.meta } : {};
  const canvasHeight = normalizeCanvasHeight(snapshot.canvasHeight || meta.canvasHeight);

  const migrated = {
    v: STORAGE_SCHEMA_V2.version,
    code,
    view,
    options,
    meta
  };
  if (canvasHeight != null) {
    migrated.canvasHeight = canvasHeight;
  }
  return migrated;
}

module.exports = {
  STORAGE_SCHEMA_V2,
  migrateToStorageV2,
  normalizeAxisLabels,
  normalizeDiffOptions,
  normalizeViewArray
};
