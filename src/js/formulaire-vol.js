
(function(){
  var vols=document.getElementById("vols"), sel=document.getElementById("volsadultes"), cls=document.getElementById("volsclasse"), nb=document.getElementById("vdnb");
  if(!vols||!sel||!cls) return;
  var chips=document.querySelectorAll(".vd-classe button");
  function sync(){ nb.textContent=sel.value; document.getElementById("vdmoins").disabled=(+sel.value<=1); document.getElementById("vdplus").disabled=(+sel.value>=6);
    Array.prototype.forEach.call(chips,function(b){ b.setAttribute("aria-pressed",String(b.dataset.classe===cls.value)); }); }
  function change(el){ el.dispatchEvent(new Event("change",{bubbles:true})); sync(); }
  document.getElementById("vdmoins").addEventListener("click",function(){ if(+sel.value>1){ sel.value=String(+sel.value-1); change(sel); } });
  document.getElementById("vdplus").addEventListener("click",function(){ if(+sel.value<6){ sel.value=String(+sel.value+1); change(sel); } });
  Array.prototype.forEach.call(chips,function(b){ b.addEventListener("click",function(){ cls.value=b.dataset.classe; change(cls); }); });
  new MutationObserver(sync).observe(vols,{attributes:true,attributeFilter:["hidden"]});
  // la recherche par connecteurs n'existe que dans la page publiée dans Claude : ailleurs, les boutons de comparaison deviennent l'action principale
  var enClaude=!!(window.claude && window.claude.use);
  vols.classList.toggle("vd-sanscl",!enClaude);
  if(!enClaude){ var p=document.querySelector(".vd-titre p"); if(p) p.textContent="Indiquez votre trajet, puis ouvrez la recherche sur Google Flights, Skyscanner, Kayak ou Expedia : tout ce que vous renseignez ici est repris sur le site."; }
  // aller simple ou aller-retour
  var form=document.getElementById("volsform"), trips=document.querySelectorAll(".vd-trip button"), ret=document.getElementById("vdretour"), dret=document.getElementById("volsretour"), ddate=document.getElementById("volsdate");
  function trip(t){
    form.dataset.trip=t; Array.prototype.forEach.call(trips,function(b){ b.setAttribute("aria-pressed",String(b.dataset.trip===t)); });
    ret.hidden=(t!=="retour"); document.getElementById("vddatelib").textContent=(t==="retour"?"Date de l'aller":"Date du vol");
    document.getElementById("volsretourbtn").hidden=(t!=="retour");
    document.getElementById("volschercher").textContent=(t==="retour"?"Chercher l'aller avec mes connecteurs Claude":"Chercher avec mes connecteurs Claude");
    document.getElementById("vdconnectnote").textContent=(t==="retour"?"La recherche par connecteurs est un aller simple : cherchez l'aller, puis le retour.":"Prix et horaires réels dans cette page (Expedia et eDreams).");
    if(t==="retour" && ddate.value && (!dret.value || dret.value<ddate.value)){ var d=new Date(ddate.value+"T12:00:00"); d.setDate(d.getDate()+7); dret.value=d.toISOString().slice(0,10); }
    form.dispatchEvent(new Event("change",{bubbles:true}));
  }
  Array.prototype.forEach.call(trips,function(b){ b.addEventListener("click",function(){ trip(b.dataset.trip); }); });
  ddate.addEventListener("change",function(){ dret.min=ddate.value||""; if(form.dataset.trip==="retour" && ddate.value && dret.value && dret.value<ddate.value) dret.value=ddate.value; });
  document.getElementById("volsretourbtn").addEventListener("click",function(){
    var de=document.getElementById("volsde"), vers=document.getElementById("volsvers"), a=de.value, b=vers.value, r=dret.value;
    de.value=b; vers.value=a; if(r) ddate.value=r; trip("aller"); de.dispatchEvent(new Event("change",{bubbles:true})); form.requestSubmit();
  });
  form.dataset.trip="aller";
  // le volet est central : Échap ou un clic à l'extérieur le ferme, le premier champ prend le focus à l'ouverture
  function fermer(){ document.getElementById("volsfermer").click(); }
  document.addEventListener("keydown",function(e){ if(e.key==="Escape" && !vols.hidden) fermer(); });
  document.addEventListener("mousedown",function(e){ if(vols.hidden||vols.contains(e.target)||e.target.closest("#outilvol,#volsbtn")) return; fermer(); });
  new MutationObserver(function(){ if(!vols.hidden) setTimeout(function(){ document.getElementById("volsde").focus(); },50); }).observe(vols,{attributes:true,attributeFilter:["hidden"]});
  sync();
})();
