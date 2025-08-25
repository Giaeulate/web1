// Mueve el mapa al slot #coords-map-slot y coloca un botón justo encima.
// También sincroniza inputs<->mapa (input/drag/click) sin romper el zoom.
(function () {
  var map = null, marker = null;
  var userBusy = false, idleTimer = null, deb = null;

  function toNum(v){ if(!v) return NaN; return parseFloat(String(v).replace(",", ".")); }
  function els(){ return {
    la: document.getElementById("id_latitude"),
    lo: document.getElementById("id_longitude"),
    slot: document.getElementById("coords-map-slot"),
    bar:  document.getElementById("coords-toolbar"),
  };}

  function findMapContainer(){
    // contenedor real del mapa creado por el widget (en cualquier sitio)
    return document.querySelector(".leaflet-container");
  }

  function getMap(){
    if (map && map._leaflet_id) return map;
    var c = findMapContainer();
    if (c && c._leaflet) map = c._leaflet;
    return map || null;
  }

  function relocateMap(){
    var c = findMapContainer();
    var E = els();
    if (!c || !E.slot) return false;
    var wrap = c.closest(".leaflet-point-map") || c.parentElement;
    if (!wrap || wrap.parentElement === E.slot) return !!wrap;

    // Inserta el wrapper del mapa dentro del slot del fieldset "Ubicación"
    E.slot.appendChild(wrap);

    // Recalcula tamaño tras mover
    var m = getMap();
    if (m) setTimeout(function(){ m.invalidateSize(); }, 50);
    return true;
  }

  function ensureMarker(lat, lon, opts){
    opts = opts || {};
    var m = getMap();
    if (!m || !isFinite(lat) || !isFinite(lon)) return false;

    if (!marker) {
      marker = L.marker([lat, lon], { draggable: true }).addTo(m);
      marker.on("dragend", function(){
        var p = marker.getLatLng(); setInputs(p.lat, p.lng);
      });
    } else {
      marker.setLatLng([lat, lon]);
    }

    // centra sin cambiar zoom, salvo que el usuario esté actuando
    if (opts.center || !userBusy) m.panTo([lat, lon], { animate:false });
    return true;
  }

  function setInputs(lat, lon){
    var E = els(); if (!E.la || !E.lo) return;
    E.la.value = (Math.round(lat*1e6)/1e6).toFixed(6);
    E.lo.value = (Math.round(lon*1e6)/1e6).toFixed(6);
    ["input","change"].forEach(function(ev){
      E.la.dispatchEvent(new Event(ev,{bubbles:true}));
      E.lo.dispatchEvent(new Event(ev,{bubbles:true}));
    });
  }

  function updateFromInputs(center){
    var E = els(); if (!E.la || !E.lo) return;
    var lat = toNum(E.la.value), lon = toNum(E.lo.value);
    if (!isFinite(lat) || !isFinite(lon)) return;
    ensureMarker(lat, lon, {center: !!center});
  }

  function scheduleFromInputs(){
    clearTimeout(deb);
    deb = setTimeout(function(){ updateFromInputs(false); }, 100);
  }

  function placeToolbar(){
    var E = els(); if (!E.bar) return;
    if (E.bar.__placed) return;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "button default";
    btn.textContent = "Actualizar mapa desde Lat/Lon";
    btn.addEventListener("click", function(){ updateFromInputs(true); });

    E.bar.appendChild(btn);
    E.bar.__placed = true;
  }

  function bind(){
    var m = getMap(); if (!m) { setTimeout(bind, 120); return; }

    // usuario interactuando => no recentrar automáticamente
    function busy(){ userBusy = true; clearTimeout(idleTimer); }
    function idle(){ clearTimeout(idleTimer); idleTimer = setTimeout(function(){ userBusy = false; }, 250); }
    m.on("zoomstart", busy); m.on("movestart", busy);
    m.on("zoomend",   idle); m.on("moveend",   idle);

    // click en mapa -> actualizar inputs y marcador
    m.on("click", function(e){ setInputs(e.latlng.lat, e.latlng.lng); ensureMarker(e.latlng.lat, e.latlng.lng, {center:false}); });

    // escuchar edición en inputs
    var E = els();
    ["input","change","paste","blur","keyup"].forEach(function(ev){
      if (E.la) E.la.addEventListener(ev, scheduleFromInputs);
      if (E.lo) E.lo.addEventListener(ev, scheduleFromInputs);
    });

    // primer sync si ya hay coords
    setTimeout(function(){ updateFromInputs(true); }, 150);
  }

  document.addEventListener("DOMContentLoaded", function(){
    var tries = 0;
    (function wait(){
      if (findMapContainer()) {
        relocateMap();     // mueve el mapa al slot correcto
        placeToolbar();    // crea el botón encima del mapa
        bind();            // sincroniza todo
      } else if (tries++ < 80) {
        setTimeout(wait, 120);
      }
    })();
  });
})();
