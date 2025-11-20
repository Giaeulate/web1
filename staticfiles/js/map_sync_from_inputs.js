// v7 — respeta el zoom del usuario y sincroniza en ambas vías
(function () {
  var map = null;
  var marker = null;
  var deb = null;
  var userBusy = false;
  var idleTimer = null;

  function toNum(v){ if(!v) return NaN; return parseFloat(String(v).replace(",", ".")); }

  function getMap(){
    if (map && map._leaflet_id) return map;
    var c = document.querySelector("#coords-map-placeholder .leaflet-container") ||
            document.querySelector(".leaflet-container"); // primer mapa del form
    if (c && c._leaflet) map = c._leaflet;
    return map || null;
  }

  function setInputs(lat, lon){
    var la = document.getElementById("id_latitude");
    var lo = document.getElementById("id_longitude");
    if (!la || !lo) return;
    la.value = (Math.round(lat * 1e6) / 1e6).toFixed(6);
    lo.value = (Math.round(lon * 1e6) / 1e6).toFixed(6);
    la.dispatchEvent(new Event("input", {bubbles:true}));
    lo.dispatchEvent(new Event("input", {bubbles:true}));
    la.dispatchEvent(new Event("change", {bubbles:true}));
    lo.dispatchEvent(new Event("change", {bubbles:true}));
  }

  function apply(lat, lon, opts){
    opts = opts || {};
    var m = getMap();
    if (!m || !isFinite(lat) || !isFinite(lon)) return;

    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true }).addTo(m);
      // mover el pin con drag -> actualiza inputs (y NO cambiamos tu zoom)
      marker.on("dragend", function(){
        var p = marker.getLatLng();
        setInputs(p.lat, p.lng);
      });
    } else {
      marker.setLatLng([lat, lon]);
    }

    // Centra solo si lo pedimos y si el usuario no está interactuando
    if (opts.center !== false && !userBusy) {
      m.panTo([lat, lon], { animate: false }); // no toca el zoom
    }
  }

  function scheduleFromInputs(){
    clearTimeout(deb);
    deb = setTimeout(function(){
      var la = document.getElementById("id_latitude");
      var lo = document.getElementById("id_longitude");
      if (!la || !lo) return;
      var lat = toNum(la.value);
      var lon = toNum(lo.value);
      if (!isFinite(lat) || !isFinite(lon)) return;
      apply(lat, lon, {center:true});
    }, 90);
  }

  function bindOnce(){
    var m = getMap();
    if (!m) { setTimeout(bindOnce, 120); return; }

    // Marca al usuario como "ocupado" mientras hace zoom/move
    function setBusy(){ userBusy = true; clearTimeout(idleTimer); }
    function setIdle(){ clearTimeout(idleTimer); idleTimer = setTimeout(function(){ userBusy = false; }, 250); }
    m.on("zoomstart", setBusy);
    m.on("movestart", setBusy);
    m.on("zoomend",   setIdle);
    m.on("moveend",   setIdle);

    // Click en el mapa -> mueve pin y refleja en inputs
    m.on("click", function(e){
      apply(e.latlng.lat, e.latlng.lng, {center:false});
      setInputs(e.latlng.lat, e.latlng.lng);
    });

    // Al escribir/pegar en inputs -> mueve el pin (sin romper zoom)
    ["id_latitude","id_longitude"].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      ["input","change","paste","blur","keyup"].forEach(function(evt){
        el.addEventListener(evt, scheduleFromInputs);
      });
    });

    // Sincronización inicial (si ya hay valores)
    setTimeout(scheduleFromInputs, 300);

    // Expón un hook para que map_url_autofill pueda forzar sync tras parsear la URL
    window.__DJLP_forceSync = scheduleFromInputs;

    // Por si reubicaste el mapa, recalcula tamaño
    setTimeout(function(){ m.invalidateSize(); }, 60);
  }

  document.addEventListener("DOMContentLoaded", bindOnce);
})();
