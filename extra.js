'use strict';

/* ============================================================
   Life OS — espace Travail (série + Pomodoro), Candidatures,
   récap hebdomadaire et petits composants partagés.
   Chargé avant app.js : ce fichier ne fait que définir des fonctions.
   ============================================================ */

const WORK_MS = 25 * 60e3;
const BREAK_MS = 5 * 60e3;

/* ---------- Composants partagés ---------- */

function weekLabel(mon) {
  const cur = mondayOf(today());
  if (mon === cur) return 'Cette semaine';
  if (mon === addDays(cur, -7)) return 'Semaine dernière';
  if (mon === addDays(cur, 7)) return 'Semaine prochaine';
  return 'Semaine du ' + fmtDate(mon, { day: 'numeric', month: 'short' });
}
const weekRange = (mon) => `${fmtDate(mon, { day: 'numeric', month: 'short' })} → ${fmtDate(addDays(mon, 6), { day: 'numeric', month: 'short' })}`;

// Barre « ‹ titre › » utilisée pour changer de semaine ou de mois.
function navBar(action, title, sub, canNext) {
  return `<div class="nav">
    <button data-a="${action}" data-id="-1" aria-label="Précédent">‹</button>
    <div><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>
    <button data-a="${action}" data-id="1" ${canNext ? '' : 'disabled'} aria-label="Suivant">›</button>
  </div>`;
}

// Courbe en SVG. points : [{ v: 0..1 ou null, label: '' }]
function lineChart(points) {
  const W = 320, H = 150, L = 30, R = 10, T = 10, B = 24;
  const n = points.length;
  const x = (i) => L + (n > 1 ? (i * (W - L - R)) / (n - 1) : (W - L - R) / 2);
  const y = (v) => T + (1 - v) * (H - T - B);
  let grid = '';
  for (const g of [0, 0.5, 1]) grid += `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" class="g"/><text x="${L - 6}" y="${y(g) + 4}" text-anchor="end">${g * 100}</text>`;
  // Segments continus (une valeur null coupe la courbe)
  const segs = []; let seg = [];
  points.forEach((p, i) => { if (p.v == null) { if (seg.length) segs.push(seg); seg = []; } else seg.push(i); });
  if (seg.length) segs.push(seg);
  let paths = '';
  for (const s of segs) {
    const line = s.map((i, k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(points[i].v).toFixed(1)}`).join(' ');
    if (s.length > 1) paths += `<path class="area" d="${line} L${x(s[s.length - 1]).toFixed(1)} ${y(0)} L${x(s[0]).toFixed(1)} ${y(0)} Z"/><path class="line" d="${line}"/>`;
    if (s.length === 1 || n <= 14) paths += s.map((i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(points[i].v).toFixed(1)}" r="3"/>`).join('');
  }
  const last = [...points.keys()].reverse().find((i) => points[i].v != null);
  if (last != null) paths += `<circle class="last" cx="${x(last).toFixed(1)}" cy="${y(points[last].v).toFixed(1)}" r="5"/>`;
  const labels = points.map((p, i) => (p.label ? `<text x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(p.label)}</text>` : '')).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe de progression">${grid}${paths}${labels}</svg>`;
}

/* ============================================================
   Onglet Travail : série de jours + Pomodoro
   ============================================================ */

const workDay = (d) => S.work.days[d] || {};
const workDone = (d) => { const w = workDay(d); return !!(w.pomos || w.manual); };

function workStreak() {
  let d = logicalDay(); let n = 0;
  const doneToday = workDone(d);
  if (!doneToday) d = addDays(d, -1);
  while (workDone(d)) { n++; d = addDays(d, -1); }
  return { n, doneToday, pending: !doneToday && n > 0 };
}
function workBest() {
  const days = Object.keys(S.work.days).filter(workDone).sort();
  let best = 0, run = 0, prev = '';
  for (const d of days) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return best;
}

const pomoLeft = () => (S.pomo.running ? Math.max(0, S.pomo.endAt - Date.now()) : S.pomo.left);
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`; };
const hmin = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${pad(min % 60)}` : `${min} min`);
const POMO_C = 2 * Math.PI * 88;

