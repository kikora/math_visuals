const statusEl = document.querySelector('[data-status]');
const filterInput = document.querySelector('[data-filter]');
const countEl = document.querySelector('[data-count]');
const categoryGrid = document.querySelector('[data-category-grid]');
const categorySortSelect = document.querySelector('[data-category-sort]');
const helperEl = document.querySelector('[data-helper]');
const categorySuggestionsList = document.querySelector('[data-category-suggestions]');
const uploadForm = document.querySelector('[data-upload-form]');
const uploadDialog = document.querySelector('[data-upload-dialog]');
const uploadDialogCloseButton = uploadDialog?.querySelector('[data-upload-close]') || null;
const uploadLaunchButton = document.querySelector('[data-upload-launch]');
const addCategoryToggleButton = document.querySelector('[data-add-category-toggle]');
const addCategoryForm = document.querySelector('[data-add-category-form]');
const addCategoryInput = addCategoryForm?.querySelector('[data-add-category-input]') || null;
const addCategoryCancelButton = addCategoryForm?.querySelector('[data-add-category-cancel]') || null;
const addCategoryFeedback = document.querySelector('[data-add-category-feedback]');
const uploadFileInput = uploadForm?.querySelector('[data-upload-file]') || null;
const uploadCategoryInput = uploadForm?.querySelector('[data-upload-category]') || null;
const uploadStatusEl = uploadForm?.querySelector('[data-upload-status]') || null;
const uploadStatusMessageEl = uploadStatusEl?.querySelector('[data-upload-status-message]') || null;
const editorDialog = document.querySelector('[data-custom-editor]');
const editorForm = editorDialog?.querySelector('[data-editor-form]') || null;
const editorNameInput = editorDialog?.querySelector('[data-editor-name]') || null;
const editorCategoryInput = editorDialog?.querySelector('[data-editor-category]') || null;
const editorScaleLabelField = editorDialog?.querySelector('[data-editor-scale-field]') || null;
const editorScaleLabelInput = editorDialog?.querySelector('[data-editor-scale-label]') || null;
const editorErrorEl = editorDialog?.querySelector('[data-editor-error]') || null;
const editorCancelButton = editorDialog?.querySelector('[data-editor-cancel]') || null;
const categoryDialog = document.querySelector('[data-category-dialog]');
const categoryDialogTitle = categoryDialog?.querySelector('[data-category-title]') || null;
const categoryDialogDescription = categoryDialog?.querySelector('[data-category-description]') || null;
const categoryDialogCount = categoryDialog?.querySelector('[data-category-count]') || null;
const categoryDialogFigures = categoryDialog?.querySelector('[data-category-figures]') || null;
const categoryDialogEmpty = categoryDialog?.querySelector('[data-category-empty]') || null;
const categoryDialogCloseButton = categoryDialog?.querySelector('[data-category-close]') || null;
const categoryDialogUploadButton = categoryDialog?.querySelector('[data-category-upload]') || null;
const categoryDialogDeleteButton = categoryDialog?.querySelector('[data-category-delete]') || null;
const categoryDialogDeleteCategoryButton =
  categoryDialog?.querySelector('[data-category-delete-category]') || null;
const categoryDialogSelectAllButton = categoryDialog?.querySelector('[data-category-select-all]') || null;
const categoryDialogSelectAllLabel = categoryDialogSelectAllButton?.querySelector(
  '[data-category-select-all-label]'
) || null;
const categoryDialogAppsSection = categoryDialog?.querySelector('[data-category-apps-section]') || null;
const categoryDialogAppsFieldset = categoryDialogAppsSection?.querySelector('[data-category-apps="category"]') || null;
const categoryDialogAppsContainer = categoryDialogAppsFieldset?.querySelector('[data-category-apps-options]') || null;
const categoryDialogAppsSaveButton = categoryDialogAppsSection?.querySelector('[data-category-apps-save]') || null;
const categoryDialogAppsStatus = categoryDialogAppsSection?.querySelector('[data-category-apps-status]') || null;
const categoryMenu = document.querySelector('[data-category-menu]');
const categoryMenuSurface = categoryMenu?.querySelector('[data-category-menu-surface]') || null;
const copyFeedbackTimers = new WeakMap();

const CUSTOM_STORAGE_KEY = 'mathvis:figureLibrary:customEntries:v1';
const CUSTOM_CATEGORY_STORAGE_KEY = 'mathvis:figureLibrary:customCategories:v1';
const DEFAULT_CATEGORY_THUMBNAIL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" fill="none"><rect width="160" height="120" rx="12" fill="%23F3F4F6"/><path d="M48 44h64v12H48zM48 66h64v12H48z" fill="%23CBD2D9"/></svg>';
const LOCAL_ONLY_LIMITATION = 'Figurer lagres lokalt i denne nettleseren fordi figurbibliotekets API ikke er tilgjengelig.';
const CATEGORY_PREVIEW_COUNT = 4;
const FIGURE_LIBRARY_ENDPOINT = '/api/figure-library';
const FIGURE_LIBRARY_RAW_ENDPOINT = '/api/figure-library/raw';
const FIGURE_LIBRARY_TOOL = 'bibliotek-upload';

let categories = [];
const categoryMetaById = new Map();

const categoryButtons = new Map();
let activeCategoryId = null;

let categorySortOrder = 'default';

const figuresByCategory = new Map();
const UNCATEGORIZED_KEY = '__uncategorized__';

let figureItems = [];

const customCategories = [];
const customCategoryMap = new Map();
let addCategoryFeedbackTimer = null;

const customEntries = [];
const customEntryMap = new Map();
let customStorageAvailable = true;
let uploadStatusTimer = null;
let uploadDialogReturnFocus = null;
let editorReturnFocus = null;
let editingEntryId = null;
let categoryDialogReturnFocus = null;
let categoryMenuTrigger = null;
let categoryMenuCategory = null;

const categoryDialogState = {
  categoryId: null,
  selectedSlugs: new Set(),
  categoryApps: [],
};

const DEFAULT_CATEGORY_APP = 'bibliotek';
const DEFAULT_VISIBLE_CATEGORY_APPS = ['måling', 'sortering', 'kvikkfigurer'];
const categoryAppOptionOrder = [];
const categoryAppOptionMap = new Map();
const categoryAppFormContexts = {
  category: { fieldset: categoryDialogAppsFieldset, container: categoryDialogAppsContainer, inputs: new Map() },
};
let categoryAppControlsReady = false;

const figureLibraryUrlCache = new Map();

ensureCategoryAppOption(DEFAULT_CATEGORY_APP, { label: 'Figurbibliotek', locked: true });
DEFAULT_VISIBLE_CATEGORY_APPS.forEach((appId) => ensureCategoryAppOption(appId));

let figureLibraryMetadata = { storageMode: 'memory', persistent: false, limitation: '' };
let hasRequestedSummaryView = false;

const observer = 'IntersectionObserver' in window
  ? new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: '200px 0px',
      threshold: 0.1,
    })
  : null;

async function init() {
  setStatusMessage('Laster figurer …', 'info', { storeBase: true });
  loadCustomCategories();
  try {
    await loadCustomEntries();
  } catch (error) {
    console.error('Kunne ikke laste egendefinerte figurer', error);
  }
  refreshLibrary({ maintainFilter: false });
  filterInput?.addEventListener('input', handleFilterInput);
  categorySortSelect?.addEventListener('change', handleCategorySortChange);
  setupUploadLauncher();
  setupAddCategoryForm();
  setupUploadForm();
  setupEditorDialog();
  initializeCategoryAppControls();
  setupCategoryDialog();
  setupCategoryMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function normalizeCategoryAppId(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.toLowerCase();
}

function formatCategoryAppLabel(appId) {
  if (!appId) return '';
  const normalized = appId.replace(/[-_]+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildAbsoluteFigureLibraryUrl(value) {
  const key = typeof value === 'string' && value.trim() ? value.trim() : '';
  if (!key) return '';

  if (figureLibraryUrlCache.has(key)) {
    return figureLibraryUrlCache.get(key);
  }

  let resolved = key;
  const isAbsolute = /^https?:\/\//i.test(key) || key.startsWith('//');
  if (!isAbsolute) {
    const normalized = key.startsWith('/') ? key : `/${key}`;
    try {
      resolved = new URL(normalized, window.location.origin).toString();
    } catch (error) {
      resolved = normalized;
    }
  }

  figureLibraryUrlCache.set(key, resolved);
  return resolved;
}

function ensureCategoryAppOption(appId, options = {}) {
  const normalized = normalizeCategoryAppId(appId);
  if (!normalized) {
    return null;
  }
  const existing = categoryAppOptionMap.get(normalized);
  const labelCandidate = typeof options.label === 'string' && options.label.trim()
    ? options.label.trim()
    : formatCategoryAppLabel(normalized);
  const locked = options.locked === true;
  if (existing) {
    if (labelCandidate && existing.label !== labelCandidate) {
      existing.label = labelCandidate;
    }
    if (locked && !existing.locked) {
      existing.locked = true;
    }
    categoryAppOptionMap.set(normalized, existing);
    return existing;
  }
  const entry = { id: normalized, label: labelCandidate || normalized, locked };
  categoryAppOptionOrder.push(normalized);
  categoryAppOptionMap.set(normalized, entry);
  return entry;
}

function getCategoryAppOptions() {
  return categoryAppOptionOrder.map((id) => categoryAppOptionMap.get(id)).filter(Boolean);
}

function registerCategoryApps(apps) {
  if (!apps) return;
  const beforeSize = categoryAppOptionMap.size;
  const list = Array.isArray(apps) ? apps : [apps];
  list.forEach((appId) => {
    ensureCategoryAppOption(appId);
  });
  if (categoryAppOptionMap.size !== beforeSize && categoryAppControlsReady) {
    renderCategoryAppControls();
  }
}

function sanitizeCategoryApps(value, options = {}) {
  const includeDefaults = Object.prototype.hasOwnProperty.call(options, 'includeDefaults')
    ? options.includeDefaults
    : value == null;
  const ensureDefaultApp = options.ensureDefaultApp !== false;
  const defaultApps = Array.isArray(options.defaultApps) ? options.defaultApps : DEFAULT_VISIBLE_CATEGORY_APPS;
  const allowEmpty = options.allowEmpty === true;

  const entries = Array.isArray(value)
    ? value.slice()
    : typeof value === 'string'
      ? [value]
      : [];

  const seen = new Set();
  const sanitized = [];

  for (const entry of entries) {
    const normalized = normalizeCategoryAppId(entry);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    sanitized.push(normalized);
    seen.add(normalized);
  }

  if (ensureDefaultApp) {
    const defaultId = normalizeCategoryAppId(DEFAULT_CATEGORY_APP);
    if (defaultId && !seen.has(defaultId)) {
      sanitized.unshift(defaultId);
      seen.add(defaultId);
    }
  }

  const nonDefaultCount = sanitized.filter((appId) => appId !== DEFAULT_CATEGORY_APP).length;
  if (includeDefaults && nonDefaultCount === 0) {
    defaultApps.forEach((appId) => {
      const normalized = normalizeCategoryAppId(appId);
      if (!normalized || seen.has(normalized)) return;
      sanitized.push(normalized);
      seen.add(normalized);
    });
  }

  if (!sanitized.length && !allowEmpty) {
    const fallback = ensureDefaultApp ? [DEFAULT_CATEGORY_APP, ...defaultApps] : defaultApps;
    fallback.forEach((appId) => {
      const normalized = normalizeCategoryAppId(appId);
      if (!normalized || seen.has(normalized)) return;
      sanitized.push(normalized);
      seen.add(normalized);
    });
  }

  registerCategoryApps(sanitized);
  return sanitized;
}

function getCategoryAppSelectionFromInputs(context) {
  const config = categoryAppFormContexts[context];
  if (!config || !config.inputs) {
    return [];
  }
  const selection = [];
  config.inputs.forEach((input, appId) => {
    if (input && input.checked && !input.disabled) {
      selection.push(appId);
    }
  });
  return selection;
}

function updateCategoryAppFieldsetState(context) {
  const config = categoryAppFormContexts[context];
  if (!config || !config.fieldset) {
    return;
  }
  const selection = getCategoryAppSelectionFromInputs(context);
  if (selection.length) {
    config.fieldset.removeAttribute('data-category-apps-empty');
  } else {
    config.fieldset.setAttribute('data-category-apps-empty', 'true');
  }
}

function renderCategoryAppControls() {
  const options = getCategoryAppOptions().filter((option) => option.id !== DEFAULT_CATEGORY_APP);
  Object.entries(categoryAppFormContexts).forEach(([context, config]) => {
    if (!config || !config.container) return;
    const previousSelection = getCategoryAppSelectionFromInputs(context);
    const fallbackSelection = previousSelection.length
      ? previousSelection
      : sanitizeCategoryApps(undefined).filter((appId) => appId !== DEFAULT_CATEGORY_APP);
    config.container.innerHTML = '';
    config.inputs.clear();
    options.forEach((option) => {
      const checkboxId = `category-app-${context}-${option.id}`;
      const label = document.createElement('label');
      label.className = 'categoryAppsOption';
      if (option.locked) {
        label.dataset.locked = 'true';
      }
      label.htmlFor = checkboxId;
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = checkboxId;
      input.value = option.id;
      const shouldCheck = option.locked || fallbackSelection.includes(option.id);
      input.checked = shouldCheck;
      if (option.locked) {
        input.disabled = true;
        input.setAttribute('aria-disabled', 'true');
      }
      input.addEventListener('change', () => updateCategoryAppFieldsetState(context));
      const text = document.createElement('span');
      text.textContent = option.label || formatCategoryAppLabel(option.id);
      label.appendChild(input);
      label.appendChild(text);
      if (option.locked) {
        const hint = document.createElement('span');
        hint.className = 'categoryAppsOptionHint';
        hint.textContent = 'Alltid valgt';
        hint.setAttribute('aria-hidden', 'true');
        label.appendChild(hint);
      }
      config.container.appendChild(label);
      config.inputs.set(option.id, input);
    });
    updateCategoryAppFieldsetState(context);
  });
}

function initializeCategoryAppControls() {
  categoryAppControlsReady = true;
  renderCategoryAppControls();
  resetCategoryAppSelection('category');
}

function resetCategoryAppSelection(context) {
  setCategoryAppSelection(context, undefined);
}

function setCategoryAppSelection(context, apps) {
  const config = categoryAppFormContexts[context];
  if (!config || !config.inputs) {
    return;
  }
  const sanitized = sanitizeCategoryApps(apps, { includeDefaults: apps == null });
  const selected = new Set(sanitized);
  getCategoryAppOptions().forEach((option) => {
    const input = config.inputs.get(option.id);
    if (!input) return;
    const shouldCheck = selected.has(option.id) || option.locked;
    input.checked = shouldCheck;
  });
  updateCategoryAppFieldsetState(context);
}

function getSelectedCategoryApps(context) {
  const selection = getCategoryAppSelectionFromInputs(context);
  return sanitizeCategoryApps(selection, { includeDefaults: false });
}

function refreshLibrary(options = {}) {
  const { maintainFilter = true } = options;
  const baseCategories = Array.isArray(customCategories) ? customCategories.slice() : [];

  alignCustomEntriesWithBaseCategories(baseCategories);

  prepareFigureItems(customEntries);
  recomputeCategories(baseCategories);

  let shouldCloseCategoryDialog = false;
  if (!maintainFilter) {
    if (activeCategoryId) {
      shouldCloseCategoryDialog = true;
    }
    activeCategoryId = null;
    if (filterInput) {
      filterInput.value = '';
    }
  } else if (activeCategoryId && !categoryMetaById.has(activeCategoryId)) {
    activeCategoryId = null;
    shouldCloseCategoryDialog = true;
  }

  updateCategorySelection();
  updateCategoryCounts();
  applyFilter();

  if (shouldCloseCategoryDialog && isCategoryDialogOpen()) {
    closeCategoryDialog({ restoreFocus: false });
  }
}

function renderCategories() {
  if (!categoryGrid) return;
  closeCategoryMenu({ returnFocus: false });
  categoryGrid.innerHTML = '';
  categoryButtons.clear();
  categoryMetaById.clear();

  const fragment = document.createDocumentFragment();
  const orderedCategories = getSortedCategories(categories);
  for (const category of orderedCategories) {
    if (!category || typeof category !== 'object') {
      continue;
    }
    const categoryId = typeof category.id === 'string' ? category.id : '';
    if (!categoryId) continue;
    const titleText = getCategoryDisplayName(category) || categoryId;
    const descriptionText = typeof category.description === 'string' && category.description.trim()
      ? category.description.trim()
      : '';

    const type = typeof category.type === 'string' ? category.type : 'custom';
    const normalizedMeta = { ...category, id: categoryId, type, name: titleText, description: descriptionText };

    const item = document.createElement('li');
    item.className = 'categoryItem';

    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'categoryMenuToggle';
    menuButton.dataset.categoryId = categoryId;
    menuButton.setAttribute('aria-haspopup', 'menu');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', `Flere handlinger for ${titleText}`);
    menuButton.innerHTML = `
      <svg aria-hidden="true" focusable="false" viewBox="0 0 16 16">
        <circle cx="8" cy="3" r="1.5" fill="currentColor"></circle>
        <circle cx="8" cy="8" r="1.5" fill="currentColor"></circle>
        <circle cx="8" cy="13" r="1.5" fill="currentColor"></circle>
      </svg>
    `;
    menuButton.addEventListener('click', (event) => handleCategoryMenuToggle(event, normalizedMeta));
    menuButton.addEventListener('keydown', (event) => handleCategoryMenuButtonKeydown(event, normalizedMeta));

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'categoryButton';
    button.dataset.categoryId = categoryId;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-label', titleText);
    button.title = titleText;
    button.addEventListener('click', (event) => handleCategoryClick(category, event.currentTarget));

    const figure = createCategoryPreviewElement(category, titleText);

    const meta = document.createElement('div');
    meta.className = 'categoryMeta';

    const title = document.createElement('h3');
    title.textContent = titleText;
    meta.appendChild(title);

    const description = document.createElement('p');
    if (descriptionText) {
      description.textContent = descriptionText;
      description.hidden = false;
    } else {
      description.textContent = '';
      description.hidden = true;
    }
    meta.appendChild(description);

    const count = document.createElement('span');
    count.className = 'categoryCount';
    count.dataset.categoryCount = '';
    count.textContent = '–';
    meta.appendChild(count);

    button.appendChild(figure);
    button.appendChild(meta);

    item.appendChild(button);
    item.appendChild(menuButton);
    fragment.appendChild(item);

    categoryButtons.set(categoryId, { button, countEl: count, category: normalizedMeta, listItem: item, menuButton });
    categoryMetaById.set(categoryId, normalizedMeta);
  }

  categoryGrid.appendChild(fragment);
}

function getSortedCategories(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const items = list.slice();
  if (categorySortOrder === 'alphabetical') {
    return items.sort((a, b) => {
      const nameA = (getCategoryDisplayName(a) || '').toLowerCase();
      const nameB = (getCategoryDisplayName(b) || '').toLowerCase();
      return nameA.localeCompare(nameB, 'nb', { sensitivity: 'base' });
    });
  }
  return items;
}

function setupCategoryMenu() {
  if (!categoryMenu || !categoryMenuSurface) return;
  categoryMenuSurface.addEventListener('click', handleCategoryMenuClick);
  categoryMenuSurface.addEventListener('keydown', handleCategoryMenuSurfaceKeydown);
  categoryMenu.addEventListener('focusout', handleCategoryMenuFocusOut);
  document.addEventListener('pointerdown', handleDocumentPointerDown);
  document.addEventListener('keydown', handleDocumentKeydown);
  window.addEventListener('resize', handleWindowResizeForMenu);
  window.addEventListener('scroll', handleWindowScrollForMenu, true);
}

function isCategoryMenuOpen() {
  return Boolean(categoryMenu && categoryMenu.dataset.open === 'true');
}

function getCategoryMenuButton(action) {
  if (!categoryMenuSurface) return null;
  return categoryMenuSurface.querySelector(`[data-category-action="${action}"]`);
}

function getCategoryMenuItems() {
  if (!categoryMenuSurface) return [];
  return Array.from(categoryMenuSurface.querySelectorAll('[data-category-action]')).filter(element => {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (element.matches('[disabled]')) {
      return false;
    }
    return true;
  });
}

function handleCategoryMenuToggle(event, category) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) return;
  if (!category || typeof category.id !== 'string') return;

  if (isCategoryMenuOpen() && categoryMenuTrigger === button) {
    closeCategoryMenu({ returnFocus: false });
    return;
  }

  closeCategoryMenu({ returnFocus: false });
  openCategoryMenu(button, category);
}

function handleCategoryMenuButtonKeydown(event, category) {
  const button = event.currentTarget;
  if (!(button instanceof HTMLElement)) return;
  if (!category || typeof category.id !== 'string') return;

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    const focusLast = event.key === 'ArrowUp';
    closeCategoryMenu({ returnFocus: false });
    openCategoryMenu(button, category, { focusLast });
  }
}

