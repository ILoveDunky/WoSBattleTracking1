// Data Storage Initialization
const DATA_KEY = 'march_tracker_data_v1';
const SETTINGS_KEY = 'march_tracker_settings_v1';
const BACKUP_PREFIX = 'march_tracker_backup_'; // we'll keep 3 rotating
const DATA_VERSION = 1;

const ALERT_CONFIG = {
  marchWarnSeconds: 15,    // mark as warning if march < this
  buffWarnSeconds: 60,     // mark as warning if buff < this
  beepEnabled: true,
};

const state = {
  players: [],
  timers: {
    rafId: null,
    lastTick: 0,
  },
  settings: {
    compact: false
  }
};

// ---- element bindings ----
const els = {};

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
  els.playerForm = document.getElementById('playerForm');
  els.playerName = document.getElementById('playerName');
  els.target = document.getElementById('target');
  els.marchSeconds = document.getElementById('marchSeconds');
  els.friendly = document.getElementById('friendly');
  els.petBuffActive = document.getElementById('petBuffActive');
  els.petBuffMinutes = document.getElementById('petBuffMinutes');
  els.startNow = document.getElementById('startNow');
  els.compactToggle = document.getElementById('compactToggle');

  els.startAll = document.getElementById('startAll');
  els.clearAll = document.getElementById('clearAll');
  els.clearFinished = document.getElementById('clearFinished');
  els.addQuickDemo = document.getElementById('addQuickDemo');
  els.helpBtn = document.getElementById('helpBtn');

  els.searchInput = document.getElementById('searchInput');
  els.filterFriendly = document.getElementById('filterFriendly');
  els.sortBy = document.getElementById('sortBy');

  els.playersBody = document.getElementById('playersBody');

  els.exportData = document.getElementById('exportData');
  els.importData = document.getElementById('importData');
  els.importFile = document.getElementById('importFile');

  els.editDialog = document.getElementById('editDialog');
  els.editForm = document.getElementById('editForm');
  els.editId = document.getElementById('editId');
  els.editName = document.getElementById('editName');
  els.editTarget = document.getElementById('editTarget');
  els.editFriendly = document.getElementById('editFriendly');
  els.editMarchSeconds = document.getElementById('editMarchSeconds');
  els.editPetActive = document.getElementById('editPetActive');
  els.editPetMinutes = document.getElementById('editPetMinutes');
  els.editSave = document.getElementById('editSave');
  els.editCancel = document.getElementById('editCancel');

  els.instructionsDialog = document.getElementById('instructionsDialog');
  els.closeInstructions = document.getElementById('closeInstructions');

  // calculators
  els.sameTimeInputs = document.getElementById('sameTimeInputs');
  els.addRallySameTime = document.getElementById('addRallySameTime');
  els.calcSameTime = document.getElementById('calcSameTime');
  els.sameTimeTable = document.getElementById('sameTimeTable');
  els.nowClockSame = document.getElementById('nowClockSame');
  els.clearSameTime = document.getElementById('clearSameTime');
  els.sameTimeBuffer = document.getElementById('sameTimeBuffer');
  els.copySameTime = document.getElementById('copySameTime');

  els.gapInputs = document.getElementById('gapInputs');
  els.addRallyGap = document.getElementById('addRallyGap');
  els.calcGap = document.getElementById('calcGap');
  els.gapTable = document.getElementById('gapTable');
  els.nowClockGap = document.getElementById('nowClockGap');
  els.clearGap = document.getElementById('clearGap');

  init();
});

// ---- util ----
const uid = () => (crypto && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2,9);
const now = () => Date.now();
const secToMs = (s) => Math.max(0, Number(s || 0)) * 1000;
const minToMs = (m) => Math.max(0, Number(m || 0)) * 60_000;
const clamp = (v, minV, maxV) => Math.min(Math.max(v, minV), maxV);

function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ---- storage with backups ----
function save() {
  const payload = {
    version: DATA_VERSION,
    savedAt: now(),
    players: state.players,
  };
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(payload));
    saveBackup(payload);
  } catch (err) {
    console.error('Save failed', err);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  } catch (err) {
    console.error('Settings save failed', err);
  }
}

