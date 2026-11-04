/* Fonctions pures : sans accès à la page ni au réseau, donc testables seules (tests/unitaires/).
   Chargées avant le script principal, qui les utilise par l'objet global Purs. */
(function (racine) {
  "use strict";
  var P = {};

  // minuscules sans accents
  P.normaliser = function (s) { return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); };

  // identifiant de ville : « São Paulo » donne « sao-paulo » (30 caractères au plus)
  P.slug = function (s) { return P.normaliser(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "ville"; };

  // empreinte de 8 caractères hexadécimaux (FNV-1a) : identifiant court et stable d'un lieu
  P.hash8 = function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ("00000000" + (h >>> 0).toString(16)).slice(-8); };

  // ligne [[lon, lat], ...] vers un tableau plat d'entiers : premier point en 1e-5 degré, puis les écarts successifs.
  // Les points consécutifs identiques sont fusionnés ; renvoie null s'il reste moins de deux points.
  P.encoderLigne = function (co) {
    var pts = [], p, i;
    for (i = 0; i < co.length; i++) {
      p = [Math.round(co[i][0] * 1e5), Math.round(co[i][1] * 1e5)];
      if (!pts.length || p[0] !== pts[pts.length - 1][0] || p[1] !== pts[pts.length - 1][1]) pts.push(p);
    }
    if (pts.length < 2) return null;
    var f = [pts[0][0], pts[0][1]];
    for (i = 1; i < pts.length; i++) f.push(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return f;
  };

  // aire en m2 d'un anneau fermé [[lon, lat], ...] ; kx = mètres par degré de longitude à cette latitude
  P.aireM2 = function (anneau, kx) { var s = 0; for (var i = 0; i < anneau.length - 1; i++) s += anneau[i][0] * anneau[i + 1][1] - anneau[i + 1][0] * anneau[i][1]; return Math.abs(s / 2) * kx * 111200; };

  // classes de rues, dans l'ordre utilisé par les fichiers de cellules (identique à la liste CLASSES de core.js)
  P.CLASSES_ROUTES = ["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified", "service",
    "living_street", "pedestrian", "footway", "cycleway", "path", "steps", "track", "autre"];
  P.classeRoute = function (c) { var i = P.CLASSES_ROUTES.indexOf(c); if (i >= 0) return i; return (c === "parking_aisle" || c === "driveway" || c === "alley") ? 7 : c === "bridleway" ? 12 : 15; };

  // groupe d'activité d'une catégorie de lieu d'Overture Maps (null : lieu écarté)
  P.groupeLieu = function (c) {
    c = c || "";
    if (/^(hotel|lodging|hostel|motel|resort|bed_and_breakfast|inn|boutique_hotel)$/.test(c)) return "hotel";
    if (/(^|_)(cafe|coffee_shop|coffee|bar|pub|brewery|tea_room|wine_bar|cocktail_bar)(_|$)/.test(c)) return "cafe";
    if (/restaurant|casual_eatery|eatery|bakery|pizza|diner|food_court/.test(c)) return "resto";
    if (/museum|art_gallery|gallery|cultural_center|library/.test(c)) return "musee";
    if (/historic|monument|landmark|memorial|castle|cathedral|place_of_worship|church|temple|mosque|synagogue|lighthouse|bridge/.test(c)) return "histoire";
    if (/^(park|public_plaza|plaza|beach|zoo|aquarium|botanical_garden|garden|observation_deck|nature_reserve|playground)/.test(c)) return "nature";
    if (/theat|concert|opera|performing|music_venue|stadium|arena|amusement|skating|cinema|sports_and_recreation/.test(c)) return "spectacle";
    return null;
  };

  // regroupe des plages d'octets [{a, b}] : celles séparées de moins de ecartMax octets sont lues d'une seule requête.
  // Renvoie [{a, b, items}] dans l'ordre croissant.
  P.fusionnerPlages = function (plages, ecartMax) {
    if (ecartMax === undefined) ecartMax = 196608;
    var l = plages.slice().sort(function (p, q) { return p.a - q.a; }), gr = [];
    l.forEach(function (it) { var g = gr[gr.length - 1]; if (g && it.a - g.b <= ecartMax) { g.items.push(it); if (it.b > g.b) g.b = it.b; } else gr.push({ a: it.a, b: it.b, items: [it] }); });
    return gr;
  };

  // fichiers : [[nom, [[xmin, ymin, xmax, ymax, nbLignes], ...]], ...] (rectangles en centièmes de degré, arrondis vers l'extérieur).
  // W = [lonMin, latMin, lonMax, latMax]. Renvoie [[nom, [[premiereLigne, finLigne], ...]], ...] pour les groupes de lignes qui touchent W.
  P.groupesTouches = function (fichiers, W) {
    var taches = [];
    fichiers.forEach(function (e) {
      var s = 0, hit = [];
      e[1].forEach(function (g) { if (g[0] <= W[2] * 100 && g[2] >= W[0] * 100 && g[1] <= W[3] * 100 && g[3] >= W[1] * 100) hit.push([s, s + g[4]]); s += g[4]; });
      if (hit.length) taches.push([e[0], hit]);
    });
    return taches;
  };

  // adresses de recherche de vol. p : { O, D } = { liste: [codes], un: code } pour le départ et l'arrivée, date, retour (YYYY-MM-DD, facultatif),
  // aller_retour (booléen), adultes, classe (economy|premium|business|first), direct (booléen), apres et avant (HH:MM, facultatifs).
  P.construireLiensVol = function (p) {
    var re = /^\d{4}-\d{2}-\d{2}$/, d = p.date || "", dr = p.retour || "", n = p.adultes || 1, c = p.classe || "economy", O = p.O, D = p.D;
    var dv = re.test(d), drv = !!p.aller_retour && re.test(dr) && dr >= d;
    var h12 = function (t) { var m = /^(\d{2}):(\d{2})$/.exec(t || ""); if (!m) return ""; var h = +m[1]; return (h % 12 || 12) + ":" + m[2] + (h < 12 ? " AM" : " PM"); };
    var ymd = function (x) { return x.slice(2, 4) + x.slice(5, 7) + x.slice(8, 10); };
    var mdy = function (x) { return x.slice(5, 7) + "/" + x.slice(8, 10) + "/" + x.slice(0, 4); };
    var cg = { premium: " premium economy", business: " business class", first: " first class" }[c] || "";
    var gf = "https://www.google.com/travel/flights?hl=fr&q=" + encodeURIComponent("Flights from " + O.liste.join(" or ") + " to " + D.liste.join(" or ") + (dv ? " on " + d : "") + (drv ? " returning " + dr : "") + (p.direct ? " nonstop" : "") + (n > 1 ? " for " + n + " adults" : "") + cg + (p.apres ? " departing after " + h12(p.apres) : "") + (p.avant ? " arriving before " + h12(p.avant) : ""));
    var cs = { economy: "economy", premium: "premiumeconomy", business: "business", first: "first" }[c] || "economy";
    var sk = "https://www.skyscanner.fr/transport/vols/" + O.un.toLowerCase() + "/" + D.un.toLowerCase() + "/" + (dv ? ymd(d) + "/" : "") + (drv ? ymd(dr) + "/" : "") + "?adultsv2=" + n + "&cabinclass=" + cs + (p.direct ? "&preferdirects=true" : "");
    var ky = "https://www.kayak.fr/flights/" + O.liste.join(",") + "-" + D.liste.join(",") + "/" + (dv ? d + "/" : "") + (drv ? dr + "/" : "") + n + "adults" + ({ premium: "/premium", business: "/business", first: "/first" }[c] || "") + (p.direct ? "?fs=stops=0" : "");
    var opt = []; if (c !== "economy") opt.push("cabinclass:" + { premium: "premium_economy", business: "business", first: "first" }[c]); if (p.direct) opt.push("maxhops:0");
    var ex = "https://www.expedia.com/Flights-Search?trip=" + (drv ? "roundtrip" : "oneway") + "&leg1=from:" + O.un + ",to:" + D.un + (dv ? ",departure:" + mdy(d) + "TANYT" : "") + (drv ? "&leg2=from:" + D.un + ",to:" + O.un + ",departure:" + mdy(dr) + "TANYT" : "") + "&passengers=adults:" + n + (opt.length ? "&mode=search&options=" + opt.join(",") : "&mode=search");
    return { gf: gf, sk: sk, ky: ky, ex: ex, dv: dv, drv: drv };
  };

  racine.Purs = P;
  if (typeof module !== "undefined" && module.exports) module.exports = P;
})(typeof window !== "undefined" ? window : globalThis);
