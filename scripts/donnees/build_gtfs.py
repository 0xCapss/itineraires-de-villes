"""Fabrique transport.json, formes.json et flux.json d'une ville à partir de flux GTFS (miroir Mobility Database, mdb-latest).
Usage : python3 -I build_gtfs.py <id>     (id : sfo, van, mem)"""
import sys as _s, os as _o
_s.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
import collections, datetime, json, math, os, statistics, subprocess, sys, zipfile
import duckdb
import numpy as np
import shapely
from shapely.geometry import LineString

BASE = "https://storage.googleapis.com/mdb-latest/"
HERE = os.path.dirname(os.path.abspath(__file__))
FEEDS = {
    "sfo": [("us-california-san-francisco-municipal-transportation-agency-sfmta-gtfs-2886.zip", "Métro et bus de la SFMTA (Muni)", True, {}),
            ("us-california-bay-area-rapid-transit-bart-gtfs-53.zip", "BART", False, {"tf": None})],
    "van": [("ca-british-columbia-translink-vancouver-gtfs-1222.zip", "SkyTrain, bus et SeaBus de TransLink", True, {})],
    "mem": [("us-tennessee-memphis-area-transit-authority-gtfs-2352.zip", "Bus et tramways de la MATA", True, {})],
}
BBOX = {"sfo": (-122.52, 37.70, -122.36, 37.83), "van": (-123.27, 49.18, -122.98, 49.33), "mem": (-90.12, 35.03, -89.84, 35.25)}
from cfg_new import FEEDS_NEW, CITES_NEW
FEEDS.update(FEEDS_NEW)
BBOX.update({k: v["bbox"] for k, v in CITES_NEW.items()})
BANDES = [[0, 360], [360, 600], [600, 960], [960, 1200], [1200, 1440]]
MODE = {0: "t", 1: "m", 2: "r", 3: "b", 4: "f", 5: "t", 6: "t", 7: "t", 11: "b", 12: "m"}
DEFAUT = {"m": "5B6770", "t": "8A4F9E", "r": "6B4E3D", "f": "1E88A8", "b": "4A6FA5"}
E5 = 1e5


def minutes(s):
    if not s:
        return None
    try:
        h, m, x = s.strip().split(":")
        return int(h) * 60 + int(m) + int(x) / 60.0
    except Exception:
        return None



def colonnes(con, table, voulues):
    """liste de colonnes à sélectionner : celles qui existent, sinon une valeur vide"""
    have = {r[0] for r in con.execute(f"describe {table}").fetchall()}
    return ", ".join(c if c in have else f"cast(null as varchar) as {c}" for c in voulues)

def telecharger(nom, dossier):
    zp = os.path.join(dossier, nom)
    if not os.path.exists(zp):
        os.makedirs(dossier, exist_ok=True)
        subprocess.run(["curl", "-s", "-f", "-m", "600", "-o", zp, BASE + nom], check=True)
    d = zp[:-4]
    if not os.path.isdir(d):
        with zipfile.ZipFile(zp) as z:
            z.extractall(d)
    # certains flux rangent les fichiers dans un sous-dossier
    for r, _, fs in os.walk(d):
        if "stops.txt" in fs:
            return r
    raise RuntimeError("stops.txt introuvable dans " + nom)


def mercredi_de_reference(con, tables):
    """un mercredi couvert par le flux, le prochain si le flux n'est pas expiré, sinon le dernier"""
    deb, fin = [], []
    # la période réelle des horaires vient de calendar ; calendar_dates (jours fériés) peut s'étendre bien plus loin
    if "calendar" in tables:
        r = con.execute("select min(start_date), max(end_date) from calendar").fetchone()
        if r[0]:
            deb.append(r[0]); fin.append(r[1])
    if not deb and "calendar_dates" in tables:
        r = con.execute("select min(date), max(date) from calendar_dates").fetchone()
        if r[0]:
            deb.append(r[0]); fin.append(r[1])
    f = lambda s: datetime.date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    d0, d1 = f(min(deb)), f(max(fin))
    auj = datetime.date(2026, 11, 2)
    cand = max(auj, d0)
    pas = 1
    if cand > d1:
        cand = d1; pas = -1
    while cand.weekday() != 2:
        cand += datetime.timedelta(days=pas)
    if cand > d1:                      # le dernier mercredi couvert
        cand = d1
        while cand.weekday() != 2:
            cand -= datetime.timedelta(days=1)
    if cand < d0:
        cand = d0
        while cand.weekday() != 2:
            cand += datetime.timedelta(days=1)
    return cand, d0, d1


def services_actifs(con, tables, jour):
    s = jour.strftime("%Y%m%d"); wd = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"][jour.weekday()]
    actifs = set()
    if "calendar" in tables:
        for (sid,) in con.execute(f"select service_id from calendar where {wd}='1' and start_date<='{s}' and end_date>='{s}'").fetchall():
            actifs.add(sid)
    if "calendar_dates" in tables:
        for sid, t in con.execute(f"select service_id, exception_type from calendar_dates where date='{s}'").fetchall():
            (actifs.add if t == "1" else actifs.discard)(sid)
    return actifs


