"""Photos libres (Wikimedia Commons) des repères d'une ville, intégrées en données dans photos/index.json.
Usage : python3 -u -I build_photos.py <id>
Sans l'API (limitée en débit) : recherche et fiches de fichiers en HTML, vignettes depuis upload.wikimedia.org."""
import sys as _s, os as _o
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import base64, hashlib, html, io, json, os, re, subprocess, sys, time, unicodedata, urllib.parse
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
UA = "ItinerairesDeVille/1.0 (voyage planner; contact: nme69960@gmail.com)"
VILLE = {"sfo": "San Francisco", "van": "Vancouver", "mem": "Memphis"}
from cfg_new import CITES_NEW
VILLE.update({k: v["nom"] for k, v in CITES_NEW.items()})
STOP = {"park", "the", "of", "and", "san", "francisco", "vancouver", "memphis", "museum", "gardens", "garden", "hotel", "street", "de", "la", "le", "at", "by",
        "historic", "district", "las", "vegas", "los", "angeles", "chicago", "miami", "washington", "boston", "seattle", "national", "state", "center", "centre", "downtown", "beach", "bridge", "island", "market"}
EXCLUS = ("map", "plan", "logo", "diagram", "poster", "stamp", "sign", "flag", "coat", "seal", "panorama_", "aerial", "satellite", "commons-", "interior", "inside")


def norm(s):
    s = unicodedata.normalize("NFD", urllib.parse.unquote(s))
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in s if unicodedata.category(c) != "Mn").lower()).strip()


def get(url, binaire=False, essais=5):
    for k in range(essais):
        r = subprocess.run(["curl", "-s", "-L", "-A", UA, "-m", "60", "-w", "\n%{http_code}", url], capture_output=True)
        corps, _, code = r.stdout.rpartition(b"\n")
        if code.strip() == b"200":
            return corps if binaire else corps.decode("utf-8", "replace")
        if code.strip() in (b"429", b"503"):
            time.sleep(30 * (k + 1)); continue
        return None
    return None


def licence(t):
    m = re.search(r'href="(?:https:)?//creativecommons\.org/(licenses|publicdomain)/([^"]*)"', t)
    if m:
        kind, path = m.group(1), [p for p in m.group(2).split("/") if p and not p.startswith("deed")]
        if kind == "publicdomain":
            return ("CC0" if path and path[0] == "zero" else "Public domain"), "https://creativecommons.org/publicdomain/" + "/".join(path)
        if len(path) >= 2:
            return "CC " + path[0].upper() + " " + path[1], "https://creativecommons.org/licenses/" + "/".join(path[:2])
    if re.search(r"Public domain|PD-old|PD-US|PD-self|PD-USGov", t):
        return "Public domain", None
    return None, None


def auteur(t):
    m = re.search(r'fileinfotpl(?:_|&#95;)aut"[^>]*>[^<]*</td>\s*<td>(.*?)</td>', t, re.S)
    if not m:
        return None
    raw = re.sub(r"<style.*?</style>", " ", m.group(1), flags=re.S)
    raw = re.sub(r"\.mw-parser-output[^}]*\}", " ", raw)
    a = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    a = re.sub(r"\s+", " ", a).strip()
    if "{" in a or "}" in a:
        a = a.split("}")[-1].strip()
    a = re.sub(r"^(Creator|Author|Photographer)\s*:?\s*", "", a)
    a = re.sub(r"\s*(\(talk\)|[Uu]ser:|Own work.*|Original uploader.*|\bTalk\b.*)\s*", " ", a).strip(" -,;()")
    if not a or len(a) < 2 or a.lower() in ("unknown", "anonymous"):
        return None
    return a[:60]


def candidats(requete):
    t = get("https://commons.wikimedia.org/w/index.php?search=" + urllib.parse.quote_plus(requete) + "&ns6=1&fulltext=1&limit=12")
    if not t:
        return []
    vus = []
    for f in re.findall(r'href="/wiki/(File:[^"#?]*)"', t):
        if f not in vus:
            vus.append(f)
    return vus


