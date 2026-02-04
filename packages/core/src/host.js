import { createEventBus } from './eventBus.js';
import { assertFunction } from './validation.js';

/**
 * @typedef {Object} AppContext
 * @property {ReturnType<typeof createEventBus>} bus - Shared event bus for the host and app.
 * @property {Record<string, unknown>} [environment] - Optional environment specific data.
 */

/**
 * @typedef {Object} AppLifecycle
 * @property {(target: HTMLElement, payload?: unknown) => void} mount - Called when the app should render itself.
 * @property {(payload: unknown) => void} [update] - Called when the host wants to push new data to the app.
 * @property {() => void} [unmount] - Called before the app is removed from the DOM.
 */

/**
 * @typedef {Object} MountedApp
 * @property {(payload: unknown) => void} update - Pushes new data into the app.
 * @property {() => void} teardown - Removes the app and runs the unmount lifecycle.
 */

/**
 * Creates a host capable of mounting Math Visuals apps inside an HTMLElement.
 *
 * @param {{ onError?: (error: unknown) => void }} [options]
 */
export function createAppHost(options = {}) {
  const { onError } = options;
  const bus = createEventBus();

  /** @type {null | (() => void)} */
  let activeTeardown = null;

  function handleError(error) {
    if (typeof onError === 'function') {
      onError(error);
    } else {
      console.error(error);
    }
  }

  return {
    bus,
    /**
     * @param {{ create: (context: AppContext) => AppLifecycle }} app
     * @param {{ target: HTMLElement, payload?: unknown, environment?: Record<string, unknown> }} options
     * @returns {MountedApp}
     */
    mount(app, { target, payload, environment } = {}) {
      if (!app || typeof app.create !== 'function') {
        throw new TypeError('A valid app with a create(context) method is required.');
      }

      if (!target || typeof target !== 'object') {
        throw new TypeError('A valid target HTMLElement is required for mounting.');
      }

      if (activeTeardown) {
        activeTeardown();
        activeTeardown = null;
      }

      const lifecycle = app.create({
        bus,
        environment: environment || {}
      });

      assertFunction(lifecycle.mount, 'app.lifecycle.mount');

      const update = lifecycle.update
        ? (next) => {
            lifecycle.update(next);
          }
        : () => {
            throw new Error('This app does not implement lifecycle.update');
          };

      activeTeardown = () => {
        if (typeof lifecycle.unmount === 'function') {
          try {
            lifecycle.unmount();
          } catch (error) {
            handleError(error);
          }
        }
        activeTeardown = null;
      };

      try {
        lifecycle.mount(target, payload);
      } catch (error) {
        activeTeardown();
        handleError(error);
        throw error;
      }

      return {
        update,
        teardown() {
          if (activeTeardown) {
            activeTeardown();
          }
        }
      };
    }
  };
}
