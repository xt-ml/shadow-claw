const hljs = {
  getLanguage() {
    return false;
  },
  highlight(text) {
    return { value: text };
  },
};

export default hljs;
