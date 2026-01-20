const MAX_COLORS = 49;
const DEFAULT_PROJECT = 'default';

const PROJECT_FALLBACKS = deepFreeze({
  default: [
    '#DC6A4B',
    '#6B1F0B',
    '#C14F30',
    '#528BFF',
    '#002266',
    '#155EEF',
    '#4F9566',
    '#000000',
    '#027A48',
    '#13A2B6',
    '#04343A',
    '#B8325D',
    '#DC5D85',
    '#400115',
    '#B8325D',
    '#9780C0',
    '#190A35',
    '#674D96'
  ]
});

const RAW_COLOR_SLOT_GROUPS = [
  {
    groupId: 'graftegner',
    title: 'Felles farger',
    description:
      'Farger som brukes av graftegner, diagram, brøksirkler, brøkfigurer, tallfigurer, kvikkbilder, tenkeblokker, brøkvegg og 3D-figurer.',
    colorRoles: [
      { fillIndex: 0, lineIndex: 1 },
      { fillIndex: 3, lineIndex: 4 },
      { fillIndex: 6, lineIndex: 7 },
      { fillIndex: 9, lineIndex: 10 },
      { fillIndex: 12, lineIndex: 13 },
      { fillIndex: 15, lineIndex: 16 }
    ],
    slots: [
      { index: 0, label: 'Fyll 1', description: 'Fyllfarge til fargesett 1.' },
      { index: 1, label: 'Kant 1', description: 'Kantfarge til fargesett 1.' },
      { index: 2, label: 'Linje 1', description: 'Linjefarge for grafer i fargesett 1.' },
      { index: 3, label: 'Fyll 2', description: 'Fyllfarge til fargesett 2.' },
      { index: 4, label: 'Kant 2', description: 'Kantfarge til fargesett 2.' },
      { index: 5, label: 'Linje 2', description: 'Linjefarge for grafer i fargesett 2.' },
      { index: 6, label: 'Fyll 3', description: 'Fyllfarge til fargesett 3.' },
      { index: 7, label: 'Kant 3', description: 'Kantfarge til fargesett 3.' },
      { index: 8, label: 'Linje 3', description: 'Linjefarge for grafer i fargesett 3.' },
      { index: 9, label: 'Fyll 4', description: 'Fyllfarge til fargesett 4.' },
      { index: 10, label: 'Kant 4', description: 'Kantfarge til fargesett 4.' },
      { index: 11, label: 'Linje 4', description: 'Linjefarge for grafer i fargesett 4.' },
      { index: 12, label: 'Fyll 5', description: 'Fyllfarge til fargesett 5.' },
      { index: 13, label: 'Kant 5', description: 'Kantfarge til fargesett 5.' },
      { index: 14, label: 'Linje 5', description: 'Linjefarge for grafer i fargesett 5.' },
      { index: 15, label: 'Fyll 6', description: 'Fyllfarge til fargesett 6.' },
      { index: 16, label: 'Kant 6', description: 'Kantfarge til fargesett 6.' },
      { index: 17, label: 'Linje 6', description: 'Linjefarge for grafer i fargesett 6.' }
    ]
  },
  {
    groupId: 'nkant',
    title: 'nKant',
    description: 'Farger for linjer, vinkler og fyll i nKant.',
    slots: [
      { index: 30, label: 'Fyll 1', description: 'Fyllfarge til fargesett 1.' },
      { index: 31, label: 'Linje 1', description: 'Linjefarge til fargesett 1.' },
      { index: 32, label: 'Vinkel 1', description: 'Vinkelfarge til fargesett 1.' },
      { index: 33, label: 'Fyll 2', description: 'Fyllfarge til fargesett 2.' },
      { index: 34, label: 'Linje 2', description: 'Linjefarge til fargesett 2.' },
      { index: 35, label: 'Vinkel 2', description: 'Vinkelfarge til fargesett 2.' },
      { index: 36, label: 'Fyll 3', description: 'Fyllfarge til fargesett 3.' },
      { index: 37, label: 'Linje 3', description: 'Linjefarge til fargesett 3.' },
      { index: 38, label: 'Vinkel 3', description: 'Vinkelfarge til fargesett 3.' }
    ]
  },
  {
    groupId: 'arealmodell',
    title: 'Arealmodell',
    description: 'Farger for rutene i arealmodellen.',
    slots: [
      { index: 21, label: 'Farge 1', description: 'Første rute i arealmodellen.' },
      { index: 22, label: 'Farge 2', description: 'Andre rute i arealmodellen.' },
      { index: 23, label: 'Farge 3', description: 'Tredje rute i arealmodellen.' },
      { index: 24, label: 'Farge 4', description: 'Fjerde rute i arealmodellen.' }
    ]
  }
];

