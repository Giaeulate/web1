// Botones encima del mapa: "Actualizar mapa desde Lat/Lon" y (opcional) "Tomar posición del marcador"
(function () {
  var map = null;
  var marker = null;
  var placed = false;

  function toNum(v){ if(!v) return NaN; return parseFloat(String(v).replace(",", ".")); }

  function getMap(){
    if (map && map._leaflet_id) return map;
    var c = document.querySelector(".leaflet-container");
    if (c && c._leaflet) map = c._leaflet;          // algunos widgets guardan la instancia aquí
    // fallback: buscar objetos que parezcan L.Map en window
    if (!map) for (var k in window) {
      try {
        var v = window[k];
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
      // primer enfoque: si el mapa está “crudo”, fija zoom razonable
      var z = m.getZoom && m.getZoom();
      if (!z || z < 3) m.setView([lat, lon], 15);
    } else {
      marker.setLatLng([lat, lon]);
    }
    // Centra sin tocar el zoom del usuario
    m.panTo([lat, lon], { animate: false });
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
    var lat = toNum(la.value);
    var lon = toNum(lo.value);
    if (!isFinite(lat) || !isFinite(lon)) {
      alert("Coordenadas inválidas. Revisa latitude/longitude.");
      (isNaN(lat) ? la : lo).focus();
      return;
    }
    if (!ensureMarker(lat, lon)) {
      alert("No se encontró el mapa. ¿Cargó el widget?");
    }
  }

  function updateFromMarker(){
    if (!marker) return;
    var p = marker.getLatLng();
    setInputs(p.lat, p.lng);
  }

  function placeButtons(){
    if (placed) return;
    var mapEl = document.querySelector(".leaflet-container");
    if (!mapEl) return;

    var wrap = mapEl.closest(".leaflet-point-map") || mapEl.parentElement;
    var bar = document.createElement("div");
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.margin = "8px 0";

    var btnPush = document.createElement("button");
    btnPush.type = "button";
    btnPush.className = "button default";
    btnPush.textContent = "Actualizar mapa desde Lat/Lon";
    btnPush.addEventListener("click", updateFromInputs);

    var btnPull = document.createElement("button");
    btnPull.type = "button";
    btnPull.className = "button";
    btnPull.textContent = "Tomar posición del marcador → Lat/Lon";
    btnPull.addEventListener("click", updateFromMarker);

    bar.appendChild(btnPush);
    bar.appendChild(btnPull);

    // Inserta la barra justo ANTES del mapa
    wrap.parentNode.insertBefore(bar, wrap);
    placed = true;

    // Primer sync si ya hay coords
    setTimeout(updateFromInputs, 100);
  }

  // Espera a que el widget cree el mapa y luego coloca los botones
  document.addEventListener("DOMContentLoaded", function(){
    var tries = 0;
    (function wait(){
      if (getMap() && document.querySelector(".leaflet-container")) placeButtons();
      else if (tries++ < 60) setTimeout(wait, 120);
    })();
  });
})();
