(function attachMathVisDescriptionRenderer(global) {
  if (!global || typeof global !== 'object') return;
  const doc = global.document;
  if (!doc) return;

  const KATEX_VERSION = '0.16.9';
  const DEFAULT_KATEX_BASE_PATH = '/vendor/cdn/katex';
  const scriptList = () => {
    if (!doc || typeof doc.getElementsByTagName !== 'function') return [];
    const list = [];
    if (doc.currentScript) list.push(doc.currentScript);
    list.push(...doc.getElementsByTagName('script'));
    return list;
  };

  const normalizeBasePath = value => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed.replace(/\/+$/, '');
  };

  const resolveFromScript = script => {
    if (!script) return null;
    const dataValue = script.dataset && (script.dataset.mathVisKatexBase || script.dataset.mathvisKatexBase);
    const attrValue = script.getAttribute && (script.getAttribute('data-math-vis-katex-base') || script.getAttribute('data-mathvis-katex-base'));
    const explicit = normalizeBasePath(dataValue || attrValue);
    if (explicit) return explicit;
    if (script.src) {
      try {
        const url = new URL('vendor/cdn/katex/', script.src);
        return normalizeBasePath(url.href);
      } catch (error) {
        // Ignore resolution errors and fall through to other strategies.
      }
    }
    return null;
  };

  const resolveKatexBasePath = () => {
    const explicitGlobal = normalizeBasePath(global.__MATH_VIS_KATEX_BASE_PATH__);
    if (explicitGlobal) return explicitGlobal;

    for (const script of scriptList()) {
      const resolved = resolveFromScript(script);
      if (resolved) return resolved;
    }

    if (doc && typeof doc.baseURI === 'string') {
      try {
        const url = new URL(DEFAULT_KATEX_BASE_PATH.replace(/^\//, ''), doc.baseURI);
        return normalizeBasePath(url.href) || DEFAULT_KATEX_BASE_PATH;
      } catch (error) {
        // Ignore resolution errors and fall back to default path.
      }
    }

    if (global.location && typeof global.location.href === 'string') {
      try {
        const url = new URL(DEFAULT_KATEX_BASE_PATH.replace(/^\//, ''), global.location.href);
        return normalizeBasePath(url.href) || DEFAULT_KATEX_BASE_PATH;
      } catch (error) {
        // Ignore resolution errors and fall back to default path.
      }
    }

    return DEFAULT_KATEX_BASE_PATH;
  };

  const KATEX_BASE_PATH = resolveKatexBasePath();
  const KATEX_CSS_ID = 'math-vis-katex-style';
  const KATEX_SCRIPT_ID = 'math-vis-katex-script';
  const INPUT_STATUS_MESSAGES = {
    correct: 'Riktig!',
    incorrect: 'Prøv igjen.'
  };
  let inputFieldIdCounter = 0;
  const inputFieldRegistry = new WeakMap();

  let katexPromise = null;

  const DESCRIPTION_RENDERER_LOG_PREFIX = '[math-vis:description-renderer]';
  function logDescriptionRendererEvent(level, message, details) {
    if (!global || !global.console) return;
    const consoleRef = global.console;
    const method = typeof consoleRef[level] === 'function' ? consoleRef[level] : consoleRef.log;
    try {
      if (details !== undefined) {
        method.call(consoleRef, `${DESCRIPTION_RENDERER_LOG_PREFIX} ${message}`, details);
      } else {
        method.call(consoleRef, `${DESCRIPTION_RENDERER_LOG_PREFIX} ${message}`);
      }
    } catch (_) {}
  }

  function describeError(error) {
    if (!error) return null;
    const details = {};
    if (typeof error.name === 'string' && error.name) {
      details.name = error.name;
    }
    if (typeof error.message === 'string' && error.message) {
      details.message = error.message;
    } else {
      try {
        details.message = String(error);
      } catch (_) {}
    }
    if (typeof error.stack === 'string' && error.stack) {
      details.stack = error.stack;
    }
    return details;
  }

  function ensureKatexLoaded() {
    if (global.katex && typeof global.katex.render === 'function') {
      logDescriptionRendererEvent('debug', 'KaTeX already loaded – skipping loader');
      return Promise.resolve(global.katex);
    }
    if (!doc || typeof doc.createElement !== 'function') {
      return Promise.reject(new Error('Document is not available'));
    }
    if (katexPromise) {
      logDescriptionRendererEvent('debug', 'Reusing pending KaTeX load promise');
      return katexPromise;
    }
    katexPromise = new Promise((resolve, reject) => {
      const cleanupOnError = error => {
        katexPromise = null;
        logDescriptionRendererEvent('error', 'KaTeX loader failed', {
          basePath: KATEX_BASE_PATH,
          error: describeError(error)
        });
        reject(error);
      };

      try {
        if (!doc.getElementById(KATEX_CSS_ID)) {
          const link = doc.createElement('link');
          link.id = KATEX_CSS_ID;
          link.rel = 'stylesheet';
          link.href = `${KATEX_BASE_PATH}/katex.min.css`;
          logDescriptionRendererEvent('info', 'Injecting KaTeX stylesheet', { href: link.href });
          doc.head.appendChild(link);
        }
      } catch (error) {
        cleanupOnError(error);
        return;
      }

      const resolveIfReady = () => {
        if (global.katex && typeof global.katex.render === 'function') {
          resolve(global.katex);
          return true;
        }
        return false;
      };

      if (resolveIfReady()) return;

      let script = doc.getElementById(KATEX_SCRIPT_ID);
      if (!script) {
        script = doc.createElement('script');
        script.id = KATEX_SCRIPT_ID;
        script.type = 'text/javascript';
        script.async = true;
        script.src = `${KATEX_BASE_PATH}/katex.min.js`;
        script.setAttribute('data-mathvis-loader', 'true');
        logDescriptionRendererEvent('info', 'Injecting KaTeX script', { src: script.src });
        script.addEventListener('load', () => {
          if (!resolveIfReady()) {
            cleanupOnError(new Error('KaTeX failed to initialize'));
          } else {
            logDescriptionRendererEvent('info', 'KaTeX script loaded successfully', { src: script.src });
          }
        });
        script.addEventListener('error', event => {
          cleanupOnError(new Error('Failed to load KaTeX assets'));
        });
        doc.head.appendChild(script);
      } else if (script.hasAttribute('data-mathvis-loader')) {
        script.addEventListener('load', () => {
          if (!resolveIfReady()) {
            cleanupOnError(new Error('KaTeX failed to initialize'));
          } else {
            logDescriptionRendererEvent('info', 'KaTeX script load event received (existing loader)', { src: script.src });
          }
        }, { once: true });
        script.addEventListener('error', event => {
          cleanupOnError(new Error('Failed to load KaTeX assets'));
        }, { once: true });
      } else if (resolveIfReady()) {
        return;
      }
    });
    return katexPromise;
  }

  function extractBalancedContent(text, startIndex, openChar = '{', closeChar = '}') {
    let depth = 1;
    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];
      if (char === openChar) {
        depth += 1;
      } else if (char === closeChar) {
        depth -= 1;
        if (depth === 0) {
          return {
            content: text.slice(startIndex, i),
            endIndex: i
          };
        }
      }
    }
    return null;
  }

  function splitDescriptor(content) {
    const parts = [];
    if (typeof content !== 'string' || !content) return parts;
    let current = '';
    let escape = false;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      if (escape) {
        current += char;
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
        current += char;
        continue;
      }
      if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
        current += char;
        continue;
      }
      let isSeparator = false;
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '|') {
          isSeparator = true;
        } else if (char === ',') {
          const prevChar = content[i - 1];
          const nextChar = content[i + 1];
          const nextIsWhitespace = typeof nextChar === 'string' && /\s/.test(nextChar);
          const nextIsQuote = nextChar === '"' || nextChar === "'";
          if (prevChar === '"' || prevChar === "'" || nextIsWhitespace || nextIsQuote) {
            isSeparator = true;
          }
        }
      }
      if (isSeparator) {
        const nextChar = content[i + 1];
        if (nextChar === char) {
          current += char;
          i += 1;
          current += content[i];
          continue;
        }
        parts.push(current);
        current = '';
        continue;
      }
      current += char;
    }
    parts.push(current);
    return parts;
  }

  function unescapeMarkup(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/\\([\\{}|,])/g, '$1');
  }

  function stripEnclosingQuotes(value) {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (trimmed.length >= 2) {
      const first = trimmed[0];
      const last = trimmed[trimmed.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        return trimmed.slice(1, -1);
      }
    }
    return trimmed;
  }

  function sanitizeDescriptorValue(value) {
    if (typeof value !== 'string') return '';
    return stripEnclosingQuotes(unescapeMarkup(value));
  }

  function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return null;
  }

  function parseNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function collapseWhitespace(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim();
  }

  function toNumericValue(value) {
    if (typeof value !== 'string') return null;
    const stripped = value.replace(/\s+/g, '').replace(/,/g, '.');
    if (!stripped || /[^0-9+\-.]/.test(stripped)) {
      return null;
    }
    if (!/^[-+]?\d*(?:\.\d+)?$/.test(stripped)) {
      return null;
    }
    const parsed = Number(stripped);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseInputDescriptor(content) {
    const parts = splitDescriptor(content);
    const positional = [];
    const options = {};
    parts.forEach(part => {
      const trimmed = typeof part === 'string' ? part.trim() : '';
      if (!trimmed) return;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim().toLowerCase();
        const value = trimmed.slice(eqIndex + 1);
        if (key) {
          options[key] = sanitizeDescriptorValue(value);
        }
      } else {
        positional.push(sanitizeDescriptorValue(trimmed));
      }
    });
    if (!options.value && positional.length) options.value = positional.shift();
    if (!options.placeholder && positional.length) options.placeholder = positional.shift();
    if (!options.label && positional.length) options.label = positional.shift();
    if (!options.correct && positional.length) options.correct = positional.shift();
    if (!options.incorrect && positional.length) options.incorrect = positional.shift();

    const accepted = [];
    const addAccepted = raw => {
      if (typeof raw !== 'string') return;
      const segments = raw.split(/\|\|/);
      segments.forEach(segment => {
        const normalized = collapseWhitespace(unescapeMarkup(segment));
        if (normalized) {
          accepted.push(normalized);
        }
      });
    };
    addAccepted(options.value);
    addAccepted(options.values);
    addAccepted(options.answer);
    addAccepted(options.answers);
    addAccepted(options.accept);

    const caseSensitive = parseBoolean(options.caseSensitive ?? options.casesensitive ?? options.case ?? options.matchcase) === true;
    const tolerance = parseNumber(options.tolerance ?? options.toleranse ?? options.slack);
    const correctMessage = options.correct ?? options.correctMessage ?? options.success ?? options.ok ?? '';
    const incorrectMessage = options.incorrect ?? options.incorrectMessage ?? options.error ?? options.fail ?? '';

    return {
      acceptedAnswers: accepted.map(answer => ({
        raw: answer,
        normalized: collapseWhitespace(answer),
        comparable: collapseWhitespace(answer).toLowerCase(),
        numeric: toNumericValue(answer)
      })),
      placeholder: options.placeholder || '',
      label: options.label || '',
      width: options.width || options.bredde || '',
      size: options.size || options.length || '',
      caseSensitive,
      tolerance: typeof tolerance === 'number' ? Math.max(0, tolerance) : null,
      correctMessage: collapseWhitespace(correctMessage) || '',
      incorrectMessage: collapseWhitespace(incorrectMessage) || ''
    };
  }

  function normalizeMathContent(tex) {
    if (typeof tex !== 'string') return tex;
    const trimmed = tex.trim();
    if (!trimmed) return tex;
    const fractionMatch = trimmed.match(/^([-+]?\d+)\s*\/\s*([-+]?\d+)$/);
    if (fractionMatch) {
      const [, numerator, denominator] = fractionMatch;
      if (denominator !== '0') {
        return `\\tfrac{${numerator}}{${denominator}}`;
      }
    }
    return tex;
  }

  function findNextSpecial(text, index, allowInputs) {
    const nextBreak = text.indexOf('\n', index);
    const nextMath = text.indexOf('@math{', index);
    const result = {
      type: 'end',
      nextIndex: text.length,
      marker: null,
      openChar: null,
      closeChar: null
    };
    if (nextBreak !== -1 && nextBreak < result.nextIndex) {
      result.type = 'break';
      result.nextIndex = nextBreak;
    }
    if (nextMath !== -1 && nextMath < result.nextIndex) {
      result.type = 'math';
      result.nextIndex = nextMath;
      result.marker = null;
      result.openChar = null;
      result.closeChar = null;
    }
    if (allowInputs) {
      const marker = '@input[';
      const position = text.indexOf(marker, index);
      if (position !== -1 && position < result.nextIndex) {
        result.type = 'input';
        result.nextIndex = position;
        result.marker = marker;
        result.openChar = '[';
        result.closeChar = ']';
      }
    }
    return result;
  }

  function appendInlineContent(container, text, placeholders, interactives, options) {
    if (!container || typeof container.appendChild !== 'function') return;
    if (typeof text !== 'string' || text === '') {
      if (text === '') {
        container.appendChild(doc.createTextNode(''));
      }
      return;
    }
    const allowInputs = !(options && options.allowInputs === false);
    let index = 0;
    while (index < text.length) {
      const { type, nextIndex, marker, openChar, closeChar } = findNextSpecial(text, index, allowInputs);
      if (type === 'end') {
        if (index < text.length) {
          container.appendChild(doc.createTextNode(text.slice(index)));
        }
        break;
      }
      if (nextIndex > index) {
        container.appendChild(doc.createTextNode(text.slice(index, nextIndex)));
        index = nextIndex;
        continue;
      }
      if (type === 'break') {
        container.appendChild(doc.createElement('br'));
        index = nextIndex + 1;
        continue;
      }
      if (type === 'math') {
        const extraction = extractBalancedContent(text, nextIndex + '@math{'.length);
        if (!extraction) {
          container.appendChild(doc.createTextNode(text.slice(nextIndex)));
          break;
        }
        const span = doc.createElement('span');
        span.className = 'math-vis-description-math';
        const normalizedTex = normalizeMathContent(extraction.content);
        span.textContent = normalizedTex;
        placeholders.push({ element: span, tex: normalizedTex });
        container.appendChild(span);
        index = extraction.endIndex + 1;
        continue;
      }
      if (type === 'input') {
        const markerLength = marker.length;
        const extraction = extractBalancedContent(
          text,
          nextIndex + markerLength,
          openChar || '{',
          closeChar || '}'
        );
        if (!extraction) {
          container.appendChild(doc.createTextNode(text.slice(nextIndex)));
          break;
        }
        const inputElement = createInputField(extraction.content, placeholders, interactives);
        if (inputElement) {
          container.appendChild(inputElement);
        } else {
          container.appendChild(doc.createTextNode(text.slice(nextIndex, extraction.endIndex + 1)));
        }
        index = extraction.endIndex + 1;
      }
    }
  }

  function appendParagraphs(fragment, text, placeholders, interactives) {
    if (!fragment || typeof fragment.appendChild !== 'function') return;
    if (typeof text !== 'string') return;
    const normalized = text.replace(/\r\n?/g, '\n');
    const paragraphs = normalized.split(/\n{2,}/);
    paragraphs.forEach(paragraph => {
      if (!paragraph.trim()) return;
      const p = doc.createElement('p');
      appendInlineContent(p, paragraph, placeholders, interactives);
      fragment.appendChild(p);
    });
  }

  function createDescriptionTable(content, placeholders, interactives) {
    if (typeof content !== 'string') return null;
    const rows = content
      .split(/\n+/)
      .map(row => row.split('|').map(cell => cell.trim()))
      .filter(row => row.some(cell => cell));
    if (!rows.length) return null;
    const table = doc.createElement('table');
    table.className = 'example-description-table';
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    if (columnCount === 0) return null;
    let bodyStartIndex = 0;
    if (rows.length > 1) {
      const headerCandidate = rows[0];
      const hasHeader = headerCandidate.every(cell => cell && cell.length > 0);
      if (hasHeader) {
        const thead = doc.createElement('thead');
        const headRow = doc.createElement('tr');
        for (let i = 0; i < columnCount; i++) {
          const th = doc.createElement('th');
          appendInlineContent(th, headerCandidate[i] != null ? headerCandidate[i] : '', placeholders, interactives);
          headRow.appendChild(th);
        }
        thead.appendChild(headRow);
        table.appendChild(thead);
        bodyStartIndex = 1;
      }
    }
    const tbody = doc.createElement('tbody');
    const appendRow = row => {
      const tr = doc.createElement('tr');
      for (let i = 0; i < columnCount; i++) {
        const td = doc.createElement('td');
        appendInlineContent(td, row && row[i] != null ? row[i] : '', placeholders, interactives);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    };
    if (rows.length === 1) {
      appendRow(rows[0]);
    } else {
      for (let i = bodyStartIndex; i < rows.length; i++) {
        appendRow(rows[i]);
      }
    }
    table.appendChild(tbody);
    return table;
  }

  function createInputField(content, placeholders, interactives) {
    if (!interactives || !Array.isArray(interactives.inputFields)) return null;
    const descriptor = parseInputDescriptor(content);
    if (!descriptor.acceptedAnswers.length) {
      return null;
    }
    const container = doc.createElement('span');
    container.className = 'math-vis-answerbox math-vis-answerbox--empty';
    container.dataset.state = 'empty';
    container.classList.add('math-vis-answerbox--input');

    if (descriptor.label) {
      const prompt = doc.createElement('span');
      prompt.className = 'math-vis-answerbox__prompt';
      appendInlineContent(prompt, descriptor.label, placeholders, interactives, { allowInputs: false });
      container.appendChild(prompt);
    }

    const inputWrap = doc.createElement('span');
    inputWrap.className = 'math-vis-answerbox__input-wrap';

    const input = doc.createElement('input');
    input.type = 'text';
    input.className = 'math-vis-answerbox__input';
    if (descriptor.placeholder) input.placeholder = descriptor.placeholder;
    if (descriptor.width) {
      input.style.width = descriptor.width;
    } else if (descriptor.size) {
      const numericSize = Number(descriptor.size);
      if (Number.isFinite(numericSize) && numericSize > 0) {
        const rounded = Math.max(1, Math.round(numericSize));
        input.setAttribute('size', String(rounded));
      } else {
        input.style.width = descriptor.size;
      }
    }
    if (!descriptor.label) {
      const ariaLabel = descriptor.placeholder || 'Svar';
      input.setAttribute('aria-label', ariaLabel);
    }

    const status = doc.createElement('span');
    status.className = 'math-vis-answerbox__status';
    status.setAttribute('aria-live', 'polite');
    const statusId = `math-vis-answerbox-status-${++inputFieldIdCounter}`;
    status.id = statusId;
    input.setAttribute('aria-describedby', statusId);

    inputWrap.appendChild(input);
    container.appendChild(inputWrap);
    container.appendChild(status);

    interactives.inputFields.push({
      container,
      input,
      status,
      descriptor,
      variant: 'input'
    });

    return container;
  }

  function findBlock(text, lowerText, marker, startIndex) {
    if (!text || !marker) return null;
    const lowerMarker = marker.toLowerCase();
    let searchIndex = startIndex;
    while (searchIndex < text.length) {
      const markerIndex = lowerText.indexOf(lowerMarker, searchIndex);
      if (markerIndex === -1) {
        return null;
      }
      let cursor = markerIndex + marker.length;
      while (cursor < text.length && /\s/.test(text[cursor])) {
        cursor += 1;
      }
      if (cursor >= text.length || !'{['.includes(text[cursor])) {
        searchIndex = markerIndex + marker.length;
        continue;
      }
      const openChar = text[cursor];
      const closeChar = openChar === '{' ? '}' : ']';
      const extraction = extractBalancedContent(text, cursor + 1, openChar, closeChar);
      if (!extraction) {
        return { markerIndex, extraction: null };
      }
      return { markerIndex, extraction };
    }
    return null;
  }

  function appendFlowContent(target, text, placeholders, interactives) {
    if (!target || typeof target.appendChild !== 'function') return;
    if (typeof text !== 'string' || !text.trim()) {
      appendParagraphs(target, text, placeholders, interactives);
      return;
    }
    const normalized = text.replace(/\r\n?/g, '\n');
    const lower = normalized.toLowerCase();
    let index = 0;
    while (index < normalized.length) {
      const found = findBlock(normalized, lower, '@table', index);
      if (!found) {
        break;
      }
      const before = normalized.slice(index, found.markerIndex);
      appendParagraphs(target, before, placeholders, interactives);
      if (!found.extraction) {
        appendParagraphs(target, normalized.slice(found.markerIndex), placeholders, interactives);
        return;
      }
      const table = createDescriptionTable(found.extraction.content, placeholders, interactives);
      if (table) {
        target.appendChild(table);
      } else {
        appendParagraphs(target, normalized.slice(found.markerIndex, found.extraction.endIndex + 1), placeholders, interactives);
      }
      index = found.extraction.endIndex + 1;
    }
    const after = normalized.slice(index);
    appendParagraphs(target, after, placeholders, interactives);
  }

  function parse(value) {
    const fragment = doc.createDocumentFragment();
    const placeholders = [];
    const inputFields = [];
    if (typeof value !== 'string') {
      return { fragment, placeholders, inputFields };
    }
    const interactives = { inputFields };
    appendFlowContent(fragment, value, placeholders, interactives);
    return { fragment, placeholders, inputFields };
  }

  function setInputFieldState(box, state) {
    if (!box || !box.container) return;
    const { container, status, input, descriptor } = box;
    const stateClasses = ['math-vis-answerbox--empty', 'math-vis-answerbox--correct', 'math-vis-answerbox--incorrect'];
    stateClasses.forEach(className => {
      if (container.classList.contains(className)) {
        container.classList.remove(className);
      }
    });
    if (state && typeof state === 'string') {
      const nextClass = `math-vis-answerbox--${state}`;
      if (stateClasses.includes(nextClass)) {
        container.classList.add(nextClass);
      }
    }
    if (state && typeof state === 'string') {
      container.dataset.state = state;
    } else {
      delete container.dataset.state;
    }
    if (!status || !input) return;
    if (state === 'correct') {
      status.textContent = descriptor.correctMessage || INPUT_STATUS_MESSAGES.correct;
      input.setAttribute('aria-invalid', 'false');
    } else if (state === 'incorrect') {
      status.textContent = descriptor.incorrectMessage || INPUT_STATUS_MESSAGES.incorrect;
      input.setAttribute('aria-invalid', 'true');
    } else {
      status.textContent = '';
      input.removeAttribute('aria-invalid');
    }
  }

  function evaluateInputField(box) {
    if (!box || !box.input) return 'empty';
    const { input, descriptor } = box;
    const raw = typeof input.value === 'string' ? input.value : '';
    const trimmed = collapseWhitespace(raw);
    if (!trimmed) {
      setInputFieldState(box, 'empty');
      return 'empty';
    }
    const comparable = descriptor.caseSensitive ? trimmed : trimmed.toLowerCase();
    const numericValue = toNumericValue(raw);
    const isCorrect = descriptor.acceptedAnswers.some(answer => {
      if (descriptor.caseSensitive) {
        if (trimmed === answer.normalized) return true;
      } else if (comparable === answer.comparable) {
        return true;
      }
      if (numericValue != null && answer.numeric != null) {
        const tolerance = typeof descriptor.tolerance === 'number' ? descriptor.tolerance : 0;
        if (Math.abs(numericValue - answer.numeric) <= tolerance + Number.EPSILON) {
          return true;
        }
      }
      return false;
    });
    const nextState = isCorrect ? 'correct' : 'incorrect';
    setInputFieldState(box, nextState);
    return nextState;
  }

  function registerInputFields(target, boxes) {
    if (!target || typeof target !== 'object') return;
    if (Array.isArray(boxes) && boxes.length) {
      inputFieldRegistry.set(target, boxes);
    } else {
      inputFieldRegistry.delete(target);
    }
  }

  function getRegisteredInputFields(target) {
    if (!target || typeof target !== 'object') return [];
    const registered = inputFieldRegistry.get(target);
    if (!Array.isArray(registered)) return [];
    return registered;
  }

  function setupInputFields(target, inputFields) {
    if (!target || typeof target !== 'object') return;
    if (!Array.isArray(inputFields) || !inputFields.length) {
      registerInputFields(target, []);
      return;
    }
    const boxes = inputFields.filter(box => box && box.input);
    boxes.forEach(box => {
      const handleChange = () => {
        const value = typeof box.input.value === 'string' ? box.input.value : '';
        const normalized = collapseWhitespace(value);
        if (normalized) {
          evaluateInputField(box);
        } else {
          setInputFieldState(box, 'empty');
        }
      };
      box.input.addEventListener('input', handleChange);
      box.input.addEventListener('change', handleChange);
      handleChange();
    });
    registerInputFields(target, boxes);
  }

  function hasRegisteredInputFields(target) {
    return getRegisteredInputFields(target).length > 0;
  }

  function evaluateRegisteredInputFields(target) {
    const boxes = getRegisteredInputFields(target);
    const summary = {
      total: boxes.length,
      correct: 0,
      incorrect: 0,
      empty: 0
    };
    boxes.forEach(box => {
      const state = evaluateInputField(box);
      if (state === 'correct') {
        summary.correct += 1;
      } else if (state === 'incorrect') {
        summary.incorrect += 1;
      } else {
        summary.empty += 1;
      }
    });
    return summary;
  }

  function resetRegisteredInputFields(target) {
    const boxes = getRegisteredInputFields(target);
    boxes.forEach(box => {
      setInputFieldState(box, 'empty');
    });
  }

  function renderInto(target, value) {
    if (!target) return false;
    while (target.firstChild) {
      target.removeChild(target.firstChild);
    }
    const parsed = parse(typeof value === 'string' ? value : '');
    const { fragment, placeholders, inputFields } = parsed;
    const hasContent = !!(fragment && fragment.childNodes && fragment.childNodes.length);
    if (fragment) {
      target.appendChild(fragment);
    }
    target.classList.add('math-vis-description-rendered');
    if (placeholders.length) {
      const schedule = () => {
        ensureKatexLoaded()
          .then(katex => {
            placeholders.forEach(({ element, tex }) => {
              if (!element || (!tex && tex !== '')) return;
              try {
                katex.render(tex, element, { throwOnError: false });
              } catch (error) {
                element.classList.add('math-vis-description-math--error');
                logDescriptionRendererEvent('error', 'KaTeX rendering failed for placeholder', {
                  tex,
                  error: describeError(error)
                });
              }
            });
          })
          .catch(error => {
            // Graceful fallback: leave text content untouched
            logDescriptionRendererEvent('warn', 'KaTeX unavailable during rendering – falling back to text', {
              basePath: KATEX_BASE_PATH,
              error: describeError(error)
            });
          });
      };
      if (typeof Promise === 'function' && Promise.resolve) {
        Promise.resolve().then(schedule);
      } else {
        setTimeout(schedule, 0);
      }
    }
    if (inputFields.length) {
      setupInputFields(target, inputFields);
    } else {
      registerInputFields(target, []);
    }
    return hasContent;
  }

  global.MathVisDescriptionRenderer = {
    ensureKatexLoaded,
    parse,
    renderInto,
    evaluateInputs: evaluateRegisteredInputFields,
    hasInputs: hasRegisteredInputFields,
    resetInputs: resetRegisteredInputFields
  };
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : null);
