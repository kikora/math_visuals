import { assertFunction, assertValidIdentifier, deepFreeze } from './validation.js';

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
export function defineMathVisualApp(definition) {
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
