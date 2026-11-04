# vendor/

- `pq.js` : lecteur de fichiers parquet pour le navigateur, assemblé avec esbuild à partir de `hyparquet` 1.31.1 et `hyparquet-compressors` 1.1.2 (`pq-entree.js` est le point d'entrée). Pour le refaire : `npm i hyparquet@1.31.1 hyparquet-compressors@1.1.2 esbuild`, puis `npx esbuild vendor/pq-entree.js --bundle --format=iife --global-name=PQ --minify --outfile=vendor/pq.js`.
- Les bibliothèques MapLibre GL (`maplibre-gl.js`) et jsPDF (`jspdf.umd.min.js`) sont à la racine, car la page les charge par leur nom.
