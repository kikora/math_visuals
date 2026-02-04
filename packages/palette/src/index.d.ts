export interface PaletteSlot {
  index: number;
  label: string;
  description: string | null;
  groupId: string;
  groupIndex: number;
}

export interface PaletteGroup {
  groupId: string;
  title: string;
  description: string;
  slots: readonly PaletteSlot[];
  groupIndex: number;
}

export interface PaletteConfig {
  MAX_COLORS: number;
  DEFAULT_PROJECT: string;
  PROJECT_FALLBACKS: Readonly<Record<string, readonly string[]>>;
  COLOR_SLOT_GROUPS: readonly PaletteGroup[];
  COLOR_GROUP_IDS: readonly string[];
  GROUP_SLOT_INDICES: Readonly<Record<string, readonly number[]>>;
  MIN_COLOR_SLOTS: number;
  DEFAULT_GROUP_ORDER: readonly string[];
  DEFAULT_PROJECT_ORDER: readonly string[];
}

export interface PaletteProfileDefinition {
  id?: string;
  groups?: Record<string, readonly string[]>;
  palettes?: Record<string, readonly string[]>;
  fallbacks?: Record<string, readonly string[]>;
  groupPalettes?: Record<string, readonly string[]>;
  groupFallbacks?: Record<string, readonly string[]>;
  palette?: Record<string, readonly string[]>;
}

export interface LegacyPaletteResolverContext {
  legacyId: string;
  profile: string | null;
  count?: number;
  project?: string;
  fallbackKinds?: readonly string[];
}

export type LegacyPaletteResolver = (
  legacyId: string,
  context: LegacyPaletteResolverContext
) => Iterable<string> | null | undefined;

export interface PaletteServiceOptions {
  config?: PaletteConfig;
  defaultProfile?: string;
  profiles?: Record<string, PaletteProfileDefinition>;
  groupFallbacks?: Record<string, readonly string[]>;
  legacyPalettes?:
    | Record<string, readonly string[] | Record<string, readonly string[]> | LegacyPaletteResolver>
    | LegacyPaletteResolver;
  getPaletteApi?: (scope?: unknown) =>
    | { getGroupPalette?: (groupId: string, options?: Record<string, unknown>) => Iterable<string> | null | undefined }
    | null;
  getThemeApi?: (scope?: unknown) =>
    | {
        getGroupPalette?: (
          groupId: string,
          count?: number,
          options?: Record<string, unknown>
        ) => Iterable<string> | null | undefined;
        getPalette?: (
          legacyId: string,
          count?: number,
          options?: Record<string, unknown>
        ) => Iterable<string> | null | undefined;
      }
    | null;
}

export interface ResolveGroupPaletteOptions {
  groupId?: string;
  group?: string;
  count?: number;
  project?: string;
  profile?: string | null;
  legacyPaletteId?: string;
  fallback?: Iterable<string> | null;
  fallbackKinds?: readonly string[];
  settings?: unknown;
  scope?: unknown;
  paletteApi?: { getGroupPalette?: (groupId: string, options?: Record<string, unknown>) => Iterable<string> | null | undefined } | null;
  themeApi?: {
    getGroupPalette?: (
      groupId: string,
      count?: number,
      options?: Record<string, unknown>
    ) => Iterable<string> | null | undefined;
    getPalette?: (
      legacyId: string,
      count?: number,
      options?: Record<string, unknown>
    ) => Iterable<string> | null | undefined;
  } | null;
}

export interface PaletteService {
  readonly config: PaletteConfig;
  ensurePalette(base: Iterable<string> | null | undefined, fallback: Iterable<string> | null | undefined, count?: number): string[];
  resolveGroupPalette(options: ResolveGroupPaletteOptions): string[];
  getGroupPalette(groupId: string, options?: Omit<ResolveGroupPaletteOptions, 'groupId' | 'group'>): string[];
  getProjectFallbackPalette(projectName?: string): string[];
  getProfilePalette(profileId: string, groupId: string, options?: { fallbackKinds?: readonly string[] }): string[];
}

export declare const PROJECT_FALLBACKS: Readonly<Record<string, readonly string[]>>;
export declare const COLOR_SLOT_GROUPS: readonly PaletteGroup[];
export declare const COLOR_GROUP_IDS: readonly string[];
export declare const GROUP_SLOT_INDICES: Readonly<Record<string, readonly number[]>>;
export declare const MIN_COLOR_SLOTS: number;
export declare const DEFAULT_GROUP_ORDER: readonly string[];
export declare const DEFAULT_PROJECT_ORDER: readonly string[];
export declare const PALETTE_CONFIG: PaletteConfig;

export declare function ensurePalette(
  base: Iterable<string> | null | undefined,
  fallback: Iterable<string> | null | undefined,
  count?: number
): string[];

export declare function getProjectFallbackPalette(projectName?: string, config?: PaletteConfig): string[];

export declare function createPaletteService(options?: PaletteServiceOptions): PaletteService;

export declare function resolveGroupPalette(options: ResolveGroupPaletteOptions): string[];

declare const _default: {
  PROJECT_FALLBACKS: typeof PROJECT_FALLBACKS;
  COLOR_SLOT_GROUPS: typeof COLOR_SLOT_GROUPS;
  COLOR_GROUP_IDS: typeof COLOR_GROUP_IDS;
  GROUP_SLOT_INDICES: typeof GROUP_SLOT_INDICES;
  MIN_COLOR_SLOTS: typeof MIN_COLOR_SLOTS;
  DEFAULT_GROUP_ORDER: typeof DEFAULT_GROUP_ORDER;
  DEFAULT_PROJECT_ORDER: typeof DEFAULT_PROJECT_ORDER;
  PALETTE_CONFIG: typeof PALETTE_CONFIG;
  ensurePalette: typeof ensurePalette;
  getProjectFallbackPalette: typeof getProjectFallbackPalette;
  createPaletteService: typeof createPaletteService;
  resolveGroupPalette: typeof resolveGroupPalette;
};

export default _default;
