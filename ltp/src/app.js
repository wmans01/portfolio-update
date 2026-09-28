import { metadataFromFile } from './metadata.js';
import { getUploads, putUpload, removeUpload } from './storage.js';

const $ = selector => document.querySelector(selector);
const audio = $('#audio');
const els = {
  drawer: $('#drawer'), backdrop: $('#drawer-backdrop'), list: $('#track-list'),
  tools: $('#drawer-tools'), search: null, settings: $('#settings-menu'),
  theme: $('#theme-select'), visuals: $('#visual-toggle'), seek: $('#seek'),
  speed: $('#speed'), volume: $('#volume'), toast: $('#toast'), canvas: $('#visualizer')
};
const validThemes = new Set(['jeremp0', 'gruvbox', 'gruvbox-light']);
const validSpeeds = new Set([0.5, 0.75, 1, 1.25, 1.5, 2]);
const tracks = new Map();
const objectUrls = new Map();
let builtInIds = [];
let uploadIds = [];
let playlistAction = null;
let pendingPlaylistTrack = null;
let menuTrackId = null;
let drawerTrigger = null;
let toastTimer;
let audioContext;
let analyser;
let animationFrame;
let dragDepth = 0;

function readSettings() {
  try { return JSON.parse(localStorage.getItem('ltplayer-settings') || '{}') || {}; }
  catch { return {}; }
}
const saved = readSettings();
const state = {
  theme: validThemes.has(saved.theme) ? saved.theme : 'jeremp0',
  visuals: Boolean(saved.visuals),
  volume: Number.isFinite(saved.volume) ? Math.min(1, Math.max(0, saved.volume)) : 0.8,
  speed: validSpeeds.has(saved.speed) ? saved.speed : 1,
  shuffle: Boolean(saved.shuffle),
  repeat: ['off', 'all', 'one'].includes(saved.repeat) ? saved.repeat : 'off',
  playlists: Array.isArray(saved.playlists) ? saved.playlists.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.trackIds)) : [],
  panel: null, collection: 'all', search: '', sort: 'title',
  currentId: null, queue: [], history: [], context: [], muted: false
};

function saveSettings() {
  try {
    localStorage.setItem('ltplayer-settings', JSON.stringify({
      theme: state.theme, visuals: state.visuals, volume: state.volume,
      speed: state.speed, shuffle: state.shuffle, repeat: state.repeat,
      playlists: state.playlists
    }));
  } catch { toast('Browser settings could not be saved.'); }
}
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3300);
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}
function icon(name) { return '<svg aria-hidden="true"><use href="#i-' + name + '"/></svg>'; }
function track(id) { return tracks.get(id); }
function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}
function shuffled(ids) {
  const copy = [...ids];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}
function setRangeFill(input, percent) {
  input.style.setProperty('--fill', Math.min(100, Math.max(0, percent)) + '%');
}
function playlistForSelection() {
  return state.playlists.find(playlist => playlist.id === state.collection);
}
function entriesForPanel() {
  let entries;
  if (state.panel === 'queue') entries = state.queue.map((id, queueIndex) => ({ id, queueIndex }));
  else if (state.panel === 'uploads') entries = uploadIds.map(id => ({ id }));
  else {
    const playlist = playlistForSelection();
    entries = (playlist ? playlist.trackIds : [...builtInIds, ...uploadIds]).map(id => ({ id }));
  }
  entries = entries.filter(entry => tracks.has(entry.id));
  const query = state.search.trim().toLocaleLowerCase();
  if (query && state.panel !== 'queue') {
    entries = entries.filter(entry => {
      const item = track(entry.id);
      return (item.title + ' ' + item.artist + ' ' + item.album).toLocaleLowerCase().includes(query);
    });
  }
  if (state.panel === 'uploads' || (state.panel === 'library' && !playlistForSelection())) {
    entries.sort((a, b) => {
      if (state.sort === 'recent') return track(b.id).addedAt - track(a.id).addedAt;
      return track(a.id)[state.sort].localeCompare(track(b.id)[state.sort], undefined, { sensitivity: 'base' });
    });
  }
  return entries;
}

