(function attachMathVisualsTaskText(global) {
  if (!global) return;
  if (global.MathVisualsTaskText) return;

  const bindToCore = () => {
    if (global.MathVisualsTaskCore && global.MathVisualsTaskCore.taskText) {
      global.MathVisualsTaskText = global.MathVisualsTaskCore.taskText;
      return true;
    }
    return false;
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
