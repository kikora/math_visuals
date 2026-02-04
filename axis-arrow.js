(function (global) {
  const X_AXIS_ARROW_SVG_TEMPLATE =
    '<svg width="17" height="30" viewBox="0 0 17 30" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 2 L15 15 L2 28" stroke="{{COLOR}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const Y_AXIS_ARROW_SVG_TEMPLATE =
    '<svg width="30" height="17" viewBox="0 0 30 17" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 15 L15 2 L28 15" stroke="{{COLOR}}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const BASE_DIMENSIONS = {
    x: { width: 17, height: 30, thicknessAxis: 'height' },
    y: { width: 30, height: 17, thicknessAxis: 'width' }
  };

  function sanitizeColor(color, fallback) {
    if (typeof color === 'string') {
      const trimmed = color.trim();
      if (trimmed) {
        return trimmed;
      }
    }
    return typeof fallback === 'string' && fallback ? fallback : '#000000';
  }

  function getTemplate(axis) {
    return axis === 'y' ? Y_AXIS_ARROW_SVG_TEMPLATE : X_AXIS_ARROW_SVG_TEMPLATE;
  }

  function getBaseDimensions(axis) {
    return BASE_DIMENSIONS[axis === 'y' ? 'y' : 'x'];
  }

  function getSvgData(axis, color, fallbackColor) {
    const template = getTemplate(axis);
    const tint = sanitizeColor(color, fallbackColor);
    return `data:image/svg+xml;utf8,${encodeURIComponent(template.replace(/{{COLOR}}/g, tint))}`;
  }

  function getNativeSize(axis) {
    const dims = getBaseDimensions(axis);
    if (!dims) {
      return { width: 0, height: 0 };
    }
    return { width: dims.width, height: dims.height };
  }

  function getScaledSize(axis, targetThickness) {
    const dims = getBaseDimensions(axis);
    if (!dims) {
      return { width: 0, height: 0 };
    }
    const thicknessKey = dims.thicknessAxis;
    const thickness = dims[thicknessKey];
    if (!Number.isFinite(targetThickness) || targetThickness <= 0) {
      return { width: dims.width, height: dims.height };
    }
    const scale = targetThickness / thickness;
    return {
      width: dims.width * scale,
      height: dims.height * scale
    };
  }

  const api = {
    getSvgData,
    getNativeSize,
    getScaledSize
  };

  if (global && typeof global === 'object') {
    global.MathVisualsAxisArrow = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
