const IDENTIFIER_PATTERN = /^[a-z0-9\-]+$/i;

/**
 * Validates the identifier and throws an informative error if invalid.
 *
 * @param {string} id
 */
export function assertValidIdentifier(id) {
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
export function assertFunction(value, name) {
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
export function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      // @ts-ignore - index signature not guaranteed
      deepFreeze(value[key]);
    }
  }
  return value;
}
