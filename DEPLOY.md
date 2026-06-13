# Déploiement — Rhinoforum 2026 (remplacement transparent)

Cette app **remplace** la version actuelle sans changer l'URL. Les utilisateurs qui ouvrent
`https://yjanko-gif.github.io/Rhinoforum2026/` arrivent directement sur la nouvelle version.

## Contenu du dossier
```
index.html              ← page principale (plein écran, PWA)
app.js                  ← logique de l'app (vanilla JS, aucune dépendance)
data.js                 ← programme complet du congrès + données de thèmes/salles
manifest.webmanifest    ← manifest PWA
icon-192.png            ← icône (écran d'accueil / PWA)
icon-512.png            ← icône grande taille
```
Police **Spectral** chargée depuis Google Fonts (connexion requise au 1er affichage ;
remplaçable par un hébergement local si besoin).

## Mise en ligne (GitHub Pages)
1. Dans ton dépôt **Rhinoforum2026**, **remplace** les anciens fichiers par ceux de ce dossier
   (mets bien `index.html` à la racine servie par Pages).
2. Commit + push. GitHub Pages publie automatiquement en ~1 min.
3. L'URL reste identique → bascule transparente pour les utilisateurs.

## Cache (le seul point d'attention)
- Les scripts sont appelés avec un suffixe de version : `app.js?v=1`, `data.js?v=1`.
  **À chaque mise à jour future, incrémente ce numéro** (`?v=2`, `?v=3`…) dans `index.html`
  pour forcer les navigateurs à recharger la nouvelle version au lieu du cache.
- Si une ancienne version avait un **service worker**, supprime-le / mets-le à jour, sinon
  certains utilisateurs resteront sur l'ancien cache. (Cette version n'installe pas de service
  worker : l'app fonctionne en ligne ; l'« ajout à l'écran d'accueil » reste possible.)

## Réglages utiles
- **Favoris** : stockés en `localStorage` (`rhino26_fav`), propres à chaque appareil.
- **Mode démo** : ajoute `?demo=1` à l'URL pour figer l'état « en direct » au jeudi 13:35
  (utile pour présenter la grille et la ligne « maintenant » hors dates du congrès).
  En usage normal (sans `?demo=1`), l'app se cale sur l'**horloge réelle** : pendant le
  congrès elle ouvre le jour courant scrollé au créneau en cours ; hors congrès, elle ouvre
  le jeudi en haut.

## Mettre à jour le programme
Tout le contenu est dans **`data.js`** (un tableau par jour). Format d'une session :
`[id, début, fin, salleKey, thèmeKey, formatKey, titre, "Intervenant; Intervenant"]`.
Les clés de salles/thèmes/formats sont définies en haut du fichier. Pas de build à lancer.
