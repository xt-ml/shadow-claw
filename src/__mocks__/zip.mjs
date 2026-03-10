export class BlobReader {
  constructor(file) {
    this.file = file;
  }
}

export class BlobWriter {
  constructor() {
    this._data = new Blob([]);
  }

  async getData() {
    return this._data;
  }
}

export class ZipWriter {
  constructor(blobWriter) {
    this.blobWriter = blobWriter;
  }

  async add() {}

  async close() {}
}

export class ZipReader {
  constructor(blobReader) {
    this.blobReader = blobReader;
  }

  async getEntries() {
    return [];
  }

  async close() {}
}
