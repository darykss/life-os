'use strict';

/* ============================================================
   Life OS — toute la logique de l'app.
   Les données restent sur l'iPhone (localStorage). Seul l'agenda
   vient de l'extérieur, via le script Google Apps Script.
   ============================================================ */

// Garde-fou de mise à jour : si la page en cache est plus ancienne que ce fichier
// (config.js absent), on recharge une fois la page depuis le réseau au lieu de rester bloqué.
if (typeof APP === 'undefined') {
  if (!sessionStorage.getItem('reloadedOnce')) {
    sessionStorage.setItem('reloadedOnce', '1');
    fetch('index.html', { cache: 'reload' }).finally(() => location.reload());
  }
  throw new Error('Page en cache périmée : rechargement.');
}

const KEY = APP.key;   // voir config.js
const DAY_START_HOUR = 5; // la « journée » des habitudes change à 05h00

const DEFAULTS = {
  settings: {
    gcalUrl: '',
    sportKw: 'sport, muscu, musculation, running, run, footing, course à pied, entraînement, entrainement, training, foot, football, natation, vélo, tennis, padel, boxe, crossfit, salle, gym, basket, rugby, yoga, fractionné, sortie longue',
    name: '',
    pitch: APP.pitch,
    sector: APP.sector,
  },
  cal: { events: [], at: 0, error: '' },
  pins: {},
  tasks: [],
  wk: { done: {}, manual: [] },
  li: { history: [], offset: 0 },
  habits: {},
  fin: { entries: [], subs: [] },
  habitList: [],                       // habitudes modifiables (remplies au premier lancement)
  work: { days: {} },                  // { 'AAAA-MM-JJ': { pomos, manual } }
  pomo: { phase: 'work', running: false, endAt: 0, left: 25 * 60e3 },
  apps: [],                            // candidatures
  recapSeen: '',
  modules: {},                         // { onglet ou b_bloc: false } = masqué
  news: { data: null, at: 0 },
  quoteSeen: '',
  onboarded: false,
  lastRefresh: 0,
};

const GCAL_COLORS = { 1: '#7986cb', 2: '#33b679', 3: '#8e24aa', 4: '#e67c73', 5: '#f6bf26', 6: '#f4511e', 7: '#039be5', 8: '#9e9e9e', 9: '#3f51b5', 10: '#0b8043', 11: '#d50000' };

/* ---------- État ---------- */

let S = loadState();
const UI = { queue: [], qi: 0, newsSec: null, habitEditId: null, tab: 'home', habitDay: null, habitWeek: 0, habitEdit: false, chartMode: 'w', agendaDay: null, finMonth: null, appsClosed: false, recapWeek: null, finType: 'out', liMsg: 'note', refreshing: false, pendingRender: false, showDone: false, allDeadlines: false };

function loadState() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { raw = {}; }
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  for (const k of Object.keys(DEFAULTS)) {
    if (raw[k] == null) continue;
    const plain = typeof DEFAULTS[k] === 'object' && !Array.isArray(DEFAULTS[k]);
    out[k] = plain ? Object.assign(out[k], raw[k]) : raw[k];
  }
  // Migrations depuis la première version
  if (!raw.habitList) out.habitList = APP.habits.map((h) => ({ ...h }));
  if (raw.settings || !APP.onboarding) out.onboarded = true;   // déjà installé : pas d'écran de bienvenue
  for (const sub of out.fin.subs) {
    if (!sub.from) { const ts = parseInt(String(sub.id).slice(0, -5), 36); const d = new Date(ts > 1e12 ? ts : Date.now()); sub.from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
  }
  return out;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Sauvegarde impossible (stockage plein ?)'); }
}

/* ---------- Outils ---------- */

const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => ymd(new Date());
const logicalDay = () => ymd(new Date(Date.now() - DAY_START_HOUR * 3600e3));
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const mondayOf = (s) => { const d = parseYmd(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
const dayDiff = (a, b) => Math.round((parseYmd(a) - parseYmd(b)) / 864e5);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (s, opt) => parseYmd(s).toLocaleDateString('fr-FR', opt || { weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const DOW = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function countdown(date) {
  const n = dayDiff(date, today());
  if (n === 0) return "Aujourd'hui";
  if (n === 1) return 'Demain';
  if (n > 1) return 'J-' + n;
  return n === -1 ? 'Hier' : 'En retard';
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { t.hidden = true; }, 2200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e2) { /* rien */ }
    ta.remove();
  }
  toast('Copié ✓');
}

const ICON = {
  pin: '<svg viewBox="0 0 24 24"><path d="M12 17v5"/><path d="M8 3h8l-1 6 3 3v2H6v-2l3-3z"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg>',
};

/* ============================================================
   Agenda Google
   ============================================================ */

const evDay = (e) => (e.allDay ? e.start : ymd(new Date(e.start)));
function evOnDay(e, d) {
  if (!e.allDay) return evDay(e) === d;
  const end = e.end && e.end > e.start ? e.end : addDays(e.start, 1); // fin exclusive
  return e.start <= d && d < end;
}
const evKey = (e) => 'e:' + e.id + '|' + evDay(e);
const evColor = (e) => GCAL_COLORS[e.color] || e.calColor || '#7c5cff';

function isRedHex(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return false;
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16));
  return r >= 195 && g < 95 && b < 95;
}
// Rouge = couleur d'événement « Tomate » (11), ou événement sans couleur propre dans un agenda rouge.
const isRed = (e) => String(e.color) === '11' || (!e.color && isRedHex(e.calColor));

function sportRegex() {
  const kws = S.settings.sportKw.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!kws.length) return null;
  return new RegExp('(^|[^a-zà-ÿ0-9])(' + kws.join('|') + ')([^a-zà-ÿ0-9]|$)', 'i');
}

async function fetchCalendar() {
  const url = S.settings.gcalUrl.trim();
  if (!url) return;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!Array.isArray(data.events)) throw new Error('Réponse inattendue du script');
    S.cal = { events: data.events, at: Date.now(), error: '' };
    syncPins();
  } catch (e) {
    S.cal.error = navigator.onLine === false ? 'Hors ligne' : (e.message || 'Erreur');
  }
}

// Si une échéance épinglée a été déplacée dans l'agenda, l'épingle la suit.
function syncPins() {
  const t = today();
  for (const [k, p] of Object.entries(S.pins)) {
    const exact = S.cal.events.find((e) => evKey(e) === k);
    if (exact) { p.title = exact.title; continue; }
    const moved = S.cal.events.filter((e) => e.id === p.id && evDay(e) >= t).sort((a, b) => evDay(a).localeCompare(evDay(b)))[0];
    if (moved && !S.pins[evKey(moved)]) {
      delete S.pins[k];
      S.pins[evKey(moved)] = { id: moved.id, title: moved.title, date: evDay(moved) };
    }
  }
}