function openCategoryMenu(button, category, options = {}) {
  if (!categoryMenu || !categoryMenuSurface) return;
  if (!(button instanceof HTMLElement)) return;
  if (!category || typeof category.id !== 'string') return;

  const { focusLast = false } = options;
  categoryMenuTrigger = button;
  categoryMenuCategory = category;

  categoryMenu.hidden = false;
  categoryMenu.dataset.open = 'true';
  button.setAttribute('aria-expanded', 'true');

  updateCategoryMenuDeleteState(category);

  positionCategoryMenu(button);

  const items = getCategoryMenuItems();
  if (items.length > 0) {
    const targetItem = focusLast ? items[items.length - 1] : items[0];
    requestAnimationFrame(() => {
      targetItem.focus();
    });
  }
}

function isCategoryDeletable(category) {
  if (!category || typeof category !== 'object') {
    return false;
  }
  const type = typeof category.type === 'string' ? category.type.trim().toLowerCase() : '';
  if (type === 'custom') {
    return true;
  }
  const origin = typeof category.origin === 'string' ? category.origin.trim().toLowerCase() : '';
  if (origin === 'server') {
    return true;
  }
  return false;
}

function updateCategoryMenuDeleteState(category) {
  const deleteButton = getCategoryMenuButton('delete');
  if (!(deleteButton instanceof HTMLButtonElement)) {
    return;
  }
  const canDelete = isCategoryDeletable(category);
  deleteButton.disabled = !canDelete;
  deleteButton.setAttribute('aria-disabled', canDelete ? 'false' : 'true');
  if (!canDelete) {
    deleteButton.title = 'Bare egendefinerte kategorier kan slettes';
  } else {
    deleteButton.removeAttribute('title');
  }
}

function positionCategoryMenu(button) {
  if (!categoryMenuSurface) return;
  categoryMenuSurface.style.top = '0px';
  categoryMenuSurface.style.left = '0px';

  const triggerRect = button.getBoundingClientRect();
  const surfaceRect = categoryMenuSurface.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

  let top = triggerRect.bottom + 8;
  const surfaceHeight = surfaceRect.height || 0;
  if (top + surfaceHeight > viewportHeight - 12) {
    top = Math.max(12, triggerRect.top - surfaceHeight - 8);
  }

  let left = triggerRect.right - surfaceRect.width;
  const surfaceWidth = surfaceRect.width || 0;
  if (left < 12) {
    left = 12;
  }
  const maxLeft = viewportWidth - surfaceWidth - 12;
  if (left > maxLeft) {
    left = maxLeft;
  }

  categoryMenuSurface.style.top = `${Math.round(top)}px`;
  categoryMenuSurface.style.left = `${Math.round(left)}px`;
}

function closeCategoryMenu(options = {}) {
  if (!categoryMenu) return;
  const { returnFocus = true } = options;
  const trigger = categoryMenuTrigger;

  categoryMenu.dataset.open = 'false';
  categoryMenu.hidden = true;

  if (categoryMenuSurface) {
    categoryMenuSurface.style.top = '';
    categoryMenuSurface.style.left = '';
  }

  if (trigger) {
    trigger.setAttribute('aria-expanded', 'false');
  }

  categoryMenuTrigger = null;
  categoryMenuCategory = null;

  if (returnFocus && trigger) {
    requestAnimationFrame(() => {
      trigger.focus();
    });
  }
}

function handleCategoryMenuClick(event) {
  if (!categoryMenuSurface) return;
  const target = event.target instanceof HTMLElement
    ? event.target.closest('[data-category-action]')
    : null;
  if (!target || !categoryMenuSurface.contains(target)) return;
  event.preventDefault();
  event.stopPropagation();
  const action = target.dataset.categoryAction || '';
  handleCategoryMenuAction(action);
}

function handleCategoryMenuSurfaceKeydown(event) {
  if (!isCategoryMenuOpen()) return;
  const items = getCategoryMenuItems();
  if (items.length === 0) return;

  const activeElement = document.activeElement;
  const currentIndex = items.indexOf(activeElement);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % items.length : 0;
    items[nextIndex].focus();
    return;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    const prevIndex = currentIndex >= 0 ? (currentIndex - 1 + items.length) % items.length : items.length - 1;
    items[prevIndex].focus();
    return;
  }

  if (event.key === 'Home') {
    event.preventDefault();
    items[0].focus();
    return;
  }

  if (event.key === 'End') {
    event.preventDefault();
    items[items.length - 1].focus();
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    closeCategoryMenu();
    return;
  }

  if (event.key === 'Tab') {
    closeCategoryMenu({ returnFocus: false });
  }
}

function handleCategoryMenuFocusOut(event) {
  if (!isCategoryMenuOpen()) return;
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof HTMLElement) {
    if (categoryMenu?.contains(nextTarget)) {
      return;
    }
    if (categoryMenuTrigger && categoryMenuTrigger.contains(nextTarget)) {
      return;
    }
  }

  requestAnimationFrame(() => {
    if (!isCategoryMenuOpen()) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) {
      if (categoryMenu?.contains(focused)) {
        return;
      }
      if (categoryMenuTrigger && categoryMenuTrigger.contains(focused)) {
        return;
      }
    }
    closeCategoryMenu({ returnFocus: false });
  });
}

function handleDocumentPointerDown(event) {
  if (!isCategoryMenuOpen()) return;
  const target = event.target;
  if (target instanceof HTMLElement) {
    if (categoryMenu?.contains(target)) {
      return;
    }
    if (categoryMenuTrigger && categoryMenuTrigger.contains(target)) {
      return;
    }
  }
  closeCategoryMenu({ returnFocus: false });
}

function handleDocumentKeydown(event) {
  if (!isCategoryMenuOpen()) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCategoryMenu();
  }
}

function handleWindowResizeForMenu() {
  if (isCategoryMenuOpen()) {
    closeCategoryMenu({ returnFocus: false });
  }
}

function handleWindowScrollForMenu() {
  if (isCategoryMenuOpen()) {
    closeCategoryMenu({ returnFocus: false });
  }
}

async function handleCategoryMenuAction(action) {
  if (!categoryMenuCategory || typeof categoryMenuCategory.id !== 'string') {
    closeCategoryMenu({ returnFocus: false });
    return;
  }

  const category = categoryMenuCategory;

  if (action === 'upload') {
    const trigger = categoryMenuTrigger;
    closeCategoryMenu({ returnFocus: false });
    openUploadDialog({ category, trigger });
    return;
  }

  if (action === 'delete') {
    const trigger = categoryMenuTrigger;
    closeCategoryMenu({ returnFocus: false });
    await handleCategoryDeleteAction(category, trigger);
    return;
  }

  closeCategoryMenu({ returnFocus: false });
}

function getStorageWarningMessage() {
  if (!figureLibraryMetadata || typeof figureLibraryMetadata !== 'object') {
    return '';
  }
  const limitation = typeof figureLibraryMetadata.limitation === 'string'
    ? figureLibraryMetadata.limitation.trim()
    : '';
  return limitation;
}

function composeStatusMessage(message, includeStorageWarning = true) {
  const baseMessage = typeof message === 'string' ? message.trim() : '';
  const storageMessage = includeStorageWarning ? getStorageWarningMessage() : '';
  if (baseMessage && storageMessage) {
    return `${baseMessage}\n${storageMessage}`;
  }
  if (storageMessage) {
    return storageMessage;
  }
  return baseMessage;
}

function setStatusMessage(message, state = 'info', options = {}) {
  if (!statusEl) return;
  const shouldStoreBase = options.storeBase !== false;
  const includeStorageWarning = options.includeStorageWarning !== false;
  const baseMessage = shouldStoreBase
    ? (typeof message === 'string' ? message : '')
    : statusEl.dataset.baseMessage || '';
  if (shouldStoreBase) {
    statusEl.dataset.baseMessage = baseMessage;
  }
  statusEl.dataset.includeStorageWarning = includeStorageWarning ? 'true' : 'false';
  const finalMessage = composeStatusMessage(baseMessage, includeStorageWarning);
  statusEl.textContent = finalMessage || '';
  statusEl.dataset.state = state;
  if (state === 'error') {
    statusEl.classList.add('error');
    statusEl.classList.remove('warning');
  } else if (state === 'warning' || (includeStorageWarning && getStorageWarningMessage())) {
    statusEl.classList.remove('error');
    statusEl.classList.add('warning');
  } else {
    statusEl.classList.remove('error');
    statusEl.classList.remove('warning');
  }
}

function refreshStatusWithStorageWarning() {
  if (!statusEl) return;
  const currentState = statusEl.dataset.state || 'info';
  if (currentState === 'error') {
    return;
  }
  const baseMessage = statusEl.dataset.baseMessage || '';
  const includeStorageWarning = statusEl.dataset.includeStorageWarning !== 'false';
  const finalMessage = composeStatusMessage(baseMessage, includeStorageWarning);
  statusEl.textContent = finalMessage || '';
  if (includeStorageWarning && getStorageWarningMessage()) {
    statusEl.classList.add('warning');
    statusEl.classList.remove('error');
  } else if (currentState !== 'warning') {
    statusEl.classList.remove('warning');
  }
}

function announceStatus(message) {
  if (typeof message !== 'string') return;
  setStatusMessage(message, 'info', { includeStorageWarning: false, storeBase: false });
}

function getCategoryDisplayName(category) {
  if (!category || typeof category !== 'object') return '';
  const nameCandidates = [category.name, category.label, category.filter, category.id];
  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return '';
}

function getCategoryApps(category) {
  if (!category || typeof category !== 'object') {
    return sanitizeCategoryApps(undefined);
  }
  if (Array.isArray(category.apps) && category.apps.length) {
    return sanitizeCategoryApps(category.apps, { includeDefaults: false });
  }
  if (Array.isArray(category.categoryApps) && category.categoryApps.length) {
    return sanitizeCategoryApps(category.categoryApps, { includeDefaults: false });
  }
  return sanitizeCategoryApps(undefined);
}

function normalizeScaleLabel(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed;
}

function extractScaleLabelFromFileName(fileName) {
  if (typeof fileName !== 'string') {
    return '';
  }
  const stripped = fileName.replace(/\.[^.]*$/, '');
  let decoded = stripped;
  try {
    decoded = decodeURI(stripped);
  } catch (_) {
    decoded = stripped;
  }
  const normalized = decoded
    .replace(/[_\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return '';
  }
  const match = normalized.match(/(?:^|\D)1\s*[:xX\-_/\\]?\s*([0-9]+(?:[.,][0-9]+)?)(?:\b|$)/);
  if (!match) {
    return '';
  }
  const raw = match[1].replace(',', '.');
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return '';
  }
  const clean = Number.isInteger(parsed) ? String(parsed) : String(parsed).replace(/\.0+$/, '');
  return `1:${clean}`;
}

function isMeasurementApp(appId) {
  if (!appId) return false;
  const normalized = slugifyString(appId);
  return normalized === 'maling';
}

function shouldShowScaleLabelForApps(apps) {
  if (!Array.isArray(apps)) return false;
  return apps.some((appId) => isMeasurementApp(appId));
}

function resolveEntryFileName(entry) {
  if (!entry || typeof entry !== 'object') return '';
  if (typeof entry.fileName === 'string' && entry.fileName.trim()) {
    return entry.fileName.trim();
  }
  if (
    entry.files &&
    entry.files.svg &&
    typeof entry.files.svg.filename === 'string' &&
    entry.files.svg.filename.trim()
  ) {
    return entry.files.svg.filename.trim();
  }
  if (
    entry.files &&
    entry.files.svg &&
    typeof entry.files.svg.fileName === 'string' &&
    entry.files.svg.fileName.trim()
  ) {
    return entry.files.svg.fileName.trim();
  }
  return '';
}

function resolveScaleLabelForEntry(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const direct = normalizeScaleLabel(entry.scaleLabel || entry.scale);
  if (direct) return direct;
  const fileName = resolveEntryFileName(entry);
  if (!fileName) return '';
  return extractScaleLabelFromFileName(fileName);
}

function findCategoryByValue(rawValue) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  if (!value) return null;
  const normalizedValue = value.toLowerCase();
  const knownCategories = getKnownCategories();
  for (const category of knownCategories) {
    if (category && typeof category.id === 'string' && category.id.toLowerCase() === normalizedValue) {
      return category;
    }
  }
  for (const category of knownCategories) {
    const displayName = getCategoryDisplayName(category);
    if (displayName && displayName.toLowerCase() === normalizedValue) {
      return category;
    }
  }
  return null;
}

function normalizeCategoryMeta(category) {
  if (!category || typeof category !== 'object') return null;
  const id = typeof category.id === 'string' ? category.id : '';
  if (!id) return null;
  const type = typeof category.type === 'string' ? category.type : 'custom';
  const name = getCategoryDisplayName(category) || id;
  const description = typeof category.description === 'string' && category.description.trim()
    ? category.description.trim()
    : '';
  const sampleImage = typeof category.sampleImage === 'string' && category.sampleImage.trim()
    ? category.sampleImage.trim()
    : DEFAULT_CATEGORY_THUMBNAIL;
  const sampleAlt = category.sampleAlt || `Eksempel på ${name}`;
  const apps = getCategoryApps(category);
  const normalizedApps = Array.isArray(apps) ? apps.slice() : [];
  return {
    ...category,
    id,
    type,
    name,
    description,
    sampleImage,
    sampleAlt,
    apps: normalizedApps,
    categoryApps: normalizedApps.slice(),
  };
}

function recomputeCategories(baseCategories) {
  const baseList = Array.isArray(baseCategories) ? baseCategories : [];
  const normalizedBase = baseList
    .map(normalizeCategoryMeta)
    .filter(Boolean);

  const uniqueBase = [];
  const seenIds = new Set();
  for (const category of normalizedBase) {
    if (!category || typeof category.id !== 'string') {
      continue;
    }
    if (seenIds.has(category.id)) {
      continue;
    }
    seenIds.add(category.id);
    uniqueBase.push(category);
  }

  const customList = buildCustomCategories(uniqueBase, customEntries)
    .map(normalizeCategoryMeta)
    .filter(Boolean)
    .filter((category) => {
      if (!category || typeof category.id !== 'string') {
        return false;
      }
      if (seenIds.has(category.id)) {
        return false;
      }
      seenIds.add(category.id);
      return true;
    });

  categories = uniqueBase.concat(customList);
  renderCategories();
  updateCategorySuggestions();
  if (activeCategoryId && !categoryMetaById.has(activeCategoryId)) {
    activeCategoryId = null;
  }
}

function buildCustomCategories(baseCategories, entries) {
  if (!Array.isArray(entries) || !entries.length) {
    return [];
  }
  const baseIds = new Set();
  baseCategories.forEach((category) => {
    if (category && typeof category.id === 'string') {
      baseIds.add(category.id);
    }
  });

  const customById = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    const categoryId = typeof entry.categoryId === 'string' && entry.categoryId
      ? entry.categoryId
      : 'custom';
    if (baseIds.has(categoryId)) continue;
    const categoryName = entry.categoryName || categoryId;
    const sampleImage = entry.dataUrl || null;
    const sampleAlt = entry.name
      ? `Egendefinert figur: ${entry.name}`
      : `Egendefinert figur i kategorien ${categoryName}`;
    const entryApps = Array.isArray(entry.categoryApps) && entry.categoryApps.length
      ? sanitizeCategoryApps(entry.categoryApps, { includeDefaults: false })
      : sanitizeCategoryApps(undefined);

    if (!customById.has(categoryId)) {
      customById.set(categoryId, {
        id: categoryId,
        type: 'custom',
        name: categoryName,
        filter: categoryName,
        description: '',
        sampleImage,
        sampleAlt,
        apps: entryApps,
        categoryApps: entryApps.slice(),
      });
    } else {
      const meta = customById.get(categoryId);
      if (!meta.sampleImage && sampleImage) {
        meta.sampleImage = sampleImage;
        meta.sampleAlt = sampleAlt;
      }
      const combinedApps = Array.isArray(meta.apps) && meta.apps.length
        ? meta.apps.concat(entryApps)
        : entryApps;
      const mergedApps = sanitizeCategoryApps(combinedApps, { includeDefaults: false });
      meta.apps = mergedApps;
      meta.categoryApps = mergedApps.slice();
    }
  }

  return Array.from(customById.values()).sort((a, b) => {
    const nameA = getCategoryDisplayName(a).toLowerCase();
    const nameB = getCategoryDisplayName(b).toLowerCase();
    return nameA.localeCompare(nameB, 'nb', { sensitivity: 'base' });
  });
}