function deepFreeze(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  Object.getOwnPropertyNames(value).forEach(key => {
    const property = value[key];
    if (property && typeof property === 'object' && !Object.isFrozen(property)) {
      deepFreeze(property);
    }
  });
  return Object.freeze(value);
}

function cloneSlots(slots, groupId) {
  if (!Array.isArray(slots)) return [];
  return slots
    .map((slot, slotIndex) => {
      const index = Number.isInteger(slot && slot.index) ? Number(slot.index) : slotIndex;
      return {
        index: index < 0 ? slotIndex : index,
        label: slot && slot.label ? String(slot.label) : `Farge ${slotIndex + 1}`,
        description: slot && slot.description ? String(slot.description) : null,
        groupId,
        groupIndex: slotIndex
      };
    })
    .filter(slot => Number.isInteger(slot.index) && slot.index >= 0);
}

const COLOR_SLOT_GROUPS = deepFreeze(
  RAW_COLOR_SLOT_GROUPS.map((group, groupIndex) => {
    const normalizedId =
      group && typeof group.groupId === 'string' ? group.groupId.trim().toLowerCase() : `gruppe-${groupIndex + 1}`;
    const groupId = normalizedId || `gruppe-${groupIndex + 1}`;
    const slots = cloneSlots(group && group.slots, groupId);
    return deepFreeze({
      groupId,
      title: group && group.title ? String(group.title) : '',
      description: group && group.description ? String(group.description) : '',
      slots,
      groupIndex
    });
  })
);

const COLOR_GROUP_IDS = COLOR_SLOT_GROUPS.map(group => group.groupId);
const GROUP_SLOT_INDICES = {};
COLOR_SLOT_GROUPS.forEach(group => {
  GROUP_SLOT_INDICES[group.groupId] = group.slots.map(slot => slot.index);
});
const MIN_COLOR_SLOTS = COLOR_SLOT_GROUPS.reduce((total, group) => total + group.slots.length, 0);
const DEFAULT_GROUP_ORDER = deepFreeze(COLOR_GROUP_IDS.slice());
const DEFAULT_PROJECT_ORDER = deepFreeze(['default']);

const PALETTE_CONFIG = deepFreeze({
  MAX_COLORS,
  DEFAULT_PROJECT,
  PROJECT_FALLBACKS,
  COLOR_SLOT_GROUPS,
  COLOR_GROUP_IDS,
  GROUP_SLOT_INDICES,
  MIN_COLOR_SLOTS,
  DEFAULT_GROUP_ORDER,
  DEFAULT_PROJECT_ORDER
});

function normalizeIdentifier(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  return trimmed || '';
}

function sanitizeColor(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(trimmed);
  if (!match) {
    return trimmed.startsWith('var(') ? trimmed : null;
  }
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map(ch => ch + ch)
      .join('');
  } else if (hex.length === 4) {
    hex = hex
      .split('')
      .slice(0, 3)
      .map(ch => ch + ch)
      .join('');
  } else if (hex.length === 8) {
    hex = hex.slice(0, 6);
  }
  return `#${hex.toLowerCase()}`;
}

function sanitizePalette(values, limit) {
  if (!Array.isArray(values)) return [];
  const sanitized = [];
  const maxSize = Number.isInteger(limit) && limit > 0 ? limit : undefined;
  for (const value of values) {
    const clean = sanitizeColor(value);
    if (clean) {
      sanitized.push(clean);
      if (maxSize && sanitized.length >= maxSize) {
        break;
      }
    }
  }
  return sanitized;
}

