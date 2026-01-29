const { test, expect } = require('@playwright/test');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const SETTINGS_MODULE = require.resolve('../examples.js');
const paletteConfig = require('../palette/palette-config.js');
const {
  distributeFlatPaletteToGroups,
  flattenProjectPalette: flattenStorePalette,
  expandPalette: expandStorePalette
} = require('../api/_lib/settings-store.js');
const MIN_COLOR_SLOTS = Number.isInteger(paletteConfig.MIN_COLOR_SLOTS)
  ? paletteConfig.MIN_COLOR_SLOTS
  : 0;
const AXIS_SLOT = (() => {
  if (!Array.isArray(paletteConfig.COLOR_SLOT_GROUPS)) {
    return null;
  }
  for (const group of paletteConfig.COLOR_SLOT_GROUPS) {
    if (!group || !Array.isArray(group.slots)) continue;
    const groupId = typeof group.groupId === 'string' ? group.groupId : String(group.groupId || '');
    if (groupId !== 'fellesfarger') continue;
    const slot = group.slots[1];
    if (!slot || !Number.isInteger(slot.index)) continue;
    const groupIndex = Number.isInteger(slot.groupIndex) ? slot.groupIndex : 1;
    return { groupId, groupIndex, index: slot.index };
  }
  return null;
})();
const ORIGINAL_GLOBALS = {
  document: global.document,
  window: global.window,
  location: global.location,
  navigator: global.navigator,
  CustomEvent: global.CustomEvent,
  localStorage: global.localStorage
};

function getRolePalette(group, roleKey) {
  if (Array.isArray(group)) {
    return group;
  }
  if (group && typeof group === 'object') {
    const list = group[roleKey];
    return Array.isArray(list) ? list : [];
  }
  return [];
}

test.afterEach(() => {
  delete global.MathVisualsSettings;
  delete global.MathVisualsPalette;
  delete global.MathVisualsTheme;
  delete global.MathVisualsPaletteConfig;
  if (global.window && typeof global.window === 'object') {
    delete global.window.MathVisualsPalette;
    delete global.window.MathVisualsTheme;
    delete global.window.MathVisualsPaletteConfig;
  }
  delete require.cache[SETTINGS_MODULE];
  try {
    delete require.cache[require.resolve('../brøkpizza.js')];
  } catch (_) {}
  try {
    delete require.cache[require.resolve('../brøkfigurer.js')];
  } catch (_) {}
  try {
    delete require.cache[require.resolve('../theme/palette.js')];
  } catch (_) {}
  if (ORIGINAL_GLOBALS.document === undefined) {
    delete global.document;
  } else {
    global.document = ORIGINAL_GLOBALS.document;
  }
  if (ORIGINAL_GLOBALS.window === undefined) {
    delete global.window;
  } else {
    global.window = ORIGINAL_GLOBALS.window;
  }
  if (ORIGINAL_GLOBALS.location === undefined) {
    delete global.location;
  } else {
    global.location = ORIGINAL_GLOBALS.location;
  }
  if (ORIGINAL_GLOBALS.navigator === undefined) {
    delete global.navigator;
  } else {
    global.navigator = ORIGINAL_GLOBALS.navigator;
  }
  if (ORIGINAL_GLOBALS.CustomEvent === undefined) {
    delete global.CustomEvent;
  } else {
    global.CustomEvent = ORIGINAL_GLOBALS.CustomEvent;
  }
  if (ORIGINAL_GLOBALS.localStorage === undefined) {
    delete global.localStorage;
  } else {
    global.localStorage = ORIGINAL_GLOBALS.localStorage;
  }
});

