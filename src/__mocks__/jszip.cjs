class JSZip {
  constructor() {}

  static async loadAsync(_file) {
    return new JSZip();
  }

  file(_name) {
    return {
      async: async (_type) =>
        JSON.stringify({ messages: [{ id: "1", content: "hello" }] }),
    };
  }

  async generateAsync() {
    return new Blob([]);
  }
}

module.exports = JSZip;
module.exports.default = JSZip;