function updateCategorySuggestions() {
  if (!categorySuggestionsList) return;
  const names = new Set();
  categories.forEach((category) => {
    const displayName = getCategoryDisplayName(category);
    if (displayName) {
      names.add(displayName);
    }
  });
  const sorted = Array.from(names).sort((a, b) => a.localeCompare(b, 'nb', { sensitivity: 'base' }));
  categorySuggestionsList.innerHTML = '';
  for (const name of sorted) {
    const option = document.createElement('option');
    option.value = name;
    categorySuggestionsList.appendChild(option);
  }
}

function alignCustomEntriesWithBaseCategories(baseCategories) {
  if (!Array.isArray(baseCategories) || !baseCategories.length || !customEntries.length) {
    return;
  }
  const byId = new Map();
  const byName = new Map();
  baseCategories.forEach((category) => {
    if (!category || typeof category !== 'object') return;
    const id = typeof category.id === 'string' ? category.id : '';
    if (id) {
      byId.set(id, category);
    }
    const name = getCategoryDisplayName(category).toLowerCase();
    if (name) {
      byName.set(name, category);
    }
  });

  let updated = false;
  for (const entry of customEntries) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.categoryId && byId.has(entry.categoryId)) {
      const match = byId.get(entry.categoryId);
      const displayName = getCategoryDisplayName(match);
      if (displayName && displayName !== entry.categoryName) {
        entry.categoryName = displayName;
        updated = true;
      }
      continue;
    }
    const normalizedName = typeof entry.categoryName === 'string' ? entry.categoryName.trim().toLowerCase() : '';
    if (normalizedName && byName.has(normalizedName)) {
      const match = byName.get(normalizedName);
      const displayName = getCategoryDisplayName(match);
      if (displayName) {
        entry.categoryId = match.id;
        entry.categoryName = displayName;
        updated = true;
      }
    }
  }

  if (updated) {
    persistLocalEntriesIfNeeded();
  }
}

function handleCategoryClick(category, trigger) {
  if (!category || typeof category.id !== 'string') {
    return;
  }
  activeCategoryId = category.id;
  updateCategorySelection();
  openCategoryDialog(category.id, trigger);
}

function isCategoryDialogOpen() {
  if (!categoryDialog) return false;
  if (typeof categoryDialog.open === 'boolean') {
    return categoryDialog.open;
  }
  return categoryDialog.hasAttribute('open');
}

function openCategoryDialog(categoryId, trigger) {
  if (!categoryDialog) return;
  const alreadyOpen = isCategoryDialogOpen();
  const opened = renderCategoryDialog(categoryId);
  if (!opened) {
    return;
  }

  categoryDialogReturnFocus = trigger instanceof HTMLElement ? trigger : null;

  if (!alreadyOpen) {
    try {
      if (typeof categoryDialog.showModal === 'function') {
        categoryDialog.showModal();
      } else {
        categoryDialog.setAttribute('open', 'true');
      }
    } catch (error) {
      categoryDialog.setAttribute('open', 'true');
    }

    requestAnimationFrame(() => {
      if (categoryDialogCloseButton) {
        categoryDialogCloseButton.focus();
      }
    });
  }
}

function closeCategoryDialog(options = {}) {
  if (!categoryDialog) return;
  const { restoreFocus = true } = options;

  try {
    if (typeof categoryDialog.close === 'function') {
      categoryDialog.close();
    } else {
      categoryDialog.removeAttribute('open');
    }
  } catch (error) {
    categoryDialog.removeAttribute('open');
  }

  if (categoryDialogFigures) {
    categoryDialogFigures.innerHTML = '';
  }

  resetCategoryDialogState();
  updateCategoryDialogDeleteButtonState();
  updateCategoryDialogSelectAllButtonState({ totalCount: 0, visibleCount: 0, hasQueryFilter: false });

  if (restoreFocus && categoryDialogReturnFocus && typeof categoryDialogReturnFocus.focus === 'function') {
    categoryDialogReturnFocus.focus();
  }
  categoryDialogReturnFocus = null;
}

function resetCategoryDialogState() {
  categoryDialogState.categoryId = null;
  categoryDialogState.selectedSlugs.clear();
  categoryDialogState.categoryApps = [];
  resetCategoryAppSelection('category');
  clearCategoryAppsStatus();
  setCategoryAppsControlsDisabled(false);
  setCategoryAppsSaveState('idle');
  updateCategoryAppsSaveButtonState();
  if (categoryDialogDeleteCategoryButton) {
    categoryDialogDeleteCategoryButton.dataset.loading = 'false';
  }
  updateCategoryDialogDeleteCategoryState();
}

function renderCategoryDialog(categoryId) {
  if (!categoryDialog) return false;
  const category = categoryMetaById.get(categoryId) || null;
  if (!category) {
    return false;
  }

  if (categoryDialogState.categoryId !== category.id) {
    categoryDialogState.selectedSlugs.clear();
  }
  categoryDialogState.categoryId = category.id;

  const displayName = getCategoryDisplayName(category) || category.id || '';

  const queryValue = filterInput?.value ? filterInput.value.trim() : '';
  const normalizedQuery = queryValue.toLowerCase();
  const hasQueryFilter = normalizedQuery.length > 0;

  const allFigures = getFiguresForCategory(category.id);
  const visibleFigures = hasQueryFilter
    ? allFigures.filter((item) => item.searchText.includes(normalizedQuery))
    : allFigures;

  const availableSlugs = new Set(allFigures.map((item) => getFigureSlug(item)).filter(Boolean));
  for (const slug of Array.from(categoryDialogState.selectedSlugs)) {
    if (!availableSlugs.has(slug)) {
      categoryDialogState.selectedSlugs.delete(slug);
    }
  }

  if (categoryDialogTitle) {
    categoryDialogTitle.textContent = displayName;
  }

  if (categoryDialogDescription) {
    const descriptionText = typeof category.description === 'string' && category.description.trim()
      ? category.description.trim()
      : '';
    if (descriptionText) {
      categoryDialogDescription.textContent = descriptionText;
      categoryDialogDescription.hidden = false;
    } else {
      categoryDialogDescription.textContent = '';
      categoryDialogDescription.hidden = true;
    }
  }

  if (categoryDialogCount) {
    categoryDialogCount.textContent = buildCategoryDialogCountMessage(
      visibleFigures.length,
      allFigures.length,
      displayName,
      queryValue,
      hasQueryFilter
    );
  }

  if (categoryDialogUploadButton) {
    categoryDialogUploadButton.dataset.categoryId = category.id;
    categoryDialogUploadButton.dataset.categoryName = displayName;
  }

  const categoryApps = getCategoryApps(category);
  categoryDialogState.categoryApps = categoryApps.slice();
  setCategoryAppSelection('category', categoryApps);
  setCategoryAppsControlsDisabled(false);
  setCategoryAppsSaveState('idle');
  clearCategoryAppsStatus();
  updateCategoryAppsSaveButtonState();

  if (categoryDialogFigures) {
    categoryDialogFigures.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const item of visibleFigures) {
      const listItem = createCategoryDialogListItem(item);
      if (listItem) {
        fragment.appendChild(listItem);
      }
    }
    categoryDialogFigures.appendChild(fragment);
  }

  if (categoryDialogEmpty) {
    if (visibleFigures.length > 0) {
      categoryDialogEmpty.hidden = true;
      categoryDialogEmpty.textContent = '';
    } else {
      categoryDialogEmpty.hidden = false;
      if (allFigures.length === 0) {
        categoryDialogEmpty.textContent = `Ingen figurer er tilgjengelige i kategorien «${displayName}» ennå.`;
      } else if (hasQueryFilter) {
        categoryDialogEmpty.textContent = `Ingen figurer matcher «${queryValue}» i kategorien «${displayName}».`;
      } else {
        categoryDialogEmpty.textContent = `Ingen figurer er tilgjengelige i kategorien «${displayName}» ennå.`;
      }
    }
  }

  updateCategoryDialogSelectionIndicators();
  updateCategoryDialogDeleteButtonState();
  updateCategoryDialogDeleteCategoryState({ category, figureCount: allFigures.length });
  updateCategoryDialogSelectAllButtonState({
    totalCount: allFigures.length,
    visibleCount: visibleFigures.length,
    hasQueryFilter,
  });

  return true;
}

function areCategoryAppListsEqual(listA, listB) {
  const appsA = sanitizeCategoryApps(listA, { includeDefaults: false });
  const appsB = sanitizeCategoryApps(listB, { includeDefaults: false });
  if (appsA.length !== appsB.length) {
    return false;
  }
  for (let index = 0; index < appsA.length; index += 1) {
    if (appsA[index] !== appsB[index]) {
      return false;
    }
  }
  return true;
}

function setCategoryAppsControlsDisabled(disabled) {
  if (!(categoryDialogAppsFieldset instanceof HTMLFieldSetElement)) {
    return;
  }
  const shouldDisable = Boolean(disabled);
  categoryDialogAppsFieldset.disabled = shouldDisable;
  if (shouldDisable) {
    categoryDialogAppsFieldset.setAttribute('aria-busy', 'true');
  } else {
    categoryDialogAppsFieldset.removeAttribute('aria-busy');
  }
}

function setCategoryAppsSaveState(state) {
  if (!(categoryDialogAppsSaveButton instanceof HTMLButtonElement)) {
    return;
  }
  if (state === 'busy') {
    categoryDialogAppsSaveButton.dataset.state = 'busy';
    categoryDialogAppsSaveButton.disabled = true;
  } else {
    delete categoryDialogAppsSaveButton.dataset.state;
  }
}

function updateCategoryAppsSaveButtonState() {
  if (!(categoryDialogAppsSaveButton instanceof HTMLButtonElement)) {
    return;
  }
  if (categoryDialogAppsSaveButton.dataset.state === 'busy') {
    categoryDialogAppsSaveButton.disabled = true;
    return;
  }
  const original = categoryDialogState.categoryApps || [];
  const selection = getSelectedCategoryApps('category');
  const hasChange = !areCategoryAppListsEqual(selection, original);
  categoryDialogAppsSaveButton.disabled = !hasChange;
}

function clearCategoryAppsStatus() {
  if (!categoryDialogAppsStatus) {
    return;
  }
  categoryDialogAppsStatus.textContent = '';
  categoryDialogAppsStatus.hidden = true;
  delete categoryDialogAppsStatus.dataset.state;
}

function showCategoryAppsStatus(message, state = 'info') {
  if (!categoryDialogAppsStatus) {
    return;
  }
  categoryDialogAppsStatus.textContent = message;
  categoryDialogAppsStatus.hidden = false;
  categoryDialogAppsStatus.dataset.state = state;
}

function handleCategoryAppsSelectionChange() {
  clearCategoryAppsStatus();
  updateCategoryAppsSaveButtonState();
}

function applyCategoryAppUpdateLocal(categoryId, apps) {
  if (typeof categoryId !== 'string' || !categoryId.trim()) {
    return;
  }
  const normalized = sanitizeCategoryApps(apps, { includeDefaults: false });
  const id = categoryId.trim();

  if (categoryMetaById.has(id)) {
    const meta = categoryMetaById.get(id);
    if (meta && typeof meta === 'object') {
      meta.apps = normalized.slice();
      meta.categoryApps = normalized.slice();
      categoryMetaById.set(id, meta);
    }
  }

  if (customCategoryMap.has(id)) {
    const entry = customCategoryMap.get(id);
    if (entry && typeof entry === 'object') {
      const updated = { ...entry, apps: normalized.slice(), categoryApps: normalized.slice() };
      customCategoryMap.set(id, updated);
      for (let index = 0; index < customCategories.length; index += 1) {
        if (customCategories[index]?.id === id) {
          customCategories[index] = updated;
          break;
        }
      }
    }
  }
}

async function handleCategoryAppsSaveClick() {
  if (!categoryDialogState.categoryId) {
    return;
  }

  const categoryId = categoryDialogState.categoryId;
  const selection = getSelectedCategoryApps('category');
  const normalizedSelection = sanitizeCategoryApps(selection, { includeDefaults: false });

  if (areCategoryAppListsEqual(normalizedSelection, categoryDialogState.categoryApps)) {
    showCategoryAppsStatus('Ingen endringer å lagre.', 'info');
    updateCategoryAppsSaveButtonState();
    return;
  }

  clearCategoryAppsStatus();
  setCategoryAppsSaveState('busy');
  setCategoryAppsControlsDisabled(true);

  try {
    const { data, response } = await fetchFigureLibrary('POST', {
      categoryId,
      categoryApps: normalizedSelection,
    });
    applyFigureLibraryMetadata(data, response);
    if (Array.isArray(data.categories)) {
      applyServerCategories(data.categories);
    } else {
      applyCategoryAppUpdateLocal(categoryId, normalizedSelection);
    }
    saveCustomCategories();
    categoryDialogState.categoryApps = normalizedSelection.slice();
    refreshLibrary({ maintainFilter: true });
    renderCategoryDialog(categoryId);
    showCategoryAppsStatus('Tilgjengelighet oppdatert.', 'success');
  } catch (error) {
    console.error('Kunne ikke oppdatere kategoriapper', error);
    if (isFigureLibraryUnavailableError(error)) {
      const fallbackMetadata = {
        storageMode: 'memory',
        persistent: false,
        limitation: LOCAL_ONLY_LIMITATION,
      };
      applyFigureLibraryMetadata(fallbackMetadata);
      applyCategoryAppUpdateLocal(categoryId, normalizedSelection);
      saveCustomCategories();
      categoryDialogState.categoryApps = normalizedSelection.slice();
      refreshLibrary({ maintainFilter: true });
      renderCategoryDialog(categoryId);
      showCategoryAppsStatus(
        'Tilgjengelighet ble lagret lokalt fordi figurbibliotekets API ikke er tilgjengelig.',
        'warning'
      );
      return;
    }
    const message = extractApiErrorMessage(error, 'Kunne ikke oppdatere app-tilgjengeligheten. Prøv igjen.');
    showCategoryAppsStatus(message, 'error');
    setCategoryAppSelection('category', categoryDialogState.categoryApps);
  } finally {
    setCategoryAppsControlsDisabled(false);
    setCategoryAppsSaveState('idle');
    updateCategoryAppsSaveButtonState();
  }
}

