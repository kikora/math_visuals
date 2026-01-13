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

function isValidColor(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

(function (_colorCountInp$value) {
  function svgToString(svgEl) {
    if (!svgEl) return '';
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
    if (!clone) return '';
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
  function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
    var _svgEl$viewBox;
    return new Promise(resolve => {
      const vb = (_svgEl$viewBox = svgEl.viewBox) === null || _svgEl$viewBox === void 0 ? void 0 : _svgEl$viewBox.baseVal;
      const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || 420;
      const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || 420;
      const data = svgToString(svgEl);
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
        const ctx = canvas.getContext('2d');
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
  const OUTLINE_STROKE_WIDTH = 6;
  const DIVISION_SEGMENT_EXTENSION = 0;
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
  const FRACTION_GROUP_ID = 'fractions';
  function getThemeApi() {
    const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
    return theme && typeof theme === 'object' ? theme : null;
  }

  function getPaletteProjectResolver() {
    const scopes = [
      typeof window !== 'undefined' ? window : null,
      typeof globalThis !== 'undefined' ? globalThis : null,
      typeof global !== 'undefined' ? global : null
    ];
    for (const scope of scopes) {
      if (!scope || typeof scope !== 'object') continue;
      const resolver = scope.MathVisualsPaletteProjectResolver;
      if (resolver && typeof resolver.resolvePaletteProject === 'function') {
        return resolver;
      }
    }
    if (typeof require === 'function') {
      try {
        const mod = require('./palette/resolve-palette-project.js');
        if (mod && typeof mod.resolvePaletteProject === 'function') {
          return mod;
        }
      } catch (_) {}
    }
    return null;
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

  function getProjectFallbackPaletteBase(projectName, basePalette) {
    const config = getPaletteConfig();
    const sanitizedBase = sanitizePalette(basePalette);
    if (!config || !config.PROJECT_FALLBACKS) {
      return sanitizedBase;
    }
    const normalized = typeof projectName === 'string' ? projectName.trim().toLowerCase() : '';
    const fallbacks = config.PROJECT_FALLBACKS;
    const palette = (normalized && fallbacks[normalized]) || fallbacks.default || sanitizedBase;
    const sanitized = sanitizePalette(palette);
    return sanitized.length ? sanitized : sanitizedBase;
  }

  function getGroupSlotIndices(config, groupId) {
    if (!config) return [];
    const normalizedGroupId = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    if (!normalizedGroupId) return [];
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

  function getProjectGroupFallbackPalette(projectName, groupId, basePalette) {
    const baseCandidate = getProjectFallbackPaletteBase(projectName, basePalette);
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

  function getSettingsApi() {
    if (typeof window === 'undefined') return null;
    const api = window.MathVisualsSettings;
    return api && typeof api === 'object' ? api : null;
  }
  function getActiveThemeProjectName(theme = getThemeApi()) {
    if (!theme || typeof theme.getActiveProfileName !== 'function') return null;
    try {
      const value = theme.getActiveProfileName();
      if (typeof value === 'string' && value.trim()) {
        return value.trim().toLowerCase();
      }
    } catch (_) {}
    return null;
  }

  function resolvePaletteProjectName() {
    const resolver = getPaletteProjectResolver();
    const doc = typeof document !== 'undefined' ? document : null;
    const theme = getThemeApi();
    const settings = getSettingsApi();
    if (resolver && typeof resolver.resolvePaletteProject === 'function') {
      try {
        const resolved = resolver.resolvePaletteProject({
          document: doc || undefined,
          root: doc && doc.documentElement ? doc.documentElement : undefined,
          theme: theme || undefined,
          settings: settings || undefined,
          location: typeof window !== 'undefined' ? window.location : undefined
        });
        if (typeof resolved === 'string' && resolved) {
          return resolved;
        }
      } catch (_) {}
    }
    if (doc && doc.documentElement) {
      const root = doc.documentElement;
      const direct =
        (typeof root.getAttribute === 'function' && root.getAttribute('data-project')) ||
        (root.dataset && root.dataset.project);
      if (typeof direct === 'string' && direct.trim()) {
        return direct.trim().toLowerCase();
      }
      const activeAttr = root.getAttribute && root.getAttribute('data-mv-active-project');
      if (typeof activeAttr === 'string' && activeAttr.trim()) {
        return activeAttr.trim().toLowerCase();
      }
      const profileAttr = root.getAttribute && root.getAttribute('data-theme-profile');
      if (typeof profileAttr === 'string' && profileAttr.trim()) {
        return profileAttr.trim().toLowerCase();
      }
    }
    const activeThemeProject = getActiveThemeProjectName(theme);
    if (activeThemeProject) return activeThemeProject;
    if (settings && typeof settings.getActiveProject === 'function') {
      try {
        const value = settings.getActiveProject();
        if (typeof value === 'string' && value.trim()) {
          return value.trim().toLowerCase();
        }
      } catch (_) {}
    }
    if (settings && typeof settings.activeProject === 'string' && settings.activeProject.trim()) {
      return settings.activeProject.trim().toLowerCase();
    }
    return null;
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
  const taskCheckHost = typeof document !== 'undefined' ? document.querySelector('[data-task-check-host]') : null;
  const taskCheckControls = [checkButton, checkStatus].filter(Boolean);
  function ensureTaskCheckControlsAppended() {
    if (!taskCheckHost) return;
    taskCheckControls.forEach(control => {
      if (control && control.parentElement !== taskCheckHost) {
        taskCheckHost.appendChild(control);
      }
    });
  }

  function isTaskLikeMode(mode) {
    const normalized = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
    return (
      normalized === 'task' ||
      normalized === 'preview' ||
      normalized === 'forhandsvisning' ||
      normalized === 'forhåndsvisning'
    );
  }
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
  function applyAppModeToTaskControls(mode) {
    if (!taskCheckHost) return;
    const isTaskMode = isTaskLikeMode(mode);
    if (isTaskMode) {
      ensureTaskCheckControlsAppended();
      taskCheckHost.hidden = false;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control === checkButton) {
          control.hidden = false;
          if (control.dataset) delete control.dataset.prevHidden;
          return;
        }
        if (control.dataset && 'prevHidden' in control.dataset) {
          const wasHidden = control.dataset.prevHidden === '1';
          delete control.dataset.prevHidden;
          control.hidden = wasHidden;
        }
      });
    } else {
      taskCheckHost.hidden = true;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control.dataset) {
          control.dataset.prevHidden = control.hidden ? '1' : '0';
        }
        control.hidden = true;
      });
    }
  }

  function syncBodyAppMode(mode) {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body || !body.dataset) return;
    const normalized = isTaskLikeMode(mode) ? 'task' : typeof mode === 'string' && mode.trim() ? mode.trim() : 'default';
    if (body.dataset.appMode !== normalized) {
      body.dataset.appMode = normalized;
    }
  }
  function getCurrentAppMode() {
    if (typeof window === 'undefined') return 'default';
    const mv = window.mathVisuals;
    if (mv && typeof mv.getAppMode === 'function') {
      try {
        const mode = mv.getAppMode();
        if (typeof mode === 'string' && mode) {
          return mode;
        }
      } catch (_) {}
    }
    try {
      const params = new URLSearchParams(window.location && window.location.search ? window.location.search : '');
      const fromQuery = params.get('mode');
      if (typeof fromQuery === 'string' && fromQuery.trim()) {
        return isTaskLikeMode(fromQuery) ? 'task' : 'default';
      }
    } catch (_) {}
    return 'default';
  }
  function handleAppModeChanged(event) {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail.mode !== 'string') return;
    syncBodyAppMode(detail.mode);
    applyAppModeToTaskControls(detail.mode);
  }
  function evaluateDescriptionInputs() {
    if (typeof window === 'undefined') return;
    const mv = window.mathVisuals;
    if (!mv || typeof mv.evaluateTaskInputs !== 'function') return;
    try {
      mv.evaluateTaskInputs();
    } catch (_) {}
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:app-mode-changed', handleAppModeChanged);
  }
  const initialAppMode = getCurrentAppMode() || 'task';
  syncBodyAppMode(initialAppMode);
  applyAppModeToTaskControls(initialAppMode);
  if (checkButton) {
    checkButton.addEventListener('click', () => {
      evaluateDescriptionInputs();
      runTaskCheck();
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
    const project = resolvePaletteProjectName();
    const legacyFallback = sanitizePalette(LEGACY_COLOR_PALETTE);
    const projectFallback = getProjectGroupFallbackPalette(project, FRACTION_GROUP_ID, LEGACY_COLOR_PALETTE);
    const fallback = projectFallback.length ? projectFallback : legacyFallback;
    const target = Number.isFinite(count) && count > 0 ? Math.trunc(count) : fallback.length || legacyFallback.length;

    if (paletteApi) {
      const palette = tryResolvePalette(() =>
        paletteApi.getGroupPalette(FRACTION_GROUP_ID, {
          project: project || undefined,
          count: target || undefined
        })
      );
      if (palette && palette.length) {
        return ensurePaletteSize(palette, fallback, target);
      }
    }

    if (settings && typeof settings.getGroupPalette === 'function') {
      let palette = tryResolvePalette(() =>
        settings.getGroupPalette(FRACTION_GROUP_ID, {
          project: project || undefined,
          count: target || undefined
        })
      );
      if ((!palette || palette.length < target) && settings.getGroupPalette.length >= 3) {
        palette = tryResolvePalette(() =>
          settings.getGroupPalette(
            FRACTION_GROUP_ID,
            target || undefined,
            project ? { project } : undefined
          )
        );
      }
      if (palette && palette.length) {
        return ensurePaletteSize(palette, fallback, target);
      }
    }

    const servicePalette = tryResolvePalette(() =>
      paletteService.resolveGroupPalette({
        groupId: FRACTION_GROUP_ID,
        count: target || undefined,
        project: project || undefined,
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
        theme.getGroupPalette(FRACTION_GROUP_ID, {
          project: project || undefined,
          count: target || undefined
        })
      );
      if ((!palette || palette.length < target) && theme.getGroupPalette.length >= 3) {
        palette = tryResolvePalette(() =>
          theme.getGroupPalette(
            FRACTION_GROUP_ID,
            target || undefined,
            project ? { project } : undefined
          )
        );
      }
      if (palette && palette.length) {
        return ensurePaletteSize(palette, fallback, target);
      }
    }

    if (theme && typeof theme.getPalette === 'function') {
      const palette = tryResolvePalette(() =>
        theme.getPalette('fractions', target || fallback.length, {
          fallbackKinds: ['figures'],
          project: project || undefined
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
  const VALID_SHAPES = new Set(['circle', 'rectangle', 'square', 'triangle']);
  const VALID_DIVISIONS = new Set(['horizontal', 'vertical', 'grid', 'diagonal', 'triangular']);
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
  const modifiedColorIndexes = new Set();
  if (typeof STATE.altText !== 'string') STATE.altText = '';
  if (STATE.altTextSource !== 'manual') STATE.altTextSource = 'auto';
  if (Array.isArray(STATE.colors)) {
    STATE.colors.forEach((color, idx) => {
      if (typeof color === 'string' && color) modifiedColorIndexes.add(idx);
    });
  }
  let autoPaletteEnabled = modifiedColorIndexes.size === 0;
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
  const maxColors = colorInputs.length || 1;
  const defaultColorCount = clampInt((_colorCountInp$value = colorCountInp === null || colorCountInp === void 0 ? void 0 : colorCountInp.value) !== null && _colorCountInp$value !== void 0 ? _colorCountInp$value : 1, 1, maxColors);
  const stateColorCount = STATE.colorCount != null ? clampInt(STATE.colorCount, 1, maxColors) : null;
  let colorCount = stateColorCount || defaultColorCount;
  STATE.colorCount = colorCount;
  const MAX_ROWS = 3;
  const MAX_COLS = 3;
  const MIN_DIMENSION = 1;
  const figurePanels = new Map();
  const figureFieldsets = new Map();
  let activeFigureIds = [];
  let rows = clampInt(STATE.rows != null ? STATE.rows : 1, MIN_DIMENSION, MAX_ROWS);
  let cols = clampInt(STATE.cols != null ? STATE.cols : 1, MIN_DIMENSION, MAX_COLS);
  STATE.rows = rows;
  STATE.cols = cols;
  const FIGURE_MIN_SIZE = 160;
  const FIGURE_MAX_SIZE = 720;
  let pendingFigureSizeFrame = null;
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
    const size = Math.max(FIGURE_MIN_SIZE, Math.min(FIGURE_MAX_SIZE, baseSize));
    gridEl.style.setProperty('--figure-size', `${size}px`);
  }
  function scheduleFigureSizeUpdate() {
    if (pendingFigureSizeFrame != null) return;
    pendingFigureSizeFrame = requestAnimationFrame(() => {
      pendingFigureSizeFrame = null;
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
    if (autoPaletteEnabled) {
      STATE.colors = palette.slice(0, required);
    }
    for (let i = 0; i < required; i++) {
      const defaultColor = palette[i] || getDefaultColorForIndex(i);
      const hasColor = typeof STATE.colors[i] === 'string' && STATE.colors[i];
      const shouldUseDefault = autoPaletteEnabled || !modifiedColorIndexes.has(i);
      if (shouldUseDefault || !hasColor) {
        STATE.colors[i] = defaultColor;
      }
      if (typeof STATE.colors[i] !== 'string' || !STATE.colors[i]) {
        STATE.colors[i] = defaultColor || LEGACY_COLOR_PALETTE[i % LEGACY_COLOR_PALETTE.length];
      }
    }
    if (STATE.colors.length > required) STATE.colors.length = required;
  }

  function refreshPaletteDefaults() {
    autoPaletteEnabled = modifiedColorIndexes.size === 0;
    ensureColorDefaults(colorCount);
    colorInputs.forEach((inp, idx) => {
      if (!inp) return;
      if (autoPaletteEnabled || !modifiedColorIndexes.has(idx)) {
        const color = STATE.colors[idx];
        if (typeof color === 'string' && color) {
          inp.value = color;
        }
      }
    });
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
    modifiedColorIndexes.add(idx);
    autoPaletteEnabled = modifiedColorIndexes.size === 0;
    ensureColorDefaults(Math.max(idx + 1, colorCount));
    if (!Array.isArray(STATE.colors)) STATE.colors = [];
    STATE.colors[idx] = inp.value;
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
    STATE.colorCount = colorCount;
    if (colorCountInp) colorCountInp.value = String(colorCount);
    ensureColorDefaults(colorCount);
    colorInputs.forEach((inp, idx) => {
      const color = STATE.colors[idx];
      if (typeof color === 'string') inp.value = color;
    });
    for (const id of getActiveFigureIds()) {
      const figState = ensureFigureState(id);
      figState.allowWrong = allowWrongGlobal;
      if (typeof figState.allowDenominatorChange !== 'boolean') {
        figState.allowDenominatorChange = false;
      }
      const allowDenominator = !!figState.allowDenominatorChange;
      const allowDenominatorInp = document.getElementById(`allowDenominator${id}`);
      if (allowDenominatorInp) allowDenominatorInp.checked = allowDenominator;
      const shapeSel = document.getElementById(`shape${id}`);
      if (shapeSel && figState.shape) {
        const options = Array.from(shapeSel.options || []);
        if (options.some(opt => opt.value === figState.shape)) shapeSel.value = figState.shape;else figState.shape = shapeSel.value;
      }
      const partsInp = document.getElementById(`parts${id}`);
      const partsVal = document.getElementById(`partsVal${id}`);
      const figureController = figures[id];
      if (figureController && typeof figureController.updateDenominatorControls === 'function') {
        figureController.updateDenominatorControls(allowDenominator);
      } else {
        if (partsInp) partsInp.disabled = !allowDenominator;
        const stepper = document.getElementById(`partsStepper${id}`);
        if (stepper) stepper.style.display = allowDenominator ? '' : 'none';
        const minusBtn = document.getElementById(`partsMinus${id}`);
        if (minusBtn) minusBtn.disabled = !allowDenominator;
        const plusBtn = document.getElementById(`partsPlus${id}`);
        if (plusBtn) plusBtn.disabled = !allowDenominator;
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
      const solution = figState.solution && typeof figState.solution === 'object' ? figState.solution : {};
      const solutionNumInp = document.getElementById(`solutionNumerator${id}`);
      if (solutionNumInp) {
        solutionNumInp.value = solution.numerator != null ? String(solution.numerator) : '';
      }
      const solutionDenInp = document.getElementById(`solutionDenominator${id}`);
      if (solutionDenInp) {
        solutionDenInp.value = solution.denominator != null ? String(solution.denominator) : '';
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
    for (const id of getActiveFigureIds()) {
      const fig = figures[id];
      if (fig && typeof fig.draw === 'function') fig.draw();
    }
    scheduleFigureSizeUpdate();
    refreshAltText('render');
  }
  function createFigurePanel(id) {
    const panel = document.createElement('div');
    panel.className = 'figurePanel';
    panel.id = `panel${id}`;
    panel.dataset.figureId = String(id);
    panel.innerHTML = `
      <div class="figure"><div id="box${id}" class="box"></div></div>
      <div class="stepper" id="partsStepper${id}" aria-label="Antall deler">
        <button id="partsMinus${id}" type="button" aria-label="Færre deler">−</button>
        <span id="partsVal${id}">4</span>
        <button id="partsPlus${id}" type="button" aria-label="Flere deler">+</button>
      </div>
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
            <option value="rectangle" selected>rektangel</option>
            <option value="square">kvadrat</option>
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
        <div class="field">
          <label for="solutionDenominator${id}">Fasit nevner</label>
          <input id="solutionDenominator${id}" class="input--digit" type="number" min="1" step="1" />
        </div>
        <div class="field">
          <label for="solutionNumerator${id}">Fasit teller</label>
          <input id="solutionNumerator${id}" class="input--digit" type="number" min="0" step="1" />
        </div>
      </div>
      <div class="checkbox-row">
        <input id="allowDenominator${id}" type="checkbox" />
        <label for="allowDenominator${id}">Endre nevner</label>
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
  function rebuildLayout() {
    const total = Math.max(MIN_DIMENSION, Math.min(rows * cols, MAX_ROWS * MAX_COLS));
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
    switch (shape) {
      case 'circle':
        return { article: 'en', noun: 'sirkel' };
      case 'rectangle':
        return { article: 'et', noun: 'rektangel' };
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
    const paletteLength = getColors().length;
    figureIds.forEach((id, index) => {
      const figState = ensureFigureState(id);
      const shape = typeof (figState == null ? void 0 : figState.shape) === 'string' ? figState.shape : 'rectangle';
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
    const shapeSel = document.getElementById(`shape${id}`);
    const partsInp = document.getElementById(`parts${id}`);
    const divSel = document.getElementById(`division${id}`);
    const minusBtn = document.getElementById(`partsMinus${id}`);
    const plusBtn = document.getElementById(`partsPlus${id}`);
    const partsVal = document.getElementById(`partsVal${id}`);
    const allowDenominatorInp = document.getElementById(`allowDenominator${id}`);
    const stepperEl = document.getElementById(`partsStepper${id}`);
    const panel = document.getElementById(`panel${id}`);
    const solutionNumInp = document.getElementById(`solutionNumerator${id}`);
    const solutionDenInp = document.getElementById(`solutionDenominator${id}`);
    let board;
    const divisionSegmentIds = new Set();
    const divisionSegmentNodes = new Set();
    let filled = new Map();
    let suppressToggle = false;
    let suppressToggleResetTimer = null;
    let detachDivisionGuard = null;
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
        partsInp.disabled = !enabled;
      }
      if (minusBtn) minusBtn.disabled = !enabled;
      if (plusBtn) plusBtn.disabled = !enabled;
      if (stepperEl) {
        stepperEl.style.display = enabled ? '' : 'none';
        if (enabled) {
          stepperEl.removeAttribute('aria-hidden');
        } else {
          stepperEl.setAttribute('aria-hidden', 'true');
        }
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
    function syncSolutionFromInputs() {
      const figState = ensureFigureState(id);
      let solution = figState.solution && typeof figState.solution === 'object' ? figState.solution : null;
      if (!solution) {
        solution = { numerator: null, denominator: null };
        figState.solution = solution;
      }
      if (solutionNumInp) {
        const num = parseInt(solutionNumInp.value, 10);
        solution.numerator = Number.isFinite(num) ? num : null;
      }
      if (solutionDenInp) {
        const den = parseInt(solutionDenInp.value, 10);
        solution.denominator = Number.isFinite(den) && den > 0 ? den : null;
      }
    }
    function initBoard() {
      if (board) {
        var _board$stopResizeObse;
        (_board$stopResizeObse = board.stopResizeObserver) === null || _board$stopResizeObse === void 0 ? void 0 : _board$stopResizeObse.call(board);
        JXG.JSXGraph.freeBoard(board);
      }
      board = JXG.JSXGraph.initBoard(`box${id}`, {
        boundingbox: BOARD_BOUNDING_BOX,
        axis: false,
        showCopyright: false,
        showNavigation: false,
        keepaspectratio: true
      });
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
      const fillAttr = typeof node.getAttribute === 'function' ? node.getAttribute('fill') : null;
      const fillOpacityAttr = typeof node.getAttribute === 'function' ? node.getAttribute('fill-opacity') : null;
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
      const isFilled = hasColor && hasVisibleOpacity;
      if (isFilled) {
        return;
      }
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
          node.setAttribute('stroke-linecap', 'round');
          node.setAttribute('stroke-linejoin', 'round');
          markDivisionNode(node);
        }
      }
    }
    function createDivisionSegment(start, end, options = {}, extend = true) {
      if (!showDivisionLinesGlobal) return null;
      const [p1, p2] = extend ? extendSegmentEndpoints(start, end) : [clonePoint(start), clonePoint(end)];
      const seg = board.create('segment', [p1, p2], Object.assign({
        strokeColor: '#000',
        strokeWidth: 2,
        dash: 2,
        highlight: false,
        highlightStrokeColor: '#000',
        highlightStrokeOpacity: 1,
        highlightStrokeWidth: 2,
        fixed: true,
        linecap: 'butt',
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
    const DOM_TOGGLE_EVENTS = typeof window !== 'undefined' && 'PointerEvent' in window ? ['pointerdown'] : ['mousedown', 'touchstart'];
    function attachToggleHandler(element, partIndex) {
      if (!element) return;
      const handler = evt => togglePart(partIndex, element, evt);
      const domHandler = evt => {
        handler(evt);
      };
      const nodes = [];
      if (element.rendNode) nodes.push(element.rendNode);
      if (element.rendNodeFront && element.rendNodeFront !== element.rendNode) nodes.push(element.rendNodeFront);
      for (const node of nodes) {
        if (!node) continue;
        if (node.style) {
          if (!node.style.pointerEvents || node.style.pointerEvents === 'none') {
            node.style.pointerEvents = 'auto';
          }
          if (!node.style.cursor || node.style.cursor === 'default') {
            node.style.cursor = 'pointer';
          }
        }
        for (const type of DOM_TOGGLE_EVENTS) {
          node.addEventListener(type, domHandler, true);
        }
      }
    }
    function togglePart(i, element, evt) {
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
      const colors = getColors();
      const current = filled.get(i) || 0;
      const next = (current + 1) % (colors.length + 1);
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
    function draw() {
      var _ref, _partsInp$value;
      if (!panel || !panel.isConnected || panel.style.display === 'none') return;
      const figState = ensureFigureState(id);
      updateDenominatorControls(figState.allowDenominatorChange, figState);
      setFilled(figState.filled);
      initBoard();
      divisionSegmentIds.clear();
      divisionSegmentNodes.clear();
      ensureDivisionGuard();
      let n = clampInt((_ref = (_partsInp$value = partsInp === null || partsInp === void 0 ? void 0 : partsInp.value) !== null && _partsInp$value !== void 0 ? _partsInp$value : figState.parts) !== null && _ref !== void 0 ? _ref : 1, 1);
      const shape = (shapeSel === null || shapeSel === void 0 ? void 0 : shapeSel.value) || figState.shape || 'rectangle';
      let division = (divSel === null || divSel === void 0 ? void 0 : divSel.value) || figState.division || 'horizontal';
      const allowWrong = allowWrongGlobal;
      if ((shape === 'rectangle' || shape === 'square') && division === 'diagonal') n = 4;
      const gridOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="grid"]');
      const vertOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="vertical"]');
      const triOpt = divSel === null || divSel === void 0 ? void 0 : divSel.querySelector('option[value="triangular"]');
      if (gridOpt) {
        gridOpt.hidden = !hasProperFactor(n) || shape === 'circle' && !allowWrong || shape === 'triangle';
        if (gridOpt.hidden && division === 'grid') divSel.value = 'horizontal';
      }
      if (vertOpt) {
        vertOpt.hidden = shape === 'circle' && !allowWrong;
        if (vertOpt.hidden && division === 'vertical') divSel.value = 'horizontal';
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
      figState.shape = (shapeSel === null || shapeSel === void 0 ? void 0 : shapeSel.value) || shape;
      figState.division = division;
      figState.allowWrong = allowWrong;
      const colors = getColors();
      const colorFor = idx => {
        const c = filled.get(idx);
        return c ? colors[c - 1] || '#fff' : '#fff';
      };
      if (shape === 'circle') drawCircle(n, division, allowWrong, colorFor);else if (shape === 'rectangle' || shape === 'square') drawRect(n, division, colorFor);else drawTriangle(n, division, allowWrong, colorFor);
      applyClip(shape, division);
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
                strokeColor: '#fff',
                strokeWidth: 6
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
            strokeColor: '#333',
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
            strokeColor: '#fff',
            strokeWidth: 6,
            fillColor: colorFor(i),
            fillOpacity: 1,
            highlight: false,
            hasInnerPoints: true,
            fixed: true,
            cssStyle: 'pointer-events:fill;'
          });
          attachToggleHandler(sector, i);
        }
        for (const p of boundaryPts) {
          createDivisionSegment(center, p, {
            strokeColor: '#000'
          }, false);
        }
        if (showOutlineGlobal) {
          board.create('circle', [center, r], {
            strokeColor: '#333',
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
      if (division === 'diagonal') {
        const c = [0.5, 0.5];
        const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
        for (let i = 0; i < 4; i++) {
          const pts = [corners[i], corners[(i + 1) % 4], c];
          const poly = board.create('polygon', pts, {
            borders: {
              strokeColor: '#fff',
              strokeWidth: 6
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
          attachToggleHandler(poly, i);
          markPolygonBorders(poly);
          createDivisionSegment(c, corners[i], {
            strokeColor: '#000'
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
            const x1 = cIdx / cols,
              x2 = (cIdx + 1) / cols;
            const y1 = rIdx / rows,
              y2 = (rIdx + 1) / rows;
            const pts = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
            const poly = board.create('polygon', pts, {
              borders: {
                strokeColor: '#fff',
                strokeWidth: 6
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
      } else {
        for (let i = 0; i < n; i++) {
          let pts;
          if (division === 'vertical') {
            const x1 = i / n,
              x2 = (i + 1) / n;
            pts = [[x1, 0], [x2, 0], [x2, 1], [x1, 1]];
          } else {
            // horizontal
            const y1 = i / n,
              y2 = (i + 1) / n;
            pts = [[0, y1], [1, y1], [1, y2], [0, y2]];
          }
        const poly = board.create('polygon', pts, {
          borders: {
            strokeColor: '#fff',
            strokeWidth: 6
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
          attachToggleHandler(poly, i);
          markPolygonBorders(poly);
        }
        for (let i = 1; i < n; i++) {
          if (division === 'vertical') {
            const x = i / n;
            createDivisionSegment([x, 0], [x, 1]);
          } else {
            const y = i / n;
            createDivisionSegment([0, y], [1, y]);
          }
        }
      }
      if (showOutlineGlobal) {
        board.create('polygon', [[0, 0], [1, 0], [1, 1], [0, 1]], {
          borders: {
            strokeColor: '#333',
            strokeWidth: 6
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
    function drawTriangle(n, division, allowWrong, colorFor) {
      const h = Math.sqrt(3) / 2;
      const toEq = ([x, y]) => [x + 0.5 * y, y * h];
      const toEqTri = ([x, y]) => [x, (1 - y) * h];
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
                strokeColor: '#fff',
                strokeWidth: 6
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
                strokeColor: '#fff',
                strokeWidth: 6
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
            attachToggleHandler(poly, idx);
            markPolygonBorders(poly);
            idx++;
          }
        }
        for (let r = 1; r < m; r++) {
          createDivisionSegment(rows[r][0], rows[r][r], {}, false);
          createDivisionSegment(rows[r][0], rows[m][r], {}, false);
          createDivisionSegment(rows[r][r], rows[m][m - r], {}, false);
        }
        if (showOutlineGlobal) {
          board.create('polygon', [toEqTri([0, 1]), toEqTri([1, 1]), toEqTri([0.5, 0])], {
            borders: {
              strokeColor: '#333',
              strokeWidth: 6
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
            strokeColor: '#fff',
            strokeWidth: 6
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
        attachToggleHandler(poly, i);
        markPolygonBorders(poly);
      }
      if (division === 'vertical') {
        for (let i = 1; i < n; i++) {
          const x = i / n;
          if (allowWrong) {
            createDivisionSegment(toEq([x, 0]), toEq([x, 1 - x]), {}, false);
          } else {
            createDivisionSegment(toEq([x, 0]), toEq([0, 1]), {}, false);
          }
        }
      } else if (division === 'horizontal') {
        for (let i = 1; i < n; i++) {
          const y = i / n;
          if (allowWrong) {
            createDivisionSegment(toEq([0, y]), toEq([1 - y, y]), {}, false);
          } else {
            createDivisionSegment(toEq([0, y]), toEq([1, 0]), {}, false);
          }
        }
      } else {
        // diagonal
        for (let i = 1; i < n; i++) {
          const t = i / n;
          createDivisionSegment(toEq([1 - t, t]), toEq([0, 0]), {}, false);
        }
      }
      if (showOutlineGlobal) {
        board.create('polygon', [toEq([0, 0]), toEq([1, 0]), toEq([0, 1])], {
          borders: {
            strokeColor: '#333',
            strokeWidth: 6
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
      const pad = CLIP_PAD_PERCENT;
      const padStr = pad.toFixed(2);
      const maxStr = (100 + pad).toFixed(2);
      const clipId = `brokClip${id}`;
      let clipValue = '';
      let clipUpdater = null;
      if (shape === 'triangle') {
        clipValue = `polygon(50% -${padStr}%, -${padStr}% ${maxStr}%, ${maxStr}% ${maxStr}%)`;
      } else if (shape === 'rectangle' || shape === 'square') {
        clipValue = `polygon(-${padStr}% ${maxStr}%, ${maxStr}% ${maxStr}%, ${maxStr}% -${padStr}%, -${padStr}% -${padStr}%)`;
      } else if (shape === 'circle') {
        var _svg$viewBox, _svg$viewBox2;
        const circleBase = CIRCLE_RADIUS / BOARD_SIZE;
        const size = Math.max(svg.clientWidth || 0, svg.clientHeight || 0, ((_svg$viewBox = svg.viewBox) === null || _svg$viewBox === void 0 || (_svg$viewBox = _svg$viewBox.baseVal) === null || _svg$viewBox === void 0 ? void 0 : _svg$viewBox.width) || 0, ((_svg$viewBox2 = svg.viewBox) === null || _svg$viewBox2 === void 0 || (_svg$viewBox2 = _svg$viewBox2.baseVal) === null || _svg$viewBox2 === void 0 ? void 0 : _svg$viewBox2.height) || 0, 360);
        const strokePadding = OUTLINE_STROKE_WIDTH / (2 * size);
        const circleClip = Math.min(0.5, circleBase + strokePadding);
        clipValue = `circle(${(circleClip * 100).toFixed(3)}% at 50% 50%)`;
        clipUpdater = clipPath => {
          clipPath.setAttribute('clipPathUnits', 'objectBoundingBox');
          while (clipPath.firstChild) clipPath.removeChild(clipPath.firstChild);
          const circle = document.createElementNS(SVG_NS, 'circle');
          circle.setAttribute('cx', '0.5');
          circle.setAttribute('cy', '0.5');
          circle.setAttribute('r', circleClip.toFixed(6));
          clipPath.appendChild(circle);
        };
      }
      svg.style.clipPath = clipValue;
      svg.style.webkitClipPath = clipValue;
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
        svg.setAttribute('clip-path', `url(#${clipId})`);
      } else {
        svg.removeAttribute('clip-path');
        const defs = defsLookup();
        const clipPath = defs === null || defs === void 0 ? void 0 : defs.querySelector(`#${clipId}`);
        if (clipPath) clipPath.remove();
      }
    }
    allowDenominatorInp === null || allowDenominatorInp === void 0 || allowDenominatorInp.addEventListener('change', () => {
      const enabled = !!allowDenominatorInp.checked;
      updateDenominatorControls(enabled);
      window.render();
      clearCheckStatus();
    });
    shapeSel === null || shapeSel === void 0 || shapeSel.addEventListener('change', () => {
      const figState = ensureFigureState(id);
      figState.shape = shapeSel.value;
      window.render();
      clearCheckStatus();
    });
    partsInp === null || partsInp === void 0 || partsInp.addEventListener('input', () => {
      const figState = ensureFigureState(id);
      if (!figState.allowDenominatorChange) {
        const current = clampInt(figState.parts, 1);
        partsInp.value = String(current);
        if (partsVal) partsVal.textContent = String(current);
        return;
      }
      figState.parts = clampInt(partsInp.value, 1);
      window.render();
      clearCheckStatus();
    });
    divSel === null || divSel === void 0 || divSel.addEventListener('change', () => {
      const figState = ensureFigureState(id);
      figState.division = divSel.value;
      window.render();
      clearCheckStatus();
    });
    solutionNumInp === null || solutionNumInp === void 0 || solutionNumInp.addEventListener('input', () => {
      syncSolutionFromInputs();
      clearCheckStatus();
    });
    solutionDenInp === null || solutionDenInp === void 0 || solutionDenInp.addEventListener('input', () => {
      syncSolutionFromInputs();
      clearCheckStatus();
    });
    minusBtn === null || minusBtn === void 0 || minusBtn.addEventListener('click', () => {
      let n = parseInt(partsInp.value, 10);
      n = isNaN(n) ? 1 : Math.max(1, n - 1);
      partsInp.value = String(n);
      partsInp.dispatchEvent(new Event('input'));
    });
    plusBtn === null || plusBtn === void 0 || plusBtn.addEventListener('click', () => {
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
    function getSvgElement() {
      var _board2;
      return (_board2 = board) === null || _board2 === void 0 || (_board2 = _board2.renderer) === null || _board2 === void 0 ? void 0 : _board2.svgRoot;
    }
    updateDenominatorControls();
    return {
      draw,
      panel,
      getSvgElement,
      getFilled,
      setFilled,
      updateDenominatorControls
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
  async function downloadAllFigures(type) {
    var _window$render, _window;
    (_window$render = (_window = window).render) === null || _window$render === void 0 || _window$render.call(_window);
    const ids = getActiveFigureIds();
    const jobs = ids.map(id => {
      const fig = figures[id];
      if (!fig || typeof fig.getSvgElement !== 'function') return null;
      const svg = fig.getSvgElement();
      if (!svg) return null;
      const baseName = `brok${id}`;
      if (type === 'svg') {
        return () => downloadSVG(svg, baseName + '.svg');
      }
      if (type === 'png') {
        return () => downloadPNG(svg, baseName + '.png', 2);
      }
      return null;
    }).filter(Boolean);
    for (const run of jobs) {
      try {
        await run();
      } catch (error) {
        console.error('Kunne ikke eksportere figur', error);
      }
      await delay(50);
    }
  }
  exportSvgBtn === null || exportSvgBtn === void 0 || exportSvgBtn.addEventListener('click', () => {
    void downloadAllFigures('svg');
  });
  exportPngBtn === null || exportPngBtn === void 0 || exportPngBtn.addEventListener('click', () => {
    void downloadAllFigures('png');
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
    var _window$render3, _window3, _window$render4, _window4;
    const detail = event === null || event === void 0 ? void 0 : event.detail;
    if (!detail || detail.svgOverride != null) return;
    const restore = [];
    for (const id of getActiveFigureIds()) {
      const fig = figures[id];
      if (!fig || typeof fig.getFilled !== 'function' || typeof fig.setFilled !== 'function') continue;
      let filled = fig.getFilled();
      if (filled instanceof Map) {
        if (filled.size === 0) continue;
      } else if (filled && typeof filled[Symbol.iterator] === 'function') {
        filled = new Map(filled);
        if (filled.size === 0) continue;
      } else {
        continue;
      }
      restore.push(() => fig.setFilled(filled));
      fig.setFilled(new Map());
    }
    (_window$render3 = (_window3 = window).render) === null || _window$render3 === void 0 ? void 0 : _window$render3.call(_window3);
    const svgString = serializeDocument();
    if (typeof svgString === 'string' && svgString.trim()) {
      detail.svgOverride = svgString;
    }
    restore.forEach(fn => {
      try {
        fn();
      } catch (_) {}
    });
    (_window$render4 = (_window4 = window).render) === null || _window$render4 === void 0 ? void 0 : _window$render4.call(_window4);
  };
  function createCleanState() {
    const figures = getActiveFigureIds().map(id => {
      const figState = ensureFigureState(id);
      const solution = figState.solution && typeof figState.solution === 'object' ? figState.solution : {};
      const rawNum = Number.parseInt(solution.numerator, 10);
      const rawDen = Number.parseInt(solution.denominator, 10);
      return {
        shape: VALID_SHAPES.has(figState.shape) ? figState.shape : 'rectangle',
        division: VALID_DIVISIONS.has(figState.division) ? figState.division : 'horizontal',
        parts: clampInt(figState.parts, 1),
        allowDenominatorChange: !!figState.allowDenominatorChange,
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
    const palette = rawState.palette && typeof rawState.palette === 'object' ? rawState.palette : {};
    const paletteColors = Array.isArray(palette.colors)
      ? palette.colors.map(color => typeof color === 'string' ? color.trim() : '').filter(Boolean)
      : [];
    colorCount = clampInt(
      palette.colorCount != null ? palette.colorCount : paletteColors.length || colorCount,
      1,
      maxColors
    );
    STATE.colorCount = colorCount;
    modifiedColorIndexes.clear();
    autoPaletteEnabled = paletteColors.length === 0;
    STATE.colors = [];
    for (let i = 0; i < colorCount; i++) {
      const color = paletteColors[i];
      if (typeof color === 'string' && color) {
        STATE.colors[i] = color;
        modifiedColorIndexes.add(i);
      }
    }
    ensureColorDefaults(colorCount);
    rebuildLayout();
    const figureEntries = Array.isArray(rawState.figures) ? rawState.figures : [];
    const total = rows * cols;
    for (const key of Object.keys(STATE.figures)) {
      const idNum = Number.parseInt(key, 10);
      if (!Number.isFinite(idNum) || idNum < 1 || idNum > total) {
        delete STATE.figures[key];
      }
    }
    for (let idx = 0; idx < total; idx++) {
      const entry = figureEntries[idx] && typeof figureEntries[idx] === 'object' ? figureEntries[idx] : {};
      const id = idx + 1;
      const figState = ensureFigureState(id);
      if (VALID_SHAPES.has(entry.shape)) figState.shape = entry.shape;
      if (VALID_DIVISIONS.has(entry.division)) figState.division = entry.division;
      const parsedParts = Number.parseInt(entry.parts, 10);
      figState.parts = clampInt(Number.isFinite(parsedParts) && parsedParts > 0 ? parsedParts : figState.parts, 1);
      figState.allowDenominatorChange = entry.allowDenominatorChange === true;
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
    refreshAltText('state-load');
    return true;
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
      createCleanState,
      loadCleanState,
      onExampleCollect: handleExamplesCollect
    };
    window.brøkfigurerApi = api;
    if (!window.brokfigurerApi) window.brokfigurerApi = api;
    const mv = window.mathVisuals && typeof window.mathVisuals === 'object' ? window.mathVisuals : {};
    mv.activeTool = api;
    window.mathVisuals = mv;
  }
  window.render();
})();
