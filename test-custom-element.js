const { JSDOM } = require("jsdom");
const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;

class MyElement extends HTMLElement {
  connectedCallback() {
    console.log("CONNECTED!");
  }
}
customElements.define("my-element", MyElement);
console.log("Defined.");
