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

**Actualisation.** L'app s'actualise à chaque ouverture, à chaque retour au premier plan et avec le bouton **Actualiser**. Si elle est ouverte à 05h00, elle s'actualise aussi à ce moment-là. iOS n'autorise pas une web app à tourner en arrière-plan : quand l'app est fermée à 05h00, le rattrapage se fait à l'ouverture suivante. La journée des habitudes et du travail change à 05h00.

**Agenda.** L'accueil affiche le programme du jour ; les flèches changent de semaine et un toucher sur un jour l'affiche. Le script fournit 60 jours en arrière et 180 jours en avant.

**Échéances.** Ce sont les événements **rouges** de ton agenda : couleur « Tomate » sur l'événement, ou événement sans couleur propre dans un agenda rouge. Seuls les agendas cochés dans Google Agenda sont lus.

**Épinglage.** L'icône 📌 d'une échéance, d'une tâche ou d'une candidature l'épingle. À chaque ouverture, l'élément épinglé le plus proche s'affiche en très grand pendant 2 secondes. Un toucher ferme l'écran plus tôt.

**Sport.** Une séance est un événement de l'agenda dont le titre contient un des mots-clés réglables dans ⚙︎. Tu peux aussi en ajouter une à la main. Cocher la séance du jour coche aussi l'habitude « Sport ».

**Travail.** La série 🔥 compte les jours de travail d'affilée : un jour est validé par une session Pomodoro terminée ou par le bouton « J'ai travaillé aujourd'hui ». Le sablier ⏳ signale une série qui s'éteindra le soir même. Le Pomodoro enchaîne 25 minutes de travail puis 5 minutes de pause, avec un signal sonore et visuel à la fin. Garde l'app ouverte pendant la session : iOS ne laisse pas une web app sonner en arrière-plan, mais la session est bien comptée au retour.

**Habitudes.** « Ajouter ou retirer des habitudes » ouvre la gestion de la liste. Une habitude retirée reste dans l'historique. Les flèches remontent les semaines passées, et la courbe montre le taux de réussite sur 12 semaines ou 30 jours.

**Candidatures.** Chaque candidature a un type, une date limite et un statut (À faire, En cours, Envoyée, Entretien, Acceptée, Refusée). La liste « À préparer » est triée par date limite.

**LinkedIn.** Une nouvelle cible chaque lundi parmi 48 profils, avec la recherche LinkedIn correspondante et deux messages : une note d'invitation de moins de 200 caractères et un message complet.

**Finances.** Les totaux portent sur la semaine en cours et sur le mois affiché ; les flèches remontent les mois précédents. Un abonnement compte à partir du mois où il est ajouté ; arrêté, il reste dans les mois passés.

**Récap de la semaine.** Le dimanche, le bilan s'ouvre tout seul à la première ouverture et reste accessible depuis l'accueil. Les autres jours, un lien en bas de l'accueil ouvre celui de la semaine précédente.

**Sauvegarde.** Les données vivent uniquement sur l'iPhone. ⚙︎ **Réglages › Exporter** crée un fichier de sauvegarde, **Importer** le restaure. Supprimer l'app de l'écran d'accueil efface ses données.

## Mettre l'app à jour

Renvoie tous les fichiers du dossier sur GitHub (page **Add file › Upload files** du dépôt), puis **Commit changes**. L'app installée récupère la nouvelle version à l'ouverture suivante, sans perdre tes données.

Pour une mise à jour du script Google : colle le nouveau `Code.gs`, puis **Déployer › Gérer les déploiements › Modifier › Version : Nouvelle version › Déployer**. L'URL ne change pas.

## Fichiers

- `index.html`, `styles.css`, `app.js`, `extra.js` : l'app
- `targets.js` : la liste des cibles LinkedIn (modifiable)
- `sw.js`, `manifest.webmanifest`, `icon-180.png`, `icon-512.png` : installation et mode hors ligne
- `google-apps-script/Code.gs` : le script à coller dans Google Apps Script

Pour tester sur ordinateur : `python3 -m http.server 8765` dans ce dossier, puis `http://localhost:8765`.
