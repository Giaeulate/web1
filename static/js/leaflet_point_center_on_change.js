// static/js/leaflet_point_center_on_change.js
(function(){
  // intenta engancharse al mapa creado por el widget
  // el widget suele colocar data-attrs en el contenedor; usamos un poll sencillo
  function centerIfPossible(){
    var latEl = document.getElementById("id_latitude");
    var lonEl = document.getElementById("id_longitude");
    var mapDiv = document.querySelector(".leaflet-point-map, .leaflet-container");
    if(!latEl || !lonEl || !mapDiv || !window.L) return;

    var lat = parseFloat((latEl.value||"").replace(",", "."));
    var lon = parseFloat((lonEl.value||"").replace(",", "."));
    if(isFinite(lat) && isFinite(lon)){
      // Busca el mapa Leaflet más cercano
      var maps = Object.values(window).filter(v => v && v instanceof window.L.Map);
      var map = maps[0]; // suele haber uno solo en el form
      if(map){
        map.setView([lat, lon], Math.max(map.getZoom(), 15));
      }
    }
  }

  function bind(){
    ["id_latitude","id_longitude"].forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      ["change","blur"].forEach(evt => el.addEventListener(evt, centerIfPossible));
    });
  }

  document.addEventListener("DOMContentLoaded", function(){
    bind();
    setTimeout(centerIfPossible, 300); // por si el mapa tarda en inicializar
  });
})();
