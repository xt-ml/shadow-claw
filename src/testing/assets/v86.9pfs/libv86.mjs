export class V86 {
  constructor(options) {
    this.options = options;
    this.listeners = new Map();
    this.serial0_send = (text) => {
      if (text === "root\n") {
        setTimeout(() => {
          this.emitSerial("# ");
        }, 5);
      } else if (text && text.includes("sleep")) {
        // Do not auto-respond to sleep commands to test timeout recovery
        return;
      } else if (text && text.includes("__BCDONE_")) {
        const match = /printf "\\n(__BCDONE_[^%]+)%s\\n"/.exec(text);
        if (match) {
          setTimeout(() => {
            this.emitSerial(`\n${match[1]}0\n`);
          }, 5);
        }
      } else if (text && text.includes("\u0003")) {
        setTimeout(() => {
          this.emitSerial("# ");
        }, 5);
      }
    };
    this.destroy = () => Promise.resolve();
    this.fs9p = {
      read_dir: () => [],
      SearchPath: (path) => ({ id: path === "/home/user" ? 1 : -1 }),
      IsDirectory: () => true,
    };
    this.create_file = () => Promise.resolve();
    this.read_file = () => Promise.resolve(new Uint8Array([1, 2, 3]));

    // Auto-emit boot sequence
    setTimeout(() => {
      this.emitSerial("Booting Linux on ttyS0\nlogin: ");
    }, 5);
  }

  add_listener(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(listener);
  }

  remove_listener(event, listener) {
    this.listeners.get(event)?.delete(listener);
  }

  emitSerial(text) {
    const serialListeners = this.listeners.get("serial0-output-byte");
    if (!serialListeners) return;
    for (const ch of text) {
      for (const listener of serialListeners) {
        listener(ch.charCodeAt(0));
      }
    }
  }
}

export default V86;
