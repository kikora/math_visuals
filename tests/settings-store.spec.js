const { test, expect } = require('@playwright/test');

const originalRedisEndpoint = process.env.REDIS_ENDPOINT;
const originalRedisPort = process.env.REDIS_PORT;
const originalRedisPassword = process.env.REDIS_PASSWORD;

delete process.env.REDIS_ENDPOINT;
delete process.env.REDIS_PORT;
delete process.env.REDIS_PASSWORD;

const {
  setSettings,
  getSettings,
  resetSettings
} = require('../api/_lib/settings-store');

test.afterAll(() => {
  if (originalRedisEndpoint !== undefined) {
    process.env.REDIS_ENDPOINT = originalRedisEndpoint;
  } else {
    delete process.env.REDIS_ENDPOINT;
  }
  if (originalRedisPort !== undefined) {
    process.env.REDIS_PORT = originalRedisPort;
  } else {
    delete process.env.REDIS_PORT;
  }
  if (originalRedisPassword !== undefined) {
    process.env.REDIS_PASSWORD = originalRedisPassword;
  } else {
    delete process.env.REDIS_PASSWORD;
  }
});

test.beforeEach(async () => {
  await resetSettings();
});

function buildGroupedPalette(overrides = {}) {
  const base = {
    graftegner: ['#123456', '#654321'],
    nkant: ['#234567', '#345678', '#456789'],
    arealmodell: ['#ef0123', '#f01234', '#012345', '#123456']
  };
  Object.keys(overrides).forEach(key => {
    base[key] = overrides[key];
  });
  return base;
}

test.describe('settings-store palette handling', () => {
  test('stores grouped project palettes and retrieves consistent hex colors', async () => {
    const campusPalette = buildGroupedPalette();
  const customPalette = buildGroupedPalette({
      graftegner: ['#101010', '#202020'],
      ukjent: ['#222222', ' #333333 ', '#444444']
    });

    // Apply overrides to ensure variation between palettes
    customPalette.graftegner = ['#101010', '#202020'];
    customPalette.ukjent = ['#222222', ' #333333 ', '#444444'];

    const payload = {
      activeProject: 'custom-app',
      projects: {
        campus: { defaultColors: campusPalette },
        'custom-app': { defaultColors: customPalette }
      },
      projectOrder: ['campus', 'custom-app']
    };

    const saved = await setSettings(payload);

    expect(saved.projects.campus.groupPalettes).toBeDefined();
    expect(saved.projects.campus.groupPalettes.graftegner[0]).toBe('#123456');
    expect(saved.projects.campus.groupPalettes.graftegner[1]).toBe('#654321');
    expect(saved.projects['custom-app'].groupPalettes).toBeDefined();
    expect(saved.projects['custom-app'].groupPalettes.graftegner[0]).toBe('#101010');
    expect(saved.projects['custom-app'].groupPalettes.graftegner[1]).toBe('#202020');
    expect(saved.projects.campus.defaultColors[0]).toBe('#123456');
    expect(saved.projects['custom-app'].defaultColors[0]).toBe('#101010');
    expect(saved.activeProject).toBe('custom-app');
    expect(saved.defaultColors[0]).toBe('#101010');

    const retrieved = await getSettings();

    expect(retrieved.projects.campus.groupPalettes.graftegner[0]).toBe('#123456');
    expect(retrieved.projects.campus.groupPalettes.graftegner[1]).toBe('#654321');
    expect(retrieved.projects['custom-app'].groupPalettes.graftegner[0]).toBe('#101010');
    expect(retrieved.projects['custom-app'].groupPalettes.graftegner[1]).toBe('#202020');
    expect(retrieved.projects.campus.defaultColors[0]).toBe('#123456');
    expect(retrieved.projects['custom-app'].defaultColors[0]).toBe('#101010');
    expect(retrieved.defaultColors[0]).toBe('#101010');

    expect(saved.projects.campus.groupPalettes.ukjent).toBeUndefined();
    expect(saved.projects['custom-app'].groupPalettes.ukjent).toBeUndefined();
    expect(retrieved.projects.campus.groupPalettes.ukjent).toBeUndefined();
    expect(retrieved.projects['custom-app'].groupPalettes.ukjent).toBeUndefined();
  });
});