function renderDrawerTools() {
  if (!state.panel) return;
  const playlist = state.panel === 'library' ? playlistForSelection() : null;
  if (state.panel === 'library') {
    const options = '<option value="all">All tracks</option>' + state.playlists.map(p =>
      '<option value="' + escapeHTML(p.id) + '">' + escapeHTML(p.name) + '</option>'
    ).join('');
    els.tools.innerHTML =
      '<div class="toolbar-line"><select class="collection-select" id="collection-select" aria-label="Library collection">' + options + '</select>' +
      '<button class="icon-button" data-action="new-playlist" aria-label="New playlist" title="New playlist">' + icon('plus') + '</button>' +
      '<button class="subtle-button" data-action="play-all">Play all</button></div>' +
      (playlist ? '<div class="toolbar-line"><button class="subtle-button" data-action="rename-playlist">Rename playlist</button><button class="subtle-button" data-action="delete-playlist">Delete playlist</button></div>' : '') +
      '<div class="toolbar-line"><label class="search-box">' + icon('search') + '<input id="drawer-search" type="search" placeholder="Search tracks" aria-label="Search tracks"/></label>' +
      (playlist ? '' : '<select class="sort-select" id="sort-select" aria-label="Sort tracks"><option value="title">Title</option><option value="artist">Artist</option><option value="recent">Recent</option></select>') + '</div>';
    $('#collection-select').value = state.collection;
  } else if (state.panel === 'uploads') {
    els.tools.innerHTML =
      '<div class="toolbar-line"><button class="primary-button" data-action="upload">' + icon('plus') + 'Add music</button><button class="subtle-button" data-action="play-all">Play all</button></div>' +
      '<div class="toolbar-line"><label class="search-box">' + icon('search') + '<input id="drawer-search" type="search" placeholder="Search uploads" aria-label="Search uploads"/></label>' +
      '<select class="sort-select" id="sort-select" aria-label="Sort uploads"><option value="title">Title</option><option value="artist">Artist</option><option value="recent">Recent</option></select></div>';
  } else {
    els.tools.innerHTML = state.queue.length ? '<div class="toolbar-line"><button class="subtle-button" data-action="clear-queue">Clear queue</button></div>' : '';
  }
  const search = $('#drawer-search');
  if (search) search.value = state.search;
  const sort = $('#sort-select');
  if (sort) sort.value = state.sort;
}
function renderDrawerList() {
  if (!state.panel) return;
  const entries = entriesForPanel();
  $('#drawer-title').textContent = state.panel === 'library' ? 'Library' : state.panel === 'uploads' ? 'Uploads' : 'Queue';
  $('#drawer-count').textContent = entries.length + ' track' + (entries.length === 1 ? '' : 's');
  if (!entries.length) {
    const message = state.search.trim() ? 'No tracks match your search.' :
      state.panel === 'uploads' ? 'Add MP3 or MP4 files from your device.' :
      state.panel === 'queue' ? 'Play a track or add one to your queue.' :
      playlistForSelection() ? 'Add songs to this playlist from the library.' :
      'Add files to music/ or open Uploads to add your own.';
    els.list.innerHTML = '<div class="empty-state">' + icon('note') + '<h3>No tracks here</h3><p>' + escapeHTML(message) + '</p></div>';
    return;
  }
  els.list.innerHTML = entries.map((entry, index) => {
    const item = track(entry.id);
    const current = state.currentId === entry.id;
    const controls = state.panel === 'queue'
      ? '<button class="icon-button" data-action="queue-up" data-index="' + entry.queueIndex + '" aria-label="Move up" title="Move up">' + icon('up') + '</button>' +
        '<button class="icon-button" data-action="queue-down" data-index="' + entry.queueIndex + '" aria-label="Move down" title="Move down">' + icon('down') + '</button>' +
        '<button class="icon-button" data-action="queue-remove" data-index="' + entry.queueIndex + '" aria-label="Remove from queue" title="Remove from queue">' + icon('close') + '</button>'
      : '<button class="icon-button" data-action="track-menu" data-id="' + escapeHTML(entry.id) + '" aria-label="Options for ' + escapeHTML(item.title) + '" title="Track options">' + icon('more') + '</button>';
    return '<div class="track-row' + (current ? ' current' : '') + '">' +
      '<span class="track-index">' + (current && !audio.paused ? '♪' : index + 1) + '</span>' +
      '<button class="track-main" data-action="play-track" data-id="' + escapeHTML(entry.id) + '"><strong>' + escapeHTML(item.title) + '</strong><span>' + escapeHTML(item.artist) + '</span></button>' +
      '<span class="track-duration">' + (item.duration ? formatTime(item.duration) : '—') + '</span>' +
      '<span class="row-actions">' + controls + '</span></div>';
  }).join('');
}
function renderDrawer() { renderDrawerTools(); renderDrawerList(); }

