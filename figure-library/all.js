import amountManifest from '../images/amounts/manifest-data.js';
import {
  CUSTOM_CATEGORY_ID,
  CUSTOM_FIGURE_ID,
  measurementFigureManifest,
  encodeMeasureImagePath,
  extractRealWorldSize,
  createFigurePickerHelpers,
  buildMeasurementFigureData,
  loadFigureLibrary as loadMeasurementFigureLibrary,
  getFigureLibraryMetadata as getMeasurementFigureLibraryMetadata,
  createFigureLibrary as createMeasurementFigureLibrary
} from './measurement.js';

const AMOUNT_IMAGE_BASE_PATH = '/images/amounts/';
const AMOUNT_FALLBACK_CATEGORY_ID = 'mengder';
const AMOUNT_FALLBACK_CATEGORY_LABEL = 'Mengder';

function normalizeOptions(options = {}) {
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

const amountCategoryDefinitions = [
  {
    id: 'tallbrikker',
    type: 'amount',
    label: 'Tallbrikker',
    matches: slug => slug.startsWith('n')
  },
  {
    id: 'penger',
    type: 'amount',
    label: 'Penger',
    matches: slug => slug.startsWith('v')
  },
  {
    id: 'terninger',
    type: 'amount',
    label: 'Terninger',
    matches: slug => slug.startsWith('d')
  },
  {
    id: 'hender',
    type: 'amount',
    label: 'Hender',
    matches: slug => slug.startsWith('h')
  }
];

function normalizeAmountEntry(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  const withoutDir = trimmed
    .replace(/^\.\/?/, '')
    .replace(/^images\//, '')
    .replace(/^amounts\//, '')
    .replace(/^images\/amounts\//, '');
  const withoutExt = withoutDir.toLowerCase().endsWith('.svg')
    ? withoutDir.slice(0, -4)
    : withoutDir;
  return withoutExt;
}

function ensureAmountImagePath(slug) {
  const normalizedSlug = normalizeAmountEntry(slug);
  if (!normalizedSlug) {
    return null;
  }
  return `${AMOUNT_IMAGE_BASE_PATH}${normalizedSlug}.svg`;
}

function getManifestSlugs(manifest) {
  if (manifest && Array.isArray(manifest.slugs)) {
    return manifest.slugs;
  }
  if (manifest && Array.isArray(manifest.files)) {
    return manifest.files.map(entry => normalizeAmountEntry(entry)).filter(Boolean);
  }
  return [];
}

function findAmountCategoryDefinition(slug) {
  for (const definition of amountCategoryDefinitions) {
    try {
      if (definition.matches && definition.matches(slug)) {
        return definition;
      }
    } catch (_) {
      // Ignore matcher errors and fall back to the default category
    }
  }
  return null;
}

function buildAmountFigureName(slug, definition) {
  const baseSlug = slug || '';
  if (!definition) {
    return baseSlug;
  }
  const label = definition.label || definition.id || '';
  if (!label) {
    return baseSlug;
  }
  return `${label} ${baseSlug}`.trim();
}

function buildAmountFigureData(manifest = amountManifest) {
  const categoryTemplates = amountCategoryDefinitions.map(definition => ({
    id: definition.id,
    type: definition.type || 'amount',
    label: definition.label || definition.id,
    figures: []
  }));

  const categoriesById = new Map();
  categoryTemplates.forEach(category => {
    categoriesById.set(category.id, category);
  });

  const fallbackCategory = {
    id: AMOUNT_FALLBACK_CATEGORY_ID,
    type: 'amount',
    label: AMOUNT_FALLBACK_CATEGORY_LABEL,
    figures: []
  };

  const seen = new Set();
  const slugs = getManifestSlugs(manifest);
  slugs.forEach(entry => {
    const slug = normalizeAmountEntry(entry);
    if (!slug || seen.has(slug)) {
      return;
    }
    seen.add(slug);

    const definition = findAmountCategoryDefinition(slug);
    const targetCategory = definition ? categoriesById.get(definition.id) : fallbackCategory;
    if (!targetCategory) {
      return;
    }

    const imagePath = ensureAmountImagePath(slug);
    if (!imagePath) {
      return;
    }

    const figure = {
      id: slug,
      slug,
      name: buildAmountFigureName(slug, definition),
      summary: '',
      image: imagePath,
      fileName: `${slug}.svg`,
      dimensions: '',
      scaleLabel: '',
      categoryId: targetCategory.id,
      type: targetCategory.type || 'amount',
      custom: false
    };

    targetCategory.figures.push(figure);
  });

  const categories = categoryTemplates.filter(category => category.figures.length > 0);
  if (fallbackCategory.figures.length > 0) {
    categories.push(fallbackCategory);
  }

  const byId = new Map();
  const byImage = new Map();
  categories.forEach(category => {
    category.figures.forEach(figure => {
      if (!byId.has(figure.id)) {
        byId.set(figure.id, figure);
      }
      if (figure.image && !byImage.has(figure.image)) {
        byImage.set(figure.image, figure);
      }
    });
  });

  return { categories, byId, byImage };
}

export function buildFigureData(options = {}) {
  const measurementData = buildMeasurementFigureData(normalizeOptions(options));
  const amountData = buildAmountFigureData();

  const categories = amountData.categories.concat(measurementData.categories);
  const byId = new Map(amountData.byId);
  const byImage = new Map(amountData.byImage);

  measurementData.byId.forEach((figure, key) => {
    if (!byId.has(key)) {
      byId.set(key, figure);
    }
  });

  measurementData.byImage.forEach((figure, key) => {
    if (!byImage.has(key)) {
      byImage.set(key, figure);
    }
  });

  return {
    categories,
    byId,
    byImage,
    metadata: measurementData.metadata
  };
}

function getMeasurementFiguresGroupedByCategory(options = {}) {
  const data = buildMeasurementFigureData(normalizeOptions(options));
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

export function getFiguresGroupedByCategory(options = {}) {
  const data = buildFigureData(options);
  return data.categories.map(category => ({
    id: category.id,
    label: category.label || category.id,
    figures: category.figures.map(figure => ({
      id: figure.id,
      name: figure.name,
      summary: figure.summary,
      image: figure.image
    }))
  }));
}

export {
  CUSTOM_CATEGORY_ID,
  CUSTOM_FIGURE_ID,
  measurementFigureManifest,
  encodeMeasureImagePath,
  extractRealWorldSize,
  createFigurePickerHelpers,
  buildMeasurementFigureData,
  getMeasurementFiguresGroupedByCategory,
  createMeasurementFigureLibrary as createFigureLibrary,
  loadMeasurementFigureLibrary,
  getMeasurementFigureLibraryMetadata
};

export const loadFigureLibrary = loadMeasurementFigureLibrary;
export const getFigureLibraryMetadata = getMeasurementFigureLibraryMetadata;
