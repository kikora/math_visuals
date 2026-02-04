const DEFAULT_LOCALE = 'nb';

export const CUSTOM_CATEGORY_ID = 'custom';
export const CUSTOM_FIGURE_ID = 'custom';
export const MEASURE_IMAGE_BASE_PATH = '';

const DEFAULT_FIGURE_LIBRARY_ENDPOINT = '/api/figure-library';
const REMOTE_LIBRARY_FALLBACK_CATEGORY_ID = 'remote-library';
const REMOTE_LIBRARY_FALLBACK_CATEGORY_LABEL = 'Opplastede figurer';

// The bundled figure data is shipped with the app and is therefore stable across reloads.
// Treat the default (pre-fetch) metadata as persistent so we don't warn users about
// temporary storage before we know the actual backend mode. Explicit metadata from
// the API will override these values (e.g. to signal `memory`/`kv`).
const defaultFigureLibraryMetadata = Object.freeze({
  storageMode: 'seed',
  storage: 'seed',
  mode: 'seed',
  persistent: true,
  ephemeral: false,
  limitation: ''
});

const measurementFigureLibraryState = {
  loaded: false,
  loadingPromise: null,
  categories: [],
  figures: [],
  categoryAppsById: new Map(),
  metadata: cloneFigureLibraryMetadata(defaultFigureLibraryMetadata)
};

export function encodeMeasureImagePath(fileName, options = {}) {
  if (!fileName) {
    return null;
  }
  const basePath = typeof options.basePath === 'string' ? options.basePath.trim() : '';
  const prefix = basePath ? basePath : MEASURE_IMAGE_BASE_PATH;
  if (!prefix) {
    return encodeURI(String(fileName));
  }
  const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;
  return encodeURI(`${normalized}${fileName}`);
}

export function extractRealWorldSize(helper, ...sources) {
  if (typeof helper !== 'function') {
    return null;
  }
  for (const source of sources) {
    if (!source) continue;
    const value = helper(source || '');
    if (value) {
      return value;
    }
  }
  return null;
}

export const measurementFigureManifest = {
  basePath: MEASURE_IMAGE_BASE_PATH,
  categories: []
};

measurementFigureManifest.categories.forEach(category => {
  if (!category || typeof category !== 'object') return;
  if (Array.isArray(category.figures)) {
    category.figures.forEach(figure => {
      if (figure && typeof figure === 'object') {
        Object.freeze(figure);
      }
    });
    Object.freeze(category.figures);
  }
  Object.freeze(category);
});
Object.freeze(measurementFigureManifest.categories);
Object.freeze(measurementFigureManifest);

function cloneFigureLibraryMetadata(metadata) {
  const base = {
    storageMode: defaultFigureLibraryMetadata.storageMode,
    storage: defaultFigureLibraryMetadata.storage,
    mode: defaultFigureLibraryMetadata.mode,
    persistent: defaultFigureLibraryMetadata.persistent,
    ephemeral: defaultFigureLibraryMetadata.ephemeral,
    limitation: defaultFigureLibraryMetadata.limitation
  };
  if (!metadata || typeof metadata !== 'object') {
    return base;
  }
  const modeHint = metadata.storageMode || metadata.mode || metadata.storage;
  const normalizedMode = normalizeStorageMode(modeHint);
  if (normalizedMode) {
    base.storageMode = normalizedMode;
    base.mode = normalizedMode;
    base.storage = normalizedMode;
    base.persistent = normalizedMode === 'kv';
    base.ephemeral = normalizedMode !== 'kv';
  }
  if (Object.prototype.hasOwnProperty.call(metadata, 'persistent')) {
    base.persistent = Boolean(metadata.persistent);
    if (base.persistent) {
      base.ephemeral = false;
    }
  }
  if (Object.prototype.hasOwnProperty.call(metadata, 'ephemeral')) {
    base.ephemeral = Boolean(metadata.ephemeral);
    if (base.ephemeral) {
      base.persistent = false;
    }
  }
  if (typeof metadata.limitation === 'string' && metadata.limitation.trim()) {
    base.limitation = metadata.limitation.trim();
  } else if (base.storageMode !== 'memory') {
    base.limitation = '';
  }
  return base;
}

function normalizeStorageMode(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized === 'kv' || normalized === 'vercel-kv') {
    return 'kv';
  }
  if (normalized === 'memory' || normalized === 'mem' || normalized === 'unconfigured') {
    return 'memory';
  }
  return normalized;
}

