'use strict';

/* ============================================================
   Coquille de l'app : onglets et modules activables, glissement,
   écran de lancement (citation + épingles), Actualités,
   Séances de sport, premier lancement et réglages.
   Chargé après extra.js et avant app.js.
   ============================================================ */

/* ---------- Onglets et modules ---------- */

const TAB_DEFS = {
  home: { label: 'Accueil', title: '', icon: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>' },
  work: { label: 'Travail', title: 'Travail', desc: 'Série de jours et Pomodoro', icon: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-1.8.7-3 1.7-4 .3 1.5 1 2.3 1.8 2.5C10 9 10.5 6 12 3z"/>' },
  habits: { label: 'Habitudes', title: 'Habitudes', desc: 'Routine du soir et progression', icon: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.8"/>' },
  seances: { label: 'Séances', title: 'Séances de sport', desc: 'Programmes et suivi de musculation', icon: '<path d="M6.5 6.5v11M17.500 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>' },
  apps: { label: 'Candid.', title: 'Candidatures', desc: 'Suivi des candidatures', icon: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>' },
  li: { label: 'Réseau', title: 'Réseau LinkedIn', desc: 'Un contact LinkedIn par semaine', icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.2a5 5 0 0 1 4.5 5"/>' },
  news: { label: 'Actus', title: 'Actualités', desc: 'Les titres du jour', icon: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/>' },
  fin: { label: 'Finances', title: 'Finances', desc: 'Dépenses, revenus, abonnements', icon: '<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10h19"/><path d="M6.5 14.5h3"/>' },
};
const BLOCK_DEFS = {
  agenda: { title: 'Emploi du temps', desc: 'Programme du jour (Google Agenda)' },
  deadlines: { title: 'Échéances', desc: 'Événements rouges de l’agenda' },
  sport: { title: 'Sport', desc: 'Séances du jour et de la semaine' },
  todo: { title: 'To-do', desc: 'Tâches à faire' },
};

const modOn = (id) => APP.tabs.includes(id) && S.modules[id] !== false;
const blockOn = (id) => S.modules['b_' + id] !== false;
const enabledTabs = () => APP.tabs.filter((t) => t === 'home' || modOn(t));

let tabsSig = '';
function renderTabs() {
  const list = enabledTabs();
  const sig = list.join(',');
  const nav = $('#tabs');
  if (sig !== tabsSig) {
    tabsSig = sig;
    nav.innerHTML = list.map((t) => `<button data-tab="${t}"><svg viewBox="0 0 24 24">${TAB_DEFS[t].icon}</svg><span>${TAB_DEFS[t].label}</span></button>`).join('');
    nav.classList.toggle('scroll', list.length > 5);
  }
  nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === UI.tab));
  const fin = nav.querySelector('button[data-tab="fin"]');
  if (fin) fin.classList.toggle('badge', payOn() && S.fin.pending.length > 0);
  const on = nav.querySelector('button.on');
  if (on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
}

// Change d'onglet sans animation.
function goTab(id) {
  if (pg) pgFinish(0);
  if (!enabledTabs().includes(id)) id = 'home';
  UI.tab = id; UI.habitDay = null; UI.habitWeek = 0; UI.habitEdit = false; UI.habitEditId = null;
  render();
  window.scrollTo(0, 0);
}

/* ---------- Glissement entre les onglets ----------
   Même mécanique que l'app Séances : la page suit le doigt, celle de droite
   arrive par-dessus pendant que celle de gauche recule et s'assombrit.
   Pendant le mouvement, trois « couches » au plus sont affichées :
   -1 (onglet de gauche), 0 (onglet courant) et 1 (onglet de droite). */

let pg = null;      // glissement en cours : { tabs, layers, pos, anim, end }
let pgDrag = null;  // doigt posé : { x0, y0, lock, pts }

const frameTop = () => $('.top').offsetHeight;
function sizeFrame() {
  const f = $('#seancesFrame');
  const top = frameTop();
  f.style.top = top + 'px';
  f.style.height = Math.max(200, window.innerHeight - top - $('#tabs').offsetHeight) + 'px';
}

function pgLayer(tab, isCur) {
  if (tab === 'seances') {
    const f = $('#seancesFrame');
    if (!f.getAttribute('src')) f.setAttribute('src', 'seances.html');
    f.hidden = false; sizeFrame();
    return f;
  }
  const top = frameTop();
  const el = document.createElement('div');
  el.className = 'pg-layer';
  el.style.top = top + 'px';
  const m = document.createElement('main');
  if (isCur) {
    // Copie de l'écran affiché, à la même hauteur de défilement.
    const v = $('#view');
    for (const n of v.childNodes) m.appendChild(n.cloneNode(true));
    m.style.transform = `translateY(${Math.round(v.getBoundingClientRect().top - top)}px)`;
  } else {
    m.innerHTML = viewHtml(tab);
  }
  el.appendChild(m);
  document.body.appendChild(el);
  return el;
}

function pgBegin(left, right) {
  pg = { tabs: { '-1': left, 0: UI.tab, 1: right }, layers: {}, pos: 0, anim: 0, end: 0 };
  pg.layers[0] = pgLayer(UI.tab, true);
  $('#view').style.visibility = 'hidden';
}

function pgChrome(tab) {
  if (pg.shown === tab) return;
  pg.shown = tab;
  $('#title').textContent = tabTitle(tab);
  $('#tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
}

function pgLayout() {
  const p = pg.pos;
  for (const k of [-1, 0, 1]) {
    if (!pg.layers[k]) {
      if (!pg.tabs[k] || (k === 1 ? p <= 0 : p >= 0)) continue;
      pg.layers[k] = pgLayer(pg.tabs[k], false);
    }
    const st = pg.layers[k].style;
    const d = k - p;
    if (d >= 0) {
      st.transform = d ? `translate3d(${(d * 100).toFixed(3)}%,0,0)` : 'translate3d(0,0,0)';
      st.filter = '';
      st.visibility = d >= 1 ? 'hidden' : 'visible';
      pg.layers[k].classList.toggle('incoming', d > 0.001 && d < 1);
    } else {
      const e = Math.max(d, -1);
      st.transform = `translate3d(${(e * 26).toFixed(3)}%,0,0) scale(${(1 + 0.07 * e).toFixed(4)})`;
      st.filter = `brightness(${(1 + 0.62 * e).toFixed(3)})`;
      st.visibility = d <= -1 ? 'hidden' : 'visible';
      pg.layers[k].classList.remove('incoming');
    }
    st.zIndex = 12 + k;
  }
  const shown = Math.round(p);
  if (pg.tabs[shown]) pgChrome(pg.tabs[shown]);
}

// Fin du mouvement : on affiche pour de bon l'onglet d'arrivée et on retire les couches.
function pgFinish(slot) {
  if (!pg) return;
  cancelAnimationFrame(pg.anim);
  const layers = Object.values(pg.layers);
  const tab = pg.tabs[slot];
  pg = null; pgDrag = null;
  if (slot && tab) {
    UI.tab = tab; UI.habitDay = null; UI.habitWeek = 0; UI.habitEdit = false; UI.habitEditId = null;
    render();
    window.scrollTo(0, 0);
  } else syncFrame();   // geste annulé : l'écran d'origine est resté tel quel
  $('#view').style.visibility = '';
  for (const el of layers) {
    if (el.id !== 'seancesFrame') { el.remove(); continue; }
    el.classList.remove('incoming');
    el.style.transform = el.style.filter = el.style.visibility = el.style.zIndex = '';
  }
}

function pgAnimate(target) {
  cancelAnimationFrame(pg.anim);
  pg.end = target;
  const from = pg.pos, dist = Math.abs(target - from);
  if (dist < 0.001) { pgFinish(target); return; }
  const dur = 230 + 170 * Math.min(dist, 2), t0 = performance.now();
  const step = (now) => {
    if (!pg) return;
    const t = Math.min(1, (now - t0) / dur);
    pg.pos = from + (target - from) * (1 - Math.pow(1 - t, 3));
    pgLayout();
    if (t < 1) pg.anim = requestAnimationFrame(step); else pgFinish(target);
  };
  pg.anim = requestAnimationFrame(step);
}

// Toucher un bouton de la barre : même mouvement, vers la gauche ou la droite selon la position de l'onglet.
function slideTo(id) {
  if (pg) pgFinish(pg.end);
  const list = enabledTabs();
  if (id === UI.tab || !list.includes(id) || !$('#splash').hidden || !$('#sheet').hidden) { goTab(id); return; }
  const after = list.indexOf(id) > list.indexOf(UI.tab);
  pgBegin(after ? null : id, after ? id : null);
  pgAnimate(after ? 1 : -1);
}

// Un élément qui défile lui-même à l'horizontale garde son geste.
function scrollsX(el) {
  for (; el && el.nodeType === 1; el = el.parentElement) {
    if (el.scrollWidth > el.clientWidth + 4) {
      const o = el.ownerDocument.defaultView.getComputedStyle(el).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
    }
  }
  return false;
}
function canSwipe(el, inFrame) {
  if (!el || !el.closest || !$('#splash').hidden || !$('#sheet').hidden) return false;
  if (el.closest('input, textarea, select, .no-swipe') || scrollsX(el)) return false;
  // Dans Séances : seulement sur ses écrans, pas pendant une séance en cours ni sur une fiche ouverte.
  if (inFrame) return !!el.closest('#sport-pager') && !el.ownerDocument.body.classList.contains('sheet-open');
  return !el.closest('#tabs, .top');
}

function bindSwipeOn(doc, inFrame) {
  // Dans le cadre Séances, les coordonnées sont celles du cadre, qui bouge avec le doigt : on les ramène à l'écran.
  const pt = (t) => {
    if (!inFrame) return [t.clientX, t.clientY];
    const f = $('#seancesFrame'), r = f.getBoundingClientRect(), k = r.width / (f.clientWidth || 1);
    return [r.left + t.clientX * k, r.top + t.clientY * k];
  };
  doc.addEventListener('touchstart', (e) => {
    pgDrag = null;
    if (e.touches.length !== 1) return;
    if (pg) pgFinish(pg.end);               // un mouvement encore en cours se termine tout de suite
    if (!canSwipe(e.target, inFrame)) return;
    const [x, y] = pt(e.touches[0]);
    pgDrag = { x0: x, y0: y, lock: null, pts: [[performance.now(), x]] };
  }, { passive: true });
  doc.addEventListener('touchmove', (e) => {
    const d = pgDrag;
    if (!d || e.touches.length !== 1) return;
    const [x, y] = pt(e.touches[0]);
    const dx = x - d.x0, dy = y - d.y0;
    if (!d.lock) {
      if (Math.abs(dx) < 7 && Math.abs(dy) < 7) return;
      d.lock = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'x' : 'y';
      if (d.lock === 'x') {
        const list = enabledTabs(), i = list.indexOf(UI.tab);
        pgBegin(list[i - 1] || null, list[i + 1] || null);
      }
    }
    if (d.lock !== 'x' || !pg) return;
    if (e.cancelable) e.preventDefault();
    let p = -dx / (window.innerWidth || 1);
    const lo = pg.tabs[-1] ? -1 : 0, hi = pg.tabs[1] ? 1 : 0;
    if (p < lo) p = lo - Math.min(0.05, (lo - p) * 0.25);
    if (p > hi) p = hi + Math.min(0.05, (p - hi) * 0.25);
    pg.pos = p; pgLayout();
    d.pts.push([performance.now(), x]); if (d.pts.length > 6) d.pts.shift();
  }, { passive: false });
  const end = () => {
    const d = pgDrag; pgDrag = null;
    if (!d || d.lock !== 'x' || !pg) return;
    const a = d.pts[0], b = d.pts[d.pts.length - 1];
    const v = (b[1] - a[1]) / Math.max(1, b[0] - a[0]); // px/ms, > 0 = doigt vers la droite
    let target = 0;
    if (pg.pos > 0.2 || v < -0.35) target = 1;
    else if (pg.pos < -0.2 || v > 0.35) target = -1;
    if (!pg.tabs[target]) target = 0;
    pgAnimate(target);
  };
  doc.addEventListener('touchend', end);
  doc.addEventListener('touchcancel', end);
}

function bindSwipe() {
  bindSwipeOn(document, false);
  const f = $('#seancesFrame');
  f.addEventListener('load', () => { try { bindSwipeOn(f.contentDocument, true); } catch (e) { /* cadre inaccessible */ } });
}

/* ============================================================
   Écran de lancement, à chaque ouverture : citation du jour, puis échéances épinglées.
   Un toucher fait passer à l'élément suivant.
   ============================================================ */

function showSplash() {
  const q = [];
  q.push({ type: 'quote', ...quoteOfDay(today()) });   // à chaque ouverture ; la citation change chaque jour
  for (const p of pinnedItems()) q.push({ type: 'pin', ...p });
  UI.queue = q; UI.qi = 0;
  if (!q.length) { $('#splash').hidden = true; return; }
  paintSplash();
}
function paintSplash() {
  const el = $('#splash');
  const item = UI.queue[UI.qi];
  const n = UI.queue.length;
  const foot = `<div class="splash-foot">${n > 1 ? `<div class="splash-dots">${UI.queue.map((_, i) => `<i class="${i === UI.qi ? 'on' : ''}"></i>`).join('')}</div>` : ''}<span>Touche l’écran pour ${UI.qi < n - 1 ? 'continuer' : 'entrer'}</span></div>`;
  if (item.type === 'quote') {
    const len = item.text.length;
    el.className = 'splash quote';
    el.innerHTML = `<div class="quote-bg"></div><div class="splash-in">
        <div class="quote-tag">Citation du jour</div>
        <blockquote class="${len <= 45 ? 'xl' : len <= 90 ? 'lg' : len <= 140 ? 'md' : 'sm'}">${esc(item.text)}</blockquote>
        ${item.author ? `<cite>${esc(item.author)}</cite>` : ''}
      </div>${foot}`;
  } else {
    const len = item.title.length;
    el.className = 'splash';
    el.innerHTML = `<div class="splash-in">
        <div class="splash-tag">${ICON.pin} Échéance épinglée</div>
        ${item.date ? `<div class="splash-count">${esc(countdown(item.date))}</div>` : ''}
        <div class="splash-title ${len <= 14 ? 'xl' : len <= 30 ? 'lg' : len <= 60 ? 'md' : 'sm'}">${esc(item.title)}</div>
        ${item.date ? `<div class="splash-date">${esc(cap(fmtDate(item.date, { weekday: 'long', day: 'numeric', month: 'long' })))}</div>` : ''}
      </div>${foot}`;
  }
  el.hidden = false;
}
function nextSplash() {
  UI.qi++;
  if (UI.qi < UI.queue.length) paintSplash(); else hideSplash();
}
function hideSplash() {
  const el = $('#splash');
  if (el.hidden) return;
  el.classList.add('out');
  setTimeout(() => { el.hidden = true; el.classList.remove('out'); maybeSundayRecap(); }, 320);
}

/* ============================================================
   Actualités : un fichier news.json est régénéré chaque matin
   par une tâche planifiée GitHub (voir fetch-news.py).
   ============================================================ */

async function fetchNews() {
  if (!modOn('news')) return;
  const urls = [`https://raw.githubusercontent.com/${APP.repo}/main/news.json?d=${today()}`, 'news.json'];
  for (const u of urls) {
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data || !Array.isArray(data.sections)) continue;
      if (!S.news.data || !S.news.data.generatedAt || data.generatedAt >= S.news.data.generatedAt) S.news = { data, at: Date.now() };
      return;
    } catch (e) { /* on essaie la source suivante */ }
  }
}
function ago(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (!isFinite(min) || min < 0) return '';
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  if (min < 48 * 60) return `il y a ${Math.round(min / 60)} h`;
  return `il y a ${Math.round(min / 1440)} j`;
}
function viewNews() {
  const d = S.news.data;
  if (!d || !d.sections.length) {
    return `<section class="card">${empty('Les actualités arrivent chaque matin. Touche « Actualiser » pour réessayer.')}</section>`;
  }
  const g = new Date(d.generatedAt);
  let html = `<p class="hint center">Édition du ${g.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${g.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>`;
  const sel = UI.newsSec && d.sections.some((s) => s.id === UI.newsSec) ? UI.newsSec : d.sections[0].id;
  html += `<div class="chips no-swipe">${d.sections.map((s) => `<button class="${s.id === sel ? 'on' : ''}" data-a="newsSec" data-id="${esc(s.id)}">${esc(s.title)}</button>`).join('')}</div>`;
  const sec = d.sections.find((s) => s.id === sel);
  html += `<ul class="news">${sec.items.map((it) => `<li><a href="${esc(it.link)}" target="_blank" rel="noopener">
      <b>${esc(it.title)}</b>
      ${it.desc ? `<p>${esc(it.desc)}</p>` : ''}
      <small><span class="src">${esc(it.source)}</span>${it.date ? ' · ' + esc(ago(it.date)) : ''}</small>
    </a></li>`).join('')}</ul>`;
  html += '<p class="hint center">Titres issus des flux publics du Monde et de franceinfo. Un toucher ouvre l’article sur le site d’origine.</p>';
  return html;
}

/* ============================================================
   Séances de sport : l'app « Suivi muscu » de raph4L-hypen,
   affichée telle quelle dans un cadre (données sur l'appareil).
   ============================================================ */

function syncFrame() {
  if (pg) return;   // pendant un glissement, les couches gèrent le cadre
  const f = $('#seancesFrame');
  const show = UI.tab === 'seances';
  f.hidden = !show;
  document.body.classList.toggle('framed', show);
  if (!show) return;
  if (!f.getAttribute('src')) f.setAttribute('src', 'seances.html');
  sizeFrame();
}

/* ============================================================
   Premier lancement et réglages
   ============================================================ */

const switchBtn = (id, on) => `<button type="button" class="switch ${on ? 'on' : ''}" data-a="toggleModule" data-id="${id}" role="switch" aria-checked="${on}"><i></i></button>`;
function moduleRows() {
  const tabs = APP.tabs.filter((t) => t !== 'home').map((t) => `<li><div><b>${TAB_DEFS[t].title}</b><small>${TAB_DEFS[t].desc}</small></div>${switchBtn(t, modOn(t))}</li>`).join('');
  const blocks = Object.keys(BLOCK_DEFS).map((b) => `<li><div><b>${BLOCK_DEFS[b].title}</b><small>${BLOCK_DEFS[b].desc}</small></div>${switchBtn('b_' + b, blockOn(b))}</li>`).join('');
  const extras = APP.applePay ? `<p class="group">Fonctions</p><ul class="toggles"><li><div><b>Apple Pay dans Finances</b><small>Récupère tes paiements Apple Pay pour les valider</small></div>${switchBtn('applePay', payOn())}</li></ul>` : '';
  return `<p class="group">Onglets</p><ul class="toggles">${tabs}</ul><p class="group">Blocs de l’accueil</p><ul class="toggles">${blocks}</ul>${extras}`;
}

function openOnboarding() {
  $('#sheetBody').innerHTML = `
    <div class="grab"></div>
    <p class="over">Bienvenue</p>
    <h2>${esc(APP.name)}, ton tableau de bord perso 👋</h2>
    <p class="hint">Tout reste sur ton téléphone : pas de compte, pas de serveur. Choisis ce dont tu as besoin, tu pourras changer d’avis dans les réglages ⚙︎.</p>
    <form class="stack" data-f="onboard">
      <label>Ton prénom
        <input name="name" value="${esc(S.settings.name)}" autocomplete="given-name" placeholder="Prénom">
      </label>
      ${moduleRows()}
      <button class="btn primary wide">C’est parti</button>
    </form>`;
  $('#sheet').hidden = false;
  $('#sheet').classList.add('locked');
}

let agendaScript = '';
function openSettings() {
  $('#sheetBody').innerHTML = `
    <div class="grab"></div>
    <h2>Réglages</h2>
    <form class="stack" data-f="saveSettings">
      <label>Ton prénom
        <input name="name" value="${esc(S.settings.name)}" autocomplete="given-name">
      </label>
      <label>Ta présentation en une phrase (messages LinkedIn)
        <input name="pitch" value="${esc(S.settings.pitch)}" autocomplete="off" placeholder="ex. étudiant en école de commerce">
      </label>
      <label>Lien du script Google Agenda
        <input name="gcalUrl" type="url" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(S.settings.gcalUrl)}" autocomplete="off" autocapitalize="off" spellcheck="false">
      </label>
      <details class="guide">
        <summary>Comment relier mon Google Agenda ? (3 minutes, sur ordinateur)</summary>
        <ol>
          <li>Ouvre <b>script.google.com</b> avec ton compte Google, puis <b>Nouveau projet</b>.</li>
          <li>Copie le script avec le bouton ci-dessous, et colle-le à la place du code affiché (tout sélectionner, puis coller). Enregistre.</li>
          <li>Choisis la fonction <b>autoriser</b> en haut, clique sur <b>Exécuter</b> et accepte l’accès à l’agenda. L’avertissement « application non validée » est normal : c’est ton propre script (Paramètres avancés › Accéder au projet).</li>
          <li><b>Déployer › Nouveau déploiement</b>, type <b>Application Web</b>, exécuter en tant que <b>Moi</b>, accès <b>Tout le monde</b>, puis <b>Déployer</b>.</li>
          <li>Copie l’adresse qui se termine par <b>/exec</b>, colle-la dans le champ ci-dessus et enregistre.</li>
        </ol>
        <button type="button" class="btn wide" data-a="copyScript">${ICON.copy} Copier le script</button>
        <p class="hint">Le script ne fait que lire ton agenda. L’adresse /exec permet de le consulter : garde-la pour toi. Les événements en rouge (couleur « Tomate ») deviennent tes échéances.</p>
      </details>
      <details class="guide">
        <summary>Comment recevoir une notification de rappel de mes échéances ?</summary>
        <p class="hint">Une app web ne peut pas envoyer de notification quand elle est fermée. C’est l’app Raccourcis de l’iPhone qui s’en charge : chaque matin, elle demande à ton script Google les échéances rouges des prochains jours et les affiche en notification.</p>
        <ol>
          <li>Mets d’abord ton <b>script Google à jour</b> (bouton « Copier le script » plus haut, puis <b>Déployer › Gérer les déploiements › Modifier › Nouvelle version</b>).</li>
          <li>Sur l’iPhone : <b>Raccourcis</b> › <b>Automatisation</b> › <b>+</b> › <b>Heure de la journée</b>. Choisis l’heure (ex. 08:00), <b>Tous les jours</b>, <b>Exécuter immédiatement</b>, puis <b>Nouvelle automatisation vierge</b>.</li>
          <li>Ajoute l’action <b>Obtenir le contenu de l’URL</b> et colle l’adresse copiée avec le bouton ci-dessous.</li>
          <li>Ajoute l’action <b>Si</b> : « Contenu de l’URL » <b>contient une valeur</b>. À l’intérieur, ajoute <b>Afficher la notification</b> avec la variable « Contenu de l’URL » comme texte. Termine.</li>
        </ol>
        <button type="button" class="btn wide" data-a="copyRappel">${ICON.copy} Copier l’adresse des rappels</button>
        <p class="hint">Le chiffre à la fin de l’adresse est le nombre de jours regardés (3 par défaut). Les jours sans échéance, rien ne s’affiche.</p>
      </details>
      ${APP.applePay ? `<details class="guide">
        <summary>Comment envoyer mes paiements Apple Pay dans Finances ?</summary>
        <p class="hint">À faire une fois. Chaque paiement fait avec l’iPhone ou l’Apple Watch arrive ensuite dans Finances, où tu le valides ou l’ignores.</p>
        <ol>
          <li><b>Mettre à jour le script Google</b> (sur ordinateur) : copie le script avec le bouton ci-dessous, ouvre ton projet sur <b>script.google.com</b>, remplace tout le code et enregistre.</li>
          <li>Choisis la fonction <b>autoriser</b>, clique sur <b>Exécuter</b> et accepte le nouvel accès à Google Sheets : le script crée la feuille « Life OS – Paiements » dans ton Drive.</li>
          <li><b>Déployer › Gérer les déploiements › Modifier (crayon) › Version : Nouvelle version › Déployer</b>. L’adresse /exec ne change pas.</li>
          <li>Sur l’iPhone : app <b>Raccourcis</b> › <b>Automatisation</b> › <b>+</b> › <b>Transaction</b>. Coche ta ou tes cartes, laisse toutes les catégories, choisis <b>Exécuter immédiatement</b>, puis <b>Suivant</b> › <b>Nouvelle automatisation vierge</b>.</li>
          <li>Ajoute l’action <b>Obtenir le contenu de l’URL</b>. Colle ton adresse /exec, touche la flèche pour déplier : <b>Méthode : POST</b>, <b>Corps de la requête : JSON</b>.</li>
          <li>Ajoute trois champs de type <b>Texte</b> : <b>commercant</b>, <b>montant</b> et <b>carte</b>. Pour chacun, choisis la variable <b>Entrée du raccourci</b>, puis touche-la pour sélectionner <b>Commerçant</b>, <b>Montant</b> et <b>Carte ou pass</b>. Termine.</li>
          <li>Pour tester sans payer : dans le script Google, exécute la fonction <b>testPaiement</b>, puis touche Actualiser dans l’app : un paiement de 1,23 € doit apparaître dans Finances.</li>
        </ol>
        <button type="button" class="btn wide" data-a="copyScript">${ICON.copy} Copier le script</button>
        <button type="button" class="btn wide" data-a="copyExec">${ICON.copy} Copier mon adresse /exec</button>
        <p class="hint">Seuls les paiements faits avec l’iPhone ou l’Apple Watch sont captés, pas ceux faits avec la carte physique ni les prélèvements.</p>
      </details>` : ''}
      <label>Mots-clés qui identifient une séance de sport dans l’agenda
        <textarea name="sportKw" rows="3" autocapitalize="off">${esc(S.settings.sportKw)}</textarea>
      </label>
      <button class="btn primary wide">Enregistrer</button>
    </form>
    <h3>Modules</h3>
    <p class="hint">Active ou masque chaque partie de l’app. Rien n’est effacé : un module masqué retrouve ses données quand tu le réactives.</p>
    ${moduleRows()}
    <h3>Sauvegarde</h3>
    <p class="hint">Tes données sont stockées sur ce téléphone uniquement. Exporte-les de temps en temps pour ne rien perdre.</p>
    <div class="two"><button class="btn" data-a="export">Exporter</button><label class="btn filebtn">Importer<input type="file" accept="application/json,.json" id="importFile"></label></div>
    <button class="link" data-a="closeSheet">Fermer</button>`;
  $('#sheet').hidden = false;
  if (!agendaScript) fetch('agenda-script.txt').then((r) => (r.ok ? r.text() : '')).then((t) => { agendaScript = t; }).catch(() => {});
}
function closeSheet() {
  if ($('#sheet').classList.contains('locked')) return; // l'écran de bienvenue se valide avec son bouton
  $('#sheet').hidden = true;
}

Object.assign(EXTRA_ACTIONS, {
  toggleModule(id) {
    const on = S.modules[id] === false;      // état après le clic
    S.modules[id] = on;
    document.querySelectorAll(`.switch[data-id="${id}"]`).forEach((b) => { b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    if (!enabledTabs().includes(UI.tab)) UI.tab = 'home';
  },
  copyScript() {
    if (agendaScript) copyText(agendaScript); else toast('Script indisponible hors ligne, réessaie dans un instant');
  },
  copyRappel() {
    const u = S.settings.gcalUrl;
    if (u) copyText(u + (u.includes('?') ? '&' : '?') + 'rappel=3'); else toast('Relie d’abord ton Google Agenda (champ ci-dessus)');
  },
  copyExec() {
    if (S.settings.gcalUrl) copyText(S.settings.gcalUrl); else toast('Relie d’abord ton Google Agenda (champ ci-dessus)');
  },
  newsSec(id) { UI.newsSec = id; },
  liSector() { /* géré par le menu déroulant */ },
});

Object.assign(EXTRA_FORMS, {
  onboard(f) {
    S.settings.name = f.name.trim();
    S.onboarded = true;
    $('#sheet').classList.remove('locked');
    $('#sheet').hidden = true;
    toast(S.settings.name ? `Bienvenue ${S.settings.name} 👋` : 'Bienvenue 👋');
    setTimeout(showSplash, 400);
  },
});

Object.assign(EXTRA_CHANGES, {
  liSector(_, value) { S.settings.sector = value; S.li.offset = 0; },
});
