// static/js/fix_geom_map_height.js
(function() {
    'use strict';

    function fixGeomMapHeight() {
        console.log('=== FIXING GEOM MAP HEIGHT ===');

        // Buscar el contenedor específico que tiene height 0
        var geomMapContainer = document.getElementById('id_geom_map');
        if (!geomMapContainer) {
            console.log('id_geom_map not found, retrying...');
            setTimeout(fixGeomMapHeight, 100);
            return;
        }

        console.log('Found id_geom_map:', geomMapContainer);
        console.log('Current dimensions:', geomMapContainer.offsetWidth + 'x' + geomMapContainer.offsetHeight);

        // Forzar las dimensiones CSS
        var style = geomMapContainer.style;
        style.width = '100%';
        style.height = '400px';
        style.minHeight = '400px';
        style.display = 'block';
        style.visibility = 'visible';
        style.position = 'relative';
        style.backgroundColor = '#f8f9fa';
        style.border = '1px solid #ddd';
        style.borderRadius = '8px';
        style.overflow = 'hidden';

        // Forzar con setAttribute también
        geomMapContainer.setAttribute('style', style.cssText + '; width: 100% !important; height: 400px !important;');

        console.log('Fixed dimensions:', geomMapContainer.offsetWidth + 'x' + geomMapContainer.offsetHeight);

        // Si Leaflet está cargado, crear el mapa
        if (typeof L !== 'undefined' && !geomMapContainer._leaflet_id) {
            console.log('Creating map in id_geom_map');

            try {
                var map = L.map(geomMapContainer, {
                    center: [-16, -68],
                    zoom: 15,
                    scrollWheelZoom: true
                });

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                }).addTo(map);

                L.Control.geocoder({
                    defaultMarkGeocode: false
                }).on('markgeocode', function(e) {
                    map.setView(e.geocode.center, e.geocode.zoom || 15);
                }).addTo(map);

                // Almacenar referencia
                if (!window.leafletPointMaps) {
                    window.leafletPointMaps = {};
                }
                window.leafletPointMaps['id_geom_map'] = map;

                // Eventos del mapa
                map.on('click', function(e) {
                    var lat = document.getElementById('id_latitude');
                    var lng = document.getElementById('id_longitude');
                    if (lat && lng) {
                        lat.value = e.latlng.lat.toFixed(6);
                        lng.value = e.latlng.lng.toFixed(6);
                        lat.dispatchEvent(new Event('input', { bubbles: true }));
                        lng.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });

                // Agregar marcador si hay coordenadas
                var lat = document.getElementById('id_latitude');
                var lng = document.getElementById('id_longitude');
                if (lat && lng && lat.value && lng.value) {
                    var latVal = parseFloat(lat.value);
                    var lngVal = parseFloat(lng.value);
                    if (!isNaN(latVal) && !isNaN(lngVal)) {
                        L.marker([latVal, lngVal]).addTo(map);
                        map.setView([latVal, lngVal], 15);
                    }
                }

                console.log('SUCCESS: Map created in id_geom_map');
            } catch (error) {
                console.error('Error creating map:', error);
            }
        }
    }

    // Ejecutar inmediatamente
    fixGeomMapHeight();

    // Ejecutar después de delays
    setTimeout(fixGeomMapHeight, 50);
    setTimeout(fixGeomMapHeight, 200);
    setTimeout(fixGeomMapHeight, 500);
    setTimeout(fixGeomMapHeight, 1000);

    // Observar cambios en el DOM
    var observer = new MutationObserver(function(mutations) {
        var shouldFix = false;
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                shouldFix = true;
            }
        });

        if (shouldFix) {
            setTimeout(fixGeomMapHeight, 100);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    console.log('Geom map height fixer loaded');
})();
