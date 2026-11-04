#!/usr/bin/env python3
"""Fabrique data/villes_20k.json : les villes de plus de 20 000 habitants lues dans le thème « divisions » d'Overture Maps.
Chaque entrée : [nom (français si disponible), code pays, longitude, latitude, population], triées par population décroissante.
Nettoyage : zones administratives de moins d'un million d'habitants écartées, doublons proches (même nom et même pays à moins de 0,3 degré) fusionnés.
Usage : python3 scripts/villes_overture.py [--ecrire]   (demande pyarrow, shapely et amazonaws.com ; environ 4 minutes)"""
import json, os, re, sys, urllib.request
import pyarrow.compute as pc, pyarrow.fs as fs, pyarrow.parquet as pq, shapely.wkb as wkb

VERSION, SEUIL = "2026-10-21.0", 20000
S3 = fs.S3FileSystem(anonymous=True, region="us-west-2")
liste = urllib.request.urlopen(f"https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&prefix=release/{VERSION}/theme=divisions/type=division/", timeout=30).read().decode()
cle = re.findall(r"<Key>([^<]+)</Key>", liste)[0]
pf = pq.ParquetFile(S3.open_input_file("overturemaps-us-west-2/" + cle))
retenus = []
for g in range(pf.metadata.num_row_groups):
    t = pf.read_row_group(g, columns=["subtype", "population"])
    m = pc.and_(pc.equal(t["subtype"], "locality"), pc.greater_equal(t["population"], SEUIL))
    if not pc.any(m).as_py(): continue
    for r in pf.read_row_group(g, columns=["subtype", "population", "country", "names", "geometry"]).filter(m).to_pylist():
        n = r["names"] or {}; commun = n.get("common") or {}
        if isinstance(commun, list): commun = dict(commun)
        nom = commun.get("fr") or commun.get("en") or n.get("primary")
        if nom:
            p = wkb.loads(r["geometry"]); retenus.append([nom, r["country"], round(p.x, 3), round(p.y, 3), r["population"]])
retenus.sort(key=lambda x: -x[4])
mauvais = re.compile(r"(metropolitan|metropolitaine|municipality|district|arrondissement|county|province|prefecture|préfecture|region|région)", re.I)
retenus = [x for x in retenus if not mauvais.search(x[0]) or x[4] >= 1000000]
vus, gardes = {}, []
for x in retenus:
    k = (x[0].lower(), x[1])
    if any(abs(y[2] - x[2]) < 0.3 and abs(y[3] - x[3]) < 0.3 for y in vus.get(k, [])): continue
    gardes.append(x); vus.setdefault(k, []).append(x)
chemin = os.path.join(os.path.dirname(__file__), "..", "data", "villes_20k.json")
texte = json.dumps(gardes, ensure_ascii=False, separators=(",", ":"))
if "--ecrire" in sys.argv:
    open(chemin, "w", encoding="utf-8").write(texte); print("écrit", len(gardes), "villes")
else:
    print(len(gardes), "villes ; identique à data/villes_20k.json :", json.loads(open(chemin, encoding="utf-8").read()) == gardes)
