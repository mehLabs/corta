const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { text } = require('./texts.cjs');

function runFFmpeg(binary, args, { signal } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['-hide_banner', '-nostdin', '-loglevel', 'error', ...args],
      { windowsHide: true, signal, stdio: ['ignore', 'ignore', 'pipe'] });
    let error = '', processError;
    child.stderr.on('data', chunk => { error = (error + chunk.toString()).slice(-6000); });
    child.on('error', value => { processError = value; });
    child.on('close', code => processError ? reject(processError) : code === 0 ? resolve() : reject(new Error(error.trim() || text('errorProcessing'))));
  });
}

async function inspectWave(file, bins = 2400) {
  const handle = await fs.open(file, 'r');
  let dataStart, dataSize, channels, sampleRate, blockAlign;
  try {
    const head = Buffer.alloc(12);
    await handle.read(head, 0, 12, 0);
    if (head.toString('ascii', 0, 4) !== 'RIFF' || head.toString('ascii', 8, 12) !== 'WAVE') throw new Error(text('errorInvalidPreview'));
    const size = (await handle.stat()).size;
    let position = 12;
    while (position + 8 <= size) {
      const chunk = Buffer.alloc(8);
      await handle.read(chunk, 0, 8, position);
      const tag = chunk.toString('ascii', 0, 4);
      const length = chunk.readUInt32LE(4);
      if (tag === 'fmt ') {
        if (length < 16) throw new Error(text('errorWaveHeader'));
        const format = Buffer.alloc(16);
        await handle.read(format, 0, 16, position + 8);
        if (format.readUInt16LE(0) !== 1 || format.readUInt16LE(14) !== 16) throw new Error(text('errorPCM'));
        channels = format.readUInt16LE(2);
        sampleRate = format.readUInt32LE(4);
        blockAlign = format.readUInt16LE(12);
      }
      if (tag === 'data') { dataStart = position + 8; dataSize = Math.min(length, size - dataStart); break; }
      position += 8 + length + (length % 2);
    }
  } finally { await handle.close(); }
  if (!dataSize || !channels || !sampleRate || blockAlign !== channels * 2) throw new Error(text('errorNoAudio'));
  const frames = Math.floor(dataSize / blockAlign);
  const count = Math.min(bins, frames);
  const peaks = new Float32Array(count);
  let frame = 0, remainder = Buffer.alloc(0);
  for await (const chunk of createReadStream(file, { start: dataStart, end: dataStart + dataSize - 1 })) {
    const buffer = remainder.length ? Buffer.concat([remainder, chunk]) : chunk;
    const end = buffer.length - (buffer.length % blockAlign);
    for (let i = 0; i < end; i += blockAlign, frame++) {
      let peak = 0;
      for (let channel = 0; channel < channels; channel++) peak = Math.max(peak, Math.abs(buffer.readInt16LE(i + channel * 2)) / 32768);
      const bin = Math.min(count - 1, Math.floor(frame * count / frames));
      peaks[bin] = Math.max(peaks[bin], peak);
    }
    remainder = buffer.subarray(end);
  }
  return { duration: frames / sampleRate, sampleRate, channels, peaks: Array.from(peaks) };
}

async function prepareAudio(binary, source, directory, options = {}) {
  const id = randomUUID();
  const previewPath = path.join(directory, `${id}.wav`);
  try {
    await runFFmpeg(binary, ['-y', '-i', source, '-map', '0:a:0', '-vn', '-ac', '2', '-ar', '44100', '-c:a', 'pcm_s16le', '-rf64', 'never', previewPath], options);
    const info = await inspectWave(previewPath);
    return { id, previewPath, source, name: path.basename(source), ...info };
  } catch (error) {
    await fs.rm(previewPath, { force: true }).catch(() => {});
    throw error;
  }
}

const encoders = {
  '.mp3': ['-c:a', 'libmp3lame', '-q:a', '2'],
  '.wav': ['-c:a', 'pcm_s16le'],
  '.flac': ['-c:a', 'flac'],
  '.m4a': ['-c:a', 'aac', '-b:a', '192k'],
  '.ogg': ['-c:a', 'libvorbis', '-q:a', '5'],
  '.opus': ['-c:a', 'libopus', '-b:a', '160k']
};

function validateRange(start, end, duration) {
  if (![start, end, duration].every(Number.isFinite) || start < 0 || end > duration + 0.001 || end - start < 0.01) throw new Error(text('errorRange'));
}

async function exportAudio(binary, audio, destination, start, end, options = {}) {
  validateRange(start, end, audio.duration);
  const extension = path.extname(destination).toLowerCase();
  if (!encoders[extension]) throw new Error(text('errorExtension'));
  const temporary = path.join(path.dirname(destination), `.corta-${randomUUID()}${extension}`);
  let snapshot;
  try {
    let source = audio.renderSource || audio.source;
    const replacesOriginal = path.resolve(audio.source).toLowerCase() === path.resolve(destination).toLowerCase();
    if (replacesOriginal && !audio.renderSource) {
      snapshot = path.join(path.dirname(audio.previewPath), `original-${randomUUID()}${path.extname(audio.source)}`);
      await fs.copyFile(audio.source, snapshot);
      source = snapshot;
    }
    await runFFmpeg(binary, ['-y', '-ss', String(start), '-i', source, '-t', String(end - start), '-map', '0:a:0', '-vn', '-map_metadata', '-1', ...encoders[extension], temporary], options);
    await fs.rename(temporary, destination);
    if (snapshot) { audio.renderSource = snapshot; snapshot = null; }
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
    if (snapshot) await fs.rm(snapshot, { force: true }).catch(() => {});
  }
  return destination;
}

module.exports = { runFFmpeg, inspectWave, prepareAudio, exportAudio, validateRange };
