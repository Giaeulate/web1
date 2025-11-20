// static/js/widget_override.js
(function() {
    'use strict';

    console.log('=== WIDGET OVERRIDE ===');

    // Sobrescribir el widget de django-leaflet-point
    function overrideLeafletPointWidget() {
        // Buscar el campo geom
        var geomField = document.getElementById('id_geom');
        if (!geomField) {
            setTimeout(overrideLeafletPointWidget, 100);
            return;
        }

        console.log('Found geom field, looking for widget containers...');

        // Buscar contenedores del widget
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
            console.log('No widget container found, creating one...');

            // Crear contenedor si no existe
            targetContainer = document.createElement('div');
            targetContainer.id = 'id_geom_map';
            targetContainer.className = 'leaflet-point-map';
            targetContainer.style.cssText = `
                width: 100% !important;
                height: 400px !important;
                min-height: 400px !important;
                display: block !important;
                visibility: visible !important;
                position: relative !important;
                background: #f8f9fa !important;
                border: 2px solid green !important;
                margin: 10px 0 !important;
            `;

            // Insertar antes del campo geom
            geomField.parentNode.insertBefore(targetContainer, geomField);
        }

        console.log('Target container:', targetContainer.id || targetContainer.className);

        // Si Leaflet está disponible, crear el mapa
        if (typeof L !== 'undefined') {
            try {
                // Destruir mapa existente
                if (targetContainer._leaflet_id) {
                    targetContainer._leaflet_id = null;
                }

                console.log('Creating map in widget container');
                var map = L.map(targetContainer, {
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
                window.leafletPointMaps['widget_override'] = map;

                // Eventos del mapa
                map.on('click', function(e) {
                    console.log('Widget map clicked:', e.latlng);
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

                console.log('SUCCESS: Widget override completed');
            } catch (error) {
                console.error('Error in widget override:', error);
            }
        }
    }

    // Ejecutar inmediatamente y múltiples veces
    overrideLeafletPointWidget();
    setTimeout(overrideLeafletPointWidget, 100);
    setTimeout(overrideLeafletPointWidget, 300);
    setTimeout(overrideLeafletPointWidget, 600);
    setTimeout(overrideLeafletPointWidget, 1000);
    setTimeout(overrideLeafletPointWidget, 2000);

    console.log('Widget override loaded');
})();
