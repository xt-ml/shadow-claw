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
  async chmod() {}
  async cp() {}
  async createExclusive() {}
  async exists() {
    return false;
  }
  getAllPaths() {
    return [];
  }
  async link() {}
  async lstat() {
    return { isDirectory: () => false };
  }
  async mkdir() {}
  mkdirSync() {}
  async mv() {}
  async readdir() {
    return [];
  }
  async readdirWithFileTypes() {
    return [];
  }
  async readFile() {
    return "";
  }
  async readFileBuffer() {
    return new Uint8Array();
  }
  async readFileBytes() {
    return "";
  }
  async readlink() {
    return "";
  }
  async realpath(path) {
    return path;
  }
  resolvePath(base, path) {
    return path.startsWith("/") ? path : `${base}/${path}`;
  }
  async rm() {}
  async stat() {
    return { isDirectory: () => false };
  }
  async symlink() {}
  async utimes() {}
  async writeFile() {}
  writeFileLazy() {}
  writeFileSync() {}
}

exports.Bash = Bash;
exports.InMemoryFs = InMemoryFs;
