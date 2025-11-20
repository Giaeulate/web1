// static/js/leaflet_point_center_on_change.js
(function(){
    'use strict';

    var currentMarker = null;
    var lastLat = null;
    var lastLng = null;

    function updateMapFromInputs(){
        console.log('=== UPDATING MAP FROM INPUTS ===');

        var latEl = document.getElementById("id_latitude");
        var lonEl = document.getElementById("id_longitude");

        if(!latEl || !lonEl) {
            console.log('Lat/lng inputs not found');
            return;
        }

        var lat = parseFloat((latEl.value||"").replace(",", "."));
        var lng = parseFloat((lonEl.value||"").replace(",", "."));

        console.log('Parsed coordinates:', lat, lng);

        // Solo actualizar si las coordenadas son válidas y diferentes
        if(!isFinite(lat) || !isFinite(lng) || (lat === lastLat && lng === lastLng)) {
            console.log('Invalid or unchanged coordinates');
            return;
        }

        lastLat = lat;
        lastLng = lng;

        // Buscar el mapa de manera más confiable
        var map = findLeafletMap();
        if(!map) {
            console.log('No map found, retrying...');
            setTimeout(updateMapFromInputs, 100);
            return;
        }

        console.log('Found map, updating...');

        // Remover marcador anterior si existe
        if(currentMarker) {
            map.removeLayer(currentMarker);
        }

        // Crear nuevo marcador
        currentMarker = L.marker([lat, lng]);
        currentMarker.addTo(map);

        // Centrar el mapa en la nueva posición
        map.setView([lat, lng], Math.max(map.getZoom(), 15));

        // Disparar evento personalizado para que otros scripts sepan que el mapa se actualizó
        map.fire('pointupdated', {latlng: [lat, lng], marker: currentMarker});

        console.log('Map updated successfully');
    }

    function findLeafletMap(){
        // Método 1: Buscar en el objeto window
        if(window.leafletPointMaps) {
            for(var key in window.leafletPointMaps) {
                if(window.leafletPointMaps[key] instanceof L.Map) {
                    return window.leafletPointMaps[key];
                }
            }
        }

        // Método 2: Buscar contenedores con mapas
        var containers = document.querySelectorAll('.simple-map-widget, .leaflet-point-map, .leaflet-container');
        for(var i = 0; i < containers.length; i++) {
            var container = containers[i];
            if(container._leaflet_id) {
                return container.map;
            }
        }

        // Método 3: Buscar cualquier mapa Leaflet en la página
        var maps = [];
        for(var prop in window) {
            try {
                if(window[prop] && window[prop] instanceof L.Map) {
                    maps.push(window[prop]);
                }
            } catch(e) {
                // Ignorar errores
            }
        }

        return maps.length > 0 ? maps[0] : null;
    }

    function bind(){
        console.log('Binding input events');

        ["id_latitude","id_longitude"].forEach(function(id){
            var el = document.getElementById(id);
            if(!el) {
                console.log('Element not found:', id);
                return;
            }

            console.log('Binding events to:', id);

            // Escuchar múltiples eventos
            ["change","input","blur","keyup"].forEach(function(evt){
                el.addEventListener(evt, updateMapFromInputs);
            });
        });
    }

    function initialize(){
        console.log('Initializing map sync');
        bind();

        // Intentar actualizar inmediatamente
        setTimeout(updateMapFromInputs, 100);

        // Intentar de nuevo después de un tiempo por si el mapa tarda en cargar
        setTimeout(updateMapFromInputs, 500);
        setTimeout(updateMapFromInputs, 1000);
    }

    // Inicializar cuando el DOM esté listo
    if(document.readyState === 'loading') {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }

    // También escuchar cuando el widget esté listo
    document.addEventListener("leaflet-point-ready", initialize);

    console.log('Map sync script loaded');
})();
