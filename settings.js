(function () {
  if (typeof document === 'undefined') return;
  const form = document.querySelector('[data-settings-form]');
  if (!form) return;

  const colorGroupsContainer = form.querySelector('[data-color-groups]');
  const statusElement = form.querySelector('[data-status]');
  const resetDatabaseButton = document.querySelector('[data-reset-database]');
  const viewDeletedButton = document.querySelector('[data-view-deleted]');
  const actionsStatusElement = document.querySelector('[data-actions-status]');
  const LOCAL_STORAGE_PREFIXES = ['examples_', 'mathvis:', 'mathVisuals:', 'svg-archive'];
  const LOCAL_STORAGE_KEYS = new Set(['archive_open_request', 'example_to_load']);

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
  const PROJECT_FALLBACKS = paletteConfig.PROJECT_FALLBACKS;
  const COLOR_SLOT_GROUPS = paletteConfig.COLOR_SLOT_GROUPS.map(group => ({
    groupId: group.groupId,
    title: group.title,
    description: group.description,
    groupIndex: Number.isInteger(group.groupIndex) ? group.groupIndex : undefined,
    colorRoles: Array.isArray(group.colorRoles)
      ? group.colorRoles.map(role => ({
          fillIndex: role.fillIndex,
          textIndex: role.textIndex,
          lineIndex: role.lineIndex
        }))
      : null,
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
  const HIDDEN_COLOR_GROUP_IDS = new Set(['fractions', 'figurtall']);
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
  const FALLBACK_CACHE = {
    base: null,
    groups: null
  };

  const settingsApi = resolveSettingsApi();
  const state = {
    palette: null,
    persistedPalette: null
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

  function collectGroupIndices(groupId) {
    const groups = new Set();
    const normalizedGroup = typeof groupId === 'string' ? groupId.trim().toLowerCase() : '';
    if (!normalizedGroup) return groups;
    const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === normalizedGroup);
    if (!group) return groups;
    groups.add(group.groupId);
    return groups;
  }

  function buildPaletteForSave(indices) {
    const targetGroups = indices instanceof Set ? indices : new Set(indices || []);
    const base = normalizePalette(state.persistedPalette || getFallbackPalette());
    if (!targetGroups.size) return cloneProjectPalette(base);
    const editingPalette = normalizePalette(state.palette || getFallbackPalette());
    const next = cloneProjectPalette(base);
    targetGroups.forEach(groupId => {
      const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === groupId);
      if (!group) return;
      const source = Array.isArray(editingPalette[group.groupId]) ? editingPalette[group.groupId] : [];
      next[group.groupId] = group.slots.map((slot, slotIndex) => {
        const color = source[slotIndex];
        const fallback = getFallbackColorForIndex(slot.index);
        return sanitizeColor(color) || fallback;
      });
    });
    return next;
  }

  function captureUnsavedChanges(excludedGroups) {
    const excludedSet = excludedGroups instanceof Set ? excludedGroups : new Set();
    const changes = new Map();
    const currentPalette = normalizePalette(state.palette || getFallbackPalette());
    const persistedPalette = normalizePalette(state.persistedPalette || getFallbackPalette());
    GROUP_IDS.forEach(groupId => {
      if (excludedSet.has(groupId)) return;
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
        changes.set(groupId, diff);
      }
    });
    return changes;
  }

  function restoreUnsavedChanges(changes) {
    if (!changes || typeof changes.forEach !== 'function') return;
    const currentPalette = normalizePalette(state.palette || getFallbackPalette());
    changes.forEach((values, groupId) => {
      const group = COLOR_SLOT_GROUPS.find(entry => entry.groupId === groupId);
      if (!group) return;
      const incoming = Array.isArray(values) ? values : [];
      const target = Array.isArray(currentPalette[groupId]) ? currentPalette[groupId].slice() : [];
      group.slots.forEach((slot, slotIndex) => {
        const nextColor = incoming[slotIndex];
        if (typeof nextColor === 'string' && nextColor) {
          target[slotIndex] = sanitizeColor(nextColor) || target[slotIndex] || getFallbackColorForIndex(slot.index);
        }
      });
      currentPalette[groupId] = target;
    });
    commitColors(currentPalette);
    syncBindings();
  }

  function normalizeGroupId(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
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
    const label = groupTitle && groupTitle.trim() ? groupTitle.trim() : 'gruppen';
    const groups = collectGroupIndices(normalizedId);
    if (!groups.size) {
      setStatus(`Ingen endringer å lagre for ${label}.`, 'info');
      return;
    }
    const editingPalette = normalizePalette(state.palette || getFallbackPalette());
    const persistedPalette = normalizePalette(state.persistedPalette || getFallbackPalette());
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
    const unsavedChanges = captureUnsavedChanges(groups);
    const colorsForSave = buildPaletteForSave(groups);
    setStatus(`Lagrer fargene for ${label}...`, 'info');
    setFormDisabled(true);
    try {
      const payload = buildPayload(colorsForSave);
      const snapshot = await persistSettings('PUT', payload);
      applySettings(snapshot || {});
      restoreUnsavedChanges(unsavedChanges);
      maybeRefreshSettingsApi(resolveApiUrl());
      const contrastStatus = buildContrastStatus(normalizedId, colorsForSave);
      const successMessage = `Fargene for ${label} er lagret.`;
      const contrastMessage = contrastStatus && contrastStatus.message ? ` ${contrastStatus.message}` : '';
      const tone = contrastStatus ? (contrastStatus.passes ? 'success' : 'warning') : 'success';
      setStatus(`${successMessage}${contrastMessage}`, tone);
      const groupMessage = `${label} er lagret.${contrastMessage}`;
      setGroupStatusMessage(normalizedId, groupMessage, tone);
    } catch (error) {
      console.error(error);
      const errorMessage = `Kunne ikke lagre fargene for ${label}.`;
      setStatus(errorMessage, 'error');
      setGroupStatusMessage(normalizedId, `Kunne ikke lagre ${label}.`, 'error');
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

  function normalizeRoleKey(value) {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return '';
    if (trimmed.startsWith('fill')) return 'fills';
    if (trimmed.startsWith('line')) return 'lines';
    if (trimmed.startsWith('edge') || trimmed.startsWith('kant')) return 'edges';
    if (trimmed.startsWith('angle') || trimmed.startsWith('vinkel')) return 'angles';
    return '';
  }

  function resolveSlotRole(slot) {
    const label = slot && typeof slot.label === 'string' ? slot.label.trim().toLowerCase() : '';
    if (!label) return '';
    if (label.includes('fyll')) return 'fills';
    if (label.includes('linje')) return 'lines';
    if (label.includes('kant')) return 'edges';
    if (label.includes('vinkel')) return 'angles';
    return '';
  }

  function extractFlatPalette(entry) {
    if (!entry) return null;
    if (Array.isArray(entry)) return entry;
    if (entry && typeof entry === 'object') {
      if (Array.isArray(entry.colors)) return entry.colors;
      if (Array.isArray(entry.palette)) return entry.palette;
      if (Array.isArray(entry.values)) return entry.values;
      if (entry.default != null) {
        const nested = extractFlatPalette(entry.default);
        if (nested && nested.length) return nested;
      }
      if (entry.fallback != null) {
        const nested = extractFlatPalette(entry.fallback);
        if (nested && nested.length) return nested;
      }
    }
    return null;
  }

  function collectRoleLists(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return {};
    const roles = {};
    Object.keys(entry).forEach(key => {
      const roleKey = normalizeRoleKey(key);
      if (!roleKey) return;
      const values = sanitizeColorList(entry[key], MAX_COLORS);
      if (values.length) {
        roles[roleKey] = values;
      }
    });
    return roles;
  }

  function buildRolePaletteSlots(group, roleLists, fallbackList) {
    const slotRoles = {};
    const fallback = Array.isArray(fallbackList) ? fallbackList : [];
    return group.slots.map((slot, slotIndex) => {
      const roleKey = resolveSlotRole(slot);
      if (roleKey && Array.isArray(roleLists[roleKey])) {
        const position = Number.isInteger(slotRoles[roleKey]) ? slotRoles[roleKey] : 0;
        const color = roleLists[roleKey][position];
        slotRoles[roleKey] = position + 1;
        if (color) return color;
      }
      return fallback[slotIndex];
    });
  }

  function resolveGroupPaletteEntry(group, entry) {
    if (Array.isArray(entry)) return entry;
    if (entry && typeof entry === 'object') {
      const roleLists = collectRoleLists(entry);
      const flat = extractFlatPalette(entry);
      if (Object.keys(roleLists).length) {
        return buildRolePaletteSlots(group, roleLists, flat);
      }
      if (flat && flat.length) {
        return flat;
      }
    }
    return [];
  }

  function buildRolePayloadForGroup(group, colors) {
    const lists = {};
    let hasRoles = false;
    let hasUnmatched = false;
    group.slots.forEach((slot, slotIndex) => {
      const roleKey = resolveSlotRole(slot);
      const color = colors[slotIndex];
      if (roleKey) {
        hasRoles = true;
        if (!lists[roleKey]) {
          lists[roleKey] = [];
        }
        lists[roleKey].push(color);
      } else if (color) {
        hasUnmatched = true;
      }
    });
    if (!hasRoles || hasUnmatched) return null;
    Object.keys(lists).forEach(key => {
      const values = sanitizeColorList(lists[key], MAX_COLORS);
      if (values.length) {
        lists[key] = values;
      } else {
        delete lists[key];
      }
    });
    return Object.keys(lists).length ? lists : null;
  }

  const CONTRAST_THRESHOLD_NORMAL_TEXT = 4.5;
  const CONTRAST_THRESHOLD_NON_TEXT = 3.0;

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
    return sanitizeColor(colors[index]) || getFallbackColorForIndex(index);
  }

  function evaluateContrastBetweenColors(colorA, colorB) {
    const ratio = calculateContrastRatioBetweenColors(colorA, colorB);
    if (ratio === null) return null;
    const display = formatContrastRatio(ratio);
    if (!display) return null;
    return {
      display,
      passes: ratio >= CONTRAST_THRESHOLD_NON_TEXT
    };
  }

  function formatContrastStatusText(label, evaluation) {
    if (!evaluation) {
      return `${label}: ikke tilgjengelig ❌`;
    }
    return `${label}: ${evaluation.display} ${evaluation.passes ? '✅' : '❌'}`;
  }

  function buildGraftegnerContrastMessage(fillIndex, edgeIndex, lineIndex) {
    const fillColor = resolveContrastColor(fillIndex);
    const edgeColor = resolveContrastColor(edgeIndex);
    const lineColor = resolveContrastColor(lineIndex);
    const between = evaluateContrastBetweenColors(fillColor, edgeColor);
    const fillOnWhite = evaluateContrastBetweenColors(fillColor, '#ffffff');
    const edgeOnWhite = evaluateContrastBetweenColors(edgeColor, '#ffffff');
    const lineOnWhite = evaluateContrastBetweenColors(lineColor, '#ffffff');
    const parts = [
      formatContrastStatusText('fyll/kant', between),
      formatContrastStatusText('fyll mot hvit', fillOnWhite),
      formatContrastStatusText('kant mot hvit', edgeOnWhite),
      formatContrastStatusText('linje mot hvit', lineOnWhite)
    ];
    return `Kontrast ${parts.join(' · ')}`;
  }

  function updateGraftegnerContrastRows() {
    if (!graftegnerContrastRows.length) return;
    graftegnerContrastRows.forEach(row => {
      if (!row) return;
      const fillIndex = Number(row.dataset.fillIndex);
      const edgeIndex = Number(row.dataset.edgeIndex);
      const lineIndex = Number(row.dataset.lineIndex);
      row.textContent = buildGraftegnerContrastMessage(fillIndex, edgeIndex, lineIndex);
    });
  }

  function getSanitizedFallbackBase() {
    const base = PROJECT_FALLBACKS.default || [];
    const sanitized = sanitizeColorList(base, MAX_COLORS);
    if (!sanitized.length) {
      const fallbackDefault = sanitizeColor((PROJECT_FALLBACKS.default && PROJECT_FALLBACKS.default[0]) || '#1F4DE2');
      sanitized.push(fallbackDefault || '#1F4DE2');
    }
    const cached = FALLBACK_CACHE.base;
    const hasChanged =
      !cached ||
      cached.length !== sanitized.length ||
      cached.some((value, index) => value !== sanitized[index]);
    if (hasChanged) {
      FALLBACK_CACHE.base = sanitized.slice();
      FALLBACK_CACHE.groups = null;
    }
    return sanitized.slice();
  }

  function buildFallbackGroupsFromBase(baseColors) {
    const sanitizedBase = Array.isArray(baseColors)
      ? sanitizeColorList(baseColors, MAX_COLORS)
      : [];
    const fallbackColors = sanitizedBase.length ? sanitizedBase : getSanitizedFallbackBase();
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

  function ensurePaletteShape(palette) {
    const shaped = {};
    const source = palette && typeof palette === 'object' ? palette : {};
    COLOR_SLOT_GROUPS.forEach(group => {
      const groupId = group.groupId;
      const entry = source[groupId];
      shaped[groupId] = Array.isArray(entry) ? entry : resolveGroupPaletteEntry(group, entry);
    });
    return shaped;
  }

  function cloneProjectPalette(palette) {
    const shaped = ensurePaletteShape(palette);
    const copy = {};
    GROUP_IDS.forEach(groupId => {
      const source = Array.isArray(shaped[groupId]) ? shaped[groupId] : [];
      copy[groupId] = source.slice(0, MAX_COLORS);
    });
    return copy;
  }

  function convertLegacyPalette(palette) {
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

  function getFallbackPalette() {
    if (!FALLBACK_CACHE.groups) {
      const base = getSanitizedFallbackBase();
      FALLBACK_CACHE.groups = buildFallbackGroupsFromBase(base);
    }
    return cloneProjectPalette(FALLBACK_CACHE.groups);
  }

  function sanitizePalette(palette) {
    const fallback = getFallbackPalette();
    const fallbackBase = getSanitizedFallbackBase();
    const shaped = ensurePaletteShape(palette);
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

  function normalizePalette(palette) {
    if (Array.isArray(palette)) {
      return sanitizePalette(convertLegacyPalette(palette));
    }
    if (palette && typeof palette === 'object') {
      return sanitizePalette(palette);
    }
    return getFallbackPalette();
  }

  function flattenPalette(palette, minimumLength = MIN_COLOR_SLOTS) {
    const normalized = normalizePalette(palette);
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
        const fallback = getFallbackColorForIndex(targetIndex);
        flattened[targetIndex] = color || fallback;
      });
    });
    const min = Number.isInteger(minimumLength) && minimumLength > 0 ? minimumLength : 0;
    const targetLength = Math.min(MAX_COLORS, Math.max(min, highestSlotIndex + 1));
    for (let index = 0; index < targetLength; index += 1) {
      if (!sanitizeColor(flattened[index])) {
        flattened[index] = getFallbackColorForIndex(index);
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

  function getFallbackColorForIndex(index) {
    const baseColors = getSanitizedFallbackBase();
    if (!baseColors.length) {
      return (PROJECT_FALLBACKS.default && PROJECT_FALLBACKS.default[0]) || '#1F4DE2';
    }
    const normalizedIndex = Number.isInteger(index) && index >= 0 ? index : 0;
    const meta = SLOT_META_BY_INDEX.get(normalizedIndex);
    if (meta) {
      if (!FALLBACK_CACHE.groups) {
        const base = getSanitizedFallbackBase();
        FALLBACK_CACHE.groups = buildFallbackGroupsFromBase(base);
      }
      const groups = FALLBACK_CACHE.groups || {};
      const groupColors = groups[meta.groupId] || [];
      const candidate = groupColors[meta.groupIndex];
      if (candidate) {
        return candidate;
      }
    }
    return baseColors[normalizedIndex % baseColors.length] || baseColors[0];
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

  function setActionsStatus(message, tone) {
    if (!actionsStatusElement) return;
    actionsStatusElement.textContent = message || '';
    if (message) {
      actionsStatusElement.dataset.status = tone || 'success';
    } else {
      actionsStatusElement.removeAttribute('data-status');
    }
  }

  function getLocalStorage() {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage || null;
    } catch (_) {
      return null;
    }
  }

  function shouldClearStorageKey(key) {
    if (!key || typeof key !== 'string') return false;
    if (LOCAL_STORAGE_KEYS.has(key)) return true;
    return LOCAL_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix));
  }

  function clearLocalStorageEntries() {
    const storage = getLocalStorage();
    if (!storage) return { ok: false, cleared: 0 };
    const keysToRemove = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (shouldClearStorageKey(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      try {
        storage.removeItem(key);
      } catch (_) {}
    });
    return { ok: true, cleared: keysToRemove.length };
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

  function commitColors(next) {
    const normalizedPalette = normalizePalette(next);
    state.palette = cloneProjectPalette(normalizedPalette);
    colors = flattenPalette(normalizedPalette, MIN_COLOR_SLOTS);
  }

  function ensureColorCapacity(index) {
    if (!Number.isInteger(index) || index < 0) return;
    const palette = normalizePalette(state.palette || getFallbackPalette());
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
      const fallback = getFallbackColorForIndex(slotIndex);
      if (colors[slotIndex] !== fallback) {
        colors[slotIndex] = fallback;
        updated = true;
      }
      assignColorToPalette(palette, slotIndex, fallback);
    }
    state.palette = cloneProjectPalette(palette);
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

  function setColorValue(index, value) {
    ensureColorCapacity(index);
    const fallback = getFallbackColorForIndex(index);
    const clean = sanitizeColor(value) || fallback;
    colors[index] = clean;
    const palette = normalizePalette(state.palette || getFallbackPalette());
    assignColorToPalette(palette, index, clean);
    state.palette = cloneProjectPalette(palette);
    updateBindingsForIndex(index, clean);
    updateGraftegnerContrastRows();
  }

  function handleColorInput(index, event) {
    if (!event || !event.target) return;
    ensureColorCapacity(index);
    const current = sanitizeColor(colors[index]) || getFallbackColorForIndex(index);
    const next = sanitizeColor(event.target.value) || current;
    setColorValue(index, next);
    clearStatus();
  }

  function handleHexBlur(index, event) {
    if (!event || !event.target) return;
    ensureColorCapacity(index);
    const next = sanitizeColor(event.target.value);
    if (next) {
      setColorValue(index, next);
    } else {
      const fallback = sanitizeColor(colors[index]) || getFallbackColorForIndex(index);
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

    item.appendChild(hexInput);
    item.appendChild(colorInput);

    registerSlotBinding(slot.index, { colorInput, hexInput });
    return item;
  }

  function createGraftegnerContrastField(fillIndex, edgeIndex, lineIndex) {
    const field = document.createElement('div');
    field.className = 'color-contrast-field';
    field.dataset.fillIndex = String(fillIndex);
    field.dataset.edgeIndex = String(edgeIndex);
    field.dataset.lineIndex = String(lineIndex);
    field.textContent = buildGraftegnerContrastMessage(fillIndex, edgeIndex, lineIndex);
    graftegnerContrastRows.push(field);
    return field;
  }

  function createGraftegnerPairRow(fillSlot, edgeSlot, lineSlot) {
    const row = document.createElement('div');
    row.className = 'color-pair-row';
    row.appendChild(createColorSlotElement(fillSlot));
    row.appendChild(createColorSlotElement(edgeSlot));
    row.appendChild(createColorSlotElement(lineSlot));
    row.appendChild(createGraftegnerContrastField(fillSlot.index, edgeSlot.index, lineSlot.index));
    return row;
  }

  function createGraftegnerHeaderRow() {
    const row = document.createElement('div');
    row.className = 'color-pair-row color-pair-row--header';
    const headers = ['Fyllfarger', 'Kantfarger', 'Linjefarger', 'Kontrastinfo'];
    headers.forEach(text => {
      const cell = document.createElement('div');
      cell.className = 'color-pair-row__heading';
      cell.textContent = text;
      row.appendChild(cell);
    });
    return row;
  }

  function createNkantHeaderRow() {
    const row = document.createElement('div');
    row.className = 'color-triple-row color-triple-row--header';
    const headers = ['Fyllfarger', 'Kantfarger', 'Vinkelfarger'];
    headers.forEach(text => {
      const cell = document.createElement('div');
      cell.className = 'color-pair-row__heading';
      cell.textContent = text;
      row.appendChild(cell);
    });
    return row;
  }

  function createNkantTripleRow(fillSlot, edgeSlot, angleSlot) {
    const row = document.createElement('div');
    row.className = 'color-triple-row';
    row.appendChild(createColorSlotElement(fillSlot));
    row.appendChild(createColorSlotElement(edgeSlot));
    row.appendChild(createColorSlotElement(angleSlot));
    return row;
  }

  function resolveNkantRoleTriples(group) {
    if (!group || !Array.isArray(group.slots)) return [];
    const triples = [];
    for (let slotIndex = 0; slotIndex < group.slots.length; slotIndex += 3) {
      const fillSlot = group.slots[slotIndex];
      const edgeSlot = group.slots[slotIndex + 1];
      const angleSlot = group.slots[slotIndex + 2];
      if (fillSlot && edgeSlot && angleSlot) {
        triples.push({ fillSlot, edgeSlot, angleSlot });
      }
    }
    return triples;
  }

  function resolveGraftegnerRoleTriples(group) {
    if (!group || !Array.isArray(group.slots)) return [];
    const triples = [];
    for (let slotIndex = 0; slotIndex < group.slots.length; slotIndex += 3) {
      const fillSlot = group.slots[slotIndex];
      const edgeSlot = group.slots[slotIndex + 1];
      const lineSlot = group.slots[slotIndex + 2];
      if (fillSlot && edgeSlot && lineSlot) {
        triples.push({ fillSlot, edgeSlot, lineSlot });
      }
    }
    return triples;
  }

  function appendSlotToTable(container, slotElement) {
    if (!container || !slotElement) return;
    container.appendChild(slotElement);
  }

  function buildColorLayout() {
    if (!colorGroupsContainer || slotBindings.size) return;

    COLOR_SLOT_GROUPS.forEach(group => {
      const normalizedGroupId = normalizeGroupId(group.groupId);
      if (normalizedGroupId && HIDDEN_COLOR_GROUP_IDS.has(normalizedGroupId)) {
        return;
      }
      const section = document.createElement('section');
      section.className = 'color-group';

      const header = document.createElement('div');
      header.className = 'color-group__header';

      const title = document.createElement('h3');
      title.className = 'color-group__title';
      title.textContent = group.title;
      header.appendChild(title);
      if (group.description) {
        const description = document.createElement('p');
        description.className = 'color-group__description';
        description.textContent = group.description;
        header.appendChild(description);
      }

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
        const triples = resolveGraftegnerRoleTriples(group);
        if (triples.length) {
          appendSlotToTable(table, createGraftegnerHeaderRow());
          triples.forEach(triple => {
            appendSlotToTable(table, createGraftegnerPairRow(triple.fillSlot, triple.edgeSlot, triple.lineSlot));
          });
        } else {
          group.slots.forEach(slot => {
            appendSlotToTable(table, createColorSlotElement(slot));
          });
        }
      } else if (normalizedGroupId === 'nkant') {
        const triples = resolveNkantRoleTriples(group);
        if (triples.length) {
          appendSlotToTable(table, createNkantHeaderRow());
          triples.forEach(triple => {
            appendSlotToTable(table, createNkantTripleRow(triple.fillSlot, triple.edgeSlot, triple.angleSlot));
          });
        } else {
          group.slots.forEach(slot => {
            appendSlotToTable(table, createColorSlotElement(slot));
          });
        }
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

  function renderColors() {
    if (!colorGroupsContainer) return;
    buildColorLayout();
    const palette = state.palette || getFallbackPalette();
    commitColors(palette);
    syncBindings();
  }

  function applySettings(snapshot) {
    const data = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const paletteData = data.groupPalettes || data.defaultColors || data;
    const normalizedPalette = normalizePalette(paletteData);
    const cloned = cloneProjectPalette(normalizedPalette);
    state.palette = cloneProjectPalette(cloned);
    state.persistedPalette = cloneProjectPalette(cloned);
    renderColors();
  }

  function normalizeApiUrl(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  function getSettingsApiUrl() {
    if (settingsApi && typeof settingsApi.getApiUrl === 'function') {
      try {
        return normalizeApiUrl(settingsApi.getApiUrl());
      } catch (_) {}
    }
    return null;
  }

  function shouldRefreshSettingsApi(sourceUrl) {
    if (!settingsApi || typeof settingsApi.refresh !== 'function') return false;
    const settingsApiUrl = getSettingsApiUrl();
    const normalizedSource = normalizeApiUrl(sourceUrl);
    if (!settingsApiUrl) {
      return !normalizedSource;
    }
    if (!normalizedSource) return true;
    return settingsApiUrl !== normalizedSource;
  }

  function maybeRefreshSettingsApi(sourceUrl) {
    if (!shouldRefreshSettingsApi(sourceUrl)) return;
    try {
      settingsApi.refresh({ force: true, notify: true });
    } catch (_) {}
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
      applySettings(snapshot || {});
      setStatus('Innstillingene er lastet.', 'info');
      maybeRefreshSettingsApi(url);
    } catch (error) {
      console.error(error);
      setStatus('Kunne ikke laste innstillingene.', 'error');
    }
    setFormDisabled(false);
  }

  function buildPayload(palette) {
    const normalizedPalette = normalizePalette(palette || state.palette || getFallbackPalette());
    const groupPalettes = {};
    COLOR_SLOT_GROUPS.forEach(group => {
      const colors = Array.isArray(normalizedPalette[group.groupId]) ? normalizedPalette[group.groupId] : [];
      const rolePayload = buildRolePayloadForGroup(group, colors);
      groupPalettes[group.groupId] = rolePayload || colors.slice(0, MAX_COLORS);
    });
    return {
      groupPalettes,
      defaultColors: flattenPalette(groupPalettes, MIN_COLOR_SLOTS)
    };
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

  if (resetDatabaseButton) {
    resetDatabaseButton.addEventListener('click', event => {
      event.preventDefault();
      const confirmation = typeof window !== 'undefined'
        ? window.confirm('Dette sletter lokale data for eksempler, arkiv og farger. Vil du fortsette?')
        : false;
      if (!confirmation) return;
      const result = clearLocalStorageEntries();
      if (settingsApi && typeof settingsApi.resetSettings === 'function') {
        try {
          settingsApi.resetSettings();
        } catch (_) {}
      }
      if (!result.ok) {
        setActionsStatus('Kunne ikke slette lokale data i nettleseren.', 'error');
        return;
      }
      setActionsStatus(
        result.cleared > 0
          ? `Lokale data ble slettet (${result.cleared} oppføringer). Oppdater siden om nødvendig.`
          : 'Fant ingen lokale data å slette.',
        'success'
      );
    });
  }

  if (viewDeletedButton) {
    viewDeletedButton.addEventListener('click', event => {
      event.preventDefault();
      if (typeof window === 'undefined') return;
      const targetUrl = new URL('svg-arkiv.html', window.location.href);
      targetUrl.searchParams.set('trash', '1');
      window.location.assign(targetUrl.toString());
    });
  }

  if (settingsApi && typeof settingsApi.subscribe === 'function') {
    try {
      settingsApi.subscribe(snapshot => {
        if (!snapshot || typeof snapshot !== 'object') return;
        applySettings(snapshot);
        notifySettingsUpdated();
      });
    } catch (_) {}
  } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:settings-changed', event => {
      const detail = event && event.detail && event.detail.settings;
      if (detail && typeof detail === 'object') {
        applySettings(detail);
        notifySettingsUpdated();
      }
    });
  }

  applySettings({});
  loadSettings();
})();
