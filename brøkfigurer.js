const PALETTE_CLIENT_ERROR_CODES = new Set(['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND', 'ERR_REQUIRE_ESM']);

const paletteModule = loadPaletteServiceClient();
const { paletteService } = paletteModule;

function loadPaletteServiceClient() {
  const moduleExports = tryRequirePaletteClient();
  if (moduleExports && moduleExports.paletteService && typeof moduleExports.paletteService.resolveGroupPalette === 'function') {
    return moduleExports;
  }
  const scopes = [
    typeof globalThis !== 'undefined' ? globalThis : null,
    typeof window !== 'undefined' ? window : null,
    typeof global !== 'undefined' ? global : null
  ];
  for (const scope of scopes) {
    const client = resolvePaletteClientFromScope(scope);
    if (client) {
      return client;
    }
  }
  return createFallbackPaletteClient();
}

function tryRequirePaletteClient() {
  if (typeof require !== 'function') {
    return null;
  }
  try {
    return require('./palette/palette-service-client.js');
  } catch (error) {
    if (!error || !PALETTE_CLIENT_ERROR_CODES.has(error.code)) {
      throw error;
    }
  }
  return null;
}

function resolvePaletteClientFromScope(scope) {
  if (!scope || typeof scope !== 'object') {
    return null;
  }
  const client = scope.MathVisualsPaletteServiceClient;
  if (client && client.paletteService && typeof client.paletteService.resolveGroupPalette === 'function') {
    return client;
  }
  const group = scope.MathVisualsGroupPalette;
  if (!group || typeof group !== 'object') {
    return null;
  }
  const service = group.service && typeof group.service === 'object' ? group.service : group;
  const resolver = service.resolveGroupPalette || service.resolve || group.resolveGroupPalette || group.resolve;
  if (typeof resolver !== 'function') {
    return null;
  }
  return {
    paletteService: {
      resolveGroupPalette(options = {}) {
        return resolver.call(service, options);
      }
    }
  };
}

function createFallbackPaletteClient() {
  return {
    paletteService: {
      resolveGroupPalette(options = {}) {
        const base = Array.isArray(options.base) ? options.base.filter(isValidColor) : [];
        const fallback = Array.isArray(options.fallback) ? options.fallback.filter(isValidColor) : [];
        const source = base.length ? base : fallback;
        if (!source.length) {
          return [];
        }
        const count = Number.isFinite(options.count) && options.count > 0 ? Math.trunc(options.count) : source.length;
        const size = Math.max(1, count);
        const result = [];
        for (let index = 0; index < size; index += 1) {
          result.push(source[index % source.length]);
        }
        return result;
      }
    }
  };
}

function getColorPickerHelper() {
  const scope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (scope && scope.MathVisualsColorPickerHelper) {
    return scope.MathVisualsColorPickerHelper;
  }
  if (typeof require === 'function') {
    try {
      return require('./colorpicker-helper.js');
    } catch (_) {}
  }
  return null;
}

function getColorPickerModule() {
  const scope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  if (scope && scope.MathVisualsColorPicker) {
    return scope.MathVisualsColorPicker;
  }
  if (typeof require === 'function') {
    try {
      return require('./ui/colorpicker/index.js');
    } catch (_) {}
  }
  return null;
}

function isValidColor(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

(function (_colorCountInp$value) {
  function svgToString(svgEl) {
    if (!svgEl) return '';
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
    if (!clone) return '';
    const doc = svgEl.ownerDocument || (typeof document !== 'undefined' ? document : null);
    const cssParts = [];
    if (doc && doc.styleSheets) {
      for (const sheet of doc.styleSheets) {
        try {
          if (sheet.cssRules) {
            for (const rule of sheet.cssRules) {
              cssParts.push(rule.cssText);
            }
          }
        } catch (error) {
          // ignore cross-origin errors
        }
      }
    }
    if (doc && doc.adoptedStyleSheets) {
      for (const sheet of doc.adoptedStyleSheets) {
        try {
          if (sheet.cssRules) {
            for (const rule of sheet.cssRules) {
              cssParts.push(rule.cssText);
            }
          }
        } catch (error) {
          // ignore
        }
      }
    }
    if (doc && typeof doc.querySelectorAll === 'function') {
      [...doc.querySelectorAll('style')].forEach(styleNode => {
        if (styleNode && typeof styleNode.textContent === 'string' && styleNode.textContent.trim()) {
          cssParts.push(styleNode.textContent.trim());
        }
      });
    }
    const css = cssParts.join('\n');
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
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }
  function buildBrokfigurerExportMeta() {
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const summary = collectBrokfigurerAltSummary();
    const figureCount = summary && Number.isFinite(summary.figureCount) ? Math.max(0, summary.figureCount) : 0;
    const baseDescription = figureCount === 1 ? '1 figur' : `${figureCount} figurer`;
    const descriptionParts = [`Brøkfigurer med ${baseDescription}`];
    if (summary && Number.isFinite(summary.rows) && Number.isFinite(summary.cols)) {
      descriptionParts.push(`${summary.rows}×${summary.cols} rutenett`);
    }
    if (summary && Array.isArray(summary.figures) && summary.figures.length) {
      const shapeNames = Array.from(new Set(summary.figures.map(fig => fig.shape || 'figur')));
      descriptionParts.push(`former: ${shapeNames.join(', ')}`);
    }
    const description = `${descriptionParts.join(' – ')}.`;
    const slugParts = ['brokfigurer', `${figureCount}fig`];
    if (summary && Number.isFinite(summary.rows) && Number.isFinite(summary.cols)) {
      slugParts.push(`${summary.rows}x${summary.cols}`);
    }
    const slugBase = slugParts.join(' ');
    const slug = helper && typeof helper.slugify === 'function' ? helper.slugify(slugBase, 'brokfigurer') : slugParts.join('-').toLowerCase();
  return {
    description,
    slug,
    defaultBaseName: slug || 'brokfigurer',
    summary
  };
}
  function downloadSVG(svgEl, filename) {
    const suggestedName = typeof filename === 'string' && filename ? filename : 'brokfigurer.svg';
    const data = svgToString(svgEl);
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const meta = buildBrokfigurerExportMeta();
    const htmlTarget = document.querySelector('.figure') || svgEl;
    if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
      return helper.exportGraphicWithArchiveWithFallback({
        svgElement: svgEl,
        htmlTarget,
        suggestedName,
        toolId: 'brokfigurer',
        svgString: data,
        description: meta.description,
        slug: meta.slug,
        defaultBaseName: meta.defaultBaseName,
        summary: meta.summary
      });
    }
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      return helper.exportSvgWithArchive(svgEl, suggestedName, 'brokfigurer', {
        svgString: data,
        description: meta.description,
        slug: meta.slug,
        defaultBaseName: meta.defaultBaseName,
        summary: meta.summary
      });
    }
    return new Promise(resolve => {
      const blob = new Blob([data], {
        type: 'image/svg+xml;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = suggestedName.endsWith('.svg') ? suggestedName : suggestedName + '.svg';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve();
      }, 0);
    });
  }
  function getSvgExportDimensions(svgEl) {
    if (!svgEl || typeof svgEl.getAttribute !== 'function') return null;
    const viewBox = svgEl.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox
        .trim()
        .split(/[\s,]+/)
        .map(val => Number.parseFloat(val))
        .filter(Number.isFinite);
      if (parts.length >= 4) {
        const [, , width, height] = parts;
        if (width > 0 && height > 0) {
          return { width, height, viewBox };
        }
      }
    }
    const widthAttr = Number.parseFloat(svgEl.getAttribute('width'));
    const heightAttr = Number.parseFloat(svgEl.getAttribute('height'));
    if (Number.isFinite(widthAttr) && Number.isFinite(heightAttr) && widthAttr > 0 && heightAttr > 0) {
      return { width: widthAttr, height: heightAttr, viewBox: `0 0 ${widthAttr} ${heightAttr}` };
    }
    return null;
  }
  function downloadPNG(svgEl, filename, _scale = 2, bg = '#fff') {
    return new Promise(resolve => {
      const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
      const exportMetrics = getExportCanvasMetrics();
      const svgDimensions = getSvgExportDimensions(svgEl);
      const baseWidth = Math.max(1, Math.round((svgDimensions && svgDimensions.width) || exportMetrics.width));
      const baseHeight = Math.max(1, Math.round((svgDimensions && svgDimensions.height) || exportMetrics.height));
      const viewBoxValue = (svgDimensions && svgDimensions.viewBox) || `0 0 ${baseWidth} ${baseHeight}`;
      const exportSvg = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
      if (exportSvg) {
        exportSvg.setAttribute('width', String(baseWidth));
        exportSvg.setAttribute('height', String(baseHeight));
        exportSvg.setAttribute('viewBox', viewBoxValue);
      }
      const data = svgToString(exportSvg || svgEl);
      const blob = new Blob([data], {
        type: 'image/svg+xml;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      const cleanup = () => URL.revokeObjectURL(url);
      const setFallbackSrc = () => {
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
        img.onerror = () => {
          console.error('Kunne ikke eksportere PNG');
          setTimeout(resolve, 0);
        };
        img.src = dataUrl;
      };
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const fixedScale = Number.isFinite(_scale) && _scale > 0 ? _scale : 2;
        canvas.width = Math.max(1, Math.round(baseWidth * fixedScale));
        canvas.height = Math.max(1, Math.round(baseHeight * fixedScale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Kunne ikke eksportere PNG: canvas-kontekst mangler');
          cleanup();
          setTimeout(resolve, 0);
          return;
        }
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        cleanup();
        const handleBlob = blob => {
          const finish = () => setTimeout(resolve, 0);
          if (blob) {
            const urlPng = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlPng;
            a.download = filename.endsWith('.png') ? filename : filename + '.png';
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => {
              URL.revokeObjectURL(urlPng);
              finish();
            }, 0);
          } else {
            try {
              const dataUrl = canvas.toDataURL('image/png');
              const a = document.createElement('a');
              a.href = dataUrl;
              a.download = filename.endsWith('.png') ? filename : filename + '.png';
              document.body.appendChild(a);
              a.click();
              a.remove();
              finish();
            } catch (error) {
              console.error('Kunne ikke eksportere PNG', error);
              finish();
            }
          }
        };
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob(blob => {
            handleBlob(blob);
          }, 'image/png');
        } else {
          handleBlob(null);
        }
      };
      img.onerror = () => {
        cleanup();
        setFallbackSrc();
      };
      img.src = url;
    });
  }
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const figures = [];
  let altTextManager = null;
  const BOARD_MARGIN = 0.05;
  const BOARD_SIZE = 1 + BOARD_MARGIN * 2;
  const BOARD_BOUNDING_BOX = [-BOARD_MARGIN, 1 + BOARD_MARGIN, 1 + BOARD_MARGIN, -BOARD_MARGIN];
  const CLIP_PADDING_PERCENT = BOARD_MARGIN / BOARD_SIZE * 100;
  const CLIP_PAD_EXTRA_PERCENT = 2;
  const CLIP_PAD_PERCENT = CLIP_PADDING_PERCENT + CLIP_PAD_EXTRA_PERCENT;
  const CIRCLE_RADIUS = 0.45;
  const OUTLINE_STROKE_WIDTH = 3;
  const RECT_CORNER_RADIUS_RATIO = 0.00;
  const DIVISION_SEGMENT_EXTENSION = 0;
  const EXPORT_FIGURE_SIZE = 800;
  const EXPORT_GAP = 18;
  const EXPORT_MARGIN = 0;
  const colorCountInp = document.getElementById('colorCount');
  const allowWrongInp = document.getElementById('allowWrong');
  const showDivisionLinesInp = document.getElementById('showDivisionLines');
  const showOutlineInp = document.getElementById('showOutline');
  const colorInputs = [];
  for (let i = 1;; i++) {
    const inp = document.getElementById('color_' + i);
    if (!inp) break;
    colorInputs.push(inp);
  }
  const LEGACY_COLOR_PALETTE = ['#B25FE3', '#6C1BA2', '#534477', '#873E79', '#BF4474', '#E31C3D'];
  const SHARED_GROUP_ID = 'graftegner';
  const PALETTE_PAIR_COUNT = 6;
  const PALETTE_SLOT_COUNT = PALETTE_PAIR_COUNT * 2;
  const FILL_COLOR_COUNT = PALETTE_PAIR_COUNT;
