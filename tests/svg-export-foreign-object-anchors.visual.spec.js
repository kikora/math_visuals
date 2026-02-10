const { test, expect } = require('@playwright/test');
const path = require('path');

const helperPath = path.resolve(__dirname, '..', 'svg-export-helper.js');

function buildForeignObjectAnchorSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="480" height="220" viewBox="0 0 480 220">
      <rect x="0" y="0" width="480" height="220" fill="#fff" />
      <g font-family="Inter, sans-serif" font-size="16" fill="#111827">
        <foreignObject x="40" y="20" width="120" height="36" data-export-text-anchor="start" data-export-dominant-baseline="text-before-edge">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:120px;height:36px;display:flex;align-items:flex-start;justify-content:flex-start;">A</div>
        </foreignObject>
        <foreignObject x="180" y="20" width="120" height="36" data-export-text-anchor="middle" data-export-dominant-baseline="middle">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:120px;height:36px;display:flex;align-items:center;justify-content:center;">B</div>
        </foreignObject>
        <foreignObject x="320" y="20" width="120" height="36" data-export-text-anchor="end" data-export-dominant-baseline="text-after-edge">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:120px;height:36px;display:flex;align-items:flex-end;justify-content:flex-end;">C</div>
        </foreignObject>
      </g>
      <g stroke="#cbd5e1" stroke-dasharray="3 3" fill="none">
        <rect x="40" y="20" width="120" height="36" />
        <rect x="180" y="20" width="120" height="36" />
        <rect x="320" y="20" width="120" height="36" />
      </g>
    </svg>
  `.trim();
}

test('foreignObject labels følger anchor/baseline under eksport (binærfri visuell regresjon)', async ({ page }) => {
  await page.goto('/');
  await page.addScriptTag({ path: helperPath });

  const renderedDataUrl = await page.evaluate(async (svgString) => {
    const helper = window.MathVisSvgExport;
    const result = await helper.renderSvgToPng(document, null, svgString, { width: 480, height: 220 }, {
      convertForeignObjectsToText: true,
      svgStringAlreadySanitized: false,
      backgroundColor: '#ffffff'
    });
    return result && result.dataUrl;
  }, buildForeignObjectAnchorSvg());

  expect(renderedDataUrl).toMatch(/^data:image\/png;base64,/);

  const regions = [
    { id: 'start-before', x: 40, y: 20, width: 120, height: 36 },
    { id: 'middle-middle', x: 180, y: 20, width: 120, height: 36 },
    { id: 'end-after', x: 320, y: 20, width: 120, height: 36 }
  ];

  const analysis = await page.evaluate(async ({ dataUrl, regions }) => {
    const image = new Image();
    image.decoding = 'sync';
    const loaded = new Promise((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Kunne ikke laste dataURL-bilde'));
    });
    image.src = dataUrl;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D-context mangler');
    ctx.drawImage(image, 0, 0);

    const darkThreshold = 215;
    const summaries = regions.map(region => {
      const xStart = Math.max(0, Math.floor(region.x));
      const yStart = Math.max(0, Math.floor(region.y));
      const xEnd = Math.min(canvas.width, Math.ceil(region.x + region.width));
      const yEnd = Math.min(canvas.height, Math.ceil(region.y + region.height));

      let darkCount = 0;
      let sumX = 0;
      let sumY = 0;

      for (let y = yStart; y < yEnd; y++) {
        for (let x = xStart; x < xEnd; x++) {
          const px = ctx.getImageData(x, y, 1, 1).data;
          if (px[0] < darkThreshold || px[1] < darkThreshold || px[2] < darkThreshold) {
            darkCount += 1;
            sumX += x;
            sumY += y;
          }
        }
      }

      if (!darkCount) {
        return { id: region.id, darkCount: 0, normalizedX: null, normalizedY: null };
      }

      const centroidX = sumX / darkCount;
      const centroidY = sumY / darkCount;
      const normalizedX = (centroidX - region.x) / region.width;
      const normalizedY = (centroidY - region.y) / region.height;

      return { id: region.id, darkCount, normalizedX, normalizedY };
    });

    return summaries;
  }, { dataUrl: renderedDataUrl, regions });

  for (const [index, region] of regions.entries()) {
    const summary = analysis[index];
    expect(summary.id).toBe(region.id);
    expect(summary.darkCount).toBeGreaterThan(25);
    expect(summary.normalizedX).not.toBeNull();
    expect(summary.normalizedY).not.toBeNull();
  }

  const [startSummary, middleSummary, endSummary] = analysis;
  expect(startSummary.normalizedX).toBeLessThan(middleSummary.normalizedX);
  expect(middleSummary.normalizedX).toBeLessThan(endSummary.normalizedX);
  expect(startSummary.normalizedY).toBeLessThan(middleSummary.normalizedY);
  expect(middleSummary.normalizedY).toBeLessThan(endSummary.normalizedY);
});