function load() {
  const rawData = localStorage.getItem(DATA_KEY);
  if (rawData) {
    try {
      const parsed = JSON.parse(rawData);
      if (parsed?.players && Array.isArray(parsed.players)) {
        state.players = parsed.players;
      }
    } catch (err) {
      console.warn('Could not parse saved data', err);
    }
  }

  const rawSettings = localStorage.getItem(SETTINGS_KEY);
  if (rawSettings) {
    try {
      const parsed = JSON.parse(rawSettings);
      if (parsed) {
        state.settings = { ...state.settings, ...parsed };
      }
    } catch (err) {
      console.warn('Could not parse saved settings', err);
    }
  }

  // Apply visual settings
  if(els.compactToggle) els.compactToggle.checked = state.settings.compact;
  document.body.classList.toggle('compact', state.settings.compact);
}

function saveBackup(payload) {
  try {
    const b1 = localStorage.getItem(BACKUP_PREFIX + '1');
    const b2 = localStorage.getItem(BACKUP_PREFIX + '2');
    if (b2) localStorage.setItem(BACKUP_PREFIX + '3', b2);
    if (b1) localStorage.setItem(BACKUP_PREFIX + '2', b1);
    localStorage.setItem(BACKUP_PREFIX + '1', JSON.stringify(payload));
  } catch (e) {
    console.warn('Backup failed', e);
  }
}

// ---- data operations ----
function addPlayer(p) {
  state.players.push(p);
  save();
  render();
}
function updatePlayer(id, patch) {
  const i = state.players.findIndex(x => x.id === id);
  if (i === -1) return;
  state.players[i] = { ...state.players[i], ...patch };
  save();
  render();
}
function removePlayer(id) {
  state.players = state.players.filter(p => p.id !== id);
  save();
  render();
}

function clearFinished() {
  const t = now();
  const before = state.players.length;
  state.players = state.players.filter(p => {
    const marchLeft = (p.marchEnd || 0) - t;
    const buffLeft = p.petBuffActive ? (p.petBuffEnd || 0) - t : 1;
    return marchLeft > 0 || buffLeft > 0;
  });
  if (state.players.length !== before) {
    save();
    render();
  }
}

function startAllCountdowns() {
  const curr = now();
  state.players = state.players.map(p => {
    const marchMs = secToMs(p.marchEtaSec);
    const buffMs = minToMs(p.petBuffMinutes);
    return {
      ...p,
      marchStart: marchMs ? curr : null,
      marchEnd: marchMs ? curr + marchMs : null,
      petBuffActive: p.petBuffActive,
      petBuffStart: p.petBuffActive && buffMs ? curr : null,
      petBuffEnd: p.petBuffActive && buffMs ? curr + buffMs : null,
      notified: false,
      buffNotified: false,
    };
  });
  save(); render();
}

function startMarch(id) {
  const p = state.players.find(x => x.id === id);
  if (!p) return;
  const ts = now();
  const ms = secToMs(p.marchEtaSec);
  updatePlayer(id, { marchStart: ms ? ts : null, marchEnd: ms ? ts + ms : null, notified: false });
  beep(80, 400, 0.05);
}
function stopMarch(id) { updatePlayer(id, { marchStart: null, marchEnd: null, notified: false }); }

function startBuff(id) {
  const p = state.players.find(x => x.id === id);
  if (!p) return;
  const ts = now();
  if (!p.petBuffMinutes || p.petBuffMinutes <= 0) p.petBuffMinutes = 120;
  const ms = minToMs(p.petBuffMinutes);
  updatePlayer(id, {
    petBuffActive: true,
    petBuffStart: ms ? ts : null,
    petBuffEnd: ms ? ts + ms : null,
    buffNotified: false,
    petBuffMinutes: p.petBuffMinutes
  });
  beep(80, 500, 0.05);
}
function stopBuff(id) { updatePlayer(id, { petBuffActive: false, petBuffStart: null, petBuffEnd: null, buffNotified: false }); }

// ---- audio alert ----
function beep(duration = 150, freq = 880, vol = 0.08) {
  if (!ALERT_CONFIG.beepEnabled) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = vol;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    setTimeout(() => { o.stop(); }, duration);
  } catch (e) {
    console.warn('Beep failed', e);
  }
}
function beepSuccess() {
  beep(80, 800, 0.05);
  setTimeout(() => beep(120, 1200, 0.05), 100);
}

