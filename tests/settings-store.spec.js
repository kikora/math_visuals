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
  resetSettings,
  expandPalette
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

function getRolePalette(group, roleKey) {
  if (Array.isArray(group)) {
    return group;
  }
  if (group && typeof group === 'object') {
    const list = group[roleKey];
    return Array.isArray(list) ? list : [];
  }
  return [];
}

test.describe('settings-store palette handling', () => {
  test('stores grouped palettes and retrieves consistent hex colors', async () => {
    const basePalette = buildGroupedPalette();
    const payload = {
      groupPalettes: basePalette
    };

    const saved = await setSettings(payload);
    const expectedDefault = expandPalette('campus', basePalette);

    expect(saved.groupPalettes).toBeDefined();
    const savedFills = getRolePalette(saved.groupPalettes.graftegner, 'fills');
    const savedEdges = getRolePalette(saved.groupPalettes.graftegner, 'edges');
    expect(savedFills[0]).toBe('#123456');
    expect(savedEdges[0]).toBe('#654321');
    expect(saved.defaultColors[0]).toBe(expectedDefault[0]);

    const retrieved = await getSettings();

    const retrievedFills = getRolePalette(retrieved.groupPalettes.graftegner, 'fills');
    const retrievedEdges = getRolePalette(retrieved.groupPalettes.graftegner, 'edges');
    expect(retrievedFills[0]).toBe('#123456');
    expect(retrievedEdges[0]).toBe('#654321');
    expect(retrieved.defaultColors[0]).toBe(expectedDefault[0]);

    expect(saved.groupPalettes.ukjent).toBeUndefined();
    expect(retrieved.groupPalettes.ukjent).toBeUndefined();
  });
});
