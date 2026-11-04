"""Fabrique les fichiers de données d'une ville pour l'application d'itinéraires, à partir d'Overture Maps.
Usage : python3 -I build_city.py <id>   (id : sfo, van, mem)
Sorties : ../out/<id>/ (mêmes noms de fichiers que les villes existantes).
Limites connues : pas de transports en commun (transport.json vide), pas d'horaires d'ouverture, pas de photos."""
import json, math, os, sys, re, hashlib, collections
import numpy as np
import shapely
from shapely.geometry import box, Polygon, MultiPolygon
sys.path.insert(0, os.path.dirname(__file__))
from ov import lire

CITES = {
    "sfo": dict(nom="San Francisco", bbox=(-122.52, 37.70, -122.36, 37.83), centre=(-122.4194, 37.7749), dc=0.135, zoom=12.4,
                kx=88060, pays="US", devise="dollars américains", devise_code="USD",
                depart=["San Francisco Museum of Modern Art", "Tadich Grill", "Palace of Fine Arts"]),
    "van": dict(nom="Vancouver", bbox=(-123.27, 49.18, -122.98, 49.33), centre=(-123.1207, 49.2827), dc=0.16, zoom=12.2,
                kx=72570, pays="CA", devise="dollars canadiens", devise_code="CAD",
                depart=["Science World", "Miku Vancouver", "Stanley Park"]),
    "mem": dict(nom="Memphis", bbox=(-90.12, 35.03, -89.84, 35.25), centre=(-90.049, 35.1495), dc=0.25, zoom=12.0,
                kx=91070, pays="US", devise="dollars américains", devise_code="USD",
                depart=["National Civil Rights Museum", "Gus's World Famous Fried Chicken", "Sun Studio"]),
}
CLASSES = ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "service",
           "living_street", "pedestrian", "footway", "cycleway", "path", "steps", "track", "autre"]
CI = {c: i for i, c in enumerate(CLASSES)}
E5 = 1e5

REPERES = {
    "sfo": ["Golden Gate Bridge", "Alcatraz", "Coit Tower", "Pier 39", "Lombard Street", "Alamo Square", "Palace of Fine Arts",
            "San Francisco Museum of Modern Art", "de Young", "California Academy of Sciences", "Ferry Building", "Golden Gate Park", "Japanese Tea Garden",
            "Presidio", "Cable Car Museum", "Exploratorium", "Twin Peaks", "Conservatory of Flowers", "Legion of Honor",
            "Grace Cathedral", "Mission Dolores", "Union Square", "Transamerica Pyramid", "Salesforce Park", "Asian Art Museum", "Crissy Field",
            "Lands End", "Baker Beach", "Ghirardelli Square", "Painted Ladies", "Sutro Baths"],
    "van": ["Stanley Park", "Granville Island", "Steam Clock", "Capilano Suspension Bridge", "Vancouver Art Gallery", "Science World", "Canada Place",
            "Museum of Anthropology", "Queen Elizabeth Park", "VanDusen", "Vancouver Aquarium", "BC Place", "Rogers Arena", "Chinatown", "Sun Yat-Sen",
            "Lonsdale Quay", "Vancouver Lookout", "Christ Church Cathedral", "English Bay", "Kitsilano Beach", "Robson Square", "Vancouver Public Library",
            "Bloedel Conservatory", "Nitobe", "Lynn Canyon", "Grouse Mountain", "Jericho Beach", "Museum of Vancouver", "Pacific Centre"],
    "mem": ["Graceland", "National Civil Rights Museum", "Sun Studio", "Beale Street", "Rock 'n' Soul Museum", "Stax Museum", "Mud Island", "Peabody",
            "Memphis Zoo", "Brooks Museum", "Overton Park", "Pyramid", "Shelby Farms", "National Ornamental Metal Museum", "Slave Haven",
            "Mississippi River Museum", "Lorraine Motel", "FedExForum", "AutoZone Park", "Orpheum", "Cotton Museum", "Tom Lee Park", "Big River Crossing",
            "Mallory-Neely", "Victorian Village", "Memphis Botanic Garden", "Dixon Gallery", "Elmwood Cemetery", "Cooper-Young", "Memphis Music Hall of Fame"],
}