function loadNkantResolveSettingsPalette(projectName, options = {}) {
  const documentStub = createDocumentStub();
  const storageData = new Map();
  const localStorageStub = {
    getItem: key => (storageData.has(String(key)) ? storageData.get(String(key)) : null),
    setItem: (key, value) => {
      storageData.set(String(key), String(value));
    },
    removeItem: key => {
      storageData.delete(String(key));
    },
    clear: () => {
      storageData.clear();
    },
    key: index => Array.from(storageData.keys())[index] || null,
    get length() {
      return storageData.size;
    }
  };

  const windowStub = {
    document: documentStub,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    location: { origin: '', pathname: '/', search: '', hash: '' },
    navigator: { userAgent: 'node' },
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: handle => clearTimeout(handle),
    setInterval: (...args) => setInterval(...args),
    clearInterval: handle => clearInterval(handle),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: handle => clearTimeout(handle),
    localStorage: localStorageStub,
    CustomEvent: function CustomEvent() {}
  };
  windowStub.window = windowStub;
  windowStub.self = windowStub;
  documentStub.defaultView = windowStub;
  const paletteHelper = options.groupPaletteHelper === null ? undefined : options.groupPaletteHelper;

  windowStub.MathVisualsPaletteConfig = paletteConfig;
  windowStub.MathVisualsSettings = {};
  if (options.paletteApi === null) {
    delete windowStub.MathVisualsPalette;
  } else {
    windowStub.MathVisualsPalette = {
      getGroupPalette: () => []
    };
  }
  const themeGroupPalette = function themeGroupPalette() {
    return [];
  };
  if (options.themeApi === null) {
    delete windowStub.MathVisualsTheme;
  } else {
    windowStub.MathVisualsTheme = {
      getGroupPalette: themeGroupPalette,
      getActiveProfileName: () => null,
      getColor: () => '#000000'
    };
  }
  windowStub.MathVisAltText = {
    create: () => ({
      destroy: () => {},
      scheduleUpdate: () => {},
      setOptions: () => {}
    })
  };
  windowStub.MathVisSvgExport = {
    saveSvg: () => Promise.resolve(),
    savePng: () => Promise.resolve(),
    copySvg: () => Promise.resolve(),
    copyPng: () => Promise.resolve()
  };

  const paletteServiceModule = (() => {
    if (paletteHelper && typeof paletteHelper.resolve === 'function') {
      const service = {
        resolveGroupPalette: options => paletteHelper.resolve(options)
      };
      return {
        paletteService: service,
        ensurePalette: paletteHelper.ensure ? paletteHelper.ensure.bind(paletteHelper) : undefined
      };
    }
    return {
      paletteService: {
        resolveGroupPalette: () => []
      },
      ensurePalette(base, fallback, count) {
        const primary = Array.isArray(base) ? base.slice() : [];
        const backup = Array.isArray(fallback) ? fallback.slice() : [];
        if (!Number.isFinite(count) || count <= 0) {
          return primary.length ? primary : backup;
        }
        const target = Math.max(1, Math.trunc(count));
        const source = primary.length ? primary : backup;
        const result = [];
        for (let index = 0; index < target; index++) {
          if (!source.length) break;
          result.push(source[index % source.length]);
        }
        return result;
      }
    };
  })();

  const sandboxRequire = request => {
    if (request === './palette/get-palette-service.js' || request === './palette/palette-service.js') {
      return paletteServiceModule;
    }
    if (request === './palette/palette-config.js') {
      return paletteConfig;
    }
    const resolved = require.resolve(request, { paths: [__dirname, path.join(__dirname, '..')] });
    return require(resolved);
  };

  const sandbox = {
    window: windowStub,
    document: documentStub,
    self: windowStub,
    global: windowStub,
    globalThis: windowStub,
    console,
    Math,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: windowStub.requestAnimationFrame,
    cancelAnimationFrame: windowStub.cancelAnimationFrame,
    URL,
    require: sandboxRequire,
    module: { exports: {} },
    exports: {}
  };

  sandbox.MathVisualsPaletteConfig = paletteConfig;

  const nkantSource = fs.readFileSync(require.resolve('../nkant.js'), 'utf8');
  vm.runInNewContext(
    `${nkantSource}\nmodule.exports = typeof resolveSettingsPalette === 'function' ? { resolveSettingsPalette } : {};`,
    sandbox,
    { filename: require.resolve('../nkant.js') }
  );

  return {
    resolveSettingsPalette:
      sandbox.module && sandbox.module.exports ? sandbox.module.exports.resolveSettingsPalette : undefined,
    context: sandbox
  };
}

function createStyleStub() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop === 'setProperty' || prop === 'removeProperty') {
          return () => {};
        }
        return target[prop] || '';
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
      deleteProperty() {
        return true;
      }
    }
  );
}

function createNodeStub() {
  const node = {};
  return new Proxy(node, {
    get(target, prop) {
      if (prop === 'style') {
        if (!target.style) {
          target.style = createStyleStub();
        }
        return target.style;
      }
      if (prop === 'classList') {
        if (!target.classList) {
          target.classList = { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false };
        }
        return target.classList;
      }
      if (prop === 'dataset') {
        if (!target.dataset) {
          target.dataset = {};
        }
        return target.dataset;
      }
      if (prop === 'children') {
        if (!target.children) {
          target.children = [];
        }
        return target.children;
      }
      if (prop === 'innerHTML' || prop === 'textContent' || prop === 'value') {
        return target[prop] || '';
      }
      if (
        prop === 'appendChild' ||
        prop === 'removeChild' ||
        prop === 'insertBefore' ||
        prop === 'remove' ||
        prop === 'replaceChildren' ||
        prop === 'setAttribute' ||
        prop === 'removeAttribute' ||
        prop === 'addEventListener' ||
        prop === 'removeEventListener' ||
        prop === 'focus' ||
        prop === 'blur' ||
        prop === 'scrollIntoView'
      ) {
        return () => {};
      }
      if (prop === 'querySelectorAll') {
        return () => ({ forEach: () => {}, length: 0 });
      }
      if (prop === 'querySelector' || prop === 'closest') {
        return () => null;
      }
      if (
        prop === 'parentElement' ||
        prop === 'parentNode' ||
        prop === 'nextSibling' ||
        prop === 'previousSibling' ||
        prop === 'firstChild' ||
        prop === 'lastChild'
      ) {
        return target[prop] || null;
      }
      if (prop === 'getBoundingClientRect') {
        return () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
      }
      if (prop === Symbol.iterator) {
        return function* () {};
      }
      if (!(prop in target)) {
        target[prop] = () => {};
      }
      return target[prop];
    },
    set(target, prop, value) {
      target[prop] = value;
      return true;
    }
  });
}

