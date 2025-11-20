// static/js/template_map_fix.js
(function() {
    'use strict';

    console.log('=== TEMPLATE MAP FIX ===');

    // Función que busca y arregla el contenedor id_geom_map
    function templateMapFix() {
        var geomMap = document.getElementById('id_geom_map');
        if (!geomMap) {
            console.log('id_geom_map not found, will retry...');
            setTimeout(templateMapFix, 100);
            return;
        }

        console.log('Processing id_geom_map:', geomMap.offsetWidth + 'x' + geomMap.offsetHeight);

        // Si el height es 0 o muy pequeño, arreglarlo
        if (geomMap.offsetHeight < 100) {
            console.log('Container has insufficient height, fixing...');

            // Forzar estilos
            geomMap.style.cssText = `
                width: 100% !important;
                height: 400px !important;
                min-height: 400px !important;
                display: block !important;
                visibility: visible !important;
                position: relative !important;
                background: #f8f9fa !important;
                border: 2px solid blue !important;
                overflow: hidden !important;
            `;

            console.log('Fixed container, new dimensions:', geomMap.offsetWidth + 'x' + geomMap.offsetHeight);

            // Crear mapa si Leaflet está disponible
            if (typeof L !== 'undefined') {
                try {
                    // Destruir mapa existente
                    if (geomMap._leaflet_id) {
                        console.log('Destroying existing map');
                        geomMap._leaflet_id = null;
                    }

                    console.log('Creating new map...');
                    var map = L.map(geomMap, {
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
                    window.geomMap = map;

                    // Eventos del mapa
                    map.on('click', function(e) {
                        console.log('Map clicked:', e.latlng);
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
                            console.log('Adding marker at:', latVal, lngVal);
                            L.marker([latVal, lngVal]).addTo(map);
                            map.setView([latVal, lngVal], 15);
                        }
                    }

                    console.log('SUCCESS: Template map fix completed');
                } catch (error) {
                    console.error('Error in template map fix:', error);
                }
            } else {
                console.log('Leaflet not available yet');
            }
        } else {
            console.log('Container already has proper dimensions');
        }
    }

    // Ejecutar múltiples veces
    templateMapFix();
    setTimeout(templateMapFix, 50);
    setTimeout(templateMapFix, 200);
    setTimeout(templateMapFix, 500);
    setTimeout(templateMapFix, 1000);
    setTimeout(templateMapFix, 2000);

    console.log('Template map fix loaded');
})();
