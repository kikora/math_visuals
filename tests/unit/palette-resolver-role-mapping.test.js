const assert = require('node:assert/strict');
const path = require('node:path');

const resolver = require(path.resolve(__dirname, '..', '..', 'palette', 'palette-resolver.js'));

const originalSettings = globalThis.MathVisualsSettings;

globalThis.MathVisualsSettings = {
  getGroupPalette(groupId) {
    if (groupId === 'fellesfarger') {
      return {
        fills: ['#112233'],
        edges: ['#445566'],
        lines: ['#778899']
      };
    }
    return null;
  }
};

try {
  const palette = resolver.resolveGroupPalette('fellesfarger', { count: 3 });
  assert.equal(palette[0], '#112233', 'fills[0] should map to the first slot');
  assert.equal(palette[1], '#445566', 'edges[0] should map to the second slot');
  assert.equal(palette[2], '#778899', 'lines[0] should map to the third slot');
  console.log('palette-resolver role mapping test passed');
} finally {
  if (originalSettings === undefined) {
    delete globalThis.MathVisualsSettings;
  } else {
    globalThis.MathVisualsSettings = originalSettings;
  }
}
