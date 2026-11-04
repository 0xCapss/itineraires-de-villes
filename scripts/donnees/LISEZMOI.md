# Fabrication des villes préparées

Scripts utilisés pour produire les dossiers de villes. Ils **n'ont pas été relancés** lors de la consolidation du dépôt : ils sont conservés pour mémoire et pour fabriquer de nouvelles villes, mais leur exécution n'est pas vérifiée aujourd'hui.

- `ov.py` : lecture d'Overture Maps par zone (pyarrow, anonyme sur S3).
- `cfg_new.py`, `build_city.py` : paramètres d'une ville et construction des fichiers (cellules de bâtiments et de rues, eau, parcs, quartiers, lieux, repères, tarifs). Sortie dans `../out/<id>/`.
- `build_gtfs.py` : transports en commun à partir des flux GTFS (transport, formes, flux).
- `build_photos.py` : photos de Wikimedia Commons (auteur et licence conservés).
- `package_city.py` : compression des fichiers en `.json.wasm` pour la publication.
- `tarifs_villes.json` : tarifs de référence (taxi, métro) saisis de mémoire, non vérifiés.

Dépendances : Python 3, pyarrow, shapely, numpy, Pillow.
