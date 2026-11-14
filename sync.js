'use strict';

/* ============================================================
   Synchronisation entre appareils (téléphone, ordinateur…).

   Les données restent sur chaque appareil, et une copie est tenue à jour
   dans la feuille Google de l'utilisateur, via son script (même adresse
   /exec que l'agenda). L'état est découpé en « parties » (une par clé de
   SYNC_KEYS). Chaque partie porte l'heure de sa dernière modification :
   quand deux appareils ont changé la même partie, la plus récente gagne.

   Un seul échange fait tout : l'appareil envoie ses parties modifiées et
   reçoit celles que les autres appareils ont changées depuis sa dernière
   synchro (numéro `seq` tenu par le script).
   Chargé avant shell.js et app.js ; ne fait rien si APP.sync est absent.
   ============================================================ */

// Parties synchronisées. L'agenda, les actualités et le minuteur restent propres à chaque appareil.
const SYNC_KEYS = ['settings', 'pins', 'tasks', 'wk', 'li', 'habits', 'fin', 'habitList', 'work', 'apps', 'modules', 'tabOrder'];
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

async function syncPost(body) {
  const res = await fetch(S.settings.gcalUrl.trim(), {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // évite la pré-vérification du navigateur, que le script Google ne gère pas
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  let data;
  try { data = await res.json(); } catch (e) { throw new Error('Script Google à mettre à jour'); }
  if (!data || data.ok !== true || typeof data.seq !== 'number') throw new Error(data && data.error && !/Montant/.test(data.error) ? data.error : 'Script Google à mettre à jour');
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
  if (UI.tab === 'seances') return false;     // pas pendant qu'on utilise Séances : ses données partiront en quittant l'onglet
  syncBusy = true;
  let ok = false;
  try {
    const raw = muscuRaw();
    if (syncHash(raw) !== S.sync.mh) { S.sync.mh = syncHash(raw); if (raw) syncStamp(SYNC_MUSCU); }

    const sent = {};
    for (const k of Object.keys(S.sync.dirty)) {
      let v;
      if (k === SYNC_MUSCU) { try { v = JSON.parse(raw); } catch (e) { v = null; } } else v = S[k];
      if (v != null) sent[k] = { t: S.sync.t[k], v };
    }
    const data = await syncPost({ action: 'sync', since: S.sync.seq, keys: sent });

    // Ce qui a été envoyé n'est plus à envoyer, sauf si ça a encore changé entre-temps.
    for (const k of Object.keys(sent)) if (S.sync.t[k] === sent[k].t) delete S.sync.dirty[k];

    let applied = 0;
    for (const [k, x] of Object.entries(data.keys || {})) {
      if (k !== SYNC_MUSCU && !SYNC_KEYS.includes(k)) continue;
      if (S.sync.dirty[k] && S.sync.t[k] > x.t) continue;   // modifié ici plus récemment : c'est cette version qui sera envoyée
      syncApply(k, x.v);
      S.sync.t[k] = x.t;
      delete S.sync.dirty[k];
      applied++;
    }
    S.sync.seq = data.seq;
    S.sync.at = Date.now();
    S.sync.error = '';
    ok = true;
    save();
    if (applied) render(true);
  } catch (e) {
    S.sync.error = navigator.onLine === false ? 'hors ligne' : (e.message || 'erreur');
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
  try { data = await syncPost({ action: 'sync', since: 0, keys: {} }); }
  catch (e) { toast('Synchro impossible : ' + (e.message || 'erreur')); return; }

  const online = Object.keys(data.keys || {}).length > 0;
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
