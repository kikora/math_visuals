(() => {
  function disableSounds(target) {
    if (!target) {
      return;
    }

    if ('soundsDirectory' in target) {
      try {
        target.soundsDirectory = null;
      } catch (error) {
        // Ignore: the property may be read-only on this object.
      }
    }

    if ('keypressSound' in target) {
      try {
        target.keypressSound = null;
      } catch (error) {
        // Ignore: fall back to disabling individual sound slots if available.
        const slots = ['spacebar', 'return', 'delete', 'default'];
        for (const slot of slots) {
          if (target.keypressSound && slot in target.keypressSound) {
            target.keypressSound[slot] = null;
          }
        }
      }
    }

    if ('plonkSound' in target) {
      try {
        target.plonkSound = null;
      } catch (error) {
        // Ignore attempts to reset immutable properties.
      }
    }

    if ('keypressVibration' in target && typeof target.keypressVibration === 'boolean') {
      try {
        target.keypressVibration = false;
      } catch (error) {
        // Ignore failures when the property is read-only.
      }
    }
  }

  const ASSET_BASE_PATH = '/vendor/cdn/mathlive';
  const MATHLIVE_SCRIPT_URL = `${ASSET_BASE_PATH}/mathlive.min.js`;
  const MATHLIVE_STYLESHEET_URL = `${ASSET_BASE_PATH}/mathlive-static.css`;

  const mathfieldAssetConfig = {
    fontsDirectory: `${ASSET_BASE_PATH}/fonts`,
    soundsDirectory: `${ASSET_BASE_PATH}/sounds`,
    virtualKeyboardLayout: `${ASSET_BASE_PATH}/virtual-keyboards`,
    customVirtualKeyboardLayers: `${ASSET_BASE_PATH}/virtual-keyboards/layers`,
    customVirtualKeyboards: `${ASSET_BASE_PATH}/virtual-keyboards/layouts`,
    virtualKeyboardToolbar: `${ASSET_BASE_PATH}/virtual-keyboards/toolbar`,
  };

  const keyboardAssetConfig = {
    soundsDirectory: `${ASSET_BASE_PATH}/sounds`,
  };

  function waitForLoad(element) {
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        element.removeEventListener('load', onLoad);
        element.removeEventListener('error', onError);
      };

      const onLoad = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('Failed to load MathLive asset.'));
      };

      element.addEventListener('load', onLoad);
      element.addEventListener('error', onError);
    });
  }

  async function ensureStylesheetLoaded(href) {
    if (typeof document === 'undefined') {
      return;
    }

    const resolvedHref = new URL(href, document.baseURI).href;
    const existingLink = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]'),
    ).find(link => link.href === resolvedHref);
    if (existingLink) {
      if (existingLink.dataset.mathliveOfflineStylesheet === 'true') {
        try {
          await waitForLoad(existingLink);
        } catch (error) {
          // Ignore load errors on previously injected stylesheet elements.
        }
      }
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.dataset.mathliveOfflineStylesheet = 'true';
    document.head.appendChild(link);
    try {
      await waitForLoad(link);
    } catch (error) {
      // Ignore failures: the stylesheet is optional for script execution.
    }
  }

  async function ensureScriptLoaded(src) {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    if (window.MathfieldElement) {
      return;
    }

    const resolvedSrc = new URL(src, document.baseURI).href;
    const existingScript = Array.from(
      document.querySelectorAll('script[src]'),
    ).find(script => script.src === resolvedSrc);
    if (existingScript) {
      try {
        await waitForLoad(existingScript);
      } catch (error) {
        // Ignore failures: fall through to relying on existing MathLive presence.
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset.mathliveOfflineScript = 'true';
    document.head.appendChild(script);
    await waitForLoad(script);
  }

  let ensureMathLivePromise;

  async function ensureMathLiveAssetsLoaded() {
    if (!ensureMathLivePromise) {
      ensureMathLivePromise = (async () => {
        await Promise.all([
          ensureStylesheetLoaded(MATHLIVE_STYLESHEET_URL),
          ensureScriptLoaded(MATHLIVE_SCRIPT_URL),
        ]);
      })();
    }

    try {
      await ensureMathLivePromise;
    } catch (error) {
      // Ignore failures: configuration will be attempted with whatever loaded successfully.
    }
  }

  function applyOfflineConfig(target, config) {
    if (!target) {
      return;
    }

    for (const [property, value] of Object.entries(config)) {
      try {
        target[property] = value;
      } catch (error) {
        // Ignore: some properties may be read-only or unsupported in this context.
      }
    }
  }

  let isConfigured = false;

  async function configureMathLiveOffline() {
    if (typeof window === 'undefined' || isConfigured) {
      return;
    }

    await ensureMathLiveAssetsLoaded();

    if (window.customElements && typeof window.customElements.whenDefined === 'function') {
      try {
        await window.customElements.whenDefined('math-field');
      } catch (error) {
        // Ignore failures: we'll attempt to configure with whatever is available.
      }
    }

    if (!window.MathfieldElement) {
      return;
    }

    isConfigured = true;

    applyOfflineConfig(window.MathfieldElement, mathfieldAssetConfig);
    applyOfflineConfig(window.mathVirtualKeyboard, keyboardAssetConfig);

    disableSounds(window.MathfieldElement);
    disableSounds(window.mathVirtualKeyboard);
  }

  configureMathLiveOffline();

  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configureMathLiveOffline, { once: true });
  }
})();