function ensurePalette(base, fallback, count) {
  const basePalette = sanitizePalette(base);
  const fallbackPalette = sanitizePalette(fallback);
  if (!Number.isFinite(count) || count <= 0) {
    if (basePalette.length) return basePalette.slice();
    if (fallbackPalette.length) return fallbackPalette.slice();
    return basePalette.length ? basePalette.slice() : fallbackPalette.slice();
  }
  const size = Math.max(1, Math.trunc(count));
  const result = [];
  for (let index = 0; index < size; index += 1) {
    const primary = basePalette[index];
    if (typeof primary === 'string' && primary) {
      result.push(primary);
      continue;
    }
    if (fallbackPalette.length) {
      const fallbackColor = fallbackPalette[index % fallbackPalette.length];
      if (typeof fallbackColor === 'string' && fallbackColor) {
        result.push(fallbackColor);
        continue;
      }
    }
    if (basePalette.length) {
      const cycled = basePalette[index % basePalette.length];
      if (typeof cycled === 'string' && cycled) {
        result.push(cycled);
      }
    }
  }
  if (!result.length && fallbackPalette.length) {
    result.push(fallbackPalette[0]);
  }
  return result;
}

function getGlobalScopeCandidates(scope) {
  const list = [];
  if (scope && typeof scope === 'object') {
    list.push(scope);
  }
  if (typeof globalThis !== 'undefined') {
    list.push(globalThis);
  }
  if (typeof window !== 'undefined') {
    list.push(window);
  }
  if (typeof global !== 'undefined') {
    list.push(global);
  }
  return list;
}

function defaultGetPaletteApi(scope) {
  const scopes = getGlobalScopeCandidates(scope);
  for (const candidate of scopes) {
    if (!candidate || typeof candidate !== 'object') continue;
    const api = candidate.MathVisualsPalette;
    if (api && typeof api.getGroupPalette === 'function') {
      return api;
    }
  }
  return null;
}

function defaultGetThemeApi(scope) {
  const scopes = getGlobalScopeCandidates(scope);
  for (const candidate of scopes) {
    if (!candidate || typeof candidate !== 'object') continue;
    const api = candidate.MathVisualsTheme;
    if (api && typeof api === 'object') {
      return api;
    }
  }
  return null;
}

function getProjectFallbackPalette(projectName, config = PALETTE_CONFIG) {
  const projectFallbacks = (config && config.PROJECT_FALLBACKS) || PROJECT_FALLBACKS;
  const defaultProject = normalizeIdentifier((config && config.DEFAULT_PROJECT) || DEFAULT_PROJECT);
  const normalized = normalizeIdentifier(projectName);
  const direct = sanitizePalette(projectFallbacks[normalized]);
  if (direct.length) return direct;
  const defaultPalette = sanitizePalette(projectFallbacks[defaultProject]);
  if (defaultPalette.length) return defaultPalette;
  const globalDefault = sanitizePalette(projectFallbacks.default);
  if (globalDefault.length) return globalDefault;
  return sanitizePalette(PROJECT_FALLBACKS.default);
}

