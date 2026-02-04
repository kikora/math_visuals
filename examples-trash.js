(function () {
  'use strict';

  const TrashArchiveViewerModule = window.MathVisualsTrashArchiveViewer || null;
  const TrashArchiveViewerClass = TrashArchiveViewerModule ? TrashArchiveViewerModule.TrashArchiveViewer : null;

  const MISSING_API_GUIDANCE =
    'Fant ikke eksempeltjenesten (/api/examples). Sjekk at back-end kjører og at distribusjonen inkluderer serverless-funksjoner.';

  function resolveExamplesApiBase() {
    if (typeof window === 'undefined') return null;
    const productionBase = 'https://mathvisuals.no/api/examples';
    if (window.MATH_VISUALS_EXAMPLES_API_URL) {
      const value = String(window.MATH_VISUALS_EXAMPLES_API_URL).trim();
      if (value) return value;
    }
    const origin = window.location && window.location.origin;
    if (typeof window.location?.hostname === 'string' && /\.vercel\.app$/i.test(window.location.hostname)) {
      return productionBase;
    }
    if (typeof origin === 'string' && /^https?:/i.test(origin)) {
      return '/api/examples';
    }
    return productionBase;
  }

  function buildExamplesApiUrl(base, path) {
    if (!base) return null;
    if (typeof window === 'undefined') {
      if (!path) return base;
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}path=${encodeURIComponent(path)}`;
    }
    try {
      const url = new URL(base, window.location && window.location.href ? window.location.href : undefined);
      if (path) {
        url.searchParams.set('path', path);
      }
      return url.toString();
    } catch (error) {
      if (!path) return base;
      const sep = base.includes('?') ? '&' : '?';
      return `${base}${sep}path=${encodeURIComponent(path)}`;
    }
  }
  function buildTrashApiBase(base) {
    if (!base) return null;
    const trimmed = base.replace(/\/+$/, '');
    return `${trimmed}/trash`;
  }
  function buildTrashApiUrl(base) {
    if (!base) return null;
    if (typeof window === 'undefined') {
      return base;
    }
    try {
      const url = new URL(base, window.location && window.location.href ? window.location.href : undefined);
      return url.toString();
    } catch (error) {
      return base;
    }
  }

  function buildTrashDeleteUrl(base, entryId) {
    if (!base) return null;
    const id = typeof entryId === 'string' ? entryId : '';
    const encodedId = encodeURIComponent(id);
    if (typeof window === 'undefined') {
      const separator = base.includes('?') ? '&' : '?';
      return `${base}${separator}entryId=${encodedId}`;
    }
    try {
      const url = new URL(base, window.location && window.location.href ? window.location.href : undefined);
      url.searchParams.set('entryId', id);
      return url.toString();
    } catch (error) {
      const separator = base.includes('?') ? '&' : '?';
      return `${base}${separator}entryId=${encodedId}`;
    }
  }

  function extractContentType(headers) {
    if (!headers) return null;
    let value = null;
    try {
      if (typeof headers.get === 'function') {
        value = headers.get('content-type') || headers.get('Content-Type');
      }
    } catch (_) {
      value = null;
    }
    if (!value && typeof headers === 'object') {
      try {
        value = headers['content-type'] || headers['Content-Type'] || null;
      } catch (_) {
        value = null;
      }
    }
    return typeof value === 'string' ? value : null;
  }

  function isJsonContentType(value) {
    if (typeof value !== 'string') return false;
    const [first] = value.split(';', 1);
    const normalized = (first || value).trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === 'application/json') return true;
    if (normalized.endsWith('+json')) return true;
    if (/\bjson\b/.test(normalized)) return true;
    return false;
  }

  function responseLooksLikeJson(res) {
    if (!res) return false;
    const header = extractContentType(res.headers);
    return isJsonContentType(header);
  }

  const TRASH_FALLBACK_STORAGE_KEY = 'math_visuals_examples_trash_fallback_v1';
  const FALLBACK_STATUS_MESSAGE =
    'Viser arkiverte eksempler lagret lokalt fordi arkivtjenesten er tom akkurat nå.';
  const FALLBACK_UNAVAILABLE_STATUS_MESSAGE =
    'Viser arkiverte eksempler lagret lokalt fordi arkivtjenesten ikke er tilgjengelig.';
  let localStorageSupport = null;

  function supportsLocalStorage() {
    if (typeof window === 'undefined') return false;
    try {
      if (!window.localStorage) return false;
      const testKey = '__math_visuals_examples_trash_support__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (_) {
      return false;
    }
  }

  function canUseLocalStorage() {
    if (localStorageSupport === null) {
      localStorageSupport = supportsLocalStorage();
    }
    return localStorageSupport;
  }

  function dedupeEntriesById(entries) {
    if (!Array.isArray(entries)) return [];
    const seen = new Set();
    const result = [];
    entries.forEach(entry => {
      if (!entry || typeof entry !== 'object') return;
      const id = typeof entry.id === 'string' ? entry.id : null;
      if (id && seen.has(id)) return;
      if (id) seen.add(id);
      result.push(entry);
    });
    return result;
  }

  function saveFallbackEntries(entries) {
    if (!canUseLocalStorage()) return;
    const sanitized = dedupeEntriesById(entries);
    const payload = {
      entries: sanitized,
      savedAt: new Date().toISOString()
    };
    try {
      window.localStorage.setItem(TRASH_FALLBACK_STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
  }

  function loadFallbackEntries() {
    if (!canUseLocalStorage()) return [];
    let raw = null;
    try {
      raw = window.localStorage.getItem(TRASH_FALLBACK_STORAGE_KEY);
    } catch (_) {
      raw = null;
    }
    if (typeof raw !== 'string' || !raw.trim()) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw);
      const entries = Array.isArray(parsed && parsed.entries) ? parsed.entries : [];
      return dedupeEntriesById(entries);
    } catch (error) {
      try {
        window.localStorage.removeItem(TRASH_FALLBACK_STORAGE_KEY);
      } catch (_) {}
      return [];
    }
  }

  function clearFallbackEntries() {
    if (!canUseLocalStorage()) return;
    try {
      window.localStorage.removeItem(TRASH_FALLBACK_STORAGE_KEY);
    } catch (_) {}
  }

  function extractArchiveMetadata(payload) {
    if (!payload || typeof payload !== 'object') return {};
    const metadata = {};
    if (typeof payload.storage === 'string') metadata.storage = payload.storage;
    if (typeof payload.mode === 'string') metadata.mode = payload.mode;
    if (typeof payload.storageMode === 'string') metadata.storageMode = payload.storageMode;
    if (typeof payload.persistent === 'boolean') metadata.persistent = payload.persistent;
    if (typeof payload.ephemeral === 'boolean') metadata.ephemeral = payload.ephemeral;
    return metadata;
  }

  function normalizeMetadataStorageHint(metadata) {
    if (!metadata || typeof metadata !== 'object') return '';
    const hint = metadata.storageMode || metadata.storage || metadata.mode || '';
    return typeof hint === 'string' ? hint.trim().toLowerCase() : '';
  }

  function isEphemeralArchive(metadata) {
    if (!metadata || typeof metadata !== 'object') return false;
    if (metadata.ephemeral === true) return true;
    if (metadata.persistent === false) return true;
    const storageHint = normalizeMetadataStorageHint(metadata);
    if (storageHint && storageHint !== 'kv') return true;
    return false;
  }

  function normalizePath(value) {
    if (typeof value !== 'string') return '';
    let path = value.trim();
    if (!path) return '';
    if (!path.startsWith('/')) path = '/' + path;
    path = path.replace(/[\\]+/g, '/');
    path = path.replace(/\/+/g, '/');
    path = path.replace(/\/index\.html?$/i, '/');
    if (/\.html?$/i.test(path)) {
      path = path.replace(/\.html?$/i, '');
      if (!path) path = '/';
    }
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path || '/';
  }

  function prettifyPath(path) {
    if (typeof path !== 'string') return 'Ukjent verktøy';
    const trimmed = path.replace(/^\/+/, '');
    if (!trimmed) return 'Ukjent verktøy';
    const decoded = (() => {
      try {
        return decodeURIComponent(trimmed);
      } catch (error) {
        return trimmed;
      }
    })();
    const replaced = decoded.replace(/[-_]+/g, ' ');
    return replaced.replace(/\b\w/g, match => match.toLocaleUpperCase('nb-NO'));
  }

  function formatTimestamp(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) {
      return trimmed;
    }
    try {
      return date.toLocaleString('nb-NO');
    } catch (error) {
      try {
        return date.toLocaleString();
      } catch (error2) {}
    }
    try {
      return date.toISOString();
    } catch (error3) {}
    return trimmed;
  }

  function sanitizeSvgElementTree(element) {
    if (!element || typeof element.tagName !== 'string') return;
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'script' || tagName === 'foreignobject') {
      element.remove();
      return;
    }
    if (element.attributes) {
      for (let i = element.attributes.length - 1; i >= 0; i--) {
        const attr = element.attributes[i];
        if (!attr || typeof attr.name !== 'string') continue;
        const name = attr.name;
        if (/^on/i.test(name)) {
          element.removeAttribute(name);
          continue;
        }
        const value = typeof attr.value === 'string' ? attr.value : '';
        if ((name === 'href' || name === 'xlink:href') && /^(\s*javascript:|\s*data:(?!image\/(?:svg\+xml|png|jpeg|gif)))/i.test(value)) {
          element.removeAttribute(name);
          continue;
        }
        if (name === 'style' && (/(expression\s*\()/i.test(value) || /url\(\s*['"]?javascript:/i.test(value))) {
          element.removeAttribute(name);
        }
      }
    }
    const children = element.children ? Array.from(element.children) : [];
    children.forEach(child => sanitizeSvgElementTree(child));
  }

  function createSvgPreviewNode(svgMarkup) {
    if (typeof document === 'undefined') return null;
    if (typeof svgMarkup !== 'string') return null;
    const trimmed = svgMarkup.trim();
    if (!trimmed) return null;
    let svgElement = null;
    if (typeof DOMParser === 'function') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(trimmed, 'image/svg+xml');
        const hasParserError = doc && doc.getElementsByTagName('parsererror').length > 0;
        if (!hasParserError && doc && doc.documentElement && doc.documentElement.tagName && doc.documentElement.tagName.toLowerCase() === 'svg') {
          svgElement = document.importNode(doc.documentElement, true);
        }
      } catch (error) {
        svgElement = null;
      }
    }
    if (!svgElement) {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = trimmed;
      const candidate = wrapper.querySelector('svg');
      if (candidate) {
        svgElement = candidate.cloneNode(true);
      }
    }
    if (!svgElement) return null;
    sanitizeSvgElementTree(svgElement);
    return svgElement;
  }

  function resolvePreviewWrapper(container) {
    if (!container || typeof container.closest !== 'function') {
      return null;
    }
    const wrapper = container.closest('[data-preview-inner]');
    return wrapper instanceof HTMLElement ? wrapper : null;
  }

  function setPreviewKind(container, kind) {
    const wrapper = resolvePreviewWrapper(container);
    if (!wrapper) return;
    if (typeof kind === 'string' && kind.trim()) {
      wrapper.setAttribute('data-preview-kind', kind.trim());
    } else {
      wrapper.removeAttribute('data-preview-kind');
    }
  }

  function resolveThumbnailSource(example) {
    if (!example || typeof example !== 'object') return '';
    const raw = example.thumbnail;
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim();
    }
    if (raw && typeof raw === 'object') {
      const candidates = ['data', 'dataUrl', 'url', 'src', 'href'];
      for (let i = 0; i < candidates.length; i++) {
        const key = candidates[i];
        const value = raw[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }
    return '';
  }

  function renderExamplePreview(container, example) {
    if (!container) return false;
    container.innerHTML = '';
    setPreviewKind(container, null);
    if (!example || typeof example !== 'object') {
      return false;
    }

    const thumbnailSource = resolveThumbnailSource(example);
    if (thumbnailSource && /^data:image\//i.test(thumbnailSource)) {
      const img = document.createElement('img');
      img.decoding = 'async';
      img.loading = 'lazy';
      img.src = thumbnailSource;
      const altText =
        typeof example.title === 'string' && example.title.trim()
          ? example.title.trim()
          : typeof example.description === 'string' && example.description.trim()
            ? example.description.trim().slice(0, 120)
            : 'Forhåndsvisning av eksempel';
      img.alt = altText;
      img.setAttribute('draggable', 'false');
      container.appendChild(img);
      setPreviewKind(container, 'image');
      return true;
    }

    const svgMarkup = typeof example.svg === 'string' ? example.svg : '';
    if (!svgMarkup || !svgMarkup.trim()) {
      return false;
    }
    const svgElement = createSvgPreviewNode(svgMarkup);
    if (!svgElement) {
      return false;
    }
    container.appendChild(svgElement);
    setPreviewKind(container, 'svg');
    return true;
  }

  const apiBase = resolveExamplesApiBase();
  const trashApiBase = apiBase ? buildTrashApiBase(apiBase) : null;
  const groupsContainer = typeof document !== 'undefined' ? document.querySelector('[data-trash-groups]') : null;
  const statusElement = typeof document !== 'undefined' ? document.querySelector('[data-status]') : null;
  const refreshButton = typeof document !== 'undefined' ? document.querySelector('[data-refresh]') : null;
  const filterSelect = typeof document !== 'undefined' ? document.querySelector('[data-filter]') : null;
  const groupTemplate = typeof document !== 'undefined' ? document.getElementById('trash-group-template') : null;
  const itemTemplate = typeof document !== 'undefined' ? document.getElementById('trash-item-template') : null;

  let emptyTemplate = null;
  if (groupsContainer) {
    const existingEmpty = groupsContainer.querySelector('[data-empty]');
    if (existingEmpty) {
      emptyTemplate = existingEmpty.cloneNode(true);
      emptyTemplate.removeAttribute('data-empty');
      existingEmpty.remove();
    }
  }

  const state = {
    groups: [],
    groupsMap: new Map(),
    filter: 'all',
    metadata: null,
    lastFetchUsedFallback: false
  };

  let trashViewer = null;

  function updateGroups(groups) {
    const list = Array.isArray(groups) ? groups : [];
    state.groups = list;
    state.groupsMap = new Map();
    list.forEach(group => {
      if (!group || typeof group.path !== 'string') return;
      state.groupsMap.set(group.path, group);
    });
  }

  function setStatus(message, type) {
    if (!statusElement) return;
    if (!message) {
      statusElement.textContent = '';
      statusElement.removeAttribute('data-status-type');
      return;
    }
    statusElement.textContent = message;
    if (type) {
      statusElement.dataset.statusType = type;
    } else {
      statusElement.removeAttribute('data-status-type');
    }
  }

  async function fetchEntriesFromBackend() {
    if (!trashApiBase) {
      throw new Error('Fant ikke arkivtjenesten. Sørg for at back-end kjører.');
    }
    const url = buildTrashApiUrl(trashApiBase);
    if (!url) {
      throw new Error('Kunne ikke finne adressen til arkivet.');
    }
    let response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (error) {
      throw new Error('Kunne ikke kontakte arkivtjenesten.');
    }
    if (!responseLooksLikeJson(response)) {
      const suffix = Number.isFinite(response && response.status) ? ` (status ${response.status})` : '';
      throw new Error(`${MISSING_API_GUIDANCE}${suffix}`);
    }
    if (!response.ok) {
      if (response.status === 404) {
        const suffix = Number.isFinite(response.status) ? ` (status ${response.status})` : '';
        throw new Error(`${MISSING_API_GUIDANCE}${suffix}`);
      }
      throw new Error(`Serveren svarte med ${response.status}.`);
    }
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      throw new Error('Kunne ikke tolke svaret fra serveren.');
    }
    const metadata = extractArchiveMetadata(payload);
    const entries = Array.isArray(payload && payload.entries) ? payload.entries : [];
    const cleanedEntries = dedupeEntriesById(entries);
    const archiveIsEphemeral = isEphemeralArchive(metadata);
    if (archiveIsEphemeral) {
      if (cleanedEntries.length) {
        saveFallbackEntries(cleanedEntries);
      }
    } else {
      clearFallbackEntries();
    }
    if (archiveIsEphemeral && cleanedEntries.length === 0) {
      const fallbackEntries = loadFallbackEntries();
      if (fallbackEntries.length) {
        const fallbackGroups = trashViewer ? trashViewer.buildGroupsFromItems(fallbackEntries) : [];
        updateGroups(fallbackGroups);
        state.metadata = metadata;
        state.lastFetchUsedFallback = true;
        return { metadata, entries: fallbackEntries, usedFallback: true };
      }
    }
    const groups = trashViewer ? trashViewer.buildGroupsFromItems(cleanedEntries) : [];
    updateGroups(groups);
    state.metadata = metadata;
    state.lastFetchUsedFallback = false;
    return { metadata, entries: cleanedEntries, usedFallback: false };
  }

  function buildFilterOptions() {
    if (!filterSelect) return;
    const selected = state.filter || 'all';
    const options = Array.from(filterSelect.querySelectorAll('option'));
    const existingValues = new Set();
    options.forEach(option => {
      const value = option.value || '';
      existingValues.add(value);
    });
    const desiredValues = new Set(['all']);
    const groups = Array.isArray(state.groups) ? state.groups : [];
    groups.forEach(group => {
      if (!group || typeof group.path !== 'string') return;
      desiredValues.add(group.path);
      if (!existingValues.has(group.path)) {
        const option = document.createElement('option');
        option.value = group.path;
        option.textContent = prettifyPath(group.path);
        filterSelect.appendChild(option);
      }
    });
    options.forEach(option => {
      const value = option.value || '';
      if (!desiredValues.has(value)) {
        option.remove();
      }
    });
    if (desiredValues.has(selected)) {
      filterSelect.value = selected;
    } else {
      filterSelect.value = 'all';
      state.filter = 'all';
    }
  }

  function getFilteredGroups() {
    const filterValue = state.filter || 'all';
    const groups = Array.isArray(state.groups) ? state.groups : [];
    if (filterValue === 'all') {
      return groups;
    }
    return groups.filter(group => group && group.path === filterValue);
  }

  function buildGroupNode(entry) {
    let groupNode = null;
    if (groupTemplate && groupTemplate.content) {
      groupNode = groupTemplate.content.cloneNode(true);
    }
    if (!groupNode) {
      groupNode = document.createDocumentFragment();
      const section = document.createElement('section');
      section.className = 'trash-group';
      section.dataset.group = '';
      section.innerHTML = `
        <header class="trash-group__header">
          <h2 class="trash-group__title" data-group-title></h2>
          <span class="trash-group__meta" data-group-meta></span>
        </header>
        <ul class="trash-item-list" data-group-list></ul>
      `;
      groupNode.appendChild(section);
    }
    const section = groupNode.querySelector('[data-group]');
    const titleEl = groupNode.querySelector('[data-group-title]');
    const metaEl = groupNode.querySelector('[data-group-meta]');
    const listEl = groupNode.querySelector('[data-group-list]');
    if (section) {
      section.dataset.path = entry.path;
    }
    if (titleEl) {
      titleEl.textContent = prettifyPath(entry.path);
    }
    if (metaEl) {
      const count = Array.isArray(entry.items) ? entry.items.length : 0;
      const countLabel = count === 1 ? '1 arkivert eksempel' : `${count} arkiverte eksempler`;
      metaEl.textContent = countLabel;
      const timestamp = formatTimestamp(entry.latestDeletedAt);
      if (timestamp) {
        metaEl.appendChild(document.createTextNode(` · Sist arkivert ${timestamp}`));
      }
      const href = resolveGroupHref(entry);
      if (href) {
        const link = document.createElement('a');
        link.href = href;
        link.textContent = 'Åpne verktøy';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        metaEl.appendChild(document.createTextNode(' · '));
        metaEl.appendChild(link);
      }
    }
    if (listEl) {
      listEl.innerHTML = '';
      entry.items.forEach((itemData, index) => {
        let itemNode = null;
        if (itemTemplate && itemTemplate.content) {
          itemNode = itemTemplate.content.cloneNode(true);
        }
        if (!itemNode) {
          itemNode = document.createDocumentFragment();
          const li = document.createElement('li');
          li.className = 'trash-item';
          li.dataset.item = '';
          li.innerHTML = `
            <div class="trash-item__content">
              <div class="trash-item__header">
                <h3 class="trash-item__title" data-item-title></h3>
                <span class="trash-item__timestamp" data-item-timestamp></span>
              </div>
              <div class="trash-item__meta" data-item-meta></div>
              <p class="trash-item__description" data-item-description hidden></p>
              <div class="trash-item__actions">
                <button type="button" class="trash-button trash-button--restore" data-action="restore">Gjenopprett</button>
                <button type="button" class="trash-button trash-button--open" data-action="open">Åpne eksempel</button>
                <button type="button" class="trash-button trash-button--delete" data-action="delete">Slett</button>
              </div>
            </div>
            <div class="trash-item__preview" data-item-preview hidden>
              <div class="trash-item__preview-inner" data-preview-inner>
                <div class="trash-item__preview-content" data-item-preview-content></div>
              </div>
            </div>
          `;
          itemNode.appendChild(li);
        }
        const item = itemNode.querySelector('[data-item]');
        const title = itemNode.querySelector('[data-item-title]');
        const timestampEl = itemNode.querySelector('[data-item-timestamp]');
        const meta = itemNode.querySelector('[data-item-meta]');
        const description = itemNode.querySelector('[data-item-description]');
        const preview = itemNode.querySelector('[data-item-preview]');
        const previewContent = itemNode.querySelector('[data-item-preview-content]');
        const restoreButton = itemNode.querySelector('[data-action="restore"]');
        const openButton = itemNode.querySelector('[data-action="open"]');
        const deleteButton = itemNode.querySelector('[data-action="delete"]');
        if (item) {
          item.dataset.index = String(index);
          if (itemData && itemData.id) {
            item.dataset.id = itemData.id;
          }
        }
        const exampleForTitle = itemData && itemData.example && typeof itemData.example === 'object'
          ? itemData.example
          : null;
        const exampleTitle =
          exampleForTitle && typeof exampleForTitle.title === 'string' && exampleForTitle.title.trim()
            ? exampleForTitle.title.trim()
            : '';
        const exampleDescriptionForTitle =
          exampleForTitle && typeof exampleForTitle.description === 'string'
            ? exampleForTitle.description.trim()
            : '';
        const titleText = typeof itemData.label === 'string' && itemData.label.trim()
          ? itemData.label.trim()
          : exampleTitle
            ? exampleTitle
            : exampleDescriptionForTitle
              ? exampleDescriptionForTitle.slice(0, 120)
              : `Eksempel ${index + 1}`;
        if (title) {
          title.textContent = titleText;
        }
        if (timestampEl) {
          timestampEl.textContent = itemData.deletedAt
            ? `Slettet ${formatTimestamp(itemData.deletedAt)}`
            : '';
        }
        if (meta) {
          meta.innerHTML = '';
          const parts = [];
          if (itemData.example && itemData.example.exampleNumber) {
            parts.push(`Eksempelnummer: ${itemData.example.exampleNumber}`);
          }
          if (itemData.example && itemData.example.__builtinKey) {
            parts.push(`Innebygd nøkkel: ${itemData.example.__builtinKey}`);
          }
          if (itemData.reason && itemData.reason !== 'delete') {
            parts.push(`Årsak: ${itemData.reason}`);
          }
          if (itemData.importedFromHistory) {
            parts.push('Importert fra historikk');
          }
          if (parts.length) {
            meta.appendChild(document.createTextNode(parts.join(' · ')));
          }
        }
        if (description) {
          const exampleForDescription = itemData && itemData.example && typeof itemData.example === 'object'
            ? itemData.example
            : null;
          const text =
            exampleForDescription && typeof exampleForDescription.description === 'string'
              ? exampleForDescription.description.trim()
              : '';
          if (text) {
            description.hidden = false;
            description.textContent = text;
          } else {
            description.hidden = true;
            description.textContent = '';
          }
        }
        let previewRendered = false;
        if (previewContent) {
          previewRendered = renderExamplePreview(previewContent, itemData.example);
        }
        if (preview) {
          preview.hidden = !previewRendered;
        }
        if (item) {
          if (previewRendered) {
            item.classList.add('trash-item--has-preview');
          } else {
            item.classList.remove('trash-item--has-preview');
          }
        }
        if (restoreButton) {
          restoreButton.dataset.index = String(index);
          restoreButton.dataset.action = 'restore';
          if (itemData && itemData.id) {
            restoreButton.dataset.id = itemData.id;
          }
        }
        if (openButton) {
          openButton.dataset.index = String(index);
          openButton.dataset.action = 'open';
          if (itemData && itemData.id) {
            openButton.dataset.id = itemData.id;
          }
          openButton.textContent = 'Åpne eksempel';
        }
        if (deleteButton) {
          deleteButton.dataset.index = String(index);
          if (itemData && itemData.id) {
            deleteButton.dataset.id = itemData.id;
          }
          deleteButton.textContent = 'Slett';
        }
        listEl.appendChild(itemNode);
      });
    }
    return groupNode;
  }

  function renderEntries() {
    if (!groupsContainer) return;
    groupsContainer.innerHTML = '';
    const groups = getFilteredGroups();
    if (!groups.length) {
      if (emptyTemplate) {
        groupsContainer.appendChild(emptyTemplate.cloneNode(true));
      }
      return;
    }
    groups.forEach(entry => {
      const node = buildGroupNode(entry);
      if (node) {
        groupsContainer.appendChild(node);
      }
    });
  }

  function resolveItemHref(group, item) {
    if (!item) return null;
    const raw = typeof item.sourceHref === 'string' && item.sourceHref.trim()
      ? item.sourceHref.trim()
      : group && typeof group.path === 'string'
        ? group.path
        : item.sourcePath || '';
    if (!raw) return null;
    if (/\.html?(?:[?#]|$)/i.test(raw)) {
      return raw;
    }
    return `${raw}.html`;
  }

  function resolveGroupHref(group) {
    if (!group) return null;
    if (Array.isArray(group.items) && group.items.length) {
      const candidate = resolveItemHref(group, group.items[0]);
      if (candidate) {
        return candidate;
      }
    }
    if (typeof group.path === 'string' && group.path) {
      return group.path.endsWith('.html') ? group.path : `${group.path}.html`;
    }
    return null;
  }

  function openExample(path, id) {
    if (typeof window === 'undefined') return;
    if (typeof path !== 'string') return;
    const group = state.groupsMap.get(path);
    if (!group || !Array.isArray(group.items)) return;
    const item = group.items.find(entry => entry && entry.id === id);
    if (!item) return;
    const href = resolveItemHref(group, item);
    if (!href) return;
    const index = Number.isInteger(item.removedAtIndex) ? item.removedAtIndex : 0;
    try {
      const url = new URL(href, window.location && window.location.href ? window.location.href : undefined);
      if (Number.isInteger(index)) {
        url.searchParams.set('example', String(index + 1));
      }
      window.open(url.toString(), '_blank', 'noopener');
    } catch (error) {
      const base = href.includes('?') ? '&' : '?';
      const suffix = Number.isInteger(index) ? `${base}example=${index + 1}` : '';
      window.open(`${href}${suffix}`, '_blank', 'noopener');
    }
  }

  function notifyParentAboutRestore(path, item) {
    if (typeof window === 'undefined') return;
    if (!window.parent || window.parent === window) return;
    const payload = {
      type: 'examples-trash:restored',
      path,
      id: item && item.id ? item.id : null
    };
    try {
      window.parent.postMessage(payload, '*');
    } catch (_) {}
  }

  async function refreshEntries() {
    setStatus('Laster arkivet med slettede (arkiverte) eksempler …', 'info');
    try {
      const result = await fetchEntriesFromBackend();
      buildFilterOptions();
      renderEntries();
      if (result && result.usedFallback) {
        setStatus(FALLBACK_STATUS_MESSAGE, 'info');
      } else {
        setStatus('', '');
      }
    } catch (error) {
      const fallbackEntries = loadFallbackEntries();
      state.lastFetchUsedFallback = false;
      if (fallbackEntries.length) {
        const fallbackGroups = trashViewer ? trashViewer.buildGroupsFromItems(fallbackEntries) : [];
        updateGroups(fallbackGroups);
        state.lastFetchUsedFallback = true;
        buildFilterOptions();
        renderEntries();
        setStatus(FALLBACK_UNAVAILABLE_STATUS_MESSAGE, 'warning');
        return;
      }
      updateGroups([]);
      renderEntries();
      setStatus(
        error && error.message ? error.message : 'Kunne ikke hente de slettede (arkiverte) eksemplene.',
        'error'
      );
    }
  }

  function init() {
    if (!groupsContainer) return;
    if (!TrashArchiveViewerClass) {
      if (typeof window !== 'undefined') {
        const target = 'svg-arkiv.html?view=trash';
        try {
          window.location.href = target;
        } catch (error) {
          try {
            window.location.assign(target);
          } catch (_) {}
        }
      }
      return;
    }

    trashViewer = new TrashArchiveViewerClass({
      apiBase,
      trashApiBase,
      state,
      updateGroups,
      buildFilterOptions,
      renderEntries,
      setStatus,
      openExample,
      onFetchEntries: fetchEntriesFromBackend,
      notifyParent: notifyParentAboutRestore,
      messages: {
        fallbackStatus: FALLBACK_STATUS_MESSAGE,
        restoreFallbackStatus: FALLBACK_STATUS_MESSAGE,
        restoreInProgress:
          'Gjenoppretter det arkiverte eksempelet slik at det blir tilgjengelig igjen …',
        restoreSuccess: 'Eksempel gjenopprettet fra arkivet.',
        restoreError: 'Kunne ikke gjenopprette det arkiverte eksempelet.',
        deleteCancelled: 'Sletting avbrutt. Elementet ligger fortsatt i arkivet over slettede eksempler.',
        deleteError: 'Kunne ikke slette det arkiverte eksempelet permanent.',
        deleteSuccess: ''
      }
    });

    if (refreshButton) {
      refreshButton.addEventListener('click', () => {
        refreshEntries().catch(() => {});
      });
    }
    if (filterSelect) {
      filterSelect.addEventListener('change', trashViewer.handleFilterChange);
    }
    groupsContainer.addEventListener('click', trashViewer.handleAction);
    refreshEntries().catch(() => {});
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
})();