function normalizeLibraryIdentifier(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : '';
}

function normalizeOptionalText(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function encodeSvgToDataUrl(svgText) {
  if (typeof svgText !== 'string') {
    return null;
  }
  const trimmed = svgText.trim();
  if (!trimmed) {
    return null;
  }
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(trimmed)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22')}`;
}

function resolveLibraryFigureImage(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }
  const candidates = [];
  if (typeof entry.image === 'string') {
    candidates.push(entry.image);
  }
  if (typeof entry.dataUrl === 'string') {
    candidates.push(entry.dataUrl);
  }
  if (entry.urls && typeof entry.urls.svg === 'string') {
    candidates.push(entry.urls.svg);
  }
  const files = entry.files && typeof entry.files === 'object' ? entry.files : null;
  if (files) {
    if (typeof files.svg === 'string') {
      candidates.push(files.svg);
    } else if (files.svg && typeof files.svg.url === 'string') {
      candidates.push(files.svg.url);
    }
  }
  if (typeof entry.svgPath === 'string') {
    candidates.push(entry.svgPath);
  }
  if (typeof entry.svgUrl === 'string') {
    candidates.push(entry.svgUrl);
  }
  if (typeof entry.path === 'string') {
    candidates.push(entry.path);
  }
  if (typeof entry.asset === 'string') {
    candidates.push(entry.asset);
  }
  if (typeof entry.svg === 'string') {
    const encoded = encodeSvgToDataUrl(entry.svg);
    if (encoded) {
      candidates.push(encoded);
    }
  }
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const trimmed = candidate.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return '';
}

function normalizeAppIdentifier(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  let normalized = trimmed;
  if (normalized.normalize) {
    normalized = normalized.normalize('NFKD');
  }
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');
  normalized = normalized.toLowerCase();
  normalized = normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized;
}

function normalizeAppList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const seen = new Set();
  const apps = [];
  source.forEach(entry => {
    const normalized = normalizeAppIdentifier(entry);
    if (!normalized) {
      return;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    apps.push(normalized);
  });
  return apps;
}

function cloneAppList(apps) {
  if (!Array.isArray(apps)) {
    return [];
  }
  return normalizeAppList(apps);
}

function cloneCategoryAppsMap(source) {
  const map = new Map();
  if (!source) {
    return map;
  }
  if (source instanceof Map) {
    source.forEach((apps, id) => {
      if (Array.isArray(apps)) {
        const normalized = cloneAppList(apps);
        if (normalized.length || apps.length === 0) {
          map.set(id, normalized);
        }
      }
    });
    return map;
  }
  if (typeof source === 'object') {
    Object.keys(source).forEach(key => {
      const apps = source[key];
      if (Array.isArray(apps)) {
        const normalized = cloneAppList(apps);
        if (normalized.length || apps.length === 0) {
          map.set(key, normalized);
        }
      }
    });
  }
  return map;
}

function normalizeLibraryCategory(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const id = normalizeLibraryIdentifier(entry.id || entry.categoryId);
  if (!id) {
    return null;
  }
  const label = normalizeOptionalText(entry.label || entry.name || entry.title) || id;
  const description = normalizeOptionalText(entry.description);
  const apps = normalizeAppList(entry.apps);
  return { id, label, description, apps };
}

