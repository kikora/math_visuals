(function (global) {
  if (typeof global !== 'object' || !global) return;

  const helper = {};
  const MINIMUM_PNG_DIMENSION = 100;
  let toastStyleInjected = false;
  let toastContainer = null;
  let archiveEntriesPromise = null;
  let html2canvasPromise = null;
  const ARCHIVE_ENTRIES_TIMEOUT_MS = 2000;

  function ensureToastStyle(doc) {
    if (toastStyleInjected) return;
    const style = doc.createElement('style');
    style.textContent = `
      .mathvis-toast-container {
        position: fixed;
        inset-inline-end: 16px;
        inset-block-end: 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        z-index: 2147483647;
        max-width: min(320px, 80vw);
        pointer-events: none;
      }
      .mathvis-toast {
        background: rgba(31, 41, 55, 0.92);
        color: #f9fafb;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.35);
        font-family: "Inter", "Segoe UI", system-ui, sans-serif;
        font-size: 14px;
        line-height: 1.4;
        display: flex;
        align-items: flex-start;
        gap: 8px;
        pointer-events: auto;
      }
      .mathvis-toast--success {
        background: rgba(16, 185, 129, 0.92);
        color: #022c22;
      }
      .mathvis-toast--error {
        background: rgba(239, 68, 68, 0.92);
        color: #450a0a;
      }
      .mathvis-toast__dismiss {
        margin-inline-start: auto;
        background: transparent;
        border: none;
        color: inherit;
        font-size: 16px;
        cursor: pointer;
        line-height: 1;
      }
    `;
    doc.head.appendChild(style);
    toastStyleInjected = true;
  }

  function ensureToastContainer(doc) {
    if (toastContainer && toastContainer.isConnected) return toastContainer;
    toastContainer = doc.createElement('div');
    toastContainer.className = 'mathvis-toast-container';
    doc.body.appendChild(toastContainer);
    return toastContainer;
  }

  function fetchWithTimeout(url, options, timeoutMs) {
    if (typeof global.fetch !== 'function') {
      return Promise.reject(new Error('fetch is not available'));
    }
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || typeof global.AbortController !== 'function') {
      return global.fetch(url, options);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const mergedOptions = options ? { ...options, signal: controller.signal } : { signal: controller.signal };

    return global
      .fetch(url, mergedOptions)
      .finally(() => {
        clearTimeout(timer);
      })
      .catch(error => {
        if (error && error.name === 'AbortError') {
          return Promise.reject(new Error('timeout'));
        }
        return Promise.reject(error);
      });
  }

  function showToast(message, type = 'info', options = {}) {
    const doc = global.document;
    if (!doc || !doc.body) return;
    ensureToastStyle(doc);
    const container = ensureToastContainer(doc);
    const toast = doc.createElement('div');
    toast.className = `mathvis-toast${type ? ` mathvis-toast--${type}` : ''}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');

    const content = doc.createElement('div');
    content.textContent = message;
    toast.appendChild(content);

    if (!options.sticky) {
      const dismiss = doc.createElement('button');
      dismiss.className = 'mathvis-toast__dismiss';
      dismiss.setAttribute('type', 'button');
      dismiss.setAttribute('aria-label', 'Lukk');
      dismiss.textContent = '×';
      dismiss.addEventListener('click', () => {
        if (toast.isConnected) toast.remove();
      });
      toast.appendChild(dismiss);
    }

    container.appendChild(toast);
    const timeout = Number.isFinite(options.duration) ? options.duration : 6000;
    if (!options.sticky) {
      setTimeout(() => {
        if (toast.isConnected) {
          toast.classList.add('mathvis-toast--closing');
          toast.remove();
        }
      }, timeout);
    }
    return toast;
  }

  function ensureHtml2Canvas(doc) {
    if (typeof global.html2canvas === 'function') {
      return Promise.resolve(global.html2canvas);
    }
    if (!doc || !doc.head) {
      return Promise.resolve(null);
    }
    if (html2canvasPromise) {
      return html2canvasPromise;
    }
    html2canvasPromise = new Promise(resolve => {
      const script = doc.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      script.async = true;
      script.onload = () => resolve(typeof global.html2canvas === 'function' ? global.html2canvas : null);
      script.onerror = () => resolve(null);
      doc.head.appendChild(script);
    });
    return html2canvasPromise;
  }

  function sanitizeBaseName(value, fallback = 'export') {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const noExt = trimmed.replace(/\.[^/.]+$/u, '');
    return noExt || fallback;
  }

  function sanitizeFilename(str) {
    if (typeof str !== 'string') {
      str = str == null ? '' : String(str);
    }

    const sanitized = str
      .trim()
      .replace(/[\/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/\^/g, '')
      .slice(0, 50);

    return sanitized || 'figur';
  }

  function slugify(input, fallback = 'export') {
    if (typeof input !== 'string') input = '';
    const normalized = input
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^\p{Letter}\p{Number}]+/gu, '-');
    const cleaned = normalized.replace(/^-+|-+$/g, '').toLowerCase();
    if (cleaned) return cleaned;
    return fallback.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export';
  }

  function withSvgFileSuffix(name) {
    return name.toLowerCase().endsWith('.svg') ? name : `${name}.svg`;
  }

  function escapeRegExp(input) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function parseLength(length) {
    if (length == null) return NaN;
    if (typeof length === 'number') return length;
    if (typeof length === 'string') {
      const trimmed = length.trim();
      if (!trimmed) return NaN;
      const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)/);
      if (match) {
        return Number.parseFloat(match[1]);
      }
    }
    return NaN;
  }

  function parseViewBox(viewBoxValue) {
    if (typeof viewBoxValue !== 'string') return null;
    const trimmed = viewBoxValue.trim();
    if (!trimmed) return null;
    const parts = trimmed
      .split(/[\s,]+/)
      .map(part => Number.parseFloat(part))
      .filter(Number.isFinite);
    if (parts.length < 4) return null;
    const [minX, minY, width, height] = parts;
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(width) || !Number.isFinite(height)) {
      return null;
    }
    return { minX, minY, width, height };
  }

  function getSvgCanvasBounds(svgElement, fallbackBounds) {
    if (!svgElement || typeof svgElement !== 'object') {
      return fallbackBounds || { minX: 0, minY: 0, width: 0, height: 0 };
    }
    const boundsOption = fallbackBounds && typeof fallbackBounds === 'object' ? fallbackBounds : null;
    const resolveNumber = (...candidates) => {
      for (const candidate of candidates) {
        const parsed = Number.parseFloat(candidate);
        if (Number.isFinite(parsed)) return parsed;
      }
      return null;
    };
    if (boundsOption) {
      const resolved = {
        minX: resolveNumber(boundsOption.minX, boundsOption.x, 0) ?? 0,
        minY: resolveNumber(boundsOption.minY, boundsOption.y, 0) ?? 0,
        width: resolveNumber(boundsOption.width, boundsOption.w, 0) ?? 0,
        height: resolveNumber(boundsOption.height, boundsOption.h, 0) ?? 0
      };
      if (resolved.width > 0 && resolved.height > 0) {
        return resolved;
      }
    }
    const viewBoxAttr = typeof svgElement.getAttribute === 'function' ? svgElement.getAttribute('viewBox') : null;
    const parsedViewBox = parseViewBox(viewBoxAttr);
    if (parsedViewBox && parsedViewBox.width > 0 && parsedViewBox.height > 0) {
      return parsedViewBox;
    }
    const widthAttr = parseLength(svgElement.getAttribute && svgElement.getAttribute('width'));
    const heightAttr = parseLength(svgElement.getAttribute && svgElement.getAttribute('height'));
    const width = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : getSvgDimensions(svgElement).width;
    const height = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : getSvgDimensions(svgElement).height;
    const xAttr = parseLength(svgElement.getAttribute && svgElement.getAttribute('x'));
    const yAttr = parseLength(svgElement.getAttribute && svgElement.getAttribute('y'));
    return {
      minX: Number.isFinite(xAttr) ? xAttr : 0,
      minY: Number.isFinite(yAttr) ? yAttr : 0,
      width: Number.isFinite(width) ? width : 0,
      height: Number.isFinite(height) ? height : 0
    };
  }

  function ensureSvgBackground(svgElement, options = {}) {
    if (!svgElement || typeof svgElement !== 'object') return null;
    const ownerDocument = svgElement.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!ownerDocument || typeof ownerDocument.createElementNS !== 'function') {
      return null;
    }
    const bounds = getSvgCanvasBounds(svgElement, options.bounds || options);
    if (!(Number.isFinite(bounds.width) && bounds.width > 0 && Number.isFinite(bounds.height) && bounds.height > 0)) {
      return null;
    }
    const ns = 'http://www.w3.org/2000/svg';
    let rect = null;
    let node = svgElement.firstChild;
    while (node) {
      if (node.nodeType === 1 && typeof node.tagName === 'string' && node.tagName.toLowerCase() === 'rect') {
        if (node.getAttribute('data-export-background') === 'true') {
          rect = node;
          break;
        }
      }
      node = node.nextSibling;
    }
    if (!rect) {
      rect = ownerDocument.createElementNS(ns, 'rect');
      rect.setAttribute('data-export-background', 'true');
      const firstElement = svgElement.firstChild;
      if (firstElement) {
        svgElement.insertBefore(rect, firstElement);
      } else {
        svgElement.appendChild(rect);
      }
    } else if (rect !== svgElement.firstChild) {
      svgElement.insertBefore(rect, svgElement.firstChild);
    }
    rect.setAttribute('x', String(bounds.minX || 0));
    rect.setAttribute('y', String(bounds.minY || 0));
    rect.setAttribute('width', String(bounds.width));
    rect.setAttribute('height', String(bounds.height));
    rect.setAttribute('fill', typeof options.fill === 'string' ? options.fill : '#ffffff');
    return rect;
  }

  function getSvgDimensions(svgElement) {
    if (!svgElement || typeof svgElement !== 'object') {
      return { width: 0, height: 0 };
    }
    const viewBox = svgElement.viewBox && svgElement.viewBox.baseVal;
    if (viewBox && Number.isFinite(viewBox.width) && Number.isFinite(viewBox.height)) {
      return { width: viewBox.width, height: viewBox.height };
    }
    const widthAttr = parseLength(svgElement.getAttribute && svgElement.getAttribute('width'));
    const heightAttr = parseLength(svgElement.getAttribute && svgElement.getAttribute('height'));
    if (Number.isFinite(widthAttr) && Number.isFinite(heightAttr) && widthAttr > 0 && heightAttr > 0) {
      return { width: widthAttr, height: heightAttr };
    }
    if (typeof svgElement.getBBox === 'function') {
      try {
        const bbox = svgElement.getBBox();
        if (bbox && Number.isFinite(bbox.width) && Number.isFinite(bbox.height)) {
          return { width: bbox.width || 0, height: bbox.height || 0 };
        }
      } catch (error) {}
    }
    return { width: 1024, height: 768 };
  }

  function ensureMinimumPngDimensions(dimensions, options = {}) {
    const minDimensionOption = Number.isFinite(options.minimum) && options.minimum > 0 ? options.minimum : MINIMUM_PNG_DIMENSION;
    const baseScaleOption = Number.isFinite(options.scale) && options.scale > 0 ? options.scale : 1;
    const widthInput = dimensions && Number.isFinite(dimensions.width) && dimensions.width > 0 ? dimensions.width : minDimensionOption;
    const heightInput = dimensions && Number.isFinite(dimensions.height) && dimensions.height > 0 ? dimensions.height : minDimensionOption;
    const scaledWidth = widthInput * baseScaleOption;
    const scaledHeight = heightInput * baseScaleOption;
    const scaleMultiplier = Math.max(
      1,
      scaledWidth > 0 ? minDimensionOption / scaledWidth : 1,
      scaledHeight > 0 ? minDimensionOption / scaledHeight : 1
    );
    const finalScale = baseScaleOption * scaleMultiplier;
    const finalWidth = Math.max(minDimensionOption, Math.round(widthInput * finalScale));
    const finalHeight = Math.max(minDimensionOption, Math.round(heightInput * finalScale));
    return {
      width: finalWidth,
      height: finalHeight,
      scale: finalScale,
      baseWidth: widthInput,
      baseHeight: heightInput,
      minimum: minDimensionOption
    };
  }

  function ensureSvgNamespaces(svgElement) {
    if (!svgElement || typeof svgElement.setAttribute !== 'function') {
      return svgElement;
    }
    if (!svgElement.getAttribute('xmlns')) {
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!svgElement.getAttribute('xmlns:xlink')) {
      svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }
    return svgElement;
  }

  function parseSvgStringDimensions(svgString) {
    if (typeof svgString !== 'string' || !svgString.trim()) {
      return null;
    }
    if (typeof DOMParser === 'undefined') {
      return null;
    }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      const svgEl = doc && doc.querySelector ? doc.querySelector('svg') : null;
      if (!svgEl) return null;
      const viewBoxAttr = svgEl.getAttribute('viewBox');
      const parsedViewBox = parseViewBox(viewBoxAttr);
      if (parsedViewBox && parsedViewBox.width > 0 && parsedViewBox.height > 0) {
        return { width: parsedViewBox.width, height: parsedViewBox.height };
      }
      const widthAttr = parseLength(svgEl.getAttribute('width'));
      const heightAttr = parseLength(svgEl.getAttribute('height'));
      if (Number.isFinite(widthAttr) && Number.isFinite(heightAttr) && widthAttr > 0 && heightAttr > 0) {
        return { width: widthAttr, height: heightAttr };
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function ensureSvgSizingAttributes(svgElement, sourceElement) {
    if (!svgElement || typeof svgElement.setAttribute !== 'function') {
      return svgElement;
    }
    const source = sourceElement && typeof sourceElement.getAttribute === 'function' ? sourceElement : svgElement;
    const dimensions = getSvgDimensions(source);

    if (!svgElement.getAttribute('viewBox')) {
      const sourceViewBox = source.getAttribute('viewBox');
      if (sourceViewBox) {
        svgElement.setAttribute('viewBox', sourceViewBox);
      } else if (Number.isFinite(dimensions.width) && Number.isFinite(dimensions.height) && dimensions.width > 0 && dimensions.height > 0) {
        svgElement.setAttribute('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);
      }
    }

    if (!svgElement.getAttribute('width')) {
      const sourceWidth = source.getAttribute('width');
      if (sourceWidth) {
        svgElement.setAttribute('width', sourceWidth);
      } else if (Number.isFinite(dimensions.width) && dimensions.width > 0) {
        svgElement.setAttribute('width', String(dimensions.width));
      }
    }

    if (!svgElement.getAttribute('height')) {
      const sourceHeight = source.getAttribute('height');
      if (sourceHeight) {
        svgElement.setAttribute('height', sourceHeight);
      } else if (Number.isFinite(dimensions.height) && dimensions.height > 0) {
        svgElement.setAttribute('height', String(dimensions.height));
      }
    }

    return svgElement;
  }

  function cloneSvgForExport(svgElement) {
    if (!svgElement || typeof svgElement.cloneNode !== 'function') {
      return null;
    }
    const clone = svgElement.cloneNode(true);
    ensureSvgNamespaces(clone);
    ensureSvgSizingAttributes(clone, svgElement);
    applyComputedStylesToClone(svgElement, clone);
    ensureSvgBackground(clone);
    injectDocumentStylesIntoSvg(svgElement.ownerDocument || (typeof document !== 'undefined' ? document : null), clone);
    injectKatexStylesIntoSvg(svgElement.ownerDocument || (typeof document !== 'undefined' ? document : null), clone);
    return clone;
  }

  function getComputedStyleText(computedStyle) {
    if (!computedStyle) return '';
    let cssText = '';
    for (let i = 0; i < computedStyle.length; i += 1) {
      const property = computedStyle[i];
      const value = computedStyle.getPropertyValue(property);
      if (value) {
        cssText += `${property}:${value};`;
      }
    }
    return cssText;
  }

  function removeCssProperty(cssText, property) {
    if (!cssText || !property) return cssText;
    const pattern = new RegExp(`(?:^|;)\\s*${property}\\s*:[^;]*;?`, 'gi');
    let nextText = cssText.replace(pattern, ';');
    nextText = nextText.replace(/;;+/g, ';');
    nextText = nextText.replace(/^\s*;\s*|\s*;\s*$/g, '');
    return nextText.trim();
  }

  function applyComputedStylesToClone(sourceSvg, targetSvg) {
    if (!sourceSvg || !targetSvg) return;
    const doc = sourceSvg.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const view = doc && doc.defaultView ? doc.defaultView : null;
    if (!view || typeof view.getComputedStyle !== 'function') return;

    const sourceElements = [sourceSvg, ...sourceSvg.querySelectorAll('*')];
    const targetElements = [targetSvg, ...targetSvg.querySelectorAll('*')];
    const count = Math.min(sourceElements.length, targetElements.length);
    for (let i = 0; i < count; i += 1) {
      const sourceElement = sourceElements[i];
      const targetElement = targetElements[i];
      if (!targetElement || typeof targetElement.setAttribute !== 'function') continue;
      try {
        const computed = view.getComputedStyle(sourceElement);
        let cssText = getComputedStyleText(computed);
        if (sourceElement.getAttribute && sourceElement.getAttribute('clip-path')) {
          cssText = removeCssProperty(cssText, 'clip-path');
        }
        if (cssText) {
          targetElement.setAttribute('style', cssText);
        }
      } catch (error) {
        // ignore style read errors
      }
    }
  }

  function collectDocumentStyleText(doc) {
    if (!doc) return '';
    const cssParts = [];
    const styleSheets = doc.styleSheets;
    if (styleSheets) {
      for (let i = 0; i < styleSheets.length; i += 1) {
        const sheet = styleSheets[i];
        try {
          if (sheet.cssRules) {
            for (let j = 0; j < sheet.cssRules.length; j += 1) {
              cssParts.push(sheet.cssRules[j].cssText);
            }
          }
        } catch (error) {
          // ignore cross-origin stylesheet errors
        }
      }
    }
    if (typeof doc.querySelectorAll === 'function') {
      const styleNodes = Array.from(doc.querySelectorAll('style'));
      styleNodes.forEach(node => {
        if (node && typeof node.textContent === 'string') {
          cssParts.push(node.textContent.trim());
        }
      });
    }
    return cssParts.filter(Boolean).join('\n');
  }

  function collectKatexStyleText(doc) {
    if (!doc || !doc.styleSheets) return '';
    const parts = [];
    const styleSheets = Array.from(doc.styleSheets);
    styleSheets.forEach(sheet => {
      const href = sheet && sheet.href ? String(sheet.href) : '';
      const ownerId =
        sheet && sheet.ownerNode && sheet.ownerNode.getAttribute ? sheet.ownerNode.getAttribute('id') : '';
      if (!/katex/i.test(href || ownerId)) return;
      try {
        const rules = sheet.cssRules || sheet.rules;
        if (!rules) return;
        Array.from(rules).forEach(rule => {
          if (rule && rule.cssText) {
            parts.push(rule.cssText);
          }
        });
      } catch (error) {
        // ignore cross-origin stylesheet errors
      }
    });
    return parts.join('\n');
  }

  function injectDocumentStylesIntoSvg(doc, svgElement) {
    if (!svgElement || typeof svgElement.querySelector !== 'function') return;
    const cssText = collectDocumentStyleText(doc);
    if (!cssText) return;
    const existing = svgElement.querySelector('style[data-exported-styles="true"]');
    if (existing) {
      existing.textContent = cssText;
      return;
    }
    const ownerDocument = svgElement.ownerDocument || doc;
    if (!ownerDocument || typeof ownerDocument.createElementNS !== 'function') return;
    const style = ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.setAttribute('data-exported-styles', 'true');
    style.textContent = cssText;
    const firstChild = svgElement.firstChild;
    if (firstChild) {
      svgElement.insertBefore(style, firstChild);
    } else {
      svgElement.appendChild(style);
    }
  }

  function injectKatexStylesIntoSvg(doc, svgElement) {
    if (!svgElement || typeof svgElement.querySelector !== 'function') return;
    const cssText = collectKatexStyleText(doc);
    if (!cssText) return;
    const existing = svgElement.querySelector('style[data-exported-katex-style="true"]');
    if (existing) {
      existing.textContent = cssText;
      return;
    }
    const ownerDocument = svgElement.ownerDocument || doc;
    if (!ownerDocument || typeof ownerDocument.createElementNS !== 'function') return;
    const style = ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.setAttribute('data-exported-katex-style', 'true');
    style.textContent = cssText;
    const firstChild = svgElement.firstChild;
    if (firstChild) {
      svgElement.insertBefore(style, firstChild);
    } else {
      svgElement.appendChild(style);
    }
  }

  function collectForeignObjectStyles(svgElement) {
    if (!svgElement) return [];
    const doc = svgElement.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const view = doc && doc.defaultView ? doc.defaultView : null;
    if (!view || typeof view.getComputedStyle !== 'function') return [];
    const foreignObjects = svgElement.querySelectorAll('foreignObject');
    return Array.from(foreignObjects, foreignObject => {
      const target = foreignObject.firstElementChild || foreignObject;
      const computed = view.getComputedStyle(target);
      const getProp = prop => {
        const value = computed.getPropertyValue(prop);
        return value ? value.trim() : '';
      };
      return {
        fontFamily: getProp('font-family'),
        fontSize: getProp('font-size'),
        fontWeight: getProp('font-weight'),
        fontStyle: getProp('font-style'),
        color: getProp('color'),
        lineHeight: getProp('line-height')
      };
    });
  }

  function normalizeForeignObjectText(text) {
    if (typeof text !== 'string') return '';
    let normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    if (normalized.startsWith('$') && normalized.endsWith('$') && normalized.length > 1) {
      normalized = normalized.replace(/^\$+|\$+$/g, '').trim();
    }
    return normalized;
  }

  function resolveForeignObjectFontFamily(foreignObject, styleInfo, options = {}) {
    if (options.fontFamily) return options.fontFamily;
    if (styleInfo && styleInfo.fontFamily) return styleInfo.fontFamily;
    if (foreignObject && typeof foreignObject.querySelector === 'function' && foreignObject.querySelector('.katex')) {
      return '"KaTeX_Main", "Times New Roman", Times, serif';
    }
    return '"Inter", "Segoe UI", system-ui, sans-serif';
  }

  function replaceForeignObjectsWithText(svgElement, styleData, options = {}) {
    if (!svgElement || typeof svgElement.querySelectorAll !== 'function') return;
    const foreignObjects = Array.from(svgElement.querySelectorAll('foreignObject'));
    foreignObjects.forEach((foreignObject, index) => {
      const parent = foreignObject.parentNode;
      if (!parent) return;
      const textContent = normalizeForeignObjectText(foreignObject.textContent || '');
      if (!textContent) {
        parent.removeChild(foreignObject);
        return;
      }
      const doc = foreignObject.ownerDocument;
      if (!doc || typeof doc.createElementNS !== 'function') return;
      const textEl = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
      const width = parseLength(foreignObject.getAttribute('width'));
      const height = parseLength(foreignObject.getAttribute('height'));
      const x = parseLength(foreignObject.getAttribute('x'));
      const y = parseLength(foreignObject.getAttribute('y'));
      const centerX = Number.isFinite(width) && Number.isFinite(x) ? x + width / 2 : Number.isFinite(x) ? x : 0;
      const centerY = Number.isFinite(height) && Number.isFinite(y) ? y + height / 2 : Number.isFinite(y) ? y : 0;
      textEl.setAttribute('x', String(centerX));
      textEl.setAttribute('y', String(centerY));
      textEl.setAttribute('text-anchor', 'middle');
      textEl.setAttribute('dominant-baseline', 'middle');
      textEl.setAttribute('xml:space', 'preserve');
      const existingClass = foreignObject.getAttribute('class');
      const fallbackClass = existingClass ? `${existingClass} foreign-object-fallback` : 'foreign-object-fallback';
      textEl.setAttribute('class', fallbackClass);
      textEl.textContent = textContent;

      const styleInfo = Array.isArray(styleData) ? styleData[index] : null;
      const fontFamily = resolveForeignObjectFontFamily(foreignObject, styleInfo, options);
      if (fontFamily) {
        textEl.setAttribute('font-family', fontFamily);
      }
      if (styleInfo) {
        if (styleInfo.fontSize) {
          textEl.setAttribute('font-size', styleInfo.fontSize);
        }
        if (styleInfo.fontWeight && styleInfo.fontWeight !== 'normal') {
          textEl.setAttribute('font-weight', styleInfo.fontWeight);
        }
        if (styleInfo.fontStyle && styleInfo.fontStyle !== 'normal') {
          textEl.setAttribute('font-style', styleInfo.fontStyle);
        }
        if (styleInfo.color) {
          textEl.setAttribute('fill', styleInfo.color);
        }
        if (styleInfo.lineHeight && styleInfo.lineHeight !== 'normal') {
          textEl.setAttribute('line-height', styleInfo.lineHeight);
        }
      }

      parent.replaceChild(textEl, foreignObject);
    });
  }

  function resolveImageHref(imageElement) {
    if (!imageElement || typeof imageElement.getAttribute !== 'function') return '';
    return (
      imageElement.getAttribute('href') ||
      imageElement.getAttribute('xlink:href') ||
      imageElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
      imageElement.getAttribute('src') ||
      ''
    );
  }

  async function inlineExternalImages(svgElement, options = {}) {
    const doc = options.doc || (svgElement ? svgElement.ownerDocument : null) || (typeof document !== 'undefined' ? document : null);
    const baseUri = (doc && doc.baseURI) || (typeof location !== 'undefined' ? location.href : '');
    const images = svgElement && typeof svgElement.querySelectorAll === 'function' ? Array.from(svgElement.querySelectorAll('image')) : [];
    const externalResources = [];
    const inlinedResources = [];
    const failedResources = [];

    for (const image of images) {
      let href = resolveImageHref(image);
      if (!href) continue;
      href = href.trim();
      if (!href || href.startsWith('data:') || href.startsWith('#')) continue;
      let resolvedUrl = href;
      try {
        resolvedUrl = new URL(href, baseUri).toString();
      } catch (error) {
        resolvedUrl = href;
      }
      externalResources.push(resolvedUrl);
      if (typeof global.fetch !== 'function') {
        failedResources.push({ url: resolvedUrl, error: 'fetch er ikke tilgjengelig' });
        continue;
      }
      try {
        const response = await fetchWithTimeout(resolvedUrl, { mode: 'cors', credentials: 'omit' }, options.timeoutMs || 5000);
        if (!response || !response.ok) {
          throw new Error(`status ${response ? response.status : 'ukjent'}`);
        }
        const blob = await response.blob();
        const dataUrl = await blobToBase64DataUrl(blob);
        if (!dataUrl) {
          throw new Error('kunne ikke lage data-URL');
        }
        image.setAttribute('href', dataUrl);
        image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', dataUrl);
        if (image.hasAttribute('xlink:href')) {
          image.setAttribute('xlink:href', dataUrl);
        }
        if (image.hasAttribute('src')) {
          image.setAttribute('src', dataUrl);
        }
        inlinedResources.push(resolvedUrl);
      } catch (error) {
        failedResources.push({
          url: resolvedUrl,
          error: error && error.message ? error.message : String(error)
        });
      }
    }

    return {
      externalResources,
      inlinedResources,
      failedResources
    };
  }

  function parseSvgString(svgString) {
    if (typeof svgString !== 'string' || !svgString.trim()) return null;
    if (typeof DOMParser === 'undefined') return null;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, 'image/svg+xml');
      return doc && doc.querySelector ? doc.querySelector('svg') : null;
    } catch (error) {
      return null;
    }
  }

  async function preprocessSvgForExport(options = {}) {
    const doc = options.doc || (typeof document !== 'undefined' ? document : null);
    let svgElement = options.svgElement || null;
    let workingSvg = null;
    const foreignObjectStyles = svgElement ? collectForeignObjectStyles(svgElement) : [];
    if (typeof options.svgString === 'string') {
      const parsedSvg = parseSvgString(options.svgString);
      if (parsedSvg) {
        workingSvg = parsedSvg;
        ensureSvgNamespaces(workingSvg);
        ensureSvgSizingAttributes(workingSvg, workingSvg);
        ensureSvgBackground(workingSvg, options.bounds || {});
        injectDocumentStylesIntoSvg(doc, workingSvg);
        injectKatexStylesIntoSvg(doc, workingSvg);
      }
    }

    if (!workingSvg && svgElement) {
      workingSvg = cloneSvgForExport(svgElement);
    }

    if (!workingSvg) {
      return {
        svgElement: null,
        svgString: options.svgString || '',
        externalResources: [],
        inlinedResources: [],
        failedResources: []
      };
    }

    if (options.backgroundColor) {
      ensureSvgBackground(workingSvg, { bounds: options.bounds || {}, fill: options.backgroundColor });
    }

    const shouldConvertForeignObjects = options.convertForeignObjectsToText !== false;
    if (shouldConvertForeignObjects) {
      replaceForeignObjectsWithText(workingSvg, foreignObjectStyles, {
        fontFamily: options.foreignObjectFontFamily
      });
    }

    const resourceStatus = await inlineExternalImages(workingSvg, { doc, timeoutMs: options.timeoutMs });
    let svgString = options.svgString || '';
    try {
      svgString = new XMLSerializer().serializeToString(workingSvg);
    } catch (error) {
      // keep previous svgString
    }

    return {
      svgElement: workingSvg,
      svgString,
      ...resourceStatus
    };
  }

  function buildTaintLogMessage(context, info, error) {
    const failed = info && Array.isArray(info.failedResources) ? info.failedResources : [];
    const external = info && Array.isArray(info.externalResources) ? info.externalResources : [];
    const lines = [`${context} (tainted canvas).`];
    if (failed.length) {
      lines.push('Feil ved innlasting av ressurser:');
      failed.forEach(entry => {
        lines.push(`- ${entry.url}${entry.error ? ` (${entry.error})` : ''}`);
      });
    } else if (external.length) {
      lines.push('Eksterne ressurser funnet:');
      external.forEach(url => lines.push(`- ${url}`));
    }
    if (error && error.message) {
      lines.push(`Original feil: ${error.message}`);
    }
    return lines.join('\n');
  }

  function dataUrlToBlob(dataUrl) {
    if (typeof dataUrl !== 'string') return null;
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const header = parts[0];
    const data = parts.slice(1).join(',');
    const mimeMatch = header.match(/^data:([^;,]+)(?:;base64)?/i);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const isBase64 = /;base64/i.test(header);
    try {
      if (isBase64 && typeof global.atob === 'function') {
        const binary = global.atob(data);
        const length = binary.length;
        const bytes = new Uint8Array(length);
        for (let i = 0; i < length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return new Blob([bytes], { type: mimeType });
      }
      const decoded = decodeURIComponent(data);
      return new Blob([decoded], { type: mimeType });
    } catch (error) {
      return null;
    }
  }

  function blobToDataUrl(blob) {
    if (!(blob instanceof Blob)) return null;
    if (typeof global.FileReader !== 'function') {
      return null;
    }
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            resolve(null);
          }
        };
        reader.onerror = () => reject(reader.error || new Error('Kunne ikke lese PNG-blob.'));
        reader.readAsDataURL(blob);
      } catch (error) {
        reject(error);
      }
    }).catch(() => null);
  }

  async function blobToBase64DataUrl(blob) {
    if (!(blob instanceof Blob)) return null;
    const readerResult = await Promise.resolve(blobToDataUrl(blob)).catch(() => null);
    if (typeof readerResult === 'string') {
      return readerResult;
    }
    if (typeof blob.arrayBuffer !== 'function' || typeof global.btoa !== 'function') {
      return null;
    }
    try {
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      return `data:${blob.type || 'image/png'};base64,${global.btoa(binary)}`;
    } catch (error) {
      return null;
    }
  }

  function triggerDownload(doc, href, filename) {
    if (!href || !doc || !doc.body) return;
    const anchor = doc.createElement('a');
    anchor.href = href;
    anchor.download = filename;
    anchor.rel = 'noopener';
    anchor.style.display = 'none';
    doc.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function ensureArchiveEntries() {
    if (archiveEntriesPromise) return archiveEntriesPromise;
    if (typeof global.fetch !== 'function') {
      archiveEntriesPromise = Promise.resolve([]);
      return archiveEntriesPromise;
    }
    archiveEntriesPromise = fetchWithTimeout(
      '/api/svg',
      {
        headers: {
          Accept: 'application/json'
        }
      },
      ARCHIVE_ENTRIES_TIMEOUT_MS
    )
      .then(response => {
        if (!response || !response.ok) {
          return [];
        }
        return response
          .json()
          .then(payload => (Array.isArray(payload && payload.entries) ? payload.entries : []))
          .catch(() => []);
      })
      .catch(() => []);
    archiveEntriesPromise = archiveEntriesPromise.then(entries => (Array.isArray(entries) ? entries : []));
    return archiveEntriesPromise;
  }

  function extractArchiveBaseName(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
    if (slug) {
      const parts = slug.split('/');
      const last = parts[parts.length - 1];
      if (last) return last;
    }
    const title = typeof entry.title === 'string' ? entry.title.trim() : '';
    if (title) return title;
    return null;
  }

  async function suggestArchiveBaseName(toolId, fallback) {
    const tool = typeof toolId === 'string' && toolId.trim() ? toolId.trim() : 'export';
    const sanitizedTool = sanitizeBaseName(tool, 'export');
    const fallbackBase = sanitizeBaseName(fallback || `${sanitizedTool || 'export'}1`, sanitizedTool || 'export');
    const entries = await ensureArchiveEntries();
    if (!Array.isArray(entries) || !entries.length) {
      return fallbackBase || `${sanitizedTool || 'export'}1`;
    }
    const normalizedTool = tool.toLowerCase();
    const pattern = new RegExp(`^${escapeRegExp(sanitizedTool)}(\\d+)$`, 'i');
    let maxIndex = 0;
    for (const entry of entries) {
      const entryTool = entry && typeof entry.tool === 'string' ? entry.tool.trim() : '';
      if (!entryTool) continue;
      if (entryTool.toLowerCase() !== normalizedTool) continue;
      const baseName = extractArchiveBaseName(entry);
      if (!baseName) continue;
      const match = baseName.match(pattern);
      if (!match) continue;
      const index = Number.parseInt(match[1], 10);
      if (Number.isFinite(index) && index > maxIndex) {
        maxIndex = index;
      }
    }
    const nextIndex = maxIndex + 1 || 1;
    return `${sanitizedTool}${nextIndex}`;
  }

  async function waitForDocumentFonts(doc) {
    if (!doc) return;
    const fontSet = doc.fonts;
    if (fontSet) {
      if (fontSet.ready && typeof fontSet.ready.then === 'function') {
        try {
          await fontSet.ready;
          return;
        } catch (error) {
          // ignore errors from fonts.ready and fall back to manual loading
        }
      }
      if (typeof fontSet.load === 'function') {
        const fontFamilies = ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'];
        const fontSpecs = [];
        fontFamilies.forEach(family => {
          const quoted = family.includes(' ') ? `"${family}"` : family;
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
        } catch (error) {
          // ignore font loading errors
        }
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  async function renderSvgToPng(doc, svgUrl, svgString, dimensions, options = {}) {
    if (!doc) throw new Error('document mangler');
    await waitForDocumentFonts(doc);
    const preprocessInfo = await preprocessSvgForExport({
      doc,
      svgElement: options.sourceElement || null,
      svgString,
      bounds: dimensions,
      backgroundColor: options.backgroundColor
    });
    const exportSvgString = preprocessInfo && preprocessInfo.svgString ? preprocessInfo.svgString : svgString;
    const canvas = doc.createElement('canvas');
    const sizing = ensureMinimumPngDimensions(dimensions);
    const width = sizing.width;
    const height = sizing.height;
    canvas.width = width;
    canvas.height = height;
    const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    if (!ctx) {
      throw new Error('Canvas 2D-kontekst er ikke tilgjengelig');
    }
    const img = doc.createElement('img');
    img.decoding = 'async';
    if ('crossOrigin' in img) {
      img.crossOrigin = 'anonymous';
    }
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(exportSvgString)}`;
    const loadSvgImage = src =>
      new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Kunne ikke laste SVG for PNG-konvertering'));
        img.src = src;
      });
    try {
      await loadSvgImage(svgDataUrl);
    } catch (error) {
      if (!svgUrl) {
        throw error;
      }
      await loadSvgImage(svgUrl);
    }
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    const mimeType = 'image/png';
    let blob = null;
    if (typeof canvas.convertToBlob === 'function') {
      try {
        blob = await canvas.convertToBlob({ type: mimeType });
      } catch (error) {
        blob = null;
      }
    }
    if (!blob && typeof canvas.toBlob === 'function') {
      blob = await new Promise(resolve => {
        try {
          canvas.toBlob(result => {
            resolve(result || null);
          }, mimeType);
        } catch (error) {
          resolve(null);
        }
      });
    }
    let dataUrl = null;
    if (blob) {
      dataUrl = await blobToDataUrl(blob);
    }
    if (!dataUrl) {
      try {
        dataUrl = canvas.toDataURL(mimeType);
      } catch (error) {
        const logMessage = buildTaintLogMessage('PNG-eksport feilet', preprocessInfo, error);
        console.error(logMessage);
        throw new Error(logMessage);
      }
      if (!blob) {
        blob = dataUrlToBlob(dataUrl);
      }
    }
    if (!blob) {
      throw new Error('Kunne ikke lage PNG-blob');
    }
    return { dataUrl, blob, width, height };
  }

  async function renderSvgToPngWithHtml2Canvas(svgElement, options = {}) {
    if (!svgElement || typeof svgElement !== 'object') return null;
    const doc = svgElement.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.body) {
      throw new Error('document mangler');
    }
    const html2canvas = await ensureHtml2Canvas(doc);
    if (typeof html2canvas !== 'function') return null;
    const host = doc.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-10000px';
    host.style.top = '-10000px';
    host.style.opacity = '0';
    host.style.pointerEvents = 'none';
    host.style.zIndex = '-1';
    const preprocessInfo = await preprocessSvgForExport({
      doc,
      svgElement,
      bounds: options.bounds || {},
      backgroundColor: options.backgroundColor,
      convertForeignObjectsToText: false
    });
    const clone = preprocessInfo.svgElement || svgElement.cloneNode(true);
    if (typeof ensureSvgBackground === 'function') {
      ensureSvgBackground(clone, options.bounds || {});
    }
    host.appendChild(clone);
    doc.body.appendChild(host);

    try {
      const ratio = typeof global.devicePixelRatio === 'number' && global.devicePixelRatio > 0 ? global.devicePixelRatio : 1;
      const scale = Math.max(2, ratio);
      const canvas = await html2canvas(clone, {
        backgroundColor: options.backgroundColor || '#fff',
        scale,
        useCORS: true,
        foreignObjectRendering: true,
        logging: false
      });
      if (!canvas) {
        throw new Error('html2canvas returnerte ingen canvas');
      }
      return await canvasToPngData(canvas, 'html2canvas PNG-eksport feilet', preprocessInfo);
    } finally {
      if (host && host.parentNode) {
        host.parentNode.removeChild(host);
      }
    }
  }

  async function canvasToPngData(canvas, contextLabel, preprocessInfo) {
    if (!canvas) {
      throw new Error('Kunne ikke lage PNG uten canvas');
    }
    let blob = null;
    if (typeof canvas.convertToBlob === 'function') {
      try {
        blob = await canvas.convertToBlob({ type: 'image/png' });
      } catch (error) {
        blob = null;
      }
    }
    if (!blob && typeof canvas.toBlob === 'function') {
      blob = await new Promise(resolve => {
        try {
          canvas.toBlob(result => resolve(result || null), 'image/png');
        } catch (error) {
          resolve(null);
        }
      });
    }
    let dataUrl = null;
    if (blob) {
      dataUrl = await blobToDataUrl(blob);
    }
    if (!dataUrl) {
      try {
        dataUrl = canvas.toDataURL('image/png');
      } catch (error) {
        const logMessage = buildTaintLogMessage(contextLabel || 'PNG-eksport feilet', preprocessInfo, error);
        console.error(logMessage);
        throw new Error(logMessage);
      }
      if (!blob) {
        blob = dataUrlToBlob(dataUrl);
      }
    }
    if (!blob) {
      throw new Error('Kunne ikke lage PNG-blob');
    }
    return {
      dataUrl,
      blob,
      width: canvas.width,
      height: canvas.height
    };
  }

  async function renderHtmlTargetToPng(htmlTarget, options = {}) {
    if (!htmlTarget || typeof htmlTarget !== 'object') return null;
    const doc = htmlTarget.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.body) {
      throw new Error('document mangler');
    }
    const html2canvas = await ensureHtml2Canvas(doc);
    if (typeof html2canvas !== 'function') return null;
    await waitForDocumentFonts(doc);
    const ratio = typeof global.devicePixelRatio === 'number' && global.devicePixelRatio > 0 ? global.devicePixelRatio : 1;
    const scale = Math.max(2, ratio);
    const canvas = await html2canvas(htmlTarget, {
      backgroundColor: options.backgroundColor || '#fff',
      scale,
      useCORS: true,
      foreignObjectRendering: true,
      logging: false
    });
    if (!canvas) {
      throw new Error('html2canvas returnerte ingen canvas');
    }
    return canvasToPngData(canvas, 'html2canvas PNG-eksport feilet', null);
  }

  async function resolvePngExport({
    doc,
    svgElement,
    svgUrl,
    svgString,
    dimensions,
    backgroundColor,
    htmlTarget,
    fallbackOrder
  }) {
    const resolvedOrder = fallbackOrder === 'svg-first' ? ['svg', 'html'] : ['html', 'svg'];
    let pngResult = null;
    let pngError = null;
    for (const strategy of resolvedOrder) {
      try {
        if (strategy === 'svg') {
          pngResult = await renderSvgToPng(doc, svgUrl, svgString, dimensions, {
            sourceElement: svgElement,
            backgroundColor
          });
        } else {
          if (htmlTarget) {
            pngResult = await renderHtmlTargetToPng(htmlTarget, {
              backgroundColor
            });
          } else if (svgElement) {
            pngResult = await renderSvgToPngWithHtml2Canvas(svgElement, {
              backgroundColor,
              bounds: dimensions || {}
            });
          } else {
            pngResult = null;
          }
        }
        if (pngResult) {
          pngError = null;
          break;
        }
      } catch (error) {
        pngError = error;
      }
    }
    return { pngResult, pngError };
  }

  async function exportGraphicWithArchive(svgElement, suggestedName, toolId, options = {}) {
    if (!svgElement) throw new Error('svgElement mangler');
    const doc = svgElement.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) throw new Error('document mangler');

    const exportSvg = cloneSvgForExport(svgElement) || svgElement;
    const serializer = options.serialize;
    let svgString;
    if (options.svgString != null) {
      svgString = await Promise.resolve(options.svgString);
    } else if (typeof serializer === 'function') {
      svgString = await Promise.resolve(serializer(exportSvg));
    } else {
      svgString = new XMLSerializer().serializeToString(exportSvg);
    }

    const tool = typeof toolId === 'string' && toolId.trim() ? toolId.trim() : 'ukjent';
    const description = typeof options.description === 'string' ? options.description.trim() : '';
    const summary = options.summary != null ? options.summary : null;
    const createdAt = new Date().toISOString();

    const dimensions = parseSvgStringDimensions(svgString) || getSvgDimensions(exportSvg);

    const fallbackBase = sanitizeBaseName(options.defaultBaseName || suggestedName || tool || 'export', sanitizeBaseName(tool || 'export'));
    let baseNameSuggestion;
    try {
      baseNameSuggestion = await suggestArchiveBaseName(tool, fallbackBase);
    } catch (error) {
      baseNameSuggestion = fallbackBase || 'export1';
    }
    const sanitizedDefault = sanitizeBaseName(baseNameSuggestion || fallbackBase || tool || 'export', fallbackBase || tool || 'export');

    let baseName = sanitizedDefault;
    if (typeof global.prompt === 'function') {
      const response = global.prompt('Filnavn for eksport (uten filendelse)', sanitizedDefault);
      if (typeof response === 'string' && response.trim()) {
        baseName = sanitizeBaseName(response.trim(), sanitizedDefault);
      }
    }
    if (!baseName) {
      baseName = sanitizeBaseName(tool, 'export') || 'export';
    }

    const svgFilename = withSvgFileSuffix(baseName);
    const pngFilename = `${baseName}.png`;

    const svgBlob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const urlApi = global.URL || (typeof URL !== 'undefined' ? URL : null);
    const svgUrl = urlApi ? urlApi.createObjectURL(svgBlob) : null;

    let pngData = null;
    let pngUrl = null;
    const fallbackOrder = options.pngFallbackOrder === 'svg-first' ? 'svg-first' : 'html-first';
    const htmlTarget = options.htmlTarget || null;
    const { pngResult, pngError } = await resolvePngExport({
      doc,
      svgElement: exportSvg,
      svgUrl,
      svgString,
      dimensions,
      backgroundColor: options.backgroundColor || '#fff',
      htmlTarget,
      fallbackOrder
    });
    if (pngResult) {
      pngData = pngResult;
      if (pngData && pngData.blob && !pngData.dataUrl) {
        pngData.dataUrl = await blobToBase64DataUrl(pngData.blob);
      }
      if (urlApi) {
        pngUrl = urlApi.createObjectURL(pngResult.blob);
      }
    }

    const shouldDownloadSvg = options.downloadSvg !== false;
    const shouldDownloadPng = options.downloadPng !== false;
    const shouldDownloadMetadata = options.downloadMetadata !== false;

    if (shouldDownloadSvg) {
      if (svgUrl) {
        triggerDownload(doc, svgUrl, svgFilename);
      } else {
        triggerDownload(doc, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`, svgFilename);
      }
    }
    if (shouldDownloadPng) {
      if (pngUrl) {
        triggerDownload(doc, pngUrl, pngFilename);
      } else if (pngData && pngData.dataUrl) {
        triggerDownload(doc, pngData.dataUrl, pngFilename);
      }
    }

    if (urlApi && svgUrl) {
      setTimeout(() => {
        try {
          urlApi.revokeObjectURL(svgUrl);
        } catch (error) {}
      }, 1000);
    }
    if (urlApi && pngUrl) {
      setTimeout(() => {
        try {
          urlApi.revokeObjectURL(pngUrl);
        } catch (error) {}
      }, 1000);
    }

    if (pngError && !pngData) {
      const message = pngError && pngError.message ? pngError.message : String(pngError || 'Ukjent feil');
      showToast(`PNG feilet: ${message}.`, 'error');
    }

    const slugOverride = typeof options.slug === 'string' ? options.slug.trim() : '';
    const slugSegment = slugOverride
      ? slugify(slugOverride, sanitizeBaseName(tool, 'export'))
      : slugify(baseName, sanitizeBaseName(tool, 'export'));
    const slug = `bildearkiv/${slugSegment}`;
    const title = typeof options.title === 'string' && options.title.trim() ? options.title.trim() : baseName;

    let exampleState;
    let serializedExampleState = null;
    if (global && typeof global === 'object') {
      try {
        exampleState = global.MathVisExamples?.collectCurrentState?.();
        if (exampleState !== undefined) {
          const stringified = JSON.stringify(exampleState);
          if (typeof stringified === 'string') {
            serializedExampleState = stringified;
          }
        }
      } catch (error) {
        // Ignorer feil fra eksempelinnhenting for å unngå å stoppe eksport.
      }
    }

    const summaryAltText =
      options && typeof options.summary === 'object' && options.summary !== null
        ? options.summary.altText
        : null;
    const altFromSummary = typeof summaryAltText === 'string' ? summaryAltText.trim() : '';
    const altOption = typeof options.alt === 'string' ? options.alt : options.altText;
    const altFromOptions = typeof altOption === 'string' ? altOption.trim() : '';
    const altText = altFromOptions || altFromSummary || description;

    let metadata = {
      slug,
      tool,
      alt: altText || null,
      createdAt,
      exampleState: exampleState !== undefined ? exampleState : null
    };

    const payload = {
      title,
      tool,
      toolId: tool,
      slug,
      baseName,
      filename: svgFilename,
      svg: svgString,
      createdAt
    };
    if (pngData && pngData.dataUrl) {
      payload.png = pngData.dataUrl;
      if (Number.isFinite(pngData.width)) {
        payload.pngWidth = Number(pngData.width);
      }
      if (Number.isFinite(pngData.height)) {
        payload.pngHeight = Number(pngData.height);
      }
    }
    if (summary != null) {
      payload.summary = summary;
    }
    if (description) {
      payload.description = description;
    }
    if (altText) {
      payload.altText = altText;
    }
    if (serializedExampleState) {
      payload.exampleState = serializedExampleState;
    }

    let metadataString;
    try {
      metadataString = JSON.stringify(metadata, null, 2);
    } catch (error) {
      metadata = { ...metadata, exampleState: null };
      metadataString = JSON.stringify(metadata, null, 2);
    }

    const metadataBlob = new Blob([metadataString], {
      type: 'application/json;charset=utf-8'
    });
    let metadataUrl = null;
    if (urlApi) {
      metadataUrl = urlApi.createObjectURL(metadataBlob);
    }

    let uploadPromise = null;
    const canUpload = typeof payload.svg === 'string' && payload.svg.trim().length > 0;
    const hasPng = typeof payload.png === 'string' && payload.png.trim().length > 0;
    if (typeof global.fetch === 'function' && canUpload && hasPng) {
      uploadPromise = global.fetch('/api/svg', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
        .then(response => {
          if (response && response.ok) {
            if (hasPng) {
              showToast(`Grafikk lastet ned og arkivert som ${baseName}.`, 'success');
            } else {
              showToast(`Grafikk lastet ned og arkivert som ${baseName} (uten PNG).`, 'success');
            }
            return response;
          }
          const status = response ? response.status : 'ukjent';
          showToast(`Grafikk lastet ned, men arkivopplasting feilet (status ${status}).`, 'error');
          return response;
        })
        .catch(error => {
          const message = error && error.message ? error.message : String(error);
          showToast(`Grafikk lastet ned, men arkivopplasting feilet: ${message}.`, 'error');
          throw error;
        });
    } else if (typeof global.fetch === 'function' && canUpload && !hasPng) {
      showToast('PNG mangler, så arkivopplasting ble hoppet over.', 'error');
    } else if (typeof global.fetch !== 'function') {
      const downloadedFiles = [];
      if (shouldDownloadSvg) downloadedFiles.push(svgFilename);
      if (shouldDownloadPng) downloadedFiles.push(pngFilename);
      const downloadLabel = downloadedFiles.length ? downloadedFiles.join(' og ') : 'ingen filer';
      showToast(`Grafikk lastet ned som ${downloadLabel}. (Arkivopplasting ikke tilgjengelig.)`, 'info');
    } else if (!canUpload) {
      showToast(`Grafikk lastet ned, men SVG-data manglet. Arkivopplasting ble hoppet over.`, 'warning');
    }

    const metadataFilename = `${slugSegment || sanitizeBaseName(baseName, 'export')}.json`;
    if (shouldDownloadMetadata) {
      if (metadataUrl) {
        triggerDownload(doc, metadataUrl, metadataFilename);
      } else {
        triggerDownload(
          doc,
          `data:application/json;charset=utf-8,${encodeURIComponent(metadataString)}`,
          metadataFilename
        );
      }
    }

    if (urlApi && metadataUrl) {
      setTimeout(() => {
        try {
          urlApi.revokeObjectURL(metadataUrl);
        } catch (error) {}
      }, 1000);
    }

    return {
      baseName,
      slug,
      title,
      tool,
      description,
      createdAt,
      dimensions,
      svg: {
        filename: svgFilename,
        blob: svgBlob,
        data: svgString
      },
      png: pngData
        ? {
            filename: pngFilename,
            blob: pngData.blob,
            dataUrl: pngData.dataUrl,
            width: pngData.width,
            height: pngData.height
          }
        : {
            filename: pngFilename,
            blob: null,
            dataUrl: null,
            width: dimensions.width,
            height: dimensions.height
          },
      pngError: pngError || null,
      payload,
      uploadPromise,
      metadata
    };
  }

  async function exportSvgWithArchive(svgElement, suggestedName, toolId, options = {}) {
    const result = await exportGraphicWithArchive(svgElement, suggestedName, toolId, options);
    return {
      filename: result && result.svg ? result.svg.filename : null,
      slug: result ? result.slug : null,
      description: result ? result.description : '',
      uploadPromise: result ? result.uploadPromise : null
    };
  }

  async function exportGraphicWithArchiveWithFallback(config = {}) {
    if (!config || typeof config !== 'object') {
      throw new Error('exportGraphicWithArchiveWithFallback trenger et konfigurasjonsobjekt');
    }
    const { svgElement, htmlTarget, suggestedName, toolId, ...options } = config;
    return exportGraphicWithArchive(svgElement, suggestedName, toolId, {
      ...options,
      htmlTarget,
      pngFallbackOrder: 'svg-first',
      downloadSvg: options.downloadSvg ?? false,
      downloadMetadata: options.downloadMetadata ?? false
    });
  }

  helper.exportGraphicWithArchive = exportGraphicWithArchive;
  helper.exportGraphicWithArchiveWithFallback = exportGraphicWithArchiveWithFallback;
  helper.exportSvgWithArchive = exportSvgWithArchive;
  helper.slugify = slugify;
  helper.showToast = showToast;
  helper.cloneSvgForExport = cloneSvgForExport;
  helper.ensureSvgBackground = ensureSvgBackground;
  helper.getSvgCanvasBounds = getSvgCanvasBounds;
  helper.getSvgDimensions = getSvgDimensions;
  helper.ensureMinimumPngDimensions = ensureMinimumPngDimensions;
  helper.MINIMUM_PNG_DIMENSION = MINIMUM_PNG_DIMENSION;
  helper.renderSvgToPng = renderSvgToPng;
  helper.ensureSvgNamespaces = ensureSvgNamespaces;
  helper.sanitizeFilename = sanitizeFilename;

  global.MathVisSvgExport = helper;
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
