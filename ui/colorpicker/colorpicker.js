/* Color picker service for Math Visuals */
const DEFAULT_RENDER_STYLE = 'single';
const DEFAULT_ACTIVE_LABEL = 'Velg farge';
const DEFAULT_OPTION_LABEL = index => `Velg farge ${index}`;
const RENDER_STYLE_SIZES = {
  single: 1,
  pair: 2,
  triple: 3
};
const GLOBAL_REGISTRY = {
  pickers: new Set(),
  docBound: false
};

function isValidColor(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeRenderStyle(value) {
  if (typeof value !== 'string') return DEFAULT_RENDER_STYLE;
  const normalized = value.trim().toLowerCase();
  return RENDER_STYLE_SIZES[normalized] ? normalized : DEFAULT_RENDER_STYLE;
}

function normalizeIndexMapping(mapping, renderStyle) {
  const style = normalizeRenderStyle(renderStyle);
  const size = Number.isFinite(mapping?.size) && mapping.size > 0
    ? Math.trunc(mapping.size)
    : RENDER_STYLE_SIZES[style] || 1;
  const fallback = {
    size,
    fill: 0,
    line: size > 1 ? 1 : 0,
    angle: size > 2 ? 2 : 0
  };
  return {
    size,
    fill: Number.isFinite(mapping?.fill) ? Math.trunc(mapping.fill) : fallback.fill,
    line: Number.isFinite(mapping?.line) ? Math.trunc(mapping.line) : fallback.line,
    angle: Number.isFinite(mapping?.angle) ? Math.trunc(mapping.angle) : fallback.angle
  };
}

function resolvePaletteColors(palette, index, mapping, fallbacks = {}) {
  const normalizedPalette = Array.isArray(palette) ? palette.filter(isValidColor) : [];
  const safeIndex = Number.isFinite(index) && index > 0 ? Math.trunc(index) : 1;
  const base = (safeIndex - 1) * mapping.size;
  const fillColor = normalizedPalette[base + mapping.fill] || fallbacks.fill || normalizedPalette[0] || '';
  const lineColor = normalizedPalette[base + mapping.line] || fallbacks.line || fillColor || '';
  const angleColor = normalizedPalette[base + mapping.angle] || fallbacks.angle || lineColor || fillColor || '';
  return {
    palette: normalizedPalette,
    index: safeIndex,
    fillColor,
    lineColor,
    angleColor
  };
}

function setSwatchStyle(element, renderStyle, colors) {
  if (!element || !colors) return;
  const style = normalizeRenderStyle(renderStyle);
  element.classList.remove('color-swatch--triple');
  element.classList.remove('color-swatch--pair');
  if (style === 'triple') {
    element.classList.add('color-swatch--triple');
    element.style.setProperty('--swatch-color-1', colors.fillColor || '');
    element.style.setProperty('--swatch-color-2', colors.lineColor || colors.fillColor || '');
    element.style.setProperty('--swatch-color-3', colors.angleColor || colors.lineColor || colors.fillColor || '');
    return;
  }
  if (style === 'pair') {
    element.classList.add('color-swatch--pair');
    const fill = colors.fillColor || '';
    const line = colors.lineColor || fill;
    element.style.background = `linear-gradient(90deg,${fill} 0 50%,${line} 50% 100%)`;
    element.style.setProperty('--swatch-color-1', fill);
    element.style.setProperty('--swatch-color-2', line);
    return;
  }
  element.style.background = colors.fillColor || '';
  element.style.setProperty('--swatch-color', colors.fillColor || '');
}

function buildColorOptionButton(index, colors, renderStyle, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  const style = normalizeRenderStyle(renderStyle);
  if (style === 'triple') {
    btn.className = 'color-option-btn color-option-btn--triple';
    btn.style.setProperty('--swatch-color-1', colors.fillColor || '');
    btn.style.setProperty('--swatch-color-2', colors.lineColor || colors.fillColor || '');
    btn.style.setProperty('--swatch-color-3', colors.angleColor || colors.lineColor || colors.fillColor || '');
  } else if (style === 'pair') {
    btn.className = 'color-option-btn color-option-btn--pair';
    const fill = colors.fillColor || '';
    const line = colors.lineColor || fill;
    btn.style.background = `linear-gradient(90deg,${fill} 0 50%,${line} 50% 100%)`;
    btn.style.setProperty('--swatch-color-1', fill);
    btn.style.setProperty('--swatch-color-2', line);
  } else {
    btn.className = 'color-option-btn';
    btn.style.backgroundColor = colors.fillColor || '';
  }
  btn.dataset.colorIndex = String(index);
  if (label) {
    btn.setAttribute('aria-label', label);
  }
  return btn;
}

function ensureDocumentListener() {
  if (GLOBAL_REGISTRY.docBound || typeof document === 'undefined') return;
  document.addEventListener('click', event => {
    GLOBAL_REGISTRY.pickers.forEach(picker => {
      if (!picker.root.contains(event.target)) {
        picker.close();
      }
    });
  });
  GLOBAL_REGISTRY.docBound = true;
}

function createColorPicker(options = {}) {
  if (typeof document === 'undefined') return null;
  const root = options.root;
  if (!root) return null;
  const activeButton = root.querySelector('.color-swatch--active');
  const optionsPanel = root.querySelector('.color-options');
  if (!activeButton || !optionsPanel) return null;

  const state = {
    root,
    activeButton,
    optionsPanel,
    renderStyle: normalizeRenderStyle(options.renderStyle),
    indexMapping: normalizeIndexMapping(options.indexMapping, options.renderStyle),
    labels: {
      active: options.labels?.active || DEFAULT_ACTIVE_LABEL,
      option: typeof options.labels?.option === 'function' ? options.labels.option : DEFAULT_OPTION_LABEL
    },
    palette: Array.isArray(options.palette) ? options.palette : [],
    getIndex: typeof options.getIndex === 'function' ? options.getIndex : () => 1,
    onSelect: typeof options.onSelect === 'function' ? options.onSelect : null,
    onOpen: typeof options.onOpen === 'function' ? options.onOpen : null,
    onClose: typeof options.onClose === 'function' ? options.onClose : null,
    placement: options.placement,
    count: Number.isFinite(options.count) ? Math.max(0, Math.trunc(options.count)) : null,
    fallbacks: options.fallbacks || {}
  };

  if (state.labels.active) {
    activeButton.setAttribute('aria-label', state.labels.active);
  }
  if (state.placement && optionsPanel.dataset) {
    optionsPanel.dataset.placement = state.placement;
  }

  const picker = {
    root,
    activeButton,
    optionsPanel,
    update(newOptions = {}) {
      if (Array.isArray(newOptions.palette)) {
        state.palette = newOptions.palette;
      }
      if (newOptions.indexMapping) {
        state.indexMapping = normalizeIndexMapping(newOptions.indexMapping, newOptions.renderStyle || state.renderStyle);
      }
      if (newOptions.renderStyle) {
        state.renderStyle = normalizeRenderStyle(newOptions.renderStyle);
      }
      if (newOptions.count != null && Number.isFinite(newOptions.count)) {
        state.count = Math.max(0, Math.trunc(newOptions.count));
      }
      if (newOptions.fallbacks) {
        state.fallbacks = newOptions.fallbacks;
      }
      renderOptions();
      updateSelection(newOptions.index);
    },
    close() {
      if (!optionsPanel.hidden) {
        optionsPanel.hidden = true;
        activeButton.setAttribute('aria-expanded', 'false');
        if (state.onClose) {
          state.onClose();
        }
      }
    },
    open() {
      closeAllPickers(picker);
      const nextHidden = !optionsPanel.hidden;
      optionsPanel.hidden = nextHidden;
      activeButton.setAttribute('aria-expanded', String(!nextHidden));
      if (!nextHidden && state.onOpen) {
        state.onOpen();
      }
    }
  };

  function closeAllPickers(current) {
    GLOBAL_REGISTRY.pickers.forEach(entry => {
      if (entry !== current) {
        entry.close();
      }
    });
  }

  function getOptionCount(palette) {
    const size = Math.max(1, state.indexMapping.size || 1);
    if (Number.isFinite(state.count)) return state.count;
    return Math.max(1, Math.floor(palette.length / size) || palette.length || 1);
  }

  function renderOptions() {
    const palette = Array.isArray(state.palette) ? state.palette : [];
    const count = getOptionCount(palette);
    optionsPanel.innerHTML = '';
    for (let i = 0; i < count; i += 1) {
      const colors = resolvePaletteColors(palette, i + 1, state.indexMapping, state.fallbacks);
      const label = state.labels.option ? state.labels.option(i + 1, colors) : '';
      const btn = buildColorOptionButton(i + 1, colors, state.renderStyle, label);
      btn.addEventListener('click', event => {
        event.stopPropagation();
        const nextIndex = i + 1;
        if (state.onSelect) {
          state.onSelect(nextIndex, colors, palette);
        }
        updateSelection(nextIndex);
        picker.close();
      });
      optionsPanel.appendChild(btn);
    }
  }

  function updateSelection(forcedIndex) {
    const palette = Array.isArray(state.palette) ? state.palette : [];
    const count = getOptionCount(palette);
    const rawIndex = forcedIndex != null ? forcedIndex : state.getIndex();
    const safeIndex = Number.isFinite(rawIndex) && rawIndex > 0 ? Math.min(Math.trunc(rawIndex), count) : 1;
    const colors = resolvePaletteColors(palette, safeIndex, state.indexMapping, state.fallbacks);
    setSwatchStyle(activeButton, state.renderStyle, colors);
    optionsPanel.querySelectorAll('.color-option-btn').forEach(btn => {
      const btnIndex = Number.parseInt(btn.dataset.colorIndex, 10);
      btn.classList.toggle('is-selected', btnIndex === safeIndex);
    });
  }

  activeButton.addEventListener('click', event => {
    event.stopPropagation();
    picker.open();
  });

  optionsPanel.hidden = true;
  renderOptions();
  updateSelection();

  GLOBAL_REGISTRY.pickers.add(picker);
  ensureDocumentListener();

  return picker;
}

const colorPickerService = {
  createColorPicker
};

if (typeof window !== 'undefined') {
  window.MathVisualsColorPicker = colorPickerService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { colorPickerService };
}