function renderPlayback() {
  const item = track(state.currentId);
  $('#now-title').textContent = item?.title || 'No track selected';
  $('#now-artist').textContent = item?.artist || 'Open Library or Uploads to start';
  document.title = item ? item.title + ' — ltplayer' : 'ltplayer';
  document.body.classList.toggle('playing', Boolean(item && !audio.paused));
  $('#play-pause').innerHTML = icon(audio.paused ? 'play' : 'pause');
  $('#play-pause').setAttribute('aria-label', audio.paused ? 'Play' : 'Pause');
  $('#shuffle').classList.toggle('active', state.shuffle);
  $('#shuffle').setAttribute('aria-pressed', String(state.shuffle));
  $('#repeat').classList.toggle('active', state.repeat !== 'off');
  $('#repeat').classList.toggle('one', state.repeat === 'one');
  $('#repeat').setAttribute('aria-label', 'Repeat ' + state.repeat);
  $('#repeat').title = 'Repeat ' + state.repeat;
  $('#mute').innerHTML = icon(state.muted || state.volume === 0 ? 'muted' : 'volume');
  $('#mute').setAttribute('aria-label', state.muted ? 'Unmute' : 'Mute');
  els.volume.value = String(Math.round(state.volume * 100));
  setRangeFill(els.volume, state.volume * 100);
  els.speed.value = String(state.speed);
  updateProgress();
}
function updateProgress() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  $('#elapsed').textContent = formatTime(audio.currentTime);
  $('#duration').textContent = formatTime(duration);
  els.seek.value = duration ? String(Math.round(audio.currentTime / duration * 1000)) : '0';
  setRangeFill(els.seek, duration ? audio.currentTime / duration * 100 : 0);
  const item = track(state.currentId);
  if (item && duration && item.duration !== duration) {
    item.duration = duration;
    const row = els.list.querySelector('.track-row.current .track-duration');
    if (row) row.textContent = formatTime(duration);
  }
  if ('mediaSession' in navigator && duration && Number.isFinite(audio.currentTime)) {
    try { navigator.mediaSession.setPositionState({ duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, duration) }); }
    catch { /* Position state is optional. */ }
  }
}
function renderAll() { renderDrawer(); renderPlayback(); }