function createCategoryDialogListItem(item) {
  if (!item || typeof item !== 'object') return null;
  const slug = getFigureSlug(item);
  if (!slug) return null;
  const name = typeof item.data?.name === 'string' && item.data.name.trim() ? item.data.name.trim() : slug;
  const entryId = typeof item.data?.entryId === 'string' && item.data.entryId.trim()
    ? item.data.entryId.trim()
    : '';

  const li = document.createElement('li');
  li.className = 'categoryDialog__item';
  li.dataset.categoryItem = 'true';
  li.dataset.slug = slug;
  li.dataset.name = name;
  if (item.data?.custom) {
    li.dataset.custom = 'true';
  }
  if (entryId) {
    li.dataset.entryId = entryId;
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'categoryDialog__toggle';
  toggle.dataset.categoryToggle = 'true';

  const isSelected = categoryDialogState.selectedSlugs.has(slug);
  toggle.setAttribute('aria-pressed', isSelected ? 'true' : 'false');

  const label = document.createElement('span');
  label.className = 'visuallyHidden';
  label.dataset.categoryToggleLabel = 'true';
  label.textContent = buildCategoryToggleLabel(name, isSelected);
  toggle.appendChild(label);

  const preview = document.createElement('span');
  preview.className = 'categoryDialog__preview';
  const img = document.createElement('img');
  const path = typeof item.path === 'string' && item.path ? item.path : item.data?.path || '';
  if (path) {
    img.src = path;
  }
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  preview.appendChild(img);
  toggle.appendChild(preview);

  const indicator = document.createElement('span');
  indicator.className = 'categoryDialog__indicator';
  indicator.setAttribute('aria-hidden', 'true');
  indicator.textContent = '✓';
  toggle.appendChild(indicator);

  li.appendChild(toggle);

  const nameContainer = document.createElement('div');
  nameContainer.className = 'categoryDialog__name';

  if (item.data?.custom) {
    const nameButton = document.createElement('button');
    nameButton.type = 'button';
    nameButton.className = 'categoryDialog__nameButton';
    nameButton.dataset.categoryNameEdit = 'true';
    nameButton.textContent = name;
    nameButton.title = 'Rediger navn';
    nameContainer.appendChild(nameButton);
  } else {
    const nameLabel = document.createElement('p');
    nameLabel.className = 'categoryDialog__nameLabel';
    nameLabel.textContent = name;
    nameContainer.appendChild(nameLabel);
  }

  li.appendChild(nameContainer);
  return li;
}

function buildCategoryToggleLabel(name, selected) {
  const resolvedName = name || 'figuren';
  return selected
    ? `Fjern «${resolvedName}» fra utvalget`
    : `Velg «${resolvedName}»`;
}

function updateCategoryDialogSelectionIndicators(target) {
  if (!categoryDialogFigures) return;
  const items = target
    ? [target]
    : Array.from(categoryDialogFigures.querySelectorAll('[data-category-item]'));
  for (const item of items) {
    if (!item) continue;
    const slug = item.dataset.slug || '';
    const selected = slug && categoryDialogState.selectedSlugs.has(slug);
    item.dataset.selected = selected ? 'true' : 'false';
    const toggle = item.querySelector('[data-category-toggle]');
    if (toggle) {
      toggle.setAttribute('aria-pressed', selected ? 'true' : 'false');
      const label = toggle.querySelector('[data-category-toggle-label]');
      if (label) {
        const figureName = item.dataset.name || '';
        label.textContent = buildCategoryToggleLabel(figureName, selected);
      }
    }
  }
}

function updateCategoryDialogDeleteButtonState() {
  if (!categoryDialogDeleteButton) return;
  const isBusy = categoryDialogDeleteButton.dataset.loading === 'true';
  const selectionCount = categoryDialogState.selectedSlugs.size;
  const disabled = selectionCount === 0 || isBusy;
  categoryDialogDeleteButton.disabled = disabled;
  categoryDialogDeleteButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  const label = selectionCount === 0
    ? 'Slett figur(er)'
    : selectionCount === 1
      ? 'Slett figur'
      : 'Slett figurer';
  categoryDialogDeleteButton.textContent = label;
}

function updateCategoryDialogDeleteCategoryState(context = {}) {
  if (!(categoryDialogDeleteCategoryButton instanceof HTMLButtonElement)) {
    return;
  }

  const hasLoadingState = categoryDialogDeleteCategoryButton.dataset.loading === 'true';
  if (hasLoadingState) {
    categoryDialogDeleteCategoryButton.disabled = true;
    categoryDialogDeleteCategoryButton.setAttribute('aria-disabled', 'true');
    return;
  }

  let category = null;
  if (context && typeof context === 'object' && context.category) {
    category = context.category;
  }
  if (!category && categoryDialogState.categoryId) {
    category = categoryMetaById.get(categoryDialogState.categoryId) || null;
  }

  const providedCount = context && typeof context.figureCount === 'number'
    ? context.figureCount
    : null;

  let figureCount = providedCount;
  if (figureCount == null && category && typeof category.id === 'string') {
    const figures = getFiguresForCategory(category.id);
    figureCount = Array.isArray(figures) ? figures.length : 0;
  }

  const canDeleteCategory = Boolean(category) && isCategoryDeletable(category) && figureCount === 0;

  if (canDeleteCategory) {
    const categoryId = category.id || '';
    const categoryName = getCategoryDisplayName(category) || categoryId;
    categoryDialogDeleteCategoryButton.hidden = false;
    categoryDialogDeleteCategoryButton.disabled = false;
    categoryDialogDeleteCategoryButton.setAttribute('aria-disabled', 'false');
    categoryDialogDeleteCategoryButton.dataset.categoryId = categoryId;
    categoryDialogDeleteCategoryButton.dataset.categoryName = categoryName;
  } else {
    categoryDialogDeleteCategoryButton.hidden = true;
    categoryDialogDeleteCategoryButton.disabled = true;
    categoryDialogDeleteCategoryButton.setAttribute('aria-disabled', 'true');
    delete categoryDialogDeleteCategoryButton.dataset.categoryId;
    delete categoryDialogDeleteCategoryButton.dataset.categoryName;
  }
}

function updateCategoryDialogSelectAllButtonState(context) {
  if (!(categoryDialogSelectAllButton instanceof HTMLButtonElement)) {
    return;
  }

  const categoryId = categoryDialogState.categoryId || '';
  const deleteBusy = categoryDialogDeleteButton?.dataset.loading === 'true';

  let totalCount = 0;
  let visibleCount = 0;
  let hasQueryFilter = false;

  if (context && typeof context === 'object') {
    totalCount = typeof context.totalCount === 'number' ? context.totalCount : 0;
    visibleCount = typeof context.visibleCount === 'number' ? context.visibleCount : 0;
    hasQueryFilter = Boolean(context.hasQueryFilter);
  } else if (categoryId) {
    const allFigures = getFiguresForCategory(categoryId);
    totalCount = Array.isArray(allFigures) ? allFigures.length : 0;
    const queryValue = filterInput?.value ? filterInput.value.trim() : '';
    const normalizedQuery = queryValue.toLowerCase();
    hasQueryFilter = normalizedQuery.length > 0;
    if (hasQueryFilter) {
      visibleCount = Array.isArray(allFigures)
        ? allFigures.filter((item) => item?.searchText?.includes?.(normalizedQuery)).length
        : 0;
    } else {
      visibleCount = totalCount;
    }
  }

  const selectionCount = categoryDialogState.selectedSlugs.size;
  const allSelected = totalCount > 0 && selectionCount === totalCount;
  const hasSelection = selectionCount > 0;
  const isSelectMode = !allSelected;

  const disabled = deleteBusy
    || totalCount === 0
    || (isSelectMode && hasQueryFilter)
    || (isSelectMode && visibleCount === 0 && !hasSelection);

  categoryDialogSelectAllButton.disabled = disabled;
  categoryDialogSelectAllButton.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  categoryDialogSelectAllButton.dataset.mode = isSelectMode ? 'select' : 'clear';

  const selectLabelText = categoryDialogSelectAllButton.dataset.selectLabel || 'Velg alle figurer';
  const clearLabelText = categoryDialogSelectAllButton.dataset.clearLabel || 'Fjern alle figurer';
  const activeLabel = isSelectMode ? selectLabelText : clearLabelText;

  if (categoryDialogSelectAllLabel) {
    categoryDialogSelectAllLabel.textContent = activeLabel;
  } else {
    categoryDialogSelectAllButton.textContent = activeLabel;
  }

  categoryDialogSelectAllButton.setAttribute('aria-label', activeLabel);
}

function toggleCategoryFigureSelection(slug, itemElement) {
  if (categoryDialogDeleteButton?.dataset.loading === 'true') {
    return;
  }
  const normalizedSlug = typeof slug === 'string' ? slug.trim() : '';
  if (!normalizedSlug) {
    return;
  }

  if (categoryDialogState.selectedSlugs.has(normalizedSlug)) {
    categoryDialogState.selectedSlugs.delete(normalizedSlug);
  } else {
    categoryDialogState.selectedSlugs.add(normalizedSlug);
  }

  const target = itemElement || null;
  if (target) {
    updateCategoryDialogSelectionIndicators(target);
  } else {
    updateCategoryDialogSelectionIndicators();
  }
  updateCategoryDialogDeleteButtonState();
  updateCategoryDialogSelectAllButtonState();
}

function handleCategoryDialogFigureClick(event) {
  if (!categoryDialogFigures) return;
  const editButton = event.target?.closest?.('[data-category-name-edit]');
  if (editButton && categoryDialogFigures.contains(editButton)) {
    event.preventDefault();
    const item = editButton.closest('[data-category-item]');
    if (!item) return;
    if (item.dataset.custom !== 'true') return;
    const entryId = item.dataset.entryId || item.dataset.slug || '';
    if (entryId) {
      openCustomEditor(entryId, editButton);
    }
    return;
  }
  const toggle = event.target?.closest?.('[data-category-toggle]');
  if (!toggle || !categoryDialogFigures.contains(toggle)) {
    return;
  }
  event.preventDefault();
  const item = toggle.closest('[data-category-item]');
  if (!item) return;
  const slug = item.dataset.slug || '';
  toggleCategoryFigureSelection(slug, item);
}

function handleCategorySelectAllClick(event) {
  if (!(categoryDialogSelectAllButton instanceof HTMLButtonElement)) {
    return;
  }

  event.preventDefault();

  if (categoryDialogSelectAllButton.disabled) {
    return;
  }

  const categoryId = categoryDialogState.categoryId || '';
  if (!categoryId) {
    return;
  }

  const mode = categoryDialogSelectAllButton.dataset.mode === 'clear' ? 'clear' : 'select';
  const figures = getFiguresForCategory(categoryId);
  const slugs = Array.isArray(figures)
    ? figures.map((item) => getFigureSlug(item)).filter((slug) => typeof slug === 'string' && slug)
    : [];

  if (mode === 'select') {
    categoryDialogState.selectedSlugs.clear();
    for (const slug of slugs) {
      categoryDialogState.selectedSlugs.add(slug);
    }
  } else {
    categoryDialogState.selectedSlugs.clear();
  }

  updateCategoryDialogSelectionIndicators();
  updateCategoryDialogDeleteButtonState();
  updateCategoryDialogSelectAllButtonState();
}

async function handleCategoryDeleteClick(event) {
  event.preventDefault();
  if (!categoryDialogDeleteButton) return;
  const slugs = Array.from(categoryDialogState.selectedSlugs);
  if (!slugs.length) {
    showUploadStatus('Velg minst én figur å slette.', 'error', { duration: 5000 });
    return;
  }

  categoryDialogDeleteButton.dataset.loading = 'true';
  updateCategoryDialogDeleteButtonState();
  updateCategoryDialogSelectAllButtonState();

  try {
    const { deleted = [], failed = [] } = await deleteFigureEntries(slugs);
    for (const slug of deleted) {
      if (typeof slug === 'string') {
        categoryDialogState.selectedSlugs.delete(slug.trim());
      }
    }
    if (!failed.length) {
      categoryDialogState.selectedSlugs.clear();
    }
  } finally {
    categoryDialogDeleteButton.dataset.loading = 'false';
    updateCategoryDialogSelectionIndicators();
    updateCategoryDialogDeleteButtonState();
    updateCategoryDialogSelectAllButtonState();
  }
}

async function handleCategoryDialogDeleteCategoryClick(event) {
  event.preventDefault();
  if (!(categoryDialogDeleteCategoryButton instanceof HTMLButtonElement)) {
    return;
  }

  const categoryId = categoryDialogState.categoryId || '';
  if (!categoryId) {
    return;
  }
  const category = categoryMetaById.get(categoryId) || null;
  if (!category) {
    return;
  }

  categoryDialogDeleteCategoryButton.dataset.loading = 'true';
  updateCategoryDialogDeleteCategoryState();

  try {
    const success = await handleCategoryDeleteAction(category, categoryDialogDeleteCategoryButton);
    if (success) {
      closeCategoryDialog({ restoreFocus: false });
    }
  } finally {
    categoryDialogDeleteCategoryButton.dataset.loading = 'false';
    if (isCategoryDialogOpen()) {
      updateCategoryDialogDeleteCategoryState({ category });
    } else {
      updateCategoryDialogDeleteCategoryState();
    }
  }
}

async function handleCategoryDeleteAction(category, trigger) {
  if (!category || typeof category.id !== 'string') {
    return false;
  }
  const categoryId = category.id.trim();
  if (!categoryId) {
    return false;
  }

  if (!isCategoryDeletable(category)) {
    const message = `Kategorien «${getCategoryDisplayName(category) || categoryId}» kan ikke slettes.`;
    setStatusMessage(message, 'error', { includeStorageWarning: false });
    announceStatus(message);
    return false;
  }

  const figures = getFiguresForCategory(categoryId);
  const figureCount = Array.isArray(figures) ? figures.length : 0;
  if (figureCount > 0) {
    const countLabel = formatFigureCount(figureCount);
    const displayName = getCategoryDisplayName(category) || categoryId;
    const message = figureCount === 1
      ? `Kan ikke slette kategorien «${displayName}». Fjern figuren først.`
      : `Kan ikke slette kategorien «${displayName}». Fjern ${countLabel} først.`;
    setStatusMessage(message, 'error', { includeStorageWarning: false });
    showUploadStatus(message, 'error', { duration: 6000 });
    announceStatus(message);
    return false;
  }

  const displayName = getCategoryDisplayName(category) || categoryId;
  const confirmationMessage = `Vil du slette kategorien «${displayName}»? Dette kan ikke angres.`;
  let confirmed = true;
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    confirmed = window.confirm(confirmationMessage);
  }
  if (!confirmed) {
    announceStatus(`Avbrøt sletting av kategorien «${displayName}».`);
    return false;
  }

  let focusTarget = trigger instanceof HTMLElement ? trigger : null;
  try {
    showUploadStatus('Sletter kategori …', 'pending');
    await deleteCategoryFromLibrary(category);
    refreshLibrary({ maintainFilter: true });
    const successMessage = `Kategorien «${displayName}» ble slettet.`;
    setStatusMessage(successMessage, 'info', { includeStorageWarning: false });
    showUploadStatus(successMessage, 'success', { duration: 5000 });
    announceStatus(successMessage);

    if (!focusTarget || !document.contains(focusTarget)) {
      focusTarget = null;
      for (const entry of categoryButtons.values()) {
        if (entry?.button) {
          focusTarget = entry.button;
          break;
        }
      }
      if (!focusTarget && addCategoryToggleButton instanceof HTMLElement) {
        focusTarget = addCategoryToggleButton;
      }
    }

    if (focusTarget) {
      const target = focusTarget;
      requestAnimationFrame(() => {
        if (target && typeof target.focus === 'function') {
          target.focus();
        }
      });
    }
    return true;
  } catch (error) {
    console.error('Kunne ikke slette kategori', error);
    const message = extractApiErrorMessage(error, `Kunne ikke slette kategorien «${displayName}».`);
    setStatusMessage(message, 'error', { includeStorageWarning: false });
    showUploadStatus(message, 'error', { duration: 6000 });
    announceStatus(message);
  }
  return false;
}

function updateCategorySelection() {
  for (const { button, category } of categoryButtons.values()) {
    const isSelected = category.id === activeCategoryId;
    button.dataset.selected = isSelected ? 'true' : 'false';
    button.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  }
}

function updateCategoryCounts(options = {}) {
  const normalizedQuery = typeof options.query === 'string' ? options.query.trim().toLowerCase() : '';
  const hasQueryFilter = Boolean(normalizedQuery);

  for (const { countEl, category } of categoryButtons.values()) {
    const figures = getFiguresForCategory(category.id);
    const matchCount = hasQueryFilter
      ? figures.filter((item) => item.searchText.includes(normalizedQuery)).length
      : figures.length;
    if (countEl) {
      countEl.textContent = formatFigureCount(matchCount);
    }
  }
}

function updateCategoryVisibility(normalizedQuery, hasQueryFilter) {
  const query = typeof normalizedQuery === 'string' ? normalizedQuery : '';
  for (const { category, listItem } of categoryButtons.values()) {
    if (!listItem) continue;
    let shouldShow = true;
    if (hasQueryFilter) {
      const name = getCategoryDisplayName(category).toLowerCase();
      const description = typeof category.description === 'string' ? category.description.toLowerCase() : '';
      const figures = getFiguresForCategory(category.id);
      const matchesFigures = figures.some((item) => item.searchText.includes(query));
      shouldShow = Boolean(name.includes(query) || description.includes(query) || matchesFigures);
    }
    listItem.hidden = !shouldShow;
  }
}

function prepareFigureItems(entries = []) {
  if (observer && Array.isArray(figureItems) && figureItems.length) {
    for (const item of figureItems) {
      if (item?.image) {
        try {
          observer.unobserve(item.image);
        } catch (error) {}
      }
    }
  }

  figuresByCategory.clear();
  const combinedEntries = Array.isArray(entries) ? entries : [];
  figureItems = combinedEntries
    .map((entry) => createFigureItem(entry))
    .filter(Boolean);

  for (const item of figureItems) {
    const key = getCategoryKey(item.data.categoryId);
    if (!figuresByCategory.has(key)) {
      figuresByCategory.set(key, []);
    }
    figuresByCategory.get(key).push(item);
  }
}

function createFigureItem(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const { slug, id, name, summary, categoryId, categoryName, type, custom, entryId } = entry;
  const assetUrl = typeof entry.assetUrl === 'string' && entry.assetUrl.trim() ? entry.assetUrl.trim() : '';
  const dataUrl = typeof entry.dataUrl === 'string' && entry.dataUrl.trim() ? entry.dataUrl.trim() : '';
  const resolvedPath = assetUrl || dataUrl;
  if (!resolvedPath) {
    return null;
  }
  const isInlineAsset = resolvedPath.startsWith('data:');
  const displayPath = resolvedPath;
  const searchTokens = [
    slug,
    id,
    name,
    summary,
    assetUrl,
    dataUrl,
    displayPath,
    categoryName,
    categoryId ? `category:${categoryId}` : null,
    type ? `type:${type}` : null,
  ];
  const searchText = searchTokens
    .filter((token) => typeof token === 'string' && token.trim().length > 0)
    .join(' ')
    .toLowerCase();

  const li = document.createElement('li');
  li.className = 'bibliotekItem';
  li.dataset.slug = slug || id;
  li.dataset.categoryId = categoryId || '';
  li.dataset.type = type || '';
  li.dataset.search = searchText;
  const isEditable = Boolean(custom);
  li.dataset.custom = isEditable ? 'true' : 'false';
  if (isEditable && entryId) {
    li.dataset.customId = entryId;
  }

  const figure = document.createElement('figure');
  figure.className = 'bibliotekFigure';
  figure.dataset.loading = 'true';

  const img = document.createElement('img');
  const altLabel = name || slug || id || 'Figur';
  img.alt = altLabel;
  if (isInlineAsset) {
    img.src = displayPath;
  } else {
    img.dataset.src = displayPath;
  }
  img.loading = 'lazy';
  img.decoding = 'async';
  img.width = 400;
  img.height = 400;
  img.addEventListener('load', () => {
    figure.dataset.loading = 'false';
  });
  img.addEventListener('error', () => {
    figure.dataset.loading = 'false';
    figure.dataset.error = 'true';
  });
  figure.appendChild(img);
  if (!isInlineAsset && observer) {
    observer.observe(img);
  } else if (!isInlineAsset) {
    img.src = displayPath;
    img.removeAttribute('data-src');
  }

  const meta = document.createElement('div');
  meta.className = 'bibliotekMeta';

  const header = document.createElement('div');
  header.className = 'bibliotekHeader';

  const title = document.createElement('h2');
  title.textContent = name || slug || displayPath;
  header.appendChild(title);

  const actions = document.createElement('div');
  actions.className = 'bibliotekActions';

  const copyButton = document.createElement('button');
  copyButton.type = 'button';
  copyButton.dataset.path = displayPath;
  copyButton.textContent = 'Kopier sti';
  copyButton.setAttribute('aria-label', `Kopier ${displayPath}`);
  copyButton.title = `Kopier ${displayPath}`;
  copyButton.addEventListener('click', handleCopyClick);
  actions.appendChild(copyButton);

  const openLink = document.createElement('a');
  openLink.href = displayPath;
  openLink.target = '_blank';
  openLink.rel = 'noreferrer noopener';
  openLink.textContent = 'Vis SVG';
  openLink.setAttribute('aria-label', `Vis ${displayPath} i en ny fane`);
  openLink.title = `Åpne ${displayPath}`;
  if (isInlineAsset) {
    openLink.download = `${slug || id || 'figur'}.svg`;
  }
  actions.appendChild(openLink);

  if (isEditable) {
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Rediger';
    editButton.dataset.customEdit = entryId || id || slug || '';
    editButton.addEventListener('click', () => openCustomEditor(entryId || id || slug || '', editButton));
    actions.appendChild(editButton);
  }

  header.appendChild(actions);
  meta.appendChild(header);

  if (summary) {
    const summaryEl = document.createElement('p');
    summaryEl.className = 'bibliotekSummary';
    summaryEl.textContent = summary;
    meta.appendChild(summaryEl);
  }

  const pathEl = document.createElement('div');
  pathEl.className = 'bibliotekPath';
  pathEl.textContent = displayPath;
  pathEl.setAttribute('aria-label', `Filsti ${displayPath}`);
  meta.appendChild(pathEl);

  const feedback = document.createElement('p');
  feedback.className = 'copyFeedback';
  feedback.dataset.feedback = '';
  feedback.hidden = true;
  feedback.setAttribute('aria-live', 'polite');
  meta.appendChild(feedback);

  li.appendChild(figure);
  li.appendChild(meta);

  return {
    data: {
      ...entry,
      path: displayPath,
      searchText,
    },
    path: displayPath,
    searchText,
    element: li,
    image: img,
  };
}

