const { test, expect } = require('@playwright/test');

function buildProjectPalette(fillColor, lineColor) {
  const palette = Array.from({ length: 30 }, (_, index) => `#${(index + 1).toString(16).padStart(6, '0')}`);
  palette[4] = fillColor;
  palette[5] = lineColor;
  return palette;
}

function createStubElement() {
  const style = {
    setProperty: () => {},
    removeProperty: () => {}
  };
  return {
    style,
    dataset: {},
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {},
      contains: () => false
    },
    appendChild: () => {},
    removeChild: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    removeAttribute: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    querySelectorAll: () => [],
    querySelector: () => null,
    getBoundingClientRect: () => ({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }),
    cloneNode: () => createStubElement(),
    contains: () => false,
    remove: () => {},
    focus: () => {},
    blur: () => {}
  };
}

test.describe('tenkeblokker fraction palette fallbacks', () => {
  test('resolves global fallback colors when APIs are unavailable', () => {
    const originalGlobals = {
      window: global.window,
      document: global.document,
      MathVisualsPaletteConfig: global.MathVisualsPaletteConfig,
      MathVisualsPalette: global.MathVisualsPalette,
      MathVisualsSettings: global.MathVisualsSettings,
      MathVisualsTheme: global.MathVisualsTheme
    };

    const restoreGlobal = (key, value) => {
      if (value === undefined) {
        delete global[key];
      } else {
        global[key] = value;
      }
    };

    delete require.cache[require.resolve('../tenkeblokker.js')];

    let currentProject = 'campus';
    const documentElement = createStubElement();
    documentElement.getAttribute = name => {
      if (name === 'data-mv-active-project') return currentProject;
      if (name === 'data-theme-profile') return '';
      return null;
    };

    const body = createStubElement();
    body.contains = () => false;

    const stubDocument = {
      documentElement,
      body,
      currentScript: null,
      baseURI: 'http://example.com/',
      getElementById: () => null,
      createElement: () => createStubElement(),
      createElementNS: () => createStubElement(),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const windowStub = {
      document: stubDocument,
      location: { href: 'http://example.com/' },
      addEventListener: () => {},
      removeEventListener: () => {},
      MathVisualsPalette: null,
      MathVisualsSettings: null,
      MathVisualsTheme: null,
      MathVisAltText: null,
      getComputedStyle: () => ({
        getPropertyValue: () => ''
      })
    };
    windowStub.window = windowStub;

    global.window = windowStub;
    global.document = stubDocument;
    global.MathVisualsPalette = null;
    global.MathVisualsSettings = null;
    global.MathVisualsTheme = null;

    const campusFallback = buildProjectPalette('#c0ffee', '#123456');
    const annetFallback = buildProjectPalette('#ff7700', '#004477');
    const defaultFallback = buildProjectPalette('#abcdef', '#fedcba');

    global.MathVisualsPaletteConfig = {
      PROJECT_FALLBACKS: {
        campus: campusFallback,
        annet: annetFallback,
        default: defaultFallback
      },
      GROUP_SLOT_INDICES: {
        fellesfarger: [4, 5]
      },
      COLOR_SLOT_GROUPS: [
        {
          groupId: 'fellesfarger',
          slots: [{ index: 4 }, { index: 5 }]
        }
      ]
    };

    try {
      const tenkeblokker = require('../tenkeblokker.js');
      currentProject = 'campus';
      const campusColors = tenkeblokker.resolveFractionPalette(2);
      const campusExtended = tenkeblokker.resolveFractionPalette(4);

      currentProject = 'annet';
      const annetColors = tenkeblokker.resolveFractionPalette(2);
      const annetExtended = tenkeblokker.resolveFractionPalette(4);

      expect(Array.isArray(campusColors)).toBe(true);
      expect(Array.isArray(annetColors)).toBe(true);
      expect(Array.isArray(campusExtended)).toBe(true);
      expect(Array.isArray(annetExtended)).toBe(true);
      expect(campusColors).toHaveLength(2);
      expect(annetColors).toHaveLength(2);
      expect(campusExtended).toHaveLength(4);
      expect(annetExtended).toHaveLength(4);
      expect(campusColors).toEqual(['#abcdef', '#fedcba']);
      expect(annetColors).toEqual(['#abcdef', '#fedcba']);
      expect(campusExtended).toEqual(['#abcdef', '#fedcba', '#abcdef', '#fedcba']);
      expect(annetExtended).toEqual(['#abcdef', '#fedcba', '#abcdef', '#fedcba']);
    } finally {
      delete require.cache[require.resolve('../tenkeblokker.js')];
      restoreGlobal('window', originalGlobals.window);
      restoreGlobal('document', originalGlobals.document);
      restoreGlobal('MathVisualsPaletteConfig', originalGlobals.MathVisualsPaletteConfig);
      restoreGlobal('MathVisualsPalette', originalGlobals.MathVisualsPalette);
      restoreGlobal('MathVisualsSettings', originalGlobals.MathVisualsSettings);
      restoreGlobal('MathVisualsTheme', originalGlobals.MathVisualsTheme);
    }
  });
});