function normalizeLibraryFigure(entry, categoryLabels = new Map()) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const slug = normalizeLibraryIdentifier(entry.slug);
  const idSource = slug || normalizeLibraryIdentifier(entry.id);
  if (!idSource) {
    return null;
  }
  const image = resolveLibraryFigureImage(entry);
  if (!image) {
    return null;
  }
  const nameCandidates = [entry.name, entry.title, idSource, slug];
  let name = '';
  for (const candidate of nameCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      name = candidate.trim();
      break;
    }
  }
  if (!name) {
    name = idSource;
  }
  const rawCategoryId = normalizeLibraryIdentifier(
    entry.categoryId || (entry.category && entry.category.id)
  );
  const categoryLabelCandidates = [
    normalizeOptionalText(entry.categoryName),
    entry.category && normalizeOptionalText(entry.category.label),
    categoryLabels.get(rawCategoryId),
    rawCategoryId
  ];
  let categoryLabel = '';
  for (const candidate of categoryLabelCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      categoryLabel = candidate.trim();
      break;
    }
  }
  const summary = normalizeOptionalText(entry.summary);
  const description = normalizeOptionalText(entry.description);
  const dimensions = normalizeOptionalText(entry.dimensions);
  const scaleLabel = normalizeOptionalText(entry.scaleLabel || entry.scale);
  const fileName = normalizeOptionalText(entry.fileName);
  const tags = Array.isArray(entry.tags)
    ? entry.tags
        .map(tag => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(tag => tag)
    : [];
  const createdAt = typeof entry.createdAt === 'string' && entry.createdAt.trim()
    ? entry.createdAt.trim()
    : null;
  const updatedAt = typeof entry.updatedAt === 'string' && entry.updatedAt.trim()
    ? entry.updatedAt.trim()
    : null;
  const dataUrl = typeof entry.dataUrl === 'string' && entry.dataUrl.trim()
    ? entry.dataUrl.trim()
    : image.startsWith('data:')
      ? image
      : '';
  const categoryApps = normalizeAppList(entry.category && entry.category.apps);
  const apps = normalizeAppList(entry.apps);
  return {
    id: `remote:${idSource}`,
    slug: idSource,
    name,
    categoryId: rawCategoryId,
    categoryLabel,
    image,
    dataUrl,
    summary,
    description,
    dimensions,
    scaleLabel,
    fileName,
    tags,
    createdAt,
    updatedAt,
    categoryApps,
    apps,
    storageMode: normalizeStorageMode(entry.storageMode || entry.mode || entry.storage)
  };
}

function normalizeLibraryMetadata(payload, response) {
  const metadata = {};
  if (payload && typeof payload === 'object') {
    Object.assign(metadata, payload);
  }
  if (response && typeof response.headers?.get === 'function') {
    const modeHeader = response.headers.get('X-Figure-Library-Store-Mode');
    if (modeHeader && !metadata.storageMode && !metadata.mode && !metadata.storage) {
      metadata.mode = modeHeader;
    }
  }
  return cloneFigureLibraryMetadata(metadata);
}

function normalizeMeasurementFigureLibraryPayload(payload, response) {
  const categories = [];
  const figures = [];
  const categoryLabels = new Map();
  const categoryAppLists = new Map();
  if (payload && Array.isArray(payload.categories)) {
    payload.categories.forEach(entry => {
      const normalized = normalizeLibraryCategory(entry);
      if (!normalized) {
        return;
      }
      categories.push(normalized);
      categoryLabels.set(normalized.id, normalized.label);
      if (Array.isArray(normalized.apps) && normalized.apps.length) {
        categoryAppLists.set(normalized.id, cloneAppList(normalized.apps));
      }
    });
  }
  const entries = Array.isArray(payload && payload.entries)
    ? payload.entries
    : payload && payload.entry
      ? [payload.entry]
      : [];
  entries.forEach(entry => {
    const normalized = normalizeLibraryFigure(entry, categoryLabels);
    if (!normalized) {
      return;
    }
    if (normalized.categoryId && !categoryLabels.has(normalized.categoryId)) {
      categoryLabels.set(normalized.categoryId, normalized.categoryLabel || normalized.categoryId);
    }
    if (normalized.categoryId && Array.isArray(normalized.categoryApps) && normalized.categoryApps.length) {
      if (!categoryAppLists.has(normalized.categoryId)) {
        categoryAppLists.set(normalized.categoryId, cloneAppList(normalized.categoryApps));
      }
    }
    figures.push(normalized);
  });
  const metadata = normalizeLibraryMetadata(payload, response);
  const categoriesWithApps = categories.map(category => ({
    ...category,
    apps: Array.isArray(category.apps) ? cloneAppList(category.apps) : []
  }));
  const categoryAppsById = new Map();
  categoriesWithApps.forEach(category => {
    if (Array.isArray(category.apps) && category.apps.length) {
      categoryAppsById.set(category.id, cloneAppList(category.apps));
    }
  });
  categoryAppLists.forEach((apps, id) => {
    if (Array.isArray(apps) && apps.length && !categoryAppsById.has(id)) {
      categoryAppsById.set(id, cloneAppList(apps));
    }
  });
  return {
    categories: categoriesWithApps,
    figures: figures.map(figure => {
      const categoryApps = Array.isArray(figure.categoryApps) && figure.categoryApps.length
        ? cloneAppList(figure.categoryApps)
        : categoryAppsById.has(figure.categoryId)
          ? categoryAppsById.get(figure.categoryId).slice()
          : [];
      return {
        ...figure,
        categoryApps
      };
    }),
    metadata,
    categoryApps: categoryAppsById
  };
}

