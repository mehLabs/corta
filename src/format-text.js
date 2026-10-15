/* Shared by the main process and the sandboxed renderer. */
(function (root) {
  function formatText(catalog, key, parameters = {}) {
    const value = catalog[key];
    if (typeof value !== 'string') throw new Error(`Invalid or missing text: ${key}`);
    return value.replace(/\{(\w+)\}/g, (placeholder, name) =>
      Object.hasOwn(parameters, name) ? String(parameters[name]) : placeholder);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = formatText;
  else root.formatText = formatText;
})(globalThis);
