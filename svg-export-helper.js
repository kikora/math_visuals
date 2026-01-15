(function (global) {
  if (typeof global !== 'object' || !global) return;

  const helper = {};
  const MINIMUM_PNG_DIMENSION = 100;
  let toastStyleInjected = false;
  let toastContainer = null;
  let archiveEntriesPromise = null;
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
    ensureSvgBackground(clone);
    return clone;
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

  async function renderSvgToPng(doc, svgUrl, svgString, dimensions) {
    if (!doc) throw new Error('document mangler');
    await waitForDocumentFonts(doc);
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
    const svgDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    const loadSvgImage = src =>
      new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Kunne ikke laste SVG for PNG-konvertering'));
        img.src = src;
      });
    try {
      await loadSvgImage(svgUrl || svgDataUrl);
    } catch (error) {
      if (!svgUrl) {
        throw error;
      }
      await loadSvgImage(svgDataUrl);
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
    let pngDataUrl = null;
    if (blob) {
      pngDataUrl = await blobToDataUrl(blob);
    }
    if (!pngDataUrl) {
      try {
        pngDataUrl = canvas.toDataURL(mimeType);
      } catch (error) {
        throw new Error('Kunne ikke generere PNG-data-URL');
      }
      if (!blob) {
        blob = dataUrlToBlob(pngDataUrl);
      }
    }
    if (!blob) {
      throw new Error('Kunne ikke lage PNG-blob');
    }
    return { dataUrl: pngDataUrl, blob, width, height };
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
    let pngError = null;
    try {
      const pngResult = await renderSvgToPng(doc, svgUrl, svgString, dimensions);
      pngData = pngResult;
      if (urlApi) {
        pngUrl = urlApi.createObjectURL(pngResult.blob);
      }
    } catch (error) {
      pngError = error;
    }

    if (svgUrl) {
      triggerDownload(doc, svgUrl, svgFilename);
    } else {
      triggerDownload(doc, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`, svgFilename);
    }
    if (pngUrl) {
      triggerDownload(doc, pngUrl, pngFilename);
    } else if (pngData && pngData.dataUrl) {
      triggerDownload(doc, pngData.dataUrl, pngFilename);
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

    if (pngError) {
      const message = pngError && pngError.message ? pngError.message : 'Ukjent feil';
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
    if (typeof global.fetch === 'function' && canUpload) {
      if (!hasPng && typeof global.console !== 'undefined' && typeof global.console.warn === 'function') {
        global.console.warn('PNG mangler, men SVG blir fortsatt lastet opp til /api/svg.', {
          tool,
          slug,
          baseName
        });
      }
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
    } else if (typeof global.fetch !== 'function') {
      showToast(`Grafikk lastet ned som ${svgFilename} og ${pngFilename}. (Arkivopplasting ikke tilgjengelig.)`, 'info');
    } else if (!canUpload) {
      showToast(`Grafikk lastet ned, men SVG-data manglet. Arkivopplasting ble hoppet over.`, 'warning');
    }

    const metadataFilename = `${slugSegment || sanitizeBaseName(baseName, 'export')}.json`;
    if (metadataUrl) {
      triggerDownload(doc, metadataUrl, metadataFilename);
    } else {
      triggerDownload(
        doc,
        `data:application/json;charset=utf-8,${encodeURIComponent(metadataString)}`,
        metadataFilename
      );
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

  helper.exportGraphicWithArchive = exportGraphicWithArchive;
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
