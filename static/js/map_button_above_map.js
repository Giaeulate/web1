// Crea una barra con botón "Actualizar mapa desde Lat/Lon" justo ENCIMA del mapa
(function () {
  var map = null, marker = null;

  function toNum(v){ if(!v) return NaN; return parseFloat(String(v).replace(",", ".")); }

  function getMap(){
    if (map && map._leaflet_id) return map;
    var c = document.querySelector(".leaflet-container");
    if (c && c._leaflet) map = c._leaflet;
    // último recurso: buscar objetos que parezcan L.Map
    if (!map) for (var k in window) {
      try { var v = window[k];
        if (v && v._leaflet_id && typeof v.setView === "function" && v._container) { map = v; break; }
      } catch(e){}
    }
    return map || null;
  }

  function ensureMarker(lat, lon){
    var m = getMap();
    if (!m || !isFinite(lat) || !isFinite(lon)) return false;
    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true }).addTo(m);
      marker.on("dragend", function(){
        var p = marker.getLatLng();
        setInputs(p.lat, p.lng);
      });
      var z = m.getZoom && m.getZoom();
      if (!z || z < 3) m.setView([lat, lon], 15);
    } else {
      marker.setLatLng([lat, lon]);
    }
    m.panTo([lat, lon], { animate:false }); // no cambia el zoom del usuario
    return true;
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

  function updateFromInputs(){
    var la = document.getElementById("id_latitude");
    var lo = document.getElementById("id_longitude");
    if (!la || !lo) return;
    var lat = toNum(la.value), lon = toNum(lo.value);
    if (!isFinite(lat) || !isFinite(lon)) { (isNaN(lat)?la:lo).focus(); return; }
    if (!ensureMarker(lat, lon)) alert("No se encontró el mapa. ¿Cargó el widget?");
  }

  function placeBar(){
    // contenedor del mapa del widget
    var mapEl = document.querySelector(".leaflet-container");
    if (!mapEl) return false;
    var wrap = mapEl.closest(".leaflet-point-map") || mapEl.parentElement;
    if (!wrap) return false;

    // barra
    var bar = document.createElement("div");
    bar.className = "djlp-toolbar";
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.margin = "8px 0";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button default";
    btn.textContent = "Actualizar mapa desde Lat/Lon";
    btn.addEventListener("click", updateFromInputs);

    bar.appendChild(btn);

    // insertar la barra JUSTO ANTES del mapa
    wrap.parentNode.insertBefore(bar, wrap);

    // primer sync si ya hay coords
    setTimeout(updateFromInputs, 120);
    return true;
  }

  document.addEventListener("DOMContentLoaded", function(){
    var tries = 0;
    (function wait(){
      if (getMap() && placeBar()) return;
      if (tries++ < 60) setTimeout(wait, 120);
    })();
  });
})();
