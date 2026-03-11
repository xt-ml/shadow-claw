export default class Quill {
  constructor(container, options) {
    this.container = container;
    this.options = options;
    this.content = "";
  }

  getText() {
    return this.content;
  }

  setText(text) {
    this.content = text;
  }
}
