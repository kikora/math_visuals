import { createAppHost } from './packages/core/dist/index.js';
import tallinjeApp from './apps/tallinje/app.js';

const globalScope = typeof window !== 'undefined' ? window : undefined;
const documentRef = globalScope ? globalScope.document : undefined;

function cloneDeep(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getThemeApi() {
  return globalScope && globalScope.MathVisualsTheme && typeof globalScope.MathVisualsTheme === 'object'
    ? globalScope.MathVisualsTheme
    : null;
}

function getPaletteApi() {
  if (!globalScope || typeof globalScope !== 'object') return null;
  if (globalScope.MathVisualsPalette && typeof globalScope.MathVisualsPalette === 'object') {
    return globalScope.MathVisualsPalette;
  }
  const theme = getThemeApi();
  if (theme && theme.palette && typeof theme.palette === 'object') {
    return theme.palette;
  }
  return null;
}

function getActivePaletteProject() {
  const resolver = globalScope && globalScope.MathVisualsPaletteProjectResolver;
  if (resolver && typeof resolver.resolvePaletteProject === 'function') {
    try {
      const project = resolver.resolvePaletteProject({ document: documentRef, theme: getThemeApi() });
      if (typeof project === 'string' && project.trim()) {
        return project.trim();
      }
    } catch (_) {}
  }

  if (documentRef && documentRef.documentElement && documentRef.documentElement.dataset) {
    const dataset = documentRef.documentElement.dataset;
    const direct = typeof dataset.mvActiveProject === 'string' && dataset.mvActiveProject.trim()
      ? dataset.mvActiveProject.trim()
      : null;
    if (direct) return direct;
  }

  return null;
}

function getPaletteSnapshot() {
  const paletteApi = getPaletteApi();
  const project = getActivePaletteProject();
  const groupId = 'tallinje';
  let palette = null;

  if (paletteApi && typeof paletteApi.getGroupPalette === 'function') {
    try {
      const result = paletteApi.getGroupPalette(groupId, { project });
      if (Array.isArray(result)) {
        palette = result.slice();
      }
    } catch (_) {}
  }

  return { project: project || null, groupId, palette: palette || null };
}

function getThemeSnapshot() {
  const themeApi = getThemeApi();
  if (!themeApi || typeof themeApi.getActiveProfileName !== 'function') return null;
  const profile = themeApi.getActiveProfileName();
  if (typeof profile === 'string' && profile.trim()) {
    return { profile: profile.trim() };
  }
  return null;
}

function getCurrentMode() {
  if (!documentRef || !documentRef.body || !documentRef.body.dataset) return null;
  const mode = documentRef.body.dataset.appMode;
  return typeof mode === 'string' && mode.trim() ? mode.trim() : null;
}

function sanitizeDraggableSnapshot(list) {
  if (!Array.isArray(list)) return [];
  return list.map(item => {
    const snapshot = typeof item === 'object' && item !== null ? item : {};
    return {
      id: snapshot.id,
      label: snapshot.label,
      value: snapshot.value,
      startPosition: snapshot.startPosition ? cloneDeep(snapshot.startPosition) : undefined,
      currentValue: snapshot.currentValue,
      currentOffsetY: snapshot.currentOffsetY,
      isPlaced: snapshot.isPlaced,
      lockPosition: snapshot.lockPosition
    };
  });
}

function createCleanState(meta) {
  const state = globalScope && globalScope.STATE && typeof globalScope.STATE === 'object' ? globalScope.STATE : {};
  const cleanState = {
    v: 1,
    interval: {
      from: state.from,
      to: state.to,
      mainStep: state.mainStep,
      subdivisions: state.subdivisions,
      numberType: state.numberType,
      decimalDigits: state.decimalDigits,
      labelFontSize: state.labelFontSize,
      clampToRange: Boolean(state.clampToRange),
      lockLine: Boolean(state.lockLine),
      showArrow: Boolean(state.showArrow)
    },
    points: sanitizeDraggableSnapshot(state.draggableItems)
  };

  const mode = getCurrentMode();
  if (mode) cleanState.mode = mode;

  const palette = getPaletteSnapshot();
  if (palette.project || (palette.palette && palette.palette.length)) {
    cleanState.palette = palette;
  }

  const theme = getThemeSnapshot();
  if (theme) cleanState.theme = theme;

  if (meta && typeof meta === 'object') {
    cleanState.meta = { ...meta };
  }

  return cleanState;
}

function applyPaletteSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  const project = typeof snapshot.project === 'string' && snapshot.project.trim() ? snapshot.project.trim() : null;
  if (project && documentRef && documentRef.documentElement && documentRef.documentElement.dataset) {
    documentRef.documentElement.dataset.mvActiveProject = project;
  }
}

function applyThemeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  const profile = typeof snapshot.profile === 'string' && snapshot.profile.trim() ? snapshot.profile.trim() : null;
  if (!profile) return;
  const themeApi = getThemeApi();
  if (themeApi && typeof themeApi.setProfile === 'function') {
    try {
      themeApi.setProfile(profile);
    } catch (_) {}
  }
  if (documentRef && documentRef.documentElement && documentRef.documentElement.dataset) {
    documentRef.documentElement.dataset.themeProfile = profile;
  }
}

