const { app, BrowserWindow, ipcMain, dialog, protocol, net, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
process.env.CORTA_TEXTS_FILE ||= path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname, 'textos.json');
const { getCatalog, setLanguage, text } = require('./texts.cjs');
const { prepareAudio, exportAudio } = require('./media.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'corta-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
app.setName(text('appName'));
app.setAppUserModelId('local.corta.audio');
const binary = process.env.CORTA_FFMPEG || (app.isPackaged ? path.join(__dirname, 'bin', 'ffmpeg.exe') : path.join(__dirname, '..', 'vendor', 'ffmpeg', 'ffmpeg.exe'));
const pageURL = pathToFileURL(path.join(__dirname, 'index.html')).href;
let win, directory, current, loading = false, saving = false;
const controller = new AbortController();
const operations = new Set();
let quitting = false;
let pendingPath = process.argv.slice(app.isPackaged ? 1 : 2).find(arg => !arg.startsWith('-'));
const locked = app.requestSingleInstanceLock();
if (!locked) app.quit();

function message(error) { return error.name === 'AbortError' ? text('errorCanceled') : error.message; }
function publicAudio(audio) {
  return { id: audio.id, name: audio.name, duration: audio.duration, peaks: audio.peaks,
    url: `corta-media://preview/${audio.id}`, extension: path.extname(audio.source).slice(1).toUpperCase() };
}
async function load(file) {
  if (loading || saving) return { error: text('errorBusy') };
  if (typeof file !== 'string' || !(await fs.stat(file).catch(() => null))?.isFile()) return { error: text('errorSelectFile') };
  loading = true;
  try {
    const next = await prepareAudio(binary, file, directory, { signal: controller.signal });
    const previous = current;
    current = next;
    if (previous) {
      fs.rm(previous.previewPath, { force: true }).catch(() => {});
      if (previous.renderSource) fs.rm(previous.renderSource, { force: true }).catch(() => {});
    }
    return { audio: publicAudio(next) };
  } catch (error) { return { error: message(error) }; }
  finally { loading = false; }
}

app.on('second-instance', (_event, argv) => {
  const file = argv.slice(1).find(arg => !arg.startsWith('-'));
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); if (file) win.webContents.send('audio:external', file); }
});
app.on('open-file', (event, file) => { event.preventDefault(); if (win) win.webContents.send('audio:external', file); else pendingPath = file; });

if (locked) app.whenReady().then(async () => {
  const preferencesPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    const preferences = JSON.parse(await fs.readFile(preferencesPath, 'utf8'));
    if (['es', 'en'].includes(preferences.language)) setLanguage(preferences.language);
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'corta-'));
  protocol.handle('corta-media', request => {
    const url = new URL(request.url);
    if (url.hostname !== 'preview' || !current || url.pathname !== `/${current.id}`) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(current.previewPath).href, { headers: request.headers });
  });
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({ width: 940, height: 620, minWidth: 720, minHeight: 480,
    title: text('windowTitle'), backgroundColor: '#f7f7f2', show: false, icon: path.join(__dirname, 'icon.png'),
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#f7f7f2', symbolColor: '#272b28', height: 46 },
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false }
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const handle = (channel, callback) => ipcMain.handle(channel, (event, ...args) => {
    if (event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== pageURL) throw new Error(text('errorOrigin'));
    const operation = Promise.resolve().then(() => callback(...args));
    operations.add(operation);
    return operation.finally(() => operations.delete(operation));
  });
  handle('texts:get', () => getCatalog());
  handle('texts:set-language', async language => {
    if (loading || saving) return getCatalog();
    if (!['es', 'en'].includes(language)) throw new Error('Invalid language');
    await fs.mkdir(path.dirname(preferencesPath), { recursive: true });
    await fs.writeFile(preferencesPath, JSON.stringify({ language }), 'utf8');
    const catalog = setLanguage(language);
    win.setTitle(text('windowTitle'));
    return catalog;
  });
  handle('audio:initial', async () => { const file = pendingPath; pendingPath = null; return file ? load(file) : null; });
  handle('audio:open', async () => {
    if (loading || saving) return null;
    const result = await dialog.showOpenDialog(win, { title: text('open'), properties: ['openFile'], filters: [
      { name: text('dialogAudioFilter'), extensions: ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'wma', 'aiff', 'aif', 'mp4', 'webm'] },
      { name: text('dialogAllFilesFilter'), extensions: ['*'] }
    ] });
    return result.canceled ? null : load(result.filePaths[0]);
  });
  handle('audio:drop', file => load(file));
  handle('audio:save', async (id, start, end) => {
    if (!current || current.id !== id || loading || saving) return { error: text('errorOpenFirst') };
    saving = true;
    try {
      const supported = ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'opus'];
      const sourceExtension = path.extname(current.source).slice(1).toLowerCase();
      const extension = supported.includes(sourceExtension) ? sourceExtension : 'mp3';
      const formats = [extension, ...supported.filter(item => item !== extension)];
      const result = await dialog.showSaveDialog(win, { title: text('save'),
        defaultPath: path.join(path.dirname(current.source), `${path.parse(current.name).name}${text('outputSuffix')}.${extension}`),
        filters: formats.map(item => ({ name: text(`format${item.toUpperCase()}`), extensions: [item] })) });
      if (result.canceled) return null;
      const destination = await exportAudio(binary, current, result.filePath, start, end, { signal: controller.signal });
      return { name: path.basename(destination) };
    } catch (error) { return { error: message(error) }; }
    finally { saving = false; }
  });
  await win.loadFile(path.join(__dirname, 'index.html'));
}).catch(error => { dialog.showErrorBox(text('appName'), message(error)); app.quit(); });

app.on('window-all-closed', () => app.quit());
app.on('before-quit', event => {
  if (quitting) return;
  event.preventDefault(); quitting = true; controller.abort();
  Promise.allSettled([...operations])
    .then(() => directory && fs.rm(directory, { recursive: true, force: true, maxRetries: 3 }))
    .catch(() => {})
    .finally(() => app.exit(0));
});
