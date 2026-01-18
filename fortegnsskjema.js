(() => {
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) return;
  const globalObj = typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null;
  const root = doc.documentElement || null;
  const svg = doc.getElementById('chart');
  const overlay = doc.getElementById('chartOverlay');
  const expressionDisplay = doc.getElementById('chartExpression');
  const labelsLayer = doc.getElementById('chartLabels');
  const figureContainer = doc.querySelector('.figure');
  let exprInput = doc.getElementById('exprInput');
  const btnCheck = doc.getElementById('btnCheck');
  const btnAddPoint = doc.getElementById('btnAddPoint');
  const btnAddRow = doc.getElementById('btnAddRow');
  const overlayAddPoint = doc.getElementById('overlayAddPoint');
  const overlayAddRow = doc.getElementById('overlayAddRow');
  const pointsList = doc.getElementById('pointsList');
  const rowsList = doc.getElementById('rowsList');
  const autoSyncInput = doc.getElementById('autoSync');
  const useLinearFactorsInput = doc.getElementById('useLinearFactors');
  const domainMinInput = doc.getElementById('domainMin');
  const domainMaxInput = doc.getElementById('domainMax');
  const decimalPlacesInput = doc.getElementById('decimalPlaces');
  const checkStatus = doc.getElementById('checkStatus');
  const taskCheckHost = doc ? doc.querySelector('[data-task-check-host]') : null;
  const taskCheckControls = [btnCheck, checkStatus].filter(Boolean);
  const TASK_APP_ID = 'fortegnsskjema';
  function getTaskApi() {
    if (typeof window === 'undefined') return null;
    return window.MathVisualsTaskApi || null;
  }
  function registerTaskAdapter() {
    const taskApi = getTaskApi();
    if (!taskApi || typeof taskApi.registerTaskAdapter !== 'function') return;
    taskApi.registerTaskAdapter(TASK_APP_ID, {
      collectInputs() {
        if (typeof taskApi.evaluateDescriptionInputs === 'function') {
          taskApi.evaluateDescriptionInputs();
        }
      },
      evaluateAnswers() {
        if (!ensureSolution()) {
          return null;
        }
        runCheck();
        return null;
      },
      resetAnswers() {
        if (typeof taskApi.resetDescriptionInputs === 'function') {
          taskApi.resetDescriptionInputs();
        }
      }
    });
  }
  registerTaskAdapter();
  const downloadSvgButton = document.getElementById('btnDownloadSvg');
  const downloadPngButton = document.getElementById('btnDownloadPng');
  let altTextManager = null;
  const MATHFIELD_TAG = 'MATH-FIELD';
  const POINT_TOLERANCE = 1e-6;
  const MARKER_GAP_PX = 10;
  const MIN_SEGMENT_WIDTH_PX = 4;
  const NEGATIVE_SEGMENT_DASH = '12 12';
  const LINEAR_VALIDATION_TOLERANCE = 1e-6;
  const LINEAR_VALIDATION_POINTS = [-1, 2, 0.5];
  const axisArrowUtils = typeof window !== 'undefined' ? window.MathVisualsAxisArrow : null;
  const AXIS_ARROW_THICKNESS = 22;
  const LEGACY_ARROW_WIDTH = 12;
  const XLINK_NS = 'http://www.w3.org/1999/xlink';
  exprInput = ensureExpressionInputElement(exprInput);
  const EXPRESSION_PREFIX_REGEX = /^\s*f\s*\(\s*x\s*\)\s*=\s*/i;
  let isUpdatingExpressionInput = false;
  const COMMAND_NAME_MAP = {
    cdot: '*',
    times: '*',
    div: '/',
    pm: '+/-',
    minus: '-',
    pi: 'pi',
    tau: 'tau',
    theta: 'theta',
    alpha: 'alpha',
    beta: 'beta',
    gamma: 'gamma',
    phi: 'phi',
    degree: 'deg',
    log: 'log',
    ln: 'ln',
    sin: 'sin',
    cos: 'cos',
    tan: 'tan',
    asin: 'asin',
    acos: 'acos',
    atan: 'atan',
    sinh: 'sinh',
    cosh: 'cosh',
    tanh: 'tanh',
    exp: 'exp',
    abs: 'abs',
    max: 'max',
    min: 'min',
    floor: 'floor',
    ceil: 'ceil',
    round: 'round'
  };
  const FORTEGNSSKJEMA_FALLBACK = {
    axis: '#000000',
    grid: '#000000',
    positive: '#000000',
    negative: '#000000',
    text: '#000000'
  };
  let chartPalette = {
    axis: FORTEGNSSKJEMA_FALLBACK.axis,
    grid: FORTEGNSSKJEMA_FALLBACK.grid,
    positive: FORTEGNSSKJEMA_FALLBACK.positive,
    negative: FORTEGNSSKJEMA_FALLBACK.negative,
    text: FORTEGNSSKJEMA_FALLBACK.text
  };

  function applyFortegnsskjemaPalette(options = {}) {
    const palette = options && options.palette && typeof options.palette === 'object'
      ? options.palette
      : null;
    chartPalette = { ...FORTEGNSSKJEMA_FALLBACK, ...(palette || {}) };
    if (root && root.style) {
      root.style.setProperty('--fortegnsskjema-axis-color', chartPalette.axis);
      root.style.setProperty('--fortegnsskjema-grid-color', chartPalette.grid);
      root.style.setProperty('--fortegnsskjema-positive-color', chartPalette.positive);
      root.style.setProperty('--fortegnsskjema-negative-color', chartPalette.negative);
      root.style.setProperty('--fortegnsskjema-text-color', chartPalette.text);
    }
    if (options && options.reRender) {
      renderChart();
    }
  }

  applyFortegnsskjemaPalette();
  function getMathFieldConstructor() {
    if (typeof window === 'undefined') {
      return null;
    }
    if (window.customElements && typeof window.customElements.get === 'function') {
      const defined = window.customElements.get('math-field');
      if (defined) {
        return defined;
      }
    }
    if (typeof window.MathfieldElement !== 'undefined') {
      return window.MathfieldElement;
    }
    return null;
  }
  function isMathLiveReady() {
    const ctor = getMathFieldConstructor();
    if (!ctor || !ctor.prototype) {
      return false;
    }
    return (
      typeof ctor.prototype.getValue === 'function' &&
      typeof ctor.prototype.setValue === 'function'
    );
  }
  function convertMathFieldToTextInput(field) {
    if (!field) return field;
    const replacement = document.createElement('input');
    replacement.type = 'text';
    replacement.id = field.id || '';
    replacement.className = field.className || '';
    if (field.getAttribute('aria-label')) {
      replacement.setAttribute('aria-label', field.getAttribute('aria-label'));
    }
    if (field.hasAttribute('placeholder')) {
      replacement.setAttribute('placeholder', field.getAttribute('placeholder'));
    }
    if (field.dataset) {
      Object.keys(field.dataset).forEach(key => {
        replacement.dataset[key] = field.dataset[key];
      });
    }
    if (typeof field.value === 'string' && field.value) {
      replacement.value = field.value;
    } else if (field.hasAttribute('value')) {
      const attrVal = field.getAttribute('value');
      if (attrVal) {
        replacement.value = attrVal;
      }
    } else {
      const textValue = (field.textContent || '').trim();
      if (textValue) {
        replacement.value = textValue;
      }
    }
    field.replaceWith(replacement);
    return replacement;
  }
  function ensureExpressionInputElement(element) {
    if (!element) return element;
    const tag = element.tagName ? element.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG && !isMathLiveReady()) {
      return convertMathFieldToTextInput(element);
    }
    return element;
  }
  function tryGetMathFieldValue(field, format) {
    if (!field || typeof field.getValue !== 'function') return '';
    try {
      const value = field.getValue(format);
      return typeof value === 'string' ? value : '';
    } catch (err) {
      return '';
    }
  }
  function readGroup(str, startIdx) {
    if (typeof str !== 'string' || startIdx == null || startIdx < 0 || startIdx >= str.length) {
      return ['', typeof startIdx === 'number' ? startIdx : 0];
    }
    if (str[startIdx] !== '{') {
      return ['', startIdx];
    }
    let depth = 0;
    for (let i = startIdx + 1; i < str.length; i += 1) {
      const ch = str[i];
      if (ch === '{') {
        depth += 1;
        continue;
      }
      if (ch === '}') {
        if (depth === 0) {
          return [str.slice(startIdx + 1, i), i + 1];
        }
        depth -= 1;
      }
    }
    return [str.slice(startIdx + 1), str.length];
  }
  function readParenthesisGroup(str, startIdx) {
    if (typeof str !== 'string' || startIdx == null || startIdx < 0 || startIdx >= str.length) {
      return ['', typeof startIdx === 'number' ? startIdx : 0];
    }
    if (str[startIdx] !== '(') {
      return ['', startIdx];
    }
    let depth = 0;
    for (let i = startIdx + 1; i < str.length; i += 1) {
      const ch = str[i];
      if (ch === '(') {
        depth += 1;
        continue;
      }
      if (ch === ')') {
        if (depth === 0) {
          return [str.slice(startIdx + 1, i), i + 1];
        }
        depth -= 1;
      }
    }
    return [str.slice(startIdx + 1), str.length];
  }
  function readParenthesisGroupBackward(str, endIdx) {
    if (typeof str !== 'string' || endIdx == null || endIdx < 0 || endIdx >= str.length) {
      return ['', typeof endIdx === 'number' ? endIdx : 0];
    }
    if (str[endIdx] !== ')') {
      return ['', endIdx];
    }
    let depth = 0;
    for (let i = endIdx; i >= 0; i -= 1) {
      const ch = str[i];
      if (ch === ')') {
        depth += 1;
      } else if (ch === '(') {
        depth -= 1;
        if (depth === 0) {
          return [str.slice(i + 1, endIdx), i];
        }
        if (depth < 0) {
          break;
        }
      }
    }
    return ['', 0];
  }
  function replaceLatexFractions(str) {
    if (typeof str !== 'string' || !str.includes('\\frac')) {
      return typeof str === 'string' ? str : '';
    }
    let out = '';
    let idx = 0;
    while (idx < str.length) {
      const start = str.indexOf('\\frac', idx);
      if (start === -1) {
        out += str.slice(idx);
        break;
      }
      out += str.slice(idx, start);
      let pos = start + 5;
      while (pos < str.length && /\s/.test(str[pos])) pos += 1;
      let numerator = '';
      let denominator = '';
      if (pos < str.length && str[pos] === '{') {
        const group = readGroup(str, pos);
        numerator = replaceLatexFractions(group[0]);
        pos = group[1];
      }
      while (pos < str.length && /\s/.test(str[pos])) pos += 1;
      if (pos < str.length && str[pos] === '{') {
        const group = readGroup(str, pos);
        denominator = replaceLatexFractions(group[0]);
        pos = group[1];
      }
      out += `(${numerator})/(${denominator})`;
      idx = pos;
    }
    return out;
  }
  function replaceLatexSqrt(str) {
    if (typeof str !== 'string' || !str.includes('\\sqrt')) {
      return typeof str === 'string' ? str : '';
    }
    let out = '';
    let idx = 0;
    while (idx < str.length) {
      const start = str.indexOf('\\sqrt', idx);
      if (start === -1) {
        out += str.slice(idx);
        break;
      }
      out += str.slice(idx, start);
      let pos = start + 5;
      while (pos < str.length && /\s/.test(str[pos])) pos += 1;
      let radicand = '';
      if (pos < str.length && str[pos] === '{') {
        const group = readGroup(str, pos);
        radicand = replaceLatexSqrt(replaceLatexFractions(group[0]));
        pos = group[1];
      }
      out += `sqrt(${radicand})`;
      idx = pos;
    }
    return out;
  }
  function convertLatexLikeToPlain(latex) {
    if (typeof latex !== 'string') return '';
    let str = latex;
    str = str.replace(/\\left|\\right/g, '');
    str = str.replace(/\\!/g, '');
    str = str.replace(/\\,/g, '');
    str = str.replace(/\\;/g, ' ');
    str = str.replace(/~|\\:/g, ' ');
    str = str.replace(/\\\\/g, '\n');
    str = replaceLatexFractions(str);
    str = replaceLatexSqrt(str);
    str = str.replace(/\\operatorname\{([^{}]+)\}/gi, '$1');
    str = str.replace(/\\([a-zA-Z]+)\b/g, (match, name) => {
      const key = name.toLowerCase();
      return COMMAND_NAME_MAP[key] != null ? COMMAND_NAME_MAP[key] : name;
    });
    str = str.replace(/\\([a-zA-Z]+)/g, (match, name) => {
      const key = name.toLowerCase();
      return COMMAND_NAME_MAP[key] != null ? COMMAND_NAME_MAP[key] : name;
    });
    str = str.replace(/\\([{}])/g, '$1');
    str = str.replace(/\\%/g, '%');
    str = str.replace(/\\#/g, '#');
    str = str.replace(/\\&/g, '&');
    str = str.replace(/\\_/g, '_');
    str = str.replace(/\\\^/g, '^');
    str = str.replace(/\^\{([^{}]+)\}/g, '^($1)');
    str = str.replace(/_\{([^{}]+)\}/g, '_($1)');
    str = str.replace(/\^\(([^()]+)\)/g, '^$1');
    str = str.replace(/_\(([^()]+)\)/g, '_$1');
    str = str.replace(/[{}]/g, '');
    return str;
  }
  function replaceAsciiFractions(str) {
    if (typeof str !== 'string' || !str.toLowerCase().includes('frac(')) {
      return typeof str === 'string' ? str : '';
    }
    let out = str;
    let idx = out.toLowerCase().indexOf('frac(');
    while (idx !== -1) {
      let pos = idx + 5;
      let depth = 0;
      let comma = -1;
      for (let i = pos; i < out.length; i += 1) {
        const ch = out[i];
        if (ch === '(') {
          depth += 1;
        } else if (ch === ')') {
          if (depth === 0) break;
          depth -= 1;
        } else if (ch === ',' && depth === 0) {
          comma = i;
          break;
        }
      }
      if (comma === -1) break;
      depth = 0;
      let end = -1;
      for (let i = comma + 1; i < out.length; i += 1) {
        const ch = out[i];
        if (ch === '(') {
          depth += 1;
        } else if (ch === ')') {
          if (depth === 0) {
            end = i;
            break;
          }
          depth -= 1;
        }
      }
      if (end === -1) break;
      const numerator = replaceAsciiFractions(out.slice(idx + 5, comma).trim());
      const denominator = replaceAsciiFractions(out.slice(comma + 1, end).trim());
      out = `${out.slice(0, idx)}(${numerator})/(${denominator})${out.slice(end + 1)}`;
      idx = out.toLowerCase().indexOf('frac(');
    }
    return out;
  }
  function convertAsciiMathLikeToPlain(ascii) {
    if (typeof ascii !== 'string') return '';
    let str = ascii;
    str = replaceAsciiFractions(str);
    str = str.replace(/·|⋅/g, '*');
    str = str.replace(/÷/g, '/');
    str = str.replace(/−/g, '-');
    str = str.replace(/\*\*/g, '^');
    str = str.replace(/\bsqrt\s*\(/gi, 'sqrt(');
    str = str.replace(/\bpi\b/gi, 'pi');
    str = str.replace(/\btau\b/gi, 'tau');
    return str;
  }
  function collapseExpressionWhitespace(text) {
    return String(text).replace(/\u00a0/g, ' ').replace(/[\t\r\f]+/g, ' ').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim();
  }
  function normalizePlainExpression(value) {
    if (value == null) return '';
    const raw = collapseExpressionWhitespace(String(value));
    if (!raw) return '';
    let normalized;
    if (raw.includes('\\')) {
      normalized = convertLatexLikeToPlain(raw);
    } else {
      normalized = convertAsciiMathLikeToPlain(raw);
    }
    normalized = collapseExpressionWhitespace(normalized);
    normalized = normalized.replace(EXPRESSION_PREFIX_REGEX, '');
    return collapseExpressionWhitespace(normalized);
  }
  const ASCII_TO_LATEX_COMMANDS = {
    pi: '\\pi',
    tau: '\\tau',
    theta: '\\theta',
    alpha: '\\alpha',
    beta: '\\beta',
    gamma: '\\gamma',
    phi: '\\varphi'
  };
  const FUNCTION_LATEX_BUILDERS = {
    sqrt: arg => `\\sqrt{${arg}}`,
    abs: arg => `\\left|${arg}\\right|`,
    asin: arg => `\\arcsin\\left(${arg}\\right)`,
    acos: arg => `\\arccos\\left(${arg}\\right)`,
    atan: arg => `\\arctan\\left(${arg}\\right)`,
    sin: arg => `\\sin\\left(${arg}\\right)`,
    cos: arg => `\\cos\\left(${arg}\\right)`,
    tan: arg => `\\tan\\left(${arg}\\right)`,
    sinh: arg => `\\sinh\\left(${arg}\\right)`,
    cosh: arg => `\\cosh\\left(${arg}\\right)`,
    tanh: arg => `\\tanh\\left(${arg}\\right)`,
    ln: arg => `\\ln\\left(${arg}\\right)`,
    log: arg => `\\log\\left(${arg}\\right)`,
    exp: arg => `\\exp\\left(${arg}\\right)`
  };
  const FUNCTION_NAME_LIST = Object.keys(FUNCTION_LATEX_BUILDERS).sort((a, b) => b.length - a.length);
  function applyFunctionLatexConversions(str) {
    if (typeof str !== 'string' || !str) {
      return typeof str === 'string' ? str : '';
    }
    let result = '';
    let index = 0;
    const lower = str.toLowerCase();
    while (index < str.length) {
      let replaced = false;
      for (const name of FUNCTION_NAME_LIST) {
        const len = name.length;
        if (
          lower.startsWith(name, index) &&
          (index === 0 || !/[a-z0-9_]/i.test(lower[index - 1]))
        ) {
          let pos = index + len;
          while (pos < str.length && /\s/.test(str[pos])) pos += 1;
          if (pos < str.length && str[pos] === '(') {
            const group = readParenthesisGroup(str, pos);
            if (group[1] > pos + 1) {
              const convertedArg = convertPlainExpressionToLatex(group[0]);
              result += FUNCTION_LATEX_BUILDERS[name](convertedArg);
              index = group[1];
              replaced = true;
              break;
            }
          }
        }
      }
      if (!replaced) {
        result += str[index];
        index += 1;
      }
    }
    return result;
  }
  function convertPlainExpressionToLatex(expr) {
    if (typeof expr !== 'string') return '';
    const trimmed = collapseExpressionWhitespace(expr);
    if (!trimmed) return '';
    let str = trimmed;
    str = restorePlainFractionsToLatex(str);
    str = str.replace(/\*\*/g, '^');
    str = applyFunctionLatexConversions(str);
    Object.keys(ASCII_TO_LATEX_COMMANDS).forEach(key => {
      const pattern = new RegExp(`\\b${key}\\b`, 'gi');
      str = str.replace(pattern, ASCII_TO_LATEX_COMMANDS[key]);
    });
    str = str.replace(/\+\/-/g, '\\pm ');
    str = str.replace(/([0-9a-zA-Z\\}\)])\s*\*\s*([0-9a-zA-Z\\({\\])/g, '$1\\cdot $2');
    str = str.replace(/(\d)\s*deg\b/gi, '$1^{\\circ}');
    return str;
  }
  function restorePlainFractionsToLatex(str) {
    if (typeof str !== 'string' || !str.includes('/')) {
      return typeof str === 'string' ? str : '';
    }
    let result = '';
    let index = 0;
    while (index < str.length) {
      const slashIndex = str.indexOf('/', index);
      if (slashIndex === -1) {
        result += str.slice(index);
        break;
      }
      let leftEnd = slashIndex - 1;
      while (leftEnd >= index && /\s/.test(str[leftEnd])) {
        leftEnd -= 1;
      }
      if (leftEnd < index || str[leftEnd] !== ')') {
        result += str.slice(index, slashIndex + 1);
        index = slashIndex + 1;
        continue;
      }
      const leftGroup = readParenthesisGroupBackward(str, leftEnd);
      if (!leftGroup[0] || leftGroup[1] < index) {
        result += str.slice(index, slashIndex + 1);
        index = slashIndex + 1;
        continue;
      }
      let rightStart = slashIndex + 1;
      while (rightStart < str.length && /\s/.test(str[rightStart])) {
        rightStart += 1;
      }
      if (rightStart >= str.length || str[rightStart] !== '(') {
        result += str.slice(index, slashIndex + 1);
        index = slashIndex + 1;
        continue;
      }
      const rightGroup = readParenthesisGroup(str, rightStart);
      if (!rightGroup[0] || rightGroup[1] <= rightStart + 1) {
        result += str.slice(index, slashIndex + 1);
        index = slashIndex + 1;
        continue;
      }
      const numeratorLatex = convertPlainExpressionToLatex(leftGroup[0]);
      const denominatorLatex = convertPlainExpressionToLatex(rightGroup[0]);
      result += str.slice(index, leftGroup[1]);
      result += `\\frac{${numeratorLatex}}{${denominatorLatex}}`;
      index = rightGroup[1];
    }
    return result;
  }
  function ensureMathFieldOptions(field) {
    if (field && typeof field.setOptions === 'function') {
      field.setOptions({
        smartMode: false,
        virtualKeyboardMode: 'off'
      });
    }
  }
  function getRawExpressionInputValue() {
    if (!exprInput) return '';
    const tag = exprInput.tagName ? exprInput.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG) {
      ensureMathFieldOptions(exprInput);
      let raw = tryGetMathFieldValue(exprInput, 'ascii-math');
      if (!raw) {
        raw = tryGetMathFieldValue(exprInput, 'ASCIIMath');
      }
      if (!raw) {
        raw = tryGetMathFieldValue(exprInput, 'latex');
      }
      if (!raw && typeof exprInput.value === 'string') {
        raw = exprInput.value;
      }
      return typeof raw === 'string' ? raw : '';
    }
    const val = exprInput.value != null ? exprInput.value : '';
    return typeof val === 'string' ? val : '';
  }
  function getExpressionInputValue() {
    const raw = getRawExpressionInputValue();
    return normalizePlainExpression(raw);
  }
  function readExpressionInputDetails() {
    const raw = getRawExpressionInputValue();
    const sanitized = normalizePlainExpression(raw);
    let prefixSource = collapseExpressionWhitespace(String(raw));
    if (prefixSource.includes('\\')) {
      prefixSource = collapseExpressionWhitespace(convertLatexLikeToPlain(prefixSource));
    } else {
      prefixSource = collapseExpressionWhitespace(convertAsciiMathLikeToPlain(prefixSource));
    }
    const hasPrefix = EXPRESSION_PREFIX_REGEX.test(prefixSource);
    return {
      sanitized,
      hasPrefix
    };
  }
  function setExpressionInputValue(value) {
    if (!exprInput) return;
    const str = value != null ? String(value) : '';
    const display = str.replace(EXPRESSION_PREFIX_REGEX, '');
    const tag = exprInput.tagName ? exprInput.tagName.toUpperCase() : '';
    isUpdatingExpressionInput = true;
    try {
      if (tag === MATHFIELD_TAG) {
        ensureMathFieldOptions(exprInput);
        let setSuccessful = false;
        if (typeof exprInput.setValue === 'function') {
          try {
            exprInput.setValue(display, { format: 'ascii-math' });
            setSuccessful = true;
          } catch (err) {
            /* ignore */
          }
        }
        if (!setSuccessful) {
          exprInput.value = display;
        }
      } else {
        exprInput.value = display;
      }
    } finally {
      isUpdatingExpressionInput = false;
    }
  }
  if (!svg || !exprInput) {
    return;
  }
  const DEFAULT_AUTO_DOMAIN = {
    min: -5,
    max: 5
  };
  const DEFAULT_DECIMAL_PLACES = 4;
  const MIN_DECIMAL_PLACES = 0;
  const MAX_DECIMAL_PLACES = 6;
  const globalState = typeof window !== 'undefined' && window.STATE && typeof window.STATE === 'object' ? window.STATE : {};
  const state = globalState;
  if (!Object.prototype.hasOwnProperty.call(state, 'expression') || state.expression == null) {
    state.expression = 'x-1';
  }
  if (!Object.prototype.hasOwnProperty.call(state, 'expressionPrefix')) {
    state.expressionPrefix = false;
  }
  if (typeof window !== 'undefined') {
    window.STATE = state;
  }
  if (typeof state.altText !== 'string') {
    state.altText = '';
  }
  if (state.altTextSource !== 'manual') {
    state.altTextSource = 'auto';
  }
  const isMathFieldInput = exprInput && exprInput.tagName && exprInput.tagName.toUpperCase() === MATHFIELD_TAG;
  if (isMathFieldInput) {
    ensureMathFieldOptions(exprInput);
    exprInput.addEventListener('math-field-ready', () => {
      ensureMathFieldOptions(exprInput);
      setExpressionInputValue(state.expression || '');
      renderExpressionDisplay();
    });
  } else {
    setExpressionInputValue(state.expression || '');
  }
  function sanitizeDomain(domain) {
    const sanitized = {
      min: null,
      max: null
    };
    if (domain && typeof domain === 'object') {
      const min = Number.parseFloat(domain.min);
      const max = Number.parseFloat(domain.max);
      if (Number.isFinite(min)) {
        sanitized.min = min;
      }
      if (Number.isFinite(max)) {
        sanitized.max = max;
      }
    }
    return sanitized;
  }
  function sanitizeAutoDomain(auto) {
    const sanitized = {
      min: DEFAULT_AUTO_DOMAIN.min,
      max: DEFAULT_AUTO_DOMAIN.max
    };
    if (auto && typeof auto === 'object') {
      const min = Number.parseFloat(auto.min);
      const max = Number.parseFloat(auto.max);
      if (Number.isFinite(min)) {
        sanitized.min = min;
      }
      if (Number.isFinite(max)) {
        sanitized.max = max;
      }
    }
    return sanitized;
  }
  function sanitizeSegments(segments) {
    if (!Array.isArray(segments)) {
      return [];
    }
    return segments.map(value => value >= 0 ? 1 : -1);
  }
  function sanitizePalette(palette) {
    if (!palette || typeof palette !== 'object') {
      return null;
    }
    const sanitized = {};
    let hasValue = false;
    ['axis', 'grid', 'positive', 'negative', 'text'].forEach(key => {
      if (typeof palette[key] === 'string' && palette[key].trim()) {
        sanitized[key] = palette[key];
        hasValue = true;
      }
    });
    return hasValue ? sanitized : null;
  }
  function sanitizePointsArray(points) {
    if (!Array.isArray(points)) {
      return [];
    }
    const usedIds = new Set();
    return points.reduce((acc, point, index) => {
      if (!point || typeof point !== 'object') {
        return acc;
      }
      const rawValue = Number.parseFloat(point.value);
      if (!Number.isFinite(rawValue)) {
        return acc;
      }
      const type = point.type === 'pole' ? 'pole' : 'zero';
      let id = typeof point.id === 'string' ? point.id.trim() : '';
      if (!id) {
        id = `p${index + 1}`;
      }
      while (usedIds.has(id)) {
        id = `p${acc.length + 1}`;
      }
      usedIds.add(id);
      const multiplicityRaw = Number.parseInt(point.multiplicity, 10);
      const multiplicity = Number.isFinite(multiplicityRaw) ? multiplicityRaw : 1;
      acc.push({
        id,
        type,
        value: rawValue,
        multiplicity
      });
      return acc;
    }, []);
  }
  function sanitizeRowsArray(rows) {
    if (!Array.isArray(rows)) {
      return [];
    }
    const usedIds = new Set();
    return rows.reduce((acc, row, index) => {
      if (!row || typeof row !== 'object') {
        return acc;
      }
      let id = typeof row.id === 'string' ? row.id.trim() : '';
      if (!id) {
        id = `row-${index + 1}`;
      }
      while (usedIds.has(id)) {
        id = `row-${acc.length + 1}`;
      }
      usedIds.add(id);
      const role = row.role === 'result' || row.role === 'factor' ? row.role : 'custom';
      const locked = role === 'factor' ? true : !!row.locked;
      const normalized = {
        id,
        label: typeof row.label === 'string' ? row.label : '',
        segments: sanitizeSegments(row.segments),
        role,
        locked
      };
      if (role === 'factor') {
        normalized.type = row.type === 'pole' ? 'pole' : 'zero';
        const value = Number.parseFloat(row.value);
        if (Number.isFinite(value)) {
          normalized.value = value;
        }
        const multiplicity = Number.parseInt(row.multiplicity, 10);
        if (Number.isFinite(multiplicity)) {
          normalized.multiplicity = multiplicity;
        }
      }
      acc.push(normalized);
      return acc;
    }, []);
  }
  function sanitizeSolution(solution) {
    if (!solution || typeof solution !== 'object') {
      return null;
    }
    const points = sanitizePointsArray(solution.points);
    const segments = sanitizeSegments(solution.segments);
    const factorRows = Array.isArray(solution.factorRows) ? solution.factorRows.reduce((acc, row) => {
      if (!row || typeof row !== 'object') {
        return acc;
      }
      acc.push({
        label: typeof row.label === 'string' ? row.label : '',
        segments: sanitizeSegments(row.segments),
        type: row.type === 'pole' ? 'pole' : 'zero',
        value: Number.isFinite(Number(row.value)) ? Number(row.value) : undefined,
        multiplicity: Number.isFinite(Number(row.multiplicity)) ? Number(row.multiplicity) : undefined
      });
      return acc;
    }, []) : [];
    const domain = solution.domain && typeof solution.domain === 'object' ? {
      min: Number.isFinite(Number(solution.domain.min)) ? Number(solution.domain.min) : null,
      max: Number.isFinite(Number(solution.domain.max)) ? Number(solution.domain.max) : null
    } : {
      min: null,
      max: null
    };
    return {
      points,
      segments,
      factorRows,
      domain,
      expression: typeof solution.expression === 'string' ? solution.expression : ''
    };
  }
  function sanitizeState(target) {
    if (!target || typeof target !== 'object') {
      return;
    }
    const exprRaw = typeof target.expression === 'string' ? target.expression : '';
    target.expression = normalizePlainExpression(exprRaw);
    target.expressionPrefix = !!target.expressionPrefix;
    target.autoSync = !!target.autoSync;
    target.useLinearFactors = !!target.useLinearFactors;
    const decimals = Number.isFinite(Number(target.decimalPlaces)) ? Number(target.decimalPlaces) : DEFAULT_DECIMAL_PLACES;
    target.decimalPlaces = clampDecimalPlaces(decimals);
    target.domain = sanitizeDomain(target.domain);
    target.autoDomain = sanitizeAutoDomain(target.autoDomain);
    target.criticalPoints = sanitizePointsArray(target.criticalPoints);
    target.signRows = sanitizeRowsArray(target.signRows).filter(row => {
      if (!row || typeof row.label !== 'string') {
        return true;
      }
      const normalizedLabel = row.label.trim().toLowerCase();
      if (normalizedLabel !== 'observasjon') {
        return true;
      }
      if (row.role === 'result' || row.role === 'factor') {
        return true;
      }
      return false;
    });
    target.solution = sanitizeSolution(target.solution);
    if (typeof target.altText !== 'string') {
      target.altText = '';
    }
    target.altTextSource = target.altTextSource === 'manual' ? 'manual' : 'auto';
    const palette = sanitizePalette(target.palette);
    target.palette = palette || null;
  }
  function createCleanState() {
    const points = sanitizePointsArray(state.criticalPoints);
    const rows = sanitizeRowsArray(state.signRows);
    const resultRow = rows.find(row => row.role === 'result');
    return {
      v: 1,
      expression: typeof state.expression === 'string' ? state.expression : '',
      expressionPrefix: !!state.expressionPrefix,
      autoDomain: sanitizeAutoDomain(state.autoDomain),
      domain: sanitizeDomain(state.domain),
      decimalPlaces: clampDecimalPlaces(state.decimalPlaces),
      points,
      segments: sanitizeSegments(resultRow ? resultRow.segments : []),
      rows,
      palette: sanitizePalette(state.palette) || { ...chartPalette },
      altText: typeof state.altText === 'string' ? state.altText : '',
      altTextSource: state.altTextSource === 'manual' ? 'manual' : 'auto'
    };
  }
  function deepClone(value) {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {}
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {}
    return value;
  }
  function loadCleanState(payload) {
    if (!payload || payload.v !== 1) {
      return false;
    }
    const sanitizedSegments = sanitizeSegments(payload.segments);
    const palette = sanitizePalette(payload.palette);
    const mergedRows = sanitizeRowsArray(payload.rows);
    const existingResult = mergedRows.find(row => row.role === 'result');
    if (sanitizedSegments.length) {
      if (existingResult) {
        existingResult.segments = sanitizedSegments.slice();
      } else {
        mergedRows.unshift({
          id: `row-${rowIdCounter++}`,
          label: 'f(x)',
          segments: sanitizedSegments.slice(),
          role: 'result',
          locked: false
        });
      }
    }
    Object.assign(state, {
      expression: typeof payload.expression === 'string' ? payload.expression : '',
      expressionPrefix: !!payload.expressionPrefix,
      autoDomain: sanitizeAutoDomain(payload.autoDomain),
      domain: sanitizeDomain(payload.domain),
      decimalPlaces: clampDecimalPlaces(Number(payload.decimalPlaces)),
      criticalPoints: sanitizePointsArray(payload.points),
      signRows: mergedRows,
      altText: typeof payload.altText === 'string' ? payload.altText : '',
      altTextSource: payload.altTextSource === 'manual' ? 'manual' : 'auto',
      palette: palette || null,
      solution: null
    });
    sanitizeState(state);
    applyFortegnsskjemaPalette({ palette: state.palette });
    renderAll();
    refreshAltText('config');
    return true;
  }
  function computeNextId(items, pattern, startIndex) {
    let max = startIndex - 1;
    (items || []).forEach(item => {
      if (!item || typeof item.id !== 'string') {
        return;
      }
      const match = item.id.match(pattern);
      if (!match) {
        return;
      }
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value > max) {
        max = value;
      }
    });
    return max + 1;
  }
  function updateIdCounters() {
    pointIdCounter = computeNextId(state.criticalPoints, /^p(\d+)$/i, 1);
    rowIdCounter = computeNextId(state.signRows, /^row-(\d+)$/i, 1);
  }
  sanitizeState(state);
  applyFortegnsskjemaPalette({ palette: state.palette });
  function pruneFactorRowsIfDisabled() {
    if (!Array.isArray(state.signRows)) {
      state.signRows = [];
      return;
    }
    if (state.useLinearFactors) {
      return;
    }
    state.signRows = state.signRows.filter(row => {
      if (!row) {
        return false;
      }
      if (row.role === 'factor') {
        return false;
      }
      if (row.locked && row.role !== 'result') {
        return false;
      }
      return true;
    });
  }
  pruneFactorRowsIfDisabled();
  let pointIdCounter = 1;
  let rowIdCounter = 1;
  updateIdCounters();
  let currentScale = null;
  let dragging = null;
  let dragDomainLock = null;
  function clampDecimalPlaces(value) {
    if (!Number.isFinite(value)) {
      return MIN_DECIMAL_PLACES;
    }
    return Math.min(MAX_DECIMAL_PLACES, Math.max(MIN_DECIMAL_PLACES, Math.round(value)));
  }
  function getDecimalPlaces() {
    return clampDecimalPlaces(state.decimalPlaces);
  }
  function getNumberStep() {
    const decimals = getDecimalPlaces();
    if (decimals <= 0) {
      return '1';
    }
    return (1 / Math.pow(10, decimals)).toString();
  }
  state.decimalPlaces = clampDecimalPlaces(state.decimalPlaces);
  function formatPointValue(value) {
    if (!Number.isFinite(value)) {
      return '';
    }
    const decimals = getDecimalPlaces();
    const rounded = Number.parseFloat(value.toFixed(decimals));
    if (!Number.isFinite(rounded)) {
      return `${value}`;
    }
    if (Object.is(rounded, -0)) {
      return '0';
    }
    return `${rounded}`;
  }
  function createDefaultRow() {
    if (!state.signRows.length) {
      state.signRows.push({
        id: `row-${rowIdCounter++}`,
        label: 'f(x)',
        segments: [1],
        role: 'result',
        locked: false
      });
    }
  }
  function sortPoints() {
    state.criticalPoints.sort((a, b) => a.value - b.value);
  }
  function syncSegments() {
    const expected = state.criticalPoints.length + 1;
    state.signRows.forEach(row => {
      if (!Array.isArray(row.segments)) {
        row.segments = [];
      }
      if (expected <= 0) {
        row.segments = [1];
        return;
      }
      if (row.segments.length === 0) {
        row.segments = Array(expected).fill(1);
      } else if (row.segments.length > expected) {
        row.segments = row.segments.slice(0, expected);
      } else if (row.segments.length < expected) {
        var _row$segments;
        const last = (_row$segments = row.segments[row.segments.length - 1]) !== null && _row$segments !== void 0 ? _row$segments : 1;
        while (row.segments.length < expected) {
          row.segments.push(last);
        }
      }
    });
    if (!state.signRows.length) {
      createDefaultRow();
    }
  }
  function sanitizeExpression(raw) {
    const normalized = normalizePlainExpression(raw);
    if (!normalized) return '';
    let expr = normalized.replace(/,/g, '.').replace(/\s+/g, '');
    expr = expr.toLowerCase();
    expr = expr.replace(/([0-9x)])\(/g, '$1*(');
    expr = expr.replace(/\)([0-9x])/g, ')*$1');
    expr = expr.replace(/(x)([0-9])/g, '$1*$2');
    expr = expr.replace(/([0-9])(x)/g, '$1*$2');
    expr = expr.replace(/\^/g, '**');
    return expr;
  }
  function createSafeFunction(expr) {
    try {
      return new Function('x', `with(Math){return ${expr};}`);
    } catch (err) {
      return null;
    }
  }
  function stripOuterParens(str) {
    let result = str.trim();
    while (result.startsWith('(') && result.endsWith(')')) {
      let depth = 0;
      let balanced = true;
      for (let i = 0; i < result.length; i += 1) {
        const ch = result[i];
        if (ch === '(') depth += 1;else if (ch === ')') {
          depth -= 1;
          if (depth === 0 && i < result.length - 1) {
            balanced = false;
            break;
          }
          if (depth < 0) {
            balanced = false;
            break;
          }
        }
      }
      if (balanced && depth === 0) {
        result = result.slice(1, -1).trim();
      } else {
        break;
      }
    }
    return result;
  }
  function splitByMultiplication(str) {
    const parts = [];
    let current = '';
    let depth = 0;
    for (let i = 0; i < str.length; i += 1) {
      const ch = str[i];
      if (ch === '(') {
        depth += 1;
        current += ch;
        continue;
      }
      if (ch === ')') {
        depth -= 1;
        current += ch;
        continue;
      }
      if (ch === '*' && depth === 0) {
        if (str[i + 1] === '*') {
          current += '**';
          i += 1;
          continue;
        }
        parts.push(current);
        current = '';
        continue;
      }
      current += ch;
    }
    if (current) parts.push(current);
    return parts;
  }
  function evaluateConstant(expr) {
    const fn = createSafeFunction(expr);
    if (!fn) return null;
    try {
      const v0 = fn(0);
      const v1 = fn(1);
      if (!Number.isFinite(v0) || !Number.isFinite(v1)) return null;
      if (Math.abs(v0 - v1) > 1e-6) return null;
      if (Math.abs(v0) < 1e-10) return 0;
      return v0;
    } catch (err) {
      return null;
    }
  }
  function parseLinearFactor(segment) {
    let str = segment.trim();
    if (!str) return null;
    let exponent = 1;
    const expMatch = str.match(/^(.*?)(?:\*\*|\^)(-?\d+)$/);
    if (expMatch) {
      exponent = parseInt(expMatch[2], 10);
      if (!Number.isFinite(exponent) || exponent < 1) exponent = 1;
      str = expMatch[1];
    }
    str = stripOuterParens(str);
    const baseExpr = str;
    if (!/x/.test(str)) {
      return null;
    }
    const fn = createSafeFunction(str);
    if (!fn) return null;
    try {
      const f0 = fn(0);
      const f1 = fn(1);
      if (!Number.isFinite(f0) || !Number.isFinite(f1)) return null;
      const slope = f1 - f0;
      if (Math.abs(slope) < 1e-9) return null;
      const intercept = f0;
      for (const point of LINEAR_VALIDATION_POINTS) {
        if (point === 0 || point === 1) continue;
        const actual = fn(point);
        if (!Number.isFinite(actual)) {
          return null;
        }
        const expected = slope * point + intercept;
        const tolerance = LINEAR_VALIDATION_TOLERANCE * (1 + Math.max(Math.abs(expected), Math.abs(actual)));
        if (Math.abs(actual - expected) > tolerance) {
          return null;
        }
      }
      const root = -intercept / slope;
      if (!Number.isFinite(root)) return null;
      const sign = slope >= 0 ? 1 : -1;
      return {
        root,
        multiplicity: exponent,
        sign,
        baseExpr
      };
    } catch (err) {
      return null;
    }
  }
  function parseProduct(value) {
    let str = stripOuterParens(value);
    if (!str) {
      return {
        factors: [],
        constantSign: 1,
        parsed: true
      };
    }
    const parts = splitByMultiplication(str);
    const factors = [];
    let constantSign = 1;
    let parsedAnything = false;
    for (const part of parts) {
      const clean = stripOuterParens(part);
      if (!clean) continue;
      const factor = parseLinearFactor(clean);
      if (factor) {
        factors.push({
          value: factor.root,
          multiplicity: factor.multiplicity,
          sign: factor.sign,
          baseExpr: factor.baseExpr
        });
        if (factor.sign < 0 && factor.multiplicity % 2 === 1) {
          constantSign *= -1;
        }
        parsedAnything = true;
        continue;
      }
      const constant = evaluateConstant(clean);
      if (constant === null) {
        return null;
      }
      if (constant < 0) {
        constantSign *= -1;
      }
      parsedAnything = true;
    }
    return {
      factors,
      constantSign,
      parsed: parsedAnything
    };
  }
  function tokenizeExpression(expr) {
    const tokens = [];
    let current = '';
    let depth = 0;
    let currentOp = '*';
    for (let i = 0; i < expr.length; i += 1) {
      const ch = expr[i];
      if (ch === '(') {
        depth += 1;
        current += ch;
        continue;
      }
      if (ch === ')') {
        depth -= 1;
        current += ch;
        continue;
      }
      if ((ch === '*' || ch === '/') && depth === 0) {
        if (ch === '*' && expr[i + 1] === '*') {
          current += '**';
          i += 1;
          continue;
        }
        tokens.push({
          operator: currentOp,
          value: current
        });
        current = '';
        currentOp = ch;
        continue;
      }
      current += ch;
    }
    tokens.push({
      operator: currentOp,
      value: current
    });
    return tokens.filter(token => token.value !== '');
  }
  function extractStructure(expr) {
    const tokens = tokenizeExpression(expr);
    const zeros = [];
    const poles = [];
    const factors = [];
    let constantSign = 1;
    const unparsed = [];
    tokens.forEach(token => {
      const parsed = parseProduct(token.value);
      if (!parsed || !parsed.parsed) {
        unparsed.push({
          operator: token.operator,
          expression: token.value
        });
        return;
      }
      const destination = token.operator === '/' ? poles : zeros;
      const type = token.operator === '/' ? 'pole' : 'zero';
      parsed.factors.forEach(factor => {
        destination.push({
          value: factor.value,
          multiplicity: factor.multiplicity
        });
        factors.push({
          type,
          value: factor.value,
          multiplicity: factor.multiplicity,
          sign: factor.sign ?? 1,
          baseExpr: factor.baseExpr
        });
      });
      if (parsed.constantSign < 0) {
        constantSign *= -1;
      }
    });
    return {
      zeros,
      poles,
      constantSign,
      factors,
      unparsed
    };
  }
  function normalizePointValue(value) {
    if (!Number.isFinite(value)) return null;
    return Number.parseFloat(Number(value).toFixed(6));
  }
  function makePointKey(type, value) {
    return `${type}:${value}`;
  }
  function buildPoints(structure) {
    const map = new Map();
    function addEntries(entries, type) {
      entries.forEach(entry => {
        const normalized = normalizePointValue(entry.value);
        if (normalized == null) return;
        const key = makePointKey(type, normalized);
        if (map.has(key)) {
          map.get(key).multiplicity += entry.multiplicity;
        } else {
          map.set(key, {
            value: normalized,
            type,
            multiplicity: entry.multiplicity
          });
        }
      });
    }
    addEntries(structure.zeros, 'zero');
    addEntries(structure.poles, 'pole');
    return Array.from(map.values()).sort((a, b) => a.value - b.value);
  }
  function formatLinearFactorLabel(baseExpr, multiplicity, value) {
    let core = typeof baseExpr === 'string' ? baseExpr.trim() : '';
    if (!core && Number.isFinite(value)) {
      const formatted = formatPointValue(Math.abs(value));
      const sign = value >= 0 ? '-' : '+';
      core = `x${sign}${formatted}`;
    }
    if (!core) {
      core = 'x';
    }
    let label = core;
    const trimmed = core.trim();
    if (!((trimmed.startsWith('(') && trimmed.endsWith(')')) || (trimmed.startsWith('-(') && trimmed.endsWith(')')))) {
      label = `(${trimmed})`;
    }
    if (multiplicity > 1) {
      label += `^${multiplicity}`;
    }
    return label;
  }
  function buildFallbackFactorRows(points, domain) {
    if (!Array.isArray(points) || !points.length || !domain) {
      return [];
    }
    const sorted = [...points].sort((a, b) => a.value - b.value);
    const zeroPoints = sorted.filter(point => point && point.type === 'zero');
    if (zeroPoints.length <= 1) {
      return [];
    }
    const boundaries = [domain.min, ...sorted.map(p => p.value), domain.max];
    return zeroPoints.map(point => {
      const multiplicityRaw = Number.isFinite(point.multiplicity) ? Math.round(point.multiplicity) : 1;
      const multiplicity = Math.max(1, Math.abs(multiplicityRaw));
      const segments = [];
      for (let i = 0; i < boundaries.length - 1; i += 1) {
        const left = boundaries[i];
        const right = boundaries[i + 1];
        let signValue = 1;
        if (multiplicity % 2 === 1) {
          if (Number.isFinite(point.value)) {
            if (Number.isFinite(right) && right <= point.value) {
              signValue = -1;
            } else if (Number.isFinite(left) && left >= point.value) {
              signValue = 1;
            } else if (!Number.isFinite(right) && (Number.isFinite(left) ? left : 0) >= point.value) {
              signValue = 1;
            } else if (!Number.isFinite(left) && (Number.isFinite(right) ? right : 0) <= point.value) {
              signValue = -1;
            } else {
              let sample = chooseSample(left, right);
              if (!Number.isFinite(sample)) {
                sample = point.value + (i === 0 ? -1 : 1);
              }
              if (Math.abs(sample - point.value) < 1e-6) {
                sample += sample >= point.value ? 1e-3 : -1e-3;
              }
              signValue = sample >= point.value ? 1 : -1;
            }
          } else {
            let sample = chooseSample(left, right);
            if (!Number.isFinite(sample)) sample = 0;
            signValue = sample >= 0 ? 1 : -1;
          }
        }
        segments.push(signValue >= 0 ? 1 : -1);
      }
      return {
        label: formatLinearFactorLabel('', multiplicity, point.value),
        segments,
        type: 'zero',
        value: point.value,
        multiplicity
      };
    });
  }
  function buildLinearFactorRows(structure, points, domain) {
    const sortedPoints = Array.isArray(points) ? [...points].sort((a, b) => a.value - b.value) : [];
    const boundaries = [domain.min, ...sortedPoints.map(p => p.value), domain.max];
    const comparator = (a, b) => {
      if (a.type !== b.type) {
        if (a.type === 'pole') return 1;
        if (b.type === 'pole') return -1;
      }
      const av = Number.isFinite(a.value) ? a.value : 0;
      const bv = Number.isFinite(b.value) ? b.value : 0;
      return av - bv;
    };
    let factorRows = [];
    if (structure && Array.isArray(structure.factors) && structure.factors.length) {
      const factorMap = new Map();
      structure.factors.forEach(factor => {
        if (!Number.isFinite(factor.value)) return;
        const normalized = Number.parseFloat(Number(factor.value).toFixed(6));
        const baseKey = typeof factor.baseExpr === 'string' && factor.baseExpr.trim() ? factor.baseExpr.trim() : `${normalized}`;
        const key = `${factor.type}:${baseKey}`;
        if (!factorMap.has(key)) {
          factorMap.set(key, {
            type: factor.type,
            value: factor.value,
            multiplicity: 0,
            constantSign: 1,
            baseExpr: factor.baseExpr
          });
        }
        const entry = factorMap.get(key);
        entry.multiplicity += factor.multiplicity;
        const contribution = factor.sign === -1 && factor.multiplicity % 2 === 1 ? -1 : 1;
        entry.constantSign *= contribution;
        if (!entry.baseExpr && factor.baseExpr) {
          entry.baseExpr = factor.baseExpr;
        }
      });
      factorRows = Array.from(factorMap.values()).sort(comparator).map(entry => {
        const label = formatLinearFactorLabel(entry.baseExpr, entry.multiplicity, entry.value);
        const segments = [];
        for (let i = 0; i < boundaries.length - 1; i += 1) {
          const left = boundaries[i];
          const right = boundaries[i + 1];
          let signValue = entry.constantSign || 1;
          if (entry.multiplicity % 2 === 1) {
            let sample = chooseSample(left, right);
            if (!Number.isFinite(sample)) {
              sample = left + (right - left) / 2;
            }
            if (!Number.isFinite(sample)) {
              sample = entry.value;
            }
            if (Math.abs(sample - entry.value) < 1e-6) {
              sample += 1e-3;
            }
            const direction = sample >= entry.value ? 1 : -1;
            signValue *= direction;
          }
          segments.push(signValue >= 0 ? 1 : -1);
        }
        return {
          label,
          segments,
          type: entry.type,
          value: entry.value,
          multiplicity: entry.multiplicity
        };
      });
    }
    const fallbackRows = buildFallbackFactorRows(sortedPoints, domain);
    if (!factorRows.length) {
      factorRows = fallbackRows;
    } else if (fallbackRows.length) {
      const seen = new Set(factorRows.map(row => `${row.type}:${Number.isFinite(row.value) ? row.value.toFixed(6) : row.value}`));
      fallbackRows.forEach(row => {
        const key = `${row.type}:${Number.isFinite(row.value) ? row.value.toFixed(6) : row.value}`;
        if (!seen.has(key)) {
          factorRows.push(row);
          seen.add(key);
        }
      });
      factorRows.sort(comparator);
    }
    if (factorRows.length <= 1) {
      return [];
    }
    return factorRows;
  }
  function computeAutoDomain(points) {
    if (!points.length) {
      state.autoDomain = { ...DEFAULT_AUTO_DOMAIN };
      return state.autoDomain;
    }
    const values = points.map(p => p.value).filter(value => Number.isFinite(value));
    if (!values.length) {
      state.autoDomain = { ...DEFAULT_AUTO_DOMAIN };
      return state.autoDomain;
    }
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    if (values.length === 1) {
      const value = values[0];
      const prevMin = state.autoDomain && Number.isFinite(state.autoDomain.min) ? state.autoDomain.min : value - 2;
      const prevMax = state.autoDomain && Number.isFinite(state.autoDomain.max) ? state.autoDomain.max : value + 2;
      let min = prevMin;
      let max = prevMax;
      if (!(max > min)) {
        const span = 4;
        min = value - span / 2;
        max = value + span / 2;
      }
      const span = Math.max(max - min, 1e-6);
      const margin = Math.max(span * 0.2, 1);
      if (value < min + margin) {
        const shift = min + margin - value;
        min -= shift;
        max -= shift;
      } else if (value > max - margin) {
        const shift = value - (max - margin);
        min += shift;
        max += shift;
      }
      state.autoDomain = {
        min,
        max
      };
      return state.autoDomain;
    }
    let min = minValue;
    let max = maxValue;
    if (Math.abs(max - min) < 1e-6) {
      min -= 1;
      max += 1;
    }
    const span = max - min;
    const margin = Math.max(span * 0.2, 1);
    state.autoDomain = {
      min: min - margin,
      max: max + margin
    };
    return state.autoDomain;
  }
  function getDomainInfo() {
    let auto;
    if (dragDomainLock) {
      if (state.autoDomain && Number.isFinite(state.autoDomain.min) && Number.isFinite(state.autoDomain.max)) {
        auto = {
          min: state.autoDomain.min,
          max: state.autoDomain.max
        };
      } else {
        auto = { ...DEFAULT_AUTO_DOMAIN };
      }
    } else {
      auto = computeAutoDomain(state.criticalPoints);
    }
    const overrideMin = Number.isFinite(state.domain.min) ? state.domain.min : null;
    const overrideMax = Number.isFinite(state.domain.max) ? state.domain.max : null;
    let min = overrideMin ?? (dragDomainLock ? dragDomainLock.min : auto.min);
    let max = overrideMax ?? (dragDomainLock ? dragDomainLock.max : auto.max);
    const invalid = {
      min: false,
      max: false
    };
    if (!(max > min)) {
      if (dragDomainLock) {
        if (overrideMin != null) {
          invalid.min = true;
        }
        if (overrideMax != null) {
          invalid.max = true;
        }
        min = dragDomainLock.min;
        max = dragDomainLock.max;
      } else {
        const span = Math.max(auto.max - auto.min, 2);
        if (overrideMin != null && overrideMax != null) {
          invalid.min = true;
          invalid.max = true;
          const center = (overrideMin + overrideMax) / 2 || overrideMin || overrideMax || 0;
          min = center - span / 2;
          max = center + span / 2;
        } else if (overrideMin != null) {
          min = overrideMin;
          max = overrideMin + span;
        } else if (overrideMax != null) {
          max = overrideMax;
          min = overrideMax - span;
        } else {
          const center = (min + max) / 2 || 0;
          min = center - span / 2;
          max = center + span / 2;
        }
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = dragDomainLock ? dragDomainLock.min : auto.min;
      max = dragDomainLock ? dragDomainLock.max : auto.max;
    }
    if (Math.abs(max - min) < 1e-6) {
      const center = (max + min) / 2;
      min = center - 1;
      max = center + 1;
    }
    return {
      auto,
      override: {
        min: overrideMin,
        max: overrideMax
      },
      active: {
        min,
        max
      },
      invalid
    };
  }
  function renderDomainControls(domainInfo) {
    if (!domainMinInput || !domainMaxInput) return;
    const info = domainInfo || getDomainInfo();
    const step = getNumberStep();
    domainMinInput.step = step;
    domainMaxInput.step = step;
    const minValue = info.override.min != null ? info.override.min : info.auto.min;
    const maxValue = info.override.max != null ? info.override.max : info.auto.max;
    if (document.activeElement !== domainMinInput) {
      domainMinInput.value = formatPointValue(minValue);
    }
    if (document.activeElement !== domainMaxInput) {
      domainMaxInput.value = formatPointValue(maxValue);
    }
    domainMinInput.placeholder = formatPointValue(info.auto.min);
    domainMaxInput.placeholder = formatPointValue(info.auto.max);
    domainMinInput.classList.toggle('input-invalid', info.invalid.min);
    domainMaxInput.classList.toggle('input-invalid', info.invalid.max);
  }
  function tryEvaluate(fn, x) {
    try {
      const value = fn(x);
      if (!Number.isFinite(value)) return NaN;
      return value;
    } catch (err) {
      return NaN;
    }
  }
  function chooseSample(a, b) {
    if (!Number.isFinite(a) && Number.isFinite(b)) return b - 1;
    if (!Number.isFinite(b) && Number.isFinite(a)) return a + 1;
    if (!Number.isFinite(a) && !Number.isFinite(b)) return 0;
    let sample = (a + b) / 2;
    if (!Number.isFinite(sample)) {
      sample = a + (b - a) / 2;
    }
    if (Math.abs(sample - a) < 1e-4) {
      sample = a + (b - a) * 0.3;
    }
    if (Math.abs(sample - b) < 1e-4) {
      sample = b - (b - a) * 0.3;
    }
    return sample;
  }
  function computeSegments(fn, points, domain) {
    const sorted = [...points].sort((a, b) => a.value - b.value);
    const boundaries = [domain.min, ...sorted.map(p => p.value), domain.max];
    const segments = [];
    for (let i = 0; i < boundaries.length - 1; i += 1) {
      const left = boundaries[i];
      const right = boundaries[i + 1];
      let sample = chooseSample(left, right);
      let value = tryEvaluate(fn, sample);
      if (!Number.isFinite(value)) {
        const ratios = [0.25, 0.75, 0.1, 0.9];
        for (const ratio of ratios) {
          sample = left + (right - left) * ratio;
          value = tryEvaluate(fn, sample);
          if (Number.isFinite(value)) break;
        }
      }
      if (!Number.isFinite(value)) {
        segments.push(segments.length ? segments[segments.length - 1] : 1);
        continue;
      }
      segments.push(value >= 0 ? 1 : -1);
    }
    return segments;
  }
  const NUMERIC_SEARCH_LIMITS = [10, 25, 50];
  const NUMERIC_SEARCH_STEPS = 600;
  const NUMERIC_ZERO_TOLERANCE = 1e-4;
  const NUMERIC_NEAR_ZERO_TOLERANCE = 1e-3;
  const NUMERIC_DERIVATIVE_TOLERANCE = 1e-4;
  function addNumericRoot(candidate, seen, results, multiplicity = 1) {
    if (!Number.isFinite(candidate)) return;
    const normalized = normalizePointValue(candidate);
    if (normalized == null) return;
    const key = makePointKey('zero', normalized);
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      value: normalized,
      type: 'zero',
      multiplicity,
      numeric: true
    });
  }
  function refineRootBisection(fn, left, right, fLeft, fRight) {
    let a = left;
    let b = right;
    let fa = Number.isFinite(fLeft) ? fLeft : tryEvaluate(fn, a);
    let fb = Number.isFinite(fRight) ? fRight : tryEvaluate(fn, b);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
    if (fa === 0) return a;
    if (fb === 0) return b;
    for (let i = 0; i < 60; i += 1) {
      const mid = (a + b) / 2;
      const fm = tryEvaluate(fn, mid);
      if (!Number.isFinite(fm)) {
        a = (a + mid) / 2;
        fa = tryEvaluate(fn, a);
        b = (b + mid) / 2;
        fb = tryEvaluate(fn, b);
        if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
          break;
        }
        continue;
      }
      if (Math.abs(fm) < 1e-7 || Math.abs(b - a) < 1e-6) {
        return mid;
      }
      if (fa * fm <= 0) {
        b = mid;
        fb = fm;
      } else {
        a = mid;
        fa = fm;
      }
    }
    return (a + b) / 2;
  }
  function checkStationaryZero(fn, x, value, seen, results) {
    const deltas = [1e-3, 5e-3, 1e-2, 5e-2];
    for (const delta of deltas) {
      const leftX = x - delta;
      const rightX = x + delta;
      const left = tryEvaluate(fn, leftX);
      const right = tryEvaluate(fn, rightX);
      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        continue;
      }
      if (left === 0 || right === 0) {
        addNumericRoot(left === 0 ? leftX : rightX, seen, results);
        addNumericRoot(x, seen, results);
        return true;
      }
      if (left * right < 0) {
        const refined = refineRootBisection(fn, leftX, rightX, left, right);
        if (Number.isFinite(refined)) {
          addNumericRoot(refined, seen, results);
          return true;
        }
      }
      const sameSign = Math.sign(left) === Math.sign(right);
      const derivative = (right - left) / (2 * delta);
      if (Math.abs(value) < NUMERIC_ZERO_TOLERANCE && sameSign && Math.abs(derivative) < NUMERIC_DERIVATIVE_TOLERANCE && Math.abs(left) >= Math.abs(value) && Math.abs(right) >= Math.abs(value)) {
        addNumericRoot(x, seen, results, 2);
        return true;
      }
    }
    if (Math.abs(value) < NUMERIC_NEAR_ZERO_TOLERANCE) {
      const spans = [0.5, 0.25, 0.1, 0.05];
      for (const span of spans) {
        const candidate = findMinimumInWindow(fn, x, span);
        if (!candidate || candidate.value >= NUMERIC_ZERO_TOLERANCE) {
          continue;
        }
        const leftBoundary = tryEvaluate(fn, candidate.x - span);
        const rightBoundary = tryEvaluate(fn, candidate.x + span);
        const leftMagnitude = Number.isFinite(leftBoundary) ? Math.abs(leftBoundary) : Infinity;
        const rightMagnitude = Number.isFinite(rightBoundary) ? Math.abs(rightBoundary) : Infinity;
        if (leftMagnitude > candidate.value + NUMERIC_ZERO_TOLERANCE && rightMagnitude > candidate.value + NUMERIC_ZERO_TOLERANCE) {
          addNumericRoot(candidate.x, seen, results, 2);
          return true;
        }
      }
    }
    return false;
  }
  function findMinimumInWindow(fn, center, span) {
    if (!Number.isFinite(center) || !Number.isFinite(span) || span <= 0) {
      return null;
    }
    const steps = 32;
    let bestX = center;
    let bestValue = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= steps; i += 1) {
      const ratio = i / steps;
      const x = center - span + ratio * (2 * span);
      const value = tryEvaluate(fn, x);
      if (!Number.isFinite(value)) {
        continue;
      }
      const magnitude = Math.abs(value);
      if (magnitude < bestValue) {
        bestValue = magnitude;
        bestX = x;
      }
    }
    if (!Number.isFinite(bestValue) || bestValue === Number.POSITIVE_INFINITY) {
      return null;
    }
    return {
      x: bestX,
      value: bestValue
    };
  }
  function scanForZerosInRange(fn, min, max, seen) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || !(max > min)) {
      return [];
    }
    const results = [];
    let prevX = null;
    let prevVal = null;
    let prevValid = false;
    for (let i = 0; i <= NUMERIC_SEARCH_STEPS; i += 1) {
      const ratio = i / NUMERIC_SEARCH_STEPS;
      const x = min + (max - min) * ratio;
      const value = tryEvaluate(fn, x);
      const valid = Number.isFinite(value);
      if (valid) {
        if (value === 0) {
          addNumericRoot(x, seen, results);
        } else if (Math.abs(value) < NUMERIC_NEAR_ZERO_TOLERANCE) {
          checkStationaryZero(fn, x, value, seen, results);
        }
        if (prevValid && prevVal * value < 0) {
          const root = refineRootBisection(fn, prevX, x, prevVal, value);
          if (Number.isFinite(root)) {
            addNumericRoot(root, seen, results);
          }
        }
      }
      prevX = x;
      prevVal = value;
      prevValid = valid;
    }
    return results;
  }
  function findNumericZeros(fn, existingPoints) {
    if (typeof fn !== 'function') {
      return [];
    }
    const seen = new Set();
    (existingPoints || []).forEach(point => {
      const normalized = normalizePointValue(point.value);
      if (normalized == null) return;
      const type = point.type || 'zero';
      seen.add(makePointKey(type, normalized));
    });
    const ranges = [...NUMERIC_SEARCH_LIMITS];
    const existingValues = (existingPoints || []).filter(point => Number.isFinite(point.value)).map(point => Math.abs(point.value));
    if (existingValues.length) {
      const maxExisting = Math.max(...existingValues);
      if (maxExisting > ranges[ranges.length - 1]) {
        ranges.push(Math.min(maxExisting + 5, 100));
      }
    }
    const results = [];
    ranges.forEach(limit => {
      const rangeResults = scanForZerosInRange(fn, -limit, limit, seen);
      rangeResults.forEach(result => {
        results.push(result);
      });
    });
    return results;
  }
  function mergePointLists(basePoints, additional) {
    const map = new Map();
    (basePoints || []).forEach(point => {
      const normalized = normalizePointValue(point.value);
      if (normalized == null) return;
      const type = point.type || 'zero';
      const key = makePointKey(type, normalized);
      map.set(key, { ...point, value: normalized });
    });
    (additional || []).forEach(point => {
      const normalized = normalizePointValue(point.value);
      if (normalized == null) return;
      const type = point.type || 'zero';
      const key = makePointKey(type, normalized);
      if (map.has(key)) {
        const existing = map.get(key);
        if (Number.isFinite(point.multiplicity) && (!Number.isFinite(existing.multiplicity) || point.multiplicity > existing.multiplicity)) {
          existing.multiplicity = point.multiplicity;
        }
      } else {
        map.set(key, { ...point, value: normalized });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.value - b.value);
  }
  function generateSolutionFromExpression() {
    const raw = getExpressionInputValue();
    if (!raw) {
      throw new Error('Skriv inn et funksjonsuttrykk.');
    }
    const sanitized = sanitizeExpression(raw);
    if (!sanitized) {
      throw new Error('Kunne ikke tolke funksjonsuttrykket.');
    }
    if (!/^[0-9x+\-*/().*]*$/.test(sanitized)) {
      throw new Error('Kun tall, x og de fire regneartene støttes i autogenereringen.');
    }
    const fn = createSafeFunction(sanitized);
    if (!fn) {
      throw new Error('Kunne ikke tolke funksjonsuttrykket.');
    }
    const structure = extractStructure(sanitized);
    let points = buildPoints(structure);
    if ((!points.length || structure.unparsed && structure.unparsed.length) && fn) {
      const numericZeros = findNumericZeros(fn, points);
      if (numericZeros.length) {
        points = mergePointLists(points, numericZeros);
      }
    }
    const domain = computeAutoDomain(points);
    const segments = computeSegments(fn, points, domain);
    const factorRows = buildLinearFactorRows(structure, points, domain);
    return {
      points,
      segments,
      domain,
      expression: sanitized,
      factorRows
    };
  }
  function setCheckMessage(message, type = 'info') {
    if (!message) {
      checkStatus.hidden = true;
      checkStatus.textContent = '';
      return;
    }
    checkStatus.hidden = false;
    checkStatus.textContent = message;
    checkStatus.className = `status status--${type}`;
  }
  function signValue(value) {
    return value >= 0 ? 1 : -1;
  }
  function runCheck() {
    if (!state.solution) {
      setCheckMessage('Fasit mangler. Skriv inn funksjonsuttrykket først.', 'info');
      return;
    }
    if (!state.signRows.length) {
      setCheckMessage('Ingen fortegnslinjer definert.', 'error');
      return;
    }
    const solutionPoints = state.solution.points;
    const tolerance = 1e-2;
    if (state.criticalPoints.length !== solutionPoints.length) {
      setCheckMessage('Antall punkter stemmer ikke med fasit.', 'error');
      return;
    }
    for (let i = 0; i < solutionPoints.length; i += 1) {
      const sol = solutionPoints[i];
      const user = state.criticalPoints[i];
      if (sol.type !== user.type) {
        setCheckMessage(`Punkt ${i + 1} har feil type.`, 'error');
        return;
      }
      if (Math.abs(sol.value - user.value) > tolerance) {
        setCheckMessage(`Punkt ${i + 1} har feil plassering.`, 'error');
        return;
      }
    }
    const solutionSegments = state.solution.segments;
    const resultRow = state.signRows.find(r => r.role === 'result');
    if (!resultRow || resultRow.segments.length !== solutionSegments.length) {
      setCheckMessage('Fortegnslinjen har feil antall intervaller.', 'error');
      return;
    }
    for (let i = 0; i < solutionSegments.length; i += 1) {
      if (signValue(resultRow.segments[i]) !== signValue(solutionSegments[i])) {
        setCheckMessage(`Segment ${i + 1} har feil fortegn.`, 'error');
        return;
      }
    }
    setCheckMessage('Fortegnsskjemaet stemmer!', 'success');
  }
  function renderPointsList() {
    pointsList.innerHTML = '';
    if (!state.criticalPoints.length) {
      const empty = document.createElement('div');
      empty.className = 'note';
      empty.textContent = 'Ingen punkter definert.';
      pointsList.appendChild(empty);
      return;
    }
    const locked = isChartLocked();
    state.criticalPoints.forEach(point => {
      const row = document.createElement('div');
      const valueLabel = document.createElement('label');
      valueLabel.classList.add('value-field');
      valueLabel.innerHTML = '<span>Verdi</span>';
      const input = document.createElement('input');
      input.type = 'number';
      input.step = getNumberStep();
      input.value = formatPointValue(point.value);
      input.disabled = locked;
      if (!locked) {
        input.addEventListener('change', event => {
          const value = parseFloat(event.target.value);
          if (Number.isFinite(value)) {
            setPointValue(point.id, value);
          }
        });
      }
      valueLabel.appendChild(input);
      row.appendChild(valueLabel);
      const typeLabel = document.createElement('label');
      typeLabel.innerHTML = '<span>Type</span>';
      const select = document.createElement('select');
      const optionZero = document.createElement('option');
      optionZero.value = 'zero';
      optionZero.textContent = '0 (nullpunkt)';
      const optionPole = document.createElement('option');
      optionPole.value = 'pole';
      optionPole.textContent = '>< (pol)';
      select.append(optionZero, optionPole);
      select.value = point.type === 'pole' ? 'pole' : 'zero';
      select.disabled = locked;
      if (!locked) {
        select.addEventListener('change', event => {
          setPointType(point.id, event.target.value === 'pole' ? 'pole' : 'zero');
        });
      }
      typeLabel.appendChild(select);
      row.appendChild(typeLabel);
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn danger';
      removeBtn.textContent = 'Fjern';
      removeBtn.disabled = locked;
      if (!locked) {
        removeBtn.addEventListener('click', () => {
          removePoint(point.id);
        });
      }
      row.appendChild(removeBtn);
      pointsList.appendChild(row);
    });
  }
  function renderRowsList() {
    rowsList.innerHTML = '';
    if (!state.signRows.length) {
      const info = document.createElement('div');
      info.className = 'note';
      info.textContent = 'Ingen fortegnslinjer.';
      rowsList.appendChild(info);
      return;
    }
    state.signRows.forEach((row, index) => {
      const rowEl = document.createElement('div');
      const label = document.createElement('label');
      label.className = 'row-label';
      label.innerHTML = '<span>Navn</span>';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = row.label || '';
      input.placeholder = `rad ${index + 1}`;
      if (row.locked) {
        input.disabled = true;
      } else {
        input.addEventListener('input', event => {
          row.label = event.target.value;
          renderChart();
        });
      }
      label.appendChild(input);
      rowEl.appendChild(label);
      if (row.locked) {
        const note = document.createElement('span');
        note.className = 'note';
        note.textContent = 'Generert fra lineær faktor';
        rowEl.appendChild(note);
      } else if (state.autoSync && row.role === 'result' && state.solution) {
        const note = document.createElement('span');
        note.className = 'note';
        note.textContent = 'Synkronisert med fasit';
        rowEl.appendChild(note);
      }
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn danger';
      removeBtn.textContent = 'Fjern';
      if (row.locked || row.role === 'result') {
        removeBtn.disabled = true;
      } else {
        removeBtn.addEventListener('click', () => {
          removeRow(row.id);
        });
      }
      rowEl.appendChild(removeBtn);
      rowsList.appendChild(rowEl);
    });
  }
  function createSvgElement(name, attrs = {}) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', name);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        if (key === 'href') {
          el.setAttributeNS(XLINK_NS, 'href', value);
          el.setAttribute(key, value);
        } else {
          el.setAttribute(key, value);
        }
      }
    });
    return el;
  }
  function getExpressionLatexFromInput() {
    if (!exprInput) {
      return '';
    }
    const tag = exprInput.tagName ? exprInput.tagName.toUpperCase() : '';
    if (tag === MATHFIELD_TAG) {
      ensureMathFieldOptions(exprInput);
      let latex = tryGetMathFieldValue(exprInput, 'latex-expanded');
      if (!latex) {
        latex = tryGetMathFieldValue(exprInput, 'latex');
      }
      if (typeof latex === 'string') {
        return collapseExpressionWhitespace(latex);
      }
    }
    return '';
  }
  function renderExpressionDisplay() {
    if (!expressionDisplay) {
      return;
    }
    const expr = typeof state.expression === 'string' ? state.expression.trim() : '';
    if (!expr) {
      expressionDisplay.textContent = '';
      expressionDisplay.classList.add('chart-expression--empty');
      return;
    }
    let coreLatex = getExpressionLatexFromInput();
    if (!coreLatex) {
      if (expr.includes('\\')) {
        coreLatex = collapseExpressionWhitespace(expr);
      } else {
        coreLatex = convertPlainExpressionToLatex(expr) || expr;
      }
    }
    const latex = state.expressionPrefix ? `f(x)=${coreLatex}` : coreLatex;
    const fallback = state.expressionPrefix ? `f(x)=${expr}` : expr;
    if (typeof window !== 'undefined' && window.katex && typeof window.katex.render === 'function') {
      try {
        window.katex.render(latex, expressionDisplay, {
          throwOnError: false,
          displayMode: false
        });
        expressionDisplay.classList.remove('chart-expression--empty');
        return;
      } catch (err) {
        /* ignore and fallback to text */
      }
    }
    expressionDisplay.textContent = fallback;
    expressionDisplay.classList.toggle('chart-expression--empty', !fallback);
  }
  function renderRowLabelContent(target, text, preferMath) {
    if (!target) {
      return;
    }
    const label = typeof text === 'string' ? text.trim() : '';
    if (!label) {
      target.textContent = '';
      target.classList.remove('chart-labels__item--math');
      return;
    }
    const hasOperators = /[=+\-*/^]/.test(label);
    const hasParens = /[()]/.test(label);
    const hasLatexCommand = /\\[a-zA-Z]+/.test(label);
    const shouldUseKatex = (preferMath || hasOperators || hasParens || hasLatexCommand) && typeof window !== 'undefined' && window.katex && typeof window.katex.render === 'function';
    if (shouldUseKatex) {
      const latex = convertPlainExpressionToLatex(label) || label;
      try {
        window.katex.render(latex, target, {
          throwOnError: false,
          displayMode: false
        });
        target.classList.add('chart-labels__item--math');
        return;
      } catch (error) {
        /* ignore and fallback to text */
      }
    }
    target.textContent = label;
    target.classList.remove('chart-labels__item--math');
  }
  function renderRowLabels(labels, width, height) {
    if (!labelsLayer) {
      return;
    }
    labelsLayer.innerHTML = '';
    if (typeof width === 'number' && width >= 0) {
      labelsLayer.style.width = `${width}px`;
    }
    if (typeof height === 'number' && height >= 0) {
      labelsLayer.style.height = `${height}px`;
    }
    labels.forEach(info => {
      const item = document.createElement('div');
      item.className = typeof info.className === 'string' && info.className ? info.className : 'chart-labels__item';
      item.style.top = `${info.y}px`;
      labelsLayer.appendChild(item);
      renderRowLabelContent(item, info.text, info.preferMath);
    });
    labelsLayer.classList.toggle('chart-labels--empty', labels.length === 0);
  }
  function getResultRowDisplayLabel(row) {
    const expr = typeof state.expression === 'string' ? state.expression.trim() : '';
    const fallback = expr || 'f(x)';
    if (!row || row.role !== 'result') {
      return fallback;
    }
    const label = typeof row.label === 'string' ? row.label : '';
    if (!label) {
      return fallback;
    }
    const normalized = label.replace(/\s+/g, '').toLowerCase();
    if (normalized === 'f(x)') {
      return fallback;
    }
    return label;
  }
  function formatNumberForAlt(value) {
    if (!Number.isFinite(value)) {
      return '';
    }
    try {
      const decimals = Math.max(0, getDecimalPlaces());
      return new Intl.NumberFormat('nb-NO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
      }).format(value);
    } catch (error) {
      const fallback = formatPointValue(value);
      return fallback.includes('.') ? fallback.replace('.', ',') : fallback;
    }
  }
  function formatIntervalRange(left, right) {
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      return 'for intervallet';
    }
    if (Math.abs(right - left) <= POINT_TOLERANCE) {
      return `rundt x = ${formatNumberForAlt(left)}`;
    }
    return `fra x = ${formatNumberForAlt(left)} til x = ${formatNumberForAlt(right)}`;
  }
  function buildRowAltText(row, index, boundaries, domainRange) {
    if (!row) {
      return '';
    }
    const label = row.role === 'result' ? getResultRowDisplayLabel(row) : (typeof row.label === 'string' && row.label.trim() ? row.label.trim() : `Rad ${index + 1}`);
    const introParts = [];
    if (row.role === 'result') {
      introParts.push(`${label} er resultatraden.`);
    } else if (row.role === 'factor') {
      const typeText = row.type === 'pole' ? 'pol' : 'nullpunkt';
      let detail = '';
      if (Number.isFinite(row.value)) {
        detail += ` ved x = ${formatNumberForAlt(row.value)}`;
      }
      if (Number.isFinite(row.multiplicity) && row.multiplicity > 1) {
        detail += ` med multiplicitet ${row.multiplicity}`;
      }
      introParts.push(`${label} er en låst faktorlinje for ${typeText}${detail}.`);
    } else if (row.locked) {
      introParts.push(`${label} er en låst fortegnslinje.`);
    } else {
      introParts.push(`${label} er en fortegnslinje.`);
    }
    const segments = Array.isArray(row.segments) ? row.segments : [];
    if (!segments.length) {
      introParts.push('Ingen segmenter er definert.');
      return introParts.join(' ');
    }
    const needed = segments.length + 1;
    const bounds = Array.isArray(boundaries) ? boundaries : [];
    const domainMin = domainRange && Number.isFinite(domainRange.min) ? domainRange.min : 0;
    const domainMax = domainRange && Number.isFinite(domainRange.max) ? domainRange.max : domainMin + 1;
    let rowBounds;
    if (bounds.length >= needed && needed > 0) {
      rowBounds = bounds.slice(0, needed);
    } else if (needed > 0) {
      rowBounds = [];
      const span = domainMax - domainMin;
      for (let i = 0; i < needed; i += 1) {
        const ratio = needed === 1 ? 0 : i / (needed - 1);
        rowBounds.push(domainMin + span * ratio);
      }
    } else {
      rowBounds = bounds.slice(0, 1);
    }
    const segmentTexts = segments.map((value, idx) => {
      const signText = value >= 0 ? 'positivt' : 'negativt';
      const left = rowBounds[idx];
      const right = rowBounds[idx + 1];
      const rangeText = formatIntervalRange(left, right);
      return `Segment ${idx + 1} (${rangeText}) er ${signText}.`;
    });
    return introParts.concat(segmentTexts).join(' ');
  }
  function buildFortegnsskjemaAltText() {
    sanitizeState(state);
    sortPoints();
    syncSegments();
    const domainInfo = getDomainInfo();
    const domain = domainInfo.active;
    const min = Number.isFinite(domain.min) ? domain.min : 0;
    const max = Number.isFinite(domain.max) ? domain.max : min + 1;
    const sentences = [];
    const expr = typeof state.expression === 'string' ? state.expression.trim() : '';
    if (expr) {
      const prefix = state.expressionPrefix ? 'f(x) = ' : '';
      sentences.push(`Figuren viser et fortegnsskjema for ${prefix}${expr}.`);
    } else {
      sentences.push('Figuren viser et fortegnsskjema.');
    }
    if (Number.isFinite(min) && Number.isFinite(max)) {
      sentences.push(`Området dekker x-verdier fra ${formatNumberForAlt(min)} til ${formatNumberForAlt(max)}.`);
    }
    const points = state.criticalPoints.slice().sort((a, b) => a.value - b.value);
    if (points.length) {
      const pointDescriptions = points.map(point => {
        const typeText = point.type === 'pole' ? 'pol' : 'nullpunkt';
        const valueText = formatNumberForAlt(point.value);
        let desc = `${typeText} ved x = ${valueText}`;
        if (Number.isFinite(point.multiplicity) && point.multiplicity > 1) {
          desc += ` med multiplicitet ${point.multiplicity}`;
        }
        return desc;
      });
      sentences.push(`Kritiske punkter: ${pointDescriptions.join('; ')}.`);
    } else {
      sentences.push('Ingen kritiske punkter er definert.');
    }
    if (state.autoSync) {
      sentences.push('Fortegnslinjene oppdateres automatisk fra fasit.');
    }
    const rows = Array.isArray(state.signRows) ? state.signRows : [];
    if (!rows.length) {
      sentences.push('Ingen fortegnslinjer er lagt til.');
      return sentences.join(' ');
    }
    sentences.push(`Skjemaet har ${rows.length === 1 ? 'én fortegnslinje' : `${rows.length} fortegnslinjer`}.`);
    const boundaries = [min, ...points.map(p => p.value), max];
    rows.forEach((row, index) => {
      sentences.push(buildRowAltText(row, index, boundaries, { min, max }));
    });
    return sentences.join(' ');
  }
  function refreshAltText(reason) {
    const signature = buildFortegnsskjemaAltText();
    if (altTextManager && typeof altTextManager.refresh === 'function') {
      altTextManager.refresh(reason || 'auto', signature);
    } else if (altTextManager && typeof altTextManager.notifyFigureChange === 'function') {
      altTextManager.notifyFigureChange(signature);
    }
  }
  function initAltTextManager() {
    if (!window.MathVisAltText || !svg) {
      return;
    }
    const container = document.getElementById('exportCard');
    if (!container) {
      return;
    }
    if (!altTextManager) {
      altTextManager = window.MathVisAltText.create({
        svg: () => svg,
        container,
        getTitle: () => {
          const expr = typeof state.expression === 'string' ? state.expression.trim() : '';
          if (expr) {
            const prefix = state.expressionPrefix ? 'f(x) = ' : '';
            return `Fortegnsskjema for ${prefix}${expr}`;
          }
          return 'Fortegnsskjema';
        },
        getState: () => ({
          text: typeof state.altText === 'string' ? state.altText : '',
          source: state.altTextSource === 'manual' ? 'manual' : 'auto'
        }),
        setState: (text, source) => {
          state.altText = text;
          state.altTextSource = source === 'manual' ? 'manual' : 'auto';
        },
        generate: () => buildFortegnsskjemaAltText(),
        getSignature: () => buildFortegnsskjemaAltText(),
        getAutoMessage: reason => reason && reason.startsWith('manual') ? 'Alternativ tekst oppdatert.' : 'Alternativ tekst oppdatert automatisk.',
        getManualMessage: () => 'Alternativ tekst oppdatert manuelt.'
      });
    }
    if (altTextManager) {
      altTextManager.applyCurrent();
      refreshAltText('init');
    }
  }
  function renderChart() {
    renderExpressionDisplay();
    sortPoints();
    const points = state.criticalPoints;
    const domainInfo = getDomainInfo();
    const domain = domainInfo.active;
    const width = svg.clientWidth || svg.parentElement.clientWidth || 900;
    const rowSpacing = 70;
    const arrowY = 70;
    const marginLeft = 140;
    const marginRight = 40;
    const baseHeight = arrowY + 60 + Math.max(1, state.signRows.length) * rowSpacing + 60;
    svg.setAttribute('viewBox', `0 0 ${width} ${baseHeight}`);
    svg.style.height = `${baseHeight}px`;
    svg.innerHTML = '';
    if (overlay) {
      overlay.innerHTML = '';
      overlay.style.height = `${baseHeight}px`;
    }
    const labelWidth = Math.max(0, marginLeft - 20);
    if (figureContainer) {
      figureContainer.style.setProperty('--chart-label-width', `${labelWidth}px`);
    }
    const axisStart = marginLeft;
    const axisEnd = width - marginRight;
    const axisWidth = axisEnd - axisStart;
    const min = domain.min;
    const max = domain.max;
    currentScale = {
      toCoord: value => axisStart + (value - min) / (max - min) * axisWidth,
      toValue: coord => min + (coord - axisStart) / axisWidth * (max - min),
      axisStart,
      axisWidth,
      domainMin: min,
      domainMax: max
    };
    renderDomainControls(domainInfo);
    const axisLine = createSvgElement('line', {
      x1: axisStart,
      y1: arrowY,
      x2: axisEnd,
      y2: arrowY,
      stroke: chartPalette.axis,
      'stroke-width': 2
    });
    svg.append(axisLine);
    const arrowSize = axisArrowUtils && typeof axisArrowUtils.getScaledSize === 'function' ? axisArrowUtils.getScaledSize('x', AXIS_ARROW_THICKNESS) : null;
    const arrowWidth = arrowSize && Number.isFinite(arrowSize.width) && arrowSize.width > 0 ? arrowSize.width : LEGACY_ARROW_WIDTH;
    const arrowHeight = arrowSize && Number.isFinite(arrowSize.height) && arrowSize.height > 0 ? arrowSize.height : AXIS_ARROW_THICKNESS;
    if (axisArrowUtils && typeof axisArrowUtils.getSvgData === 'function' && arrowSize) {
      svg.append(createSvgElement('image', {
        class: 'chart-axis-arrow',
        href: axisArrowUtils.getSvgData('x', chartPalette.axis, chartPalette.axis),
        x: axisEnd - arrowWidth,
        y: arrowY - arrowHeight / 2,
        width: arrowWidth,
        height: arrowHeight,
        'preserveAspectRatio': 'none'
      }));
    } else {
      svg.append(createSvgElement('path', {
        d: `M ${axisEnd} ${arrowY} l -${LEGACY_ARROW_WIDTH} -${LEGACY_ARROW_WIDTH / 2} v ${LEGACY_ARROW_WIDTH} z`,
        fill: chartPalette.axis,
        class: 'chart-axis-arrow'
      }));
    }
    const axisLabel = createSvgElement('text', {
      x: axisEnd + 16,
      y: arrowY + 4,
      'font-size': 14,
      'font-weight': 600,
      fill: chartPalette.text
    });
    axisLabel.textContent = 'x';
    svg.append(axisLabel);
    const sortedPoints = [...points];
    const zeroMarkers = sortedPoints.filter(point => point && point.type === 'zero');
    const values = sortedPoints.map(p => p.value);
    const baseRowY = arrowY + 60;
    const lastRowY = state.signRows.length ? baseRowY + (state.signRows.length - 1) * rowSpacing : baseRowY;
    const chartLocked = isChartLocked();
    sortedPoints.forEach(point => {
      const px = currentScale.toCoord(point.value);
      if (!Number.isFinite(px)) return;
      const vertical = createSvgElement('line', {
        x1: px,
        y1: arrowY + 8,
        x2: px,
        y2: lastRowY + 20,
        stroke: chartPalette.grid,
        'stroke-width': 1.2,
        'data-point-id': point.id,
        'pointer-events': chartLocked ? 'none' : 'stroke',
        cursor: chartLocked ? 'default' : 'ew-resize'
      });
      svg.append(vertical);
      const dragHandle = createSvgElement('circle', {
        cx: px,
        cy: arrowY,
        r: 12,
        fill: 'transparent',
        stroke: 'transparent',
        'data-point-id': point.id,
        'pointer-events': chartLocked ? 'none' : 'all',
        cursor: chartLocked ? 'default' : 'ew-resize'
      });
      dragHandle.style.touchAction = 'none';
      svg.append(dragHandle);
      if (overlay) {
        const valueBadge = document.createElement('div');
        valueBadge.className = 'chart-overlay__value';
        valueBadge.style.left = `${px}px`;
        valueBadge.style.top = `${arrowY}px`;
        valueBadge.title = formatPointValue(point.value);
        valueBadge.dataset.pointId = point.id;
        valueBadge.style.touchAction = 'none';
        if (chartLocked) {
          valueBadge.classList.add('chart-overlay__value--locked');
          valueBadge.textContent = formatPointValue(point.value);
          valueBadge.style.pointerEvents = 'none';
        } else {
          const valueInput = document.createElement('input');
          valueInput.type = 'number';
          valueInput.className = 'chart-overlay__value-input';
          valueInput.step = getNumberStep();
          valueInput.value = formatPointValue(point.value);
          valueInput.setAttribute('aria-label', point.type === 'pole' ? 'x-verdi for pol' : 'x-verdi for nullpunkt');
          valueInput.disabled = chartLocked;
          valueInput.addEventListener('focus', () => {
            valueInput.select();
          });
          const commitInputValue = () => {
            const raw = valueInput.value.trim().replace(',', '.');
            if (raw === '') {
              valueInput.value = formatPointValue(point.value);
              return;
            }
            const value = Number.parseFloat(raw);
            if (Number.isFinite(value)) {
              setPointValue(point.id, value);
            } else {
              valueInput.value = formatPointValue(point.value);
            }
          };
          valueInput.addEventListener('change', commitInputValue);
          valueInput.addEventListener('keydown', event => {
            if (event.key === 'Enter') {
              commitInputValue();
              valueInput.blur();
            } else if (event.key === 'Escape') {
              valueInput.value = formatPointValue(point.value);
              valueInput.blur();
            }
          });
          valueBadge.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            if (event.target === valueInput) {
              return;
            }
            event.preventDefault();
            startDragging(point.id, event.pointerId, false);
          });
          valueBadge.appendChild(valueInput);
        }
        overlay.appendChild(valueBadge);
      }
    });
    const boundaries = [min, ...values, max];
    const rowInfos = state.signRows.map((row, rowIndex) => ({
      row,
      rowIndex,
      y: baseRowY + rowIndex * rowSpacing
    }));
    const markerTargets = rowInfos.length ? rowInfos : [{ row: null, rowIndex: 0, y: baseRowY }];
    const rowLabels = [];
    rowInfos.forEach(({ row, rowIndex, y }) => {
      const baseline = createSvgElement('line', {
        x1: axisStart,
        y1: y,
        x2: axisEnd,
        y2: y,
        stroke: chartPalette.grid,
        'stroke-width': 1
      });
      svg.append(baseline);
      let displayLabel;
      if (row.role === 'result') {
        displayLabel = getResultRowDisplayLabel(row);
      } else {
        const labelValue = typeof row.label === 'string' ? row.label.trim() : '';
        displayLabel = labelValue || `rad ${rowIndex + 1}`;
      }
      rowLabels.push({
        text: displayLabel,
        y,
        preferMath: row.role === 'result' || row.role === 'factor' || !!row.locked,
        className: row.role === 'result' ? 'chart-labels__item chart-labels__item--result' : 'chart-labels__item'
      });
      const locked = chartLocked || row.locked || state.autoSync && row.role === 'result' && state.solution;
      const segments = row.segments;
      const rowZeroMarkers = getRowMarkers(row, zeroMarkers);
      for (let i = 0; i < boundaries.length - 1; i += 1) {
        const startVal = boundaries[i];
        const endVal = boundaries[i + 1];
        const startX = currentScale.toCoord(startVal);
        const endX = currentScale.toCoord(endVal);
        if (!Number.isFinite(startX) || !Number.isFinite(endX)) continue;
        let segmentStartX = startX;
        let segmentEndX = endX;
        if (rowZeroMarkers.length) {
          const hasStartZero = rowZeroMarkers.some(point => Math.abs(point.value - startVal) <= POINT_TOLERANCE);
          const hasEndZero = rowZeroMarkers.some(point => Math.abs(point.value - endVal) <= POINT_TOLERANCE);
          if (hasStartZero || hasEndZero) {
            const availableWidth = endX - startX;
            if (availableWidth > 0) {
              let startOffset = hasStartZero ? MARKER_GAP_PX : 0;
              let endOffset = hasEndZero ? MARKER_GAP_PX : 0;
              const totalOffset = startOffset + endOffset;
              if (totalOffset > 0) {
                const maxOffset = Math.max(availableWidth - MIN_SEGMENT_WIDTH_PX, 0);
                if (totalOffset > maxOffset) {
                  if (maxOffset <= 0) {
                    startOffset = 0;
                    endOffset = 0;
                  } else {
                    const scale = maxOffset / totalOffset;
                    startOffset *= scale;
                    endOffset *= scale;
                  }
                }
              }
              segmentStartX = startX + startOffset;
              segmentEndX = endX - endOffset;
            }
          }
        }
        const sign = segments[i] >= 0 ? 1 : -1;
        const line = createSvgElement('line', {
          x1: segmentStartX,
          y1: y,
          x2: segmentEndX,
          y2: y,
          stroke: sign > 0 ? chartPalette.positive : chartPalette.negative,
          'stroke-width': 3,
          'stroke-linecap': 'round',
          'data-row-id': row.id,
          'data-index': i,
          cursor: locked ? 'not-allowed' : 'pointer'
        });
        if (sign < 0) {
          line.setAttribute('stroke-dasharray', NEGATIVE_SEGMENT_DASH);
        }
        if (!locked) {
          line.addEventListener('pointerdown', event => {
            event.preventDefault();
            toggleSegment(row.id, i);
          });
        }
        svg.append(line);
      }
    });
    renderRowLabels(rowLabels, labelWidth, baseHeight);
    markerTargets.forEach(({ row, y }) => {
      const markers = getRowMarkers(row, sortedPoints);
      markers.forEach(point => {
        const px = currentScale.toCoord(point.value);
        if (!Number.isFinite(px)) return;
        const isPole = point.type === 'pole';
        const marker = createSvgElement('text', {
          x: px,
          y,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'alignment-baseline': 'middle',
          'font-size': isPole ? 22 : 20,
          'font-weight': 700,
          fill: chartPalette.text,
          cursor: chartLocked ? 'default' : 'pointer'
        });
        marker.textContent = isPole ? '><' : '0';
        if (!chartLocked) {
          marker.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            togglePointType(point.id);
          });
        }
        svg.append(marker);
      });
    });
    refreshAltText('render');
  }
  function getRowMarkers(row, points) {
    if (!row || row.role === 'result' || row.role === 'custom') {
      return points;
    }
    if (row.role === 'factor' && Number.isFinite(row.value)) {
      const matches = points.filter(point => Math.abs(point.value - row.value) <= POINT_TOLERANCE && (!row.type || point.type === row.type));
      if (matches.length) {
        return matches;
      }
      let closest = null;
      let bestDistance = Infinity;
      points.forEach(point => {
        const distance = Math.abs(point.value - row.value);
        if (distance < bestDistance) {
          bestDistance = distance;
          closest = point;
        }
      });
      return closest ? [closest] : [];
    }
    return points;
  }
  function cloneSvgForExport() {
    if (!svg) {
      return null;
    }
    const clone = svg.cloneNode(true);
    clone.removeAttribute('style');
    if (!clone.getAttribute('xmlns')) {
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    }
    return clone;
  }
  function getExportSvgMarkup() {
    const clone = cloneSvgForExport();
    if (!clone) {
      return '';
    }
    try {
      return new XMLSerializer().serializeToString(clone);
    } catch (error) {
      return typeof clone.outerHTML === 'string' ? clone.outerHTML : '';
    }
  }
  function downloadSvgFile(filename) {
    const markup = getExportSvgMarkup();
    if (!markup) {
      return;
    }
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadPngFile(filename) {
    const markup = getExportSvgMarkup();
    if (!markup) {
      return;
    }
    const svgBlob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const viewBox = svg && svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
      const baseWidth = viewBox ? viewBox.width : svg.clientWidth || svg.getBoundingClientRect().width || 900;
      const baseHeight = viewBox ? viewBox.height : svg.clientHeight || svg.getBoundingClientRect().height || 500;
      const scale = Math.max(1, window.devicePixelRatio || 1) * 2;
      const canvas = document.createElement('canvas');
      const helper = typeof window !== 'undefined' ? window.MathVisSvgExport : null;
      const sizing = helper && typeof helper.ensureMinimumPngDimensions === 'function'
        ? helper.ensureMinimumPngDimensions({ width: baseWidth, height: baseHeight }, { scale })
        : (() => {
            const minDimension = 100;
            const baseScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
            const safeWidth = Number.isFinite(baseWidth) && baseWidth > 0 ? baseWidth : minDimension;
            const safeHeight = Number.isFinite(baseHeight) && baseHeight > 0 ? baseHeight : minDimension;
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
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => {
        if (!blob) return;
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }
  function setPointValue(id, value, fromDrag = false) {
    const point = state.criticalPoints.find(p => p.id === id);
    if (!point) return;
    if (fromDrag && Math.abs(point.value - value) < 1e-9) {
      return;
    }
    point.value = value;
    sortPoints();
    if (fromDrag) {
      if (dragging) {
        dragging.moved = true;
      }
      renderPointsList();
      renderChart();
    } else {
      syncSegments();
      renderAll();
    }
  }
  function setPointType(id, type) {
    const point = state.criticalPoints.find(p => p.id === id);
    if (!point) return;
    const normalized = type === 'pole' ? 'pole' : 'zero';
    if (point.type === normalized) {
      return;
    }
    point.type = normalized;
    renderAll();
  }
  function togglePointType(id) {
    const point = state.criticalPoints.find(p => p.id === id);
    if (!point) return;
    const nextType = point.type === 'pole' ? 'zero' : 'pole';
    setPointType(id, nextType);
  }
  function removePoint(id) {
    const index = state.criticalPoints.findIndex(p => p.id === id);
    if (index === -1) return;
    state.criticalPoints.splice(index, 1);
    syncSegments();
    renderAll();
  }
  function removeRow(id) {
    const index = state.signRows.findIndex(row => row.id === id);
    if (index === -1) return;
    const row = state.signRows[index];
    if (row.locked || row.role === 'result') return;
    state.signRows.splice(index, 1);
    renderAll();
  }
  function toggleSegment(rowId, index) {
    const row = state.signRows.find(r => r.id === rowId);
    if (!row) return;
    if (row.locked) {
      return;
    }
    if (state.autoSync && row.role === 'result' && state.solution) {
      return;
    }
    row.segments[index] = row.segments[index] >= 0 ? -1 : 1;
    renderChart();
  }
  function isChartLocked() {
    return !!state.autoSync;
  }
  function updateLockStateUi() {
    const locked = isChartLocked();
    const display = locked ? 'none' : '';
    [btnAddPoint, overlayAddPoint, btnAddRow, overlayAddRow].forEach(button => {
      if (!button) {
        return;
      }
      button.style.display = display;
    });
  }
  function addPoint(type = 'zero', value = 0) {
    updateIdCounters();
    state.criticalPoints.push({
      id: `p${pointIdCounter++}`,
      type,
      value
    });
    sortPoints();
    syncSegments();
    renderAll();
  }
  function addRow() {
    updateIdCounters();
    const expected = Math.max(1, state.criticalPoints.length + 1);
    const segments = Array(expected).fill(1);
    state.signRows.push({
      id: `row-${rowIdCounter++}`,
      label: `rad ${state.signRows.length + 1}`,
      segments,
      role: 'custom',
      locked: false
    });
    renderAll();
  }
  function applySolutionToState(solution) {
    updateIdCounters();
    state.criticalPoints = solution.points.map(point => ({
      id: `p${pointIdCounter++}`,
      type: point.type,
      value: point.value
    }));
    const nonFactorRows = state.signRows.filter(row => row.role !== 'factor');
    let resultRow = nonFactorRows.find(row => row.role === 'result');
    const customRows = [];
    nonFactorRows.forEach(row => {
      if (row.role !== 'result') {
        customRows.push(row);
      }
    });
    if (!resultRow) {
      resultRow = {
        id: `row-${rowIdCounter++}`,
        label: 'f(x)',
        segments: [],
        role: 'result',
        locked: false
      };
    }
    resultRow.segments = solution.segments.slice();
    if (!resultRow.label) {
      resultRow.label = 'f(x)';
    }
    resultRow.locked = false;
    const rows = [];
    if (state.useLinearFactors && Array.isArray(solution.factorRows) && solution.factorRows.length) {
      solution.factorRows.forEach(info => {
        rows.push({
          id: `row-${rowIdCounter++}`,
          label: info.label,
          segments: info.segments.slice(),
          role: 'factor',
          locked: true,
          type: info.type,
          value: info.value,
          multiplicity: info.multiplicity
        });
      });
    }
    rows.push(resultRow);
    customRows.forEach(row => {
      rows.push(row);
    });
    state.signRows = rows;
    syncSegments();
    updateIdCounters();
    renderAll();
  }
  function ensureSolution() {
    const rawExpr = getExpressionInputValue();
    if (!rawExpr) {
      state.solution = null;
      setCheckMessage('Skriv inn et funksjonsuttrykk for å vise fasit.', 'info');
      return false;
    }
    const sanitizedExpr = sanitizeExpression(rawExpr);
    if (state.solution && state.solution.expression && sanitizedExpr && state.solution.expression !== sanitizedExpr) {
      state.solution = null;
    }
    if (!state.solution) {
      try {
        state.solution = generateSolutionFromExpression();
      } catch (err) {
        setCheckMessage(err.message, 'error');
        return false;
      }
    }
    return !!state.solution;
  }
  function syncControlValues() {
    if (exprInput) {
      setExpressionInputValue(state.expression || '');
    }
    if (autoSyncInput) {
      autoSyncInput.checked = !!state.autoSync;
    }
    if (useLinearFactorsInput) {
      useLinearFactorsInput.checked = !!state.useLinearFactors;
    }
    if (domainMinInput) {
      if (Number.isFinite(state.domain.min)) {
        domainMinInput.value = formatPointValue(state.domain.min);
      } else {
        domainMinInput.value = '';
      }
      domainMinInput.classList.remove('input-invalid');
    }
    if (domainMaxInput) {
      if (Number.isFinite(state.domain.max)) {
        domainMaxInput.value = formatPointValue(state.domain.max);
      } else {
        domainMaxInput.value = '';
      }
      domainMaxInput.classList.remove('input-invalid');
    }
    if (decimalPlacesInput) {
      decimalPlacesInput.value = `${getDecimalPlaces()}`;
      decimalPlacesInput.classList.remove('input-invalid');
    }
  }
  function renderAll() {
    pruneFactorRowsIfDisabled();
    updateIdCounters();
    sortPoints();
    syncSegments();
    syncControlValues();
    updateLockStateUi();
    renderPointsList();
    renderRowsList();
    renderChart();
  }
  function startDragging(pointId, pointerId, capture = true) {
    if (isChartLocked()) {
      return;
    }
    if (!pointId) return;
    dragging = {
      id: pointId,
      pointerId,
      moved: false
    };
    if (!dragDomainLock && currentScale) {
      const domainMin = Number.isFinite(currentScale.domainMin) ? currentScale.domainMin : null;
      const domainMax = Number.isFinite(currentScale.domainMax) ? currentScale.domainMax : null;
      if (domainMin != null && domainMax != null && domainMax > domainMin) {
        dragDomainLock = {
          min: domainMin,
          max: domainMax
        };
      }
    }
    if (capture && pointerId !== undefined && svg.setPointerCapture) {
      try {
        svg.setPointerCapture(pointerId);
      } catch (err) {
        /* ignore */
      }
    }
  }
  svg.addEventListener('pointerdown', event => {
    if (isChartLocked()) {
      return;
    }
    const target = event.target;
    if (!(target instanceof SVGElement)) return;
    const pointId = target.getAttribute('data-point-id');
    if (!pointId) return;
    event.preventDefault();
    startDragging(pointId, event.pointerId);
  });
  function stopDragging(event) {
    if (!dragging) return;
    const pointerId = event.pointerId !== undefined ? event.pointerId : dragging.pointerId;
    if (pointerId !== undefined && svg.hasPointerCapture(pointerId)) {
      svg.releasePointerCapture(pointerId);
    }
    const moved = dragging.moved;
    dragging = null;
    if (dragDomainLock) {
      dragDomainLock = null;
    }
    if (moved) {
      syncSegments();
      renderAll();
    }
  }
  window.addEventListener('pointermove', event => {
    if (!dragging || !currentScale) return;
    const rect = svg.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const value = currentScale.toValue(relativeX);
    if (!Number.isFinite(value)) return;
    setPointValue(dragging.id, value, true);
  });
  window.addEventListener('pointerup', stopDragging);
  window.addEventListener('pointercancel', stopDragging);
  function handleAddPoint() {
    addPoint('zero', 0);
    setCheckMessage('');
  }
  function handleAddRow() {
    addRow();
    setCheckMessage('');
  }
  if (btnAddPoint) {
    btnAddPoint.addEventListener('click', handleAddPoint);
  }
  if (overlayAddPoint) {
    overlayAddPoint.addEventListener('click', handleAddPoint);
  }
  if (btnAddRow) {
    btnAddRow.addEventListener('click', handleAddRow);
  }
  if (overlayAddRow) {
    overlayAddRow.addEventListener('click', handleAddRow);
  }
  if (downloadSvgButton) {
    downloadSvgButton.addEventListener('click', () => {
      downloadSvgFile('fortegnsskjema');
    });
  }
  if (downloadPngButton) {
    downloadPngButton.addEventListener('click', () => {
      downloadPngFile('fortegnsskjema');
    });
  }
  function handleDomainChange(key, event) {
    const input = event.target;
    const raw = input.value.trim().replace(',', '.');
    if (raw === '') {
      state.domain[key] = null;
      input.classList.remove('input-invalid');
      renderAll();
      return;
    }
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value)) {
      state.domain[key] = value;
      input.value = formatPointValue(value);
      input.classList.remove('input-invalid');
      renderAll();
    } else {
      input.classList.add('input-invalid');
    }
  }
  function handleDomainInput(event) {
    const raw = event.target.value.trim().replace(',', '.');
    if (raw === '' || Number.isFinite(Number.parseFloat(raw))) {
      event.target.classList.remove('input-invalid');
    } else {
      event.target.classList.add('input-invalid');
    }
  }
  function handleDecimalPlacesInput(event) {
    const raw = event.target.value.trim().replace(',', '.');
    if (raw === '' || Number.isFinite(Number.parseFloat(raw))) {
      event.target.classList.remove('input-invalid');
    } else {
      event.target.classList.add('input-invalid');
    }
  }
  function handleDecimalPlacesChange(event) {
    const input = event.target;
    const raw = input.value.trim().replace(',', '.');
    if (raw === '') {
      input.value = `${getDecimalPlaces()}`;
      input.classList.remove('input-invalid');
      return;
    }
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value)) {
      const sanitized = clampDecimalPlaces(value);
      state.decimalPlaces = sanitized;
      input.value = `${sanitized}`;
      input.classList.remove('input-invalid');
      renderAll();
    } else {
      input.classList.add('input-invalid');
    }
  }
  if (domainMinInput) {
    domainMinInput.addEventListener('change', handleDomainChange.bind(null, 'min'));
    domainMinInput.addEventListener('input', handleDomainInput);
  }
  if (domainMaxInput) {
    domainMaxInput.addEventListener('change', handleDomainChange.bind(null, 'max'));
    domainMaxInput.addEventListener('input', handleDomainInput);
  }
  if (decimalPlacesInput) {
    decimalPlacesInput.value = `${getDecimalPlaces()}`;
    decimalPlacesInput.addEventListener('change', handleDecimalPlacesChange);
    decimalPlacesInput.addEventListener('input', handleDecimalPlacesInput);
  }
  if (btnCheck) {
    btnCheck.addEventListener('click', () => {
      const taskApi = getTaskApi();
      if (taskApi && typeof taskApi.evaluateTask === 'function') {
        taskApi.evaluateTask(TASK_APP_ID);
        return;
      }
      if (!ensureSolution()) {
        return;
      }
      runCheck();
    });
  }
  autoSyncInput.addEventListener('change', event => {
    state.autoSync = event.target.checked;
    updateLockStateUi();
    if (state.autoSync && ensureSolution()) {
      applySolutionToState(state.solution);
      setCheckMessage('Fortegnslinjen oppdateres automatisk fra fasit.', 'info');
    } else {
      renderAll();
    }
  });
  if (useLinearFactorsInput) {
    useLinearFactorsInput.checked = state.useLinearFactors;
    useLinearFactorsInput.addEventListener('change', event => {
      state.useLinearFactors = event.target.checked;
      if (state.useLinearFactors) {
        if (ensureSolution()) {
          applySolutionToState(state.solution);
          setCheckMessage('Fortegnslinjene inkluderer lineære faktorer.', 'info');
        } else {
          renderAll();
        }
      } else {
        pruneFactorRowsIfDisabled();
        renderAll();
      }
    });
  }
  function commitExpressionChange() {
    if (!exprInput || isUpdatingExpressionInput) return;
    const details = readExpressionInputDetails();
    const nextValue = details.sanitized;
    const nextPrefix = !!details.hasPrefix;
    if (nextValue === state.expression && nextPrefix === !!state.expressionPrefix) {
      setExpressionInputValue(state.expression || '');
      renderExpressionDisplay();
      refreshAltText('config');
      return;
    }
    state.expression = nextValue;
    state.expressionPrefix = nextPrefix;
    state.solution = null;
    setCheckMessage('');
    if (state.autoSync && ensureSolution()) {
      applySolutionToState(state.solution);
    }
    setExpressionInputValue(state.expression || '');
    renderExpressionDisplay();
    refreshAltText('config');
  }
  exprInput.addEventListener('change', commitExpressionChange);
  exprInput.addEventListener('blur', commitExpressionChange);
  exprInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      commitExpressionChange();
    }
  });
  window.addEventListener('resize', () => {
    renderChart();
  });
  if (typeof window !== 'undefined') {
    window.renderAll = renderAll;
    window.render = renderAll;
    window.fortegnsskjemaApi = {
      createCleanState,
      loadCleanState,
      onExampleCollect: event => {
        if (!event || !event.detail) return;
        const markup = getExportSvgMarkup();
        if (markup) {
          event.detail.svgOverride = markup;
        }
      },
      onExampleLoaded: () => {
        sanitizeState(state);
        updateIdCounters();
        renderAll();
        setCheckMessage('');
        if (altTextManager) {
          altTextManager.applyCurrent();
          refreshAltText('examples');
        }
      }
    };
    const mv = window.mathVisuals && typeof window.mathVisuals === 'object' ? window.mathVisuals : {};
    mv.activeTool = window.fortegnsskjemaApi;
    window.mathVisuals = mv;
  }
  createDefaultRow();
  initAltTextManager();
  renderAll();

  function ensureTaskControlsHost() {
    if (!taskCheckHost) return;
    taskCheckControls.forEach(control => {
      if (control && control.parentElement !== taskCheckHost) {
        taskCheckHost.appendChild(control);
      }
    });
  }

  function isTaskLikeMode(mode) {
    const normalized = typeof mode === 'string' ? mode.trim().toLowerCase() : '';
    return (
      normalized === 'task' ||
      normalized === 'preview' ||
      normalized === 'forhandsvisning' ||
      normalized === 'forhåndsvisning'
    );
  }

  function applyAppModeToTaskControls(mode) {
    if (!taskCheckHost) return;
    const isTaskMode = isTaskLikeMode(mode);
    if (isTaskMode) {
      ensureTaskControlsHost();
      taskCheckHost.hidden = false;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control === btnCheck) {
          control.hidden = false;
          if (control.dataset) delete control.dataset.prevHidden;
          return;
        }
        if (control.dataset && 'prevHidden' in control.dataset) {
          const wasHidden = control.dataset.prevHidden === '1';
          delete control.dataset.prevHidden;
          control.hidden = wasHidden;
        }
      });
    } else {
      taskCheckHost.hidden = true;
      taskCheckControls.forEach(control => {
        if (!control) return;
        if (control.dataset) {
          control.dataset.prevHidden = control.hidden ? '1' : '0';
        }
        control.hidden = true;
      });
    }
  }

  function syncBodyAppMode(mode) {
    if (typeof document === 'undefined') return;
    const body = document.body;
    if (!body || !body.dataset) return;
    const normalized = isTaskLikeMode(mode) ? 'task' : typeof mode === 'string' && mode.trim() ? mode.trim() : 'default';
    if (body.dataset.appMode !== normalized) {
      body.dataset.appMode = normalized;
    }
  }

  function getCurrentAppMode() {
    if (typeof window === 'undefined') return 'default';
    const mv = window.mathVisuals;
    if (mv && typeof mv.getAppMode === 'function') {
      try {
        const mode = mv.getAppMode();
        if (typeof mode === 'string' && mode) {
          return mode;
        }
      } catch (_) {
        // fall through to query parsing below
      }
    }
    try {
      const params = new URLSearchParams(window.location && window.location.search ? window.location.search : '');
      const fromQuery = params.get('mode');
      if (typeof fromQuery === 'string' && fromQuery.trim()) {
        return isTaskLikeMode(fromQuery) ? 'task' : 'default';
      }
    } catch (_) {}
    return 'default';
  }

  function handleAppModeChanged(event) {
    if (!event) return;
    const detail = event.detail;
    if (!detail || typeof detail.mode !== 'string') return;
    syncBodyAppMode(detail.mode);
    applyAppModeToTaskControls(detail.mode);
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('math-visuals:app-mode-changed', handleAppModeChanged);
  }

  const initialAppMode = getCurrentAppMode() || 'task';
  syncBodyAppMode(initialAppMode);
  applyAppModeToTaskControls(initialAppMode);
})();
