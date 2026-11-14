// Configuration de cette version de l'app. C'est le seul fichier qui diffère
// entre la version personnelle et la version partagée avec les amis.
var APP = {
  variant: 'perso',
  name: 'Life OS',
  key: 'lifeos.v1',              // clé de stockage sur l'appareil
  repo: 'darykss/life-os',       // dépôt GitHub qui publie news.json chaque matin
  tabs: ['home', 'work', 'habits', 'seances', 'apps', 'li', 'news', 'fin'],
  onboarding: false,             // écran de bienvenue au premier lancement
  applePay: true,                // paiements Apple Pay proposés dans Finances (via le script Google)
  sector: 'all',                 // secteur LinkedIn par défaut
  pitch: 'étudiant, je prépare les concours des écoles de commerce',
  habits: [
    { id: 'sleep', icon: '😴', title: 'Sommeil', desc: '7h à 8h de sommeil' },
    { id: 'sport', icon: '💪', title: 'Sport', desc: 'Séance de sport faite' },
    { id: 'study', icon: '📚', title: 'Travail académique', desc: 'Cours ou TAGE MAGE travaillé' },
    { id: 'screen', icon: '📱', title: "Temps d'écran", desc: 'Moins de 3h dans la journée' },
    { id: 'tiktok', icon: '🎬', title: 'Business TikTok', desc: 'TikToks du jour postés' },
    { id: 'tidy', icon: '🧹', title: 'Rangement', desc: '5 minutes de rangement de la chambre' },
  ],
};
