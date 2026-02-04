/**
 * Creates a minimal event bus for communication between Math Visuals apps
 * and their hosts.
 *
 * @returns {{ emit: (type: string, payload?: any) => void, on: (type: string, handler: (payload: any) => void) => () => void }}
 */
export function createEventBus() {
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