function getFigureSlug(item) {
  if (!item || typeof item !== 'object') return '';
  const data = item.data || {};
  if (typeof data.slug === 'string' && data.slug.trim()) {
    return data.slug.trim();
  }
  if (typeof data.id === 'string' && data.id.trim()) {
    return data.id.trim();
  }
  if (typeof item.path === 'string' && item.path.trim()) {
    return item.path.trim();
  }
  return '';
}

function getCategoryKey(categoryId) {
  const value = typeof categoryId === 'string' ? categoryId.trim() : '';
  return value || UNCATEGORIZED_KEY;
}

function getFiguresForCategory(categoryId) {
  const key = getCategoryKey(categoryId);
  return figuresByCategory.get(key) || [];
}

function formatFigureCount(count) {
  return count === 1 ? '1 figur' : `${count} figurer`;
}

function buildCategoryDialogCountMessage(visible, total, categoryName, query, hasQueryFilter) {
  const name = categoryName || '';
  if (total === 0) {
    return `Ingen figurer i kategorien «${name}» ennå.`;
  }
  if (hasQueryFilter) {
    const visibleLabel = formatFigureCount(visible);
    return `Viser ${visibleLabel} av ${total} i kategorien «${name}» for søket «${query}».`;
  }
  const totalLabel = formatFigureCount(total);
  return `Viser ${totalLabel} i kategorien «${name}».`;
}

function handleIntersection(entries, obs) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const img = entry.target;
    const src = img.dataset.src;
    if (src) {
      img.src = src;
      img.removeAttribute('data-src');
    }
    obs.unobserve(img);
  }
}

function handleCategorySortChange(event) {
  const value = typeof event?.target?.value === 'string' ? event.target.value : 'default';
  categorySortOrder = value === 'alphabetical' ? 'alphabetical' : 'default';
  renderCategories();
  updateCategorySelection();
  applyFilter();
}

function handleFilterInput(event) {
  const query = event.target.value || '';
  if (!isCategoryDialogOpen()) {
    activeCategoryId = null;
    updateCategorySelection();
  }
  applyFilter(query);
}

function applyFilter(rawQuery) {
  const querySource = typeof rawQuery === 'string' ? rawQuery : filterInput?.value || '';
  const trimmedQuery = querySource.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();
  const hasQueryFilter = normalizedQuery.length > 0;

  const visibleItems = hasQueryFilter
    ? figureItems.filter((item) => item.searchText.includes(normalizedQuery))
    : figureItems.slice();

  const total = figureItems.length;
  const visible = visibleItems.length;

  updateCount(visible, total, trimmedQuery, hasQueryFilter);
  updateStatus(visible, total, trimmedQuery, hasQueryFilter);
  updateCategoryCounts({ query: normalizedQuery });
  updateCategoryVisibility(normalizedQuery, hasQueryFilter);
  updateHelperState(total > 0);

  if (isCategoryDialogOpen() && activeCategoryId) {
    renderCategoryDialog(activeCategoryId);
  }
}

function updateCount(visible, total, query, hasQueryFilter) {
  if (!countEl) return;
  if (total === 0) {
    countEl.textContent = getEmptyLibraryMessage();
    return;
  }

  if (!hasQueryFilter) {
    countEl.textContent = total === 1 ? '1 figur tilgjengelig.' : `${total} figurer tilgjengelig.`;
    return;
  }

  const visibleLabel = formatFigureCount(visible);
  countEl.textContent = `Fant ${visibleLabel} av totalt ${total} for søket «${query}».`;
}

function updateStatus(visible, total, query, hasQueryFilter) {
  if (!statusEl) return;
  if (statusEl.dataset.state === 'error') {
    return;
  }
  if (total === 0) {
    setStatusMessage(getEmptyLibraryMessage(), 'info');
    return;
  }

  if (hasQueryFilter) {
    setStatusMessage(`Fant ${visible} av ${total} figurer for søket «${query}». Velg en kategori for å se resultatene.`, 'info');
    return;
  }

  setStatusMessage(`Totalt ${total} figurer tilgjengelig. Velg en kategori for å se detaljene.`, 'info');
}

function getEmptyLibraryMessage() {
  const storageMode = normalizeStorageMode(figureLibraryMetadata?.storageMode);
  const hasServerCategories = customCategories.some((category) => {
    if (!category || typeof category !== 'object') return false;
    const origin = typeof category.origin === 'string' ? category.origin.trim().toLowerCase() : '';
    return origin === 'server' || origin === 'kv';
  });
  if (!hasServerCategories && customEntries.length === 0) {
    if (storageMode === 'memory') {
      return 'Biblioteket er tomt. Backend er ikke seedet ennå, så last opp figurer eller be en administrator om å konfigurere lagringen.';
    }
    return 'Biblioteket er tomt. Backend er ikke seedet ennå, så last opp figurer eller be en administrator om å fylle biblioteket.';
  }
  return 'Biblioteket er tomt. Last opp en figur for å komme i gang.';
}

function updateHelperState(hasItems) {
  if (!helperEl) return;
  helperEl.hidden = false;
  if (hasItems) {
    helperEl.textContent = 'Velg en kategori for å åpne detaljvisningen med figurene i biblioteket.';
  } else {
    helperEl.textContent = getEmptyLibraryMessage();
  }
}

function setupAddCategoryForm() {
  if (!addCategoryToggleButton) return;

  if (addCategoryForm) {
    const formId = addCategoryForm.id || 'category-add-form';
    addCategoryForm.id = formId;
    addCategoryToggleButton.setAttribute('aria-controls', formId);
    addCategoryToggleButton.setAttribute('aria-expanded', addCategoryForm.hasAttribute('hidden') ? 'false' : 'true');
    addCategoryForm.addEventListener('submit', handleAddCategorySubmit);
    addCategoryForm.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        hideAddCategoryForm({ resetInput: true });
        addCategoryToggleButton.focus();
      }
    });
  } else {
    addCategoryToggleButton.setAttribute('aria-expanded', 'false');
  }

  addCategoryToggleButton.addEventListener('click', () => {
    if (!addCategoryForm) return;
    const isHidden = addCategoryForm.hasAttribute('hidden');
    if (isHidden) {
      showAddCategoryForm();
    } else {
      hideAddCategoryForm({ resetInput: true });
    }
  });

  if (addCategoryCancelButton) {
    addCategoryCancelButton.addEventListener('click', () => {
      hideAddCategoryForm({ resetInput: true });
      addCategoryToggleButton.focus();
    });
  }

  if (addCategoryInput) {
    addCategoryInput.addEventListener('input', () => {
      if (addCategoryFeedback?.dataset.state === 'error') {
        clearAddCategoryFeedback();
      }
    });
  }

  if (addCategoryForm && !addCategoryForm.hasAttribute('hidden')) {
    hideAddCategoryForm({ resetInput: false, clearFeedback: true });
  }
}

function showAddCategoryForm() {
  if (!addCategoryForm) return;
  addCategoryForm.removeAttribute('hidden');
  addCategoryToggleButton?.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    if (addCategoryInput) {
      addCategoryInput.focus();
      addCategoryInput.select();
    }
  });
}

function hideAddCategoryForm(options = {}) {
  if (!addCategoryForm) return;
  const { resetInput = false, clearFeedback = true } = options;
  addCategoryForm.setAttribute('hidden', '');
  addCategoryToggleButton?.setAttribute('aria-expanded', 'false');
  if (resetInput && addCategoryInput) {
    addCategoryInput.value = '';
  }
  if (clearFeedback) {
    clearAddCategoryFeedback();
  }
}

function handleAddCategorySubmit(event) {
  event.preventDefault();
  if (!addCategoryInput) {
    return;
  }

  clearAddCategoryFeedback();

  const rawName = addCategoryInput.value || '';
  const trimmedName = rawName.trim();
  if (!trimmedName) {
    showAddCategoryFeedback('Skriv inn et kategorinavn.', { isError: true });
    addCategoryInput.focus();
    return;
  }

  if (trimmedName.length < 2) {
    showAddCategoryFeedback('Kategorinavnet må bestå av minst to tegn.', { isError: true });
    addCategoryInput.focus();
    return;
  }

  if (isCategoryNameTaken(trimmedName)) {
    showAddCategoryFeedback('Denne kategorien finnes allerede.', { isError: true });
    addCategoryInput.select();
    return;
  }

  const newCategory = createCustomCategoryFromName(trimmedName);
  if (!newCategory) {
    showAddCategoryFeedback('Kunne ikke legge til kategorien. Prøv igjen.', { isError: true });
    return;
  }

  customCategories.push(newCategory);
  customCategoryMap.set(newCategory.id, newCategory);
  saveCustomCategories();

  refreshLibrary();

  showAddCategoryFeedback(`La til kategorien «${newCategory.name}».`);
  hideAddCategoryForm({ resetInput: true, clearFeedback: false });

  requestAnimationFrame(() => {
    const entry = categoryButtons.get(newCategory.id);
    if (entry?.button) {
      entry.button.focus();
      entry.button.scrollIntoView({ block: 'nearest' });
    }
  });
}

function showAddCategoryFeedback(message, options = {}) {
  if (!addCategoryFeedback) return;
  const { isError = false } = options;
  if (addCategoryFeedbackTimer) {
    clearTimeout(addCategoryFeedbackTimer);
    addCategoryFeedbackTimer = null;
  }
  addCategoryFeedback.textContent = message;
  addCategoryFeedback.hidden = false;
  addCategoryFeedback.dataset.state = isError ? 'error' : 'success';
  if (!isError) {
    addCategoryFeedbackTimer = setTimeout(() => {
      clearAddCategoryFeedback();
    }, 4000);
  }
}

function clearAddCategoryFeedback() {
  if (addCategoryFeedbackTimer) {
    clearTimeout(addCategoryFeedbackTimer);
    addCategoryFeedbackTimer = null;
  }
  if (!addCategoryFeedback) return;
  addCategoryFeedback.hidden = true;
  addCategoryFeedback.textContent = '';
  delete addCategoryFeedback.dataset.state;
}

function createCustomCategoryFromName(name) {
  return normalizeCustomCategory({ name });
}

function isCategoryNameTaken(name) {
  const normalized = typeof name === 'string' ? name.trim().toLowerCase() : '';
  if (!normalized) {
    return false;
  }

  const known = getKnownCategories();
  for (const category of known) {
    const displayName = getCategoryDisplayName(category);
    if (displayName && displayName.trim().toLowerCase() === normalized) {
      return true;
    }
  }
  return false;
}

function openUploadDialog(options = {}) {
  if (!uploadDialog) return;
  const { category = null, trigger = null } = options;

  const focusSource = trigger instanceof HTMLElement
    ? trigger
    : document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  uploadDialogReturnFocus = focusSource;

  if (uploadForm && uploadForm.dataset.state !== 'busy') {
    uploadForm.reset();
  }

  if (uploadFileInput) {
    uploadFileInput.value = '';
  }

  updateCategorySuggestions();

  if (category && uploadCategoryInput) {
    const displayName = getCategoryDisplayName(category) || category.id || '';
    if (displayName) {
      uploadCategoryInput.value = displayName;
      uploadCategoryInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  if (typeof uploadDialog.showModal === 'function') {
    if (!uploadDialog.open) {
      uploadDialog.showModal();
    }
  } else {
    uploadDialog.setAttribute('open', '');
  }

  requestAnimationFrame(() => {
    if (uploadFileInput) {
      uploadFileInput.focus();
      return;
    }
    const fallback = uploadDialog.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (fallback instanceof HTMLElement) {
      fallback.focus();
    }
  });
}

function setupUploadLauncher() {
  if (!uploadLaunchButton) return;
  uploadLaunchButton.addEventListener('click', () => {
    openUploadDialog({ trigger: uploadLaunchButton });
  });
}

function closeUploadDialog(options = {}) {
  if (!uploadDialog) return;
  const { restoreFocus = true, focusTarget = null } = options;

  if (typeof uploadDialog.close === 'function') {
    if (uploadDialog.open) {
      uploadDialog.close();
    }
  } else {
    uploadDialog.removeAttribute('open');
  }

  const target = focusTarget instanceof HTMLElement
    ? focusTarget
    : uploadDialogReturnFocus instanceof HTMLElement
      ? uploadDialogReturnFocus
      : null;

  uploadDialogReturnFocus = null;

  if (restoreFocus && target) {
    requestAnimationFrame(() => {
      target.focus();
    });
  }

}

function setupUploadForm() {
  if (!uploadForm) return;
  if (uploadFileInput) {
    uploadFileInput.multiple = true;
  }
  uploadForm.addEventListener('submit', handleUploadSubmit);
  if (uploadDialogCloseButton) {
    uploadDialogCloseButton.addEventListener('click', () => closeUploadDialog());
  }
  if (uploadDialog) {
    uploadDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeUploadDialog();
    });
    uploadDialog.addEventListener('click', (event) => {
      if (event.target === uploadDialog) {
        closeUploadDialog();
      }
    });
  }
}

function setupEditorDialog() {
  if (!editorDialog) return;
  if (editorForm) {
    editorForm.addEventListener('submit', handleEditorSubmit);
  }
  if (editorCancelButton) {
    editorCancelButton.addEventListener('click', () => closeCustomEditor());
  }
  if (editorCategoryInput) {
    editorCategoryInput.addEventListener('input', () => {
      const entry = editingEntryId ? customEntryMap.get(editingEntryId) : null;
      const fallbackCategoryId = entry && entry.categoryId ? entry.categoryId : null;
      const categoryDetails = resolveCategoryDetails(editorCategoryInput.value || '', fallbackCategoryId);
      updateEditorScaleLabelState(categoryDetails.apps || [], entry);
    });
  }
  if (typeof editorDialog.addEventListener === 'function') {
    editorDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeCustomEditor();
    });
  }
}

function setupCategoryDialog() {
  if (!categoryDialog) return;

  if (categoryDialogCloseButton) {
    categoryDialogCloseButton.addEventListener('click', () => closeCategoryDialog());
  }

  if (typeof categoryDialog.addEventListener === 'function') {
    categoryDialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      closeCategoryDialog();
    });

    categoryDialog.addEventListener('click', (event) => {
      if (event.target === categoryDialog) {
        closeCategoryDialog();
      }
    });
  }

  if (categoryDialogUploadButton) {
    categoryDialogUploadButton.addEventListener('click', handleCategoryUploadClick);
  }

  if (categoryDialogFigures) {
    categoryDialogFigures.addEventListener('click', handleCategoryDialogFigureClick);
  }

  if (categoryDialogDeleteButton) {
    categoryDialogDeleteButton.addEventListener('click', handleCategoryDeleteClick);
  }

  if (categoryDialogSelectAllButton) {
    categoryDialogSelectAllButton.addEventListener('click', handleCategorySelectAllClick);
    updateCategoryDialogSelectAllButtonState({ totalCount: 0, visibleCount: 0, hasQueryFilter: false });
  }

  if (categoryDialogDeleteCategoryButton) {
    categoryDialogDeleteCategoryButton.addEventListener('click', handleCategoryDialogDeleteCategoryClick);
    updateCategoryDialogDeleteCategoryState();
  }

  if (categoryDialogAppsFieldset instanceof HTMLFieldSetElement) {
    categoryDialogAppsFieldset.addEventListener('change', handleCategoryAppsSelectionChange);
  }

  if (categoryDialogAppsSaveButton) {
    categoryDialogAppsSaveButton.addEventListener('click', handleCategoryAppsSaveClick);
  }
}

function loadCustomCategories() {
  customCategories.length = 0;
  customCategoryMap.clear();

  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  let raw = null;
  try {
    raw = storage.getItem(CUSTOM_CATEGORY_STORAGE_KEY);
  } catch (error) {
    console.error('Kunne ikke lese egendefinerte kategorier', error);
    return;
  }

  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((entry) => {
        const normalized = normalizeCustomCategory(entry);
        if (normalized && !customCategoryMap.has(normalized.id)) {
          customCategories.push(normalized);
          customCategoryMap.set(normalized.id, normalized);
        }
      });
    }
  } catch (error) {
    console.error('Kunne ikke tolke lagrede egendefinerte kategorier', error);
  }
}

function saveCustomCategories() {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }

  const payload = customCategories.map(serializeCustomCategory).filter(Boolean);
  try {
    storage.setItem(CUSTOM_CATEGORY_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error('Kunne ikke lagre egendefinerte kategorier', error);
    return false;
  }
}

function removeCustomCategoryLocal(categoryId) {
  const id = typeof categoryId === 'string' ? categoryId.trim() : '';
  if (!id) {
    return false;
  }
  let removed = false;
  for (let index = customCategories.length - 1; index >= 0; index -= 1) {
    const entry = customCategories[index];
    if (entry && entry.id === id) {
      customCategories.splice(index, 1);
      removed = true;
    }
  }
  if (customCategoryMap.has(id)) {
    customCategoryMap.delete(id);
    removed = true;
  }
  return removed;
}

function serializeCustomCategory(category) {
  if (!category || typeof category !== 'object') return null;
  return {
    id: category.id,
    name: category.name,
    filter: category.filter,
    description: category.description,
    sampleImage: category.sampleImage,
    sampleAlt: category.sampleAlt,
    apps: Array.isArray(category.apps) ? category.apps.slice() : undefined,
  };
}

function isCategoryIdTaken(candidateId) {
  const id = typeof candidateId === 'string' ? candidateId.trim() : '';
  if (!id) {
    return false;
  }

  const known = getKnownCategories();
  for (const category of known) {
    if (category && typeof category.id === 'string' && category.id === id) {
      return true;
    }
  }

  if (customCategoryMap.has(id)) {
    return true;
  }

  return customCategories.some((category) => category && category.id === id);
}

