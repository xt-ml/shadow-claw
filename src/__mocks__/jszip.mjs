export default class JSZip {
  folder() {
    return this;
  }

  file() {
    return this;
  }

  async generateAsync() {
    return new Blob([]);
  }
}