function createDocumentStub() {
  const node = createNodeStub();
  return new Proxy(
    {
      readyState: 'complete',
      documentElement: node,
      body: node,
      head: createNodeStub(),
      addEventListener: () => {},
      removeEventListener: () => {},
      querySelectorAll: () => ({ forEach: () => {}, length: 0 }),
      querySelector: () => null,
      createElement: () => createNodeStub(),
      createElementNS: () => createNodeStub(),
      createDocumentFragment: () => createNodeStub(),
      getElementById: () => createNodeStub(),
      getElementsByTagName: () => [],
      fonts: { ready: Promise.resolve() },
      createTextNode: () => createNodeStub(),
      dispatchEvent: () => {}
    },
    {
      get(target, prop) {
        if (prop in target) {
          return target[prop];
        }
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    }
  );
}

test.describe('brøkpizza palette fallback', () => {
  test('falls back to theme pizza tokens when palette APIs return no colors', () => {
    const appliedStyles = {};
    const documentStub = createDocumentStub();
    const root = documentStub.documentElement;
    root.style = {
      setProperty: (name, value) => {
        appliedStyles[name] = value;
      },
      removeProperty: name => {
        delete appliedStyles[name];
      }
    };
    root.getAttribute = attr => {
      if (attr === 'data-mv-active-project') {
        return 'campus';
      }
      return null;
    };
    root.setAttribute = () => {};

    global.document = documentStub;
    const windowStub = {
      document: documentStub,
      location: { href: 'https://example.com' },
      addEventListener: () => {},
      removeEventListener: () => {},
      matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} })
    };
    global.window = windowStub;
    global.MathVisualsPaletteConfig = paletteConfig;
    windowStub.MathVisualsPaletteConfig = paletteConfig;

    const emptyPalette = () => [];
    const paletteServiceModule = require('../palette/get-palette-service.js');
    const originalResolveGroupPalette = paletteServiceModule.paletteService.resolveGroupPalette;
    paletteServiceModule.paletteService.resolveGroupPalette = () => [];
    const paletteApi = { getGroupPalette: emptyPalette };
    const settingsApi = { getGroupPalette: emptyPalette };
    const groupHelper = { resolve: emptyPalette };
    const themeColors = {
      'pizza.fill': '#123456',
      'pizza.rim': '#234567',
      'pizza.dash': '#345678',
      'pizza.handle': '#456789',
      'pizza.handleStroke': '#56789a'
    };
    const themeApi = {
      getGroupPalette: emptyPalette,
      getPalette: emptyPalette,
      getColor: token => themeColors[token] || null,
      applyToDocument: () => {}
    };

    global.MathVisualsPalette = paletteApi;
    global.MathVisualsSettings = settingsApi;
    global.MathVisualsTheme = themeApi;
    windowStub.MathVisualsPalette = paletteApi;
    windowStub.MathVisualsSettings = settingsApi;
    windowStub.MathVisualsTheme = themeApi;

    const localStorageStub = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    };
    global.localStorage = localStorageStub;
    windowStub.localStorage = localStorageStub;

    const pizzaModulePath = require.resolve('../brøkpizza.js');
    try {
      delete require.cache[pizzaModulePath];
      require('../brøkpizza.js');
    } finally {
      paletteServiceModule.paletteService.resolveGroupPalette = originalResolveGroupPalette;
      delete require.cache[pizzaModulePath];
    }

    expect(appliedStyles['--pizza-fill']).toBe(themeColors['pizza.fill']);
    expect(appliedStyles['--pizza-rim']).toBe(themeColors['pizza.rim']);
    expect(appliedStyles['--pizza-dash']).toBe(themeColors['pizza.dash']);
    expect(appliedStyles['--pizza-handle']).toBe(themeColors['pizza.handle']);
    expect(appliedStyles['--pizza-handle-stroke']).toBe(themeColors['pizza.handleStroke']);
  });
});

