async function initialize() {
let texts = await window.corta.texts();
const t = (key, parameters) => window.formatText(texts, key, parameters);
const $ = id => document.getElementById(id);
const media = $('audio');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');
let audio = null, start = 0, end = 0, cursor = 0, busy = false, playing = false, frame = 0, toastTimer, drag = null;
const MIN = .01;

function applyTexts() {
  document.documentElement.lang = texts.language;
  document.title = t('windowTitle');
  for (const element of document.querySelectorAll('[data-text]')) element.textContent = t(element.dataset.text);
  for (const attribute of ['title', 'aria-label']) {
    for (const element of document.querySelectorAll(`[data-text-${attribute}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(`data-text-${attribute}`)));
    }
  }
  $('language-switch').setAttribute('aria-checked', String(texts.language === 'en'));
  $('play-label').textContent = t(playing ? 'pause' : 'play');
  if (audio) {
    $('filemeta').textContent = t('fileMetadata', { format: audio.extension || t('unknownAudioFormat'), duration: format(audio.duration) });
    update();
  }
}

function format(seconds, milliseconds = true) {
  const total = Math.max(0, Math.round(seconds * 1000));
  const mins = Math.floor(total / 60000);
  const secs = Math.floor(total / 1000) % 60;
  return `${mins}:${String(secs).padStart(2, '0')}${milliseconds ? '.' + String(total % 1000).padStart(3, '0') : ''}`;
}
function parseTime(value) {
  const clean = value.trim().replace(',', '.');
  if (!/^\d+(?::[0-5]?\d){0,2}(?:\.\d{1,3})?$/.test(clean)) return NaN;
  return clean.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}
function notify(text, kind = '', duration = 5000) {
  clearTimeout(toastTimer);
  $('status').textContent = text;
  $('status').className = `status ${kind}`;
  $('status').hidden = !text;
  if (text && duration) toastTimer = setTimeout(() => { $('status').hidden = true; }, duration);
}
function setBusy(value, message, saving = false) {
  busy = value;
  ['open', 'play', 'save', 'reset', 'start-time', 'end-time', 'handle-start', 'handle-end', 'language-switch'].forEach(id => { $(id).disabled = value || (!['open', 'language-switch'].includes(id) && !audio); });
  $('save-label').textContent = value && saving ? t('savingButton') : t('save');
  if (value) notify(message, 'busy', 0);
  else notify('');
}
function draw() {
  const bounds = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * dpr); canvas.height = Math.round(bounds.height * dpr);
  ctx.scale(dpr, dpr);
  const w = bounds.width, h = bounds.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#f0f1eb'; ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) { ctx.beginPath(); ctx.moveTo(w * i / 8, 0); ctx.lineTo(w * i / 8, h); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  const bars = Math.floor(w / 3.6);
  for (let i = 0; i < bars; i++) {
    const ratio = i / bars;
    let peak;
    if (audio) {
      const from = Math.floor(i * audio.peaks.length / bars), to = Math.max(from + 1, Math.floor((i + 1) * audio.peaks.length / bars));
      peak = 0; for (let j = from; j < Math.min(to, audio.peaks.length); j++) peak = Math.max(peak, audio.peaks[j]);
    } else continue;
    const height = Math.max(2, peak * (h - 26));
    ctx.fillStyle = audio ? (ratio * audio.duration >= start && ratio * audio.duration <= end ? '#8063de' : '#d7dbd1') : '#e7e9e1';
    ctx.beginPath(); ctx.roundRect(i * w / bars, (h - height) / 2, 2, height, 1); ctx.fill();
  }
}
function update() {
  if (!audio) return;
  const duration = audio.duration;
  $('selection').style.left = `${100 * start / duration}%`;
  $('selection').style.width = `${100 * (end - start) / duration}%`;
  $('handle-start').style.left = `${100 * start / duration}%`;
  $('handle-end').style.left = `${100 * end / duration}%`;
  $('playhead').style.left = `${100 * cursor / duration}%`;
  $('start-time').value = format(start); $('end-time').value = format(end);
  const selected = end - start;
  $('duration').textContent = selected < 60 ? t('seconds', { value: selected.toLocaleString(texts.numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }) : format(selected);
  for (const [id, val, max] of [['handle-start', start, end - MIN], ['handle-end', end, duration]]) {
    $(id).setAttribute('aria-valuemax', max); $(id).setAttribute('aria-valuenow', val);
    $(id).setAttribute('aria-valuetext', format(val));
  }
  $('handle-end').setAttribute('aria-valuemin', start + MIN);
  draw();
}
function pause() {
  playing = false; media.pause(); cancelAnimationFrame(frame);
  $('play-label').textContent = t('play');
  $('play-icon').innerHTML = '<path d="m9 5 11 7-11 7z"/>';
}
function tick() {
  if (!playing) return;
  cursor = Math.min(end, media.currentTime);
  $('playhead').style.left = `${100 * cursor / audio.duration}%`;
  if (media.currentTime >= end || media.ended) { pause(); cursor = start; media.currentTime = start; update(); return; }
  frame = requestAnimationFrame(tick);
}
async function togglePlay() {
  if (busy || !audio) return;
  if (playing) { cursor = media.currentTime; pause(); return; }
  if (cursor < start || cursor >= end - .005) cursor = start;
  media.currentTime = cursor;
  try {
    await media.play(); playing = true;
    $('play-label').textContent = t('pause');
    $('play-icon').innerHTML = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';
    tick();
  } catch { notify(t('errorPlayback'), 'error'); }
}
async function loadWith(action) {
  if (busy) return;
  pause();
  setBusy(true, t('statusLoading'));
  let result;
  try { result = await action(); }
  catch (error) { result = { error: error.message }; }
  setBusy(false);
  if (!result) return;
  if (result.error) { notify(result.error, 'error', 10000); return; }
  audio = result.audio; start = 0; end = audio.duration; cursor = 0;
  media.src = audio.url; media.load();
  $('filename').textContent = audio.name;
  $('filename').title = audio.name;
  $('filemeta').textContent = t('fileMetadata', { format: audio.extension || t('unknownAudioFormat'), duration: format(audio.duration) });
  $('file-row').hidden = false;
  $('empty').hidden = true;
  ['selection', 'playhead', 'handle-start', 'handle-end'].forEach(id => { $(id).hidden = false; });
  $('ruler').replaceChildren(...Array.from({ length: 7 }, (_, i) => { const el = document.createElement('span'); el.textContent = format(i * audio.duration / 6, audio.duration < 6); return el; }));
  setBusy(false); update();
}
function xTime(event) { const rect = $('wave').getBoundingClientRect(); return Math.max(0, Math.min(audio.duration, (event.clientX - rect.left) / rect.width * audio.duration)); }
function applyRange(nextStart, nextEnd) {
  if (busy || !audio) return;
  pause(); start = Math.max(0, Math.min(end - MIN, nextStart)); end = Math.min(audio.duration, Math.max(start + MIN, nextEnd));
  cursor = start; media.currentTime = start; update();
}
for (const side of ['start', 'end']) {
  const el = $(`handle-${side}`);
  el.addEventListener('pointerdown', event => {
    if (busy || !audio) return;
    event.preventDefault(); event.stopPropagation(); pause();
    drag = { side, pointerId: event.pointerId }; el.setPointerCapture(event.pointerId);
  });
  el.addEventListener('pointermove', event => {
    if (!drag || drag.side !== side || drag.pointerId !== event.pointerId) return;
    const time = xTime(event);
    applyRange(side === 'start' ? time : start, side === 'end' ? time : end);
  });
  el.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('lostpointercapture', () => { drag = null; });
  el.addEventListener('keydown', event => {
    if (!audio || busy || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let time = side === 'start' ? start : end;
    if (event.key === 'Home') time = side === 'start' ? 0 : start + MIN;
    else if (event.key === 'End') time = side === 'end' ? audio.duration : end - MIN;
    else time += (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 1 : .01);
    applyRange(side === 'start' ? time : start, side === 'end' ? time : end);
  });
  const input = $(`${side}-time`);
  input.addEventListener('change', () => {
    const time = parseTime(input.value);
    if (!Number.isFinite(time) || time < 0 || time > audio.duration || (side === 'start' ? time > end - MIN : time < start + MIN)) {
      notify(t('errorTime'), 'error'); update(); return;
    }
    applyRange(side === 'start' ? time : start, side === 'end' ? time : end);
  });
  input.addEventListener('keydown', event => { if (event.key === 'Enter') input.blur(); });
}
$('wave').addEventListener('pointerdown', event => {
  if (busy) return;
  if (!audio) { loadWith(() => window.corta.open()); return; }
  pause(); cursor = Math.min(end, Math.max(start, xTime(event))); media.currentTime = cursor; update();
});
$('open').addEventListener('click', () => loadWith(() => window.corta.open()));
$('play').addEventListener('click', togglePlay);
$('reset').addEventListener('click', () => { if (!busy && audio) { end = audio.duration; applyRange(0, audio.duration); } });
$('save').addEventListener('click', async () => {
  if (busy || !audio) return;
  pause(); setBusy(true, t('statusSaving'), true);
  let result;
  try { result = await window.corta.save(audio.id, start, end); } catch (error) { result = { error: error.message }; }
  setBusy(false);
  if (result?.error) notify(result.error, 'error', 10000);
  else if (result?.name) notify(t('statusSaved', { name: result.name }), '', 7000);
});
media.addEventListener('ended', () => { pause(); cursor = start; update(); });
media.addEventListener('error', () => { if (audio && !busy) { pause(); notify(t('errorPreviewLoad'), 'error'); } });
document.addEventListener('keydown', event => {
  const typing = ['INPUT', 'TEXTAREA'].includes(event.target.tagName);
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); loadWith(() => window.corta.open()); }
  if (event.code === 'Space' && !typing && event.target.id !== 'language-switch' && !event.repeat) { event.preventDefault(); togglePlay(); }
  if (event.key === 'Escape' && playing) { pause(); cursor = start; media.currentTime = start; update(); }
});
let dragDepth = 0;
document.addEventListener('dragenter', event => { event.preventDefault(); dragDepth++; if (!busy) document.body.classList.add('dragging'); });
document.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; });
document.addEventListener('dragleave', event => { event.preventDefault(); if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
document.addEventListener('drop', event => {
  event.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging');
  const file = event.dataTransfer.files[0];
  if (file && !busy) loadWith(() => window.corta.droppedFile(file));
});
$('language-switch').addEventListener('click', async () => {
  if (busy) return;
  $('language-switch').disabled = true;
  try {
    texts = await window.corta.setLanguage(texts.language === 'es' ? 'en' : 'es');
    applyTexts();
    notify('');
  } catch (error) { notify(error.message, 'error'); }
  finally { $('language-switch').disabled = busy; }
});
applyTexts();
new ResizeObserver(() => draw()).observe($('wave'));
window.corta.onExternal(file => loadWith(() => window.corta.loadPath(file)));
loadWith(() => window.corta.initial());

}
initialize();
