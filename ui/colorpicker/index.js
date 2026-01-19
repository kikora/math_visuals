(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module && module.exports) {
    module.exports = factory();
  } else {
    const target =
      root ||
      (typeof globalThis !== 'undefined'
        ? globalThis
        : typeof self !== 'undefined'
        ? self
        : typeof window !== 'undefined'
        ? window
        : this);
    const api = factory();
    if (target && typeof target === 'object' && api) {
      target.MathVisualsColorPicker = api;
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_LAYOUT = Object.freeze({
    columns: 3,
    maxOptions: 6
  });
  const documentBindings = new WeakSet();

  function normalizeLayout(layout = {}) {
    const columns = Number.isFinite(layout.columns) && layout.columns > 0
      ? Math.trunc(layout.columns)
      : DEFAULT_LAYOUT.columns;
    const maxOptions = Number.isFinite(layout.maxOptions) && layout.maxOptions > 0
      ? Math.trunc(layout.maxOptions)
      : DEFAULT_LAYOUT.maxOptions;
    return { columns, maxOptions };
  }

  function normalizeSlots(slots, palette, maxOptions) {
    if (Array.isArray(slots) && slots.length) {
      return slots.slice(0, maxOptions || slots.length);
    }
    if (Array.isArray(palette) && palette.length) {
      return palette.slice(0, maxOptions || palette.length).map((color, index) => ({
        value: index + 1,
        label: `Velg farge ${index + 1}`,
        color
      }));
    }
    return [];
  }

  function resolveActiveValue(state) {
    if (typeof state.getActiveValue === 'function') {
      return state.getActiveValue();
    }
    return state.activeValue;
  }

  function findSlot(slots, value) {
    if (!Array.isArray(slots)) return null;
    return slots.find(slot => slot && slot.value === value) || null;
  }

  function applyRenderStyle(renderStyle, palette, element, slot, isActive) {
    if (typeof renderStyle === 'function') {
      renderStyle({ element, slot, palette, isActive });
    }
  }

  function closePicker(element) {
    if (!element) return;
    const panel = element.querySelector('.color-options');
    if (panel) panel.hidden = true;
    const active = element.querySelector('.color-swatch--active');
    if (active) active.setAttribute('aria-expanded', 'false');
  }

  function registerDocumentHandler(doc) {
    if (!doc || documentBindings.has(doc)) return;
    documentBindings.add(doc);
    doc.addEventListener('click', event => {
      const target = event.target;
      if (target && target.closest && target.closest('[data-color-picker]')) {
        return;
      }
      doc.querySelectorAll('[data-color-picker]').forEach(picker => {
        closePicker(picker);
      });
    });
  }

  function createColorPicker(config = {}) {
    const element = config.element;
    if (!element) return null;
    const activeButton = element.querySelector('.color-swatch--active');
    const optionsPanel = element.querySelector('.color-options');
    if (!activeButton || !optionsPanel) return null;
    element.dataset.colorPicker = element.dataset.colorPicker || 'true';
    const doc = element.ownerDocument || (typeof document !== 'undefined' ? document : null);
    registerDocumentHandler(doc);

    const state = {
      element,
      activeButton,
      optionsPanel,
      palette: Array.isArray(config.palette) ? config.palette : [],
      slots: Array.isArray(config.slots) ? config.slots : [],
      renderStyle: config.renderStyle,
      onSelect: config.onSelect,
      layout: normalizeLayout(config.layout),
      getActiveValue: config.getActiveValue,
      activeValue: config.activeValue
    };

    function applyLayout() {
      if (!state.optionsPanel) return;
      state.optionsPanel.style.setProperty('--color-options-columns', String(state.layout.columns));
    }

    function renderOptions() {
      const maxOptions = state.layout.maxOptions;
      state.slots = normalizeSlots(state.slots, state.palette, maxOptions);
      state.optionsPanel.innerHTML = '';
      state.slots.forEach(slot => {
        const btn = (state.element.ownerDocument || document).createElement('button');
        btn.type = 'button';
        btn.className = 'color-option-btn';
        if (slot && slot.value !== undefined) {
          btn.dataset.colorIndex = String(slot.value);
        }
        if (slot && slot.label) {
          btn.setAttribute('aria-label', slot.label);
        }
        applyRenderStyle(state.renderStyle, state.palette, btn, slot, false);
        btn.addEventListener('click', event => {
          event.stopPropagation();
          if (!state.getActiveValue) {
            state.activeValue = slot.value;
          }
          if (typeof state.onSelect === 'function') {
            state.onSelect(slot.value, slot);
          }
          syncSelection();
          state.optionsPanel.hidden = true;
          state.activeButton.setAttribute('aria-expanded', 'false');
        });
        state.optionsPanel.appendChild(btn);
      });
    }

    function syncSelection() {
      const activeValue = resolveActiveValue(state);
      const activeSlot = findSlot(state.slots, activeValue) || state.slots[0];
      if (activeSlot) {
        applyRenderStyle(state.renderStyle, state.palette, state.activeButton, activeSlot, true);
      }
      state.optionsPanel.querySelectorAll('.color-option-btn').forEach(btn => {
        const btnValue = Number.parseInt(btn.dataset.colorIndex, 10);
        btn.classList.toggle('is-selected', btnValue === activeValue);
      });
    }

    function bindToggle() {
      if (state.element.dataset.colorPickerBound) return;
      state.element.dataset.colorPickerBound = 'true';
      state.activeButton.addEventListener('click', event => {
        event.stopPropagation();
        const nextHidden = !state.optionsPanel.hidden;
        state.optionsPanel.hidden = nextHidden;
        state.activeButton.setAttribute('aria-expanded', String(!nextHidden));
      });
    }

    function update(next = {}) {
      if (Array.isArray(next.palette)) {
        state.palette = next.palette;
      }
      if (Array.isArray(next.slots)) {
        state.slots = next.slots;
      }
      if (typeof next.renderStyle === 'function') {
        state.renderStyle = next.renderStyle;
      }
      if (typeof next.onSelect === 'function') {
        state.onSelect = next.onSelect;
      }
      if (typeof next.getActiveValue === 'function' || next.getActiveValue === null) {
        state.getActiveValue = next.getActiveValue;
      }
      if (next.activeValue !== undefined) {
        state.activeValue = next.activeValue;
      }
      if (next.layout) {
        state.layout = normalizeLayout(next.layout);
      }
      applyLayout();
      renderOptions();
      syncSelection();
    }

    bindToggle();
    applyLayout();
    renderOptions();
    syncSelection();

    return {
      update,
      sync: syncSelection,
      element: state.element
    };
  }

  return { createColorPicker };
});