function viewWork() {
  const cur = logicalDay();
  const st = workStreak();
  const best = Math.max(workBest(), st.n);
  const mon = mondayOf(cur);
  const state = st.n === 0 ? 'cold' : st.pending ? 'pending' : 'hot';
  const msg = state === 'cold' ? 'Lance une session pour allumer ta flamme.'
    : state === 'pending' ? 'Ta série s’éteint ce soir si tu ne travailles pas aujourd’hui.'
    : 'Journée validée. La chaîne continue !';

  let html = `<section class="card flame ${state}">
      <div class="flame-main">
        <span class="flame-emoji">${st.n >= 100 ? '💯' : '🔥'}</span>
        <b class="flame-num">${st.n}</b>
        ${state === 'pending' ? '<span class="flame-hour">⏳</span>' : ''}
      </div>
      <p class="flame-label">jour${st.n > 1 ? 's' : ''} de travail d’affilée</p>
      <p class="flame-msg">${msg}</p>
      <div class="week flames">${DOW.map((l, i) => {
        const d = addDays(mon, i);
        return `<div class="${d === cur ? 'today' : ''}"><span>${l}</span><i class="${workDone(d) ? 'lit' : d > cur ? 'future' : ''}">${workDone(d) ? '🔥' : ''}</i></div>`;
      }).join('')}</div>
      <div class="flame-foot"><span>Record : <b>${best} jour${best > 1 ? 's' : ''}</b></span>
      ${st.doneToday
        ? (workDay(cur).manual && !workDay(cur).pomos ? '<button class="link inline-link" data-a="workManual">Annuler la validation</button>' : '<span class="chip green">Aujourd’hui ✓</span>')
        : '<button class="btn small" data-a="workManual">J’ai travaillé aujourd’hui</button>'}</div>
    </section>`;

  /* Pomodoro */
  const p = S.pomo;
  const total = p.phase === 'work' ? WORK_MS : BREAK_MS;
  const left = pomoLeft();
  const pomos = workDay(cur).pomos || 0;
  const weekPomos = DOW.reduce((s, _, i) => s + (workDay(addDays(mon, i)).pomos || 0), 0);
  const started = p.running || left < total;
  html += `<section class="card pomo ${p.phase} ${p.running ? 'run' : ''}">
      <div class="card-h"><h2>Pomodoro</h2><span class="chip ${p.phase === 'work' ? '' : 'green'}">${p.phase === 'work' ? 'Travail · 25 min' : 'Pause · 5 min'}</span></div>
      <div class="pomo-ring">
        <svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="88"/><circle id="pomoRing" class="fill" cx="100" cy="100" r="88" stroke-dasharray="${POMO_C}" stroke-dashoffset="${POMO_C * (1 - left / total)}"/></svg>
        <div class="pomo-time"><b id="pomoTime">${mmss(left)}</b><span>${p.running ? (p.phase === 'work' ? 'Concentration' : 'Pause en cours') : started ? 'En pause' : 'Prêt'}</span></div>
      </div>
      <div class="pomo-btns">
        ${p.running ? '<button class="btn primary" data-a="pomoPause">Pause</button>' : `<button class="btn primary" data-a="pomoStart">${started ? 'Reprendre' : 'Démarrer'}</button>`}
        <button class="btn" data-a="pomoReset">${p.phase === 'break' ? 'Passer la pause' : 'Réinitialiser'}</button>
      </div>
      <div class="pomo-stats">
        <div><b>${pomos ? '🍅'.repeat(Math.min(pomos, 8)) + (pomos > 8 ? ' +' + (pomos - 8) : '') : '—'}</b><small>aujourd’hui · ${hmin(pomos * 25)}</small></div>
        <div><b>${weekPomos}</b><small>cette semaine · ${hmin(weekPomos * 25)}</small></div>
      </div>
      <p class="hint">Garde l’app ouverte pendant la session : l’écran reste allumé et un signal sonore retentit à la fin. iOS ne peut pas sonner si l’app est en arrière-plan.</p>
    </section>`;
  return html;
}

