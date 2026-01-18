const defaultDoc = typeof document !== 'undefined' ? document : null;

function normalizeValue(value) {
  if (value == null) {
    return '';
  }
  const stringValue = typeof value === 'string' ? value : String(value);
  return stringValue.trim();
}

function buildLabelFromFigure(figure) {
  if (!figure || typeof figure !== 'object') {
    return '';
  }
  const parts = [];
  if (typeof figure.name === 'string' && figure.name.trim()) {
    parts.push(figure.name.trim());
  }
  if (typeof figure.dimensions === 'string' && figure.dimensions.trim()) {
    parts.push(figure.dimensions.trim());
  }
  if (typeof figure.scaleLabel === 'string' && figure.scaleLabel.trim()) {
    parts.push(`målestokk ${figure.scaleLabel.trim()}`);
  }
  return parts.join(' – ');
}

export function createFigurePickerHelpers(options = {}) {
  const {
    figureData,
    doc = defaultDoc,
    getFigureValue = figure => (figure && figure.id != null ? String(figure.id) : ''),
    getFigureAliases = () => [],
    fallbackCategoryId
  } = options;

  const categories = Array.isArray(figureData && figureData.categories)
    ? figureData.categories.filter(category => category && typeof category.id === 'string')
    : [];

  const categoryEntries = new Map();
  const categoryLookup = new Map();
  const valueLookup = new Map();
  const categoryOrder = [];

  function toArray(value) {
    if (Array.isArray(value)) {
      return value;
    }
    if (value == null) {
      return [];
    }
    return [value];
  }

  function computeFigureValues(figure) {
    const seen = new Set();
    const values = [];

    function addValue(candidate) {
      if (typeof candidate !== 'string') {
        return;
      }
      const normalized = normalizeValue(candidate);
      if (!normalized || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      values.push(normalized);
    }

    let primary = '';
    try {
      primary = normalizeValue(getFigureValue(figure));
    } catch (_) {
      primary = '';
    }
    if (primary) {
      addValue(primary);
    }

    let aliases = [];
    if (typeof getFigureAliases === 'function') {
      try {
        aliases = toArray(getFigureAliases(figure));
      } catch (_) {
        aliases = [];
      }
    }
    aliases.forEach(addValue);

    if (!primary) {
      primary = values[0] || '';
    }

    return { primary, values };
  }

  function registerLookupValue(value, payload) {
    const normalized = normalizeValue(value);
    if (!normalized) {
      return;
    }
    if (!valueLookup.has(normalized)) {
      valueLookup.set(normalized, payload);
    }
    const lowered = normalized.toLowerCase();
    if (!valueLookup.has(lowered)) {
      valueLookup.set(lowered, payload);
    }
  }

  categories.forEach(category => {
    const normalizedId = normalizeValue(category.id);
    if (!normalizedId) {
      return;
    }
    if (!categoryEntries.has(category.id)) {
      const figures = Array.isArray(category.figures)
        ? category.figures.filter(figure => figure && typeof figure === 'object')
        : [];
      const entry = {
        category,
        figures
      };
      categoryEntries.set(category.id, entry);
      categoryOrder.push(category.id);
      categoryLookup.set(normalizedId, entry);
      const lowered = normalizedId.toLowerCase();
      if (!categoryLookup.has(lowered)) {
        categoryLookup.set(lowered, entry);
      }
      figures.forEach(figure => {
        const { primary, values } = computeFigureValues(figure);
        if (!primary) {
          return;
        }
        const payload = {
          value: primary,
          categoryId: category.id,
          figure,
          label: buildLabelFromFigure(figure)
        };
        if (!values.length) {
          registerLookupValue(primary, payload);
          return;
        }
        values.forEach(candidate => {
          registerLookupValue(candidate, payload);
        });
      });
    }
  });

  const resolvedFallbackCategoryId = (() => {
    const explicit = normalizeValue(fallbackCategoryId);
    if (explicit) {
      const match = categoryLookup.get(explicit) || categoryLookup.get(explicit.toLowerCase());
      if (match) {
        return match.category.id;
      }
    }
    return categoryOrder.length ? categoryOrder[0] : '';
  })();

  function getCategoryEntry(candidate) {
    const normalized = normalizeValue(candidate);
    if (normalized && categoryLookup.has(normalized)) {
      return categoryLookup.get(normalized);
    }
    const lowered = normalized.toLowerCase();
    if (lowered && categoryLookup.has(lowered)) {
      return categoryLookup.get(lowered);
    }
    return null;
  }

  function resolveCategoryId(candidate, figureValue) {
    const entry = getCategoryEntry(candidate);
    if (entry) {
      return entry.category.id;
    }
    const match = findOptionByValue(figureValue);
    if (match) {
      return match.categoryId;
    }
    return resolvedFallbackCategoryId;
  }

  function getFiguresForCategory(categoryId) {
    const entry = getCategoryEntry(categoryId) || getCategoryEntry(resolvedFallbackCategoryId);
    if (!entry) {
      return [];
    }
    return entry.figures.slice();
  }

  function buildFigureOptions(categoryId) {
    const resolvedCategoryId = resolveCategoryId(categoryId);
    const entry = getCategoryEntry(resolvedCategoryId);
    if (!entry) {
      return [];
    }
    return entry.figures
      .map(figure => {
        const { primary } = computeFigureValues(figure);
        if (!primary) {
          return null;
        }
        return {
          value: primary,
          label: buildLabelFromFigure(figure) || figure.name || primary,
          categoryId: entry.category.id,
          figure
        };
      })
      .filter(option => option);
  }

  function findOptionByValue(rawValue) {
    const normalized = normalizeValue(rawValue);
    if (!normalized) {
      return null;
    }
    const entry = valueLookup.get(normalized) || valueLookup.get(normalized.toLowerCase());
    if (!entry) {
      return null;
    }
    return {
      value: entry.value,
      categoryId: entry.categoryId,
      figure: entry.figure,
      label: entry.label
    };
  }

  function applySelectOptions(selectEl, options, selectedValue, config = {}) {
    if (!selectEl || !doc) {
      return { selectedValue: '', hasMatch: false };
    }
    const {
      placeholderLabel = null,
      placeholderSelected,
      disableWhenEmpty = false,
      disabled,
      datasetCategoryId
    } = config;

    selectEl.textContent = '';
    let placeholderEl = null;
    if (placeholderLabel != null) {
      placeholderEl = doc.createElement('option');
      placeholderEl.value = '';
      placeholderEl.textContent = placeholderLabel;
      placeholderEl.selected = placeholderSelected !== false;
      selectEl.appendChild(placeholderEl);
    }

    const fragment = doc.createDocumentFragment();
    options.forEach(option => {
      const optionEl = doc.createElement('option');
      optionEl.value = option.value;
      optionEl.textContent = option.label || option.value;
      fragment.appendChild(optionEl);
    });
    selectEl.appendChild(fragment);

    if (datasetCategoryId != null) {
      selectEl.dataset.categoryId = datasetCategoryId;
    } else if (selectEl.dataset && 'categoryId' in selectEl.dataset) {
      delete selectEl.dataset.categoryId;
    }

    const normalizedSelected = normalizeValue(selectedValue);
    let hasMatch = false;
    if (normalizedSelected) {
      const matchingOption = options.find(option => normalizeValue(option.value) === normalizedSelected);
      if (matchingOption) {
        selectEl.value = matchingOption.value;
        hasMatch = true;
        if (placeholderEl) {
          placeholderEl.selected = false;
        }
      }
    }

    if (!hasMatch) {
      if (placeholderEl) {
        selectEl.value = '';
        placeholderEl.selected = placeholderSelected !== false;
      } else if (options[0]) {
        selectEl.value = options[0].value;
      } else {
        selectEl.value = '';
      }
    }

    if (typeof disabled === 'boolean') {
      selectEl.disabled = disabled;
    } else if (disableWhenEmpty) {
      selectEl.disabled = options.length === 0;
    }

    return { selectedValue: selectEl.value, hasMatch };
  }

  function renderCategorySelect(selectEl, selectedId, config = {}) {
    const options = categoryOrder
      .map(categoryId => {
        const entry = categoryEntries.get(categoryId);
        if (!entry) {
          return null;
        }
        const label =
          typeof entry.category.label === 'string' && entry.category.label
            ? entry.category.label
            : entry.category.id;
        return { value: entry.category.id, label };
      })
      .filter(option => option);

    const resolvedSelection = resolveCategoryId(selectedId);
    const placeholderLabel = options.length === 0 ? config.placeholderLabel : null;
    const { selectedValue } = applySelectOptions(selectEl, options, resolvedSelection, {
      disableWhenEmpty: true,
      placeholderLabel
    });
    return { options, selectedId: selectedValue };
  }

  function renderFigureSelect(selectEl, categoryId, selectedValue, config = {}) {
    const {
      placeholderLabel = null,
      disableWhenEmpty = false,
      disabled,
      datasetCategoryId,
      options: optionsOverride
    } = config;
    const resolvedCategoryId = resolveCategoryId(categoryId, selectedValue);
    const options = Array.isArray(optionsOverride) ? optionsOverride : buildFigureOptions(resolvedCategoryId);
    const { selectedValue: appliedValue } = applySelectOptions(selectEl, options, selectedValue, {
      placeholderLabel,
      disableWhenEmpty,
      disabled,
      datasetCategoryId: datasetCategoryId == null ? resolvedCategoryId : datasetCategoryId
    });
    const match = findOptionByValue(appliedValue);
    return { options, match, selectedValue: appliedValue, categoryId: resolvedCategoryId };
  }

  function getCategory(categoryId) {
    const entry = getCategoryEntry(categoryId);
    return entry ? entry.category : null;
  }

  return {
    doc,
    figureData: { categories: categories.slice() },
    normalizeValue,
    resolveCategoryId,
    getCategory,
    getFiguresForCategory,
    buildFigureOptions,
    buildFigureOptionLabel: buildLabelFromFigure,
    findOptionByValue,
    renderCategorySelect,
    renderFigureSelect,
    applySelectOptions
  };
}