def traiter(cid):
    out = os.path.join(HERE, "..", "out", cid)
    cache_p = os.path.join(HERE, "..", "gtfs", f"photos_{cid}.json")
    cache = json.load(open(cache_p, encoding="utf-8")) if os.path.exists(cache_p) else {}
    lieux = json.load(open(f"{out}/lieux/{cid}.json", encoding="utf-8"))
    par_pos = {(e["n"], round(e["lon"], 5), round(e["lat"], 5)): e for e in lieux}
    cibles = []
    for r in json.load(open(f"{out}/reperes.json", encoding="utf-8")):
        e = par_pos.get((r["n"], round(r["lon"], 5), round(r["lat"], 5)))
        if e:
            cibles.append(e)
    for d in json.load(open(f"{out}/_depart.json", encoding="utf-8")):
        e = next((x for x in lieux if x["i"] == d["id"]), None)
        if e and e not in cibles:
            cibles.append(e)
    LIM = int(os.environ.get('LIM','10'))
    dep_ids = {d['id'] for d in json.load(open(f'{out}/_depart.json', encoding='utf-8'))}
    cibles = cibles[:LIM] + [e for e in cibles[LIM:] if e['i'] in dep_ids]
    index = {}
    for e in cibles:
        cle = e["i"]
        if cle in cache and cache[cle] and ('{' in cache[cle].get('a','') or 'mw-parser' in cache[cle].get('a','')):
            del cache[cle]
        if cle in cache:
            if cache[cle]:
                index[cle] = cache[cle]
            continue
        nom = e["n"].split(",")[0].replace(" Park.", " Park")
        jetons = [w for w in norm(nom).split() if len(w) >= 4 and w not in STOP]
        res = None
        for requete in (nom + " " + VILLE[cid],):
            for f in candidats(requete)[:4]:
                titre = norm(f[5:].rsplit(".", 1)[0]); ext = f.rsplit(".", 1)[-1].lower()
                if ext not in ("jpg", "jpeg") or any(x in titre.replace(" ", "_") or x in titre for x in EXCLUS):
                    continue
                if jetons and sum(1 for w in jetons if w in titre) < max(1, (len(jetons) + 1) // 2):
                    continue
                time.sleep(2.5)
                page = get("https://commons.wikimedia.org/wiki/" + f)
                if not page:
                    continue
                debut = page.find('id="file"'); fin = page.find('id="filehistory"')
                page = page[debut:fin] if 0 <= debut < fin else page
                lic, lic_url = licence(page); aut = auteur(page)
                if not lic or not aut:
                    continue
                m = re.search(r'data-file-width="(\d+)" data-file-height="(\d+)"', page)
                if not m or int(m.group(1)) < 900 or not (1.15 <= int(m.group(1)) / max(1, int(m.group(2))) <= 2.1):
                    continue
                th = [(int(w), u) for u, w in re.findall(r'(https://(?:upload|thumb)\.wikimedia\.org/wikipedia/commons/thumb/[^"\s]+?/(\d+)px-[^"\s]+)', page)]
                th = sorted(th, key=lambda x: abs(x[0] - 960))
                if not th:
                    continue
                time.sleep(2.5)
                img = get(html.unescape(th[0][1]).split("?")[0].replace("thumb.wikimedia.org", "upload.wikimedia.org"), binaire=True)
                if not img or len(img) < 5000:
                    continue
                try:
                    im = Image.open(io.BytesIO(img)).convert("RGB"); im.thumbnail((640, 480))
                    b = io.BytesIO(); im.save(b, "JPEG", quality=72, optimize=True, progressive=True)
                except Exception:
                    continue
                res = {"f": "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode(), "a": aut, "l": lic,
                       "s": "https://commons.wikimedia.org/wiki/" + f}
                if lic_url:
                    res["u"] = lic_url
                break
            if res:
                break
            time.sleep(2.5)
        cache[cle] = res
        json.dump(cache, open(cache_p, "w", encoding="utf-8"), ensure_ascii=False)
        print(cid, e["n"], "->", (res["s"][-50:] + " | " + res["a"] + " | " + res["l"]) if res else "pas de photo", flush=True)
        if res:
            index[cle] = res
            os.makedirs(f"{out}/photos", exist_ok=True)
            json.dump(index, open(f"{out}/photos/index.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        time.sleep(2.5)
    os.makedirs(f"{out}/photos", exist_ok=True)
    chemin = f"{out}/photos/index.json"
    json.dump(index, open(chemin, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print(cid, "photos:", len(index), "sur", len(cibles), "cibles ;", os.path.getsize(chemin) // 1024, "Ko", flush=True)


if __name__ == "__main__":
    traiter(sys.argv[1])
