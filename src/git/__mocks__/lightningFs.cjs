module.exports = class LightningFS {
  constructor() {
    this.promises = {
      mkdir: async () => {},
      readdir: async () => [],
      readFile: async () => "",
      writeFile: async () => {},
      unlink: async () => {},
      rmdir: async () => {},
      stat: async () => ({ isDirectory: () => false }),
    };
  }
};
