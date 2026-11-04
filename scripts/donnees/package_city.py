"""Compresse les données d'une ville (sauf eau.json et vert.json, lus directement par la carte) vers out_gz/<id>/ (fichiers .json.wasm : seule extension binaire acceptée par le serveur)."""
import gzip, os, shutil, sys
base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
cid = sys.argv[1]
src, dst = os.path.join(base, "out", cid), os.path.join(base, "out_gz", cid)
if os.path.isdir(dst):
    shutil.rmtree(dst)
tot0 = tot1 = n = 0
for r, _, fs in os.walk(src):
    for f in fs:
        if f.startswith("_"):
            continue
        p = os.path.join(r, f); rel = os.path.relpath(p, src); q = os.path.join(dst, rel)
        os.makedirs(os.path.dirname(q), exist_ok=True)
        data = open(p, "rb").read(); tot0 += len(data); n += 1
        if f in ("eau.json", "vert.json") or not f.endswith(".json"):
            open(q, "wb").write(data); tot1 += len(data)
        else:
            z = gzip.compress(data, 9, mtime=0); open(q + ".wasm", "wb").write(z); tot1 += len(z)
print(cid, n, "fichiers :", round(tot0 / 1e6, 1), "Mo ->", round(tot1 / 1e6, 1), "Mo")
