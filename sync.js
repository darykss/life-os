'use strict';

/* ============================================================
   Synchronisation entre appareils (téléphone, ordinateur…).

   Les données restent sur chaque appareil, et une copie est tenue à jour
   dans la feuille Google de l'utilisateur, via son script (même adresse
   /exec que l'agenda). L'état est découpé en « parties » (une par clé de
   SYNC_KEYS). Chaque partie porte l'heure de sa dernière modification :
   quand deux appareils ont changé la même partie, la plus récente gagne.

   Chaque synchro se fait en deux temps : l'appareil envoie ses parties
   modifiées, puis lit l'heure de chaque partie en ligne et reçoit celles
   qui sont plus récentes que les siennes.
   Chargé avant shell.js et app.js ; ne fait rien si APP.sync est absent.
   ============================================================ */

// Parties synchronisées. L'agenda, les actualités et le minuteur restent propres à chaque appareil.
const SYNC_KEYS = ['settings', 'pins', 'tasks', 'wk', 'li', 'habits', 'fin', 'habitList', 'work', 'apps', 'modules', 'tabOrder', 'dlCats', 'evCat'];
const SYNC_MUSCU = '_muscu';   // données de l'app Séances, rangées à part dans le stockage de l'appareil

const syncOn = () => !!APP.sync && S.sync.on && !!S.settings.gcalUrl;
const muscuRaw = () => localStorage.getItem(KEY + '.muscu') || '';
function syncHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return str.length + ':' + h;
}

let syncSnap = null;   // dernière image connue de chaque partie, pour repérer ce qui change
let syncTimer = 0;
let syncBusy = false;

function syncInit() {
  syncSnap = {};
  for (const k of SYNC_KEYS) syncSnap[k] = JSON.stringify(S[k]);
}

function syncStamp(k) {
  S.sync.t[k] = Math.max(Date.now(), (S.sync.t[k] || 0) + 1);
  S.sync.dirty[k] = 1;
}

// Appelé à chaque enregistrement : note les parties qui viennent de changer.
function syncTrack() {
  if (!syncSnap || !APP.sync) return;
  let changed = false;
  for (const k of SYNC_KEYS) {
    const now = JSON.stringify(S[k]);
    if (now === syncSnap[k]) continue;
    syncSnap[k] = now;
    if (S.sync.on) { syncStamp(k); changed = true; }
  }
  if (changed) syncSoon();
}

// Lance une synchro quelques secondes après le dernier changement.
function syncSoon() {
  if (!syncOn()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncNow, 3000);
}

const syncUrl = () => S.settings.gcalUrl.trim();
// « Load failed » (Safari) ou « Failed to fetch » (Chrome) : la requête n'a pas abouti.
const syncErr = (e) => (navigator.onLine === false ? 'hors ligne' : /load failed|failed to fetch|networkerror/i.test(e && e.message) ? 'script Google injoignable (connexion, ou déploiement à refaire)' : (e && e.message) || 'erreur');

// Envoi d'une partie. On n'attend pas de réponse lisible : certains navigateurs (Safari) refusent de lire
// la réponse d'un envoi vers un script Google. La lecture qui suit confirme que l'envoi est bien arrivé.
function syncPush(k, item) {
  return fetch(syncUrl(), {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'sync', keys: { [k]: item } }),
  });
}

