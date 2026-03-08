class State {
  constructor(value) {
    this.value = value;
  }

  get() {
    return this.value;
  }

  set(next) {
    this.value = next;
  }
}

class Computed {
  constructor(compute) {
    this.compute = compute;
  }

  get() {
    return this.compute();
  }
}

class Watcher {
  constructor() {}

  watch() {}

  unwatch() {}

  getPending() {
    return [];
  }
}

export const Signal = {
  State,
  Computed,
  subtle: {
    Watcher,
  },
};
