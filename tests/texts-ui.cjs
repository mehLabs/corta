const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { inspectWave } = require('../src/media.cjs');

(async () => {
  const { root, artifacts, binary, executable, portable } = require('./helpers.cjs');
  const configFile = path.join(portable, 'textos.json');
  const original = await fs.readFile(configFile, 'utf8');
  const configuration = JSON.parse(original);
  assert.deepEqual(Object.keys(configuration.locales.es).sort(), Object.keys(configuration.locales.en).sort());
  for (const locale of Object.values(configuration.locales)) {
    for (const removed of ['privacyBadge', 'footer', 'originalNote', 'headline', 'tagline', 'errorOriginal']) assert.equal(Object.hasOwn(locale, removed), false);
  }
  const custom = configuration.locales.es;
  Object.assign(custom, {
    windowTitle: 'Custom audio tool', open: 'Open sound', play: 'Preview selection',
    pause: 'Pause preview', save: 'Export selection', savingButton: 'Exporting…',
    statusSaving: 'Writing selected sound…', startHandleLabel: 'Selection start',
    dialogAudioFilter: 'Sound files', errorSelectFile: 'Please choose an existing sound.',
    numberLocale: 'en-US', seconds: '{value} seconds'
  });
  const profile = await fs.mkdtemp(path.join(artifacts, 'profile-language-'));
  const args = [`--user-data-dir=${profile}`];
  let app;
  try {
    await fs.writeFile(configFile, JSON.stringify(configuration, null, 2), 'utf8');
    app = await electron.launch({ executablePath: executable, args, timeout: 30000 });
    let page = await app.firstWindow();
    await page.waitForFunction(() => document.title === 'Custom audio tool' && !document.getElementById('open').disabled);
    assert.equal(await page.textContent('#play-label'), custom.play);
    assert.equal(await page.getAttribute('#handle-start', 'aria-label'), custom.startHandleLabel);
    await app.evaluate(({ dialog }) => { dialog.showOpenDialog = async (_win, options) => { globalThis.openOptions = options; return { canceled: true }; }; });
    await page.click('#open');
    await page.waitForFunction(() => !document.getElementById('open').disabled);
    assert.equal((await app.evaluate(() => globalThis.openOptions)).title, custom.open);
    assert.equal((await app.evaluate(() => globalThis.openOptions)).filters[0].name, custom.dialogAudioFilter);
    const sample = path.join(artifacts, 'prueba de audio.wav');
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, sample);
    await page.click('#open');
    await page.waitForFunction(() => !document.getElementById('play').disabled);
    assert.equal(await page.textContent('#duration'), '12.00 seconds');
    await page.locator('#start-time').fill('0:03.000'); await page.locator('#start-time').press('Enter');
    await page.locator('#end-time').fill('0:10.000'); await page.locator('#end-time').press('Enter');
    await page.click('#play');
    await page.waitForFunction(() => !document.getElementById('audio').paused);
    await page.click('#language-switch');
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await page.inputValue('#start-time'), '0:03.000');
    assert.equal(await page.inputValue('#end-time'), '0:10.000');
    assert.equal(await page.textContent('#play-label'), 'Pause');
    assert.equal(await page.evaluate(() => document.getElementById('audio').paused), false);
    assert.equal(await page.getAttribute('#language-switch', 'aria-checked'), 'true');
    assert.equal(await page.getAttribute('#handle-end', 'aria-label'), 'Selection end');
    await page.click('#play');
    const error = await page.evaluate(() => window.corta.loadPath('C:/nonexistent-corta-test.wav'));
    assert.equal(error.error, 'Choose an audio file.');
    await app.evaluate(({ dialog }) => { dialog.showSaveDialog = (_win, options) => { globalThis.saveOptions = options; return new Promise(resolve => { globalThis.cancelSave = () => resolve({ canceled: true }); }); }; });
    await page.click('#save');
    assert.equal(await page.textContent('#save-label'), 'Saving…');
    assert.equal((await app.evaluate(() => globalThis.saveOptions)).title, 'Save');
    assert.ok((await app.evaluate(() => globalThis.saveOptions)).defaultPath.endsWith(' - trimmed.wav'));
    assert.equal(await page.isDisabled('#language-switch'), true);
    await app.evaluate(() => globalThis.cancelSave());
    await page.waitForFunction(() => !document.getElementById('save').disabled);
    // Overwrite a real original, then overwrite it again using the same loaded timeline.
    const replace = path.join(artifacts, 'original a reemplazar.wav');
    await fs.copyFile(sample, replace);
    await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); dialog.showSaveDialog = async () => ({ canceled: false, filePath: file }); }, replace);
    await page.click('#open');
    await page.waitForFunction(() => document.getElementById('filename').textContent === 'original a reemplazar.wav' && !document.getElementById('save').disabled);
    for (const [from, to] of [['0:01.000', '0:03.000'], ['0:02.000', '0:04.000']]) {
      await page.locator('#start-time').fill(from); await page.locator('#start-time').press('Enter');
      await page.locator('#end-time').fill(to); await page.locator('#end-time').press('Enter');
      await page.click('#save');
      await page.waitForFunction(() => document.getElementById('status').textContent.startsWith('Saved:') && !document.getElementById('save').disabled);
      assert.ok(Math.abs((await inspectWave(replace)).duration - 2) < .001);
    }
    await page.screenshot({ path: path.join(artifacts, 'english.png') });
    await app.close(); app = null;
    app = await electron.launch({ executablePath: executable, args, timeout: 30000 });
    page = await app.firstWindow();
    await page.waitForFunction(() => document.documentElement.lang === 'en');
    assert.equal(await page.getAttribute('#language-switch', 'aria-checked'), 'true');
    await page.locator('#language-switch').focus(); await page.keyboard.press('Space');
    await page.waitForFunction(() => document.documentElement.lang === 'es');
    assert.equal(await page.getAttribute('#language-switch', 'aria-checked'), 'false');
    console.log('PASS: configurable bilingual texts, live switch during playback, selection preservation, native dialogs, persistence, keyboard switch and repeated original replacement.');
  } finally {
    if (app) await app.close();
    await fs.writeFile(configFile, original, 'utf8');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