// ---- render ----
function render() {
  const q = (els.searchInput.value || '').toLowerCase();
  const friendlyFilter = els.filterFriendly.value;
  let rows = [...state.players];

  const t = now();
  rows = rows.map(p => {
    const marchLeft = p.marchEnd ? Math.max(0, p.marchEnd - t) : null;
    const buffLeft = p.petBuffActive && p.petBuffEnd ? Math.max(0, p.petBuffEnd - t) : null;
    const marchTotal = secToMs(p.marchEtaSec);
    const marchPct = marchLeft == null || marchTotal === 0 ? 0 : clamp(((marchTotal - marchLeft) / marchTotal) * 100, 0, 100);
    const buffTotal = minToMs(p.petBuffMinutes);
    const buffPct = !p.petBuffActive || buffLeft == null || buffTotal === 0 ? 0 : clamp(((buffTotal - buffLeft) / buffTotal) * 100, 0, 100);
    return { ...p, marchLeft, buffLeft, marchPct, buffPct };
  });

  rows = rows.filter(p => {
    const matchesQuery = p.name.toLowerCase().includes(q) || (p.target || '').toLowerCase().includes(q);
    const matchesFriendly =
      friendlyFilter === 'all' ||
      (friendlyFilter === 'friendly' && !!p.friendly) ||
      (friendlyFilter === 'hostile' && !p.friendly);
    return matchesQuery && matchesFriendly;
  });

  const sortBy = els.sortBy.value;
  rows.sort((a, b) => {
    switch (sortBy) {
      case 'timeLeftAsc': return (a.marchLeft ?? Infinity) - (b.marchLeft ?? Infinity);
      case 'timeLeftDesc': return (b.marchLeft ?? Infinity) - (a.marchLeft ?? Infinity);
      case 'nameAsc': return a.name.localeCompare(b.name);
      case 'nameDesc': return b.name.localeCompare(a.name);
      case 'createdDesc': return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      case 'createdAsc': return (a.createdAt ?? 0) - (b.createdAt ?? 0);
      default: return 0;
    }
  });

  let modifiedData = false;
  rows.forEach(p => {
    if ((p.marchLeft === 0) && !p.notified) {
      const idx = state.players.findIndex(x => x.id === p.id);
      if (idx !== -1) {
        state.players[idx].notified = true;
        modifiedData = true;
        flashRowOnce(p.id);
        beep(220, 660);
      }
    }
    if ((p.buffLeft === 0) && !p.buffNotified) {
      const idx = state.players.findIndex(x => x.id === p.id);
      if (idx !== -1) {
        state.players[idx].buffNotified = true;
        modifiedData = true;
        flashRowOnce(p.id);
        beep(140, 1100);
      }
    }
  });

  if (modifiedData) save();

  els.playersBody.innerHTML = rows.map(rowHtml).join('');

  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (els.nowClockSame) els.nowClockSame.textContent = nowStr;
  if (els.nowClockGap) els.nowClockGap.textContent = nowStr;

  updateCachedOptions();
}

function flashRowOnce(id) {
  requestAnimationFrame(() => {
    const tr = document.querySelector(`tr[data-id="${id}"]`);
    if (tr) {
      tr.classList.add('row-ending');
      setTimeout(() => tr.classList.remove('row-ending'), 3200);
    }
  });
}

