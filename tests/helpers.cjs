const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'work', 'test-artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const binary = process.env.CORTA_FFMPEG || path.join(root, 'vendor', 'ffmpeg', 'ffmpeg.exe');
const executable = process.env.CORTA_APP_PATH || path.join(root, 'dist', 'Corta', 'Corta.exe');
module.exports = { root, artifacts, binary, executable, portable: path.dirname(executable) };