/* ---------- Moteur du minuteur ---------- */

let audioCtx = null;
function unlockAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) { /* pas de son disponible */ }
}
function chime(up) {
  if (!audioCtx) return;
  const notes = up ? [784, 988, 1175, 1568] : [1175, 988, 784];
  for (let rep = 0; rep < 2; rep++) notes.forEach((f, i) => {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    const s = audioCtx.currentTime + rep * 1.4 + i * 0.24;
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.4, s + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.7);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(s); o.stop(s + 0.75);
  });
}
function notify(title, body) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !navigator.serviceWorker) return;
    navigator.serviceWorker.ready.then((r) => r.showNotification(title, { body, icon: 'icon-180.png', tag: 'pomodoro' })).catch(() => {});
  } catch (e) { /* notifications indisponibles */ }
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* non pris en charge */ }
}
function flash(kind) {
  document.body.classList.add('flash-' + kind);
  setTimeout(() => document.body.classList.remove('flash-' + kind), 1600);
}

// Fait avancer le minuteur : fin de session → pause automatique → retour à « prêt ».
// Fonctionne aussi quand l'app revient après avoir été en arrière-plan.
function pomoSync() {
  const p = S.pomo; let changed = false;
  while (p.running && Date.now() >= p.endAt) {
    changed = true;
    const fresh = Date.now() - p.endAt < 5000;
    if (p.phase === 'work') {
      const d = ymd(new Date(p.endAt - DAY_START_HOUR * 3600e3));
      const w = (S.work.days[d] = S.work.days[d] || {});
      w.pomos = (w.pomos || 0) + 1;
      p.phase = 'break'; p.endAt += BREAK_MS;
      if (fresh) { chime(true); flash('work'); notify('Session terminée 🍅', '25 minutes de travail validées. Place à 5 minutes de pause.'); }
      toast('Session terminée 🍅 — 5 min de pause');
    } else {
      p.phase = 'work'; p.running = false; p.left = WORK_MS; p.endAt = 0;
      if (fresh) { chime(false); flash('break'); notify('Pause terminée', 'Prêt pour une nouvelle session de 25 minutes ?'); }
      toast('Pause terminée — prêt pour la suite ?');
      keepAwake(false);
    }
  }
  return changed;
}
function pomoPaint() {
  const el = document.getElementById('pomoTime');
  if (!el) return;
  const left = pomoLeft();
  const total = S.pomo.phase === 'work' ? WORK_MS : BREAK_MS;
  el.textContent = mmss(left);
  document.getElementById('pomoRing').setAttribute('stroke-dashoffset', POMO_C * (1 - left / total));
}
function pomoTick() {
  if (!S.pomo.running) return;
  if (pomoSync()) { save(); render(true); }
  pomoPaint();
}

/* ============================================================
   Onglet Candidatures
   ============================================================ */

const APP_STATUS = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'sent', label: 'Envoyée' },
  { id: 'interview', label: 'Entretien' },
  { id: 'ok', label: 'Acceptée' },
  { id: 'ko', label: 'Refusée' },
];
const APP_KINDS = ['École', 'Concours', 'Stage', 'Emploi', 'Projet', 'Autre'];
const appLabel = (s) => (APP_STATUS.find((x) => x.id === s) || APP_STATUS[0]).label;
const appOpen = (a) => a.status === 'todo' || a.status === 'doing';
const appWaiting = (a) => a.status === 'sent' || a.status === 'interview';

