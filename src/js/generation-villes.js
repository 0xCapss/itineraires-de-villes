  /* ---------- destinations à la demande : la carte d'une ville du monde est construite à partir des données ouvertes d'Overture Maps ----------
     Les fichiers de cellules (bâtiments, routes), l'eau, les parcs et les lieux sont fabriqués dans le navigateur, au format des villes préparées :
     le reste de l'application (trajets, étapes, budget, rapport) les lit comme ceux d'une ville préparée. */
  var OD_CUR={US:"USD",EC:"USD",PA:"USD",SV:"USD",PR:"USD",CA:"CAD",GB:"GBP",CH:"CHF",LI:"CHF",MX:"MXN",JP:"JPY",CN:"CNY",IN:"INR",BR:"BRL",AR:"ARS",CL:"CLP",CO:"COP",PE:"PEN",UY:"UYU",BO:"BOB",PY:"PYG",VE:"VES",CR:"CRC",GT:"GTQ",HN:"HNL",NI:"NIO",DO:"DOP",CU:"CUP",JM:"JMD",AU:"AUD",NZ:"NZD",TH:"THB",VN:"VND",ID:"IDR",MY:"MYR",SG:"SGD",PH:"PHP",KR:"KRW",TW:"TWD",HK:"HKD",KH:"KHR",LA:"LAK",MM:"MMK",LK:"LKR",NP:"NPR",PK:"PKR",BD:"BDT",TR:"TRY",EG:"EGP",MA:"MAD",TN:"TND",DZ:"DZD",ZA:"ZAR",KE:"KES",TZ:"TZS",ET:"ETB",NG:"NGN",GH:"GHS",SN:"XOF",CI:"XOF",AE:"AED",SA:"SAR",QA:"QAR",IL:"ILS",JO:"JOD",IS:"ISK",NO:"NOK",SE:"SEK",DK:"DKK",PL:"PLN",CZ:"CZK",HU:"HUF",RO:"RON",BG:"BGN",RS:"RSD",UA:"UAH",RU:"RUB",KZ:"KZT",UZ:"UZS",GE:"GEL",AM:"AMD",AL:"ALL",MK:"MKD",BA:"BAM"};
  "AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK".split(" ").forEach(function(p){ OD_CUR[p]="EUR"; });
  var OD={idx:null,villes:null,slices:new Map(),taille:0,foot:{},acc:{},conc:(navigator.deviceMemory && navigator.deviceMemory<=4)?2:3,actifs:0,attente:[],file:Promise.resolve(),parcs:true,minuteur:null};
  var OD_B="https://overturemaps-us-west-2.s3.amazonaws.com/", OD_DC=0.01, OD_CACHE_MAX=350*1048576;
  var OD_TH={bati:"building",routes:"segment",noms:"segment",lieux:"place",eau:"water",usage:"land_use",quartiers:"division"};
  var OD_COLS={bati:["id","bbox","height","num_floors","geometry"],routes:["id","bbox","class","subtype","geometry"],noms:["id","bbox","class","subtype","names","geometry"],
    lieux:["id","bbox","names","basic_category","confidence","geometry"],eau:["id","bbox","subtype","class","names","geometry"],usage:["id","bbox","class","subtype","names","geometry"],quartiers:["id","bbox","subtype","names","geometry"]};
  var OD_VEDETTES=["Mexico","Paris","New York","Tokyo","Istanbul","Lisbonne","Marrakech","Rome","Londres","Buenos Aires","Bangkok","Sydney"];
  var OD_LIB={bati:"Bâtiments",routes:"Rues",lieux:"Lieux",eau:"Eau",quartiers:"Quartiers"};
  function odProg(t){ var st=document.getElementById("odetat"), m=document.getElementById("odmodal"); if(st && m && !m.hidden) st.textContent=t; if(etat && !etat.hidden) etat.textContent=t; }
  // les données lourdes (liste des villes, index d'Overture Maps, lecteur parquet) ne sont chargées qu'à la première utilisation de « Générer une ville »
  function odVilles(){ return OD.villes||[]; }
  function odVillesCharger(){
    if(!OD.villesP) OD.villesP=fetch("data/villes_20k.json").then(function(r){ if(!r.ok) throw new Error("liste des villes : HTTP "+r.status); return r.json(); })
      .then(function(v){ OD.villes=v; return v; }).catch(function(e){ OD.villesP=null; throw e; });
    return OD.villesP;
  }
  async function odIndex(){
    if(OD.idx) return OD.idx;
    var r=await fetch("data/index_overture.json.wasm"); if(!r.ok) throw new Error("index des fichiers : HTTP "+r.status);
    var b=new Uint8Array(await r.arrayBuffer());      // le serveur peut avoir déjà décompressé
    OD.idx=JSON.parse(b[0]===0x1f && b[1]===0x8b ? await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text() : new TextDecoder().decode(b));
    return OD.idx;
  }
  function odPQ(){
    if(typeof PQ!=="undefined") return Promise.resolve();
    if(!OD.pqP) OD.pqP=new Promise(function(ok,ko){ var sc=document.createElement("script"); sc.src="vendor/pq.js"; sc.onload=function(){ ok(); }; sc.onerror=function(){ OD.pqP=null; ko(new Error("lecteur de fichiers : chargement impossible")); }; document.head.appendChild(sc); });
    return OD.pqP;
  }
  function odPret(){ return Promise.all([odIndex(),odPQ()]); }
  // lecture par morceaux d'un fichier distant ; les octets déjà reçus sont gardés (les zones voisines relisent les mêmes groupes de lignes)
  async function odTampon(url,th){
    var r=await fetch(url,{headers:{Range:"bytes=0-0"}});
    if(!r.ok && r.status!==206) throw new Error("HTTP "+r.status);
    var cr=r.headers.get("content-range"); if(!cr) throw new Error("en-tête Content-Range non exposé");
    var len=+cr.split("/")[1], lot=[], minu=null;
    function garder(k,buf){ OD.slices.set(k,buf); OD.taille+=buf.byteLength; for(var it=OD.slices.keys(); OD.taille>OD_CACHE_MAX; ){ var kk=it.next().value; if(kk==null||kk===k) break; OD.taille-=OD.slices.get(kk).byteLength; OD.slices.delete(kk); } }
    // les colonnes d'un groupe de lignes sont demandées ensemble : les morceaux séparés de moins de 192 Ko sont lus d'un coup (beaucoup moins de requêtes)
    async function envoyer(){
      var gr=Purs.fusionnerPlages(lot,196608); lot=[]; minu=null;
      await Promise.all(gr.map(async function(g){
        try{ var x=await fetch(url,{headers:{Range:"bytes="+g.a+"-"+(g.b-1)}}); if(!x.ok && x.status!==206) throw new Error("HTTP "+x.status);
          var buf=await x.arrayBuffer(); OD.acc[th]=(OD.acc[th]||0)+buf.byteLength;
          g.items.forEach(function(it){ var s=buf.slice(it.a-g.a,it.b-g.a); garder(url+"|"+it.a+"|"+it.b,s); it.ok(s); });
        }catch(e){ g.items.forEach(function(it){ it.ko(e); }); } }));
    }
    return {byteLength:len,slice:function(a,b){
      b=b==null?len:b; var k=url+"|"+a+"|"+b, h=OD.slices.get(k);
      if(h){ OD.slices.delete(k); OD.slices.set(k,h); return Promise.resolve(h); }
      return new Promise(function(ok,ko){ lot.push({a:a,b:b,ok:ok,ko:ko}); if(!minu) minu=setTimeout(envoyer,3); }); }};
  }
  function odFichier(url,th){
    if(!OD.foot[url]) OD.foot[url]=(async function(){ var f=await odTampon(url,th), md=await PQ.parquetMetadataAsync(f); return {f:f,md:md}; })().catch(function(e){ delete OD.foot[url]; throw e; });
    return OD.foot[url];
  }
  function odCreneau(){ return new Promise(function(ok){ if(OD.actifs<OD.conc){ OD.actifs++; ok(); } else OD.attente.push(ok); }); }
  function odLibere(){ var n=OD.attente.shift(); if(n) n(); else OD.actifs--; }
  async function odLire(cle,W){
    var idx=await odIndex(), th=idx[OD_TH[cle]], gardes=[], taches=Purs.groupesTouches(th.f,W);
    for(var i=0;i<taches.length;i++){
      var o=await odFichier(OD_B+th.p+taches[i][0],cle);
      for(var q=0;q<taches[i][1].length;q++){
        var pl=taches[i][1][q]; await odCreneau();
        try{ await PQ.parquetRead({file:o.f,metadata:o.md,compressors:PQ.compressors,columns:OD_COLS[cle],rowStart:pl[0],rowEnd:pl[1],rowFormat:"object",
          onComplete:function(rows){ for(var k=0;k<rows.length;k++){ var x=rows[k], b=x.bbox; if(b && b.xmin<=W[2] && b.xmax>=W[0] && b.ymin<=W[3] && b.ymax>=W[1]){ if(cle==="lieux"){ x._u=OD_B+th.p+taches[i][0]; x._r=pl[0]+k; } gardes.push(x); } } }}); }
        finally{ odLibere(); }
      }
    }
    return gardes;
  }
  function odCle(O,lon,lat){ return Math.floor((lon-O.GR.lon0)/O.GR.dc)+"_"+Math.floor((lat-O.GR.lat0)/O.GR.dc); }
  // fonctions pures : voir src/js/purs.js (testées dans tests/unitaires/)
  var odEnc=Purs.encoderLigne, odAire=Purs.aireM2, odClasse=Purs.classeRoute, odHash=Purs.hash8, odSlug=Purs.slug, odGroupe=Purs.groupeLieu;
  var OD_TYPE={histoire:"m",musee:"m",nature:"m",spectacle:"m",resto:"r",cafe:"r",hotel:"h"};
  function odGeo(O,cle,rows,filtre){
    var fc=O.geo[cle], n=0, et=cle==="eau"?"e":"v";
    rows.forEach(function(x){
      if(x.id==null || O.ids[cle+x.id] || !x.geometry || x.bbox.xmax-x.bbox.xmin>=0.3) return;
      var cl=filtre(x); if(!cl) return; O.ids[cle+x.id]=1;
      var g=x.geometry, P=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];
      P.forEach(function(poly){ var ring=poly[0]; if(!ring||ring.length<4) return;
        fc.features.push({type:"Feature",properties:{cl:cl},geometry:{type:"Polygon",coordinates:[ring.map(function(c){ return [Math.round(c[0]*1e5)/1e5,Math.round(c[1]*1e5)/1e5]; })]}}); n++;
        var nm=x.names&&x.names.primary, ar=nm?odAire(ring,O.kx):0;
        if(nm && ar>15000){ var cx=0, cy=0, k=ring.length-1; for(var a=0;a<k;a++){ cx+=ring[a][0]; cy+=ring[a][1]; } cx/=k; cy/=k;
          var cur=O.zmap[nm]; if(!cur||ar>cur[4]){ var z=[nm,et,Math.round(cx*1e5)/1e5,Math.round(cy*1e5)/1e5,Math.round(ar)]; if(cur){ cur[0]=z[0]; cur[1]=z[1]; cur[2]=z[2]; cur[3]=z[3]; cur[4]=z[4]; } else { O.zmap[nm]=z; O.zones.push(z); } } }
      });
    });
    return n;
  }
  // fabrique les fichiers des cellules demandées (celles qui ne sont pas déjà chargées) ; renvoie ce qui s'ajoute à la ville affichée
  async function odCharger(O,i0,j0,i1,j1){
    var cibles={}, nc=0, i, j;
    for(i=i0;i<=i1;i++) for(j=j0;j<=j1;j++){ var k=i+"_"+j; if(!O.charge[k]){ cibles[k]=1; nc++; } }
    if(!nc) return null;
    var G=O.GR, m=0.004, W=[G.lon0+i0*G.dc-m,G.lat0+j0*G.dc-m,G.lon0+(i1+1)*G.dc+m,G.lat0+(j1+1)*G.dc+m];
    var res=await Promise.all(["bati","routes","lieux"].map(function(cle){ return odLire(cle,W).then(function(r){ odProg(OD_LIB[cle]+" : "+r.length.toLocaleString("fr-FR")+" éléments lus ("+((OD.acc[cle]||0)/1e6).toFixed(1).replace(".",",")+" Mo)"); return r; }); }));
    var bat={}, rou={}, axes=[], KXo=O.kx;
    res[0].forEach(function(x){
      var g=x.geometry; if(!g) return; var P=g.type==="Polygon"?[g.coordinates]:g.type==="MultiPolygon"?g.coordinates:[];
      var h=x.height>0?Math.round(x.height):(x.num_floors>0?Math.round(x.num_floors*3.2):9);
      P.forEach(function(poly){
        var ring=poly[0]; if(!ring||ring.length<4||odAire(ring,KXo)<15) return;
        var cx=0, cy=0, n=ring.length-1; for(var a=0;a<n;a++){ cx+=ring[a][0]; cy+=ring[a][1]; } cx/=n; cy/=n;
        var k=odCle(O,cx,cy); if(!cibles[k]) return;
        var e=odEnc(ring.slice(0,-1)); if(!e||e.length<8) return;
        (bat[k]||(bat[k]=[])).push([Math.max(1,Math.min(h,400)),e]);
      });
    });
    res[1].forEach(function(x){
      if(x.subtype!=="road"||!x.geometry) return; var ci=odClasse(x.class), g=x.geometry;
      var L=g.type==="LineString"?[g.coordinates]:g.type==="MultiLineString"?g.coordinates:[];
      L.forEach(function(co){
        var e=odEnc(co); if(!e) return; var k=odCle(O,co[0][0],co[0][1]); if(!cibles[k]) return;
        (rou[k]||(rou[k]=[])).push([ci,e]); if(ci<=3) axes.push([ci,e]);
      });
    });
    Object.keys(cibles).forEach(function(k){
      O.charge[k]=1; var c={};
      if(bat[k]){ var fb={b:bat[k]}; O.files["b_"+k+".json"]=fb; c.b=JSON.stringify(fb).length; }
      if(rou[k]){ var fr={r:rou[k],l:[]}; O.files["r_"+k+".json"]=fr; c.r=JSON.stringify(fr).length; }
      if(c.b||c.r) O.GR.cellules[k]=c;
    });
    O.axes=O.axes.concat(axes);
    // lieux : mêmes champs et mêmes types que les villes préparées
    var nouveaux=[];
    res[2].forEach(function(x){
      if(x.id==null||O.ids["l"+x.id]) return; var nm=x.names&&x.names.primary, g=odGroupe(x.basic_category), cf=x.confidence||0;
      if(!nm||!g||cf<0.45||!x.geometry||x.geometry.type!=="Point") return;
      var t=OD_TYPE[g]; if(t==="m" && (/^\d/.test(nm)||/\b(apartments?|condominiums?|condos?|lofts?|residences?|townhouses?)\b/i.test(nm))) return;
      O.ids["l"+x.id]=1;
      var e={n:nm,t:t,c:x.basic_category,lon:Math.round(x.geometry.coordinates[0]*1e5)/1e5,lat:Math.round(x.geometry.coordinates[1]*1e5)/1e5,i:odHash(String(x.id))};
      e._u=x._u; e._r=x._r;
      e.q=cf>=0.9?3:cf>=0.7?2:1; e._s=cf;
      O.lieux.push(e); nouveaux.push(e);
    });
    return {axes:axes,lieux:nouveaux,cibles:Object.keys(cibles),W:W};
  }
  // noms de rues : lus après l'affichage des rues (colonne la plus lourde) puis ajoutés aux cellules et à l'étiquetage
  async function odNoms(O,nv){
    if(!nv||!nv.cibles||!nv.cibles.length) return;
    var rows=await odLire("noms",nv.W), cibles={}, lab={};
    nv.cibles.forEach(function(k){ cibles[k]=1; });
    rows.forEach(function(x){
      var nm=x.names&&x.names.primary; if(x.subtype!=="road"||!nm||!x.geometry) return; var ci=odClasse(x.class); if(ci>6) return; var g=x.geometry;
      var L=g.type==="LineString"?[g.coordinates]:g.type==="MultiLineString"?g.coordinates:[];
      L.forEach(function(co){
        var k=odCle(O,co[0][0],co[0][1]); if(!cibles[k]) return; var len=0;
        for(var a=1;a<co.length;a++) len+=Math.hypot(co[a][0]-co[a-1][0],co[a][1]-co[a-1][1]);
        if(len<=0.0008) return; var lk=lab[k]||(lab[k]={}), cur=lk[nm];
        if(!cur||len>cur[0]) lk[nm]=[len,[nm,ci,Math.round(co[0][0]*1e5),Math.round(co[0][1]*1e5),Math.round(co[co.length-1][0]*1e5),Math.round(co[co.length-1][1]*1e5)]];
      });
    });
    var actif=(VILLE.od===O);
    Object.keys(lab).forEach(function(k){
      var f=O.files["r_"+k+".json"]; if(!f) return;
      var ls=Object.keys(lab[k]).map(function(n){ return lab[k][n]; }).sort(function(a,b){ return b[0]-a[0]; }).slice(0,160).map(function(t){ return t[1]; });
      f.l=ls;
      if(actif && CEL[k] && CEL[k].r){ ls.forEach(function(e){ RUES.push({n:e[0],cl:CLASSES[e[1]],axe:e[1]<=3,A:[e[2]/1e5,e[3]/1e5],B:[e[4]/1e5,e[5]/1e5]}); }); }
    });
    if(actif) programmer();
  }
  // eau, cours d'eau nommés et quartiers : lus après l'affichage des rues et des bâtiments
  async function odSecondaire(O,nv){
    if(!nv||!nv.W) return;
    var res=await Promise.all(["eau","quartiers"].map(function(cle){ return odLire(cle,nv.W).then(function(r){ odProg(OD_LIB[cle]+" : "+r.length.toLocaleString("fr-FR")+" éléments lus ("+((OD.acc[cle]||0)/1e6).toFixed(1).replace(".",",")+" Mo)"); return r; }); }));
    res[1].forEach(function(x){
      if(x.id==null||O.ids["q"+x.id]||!x.geometry||x.geometry.type!=="Point") return; var nm=x.names&&x.names.primary; if(!nm) return;
      var lon=x.geometry.coordinates[0], lat=x.geometry.coordinates[1], e={n:nm,lon:Math.round(lon*1e5)/1e5,lat:Math.round(lat*1e5)/1e5};
      if(x.subtype==="neighborhood"||x.subtype==="macrohood"){ O.ids["q"+x.id]=1; O.quart.push(e); }
      else if(x.subtype==="locality"||x.subtype==="borough"||x.subtype==="localadmin"){ O.ids["q"+x.id]=1; O.arr.push(e); }
    });
    var n=odGeo(O,"eau",res[0],function(x){ return x.subtype||"water"; });
    odAppliquer(O,{eau:n>0});
  }
  async function odParcs(O,i0,j0,i1,j1){
    var G=O.GR, m=0.004, W=[G.lon0+i0*G.dc-m,G.lat0+j0*G.dc-m,G.lon0+(i1+1)*G.dc+m,G.lat0+(j1+1)*G.dc+m];
    var rows=await odLire("usage",W); odProg("Parcs et zones vertes : "+rows.length.toLocaleString("fr-FR")+" éléments lus");
    return odGeo(O,"vert",rows,function(x){ return (x.subtype==="park"||x.subtype==="recreation"||/^(park|garden|golf_course|playground|nature_reserve|recreation_ground)$/.test(x.class||"")) ? (x.subtype||"park") : null; })>0;
  }
  function odEnfile(fn){ var p=OD.file.then(fn,fn); OD.file=p.catch(function(){}); return p; }
  // met à jour la carte quand la ville affichée est celle dont les données viennent d'arriver
  function odAppliquer(O,nv){
    if(!nv || VILLE.od!==O) return;
    if(nv.axes && nv.axes.length){
      nv.axes.forEach(function(a){ FC.axes.features.push({type:"Feature",properties:{ci:a[0]},geometry:{type:"LineString",coordinates:decoder(a[1],false)}}); });
      var sa=carte.getSource("axes"); if(sa) sa.setData(FC.axes);
    }
    if(nv.eau){ var se=carte.getSource("eau"); if(se) se.setData(O.geo.eau); GEO.eau=preparerPoly(O.geo.eau); }
    if(nv.vert){ var sv=carte.getSource("vert"); if(sv) sv.setData(O.geo.vert); GEO.vert=preparerPoly(O.geo.vert); }
    if(nv.lieux && nv.lieux.length && base.length){
      var ids={}; base.forEach(function(b){ ids[b.i]=1; });
      nv.lieux.forEach(function(e){ if(!ids[e.i]){ var c={}; Object.keys(e).forEach(function(k){ if(k!=="_s") c[k]=e[k]; }); c.nn=norm(c.n); base.push(c); } });
      if(!ajout.hidden){ rechercher(); poiMaj(); }
    }
    programmerMaj(); programmer();
  }
  // données de départ d'une destination : 3 x 3 cellules autour du centre
  async function odPreparer(v){
    var O=v.od; if(O.pret) return;
    if(O.preparation) return O.preparation;
    O.preparation=odEnfile(async function(){
      var ci=Math.floor((v.lon-O.GR.lon0)/O.GR.dc), cj=Math.floor((v.lat-O.GR.lat0)/O.GR.dc);
      OD.acc={}; await odPret();
      var nv=await odCharger(O,ci,cj,ci,cj);
      odSecondaire(O,nv).catch(function(){}); odNoms(O,nv).catch(function(){});
      var top=O.lieux.filter(function(e){ return e.t==="m"; }).sort(function(a,b){ return b._s-a._s; }).slice(0,30);
      O.reperes=top.map(function(e){ return {n:e.n,lon:e.lon,lat:e.lat,ar:"od"}; });
      O.pret=true;
      if(OD.parcs){ odParcs(O,ci-1,cj-1,ci+1,cj+1).then(function(vert){ odAppliquer(O,{vert:vert}); }).catch(function(){}); }
    }).finally(function(){ O.preparation=null; });
    return O.preparation;
  }
  function odAuto(){
    if(!VILLE.od || ctxEmprunte || villeEnCours || carte.getZoom()<14) return;
    var O=VILLE.od, c=carte.getCenter(), ci=Math.floor((c.lng-O.GR.lon0)/O.GR.dc), cj=Math.floor((c.lat-O.GR.lat0)/O.GR.dc);
    var manque=false; for(var a=-1;a<=1;a++) for(var b=-1;b<=1;b++) if(!O.charge[(ci+a)+"_"+(cj+b)]) manque=true;
    if(!manque || O.auto) return; O.auto=true;
    odEnfile(async function(){ var nv=await odCharger(O,ci-1,cj-1,ci+1,cj+1); odAppliquer(O,nv); odSecondaire(O,nv).catch(function(){}); odNoms(O,nv).catch(function(){});
      if(OD.parcs) odParcs(O,ci-1,cj-1,ci+1,cj+1).then(function(vert){ odAppliquer(O,{vert:vert}); }).catch(function(){}); })
      .catch(function(e){ etat.hidden=false; etat.textContent="Chargement de la zone impossible : "+e.message; setTimeout(function(){ etat.hidden=true; },5000); })
      .finally(function(){ O.auto=false; });
  }
  carte.on("moveend",function(){ clearTimeout(OD.minuteur); OD.minuteur=setTimeout(odAuto,350); });
  window.__odTouch=function(v){ if(v&&v.od){ v.od.dernier=Date.now(); odHistoSauver(); } };
  window.__odDbg=function(dlon){ if(dlon) carte.jumpTo({center:[carte.getCenter().lng+dlon,carte.getCenter().lat]}); var O=VILLE.od; return O?{charge:Object.keys(O.charge).length,cellules:Object.keys(O.GR.cellules).length,lieux:O.lieux.length,quartiers:O.quart.length,arrondissements:O.arr.length,zones:O.zones.length,pret:O.pret,zoom:carte.getZoom()}:null; };
  // création de la ville dans la liste ; données chargées à l'ouverture (changerVille)
  var OD_MAX=10, OD_CLE="od-historique";
  function odHistoSauver(){
    try{ var l=VILLES.filter(function(v){ return v.od; }).sort(function(a,b){ return b.od.dernier-a.od.dernier; }).slice(0,OD_MAX).map(function(v){ return [v.nom,v.pays,v.lon,v.lat,v.od.dernier]; });
      localStorage.setItem(OD_CLE,JSON.stringify(l)); }catch(x){}
  }
  // ne garde que les 10 villes générées les plus récemment utilisées (la ville affichée n'est jamais retirée)
  function odElaguer(){
    var ods=VILLES.filter(function(v){ return v.od; }).sort(function(a,b){ return a.od.dernier-b.od.dernier; }), retirees=[];
    for(var i=0;ods.length-retirees.length>OD_MAX && i<ods.length;i++){
      var v=ods[i]; if(v.id===VILLE.id) continue;
      var k=VILLES.indexOf(v); if(k>=0) VILLES.splice(k,1);
      var opt=document.querySelector('#ville option[value="'+v.id+'"]'); if(opt) opt.remove();
      effacerVilleStock(v.id); delete CTX_VILLES[v.id]; retirees.push(v.nom);
    }
    if(retirees.length){ annonce("Historique limité à "+OD_MAX+" villes générées : "+retirees.join(", ")+" retirée"+(retirees.length>1?"s":"")+" de la liste."); }
    odHistoSauver();
  }
  function odCreerVille(e,silencieux){
    var nom=String(e[0]).slice(0,60), cc=String(e[1]||"").slice(0,3), lon=+e[2], lat=+e[3];
    if(!isFinite(lon)||!isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>85) return null;
    var id="od-"+odSlug(nom)+"-"+cc.toLowerCase()+"-"+Math.round(Math.abs(lon)*10)+(lon<0?"w":"e"), ex=null;
    VILLES.forEach(function(v){ if(v.id===id) ex=v; });
    if(ex) return ex;
    var kx=Math.round(111320*Math.cos(lat*Math.PI/180)), dev=OD_CUR[cc]||("?"+cc);
    var O={GR:{lon0:Math.round(lon*100)/100-0.5,lat0:Math.round(lat*100)/100-0.5,dc:OD_DC,cellules:{}},charge:{},files:{},axes:[],lieux:[],ids:{},geo:{eau:{type:"FeatureCollection",features:[]},vert:{type:"FeatureCollection",features:[]}},
      kx:kx,pret:false,reperes:[],zones:[],zmap:{},quart:[],arr:[],tarifs:{verifie:false,note:"Destination à la demande : tarif de taxi générique en euros, sans rapport avec les tarifs du pays. Aucun réseau de transports en commun.",devise:"€",metro_bus:0,
        taxi:{prise_en_charge:2.5,surtaxe_mta:0,amelioration:0,par_km:1.1,par_minute_lent:0.35,seuil_lent_mph:12,congestion_sud_96e:0,peage_zone_sud_60e:0,nuit:0,pointe_semaine:0}}};
    var v={id:id,nom:nom,nom_long:nom,dossier:id,pays:cc,devise:"monnaie locale",kx:kx,ky:111200,lat:lat,lon:lon,dst:"od",centre:[lon,lat],zoom:14.6,zoom_min:9,
      limites:[[lon-0.6,lat-0.45],[lon+0.6,lat+0.45]],shards:["od"],zone_taxi:null,gtfs_mention:"Overture Maps (pas de transports en commun)",feries:[],depart:[],
      devise_code:dev,taxi_devise:"EUR",od:O,notes_hotels:{tripadvisor:nom+", "+cc,booking:nom},
      note_transport:"Destination construite à la demande : pas de transports en commun, trajets à pied et en taxi uniquement (taxi estimé en euros, tarif générique). Les horaires d'ouverture ne sont pas disponibles : à saisir dans les fiches."};
    v.od.dernier=+e[4]>0?+e[4]:Date.now();
    VILLES.push(v);
    var sel=document.getElementById("ville"), opt=document.createElement("option"); opt.value=id; opt.textContent=nom;
    var autre=sel.querySelector('option[value="__od__"]'); sel.insertBefore(opt,autre);
    if(!silencieux) odElaguer();
    return v;
  }
  // fichiers « virtuels » d'une destination, lus par le reste de l'application comme ceux d'une ville préparée
  function odJson(u){
    if(u && typeof u==="object") return Promise.resolve(u);
    u=String(u); if(u.indexOf("od-")!==0) return null;
    var dos=u.split("/")[0], nom=u.slice(dos.length+1), O=null; VILLES.forEach(function(v){ if(v.dossier===dos && v.od) O=v.od; });
    if(!O) return Promise.reject(new Error("destination inconnue"));
    if(nom==="grille.json") return Promise.resolve(O.GR);
    if(nom==="tarifs.json") return Promise.resolve(O.tarifs);
    if(nom==="zones.json") return Promise.resolve(O.zones);
    if(nom==="quartiers.json") return Promise.resolve({quartiers:O.quart,arrondissements:O.arr});
    if(nom==="axes.json") return Promise.resolve({r:O.axes});
    if(nom==="reperes.json") return Promise.resolve(O.reperes);
    if(nom==="transport.json") return Promise.resolve({bandes:[[0,360],[360,600],[600,960],[960,1200],[1200,1440]],jour:"",stops:[],lignes:[]});
    if(nom==="horaires.json"||nom==="photos/index.json") return Promise.resolve({});
    if(nom==="flux.json") return Promise.resolve(null);
    if(nom==="lieux/od.json") return Promise.resolve(O.lieux.map(function(e){ var c={}; Object.keys(e).forEach(function(k){ if(k!=="_s") c[k]=e[k]; }); return c; }));
    if(O.files[nom]) return Promise.resolve(O.files[nom]);
    return Promise.reject(new Error(u+" : introuvable"));
  }
  // adresse, téléphone et site d'un lieu : lus dans le fichier d'origine quand on ouvre sa fiche ou qu'on l'ajoute
  async function odDetails(b){
    if(!VILLE.od || b.det || b._r===undefined || !b._u) return false; b.det=1;
    try{ var o=await odFichier(b._u,"lieux"), res=null;
      await PQ.parquetRead({file:o.f,metadata:o.md,compressors:PQ.compressors,columns:["addresses","websites","phones"],rowStart:b._r,rowEnd:b._r+1,rowFormat:"object",onComplete:function(r){ res=r[0]; }});
      if(!res) return false;
      var ad=res.addresses&&res.addresses[0]&&res.addresses[0].freeform; if(ad) b.a=ad;
      var ph=res.phones&&res.phones[0]; if(ph) b.p=ph;
      var ws=res.websites&&res.websites[0]; if(ws){ var w=String(ws).split("://").pop(); if(w.indexOf("www.")===0) w=w.slice(4); b.w=w.replace(/\/$/,""); }
      return !!(b.a||b.p||b.w);
    }catch(x){ return false; }
  }
  // photos libres (Wikimedia Commons) des étapes d'une destination, une à la fois
  var odPhotos=[], odPhotoActive=false;
  function odPhoto(e){ if(!e || PHOTOS[e.id] || PHOTOS[e.uid]) return; odPhotos.push(e); if(!odPhotoActive) odPhotoSuivante(); }
  async function odPhotoSuivante(){
    odPhotoActive=true;
    while(odPhotos.length){
      var e=odPhotos.shift();
      try{
        var r=await fetch("https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggscoord="+e.lat+"%7C"+e.lon+"&ggsradius=120&ggsnamespace=6&ggslimit=10&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize%7Cmime&iiurlwidth=640&format=json&origin=*");
        if(r.ok){ var d=await r.json(), pg=d.query&&d.query.pages;
          var l=pg?Object.keys(pg).map(function(k){ return pg[k]; }).filter(function(p){ var i=p.imageinfo&&p.imageinfo[0]; if(!i||i.mime!=="image/jpeg"||i.width<900) return false; var m=i.extmetadata||{}, lic=(m.LicenseShortName&&m.LicenseShortName.value)||""; return /^(CC|Public domain|PD)/i.test(lic)&&m.Artist; }):[];
          if(l.length){ var i=l[0].imageinfo[0], m=i.extmetadata, ir=await fetch(i.thumburl||i.url); if(ir.ok){ var bm=await createImageBitmap(await ir.blob()), cv=document.createElement("canvas"), s=Math.min(1,640/bm.width); cv.width=Math.round(bm.width*s); cv.height=Math.round(bm.height*s); cv.getContext("2d").drawImage(bm,0,0,cv.width,cv.height);
            PHOTOS[e.id||e.uid]={f:cv.toDataURL("image/jpeg",0.72),a:String(m.Artist.value).replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,60),l:m.LicenseShortName.value,s:i.descriptionurl}; rendreTout(); programmer(); } } }
      }catch(x){}
      await new Promise(function(ok){ setTimeout(ok,1300); });
    }
    odPhotoActive=false;
  }
  /* ---------- fenêtre « Autre destination » ---------- */
  (function(){
    var sel=document.getElementById("ville"), modal=document.getElementById("odmodal"), q=document.getElementById("odq"), res=document.getElementById("odres"), st=document.getElementById("odetat");
    if(!sel||!modal) return;
    function liste(){
      var V=odVilles();
      if(!V.length){ res.innerHTML='<li class="sous">Chargement de la liste des villes…</li>'; odVillesCharger().then(liste,function(e){ res.innerHTML='<li class="sous">Liste des villes indisponible : '+esc(e.message)+'</li>'; }); return; }
      var f=norm(q.value).trim(), l;
      l=f ? V.filter(function(v){ return norm(v[0]).indexOf(f)>=0; }).slice(0,10) : OD_VEDETTES.map(function(n){ return V.filter(function(v){ return v[0]===n; })[0]; }).filter(Boolean);
      res.innerHTML=l.map(function(v,i){ return '<li><button type="button" class="btn" data-od="'+V.indexOf(v)+'">'+esc(v[0])+' <span class="sous">('+esc(v[1])+(v[4]?", "+nf(v[4]/1000)+" 000 hab.":"")+')</span></button></li>'; }).join("")||'<li class="sous">Aucune ville de plus de 20 000 habitants ne correspond.</li>';
    }
    function ouvrir(){ odPret().catch(function(){}); modal.hidden=false; document.querySelector(".appli").inert=true; st.textContent=""; q.value=""; liste(); q.focus(); }
    function fermer(){ modal.hidden=true; document.querySelector(".appli").inert=false; sel.value=VILLE.id; }
    async function choisir(e){
      var v=odCreerVille(e); if(!v) return;
      st.textContent="Génération de la carte de "+v.nom+"… (quelques secondes, plusieurs dizaines de Mo)"; res.querySelectorAll("button").forEach(function(b){ b.disabled=true; }); q.disabled=true;
      OD.parcs=document.getElementById("odparcs").checked;
      try{
        await odPreparer(v);
        document.querySelector(".appli").inert=false; modal.hidden=true; q.disabled=false;
        sel.value=v.id; await changerVille(v.id); sel.value=VILLE.id;
      }catch(err){
        q.disabled=false; res.querySelectorAll("button").forEach(function(b){ b.disabled=false; });
        st.textContent="Impossible de générer la carte : "+err.message+". Les données sont lues sur amazonaws.com : vérifiez la connexion Internet. Dans une page publiée sur Claude, la plateforme bloque cet accès ; la fonction marche quand l'application est ouverte depuis un fichier ou un site hébergé.";
      }
    }
    q.addEventListener("input",liste); q.addEventListener("keydown",function(e){ if(e.key==="Enter"){ var b=res.querySelector("button"); if(b) b.click(); } if(e.key==="Escape") fermer(); });
    res.addEventListener("click",function(ev){ var b=ev.target.closest("button[data-od]"); if(b) choisir(odVilles()[+b.dataset.od]); });
    document.getElementById("odfermer").addEventListener("click",fermer);
    modal.addEventListener("keydown",function(e){ if(e.key==="Escape") fermer(); });
    var bg=document.getElementById("odgen"); if(bg) bg.addEventListener("click",ouvrir);
    window.__odOuvrir=ouvrir; window.__odCreer=odCreerVille;
  })();
  // à l'ouverture : retrouve l'historique des villes générées (sans recharger leurs données)
  (function(){ try{ var l=JSON.parse(localStorage.getItem(OD_CLE)||"[]"); if(Array.isArray(l)) l.slice(0,OD_MAX).sort(function(a,b){ return (+a[4]||0)-(+b[4]||0); }).forEach(function(e){ if(Array.isArray(e)&&e.length>=4) odCreerVille(e,true); }); }catch(x){} })();
