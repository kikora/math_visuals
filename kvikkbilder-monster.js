(function () {
  const cfgAntallX = document.getElementById('cfg-antallX');
  const cfgAntallY = document.getElementById('cfg-antallY');
  const cfgAntall = document.getElementById('cfg-antall');
  const cfgDuration = document.getElementById('cfg-duration');
  const cfgCircleRadius = document.getElementById('cfg-circleRadius');
  const cfgLevelScale = document.getElementById('cfg-levelScale');
  const cfgPatternGap = document.getElementById('cfg-patternGap');
  const cfgShowBtn = document.getElementById('cfg-showBtn');
  const cfgShowExpression = document.getElementById('cfg-show-expression');
  const patternContainer = document.getElementById('patternContainer');
  const playBtn = document.getElementById('playBtn');
  const expression = document.getElementById('expression');
  const btnSvg = document.getElementById('btnSvg');
  const btnPng = document.getElementById('btnPng');
  const DOT_FALLBACK = '#534477';
  function getThemeApi() {
    const theme = typeof window !== 'undefined' ? window.MathVisualsTheme : null;
    return theme && typeof theme === 'object' ? theme : null;
  }
  function applyThemeToDocument() {
    const theme = getThemeApi();
    if (theme && typeof theme.applyToDocument === 'function') {
      theme.applyToDocument(document);
    }
  }
  function getDotColor() {
    const theme = getThemeApi();
    if (theme && typeof theme.getColor === 'function') {
      const color = theme.getColor('dots.default', DOT_FALLBACK);
      if (typeof color === 'string' && color) return color;
    }
    return DOT_FALLBACK;
  }
  applyThemeToDocument();
  const MONSTER_POINT_RADIUS_MIN = 1;
  const MONSTER_POINT_RADIUS_MAX = 60;
  const DEFAULT_CIRCLE_RADIUS = 10;
  const DEFAULT_DOT_SPACING = 3;
  let lastExportSummary = null;
  function setFigureAlt(element, text) {
    if (!element) return;
    const value = typeof text === 'string' ? text.trim() : '';
    if (value) {
      element.setAttribute('role', 'img');
      element.setAttribute('aria-label', value);
    } else {
      element.removeAttribute('role');
      element.removeAttribute('aria-label');
    }
  }
  function normalizeInteger(value) {
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }
  function describePlural(count, singular, plural) {
    const normalized = normalizeInteger(count);
    if (normalized === 1) {
      return `1 ${singular}`;
    }
    const pluralForm = plural || `${singular}er`;
    return `${normalized} ${pluralForm}`;
  }
  function describeArrangement(rows, cols) {
    const normalizedRows = normalizeInteger(rows);
    const normalizedCols = normalizeInteger(cols);
    if (normalizedRows <= 0 || normalizedCols <= 0) return '';
    const rowsText = describePlural(normalizedRows, 'rad', 'rader');
    const colsText = describePlural(normalizedCols, 'kolonne', 'kolonner');
    return `Ordnet i ${rowsText} og ${colsText}.`;
  }
  function primeFactors(n) {
    const factors = [];
    let num = n;
    let p = 2;
    while (num > 1 && factors.length < 6) {
      while (num % p === 0 && factors.length < 6) {
        factors.push(p);
        num /= p;
      }
      p++;
    }
    while (factors.length < 6) factors.push(1);
    return factors;
  }
  function computeKs(n, f) {
    const [f1, f2, f3, f4, f5, f6] = f;
    let k1 = (n <= 9 ? 0.5 : 1) / (f2 * f3 * f4 * f5);
    if (f3 === 2 && f4 === 2) k1 *= f5 < 3 ? 0.25 : 0.5;
    if (f4 === 2 && f5 === 2) k1 *= 0.5;
    if (f1 === 2 && f2 === 2 && f3 === 2 && f4 < 3) k1 *= 2;
    if (f1 === 2 && f2 === 2 && f3 === 2 && f4 === 2) k1 *= 2;
    if (f3 === 3) k1 *= f2 / f1;
    if (f1 === f2 && f2 === f3 && f3 === f4 && f4 === f5) k1 *= 2;
    if (n === 1) k1 = 0;
    let k2;
    if (f2 === 1) k2 = 1;else if (f1 === 2 && f2 === 2) k2 = k1;else if (f3 === 1) k2 = 1 - 1 / f2;else if (f2 === f1) k2 = k1 * f2;else if (f3 === f2 && f2 === 3) k2 = k1 * f1;else if (f3 === f2) k2 = k1 * f2;else if (f1 * f2 === 6 && f3 < 3) k2 = k1 * f3 / f1;else k2 = 1 / (f3 * f4 * f5 * f6);
    let k3;
    if (f3 === 1) k3 = 1;else {
      if (f4 === 1) k3 = 1 - k1;else {
        k3 = 1;
        if (f2 * f3 === 4 && f5 === 1) k3 *= Math.max(f1, f2, f3, f4, f5, f6) / f1;
        if (f1 * f2 * f3 === 8 && f6 === 1) k3 *= 1 / f2;
        if (f1 === 2 && f2 === 2 && f3 === 2 && f4 === 2) k3 *= 2;
        k3 *= 1 / (f4 * f5);
      }
      k3 *= 1 / f6;
    }
    if (f1 * f2 * f3 * f4 === 16 && f5 > 2) k3 *= 2;
    let k4;
    if (f4 === 1) k4 = 1;else if (f5 === 1 && f1 * f2 === 4) k4 = 1 - k3;else if (f5 === 1) k4 = 1 - k1;else k4 = 1 / (f5 * f6);
    let k5;
    if (f5 === 1) k5 = 1;else if (f6 === 1) {
      const mul = f1 === 2 && f2 === 2 && f3 === 2 && f4 === 2 ? 0.5 : 1;
      k5 = 1 - mul * k3;
    } else {
      k5 = 1 / f6;
    }
    const k6 = f6 === 1 ? 1 : 1 - k3;
    return [k1, k2, k3, k4, k5, k6];
  }
  function rotate(points, ang) {
    const ca = Math.cos(ang),
      sa = Math.sin(ang);
    return points.map(p => ({
      x: p.x * ca - p.y * sa,
      y: p.x * sa + p.y * ca
    }));
  }
  function translate(points, tx, ty) {
    return points.map(p => ({
      x: p.x + tx,
      y: p.y + ty
    }));
  }
  function buildLevel(prev, factor, r) {
    if (factor === 1) return prev;
    const res = [];
    for (let i = 0; i < factor; i++) {
      const ang = -2 * Math.PI * i / factor;
      const rotated = rotate(prev, ang);
      const a = 2 * Math.PI * i / factor;
      let tx, ty;
      if (factor === 2) {
        tx = r * Math.cos(a);
        ty = r * Math.sin(a);
      } else {
        tx = r * Math.sin(a);
        ty = r * Math.cos(a);
      }
      res.push(...translate(rotated, tx, ty));
    }
    return res;
  }
  function normalizeScale(value, fallback) {
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return value;
  }
  function byggMonster(n, levelScale = 1) {
    if (n <= 0) return [];
    const f = primeFactors(n);
    const normalizedLevel = normalizeScale(levelScale, 1);
    const ks = computeKs(n, f).map((value, index) => {
      if (!Number.isFinite(value)) return 0;
      if (index === 0) return value;
      return value * normalizedLevel;
    });
    let pts = [];
    const f1 = f[0];
    for (let i = 0; i < f1; i++) {
      const ang = 2 * Math.PI * i / f1;
      pts.push({
        x: ks[0] * Math.sin(ang),
        y: ks[0] * Math.cos(ang)
      });
    }
    pts = buildLevel(pts, f[1], ks[1]);
    pts = buildLevel(pts, f[2], ks[2]);
    pts = buildLevel(pts, f[3], ks[3]);
    pts = buildLevel(pts, f[4], ks[4]);
    pts = buildLevel(pts, f[5], ks[5]);
    const scale = 0.3;
    return pts.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }));
  }
  function createPatternSvg(points, options = {}) {
    if (!points.length) return null;
    const radiusRaw = options.radius;
    const spacingRaw = options.spacing;
    const radius = Number.isFinite(radiusRaw) && radiusRaw > 0 ? radiusRaw : 10;
    const spacing = Number.isFinite(spacingRaw) && spacingRaw >= 0 ? spacingRaw : 3;
    const desiredCenterDistance = radius * 2 + spacing;
    const seen = new Set();
    const uniquePoints = [];
    const precision = 1e4;
    points.forEach(p => {
      const key = `${Math.round(p.x * precision)}:${Math.round(p.y * precision)}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePoints.push(p);
      }
    });
    let minDist = Infinity;
    for (let i = 0; i < uniquePoints.length; i++) {
      for (let j = i + 1; j < uniquePoints.length; j++) {
        const dx = uniquePoints[i].x - uniquePoints[j].x;
        const dy = uniquePoints[i].y - uniquePoints[j].y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < minDist) minDist = dist;
      }
    }
    if (!Number.isFinite(minDist) || minDist <= 0) minDist = desiredCenterDistance;
    let scale = desiredCenterDistance / minDist;
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;else if (scale < 1) scale = 1;
    const scaledPoints = points.map(p => ({
      x: p.x * scale,
      y: p.y * scale
    }));
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    scaledPoints.forEach(({
      x,
      y
    }) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    const pad = radius + spacing;
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const baseW = contentWidth + pad * 2;
    const baseH = contentHeight + pad * 2;
    const minSize = Math.max(radius * 4, 40);
    const vbW = Math.max(baseW, minSize);
    const vbH = Math.max(baseH, minSize);
    const extraX = (vbW - baseW) / 2;
    const extraY = (vbH - baseH) / 2;
    const offsetX = pad + extraX - minX;
    const offsetY = pad + extraY - minY;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    scaledPoints.forEach(({
      x,
      y
    }) => {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', x + offsetX);
      c.setAttribute('cy', y + offsetY);
      c.setAttribute('r', radius);
      c.setAttribute('fill', getDotColor());
      svg.appendChild(c);
    });
    return svg;
  }
  function render() {
    const n = parseInt(cfgAntall.value, 10) || 0;
    const antallX = parseInt(cfgAntallX.value, 10) || 0;
    const antallY = parseInt(cfgAntallY.value, 10) || 0;
    const circleRadiusRaw = cfgCircleRadius ? parseFloat(cfgCircleRadius.value) : NaN;
    const circleRadius = Number.isFinite(circleRadiusRaw) ? Math.min(MONSTER_POINT_RADIUS_MAX, Math.max(MONSTER_POINT_RADIUS_MIN, circleRadiusRaw)) : DEFAULT_CIRCLE_RADIUS;
    const dotSpacing = DEFAULT_DOT_SPACING;
    if (cfgCircleRadius) cfgCircleRadius.value = String(circleRadius);
    const levelScale = cfgLevelScale ? Math.max(0.1, parseFloat(cfgLevelScale.value) || 0) : 1;
    patternContainer.innerHTML = '';
    let altText = 'Ingen numbervisual vist.';
    setFigureAlt(patternContainer, altText);
    const cols = antallX > 0 ? antallX : 1;
    const rows = antallY > 0 ? antallY : 1;
    if (cfgPatternGap) {
      const disableGap = cols <= 1 && rows <= 1;
      cfgPatternGap.disabled = disableGap;
      if (disableGap) {
        cfgPatternGap.setAttribute('title', 'Figuravstand er tilgjengelig når det er flere figurer.');
      } else {
        cfgPatternGap.removeAttribute('title');
      }
    }
    patternContainer.style.gridTemplateColumns = `repeat(${cols},minmax(0,1fr))`;
    patternContainer.style.gridTemplateRows = `repeat(${rows},minmax(0,1fr))`;
    const maxDimension = Math.max(cols, rows);
    const gapInput = cfgPatternGap ? parseFloat(cfgPatternGap.value) : NaN;
    const allowGapOverride = !(cols <= 1 && rows <= 1);
    const gapOverride = allowGapOverride && Number.isFinite(gapInput) && gapInput >= 0 ? gapInput : null;
    const gapPx = gapOverride !== null ? gapOverride : maxDimension <= 1 ? 64 : maxDimension === 2 ? 56 : maxDimension === 3 ? 44 : maxDimension === 4 ? 36 : 28;
    const itemPaddingPx = gapOverride !== null ? Math.max(0, Math.round(gapPx * 0.5)) : Math.min(72, Math.max(18, Math.round(gapPx * 0.65)));
    const containerPaddingPx = gapOverride !== null ? Math.max(0, Math.round(gapPx * 0.3)) : Math.min(48, Math.max(12, Math.round(gapPx * 0.4)));
    patternContainer.style.setProperty('--pattern-gap', `${gapPx}px`);
    patternContainer.style.setProperty('--pattern-item-padding', `${itemPaddingPx}px`);
    patternContainer.style.setProperty('--pattern-padding', `${containerPaddingPx}px`);
    const points = byggMonster(n, levelScale);
    const factors = primeFactors(n).filter(x => x > 1);
    const baseExpression = factors.length ? `${factors.join(' · ')} = ${n}` : `${n}`;
    const totalFigures = Math.max(0, antallX) * Math.max(0, antallY);
    const totalDots = totalFigures * Math.max(0, n);
    lastExportSummary = {
      type: 'numbervisual',
      n,
      columns: cols,
      rows,
      totalFigures,
      totalDots,
      circleRadius,
      levelScale,
      patternGap: gapOverride !== null ? gapOverride : gapPx,
      altText
    };
    if (!points.length || antallX <= 0 || antallY <= 0) {
      expression.textContent = baseExpression;
      return;
    }
    const svg = createPatternSvg(points, {
      radius: circleRadius,
      spacing: dotSpacing
    });
    if (!svg) {
      expression.textContent = baseExpression;
      return;
    }
    svg.setAttribute('aria-label', `Numbervisual ${n}`);
    if (totalFigures > 0 && n > 0) {
      if (totalFigures === 1) {
        altText = `1 numbervisual med ${n} prikker.`;
      } else {
        const arrangement = describeArrangement(antallY, antallX);
        altText = `${describePlural(totalFigures, 'numbervisual', 'numbervisualer')}. ${arrangement} Hver figur viser ${n} prikker, totalt ${totalDots} prikker.`.trim();
      }
    }
    for (let i = 0; i < totalFigures; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pattern-item';
      wrapper.appendChild(svg.cloneNode(true));
      patternContainer.appendChild(wrapper);
    }
    setFigureAlt(patternContainer, altText);
    if (totalFigures > 1) {
      expression.textContent = `${antallX} · ${antallY} · (${baseExpression}) = ${totalFigures} · ${n} = ${totalFigures * n}`;
    } else {
      expression.textContent = baseExpression;
    }
    if (lastExportSummary) {
      lastExportSummary.altText = altText;
      lastExportSummary.totalFigures = totalFigures;
      lastExportSummary.totalDots = totalDots;
    }
  }
  function applyExpressionVisibility() {
    if (!expression) return;
    const enabled = !cfgShowExpression || cfgShowExpression.checked;
    const playVisible = playBtn.style.display !== 'none';
    expression.style.display = enabled && !playVisible ? 'block' : 'none';
  }
  function updateVisibility() {
    if (cfgShowBtn.checked) {
      playBtn.style.display = 'flex';
      patternContainer.style.display = 'none';
    } else {
      playBtn.style.display = 'none';
      patternContainer.style.display = 'grid';
    }
    applyExpressionVisibility();
  }
  [cfgAntall, cfgAntallX, cfgAntallY, cfgCircleRadius, cfgLevelScale, cfgPatternGap].forEach(el => {
    el === null || el === void 0 || el.addEventListener('input', render);
  });
  cfgShowBtn.addEventListener('change', () => {
    updateVisibility();
    if (!cfgShowBtn.checked) render();
  });
  cfgShowExpression === null || cfgShowExpression === void 0 || cfgShowExpression.addEventListener('change', applyExpressionVisibility);
  playBtn.addEventListener('click', () => {
    const duration = parseInt(cfgDuration.value, 10) || 0;
    render();
    playBtn.style.display = 'none';
    patternContainer.style.display = 'grid';
    applyExpressionVisibility();
    setTimeout(() => {
      updateVisibility();
    }, duration * 1000);
  });
  btnSvg === null || btnSvg === void 0 || btnSvg.addEventListener('click', () => {
    const svg = patternContainer.querySelector('svg');
    if (svg) downloadPNG(svg, 'numbervisuals.png', 2);
  });
  btnPng === null || btnPng === void 0 || btnPng.addEventListener('click', () => {
    const svg = patternContainer.querySelector('svg');
    if (svg) downloadPNG(svg, 'numbervisuals.png', 2);
  });
  updateVisibility();
  render();
  applyExpressionVisibility();
  function handleThemeProfileChange(event) {
    const data = event && event.data;
    const type = typeof data === 'string' ? data : data && data.type;
    if (type !== 'math-visuals:profile-change') return;
    applyThemeToDocument();
    render();
    applyExpressionVisibility();
  }
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('message', handleThemeProfileChange);
  }
  function svgToString(svgEl) {
    if (!svgEl) return '';
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const clone = helper && typeof helper.cloneSvgForExport === 'function' ? helper.cloneSvgForExport(svgEl) : svgEl.cloneNode(true);
    if (!clone) return '';
    const css = [...document.querySelectorAll('style')].map(s => s.textContent).join('\n');
    const style = document.createElement('style');
    style.textContent = css;
    const firstElement = clone.firstElementChild;
    if (
      firstElement &&
      typeof firstElement.tagName === 'string' &&
      firstElement.tagName.toLowerCase() === 'rect' &&
      firstElement.getAttribute('fill') === '#ffffff'
    ) {
      clone.insertBefore(style, firstElement.nextSibling);
    } else if (clone.firstChild) {
      clone.insertBefore(style, clone.firstChild);
    } else {
      clone.appendChild(style);
    }
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    if (!clone.getAttribute('xmlns:xlink')) {
      clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
  }
  function buildNumbervisualExportMeta() {
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const summary = lastExportSummary || {};
    const alt = typeof summary.altText === 'string' ? summary.altText.trim() : '';
    const description = alt || `Numbervisual med ${summary.totalDots || 0} prikker.`;
    const slugParts = ['numbervisual', `${summary.n || 0}prikker`, `${summary.totalFigures || 0}fig`];
    const slugBase = slugParts.join(' ');
    const slug = helper && typeof helper.slugify === 'function' ? helper.slugify(slugBase, 'numbervisuals') : slugParts.join('-').toLowerCase();
    return {
      description,
      slug,
      defaultBaseName: slug || 'numbervisuals',
      summary
    };
  }
  function downloadSVG(svgEl, filename) {
    const suggestedName = typeof filename === 'string' && filename ? filename : 'numbervisuals.svg';
    const data = svgToString(svgEl);
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const meta = buildNumbervisualExportMeta();
    const htmlTarget = document.querySelector('.figure') || svgEl;
    if (helper && typeof helper.exportGraphicWithArchiveWithFallback === 'function') {
      helper.exportGraphicWithArchiveWithFallback({
        svgElement: svgEl,
        htmlTarget,
        suggestedName,
        toolId: 'numbervisuals',
        svgString: data,
        description: meta.description,
        slug: meta.slug,
        defaultBaseName: meta.defaultBaseName,
        summary: meta.summary
      });
      return;
    }
    if (helper && typeof helper.exportSvgWithArchive === 'function') {
      helper.exportSvgWithArchive(svgEl, suggestedName, 'numbervisuals', {
        svgString: data,
        description: meta.description,
        slug: meta.slug,
        defaultBaseName: meta.defaultBaseName,
        summary: meta.summary
      });
      return;
    }
    const blob = new Blob([data], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName.endsWith('.svg') ? suggestedName : suggestedName + '.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadPNG(svgEl, filename, scale = 2, bg = '#fff') {
    var _svgEl$viewBox;
    const vb = (_svgEl$viewBox = svgEl.viewBox) === null || _svgEl$viewBox === void 0 ? void 0 : _svgEl$viewBox.baseVal;
    const w = (vb === null || vb === void 0 ? void 0 : vb.width) || svgEl.clientWidth || 420;
    const h = (vb === null || vb === void 0 ? void 0 : vb.height) || svgEl.clientHeight || 420;
    const data = svgToString(svgEl);
    const blob = new Blob([data], {
      type: 'image/svg+xml;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
    const canvas = document.createElement('canvas');
    const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
    const sizing = helper && typeof helper.ensureMinimumPngDimensions === 'function'
      ? helper.ensureMinimumPngDimensions({ width: w, height: h }, { scale })
      : (() => {
          const minDimension = 100;
          const baseScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
          const safeWidth = Number.isFinite(w) && w > 0 ? w : minDimension;
          const safeHeight = Number.isFinite(h) && h > 0 ? h : minDimension;
          const scaledWidth = safeWidth * baseScale;
          const scaledHeight = safeHeight * baseScale;
          const scaleMultiplier = Math.max(
            1,
            scaledWidth > 0 ? minDimension / scaledWidth : 1,
            scaledHeight > 0 ? minDimension / scaledHeight : 1
          );
          const finalScale = baseScale * scaleMultiplier;
          return {
            width: Math.max(minDimension, Math.round(safeWidth * finalScale)),
            height: Math.max(minDimension, Math.round(safeHeight * finalScale))
          };
        })();
    canvas.width = sizing.width;
    canvas.height = sizing.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        const urlPng = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = urlPng;
        a.download = filename.endsWith('.png') ? filename : filename + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(urlPng), 1000);
      }, 'image/png');
    };
    img.src = url;
  }
})();