function closeSettings() {
  els.settings.hidden = true;
  $('#settings-button').setAttribute('aria-expanded', 'false');
}
function openDrawer(panel, trigger) {
  if (state.panel === panel) { closeDrawer(); return; }
  closeSettings();
  state.panel = panel;
  state.search = '';
  drawerTrigger = trigger || drawerTrigger;
  renderDrawer();
  els.backdrop.hidden = false;
  els.drawer.inert = false;
  els.drawer.setAttribute('aria-hidden', 'false');
  els.drawer.classList.add('open');
  document.querySelectorAll('[data-open-panel]').forEach(button =>
    button.setAttribute('aria-expanded', String(button.dataset.openPanel === panel)));
  $('#close-drawer').focus();
}
function closeDrawer() {
  if (!state.panel) return;
  state.panel = null;
  els.drawer.classList.remove('open');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.drawer.inert = true;
  els.backdrop.hidden = true;
  document.querySelectorAll('[data-open-panel]').forEach(button => button.setAttribute('aria-expanded', 'false'));
  if (els.drawer.contains(document.activeElement)) drawerTrigger?.focus();
}
function sourceFor(item) {
  if (!item.file) return item.src;
  if (!objectUrls.has(item.id)) objectUrls.set(item.id, URL.createObjectURL(item.file));
  return objectUrls.get(item.id);
}
function updateMediaSession(item) {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
  navigator.mediaSession.metadata = new MediaMetadata({ title: item.title, artist: item.artist, album: item.album });
  navigator.mediaSession.playbackState = 'playing';
}
async function startTrack(id) {
  const item = track(id);
  if (!item) return;
  state.currentId = id;
  audio.src = sourceFor(item);
  audio.playbackRate = state.speed;
  audio.load();
  updateMediaSession(item);
  renderPlayback();
  renderDrawerList();
  try {
    if (state.visuals) await enableAudioGraph();
    await audio.play();
  } catch (error) {
    toast(error?.name === 'NotAllowedError' ? 'Press play to start listening.' : 'Could not play this file. Check its audio format.');
  }
}
function playFromList(id, list) {
  const index = list.indexOf(id);
  state.context = [...list];
  state.queue = state.shuffle
    ? shuffled(list.filter((other, position) => position !== index))
    : list.slice(index + 1);
  state.history = [];
  closeDrawer();
  startTrack(id);
}
function togglePlayback() {
  if (!state.currentId) {
    const ids = [...builtInIds, ...uploadIds].filter(id => tracks.has(id));
    if (ids.length) playFromList(ids[0], ids);
    else toast('Open Uploads to add music.');
    return;
  }
  if (audio.paused) {
    if (state.visuals) enableAudioGraph();
    audio.play().catch(() => toast('This track could not be played.'));
  } else audio.pause();
}
function advance(natural = false) {
  if (natural && state.repeat === 'one' && state.currentId) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  let next = state.queue.shift();
  while (next && !tracks.has(next)) next = state.queue.shift();
  if (!next && state.repeat === 'all' && state.context.length) {
    state.queue = state.shuffle
      ? shuffled(state.context.filter(id => tracks.has(id)))
      : state.context.filter(id => tracks.has(id));
    next = state.queue.shift();
  }
  if (!next) {
    if (natural) audio.pause();
    else toast('End of queue.');
    renderAll();
    return;
  }
  if (state.currentId) state.history.push(state.currentId);
  startTrack(next);
}
function previous() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  const id = state.history.pop();
  if (id && tracks.has(id)) {
    if (state.currentId) state.queue.unshift(state.currentId);
    startTrack(id);
  } else if (state.currentId) audio.currentTime = 0;
}
function openPlaylistDialog(playlist = null, initialTrack = null) {
  playlistAction = playlist;
  pendingPlaylistTrack = initialTrack;
  $('#playlist-dialog-title').textContent = playlist ? 'Rename playlist' : 'New playlist';
  $('#playlist-name').value = playlist?.name || '';
  $('#playlist-dialog').showModal();
  $('#playlist-name').focus();
}
function openTrackMenu(id) {
  const item = track(id);
  if (!item) return;
  menuTrackId = id;
  $('#track-dialog-title').textContent = item.title;
  const playlist = state.panel === 'library' ? playlistForSelection() : null;
  const options = [
    '<button class="dialog-option" data-menu-action="queue">Add to queue <span>→</span></button>',
    ...state.playlists.map(p =>
      '<button class="dialog-option' + (p.trackIds.includes(id) ? ' added' : '') +
      '" data-menu-action="playlist" data-playlist-id="' + escapeHTML(p.id) + '">' +
      escapeHTML(p.name) + '<span>' + (p.trackIds.includes(id) ? '✓' : '+') + '</span></button>'),
    '<button class="dialog-option" data-menu-action="create-playlist">New playlist <span>+</span></button>'
  ];
  if (playlist?.trackIds.includes(id)) {
    const index = playlist.trackIds.indexOf(id);
    if (index > 0) options.push('<button class="dialog-option" data-menu-action="playlist-up">Move up <span>↑</span></button>');
    if (index < playlist.trackIds.length - 1) options.push('<button class="dialog-option" data-menu-action="playlist-down">Move down <span>↓</span></button>');
    options.push('<button class="dialog-option" data-menu-action="remove-playlist">Remove from playlist <span>×</span></button>');
  }
  if (item.file) options.push('<button class="dialog-option" data-menu-action="remove-upload">Remove uploaded file <span>×</span></button>');
  $('#track-options').innerHTML = options.join('');
  $('#track-dialog').showModal();
}
async function handleMenuAction(button) {
  const id = menuTrackId;
  const action = button.dataset.menuAction;
  if (!id || !tracks.has(id)) return;
  if (action === 'create-playlist') {
    $('#track-dialog').close();
    openPlaylistDialog(null, id);
    return;
  }
  if (action === 'queue') {
    state.queue.push(id);
    toast('Added to queue.');
  } else if (action === 'playlist') {
    const playlist = state.playlists.find(p => p.id === button.dataset.playlistId);
    if (playlist) {
      if (playlist.trackIds.includes(id)) {
        playlist.trackIds = playlist.trackIds.filter(trackId => trackId !== id);
        toast('Removed from ' + playlist.name + '.');
      } else {
        playlist.trackIds.push(id);
        toast('Added to ' + playlist.name + '.');
      }
      saveSettings();
    }
  } else if (action === 'remove-playlist' || action === 'playlist-up' || action === 'playlist-down') {
    const playlist = playlistForSelection();
    if (playlist) {
      const from = playlist.trackIds.indexOf(id);
      if (action === 'remove-playlist') {
        playlist.trackIds = playlist.trackIds.filter(trackId => trackId !== id);
        toast('Removed from playlist.');
      } else {
        const to = from + (action === 'playlist-up' ? -1 : 1);
        if (from >= 0 && to >= 0 && to < playlist.trackIds.length) {
          [playlist.trackIds[from], playlist.trackIds[to]] = [playlist.trackIds[to], playlist.trackIds[from]];
        }
      }
      saveSettings();
    }
  } else if (action === 'remove-upload') {
    const item = track(id);
    if (confirm('Remove “' + item.title + '” from this browser?')) {
      try { await removeUpload(id); } catch { /* Session-only uploads are not stored. */ }
      if (state.currentId === id) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        state.currentId = null;
      }
      if (objectUrls.has(id)) {
        URL.revokeObjectURL(objectUrls.get(id));
        objectUrls.delete(id);
      }
      tracks.delete(id);
      uploadIds = uploadIds.filter(trackId => trackId !== id);
      state.queue = state.queue.filter(trackId => trackId !== id);
      state.context = state.context.filter(trackId => trackId !== id);
      state.history = state.history.filter(trackId => trackId !== id);
      state.playlists.forEach(p => { p.trackIds = p.trackIds.filter(trackId => trackId !== id); });
      saveSettings();
      toast('Uploaded file removed.');
    }
  }
  $('#track-dialog').close();
  renderAll();
}
async function uploadFiles(files) {
  const allowed = [...files].filter(file => /\.(mp3|mp4)$/i.test(file.name));
  if (!allowed.length) { toast('Choose MP3 or MP4 files.'); return; }
  let sessionOnly = 0;
  for (const file of allowed) {
    const metadata = await metadataFromFile(file);
    const id = 'upload:' + (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random());
    const record = {
      id, file, ...metadata, kind: /\.mp4$/i.test(file.name) ? 'mp4' : 'mp3',
      addedAt: Date.now()
    };
    try { await putUpload(record); } catch { sessionOnly++; }
    tracks.set(id, record);
    uploadIds.push(id);
  }
  renderAll();
  toast(sessionOnly
    ? allowed.length + ' added. ' + sessionOnly + ' will last only this session.'
    : allowed.length + ' track' + (allowed.length === 1 ? '' : 's') + ' added.');
}
function applyAppearance() {
  document.body.dataset.theme = state.theme;
  document.body.dataset.visuals = state.visuals ? 'on' : 'off';
  els.theme.value = state.theme;
  els.visuals.checked = state.visuals;
  $('meta[name="theme-color"]').content =
    state.theme === 'gruvbox' ? '#1d2021' : state.theme === 'gruvbox-light' ? '#f9f5d7' : '#f2efe0';
  if (state.visuals && !audio.paused) { enableAudioGraph(); animateVisualizer(); }
  else stopVisualizer();
}
async function enableAudioGraph() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    if (!audioContext) {
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      const source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
    }
    if (audioContext.state === 'suspended') await audioContext.resume();
    animateVisualizer();
  } catch { stopVisualizer(); }
}
function stopVisualizer() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = undefined;
  const context = els.canvas.getContext('2d');
  if (context) context.clearRect(0, 0, els.canvas.width, els.canvas.height);
}
function animateVisualizer() {
  if (animationFrame || !state.visuals || audio.paused || document.hidden || !analyser ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = els.canvas;
  const context = canvas.getContext('2d');
  const frequencies = new Uint8Array(analyser.frequencyBinCount);
  const draw = () => {
    if (!state.visuals || audio.paused || document.hidden) { stopVisualizer(); return; }
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    context.clearRect(0, 0, width, height);
    analyser.getByteFrequencyData(frequencies);
    context.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent').trim();
    const bars = 38;
    const gap = 3 * ratio;
    const barWidth = (width - gap * (bars - 1)) / bars;
    for (let index = 0; index < bars; index++) {
      const magnitude = frequencies[Math.min(frequencies.length - 1, Math.floor(index * frequencies.length / bars))] / 255;
      const barHeight = Math.max(3 * ratio, Math.pow(magnitude, 1.4) * height);
      context.fillRect(index * (barWidth + gap), height - barHeight, barWidth, barHeight);
    }
    animationFrame = requestAnimationFrame(draw);
  };
  animationFrame = requestAnimationFrame(draw);
}
function installMediaKeys() {
  if (!('mediaSession' in navigator)) return;
  const handlers = {
    play: () => { if (audio.paused) togglePlayback(); },
    pause: () => audio.pause(),
    previoustrack: previous,
    nexttrack: () => advance(),
    seekto: details => { if (Number.isFinite(details.seekTime)) audio.currentTime = details.seekTime; },
    seekbackward: details => { audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10)); },
    seekforward: details => { audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (details.seekOffset || 10)); }
  };
  Object.entries(handlers).forEach(([action, handler]) => {
    try { navigator.mediaSession.setActionHandler(action, handler); }
    catch { /* Unsupported action. */ }
  });
}

