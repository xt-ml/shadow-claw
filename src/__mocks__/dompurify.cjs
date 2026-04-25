exports.sanitize = (val) => {
  if (typeof val !== 'string') {
    return val;
  }

  return val.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
};
module.exports = exports;