test.describe('brøkfigurer palette fallback', () => {
  test('uses project fallback palette when no palette APIs provide colors', async () => {
    const originalGlobals = {
      window: global.window,
      document: global.document,
      self: global.self,
      location: global.location,
      navigator: global.navigator,
      CustomEvent: global.CustomEvent,
      localStorage: global.localStorage,
      MathVisualsPalette: global.MathVisualsPalette,
      MathVisualsSettings: global.MathVisualsSettings,
      MathVisualsTheme: global.MathVisualsTheme,
      MathVisualsPaletteConfig: global.MathVisualsPaletteConfig,
      MathVisAltText: global.MathVisAltText,
      MathVisSvgExport: global.MathVisSvgExport,
      requestAnimationFrame: global.requestAnimationFrame,
      cancelAnimationFrame: global.cancelAnimationFrame,
      ResizeObserver: global.ResizeObserver,
      JXG: global.JXG
    };

    const modulePath = require.resolve('../brøkfigurer.js');
    delete require.cache[modulePath];

    const documentStub = createDocumentStub();
    const root = documentStub.documentElement;
    root.getAttribute = attr => {
      if (attr === 'data-mv-active-project') return 'campus';
      if (attr === 'data-theme-profile') return '';
      return null;
    };
    root.setAttribute = () => {};
    root.style = {
      setProperty: () => {},
      removeProperty: () => {}
    };

    const nodeCache = new Map();
    const createStubElement = () => {
      const el = createNodeStub();
      el.style = { setProperty: () => {}, removeProperty: () => {}, display: '' };
      el.cloneNode = () => createStubElement();
      el.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
      el.getTotalLength = () => 0;
      return el;
    };

    const colorInputCount = 6;
    const colorInputs = Array.from({ length: colorInputCount }, (_, index) => {
      const input = createStubElement();
      input.id = `color_${index + 1}`;
      input.value = '';
      input.type = 'color';
      input.addEventListener = () => {};
      input.removeEventListener = () => {};
      return input;
    });

    const colorCountInput = createStubElement();
    colorCountInput.value = '4';
    colorCountInput.addEventListener = () => {};

    const allowWrongInput = createStubElement();
    allowWrongInput.checked = false;
    const showDivisionLinesInput = createStubElement();
    showDivisionLinesInput.checked = true;
    const showOutlineInput = createStubElement();
    showOutlineInput.checked = true;

    const registerNode = (id, node) => {
      nodeCache.set(id, node);
      return node;
    };

    registerNode('colorCount', colorCountInput);
    registerNode('allowWrong', allowWrongInput);
    registerNode('showDivisionLines', showDivisionLinesInput);
    registerNode('showOutline', showOutlineInput);
    registerNode('figureBoard', createStubElement());
    registerNode('figureGrid', createStubElement());
    registerNode('figAddColumn', createStubElement());
    registerNode('figRemoveColumn', createStubElement());
    registerNode('figAddRow', createStubElement());
    registerNode('figRemoveRow', createStubElement());
    registerNode('figureSettings', createStubElement());
    registerNode('btnExportSvg', createStubElement());
    registerNode('btnExportPng', createStubElement());
    registerNode('btnCheck', createStubElement());
    registerNode('checkStatus', createStubElement());

    documentStub.getElementById = id => {
      if (nodeCache.has(id)) {
        return nodeCache.get(id);
      }
      if (/^color_\d+$/.test(id)) {
        const index = Number.parseInt(id.split('_')[1], 10) - 1;
        if (index >= 0 && index < colorInputs.length) {
          return colorInputs[index];
        }
        return null;
      }
      if (!nodeCache.has(id)) {
        nodeCache.set(id, createStubElement());
      }
      return nodeCache.get(id);
    };

    documentStub.querySelector = () => null;
    documentStub.querySelectorAll = () => [];
    documentStub.createElement = tagName => {
      const el = createStubElement();
      el.tagName = typeof tagName === 'string' ? tagName.toUpperCase() : '';
      if (typeof tagName === 'string' && tagName.toLowerCase() === 'canvas') {
        el.getContext = () => ({
          fillRect: () => {},
          drawImage: () => {},
          clearRect: () => {},
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          fill: () => {},
          stroke: () => {}
        });
        el.toBlob = callback => callback(null);
        el.toDataURL = () => 'data:image/png;base64,';
      }
      return el;
    };
    documentStub.createElementNS = () => createStubElement();

    const body = createStubElement();
    body.contains = () => false;
    documentStub.body = body;

    const storageData = new Map();
    const localStorageStub = {
      getItem: key => (storageData.has(String(key)) ? storageData.get(String(key)) : null),
      setItem: (key, value) => {
        storageData.set(String(key), String(value));
      },
      removeItem: key => {
        storageData.delete(String(key));
      },
      clear: () => {
        storageData.clear();
      },
      key: index => Array.from(storageData.keys())[index] || null,
      get length() {
        return storageData.size;
      }
    };

    const windowStub = {
      document: documentStub,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
      location: { origin: 'https://example.test', pathname: '/', search: '', hash: '' },
      navigator: { userAgent: 'node' },
      matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
      setTimeout: (...args) => setTimeout(...args),
      clearTimeout: handle => clearTimeout(handle),
      setInterval: (...args) => setInterval(...args),
      clearInterval: handle => clearInterval(handle),
      requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
      cancelAnimationFrame: handle => clearTimeout(handle),
      localStorage: localStorageStub,
      CustomEvent: function CustomEvent() {},
      getComputedStyle: () => ({
        gap: '0px',
        columnGap: '0px',
        rowGap: '0px',
        getPropertyValue: () => '0px'
      })
    };
    windowStub.window = windowStub;
    windowStub.self = windowStub;

    windowStub.MathVisAltText = {
      create: () => ({
        destroy: () => {},
        scheduleUpdate: () => {},
        setOptions: () => {},
        refresh: () => {}
      }),
      ensureSvgA11yNodes: () => ({
        titleEl: { id: 'alt-title' },
        descEl: { id: 'alt-desc' }
      })
    };
    windowStub.MathVisSvgExport = {
      exportSvgWithArchive: () => Promise.resolve(),
      saveSvg: () => Promise.resolve(),
      savePng: () => Promise.resolve(),
      copySvg: () => Promise.resolve(),
      copyPng: () => Promise.resolve(),
      cloneSvgForExport: svg => svg,
      ensureMinimumPngDimensions: ({ width, height }, { scale }) => ({
        width: Math.max(1, Math.round((Number(width) || 0) * (Number(scale) || 1))),
        height: Math.max(1, Math.round((Number(height) || 0) * (Number(scale) || 1)))
      }),
      slugify: value => String(value || '').toLowerCase().replace(/\s+/g, '-'),
      applyPaletteToElement: () => {}
    };
    const createBoardShape = () => {
      const shape = createStubElement();
      shape.rendNode = createStubElement();
      shape.rendNodeFront = createStubElement();
      shape.remove = () => {};
      shape.on = () => {};
      shape.off = () => {};
      shape.highlight = () => {};
      shape.noHighlight = () => {};
      shape.vertices = [];
      shape.borders = [];
      return shape;
    };
    const createBoardStub = () => ({
      create: () => createBoardShape(),
      update: () => {},
      remove: () => {},
      renderer: { svgRoot: createStubElement() }
    });
    windowStub.JXG = {
      JSXGraph: {
        initBoard: () => createBoardStub(),
        freeBoard: () => {}
      }
    };

    windowStub.MathVisualsPalette = {
      getGroupPalette: () => []
    };
    const settingsGroupPalette = function settingsGroupPalette() {
      return [];
    };
    windowStub.MathVisualsSettings = {
      getGroupPalette: settingsGroupPalette
    };
    const themeGroupPalette = function themeGroupPalette() {
      return [];
    };
    windowStub.MathVisualsTheme = {
      getGroupPalette: themeGroupPalette,
      getPalette: () => [],
      getActiveProfileName: () => null,
      getColor: () => '#000000',
      applyToDocument: () => {}
    };
    windowStub.MathVisualsPaletteConfig = paletteConfig;

    global.window = windowStub;
    global.document = documentStub;
    global.self = windowStub;
    global.location = windowStub.location;
    global.navigator = windowStub.navigator;
    global.CustomEvent = windowStub.CustomEvent;
    global.localStorage = localStorageStub;
    global.MathVisAltText = windowStub.MathVisAltText;
    global.MathVisSvgExport = windowStub.MathVisSvgExport;
    global.MathVisualsPalette = windowStub.MathVisualsPalette;
    global.MathVisualsSettings = windowStub.MathVisualsSettings;
    global.MathVisualsTheme = windowStub.MathVisualsTheme;
    global.MathVisualsPaletteConfig = paletteConfig;
    global.JXG = windowStub.JXG;

    const requestAnimationFrameStub = callback => setTimeout(() => callback(Date.now()), 0);
    const cancelAnimationFrameStub = handle => clearTimeout(handle);
    global.requestAnimationFrame = requestAnimationFrameStub;
    global.cancelAnimationFrame = cancelAnimationFrameStub;
    global.ResizeObserver = function ResizeObserver(callback) {
      this.observe = () => {};
      this.unobserve = () => {};
      this.disconnect = () => {};
      if (typeof callback === 'function') callback();
    };

    const paletteServiceModule = require('../palette/get-palette-service.js');
    const originalResolveGroupPalette = paletteServiceModule.paletteService.resolveGroupPalette;
    paletteServiceModule.paletteService.resolveGroupPalette = () => [];

    try {
      require('../brøkfigurer.js');
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(windowStub.STATE && Array.isArray(windowStub.STATE.colors)).toBe(true);
      const colors = windowStub.STATE.colors || [];
      expect(colors.length).toBeGreaterThan(0);

      const fallbackPalette = resolveGroupFallbackPaletteForTest('fellesfarger');
      expect(fallbackPalette.length).toBeGreaterThan(0);

      const expected = Array.from({ length: colors.length }, (_, index) => {
        const color = fallbackPalette[index % fallbackPalette.length];
        expect(typeof color).toBe('string');
        return color;
      });

      expect(colors).toEqual(expected);
    } finally {
      paletteServiceModule.paletteService.resolveGroupPalette = originalResolveGroupPalette;
      delete require.cache[modulePath];
      Object.entries(originalGlobals).forEach(([key, value]) => {
        if (value === undefined) {
          delete global[key];
        } else {
          global[key] = value;
        }
      });
    }
  });
});

