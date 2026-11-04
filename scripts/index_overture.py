#!/usr/bin/env python3
"""Fabrique data/index_overture.json.wasm : pour chaque thème d'Overture Maps, la liste des fichiers parquet et, pour chaque groupe
de lignes, son rectangle englobant arrondi vers l'extérieur au centième de degré et son nombre de lignes. L'application s'en sert pour
ne lire que les morceaux de fichiers qui touchent la zone demandée.
Usage : python3 scripts/index_overture.py [version]   (par défaut : 2026-10-21.0)   - demande pyarrow et l'accès à amazonaws.com
Le fichier produit est du JSON compressé en gzip, enregistré sous l'extension .wasm (seule extension binaire acceptée par l'hébergeur d'origine)."""
import gzip, json, os, re, sys, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
import pyarrow.fs as fs, pyarrow.parquet as pq

VERSION = sys.argv[1] if len(sys.argv) > 1 else "2026-10-21.0"
BUCKET = "overturemaps-us-west-2"
THEMES = [("building", "buildings"), ("segment", "transportation"), ("place", "places"), ("water", "base"), ("land_use", "base"), ("division", "divisions")]
TYPES = {"building": "building", "segment": "segment", "place": "place", "water": "water", "land_use": "land_use", "division": "division"}
S3 = fs.S3FileSystem(anonymous=True, region="us-west-2")

def cles(prefixe):
    sortie, jeton = [], None
    while True:
        u = f"https://{BUCKET}.s3.amazonaws.com/?list-type=2&prefix={prefixe}" + (f"&continuation-token={urllib.parse.quote(jeton)}" if jeton else "")
        x = urllib.request.urlopen(u, timeout=30).read().decode()
        sortie += re.findall(r"<Key>([^<]+)</Key>", x)
        m = re.search(r"<NextContinuationToken>([^<]+)", x)
        if not m: return sortie
        jeton = m.group(1)

def pied(cle):
    md = pq.ParquetFile(S3.open_input_file(f"{BUCKET}/{cle}")).metadata
    colonnes = {md.schema.column(i).path: i for i in range(md.num_columns)}
    groupes = []
    for r in range(md.num_row_groups):
        g = md.row_group(r); b = {}
        for c in ("bbox.xmin", "bbox.xmax", "bbox.ymin", "bbox.ymax"):
            st = g.column(colonnes[c]).statistics
            b[c] = (st.min, st.max) if st and st.has_min_max else None
        if all(b.values()):
            q = lambda v, haut: int(-((-v * 100) // 1)) if haut else int((v * 100) // 1)   # arrondi vers l'extérieur
            groupes.append([q(b["bbox.xmin"][0], False), q(b["bbox.ymin"][0], False), q(b["bbox.xmax"][1], True), q(b["bbox.ymax"][1], True), g.num_rows])
    return [cle.split("/")[-1], groupes]

sortie = {}
for nom, theme in THEMES:
    prefixe = f"release/{VERSION}/theme={theme}/type={TYPES[nom]}/"
    fichiers = [c for c in cles(prefixe) if c.endswith(".parquet")]
    with ThreadPoolExecutor(16) as ex: sortie[nom] = {"p": prefixe, "f": list(ex.map(pied, fichiers))}
    print(nom, len(fichiers), "fichiers,", sum(len(f[1]) for f in sortie[nom]["f"]), "groupes de lignes", flush=True)
texte = json.dumps(sortie, separators=(",", ":"))
chemin = os.path.join(os.path.dirname(__file__), "..", "data", "index_overture.json.wasm")
if "--ecrire" in sys.argv:
    open(chemin, "wb").write(gzip.compress(texte.encode(), 9)); print("écrit", chemin)
else:
    actuel = json.loads(gzip.decompress(open(chemin, "rb").read()))
    print("identique à data/index_overture.json.wasm :", actuel == sortie, "(ajoutez --ecrire pour remplacer le fichier)")
