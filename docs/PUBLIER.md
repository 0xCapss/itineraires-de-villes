# Publier

## Site (GitHub Pages)

1. Modifier `src/` ou `data/`, puis `python3 build.py`.
2. `npm test` (ou `npm run test:sans-reseau`).
3. Commiter `src/`, `data/` et `index.html` ensemble, puis `git push` sur `main`.
4. GitHub Pages republie en une à deux minutes. Un rechargement forcé (Ctrl+F5) évite l'ancienne copie en cache.

Réglage initial de Pages : dépôt, Settings, Pages, « Deploy from a branch », branche `main`, dossier `/ (root)`.

Un envoi unique de tout le dépôt (147 Mo) peut échouer par coupure réseau : envoyer les dossiers de villes un par un.

## Page publiée dans Claude (copie séparée)

L'application existe aussi comme page publiée dans Claude (même `index.html`, plus `maplibre-gl.js`, `jspdf.umd.min.js` et les dossiers de villes). Elle est la seule où les connecteurs de vols et d'hôtels fonctionnent, et la seule génération de ville y est bloquée. Elle se republie avec l'outil de publication de Claude à partir de `index.html` : les deux copies ne se mettent pas à jour toutes seules.

## Régénérer les données

- `python3 scripts/index_overture.py` : compare l'index d'Overture Maps du dépôt avec les données en ligne (`--ecrire` pour le remplacer). Utile quand Overture publie une nouvelle version : changer la version en argument.
- `python3 scripts/villes_overture.py` : idem pour la liste des villes.
- `scripts/donnees/` : fabrication d'une ville préparée (voir le fichier `LISEZMOI.md` de ce dossier).
