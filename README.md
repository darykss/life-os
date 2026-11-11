# Life OS

Dashboard de vie personnel pour iPhone : agenda du jour, échéances, sport, to-do, réseau LinkedIn, habitudes du soir et finances.

C'est une **web app installable** (PWA) : elle s'ajoute à l'écran d'accueil de l'iPhone depuis Safari et s'ouvre en plein écran comme une app normale. Tout est gratuit : pas de compte développeur Apple, pas de serveur, pas d'abonnement.

| Brique | Solution | Coût |
|---|---|---|
| App | HTML / CSS / JavaScript, sans dépendance | 0 € |
| Hébergement | GitHub Pages | 0 € |
| Données (tâches, habitudes, finances…) | Stockées sur l'iPhone | 0 € |
| Google Agenda | Google Apps Script, sur ton compte Google | 0 € |

## Installation

### 1. Mettre l'app en ligne (GitHub Pages)

1. Crée un compte sur [github.com](https://github.com) si tu n'en as pas.
2. Crée un dépôt **public** nommé `life-os` (bouton **New**).
3. Sur la page du dépôt : **uploading an existing file**, puis glisse **tout le contenu** du dossier `life-os` (pas le dossier lui-même) et valide avec **Commit changes**.
4. **Settings › Pages** : dans *Branch*, choisis `main` et `/ (root)`, puis **Save**.
5. Une à deux minutes plus tard, l'app est en ligne à l'adresse `https://TON-PSEUDO.github.io/life-os/`.

Le dépôt est public, mais il ne contient que le code : aucune de tes données n'y figure.

### 2. Installer sur l'iPhone

1. Ouvre l'adresse dans **Safari** (pas Chrome).
2. Bouton **Partager** › **Sur l'écran d'accueil** › **Ajouter**.
3. Lance l'app depuis son icône.

### 3. Google Agenda

1. Sur ordinateur, va sur [script.google.com](https://script.google.com) › **Nouveau projet**.
2. Remplace tout le code par le contenu de [`google-apps-script/Code.gs`](google-apps-script/Code.gs).
3. Choisis la fonction `autoriser` dans la barre du haut, clique sur **Exécuter** et accepte l'accès à ton agenda. Google affiche un avertissement « application non validée » : c'est normal, c'est ton propre script (*Paramètres avancés* › *Accéder au projet*).
4. **Déployer › Nouveau déploiement** › type **Application Web** › *Exécuter en tant que* : **Moi** › *Qui a accès* : **Tout le monde** › **Déployer**.
5. Copie l'**URL de l'application Web** (elle se termine par `/exec`).
6. Dans Life OS : ⚙︎ **Réglages** › colle l'URL dans *Lien du script Google Agenda* › **Enregistrer**.

Cette URL permet de lire ton agenda : ne la partage pas. Le script ne fait que lire, il ne modifie rien.

## Comment ça marche

**Actualisation.** L'app s'actualise à chaque ouverture, à chaque retour au premier plan et avec le bouton **Actualiser**. Si elle est ouverte à 05h00, elle s'actualise aussi à ce moment-là. iOS n'autorise pas une web app à tourner en arrière-plan : quand l'app est fermée à 05h00, le rattrapage se fait à l'ouverture suivante, ce qui revient au même à l'écran. La journée des habitudes change à 05h00.

**Échéances.** Ce sont les événements **rouges** de ton agenda : couleur « Tomate » sur l'événement, ou événement sans couleur propre dans un agenda rouge. Seuls les agendas cochés dans Google Agenda sont lus.

**Épinglage.** L'icône 📌 d'une échéance ou d'une tâche l'épingle. À chaque ouverture, l'élément épinglé le plus proche s'affiche en très grand pendant 2 secondes (les autres sont listés en dessous). Un toucher ferme l'écran plus tôt. L'épingle disparaît quand la date est passée ou la tâche terminée.

**Sport.** Une séance est un événement de l'agenda dont le titre contient un des mots-clés réglables dans ⚙︎ (muscu, footing, run…). Tu peux aussi en ajouter une à la main. Cocher la séance du jour coche aussi l'habitude « Sport ».

**LinkedIn.** Une nouvelle cible chaque lundi parmi 48 profils (entrepreneuriat, commerce, management, business), avec la recherche LinkedIn correspondante et deux messages : une note d'invitation de moins de 200 caractères (limite des comptes gratuits) et un message complet.

**Finances.** Les totaux portent sur la semaine en cours (lundi à dimanche) et le mois en cours. Les abonnements sont comptés chaque mois, et dans la semaine où tombe leur jour de prélèvement.

**Sauvegarde.** Les données vivent uniquement sur l'iPhone. ⚙︎ **Réglages › Exporter** crée un fichier de sauvegarde, **Importer** le restaure. Supprimer l'app de l'écran d'accueil efface ses données.

## Fichiers

- `index.html`, `styles.css`, `app.js` : l'app
- `targets.js` : la liste des cibles LinkedIn (modifiable)
- `sw.js`, `manifest.webmanifest`, `icon-180.png`, `icon-512.png` : installation et mode hors ligne
- `google-apps-script/Code.gs` : le script à coller dans Google Apps Script

Pour tester sur ordinateur : `python3 -m http.server 8765` dans ce dossier, puis `http://localhost:8765`.