function parseJsonResponse(response) {
  if (!response || typeof response.text !== 'function') {
    return Promise.resolve({});
  }
  return response.text().then(text => {
    if (!text) {
      return {};
    }
    const normalizedText = text.replace(/^\ufeff/, '').trim();
    if (!normalizedText) {
      return {};
    }
    const contentType = response && response.headers && typeof response.headers.get === 'function'
      ? response.headers.get('content-type')
      : '';
    const isJsonContentType = typeof contentType === 'string' && /json/i.test(contentType);
    const looksLikeHtml = /<html[\s>]/i.test(normalizedText) || /^<!doctype html>/i.test(normalizedText);
    if (response.ok && looksLikeHtml && !isJsonContentType) {
      const snippet = normalizedText.slice(0, 200);
      const message = 'Figure library returned HTML instead of JSON';
      const error = new Error(response.url ? `${message}: ${response.url}` : message);
      error.response = response;
      error.payload = { snippet };
      throw error;
    }
    try {
      return JSON.parse(normalizedText);
    } catch (error) {
      if (response.ok) {
        const parsingError = new Error('Invalid JSON response from figure library');
        parsingError.response = response;
        parsingError.cause = error;
        throw parsingError;
      }
      return {};
    }
  });
}

function isHtmlResponseError(error) {
  if (!error) return false;
  if (typeof error.message === 'string' && error.message.includes('Figure library returned HTML')) {
    return true;
  }
  if (error.payload && typeof error.payload.snippet === 'string' && /<html/i.test(error.payload.snippet)) {
    return true;
  }
  return false;
}

function resolveFigureLibraryFallbackEndpoints(url) {
  const normalized = typeof url === 'string' ? url.trim() : '';
  const fallbackEndpoints = new Set();
  if (!normalized) return [];
  const base = normalized.replace(/\/$/, '');
  if (base === '/api/figure-library') {
    fallbackEndpoints.add('/figure-library');
  }
  if (!/\/raw$/i.test(base)) {
    fallbackEndpoints.add(`${base}/raw`);
  }
  return Array.from(fallbackEndpoints);
}

