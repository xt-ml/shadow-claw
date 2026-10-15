/**
 * Simple event emitter for orchestrator events.
 */
export class EventBus {
  listeners: Map<string, Set<Function>>;

  constructor() {
    this.listeners = new Map();
  }

  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach((cb) => cb(data));
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)?.add(callback);
  }
}
