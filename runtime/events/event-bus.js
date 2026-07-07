class EventBus {
  constructor() {
    this.handlers = {};
  }

  on(event, fn) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(fn);
  }

  emit(event, payload) {
    const list = this.handlers[event] || [];
    for (const fn of list) fn(payload);
  }
}

module.exports = EventBus;