def simplifier(coords, tol):
    ln = LineString(coords)
    if len(coords) > 2:
        ln = ln.simplify(tol)
    return list(ln.coords)


def enc(coords):
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


def construire(cid):
    x0, y0, x1, y1 = BBOX[cid]; pad = 0.03
    dedans = lambda lon, lat: x0 - pad <= lon <= x1 + pad and y0 - pad <= lat <= y1 + pad
    out = os.path.join(HERE, "..", "out", cid)
    stops, cle_stop, lignes, formes, flux = [], {}, [], [], []
    jour_ref = None
    for nom, libelle, principal, extra in FEEDS[cid]:
        dossier = telecharger(nom, os.path.join(HERE, "..", "gtfs", cid))
        con = duckdb.connect()
        tables = set()
        for f in os.listdir(dossier):
            if f.endswith(".txt"):
                t = f[:-4]
                con.execute(f"create view {t} as select * from read_csv('{os.path.join(dossier, f)}', header=true, all_varchar=true, ignore_errors=true, strict_mode=false)")
                tables.add(t)
        jour, d0, d1 = mercredi_de_reference(con, tables)
        if principal:
            jour_ref = jour
        actifs = services_actifs(con, tables, jour)
        print(cid, nom, "jour", jour, "valide", d0, d1, "services", len(actifs), flush=True)
        # arrêts : un arrêt parent remplace ses quais
        sinfo = {}
        for sid, sn, la, lo, par, lt in con.execute("select " + colonnes(con, "stops", ["stop_id", "stop_name", "stop_lat", "stop_lon", "parent_station", "location_type"]) + " from stops").fetchall():
            try:
                sinfo[sid] = [sn, float(lo), float(la), par or "", lt or "0"]
            except Exception:
                pass
        def ident(sid):
            i = sinfo.get(sid)
            if not i:
                return None
            p = i[3]
            return (p if p and p in sinfo else sid)
        routes = {r[0]: r for r in con.execute("select " + colonnes(con, "routes", ["route_id", "route_short_name", "route_long_name", "route_type", "route_color"]) + " from routes").fetchall()}
        ct = colonnes(con, "trips", ["trip_id", "route_id", "direction_id", "shape_id", "trip_headsign", "service_id"])
        cs = colonnes(con, "stop_times", ["trip_id", "stop_id", "stop_sequence", "arrival_time", "departure_time"])
        rows = con.execute(f"""
            with t as (select {ct} from trips), st as (select {cs} from stop_times)
            select t.trip_id, t.route_id, coalesce(t.direction_id,'0'), coalesce(t.shape_id,''), coalesce(t.trip_headsign,''), t.service_id,
                   list(st.stop_id order by cast(st.stop_sequence as int)),
                   list(coalesce(nullif(st.arrival_time,''), nullif(st.departure_time,'')) order by cast(st.stop_sequence as int))
            from t join st on st.trip_id=t.trip_id group by all""").fetchall()
        rows = [r for r in rows if r[5] in actifs]
        print(cid, "voyages actifs", len(rows), flush=True)
        motifs = collections.OrderedDict()
        for tid, rid, dr, shp, head, sv, sl, tl in rows:
            ids = [ident(s) for s in sl]
            tm = [minutes(x) for x in tl]
            if None in ids or any(i not in sinfo for i in ids) or tm[0] is None:
                continue
            # temps manquants : interpolation linéaire
            k = [i for i, v in enumerate(tm) if v is not None]
            if len(k) < 2:
                continue
            arr = np.interp(range(len(tm)), k, [tm[i] for i in k])
            key = (rid, dr, tuple(ids))
            m = motifs.setdefault(key, {"depart": [], "rel": [], "shp": collections.Counter(), "head": collections.Counter()})
            m["depart"].append(arr[0]); m["rel"].append(arr - arr[0]); m["shp"][shp] += 1; m["head"][head] += 1
        # tracés
        shapes = {}
        if "shapes" in tables:
            need = set(s for m in motifs.values() for s in [m["shp"].most_common(1)[0][0]] if s)
            for sid, la, lo, sq in con.execute("select shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence from shapes").fetchall():
                if sid in need:
                    shapes.setdefault(sid, []).append((int(float(sq)), float(lo), float(la)))
        # regrouper : écarter les motifs isolés quand la ligne en a de plus fréquents
        par_ligne = collections.defaultdict(list)
        for key, m in motifs.items():
            par_ligne[(key[0], key[1])].append((len(m["depart"]), key))
        gardes = set()
        for lk, lst in par_ligne.items():
            lst.sort(reverse=True)
            for n, key in lst:
                if n >= 2 or len(lst) == 1 or n == lst[0][0]:
                    gardes.add(key)
        nl = 0
        for key in gardes:
            rid, dr, ids = key; m = motifs[key]
            r = routes.get(rid)
            if not r:
                continue
            seq = [i for i, s in enumerate(ids) if dedans(sinfo[s][1], sinfo[s][2])]
            if len(seq) < 2:
                continue
            # plus longue suite continue d'arrêts dans le cadre
            runs, cur = [], [seq[0]]
            for i in seq[1:]:
                if i == cur[-1] + 1:
                    cur.append(i)
                else:
                    runs.append(cur); cur = [i]
            runs.append(cur)
            run = max(runs, key=len)
            if len(run) < 2:
                continue
            a, b = run[0], run[-1]
            rel = np.median(np.array(m["rel"]), axis=0)
            t0 = rel[a]
            t = [round(float(rel[i] - t0), 1) for i in range(a, b + 1)]
            if any(t[i + 1] < t[i] for i in range(len(t) - 1)):
                t = [round(max(t[:i + 1]), 1) for i in range(len(t))]
            sidx = []
            for i in range(a, b + 1):
                s = ids[i]
                if s not in cle_stop:
                    cle_stop[s] = len(stops); stops.append([sinfo[s][0], round(sinfo[s][1], 5), round(sinfo[s][2], 5), -1, "b", s])
                sidx.append(cle_stop[s])
            mode = MODE.get(int(r[3] or 3), "b")
            fr = [0] * 5
            starts = [d % 1440 for d in m["depart"]]
            for bi, (b0, b1) in enumerate(BANDES):
                n = sum(1 for d in starts if b0 <= d < b1)
                if n:
                    fr[bi] = int(min(180, max(1, round((b1 - b0) / n)))) if n > 1 else int(min(180, b1 - b0))
            if not any(fr):
                continue
            couleur = (r[4] or "").strip().upper()
            if len(couleur) != 6 or not all(c in "0123456789ABCDEF" for c in couleur):
                couleur = DEFAUT.get(mode, "4A6FA5")
            nom_court = (r[1] or r[2] or rid)[:12]
            ligne = {"r": nom_court, "n": (r[2] or r[1] or rid)[:60], "m": mode, "c": couleur, "tete": m["head"].most_common(1)[0][0][:60],
                     "s": sidx, "t": t, "fr": [[0] + fr], "sh": -1}
            ligne.update(extra)
            # tracé : la forme du voyage le plus fréquent, rognée au cadre
            shp = m["shp"].most_common(1)[0][0]
            if shp in shapes:
                pts = [(lo, la) for _, lo, la in sorted(shapes[shp]) if dedans(lo, la)]
                if len(pts) >= 2:
                    e = enc(simplifier(pts, 2.5e-5))
                    if e:
                        ligne["sh"] = len(formes); formes.append(e)
            lignes.append(ligne); nl += 1
        print(cid, nom, "lignes", nl, flush=True)
        flux.append({"fichier": nom, "nom": libelle, "du": d0.isoformat(), "au": d1.isoformat(), "version": "", "principal": principal})
        con.close()
    # groupes de stations pour les arrêts de type métro : un groupe par nom proche
    types = {}
    for l in lignes:
        for s in l["s"]:
            if l["m"] in ("m",):
                types[s] = "m"
            elif l["m"] == "f" and types.get(s) != "m":
                types[s] = "f"
    for i, s in enumerate(stops):
        s[4] = types.get(i, "b")
    grp = {}
    gid = 0
    ms = [i for i, s in enumerate(stops) if s[4] == "m"]
    for i in ms:
        for j in ms:
            if j < i and stops[i][0].lower().split(" ")[0] == stops[j][0].lower().split(" ")[0]:
                dx = (stops[i][1] - stops[j][1]) * 90000; dy = (stops[i][2] - stops[j][2]) * 111200
                if dx * dx + dy * dy < 300 ** 2:
                    stops[i][3] = stops[j][3] if stops[j][3] >= 0 else gid
                    if stops[j][3] < 0:
                        stops[j][3] = gid; gid += 1
                    break
    # élaguer les arrêts inutilisés
    utiles = sorted(set(s for l in lignes for s in l["s"]))
    nouv = {a: b for b, a in enumerate(utiles)}
    stops2 = [stops[a][:5] for a in utiles]
    for l in lignes:
        l["s"] = [nouv[s] for s in l["s"]]
    for l in lignes:
        if l["sh"] < 0:
            del l["sh"]
    tj = {"bandes": BANDES, "jour": jour_ref.isoformat(), "stops": stops2, "lignes": lignes}
    def w(chemin, obj):
        with open(chemin, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        return os.path.getsize(chemin)
    print(cid, "transport.json", w(os.path.join(out, "transport.json"), tj) // 1024, "Ko;", len(stops2), "arrêts;", len(lignes), "lignes")
    print(cid, "formes.json", w(os.path.join(out, "formes.json"), formes) // 1024, "Ko;", len(formes), "tracés")
    fp = [f for f in flux if f["principal"]][0]
    w(os.path.join(out, "flux.json"), {"du": fp["du"], "au": fp["au"], "jour_reference": jour_ref.isoformat(), "verifie_le": "2026-11-02", "flux": flux})


if __name__ == "__main__":
    construire(sys.argv[1])