function ensureDomStubs() {
  const documentStub = createDocumentStub();
  global.document = documentStub;
  const storageData = new Map();
  const localStorageStub = {
    getItem: key => (storageData.has(String(key)) ? storageData.get(String(key)) : null),
    setItem: (key, value) => {
      storageData.set(String(key), String(value));
    },
    removeItem: key => {
      storageData.delete(String(key));
    },
    clear: () => {
      storageData.clear();
    },
    key: index => Array.from(storageData.keys())[index] || null,
    get length() {
      return storageData.size;
    }
  };
  global.window = {
    document: documentStub,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    location: { origin: '', pathname: '/', search: '', hash: '' },
    navigator: { userAgent: 'node' },
    matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
    setTimeout: (...args) => setTimeout(...args),
    clearTimeout: handle => clearTimeout(handle),
    setInterval: (...args) => setInterval(...args),
    clearInterval: handle => clearInterval(handle),
    requestAnimationFrame: callback => setTimeout(() => callback(Date.now()), 0),
    cancelAnimationFrame: handle => clearTimeout(handle),
    localStorage: localStorageStub,
    CustomEvent: function CustomEvent() {}
  };
  global.location = global.window.location;
  global.navigator = global.window.navigator;
  global.CustomEvent = function CustomEvent() {};
  global.window.CustomEvent = global.CustomEvent;
  global.localStorage = localStorageStub;
}