from cfg_new import CITES_NEW, REPERES_NEW, TARIFS_NEW
CITES.update(CITES_NEW)
REPERES.update(REPERES_NEW)


def enc(coords):
    """liste de (lon,lat) -> tableau plat entier [x0,y0,dx,dy,...] ; None si moins de 2 points distincts"""
    pts = []
    for lon, lat in coords:
        p = (int(round(lon * E5)), int(round(lat * E5)))
        if not pts or p != pts[-1]:
            pts.append(p)
    if len(pts) < 2:
        return None
    flat = [pts[0][0], pts[0][1]]
    for i in range(1, len(pts)):
        flat += [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]
    return flat


def cell(lon, lat, lon0, lat0, dc):
    return int(math.floor((lon - lon0) / dc)), int(math.floor((lat - lat0) / dc))


def ecrire(chemin, obj):
    os.makedirs(os.path.dirname(chemin), exist_ok=True)
    with open(chemin, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(chemin)


def nom_de(n):
    return (n or {}).get("primary") if isinstance(n, dict) else None


def aire_m2(g, kx):
    return abs(g.area) * kx * 111200


def construire(cid):
    C = CITES[cid]
    x0, y0, x1, y1 = C["bbox"]
    out = os.path.join(os.path.dirname(__file__), "..", "out", cid)
    lon0, lat0, dc = x0, y0, C["dc"]
    cellules = collections.defaultdict(dict)
    taille = {}
    kx = C["kx"]

    # ---- bâtiments ----
    _, tb = lire("buildings", "building", C["bbox"], ["height", "num_floors", "geometry"])
    h = tb.column("height").to_pylist(); nf = tb.column("num_floors").to_pylist()
    geoms = shapely.from_wkb(np.array(tb.column("geometry").to_pylist(), dtype=object))
    bat = collections.defaultdict(list)
    n_bat = 0
    for g, hh, ff in zip(geoms, h, nf):
        if g is None:
            continue
        hauteur = int(round(hh)) if hh else (int(round(ff * 3.2)) if ff else 9)
        for p in (g.geoms if g.geom_type == "MultiPolygon" else [g]):
            if p.geom_type != "Polygon" or aire_m2(p, kx) < 15:
                continue
            c = p.centroid
            if not (x0 <= c.x <= x1 and y0 <= c.y <= y1):
                continue
            e = enc(list(p.exterior.coords)[:-1])
            if e is None or len(e) < 8:
                continue
            bat[cell(c.x, c.y, lon0, lat0, dc)].append([max(1, min(hauteur, 400)), e])
            n_bat += 1
    print(cid, "bâtiments", n_bat, flush=True)

    # ---- routes ----
    _, tr = lire("transportation", "segment", C["bbox"], ["subtype", "class", "names", "geometry"])
    sub = tr.column("subtype").to_pylist(); cla = tr.column("class").to_pylist(); nms = tr.column("names").to_pylist()
    geoms = shapely.from_wkb(np.array(tr.column("geometry").to_pylist(), dtype=object))
    rou = collections.defaultdict(list); lab = collections.defaultdict(dict); axes = []
    n_rou = 0
    for g, s, c, nn in zip(geoms, sub, cla, nms):
        if s != "road" or g is None:
            continue
        ci = CI.get(c, CI["autre"]) if c in CI else (CI["service"] if c in ("parking_aisle", "driveway", "alley") else
                                                       CI["path"] if c == "bridleway" else CI["autre"])
        for ln in (g.geoms if g.geom_type == "MultiLineString" else [g]):
            if ln.geom_type != "LineString":
                continue
            co = list(ln.coords)
            e = enc(co)
            if e is None:
                continue
            if not (x0 <= co[0][0] <= x1 and y0 <= co[0][1] <= y1):
                continue
            k = cell(co[0][0], co[0][1], lon0, lat0, dc)
            rou[k].append([ci, e]); n_rou += 1
            if ci <= 3:
                axes.append([ci, e])
            nm = nom_de(nn)
            if nm and ci <= 6 and ln.length * kx > 0.0008 * kx:
                a, b = co[0], co[-1]
                cur = lab[k].get(nm)
                L = ln.length
                if cur is None or L > cur[0]:
                    lab[k][nm] = (L, [nm, ci, int(round(a[0] * E5)), int(round(a[1] * E5)), int(round(b[0] * E5)), int(round(b[1] * E5))])
    print(cid, "routes", n_rou, flush=True)

    # ---- fichiers de cellules ----
    for k in set(bat) | set(rou):
        i, j = k
        if bat.get(k):
            taille.setdefault(k, {})["b"] = ecrire(f"{out}/b_{i}_{j}.json", {"b": bat[k]})
        if rou.get(k):
            ls = sorted(lab[k].values(), key=lambda t: -t[0])[:160]
            taille.setdefault(k, {})["r"] = ecrire(f"{out}/r_{i}_{j}.json", {"r": rou[k], "l": [t[1] for t in ls]})
    ecrire(f"{out}/grille.json", {"lon0": lon0, "lat0": lat0, "dc": dc,
                                   "cellules": {f"{i}_{j}": v for (i, j), v in sorted(taille.items())}})
    ecrire(f"{out}/axes.json", {"r": axes})

    # ---- eau et espaces verts ----
    pad = box(x0 - 0.03, y0 - 0.03, x1 + 0.03, y1 + 0.03)
    zones = []

    def polys(theme, typ, cols, garder, tol, etiquette):
        _, t = lire(theme, typ, C["bbox"], cols)
        gs = shapely.from_wkb(np.array(t.column("geometry").to_pylist(), dtype=object))
        feats = []
        L = {c: t.column(c).to_pylist() for c in cols if c != "geometry"}
        for idx, g in enumerate(gs):
            if g is None or not g.is_valid and not g.buffer(0).is_valid:
                continue
            props = {c: L[c][idx] for c in L}
            cl = garder(props)
            if not cl:
                continue
            g = g.intersection(pad)
            if g.is_empty:
                continue
            g = g.simplify(tol)
            for p in (g.geoms if g.geom_type in ("MultiPolygon", "GeometryCollection") else [g]):
                if p.geom_type != "Polygon" or p.is_empty:
                    continue
                co = [[round(a, 5), round(b, 5)] for a, b in p.exterior.coords]
                feats.append({"type": "Feature", "properties": {"cl": cl},
                              "geometry": {"type": "Polygon", "coordinates": [co]}})
                nm = nom_de(props.get("names"))
                if nm:
                    c = p.representative_point()
                    ar = aire_m2(p, kx)
                    if x0 <= c.x <= x1 and y0 <= c.y <= y1 and ar > 15000:
                        zones.append([nm, etiquette, round(c.x, 5), round(c.y, 5), int(ar)])
        return {"type": "FeatureCollection", "features": feats}

    eau = polys("base", "water", ["subtype", "class", "names", "geometry"],
                lambda p: p["subtype"] or "water", 4e-5, "e")
    taille_eau = ecrire(f"{out}/eau.json", eau)
    vert = polys("base", "land_use", ["subtype", "class", "names", "geometry"],
                 lambda p: (p["subtype"] or "park") if (p["subtype"] in ("park", "recreation") or p["class"] in
                                                         ("park", "garden", "golf_course", "playground", "nature_reserve", "recreation_ground")) else None,
                 3e-5, "v")
    ecrire(f"{out}/vert.json", vert)
    # une étiquette par nom, la plus grande surface
    meilleur = {}
    for z in zones:
        if z[0] not in meilleur or z[4] > meilleur[z[0]][4]:
            meilleur[z[0]] = z
    ecrire(f"{out}/zones.json", sorted(meilleur.values(), key=lambda z: -z[4])[:400])
    print(cid, "eau", len(eau["features"]), "vert", len(vert["features"]), "zones", len(meilleur), flush=True)

    # ---- quartiers ----
    _, dv = lire("divisions", "division", C["bbox"], ["subtype", "names", "geometry"])
    sb = dv.column("subtype").to_pylist(); nn = dv.column("names").to_pylist()
    gg = shapely.from_wkb(np.array(dv.column("geometry").to_pylist(), dtype=object))
    quart, arr = [], []
    for g, s, n in zip(gg, sb, nn):
        nm = nom_de(n)
        if not nm or g is None or g.geom_type != "Point" or not (x0 <= g.x <= x1 and y0 <= g.y <= y1):
            continue
        e = {"n": nm, "lon": round(g.x, 5), "lat": round(g.y, 5)}
        (quart if s in ("neighborhood", "macrohood") else arr if s in ("locality", "borough", "localadmin") else []).append(e)
    ecrire(f"{out}/quartiers.json", {"quartiers": quart, "arrondissements": arr})
    print(cid, "quartiers", len(quart), "autres", len(arr), flush=True)

    # ---- lieux ----
    cols = ["id", "names", "taxonomy", "confidence", "addresses", "phones", "websites", "operating_status", "sources", "geometry"]
    _, pl = lire("places", "place", C["bbox"], cols)
    R = {c: pl.column(c).to_pylist() for c in cols if c != "geometry"}
    gs = shapely.from_wkb(np.array(pl.column("geometry").to_pylist(), dtype=object))
    MON1 = {"museum", "performing_arts_venue", "park"}
    MON2 = {"zoo", "aquarium", "botanical_garden", "observation_deck", "stadium_arena", "amusement_park", "beach", "landmark_and_historical_building"}
    lieux = []
    for idx, g in enumerate(gs):
        nm = nom_de(R["names"][idx]); tx = R["taxonomy"][idx] or {}
        if not nm or g is None or g.geom_type != "Point" or R["operating_status"][idx] == "permanently_closed":
            continue
        if not (x0 <= g.x <= x1 and y0 <= g.y <= y1):
            continue
        hi = tx.get("hierarchy") or []; prim = tx.get("primary") or ""
        conf = R["confidence"][idx] or 0
        if hi[:1] == ["lodging"]:
            t = "h"
        elif hi[:2] == ["food_and_drink", "restaurant"]:
            t = "r"
        elif hi[:1] == ["cultural_and_historic"] or (len(hi) > 1 and hi[1] in MON1) or prim in MON2:
            t = "m"
        else:
            continue
        if conf < 0.45:
            continue
        if t == "m" and (re.match(r"^\d", nm) or re.search(r"\b(apartments?|condominiums?|condos?|lofts?|residences?|townhouses?)\b", nm, re.I)):
            continue
        e = {"n": nm, "t": t, "c": prim or hi[-1], "lon": round(g.x, 5), "lat": round(g.y, 5),
             "i": hashlib.sha1(R["id"][idx].encode()).hexdigest()[:8]}
        ad = (R["addresses"][idx] or [{}])[0] or {}
        if ad.get("freeform"):
            e["a"] = ad["freeform"]
        ph = (R["phones"][idx] or [None])[0]
        if ph:
            e["p"] = ph
        ws = (R["websites"][idx] or [None])[0]
        if ws:
            w = ws.split("://", 1)[-1]
            w = w[4:] if w.startswith("www.") else w
            e["w"] = w.rstrip("/")
        e["q"] = 3 if (conf >= 0.9 and ws) else 2 if conf >= 0.7 else 1
        e["_s"] = len(R["sources"][idx] or []) + conf
        lieux.append(e)
    cnt = collections.Counter(e["t"] for e in lieux)
    print(cid, "lieux", dict(cnt), flush=True)

    # ---- repères (monuments les mieux notés) ----
    top, vus, absents = [], set(), []
    for nom in REPERES[cid]:
        cand = [e for e in lieux if (e["t"] == "m" or nom == "Peabody") and nom.lower() in e["n"].lower() and e["i"] not in vus]
        if not cand:
            absents.append(nom); continue
        e = max(cand, key=lambda e: (e["n"].lower() == nom.lower(), -len(e["n"]) // 12, e["_s"]))
        vus.add(e["i"]); top.append(e)
    print(cid, "repères trouvés", len(top), "absents:", absents, flush=True)
    ecrire(f"{out}/reperes.json", [{"n": e["n"], "lon": e["lon"], "lat": e["lat"], "ar": cid} for e in top])
    for e in lieux:
        e.pop("_s", None)
    ecrire(f"{out}/lieux/{cid}.json", lieux)

    # ---- transport vide, tarifs ----
    if not os.path.exists(f"{out}/transport.json"):
        ecrire(f"{out}/transport.json", {"bandes": [[0, 360], [360, 600], [600, 960], [960, 1200], [1200, 1440]],
                                          "jour": "2026-10-21", "stops": [], "lignes": []})
    tj = json.load(open(os.path.join(os.path.dirname(__file__), "tarifs_villes.json"), encoding="utf-8"))
    if cid in tj:
        tarifs = tj[cid]
    else:
        mb, pc, km, ln = TARIFS_NEW[cid]
        tarifs = {"verifie": False, "note": "Tarifs de référence saisis de mémoire, non vérifiés (aucun accès aux sites officiels depuis l'environnement de développement). À contrôler.",
                  "devise": "$", "metro_bus": mb,
                  "taxi": {"prise_en_charge": pc, "surtaxe_mta": 0, "amelioration": 0, "par_km": km, "par_minute_lent": ln, "seuil_lent_mph": 12,
                           "congestion_sud_96e": 0, "peage_zone_sud_60e": 0, "nuit": 0, "pointe_semaine": 0}}
    ecrire(f"{out}/tarifs.json", tarifs)

    # ---- départ proposé ----
    dep = []
    for nom in C["depart"]:
        cand = [e for e in lieux if e["n"].lower() == nom.lower()] or [e for e in lieux if nom.lower() in e["n"].lower()]
        cx, cy = C["centre"]
        cand.sort(key=lambda e: (e["lon"] - cx) ** 2 * kx ** 2 + (e["lat"] - cy) ** 2 * 111200 ** 2)
        if cand:
            e = cand[0]
            dep.append({"uid": e["i"], "nom": e["n"], "type": {"m": "monument", "r": "restaurant", "h": "hotel"}[e["t"]],
                        "cat": ("Musée" if e["c"] == "museum" else "Parc" if e["c"] == "park" else "Monument") if e["t"] == "m" else "Restaurant" if e["t"] == "r" else "Hôtel", "origine": "overture", "id": e["i"], "adresse": e.get("a", ""),
                        "site": ("https://" + e["w"]) if e.get("w") else None, "tel": e.get("p"),
                        "lon": e["lon"], "lat": e["lat"], "visite": 90})
    if len(dep) < 3:
        cx, cy = C["centre"]
        proche = lambda e: (e["lon"] - cx) ** 2 * kx ** 2 + (e["lat"] - cy) ** 2 * 111200 ** 2
        deja = {d["id"] for d in dep}
        for t in ("m", "r", "m"):
            if len(dep) >= 3:
                break
            cand = sorted([e for e in lieux if e["t"] == t and e["i"] not in deja and e["q"] >= 2 and e.get("w")], key=proche)
            if cand:
                e = cand[0]; deja.add(e["i"])
                dep.append({"uid": e["i"], "nom": e["n"], "type": {"m": "monument", "r": "restaurant", "h": "hotel"}[e["t"]],
                            "cat": ("Monument" if e["t"] == "m" else "Restaurant"), "origine": "overture", "id": e["i"], "adresse": e.get("a", ""),
                            "site": ("https://" + e["w"]) if e.get("w") else None, "tel": e.get("p"), "lon": e["lon"], "lat": e["lat"], "visite": 90})
    ecrire(f"{out}/_depart.json", dep)
    print(cid, "départ", [d["nom"] for d in dep], flush=True)
    tot = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(out) for f in fs)
    nfich = sum(len(fs) for _, _, fs in os.walk(out))
    print(cid, "TOTAL", round(tot / 1e6, 1), "Mo,", nfich, "fichiers", flush=True)


if __name__ == "__main__":
    construire(sys.argv[1])
