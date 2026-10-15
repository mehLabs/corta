const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');
const manifest = require('../third_party/ffmpeg.json');
const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'vendor', 'ffmpeg');

async function checksum(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of require('node:fs').createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function download(url, file) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(file));
}
(async () => {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('The pinned FFmpeg package targets Windows x64.');
  await fs.mkdir(destination, { recursive: true });
  const executable = path.join(destination, 'ffmpeg.exe');
  if (await fs.stat(executable).catch(() => null)) {
    if (await checksum(executable) === manifest.binarySha256) { console.log('FFmpeg already installed and verified.'); return; }
    throw new Error('Existing FFmpeg differs from the pinned binary. Move it aside before running setup again.');
  }
  const downloadDirectory = path.join(root, '.build', 'downloads');
  await fs.mkdir(downloadDirectory, { recursive: true });
  const archive = path.join(downloadDirectory, manifest.archiveName);
  console.log('Downloading the pinned FFmpeg build…');
  await download(manifest.url, archive);
  if (await checksum(archive) !== manifest.archiveSha256) throw new Error('FFmpeg archive checksum mismatch.');
  const extracted = await fs.mkdtemp(path.join(downloadDirectory, 'ffmpeg-'));
  try {
    execFileSync('tar.exe', ['-xf', archive, '-C', extracted], { windowsHide: true });
    const directory = path.join(extracted, manifest.directory);
    const binary = path.join(directory, 'bin', 'ffmpeg.exe');
    if (await checksum(binary) !== manifest.binarySha256) throw new Error('FFmpeg executable checksum mismatch.');
    await fs.copyFile(binary, executable);
    await fs.copyFile(path.join(directory, 'LICENSE'), path.join(destination, 'LICENSE'));
    await fs.copyFile(path.join(directory, 'README.txt'), path.join(destination, 'README.txt'));
  } finally {
    if (!extracted.startsWith(downloadDirectory + path.sep)) throw new Error('Unsafe temporary directory.');
    await fs.rm(extracted, { recursive: true, force: true });
  }
  console.log('FFmpeg installed and SHA-256 verified.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