function sanitizePaletteForTest(values) {
  if (!Array.isArray(values)) return [];
  const sanitized = [];
  values.forEach(value => {
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) return;
    sanitized.push(trimmed);
  });
  return sanitized;
}

const LEGACY_FRACTION_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D'];

function resolveGroupFallbackPaletteForTest(groupId) {
  const config = paletteConfig || {};
  const basePalette = sanitizePaletteForTest(
    LEGACY_FRACTION_PALETTE
  );
  if (!basePalette.length) {
    return [];
  }
  const normalizedGroupId = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
  const indices = [];
  if (config.GROUP_SLOT_INDICES && typeof config.GROUP_SLOT_INDICES === 'object') {
    const mapped = config.GROUP_SLOT_INDICES[normalizedGroupId];
    if (Array.isArray(mapped)) {
      mapped.forEach(value => {
        if (Number.isInteger(value) && value >= 0) {
          indices.push(Math.trunc(value));
        }
      });
    }
  }
  if (!indices.length && Array.isArray(config.COLOR_SLOT_GROUPS)) {
    config.COLOR_SLOT_GROUPS.forEach(group => {
      if (!group || typeof group !== 'object') return;
      const id = typeof group.groupId === 'string' ? group.groupId.trim().toLowerCase() : '';
      if (id !== normalizedGroupId) return;
      if (!Array.isArray(group.slots)) return;
      group.slots.forEach((slot, slotIndex) => {
        const index = Number.isInteger(slot && slot.index) ? Math.trunc(slot.index) : slotIndex;
        if (Number.isInteger(index) && index >= 0) {
          indices.push(index);
        }
      });
    });
  }
  if (!indices.length) {
    return basePalette.slice();
  }
  const result = [];
  const baseLength = basePalette.length;
  indices.forEach((index, slotIndex) => {
    if (Number.isInteger(index) && index >= 0) {
      const color = basePalette[index % baseLength];
      if (typeof color === 'string' && color) {
        result.push(color);
        return;
      }
    }
    const fallbackColor = basePalette[slotIndex % baseLength] || basePalette[0];
    if (typeof fallbackColor === 'string' && fallbackColor) {
      result.push(fallbackColor);
    }
  });
  return result.length ? result : basePalette.slice();
}

