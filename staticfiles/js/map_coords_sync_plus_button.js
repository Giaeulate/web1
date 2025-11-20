// Sincroniza mapa<->inputs y agrega botón "Actualizar mapa desde Lat/Lon"
(function () {
  var map = null, marker = null, placedBar = false;
  var userBusy = false, idleTimer = null, deb = null;

  // --- Hook: capturar instancia L.Map cuando el widget la crea ---
  (function hookLeaflet(){
    if (!window.L || !L.Map || !L.Map.addInitHook) { setTimeout(hookLeaflet, 50); return; }
    L.Map.addInitHook(function(){
      var c = this.getContainer();
      c.__djlpMap = this;
      window.__DJLP_ACTIVE_MAP__ = this; // fallback
    });
  })();

  function toNum(v){ if(!v) return NaN; return parseFloat(String(v).replace(",", ".")); }

  function findContainer(){
    // Si usas placeholder, preferirlo; si no, el primer mapa del form
    return document.querySelector("#coords-map-placeholder .leaflet-container") ||
           document.querySelector(".leaflet-container");
  }

  function getMap(){
    if (map && map._leaflet_id) return map;
    var c = findContainer();
    if (c && c.__djlpMap) map = c.__djlpMap;
    if (!map && window.__DJLP_ACTIVE_MAP__ && window.__DJLP_ACTIVE_MAP__._leaflet_id)
      map = window.__DJLP_ACTIVE_MAP__;
    return map || null;
  }

  function setInputs(lat, lon){
    var la = document.getElementById("id_latitude");
    var lo = document.getElementById("id_longitude");
    if (!la || !lo) return;
    la.value = (Math.round(lat*1e6)/1e6).toFixed(6);
    lo.value = (Math.round(lon*1e6)/1e6).toFixed(6);
    la.dispatchEvent(new Event("input", {bubbles:true}));
    lo.dispatchEvent(new Event("input", {bubbles:true}));
    la.dispatchEvent(new Event("change", {bubbles:true}));
    lo.dispatchEvent(new Event("change", {bubbles:true}));
  }

  function ensureMarker(lat, lon, opts){
    var m = getMap();
    if (!m || !isFinite(lat) || !isFinite(lon)) return false;

    if (!marker) {
      m.eachLayer(function(layer){
        if (!marker && layer instanceof L.Marker) marker = layer;
      });
    }

    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true }).addTo(m);
      marker.on("dragend", function(){
        var p = marker.getLatLng();
        setInputs(p.lat, p.lng);
      });
      // 1a vez: si el mapa está “crudo”, fija zoom razonable
      var z = m.getZoom && m.getZoom();
      if (!z || z < 3) m.setView([lat, lon], 15);
    } else {
      marker.setLatLng([lat, lon]);
    }

    if (!userBusy) m.panTo([lat, lon], { animate: false }); // no toca zoom del usuario
    return true;
  }

  function updateFromInputs(){
    var la = document.getElementById("id_latitude");
    var lo = document.getElementById("id_longitude");
    if (!la || !lo) return;
    var lat = toNum(la.value);
    var lon = toNum(lo.value);
    if (!isFinite(lat) || !isFinite(lon)) {
      (isNaN(lat) ? la : lo).focus();
      return;
    }
    ensureMarker(lat, lon, { center: true });
  }

  function scheduleFromInputs(){
    clearTimeout(deb);
    deb = setTimeout(updateFromInputs, 90);
  }

  function placeButtons(){
    if (placedBar) return;
    var cont = findContainer();
    if (!cont) return;
    var wrap = cont.closest(".leaflet-point-map") || cont.parentElement;

    var bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.margin = "8px 0";

    // var btnPush = document.createElement("button");
    // btnPush.type = "button";
    // btnPush.className = "button default";
    // btnPush.textContent = "Actualizar mapa desde Lat/Lon";
    // btnPush.addEventListener("click", updateFromInputs);

    // bar.appendChild(btnPush);
    
    wrap.parentNode.insertBefore(bar, wrap);
    placedBar = true;

    // primer sync si ya hay coords
    setTimeout(updateFromInputs, 120);
  }

  function bindOnce(){
    var m = getMap();
    if (!m) { setTimeout(bindOnce, 120); return; }

    // usuario interactuando => no recentrar
    function busy(){ userBusy = true; clearTimeout(idleTimer); }
    function idle(){ clearTimeout(idleTimer); idleTimer = setTimeout(function(){ userBusy = false; }, 250); }
    m.on("zoomstart", busy);  m.on("movestart", busy);
    m.on("zoomend",   idle);  m.on("moveend",   idle);

    // click en mapa => actualizar inputs y pin
    m.on("click", function(e){ setInputs(e.latlng.lat, e.latlng.lng); ensureMarker(e.latlng.lat, e.latlng.lng, {center:false}); });

    // escuchar edición en inputs
    ["id_latitude","id_longitude"].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      ["input","change","paste","blur","keyup"].forEach(function(evt){
        el.addEventListener(evt, scheduleFromInputs);
      });
    });

    // exponer hook para quien complete lat/lon (map_url_autofill)
    window.__DJLP_forceSync = updateFromInputs;

    // colocar botón encima del mapa
    placeButtons();

    // por si el mapa cambió de sitio, recalcular tamaño
    setTimeout(function(){ m.invalidateSize(); }, 60);
  }

  // document.addEventListener("DOMContentLoaded", bindOnce);
  document.addEventListener("DOMContentLoaded", function(){
    bindOnce();
    function forceSyncWhenReady(){
      if (typeof window.__DJLP_forceSync === "function") {
        window.__DJLP_forceSync();
      } else {
        setTimeout(forceSyncWhenReady, 50);
      }
    }
    forceSyncWhenReady();
  });
})();