// Lecture : le script renvoie l'heure de chaque partie en ligne (index) et la valeur de celles
// qui sont plus récentes que les nôtres. Même chemin que l'agenda, qui marche sur tous les appareils.
async function syncPull(times) {
  const u = syncUrl();
  const res = await fetch(u + (u.includes('?') ? '&' : '?') + 'sync=1&t=' + encodeURIComponent(JSON.stringify(times)), { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Script Google à mettre à jour'); }
  if (data && data.ok === false && data.error) throw new Error(data.error);
  if (!data || data.ok !== true || !data.index) throw new Error('Script Google à mettre à jour');
  return data;
}

function syncApply(k, v) {
  if (k === SYNC_MUSCU) {
    if (v == null) return;
    const raw = JSON.stringify(v);
    localStorage.setItem(KEY + '.muscu', raw);
    S.sync.mh = syncHash(raw);
    const f = $('#seancesFrame');
    if (f && f.getAttribute('src')) f.setAttribute('src', 'seances.html');   // recharge l'app Séances avec les nouvelles données
    return;
  }
  if (v == null) return;
  const plain = typeof DEFAULTS[k] === 'object' && !Array.isArray(DEFAULTS[k]);
  S[k] = plain ? Object.assign(JSON.parse(JSON.stringify(DEFAULTS[k])), v) : v;
  syncSnap[k] = JSON.stringify(S[k]);
}

// Envoie les parties modifiées ici et applique celles modifiées ailleurs. Renvoie true si tout s'est bien passé.
async function syncNow() {
  clearTimeout(syncTimer);
  if (!syncOn() || syncBusy || !syncSnap) return false;
  if (UI.seances) return false;               // pas pendant qu'on utilise Séances : ses données partiront en la refermant
  syncBusy = true;
  let ok = false;
  try {
    const raw = muscuRaw();
    if (syncHash(raw) !== S.sync.mh) { S.sync.mh = syncHash(raw); if (raw) syncStamp(SYNC_MUSCU); }

    // 1. Envoi, une partie à la fois : si l'une échoue, les autres passent quand même.
    const sent = {};
    let pushErr = null;
    for (const k of Object.keys(S.sync.dirty)) {
      let v;
      if (k === SYNC_MUSCU) { try { v = JSON.parse(raw); } catch (e) { v = null; } } else v = S[k];
      if (v == null) { delete S.sync.dirty[k]; continue; }
      sent[k] = S.sync.t[k];
      try { await syncPush(k, { t: sent[k], v }); } catch (e) { pushErr = e; }
    }

    // 2. Lecture : confirme ce qui est arrivé et rapporte ce que les autres appareils ont changé.
    const data = await syncPull(S.sync.t);
    let failed = 0;
    for (const k of Object.keys(sent)) {
      if (S.sync.t[k] !== sent[k]) continue;                       // encore modifié entre-temps : repartira au prochain tour
      if ((data.index[k] || 0) >= sent[k]) delete S.sync.dirty[k]; else failed++;
    }
    let applied = 0;
    for (const [k, x] of Object.entries(data.keys || {})) {
      if (k !== SYNC_MUSCU && !SYNC_KEYS.includes(k)) continue;
      if (S.sync.dirty[k] && S.sync.t[k] >= x.t) continue;         // modifié ici plus récemment : c'est cette version qui sera envoyée
      syncApply(k, x.v);
      S.sync.t[k] = x.t;
      delete S.sync.dirty[k];
      applied++;
    }
    S.sync.at = Date.now();
    S.sync.error = failed ? 'envoi non confirmé' + (pushErr ? ' — ' + syncErr(pushErr) : '') : '';
    ok = !failed;
    save();
    if (applied) render(true);
  } catch (e) {
    S.sync.error = syncErr(e);
    save();
  }
  syncBusy = false;
  if (ok && Object.keys(S.sync.dirty).length) syncSoon();
  return ok;
}

// Interrupteur des réglages.
async function syncToggle() {
  const repaint = () => { const box = $('#modRows'); if (box) box.innerHTML = moduleRowsInner(); };
  if (S.sync.on) {
    S.sync.on = false;
    save(); repaint();
    toast('Synchronisation arrêtée sur cet appareil');
    return;
  }
  if (!S.settings.gcalUrl) { toast('Colle d’abord l’adresse /exec du script et enregistre'); return; }
  if (syncBusy) return;
  toast('Connexion à ton script Google…');
  let data;
  try { data = await syncPull({}); }
  catch (e) { toast('Synchro impossible : ' + syncErr(e)); return; }

  const online = Object.keys(data.index).length > 0;
  if (online && !confirm('Des données sont déjà synchronisées en ligne.\n\nLes charger sur cet appareil ? Elles remplacent les données de cet appareil.')) return;

  S.sync = { on: true, seq: 0, t: {}, dirty: {}, mh: '', at: 0, error: '' };
  if (!online) {
    // Premier appareil : toutes ses données partent en ligne.
    for (const k of SYNC_KEYS) syncStamp(k);
  } else {
    S.sync.mh = syncHash(muscuRaw());   // les données Séances d'ici ne sont pas renvoyées : celles en ligne les remplacent
  }
  save();
  const ok = await syncNow();
  repaint();
  toast(!ok ? 'Synchro impossible : ' + S.sync.error : online ? 'Données chargées sur cet appareil ✓' : 'Données envoyées en ligne ✓');
}

// Après l'import d'une sauvegarde : c'est elle qui fait foi, elle part vers les autres appareils.
function syncAfterImport() {
  syncInit();
  if (!APP.sync || !S.sync.on) return;
  for (const k of SYNC_KEYS) syncStamp(k);
  S.sync.mh = '';
  save();
  syncSoon();
}
