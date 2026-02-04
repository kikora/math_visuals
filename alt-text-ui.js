(function (global) {
  const nsSvg = 'http://www.w3.org/2000/svg';

  function ensureSvgA11yNodes(svg) {
    if (!svg) {
      return { titleEl: null, descEl: null };
    }
    const doc = svg.ownerDocument || document;
    let titleEl = svg.querySelector('title');
    if (!titleEl) {
      titleEl = doc.createElementNS(nsSvg, 'title');
      svg.insertBefore(titleEl, svg.firstChild || null);
    }
    if (!titleEl.id) {
      const baseId = svg.id || 'figure';
      titleEl.id = `${baseId}-title`;
    }
    let descEl = svg.querySelector('desc');
    if (!descEl) {
      descEl = doc.createElementNS(nsSvg, 'desc');
      if (titleEl.nextSibling) {
        svg.insertBefore(descEl, titleEl.nextSibling);
      } else {
        svg.appendChild(descEl);
      }
    }
    if (!descEl.id) {
      const baseId = svg.id || 'figure';
      descEl.id = `${baseId}-desc`;
    }
    return { titleEl, descEl };
  }

  function createAltTextElements(container) {
    if (!container) return null;
    const existing = container.querySelector('.alt-text');
    if (existing) {
      if (!existing.hasAttribute('data-edit-only')) {
        existing.setAttribute('data-edit-only', '');
      }
      const textarea = existing.querySelector('textarea');
      const regenerateButton = existing.querySelector('[data-action="regenerate"]');
      const saveButton = existing.querySelector('[data-action="save"]');
      const status = existing.querySelector('[role="status"]');
      if (textarea && regenerateButton && status) {
        return { wrap: existing, textarea, regenerateButton, saveButton, status };
      }
    }

    const wrap = document.createElement('div');
    wrap.className = 'alt-text';
    wrap.setAttribute('data-edit-only', '');

    const label = document.createElement('label');
    label.setAttribute('for', 'altText');
    label.textContent = 'Alternativ tekst';

    const textarea = document.createElement('textarea');
    textarea.id = 'altText';
    textarea.rows = 4;
    textarea.placeholder = 'Teksten genereres automatisk og kan endres ved behov.';

    const footer = document.createElement('div');
    footer.className = 'alt-text__footer';

    const saveButton = document.createElement('button');
    saveButton.type = 'button';
    saveButton.className = 'btn alt-text__save-button';
    saveButton.id = 'btnSaveAltText';
    saveButton.dataset.action = 'save';
    saveButton.textContent = 'Lagre';

    const regenerateButton = document.createElement('button');
    regenerateButton.type = 'button';
    regenerateButton.className = 'btn';
    regenerateButton.id = 'btnRegenerateAltText';
    regenerateButton.dataset.action = 'regenerate';
    regenerateButton.textContent = 'Generer på nytt';

    const status = document.createElement('span');
    status.id = 'altTextStatus';
    status.className = 'alt-text__status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    footer.append(saveButton, regenerateButton, status);
    wrap.append(label, textarea, footer);
    container.appendChild(wrap);

    return { wrap, textarea, regenerateButton, saveButton, status };
  }

  function normalizeState(state) {
    if (!state || typeof state !== 'object') {
      return { text: '', source: 'auto' };
    }
    const text = typeof state.text === 'string' ? state.text : '';
    const source = state.source === 'manual' ? 'manual' : 'auto';
    return { text, source };
  }

  function createAltTextManager(options) {
    const {
      svg,
      container,
      getTitle,
      getState,
      setState,
      generate,
      getAutoMessage,
      getManualMessage,
      getSignature,
      save
    } = options || {};

    if (!svg || !container || typeof getState !== 'function' || typeof setState !== 'function' || typeof generate !== 'function') {
      return null;
    }

    const svgSource = typeof svg === 'function' ? svg : () => svg;
    const els = createAltTextElements(container);
    if (!els) return null;
    const { textarea, regenerateButton, saveButton, status } = els;

    let generationTimer = null;
    let currentSignature = null;
    let savedSignature = null;
    let manualStale = false;
    let pendingAutoFromStale = false;
    let lastSavedText = '';
    let lastSavedSource = 'auto';
    let saving = false;

    const hasSave = typeof save === 'function';
    if (saveButton) {
      if (!hasSave) {
        saveButton.setAttribute('hidden', '');
      } else {
        saveButton.removeAttribute('hidden');
      }
    }

    function normalizeSignature(value) {
      if (value == null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      try {
        return JSON.stringify(value);
      } catch (err) {
        return String(value);
      }
    }

    function fetchSignature(signatureOverride) {
      if (typeof signatureOverride !== 'undefined') {
        return normalizeSignature(signatureOverride);
      }
      if (typeof getSignature === 'function') {
        try {
          return normalizeSignature(getSignature());
        } catch (err) {
          return '';
        }
      }
      return currentSignature == null ? '' : currentSignature;
    }

    function setSavedSignature(signature) {
      savedSignature = signature == null ? currentSignature : signature;
      manualStale = false;
      pendingAutoFromStale = false;
    }

    function applyToSvg(text) {
      const targetSvg = svgSource();
      if (!targetSvg) return;
      const titleText = typeof getTitle === 'function' ? (getTitle() || '') : '';
      const descText = (text || '').trim();
      const { titleEl, descEl } = ensureSvgA11yNodes(targetSvg);
      const fallbackTitle = titleText.trim() || 'Figur';
      if (titleEl) titleEl.textContent = fallbackTitle;
      if (descEl) descEl.textContent = descText;
      targetSvg.setAttribute('role', 'img');
      targetSvg.setAttribute('aria-label', fallbackTitle);
      if (titleEl && titleEl.id) targetSvg.setAttribute('aria-labelledby', titleEl.id);
      if (descEl && descEl.id) targetSvg.setAttribute('aria-describedby', descEl.id);
    }

    function setStatus(message, isError, actions) {
      if (!status) return;
      status.textContent = '';
      while (status.firstChild) {
        status.removeChild(status.firstChild);
      }
      if (isError) {
        status.classList.add('alt-text__status--error');
      } else {
        status.classList.remove('alt-text__status--error');
      }
      if (message) {
        const doc = status.ownerDocument || document;
        const span = doc.createElement('span');
        span.textContent = message;
        status.appendChild(span);
      }
      if (Array.isArray(actions) && actions.length) {
        const doc = status.ownerDocument || document;
        actions.forEach(action => {
          if (!action || typeof action.onClick !== 'function') return;
          const btn = doc.createElement('button');
          btn.type = 'button';
          btn.className = 'alt-text__status-action';
          btn.textContent = action.label || 'OK';
          btn.addEventListener('click', event => {
            event.preventDefault();
            action.onClick();
          });
          status.appendChild(btn);
        });
      }
    }

    function syncTextarea(text) {
      if (!textarea) return;
      if (textarea.value !== text) {
        textarea.value = text;
      }
      if (textarea.textContent !== text) {
        textarea.textContent = text;
      }
      updateSaveButtonState();
    }

    function setStateAndApply(text, source) {
      setState(text, source);
      syncTextarea(text);
      applyToSvg(text);
      setSavedSignature();
      updateSaveButtonState();
    }

    function autoGenerate(reason) {
      const next = (generate(reason) || '').trim();
      setStateAndApply(next, 'auto');
      const message = typeof getAutoMessage === 'function' ? getAutoMessage(reason) : 'Alternativ tekst oppdatert automatisk.';
      setStatus(message, false);
      pendingAutoFromStale = false;
      updateSaveButtonState();
    }

    function scheduleAuto(reason = 'auto', delay = 600) {
      if (generationTimer) {
        clearTimeout(generationTimer);
        generationTimer = null;
      }
      const wait = Math.max(0, delay);
      if (wait === 0) {
        autoGenerate(reason);
        return;
      }
      generationTimer = setTimeout(() => {
        generationTimer = null;
        autoGenerate(reason);
      }, wait);
    }

    function handleManualInput() {
      const raw = textarea.value;
      const trimmed = raw.trim();
      if (trimmed) {
        setStateAndApply(trimmed, 'manual');
      const msg = typeof getManualMessage === 'function' ? getManualMessage() : 'Alternativ tekst oppdatert manuelt.';
      setStatus(msg, false);
      updateSaveButtonState();
    } else {
      setStateAndApply('', 'auto');
      setStatus('Feltet er tomt. Genererer forslag …', false);
      scheduleAuto('manual-clear', 0);
    }
    }

    function showManualStaleStatus() {
      const message = 'Figuren er endret. Den manuelle teksten er utdatert.';
      const actions = [
        {
          label: 'Generer automatisk',
          onClick: () => {
            pendingAutoFromStale = true;
            setStatus('Genererer forslag …', false);
            scheduleAuto('manual-stale-regenerate', 0);
          }
        },
        {
          label: 'Bytt til automatisk tekst',
          onClick: () => {
            pendingAutoFromStale = true;
            setStateAndApply('', 'auto');
            setStatus('Genererer forslag …', false);
            scheduleAuto('manual-stale-reset', 0);
          }
        }
      ];
      setStatus(message, true, actions);
    }

    function notifyFigureChange(signatureOverride) {
      currentSignature = fetchSignature(signatureOverride);
      const currentState = normalizeState(getState());
      const trimmed = currentState.text.trim();
      if (currentState.source === 'manual' && trimmed) {
        const staleNow = savedSignature !== currentSignature;
        manualStale = staleNow;
        if (staleNow && !pendingAutoFromStale) {
          showManualStaleStatus();
        }
      } else {
        manualStale = false;
        pendingAutoFromStale = false;
      }
      return currentSignature;
    }

    function normalizeSavedState(text, source) {
      const normalized = normalizeState({ text, source });
      lastSavedText = normalized.text;
      lastSavedSource = normalized.source;
      updateSaveButtonState();
    }

    function updateSaveButtonState() {
      if (!saveButton || !hasSave) {
        return;
      }
      const current = normalizeState(getState());
      const currentText = current.text;
      const savedText = lastSavedText || '';
      const isDirty = currentText.trim() !== savedText.trim() || current.source !== lastSavedSource;
      saveButton.disabled = saving || !isDirty;
    }

    async function handleSaveClick() {
      if (!saveButton || !hasSave || saving) {
        return;
      }
      const current = normalizeState(getState());
      const trimmed = current.text.trim();
      const savePayload = { text: trimmed, source: current.source };
      try {
        saving = true;
        updateSaveButtonState();
        setStatus('Lagrer …', false);
        const result = await Promise.resolve(save(trimmed, savePayload));
        const resolvedText = result && typeof result.text === 'string' ? result.text : trimmed;
        const resolvedSource = result && typeof result.source === 'string' ? result.source : current.source;
        normalizeSavedState(resolvedText, resolvedSource);
        const message = result && typeof result.message === 'string' && result.message.trim()
          ? result.message.trim()
          : 'Alternativ tekst lagret.';
        setStatus(message, false);
      } catch (error) {
        const message = error && error.message ? error.message : 'Kunne ikke lagre den alternative teksten.';
        setStatus(message, true);
      } finally {
        saving = false;
        updateSaveButtonState();
      }
    }

    textarea.addEventListener('input', handleManualInput);
    if (regenerateButton) {
      regenerateButton.addEventListener('click', () => {
        setStatus('Genererer forslag …', false);
        scheduleAuto('manual-regenerate', 0);
      });
    }
    if (saveButton && hasSave) {
      saveButton.addEventListener('click', handleSaveClick);
      updateSaveButtonState();
    }

    const initialSignature = fetchSignature();
    currentSignature = initialSignature;
    savedSignature = initialSignature;
    const initial = normalizeState(getState());
    syncTextarea(initial.text);
    applyToSvg(initial.text);
    normalizeSavedState(initial.text, initial.source);
    if (initial.text) {
      setStatus('', false);
    } else {
      scheduleAuto('init', 0);
    }

    return {
      refresh(reason, signatureOverride) {
        notifyFigureChange(signatureOverride);
        const current = normalizeState(getState());
        syncTextarea(current.text);
        applyToSvg(current.text);
        if (current.source === 'manual' && current.text.trim()) {
          if (!manualStale) {
            setStatus('', false);
          }
          updateSaveButtonState();
          return;
        }
        setStatus('Oppdaterer alternativ tekst …', false);
        scheduleAuto(reason || 'auto');
        updateSaveButtonState();
      },
      applyCurrent() {
        const current = normalizeState(getState());
        syncTextarea(current.text);
        applyToSvg(current.text);
        updateSaveButtonState();
      },
      notifyFigureChange(signatureOverride) {
        return notifyFigureChange(signatureOverride);
      },
      markSaved(state) {
        const normalized = normalizeState(state);
        normalizeSavedState(normalized.text, normalized.source);
      },
      ensureDom() {
        return els.wrap;
      }
    };
  }

  global.MathVisAltText = {
    create: createAltTextManager,
    ensureSvgA11yNodes
  };
})(typeof window !== 'undefined' ? window : this);
