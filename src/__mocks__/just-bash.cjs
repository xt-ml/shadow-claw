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
  async mv() {}
  async rm() {}

  async readFile() {
    return "";
  }

  async stat() {
    return { isDirectory: () => false };
  }

  async writeFile() {}


}

exports.Bash = Bash;
exports.InMemoryFs = InMemoryFs;
