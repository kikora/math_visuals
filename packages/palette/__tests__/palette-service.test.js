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
  const palette = service.resolveGroupPalette({ groupId: 'graftegner', project: 'annet', count: 3 });
  const expected = ensurePalette([], PROJECT_FALLBACKS.annet, 3);
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
          fractions: PROJECT_FALLBACKS.campus
        }
      }
    },
    groupFallbacks: {
      default: ['fractions']
    }
  });
  const palette = service.resolveGroupPalette({ groupId: 'graftegner', profile: 'campus', count: 2 });
  assert.deepStrictEqual(palette, ['#111111', '#222222']);
});

test('profile fallback palettes are used when group is missing', () => {
  const service = createPaletteService({
    defaultProfile: 'campus',
    profiles: {
      campus: {
        id: 'campus',
        palettes: {
          fractions: ['#ABCDEF', '#FEDCBA']
        }
      }
    },
    groupFallbacks: {
      arealmodell: ['fractions']
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
    groupId: 'graftegner',
    legacyPaletteId: 'figures',
    count: 3
  });
  assert.deepStrictEqual(palette, ['#aaaaaa', '#bbbbbb', '#cccccc']);
});

test('default resolveGroupPalette helper uses configured fallbacks', () => {
  const palette = resolveGroupPalette({ groupId: 'graftegner', project: 'kikora', count: 2 });
  const expected = ensurePalette([], PROJECT_FALLBACKS.kikora, 2);
  assert.deepStrictEqual(palette, expected);
});