function bindEvents() {
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (button?.dataset.openPanel) {
      openDrawer(button.dataset.openPanel, button);
      return;
    }
    if (button?.id === 'settings-button') {
      const opening = els.settings.hidden;
      closeSettings();
      if (opening) {
        els.settings.hidden = false;
        button.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    if (!event.target.closest('.settings-anchor')) closeSettings();
    if (!button) return;
    if (button.id === 'close-drawer' || button.id === 'drawer-backdrop') { closeDrawer(); return; }
    if (button.dataset.closeDialog !== undefined) { button.closest('dialog')?.close(); return; }
    if (button.dataset.menuAction) { handleMenuAction(button); return; }

    const action = button.dataset.action;
    if (action === 'play-track') {
      const ids = entriesForPanel().map(entry => entry.id);
      playFromList(button.dataset.id, ids);
    } else if (action === 'track-menu') openTrackMenu(button.dataset.id);
    else if (action === 'upload') $('#file-input').click();
    else if (action === 'play-all') {
      const ids = entriesForPanel().map(entry => entry.id);
      if (ids.length) playFromList(ids[0], ids);
    } else if (action === 'new-playlist') openPlaylistDialog();
    else if (action === 'rename-playlist') openPlaylistDialog(playlistForSelection());
    else if (action === 'delete-playlist') {
      const playlist = playlistForSelection();
      if (playlist && confirm('Delete “' + playlist.name + '”? Its songs will stay in your library.')) {
        state.playlists = state.playlists.filter(p => p !== playlist);
        state.collection = 'all';
        saveSettings();
        renderDrawer();
        toast('Playlist deleted.');
      }
    } else if (action === 'clear-queue') {
      state.queue = [];
      renderDrawer();
      toast('Queue cleared.');
    } else if (action === 'queue-up' || action === 'queue-down') {
      const from = Number(button.dataset.index);
      const to = from + (action === 'queue-up' ? -1 : 1);
      if (from >= 0 && to >= 0 && to < state.queue.length) {
        [state.queue[from], state.queue[to]] = [state.queue[to], state.queue[from]];
        renderDrawerList();
      }
    } else if (action === 'queue-remove') {
      const index = Number(button.dataset.index);
      if (index >= 0 && index < state.queue.length) {
        state.queue.splice(index, 1);
        renderDrawer();
      }
    }
  });

  els.drawer.addEventListener('change', event => {
    if (event.target.id === 'collection-select') {
      state.collection = event.target.value;
      state.search = '';
      renderDrawer();
    } else if (event.target.id === 'sort-select') {
      state.sort = event.target.value;
      renderDrawerList();
    }
  });
  els.drawer.addEventListener('input', event => {
    if (event.target.id === 'drawer-search') {
      state.search = event.target.value;
      renderDrawerList();
    }
  });
  $('#playlist-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#playlist-name').value.trim();
    if (!name) return;
    const renamed = Boolean(playlistAction);
    if (playlistAction) playlistAction.name = name;
    else {
      const id = globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random();
      state.playlists.push({
        id, name, trackIds: pendingPlaylistTrack ? [pendingPlaylistTrack] : []
      });
      state.collection = id;
    }
    saveSettings();
    $('#playlist-dialog').close();
    playlistAction = null;
    pendingPlaylistTrack = null;
    if (state.panel !== 'library') openDrawer('library', document.querySelector('[data-open-panel="library"]'));
    else renderDrawer();
    toast(renamed ? 'Playlist renamed.' : 'Playlist created.');
  });
  $('#file-input').addEventListener('change', event => {
    if (event.target.files.length) uploadFiles(event.target.files);
    event.target.value = '';
  });
  els.theme.addEventListener('change', () => {
    state.theme = els.theme.value;
    saveSettings();
    applyAppearance();
  });
  els.visuals.addEventListener('change', () => {
    state.visuals = els.visuals.checked;
    saveSettings();
    applyAppearance();
  });
  $('#play-pause').addEventListener('click', togglePlayback);
  $('#previous').addEventListener('click', previous);
  $('#next').addEventListener('click', () => advance());
  $('#shuffle').addEventListener('click', () => {
    state.shuffle = !state.shuffle;
    if (state.shuffle) state.queue = shuffled(state.queue);
    saveSettings();
    renderAll();
  });
  $('#repeat').addEventListener('click', () => {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
    saveSettings();
    renderPlayback();
  });
  $('#mute').addEventListener('click', () => {
    state.muted = !state.muted;
    audio.muted = state.muted;
    renderPlayback();
  });
  els.volume.addEventListener('input', () => {
    state.volume = Number(els.volume.value) / 100;
    state.muted = false;
    audio.muted = false;
    audio.volume = state.volume;
    saveSettings();
    renderPlayback();
  });
  els.speed.addEventListener('change', () => {
    state.speed = Number(els.speed.value);
    audio.playbackRate = state.speed;
    saveSettings();
    renderPlayback();
  });
  els.seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = Number(els.seek.value) / 1000 * audio.duration;
    updateProgress();
  });
  audio.addEventListener('play', () => {
    renderPlayback();
    renderDrawerList();
    animateVisualizer();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  });
  audio.addEventListener('pause', () => {
    renderPlayback();
    renderDrawerList();
    stopVisualizer();
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  });
  audio.addEventListener('ended', () => advance(true));
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('durationchange', updateProgress);
  audio.addEventListener('error', () => {
    if (state.currentId) toast('This file could not be played. Try a supported MP3 or MP4 audio codec.');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopVisualizer();
    else animateVisualizer();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (document.querySelector('dialog[open]')) return;
      closeSettings();
      closeDrawer();
      return;
    }
    if (state.panel && event.key === 'Tab' && !document.querySelector('dialog[open]')) {
      const focusables = [...els.drawer.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled)')];
      if (focusables.length && event.shiftKey && document.activeElement === focusables[0]) {
        event.preventDefault(); focusables.at(-1).focus();
      } else if (focusables.length && !event.shiftKey && document.activeElement === focusables.at(-1)) {
        event.preventDefault(); focusables[0].focus();
      }
    }
    if (event.target.closest('button,input,select,textarea,dialog') || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === ' ' || event.code === 'Space') { event.preventDefault(); togglePlayback(); }
    else if (event.key === 'ArrowRight' && state.currentId) {
      event.preventDefault(); audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 5);
    } else if (event.key === 'ArrowLeft' && state.currentId) {
      event.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (event.key.toLowerCase() === 'm') {
      state.muted = !state.muted; audio.muted = state.muted; renderPlayback();
    } else if (event.key === '/' && state.panel && state.panel !== 'queue') {
      event.preventDefault(); $('#drawer-search')?.focus();
    }
  });
  document.addEventListener('dragenter', event => {
    if ([...(event.dataTransfer?.types || [])].includes('Files')) {
      event.preventDefault();
      dragDepth++;
      document.body.classList.add('dragging');
    }
  });
  document.addEventListener('dragover', event => {
    if (document.body.classList.contains('dragging')) event.preventDefault();
  });
  document.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) document.body.classList.remove('dragging');
  });
  document.addEventListener('drop', event => {
    event.preventDefault();
    dragDepth = 0;
    document.body.classList.remove('dragging');
    if (event.dataTransfer?.files.length) uploadFiles(event.dataTransfer.files);
  });
}

async function initialize() {
  audio.volume = state.volume;
  audio.playbackRate = state.speed;
  if (!state.playlists.some(p => p.id === state.collection)) state.collection = 'all';
  applyAppearance();
  bindEvents();
  installMediaKeys();
  try {
    const response = await fetch('./library.json', { cache: 'no-cache' });
    if (response.ok) {
      const manifest = await response.json();
      for (const item of manifest.tracks || []) {
        if (!item?.id || !item.src) continue;
        tracks.set(item.id, item);
        builtInIds.push(item.id);
      }
    }
  } catch { toast('Could not load the music library index.'); }
  try {
    const uploads = await getUploads();
    for (const item of uploads) { tracks.set(item.id, item); uploadIds.push(item.id); }
  } catch { toast('Browser storage is unavailable; uploads will last this session.'); }
  renderAll();
}

initialize();
