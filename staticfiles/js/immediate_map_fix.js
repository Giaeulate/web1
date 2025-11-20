// static/js/immediate_map_fix.js
(function() {
    'use strict';

    function immediateMapFix() {
        console.log('=== IMMEDIATE MAP FIX ===');

        // Buscar contenedores inmediatamente
        var containers = document.querySelectorAll('.dj_map_wrapper, .dj_map, [id*="geom_map"], [id*="geom_div_map"]');

        if (containers.length === 0) {
            console.log('No containers found, retrying...');
            setTimeout(immediateMapFix, 50);
            return;
        }

        console.log('Found', containers.length, 'containers');

        for (var i = 0; i < containers.length; i++) {
            var container = containers[i];
            console.log('Fixing container:', container.id || container.className);

            // Forzar CSS inline
            container.style.cssText = `
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

            // Si Leaflet está disponible, crear el mapa
            if (typeof L !== 'undefined' && !container._leaflet_id) {
                try {
                    var map = L.map(container, {
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
                    window.leafletPointMaps[container.id || 'container_' + i] = map;

                    // Eventos
                    map.on('click', function(e) {
                        var latInput = document.getElementById('id_latitude');
                        var lngInput = document.getElementById('id_longitude');

                        if (latInput && lngInput) {
                            latInput.value = e.latlng.lat.toFixed(6);
                            lngInput.value = e.latlng.lng.toFixed(6);

                            var event = new Event('input', { bubbles: true });
                            latInput.dispatchEvent(event);
                            lngInput.dispatchEvent(event);
                        }
                    });

                    console.log('Map created in container', i);
                } catch (error) {
                    console.error('Error creating map in container', i, ':', error);
                }
            }
        }

        console.log('Immediate map fix completed');
    }

    // Ejecutar inmediatamente sin esperar nada
    immediateMapFix();

    // Verificar cada 50ms si los contenedores existen
    var checkInterval = setInterval(function() {
        var containers = document.querySelectorAll('.dj_map_wrapper, .dj_map, [id*="geom_map"], [id*="geom_div_map"]');
        if (containers.length > 0) {
            clearInterval(checkInterval);
            immediateMapFix();
        }
    }, 50);

    // Timeout de seguridad
    setTimeout(function() {
        clearInterval(checkInterval);
        immediateMapFix();
    }, 5000);

    console.log('Immediate map fix loaded');
})();
