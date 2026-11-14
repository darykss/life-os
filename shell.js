'use strict';

/* ============================================================
   Coquille de l'app : onglets et modules activables, swipe,
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
  const on = nav.querySelector('button.on');
  if (on && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2, behavior: 'smooth' });
}

// Change d'onglet. dir : 1 = vers la droite, -1 = vers la gauche, 0 = sans animation.
function goTab(id, dir) {
  if (!enabledTabs().includes(id)) id = 'home';
  UI.tab = id; UI.habitDay = null; UI.habitWeek = 0; UI.habitEdit = false; UI.habitEditId = null;
  render();
  window.scrollTo(0, 0);
  const v = $('#view');
  v.classList.remove('slide-l', 'slide-r');
  if (dir) { void v.offsetWidth; v.classList.add(dir > 0 ? 'slide-l' : 'slide-r'); }
}
function swipeTab(delta) {
  const list = enabledTabs();
  const i = list.indexOf(UI.tab) + delta;
  if (i >= 0 && i < list.length) goTab(list[i], delta);
}

/* ---------- Swipe entre les onglets ---------- */

function bindSwipe() {
  let sx = 0, sy = 0, st = 0, ok = false;
  document.addEventListener('touchstart', (e) => {
    const el = e.target;
    ok = e.touches.length === 1 && $('#splash').hidden && $('#sheet').hidden
      && !(el.closest && el.closest('input, textarea, select, #tabs, .no-swipe'));
    if (ok) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); }
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!ok) return;
    ok = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 64 && Math.abs(dx) > 2.2 * Math.abs(dy) && Date.now() - st < 700) swipeTab(dx < 0 ? 1 : -1);
  }, { passive: true });
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
  const f = $('#seancesFrame');
  const show = UI.tab === 'seances';
  f.hidden = !show;
  document.body.classList.toggle('framed', show);
  if (!show) return;
  if (!f.getAttribute('src')) f.setAttribute('src', 'seances.html');
  const top = $('.top').offsetHeight;
  f.style.top = top + 'px';
  f.style.height = Math.max(200, window.innerHeight - top - $('#tabs').offsetHeight) + 'px';
}

/* ============================================================
   Premier lancement et réglages
   ============================================================ */

const switchBtn = (id, on) => `<button type="button" class="switch ${on ? 'on' : ''}" data-a="toggleModule" data-id="${id}" role="switch" aria-checked="${on}"><i></i></button>`;
function moduleRows() {
  const tabs = APP.tabs.filter((t) => t !== 'home').map((t) => `<li><div><b>${TAB_DEFS[t].title}</b><small>${TAB_DEFS[t].desc}</small></div>${switchBtn(t, modOn(t))}</li>`).join('');
  const blocks = Object.keys(BLOCK_DEFS).map((b) => `<li><div><b>${BLOCK_DEFS[b].title}</b><small>${BLOCK_DEFS[b].desc}</small></div>${switchBtn('b_' + b, blockOn(b))}</li>`).join('');
  return `<p class="group">Onglets</p><ul class="toggles">${tabs}</ul><p class="group">Blocs de l’accueil</p><ul class="toggles">${blocks}</ul>`;
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