function loadSettingsWithPaletteSpy(spyImplementation) {
  const paletteCalls = [];
  const previousFetch = global.fetch;

  delete global.MathVisualsSettings;
  delete require.cache[SETTINGS_MODULE];

  ensureDomStubs();

  global.MathVisualsPalette = {
    getGroupPalette(groupId, options) {
      const result = spyImplementation(groupId, options);
      paletteCalls.push({ groupId, options });
      return Array.isArray(result) ? result : ['#123456'];
    },
    getProjectGroupPalettes() {
      return {};
    },
    getProjectPalette() {
      return ['#123456'];
    }
  };
  if (global.window && typeof global.window === 'object') {
    global.window.MathVisualsPalette = global.MathVisualsPalette;
  }
  global.fetch = undefined;

  require('../examples.js');

  const api = global.MathVisualsSettings || (global.window && global.window.MathVisualsSettings);

  global.fetch = previousFetch;

  return { api, paletteCalls };
}

function loadThemeModule() {
  delete global.MathVisualsTheme;
  if (global.window && typeof global.window === 'object') {
    delete global.window.MathVisualsTheme;
  }
  delete require.cache[require.resolve('../theme-profiles.js')];

  ensureDomStubs();

  require('../theme-profiles.js');

  return global.MathVisualsTheme || (global.window && global.window.MathVisualsTheme);
}

test.describe('MathVisualsSettings.getGroupPalette', () => {
  test('ignores project override with legacy signature', () => {
    const { api, paletteCalls } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const palette = api.getGroupPalette('fellesfarger', 4, { project: 'annet' });

    expect(palette).toEqual(['#abcdef']);
    expect(paletteCalls).toHaveLength(1);
    const [{ groupId, options }] = paletteCalls;
    expect(groupId).toBe('fellesfarger');
    expect(options.project).toBeUndefined();
    expect(options.count).toBe(4);
  });

  test('supports options-object signature and ignores project override', () => {
    const { api, paletteCalls } = loadSettingsWithPaletteSpy(() => ['#fedcba']);

    const palette = api.getGroupPalette('fellesfarger', { project: 'annet', count: 2 });

    expect(palette).toEqual(['#fedcba']);
    expect(paletteCalls).toHaveLength(1);
    const [{ groupId, options }] = paletteCalls;
    expect(groupId).toBe('fellesfarger');
    expect(options.project).toBeUndefined();
    expect(options.count).toBe(2);
  });
});

test.describe('MathVisualsSettings fallback parity', () => {
  test('settings sortering fallback matches theme fallback for global palette', () => {
    global.MathVisualsPaletteConfig = paletteConfig;
    const themePalette = require('../theme/palette.js');
    expect(themePalette && typeof themePalette.getProjectGroupPalettes).toBe('function');

    const { api } = loadSettingsWithPaletteSpy(() => []);
    const settings = api.getSettings();
    const settingsSortering =
      settings.groupPalettes && Array.isArray(settings.groupPalettes.sortering)
        ? settings.groupPalettes.sortering
        : [];
    const themeGroups = themePalette.getProjectGroupPalettes('default', { settings }) || {};
    const themeSortering = Array.isArray(themeGroups.sortering) ? themeGroups.sortering : [];

    expect(settingsSortering.length).toBeGreaterThan(0);
    expect(themeSortering.length).toBeGreaterThan(0);
    expect(settingsSortering).toEqual(themeSortering);
  });
});

test.describe('nkant settings palette fallback', () => {
  test('uses global fallbacks when palette APIs return no colors', () => {
    const campus = loadNkantResolveSettingsPalette('campus');
    expect(typeof campus.resolveSettingsPalette).toBe('function');
    const campusResult = campus.resolveSettingsPalette.call(campus.context.window, 4);
    expect(campusResult.source).toBe('project-fallback');
    const expected = paletteConfig.PROJECT_FALLBACKS.default
      .slice(0, 4)
      .map(color => color.toLowerCase());
    expect(campusResult.colors).toEqual(expected);

    const annet = loadNkantResolveSettingsPalette('annet');
    expect(typeof annet.resolveSettingsPalette).toBe('function');
    const annetResult = annet.resolveSettingsPalette.call(annet.context.window, 4);
    expect(annetResult.source).toBe('project-fallback');
    expect(annetResult.colors).toEqual(expected);
  });
});

test.describe('MathVisuals palette slot handling', () => {
  test('preserves fellesfarger axis color across flatten → distribute → expand', () => {
    expect(AXIS_SLOT).toBeTruthy();
    const axisIndex = AXIS_SLOT ? AXIS_SLOT.index : 0;
    const projects = Array.isArray(paletteConfig.DEFAULT_PROJECT_ORDER)
      ? paletteConfig.DEFAULT_PROJECT_ORDER.slice()
      : ['campus', 'annet'];
    if (!projects.includes('default')) {
      projects.push('default');
    }
    projects.forEach(project => {
      const fallbackFlat = expandStorePalette(project, null);
      expect(fallbackFlat.length).toBeGreaterThan(axisIndex);
      const flattened = fallbackFlat.slice();
      flattened[axisIndex] = '#000000';
      const grouped = distributeFlatPaletteToGroups(flattened, project);
      if (AXIS_SLOT) {
        const axisGroup = grouped[AXIS_SLOT.groupId] || [];
        expect(axisGroup[AXIS_SLOT.groupIndex]).toBe('#000000');
      }
      const roundTrip = flattenStorePalette(project, { groupPalettes: grouped });
      expect(roundTrip[axisIndex]).toBe('#000000');
      const expanded = expandStorePalette(project, { groupPalettes: grouped });
      expect(expanded[axisIndex]).toBe('#000000');
    });
  });
});

