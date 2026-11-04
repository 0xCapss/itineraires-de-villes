# Itinéraires de villes

Application web pour préparer un voyage : on choisit une ville, on ajoute des étapes (monuments, restaurants, hôtels, activités créées à la main), l'application calcule les trajets à pied, en transports en commun ou en taxi, tient le budget par devise, prépare la réservation des vols et produit un rapport PDF.

Deux sortes de villes :
- **13 villes préparées** (New York, Montréal, Paris, San Francisco, Vancouver, Memphis, Los Angeles, Las Vegas, Chicago, Miami, Washington, Boston, Seattle) : cartes, transports en commun, photos et tarifs fournis par les dossiers de ce dépôt.
- **Villes générées à la demande** (« Générer une ville ») : n'importe quelle ville de plus de 20 000 habitants. La carte (rues, bâtiments, eau, parcs, quartiers, lieux) est construite dans le navigateur à partir des données ouvertes d'Overture Maps. Pas de transports en commun ni d'horaires d'ouverture pour ces villes.

Site : https://0xcapss.github.io/itineraires-de-villes/

## Organisation du dépôt

| Chemin | Rôle |
|---|---|
| `index.html` | Le site, **généré** par `build.py`. Ne pas le modifier à la main. |
| `src/gabarit.html` | Squelette de la page (HTML) avec des emplacements pour les fichiers ci-dessous. |
| `src/css/` | `app.css` (styles de l'application), `charte.css` (charte graphique unifiée, thème clair). |
| `src/js/` | Le code, en six morceaux (voir `docs/ARCHITECTURE.md`). |
| `data/` | `villes_20k.json` (25 337 villes) et `index_overture.json.wasm` (index des fichiers d'Overture Maps). |
| `vendor/` | Lecteur de fichiers parquet (`pq.js`) et sa source. |
| `maplibre-gl.js`, `jspdf.umd.min.js` | Bibliothèques de carte et de PDF, chargées par la page. |
| `nyc/`, `par/`, `mem/`… | Données des 13 villes préparées. |
| `tests/` | Tests automatiques (Playwright). |
| `scripts/` | Fabrication des données (`index_overture.py`, `villes_overture.py`) et des villes préparées (`scripts/donnees/`). |
| `docs/` | Architecture et mode de publication. |
| `SUIVI.md` | Ce qui est fait, vérifié, non vérifié, et les idées en attente. |

## Travailler sur le site

```bash
npm install            # une fois (Playwright)
npx playwright install chromium   # une fois, si aucun navigateur n'est installé
python3 build.py       # régénère index.html après avoir modifié src/ ou data/
npm test               # tests unitaires (Node) puis tests navigateur (SANS_RESEAU=1 pour ignorer ceux qui lisent Overture Maps)
npm run lint           # ESLint sur le code assemblé (erreurs : variables non définies, etc.)
node tests/mesures.js  # mesures de démarrage (taille, temps, mémoire, tâches longues)
```

Pour voir le site en local : `python3 -m http.server 8000`, puis ouvrir http://localhost:8000/.

## Publier

`git push` sur la branche `main` : GitHub Pages republie le site. Les modifications doivent passer par `src/` puis `python3 build.py`, et `index.html` doit être commité avec elles (le test `build.test.js` le vérifie).

## Sources de données

© OpenStreetMap contributors, © Overture Maps Foundation, données GTFS des exploitants de transports (voir la note de chaque ville), photos de Wikimedia Commons (auteur et licence affichés avec chaque photo).
