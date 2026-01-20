(() => {
  const grid = document.querySelector('[data-svg-grid]');
  const statusElement = document.querySelector('[data-status]');
  const filterWrapper = document.querySelector('[data-filter-wrapper]');
  const filterSelect = document.querySelector('[data-tool-filter]');
  const searchInput = document.querySelector('[data-search-input]');
  const sortSelect = document.querySelector('[data-sort-order]');
  const storageNote = document.querySelector('[data-storage-note]');
  const trashToggle = document.querySelector('[data-trash-toggle]');
  const trashArchive = document.querySelector('[data-trash-archive]');
  const trashClose = document.querySelector('[data-trash-close]');
  const trashStatus = document.querySelector('[data-trash-status]');
  const trashList = document.querySelector('[data-trash-list]');
  const trashEmpty = document.querySelector('[data-trash-empty]');
  const selectionBar = document.querySelector('[data-selection-bar]');
  const selectAllToggle = document.querySelector('[data-select-all]');
  const selectionCountElement = document.querySelector('[data-selection-count]');
  const renameSelectedButton = document.querySelector('[data-selection-rename]');
  const sizeSelect = document.querySelector('[data-size-select]');
  const pageBody = document.querySelector('.svg-archive-page');
  const rootElement = document.documentElement;

  if (!grid || !statusElement) {
    return;
  }

  if (pageBody) {
    pageBody.classList.add('svg-archive-page--compact');
  }

  let allEntries = [];
  let visibleEntries = [];
  let archiveDialog = null;
  let renameDialog = null;
  let trashRestoreFocusTo = null;
  const defaultTrashToggleLabel = (trashToggle?.dataset.labelDefault || trashToggle?.textContent || '').trim() || 'Vis slettede figurer';
  const activeTrashToggleLabel = (trashToggle?.dataset.labelActive || '').trim() || 'Skjul slettede figurer';
  const focusableSelectors = [
    'button:not([disabled]):not([tabindex="-1"])',
    '[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  const nameCollator = typeof Intl !== 'undefined' && typeof Intl.Collator === 'function'
    ? new Intl.Collator('nb', { sensitivity: 'base', numeric: true })
    : null;

  const TrashArchiveViewerModule = window.MathVisualsTrashArchiveViewer || null;
  const TrashArchiveViewerClass = TrashArchiveViewerModule ? TrashArchiveViewerModule.TrashArchiveViewer : null;
  const trashViewerState = {
    groups: [],
    groupsMap: new Map(),
    filter: 'all',
    metadata: null,
    lastFetchUsedFallback: false
  };
  let trashViewer = null;
  let trashViewerInitialized = false;
  const svgApiBase = resolveSvgApiBase();
  const examplesApiBase = TrashArchiveViewerClass
    ? TrashArchiveViewerClass.resolveExamplesApiBase()
    : null;
  const trashApiBase = TrashArchiveViewerClass
    ? TrashArchiveViewerClass.buildTrashApiBase(examplesApiBase)
    : null;
  const TRASH_QUEUE_STORAGE_KEY = 'mathvis:examples:trashQueue:v1';
  const ARCHIVE_CACHE_STORAGE_KEY = 'mathvis:svgArchive:cache:v1';
  const ARCHIVE_SIZE_STORAGE_KEY = 'mathvis:svgArchive:cardSize:v1';
  const ARCHIVE_SIZE_CLASS_PREFIX = 'svg-archive-size--';
  const ARCHIVE_SIZE_PRESETS = {
    small: '180px',
    medium: '220px',
    large: '260px'
  };
  const ARCHIVE_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
  let manualTrashReplayInFlight = false;
  const entryDetailsCache = new Map();
  const entryDetailsPending = new Map();
  const entryAltTextCache = new Map();
  const selectedSlugs = new Set();
  let cardIdCounter = 0;

  function readArchiveSizePreference() {
    if (typeof window === 'undefined') {
      return 'medium';
    }
    try {
      const stored = window.localStorage.getItem(ARCHIVE_SIZE_STORAGE_KEY);
      if (stored && ARCHIVE_SIZE_PRESETS[stored]) {
        return stored;
      }
    } catch (error) {
      return 'medium';
    }
    return 'medium';
  }

  function writeArchiveSizePreference(size) {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      window.localStorage.setItem(ARCHIVE_SIZE_STORAGE_KEY, size);
    } catch (error) {}
  }

  function applyArchiveSize(size) {
    const resolvedSize = ARCHIVE_SIZE_PRESETS[size] ? size : 'medium';
    const minWidth = ARCHIVE_SIZE_PRESETS[resolvedSize];
    if (rootElement) {
      const classesToRemove = Object.keys(ARCHIVE_SIZE_PRESETS).map(
        (preset) => `${ARCHIVE_SIZE_CLASS_PREFIX}${preset}`
      );
      rootElement.classList.remove(...classesToRemove);
      rootElement.classList.add(`${ARCHIVE_SIZE_CLASS_PREFIX}${resolvedSize}`);
      rootElement.style.setProperty('--archive-card-min', minWidth);
    }
    if (sizeSelect) {
      sizeSelect.value = resolvedSize;
    }
  }

  function getGlobalTrashQueue() {
    const globalObject = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
    if (!globalObject) {
      return null;
    }
    const queue = globalObject.MathVisExamplesTrashQueue;
    if (!queue || typeof queue !== 'object') {
      return null;
    }
    if (typeof queue.flushPending === 'function') {
      return queue;
    }
    if (typeof queue.flush === 'function') {
      return queue;
    }
    return null;
  }

  applyArchiveSize(readArchiveSizePreference());
  if (sizeSelect) {
    sizeSelect.addEventListener('change', () => {
      const value = sizeSelect.value;
      applyArchiveSize(value);
      writeArchiveSizePreference(value);
    });
  }

  function resolveSvgApiBase() {
    if (typeof window === 'undefined') return null;
    if (window.MATH_VISUALS_SVG_API_URL) {
      const value = String(window.MATH_VISUALS_SVG_API_URL).trim();
      if (value) return value;
    }
    const origin = window.location && window.location.origin;
    if (typeof origin === 'string' && /^https?:/i.test(origin)) {
      return '/api/svg';
    }
    return null;
  }

  function buildSvgApiUrl(path = '') {
    if (!svgApiBase) return null;
    const base = svgApiBase.replace(/\/+$/, '');
    if (!path) return base;
    if (path.startsWith('?')) {
      return `${base}${path}`;
    }
    const normalized = path.replace(/^\/+/, '');
    return `${base}/${normalized}`;
  }

  function getTrashQueueStorage() {
    if (typeof window === 'undefined') {
      return null;
    }
    const storage = window.localStorage;
    if (!storage) {
      return null;
    }
    try {
      const probeKey = `${TRASH_QUEUE_STORAGE_KEY}__probe`;
      storage.setItem(probeKey, '1');
      storage.removeItem(probeKey);
      return storage;
    } catch (error) {
      return null;
    }
  }

  function readQueuedTrashEntries() {
    const storage = getTrashQueueStorage();
    if (!storage) {
      return [];
    }
    let raw = null;
    try {
      raw = storage.getItem(TRASH_QUEUE_STORAGE_KEY);
    } catch (error) {
      raw = null;
    }
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => item && typeof item === 'object');
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  function writeQueuedTrashEntries(queue) {
    const storage = getTrashQueueStorage();
    if (!storage) {
      return;
    }
    const list = Array.isArray(queue) ? queue : [];
    if (!list.length) {
      try {
        storage.removeItem(TRASH_QUEUE_STORAGE_KEY);
      } catch (error) {}
      return;
    }
    try {
      storage.setItem(TRASH_QUEUE_STORAGE_KEY, JSON.stringify(list));
    } catch (error) {}
  }

  function getArchiveCacheStorage() {
    if (typeof window === 'undefined') {
      return null;
    }
    const storage = window.localStorage;
    if (!storage) {
      return null;
    }
    try {
      const probeKey = `${ARCHIVE_CACHE_STORAGE_KEY}__probe`;
      storage.setItem(probeKey, '1');
      storage.removeItem(probeKey);
      return storage;
    } catch (error) {
      return null;
    }
  }

  function readArchiveCache() {
    const storage = getArchiveCacheStorage();
    if (!storage) {
      return null;
    }
    let raw = null;
    try {
      raw = storage.getItem(ARCHIVE_CACHE_STORAGE_KEY);
    } catch (error) {
      raw = null;
    }
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      const timestamp = Number(parsed.timestamp) || 0;
      if (!timestamp || Date.now() - timestamp > ARCHIVE_CACHE_MAX_AGE_MS) {
        return null;
      }
      const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
      const metadata = parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : null;
      return { entries, metadata, timestamp };
    } catch (error) {
      return null;
    }
  }

  function writeArchiveCache(cache) {
    const storage = getArchiveCacheStorage();
    if (!storage) {
      return;
    }
    if (!cache || typeof cache !== 'object') {
      try {
        storage.removeItem(ARCHIVE_CACHE_STORAGE_KEY);
      } catch (error) {}
      return;
    }
    const payload = {
      timestamp: Number(cache.timestamp) || Date.now(),
      entries: Array.isArray(cache.entries) ? cache.entries : [],
      metadata: cache.metadata && typeof cache.metadata === 'object' ? cache.metadata : null
    };
    try {
      storage.setItem(ARCHIVE_CACHE_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {}
  }

  function getPendingTrashQueueCount() {
    const globalQueue = getGlobalTrashQueue();
    if (globalQueue && typeof globalQueue.getQueueLength === 'function') {
      try {
        return Number(globalQueue.getQueueLength()) || 0;
      } catch (error) {}
    }
    return readQueuedTrashEntries().length;
  }

  async function fallbackFlushQueuedTrashEntries() {
    const storage = getTrashQueueStorage();
    if (!storage) {
      return { processed: 0, remaining: 0 };
    }
    let queue = readQueuedTrashEntries();
    if (!queue.length) {
      return { processed: 0, remaining: 0 };
    }
    if (!trashApiBase || !TrashArchiveViewerClass) {
      throw new Error('Arkivtjenesten for slettede figurer er ikke tilgjengelig.');
    }
    const url = TrashArchiveViewerClass.buildTrashApiUrl(trashApiBase);
    if (!url) {
      throw new Error('Fant ikke adressen til arkivtjenesten.');
    }
    let processed = 0;
    while (queue.length) {
      const current = queue[0];
      if (!current || typeof current !== 'object') {
        queue.shift();
        processed++;
        writeQueuedTrashEntries(queue);
        continue;
      }
      const record = current.record && typeof current.record === 'object' ? current.record : null;
      if (!record) {
        queue.shift();
        processed++;
        writeQueuedTrashEntries(queue);
        continue;
      }
      const payload = {
        entries: [record],
        mode: current.mode === 'append' ? 'append' : 'prepend'
      };
      if (Number.isInteger(current.limit) && current.limit > 0) {
        payload.limit = current.limit;
      }
      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        throw new Error('Kunne ikke sende ventende slettinger til arkivet.');
      }
      if (!response || !response.ok) {
        const status = response && response.status ? response.status : 'ukjent';
        throw new Error(`Arkivtjenesten avviste ventende slettinger (status ${status}).`);
      }
      queue.shift();
      processed++;
      writeQueuedTrashEntries(queue);
    }
    return { processed, remaining: queue.length };
  }

  async function replayQueuedTrashEntries(options = {}) {
    const globalQueue = getGlobalTrashQueue();
    if (globalQueue && typeof globalQueue.flushPending === 'function') {
      return globalQueue.flushPending(options);
    }
    if (globalQueue && typeof globalQueue.flush === 'function') {
      return globalQueue.flush(options);
    }
    return fallbackFlushQueuedTrashEntries();
  }

  function clonePlainObject(value) {
    if (!value || typeof value !== 'object') {
      return null;
    }
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {}
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      const copy = Array.isArray(value) ? [] : {};
      Object.keys(value).forEach(key => {
        copy[key] = value[key];
      });
      return copy;
    }
  }

  function collectQueuedTrashRecords() {
    const queued = readQueuedTrashEntries();
    if (!Array.isArray(queued) || !queued.length) {
      return [];
    }
    const records = [];
    queued.forEach(entry => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const record = clonePlainObject(entry.record);
      if (!record || typeof record.id !== 'string' || !record.id.trim()) {
        return;
      }
      if (typeof record.deletedAt !== 'string' || !record.deletedAt.trim()) {
        let fallbackTimestamp = null;
        if (typeof entry.queuedAt === 'string' && entry.queuedAt.trim()) {
          fallbackTimestamp = entry.queuedAt.trim();
        }
        if (!fallbackTimestamp) {
          try {
            fallbackTimestamp = new Date().toISOString();
          } catch (error) {
            fallbackTimestamp = '';
          }
        }
        record.deletedAt = fallbackTimestamp;
      }
      if (typeof record.reason !== 'string' || !record.reason) {
        record.reason = 'delete';
      }
      record.fallback = true;
      record.fallbackSource = 'queue';
      record.queuedAt = typeof entry.queuedAt === 'string' ? entry.queuedAt : record.deletedAt;
      records.push(record);
    });
    return dedupeTrashEntries(records);
  }

  function generateTrashEntryId(prefix) {
    const base = typeof prefix === 'string' && prefix.trim() ? prefix.trim() : '';
    let timestampSegment = '';
    try {
      timestampSegment = Date.now().toString(36);
    } catch (error) {
      timestampSegment = '';
    }
    let randomSegment = '';
    try {
      const random = Math.random().toString(36);
      randomSegment = random.slice(2, 10);
    } catch (error) {
      randomSegment = '';
    }
    const fallbackRandom = () => {
      try {
        return Math.random().toString(36).slice(2, 10);
      } catch (error) {
        return 'trash';
      }
    };
    if (!randomSegment) {
      randomSegment = fallbackRandom();
    }
    const segments = [timestampSegment || null, randomSegment || fallbackRandom()];
    const suffix = segments.filter(Boolean).join('-');
    if (!base) {
      return suffix || fallbackRandom();
    }
    return `${base}-${suffix || fallbackRandom()}`;
  }

  function resolveTrashSourcePath(entry, details, targetConfig) {
    const candidates = [];
    const push = value => {
      if (typeof value === 'string' && value.trim()) {
        candidates.push(value.trim());
      }
    };
    if (details && typeof details === 'object') {
      push(details.storagePath);
      if (details.metadata && typeof details.metadata === 'object') {
        push(details.metadata.storagePath);
        push(details.metadata.path);
        push(details.metadata.canonicalPath);
        push(details.metadata.sourcePath);
      }
    }
    if (entry && typeof entry === 'object') {
      push(entry.storagePath);
      if (entry.metadata && typeof entry.metadata === 'object') {
        push(entry.metadata.storagePath);
        push(entry.metadata.path);
        push(entry.metadata.canonicalPath);
        push(entry.metadata.sourcePath);
      }
    }
    if (targetConfig && typeof targetConfig.storagePath === 'string') {
      push(targetConfig.storagePath);
    }
    for (const candidate of candidates) {
      const normalized = normalizeArchivePath(candidate);
      if (normalized) {
        return normalized;
      }
    }
    return '';
  }

  function resolveTrashSourceHref(entry, details, targetConfig, sourcePath) {
    const candidates = [];
    const push = value => {
      if (typeof value === 'string' && value.trim()) {
        candidates.push(value.trim());
      }
    };
    if (details && typeof details === 'object') {
      push(details.sourceHref);
      if (details.metadata && typeof details.metadata === 'object') {
        push(details.metadata.sourceHref);
        push(details.metadata.href);
        push(details.metadata.url);
      }
    }
    if (entry && typeof entry === 'object') {
      push(entry.sourceHref);
      if (entry.metadata && typeof entry.metadata === 'object') {
        push(entry.metadata.sourceHref);
        push(entry.metadata.href);
        push(entry.metadata.url);
      }
    }
    if (targetConfig && typeof targetConfig.url === 'string') {
      push(targetConfig.url);
    }
    if (targetConfig && typeof targetConfig.targetUrl === 'string') {
      push(targetConfig.targetUrl);
    }
    if (sourcePath) {
      push(`${sourcePath}.html`);
      push(sourcePath);
    }
    for (const candidate of candidates) {
      if (/^https?:\/\//i.test(candidate)) {
        return candidate;
      }
      if (candidate.startsWith('/')) {
        return candidate;
      }
      const built = buildToolUrl(candidate, { entry });
      if (built) {
        return built;
      }
    }
    return '';
  }

  function resolveTrashSourceTitle(entry, details, metadata, fallback) {
    const candidates = [];
    const push = value => {
      if (typeof value === 'string' && value.trim()) {
        candidates.push(value.trim());
      }
    };
    if (details && typeof details === 'object') {
      push(details.sourceTitle);
      push(details.displayTitle);
      push(details.title);
      if (details.metadata && typeof details.metadata === 'object') {
        push(details.metadata.sourceTitle);
        push(details.metadata.pageTitle);
        push(details.metadata.title);
      }
    }
    if (entry && typeof entry === 'object') {
      push(entry.sourceTitle);
      push(entry.displayTitle);
      push(entry.title);
      if (entry.metadata && typeof entry.metadata === 'object') {
        push(entry.metadata.sourceTitle);
        push(entry.metadata.pageTitle);
        push(entry.metadata.title);
      }
    }
    if (metadata && typeof metadata === 'object') {
      push(metadata.sourceTitle);
      push(metadata.pageTitle);
      push(metadata.title);
    }
    push(fallback);
    return candidates.find(Boolean) || '';
  }

  function mergeTrashMetadata(entry, details) {
    const metadata = {};
    const assign = (key, value) => {
      if (value == null) {
        return;
      }
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) {
          return;
        }
        metadata[key] = trimmed;
        return;
      }
      metadata[key] = value;
    };

    const mergeObject = source => {
      if (!source || typeof source !== 'object') {
        return;
      }
      Object.keys(source).forEach(key => {
        if (source[key] == null) {
          return;
        }
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          const clone = clonePlainObject(source[key]);
          if (clone) {
            if (!metadata[key]) {
              metadata[key] = clone;
            }
          }
        } else if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
          assign(key, source[key]);
        }
      });
    };

    mergeObject(entry && entry.metadata);
    mergeObject(details && details.metadata);

    const summary =
      (details && typeof details.summary === 'object' && details.summary) ||
      (entry && typeof entry.summary === 'object' && entry.summary) ||
      null;
    if (summary && !metadata.summary) {
      const summaryClone = clonePlainObject(summary);
      if (summaryClone) {
        metadata.summary = summaryClone;
      }
    }
    if (!metadata.summary) {
      const summaryText =
        (details && typeof details.summary === 'string' && details.summary.trim()) ||
        (entry && typeof entry.summary === 'string' && entry.summary.trim()) ||
        '';
      if (summaryText) {
        metadata.summary = summaryText;
      }
    }

    const altTextCandidate =
      (details && typeof details.altText === 'string' && details.altText.trim()) ||
      (entry && typeof entry.altText === 'string' && entry.altText.trim()) ||
      '';
    if (altTextCandidate && !metadata.altText) {
      metadata.altText = altTextCandidate;
    }
    const altTextSource = determineAltTextSource(entry, details);
    if (altTextSource && !metadata.altTextSource) {
      metadata.altTextSource = altTextSource;
    }

    const assignIfMissing = (key, value) => {
      if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
        assign(key, value);
      }
    };

    assignIfMissing('slug', (details && details.slug) || (entry && entry.slug));
    assignIfMissing('displayTitle', (details && details.displayTitle) || (entry && entry.displayTitle));
    assignIfMissing('title', (details && details.title) || (entry && entry.title));
    assignIfMissing('tool', (details && details.tool) || (entry && entry.tool));
    assignIfMissing('createdAt', (details && details.createdAt) || (entry && entry.createdAt));
    assignIfMissing('updatedAt', (details && details.updatedAt) || (entry && entry.updatedAt));
    assignIfMissing('svgUrl', (details && details.svgUrl) || (entry && entry.svgUrl));
    assignIfMissing('pngUrl', (details && details.pngUrl) || (entry && entry.pngUrl));
    assignIfMissing('thumbnailUrl', (details && details.thumbnailUrl) || (entry && entry.thumbnailUrl));
    assignIfMissing('fileSizeLabel', (details && details.fileSizeLabel) || (entry && entry.fileSizeLabel));
    assignIfMissing('sequenceLabel', (details && details.sequenceLabel) || (entry && entry.sequenceLabel));

    metadata.archiveSource = 'svg-archive';

    return Object.keys(metadata).length ? metadata : null;
  }

  function extractExampleForTrash(entry, details) {
    const candidates = [];
    const add = value => {
      const parsed = parseArchiveExample(value);
      if (parsed && typeof parsed === 'object') {
        const clone = cloneArchiveExample(parsed);
        if (clone) {
          candidates.push(clone);
        }
      }
    };
    if (details && typeof details === 'object') {
      if (Object.prototype.hasOwnProperty.call(details, 'exampleState')) {
        add(details.exampleState);
      }
      if (Object.prototype.hasOwnProperty.call(details, 'example')) {
        add(details.example);
      }
      if (Object.prototype.hasOwnProperty.call(details, 'exampleData')) {
        add(details.exampleData);
      }
      if (details.metadata && typeof details.metadata === 'object') {
        if (Object.prototype.hasOwnProperty.call(details.metadata, 'exampleState')) {
          add(details.metadata.exampleState);
        }
        if (Object.prototype.hasOwnProperty.call(details.metadata, 'example')) {
          add(details.metadata.example);
        }
      }
    }
    if (entry && typeof entry === 'object') {
      if (Object.prototype.hasOwnProperty.call(entry, 'exampleState')) {
        add(entry.exampleState);
      }
      if (Object.prototype.hasOwnProperty.call(entry, 'example')) {
        add(entry.example);
      }
      if (entry.metadata && typeof entry.metadata === 'object') {
        if (Object.prototype.hasOwnProperty.call(entry.metadata, 'exampleState')) {
          add(entry.metadata.exampleState);
        }
        if (Object.prototype.hasOwnProperty.call(entry.metadata, 'example')) {
          add(entry.metadata.example);
        }
      }
    }
    if (entry && typeof entry.slug === 'string' && entry.slug.trim()) {
      const cached = entryDetailsCache.get(entry.slug.trim());
      if (cached && typeof cached === 'object') {
        if (Object.prototype.hasOwnProperty.call(cached, 'exampleState')) {
          add(cached.exampleState);
        }
        if (Object.prototype.hasOwnProperty.call(cached, 'example')) {
          add(cached.example);
        }
      }
    }
    return candidates.find(example => example && typeof example === 'object') || null;
  }

  function buildTrashRecordFromEntry(entry, details) {
    const example = extractExampleForTrash(entry, details);
    const baseEntry = entry && typeof entry === 'object' ? entry : {};
    const detailEntry = details && typeof details === 'object' ? details : {};
    const metadata = mergeTrashMetadata(baseEntry, detailEntry);
    if (!example && !metadata) {
      return null;
    }
    const labelCandidates = [
      detailEntry.displayTitle,
      detailEntry.title,
      baseEntry.displayTitle,
      baseEntry.title,
      metadata && metadata.displayTitle,
      metadata && metadata.title,
      (example && typeof example.title === 'string' && example.title.trim()) || '',
      (baseEntry.slug && baseEntry.slug.trim()) || '',
      (detailEntry.slug && detailEntry.slug.trim()) || ''
    ];
    const resolvedLabel = labelCandidates.find(value => typeof value === 'string' && value.trim());
    const label = resolvedLabel ? resolvedLabel.trim() : 'Figur';

    const slugCandidates = [
      detailEntry.slug,
      baseEntry.slug,
      detailEntry.svgSlug,
      baseEntry.svgSlug,
      detailEntry.baseName,
      baseEntry.baseName
    ];
    const slugCandidate = slugCandidates.find(value => typeof value === 'string' && value.trim());
    const normalizedSlug = slugCandidate ? slugCandidate.trim() : '';
    const idPrefix = normalizedSlug ? `svg-archive:${normalizedSlug}` : 'svg-archive';
    const recordId = generateTrashEntryId(idPrefix);

    let deletedAt = '';
    try {
      deletedAt = new Date().toISOString();
    } catch (error) {
      deletedAt = '';
    }

    const targetConfig = resolveEntryOpenTarget({
      ...baseEntry,
      tool: detailEntry.tool || baseEntry.tool,
      storagePath:
        detailEntry.storagePath ||
        baseEntry.storagePath ||
        (detailEntry.metadata && detailEntry.metadata.storagePath) ||
        (baseEntry.metadata && baseEntry.metadata.storagePath) ||
        undefined
    });
    const sourcePath = resolveTrashSourcePath(baseEntry, detailEntry, targetConfig);
    const sourceHref = resolveTrashSourceHref(baseEntry, detailEntry, targetConfig, sourcePath);
    if (metadata && sourcePath && !metadata.sourcePath) {
      metadata.sourcePath = sourcePath;
    }
    if (metadata && sourceHref && !metadata.sourceHref) {
      metadata.sourceHref = sourceHref;
    }
    const sourceTitle = resolveTrashSourceTitle(baseEntry, detailEntry, metadata, label);

    const fallbackExample = { title: label };
    if (normalizedSlug) {
      fallbackExample.slug = normalizedSlug;
    }
    if (metadata && metadata.tool) {
      fallbackExample.tool = metadata.tool;
    }
    if (metadata) {
      const metadataClone = clonePlainObject(metadata);
      fallbackExample.metadata = metadataClone || metadata;
    }

    const record = {
      id: recordId,
      example: example || fallbackExample,
      deletedAt: deletedAt || undefined,
      reason: 'delete',
      label
    };
    if (sourcePath) {
      record.sourcePath = sourcePath;
    }
    if (sourceHref) {
      record.sourceHref = sourceHref;
    }
    if (sourceTitle) {
      record.sourceTitle = sourceTitle;
    }
    if (metadata) {
      record.metadata = metadata;
    }
    return record;
  }

  function queueTrashRecord(record, options = {}) {
    if (!record || typeof record !== 'object') {
      return false;
    }
    const normalizedRecord = clonePlainObject(record) || record;
    const entry = {
      record: normalizedRecord,
      mode: options.mode === 'append' ? 'append' : 'prepend'
    };
    try {
      entry.queuedAt = new Date().toISOString();
    } catch (error) {
      entry.queuedAt = '';
    }
    if (Number.isInteger(options.limit) && options.limit > 0) {
      entry.limit = options.limit;
    }
    const globalQueue = getGlobalTrashQueue();
    if (globalQueue && typeof globalQueue.enqueue === 'function') {
      try {
        const enqueued = globalQueue.enqueue(entry);
        if (enqueued) {
          return true;
        }
      } catch (error) {
        console.error('Kunne ikke legge slettet figur i den globale køen.', error);
      }
    }
    const queue = readQueuedTrashEntries();
    queue.push(entry);
    writeQueuedTrashEntries(queue);
    return true;
  }

  async function sendTrashRecord(record, options = {}) {
    if (!record || typeof record !== 'object') {
      return { posted: false, queued: false };
    }
    const payload = {
      entries: [record],
      mode: options.mode === 'append' ? 'append' : 'prepend'
    };
    if (Number.isInteger(options.limit) && options.limit > 0) {
      payload.limit = options.limit;
    }
    if (!trashApiBase || !TrashArchiveViewerClass) {
      queueTrashRecord(record, options);
      return { posted: false, queued: true, reason: 'unconfigured' };
    }
    const url = TrashArchiveViewerClass.buildTrashApiUrl(trashApiBase);
    if (!url) {
      queueTrashRecord(record, options);
      return { posted: false, queued: true, reason: 'invalid-url' };
    }
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response || !response.ok) {
        throw new Error(`Status ${response ? response.status : 'ukjent'}`);
      }
      return { posted: true, queued: false };
    } catch (error) {
      console.error('Kunne ikke sende slettet figur til arkivet.', error);
      queueTrashRecord(record, options);
      return { posted: false, queued: true, error };
    }
  }

  function buildTrashFallbackMetadata({ entries, reason, status, error }) {
    const hasEntries = Array.isArray(entries) && entries.length > 0;
    const resolvedReason = typeof reason === 'string' && reason ? reason : 'unavailable';
    const limitationBase =
      resolvedReason === 'unconfigured'
        ? 'Arkivtjenesten for slettede figurer er ikke konfigurert.'
        : 'Arkivtjenesten for slettede figurer er utilgjengelig akkurat nå.';
    const limitation = hasEntries
      ? `${limitationBase} Viser slettede figurer lagret på denne enheten.`
      : `${limitationBase} Ingen lokale slettede figurer er tilgjengelige.`;
    const details = {};
    if (typeof status === 'number') {
      details.status = status;
    }
    if (error && typeof error.message === 'string' && error.message) {
      details.errorMessage = error.message;
    }
    if (!details.queueSize) {
      details.queueSize = Array.isArray(entries) ? entries.length : 0;
    }
    return {
      storage: 'local',
      storageMode: 'local',
      mode: 'local',
      persistent: false,
      ephemeral: true,
      limitation,
      fallback: true,
      fallbackReason: resolvedReason,
      fallbackSource: hasEntries ? 'queue' : 'none',
      fallbackDetails: details
    };
  }

  function buildTrashFallbackResult(options = {}) {
    if (!trashViewer || !TrashArchiveViewerClass) {
      throw new Error('Visningen for slettede figurer er ikke tilgjengelig.');
    }
    const entries = collectQueuedTrashRecords();
    const metadata = buildTrashFallbackMetadata({
      entries,
      reason: options.reason,
      status: options.status,
      error: options.error
    });
    const hasEntries = entries.length > 0;
    const resolvedReason = metadata.fallbackReason;
    const baseMessage =
      resolvedReason === 'unconfigured'
        ? 'Arkivtjenesten er ikke konfigurert.'
        : 'Arkivtjenesten er utilgjengelig.';
    const message = hasEntries
      ? `${baseMessage} Viser slettede figurer som venter på opplasting fra denne enheten.`
      : `${baseMessage} Ingen lokale slettede figurer ble funnet.`;
    const actions = [buildTrashRetryAction()].filter(Boolean);
    const state = hasEntries ? 'warning' : 'error';
    trashViewer.applyEntriesResult({ entries, metadata, usedFallback: true });
    if (message || actions.length) {
      setTrashViewerStatus({ text: message, actions }, state);
    } else {
      setTrashViewerStatus('', null);
    }
    return { entries, metadata, usedFallback: true };
  }

  function buildTrashRetryAction() {
    const hasPending = getPendingTrashQueueCount() > 0;
    if (!hasPending || manualTrashReplayInFlight) {
      return null;
    }
    return {
      label: 'Send lagrede slettinger nå',
      onClick: () => {
        if (manualTrashReplayInFlight) {
          return;
        }
        manualTrashReplayInFlight = true;
        setTrashViewerStatus({ text: 'Sender lagrede slettinger …' }, 'info');
        replayQueuedTrashEntries({ silent: true })
          .then(async result => {
            manualTrashReplayInFlight = false;
            const processed = result && typeof result.processed === 'number' ? result.processed : 0;
            if (processed > 0) {
              setTrashViewerStatus('Ventende slettinger ble sendt til arkivet.', 'success');
              try {
                await fetchTrashEntries();
                renderTrashViewer();
              } catch (error) {
                setTrashViewerStatus(
                  {
                    text: 'Slettingene ble sendt, men arkivlisten kunne ikke oppdateres. Oppdater siden for å se endringene.',
                    actions: [buildTrashRetryAction()].filter(Boolean)
                  },
                  'warning'
                );
              }
            } else {
              setTrashViewerStatus('Fant ingen ventende slettinger å sende.', 'info');
            }
          })
          .catch(error => {
            manualTrashReplayInFlight = false;
            const message = error && error.message ? error.message : 'Kunne ikke sende ventende slettinger.';
            setTrashViewerStatus(
              {
                text: `${message} Arkivet kan fortsatt være ufullstendig.`,
                actions: [buildTrashRetryAction()].filter(Boolean)
              },
              'error'
            );
          });
      }
    };
  }

  function showTrashArchiveWarning(error) {
    const baseMessage = error && error.message ? error.message : 'Kunne ikke hente slettede figurer.';
    const action = buildTrashRetryAction();
    const payload = {
      text: `${baseMessage} Arkivet kan være ufullstendig.`,
      actions: action ? [action] : []
    };
    setTrashViewerStatus(payload, 'error');
  }

  function normalizeToolIdentifier(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .trim()
      .toLowerCase()
      .replace(/[\u00e6]/g, 'ae')
      .replace(/[\u00f8\u0153]/g, 'o')
      .replace(/[\u00e5]/g, 'a')
      .replace(/[^a-z0-9]+/g, '');
  }

  function normalizeStoragePath(value) {
    if (typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  function resolveToolOrigin(entry) {
    if (typeof window === 'undefined') {
      return '';
    }

    const candidates = [];

    try {
      const configuredOrigin = window.MATH_VISUALS_TOOL_ORIGIN;
      if (typeof configuredOrigin === 'string' && configuredOrigin.trim()) {
        candidates.push(configuredOrigin.trim());
      }
    } catch (_) {}

    if (entry && typeof entry.svgUrl === 'string' && entry.svgUrl.trim()) {
      candidates.push(entry.svgUrl.trim());
    }

    if (window.location && typeof window.location.origin === 'string' && window.location.origin) {
      candidates.push(window.location.origin);
    }

    const baseHref = window.location && typeof window.location.href === 'string'
      ? window.location.href
      : undefined;

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      try {
        const parsed = baseHref ? new URL(candidate, baseHref) : new URL(candidate);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return parsed.origin;
        }
      } catch (_) {}
    }

    return '';
  }

  function buildToolUrl(pathOrUrl, { entry } = {}) {
    const raw = typeof pathOrUrl === 'string' ? pathOrUrl.trim() : '';
    if (!raw) {
      return '';
    }

    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch (_) {}

    if (typeof window === 'undefined') {
      return raw;
    }

    const origin = resolveToolOrigin(entry);
    if (origin) {
      try {
        return new URL(raw, origin).toString();
      } catch (_) {}
    }

    try {
      const fallbackBase = window.location && typeof window.location.href === 'string'
        ? window.location.href
        : undefined;
      if (fallbackBase) {
        return new URL(raw, fallbackBase).toString();
      }
    } catch (_) {}

    return raw;
  }

  function indicatorMatchesStoragePath(indicator, storagePath) {
    if (!indicator || !storagePath) {
      return false;
    }

    const normalizedIndicator = String(indicator).toLowerCase();
    if (!normalizedIndicator) {
      return false;
    }

    const indicatorVariants = new Set([normalizedIndicator]);
    try {
      const decoded = decodeURI(normalizedIndicator);
      if (decoded && decoded.toLowerCase() !== normalizedIndicator) {
        indicatorVariants.add(decoded.toLowerCase());
      }
    } catch (_) {}

    const normalizedPath = storagePath.toLowerCase();
    const pathVariants = new Set();
    const addPathVariant = value => {
      if (value) {
        pathVariants.add(value);
      }
    };

    addPathVariant(normalizedPath);
    addPathVariant(normalizedPath.replace(/^\//, ''));

    try {
      const encoded = encodeURI(normalizedPath);
      const encodedLower = typeof encoded === 'string' ? encoded.toLowerCase() : '';
      addPathVariant(encodedLower);
      addPathVariant(encodedLower.replace(/^\//, ''));
    } catch (_) {}

    try {
      if (typeof normalizedPath.normalize === 'function') {
        const ascii = normalizedPath
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        addPathVariant(ascii);
        addPathVariant(ascii.replace(/^\//, ''));
      }
    } catch (_) {}

    const identifierVariant = normalizeToolIdentifier(normalizedPath);
    if (identifierVariant) {
      addPathVariant(identifierVariant);
    }

    const indicatorValues = Array.from(indicatorVariants);
    const pathValues = Array.from(pathVariants);
    for (const indicatorValue of indicatorValues) {
      for (const pathValue of pathValues) {
        if (pathValue && indicatorValue.includes(pathValue)) {
          return true;
        }
      }
    }

    return false;
  }

  const TOOL_OPEN_TARGETS = (() => {
    const definitions = [
      { names: ['Graftegner'], url: '/graftegner.html', storagePath: '/graftegner' },
      { names: ['nKant', 'N-kant'], url: '/nkant.html', storagePath: '/nkant' },
      { names: ['Diagram'], url: '/diagram/index.html', storagePath: '/diagram' },
      {
        names: ['Måling', 'Maling', 'Maaling', 'Measurement'],
        url: '/måling.html',
        storagePath: '/måling'
      },
      { names: ['Brøkpizza'], url: '/brøkpizza.html', storagePath: '/brøkpizza' },
      { names: ['Brøkfigurer'], url: '/brøkfigurer.html', storagePath: '/brøkfigurer' },
      { names: ['Figurtall'], url: '/figurtall.html', storagePath: '/figurtall' },
      { names: ['Tenkeblokker'], url: '/tenkeblokker.html', storagePath: '/tenkeblokker' },
      {
        names: ['Arealmodell', 'Arealmodellen', 'Arealmodellen 1', 'Arealmodellen 2', 'Arealmodell 0'],
        url: '/arealmodell.html',
        storagePath: '/arealmodell'
      },
      { names: ['Tallinje'], url: '/tallinje.html', storagePath: '/tallinje' },
      { names: ['Perlesnor'], url: '/perlesnor.html', storagePath: '/perlesnor' },
      { names: ['Kuler'], url: '/kuler.html', storagePath: '/kuler' },
      { names: ['Kvikkbilder'], url: '/kvikkbilder.html', storagePath: '/kvikkbilder' },
      {
        names: ['Numbervisuals', 'Numbervisual'],
        url: '/kvikkbilder-monster.html',
        storagePath: '/kvikkbilder-monster',
        displayName: 'Numbervisuals'
      },
      { names: ['3D-figurer', 'Trefigurer'], url: '/trefigurer.html', storagePath: '/trefigurer' },
      { names: ['Brøkvegg'], url: '/brøkvegg.html', storagePath: '/brøkvegg' },
      {
        names: ['Prikk til prikk', 'Prikk til prikk (beta)'],
        url: '/prikktilprikk.html',
        storagePath: '/prikktilprikk'
      },
      {
        names: ['Fortegnsskjema', 'Fortegnsskjema – under utvikling'],
        url: '/fortegnsskjema.html',
        storagePath: '/fortegnsskjema'
      }
    ];

    const map = new Map();
    const storageMap = new Map();
    for (const definition of definitions) {
      const normalizedUrl = definition.url;
      const navHrefCandidate = typeof definition.navHref === 'string' ? definition.navHref : normalizedUrl;
      const navHref = typeof navHrefCandidate === 'string'
        ? navHrefCandidate.replace(/^\//, '').trim()
        : '';
      const absoluteUrl = buildToolUrl(normalizedUrl);
      const entry = {
        url: absoluteUrl || normalizedUrl,
        storagePath: normalizeStoragePath(definition.storagePath),
        displayName: definition.displayName || (definition.names && definition.names[0]) || '',
        navHref
      };
      const storageKey = entry.storagePath;
      if (storageKey && !storageMap.has(storageKey)) {
        storageMap.set(storageKey, entry);
      }
      if (!Array.isArray(definition.names)) {
        continue;
      }
      for (const name of definition.names) {
        const key = normalizeToolIdentifier(name);
        if (!key || map.has(key)) {
          continue;
        }
        map.set(key, entry);
      }
    }
    map.byStoragePath = storageMap;
    return map;
  })();

  const OPEN_REQUEST_STORAGE_KEY = 'archive_open_request';
  const ARCHIVE_OPEN_REQUEST_WINDOW_NAME_PREFIX = 'mathvis:archive-open-request:';
  const ARCHIVE_OPEN_REQUEST_TRANSPORT_METADATA_KEY = '__mathvisArchiveOpenTransport';

  function attachArchiveOpenRequestTransportMetadata(target, metadata) {
    if (!target || typeof target !== 'object') {
      return metadata || null;
    }
    try {
      Object.defineProperty(target, ARCHIVE_OPEN_REQUEST_TRANSPORT_METADATA_KEY, {
        value: metadata || null,
        configurable: true,
        enumerable: false,
        writable: true
      });
    } catch (error) {
      try {
        target[ARCHIVE_OPEN_REQUEST_TRANSPORT_METADATA_KEY] = metadata || null;
      } catch (_) {}
    }
    return metadata || null;
  }

  function getArchiveOpenRequestTransportMetadata(target) {
    if (!target || typeof target !== 'object') {
      return null;
    }
    try {
      return target[ARCHIVE_OPEN_REQUEST_TRANSPORT_METADATA_KEY] || null;
    } catch (error) {
      return null;
    }
  }

  function getLocalStorage() {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      return window.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function writeArchiveOpenRequest(payload) {
    const storage = getLocalStorage();
    if (!storage) {
      return false;
    }
    if (!payload || typeof payload !== 'object') {
      try {
        storage.removeItem(OPEN_REQUEST_STORAGE_KEY);
      } catch (error) {}
      return false;
    }
    try {
      storage.setItem(OPEN_REQUEST_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      return false;
    }
  }

  function parseArchiveExample(value) {
    if (!value) {
      return null;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        return null;
      }
    }
    if (typeof value === 'object') {
      return value;
    }
    return null;
  }

  function normalizeArchivePath(value) {
    if (typeof value !== 'string') {
      return null;
    }
    let path = value.trim();
    if (!path) {
      return null;
    }
    try {
      const url = new URL(path, window.location.origin);
      if (url && typeof url.pathname === 'string') {
        path = url.pathname;
      }
    } catch (error) {}
    path = path.replace(/\\+/g, '/');
    path = path.replace(/\/+/g, '/');
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    path = path.replace(/\/index\.html?$/i, '/');
    path = path.replace(/\.html?$/i, '');
    path = path.replace(/\/+$/, '');
    if (!path) {
      return '/';
    }
    const examplePattern = /\/eksempel[-_]?\d+$/i;
    while (path.length > 1 && examplePattern.test(path)) {
      const next = path.replace(examplePattern, '');
      if (!next || next === path) {
        break;
      }
      path = next.replace(/\/+$/, '');
    }
    if (!path) {
      return '/';
    }
    try {
      return decodeURI(path).toLowerCase() || '/';
    } catch (error) {
      return path.toLowerCase();
    }
  }

  function cloneArchiveExample(example) {
    if (!example || typeof example !== 'object') {
      return null;
    }
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(example);
      } catch (error) {}
    }
    try {
      return JSON.parse(JSON.stringify(example));
    } catch (error) {
      return null;
    }
  }

  function prepareArchiveOpenRequestFallback(rawRequest) {
    const request = rawRequest && typeof rawRequest === 'object' ? { ...rawRequest } : {};
    const exampleState =
      parseArchiveExample(request.exampleState) ||
      parseArchiveExample(request.example) ||
      parseArchiveExample(request.exampleData) ||
      parseArchiveExample(request.payload);
    if (exampleState) {
      const normalizedExample = cloneArchiveExample(exampleState);
      if (normalizedExample) {
        request.exampleState = normalizedExample;
        request.example = normalizedExample;
        request.exampleData = normalizedExample;
        request.payload = normalizedExample;
      }
    }
    const pathCandidates = [
      request.canonicalPath,
      request.storagePath,
      request.path,
      request.target,
      request.href,
      request.targetUrl
    ];
    for (const candidate of pathCandidates) {
      const normalized = normalizeArchivePath(candidate);
      if (normalized) {
        request.canonicalPath = normalized;
        if (!request.path) {
          request.path = normalized;
        }
        if (!request.storagePath) {
          request.storagePath = normalized;
        }
        break;
      }
    }
    let transportMetadata = null;
    const saved = writeArchiveOpenRequest(request);
    if (saved) {
      transportMetadata = {
        type: 'storage',
        storageKey: OPEN_REQUEST_STORAGE_KEY
      };
    } else {
      let serialized = null;
      try {
        serialized = JSON.stringify(request);
      } catch (error) {
        serialized = null;
      }
      if (!serialized) {
        try {
          console.error('Kunne ikke serialisere åpningstilstanden for arkivet for reserve-løsningen.');
        } catch (_) {}
        return null;
      }
      const payload = `${ARCHIVE_OPEN_REQUEST_WINDOW_NAME_PREFIX}${serialized}`;
      transportMetadata = {
        type: 'window-name',
        payload,
        prefix: ARCHIVE_OPEN_REQUEST_WINDOW_NAME_PREFIX
      };
    }
    attachArchiveOpenRequestTransportMetadata(request, transportMetadata);
    return { request, transport: transportMetadata };
  }

  function generateArchiveRequestId(entry) {
    const source =
      entry && typeof entry === 'object'
        ? entry.slug || entry.svgSlug || entry.pngSlug || entry.baseName || entry.displayTitle || 'figur'
        : 'figur';
    const baseSegment = String(source)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
    const safeBase = baseSegment || 'figur';
    const timestampSegment = (() => {
      try {
        return Date.now ? Date.now().toString(36) : '';
      } catch (_) {
        return '';
      }
    })();
    let randomSegment = '';
    try {
      const cryptoApi = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
      if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
        const buffer = new Uint32Array(2);
        cryptoApi.getRandomValues(buffer);
        randomSegment = Array.from(buffer)
          .map(value => value.toString(36))
          .join('')
          .slice(0, 16);
      }
    } catch (_) {}
    if (!randomSegment) {
      randomSegment = Math.random().toString(36).slice(2, 10);
    }
    return [safeBase, timestampSegment, randomSegment].filter(Boolean).join('-');
  }

  function resolveToolOpenTarget(toolName) {
    if (typeof toolName !== 'string') {
      return null;
    }

    const key = normalizeToolIdentifier(toolName);
    if (!key) {
      return null;
    }

    const direct = TOOL_OPEN_TARGETS.get(key);
    if (direct) {
      return direct;
    }

    const trimmedKey = key.replace(/\d+$/, '');
    if (trimmedKey && trimmedKey !== key) {
      const trimmedTarget = TOOL_OPEN_TARGETS.get(trimmedKey);
      if (trimmedTarget) {
        return trimmedTarget;
      }
    }

    let suffixMatch = null;
    let partialMatch = null;
    for (const [candidateKey, candidateTarget] of TOOL_OPEN_TARGETS.entries()) {
      if (!candidateKey || !candidateTarget) {
        continue;
      }
      if (key.endsWith(candidateKey)) {
        if (!suffixMatch || candidateKey.length > suffixMatch.key.length) {
          suffixMatch = { key: candidateKey, target: candidateTarget };
        }
      } else if (key.includes(candidateKey)) {
        if (!partialMatch || candidateKey.length > partialMatch.key.length) {
          partialMatch = { key: candidateKey, target: candidateTarget };
        }
      }
    }

    if (suffixMatch) {
      return suffixMatch.target;
    }
    if (partialMatch) {
      return partialMatch.target;
    }

    return null;
  }

  function resolveTargetFromStorageIndicator(indicator) {
    if (!indicator || !TOOL_OPEN_TARGETS.byStoragePath) {
      return null;
    }

    for (const [storagePath, target] of TOOL_OPEN_TARGETS.byStoragePath.entries()) {
      if (!storagePath) {
        continue;
      }
      if (indicatorMatchesStoragePath(indicator, storagePath)) {
        return target;
      }
    }

    return null;
  }

  function resolveEntryOpenTarget(entry) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const explicitTarget = resolveToolOpenTarget(entry.tool || '');
    if (explicitTarget) {
      return explicitTarget;
    }

    const indicators = [entry.storagePath, entry.slug, entry.svgUrl, entry.pngUrl, entry.thumbnailUrl];
    for (const indicator of indicators) {
      const target = resolveTargetFromStorageIndicator(indicator);
      if (target) {
        return target;
      }
    }

    return null;
  }

  function getFocusableElements(container) {
    return Array.from(container.querySelectorAll(focusableSelectors)).filter(element => {
      if (element.disabled) {
        return false;
      }
      if (element.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      const rects = element.getClientRects();
      const isSvgElement = typeof window !== 'undefined' && window.SVGElement
        ? element instanceof window.SVGElement
        : false;
      return rects.length > 0 && (element.offsetParent !== null || isSvgElement);
    });
  }

  function setStatus(message, state) {
    if (!statusElement) return;
    if (message) {
      statusElement.textContent = message;
      statusElement.hidden = false;
      if (state) {
        statusElement.dataset.state = state;
      } else {
        delete statusElement.dataset.state;
      }
    } else {
      statusElement.textContent = '';
      statusElement.hidden = true;
      delete statusElement.dataset.state;
    }
  }

  function setBusy(isBusy) {
    grid.setAttribute('aria-busy', String(Boolean(isBusy)));
  }

  function announceTrash(message) {
    if (!trashStatus) {
      return;
    }
    trashStatus.textContent = message || '';
  }

  function setTrashViewerStatus(message, state) {
    if (!trashStatus) {
      return;
    }
    let text = '';
    let actions = [];
    if (message && typeof message === 'object' && !Array.isArray(message)) {
      text = typeof message.text === 'string' ? message.text : '';
      if (Array.isArray(message.actions)) {
        actions = message.actions.filter(action => action && typeof action === 'object');
      }
    } else if (typeof message === 'string') {
      text = message;
    }

    while (trashStatus.firstChild) {
      trashStatus.removeChild(trashStatus.firstChild);
    }

    if (!text && actions.length === 0) {
      trashStatus.textContent = '';
      trashStatus.hidden = true;
    } else {
      trashStatus.hidden = false;
      if (text) {
        const textNode = document.createElement('span');
        textNode.textContent = text;
        trashStatus.appendChild(textNode);
      }
      if (actions.length) {
        const actionsContainer = document.createElement('span');
        actionsContainer.className = 'svg-archive__trash-panel-actions';
        actions.forEach(action => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'svg-archive__trash-panel-action';
          button.textContent = typeof action.label === 'string' && action.label.trim() ? action.label : 'Prøv igjen';
          if (typeof action.onClick === 'function') {
            button.addEventListener('click', action.onClick);
          }
          actionsContainer.appendChild(button);
        });
        trashStatus.appendChild(actionsContainer);
      }
    }

    if (state) {
      trashStatus.dataset.state = state;
    } else {
      delete trashStatus.dataset.state;
    }
  }

  function updateTrashViewerGroups(groups) {
    const list = Array.isArray(groups) ? groups : [];
    trashViewerState.groups = list;
    trashViewerState.groupsMap = new Map();
    list.forEach(group => {
      if (!group || typeof group.path !== 'string') return;
      trashViewerState.groupsMap.set(group.path, group);
    });
  }

  function formatTrashTimestamp(value) {
    if (typeof value !== 'string' || !value.trim()) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    try {
      return date.toLocaleString('no-NO', { dateStyle: 'medium', timeStyle: 'short' });
    } catch (error) {
      return date.toISOString();
    }
  }

  function renderTrashViewer() {
    if (!trashList) {
      return;
    }

    Array.from(trashList.querySelectorAll('[data-group]')).forEach(node => node.remove());

    const groups = Array.isArray(trashViewerState.groups) ? trashViewerState.groups : [];
    if (!groups.length) {
      if (trashEmpty) {
        trashEmpty.hidden = false;
        if (!trashEmpty.parentNode) {
          trashList.appendChild(trashEmpty);
        }
      }
      return;
    }

    if (trashEmpty) {
      trashEmpty.hidden = true;
      if (!trashEmpty.parentNode) {
        trashList.appendChild(trashEmpty);
      }
    }

    const fragment = document.createDocumentFragment();

    groups.forEach(group => {
      if (!group || !Array.isArray(group.items) || !group.items.length) {
        return;
      }

      const section = document.createElement('section');
      section.className = 'svg-archive__trash-group';
      section.dataset.group = '';
      section.dataset.path = group.path;

      const header = document.createElement('header');
      header.className = 'svg-archive__trash-group-header';

      const title = document.createElement('h3');
      title.className = 'svg-archive__trash-group-title';
      title.textContent = group.sourceTitle || group.path;
      header.appendChild(title);

      const meta = document.createElement('p');
      meta.className = 'svg-archive__trash-group-meta';
      const count = group.items.length;
      const countLabel = count === 1 ? '1 arkivert element' : `${count} arkiverte elementer`;
      const latest = formatTrashTimestamp(group.latestDeletedAt);
      meta.textContent = latest ? `${countLabel} · Sist slettet ${latest}` : countLabel;
      header.appendChild(meta);

      section.appendChild(header);

      const list = document.createElement('ul');
      list.className = 'svg-archive__trash-items';

      group.items.forEach((item, index) => {
        if (!item || typeof item !== 'object') {
          return;
        }

        const listItem = document.createElement('li');
        listItem.className = 'svg-archive__trash-item';
        listItem.dataset.item = '';
        if (item.id) {
          listItem.dataset.id = item.id;
        }

        const itemBody = document.createElement('div');
        itemBody.className = 'svg-archive__trash-item-body';

        const itemTitle = document.createElement('h4');
        itemTitle.className = 'svg-archive__trash-item-title';
        const example = item.example && typeof item.example === 'object' ? item.example : null;
        const label = typeof item.label === 'string' && item.label.trim() ? item.label.trim() : '';
        const exampleTitle = example && typeof example.title === 'string' && example.title.trim()
          ? example.title.trim()
          : '';
        const exampleDescription = example && typeof example.description === 'string'
          ? example.description.trim()
          : '';
        const fallbackTitle = exampleDescription ? exampleDescription.slice(0, 120) : `Element ${index + 1}`;
        itemTitle.textContent = label || exampleTitle || fallbackTitle;
        itemBody.appendChild(itemTitle);

        const itemMeta = document.createElement('p');
        itemMeta.className = 'svg-archive__trash-item-meta';
        const deletedLabel = formatTrashTimestamp(item.deletedAt);
        const reason = item.reason === 'history-import' ? 'Importert' : item.reason === 'archive' ? 'Arkivert' : null;
        const metaParts = [];
        if (deletedLabel) {
          metaParts.push(`Slettet ${deletedLabel}`);
        }
        if (typeof item.removedAtIndex === 'number' && Number.isFinite(item.removedAtIndex)) {
          metaParts.push(`Plass ${item.removedAtIndex + 1}`);
        }
        if (reason) {
          metaParts.push(reason);
        }
        itemMeta.textContent = metaParts.join(' · ');
        itemBody.appendChild(itemMeta);

        const actions = document.createElement('div');
        actions.className = 'svg-archive__trash-actions';

        const restoreButton = document.createElement('button');
        restoreButton.type = 'button';
        restoreButton.className = 'svg-archive__trash-action';
        restoreButton.dataset.action = 'restore';
        if (item.id) {
          restoreButton.dataset.id = item.id;
        }
        if (group.path) {
          restoreButton.dataset.path = group.path;
        }
        restoreButton.textContent = 'Gjenopprett';
        actions.appendChild(restoreButton);

        const openButton = document.createElement('button');
        openButton.type = 'button';
        openButton.className = 'svg-archive__trash-action';
        openButton.dataset.action = 'open';
        if (item.id) {
          openButton.dataset.id = item.id;
        }
        if (group.path) {
          openButton.dataset.path = group.path;
        }
        openButton.textContent = 'Åpne';
        actions.appendChild(openButton);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'svg-archive__trash-action svg-archive__trash-action--danger';
        deleteButton.dataset.action = 'delete';
        if (item.id) {
          deleteButton.dataset.id = item.id;
        }
        if (group.path) {
          deleteButton.dataset.path = group.path;
        }
        deleteButton.textContent = 'Slett permanent';
        actions.appendChild(deleteButton);

        itemBody.appendChild(actions);
        listItem.appendChild(itemBody);
        list.appendChild(listItem);
      });

      section.appendChild(list);
      fragment.appendChild(section);
    });

    trashList.appendChild(fragment);
  }

  function dedupeTrashEntries(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }
    const seen = new Set();
    const result = [];
    entries.forEach(entry => {
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const id = typeof entry.id === 'string' ? entry.id : null;
      if (id && seen.has(id)) {
        return;
      }
      if (id) {
        seen.add(id);
      }
      result.push(entry);
    });
    return result;
  }

  async function fetchTrashEntries() {
    if (!trashViewer || !TrashArchiveViewerClass) {
      throw new Error('Fant ikke visningen for slettede figurer.');
    }
    if (!trashApiBase) {
      return buildTrashFallbackResult({ reason: 'unconfigured' });
    }

    const url = TrashArchiveViewerClass.buildTrashApiUrl(trashApiBase);
    if (!url) {
      return buildTrashFallbackResult({ reason: 'invalid-url' });
    }

    let response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (error) {
      return buildTrashFallbackResult({ reason: 'network-error', error });
    }

    if (response && response.status === 404) {
      return buildTrashFallbackResult({ reason: 'not-found', status: 404 });
    }

    if (!TrashArchiveViewerClass.responseLooksLikeJson(response)) {
      const status = response && response.status ? response.status : undefined;
      return buildTrashFallbackResult({ reason: 'invalid-response', status });
    }

    if (!response.ok) {
      return buildTrashFallbackResult({ reason: 'error-status', status: response.status });
    }

    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      return buildTrashFallbackResult({ reason: 'parse-error', status: response.status, error });
    }

    const entries = dedupeTrashEntries(Array.isArray(payload && payload.entries) ? payload.entries : []);
    const metadata = TrashArchiveViewerClass.extractMetadata(payload);
    trashViewer.applyEntriesResult({ entries, metadata, usedFallback: false });
    setTrashViewerStatus('', null);
    return { entries, metadata, usedFallback: false };
  }

  function buildTrashOpenEntry(item, group) {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const metadata = item.metadata && typeof item.metadata === 'object' ? { ...item.metadata } : {};
    const exampleState = (() => {
      const candidates = [item.exampleState, item.example, metadata.exampleState, metadata.example];
      for (const candidate of candidates) {
        const parsed = parseArchiveExample(candidate);
        if (parsed) {
          const cloned = cloneArchiveExample(parsed);
          if (cloned) {
            return cloned;
          }
        }
      }
      return null;
    })();

    const resolveString = (...values) => {
      for (const value of values) {
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed) return trimmed;
        }
      }
      return '';
    };

    const tool = resolveString(item.tool, metadata.tool, group && group.tool);
    const storagePath = resolveString(
      item.storagePath,
      metadata.storagePath,
      item.sourcePath,
      metadata.path,
      group && group.path
    );
    const slug = resolveString(item.slug, item.id, metadata.slug, item.baseName);
    const summary =
      typeof metadata.summary === 'object'
        ? metadata.summary
        : resolveString(metadata.summary, item.summary)
          ? { text: resolveString(metadata.summary, item.summary) }
          : null;
    const title = resolveString(
      item.displayTitle,
      item.title,
      metadata.displayTitle,
      metadata.title,
      (exampleState && exampleState.title) || '',
      (exampleState && exampleState.description) || '',
      slug,
      'Figur'
    );

    return {
      ...item,
      slug,
      displayTitle: title,
      title,
      tool,
      storagePath,
      exampleState,
      summary,
      metadata: Object.keys(metadata).length ? metadata : undefined
    };
  }

  async function openTrashExample(path, id) {
    if (typeof path !== 'string' || !path) {
      return;
    }
    const group = trashViewerState.groupsMap.get(path);
    if (!group || !Array.isArray(group.items)) {
      return;
    }
    const item = group.items.find(entry => entry && entry.id === id);
    if (!item) {
      return;
    }

    const entry = buildTrashOpenEntry(item, group);
    if (!entry) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      return;
    }

    try {
      await performEntryAction('edit', entry);
    } catch (error) {
      console.error('Kunne ikke åpne slettet figur i verktøyet.', error);
      setStatus('Klarte ikke å åpne verktøyet for den slettede figuren.', 'error');
    }
  }

  async function ensureTrashViewerInitialized() {
    if (trashViewerInitialized) {
      return;
    }
    if (!TrashArchiveViewerClass) {
      setTrashViewerStatus('Visningen for slettede figurer er ikke tilgjengelig i denne nettleseren.', 'error');
      trashViewerInitialized = true;
      return;
    }

    trashViewer = new TrashArchiveViewerClass({
      apiBase: examplesApiBase,
      trashApiBase,
      state: trashViewerState,
      updateGroups: updateTrashViewerGroups,
      buildFilterOptions: () => {},
      renderEntries: renderTrashViewer,
      setStatus: setTrashViewerStatus,
      openExample: openTrashExample,
      onFetchEntries: fetchTrashEntries,
      notifyParent: () => {},
      messages: {
        fallbackStatus: '',
        restoreFallbackStatus: '',
        restoreInProgress: 'Gjenoppretter figuren …',
        restoreSuccess: 'Figur gjenopprettet.',
        restoreError: 'Kunne ikke gjenopprette figuren.',
        deleteCancelled: 'Sletting avbrutt.',
        deleteError: 'Kunne ikke slette figuren permanent.',
        deleteSuccess: 'Figur slettet.'
      }
    });

    if (trashList) {
      trashList.addEventListener('click', trashViewer.handleAction);
    }

    trashViewerInitialized = true;

    try {
      setTrashViewerStatus('Laster slettede figurer …', 'info');
      await fetchTrashEntries();
      renderTrashViewer();
      if (trashViewerState.lastFetchUsedFallback) {
        const hasGroups = Array.isArray(trashViewerState.groups) && trashViewerState.groups.length > 0;
        if (!hasGroups && trashStatus && trashStatus.hidden) {
          setTrashViewerStatus('Ingen slettede figurer tilgjengelige akkurat nå.', 'info');
        }
      } else if (!trashViewerState.groups.length) {
        setTrashViewerStatus('Ingen slettede figurer ennå.', 'info');
      } else {
        setTrashViewerStatus('Slettede figurer er klare.', 'success');
      }
    } catch (error) {
      showTrashArchiveWarning(error);
    }
  }

  function syncTrashToggleState(isOpen) {
    if (!trashToggle) {
      return;
    }
    trashToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
    const label = isOpen ? activeTrashToggleLabel : defaultTrashToggleLabel;
    trashToggle.textContent = label;
  }

  function isTrashPanelOpen() {
    return Boolean(trashArchive && !trashArchive.hasAttribute('hidden'));
  }

  function setTrashPanelVisibility(isOpen, { focusPanel = true, triggeredBy = null, announce = true } = {}) {
    if (!trashArchive || !trashToggle) {
      return;
    }

    const currentlyOpen = isTrashPanelOpen();
    if (currentlyOpen === Boolean(isOpen)) {
      if (isOpen && focusPanel) {
        requestAnimationFrame(() => {
          trashArchive.focus();
        });
      }
      return;
    }

    if (isOpen) {
      if (!trashViewerInitialized) {
        ensureTrashViewerInitialized().catch(error => {
          setTrashViewerStatus(
            error && error.message ? error.message : 'Kunne ikke hente slettede figurer.',
            'error'
          );
        });
      }
      trashRestoreFocusTo = triggeredBy || document.activeElement || trashToggle;
      trashArchive.removeAttribute('hidden');
      trashArchive.setAttribute('aria-hidden', 'false');
      syncTrashToggleState(true);
      if (announce && !trashViewerInitialized) {
        announceTrash('Viser slettede figurer.');
      }
      if (focusPanel) {
        requestAnimationFrame(() => {
          trashArchive.focus();
        });
      }
    } else {
      trashArchive.setAttribute('hidden', '');
      trashArchive.setAttribute('aria-hidden', 'true');
      syncTrashToggleState(false);
      if (announce) {
        announceTrash('Slettede figurer er skjult.');
      }
      const focusTarget = trashRestoreFocusTo && typeof trashRestoreFocusTo.focus === 'function'
        ? trashRestoreFocusTo
        : trashToggle;
      trashRestoreFocusTo = null;
      requestAnimationFrame(() => {
        focusTarget?.focus?.();
      });
    }
  }

  if (trashToggle && trashArchive) {
    syncTrashToggleState(false);
    trashToggle.addEventListener('click', event => {
      event.preventDefault();
      const nextOpen = !isTrashPanelOpen();
      setTrashPanelVisibility(nextOpen, { triggeredBy: trashToggle });
    });
  }

  if (trashClose) {
    trashClose.addEventListener('click', event => {
      event.preventDefault();
      setTrashPanelVisibility(false, { announce: true });
    });
  }

  if (trashArchive) {
    trashArchive.addEventListener('keydown', event => {
      if (event.key === 'Escape' && isTrashPanelOpen()) {
        event.preventDefault();
        setTrashPanelVisibility(false, { announce: true });
      }
    });
  }

  function normalizeAssetUrl(url, formatHint) {
    if (typeof url !== 'string') {
      return '';
    }

    const trimmed = url.trim();
    if (!trimmed) {
      return '';
    }

    if (/^(?:https?:)?\/\//.test(trimmed)) {
      return trimmed;
    }

    const resolvedSvgApiBase = typeof svgApiBase === 'string' && svgApiBase ? svgApiBase : null;

    if (trimmed.startsWith('/api/svg/raw') || (resolvedSvgApiBase && trimmed.startsWith(resolvedSvgApiBase))) {
      return trimmed;
    }

    if (!trimmed.startsWith('/') && /\.(?:svg|png)(?:[?#].*)?$/i.test(trimmed)) {
      const searchParams = new URLSearchParams();
      searchParams.set('path', trimmed.replace(/^\/+/, ''));
      const extensionMatch = trimmed.match(/\.([a-z0-9]+)(?:[?#].*)?$/i);
      const derivedFormat = extensionMatch ? extensionMatch[1].toLowerCase() : '';
      const format = (typeof formatHint === 'string' && formatHint.trim()) || derivedFormat;
      if (format) {
        searchParams.set('format', format);
      }
      const apiUrl = typeof buildSvgApiUrl === 'function'
        ? buildSvgApiUrl(`raw?${searchParams.toString()}`)
        : null;
      return apiUrl || `/api/svg/raw?${searchParams.toString()}`;
    }

    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;

    if (normalized.startsWith('/bildearkiv/')) {
      const searchParams = new URLSearchParams();
      searchParams.set('path', normalized.replace(/^\/+/, ''));
      if (formatHint) {
        searchParams.set('format', formatHint);
      }
      const apiUrl = typeof buildSvgApiUrl === 'function'
        ? buildSvgApiUrl(`raw?${searchParams.toString()}`)
        : null;
      return apiUrl || `/api/svg/raw?${searchParams.toString()}`;
    }

    return normalized;
  }

  function sanitizeBaseName(value) {
    if (typeof value !== 'string') {
      return '';
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    return trimmed.replace(/\.[^/.]+$/g, '').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  }

  function createArchiveDialog(options = {}) {
    const dialog = document.querySelector('dialog[data-archive-viewer]') || (() => {
      const dialogElement = document.createElement('dialog');
      dialogElement.dataset.archiveViewer = 'true';
      dialogElement.className = 'svg-archive__dialog';
      dialogElement.setAttribute('aria-modal', 'true');
      dialogElement.setAttribute('role', 'dialog');
      dialogElement.setAttribute('aria-labelledby', 'svg-archive-dialog-title');
      dialogElement.setAttribute('aria-describedby', 'svg-archive-dialog-caption');

      const overlay = document.createElement('div');
      overlay.className = 'svg-archive__dialog-surface';

      const header = document.createElement('header');
      header.className = 'svg-archive__dialog-header';

      const titleGroup = document.createElement('div');
      titleGroup.className = 'svg-archive__dialog-titlegroup';

      const title = document.createElement('h2');
      title.id = 'svg-archive-dialog-title';
      title.className = 'svg-archive__dialog-title';
      titleGroup.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.className = 'svg-archive__dialog-subtitle';
      subtitle.setAttribute('aria-live', 'polite');
      subtitle.setAttribute('hidden', '');
      titleGroup.appendChild(subtitle);

      header.appendChild(titleGroup);

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'svg-archive__dialog-close';
      closeButton.setAttribute('aria-label', 'Lukk visning');
      closeButton.innerHTML = '&times;';
      header.appendChild(closeButton);

      const body = document.createElement('div');
      body.className = 'svg-archive__dialog-body';

      const figure = document.createElement('figure');
      figure.className = 'svg-archive__dialog-figure';

      const image = document.createElement('img');
      image.className = 'svg-archive__dialog-image';
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      figure.appendChild(image);

      const figcaption = document.createElement('figcaption');
      figcaption.id = 'svg-archive-dialog-caption';
      figcaption.className = 'svg-archive__dialog-caption';
      figure.appendChild(figcaption);

      const descriptionSection = document.createElement('section');
      descriptionSection.className = 'svg-archive__dialog-section svg-archive__dialog-section--description';
      descriptionSection.setAttribute('hidden', '');

      const descriptionTitle = document.createElement('h3');
      descriptionTitle.className = 'svg-archive__dialog-section-title';
      descriptionTitle.textContent = 'Oppgavetekst';
      descriptionSection.appendChild(descriptionTitle);

      const descriptionBody = document.createElement('div');
      descriptionBody.id = 'svg-archive-dialog-description';
      descriptionBody.className = 'svg-archive__dialog-description';
      descriptionBody.dataset.state = 'loading';
      descriptionSection.appendChild(descriptionBody);

      const altTextSection = document.createElement('section');
      altTextSection.className = 'svg-archive__dialog-section svg-archive__dialog-section--alt-text';

      const altTextTitle = document.createElement('h3');
      altTextTitle.className = 'svg-archive__dialog-section-title';
      altTextTitle.textContent = 'Alternativ tekst';
      altTextSection.appendChild(altTextTitle);

      const altTextNote = document.createElement('p');
      altTextNote.className = 'svg-archive__dialog-alt-text-note';
      altTextNote.textContent = 'Teksten beskriver figuren for skjermlesere og kan redigeres ved behov.';
      altTextSection.appendChild(altTextNote);

      const altTextEditor = document.createElement('div');
      altTextEditor.dataset.altTextEditor = 'true';
      altTextSection.appendChild(altTextEditor);

      const altTextFigure = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      altTextFigure.classList.add('svg-archive__dialog-alt-text-figure');
      altTextFigure.setAttribute('aria-hidden', 'true');
      altTextFigure.setAttribute('focusable', 'false');
      altTextFigure.setAttribute('width', '0');
      altTextFigure.setAttribute('height', '0');
      altTextSection.appendChild(altTextFigure);

      const meta = document.createElement('dl');
      meta.id = 'svg-archive-dialog-meta';
      meta.className = 'svg-archive__dialog-meta';

      const actions = document.createElement('div');
      actions.className = 'svg-archive__dialog-actions';
      actions.setAttribute('role', 'group');
      actions.setAttribute('aria-label', 'Handlinger for figur');

      const actionConfig = [
        { action: 'open-svg', label: 'Åpne SVG' },
        { action: 'open-png', label: 'Åpne PNG' },
        { action: 'edit', label: 'Rediger i verktøy' },
        { action: 'download', label: 'Last ned' },
        { action: 'delete', label: 'Slett figur' }
      ];

      for (const { action, label } of actionConfig) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'svg-archive__dialog-action';
        button.dataset.action = action;
        button.textContent = label;
        actions.appendChild(button);
      }

      body.appendChild(figure);
      body.appendChild(descriptionSection);
      body.appendChild(altTextSection);
      body.appendChild(meta);
      body.appendChild(actions);

      overlay.appendChild(header);
      overlay.appendChild(body);
      dialogElement.appendChild(overlay);
      document.body.appendChild(dialogElement);

      return dialogElement;
    })();

    const titleElement = dialog.querySelector('.svg-archive__dialog-title');
    const closeButton = dialog.querySelector('.svg-archive__dialog-close');
    const subtitleElement = dialog.querySelector('.svg-archive__dialog-subtitle');
    const captionElement = dialog.querySelector('.svg-archive__dialog-caption');
    const imageElement = dialog.querySelector('.svg-archive__dialog-image');
    const descriptionSectionElement = dialog.querySelector('.svg-archive__dialog-section--description');
    const descriptionContentElement = descriptionSectionElement
      ? descriptionSectionElement.querySelector('.svg-archive__dialog-description')
      : null;
    const altTextSectionElement = dialog.querySelector('.svg-archive__dialog-section--alt-text');
    const altTextEditorContainer = altTextSectionElement
      ? altTextSectionElement.querySelector('[data-alt-text-editor]')
      : null;
    const altTextNoteElement = altTextSectionElement
      ? altTextSectionElement.querySelector('.svg-archive__dialog-alt-text-note')
      : null;
    const altTextFigureElement = altTextSectionElement
      ? altTextSectionElement.querySelector('.svg-archive__dialog-alt-text-figure')
      : null;
    const metaElement = dialog.querySelector('.svg-archive__dialog-meta');
    const actionsContainer = dialog.querySelector('.svg-archive__dialog-actions');
    const actionButtons = Array.from(actionsContainer.querySelectorAll('[data-action]'));

    function resolveCaptionText(entry, details) {
      const fallbackEntry = entry || {};
      const detailsSummary = details && details.summary;
      const fallbackSummary = fallbackEntry.summary;
      const pickFromObject = value => {
        if (value && typeof value === 'object') {
          if (typeof value.text === 'string' && value.text.trim()) {
            return value.text.trim();
          }
          if (typeof value.description === 'string' && value.description.trim()) {
            return value.description.trim();
          }
        }
        return '';
      };
      const detailsObjectText = pickFromObject(detailsSummary);
      if (detailsObjectText) {
        return detailsObjectText;
      }
      if (typeof detailsSummary === 'string' && detailsSummary.trim()) {
        return detailsSummary.trim();
      }
      const fallbackObjectText = pickFromObject(fallbackSummary);
      if (fallbackObjectText) {
        return fallbackObjectText;
      }
      if (typeof fallbackSummary === 'string' && fallbackSummary.trim()) {
        return fallbackSummary.trim();
      }
      return '';
    }

    function updateCaption(entry, details) {
      if (!captionElement) {
        return;
      }
      const text = resolveCaptionText(entry, details);
      captionElement.textContent = text;
      if (text) {
        captionElement.removeAttribute('hidden');
      } else {
        captionElement.setAttribute('hidden', '');
      }
      syncDialogDescriptionTargets();
    }

    function updateAltTextNoteDisplay(source) {
      if (!altTextNoteElement) {
        return;
      }
      if (source === 'manual') {
        altTextNoteElement.textContent = 'Teksten er lagret manuelt og brukes for skjermlesere.';
      } else {
        altTextNoteElement.textContent = 'Teksten er generert automatisk. Rediger og lagre ved behov.';
      }
    }

    let activeEntry = null;
    let restoreFocusTo = null;
    let currentDetails = null;
    let altTextManager = null;
    let pendingDetailsToken = 0;
    let altTextSaveToken = 0;

    async function persistAltTextForActiveEntry(text, source) {
      if (!activeEntry || !activeEntry.slug) {
        throw new Error('Fant ikke figuren som skulle lagres.');
      }
      const normalizedText = typeof text === 'string' ? text.trim() : '';
      const normalizedSource = source === 'manual' && normalizedText ? 'manual' : 'auto';
      const payload = {
        slug: activeEntry.slug,
        altText: normalizedText,
        altTextSource: normalizedSource
      };
      const token = ++altTextSaveToken;

      const apiUrl = buildSvgApiUrl();
      if (!apiUrl) {
        throw new Error('Fant ikke adressen til arkivtjenesten.');
      }

      let response;
      try {
        response = await fetch(apiUrl, {
          method: 'PATCH',
          headers: {
            'content-type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } catch (error) {
        throw Object.assign(new Error('Kunne ikke lagre teksten. Kontroller tilkoblingen og prøv igjen.'), { cause: error });
      }

      let responseBody = null;
      try {
        responseBody = await response.json();
      } catch (error) {
        responseBody = null;
      }

      if (!response.ok) {
        const message = responseBody && typeof responseBody.error === 'string' && responseBody.error.trim()
          ? responseBody.error.trim()
          : `Kunne ikke lagre teksten (status ${response.status}).`;
        throw new Error(message);
      }

      if (token !== altTextSaveToken) {
        return {
          text: normalizedText,
          source: normalizedSource
        };
      }

      const savedText = responseBody && typeof responseBody.altText === 'string'
        ? responseBody.altText.trim()
        : normalizedText;
      const rawSource = responseBody && typeof responseBody.altTextSource === 'string'
        ? responseBody.altTextSource.trim().toLowerCase()
        : normalizedSource;
      const savedSource = rawSource === 'manual' && savedText ? 'manual' : 'auto';

      updateAltTextRecord(activeEntry.slug, current => {
        current.text = savedText;
        current.source = savedSource;
        return current;
      });

      activeEntry.altText = savedText;
      activeEntry.altTextSource = savedSource;
      imageElement.alt = savedText || activeEntry.displayTitle || 'Forhåndsvisning';

      const cardImage = findCardPreviewImage(activeEntry.slug);
      if (cardImage) {
        cardImage.alt = savedText || `Forhåndsvisning av ${activeEntry.displayTitle || 'figur'}`;
      }

      if (currentDetails && currentDetails.slug === activeEntry.slug) {
        currentDetails.altText = savedText;
        currentDetails.altTextSource = savedSource;
        if (currentDetails.summary && typeof currentDetails.summary === 'object') {
          currentDetails.summary.altText = savedText;
          currentDetails.summary.altTextSource = savedSource;
        }
      }

      if (entryDetailsCache.has(activeEntry.slug)) {
        const cached = entryDetailsCache.get(activeEntry.slug);
        if (cached && typeof cached === 'object') {
          cached.altText = savedText;
          cached.altTextSource = savedSource;
          if (cached.summary && typeof cached.summary === 'object') {
            cached.summary.altText = savedText;
            cached.summary.altTextSource = savedSource;
          }
          entryDetailsCache.set(activeEntry.slug, cached);
        }
      }

      const listEntry = allEntries.find(item => item.slug === activeEntry.slug);
      if (listEntry && typeof listEntry === 'object') {
        listEntry.altText = savedText;
        listEntry.altTextSource = savedSource;
      }

      updateAltTextNoteDisplay(savedSource);

      return {
        text: savedText,
        source: savedSource
      };
    }

    function renderMeta(entry) {
      metaElement.innerHTML = '';

      const metaPairs = [];

      if (entry.sequenceLabel) {
        metaPairs.push(['Sekvens', entry.sequenceLabel]);
      }
      if (entry.fileSizeLabel) {
        metaPairs.push(['Filstørrelse', entry.fileSizeLabel]);
      }

      if (!metaPairs.length) {
        metaElement.setAttribute('hidden', '');
        syncDialogDescriptionTargets();
        return;
      }

      metaElement.removeAttribute('hidden');

      for (const [term, description] of metaPairs) {
        const dt = document.createElement('dt');
        dt.textContent = term;
        metaElement.appendChild(dt);

        const dd = document.createElement('dd');
        dd.textContent = description;
        metaElement.appendChild(dd);
      }

      syncDialogDescriptionTargets();
    }

    function syncDialogDescriptionTargets() {
      const descriptionIds = [];
      if (!captionElement.hasAttribute('hidden')) {
        descriptionIds.push('svg-archive-dialog-caption');
      }
      if (descriptionSectionElement && !descriptionSectionElement.hasAttribute('hidden')) {
        descriptionIds.push('svg-archive-dialog-description');
      }
      if (!metaElement.hasAttribute('hidden')) {
        descriptionIds.push('svg-archive-dialog-meta');
      }
      if (descriptionIds.length) {
        dialog.setAttribute('aria-describedby', descriptionIds.join(' '));
      } else {
        dialog.removeAttribute('aria-describedby');
      }
    }

    function showDescriptionMessage(message, { state = 'info', hidden = false, empty = false } = {}) {
      if (!descriptionSectionElement || !descriptionContentElement) {
        return;
      }
      if (hidden) {
        descriptionSectionElement.setAttribute('hidden', '');
      } else {
        descriptionSectionElement.removeAttribute('hidden');
      }
      descriptionContentElement.dataset.state = state;
      if (empty) {
        descriptionContentElement.dataset.empty = 'true';
      } else {
        delete descriptionContentElement.dataset.empty;
      }
      descriptionContentElement.textContent = message;
      syncDialogDescriptionTargets();
    }

    function renderDescriptionContent(description) {
      if (!descriptionSectionElement || !descriptionContentElement) {
        return;
      }
      const text = typeof description === 'string' ? description.trim() : '';
      if (!text) {
        showDescriptionMessage('Ingen oppgavetekst er lagret for denne figuren.', {
          state: 'empty',
          hidden: false,
          empty: true
        });
        return;
      }
      descriptionSectionElement.removeAttribute('hidden');
      descriptionContentElement.dataset.state = 'ready';
      delete descriptionContentElement.dataset.empty;
      if (window.MathVisDescriptionRenderer && typeof window.MathVisDescriptionRenderer.renderInto === 'function') {
        const success = window.MathVisDescriptionRenderer.renderInto(descriptionContentElement, text);
        if (!success) {
          descriptionContentElement.textContent = text;
        }
      } else {
        descriptionContentElement.textContent = text;
      }
      syncDialogDescriptionTargets();
    }

    function ensureAltTextManager() {
      if (!window.MathVisAltText || !altTextEditorContainer || !altTextFigureElement) {
        return null;
      }
      if (altTextManager) {
        altTextManager.ensureDom();
        return altTextManager;
      }
      altTextManager = window.MathVisAltText.create({
        svg: () => altTextFigureElement,
        container: altTextEditorContainer,
        getTitle: () => {
          if (!activeEntry) {
            return 'Figur';
          }
          return activeEntry.displayTitle || activeEntry.title || activeEntry.baseName || 'Figur';
        },
        getState: () => {
          if (!activeEntry || !activeEntry.slug) {
            return { text: '', source: 'auto' };
          }
          const record = entryAltTextCache.get(activeEntry.slug) || { text: '', source: 'auto' };
          return {
            text: record.text || '',
            source: record.source === 'manual' ? 'manual' : 'auto'
          };
        },
        setState: (text, source) => {
          if (!activeEntry || !activeEntry.slug) {
            return;
          }
          const normalizedText = typeof text === 'string' ? text.trim() : '';
          const normalizedSource = source === 'manual' ? 'manual' : 'auto';
          const record = updateAltTextRecord(activeEntry.slug, current => {
            current.text = normalizedText;
            current.source = normalizedSource;
            return current;
          });
          activeEntry.altText = normalizedText;
          if (currentDetails && currentDetails.slug === activeEntry.slug) {
            currentDetails.altText = normalizedText;
            if (currentDetails.summary && typeof currentDetails.summary === 'object') {
              currentDetails.summary.altText = normalizedText;
              currentDetails.summary.altTextSource = normalizedSource;
            }
          }
          imageElement.alt = normalizedText || activeEntry.displayTitle || 'Forhåndsvisning';
          const cardImage = findCardPreviewImage(activeEntry.slug);
          if (cardImage) {
            cardImage.alt = normalizedText || `Forhåndsvisning av ${activeEntry.displayTitle || 'figur'}`;
          }
          updateAltTextNoteDisplay(normalizedSource);
          return record;
        },
        generate: () => {
          if (!activeEntry || !activeEntry.slug) {
            return '';
          }
          const record = entryAltTextCache.get(activeEntry.slug);
          return record && record.autoText ? record.autoText : '';
        },
        getAutoMessage: () => 'Alternativ tekst oppdatert automatisk.',
        getManualMessage: () => 'Alternativ tekst oppdatert manuelt.',
        getSignature: () => {
          if (!activeEntry || !activeEntry.slug) {
            return '';
          }
          const record = entryAltTextCache.get(activeEntry.slug);
          return record && record.signature ? record.signature : '';
        },
        save: (text, context) => {
          const source = context && typeof context.source === 'string' ? context.source : 'auto';
          return persistAltTextForActiveEntry(text, source).then(result => ({
            text: result.text,
            source: result.source,
            message: 'Alternativ tekst lagret.'
          }));
        }
      });
      return altTextManager;
    }

    function applyAltTextState(entry, details, { reason = 'auto', signatureOverride = undefined } = {}) {
      if (!entry || !entry.slug) {
        return;
      }
      const record = ensureAltTextRecord(entry.slug, entry, details);
      if (!record) {
        return;
      }
      entry.altText = record.text;
      const manager = ensureAltTextManager();
      if (manager) {
        manager.ensureDom();
        if (typeof manager.markSaved === 'function') {
          manager.markSaved({ text: record.text, source: record.source });
        }
        const signatureValue = signatureOverride !== undefined ? signatureOverride : record.signature;
        if (record.source === 'manual') {
          manager.notifyFigureChange(signatureValue);
          manager.applyCurrent();
        } else {
          manager.refresh(reason, signatureValue);
        }
      }
      imageElement.alt = record.text || entry.displayTitle || 'Forhåndsvisning';
      const cardImage = findCardPreviewImage(entry.slug);
      if (cardImage) {
        cardImage.alt = record.text || `Forhåndsvisning av ${entry.displayTitle || 'figur'}`;
      }
      updateCaption(entry, details);
      updateAltTextNoteDisplay(record.source === 'manual' ? 'manual' : 'auto');
      syncDialogDescriptionTargets();
    }

    function updateDialog(entry) {
      activeEntry = entry;
      currentDetails = null;
      const token = ++pendingDetailsToken;
      titleElement.textContent = entry.displayTitle || entry.title || entry.baseName || 'Detaljer';
      if (subtitleElement) {
        if (entry.createdAt) {
          const formatted = new Date(entry.createdAt).toLocaleString('nb-NO', {
            dateStyle: 'medium',
            timeStyle: 'short'
          });
          subtitleElement.textContent = formatted;
          subtitleElement.removeAttribute('hidden');
        } else {
          subtitleElement.textContent = '';
          subtitleElement.setAttribute('hidden', '');
        }
      }

      updateCaption(entry, null);

      if (entry.pngUrl) {
        imageElement.src = entry.pngUrl;
      } else if (entry.svgUrl) {
        imageElement.src = entry.svgUrl;
      } else {
        imageElement.removeAttribute('src');
      }

      renderMeta(entry);
      syncDialogDescriptionTargets();

      updateAltTextNoteDisplay(entry.altTextSource === 'manual' ? 'manual' : 'auto');

      let cachedDetails = null;
      if (entry.slug && entryDetailsCache.has(entry.slug)) {
        cachedDetails = entryDetailsCache.get(entry.slug);
        currentDetails = cachedDetails;
      }

      if (cachedDetails && typeof cachedDetails.description === 'string') {
        renderDescriptionContent(cachedDetails.description);
      } else if (entry.slug) {
        showDescriptionMessage('Laster oppgavetekst …', { state: 'loading', hidden: false });
      } else {
        showDescriptionMessage('Ingen oppgavetekst er tilgjengelig for denne figuren.', {
          state: 'empty',
          hidden: false,
          empty: true
        });
      }

      updateCaption(entry, cachedDetails);

      applyAltTextState(entry, cachedDetails, { reason: 'init' });

      const hasSvg = Boolean(entry.svgUrl);
      const hasPng = Boolean(entry.pngUrl);
      const targetConfig = resolveEntryOpenTarget(entry);
      const hasExampleState = entry.exampleState != null;
      const canEdit = Boolean(targetConfig && hasExampleState);
      const canDownload = hasSvg || hasPng;

      for (const button of actionButtons) {
        const action = button.dataset.action;
        let isAvailable = true;

        switch (action) {
          case 'open-svg':
            isAvailable = hasSvg;
            break;
          case 'open-png':
            isAvailable = hasPng;
            break;
          case 'edit':
            isAvailable = canEdit;
            break;
          case 'download':
            isAvailable = canDownload;
            break;
          default:
            isAvailable = true;
            break;
        }

        if (!isAvailable) {
          button.disabled = true;
          button.setAttribute('aria-hidden', 'true');
        } else {
          button.disabled = false;
          button.removeAttribute('aria-hidden');
        }
      }

      if (!entry.slug) {
        return;
      }

      fetchEntryDetails(entry.slug, { fallback: entry })
        .then(details => {
          if (!details || !activeEntry || activeEntry.slug !== entry.slug || token !== pendingDetailsToken) {
            return;
          }
          currentDetails = details;
          if (typeof details.description === 'string' && details.description.trim()) {
            renderDescriptionContent(details.description);
          } else {
            showDescriptionMessage('Ingen oppgavetekst er lagret for denne figuren.', {
              state: 'empty',
              hidden: false,
              empty: true
            });
          }
          updateCaption(entry, details);
          applyAltTextState(entry, details, {
            reason: 'details-update',
            signatureOverride: computeAltTextSignature(entry, details)
          });
        })
        .catch(() => {
          if (!activeEntry || activeEntry.slug !== entry.slug || token !== pendingDetailsToken) {
            return;
          }
          const fallbackDetails = currentDetails || cachedDetails || null;
          const existing = currentDetails && typeof currentDetails.description === 'string'
            ? currentDetails.description.trim()
            : cachedDetails && typeof cachedDetails.description === 'string'
              ? cachedDetails.description.trim()
              : '';
          if (existing) {
            renderDescriptionContent(existing);
            updateCaption(entry, fallbackDetails);
            return;
          }
          showDescriptionMessage('Kunne ikke hente oppgaveteksten.', {
            state: 'error',
            hidden: false,
            empty: true
          });
          updateCaption(entry, fallbackDetails);
        });
    }

    function closeDialog(options = {}) {
      const { returnFocus = true } = options;
      if (!dialog.open) {
        return;
      }
      dialog.close();
      dialog.removeEventListener('keydown', trapFocus, true);
      dialog.removeEventListener('cancel', handleCancel, true);
      dialog.removeEventListener('click', handleBackdropClick);
      if (returnFocus && restoreFocusTo && typeof restoreFocusTo.focus === 'function') {
        restoreFocusTo.focus();
      }
      restoreFocusTo = null;
      activeEntry = null;
    }

    function trapFocus(event) {
      if (event.key !== 'Tab') {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeDialog();
        }
        return;
      }

      const focusable = getFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        closeDialog();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleCancel(event) {
      event.preventDefault();
      closeDialog();
    }

    function handleBackdropClick(event) {
      if (event.target === dialog) {
        closeDialog();
      }
    }

    closeButton.addEventListener('click', () => {
      closeDialog();
    });

    actionsContainer.addEventListener('click', async event => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const button = event.target.closest('[data-action]');
      if (!button || !actionsContainer.contains(button)) {
        return;
      }
      event.preventDefault();
      if (!activeEntry) {
        return;
      }
      const action = button.dataset.action;
      if (!action) {
        return;
      }
      await options.onAction?.(action, activeEntry, {
        close: closeDialog
      });
    });

    return {
      open(entry, { focusActions = false, trigger = null } = {}) {
        restoreFocusTo = trigger || document.activeElement;
        updateDialog(entry);
        dialog.showModal();
        dialog.addEventListener('keydown', trapFocus, true);
        dialog.addEventListener('cancel', handleCancel, true);
        dialog.addEventListener('click', handleBackdropClick);

        const focusTarget = focusActions
          ? actionButtons.find(button => !button.disabled)
          : closeButton;

        requestAnimationFrame(() => {
          if (focusTarget) {
            focusTarget.focus();
          }
        });
      },
      close: closeDialog,
      isOpen: () => dialog.open,
      getCurrentEntry: () => activeEntry
    };
  }

  function createRenameDialog() {
    const dialog = document.createElement('dialog');
    dialog.className = 'svg-archive__dialog svg-archive__dialog--rename';
    dialog.dataset.renameDialog = 'true';
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-labelledby', 'svg-archive-rename-title');

    const surface = document.createElement('div');
    surface.className = 'svg-archive__dialog-surface';

    const header = document.createElement('header');
    header.className = 'svg-archive__dialog-header';

    const title = document.createElement('h2');
    title.id = 'svg-archive-rename-title';
    title.className = 'svg-archive__dialog-title';
    title.textContent = 'Gi nytt navn';
    header.appendChild(title);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'svg-archive__dialog-close';
    closeButton.setAttribute('aria-label', 'Lukk omdøpingsvindu');
    closeButton.innerHTML = '&times;';
    header.appendChild(closeButton);

    const form = document.createElement('form');
    form.className = 'svg-archive__dialog-body svg-archive__rename-body';
    form.noValidate = true;

    const messageElement = document.createElement('p');
    messageElement.className = 'svg-archive__rename-message';
    messageElement.hidden = true;
    form.appendChild(messageElement);

    const listElement = document.createElement('ul');
    listElement.className = 'svg-archive__rename-list';
    form.appendChild(listElement);

    const actionsElement = document.createElement('div');
    actionsElement.className = 'svg-archive__rename-actions';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'svg-archive__dialog-action svg-archive__dialog-action--secondary';
    cancelButton.textContent = 'Avbryt';
    actionsElement.appendChild(cancelButton);

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'svg-archive__dialog-action';
    submitButton.textContent = 'Lagre endringer';
    submitButton.disabled = true;
    actionsElement.appendChild(submitButton);

    form.appendChild(actionsElement);

    surface.appendChild(header);
    surface.appendChild(form);
    dialog.appendChild(surface);
    document.body.appendChild(dialog);

    let activeEntries = [];
    let restoreFocusTo = null;
    let fieldCounter = 0;
    const renameState = new Map();

    function showMessage(text, state = 'info') {
      if (!messageElement) {
        return;
      }
      if (text) {
        messageElement.textContent = text;
        messageElement.dataset.state = state;
        messageElement.hidden = false;
      } else {
        messageElement.textContent = '';
        messageElement.dataset.state = '';
        messageElement.hidden = true;
      }
    }

    function updateSubmitState() {
      if (!submitButton) {
        return;
      }
      const inputs = Array.from(listElement.querySelectorAll('.svg-archive__rename-input'));
      if (!inputs.length) {
        submitButton.disabled = true;
        return;
      }
      let hasChange = false;
      for (const input of inputs) {
        const trimmed = input.value.trim();
        if (!trimmed) {
          submitButton.disabled = true;
          return;
        }
        const slug = normalizeSlugValue(input.dataset.renameInput);
        const state = renameState.get(slug) || { label: '', baseName: '' };
        const sanitized = sanitizeBaseName(trimmed);
        if (trimmed !== state.label || (sanitized && sanitized !== state.baseName)) {
          hasChange = true;
        }
      }
      submitButton.disabled = !hasChange;
    }

    function setBusy(busy) {
      dialog.dataset.state = busy ? 'busy' : 'idle';
      const inputs = listElement.querySelectorAll('.svg-archive__rename-input');
      inputs.forEach(input => {
        input.disabled = busy;
      });
      cancelButton.disabled = busy;
      if (busy) {
        submitButton.disabled = true;
      } else {
        updateSubmitState();
      }
    }

    function closeDialog(options = {}) {
      const { returnFocus = true } = options;
      if (dialog.open) {
        dialog.close();
      }
      dialog.removeEventListener('keydown', trapFocus, true);
      dialog.removeEventListener('cancel', handleCancel, true);
      dialog.removeEventListener('click', handleBackdropClick);
      if (returnFocus && restoreFocusTo && typeof restoreFocusTo.focus === 'function') {
        restoreFocusTo.focus();
      }
      restoreFocusTo = null;
      activeEntries = [];
      renameState.clear();
      listElement.innerHTML = '';
      showMessage('', 'info');
      dialog.dataset.state = 'idle';
    }

    function trapFocus(event) {
      if (event.key !== 'Tab') {
        if (event.key === 'Escape') {
          event.preventDefault();
          closeDialog();
        }
        return;
      }

      const focusable = getFocusableElements(dialog);
      if (!focusable.length) {
        event.preventDefault();
        closeDialog();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleCancel(event) {
      event.preventDefault();
      closeDialog();
    }

    function handleBackdropClick(event) {
      if (event.target === dialog) {
        closeDialog();
      }
    }

    function populate(entries) {
      fieldCounter = 0;
      renameState.clear();
      listElement.innerHTML = '';
      activeEntries = Array.isArray(entries) ? entries.filter(entry => entry && entry.slug) : [];
      const fragment = document.createDocumentFragment();
      for (const entry of activeEntries) {
        const slug = normalizeSlugValue(entry.slug);
        if (!slug) {
          continue;
        }
        const displayLabel = extractEntryName(entry) || entry.baseName || slug;
        const initialBaseName = typeof entry.baseName === 'string' && entry.baseName.trim()
          ? entry.baseName.trim()
          : sanitizeBaseName(slug) || sanitizeBaseName(displayLabel);
        renameState.set(slug, {
          slug,
          label: displayLabel,
          baseName: initialBaseName || ''
        });

        const item = document.createElement('li');
        item.className = 'svg-archive__rename-item';

        const inputId = `svg-archive-rename-${++fieldCounter}`;

        const label = document.createElement('label');
        label.className = 'svg-archive__rename-label';
        label.setAttribute('for', inputId);
        label.textContent = displayLabel;
        item.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'svg-archive__rename-input';
        input.id = inputId;
        input.value = displayLabel;
        input.dataset.renameInput = slug;
        input.addEventListener('input', () => {
          showMessage('', 'info');
          updateSubmitState();
        });
        item.appendChild(input);

        const hint = document.createElement('span');
        hint.className = 'svg-archive__rename-hint';
        hint.textContent = slug;
        item.appendChild(hint);

        fragment.appendChild(item);
      }
      listElement.appendChild(fragment);
      showMessage('', 'info');
      updateSubmitState();
    }

    async function handleSubmit(event) {
      event.preventDefault();
      if (!dialog.open) {
        return;
      }
      const inputs = Array.from(listElement.querySelectorAll('.svg-archive__rename-input'));
      if (!inputs.length) {
        closeDialog({ returnFocus: true });
        return;
      }

      const renameRequests = [];
      for (const input of inputs) {
        const slug = normalizeSlugValue(input.dataset.renameInput);
        if (!slug) {
          continue;
        }
        const state = renameState.get(slug) || { label: '', baseName: '' };
        const trimmed = input.value.trim();
        if (!trimmed) {
          showMessage('Navnet kan ikke være tomt.', 'error');
          input.focus();
          return;
        }
        const sanitized = sanitizeBaseName(trimmed);
        if (!sanitized) {
          showMessage('Navnet må inneholde bokstaver eller tall.', 'error');
          input.focus();
          return;
        }
        const changedName = trimmed !== state.label;
        const changedBase = sanitized !== state.baseName;
        if (!changedName && !changedBase) {
          continue;
        }
        renameRequests.push({ slug, name: trimmed, baseName: sanitized, state });
      }

      if (!renameRequests.length) {
        closeDialog({ returnFocus: true });
        return;
      }

      setBusy(true);
      showMessage(`Lagrer ${renameRequests.length} ${renameRequests.length === 1 ? 'figur' : 'figurer'} …`, 'pending');

      const apiUrl = buildSvgApiUrl();
      if (!apiUrl) {
        showMessage('Fant ikke adressen til arkivtjenesten.', 'error');
        setBusy(false);
        return;
      }

      try {
        for (const request of renameRequests) {
          const payload = {
            slug: request.slug,
            displayTitle: request.name,
            title: request.name,
            baseName: request.baseName
          };
          let response;
          try {
            response = await fetch(apiUrl, {
              method: 'PATCH',
              headers: {
                'content-type': 'application/json',
                Accept: 'application/json'
              },
              body: JSON.stringify(payload)
            });
          } catch (error) {
            throw Object.assign(new Error('Kunne ikke kontakte lagringstjenesten. Prøv igjen senere.'), { cause: error });
          }

          let responseBody = null;
          try {
            responseBody = await response.json();
          } catch (error) {
            responseBody = null;
          }

          if (!response.ok) {
            const message = responseBody && typeof responseBody.error === 'string' && responseBody.error.trim()
              ? responseBody.error.trim()
              : `Kunne ikke lagre navnet for «${request.name}».`;
            throw new Error(message);
          }

          if (responseBody) {
            const normalized = normalizeArchiveEntries([responseBody])[0] || null;
            if (normalized) {
              allEntries = allEntries.map(entry => (entry.slug === normalized.slug ? { ...entry, ...normalized } : entry));
            } else {
              allEntries = allEntries.map(entry => {
                if (entry.slug !== request.slug) {
                  return entry;
                }
                return {
                  ...entry,
                  displayTitle: request.name,
                  title: request.name,
                  baseName: responseBody.baseName || request.baseName
                };
              });
            }
            const cachedDetails = entryDetailsCache.get(request.slug);
            if (cachedDetails && typeof cachedDetails === 'object') {
              cachedDetails.title = responseBody.title || request.name;
              cachedDetails.displayTitle = responseBody.displayTitle || request.name;
              if (responseBody.baseName) {
                cachedDetails.baseName = responseBody.baseName;
              }
              entryDetailsCache.set(request.slug, cachedDetails);
            }
            renameState.set(request.slug, {
              slug: request.slug,
              label: responseBody.displayTitle || request.name,
              baseName: responseBody.baseName || request.baseName
            });
          }
        }

        setBusy(false);
        closeDialog({ returnFocus: true });
        render();
        const successMessage = renameRequests.length === 1
          ? 'Figurnavnet er oppdatert.'
          : `Oppdaterte ${renameRequests.length} figurnavn.`;
        setStatus(successMessage, 'success');
      } catch (error) {
        console.error('Kunne ikke lagre nye figurnavn.', error);
        setBusy(false);
        showMessage(error.message || 'Kunne ikke lagre nye figurnavn. Prøv igjen senere.', 'error');
        updateSubmitState();
      }
    }

    closeButton.addEventListener('click', () => {
      closeDialog();
    });
    cancelButton.addEventListener('click', () => {
      closeDialog();
    });
    form.addEventListener('submit', handleSubmit);

    return {
      open(entries, { trigger = null } = {}) {
        if (!Array.isArray(entries) || !entries.length) {
          return;
        }
        restoreFocusTo = trigger || document.activeElement;
        populate(entries);
        dialog.showModal();
        dialog.addEventListener('keydown', trapFocus, true);
        dialog.addEventListener('cancel', handleCancel, true);
        dialog.addEventListener('click', handleBackdropClick);
        requestAnimationFrame(() => {
          const firstInput = listElement.querySelector('.svg-archive__rename-input');
          if (firstInput) {
            firstInput.focus();
            firstInput.select();
          }
        });
      },
      close: closeDialog,
      isOpen: () => dialog.open
    };
  }

  archiveDialog = createArchiveDialog({
    onAction: performEntryAction
  });

  renameDialog = createRenameDialog();

  function createCard(entry) {
    const rawSlug = entry.slug || entry.svgSlug || entry.baseName || '';
    const slugValue = typeof rawSlug === 'string' ? rawSlug.trim() : '';
    const displayLabel = extractEntryName(entry) || entry.baseName || slugValue || 'Uten tittel';
    const isSelected = slugValue ? selectedSlugs.has(slugValue) : false;

    const item = document.createElement('li');
    item.className = 'svg-archive__item';
    item.dataset.svgItem = slugValue;
    if (isSelected) {
      item.classList.add('svg-archive__item--selected');
    }

    const card = document.createElement('article');
    card.className = 'svg-archive__card';
    if (isSelected) {
      card.classList.add('svg-archive__card--selected');
    }
    card.dataset.slug = slugValue;
    card.dataset.svgUrl = normalizeAssetUrl(entry.svgUrl, 'svg') || entry.svgUrl || '';
    card.dataset.pngUrl = normalizeAssetUrl(entry.pngUrl, 'png') || entry.pngUrl || '';

    const toolbar = document.createElement('div');
    toolbar.className = 'svg-archive__card-toolbar';

    const checkboxId = `svg-archive-select-${++cardIdCounter}`;
    const selectionLabel = document.createElement('label');
    selectionLabel.className = 'svg-archive__checkbox-label svg-archive__card-select';
    selectionLabel.setAttribute('for', checkboxId);
    selectionLabel.title = `Velg ${displayLabel}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'svg-archive__checkbox-input svg-archive__card-checkbox';
    checkbox.id = checkboxId;
    checkbox.dataset.selectEntry = slugValue;
    checkbox.checked = isSelected;
    checkbox.setAttribute('aria-label', `Velg ${displayLabel}`);
    selectionLabel.appendChild(checkbox);

    const checkboxVisual = document.createElement('span');
    checkboxVisual.className = 'svg-archive__checkbox-visual';
    checkboxVisual.setAttribute('aria-hidden', 'true');
    selectionLabel.appendChild(checkboxVisual);

    const menuTrigger = document.createElement('button');
    menuTrigger.type = 'button';
    menuTrigger.className = 'svg-archive__menu-trigger';
    menuTrigger.setAttribute('aria-haspopup', 'dialog');
    menuTrigger.setAttribute('aria-label', `Åpne meny for ${displayLabel}`);
    menuTrigger.dataset.slug = slugValue;
    menuTrigger.dataset.svgUrl = card.dataset.svgUrl;
    menuTrigger.dataset.pngUrl = card.dataset.pngUrl;

    toolbar.appendChild(selectionLabel);
    toolbar.appendChild(menuTrigger);

    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'svg-archive__preview';
    preview.dataset.previewTrigger = 'true';
    preview.setAttribute('aria-haspopup', 'dialog');
    preview.setAttribute('aria-label', `Vis detaljer for ${displayLabel}`);

    const img = document.createElement('img');
    img.src = normalizeAssetUrl(entry.thumbnailUrl, 'png') || entry.thumbnailUrl || '';
    img.alt = entry.altText || `Forhåndsvisning av ${displayLabel}`;
    img.loading = 'lazy';
    img.decoding = 'async';

    preview.appendChild(img);

    const nameElement = document.createElement('p');
    nameElement.className = 'svg-archive__card-name';
    nameElement.textContent = displayLabel;

    card.appendChild(toolbar);
    card.appendChild(preview);
    card.appendChild(nameElement);

    item.appendChild(card);

    return item;
  }

  function normalizeSlugValue(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function getVisibleSlugs() {
    return visibleEntries
      .map(entry => (entry && typeof entry.slug === 'string' ? entry.slug : ''))
      .map(normalizeSlugValue)
      .filter(Boolean);
  }

  function pruneSelection() {
    if (!selectedSlugs.size) {
      return false;
    }
    const validSlugs = new Set(
      allEntries
        .map(entry => (entry && typeof entry.slug === 'string' ? entry.slug : ''))
        .map(normalizeSlugValue)
        .filter(Boolean)
    );
    let changed = false;
    for (const slug of Array.from(selectedSlugs)) {
      if (!validSlugs.has(slug)) {
        selectedSlugs.delete(slug);
        changed = true;
      }
    }
    return changed;
  }

  function findCardContainer(slug) {
    if (!grid) {
      return null;
    }
    const normalized = normalizeSlugValue(slug);
    if (!normalized) {
      return null;
    }
    const escaped = escapeSelectorValue(normalized);
    if (!escaped) {
      return null;
    }
    return grid.querySelector(`[data-svg-item="${escaped}"]`);
  }

  function applySelectionStateToCard(slug, isSelected) {
    const container = findCardContainer(slug);
    if (!container) {
      return;
    }
    container.classList.toggle('svg-archive__item--selected', Boolean(isSelected));
    const card = container.querySelector('.svg-archive__card');
    if (card) {
      card.classList.toggle('svg-archive__card--selected', Boolean(isSelected));
    }
    const checkbox = container.querySelector('.svg-archive__card-checkbox');
    if (checkbox) {
      checkbox.checked = Boolean(isSelected);
    }
  }

  function buildSelectionLabel(totalCount, visibleSelectedCount, visibleCount) {
    const noun = totalCount === 1 ? 'figur' : 'figurer';
    let label = `${totalCount} ${noun} valgt`;
    if (visibleCount > 0 && visibleSelectedCount !== totalCount) {
      const suffix = visibleSelectedCount === 1 ? 'synlig' : 'synlige';
      label += ` (${visibleSelectedCount} ${suffix})`;
    }
    return label;
  }

  function updateSelectionSummary() {
    const totalSelected = selectedSlugs.size;
    const visibleSlugs = getVisibleSlugs();
    const visibleCount = visibleSlugs.length;
    const visibleSelectedCount = visibleSlugs.reduce(
      (count, slug) => (selectedSlugs.has(slug) ? count + 1 : count),
      0
    );

    if (selectionBar) {
      selectionBar.classList.toggle('svg-archive__actions--active', totalSelected > 0);
    }

    if (selectionCountElement) {
      if (totalSelected > 0) {
        selectionCountElement.textContent = buildSelectionLabel(totalSelected, visibleSelectedCount, visibleCount);
        selectionCountElement.hidden = false;
      } else {
        selectionCountElement.textContent = '';
        selectionCountElement.hidden = true;
      }
    }

    if (renameSelectedButton) {
      renameSelectedButton.disabled = totalSelected === 0;
    }

    if (selectAllToggle) {
      if (!visibleCount) {
        selectAllToggle.checked = false;
        selectAllToggle.indeterminate = false;
        selectAllToggle.disabled = true;
      } else {
        const allVisibleSelected = visibleSelectedCount === visibleCount;
        selectAllToggle.disabled = false;
        selectAllToggle.checked = allVisibleSelected;
        selectAllToggle.indeterminate = visibleSelectedCount > 0 && !allVisibleSelected;
      }
    }
  }

  function setSelectionForSlug(slug, shouldSelect) {
    const normalized = normalizeSlugValue(slug);
    if (!normalized) {
      return false;
    }
    const currentlySelected = selectedSlugs.has(normalized);
    if (shouldSelect) {
      if (!currentlySelected) {
        selectedSlugs.add(normalized);
        applySelectionStateToCard(normalized, true);
        updateSelectionSummary();
      }
      return true;
    }
    if (currentlySelected) {
      selectedSlugs.delete(normalized);
      applySelectionStateToCard(normalized, false);
      updateSelectionSummary();
    }
    return false;
  }

  function toggleSelectionForSlug(slug) {
    const normalized = normalizeSlugValue(slug);
    if (!normalized) {
      return;
    }
    const shouldSelect = !selectedSlugs.has(normalized);
    setSelectionForSlug(normalized, shouldSelect);
  }

  function getSelectedEntriesOrdered() {
    if (!selectedSlugs.size) {
      return [];
    }
    const visibleOrdered = getVisibleSlugs().filter(slug => selectedSlugs.has(slug));
    const orderedSlugs = Array.from(selectedSlugs).reduce((list, slug) => {
      if (!visibleOrdered.includes(slug)) {
        list.push(slug);
      }
      return list;
    }, [...visibleOrdered]);
    const entriesBySlug = new Map(allEntries.map(entry => [entry.slug, entry]));
    return orderedSlugs.map(slug => entriesBySlug.get(slug)).filter(Boolean);
  }

  function sortEntries(entries, sortValue) {
    const list = Array.isArray(entries) ? entries.slice() : [];
    const value = typeof sortValue === 'string' && sortValue.trim() ? sortValue.trim() : 'newest';

    const compareNames = (a, b) => {
      const nameA = extractEntryName(a);
      const nameB = extractEntryName(b);
      if (nameCollator) {
        return nameCollator.compare(nameA, nameB);
      }
      return nameA.localeCompare(nameB || '', 'nb');
    };

    switch (value) {
      case 'oldest':
        return list.sort((a, b) => resolveEntryTimestamp(a) - resolveEntryTimestamp(b));
      case 'az':
        return list.sort(compareNames);
      case 'size':
        return list.sort((a, b) => resolveEntryFileSize(b) - resolveEntryFileSize(a));
      case 'newest':
      default:
        return list.sort((a, b) => resolveEntryTimestamp(b) - resolveEntryTimestamp(a));
    }
  }

  function buildEntrySearchText(entry) {
    if (!entry || typeof entry !== 'object') {
      return '';
    }
    const parts = [];
    const append = (value) => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          parts.push(trimmed);
        }
      }
    };

    append(extractEntryName(entry));
    append(entry.tool);
    append(entry.description);
    append(entry.summary);

    if (entry.summary && typeof entry.summary === 'object') {
      append(entry.summary.text);
      append(entry.summary.description);
      append(entry.summary.altText);
    }

    if (entry.metadata && typeof entry.metadata === 'object') {
      append(entry.metadata.description);
      append(entry.metadata.summary);
    }

    return parts.join(' ');
  }

  function render({ announceSort = false } = {}) {
    pruneSelection();
    const selectedTool = filterSelect && filterSelect.value !== 'all' ? filterSelect.value : null;
    const rawSearchQuery = searchInput && typeof searchInput.value === 'string'
      ? searchInput.value.trim()
      : '';
    const normalizedSearchQuery = rawSearchQuery.toLowerCase();
    const filteredEntries = allEntries.filter(entry => {
      if (selectedTool && entry.tool !== selectedTool) {
        return false;
      }
      if (!normalizedSearchQuery) {
        return true;
      }
      const searchText = buildEntrySearchText(entry).toLowerCase();
      return searchText.includes(normalizedSearchQuery);
    });

    if (archiveDialog && archiveDialog.isOpen()) {
      archiveDialog.close({ returnFocus: false });
    }
    grid.innerHTML = '';
    cardIdCounter = 0;

    if (!filteredEntries.length) {
      let message = 'Ingen SVG-er funnet ennå.';
      if (allEntries.length) {
        if (normalizedSearchQuery && selectedTool) {
          message = 'Ingen SVG-er matcher søket og valgt filter.';
        } else if (normalizedSearchQuery) {
          message = 'Ingen SVG-er matcher søket.';
        } else if (selectedTool) {
          message = 'Ingen SVG-er matcher valgt filter.';
        }
      }
      setStatus(message);
      visibleEntries = [];
      updateSelectionSummary();
      return;
    }

    const sortValue = sortSelect ? sortSelect.value : 'newest';
    const sortedEntries = sortEntries(filteredEntries, sortValue);

    visibleEntries = sortedEntries.slice();

    if (announceSort && sortSelect) {
      const selectedOption = sortSelect.options && sortSelect.selectedIndex >= 0
        ? sortSelect.options[sortSelect.selectedIndex]
        : null;
      const sortLabel = selectedOption && selectedOption.textContent
        ? selectedOption.textContent.trim()
        : '';
      setStatus(sortLabel ? `Sortering oppdatert: ${sortLabel}.` : 'Sortering oppdatert.');
    } else if (announceSort) {
      setStatus('Sortering oppdatert.');
    } else {
      setStatus('');
    }

    const fragment = document.createDocumentFragment();
    for (const entry of sortedEntries) {
      fragment.appendChild(createCard(entry));
    }
    grid.appendChild(fragment);

    updateSelectionSummary();
  }

  function updateFilterOptions() {
    if (!filterSelect || !filterWrapper) {
      return;
    }

    const tools = Array.from(new Set(allEntries.map(entry => entry.tool).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'nb')
    );

    const previousValue = filterSelect.value;
    filterSelect.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'Alle verktøy';
    filterSelect.appendChild(allOption);

    for (const tool of tools) {
      const option = document.createElement('option');
      option.value = tool;
      option.textContent = tool;
      filterSelect.appendChild(option);
    }

    if (tools.includes(previousValue)) {
      filterSelect.value = previousValue;
    } else {
      filterSelect.value = 'all';
    }

    filterWrapper.hidden = tools.length <= 1;
  }

  function applyStorageNote(metadata) {
    if (!storageNote) return;
    if (!metadata || !metadata.limitation) {
      storageNote.hidden = true;
      storageNote.textContent = '';
      return;
    }
    storageNote.hidden = false;
    storageNote.textContent = metadata.limitation;
  }

  function extractArchiveMetadata(payload) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    const limitation = typeof payload.limitation === 'string' && payload.limitation.trim()
      ? payload.limitation.trim()
      : '';
    if (payload.metadata && typeof payload.metadata === 'object') {
      const metadata = { ...payload.metadata };
      if (limitation && typeof metadata.limitation !== 'string') {
        metadata.limitation = limitation;
      }
      return metadata;
    }
    if (limitation) {
      return { limitation };
    }
    return null;
  }

  function parseFileSizeLabel(label) {
    if (typeof label !== 'string') {
      return null;
    }
    const normalized = label.trim();
    if (!normalized) {
      return null;
    }
    const withSpaces = normalized.replace(/\u00A0/g, ' ');
    const match = withSpaces.match(/([0-9]+(?:[\s.,][0-9]+)*)\s*(bytes?|b|kb|kib|mb|mib|gb|gib)?/i);
    if (!match) {
      return null;
    }
    let numericText = match[1].replace(/\s+/g, '');
    const commaCount = (numericText.match(/,/g) || []).length;
    const dotCount = (numericText.match(/\./g) || []).length;
    if (commaCount > 1 && dotCount === 0) {
      numericText = numericText.replace(/,/g, '');
    } else if (dotCount > 1 && commaCount === 0) {
      numericText = numericText.replace(/\./g, '');
    } else if (commaCount === 1 && dotCount === 1) {
      numericText = numericText.replace(/\./g, '').replace(',', '.');
    } else {
      numericText = numericText.replace(/,/g, '.');
    }
    const numericValue = Number(numericText);
    if (!Number.isFinite(numericValue)) {
      return null;
    }
    const unit = match[2] ? match[2].toLowerCase() : '';
    let multiplier = 1;
    if (unit.startsWith('g')) {
      multiplier = 1024 * 1024 * 1024;
    } else if (unit.startsWith('m')) {
      multiplier = 1024 * 1024;
    } else if (unit.startsWith('k')) {
      multiplier = 1024;
    }
    return numericValue * multiplier;
  }

  function extractEntryName(entry) {
    if (!entry || typeof entry !== 'object') {
      return '';
    }
    const candidates = [entry.name, entry.displayTitle, entry.title, entry.baseName, entry.slug];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
    return '';
  }

  function resolveEntryTimestamp(entry) {
    if (!entry || typeof entry !== 'object') {
      return 0;
    }
    const direct = Number(entry.createdAtTime);
    if (Number.isFinite(direct)) {
      return direct;
    }
    const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : '';
    const parsed = Date.parse(createdAt);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function resolveEntryFileSize(entry) {
    if (!entry || typeof entry !== 'object') {
      return Number.NEGATIVE_INFINITY;
    }
    const direct = Number(entry.fileSizeBytes);
    if (Number.isFinite(direct)) {
      return direct;
    }
    const legacy = Number(entry.fileSize);
    if (Number.isFinite(legacy)) {
      return legacy;
    }
    const metadata = entry.metadata && typeof entry.metadata === 'object' ? entry.metadata : null;
    if (metadata) {
      const metadataNumeric = Number(metadata.size ?? metadata.fileSize);
      if (Number.isFinite(metadataNumeric)) {
        return metadataNumeric;
      }
      const metadataLabel = typeof metadata.size === 'string'
        ? metadata.size
        : typeof metadata.fileSize === 'string'
          ? metadata.fileSize
          : '';
      const metadataParsed = parseFileSizeLabel(metadataLabel);
      if (metadataParsed !== null) {
        return metadataParsed;
      }
    }
    const parsedLabel = parseFileSizeLabel(entry.fileSizeLabel);
    if (parsedLabel !== null) {
      return parsedLabel;
    }
    return Number.NEGATIVE_INFINITY;
  }

  function normalizeEntryDetails(payload, fallback = {}) {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const normalized = {};
    const slugCandidates = [payload.slug, fallback.slug, payload.svgSlug, payload.baseName];
    for (const candidate of slugCandidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        normalized.slug = candidate.trim();
        break;
      }
    }

    const fieldsToCopy = ['title', 'displayTitle', 'baseName', 'tool', 'createdAt', 'updatedAt', 'svgUrl', 'pngUrl'];
    fieldsToCopy.forEach(key => {
      if (typeof payload[key] === 'string' && payload[key].trim()) {
        normalized[key] = payload[key].trim();
      } else if (typeof fallback[key] === 'string' && fallback[key].trim()) {
        normalized[key] = fallback[key].trim();
      }
    });

    if (!normalized.tool && payload.metadata && typeof payload.metadata.tool === 'string') {
      normalized.tool = payload.metadata.tool.trim();
    }

    const description = typeof payload.description === 'string' ? payload.description.trim() : '';
    if (description) {
      normalized.description = description;
    }

    const altText = typeof payload.altText === 'string' ? payload.altText.trim() : '';
    if (altText) {
      normalized.altText = altText;
    }

    const altTextSource = typeof payload.altTextSource === 'string' ? payload.altTextSource.trim() : '';
    if (altTextSource) {
      normalized.altTextSource = altTextSource;
    }

    if (payload.exampleState !== undefined) {
      normalized.exampleState = payload.exampleState;
    }

    if (payload.metadata && typeof payload.metadata === 'object') {
      normalized.metadata = { ...payload.metadata };
    }

    if (payload.summary !== undefined) {
      if (typeof payload.summary === 'string') {
        normalized.summary = payload.summary.trim();
      } else if (payload.summary && typeof payload.summary === 'object') {
        const summaryCopy = { ...payload.summary };
        if (typeof summaryCopy.altText === 'string') {
          summaryCopy.altText = summaryCopy.altText.trim();
        }
        if (typeof summaryCopy.description === 'string') {
          summaryCopy.description = summaryCopy.description.trim();
        }
        if (typeof summaryCopy.text === 'string') {
          summaryCopy.text = summaryCopy.text.trim();
        }
        if (typeof summaryCopy.altTextSource === 'string') {
          summaryCopy.altTextSource = summaryCopy.altTextSource.trim();
        }
        normalized.summary = summaryCopy;
      }
    }

    return normalized;
  }

  async function fetchEntryDetails(slug, { forceRefresh = false, fallback = {} } = {}) {
    if (typeof slug !== 'string' || !slug.trim()) {
      return null;
    }

    const normalizedSlug = slug.trim();

    if (!forceRefresh && entryDetailsCache.has(normalizedSlug)) {
      return entryDetailsCache.get(normalizedSlug);
    }

    if (!forceRefresh && entryDetailsPending.has(normalizedSlug)) {
      return entryDetailsPending.get(normalizedSlug);
    }

    const pending = (async () => {
      try {
        const apiUrl = buildSvgApiUrl(`?slug=${encodeURIComponent(normalizedSlug)}`);
        if (!apiUrl) {
          throw new Error('Fant ikke adressen til arkivtjenesten.');
        }
        const response = await fetch(apiUrl, {
          headers: { Accept: 'application/json' }
        });
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }
        const payload = await response.json();
        const details = normalizeEntryDetails(payload, fallback) || null;
        if (details) {
          entryDetailsCache.set(normalizedSlug, details);
        }
        return details;
      } finally {
        entryDetailsPending.delete(normalizedSlug);
      }
    })();

    entryDetailsPending.set(normalizedSlug, pending);
    return pending;
  }

  function determineAltTextSource(entry, details) {
    const candidates = [];
    if (details && typeof details.altTextSource === 'string') {
      candidates.push(details.altTextSource);
    }
    if (details && details.summary && typeof details.summary === 'object' && typeof details.summary.altTextSource === 'string') {
      candidates.push(details.summary.altTextSource);
    }
    if (details && details.metadata && typeof details.metadata.altTextSource === 'string') {
      candidates.push(details.metadata.altTextSource);
    }
    if (entry && typeof entry.altTextSource === 'string') {
      candidates.push(entry.altTextSource);
    }
    const resolved = candidates.find(value => typeof value === 'string' && value.trim());
    return resolved && resolved.trim().toLowerCase() === 'manual' ? 'manual' : 'auto';
  }

  function determineAltTextCandidates(entry, details) {
    const candidates = [];
    const append = value => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          candidates.push(trimmed);
        }
      }
    };

    if (details) {
      append(details.altText);
      append(details.autoAltText);
      append(details.description);
      if (typeof details.summary === 'string') {
        append(details.summary);
      }
      if (details.summary && typeof details.summary === 'object') {
        append(details.summary.altText);
        append(details.summary.description);
        append(details.summary.text);
      }
    }

    if (entry) {
      append(entry.altText);
      append(entry.summary);
      append(entry.description);
      if (entry.displayTitle) {
        append(`Figuren «${entry.displayTitle}».`);
      }
    }

    append('SVG-figur.');
    return candidates;
  }

  function determineAutoAltText(entry, details) {
    const candidates = determineAltTextCandidates(entry, details);
    return candidates.length ? candidates[0] : '';
  }

  function computeAltTextSignature(entry, details) {
    const parts = [];
    if (details && typeof details.updatedAt === 'string' && details.updatedAt.trim()) {
      parts.push(details.updatedAt.trim());
    } else if (entry && typeof entry.updatedAt === 'string' && entry.updatedAt.trim()) {
      parts.push(entry.updatedAt.trim());
    }
    if (details && typeof details.summary === 'string') {
      parts.push(details.summary.trim());
    } else if (details && details.summary && typeof details.summary === 'object') {
      try {
        parts.push(JSON.stringify(details.summary));
      } catch (error) {}
    }
    if (details && typeof details.description === 'string' && details.description.trim()) {
      parts.push(details.description.trim());
    }
    if (!parts.length && entry && typeof entry.slug === 'string') {
      parts.push(entry.slug);
    }
    return parts.join('::');
  }

  function ensureAltTextRecord(slug, entry, details) {
    if (typeof slug !== 'string' || !slug.trim()) {
      return null;
    }
    const normalizedSlug = slug.trim();
    const existing = entryAltTextCache.get(normalizedSlug) || null;
    const autoText = determineAutoAltText(entry, details);
    const signature = computeAltTextSignature(entry, details);
    const sourceHint = determineAltTextSource(entry, details);
    const baseText = details && details.altText ? details.altText : entry && entry.altText ? entry.altText : autoText;

    if (!existing) {
      const record = {
        text: typeof baseText === 'string' ? baseText.trim() : '',
        source: sourceHint === 'manual' && baseText ? 'manual' : 'auto',
        autoText,
        signature
      };
      if (!record.text) {
        record.text = autoText;
        record.source = 'auto';
      }
      entryAltTextCache.set(normalizedSlug, record);
      return record;
    }

    existing.autoText = autoText;
    existing.signature = signature;
    if ((existing.source !== 'manual' || !existing.text) && baseText) {
      existing.text = typeof baseText === 'string' ? baseText.trim() : existing.text;
      existing.source = sourceHint === 'manual' && existing.text ? 'manual' : existing.source;
    }
    if (!existing.text) {
      existing.text = autoText;
      existing.source = 'auto';
    }
    entryAltTextCache.set(normalizedSlug, existing);
    return existing;
  }

  function updateAltTextRecord(slug, updater) {
    if (typeof slug !== 'string' || !slug.trim() || typeof updater !== 'function') {
      return null;
    }
    const normalizedSlug = slug.trim();
    const current = entryAltTextCache.get(normalizedSlug) || { text: '', source: 'auto', autoText: '', signature: '' };
    const next = updater({ ...current }) || current;
    entryAltTextCache.set(normalizedSlug, next);
    return next;
  }

  function escapeSelectorValue(value) {
    if (typeof value !== 'string') {
      return '';
    }
    if (typeof CSS !== 'undefined' && CSS && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return value.replace(/(["\\])/g, '\\$1');
  }

  function findCardPreviewImage(slug) {
    if (!grid || typeof slug !== 'string' || !slug.trim()) {
      return null;
    }
    const escaped = escapeSelectorValue(slug.trim());
    if (!escaped) {
      return null;
    }
    const selector = `[data-svg-item="${escaped}"] img`;
    const node = grid.querySelector(selector);
    return node instanceof HTMLImageElement ? node : null;
  }

  function normalizeArchiveEntries(entries) {
    return (Array.isArray(entries) ? entries : [])
      .map(entry => {
        const slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
        const files = entry && typeof entry === 'object' && entry.files ? entry.files : {};
        const urls = entry && typeof entry === 'object' && entry.urls ? entry.urls : {};
        const metadata = entry && typeof entry === 'object' && entry.metadata ? entry.metadata : {};
        const svgFile = files && typeof files === 'object' ? files.svg : null;
        const pngFile = files && typeof files === 'object' ? files.png : null;
        const svgSlug = typeof entry.svgSlug === 'string' && entry.svgSlug.trim()
          ? entry.svgSlug.trim()
          : svgFile && typeof svgFile.slug === 'string' && svgFile.slug.trim()
            ? svgFile.slug.trim()
            : slug ? `${slug}.svg` : '';
        const pngSlug = typeof entry.pngSlug === 'string' && entry.pngSlug.trim()
          ? entry.pngSlug.trim()
          : pngFile && typeof pngFile.slug === 'string' && pngFile.slug.trim()
            ? pngFile.slug.trim()
            : slug ? `${slug}.png` : '';
        const svgUrl = typeof entry.svgUrl === 'string' && entry.svgUrl.trim()
          ? entry.svgUrl.trim()
          : typeof urls.svg === 'string' && urls.svg.trim()
            ? urls.svg.trim()
            : svgFile && typeof svgFile.url === 'string' && svgFile.url.trim()
              ? svgFile.url.trim()
              : svgSlug
                ? (svgSlug.startsWith('/') ? svgSlug : `/${svgSlug}`)
                : slug
                  ? `/svg/${slug}`
                  : '';
        const pngUrl = typeof entry.pngUrl === 'string' && entry.pngUrl.trim()
          ? entry.pngUrl.trim()
          : typeof urls.png === 'string' && urls.png.trim()
            ? urls.png.trim()
            : pngFile && typeof pngFile.url === 'string' && pngFile.url.trim()
              ? pngFile.url.trim()
              : pngSlug
                ? (pngSlug.startsWith('/') ? pngSlug : `/${pngSlug}`)
                : svgUrl;

        const baseName = typeof entry.baseName === 'string' && entry.baseName.trim()
          ? entry.baseName.trim()
          : typeof entry.fileName === 'string' && entry.fileName.trim()
            ? entry.fileName.trim()
            : slug;
        const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
        const altText = typeof entry.altText === 'string' && entry.altText.trim()
          ? entry.altText.trim()
          : summary
            ? summary
            : baseName
              ? `Grafikkfil for ${baseName}`
              : 'SVG-fil';

        const sequenceRaw = entry.sequence ?? entry.sequenceNumber ?? metadata.sequence ?? metadata.index;
        let sequenceNumber = null;
        if (typeof sequenceRaw === 'number' && Number.isFinite(sequenceRaw)) {
          sequenceNumber = sequenceRaw;
        } else if (typeof sequenceRaw === 'string' && sequenceRaw.trim()) {
          const parsedSequence = Number(sequenceRaw.trim());
          if (Number.isFinite(parsedSequence)) {
            sequenceNumber = parsedSequence;
          }
        }
        const sequenceLabel = sequenceNumber !== null ? `#${sequenceNumber}` : '';

        const fileSizeValue = metadata.size ?? metadata.fileSize ?? (svgFile && svgFile.size);
        let fileSizeLabel = '';
        if (typeof fileSizeValue === 'number' && Number.isFinite(fileSizeValue)) {
          const kiloBytes = fileSizeValue / 1024;
          fileSizeLabel = kiloBytes >= 1024
            ? `${(kiloBytes / 1024).toFixed(kiloBytes > 10 * 1024 ? 0 : 1)} MB`
            : `${kiloBytes.toFixed(kiloBytes > 100 ? 0 : 1)} kB`;
        } else if (typeof fileSizeValue === 'string' && fileSizeValue.trim()) {
          fileSizeLabel = fileSizeValue.trim();
        }

        const thumbnailUrl = typeof entry.thumbnailUrl === 'string' && entry.thumbnailUrl.trim()
          ? entry.thumbnailUrl.trim()
          : pngUrl || svgUrl;

        const normalizedSlug = (slug && slug.trim())
          ? slug.trim()
          : baseName
            ? baseName.replace(/\.[^/.]+$/, '')
            : svgSlug
              ? svgSlug.replace(/\.svg$/i, '')
              : '';

        const resolvedSvgUrl = normalizeAssetUrl(svgUrl, 'svg') || (normalizedSlug ? normalizeAssetUrl(`/svg/${normalizedSlug}`, 'svg') : '');
        const resolvedPngUrl = normalizeAssetUrl(pngUrl, 'png') || resolvedSvgUrl;
        const resolvedThumbnailUrl = normalizeAssetUrl(thumbnailUrl, 'png') || resolvedPngUrl || resolvedSvgUrl;

        const entryName = typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : '';
        const createdAtValue =
          typeof entry.createdAt === 'string' && entry.createdAt.trim()
            ? entry.createdAt.trim()
            : typeof entry.updatedAt === 'string'
              ? entry.updatedAt.trim()
              : '';

        const normalizedEntry = {
          slug: normalizedSlug || slug,
          svgSlug,
          pngSlug,
          svgUrl: resolvedSvgUrl,
          pngUrl: resolvedPngUrl,
          thumbnailUrl: resolvedThumbnailUrl,
          title: typeof entry.title === 'string' ? entry.title.trim() : '',
          displayTitle: (typeof entry.title === 'string' && entry.title.trim())
            ? entry.title.trim()
            : baseName || normalizedSlug || 'Uten tittel',
          altText,
          baseName,
          tool: typeof entry.tool === 'string' ? entry.tool.trim() : '',
          createdAt: createdAtValue,
          name: entryName,
          summary,
          sequenceLabel,
          fileSizeLabel
        };

        if (Object.prototype.hasOwnProperty.call(entry, 'exampleState')) {
          normalizedEntry.exampleState = entry.exampleState;
        }

        if (!normalizedEntry.name) {
          normalizedEntry.name = normalizedEntry.displayTitle || normalizedEntry.title || normalizedEntry.baseName || normalizedEntry.slug || '';
        }

        const sizeBytes =
          typeof fileSizeValue === 'number' && Number.isFinite(fileSizeValue)
            ? fileSizeValue
            : parseFileSizeLabel(fileSizeLabel);
        if (Number.isFinite(sizeBytes)) {
          normalizedEntry.fileSizeBytes = sizeBytes;
        }

        normalizedEntry.createdAtTime = Date.parse(createdAtValue) || 0;

        return normalizedEntry;
      })
      .filter(entry => entry.slug && entry.svgUrl);
  }

  function applyArchiveEntries(entries, metadata) {
    allEntries = Array.isArray(entries) ? entries.slice() : [];

    allEntries.forEach(entry => {
      if (!entry || !entry.slug) {
        return;
      }
      const cachedDetails = entryDetailsCache.get(entry.slug) || null;
      ensureAltTextRecord(entry.slug, entry, cachedDetails);
    });

    pruneSelection();
    updateFilterOptions();
    applyStorageNote(metadata);
    render();
  }

  async function loadEntries() {
    const cached = readArchiveCache();
    const hasCachedEntries = Boolean(cached && Array.isArray(cached.entries));
    if (hasCachedEntries) {
      applyArchiveEntries(cached.entries, cached.metadata);
    }

    setBusy(true);
    setStatus(hasCachedEntries ? 'Oppdaterer arkivet …' : 'Laster arkivet …');

    try {
      const apiUrl = buildSvgApiUrl();
      if (!apiUrl) {
        throw new Error('Fant ikke adressen til arkivtjenesten.');
      }
      const response = await fetch(apiUrl, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        let responseDetails = '';
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const payload = await response.json();
            if (payload && typeof payload.error === 'string') {
              responseDetails = payload.error.trim();
            }
          } else {
            const text = await response.text();
            if (text) {
              responseDetails = text.trim();
            }
          }
        } catch (error) {
          responseDetails = '';
        }
        const detailSuffix = responseDetails ? ` (${responseDetails})` : '';
        throw new Error(`Uventet svar: ${response.status}${detailSuffix}`);
      }
      const payload = await response.json();
      const metadata = extractArchiveMetadata(payload);
      const normalizedEntries = normalizeArchiveEntries(payload.entries);
      applyArchiveEntries(normalizedEntries, metadata);
      writeArchiveCache({ entries: allEntries, metadata, timestamp: Date.now() });
    } catch (error) {
      console.error('Kunne ikke laste arkivet', error);
      if (hasCachedEntries) {
        setStatus('Viser hurtigbufret arkiv. Klarte ikke å oppdatere akkurat nå.', 'warning');
      } else {
        const errorMessage = error && typeof error.message === 'string' ? error.message.trim() : '';
        const detailSuffix = errorMessage ? ` (${errorMessage})` : '';
        setStatus(`Klarte ikke å hente arkivet akkurat nå. Prøv igjen senere.${detailSuffix}`, 'error');
        grid.innerHTML = '';
        visibleEntries = [];
        if (selectedSlugs.size) {
          selectedSlugs.clear();
        }
        updateSelectionSummary();
        if (storageNote) {
          storageNote.hidden = true;
          storageNote.textContent = '';
        }
      }
    } finally {
      setBusy(false);
    }
  }

  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      render();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      render();
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      render({ announceSort: true });
    });
  }

  if (renameSelectedButton && renameDialog) {
    renameSelectedButton.addEventListener('click', event => {
      event.preventDefault();
      const entries = getSelectedEntriesOrdered();
      if (!entries.length) {
        return;
      }
      renameDialog.open(entries, { trigger: renameSelectedButton });
    });
  }

  if (selectAllToggle) {
    selectAllToggle.addEventListener('change', () => {
      const slugs = getVisibleSlugs();
      if (!slugs.length) {
        selectAllToggle.checked = false;
        selectAllToggle.indeterminate = false;
        return;
      }
      const shouldSelectAll = Boolean(selectAllToggle.checked);
      if (shouldSelectAll) {
        for (const slug of slugs) {
          const normalized = normalizeSlugValue(slug);
          if (normalized && !selectedSlugs.has(normalized)) {
            selectedSlugs.add(normalized);
            applySelectionStateToCard(normalized, true);
          }
        }
      } else {
        for (const slug of slugs) {
          const normalized = normalizeSlugValue(slug);
          if (normalized && selectedSlugs.delete(normalized)) {
            applySelectionStateToCard(normalized, false);
          }
        }
      }
      selectAllToggle.indeterminate = false;
      updateSelectionSummary();
    });
  }

  loadEntries();

  function openEntryForTrigger(trigger, { focusActions = false } = {}) {
    const card = trigger.closest('.svg-archive__card');
    if (!card) {
      return;
    }

    const slug = card.dataset.slug;
    if (!slug) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      return;
    }

    const entry = allEntries.find(item => item.slug === slug);
    if (!entry) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      return;
    }

    archiveDialog.open(entry, { focusActions, trigger });
  }

  function rememberMainMenuTarget(targetConfig) {
    if (!targetConfig) {
      return false;
    }

    const navHref = typeof targetConfig.navHref === 'string' ? targetConfig.navHref.trim() : '';
    if (!navHref) {
      return false;
    }

    const storage = getLocalStorage();
    if (!storage) {
      return false;
    }

    try {
      storage.setItem('currentPage', navHref);
      return true;
    } catch (error) {
      return false;
    }
  }

  function resolveMainMenuUrl() {
    const absolute = buildToolUrl('index.html');
    if (absolute) {
      return absolute;
    }

    if (typeof window === 'undefined') {
      return 'index.html';
    }

    try {
      return new URL('index.html', window.location.href).toString();
    } catch (error) {
      return 'index.html';
    }
  }

  function getMainMenuOpenUrl(targetConfig) {
    const remembered = rememberMainMenuTarget(targetConfig);
    if (!remembered) {
      return null;
    }
    return resolveMainMenuUrl();
  }

  async function performEntryAction(action, entry, helpers = {}) {
    if (!entry) {
      setStatus('Fant ikke figuren som hører til handlingen.', 'error');
      return;
    }

    try {
      switch (action) {
        case 'open-svg':
        case 'open-png': {
          const isSvg = action === 'open-svg';
          const url = isSvg ? entry.svgUrl : entry.pngUrl;
          if (!url) {
            setStatus(isSvg ? 'Fant ikke SVG-adressen for figuren.' : 'Fant ikke PNG-adressen for figuren.', 'error');
            return;
          }

          const popup = window.open(url, '_blank', 'noopener');
          if (popup) {
            setStatus(isSvg ? 'Åpner SVG i ny fane.' : 'Åpner PNG i ny fane.', 'success');
          } else {
            setStatus('Klarte ikke å åpne figuren. Tillat sprettoppvinduer og prøv igjen.', 'error');
          }
          break;
        }
        case 'edit': {
          const targetConfig = resolveEntryOpenTarget(entry);
          const exampleState = entry.exampleState;
          const hasExampleState = exampleState != null;
          const hasTarget = Boolean(targetConfig && targetConfig.url && targetConfig.storagePath);

          if (!hasTarget || !hasExampleState) {
            setStatus('Figuren kan ikke redigeres i dette verktøyet.', 'error');
            return;
          }

          const slug = entry.slug || entry.svgSlug || entry.baseName || '';
          const title = entry.displayTitle || entry.title || entry.baseName || slug || 'Figur';
          const toolLabel = (entry.tool && entry.tool.trim()) || targetConfig.displayName || 'verktøyet';
          const requestId = generateArchiveRequestId(entry);

          const absoluteTargetUrl = buildToolUrl(targetConfig.url, { entry });

          let openRequest = {
            id: requestId,
            requestId,
            referenceId: requestId,
            slug,
            title,
            tool: entry.tool || targetConfig.displayName,
            storagePath: targetConfig.storagePath,
            canonicalPath: targetConfig.storagePath,
            path: targetConfig.storagePath,
            targetUrl: absoluteTargetUrl || targetConfig.url,
            example: exampleState,
            exampleState,
            summary: entry.summary,
            createdAt: entry.createdAt,
            svgUrl: entry.svgUrl,
            pngUrl: entry.pngUrl,
            source: 'svg-archive'
          };

          let prepared = false;
          let transportMetadata = null;
          try {
            if (window.MathVisExamples && typeof window.MathVisExamples.prepareOpenRequest === 'function') {
              const preparedResult = window.MathVisExamples.prepareOpenRequest(openRequest);
              if (preparedResult && typeof preparedResult === 'object') {
                openRequest = preparedResult;
                transportMetadata = getArchiveOpenRequestTransportMetadata(preparedResult);
                prepared = true;
              } else if (preparedResult === true) {
                transportMetadata = getArchiveOpenRequestTransportMetadata(openRequest);
                prepared = true;
              }
            }
          } catch (error) {
            console.error('Kunne ikke forberede åpning av eksempel via MathVisExamples', error);
          }
          if (!prepared) {
            try {
              const fallbackResult = prepareArchiveOpenRequestFallback(openRequest);
              const fallbackRequest = fallbackResult && fallbackResult.request;
              prepared = !!fallbackRequest;
              if (prepared) {
                openRequest = fallbackRequest || openRequest;
                transportMetadata =
                  (fallbackResult && fallbackResult.transport) ||
                  getArchiveOpenRequestTransportMetadata(fallbackRequest);
              } else {
                try {
                  console.error('Kunne ikke lagre åpningstilstanden for figuren via reserve-løsningen.');
                } catch (_) {}
              }
            } catch (error) {
              console.error('Kunne ikke lagre åpningstilstand for arkivet', error);
            }
          }

          if (!prepared) {
            setStatus('Kunne ikke lagre åpningstilstanden for figuren.', 'error');
            return;
          }

          let targetUrl = absoluteTargetUrl || targetConfig.url;
          let launchedViaMainMenu = false;
          const mainMenuUrl = getMainMenuOpenUrl(targetConfig);
          if (mainMenuUrl) {
            targetUrl = mainMenuUrl;
            launchedViaMainMenu = true;
          }

          const popup = window.open(targetUrl, '_blank', 'noopener');
          if (popup) {
            if (
              transportMetadata &&
              transportMetadata.type === 'window-name' &&
              typeof transportMetadata.payload === 'string' &&
              transportMetadata.payload
            ) {
              try {
                popup.name = transportMetadata.payload;
              } catch (error) {
                console.error('Kunne ikke sette vindusnavn for reserve-transport av eksempeldata.', error);
              }
            }
            const successMessage = launchedViaMainMenu
              ? `Figuren åpnes i ${toolLabel} via hovedmenyen med et midlertidig eksempel.`
              : `Figuren åpnes i ${toolLabel} med et midlertidig eksempel.`;
            setStatus(successMessage, 'success');
          } else {
            setStatus('Klarte ikke å åpne verktøyet. Tillat sprettoppvinduer og prøv igjen.', 'error');
          }
          break;
        }
        case 'download': {
          const preferSvg = Boolean(entry.svgUrl);
          const url = preferSvg ? entry.svgUrl : entry.pngUrl;
          if (!url) {
            setStatus('Fant ikke nedlastingslenken for figuren.', 'error');
            return;
          }

          const link = document.createElement('a');
          link.href = url;
          const fallbackName = `${entry.slug || 'figur'}${preferSvg ? '.svg' : '.png'}`;
          link.download = preferSvg
            ? (entry.svgSlug || `${entry.baseName || entry.slug || 'figur'}.svg`)
            : (entry.pngSlug || `${entry.baseName || entry.slug || 'figur'}.png`);
          if (!link.download) {
            link.download = fallbackName;
          }
          link.rel = 'noopener';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setStatus(preferSvg ? 'Starter nedlasting av SVG.' : 'Starter nedlasting av PNG.', 'success');
          break;
        }
        case 'delete': {
          const confirmed = window.confirm(`Er du sikker på at du vil slette «${entry.displayTitle}»?`);
          if (!confirmed) {
            return;
          }

          let trashDetails = null;
          let trashRecord = null;
          try {
            if (entry.slug) {
              trashDetails = await fetchEntryDetails(entry.slug, { fallback: entry });
            }
          } catch (error) {
            console.warn('Kunne ikke hente detaljer for figuren før sletting.', error);
          }
          try {
            trashRecord = buildTrashRecordFromEntry(entry, trashDetails);
            if (!trashRecord && trashDetails && typeof trashDetails === 'object') {
              trashRecord = buildTrashRecordFromEntry(trashDetails, trashDetails);
            }
            if (!trashRecord) {
              trashRecord = buildTrashRecordFromEntry(entry, null);
            }
          } catch (error) {
            console.error('Kunne ikke forberede arkivering av slettet figur.', error);
            trashRecord = null;
          }

          const apiUrl = buildSvgApiUrl(`?slug=${encodeURIComponent(entry.slug)}`);
          if (!apiUrl) {
            setStatus('Fant ikke adressen til arkivtjenesten.', 'error');
            return;
          }
          const response = await fetch(apiUrl, { method: 'DELETE' });
          if (!response.ok) {
            throw new Error(`Uventet svar: ${response.status}`);
          }

          if (entry.slug) {
            selectedSlugs.delete(entry.slug);
          }
          allEntries = allEntries.filter(item => item.slug !== entry.slug);
          entryDetailsCache.delete(entry.slug);
          entryAltTextCache.delete(entry.slug);
          render();
          setStatus('Figur slettet.', 'success');

          if (trashRecord) {
            await sendTrashRecord(trashRecord, { mode: 'prepend' });
            if (trashViewerInitialized) {
              try {
                await fetchTrashEntries();
              } catch (error) {
                showTrashArchiveWarning(error);
              }
              try {
                renderTrashViewer();
              } catch (error) {
                console.error('Kunne ikke oppdatere visningen for slettede figurer.', error);
              }
            }
          }

          helpers.close?.({ returnFocus: false });
          return;
        }
        default:
          break;
      }
    } catch (error) {
      console.error('Kunne ikke utføre handlingen', error);
      setStatus('Klarte ikke å utføre handlingen. Prøv igjen senere.', 'error');
    }
  }

  grid.addEventListener('click', event => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const checkbox = event.target.closest('input[type="checkbox"][data-select-entry]');
    if (checkbox && grid.contains(checkbox)) {
      return;
    }

    const selectionToggle = event.target.closest('.svg-archive__card-select');
    if (selectionToggle && grid.contains(selectionToggle)) {
      return;
    }

    const previewTrigger = event.target.closest('[data-preview-trigger="true"]');
    if (previewTrigger && grid.contains(previewTrigger)) {
      event.preventDefault();
      openEntryForTrigger(previewTrigger, { focusActions: false });
      return;
    }

    const menuTrigger = event.target.closest('.svg-archive__menu-trigger');
    if (menuTrigger && grid.contains(menuTrigger)) {
      event.preventDefault();
      openEntryForTrigger(menuTrigger, { focusActions: true });
      return;
    }

    const card = event.target.closest('.svg-archive__card');
    if (card && grid.contains(card)) {
      event.preventDefault();
      const slug = card.dataset.slug;
      toggleSelectionForSlug(slug);
    }
  });

  grid.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.matches('input[type="checkbox"][data-select-entry]')) {
      const slug = target.dataset.selectEntry;
      setSelectionForSlug(slug, target.checked);
    }
  });
})();
