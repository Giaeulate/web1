// Crea toolbar+slot debajo de Lat/Lon, mueve el mapa ahí y sincroniza todo.
(function () {
  var map = null, marker = null, deb = null;
  var userBusy = false, idleTimer = null;

  function toNum(v){ if(!v) return NaN; return parseFloat(String(v).replace(",", ".")); }
  function $q(sel, root){ return (root||document).querySelector(sel); }

  function findCoordsRow(){
    // fila que contiene latitude/longitude en el admin
    return $q(".form-row.field-longitude") ||
           $q("#id_longitude")?.closest(".form-row") ||
           $q(".form-row.field-latitude") ||
           $q("#id_latitude")?.closest(".form-row");
  }

  function ensureSlots(){
    var row = findCoordsRow();
    if (!row) return null;

    var toolbar = document.getElementById("coords-toolbar");
    var slot    = document.getElementById("coords-map-slot");

    if (!slot) {
      slot = document.createElement("div");
      slot.id = "coords-map-slot";
      slot.style.marginTop = "8px";
      row.insertAdjacentElement("afterend", slot);
    }
    if (!toolbar) {
      toolbar = document.createElement("div");
      toolbar.id = "coords-toolbar";
      toolbar.style.margin = "8px 0";
      slot.parentNode.insertBefore(toolbar, slot);
    }
    return { toolbar, slot };
  }

  function findMapWrapper(){
    var mapEl = $q(".leaflet-container");
    if (!mapEl) return null;
    return mapEl.closest(".leaflet-point-map") || mapEl.parentElement;
  }

  function getMap(){
    if (map && map._leaflet_id) return map;
    var c = $q(".leaflet-container");
    if (c && c._leaflet) map = c._leaflet;
    return map || null;
  }

  function relocateMap(){
    var holders = ensureSlots();
    var wrap = findMapWrapper();
    if (!holders || !wrap) return false;
    if (wrap.parentElement !== holders.slot) {
      holders.slot.appendChild(wrap);
      var m = getMap();
      if (m) setTimeout(function(){ m.invalidateSize(); }, 60);
    }
    return true;
  }

  function setInputs(lat, lon){
    var la = document.getElementById("id_latitude");
    var lo = document.getElementById("id_longitude");
    if (!la || !lo) return;
    la.value = (Math.round(lat*1e6)/1e6).toFixed(6);
    lo.value = (Math.round(lon*1e6)/1e6).toFixed(6);
    ["input","change"].forEach(function(ev){
      la.dispatchEvent(new Event(ev,{bubbles:true}));
      lo.dispatchEvent(new Event(ev,{bubbles:true}));
    });
  }

  function ensureMarker(lat, lon, center){
    var m = getMap();
    if (!m || !isFinite(lat) || !isFinite(lon)) return false;

    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true }).addTo(m);
      marker.on("dragend", function(){
        var p = marker.getLatLng();
        setInputs(p.lat, p.lng);
      });
    } else {
      marker.setLatLng([lat, lon]);
    }
    if (center) m.panTo([lat, lon], { animate:false }); // no tocamos el zoom
    return true;
  }

  function updateFromInputs(center){
    var la = document.getElementById("id_latitude");
    var lo = document.getElementById("id_longitude");
    if (!la || !lo) return;
    var lat = toNum(la.value), lon = toNum(lo.value);
    if (!isFinite(lat) || !isFinite(lon)) return;
    ensureMarker(lat, lon, !userBusy || center);
  }

  function scheduleFromInputs(){
    clearTimeout(deb);
    deb = setTimeout(function(){ updateFromInputs(false); }, 100);
  }

  function placeToolbarButton(){
    var holders = ensureSlots();
    if (!holders) return;
    if (holders.toolbar.querySelector("button")) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button default";
    btn.textContent = "Actualizar mapa desde Lat/Lon";
    btn.addEventListener("click", function(){ updateFromInputs(true); });

    holders.toolbar.appendChild(btn);
  }

  function bind(){
    if (!relocateMap()) { setTimeout(bind, 120); return; }

    placeToolbarButton();

    var m = getMap();
    if (m) {
      function busy(){ userBusy = true; clearTimeout(idleTimer); }
      function idle(){ clearTimeout(idleTimer); idleTimer = setTimeout(function(){ userBusy = false; }, 250); }
      m.on("zoomstart", busy); m.on("movestart", busy);
      m.on("zoomend",   idle); m.on("moveend",   idle);

      m.on("click", function(e){
        setInputs(e.latlng.lat, e.latlng.lng);
        ensureMarker(e.latlng.lat, e.latlng.lng, false);
      });

      setTimeout(function(){ m.invalidateSize(); }, 60);
    }

    // inputs -> mapa
    ["id_latitude","id_longitude"].forEach(function(id){
      var el = document.getElementById(id);
      if (!el) return;
      ["input","change","paste","blur","keyup"].forEach(function(ev){
        el.addEventListener(ev, scheduleFromInputs);
      });
    });

    // primer sync (si ya hay coords)
    setTimeout(function(){ updateFromInputs(true); }, 150);

    // hook opcional para map_url_autofill
    window.__DJLP_forceSync = function(){ updateFromInputs(true); };
  }

  document.addEventListener("DOMContentLoaded", function(){
    // Espera a que aparezca el mapa del widget
    var tries = 0;
    (function wait(){
      if ($q(".leaflet-container")) bind();
      else if (tries++ < 80) setTimeout(wait, 120);
    })();
  });
})();
