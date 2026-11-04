  /* ---------- recherche du trajet sur des sites de vols (liens pré-remplis) ---------- */
  (function(){
    var f=document.getElementById("volsform"); if(!f) return;
    var gf=document.getElementById("lienvolgf"), sk=document.getElementById("lienvolsk"), ky=document.getElementById("lienvolky"), ex=document.getElementById("lienvolex");
    var note=document.getElementById("liensnote");
    function codes(id){ var t=[], c=0; Array.prototype.forEach.call(document.querySelectorAll("#"+id+" input"),function(i){ c++; if(i.checked) t.push(i.value); }); return {coches:t,total:c}; }
    function h12(t){ var m=/^(\d{2}):(\d{2})$/.exec(t); if(!m) return ""; var h=+m[1]; return (h%12||12)+":"+m[2]+(h<12?" AM":" PM"); }
    function majLiens(){
      var a=villeVol(document.getElementById("volsde").value), b=villeVol(document.getElementById("volsvers").value);
      var d=document.getElementById("volsdate").value, n=parseInt(document.getElementById("volsadultes").value,10)||1, c=document.getElementById("volsclasse").value;
      var rt=(f.dataset.trip==="retour"), dr=document.getElementById("volsretour").value, drv=rt&&/^\d{4}-\d{2}-\d{2}$/.test(dr)&&dr>=d, direct=document.getElementById("volsdirects").checked, apres=document.getElementById("volsapres").value, avant=document.getElementById("volsavant").value;
      var ok=!!(a&&b&&a.metro_iata&&b.metro_iata&&a.id!==b.id);
      [gf,sk,ky,ex].forEach(function(l){ if(!ok){ l.removeAttribute("href"); l.setAttribute("aria-disabled","true"); l.style.opacity=".5"; } else { l.removeAttribute("aria-disabled"); l.style.opacity=""; } });
      if(!ok){ if(note) note.textContent=""; return; }
      var cd=codes("volsaerodep"), ca=codes("volsaeroarr");
      // aéroports : tous cochés ou aucun -> code de la métropole ; un seul -> ce code ; plusieurs -> liste là où le site la comprend
      function pick(cs,metro){ return (cs.coches.length===0||cs.coches.length===cs.total) ? {liste:[metro],un:metro} : {liste:cs.coches,un:cs.coches.length===1?cs.coches[0]:metro}; }
      var O=pick(cd,a.metro_iata), D=pick(ca,b.metro_iata), dv=/^\d{4}-\d{2}-\d{2}$/.test(d);
      var cg={premium:" premium economy",business:" business class",first:" first class"}[c]||"";
      gf.href="https://www.google.com/travel/flights?hl=fr&q="+encodeURIComponent("Flights from "+O.liste.join(" or ")+" to "+D.liste.join(" or ")+(dv?" on "+d:"")+(drv?" returning "+dr:"")+(direct?" nonstop":"")+(n>1?" for "+n+" adults":"")+cg+(apres?" departing after "+h12(apres):"")+(avant?" arriving before "+h12(avant):""));
      var cs={economy:"economy",premium:"premiumeconomy",business:"business",first:"first"}[c]||"economy";
      sk.href="https://www.skyscanner.fr/transport/vols/"+O.un.toLowerCase()+"/"+D.un.toLowerCase()+"/"+(dv?d.slice(2,4)+d.slice(5,7)+d.slice(8,10)+"/":"")+(drv?dr.slice(2,4)+dr.slice(5,7)+dr.slice(8,10)+"/":"")+"?adultsv2="+n+"&cabinclass="+cs+(direct?"&preferdirects=true":"");
      ky.href="https://www.kayak.fr/flights/"+O.liste.join(",")+"-"+D.liste.join(",")+"/"+(dv?d+"/":"")+(drv?dr+"/":"")+n+"adults"+({premium:"/premium",business:"/business",first:"/first"}[c]||"")+(direct?"?fs=stops=0":"");
      var opt=[]; if(c!=="economy") opt.push("cabinclass:"+({premium:"premium_economy",business:"business",first:"first"}[c])); if(direct) opt.push("maxhops:0");
      ex.href="https://www.expedia.com/Flights-Search?trip="+(drv?"roundtrip":"oneway")+"&leg1=from:"+O.un+",to:"+D.un+(dv?",departure:"+d.slice(5,7)+"/"+d.slice(8,10)+"/"+d.slice(0,4)+"TANYT":"")+(drv?"&leg2=from:"+D.un+",to:"+O.un+",departure:"+dr.slice(5,7)+"/"+dr.slice(8,10)+"/"+dr.slice(0,4)+"TANYT":"")+"&passengers=adults:"+n+"&mode=search"+(opt.length?"&options="+opt.join(","):"");
      if(note){
        var multi=(cd.coches.length>1&&cd.coches.length<cd.total)||(ca.coches.length>1&&ca.coches.length<ca.total);
        var reste=[]; if(apres) reste.push("départ après "+apres); if(avant) reste.push("arrivée avant "+avant); if(multi) reste.push("choix de plusieurs aéroports (Skyscanner et Expedia prennent la métropole)");
        note.textContent="Transmis : "+(rt?(drv?"aller-retour, dates, ":"aller-retour (ajoutez la date du retour), "):"trajet, ")+(dv&&!rt?"date, ":"")+n+(n>1?" voyageurs":" voyageur")+", classe"+(direct?", vol direct":"")+(O.un!==a.metro_iata||D.un!==b.metro_iata||O.liste.length>1||D.liste.length>1?", aéroports":"")+"."+(apres||avant?" Heures : transmises à Google Flights seulement.":"")+(multi?" Plusieurs aéroports : Google Flights et Kayak les reçoivent, Skyscanner et Expedia prennent la métropole.":"");
      }
    }
    f.addEventListener("input",majLiens); f.addEventListener("change",majLiens);
    document.getElementById("volsinverser").addEventListener("click",function(){ setTimeout(majLiens,0); });
    new MutationObserver(majLiens).observe(document.getElementById("vols"),{attributes:true,attributeFilter:["hidden"]});
    new MutationObserver(majLiens).observe(document.getElementById("volsde"),{childList:true});
    ["volsaerodep","volsaeroarr"].forEach(function(id){ new MutationObserver(majLiens).observe(document.getElementById(id),{childList:true}); });
    majLiens(); setTimeout(majLiens,800);
    Array.prototype.forEach.call([gf,sk,ky,ex],function(l){ l.addEventListener("click",function(ev){ if(l.getAttribute("aria-disabled")==="true") ev.preventDefault(); }); });
  })();
