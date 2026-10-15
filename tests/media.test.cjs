const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { runFFmpeg, prepareAudio, inspectWave, exportAudio, validateRange } = require('../src/media.cjs');
const { binary, artifacts } = require('./helpers.cjs');
let directory, source, audio;
before(async () => {
  directory = await fs.mkdtemp(path.join(artifacts, 'corta-test-'));
  source = path.join(directory, 'señal original con espacios.wav');
  await runFFmpeg(binary, ['-f', 'lavfi', '-i', "aevalsrc='if(lt(t,1),0,0.5*sin(2*PI*440*t))':s=44100:d=3", '-c:a', 'pcm_s16le', source]);
  audio = await prepareAudio(binary, source, directory);
});
after(async () => { if (directory) await fs.rm(directory, { recursive: true, force: true }); });
test('decodes stereo preview, duration and waveform including silent intro', () => {
  assert.ok(Math.abs(audio.duration - 3) < .001);
  assert.equal(audio.channels, 2);
  assert.equal(audio.peaks.length, 2400);
  assert.ok(audio.peaks.slice(0, 700).every(value => value === 0));
  assert.ok(audio.peaks.slice(1000).every(value => value > .3 && value <= 1));
});
test('WAV cut starts at the selected sound and ends at exact frame duration', async () => {
  const destination = path.join(directory, 'mi recorte.wav');
  await exportAudio(binary, audio, destination, 1.25, 2.5);
  const wave = await inspectWave(destination);
  assert.ok(Math.abs(wave.duration - 1.25) <= 1 / 44100);
  assert.ok(wave.peaks.slice(0, 10).every(value => value > .3));
  assert.ok(Math.abs((await inspectWave(source)).duration - 3) < .001);
  await exportAudio(binary, audio, destination, 1, 2.5);
  assert.ok(Math.abs((await inspectWave(destination)).duration - 1.5) < .001, 'An existing output can be replaced');
});
test('all six export encoders produce decodable audio', async () => {
  for (const extension of ['mp3', 'flac', 'm4a', 'ogg', 'opus', 'wav']) {
    const destination = path.join(directory, `resultado.${extension}`);
    await exportAudio(binary, audio, destination, 1.1, 2.1);
    const result = await prepareAudio(binary, destination, directory);
    assert.ok(Math.abs(result.duration - 1) < .08, `${extension} duration: ${result.duration}`);
    assert.ok(result.peaks.some(peak => peak > .3));
  }
});
test('refuses invalid ranges and unsupported output', async () => {
  for (const range of [[-1, 2], [1, 1], [0, 4], [NaN, 2], [0, Infinity]]) assert.throws(() => validateRange(...range, 3));
  const original = await fs.readFile(source);
  await assert.rejects(exportAudio(binary, audio, path.join(directory, 'bad.txt'), 0, 1), /extensión/);
  assert.deepEqual(await fs.readFile(source), original);
});
test('bad input and canceled operations clean their temporary output', async () => {
  const invalid = path.join(directory, 'invalid.mp3');
  await fs.writeFile(invalid, 'not audio');
  await assert.rejects(prepareAudio(binary, invalid, directory));
  const abort = new AbortController(); abort.abort();
  await assert.rejects(exportAudio(binary, audio, path.join(directory, 'abort.wav'), 0, 1, { signal: abort.signal }));
  assert.ok(!(await fs.readdir(directory)).some(name => name.startsWith('.corta-')));
});

test('can replace the original repeatedly using the loaded audio as reference', async () => {
  const original = path.join(directory, 'replace original.wav');
  await fs.copyFile(source, original);
  const loaded = await prepareAudio(binary, original, directory);
  await exportAudio(binary, loaded, original, .5, 2.5);
  assert.ok(Math.abs((await inspectWave(original)).duration - 2) < .001);
  assert.ok(loaded.renderSource, 'A working copy preserves the loaded source');
  await exportAudio(binary, loaded, original, 1.25, 2.25);
  const second = await inspectWave(original);
  assert.ok(Math.abs(second.duration - 1) < .001);
  assert.ok(second.peaks.every(peak => peak > .05));
  assert.ok(second.peaks.some(peak => peak > .3));
  assert.equal(loaded.duration, 3, 'The editing timeline stays unchanged');
});