function createPaletteService(options = {}) {
  const config = options && typeof options === 'object' && options.config ? options.config : PALETTE_CONFIG;
  const groupIds = Array.isArray(config.COLOR_GROUP_IDS) && config.COLOR_GROUP_IDS.length
    ? config.COLOR_GROUP_IDS.map(normalizeIdentifier).filter(Boolean)
    : COLOR_GROUP_IDS.slice();
  const groupSlotIndexMap = {};
  const configGroupIndices = config.GROUP_SLOT_INDICES || GROUP_SLOT_INDICES;
  groupIds.forEach(groupId => {
    const indices = Array.isArray(configGroupIndices[groupId])
      ? configGroupIndices[groupId].slice()
      : Array.isArray(GROUP_SLOT_INDICES[groupId])
      ? GROUP_SLOT_INDICES[groupId].slice()
      : [];
    groupSlotIndexMap[groupId] = indices;
  });
  const maxColors = Number.isInteger(config.MAX_COLORS) && config.MAX_COLORS > 0 ? config.MAX_COLORS : MAX_COLORS;

  const normalizedProfiles = new Map();
  if (options && typeof options.profiles === 'object' && options.profiles) {
    Object.entries(options.profiles).forEach(([profileKey, profileValue]) => {
      const normalizedProfileId = normalizeIdentifier(
        profileValue && typeof profileValue === 'object' && profileValue.id ? profileValue.id : profileKey
      );
      if (!normalizedProfileId) return;
      const groups = {};
      const rawGroups =
        profileValue && typeof profileValue === 'object'
          ? profileValue.groups || profileValue.groupPalettes || {}
          : {};
      Object.entries(rawGroups).forEach(([groupKey, colors]) => {
        const normalizedGroupId = normalizeIdentifier(groupKey);
        if (!normalizedGroupId || !groupIds.includes(normalizedGroupId)) return;
        const limit = (groupSlotIndexMap[normalizedGroupId] || []).length || maxColors;
        const sanitized = sanitizePalette(colors, limit);
        if (sanitized.length) {
          groups[normalizedGroupId] = sanitized;
        }
      });
      const palettes = {};
      const rawPalettes =
        profileValue && typeof profileValue === 'object'
          ? profileValue.palettes || profileValue.palette || {}
          : {};
      Object.entries(rawPalettes).forEach(([kindKey, colors]) => {
        const normalizedKind = normalizeIdentifier(kindKey);
        if (!normalizedKind) return;
        const sanitized = sanitizePalette(colors, maxColors);
        if (sanitized.length) {
          palettes[normalizedKind] = sanitized;
        }
      });
      const fallbacks = {};
      const rawFallbacks =
        profileValue && typeof profileValue === 'object'
          ? profileValue.fallbacks || profileValue.groupFallbacks || {}
          : {};
      Object.entries(rawFallbacks).forEach(([groupKey, kinds]) => {
        const normalizedGroupId = normalizeIdentifier(groupKey) || groupKey;
        if (!normalizedGroupId) return;
        const normalizedKinds = Array.isArray(kinds)
          ? kinds.map(normalizeIdentifier).filter(Boolean)
          : [];
        if (normalizedKinds.length) {
          fallbacks[normalizedGroupId] = normalizedKinds;
        }
      });
      normalizedProfiles.set(normalizedProfileId, {
        id: profileValue && profileValue.id ? profileValue.id : normalizedProfileId,
        groups,
        palettes,
        fallbacks
      });
    });
  }

  const defaultProfileId = normalizeIdentifier(options && options.defaultProfile ? options.defaultProfile : '');
  const groupFallbacks = {};
  if (options && typeof options.groupFallbacks === 'object' && options.groupFallbacks) {
    Object.entries(options.groupFallbacks).forEach(([groupKey, kinds]) => {
      const normalizedGroupId = normalizeIdentifier(groupKey) || groupKey;
      if (!normalizedGroupId) return;
      const normalizedKinds = Array.isArray(kinds)
        ? kinds.map(normalizeIdentifier).filter(Boolean)
        : [];
      if (normalizedKinds.length) {
        groupFallbacks[normalizedGroupId] = normalizedKinds;
      }
    });
  }

  const legacyPaletteMap = new Map();
  let legacyPaletteHandler = null;
  if (options && options.legacyPalettes) {
    if (typeof options.legacyPalettes === 'function') {
      legacyPaletteHandler = options.legacyPalettes;
    } else if (typeof options.legacyPalettes === 'object') {
      Object.entries(options.legacyPalettes).forEach(([legacyKey, value]) => {
        const normalizedLegacyId = normalizeIdentifier(legacyKey);
        if (!normalizedLegacyId) return;
        if (typeof value === 'function') {
          legacyPaletteMap.set(normalizedLegacyId, value);
          return;
        }
        if (Array.isArray(value)) {
          const sanitized = sanitizePalette(value, maxColors);
          if (sanitized.length) {
            legacyPaletteMap.set(normalizedLegacyId, sanitized);
          }
          return;
        }
        if (value && typeof value === 'object') {
          const perProfile = {};
          Object.entries(value).forEach(([profileKey, paletteValues]) => {
            const normalizedProfileId = normalizeIdentifier(profileKey) || profileKey;
            const sanitized = sanitizePalette(paletteValues, maxColors);
            if (sanitized.length) {
              perProfile[normalizedProfileId] = sanitized;
            }
          });
          if (Object.keys(perProfile).length) {
            legacyPaletteMap.set(normalizedLegacyId, perProfile);
          }
        }
      });
    }
  }

  const paletteApiGetter =
    typeof options.getPaletteApi === 'function' ? options.getPaletteApi : defaultGetPaletteApi;
  const themeApiGetter = typeof options.getThemeApi === 'function' ? options.getThemeApi : defaultGetThemeApi;

  function resolveFallbackOrder(groupId, profile, explicitFallbackKinds) {
    const order = [];
    const append = list => {
      if (!Array.isArray(list)) return;
      list.forEach(kind => {
        const normalizedKind = normalizeIdentifier(kind);
        if (!normalizedKind) return;
        if (!order.includes(normalizedKind)) {
          order.push(normalizedKind);
        }
      });
    };
    append(explicitFallbackKinds);
    if (profile && profile.fallbacks) {
      append(profile.fallbacks[groupId]);
      append(profile.fallbacks.default);
    }
    append(groupFallbacks[groupId]);
    append(groupFallbacks.default);
    return order;
  }

  function selectProfilePalette(profileId, groupId, fallbackKinds) {
    const normalizedProfileId = normalizeIdentifier(profileId);
    if (!normalizedProfileId) return null;
    const profile = normalizedProfiles.get(normalizedProfileId);
    if (!profile) return null;
    const direct = profile.groups[groupId];
    if (Array.isArray(direct) && direct.length) {
      return direct.slice();
    }
    const fallbackOrder = resolveFallbackOrder(groupId, profile, fallbackKinds);
    for (const kind of fallbackOrder) {
      const palette = profile.palettes[kind];
      if (Array.isArray(palette) && palette.length) {
        return palette.slice();
      }
    }
    return null;
  }

  function selectLegacyPalette(legacyId, profileId) {
    const normalizedLegacyId = normalizeIdentifier(legacyId);
    if (!normalizedLegacyId) return null;
    const entry = legacyPaletteMap.get(normalizedLegacyId);
    if (!entry) return null;
    if (typeof entry === 'function') {
      try {
        const result = entry({ legacyId: normalizedLegacyId, profile: profileId });
        const sanitized = sanitizePalette(result, maxColors);
        if (sanitized.length) {
          return sanitized;
        }
      } catch (_) {}
      return null;
    }
    if (Array.isArray(entry)) {
      return entry.slice();
    }
    if (entry && typeof entry === 'object') {
      const normalizedProfileId = normalizeIdentifier(profileId);
      if (normalizedProfileId && Array.isArray(entry[normalizedProfileId]) && entry[normalizedProfileId].length) {
        return entry[normalizedProfileId].slice();
      }
      if (Array.isArray(entry.default) && entry.default.length) {
        return entry.default.slice();
      }
      if (Array.isArray(entry['']) && entry[''].length) {
        return entry[''].slice();
      }
    }
    return null;
  }

  function resolveGroupPalette(options = {}) {
    const opts = options && typeof options === 'object' ? options : {};
    const groupId = normalizeIdentifier(opts.groupId || opts.group);
    const count = Number.isFinite(opts.count) && opts.count > 0 ? Math.trunc(opts.count) : undefined;
    const project = typeof opts.project === 'string' && opts.project ? opts.project : undefined;
    const explicitFallback = Array.isArray(opts.fallback) ? sanitizePalette(opts.fallback, count || maxColors) : [];
    let fallbackPalette = explicitFallback;
    if (!fallbackPalette.length) {
      fallbackPalette = getProjectFallbackPalette(project, config);
    }
    if (!fallbackPalette.length) {
      fallbackPalette = getProjectFallbackPalette(config.DEFAULT_PROJECT, config);
    }
    if (!fallbackPalette.length) {
      fallbackPalette = sanitizePalette(PROJECT_FALLBACKS.default, maxColors);
    }

    if (!groupId) {
      return ensurePalette([], fallbackPalette, count);
    }

    const scope = opts.scope;
    const paletteApi = opts.paletteApi || paletteApiGetter(scope);
    const themeApi = opts.themeApi || themeApiGetter(scope);
    const requestedProfile = opts.profile === null ? '' : normalizeIdentifier(opts.profile);
    const profileId = requestedProfile || defaultProfileId;
    const fallbackKinds = Array.isArray(opts.fallbackKinds)
      ? opts.fallbackKinds.map(normalizeIdentifier).filter(Boolean)
      : undefined;

    if (paletteApi && typeof paletteApi.getGroupPalette === 'function') {
      try {
        const palette = paletteApi.getGroupPalette(groupId, {
          count,
          project,
          settings: opts.settings
        });
        if (Array.isArray(palette) && palette.length) {
          return ensurePalette(palette, fallbackPalette, count);
        }
      } catch (_) {}
    }

    if (themeApi && typeof themeApi.getGroupPalette === 'function') {
      try {
        const palette = themeApi.getGroupPalette(groupId, count, project ? { project } : undefined);
        if (Array.isArray(palette) && palette.length) {
          return ensurePalette(palette, fallbackPalette, count);
        }
      } catch (_) {}
    }

    let profilePalette = null;
    if (profileId) {
      profilePalette = selectProfilePalette(profileId, groupId, fallbackKinds);
    }
    if (!profilePalette && requestedProfile && defaultProfileId && requestedProfile !== defaultProfileId) {
      profilePalette = selectProfilePalette(defaultProfileId, groupId, fallbackKinds);
    }
    if (!profilePalette && !requestedProfile && defaultProfileId) {
      profilePalette = selectProfilePalette(defaultProfileId, groupId, fallbackKinds);
    }
    if (profilePalette && profilePalette.length) {
      return ensurePalette(profilePalette, fallbackPalette, count);
    }

    const legacyId = normalizeIdentifier(opts.legacyPaletteId);
    if (legacyId) {
      if (themeApi && typeof themeApi.getPalette === 'function') {
        try {
          const palette = themeApi.getPalette(legacyId, count, {
            fallbackKinds,
            project
          });
          if (Array.isArray(palette) && palette.length) {
            return ensurePalette(palette, fallbackPalette, count);
          }
        } catch (_) {}
      }
      const legacyPalette = selectLegacyPalette(legacyId, profileId || defaultProfileId || '');
      if (legacyPalette && legacyPalette.length) {
        return ensurePalette(legacyPalette, fallbackPalette, count);
      }
      if (legacyPaletteHandler) {
        try {
          const result = legacyPaletteHandler(legacyId, {
            profile: profileId || defaultProfileId || null,
            count,
            project,
            fallbackKinds
          });
          const sanitized = sanitizePalette(result, count || maxColors);
          if (sanitized.length) {
            return ensurePalette(sanitized, fallbackPalette, count);
          }
        } catch (_) {}
      }
    }

    return ensurePalette([], fallbackPalette, count);
  }

  return {
    config,
    ensurePalette: (base, fallback, count) => ensurePalette(base, fallback, count),
    resolveGroupPalette,
    getGroupPalette: (groupId, opts = {}) =>
      resolveGroupPalette(Object.assign({}, opts, { groupId })),
    getProjectFallbackPalette: projectName => getProjectFallbackPalette(projectName, config),
    getProfilePalette(profileId, groupId, opts = {}) {
      const fallbackKinds = Array.isArray(opts.fallbackKinds)
        ? opts.fallbackKinds.map(normalizeIdentifier).filter(Boolean)
        : undefined;
      const palette = selectProfilePalette(profileId, normalizeIdentifier(groupId), fallbackKinds);
      return Array.isArray(palette) ? palette.slice() : [];
    }
  };
}

const defaultPaletteService = createPaletteService();

function resolveGroupPalette(options) {
  return defaultPaletteService.resolveGroupPalette(options);
}

export { COLOR_GROUP_IDS, COLOR_SLOT_GROUPS, DEFAULT_GROUP_ORDER, DEFAULT_PROJECT_ORDER, GROUP_SLOT_INDICES, MIN_COLOR_SLOTS, PALETTE_CONFIG, PROJECT_FALLBACKS, createPaletteService, ensurePalette, getProjectFallbackPalette, resolveGroupPalette };
//# sourceMappingURL=index.js.map
