'use strict';

/**
 * Creates a minimal event bus for communication between Math Visuals apps
 * and their hosts.
 *
 * @returns {{ emit: (type: string, payload?: any) => void, on: (type: string, handler: (payload: any) => void) => () => void }}
 */
function createEventBus() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    emit(type, payload) {
      if (!listeners.has(type)) {
        return;
      }

      for (const handler of listeners.get(type)) {
        try {
          handler(payload);
        } catch (error) {
          setTimeout(() => {
            throw error;
          });
        }
      }
    },
    on(type, handler) {
      if (!listeners.has(type)) {
        listeners.set(type, new Set());
      }

      listeners.get(type).add(handler);

      return () => {
        const handlers = listeners.get(type);
        if (!handlers) return;
        handlers.delete(handler);
        if (handlers.size === 0) {
          listeners.delete(type);
        }
      };
    }
  };
}

const IDENTIFIER_PATTERN = /^[a-z0-9\-]+$/i;

/**
 * Validates the identifier and throws an informative error if invalid.
 *
 * @param {string} id
 */
function assertValidIdentifier(id) {
  if (typeof id !== 'string' || id.trim().length === 0) {
    throw new TypeError('An app id must be a non-empty string.');
  }

  if (!IDENTIFIER_PATTERN.test(id)) {
    throw new TypeError(
      `Invalid app id "${id}". Use only alphanumeric characters or hyphen.`
    );
  }
}

/**
 * Ensures that a value is a function.
 *
 * @param {unknown} value
 * @param {string} name
 */
function assertFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`${name} must be a function.`);
  }
}

/**
 * Creates a deeply frozen clone of the provided object.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      // @ts-ignore - index signature not guaranteed
      deepFreeze(value[key]);
    }
  }
  return value;
}

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
function createAppHost(options = {}) {
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

/**
 * @typedef {Object} MathVisualAppDefinition
 * @property {string} id - Unique identifier for the app.
 * @property {string} title - Human readable title.
 * @property {string} [version] - Semantic version for the app implementation.
 * @property {Record<string, unknown>} [metadata] - Arbitrary metadata describing the app.
 * @property {(context: import('./host.js').AppContext) => import('./host.js').AppLifecycle} create -
 *  Factory that creates lifecycle hooks for an app instance.
 */

/**
 * Defines a Math Visuals application in a type-safe manner, validating the
 * essential contract up front.
 *
 * @param {MathVisualAppDefinition} definition
 */
function defineMathVisualApp(definition) {
  if (!definition || typeof definition !== 'object') {
    throw new TypeError('An app definition must be an object.');
  }

  const { id, title, version = '0.1.0', metadata = {}, create } = definition;

  assertValidIdentifier(id);

  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new TypeError('An app title must be a non-empty string.');
  }

  assertFunction(create, 'definition.create');

  const frozenMetadata = deepFreeze({ ...metadata });

  return Object.freeze({
    id,
    title,
    version,
    metadata: frozenMetadata,
    create(context) {
      const lifecycle = create({
        ...context,
        app: {
          id,
          title,
          version,
          metadata: frozenMetadata
        }
      });

      if (!lifecycle || typeof lifecycle !== 'object') {
        throw new TypeError('App factory must return an object with lifecycle hooks.');
      }

      assertFunction(lifecycle.mount, 'lifecycle.mount');

      if (lifecycle.update && typeof lifecycle.update !== 'function') {
        throw new TypeError('lifecycle.update must be a function when provided.');
      }

      if (lifecycle.unmount && typeof lifecycle.unmount !== 'function') {
        throw new TypeError('lifecycle.unmount must be a function when provided.');
      }

      return lifecycle;
    }
  });
}

exports.createAppHost = createAppHost;
exports.createEventBus = createEventBus;
exports.defineMathVisualApp = defineMathVisualApp;
//# sourceMappingURL=index.cjs.map
