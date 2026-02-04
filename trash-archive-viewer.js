(function () {
  'use strict';

  const DEFAULT_MESSAGES = {
    restoreInProgress: 'Gjenoppretter det arkiverte elementet slik at det blir tilgjengelig igjen …',
    restoreSuccess: 'Element gjenopprettet fra arkivet.',
    restoreError: 'Kunne ikke gjenopprette det arkiverte elementet.',
    deleteCancelled: 'Sletting avbrutt. Elementet ligger fortsatt i arkivet over slettede elementer.',
    deleteSuccess: '',
    deleteError: 'Kunne ikke slette det arkiverte elementet permanent.',
    fallbackStatus: '',
    restoreFallbackStatus: ''
  };

  class TrashArchiveViewer {
    constructor(options = {}) {
      this.state = options.state || {
        groups: [],
        groupsMap: new Map(),
        filter: 'all',
        metadata: null,
        lastFetchUsedFallback: false
      };
      this.apiBase = typeof options.apiBase === 'string' ? options.apiBase : TrashArchiveViewer.resolveExamplesApiBase();
      this.trashApiBase = typeof options.trashApiBase === 'string'
        ? options.trashApiBase
        : TrashArchiveViewer.buildTrashApiBase(this.apiBase);
      this.updateGroups = typeof options.updateGroups === 'function' ? options.updateGroups : () => {};
      this.buildFilterOptions = typeof options.buildFilterOptions === 'function' ? options.buildFilterOptions : () => {};
      this.renderEntries = typeof options.renderEntries === 'function' ? options.renderEntries : () => {};
      this.setStatus = typeof options.setStatus === 'function' ? options.setStatus : () => {};
      this.openExample = typeof options.openExample === 'function' ? options.openExample : () => {};
      this.onFetchEntries = typeof options.onFetchEntries === 'function' ? options.onFetchEntries : null;
      this.notifyParent = typeof options.notifyParent === 'function' ? options.notifyParent : () => {};
      const providedMessages = options.messages && typeof options.messages === 'object' ? options.messages : {};
      this.messages = { ...DEFAULT_MESSAGES, ...providedMessages };

      this.handleFilterChange = this.handleFilterChange.bind(this);
      this.handleAction = this.handleAction.bind(this);
    }

    static resolveExamplesApiBase() {
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

    static buildExamplesApiUrl(base, path) {
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

    static buildTrashApiBase(base) {
      if (!base) return null;
      const trimmed = base.replace(/\/+$/, '');
      return `${trimmed}/trash`;
    }

    static buildTrashApiUrl(base) {
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

    static buildTrashDeleteUrl(base, entryId) {
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

    static extractMetadata(payload) {
      if (!payload || typeof payload !== 'object') return null;
      const metadata = {};
      const knownKeys = ['storage', 'mode', 'storageMode', 'persistent', 'ephemeral', 'limitation'];
      knownKeys.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(payload, key)) {
          metadata[key] = payload[key];
        }
      });
      if (payload.fallback === true) {
        metadata.fallback = true;
      }
      if (typeof payload.fallbackReason === 'string' && payload.fallbackReason) {
        metadata.fallbackReason = payload.fallbackReason;
      }
      if (typeof payload.fallbackSource === 'string' && payload.fallbackSource) {
        metadata.fallbackSource = payload.fallbackSource;
      }
      if (payload.fallbackDetails && typeof payload.fallbackDetails === 'object') {
        metadata.fallbackDetails = payload.fallbackDetails;
      }
      if (typeof payload.storageResult === 'string' && payload.storageResult) {
        metadata.storageResult = payload.storageResult;
      }
      return Object.keys(metadata).length ? metadata : null;
    }

    static extractContentType(headers) {
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

    static isJsonContentType(value) {
      if (typeof value !== 'string') return false;
      const [first] = value.split(';', 1);
      const normalized = (first || value).trim().toLowerCase();
      if (!normalized) return false;
      if (normalized === 'application/json') return true;
      if (normalized.endsWith('+json')) return true;
      if (/\bjson\b/.test(normalized)) return true;
      return false;
    }

    static responseLooksLikeJson(res) {
      if (!res) return false;
      const header = TrashArchiveViewer.extractContentType(res.headers);
      return TrashArchiveViewer.isJsonContentType(header);
    }

    static normalizePath(value) {
      if (typeof value !== 'string') return '';
      let path = value.trim();
      if (!path) return '';
      if (!path.startsWith('/')) path = '/' + path;
      path = path.split('\\').join('/');
      path = path.replace(/\/{2,}/g, '/');
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

    normalizeTrashItem(payload) {
      if (!payload || typeof payload !== 'object') return null;
      const id = typeof payload.id === 'string' && payload.id.trim() ? payload.id.trim() : null;
      if (!id) return null;
      const example = payload.example && typeof payload.example === 'object' ? payload.example : null;
      if (!example) return null;
      const deletedAt = typeof payload.deletedAt === 'string' ? payload.deletedAt : '';
      const rawPath = typeof payload.sourcePathRaw === 'string' ? payload.sourcePathRaw.trim() : '';
      const normalizedSource = typeof payload.sourcePath === 'string' && payload.sourcePath.trim()
        ? TrashArchiveViewer.normalizePath(payload.sourcePath)
        : rawPath
          ? TrashArchiveViewer.normalizePath(rawPath)
          : null;
      const sourceHref = typeof payload.sourceHref === 'string' ? payload.sourceHref.trim() : '';
      const sourceTitle = typeof payload.sourceTitle === 'string' ? payload.sourceTitle : '';
      const reason = typeof payload.reason === 'string' ? payload.reason : 'delete';
      const removedAtIndex = Number.isInteger(payload.removedAtIndex) ? payload.removedAtIndex : null;
      const label = typeof payload.label === 'string' ? payload.label : '';
      const importedFromHistory = payload.importedFromHistory === true;
      const sourceArchived = payload.sourceArchived === true;
      const sourceActive = payload.sourceActive === true;
      return {
        id,
        example,
        deletedAt,
        sourcePath: normalizedSource,
        sourcePathRaw: rawPath || null,
        sourceHref: sourceHref || null,
        sourceTitle,
        reason,
        removedAtIndex,
        label,
        importedFromHistory,
        sourceArchived,
        sourceActive
      };
    }

    buildGroupsFromItems(items) {
      const groupsMap = new Map();
      if (Array.isArray(items)) {
        items.forEach(item => {
          const normalized = this.normalizeTrashItem(item);
          if (!normalized) return;
          let path = normalized.sourcePath;
          if (!path) {
            const fallback = normalized.sourcePathRaw || normalized.sourceHref || '';
            path = fallback ? TrashArchiveViewer.normalizePath(fallback) : '';
          }
          if (!path) return;
          if (!groupsMap.has(path)) {
            groupsMap.set(path, {
              path,
              sourceTitle: normalized.sourceTitle,
              items: []
            });
          }
          groupsMap.get(path).items.push({ ...normalized, path });
        });
      }
      const groups = Array.from(groupsMap.values());
      groups.forEach(group => {
        group.items.sort((a, b) => {
          const timeA = Date.parse(b.deletedAt || '') || 0;
          const timeB = Date.parse(a.deletedAt || '') || 0;
          return timeA - timeB;
        });
        group.count = group.items.length;
        group.latestDeletedAt = group.items.length ? group.items[0].deletedAt : null;
      });
      groups.sort((a, b) => a.path.localeCompare(b.path, 'nb'));
      return groups;
    }

    updateGroupsWithItems(items) {
      const groups = this.buildGroupsFromItems(items);
      this.updateGroups(groups);
      return groups;
    }

    applyEntriesResult(result = {}) {
      const entries = Array.isArray(result.entries) ? result.entries : [];
      const metadata = result && typeof result.metadata === 'object' ? result.metadata : null;
      const groups = this.updateGroupsWithItems(entries);
      let normalizedMetadata = null;
      if (metadata && typeof metadata === 'object') {
        try {
          normalizedMetadata = JSON.parse(JSON.stringify(metadata));
        } catch (error) {
          normalizedMetadata = { ...metadata };
        }
      }
      this.state.metadata = normalizedMetadata;
      this.state.lastFetchUsedFallback = result && result.usedFallback === true;
      return { groups, metadata: normalizedMetadata };
    }

    async deleteExample(id, options = {}) {
      if (!this.trashApiBase) {
        throw new Error('Arkivtjenesten er ikke konfigurert.');
      }
      const entryId = typeof id === 'string' ? id.trim() : '';
      if (!entryId) {
        return { cancelled: false, removed: false };
      }

      const skipConfirm = options && options.skipConfirm === true;
      if (!skipConfirm && typeof window !== 'undefined' && typeof window.confirm === 'function') {
        const confirmed = window.confirm(
          'Er du sikker på at du vil slette dette elementet permanent? Denne handlingen kan ikke angres.'
        );
        if (!confirmed) {
          return { cancelled: true, removed: false };
        }
      }

      const url = TrashArchiveViewer.buildTrashDeleteUrl(
        TrashArchiveViewer.buildTrashApiUrl(this.trashApiBase),
        entryId
      );
      if (!url) {
        throw new Error('Kunne ikke bygge URL for permanent sletting.');
      }

      let response;
      try {
        response = await fetch(url, { method: 'DELETE', headers: { Accept: 'application/json' } });
      } catch (error) {
        throw new Error('Kunne ikke kontakte arkivtjenesten for sletting.');
      }

      if (!response.ok) {
        throw new Error(`Serveren avviste sletting (${response.status}).`);
      }

      let removed = true;
      try {
        const text = await response.text();
        if (text) {
          const payload = JSON.parse(text);
          if (payload && typeof payload === 'object' && typeof payload.removed === 'number') {
            removed = payload.removed > 0;
          }
        }
      } catch (error) {
        removed = true;
      }

      return { cancelled: false, removed };
    }

    async fetchExamplesEntry(path) {
      const base = this.apiBase;
      if (!base) {
        throw new Error('Fant ikke eksempeltjenesten.');
      }
      const url = TrashArchiveViewer.buildExamplesApiUrl(base, path);
      if (!url) {
        throw new Error('Kunne ikke finne adressen til eksempeltjenesten.');
      }
      let response;
      try {
        response = await fetch(url, { headers: { Accept: 'application/json' } });
      } catch (error) {
        throw new Error('Kunne ikke hente eksemplene fra serveren.');
      }
      if (response && response.status === 404) {
        return { path, examples: [], deletedProvided: [] };
      }
      if (!TrashArchiveViewer.responseLooksLikeJson(response)) {
        throw new Error('Kunne ikke tolke svaret fra serveren.');
      }
      if (!response.ok) {
        throw new Error(`Serveren svarte med ${response.status}.`);
      }
      try {
        return await response.json();
      } catch (error) {
        throw new Error('Kunne ikke tolke svaret fra serveren.');
      }
    }

    async putExamplesEntry(path, payload) {
      const base = this.apiBase;
      if (!base) {
        throw new Error('Fant ikke eksempeltjenesten.');
      }
      const url = TrashArchiveViewer.buildExamplesApiUrl(base, path);
      if (!url) {
        throw new Error('Kunne ikke finne adressen til eksempeltjenesten.');
      }
      const normalizedExamples = Array.isArray(payload && payload.examples) ? payload.examples : [];
      const normalizedDeletedProvided = Array.isArray(payload && payload.deletedProvided)
        ? payload.deletedProvided
        : [];
      let response;
      try {
        response = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            path,
            examples: normalizedExamples,
            deletedProvided: normalizedDeletedProvided,
            updatedAt: new Date().toISOString()
          })
        });
      } catch (error) {
        throw new Error('Kunne ikke lagre eksempelet på serveren.');
      }
      if (!TrashArchiveViewer.responseLooksLikeJson(response)) {
        throw new Error(
          `Serveren avviste forespørselen (${response && response.status ? response.status : 'ukjent'})`
        );
      }
      if (!response.ok) {
        throw new Error(`Serveren avviste forespørselen (${response.status}).`);
      }
      try {
        return await response.json();
      } catch (error) {
        throw new Error('Kunne ikke tolke svaret fra serveren.');
      }
    }

    cloneExampleForRestore(example) {
      if (!example || typeof example !== 'object') return {};
      try {
        return JSON.parse(JSON.stringify(example));
      } catch (error) {
        const copy = {};
        Object.keys(example).forEach(key => {
          copy[key] = example[key];
        });
        return copy;
      }
    }

    determineInsertIndex(length, removedAtIndex) {
      const total = Number.isInteger(length) && length >= 0 ? length : 0;
      if (!Number.isInteger(removedAtIndex)) {
        return total;
      }
      if (removedAtIndex < 0) {
        return 0;
      }
      if (removedAtIndex > total) {
        return total;
      }
      return removedAtIndex;
    }

    async restoreTrashEntry(path, item) {
      if (!item || typeof item !== 'object') {
        throw new Error('Fant ikke elementet som skulle gjenopprettes.');
      }
      const entry = await this.fetchExamplesEntry(path);
      const existingExamples = Array.isArray(entry && entry.examples) ? entry.examples.slice() : [];
      const deletedProvided = Array.isArray(entry && entry.deletedProvided) ? entry.deletedProvided.slice() : [];
      const examplePayload = this.cloneExampleForRestore(item.example);
      const insertIndex = this.determineInsertIndex(existingExamples.length, item.removedAtIndex);
      existingExamples.splice(insertIndex, 0, examplePayload);
      await this.putExamplesEntry(path, { examples: existingExamples, deletedProvided });
    }

    handleFilterChange(event) {
      const value = event && event.target ? event.target.value : 'all';
      if (this.state) {
        this.state.filter = value || 'all';
      }
      this.renderEntries();
    }

    async handleAction(event) {
      const button = event.target && event.target.closest ? event.target.closest('button[data-action]') : null;
      if (!button) return;
      const action = button.dataset.action;
      const item = button.closest ? button.closest('[data-item]') : null;
      const group = button.closest ? button.closest('[data-group]') : null;
      const path = group && group.dataset && group.dataset.path
        ? group.dataset.path
        : button.dataset && button.dataset.path
          ? button.dataset.path
          : null;
      if (!path) return;

      if (action === 'open') {
        const id = item && item.dataset ? item.dataset.id : button.dataset.id;
        if (id) {
          this.openExample(path, id);
        }
        return;
      }

      if (action === 'restore') {
        const id = item && item.dataset ? item.dataset.id : button.dataset.id;
        if (!id) return;
        const groupEntry = this.state && this.state.groupsMap ? this.state.groupsMap.get(path) : null;
        if (!groupEntry || !Array.isArray(groupEntry.items)) return;
        const targetItem = groupEntry.items.find(entry => entry && entry.id === id);
        if (!targetItem) return;
        button.disabled = true;
        this.setStatus(this.messages.restoreInProgress, 'info');
        let cancelled = false;
        try {
          await this.restoreTrashEntry(path, targetItem);
          await this.deleteExample(id, { skipConfirm: true });
          let fetchResult = null;
          if (this.onFetchEntries) {
            fetchResult = await this.onFetchEntries();
          }
          this.buildFilterOptions();
          this.renderEntries();
          if (fetchResult && fetchResult.usedFallback && this.messages.restoreFallbackStatus) {
            this.setStatus(this.messages.restoreFallbackStatus, 'info');
          } else {
            this.setStatus(this.messages.restoreSuccess, 'success');
          }
          this.notifyParent(path, targetItem);
        } catch (error) {
          cancelled = true;
          const message = error && error.message ? error.message : this.messages.restoreError;
          this.setStatus(message, 'error');
        } finally {
          button.disabled = false;
        }
        if (cancelled) {
          return;
        }
        return;
      }

      if (action === 'delete') {
        const id = item && item.dataset ? item.dataset.id : button.dataset.id;
        if (!id) return;
        button.disabled = true;
        let cancelled = false;
        try {
          const result = await this.deleteExample(id);
          if (result && result.cancelled) {
            cancelled = true;
            this.setStatus(this.messages.deleteCancelled, 'info');
            return;
          }
          let fetchResult = null;
          if (this.onFetchEntries) {
            fetchResult = await this.onFetchEntries();
          }
          this.buildFilterOptions();
          this.renderEntries();
          if (fetchResult && fetchResult.usedFallback && this.messages.fallbackStatus) {
            this.setStatus(this.messages.fallbackStatus, 'info');
          } else if (this.messages.deleteSuccess) {
            this.setStatus(this.messages.deleteSuccess, 'success');
          } else {
            this.setStatus('', '');
          }
        } catch (error) {
          cancelled = true;
          const message = error && error.message ? error.message : this.messages.deleteError;
          this.setStatus(message, 'error');
        } finally {
          button.disabled = false;
        }
        if (cancelled) {
          return;
        }
      }
    }
  }

  window.MathVisualsTrashArchiveViewer = {
    TrashArchiveViewer
  };
})();
