// Completa lat/lon desde el link y fuerza la sincronización del mapa
(function(){
  function toNum(v){ if(!v) return null; v = (""+v).trim().replace(",", "."); var n = parseFloat(v); return isNaN(n)?null:n; }

  function tryExtract(url){
    if(!url) return null;
    // !3dLAT!4dLON (pin exacto)
    var m = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if(m) return {lat: toNum(m[1]), lon: toNum(m[2])};

    // ?q=LAT,LON o ?ll=LAT,LON
    try {
      var u = new URL(url, window.location.origin);
      var q = u.searchParams.get("q") || u.searchParams.get("ll");
      if(q){
        var p = q.split(",");
        if(p.length>=2) return {lat: toNum(p[0]), lon: toNum(p[1])};
      }
      // /@LAT,LON,ZOOM
      m = u.pathname.match(/\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:[,/]|$)/);
      if(m) return {lat: toNum(m[1]), lon: toNum(m[2])};
      // DMS en path
      var d = decodeURIComponent(u.pathname);
      var dmsLat = d.match(/(-?\d+)[°]\s*(\d+)[']\s*([\d.]+)["]?\s*([NSns])/);
      var dmsLon = d.match(/(-?\d+)[°]\s*(\d+)[']\s*([\d.]+)["]?\s*([EWew])/);
      function dms2dd(D,M,S,H){ var r=(+D)+(+M)/60+(+S)/3600; return ("SWsw".includes(H))?-r:r; }
      if(dmsLat && dmsLon) return {lat:dms2dd(dmsLat[1],dmsLat[2],dmsLat[3],dmsLat[4]),
                                   lon:dms2dd(dmsLon[1],dmsLon[2],dmsLon[3],dmsLon[4])};
    } catch(e){}
    return null;
  }

  function setVal(id, v){
    var el = document.getElementById(id);
    if(!el || v==null) return;
    el.value = (Math.round(v*1e6)/1e6).toFixed(6); // 6 decimales
    // dispara eventos para los listeners
    el.dispatchEvent(new Event("input",  {bubbles:true}));
    el.dispatchEvent(new Event("change", {bubbles:true}));
  }

  function onUrlChange(){
    var urlEl = document.getElementById("id_map_url");
    if(!urlEl) return;
    var out = tryExtract(urlEl.value);
    if(out && isFinite(out.lat) && isFinite(out.lon)){
      setVal("id_latitude",  out.lat);
      setVal("id_longitude", out.lon);
      // fuerza la sincronización del mapa en caliente
      if (window.__DJLP_forceSync) window.__DJLP_forceSync();
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    var urlEl = document.getElementById("id_map_url");
    if(!urlEl) return;
    ["blur","change","paste"].forEach(function(evt){
      urlEl.addEventListener(evt, function(){ setTimeout(onUrlChange, 0); });
    });
  });
})();