function extractScaleLabelFromFileName(fileName) {
  if (typeof fileName !== 'string') {
    return '';
  }
  const stripped = fileName.replace(/\.[^.]*$/, '');
  let decoded = stripped;
  try {
    decoded = decodeURI(stripped);
  } catch (_) {}
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

function shapeRemoteMeasurementFigure(remoteFigure, options = {}) {
  if (!remoteFigure || typeof remoteFigure !== 'object') {
    return null;
  }
  if (typeof remoteFigure.image !== 'string' || !remoteFigure.image.trim()) {
    return null;
  }
  const dimensions = typeof remoteFigure.dimensions === 'string' ? remoteFigure.dimensions : '';
  const summarySource = typeof remoteFigure.summary === 'string' && remoteFigure.summary.trim()
    ? remoteFigure.summary.trim()
    : '';
  const description = typeof remoteFigure.description === 'string' && remoteFigure.description.trim()
    ? remoteFigure.description.trim()
    : '';
  const fileName = typeof remoteFigure.fileName === 'string' ? remoteFigure.fileName : '';
  let scaleLabel = typeof remoteFigure.scaleLabel === 'string' && remoteFigure.scaleLabel.trim()
    ? remoteFigure.scaleLabel.trim()
    : extractScaleLabelFromFileName(fileName);
  const summaryParts = [];
  if (summarySource) {
    summaryParts.push(summarySource);
  } else if (dimensions) {
    summaryParts.push(dimensions);
  } else if (description) {
    summaryParts.push(description);
  }
  if (scaleLabel) {
    summaryParts.push(`målestokk ${scaleLabel}`);
  }
  const summary = summaryParts.join(' – ');
  const realWorldSize = extractRealWorldSize(
    options.extractRealWorldSizeFromText,
    dimensions,
    summarySource,
    description
  );
  const tags = Array.isArray(remoteFigure.tags) ? remoteFigure.tags.slice() : [];
  const categoryApps = Array.isArray(remoteFigure.categoryApps)
    ? normalizeAppList(remoteFigure.categoryApps)
    : [];
  const figureApps = Array.isArray(remoteFigure.apps)
    ? normalizeAppList(remoteFigure.apps)
    : [];
  const combinedApps = categoryApps.length ? categoryApps : figureApps;
  return {
    id: remoteFigure.id,
    slug: remoteFigure.slug,
    name: remoteFigure.name,
    image: remoteFigure.image,
    fileName: fileName || null,
    dimensions,
    scaleLabel,
    summary,
    realWorldSize,
    categoryId: remoteFigure.categoryId || '',
    categoryLabel: remoteFigure.categoryLabel || '',
    dataUrl: remoteFigure.dataUrl || '',
    tags,
    createdAt: remoteFigure.createdAt || null,
    updatedAt: remoteFigure.updatedAt || null,
    storageMode: remoteFigure.storageMode || null,
    source: 'api',
    custom: true,
    remote: true,
    apps: combinedApps,
    categoryApps,
    figureApps
  };
}

export function createMeasurementFigureLibrary(options = {}) {
  const { extractRealWorldSizeFromText } = options;

  return measurementFigureManifest.categories.map(category => ({
    id: category.id,
    label: category.label,
    figures: category.figures.map(figure => {
      const summaryParts = [];
      if (figure.summary) {
        summaryParts.push(figure.summary);
      } else if (figure.dimensions) {
        summaryParts.push(figure.dimensions);
      }
      if (figure.scaleLabel) {
        summaryParts.push(`målestokk ${figure.scaleLabel}`);
      }
      return {
        id: figure.id,
        name: figure.name,
        image: encodeMeasureImagePath(figure.fileName),
        fileName: figure.fileName || null,
        dimensions: figure.dimensions || '',
        scaleLabel: figure.scaleLabel || '',
        summary: summaryParts.join(' – '),
        realWorldSize: extractRealWorldSize(
          extractRealWorldSizeFromText,
          figure.dimensions,
          figure.summary,
          figure.fileName
        )
      };
    })
  }));
}

function buildAllowedApps(options = {}) {
  const allowed = new Set();
  function add(value) {
    const normalized = normalizeAppIdentifier(value);
    if (!normalized) {
      return;
    }
    allowed.add(normalized.toLowerCase());
  }
  if (options && typeof options.app === 'string') {
    add(options.app);
  }
  const lists = [options.apps, options.allowedApps];
  lists.forEach(list => {
    if (Array.isArray(list)) {
      list.forEach(add);
    }
  });
  return allowed;
}

function normalizeMeasurementFigureOptions(options = {}) {
  if (typeof options === 'string') {
    return { app: options };
  }
  if (Array.isArray(options)) {
    return { allowedApps: options };
  }
  if (!options || typeof options !== 'object') {
    return {};
  }
  return options;
}

function shouldRequireScaleLabel(options = {}, allowedApps = new Set()) {
  if (options && typeof options.requireScaleLabel === 'boolean') {
    return options.requireScaleLabel;
  }
  return allowedApps.has('maling');
}

function isCategoryAllowed(apps, allowedSet) {
  if (!allowedSet || !allowedSet.size) {
    return true;
  }
  const normalized = normalizeAppList(apps);
  if (!normalized.length) {
    return true;
  }
  return normalized.some(entry => allowedSet.has(entry.toLowerCase()));
}

export function buildMeasurementFigureData(options = {}) {
  const resolvedOptions = normalizeMeasurementFigureOptions(options);
  const allowedApps = buildAllowedApps(resolvedOptions);
  const requireScaleLabel = shouldRequireScaleLabel(resolvedOptions, allowedApps);
  const categories = createMeasurementFigureLibrary(resolvedOptions).map(category => ({
    id: category.id,
    label: category.label,
    figures: category.figures
      .filter(figure => !requireScaleLabel || (figure && figure.scaleLabel))
      .map(figure => ({
        ...figure,
        categoryId: category.id,
        custom: !!figure.custom
      }))
  }))
    .filter(category => category.figures.length > 0);

  const categoriesById = new Map();
  categories.forEach(category => {
    categoriesById.set(category.id, category);
  });

  const remoteFigures = Array.isArray(measurementFigureLibraryState.figures)
    ? measurementFigureLibraryState.figures
    : [];
  if (remoteFigures.length) {
    const remoteCategoryLabels = new Map();
    const remoteCategoryApps = new Map();
    if (measurementFigureLibraryState.categoryAppsById && typeof measurementFigureLibraryState.categoryAppsById.forEach === 'function') {
      measurementFigureLibraryState.categoryAppsById.forEach((apps, id) => {
        if (!id) {
          return;
        }
        if (Array.isArray(apps)) {
          remoteCategoryApps.set(id, cloneAppList(apps));
        }
      });
    }
    if (Array.isArray(measurementFigureLibraryState.categories)) {
      measurementFigureLibraryState.categories.forEach(entry => {
        const normalizedId = normalizeLibraryIdentifier(entry && entry.id);
        if (!normalizedId) {
          return;
        }
        const label = typeof entry.label === 'string' && entry.label.trim()
          ? entry.label.trim()
          : normalizedId;
        remoteCategoryLabels.set(normalizedId, label);
        if (Array.isArray(entry.apps)) {
          const apps = cloneAppList(entry.apps);
          if (apps.length || entry.apps.length === 0) {
            remoteCategoryApps.set(normalizedId, apps);
          }
        }
      });
    }
    remoteFigures.forEach(remoteFigure => {
      const shaped = shapeRemoteMeasurementFigure(remoteFigure, resolvedOptions);
      if (!shaped) {
        return;
      }
      let targetCategoryId = normalizeLibraryIdentifier(shaped.categoryId);
      if (!targetCategoryId) {
        targetCategoryId = REMOTE_LIBRARY_FALLBACK_CATEGORY_ID;
      }
      const existingAppList = remoteCategoryApps.has(targetCategoryId)
        ? remoteCategoryApps.get(targetCategoryId)
        : null;
      const figureApps = Array.isArray(shaped.figureApps) && shaped.figureApps.length
        ? cloneAppList(shaped.figureApps)
        : Array.isArray(shaped.apps)
          ? cloneAppList(shaped.apps)
          : [];
      const categoryAppsSource = existingAppList != null
        ? existingAppList
        : shaped.categoryApps && shaped.categoryApps.length
          ? shaped.categoryApps
          : shaped.apps;
      const categoryApps = Array.isArray(categoryAppsSource)
        ? cloneAppList(categoryAppsSource)
        : [];
      if (existingAppList == null) {
        remoteCategoryApps.set(targetCategoryId, categoryApps.slice());
      }
      const categoryAllowed = isCategoryAllowed(categoryApps, allowedApps);
      const figureAllowed = isCategoryAllowed(figureApps, allowedApps);
      if ((!categoryAllowed && !figureAllowed) || (requireScaleLabel && !shaped.scaleLabel)) {
        return;
      }
      let category = categoriesById.get(targetCategoryId);
      if (!category) {
        const resolvedLabel = targetCategoryId === REMOTE_LIBRARY_FALLBACK_CATEGORY_ID
          ? REMOTE_LIBRARY_FALLBACK_CATEGORY_LABEL
          : shaped.categoryLabel || remoteCategoryLabels.get(targetCategoryId) || targetCategoryId;
        category = {
          id: targetCategoryId,
          label: resolvedLabel,
          figures: [],
          apps: categoryApps.slice()
        };
        categories.push(category);
        categoriesById.set(category.id, category);
      } else if (category.apps == null || category.apps === undefined) {
        category.apps = categoryApps.slice();
      } else if (Array.isArray(categoryApps) && categoryApps.length) {
        category.apps = categoryApps.slice();
      }
      const figure = {
        ...shaped,
        categoryId: category.id
      };
      category.figures.push(figure);
    });
  }

  const customCategory = {
    id: CUSTOM_CATEGORY_ID,
    label: 'Egendefinert',
    figures: [
      {
        id: CUSTOM_FIGURE_ID,
        name: 'Egendefinert figur',
        image: null,
        fileName: null,
        dimensions: '',
        scaleLabel: '',
        summary: '',
        categoryId: CUSTOM_CATEGORY_ID,
        custom: true,
        realWorldSize: null
      }
    ]
  };

  categories.push(customCategory);

  const byId = new Map();
  const byImage = new Map();

  for (const category of categories) {
    for (const figure of category.figures) {
      if (!byId.has(figure.id)) {
        byId.set(figure.id, figure);
      }
      if (figure.image && !byImage.has(figure.image)) {
        byImage.set(figure.image, figure);
      }
    }
  }

  return {
    categories,
    byId,
    byImage,
    metadata: cloneFigureLibraryMetadata(measurementFigureLibraryState.metadata)
  };
}

export function getMeasurementFiguresGroupedByCategory(options = {}) {
  const data = buildMeasurementFigureData(options);
  return data.categories.map(category => ({
    id: category.id,
    label: category.label,
    figures: category.figures.map(figure => ({
      id: figure.id,
      name: figure.name,
      summary: figure.summary,
      image: figure.image
    }))
  }));
}

export const createFigureLibrary = createMeasurementFigureLibrary;
export const buildFigureData = buildMeasurementFigureData;
export const getFiguresGroupedByCategory = getMeasurementFiguresGroupedByCategory;
export const loadFigureLibrary = loadMeasurementFigureLibrary;
export { createFigurePickerHelpers } from './figure-picker.js';

const manifestCache = new Map();

export function fetchFigureManifest(url, options = {}) {
  if (typeof url !== 'string' || !url.trim()) {
    return Promise.reject(new TypeError('fetchFigureManifest: url must be a non-empty string'));
  }
  const normalizedUrl = url.trim();
  const {
    fetch: fetchOverride,
    cacheKey,
    cache: cacheMode = 'no-store',
    ...fetchOptions
  } = options;
  const resolvedCacheKey = typeof cacheKey === 'string' && cacheKey ? cacheKey : normalizedUrl;
  if (manifestCache.has(resolvedCacheKey)) {
    return manifestCache.get(resolvedCacheKey);
  }
  const fetchImpl = typeof fetchOverride === 'function'
    ? fetchOverride
    : typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
      ? globalThis.fetch
      : null;
  if (!fetchImpl) {
    return Promise.reject(new Error('fetchFigureManifest: no fetch implementation available'));
  }
  const request = fetchImpl(normalizedUrl, { cache: cacheMode, ...fetchOptions })
    .then(response => {
      if (!response || typeof response.ok !== 'boolean') {
        throw new Error('fetchFigureManifest: invalid response');
      }
      if (!response.ok) {
        throw new Error(`fetchFigureManifest: HTTP ${response.status}`);
      }
      return response.json();
    })
    .catch(error => {
      manifestCache.delete(resolvedCacheKey);
      throw error;
    });
  manifestCache.set(resolvedCacheKey, request);
  return request;
}

export function loadMeasurementFigureLibrary(options = {}) {
  const {
    fetch: fetchOverride,
    endpoint,
    force,
    refresh,
    headers: extraHeaders,
    ...fetchOptions
  } = options || {};
  const url = typeof endpoint === 'string' && endpoint.trim() ? endpoint.trim() : DEFAULT_FIGURE_LIBRARY_ENDPOINT;
  const fetchImpl = typeof fetchOverride === 'function'
    ? fetchOverride
    : typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
      ? globalThis.fetch.bind(globalThis)
      : null;
  if (!fetchImpl) {
    return Promise.reject(new Error('loadMeasurementFigureLibrary: no fetch implementation available'));
  }
  if (!force && !refresh && measurementFigureLibraryState.loaded) {
    return Promise.resolve({
      categories: Array.isArray(measurementFigureLibraryState.categories)
        ? measurementFigureLibraryState.categories.slice()
        : [],
      figures: Array.isArray(measurementFigureLibraryState.figures)
        ? measurementFigureLibraryState.figures.slice()
        : [],
      metadata: cloneFigureLibraryMetadata(measurementFigureLibraryState.metadata)
    });
  }
  if (measurementFigureLibraryState.loadingPromise) {
    return measurementFigureLibraryState.loadingPromise;
  }
  const headers = Object.assign({ Accept: 'application/json' }, extraHeaders && typeof extraHeaders === 'object' ? extraHeaders : {});
  const requestInit = {
    method: 'GET',
    headers,
    cache: 'no-store',
    ...fetchOptions
  };
  const endpoints = [url, ...resolveFigureLibraryFallbackEndpoints(url)];

  const attemptLoad = currentIndex => {
    const targetUrl = endpoints[currentIndex];
    return fetchImpl(targetUrl, requestInit)
      .then(response => parseJsonResponse(response).then(data => ({ response, data })))
      .then(({ response, data }) => {
        if (!response || typeof response.ok !== 'boolean') {
          throw new Error('loadMeasurementFigureLibrary: invalid response');
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
        const normalized = normalizeMeasurementFigureLibraryPayload(data, response);
        measurementFigureLibraryState.categories = normalized.categories;
        measurementFigureLibraryState.figures = normalized.figures;
        measurementFigureLibraryState.categoryAppsById = cloneCategoryAppsMap(normalized.categoryApps);
        measurementFigureLibraryState.metadata = cloneFigureLibraryMetadata(normalized.metadata);
        measurementFigureLibraryState.loaded = true;
        measurementFigureLibraryState.loadingPromise = null;
        return {
          categories: Array.isArray(measurementFigureLibraryState.categories)
            ? measurementFigureLibraryState.categories.slice()
            : [],
          figures: Array.isArray(measurementFigureLibraryState.figures)
            ? measurementFigureLibraryState.figures.slice()
            : [],
          metadata: cloneFigureLibraryMetadata(measurementFigureLibraryState.metadata)
        };
      })
      .catch(error => {
        const nextIndex = currentIndex + 1;
        if (isHtmlResponseError(error) && nextIndex < endpoints.length) {
          return attemptLoad(nextIndex);
        }
        throw error;
      });
  };

  const request = attemptLoad(0).catch(error => {
    measurementFigureLibraryState.loadingPromise = null;
    throw error;
  });
  measurementFigureLibraryState.loadingPromise = request;
  return request;
}

export function getMeasurementFigureLibraryMetadata() {
  return cloneFigureLibraryMetadata(measurementFigureLibraryState.metadata);
}

export function extractFigureLibrarySlugs(payload) {
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  if (Array.isArray(payload.slugs) && payload.slugs.length) {
    return payload.slugs
      .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
      .filter(entry => entry);
  }
  if (Array.isArray(payload.files) && payload.files.length) {
    return payload.files
      .map(entry => {
        if (typeof entry !== 'string') return '';
        return entry.replace(/\.svg$/i, '').trim();
      })
      .filter(entry => entry);
  }
  return [];
}

export function buildFigureLibraryOptions(slugs, options = {}) {
  const categories = Array.isArray(options.categories) ? options.categories : [];
  const defaultCategoryId = typeof options.defaultCategoryId === 'string' && options.defaultCategoryId
    ? options.defaultCategoryId
    : categories.length > 0
      ? categories[0].id
      : '';
  const locale = typeof options.locale === 'string' && options.locale ? options.locale : DEFAULT_LOCALE;

  const optionsByCategory = new Map();
  categories.forEach(category => {
    if (category && typeof category.id === 'string') {
      optionsByCategory.set(category.id, []);
    }
  });

  const optionsByValue = new Map();

  if (!Array.isArray(slugs)) {
    return { optionsByCategory, optionsByValue };
  }

  slugs.forEach(rawSlug => {
    if (typeof rawSlug !== 'string') return;
    const trimmed = rawSlug.trim();
    if (!trimmed) return;
    const baseSlug = trimmed.replace(/\.svg$/i, '');
    const value = `${baseSlug}.svg`;
    const label = baseSlug;
    const lowerValue = value.toLowerCase();
    if (optionsByValue.has(lowerValue)) {
      return;
    }
    const lowerLabel = label.toLowerCase();
    let categoryId = defaultCategoryId;
    for (const category of categories) {
      if (!category || typeof category.prefix !== 'string' || !category.prefix) continue;
      if (lowerLabel.startsWith(category.prefix)) {
        categoryId = category.id;
        break;
      }
    }
    const option = { value, label, categoryId };
    const list = optionsByCategory.get(categoryId);
    if (Array.isArray(list)) {
      list.push(option);
    } else if (categoryId) {
      optionsByCategory.set(categoryId, [option]);
    }
    optionsByValue.set(lowerValue, option);
    if (!optionsByValue.has(lowerLabel)) {
      optionsByValue.set(lowerLabel, option);
    }
  });

  optionsByCategory.forEach(list => {
    if (!Array.isArray(list) || list.length < 2) return;
    list.sort((a, b) => a.label.localeCompare(b.label, locale, { numeric: true, sensitivity: 'base' }));
  });

  return { optionsByCategory, optionsByValue };
}

export function clearFigureManifestCache(cacheKey) {
  if (typeof cacheKey === 'string' && cacheKey) {
    manifestCache.delete(cacheKey);
  } else {
    manifestCache.clear();
  }
}
