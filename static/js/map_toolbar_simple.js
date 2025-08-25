// Botón encima del mapa + sync bidireccional sin reubicar el mapa
(function () {
  var map = null, marker = null, deb = null;
  var userBusy = false, idleTimer = null;

  function toNum(v){ if(!v) return NaN; return parseFloat(String(v).replace(",", ".")); }
  function q(sel, root){ return (root||document).querySelector(sel); }

  function getMap(){
    if (map && map._leaflet_id) return map;
    var c = q(".leaflet-container");
    if (c && c._leaflet) map = c._leaflet;
    return map || null;
  }

  function placeToolbar(){
    var c = q(".leaflet-container");
    if (!c) return false;
    var wrap = c.closest(".leaflet-point-map") || c.parentElement;
    if (!wrap) return false;

    if (document.getElementById("coords-toolbar")) return true; // ya insertado

    var bar = document.createElement("div");
    bar.id = "coords-toolbar";
    bar.style.display = "flex";
    bar.style.gap = "8px";
    bar.style.margin = "8px 0";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button default";
    btn.textContent = "Actualizar mapa desde Lat/Lon";
    btn.addEventListener("click", function(){ updateFromInputs(true); });

    bar.appendChild(btn);

    // 👇 Inserta la barra JUSTO ANTES del mapa (sin mover el mapa)
    wrap.parentNode.insertBefore(bar, wrap);
    return true;
  }

  function setInputs(lat, lon){
    var la = q("#id_latitude"), lo = q("#id_longitude");
    if (!la || !lo) return;
    la.value = (Math.round(lat*1e6)/1e6).toFixed(6);
    lo.value = (Math.round(lon*1e6)/1e6).toFixed(6);
    ["input","change"].forEach(function(ev){
      la.dispatchEvent(new Event(ev,{bubbles:true}));
      lo.dispatchEvent(new Event(ev,{bubbles:true}));
    });
  }

  function ensureMarker(lat, lon, opts){
    opts = opts || {};
    var m = getMap();
    if (!m || !isFinite(lat) || !isFinite(lon)) return false;

    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true }).addTo(m);
      marker.on("dragend", function(){
        var p = marker.getLatLng();
        setInputs(p.lat, p.lng);
      });
      // primer enfoque: si el mapa está "crudo", fija zoom razonable
      var z = m.getZoom && m.getZoom();
      if (!z || z < 3) m.setView([lat, lon], 15);
    } else {
      marker.setLatLng([lat, lon]);
    }

    // centra sin tocar el zoom del usuario (salvo que esté interactuando)
    if (!userBusy && (opts.center || opts.center === undefined)) {
      m.panTo([lat, lon], { animate:false });
    }
    return true;
  }

  function updateFromInputs(center){
    var la = q("#id_latitude"), lo = q("#id_longitude");
    if (!la || !lo) return;
    var lat = toNum(la.value), lon = toNum(lo.value);
    if (!isFinite(lat) || !isFinite(lon)) return;
    ensureMarker(lat, lon, { center: !!center });
  }

  function scheduleFromInputs(){
    clearTimeout(deb);
    deb = setTimeout(function(){ updateFromInputs(false); }, 100);
  }

  function bind(){
    var m = getMap();
    if (!m) { setTimeout(bind, 120); return; }

    placeToolbar();

    // usuario interactuando => no recentrar automáticamente
    function busy(){ userBusy = true; clearTimeout(idleTimer); }
    function idle(){ clearTimeout(idleTimer); idleTimer = setTimeout(function(){ userBusy = false; }, 250); }
    m.on("zoomstart", busy); m.on("movestart", busy);
    m.on("zoomend",   idle); m.on("moveend",   idle);

    // click en mapa -> actualizar inputs y marcador
    m.on("click", function(e){
      setInputs(e.latlng.lat, e.latlng.lng);
      ensureMarker(e.latlng.lat, e.latlng.lng, { center:false });
    });

    // inputs -> mapa (mientras escribes/pegas)
    ["#id_latitude","#id_longitude"].forEach(function(sel){
      var el = q(sel);
      if (!el) return;
      ["input","change","paste","blur","keyup"].forEach(function(ev){
        el.addEventListener(ev, scheduleFromInputs);
      });
    });

    // primer sync (si ya hay coords) + arreglar tamaño si el mapa carga tarde
    setTimeout(function(){ updateFromInputs(true); m.invalidateSize(); }, 150);

    // Hook para map_url_autofill (si lo usas)
    window.__DJLP_forceSync = function(){ updateFromInputs(true); };
  }

  document.addEventListener("DOMContentLoaded", function(){
    var tries = 0;
    (function wait(){
      if (q(".leaflet-container")) bind();
      else if (tries++ < 80) setTimeout(wait, 120);
    })();
  });
})();
