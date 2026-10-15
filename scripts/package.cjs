const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { packager } = require('@electron/packager');
const metadata = require('../package.json');
const root = path.resolve(__dirname, '..');

async function removeGenerated(directory) {
  if (!directory.startsWith(root + path.sep) || !['.build', 'dist'].includes(path.relative(root, directory).split(path.sep)[0])) throw new Error('Unsafe generated directory.');
  await fs.rm(directory, { recursive: true, force: true });
}
(async () => {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Packaging currently requires Windows x64.');
  const ffmpeg = path.join(root, 'vendor', 'ffmpeg');
  await fs.access(path.join(ffmpeg, 'ffmpeg.exe'));
  const stage = path.join(root, '.build', 'app');
  await removeGenerated(stage);
  await fs.mkdir(stage, { recursive: true });
  await fs.cp(path.join(root, 'src'), stage, { recursive: true });
  await fs.mkdir(path.join(stage, 'bin'), { recursive: true });
  await fs.copyFile(path.join(ffmpeg, 'ffmpeg.exe'), path.join(stage, 'bin', 'ffmpeg.exe'));
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: metadata.name, productName: metadata.productName, version: metadata.version, main: 'main.cjs', license: metadata.license }, null, 2));
  const [built] = await packager({ dir: stage, out: path.join(root, 'dist', '.packaged'), name: 'Corta', platform: 'win32', arch: 'x64',
    electronVersion: metadata.devDependencies.electron, icon: path.join(root, 'src', 'icon.ico'), overwrite: true, asar: false, prune: false,
    appVersion: metadata.version, win32metadata: { CompanyName: 'mehLabs', FileDescription: 'Corta - Audio trimmer', ProductName: 'Corta', OriginalFilename: 'Corta.exe' },
    appCopyright: 'Copyright 2026 mehLabs. Apache-2.0.' });
  const portable = path.join(root, 'dist', 'Corta');
  await removeGenerated(portable);
  await fs.rename(built, portable);
  await fs.copyFile(path.join(root, 'src', 'textos.json'), path.join(portable, 'textos.json'));
  await fs.rm(path.join(portable, 'resources', 'app', 'textos.json'));
  const licenses = path.join(portable, 'licenses');
  await fs.mkdir(licenses, { recursive: true });
  await fs.copyFile(path.join(root, 'LICENSE'), path.join(licenses, 'Corta-Apache-2.0.txt'));
  await fs.copyFile(path.join(ffmpeg, 'LICENSE'), path.join(licenses, 'FFmpeg-GPL-v3.txt'));
  await fs.copyFile(path.join(ffmpeg, 'README.txt'), path.join(licenses, 'FFmpeg-build-and-source.txt'));
  await fs.copyFile(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(licenses, 'THIRD_PARTY_NOTICES.md'));
  await fs.copyFile(path.join(root, 'docs', 'PORTABLE.txt'), path.join(portable, 'README.txt'));
  const zip = path.join(root, 'dist', `Corta-${metadata.version}-windows-x64.zip`);
  await fs.rm(zip, { force: true });
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'zip.ps1'), '-Source', portable, '-Destination', zip], { windowsHide: true, stdio: 'inherit' });
  console.log(`Portable release: ${zip}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