/* ============================================================
   Actualisation : à l'ouverture, à 05h00, et sur le bouton
   ============================================================ */

async function refresh(manual) {
  if (UI.refreshing) return;
  UI.refreshing = true;
  $('#refreshBtn').classList.add('spin');
  await Promise.all([fetchCalendar(), fetchNews()]);
  S.lastRefresh = Date.now();
  cleanup();
  save();
  UI.refreshing = false;
  $('#refreshBtn').classList.remove('spin');
  render(true);
  if (manual) toast(S.cal.error && S.settings.gcalUrl ? 'Agenda : ' + S.cal.error : 'À jour ✓');
}

function cleanup() {
  const t = today();
  for (const [k, p] of Object.entries(S.pins)) if (p.date && p.date < t) delete S.pins[k];
}

function scheduleDailyRefresh() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(DAY_START_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  setTimeout(() => { refresh(); scheduleDailyRefresh(); }, next - now + 1000);
}

/* ============================================================
   Éléments épinglés (l'écran de lancement est dans shell.js)
   ============================================================ */

function pinnedItems() {
  const t = today();
  const out = [];
  for (const p of Object.values(S.pins)) if (!p.date || p.date >= t) out.push({ title: p.title, date: p.date });
  for (const x of S.tasks) if (x.pinned && !x.done) out.push({ title: x.title, date: x.due || '' });
  if (modOn('apps')) for (const a of S.apps) if (a.pinned && (appOpen(a) || appWaiting(a))) out.push({ title: a.title, date: a.due || '' });
  return out.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
}

/* ============================================================
   Rendu
   ============================================================ */

function render(fromRefresh) {
  // Ne pas effacer un champ que l'on est en train de remplir.
  const a = document.activeElement;
  if (fromRefresh && a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { UI.pendingRender = true; return; }
  UI.pendingRender = false;

  if (!enabledTabs().includes(UI.tab)) UI.tab = 'home';
  $('#title').textContent = UI.tab === 'home' ? cap(new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })) : TAB_DEFS[UI.tab].title;
  $('#subtitle').textContent = S.lastRefresh ? 'Actualisé à ' + new Date(S.lastRefresh).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  renderTabs();
  $('#view').innerHTML = { home: viewHome, li: viewLinkedIn, habits: viewHabits, fin: viewFinance, work: viewWork, apps: viewApps, news: viewNews, seances: () => '' }[UI.tab]();
  syncFrame();
}

const card = (title, body, extra) => `<section class="card"><div class="card-h"><h2>${title}</h2>${extra || ''}</div>${body}</section>`;
const empty = (txt) => `<p class="empty">${txt}</p>`;

/* ---------- Onglet 1 : Dashboard ---------- */

