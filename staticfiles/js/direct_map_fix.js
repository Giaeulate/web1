// static/js/direct_map_fix.js
(function() {
    'use strict';

    function directMapFix() {
        console.log('=== DIRECT MAP FIX ===');

        // Buscar los contenedores específicos
        var containers = [
            document.getElementById('id_geom_map'),
            document.getElementById('id_geom_div_map'),
            document.querySelector('.dj_map'),
            document.querySelector('.dj_map_wrapper')
        ];

        var targetContainer = null;
        for (var i = 0; i < containers.length; i++) {
            if (containers[i]) {
                targetContainer = containers[i];
                break;
            }
        }

        if (!targetContainer) {
            console.log('No target container found');
            return;
        }

        console.log('Target container:', targetContainer.id || targetContainer.className);

        // Forzar las dimensiones CSS directamente
        var style = targetContainer.style;
        style.cssText = `
            width: 100% !important;
            height: 400px !important;
            min-height: 400px !important;
            display: block !important;
            visibility: visible !important;
            position: relative !important;
            background: #f8f9fa !important;
            border: 1px solid #ddd !important;
            border-radius: 8px !important;
            overflow: hidden !important;
        `;

        // Si Leaflet está cargado, crear el mapa inmediatamente
        if (typeof L !== 'undefined') {
            console.log('Creating map directly');

            try {
                // Destruir mapa existente si hay uno
                if (window.leafletPointMaps && window.leafletPointMaps[targetContainer.id]) {
                    window.leafletPointMaps[targetContainer.id].remove();
                }

                // Crear mapa
                var map = L.map(targetContainer, {
                    center: [-16, -68],
                    zoom: 15,
                    scrollWheelZoom: true
                });

                // Agregar tiles
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);

                // Agregar geocoder
                L.Control.geocoder({
                    defaultMarkGeocode: false
                }).on('markgeocode', function(e) {
                    map.setView(e.geocode.center, e.geocode.zoom || 15);
                }).addTo(map);

                // Almacenar referencia
                if (!window.leafletPointMaps) {
                    window.leafletPointMaps = {};
                }
                window.leafletPointMaps[targetContainer.id] = map;

                // Eventos del mapa
                map.on('click', function(e) {
                    var latInput = document.getElementById('id_latitude');
                    var lngInput = document.getElementById('id_longitude');

                    if (latInput && lngInput) {
                        latInput.value = e.latlng.lat.toFixed(6);
                        lngInput.value = e.latlng.lng.toFixed(6);

                        var changeEvent = new Event('input', { bubbles: true });
                        latInput.dispatchEvent(changeEvent);
                        lngInput.dispatchEvent(changeEvent);
                    }
                });

                // Agregar marcador si hay coordenadas
                var latInput = document.getElementById('id_latitude');
                var lngInput = document.getElementById('id_longitude');

                if (latInput && lngInput && latInput.value && lngInput.value) {
                    var lat = parseFloat(latInput.value);
                    var lng = parseFloat(lngInput.value);

                    if (!isNaN(lat) && !isNaN(lng)) {
                        L.marker([lat, lng]).addTo(map);
                        map.setView([lat, lng], 15);
                    }
                }

                console.log('Direct map fix completed successfully');
            } catch (error) {
                console.error('Error in direct map fix:', error);
            }
        } else {
            console.log('Leaflet not loaded, retrying...');
            setTimeout(directMapFix, 100);
        }
    }

    // Ejecutar inmediatamente
    directMapFix();

    // Ejecutar después de delays
    setTimeout(directMapFix, 100);
    setTimeout(directMapFix, 500);
    setTimeout(directMapFix, 1000);
    setTimeout(directMapFix, 2000);

    console.log('Direct map fix loaded');
})();