const DEFAULT_GRAFTEGNER_COLOR_ROLES = [
  { fillIndex: 0, lineIndex: 1 },
  { fillIndex: 2, lineIndex: 3 },
  { fillIndex: 4, lineIndex: 5 },
  { fillIndex: 6, lineIndex: 7 },
  { fillIndex: 8, lineIndex: 9 },
  { fillIndex: 10, lineIndex: 11 }
];
const colorPickerHelper = getColorPickerHelper();
const colorPickerModule = getColorPickerModule();
const fillColorPickerInstances = new WeakMap();
  const fillColorPickersSelector = '[data-fill-color-picker]';
  function getThemeApi() {
    const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
    return theme && typeof theme === 'object' ? theme : null;
  }

  function getPaletteApi() {
    const scope = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
    if (!scope || typeof scope !== 'object') return null;
    const api = scope.MathVisualsPalette;
    return api && typeof api.getGroupPalette === 'function' ? api : null;
  }

  function resolvePaletteConfig() {
    const scopes = [
      typeof window !== 'undefined' ? window : null,
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof global !== 'undefined' ? global : null
    ];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const config = scope.MathVisualsPaletteConfig;
      if (config && typeof config === 'object') {
        return config;
      }
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./palette/palette-config.js');
        if (mod && typeof mod === 'object') {
          return mod;
        }
      } catch (_) {}
    }
    return null;
  }

  let paletteConfigCache;
  let paletteConfigResolved = false;

  function getPaletteConfig() {
    if (!paletteConfigResolved) {
      paletteConfigResolved = true;
      paletteConfigCache = resolvePaletteConfig();
    }
    return paletteConfigCache;
  }

  function getGroupSlotIndices(config, groupId) {
    if (!config) return [];
    const normalizedGroupId = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    if (!normalizedGroupId) return [];
    if (Array.isArray(config.COLOR_SLOT_GROUPS)) {
      const group = config.COLOR_SLOT_GROUPS.find(entry => {
        const groupKey = entry && typeof entry.groupId === 'string' ? entry.groupId.trim().toLowerCase() : '';
        return groupKey === normalizedGroupId;
      });
      if (group && Array.isArray(group.colorRoles) && group.colorRoles.length) {
        const indices = [];
        group.colorRoles.forEach(role => {
          if (!role || typeof role !== 'object') return;
          if (Number.isInteger(role.fillIndex) && role.fillIndex >= 0) {
            indices.push(role.fillIndex);
          }
          if (Number.isInteger(role.lineIndex) && role.lineIndex >= 0) {
            indices.push(role.lineIndex);
          }
        });
        if (indices.length) {
          return indices;
        }
      }
    }
    const indexMap = config.GROUP_SLOT_INDICES;
    if (indexMap && typeof indexMap === 'object') {
      const indices = indexMap[normalizedGroupId];
      if (Array.isArray(indices) && indices.length) {
        return indices
          .map(value => (Number.isInteger(value) && value >= 0 ? Math.trunc(value) : null))
          .filter(index => Number.isInteger(index) && index >= 0);
      }
    }
    if (Array.isArray(config.COLOR_SLOT_GROUPS)) {
      for (const group of config.COLOR_SLOT_GROUPS) {
        if (!group || typeof group !== 'object') continue;
        const groupKey = typeof group.groupId === 'string' ? group.groupId.trim().toLowerCase() : '';
        if (groupKey !== normalizedGroupId) continue;
        if (!Array.isArray(group.slots)) break;
        return group.slots
          .map((slot, slotIndex) => {
            if (!slot || typeof slot !== 'object') return null;
            const index = Number.isInteger(slot.index) ? Math.trunc(slot.index) : slotIndex;
            return index >= 0 ? index : null;
          })
          .filter(index => Number.isInteger(index) && index >= 0);
      }
    }
    return [];
  }

  function getGraftegnerRoleSlotPairs() {
    const config = getPaletteConfig();
    if (colorPickerHelper && typeof colorPickerHelper.resolveRoleSlotPairs === 'function') {
      return colorPickerHelper.resolveRoleSlotPairs(config, SHARED_GROUP_ID, DEFAULT_GRAFTEGNER_COLOR_ROLES);
    }
    const pairs = [];
    for (let index = 0; index < PALETTE_PAIR_COUNT; index += 1) {
      pairs.push({
        fillSlotIndex: index * 2,
        lineSlotIndex: index * 2 + 1
      });
    }
    return pairs;
  }

  function getGraftegnerRoleSlotCount() {
    const pairs = getGraftegnerRoleSlotPairs();
    let maxIndex = -1;
    pairs.forEach(pair => {
      if (!pair || typeof pair !== 'object') return;
      if (Number.isInteger(pair.fillSlotIndex)) {
        maxIndex = Math.max(maxIndex, pair.fillSlotIndex);
      }
      if (Number.isInteger(pair.lineSlotIndex)) {
        maxIndex = Math.max(maxIndex, pair.lineSlotIndex);
      }
    });
    return maxIndex >= 0 ? maxIndex + 1 : PALETTE_SLOT_COUNT;
  }

  function applyPairSwatch(element, fillColor, lineColor) {
    if (!element) return;
    if (colorPickerHelper && typeof colorPickerHelper.applyColorPairSwatch === 'function') {
      colorPickerHelper.applyColorPairSwatch(element, fillColor, lineColor);
      return;
    }
    if (element.classList) {
      element.classList.add('color-swatch--pair');
    }
    if (typeof fillColor === 'string' && fillColor) {
      element.style.setProperty('--swatch-fill', fillColor);
    }
    if (typeof lineColor === 'string' && lineColor) {
      element.style.setProperty('--swatch-line', lineColor);
    }
  }

  function buildFillColorSlots(fillColors, lineColors) {
    const slots = [];
    const fallbackLine = lineColors[0] || '#000';
    fillColors.forEach((color, index) => {
      const lineColor = lineColors[index] || fallbackLine;
      slots.push({
        value: index + 1,
        label: `Velg farge ${index + 1}`,
        fillColor: color,
        lineColor
      });
    });
    return slots;
  }

  function getSettingsApi() {
    if (typeof window === 'undefined') return null;
    const api = window.MathVisualsSettings;
    return api && typeof api === 'object' ? api : null;
  }
  function getGroupFallbackPalette(groupId, basePalette) {
    const baseCandidate = sanitizePalette(basePalette);
    if (!baseCandidate.length) {
      return [];
    }
    const config = getPaletteConfig();
    if (!config) {
      return baseCandidate.slice();
    }
    const indices = getGroupSlotIndices(config, groupId);
    if (!indices.length) {
      return baseCandidate.slice();
    }
    const result = [];
    const baseLength = baseCandidate.length;
    indices.forEach((index, slotIndex) => {
      if (Number.isInteger(index) && index >= 0) {
        const color = baseCandidate[index % baseLength];
        if (typeof color === 'string' && color) {
          result.push(color);
          return;
        }
      }
      const fallbackColor = baseCandidate[slotIndex % baseLength] || baseCandidate[0];
      if (typeof fallbackColor === 'string' && fallbackColor) {
        result.push(fallbackColor);
      }
    });
    return result.length ? result : baseCandidate.slice();
  }
  function applyThemeToDocument() {
    const theme = getThemeApi();
    if (theme && typeof theme.applyToDocument === 'function') {
      theme.applyToDocument(document);
    }
  }
  applyThemeToDocument();
  const checkButton = typeof document !== 'undefined' ? document.getElementById('btnCheck') : null;
  const checkStatus = typeof document !== 'undefined' ? document.getElementById('checkStatus') : null;
  function setCheckStatus(type, heading, detailLines) {
    if (!checkStatus) return;
    if (!type) {
      checkStatus.hidden = true;
      checkStatus.className = 'status';
      checkStatus.textContent = '';
      return;
    }
    checkStatus.hidden = false;
    checkStatus.className = `status status--${type}`;
    checkStatus.textContent = '';
    if (heading) {
      const strong = document.createElement('strong');
      strong.textContent = heading;
      checkStatus.appendChild(strong);
    }
    if (Array.isArray(detailLines)) {
      detailLines.forEach(line => {
        if (!line) return;
        const div = document.createElement('div');
        div.textContent = line;
        checkStatus.appendChild(div);
      });
    }
  }
  function clearCheckStatus() {
    setCheckStatus(null);
  }
  const TASK_APP_ID = 'brøkfigurer';
  function getTaskApi() {
    if (typeof window === 'undefined') return null;
    return window.MathVisualsTaskApi || null;
  }
  function registerTaskAdapter() {
    const taskApi = getTaskApi();
    if (!taskApi || typeof taskApi.registerTaskAdapter !== 'function') return;
    taskApi.registerTaskAdapter(TASK_APP_ID, {
      evaluateAnswers() {
        runTaskCheck();
        return null;
      }
    });
  }
  registerTaskAdapter();
  if (checkButton) {
    checkButton.addEventListener('click', () => {
      const taskApi = getTaskApi();
      if (taskApi && typeof taskApi.evaluateTask === 'function') {
        taskApi.evaluateTask(TASK_APP_ID);
      } else {
        runTaskCheck();
      }
    });
  }

  function sanitizePalette(values) {
    if (!Array.isArray(values)) return [];
    const sanitized = [];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (!trimmed) continue;
      sanitized.push(trimmed);
    }
    return sanitized;
  }

  function ensurePaletteSize(basePalette, fallbackPalette, count) {
    const base = sanitizePalette(basePalette);
    const fallback = sanitizePalette(fallbackPalette);
    const target = Number.isFinite(count) && count > 0 ? Math.trunc(count) : base.length || fallback.length || 0;
    if (target <= 0) {
      return base.length ? base.slice() : fallback.slice();
    }
    const result = [];
    for (let index = 0; index < target; index += 1) {
      const primary = base[index];
      if (typeof primary === 'string' && primary) {
        result.push(primary);
        continue;
      }
      if (fallback.length) {
        const fallbackColor = fallback[index % fallback.length];
        if (typeof fallbackColor === 'string' && fallbackColor) {
          result.push(fallbackColor);
          continue;
        }
      }
      if (base.length) {
        const cycled = base[index % base.length];
        if (typeof cycled === 'string' && cycled) {
          result.push(cycled);
        }
      }
    }
    if (!result.length && fallback.length) {
      result.push(fallback[0]);
    }
    return result;
  }

  function tryResolvePalette(resolver) {
    try {
      const palette = resolver();
      return Array.isArray(palette) ? sanitizePalette(palette) : null;
    } catch (_) {
      return null;
    }
  }

  function getPaletteFromTheme(count) {
    const paletteApi = getPaletteApi();
    const settings = getSettingsApi();
    const theme = getThemeApi();
    const legacyFallback = sanitizePalette(LEGACY_COLOR_PALETTE);
    const groupFallback = getGroupFallbackPalette(SHARED_GROUP_ID, LEGACY_COLOR_PALETTE);
    const fallback = groupFallback.length ? groupFallback : legacyFallback;
    const target = Number.isFinite(count) && count > 0 ? Math.trunc(count) : fallback.length || legacyFallback.length;

    if (paletteApi) {
      const palette = tryResolvePalette(() =>
        paletteApi.getGroupPalette(SHARED_GROUP_ID, {
          count: target || undefined
        })
      );
      if (palette && palette.length) {
        return ensurePaletteSize(palette, fallback, target);
      }
    }

    if (settings && typeof settings.getGroupPalette === 'function') {
      let palette = tryResolvePalette(() =>
        settings.getGroupPalette(SHARED_GROUP_ID, {
          count: target || undefined
        })
      );
      if ((!palette || palette.length < target) && settings.getGroupPalette.length >= 3) {
        palette = tryResolvePalette(() => settings.getGroupPalette(SHARED_GROUP_ID, target || undefined));
      }
      if (palette && palette.length) {
        return ensurePaletteSize(palette, fallback, target);
      }
    }

    const servicePalette = tryResolvePalette(() =>
      paletteService.resolveGroupPalette({
        groupId: SHARED_GROUP_ID,
        count: target || undefined,
        fallback,
        legacyPaletteId: 'fractions',
        fallbackKinds: ['figures']
      })
    );
    if (servicePalette && servicePalette.length) {
      return ensurePaletteSize(servicePalette, fallback, target);
    }

    if (theme && typeof theme.getGroupPalette === 'function') {
      let palette = tryResolvePalette(() =>
        theme.getGroupPalette(SHARED_GROUP_ID, {
          count: target || undefined
        })
      );
      if ((!palette || palette.length < target) && theme.getGroupPalette.length >= 3) {
        palette = tryResolvePalette(() => theme.getGroupPalette(SHARED_GROUP_ID, target || undefined));
      }
      if (palette && palette.length) {
        return ensurePaletteSize(palette, fallback, target);
      }
    }

    if (theme && typeof theme.getPalette === 'function') {
      const palette = tryResolvePalette(() =>
        theme.getPalette('fractions', target || fallback.length, {
          fallbackKinds: ['figures']
        })
      );
      if (palette && palette.length) {
        return ensurePaletteSize(palette, fallback, target);
      }
    }

    return ensurePaletteSize([], fallback, target);
  }
  function getDefaultColorForIndex(index) {
    if (!Number.isFinite(index) || index < 0) return LEGACY_COLOR_PALETTE[0];
    const palette = getPaletteFromTheme(index + 1);
    if (Array.isArray(palette) && palette[index]) return palette[index];
    return LEGACY_COLOR_PALETTE[index % LEGACY_COLOR_PALETTE.length];
  }
  function getLineFillPalettes() {
    const slotCount = getGraftegnerRoleSlotCount();
    const basePalette = getColors();
    const palette = ensurePaletteSize(
      basePalette.length >= slotCount ? basePalette : [],
      getPaletteFromTheme(slotCount),
      slotCount
    );
    const lineColors = [];
    const fillColors = [];
    const roleSlots = getGraftegnerRoleSlotPairs();
    if (roleSlots.length) {
      roleSlots.forEach(role => {
        const fill = palette[role.fillSlotIndex];
        const line = palette[role.lineSlotIndex];
        fillColors.push(fill || line || '#fff');
        lineColors.push(line || fill || '#000');
      });
    } else {
      for (let index = 0; index < palette.length; index += 2) {
        fillColors.push(palette[index] || palette[index + 1] || '#fff');
        lineColors.push(palette[index + 1] || palette[index] || '#000');
      }
    }
    return {
      lineColors,
      fillColors
    };
  }
  function getFillPalette() {
    return getLineFillPalettes().fillColors.slice(0, FILL_COLOR_COUNT);
  }
  function getLinePalette() {
    return getLineFillPalettes().lineColors.slice(0, FILL_COLOR_COUNT);
  }
  function sanitizeFillIndex(value, paletteLength) {
    const numeric = Number.parseInt(value, 10);
    const max = Number.isFinite(paletteLength) && paletteLength > 0 ? paletteLength : FILL_COLOR_COUNT;
    if (!Number.isFinite(numeric) || numeric < 1) return 1;
    return Math.min(numeric, max);
  }
  function getFillColorPickers() {
    if (typeof document === 'undefined') return [];
    return Array.from(document.querySelectorAll(fillColorPickersSelector));
  }
  function getPickerFigureId(picker) {
    if (!picker || !picker.dataset) return null;
    const raw = picker.dataset.figureId;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  function getFigureFillIndex(id) {
    const figState = ensureFigureState(id);
    const fallback = Number.isFinite(figState.fillColorIndex) ? figState.fillColorIndex : activeFillColorIndex;
    return sanitizeFillIndex(fallback, FILL_COLOR_COUNT);
  }
  function setFigureFillIndex(id, value) {
    const figState = ensureFigureState(id);
    const safeIndex = sanitizeFillIndex(value, FILL_COLOR_COUNT);
    figState.fillColorIndex = safeIndex;
    if (activeFillColorIndex !== safeIndex) {
      activeFillColorIndex = safeIndex;
      STATE.activeFillColorIndex = activeFillColorIndex;
    }
    syncFigureFilledColors(id, safeIndex);
    return safeIndex;
  }
  function syncFigureFilledColors(id, fillIndex) {
    const figState = ensureFigureState(id);
    const safeIndex = sanitizeFillIndex(fillIndex, FILL_COLOR_COUNT);
    const normalized = sanitizeFilledEntries(figState.filled);
    if (!normalized.length) return;
    const updated = normalized.map(([partIndex]) => [partIndex, safeIndex]);
    figState.filled = updated;
    const fig = figures[id];
    if (fig && typeof fig.setFilled === 'function') {
      fig.setFilled(new Map(updated));
      return;
    }
  }
  function renderFillColorPickers() {
    const pickers = getFillColorPickers();
    if (!pickers.length || !colorPickerModule || typeof colorPickerModule.createColorPicker !== 'function') {
      return;
    }
    const paletteData = getLineFillPalettes();
    const colors = paletteData.fillColors.slice(0, FILL_COLOR_COUNT);
    const lineColors = paletteData.lineColors.slice(0, colors.length);
    const slots = buildFillColorSlots(colors, lineColors);
    pickers.forEach(picker => {
      const renderStyle = ({ element, slot }) => {
        applyPairSwatch(element, slot.fillColor, slot.lineColor);
      };
      const onSelect = value => {
        const figureId = getPickerFigureId(picker);
        if (figureId) {
          setFigureFillIndex(figureId, value);
        } else {
          activeFillColorIndex = sanitizeFillIndex(value, colors.length);
          STATE.activeFillColorIndex = activeFillColorIndex;
        }
        window.render();
      };
      const instance = fillColorPickerInstances.get(picker);
      if (instance) {
        instance.update({
          slots,
          renderStyle,
          onSelect,
          getActiveValue: () => {
            const figureId = getPickerFigureId(picker);
            return figureId ? getFigureFillIndex(figureId) : sanitizeFillIndex(activeFillColorIndex, colors.length);
          }
        });
        return;
      }
      const pickerInstance = colorPickerModule.createColorPicker({
        element: picker,
        slots,
        renderStyle,
        onSelect,
        getActiveValue: () => {
          const figureId = getPickerFigureId(picker);
          return figureId ? getFigureFillIndex(figureId) : sanitizeFillIndex(activeFillColorIndex, colors.length);
        }
      });
      if (pickerInstance) {
        fillColorPickerInstances.set(picker, pickerInstance);
      }
    });
  }
  const boardEl = document.getElementById('figureBoard');
  const gridEl = document.getElementById('figureGrid');
  const addColumnBtn = document.getElementById('figAddColumn');
  const removeColumnBtn = document.getElementById('figRemoveColumn');
  const addRowBtn = document.getElementById('figAddRow');
  const removeRowBtn = document.getElementById('figRemoveRow');
  const settingsContainer = document.getElementById('figureSettings');
  const exportSvgBtn = document.getElementById('btnExportSvg');
  const exportPngBtn = document.getElementById('btnExportPng');
  const clampInt = (value, min, max) => {
    const num = parseInt(value, 10);
    const base = Number.isFinite(num) ? num : min;
    const clamped = Math.max(min, base);
    return max != null ? Math.min(clamped, max) : clamped;
  };
  const VALID_SHAPES = new Set(['circle', 'square', 'triangle']);
  const VALID_DIVISIONS = new Set(['horizontal', 'vertical', 'grid', 'diagonal', 'triangular']);
  const normalizeShape = value => value === 'rectangle' ? 'square' : value;
  function sanitizeFilledEntries(value) {
    let iterable;
    if (value instanceof Map) {
      iterable = value.entries();
    } else if (value && typeof value[Symbol.iterator] === 'function') {
      iterable = value;
    }
    if (!iterable) return [];
    const normalized = new Map();
    for (const entry of iterable) {
      if (entry == null) continue;
      let pair;
      if (Array.isArray(entry)) pair = entry;else {
        try {
          pair = Array.from(entry);
        } catch (_) {
          continue;
        }
      }
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const partIndex = Number.parseInt(pair[0], 10);
      const colorIndex = Number.parseInt(pair[1], 10);
      if (!Number.isFinite(partIndex) || partIndex < 0) continue;
      if (!Number.isFinite(colorIndex) || colorIndex <= 0) continue;
      normalized.set(partIndex, colorIndex);
    }
    return Array.from(normalized.entries()).sort((a, b) => a[0] - b[0]);
  }
  const STATE = window.STATE && typeof window.STATE === 'object' ? window.STATE : {};
  window.STATE = STATE;
  if (typeof STATE.altText !== 'string') STATE.altText = '';
  if (STATE.altTextSource !== 'manual') STATE.altTextSource = 'auto';
  STATE.colors = [];
  let activeFillColorIndex = sanitizeFillIndex(STATE.activeFillColorIndex, FILL_COLOR_COUNT);
  STATE.activeFillColorIndex = activeFillColorIndex;
  if (!STATE.figures || typeof STATE.figures !== 'object') STATE.figures = {};
  let allowWrongGlobal;
  if (typeof STATE.allowWrong === 'boolean') {
    allowWrongGlobal = STATE.allowWrong;
  } else {
    allowWrongGlobal = false;
    for (const key of Object.keys(STATE.figures)) {
      const figState = STATE.figures[key];
      if (figState && typeof figState === 'object' && typeof figState.allowWrong === 'boolean') {
        allowWrongGlobal = figState.allowWrong;
        break;
      }
    }
  }
  STATE.allowWrong = allowWrongGlobal;
  if (allowWrongInp) allowWrongInp.checked = allowWrongGlobal;
  let showDivisionLinesGlobal = typeof STATE.showDivisionLines === 'boolean' ? STATE.showDivisionLines : true;
  STATE.showDivisionLines = showDivisionLinesGlobal;
  if (showDivisionLinesInp) showDivisionLinesInp.checked = showDivisionLinesGlobal;
  let showOutlineGlobal = typeof STATE.showOutline === 'boolean' ? STATE.showOutline : true;
  STATE.showOutline = showOutlineGlobal;
  if (showOutlineInp) showOutlineInp.checked = showOutlineGlobal;
  const maxColors = Math.max(PALETTE_SLOT_COUNT, colorInputs.length || 0, 1);
  const defaultColorCount = clampInt(
    (_colorCountInp$value = colorCountInp === null || colorCountInp === void 0 ? void 0 : colorCountInp.value) !== null && _colorCountInp$value !== void 0 ? _colorCountInp$value : PALETTE_SLOT_COUNT,
    1,
    PALETTE_SLOT_COUNT
  );
  const stateColorCount = STATE.colorCount != null ? clampInt(STATE.colorCount, 1, PALETTE_SLOT_COUNT) : null;
  let colorCount = stateColorCount || defaultColorCount;
  colorCount = PALETTE_SLOT_COUNT;
  STATE.colorCount = colorCount;
  const MAX_ROWS = 3;
  const MAX_COLS = 3;
  const MIN_DIMENSION = 1;
  const figurePanels = new Map();
  const figureFieldsets = new Map();
  const figureSetupCounts = new Map();
  let activeFigureIds = [];
  let rows = clampInt(STATE.rows != null ? STATE.rows : 1, MIN_DIMENSION, MAX_ROWS);
  let cols = clampInt(STATE.cols != null ? STATE.cols : 1, MIN_DIMENSION, MAX_COLS);
  STATE.rows = rows;
  STATE.cols = cols;
  let pendingFigureSizeFrame = null;
  let pendingBoardResizeFrame = null;
  let pendingRenderFrame = null;
  let lastFigureSize = null;
  const observedBoxes = new Set();
  const boxResizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(() => scheduleFigureSizeUpdate()) : null;
  function scheduleFigureBoardResize() {
    if (pendingBoardResizeFrame != null) return;
    pendingBoardResizeFrame = requestAnimationFrame(() => {
      pendingBoardResizeFrame = null;
      for (const id of getActiveFigureIds()) {
        const fig = figures[id];
        if (fig && typeof fig.resize === 'function') fig.resize();
      }
    });
  }
  function updateFigureSize() {
    if (!gridEl) return;
    const rect = gridEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const style = getComputedStyle(gridEl);
    let gap = parseFloat(style.gap);
    if (!Number.isFinite(gap)) {
      const colGap = parseFloat(style.columnGap);
      const rowGap = parseFloat(style.rowGap);
      gap = Number.isFinite(colGap) ? colGap : Number.isFinite(rowGap) ? rowGap : 0;
    }
    const horizontalGap = Math.max(0, cols - 1) * (Number.isFinite(gap) ? gap : 0);
    const verticalGap = Math.max(0, rows - 1) * (Number.isFinite(gap) ? gap : 0);
    const availableWidth = rect.width - horizontalGap;
    const availableHeight = rect.height - verticalGap;
    if (availableWidth <= 0 || availableHeight <= 0) return;
    const perFigureWidth = availableWidth / Math.max(cols, 1);
    const perFigureHeight = availableHeight / Math.max(rows, 1);
    const baseSize = Math.min(perFigureWidth, perFigureHeight);
    const size = Math.max(0, baseSize);
    const nextSize = `${size}px`;
    if (nextSize !== lastFigureSize) {
      lastFigureSize = nextSize;
      gridEl.style.setProperty('--figure-size', nextSize);
      scheduleFigureBoardResize();
    }
  }
  function observeFigureBox(box) {
    if (!boxResizeObserver || !box || observedBoxes.has(box)) return;
    boxResizeObserver.observe(box);
    observedBoxes.add(box);
  }
  function pruneObservedBoxes() {
    if (!boxResizeObserver) return;
    for (const box of observedBoxes) {
      if (!box.isConnected) {
        boxResizeObserver.unobserve(box);
        observedBoxes.delete(box);
      }
    }
  }
  function updateFigureLayoutMetrics() {
    let layoutReady = true;
    for (const id of getActiveFigureIds()) {
      const fig = figures[id];
      const panel = figurePanels.get(id) || document.getElementById(`panel${id}`);
      if (!panel || panel.style.display === 'none') continue;
      const box = panel.querySelector('.box');
      if (!box) {
        layoutReady = false;
        continue;
      }
      const rect = box.getBoundingClientRect();
      if (fig && typeof fig.setLayoutMetrics === 'function') {
        fig.setLayoutMetrics({
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        });
      }
      if (!rect.width || !rect.height) {
        layoutReady = false;
      }
    }
    return layoutReady;
  }
  function scheduleFigureDraw() {
    if (pendingRenderFrame != null) return;
    pendingRenderFrame = requestAnimationFrame(() => {
      pendingRenderFrame = null;
      const layoutReady = updateFigureLayoutMetrics();
      if (!layoutReady) {
        scheduleFigureDraw();
        return;
      }
      for (const id of getActiveFigureIds()) {
        const fig = figures[id];
        if (fig && typeof fig.draw === 'function') fig.draw();
      }
      scheduleFigureBoardResize();
      scheduleFigureSizeUpdate();
      refreshAltText('render');
    });
  }
  function scheduleFigureSizeUpdate() {
    if (pendingFigureSizeFrame != null) return;
    pendingFigureSizeFrame = requestAnimationFrame(() => {
      pendingFigureSizeFrame = null;
      const layoutReady = updateFigureLayoutMetrics();
      if (!layoutReady) {
        scheduleFigureSizeUpdate();
        return;
      }
      updateFigureSize();
    });
  }
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => scheduleFigureSizeUpdate());
    if (boardEl) observer.observe(boardEl);
    if (gridEl) observer.observe(gridEl);
  }
  window.addEventListener('resize', scheduleFigureSizeUpdate);
  function ensureFigureState(id) {
    const existing = STATE.figures[id];
    const fig = existing && typeof existing === 'object' ? existing : {};
    const shapeEl = document.getElementById(`shape${id}`);
    const partsEl = document.getElementById(`parts${id}`);
    const divisionEl = document.getElementById(`division${id}`);
    if (shapeEl && fig.shape == null) fig.shape = shapeEl.value;
    if (typeof fig.shape === 'string') {
      fig.shape = normalizeShape(fig.shape);
    }
    if (!VALID_SHAPES.has(fig.shape)) {
      fig.shape = normalizeShape(shapeEl ? shapeEl.value : 'square');
    }
    if (partsEl && fig.parts == null) {
      const parsed = parseInt(partsEl.value, 10);
      fig.parts = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }
    if (divisionEl && fig.division == null) fig.division = divisionEl.value;
    if (typeof fig.allowDenominatorChange === 'string') {
      fig.allowDenominatorChange = fig.allowDenominatorChange === 'true';
    } else if (typeof fig.allowDenominatorChange !== 'boolean') {
      fig.allowDenominatorChange = false;
    }
    if (typeof fig.fillColorIndex === 'string') {
      fig.fillColorIndex = Number.parseInt(fig.fillColorIndex, 10);
    }
    if (!Number.isFinite(fig.fillColorIndex)) {
      fig.fillColorIndex = activeFillColorIndex;
    }
    if (!Array.isArray(fig.filled)) {
      fig.filled = sanitizeFilledEntries(fig.filled);
    }
    const solution = fig.solution && typeof fig.solution === 'object' ? fig.solution : {};
    const rawNum = parseInt(solution.numerator, 10);
    const rawDen = parseInt(solution.denominator, 10);
    fig.solution = {
      numerator: Number.isFinite(rawNum) ? rawNum : null,
      denominator: Number.isFinite(rawDen) && rawDen > 0 ? rawDen : null
    };
    fig.allowWrong = allowWrongGlobal;
    STATE.figures[id] = fig;
    return fig;
  }
  function pruneFigureState(total) {
    const max = Math.max(0, total);
    for (const key of Object.keys(STATE.figures)) {
      const idNum = Number.parseInt(key, 10);
      if (!Number.isFinite(idNum) || idNum < 1 || idNum > max) {
        delete STATE.figures[key];
      }
    }
  }
  const getActiveFigureIds = () => activeFigureIds.slice();
  if (allowWrongInp) {
    allowWrongInp.addEventListener('change', () => {
      allowWrongGlobal = !!allowWrongInp.checked;
      STATE.allowWrong = allowWrongGlobal;
      for (const id of getActiveFigureIds()) {
        const figState = ensureFigureState(id);
        figState.allowWrong = allowWrongGlobal;
      }
      renderAll();
      clearCheckStatus();
    });
  }
  if (showDivisionLinesInp) {
    showDivisionLinesInp.addEventListener('change', () => {
      showDivisionLinesGlobal = !!showDivisionLinesInp.checked;
      STATE.showDivisionLines = showDivisionLinesGlobal;
      window.render();
      clearCheckStatus();
    });
  }
  if (showOutlineInp) {
    showOutlineInp.addEventListener('change', () => {
      showOutlineGlobal = !!showOutlineInp.checked;
      STATE.showOutline = showOutlineGlobal;
      window.render();
      clearCheckStatus();
    });
  }
  function ensureColorDefaults(count) {
    const required = Math.max(count, maxColors);
    const palette = getPaletteFromTheme(required);
    if (!Array.isArray(STATE.colors)) STATE.colors = [];
    STATE.colors = palette.slice(0, required);
    for (let i = 0; i < required; i++) {
      const defaultColor = palette[i] || getDefaultColorForIndex(i);
      const hasColor = typeof STATE.colors[i] === 'string' && STATE.colors[i];
      if (!hasColor) STATE.colors[i] = defaultColor;
      if (typeof STATE.colors[i] !== 'string' || !STATE.colors[i]) {
        STATE.colors[i] = defaultColor || LEGACY_COLOR_PALETTE[i % LEGACY_COLOR_PALETTE.length];
      }
    }
    if (STATE.colors.length > required) STATE.colors.length = required;
  }

  function refreshPaletteDefaults() {
    ensureColorDefaults(colorCount);
    colorInputs.forEach((inp, idx) => {
      if (!inp) return;
      const color = STATE.colors[idx];
      if (typeof color === 'string' && color) {
        inp.value = color;
      }
    });
    renderFillColorPickers();
  }
  function getColors() {
    ensureColorDefaults(colorCount);
    return STATE.colors.slice(0, colorCount);
  }
  function updateColorVisibility() {
    colorInputs.forEach((inp, idx) => {
      inp.style.display = idx < colorCount ? '' : 'none';
    });
  }
  colorCountInp === null || colorCountInp === void 0 || colorCountInp.addEventListener('input', () => {
    var _window$render, _window;
    const next = clampInt(colorCountInp.value, 1, maxColors);
    if (STATE.colorCount !== next) {
      STATE.colorCount = next;
    }
    colorCount = STATE.colorCount;
    ensureColorDefaults(colorCount);
    (_window$render = (_window = window).render) === null || _window$render === void 0 || _window$render.call(_window);
    clearCheckStatus();
  });
  colorInputs.forEach((inp, idx) => inp.addEventListener('input', () => {
    var _window$render2, _window2;
    ensureColorDefaults(Math.max(idx + 1, colorCount));
    (_window$render2 = (_window2 = window).render) === null || _window$render2 === void 0 || _window$render2.call(_window2);
    clearCheckStatus();
  }));
  function applyStateToControls() {
    allowWrongGlobal = !!STATE.allowWrong;
    STATE.allowWrong = allowWrongGlobal;
    if (allowWrongInp) allowWrongInp.checked = allowWrongGlobal;
    if (typeof STATE.showDivisionLines === 'boolean') {
      showDivisionLinesGlobal = STATE.showDivisionLines;
    } else {
      showDivisionLinesGlobal = true;
    }
    STATE.showDivisionLines = showDivisionLinesGlobal;
    if (showDivisionLinesInp) showDivisionLinesInp.checked = showDivisionLinesGlobal;
    if (typeof STATE.showOutline === 'boolean') {
      showOutlineGlobal = STATE.showOutline;
    } else {
      showOutlineGlobal = true;
    }
    STATE.showOutline = showOutlineGlobal;
    if (showOutlineInp) showOutlineInp.checked = showOutlineGlobal;
    colorCount = clampInt(STATE.colorCount, 1, maxColors);
    colorCount = PALETTE_SLOT_COUNT;
    STATE.colorCount = colorCount;
    activeFillColorIndex = sanitizeFillIndex(STATE.activeFillColorIndex, FILL_COLOR_COUNT);
    STATE.activeFillColorIndex = activeFillColorIndex;
    if (colorCountInp) {
      colorCountInp.value = String(colorCount);
      colorCountInp.min = String(PALETTE_SLOT_COUNT);
      colorCountInp.max = String(PALETTE_SLOT_COUNT);
      colorCountInp.disabled = true;
    }
    ensureColorDefaults(colorCount);
    colorInputs.forEach((inp, idx) => {
      const color = STATE.colors[idx];
      if (typeof color === 'string') inp.value = color;
    });
    renderFillColorPickers();
    for (const id of getActiveFigureIds()) {
      const figState = ensureFigureState(id);
      figState.allowWrong = allowWrongGlobal;
      const safeFillIndex = sanitizeFillIndex(figState.fillColorIndex, FILL_COLOR_COUNT);
      figState.fillColorIndex = safeFillIndex;
      syncFigureFilledColors(id, safeFillIndex);
      if (typeof figState.allowDenominatorChange !== 'boolean') {
        figState.allowDenominatorChange = false;
      }
      const allowDenominator = !!figState.allowDenominatorChange;
      const allowDenominatorInp = document.getElementById(`allowDenominator${id}`);
      if (allowDenominatorInp) allowDenominatorInp.checked = allowDenominator;
      const shapeSel = document.getElementById(`shape${id}`);
      if (shapeSel && figState.shape) {
        const normalizedShape = normalizeShape(figState.shape);
        const options = Array.from(shapeSel.options || []);
        if (options.some(opt => opt.value === normalizedShape)) {
          shapeSel.value = normalizedShape;
          figState.shape = normalizedShape;
        } else {
          figState.shape = normalizeShape(shapeSel.value);
        }
      }
      const partsInp = document.getElementById(`parts${id}`);
      const partsVal = document.getElementById(`partsVal${id}`);
      const figureController = figures[id];
      if (figureController && typeof figureController.updateDenominatorControls === 'function') {
        figureController.updateDenominatorControls(allowDenominator);
      } else {
        if (partsInp) partsInp.disabled = false;
        const minusBtn = document.getElementById(`partsMinus${id}`);
        if (minusBtn) minusBtn.style.display = allowDenominator ? '' : 'none';
        const plusBtn = document.getElementById(`partsPlus${id}`);
        if (plusBtn) plusBtn.style.display = allowDenominator ? '' : 'none';
      }
      if (partsInp) {
        const parts = clampInt(figState.parts, 1);
        figState.parts = parts;
        partsInp.value = String(parts);
        if (partsVal) partsVal.textContent = String(parts);
      } else if (partsVal && figState.parts != null) {
        partsVal.textContent = String(figState.parts);
      }
      const divSel = document.getElementById(`division${id}`);
      if (divSel && figState.division) {
        const options = Array.from(divSel.options || []);
        if (options.some(opt => opt.value === figState.division)) divSel.value = figState.division;
      }
    }
  }
  function renderAll() {
    const desiredRows = clampInt(STATE.rows != null ? STATE.rows : MIN_DIMENSION, MIN_DIMENSION, MAX_ROWS);
    const desiredCols = clampInt(STATE.cols != null ? STATE.cols : MIN_DIMENSION, MIN_DIMENSION, MAX_COLS);
    let layoutChanged = false;
    if (desiredRows !== rows) {
      rows = desiredRows;
      layoutChanged = true;
    }
    if (desiredCols !== cols) {
      cols = desiredCols;
      layoutChanged = true;
    }
    STATE.rows = rows;
    STATE.cols = cols;
    if (layoutChanged) {
      rebuildLayout();
    }
    applyStateToControls();
    updateColorVisibility();
    scheduleFigureDraw();
  }
  function createFigurePanel(id) {
    const panel = document.createElement('div');
    panel.className = 'figurePanel';
    panel.id = `panel${id}`;
    panel.dataset.figureId = String(id);
    panel.innerHTML = `
      <div class="figure"><div id="box${id}" class="box"></div></div>
    `;
    return panel;
  }
  function createFigureSettings(id) {
    const fieldset = document.createElement('fieldset');
    fieldset.id = `fieldset${id}`;
    fieldset.innerHTML = `
      <legend>Figur ${id}</legend>
      <div class="field-row">
        <div class="field">
          <label for="shape${id}">Form</label>
          <select id="shape${id}">
            <option value="circle">sirkel</option>
            <option value="square" selected>kvadrat</option>
            <option value="triangle">trekant</option>
          </select>
        </div>
        <div class="field">
          <label for="division${id}">Delt</label>
          <select id="division${id}">
            <option value="horizontal">horisontalt</option>
            <option value="vertical">vertikalt</option>
            <option value="diagonal">diagonalt</option>
            <option value="grid">horisontalt og vertikalt</option>
            <option value="triangular">trekantsrutenett</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label for="parts${id}">Antall deler</label>
          <input id="parts${id}" class="input--digit input--small" type="number" min="1" value="4" />
        </div>
      </div>
      <div class="fill-color-picker" data-fill-color-picker data-figure-id="${id}">
        <span class="fill-color-picker__label">Fyllfarge</span>
        <div class="color-picker">
          <button type="button" class="color-swatch color-swatch--active color-swatch--pair" aria-label="Velg fyllfarge"></button>
          <div class="color-options" hidden></div>
        </div>
      </div>
      <div class="checkbox-row">
        <input id="allowDenominator${id}" type="checkbox" />
        <label for="allowDenominator${id}">Vis endre nevnerknapp</label>
      </div>
    `;
    return fieldset;
  }
  function updateLayoutControls() {
    if (gridEl) {
      gridEl.dataset.cols = String(cols);
      gridEl.style.setProperty('--figure-cols', String(cols));
      gridEl.dataset.rows = String(rows);
      gridEl.style.setProperty('--figure-rows', String(rows));
    }
    if (addRowBtn) addRowBtn.style.display = rows >= MAX_ROWS ? 'none' : '';
    if (removeRowBtn) removeRowBtn.style.display = rows <= MIN_DIMENSION ? 'none' : '';
    if (addColumnBtn) addColumnBtn.style.display = cols >= MAX_COLS ? 'none' : '';
    if (removeColumnBtn) removeColumnBtn.style.display = cols <= MIN_DIMENSION ? 'none' : '';
    scheduleFigureSizeUpdate();
  }
  function teardownFigure(id) {
    const fig = figures[id];
    if (!fig) return;
    if (typeof fig.destroy === 'function') {
      fig.destroy();
    }
    delete figures[id];
    figureSetupCounts.delete(id);
    figurePanels.delete(id);
    figureFieldsets.delete(id);
  }
  function teardownFigures(total) {
    const max = Math.max(0, total);
    for (let id = figures.length - 1; id > max; id--) {
      if (figures[id]) teardownFigure(id);
    }
    if (figures.length > max + 1) {
      figures.length = max + 1;
    }
  }
  function rebuildLayout() {
    const total = Math.max(MIN_DIMENSION, Math.min(rows * cols, MAX_ROWS * MAX_COLS));
    teardownFigures(total);
    pruneFigureState(total);
    const ids = [];
    if (gridEl) {
      gridEl.innerHTML = '';
      for (let id = 1; id <= total; id++) {
        ids.push(id);
        let panel = figurePanels.get(id);
        if (!panel) {
          panel = createFigurePanel(id);
          figurePanels.set(id, panel);
        }
        gridEl.appendChild(panel);
        ensureFigureState(id);
        const box = panel.querySelector('.box');
        if (box) observeFigureBox(box);
      }
    } else {
      for (let id = 1; id <= total; id++) {
        ids.push(id);
        ensureFigureState(id);
      }
    }
    if (settingsContainer) {
      settingsContainer.innerHTML = '';
      for (const id of ids) {
        let fieldset = figureFieldsets.get(id);
        if (!fieldset) {
          fieldset = createFigureSettings(id);
          figureFieldsets.set(id, fieldset);
        }
        const legend = fieldset.querySelector('legend');
        if (legend) legend.textContent = `Figur ${id}`;
        settingsContainer.appendChild(fieldset);
      }
      settingsContainer.style.setProperty('--figure-settings-cols', String(cols));
      settingsContainer.style.setProperty('--figure-settings-rows', String(rows));
      settingsContainer.dataset.cols = String(cols);
      settingsContainer.dataset.rows = String(rows);
    }
    activeFigureIds = ids;
    updateLayoutControls();
    for (const id of ids) {
      if (!figures[id]) {
        figures[id] = setupFigure(id);
      }
    }
    pruneObservedBoxes();
    scheduleFigureBoardResize();
  }
  function joinWithOg(items) {
    if (!Array.isArray(items)) return '';
    const filtered = items.filter(item => typeof item === 'string' && item);
    const count = filtered.length;
    if (count === 0) return '';
    if (count === 1) return filtered[0];
    if (count === 2) return `${filtered[0]} og ${filtered[1]}`;
    return `${filtered.slice(0, -1).join(', ')} og ${filtered[count - 1]}`;
  }
  function formatCount(value, singular, plural) {
    const num = Number.isFinite(value) ? Math.round(value) : 0;
    const abs = Math.abs(num);
    const word = abs === 1 ? singular : plural || `${singular}er`;
    return `${num} ${word}`;
  }
  function getShapeInfo(shape) {
    switch (normalizeShape(shape)) {
      case 'circle':
        return { article: 'en', noun: 'sirkel' };
      case 'square':
        return { article: 'et', noun: 'kvadrat' };
      case 'triangle':
        return { article: 'en', noun: 'trekant' };
      default:
        return { article: 'en', noun: 'figur' };
    }
  }
  function computeGridDimensionsForParts(parts) {
    const n = Math.max(1, Math.round(Number(parts) || 0));
    let cols = Math.max(1, Math.floor(Math.sqrt(n)));
    while (cols > 1 && n % cols !== 0) cols--;
    if (cols <= 0) cols = 1;
    const rowsCount = Math.max(1, Math.round(n / cols));
    return { rows: rowsCount, cols };
  }
  function describeDivision(fig) {
    const totalText = formatCount(fig.parts, 'del', 'deler');
    switch (fig.division) {
      case 'horizontal':
        return `delt horisontalt i ${totalText}`;
      case 'vertical':
        return `delt vertikalt i ${totalText}`;
      case 'diagonal':
        return `delt diagonalt i ${totalText}`;
      case 'grid': {
        if (fig.gridRows && fig.gridCols) {
          const gridText = joinWithOg([
            formatCount(fig.gridRows, 'rad', 'rader'),
            formatCount(fig.gridCols, 'kolonne', 'kolonner')
          ]);
          if (gridText) {
            return `delt i et rutenett med ${gridText} (${totalText} totalt)`;
          }
        }
        return `delt i et rutenett med ${totalText}`;
      }
      case 'triangular': {
        if (fig.triangularSize) {
          return `delt i et trekantsrutenett på ${formatCount(fig.triangularSize, 'rad', 'rader')} (${totalText} totalt)`;
        }
        return `delt i et trekantsrutenett med ${totalText}`;
      }
      default:
        return `delt i ${totalText}`;
    }
  }
  function describeFillUsage(fig) {
    const counts = Array.isArray(fig.colorCounts) ? fig.colorCounts : [];
    const parts = [];
    counts.forEach((count, idx) => {
      if (!Number.isFinite(count) || count <= 0) return;
      parts.push(`${formatCount(count, 'del', 'deler')} i farge ${idx + 1}`);
    });
    if (Number.isFinite(fig.emptyCount) && fig.emptyCount > 0) {
      parts.push(`${formatCount(fig.emptyCount, 'del', 'deler')} uten farge`);
    }
    if (parts.length === 0) {
      return 'Ingen deler er fylt.';
    }
    return `Fordeling: ${joinWithOg(parts)}.`;
  }
  function collectBrokfigurerAltSummary() {
    const ids = getActiveFigureIds();
    const figureIds = Array.isArray(ids) ? ids : [];
    const summary = {
      rows,
      cols,
      figureCount: figureIds.length,
      figures: []
    };
    if (figureIds.length === 0) return summary;
    const paletteLength = getFillPalette().length;
    figureIds.forEach((id, index) => {
      const figState = ensureFigureState(id);
      const shape = typeof (figState == null ? void 0 : figState.shape) === 'string' ? normalizeShape(figState.shape) : 'square';
      const division = typeof (figState == null ? void 0 : figState.division) === 'string' ? figState.division : 'horizontal';
      const parts = clampInt(figState == null ? void 0 : figState.parts, 1);
      const entries = Array.isArray(figState == null ? void 0 : figState.filled) ? figState.filled : [];
      const colorCounts = [];
      const seenParts = new Set();
      let filledTotal = 0;
      entries.forEach(entry => {
        if (!entry || entry.length < 2) return;
        const partIndex = Number(entry[0]);
        if (Number.isFinite(partIndex)) {
          if (seenParts.has(partIndex)) return;
          seenParts.add(partIndex);
        }
        const colorIndex = Number(entry[1]);
        if (!Number.isFinite(colorIndex) || colorIndex <= 0) return;
        const idx = Math.max(0, Math.floor(colorIndex - 1));
        while (colorCounts.length <= idx) colorCounts.push(0);
        colorCounts[idx] += 1;
        filledTotal += 1;
      });
      if (paletteLength > colorCounts.length) {
        for (let i = colorCounts.length; i < paletteLength; i++) {
          colorCounts[i] = 0;
        }
      } else {
        for (let i = 0; i < colorCounts.length; i++) {
          if (!Number.isFinite(colorCounts[i]) || colorCounts[i] < 0) colorCounts[i] = 0;
        }
      }
      const emptyCount = Math.max(0, parts - filledTotal);
      let gridRows = null;
      let gridCols = null;
      let triangularSize = null;
      if (division === 'grid') {
        const dims = computeGridDimensionsForParts(parts);
        gridRows = dims.rows;
        gridCols = dims.cols;
      } else if (division === 'triangular') {
        triangularSize = Math.max(1, Math.round(Math.sqrt(Math.max(1, parts))));
      }
      summary.figures.push({
        id,
        index: index + 1,
        shape,
        division,
        parts,
        colorCounts,
        emptyCount,
        gridRows,
        gridCols,
        triangularSize
      });
    });
    return summary;
  }
  function describeFigureSummary(fig) {
    const shapeInfo = getShapeInfo(fig.shape);
    const base = `Figur ${fig.index} er ${shapeInfo.article} ${shapeInfo.noun} ${describeDivision(fig)}.`;
    const fill = describeFillUsage(fig);
    return fill ? `${base} ${fill}` : base;
  }
  function buildBrokfigurerAltText(summary) {
    const data = summary || collectBrokfigurerAltSummary();
    if (!data) return 'Brøkfigurer.';
    const sentences = [];
    if (data.figureCount > 0) {
      const layout = joinWithOg([
        formatCount(data.rows, 'rad', 'rader'),
        formatCount(data.cols, 'kolonne', 'kolonner')
      ]);
      const figureText = data.figureCount === 1 ? 'én figur' : `${data.figureCount} figurer`;
      if (layout) {
        sentences.push(`Oppsettet viser ${figureText} fordelt på ${layout}.`);
      } else {
        sentences.push(`Oppsettet viser ${figureText}.`);
      }
    } else {
      sentences.push('Oppsettet viser ingen figurer.');
    }
    if (Array.isArray(data.figures)) {
      data.figures.forEach(fig => {
        sentences.push(describeFigureSummary(fig));
      });
    }
    return sentences.filter(Boolean).join(' ');
  }
  function getBrokfigurerAltTitle() {
    const summary = collectBrokfigurerAltSummary();
    if (!summary) return 'Brøkfigurer';
    return summary.figureCount === 1 ? 'Brøkfigur' : 'Brøkfigurer';
  }
  function ensureAltTextAnchor() {
    if (typeof document === 'undefined') return null;
    let anchor = document.getElementById('brokfigurer-alt-anchor');
    if (!anchor) {
      anchor = document.createElementNS(SVG_NS, 'svg');
      anchor.setAttribute('id', 'brokfigurer-alt-anchor');
      anchor.setAttribute('width', '0');
      anchor.setAttribute('height', '0');
      anchor.setAttribute('aria-hidden', 'true');
      anchor.style.position = 'absolute';
      anchor.style.width = '0';
      anchor.style.height = '0';
      anchor.style.overflow = 'hidden';
      anchor.style.left = '-9999px';
      if (document.body) {
        document.body.appendChild(anchor);
      }
    }
    return anchor;
  }
  function updateAltTextTargetAttributes() {
    if (typeof document === 'undefined' || !window.MathVisAltText) return;
    const board = document.getElementById('figureBoard');
    const anchor = document.getElementById('brokfigurer-alt-anchor');
    if (!board || !anchor) return;
    const nodes = window.MathVisAltText.ensureSvgA11yNodes(anchor);
    board.setAttribute('role', 'img');
    board.setAttribute('aria-label', getBrokfigurerAltTitle());
    if (nodes.titleEl && nodes.titleEl.id) {
      board.setAttribute('aria-labelledby', nodes.titleEl.id);
    }
    if (nodes.descEl && nodes.descEl.id) {
      board.setAttribute('aria-describedby', nodes.descEl.id);
    }
  }
  function refreshAltText(reason) {
    const signature = buildBrokfigurerAltText();
    if (altTextManager && typeof altTextManager.refresh === 'function') {
      altTextManager.refresh(reason || 'auto', signature);
    }
    updateAltTextTargetAttributes();
  }
  function initAltTextManager() {
    if (typeof window === 'undefined' || !window.MathVisAltText) return;
    if (altTextManager) {
      updateAltTextTargetAttributes();
      return;
    }
    const container = document.getElementById('exportCard');
    if (!container) return;
    const anchor = ensureAltTextAnchor();
    if (!anchor) return;
    altTextManager = window.MathVisAltText.create({
      svg: () => anchor,
      container,
      getTitle: getBrokfigurerAltTitle,
      getState: () => ({
        text: typeof STATE.altText === 'string' ? STATE.altText : '',
        source: STATE.altTextSource === 'manual' ? 'manual' : 'auto'
      }),
      setState: (text, source) => {
        STATE.altText = text;
        STATE.altTextSource = source === 'manual' ? 'manual' : 'auto';
      },
      generate: () => buildBrokfigurerAltText(),
      getSignature: () => buildBrokfigurerAltText(),
      getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
      getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
    });
    updateAltTextTargetAttributes();
  }
  window.render = renderAll;
  function setupFigure(id) {
    const previousSetupCount = figureSetupCounts.get(id) || 0;
    figureSetupCounts.set(id, previousSetupCount + 1);
    const shouldResetFilled = previousSetupCount > 0;
    const shapeSel = document.getElementById(`shape${id}`);
    const partsInp = document.getElementById(`parts${id}`);
    const divSel = document.getElementById(`division${id}`);
    const minusBtn = document.getElementById(`partsMinus${id}`);
    const plusBtn = document.getElementById(`partsPlus${id}`);
    const partsVal = document.getElementById(`partsVal${id}`);
    const allowDenominatorInp = document.getElementById(`allowDenominator${id}`);
    const stepperEl = document.getElementById(`partsStepper${id}`);
    const panel = document.getElementById(`panel${id}`);
    let board;
    const divisionSegmentIds = new Set();
    const divisionSegmentNodes = new Set();
    const fillSegmentNodes = new Set();
    let filled = new Map();
    let suppressToggle = false;
    let suppressToggleResetTimer = null;
    let detachDivisionGuard = null;
    let layoutMetrics = null;
    const teardownTasks = [];
    const eventAbortController = typeof AbortController === 'function' ? new AbortController() : null;
    const registerListener = (target, type, handler, options) => {
      if (!target) return;
      let opts = options;
      if (eventAbortController) {
        if (opts == null) {
          opts = { signal: eventAbortController.signal };
        } else if (typeof opts === 'boolean') {
          opts = { capture: opts, signal: eventAbortController.signal };
        } else if (typeof opts === 'object') {
          opts = Object.assign({}, opts, { signal: eventAbortController.signal });
        }
      }
      target.addEventListener(type, handler, opts);
      if (!eventAbortController) {
        teardownTasks.push(() => target.removeEventListener(type, handler, options || false));
      }
    };
    function setLayoutMetrics(metrics) {
      if (metrics && typeof metrics === 'object') {
        layoutMetrics = {
          width: Number(metrics.width) || 0,
          height: Number(metrics.height) || 0,
          top: Number(metrics.top) || 0,
          left: Number(metrics.left) || 0
        };
      } else {
        layoutMetrics = null;
      }
    }
    function updateDenominatorControls(override, figStateOverride) {
      const figState = figStateOverride || ensureFigureState(id);
      let enabled;
      if (typeof override === 'boolean') {
        enabled = override;
      } else if (typeof figState.allowDenominatorChange === 'boolean') {
        enabled = figState.allowDenominatorChange;
      } else if (typeof figState.allowDenominatorChange === 'string') {
        enabled = figState.allowDenominatorChange === 'true';
      } else {
        enabled = false;
      }
      if (figState.allowDenominatorChange !== enabled) {
        figState.allowDenominatorChange = enabled;
      }
      if (allowDenominatorInp && allowDenominatorInp.checked !== enabled) {
        allowDenominatorInp.checked = enabled;
      }
      if (partsInp) {
        partsInp.disabled = false;
      }
      if (minusBtn) minusBtn.style.display = enabled ? '' : 'none';
      if (plusBtn) plusBtn.style.display = enabled ? '' : 'none';
      if (stepperEl) {
        stepperEl.removeAttribute('aria-hidden');
      }
      return enabled;
    }
    function normalizeFilledEntries(value) {
      let iterable;
      if (value instanceof Map) {
        iterable = value.entries();
      } else if (Array.isArray(value)) {
        iterable = value;
      } else if (value && typeof value[Symbol.iterator] === 'function') {
        iterable = value;
      } else if (value && typeof value === 'object') {
        iterable = Object.entries(value);
      } else {
        iterable = [];
      }
      const normalized = new Map();
      for (const entry of iterable) {
        if (entry == null) continue;
        let pair;
        if (Array.isArray(entry)) pair = entry;else {
          try {
            pair = Array.from(entry);
          } catch (_) {
            continue;
          }
        }
        if (!Array.isArray(pair) || pair.length < 2) continue;
        const partIndex = Number.parseInt(pair[0], 10);
        const colorIndex = Number.parseInt(pair[1], 10);
        if (!Number.isFinite(partIndex) || partIndex < 0) continue;
        if (!Number.isFinite(colorIndex) || colorIndex <= 0) continue;
        normalized.set(partIndex, colorIndex);
      }
      return Array.from(normalized.entries()).sort((a, b) => a[0] - b[0]);
    }
    function syncFilledState(entriesOverride, skipMapUpdate) {
      const figState = ensureFigureState(id);
      const entries = Array.isArray(entriesOverride) ? entriesOverride.slice() : Array.from(filled.entries());
      entries.sort((a, b) => a[0] - b[0]);
      if (!skipMapUpdate) {
        filled = new Map(entries);
      }
      figState.filled = entries;
    }
    function initBoard(shape) {
      if (board) {
        var _board$stopResizeObse;
        (_board$stopResizeObse = board.stopResizeObserver) === null || _board$stopResizeObse === void 0 ? void 0 : _board$stopResizeObse.call(board);
        JXG.JSXGraph.freeBoard(board);
      }
      const boundingBox = BOARD_BOUNDING_BOX;
      board = JXG.JSXGraph.initBoard(`box${id}`, {
        boundingbox: boundingBox,
        axis: false,
        showCopyright: false,
        showNavigation: false,
        keepaspectratio: true
      });
    }
    let pendingClipFrame = null;
    let pendingClipState = null;
    function scheduleClipUpdate(shape, division) {
      pendingClipState = {
        shape,
        division
      };
      if (pendingClipFrame != null) return;
      pendingClipFrame = requestAnimationFrame(() => {
        pendingClipFrame = null;
        if (!pendingClipState) return;
        const {
          shape,
          division
        } = pendingClipState;
        pendingClipState = null;
        applyClip(shape, division);
      });
    }
    function resizeBoard() {
      if (!board || !board.containerObj || typeof board.resizeContainer !== 'function') return;
      const width = board.containerObj.clientWidth;
      const height = board.containerObj.clientHeight;
      if (!width || !height) return;
      const figState = ensureFigureState(id);
      const shape = normalizeShape(figState.shape || (shapeSel && shapeSel.value) || 'square');
      const boundingBox = BOARD_BOUNDING_BOX;
      board.resizeContainer(width, height);
      if (typeof board.setBoundingBox === 'function') {
        board.setBoundingBox(BOARD_BOUNDING_BOX, true);
        board.setBoundingBox(boundingBox, true);
      }
      board.update();
      if (shape === 'circle' || shape === 'triangle') {
        clearRoundedRectFrame();
      } else {
        updateRoundedRectFrame();
      }
      const division = figState.division || (divSel && divSel.value) || 'horizontal';
      scheduleClipUpdate(shape, division);
    }
    function disableHitDetection(element) {
      if (element && typeof element.hasPoint === 'function') {
        element.hasPoint = () => false;
      }
    }
    const getEventPoint = evt => {
      if (!evt) return null;
      if (typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
        return {
          x: evt.clientX,
          y: evt.clientY
        };
      }
      const touch = evt.touches && evt.touches[0] || evt.changedTouches && evt.changedTouches[0];
      if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
        return {
          x: touch.clientX,
          y: touch.clientY
        };
      }
      if (evt.evt) return getEventPoint(evt.evt);
      return null;
    };
    const hasPointerEvents = el => {
      if (!el) return false;
      const inline = el.style && typeof el.style.pointerEvents === 'string' ? el.style.pointerEvents.trim().toLowerCase() : '';
      if (inline === 'none') return false;
      if (inline) return true;
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && el.nodeType === 1) {
        const computed = window.getComputedStyle(el);
        const computedValue = computed && typeof computed.pointerEvents === 'string' ? computed.pointerEvents.trim().toLowerCase() : '';
        if (computedValue === 'none') return false;
        if (computedValue) return true;
      }
      return true;
    };
    const isDivisionStrokeElement = el => {
      if (!el) return false;
      if (typeof Element !== 'undefined' && !(el instanceof Element)) return false;
      if (!hasPointerEvents(el)) return false;
      if (divisionSegmentNodes.has(el)) return true;
      if (el.getAttribute && el.getAttribute('data-division-segment') === 'true') return true;
      if (el.classList && el.classList.contains('brok-division-segment')) return true;
      if (typeof el.getAttribute === 'function') {
        const dashAttr = el.getAttribute('stroke-dasharray');
        if (dashAttr && dashAttr !== 'none') return true;
      }
      if (el.style && typeof el.style.strokeDasharray === 'string' && el.style.strokeDasharray && el.style.strokeDasharray !== 'none') {
        return true;
      }
      if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
        const computed = el.nodeType === 1 ? window.getComputedStyle(el) : null;
        if (computed && typeof computed.strokeDasharray === 'string' && computed.strokeDasharray && computed.strokeDasharray !== 'none') {
          return true;
        }
      }
      return false;
    };
    const findDivisionStroke = element => {
      let current = element;
      while (current) {
        if (isDivisionStrokeElement(current)) return current;
        current = current.parentNode;
      }
      return null;
    };
    const DIVISION_STROKE_HIT_PADDING = 2;
    function getDivisionStrokeAtPoint(point) {
      if (!point || !panel) return null;
      const box = panel.querySelector('.box');
      if (!box) return null;
      const rect = box.getBoundingClientRect();
      if (point.x < rect.left || point.x > rect.right || point.y < rect.top || point.y > rect.bottom) return null;
      if (typeof document !== 'undefined') {
        if (typeof document.elementsFromPoint === 'function') {
          const elements = document.elementsFromPoint(point.x, point.y) || [];
          for (const el of elements) {
            const stroke = findDivisionStroke(el);
            if (stroke) return stroke;
          }
        }
        const target = document.elementFromPoint(point.x, point.y);
        const stroke = findDivisionStroke(target);
        if (stroke) return stroke;
      }
      for (const node of divisionSegmentNodes) {
        if (!node) continue;
        if (typeof node.isConnected === 'boolean' && !node.isConnected) continue;
        if (typeof node.getBoundingClientRect !== 'function') continue;
        if (!hasPointerEvents(node)) continue;
        const nodeRect = node.getBoundingClientRect();
        const pad = DIVISION_STROKE_HIT_PADDING;
        if (
          point.x >= nodeRect.left - pad &&
          point.x <= nodeRect.right + pad &&
          point.y >= nodeRect.top - pad &&
          point.y <= nodeRect.bottom + pad
        ) {
          return node;
        }
      }
      return null;
    }
    function preventDivisionClick(element) {
      if (!element) return;
      const nodes = [];
      if (element.rendNode) nodes.push(element.rendNode);
      if (element.rendNodeFront && element.rendNodeFront !== element.rendNode) nodes.push(element.rendNodeFront);
      for (const node of nodes) {
        if (!node) continue;
        if (node.style) {
          node.style.pointerEvents = 'none';
          if (!node.style.cursor) node.style.cursor = 'default';
        }
      }
    }
    const clonePoint = point => {
      if (Array.isArray(point)) return point.slice();
      if (point && typeof point === 'object') {
        if (typeof point.X === 'function' && typeof point.Y === 'function') {
          const x = Number(point.X());
          const y = Number(point.Y());
          if (Number.isFinite(x) && Number.isFinite(y)) return [x, y];
        }
        const usrCoords = point.coords && point.coords.usrCoords;
        if (usrCoords && usrCoords.length >= 3) {
          const w = Number(usrCoords[0]);
          const x = Number(usrCoords[1]);
          const y = Number(usrCoords[2]);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            if (Number.isFinite(w) && w !== 0) {
              return [x / w, y / w];
            }
            return [x, y];
          }
        }
      }
      return [Number(point == null ? void 0 : point[0]) || 0, Number(point == null ? void 0 : point[1]) || 0];
    };
    function ensureDivisionGuard() {
      if (detachDivisionGuard || !panel) return;
      const box = panel.querySelector('.box');
      if (!box) return;
      if (typeof window !== 'undefined') window.__guardInitCount = (window.__guardInitCount || 0) + 1;
      const downHandler = evt => {
        const point = getEventPoint(evt);
        if (!point) return;
        const strokeEl = getDivisionStrokeAtPoint(point);
        if (strokeEl) {
          if (suppressToggleResetTimer != null) {
            clearTimeout(suppressToggleResetTimer);
            suppressToggleResetTimer = null;
          }
          suppressToggle = true;
        }
      };
      const upHandler = () => {
        if (suppressToggleResetTimer != null) clearTimeout(suppressToggleResetTimer);
        suppressToggleResetTimer = setTimeout(() => {
          suppressToggle = false;
          suppressToggleResetTimer = null;
        }, 0);
      };
      const docDownHandler = evt => {
        if (!evt) return;
        const point = getEventPoint(evt);
        const strokeEl = getDivisionStrokeAtPoint(point);
        if (!strokeEl) return;
        if (suppressToggleResetTimer != null) {
          clearTimeout(suppressToggleResetTimer);
          suppressToggleResetTimer = null;
        }
        suppressToggle = true;
      };
      const docUpHandler = evt => {
        if (!evt) return;
        if (suppressToggleResetTimer != null) clearTimeout(suppressToggleResetTimer);
        suppressToggleResetTimer = setTimeout(() => {
          suppressToggle = false;
          suppressToggleResetTimer = null;
        }, 0);
      };
      const listeners = [[
        'pointerdown',
        downHandler
      ], [
        'mousedown',
        downHandler
      ], [
        'touchstart',
        downHandler
      ], [
        'pointerup',
        upHandler
      ], [
        'mouseup',
        upHandler
      ], [
        'touchend',
        upHandler
      ], [
        'click',
        upHandler
      ]];
      const docListeners = [[
        'pointerdown',
        docDownHandler
      ], [
        'mousedown',
        docDownHandler
      ], [
        'touchstart',
        docDownHandler
      ], [
        'pointerup',
        docUpHandler
      ], [
        'mouseup',
        docUpHandler
      ], [
        'touchend',
        docUpHandler
      ]];
      const winListeners = docListeners;
      const passiveCapture = { capture: true, passive: true };
      for (const [type, handler] of listeners) {
        box.addEventListener(type, handler, passiveCapture);
      }
      for (const [type, handler] of docListeners) {
        document.addEventListener(type, handler, passiveCapture);
      }
      for (const [type, handler] of winListeners) {
        window.addEventListener(type, handler, passiveCapture);
      }
      detachDivisionGuard = () => {
        for (const [type, handler] of listeners) {
          box.removeEventListener(type, handler, passiveCapture);
        }
        for (const [type, handler] of docListeners) {
          document.removeEventListener(type, handler, passiveCapture);
        }
        for (const [type, handler] of winListeners) {
          window.removeEventListener(type, handler, passiveCapture);
        }
        detachDivisionGuard = null;
      };
    }
    function extendSegmentEndpoints(start, end, extension = DIVISION_SEGMENT_EXTENSION) {
      const p1 = clonePoint(start);
      const p2 = clonePoint(end);
      if (!Number.isFinite(extension) || extension <= 0) return [p1, p2];
      const dx = p2[0] - p1[0];
      const dy = p2[1] - p1[1];
      const length = Math.hypot(dx, dy);
      if (!(length > 0)) return [p1, p2];
      const ux = dx / length;
      const uy = dy / length;
      return [[p1[0] - ux * extension, p1[1] - uy * extension], [p2[0] + ux * extension, p2[1] + uy * extension]];
    }
    function markDivisionNode(node) {
      if (!node) return;
      const isFilled = isFilledNode(node);
      if (isFilled) return;
      if (node.classList) node.classList.add('brok-division-segment');
      if (typeof node.setAttribute === 'function') node.setAttribute('data-division-segment', 'true');
      if (node.id) divisionSegmentIds.add(node.id);
      divisionSegmentNodes.add(node);
      if (node.style) {
        node.style.pointerEvents = 'none';
        if (!node.style.cursor) node.style.cursor = 'default';
      }
    }
    function markPolygonBorders(polygon) {
      if (!polygon || !Array.isArray(polygon.borders)) return;
      for (const border of polygon.borders) {
        if (!border) continue;
        const nodes = [border.rendNode, border.rendNodeFront && border.rendNodeFront !== border.rendNode ? border.rendNodeFront : null];
        for (const node of nodes) {
          if (!node) continue;
          const stroke = typeof node.getAttribute === 'function' ? node.getAttribute('stroke') : null;
          const strokeWidth = typeof node.getAttribute === 'function' ? Number(node.getAttribute('stroke-width')) : NaN;
          if (stroke === 'none' || strokeWidth === 0) continue;
          node.setAttribute('stroke-linecap', 'round');
          node.setAttribute('stroke-linejoin', 'round');
          markDivisionNode(node);
        }
      }
    }
    function isFilledNode(node) {
      if (!node || typeof node.getAttribute !== 'function') return false;
      const fillAttr = node.getAttribute('fill');
      const fillOpacityAttr = node.getAttribute('fill-opacity');
      const inlineFill = node.style && typeof node.style.fill === 'string' ? node.style.fill.trim().toLowerCase() : '';
      const inlineOpacity = node.style && typeof node.style.fillOpacity === 'string' ? node.style.fillOpacity.trim() : '';
      const effectiveFill = (typeof fillAttr === 'string' && fillAttr.trim().toLowerCase()) || inlineFill;
      const hasColor = effectiveFill && effectiveFill !== 'none' && effectiveFill !== 'transparent';
      const parseOpacity = value => {
        if (typeof value !== 'string' || value === '') return NaN;
        const num = Number(value);
        return Number.isFinite(num) ? num : NaN;
      };
      const fillOpacity = parseOpacity(fillOpacityAttr);
      const styleOpacity = parseOpacity(inlineOpacity);
      const opacityValue = Number.isFinite(styleOpacity) ? styleOpacity : fillOpacity;
      const hasVisibleOpacity = Number.isFinite(opacityValue) ? opacityValue > 0 : true;
      return hasColor && hasVisibleOpacity;
    }
    function ensureFillGroup() {
      var _board$renderer3, _board$renderer3$svg;
      const svg = (_board$renderer3 = board == null ? void 0 : board.renderer) === null || _board$renderer3 === void 0 || (_board$renderer3$svg = _board$renderer3.svgRoot) === null || _board$renderer3$svg === void 0 ? void 0 : _board$renderer3$svg;
      if (!svg) return null;
      const groupId = `brok-fill-group-${id}`;
      let group = svg.querySelector(`#${groupId}`);
      if (!group) {
        group = document.createElementNS(SVG_NS, 'g');
        group.setAttribute('id', groupId);
        group.setAttribute('data-brok-fill-group', String(id));
      }
      if (!group.parentNode) {
        const defs = svg.querySelector('defs');
        const insertBefore = defs ? defs.nextSibling : svg.firstChild;
        if (insertBefore) {
          svg.insertBefore(group, insertBefore);
        } else {
          svg.appendChild(group);
        }
      }
      return group;
    }
    function registerFillNode(node) {
      if (!node || !isFilledNode(node)) return;
      const group = ensureFillGroup();
      if (!group) return;
      if (node.parentNode !== group) {
        group.appendChild(node);
      }
      fillSegmentNodes.add(node);
    }
    function registerFillNodes(element) {
      if (!element) return;
      const nodes = collectRenderNodes(element);
      for (const node of nodes) {
        registerFillNode(node);
      }
    }
    function getRoundedRectScreenBox() {
      if (!board || typeof JXG === 'undefined' || !JXG.Coords) return null;
      const topLeft = new JXG.Coords(JXG.COORDS_BY_USER, [0, 1], board);
      const bottomRight = new JXG.Coords(JXG.COORDS_BY_USER, [rectWidthScale, 0], board);
      const x = topLeft.scrCoords[1];
      const y = topLeft.scrCoords[2];
      const width = bottomRight.scrCoords[1] - topLeft.scrCoords[1];
      const height = bottomRight.scrCoords[2] - topLeft.scrCoords[2];
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
      return {
        x,
        y,
        width,
        height
      };
    }
    function ensureRoundedRectElement(rectId, insertBeforeElements) {
      var _board$renderer, _board$renderer$svgR;
      const svg = (_board$renderer = board == null ? void 0 : board.renderer) === null || _board$renderer === void 0 || (_board$renderer$svgR = _board$renderer.svgRoot) === null || _board$renderer$svgR === void 0 ? void 0 : _board$renderer$svgR;
      if (!svg) return null;
      let rect = svg.querySelector(`#${rectId}`);
      if (!rect) {
        rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('id', rectId);
        rect.setAttribute('data-brok-frame', String(id));
      }
      if (!rect.parentNode) {
        const defs = svg.querySelector('defs');
        const fallback = insertBeforeElements ? (defs ? defs.nextSibling : svg.firstChild) : null;
        if (insertBeforeElements && fallback) {
          svg.insertBefore(rect, fallback);
        } else {
          svg.appendChild(rect);
        }
      }
      return rect;
    }
    function clearRoundedRectFrame() {
      var _board$renderer2, _board$renderer2$svg;
      const svg = (_board$renderer2 = board == null ? void 0 : board.renderer) === null || _board$renderer2 === void 0 || (_board$renderer2$svg = _board$renderer2.svgRoot) === null || _board$renderer2$svg === void 0 ? void 0 : _board$renderer2$svg;
      if (!svg) return;
      const background = svg.querySelector(`#brok-rect-bg-${id}`);
      if (background) background.remove();
      const outline = svg.querySelector(`#brok-rect-outline-${id}`);
      if (outline) outline.remove();
    }
    function updateRoundedRectFrame() {
      const figState = ensureFigureState(id);
      const shape = normalizeShape(figState.shape || (shapeSel && shapeSel.value) || 'square');
      if (shape !== 'square') {
        clearRoundedRectFrame();
        return;
      }
      const rectBox = getRoundedRectScreenBox();
      if (!showOutlineGlobal || !rectBox) {
        clearRoundedRectFrame();
        return;
      }
      const radius = Math.max(0, Math.min(rectBox.width, rectBox.height) * RECT_CORNER_RADIUS_RATIO);
      const background = ensureRoundedRectElement(`brok-rect-bg-${id}`, true);
      if (background) {
        background.setAttribute('x', rectBox.x.toFixed(3));
        background.setAttribute('y', rectBox.y.toFixed(3));
        background.setAttribute('width', rectBox.width.toFixed(3));
        background.setAttribute('height', rectBox.height.toFixed(3));
        background.setAttribute('rx', radius.toFixed(3));
        background.setAttribute('ry', radius.toFixed(3));
        background.setAttribute('fill', '#fff');
        background.setAttribute('stroke', 'none');
        background.setAttribute('pointer-events', 'none');
      }
      const outline = ensureRoundedRectElement(`brok-rect-outline-${id}`, false);
      if (outline) {
        const inset = Math.max(0, OUTLINE_STROKE_WIDTH / 2);
        const outlineX = rectBox.x + inset;
        const outlineY = rectBox.y + inset;
        const outlineWidth = Math.max(0, rectBox.width - inset * 2);
        const outlineHeight = Math.max(0, rectBox.height - inset * 2);
        const outlineRadius = Math.max(0, Math.min(outlineWidth, outlineHeight) * RECT_CORNER_RADIUS_RATIO);
        outline.setAttribute('x', outlineX.toFixed(3));
        outline.setAttribute('y', outlineY.toFixed(3));
        outline.setAttribute('width', outlineWidth.toFixed(3));
        outline.setAttribute('height', outlineHeight.toFixed(3));
        outline.setAttribute('rx', outlineRadius.toFixed(3));
        outline.setAttribute('ry', outlineRadius.toFixed(3));
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', activeLineColor);
        outline.setAttribute('stroke-width', String(OUTLINE_STROKE_WIDTH));
        outline.setAttribute('pointer-events', 'none');
      }
    }
    function createDivisionSegment(start, end, options = {}, extend = true) {
      if (!showDivisionLinesGlobal) return null;
      const [p1, p2] = extend ? extendSegmentEndpoints(start, end) : [clonePoint(start), clonePoint(end)];
      const seg = board.create('segment', [p1, p2], Object.assign({
        strokeColor: activeLineColor,
        strokeWidth: 2,
        dash: 0,
        highlight: false,
        highlightStrokeColor: activeLineColor,
        highlightStrokeOpacity: 1,
        highlightStrokeWidth: 2,
        fixed: true,
        linecap: 'round',
        layer: 10
      }, options));
      preventDivisionClick(seg);
      disableHitDetection(seg);
      if (typeof seg.on === 'function') {
        seg.on('down', evt => {
          if (evt && typeof evt.stopPropagation === 'function') evt.stopPropagation();
          if (evt && typeof evt.preventDefault === 'function') evt.preventDefault();
          return false;
        });
      }
      markDivisionNode(seg == null ? void 0 : seg.rendNode);
      if (seg != null && seg.rendNodeFront && seg.rendNodeFront !== seg.rendNode) markDivisionNode(seg.rendNodeFront);
      return seg;
    }
    const DOM_TOGGLE_EVENTS = typeof window !== 'undefined' && 'PointerEvent' in window ? ['pointerdown', 'click'] : ['mousedown', 'touchstart', 'click'];
    let lastToggleEventTime = 0;
    let lastToggleEventType = '';
    function collectRenderNodes(element) {
      if (!element) return [];
      const nodes = new Set();
      const addNode = node => {
        if (!node) return;
        nodes.add(node);
        if (node.nodeType === 1 && typeof node.querySelectorAll === 'function') {
          const children = node.querySelectorAll('path, polygon, rect');
          for (const child of children) {
            nodes.add(child);
          }
        }
      };
      addNode(element.rendNode);
      if (element.rendNodeFront && element.rendNodeFront !== element.rendNode) {
        addNode(element.rendNodeFront);
      }
      return Array.from(nodes);
    }
    function attachToggleHandler(element, partIndex) {
      if (!element) return;
      const handler = evt => togglePart(partIndex, element, evt);
      const domHandler = evt => {
        handler(evt);
      };
      const nodes = collectRenderNodes(element);
      const fillNodes = nodes.filter(node => isFilledNode(node));
      const interactiveNodes = fillNodes.length ? fillNodes : nodes;
      for (const node of interactiveNodes) {
        if (!node) continue;
        if (node.style) {
          if (!node.style.pointerEvents || node.style.pointerEvents === 'none') {
            node.style.pointerEvents = isFilledNode(node) ? 'fill' : 'auto';
          }
          if (!node.style.cursor || node.style.cursor === 'default') {
            node.style.cursor = 'pointer';
          }
        }
        for (const type of DOM_TOGGLE_EVENTS) {
          registerListener(node, type, domHandler, true);
        }
      }
    }
    function togglePart(i, element, evt) {
      if (evt && typeof evt.type === 'string') {
        if (evt.type === 'click') {
          const now = Date.now();
          if (lastToggleEventType && lastToggleEventType !== 'click' && now - lastToggleEventTime < 350) {
            return;
          }
        } else {
          lastToggleEventType = evt.type;
          lastToggleEventTime = Date.now();
        }
      }
      const evtTarget = evt == null ? void 0 : evt.target;
      const targetId = typeof evtTarget === 'string' ? evtTarget : evtTarget && typeof evtTarget.id === 'string' ? evtTarget.id : null;
      if (targetId && divisionSegmentIds.has(targetId)) {
        suppressToggle = false;
        return;
      }
      const point = getEventPoint(evt);
      if (point && getDivisionStrokeAtPoint(point)) {
        suppressToggle = false;
        return;
      }
      if (suppressToggle) {
        suppressToggle = false;
        return;
      }
      const colors = getFillPalette();
      const current = filled.get(i) || 0;
      const targetIndex = getFigureFillIndex(id);
      const next = current === targetIndex ? 0 : targetIndex;
      if (next === 0) {
        filled.delete(i);
        element.setAttribute({
          fillColor: '#fff',
          fillOpacity: 1
        });
      } else {
        filled.set(i, next);
        element.setAttribute({
          fillColor: colors[next - 1],
          fillOpacity: 1
        });
      }
      board.update();
      syncFilledState();
      clearCheckStatus();
      refreshAltText('fill-change');
      if (evt && typeof evt.type === 'string' && evt.type === 'click') {
        lastToggleEventType = evt.type;
        lastToggleEventTime = Date.now();
      }
    }
    function gridDims(n) {
      let cols = Math.floor(Math.sqrt(n));
      while (n % cols !== 0) cols--;
      const rows = n / cols;
      return {
        rows,
        cols
      };
    }
    function hasProperFactor(n) {
      if (n < 4) return false;
      for (let i = 2; i * i <= n; i++) {
        if (n % i === 0) return true;
      }
      return false;
    }
    let rectWidthScale = 1;
    let activeLineColor = '#000';
    let linePalette = [];
    let fillPalette = [];
    function updateBoxLayout(shape) {
      if (!panel) return;
      const box = panel.querySelector('.box');
      if (!box) return;
      if (shape) {
        box.dataset.shape = shape;
      } else {
        delete box.dataset.shape;
      }
    }
    function draw() {
      var _ref, _partsInp$value;
      if (!panel || !panel.isConnected || panel.style.display === 'none') return;
      const figState = ensureFigureState(id);
      updateDenominatorControls(figState.allowDenominatorChange, figState);
      setFilled(figState.filled);
      let n = clampInt((_ref = (_partsInp$value = partsInp === null || partsInp === void 0 ? void 0 : partsInp.value) !== null && _partsInp$value !== void 0 ? _partsInp$value : figState.parts) !== null && _ref !== void 0 ? _ref : 1, 1);
      const shape = normalizeShape((shapeSel === null || shapeSel === void 0 ? void 0 : shapeSel.value) || figState.shape || 'square');
      let division = (divSel === null || divSel === void 0 ? void 0 : divSel.value) || figState.division || 'horizontal';
      const allowWrong = allowWrongGlobal;
      rectWidthScale = 1;
      updateBoxLayout(shape);
      initBoard(shape);
      if (shape === 'circle' || shape === 'triangle') {
        clearRoundedRectFrame();
      }
      divisionSegmentIds.clear();
      divisionSegmentNodes.clear();
      fillSegmentNodes.clear();
      ensureDivisionGuard();
      if (shape === 'square' && division === 'diagonal') n = 4;
      const gridOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="grid"]');
      const horizOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="horizontal"]');
      const vertOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="vertical"]');
      const triOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="triangular"]');
      if (shape === 'circle' && !allowWrong && division !== 'diagonal') {
        division = 'diagonal';
        if (divSel) divSel.value = 'diagonal';
      }
      if (gridOpt) {
        gridOpt.hidden = !hasProperFactor(n) || shape === 'circle' && !allowWrong || shape === 'triangle';
        if (gridOpt.hidden && division === 'grid') divSel.value = 'horizontal';
      }
      if (horizOpt) {
        horizOpt.hidden = shape === 'circle' && !allowWrong;
        if (horizOpt.hidden && division === 'horizontal') divSel.value = 'diagonal';
      }
      if (vertOpt) {
        vertOpt.hidden = shape === 'circle' && !allowWrong;
        if (vertOpt.hidden && division === 'vertical') divSel.value = 'diagonal';
      }
      if (triOpt) {
        triOpt.hidden = shape !== 'triangle';
        if (triOpt.hidden && division === 'triangular') divSel.value = 'horizontal';
      }
      division = (divSel === null || divSel === void 0 ? void 0 : divSel.value) || division;
      if (shape === 'triangle' && division === 'triangular') {
        const m = Math.max(1, Math.round(Math.sqrt(n)));
        n = m * m;
      }
      if (partsInp) partsInp.value = String(n);
      if (partsVal) partsVal.textContent = String(n);
      figState.parts = n;
      figState.shape = shape;
      figState.division = division;
      figState.allowWrong = allowWrong;
      fillPalette = getFillPalette();
      linePalette = getLinePalette();
      const lineIndex = sanitizeFillIndex(getFigureFillIndex(id), linePalette.length);
      activeLineColor = linePalette[lineIndex - 1] || linePalette[0] || '#000';
      const colorFor = idx => {
        const c = filled.get(idx);
        return c ? fillPalette[c - 1] || '#fff' : '#fff';
      };
      if (shape === 'circle') drawCircle(n, division, allowWrong, colorFor);else if (shape === 'square') drawRect(n, division, colorFor);else drawTriangle(n, division, allowWrong, colorFor);
      scheduleClipUpdate(shape, division);
    }
    function drawCircle(n, division, allowWrong, colorFor) {
      const r = CIRCLE_RADIUS;
      const cx = 0.5,
        cy = 0.5;
      const pointOpts = {
        visible: false,
        fixed: true,
        name: '',
        label: {
          visible: false
        }
      };
      if (allowWrong && (division === 'vertical' || division === 'horizontal' || division === 'grid')) {
        let rows = 1,
          cols = n;
        if (division === 'horizontal') {
          rows = n;
          cols = 1;
        } else if (division === 'grid') {
          const d = gridDims(n);
          rows = d.rows;
          cols = d.cols;
        }
        for (let rIdx = 0; rIdx < rows; rIdx++) {
          for (let cIdx = 0; cIdx < cols; cIdx++) {
            const idx = rIdx * cols + cIdx;
            const x1 = cIdx / cols,
              x2 = (cIdx + 1) / cols;
            const y1 = rIdx / rows,
              y2 = (rIdx + 1) / rows;
            const poly = board.create('polygon', [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], {
              borders: {
                strokeColor: 'none',
                strokeWidth: 0
              },
              vertices: {
                visible: false,
                name: '',
                fixed: true,
                label: {
                  visible: false
                }
              },
              fillColor: colorFor(idx),
              fillOpacity: 1,
              highlight: false,
              hasInnerPoints: true,
              fixed: true,
              cssStyle: 'pointer-events:fill;'
            });
            registerFillNodes(poly);
            attachToggleHandler(poly, idx);
            markPolygonBorders(poly);
          }
        }
        for (let i = 1; i < cols; i++) {
          const x = i / cols;
          createDivisionSegment([x, 0], [x, 1]);
        }
        for (let j = 1; j < rows; j++) {
          const y = j / rows;
          createDivisionSegment([0, y], [1, y]);
        }
        if (showOutlineGlobal) {
          board.create('circle', [[cx, cy], r], {
            strokeColor: activeLineColor,
            strokeWidth: OUTLINE_STROKE_WIDTH,
            fillColor: 'none',
            highlight: false,
            fixed: true,
            hasInnerPoints: false,
            cssStyle: 'pointer-events:none;'
          });
        }
      } else {
        const center = board.create('point', [cx, cy], pointOpts);
        const boundaryPts = [];
        for (let i = 0; i < n; i++) {
          const a1 = 2 * Math.PI * i / n;
          const a2 = 2 * Math.PI * (i + 1) / n;
          const p1 = board.create('point', [cx + r * Math.cos(a1), cy + r * Math.sin(a1)], pointOpts);
          const p2 = board.create('point', [cx + r * Math.cos(a2), cy + r * Math.sin(a2)], pointOpts);
          boundaryPts.push(p1);
          const sector = board.create('sector', [center, p1, p2], {
            withLines: true,
            strokeColor: 'none',
            strokeWidth: 0,
            fillColor: colorFor(i),
            fillOpacity: 1,
            highlight: false,
            hasInnerPoints: true,
            fixed: true,
            cssStyle: 'pointer-events:fill;'
          });
          registerFillNodes(sector);
          attachToggleHandler(sector, i);
        }
        for (const p of boundaryPts) {
          createDivisionSegment(center, p, {}, false);
        }
        if (showOutlineGlobal) {
          board.create('circle', [center, r], {
            strokeColor: activeLineColor,
            strokeWidth: OUTLINE_STROKE_WIDTH,
            fillColor: 'none',
            highlight: false,
            fixed: true,
            hasInnerPoints: false,
            cssStyle: 'pointer-events:none;'
          });
        }
      }
    }
    function drawRect(n, division, colorFor) {
      const width = rectWidthScale;
      clearRoundedRectFrame();
      if (division === 'diagonal') {
        const c = [width / 2, 0.5];
        const corners = [[0, 0], [width, 0], [width, 1], [0, 1]];
        const diagonalStrokeWidth = 2;
        const diagonalInsetPx = 2;
        const insetCorner = corner => {
          if (!board || typeof JXG === 'undefined' || !JXG.Coords) return corner.slice();
          const cornerScreen = new JXG.Coords(JXG.COORDS_BY_USER, corner, board).scrCoords;
          const centerScreen = new JXG.Coords(JXG.COORDS_BY_USER, c, board).scrCoords;
          const dx = centerScreen[1] - cornerScreen[1];
          const dy = centerScreen[2] - cornerScreen[2];
          const length = Math.hypot(dx, dy);
          if (!(length > 0)) return corner.slice();
          const insetScreen = [cornerScreen[1] + dx / length * diagonalInsetPx, cornerScreen[2] + dy / length * diagonalInsetPx];
          const insetUser = new JXG.Coords(JXG.COORDS_BY_SCREEN, insetScreen, board).usrCoords;
          return [insetUser[1], insetUser[2]];
        };
        for (let i = 0; i < 4; i++) {
          const pts = [corners[i], corners[(i + 1) % 4], c];
          const poly = board.create('polygon', pts, {
            borders: {
              strokeColor: 'none',
              strokeWidth: 0
            },
            vertices: {
              visible: false,
              name: '',
              fixed: true,
              label: {
                visible: false
              }
            },
            fillColor: colorFor(i),
            fillOpacity: 1,
            highlight: false,
            hasInnerPoints: true,
            fixed: true,
            cssStyle: 'pointer-events:fill;'
          });
          registerFillNodes(poly);
          attachToggleHandler(poly, i);
          markPolygonBorders(poly);
          createDivisionSegment(c, insetCorner(corners[i]), {
            linecap: 'butt',
            strokeWidth: diagonalStrokeWidth
          }, false);
        }
      } else if (division === 'grid') {
        const {
          rows,
          cols
        } = gridDims(n);
        for (let rIdx = 0; rIdx < rows; rIdx++) {
          for (let cIdx = 0; cIdx < cols; cIdx++) {
            const idx = rIdx * cols + cIdx;
            const x1 = cIdx / cols * width,
              x2 = (cIdx + 1) / cols * width;
            const y1 = rIdx / rows,
              y2 = (rIdx + 1) / rows;
            const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
            const poly = board.create('polygon', pts, {
              borders: {
                strokeColor: 'none',
                strokeWidth: 0
              },
              vertices: {
                visible: false,
                name: '',
                fixed: true,
                label: {
                  visible: false
                }
              },
              fillColor: colorFor(idx),
              fillOpacity: 1,
              highlight: false,
              hasInnerPoints: true,
              fixed: true,
              cssStyle: 'pointer-events:fill;'
            });
            registerFillNodes(poly);
            attachToggleHandler(poly, idx);
            markPolygonBorders(poly);
          }
        }
        for (let i = 1; i < cols; i++) {
          const x = i / cols * width;
          createDivisionSegment([x, 0], [x, 1], {
            linecap: 'butt'
          }, false);
        }
        for (let j = 1; j < rows; j++) {
          const y = j / rows;
          createDivisionSegment([0, y], [width, y], {
            linecap: 'butt'
          }, false);
        }
      } else {
        for (let i = 0; i < n; i++) {
          let pts;
          if (division === 'vertical') {
            const x1 = i / n * width,
              x2 = (i + 1) / n * width;
            pts = [[x1, 0], [x2, 0], [x2, 1], [x1, 1]];
          } else {
            // horizontal
            const y1 = i / n,
              y2 = (i + 1) / n;
            pts = [[0, y1], [width, y1], [width, y2], [0, y2]];
          }
        const poly = board.create('polygon', pts, {
            borders: {
              strokeColor: 'none',
              strokeWidth: 0
            },
          vertices: {
            visible: false,
            name: '',
            fixed: true,
            label: {
              visible: false
            }
          },
          fillColor: colorFor(i),
          fillOpacity: 1,
          highlight: false,
          hasInnerPoints: true,
          fixed: true,
          cssStyle: 'pointer-events:fill;'
        });
          registerFillNodes(poly);
          attachToggleHandler(poly, i);
          markPolygonBorders(poly);
        }
        for (let i = 1; i < n; i++) {
          if (division === 'vertical') {
            const x = i / n * width;
            createDivisionSegment([x, 0], [x, 1], {
              linecap: 'butt'
            }, false);
          } else {
            const y = i / n;
            createDivisionSegment([0, y], [width, y], {
              linecap: 'butt'
            }, false);
          }
        }
      }
      updateRoundedRectFrame();
    }
    function drawTriangle(n, division, allowWrong, colorFor) {
      const h = Math.sqrt(3) / 2;
      const toEq = ([x, y]) => [x + 0.5 * y, y * h];
      const toEqTri = ([x, y]) => [x, (1 - y) * h];
      const triangleDivisionOptions = {
        linecap: 'butt'
      };
      if (showOutlineGlobal) {
        const framePoints = division === 'triangular' ? [toEqTri([0, 1]), toEqTri([1, 1]), toEqTri([0.5, 0])] : [toEq([0, 0]), toEq([1, 0]), toEq([0, 1])];
        board.create('polygon', framePoints, {
          borders: {
            strokeColor: 'none',
            strokeWidth: 0
          },
          vertices: {
            visible: false,
            name: '',
            fixed: true,
            label: {
              visible: false
            }
          },
          fillColor: 'none',
          fillOpacity: 0,
          highlight: false,
          fixed: true,
          hasInnerPoints: false,
          cssStyle: 'pointer-events:none;',
          layer: 1
        });
      }
      if (division === 'triangular') {
        const m = Math.round(Math.sqrt(n));
        const rows = [];
        for (let r = 0; r <= m; r++) {
          const y = r / m;
          const xStart = 0.5 - r / (2 * m);
          const row = [];
          for (let c = 0; c <= r; c++) {
            row.push(toEqTri([xStart + c / m, y]));
          }
          rows.push(row);
        }
        let idx = 0;
        for (let r = 1; r <= m; r++) {
          for (let c = 0; c < r; c++) {
            const pts = [rows[r][c], rows[r][c + 1], rows[r - 1][c]];
            const poly = board.create('polygon', pts, {
            borders: {
              strokeColor: 'none',
              strokeWidth: 0
            },
              vertices: {
                visible: false,
                name: '',
                fixed: true,
                label: {
                  visible: false
                }
              },
              fillColor: colorFor(idx),
              fillOpacity: 1,
              highlight: false,
              hasInnerPoints: true,
              fixed: true,
              cssStyle: 'pointer-events:fill;'
            });
            registerFillNodes(poly);
            attachToggleHandler(poly, idx);
            markPolygonBorders(poly);
            idx++;
          }
        }
        for (let r = 0; r < m; r++) {
          for (let c = 0; c < rows[r].length - 1; c++) {
            const pts = [rows[r][c], rows[r][c + 1], rows[r + 1][c + 1]];
            const poly = board.create('polygon', pts, {
              borders: {
                strokeColor: 'none',
                strokeWidth: 0
              },
              vertices: {
                visible: false,
                name: '',
                fixed: true,
                label: {
                  visible: false
                }
              },
              fillColor: colorFor(idx),
              fillOpacity: 1,
              highlight: false,
              hasInnerPoints: true,
              fixed: true,
              cssStyle: 'pointer-events:fill;'
            });
            registerFillNodes(poly);
            attachToggleHandler(poly, idx);
            markPolygonBorders(poly);
            idx++;
          }
        }
        for (let r = 1; r < m; r++) {
          createDivisionSegment(rows[r][0], rows[r][r], triangleDivisionOptions, false);
          createDivisionSegment(rows[r][0], rows[m][r], triangleDivisionOptions, false);
          createDivisionSegment(rows[r][r], rows[m][m - r], triangleDivisionOptions, false);
        }
        if (showOutlineGlobal) {
          board.create('polygon', [toEqTri([0, 1]), toEqTri([1, 1]), toEqTri([0.5, 0])], {
            borders: {
              strokeColor: activeLineColor,
              strokeWidth: OUTLINE_STROKE_WIDTH,
              linecap: 'round',
              linejoin: 'round'
            },
            vertices: {
              visible: false,
              name: '',
              fixed: true,
              label: {
                visible: false
              }
            },
            fillColor: 'none',
            highlight: false,
            fixed: true,
            hasInnerPoints: false,
            cssStyle: 'pointer-events:none;'
          });
        }
        return;
      }
      for (let i = 0; i < n; i++) {
        let pts;
        if (division === 'vertical') {
          const x1 = i / n,
            x2 = (i + 1) / n;
          if (allowWrong) {
            pts = [[x1, 0], [x2, 0], [x2, 1 - x2], [x1, 1 - x1]];
          } else {
            pts = [[x1, 0], [x2, 0], [0, 1]];
          }
        } else if (division === 'horizontal') {
          const y1 = i / n,
            y2 = (i + 1) / n;
          if (allowWrong) {
            pts = [[0, y1], [1 - y1, y1], [1 - y2, y2], [0, y2]];
          } else {
            pts = [[0, y1], [0, y2], [1, 0]];
          }
        } else {
          // diagonal
          const t1 = i / n,
            t2 = (i + 1) / n;
          pts = [[1 - t1, t1], [1 - t2, t2], [0, 0]];
        }
        pts = pts.map(toEq);
        const poly = board.create('polygon', pts, {
          borders: {
            strokeColor: 'none',
            strokeWidth: 0
          },
          vertices: {
            visible: false,
            name: '',
            fixed: true,
            label: {
              visible: false
            }
          },
          fillColor: colorFor(i),
          fillOpacity: 1,
          highlight: false,
          hasInnerPoints: true,
          fixed: true,
          cssStyle: 'pointer-events:fill;'
        });
        registerFillNodes(poly);
        attachToggleHandler(poly, i);
        markPolygonBorders(poly);
      }
      if (division === 'vertical') {
        for (let i = 1; i < n; i++) {
          const x = i / n;
          if (allowWrong) {
            createDivisionSegment(toEq([x, 0]), toEq([x, 1 - x]), triangleDivisionOptions, false);
          } else {
            createDivisionSegment(toEq([x, 0]), toEq([0, 1]), triangleDivisionOptions, false);
          }
        }
      } else if (division === 'horizontal') {
        for (let i = 1; i < n; i++) {
          const y = i / n;
          if (allowWrong) {
            createDivisionSegment(toEq([0, y]), toEq([1 - y, y]), triangleDivisionOptions, false);
          } else {
            createDivisionSegment(toEq([0, y]), toEq([1, 0]), triangleDivisionOptions, false);
          }
        }
      } else {
        // diagonal
        for (let i = 1; i < n; i++) {
          const t = i / n;
          createDivisionSegment(toEq([1 - t, t]), toEq([0, 0]), triangleDivisionOptions, false);
        }
      }
      if (showOutlineGlobal) {
        board.create('polygon', [toEq([0, 0]), toEq([1, 0]), toEq([0, 1])], {
        borders: {
          strokeColor: activeLineColor,
          strokeWidth: OUTLINE_STROKE_WIDTH,
          linecap: 'round',
          linejoin: 'round'
        },
          vertices: {
            visible: false,
            name: '',
            fixed: true,
            label: {
              visible: false
            }
          },
          fillColor: 'none',
          highlight: false,
          fixed: true,
          hasInnerPoints: false,
          cssStyle: 'pointer-events:none;'
        });
      }
    }
    function applyClip(shape, division) {
      var _board;
      const svg = (_board = board) === null || _board === void 0 || (_board = _board.renderer) === null || _board === void 0 ? void 0 : _board.svgRoot;
      if (!svg) return;
      const fillGroup = ensureFillGroup();
      const rootGroup = svg.querySelector('g.JXGroot') || svg;
      const clipTargets = shape === 'circle' || shape === 'triangle' ? [rootGroup] : [fillGroup || rootGroup];
      const pad = CLIP_PAD_PERCENT;
      const padStr = pad.toFixed(2);
      const maxStr = (100 + pad).toFixed(2);
      const clipId = `brokClip${id}`;
      let clipUpdater = null;
      if (shape === 'triangle') {
        var _svg$viewBox3, _svg$viewBox4;
        const viewBoxSize = Math.max(((_svg$viewBox3 = svg.viewBox) === null || _svg$viewBox3 === void 0 || (_svg$viewBox3 = _svg$viewBox3.baseVal) === null || _svg$viewBox3 === void 0 ? void 0 : _svg$viewBox3.width) || 0, ((_svg$viewBox4 = svg.viewBox) === null || _svg$viewBox4 === void 0 || (_svg$viewBox4 = _svg$viewBox4.baseVal) === null || _svg$viewBox4 === void 0 ? void 0 : _svg$viewBox4.height) || 0);
        const size = viewBoxSize || EXPORT_FIGURE_SIZE;
        const strokePaddingPercent = OUTLINE_STROKE_WIDTH / (2 * size) * 100;
        clipUpdater = clipPath => {
          clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');
          while (clipPath.firstChild) clipPath.removeChild(clipPath.firstChild);
          const polygon = document.createElementNS(SVG_NS, 'polygon');
          const pad = (CLIP_PAD_PERCENT + strokePaddingPercent) / 100;
          const topY = (-pad).toFixed(4);
          const leftX = (-pad).toFixed(4);
          const rightX = (1 + pad).toFixed(4);
          const bottomY = (1 + pad).toFixed(4);
          polygon.setAttribute(
            'points',
            `${(0.5).toFixed(4)} ${topY} ${leftX} ${bottomY} ${rightX} ${bottomY}`
          );
          clipPath.appendChild(polygon);
        };
      } else if (shape === 'square') {
        clipUpdater = clipPath => {
          clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');
          while (clipPath.firstChild) clipPath.removeChild(clipPath.firstChild);
          const rect = document.createElementNS(SVG_NS, 'rect');
          const pad = CLIP_PAD_PERCENT / 100;
          rect.setAttribute('x', (-pad).toFixed(4));
          rect.setAttribute('y', (-pad).toFixed(4));
          rect.setAttribute('width', (1 + pad * 2).toFixed(4));
          rect.setAttribute('height', (1 + pad * 2).toFixed(4));
          rect.setAttribute('rx', RECT_CORNER_RADIUS_RATIO.toFixed(4));
          rect.setAttribute('ry', RECT_CORNER_RADIUS_RATIO.toFixed(4));
          clipPath.appendChild(rect);
        };
      } else if (shape === 'circle') {
        var _svg$viewBox, _svg$viewBox2, _svg$viewBox3, _svg$viewBox4;
        const viewBoxWidth = ((_svg$viewBox = svg.viewBox) === null || _svg$viewBox === void 0 || (_svg$viewBox = _svg$viewBox.baseVal) === null || _svg$viewBox === void 0 ? void 0 : _svg$viewBox.width) || 0;
        const viewBoxHeight = ((_svg$viewBox2 = svg.viewBox) === null || _svg$viewBox2 === void 0 || (_svg$viewBox2 = _svg$viewBox2.baseVal) === null || _svg$viewBox2 === void 0 ? void 0 : _svg$viewBox2.height) || 0;
        const viewBoxX = ((_svg$viewBox3 = svg.viewBox) === null || _svg$viewBox3 === void 0 || (_svg$viewBox3 = _svg$viewBox3.baseVal) === null || _svg$viewBox3 === void 0 ? void 0 : _svg$viewBox3.x) || 0;
        const viewBoxY = ((_svg$viewBox4 = svg.viewBox) === null || _svg$viewBox4 === void 0 || (_svg$viewBox4 = _svg$viewBox4.baseVal) === null || _svg$viewBox4 === void 0 ? void 0 : _svg$viewBox4.y) || 0;
        const viewBoxSize = Math.min(viewBoxWidth || 0, viewBoxHeight || 0) || EXPORT_FIGURE_SIZE;
        const strokePadding = OUTLINE_STROKE_WIDTH / 2;
        const circleCx = viewBoxX + (viewBoxWidth || viewBoxSize) * 0.5;
        const circleCy = viewBoxY + (viewBoxHeight || viewBoxSize) * 0.5;
        const circleRadius = CIRCLE_RADIUS * viewBoxSize + strokePadding;
        clipUpdater = clipPath => {
          clipPath.setAttribute('clipPathUnits', 'userSpaceOnUse');
          while (clipPath.firstChild) clipPath.removeChild(clipPath.firstChild);
          const circle = document.createElementNS(SVG_NS, 'circle');
          circle.setAttribute('cx', circleCx.toFixed(4));
          circle.setAttribute('cy', circleCy.toFixed(4));
          circle.setAttribute('r', circleRadius.toFixed(4));
          clipPath.appendChild(circle);
        };
      }
      const defsLookup = () => {
        let defs = svg.querySelector('defs');
        if (!defs && clipUpdater) {
          defs = document.createElementNS(SVG_NS, 'defs');
          svg.insertBefore(defs, svg.firstChild);
        }
        return defs;
      };
      if (clipUpdater) {
        const defs = defsLookup();
        if (!defs) return;
        let clipPath = defs.querySelector(`#${clipId}`);
        if (!clipPath) {
          clipPath = document.createElementNS(SVG_NS, 'clipPath');
          clipPath.setAttribute('id', clipId);
          defs.appendChild(clipPath);
        }
        clipUpdater(clipPath);
        for (const target of clipTargets) {
          if (!target) continue;
          target.setAttribute('clip-path', `url(#${clipId})`);
        }
        svg.removeAttribute('clip-path');
      } else {
        for (const target of clipTargets) {
          if (!target) continue;
          target.removeAttribute('clip-path');
        }
        svg.removeAttribute('clip-path');
        const defs = defsLookup();
        const clipPath = defs === null || defs === void 0 ? void 0 : defs.querySelector(`#${clipId}`);
        if (clipPath) clipPath.remove();
      }
    }
    allowDenominatorInp === null || allowDenominatorInp === void 0 || registerListener(allowDenominatorInp, 'change', () => {
      const enabled = !!allowDenominatorInp.checked;
      updateDenominatorControls(enabled);
      window.render();
      clearCheckStatus();
    });
    shapeSel === null || shapeSel === void 0 || registerListener(shapeSel, 'change', () => {
      const figState = ensureFigureState(id);
      const nextShape = shapeSel.value;
      const shapeChanged = figState.shape !== nextShape;
      figState.shape = nextShape;
      if (shapeChanged) {
        setFilled(new Map());
        window.render();
        clearCheckStatus();
      }
    });
    partsInp === null || partsInp === void 0 || registerListener(partsInp, 'input', () => {
      const figState = ensureFigureState(id);
      figState.parts = clampInt(partsInp.value, 1);
      window.render();
      clearCheckStatus();
    });
    divSel === null || divSel === void 0 || registerListener(divSel, 'change', () => {
      const figState = ensureFigureState(id);
      figState.division = divSel.value;
      window.render();
      clearCheckStatus();
    });
    minusBtn === null || minusBtn === void 0 || registerListener(minusBtn, 'click', () => {
      let n = parseInt(partsInp.value, 10);
      n = isNaN(n) ? 1 : Math.max(1, n - 1);
      partsInp.value = String(n);
      partsInp.dispatchEvent(new Event('input'));
    });
    plusBtn === null || plusBtn === void 0 || registerListener(plusBtn, 'click', () => {
      let n = parseInt(partsInp.value, 10);
      n = isNaN(n) ? 1 : n + 1;
      partsInp.value = String(n);
      partsInp.dispatchEvent(new Event('input'));
    });
    function getFilled() {
      return new Map(filled);
    }
    function setFilled(next) {
      const normalized = normalizeFilledEntries(next);
      filled = new Map(normalized);
      syncFilledState(normalized, true);
    }
    if (shouldResetFilled) {
      setFilled(new Map());
    }
    function getSvgElement() {
      var _board2;
      return (_board2 = board) === null || _board2 === void 0 || (_board2 = _board2.renderer) === null || _board2 === void 0 ? void 0 : _board2.svgRoot;
    }
    updateDenominatorControls();
    return {
      draw,
      resize: resizeBoard,
      panel,
      getSvgElement,
      getFilled,
      setFilled,
      setLayoutMetrics,
      updateDenominatorControls,
      destroy: () => {
        var _board3;
        if (pendingClipFrame != null) {
          cancelAnimationFrame(pendingClipFrame);
          pendingClipFrame = null;
        }
        pendingClipState = null;
        if (suppressToggleResetTimer != null) {
          clearTimeout(suppressToggleResetTimer);
          suppressToggleResetTimer = null;
        }
        if (detachDivisionGuard) {
          detachDivisionGuard();
          detachDivisionGuard = null;
        }
        if (eventAbortController) {
          eventAbortController.abort();
        } else {
          teardownTasks.forEach(task => task());
        }
        teardownTasks.length = 0;
        divisionSegmentIds.clear();
        divisionSegmentNodes.clear();
        (_board3 = board) === null || _board3 === void 0 || (_board3 = _board3.stopResizeObserver) === null || _board3 === void 0 ? void 0 : _board3.call(board);
        if (board) {
          JXG.JSXGraph.freeBoard(board);
          board = null;
        }
        const panelNode = panel || document.getElementById(`panel${id}`);
        const box = panelNode && panelNode.querySelector ? panelNode.querySelector('.box') : null;
        if (boxResizeObserver && box) {
          boxResizeObserver.unobserve(box);
        }
        if (box) {
          box.innerHTML = '';
        }
      }
    };
  }
  function computeFigureFraction(figState) {
    const state = figState && typeof figState === 'object' ? figState : {};
    const partsValue = Number(state.parts);
    const denominator = Number.isFinite(partsValue) ? Math.max(0, Math.round(partsValue)) : 0;
    const entries = Array.isArray(state.filled) ? state.filled : [];
    const seen = new Set();
    entries.forEach(entry => {
      if (!entry) return;
      const partIndex = Array.isArray(entry) ? entry[0] : entry.partIndex;
      const colorIndex = Array.isArray(entry) ? entry[1] : entry.colorIndex;
      const part = Number(partIndex);
      const color = Number(colorIndex);
      if (!Number.isFinite(part) || part < 0) return;
      if (!Number.isFinite(color) || color <= 0) return;
      seen.add(Math.trunc(part));
    });
    return {
      numerator: seen.size,
      denominator
    };
  }
  function runTaskCheck() {
    const ids = getActiveFigureIds();
    const targets = [];
    ids.forEach(id => {
      const figState = ensureFigureState(id);
      const solution = figState.solution && typeof figState.solution === 'object' ? figState.solution : null;
      if (!solution || solution.numerator == null || solution.denominator == null) return;
      const panel = document.getElementById(`panel${id}`);
      if (panel && panel.style.display === 'none') return;
      targets.push({ id, figState, solution });
    });
    if (targets.length === 0) {
      setCheckStatus('info', 'Ingen fasit er definert ennå.');
      return;
    }
    const details = [];
    targets.forEach(({ id, figState, solution }) => {
      const { numerator, denominator } = computeFigureFraction(figState);
      const label = targets.length > 1 ? `Figur ${id}` : 'Figuren';
      if (!Number.isFinite(denominator) || denominator <= 0) {
        details.push(`${label}: Fant ingen deler å sammenligne med fasit.`);
        return;
      }
      if (solution.denominator != null && solution.denominator !== denominator) {
        details.push(`${label}: Nevner skal være ${solution.denominator}, men er ${denominator}.`);
      }
      if (solution.numerator != null && solution.numerator !== numerator) {
        details.push(`${label}: Teller skal være ${solution.numerator}, men er ${numerator}.`);
      }
    });
    if (details.length === 0) {
      const heading = targets.length === 1 ? 'Brøken er riktig!' : 'Alle brøker er riktige!';
      setCheckStatus('success', heading);
    } else {
      setCheckStatus('error', 'Ikke helt riktig ennå.', details);
    }
  }
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  function getExportCanvasMetrics() {
    const exportRows = Math.max(1, rows || 1);
    const exportCols = Math.max(1, cols || 1);
    const figureSize = EXPORT_FIGURE_SIZE;
    const gap = EXPORT_GAP;
    const margin = EXPORT_MARGIN;
    const width = exportCols * figureSize + Math.max(0, exportCols - 1) * gap + margin * 2;
    const height = exportRows * figureSize + Math.max(0, exportRows - 1) * gap + margin * 2;
    return {
      rows: exportRows,
      cols: exportCols,
      figureSize,
      gap,
      margin,
      width,
      height
    };
  }
  function getSvgContentBounds(svgEl) {
    if (!svgEl) return null;
    const outlinePad = Number.isFinite(OUTLINE_STROKE_WIDTH) ? OUTLINE_STROKE_WIDTH / 2 : 0;
    const applyPadding = bounds => {
      if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return bounds;
      if (!Number.isFinite(outlinePad) || outlinePad <= 0) return bounds;
      return {
        x: bounds.x - outlinePad,
        y: bounds.y - outlinePad,
        width: bounds.width + outlinePad * 2,
        height: bounds.height + outlinePad * 2
      };
    };
    if (typeof svgEl.getBBox === 'function') {
      try {
        const bbox = svgEl.getBBox();
        if (bbox && Number.isFinite(bbox.width) && bbox.width > 0 && Number.isFinite(bbox.height) && bbox.height > 0) {
          return applyPadding({
            x: Number.isFinite(bbox.x) ? bbox.x : 0,
            y: Number.isFinite(bbox.y) ? bbox.y : 0,
            width: bbox.width,
            height: bbox.height
          });
        }
      } catch (error) {
        // fall back to attributes
      }
    }
    if (typeof svgEl.getAttribute === 'function') {
      const viewBox = svgEl.getAttribute('viewBox');
      if (viewBox) {
        const parts = viewBox
          .trim()
          .split(/[\s,]+/)
          .map(val => Number.parseFloat(val))
          .filter(Number.isFinite);
        if (parts.length >= 4) {
          const [minX, minY, width, height] = parts;
          if (width > 0 && height > 0) {
            return applyPadding({
              x: minX,
              y: minY,
              width,
              height
            });
          }
        }
      }
      const widthAttr = Number.parseFloat(svgEl.getAttribute('width'));
      const heightAttr = Number.parseFloat(svgEl.getAttribute('height'));
      if (Number.isFinite(widthAttr) && Number.isFinite(heightAttr) && widthAttr > 0 && heightAttr > 0) {
        return applyPadding({
          x: 0,
          y: 0,
          width: widthAttr,
          height: heightAttr
        });
      }
    }
    return null;
  }
  function scaleExportBounds(bounds, targetSize) {
    if (!bounds || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return null;
    const maxSide = Math.max(bounds.width, bounds.height, 1);
    const scale = targetSize / maxSide;
    return {
      width: bounds.width * scale,
      height: bounds.height * scale,
      scale
    };
  }
  function buildCompositeExportSvg() {
    if (typeof document === 'undefined') return null;
    const grid = gridEl || boardEl;
    if (!grid) return null;
    const ids = getActiveFigureIds();
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const exportMetrics = getExportCanvasMetrics();
    const items = [];
    ids.forEach((id, index) => {
      const fig = figures[id];
      if (!fig || typeof fig.getSvgElement !== 'function') return;
      const svg = fig.getSvgElement();
      if (!svg) return;
      const bounds = getSvgContentBounds(svg);
      const scaled = scaleExportBounds(bounds, exportMetrics.figureSize);
      const width = scaled && Number.isFinite(scaled.width) ? Math.round(scaled.width) : exportMetrics.figureSize;
      const height = scaled && Number.isFinite(scaled.height) ? Math.round(scaled.height) : exportMetrics.figureSize;
      const row = Math.floor(index / exportMetrics.cols);
      const col = index % exportMetrics.cols;
      const x = exportMetrics.margin + col * (exportMetrics.figureSize + exportMetrics.gap) + Math.max(0, (exportMetrics.figureSize - width) / 2);
      const y = exportMetrics.margin + row * (exportMetrics.figureSize + exportMetrics.gap) + Math.max(0, (exportMetrics.figureSize - height) / 2);
      items.push({
        id,
        svg,
        x,
        y,
        width,
        height,
        bounds
      });
    });
    if (!items.length) return null;
    const width = Math.max(1, Math.round(exportMetrics.width));
    const height = Math.max(1, Math.round(exportMetrics.height));
    const exportSvg = document.createElementNS(SVG_NS, 'svg');
    exportSvg.setAttribute('width', String(width));
    exportSvg.setAttribute('height', String(height));
    exportSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    exportSvg.setAttribute('xmlns', SVG_NS);
    exportSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    items.forEach(item => {
      const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(item.svg) : item.svg.cloneNode(true);
      if (!clone) return;
      prefixSvgIds(clone, `brokfigurer-fig${item.id}`);
      if (item.bounds) {
        clone.setAttribute('viewBox', `${item.bounds.x} ${item.bounds.y} ${item.bounds.width} ${item.bounds.height}`);
        clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      }
      clone.setAttribute('x', String(item.x));
      clone.setAttribute('y', String(item.y));
      clone.setAttribute('width', String(item.width));
      clone.setAttribute('height', String(item.height));
      exportSvg.appendChild(clone);
    });
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    items.forEach(item => {
      if (!Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isFinite(item.width) || !Number.isFinite(item.height)) {
        return;
      }
      minX = Math.min(minX, item.x);
      minY = Math.min(minY, item.y);
      maxX = Math.max(maxX, item.x + item.width);
      maxY = Math.max(maxY, item.y + item.height);
    });
    if (Number.isFinite(minX) && Number.isFinite(minY) && Number.isFinite(maxX) && Number.isFinite(maxY) && maxX > minX && maxY > minY) {
      const cropWidth = Math.round(maxX - minX);
      const cropHeight = Math.round(maxY - minY);
      exportSvg.setAttribute('viewBox', `${minX} ${minY} ${cropWidth} ${cropHeight}`);
      exportSvg.setAttribute('width', String(cropWidth));
      exportSvg.setAttribute('height', String(cropHeight));
    }
    return {
      svg: exportSvg,
      htmlTarget: grid,
      width: exportSvg.width.baseVal.value || width,
      height: exportSvg.height.baseVal.value || height
    };
  }
  function prefixSvgIds(svgElement, prefix) {
    if (!svgElement || typeof svgElement.querySelectorAll !== 'function') return;
    const sanitizedPrefix = typeof prefix === 'string' && prefix.trim() ? prefix.trim() : 'brokfigurer';
    const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const idMap = new Map();
    svgElement.querySelectorAll('[id]').forEach(node => {
      const id = node.getAttribute('id');
      if (!id) return;
      const nextId = `${sanitizedPrefix}-${id}`;
      idMap.set(id, nextId);
      node.setAttribute('id', nextId);
    });
    if (!idMap.size) return;
    const replaceUrlReferences = (value, oldId, nextId) => {
      const escapedId = escapeRegExp(oldId);
      let nextValue = value;
      nextValue = nextValue.replace(new RegExp(`url\\((['"]?)#${escapedId}\\1\\)`, 'g'), (match, quote) => `url(${quote}#${nextId}${quote})`);
      nextValue = nextValue.replace(new RegExp(`url\\((['"]?)(https?:\\/\\/[^)'"]*?)#${escapedId}\\1\\)`, 'g'), (match, quote, base) => `url(${quote}${base}#${nextId}${quote})`);
      return nextValue;
    };
    const updateAttribute = (node, attr) => {
      if (!node || typeof node.getAttribute !== 'function' || typeof node.setAttribute !== 'function') return;
      const value = node.getAttribute(attr);
      if (!value) return;
      let nextValue = value;
      idMap.forEach((nextId, oldId) => {
        nextValue = replaceUrlReferences(nextValue, oldId, nextId);
        if (value === `#${oldId}`) {
          nextValue = `#${nextId}`;
        }
      });
      if (nextValue !== value) {
        node.setAttribute(attr, nextValue);
      }
    };
    const attributes = ['clip-path', 'mask', 'filter', 'fill', 'stroke', 'marker-start', 'marker-mid', 'marker-end', 'href', 'xlink:href'];
    svgElement.querySelectorAll('*').forEach(node => {
      attributes.forEach(attr => updateAttribute(node, attr));
      const style = node.getAttribute && node.getAttribute('style');
      if (!style) return;
      let nextStyle = style;
      idMap.forEach((nextId, oldId) => {
        nextStyle = replaceUrlReferences(nextStyle, oldId, nextId);
      });
      if (nextStyle !== style) {
        node.setAttribute('style', nextStyle);
      }
    });
  }
  async function downloadAllFigures() {
    var _window$render, _window;
    (_window$render = (_window = window).render) === null || _window$render === void 0 || _window$render.call(_window);
    const composite = buildCompositeExportSvg();
    if (!composite) return;
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const meta = buildBrokfigurerExportMeta();
    const svgString = svgToString(composite.svg);
    const isRenderableTarget = element => {
      if (!element || !element.isConnected) return false;
      const rect = element.getBoundingClientRect();
      if (!rect || rect.width <= 1 || rect.height <= 1) return false;
      if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return true;
      const style = window.getComputedStyle(element);
      if (!style) return true;
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const opacity = Number.parseFloat(style.opacity);
      if (Number.isFinite(opacity) && opacity <= 0) return false;
      return true;
    };
    const htmlTarget = isRenderableTarget(composite.htmlTarget) ? composite.htmlTarget : null;
    if (helper && typeof helper.exportGraphicWithArchive === 'function') {
      try {
        await helper.exportGraphicWithArchive({
          svgElement: composite.svg,
          htmlTarget: htmlTarget || null,
          suggestedName: `${meta.defaultBaseName || 'brokfigurer'}.svg`,
          toolId: 'brokfigurer',
          svgString,
          description: meta.description,
          slug: meta.slug,
          defaultBaseName: meta.defaultBaseName,
          summary: meta.summary,
          backgroundColor: '#fff',
          pngFallbackOrder: 'html-first'
        });
        return;
      } catch (error) {
        console.error('Kunne ikke eksportere figurer samlet', error);
      }
    }
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      await helper.exportSvgWithArchive(composite.svg, `${meta.defaultBaseName || 'brokfigurer'}.svg`, 'brokfigurer', {
        svgString,
        description: meta.description,
        slug: meta.slug,
        defaultBaseName: meta.defaultBaseName,
        summary: meta.summary
      });
      return;
    }
    await downloadSVG(composite.svg, `${meta.defaultBaseName || 'brokfigurer'}.svg`);
    await downloadPNG(composite.svg, `${meta.defaultBaseName || 'brokfigurer'}.png`, 2);
  }
  async function downloadAllFiguresPng() {
    var _window$render2, _window2;
    (_window$render2 = (_window2 = window).render) === null || _window$render2 === void 0 || _window$render2.call(_window2);
    const composite = buildCompositeExportSvg();
    if (!composite) return;
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const meta = buildBrokfigurerExportMeta();
    const svgString = svgToString(composite.svg);
    const isRenderableTarget = element => {
      if (!element || !element.isConnected) return false;
      const rect = element.getBoundingClientRect();
      if (!rect || rect.width <= 1 || rect.height <= 1) return false;
      if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') return true;
      const style = window.getComputedStyle(element);
      if (!style) return true;
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const opacity = Number.parseFloat(style.opacity);
      if (Number.isFinite(opacity) && opacity <= 0) return false;
      return true;
    };
    const htmlTarget = isRenderableTarget(composite.htmlTarget) ? composite.htmlTarget : null;
    if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
      try {
        await helper.exportGraphicWithArchiveWithFallback({
          svgElement: composite.svg,
          htmlTarget,
          suggestedName: `${meta.defaultBaseName || 'brokfigurer'}.svg`,
          toolId: 'brokfigurer',
          svgString,
          description: meta.description,
          slug: meta.slug,
          defaultBaseName: meta.defaultBaseName,
          summary: meta.summary,
          backgroundColor: '#fff',
          pngFallbackOrder: 'html-first',
          downloadSvg: false,
          downloadMetadata: false,
          downloadPng: true
        });
        return;
      } catch (error) {
        console.error('Kunne ikke eksportere PNG', error);
      }
    }
    await downloadPNG(composite.svg, `${meta.defaultBaseName || 'brokfigurer'}.png`, 2);
  }
  exportSvgBtn === null || exportSvgBtn === void 0 || exportSvgBtn.addEventListener('click', () => {
    void downloadAllFiguresPng();
  });
  exportPngBtn === null || exportPngBtn === void 0 || exportPngBtn.addEventListener('click', () => {
    void downloadAllFigures();
  });
  addRowBtn === null || addRowBtn === void 0 || addRowBtn.addEventListener('click', () => {
    if (rows >= MAX_ROWS) return;
    rows++;
    STATE.rows = rows;
    rebuildLayout();
    window.render();
    clearCheckStatus();
  });
  removeRowBtn === null || removeRowBtn === void 0 || removeRowBtn.addEventListener('click', () => {
    if (rows <= MIN_DIMENSION) return;
    rows--;
    STATE.rows = rows;
    rebuildLayout();
    window.render();
    clearCheckStatus();
  });
  addColumnBtn === null || addColumnBtn === void 0 || addColumnBtn.addEventListener('click', () => {
    if (cols >= MAX_COLS) return;
    cols++;
    STATE.cols = cols;
    rebuildLayout();
    window.render();
    clearCheckStatus();
  });
  removeColumnBtn === null || removeColumnBtn === void 0 || removeColumnBtn.addEventListener('click', () => {
    if (cols <= MIN_DIMENSION) return;
    cols--;
    STATE.cols = cols;
    rebuildLayout();
    window.render();
    clearCheckStatus();
  });
  rebuildLayout();
  initAltTextManager();
  const handleExamplesCollect = event => {
    var _window$render3, _window3;
    const detail = event === null || event === void 0 ? void 0 : event.detail;
    if (!detail || detail.svgOverride != null) return;
    (_window$render3 = (_window3 = window).render) === null || _window$render3 === void 0 ? void 0 : _window$render3.call(_window3);
    const serializer = typeof serializeDocument === 'function'
      ? serializeDocument
      : typeof window !== 'undefined' && typeof window.serializeDocument === 'function'
        ? window.serializeDocument
        : null;
    const svgString = serializer ? serializer() : null;
    if (typeof svgString === 'string' && svgString.trim()) {
      detail.svgOverride = svgString;
    }
  };
  const handleExamplesLoaded = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        scheduleFigureSizeUpdate();
        scheduleFigureBoardResize();
      }, 0);
    });
  };
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('examples:collect', handleExamplesCollect);
    window.addEventListener('examples:loaded', handleExamplesLoaded);
  }
  function normalizeCleanStatePayload(payload) {
    if (payload == null) return null;
    if (typeof payload === 'string') {
      try {
        return normalizeCleanStatePayload(JSON.parse(payload));
      } catch (_) {
        return null;
      }
    }
    if (payload && typeof payload === 'object' && payload.v === 1) {
      return payload;
    }
    if (payload && typeof payload === 'object' && payload.state && payload.state.v === 1) {
      return payload.state;
    }
    return null;
  }
  function createCleanState() {
    const figures = getActiveFigureIds().map(id => {
      const figState = ensureFigureState(id);
      const solution = figState.solution && typeof figState.solution === 'object' ? figState.solution : {};
      const rawNum = Number.parseInt(solution.numerator, 10);
      const rawDen = Number.parseInt(solution.denominator, 10);
      const normalizedShape = normalizeShape(figState.shape);
      return {
        shape: VALID_SHAPES.has(normalizedShape) ? normalizedShape : 'square',
        division: VALID_DIVISIONS.has(figState.division) ? figState.division : 'horizontal',
        parts: clampInt(figState.parts, 1),
        allowDenominatorChange: !!figState.allowDenominatorChange,
        fillColorIndex: sanitizeFillIndex(figState.fillColorIndex, FILL_COLOR_COUNT),
        filled: sanitizeFilledEntries(figState.filled),
        solution: {
          numerator: Number.isFinite(rawNum) && rawNum >= 0 ? rawNum : null,
          denominator: Number.isFinite(rawDen) && rawDen > 0 ? rawDen : null
        }
      };
    });
    return {
      v: 1,
      settings: {
        rows,
        cols,
        allowWrong: !!STATE.allowWrong,
        showDivisionLines: !!STATE.showDivisionLines,
        showOutline: !!STATE.showOutline
      },
      palette: {
        colorCount,
        colors: getColors().slice(0, colorCount)
      },
      figures
    };
  }
  function loadCleanState(rawState) {
    if (!rawState || typeof rawState !== 'object' || rawState.v !== 1) return false;
    const settings = rawState.settings && typeof rawState.settings === 'object' ? rawState.settings : {};
    rows = clampInt(settings.rows != null ? settings.rows : rows, MIN_DIMENSION, MAX_ROWS);
    cols = clampInt(settings.cols != null ? settings.cols : cols, MIN_DIMENSION, MAX_COLS);
    allowWrongGlobal = !!settings.allowWrong;
    showDivisionLinesGlobal = settings.showDivisionLines === false ? false : true;
    showOutlineGlobal = settings.showOutline === false ? false : true;
    STATE.rows = rows;
    STATE.cols = cols;
    STATE.allowWrong = allowWrongGlobal;
    STATE.showDivisionLines = showDivisionLinesGlobal;
    STATE.showOutline = showOutlineGlobal;
    colorCount = clampInt(PALETTE_SLOT_COUNT, 1, maxColors);
    STATE.colorCount = colorCount;
    STATE.colors = [];
    ensureColorDefaults(colorCount);
    rebuildLayout();
    const figureEntries = Array.isArray(rawState.figures) ? rawState.figures : [];
    const total = rows * cols;
    pruneFigureState(total);
    for (let idx = 0; idx < total; idx++) {
      const entry = figureEntries[idx] && typeof figureEntries[idx] === 'object' ? figureEntries[idx] : {};
      const id = idx + 1;
      const figState = ensureFigureState(id);
      const normalizedShape = normalizeShape(entry.shape);
      if (VALID_SHAPES.has(normalizedShape)) figState.shape = normalizedShape;
      if (VALID_DIVISIONS.has(entry.division)) figState.division = entry.division;
      const parsedParts = Number.parseInt(entry.parts, 10);
      figState.parts = clampInt(Number.isFinite(parsedParts) && parsedParts > 0 ? parsedParts : figState.parts, 1);
      figState.allowDenominatorChange = entry.allowDenominatorChange === true;
      figState.fillColorIndex = sanitizeFillIndex(entry.fillColorIndex, FILL_COLOR_COUNT);
      figState.filled = sanitizeFilledEntries(entry.filled);
      const rawSolution = entry.solution && typeof entry.solution === 'object' ? entry.solution : {};
      const solNum = Number.parseInt(rawSolution.numerator, 10);
      const solDen = Number.parseInt(rawSolution.denominator, 10);
      figState.solution = {
        numerator: Number.isFinite(solNum) && solNum >= 0 ? solNum : null,
        denominator: Number.isFinite(solDen) && solDen > 0 ? solDen : null
      };
      figState.allowWrong = allowWrongGlobal;
      STATE.figures[id] = figState;
    }
    applyStateToControls();
    updateColorVisibility();
    window.render();
    scheduleFigureBoardResize();
    refreshAltText('state-load');
    return true;
  }
  function serializeCleanState(payload) {
    const normalized = normalizeCleanStatePayload(payload);
    if (!normalized) return false;
    return loadCleanState(normalized);
  }
  let isReadOnlyPreview = false;
  function setReadOnlyPreview(enabled) {
    isReadOnlyPreview = !!enabled;
  }
  function setEditMode() {
    setReadOnlyPreview(false);
  }
  function handleThemePaletteChanged() {
    applyThemeToDocument();
    refreshPaletteDefaults();
    if (typeof window.render === 'function') window.render();
  }

  function handleThemeProfileMessage(event) {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    handleThemePaletteChanged();
  }

  function handleThemeProfileChangeEvent(event) {
    if (!event || event.type !== 'math-visuals:profile-change') return;
    handleThemePaletteChanged();
  }

  function handleThemeSettingsChanged(event) {
    if (!event || event.type !== 'math-visuals:settings-changed') return;
    handleThemePaletteChanged();
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', handleThemeProfileMessage);
    window.addEventListener('math-visuals:profile-change', handleThemeProfileChangeEvent);
    window.addEventListener('math-visuals:settings-changed', handleThemeSettingsChanged);
  }
  if (typeof window !== 'undefined') {
    const api = {
      cleanJSON: createCleanState,
      normalize: normalizeCleanStatePayload,
      serialize: serializeCleanState,
      setReadOnlyPreview,
      setEditMode
    };
    window.brøkfigurerApi = api;
    if (!window.brokfigurerApi) window.brokfigurerApi = api;
    const mv = window.mathVisuals && typeof window.mathVisuals === 'object' ? window.mathVisuals : {};
    mv.activeTool = api;
    window.mathVisuals = mv;
  }
  window.render();
})();