function rowHtml(p) {
  const friendlyBadge = `<span class="badge ${p.friendly ? 'friendly' : 'hostile'}">${p.friendly ? 'Friendly' : 'Hostile'}</span>`;
  const marchInfo = `
    <div class="kicker">ETA: ${p.marchEtaSec} sec</div>
    <div class="progress"><div class="bar" style="width:${p.marchPct || 0}%;"></div></div>
  `;
  const petInfo = p.petBuffActive ? `<span class="badge info">Active</span>` : `<span class="tag">Inactive</span>`;
  const marchEnds = p.marchEnd ? formatTime(p.marchEnd) : '—';
  const marchLeft = p.marchLeft != null ? formatDuration(p.marchLeft) : '—';
  const buffLeftStr = p.petBuffActive ? (p.buffLeft != null ? formatDuration(p.buffLeft) : '—') : '—';

  const marchWarn = (p.marchLeft != null && p.marchLeft <= ALERT_CONFIG.marchWarnSeconds * 1000 && p.marchLeft > 0);
  const buffWarn = (p.buffLeft != null && p.buffLeft <= ALERT_CONFIG.buffWarnSeconds * 1000 && p.buffLeft > 0);

  const trClass = `status-row ${p.friendly ? 'friendly' : 'hostile'}${(marchWarn || buffWarn) ? ' status-warn' : ''}`;
  const trData = `data-id="${p.id}"`;

  return `
  <tr class="${trClass}" ${trData}>
    <td>
      <div style="display:flex; align-items:center; gap:8px;">
        <strong style="color: #fff; font-size: 15px;">${escapeHtml(p.name)}</strong>
      </div>
      <div class="kicker">Added: ${new Date(p.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
    </td>
    <td>${escapeHtml(p.target || '—')}</td>
    <td>${friendlyBadge}</td>
    <td>${marchInfo}</td>
    <td>${marchEnds}</td>
    <td style="font-weight:600; color: ${marchWarn ? 'var(--warn)' : '#fff'};">${marchLeft}</td>
    <td>${petInfo}</td>
    <td>
      ${p.petBuffActive ? `
        <div class="kicker">Est: ${p.petBuffMinutes} min</div>
        <div class="progress"><div class="bar" style="width:${p.buffPct || 0}%; background: linear-gradient(90deg, #10b981, #34d399);"></div></div>
        <div class="kicker" style="margin-top:6px; font-weight:600; color: ${buffWarn ? 'var(--warn)' : 'var(--muted)'}">Left: ${buffLeftStr}</div>
      ` : `
        <div class="kicker">Est: ${p.petBuffMinutes || 0} min</div>
      `}
    </td>
    <td>
      <div class="cell-actions">
        ${p.marchEnd ? `
          <button class="btn danger" data-action="stop-march" data-id="${p.id}">Stop</button>
        ` : `
          <button class="btn primary" data-action="start-march" data-id="${p.id}">Start</button>
        `}
        ${p.petBuffActive ? `
          <button class="btn danger" data-action="stop-buff" data-id="${p.id}">Stop buff</button>
        ` : `
          <button class="btn ghost" data-action="start-buff" data-id="${p.id}">Start buff</button>
        `}
        <button class="btn ghost" data-action="edit" data-id="${p.id}">Edit</button>
        <button class="btn danger" data-action="remove" data-id="${p.id}">✕</button>
      </div>
    </td>
  </tr>
  `;
}

function escapeHtml(s) {
  if (!s) return s;
  return String(s).replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}

