const fs = require('node:fs');
const path = require('node:path');
const formatText = require('./format-text.js');

const configPath = process.env.CORTA_TEXTS_FILE || path.join(__dirname, 'textos.json');
const configuration = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let language = configuration.defaultLanguage;
function setLanguage(value) {
  if (!['es', 'en'].includes(value) || !configuration.locales[value]) throw new Error('Invalid language');
  language = value;
  return getCatalog();
}
const getCatalog = () => configuration.locales[language];
const getLanguage = () => language;
const text = (key, parameters) => formatText(getCatalog(), key, parameters);
setLanguage(language);
module.exports = { getCatalog, getLanguage, setLanguage, text };
