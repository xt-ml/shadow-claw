// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import/with

// Declares what a CSS Module import returns
declare module "*.css" {
  const content: CSSStyleSheet;
  export default content;
}

// Declares what an HTML Module import returns
declare module "*.html" {
  const content: HTMLElement[];
  export default content;
}
