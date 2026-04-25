class BlobReader {
  constructor(file) {
    this.file = file;
  }
}

class BlobWriter {
  constructor() {
    this._data = new Blob([]);
  }

  async getData() {
    return this._data;
  }
}

class ZipWriter {
  constructor(bw) {
    this.bw = bw;
  }

  async add() {}
  async close() {}
}

class ZipReader {
  constructor(br) {
    this.br = br;
  }

  async close() {}
  async getEntries() {
    return [];
  }
}

exports.BlobReader = BlobReader;
exports.BlobWriter = BlobWriter;
exports.ZipWriter = ZipWriter;
exports.ZipReader = ZipReader;