function viewApps() {
  const t = today();
  const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.at - b.at;
  const open = S.apps.filter(appOpen).sort(byDue);
  const waiting = S.apps.filter(appWaiting).sort(byDue);
  const closed = S.apps.filter((a) => !appOpen(a) && !appWaiting(a)).sort((a, b) => b.at - a.at);
  const next = open.find((a) => a.due);

  const row = (a) => {
    const late = appOpen(a) && a.due && a.due < t;
    const n = a.due ? dayDiff(a.due, t) : null;
    return `<li class="app s-${a.status}">
      <div class="datebox ${appOpen(a) && n != null && n <= 7 ? 'hot' : ''}">${a.due ? `<b>${parseYmd(a.due).getDate()}</b><small>${parseYmd(a.due).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</small>` : '<b>—</b><small>libre</small>'}</div>
      <div class="what">
        <b>${esc(a.title)}</b>
        <small class="${late ? 'late' : ''}">${esc(a.kind)}${a.due ? ' · ' + (appOpen(a) ? esc(countdown(a.due)) : esc(fmtDate(a.due))) : ''}</small>
        <label class="status s-${a.status}"><select data-c="appStatus" data-id="${a.id}" aria-label="Statut">${APP_STATUS.map((s) => `<option value="${s.id}" ${s.id === a.status ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      </div>
      ${appOpen(a) || appWaiting(a) ? `<button class="pin ${a.pinned ? 'on' : ''}" data-a="pinApp" data-id="${a.id}" aria-label="Épingler">${ICON.pin}</button>` : ''}
      <button class="ghost" data-a="delApp" data-id="${a.id}" aria-label="Supprimer">${ICON.trash}</button>
    </li>`;
  };

  let html = `<section class="card stats3">
      <div><b>${open.length}</b><small>à préparer</small></div>
      <div><b>${waiting.length}</b><small>en attente</small></div>
      <div class="${next && next.due < t ? 'neg' : ''}"><b>${next ? esc(countdown(next.due)) : '—'}</b><small>prochaine échéance</small></div>
    </section>`;

  html += card('Nouvelle candidature', `<form class="stack" data-f="addApp">
      <input name="title" placeholder="Ex. ESSEC — dossier AST, Stage chez…" autocomplete="off" enterkeyhint="done">
      <div class="two">
        <label>Type<select name="kind">${APP_KINDS.map((k) => `<option>${k}</option>`).join('')}</select></label>
        <label>Date limite<input type="date" name="due"></label>
      </div>
      <button class="btn primary wide">Ajouter la candidature</button>
    </form>`);

  html += card('À préparer', open.length ? `<ul class="rows">${open.map(row).join('')}</ul>` : empty('Aucune candidature à préparer.'), `<span class="count">trié par urgence</span>`);
  if (waiting.length) html += card('Envoyées, en attente de réponse', `<ul class="rows">${waiting.map(row).join('')}</ul>`, `<span class="count">${waiting.length}</span>`);
  if (closed.length) {
    html += card('Clôturées', UI.appsClosed ? `<ul class="rows">${closed.map(row).join('')}</ul><button class="link" data-a="appsClosed">Masquer</button>`
      : `<button class="link first" data-a="appsClosed">Afficher les ${closed.length} candidature${closed.length > 1 ? 's' : ''} clôturée${closed.length > 1 ? 's' : ''}</button>`, `<span class="count">${closed.filter((a) => a.status === 'ok').length} acceptée${closed.filter((a) => a.status === 'ok').length > 1 ? 's' : ''}</span>`);
  }
  return html;
}

/* ============================================================
   Récap hebdomadaire
   ============================================================ */

// Séances cochées, avec leur date et leur titre (y compris celles cochées avant cette version).
function workoutsDone(a, b) {
  const known = {};
  for (const w of workoutList(S.cal.events)) known[w.key] = w;
  const out = [];
  for (const [k, v] of Object.entries(S.wk.done)) {
    const info = typeof v === 'object' && v ? v : {};
    const date = info.date || (known[k] && known[k].date) || (k.startsWith('e:') ? k.split('|').pop() : '');
    const title = info.title || (known[k] && known[k].title) || 'Séance';
    if (date && date >= a && date <= b) out.push({ date, title });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date));
}

function computeRecap(mon) {
  const sun = addDays(mon, 6);
  const cur = logicalDay();
  const days = DOW.map((_, i) => addDays(mon, i));
  const inWeek = (ts) => { const d = ymd(new Date(ts)); return d >= mon && d <= sun; };
  const pomos = days.reduce((s, d) => s + (workDay(d).pomos || 0), 0);
  const moves = [];
  for (const a of S.apps) for (const l of (a.log || []).slice(1)) if (inWeek(l.at)) moves.push({ title: a.title, status: l.s });
  return {
    mon, sun,
    habitRate: habitRate(mon, sun),
    perfectDays: days.filter((d) => d <= cur && habitFull(d)).length,
    habits: S.habitList.filter((h) => days.some((d) => activeHabits(d).includes(h)))
      .map((h) => ({ icon: h.icon, title: h.title, n: days.filter((d) => (S.habits[d] || {})[h.id]).length, total: days.filter((d) => d <= cur && activeHabits(d).includes(h)).length })),
    workouts: workoutsDone(mon, sun),
    pomos, workDays: days.filter(workDone).length, streak: workStreak().n,
    tasksDone: S.tasks.filter((x) => x.done && x.doneAt && inWeek(x.doneAt)),
    appsNew: S.apps.filter((a) => inWeek(a.at)),
    appsMoves: moves,
    fin: finRange(mon, sun),
    li: S.li.history.find((h) => h.week === mon),
  };
}

function openRecap(mon) {
  UI.recapWeek = mon;
  const r = computeRecap(mon);
  const curMon = mondayOf(today());
  const pct = r.habitRate == null ? null : Math.round(r.habitRate * 100);
  const bal = r.fin.in - r.fin.out;
  const list = (items) => (items.length ? `<ul class="recap-list">${items.join('')}</ul>` : '');
  const tile = (icon, title, big, sub, extra, tone) => `<div class="tile ${tone || ''}">
      <div class="tile-h"><span>${icon}</span>${title}</div>
      <b class="tile-big">${big}</b>
      ${sub ? `<p>${sub}</p>` : ''}${extra || ''}
    </div>`;

  $('#sheetBody').innerHTML = `
    <div class="grab"></div>
    <p class="over">Récap de la semaine</p>
    ${navBar('recapWeek', weekLabel(mon), weekRange(mon), mon < curMon)}
    <div class="tiles">
      ${!modOn('habits') ? '' : tile('✅', 'Habitudes', pct == null ? '—' : pct + ' %', pct == null ? 'Aucune habitude suivie cette semaine.' : `de réussite · ${r.perfectDays} journée${r.perfectDays > 1 ? 's' : ''} parfaite${r.perfectDays > 1 ? 's' : ''}`,
        list(r.habits.map((h) => `<li><span>${h.icon} ${esc(h.title)}</span><b>${h.n}/${h.total}</b></li>`)), pct != null && pct >= 80 ? 'good' : '')}
      ${!blockOn('sport') ? '' : tile('💪', 'Sport', r.workouts.length, `séance${r.workouts.length > 1 ? 's' : ''} effectuée${r.workouts.length > 1 ? 's' : ''}`,
        list(r.workouts.map((w) => `<li><span>${esc(cap(fmtDate(w.date, { weekday: 'long' })))}</span><b>${esc(w.title)}</b></li>`)), r.workouts.length ? 'good' : '')}
      ${!modOn('work') ? '' : tile('🔥', 'Travail', r.pomos, `session${r.pomos > 1 ? 's' : ''} Pomodoro · ${hmin(r.pomos * 25)}`,
        list([`<li><span>Jours travaillés</span><b>${r.workDays}/7</b></li>`, `<li><span>Série en cours</span><b>🔥 ${r.streak}</b></li>`]), r.workDays >= 5 ? 'good' : '')}
      ${!blockOn('todo') ? '' : tile('📝', 'Tâches', r.tasksDone.length, `tâche${r.tasksDone.length > 1 ? 's' : ''} terminée${r.tasksDone.length > 1 ? 's' : ''}`,
        list(r.tasksDone.slice(0, 6).map((x) => `<li><span>✓ ${esc(x.title)}</span></li>`)))}
      ${!modOn('apps') ? '' : tile('🎯', 'Candidatures', r.appsNew.length + r.appsMoves.length, `avancée${r.appsNew.length + r.appsMoves.length > 1 ? 's' : ''} cette semaine`,
        list(r.appsNew.map((a) => `<li><span>${esc(a.title)}</span><b>ajoutée</b></li>`).concat(r.appsMoves.map((m) => `<li><span>${esc(m.title)}</span><b>${esc(appLabel(m.status))}</b></li>`))))}
      ${!modOn('fin') ? '' : tile('💶', 'Finances', (bal > 0 ? '+' : '') + eur(bal), 'solde de la semaine',
        list([`<li><span>Gagné</span><b class="amt in">+${eur(r.fin.in)}</b></li>`, `<li><span>Dépensé</span><b class="amt out">−${eur(r.fin.out)}</b></li>`]), bal < 0 ? 'bad' : bal > 0 ? 'good' : '')}
      ${!modOn('li') ? '' : tile('🤝', 'LinkedIn', r.li ? 'Fait ✓' : 'Pas fait', r.li ? esc(r.li.who || r.li.role) + (r.li.who ? ' · ' + esc(r.li.role) : '') : 'Aucun contact validé cette semaine.', '', r.li ? 'good' : '')}
    </div>
    <button class="btn wide" data-a="closeSheet">Fermer</button>`;
  $('#sheet').hidden = false;
  $('#sheetBody').scrollTop = 0;
}

// Le dimanche, le récap s'ouvre tout seul à la première ouverture de l'app.
function maybeSundayRecap() {
  const t = today();
  if (parseYmd(t).getDay() !== 0) return;
  const mon = mondayOf(t);
  if (S.recapSeen === mon) return;
  if (!$('#splash').hidden || !$('#sheet').hidden) return;   // après l'écran de lancement
  S.recapSeen = mon; save();
  setTimeout(() => openRecap(mon), 300);
}

/* ============================================================
   Actions et formulaires de ces écrans (fusionnés dans app.js)
   ============================================================ */

const EXTRA_ACTIONS = {
  pomoStart() {
    unlockAudio();
    S.pomo.running = true; S.pomo.endAt = Date.now() + S.pomo.left;
    keepAwake(true);
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) { /* rien */ }
  },
  pomoPause() { S.pomo.left = pomoLeft(); S.pomo.running = false; keepAwake(false); },
  pomoReset() { S.pomo = { phase: 'work', running: false, endAt: 0, left: WORK_MS }; keepAwake(false); },
  workManual() {
    const d = logicalDay();
    const w = (S.work.days[d] = S.work.days[d] || {});
    w.manual = !w.manual;
    if (w.manual) toast('Journée validée 🔥');
  },

  pinApp(id) {
    const a = S.apps.find((x) => x.id === id); if (!a) return;
    a.pinned = !a.pinned;
    toast(a.pinned ? 'Épinglé 📌 — affiché à chaque ouverture' : 'Épingle retirée');
  },
  delApp(id) {
    const a = S.apps.find((x) => x.id === id);
    if (a && confirm(`Supprimer la candidature « ${a.title} » ?`)) S.apps = S.apps.filter((x) => x.id !== id);
  },
  appsClosed() { UI.appsClosed = !UI.appsClosed; },

  recap(id) { openRecap(id === 'last' ? addDays(mondayOf(today()), -7) : mondayOf(today())); },
  recapWeek(delta) { openRecap(addDays(UI.recapWeek || mondayOf(today()), 7 * Number(delta))); },
};

const EXTRA_FORMS = {
  addApp(f) {
    const title = f.title.trim();
    if (!title) { toast('Donne un nom à la candidature'); return false; }
    S.apps.push({ id: uid(), title, kind: f.kind || 'Autre', due: f.due || '', status: 'todo', pinned: false, at: Date.now(), log: [{ s: 'todo', at: Date.now() }] });
    toast('Candidature ajoutée');
  },
};

// Menus déroulants (événement « change »)
const EXTRA_CHANGES = {
  appStatus(id, value) {
    const a = S.apps.find((x) => x.id === id); if (!a || a.status === value) return;
    a.status = value;
    (a.log = a.log || []).push({ s: value, at: Date.now() });
    if (!appOpen(a) && !appWaiting(a)) a.pinned = false;
    toast('Statut : ' + appLabel(value));
  },
};
