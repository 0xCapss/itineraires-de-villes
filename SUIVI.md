# Suivi du projet

Dernière mise à jour : 4 novembre 2026.

## Fait et vérifié par les tests automatiques (`npm test`)

- Démarrage sans erreur, 13 villes préparées, bouton « Générer une ville », boîte à outils, en-tête clair même si le système est en mode sombre.
- Formulaire de réservation de vol : centré, aller simple et aller-retour, liens vers Google Flights, Skyscanner, Kayak et Expedia (trajet, date, voyageurs, classe, vol direct), fermeture par Échap.
- Boîte à outils des activités : 8 types, filtre, création d'une activité sur la carte.
- Génération d'une ville à la demande (Mexico) : cellules voisines, quartiers et lieux chargés, ville sélectionnée dans la liste, historique limité à 10 villes et conservé après rechargement.
- `index.html` correspond à `build.py`.
- 18 tests unitaires et micro-benchmarks Node (`tests/unitaires/`) : fonctions pures, avec budgets de temps larges.
- Budget de démarrage dans le navigateur (`tests/budget.test.js`) : taille, DOMContentLoaded, ville prête, tas JavaScript, noeuds DOM. Parcours des 13 villes sans erreur de page (`tests/villes.test.js`).
- ESLint : 0 erreur, 0 avertissement (`npm run lint`).
- Les scripts `scripts/index_overture.py` et `scripts/villes_overture.py` reproduisent à l'identique `data/index_overture.json.wasm` et `data/villes_20k.json` (essai du 4 novembre 2026, données d'Overture Maps version 2026-10-21.0).

## Mesures de performance (rendu logiciel, serveur local, 4 novembre 2026)

- `index.html` : 3257 Ko avant, 536 Ko après (compressé : 1,91 Mo avant, 155 Ko après). Le gain est surtout du transfert réseau ; les temps locaux (DOMContentLoaded environ 570 ms, ville prête 1,3 s, tas 28 Mo) sont quasi inchangés.
- Environ 22 tâches longues au démarrage (2 s cumulées) : non traitées, à examiner si le démarrage sur téléphone est jugé lent.
- Lecture de l'index Overture 36 ms, sélection des groupes de lignes moins de 1 ms, recherche dans 25 337 villes 0,5 ms : ces points ne sont pas des goulots.
- Concurrence des requêtes de génération réduite à 2 si l'appareil déclare 4 Go de mémoire ou moins ; points d'intérêt limités à 1200 et masqués sous le zoom 13,5.

## Mesuré à la main pendant le développement (non automatisé)

- Génération hors parcs : Mexico environ 7 s, Paris environ 9 s avant l'affichage ; tout le reste (8 cellules voisines, noms de rues, quartiers) en une trentaine de secondes. Pic de mémoire jusqu'à environ 900 Mo.
- Rapport PDF : budget sur page séparée, détail par jour, récapitulatif en monnaie locale puis converti en euros (taux saisis par l'utilisateur, aucun taux supposé).

## Non vérifié

- **La page publiée dans Claude** : jamais ouverte par moi dans le visualiseur ; tous les tests sont sur une copie locale.
- **Les connecteurs de vols et d'hôtels** (Expedia, eDreams, Booking.com, Tripadvisor) : jamais vus fonctionner de bout en bout.
- **Les formats de liens** de Google Flights, Skyscanner, Kayak et Expedia : établis de mémoire, sites non joignables depuis l'environnement de développement. Les heures « Partir après / Arriver avant » ne sont transmises qu'à Google Flights.
- **Mobile** : plein écran prévu sous 760 px pour le formulaire de vol, non testé. La mémoire (jusqu'à 900 Mo) est probablement trop élevée pour un téléphone modeste.
- **Photos de Wikimedia Commons** pour les villes générées : testées avec des réponses simulées, pas avec le vrai service (limite de débit depuis l'environnement de développement).
- **Les scripts de `scripts/donnees/`** : conservés, pas relancés.
- Temps de génération sur la connexion de l'utilisateur.

## Limites connues

- Villes générées : pas de transports en commun, pas d'horaires d'ouverture, pas de zone accessible, taxi estimé avec un tarif générique en euros ; pas de vols entre villes (pas d'aéroport dans la liste des villes de vol).
- Les itinéraires ne sont pas conservés d'une visite à l'autre : « Enregistrer / ouvrir » (fichier ou code) pour les garder. Seule la liste des 10 dernières villes générées est conservée.
- Formalités d'entrée : fiches pour les États-Unis, le Canada et la France seulement.
- Noms de lieux en caractères non latins : s'impriment avec des « ? » dans le rapport PDF.
- Deux copies de l'application (page publiée dans Claude et site GitHub) à tenir à jour séparément.
- Recherche de vols avec prix : uniquement dans la page publiée dans Claude.

## Idées en attente

- Interrupteur « Clair / Sombre ».
- Réduire encore la mémoire de la génération pour les téléphones.
- Autres outils dans la boîte à outils à gauche (hébergement, budget, rapport).
- Fiches de formalités pour d'autres pays (à vérifier sur des sources officielles).
- Villes préparées supplémentaires avec transports en commun.
