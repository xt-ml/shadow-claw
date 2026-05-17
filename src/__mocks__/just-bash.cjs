class Bash {
  constructor(options) {
    this.options = options;
  }

  async exec() {
    return { stdout: "", stderr: "", exitCode: 0 };
  }
}

class InMemoryFs {
  constructor(files) {
    this.files = files;
  }

  async appendFile() {}
  async cp() {}
  async mkdir() {}
  mkdirSync() {}
  async mv() {}
  async rm() {}

  async readFile() {
    return "";
  }

  async readFileBuffer() {
    return new Uint8Array();
  }

  async stat() {
    return { isDirectory: () => false };
  }

  async writeFile() {}


}

exports.Bash = Bash;
exports.InMemoryFs = InMemoryFs;
