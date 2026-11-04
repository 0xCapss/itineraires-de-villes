# Architecture

## Assemblage

`build.py` lit `src/gabarit.html` et remplace chaque emplacement `@@FILE:chemin@@`, `@@ESC:chemin@@`, `@@ESCJSON:chemin@@` ou `@@B64:chemin@@` par le contenu du fichier (échappé pour une balise `<script>`, ou encodé en base64). Le résultat est `index.html`, un fichier autonome (3,3 Mo) : styles, code, liste des villes et index des fichiers d'Overture y sont intégrés. Seuls `maplibre-gl.js`, `jspdf.umd.min.js` et les dossiers de villes sont chargés à part.

## Le code (`src/js/`)

Le script principal est une seule fonction (`(function(){ "use strict"; ... })()`) : les fichiers ci-dessous sont concaténés **dans cet ordre** à l'intérieur de cette fonction et partagent donc ses variables. Un fichier n'est pas un module autonome.

1. `core.js` : le moteur d'origine. Villes et leurs données, carte MapLibre, étapes et journées, trajets (graphe des rues, transports en commun par fréquences, taxis), budget, rapport PDF, enregistrement et partage d'un voyage, hôtel de base, recherche de vols par connecteurs, toolbox des activités (tuiles et création).
2. `vols-liens.js` : liens « Comparer ce vol » vers Google Flights, Skyscanner, Kayak et Expedia, construits à partir du formulaire de vol.
3. `lieux-et-relief.js` : points des lieux affichés sur la carte pendant l'ajout d'une étape, et bouton « Relief 3D ».
4. `generation-villes.js` : génération d'une ville à la demande (voir plus bas), historique des 10 dernières villes générées.
5. `boite-a-outils.js` (script séparé) : boutons « Réservation vol » et « Activités » du panneau de gauche.
6. `formulaire-vol.js` (script séparé) : comportement du formulaire de vol (voyageurs, classe, aller-retour, fermeture).

Le HTML du formulaire de vol, de la boîte à outils et de la fenêtre « Générer une ville » est dans `src/gabarit.html`.

## Génération d'une ville à la demande

1. L'utilisateur choisit une ville dans `data/villes_20k.json`.
2. `odCreerVille` crée une entrée de ville (identifiant `od-…`) ajoutée à la liste, avec une grille de cellules de 0,01 degré.
3. `odPreparer` charge la **cellule centrale** (bâtiments, rues, lieux), puis, en arrière-plan : eau et quartiers (`odSecondaire`), noms de rues (`odNoms`), parcs (`odParcs`). Les huit cellules voisines se chargent à l'ouverture, puis chaque fois que la carte se déplace (`odAuto`).
4. La lecture se fait **dans le navigateur**, par morceaux, sur les fichiers parquet d'Overture Maps (`amazonaws.com`, requêtes à plage d'octets). `data/index_overture.json.wasm` indique quels groupes de lignes touchent la zone. Les requêtes voisines d'un même fichier sont regroupées et les octets reçus sont gardés en mémoire (350 Mo au plus).
5. Les lignes lues sont converties au format des fichiers des villes préparées (cellules `b_i_j` et `r_i_j`) et servies au reste de l'application par `odJson`, qui se substitue à la lecture des fichiers : trajets, étapes, budget et rapport fonctionnent donc sans changement.
6. Adresse, téléphone et site d'un lieu sont lus à la demande (`odDetails`) quand on ouvre sa fiche ou qu'on l'ajoute.

Pourquoi une page publiée dans Claude ne peut pas le faire : la plateforme bloque les connexions vers d'autres sites. L'application détecte l'échec et affiche un message explicite.

## Villes préparées

Un dossier par ville (`nyc/`, `par/`…) : `grille.json`, cellules `b_*` (bâtiments) et `r_*` (rues), `axes.json`, `eau.json`, `vert.json`, `zones.json`, `quartiers.json`, `reperes.json`, `tarifs.json`, `transport.json`, `formes.json`, `flux.json`, `photos/index.json`, `lieux/<ville>.json`. Les fichiers terminés par `.wasm` sont du JSON compressé en gzip (extension imposée par l'hébergeur d'origine). `scripts/donnees/` contient les scripts qui les fabriquent (Overture Maps, flux GTFS, photos de Wikimedia Commons).

## Vols

Dans la page publiée dans Claude, la recherche passe par les connecteurs Expedia et eDreams (`core.js`, capacité `mcp` de la page). Hors de Claude, ces connecteurs n'existent pas : le formulaire n'affiche que les boutons de comparaison (`vols-liens.js`).

## Thème

Thème clair par défaut ; le mode sombre du système n'est pas suivi. `data-theme="dark"` sur l'élément racine active le thème sombre (utilisé quand Claude l'impose).
