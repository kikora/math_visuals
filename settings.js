(function () {
  if (typeof document === 'undefined') return;
  const form = document.querySelector('[data-settings-form]');
  if (!form) return;

  const colorGroupsContainer = form.querySelector('[data-color-groups]');
  const statusElement = form.querySelector('[data-status]');
  const projectHeadingElement = document.querySelector('[data-project-heading]');
  const projectLegendElement = form.querySelector('[data-project-legend]');

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

  const paletteConfig = resolvePaletteConfig();
  if (!paletteConfig) {
    if (typeof console !== 'undefined' && console && typeof console.error === 'function') {
      console.error(
        '[MathVisualsSettings] Mangler fargekonfigurasjon. Sørg for at palette/palette-config.js lastes før settings.js.'
      );
    }
    return;
  }

  const MAX_COLORS = paletteConfig.MAX_COLORS;
  const PROJECT_LABELS = {
    kikora: 'Under utvikling',
    campus: 'Produksjon',
    annet: 'Annet'
  };
  const PROJECT_HEADINGS = {
    kikora: 'Under utvikling',
    campus: 'Produksjon',
    annet: 'Annet'
  };
  const PROJECT_FALLBACKS = paletteConfig.PROJECT_FALLBACKS;
  const COLOR_SLOT_GROUPS = paletteConfig.COLOR_SLOT_GROUPS.map(group => ({
    groupId: group.groupId,
    title: group.title,
    description: group.description,
    groupIndex: Number.isInteger(group.groupIndex) ? group.groupIndex : undefined,
    slots: group.slots.map(slot => ({
      index: slot.index,
      label: slot.label,
      description: slot.description,
      groupId: slot.groupId,
      groupIndex: slot.groupIndex
    }))
  }));
  const DEFAULT_GRAFTEGNER_GROUP_ID = 'graftegner';
  const GRAFTEGNER_GROUP_ID = (() => {
    for (const group of COLOR_SLOT_GROUPS) {
      if (!group || typeof group.groupId !== 'string') continue;
      const normalized = group.groupId.trim().toLowerCase();
      if (normalized === DEFAULT_GRAFTEGNER_GROUP_ID) {
        return group.groupId;
      }
    }
    return DEFAULT_GRAFTEGNER_GROUP_ID;
  })();
  const DEFAULT_NKANT_GROUP_ID = 'nkant';
  const NKANT_GROUP_ID = (() => {
    for (const group of COLOR_SLOT_GROUPS) {
      if (!group || typeof group.groupId !== 'string') continue;
      const normalized = group.groupId.trim().toLowerCase();
      if (normalized === DEFAULT_NKANT_GROUP_ID) {
        return group.groupId;
      }
    }
    return DEFAULT_NKANT_GROUP_ID;
  })();
  const LEGACY_NKANT_SLOT_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const GROUP_IDS = Array.isArray(paletteConfig.COLOR_GROUP_IDS)
    ? paletteConfig.COLOR_GROUP_IDS.slice()
    : COLOR_SLOT_GROUPS.map(group => group.groupId);
  const SLOT_META_BY_INDEX = new Map();
  COLOR_SLOT_GROUPS.forEach(group => {
    group.slots.forEach(slot => {
      if (!slot) return;
      const index = Number(slot.index);
      if (!Number.isInteger(index) || index < 0) return;
      SLOT_META_BY_INDEX.set(index, {
        groupId: group.groupId,
        groupIndex: Number(slot.groupIndex) || 0
      });
    });
  });
  const MIN_COLOR_SLOTS = Number.isInteger(paletteConfig.MIN_COLOR_SLOTS)
    ? paletteConfig.MIN_COLOR_SLOTS
    : COLOR_SLOT_GROUPS.reduce((total, group) => total + group.slots.length, 0);
  const PROJECT_FALLBACK_CACHE = new Map();
  const PROJECT_FALLBACK_GROUP_CACHE = new Map();

  function normalizeProjectName(name) {
    if (typeof name !== 'string') return '';
    return name.trim().toLowerCase();
  }

  const settingsApi = resolveSettingsApi();
  const state = {
    projectOrder: [],
    colorsByProject: new Map(),
    persistedColorsByProject: new Map(),
    activeProject: null,
    preferredProject: null
  };
  let colors = [];
  const slotBindings = new Map();
  const groupStatusElements = new Map();
  const graftegnerContrastRows = [];

  function resolveSettingsApi() {
    if (typeof window === 'undefined') return null;
    const api = window.MathVisualsSettings;
    if (api && typeof api === 'object') return api;
    const legacy = window.mathVisuals && window.mathVisuals.settings;
    return legacy && typeof legacy === 'object' ? legacy : null;
  }

  function clonePersistedColorMap() {
    const map = new Map();
    if (state.persistedColorsByProject && typeof state.persistedColorsByProject.forEach === 'function') {
      state.persistedColorsByProject.forEach((palette, name) => {
        map.set(name, cloneProjectPalette(palette));
      });
    }
    state.colorsByProject.forEach((palette, name) => {
      if (!map.has(name)) {
        map.set(name, cloneProjectPalette(palette));
      }
    });
    return map;
  }

  function collectGroupIndices(groupId) {
    const groups = new Set();
    const normalizedGroup = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    if (!normalizedGroup) return groups;
    const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === normalizedGroup);
    if (!group) return groups;
    groups.add(group.groupId);
    return groups;
  }

  function buildProjectColorsForSave(projectName, indices) {
    const map = clonePersistedColorMap();
    const normalizedProject = normalizeProjectName(projectName);
    if (!normalizedProject) return map;
    const targetGroups = indices instanceof Set ? indices : new Set(indices || []);
    if (!targetGroups.size) return map;
    const editingPalette = normalizeProjectPalette(
      normalizedProject,
      state.colorsByProject.get(normalizedProject) || getProjectFallbackPalette(normalizedProject)
    );
    const base = map.get(normalizedProject) || getProjectFallbackPalette(normalizedProject);
    const next = cloneProjectPalette(base);
    targetGroups.forEach(groupId => {
      const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === groupId);
      if (!group) return;
      const source = Array.isArray(editingPalette[group.groupId]) ? editingPalette[group.groupId] : [];
      next[group.groupId] = group.slots.map((slot, slotIndex) => {
        const color = source[slotIndex];
        const fallback = getFallbackColorForIndex(normalizedProject, slot.index);
        return sanitizeColor(color) || fallback;
      });
    });
    map.set(normalizedProject, next);
    return map;
  }

  function captureUnsavedChanges(excludedProject, excludedGroups) {
    const excludedName = normalizeProjectName(excludedProject);
    const excludedSet = excludedGroups instanceof Set ? excludedGroups : new Set();
    const changes = new Map();
    state.colorsByProject.forEach((palette, project) => {
      const normalizedProject = normalizeProjectName(project);
      if (!normalizedProject) return;
      const currentPalette = normalizeProjectPalette(normalizedProject, palette);
      const persistedPalette = normalizeProjectPalette(
        normalizedProject,
        state.persistedColorsByProject.get(normalizedProject) || getProjectFallbackPalette(normalizedProject)
      );
      const entries = new Map();
      GROUP_IDS.forEach(groupId => {
        if (normalizedProject === excludedName && excludedSet.has(groupId)) return;
        const currentGroup = Array.isArray(currentPalette[groupId]) ? currentPalette[groupId] : [];
        const baselineGroup = Array.isArray(persistedPalette[groupId]) ? persistedPalette[groupId] : [];
        const diff = [];
        let hasDiff = false;
        const limit = Math.max(currentGroup.length, baselineGroup.length);
        for (let index = 0; index < limit; index += 1) {
          const currentColor = currentGroup[index];
          const baselineColor = baselineGroup[index];
          if (typeof currentColor === 'string' && currentColor && currentColor !== baselineColor) {
            diff[index] = currentColor;
            hasDiff = true;
          }
        }
        if (hasDiff) {
          entries.set(groupId, diff);
        }
      });
      if (entries.size) {
        changes.set(normalizedProject, entries);
      }
    });
    return changes;
  }

  function restoreUnsavedChanges(changes) {
    if (!changes || typeof changes.forEach !== 'function') return;
    let shouldSyncActive = false;
    changes.forEach((groups, project) => {
      const normalizedProject = normalizeProjectName(project);
      if (!normalizedProject || !groups || typeof groups.forEach !== 'function') return;
      const currentPalette = normalizeProjectPalette(
        normalizedProject,
        state.colorsByProject.get(normalizedProject) || getProjectFallbackPalette(normalizedProject)
      );
      groups.forEach((values, groupId) => {
        const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === groupId);
        if (!group) return;
        const incoming = Array.isArray(values) ? values : [];
        const target = Array.isArray(currentPalette[groupId]) ? currentPalette[groupId].slice() : [];
        group.slots.forEach((slot, slotIndex) => {
          const nextColor = incoming[slotIndex];
          if (typeof nextColor === 'string' && nextColor) {
            target[slotIndex] = sanitizeColor(nextColor) || target[slotIndex] || getFallbackColorForIndex(normalizedProject, slot.index);
          }
        });
        currentPalette[groupId] = target;
      });
      state.colorsByProject.set(normalizedProject, cloneProjectPalette(currentPalette));
      if (normalizedProject === state.activeProject) {
        commitActiveColors(currentPalette, normalizedProject);
        shouldSyncActive = true;
      }
    });
    if (shouldSyncActive) {
      syncBindings();
    }
  }

  function normalizeGroupId(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function formatProjectGroupLabel(projectName, groupTitle) {
    const projectLabel = formatProjectLabel(projectName) || 'prosjektet';
    const trimmedGroup = typeof groupTitle === 'string' ? groupTitle.trim() : '';
    if (projectLabel && trimmedGroup) {
      return `${projectLabel} – ${trimmedGroup}`;
    }
    if (trimmedGroup) {
      return trimmedGroup;
    }
    return projectLabel;
  }

  function setGroupStatusMessage(groupId, message, tone) {
    const normalizedId = normalizeGroupId(groupId);
    if (!normalizedId || !groupStatusElements.size) return;
    groupStatusElements.forEach((element, key) => {
      if (!element) return;
      if (key === normalizedId) {
        const text = message || '';
        element.textContent = text;
        if (text) {
          if (tone) {
            element.dataset.status = tone;
          } else {
            element.removeAttribute('data-status');
          }
          element.hidden = false;
        } else {
          element.removeAttribute('data-status');
          element.hidden = true;
        }
      } else if (message) {
        element.textContent = '';
        element.removeAttribute('data-status');
        element.hidden = true;
      }
    });
  }

  async function saveColorGroup(groupId, groupTitle) {
    const normalizedId = normalizeGroupId(groupId);
    if (!normalizedId) return;
    const activeProject = ensureActiveProject();
    const label = groupTitle && groupTitle.trim() ? groupTitle.trim() : 'gruppen';
    const combinedLabel = formatProjectGroupLabel(activeProject, label);
    const groups = collectGroupIndices(normalizedId);
    if (!groups.size) {
      setStatus(`Ingen endringer å lagre for ${label}.`, 'info');
      return;
    }
    const editingPalette = normalizeProjectPalette(
      activeProject,
      state.colorsByProject.get(activeProject) || getProjectFallbackPalette(activeProject)
    );
    const persistedPalette = normalizeProjectPalette(
      activeProject,
      state.persistedColorsByProject.get(activeProject) || getProjectFallbackPalette(activeProject)
    );
    let hasChanges = false;
    groups.forEach(groupKey => {
      if (hasChanges) return;
      const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === groupKey);
      if (!group) return;
      const currentGroup = Array.isArray(editingPalette[groupKey]) ? editingPalette[groupKey] : [];
      const persistedGroup = Array.isArray(persistedPalette[groupKey]) ? persistedPalette[groupKey] : [];
      const limit = Math.max(currentGroup.length, persistedGroup.length);
      for (let index = 0; index < limit; index += 1) {
        if ((currentGroup[index] || '') !== (persistedGroup[index] || '')) {
          hasChanges = true;
          break;
        }
      }
    });
    if (!hasChanges) {
      setStatus(`Ingen endringer å lagre for ${label}.`, 'info');
      return;
    }
    const unsavedChanges = captureUnsavedChanges(activeProject, groups);
    const colorsForSave = buildProjectColorsForSave(activeProject, groups);
    setStatus(`Lagrer fargene for ${combinedLabel}...`, 'info');
    setFormDisabled(true);
    try {
      const payload = buildPayload({
        projectColors: colorsForSave,
        activeProject
      });
      const snapshot = await persistSettings('PUT', payload);
      applySettings(snapshot || {}, { forceActiveProject: activeProject });
      restoreUnsavedChanges(unsavedChanges);
      if (settingsApi && typeof settingsApi.refresh === 'function') {
        try {
          settingsApi.refresh({ force: true, notify: true });
        } catch (_) {}
      }
      const savedPalette = colorsForSave.get(activeProject);
      const contrastStatus = buildContrastStatus(normalizedId, savedPalette);
      const successMessage = `Fargene for ${combinedLabel} er lagret.`;
      const contrastMessage = contrastStatus && contrastStatus.message ? ` ${contrastStatus.message}` : '';
      const tone = contrastStatus ? (contrastStatus.passes ? 'success' : 'warning') : 'success';
      setStatus(`${successMessage}${contrastMessage}`, tone);
      const groupMessage = `${combinedLabel} er lagret.${contrastMessage}`;
      setGroupStatusMessage(normalizedId, groupMessage, tone);
    } catch (error) {
      console.error(error);
      const errorMessage = `Kunne ikke lagre fargene for ${combinedLabel}.`;
      setStatus(errorMessage, 'error');
      setGroupStatusMessage(normalizedId, `Kunne ikke lagre ${combinedLabel}.`, 'error');
    } finally {
      setFormDisabled(false);
    }
  }

  function resolveApiUrl() {
    if (settingsApi && typeof settingsApi.getApiUrl === 'function') {
      try {
        const hint = settingsApi.getApiUrl();
        if (typeof hint === 'string' && hint.trim()) {
          return hint.trim();
        }
      } catch (_) {}
    }
    if (typeof window !== 'undefined') {
      if (window.MATH_VISUALS_SETTINGS_API_URL) {
        const hint = String(window.MATH_VISUALS_SETTINGS_API_URL).trim();
        if (hint) return hint;
      }
      const origin = window.location && window.location.origin;
      if (typeof origin === 'string' && /^https?:/i.test(origin)) {
        return '/api/settings';
      }
    }
    return null;
  }

  function sanitizeColor(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const match = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(trimmed);
    if (!match) return null;
    let hex = match[1].toLowerCase();
    if (hex.length === 3) {
      hex = hex.split('').map(ch => ch + ch).join('');
    } else if (hex.length === 4) {
      const rgb = hex.slice(0, 3).split('');
      hex = rgb.map(ch => ch + ch).join('');
    } else if (hex.length === 8) {
      hex = hex.slice(0, 6);
    }
    return `#${hex}`;
  }

  function sanitizeColorList(values, limit = MAX_COLORS) {
    if (!Array.isArray(values) || !values.length) return [];
    const result = [];
    const max = Number.isInteger(limit) && limit > 0 ? limit : MAX_COLORS;
    for (let index = 0; index < values.length && result.length < max; index += 1) {
      const sanitized = sanitizeColor(values[index]);
      if (sanitized) {
        result.push(sanitized);
      }
    }
    return result;
  }

  const CONTRAST_THRESHOLD_NORMAL_TEXT = 4.5;

  function calculateRelativeLuminance(color) {
    const sanitized = sanitizeColor(color);
    if (!sanitized || sanitized.length !== 7) return null;
    const hex = sanitized.slice(1);
    const red = parseInt(hex.slice(0, 2), 16) / 255;
    const green = parseInt(hex.slice(2, 4), 16) / 255;
    const blue = parseInt(hex.slice(4, 6), 16) / 255;
    const toLinear = channel =>
      channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    const r = toLinear(red);
    const g = toLinear(green);
    const b = toLinear(blue);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function calculateContrastRatio(luminanceA, luminanceB) {
    if (typeof luminanceA !== 'number' || typeof luminanceB !== 'number') return null;
    if (!isFinite(luminanceA) || !isFinite(luminanceB)) return null;
    const lighter = Math.max(luminanceA, luminanceB);
    const darker = Math.min(luminanceA, luminanceB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function calculateContrastRatioBetweenColors(colorA, colorB) {
    const luminanceA = calculateRelativeLuminance(colorA);
    const luminanceB = calculateRelativeLuminance(colorB);
    return calculateContrastRatio(luminanceA, luminanceB);
  }

  function calculateBestTextContrast(color) {
    const luminance = calculateRelativeLuminance(color);
    if (typeof luminance !== 'number') return null;
    const contrastBlack = calculateContrastRatio(luminance, 0);
    const contrastWhite = calculateContrastRatio(luminance, 1);
    if (contrastBlack === null || contrastWhite === null) return null;
    const bestRatio = Math.max(contrastBlack, contrastWhite);
    const textColor = contrastBlack >= contrastWhite ? '#000000' : '#ffffff';
    return {
      luminance,
      contrasts: {
        black: contrastBlack,
        white: contrastWhite
      },
      best: {
        color: textColor,
        ratio: bestRatio
      },
      passes: bestRatio >= CONTRAST_THRESHOLD_NORMAL_TEXT
    };
  }

  function formatContrastRatio(ratio) {
    if (typeof ratio !== 'number' || !isFinite(ratio)) return null;
    const formatted = ratio.toLocaleString('nb-NO', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
    return `${formatted}:1`;
  }

  function buildContrastStatus(groupId, palette) {
    if (!groupId || !palette || typeof palette !== 'object') return null;
    if (groupId === 'graftegner') {
      const colors = Array.isArray(palette[groupId]) ? palette[groupId] : [];
      const evaluation = evaluateContrastForSlot(colors[0]);
      if (!evaluation) {
        return {
          message: 'Kontrast kunne ikke beregnes.',
          passes: false
        };
      }
      return {
        message: `Kontrast ${evaluation.display} – ${evaluation.passes ? 'OK' : 'for lav'}`,
        passes: evaluation.passes
      };
    }
    if (groupId === 'arealmodell') {
      const colors = Array.isArray(palette[groupId]) ? palette[groupId] : [];
      const messages = [];
      let passes = true;
      for (let index = 0; index < 4; index += 1) {
        const label = `Kontrast rute ${index + 1}`;
        const evaluation = evaluateContrastForSlot(colors[index]);
        if (!evaluation) {
          messages.push(`${label}: ikke tilgjengelig`);
          passes = false;
          continue;
        }
        messages.push(`${label}: ${evaluation.display} – ${evaluation.passes ? 'OK' : 'for lav'}`);
        if (!evaluation.passes) {
          passes = false;
        }
      }
      return {
        message: messages.join(' '),
        passes
      };
    }
    return null;
  }

  function evaluateContrastForSlot(color) {
    const sanitized = sanitizeColor(color);
    if (!sanitized) return null;
    const contrast = calculateBestTextContrast(sanitized);
    if (!contrast) return null;
    const display = formatContrastRatio(contrast.best.ratio);
    if (!display) return null;
    return {
      display,
      passes: contrast.passes
    };
  }

  function resolveContrastColor(index) {
    if (!Number.isInteger(index) || index < 0) return null;
    const project = ensureActiveProject();
    return sanitizeColor(colors[index]) || getFallbackColorForIndex(project, index);
  }

  function evaluateContrastBetweenColors(colorA, colorB) {
    const ratio = calculateContrastRatioBetweenColors(colorA, colorB);
    if (ratio === null) return null;
    const display = formatContrastRatio(ratio);
    if (!display) return null;
    return {
      display,
      passes: ratio >= CONTRAST_THRESHOLD_NORMAL_TEXT
    };
  }

  function formatContrastStatusText(label, evaluation) {
    if (!evaluation) {
      return `${label}: ikke tilgjengelig ❌`;
    }
    return `${label}: ${evaluation.display} ${evaluation.passes ? '✅' : '❌'}`;
  }

  function buildGraftegnerContrastMessage(fillIndex, lineIndex) {
    const fillColor = resolveContrastColor(fillIndex);
    const lineColor = resolveContrastColor(lineIndex);
    const between = evaluateContrastBetweenColors(fillColor, lineColor);
    const fillOnWhite = evaluateContrastBetweenColors(fillColor, '#ffffff');
    const lineOnWhite = evaluateContrastBetweenColors(lineColor, '#ffffff');
    const parts = [
      formatContrastStatusText('fyll/linje', between),
      formatContrastStatusText('fyll mot hvit', fillOnWhite),
      formatContrastStatusText('linje mot hvit', lineOnWhite)
    ];
    return `Kontrast ${parts.join(' · ')}`;
  }

  function updateGraftegnerContrastRows() {
    if (!graftegnerContrastRows.length) return;
    graftegnerContrastRows.forEach(row => {
      if (!row) return;
      const fillIndex = Number(row.dataset.fillIndex);
      const lineIndex = Number(row.dataset.lineIndex);
      row.textContent = buildGraftegnerContrastMessage(fillIndex, lineIndex);
    });
  }

  function getSanitizedFallbackBase(project) {
    const key = normalizeProjectName(project) || 'default';
    const base = PROJECT_FALLBACKS[key] || PROJECT_FALLBACKS.default || [];
    const sanitized = sanitizeColorList(base, MAX_COLORS);
    if (!sanitized.length) {
      const fallbackDefault = sanitizeColor(
        (PROJECT_FALLBACKS.default && PROJECT_FALLBACKS.default[0]) || '#1F4DE2'
      );
      sanitized.push(fallbackDefault || '#1F4DE2');
    }
    const cached = PROJECT_FALLBACK_CACHE.get(key);
    const hasChanged =
      !cached ||
      cached.length !== sanitized.length ||
      cached.some((value, index) => value !== sanitized[index]);
    if (hasChanged) {
      PROJECT_FALLBACK_CACHE.set(key, sanitized.slice());
      if (key === 'default') {
        PROJECT_FALLBACK_GROUP_CACHE.clear();
      } else {
        PROJECT_FALLBACK_GROUP_CACHE.delete(key);
      }
    }
    return sanitized.slice();
  }

  function buildFallbackGroupsFromBase(baseColors, project) {
    const sanitizedBase = Array.isArray(baseColors)
      ? sanitizeColorList(baseColors, MAX_COLORS)
      : [];
    const fallbackColors = sanitizedBase.length ? sanitizedBase : getSanitizedFallbackBase('default');
    const groups = {};
    let cursor = 0;
    COLOR_SLOT_GROUPS.forEach(group => {
      const slots = Array.isArray(group.slots) ? group.slots : [];
      const limit = slots.length;
      const colors = [];
      if (limit > 0) {
        for (let index = 0; index < limit; index += 1) {
          const color =
            fallbackColors[cursor] ||
            fallbackColors[index % (fallbackColors.length || 1)] ||
            fallbackColors[0];
          if (color) {
            colors.push(color);
          }
          if (cursor < fallbackColors.length) {
            cursor += 1;
          }
        }
        if (!colors.length && fallbackColors.length) {
          for (let index = 0; index < limit; index += 1) {
            colors.push(fallbackColors[index % fallbackColors.length]);
          }
        }
      }
      groups[group.groupId] = colors;
    });
    return groups;
  }

  function ensureProjectPaletteShape(palette) {
    const shaped = {};
    const source = palette && typeof palette === 'object' ? palette : {};
    GROUP_IDS.forEach(groupId => {
      shaped[groupId] = Array.isArray(source[groupId]) ? source[groupId] : [];
    });
    return shaped;
  }

  function cloneProjectPalette(palette) {
    const shaped = ensureProjectPaletteShape(palette);
    const copy = {};
    GROUP_IDS.forEach(groupId => {
      const source = Array.isArray(shaped[groupId]) ? shaped[groupId] : [];
      copy[groupId] = source.slice(0, MAX_COLORS);
    });
    return copy;
  }

  function convertLegacyPalette(project, palette) {
    if (!Array.isArray(palette) || !palette.length) return {};
    const sanitized = sanitizeColorList(palette, MAX_COLORS);
    const converted = {};
    COLOR_SLOT_GROUPS.forEach(group => {
      const isNkant = group.groupId === NKANT_GROUP_ID;
      converted[group.groupId] = group.slots.map(slot => {
        const index = Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : 0;
        let color = sanitized[index] || null;
        if (!color && isNkant) {
          const legacyIndex = LEGACY_NKANT_SLOT_INDICES[slot.groupIndex];
          if (Number.isInteger(legacyIndex) && legacyIndex >= 0) {
            color = sanitized[legacyIndex] || null;
          }
        }
        return color;
      });
    });
    return converted;
  }

  function sanitizeProjectPalette(project, palette) {
    const fallback = getProjectFallbackPalette(project);
    const fallbackBase = getSanitizedFallbackBase(project);
    const shaped = ensureProjectPaletteShape(palette);
    const sanitized = {};
    COLOR_SLOT_GROUPS.forEach(group => {
      const fallbackColors = Array.isArray(fallback[group.groupId]) ? fallback[group.groupId] : [];
      const incoming = Array.isArray(shaped[group.groupId]) ? shaped[group.groupId] : [];
      sanitized[group.groupId] = group.slots.map((slot, slotIndex) => {
        const clean = sanitizeColor(incoming[slotIndex]);
        if (clean) return clean;
        if (fallbackColors[slotIndex]) return fallbackColors[slotIndex];
        if (fallbackColors[0]) return fallbackColors[0];
        if (fallbackBase.length) {
          const baseIndex = Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : slotIndex;
          return fallbackBase[baseIndex % fallbackBase.length] || fallbackBase[0];
        }
        return '#1F4DE2';
      });
    });
    return sanitized;
  }

  function normalizeProjectPalette(project, palette) {
    if (Array.isArray(palette)) {
      return sanitizeProjectPalette(project, convertLegacyPalette(project, palette));
    }
    if (palette && typeof palette === 'object') {
      return sanitizeProjectPalette(project, palette);
    }
    return getProjectFallbackPalette(project);
  }

  function flattenProjectPalette(project, palette, minimumLength = MIN_COLOR_SLOTS) {
    const normalized = normalizeProjectPalette(project, palette);
    const flattened = [];
    let highestSlotIndex = -1;
    COLOR_SLOT_GROUPS.forEach(group => {
      const groupColors = Array.isArray(normalized[group.groupId]) ? normalized[group.groupId] : [];
      group.slots.forEach((slot, slotIndex) => {
        const targetIndex =
          Number.isInteger(slot.index) && slot.index >= 0 ? slot.index : slotIndex;
        if (targetIndex > highestSlotIndex) {
          highestSlotIndex = targetIndex;
        }
        const color = sanitizeColor(groupColors[slotIndex]);
        const fallback = getFallbackColorForIndex(project, targetIndex);
        flattened[targetIndex] = color || fallback;
      });
    });
    const min = Number.isInteger(minimumLength) && minimumLength > 0 ? minimumLength : 0;
    const targetLength = Math.min(MAX_COLORS, Math.max(min, highestSlotIndex + 1));
    for (let index = 0; index < targetLength; index += 1) {
      if (!sanitizeColor(flattened[index])) {
        flattened[index] = getFallbackColorForIndex(project, index);
      }
    }
    return flattened.slice(0, targetLength);
  }

  function assignColorToPalette(palette, index, color) {
    const meta = SLOT_META_BY_INDEX.get(index);
    if (meta) {
      if (!Array.isArray(palette[meta.groupId])) {
        palette[meta.groupId] = [];
      }
      palette[meta.groupId][meta.groupIndex] = color;
    }
  }

  function getProjectFallbackPalette(project) {
    const key = normalizeProjectName(project) || 'default';
    if (!PROJECT_FALLBACK_GROUP_CACHE.has(key)) {
      const base = getSanitizedFallbackBase(key);
      PROJECT_FALLBACK_GROUP_CACHE.set(key, buildFallbackGroupsFromBase(base, key));
    }
    return cloneProjectPalette(PROJECT_FALLBACK_GROUP_CACHE.get(key));
  }

  function getFallbackColorForIndex(project, index) {
    const key = normalizeProjectName(project) || 'default';
    const baseColors = getSanitizedFallbackBase(key);
    if (!baseColors.length) {
      return (PROJECT_FALLBACKS.default && PROJECT_FALLBACKS.default[0]) || '#1F4DE2';
    }
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;
    const meta = SLOT_META_BY_INDEX.get(normalizedIndex);
    if (meta) {
      if (!PROJECT_FALLBACK_GROUP_CACHE.has(key)) {
        const base = getSanitizedFallbackBase(key);
        PROJECT_FALLBACK_GROUP_CACHE.set(key, buildFallbackGroupsFromBase(base, key));
      }
      const groups = PROJECT_FALLBACK_GROUP_CACHE.get(key) || {};
      const groupColors = groups[meta.groupId] || [];
      const candidate = groupColors[meta.groupIndex];
      if (candidate) {
        return candidate;
      }
    }
    return baseColors[normalizedIndex % baseColors.length] || baseColors[0];
  }

  function formatProjectLabel(name) {
    if (!name) return '';
    const key = normalizeProjectName(name);
    if (PROJECT_LABELS[key]) return PROJECT_LABELS[key];
    return key.charAt(0).toUpperCase() + key.slice(1);
  }

  function resolveProjectHeading(name) {
    const normalized = normalizeProjectName(name);
    if (PROJECT_HEADINGS[normalized]) {
      return PROJECT_HEADINGS[normalized];
    }
    const label = formatProjectLabel(name);
    return label || 'Farger';
  }

  function updateProjectHeading(project) {
    const active = project ? normalizeProjectName(project) : ensureActiveProject();
    const headingText = resolveProjectHeading(active);
    if (projectHeadingElement) {
      const fullHeading = headingText || 'Fargeinnstillinger';
      projectHeadingElement.textContent = fullHeading;
    }
    if (projectLegendElement) {
      projectLegendElement.textContent = headingText || 'Fargeinnstillinger';
    }
  }

  function setStatus(message, tone) {
    if (!statusElement) return;
    statusElement.textContent = message || '';
    if (message) {
      statusElement.dataset.status = tone || 'success';
    } else {
      statusElement.removeAttribute('data-status');
    }
  }

  function clearStatus() {
    setStatus('', 'info');
  }

  function notifySettingsUpdated() {
    if (statusElement && statusElement.dataset.status === 'success') {
      return;
    }
    setStatus('Innstillingene er oppdatert.', 'info');
  }

  function setFormDisabled(disabled) {
    const elements = Array.from(form.querySelectorAll('input, button, select, textarea'));
    elements.forEach(el => {
      if (disabled) {
        el.setAttribute('disabled', 'disabled');
      } else {
        el.removeAttribute('disabled');
      }
    });
  }

  function getApiActiveProject() {
    if (!settingsApi || typeof settingsApi.getActiveProject !== 'function') return null;
    try {
      const value = normalizeProjectName(settingsApi.getActiveProject());
      return value || null;
    } catch (_) {
      return null;
    }
  }

  function ensureProjectColors(name) {
    const normalized = normalizeProjectName(name);
    if (!normalized) return;
    if (!state.colorsByProject.has(normalized)) {
      const palette = normalizeProjectPalette(normalized, getProjectFallbackPalette(normalized));
      state.colorsByProject.set(normalized, cloneProjectPalette(palette));
    }
    if (!state.persistedColorsByProject.has(normalized)) {
      const palette = state.colorsByProject.get(normalized);
      state.persistedColorsByProject.set(normalized, cloneProjectPalette(palette));
    }
  }

  function ensureActiveProject() {
    const seen = new Set();
    const candidates = [];
    const addCandidate = value => {
      const normalized = normalizeProjectName(value);
      if (!normalized || seen.has(normalized)) return;
      seen.add(normalized);
      candidates.push(normalized);
    };
    addCandidate(state.preferredProject);
    addCandidate(state.activeProject);
    addCandidate(getApiActiveProject());
    state.projectOrder.forEach(addCandidate);
    addCandidate('campus');
    addCandidate('kikora');
    addCandidate('annet');

    for (const candidate of candidates) {
      ensureProjectColors(candidate);
      state.activeProject = candidate;
      return candidate;
    }

    const fallback = 'campus';
    ensureProjectColors(fallback);
    state.activeProject = fallback;
    return fallback;
  }

  function getActiveColors(projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    const palette = state.colorsByProject.get(project);
    if (palette) {
      return cloneProjectPalette(palette);
    }
    return getProjectFallbackPalette(project);
  }

  function expandPalette(projectName, basePalette, minimumLength = 0) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    const normalizedPalette = normalizeProjectPalette(project, basePalette);
    return flattenProjectPalette(project, normalizedPalette, minimumLength);
  }

  function commitActiveColors(next, projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    const normalizedPalette = normalizeProjectPalette(project, next);
    state.colorsByProject.set(project, cloneProjectPalette(normalizedPalette));
    colors = flattenProjectPalette(project, normalizedPalette, MIN_COLOR_SLOTS);
  }

  function ensureColorCapacity(index, projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    if (!Number.isInteger(index) || index < 0) return;
    const palette = normalizeProjectPalette(
      project,
      state.colorsByProject.get(project) || getProjectFallbackPalette(project)
    );
    const requiredLength = Math.min(
      MAX_COLORS,
      Math.max(MIN_COLOR_SLOTS, index + 1)
    );
    let updated = false;
    for (let slotIndex = 0; slotIndex < requiredLength; slotIndex += 1) {
      const existing = sanitizeColor(colors[slotIndex]);
      if (existing) {
        if (colors[slotIndex] !== existing) {
          colors[slotIndex] = existing;
          updated = true;
        }
        assignColorToPalette(palette, slotIndex, existing);
        continue;
      }
      const fallback = getFallbackColorForIndex(project, slotIndex);
      if (colors[slotIndex] !== fallback) {
        colors[slotIndex] = fallback;
        updated = true;
      }
      assignColorToPalette(palette, slotIndex, fallback);
    }
    state.colorsByProject.set(project, cloneProjectPalette(palette));
    if (updated) {
      syncBindings();
    }
  }

  function updateBindingsForIndex(index, value) {
    const bindings = slotBindings.get(index);
    if (!bindings) return;
    bindings.forEach(binding => {
      if (binding.colorInput.value !== value) {
        binding.colorInput.value = value;
      }
      if (binding.hexInput.value !== value) {
        binding.hexInput.value = value;
      }
    });
  }

  function setColorValue(index, value, projectName) {
    const project = projectName ? normalizeProjectName(projectName) : ensureActiveProject();
    ensureColorCapacity(index, project);
    const fallback = getFallbackColorForIndex(project, index);
    const clean = sanitizeColor(value) || fallback;
    colors[index] = clean;
    const palette = normalizeProjectPalette(
      project,
      state.colorsByProject.get(project) || getProjectFallbackPalette(project)
    );
    assignColorToPalette(palette, index, clean);
    state.colorsByProject.set(project, cloneProjectPalette(palette));
    updateBindingsForIndex(index, clean);
    updateGraftegnerContrastRows();
  }

  function handleColorInput(index, event) {
    if (!event || !event.target) return;
    const project = ensureActiveProject();
    ensureColorCapacity(index, project);
    const current = sanitizeColor(colors[index]) || getFallbackColorForIndex(project, index);
    const next = sanitizeColor(event.target.value) || current;
    setColorValue(index, next, project);
    clearStatus();
  }

  function handleHexBlur(index, event) {
    if (!event || !event.target) return;
    const project = ensureActiveProject();
    ensureColorCapacity(index, project);
    const next = sanitizeColor(event.target.value);
    if (next) {
      setColorValue(index, next, project);
    } else {
      const fallback = sanitizeColor(colors[index]) || getFallbackColorForIndex(project, index);
      updateBindingsForIndex(index, fallback);
    }
    clearStatus();
    updateGraftegnerContrastRows();
  }

  function registerSlotBinding(index, binding) {
    if (!binding || !binding.colorInput || !binding.hexInput) return;
    const normalizedIndex = Number(index);
    if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) return;
    const list = slotBindings.get(normalizedIndex) || [];
    list.push(binding);
    slotBindings.set(normalizedIndex, list);
    binding.colorInput.addEventListener('input', event => handleColorInput(normalizedIndex, event));
    binding.hexInput.addEventListener('blur', event => handleHexBlur(normalizedIndex, event));
    binding.hexInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        binding.hexInput.blur();
      }
    });
    binding.hexInput.addEventListener('input', () => {
      clearStatus();
    });
  }

  function createColorSlotElement(slot) {
    const item = document.createElement('div');
    item.className = 'color-slot';
    item.dataset.colorIndex = String(slot.index);

    const label = document.createElement('span');
    label.className = 'color-slot__label';
    label.textContent = slot.label;

    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = '#1f4de2';
    hexInput.setAttribute('aria-label', `${slot.label} kode`);
    hexInput.setAttribute('placeholder', '#000000');
    hexInput.setAttribute('spellcheck', 'false');
    hexInput.setAttribute('autocomplete', 'off');
    hexInput.setAttribute('inputmode', 'text');
    hexInput.setAttribute('pattern', '#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})');
    hexInput.maxLength = 9;

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = '#1f4de2';
    colorInput.setAttribute('aria-label', `${slot.label} farge`);
    colorInput.setAttribute('title', slot.label);

    item.appendChild(label);
    item.appendChild(hexInput);
    item.appendChild(colorInput);

    registerSlotBinding(slot.index, { colorInput, hexInput });
    return item;
  }

  function createGraftegnerContrastField(fillIndex, lineIndex) {
    const field = document.createElement('div');
    field.className = 'color-contrast-field';
    field.dataset.fillIndex = String(fillIndex);
    field.dataset.lineIndex = String(lineIndex);
    field.textContent = buildGraftegnerContrastMessage(fillIndex, lineIndex);
    graftegnerContrastRows.push(field);
    return field;
  }

  function createGraftegnerPairRow(fillSlot, lineSlot) {
    const row = document.createElement('div');
    row.className = 'color-pair-row';
    row.appendChild(createColorSlotElement(fillSlot));
    row.appendChild(createColorSlotElement(lineSlot));
    row.appendChild(createGraftegnerContrastField(fillSlot.index, lineSlot.index));
    return row;
  }

  function appendSlotToTable(container, slotElement) {
    if (!container || !slotElement) return;
    container.appendChild(slotElement);
  }

  function buildColorLayout() {
    if (!colorGroupsContainer || slotBindings.size) return;

    COLOR_SLOT_GROUPS.forEach(group => {
      const normalizedGroupId = normalizeGroupId(group.groupId);
      const section = document.createElement('section');
      section.className = 'color-group';

      const header = document.createElement('div');
      header.className = 'color-group__header';

      const title = document.createElement('h3');
      title.className = 'color-group__title';
      title.textContent = group.title;
      header.appendChild(title);

      const actions = document.createElement('div');
      actions.className = 'color-group__actions';

      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.className = 'btn btn--inline';
      saveButton.textContent = 'Lagre';
      saveButton.dataset.saveGroup = group.groupId;
      saveButton.dataset.groupTitle = group.title;
      if (normalizedGroupId) {
        saveButton.dataset.statusGroup = normalizedGroupId;
      }
      saveButton.setAttribute('aria-label', `Lagre fargene for ${group.title}`);
      actions.appendChild(saveButton);

      const status = document.createElement('p');
      status.className = 'color-group__status';
      status.hidden = true;
      actions.appendChild(status);
      if (normalizedGroupId) {
        groupStatusElements.set(normalizedGroupId, status);
      }

      header.appendChild(actions);
      section.appendChild(header);

      const table = document.createElement('div');
      table.className = 'color-table';
      if (normalizedGroupId) {
        table.dataset.groupId = normalizedGroupId;
      }
      if (normalizedGroupId === 'graftegner') {
        graftegnerContrastRows.length = 0;
        for (let slotIndex = 0; slotIndex < group.slots.length; slotIndex += 2) {
          const fillSlot = group.slots[slotIndex];
          const lineSlot = group.slots[slotIndex + 1];
          if (fillSlot && lineSlot) {
            appendSlotToTable(table, createGraftegnerPairRow(fillSlot, lineSlot));
          } else if (fillSlot) {
            appendSlotToTable(table, createColorSlotElement(fillSlot));
          }
        }
      } else if (normalizedGroupId === 'nkant') {
        table.classList.add('color-table--nkant');
        const buckets = [[], [], []];
        group.slots.forEach((slot, slotIndex) => {
          const normalizedIndex = Number.isInteger(slot && slot.groupIndex)
            ? slot.groupIndex
            : slotIndex;
          const bucket = normalizedIndex % 3;
          if (!buckets[bucket]) buckets[bucket] = [];
          buckets[bucket].push(slot);
        });
        buckets.forEach(bucket => {
          bucket.forEach(slot => {
            appendSlotToTable(table, createColorSlotElement(slot));
          });
        });
      } else {
        group.slots.forEach(slot => {
          appendSlotToTable(table, createColorSlotElement(slot));
        });
      }
      section.appendChild(table);
      colorGroupsContainer.appendChild(section);
    });
  }

  function syncBindings() {
    for (let index = 0; index < colors.length; index += 1) {
      updateBindingsForIndex(index, colors[index]);
    }
    updateGraftegnerContrastRows();
  }

  function renderColors(projectName) {
    if (!colorGroupsContainer) return;
    buildColorLayout();
    let project = typeof projectName === 'string' ? normalizeProjectName(projectName) : '';
    if (project) {
      ensureProjectColors(project);
      state.activeProject = project;
    } else {
      project = ensureActiveProject();
    }
    updateProjectHeading(project);
    const palette = getActiveColors(project);
    commitActiveColors(palette, project);
    syncBindings();
  }

  function requestActiveProfileFromParent() {
    if (typeof window === 'undefined') return;
    const parentWindow = window.parent && window.parent !== window ? window.parent : null;
    if (!parentWindow) return;
    try {
      parentWindow.postMessage({ type: 'math-visuals:request-profile' }, '*');
    } catch (_) {}
  }

  function handleProfileMessage(event) {
    const data = event && event.data;
    let type;
    let profileName;
    if (typeof data === 'string') {
      type = data;
    } else if (data && typeof data === 'object') {
      type = data.type;
      profileName = data.profile || data.name || data.value;
    }
    if (type !== 'math-visuals:profile-change') return;
    const normalized = normalizeProjectName(profileName);
    if (normalized) {
      state.preferredProject = normalized;
      let current = null;
      if (settingsApi && typeof settingsApi.getActiveProject === 'function') {
        try {
          current = normalizeProjectName(settingsApi.getActiveProject());
        } catch (_) {}
      }
      if (
        settingsApi &&
        typeof settingsApi.setActiveProject === 'function' &&
        current !== normalized
      ) {
        try {
          settingsApi.setActiveProject(normalized, { notify: true });
        } catch (_) {}
      }
      renderColors(normalized);
    } else {
      state.preferredProject = null;
      renderColors();
    }
    clearStatus();
  }

  function applySettings(snapshot, options = {}) {
    const data = snapshot && typeof snapshot === 'object' ? snapshot : {};
    state.projectOrder = Array.isArray(data.projectOrder)
      ? Array.from(new Set(data.projectOrder.map(normalizeProjectName))).filter(Boolean)
      : [];
    state.colorsByProject = new Map();
    state.persistedColorsByProject = new Map();
    const projects = data.projects && typeof data.projects === 'object' ? data.projects : {};
    Object.keys(projects).forEach(name => {
      const normalized = normalizeProjectName(name);
      if (!normalized) return;
      const entry = projects[name];
      const paletteData =
        entry && (entry.groupPalettes || entry.defaultColors)
          ? entry.groupPalettes || entry.defaultColors
          : getProjectFallbackPalette(normalized);
      const normalizedPalette = normalizeProjectPalette(normalized, paletteData);
      const cloned = cloneProjectPalette(normalizedPalette);
      state.colorsByProject.set(normalized, cloned);
      state.persistedColorsByProject.set(normalized, cloneProjectPalette(cloned));
      if (!state.projectOrder.includes(normalized)) {
        state.projectOrder.push(normalized);
      }
    });
    ['campus', 'kikora', 'annet'].forEach(name => {
      if (!state.projectOrder.includes(name)) {
        state.projectOrder.push(name);
      }
      if (!state.colorsByProject.has(name)) {
        const palette = getProjectFallbackPalette(name);
        state.colorsByProject.set(name, cloneProjectPalette(palette));
        state.persistedColorsByProject.set(name, cloneProjectPalette(palette));
      } else if (!state.persistedColorsByProject.has(name)) {
        const palette = state.colorsByProject.get(name);
        state.persistedColorsByProject.set(name, cloneProjectPalette(palette));
      }
    });
    const incomingActiveProject = normalizeProjectName(data.activeProject);
    const forcedActive = options.forceActiveProject ? normalizeProjectName(options.forceActiveProject) : '';
    state.activeProject = forcedActive || incomingActiveProject;
    const active = ensureActiveProject();
    state.activeProject = active;
    renderColors(state.activeProject);
  }

  async function loadSettings() {
    const url = resolveApiUrl();
    if (!url) {
      setStatus('Fant ikke endepunkt for innstillinger.', 'error');
      setFormDisabled(true);
      return;
    }
    setStatus('Laster innstillinger...', 'info');
    setFormDisabled(true);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json().catch(() => ({}));
      const snapshot = payload && typeof payload === 'object' && payload.settings ? payload.settings : payload;
      applySettings(snapshot || {}, { forceActiveProject: state.activeProject });
      setStatus('Innstillingene er lastet.', 'info');
      if (settingsApi && typeof settingsApi.refresh === 'function') {
        try {
          settingsApi.refresh({ force: true, notify: true });
        } catch (_) {}
      }
    } catch (error) {
      console.error(error);
      setStatus('Kunne ikke laste innstillingene.', 'error');
    }
    setFormDisabled(false);
  }

  function buildPayload(options = {}) {
    const colorsByProject =
      options.projectColors instanceof Map ? options.projectColors : state.colorsByProject;
    const activeProject = options.activeProject
      ? normalizeProjectName(options.activeProject)
      : ensureActiveProject();
    const payload = {
      activeProject,
      projectOrder: [],
      projects: {}
    };

    const seenProjects = new Set();
    const registerProject = projectName => {
      const normalized = normalizeProjectName(projectName);
      if (!normalized || seenProjects.has(normalized)) return;
      const storedPalette = colorsByProject.get(normalized);
      const normalizedPalette = normalizeProjectPalette(
        normalized,
        storedPalette || getProjectFallbackPalette(normalized)
      );
      const groupPalettes = cloneProjectPalette(normalizedPalette);
      payload.projects[normalized] = {
        groupPalettes,
        defaultColors: expandPalette(normalized, groupPalettes)
      };
      payload.projectOrder.push(normalized);
      seenProjects.add(normalized);
    };

    state.projectOrder.forEach(registerProject);
    if (colorsByProject && typeof colorsByProject.forEach === 'function') {
      colorsByProject.forEach((_, name) => registerProject(name));
    }
    state.colorsByProject.forEach((_, name) => registerProject(name));
    ['campus', 'kikora', 'annet'].forEach(registerProject);

    return payload;
  }

  async function persistSettings(method, body) {
    const url = resolveApiUrl();
    if (!url) {
      throw new Error('Ingen endepunkt for innstillinger');
    }
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json().catch(() => ({}));
    return payload && typeof payload === 'object' && payload.settings ? payload.settings : payload;
  }

  if (colorGroupsContainer) {
    colorGroupsContainer.addEventListener('click', event => {
      const button = event && event.target && event.target.closest('[data-save-group]');
      if (!button || !colorGroupsContainer.contains(button)) return;
      event.preventDefault();
      const groupId = button.getAttribute('data-save-group');
      const groupTitle = button.getAttribute('data-group-title') || button.dataset.groupTitle || '';
      void saveColorGroup(groupId, groupTitle);
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
  });

  if (settingsApi && typeof settingsApi.subscribe === 'function') {
    try {
      settingsApi.subscribe(snapshot => {
        if (!snapshot || typeof snapshot !== 'object') return;
        applySettings(snapshot, { forceActiveProject: state.activeProject });
        notifySettingsUpdated();
      });
    } catch (_) {}
  } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:settings-changed', event => {
      const detail = event && event.detail && event.detail.settings;
      if (detail && typeof detail === 'object') {
        applySettings(detail, { forceActiveProject: state.activeProject });
        notifySettingsUpdated();
      }
    });
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', handleProfileMessage);
  }

  applySettings({});
  if (typeof window !== 'undefined') {
    setTimeout(requestActiveProfileFromParent, 0);
  }
  loadSettings();
})();
