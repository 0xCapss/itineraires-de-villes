  /* ---------- lieux sur la carte pendant l'ajout d'une étape, et relief 3D ---------- */
  var RELIEF=false, poiMin=null;
  function poiCouches(){
    if(!carte.getSource("poi")) carte.addSource("poi",{type:"geojson",data:VIDE});
    if(!carte.getLayer("bati3d")) carte.addLayer({id:"bati3d",type:"fill-extrusion",source:"bati",minzoom:15,layout:{visibility:RELIEF?"visible":"none"},
      paint:{"fill-extrusion-color":j("--bati"),"fill-extrusion-height":["get","h"],"fill-extrusion-opacity":0.92}});
    if(!carte.getLayer("poi")) carte.addLayer({id:"poi",type:"circle",source:"poi",minzoom:14,
      paint:{"circle-radius":["interpolate",["linear"],["zoom"],14,3,17,6.5],"circle-color":["match",["get","t"],"m",j("--c-monument"),"r",j("--c-restaurant"),"h",j("--c-hotel"),j("--c-autre")],
        "circle-stroke-width":1.2,"circle-stroke-color":j("--carte")}});
    if(carte.getLayer("bati")) carte.setLayoutProperty("bati","visibility",RELIEF?"none":"visible");
  }
  function poiMaj(){
    var s=carte.getSource("poi"); if(!s) return;
    if(ajout.hidden || !base.length || ctxEmprunte){ s.setData(VIDE); return; }
    var c=carte.getCenter(), pts=[];
    for(var i=0;i<base.length;i++){ var b=base[i];
      if(onglet!=="tous" && TYPE_DE[b.t]!==onglet) continue;
      if(GROUPE && groupeDe(b)!==GROUPE) continue;
      var dx=(b.lon-c.lng)*KX, dy=(b.lat-c.lat)*KY; pts.push([dx*dx+dy*dy,b]); }
    pts.sort(function(a,b){ return a[0]-b[0]; });
    s.setData({type:"FeatureCollection",features:pts.slice(0,1200).map(function(x){ var b=x[1]; return {type:"Feature",properties:{i:b.i,t:b.t},geometry:{type:"Point",coordinates:[b.lon,b.lat]}}; })});
  }
  function poiInit(){ poiCouches(); poiMaj(); }
  if(carte.isStyleLoaded()) poiInit(); else carte.once("load",poiInit);
  carte.on("styledata",function(){ if(!carte.getLayer("poi") && carte.isStyleLoaded()) poiInit(); });
  carte.on("moveend",function(){ clearTimeout(poiMin); poiMin=setTimeout(poiMaj,300); });
  carte.on("click","poi",function(e){
    if(modePose || !e.features.length) return; var id=e.features[0].properties.i, b=null;
    for(var i=0;i<base.length;i++) if(base[i].i===id){ b=base[i]; break; }
    if(b){ montrerApercu(b.lon,b.lat,false); bulleBase(b); }
  });
  carte.on("mouseenter","poi",function(){ carte.getCanvas().style.cursor="pointer"; });
  carte.on("mouseleave","poi",function(){ carte.getCanvas().style.cursor=""; });
  document.getElementById("relief").addEventListener("click",function(){
    RELIEF=!RELIEF; this.setAttribute("aria-pressed",String(RELIEF)); poiCouches();
    if(carte.getLayer("bati3d")) carte.setLayoutProperty("bati3d","visibility",RELIEF?"visible":"none");
    carte.setLayoutProperty("bati","visibility",RELIEF?"none":"visible");
    carte.easeTo({pitch:RELIEF?55:0,bearing:RELIEF?-12:0,duration:600});
  });
