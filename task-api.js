(function attachMathVisualsTaskApi(global) {
  if (!global) return;

  const adapters = new Map();

  const normalizeAppId = appId => {
    if (typeof appId !== 'string') return '';
    return appId.trim();
  };

  /**
   * Task adapter contract:
   * - renderPreview(example): Optional hook for rendering example previews.
   * - collectInputs(): Optional hook for collecting/evaluating task inputs.
   * - evaluateAnswers(): Optional hook for answer evaluation.
   * - resetAnswers(): Optional hook for resetting task answers.
   */
  const registerTaskAdapter = (appId, adapter) => {
    const normalized = normalizeAppId(appId);
    if (!normalized) return null;
    if (!adapter || typeof adapter !== 'object') return null;
    adapters.set(normalized, adapter);
    return adapter;
  };

  const getTaskAdapter = appId => {
    const normalized = normalizeAppId(appId);
    if (!normalized) return null;
    return adapters.get(normalized) || null;
  };

  const evaluateTask = (appId, example) => {
    const adapter = getTaskAdapter(appId);
    if (!adapter) return null;
    if (typeof adapter.renderPreview === 'function') {
      adapter.renderPreview(example);
    }
    if (typeof adapter.collectInputs === 'function') {
      adapter.collectInputs(example);
    }
    if (typeof adapter.evaluateAnswers === 'function') {
      return adapter.evaluateAnswers(example);
    }
    return null;
  };

  const resetTask = appId => {
    const adapter = getTaskAdapter(appId);
    if (!adapter) return;
    if (typeof adapter.resetAnswers === 'function') {
      adapter.resetAnswers();
    }
  };

  const getDescriptionPreviewElement = () => {
    if (typeof document === 'undefined') return null;
    return document.querySelector('.example-description-preview');
  };

  const evaluateDescriptionInputs = () => {
    const preview = getDescriptionPreviewElement();
    if (!preview) return null;
    if (typeof window === 'undefined') return null;
    const renderer = window.MathVisDescriptionRenderer;
    if (!renderer || typeof renderer.evaluateInputs !== 'function') return null;
    try {
      return renderer.evaluateInputs(preview);
    } catch (_) {
      return null;
    }
  };

  const resetDescriptionInputs = () => {
    const preview = getDescriptionPreviewElement();
    if (!preview) return;
    if (typeof window === 'undefined') return;
    const renderer = window.MathVisDescriptionRenderer;
    if (!renderer || typeof renderer.resetInputs !== 'function') return;
    try {
      renderer.resetInputs(preview);
    } catch (_) {}
  };

  global.MathVisualsTaskApi = {
    registerTaskAdapter,
    getTaskAdapter,
    evaluateTask,
    resetTask,
    evaluateDescriptionInputs,
    resetDescriptionInputs
  };
})(typeof window !== 'undefined' ? window : undefined);
