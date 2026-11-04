
(function(){
  var vol=document.getElementById("outilvol"), act=document.getElementById("outilact");
  var volsBtn=document.getElementById("volsbtn"), vols=document.getElementById("vols"), ouvrir=document.getElementById("ouvrir"), ajout=document.getElementById("ajout");
  if(!vol||!act) return;
  function etat(){ vol.setAttribute("aria-expanded",String(!!vols && !vols.hidden)); act.setAttribute("aria-expanded",String(!!ajout && !ajout.hidden)); vol.disabled=!volsBtn || volsBtn.hidden; if(vol.disabled) vol.title="La recherche de vols demande au moins deux villes préparées avec un aéroport"; }
  vol.addEventListener("click",function(){ if(volsBtn && !volsBtn.hidden){ volsBtn.click(); if(vols && !vols.hidden) vols.scrollIntoView({block:"nearest"}); } });
  act.addEventListener("click",function(){ ouvrir.click(); if(ajout && !ajout.hidden) ajout.scrollIntoView({block:"nearest"}); });
  var o=new MutationObserver(etat); [vols,ajout,volsBtn].forEach(function(n){ if(n) o.observe(n,{attributes:true,attributeFilter:["hidden"]}); });
  etat(); setTimeout(etat,1500);
})();
