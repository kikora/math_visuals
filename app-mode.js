(function attachMathVisualsAppMode(global) {
  if (!global) return;
  if (global.MathVisualsAppMode) return;

  const bindToCore = () => {
    const core = global.MathVisualsTaskCore;
    if (!core) return false;
    if (typeof core.normalizeAppMode !== 'function') return false;
    global.MathVisualsAppMode = {
      normalizeMode: core.normalizeAppMode,
      setAppMode: core.setAppMode,
      onModeChanged: core.onModeChange
    };
    return true;
  };

  if (bindToCore()) return;
  if (typeof document === 'undefined') return;

  if (global.__MATH_VISUALS_TASK_CORE_LOADING__) return;
  global.__MATH_VISUALS_TASK_CORE_LOADING__ = true;

  let scriptUrl = 'task-core.js';
  const currentScript = document.currentScript;
  if (currentScript && currentScript.src) {
    try {
      scriptUrl = new URL('task-core.js', currentScript.src).toString();
    } catch (_) {}
  }

  const script = document.createElement('script');
  script.async = false;
  script.src = scriptUrl;
  script.addEventListener(
    'load',
    () => {
      bindToCore();
    },
    { once: true }
  );
  script.addEventListener(
    'error',
    () => {
      global.__MATH_VISUALS_TASK_CORE_LOADING__ = false;
    },
    { once: true }
  );
  document.head.appendChild(script);
})(typeof window !== 'undefined' ? window : undefined);
