// static/js/inline_map_fix.js
(function() {
    'use strict';

    console.log('=== INLINE MAP FIX - RUNNING NOW ===');

    // Función que se ejecuta inmediatamente
    function inlineMapFix() {
        // Buscar el contenedor específico
        var geomMap = document.getElementById('id_geom_map');
        if (!geomMap) {
            console.log('id_geom_map not found yet, trying again...');
            setTimeout(inlineMapFix, 50);
            return;
        }

        console.log('Found id_geom_map with dimensions:', geomMap.offsetWidth + 'x' + geomMap.offsetHeight);

        // Forzar height si es 0
        if (geomMap.offsetHeight === 0 || geomMap.offsetHeight < 100) {
            console.log('Fixing height for id_geom_map');

            // Usar style directo
            geomMap.style.width = '100%';
            geomMap.style.height = '400px';
            geomMap.style.minHeight = '400px';
            geomMap.style.display = 'block';
            geomMap.style.visibility = 'visible';
            geomMap.style.position = 'relative';
            geomMap.style.backgroundColor = '#f8f9fa';
            geomMap.style.border = '2px solid red'; // Para debugging
            geomMap.style.overflow = 'hidden';

            console.log('Fixed height, new dimensions:', geomMap.offsetWidth + 'x' + geomMap.offsetHeight);

            // Si Leaflet está disponible, crear mapa
            if (typeof L !== 'undefined') {
                try {
                    if (!geomMap._leaflet_id) {
                        console.log('Creating map in fixed container');

                        var map = L.map(geomMap, {
                            center: [-16, -68],
                            zoom: 15
                        });

                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '&copy; OpenStreetMap contributors'
                        }).addTo(map);

                        L.Control.geocoder({
                            defaultMarkGeocode: false
                        }).on('markgeocode', function(e) {
                            map.setView(e.geocode.center, e.geocode.zoom || 15);
                        }).addTo(map);

                        // Eventos
                        map.on('click', function(e) {
                            var lat = document.getElementById('id_latitude');
                            var lng = document.getElementById('id_longitude');
                            if (lat && lng) {
                                lat.value = e.latlng.lat.toFixed(6);
                                lng.value = e.latlng.lng.toFixed(6);
                                lat.dispatchEvent(new Event('input'));
                                lng.dispatchEvent(new Event('input'));
                            }
                        });

                        // Agregar marcador existente
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
                    }
                } catch (error) {
                    console.error('Error creating map:', error);
                }
            }
        } else {
            console.log('Container already has proper height:', geomMap.offsetHeight);
        }
    }

    // Ejecutar inmediatamente
    inlineMapFix();

    // Ejecutar múltiples veces
    for (var i = 1; i <= 20; i++) {
        setTimeout(inlineMapFix, i * 50);
    }

    console.log('Inline map fix loaded and running');
})();