function viewHome() {
  const t = today();
  const evs = S.cal.events;
  let html = '';

  const wantCal = blockOn('agenda') || blockOn('deadlines');
  if (!wantCal) { /* agenda masqué */ } else if (!S.settings.gcalUrl) {
    html += `<section class="card connect">
      <h2>Connecte ton Google Agenda</h2>
      <p>Pour afficher ton emploi du temps et tes échéances en rouge, relie ton agenda (3 minutes, une seule fois). Le guide est dans les réglages.</p>
      <button class="btn primary" data-a="settings">Connecter</button>
    </section>`;
  } else if (S.cal.error) {
    html += `<div class="banner">Agenda non actualisé (${esc(S.cal.error)}) — affichage des dernières données connues.</div>`;
  }

  if (parseYmd(t).getDay() === 0) {
    html += `<section class="card connect recap-card">
      <h2>Ton récap de la semaine est prêt 🗓️</h2>
      <p>Habitudes, sport, travail, tâches, candidatures, finances et LinkedIn : le bilan de ta semaine.</p>
      <button class="btn primary" data-a="recap">Voir mon récap</button>
    </section>`;
  }

  if (blockOn('agenda')) {
  /* Emploi du temps : navigation par jour et par semaine */
  const day = UI.agendaDay || t;
  const wmon = mondayOf(day);
  const dayEvs = evs.filter((e) => evOnDay(e, day)).sort((a, b) => (a.allDay ? 0 : 1) - (b.allDay ? 0 : 1) || String(a.start).localeCompare(String(b.start)));
  const now = Date.now();
  const strip = navBar('agendaWeek', weekLabel(wmon), weekRange(wmon), true) + `<div class="days cal">${DOW.map((l, i) => {
    const d = addDays(wmon, i);
    return `<button class="${d === day ? 'on' : ''} ${d === t ? 'today' : ''}" data-a="agendaDay" data-id="${d}">
        <span>${l}</span><i>${parseYmd(d).getDate()}</i><u class="${evs.some((e) => evOnDay(e, d)) ? 'has' : ''}"></u>
      </button>`;
  }).join('')}</div>`;
  html += card(day === t ? "Aujourd'hui" : esc(cap(fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' }))), strip + (dayEvs.length ? `<ul class="agenda">${dayEvs.map((e) => {
    const past = day < t || (day === t && !e.allDay && new Date(e.end) < now);
    const live = day === t && !e.allDay && new Date(e.start) <= now && new Date(e.end) >= now;
    return `<li class="${past ? 'past' : ''} ${live ? 'live' : ''}">
      <div class="when">${e.allDay ? '<span>Journée</span>' : `<span>${fmtTime(e.start)}</span><small>${fmtTime(e.end)}</small>`}</div>
      <i style="background:${esc(evColor(e))}"></i>
      <div class="what"><b>${esc(e.title)}</b>${e.location ? `<small>${esc(e.location)}</small>` : ''}${live ? '<em>En cours</em>' : ''}</div>
    </li>`;
  }).join('')}</ul>` : empty(!S.settings.gcalUrl ? 'Ton programme apparaîtra ici.' : day === t ? 'Rien de prévu aujourd’hui.' : 'Rien de prévu ce jour-là.')),
  day === t ? `<span class="count">${dayEvs.length || ''}</span>` : '<button class="chipbtn" data-a="agendaToday">Aujourd’hui</button>');

  }
  if (blockOn('deadlines')) {
  /* Échéances (événements rouges) */
  const reds = evs.filter((e) => isRed(e) && (evDay(e) >= t || evOnDay(e, t))).sort((a, b) => evDay(a).localeCompare(evDay(b)));
  const shown = UI.allDeadlines ? reds : reds.slice(0, 5);
  html += card('Échéances à venir', reds.length ? `<ul class="rows">${shown.map((e) => {
    const d = evDay(e) < t ? t : evDay(e);
    const k = evKey(e);
    const n = dayDiff(d, t);
    return `<li>
      <div class="datebox ${n <= 3 ? 'hot' : ''}"><b>${parseYmd(d).getDate()}</b><small>${parseYmd(d).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small></div>
      <div class="what"><b>${esc(e.title)}</b><small>${esc(countdown(d))}${e.allDay ? '' : ' · ' + fmtTime(e.start)}</small></div>
      <button class="pin ${S.pins[k] ? 'on' : ''}" data-a="pinEvent" data-id="${esc(k)}" aria-label="Épingler">${ICON.pin}</button>
    </li>`;
  }).join('')}</ul>${reds.length > 5 ? `<button class="link" data-a="toggleDeadlines">${UI.allDeadlines ? 'Voir moins' : `Voir les ${reds.length} échéances`}</button>` : ''}`
    : empty(S.settings.gcalUrl ? 'Aucun événement rouge à venir dans ton agenda.' : 'Les événements en rouge de ton agenda apparaîtront ici.'),
  '<span class="dot red"></span>');

  }
  if (blockOn('sport')) html += viewWorkouts(t, evs);
  if (blockOn('todo')) html += viewTasks(t);
  if (parseYmd(t).getDay() !== 0) html += '<button class="link" data-a="recap" data-id="last">Voir le récap de la semaine dernière</button>';
  return html;
}

function workoutList(evs) {
  const re = sportRegex();
  const list = [];
  if (re) for (const e of evs) if (re.test(e.title)) list.push({ key: evKey(e), title: e.title, date: evDay(e), time: e.allDay ? '' : fmtTime(e.start), manual: false });
  for (const m of S.wk.manual) list.push({ key: 'm:' + m.id, title: m.title, date: m.date, time: '', manual: true });
  return list;
}

function viewWorkouts(t, evs) {
  const mon = mondayOf(t);
  const all = workoutList(evs);
  const todays = all.filter((w) => w.date === t);
  const week = all.filter((w) => w.date >= mon && w.date <= addDays(mon, 6));
  const done = week.filter((w) => S.wk.done[w.key]).sort((a, b) => a.date.localeCompare(b.date));

  let body = todays.length ? `<ul class="rows">${todays.map((w) => `<li>
      <button class="check ${S.wk.done[w.key] ? 'on' : ''}" data-a="toggleWorkout" data-id="${esc(w.key)}" aria-label="Fait">${ICON.check}</button>
      <div class="what ${S.wk.done[w.key] ? 'struck' : ''}"><b>${esc(w.title)}</b><small>${w.time ? 'Prévu à ' + w.time : 'Séance du jour'}</small></div>
      ${w.manual ? `<button class="ghost" data-a="delWorkout" data-id="${esc(w.key)}" aria-label="Supprimer">${ICON.trash}</button>` : ''}
    </li>`).join('')}</ul>` : empty('Pas de séance prévue aujourd’hui.');

  body += `<form class="inline" data-f="addWorkout"><input name="title" placeholder="Ajouter une séance aujourd’hui…" autocomplete="off" enterkeyhint="done"><button class="add" aria-label="Ajouter">${ICON.plus}</button></form>`;

  body += `<div class="week">${DOW.map((l, i) => {
    const d = addDays(mon, i);
    const nDone = week.filter((w) => w.date === d && S.wk.done[w.key]).length;
    const nPlan = week.filter((w) => w.date === d).length;
    return `<div class="${d === t ? 'today' : ''}"><span>${l}</span><i class="${nDone ? 'done' : nPlan ? 'plan' : ''}">${nDone ? ICON.check : ''}</i></div>`;
  }).join('')}</div>`;

  // Récap de la semaine : séances faites + séances passées encore à valider.
  const recap = week.filter((w) => S.wk.done[w.key] || w.date < t).sort((a, b) => a.date.localeCompare(b.date));
  body += recap.length
    ? `<ul class="rows recap">${recap.map((w) => `<li>
        <button class="check ${S.wk.done[w.key] ? 'on' : ''}" data-a="toggleWorkout" data-id="${esc(w.key)}" aria-label="Fait">${ICON.check}</button>
        <div class="what"><b>${esc(w.title)}</b><small>${esc(cap(fmtDate(w.date, { weekday: 'long' })))}${S.wk.done[w.key] ? ' · fait' : ' · à valider si fait'}</small></div>
      </li>`).join('')}</ul>`
    : '<p class="hint">Aucune séance validée cette semaine pour l’instant.</p>';

  return card('Sport', body, `<span class="count">${done.length} cette semaine</span>`);
}

function viewTasks(t) {
  const open = S.tasks.filter((x) => !x.done).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (a.due || '9999').localeCompare(b.due || '9999') || a.at - b.at);
  const done = S.tasks.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const row = (x) => `<li>
      <button class="check ${x.done ? 'on' : ''}" data-a="toggleTask" data-id="${x.id}" aria-label="Terminer">${ICON.check}</button>
      <div class="what ${x.done ? 'struck' : ''}"><b>${esc(x.title)}</b>${x.due ? `<small class="${!x.done && x.due < t ? 'late' : ''}">${esc(countdown(x.due))} · ${esc(fmtDate(x.due))}</small>` : ''}</div>
      ${x.done ? '' : `<button class="pin ${x.pinned ? 'on' : ''}" data-a="pinTask" data-id="${x.id}" aria-label="Épingler">${ICON.pin}</button>`}
      <button class="ghost" data-a="delTask" data-id="${x.id}" aria-label="Supprimer">${ICON.trash}</button>
    </li>`;
  let body = `<form class="task-form" data-f="addTask">
      <input name="title" placeholder="Nouvelle tâche…" autocomplete="off" enterkeyhint="done">
      <div class="task-form-row">
        <label class="datefield"><span>Échéance (optionnelle)</span><input type="date" name="due"></label>
        <button class="btn primary">Ajouter</button>
      </div>
    </form>`;
  body += open.length ? `<ul class="rows">${open.map(row).join('')}</ul>` : empty('Aucune tâche en cours. 🎉');
  if (done.length) {
    body += `<button class="link" data-a="toggleDone">${UI.showDone ? 'Masquer' : 'Afficher'} les ${done.length} terminée${done.length > 1 ? 's' : ''}</button>`;
    if (UI.showDone) body += `<ul class="rows">${done.map(row).join('')}</ul><button class="link danger" data-a="clearDone">Effacer les tâches terminées</button>`;
  }
  return card('To-do', body, `<span class="count">${open.length || ''}</span>`);
}

/* ---------- Onglet 2 : LinkedIn ---------- */

const weekIndex = (mon) => Math.round((parseYmd(mon) - new Date(2024, 0, 1)) / (7 * 864e5));
// Cible de la semaine parmi les profils du secteur choisi (tous les profils défilent avant de revenir).
function weekTarget() {
  const mon = mondayOf(today());
  const pool = LI_TARGETS.filter((x) => S.settings.sector === 'all' || x.cat === S.settings.sector);
  const list = pool.length ? pool : LI_TARGETS;
  const n = list.length;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const step = [13, 11, 7, 5, 1].find((k) => gcd(k, n) === 1);
  const i = (((weekIndex(mon) + S.li.offset) * step) % n + n) % n;
  return { mon, target: list[i] };
}
function isoWeek(s) {
  const d = parseYmd(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const w1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
}

function liMessages(tg) {
  const me = S.settings.name.trim() || '[Ton prénom]';
  const pitch = S.settings.pitch.trim();
  const role = tg.role;
  const note = `Bonjour [Prénom], votre parcours en tant que ${role} m'inspire beaucoup. Auriez-vous 15 min pour échanger sur votre métier ? Merci d'avance ! ${me}`;
  const long = `Bonjour [Prénom],

Je m'appelle ${me}${pitch ? ', ' + pitch : ''}. Je m'intéresse de près à ${LI_CATS[tg.cat].topic}, et votre parcours en tant que ${role} a retenu mon attention.

${tg.ask}

Auriez-vous 15 minutes à m'accorder, par téléphone ou en visio, au moment qui vous arrange ? Votre retour d'expérience me serait très précieux pour affiner mon projet professionnel.

Merci d'avance pour votre temps,
${me}`;
  return { note, long };
}

function liStreak() {
  let n = 0;
  let mon = mondayOf(today());
  const has = (m) => S.li.history.some((h) => h.week === m);
  if (!has(mon)) mon = addDays(mon, -7);
  while (has(mon)) { n++; mon = addDays(mon, -7); }
  return n;
}

function viewLinkedIn() {
  const { mon, target: tg } = weekTarget();
  const doneEntry = S.li.history.find((h) => h.week === mon);
  const shownTg = doneEntry ? (LI_TARGETS.find((x) => x.role === doneEntry.role) || tg) : tg;
  const url = 'https://www.linkedin.com/search/results/people/?keywords=' + encodeURIComponent(shownTg.kw) + '&origin=GLOBAL_SEARCH_HEADER';
  const msgs = liMessages(shownTg);
  const text = UI.liMsg === 'note' ? msgs.note : msgs.long;
  const streak = liStreak();

  let html = `<section class="card slim"><label class="sector">Secteur ciblé
      <select data-c="liSector">
        <option value="all" ${S.settings.sector === 'all' ? 'selected' : ''}>Tous les secteurs</option>
        ${Object.keys(LI_CATS).map((k) => `<option value="${k}" ${S.settings.sector === k ? 'selected' : ''}>${esc(LI_CATS[k].label)}</option>`).join('')}
      </select></label></section>`;
  html += `<section class="card hero ${doneEntry ? 'ok' : ''}">
      <div class="hero-top"><span class="chip">Semaine ${isoWeek(mon)}</span><span class="chip soft">${esc(LI_CATS[shownTg.cat].label)}</span>${doneEntry ? '<span class="chip green">Contact fait ✓</span>' : ''}</div>
      <p class="over">Ta cible de la semaine</p>
      <h2 class="big">${esc(shownTg.role)}</h2>
      <p class="ask">${esc(shownTg.ask)}</p>
      <a class="btn primary wide" href="${esc(url)}" target="_blank" rel="noopener">${ICON.ext} Ouvrir la recherche LinkedIn</a>
      ${doneEntry ? '' : '<button class="link" data-a="liSkip">Proposer une autre cible</button>'}
    </section>`;

  html += card('Message prêt à envoyer', `
      <div class="seg"><button class="${UI.liMsg === 'note' ? 'on' : ''}" data-a="liMsg" data-id="note">Note d’invitation</button><button class="${UI.liMsg === 'long' ? 'on' : ''}" data-a="liMsg" data-id="long">Message complet</button></div>
      <pre class="msg">${esc(text)}</pre>
      <div class="msg-foot"><small class="${UI.liMsg === 'note' && text.length > 200 ? 'late' : ''}">${text.length} caractères${UI.liMsg === 'note' ? ' · limite LinkedIn gratuit : 200' : ''}</small>
      <button class="btn" data-a="liCopy">${ICON.copy} Copier</button></div>
      <p class="hint">Remplace [Prénom] par celui de la personne.${S.settings.name ? '' : ' Renseigne ton prénom dans les réglages ⚙︎ pour signer automatiquement.'}</p>`);

  html += doneEntry
    ? card('Validation', `<p class="okline">${ICON.check}<span>Bravo, contact de la semaine validé${doneEntry.who ? ' : <b>' + esc(doneEntry.who) + '</b>' : ''}.</span></p><button class="link danger" data-a="liUndo">Annuler la validation</button>`)
    : card('Validation', `<form class="stack" data-f="liDone"><input name="who" placeholder="Nom de la personne contactée (optionnel)" autocomplete="off"><button class="btn primary wide">${ICON.check} J’ai contacté quelqu’un cette semaine</button></form>`);

  const hist = S.li.history.slice().sort((a, b) => b.week.localeCompare(a.week));
  html += card('Historique', hist.length ? `<ul class="mini tall">${hist.map((h) => `<li><span>Sem. ${isoWeek(h.week)} · ${esc(fmtDate(h.week, { day: 'numeric', month: 'short' }))}</span><b>${esc(h.who || h.role)}</b>${h.who ? `<small>${esc(h.role)}</small>` : ''}</li>`).join('')}</ul>` : empty('Tes contacts validés apparaîtront ici.'),
  `<span class="count">${streak ? '🔥 ' + streak + ' sem. d’affilée' : hist.length ? hist.length + ' contact' + (hist.length > 1 ? 's' : '') : ''}</span>`);
  return html;
}

/* ---------- Onglet : Habitudes ---------- */

// Une habitude compte pour un jour donné si elle existait déjà et n'avait pas encore été retirée.
const activeHabits = (d) => S.habitList.filter((h) => (!h.from || h.from <= d) && (!h.end || d < h.end));
function habitStat(d) {
  const list = activeHabits(d); const st = S.habits[d] || {};
  return { n: list.filter((h) => st[h.id]).length, total: list.length };
}
const habitFull = (d) => { const s = habitStat(d); return s.total > 0 && s.n === s.total; };
function habitStreak() {
  let d = logicalDay(); let n = 0;
  if (!habitFull(d)) d = addDays(d, -1);
  while (habitFull(d)) { n++; d = addDays(d, -1); }
  return n;
}
function habitFirstDay() {
  const days = Object.keys(S.habits).filter((d) => Object.values(S.habits[d]).some(Boolean)).sort();
  return days[0] || logicalDay();
}
// Taux de réussite entre deux dates incluses ; null si aucune journée suivie sur la période.
function habitRate(a, b, first) {
  first = first || habitFirstDay();
  const cur = logicalDay();
  let n = 0, total = 0;
  for (let d = a < first ? first : a; d <= b && d <= cur; d = addDays(d, 1)) { const s = habitStat(d); n += s.n; total += s.total; }
  return total ? n / total : null;
}
function habitBest() {
  const cur = logicalDay(); let best = 0, run = 0;
  for (let d = habitFirstDay(); d <= cur; d = addDays(d, 1)) { run = habitFull(d) ? run + 1 : 0; best = Math.max(best, run); }
  return best;
}
const habitWeekMon = () => addDays(mondayOf(logicalDay()), 7 * UI.habitWeek);
const habitDefaultDay = () => (UI.habitWeek === 0 ? logicalDay() : addDays(habitWeekMon(), 6));
const habitSelDay = () => UI.habitDay || habitDefaultDay();
const pctTxt = (r) => (r == null ? '—' : Math.round(r * 100) + ' %');

function viewHabits() {
  const cur = logicalDay();
  const mon = habitWeekMon();
  const day = habitSelDay();
  const state = S.habits[day] || {};
  const list = activeHabits(day);
  const { n, total } = habitStat(day);
  const pct = total ? n / total : 0;
  const C = 2 * Math.PI * 52;
  const streak = habitStreak();
  const first = habitFirstDay();

  let html = `<section class="card ring-card">
      <svg class="ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle class="fill ${pct === 1 ? 'full' : ''}" cx="60" cy="60" r="52" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct)}"/></svg>
      <div class="ring-num"><b>${n}</b><span>/ ${total}</span></div>
      <div class="ring-side">
        <h2>${day === cur ? 'Ce soir' : esc(cap(fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })))}</h2>
        <p>${!total ? 'Aucune habitude suivie ce jour-là.' : pct === 1 ? 'Routine complète, bien joué 👏' : n === 0 ? (day === cur ? 'Coche tes habitudes du jour.' : 'Rien de coché ce jour-là.') : `${day === cur ? 'Encore' : 'Il manquait'} ${total - n} pour une journée parfaite.`}</p>
        <span class="chip ${streak ? 'green' : 'soft'}">🔥 ${streak} jour${streak > 1 ? 's' : ''} parfait${streak > 1 ? 's' : ''} d’affilée</span>
      </div>
    </section>`;

  /* Semaine affichée : navigation vers les semaines passées */
  html += `<section class="card">${navBar('habitWeek', weekLabel(mon), weekRange(mon) + ' · ' + pctTxt(habitRate(mon, addDays(mon, 6), first)), UI.habitWeek < 0)}
    <div class="days">${DOW.map((l, i) => {
      const d = addDays(mon, i);
      const s = habitStat(d);
      const future = d > cur;
      return `<button class="${d === day ? 'on' : ''}" data-a="habitDay" data-id="${d}" ${future ? 'disabled' : ''}>
        <span>${l}</span>
        <i class="${future ? '' : habitFull(d) ? 'full' : s.n ? 'part' : ''}" style="--p:${s.total ? s.n / s.total : 0}">${parseYmd(d).getDate()}</i>
      </button>`;
    }).join('')}</div></section>`;

  html += list.length ? `<ul class="habits ${UI.habitEdit ? 'edit' : ''}">${list.map((h) => `<li class="${state[h.id] ? 'on' : ''}" data-a="toggleHabit" data-id="${h.id}">
      <span class="emoji">${esc(h.icon)}</span>
      <div><b>${esc(h.title)}</b>${h.desc ? `<small>${esc(h.desc)}</small>` : ''}</div>
      ${UI.habitEdit ? `<button class="ghost edit" data-a="habitModify" data-id="${h.id}" aria-label="Modifier">${ICON.edit}</button><button class="ghost del" data-a="delHabit" data-id="${h.id}" aria-label="Retirer">${ICON.trash}</button>` : `<span class="tick">${ICON.check}</span>`}
    </li>`).join('')}</ul>` : `<section class="card">${empty('Aucune habitude pour ce jour. Ajoute-en une ci-dessous.')}</section>`;

  const eh = UI.habitEditId ? S.habitList.find((h) => h.id === UI.habitEditId) : null;
  html += UI.habitEdit
    ? card(eh ? 'Modifier l’habitude' : 'Ajouter une habitude', `<form class="stack" data-f="addHabit">
        <div class="emoji-row"><input name="icon" placeholder="🙂" maxlength="4" autocomplete="off" aria-label="Emoji" value="${eh ? esc(eh.icon) : ''}"><input name="title" placeholder="Nom (ex. Lecture)" autocomplete="off" value="${eh ? esc(eh.title) : ''}"></div>
        <input name="desc" placeholder="Objectif (ex. 20 pages) — optionnel" autocomplete="off" enterkeyhint="done" value="${eh ? esc(eh.desc || '') : ''}">
        <button class="btn primary wide">${eh ? 'Enregistrer' : 'Ajouter'}</button>
      </form>
      <p class="hint">✎ modifie une habitude, la corbeille la retire à partir d’aujourd’hui (elle reste dans ton historique).</p>
      <button class="link" data-a="habitEdit">Terminer</button>`)
    : '<button class="link" data-a="habitEdit">Ajouter, modifier ou retirer des habitudes</button>';

  /* La semaine en un coup d'œil */
  const days = DOW.map((_, i) => addDays(mon, i));
  const rowsH = S.habitList.filter((h) => days.some((d) => d <= cur && activeHabits(d).includes(h)));
  if (rowsH.length) {
    html += card('La semaine en un coup d’œil', `<div class="matrix">
        <div class="mrow head"><span></span>${DOW.map((l) => `<i>${l}</i>`).join('')}</div>
        ${rowsH.map((h) => `<div class="mrow"><span>${esc(h.icon)} ${esc(h.title)}</span>${days.map((d) => {
          const on = (S.habits[d] || {})[h.id];
          const off = d > cur || !activeHabits(d).includes(h);
          return `<i class="${off ? 'na' : on ? 'on' : 'miss'}"></i>`;
        }).join('')}</div>`).join('')}
      </div>`);
  }

  /* Courbe de progression */
  let pts;
  if (UI.chartMode === 'w') {
    const m0 = mondayOf(cur);
    pts = Array.from({ length: 12 }, (_, i) => {
      const m = addDays(m0, -7 * (11 - i));
      return { v: addDays(m, 6) < first ? null : habitRate(m, addDays(m, 6), first), label: i === 0 || i === 11 || i === 6 ? fmtDate(m, { day: 'numeric', month: 'short' }) : '' };
    });
  } else {
    pts = Array.from({ length: 30 }, (_, i) => {
      const d = addDays(cur, -(29 - i));
      return { v: d < first ? null : habitRate(d, d, first), label: i === 0 || i === 29 || i === 15 ? fmtDate(d, { day: 'numeric', month: 'short' }) : '' };
    });
  }
  const best = Math.max(habitBest(), streak);
  html += card('Progression', `
      <div class="seg"><button class="${UI.chartMode === 'w' ? 'on' : ''}" data-a="chartMode" data-id="w">12 semaines</button><button class="${UI.chartMode === 'd' ? 'on' : ''}" data-a="chartMode" data-id="d">30 jours</button></div>
      ${lineChart(pts)}
      <div class="stats3 flat">
        <div><b>${pctTxt(habitRate(addDays(cur, -6), cur, first))}</b><small>7 derniers jours</small></div>
        <div><b>${pctTxt(habitRate(addDays(cur, -29), cur, first))}</b><small>30 derniers jours</small></div>
        <div><b>${best} j</b><small>record de jours parfaits</small></div>
      </div>
      <p class="hint">Part des habitudes cochées ${UI.chartMode === 'w' ? 'chaque semaine' : 'chaque jour'}, en %.</p>`);
  html += '<p class="hint center">La journée se termine à 05h00 : tu peux cocher ta routine après minuit.</p>';
  return html;
}

/* ---------- Onglet : Finances ---------- */

const curMonth = () => today().slice(0, 7);
const monthLast = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
// Un abonnement compte à partir du mois où il a été créé, jusqu'au mois où il a été arrêté (exclu).
const subActive = (s, ym) => (!s.from || s.from <= ym) && (!s.end || ym < s.end);
const subDate = (s, ym) => ym + '-' + pad(Math.min(s.day, monthLast(ym)));

// Totaux entre deux dates incluses (au plus deux mois à cheval), abonnements compris.
function finRange(a, b) {
  const r = { in: 0, out: 0, subs: 0 };
  for (const e of S.fin.entries) if (e.date >= a && e.date <= b) r[e.type] += e.amount;
  for (const ym of new Set([a.slice(0, 7), b.slice(0, 7)])) for (const s of S.fin.subs) {
    const d = subDate(s, ym);
    if (subActive(s, ym) && d >= a && d <= b) { r.out += s.amount; r.subs += s.amount; }
  }
  return r;
}

function viewFinance() {
  const t = today();
  const ym = UI.finMonth || curMonth();
  const isCur = ym === curMonth();
  const m0 = ym + '-01', m1 = ym + '-' + pad(monthLast(ym));
  const block = (label, sub, x) => {
    const bal = x.in - x.out;
    const max = Math.max(x.in, x.out, 1);
    return `<section class="card fin">
      <div class="card-h"><h2>${label}</h2><span class="count">${sub}</span></div>
      <div class="bal ${bal < 0 ? 'neg' : 'pos'}">${bal > 0 ? '+' : ''}${eur(bal)}</div>
      <div class="bars">
        <div><span>Gagné</span><i><u class="g" style="width:${(x.in / max) * 100}%"></u></i><b>${eur(x.in)}</b></div>
        <div><span>Dépensé</span><i><u class="r" style="width:${(x.out / max) * 100}%"></u></i><b>${eur(x.out)}</b></div>
      </div>
    </section>`;
  };
  const monthName = cap(parseYmd(m0).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }));
  const M = finRange(m0, m1);
  const prev = finRange(addMonths(ym, -1) + '-01', addMonths(ym, -1) + '-' + pad(monthLast(addMonths(ym, -1))));
  const hasPrev = prev.in || prev.out;

  let html = `<section class="card slim">${navBar('finMonth', monthName, isCur ? 'Mois en cours' : 'Historique', !isCur)}</section>`;
  if (isCur) {
    const mon = mondayOf(t);
    html += block('Cette semaine', weekRange(mon), finRange(mon, addDays(mon, 6)));
  }
  html += block(isCur ? 'Ce mois-ci' : 'Bilan du mois', M.subs ? `dont ${eur(M.subs)} d’abonnements` : '', M);
  if (hasPrev) html += `<p class="hint center">Mois précédent : ${eur(prev.in)} gagnés, ${eur(prev.out)} dépensés.</p>`;

  html += card('Ajouter', `<form class="stack" data-f="addEntry">
      <div class="seg"><button type="button" class="${UI.finType === 'out' ? 'on red' : ''}" data-a="finType" data-id="out">Dépense</button><button type="button" class="${UI.finType === 'in' ? 'on green' : ''}" data-a="finType" data-id="in">Revenu</button></div>
      <div class="two"><input name="amount" inputmode="decimal" placeholder="Montant €" autocomplete="off"><input type="date" name="date" value="${isCur ? t : m1}"></div>
      <input name="label" placeholder="${UI.finType === 'out' ? 'Libellé (ex. Courses)' : 'Libellé (ex. Vente, salaire)'}" autocomplete="off" enterkeyhint="done">
      <button class="btn primary wide">Enregistrer ${UI.finType === 'out' ? 'la dépense' : 'le revenu'}</button>
    </form>`);

  const moves = S.fin.entries.filter((e) => e.date >= m0 && e.date <= m1).map((e) => ({ ...e }))
    .concat(S.fin.subs.filter((s) => subActive(s, ym)).map((s) => ({ id: '', type: 'out', amount: s.amount, label: s.label, date: subDate(s, ym), sub: true })))
    .sort((a, b) => b.date.localeCompare(a.date));
  html += card('Mouvements du mois', moves.length ? `<ul class="rows">${moves.map((e) => `<li>
      <div class="sign ${e.type}">${e.type === 'in' ? '+' : '−'}</div>
      <div class="what"><b>${esc(e.label || (e.type === 'in' ? 'Revenu' : 'Dépense'))}</b><small>${esc(fmtDate(e.date))}${e.sub ? ' · abonnement' : ''}</small></div>
      <b class="amt ${e.type}">${e.type === 'in' ? '+' : '−'}${eur(e.amount)}</b>
      ${e.sub ? '' : `<button class="ghost" data-a="delEntry" data-id="${e.id}" aria-label="Supprimer">${ICON.trash}</button>`}
    </li>`).join('')}</ul>` : empty(isCur ? 'Aucun mouvement ce mois-ci.' : 'Aucun mouvement enregistré ce mois-là.'), `<span class="count">${moves.length || ''}</span>`);

  if (isCur) {
    const subs = S.fin.subs.filter((s) => subActive(s, ym));
    const subsTotal = subs.reduce((x, s) => x + s.amount, 0);
    html += card('Abonnements mensuels', `${subs.length ? `<ul class="rows">${subs.map((s) => `<li>
        <div class="datebox"><b>${s.day}</b><small>/ mois</small></div>
        <div class="what"><b>${esc(s.label)}</b><small>Compté automatiquement chaque mois</small></div>
        <b class="amt out">${eur(s.amount)}</b>
        <button class="ghost" data-a="delSub" data-id="${s.id}" aria-label="Arrêter">${ICON.trash}</button>
      </li>`).join('')}</ul>` : empty('Ajoute tes abonnements fixes (Spotify, salle, forfait…).')}
      <form class="stack" data-f="addSub">
        <input name="label" placeholder="Nom de l’abonnement" autocomplete="off">
        <div class="two"><input name="amount" inputmode="decimal" placeholder="Montant € / mois" autocomplete="off"><input name="day" inputmode="numeric" placeholder="Jour de prélèvement (1-31)" autocomplete="off"></div>
        <button class="btn wide">Ajouter l’abonnement</button>
      </form>`, `<span class="count">${subsTotal ? eur(subsTotal) + ' / mois' : ''}</span>`);
  }
  return html;
}

/* ============================================================
   Actions
   ============================================================ */

const num = (v) => { const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };

const ACTIONS = {
  refresh: () => refresh(true),
  settings: openSettings,
  closeSheet,
  toggleDeadlines: () => { UI.allDeadlines = !UI.allDeadlines; },
  toggleDone: () => { UI.showDone = !UI.showDone; },

  pinEvent(k) {
    if (S.pins[k]) { delete S.pins[k]; toast('Épingle retirée'); return; }
    const e = S.cal.events.find((x) => evKey(x) === k);
    if (!e) return;
    S.pins[k] = { id: e.id, title: e.title, date: evDay(e) < today() ? today() : evDay(e) };
    toast('Épinglé 📌 — affiché à chaque ouverture');
  },
  pinTask(id) {
    const x = S.tasks.find((y) => y.id === id); if (!x) return;
    x.pinned = !x.pinned;
    toast(x.pinned ? 'Épinglé 📌 — affiché à chaque ouverture' : 'Épingle retirée');
  },
  toggleTask(id) {
    const x = S.tasks.find((y) => y.id === id); if (!x) return;
    x.done = !x.done; x.doneAt = x.done ? Date.now() : 0;
  },
  delTask(id) { S.tasks = S.tasks.filter((y) => y.id !== id); },
  clearDone() { S.tasks = S.tasks.filter((y) => !y.done); UI.showDone = false; },

  toggleWorkout(k) {
    if (S.wk.done[k]) { delete S.wk.done[k]; return; }
    const info = workoutList(S.cal.events).find((x) => x.key === k) || {};
    S.wk.done[k] = { at: Date.now(), title: info.title || 'Séance', date: info.date || today() };
    // Une séance faite aujourd'hui coche aussi l'habitude « Sport ».
    if (info.date === today() && S.habitList.some((h) => h.id === 'sport' && !h.end)) { const d = logicalDay(); (S.habits[d] = S.habits[d] || {}).sport = true; }
  },
  delWorkout(k) { S.wk.manual = S.wk.manual.filter((m) => 'm:' + m.id !== k); delete S.wk.done[k]; },

  liMsg(id) { UI.liMsg = id; },
  liSkip() { S.li.offset++; },
  liCopy() {
    const { mon, target } = weekTarget();
    const d = S.li.history.find((h) => h.week === mon);
    const tg = d ? (LI_TARGETS.find((x) => x.role === d.role) || target) : target;
    copyText(liMessages(tg)[UI.liMsg]);
  },
  liUndo() { const { mon } = weekTarget(); S.li.history = S.li.history.filter((h) => h.week !== mon); },

  habitDay(d) { UI.habitDay = d === habitDefaultDay() ? null : d; },
  habitWeek(delta) { UI.habitWeek = Math.min(0, UI.habitWeek + Number(delta)); UI.habitDay = null; },
  habitEdit() { UI.habitEdit = !UI.habitEdit; UI.habitEditId = null; },
  habitModify(id) { UI.habitEditId = UI.habitEditId === id ? null : id; },
  chartMode(id) { UI.chartMode = id; },
  toggleHabit(id) {
    const d = habitSelDay();
    const st = (S.habits[d] = S.habits[d] || {});
    st[id] = !st[id];
    if (st[id] && habitFull(d)) toast('Routine complète 👏');
  },
  delHabit(id) {
    const h = S.habitList.find((x) => x.id === id);
    if (!h || !confirm(`Retirer l’habitude « ${h.title} » ?`)) return;
    const cur = logicalDay();
    // Créée aujourd'hui : on l'efface. Sinon on l'arrête à partir d'aujourd'hui pour garder l'historique.
    if (h.from === cur) S.habitList = S.habitList.filter((x) => x.id !== id); else h.end = cur;
    toast('Habitude retirée');
  },

  agendaDay(d) { UI.agendaDay = d === today() ? null : d; },
  agendaWeek(delta) { const d = addDays(UI.agendaDay || today(), 7 * Number(delta)); UI.agendaDay = d === today() ? null : d; },
  agendaToday() { UI.agendaDay = null; },
  finMonth(delta) { const m = addMonths(UI.finMonth || curMonth(), Number(delta)); UI.finMonth = m >= curMonth() ? null : m; },

  finType(id) { UI.finType = id; },
  delEntry(id) { S.fin.entries = S.fin.entries.filter((e) => e.id !== id); },
  delSub(id) {
    const s = S.fin.subs.find((e) => e.id === id);
    if (!s || !confirm(`Arrêter l’abonnement « ${s.label} » ?`)) return;
    // Créé ce mois-ci : on l'efface. Sinon il reste compté dans les mois passés.
    if (s.from === curMonth()) S.fin.subs = S.fin.subs.filter((e) => e.id !== id); else s.end = curMonth();
  },

  export() {
    let muscu = null;
    try { muscu = JSON.parse(localStorage.getItem(KEY + '.muscu')); } catch (e) { /* rien */ }
    const blob = new Blob([JSON.stringify({ ...S, _muscu: muscu }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${APP.name.toLowerCase().replace(/\s+/g, '-')}-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  },
};
Object.assign(ACTIONS, EXTRA_ACTIONS);
const NO_RENDER = new Set(['refresh', 'settings', 'closeSheet', 'liCopy', 'export', 'recap', 'recapWeek', 'copyScript']);

const FORMS = {
  addTask(f) {
    const title = f.title.trim(); if (!title) return false;
    S.tasks.push({ id: uid(), title, due: f.due || '', done: false, pinned: false, at: Date.now() });
  },
  addWorkout(f) {
    const title = f.title.trim(); if (!title) return false;
    S.wk.manual.push({ id: uid(), title, date: today() });
  },
  liDone(f) {
    const { mon, target } = weekTarget();
    S.li.history.push({ week: mon, role: target.role, who: f.who.trim(), at: Date.now() });
    toast('Contact validé 🤝');
  },
  addEntry(f) {
    const amount = num(f.amount);
    if (!amount) { toast('Indique un montant'); return false; }
    S.fin.entries.push({ id: uid(), type: UI.finType, amount, label: f.label.trim(), date: f.date || today() });
    toast(UI.finType === 'out' ? 'Dépense ajoutée' : 'Revenu ajouté');
  },
  addSub(f) {
    const amount = num(f.amount); const label = f.label.trim();
    if (!label || !amount) { toast('Nom et montant requis'); return false; }
    const day = Math.min(31, Math.max(1, parseInt(f.day, 10) || 1));
    S.fin.subs.push({ id: uid(), label, amount, day, from: curMonth() });
  },
  addHabit(f) {
    const title = f.title.trim();
    if (!title) { toast('Donne un nom à l’habitude'); return false; }
    const eh = UI.habitEditId && S.habitList.find((h) => h.id === UI.habitEditId);
    if (eh) { Object.assign(eh, { icon: f.icon.trim() || eh.icon, title, desc: f.desc.trim() }); UI.habitEditId = null; toast('Habitude modifiée'); return; }
    S.habitList.push({ id: uid(), icon: f.icon.trim() || '✅', title, desc: f.desc.trim(), from: logicalDay() });
    toast('Habitude ajoutée');
  },
  saveSettings(f) {
    const changed = f.gcalUrl.trim() !== S.settings.gcalUrl;
    Object.assign(S.settings, { gcalUrl: f.gcalUrl.trim(), name: f.name.trim(), pitch: f.pitch.trim(), sportKw: f.sportKw.trim() });
    closeSheet();
    toast('Réglages enregistrés');
    if (changed) setTimeout(() => refresh(true), 50);
  },
};

Object.assign(FORMS, EXTRA_FORMS);

document.addEventListener('click', (ev) => {
  const tab = ev.target.closest('#tabs button');
  if (tab) { goTab(tab.dataset.tab, 0); return; }
  if (ev.target.closest('#splash')) { nextSplash(); return; }
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  if (!ACTIONS[a]) return;
  if (el.tagName === 'BUTTON' && el.type !== 'button' && el.closest('form')) ev.preventDefault();
  // Un bouton placé dans un formulaire (ex. Dépense / Revenu) ne doit pas effacer ce qui est déjà saisi.
  const form = el.closest('form[data-f]');
  const typed = form ? Object.fromEntries(new FormData(form).entries()) : null;
  ACTIONS[a](el.dataset.id);
  if (NO_RENDER.has(a)) return;
  save(); render();
  if (typed) {
    const again = $(`form[data-f="${form.dataset.f}"]`);
    if (again) for (const [k, v] of Object.entries(typed)) if (again.elements[k]) again.elements[k].value = v;
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('form[data-f]');
  if (!form) return;
  ev.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  if (document.activeElement) document.activeElement.blur();
  if (FORMS[form.dataset.f](data) === false) return;
  save(); render();
});

document.addEventListener('change', (ev) => {
  const c = ev.target.dataset && ev.target.dataset.c;
  if (c && EXTRA_CHANGES[c]) { EXTRA_CHANGES[c](ev.target.dataset.id, ev.target.value); save(); render(); return; }
  if (ev.target.id !== 'importFile' || !ev.target.files[0]) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !data.settings) throw new Error('format');
      if (!confirm('Remplacer toutes les données de l’app par cette sauvegarde ?')) return;
      if (data._muscu) localStorage.setItem(KEY + '.muscu', JSON.stringify(data._muscu));
      delete data._muscu;
      localStorage.setItem(KEY, JSON.stringify(data));
      S = loadState(); closeSheet(); render(); toast('Sauvegarde importée');
    } catch (e) { toast('Fichier de sauvegarde invalide'); }
  };
  reader.readAsText(ev.target.files[0]);
});

document.addEventListener('focusout', () => { setTimeout(() => { if (UI.pendingRender) render(true); }, 100); });

/* ============================================================
   Cycle de vie : ouverture, retour au premier plan, 05h00
   ============================================================ */

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  const away = Date.now() - hiddenAt;
  if (pomoSync()) { save(); render(true); }  // le minuteur a pu se terminer pendant l'absence
  if (S.pomo.running) keepAwake(true);
  if (away > 20000 && S.onboarded && $('#sheet').hidden) showSplash();   // l'app est rouverte : on réaffiche l'échéance épinglée
  if (away > 5000) refresh();       // et on actualise
  maybeSundayRecap();
});

cleanup();
if (pomoSync()) save();
document.title = APP.name;
render();
if (S.onboarded) showSplash(); else openOnboarding();
refresh();
scheduleDailyRefresh();
maybeSundayRecap();
setInterval(pomoTick, 500);
bindSwipe();
window.addEventListener('resize', syncFrame);

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