function createCustomCategoryId(baseName) {
  const baseSlug = slugifyString(baseName) || 'kategori';
  let baseCandidate = baseSlug.startsWith('custom') ? baseSlug : `custom-${baseSlug}`;
  if (!baseCandidate.startsWith('custom-')) {
    baseCandidate = `custom-${baseSlug}`;
  }
  const initialCandidate = baseCandidate && baseCandidate !== 'custom-' ? baseCandidate : 'custom-kategori';

  const existingIds = new Set();
  const known = getKnownCategories();
  known.forEach((category) => {
    if (category && typeof category.id === 'string') {
      existingIds.add(category.id);
    }
  });
  customCategories.forEach((category) => {
    if (category && typeof category.id === 'string') {
      existingIds.add(category.id);
    }
  });
  for (const key of customCategoryMap.keys()) {
    existingIds.add(key);
  }

  let candidate = initialCandidate;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${initialCandidate}-${suffix++}`;
  }
  return candidate;
}

function normalizeCustomCategory(category) {
  if (!category || typeof category !== 'object') return null;
  const rawName = typeof category.name === 'string' ? category.name.trim() : '';
  if (!rawName) {
    return null;
  }

  let id = typeof category.id === 'string' ? category.id.trim() : '';
  if (id && isCategoryIdTaken(id)) {
    id = '';
  }
  if (!id) {
    id = createCustomCategoryId(rawName);
  }

  const description = typeof category.description === 'string' && category.description.trim()
    ? category.description.trim()
    : '';
  const sampleImage = typeof category.sampleImage === 'string' && category.sampleImage.trim()
    ? category.sampleImage.trim()
    : DEFAULT_CATEGORY_THUMBNAIL;
  const sampleAlt = typeof category.sampleAlt === 'string' && category.sampleAlt.trim()
    ? category.sampleAlt.trim()
    : `Eksempel på ${rawName}`;
  const filter = typeof category.filter === 'string' && category.filter.trim()
    ? category.filter.trim()
    : rawName;
  const origin = category.origin === 'server' ? 'server' : 'local';
  const apps = getCategoryApps(category);
  const normalizedApps = Array.isArray(apps) ? apps.slice() : [];

  return {
    id,
    type: 'custom',
    name: rawName,
    filter,
    description,
    sampleImage,
    sampleAlt,
    origin,
    apps: normalizedApps,
    categoryApps: normalizedApps.slice(),
  };
}

async function loadCustomEntries() {
  customEntries.length = 0;
  customEntryMap.clear();

  const localFallbackEntries = readLocalCustomEntries();
  let insertedLocalEntries = false;

  for (const entry of localFallbackEntries) {
    const normalized = upsertCustomEntryLocal(entry);
    if (normalized) {
      insertedLocalEntries = true;
    }
  }

  if (insertedLocalEntries || localFallbackEntries.length) {
    refreshLibrary({ maintainFilter: true });
  }

  let updatedFromServer = false;

  try {
    const result = await fetchFigureLibraryEntries();
    const entries = Array.isArray(result.entries) ? result.entries : [];
    for (const entry of entries) {
      const normalized = upsertCustomEntryLocal(entry);
      if (normalized) {
        updatedFromServer = true;
      }
    }
    if (figureLibraryMetadata.storageMode === 'memory' && localFallbackEntries.length) {
      for (const entry of localFallbackEntries) {
        if (!entry || !entry.id || customEntryMap.has(entry.id)) {
          continue;
        }
        const normalized = upsertCustomEntryLocal(entry);
        if (normalized) {
          updatedFromServer = true;
        }
      }
    }
    if (updatedFromServer) {
      refreshLibrary({ maintainFilter: true });
    }
  } catch (error) {
    console.error('Kunne ikke hente figurer fra API-et', error);
  } finally {
    persistLocalEntriesIfNeeded();
    refreshStatusWithStorageWarning();
  }
}

function readLocalCustomEntries() {
  const storage = getLocalStorage();
  if (!storage) {
    customStorageAvailable = false;
    return [];
  }
  customStorageAvailable = true;
  let raw = null;
  try {
    raw = storage.getItem(CUSTOM_STORAGE_KEY);
  } catch (error) {
    console.error('Kunne ikke lese egendefinerte figurer', error);
    customStorageAvailable = false;
    return [];
  }
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    const restored = [];
    parsed.forEach((entry) => {
      const normalized = normalizeCustomEntry(entry);
      if (normalized) {
        restored.push(normalized);
      }
    });
    return restored;
  } catch (error) {
    console.error('Kunne ikke tolke lagrede egendefinerte figurer', error);
    return [];
  }
}

function persistLocalEntries() {
  const storage = getLocalStorage();
  if (!storage) {
    customStorageAvailable = false;
    return false;
  }
  const payload = customEntries
    .map(serializeCustomEntry)
    .filter((entry) => entry !== null);
  try {
    storage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(payload));
    customStorageAvailable = true;
    return true;
  } catch (error) {
    console.error('Kunne ikke lagre egendefinerte figurer', error);
    customStorageAvailable = false;
    return false;
  }
}

function persistLocalEntriesIfNeeded() {
  const mode = normalizeStorageMode(figureLibraryMetadata?.storageMode);
  if (!mode || mode === 'memory') {
    persistLocalEntries();
  } else {
    clearLocalEntries();
  }
}

function serializeCustomEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const result = {
    id: entry.id,
    slug: entry.slug,
    name: entry.name,
    categoryId: entry.categoryId,
    categoryName: entry.categoryName,
    categoryApps: Array.isArray(entry.categoryApps) ? entry.categoryApps.slice() : undefined,
    dataUrl: entry.dataUrl,
    summary: entry.summary,
    createdAt: entry.createdAt,
    fileName: resolveEntryFileName(entry) || undefined,
    scaleLabel: Object.prototype.hasOwnProperty.call(entry, 'scaleLabel')
      ? normalizeScaleLabel(entry.scaleLabel)
      : undefined,
  };
  if (typeof entry.tool === 'string' && entry.tool.trim()) {
    result.tool = entry.tool.trim();
  }
  if (typeof entry.svg === 'string') {
    result.svg = entry.svg;
  }
  if (typeof entry.png === 'string') {
    result.png = entry.png;
  }
  if (Number.isFinite(entry.pngWidth)) {
    result.pngWidth = Number(entry.pngWidth);
  }
  if (Number.isFinite(entry.pngHeight)) {
    result.pngHeight = Number(entry.pngHeight);
  }
  return result;
}

function clearLocalEntries() {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(CUSTOM_STORAGE_KEY);
  } catch (error) {
    // ignore clearing errors
  }
}

function normalizeCustomEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  let id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : '';
  const slug = typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : id;
  const name = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : 'Egendefinert figur';
  let categoryName = typeof entry.categoryName === 'string' && entry.categoryName.trim()
    ? entry.categoryName.trim()
    : 'Egendefinert';
  let categoryId = typeof entry.categoryId === 'string' && entry.categoryId.trim() ? entry.categoryId.trim() : '';
  let svgMarkup = typeof entry.svg === 'string' ? entry.svg : null;
  let dataUrl = typeof entry.dataUrl === 'string' && entry.dataUrl.trim() ? entry.dataUrl.trim() : '';
  if (!svgMarkup && dataUrl && dataUrl.startsWith('data:image/svg+xml')) {
    svgMarkup = decodeSvgDataUrl(dataUrl);
  }
  if (!dataUrl && svgMarkup) {
    dataUrl = encodeSvgToDataUrl(svgMarkup);
  }
  if (!dataUrl) {
    return null;
  }
  if (!categoryId) {
    const baseSlug = slugifyString(categoryName) || 'custom';
    categoryId = baseSlug.startsWith('custom') ? baseSlug : `custom-${baseSlug}`;
  }
  if (!id) {
    id = slug || createCustomEntryId(name);
  }
  const categoryApps = Array.isArray(entry.categoryApps)
    ? sanitizeCategoryApps(entry.categoryApps, { includeDefaults: false })
    : entry.category && Array.isArray(entry.category.apps)
      ? sanitizeCategoryApps(entry.category.apps, { includeDefaults: false })
      : sanitizeCategoryApps(undefined);
  const fileName = resolveEntryFileName(entry);
  const scaleLabel = normalizeScaleLabel(entry.scaleLabel);
  const normalized = {
    id,
    slug: slug || id,
    name,
    categoryId,
    categoryName,
    categoryApps,
    dataUrl,
    summary: typeof entry.summary === 'string' ? entry.summary.trim() : '',
    createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
    svg: svgMarkup,
    png: typeof entry.png === 'string' ? entry.png : null,
    fileName,
    scaleLabel: scaleLabel || (fileName ? extractScaleLabelFromFileName(fileName) : ''),
  };
  if (typeof entry.tool === 'string' && entry.tool.trim()) {
    normalized.tool = entry.tool.trim();
  }
  if (Number.isFinite(entry.pngWidth)) {
    normalized.pngWidth = Number(entry.pngWidth);
  }
  if (Number.isFinite(entry.pngHeight)) {
    normalized.pngHeight = Number(entry.pngHeight);
  }
  return normalized;
}

function buildFigureLibraryRawUrl(slugOrPath, format = 'svg') {
  const normalizedFormat = format === 'png' ? 'png' : 'svg';
  if (typeof slugOrPath !== 'string') {
    return null;
  }
  const trimmed = slugOrPath.trim().replace(/^\/+/, '');
  if (!trimmed) {
    return null;
  }
  const hasExtension = /\.(svg|png)$/i.test(trimmed);
  const slug = hasExtension ? trimmed : `${trimmed}.${normalizedFormat}`;
  const params = new URLSearchParams();
  params.set('slug', slug);
  const rawUrl = `${FIGURE_LIBRARY_RAW_ENDPOINT}?${params.toString()}`;
  return buildAbsoluteFigureLibraryUrl(rawUrl);
}

function normalizeServerEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const slug = typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : '';
  const id = slug || (typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : '');
  if (!id) {
    return null;
  }
  const nameCandidates = [entry.name, entry.title, slug, id];
  let name = '';
  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      name = candidate.trim();
      break;
    }
  }
  if (!name) {
    name = id;
  }
  const categoryObject = entry.category && typeof entry.category === 'object' ? entry.category : {};
  let categoryId = typeof entry.categoryId === 'string' && entry.categoryId.trim() ? entry.categoryId.trim() : '';
  if (!categoryId && typeof categoryObject.id === 'string' && categoryObject.id.trim()) {
    categoryId = categoryObject.id.trim();
  }
  let categoryName = typeof entry.categoryName === 'string' && entry.categoryName.trim()
    ? entry.categoryName.trim()
    : '';
  if (!categoryName && typeof categoryObject.label === 'string' && categoryObject.label.trim()) {
    categoryName = categoryObject.label.trim();
  }
  if (!categoryName) {
    categoryName = categoryId || 'Egendefinert';
  }
  const svgSlugCandidate =
    (entry.files && entry.files.svg && typeof entry.files.svg.slug === 'string' && entry.files.svg.slug.trim())
      ? entry.files.svg.slug.trim()
      : typeof entry.svgSlug === 'string' && entry.svgSlug.trim()
        ? entry.svgSlug.trim()
        : slug || id;
  const pngSlugCandidate =
    (entry.files && entry.files.png && typeof entry.files.png.slug === 'string' && entry.files.png.slug.trim())
      ? entry.files.png.slug.trim()
      : typeof entry.pngSlug === 'string' && entry.pngSlug.trim()
        ? entry.pngSlug.trim()
        : slug || id;
  const rawSvgUrl = buildFigureLibraryRawUrl(svgSlugCandidate, 'svg');
  const rawPngUrl = entry.png || (entry.files && entry.files.png) ? buildFigureLibraryRawUrl(pngSlugCandidate, 'png') : null;

  const svgMarkup = typeof entry.svg === 'string' ? entry.svg : null;
  let dataUrl = '';
  const urlCandidates = [];
  if (entry.urls && typeof entry.urls.svg === 'string' && entry.urls.svg.trim()) {
    urlCandidates.push(entry.urls.svg.trim());
  }
  if (
    entry.files &&
    entry.files.svg &&
    typeof entry.files.svg.url === 'string' &&
    entry.files.svg.url.trim()
  ) {
    urlCandidates.push(entry.files.svg.url.trim());
  }
  if (typeof entry.dataUrl === 'string' && entry.dataUrl.trim()) {
    urlCandidates.push(entry.dataUrl.trim());
  }
  if (rawSvgUrl) {
    urlCandidates.push(rawSvgUrl);
  }
  for (const candidate of urlCandidates) {
    if (candidate) {
      dataUrl = candidate;
      break;
    }
  }
  if (!dataUrl) {
    return null;
  }
  const categoryApps = entry.category && Array.isArray(entry.category.apps)
    ? sanitizeCategoryApps(entry.category.apps, { includeDefaults: false })
    : Array.isArray(entry.categoryApps)
      ? sanitizeCategoryApps(entry.categoryApps, { includeDefaults: false })
      : sanitizeCategoryApps(undefined);
  const fileName = resolveEntryFileName(entry);
  const scaleLabel = normalizeScaleLabel(entry.scaleLabel || entry.scale)
    || (fileName ? extractScaleLabelFromFileName(fileName) : '');
  const normalized = {
    id,
    slug: slug || id,
    name,
    categoryId: categoryId || 'custom',
    categoryName,
    categoryApps,
    dataUrl,
    summary: typeof entry.summary === 'string' ? entry.summary.trim() : '',
    createdAt: typeof entry.createdAt === 'string' && entry.createdAt ? entry.createdAt : new Date().toISOString(),
    svg: svgMarkup,
    png: typeof entry.png === 'string' ? entry.png : null,
    fileName,
    scaleLabel,
  };
  if (rawSvgUrl) {
    normalized.assetUrl = rawSvgUrl;
  }
  if (rawPngUrl) {
    normalized.pngUrl = rawPngUrl;
  }
  if (typeof entry.tool === 'string' && entry.tool.trim()) {
    normalized.tool = entry.tool.trim();
  }
  if (Number.isFinite(entry.pngWidth)) {
    normalized.pngWidth = Number(entry.pngWidth);
  }
  if (Number.isFinite(entry.pngHeight)) {
    normalized.pngHeight = Number(entry.pngHeight);
  }
  if (!normalized.type) {
    normalized.type = 'custom';
  }
  normalized.custom = true;
  const entryId = normalized.slug || normalized.id;
  if (entryId) {
    normalized.entryId = entryId;
    customEntryMap.set(entryId, normalized);
  }
  if (normalized.id && normalized.id !== entryId) {
    customEntryMap.set(normalized.id, normalized);
  }
  return normalized;
}

function upsertCustomEntryLocal(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : entry.slug;
  if (!id) return null;
  const normalized = {
    ...entry,
    id,
    slug: typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : id,
  };
  if (Array.isArray(normalized.categoryApps)) {
    normalized.categoryApps = sanitizeCategoryApps(normalized.categoryApps, { includeDefaults: false });
  } else {
    normalized.categoryApps = sanitizeCategoryApps(undefined);
  }
  normalized.fileName = resolveEntryFileName(normalized);
  if (Object.prototype.hasOwnProperty.call(normalized, 'scaleLabel')) {
    const sanitizedScaleLabel = normalizeScaleLabel(normalized.scaleLabel);
    normalized.scaleLabel = sanitizedScaleLabel || (
      normalized.fileName ? extractScaleLabelFromFileName(normalized.fileName) : ''
    );
  } else if (normalized.fileName) {
    normalized.scaleLabel = extractScaleLabelFromFileName(normalized.fileName);
  }
  const existingIndex = customEntries.findIndex((item) => item && item.id === id);
  if (existingIndex >= 0) {
    customEntries[existingIndex] = normalized;
  } else {
    customEntries.push(normalized);
  }
  customEntryMap.set(id, normalized);
  ensureCategoryFromEntry(normalized);
  return normalized;
}

function removeCustomEntryLocal(identifier) {
  const key = typeof identifier === 'string' ? identifier.trim() : '';
  if (!key) return false;
  let removed = false;
  for (let index = customEntries.length - 1; index >= 0; index -= 1) {
    const entry = customEntries[index];
    if (!entry) continue;
    const entryId = typeof entry.id === 'string' ? entry.id : '';
    const entrySlug = typeof entry.slug === 'string' ? entry.slug : '';
    if (entryId === key || entrySlug === key) {
      customEntries.splice(index, 1);
      if (entryId) {
        customEntryMap.delete(entryId);
      }
      removed = true;
    }
  }
  if (!removed && customEntryMap.has(key)) {
    customEntryMap.delete(key);
    removed = true;
  }
  return removed;
}

function ensureCategoryFromEntry(entry) {
  if (!entry || typeof entry !== 'object') return;
  const categoryId = typeof entry.categoryId === 'string' && entry.categoryId.trim() ? entry.categoryId.trim() : '';
  const categoryName = typeof entry.categoryName === 'string' && entry.categoryName.trim()
    ? entry.categoryName.trim()
    : '';
  if (!categoryId && !categoryName) {
    return;
  }
  const normalized = categoryId
    ? normalizeServerCategory({ id: categoryId, label: categoryName || categoryId, apps: entry.categoryApps })
    : normalizeCustomCategory({ name: categoryName || 'Egendefinert', apps: entry.categoryApps });
  if (!normalized) {
    return;
  }
  const sanitizedApps = Array.isArray(normalized.apps)
    ? sanitizeCategoryApps(normalized.apps, { includeDefaults: false })
    : sanitizeCategoryApps(undefined);
  const finalCategory = { ...normalized, apps: sanitizedApps, categoryApps: sanitizedApps.slice() };
  const existing = customCategoryMap.get(finalCategory.id);
  if (existing) {
    const merged = { ...existing, ...finalCategory };
    customCategoryMap.set(finalCategory.id, merged);
    const existingIndex = customCategories.findIndex((category) => category && category.id === finalCategory.id);
    if (existingIndex >= 0) {
      customCategories[existingIndex] = merged;
    }
    return;
  }
  customCategoryMap.set(finalCategory.id, finalCategory);
  const listIndex = customCategories.findIndex((category) => category && category.id === finalCategory.id);
  if (listIndex >= 0) {
    customCategories[listIndex] = finalCategory;
  } else {
    customCategories.push(finalCategory);
  }
}

function normalizeServerCategory(category) {
  if (!category || typeof category !== 'object') return null;
  const id = typeof category.id === 'string' && category.id.trim() ? category.id.trim() : '';
  if (!id) {
    return null;
  }
  const nameCandidates = [category.label, category.name, category.filter, id];
  let name = '';
  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      name = candidate.trim();
      break;
    }
  }
  if (!name) {
    name = id;
  }
  const description = typeof category.description === 'string' ? category.description.trim() : '';
  const sampleImage = typeof category.sampleImage === 'string' && category.sampleImage.trim()
    ? category.sampleImage.trim()
    : DEFAULT_CATEGORY_THUMBNAIL;
  const sampleAlt = typeof category.sampleAlt === 'string' && category.sampleAlt.trim()
    ? category.sampleAlt.trim()
    : `Eksempel på ${name}`;
  const apps = getCategoryApps(category);
  const normalizedApps = Array.isArray(apps) ? apps.slice() : [];
  return {
    id,
    type: 'custom',
    name,
    filter: typeof category.filter === 'string' && category.filter.trim() ? category.filter.trim() : name,
    description,
    sampleImage,
    sampleAlt,
    origin: 'server',
    apps: normalizedApps,
    categoryApps: normalizedApps.slice(),
  };
}

function applyServerCategories(categoryList) {
  if (!Array.isArray(categoryList)) return;
  const incomingIds = new Set();
  for (const category of categoryList) {
    const normalized = normalizeServerCategory(category);
    if (!normalized) continue;
     incomingIds.add(normalized.id);
    if (customCategoryMap.has(normalized.id)) {
      const existing = customCategoryMap.get(normalized.id);
      const mergedApps = Array.isArray(normalized.apps) && normalized.apps.length
        ? sanitizeCategoryApps(normalized.apps, { includeDefaults: false })
        : Array.isArray(existing?.apps)
          ? sanitizeCategoryApps(existing.apps, { includeDefaults: false })
          : sanitizeCategoryApps(undefined);
      const merged = { ...existing, ...normalized, apps: mergedApps, categoryApps: mergedApps.slice() };
      customCategoryMap.set(normalized.id, merged);
      const index = customCategories.findIndex((entry) => entry && entry.id === normalized.id);
      if (index >= 0) {
        customCategories[index] = merged;
      }
      continue;
    }
    const normalizedApps = Array.isArray(normalized.apps)
      ? sanitizeCategoryApps(normalized.apps, { includeDefaults: false })
      : sanitizeCategoryApps(undefined);
    const finalCategory = { ...normalized, apps: normalizedApps, categoryApps: normalizedApps.slice() };
    customCategoryMap.set(normalized.id, finalCategory);
    customCategories.push(finalCategory);
  }

  const idsToRemove = new Set();
  for (const category of customCategories) {
    if (!category || typeof category.id !== 'string') {
      continue;
    }
    const id = category.id;
    const origin = typeof category.origin === 'string' ? category.origin : '';
    if ((origin === 'server' || origin === 'kv') && !incomingIds.has(id)) {
      idsToRemove.add(id);
    }
  }
  customCategoryMap.forEach((value, key) => {
    if (!value || typeof key !== 'string') {
      return;
    }
    const origin = typeof value.origin === 'string' ? value.origin : '';
    if ((origin === 'server' || origin === 'kv') && !incomingIds.has(key)) {
      idsToRemove.add(key);
    }
  });

  idsToRemove.forEach(id => removeCustomCategoryLocal(id));
}

function normalizeStorageMode(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'kv' || normalized === 'vercel-kv') return 'kv';
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') return 'memory';
  return normalized;
}

function applyFigureLibraryMetadata(metadata, response) {
  if (!metadata || typeof metadata !== 'object') {
    refreshStatusWithStorageWarning();
    return figureLibraryMetadata;
  }
  const headerMode = response && typeof response.headers?.get === 'function'
    ? response.headers.get('X-Figure-Library-Store-Mode')
    : null;
  const modeHint = metadata.storageMode || metadata.mode || headerMode;
  const normalizedMode = normalizeStorageMode(modeHint) || figureLibraryMetadata.storageMode || 'memory';
  figureLibraryMetadata.storageMode = normalizedMode;
  if (Object.prototype.hasOwnProperty.call(metadata, 'persistent')) {
    figureLibraryMetadata.persistent = Boolean(metadata.persistent);
  } else if (normalizedMode === 'kv') {
    figureLibraryMetadata.persistent = true;
  }
  const limitation = typeof metadata.limitation === 'string' ? metadata.limitation.trim() : '';
  if (limitation || normalizedMode !== 'memory') {
    figureLibraryMetadata.limitation = limitation;
  }
  refreshStatusWithStorageWarning();
  return figureLibraryMetadata;
}

async function fetchFigureLibraryEntries() {
  const fetchOptions = {};
  if (!hasRequestedSummaryView) {
    const params = new URLSearchParams();
    params.set('view', 'summary');
    fetchOptions.searchParams = params;
    hasRequestedSummaryView = true;
  }
  const { data, response } = await fetchFigureLibrary('GET', undefined, fetchOptions);
  applyFigureLibraryMetadata(data, response);
  if (Array.isArray(data.categories)) {
    applyServerCategories(data.categories);
  }
  const entries = Array.isArray(data.entries)
    ? data.entries.map((entry) => normalizeServerEntry(entry)).filter(Boolean)
    : [];
  return { entries };
}

async function deleteCategoryFromLibrary(category) {
  if (!category || typeof category.id !== 'string') {
    throw new Error('Ugyldig kategori for sletting.');
  }
  const id = category.id.trim();
  if (!id) {
    throw new Error('Ugyldig kategori for sletting.');
  }

  let payload = { deleted: { categoryId: id }, categories: [] };
  try {
    const { data, response } = await fetchFigureLibrary('DELETE', { categoryId: id });
    applyFigureLibraryMetadata(data, response);
    if (Array.isArray(data.categories)) {
      applyServerCategories(data.categories);
    }
    payload = data;
  } catch (error) {
    if (!error || !error.response || error.response.status !== 404) {
      throw error;
    }
  }

  if (removeCustomCategoryLocal(id)) {
    saveCustomCategories();
  }

  return payload;
}

async function deleteFigureEntries(slugs = []) {
  const uniqueSlugs = Array.from(
    new Set(
      Array.isArray(slugs)
        ? slugs.map((slug) => (typeof slug === 'string' ? slug.trim() : '')).filter(Boolean)
        : []
    )
  );

  if (!uniqueSlugs.length) {
    showUploadStatus('Velg minst én figur å slette.', 'error', { duration: 5000 });
    return { deleted: [], failed: [] };
  }

  const pendingMessage = uniqueSlugs.length === 1 ? 'Sletter figuren …' : `Sletter ${uniqueSlugs.length} figurer …`;
  showUploadStatus(pendingMessage, 'pending');

  const deleted = [];
  const failed = [];

  for (const slug of uniqueSlugs) {
    try {
      const { data, response } = await fetchFigureLibrary('DELETE', { slug });
      applyFigureLibraryMetadata(data, response);
      if (Array.isArray(data.categories)) {
        applyServerCategories(data.categories);
      }
      removeCustomEntryLocal(slug);
      deleted.push(slug);
    } catch (error) {
      console.error(`Kunne ikke slette figuren ${slug}`, error);
      failed.push({ slug, message: extractApiErrorMessage(error, `Kunne ikke slette «${slug}».`) });
    }
  }

  if (deleted.length) {
    persistLocalEntriesIfNeeded();
    refreshLibrary({ maintainFilter: true });
  }

  let summaryState = 'info';
  let summaryMessage = '';

  if (deleted.length && !failed.length) {
    summaryState = 'success';
    summaryMessage = deleted.length === 1 ? 'Figuren ble slettet.' : `${deleted.length} figurer ble slettet.`;
    setStatusMessage(summaryMessage, 'info', { includeStorageWarning: false });
  } else if (deleted.length && failed.length) {
    summaryState = 'warning';
    const header = `Slettet ${deleted.length} av ${uniqueSlugs.length} figurer.`;
    const details = failed.map((entry) => `• ${entry.slug}: ${entry.message}`);
    summaryMessage = [header, ...details].join('\n');
    setStatusMessage(header, 'warning', { includeStorageWarning: false });
  } else if (!deleted.length) {
    summaryState = 'error';
    const details = failed.map((entry) => `• ${entry.slug}: ${entry.message}`);
    summaryMessage = details.length ? details.join('\n') : 'Kunne ikke slette figurene. Prøv igjen.';
    setStatusMessage('Kunne ikke slette figurene. Prøv igjen.', 'error', { includeStorageWarning: false });
  }

  if (summaryMessage) {
    const duration = summaryState === 'error' ? 8000 : 6000;
    showUploadStatus(summaryMessage, summaryState, { duration });
  }

  return { deleted, failed };
}

async function fetchFigureLibrary(method = 'GET', payload, requestConfig = {}) {
  const normalizedMethod = typeof method === 'string' ? method.trim().toUpperCase() : 'GET';
  const options = {
    method: normalizedMethod,
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  };
  if (payload !== undefined && normalizedMethod !== 'GET' && normalizedMethod !== 'HEAD') {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
  }

  let requestUrl = FIGURE_LIBRARY_ENDPOINT;
  if (requestConfig && requestConfig.searchParams) {
    const rawParams = requestConfig.searchParams;
    let params = null;
    if (rawParams instanceof URLSearchParams) {
      params = rawParams;
    } else if (typeof rawParams === 'string') {
      params = new URLSearchParams(rawParams);
    } else if (rawParams && typeof rawParams === 'object') {
      params = new URLSearchParams();
      for (const [key, value] of Object.entries(rawParams)) {
        if (value == null) {
          continue;
        }
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item != null) {
              params.append(key, `${item}`);
            }
          }
        } else {
          params.append(key, `${value}`);
        }
      }
    }
    if (params) {
      const query = params.toString();
      if (query) {
        requestUrl = `${FIGURE_LIBRARY_ENDPOINT}?${query}`;
      }
    }
  }

  requestUrl = buildAbsoluteFigureLibraryUrl(requestUrl);

  const response = await fetch(requestUrl, options);
  const contentTypeHeader = typeof response.headers?.get === 'function'
    ? response.headers.get('content-type')
    : '';
  const isJsonResponse = typeof contentTypeHeader === 'string'
    ? contentTypeHeader.toLowerCase().includes('application/json')
    : false;
  let data = {};
  let text = '';
  try {
    text = await response.text();
  } catch (error) {
    text = '';
  }
  if (text) {
    const trimmedText = text.trim();
    const shouldAttemptParsing = isJsonResponse || trimmedText.startsWith('{') || trimmedText.startsWith('[');
    if (shouldAttemptParsing) {
      try {
        data = JSON.parse(trimmedText);
      } catch (error) {
        if (response.ok) {
          const parsingError = new Error('Ugyldig JSON-respons fra figurbiblioteket');
          parsingError.response = response;
          parsingError.nonJsonResponse = !isJsonResponse;
          parsingError.responseContentType = contentTypeHeader || null;
          parsingError.responseText = text;
          if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
            console.warn('Ignorerer ugyldig JSON fra figurbiblioteket og bruker lokal data.', parsingError);
          }
          data = {};
        } else {
          data = {};
        }
      }
    } else if (response.ok) {
      const parsingError = new Error('Ugyldig JSON-respons fra figurbiblioteket');
      parsingError.response = response;
      parsingError.nonJsonResponse = true;
      parsingError.responseContentType = contentTypeHeader || null;
      parsingError.responseText = text;
      if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
        console.warn('Ignorerer ugyldig JSON fra figurbiblioteket og bruker lokal data.', parsingError);
      }
      data = {};
    }
  }
  if (!response.ok) {
    const message = typeof data.error === 'string' && data.error.trim()
      ? data.error.trim()
      : `HTTP ${response.status}`;
    const error = new Error(message);
    error.response = response;
    error.payload = data;
    throw error;
  }
  return { data, response };
}

function isFigureLibraryUnavailableError(error) {
  if (!error) return false;
  const status = error?.response?.status;
  if (status === 404) {
    return true;
  }
  const contentTypeHeader = typeof error?.response?.headers?.get === 'function'
    ? error.response.headers.get('content-type')
    : null;
  const responseIsNonJson = contentTypeHeader
    ? !contentTypeHeader.toLowerCase().includes('application/json')
    : false;
  if (error?.nonJsonResponse || (responseIsNonJson && status === 200)) {
    return true;
  }
  if (!status && error.name === 'TypeError') {
    return true;
  }
  if (typeof error.message === 'string' && error.message.includes('HTTP 404')) {
    return true;
  }
  return false;
}

function buildFigureEntryPayload(entry, options = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const slug = typeof entry.slug === 'string' && entry.slug.trim()
    ? entry.slug.trim()
    : typeof entry.entryId === 'string' && entry.entryId.trim()
      ? entry.entryId.trim()
      : entry.id;
  if (!slug) return null;
  const toolValue = typeof entry.tool === 'string' && entry.tool.trim() ? entry.tool.trim() : FIGURE_LIBRARY_TOOL;
  const payload = {
    slug,
    name: entry.name || slug,
    title: entry.name || slug,
    tool: toolValue,
    summary: entry.summary || '',
  };
  if (Object.prototype.hasOwnProperty.call(entry, 'scaleLabel')) {
    payload.scaleLabel = normalizeScaleLabel(entry.scaleLabel);
  }
  const fileName = resolveEntryFileName(entry);
  if (fileName) {
    payload.fileName = fileName;
  }
  if (entry.createdAt) {
    payload.createdAt = entry.createdAt;
  }
  if (entry.categoryId) {
    payload.categoryId = entry.categoryId;
  }
  if (entry.categoryName) {
    payload.categoryName = entry.categoryName;
  }
  const categoryPayload = {};
  if (entry.categoryId) {
    categoryPayload.id = entry.categoryId;
  }
  if (entry.categoryName) {
    categoryPayload.label = entry.categoryName;
  }
  if (Object.keys(categoryPayload).length) {
    payload.category = categoryPayload;
  }
  const categoryAppsSource = Object.prototype.hasOwnProperty.call(entry, 'categoryApps')
    ? entry.categoryApps
    : entry.category && Object.prototype.hasOwnProperty.call(entry.category, 'apps')
      ? entry.category.apps
      : undefined;
  if (categoryAppsSource !== undefined) {
    const categoryApps = sanitizeCategoryApps(categoryAppsSource, { includeDefaults: categoryAppsSource == null });
    if (categoryApps.length) {
      payload.categoryApps = categoryApps;
      if (payload.category) {
        payload.category.apps = categoryApps;
      } else {
        payload.category = { apps: categoryApps };
      }
    }
  }
  if (typeof entry.svg === 'string') {
    payload.svg = entry.svg;
  }
  if (options.includeMedia && typeof entry.png === 'string' && entry.png) {
    payload.png = entry.png;
  }
  if (options.includeMedia && Number.isFinite(entry.pngWidth)) {
    payload.pngWidth = Number(entry.pngWidth);
  }
  if (options.includeMedia && Number.isFinite(entry.pngHeight)) {
    payload.pngHeight = Number(entry.pngHeight);
  }
  if (entry.description) {
    payload.description = entry.description;
  }
  if (Array.isArray(entry.tags)) {
    payload.tags = entry.tags;
  }
  return payload;
}

async function submitFigureEntry(entry, options = {}) {
  if (!entry || typeof entry !== 'object') return null;
  const includeMedia = options.includeMedia === true;
  const method = options.method || 'POST';
  const payload = buildFigureEntryPayload(entry, { includeMedia });
  if (!payload) {
    throw new Error('Ugyldig figurdata for opplasting.');
  }
  let data;
  let response;
  try {
    const result = await fetchFigureLibrary(method, payload);
    data = result.data;
    response = result.response;
  } catch (error) {
    if (isFigureLibraryUnavailableError(error)) {
      const fallbackMetadata = { storageMode: 'memory', persistent: false, limitation: LOCAL_ONLY_LIMITATION };
      applyFigureLibraryMetadata(fallbackMetadata);
      const normalizedEntry = upsertCustomEntryLocal(entry);
      persistLocalEntriesIfNeeded();
      return normalizedEntry || entry;
    }
    throw error;
  }
  applyFigureLibraryMetadata(data, response);
  if (Array.isArray(data.categories)) {
    applyServerCategories(data.categories);
  }
  let normalized = null;
  if (data.entry) {
    normalized = normalizeServerEntry(data.entry);
  } else if (Array.isArray(data.entries)) {
    const normalizedEntries = data.entries.map((item) => normalizeServerEntry(item)).filter(Boolean);
    normalizedEntries.forEach((item) => upsertCustomEntryLocal(item));
    normalized = normalizedEntries[normalizedEntries.length - 1] || null;
  }
  if (normalized) {
    upsertCustomEntryLocal(normalized);
  } else {
    upsertCustomEntryLocal(entry);
  }
  persistLocalEntriesIfNeeded();
  return normalized || entry;
}

function createCategoryPreviewElement(category, titleText) {
  const container = document.createElement('div');
  container.className = 'categoryFigure';
  container.setAttribute('aria-hidden', 'true');

  const previewItems = getCategoryPreviewItems(category, CATEGORY_PREVIEW_COUNT, titleText);
  if (!previewItems.length) {
    container.dataset.empty = 'true';
  }
  for (const item of previewItems) {
    if (!item || typeof item.src !== 'string' || !item.src) continue;
    const img = document.createElement('img');
    img.src = item.src;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.loading = 'lazy';
    img.decoding = 'async';
    container.appendChild(img);
  }

  return container;
}

function getCategoryPreviewItems(category, count = CATEGORY_PREVIEW_COUNT, titleText = '') {
  const total = typeof count === 'number' && count > 0 ? Math.min(Math.floor(count), 12) : CATEGORY_PREVIEW_COUNT;
  const fallbackPath = resolveCategorySamplePath(category);
  const fallbackAlt = category.sampleAlt || `Eksempel på ${titleText || getCategoryDisplayName(category) || 'kategori'}`;

  const figures = getFiguresForCategory(category.id);
  const uniqueFigures = [];
  const seenPaths = new Set();
  for (const item of figures) {
    const src = item?.data?.path || item?.path || '';
    if (!src || seenPaths.has(src)) continue;
    seenPaths.add(src);
    uniqueFigures.push({
      src,
      alt: item?.data?.name || item?.data?.slug || fallbackAlt,
    });
  }

  if (!uniqueFigures.length) {
    if (category?.type === 'custom') {
      return [];
    }
    if (!fallbackPath) {
      return [];
    }
    return Array.from({ length: total }, () => ({ src: fallbackPath, alt: fallbackAlt }));
  }

  const shuffled = shuffleArray(uniqueFigures);
  const selection = [];
  for (let index = 0; index < total; index += 1) {
    const source = shuffled[index] || shuffled[index % shuffled.length];
    if (!source) break;
    selection.push({ src: source.src, alt: source.alt });
  }

  return selection;
}

function shuffleArray(list) {
  const array = Array.isArray(list) ? list.slice() : [];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

function handleCategoryUploadClick() {
  const category = activeCategoryId ? categoryMetaById.get(activeCategoryId) || null : null;
  const trigger = categoryDialogUploadButton || document.activeElement;
  closeCategoryDialog({ restoreFocus: false });
  openUploadDialog({ category, trigger });
}

async function handleUploadSubmit(event) {
  event.preventDefault();
  if (!uploadFileInput || !uploadFileInput.files || uploadFileInput.files.length === 0) {
    showUploadStatus('Velg minst én SVG-fil først.', 'error', { duration: 6000 });
    return;
  }

  const files = Array.from(uploadFileInput.files).filter(Boolean);
  if (!files.length) {
    showUploadStatus('Fant ingen gyldige filer i utvalget.', 'error', { duration: 6000 });
    return;
  }

  const categoryInputValue = uploadCategoryInput && uploadCategoryInput.value ? uploadCategoryInput.value : '';
  const results = [];
  const progressDetails = [];
  let successfulUploads = 0;
  let encounteredError = false;
  const reservedUploadIds = new Set();

  if (uploadForm) {
    uploadForm.dataset.state = 'busy';
    uploadForm.setAttribute('aria-busy', 'true');
  }

  const updateProgressStatus = () => {
    const completed = results.length;
    const header = files.length > 1 && completed
      ? `Laster opp … (${completed}/${files.length})`
      : 'Laster opp …';
    const detailLines = progressDetails.length
      ? `\n${progressDetails.map((detail) => `• ${detail}`).join('\n')}`
      : '';
    showUploadStatus(`${header}${detailLines}`, 'pending');
  };

  showUploadStatus('Laster opp …', 'pending');

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    if (!file) continue;
    const label = file.name || `Fil ${index + 1}`;
    try {
      const svgText = await file.text();
      if (typeof svgText !== 'string' || !svgText.includes('<svg')) {
        throw new Error('Filen er ikke en gyldig SVG.');
      }
      const name = determineUploadName(files.length, index, file.name);
      const categoryDetails = resolveCategoryDetails(categoryInputValue, null, name);
      const id = createCustomEntryId(name, reservedUploadIds);
      const fileName = typeof file.name === 'string' ? file.name : '';
      const scaleLabel = shouldShowScaleLabelForApps(categoryDetails.apps)
        ? extractScaleLabelFromFileName(fileName)
        : '';
      const entry = {
        id,
        slug: id,
        name,
        categoryId: categoryDetails.id,
        categoryName: categoryDetails.name,
        categoryApps: categoryDetails.apps,
        summary: '',
        createdAt: new Date().toISOString(),
        dataUrl: encodeSvgToDataUrl(svgText),
        svg: svgText,
        tool: FIGURE_LIBRARY_TOOL,
        fileName,
        scaleLabel,
      };
      const savedEntry = await submitFigureEntry(entry, { method: 'POST' });
      const finalEntry = savedEntry || entry;
      results.push({ state: 'success', message: `${label}: Lastet opp som «${finalEntry.name}».` });
      progressDetails.push(`${label}: Lastet opp som «${finalEntry.name}».`);
      successfulUploads += 1;
    } catch (error) {
      encounteredError = true;
      console.error('Opplasting av SVG mislyktes', error);
      const message = extractApiErrorMessage(error, 'Opplasting mislyktes.');
      results.push({ state: 'error', message: `${label}: ${message}` });
      progressDetails.push(`${label}: ${message}`);
    }

    updateProgressStatus();
  }

  if (uploadForm) {
    delete uploadForm.dataset.state;
    uploadForm.removeAttribute('aria-busy');
  }

  if (successfulUploads) {
    refreshLibrary();
    const statusState = encounteredError ? 'warning' : 'info';
    const statusMessage = encounteredError
      ? `Fullførte ${successfulUploads} av ${files.length} opplastinger.`
      : successfulUploads === 1
        ? 'Egendefinert figur lagt til i biblioteket.'
        : 'Egendefinerte figurer lagt til i biblioteket.';
    setStatusMessage(statusMessage, statusState);
    uploadForm?.reset();
  } else if (encounteredError) {
    setStatusMessage('Ingen filer ble lastet opp.', 'error', { includeStorageWarning: false });
  }

  const summaryState = determineUploadState(results);
  const summaryMessage = formatUploadStatusSummary(results, files.length);
  showUploadStatus(summaryMessage, summaryState, { duration: summaryState === 'error' ? 8000 : 6000 });
}

function determineUploadName(totalFiles, index, originalFileName) {
  const derived = deriveNameFromFile(originalFileName || '') || '';
  if (totalFiles <= 1) {
    return derived || 'Egendefinert figur';
  }
  if (derived) {
    return derived;
  }
  return `Egendefinert figur ${index + 1}`;
}

function showUploadStatus(message, state = 'info', options = {}) {
  if (!uploadStatusEl) return;
  const resolvedState = typeof state === 'string' && state.trim() ? state.trim() : 'info';
  const resolvedMessage = typeof message === 'string' ? message : message == null ? '' : String(message);
  if (uploadStatusMessageEl) {
    uploadStatusMessageEl.textContent = resolvedMessage;
  } else {
    uploadStatusEl.textContent = resolvedMessage;
  }
  uploadStatusEl.dataset.state = resolvedState;
  uploadStatusEl.hidden = false;
  if (uploadStatusTimer) {
    clearTimeout(uploadStatusTimer);
    uploadStatusTimer = null;
  }
  const pending = resolvedState === 'pending';
  const explicitDuration = Number.isFinite(options.duration) ? Number(options.duration) : null;
  const duration = explicitDuration !== null
    ? explicitDuration
    : pending
      ? 0
      : resolvedState === 'error'
        ? 8000
        : 5000;
  if (duration > 0) {
    uploadStatusTimer = setTimeout(() => {
      uploadStatusEl.hidden = true;
    }, duration);
  }
}

function determineUploadState(results) {
  if (!Array.isArray(results) || !results.length) {
    return 'info';
  }
  const hasError = results.some((result) => result.state === 'error');
  const hasWarning = results.some((result) => result.state === 'warning');
  const hasSuccess = results.some((result) => result.state === 'success');
  if (hasError && !hasSuccess && !hasWarning) {
    return 'error';
  }
  if (hasError || hasWarning) {
    return 'warning';
  }
  if (hasSuccess) {
    return 'success';
  }
  return 'info';
}

function formatUploadStatusSummary(results, totalFiles) {
  if (!Array.isArray(results) || !results.length) {
    return 'Ingen filer ble behandlet.';
  }
  const successCount = results.filter((result) => result.state === 'success').length;
  const errorCount = results.filter((result) => result.state === 'error').length;
  const warningCount = results.filter((result) => result.state === 'warning').length;
  let header = '';
  if (successCount && !errorCount && !warningCount) {
    header = successCount === 1
      ? 'Figuren ble lagt til i biblioteket.'
      : `${successCount} filer ble lagt til i biblioteket.`;
  } else if (successCount && errorCount) {
    header = `Fullførte ${successCount} av ${totalFiles} opplastinger.`;
  } else if (!successCount && errorCount) {
    header = errorCount === 1 ? 'Opplastingen mislyktes.' : 'Alle opplastingene mislyktes.';
  } else if (warningCount) {
    header = warningCount === 1 ? 'Opplastingen fullførte med en advarsel.' : 'Opplastingene fullførte med advarsler.';
  } else {
    header = 'Ingen filer ble behandlet.';
  }
  const details = results.map((result) => `• ${result.message}`);
  return [header, ...details].join('\n');
}

function extractApiErrorMessage(error, fallbackMessage) {
  if (!error) return fallbackMessage;
  if (error.payload && typeof error.payload.error === 'string' && error.payload.error.trim()) {
    return error.payload.error.trim();
  }
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return fallbackMessage;
}

function updateEditorScaleLabelState(categoryApps, entry = null) {
  if (!editorScaleLabelField || !editorScaleLabelInput) {
    return;
  }
  const shouldShow = shouldShowScaleLabelForApps(categoryApps);
  editorScaleLabelField.hidden = !shouldShow;
  editorScaleLabelInput.disabled = !shouldShow;
  if (!shouldShow) {
    editorScaleLabelInput.value = '';
    return;
  }
  const resolved = entry ? resolveScaleLabelForEntry(entry) : '';
  const currentValue = normalizeScaleLabel(editorScaleLabelInput.value);
  if (!currentValue) {
    editorScaleLabelInput.value = resolved || '';
  }
}

function openCustomEditor(entryId, trigger) {
  if (!editorDialog || !entryId) return;
  const entry = customEntryMap.get(entryId);
  if (!entry) {
    return;
  }
  editingEntryId = entryId;
  editorReturnFocus = trigger || null;
  if (editorNameInput) {
    editorNameInput.value = entry.name || '';
  }
  if (editorCategoryInput) {
    editorCategoryInput.value = entry.categoryName || '';
  }
  updateEditorScaleLabelState(entry.categoryApps || [], entry);
  if (editorErrorEl) {
    editorErrorEl.hidden = true;
    editorErrorEl.textContent = '';
  }
  try {
    if (typeof editorDialog.showModal === 'function') {
      editorDialog.showModal();
    } else {
      editorDialog.setAttribute('open', 'true');
    }
    editorNameInput?.focus();
  } catch (error) {
    editorDialog.setAttribute('open', 'true');
  }
}

function closeCustomEditor() {
  if (!editorDialog) return;
  try {
    if (typeof editorDialog.close === 'function') {
      editorDialog.close();
    } else {
      editorDialog.removeAttribute('open');
    }
  } catch (error) {
    editorDialog.removeAttribute('open');
  }
  if (editorErrorEl) {
    editorErrorEl.hidden = true;
    editorErrorEl.textContent = '';
  }
  if (editorNameInput) editorNameInput.value = '';
  if (editorCategoryInput) editorCategoryInput.value = '';
  if (editorScaleLabelInput) editorScaleLabelInput.value = '';
  if (editorScaleLabelField) {
    editorScaleLabelField.hidden = true;
  }
  if (editorScaleLabelInput) {
    editorScaleLabelInput.disabled = true;
  }
  const returnTarget = editorReturnFocus;
  editingEntryId = null;
  editorReturnFocus = null;
  if (returnTarget && typeof returnTarget.focus === 'function') {
    returnTarget.focus();
  }
}

async function handleEditorSubmit(event) {
  event.preventDefault();
  if (!editingEntryId) {
    closeCustomEditor();
    return;
  }
  const entry = customEntryMap.get(editingEntryId);
  if (!entry) {
    closeCustomEditor();
    return;
  }
  const nameValue = editorNameInput && editorNameInput.value ? editorNameInput.value.trim() : '';
  if (!nameValue) {
    if (editorErrorEl) {
      editorErrorEl.textContent = 'Navnet kan ikke være tomt.';
      editorErrorEl.hidden = false;
    }
    editorNameInput?.focus();
    return;
  }
  const categoryValue = editorCategoryInput && editorCategoryInput.value ? editorCategoryInput.value : '';
  const previousCategoryId = entry.categoryId;
  const categoryDetails = resolveCategoryDetails(categoryValue, previousCategoryId, nameValue);
  entry.name = nameValue;
  entry.categoryId = categoryDetails.id;
  entry.categoryName = categoryDetails.name;
  entry.categoryApps = categoryDetails.apps;
  if (shouldShowScaleLabelForApps(categoryDetails.apps)) {
    entry.scaleLabel = normalizeScaleLabel(editorScaleLabelInput?.value || '');
  }
  const normalizedSlug = typeof entry.slug === 'string' && entry.slug.trim() ? entry.slug.trim() : '';
  if (normalizedSlug) {
    entry.slug = normalizedSlug;
  } else if (typeof entry.entryId === 'string' && entry.entryId.trim()) {
    entry.slug = entry.entryId.trim();
  } else if (typeof entry.id === 'string' && entry.id.trim()) {
    entry.slug = entry.id.trim();
  }
  if (!entry.entryId) {
    entry.entryId = entry.slug || entry.id || editingEntryId;
  }
  entry.custom = true;
  if (typeof entry.entryId === 'string') {
    entry.entryId = entry.entryId.trim();
  }
  if (entry.entryId) {
    customEntryMap.set(entry.entryId, entry);
  }
  if (typeof entry.id === 'string') {
    entry.id = entry.id.trim();
  }
  if (entry.id) {
    customEntryMap.set(entry.id, entry);
  }
  try {
    const updatedEntry = await submitFigureEntry(entry, { method: 'PATCH' });
    const finalEntry = updatedEntry || entry;
    const shouldRestoreCategory = activeCategoryId === previousCategoryId && finalEntry.categoryId !== previousCategoryId;
    refreshLibrary();
    if (shouldRestoreCategory) {
      activeCategoryId = finalEntry.categoryId;
      updateCategorySelection();
      applyFilter();
    }
    setStatusMessage('Egendefinert figur oppdatert.', 'info');
    showUploadStatus('Figuren ble oppdatert.', 'success', { duration: 5000 });
    closeCustomEditor();
  } catch (error) {
    console.error('Kunne ikke oppdatere figur', error);
    const message = extractApiErrorMessage(error, 'Kunne ikke oppdatere figuren. Prøv igjen.');
    if (editorErrorEl) {
      editorErrorEl.textContent = message;
      editorErrorEl.hidden = false;
    }
  }
}

function resolveCategoryDetails(rawValue, fallbackId = null, fallbackName = '', options = {}) {
  const value = typeof rawValue === 'string' ? rawValue.trim() : '';
  const matchedCategory = findCategoryByValue(value);
  if (matchedCategory) {
    return {
      id: matchedCategory.id,
      name: getCategoryDisplayName(matchedCategory),
      type: matchedCategory.type || 'custom',
      apps: getCategoryApps(matchedCategory),
    };
  }

  if (!value && fallbackId && categoryMetaById.has(fallbackId)) {
    const fallbackCategory = categoryMetaById.get(fallbackId);
    return {
      id: fallbackCategory.id,
      name: getCategoryDisplayName(fallbackCategory),
      type: fallbackCategory.type || 'custom',
      apps: getCategoryApps(fallbackCategory),
    };
  }

  const baseName = value || fallbackName || 'Egendefinert';
  const selectedApps = options && Object.prototype.hasOwnProperty.call(options, 'selectedApps')
    ? options.selectedApps
    : undefined;
  const apps = sanitizeCategoryApps(selectedApps, { includeDefaults: selectedApps == null });
  const baseSlug = slugifyString(baseName) || 'figur';
  let candidateId = baseSlug.startsWith('custom') ? baseSlug : `custom-${baseSlug}`;
  const existingIds = new Set(categories.map((category) => category.id));
  customEntries.forEach((entry) => existingIds.add(entry.categoryId));
  let suffix = 1;
  while (existingIds.has(candidateId)) {
    candidateId = `${baseSlug}-${suffix++}`;
  }
  return { id: candidateId, name: baseName, type: 'custom', apps };
}

function getKnownCategories() {
  const base = Array.isArray(categories) && categories.length
    ? categories.slice()
    : Array.isArray(customCategories)
      ? customCategories.slice()
      : [];

  if (!customCategories.length) {
    return base;
  }

  const combined = Array.isArray(base) ? base.slice() : [];
  const seenIds = new Set();
  combined.forEach((category) => {
    if (category && typeof category.id === 'string') {
      seenIds.add(category.id);
    }
  });

  customCategories.forEach((category) => {
    if (!category || typeof category.id !== 'string') {
      return;
    }
    if (!seenIds.has(category.id)) {
      combined.push(category);
      seenIds.add(category.id);
    }
  });

  return combined;
}

function encodeSvgToDataUrl(svgText) {
  if (typeof svgText !== 'string') return null;
  const encoded = encodeURIComponent(svgText)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

function decodeSvgDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  const base64Match = trimmed.match(/^data:image\/svg\+xml;base64,/i);
  if (base64Match) {
    const base64Payload = trimmed.slice(base64Match[0].length);
    try {
      if (typeof atob === 'function') {
        return atob(base64Payload);
      }
      if (typeof globalThis !== 'undefined' && typeof globalThis.Buffer === 'function') {
        return globalThis.Buffer.from(base64Payload, 'base64').toString('utf-8');
      }
    } catch (error) {
      return null;
    }
    return null;
  }
  const prefixMatch = trimmed.match(/^data:image\/svg\+xml(?:;charset=utf-8)?,/i);
  if (!prefixMatch) {
    return null;
  }
  const encoded = trimmed.slice(prefixMatch[0].length);
  try {
    return decodeURIComponent(encoded);
  } catch (error) {
    return encoded;
  }
}

function deriveNameFromFile(fileName) {
  if (typeof fileName !== 'string') return '';
  const withoutExtension = fileName.replace(/\.svg$/i, '');
  const spaced = withoutExtension.replace(/[_-]+/g, ' ');
  return spaced.trim();
}

function createCustomEntryId(baseName, reservedIds = null) {
  const baseSlug = slugifyString(baseName) || 'figur';
  let candidate = `custom-${baseSlug}`;
  let suffix = 1;
  const reservationSet = reservedIds && typeof reservedIds.has === 'function' ? reservedIds : null;
  while (
    customEntryMap.has(candidate) ||
    customEntries.some((entry) => entry.id === candidate) ||
    (reservationSet && reservationSet.has(candidate))
  ) {
    candidate = `custom-${baseSlug}-${suffix++}`;
  }
  if (reservationSet) {
    reservationSet.add(candidate);
  }
  return candidate;
}

function slugifyString(value) {
  if (typeof value !== 'string') return '';
  let normalized = value.normalize ? value.normalize('NFKD') : value;
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');
  normalized = normalized.toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function getLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage || null;
  } catch (error) {
    return null;
  }
}

async function handleCopyClick(event) {
  const button = event.currentTarget;
  const path = button.dataset.path;
  if (!path) return;
  const container = button.closest('.bibliotekItem');
  if (!container) return;
  const feedback = container.querySelector('[data-feedback]');
  if (!feedback) return;

  try {
    const success = await copyToClipboard(path);
    if (success) {
      showCopyFeedback(feedback, `Kopierte ${path}`);
    } else {
      showCopyFeedback(feedback, 'Kunne ikke kopiere automatisk. Kopier teksten manuelt.');
    }
  } catch (error) {
    console.error('Kopiering mislyktes', error);
    showCopyFeedback(feedback, 'Kunne ikke kopiere automatisk. Kopier teksten manuelt.');
  }
}

async function copyToClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  const selection = document.getSelection();
  const selected = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch (error) {
    succeeded = false;
  }
  document.body.removeChild(textarea);
  if (selected) {
    selection.removeAllRanges();
    selection.addRange(selected);
  }
  return succeeded;
}

function resolveCategorySamplePath(category) {
  if (category.type === 'measure' && category.sampleImage) {
    return category.sampleImage;
  }
  if (category.sampleImage) {
    return category.sampleImage;
  }
  return DEFAULT_CATEGORY_THUMBNAIL;
}

function showCopyFeedback(element, message) {
  element.textContent = message;
  element.hidden = false;
  const existingTimer = copyFeedbackTimers.get(element);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(() => {
    element.hidden = true;
  }, 2500);
  copyFeedbackTimers.set(element, timer);
}
