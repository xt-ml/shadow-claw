const DOMPurify = {
  sanitize(html) {
    return String(html).replace(/<script[\s\S]*?<\/script>/gi, "");
  },
};

export default DOMPurify;