// ---- calculators utilities ----
function buildPlayerOptionsHtml() {
  if (!state.players || !state.players.length) return `<option value="">— no players —</option>`;
  return `<option value="">(choose player)</option>` + state.players.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${p.marchEtaSec}s)</option>`).join('');
}

function createRallyInputRow(container, type) {
  const current = container.querySelectorAll('.rally-row').length;
  if (current >= 10) {
    alert('Max 10 rallies allowed.');
    return;
  }

  const row = document.createElement('div');
  row.className = 'rally-row';
  
  row.innerHTML = `
    <select class="rallyName">${buildPlayerOptionsHtml()}</select>
    <input class="rallyMarch" type="number" placeholder="March (s)" min="0" />
    <input class="rallyLeft" type="number" placeholder="Depart in (s)" min="0" />
    <div class="rally-controls"><button class="btn danger removeRow" tabindex="-1">✕</button></div>
  `;

  row.querySelector('.removeRow').addEventListener('click', () => row.remove());
  row.querySelector('.rallyName').addEventListener('change', (ev) => {
    const pid = ev.target.value;
    const marchInput = row.querySelector('.rallyMarch');
    if (!pid) return; 
    const p = state.players.find(x => x.id === pid);
    if (p) marchInput.value = Number(p.marchEtaSec || 0);
  });

  container.appendChild(row);
  return row;
}

function updateCachedOptions() {
  const optsHtml = buildPlayerOptionsHtml();
  [...document.querySelectorAll('#sameTimeInputs .rally-row select, #gapInputs .rally-row select')].forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = optsHtml;
    if (cur) sel.value = cur;
  });
}

function clearContainer(container) {
  container.innerHTML = '';
}

// ---- events ----
function initEvents() {
  els.playerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = els.playerName.value.trim();
    const target = els.target.value.trim();
    const marchEtaSec = Number(els.marchSeconds.value);
    const friendly = els.friendly.checked;
    const petBuffActive = els.petBuffActive.checked;
    const petBuffMinutes = Number(els.petBuffMinutes.value || 0);
    const startNow = els.startNow.checked;

    if (!name || isNaN(marchEtaSec) || marchEtaSec < 0) {
      alert('Please provide a valid name and march ETA (seconds).');
      return;
    }

    const player = {
      id: uid(),
      createdAt: now(),
      name,
      target,
      friendly,
      marchEtaSec,
      marchStart: null,
      marchEnd: null,
      petBuffActive,
      petBuffMinutes,
      petBuffStart: null,
      petBuffEnd: null,
      notified: false,
      buffNotified: false,
    };

    if (startNow) {
      const ts = now();
      const mMs = secToMs(player.marchEtaSec);
      const bMs = minToMs(player.petBuffMinutes);
      player.marchStart = mMs ? ts : null;
      player.marchEnd = mMs ? ts + mMs : null;
      player.petBuffStart = petBuffActive && bMs ? ts : null;
      player.petBuffEnd = petBuffActive && bMs ? ts + bMs : null;
    }

    addPlayer(player);
    els.playerForm.reset();
  });

  els.playersBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    switch (action) {
      case 'start-march': startMarch(id); break;
      case 'stop-march': stopMarch(id); break;
      case 'start-buff': startBuff(id); break;
      case 'stop-buff': stopBuff(id); break;
      case 'edit': openEdit(id); break;
      case 'remove': removePlayer(id); break;
    }
  });

  // Calculators state
  let lastCalcResults = []; // to store chronological copy-paste data

  els.addRallySameTime.addEventListener('click', () => createRallyInputRow(els.sameTimeInputs, 'same'));
  els.clearSameTime.addEventListener('click', () => {
    clearContainer(els.sameTimeInputs);
    els.sameTimeTable.querySelector('tbody').innerHTML = '';
    if(els.copySameTime) els.copySameTime.style.display = 'none';
  });
  
  els.calcSameTime.addEventListener('click', () => {
    const rows = [...els.sameTimeInputs.querySelectorAll('.rally-row')];
    if (rows.length < 1) return alert('Add at least one rally.');
    const nowTs = now();
    const items = rows.map(r => {
      const pid = r.querySelector('.rallyName').value;
      const march = Number(r.querySelector('.rallyMarch').value || 0);
      const left = Number(r.querySelector('.rallyLeft').value || 0);
      const name = pid ? (state.players.find(p => p.id === pid)?.name ?? '(unknown)') : '(manual)';
      return { pid, name, march, left };
    });
    
    // Add buffer seconds to our target hit time so everyone departs later!
    const bufferSec = els.sameTimeBuffer ? Number(els.sameTimeBuffer.value || 0) : 0;
    const hits = items.map(it => ({ ...it, hitAt: nowTs + secToMs(it.left + it.march) }));
    const targetHit = Math.max(...hits.map(h => h.hitAt)) + (bufferSec * 1000);
    
    beepSuccess();
    const tbody = els.sameTimeTable.querySelector('tbody');
    lastCalcResults = []; // reset results
    
    tbody.innerHTML = hits.map(h => {
      const requiredLeftSec = Math.max(0, Math.round((targetHit - nowTs) / 1000) - Number(h.march));
      const callDiff = requiredLeftSec - Number(h.left); 
      const note = callDiff >= 0 ? `<span style="color:var(--friendly-text)">Call in ${callDiff}s</span>` : `<span style="color:var(--warn)">Already late by ${Math.abs(callDiff)}s</span>`;
      
      const reqDate = new Date(nowTs + requiredLeftSec * 1000);
      const requiredDepartAt = reqDate.toLocaleTimeString();
      const expectedHitTime = new Date(nowTs + (Number(h.left) + Number(h.march)) * 1000).toLocaleTimeString();
      
      lastCalcResults.push({ name: h.name, date: reqDate });
      
      return `
        <tr>
          <td><strong>${escapeHtml(h.name)}</strong></td>
          <td>${Number(h.march)}s</td>
          <td>${Number(h.left)}s</td>
          <td>${expectedHitTime}</td>
          <td><strong>${requiredLeftSec}s</strong> <div class="kicker">${requiredDepartAt}</div></td>
          <td>${note}</td>
        </tr>
      `;
    }).join('');
    
    if(els.copySameTime) els.copySameTime.style.display = 'inline-flex';
  });

  if (els.copySameTime) {
    els.copySameTime.addEventListener('click', () => {
      if (!lastCalcResults.length) return;
      
      // Sort chronologically
      lastCalcResults.sort((a,b) => a.date - b.date);
      
      const maxNameLen = Math.max(...lastCalcResults.map(r => r.name.length), 0);
      
      let lines = [];
      let lastMin = null;
      
      lastCalcResults.forEach(r => {
        const d = r.date;
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        const minStr = `${hh}:${mm}`;
        
        if (lastMin !== null && lastMin !== minStr) {
            lines.push(''); // blank line group separator
        }
        lastMin = minStr;
        
        const timeStr = `${hh}:${mm}:${ss}`;
        const paddedName = r.name.padEnd(maxNameLen, ' ');
        lines.push(`${timeStr} ・・・ ${paddedName} ・・・・・`);
      });
      
      const copyStr = lines.join('\n');
      navigator.clipboard.writeText(copyStr).then(() => {
        const originalText = els.copySameTime.innerHTML;
        els.copySameTime.innerHTML = '✅ Copied!';
        beepSuccess();
        setTimeout(() => { els.copySameTime.innerHTML = originalText; }, 2000);
      }).catch(err => {
        alert('Failed to copy to clipboard.');
      });
    });
  }

  els.addRallyGap.addEventListener('click', () => createRallyInputRow(els.gapInputs, 'gap'));
  els.clearGap.addEventListener('click', () => {
    clearContainer(els.gapInputs);
    els.gapTable.querySelector('tbody').innerHTML = '';
  });
  els.calcGap.addEventListener('click', () => {
    const rows = [...els.gapInputs.querySelectorAll('.rally-row')];
    if (rows.length < 1) return alert('Add at least one rally.');
    const nowTs = now();
    const items = rows.map(r => {
      const pid = r.querySelector('.rallyName').value;
      const march = Number(r.querySelector('.rallyMarch').value || 0);
      const left = Number(r.querySelector('.rallyLeft').value || 0);
      const name = pid ? (state.players.find(p => p.id === pid)?.name ?? '(unknown)') : '(manual)';
      const hitFromNowSec = march + left;
      return { pid, name, march, left, hitFromNowSec, hitAtTs: nowTs + secToMs(march + left) };
    });
    const minHit = Math.min(...items.map(i => i.hitFromNowSec));
    beepSuccess();
    const tbody = els.gapTable.querySelector('tbody');
    tbody.innerHTML = items.map(it => {
      return `
        <tr>
          <td><strong>${escapeHtml(it.name)}</strong></td>
          <td>${it.march}s</td>
          <td>${it.left}s</td>
          <td>${Math.round(it.hitFromNowSec)}s <div class="kicker">${new Date(it.hitAtTs).toLocaleTimeString()}</div></td>
          <td><span style="color:var(--warn)">+${(it.hitFromNowSec - minHit).toFixed(1)}s</span></td>
        </tr>
      `;
    }).join('');
  });

  const debouncedRender = debounce(render, 250);
  ['input', 'change'].forEach(ev => {
    els.searchInput.addEventListener(ev, debouncedRender);
    els.filterFriendly.addEventListener(ev, render);
    els.sortBy.addEventListener(ev, render);
  });

  els.clearFinished.addEventListener('click', clearFinished);
  els.startAll.addEventListener('click', startAllCountdowns);

  els.clearAll.addEventListener('click', () => {
    if (confirm('Clear all players tracked?')) {
      state.players = [];
      save(); render();
    }
  });

  els.addQuickDemo.addEventListener('click', () => {
    const demo = [
      { name: 'RAD', target: 'Castle', friendly: true, marchEtaSec: 45, petBuffActive: true, petBuffMinutes: 120 },
      { name: 'Warlord', target: 'South East Turret', friendly: false, marchEtaSec: 20, petBuffActive: false, petBuffMinutes: 0 },
      { name: 'Echo', target: 'North West Turret', friendly: true, marchEtaSec: 12, petBuffActive: true, petBuffMinutes: 120 },
    ];
    demo.forEach(d => addPlayer({
      id: uid(),
      createdAt: now(),
      ...d,
      marchStart: null, marchEnd: null,
      petBuffStart: null, petBuffEnd: null,
      notified: false,
      buffNotified: false,
    }));
    
    // Add examples to calculators
    if (!els.sameTimeInputs.querySelector('.rally-row')) createRallyInputRow(els.sameTimeInputs, 'same');
    if (!els.gapInputs.querySelector('.rally-row')) createRallyInputRow(els.gapInputs, 'gap');
  });

  els.exportData.addEventListener('click', exportData);
  els.importData.addEventListener('click', () => els.importFile.click());
  els.importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = '';
  });

  els.editCancel.addEventListener('click', () => els.editDialog.close());
  els.editForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = els.editId.value;
    const patch = {
      name: els.editName.value.trim(),
      target: els.editTarget.value.trim(),
      friendly: els.editFriendly.checked,
      marchEtaSec: Number(els.editMarchSeconds.value || 0),
      petBuffActive: els.editPetActive.checked,
      petBuffMinutes: Number(els.editPetMinutes.value || 0),
      notified: false,
      buffNotified: false,
    };
    updatePlayer(id, patch);
    els.editDialog.close();
  });
  
  els.helpBtn.addEventListener('click', () => els.instructionsDialog.showModal());
  els.closeInstructions.addEventListener('click', () => els.instructionsDialog.close());

  els.compactToggle.addEventListener('change', (e) => {
    state.settings.compact = e.target.checked;
    document.body.classList.toggle('compact', e.target.checked);
    saveSettings();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) render();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) return;
    if (e.key === '/') {
      e.preventDefault();
      els.searchInput.focus();
      return;
    }
    if (e.key.toLowerCase() === 's') { startAllCountdowns(); return; }
    if (e.key.toLowerCase() === 'c') { clearFinished(); return; }
  });
}

function openEdit(id) {
  const p = state.players.find(x => x.id === id);
  if (!p) return;
  els.editId.value = p.id;
  els.editName.value = p.name;
  els.editTarget.value = p.target || '';
  els.editFriendly.checked = !!p.friendly;
  els.editMarchSeconds.value = Number(p.marchEtaSec || 0);
  els.editPetActive.checked = !!p.petBuffActive;
  els.editPetMinutes.value = Number(p.petBuffMinutes || 0);
  els.editDialog.showModal();
}

function exportData() {
  const blob = new Blob([JSON.stringify({ version: DATA_VERSION, exportedAt: now(), players: state.players }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `march-tracker-${new Date().toISOString().slice(0,19)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed?.players && Array.isArray(parsed.players)) {
        state.players = parsed.players.map(p => ({
          ...p,
          notified: false,
          buffNotified: false,
        }));
        save(); render();
      } else if (Array.isArray(parsed)) {
        state.players = parsed.map(p => ({ ...p, notified: false, buffNotified: false }));
        save(); render();
      } else {
        alert('Invalid file format.');
      }
    } catch (err) {
      alert('Could not parse JSON.');
    }
  };
  reader.readAsText(file);
}

function tickLoop(ts) {
  const last = state.timers.lastTick || 0;
  if (!last) {
    state.timers.lastTick = ts;
  }
  const elapsed = ts - state.timers.lastTick;
  if (elapsed >= 900) { 
    render();
    state.timers.lastTick = ts;
  }
  state.timers.rafId = requestAnimationFrame(tickLoop);
}

function startTickers() {
  if (!state.timers.rafId) state.timers.rafId = requestAnimationFrame(tickLoop);
}

function debounce(fn, ms = 200) {
  let id = null;
  return (...args) => {
    if (id) clearTimeout(id);
    id = setTimeout(() => { id = null; fn(...args); }, ms);
  };
}

function init() {
  load();
  initEvents();
  startTickers();
  render();
}

window.__marchTracker = { state, save, load, beep };