test.describe('MathVisualsTheme.getPalette', () => {
  test('uses active profile palette even when project hint differs', () => {
    const theme = loadThemeModule();

    expect(theme).toBeTruthy();

    theme.setProfile('annet', { force: true });
    expect(theme.getActiveProfileName()).toBe('annet');

    const palette = theme.getPalette('figures', 6, { project: 'campus' });
    const expected = paletteConfig.PROJECT_FALLBACKS.default.slice(0, 6);

    expect(palette).toEqual(expected);
  });

  test('uses stored default colors even when project hint differs', () => {
    const theme = loadThemeModule();

    expect(theme).toBeTruthy();

    const storedDefaults = ['#111111', '#222222', '#333333', '#444444', '#555555', '#666666'];
    global.localStorage.setItem(
      'mathVisuals:settings',
      JSON.stringify({ defaultColors: storedDefaults })
    );

    theme.setProfile('campus', { force: true });
    expect(theme.getActiveProfileName()).toBe('campus');

    const palette = theme.getPalette('figures', 6, { project: 'annet' });

    expect(palette).toEqual(storedDefaults);
  });
});

test.describe('MathVisualsSettings palette formats', () => {
  test('exposes groupPalettes alongside defaultColors', () => {
    const { api } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const settings = api.getSettings();
    expect(settings).toBeTruthy();
    expect(settings.groupPalettes).toBeTruthy();
    expect(settings.groupPalettes.fellesfarger).toBeTruthy();
    expect(Array.isArray(settings.defaultColors)).toBe(true);
    expect(settings.defaultColors[0]).toBeDefined();
    const fellesfargerFills = getRolePalette(settings.groupPalettes.fellesfarger, 'fills');
    const firstGroupColor = fellesfargerFills[0];
    if (firstGroupColor) {
      expect(settings.defaultColors[0]).toBe(firstGroupColor);
    }
  });

  test('updates groupPalettes and defaultColors when saving palettes', () => {
    const { api } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const update = api.setSettings({
      groupPalettes: {
        fellesfarger: ['#111111'],
        ukjent: ['#222222', ' #333333 ']
      }
    });

    const updateFills = getRolePalette(update.groupPalettes.fellesfarger, 'fills');
    expect(updateFills[0]).toBe('#111111');
    expect(update.defaultColors[0]).toBe('#111111');
    expect(update.groupPalettes.ukjent).toBeUndefined();
    expect(update.defaultColors).not.toEqual(expect.arrayContaining(['#222222']));

    const settings = api.getSettings();
    const settingsFills = getRolePalette(settings.groupPalettes.fellesfarger, 'fills');
    expect(settingsFills[0]).toBe('#111111');
    expect(settings.defaultColors[0]).toBe('#111111');
    expect(settings.groupPalettes.ukjent).toBeUndefined();
    expect(settings.defaultColors).not.toEqual(expect.arrayContaining(['#222222']));
  });

  test('updateSettings accepts root-level groupPalettes', () => {
    const { api } = loadSettingsWithPaletteSpy(() => ['#abcdef']);

    const update = api.updateSettings({
      groupPalettes: {
        fellesfarger: ['#010101', ' #020202 '],
        ukjent: ['#030303']
      }
    });

    const updateFills = getRolePalette(update.groupPalettes.fellesfarger, 'fills');
    const updateEdges = getRolePalette(update.groupPalettes.fellesfarger, 'edges');
    expect(updateFills[0]).toBe('#010101');
    expect(updateEdges[0]).toBe('#020202');
    expect(update.defaultColors[0]).toBe('#010101');
    expect(update.groupPalettes.ukjent).toBeUndefined();

    const persisted = api.getSettings();
    const persistedFills = getRolePalette(persisted.groupPalettes.fellesfarger, 'fills');
    const persistedEdges = getRolePalette(persisted.groupPalettes.fellesfarger, 'edges');
    expect(persistedFills[0]).toBe('#010101');
    expect(persistedEdges[0]).toBe('#020202');
    expect(persisted.defaultColors[0]).toBe('#010101');
    expect(persisted.groupPalettes.ukjent).toBeUndefined();
  });
});