function loadCleanState(cleanState) {
  if (!cleanState || typeof cleanState !== 'object' || cleanState.v !== 1) {
    return false;
  }
  const state = globalScope && globalScope.STATE && typeof globalScope.STATE === 'object' ? globalScope.STATE : null;
  if (!state) return false;

  const interval = cleanState.interval || {};
  const intervalKeys = [
    'from',
    'to',
    'mainStep',
    'subdivisions',
    'numberType',
    'decimalDigits',
    'labelFontSize',
    'clampToRange',
    'lockLine',
    'showArrow'
  ];
  intervalKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(interval, key)) {
      state[key] = interval[key];
    }
  });

  if (Array.isArray(cleanState.points)) {
    state.draggableItems = sanitizeDraggableSnapshot(cleanState.points);
  }

  applyPaletteSnapshot(cleanState.palette);
  applyThemeSnapshot(cleanState.theme);

  if (typeof globalScope.render === 'function') {
    try {
      globalScope.render();
    } catch (_) {}
  }

  const mode = typeof cleanState.mode === 'string' && cleanState.mode.trim() ? cleanState.mode.trim() : null;
  const hostApi = globalScope && globalScope.mathVisuals && globalScope.mathVisuals.tallinjeHost;
  if (mode && hostApi && typeof hostApi.update === 'function') {
    try {
      hostApi.update(mode);
    } catch (_) {}
  }

  return true;
}

function resolveMountTarget() {
  if (!documentRef) return null;
  return (
    documentRef.querySelector('[data-math-visual-app-root="tallinje"]') ||
    documentRef.getElementById('numberLineSvg')?.closest('.wrap') ||
    documentRef.querySelector('.wrap') ||
    documentRef.body ||
    documentRef.documentElement ||
    null
  );
}

const host = createAppHost({
  onError(error) {
    if (globalScope && globalScope.console && typeof globalScope.console.error === 'function') {
      globalScope.console.error('[Tallinje] Uventet feil i app-host', error);
    }
  }
});

/** @type {(() => void)[]} */
const hostCleanupFns = [];
let mountedApp = null;
let legacyBridgeInitialized = false;

function registerHostCleanup(fn) {
  if (typeof fn === 'function') {
    hostCleanupFns.push(fn);
  }
}

function teardownMountedApp() {
  if (!mountedApp) return;
  try {
    mountedApp.teardown();
  } catch (error) {
    if (globalScope && globalScope.console && typeof globalScope.console.error === 'function') {
      globalScope.console.error('[Tallinje] Feil under nedbygging av app', error);
    }
  }
  mountedApp = null;
}

function ensureLegacyBridge() {
  if (!globalScope || legacyBridgeInitialized) return;
  legacyBridgeInitialized = true;

  const unsubscribeMode = host.bus.on('app-mode-changed', detail => {
    if (!detail || typeof globalScope.dispatchEvent !== 'function') return;
    try {
      globalScope.dispatchEvent(new CustomEvent('math-visuals:app-mode-changed', { detail }));
    } catch (error) {
      // Ignorer feil fra gamle lyttere
    }
  });
  registerHostCleanup(() => {
    unsubscribeMode();
    legacyBridgeInitialized = false;
  });

  if (typeof globalScope.addEventListener === 'function') {
    const handleBeforeUnload = () => runHostCleanup();
    globalScope.addEventListener('beforeunload', handleBeforeUnload, { once: true });
    registerHostCleanup(() => {
      globalScope.removeEventListener('beforeunload', handleBeforeUnload);
    });
  }
}

function mountTallinjeApp() {
  ensureLegacyBridge();
  const target = resolveMountTarget();
  if (!target) {
    if (globalScope && globalScope.console && typeof globalScope.console.warn === 'function') {
      globalScope.console.warn('[Tallinje] Fant ikke et mål for å montere appen.');
    }
    return null;
  }
  teardownMountedApp();
  mountedApp = host.mount(tallinjeApp, { target });
  return mountedApp;
}

function runHostCleanup() {
  teardownMountedApp();
  while (hostCleanupFns.length) {
    const fn = hostCleanupFns.pop();
    try {
      fn();
    } catch (error) {
      if (globalScope && globalScope.console && typeof globalScope.console.error === 'function') {
        globalScope.console.error('[Tallinje] Feil under opprydding', error);
      }
    }
  }
}

mountedApp = mountTallinjeApp();

if (globalScope) {
  const mathVisuals =
    globalScope.mathVisuals && typeof globalScope.mathVisuals === 'object'
      ? globalScope.mathVisuals
      : (globalScope.mathVisuals = {});

  mathVisuals.tallinjeHost = {
    mount: mountTallinjeApp,
    update(payload) {
      if (mountedApp && typeof mountedApp.update === 'function') {
        mountedApp.update(payload);
      }
    },
    teardown: runHostCleanup,
    bus: host.bus
  };

  globalScope.tallinjeApi = {
    createCleanState,
    loadCleanState
  };
}
