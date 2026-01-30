import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPaletteService,
  ensurePalette,
  PROJECT_FALLBACKS,
  resolveGroupPalette
} from '../src/index.js';

test('ensurePalette fills gaps using fallback colors', () => {
  const palette = ensurePalette(['#FFF', 'nope', '#000000'], ['#123456'], 4);
  assert.deepStrictEqual(palette, ['#ffffff', '#000000', '#123456', '#123456']);
});

test('service resolves project fallback palette when no sources available', () => {
  const service = createPaletteService();
  const palette = service.resolveGroupPalette({ groupId: 'fellesfarger', project: 'default', count: 3 });
  const expected = ensurePalette([], PROJECT_FALLBACKS.default, 3);
  assert.deepStrictEqual(palette, expected);
});

test('profile group palette is preferred over fallbacks', () => {
  const service = createPaletteService({
    defaultProfile: 'campus',
    profiles: {
      campus: {
        id: 'campus',
        groups: {
          graftegner: ['#111111', '#222222']
        },
        palettes: {
          graftegner: PROJECT_FALLBACKS.default
        }
      }
    },
    groupFallbacks: {
      default: ['fellesfarger']
    }
  });
  const palette = service.resolveGroupPalette({ groupId: 'fellesfarger', profile: 'campus', count: 2 });
  assert.deepStrictEqual(palette, ['#111111', '#222222']);
});

test('profile fallback palettes are used when group is missing', () => {
  const service = createPaletteService({
    defaultProfile: 'campus',
    profiles: {
      campus: {
        id: 'campus',
        palettes: {
          graftegner: ['#ABCDEF', '#FEDCBA']
        }
      }
    },
    groupFallbacks: {
      arealmodell: ['fellesfarger']
    }
  });
  const palette = service.resolveGroupPalette({ groupId: 'arealmodell', profile: 'campus', count: 2 });
  assert.deepStrictEqual(palette, ['#abcdef', '#fedcba']);
});

test('legacy palettes are used as final fallback', () => {
  const service = createPaletteService({
    legacyPalettes: {
      figures: ['#AAAAAA', '#BBBBBB', '#CCCCCC']
    }
  });
  const palette = service.resolveGroupPalette({
    groupId: 'fellesfarger',
    legacyPaletteId: 'figures',
    count: 3
  });
  assert.deepStrictEqual(palette, ['#aaaaaa', '#bbbbbb', '#cccccc']);
});

test('default resolveGroupPalette helper uses configured fallbacks', () => {
  const palette = resolveGroupPalette({ groupId: 'fellesfarger', project: 'default', count: 2 });
  const expected = ensurePalette([], PROJECT_FALLBACKS.default, 2);
  assert.deepStrictEqual(palette, expected);
});
